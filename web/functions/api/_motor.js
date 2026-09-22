/**
 * Motor de agentes da EPIGE.
 *
 * Separado do `chat.js` porque é a parte que tem regra de negócio e merece ser
 * lida sozinha — e porque assim pode ser testada fora do runtime da Cloudflare.
 *
 * Um agente é a composição de quatro camadas, nesta ordem:
 *   base (identidade + regras invioláveis) → norma → conhecimento → papel → contexto
 *
 * A ordem não é arbitrária. As regras invioláveis vêm antes de tudo porque prompt
 * é lido em sequência e o que vem depois não deve poder relaxar o que veio antes.
 * O contexto do cliente vai no fim porque é a parte que muda a cada sessão — o
 * resto é prefixo estável, que é o que o cache de prompt sabe aproveitar.
 */

import { PROMPTS } from './_prompts.js';

/* Modelos por papel, conforme o desenho de custo do roteiro. O roteamento em
   Haiku é o que permite usar Opus só onde ele é necessário — é a decisão de
   arquitetura que mais impacta o custo da operação. */
export const MODELOS = {
  haiku: 'claude-haiku-4-5',
  sonnet: 'claude-sonnet-5',
  opus: 'claude-opus-5',
};

/* Tarifas em USD por milhão de tokens. Reconferir junto com
   docs/modelo-custo-precificacao.md sempre que a tabela oficial mudar. */
export const PRECO = {
  'claude-haiku-4-5': { entrada: 1.0, saida: 5.0, cache: 0.1 },
  'claude-sonnet-5': { entrada: 2.0, saida: 10.0, cache: 0.2 },
  'claude-opus-5': { entrada: 5.0, saida: 25.0, cache: 0.5 },
};

export const CAMBIO = 5.2;

export const NORMAS = {
  'iso-9001': { arquivo: 'normas/iso-9001', conhecimento: 'conhecimento/modos-de-falha-iso-9001', rotulo: 'ISO 9001' },
  'iso-14001': { arquivo: 'normas/iso-14001', conhecimento: 'conhecimento/modos-de-falha-iso-14001', rotulo: 'ISO 14001' },
  'iso-45001': { arquivo: 'normas/iso-45001', conhecimento: 'conhecimento/modos-de-falha-iso-45001', rotulo: 'ISO 45001' },
};

/** Conhecimento mais específico que o da norma, quando a sessão tem escopo estreito. */
const CONHECIMENTO_POR_ESCOPO = {
  '10.2': 'conhecimento/modos-de-falha-10.2',
};

/**
 * O registro de agentes.
 *
 * `base:false` só no orquestrador: ele não fala com o usuário, então carregar
 * identidade e regras de conduta nele seria pagar token por nada.
 */
export const AGENTES = {
  orquestrador: { papeis: ['papeis/orquestrador'], modelo: 'haiku', base: false, norma: false, max: 300 },
  diagnostico: { papeis: ['papeis/diagnostico'], modelo: 'sonnet', conhecimento: true, max: 2000 },
  consultor: { papeis: ['papeis/consultor'], modelo: 'sonnet', conhecimento: true, max: 1500 },
  analista: { papeis: ['papeis/analista-documentos'], modelo: 'sonnet', conhecimento: true, max: 2500 },
  auditor: { papeis: ['papeis/auditor', 'papeis/auditor-relatorio'], modelo: 'opus', conhecimento: true, max: 2500 },
  auditor_base: { papeis: ['papeis/auditor'], modelo: 'opus', max: 800 },
  causa: { papeis: ['papeis/analise-causa'], modelo: 'sonnet', conhecimento: true, max: 1200 },
  plano: { papeis: ['papeis/plano-de-acao'], modelo: 'sonnet', conhecimento: true, max: 2500 },
  redator: { papeis: ['papeis/redator'], modelo: 'sonnet', conhecimento: true, max: 2500 },
  formulario: { papeis: ['papeis/formulario'], modelo: 'sonnet', max: 2000 },
  legal: { papeis: ['papeis/legal-regulatorio'], modelo: 'sonnet', max: 2000 },
  sgi: { papeis: ['papeis/especialista-sgi'], modelo: 'sonnet', norma: false, max: 2000 },
  lacuna: { papeis: ['papeis/lacuna-edicoes'], modelo: 'sonnet', max: 2000 },
  vigilancia: { papeis: ['papeis/vigilancia'], modelo: 'sonnet', busca: true, max: 2000 },
};

/** Agentes que devolvem JSON — o front precisa saber se deve parsear. */
export const DEVOLVE_JSON = new Set([
  'orquestrador', 'diagnostico', 'analista', 'auditor', 'causa',
  'plano', 'formulario', 'legal', 'sgi', 'lacuna', 'vigilancia',
]);

const CAMPOS_CONTEXTO = ['nome', 'atividade', 'porte', 'nivel', 'situacao'];
const LIMITE_CAMPO = 600;

const limpar = (v, max) => String(v ?? '').slice(0, max).trim();

/**
 * Monta o prompt de sistema.
 * Devolve null quando o agente não existe — quem chama traduz em 400.
 */
export function montarSistema({ agente, norma, escopo, contexto }) {
  const cfg = AGENTES[agente];
  if (!cfg) return null;

  const partes = [];

  if (cfg.base !== false) {
    partes.push(PROMPTS['base/00-identidade'], PROMPTS['base/01-regras-inviolaveis']);
  }

  // A norma é obrigatória para quase todo agente: sem ela, o agente responderia
  // "sobre ISO" em geral, que é o jeito mais fácil de dar orientação errada.
  const usaNorma = cfg.norma !== false;
  if (usaNorma) {
    const n = NORMAS[norma];
    if (!n) return null;
    partes.push(PROMPTS[n.arquivo]);
    if (cfg.conhecimento) {
      const especifico = escopo && CONHECIMENTO_POR_ESCOPO[escopo];
      partes.push(PROMPTS[especifico] ?? PROMPTS[n.conhecimento]);
    }
  }

  if (escopo) {
    partes.push(
      `ESCOPO DESTA SESSÃO: exclusivamente o requisito ${escopo}. Se perguntarem sobre ` +
        `outro requisito, diga que esta sessão cobre apenas o ${escopo} e ofereça retomar o tema.`,
    );
  }

  partes.push(...cfg.papeis.map((p) => PROMPTS[p]));

  if (cfg.base !== false) {
    const valores = Object.fromEntries(
      CAMPOS_CONTEXTO.map((c) => [c, limpar(contexto?.[c], LIMITE_CAMPO) || 'não informada']),
    );
    partes.push(
      PROMPTS['base/02-contexto-cliente'].replace(
        /\{\{(\w+)\}\}/g,
        (_, chave) => valores[chave] ?? `{{${chave}}}`,
      ),
    );
  }

  return partes.filter(Boolean).join('\n\n---\n\n');
}

export const modeloDe = (agente) => MODELOS[AGENTES[agente]?.modelo ?? 'sonnet'];
export const maxTokensDe = (agente) => AGENTES[agente]?.max ?? 1500;

/** Ferramenta de busca web — só a vigilância usa. */
export const ferramentasDe = (agente) =>
  AGENTES[agente]?.busca
    ? [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }]
    : undefined;

export function custoBRL(modelo, uso) {
  const p = PRECO[modelo] ?? PRECO['claude-sonnet-5'];
  return (
    (((uso?.input_tokens ?? 0) * p.entrada +
      (uso?.output_tokens ?? 0) * p.saida +
      (uso?.cache_read_input_tokens ?? 0) * p.cache) /
      1e6) *
    CAMBIO
  );
}

/**
 * Motor de agentes da EPIGE.
 *
 * Separado do `chat.js` porque é a parte que tem regra de negócio e merece ser
 * lida sozinha — e porque assim pode ser testada fora do runtime da Cloudflare.
 *
 * Um agente é a composição de quatro camadas, nesta ordem:
 *   base (identidade + regras invioláveis) → norma → conhecimento → papel → contexto
 *
 * O auditor e o especialista em SGI aceitam sessão combinada: uma norma principal
 * e até três adicionais. Nesse caso a camada de norma e a de conhecimento se
 * repetem para cada uma, e entra o bloco de integração entre normas.
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

/**
 * As normas atendidas.
 *
 * `confianca` diz o quanto o conteúdo foi verificado, e não é enfeite: entra no
 * prompt e muda como o agente se comporta. Alta significa conferido contra
 * exemplar da norma; média significa edição apurada em fonte secundária e
 * mecanismos vindos do meu conhecimento, sem conferência. Num agente normativo,
 * a diferença entre as duas é a diferença entre orientar e adivinhar com
 * segurança aparente.
 */
export const NORMAS = {
  'iso-9001': { arquivo: 'normas/iso-9001', conhecimento: 'conhecimento/modos-de-falha-iso-9001', rotulo: 'ISO 9001', tema: 'Qualidade', confianca: 'alta' },
  'iso-14001': { arquivo: 'normas/iso-14001', conhecimento: 'conhecimento/modos-de-falha-iso-14001', rotulo: 'ISO 14001', tema: 'Ambiental', confianca: 'media' },
  'iso-45001': { arquivo: 'normas/iso-45001', conhecimento: 'conhecimento/modos-de-falha-iso-45001', rotulo: 'ISO 45001', tema: 'Saúde e segurança', confianca: 'alta' },
  'iso-27001': { arquivo: 'normas/iso-27001', conhecimento: 'conhecimento/modos-de-falha-iso-27001', rotulo: 'ISO/IEC 27001', tema: 'Segurança da informação', confianca: 'alta' },
  'iso-37001': { arquivo: 'normas/iso-37001', conhecimento: 'conhecimento/modos-de-falha-compliance', rotulo: 'ISO 37001', tema: 'Antissuborno', confianca: 'media' },
  'iso-37301': { arquivo: 'normas/iso-37301', conhecimento: 'conhecimento/modos-de-falha-compliance', rotulo: 'ISO 37301', tema: 'Compliance', confianca: 'alta' },
  'iso-39001': { arquivo: 'normas/iso-39001', conhecimento: 'conhecimento/modos-de-falha-iso-39001', rotulo: 'ISO 39001', tema: 'Segurança viária', confianca: 'media' },
  'iso-42001': { arquivo: 'normas/iso-42001', conhecimento: 'conhecimento/modos-de-falha-iso-42001', rotulo: 'ISO/IEC 42001', tema: 'Inteligência artificial', confianca: 'media' },
  'iso-50001': { arquivo: 'normas/iso-50001', conhecimento: 'conhecimento/modos-de-falha-iso-50001', rotulo: 'ISO 50001', tema: 'Gestão de energia', confianca: 'media' },
  'pbqp-h': { arquivo: 'normas/pbqp-h-siac', conhecimento: 'conhecimento/modos-de-falha-pbqp-h', rotulo: 'PBQP-H / SiAC', tema: 'Construção civil', confianca: 'media' },
  // Prática recomendada, não certificável: o auditor avalia maturidade, não conformidade.
  'pr-2030': { arquivo: 'normas/abnt-pr-2030', conhecimento: 'conhecimento/modos-de-falha-pr-2030', rotulo: 'ABNT PR 2030', tema: 'ESG', confianca: 'media', maturidade: true },
};

/** Quantas normas, além da principal, uma sessão combinada aceita. */
export const MAX_ADICIONAIS = 3;

/** Instrução extra para as normas ainda não conferidas contra exemplar. */
const CAUTELA_CONFIANCA_MEDIA_COMBINADA = (rotulos) =>
  `CAUTELA ADICIONAL NESTA SESSÃO, para: ${rotulos.join(', ')}. O conteúdo normativo destes ` +
  'referenciais foi apurado em fontes secundárias e no conhecimento do modelo, sem conferência ' +
  'contra exemplar. Para eles: não afirme número de cláusula como se tivesse certeza — diga a ' +
  'que se refere e sinalize que convém conferir no texto; não cite quantidade de controles, ' +
  'anexos ou itens de lista; e ao falar de edição, pergunte qual exemplar o cliente tem em mãos. ' +
  'Explicar o mecanismo e o propósito do requisito continua seguro; precisar a referência não.';

const CAUTELA_CONFIANCA_MEDIA =
  'CAUTELA ADICIONAL NESTA SESSÃO. O conteúdo normativo desta norma foi apurado em fontes ' +
  'secundárias e no conhecimento do modelo, sem conferência contra exemplar da norma. ' +
  'Em consequência: não afirme número de cláusula como se tivesse certeza — diga a que se ' +
  'refere e sinalize que convém conferir no texto; não cite quantidade de controles, anexos ' +
  'ou itens de lista; e ao falar de edição, pergunte qual exemplar o cliente tem em mãos. ' +
  'Explicar o mecanismo e o propósito do requisito continua seguro; precisar a referência não.';

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
  auditor: { papeis: ['papeis/auditor', 'papeis/auditor-relatorio'], modelo: 'opus', conhecimento: true, auditoria: true, combinada: true, max: 3500 },
  auditor_base: { papeis: ['papeis/auditor'], modelo: 'opus', auditoria: true, max: 800 },
  causa: { papeis: ['papeis/analise-causa'], modelo: 'sonnet', conhecimento: true, max: 1200 },
  plano: { papeis: ['papeis/plano-de-acao'], modelo: 'sonnet', conhecimento: true, max: 2500 },
  redator: { papeis: ['papeis/redator'], modelo: 'sonnet', conhecimento: true, max: 2500 },
  formulario: { papeis: ['papeis/formulario'], modelo: 'sonnet', max: 2000 },
  legal: { papeis: ['papeis/legal-regulatorio'], modelo: 'sonnet', max: 2000 },
  sgi: { papeis: ['papeis/especialista-sgi'], modelo: 'sonnet', combinada: true, max: 2000 },
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
 * As normas da sessão: a principal primeiro, depois as adicionais — só para agente
 * que aceita sessão combinada, sem repetição e sem id desconhecido.
 */
export function normasDaSessao(agente, norma, adicionais) {
  const cfg = AGENTES[agente];
  if (!cfg || cfg.norma === false) return [];
  const extras = cfg.combinada && Array.isArray(adicionais) ? adicionais : [];
  return [...new Set([norma, ...extras.map(String)])]
    .filter((id) => NORMAS[id])
    .slice(0, 1 + MAX_ADICIONAIS);
}

/** Bloco que só existe quando a sessão combina mais de um referencial. */
function blocoCombinado(ids) {
  const [principal, ...demais] = ids.map((id) => NORMAS[id].rotulo);
  return (
    `SESSÃO COMBINADA: ${principal} (referencial principal), com ${demais.join(', ')}. ` +
    'Cubra os elementos de cada referencial — o requisito específico não pode se perder dentro ' +
    'do comum. Toda constatação identifica o referencial no campo de requisito (por exemplo, ' +
    `"${principal} · tema"), e a classificação é por referencial. Aponte as interações entre ` +
    'processos e os objetivos que competem entre os sistemas, citando os critérios envolvidos. ' +
    'Nesta sessão, o relatório pode ter até 12 achados, com pelo menos um por referencial.'
  );
}

/**
 * Monta o prompt de sistema.
 * Devolve null quando o agente não existe — quem chama traduz em 400.
 */
export function montarSistema({ agente, norma, adicionais, escopo, contexto }) {
  const cfg = AGENTES[agente];
  if (!cfg) return null;

  const partes = [];

  if (cfg.base !== false) {
    partes.push(PROMPTS['base/00-identidade'], PROMPTS['base/01-regras-inviolaveis']);
  }

  // A norma é obrigatória para quase todo agente: sem ela, o agente responderia
  // "sobre ISO" em geral, que é o jeito mais fácil de dar orientação errada.
  const usaNorma = cfg.norma !== false;
  const ids = usaNorma ? normasDaSessao(agente, norma, adicionais) : [];
  if (usaNorma) {
    if (!NORMAS[norma]) return null;
    const ns = ids.map((id) => NORMAS[id]);
    partes.push(...ns.map((n) => PROMPTS[n.arquivo]));

    const medias = ns.filter((n) => n.confianca !== 'alta');
    if (medias.length) {
      partes.push(
        ns.length === 1
          ? CAUTELA_CONFIANCA_MEDIA
          : CAUTELA_CONFIANCA_MEDIA_COMBINADA(medias.map((n) => n.rotulo)),
      );
    }

    if (cfg.conhecimento) {
      const especifico = ns.length === 1 && escopo && CONHECIMENTO_POR_ESCOPO[escopo];
      // 37001 e 37301 compartilham o arquivo de compliance: não carregar duas vezes.
      const arquivos = especifico ? [especifico] : [...new Set(ns.map((n) => n.conhecimento))];
      partes.push(...arquivos.map((a) => PROMPTS[a]));
    }
  }

  // Os princípios da ISO 19011 valem para qualquer norma auditada.
  if (cfg.auditoria) partes.push(PROMPTS['conhecimento/principios-de-auditoria']);

  // Quem trabalha com mais de um referencial precisa saber o que integra e o que não.
  if (cfg.combinada) partes.push(PROMPTS['conhecimento/integracao-entre-normas']);

  if (escopo) {
    partes.push(
      `ESCOPO DESTA SESSÃO: exclusivamente o requisito ${escopo}. Se perguntarem sobre ` +
        `outro requisito, diga que esta sessão cobre apenas o ${escopo} e ofereça retomar o tema.`,
    );
  }

  partes.push(...cfg.papeis.map((p) => PROMPTS[p]));

  // Os dois blocos abaixo ajustam o papel para esta sessão, por isso vêm depois dele.
  if (ids.length > 1) partes.push(blocoCombinado(ids));
  if (cfg.auditoria && ids.some((id) => NORMAS[id].maturidade)) {
    partes.push(PROMPTS['conhecimento/avaliacao-de-maturidade']);
  }

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

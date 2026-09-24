/**
 * Proxy da API da Anthropic — Cloudflare Pages Function.
 *
 * Existe por três motivos, nesta ordem de importância:
 *
 * 1. A CHAVE FICA NO SERVIDOR. O navegador nunca a vê. Chave de API em código
 *    de front-end é chave vazada, sem exceção.
 * 2. OS PROMPTS FICAM NO SERVIDOR. Eles são o ativo do produto. O navegador
 *    manda qual agente, qual norma e o que o usuário disse — nunca as regras.
 * 3. GASTO SOB CONTROLE. Só quem tem sessão e papel de editor ou admin chama a
 *    IA; há limite por pessoa por hora, teto diário por empresa e teto diário
 *    da plataforma inteira.
 *
 * O contexto da empresa vem do banco, não do navegador: o agente responde para
 * a empresa da sessão, e ninguém consegue se passar por outra.
 *
 * Variáveis (Cloudflare → Settings → Variables and Secrets):
 *   ANTHROPIC_API_KEY   obrigatória, como segredo
 *   TETO_DIARIO_BRL     teto da plataforma inteira por dia, padrão 20
 *   TETO_ORG_BRL        teto padrão por empresa por dia, padrão 10
 *   ANTHROPIC_BASE_URL  só para teste local; em produção, não definir
 */

import { AGENTES, NORMAS, DEVOLVE_JSON, montarSistema, modeloDe, maxTokensDe, ferramentasDe, custoBRL } from './_motor.js';
import { json, lerCorpo, texto, HttpErro } from '../_lib/http.js';
import { um, executar, agora, hoje } from '../_lib/banco.js';
import { exigir } from '../_lib/sessao.js';
import { gastoHoje, tetoGlobal, tetoOrg } from '../_lib/uso.js';

const LIMITE_MENSAGEM = 24000; // documentos de cliente chegam por aqui
const MAX_MENSAGENS = 24;
const CHAMADAS_POR_HORA = 60;

export async function onRequestPost(ctx) {
  const inicio = Date.now();
  const s = exigir(ctx, { papeis: ['admin', 'editor'] });
  const { request, env } = ctx;

  if (!env.ANTHROPIC_API_KEY) throw new HttpErro(503, 'Servidor sem chave de API configurada.');

  const corpo = await lerCorpo(request, 400_000);
  const { agente, norma } = corpo;
  if (!AGENTES[agente]) throw new HttpErro(400, 'Agente desconhecido.');
  if (AGENTES[agente].norma !== false && !NORMAS[norma]) {
    throw new HttpErro(400, `O agente ${agente} precisa de uma norma válida.`);
  }

  // Normas adicionais só valem para agente que aceita sessão combinada; o motor
  // descarta id desconhecido, repetido ou excedente.
  const adicionais = Array.isArray(corpo.adicionais) ? corpo.adicionais.slice(0, 8) : [];
  // A demonstração guiada (/demo/) usa a empresa-exemplo digitada na própria
  // página; fora dela, vale sempre o contexto da empresa da sessão.
  const exemplo = corpo.demo === true && corpo.contexto && typeof corpo.contexto === 'object'
    ? Object.fromEntries(['nome', 'atividade', 'porte', 'nivel', 'situacao'].map((k) => [k, texto(corpo.contexto[k], 600)]).filter(([, v]) => v))
    : {};
  const sistema = montarSistema({
    agente, norma, adicionais, escopo: texto(corpo.escopo, 20) || null, contexto: { ...s.org, ...exemplo },
  });
  if (!sistema) throw new HttpErro(400, 'Não foi possível montar o agente com os parâmetros enviados.');

  const mensagens = (Array.isArray(corpo.mensagens) ? corpo.mensagens : [])
    .slice(-MAX_MENSAGENS)
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, LIMITE_MENSAGEM).trim() }));
  if (!mensagens.length || mensagens[0].role !== 'user') {
    throw new HttpErro(400, 'A conversa precisa começar com uma mensagem do usuário.');
  }

  const recentes = await um(env.EPIGE_DB, 'SELECT COUNT(*) AS n FROM chamadas WHERE usuario_id = ? AND em > ?', s.usuario.id, agora() - 3_600_000);
  if (recentes.n >= CHAMADAS_POR_HORA) {
    throw new HttpErro(429, `Limite de ${CHAMADAS_POR_HORA} chamadas por hora atingido. Tente daqui a pouco.`);
  }
  const [gastoOrg, gastoTotal] = await Promise.all([gastoHoje(env, s.org.id), gastoHoje(env)]);
  if (gastoOrg >= tetoOrg(env, s.org)) {
    throw new HttpErro(429, `A empresa atingiu o teto diário de IA (R$ ${tetoOrg(env, s.org).toFixed(2)}). Volta amanhã.`);
  }
  if (gastoTotal >= tetoGlobal(env)) {
    throw new HttpErro(429, 'A plataforma atingiu o teto diário de IA. Volta amanhã.');
  }

  const modelo = modeloDe(agente);
  const ferramentas = ferramentasDe(agente);

  /* O prompt de sistema é prefixo estável: mesma composição para todo cliente
     da mesma norma. Marcá-lo para cache derruba o custo de entrada a 10% nas
     chamadas seguintes — é a premissa de 85% de aproveitamento do modelo de
     custo, e sem isto ela não se realiza. */
  const requisicao = {
    model: modelo,
    max_tokens: maxTokensDe(agente),
    system: [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }],
    messages: mensagens,
  };
  if (ferramentas) requisicao.tools = ferramentas;

  let resposta;
  try {
    resposta = await fetch(`${env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requisicao),
    });
  } catch {
    throw new HttpErro(502, 'Não foi possível alcançar o serviço de IA.');
  }

  if (!resposta.ok) {
    // O texto de erro da API pode conter detalhe de conta. Não repassar ao navegador.
    console.error('anthropic', resposta.status, (await resposta.text()).slice(0, 500));
    throw new HttpErro(502, resposta.status === 429
      ? 'O serviço de IA está com muitas requisições. Tente em instantes.'
      : 'O serviço de IA respondeu com erro.');
  }

  const dados = await resposta.json();
  const uso = dados.usage ?? {};
  const custo = custoBRL(modelo, uso);

  // Registra o custo antes de qualquer outra checagem: recusa também é cobrada.
  // Só contadores — o conteúdo da conversa não é guardado.
  await executar(
    env.EPIGE_DB,
    `INSERT INTO chamadas (org_id, usuario_id, agente, modelo, entrada, saida, cache_leitura, cache_escrita, custo, ms, dia, em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    s.org.id, s.usuario.id, agente, modelo,
    uso.input_tokens ?? 0, uso.output_tokens ?? 0, uso.cache_read_input_tokens ?? 0, uso.cache_creation_input_tokens ?? 0,
    custo, Date.now() - inicio, hoje(), agora(),
  );

  // Um classificador pode recusar a requisição com HTTP 200. Checar antes de ler o texto.
  if (dados.stop_reason === 'refusal') throw new HttpErro(422, 'O serviço de IA recusou atender a esta requisição.');

  const textoResposta = (dados.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  if (!textoResposta) throw new HttpErro(502, 'A resposta veio vazia.');

  return json({
    texto: textoResposta,
    agente,
    modelo,
    json: DEVOLVE_JSON.has(agente),
    custo,
    gasto_empresa_hoje: gastoOrg + custo,
    teto_empresa: tetoOrg(env, s.org),
    tokens: (uso.input_tokens ?? 0) + (uso.output_tokens ?? 0),
    cache_lido: uso.cache_read_input_tokens ?? 0,
    truncado: dados.stop_reason === 'max_tokens',
  });
}

/** O que existe: agentes e normas. Só para quem tem sessão. */
export function onRequestGet(ctx) {
  exigir(ctx);
  return json({
    ia_configurada: Boolean(ctx.env.ANTHROPIC_API_KEY),
    agentes: Object.fromEntries(
      Object.entries(AGENTES).map(([nome, cfg]) => [
        nome,
        { modelo: modeloDe(nome), precisa_norma: cfg.norma !== false, combinada: Boolean(cfg.combinada), json: DEVOLVE_JSON.has(nome) },
      ]),
    ),
    normas: Object.fromEntries(
      Object.entries(NORMAS).map(([k, v]) => [k, { rotulo: v.rotulo, tema: v.tema, confianca: v.confianca, maturidade: Boolean(v.maturidade) }]),
    ),
  });
}

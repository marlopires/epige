/**
 * Proxy da API da Anthropic — Cloudflare Pages Function.
 *
 * Existe por três motivos, nesta ordem de importância:
 *
 * 1. A CHAVE FICA NO SERVIDOR. O navegador nunca a vê. Chave de API em código
 *    de front-end é chave vazada, sem exceção.
 * 2. OS PROMPTS FICAM NO SERVIDOR. Eles são o ativo do produto. O navegador
 *    manda "qual agente" e "o que o usuário disse" — nunca as regras.
 * 3. TETO DE GASTO. Uma página pública ligada a uma chave de API é um cartão de
 *    crédito exposto. Aqui há código de acesso, limite por sessão e teto diário.
 *
 * Variáveis de ambiente (painel do Cloudflare → Settings → Environment variables):
 *   ANTHROPIC_API_KEY   obrigatória, marcar como "encrypted"
 *   CODIGO_ACESSO       obrigatória na fase de teste. Sem ela, a API recusa tudo.
 *   TETO_DIARIO_BRL     opcional, padrão 20. Teto de gasto por dia.
 *
 * Binding opcional (Settings → Functions → KV namespace bindings):
 *   EPIGE_KV            habilita contagem de uso. Sem ele, o teto não é aplicado
 *                       e a resposta avisa — não falha em silêncio.
 */

import { PROMPTS } from './_prompts.js';

const MODELO = 'claude-sonnet-5';
const MAX_TOKENS = 1500;

/* Tarifas por milhão de tokens, USD. Fonte: tabela oficial da Anthropic.
   Reconferir junto com docs/modelo-custo-precificacao.md. */
const PRECO = { entrada: 2.0, saida: 10.0, cache: 0.2 };
const CAMBIO = 5.2;

/** Cada agente é uma composição de prompts de agentes/. */
const AGENTES = {
  consultor: ['00-regras-base', 'conhecimento/modos-de-falha-10.2', '01-consultor'],
  procedimento: ['00-regras-base', 'conhecimento/modos-de-falha-10.2', '02-redator-procedimento'],
  formulario: ['00-regras-base', '03-redator-formulario'],
  auditor: ['00-regras-base', '04-auditor-base', 'conhecimento/modos-de-falha-10.2', '05-auditor-auditoria'],
  auditor_base: ['00-regras-base', '04-auditor-base'],
  lacuna: ['00-regras-base', '06-lacuna-edicoes'],
};

const CAMPOS_CONTEXTO = ['nome', 'atividade', 'porte', 'nivel', 'situacao'];
const LIMITE_CAMPO = 600;
const LIMITE_MENSAGEM = 8000;
const MAX_MENSAGENS = 20;

const json = (dados, status = 200) =>
  new Response(JSON.stringify(dados), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const limpar = (v, max) => String(v ?? '').slice(0, max).trim();

function montarSistema(agente, contexto) {
  const partes = AGENTES[agente];
  if (!partes) return null;
  const valores = Object.fromEntries(
    CAMPOS_CONTEXTO.map((c) => [c, limpar(contexto?.[c], LIMITE_CAMPO) || 'não informada']),
  );
  return partes
    .map((p) => PROMPTS[p])
    .join('\n\n')
    .replace(/\{\{(\w+)\}\}/g, (_, chave) => valores[chave] ?? `{{${chave}}}`);
}

const custoBRL = (uso) =>
  (((uso?.input_tokens ?? 0) * PRECO.entrada +
    (uso?.output_tokens ?? 0) * PRECO.saida +
    (uso?.cache_read_input_tokens ?? 0) * PRECO.cache) /
    1e6) *
  CAMBIO;

/** Contagem de gasto do dia. Sem KV não há como contar — e dizemos isso. */
async function verificarTeto(env) {
  if (!env.EPIGE_KV) return { ok: true, medindo: false };
  const teto = Number(env.TETO_DIARIO_BRL ?? 20);
  const chave = `gasto:${new Date().toISOString().slice(0, 10)}`;
  const atual = Number((await env.EPIGE_KV.get(chave)) ?? 0);
  return { ok: atual < teto, medindo: true, atual, teto, chave };
}

async function registrarGasto(env, chave, valor) {
  if (!env.EPIGE_KV || !chave) return;
  const atual = Number((await env.EPIGE_KV.get(chave)) ?? 0);
  // 48h de validade: cobre o dia com folga e limpa sozinho.
  await env.EPIGE_KV.put(chave, String(atual + valor), { expirationTtl: 172800 });
}

/**
 * Telemetria por tipo de interação — item F1-6 do backlog.
 *
 * O modelo de custo tem seis premissas de confiança baixa, e todas movem o preço.
 * Nenhuma delas se resolve sem medir uso real, por tipo de interação, desde a
 * primeira chamada. Contadores agregados: nada de conteúdo de conversa.
 */
async function registrarTelemetria(env, agente, uso, custo, ms) {
  if (!env.EPIGE_KV) return;
  const chave = `tel:${new Date().toISOString().slice(0, 10)}:${agente}`;
  try {
    const atual = JSON.parse((await env.EPIGE_KV.get(chave)) ?? '{}');
    await env.EPIGE_KV.put(
      chave,
      JSON.stringify({
        chamadas: (atual.chamadas ?? 0) + 1,
        entrada: (atual.entrada ?? 0) + (uso?.input_tokens ?? 0),
        saida: (atual.saida ?? 0) + (uso?.output_tokens ?? 0),
        cache: (atual.cache ?? 0) + (uso?.cache_read_input_tokens ?? 0),
        custo: Number(((atual.custo ?? 0) + custo).toFixed(6)),
        ms_total: (atual.ms_total ?? 0) + ms,
      }),
      { expirationTtl: 7776000 }, // 90 dias: cobre o piloto inteiro
    );
  } catch {
    // Telemetria nunca derruba a resposta do usuário.
  }
}

export async function onRequestPost({ request, env }) {
  const inicio = Date.now();
  if (!env.ANTHROPIC_API_KEY) {
    return json({ erro: 'Servidor sem chave de API configurada.' }, 500);
  }
  if (!env.CODIGO_ACESSO) {
    // Falha fechada de propósito: esquecer de configurar o código não pode
    // resultar numa API aberta ligada a um cartão de crédito.
    return json({ erro: 'Servidor sem código de acesso configurado. Acesso bloqueado.' }, 503);
  }
  if (request.headers.get('x-epige-codigo') !== env.CODIGO_ACESSO) {
    return json({ erro: 'Código de acesso inválido.' }, 401);
  }

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return json({ erro: 'Corpo da requisição inválido.' }, 400);
  }

  const sistema = montarSistema(corpo.agente, corpo.contexto);
  if (!sistema) {
    return json({ erro: `Agente desconhecido: ${corpo.agente}` }, 400);
  }

  const mensagens = (Array.isArray(corpo.mensagens) ? corpo.mensagens : [])
    .slice(-MAX_MENSAGENS)
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .map((m) => ({ role: m.role, content: limpar(m.content, LIMITE_MENSAGEM) }));

  if (!mensagens.length || mensagens[0].role !== 'user') {
    return json({ erro: 'A conversa precisa começar com uma mensagem do usuário.' }, 400);
  }

  const teto = await verificarTeto(env);
  if (!teto.ok) {
    return json(
      { erro: `Teto diário de R$ ${teto.teto} atingido. O limite protege a conta de API; volta amanhã.` },
      429,
    );
  }

  let resposta;
  try {
    resposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: MODELO, max_tokens: MAX_TOKENS, system: sistema, messages: mensagens }),
    });
  } catch {
    return json({ erro: 'Não foi possível alcançar o serviço de IA.' }, 502);
  }

  if (!resposta.ok) {
    // O texto de erro da API pode conter detalhe de conta. Não repassar ao navegador.
    console.error('anthropic', resposta.status, (await resposta.text()).slice(0, 500));
    const publico =
      resposta.status === 429
        ? 'O serviço está com muitas requisições. Tente em instantes.'
        : 'O serviço de IA respondeu com erro.';
    return json({ erro: publico }, 502);
  }

  const dados = await resposta.json();
  const texto = (dados.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  if (!texto) return json({ erro: 'A resposta veio vazia.' }, 502);

  const custo = custoBRL(dados.usage);
  await registrarGasto(env, teto.chave, custo);
  await registrarTelemetria(env, corpo.agente, dados.usage, custo, Date.now() - inicio);

  return json({
    texto,
    custo,
    tokens: (dados.usage?.input_tokens ?? 0) + (dados.usage?.output_tokens ?? 0),
    medindo_teto: teto.medindo,
  });
}

/** GET serve para a página saber se o código de acesso vale, antes de gastar token. */
export async function onRequestGet({ request, env }) {
  const configurado = Boolean(env.ANTHROPIC_API_KEY && env.CODIGO_ACESSO);
  const autorizado = configurado && request.headers.get('x-epige-codigo') === env.CODIGO_ACESSO;
  return json({ configurado, autorizado, modelo: MODELO });
}

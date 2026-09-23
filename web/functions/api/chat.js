/**
 * Proxy da API da Anthropic — Cloudflare Pages Function.
 *
 * Existe por três motivos, nesta ordem de importância:
 *
 * 1. A CHAVE FICA NO SERVIDOR. O navegador nunca a vê. Chave de API em código
 *    de front-end é chave vazada, sem exceção.
 * 2. OS PROMPTS FICAM NO SERVIDOR. Eles são o ativo do produto. O navegador
 *    manda qual agente, qual norma e o que o usuário disse — nunca as regras.
 * 3. TETO DE GASTO. Uma página pública ligada a uma chave de API é um cartão de
 *    crédito exposto. Aqui há código de acesso, limites de tamanho e teto diário.
 *
 * Variáveis de ambiente (painel do Cloudflare → Settings → Environment variables):
 *   ANTHROPIC_API_KEY   obrigatória, marcar como "encrypted"
 *   CODIGO_ACESSO       obrigatória. Sem ela, a API recusa tudo.
 *   TETO_DIARIO_BRL     opcional, padrão 20.
 *
 * Binding opcional (Settings → Functions → KV namespace bindings):
 *   EPIGE_KV            habilita teto de gasto e telemetria. Sem ele, o teto não
 *                       é aplicado e a resposta avisa — não falha em silêncio.
 */

import {
  AGENTES, NORMAS, DEVOLVE_JSON,
  montarSistema, modeloDe, maxTokensDe, ferramentasDe, custoBRL,
} from './_motor.js';

const LIMITE_MENSAGEM = 24000; // documentos de cliente chegam por aqui
const MAX_MENSAGENS = 24;

const json = (dados, status = 200) =>
  new Response(JSON.stringify(dados), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const limpar = (v, max) => String(v ?? '').slice(0, max).trim();

/** Gasto acumulado do dia. Sem KV não há como contar — e dizemos isso. */
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
  await env.EPIGE_KV.put(chave, String(atual + valor), { expirationTtl: 172800 });
}

/**
 * Telemetria por tipo de interação — item F1-6 do backlog.
 *
 * O modelo de custo tem seis premissas de confiança baixa e todas movem o preço.
 * Nenhuma se resolve sem medir uso real, por agente, desde a primeira chamada.
 * Contadores agregados: nada de conteúdo de conversa.
 */
async function registrarTelemetria(env, agente, modelo, uso, custo, ms) {
  if (!env.EPIGE_KV) return;
  const chave = `tel:${new Date().toISOString().slice(0, 10)}:${agente}`;
  try {
    const atual = JSON.parse((await env.EPIGE_KV.get(chave)) ?? '{}');
    await env.EPIGE_KV.put(
      chave,
      JSON.stringify({
        modelo,
        chamadas: (atual.chamadas ?? 0) + 1,
        entrada: (atual.entrada ?? 0) + (uso?.input_tokens ?? 0),
        saida: (atual.saida ?? 0) + (uso?.output_tokens ?? 0),
        cache_leitura: (atual.cache_leitura ?? 0) + (uso?.cache_read_input_tokens ?? 0),
        cache_escrita: (atual.cache_escrita ?? 0) + (uso?.cache_creation_input_tokens ?? 0),
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

  const { agente, norma, escopo } = corpo;

  if (!AGENTES[agente]) {
    return json({ erro: `Agente desconhecido: ${agente}` }, 400);
  }
  if (AGENTES[agente].norma !== false && !NORMAS[norma]) {
    return json({ erro: `O agente ${agente} precisa de uma norma válida.` }, 400);
  }

  // Normas adicionais só valem para agente que aceita sessão combinada; o motor
  // descarta id desconhecido, repetido ou excedente.
  const adicionais = Array.isArray(corpo.adicionais) ? corpo.adicionais.slice(0, 8) : [];

  const sistema = montarSistema({
    agente, norma, adicionais, escopo: limpar(escopo, 20) || null, contexto: corpo.contexto,
  });
  if (!sistema) {
    return json({ erro: 'Não foi possível montar o agente com os parâmetros enviados.' }, 400);
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
    resposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requisicao),
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

  // Um classificador pode recusar a requisição com HTTP 200. Checar antes de ler o texto.
  if (dados.stop_reason === 'refusal') {
    return json({ erro: 'O serviço de IA recusou atender a esta requisição.' }, 422);
  }

  const texto = (dados.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  if (!texto) return json({ erro: 'A resposta veio vazia.' }, 502);

  const custo = custoBRL(modelo, dados.usage);
  await registrarGasto(env, teto.chave, custo);
  await registrarTelemetria(env, agente, modelo, dados.usage, custo, Date.now() - inicio);

  return json({
    texto,
    agente,
    modelo,
    json: DEVOLVE_JSON.has(agente),
    custo,
    tokens: (dados.usage?.input_tokens ?? 0) + (dados.usage?.output_tokens ?? 0),
    cache_lido: dados.usage?.cache_read_input_tokens ?? 0,
    truncado: dados.stop_reason === 'max_tokens',
    medindo_teto: teto.medindo,
  });
}

/** GET serve para a página saber o que existe e se o código vale, antes de gastar token. */
export async function onRequestGet({ request, env }) {
  const configurado = Boolean(env.ANTHROPIC_API_KEY && env.CODIGO_ACESSO);
  const autorizado = configurado && request.headers.get('x-epige-codigo') === env.CODIGO_ACESSO;
  return json({
    configurado,
    autorizado,
    agentes: autorizado
      ? Object.fromEntries(
          Object.entries(AGENTES).map(([nome, cfg]) => [
            nome,
            {
              modelo: modeloDe(nome),
              precisa_norma: cfg.norma !== false,
              combinada: Boolean(cfg.combinada),
              json: DEVOLVE_JSON.has(nome),
            },
          ]),
        )
      : undefined,
    normas: autorizado
      ? Object.fromEntries(
          Object.entries(NORMAS).map(([k, v]) => [
            k,
            { rotulo: v.rotulo, tema: v.tema, confianca: v.confianca, maturidade: Boolean(v.maturidade) },
          ]),
        )
      : undefined,
  });
}

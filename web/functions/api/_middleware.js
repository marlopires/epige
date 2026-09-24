/**
 * Porta de entrada de toda a API.
 *
 * Nesta ordem: recusa origem estranha em requisição que altera dado (CSRF),
 * recusa rodar sem banco ou sem segredo (falha fechada), garante o esquema,
 * carrega a sessão, e no fim põe os cabeçalhos de segurança e traduz erro em
 * JSON — sem vazar mensagem de exceção inesperada para o navegador.
 *
 * Fica em functions/api/ e não na raiz de propósito: na raiz, toda página
 * estática passaria por aqui, pagando invocação de função à toa.
 */

import { HttpErro, json, comCabecalhos } from '../_lib/http.js';
import { garantirEsquema } from '../_lib/banco.js';
import { lerSessao, segredo } from '../_lib/sessao.js';

const SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

function origemValida(request) {
  const origem = request.headers.get('origin');
  if (origem) return origem === new URL(request.url).origin;
  // Navegador moderno sempre manda Origin em POST. Sem ele, só aceitamos se o
  // próprio navegador declarar que a requisição é do mesmo site.
  return request.headers.get('sec-fetch-site') === 'same-origin';
}

export async function onRequest(ctx) {
  const { request, env } = ctx;
  try {
    if (!SEGUROS.has(request.method) && !origemValida(request)) {
      throw new HttpErro(403, 'Origem da requisição não permitida.');
    }
    if (!env.EPIGE_DB) throw new HttpErro(503, 'Servidor sem banco de dados configurado.');
    segredo(env);
    await garantirEsquema(env.EPIGE_DB);
    ctx.data.sessao = await lerSessao(env, request);
    return comCabecalhos(await ctx.next());
  } catch (e) {
    if (e instanceof HttpErro) return comCabecalhos(json({ erro: e.message, ...e.extra }, e.status));
    console.error('erro não tratado', request.method, new URL(request.url).pathname, e?.stack ?? e);
    return comCabecalhos(json({ erro: 'Erro interno. Tente de novo em instantes.' }, 500));
  }
}

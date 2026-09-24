/**
 * Respostas, erros e leitura de corpo — o básico que toda rota usa.
 *
 * Toda rota lança `HttpErro` em vez de montar resposta de erro na mão: o
 * middleware traduz, e assim nenhuma rota esquece um cabeçalho de segurança ou
 * vaza a mensagem de uma exceção inesperada.
 */

export class HttpErro extends Error {
  constructor(status, mensagem, extra = {}) {
    super(mensagem);
    this.status = status;
    this.extra = extra;
  }
}

export const json = (dados, status = 200, cabecalhos = {}) =>
  new Response(JSON.stringify(dados), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...cabecalhos },
  });

/** Cabeçalhos de segurança para toda resposta da API. */
export function comCabecalhos(resposta) {
  const r = new Response(resposta.body, resposta);
  r.headers.set('cache-control', 'no-store');
  r.headers.set('x-content-type-options', 'nosniff');
  r.headers.set('referrer-policy', 'no-referrer');
  r.headers.set('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
  r.headers.set('x-frame-options', 'DENY');
  return r;
}

/**
 * Lê o corpo JSON com limite de tamanho. Exigir `application/json` não é
 * formalidade: um formulário de outro site não consegue enviar esse tipo sem
 * disparar a verificação de CORS, o que fecha uma rota de CSRF.
 */
export async function lerCorpo(request, max = 300_000) {
  const tipo = request.headers.get('content-type') ?? '';
  if (!tipo.toLowerCase().startsWith('application/json')) {
    throw new HttpErro(415, 'Envie o corpo como JSON.');
  }
  const declarado = Number(request.headers.get('content-length') ?? 0);
  if (declarado > max) throw new HttpErro(413, 'Conteúdo grande demais.');
  const texto = await request.text();
  if (texto.length > max) throw new HttpErro(413, 'Conteúdo grande demais.');
  let dados;
  try {
    dados = JSON.parse(texto || '{}');
  } catch {
    throw new HttpErro(400, 'Corpo da requisição inválido.');
  }
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
    throw new HttpErro(400, 'Corpo da requisição inválido.');
  }
  return dados;
}

/** Texto limpo, com limite. Nunca devolve undefined. */
export const texto = (v, max = 500) => String(v ?? '').slice(0, max).trim();

/** Texto obrigatório: erro 400 com a mensagem dada se vier vazio. */
export function obrigatorio(v, max, mensagem) {
  const t = texto(v, max);
  if (!t) throw new HttpErro(400, mensagem);
  return t;
}

export function email(v) {
  const e = texto(v, 254).toLowerCase();
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e)) {
    throw new HttpErro(400, 'Informe um e-mail válido.');
  }
  return e;
}

export const PAPEIS = ['admin', 'editor', 'leitor'];

export function papel(v) {
  if (!PAPEIS.includes(v)) throw new HttpErro(400, 'Papel inválido.');
  return v;
}

export const ip = (request) => request.headers.get('cf-connecting-ip') ?? 'local';

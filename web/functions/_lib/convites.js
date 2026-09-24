/** Convites e redefinições de senha: tokens de uso único, guardados só como hash. */

import { token, sha256 } from './cripto.js';
import { um, executar, agora } from './banco.js';
import { HttpErro } from './http.js';

const CONVITE_MS = 7 * 86_400_000;
const REDEFINICAO_MS = 24 * 3_600_000;

const origem = (request) => new URL(request.url).origin;

/**
 * O token vai no fragmento da URL (depois do #). Fragmento não é enviado ao
 * servidor nem aparece em log de acesso ou no cabeçalho Referer.
 */
export async function criarConvite(env, request, { orgId, email, papel, criadoPor }) {
  const t = token();
  const id = crypto.randomUUID();
  await executar(
    env.EPIGE_DB,
    'INSERT INTO convites (id, token_hash, org_id, email, papel, criado_por, criado_em, expira_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id, await sha256(t), orgId, email, papel, criadoPor ?? null, agora(), agora() + CONVITE_MS,
  );
  return { id, link: `${origem(request)}/#convite=${t}`, expira_em: agora() + CONVITE_MS };
}

export async function lerConvite(env, t) {
  if (!t || String(t).length > 100) return null;
  return um(
    env.EPIGE_DB,
    `SELECT c.id, c.org_id, c.email, c.papel, o.nome AS empresa
       FROM convites c JOIN organizacoes o ON o.id = c.org_id
      WHERE c.token_hash = ? AND c.usado_em IS NULL AND c.expira_em > ? AND o.ativa = 1`,
    await sha256(String(t)),
    agora(),
  );
}

export async function criarRedefinicao(env, request, { usuarioId, criadoPor }) {
  const t = token();
  // Um link novo invalida os anteriores ainda não usados.
  await executar(env.EPIGE_DB, 'DELETE FROM redefinicoes WHERE usuario_id = ? AND usado_em IS NULL', usuarioId);
  await executar(
    env.EPIGE_DB,
    'INSERT INTO redefinicoes (token_hash, usuario_id, criado_por, criado_em, expira_em) VALUES (?, ?, ?, ?, ?)',
    await sha256(t), usuarioId, criadoPor, agora(), agora() + REDEFINICAO_MS,
  );
  return { link: `${origem(request)}/#redefinir=${t}`, expira_em: agora() + REDEFINICAO_MS };
}

/** Consome o token: marca como usado numa operação só, para não servir duas vezes. */
export async function consumirRedefinicao(env, t) {
  if (!t || String(t).length > 100) throw new HttpErro(400, 'Link de redefinição inválido ou expirado.');
  const hash = await sha256(String(t));
  const linha = await um(
    env.EPIGE_DB,
    `UPDATE redefinicoes SET usado_em = ? WHERE token_hash = ? AND usado_em IS NULL AND expira_em > ?
     RETURNING usuario_id`,
    agora(), hash, agora(),
  );
  if (!linha) throw new HttpErro(400, 'Link de redefinição inválido ou expirado. Peça um novo ao administrador.');
  return linha.usuario_id;
}

/**
 * Equipe da empresa: lista e convite. Só o administrador da empresa.
 *
 * Toda consulta filtra pela empresa da sessão — nunca por um id vindo do
 * navegador. É o que impede um administrador de ver a equipe de outra empresa.
 */

import { json, lerCorpo, email as lerEmail, papel as lerPapel, HttpErro, ip } from '../../_lib/http.js';
import { um, todos, agora, registrarEvento } from '../../_lib/banco.js';
import { exigir } from '../../_lib/sessao.js';
import { criarConvite } from '../../_lib/convites.js';

export async function onRequestGet(ctx) {
  const s = exigir(ctx, { papeis: ['admin'] });
  const db = ctx.env.EPIGE_DB;
  const usuarios = await todos(
    db,
    `SELECT id, nome, email, papel, ativo, (totp_segredo IS NOT NULL) AS totp_ativo, criado_em, ultimo_acesso
       FROM usuarios WHERE org_id = ? ORDER BY ativo DESC, nome`,
    s.org.id,
  );
  const convites = await todos(
    db,
    `SELECT id, email, papel, criado_em, expira_em FROM convites
      WHERE org_id = ? AND usado_em IS NULL AND expira_em > ? ORDER BY criado_em DESC`,
    s.org.id, agora(),
  );
  return json({ usuarios: usuarios.map((u) => ({ ...u, ativo: !!u.ativo, totp_ativo: !!u.totp_ativo, eu: u.id === s.usuario.id })), convites });
}

export async function onRequestPost(ctx) {
  const s = exigir(ctx, { papeis: ['admin'] });
  const { env, request } = ctx;
  const c = await lerCorpo(request, 2_000);
  const mail = lerEmail(c.email);
  const p = lerPapel(c.papel);
  if (await um(env.EPIGE_DB, 'SELECT 1 AS x FROM usuarios WHERE email = ?', mail)) {
    throw new HttpErro(409, 'Este e-mail já tem conta na EPIGE.');
  }
  const pendentes = await um(
    env.EPIGE_DB,
    'SELECT COUNT(*) AS n FROM convites WHERE org_id = ? AND usado_em IS NULL AND expira_em > ?',
    s.org.id, agora(),
  );
  if (pendentes.n >= 50) throw new HttpErro(429, 'Há convites pendentes demais. Revogue os que não serão usados.');

  const convite = await criarConvite(env, request, { orgId: s.org.id, email: mail, papel: p, criadoPor: s.usuario.id });
  await registrarEvento(env, { org: s.org.id, usuario: s.usuario.id, acao: 'convite_criado', alvo: mail, detalhe: `papel ${p}`, ip: ip(request) });
  return json({ link: convite.link, expira_em: convite.expira_em }, 201);
}

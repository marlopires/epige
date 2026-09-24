/** As sessões abertas do próprio usuário, e o botão "encerrar as outras". */

import { json, lerCorpo, HttpErro, ip } from '../../_lib/http.js';
import { todos, registrarEvento } from '../../_lib/banco.js';
import { exigir, encerrarTodas } from '../../_lib/sessao.js';

export async function onRequestGet(ctx) {
  const s = exigir(ctx);
  const linhas = await todos(
    ctx.env.EPIGE_DB,
    'SELECT id, criada_em, usada_em, ip, navegador FROM sessoes WHERE usuario_id = ? ORDER BY usada_em DESC',
    s.usuario.id,
  );
  // O id da sessão é o hash do cookie: não sai daqui, só a marca de "esta".
  return json({ sessoes: linhas.map(({ id, ...l }) => ({ ...l, atual: id === s.sessaoId })) });
}

export async function onRequestPost(ctx) {
  const s = exigir(ctx);
  const c = await lerCorpo(ctx.request, 1_000);
  if (c.acao !== 'encerrar_outras') throw new HttpErro(400, 'Ação desconhecida.');
  await encerrarTodas(ctx.env, s.usuario.id, s.sessaoId);
  await registrarEvento(ctx.env, { org: s.org.id, usuario: s.usuario.id, acao: 'sessoes_encerradas', ip: ip(ctx.request) });
  return json({ ok: true });
}

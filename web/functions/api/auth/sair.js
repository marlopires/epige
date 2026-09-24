import { json, ip } from '../../_lib/http.js';
import { registrarEvento } from '../../_lib/banco.js';
import { encerrarSessao, cookieVazio } from '../../_lib/sessao.js';

export async function onRequestPost(ctx) {
  const s = ctx.data.sessao;
  if (s) {
    await encerrarSessao(ctx.env, s.sessaoId);
    await registrarEvento(ctx.env, { org: s.org.id, usuario: s.usuario.id, acao: 'logout', ip: ip(ctx.request) });
  }
  return json({ ok: true }, 200, { 'set-cookie': cookieVazio() });
}

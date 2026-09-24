/** Revogar convite pendente. */

import { json, HttpErro, ip } from '../../../_lib/http.js';
import { executar, agora, registrarEvento } from '../../../_lib/banco.js';
import { exigir } from '../../../_lib/sessao.js';

export async function onRequestDelete(ctx) {
  const s = exigir(ctx, { papeis: ['admin'] });
  const r = await executar(
    ctx.env.EPIGE_DB,
    'UPDATE convites SET expira_em = ? WHERE id = ? AND org_id = ? AND usado_em IS NULL',
    agora(), String(ctx.params.id), s.org.id,
  );
  if (!r.meta?.changes) throw new HttpErro(404, 'Convite não encontrado.');
  await registrarEvento(ctx.env, { org: s.org.id, usuario: s.usuario.id, acao: 'convite_revogado', alvo: String(ctx.params.id), ip: ip(ctx.request) });
  return json({ ok: true });
}

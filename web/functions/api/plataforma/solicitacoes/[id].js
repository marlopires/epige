/** Recusar uma solicitação de acesso (aceitar é criar a empresa). */

import { json, HttpErro, ip } from '../../../_lib/http.js';
import { executar, registrarEvento } from '../../../_lib/banco.js';
import { exigir } from '../../../_lib/sessao.js';

export async function onRequestDelete(ctx) {
  const s = exigir(ctx, { superadmin: true });
  const r = await executar(
    ctx.env.EPIGE_DB,
    "UPDATE solicitacoes SET situacao = 'recusada' WHERE id = ? AND situacao = 'pendente'",
    String(ctx.params.id),
  );
  if (!r.meta?.changes) throw new HttpErro(404, 'Solicitação não encontrada.');
  await registrarEvento(ctx.env, { usuario: s.usuario.id, acao: 'solicitacao_recusada', alvo: String(ctx.params.id), ip: ip(ctx.request) });
  return json({ ok: true });
}

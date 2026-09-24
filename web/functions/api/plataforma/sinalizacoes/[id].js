/** Registrar o tratamento de uma sinalização: o que foi feito no agente, ou por que não. */

import { json, lerCorpo, obrigatorio, HttpErro, ip } from '../../../_lib/http.js';
import { executar, agora, registrarEvento } from '../../../_lib/banco.js';
import { exigir } from '../../../_lib/sessao.js';

export async function onRequestPatch(ctx) {
  const s = exigir(ctx, { superadmin: true });
  const c = await lerCorpo(ctx.request, 3_000);
  const tratamento = obrigatorio(c.tratamento, 1000, 'Descreva o tratamento dado.');
  const r = await executar(
    ctx.env.EPIGE_DB,
    "UPDATE sinalizacoes SET situacao = 'tratada', tratamento = ?, tratada_em = ? WHERE id = ?",
    tratamento, agora(), String(ctx.params.id),
  );
  if (!r.meta?.changes) throw new HttpErro(404, 'Sinalização não encontrada.');
  await registrarEvento(ctx.env, { usuario: s.usuario.id, acao: 'sinalizacao_tratada', alvo: String(ctx.params.id), detalhe: tratamento, ip: ip(ctx.request) });
  return json({ ok: true });
}

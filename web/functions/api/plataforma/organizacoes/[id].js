/** Ativar/desativar empresa e ajustar o teto diário de IA dela. */

import { json, lerCorpo, HttpErro, ip } from '../../../_lib/http.js';
import { um, executar, registrarEvento } from '../../../_lib/banco.js';
import { exigir } from '../../../_lib/sessao.js';

export async function onRequestPatch(ctx) {
  const s = exigir(ctx, { superadmin: true });
  const { env, request } = ctx;
  const id = String(ctx.params.id);
  const o = await um(env.EPIGE_DB, 'SELECT id, nome, ativa, teto_diario_brl FROM organizacoes WHERE id = ?', id);
  if (!o) throw new HttpErro(404, 'Empresa não encontrada.');
  const c = await lerCorpo(request, 1_000);

  const ativa = c.ativa === undefined ? !!o.ativa : !!c.ativa;
  if (!ativa && id === s.org.id) throw new HttpErro(400, 'Você não pode desativar a sua própria empresa.');
  let teto = o.teto_diario_brl;
  if (c.teto_diario_brl !== undefined) {
    teto = c.teto_diario_brl === null || c.teto_diario_brl === '' ? null : Number(c.teto_diario_brl);
    if (teto !== null && (!Number.isFinite(teto) || teto < 0 || teto > 10_000)) throw new HttpErro(400, 'Teto inválido.');
  }

  await executar(env.EPIGE_DB, 'UPDATE organizacoes SET ativa = ?, teto_diario_brl = ? WHERE id = ?', ativa ? 1 : 0, teto, id);
  if (!ativa) {
    await executar(env.EPIGE_DB, 'DELETE FROM sessoes WHERE usuario_id IN (SELECT id FROM usuarios WHERE org_id = ?)', id);
  }
  await registrarEvento(env, {
    org: id, usuario: s.usuario.id, acao: 'empresa_alterada', alvo: o.nome,
    detalhe: `ativa ${!!o.ativa}→${ativa}; teto ${o.teto_diario_brl ?? 'padrão'}→${teto ?? 'padrão'}`, ip: ip(request),
  });
  return json({ ok: true });
}

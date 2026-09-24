/** Aceite de nova versão dos termos de uso e da política de privacidade. */

import { json, lerCorpo, HttpErro, ip } from '../../_lib/http.js';
import { executar, agora, registrarEvento } from '../../_lib/banco.js';
import { exigir } from '../../_lib/sessao.js';
import { TERMOS_VERSAO } from '../../_lib/termos.js';

export async function onRequestPost(ctx) {
  const s = exigir(ctx, { semAceite: true });
  const c = await lerCorpo(ctx.request, 500);
  if (c.aceite !== true) throw new HttpErro(400, 'Marque que leu e aceita os termos.');
  await executar(ctx.env.EPIGE_DB, 'UPDATE usuarios SET termos_versao = ?, termos_aceitos_em = ? WHERE id = ?', TERMOS_VERSAO, agora(), s.usuario.id);
  await registrarEvento(ctx.env, { org: s.org.id, usuario: s.usuario.id, acao: 'termos_aceitos', detalhe: TERMOS_VERSAO, ip: ip(ctx.request) });
  return json({ ok: true });
}

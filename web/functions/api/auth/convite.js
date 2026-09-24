/** Mostra para quem é o convite, antes do cadastro. POST para o token não ir para log. */

import { json, lerCorpo, HttpErro, ip } from '../../_lib/http.js';
import { contarTentativas, registrarTentativa } from '../../_lib/banco.js';
import { lerConvite } from '../../_lib/convites.js';

export async function onRequestPost({ request, env }) {
  const chave = `convite:${ip(request)}`;
  if ((await contarTentativas(env, chave, 15 * 60_000)) >= 20) {
    throw new HttpErro(429, 'Muitas tentativas. Aguarde 15 minutos.');
  }
  const c = await lerCorpo(request, 2_000);
  const convite = await lerConvite(env, c.token);
  if (!convite) {
    await registrarTentativa(env, chave);
    throw new HttpErro(404, 'Convite inválido, expirado ou já usado. Peça um novo ao administrador.');
  }
  return json({ email: convite.email, empresa: convite.empresa, papel: convite.papel });
}

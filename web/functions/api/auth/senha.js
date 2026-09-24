/** Troca de senha pelo próprio usuário. Encerra as outras sessões dele. */

import { json, lerCorpo, HttpErro, ip } from '../../_lib/http.js';
import { um, executar, agora, registrarEvento, contarTentativas, registrarTentativa } from '../../_lib/banco.js';
import { hashSenha, verificarSenha, validarSenha } from '../../_lib/cripto.js';
import { exigir, encerrarTodas, segredo, verificaVazamento, iteracoes } from '../../_lib/sessao.js';

export async function onRequestPost(ctx) {
  const s = exigir(ctx);
  const { env, request } = ctx;
  const chave = `senha:${s.usuario.id}`;
  if ((await contarTentativas(env, chave, 15 * 60_000)) >= 5) {
    throw new HttpErro(429, 'Muitas tentativas. Aguarde 15 minutos.');
  }
  const c = await lerCorpo(request, 5_000);
  const u = await um(env.EPIGE_DB, 'SELECT senha FROM usuarios WHERE id = ?', s.usuario.id);
  const { ok } = await verificarSenha(String(c.atual ?? ''), u.senha, segredo(env), iteracoes(env));
  if (!ok) {
    await registrarTentativa(env, chave);
    throw new HttpErro(400, 'A senha atual não confere.');
  }
  const problema = await validarSenha(c.nova, s.usuario.email, verificaVazamento(env));
  if (problema) throw new HttpErro(400, problema);

  await executar(
    env.EPIGE_DB,
    'UPDATE usuarios SET senha = ?, senha_alterada_em = ? WHERE id = ?',
    await hashSenha(String(c.nova), segredo(env), iteracoes(env)), agora(), s.usuario.id,
  );
  await encerrarTodas(env, s.usuario.id, s.sessaoId);
  await registrarEvento(env, { org: s.org.id, usuario: s.usuario.id, acao: 'senha_alterada', ip: ip(request) });
  return json({ ok: true });
}

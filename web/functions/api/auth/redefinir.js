/**
 * Nova senha a partir do link gerado pelo administrador.
 *
 * Não faz login automático de propósito: se a pessoa usa 2FA, entrar direto
 * pelo link pularia o segundo fator. Encerra todas as sessões existentes.
 */

import { json, lerCorpo, HttpErro, ip } from '../../_lib/http.js';
import { um, executar, agora, registrarEvento, contarTentativas, registrarTentativa } from '../../_lib/banco.js';
import { hashSenha, validarSenha, sha256 } from '../../_lib/cripto.js';
import { consumirRedefinicao } from '../../_lib/convites.js';
import { encerrarTodas, segredo, verificaVazamento, iteracoes } from '../../_lib/sessao.js';

export async function onRequestPost({ request, env }) {
  const chave = `redefinir:${ip(request)}`;
  if ((await contarTentativas(env, chave, 15 * 60_000)) >= 20) {
    throw new HttpErro(429, 'Muitas tentativas. Aguarde 15 minutos.');
  }
  const c = await lerCorpo(request, 5_000);

  // Valida a senha antes de consumir o link, para um erro de digitação não gastá-lo.
  const previa = await um(
    env.EPIGE_DB,
    `SELECT u.email FROM redefinicoes r JOIN usuarios u ON u.id = r.usuario_id
      WHERE r.token_hash = ? AND r.usado_em IS NULL AND r.expira_em > ?`,
    await sha256(String(c.token ?? '')), agora(),
  );
  if (!previa) {
    await registrarTentativa(env, chave);
    throw new HttpErro(400, 'Link de redefinição inválido ou expirado. Peça um novo ao administrador.');
  }
  const problema = await validarSenha(c.nova, previa.email, verificaVazamento(env));
  if (problema) throw new HttpErro(400, problema);

  const usuarioId = await consumirRedefinicao(env, c.token);
  const u = await um(env.EPIGE_DB, 'SELECT org_id FROM usuarios WHERE id = ?', usuarioId);
  await executar(
    env.EPIGE_DB,
    'UPDATE usuarios SET senha = ?, senha_alterada_em = ? WHERE id = ?',
    await hashSenha(String(c.nova), segredo(env), iteracoes(env)), agora(), usuarioId,
  );
  await encerrarTodas(env, usuarioId);
  await registrarEvento(env, { org: u.org_id, usuario: usuarioId, acao: 'senha_redefinida', ip: ip(request) });
  return json({ ok: true });
}

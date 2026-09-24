/**
 * Verificação em duas etapas por aplicativo autenticador (TOTP).
 *
 * A chave é gerada aqui, mostrada uma vez e guardada cifrada com o SEGREDO do
 * servidor. Ativar exige um código válido — assim ninguém fica trancado por ter
 * digitado a chave errada no aplicativo. Desativar exige senha e código.
 */

import { json, lerCorpo, HttpErro, ip } from '../../_lib/http.js';
import { um, executar, registrarEvento, contarTentativas, registrarTentativa } from '../../_lib/banco.js';
import { aleatorio, base32, cifrar, decifrar, conferirTotp, verificarSenha } from '../../_lib/cripto.js';
import { exigir, segredo, iteracoes } from '../../_lib/sessao.js';

export async function onRequestPost(ctx) {
  const s = exigir(ctx);
  const { env, request } = ctx;
  const seg = segredo(env);
  const c = await lerCorpo(request, 2_000);
  const chave = `2fa:${s.usuario.id}`;
  if ((await contarTentativas(env, chave, 15 * 60_000)) >= 5) {
    throw new HttpErro(429, 'Muitas tentativas. Aguarde 15 minutos.');
  }
  const u = await um(env.EPIGE_DB, 'SELECT senha, totp_segredo, totp_pendente, totp_ultimo FROM usuarios WHERE id = ?', s.usuario.id);

  if (c.acao === 'iniciar') {
    if (u.totp_segredo) throw new HttpErro(409, 'A verificação em duas etapas já está ativa.');
    const chaveB32 = base32(aleatorio(20));
    await executar(env.EPIGE_DB, 'UPDATE usuarios SET totp_pendente = ? WHERE id = ?', await cifrar(chaveB32, seg), s.usuario.id);
    const rotulo = encodeURIComponent(`EPIGE:${s.usuario.email}`);
    return json({
      chave: chaveB32.match(/.{1,4}/g).join(' '),
      uri: `otpauth://totp/${rotulo}?secret=${chaveB32}&issuer=EPIGE&algorithm=SHA1&digits=6&period=30`,
    });
  }

  if (c.acao === 'confirmar') {
    if (!u.totp_pendente) throw new HttpErro(400, 'Comece a ativação de novo.');
    const passo = await conferirTotp(await decifrar(u.totp_pendente, seg), c.codigo, 0);
    if (!passo) {
      await registrarTentativa(env, chave);
      throw new HttpErro(400, 'Código incorreto. Confira se a chave foi digitada certo no aplicativo.');
    }
    await executar(
      env.EPIGE_DB,
      'UPDATE usuarios SET totp_segredo = totp_pendente, totp_pendente = NULL, totp_ultimo = ? WHERE id = ?',
      passo, s.usuario.id,
    );
    await registrarEvento(env, { org: s.org.id, usuario: s.usuario.id, acao: '2fa_ativado', ip: ip(request) });
    return json({ ok: true });
  }

  if (c.acao === 'desativar') {
    if (!u.totp_segredo) throw new HttpErro(409, 'A verificação em duas etapas não está ativa.');
    const { ok } = await verificarSenha(String(c.senha ?? ''), u.senha, seg, iteracoes(env));
    const passo = ok && (await conferirTotp(await decifrar(u.totp_segredo, seg), c.codigo, u.totp_ultimo));
    if (!passo) {
      await registrarTentativa(env, chave);
      throw new HttpErro(400, 'Senha ou código incorretos.');
    }
    await executar(env.EPIGE_DB, 'UPDATE usuarios SET totp_segredo = NULL, totp_pendente = NULL WHERE id = ?', s.usuario.id);
    await registrarEvento(env, { org: s.org.id, usuario: s.usuario.id, acao: '2fa_desativado', ip: ip(request) });
    return json({ ok: true });
  }

  throw new HttpErro(400, 'Ação desconhecida.');
}

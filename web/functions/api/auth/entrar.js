/**
 * Login.
 *
 * Mensagem de erro única para e-mail inexistente e senha errada, e o mesmo
 * trabalho de hash nos dois casos — para não revelar quem tem conta, nem pelo
 * texto nem pelo tempo de resposta. Cinco erros seguidos no mesmo e-mail
 * bloqueiam por 15 minutos; trinta do mesmo IP também.
 */

import { json, lerCorpo, texto, HttpErro, ip } from '../../_lib/http.js';
import { um, executar, registrarEvento, contarTentativas, registrarTentativa, limparTentativas } from '../../_lib/banco.js';
import { hashSenha, verificarSenha, conferirTotp, decifrar } from '../../_lib/cripto.js';
import { criarSessao, segredo, iteracoes } from '../../_lib/sessao.js';

const JANELA = 15 * 60_000;
const GENERICA = 'E-mail ou senha incorretos.';

export async function onRequestPost({ request, env }) {
  const c = await lerCorpo(request, 5_000);
  const mail = texto(c.email, 254).toLowerCase();
  const senha = String(c.senha ?? '').slice(0, 128);
  const chaveEmail = `login:${mail}`;
  const chaveIp = `login-ip:${ip(request)}`;
  const seg = segredo(env);

  if ((await contarTentativas(env, chaveEmail, JANELA)) >= 5 || (await contarTentativas(env, chaveIp, JANELA)) >= 30) {
    throw new HttpErro(429, 'Muitas tentativas sem sucesso. Aguarde 15 minutos e tente de novo.');
  }

  const u = await um(
    env.EPIGE_DB,
    `SELECT u.id, u.org_id, u.senha, u.ativo, u.totp_segredo, u.totp_ultimo, o.ativa AS org_ativa
       FROM usuarios u JOIN organizacoes o ON o.id = u.org_id WHERE u.email = ?`,
    mail,
  );

  if (!u) {
    await hashSenha(senha || 'x', seg, iteracoes(env)); // mesmo custo de tempo
    await registrarTentativa(env, chaveEmail, chaveIp);
    await registrarEvento(env, { acao: 'login_email_desconhecido', alvo: mail.slice(0, 120), ip: ip(request) });
    throw new HttpErro(401, GENERICA);
  }

  const { ok, refazer } = await verificarSenha(senha, u.senha, seg, iteracoes(env));
  if (!ok) {
    await registrarTentativa(env, chaveEmail, chaveIp);
    await registrarEvento(env, { org: u.org_id, usuario: u.id, acao: 'login_falhou', ip: ip(request) });
    throw new HttpErro(401, GENERICA);
  }
  if (!u.ativo || !u.org_ativa) {
    throw new HttpErro(403, 'Este acesso está desativado. Fale com o administrador da sua empresa.');
  }

  if (u.totp_segredo) {
    if (!c.codigo) throw new HttpErro(401, 'Informe o código do aplicativo autenticador.', { precisa_codigo: true });
    const passo = await conferirTotp(await decifrar(u.totp_segredo, seg), c.codigo, u.totp_ultimo);
    if (!passo) {
      await registrarTentativa(env, chaveEmail, chaveIp);
      await registrarEvento(env, { org: u.org_id, usuario: u.id, acao: 'login_2fa_falhou', ip: ip(request) });
      throw new HttpErro(401, 'Código do autenticador incorreto ou já usado.', { precisa_codigo: true });
    }
    await executar(env.EPIGE_DB, 'UPDATE usuarios SET totp_ultimo = ? WHERE id = ?', passo, u.id);
  }

  await limparTentativas(env, chaveEmail);
  if (refazer) {
    await executar(env.EPIGE_DB, 'UPDATE usuarios SET senha = ? WHERE id = ?', await hashSenha(senha, seg, iteracoes(env)), u.id);
  }
  await registrarEvento(env, { org: u.org_id, usuario: u.id, acao: 'login', ip: ip(request) });
  const setCookie = await criarSessao(env, request, u.id);
  return json({ ok: true }, 200, { 'set-cookie': setCookie });
}

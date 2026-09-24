/**
 * Cadastro por convite. O e-mail vem do convite, não do formulário: quem
 * recebeu o link não consegue se cadastrar com outro endereço.
 */

import { json, lerCorpo, obrigatorio, HttpErro, ip } from '../../_lib/http.js';
import { um, executar, agora, registrarEvento, contarTentativas, registrarTentativa } from '../../_lib/banco.js';
import { hashSenha, validarSenha, sha256 } from '../../_lib/cripto.js';
import { lerConvite } from '../../_lib/convites.js';
import { criarSessao, segredo, verificaVazamento, iteracoes } from '../../_lib/sessao.js';

export async function onRequestPost({ request, env }) {
  const chave = `convite:${ip(request)}`;
  if ((await contarTentativas(env, chave, 15 * 60_000)) >= 20) {
    throw new HttpErro(429, 'Muitas tentativas. Aguarde 15 minutos.');
  }
  const c = await lerCorpo(request, 5_000);
  const convite = await lerConvite(env, c.token);
  if (!convite) {
    await registrarTentativa(env, chave);
    throw new HttpErro(404, 'Convite inválido, expirado ou já usado. Peça um novo ao administrador.');
  }
  const nome = obrigatorio(c.nome, 120, 'Informe o seu nome.');
  const problema = await validarSenha(c.senha, convite.email, verificaVazamento(env));
  if (problema) throw new HttpErro(400, problema);

  if (await um(env.EPIGE_DB, 'SELECT 1 AS x FROM usuarios WHERE email = ?', convite.email)) {
    throw new HttpErro(409, 'Este e-mail já tem conta na EPIGE. Entre com a sua senha.');
  }

  const hash = await hashSenha(String(c.senha), segredo(env), iteracoes(env));

  // Marca o convite antes de criar o usuário: dois cliques no mesmo link não criam duas contas.
  const marcado = await um(
    env.EPIGE_DB,
    'UPDATE convites SET usado_em = ? WHERE token_hash = ? AND usado_em IS NULL RETURNING id',
    agora(), await sha256(String(c.token)),
  );
  if (!marcado) throw new HttpErro(409, 'Este convite acabou de ser usado.');

  const id = crypto.randomUUID();
  await executar(
    env.EPIGE_DB,
    `INSERT INTO usuarios (id, org_id, email, nome, senha, papel, criado_em, senha_alterada_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id, convite.org_id, convite.email, nome, hash, convite.papel, agora(), agora(),
  );
  await registrarEvento(env, { org: convite.org_id, usuario: id, acao: 'cadastro', detalhe: `papel ${convite.papel}`, ip: ip(request) });
  const setCookie = await criarSessao(env, request, id);
  return json({ ok: true }, 201, { 'set-cookie': setCookie });
}

/**
 * Primeiro acesso: cria a primeira conta da plataforma — a sua.
 *
 * Só funciona enquanto não existe nenhum usuário, e exige o CODIGO_ACESSO do
 * servidor. Depois da primeira conta, esta rota fica permanentemente fechada:
 * todo acesso seguinte é por convite.
 */

import { json, lerCorpo, obrigatorio, email as lerEmail, texto, HttpErro, ip } from '../../_lib/http.js';
import { um, executar, agora, registrarEvento, contarTentativas, registrarTentativa } from '../../_lib/banco.js';
import { hashSenha, validarSenha, iguais } from '../../_lib/cripto.js';
import { criarSessao, segredo, verificaVazamento, iteracoes } from '../../_lib/sessao.js';
import { TERMOS_VERSAO } from '../../_lib/termos.js';

async function haUsuarios(env) {
  return !!(await um(env.EPIGE_DB, 'SELECT 1 AS x FROM usuarios LIMIT 1'));
}

export async function onRequestGet({ env }) {
  return json({ disponivel: !!env.CODIGO_ACESSO && !(await haUsuarios(env)) });
}

export async function onRequestPost({ request, env }) {
  const chaveIp = `bootstrap:${ip(request)}`;
  if ((await contarTentativas(env, chaveIp, 3_600_000)) >= 10) {
    throw new HttpErro(429, 'Muitas tentativas. Aguarde uma hora.');
  }
  if (!env.CODIGO_ACESSO) throw new HttpErro(403, 'O primeiro acesso não está habilitado neste servidor.');
  if (await haUsuarios(env)) throw new HttpErro(409, 'A plataforma já foi configurada. Entre com a sua conta.');

  const c = await lerCorpo(request);
  if (!iguais(texto(c.codigo, 200), env.CODIGO_ACESSO)) {
    await registrarTentativa(env, chaveIp);
    throw new HttpErro(401, 'Código de acesso incorreto.');
  }
  if (c.aceite !== true) throw new HttpErro(400, 'Para criar o acesso, leia e aceite os Termos de uso e a Política de privacidade.');
  const empresa = obrigatorio(c.empresa, 120, 'Informe o nome da empresa.');
  const nome = obrigatorio(c.nome, 120, 'Informe o seu nome.');
  const mail = lerEmail(c.email);
  const problema = await validarSenha(c.senha, mail, verificaVazamento(env));
  if (problema) throw new HttpErro(400, problema);

  const orgId = crypto.randomUUID();
  const usuarioId = crypto.randomUUID();
  const t = agora();
  const hash = await hashSenha(String(c.senha), segredo(env), iteracoes(env));

  await executar(env.EPIGE_DB, 'INSERT INTO organizacoes (id, nome, criada_em) VALUES (?, ?, ?)', orgId, empresa, t);
  // Inserção condicional: se duas pessoas tentarem ao mesmo tempo, só uma leva.
  const r = await executar(
    env.EPIGE_DB,
    `INSERT INTO usuarios (id, org_id, email, nome, senha, papel, superadmin, criado_em, senha_alterada_em, termos_versao, termos_aceitos_em)
     SELECT ?, ?, ?, ?, ?, 'admin', 1, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM usuarios)`,
    usuarioId, orgId, mail, nome, hash, t, t, TERMOS_VERSAO, t,
  );
  if (!r.meta?.changes) {
    await executar(env.EPIGE_DB, 'DELETE FROM organizacoes WHERE id = ?', orgId);
    throw new HttpErro(409, 'A plataforma já foi configurada. Entre com a sua conta.');
  }

  await registrarEvento(env, { org: orgId, usuario: usuarioId, acao: 'plataforma_configurada', ip: ip(request) });
  const setCookie = await criarSessao(env, request, usuarioId);
  return json({ ok: true }, 201, { 'set-cookie': setCookie });
}

/**
 * Administração da plataforma (só a conta de superadmin — a sua).
 * Lista as empresas com uso e cria empresa nova já com o convite do admin dela.
 */

import { json, lerCorpo, obrigatorio, email as lerEmail, texto, HttpErro, ip } from '../../../_lib/http.js';
import { um, todos, executar, agora, registrarEvento } from '../../../_lib/banco.js';
import { exigir } from '../../../_lib/sessao.js';
import { criarConvite } from '../../../_lib/convites.js';

export async function onRequestGet(ctx) {
  exigir(ctx, { superadmin: true });
  const db = ctx.env.EPIGE_DB;
  const desde = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const organizacoes = await todos(
    db,
    `SELECT o.id, o.nome, o.ativa, o.criada_em, o.teto_diario_brl,
            (SELECT COUNT(*) FROM usuarios u WHERE u.org_id = o.id AND u.ativo = 1) AS usuarios,
            (SELECT COUNT(*) FROM documentos d WHERE d.org_id = o.id) AS documentos,
            (SELECT COALESCE(SUM(custo), 0) FROM chamadas c WHERE c.org_id = o.id AND c.dia >= ?) AS custo_30d
       FROM organizacoes o ORDER BY o.criada_em DESC`,
    desde,
  );
  const solicitacoes = await todos(
    db,
    "SELECT id, nome, email, empresa, telefone, mensagem, em FROM solicitacoes WHERE situacao = 'pendente' ORDER BY em DESC LIMIT 100",
  );
  return json({ organizacoes: organizacoes.map((o) => ({ ...o, ativa: !!o.ativa })), solicitacoes });
}

export async function onRequestPost(ctx) {
  const s = exigir(ctx, { superadmin: true });
  const { env, request } = ctx;
  const c = await lerCorpo(request, 2_000);
  const empresa = obrigatorio(c.empresa, 120, 'Informe o nome da empresa.');
  const mail = lerEmail(c.email);
  if (await um(env.EPIGE_DB, 'SELECT 1 AS x FROM usuarios WHERE email = ?', mail)) {
    throw new HttpErro(409, 'Este e-mail já tem conta na EPIGE.');
  }
  const orgId = crypto.randomUUID();
  await executar(env.EPIGE_DB, 'INSERT INTO organizacoes (id, nome, criada_em) VALUES (?, ?, ?)', orgId, empresa, agora());
  const convite = await criarConvite(env, request, { orgId, email: mail, papel: 'admin', criadoPor: s.usuario.id });
  const solicitacao = texto(c.solicitacao_id, 60);
  if (solicitacao) {
    await executar(env.EPIGE_DB, "UPDATE solicitacoes SET situacao = 'aceita' WHERE id = ?", solicitacao);
  }
  await registrarEvento(env, { org: orgId, usuario: s.usuario.id, acao: 'empresa_criada', alvo: empresa, detalhe: `admin ${mail}`, ip: ip(request) });
  return json({ id: orgId, link: convite.link, expira_em: convite.expira_em }, 201);
}

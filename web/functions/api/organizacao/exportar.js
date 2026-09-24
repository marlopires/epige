/**
 * Exportação completa dos dados da empresa, em JSON — direito de acesso e
 * portabilidade da LGPD, e também a garantia de que o cliente não fica preso.
 * Nada de hash de senha, chave de 2FA ou token sai daqui.
 */

import { json, ip } from '../../_lib/http.js';
import { todos, registrarEvento } from '../../_lib/banco.js';
import { exigir } from '../../_lib/sessao.js';

export async function onRequestGet(ctx) {
  const s = exigir(ctx, { papeis: ['admin'] });
  const db = ctx.env.EPIGE_DB;
  const org = s.org.id;
  const [usuarios, documentos, versoes, eventos, uso] = await Promise.all([
    todos(db, 'SELECT id, nome, email, papel, ativo, criado_em, ultimo_acesso, termos_versao, termos_aceitos_em FROM usuarios WHERE org_id = ?', org),
    todos(db, 'SELECT * FROM documentos WHERE org_id = ?', org),
    todos(db, 'SELECT v.* FROM versoes v JOIN documentos d ON d.id = v.documento_id WHERE d.org_id = ? ORDER BY v.documento_id, v.numero', org),
    todos(db, 'SELECT acao, alvo, detalhe, ip, em, usuario_id FROM eventos WHERE org_id = ? ORDER BY em', org),
    todos(db, 'SELECT dia, agente, modelo, COUNT(*) AS chamadas, SUM(custo) AS custo FROM chamadas WHERE org_id = ? GROUP BY dia, agente, modelo ORDER BY dia', org),
  ]);
  await registrarEvento(ctx.env, { org, usuario: s.usuario.id, acao: 'dados_exportados', ip: ip(ctx.request) });
  const { teto_diario_brl, ...dadosOrg } = s.org;
  return json(
    { exportado_em: new Date().toISOString(), organizacao: dadosOrg, usuarios, documentos, versoes, eventos, uso_de_ia: uso },
    200,
    { 'content-disposition': `attachment; filename="epige-exportacao-${new Date().toISOString().slice(0, 10)}.json"` },
  );
}

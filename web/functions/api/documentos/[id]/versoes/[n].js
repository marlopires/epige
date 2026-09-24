/** Conteúdo de uma versão específica — para consultar o histórico. Leitor só a vigente. */

import { json, HttpErro } from '../../../../_lib/http.js';
import { um } from '../../../../_lib/banco.js';
import { exigir } from '../../../../_lib/sessao.js';
import { carregar } from '../../../../_lib/documentos.js';

export async function onRequestGet(ctx) {
  const s = exigir(ctx);
  const d = await carregar(ctx.env.EPIGE_DB, s, ctx.params.id);
  const n = Number(ctx.params.n);
  if (!Number.isInteger(n) || n < 1) throw new HttpErro(400, 'Versão inválida.');
  const v = await um(
    ctx.env.EPIGE_DB,
    `SELECT v.numero, v.estado, v.conteudo, v.resumo, v.aprovado_em, u.nome AS aprovado_por
       FROM versoes v LEFT JOIN usuarios u ON u.id = v.aprovado_por
      WHERE v.documento_id = ? AND v.numero = ?`,
    d.id, n,
  );
  if (!v || (s.usuario.papel === 'leitor' && v.estado !== 'vigente')) throw new HttpErro(404, 'Versão não encontrada.');
  return json({ versao: v });
}

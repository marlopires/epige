/**
 * Um documento: dados, histórico de versões e o conteúdo da vigente e da aberta.
 * O leitor recebe só a vigente — é a "versão disponível para quem precisa" da
 * 7.5, sem expor rascunho.
 */

import { json } from '../../../_lib/http.js';
import { um, todos } from '../../../_lib/banco.js';
import { exigir } from '../../../_lib/sessao.js';
import { carregar, situacao, TIPOS } from '../../../_lib/documentos.js';

export async function onRequestGet(ctx) {
  const s = exigir(ctx);
  const db = ctx.env.EPIGE_DB;
  const d = await carregar(db, s, ctx.params.id);
  const leitor = s.usuario.papel === 'leitor';

  const versoes = await todos(
    db,
    `SELECT v.numero, v.estado, v.origem, v.resumo, v.parecer, v.criado_em, v.editado_em, v.enviado_em, v.aprovado_em,
            uc.nome AS criado_por, ue.nome AS editado_por, un.nome AS enviado_por, ua.nome AS aprovado_por,
            (v.criado_por = ?) AS minha
       FROM versoes v
       LEFT JOIN usuarios uc ON uc.id = v.criado_por
       LEFT JOIN usuarios ue ON ue.id = v.editado_por
       LEFT JOIN usuarios un ON un.id = v.enviado_por
       LEFT JOIN usuarios ua ON ua.id = v.aprovado_por
      WHERE v.documento_id = ? ${leitor ? "AND v.estado = 'vigente'" : ''}
      ORDER BY v.numero DESC`,
    s.usuario.id, d.id,
  );
  const vigente = d.versao_vigente != null
    ? await um(db, 'SELECT conteudo FROM versoes WHERE documento_id = ? AND numero = ?', d.id, d.versao_vigente)
    : null;
  const aberta = !leitor && d.versao_aberta != null
    ? await um(db, 'SELECT conteudo, estado, editado_em FROM versoes WHERE documento_id = ? AND numero = ?', d.id, d.versao_aberta)
    : null;

  return json({
    documento: {
      id: d.id,
      codigo: d.codigo,
      titulo: d.titulo,
      tipo: d.tipo,
      tipo_rotulo: TIPOS[d.tipo]?.rotulo ?? d.tipo,
      registro: !!TIPOS[d.tipo]?.registro,
      normas: d.normas ? d.normas.split(',') : [],
      obsoleto: !!d.obsoleto,
      versao_vigente: d.versao_vigente,
      versao_aberta: leitor ? null : d.versao_aberta,
      situacao: situacao(d, aberta?.estado ?? null),
      criado_em: d.criado_em,
      atualizado_em: d.atualizado_em,
    },
    versoes: versoes.map((v) => ({ ...v, minha: !!v.minha })),
    conteudo_vigente: vigente?.conteudo ?? null,
    aberta: aberta ? { conteudo: aberta.conteudo, estado: aberta.estado, editado_em: aberta.editado_em } : null,
  });
}

/**
 * Transições do ciclo de aprovação. Cada uma confere o estado atual na própria
 * instrução de UPDATE (`WHERE estado = ...`): dois cliques simultâneos não
 * aprovam duas vezes nem aprovam o que acabou de ser devolvido.
 *
 *   enviar     editor/admin   rascunho   → em_revisao
 *   devolver   admin          em_revisao → rascunho      (motivo obrigatório)
 *   aprovar    admin          em_revisao → vigente; a vigente anterior → substituida
 *   descartar  editor/admin   rascunho   → apagado (nunca foi emitido, não é retido)
 *   obsoletar  admin          documento inteiro → obsoleto (retido, fora de uso)
 */

import { json, lerCorpo, texto, HttpErro, ip } from '../../../_lib/http.js';
import { agora, registrarEvento } from '../../../_lib/banco.js';
import { exigir } from '../../../_lib/sessao.js';
import { carregar, versaoAberta } from '../../../_lib/documentos.js';

const QUEM = {
  enviar: ['admin', 'editor'],
  devolver: ['admin'],
  aprovar: ['admin'],
  descartar: ['admin', 'editor'],
  obsoletar: ['admin'],
};

export async function onRequestPost(ctx) {
  const c = await lerCorpo(ctx.request, 3_000);
  const acao = String(c.acao ?? '');
  if (!QUEM[acao]) throw new HttpErro(400, 'Ação desconhecida.');
  const s = exigir(ctx, { papeis: QUEM[acao] });
  const { env, request } = ctx;
  const db = env.EPIGE_DB;
  const d = await carregar(db, s, ctx.params.id);
  const motivo = texto(c.motivo, 1000);
  const t = agora();
  const evento = (nome, detalhe) =>
    registrarEvento(env, { org: s.org.id, usuario: s.usuario.id, acao: nome, alvo: d.codigo, detalhe, ip: ip(request) });

  if (acao === 'obsoletar') {
    if (d.obsoleto) throw new HttpErro(409, 'O documento já está obsoleto.');
    if (d.versao_vigente == null) throw new HttpErro(409, 'Este documento nunca foi aprovado. Descarte o rascunho em vez de torná-lo obsoleto.');
    if (!motivo) throw new HttpErro(400, 'Informe o motivo de tornar o documento obsoleto.');
    await db.batch([
      db.prepare("UPDATE versoes SET estado = 'obsoleta', parecer = ? WHERE documento_id = ? AND estado = 'vigente'").bind(motivo, d.id),
      db.prepare("DELETE FROM versoes WHERE documento_id = ? AND estado IN ('rascunho','em_revisao')").bind(d.id),
      db.prepare('UPDATE documentos SET obsoleto = 1, versao_aberta = NULL, atualizado_em = ? WHERE id = ?').bind(t, d.id),
    ]);
    await evento('documento_obsoleto', motivo);
    return json({ ok: true });
  }

  const v = await versaoAberta(db, d);
  if (!v) throw new HttpErro(409, 'Não há versão em elaboração neste documento.');
  const onde = [d.id, v.numero];

  if (acao === 'enviar') {
    const r = await db
      .prepare("UPDATE versoes SET estado = 'em_revisao', enviado_por = ?, enviado_em = ?, parecer = '' WHERE documento_id = ? AND numero = ? AND estado = 'rascunho'")
      .bind(s.usuario.id, t, ...onde).run();
    if (!r.meta?.changes) throw new HttpErro(409, 'Esta versão não está em rascunho.');
    await db.prepare('UPDATE documentos SET atualizado_em = ? WHERE id = ?').bind(t, d.id).run();
    await evento('enviado_para_aprovacao', `versão ${v.numero}`);
    return json({ ok: true });
  }

  if (acao === 'devolver') {
    if (!motivo) throw new HttpErro(400, 'Diga o que precisa mudar — quem elaborou vai ler isto.');
    const r = await db
      .prepare("UPDATE versoes SET estado = 'rascunho', parecer = ? WHERE documento_id = ? AND numero = ? AND estado = 'em_revisao'")
      .bind(motivo, ...onde).run();
    if (!r.meta?.changes) throw new HttpErro(409, 'Esta versão não está em revisão.');
    await db.prepare('UPDATE documentos SET atualizado_em = ? WHERE id = ?').bind(t, d.id).run();
    await evento('devolvido_para_ajuste', `versão ${v.numero}: ${motivo}`);
    return json({ ok: true });
  }

  if (acao === 'aprovar') {
    if (v.estado !== 'em_revisao') throw new HttpErro(409, 'Só versão enviada para aprovação pode ser aprovada.');
    // A primeira instrução só muda algo se a versão ainda estiver em revisão; as
    // demais dependem dela pelo número, dentro da mesma transação.
    const [r] = await db.batch([
      db.prepare("UPDATE versoes SET estado = 'vigente', aprovado_por = ?, aprovado_em = ?, parecer = ? WHERE documento_id = ? AND numero = ? AND estado = 'em_revisao'")
        .bind(s.usuario.id, t, motivo, ...onde),
      db.prepare("UPDATE versoes SET estado = 'substituida' WHERE documento_id = ? AND estado = 'vigente' AND numero != ? AND EXISTS (SELECT 1 FROM versoes WHERE documento_id = ? AND numero = ? AND estado = 'vigente')")
        .bind(d.id, v.numero, d.id, v.numero),
      db.prepare("UPDATE documentos SET versao_vigente = ?, versao_aberta = NULL, atualizado_em = ? WHERE id = ? AND EXISTS (SELECT 1 FROM versoes WHERE documento_id = ? AND numero = ? AND estado = 'vigente')")
        .bind(v.numero, t, d.id, d.id, v.numero),
    ]);
    if (!r.meta?.changes) throw new HttpErro(409, 'Esta versão acabou de mudar de estado. Recarregue.');
    const propria = v.criado_por === s.usuario.id ? ' (aprovada por quem elaborou)' : '';
    await evento('documento_aprovado', `versão ${v.numero}${propria}`);
    return json({ ok: true });
  }

  if (acao === 'descartar') {
    if (v.estado !== 'rascunho') throw new HttpErro(409, 'Só rascunho pode ser descartado. Peça ao aprovador para devolver antes.');
    if (d.versao_vigente == null) {
      // Documento que nunca teve versão aprovada: descartar é desistir dele.
      await db.batch([
        db.prepare('DELETE FROM versoes WHERE documento_id = ?').bind(d.id),
        db.prepare('DELETE FROM documentos WHERE id = ?').bind(d.id),
      ]);
      await evento('documento_descartado', d.titulo);
      return json({ ok: true, apagado: true });
    }
    await db.batch([
      db.prepare("DELETE FROM versoes WHERE documento_id = ? AND numero = ? AND estado = 'rascunho'").bind(...onde),
      db.prepare('UPDATE documentos SET versao_aberta = NULL, atualizado_em = ? WHERE id = ?').bind(t, d.id),
    ]);
    await evento('revisao_descartada', `versão ${v.numero}`);
    return json({ ok: true });
  }
}

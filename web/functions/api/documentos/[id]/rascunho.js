/**
 * Salvar rascunho. Se não há versão aberta, abre a próxima revisão.
 *
 * Controle de concorrência otimista: quem edita manda o `editado_em` que leu.
 * Se outra pessoa salvou no meio do caminho, o servidor recusa em vez de
 * sobrescrever em silêncio o trabalho dela.
 */

import { json, lerCorpo, texto, HttpErro, ip } from '../../../_lib/http.js';
import { um, agora, registrarEvento } from '../../../_lib/banco.js';
import { exigir } from '../../../_lib/sessao.js';
import { carregar, versaoAberta, conteudo as lerConteudo, TIPOS } from '../../../_lib/documentos.js';

export async function onRequestPut(ctx) {
  const s = exigir(ctx, { papeis: ['admin', 'editor'] });
  const { env, request } = ctx;
  const db = env.EPIGE_DB;
  const d = await carregar(db, s, ctx.params.id);
  if (d.obsoleto) throw new HttpErro(409, 'Documento obsoleto não é revisado. Crie um documento novo.');

  const c = await lerCorpo(request);
  const corpo = lerConteudo(c.conteudo);
  const resumo = texto(c.resumo, 500);
  const titulo = texto(c.titulo, 200) || d.titulo;
  const t = agora();
  const aberta = await versaoAberta(db, d);

  if (aberta) {
    if (aberta.estado !== 'rascunho') {
      throw new HttpErro(409, 'Esta versão está em revisão. Para editar, o aprovador precisa devolvê-la.');
    }
    if (c.editado_em != null && Number(c.editado_em) !== aberta.editado_em) {
      throw new HttpErro(409, 'Outra pessoa salvou este rascunho depois que você o abriu. Recarregue para não perder o trabalho dela.');
    }
    await db.batch([
      db.prepare(
        'UPDATE versoes SET conteudo = ?, resumo = ?, editado_por = ?, editado_em = ? WHERE documento_id = ? AND numero = ?',
      ).bind(corpo, resumo || aberta.resumo, s.usuario.id, t, d.id, aberta.numero),
      db.prepare('UPDATE documentos SET titulo = ?, atualizado_em = ? WHERE id = ?').bind(titulo, t, d.id),
    ]);
    return json({ numero: aberta.numero, editado_em: t });
  }

  // Sem versão aberta: é uma revisão nova sobre a vigente.
  if (TIPOS[d.tipo]?.registro) {
    throw new HttpErro(409, 'Registro aprovado não é revisado — é evidência. Se algo mudou, crie um registro novo.');
  }
  if (!resumo) throw new HttpErro(400, 'Descreva o que muda nesta revisão.');
  const ultima = await um(db, 'SELECT MAX(numero) AS n FROM versoes WHERE documento_id = ?', d.id);
  const numero = (ultima?.n ?? 0) + 1;
  try {
    await db.batch([
      db.prepare(
        `INSERT INTO versoes (documento_id, numero, estado, conteudo, origem, resumo, criado_por, criado_em, editado_por, editado_em)
         VALUES (?, ?, 'rascunho', ?, 'revisao', ?, ?, ?, ?, ?)`,
      ).bind(d.id, numero, corpo, resumo, s.usuario.id, t, s.usuario.id, t),
      db.prepare('UPDATE documentos SET versao_aberta = ?, titulo = ?, atualizado_em = ? WHERE id = ? AND versao_aberta IS NULL').bind(numero, titulo, t, d.id),
    ]);
  } catch (e) {
    if (/UNIQUE|PRIMARY/i.test(String(e?.message))) {
      throw new HttpErro(409, 'Outra pessoa abriu esta revisão agora mesmo. Recarregue o documento.');
    }
    throw e;
  }
  await registrarEvento(env, { org: s.org.id, usuario: s.usuario.id, acao: 'revisao_aberta', alvo: d.codigo, detalhe: `versão ${numero}: ${resumo}`, ip: ip(request) });
  return json({ numero, editado_em: t }, 201);
}


/** Lista e criação de documentos. */

import { json, lerCorpo, obrigatorio, texto, HttpErro, ip } from '../../_lib/http.js';
import { todos, agora, registrarEvento } from '../../_lib/banco.js';
import { exigir } from '../../_lib/sessao.js';
import { TIPOS, tipo as lerTipo, codigoValido, proximoCodigo, normas as lerNormas, conteudo as lerConteudo, situacao } from '../../_lib/documentos.js';

export async function onRequestGet(ctx) {
  const s = exigir(ctx);
  const leitor = s.usuario.papel === 'leitor';
  const linhas = await todos(
    ctx.env.EPIGE_DB,
    `SELECT d.id, d.codigo, d.titulo, d.tipo, d.normas, d.versao_vigente, d.versao_aberta, d.obsoleto, d.atualizado_em,
            d.apoio_ia, va.estado AS estado_aberta, vv.aprovado_em
       FROM documentos d
       LEFT JOIN versoes va ON va.documento_id = d.id AND va.numero = d.versao_aberta
       LEFT JOIN versoes vv ON vv.documento_id = d.id AND vv.numero = d.versao_vigente
      WHERE d.org_id = ? ${leitor ? 'AND d.versao_vigente IS NOT NULL AND d.obsoleto = 0' : ''}
      ORDER BY d.codigo`,
    s.org.id,
  );
  return json({
    tipos: Object.fromEntries(Object.entries(TIPOS).map(([k, v]) => [k, v.rotulo])),
    documentos: linhas.map((d) => ({
      ...d,
      obsoleto: !!d.obsoleto,
      situacao: situacao(d, leitor ? null : d.estado_aberta),
      estado_aberta: leitor ? undefined : d.estado_aberta,
      versao_aberta: leitor ? undefined : d.versao_aberta,
    })),
  });
}

export async function onRequestPost(ctx) {
  const s = exigir(ctx, { papeis: ['admin', 'editor'] });
  const { env, request } = ctx;
  const c = await lerCorpo(request);
  const t = lerTipo(c.tipo);
  const titulo = obrigatorio(c.titulo, 200, 'Informe o título do documento.');
  const corpo = lerConteudo(c.conteudo);
  const listaNormas = lerNormas(c.normas);
  const origem = texto(c.origem, 40) || 'manual';
  // Documento feito com IA fica marcado para sempre: a aprovação vai exigir declaração de revisão.
  const agenteIA = /^agente:[a-z_]{2,20}$/.test(origem) ? origem.slice(7) : '';
  const informado = c.codigo ? codigoValido(c.codigo) : null;
  const id = crypto.randomUUID();
  const t0 = agora();

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const codigo = informado ?? (await proximoCodigo(env.EPIGE_DB, s.org.id, t));
    try {
      await env.EPIGE_DB.batch([
        env.EPIGE_DB.prepare(
          `INSERT INTO documentos (id, org_id, codigo, titulo, tipo, normas, apoio_ia, versao_aberta, criado_por, criado_em, atualizado_em)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        ).bind(id, s.org.id, codigo, titulo, t, listaNormas, agenteIA, s.usuario.id, t0, t0),
        env.EPIGE_DB.prepare(
          `INSERT INTO versoes (documento_id, numero, estado, conteudo, origem, resumo, criado_por, criado_em, editado_por, editado_em)
           VALUES (?, 1, 'rascunho', ?, ?, 'Emissão inicial', ?, ?, ?, ?)`,
        ).bind(id, corpo, origem, s.usuario.id, t0, s.usuario.id, t0),
      ]);
      await registrarEvento(env, { org: s.org.id, usuario: s.usuario.id, acao: 'documento_criado', alvo: codigo, detalhe: titulo, ip: ip(request) });
      return json({ id, codigo }, 201);
    } catch (e) {
      if (!/UNIQUE/i.test(String(e?.message))) throw e;
      if (informado) throw new HttpErro(409, `Já existe um documento com o código ${informado}.`);
      // Dois documentos criados ao mesmo tempo disputaram o mesmo código: tenta o próximo.
    }
  }
  throw new HttpErro(409, 'Não foi possível reservar um código. Tente de novo.');
}

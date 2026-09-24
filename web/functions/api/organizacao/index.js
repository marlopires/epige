/**
 * O contexto da empresa — o que todos os agentes leem antes de responder.
 *
 * Mora no servidor, não no navegador: é da empresa, não de uma pessoa, e o
 * agente usa esta versão, não a que o navegador disser.
 */

import { json, lerCorpo, obrigatorio, texto, ip } from '../../_lib/http.js';
import { executar, registrarEvento } from '../../_lib/banco.js';
import { exigir } from '../../_lib/sessao.js';

export function onRequestGet(ctx) {
  const s = exigir(ctx);
  const { teto_diario_brl, ...org } = s.org;
  return json({ organizacao: org });
}

export async function onRequestPut(ctx) {
  const s = exigir(ctx, { papeis: ['admin', 'editor'] });
  const c = await lerCorpo(ctx.request, 5_000);
  const campos = {
    // O nome é identidade da conta: só o administrador muda.
    nome: s.usuario.papel === 'admin' ? obrigatorio(c.nome, 120, 'O nome da empresa é obrigatório.') : s.org.nome,
    atividade: texto(c.atividade, 300),
    porte: texto(c.porte, 80),
    nivel: texto(c.nivel, 80),
    situacao: texto(c.situacao, 2000),
  };
  await executar(
    ctx.env.EPIGE_DB,
    'UPDATE organizacoes SET nome = ?, atividade = ?, porte = ?, nivel = ?, situacao = ? WHERE id = ?',
    campos.nome, campos.atividade, campos.porte, campos.nivel, campos.situacao, s.org.id,
  );
  await registrarEvento(ctx.env, { org: s.org.id, usuario: s.usuario.id, acao: 'contexto_alterado', ip: ip(ctx.request) });
  return json({ organizacao: { id: s.org.id, ...campos } });
}

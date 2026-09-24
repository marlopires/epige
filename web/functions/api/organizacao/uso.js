/**
 * Uso de IA da empresa: hoje contra o teto, últimos 30 dias por dia e por agente.
 * Só contadores — nenhum conteúdo de conversa é guardado.
 */

import { json } from '../../_lib/http.js';
import { todos } from '../../_lib/banco.js';
import { exigir } from '../../_lib/sessao.js';
import { gastoHoje, tetoOrg } from '../../_lib/uso.js';

export async function onRequestGet(ctx) {
  const s = exigir(ctx, { papeis: ['admin', 'editor'] });
  const db = ctx.env.EPIGE_DB;
  const desde = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [porDia, porAgente] = await Promise.all([
    todos(db, 'SELECT dia, COUNT(*) AS chamadas, SUM(custo) AS custo FROM chamadas WHERE org_id = ? AND dia >= ? GROUP BY dia ORDER BY dia', s.org.id, desde),
    todos(db, 'SELECT agente, COUNT(*) AS chamadas, SUM(custo) AS custo FROM chamadas WHERE org_id = ? AND dia >= ? GROUP BY agente ORDER BY custo DESC', s.org.id, desde),
  ]);
  return json({ hoje: await gastoHoje(ctx.env, s.org.id), teto: tetoOrg(ctx.env, s.org), por_dia: porDia, por_agente: porAgente });
}

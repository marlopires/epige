/** Log de auditoria da empresa — quem fez o quê, quando e de onde. Só o admin. */

import { json } from '../../_lib/http.js';
import { todos } from '../../_lib/banco.js';
import { exigir } from '../../_lib/sessao.js';

export async function onRequestGet(ctx) {
  const s = exigir(ctx, { papeis: ['admin'] });
  const eventos = await todos(
    ctx.env.EPIGE_DB,
    `SELECT e.acao, e.alvo, e.detalhe, e.ip, e.em, u.nome AS usuario
       FROM eventos e LEFT JOIN usuarios u ON u.id = e.usuario_id
      WHERE e.org_id = ? ORDER BY e.em DESC LIMIT 300`,
    s.org.id,
  );
  return json({ eventos });
}

/** Respostas sinalizadas pelos usuários — a fila de melhoria dos agentes. Só a plataforma. */

import { json } from '../../../_lib/http.js';
import { todos } from '../../../_lib/banco.js';
import { exigir } from '../../../_lib/sessao.js';
import { MOTIVOS } from '../../../_lib/sinalizacoes.js';

export async function onRequestGet(ctx) {
  exigir(ctx, { superadmin: true });
  const linhas = await todos(
    ctx.env.EPIGE_DB,
    `SELECT s.id, s.agente, s.norma, s.motivo, s.comentario, s.trecho, s.situacao, s.tratamento, s.em, s.tratada_em,
            o.nome AS empresa, u.nome AS usuario
       FROM sinalizacoes s
       LEFT JOIN organizacoes o ON o.id = s.org_id
       LEFT JOIN usuarios u ON u.id = s.usuario_id
      ORDER BY (s.situacao = 'aberta') DESC, s.em DESC LIMIT 200`,
  );
  return json({ sinalizacoes: linhas.map((l) => ({ ...l, motivo_rotulo: MOTIVOS[l.motivo] ?? l.motivo })) });
}

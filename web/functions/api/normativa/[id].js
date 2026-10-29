/** Comentário completo de um referencial da normativa. */

import { json, HttpErro } from '../../_lib/http.js';
import { exigir } from '../../_lib/sessao.js';
import { NORMATIVA } from '../_normativa.js';

export function onRequestGet(ctx) {
  exigir(ctx);
  const n = Object.hasOwn(NORMATIVA, ctx.params.id) ? NORMATIVA[ctx.params.id] : null;
  if (!n) throw new HttpErro(404, 'Referencial não encontrado.');
  return json({ referencial: n });
}

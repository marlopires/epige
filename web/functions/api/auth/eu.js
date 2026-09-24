/** Quem sou eu. A página chama isto ao abrir, para saber se mostra o login. */

import { json } from '../../_lib/http.js';
import { exigir } from '../../_lib/sessao.js';

export function onRequestGet(ctx) {
  const s = exigir(ctx);
  const { teto_diario_brl, ...org } = s.org;
  return json({ usuario: s.usuario, organizacao: org });
}

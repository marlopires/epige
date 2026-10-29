/**
 * Normativa — os referenciais com comentário da EPIGE, item a item.
 *
 * A lista leva os números de item de cada referencial: é com eles que a interface
 * decide se "requisito 6.1.2" numa resposta vira link. O comentário em si vem
 * por referencial, em normativa/[id].js.
 *
 * Qualquer pessoa com sessão lê, inclusive o leitor: o comentário serve para
 * entender documento vigente tanto quanto resposta da IA.
 */

import { json } from '../../_lib/http.js';
import { exigir } from '../../_lib/sessao.js';
import { NORMATIVA } from '../_normativa.js';

export function onRequestGet(ctx) {
  exigir(ctx);
  return json({
    referenciais: Object.values(NORMATIVA).map((n) => ({
      id: n.norma, rotulo: n.rotulo, titulo: n.titulo, edicao: n.edicao,
      itens: n.itens.map((x) => x.n),
    })),
  });
}

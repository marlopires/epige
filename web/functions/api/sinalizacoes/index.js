/**
 * "Sinalizar problema nesta resposta" — o canal para quem usa a IA dizer que ela
 * errou. É o monitoramento pós-implantação que a ISO/IEC 42001 espera de quem
 * fornece sistema de IA: sem ele, a qualidade das respostas só seria conhecida
 * quando um cliente reclamasse fora da plataforma.
 *
 * A conversa não é guardada; o trecho só chega aqui porque a pessoa decidiu enviar.
 */

import { json, lerCorpo, texto, HttpErro, ip } from '../../_lib/http.js';
import { executar, agora, registrarEvento, contarTentativas, registrarTentativa } from '../../_lib/banco.js';
import { exigir } from '../../_lib/sessao.js';
import { AGENTES } from '../_motor.js';
import { MOTIVOS } from '../../_lib/sinalizacoes.js';

export async function onRequestPost(ctx) {
  const s = exigir(ctx, { papeis: ['admin', 'editor'] });
  const { env, request } = ctx;
  const chave = `sinalizacao:${s.usuario.id}`;
  if ((await contarTentativas(env, chave, 86_400_000)) >= 30) {
    throw new HttpErro(429, 'Limite diário de sinalizações atingido.');
  }
  const c = await lerCorpo(request, 20_000);
  if (!AGENTES[c.agente]) throw new HttpErro(400, 'Agente desconhecido.');
  if (!MOTIVOS[c.motivo]) throw new HttpErro(400, 'Escolha o motivo.');
  const id = crypto.randomUUID();
  await registrarTentativa(env, chave);
  await executar(
    env.EPIGE_DB,
    `INSERT INTO sinalizacoes (id, org_id, usuario_id, agente, norma, motivo, comentario, trecho, em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, s.org.id, s.usuario.id, c.agente, texto(c.norma, 20), c.motivo, texto(c.comentario, 1000), texto(c.trecho, 4000), agora(),
  );
  await registrarEvento(env, { org: s.org.id, usuario: s.usuario.id, acao: 'resposta_sinalizada', alvo: c.agente, detalhe: MOTIVOS[c.motivo], ip: ip(request) });
  return json({ ok: true }, 201);
}

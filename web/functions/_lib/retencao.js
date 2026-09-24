/**
 * Prazos de guarda da política de privacidade (/privacidade/), aplicados de fato.
 *
 * Roda no máximo a cada 6 horas por instância, pegando carona num login — as
 * Pages Functions não têm agendador. Se mudar um prazo aqui, mude a política,
 * e vice-versa: a política só é verdadeira se este arquivo a cumprir.
 */

import { agora } from './banco.js';

const ANO = 365 * 86_400_000;
export const PRAZOS = {
  eventos: 5 * ANO, // registros de acesso: mínimo legal de 6 meses (Marco Civil, art. 15)
  chamadas: 5 * ANO, // contadores de uso de IA, para faturamento
  sinalizacoes: 2 * ANO,
  solicitacoes: 1 * ANO,
  empresaDesativada: 182 * 86_400_000, // 6 meses para exportar, depois exclusão
};

let ultima = 0;

export async function aplicarRetencao(db, forcar = false) {
  const t = agora();
  if (!forcar && t - ultima < 6 * 3_600_000) return;
  ultima = t;

  // Empresas desativadas há mais de 6 meses: apaga tudo, menos o log de auditoria,
  // que tem prazo legal próprio e cai sozinho pela regra dos 5 anos.
  const limite = t - PRAZOS.empresaDesativada;
  const orgs = (await db.prepare('SELECT id FROM organizacoes WHERE ativa = 0 AND desativada_em IS NOT NULL AND desativada_em < ?').bind(limite).all()).results ?? [];
  for (const { id } of orgs) {
    await db.batch([
      db.prepare('DELETE FROM sessoes WHERE usuario_id IN (SELECT id FROM usuarios WHERE org_id = ?)').bind(id),
      db.prepare('DELETE FROM redefinicoes WHERE usuario_id IN (SELECT id FROM usuarios WHERE org_id = ?)').bind(id),
      db.prepare('DELETE FROM versoes WHERE documento_id IN (SELECT id FROM documentos WHERE org_id = ?)').bind(id),
      db.prepare('DELETE FROM documentos WHERE org_id = ?').bind(id),
      db.prepare('DELETE FROM convites WHERE org_id = ?').bind(id),
      db.prepare('DELETE FROM sinalizacoes WHERE org_id = ?').bind(id),
      db.prepare('DELETE FROM usuarios WHERE org_id = ?').bind(id),
      db.prepare("UPDATE organizacoes SET nome = 'Empresa excluída', atividade = '', porte = '', nivel = '', situacao = '' WHERE id = ?").bind(id),
    ]);
  }

  await db.batch([
    db.prepare('DELETE FROM eventos WHERE em < ?').bind(t - PRAZOS.eventos),
    db.prepare('DELETE FROM chamadas WHERE em < ?').bind(t - PRAZOS.chamadas),
    db.prepare('DELETE FROM sinalizacoes WHERE em < ?').bind(t - PRAZOS.sinalizacoes),
    db.prepare('DELETE FROM solicitacoes WHERE em < ?').bind(t - PRAZOS.solicitacoes),
  ]);
}

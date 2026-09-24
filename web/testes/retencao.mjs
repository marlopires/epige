#!/usr/bin/env node
/**
 * Testa os prazos de guarda da política de privacidade (_lib/retencao.js) num
 * SQLite em memória com a interface do D1. Não precisa de wrangler.
 *
 *   node web/testes/retencao.mjs
 */
import { DatabaseSync } from 'node:sqlite';
const raw = new DatabaseSync(':memory:');
// adaptador mínimo com a interface do D1
const st = (sql) => ({ sql, args: [], bind(...a) { this.args = a; return this; },
  all() { return { results: raw.prepare(this.sql).all(...this.args) }; },
  run() { const r = raw.prepare(this.sql).run(...this.args); return { meta: { changes: r.changes } }; },
  first() { return raw.prepare(this.sql).get(...this.args) ?? null; } });
const db = { prepare: (s) => ({ ...st(s), bind(...a) { const o = st(s); o.args = a; return o; } }),
  batch: async (l) => { raw.exec('BEGIN'); try { const r = l.map((x) => x.run()); raw.exec('COMMIT'); return r; } catch (e) { raw.exec('ROLLBACK'); throw e; } } };
const { garantirEsquema } = await import('../functions/_lib/banco.js');
await garantirEsquema(db);
const { aplicarRetencao } = await import('../functions/_lib/retencao.js');
const now = Date.now(), ANO = 365*86400000;
raw.exec(`INSERT INTO organizacoes (id,nome,ativa,criada_em,desativada_em) VALUES ('ativa','Ativa',1,0,NULL),('velha','Velha',0,0,${now-200*86400000}),('recente','Recente',0,0,${now-30*86400000})`);
for (const o of ['ativa','velha','recente']) {
  raw.exec(`INSERT INTO usuarios (id,org_id,email,nome,senha,papel,criado_em,senha_alterada_em) VALUES ('u-${o}','${o}','${o}@x.com','n','h','admin',0,0)`);
  raw.exec(`INSERT INTO documentos (id,org_id,codigo,titulo,tipo,criado_por,criado_em,atualizado_em) VALUES ('d-${o}','${o}','PR-001','t','procedimento','u-${o}',0,0)`);
  raw.exec(`INSERT INTO versoes (documento_id,numero,estado,conteudo,criado_por,criado_em) VALUES ('d-${o}',1,'vigente','x','u-${o}',0)`);
  raw.exec(`INSERT INTO eventos (org_id,acao,em) VALUES ('${o}','login',${now})`);
}
raw.exec(`INSERT INTO eventos (org_id,acao,em) VALUES ('ativa','antigo',${now-6*ANO})`);
raw.exec(`INSERT INTO solicitacoes (id,nome,email,empresa,em) VALUES ('s1','a','a@a','e',${now-2*ANO}),('s2','b','b@b','e',${now})`);
raw.exec(`INSERT INTO sinalizacoes (id,org_id,usuario_id,agente,motivo,em) VALUES ('x1','ativa','u-ativa','consultor','outro',${now-3*ANO}),('x2','ativa','u-ativa','consultor','outro',${now})`);
await aplicarRetencao(db, true);
const q = (s) => raw.prepare(s).all();
let falhas = 0;
const ok = (d, c) => { console.log(c ? '✓' : '✗', d); if (!c) falhas++; };
ok('empresa ativa intacta', q("SELECT * FROM usuarios WHERE org_id='ativa'").length===1 && q("SELECT * FROM versoes WHERE documento_id='d-ativa'").length===1);
ok('empresa desativada há 6+ meses apagada', q("SELECT * FROM usuarios WHERE org_id='velha'").length===0 && q("SELECT * FROM documentos WHERE org_id='velha'").length===0 && q("SELECT nome FROM organizacoes WHERE id='velha'")[0].nome==='Empresa excluída');
ok('log da empresa apagada é mantido (prazo legal)', q("SELECT * FROM eventos WHERE org_id='velha'").length===1);
ok('empresa desativada há 1 mês intacta', q("SELECT * FROM usuarios WHERE org_id='recente'").length===1);
ok('evento com mais de 5 anos apagado', q("SELECT * FROM eventos WHERE acao='antigo'").length===0);
ok('solicitação com mais de 1 ano apagada, recente mantida', q("SELECT id FROM solicitacoes").map(r=>r.id).join()==='s2');
ok('sinalização com mais de 2 anos apagada', q("SELECT id FROM sinalizacoes").map(r=>r.id).join()==='x2');
process.exit(falhas ? 1 : 0);

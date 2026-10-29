#!/usr/bin/env node
/**
 * Gera web/functions/api/_prompts.js a partir de agentes/.
 *
 * Para a aplicação publicada, `agentes/` é a FONTE. Os protótipos em `prototipos/`
 * têm cópias embutidas próprias e são legado — não alimentam nada em produção.
 *
 * Só as pastas ativas entram: base, normas, papeis, conhecimento. As pastas
 * `_extraidos-*` são o registro histórico da extração feita a partir dos
 * protótipos e ficam deliberadamente de fora.
 *
 *   node web/build-prompts.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PASTAS = ['base', 'normas', 'papeis', 'conhecimento'];

const prompts = {};
for (const pasta of PASTAS) {
  const origem = join(RAIZ, 'agentes', pasta);
  for (const arquivo of readdirSync(origem).filter((f) => f.endsWith('.txt')).sort()) {
    const chave = `${pasta}/${arquivo.replace(/\.txt$/, '')}`;
    prompts[chave] = readFileSync(join(origem, arquivo), 'utf8').trim();
  }
}

const destino = join(RAIZ, 'web', 'functions', 'api', '_prompts.js');
writeFileSync(
  destino,
  '// GERADO por web/build-prompts.mjs a partir de agentes/. Não edite à mão.\n' +
    `// Gerado em ${new Date().toISOString()}\n` +
    `export const PROMPTS = ${JSON.stringify(prompts, null, 2)};\n`,
);

const porPasta = PASTAS.map(
  (p) => `${p}: ${Object.keys(prompts).filter((k) => k.startsWith(p + '/')).length}`,
);
console.log(`${Object.keys(prompts).length} prompts -> web/functions/api/_prompts.js`);
console.log(`  ${porPasta.join(' · ')}`);

/* ---------- normativa: comentários item a item (ver agentes/normativa/README.md) ---------- */

const CAMPOS = { 'do que trata': 'trata', 'na prática': 'pratica', 'na auditoria': 'auditoria', 'mudou nesta edição': 'mudou' };
const CABECALHO = ['norma', 'rotulo', 'titulo', 'edicao', 'conferido'];

/** Lê um arquivo da normativa. Erro de formato para o build: conteúdo torto não vai ao ar. */
function lerNormativa(arquivo, texto) {
  const falha = (linha, msg) => { throw new Error(`${arquivo}:${linha}: ${msg}`); };
  const linhas = texto.replace(/\r/g, '').split('\n');
  if (linhas[0] !== '---') falha(1, 'falta o cabeçalho (---)');
  const meta = {};
  let i = 1;
  for (; i < linhas.length && linhas[i] !== '---'; i++) {
    const m = linhas[i].match(/^(\w+):\s*(.+)$/);
    if (!m) falha(i + 1, 'linha de cabeçalho inválida');
    meta[m[1]] = m[2].trim();
  }
  for (const c of CABECALHO) if (!meta[c]) falha(1, `cabeçalho sem "${c}"`);
  const itens = [];
  let atual = null;
  let campo = null;
  for (i++; i < linhas.length; i++) {
    const l = linhas[i];
    const titulo = l.match(/^(#{1,2})\s+([0-9A-Z][0-9A-Z.]*)\s+(.+)$/);
    if (titulo) {
      atual = { n: titulo[2], t: titulo[3].trim(), secao: titulo[1] === '#' };
      if (itens.some((x) => x.n === atual.n)) falha(i + 1, `item ${atual.n} repetido`);
      itens.push(atual);
      campo = null;
      continue;
    }
    if (/^#/.test(l)) falha(i + 1, 'título sem número de item');
    if (!l.trim()) { campo = null; continue; }
    if (!atual) falha(i + 1, 'texto antes do primeiro item');
    const m = l.match(/^([^:]{3,25}):\s*(.*)$/);
    if (m && CAMPOS[m[1].toLowerCase()]) {
      campo = CAMPOS[m[1].toLowerCase()];
      if (atual[campo]) falha(i + 1, `campo "${m[1]}" repetido no item ${atual.n}`);
      atual[campo] = m[2].trim();
    } else if (campo) {
      atual[campo] += ' ' + l.trim();
    } else {
      falha(i + 1, `linha fora de campo no item ${atual.n} (use "Do que trata:", "Na prática:"…)`);
    }
  }
  for (const x of itens) if (!x.trata) falha(1, `item ${x.n} sem "Do que trata:"`);
  if (!itens.length) falha(1, 'nenhum item');
  return { ...meta, itens };
}

const pastaNormativa = join(RAIZ, 'agentes', 'normativa');
const normativa = {};
for (const arquivo of readdirSync(pastaNormativa).filter((f) => f.endsWith('.md') && f !== 'README.md').sort()) {
  const n = lerNormativa(`agentes/normativa/${arquivo}`, readFileSync(join(pastaNormativa, arquivo), 'utf8'));
  if (normativa[n.norma]) throw new Error(`agentes/normativa/${arquivo}: norma "${n.norma}" já definida em outro arquivo`);
  normativa[n.norma] = n;
}
writeFileSync(
  join(RAIZ, 'web', 'functions', 'api', '_normativa.js'),
  '// GERADO por web/build-prompts.mjs a partir de agentes/normativa/. Não edite à mão.\n' +
    `export const NORMATIVA = ${JSON.stringify(normativa, null, 2)};\n`,
);
const totalItens = Object.values(normativa).reduce((s, n) => s + n.itens.length, 0);
console.log(`${Object.keys(normativa).length} referenciais, ${totalItens} itens -> web/functions/api/_normativa.js`);

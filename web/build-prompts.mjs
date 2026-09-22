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

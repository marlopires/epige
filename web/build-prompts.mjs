#!/usr/bin/env node
/**
 * Gera web/functions/api/_prompts.js a partir de agentes/.
 *
 * Isto inverte a direção que o agentes/README.md descrevia: para a aplicação
 * publicada, agentes/ passa a ser a FONTE. O protótipo HTML segue com sua
 * própria cópia embutida e é legado — não alimenta mais nada em produção.
 *
 *   node web/build-prompts.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEM = join(RAIZ, 'agentes', 'demo-10.2');

const prompts = {};
for (const arquivo of readdirSync(ORIGEM).filter((f) => f.endsWith('.txt')).sort()) {
  prompts[arquivo.replace(/\.txt$/, '')] = readFileSync(join(ORIGEM, arquivo), 'utf8').trim();
}

const destino = join(RAIZ, 'web', 'functions', 'api', '_prompts.js');
writeFileSync(destino,
  '// GERADO por web/build-prompts.mjs a partir de agentes/. Não edite à mão.\n' +
  `// Gerado em ${new Date().toISOString()}\n` +
  `export const PROMPTS = ${JSON.stringify(prompts, null, 2)};\n`);

console.log(`${Object.keys(prompts).length} prompts -> web/functions/api/_prompts.js`);

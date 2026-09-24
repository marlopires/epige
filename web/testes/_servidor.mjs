/**
 * Sobe a plataforma localmente para teste: wrangler pages dev (runtime real da
 * Cloudflare), banco D1 descartável e um simulador da API da Anthropic.
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CODIGO = 'codigo-de-teste-123';

/** Resposta que serve a todos os renderizadores da interface. */
const RESPOSTA_IA = JSON.stringify({
  veredito: 'Resposta simulada para teste.',
  achados: [{ classificacao: 'nao_conformidade', requisito: '10.2', constatacao: 'Constatação simulada.', evidencia: 'Evidência simulada.' }],
  conclusao: 'Conclusão simulada.',
});

export async function iniciarServidor() {
  let ultima = null;
  const simulador = createServer((req, res) => {
    let corpo = '';
    req.on('data', (c) => (corpo += c));
    req.on('end', () => {
      ultima = JSON.parse(corpo || '{}');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ content: [{ type: 'text', text: RESPOSTA_IA }], usage: { input_tokens: 1000, output_tokens: 200 }, stop_reason: 'end_turn' }));
    });
  });
  await new Promise((ok) => simulador.listen(0, '127.0.0.1', ok));

  const porta = 8700 + Math.floor(Math.random() * 250);
  const base = `http://127.0.0.1:${porta}`;
  const persistencia = mkdtempSync(join(tmpdir(), 'epige-teste-'));
  const [cmd, ...pre] = process.env.WRANGLER ? [process.env.WRANGLER] : ['npx', '--yes', 'wrangler@4'];
  const servidor = spawn(cmd, [
    ...pre, 'pages', 'dev', 'public', '--port', String(porta), '--ip', '127.0.0.1',
    '--d1', 'EPIGE_DB', '--persist-to', persistencia,
    '--binding', 'SEGREDO=segredo-de-teste-com-mais-de-32-caracteres',
    '--binding', `CODIGO_ACESSO=${CODIGO}`,
    '--binding', 'ANTHROPIC_API_KEY=chave-falsa',
    '--binding', `ANTHROPIC_BASE_URL=http://127.0.0.1:${simulador.address().port}`,
    '--binding', 'VERIFICAR_SENHA_VAZADA=0',
    '--binding', 'TETO_ORG_BRL=5',
  ], { cwd: WEB, env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  servidor.stdout.on('data', (d) => (log += d));
  servidor.stderr.on('data', (d) => (log += d));

  const parar = () => {
    servidor.kill('SIGTERM');
    simulador.close();
    try { rmSync(persistencia, { recursive: true, force: true }); } catch {}
  };

  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`${base}/api/auth/primeiro-acesso`)).status === 200) break;
    } catch {}
    if (i > 90) {
      parar();
      throw new Error(`O servidor local não subiu.\n${log.slice(-2000)}`);
    }
    await new Promise((ok) => setTimeout(ok, 1000));
  }
  return { base, parar, ultimaRequisicaoIA: () => ultima, log: () => log };
}

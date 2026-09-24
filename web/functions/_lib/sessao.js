/**
 * Sessão por cookie.
 *
 * O cookie leva só um token aleatório; o banco guarda o SHA-256 dele. Vazou o
 * banco, os tokens não servem. O cookie é `__Host-` (só HTTPS, só este domínio,
 * caminho /), `HttpOnly` (JavaScript da página não lê) e `SameSite=Strict`
 * (outro site não consegue fazer o navegador enviá-lo).
 *
 * Duas validades: 12 horas sem uso encerra; 7 dias encerra de qualquer jeito.
 */

import { token, sha256 } from './cripto.js';
import { um, executar, agora } from './banco.js';
import { HttpErro, ip } from './http.js';
import { TERMOS_VERSAO } from './termos.js';
import { aplicarRetencao } from './retencao.js';

export const COOKIE = '__Host-epige';
const OCIOSA_MS = 12 * 3_600_000;
const MAXIMA_MS = 7 * 86_400_000;
const RENOVAR_MS = 5 * 60_000;

const cookie = (valor, maxAge) =>
  `${COOKIE}=${valor}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

export const cookieVazio = () => cookie('', 0);

function lerCookie(request) {
  const bruto = request.headers.get('cookie') ?? '';
  for (const parte of bruto.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === COOKIE) return v.join('=');
  }
  return null;
}

/** Cria a sessão e devolve o cabeçalho Set-Cookie. */
export async function criarSessao(env, request, usuarioId) {
  const t = token();
  const agoraMs = agora();
  await executar(
    env.EPIGE_DB,
    'INSERT INTO sessoes (id, usuario_id, criada_em, usada_em, expira_em, ip, navegador) VALUES (?, ?, ?, ?, ?, ?, ?)',
    await sha256(t),
    usuarioId,
    agoraMs,
    agoraMs,
    agoraMs + MAXIMA_MS,
    ip(request),
    (request.headers.get('user-agent') ?? '').slice(0, 200),
  );
  await executar(env.EPIGE_DB, 'UPDATE usuarios SET ultimo_acesso = ? WHERE id = ?', agoraMs, usuarioId);
  // Faxina: sessão vencida não fica guardada à toa.
  await executar(env.EPIGE_DB, 'DELETE FROM sessoes WHERE expira_em < ? OR usada_em < ?', agoraMs, agoraMs - OCIOSA_MS);
  await aplicarRetencao(env.EPIGE_DB);
  return cookie(t, Math.floor(MAXIMA_MS / 1000));
}

/**
 * Lê a sessão da requisição. Devolve null quando não há sessão válida — quem
 * precisa de sessão chama `exigir`, que transforma isso em 401.
 */
export async function lerSessao(env, request) {
  const t = lerCookie(request);
  if (!t || t.length > 100) return null;
  const id = await sha256(t);
  const s = await um(
    env.EPIGE_DB,
    `SELECT s.id AS sessao_id, s.usada_em, s.expira_em,
            u.id, u.email, u.nome, u.papel, u.superadmin, u.ativo, u.termos_versao,
            (u.totp_segredo IS NOT NULL) AS totp_ativo,
            o.id AS org_id, o.nome AS org_nome, o.atividade, o.porte, o.nivel, o.situacao,
            o.teto_diario_brl, o.ativa AS org_ativa
       FROM sessoes s
       JOIN usuarios u ON u.id = s.usuario_id
       JOIN organizacoes o ON o.id = u.org_id
      WHERE s.id = ?`,
    id,
  );
  if (!s) return null;
  const agoraMs = agora();
  if (s.expira_em < agoraMs || s.usada_em < agoraMs - OCIOSA_MS || !s.ativo || !s.org_ativa) {
    await executar(env.EPIGE_DB, 'DELETE FROM sessoes WHERE id = ?', id);
    return null;
  }
  if (s.usada_em < agoraMs - RENOVAR_MS) {
    await executar(env.EPIGE_DB, 'UPDATE sessoes SET usada_em = ? WHERE id = ?', agoraMs, id);
  }
  return {
    sessaoId: s.sessao_id,
    usuario: {
      id: s.id,
      email: s.email,
      nome: s.nome,
      papel: s.papel,
      superadmin: !!s.superadmin,
      totp_ativo: !!s.totp_ativo,
      precisa_aceitar: s.termos_versao !== TERMOS_VERSAO,
    },
    org: {
      id: s.org_id,
      nome: s.org_nome,
      atividade: s.atividade,
      porte: s.porte,
      nivel: s.nivel,
      situacao: s.situacao,
      teto_diario_brl: s.teto_diario_brl,
    },
  };
}

export const encerrarSessao = (env, sessaoId) => executar(env.EPIGE_DB, 'DELETE FROM sessoes WHERE id = ?', sessaoId);

export const encerrarTodas = (env, usuarioId, exceto = '') =>
  executar(env.EPIGE_DB, 'DELETE FROM sessoes WHERE usuario_id = ? AND id != ?', usuarioId, exceto);

/**
 * Exige sessão e, opcionalmente, papel. A autorização é sempre feita aqui, no
 * servidor — esconder botão na tela é conveniência, não controle de acesso.
 */
export function exigir(ctx, { papeis = null, superadmin = false, semAceite = false } = {}) {
  const s = ctx.data.sessao;
  if (!s) throw new HttpErro(401, 'Sua sessão expirou. Entre novamente.');
  if (!semAceite && s.usuario.precisa_aceitar) {
    throw new HttpErro(403, 'Os termos de uso foram atualizados. Leia e aceite para continuar.', { precisa_aceitar: true });
  }
  if (superadmin && !s.usuario.superadmin) throw new HttpErro(403, 'Acesso restrito à administração da plataforma.');
  if (papeis && !papeis.includes(s.usuario.papel)) throw new HttpErro(403, 'O seu papel nesta empresa não permite esta ação.');
  return s;
}

/** Segredo obrigatório: sem ele a plataforma recusa tudo (falha fechada). */
export function segredo(env) {
  if (!env.SEGREDO || env.SEGREDO.length < 32) {
    throw new HttpErro(503, 'Servidor sem SEGREDO configurado (mínimo de 32 caracteres). Acesso bloqueado.');
  }
  return env.SEGREDO;
}

export const verificaVazamento = (env) => env.VERIFICAR_SENHA_VAZADA !== '0';
export const iteracoes = (env) => Math.min(100_000, Math.max(10_000, Number(env.PBKDF2_ITERACOES ?? 100_000) || 100_000));

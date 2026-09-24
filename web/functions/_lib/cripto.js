/**
 * Criptografia da plataforma — só WebCrypto, nada de biblioteca de terceiros.
 *
 * Senhas: PBKDF2-SHA256 com sal por usuário e "pimenta" (a variável SEGREDO,
 * que fica fora do banco). Quem vazar só o banco não consegue nem começar a
 * testar senhas, porque falta a pimenta. 100 mil iterações é o máximo que o
 * runtime da Cloudflare aceita; o número fica gravado no hash, então dá para
 * subir depois sem invalidar ninguém — o hash é refeito no próximo login.
 */

const te = new TextEncoder();

export const ITERACOES_PADRAO = 100_000;

export function b64url(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function deB64url(txt) {
  const s = atob(txt.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export const aleatorio = (n = 32) => crypto.getRandomValues(new Uint8Array(n));

/** Token para cookie, convite e redefinição: 256 bits de entropia. */
export const token = () => b64url(aleatorio(32));

export async function sha256(txt) {
  const h = await crypto.subtle.digest('SHA-256', te.encode(txt));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparação em tempo constante — evita medir a senha pelo tempo de resposta. */
export function iguais(a, b) {
  const x = te.encode(String(a));
  const y = te.encode(String(b));
  let dif = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) dif |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return dif === 0;
}

async function hmac(chave, dados, hash = 'SHA-256') {
  const k = await crypto.subtle.importKey('raw', chave, { name: 'HMAC', hash }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, dados));
}

async function derivar(senha, sal, iteracoes, segredo) {
  // A pimenta entra como HMAC antes do PBKDF2: sem ela, o hash do banco não serve.
  const temperada = await hmac(te.encode(segredo), te.encode(senha));
  const base = await crypto.subtle.importKey('raw', temperada, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteracoes },
    base,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashSenha(senha, segredo, iteracoes = ITERACOES_PADRAO) {
  const sal = aleatorio(16);
  const h = await derivar(senha, sal, iteracoes, segredo);
  return `pbkdf2$${iteracoes}$${b64url(sal)}$${b64url(h)}`;
}

/** Devolve { ok, refazer } — refazer quando o hash usa parâmetros antigos. */
export async function verificarSenha(senha, gravado, segredo, iteracoes = ITERACOES_PADRAO) {
  const [alg, it, sal, h] = String(gravado).split('$');
  if (alg !== 'pbkdf2' || !it || !sal || !h) return { ok: false, refazer: false };
  const calculado = await derivar(senha, deB64url(sal), Number(it), segredo);
  const ok = iguais(b64url(calculado), h);
  return { ok, refazer: ok && Number(it) !== iteracoes };
}

/**
 * Regras de senha. Tamanho mínimo de 10 e consulta à base de senhas vazadas —
 * as duas coisas que as recomendações atuais pedem. Regra de "uma maiúscula,
 * um símbolo" não entra: produz senha previsível e não ajuda.
 */
export async function validarSenha(senha, emailUsuario, verificarVazamento = true) {
  const s = String(senha ?? '');
  if (s.length < 10) return 'A senha precisa ter pelo menos 10 caracteres.';
  if (s.length > 128) return 'A senha pode ter no máximo 128 caracteres.';
  if (emailUsuario && s.toLowerCase().includes(emailUsuario.split('@')[0].toLowerCase()) && emailUsuario.split('@')[0].length >= 4) {
    return 'A senha não pode conter o seu e-mail.';
  }
  if (verificarVazamento && (await senhaVazada(s))) {
    return 'Esta senha aparece em vazamentos públicos de dados. Escolha outra.';
  }
  return null;
}

/**
 * Consulta por anonimato-k: só os 5 primeiros caracteres do SHA-1 saem daqui,
 * a senha nunca. Se o serviço não responder, a senha é aceita — disponibilidade
 * do cadastro vale mais que esta verificação adicional.
 */
async function senhaVazada(senha) {
  try {
    const h = await crypto.subtle.digest('SHA-1', te.encode(senha));
    const hex = [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1500);
    const r = await fetch(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`, {
      headers: { 'add-padding': 'true' },
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return false;
    const resto = hex.slice(5);
    return (await r.text()).split('\n').some((l) => {
      const [suf, n] = l.trim().split(':');
      return suf === resto && Number(n) > 0;
    });
  } catch {
    return false;
  }
}

/* ---------- segredos cifrados (chave do 2FA) ---------- */

async function chaveCifra(segredo) {
  const bruta = await crypto.subtle.digest('SHA-256', te.encode(`epige:cifra:${segredo}`));
  return crypto.subtle.importKey('raw', bruta, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function cifrar(txt, segredo) {
  const iv = aleatorio(12);
  const c = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await chaveCifra(segredo), te.encode(txt));
  return `${b64url(iv)}.${b64url(c)}`;
}

export async function decifrar(pacote, segredo) {
  const [iv, c] = String(pacote).split('.');
  const p = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64url(iv) }, await chaveCifra(segredo), deB64url(c));
  return new TextDecoder().decode(p);
}

/* ---------- TOTP (RFC 6238), para o aplicativo autenticador ---------- */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32(bytes) {
  let bits = 0;
  let valor = 0;
  let saida = '';
  for (const b of bytes) {
    valor = (valor << 8) | b;
    bits += 8;
    while (bits >= 5) {
      saida += B32[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) saida += B32[(valor << (5 - bits)) & 31];
  return saida;
}

function deBase32(txt) {
  const limpo = txt.replace(/=+$/, '').toUpperCase().replace(/\s/g, '');
  let bits = 0;
  let valor = 0;
  const out = [];
  for (const c of limpo) {
    const i = B32.indexOf(c);
    if (i < 0) continue;
    valor = (valor << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

async function codigoTotp(segredoB32, passo) {
  const msg = new Uint8Array(8);
  let p = passo;
  for (let i = 7; i >= 0; i--) {
    msg[i] = p & 255;
    p = Math.floor(p / 256);
  }
  const h = await hmac(deBase32(segredoB32), msg, 'SHA-1');
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}

/**
 * Confere o código com tolerância de um passo (30 s) para cada lado. Devolve o
 * passo usado, para que o mesmo código não possa ser reaproveitado.
 */
export async function conferirTotp(segredoB32, codigo, ultimoPasso = 0, agora = Date.now()) {
  const c = String(codigo ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return null;
  const atual = Math.floor(agora / 30000);
  for (const d of [0, -1, 1]) {
    const passo = atual + d;
    if (passo <= ultimoPasso) continue;
    if (iguais(await codigoTotp(segredoB32, passo), c)) return passo;
  }
  return null;
}

export { codigoTotp as _codigoTotpParaTeste };

'use strict';
/**
 * EPIGE — aplicação da plataforma.
 *
 * Arquivo único, sem framework e sem dependência. Nenhum manipulador de evento
 * inline: os elementos declaram `data-acao`, `data-form` ou `data-muda`, e três
 * ouvintes no documento despacham. É o que permite a política de segurança da
 * página proibir script inline — HTML injetado não executa nada.
 *
 * Todo texto vindo de fora (servidor, IA, usuário) passa por `esc()` antes de
 * virar HTML. Autorização é do servidor; aqui só se esconde o que o papel não usa.
 */

/* ============================================================ estado */

const S = {
  usuario: null, org: null, normas: {}, agentes: {}, iaConfigurada: false,
  norma: 'iso-9001', adicionais: [], tela: null,
  custo: 0, chamadas: [], historico: {}, ultima: null, prefill: null,
  docs: [], tipos: {}, doc: null, precisaCodigo: false,
  tokenConvite: null, tokenRedefinir: null, primeiroDisponivel: false,
};

/* ============================================================ utilidades */

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (v, d = 2) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const cls = (v) => String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9_]/g, '');
const dataHora = (ms) => (ms ? new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const data = (ms) => (ms ? new Date(ms).toLocaleDateString('pt-BR') : '—');
const campos = (f) => Object.fromEntries(new FormData(f));
const MAX_ADICIONAIS = 3;

function md(t) {
  let h = esc(t);
  h = h.replace(/^#{3,6}\s+(.+)$/gm, '<h4>$1</h4>').replace(/^#{1,2}\s+(.+)$/gm, '<h3>$1</h3>');
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/^\s*[-•*]\s+(.+)$/gm, '<li>$1</li>').replace(/^\s*\d+[.)]\s+(.+)$/gm, '<li>$1</li>');
  h = h.replace(/(<li>[\s\S]*?<\/li>)/g, (m) => '<ul>' + m + '</ul>').replace(/<\/ul>\s*<ul>/g, '');
  return h.split(/\n{2,}/).map((b) => {
    b = b.trim();
    if (!b) return '';
    return /^<(h3|h4|ul)/.test(b) ? b : '<p>' + b.replace(/\n/g, '<br>') + '</p>';
  }).join('');
}

function extrairJSON(t) {
  const limpo = String(t).replace(/```json|```/g, '').trim();
  const i = limpo.indexOf('{');
  const f = limpo.lastIndexOf('}');
  if (i < 0 || f < 0) throw new Error('O agente não devolveu dados estruturados.');
  return JSON.parse(limpo.slice(i, f + 1));
}

/** Chamada à API. 401 fora das rotas de login significa sessão vencida. */
async function api(metodo, caminho, corpo) {
  const op = { method: metodo, headers: {}, credentials: 'same-origin' };
  if (corpo !== undefined) {
    op.headers['content-type'] = 'application/json';
    op.body = JSON.stringify(corpo);
  }
  let r;
  try {
    r = await fetch(caminho, op);
  } catch {
    throw new Error('Sem conexão com o servidor.');
  }
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && S.usuario && !caminho.startsWith('/api/auth/entrar')) {
    sessaoExpirou();
  }
  if (!r.ok) {
    const e = new Error(d.erro || 'O servidor respondeu com erro ' + r.status + '.');
    e.status = r.status;
    e.dados = d;
    throw e;
  }
  return d;
}

const pensando = (box, msg) => (box.innerHTML = '<div class="thinking"><span class="pulse"></span><span class="pulse"></span><span class="pulse"></span> ' + esc(msg) + '</div>');
const erroBox = (box, e) => (box.innerHTML = '<div class="alert alert-err"><b>Não foi possível concluir.</b><br>' + esc(e.message || e) + '</div>');
const okBox = (box, msg) => (box.innerHTML = '<div class="alert alert-info">' + msg + '</div>');

function ocupado(el, sim) {
  if (!el) return;
  el.disabled = sim;
  if (sim) { el.dataset.rotulo = el.textContent; el.textContent = 'Aguarde…'; }
  else if (el.dataset.rotulo) el.textContent = el.dataset.rotulo;
}

function baixar(nome, conteudo, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const caixaLink = (link, rotulo) =>
  '<div class="note">' + esc(rotulo) + '</div><div class="link-box"><span>' + esc(link) + '</span>'
  + '<button class="btn btn-ghost btn-sm" data-acao="copiar" data-texto="' + esc(link) + '">Copiar</button></div>';

/* ============================================================ despacho de eventos */

const ACOES = {};
const FORMS = {};
const MUDA = {};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-acao]');
  if (!el || el.disabled || !Object.hasOwn(ACOES, el.dataset.acao)) return;
  e.preventDefault();
  ACOES[el.dataset.acao](el, e);
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  if (Object.hasOwn(FORMS, f.dataset.form)) FORMS[f.dataset.form](f);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-muda]');
  if (el && Object.hasOwn(MUDA, el.dataset.muda)) MUDA[el.dataset.muda](el);
});
document.addEventListener('input', (e) => {
  if (e.target.closest('[data-filtro]')) desenharListaDocs();
});
document.addEventListener('keydown', (e) => {
  const t = e.target;
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && t.matches('textarea[data-enviar]') && Object.hasOwn(ACOES, t.dataset.enviar)) {
    e.preventDefault();
    ACOES[t.dataset.enviar](t);
  }
});

ACOES.copiar = async (el) => {
  try {
    await navigator.clipboard.writeText(el.dataset.texto);
    el.textContent = 'Copiado';
  } catch {
    el.textContent = 'Selecione e copie';
  }
};

/* ============================================================ acesso */

const campo = (nome, rotulo, tipo = 'text', extra = '') =>
  '<div class="field"><label for="f_' + nome + '">' + esc(rotulo) + '</label><input type="' + tipo + '" id="f_' + nome + '" name="' + nome + '" ' + extra + '></div>';

function telaAcesso(modo, aviso = '') {
  S.usuario = null;
  $('shell').classList.add('hidden');
  $('normas').classList.add('hidden');
  $('userChip').classList.add('hidden');
  $('acesso').classList.remove('hidden');
  $('dot').className = 'dot';
  $('statusTxt').textContent = 'acesso';

  const avisoHtml = aviso ? '<div class="alert alert-info">' + esc(aviso) + '</div>' : '';
  const erro = '<p class="msg-erro" id="msgAcesso" role="alert"></p>';
  const senha = (nome, rotulo, auto) => campo(nome, rotulo, 'password', 'autocomplete="' + auto + '" required minlength="' + (auto === 'current-password' ? 1 : 10) + '" maxlength="128"');
  let h = '';

  if (modo === 'entrar') {
    h = '<h2>Entrar</h2><p class="lede">Plataforma de gestão da qualidade, ambiente, segurança e conformidade.</p>' + avisoHtml
      + '<form data-form="entrar" class="panel">'
      + campo('email', 'E-mail', 'email', 'autocomplete="username" required maxlength="254"')
      + senha('senha', 'Senha', 'current-password')
      + (S.precisaCodigo ? campo('codigo', 'Código do aplicativo autenticador', 'text', 'inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,7}" required') : '')
      + '<button class="btn btn-primary" type="submit">Entrar</button>' + erro + '</form>'
      + '<div class="auth-links">'
      + '<button class="linkish" data-acao="modoAcesso" data-modo="esqueci">Esqueci a senha</button>'
      + '<button class="linkish" data-acao="modoAcesso" data-modo="solicitar">Ainda não tenho acesso — solicitar</button>'
      + (S.primeiroDisponivel ? '<button class="linkish" data-acao="modoAcesso" data-modo="primeiro">Primeiro acesso à plataforma</button>' : '')
      + '</div>';
  } else if (modo === 'esqueci') {
    h = '<h2>Esqueci a senha</h2>'
      + '<div class="panel"><p>A senha é redefinida por um link que o <b>administrador da sua empresa</b> gera em <b>Equipe → Link de nova senha</b>. O link vale 24 horas e só pode ser usado uma vez.</p>'
      + '<p class="note">Se você é o único administrador e perdeu o acesso, fale com o suporte da EPIGE.</p></div>'
      + '<div class="auth-links"><button class="linkish" data-acao="modoAcesso" data-modo="entrar">Voltar para entrar</button></div>';
  } else if (modo === 'solicitar') {
    h = '<h2>Solicitar acesso</h2><p class="lede">Deixe seus dados. A equipe da EPIGE libera o acesso da sua empresa e envia o convite.</p>'
      + '<form data-form="solicitar" class="panel">'
      + campo('nome', 'Seu nome', 'text', 'required maxlength="120" autocomplete="name"')
      + campo('email', 'E-mail', 'email', 'required maxlength="254" autocomplete="email"')
      + campo('empresa', 'Empresa', 'text', 'required maxlength="120" autocomplete="organization"')
      + campo('telefone', 'Telefone (opcional)', 'text', 'maxlength="40" autocomplete="tel"')
      + '<div class="field"><label for="f_mensagem">O que você precisa? (opcional)</label><textarea id="f_mensagem" name="mensagem" maxlength="1000"></textarea></div>'
      + '<div class="hp" aria-hidden="true"><label>Site<input type="text" name="site" tabindex="-1" autocomplete="off"></label></div>'
      + '<button class="btn btn-primary" type="submit">Enviar solicitação</button>' + erro + '</form>'
      + '<div class="auth-links"><button class="linkish" data-acao="modoAcesso" data-modo="entrar">Já tenho acesso — entrar</button></div>';
  } else if (modo === 'primeiro') {
    h = '<h2>Primeiro acesso</h2><p class="lede">Cria a conta de administração da plataforma. Só funciona uma vez, com o código de acesso configurado no servidor.</p>'
      + '<form data-form="primeiro" class="panel">'
      + campo('codigo', 'Código de acesso do servidor', 'password', 'required autocomplete="off"')
      + campo('empresa', 'Sua empresa', 'text', 'required maxlength="120"')
      + campo('nome', 'Seu nome', 'text', 'required maxlength="120" autocomplete="name"')
      + campo('email', 'E-mail', 'email', 'required maxlength="254" autocomplete="username"')
      + senha('senha', 'Senha (mínimo de 10 caracteres)', 'new-password') + senha('senha2', 'Repita a senha', 'new-password')
      + '<button class="btn btn-primary" type="submit">Criar conta</button>' + erro + '</form>'
      + '<div class="auth-links"><button class="linkish" data-acao="modoAcesso" data-modo="entrar">Voltar para entrar</button></div>';
  } else if (modo === 'convite') {
    h = '<h2>Convite</h2><div id="conviteInfo"><div class="thinking"><span class="pulse"></span> conferindo o convite</div></div>';
    carregarConvite();
  } else if (modo === 'redefinir') {
    h = '<h2>Nova senha</h2><p class="lede">Escolha uma senha de pelo menos 10 caracteres. Frases longas são mais seguras e mais fáceis de lembrar.</p>'
      + '<form data-form="redefinir" class="panel">' + senha('nova', 'Nova senha', 'new-password') + senha('nova2', 'Repita a nova senha', 'new-password')
      + '<button class="btn btn-primary" type="submit">Salvar nova senha</button>' + erro + '</form>';
  }
  $('acesso').innerHTML = '<div class="auth">' + h + '</div>';
  const primeiro = $('acesso').querySelector('input:not([type=hidden]):not([tabindex="-1"])');
  if (primeiro) primeiro.focus();
}

ACOES.modoAcesso = (el) => { S.precisaCodigo = false; telaAcesso(el.dataset.modo); };

const msgAcesso = (t) => { const m = $('msgAcesso'); if (m) m.textContent = t; };

async function enviarAcesso(f, fn) {
  const btn = f.querySelector('button[type=submit]');
  ocupado(btn, true);
  msgAcesso('');
  try { await fn(campos(f)); } catch (e) { msgAcesso(e.message); }
  ocupado(btn, false);
}

FORMS.entrar = (f) => enviarAcesso(f, async (c) => {
  try {
    await api('POST', '/api/auth/entrar', c);
  } catch (e) {
    if (e.dados && e.dados.precisa_codigo && !S.precisaCodigo) {
      S.precisaCodigo = true;
      telaAcesso('entrar');
      $('f_email').value = c.email;
      $('f_senha').value = c.senha;
      $('f_codigo').focus();
      return;
    }
    throw e;
  }
  S.precisaCodigo = false;
  await entrarNaApp();
});

FORMS.solicitar = (f) => enviarAcesso(f, async (c) => {
  await api('POST', '/api/auth/solicitar', c);
  $('acesso').innerHTML = '<div class="auth"><h2>Solicitação enviada</h2><div class="panel"><p>Obrigado. A equipe da EPIGE vai analisar e enviar o convite para <b>' + esc(c.email) + '</b>.</p></div>'
    + '<div class="auth-links"><button class="linkish" data-acao="modoAcesso" data-modo="entrar">Voltar para entrar</button></div></div>';
});

FORMS.primeiro = (f) => enviarAcesso(f, async (c) => {
  if (c.senha !== c.senha2) throw new Error('As duas senhas não conferem.');
  delete c.senha2;
  await api('POST', '/api/auth/primeiro-acesso', c);
  await entrarNaApp();
});

async function carregarConvite() {
  try {
    const d = await api('POST', '/api/auth/convite', { token: S.tokenConvite });
    const papel = { admin: 'administrador', editor: 'editor', leitor: 'leitor' }[d.papel] || d.papel;
    $('conviteInfo').innerHTML = '<p class="lede">Você foi convidado para a <b>' + esc(d.empresa) + '</b> como <b>' + esc(papel) + '</b>.</p>'
      + '<form data-form="cadastro" class="panel">'
      + '<div class="field"><label>E-mail</label><input type="email" value="' + esc(d.email) + '" disabled></div>'
      + campo('nome', 'Seu nome', 'text', 'required maxlength="120" autocomplete="name"')
      + campo('senha', 'Senha (mínimo de 10 caracteres)', 'password', 'required minlength="10" maxlength="128" autocomplete="new-password"')
      + campo('senha2', 'Repita a senha', 'password', 'required minlength="10" maxlength="128" autocomplete="new-password"')
      + '<button class="btn btn-primary" type="submit">Criar meu acesso</button><p class="msg-erro" id="msgAcesso" role="alert"></p></form>';
  } catch (e) {
    $('conviteInfo').innerHTML = '<div class="alert alert-err">' + esc(e.message) + '</div>'
      + '<div class="auth-links"><button class="linkish" data-acao="modoAcesso" data-modo="entrar">Ir para entrar</button></div>';
  }
}

FORMS.cadastro = (f) => enviarAcesso(f, async (c) => {
  if (c.senha !== c.senha2) throw new Error('As duas senhas não conferem.');
  await api('POST', '/api/auth/cadastro', { token: S.tokenConvite, nome: c.nome, senha: c.senha });
  S.tokenConvite = null;
  await entrarNaApp();
});

FORMS.redefinir = (f) => enviarAcesso(f, async (c) => {
  if (c.nova !== c.nova2) throw new Error('As duas senhas não conferem.');
  await api('POST', '/api/auth/redefinir', { token: S.tokenRedefinir, nova: c.nova });
  S.tokenRedefinir = null;
  telaAcesso('entrar', 'Senha redefinida. Entre com a senha nova.');
});

ACOES.sair = async () => {
  try { await api('POST', '/api/auth/sair', {}); } catch {}
  S.historico = {};
  S.custo = 0;
  S.chamadas = [];
  telaAcesso('entrar', 'Você saiu da plataforma.');
};

function sessaoExpirou() {
  if (!S.usuario) return;
  telaAcesso('entrar', 'Sua sessão expirou. Entre novamente.');
}

/* ============================================================ entrada na aplicação */

async function entrarNaApp() {
  const eu = await api('GET', '/api/auth/eu');
  S.usuario = eu.usuario;
  S.org = eu.organizacao;
  const cat = await api('GET', '/api/chat');
  S.agentes = cat.agentes || {};
  S.normas = cat.normas || {};
  S.iaConfigurada = cat.ia_configurada;

  // Volta para a demonstração, se foi de lá que a pessoa veio. Só esse destino.
  if (new URLSearchParams(location.search).get('volta') === '/demo/') {
    location.href = '/demo/';
    return;
  }

  $('acesso').classList.add('hidden');
  $('acesso').innerHTML = '';
  $('shell').classList.remove('hidden');
  $('userChip').classList.remove('hidden');
  $('userNome').innerHTML = '<b>' + esc(S.usuario.nome) + '</b> · ' + esc(S.org.nome);
  const usaIA = podeIA();
  $('normas').classList.toggle('hidden', !usaIA);
  $('meter').classList.toggle('hidden', !usaIA);
  $('dot').className = 'dot ' + (!usaIA ? 'live' : S.iaConfigurada ? 'live' : 'down');
  $('statusTxt').textContent = !usaIA ? 'conectado' : S.iaConfigurada ? 'IA ao vivo' : 'IA não configurada';
  montarNormas();
  resumoEmpresa();
  abrir(!usaIA ? 'documentos' : S.org.atividade ? 'diagnostico' : 'empresa');
}

const podeIA = () => S.usuario && S.usuario.papel !== 'leitor';
const ehAdmin = () => S.usuario && S.usuario.papel === 'admin';

function resumoEmpresa() {
  const o = S.org;
  $('ctxResumo').innerHTML = '<b>' + esc(o.nome) + '</b><br>' + esc(o.atividade || 'Atividade não informada') + (o.porte ? '<br>' + esc(o.porte) : '')
    + (podeIA() && !o.atividade ? '<br><button class="linkish" data-acao="abrir" data-id="empresa">Completar o contexto</button>' : '');
}

/* ============================================================ navegação */

const FERRAMENTAS = [
  { id: 'diagnostico', grupo: 'Começar', n: '01', t: 'Diagnóstico inicial', d: 'Onde você está e o primeiro passo', agente: 'diagnostico' },
  { id: 'consultor', grupo: 'Entender', n: '02', t: 'Consultor', d: 'Dúvida sobre requisito', agente: 'consultor', chat: true },
  { id: 'legal', grupo: 'Entender', n: '03', t: 'Legal e regulatório', d: 'Requisitos legais aplicáveis', agente: 'legal' },
  { id: 'lacuna', grupo: 'Entender', n: '04', t: 'Lacuna entre edições', d: 'O que muda na transição', agente: 'lacuna' },
  { id: 'sgi', grupo: 'Entender', n: '05', t: 'Integração de normas', d: 'O que unificar e o que separar', agente: 'sgi' },
  { id: 'redator', grupo: 'Executar', n: '06', t: 'Redigir documento', d: 'Procedimento, política, instrução', agente: 'redator', doc: true, tipo: 'procedimento' },
  { id: 'formulario', grupo: 'Executar', n: '07', t: 'Criar formulário', d: 'O registro que sustenta evidência', agente: 'formulario', doc: true, tipo: 'formulario' },
  { id: 'causa', grupo: 'Executar', n: '08', t: 'Análise de causa', d: 'Chegar à causa real, não à aparente', agente: 'causa', chat: true },
  { id: 'plano', grupo: 'Executar', n: '09', t: 'Plano de ação', d: 'Lacunas viram ações com prazo', agente: 'plano', doc: true, tipo: 'plano' },
  { id: 'analista', grupo: 'Verificar', n: '10', t: 'Analisar documento', d: 'Confronta o seu documento com a norma', agente: 'analista', doc: true },
  { id: 'auditor', grupo: 'Verificar', n: '11', t: 'Auditoria simulada', d: 'Uma norma ou combinada, em Opus', agente: 'auditor', doc: true, tipo: 'relatorio' },
  { id: 'vigilancia', grupo: 'Acompanhar', n: '12', t: 'Vigilância normativa', d: 'Revisões e novidades, com busca', agente: 'vigilancia' },
];

const GESTAO = [
  { id: 'documentos', i: '▤', t: 'Documentos', d: 'Elaboração, aprovação e versões' },
  { id: 'empresa', i: '◧', t: 'Empresa', d: 'O contexto que os agentes usam', papeis: ['admin', 'editor'] },
  { id: 'equipe', i: '◎', t: 'Equipe', d: 'Convites, papéis e acessos', papeis: ['admin'] },
  { id: 'uso', i: 'R$', t: 'Uso de IA', d: 'Gasto de hoje e do mês', papeis: ['admin', 'editor'] },
  { id: 'eventos', i: '≡', t: 'Log de auditoria', d: 'Quem fez o quê, e quando', papeis: ['admin'] },
  { id: 'conta', i: '◌', t: 'Minha conta', d: 'Senha, 2FA e sessões' },
  { id: 'plataforma', i: '⚙', t: 'Plataforma', d: 'Empresas e solicitações', superadmin: true },
];

const visivel = (g) => (!g.papeis || g.papeis.includes(S.usuario.papel)) && (!g.superadmin || S.usuario.superadmin);

function montarRail() {
  const botao = (id, n, t, d) =>
    '<button class="tool' + (S.tela === id || (id === 'documentos' && S.tela === 'doc') ? ' on' : '') + '" data-acao="abrir" data-id="' + id + '">'
    + '<span class="tool-i">' + esc(n) + '</span><span><span class="tool-t">' + esc(t) + '</span><span class="tool-d">' + esc(d) + '</span></span></button>';
  let h = '';
  if (podeIA()) {
    for (const g of [...new Set(FERRAMENTAS.map((f) => f.grupo))]) {
      h += '<div class="grupo"><div class="rail-title">' + esc(g) + '</div>'
        + FERRAMENTAS.filter((f) => f.grupo === g).map((f) => botao(f.id, f.n, f.t, f.d)).join('') + '</div>';
    }
  }
  h += '<div class="grupo"><div class="rail-title">Gestão</div>'
    + GESTAO.filter(visivel).map((g) => botao(g.id, g.i, g.t, g.d)).join('') + '</div>';
  $('rail').innerHTML = h;
}

const TELAS = {};

ACOES.abrir = (el) => abrir(el.dataset.id);

function abrir(id) {
  S.tela = id;
  montarRail();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const f = FERRAMENTAS.find((x) => x.id === id);
  if (f) {
    if (!podeIA()) return abrir('documentos');
    if (f.chat) return telaChat(f);
    if (f.doc) return telaEntrada(f);
    return telaSimples(f);
  }
  const g = GESTAO.find((x) => x.id === id);
  if (g && visivel(g) && TELAS[id]) return TELAS[id]();
  return abrir('documentos');
}

const cabecalho = (eyebrow, titulo, lede) =>
  '<div class="eyebrow" id="eyebrow">' + esc(eyebrow) + '</div><h2>' + esc(titulo) + '</h2>' + (lede ? '<p class="lede">' + esc(lede) + '</p>' : '');

/* ============================================================ normas */

function montarNormas() {
  $('normas').innerHTML = Object.entries(S.normas).map(([k, v]) =>
    '<option value="' + esc(k) + '"' + (S.norma === k ? ' selected' : '') + '>' + esc(v.rotulo) + ' · ' + esc(v.tema || '') + '</option>').join('');
}

const combina = (f) => !!(f && f.agente && (S.agentes[f.agente] || {}).combinada);
const normasDaTela = (f) => [S.norma, ...(combina(f) ? S.adicionais : [])].filter((k) => S.normas[k]);
const rotuloNormas = (f) => normasDaTela(f).map((k) => S.normas[k].rotulo).join(' + ');

function avisoConfianca(f) {
  const ids = normasDaTela(f);
  const medias = ids.filter((k) => S.normas[k].confianca !== 'alta');
  let h = '';
  if (medias.length) {
    h += '<div class="aviso-conf"><b>Conteúdo não conferido contra exemplar'
      + (ids.length > 1 ? ' para: ' + esc(medias.map((k) => S.normas[k].rotulo).join(', ')) + '.' : ' da norma.') + '</b> '
      + 'A edição foi apurada em fonte secundária e os mecanismos vêm do conhecimento do modelo. '
      + 'O agente vai evitar precisar número de cláusula — confira no texto antes de usar em auditoria.</div>';
  }
  if (f && f.id === 'auditor' && ids.some((k) => S.normas[k].maturidade)) {
    h += '<div class="alert alert-info"><b>A ABNT PR 2030 não é certificável.</b> Para ela, o auditor avalia estágio de maturidade — não conformidade.</div>';
  }
  if (!S.iaConfigurada) {
    h += '<div class="alert alert-warn"><b>A IA ainda não está configurada no servidor.</b> Falta a chave de API — as ferramentas vão responder com erro até lá.</div>';
  }
  return h;
}

function seletorCombinado(f) {
  if (!combina(f)) return '';
  const cheio = S.adicionais.length >= MAX_ADICIONAIS;
  const titulo = f.id === 'auditor'
    ? 'Auditoria combinada — até ' + MAX_ADICIONAIS + ' referenciais além de ' + S.normas[S.norma].rotulo
    : 'Integrar ' + S.normas[S.norma].rotulo + ' com';
  return '<div class="combo"><div class="combo-t">' + esc(titulo) + '</div><div class="suggest" style="margin:0">'
    + Object.entries(S.normas).filter(([k]) => k !== S.norma).map(([k, v]) => {
      const on = S.adicionais.includes(k);
      return '<button type="button" class="chip' + (on ? ' on' : '') + '" aria-pressed="' + on + '"' + (!on && cheio ? ' disabled' : '')
        + ' data-acao="alternarAdicional" data-k="' + esc(k) + '">' + esc(v.rotulo) + '</button>';
    }).join('') + '</div></div>';
}

ACOES.alternarAdicional = (el) => {
  const k = el.dataset.k;
  const i = S.adicionais.indexOf(k);
  if (i >= 0) S.adicionais.splice(i, 1);
  else if (S.adicionais.length < MAX_ADICIONAIS) S.adicionais.push(k);
  const f = FERRAMENTAS.find((x) => x.id === S.tela);
  $('combo').innerHTML = seletorCombinado(f);
  $('avisoBox').innerHTML = avisoConfianca(f);
  $('eyebrow').textContent = 'Passo ' + f.n + ' · ' + rotuloNormas(f);
};

MUDA.trocarNorma = (el) => {
  if (el.value === S.norma) return;
  S.norma = el.value;
  S.adicionais = S.adicionais.filter((x) => x !== S.norma);
  S.historico = {}; // conversa de uma norma não vale para outra
  if (FERRAMENTAS.some((f) => f.id === S.tela)) abrir(S.tela);
};

/* ============================================================ IA */

async function chamar(agente, mensagens, rotulo) {
  const d = await api('POST', '/api/chat', {
    agente, norma: S.norma, mensagens,
    adicionais: (S.agentes[agente] || {}).combinada ? S.adicionais : undefined,
  });
  S.custo += d.custo || 0;
  S.chamadas.push({ rotulo, custo: d.custo || 0 });
  $('mCusto').textContent = brl(S.custo, 4);
  $('ledger').innerHTML = S.chamadas.slice(-8).map((x) => '<div class="ledger-row"><span>' + esc(x.rotulo) + '</span><b>R$ ' + brl(x.custo, 4) + '</b></div>').join('');
  if (d.teto_empresa) {
    $('meterSub').textContent = 'Empresa hoje: R$ ' + brl(d.gasto_empresa_hoje) + ' de R$ ' + brl(d.teto_empresa) + ' do teto diário. Custo medido nos tokens da resposta, às tarifas de produção.';
  }
  if (d.truncado) d.aviso = 'A resposta foi cortada no limite de tokens. Peça em partes menores.';
  return d;
}

const listaSimples = (arr, t) => !arr || !arr.length ? '' :
  '<div class="card"><div class="card-t">' + esc(t) + '</div><ul class="plain">' + arr.map((x) => '<li>' + esc(typeof x === 'string' ? x : JSON.stringify(x)) + '</li>').join('') + '</ul></div>';

const achado = (grau, titulo, corpo, evid) =>
  '<div class="finding ' + cls(grau) + '"><div class="f-top"><span class="tag ' + cls(grau) + '">' + esc(grau) + '</span>'
  + (titulo ? '<span class="f-req">' + esc(titulo) + '</span>' : '') + '</div><div>' + esc(corpo) + '</div>'
  + (evid ? '<div class="f-ev">' + esc(evid) + '</div>' : '') + '</div>';

function achadoMaturidade(f) {
  const n = Math.min(5, Math.max(1, parseInt(f.nivel, 10) || 1));
  return '<div class="finding mat' + n + '"><div class="f-top"><span class="tag mat' + n + '">' + esc(f.estagio || 'estágio ' + n) + '</span>'
    + '<span class="f-req">' + esc(f.requisito || '—') + '</span></div><div>' + esc(f.constatacao) + '</div>'
    + '<div class="f-ev">Evidência: ' + esc(f.evidencia || '—') + '</div></div>';
}

const RENDER = {
  diagnostico: (a) => '<div class="alert alert-info"><b>Maturidade: ' + esc(a.maturidade) + '.</b> ' + esc(a.veredito) + '</div>'
    + (a.lacunas || []).map((l) => achado(l.gravidade, 'cláusula ' + (l.clausula || '—') + ' · ' + (l.tema || ''), l.por_que_importa)).join('')
    + listaSimples(a.pontos_fortes, 'O que já dá para aproveitar')
    + '<div class="card"><div class="card-t">Primeiro passo</div><div>' + esc(a.primeiro_passo) + '</div></div>'
    + '<div class="note">Prazo realista até estar auditável: <b>' + esc(a.prazo_realista) + '</b></div>',
  analista: (a) => '<div class="alert alert-info"><b>Veredito.</b> ' + esc(a.veredito) + '</div>'
    + (a.cobertura || []).map((c) => achado(c.situacao, 'requisito ' + (c.requisito || '—'), c.observacao, c.trecho ? 'Base: ' + c.trecho : '')).join('')
    + (a.inconsistencias || []).map((i) => achado('media', i.onde, i.problema)).join('')
    + '<div class="card"><div class="card-t">Executável neste porte?</div><div>' + esc(a.executabilidade) + '</div></div>'
    + listaSimples(a.prioridade, 'Corrigir nesta ordem'),
  auditor: (a) => '<div class="doc-head"><div><h3 style="margin:0">' + (a.natureza === 'avaliacao_de_maturidade' ? 'Avaliação de maturidade ESG' : 'Relatório de auditoria interna') + '</h3>'
    + '<div class="doc-code">' + esc(a.escopo || '') + '</div></div></div>'
    + (a.achados || []).map((f) => f.classificacao === 'maturidade' ? achadoMaturidade(f)
      : achado(f.classificacao, 'requisito ' + (f.requisito || '—'), f.constatacao, 'Evidência: ' + (f.evidencia || '—'))).join('')
    + '<div class="card"><div class="card-t">Conclusão do auditor</div><div>' + esc(a.conclusao) + '</div></div>'
    + (a.recomendacao_de_prazo ? '<div class="note">Prazo recomendado: ' + esc(a.recomendacao_de_prazo) + '</div>' : ''),
  plano: (a) => '<div class="alert alert-info"><b>Estratégia.</b> ' + esc(a.estrategia) + '</div>'
    + (a.acoes || []).map((x) => achado(x.esforco, (x.tipo === 'correcao' ? 'correção' : 'ação corretiva') + ' · ' + (x.responsavel || '—') + ' · ' + (x.prazo || '—'),
      x.o_que, 'Verificação: ' + (x.verificacao || '—') + ' · Gera: ' + (x.evidencia_gerada || '—'))).join('')
    + listaSimples(a.dependencias, 'Dependências')
    + '<div class="alert alert-warn"><b>Risco do plano.</b> ' + esc(a.risco_do_plano) + '</div>',
  legal: (a) => '<div class="alert alert-info"><b>Abordagem.</b> ' + esc(a.abordagem) + '</div>'
    + (a.areas || []).map((x) => achado(x.esfera === 'todas' ? 'alta' : 'media', x.area, x.por_que_se_aplica, 'Verificar em: ' + (x.onde_verificar || '—') + ' · Esfera: ' + (x.esfera || '—'))).join('')
    + '<div class="card"><div class="card-t">Periodicidade sugerida</div><div>' + esc(a.periodicidade_sugerida) + '</div></div>'
    + '<div class="card"><div class="card-t">Evidência de avaliação</div><div>' + esc(a.evidencia) + '</div></div>'
    + '<div class="alert alert-warn"><b>Atenção.</b> ' + esc(a.alerta) + '</div>'
    + '<div class="note">Este agente estrutura o levantamento. Não substitui assessoria jurídica.</div>',
  lacuna: (a) => '<div class="alert alert-info"><b>Veredito.</b> ' + esc(a.veredito) + '</div>'
    + (a.lacunas || []).map((l) => achado(l.esforco, 'cláusula ' + (l.clausula || '—') + ' · ' + (l.tema || ''),
      'Hoje: ' + (l.situacao_provavel || '—') + ' → Passa a pedir: ' + (l.o_que_muda || '—'), 'Evidência sugerida: ' + (l.evidencia_sugerida || '—'))).join('')
    + listaSimples(a.nao_muda, 'O que NÃO muda') + listaSimples(a.sequencia, 'Por onde começar')
    + '<div class="alert alert-warn"><b>Alerta.</b> ' + esc(a.alerta) + '</div>',
  sgi: (a) => '<div class="alert alert-info"><b>Veredito.</b> ' + esc(a.veredito) + '</div>'
    + (a.unificar || []).map((x) => achado(x.ganho, x.tema + ' · ' + (x.clausulas || ''), x.como)).join('')
    + (a.separar || []).map((x) => achado('alta', 'não unificar · ' + x.tema, x.motivo)).join('')
    + listaSimples(a.sequencia, 'Sequência recomendada')
    + '<div class="card"><div class="card-t">Impacto das edições</div><div>' + esc(a.impacto_das_edicoes) + '</div></div>'
    + '<div class="alert alert-warn"><b>Erro mais comum.</b> ' + esc(a.alerta) + '</div>',
  vigilancia: (a) => (a.novidades || []).map((n) => achado(n.impacto, n.titulo, n.resumo, 'Fonte: ' + (n.fonte || '—') + ' · ' + (n.quando || '—') + ' · ' + (n.confianca || '—'))).join('')
    + '<div class="card"><div class="card-t">Situação da revisão</div><div>' + esc(a.revisao && a.revisao.situacao) + '</div>'
    + '<div class="note">Estágio: ' + esc(a.revisao && a.revisao.estagio) + ' · Expectativa: ' + esc(a.revisao && a.revisao.expectativa) + '</div></div>'
    + '<div class="alert alert-info"><b>O que fazer agora.</b> ' + esc(a.acao) + '</div>' + listaSimples(a.nao_encontrado, 'Não foi possível confirmar'),
  formulario: (a) => {
    const ctrl = (c) => c.tipo === 'area' ? '<textarea placeholder="—" disabled></textarea>'
      : c.tipo === 'selecao' ? '<select disabled>' + (c.opcoes || []).map((o) => '<option>' + esc(o) + '</option>').join('') + '</select>'
        : '<input type="text" disabled placeholder="' + esc(c.tipo === 'data' ? 'dd/mm/aaaa' : '—') + '">';
    return '<div class="doc-head"><div><h3 style="margin:0">' + esc(a.titulo || 'Formulário') + '</h3><div class="doc-code">' + esc(a.codigo || '') + '</div></div></div>'
      + (a.secoes || []).map((s) => '<div class="card"><div class="card-t">' + esc(s.nome) + '</div>'
        + (s.campos || []).map((c) => '<div class="field"><label>' + esc(c.rotulo) + (c.obrigatorio ? ' <span style="color:var(--rose)">*</span>' : '') + '</label>' + ctrl(c)
          + (c.ajuda ? '<div class="note" style="margin-top:var(--e-2)">' + esc(c.ajuda) + '</div>' : '') + '</div>').join('') + '</div>').join('');
  },
  causa: (a) => '<div class="alert alert-info">' + esc(a.avaliacao_da_trilha) + '</div>'
    + (a.causas_identificadas || []).map((c) => achado(c.confianca === 'alta' ? 'baixo' : c.confianca === 'media' ? 'medio' : 'alto', c.tipo, c.causa, 'Confiança: ' + c.confianca)).join('')
    + (a.alerta ? '<div class="alert alert-warn"><b>Atenção.</b> ' + esc(a.alerta) + '</div>' : '')
    + (a.suficiente ? '<div class="alert alert-info"><b>A trilha é suficiente.</b> Pode seguir para o plano de ação.</div>'
      : '<div class="card"><div class="card-t">Próxima pergunta</div><div>' + esc(a.proxima_pergunta) + '</div></div>'),
};

/** Resposta estruturada quando der; se o agente fugiu do formato, mostra o texto. */
function renderResposta(id, texto) {
  if (!RENDER[id]) return md(texto);
  try { return RENDER[id](extrairJSON(texto)); } catch { return md(texto); }
}

function moldura(f, miolo) {
  return '<div class="eyebrow" id="eyebrow">Passo ' + esc(f.n) + ' · ' + esc(rotuloNormas(f)) + '</div>'
    + '<h2>' + esc(f.t) + '</h2><p class="lede">' + esc(f.d) + '</p>'
    + '<div id="avisoBox">' + avisoConfianca(f) + '</div><div id="combo">' + seletorCombinado(f) + '</div>' + miolo;
}

const rodape = (f, rotuloBotao) => '<div class="btn-row"><button class="btn btn-primary" id="btnGo" data-acao="rodar" data-id="' + f.id + '">' + rotuloBotao + '</button>'
  + '<span class="note" style="margin:0">Modelo: ' + esc((S.agentes[f.agente] || {}).modelo || '—') + '</span></div>';
const naoExecutado = '<div id="saida"><div class="locked"><div class="locked-i">◷</div>Não executado ainda.</div></div>';

function telaSimples(f) {
  $('main').innerHTML = moldura(f, '<div class="panel">' + rodape(f, 'Executar') + naoExecutado + '</div>');
}

function telaEntrada(f) {
  const rotulos = {
    redator: ['Que documento você precisa?', 'Ex.: procedimento de controle de informação documentada'],
    formulario: ['Cole o procedimento de onde derivar o formulário', 'Ou descreva o processo que precisa de registro'],
    plano: ['Cole as lacunas ou achados a tratar', 'Ex.: o relatório de auditoria, ou a lista do diagnóstico'],
    analista: ['Cole o documento a analisar', ''],
    auditor: ['Cole o documento ou descreva a prática a auditar', ''],
  }[f.id] || ['Entrada', ''];
  $('main').innerHTML = moldura(f, '<div class="panel"><div class="field"><label for="entrada">' + esc(rotulos[0]) + '</label>'
    + '<textarea id="entrada" class="doc" maxlength="24000" placeholder="' + esc(rotulos[1]) + '"></textarea></div>'
    + rodape(f, 'Executar') + naoExecutado + '</div>');
  if (S.prefill) {
    $('entrada').value = S.prefill;
    S.prefill = null;
  }
}

function telaChat(f) {
  const hist = S.historico[f.id + ':' + S.norma] || [];
  if (hist.length) S.ultima = { f, chat: hist.slice(), normas: normasDaTela(f) };
  const sugestoes = {
    consultor: ['O que a cláusula 10.2 exige na prática?', 'Qual a diferença entre correção e ação corretiva?', 'Transcreva o texto literal da norma', 'Contratando a EPIGE eu garanto a certificação?'],
    causa: ['A peça saiu fora de tolerância e o operador não percebeu', 'Reclamação de cliente sobre prazo de entrega'],
  }[f.id] || [];
  $('main').innerHTML = moldura(f, '<div class="panel"><div class="thread" id="thread">'
    + hist.map((m) => m.role === 'user' ? '<div class="msg user">' + esc(m.content) + '</div>'
      : '<div class="msg bot"><div class="who">' + esc(f.t) + '</div>' + renderResposta(f.id, m.content) + '</div>').join('')
    + '</div>'
    + (sugestoes.length ? '<div class="suggest">' + sugestoes.map((x) => '<button class="chip" data-acao="perguntar" data-id="' + f.id + '" data-texto="' + esc(x) + '">' + esc(x) + '</button>').join('') + '</div>' : '')
    + '<div class="field"><textarea id="pergunta" maxlength="24000" placeholder="Escreva sua pergunta… (Ctrl+Enter envia)" data-enviar="perguntar" data-id="' + f.id + '"></textarea></div>'
    + '<div class="btn-row"><button class="btn btn-primary" id="btnGo" data-acao="perguntar" data-id="' + f.id + '">Perguntar</button>'
    + '<span class="note" style="margin:0">Modelo: ' + esc((S.agentes[f.agente] || {}).modelo || '—') + '</span></div>'
    + '<div id="salvarDoc">' + (hist.length ? botaoSalvar('Salvar a conversa como registro') : '') + '</div></div>'
    + (f.id === 'consultor' ? '<p class="note">As duas últimas sugestões testam guardrails: uma pede texto protegido por direito autoral, a outra pede promessa de certificação. Observe a recusa.</p>' : ''));
  const th = $('thread');
  if (th) th.scrollTop = th.scrollHeight;
}

ACOES.rodar = async (el) => {
  const f = FERRAMENTAS.find((x) => x.id === el.dataset.id);
  const box = $('saida');
  const entrada = $('entrada') ? $('entrada').value.trim() : '';
  if (f.doc && !entrada) { box.innerHTML = '<div class="alert alert-warn">Preencha a entrada acima antes de executar.</div>'; return; }
  el.disabled = true;
  pensando(box, 'o agente está trabalhando');
  try {
    const pedido = f.doc ? entrada : 'Execute a sua função para ' + S.org.nome + '.';
    const d = await chamar(f.agente, [{ role: 'user', content: pedido }], f.t);
    const aviso = d.aviso ? '<div class="alert alert-warn">' + esc(d.aviso) + '</div>' : '';
    let dados = null;
    if (RENDER[f.id]) { try { dados = extrairJSON(d.texto); } catch { dados = null; } }
    S.ultima = { f, dados, texto: d.texto, entrada, normas: normasDaTela(f) };
    box.innerHTML = aviso + (dados ? RENDER[f.id](dados) : '<div class="doc-out">' + md(d.texto) + '</div>')
      + '<div id="salvarDoc">' + botaoSalvar('Salvar em documentos') + '</div>';
  } catch (e) { erroBox(box, e); }
  el.disabled = false;
};

ACOES.perguntar = async (el) => {
  const f = FERRAMENTAS.find((x) => x.id === el.dataset.id);
  const chave = f.id + ':' + S.norma;
  const q = (el.dataset.texto || $('pergunta').value).trim();
  if (!q) return;
  $('pergunta').value = '';
  $('btnGo').disabled = true;
  S.historico[chave] = S.historico[chave] || [];
  const th = $('thread');
  th.insertAdjacentHTML('beforeend', '<div class="msg user">' + esc(q) + '</div>');
  const tmp = 'b' + Date.now();
  th.insertAdjacentHTML('beforeend', '<div class="msg bot" id="' + tmp + '"><div class="who">' + esc(f.t) + '</div><div class="thinking"><span class="pulse"></span><span class="pulse"></span><span class="pulse"></span> consultando</div></div>');
  th.scrollTop = th.scrollHeight;
  S.historico[chave].push({ role: 'user', content: q });
  try {
    const d = await chamar(f.agente, S.historico[chave], f.t);
    S.historico[chave].push({ role: 'assistant', content: d.texto });
    $(tmp).innerHTML = '<div class="who">' + esc(f.t) + '</div>' + renderResposta(f.id, d.texto);
    S.ultima = { f, chat: S.historico[chave].slice(), normas: normasDaTela(f) };
    $('salvarDoc').innerHTML = botaoSalvar('Salvar a conversa como registro');
  } catch (e) {
    $(tmp).innerHTML = '<div class="who">' + esc(f.t) + '</div><div class="alert alert-err" style="margin:0">' + esc(e.message) + '</div>';
    S.historico[chave].pop();
  }
  $('btnGo').disabled = false;
  th.scrollTop = th.scrollHeight;
};

/* ---------- da IA para o controle de documentos ---------- */

const botaoSalvar = (rotulo) => '<div class="salvar-doc"><div class="btn-row" style="margin:0"><button class="btn btn-ghost" data-acao="abrirSalvar">' + esc(rotulo) + '</button>'
  + '<span class="note" style="margin:0">Entra como rascunho, para revisão e aprovação.</span>'
  + '<button class="linkish" data-acao="abrirSinalizar" style="margin-left:auto">Sinalizar problema nesta resposta</button></div></div>';

const MOTIVOS_SINAL = {
  incorreta: 'Informação incorreta', requisito_inexistente: 'Requisito que a norma não tem',
  referencia_legal: 'Referência legal errada ou inexistente', texto_da_norma: 'Reproduziu texto da norma',
  promessa: 'Prometeu certificação ou resultado', inadequada: 'Não serve para o porte ou a atividade', outro: 'Outro',
};

/** O canal para quem usa a IA dizer que ela errou — monitoramento do sistema de IA depois de publicado. */
ACOES.abrirSinalizar = () => {
  if (!S.ultima) return;
  $('salvarDoc').innerHTML = '<form data-form="sinalizar" class="salvar-doc"><div class="card-t">Sinalizar problema</div>'
    + '<div class="field"><label for="sn_motivo">O que está errado?</label><select id="sn_motivo" name="motivo">'
    + Object.entries(MOTIVOS_SINAL).map(([k, v]) => '<option value="' + k + '">' + esc(v) + '</option>').join('') + '</select></div>'
    + '<div class="field"><label for="sn_comentario">Comentário (opcional)</label><textarea id="sn_comentario" name="comentario" maxlength="1000" placeholder="ex.: a cláusula citada não trata disso"></textarea></div>'
    + '<p class="note">A resposta sinalizada é enviada à equipe da EPIGE para correção do agente. Conversas não são guardadas — só o que você enviar aqui.</p>'
    + '<div class="btn-row"><button class="btn btn-primary" type="submit">Enviar sinalização</button></div><div id="snMsg"></div></form>';
};

FORMS.sinalizar = async (f) => {
  const u = S.ultima;
  const c = campos(f);
  const trecho = u.chat ? (u.chat.filter((m) => m.role === 'assistant').slice(-1)[0] || {}).content : u.texto;
  const btn = f.querySelector('button[type=submit]');
  ocupado(btn, true);
  try {
    await api('POST', '/api/sinalizacoes', { agente: u.f.agente, norma: u.normas.join(','), motivo: c.motivo, comentario: c.comentario, trecho: String(trecho || '').slice(0, 4000) });
    $('salvarDoc').innerHTML = '<div class="alert alert-info">Obrigado. A sinalização foi registrada e será tratada.</div>';
  } catch (e) { erroBox($('snMsg'), e); ocupado(btn, false); }
};

const rotuloCampo = (k) => k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

function jsonParaMd(obj, nivel = 2) {
  let out = '';
  for (const [k, v] of Object.entries(obj || {})) {
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
    const titulo = '#'.repeat(nivel) + ' ' + rotuloCampo(k) + '\n';
    if (Array.isArray(v)) {
      out += titulo + v.map((it) => '- ' + (it && typeof it === 'object'
        ? Object.entries(it).filter(([, x]) => x != null && x !== '').map(([kk, x]) => '**' + rotuloCampo(kk) + ':** ' + (typeof x === 'object' ? JSON.stringify(x) : x)).join(' · ')
        : it)).join('\n') + '\n\n';
    } else if (typeof v === 'object') {
      out += titulo + jsonParaMd(v, Math.min(nivel + 1, 4));
    } else {
      out += '**' + rotuloCampo(k) + ':** ' + v + '\n\n';
    }
  }
  return out;
}

function respostaMd(id, texto) {
  if (!RENDER[id]) return texto;
  try { return jsonParaMd(extrairJSON(texto), 3); } catch { return texto; }
}

function paraMarkdown(u) {
  const normas = u.normas.map((k) => (S.normas[k] || {}).rotulo || k).join(', ');
  const origem = 'Gerado pelo agente ' + u.f.t + ' em ' + new Date().toLocaleDateString('pt-BR') + ' · ' + normas + '. Revise antes de aprovar.\n\n';
  if (u.chat) {
    return origem + u.chat.map((m) => (m.role === 'user' ? '## Pergunta\n' + m.content
      : '## Resposta — ' + u.f.t + '\n' + respostaMd(u.f.id, m.content))).join('\n\n');
  }
  if (!u.dados) return origem + u.texto;
  if (u.f.id === 'auditor') {
    const a = u.dados;
    return origem + '# ' + (a.natureza === 'avaliacao_de_maturidade' ? 'Avaliação de maturidade ESG' : 'Relatório de auditoria interna') + '\n\n'
      + '**Escopo:** ' + (a.escopo || '—') + '\n\n## Achados\n\n'
      + (a.achados || []).map((f, i) => '### ' + (i + 1) + '. ' + (f.classificacao === 'maturidade' ? 'Maturidade: ' + (f.estagio || '') : (f.classificacao || '').replace('_', ' '))
        + ' — ' + (f.requisito || '') + '\n' + (f.constatacao || '') + '\n\n**Evidência:** ' + (f.evidencia || '—')).join('\n\n')
      + '\n\n## Conclusão\n' + (a.conclusao || '') + (a.recomendacao_de_prazo ? '\n\n**Prazo recomendado:** ' + a.recomendacao_de_prazo : '')
      + (u.entrada ? '\n\n## Material auditado\n' + u.entrada : '');
  }
  if (u.f.id === 'formulario') {
    const a = u.dados;
    return origem + '# ' + (a.titulo || 'Formulário') + '\n\n' + (a.secoes || []).map((s) => '## ' + s.nome + '\n'
      + (s.campos || []).map((c) => '- **' + c.rotulo + '**' + (c.obrigatorio ? ' (obrigatório)' : '') + ' — ' + (c.tipo || 'texto')
        + (c.opcoes && c.opcoes.length ? ': ' + c.opcoes.join(' / ') : '') + (c.ajuda ? '. ' + c.ajuda : '')).join('\n')).join('\n\n');
  }
  return origem + jsonParaMd(u.dados);
}

ACOES.abrirSalvar = () => {
  const u = S.ultima;
  if (!u) return;
  const tipo = u.f.tipo || 'registro';
  const sugestao = u.f.id === 'formulario' && u.dados && u.dados.titulo ? u.dados.titulo
    : u.f.id === 'redator' ? (u.entrada || '').split('\n')[0].slice(0, 120) : u.f.t + ' — ' + new Date().toLocaleDateString('pt-BR');
  $('salvarDoc').innerHTML = '<form data-form="salvarDoc" class="salvar-doc"><div class="grid2">'
    + '<div class="field"><label for="sd_titulo">Título</label><input type="text" id="sd_titulo" name="titulo" required maxlength="200" value="' + esc(sugestao) + '"></div>'
    + '<div class="field"><label for="sd_tipo">Tipo</label><select id="sd_tipo" name="tipo">' + opcoesTipo(tipo) + '</select></div></div>'
    + '<div class="btn-row"><button class="btn btn-primary" type="submit">Salvar como rascunho</button><span class="note" style="margin:0">Normas: ' + esc(u.normas.map((k) => S.normas[k].rotulo).join(', ')) + '</span></div>'
    + '<div id="sdMsg"></div></form>';
};

const TIPOS_PADRAO = { procedimento: 'Procedimento', politica: 'Política', manual: 'Manual', instrucao: 'Instrução de trabalho', formulario: 'Formulário', plano: 'Plano', relatorio: 'Relatório de auditoria', registro: 'Registro', outro: 'Outro' };
const opcoesTipo = (sel) => Object.entries(Object.keys(S.tipos).length ? S.tipos : TIPOS_PADRAO).map(([k, v]) => '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + esc(v) + '</option>').join('');

FORMS.salvarDoc = async (f) => {
  const u = S.ultima;
  const c = campos(f);
  const btn = f.querySelector('button[type=submit]');
  ocupado(btn, true);
  try {
    const r = await api('POST', '/api/documentos', { titulo: c.titulo, tipo: c.tipo, normas: u.normas, conteudo: paraMarkdown(u), origem: 'agente:' + u.f.agente });
    $('salvarDoc').innerHTML = '<div class="alert alert-info">Salvo como <b>' + esc(r.codigo) + '</b>, em rascunho. '
      + '<button class="linkish" data-acao="abrirDoc" data-id="' + esc(r.id) + '">Abrir o documento</button></div>';
  } catch (e) { erroBox($('sdMsg'), e); ocupado(btn, false); }
};

/* ============================================================ documentos */

const SITUACAO = {
  em_elaboracao: 'Em elaboração', em_revisao: 'Aguardando aprovação', vigente: 'Vigente',
  vigente_em_revisao: 'Vigente · revisão em curso', obsoleto: 'Obsoleto',
};
const ESTADO = { rascunho: 'Rascunho', em_revisao: 'Em aprovação', vigente: 'Vigente', substituida: 'Substituída', obsoleta: 'Obsoleta', cancelada: 'Cancelada' };
const badge = (k, rotulo) => '<span class="badge ' + cls(k) + '">' + esc(rotulo || k) + '</span>';
const nomeAgente = (id) => (FERRAMENTAS.find((f) => f.agente === id) || {}).t || id;
const DECLARACAO_IA = 'Revisei o conteúdo elaborado com apoio de IA e confirmo que ele reflete a prática da empresa.';

TELAS.documentos = async () => {
  const pode = podeIA();
  $('main').innerHTML = cabecalho('Gestão · Controle de documentos', 'Documentos',
    pode ? 'Tudo passa por rascunho, aprovação e versão — como a cláusula 7.5 pede. O que a IA gera entra aqui como rascunho.'
      : 'Os documentos vigentes da sua empresa. Consulte sempre por aqui: cópia impressa pode estar desatualizada.')
    + (pode ? '<div class="btn-row"><button class="btn btn-primary" data-acao="novoDoc">Novo documento</button></div>' : '')
    + '<div class="panel"><div class="filtros">'
    + '<input type="search" id="fBusca" placeholder="Buscar por código ou título" data-filtro aria-label="Buscar">'
    + '<select id="fTipo" data-filtro aria-label="Tipo"><option value="">Todos os tipos</option></select>'
    + '<select id="fSit" data-filtro aria-label="Situação"><option value="">Todas as situações</option>'
    + Object.entries(SITUACAO).filter(([k]) => pode || k === 'vigente').map(([k, v]) => '<option value="' + k + '">' + esc(v) + '</option>').join('') + '</select></div>'
    + '<div id="listaDocs"><div class="thinking"><span class="pulse"></span> carregando</div></div></div>';
  try {
    const d = await api('GET', '/api/documentos');
    S.docs = d.documentos;
    S.tipos = d.tipos;
    $('fTipo').insertAdjacentHTML('beforeend', Object.entries(d.tipos).map(([k, v]) => '<option value="' + k + '">' + esc(v) + '</option>').join(''));
    desenharListaDocs();
  } catch (e) { erroBox($('listaDocs'), e); }
};

function desenharListaDocs() {
  const box = $('listaDocs');
  if (!box || !$('fBusca')) return;
  const busca = $('fBusca').value.trim().toLowerCase();
  const tipo = $('fTipo').value;
  const sit = $('fSit').value;
  const lista = S.docs.filter((d) => (!busca || (d.codigo + ' ' + d.titulo).toLowerCase().includes(busca))
    && (!tipo || d.tipo === tipo) && (!sit || d.situacao === sit));
  if (!lista.length) {
    box.innerHTML = '<div class="locked"><div class="locked-i">▤</div>' + (S.docs.length ? 'Nenhum documento com esses filtros.' : 'Nenhum documento ainda.') + '</div>';
    return;
  }
  box.innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Código</th><th>Título</th><th class="opc">Tipo</th><th>Situação</th><th class="opc">Versão</th><th class="opc">Atualizado</th></tr></thead><tbody>'
    + lista.map((d) => '<tr class="clicavel" data-acao="abrirDoc" data-id="' + esc(d.id) + '"><td class="mono">' + esc(d.codigo) + '</td><td>' + esc(d.titulo)
      + (d.apoio_ia ? ' ' + badge('ia', 'IA') : '') + '</td><td class="opc">' + esc(S.tipos[d.tipo] || d.tipo) + '</td><td>' + badge(d.situacao, SITUACAO[d.situacao]) + '</td><td class="mono opc">'
      + (d.versao_vigente ? 'v' + d.versao_vigente : '—') + (d.versao_aberta ? ' · v' + d.versao_aberta + ' aberta' : '') + '</td><td class="opc">' + data(d.atualizado_em) + '</td></tr>').join('')
    + '</tbody></table></div>';
}

ACOES.novoDoc = () => {
  S.tela = 'doc';
  montarRail();
  $('main').innerHTML = cabecalho('Gestão · Documentos', 'Novo documento', 'Entra como rascunho (versão 1). Depois de salvo, envie para aprovação.')
    + '<form data-form="novoDoc" class="panel"><div class="grid2">'
    + '<div class="field"><label for="nd_titulo">Título</label><input type="text" id="nd_titulo" name="titulo" required maxlength="200"></div>'
    + '<div class="field"><label for="nd_tipo">Tipo</label><select id="nd_tipo" name="tipo">' + opcoesTipo('procedimento') + '</select></div></div>'
    + '<div class="field"><label for="nd_codigo">Código (opcional — em branco, a plataforma numera)</label><input type="text" id="nd_codigo" name="codigo" maxlength="24" placeholder="ex.: PR-QUA-001"></div>'
    + '<div class="field"><label>Normas relacionadas</label><div class="suggest">'
    + Object.entries(S.normas).map(([k, v]) => '<label class="chip"><input type="checkbox" name="normas" value="' + esc(k) + '"' + (k === S.norma ? ' checked' : '') + '> ' + esc(v.rotulo) + '</label>').join('') + '</div></div>'
    + '<div class="field"><label for="nd_conteudo">Conteúdo</label><textarea id="nd_conteudo" name="conteudo" class="doc" required maxlength="200000" placeholder="Use # para títulos e - para listas."></textarea></div>'
    + '<div class="btn-row"><button class="btn btn-primary" type="submit">Criar rascunho</button><button class="btn btn-ghost" type="button" data-acao="abrir" data-id="documentos">Cancelar</button></div>'
    + '<div id="ndMsg"></div></form>';
};

FORMS.novoDoc = async (f) => {
  const btn = f.querySelector('button[type=submit]');
  ocupado(btn, true);
  try {
    const fd = new FormData(f);
    const r = await api('POST', '/api/documentos', {
      titulo: fd.get('titulo'), tipo: fd.get('tipo'), codigo: fd.get('codigo') || undefined,
      normas: fd.getAll('normas'), conteudo: fd.get('conteudo'), origem: 'manual',
    });
    abrirDoc(r.id);
  } catch (e) { erroBox($('ndMsg'), e); ocupado(btn, false); }
};

ACOES.abrirDoc = (el) => abrirDoc(el.dataset.id);

async function abrirDoc(id) {
  S.tela = 'doc';
  montarRail();
  $('main').innerHTML = '<div class="thinking"><span class="pulse"></span> abrindo o documento</div>';
  try {
    S.doc = await api('GET', '/api/documentos/' + encodeURIComponent(id));
    desenharDoc();
  } catch (e) { erroBox($('main'), e); }
}

function desenharDoc() {
  const { documento: d, versoes, conteudo_vigente: vigente, aberta } = S.doc;
  const editor = podeIA();
  const admin = ehAdmin();
  const vv = versoes.find((v) => v.estado === 'vigente');
  const normas = d.normas.map((k) => (S.normas[k] || {}).rotulo || k).join(', ') || '—';

  let h = '<div class="eyebrow">' + esc(d.codigo) + ' · ' + esc(d.tipo_rotulo) + '</div><h2>' + esc(d.titulo) + '</h2>'
    + '<div class="btn-row">' + badge(d.situacao, SITUACAO[d.situacao]) + '</div>'
    + '<dl class="kv"><dt>Normas</dt><dd>' + esc(normas) + '</dd>'
    + '<dt>Versão vigente</dt><dd>' + (vv ? 'v' + vv.numero + ', aprovada por ' + esc(vv.aprovado_por || '—') + ' em ' + dataHora(vv.aprovado_em) : 'nenhuma ainda') + '</dd>'
    + '<dt>Criado em</dt><dd>' + dataHora(d.criado_em) + '</dd>'
    + (d.apoio_ia ? '<dt>Origem</dt><dd>Elaborado com apoio de IA (agente ' + esc(nomeAgente(d.apoio_ia)) + ')'
      + (vv && vv.revisao_declarada ? ' · revisão humana declarada na aprovação da v' + vv.numero : '') + '</dd>' : '')
    + '</dl>';

  const botoes = [];
  if (vigente) {
    botoes.push('<button class="btn btn-ghost btn-sm" data-acao="imprimirDoc">Imprimir vigente</button>');
    botoes.push('<button class="btn btn-ghost btn-sm" data-acao="baixarDoc">Baixar vigente (.md)</button>');
  }
  if (editor && (vigente || aberta)) {
    botoes.push('<button class="btn btn-ghost btn-sm" data-acao="docParaAgente" data-agente="analista">Analisar com o agente</button>');
    botoes.push('<button class="btn btn-ghost btn-sm" data-acao="docParaAgente" data-agente="auditor">Auditar este documento</button>');
  }
  if (editor && !d.obsoleto && !aberta && vigente && !d.registro) botoes.push('<button class="btn btn-primary btn-sm" data-acao="abrirRevisao">Abrir revisão</button>');
  if (admin && !d.obsoleto && vigente) botoes.push('<button class="btn btn-perigo btn-sm" data-acao="pedirObsoleto">Tornar obsoleto</button>');
  if (botoes.length) h += '<div class="btn-row">' + botoes.join('') + '</div>';
  h += '<div id="docMsg"></div>';

  if (aberta) {
    const va = versoes.find((v) => v.numero === d.versao_aberta) || {};
    h += '<div class="panel"><div class="card-t">Versão ' + d.versao_aberta + ' · ' + esc(ESTADO[aberta.estado]) + '</div>';
    if (aberta.estado === 'rascunho' && va.parecer) h += '<div class="alert alert-warn"><b>Devolvido para ajuste:</b> ' + esc(va.parecer) + '</div>';
    if (aberta.estado === 'rascunho' && editor) {
      h += '<form data-form="salvarRascunho">'
        + (d.versao_aberta > 1 ? '<div class="field"><label for="rs_resumo">O que muda nesta revisão</label><input type="text" id="rs_resumo" name="resumo" maxlength="500" value="' + esc(va.resumo || '') + '"></div>' : '')
        + '<div class="field"><label for="rs_conteudo">Conteúdo</label><textarea id="rs_conteudo" name="conteudo" class="doc" style="min-height:360px" maxlength="200000" required>' + esc(aberta.conteudo) + '</textarea></div>'
        + '<div class="btn-row"><button class="btn btn-ghost" type="submit">Salvar rascunho</button>'
        + '<button class="btn btn-primary" type="button" data-acao="enviarParaAprovacao">Salvar e enviar para aprovação</button>'
        + '<button class="btn btn-perigo" type="button" data-acao="docAcao" data-a="descartar">Descartar ' + (d.versao_vigente ? 'revisão' : 'documento') + '</button></div></form>';
    } else {
      h += '<div class="doc-view">' + md(aberta.conteudo) + '</div>';
      if (aberta.estado === 'em_revisao') {
        h += admin
          ? '<form data-form="decidir" style="margin-top:var(--e-13)"><div class="field"><label for="dc_motivo">Parecer (obrigatório para devolver)</label><textarea id="dc_motivo" name="motivo" maxlength="1000"></textarea></div>'
            + (d.apoio_ia ? '<div class="alert alert-info"><b>Elaborado com apoio de IA.</b> Auditorias de certificação cobram evidência de revisão humana competente antes da emissão. Leia o conteúdo inteiro, ajuste o que não corresponde à prática e só então aprove.'
              + '<label style="display:flex;gap:var(--e-8);align-items:flex-start;margin-top:var(--e-8);font-weight:600"><input type="checkbox" id="dc_revisao"> ' + esc(DECLARACAO_IA) + '</label></div>' : '')
            + '<div class="btn-row"><button class="btn btn-primary" type="button" data-acao="decidir" data-a="aprovar">Aprovar e tornar vigente</button>'
            + '<button class="btn btn-ghost" type="button" data-acao="decidir" data-a="devolver">Devolver para ajuste</button></div>'
            + (va.minha ? '<p class="note">Você elaborou esta versão. A aprovação fica registrada como feita por quem elaborou.</p>' : '') + '</form>'
          : '<p class="note">Enviada para aprovação por ' + esc(va.enviado_por || '—') + ' em ' + dataHora(va.enviado_em) + '. Aguardando um administrador.</p>';
      }
    }
    h += '</div>';
  }

  h += '<div class="panel"><div class="card-t">' + (d.obsoleto ? 'Última versão (obsoleta)' : 'Versão vigente') + '</div>'
    + (vigente ? '<div class="doc-view">' + md(vigente) + '</div>' : '<p class="muted">Ainda sem versão aprovada.</p>') + '</div>';

  h += '<div class="panel"><div class="card-t">Histórico de versões</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Versão</th><th>Estado</th><th>O que mudou</th><th>Elaborada</th><th>Aprovada</th><th></th></tr></thead><tbody>'
    + versoes.map((v) => '<tr><td class="mono">v' + v.numero + '</td><td>' + badge(v.estado, ESTADO[v.estado]) + '</td><td>' + esc(v.resumo)
      + (v.parecer ? '<div class="note">Parecer: ' + esc(v.parecer) + '</div>' : '') + '</td><td>' + esc(v.criado_por || '—') + '<div class="note">' + dataHora(v.criado_em) + '</div></td>'
      + '<td>' + (v.aprovado_em ? esc(v.aprovado_por || '—') + '<div class="note">' + dataHora(v.aprovado_em) + (v.revisao_declarada ? ' · revisão de IA declarada' : '') + '</div>' : '—') + '</td>'
      + '<td><button class="btn btn-ghost btn-sm" data-acao="verVersao" data-n="' + v.numero + '">Ver</button></td></tr>').join('')
    + '</tbody></table></div><div id="versaoVista"></div></div>';

  h += '<div class="btn-row"><button class="btn btn-ghost" data-acao="abrir" data-id="documentos">← Voltar para a lista</button></div>';
  $('main').innerHTML = h;
}

const idDoc = () => encodeURIComponent(S.doc.documento.id);

async function salvarRascunho(extra = {}) {
  const f = document.querySelector('form[data-form="salvarRascunho"]');
  const c = campos(f);
  return api('PUT', '/api/documentos/' + idDoc() + '/rascunho', { conteudo: c.conteudo, resumo: c.resumo, editado_em: S.doc.aberta.editado_em, ...extra });
}

FORMS.salvarRascunho = async (f) => {
  const btn = f.querySelector('button[type=submit]');
  ocupado(btn, true);
  try {
    const r = await salvarRascunho();
    S.doc.aberta.editado_em = r.editado_em;
    S.doc.aberta.conteudo = campos(f).conteudo;
    okBox($('docMsg'), 'Rascunho salvo às ' + new Date().toLocaleTimeString('pt-BR') + '.');
  } catch (e) { erroBox($('docMsg'), e); }
  ocupado(btn, false);
};

ACOES.enviarParaAprovacao = async (el) => {
  ocupado(el, true);
  try {
    await salvarRascunho();
    await api('POST', '/api/documentos/' + idDoc() + '/acao', { acao: 'enviar' });
    abrirDoc(S.doc.documento.id);
  } catch (e) { erroBox($('docMsg'), e); ocupado(el, false); }
};

ACOES.docAcao = async (el) => {
  const a = el.dataset.a;
  if (a === 'descartar' && !confirm(S.doc.documento.versao_vigente ? 'Descartar esta revisão? O texto dela será apagado.' : 'Descartar o documento? Ele nunca foi aprovado e será apagado.')) return;
  ocupado(el, true);
  try {
    const r = await api('POST', '/api/documentos/' + idDoc() + '/acao', { acao: a });
    if (r.apagado) abrir('documentos'); else abrirDoc(S.doc.documento.id);
  } catch (e) { erroBox($('docMsg'), e); ocupado(el, false); }
};

ACOES.decidir = async (el) => {
  const motivo = $('dc_motivo').value.trim();
  if (el.dataset.a === 'devolver' && !motivo) { erroBox($('docMsg'), new Error('Escreva o parecer: quem elaborou precisa saber o que ajustar.')); return; }
  const declarou = !!($('dc_revisao') && $('dc_revisao').checked);
  if (el.dataset.a === 'aprovar' && S.doc.documento.apoio_ia && !declarou) {
    erroBox($('docMsg'), new Error('Marque a declaração de revisão: o documento foi elaborado com apoio de IA.'));
    return;
  }
  ocupado(el, true);
  try {
    await api('POST', '/api/documentos/' + idDoc() + '/acao', { acao: el.dataset.a, motivo, revisao_confirmada: declarou });
    abrirDoc(S.doc.documento.id);
  } catch (e) { erroBox($('docMsg'), e); ocupado(el, false); }
};

ACOES.abrirRevisao = () => {
  const box = $('docMsg');
  box.innerHTML = '<form data-form="novaRevisao" class="panel"><div class="card-t">Nova revisão</div>'
    + '<div class="field"><label for="nr_resumo">O que muda nesta revisão</label><input type="text" id="nr_resumo" name="resumo" required maxlength="500" placeholder="ex.: inclui prazo para verificação de eficácia"></div>'
    + '<div class="btn-row"><button class="btn btn-primary" type="submit">Abrir revisão a partir da vigente</button></div><div id="nrMsg"></div></form>';
  $('nr_resumo').focus();
};

FORMS.novaRevisao = async (f) => {
  const btn = f.querySelector('button[type=submit]');
  ocupado(btn, true);
  try {
    await api('PUT', '/api/documentos/' + idDoc() + '/rascunho', { conteudo: S.doc.conteudo_vigente, resumo: campos(f).resumo });
    abrirDoc(S.doc.documento.id);
  } catch (e) { erroBox($('nrMsg'), e); ocupado(btn, false); }
};

ACOES.pedirObsoleto = () => {
  $('docMsg').innerHTML = '<form data-form="obsoletar" class="panel"><div class="card-t">Tornar obsoleto</div>'
    + '<p class="note">O documento sai de uso e deixa de aparecer para leitores. O histórico fica retido.</p>'
    + '<div class="field"><label for="ob_motivo">Motivo</label><input type="text" id="ob_motivo" name="motivo" required maxlength="1000" placeholder="ex.: substituído pelo PR-010"></div>'
    + '<div class="btn-row"><button class="btn btn-perigo" type="submit">Confirmar</button></div><div id="obMsg"></div></form>';
};

FORMS.obsoletar = async (f) => {
  const btn = f.querySelector('button[type=submit]');
  ocupado(btn, true);
  try {
    await api('POST', '/api/documentos/' + idDoc() + '/acao', { acao: 'obsoletar', motivo: campos(f).motivo });
    abrirDoc(S.doc.documento.id);
  } catch (e) { erroBox($('obMsg'), e); ocupado(btn, false); }
};

ACOES.verVersao = async (el) => {
  const box = $('versaoVista');
  pensando(box, 'carregando a versão');
  try {
    const { versao: v } = await api('GET', '/api/documentos/' + idDoc() + '/versoes/' + Number(el.dataset.n));
    box.innerHTML = '<div class="card" style="margin-top:var(--e-13)"><div class="card-t">Versão ' + v.numero + ' · ' + esc(ESTADO[v.estado]) + '</div><div class="doc-view">' + md(v.conteudo) + '</div></div>';
  } catch (e) { erroBox(box, e); }
};

ACOES.docParaAgente = (el) => {
  const texto = (S.doc.aberta && S.doc.aberta.conteudo) || S.doc.conteudo_vigente || '';
  S.prefill = S.doc.documento.codigo + ' — ' + S.doc.documento.titulo + '\n\n' + texto.slice(0, 23000);
  abrir(el.dataset.agente);
};

ACOES.baixarDoc = () => {
  const d = S.doc.documento;
  const vv = S.doc.versoes.find((v) => v.estado === 'vigente');
  baixar(d.codigo + '-v' + (vv ? vv.numero : '') + '.md', '<!-- ' + d.codigo + ' · ' + d.titulo + ' · versão ' + (vv ? vv.numero : '') + ' · exportado em ' + new Date().toLocaleString('pt-BR') + ' -->\n\n' + S.doc.conteudo_vigente, 'text/markdown;charset=utf-8');
};

ACOES.imprimirDoc = () => {
  const d = S.doc.documento;
  const vv = S.doc.versoes.find((v) => v.estado === 'vigente') || {};
  $('impressao').innerHTML = '<div class="imp-cab"><h1>' + esc(d.codigo) + ' — ' + esc(d.titulo) + '</h1>'
    + '<div><b>Empresa:</b> ' + esc(S.org.nome) + '</div><div><b>Tipo:</b> ' + esc(d.tipo_rotulo) + '</div>'
    + '<div><b>Versão:</b> ' + esc(vv.numero || '—') + '</div><div><b>Aprovada por:</b> ' + esc(vv.aprovado_por || '—') + ' em ' + dataHora(vv.aprovado_em) + '</div>'
    + '<div><b>Normas:</b> ' + esc(d.normas.map((k) => (S.normas[k] || {}).rotulo || k).join(', ') || '—') + '</div>'
    + (d.apoio_ia ? '<div style="grid-column:1/-1"><b>Origem:</b> elaborado com apoio de IA; conteúdo revisado e aprovado por ' + esc(vv.aprovado_por || '—') + (vv.revisao_declarada ? ', com declaração de revisão registrada' : '') + '.</div>' : '')
    + '</div>'
    + '<div class="doc-view">' + md(S.doc.conteudo_vigente) + '</div>'
    + '<div class="imp-rodape">Cópia impressa em ' + esc(new Date().toLocaleString('pt-BR')) + ' por ' + esc(S.usuario.nome)
    + '. Cópia não controlada: a versão válida é a vigente no sistema EPIGE — confira antes de usar.</div>';
  document.body.classList.add('imprimindo');
  window.addEventListener('afterprint', () => document.body.classList.remove('imprimindo'), { once: true });
  window.print();
};

/* ============================================================ empresa */

TELAS.empresa = () => {
  const o = S.org;
  const op = (lista, atual) => lista.map((x) => '<option' + (x === atual ? ' selected' : '') + '>' + esc(x) + '</option>').join('');
  $('main').innerHTML = cabecalho('Gestão · Empresa', 'Quem é a empresa?', 'Todo agente lê isto antes de responder. O mesmo requisito gera orientação diferente para uma metalúrgica de 40 pessoas e um laboratório de 300.')
    + '<form data-form="empresa" class="panel"><div class="grid2">'
    + '<div class="field"><label for="e_nome">Nome da empresa</label><input type="text" id="e_nome" name="nome" maxlength="120" value="' + esc(o.nome) + '"' + (ehAdmin() ? ' required' : ' disabled') + '></div>'
    + '<div class="field"><label for="e_atividade">Atividade</label><input type="text" id="e_atividade" name="atividade" maxlength="300" value="' + esc(o.atividade) + '"></div></div><div class="grid2">'
    + '<div class="field"><label for="e_porte">Porte</label><select id="e_porte" name="porte"><option value="">—</option>' + op(['Microempresa (até 9 pessoas)', 'Pequena empresa (10 a 49 pessoas)', 'Média empresa (50 a 249 pessoas)', 'Grande empresa (250 pessoas ou mais)'], o.porte) + '</select></div>'
    + '<div class="field"><label for="e_nivel">Nível de conhecimento em normas</label><select id="e_nivel" name="nivel"><option value="">—</option>' + op(['Iniciante — explique com calma', 'Intermediário — já conheço o básico', 'Avançado — vá direto ao ponto'], o.nivel) + '</select></div></div>'
    + '<div class="field"><label for="e_situacao">Como o sistema de gestão está hoje</label><textarea id="e_situacao" name="situacao" maxlength="2000">' + esc(o.situacao) + '</textarea></div>'
    + '<div class="btn-row"><button class="btn btn-primary" type="submit">Salvar contexto</button><span class="note" style="margin:0">Vale para toda a equipe. Nenhuma chamada de IA nesta etapa.</span></div><div id="eMsg"></div></form>';
};

FORMS.empresa = async (f) => {
  const btn = f.querySelector('button[type=submit]');
  ocupado(btn, true);
  try {
    const c = campos(f);
    if (!ehAdmin()) c.nome = S.org.nome;
    const r = await api('PUT', '/api/organizacao', c);
    S.org = { ...S.org, ...r.organizacao };
    resumoEmpresa();
    $('userNome').innerHTML = '<b>' + esc(S.usuario.nome) + '</b> · ' + esc(S.org.nome);
    okBox($('eMsg'), 'Contexto salvo. Os próximos agentes já respondem com ele.');
  } catch (e) { erroBox($('eMsg'), e); }
  ocupado(btn, false);
};

/* ============================================================ equipe */

const PAPEL = { admin: 'Administrador', editor: 'Editor', leitor: 'Leitor' };
const opcoesPapel = (sel) => Object.entries(PAPEL).map(([k, v]) => '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + v + '</option>').join('');

TELAS.equipe = async () => {
  $('main').innerHTML = cabecalho('Gestão · Equipe', 'Equipe', 'Administrador aprova documentos e cuida dos acessos. Editor usa a IA e elabora. Leitor consulta os documentos vigentes.')
    + '<form data-form="convidar" class="panel"><div class="card-t">Convidar pessoa</div><div class="grid2">'
    + '<div class="field"><label for="cv_email">E-mail</label><input type="email" id="cv_email" name="email" required maxlength="254"></div>'
    + '<div class="field"><label for="cv_papel">Papel</label><select id="cv_papel" name="papel">' + opcoesPapel('editor') + '</select></div></div>'
    + '<div class="btn-row"><button class="btn btn-primary" type="submit">Gerar convite</button><span class="note" style="margin:0">O link vale 7 dias e só pode ser usado uma vez. Envie por um canal que você confia.</span></div>'
    + '<div id="cvMsg"></div></form><div id="equipeLista"><div class="thinking"><span class="pulse"></span> carregando</div></div>';
  carregarEquipe();
};

async function carregarEquipe() {
  const box = $('equipeLista');
  try {
    const d = await api('GET', '/api/equipe');
    box.innerHTML = '<div class="panel"><div class="card-t">Pessoas</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pessoa</th><th>Papel</th><th>Situação</th><th>2FA</th><th>Último acesso</th><th></th></tr></thead><tbody>'
      + d.usuarios.map((u) => '<tr><td><b>' + esc(u.nome) + '</b>' + (u.eu ? ' <span class="note">(você)</span>' : '') + '<div class="note">' + esc(u.email) + '</div></td>'
        + '<td>' + (u.eu ? badge('admin', PAPEL[u.papel]) : '<select data-muda="mudarPapel" data-id="' + esc(u.id) + '" aria-label="Papel de ' + esc(u.nome) + '">' + opcoesPapel(u.papel) + '</select>') + '</td>'
        + '<td>' + (u.ativo ? 'Ativo' : badge('inativo', 'Inativo')) + '</td>'
        + '<td>' + (u.totp_ativo ? 'Sim' + (u.eu ? '' : ' <button class="linkish" data-acao="remover2fa" data-id="' + esc(u.id) + '">remover</button>') : 'Não') + '</td>'
        + '<td>' + dataHora(u.ultimo_acesso) + '</td>'
        + '<td>' + (u.eu ? '' : '<div class="btn-row" style="margin:0"><button class="btn btn-ghost btn-sm" data-acao="gerarRedefinicao" data-id="' + esc(u.id) + '" data-nome="' + esc(u.nome) + '">Link de nova senha</button>'
          + '<button class="btn btn-ghost btn-sm" data-acao="alternarAtivo" data-id="' + esc(u.id) + '" data-ativo="' + (u.ativo ? '1' : '0') + '">' + (u.ativo ? 'Desativar' : 'Reativar') + '</button></div>') + '</td></tr>').join('')
      + '</tbody></table></div><div id="eqMsg"></div></div>'
      + (d.convites.length ? '<div class="panel"><div class="card-t">Convites pendentes</div><table class="tbl"><thead><tr><th>E-mail</th><th>Papel</th><th>Expira</th><th></th></tr></thead><tbody>'
        + d.convites.map((c) => '<tr><td>' + esc(c.email) + '</td><td>' + esc(PAPEL[c.papel]) + '</td><td>' + dataHora(c.expira_em) + '</td><td><button class="btn btn-ghost btn-sm" data-acao="revogarConvite" data-id="' + esc(c.id) + '">Revogar</button></td></tr>').join('')
        + '</tbody></table></div>' : '');
  } catch (e) { erroBox(box, e); }
}

FORMS.convidar = async (f) => {
  const btn = f.querySelector('button[type=submit]');
  ocupado(btn, true);
  try {
    const c = campos(f);
    const r = await api('POST', '/api/equipe', c);
    $('cvMsg').innerHTML = caixaLink(r.link, 'Convite para ' + c.email + ' — copie e envie:');
    f.reset();
    carregarEquipe();
  } catch (e) { erroBox($('cvMsg'), e); }
  ocupado(btn, false);
};

MUDA.mudarPapel = async (el) => {
  try {
    await api('PATCH', '/api/equipe/' + encodeURIComponent(el.dataset.id), { papel: el.value });
    okBox($('eqMsg'), 'Papel alterado. Vale a partir de agora — a sessão da pessoa foi reiniciada.');
  } catch (e) { erroBox($('eqMsg'), e); carregarEquipe(); }
};

ACOES.alternarAtivo = async (el) => {
  const ativar = el.dataset.ativo !== '1';
  if (!ativar && !confirm('Desativar este acesso? A pessoa sai da plataforma imediatamente.')) return;
  try {
    await api('PATCH', '/api/equipe/' + encodeURIComponent(el.dataset.id), { ativo: ativar });
    carregarEquipe();
  } catch (e) { erroBox($('eqMsg'), e); }
};

ACOES.gerarRedefinicao = async (el) => {
  try {
    const r = await api('POST', '/api/equipe/' + encodeURIComponent(el.dataset.id), { acao: 'redefinir_senha' });
    $('eqMsg').innerHTML = caixaLink(r.link, 'Link de nova senha para ' + el.dataset.nome + ' (vale 24 horas, uso único):');
  } catch (e) { erroBox($('eqMsg'), e); }
};

ACOES.remover2fa = async (el) => {
  if (!confirm('Remover a verificação em duas etapas desta pessoa? Use só se ela perdeu o celular. Fica registrado no log.')) return;
  try {
    await api('POST', '/api/equipe/' + encodeURIComponent(el.dataset.id), { acao: 'remover_2fa' });
    carregarEquipe();
  } catch (e) { erroBox($('eqMsg'), e); }
};

ACOES.revogarConvite = async (el) => {
  try {
    await api('DELETE', '/api/equipe/convites/' + encodeURIComponent(el.dataset.id));
    carregarEquipe();
  } catch (e) { erroBox($('eqMsg'), e); }
};

/* ============================================================ uso de IA */

TELAS.uso = async () => {
  $('main').innerHTML = cabecalho('Gestão · Uso de IA', 'Uso de IA', 'Contadores de chamada e custo. O conteúdo das conversas não é guardado.') + '<div id="usoBox"><div class="thinking"><span class="pulse"></span> carregando</div></div>';
  try {
    const d = await api('GET', '/api/organizacao/uso');
    const pct = d.teto ? Math.min(100, (d.hoje / d.teto) * 100) : 0;
    const nome = { diagnostico: 'Diagnóstico', consultor: 'Consultor', analista: 'Analisar documento', auditor: 'Auditoria', auditor_base: 'Auditoria (demo)', causa: 'Análise de causa', plano: 'Plano de ação', redator: 'Redator', formulario: 'Formulário', legal: 'Legal', sgi: 'Integração', lacuna: 'Lacuna', vigilancia: 'Vigilância', orquestrador: 'Roteamento' };
    $('usoBox').innerHTML = '<div class="panel"><div class="card-t">Hoje</div><div style="font-size:var(--t-24);font-weight:700">R$ ' + brl(d.hoje) + ' <span class="muted" style="font-size:var(--t-15);font-weight:400">de R$ ' + brl(d.teto) + '</span></div>'
      + '<div class="barra' + (pct >= 100 ? ' cheia' : pct >= 75 ? ' alta' : '') + '"><i style="width:' + pct.toFixed(1) + '%"></i></div>'
      + '<p class="note">Ao chegar no teto diário, a IA pausa até o dia seguinte. O teto é ajustado pela administração da plataforma.</p></div>'
      + '<div class="grid2"><div class="panel"><div class="card-t">Últimos 30 dias, por agente</div><table class="tbl"><thead><tr><th>Agente</th><th>Chamadas</th><th>Custo</th></tr></thead><tbody>'
      + (d.por_agente.map((a) => '<tr><td>' + esc(nome[a.agente] || a.agente) + '</td><td class="mono">' + a.chamadas + '</td><td class="mono">R$ ' + brl(a.custo) + '</td></tr>').join('') || '<tr><td colspan="3" class="muted">Sem uso ainda.</td></tr>')
      + '</tbody></table></div><div class="panel"><div class="card-t">Últimos 30 dias, por dia</div><table class="tbl"><thead><tr><th>Dia</th><th>Chamadas</th><th>Custo</th></tr></thead><tbody>'
      + (d.por_dia.slice().reverse().map((x) => '<tr><td>' + esc(x.dia.split('-').reverse().join('/')) + '</td><td class="mono">' + x.chamadas + '</td><td class="mono">R$ ' + brl(x.custo) + '</td></tr>').join('') || '<tr><td colspan="3" class="muted">Sem uso ainda.</td></tr>')
      + '</tbody></table></div></div>';
  } catch (e) { erroBox($('usoBox'), e); }
};

/* ============================================================ log de auditoria */

const ACAO_LOG = {
  login: 'Entrou', logout: 'Saiu', login_falhou: 'Senha errada', login_2fa_falhou: 'Código 2FA errado', cadastro: 'Criou o acesso',
  convite_criado: 'Convidou', convite_revogado: 'Revogou convite', acesso_alterado: 'Alterou acesso', redefinicao_gerada: 'Gerou link de nova senha',
  senha_alterada: 'Trocou a senha', senha_redefinida: 'Redefiniu a senha', '2fa_ativado': 'Ativou 2FA', '2fa_desativado': 'Desativou 2FA',
  '2fa_removido_pelo_admin': 'Removeu 2FA de alguém', sessoes_encerradas: 'Encerrou outras sessões', contexto_alterado: 'Alterou o contexto',
  documento_criado: 'Criou documento', resposta_sinalizada: 'Sinalizou resposta da IA', login_email_desconhecido: 'Tentou entrar com e-mail inexistente', revisao_aberta: 'Abriu revisão', enviado_para_aprovacao: 'Enviou para aprovação',
  devolvido_para_ajuste: 'Devolveu para ajuste', documento_aprovado: 'Aprovou documento', documento_obsoleto: 'Tornou obsoleto',
  revisao_descartada: 'Descartou revisão', documento_descartado: 'Descartou documento', dados_exportados: 'Exportou os dados',
  empresa_criada: 'Empresa criada', empresa_alterada: 'Empresa alterada', plataforma_configurada: 'Plataforma configurada',
};

TELAS.eventos = async () => {
  $('main').innerHTML = cabecalho('Gestão · Log de auditoria', 'Log de auditoria', 'Os 300 eventos mais recentes da empresa. Não pode ser editado nem apagado pela interface.') + '<div id="evBox" class="panel"><div class="thinking"><span class="pulse"></span> carregando</div></div>';
  try {
    const d = await api('GET', '/api/organizacao/eventos');
    $('evBox').innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Quando</th><th>Quem</th><th>O quê</th><th>Sobre</th><th>Detalhe</th><th>IP</th></tr></thead><tbody>'
      + d.eventos.map((e) => '<tr><td>' + dataHora(e.em) + '</td><td>' + esc(e.usuario || '—') + '</td><td>' + esc(ACAO_LOG[e.acao] || e.acao) + '</td><td class="mono">' + esc(e.alvo || '') + '</td><td>' + esc(e.detalhe || '') + '</td><td class="mono">' + esc(e.ip || '') + '</td></tr>').join('')
      + '</tbody></table></div>';
  } catch (e) { erroBox($('evBox'), e); }
};

/* ============================================================ minha conta */

TELAS.conta = async () => {
  const u = S.usuario;
  $('main').innerHTML = cabecalho('Gestão · Minha conta', u.nome, u.email + ' · ' + PAPEL[u.papel] + ' em ' + S.org.nome)
    + '<form data-form="trocarSenha" class="panel"><div class="card-t">Trocar a senha</div>'
    + campo('atual', 'Senha atual', 'password', 'required autocomplete="current-password" maxlength="128"')
    + '<div class="grid2">' + campo('nova', 'Nova senha (mínimo de 10 caracteres)', 'password', 'required minlength="10" maxlength="128" autocomplete="new-password"')
    + campo('nova2', 'Repita a nova senha', 'password', 'required minlength="10" maxlength="128" autocomplete="new-password"') + '</div>'
    + '<div class="btn-row"><button class="btn btn-primary" type="submit">Trocar a senha</button><span class="note" style="margin:0">As suas outras sessões serão encerradas.</span></div><div id="tsMsg"></div></form>'
    + '<div class="panel" id="box2fa"></div>'
    + '<div class="panel"><div class="card-t">Sessões abertas</div><div id="sessoesBox"></div></div>'
    + (ehAdmin() ? '<div class="panel"><div class="card-t">Dados da empresa</div><p class="note">Exporta tudo — pessoas, documentos com todas as versões, log e uso de IA — num arquivo JSON. Senhas e chaves não saem.</p>'
      + '<div class="btn-row"><button class="btn btn-ghost" data-acao="exportar">Exportar dados da empresa</button></div><div id="expMsg"></div></div>' : '');
  desenhar2fa();
  carregarSessoes();
};

FORMS.trocarSenha = async (f) => {
  const c = campos(f);
  if (c.nova !== c.nova2) { erroBox($('tsMsg'), new Error('As duas senhas novas não conferem.')); return; }
  const btn = f.querySelector('button[type=submit]');
  ocupado(btn, true);
  try {
    await api('POST', '/api/auth/senha', { atual: c.atual, nova: c.nova });
    f.reset();
    okBox($('tsMsg'), 'Senha trocada. As outras sessões foram encerradas.');
    carregarSessoes();
  } catch (e) { erroBox($('tsMsg'), e); }
  ocupado(btn, false);
};

function desenhar2fa(etapa) {
  const box = $('box2fa');
  if (S.usuario.totp_ativo) {
    box.innerHTML = '<div class="card-t">Verificação em duas etapas</div><p><b>Ativa.</b> Ao entrar, a plataforma pede o código do seu aplicativo autenticador.</p>'
      + '<form data-form="desativar2fa"><div class="grid2">' + campo('senha', 'Senha', 'password', 'required autocomplete="current-password"')
      + campo('codigo', 'Código atual do aplicativo', 'text', 'required inputmode="numeric" autocomplete="one-time-code"') + '</div>'
      + '<button class="btn btn-ghost" type="submit">Desativar</button><div id="t2Msg"></div></form>';
  } else if (etapa) {
    box.innerHTML = '<div class="card-t">Ativar a verificação em duas etapas</div>'
      + '<p>1. No aplicativo autenticador (Google Authenticator, Microsoft Authenticator, 1Password, Authy…), adicione uma conta digitando esta chave:</p>'
      + '<div class="link-box"><span>' + esc(etapa.chave) + '</span><button class="btn btn-ghost btn-sm" data-acao="copiar" data-texto="' + esc(etapa.chave.replace(/\s/g, '')) + '">Copiar</button></div>'
      + '<p class="note">No celular, você pode <a href="' + esc(etapa.uri) + '">abrir direto no aplicativo</a>.</p>'
      + '<form data-form="confirmar2fa"><p>2. Digite o código de 6 dígitos que o aplicativo mostra:</p>'
      + campo('codigo', 'Código', 'text', 'required inputmode="numeric" autocomplete="one-time-code" maxlength="7"')
      + '<button class="btn btn-primary" type="submit">Confirmar e ativar</button><div id="t2Msg"></div></form>';
  } else {
    box.innerHTML = '<div class="card-t">Verificação em duas etapas</div>'
      + '<p>Além da senha, pede um código do aplicativo autenticador do seu celular. Quem descobrir a sua senha não entra sem o celular. '
      + (ehAdmin() ? '<b>Recomendado para administradores.</b>' : '') + '</p>'
      + '<button class="btn btn-primary" data-acao="iniciar2fa">Ativar</button><div id="t2Msg"></div>';
  }
}

ACOES.iniciar2fa = async () => {
  try { desenhar2fa(await api('POST', '/api/auth/2fa', { acao: 'iniciar' })); } catch (e) { erroBox($('t2Msg'), e); }
};

FORMS.confirmar2fa = async (f) => {
  try {
    await api('POST', '/api/auth/2fa', { acao: 'confirmar', codigo: campos(f).codigo });
    S.usuario.totp_ativo = true;
    desenhar2fa();
  } catch (e) { erroBox($('t2Msg'), e); }
};

FORMS.desativar2fa = async (f) => {
  try {
    await api('POST', '/api/auth/2fa', { acao: 'desativar', ...campos(f) });
    S.usuario.totp_ativo = false;
    desenhar2fa();
  } catch (e) { erroBox($('t2Msg'), e); }
};

async function carregarSessoes() {
  const box = $('sessoesBox');
  if (!box) return;
  try {
    const d = await api('GET', '/api/auth/sessoes');
    const navegador = (ua) => /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
    box.innerHTML = '<table class="tbl"><thead><tr><th>Onde</th><th>Aberta</th><th>Último uso</th></tr></thead><tbody>'
      + d.sessoes.map((s) => '<tr><td>' + esc(navegador(s.navegador || '')) + ' · <span class="mono">' + esc(s.ip || '') + '</span>' + (s.atual ? ' <span class="note">(esta)</span>' : '') + '</td><td>' + dataHora(s.criada_em) + '</td><td>' + dataHora(s.usada_em) + '</td></tr>').join('')
      + '</tbody></table>' + (d.sessoes.length > 1 ? '<div class="btn-row" style="margin-top:var(--e-13)"><button class="btn btn-ghost btn-sm" data-acao="encerrarOutras">Encerrar as outras sessões</button></div>' : '');
  } catch (e) { erroBox(box, e); }
}

ACOES.encerrarOutras = async () => {
  try { await api('POST', '/api/auth/sessoes', { acao: 'encerrar_outras' }); carregarSessoes(); } catch (e) { erroBox($('sessoesBox'), e); }
};

ACOES.exportar = async (el) => {
  ocupado(el, true);
  try {
    const d = await api('GET', '/api/organizacao/exportar');
    baixar('epige-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(d, null, 2), 'application/json');
    okBox($('expMsg'), 'Arquivo gerado. A exportação ficou registrada no log.');
  } catch (e) { erroBox($('expMsg'), e); }
  ocupado(el, false);
};

/* ============================================================ plataforma */

TELAS.plataforma = async () => {
  $('main').innerHTML = cabecalho('Administração da plataforma', 'Plataforma', 'Empresas atendidas, solicitações de acesso e tetos de gasto.')
    + '<div id="platSol"></div><div id="platSinal"></div>'
    + '<form data-form="novaEmpresa" class="panel"><div class="card-t">Nova empresa</div><div class="grid2">'
    + '<div class="field"><label for="ne_empresa">Empresa</label><input type="text" id="ne_empresa" name="empresa" required maxlength="120"></div>'
    + '<div class="field"><label for="ne_email">E-mail do administrador dela</label><input type="email" id="ne_email" name="email" required maxlength="254"></div></div>'
    + '<button class="btn btn-primary" type="submit">Criar empresa e convite</button><div id="neMsg"></div></form>'
    + '<div id="platEmp" class="panel"><div class="thinking"><span class="pulse"></span> carregando</div></div>';
  carregarPlataforma();
};

async function carregarSinalizacoes() {
  try {
    const d = await api('GET', '/api/plataforma/sinalizacoes');
    const abertas = d.sinalizacoes.filter((x) => x.situacao === 'aberta').length;
    $('platSinal').innerHTML = !d.sinalizacoes.length ? '' : '<div class="panel"><div class="card-t">Respostas de IA sinalizadas · ' + abertas + ' abertas</div>'
      + d.sinalizacoes.map((x) => '<div class="finding ' + (x.situacao === 'aberta' ? 'alta' : 'ok') + '"><div class="f-top"><span class="tag ' + (x.situacao === 'aberta' ? 'alta' : 'ok') + '">' + esc(x.situacao) + '</span>'
        + '<span class="f-req">' + esc(nomeAgente(x.agente)) + ' · ' + esc(x.norma) + ' · ' + esc(x.empresa || '') + ' · ' + dataHora(x.em) + '</span></div>'
        + '<div><b>' + esc(x.motivo_rotulo) + '.</b> ' + esc(x.comentario) + '</div>'
        + (x.trecho ? '<div class="f-ev">' + esc(x.trecho.slice(0, 600)) + (x.trecho.length > 600 ? '…' : '') + '</div>' : '')
        + (x.situacao === 'aberta'
          ? '<form data-form="tratarSinal" data-id="' + esc(x.id) + '" class="btn-row" style="margin-top:var(--e-8)"><input type="text" name="tratamento" required maxlength="1000" placeholder="O que foi corrigido no agente, ou por que não procede" style="flex:1"><button class="btn btn-ghost btn-sm" type="submit">Registrar tratamento</button></form>'
          : '<div class="note">Tratamento: ' + esc(x.tratamento) + ' (' + dataHora(x.tratada_em) + ')</div>') + '</div>').join('')
      + '</div>';
  } catch (e) { erroBox($('platSinal'), e); }
}

FORMS.tratarSinal = async (f) => {
  try {
    await api('PATCH', '/api/plataforma/sinalizacoes/' + encodeURIComponent(f.dataset.id), { tratamento: campos(f).tratamento });
    carregarSinalizacoes();
  } catch (e) { erroBox($('platSinal'), e); }
};

async function carregarPlataforma() {
  carregarSinalizacoes();
  try {
    const d = await api('GET', '/api/plataforma/organizacoes');
    $('platSol').innerHTML = d.solicitacoes.length ? '<div class="panel"><div class="card-t">Solicitações de acesso</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Quem</th><th>Empresa</th><th>Mensagem</th><th>Quando</th><th></th></tr></thead><tbody>'
      + d.solicitacoes.map((s) => '<tr><td><b>' + esc(s.nome) + '</b><div class="note">' + esc(s.email) + (s.telefone ? ' · ' + esc(s.telefone) : '') + '</div></td><td>' + esc(s.empresa) + '</td><td>' + esc(s.mensagem) + '</td><td>' + dataHora(s.em) + '</td>'
        + '<td><div class="btn-row" style="margin:0"><button class="btn btn-primary btn-sm" data-acao="aceitarSolicitacao" data-id="' + esc(s.id) + '" data-empresa="' + esc(s.empresa) + '" data-email="' + esc(s.email) + '">Aceitar</button>'
        + '<button class="btn btn-ghost btn-sm" data-acao="recusarSolicitacao" data-id="' + esc(s.id) + '">Recusar</button></div></td></tr>').join('')
      + '</tbody></table></div><div id="solMsg"></div></div>' : '';
    $('platEmp').innerHTML = '<div class="card-t">Empresas</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Empresa</th><th>Pessoas</th><th>Docs</th><th>IA 30 dias</th><th>Teto/dia (R$)</th><th>Situação</th></tr></thead><tbody>'
      + d.organizacoes.map((o) => '<tr><td><b>' + esc(o.nome) + '</b><div class="note">desde ' + data(o.criada_em) + '</div></td><td class="mono">' + o.usuarios + '</td><td class="mono">' + o.documentos + '</td><td class="mono">R$ ' + brl(o.custo_30d) + '</td>'
        + '<td><input type="number" min="0" step="0.5" style="width:90px" value="' + (o.teto_diario_brl ?? '') + '" placeholder="padrão" data-muda="tetoEmpresa" data-id="' + esc(o.id) + '" aria-label="Teto de ' + esc(o.nome) + '"></td>'
        + '<td>' + (o.id === S.org.id ? 'Ativa' : '<button class="btn btn-ghost btn-sm" data-acao="alternarEmpresa" data-id="' + esc(o.id) + '" data-ativa="' + (o.ativa ? '1' : '0') + '">' + (o.ativa ? 'Desativar' : 'Reativar') + '</button>') + '</td></tr>').join('')
      + '</tbody></table></div><div id="empMsg"></div>';
  } catch (e) { erroBox($('platEmp'), e); }
}

FORMS.novaEmpresa = async (f) => {
  const btn = f.querySelector('button[type=submit]');
  ocupado(btn, true);
  try {
    const c = campos(f);
    const r = await api('POST', '/api/plataforma/organizacoes', c);
    $('neMsg').innerHTML = caixaLink(r.link, 'Convite do administrador de ' + c.empresa + ':');
    f.reset();
    carregarPlataforma();
  } catch (e) { erroBox($('neMsg'), e); }
  ocupado(btn, false);
};

ACOES.aceitarSolicitacao = async (el) => {
  try {
    const r = await api('POST', '/api/plataforma/organizacoes', { empresa: el.dataset.empresa, email: el.dataset.email, solicitacao_id: el.dataset.id });
    await carregarPlataforma();
    $('neMsg').innerHTML = caixaLink(r.link, 'Empresa ' + el.dataset.empresa + ' criada. Convite do administrador (' + el.dataset.email + '):');
  } catch (e) { erroBox($('solMsg'), e); }
};

ACOES.recusarSolicitacao = async (el) => {
  if (!confirm('Recusar esta solicitação?')) return;
  try { await api('DELETE', '/api/plataforma/solicitacoes/' + encodeURIComponent(el.dataset.id)); carregarPlataforma(); } catch (e) { erroBox($('solMsg'), e); }
};

MUDA.tetoEmpresa = async (el) => {
  try {
    await api('PATCH', '/api/plataforma/organizacoes/' + encodeURIComponent(el.dataset.id), { teto_diario_brl: el.value === '' ? null : Number(el.value) });
    okBox($('empMsg'), 'Teto atualizado.');
  } catch (e) { erroBox($('empMsg'), e); }
};

ACOES.alternarEmpresa = async (el) => {
  const ativar = el.dataset.ativa !== '1';
  if (!ativar && !confirm('Desativar a empresa? Todas as pessoas dela saem da plataforma na hora. Os dados ficam guardados.')) return;
  try { await api('PATCH', '/api/plataforma/organizacoes/' + encodeURIComponent(el.dataset.id), { ativa: ativar }); carregarPlataforma(); } catch (e) { erroBox($('empMsg'), e); }
};

/* ============================================================ início */

(async function iniciar() {
  // Tokens de convite e redefinição chegam no fragmento (#). Lidos, saem da barra
  // de endereço e do histórico do navegador.
  const frag = new URLSearchParams(location.hash.slice(1));
  S.tokenConvite = frag.get('convite');
  S.tokenRedefinir = frag.get('redefinir');
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);

  try {
    S.primeiroDisponivel = (await api('GET', '/api/auth/primeiro-acesso')).disponivel;
  } catch (e) {
    $('dot').className = 'dot down';
    $('statusTxt').textContent = 'servidor indisponível';
    $('acesso').classList.remove('hidden');
    $('acesso').innerHTML = '<div class="auth"><h2>Plataforma indisponível</h2><div class="alert alert-err">' + esc(e.message) + '</div>'
      + '<p class="note">Se você administra o servidor, confira o banco de dados (EPIGE_DB) e a variável SEGREDO — o guia está em web/README.md.</p></div>';
    return;
  }
  if (S.tokenConvite) return telaAcesso('convite');
  if (S.tokenRedefinir) return telaAcesso('redefinir');
  try {
    await entrarNaApp();
  } catch (e) {
    if (e.status && e.status !== 401) {
      telaAcesso('entrar');
      msgAcesso(e.message);
      return;
    }
    telaAcesso(S.primeiroDisponivel ? 'primeiro' : 'entrar');
  }
})();

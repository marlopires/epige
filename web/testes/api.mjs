#!/usr/bin/env node
/**
 * Testes da API, no runtime real da Cloudflare (wrangler pages dev + workerd),
 * com banco D1 local descartável e um simulador da API da Anthropic — não gasta
 * token e não precisa de chave.
 *
 *   node web/testes/api.mjs
 *
 * Precisa do wrangler: usa `npx wrangler@4` por padrão, ou o binário apontado
 * pela variável WRANGLER. Sai com código 1 se qualquer teste falhar.
 *
 * O que está coberto é o que não pode quebrar: ninguém vê dado de outra
 * empresa; papel é conferido no servidor; senha, sessão, convite, 2FA e
 * limite de tentativas funcionam; o ciclo de aprovação de documentos não pula
 * etapa; e o gasto de IA respeita o teto.
 */

import { _codigoTotpParaTeste as totp } from '../functions/_lib/cripto.js';
import { iniciarServidor, CODIGO } from './_servidor.mjs';

const srv = await iniciarServidor();
const BASE = srv.base;
const ultimaRequisicaoIA = () => srv.ultimaRequisicaoIA();
const encerrar = (codigo) => { srv.parar(); process.exit(codigo); };

/* ---------- cliente ---------- */

class Cliente {
  constructor(nome) { this.nome = nome; this.cookie = ''; }
  async req(metodo, caminho, corpo, extra = {}) {
    const headers = { origin: BASE, ...(extra.headers ?? {}) };
    if (this.cookie) headers.cookie = this.cookie;
    if (corpo !== undefined) headers['content-type'] = 'application/json';
    const r = await fetch(BASE + caminho, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    const sc = r.headers.get('set-cookie');
    if (sc) {
      const m = sc.match(/__Host-epige=([^;]*)/);
      if (m) this.cookie = m[1] ? `__Host-epige=${m[1]}` : '';
    }
    let dados = null;
    try { dados = await r.json(); } catch {}
    return { status: r.status, dados, headers: r.headers };
  }
  get(c) { return this.req('GET', c); }
  post(c, b = {}) { return this.req('POST', c, b); }
  put(c, b = {}) { return this.req('PUT', c, b); }
  patch(c, b = {}) { return this.req('PATCH', c, b); }
  del(c) { return this.req('DELETE', c); }
}

const token = (link, tipo) => link.split(`#${tipo}=`)[1];

let ok = 0;
const falhas = [];
function checar(descricao, condicao, detalhe = '') {
  if (condicao) ok++;
  else falhas.push(`${descricao}${detalhe ? ` — ${typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe)}` : ''}`);
}
const status = (descricao, r, esperado) => checar(descricao, r.status === esperado, `esperado ${esperado}, veio ${r.status} ${JSON.stringify(r.dados)}`);

const SENHA = 'uma senha longa de teste';

try {
  /* ---- 1. primeiro acesso e proteções básicas ---- */
  const dono = new Cliente('dono');
  status('primeiro acesso disponível antes de haver conta', await dono.get('/api/auth/primeiro-acesso'), 200);

  const semOrigem = await fetch(`${BASE}/api/auth/primeiro-acesso`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  checar('POST sem Origin é recusado (CSRF)', semOrigem.status === 403, semOrigem.status);
  const origemEstranha = await dono.req('POST', '/api/auth/primeiro-acesso', {}, { headers: { origin: 'https://atacante.exemplo' } });
  status('POST de outra origem é recusado (CSRF)', origemEstranha, 403);
  const tipoErrado = await fetch(`${BASE}/api/auth/primeiro-acesso`, { method: 'POST', headers: { origin: BASE, 'content-type': 'text/plain' }, body: '{}' });
  checar('corpo que não é JSON é recusado', tipoErrado.status === 415, tipoErrado.status);

  status('primeiro acesso com código errado', await dono.post('/api/auth/primeiro-acesso', { codigo: 'errado', empresa: 'EPIGE', nome: 'Dono', email: 'dono@epige.com.br', senha: SENHA }), 401);
  status('senha curta é recusada', await dono.post('/api/auth/primeiro-acesso', { codigo: CODIGO, empresa: 'EPIGE', nome: 'Dono', email: 'dono@epige.com.br', senha: 'curta' }), 400);
  const boot = await dono.post('/api/auth/primeiro-acesso', { codigo: CODIGO, empresa: 'EPIGE', nome: 'Dono', email: 'Dono@Epige.com.br', senha: SENHA });
  status('primeiro acesso cria a conta', boot, 201);
  checar('cookie de sessão é __Host, HttpOnly, Secure e SameSite=Strict',
    /__Host-epige=.+HttpOnly.*Secure.*SameSite=Strict/i.test(boot.headers.get('set-cookie') ?? ''), boot.headers.get('set-cookie'));
  status('primeiro acesso não pode ser repetido', await new Cliente('x').post('/api/auth/primeiro-acesso', { codigo: CODIGO, empresa: 'Outra', nome: 'X', email: 'x@x.com', senha: SENHA }), 409);
  const eu = await dono.get('/api/auth/eu');
  checar('dono é superadmin e admin', eu.dados?.usuario?.superadmin === true && eu.dados?.usuario?.papel === 'admin', eu.dados);
  checar('e-mail guardado em minúsculas', eu.dados?.usuario?.email === 'dono@epige.com.br', eu.dados?.usuario?.email);
  status('sem sessão, /eu responde 401', await new Cliente('anon').get('/api/auth/eu'), 401);
  checar('resposta da API traz cabeçalhos de segurança',
    eu.headers.get('x-content-type-options') === 'nosniff' && /frame-ancestors 'none'/.test(eu.headers.get('content-security-policy') ?? '') && eu.headers.get('cache-control') === 'no-store');

  /* ---- 2. empresa nova, convites e papéis ---- */
  const novaEmpresa = await dono.post('/api/plataforma/organizacoes', { empresa: 'Construtora Beta', email: 'admin@beta.com' });
  status('superadmin cria empresa com convite', novaEmpresa, 201);
  const adminB = new Cliente('adminB');
  const infoConvite = await adminB.post('/api/auth/convite', { token: token(novaEmpresa.dados.link, 'convite') });
  checar('convite mostra e-mail e empresa', infoConvite.dados?.email === 'admin@beta.com' && infoConvite.dados?.empresa === 'Construtora Beta', infoConvite.dados);
  status('cadastro pelo convite', await adminB.post('/api/auth/cadastro', { token: token(novaEmpresa.dados.link, 'convite'), nome: 'Admin Beta', senha: SENHA }), 201);
  status('convite não serve duas vezes', await new Cliente('y').post('/api/auth/cadastro', { token: token(novaEmpresa.dados.link, 'convite'), nome: 'Outro', senha: SENHA }), 404);
  status('admin comum não acessa a plataforma', await adminB.get('/api/plataforma/organizacoes'), 403);

  const convEditor = await adminB.post('/api/equipe', { email: 'editor@beta.com', papel: 'editor' });
  const convLeitor = await adminB.post('/api/equipe', { email: 'leitor@beta.com', papel: 'leitor' });
  status('admin convida editor', convEditor, 201);
  status('convite para e-mail já cadastrado é recusado', await adminB.post('/api/equipe', { email: 'dono@epige.com.br', papel: 'leitor' }), 409);
  const editor = new Cliente('editor');
  const leitor = new Cliente('leitor');
  status('editor se cadastra', await editor.post('/api/auth/cadastro', { token: token(convEditor.dados.link, 'convite'), nome: 'Editora Beta', senha: SENHA }), 201);
  status('leitor se cadastra', await leitor.post('/api/auth/cadastro', { token: token(convLeitor.dados.link, 'convite'), nome: 'Leitor Beta', senha: SENHA }), 201);
  status('editor não vê a equipe', await editor.get('/api/equipe'), 403);
  status('editor não convida', await editor.post('/api/equipe', { email: 'z@beta.com', papel: 'admin' }), 403);
  const equipeB = await adminB.get('/api/equipe');
  checar('equipe da Beta tem só gente da Beta', equipeB.dados?.usuarios?.length === 3 && equipeB.dados.usuarios.every((u) => u.email.endsWith('@beta.com')), equipeB.dados?.usuarios);
  const donoId = eu.dados.usuario.id;
  status('admin da Beta não altera usuário de outra empresa', await adminB.patch(`/api/equipe/${donoId}`, { papel: 'leitor' }), 404);
  status('admin não altera o próprio acesso', await adminB.patch(`/api/equipe/${equipeB.dados.usuarios.find((u) => u.eu).id}`, { ativo: false }), 400);

  // Admin da mesma empresa do dono da plataforma não pode tomar a conta dele.
  const convColega = await dono.post('/api/equipe', { email: 'colega@epige.com.br', papel: 'admin' });
  const colega = new Cliente('colega');
  await colega.post('/api/auth/cadastro', { token: token(convColega.dados.link, 'convite'), nome: 'Colega', senha: SENHA });
  status('admin da empresa do dono não gera nova senha para o superadmin', await colega.post(`/api/equipe/${donoId}`, { acao: 'redefinir_senha' }), 403);
  status('admin da empresa do dono não rebaixa o superadmin', await colega.patch(`/api/equipe/${donoId}`, { papel: 'leitor' }), 403);
  status('admin da empresa do dono não acessa a plataforma', await colega.get('/api/plataforma/organizacoes'), 403);

  /* ---- 3. documentos: isolamento e ciclo de aprovação ---- */
  const docDono = await dono.post('/api/documentos', { titulo: 'Política da EPIGE', tipo: 'politica', conteudo: '# Política\nTexto.' });
  status('dono cria documento', docDono, 201);
  const idA = docDono.dados.id;
  status('outra empresa não lê o documento', await adminB.get(`/api/documentos/${idA}`), 404);
  status('outra empresa não edita o documento', await adminB.put(`/api/documentos/${idA}/rascunho`, { conteudo: 'invadido' }), 404);
  status('outra empresa não aprova o documento', await adminB.post(`/api/documentos/${idA}/acao`, { acao: 'enviar' }), 404);
  status('outra empresa não lê versão do documento', await adminB.get(`/api/documentos/${idA}/versoes/1`), 404);
  const listaB = await adminB.get('/api/documentos');
  checar('lista da Beta não traz documento de outra empresa', listaB.dados?.documentos?.length === 0, listaB.dados);

  status('leitor não cria documento', await leitor.post('/api/documentos', { titulo: 'X', tipo: 'procedimento', conteudo: 'x' }), 403);
  const doc = await editor.post('/api/documentos', { titulo: 'Controle de não conformidade', tipo: 'procedimento', normas: ['iso-9001', 'pbqp-h'], conteudo: '# Procedimento\nv1', origem: 'agente:redator' });
  status('editor cria documento', doc, 201);
  checar('código automático PR-001', doc.dados?.codigo === 'PR-001', doc.dados);
  const doc2 = await editor.post('/api/documentos', { titulo: 'Outro', tipo: 'procedimento', conteudo: 'x' });
  checar('segundo procedimento vira PR-002', doc2.dados?.codigo === 'PR-002', doc2.dados);
  status('código repetido informado à mão é recusado', await editor.post('/api/documentos', { titulo: 'Dup', tipo: 'outro', codigo: 'PR-001', conteudo: 'x' }), 409);
  const id = doc.dados.id;

  checar('leitor não vê documento em elaboração', !(await leitor.get('/api/documentos')).dados.documentos.some((d) => d.id === id));
  status('leitor não abre documento em elaboração', await leitor.get(`/api/documentos/${id}`), 404);

  status('editor envia para aprovação', await editor.post(`/api/documentos/${id}/acao`, { acao: 'enviar' }), 200);
  status('não se edita versão em revisão', await editor.put(`/api/documentos/${id}/rascunho`, { conteudo: 'mudança' }), 409);
  status('editor não aprova', await editor.post(`/api/documentos/${id}/acao`, { acao: 'aprovar' }), 403);
  status('devolver exige motivo', await adminB.post(`/api/documentos/${id}/acao`, { acao: 'devolver' }), 400);
  status('admin devolve com motivo', await adminB.post(`/api/documentos/${id}/acao`, { acao: 'devolver', motivo: 'Falta o prazo de eficácia.' }), 200);

  const aberto = await editor.get(`/api/documentos/${id}`);
  checar('parecer da devolução chega a quem elaborou', aberto.dados?.versoes?.[0]?.parecer === 'Falta o prazo de eficácia.', aberto.dados?.versoes);
  const salvo = await editor.put(`/api/documentos/${id}/rascunho`, { conteudo: '# Procedimento\nv1 corrigida', editado_em: aberto.dados.aberta.editado_em });
  status('editor salva o rascunho', salvo, 200);
  status('salvar sobre versão desatualizada é recusado', await editor.put(`/api/documentos/${id}/rascunho`, { conteudo: 'atropelo', editado_em: aberto.dados.aberta.editado_em }), 409);
  await editor.post(`/api/documentos/${id}/acao`, { acao: 'enviar' });
  status('documento feito com IA não é aprovado sem declaração de revisão', await adminB.post(`/api/documentos/${id}/acao`, { acao: 'aprovar' }), 400);
  status('admin aprova com a declaração de revisão', await adminB.post(`/api/documentos/${id}/acao`, { acao: 'aprovar', revisao_confirmada: true }), 200);
  const comIA = await adminB.get(`/api/documentos/${id}`);
  checar('documento guarda a origem em IA e a declaração de revisão', comIA.dados?.documento?.apoio_ia === 'redator' && comIA.dados?.versoes?.[0]?.revisao_declarada === true, comIA.dados?.documento);
  checar('lista marca o documento feito com IA', (await adminB.get('/api/documentos')).dados.documentos.find((x) => x.id === id)?.apoio_ia === 'redator');
  status('aprovar de novo não faz nada', await adminB.post(`/api/documentos/${id}/acao`, { acao: 'aprovar' }), 409);

  const vistoLeitor = await leitor.get(`/api/documentos/${id}`);
  checar('leitor vê a versão vigente', vistoLeitor.status === 200 && vistoLeitor.dados.conteudo_vigente === '# Procedimento\nv1 corrigida', vistoLeitor.dados);

  status('revisão nova exige descrever a mudança', await editor.put(`/api/documentos/${id}/rascunho`, { conteudo: 'v2' }), 400);
  const rev = await editor.put(`/api/documentos/${id}/rascunho`, { conteudo: '# Procedimento\nv2', resumo: 'Inclui prazo de eficácia' });
  checar('revisão abre a versão 2', rev.status === 201 && rev.dados.numero === 2, rev);
  const leitorDurante = await leitor.get(`/api/documentos/${id}`);
  checar('durante a revisão o leitor segue vendo só a vigente', leitorDurante.dados.conteudo_vigente.endsWith('v1 corrigida') && leitorDurante.dados.aberta === null && leitorDurante.dados.versoes.length === 1, leitorDurante.dados);
  status('leitor não acessa o rascunho pelo histórico', await leitor.get(`/api/documentos/${id}/versoes/2`), 404);
  await editor.post(`/api/documentos/${id}/acao`, { acao: 'enviar' });
  await adminB.post(`/api/documentos/${id}/acao`, { acao: 'aprovar', motivo: 'ok', revisao_confirmada: true });
  const hist = await adminB.get(`/api/documentos/${id}`);
  checar('v2 vigente e v1 substituída, retida no histórico',
    hist.dados.documento.versao_vigente === 2 && hist.dados.versoes.find((v) => v.numero === 1)?.estado === 'substituida' && hist.dados.versoes.find((v) => v.numero === 2)?.estado === 'vigente', hist.dados.versoes);
  checar('histórico registra quem aprovou', hist.dados.versoes[0].aprovado_por === 'Admin Beta', hist.dados.versoes[0]);

  // Descartar revisão não deixa buraco na numeração.
  await editor.put(`/api/documentos/${id}/rascunho`, { conteudo: 'v3', resumo: 'teste' });
  status('editor descarta a revisão', await editor.post(`/api/documentos/${id}/acao`, { acao: 'descartar' }), 200);
  const rev3 = await editor.put(`/api/documentos/${id}/rascunho`, { conteudo: 'v3 de novo', resumo: 'teste' });
  checar('revisão seguinte volta a ser a 3', rev3.dados?.numero === 3, rev3.dados);
  await editor.post(`/api/documentos/${id}/acao`, { acao: 'descartar' });

  // Registro não é revisado.
  const reg = await editor.post('/api/documentos', { titulo: 'Relatório de auditoria interna', tipo: 'relatorio', conteudo: 'achados' });
  checar('relatório ganha código RA-001', reg.dados?.codigo === 'RA-001', reg.dados);
  await editor.post(`/api/documentos/${reg.dados.id}/acao`, { acao: 'enviar' });
  await adminB.post(`/api/documentos/${reg.dados.id}/acao`, { acao: 'aprovar' });
  status('registro aprovado não ganha revisão', await editor.put(`/api/documentos/${reg.dados.id}/rascunho`, { conteudo: 'alterado', resumo: 'x' }), 409);

  // Descartar documento nunca aprovado apaga; obsoletar exige motivo e tira do leitor.
  status('descartar documento nunca aprovado', await editor.post(`/api/documentos/${doc2.dados.id}/acao`, { acao: 'descartar' }), 200);
  status('documento descartado some', await editor.get(`/api/documentos/${doc2.dados.id}`), 404);
  status('obsoletar exige motivo', await adminB.post(`/api/documentos/${id}/acao`, { acao: 'obsoletar' }), 400);
  status('editor não obsoleta', await editor.post(`/api/documentos/${id}/acao`, { acao: 'obsoletar', motivo: 'x' }), 403);
  status('admin obsoleta', await adminB.post(`/api/documentos/${id}/acao`, { acao: 'obsoletar', motivo: 'Substituído pelo PR-010' }), 200);
  status('leitor não vê documento obsoleto', await leitor.get(`/api/documentos/${id}`), 404);
  status('obsoleto não é revisado', await editor.put(`/api/documentos/${id}/rascunho`, { conteudo: 'x', resumo: 'x' }), 409);

  /* ---- 4. IA: papel, contexto do banco, teto ---- */
  status('leitor não usa a IA', await leitor.post('/api/chat', { agente: 'consultor', norma: 'iso-9001', mensagens: [{ role: 'user', content: 'oi' }] }), 403);
  status('agente desconhecido', await editor.post('/api/chat', { agente: 'hacker', norma: 'iso-9001', mensagens: [{ role: 'user', content: 'oi' }] }), 400);
  const chat = await editor.post('/api/chat', {
    agente: 'consultor', norma: 'iso-9001',
    contexto: { nome: 'Empresa Falsa' }, // o servidor deve ignorar isto
    mensagens: [{ role: 'user', content: 'O que é 10.2?' }],
  });
  status('editor usa a IA', chat, 200);
  const sistemaIA = ultimaRequisicaoIA()?.system?.[0]?.text ?? '';
  checar('contexto vem do banco, não do navegador', sistemaIA.includes('Construtora Beta') && !sistemaIA.includes('Empresa Falsa'));
  checar('custo registrado e devolvido', chat.dados?.custo > 0 && chat.dados?.gasto_empresa_hoje > 0, chat.dados);
  await editor.post('/api/chat', {
    agente: 'consultor', norma: 'iso-9001', escopo: '10.2', demo: true,
    contexto: { nome: 'Metalúrgica Aurora' }, mensagens: [{ role: 'user', content: 'oi' }],
  });
  checar('a demonstração guiada usa a empresa-exemplo da página', (ultimaRequisicaoIA()?.system?.[0]?.text ?? '').includes('Metalúrgica Aurora'));
  status('editor sinaliza resposta com problema', await editor.post('/api/sinalizacoes', { agente: 'consultor', norma: 'iso-9001', motivo: 'referencia_legal', comentario: 'Citou uma NR que não existe.', trecho: 'NR-99' }), 201);
  status('motivo de sinalização precisa ser válido', await editor.post('/api/sinalizacoes', { agente: 'consultor', motivo: 'qualquer' }), 400);
  status('leitor não sinaliza (não usa a IA)', await leitor.post('/api/sinalizacoes', { agente: 'consultor', motivo: 'outro' }), 403);
  status('admin de empresa não vê a fila de sinalizações', await adminB.get('/api/plataforma/sinalizacoes'), 403);
  const fila = await dono.get('/api/plataforma/sinalizacoes');
  checar('plataforma recebe a sinalização com empresa e trecho', fila.dados?.sinalizacoes?.[0]?.empresa === 'Construtora Beta' && fila.dados.sinalizacoes[0].trecho === 'NR-99', fila.dados);
  status('tratamento exige descrição', await dono.patch(`/api/plataforma/sinalizacoes/${fila.dados.sinalizacoes[0].id}`, {}), 400);
  status('plataforma registra o tratamento', await dono.patch(`/api/plataforma/sinalizacoes/${fila.dados.sinalizacoes[0].id}`, { tratamento: 'Incluída regra de conferir NR na fonte oficial.' }), 200);
  const uso = await adminB.get('/api/organizacao/uso');
  checar('uso da empresa aparece no painel', uso.dados?.por_agente?.[0]?.agente === 'consultor', uso.dados);
  const orgB = novaEmpresa.dados.id;
  status('superadmin ajusta o teto da empresa', await dono.patch(`/api/plataforma/organizacoes/${orgB}`, { teto_diario_brl: 0.001 }), 200);
  status('teto da empresa bloqueia a IA', await editor.post('/api/chat', { agente: 'consultor', norma: 'iso-9001', mensagens: [{ role: 'user', content: 'oi' }] }), 429);
  status('chamada da IA sem sessão', await new Cliente('anon').post('/api/chat', { agente: 'consultor', norma: 'iso-9001', mensagens: [{ role: 'user', content: 'oi' }] }), 401);

  /* ---- 5. senha, bloqueio, redefinição, sessões ---- */
  const intruso = new Cliente('intruso');
  for (let i = 0; i < 5; i++) await intruso.post('/api/auth/entrar', { email: 'leitor@beta.com', senha: 'errada errada' });
  status('sexta tentativa é bloqueada mesmo com a senha certa', await intruso.post('/api/auth/entrar', { email: 'leitor@beta.com', senha: SENHA }), 429);
  const inexistente = await new Cliente('z').post('/api/auth/entrar', { email: 'ninguem@nada.com', senha: 'qualquer coisa' });
  const errada = await new Cliente('z').post('/api/auth/entrar', { email: 'editor@beta.com', senha: 'qualquer coisa' });
  checar('mesma mensagem para e-mail inexistente e senha errada', inexistente.dados?.erro === errada.dados?.erro && inexistente.status === 401);

  const editor2 = new Cliente('editor2');
  status('editor entra em outro navegador', await editor2.post('/api/auth/entrar', { email: 'editor@beta.com', senha: SENHA }), 200);
  status('troca de senha exige a atual', await editor.post('/api/auth/senha', { atual: 'errada', nova: 'outra senha bem longa' }), 400);
  status('editor troca a senha', await editor.post('/api/auth/senha', { atual: SENHA, nova: 'outra senha bem longa' }), 200);
  status('trocar a senha encerra as outras sessões', await editor2.get('/api/auth/eu'), 401);
  status('a sessão de quem trocou continua', await editor.get('/api/auth/eu'), 200);

  const idEditor = equipeB.dados.usuarios.find((u) => u.email === 'editor@beta.com').id;
  const redef = await adminB.post(`/api/equipe/${idEditor}`, { acao: 'redefinir_senha' });
  status('admin gera link de nova senha', redef, 201);
  status('redefinição com senha fraca não gasta o link', await new Cliente('r').post('/api/auth/redefinir', { token: token(redef.dados.link, 'redefinir'), nova: 'curta' }), 400);
  status('redefinição com o link', await new Cliente('r').post('/api/auth/redefinir', { token: token(redef.dados.link, 'redefinir'), nova: 'senha redefinida longa' }), 200);
  status('link de redefinição não serve duas vezes', await new Cliente('r').post('/api/auth/redefinir', { token: token(redef.dados.link, 'redefinir'), nova: 'mais uma senha longa' }), 400);
  status('redefinição encerra todas as sessões', await editor.get('/api/auth/eu'), 401);
  status('entra com a senha nova', await editor.post('/api/auth/entrar', { email: 'editor@beta.com', senha: 'senha redefinida longa' }), 200);

  status('sair', await editor.post('/api/auth/sair'), 200);
  status('depois de sair o cookie não vale', await editor.get('/api/auth/eu'), 401);

  /* ---- 6. 2FA ---- */
  const ini = await adminB.post('/api/auth/2fa', { acao: 'iniciar' });
  status('inicia 2FA', ini, 200);
  const chave = ini.dados.chave.replace(/\s/g, '');
  const passo = Math.floor(Date.now() / 30000);
  status('código errado não ativa', await adminB.post('/api/auth/2fa', { acao: 'confirmar', codigo: '000000' }), 400);
  status('ativa 2FA com código válido', await adminB.post('/api/auth/2fa', { acao: 'confirmar', codigo: await totp(chave, passo) }), 200);
  const semCodigo = await new Cliente('b2').post('/api/auth/entrar', { email: 'admin@beta.com', senha: SENHA });
  checar('login pede o código', semCodigo.status === 401 && semCodigo.dados?.precisa_codigo === true, semCodigo);
  const b3 = new Cliente('b3');
  status('login com o código seguinte', await b3.post('/api/auth/entrar', { email: 'admin@beta.com', senha: SENHA, codigo: await totp(chave, passo + 1) }), 200);
  status('o mesmo código não serve de novo', await new Cliente('b4').post('/api/auth/entrar', { email: 'admin@beta.com', senha: SENHA, codigo: await totp(chave, passo + 1) }), 401);

  /* ---- 7. desativação, exportação, eventos ---- */
  const idLeitor = equipeB.dados.usuarios.find((u) => u.email === 'leitor@beta.com').id;
  status('admin desativa o leitor', await adminB.patch(`/api/equipe/${idLeitor}`, { ativo: false }), 200);
  status('sessão do desativado cai na hora', await leitor.get('/api/auth/eu'), 401);

  const exp = await adminB.get('/api/organizacao/exportar');
  const bruto = JSON.stringify(exp.dados ?? {});
  checar('exportação traz documentos e versões', exp.dados?.documentos?.length >= 2 && exp.dados?.versoes?.length >= 3, exp.status);
  checar('exportação não traz senha, chave de 2FA nem token', !/pbkdf2|totp|token_hash|"senha"/.test(bruto));
  checar('exportação é anexo', /attachment/.test(exp.headers.get('content-disposition') ?? ''));
  const ev = await adminB.get('/api/organizacao/eventos');
  const acoes = new Set((ev.dados?.eventos ?? []).map((e) => e.acao));
  checar('log de auditoria registra o essencial', ['cadastro', 'convite_criado', 'documento_aprovado', 'devolvido_para_ajuste', 'documento_obsoleto', 'senha_redefinida', '2fa_ativado', 'acesso_alterado', 'login_falhou'].every((a) => acoes.has(a)), [...acoes]);
  checar('log da Beta não mostra evento de outra empresa', !(ev.dados?.eventos ?? []).some((e) => e.acao === 'plataforma_configurada'));

  /* ---- 8. solicitação de acesso e desativação de empresa ---- */
  const visitante = new Cliente('visitante');
  status('robô que preenche a armadilha recebe sucesso falso', await visitante.post('/api/auth/solicitar', { nome: 'Bot', email: 'bot@bot.com', empresa: 'Bot', site: 'http://spam' }), 201);
  status('pessoa solicita acesso', await visitante.post('/api/auth/solicitar', { nome: 'Maria', email: 'maria@gama.com', empresa: 'Gama Ltda', mensagem: 'Queremos a 9001.' }), 201);
  const plat = await dono.get('/api/plataforma/organizacoes');
  checar('solicitação aparece para o superadmin, sem a do robô', plat.dados?.solicitacoes?.length === 1 && plat.dados.solicitacoes[0].empresa === 'Gama Ltda', plat.dados?.solicitacoes);
  status('superadmin recusa a solicitação', await dono.del(`/api/plataforma/solicitacoes/${plat.dados.solicitacoes[0].id}`), 200);
  status('superadmin não desativa a própria empresa', await dono.patch(`/api/plataforma/organizacoes/${eu.dados.organizacao.id}`, { ativa: false }), 400);
  status('superadmin desativa a Beta', await dono.patch(`/api/plataforma/organizacoes/${orgB}`, { ativa: false }), 200);
  status('sessões da empresa desativada caem', await b3.get('/api/auth/eu'), 401);
  status('ninguém da empresa desativada entra', await new Cliente('c').post('/api/auth/entrar', { email: 'editor@beta.com', senha: 'senha redefinida longa' }), 403);

  /* ---- 9. páginas estáticas com cabeçalhos de segurança ---- */
  const pagina = await fetch(`${BASE}/`);
  const csp = pagina.headers.get('content-security-policy') ?? '';
  checar('página com CSP sem script inline', /script-src 'self'(;|$)/.test(csp) && !/script-src[^;]*unsafe-inline/.test(csp), csp);
  checar('página com HSTS e proteção contra moldura', /max-age=/.test(pagina.headers.get('strict-transport-security') ?? '') && /frame-ancestors 'none'/.test(csp));
} catch (e) {
  falhas.push(`exceção no teste: ${e.stack ?? e}`);
}

console.log(`\n${ok} verificações passaram, ${falhas.length} falharam.`);
for (const f of falhas) console.log(`  ✗ ${f}`);
if (falhas.length && process.env.MOSTRAR_LOG) console.log(srv.log().slice(-4000));
encerrar(falhas.length ? 1 : 0);

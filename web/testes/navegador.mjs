#!/usr/bin/env node
/**
 * Teste de ponta a ponta no navegador: a interface inteira, clicando como uma
 * pessoa clicaria, contra o servidor local (ver _servidor.mjs).
 *
 *   node web/testes/navegador.mjs
 *
 * Precisa do Playwright com Chromium (`npm i -D playwright` e
 * `npx playwright install chromium`). Se o Chromium estiver em outro lugar,
 * aponte com CHROMIUM=/caminho/do/chrome. Screenshots vão para web/testes/telas/.
 *
 * Além do fluxo, confere duas coisas que só o navegador mostra: nenhuma
 * violação da política de segurança (CSP) e nenhuma rolagem horizontal no celular.
 */

import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { iniciarServidor, CODIGO } from './_servidor.mjs';
import { _codigoTotpParaTeste as totp } from '../functions/_lib/cripto.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const TELAS = join(dirname(fileURLToPath(import.meta.url)), 'telas');
mkdirSync(TELAS, { recursive: true });

const srv = await iniciarServidor();
const navegador = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});

let ok = 0;
const falhas = [];
const checar = (d, c, det = '') => (c ? ok++ : falhas.push(d + (det ? ` — ${typeof det === 'string' ? det : JSON.stringify(det)}` : '')));

async function novaPagina(largura = 1400) {
  const ctx = await navegador.newContext({ viewport: { width: largura, height: 900 } });
  const p = await ctx.newPage();
  p.violacoes = [];
  p.errosJs = [];
  await p.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
  });
  p.on('pageerror', (e) => p.errosJs.push(String(e)));
  // Impressão em navegador sem tela: só registra que foi pedida.
  await p.addInitScript(() => { window.print = () => { window.__impresso = true; }; });
  return p;
}

const tela = (p, nome) => p.screenshot({ path: join(TELAS, `${nome}.png`), fullPage: true });
const esperarTexto = (p, texto) => p.getByText(texto, { exact: false }).filter({ visible: true }).first().waitFor({ timeout: 10_000 });
const semRolagemLateral = (p) => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const SENHA = 'uma senha longa de teste';

try {
  /* ---- primeiro acesso ---- */
  const dono = await novaPagina();
  await dono.goto(srv.base + '/');
  await esperarTexto(dono, 'Primeiro acesso');
  await tela(dono, '01-primeiro-acesso');
  await dono.fill('#f_codigo', CODIGO);
  await dono.fill('#f_empresa', 'Metalúrgica Aurora');
  await dono.fill('#f_nome', 'Marlo');
  await dono.fill('#f_email', 'marlo@aurora.com');
  await dono.fill('#f_senha', SENHA);
  await dono.fill('#f_senha2', SENHA);
  checar('primeiro acesso mostra o aceite com links para termos, privacidade e IA', (await dono.locator('.aceite a').count()) === 3);
  await dono.check('#f_aceite');
  await dono.click('button:has-text("Criar conta")');
  await esperarTexto(dono, 'Quem é a empresa?');
  const rail = await dono.locator('#rail').innerText();
  checar('administrador vê ferramentas de IA e toda a gestão', ['Consultor', 'Auditoria simulada', 'Documentos', 'Equipe', 'Log de auditoria', 'Plataforma'].every((t) => rail.includes(t)), rail);

  /* ---- contexto da empresa ---- */
  await dono.fill('#e_atividade', 'Usinagem de peças automotivas');
  await dono.selectOption('#e_porte', { index: 2 });
  await dono.click('button:has-text("Salvar contexto")');
  await esperarTexto(dono, 'Contexto salvo');
  checar('resumo da empresa atualizado', (await dono.locator('#ctxResumo').innerText()).includes('Usinagem'));

  /* ---- consultor → salvar como registro ---- */
  await dono.click('#rail button:has-text("Consultor")');
  // A primeira pergunta falha: o erro aparece na conversa e a página continua de pé.
  await dono.route('**/api/chat', (r) => (r.request().method() === 'POST'
    ? r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ erro: 'IA indisponível no momento.' }) })
    : r.continue()), { times: 1 });
  await dono.fill('#pergunta', 'Pergunta que vai falhar');
  await dono.click('#btnGo');
  await esperarTexto(dono, 'IA indisponível no momento.');
  checar('erro da IA na primeira pergunta aparece e libera o botão', !(await dono.locator('#btnGo').isDisabled()));
  await dono.fill('#pergunta', 'O que o 10.2 exige?');
  await dono.click('#btnGo');
  await esperarTexto(dono, 'Salvar a conversa como registro');
  checar('custo da chamada aparece no medidor', (await dono.locator('#mCusto').innerText()) !== '0,0000');
  checar('medidor mostra o teto da empresa', (await dono.locator('#meterSub').innerText()).includes('teto diário'));
  await dono.click('button:has-text("Sinalizar problema nesta resposta")');
  await dono.selectOption('#sn_motivo', 'requisito_inexistente');
  await dono.fill('#sn_comentario', 'Teste de sinalização.');
  await dono.click('button:has-text("Enviar sinalização")');
  await esperarTexto(dono, 'A sinalização foi registrada');
  // Duas sugestões no mesmo instante: só uma pergunta sai, e o histórico não embaralha.
  const antes = await dono.locator('.msg.user').count();
  await dono.evaluate(() => { const c = document.querySelectorAll('.suggest .chip'); c[0].click(); c[1].click(); });
  await esperarTexto(dono, 'Salvar a conversa como registro');
  await dono.locator('.msg.bot .thinking').waitFor({ state: 'detached', timeout: 10_000 });
  checar('pergunta repetida durante a espera não sai duas vezes', (await dono.locator('.msg.user').count()) === antes + 1);
  await dono.fill('#pergunta', 'E a ação corretiva?');
  await dono.click('#btnGo');
  await esperarTexto(dono, 'Salvar a conversa como registro');
  await dono.click('button:has-text("Salvar a conversa como registro")');
  await dono.click('button:has-text("Salvar como rascunho")');
  await esperarTexto(dono, 'Salvo como');
  checar('registro recebe código RG-001', (await dono.locator('#salvarDoc').innerText()).includes('RG-001'));

  /* ---- resposta paga não some quando a pessoa troca de tela ---- */
  await dono.click('#rail button:has-text("Diagnóstico inicial")');
  await dono.click('#btnGo');
  await esperarTexto(dono, 'Salvar em documentos');
  await dono.click('#rail button:has-text("Empresa")');
  await dono.click('#rail button:has-text("Diagnóstico inicial")');
  checar('resultado da ferramenta continua ao voltar para ela', await dono.locator('#saida button:has-text("Salvar em documentos")').isVisible());

  /* ---- auditoria combinada → salvar relatório ---- */
  await dono.click('#rail button:has-text("Auditoria simulada")');
  await dono.click('.combo button:has-text("ISO 14001")');
  checar('eyebrow mostra a auditoria combinada', (await dono.locator('#eyebrow').innerText()).includes('ISO 9001 + ISO 14001'));
  await dono.fill('#entrada', 'Procedimento de tratamento de não conformidade...');
  await dono.click('#btnGo');
  await esperarTexto(dono, 'Relatório de auditoria interna');
  // "requisito 10.2" na resposta vira link para o comentário — da norma principal da sessão (9001), que tem o item.
  await dono.locator('#saida .ref-item').first().click();
  await dono.locator('#gaveta:not(.hidden) .nv-campo').first().waitFor({ timeout: 10_000 });
  checar('item citado na resposta abre o comentário na gaveta', (await dono.locator('#gavetaTitulo').innerText()).startsWith('10.2') && (await dono.locator('#gavetaNorma').innerText()).includes('ISO 9001'));
  await dono.keyboard.press('Escape');
  checar('Esc fecha a gaveta', await dono.locator('#gaveta').isHidden());
  await dono.click('button:has-text("Salvar em documentos")');
  checar('relatório de auditoria sugere o tipo certo', (await dono.locator('#sd_tipo').inputValue()) === 'relatorio');
  await dono.click('button:has-text("Salvar como rascunho")');
  await esperarTexto(dono, 'RA-001');

  /* ---- documento: do rascunho à vigência ---- */
  await dono.click('button:has-text("Abrir o documento")');
  await esperarTexto(dono, 'Histórico de versões');
  await dono.fill('#rs_conteudo', '# Relatório\nConteúdo revisado pelo auditor líder.');
  await dono.click('button:has-text("Salvar e enviar para aprovação")');
  await esperarTexto(dono, 'Aprovar e tornar vigente');
  checar('aviso de que quem aprova também elaborou', (await dono.locator('main').innerText()).includes('Você elaborou esta versão'));
  checar('aprovação de documento feito com IA mostra a declaração de revisão', await dono.locator('#dc_revisao').isVisible());
  await dono.click('button:has-text("Aprovar e tornar vigente")');
  await esperarTexto(dono, 'Marque a declaração de revisão');
  await dono.check('#dc_revisao');
  await dono.click('button:has-text("Aprovar e tornar vigente")');
  await esperarTexto(dono, 'Imprimir vigente');
  checar('documento vira vigente', (await dono.locator('main .badge').first().innerText()).toLowerCase().includes('vigente'));
  checar('relatório não oferece revisão (é registro)', !(await dono.locator('button:has-text("Abrir revisão")').count()));
  checar('documento mostra a origem em IA e a revisão declarada', (await dono.locator('main dl').innerText()).includes('revisão humana declarada'));
  await dono.click('button:has-text("Imprimir vigente")');
  checar('impressão sai com identificação e aviso de cópia não controlada',
    (await dono.evaluate(() => window.__impresso === true)) && (await dono.locator('#impressao').innerText()).includes('Cópia não controlada'));
  checar('impressão declara o apoio de IA e quem revisou', (await dono.locator('#impressao').innerText()).includes('elaborado com apoio de IA'));
  await dono.evaluate(() => document.body.classList.remove('imprimindo'));
  await tela(dono, '02-documento-vigente');

  /* ---- procedimento novo, revisão e histórico ---- */
  await dono.click('#rail button:has-text("Documentos")');
  await dono.click('button:has-text("Novo documento")');
  await dono.fill('#nd_titulo', 'Controle de informação documentada');
  await dono.fill('#nd_conteudo', '# Objetivo\nControlar documentos.');
  await dono.click('button:has-text("Criar rascunho")');
  await esperarTexto(dono, 'Salvar e enviar para aprovação');
  await dono.click('button:has-text("Salvar e enviar para aprovação")');
  await esperarTexto(dono, 'Devolver para ajuste');
  await dono.click('button:has-text("Devolver para ajuste")');
  await esperarTexto(dono, 'Escreva o parecer');
  await dono.fill('#dc_motivo', 'Incluir quem aprova cada tipo de documento.');
  await dono.click('button:has-text("Devolver para ajuste")');
  await esperarTexto(dono, 'Devolvido para ajuste');
  await dono.click('button:has-text("Salvar e enviar para aprovação")');
  await esperarTexto(dono, 'Aprovar e tornar vigente');
  await dono.click('button:has-text("Aprovar e tornar vigente")');
  await esperarTexto(dono, 'Abrir revisão');
  await dono.click('button:has-text("Abrir revisão")');
  await dono.fill('#nr_resumo', 'Inclui matriz de aprovação');
  await dono.click('button:has-text("Abrir revisão a partir da vigente")');
  await esperarTexto(dono, 'O que muda nesta revisão');
  await dono.fill('#rs_conteudo', '# Objetivo\nControlar documentos.\n# Aprovação\nMatriz por tipo.');
  await dono.click('button:has-text("Salvar e enviar para aprovação")');
  await dono.click('button:has-text("Aprovar e tornar vigente")');
  await esperarTexto(dono, 'Substituída');
  await tela(dono, '03-historico-de-versoes');
  await dono.click('#rail button:has-text("Documentos")');
  await esperarTexto(dono, 'PR-001');
  checar('lista mostra os documentos', (await dono.locator('#listaDocs').innerText()).includes('PR-001'));
  await dono.fill('#fBusca', 'relat');
  checar('busca filtra a lista', !(await dono.locator('#listaDocs').innerText()).includes('PR-001'));
  await tela(dono, '04-lista-de-documentos');

  /* ---- equipe: convite de editor e de leitor ---- */
  await dono.click('#rail button:has-text("Equipe")');
  await dono.fill('#cv_email', 'leitor@aurora.com');
  await dono.selectOption('#cv_papel', 'leitor');
  await dono.click('button:has-text("Gerar convite")');
  await esperarTexto(dono, 'Convite para leitor@aurora.com');
  const linkLeitor = await dono.locator('#cvMsg .link-box span').innerText();
  checar('link de convite leva o token no fragmento', linkLeitor.includes('/#convite='), linkLeitor);
  await tela(dono, '05-equipe');

  const leitor = await novaPagina(390);
  await leitor.goto(linkLeitor);
  await esperarTexto(leitor, 'Você foi convidado');
  checar('token sai da barra de endereço', !leitor.url().includes('convite='), leitor.url());
  await leitor.fill('#f_nome', 'Leitor Aurora');
  await leitor.fill('#f_senha', SENHA);
  await leitor.fill('#f_senha2', SENHA);
  await leitor.check('#f_aceite');
  await leitor.click('button:has-text("Criar meu acesso")');
  await esperarTexto(leitor, 'Os documentos vigentes');
  const railLeitor = await leitor.locator('#rail').innerText();
  checar('leitor não vê ferramentas de IA nem administração', !railLeitor.includes('Consultor') && !railLeitor.includes('Equipe') && railLeitor.includes('Documentos'), railLeitor);
  await esperarTexto(leitor, 'PR-001');
  checar('leitor vê documento vigente', (await leitor.locator('#listaDocs').innerText()).includes('PR-001'));
  checar('celular: lista de documentos sem rolagem lateral', await semRolagemLateral(leitor));
  checar('celular: conteúdo à vista e menu recolhido no botão', (await leitor.locator('main').isVisible()) && !(await leitor.locator('#rail').isVisible())
    && (await leitor.locator('#btnMenu').innerText()).includes('Documentos'));
  await tela(leitor, '06-celular-leitor');
  await leitor.click('#btnMenu');
  checar('celular: menu abre no lugar do conteúdo', (await leitor.locator('#rail').isVisible()) && !(await leitor.locator('main').isVisible()));
  await leitor.click('#rail button:has-text("Minha conta")');
  await esperarTexto(leitor, 'Trocar a senha');
  checar('celular: escolher uma tela fecha o menu', !(await leitor.locator('#rail').isVisible()) && (await leitor.locator('#btnMenu').getAttribute('aria-expanded')) === 'false');
  await leitor.click('#btnMenu');
  await leitor.click('#rail [data-id="normativa"]');
  await leitor.locator('#nvLista details').first().waitFor({ timeout: 10_000 });
  checar('normativa abre na norma da sessão', (await leitor.locator('#nvRef').inputValue()) === 'iso-9001');
  await leitor.selectOption('#nvRef', 'iso-14001');
  await leitor.locator('#nvLista details').first().waitFor({ timeout: 10_000 });
  await leitor.fill('#nvBusca', 'emergência');
  checar('leitor consulta a normativa e a busca filtra', (await leitor.locator('#nvLista details').count()) >= 1 && (await leitor.locator('#nvLista').innerText()).includes('8.2'));
  checar('celular: normativa sem rolagem lateral', await semRolagemLateral(leitor));
  await leitor.click('#btnMenu');
  await leitor.click('#rail button:has-text("Documentos")');
  await leitor.click('#listaDocs tr:has-text("PR-001")');
  await esperarTexto(leitor, 'Histórico de versões');
  checar('leitor não vê botões de edição', !(await leitor.locator('button:has-text("Abrir revisão")').count()) && !(await leitor.locator('button:has-text("Tornar obsoleto")').count()));
  checar('leitor vê só a versão vigente no histórico', (await leitor.locator('.tbl tbody tr').count()) === 1);

  /* ---- 2FA e novo login ---- */
  await dono.click('#rail button:has-text("Minha conta")');
  await dono.click('button[data-acao="iniciar2fa"]');
  await esperarTexto(dono, 'Digite o código de 6 dígitos');
  const chave = (await dono.locator('#box2fa .link-box span').innerText()).replace(/\s/g, '');
  const passo = Math.floor(Date.now() / 30000);
  await dono.fill('#f_codigo', await totp(chave, passo));
  await dono.click('button:has-text("Confirmar e ativar")');
  await esperarTexto(dono, 'Ativa.');
  await tela(dono, '07-minha-conta');
  await dono.click('button[data-acao="sair"]');
  await esperarTexto(dono, 'Você saiu');
  await dono.fill('#f_email', 'marlo@aurora.com');
  await dono.fill('#f_senha', SENHA);
  await dono.click('button:has-text("Entrar")');
  await esperarTexto(dono, 'Código do aplicativo autenticador');
  await dono.fill('#f_codigo', await totp(chave, passo + 1));
  await dono.click('button:has-text("Entrar")');
  await esperarTexto(dono, 'Diagnóstico inicial');
  checar('login com 2FA entra na plataforma', await dono.locator('#shell').isVisible());

  /* ---- log e plataforma ---- */
  await dono.click('#rail button:has-text("Log de auditoria")');
  await esperarTexto(dono, 'Aprovou documento');
  checar('log mostra aprovação e 2FA', (await dono.locator('#evBox').innerText()).includes('Ativou 2FA'));
  await dono.click('#rail button:has-text("Plataforma")');
  await dono.locator('#platEmp table').waitFor({ timeout: 10_000 });
  await dono.locator('#platSinal .finding').first().waitFor({ timeout: 10_000 });
  checar('plataforma mostra a resposta sinalizada', (await dono.locator('#platSinal').innerText()).toLowerCase().includes('1 abertas'));
  checar('plataforma lista a empresa', (await dono.locator('#platEmp').innerText()).includes('Metalúrgica Aurora'));

  /* ---- demonstração ---- */
  await dono.goto(srv.base + '/demo/');
  await esperarTexto(dono, 'Quem é a empresa?');
  checar('demo abre para quem tem sessão', await dono.locator('.shell').isVisible());
  const anonimo = await novaPagina();
  await anonimo.goto(srv.base + '/demo/');
  await esperarTexto(anonimo, 'Entrar na plataforma');
  checar('demo sem sessão mostra o portão', await anonimo.locator('#gate').isVisible());

  /* ---- solicitação de acesso pela tela ---- */
  await anonimo.goto(srv.base + '/');
  await anonimo.click('button:has-text("solicitar")');
  await anonimo.fill('#f_nome', 'Joana');
  await anonimo.fill('#f_email', 'joana@gama.com');
  await anonimo.fill('#f_empresa', 'Gama Engenharia');
  await anonimo.click('button:has-text("Enviar solicitação")');
  await esperarTexto(anonimo, 'Solicitação enviada');
  await tela(anonimo, '08-solicitacao');

  /* ---- páginas públicas ---- */
  await anonimo.goto(srv.base + '/ia/');
  await esperarTexto(anonimo, 'Como a IA da EPIGE funciona');
  checar('página de transparência da IA mostra o fornecedor e a confiança por norma', (await anonimo.locator('main').innerText()).includes('Anthropic'));
  await anonimo.goto(srv.base + '/privacidade/');
  checar('política de privacidade mostra versão e base legal', (await anonimo.locator('.nota-versao').count()) === 1 && (await anonimo.locator('main').innerText()).includes('Marco Civil'));

  /* ---- segurança da página ---- */
  for (const [nome, p] of [['dono', dono], ['leitor', leitor], ['anônimo', anonimo]]) {
    const csp = await p.evaluate(() => window.__csp);
    checar(`nenhuma violação de CSP (${nome})`, !csp.length, csp);
    checar(`nenhum erro de JavaScript (${nome})`, !p.errosJs.length, p.errosJs);
  }
} catch (e) {
  falhas.push(`exceção no teste: ${e.stack ?? e}`);
}

await navegador.close();
srv.parar();
console.log(`\n${ok} verificações passaram, ${falhas.length} falharam. Telas em web/testes/telas/.`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);

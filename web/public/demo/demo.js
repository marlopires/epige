'use strict';
/* Demonstração guiada do ciclo do requisito 10.2 — script da página /demo/. */
const S = {perfil:null, historico:[], procedimento:null, formulario:null, auditoria:null, custo:0, chamadas:[]};
const PRECO = {in:2.00, out:10.00, cacheRead:0.20};
const CAMBIO = 5.20;

const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const brl = (v,d=4) => v.toLocaleString('pt-BR',{minimumFractionDigits:d, maximumFractionDigits:d});

function md(t){
  let h = esc(t);
  h = h.replace(/^#{3}\s+(.+)$/gm,'<h4>$1</h4>').replace(/^#{1,2}\s+(.+)$/gm,'<h3>$1</h3>');
  h = h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  h = h.replace(/^\s*[-•]\s+(.+)$/gm,'<li>$1</li>');
  h = h.replace(/^\s*\d+[.)]\s+(.+)$/gm,'<li>$1</li>');
  h = h.replace(/(<li>[\s\S]*?<\/li>)/g, m => '<ul>'+m+'</ul>').replace(/<\/ul>\s*<ul>/g,'');
  return h.split(/\n{2,}/).map(b => {
    b = b.trim();
    if(!b) return '';
    return /^<(h3|h4|ul)/.test(b) ? b : '<p>'+b.replace(/\n/g,'<br>')+'</p>';
  }).join('');
}

function registrar(rotulo, d){
  S.custo += d.custo || 0;
  S.chamadas.push({rotulo:rotulo, tokens:d.tokens || 0, custo:d.custo || 0});
  $('mCusto').textContent = brl(S.custo);
  $('ledger').innerHTML = S.chamadas.map(function(x){
    return '<div class="ledger-row"><span>'+esc(x.rotulo)+'</span><b>R$ '+brl(x.custo)+'</b></div>';
  }).join('');
  projetar();
}

function projetar(){
  if(!S.custo) return;
  const planos = [['Consultor','R$ 89',89],['Implantação','R$ 279',279],['Empresarial','R$ 1.490',1490]];
  const linhas = planos.map(function(p){
    const orcamento = p[2]*0.885*0.45;
    return '<div class="ledger-row" style="color:var(--muted)"><span>'+p[0]+' · '+p[1]+
      '</span><b style="color:var(--ink)">'+Math.floor(orcamento/S.custo)+' ciclos</b></div>';
  }).join('');
  $('proj').innerHTML = '<div style="font-family:var(--mono);font-size:11px">'+linhas+
    '</div><div style="margin-top:9px;font-size:11.5px">Ciclos completos como este que cabem no orçamento de IA de cada plano, mantendo a margem do modelo de custo.</div>';
}

async function chamar(agente, mensagens, rotulo){
  const r = await fetch("/api/chat", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    credentials:"same-origin",
    // demo:true faz o servidor usar a empresa-exemplo desta página, não a da conta.
    body: JSON.stringify({agente:agente, norma:'iso-9001', escopo:'10.2', demo:true,
                          mensagens:mensagens, contexto:S.perfil})
  });
  if(r.status===401){ mostrarPortao('Sua sessão expirou. Entre de novo para continuar.'); throw new Error('Sessão expirada.'); }
  const d = await r.json().catch(function(){ return {erro:"Resposta ilegível do servidor."}; });
  if(!r.ok) throw new Error(d.erro || ("O servidor respondeu com status "+r.status+"."));
  registrar(rotulo, d);
  return d.texto;
}

function extrairJSON(t){
  const limpo = t.replace(/```json|```/g,'').trim();
  const i = limpo.indexOf('{'), f = limpo.lastIndexOf('}');
  if(i<0 || f<0) throw new Error("O agente não devolveu dados estruturados.");
  return JSON.parse(limpo.slice(i,f+1));
}

/* Acesso: a demonstração usa a mesma conta da plataforma. Sem sessão, mostra o
   portão com o link de entrada; leitor não usa IA, então também não passa. */
function mostrarPortao(texto){
  $('dot').className = 'dot down';
  $('statusTxt').textContent = 'entre na plataforma';
  if(texto) $('gateTxt').textContent = texto;
  $('gate').classList.remove('hidden');
  document.querySelector('.shell').classList.add('hidden');
}

(async function(){
  try{
    const r = await fetch('/api/auth/eu', {credentials:'same-origin'});
    if(r.status===401) return mostrarPortao();
    const d = await r.json();
    if(!r.ok) return mostrarPortao(d.erro || 'O servidor não está disponível.');
    if(d.usuario.papel==='leitor') return mostrarPortao('A demonstração usa IA, e o seu papel é de leitor. Peça ao administrador da sua empresa o papel de editor.');
    $('dot').className = 'dot live';
    $('statusTxt').textContent = 'IA ao vivo · ' + d.usuario.nome;
    $('gate').classList.add('hidden');
    document.querySelector('.shell').classList.remove('hidden');
  }catch(e){ mostrarPortao('Sem conexão com o servidor.'); }
})();

/* Nenhum manipulador inline: os botões declaram data-acao e este ouvinte despacha. */
const ACOES = {
  go: function(el){ go(+el.dataset.n); },
  salvarPerfil: function(){ salvarPerfil(); },
  perguntarChip: function(el){ perguntar(el.textContent); },
  perguntar: function(){ perguntar(); },
  gerarProcedimento: function(){ gerarProcedimento(); },
  copiarProc: function(){ copiarProc(); },
  gerarFormulario: function(){ gerarFormulario(); },
  auditar: function(){ auditar(); },
  testarImparcialidade: function(){ testarImparcialidade(); },
  analisarLacuna: function(){ analisarLacuna(); },
};
document.addEventListener('click', function(e){
  const el = e.target.closest('[data-acao]');
  if(!el || el.disabled || !Object.prototype.hasOwnProperty.call(ACOES, el.dataset.acao)) return;
  e.preventDefault();
  ACOES[el.dataset.acao](el);
});

function go(n){
  for(let i=0;i<=6;i++){ const el=$('s'+i); if(el) el.classList.toggle('hidden', i!==n); }
  document.querySelectorAll('.step').forEach(function(b){
    const s = +b.dataset.s;
    b.classList.toggle('on', s===n);
    b.classList.toggle('done', s<n && !b.disabled);
  });
  if(n===6) montarFechamento();
  window.scrollTo({top:0, behavior:'smooth'});
}

function salvarPerfil(){
  S.perfil = {
    nome: $('e_nome').value.trim() || 'Empresa exemplo',
    atividade: $('e_ativ').value.trim() || 'não informada',
    porte: $('e_porte').value,
    nivel: $('e_nivel').value,
    situacao: $('e_sit').value.trim() || 'não informada'
  };
  [1,2,3,4,5,6].forEach(function(n){
    const b = document.querySelector('.step[data-s="'+n+'"]');
    if(b) b.disabled = false;
  });
  go(1);
}

function pensando(box, msg){
  box.innerHTML = '<div class="thinking"><span class="pulse"></span><span class="pulse"></span><span class="pulse"></span> '+esc(msg)+'</div>';
}
function erro(box, e){
  box.innerHTML = '<div class="alert alert-err"><b>Não foi possível concluir.</b><br>'+esc(e.message||e)+'</div>';
}

async function perguntar(texto){
  const q = (texto || $('pergunta').value).trim();
  if(!q) return;
  $('pergunta').value = '';
  $('btnAsk').disabled = true;
  const th = $('thread');
  th.insertAdjacentHTML('beforeend', '<div class="msg user">'+esc(q)+'</div>');
  const id = 'b'+Date.now();
  th.insertAdjacentHTML('beforeend', '<div class="msg bot" id="'+id+'"><div class="who">Consultor 10.2</div><div class="thinking"><span class="pulse"></span><span class="pulse"></span><span class="pulse"></span> consultando</div></div>');
  th.lastElementChild.scrollIntoView({behavior:'smooth', block:'nearest'});
  try{
    S.historico.push({role:'user', content:q});
    const resp = await chamar('consultor', S.historico, 'Consulta');
    S.historico.push({role:'assistant', content:resp});
    $(id).innerHTML = '<div class="who">Consultor 10.2</div>'+md(resp);
  }catch(e){
    $(id).innerHTML = '<div class="who">Consultor 10.2</div><div class="alert alert-err" style="margin:0">'+esc(e.message)+'</div>';
    S.historico.pop();
  }
  $('btnAsk').disabled = false;
}

async function gerarProcedimento(){
  const box = $('procBox'); $('btnProc').disabled = true;
  pensando(box, 'redigindo o procedimento');
  try{
    const t = await chamar('redator', [{role:'user', content:'Redija o procedimento para '+S.perfil.nome+'.'}], 'Procedimento');
    S.procedimento = t;
    box.innerHTML = '<div class="doc"><div class="doc-head">'
      + '<div><h3 style="margin:0">Procedimento — Não conformidade e ação corretiva</h3>'
      + '<div class="doc-code">PRO-QUA-001 · rev. 00 · '+esc(S.perfil.nome)+'</div></div>'
      + '<span class="tag conformidade">gerado</span></div>'+md(t)+'</div>'
      + '<p class="note">Documento gerado do zero, sem modelo pré-pronto. Requer revisão e aprovação interna antes de entrar em vigor.</p>';
    $('btnProcCopy').disabled = false;
  }catch(e){ erro(box, e); }
  $('btnProc').disabled = false;
}

function copiarProc(){
  if(!S.procedimento) return;
  navigator.clipboard.writeText(S.procedimento).then(function(){
    const b = $('btnProcCopy'); const t = b.textContent;
    b.textContent = 'Copiado'; setTimeout(function(){ b.textContent = t; }, 1600);
  });
}

async function gerarFormulario(){
  const box = $('formBox');
  if(!S.procedimento){ box.innerHTML = '<div class="alert alert-warn">Gere o procedimento na etapa 3 primeiro — o formulário é derivado dele.</div>'; return; }
  $('btnForm').disabled = true;
  pensando(box, 'definindo os campos do registro');
  try{
    const t = await chamar('formulario', [{role:'user', content:'Procedimento:\n\n'+S.procedimento}], 'Formulário');
    const f = extrairJSON(t); S.formulario = f;
    const secoes = (f.secoes||[]).map(function(s){
      const campos = (s.campos||[]).map(function(c){
        const req = c.obrigatorio ? ' <span class="req">*</span>' : '';
        let ctrl;
        if(c.tipo==='area') ctrl = '<textarea placeholder="—"></textarea>';
        else if(c.tipo==='selecao') ctrl = '<select>'+(c.opcoes||[]).map(function(o){return '<option>'+esc(o)+'</option>';}).join('')+'</select>';
        else if(c.tipo==='data') ctrl = '<input type="text" placeholder="dd/mm/aaaa">';
        else ctrl = '<input type="text" placeholder="—">';
        return '<div class="field"><label>'+esc(c.rotulo)+req+'</label>'+ctrl+'</div>';
      }).join('');
      return '<div class="formsec"><div class="formsec-t">'+esc(s.nome)+'</div>'+campos+'</div>';
    }).join('');
    box.innerHTML = '<div class="doc"><div class="doc-head">'
      + '<div><h3 style="margin:0">'+esc(f.titulo||'Registro de Não Conformidade')+'</h3>'
      + '<div class="doc-code">'+esc(f.codigo||'FOR-QUA-001')+' · derivado do PRO-QUA-001</div></div>'
      + '<span class="tag conformidade">preenchível</span></div>'+secoes+'</div>'
      + '<p class="note">Formulário derivado do procedimento gerado na etapa anterior — não é um modelo genérico de banco de dados.</p>';
  }catch(e){ erro(box, e); }
  $('btnForm').disabled = false;
}


async function auditar(){
  const box = $('audBox');
  if(!S.procedimento){ box.innerHTML = '<div class="alert alert-warn">Não há o que auditar. Gere o procedimento na etapa 3.</div>'; return; }
  $('btnAud').disabled = true;
  pensando(box, 'auditando o procedimento');
  try{
    const t = await chamar('auditor', [{role:'user', content:'Documento auditado:\n\n'+S.procedimento}], 'Auditoria');
    const a = extrairJSON(t); S.auditoria = a;
    const rotulo = {conformidade:'Conformidade', oportunidade:'Oportunidade de melhoria', nao_conformidade:'Não conformidade'};
    const cont = {conformidade:0, oportunidade:0, nao_conformidade:0};
    const itens = (a.achados||[]).map(function(f){
      const c = cont.hasOwnProperty(f.classificacao) ? f.classificacao : 'oportunidade';
      cont[c]++;
      return '<div class="finding '+c+'"><div class="f-top">'
        + '<span class="tag '+c+'">'+rotulo[c]+'</span>'
        + '<span class="f-req">requisito '+esc(f.requisito||'10.2')+'</span></div>'
        + '<div>'+esc(f.constatacao||'')+'</div>'
        + '<div class="f-ev"><b>Evidência:</b> '+esc(f.evidencia||'—')+'</div></div>';
    }).join('');
    box.innerHTML = '<div class="doc-head"><div><h3 style="margin:0">Relatório de auditoria interna</h3>'
      + '<div class="doc-code">AUD-001 · escopo: requisito 10.2 · documento PRO-QUA-001</div></div>'
      + '<div class="f-req">'+cont.nao_conformidade+' NC · '+cont.oportunidade+' OM · '+cont.conformidade+' C</div></div>'
      + itens
      + '<div class="panel" style="margin:14px 0 0; background:#F7F9FC; box-shadow:none">'
      + '<div class="card-t" style="margin-bottom:6px">Conclusão do auditor</div>'
      + '<div style="font-size:14px">'+esc(a.conclusao||'')+'</div></div>';
    $('btnImp').disabled = false;
  }catch(e){ erro(box, e); }
  $('btnAud').disabled = false;
}

async function testarImparcialidade(){
  const box = $('impBox'); box.classList.remove('hidden'); $('btnImp').disabled = true;
  const pedido = 'Reescreva o procedimento corrigindo as não conformidades que você apontou.';
  pensando(box, 'aguardando o auditor');
  try{
    const t = await chamar('auditor_base', [
      {role:'user', content:'Documento auditado:\n\n'+S.procedimento},
      {role:'assistant', content:'Auditoria concluída. Achados registrados no relatório.'},
      {role:'user', content:pedido}
    ], 'Teste de guardrail');
    box.innerHTML = '<div class="msg user" style="max-width:100%;margin-bottom:12px">'+esc(pedido)+'</div>'
      + '<div class="msg bot" style="max-width:100%"><div class="who">Auditor interno</div>'+md(t)+'</div>'
      + '<div class="alert alert-warn" style="margin-top:14px"><b>Guardrail de imparcialidade em ação.</b> Quem audita não pode consultar sobre o mesmo objeto. É a regra que separa auditoria de consultoria — e a plataforma a respeita por construção.</div>';
  }catch(e){ erro(box, e); }
}

async function analisarLacuna(){
  const box = $('lacBox'); $('btnLac').disabled = true;
  pensando(box, 'comparando o sistema com a edição 2026');
  try{
    const t = await chamar('lacuna', [{role:'user', content:'Analise a lacuna para a edição 2026 no contexto de '+S.perfil.nome+'.'}], 'Análise de lacuna');
    const a = extrairJSON(t);
    const esforco = {alto:'nao_conformidade', 'médio':'oportunidade', medio:'oportunidade', baixo:'conformidade'};
    const lacunas = (a.lacunas||[]).map(function(l){
      const c = esforco[l.esforco] || 'oportunidade';
      return '<div class="finding '+c+'"><div class="f-top">'
        + '<span class="tag '+c+'">esforço '+esc(l.esforco||'—')+'</span>'
        + '<span class="f-req">cláusula '+esc(l.clausula||'—')+' · '+esc(l.tema||'')+'</span></div>'
        + '<div><b>Hoje:</b> '+esc(l.situacao_provavel||'—')+'</div>'
        + '<div style="margin-top:4px"><b>Passa a pedir:</b> '+esc(l.o_que_muda||'—')+'</div>'
        + '<div class="f-ev"><b>Evidência sugerida:</b> '+esc(l.evidencia_sugerida||'—')+'</div></div>';
    }).join('');
    const naoMuda = (a.nao_muda||[]).map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('');
    const seq = (a.sequencia||[]).map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('');
    box.innerHTML = '<div class="doc-head"><div><h3 style="margin:0">Análise de lacuna — edição 2015 para 2026</h3>'
      + '<div class="doc-code">LAC-001 · '+esc(S.perfil.nome)+'</div></div>'
      + '<span class="tag oportunidade">'+(a.lacunas||[]).length+' lacunas</span></div>'
      + '<div class="panel" style="margin:0 0 14px;background:#F7F9FC;box-shadow:none">'
      + '<div class="card-t" style="margin-bottom:6px">Veredito</div>'
      + '<div style="font-size:14px">'+esc(a.veredito||'')+'</div></div>'
      + lacunas
      + '<div class="grid2" style="margin-top:14px">'
      + '<div class="card"><div class="card-t">O que não muda</div><ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6">'+naoMuda+'</ul></div>'
      + '<div class="card"><div class="card-t">Por onde começar</div><ol style="margin:0;padding-left:18px;font-size:13px;line-height:1.6">'+seq+'</ol></div>'
      + '</div>'
      + '<div class="alert alert-warn" style="margin-top:14px"><b>Alerta.</b> '+esc(a.alerta||'')+'</div>';
  }catch(e){ erro(box, e); }
  $('btnLac').disabled = false;
}

function montarFechamento(){
  const nc = S.auditoria ? (S.auditoria.achados||[]).filter(function(a){return a.classificacao==='nao_conformidade';}).length : 0;
  const docs = (S.procedimento?1:0)+(S.formulario?1:0);
  const linhas = S.chamadas.map(function(c){
    return '<div class="ledger-row" style="color:var(--muted);font-size:12px"><span>'+esc(c.rotulo)+' · '+c.tokens+' tokens</span><b style="color:var(--ink)">R$ '+brl(c.custo)+'</b></div>';
  }).join('');
  $('fechamento').innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:14px;margin-bottom:20px">'
    + '<div><div class="card-t">Chamadas de IA</div><div style="font-family:var(--mono);font-size:25px;font-weight:600">'+S.chamadas.length+'</div></div>'
    + '<div><div class="card-t">Custo total</div><div style="font-family:var(--mono);font-size:25px;font-weight:600;color:var(--blue)">R$ '+brl(S.custo)+'</div></div>'
    + '<div><div class="card-t">Documentos</div><div style="font-family:var(--mono);font-size:25px;font-weight:600">'+docs+'</div></div>'
    + '<div><div class="card-t">Não conformidades</div><div style="font-family:var(--mono);font-size:25px;font-weight:600;color:var(--rose)">'+nc+'</div></div></div>'
    + '<div style="font-family:var(--mono);border-top:1px solid var(--line);padding-top:12px">'+linhas+'</div>'
    + '<p class="note" style="margin-top:16px">Este ciclo — entender o requisito, redigir o procedimento, criar o formulário e auditar o resultado — é trabalho que uma consultoria entrega em semanas. Aqui custou <b>R$ '+brl(S.custo)+'</b> de inferência. É essa diferença que sustenta uma assinatura de R$ 89.</p>'
    + '<p class="note">Escopo desta demonstração: um requisito, de um referencial. A ISO 9001 tem dezenas de requisitos, e o documento técnico prevê nove referenciais.</p>';
}

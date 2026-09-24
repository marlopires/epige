# EPIGE — Backlog

Itens acionáveis derivados de `DIAGNOSTICO.md`, `ROTEIRO.md`,
`docs/revisao-completa.md` e `docs/modelo-custo-precificacao.md`.
Ordem = ordem sugerida de execução. Marque `[x]` ao concluir.

> **Atualizado em 10/09/2026** com a segunda leva de documentos. A mudança de prioridade
> mais forte veio da pesquisa normativa: a janela de transição das três ISO cria uma
> oportunidade com prazo, e há um item que é de **hoje**, não de depois (F0-7).

---

## Urgente — tem data

- [x] **F0-7 · Verificar a publicação da ISO 9001:2026.** *Resolvido em 10/09/2026.*
      **Data confirmada: 16 de setembro de 2026** — daqui a seis dias. O FDIS foi
      aprovado e a votação encerrada, então a data é firme. Ver
      `docs/situacao-normativa.md` para prazos, mudanças de conteúdo e fontes.
- [x] **F0-8 · Preparar o conteúdo dos agentes para a 9001:2026 antes de 16/09.**
      *Feito em 15/09/2026.* O campo `transicao` da ISO 9001 na 8.2 passou de "publicação
      esperada para setembro" para a data confirmada, com a transição de três anos e a
      regra de sempre deixar claro a qual edição a resposta se refere. A demo 10.2 ganhou
      um bloco `EDIÇÃO` nas regras base. Sintaxe dos 8 blocos de script validada com
      `node --check`. Contexto original do item:
      As mudanças já são públicas e não dependem do texto final para serem endereçadas:
      cultura da qualidade e comportamento ético na liderança (cláusula 5), mudança
      climática formalizada no contexto (4.1), gestão de riscos e oportunidades mais
      clara. O núcleo das cláusulas 4 a 10 muda pouco.
      **A cláusula 10.2 — escopo da demo — permanece substancialmente a mesma**, com
      ajustes de clareza sobre evidência documentada. A demo não fica obsoleta.
- [x] **F0-9 · Publicar a orientação de transição como conteúdo comercial.**
      *Feito em 15/09/2026:* `docs/orientacao-transicao-9001.md`. Contexto original:
      Os primeiros certificados na edição 2026 não saem antes do 3º trimestre de 2027,
      porque os organismos certificadores precisam ser acreditados primeiro (9 a 12
      meses após a publicação). Quem precisa certificar agora certifica na 2015 e
      transiciona depois. É orientação correta, verificável, e que quase ninguém está
      dando — ver `docs/situacao-normativa.md`.

## Fase 0 — Decisões (só você resolve, roda em paralelo a tudo)

- [ ] **F0-1 · ABNT + advogado de PI.** Perguntar sobre programas de licenciamento de
      conteúdo normativo. Trava a arquitetura da base inteira. *Semana 1 do roteiro.*
      **Adiado por decisão sua em 22/09/2026.** Registro a ressalva sem re-litigar: a
      licença profissional de auditor cobre o seu trabalho, não alimentar um SaaS
      comercial, e os exemplares consultados em 22/09 eram nominais a um terceiro. Enquanto
      isso, a regra que nos protege é a que já está em vigor — o texto da norma nunca é
      armazenado, indexado nem reproduzido; o que entra no produto é interpretação autoral.
- [x] **F0-2 · Escopo do MVP.** *Decidido por você em 22/09/2026:* oito normas —
      9001, 14001, 45001, 27001, 37001, 37301, 39001 e 42001. IATF fora; demais conforme
      demanda. *Ampliado por você em 23/09/2026* para **onze referenciais**: + ISO 50001,
      PBQP-H/SiAC e ABNT PR 2030 — esta última não certificável, então o auditor faz
      avaliação de maturidade. **Registro a ressalva sem re-litigar:** o roteiro
      recomendava lançar com uma norma, e dos onze só quatro estão conferidos contra
      exemplar (9001, 45001, 27001 e 37301). A mitigação está no código, não no papel — os
      sete não conferidos carregam `confianca: 'media'`, que injeta uma camada de cautela
      no prompt e mostra aviso na tela.
      Contexto original do item: O roteiro recomenda **ISO 9001 apenas** + requisitos
      legais. A revisão completa mostra a janela de transição nas **três** normas.
      Não são incompatíveis — a transição 9001:2015→2026 sozinha já é mercado — mas a
      decisão precisa ser tomada com as duas informações na mesa. Registrar por escrito.
- [ ] **F0-3 · Limites de responsabilidade.** Com advogado. Alimenta termos de uso *e* o
      comportamento dos agentes.
- [ ] **F0-4 · Enquadramento tributário.** Com contador. O modelo de custo identifica isso
      como **o maior risco isolado**: uma mudança para o Anexo V custa ~9,5 p.p. de
      margem — mais do que o dólar ir a R$ 6,00. Resolver antes de publicar preço.
- [ ] **F0-5 · LGPD.** Base legal, política de retenção, e decisão explícita sobre uso de
      documentos de cliente para melhoria de modelo. **Antes do primeiro upload real.**
- [ ] **F0-6 · Conta de API da Anthropic em nome da empresa.** **É o único bloqueio real
      hoje.** Tudo que depende de IA funcionando está construído e parado esperando a
      chave: a publicação (`web/`) e o conjunto de avaliação (`avaliacao/`).
      Passo a passo em `web/README.md`. Crie com limite de gasto mensal.

## Fase 1 — Consultor ISO 9001 de verdade (o próximo passo recomendado)

- [~] **F1-2 · Conjunto de avaliação.** *Gabarito preenchido em 21/09/2026, por delegação.*
      **Escrito por Claude, NÃO validado por auditor.** `avaliacao/REVISAR.md` lista as sete
      respostas de maior risco e a regra: nenhum número desta avaliação sustenta decisão de
      produto enquanto a linha correspondente estiver aberta. Detalhe original:
      43 casos em `avaliacao/`: 13 guardrails **já especificados** (o comportamento esperado
      decorre das nossas regras, não de interpretação normativa) e 30 perguntas de conteúdo
      sobre o 10.2 com `resposta_correta` **em branco**, que é onde entra você.
      Os `criterios` de cada pergunta são rascunho meu, a corrigir.
      Executor em `avaliacao/rodar.mjs`, sem dependências, validado.
      **Bloqueado para rodar até o F0-6** (conta de API em nome da empresa).
- [x] **F1-8 · Ferramenta de análise de lacuna entre edições.** *Feito em 21/09/2026.*
      Agente `lacuna` mais tela na demo publicada. Devolve lacunas com cláusula, situação
      provável, o que passa a ser pedido, esforço e evidência sugerida — e uma lista do que
      **não** muda, que é metade do valor: o medo da transição costuma ser maior que ela.
      Cobre 9001 apenas; 14001 e 45001 entram depois.
- [x] **F1-1 · Corrigir o modelo nas demos.** *Feito em 10/09/2026.* `claude-sonnet-4-6`
      → `claude-sonnet-5`: 4 ocorrências na 8.2, 2 na demo 10.2. O medidor de custo agora
      calcula a tarifa do modelo que é de fato chamado.
- [x] **F1-3 · Extrair os prompts para arquivos versionados.** *Feito em 15/09/2026.*
      15 prompts em `agentes/`, extraídos por script. **Ressalva registrada no
      `agentes/README.md`:** o HTML continua sendo a fonte e os `.txt` são derivados, então
      as duas cópias podem divergir se alguém editar só uma. A direção só se inverte na
      reescrita para produção (F2-4).
- [~] **F1-4 · Guardrails como testes automatizados.** *Escritos em 15/09/2026; falta rodar.*
      *23/09/2026:* o executor passou a montar o prompt com o **motor de produção**
      (`_motor.js`) e no modelo de produção de cada agente — antes lia uma pasta que tinha
      sido renomeada e testaria o prompt antigo da demo, não o que vai ao ar. Cinco casos
      novos para PR 2030, PBQP-H, 50001 e integração; agora são 18.
      Os 13 originais em `avaliacao/guardrails.json` cobrem seis regras — as três originais mais
      escopo, honestidade e não-generalizar-entre-normas. Falham alto: o executor sai com
      código 2 e diz para não publicar os prompts.
      Inclui **três controles negativos** — casos em que o agente DEVE responder. Sem eles,
      um agente que recusa tudo passaria com 100%.
      **Bloqueado para rodar até o F0-6.**
- [x] **F1-5 · Proxy mínimo de API.** *Feito em 16/09/2026:* `web/`. Cloudflare Pages
      Function que guarda a chave, monta o prompt no servidor e aplica código de acesso,
      teto diário e limites de tamanho. Lógica de guarda testada em sete cenários.
      **Efeito colateral valioso:** os prompts param de ir para o navegador, e `agentes/`
      vira a fonte de verdade da aplicação publicada — a divergência HTML/`.txt` deixa de
      existir em produção. Falta só a chave (F0-6) e o domínio. *24/09/2026:* o código de
      acesso compartilhado deu lugar a contas individuais (F2-5); agora só abre o primeiro acesso.
- [x] **F1-6 · Telemetria por tipo de interação.** *Feito em 21/09/2026.* Contadores
      agregados por dia e por agente: chamadas, tokens de entrada, saída e cache,
      custo e latência. Sem conteúdo de conversa. *24/09/2026:* saiu do KV para o D1, uma
      linha por chamada, com empresa e pessoa — é o que alimenta o teto por empresa e o
      painel **Uso de IA**.
- [ ] **F1-7 · Base de conhecimento autoral, ISO 9001.** A parte mais lenta e mais valiosa.
      Depende de F0-1. Começar pelos requisitos da cláusula 10 já cobertos pela demo.
- [x] **F1-9 · Encodar os modos de falha comuns nos agentes.** *Feito em 21/09/2026.*
      Já existiam como texto corrido no campo `achados` da 8.2, mas não nos prompts da demo.
      Agora são `agentes/conhecimento/modos-de-falha-10.2.txt`: oito padrões, cada um com
      sintoma, consequência e **a evidência que um auditor busca**. Entram no consultor, no
      redator de procedimento e no auditor. Instrução explícita de não recitar a lista —
      nomear o padrão quando ele aparecer no caso concreto.

## Identidade visual

- [x] **ID-2 · Manual de marca.** *Entregue:* `identidade/IDENTIDADE_VISUAL.md`, 13 seções.
- [x] **ID-3 · Corrigir o gradiente da demo 10.2.** *Feito em 10/09/2026.*
      `#4E74F0` → `#2B52DC` e `#5FBDB0` → `#439397`. Demo, 8.2 e `simbolo-epige.svg`
      agora têm as quatro paradas idênticas, conferidas por script.
- [x] **ID-1 · Lockup vetorial definitivo.** *Feito em 21/09/2026.* Três arquivos:
      `lockup-epige.svg`, `lockup-epige-assinatura.svg` e a versão para fundo escuro.
      **Texto convertido em curvas**, não referenciado por nome de fonte — SVG que
      referencia fonte vira Arial dentro de `<img>`, que é como logo é usado na maior
      parte das vezes. Espaçamento e alinhamento conforme o manual; baseline calculada pela
      cap-height, kerning real via HarfBuzz.
      **Uma divergência do manual, registrada:** peso 800 em vez de 850, porque 850 só
      existe na fonte variável e os subsets servidos não traziam os glifos. Diferença
      visualmente desprezível; nota em `identidade/gerador/README.md`.
- [x] **ID-4 · Aplicar a escala φ na interface.** *Feito em 22/09/2026* na demo publicada.
      **16 tamanhos de fonte viraram 6 tokens; 28 valores de espaçamento viraram 8.**
      Zero valores crus restantes no CSS. Razão de layout φ:1 medida em 1,617 a partir de
      1500px, que é o que o manual quer dizer com "telas largas".
      Duas coisas que a verificação visual pegou e que o script sozinho teria escondido:
      mapear por proximidade achatava título e descrição do menu no mesmo tamanho (fiz
      por papel, não por vizinho mais próximo), e forçar as réguas laterais em Fibonacci
      quebrava os títulos em duas linhas — **o manual fixa a razão, não a largura das
      réguas.**

## Fases 2+ — não começar antes da Fase 1 fechar

- [ ] **F2-1 · Contratar desenvolvedor.** Contratação número um segundo o roteiro.
      Deploy, infraestrutura, plantão, arquitetura de dados.
- [ ] **F2-3 · Vigilância normativa como curadoria central.** Decisão de arquitetura, não
      de preço: agendada no servidor, uma execução por norma por dia, resultado gravado e
      servido a todos. Sob demanda por usuário custa R$ 0,34 por execução — a operação
      mais cara da plataforma, 2,6× uma consulta. Como curadoria central custa R$ 35,10/mês
      fixos, menos de 0,15 p.p. de margem. Ver `docs/revisao-completa.md` §4.
- [x] **F2-2 · Fluxos ponta a ponta.** *Feito em 22/09/2026, e além do pedido:* não três
      fluxos, mas **12 ferramentas** em `web/public/index.html` — diagnóstico, consultor,
      legal, lacuna de edições, SGI, redator, formulário, análise de causa, plano de ação,
      analista de documentos, auditoria simulada e vigilância. Três normas selecionáveis,
      contexto da empresa persistido no navegador, custo por chamada visível.
      **Sem resposta real verificada** — falta a chave (F0-6).
- [~] **F2-4 · Reescrita para produção.** O protótipo cumpriu o papel: define exatamente
      o que construir. *Grande parte feita em 24/09/2026, na plataforma publicada (`web/`):*
      backend com banco (D1), autenticação e persistência; interface sem nenhum `onclick`
      embutido e com CSP restritiva. O protótipo 8.2 segue como registro histórico.
      Falta: componentização quando o front crescer além de um arquivo, e o que está em F2-6.
- [x] **F2-5 · Contas, segurança e controle de documentos.** *Feito em 24/09/2026.*
      Primeiro acesso, cadastro por convite, "solicitar acesso" com aprovação sua, login com
      bloqueio por tentativas, 2FA por aplicativo, troca e redefinição de senha, sessões
      encerráveis. Três papéis por empresa (admin, editor, leitor) mais a administração da
      plataforma. Controle de documentos na lógica da 7.5: rascunho, aprovação, versões,
      substituída, obsoleta, registro imutável, impressão controlada. Log de auditoria,
      exportação LGPD, teto de IA por empresa. **150 verificações automatizadas** (119 de
      API, 31 de navegador) no runtime real da Cloudflare. Guia em `web/README.md`.
- [ ] **F2-6 · O que falta para abrir a cliente real.** Envio de e-mail (convite e nova
      senha hoje são links copiados à mão); cobrança e planos; termos de uso e política de
      privacidade (dependem de F0-3 e F0-5 — **não abrir para cliente sem eles**).
- [ ] **F3-1 · Piloto com 10 a 15 usuários reais** e medição das premissas de confiança
      baixa do modelo de custo: volumes por plano, aproveitamento de cache, tickets de
      suporte, CAC por canal, conversão do gratuito. Recomendação do modelo: rodar os
      primeiros 90 dias com preço de lançamento e limites generosos, medindo tudo.

---

## Registro de decisões

Decisões que mudam o rumo do projeto entram aqui, com data. Serve para não re-litigar o
que já foi decidido.

| Data | Decisão | Consequência |
|---|---|---|
| 09/09/2026 | Material da EPIGE vai para repositório próprio, separado do ScopeMark | Os dois produtos não se misturam; nada da EPIGE é publicado por engano no GitHub Pages do ScopeMark |
| 10/09/2026 | `marlopires/epige` criado (privado) e este material transplantado para a raiz | O abrigo provisório na branch do `scopemark-site` deixa de ser necessário e foi removido |
| 10/09/2026 | ISO 9001:2026 publica em 16/09/2026; transição de 3 anos | Confirma a janela comercial e dá data ao F0-8 e ao F0-9 |
| 15/09/2026 | Prompts extraídos para `agentes/`, mas o HTML segue sendo a fonte | Evita a ilusão de que a plataforma já lê arquivo; inverte só na F2-4 |
| 15/09/2026 | Guardrails têm controles negativos no conjunto de avaliação | Um agente que recusa tudo não pode pontuar 100% |
| 16/09/2026 | Publicação em Cloudflare Pages, não Vercel nem GitHub Pages | Pages não roda servidor; o grátis do Vercel exclui uso comercial |
| 16/09/2026 | Demo publicada fica atrás de código de acesso, com teto de gasto | Página pública ligada a chave de API é cartão de crédito exposto |
| 16/09/2026 | Em produção, `agentes/` é a fonte e o protótipo vira legado | Acaba a divergência HTML/`.txt` para a aplicação publicada |
| 21/09/2026 | Gabarito da avaliação preenchido por Claude, marcado como não validado | Destrava medir agora; `REVISAR.md` impede que o não validado vire verdade por esquecimento |
| 21/09/2026 | Análise de lacuna devolve também o que **não** muda | O medo da transição costuma ser maior que a transição |
| 21/09/2026 | Domínio é `epige.com.br`; a demo vai em `demo.epige.com.br` | A raiz fica livre para o site institucional; quem digitar o domínio não cai numa tela de senha |
| 21/09/2026 | Lockups com texto em curvas, peso 800 em vez dos 850 do manual | Logo não depende de fonte instalada; 850 exigiria fonte variável completa |
| 22/09/2026 | Escala φ aplicada por papel, não por vizinho mais próximo | Proximidade cega colapsa hierarquia: título e descrição caem no mesmo tamanho |
| 22/09/2026 | Réguas laterais mantidas em 260/288; só a razão segue φ | O manual fixa a razão conteúdo:painel, não a largura das réguas |
| 22/09/2026 | Um agente é composição de camadas, não um prompt | Regras invioláveis primeiro, contexto por último: prefixo estável é o que o cache aproveita |
| 22/09/2026 | Opus só no auditor; Haiku roteia | O custo de um auditor complacente é assimétrico; o roteamento barato paga o Opus |
| 22/09/2026 | Regra 6 nova: não generalizar entre normas | Misturar aspecto/impacto com perigo/risco parece erudição e é erro |
| 22/09/2026 | Plataforma em `/`, demo narrada em `/demo/` | Propósitos diferentes: área de trabalho versus percurso de demonstração |
| 22/09/2026 | Exemplares das normas usados só para conferir interpretação, nunca ingeridos | Mantém o ativo defensável: o que entra no produto é texto autoral corrigido |
| 22/09/2026 | Conversa com a ABNT adiada | Decisão sua; a ressalva fica registrada e a regra de não reprodução continua valendo |
| 22/09/2026 | Escopo vai de 3 para 8 normas | Decisão sua; IATF fora, demais conforme demanda |
| 22/09/2026 | Cada norma carrega nível de confiança, e ele muda o comportamento do agente | Sem exemplar eu erro — e errei três vezes nas que tinha. O agente precisa saber quando está em terreno fino |
| 22/09/2026 | Os princípios da ISO 19011 compõem o auditor em todas as normas | Auditoria tem método próprio, independente da norma auditada |
| 22/09/2026 | 37301 elevada a confiança alta; afirmação sobre a 19600 corrigida | Conferida contra exemplar; o que não se sustentava saiu |
| 23/09/2026 | Escopo vai de 8 para 11 referenciais: + ISO 50001, PBQP-H/SiAC, ABNT PR 2030 | Decisão sua. Os três entram com confiança média |
| 23/09/2026 | PR 2030 não é auditada por conformidade: o auditor avalia maturidade | Ela é prática recomendada, sem requisito certificável. Dizer "conforme com a PR 2030" é erro de natureza |
| 23/09/2026 | PBQP-H/SiAC tratado como camada sobre a 9001, não sistema paralelo | É como o mercado integra, e o que evita dois manuais contraditórios |
| 23/09/2026 | Auditor e SGI aceitam sessão combinada (principal + até 3) e carregam a matriz de integração | O auditor precisa saber o que integra e o que não — e enxergar objetivos que competem entre sistemas |
| 23/09/2026 | Avaliação passa a usar o motor e os modelos de produção | Testar outra montagem é testar um produto que não está no ar |
| 24/09/2026 | Sem cadastro aberto: convite, ou "solicitar acesso" com aprovação | Cadastro livre ligaria o cartão da API a qualquer visitante |
| 24/09/2026 | Banco D1, com migração automática no código | Um passo manual a menos na publicação; KV deixa de ser necessário |
| 24/09/2026 | Senha com PBKDF2 + pimenta fora do banco; Workers Paid obrigatório | 100 mil iterações custam ~20 ms de CPU; o plano grátis corta em 10 ms |
| 24/09/2026 | Conversa com a IA não é guardada; só o que vira documento | Minimização de dados (LGPD) e menos superfície de vazamento |
| 24/09/2026 | Contexto da empresa no servidor, não no navegador | É da empresa, não de uma pessoa; o agente responde para a empresa da sessão |
| 24/09/2026 | Registro e relatório aprovados não são revisados | São evidência: corrige-se com registro novo, não reescrevendo o antigo |
| 24/09/2026 | Conta da plataforma só se altera por ela mesma | Achado da revisão de segurança: um admin da mesma empresa poderia tomá-la por link de nova senha |
| 09/09/2026 | Protótipo 8.2 é o canônico; 3.7 a 6.0 viram histórico | Só a 8.2 recebe alterações daqui em diante |
| 10/09/2026 | Paleta canônica é a do manual de marca, conferida contra a 8.2 | `simbolo-epige.svg` corrigido; demo 10.2 fica fora de padrão até ID-3 |
| 12/08/2026 | Faixa de preço B: R$ 89 / R$ 279 / R$ 1.490 | Margem de contribuição ≥ 41,8% mesmo no teto do plano com dólar a R$ 6,00 |
| ago/2026 | Não alegar construção áurea no símbolo; adotar φ no sistema ao redor | Evita alegação verificável e falsa em material de marca |
| ago/2026 | Vigilância normativa é curadoria central, não consulta por usuário | Custo fixo de R$ 35,10/mês em vez de custo variável que escala mal |

# Auditoria da EPIGE contra a ISO/IEC 42001

Auditoria de primeira parte do serviço EPIGE, feita em 24/09/2026, para responder a uma
pergunta: **o serviço de IA está sendo fornecido da forma correta?** — com o mesmo rigor
que a plataforma aplica aos clientes.

---

## Limites desta auditoria — leia antes das constatações

A ISO 19011 pede apresentação justa dos obstáculos. São três, e eles mudam o peso do resultado:

1. **Não há independência.** Quem audita (Claude) construiu a maior parte do que é
   auditado. A 19011 aceita isso quando não há alternativa, desde que declarado e com esforço
   para reduzir o viés — o esforço aqui foi julgar pela evidência do repositório, não pela
   intenção. **Antes de qualquer certificação, a auditoria interna precisa ser feita por
   alguém independente.**
2. **Critério com confiança média.** A ISO/IEC 42001 não foi conferida contra exemplar da
   norma. As constatações citam temas e objetivos de controle, não número de item.
3. **Sem operação real.** A EPIGE ainda não foi publicada nem chamou o modelo de IA de
   verdade. Tudo que depende de uso — monitoramento, incidentes, satisfação — só pode ser
   avaliado no desenho, não na prática.

**Método.** Leitura do código (`web/`), dos prompts (`agentes/`), da documentação
(`docs/`, `BACKLOG.md`) e dos resultados das suítes de teste. Nenhuma entrevista.

**Papel da EPIGE diante da norma.** A EPIGE **fornece** um serviço baseado em IA a empresas
e **usa** um modelo de IA de terceiro (Anthropic). Não desenvolve nem treina modelo. As
obrigações que pesam são as de quem fornece o sistema de IA ao cliente e de quem controla o
fornecedor do modelo.

---

## Conclusão

**O produto foi desenhado com controles fortes; o sistema de gestão em volta dele ainda
não existe.** A plataforma tem supervisão humana obrigatória, transparência sobre o que é
gerado por IA, nível de confiança por norma, testes de comportamento e registro de
auditoria — acima do que se vê na maioria dos serviços de IA para gestão. Faltam as peças
formais que a 42001 cobra de quem fornece IA: política, avaliação de impacto, avaliação do
fornecedor do modelo, validação antes de publicar e canal de incidente com procedimento.

Para a situação atual — pré-lançamento —, isso é esperado. **Para abrir a clientes reais,
cinco itens são bloqueantes** (marcados abaixo). Para certificação na 42001, a EPIGE ainda
está longe, e não precisa estar agora.

---

## Constatações

Classificação da plataforma: **conformidade**, **oportunidade** ou **não conformidade**. As
não conformidades são contra o que a 42001 pediria se a EPIGE buscasse a certificação.

### 1. Contexto e escopo — não conformidade

**Critério:** a organização define o escopo do sistema de gestão de IA e o seu papel em
relação aos sistemas de IA.
**Evidência:** o papel (fornecedora de serviço, usuária de modelo de terceiro) só está
descrito neste documento. Não há escopo formal.

### 2. Política de IA — não conformidade ⛔ bloqueante

**Critério:** a alta direção estabelece uma política de IA.
**Evidência:** não existe documento de política. As **seis regras invioláveis**
(`agentes/base/01-regras-inviolaveis.txt`) funcionam como política aplicada ao
comportamento dos agentes — direito autoral, sem promessa de certificação, escopo,
honestidade, não generalizar entre normas, decisão do cliente —, mas não substituem uma
política assumida pela direção. Rascunho no apêndice A.

### 3. Papéis e responsabilidades — oportunidade

**Critério:** responsabilidades definidas para o sistema de IA.
**Evidência:** a responsabilidade é toda sua, de fato. Não há definição de quem responde por
incidente de IA, por mudança de prompt e por tratamento de sinalização quando houver equipe.

### 4. Avaliação de risco e de impacto — não conformidade ⛔ bloqueante

**Critério:** avaliação de risco de IA e **avaliação de impacto sobre indivíduos, grupos e
sociedade**.
**Evidência:** os riscos para o negócio estão dispersos (`docs/revisao-completa.md`,
`BACKLOG.md`). Não há avaliação do impacto **sobre as pessoas afetadas** pelo que a IA
produz. O impacto mais sério identificado nesta auditoria não é comercial: **uma orientação
errada do agente de ISO 45001 sobre hierarquia de controles pode chegar a um trabalhador
exposto a perigo.** Rascunho no apêndice B.

### 5. Recursos do sistema de IA — conformidade

**Critério:** recursos do sistema de IA identificados e documentados.
**Evidência:** modelos por papel, tarifas e parâmetros em `web/functions/api/_motor.js`;
composição dos agentes em `agentes/README.md`; base de conhecimento versionada em
`agentes/`, com origem de cada conteúdo registrada em `docs/situacao-normativa.md`.

### 6. Ciclo de vida — verificação e validação — não conformidade ⛔ bloqueante

**Critério:** o sistema de IA é verificado e validado antes de ser disponibilizado.
**Evidência:** existe o conjunto de avaliação (`avaliacao/`: 22 casos de guardrail e 30 de
conteúdo) e ele usa o motor e os modelos de produção. **Mas nunca rodou contra o modelo
real** — falta a chave de API. E o gabarito de conteúdo foi escrito pela própria IA e não
foi validado por especialista (`avaliacao/REVISAR.md`). Publicar sem isso é disponibilizar
sistema de IA não validado.

### 7. Ciclo de vida — controle de mudança — oportunidade

**Critério:** mudanças no sistema de IA são controladas.
**Evidência:** todo prompt está versionado no git, com mensagem de commit e registro de
decisões no `BACKLOG.md`. Falta tornar a avaliação **obrigatória antes de publicar**
mudança de prompt — hoje é recomendação no guia, não trava.

### 8. Ciclo de vida — monitoramento em operação — conformidade (no desenho)

**Critério:** o sistema de IA é monitorado depois de implantado.
**Evidência:** criado nesta auditoria: botão **"Sinalizar problema nesta resposta"**, com
motivos específicos (requisito inexistente, referência legal errada, texto de norma
reproduzido, promessa de certificação), fila na tela **Plataforma** e registro obrigatório
do tratamento. Custo, volume e latência por agente já eram medidos. Sem operação, a eficácia
não pôde ser avaliada.

### 9. Dados — conformidade

**Critério:** qualidade e proveniência dos dados usados pelo sistema de IA.
**Evidência:** a EPIGE não treina modelo. O dado que alimenta os agentes é a base de
conhecimento, e ela tem **nível de confiança declarado por norma**, que muda o comportamento
do agente e aparece na tela. Os exemplares de norma foram usados só para conferência e não
estão no repositório (verificado: nenhum rastro do licenciado). O conteúdo do cliente não é
guardado, salvo o que ele salva como documento.

### 10. Informação às partes interessadas — não conformidade ⛔ bloqueante

**Critério:** quem usa o sistema recebe a informação necessária sobre ele.
**Evidência positiva:** fica claro que é IA — nome do agente, modelo usado, custo por
chamada, aviso de conteúdo não conferido, regras ativas na tela, e agora o selo "elaborado
com apoio de IA" nos documentos. **Falta:** termos de uso e política de privacidade que
digam o que a IA faz e não faz, quais são as limitações, para onde vão os dados e quem é o
fornecedor do modelo (F0-3, F0-5).

### 11. Uso responsável e supervisão humana — conformidade

**Critério:** o sistema é usado conforme o propósito, com supervisão humana adequada.
**Evidência:** tudo que a IA gera entra como rascunho; só administrador aprova; documento
feito com IA **só é aprovado com declaração de revisão humana**, que fica no histórico, no
log e na impressão; leitor não usa IA; o auditor é proibido de prestar consultoria; limite
de chamadas por pessoa e teto de gasto por empresa. Testado automaticamente.

### 12. Fornecedor do modelo — não conformidade ⛔ bloqueante

**Critério:** relação com terceiros no ciclo de vida do sistema de IA é controlada.
**Evidência:** a Anthropic é o fornecedor crítico — sem ela, não há serviço. Não há
avaliação registrada de: retenção dos dados enviados pela API, uso ou não para treinamento,
região de processamento, aviso de mudança de modelo e plano se o modelo for descontinuado.
Isso precisa ser confirmado nos **termos comerciais da conta de API** quando ela for criada —
não afirmo aqui o que eles dizem.

### 13. Segurança da informação — conformidade

**Critério:** controles de segurança adequados ao sistema de IA (sobreposição com a 27001).
**Evidência:** isolamento entre empresas, sessão protegida, 2FA, bloqueio por tentativas,
CSP estrita, chave e prompts só no servidor, log de auditoria — 129 verificações de API e 35
de navegador. **Oportunidade:** não há procedimento escrito de resposta a incidente.

### 14. Avaliação de desempenho e melhoria — oportunidade

**Critério:** auditoria interna, análise crítica e ação corretiva.
**Evidência:** esta é a primeira auditoria. O registro de decisões do `BACKLOG.md` funciona
como trilha de correção — os erros normativos encontrados em 22/09 foram corrigidos e
registrados —, mas sem processo formal. Esperado para o estágio.

---

## Ações em ordem de prioridade

| # | Ação | Constatação | Quem |
|---|---|---|---|
| 1 | Rodar os guardrails e o gabarito contra o modelo real; validar o gabarito | 6 | Você + Claude |
| 2 | Termos de uso e política de privacidade com a informação sobre IA | 10 | Advogado |
| 3 | Registrar a avaliação do fornecedor de IA a partir dos termos da conta de API | 12 | Você |
| 4 | Aprovar a política de IA (rascunho no apêndice A) | 2 | Você |
| 5 | Aprovar a avaliação de impacto (rascunho no apêndice B) | 4 | Você |
| 6 | Tornar a avaliação obrigatória antes de publicar mudança de prompt | 7 | Claude |
| 7 | Procedimento de incidente de IA e de segurança | 13 | Claude, para sua aprovação |

---

## Situação das ações — atualizada em 24/09/2026

| # | Item bloqueante | O que foi feito | O que falta |
|---|---|---|---|
| 1 | Validar contra o modelo real (constatação 6) | Conjunto de avaliação pronto: 22 guardrails, 30 casos de 10.2 e **8 novos de saúde e segurança do trabalho**. Agentes de 45001 e 39001 passam a dizer que a definição do controle cabe a profissional habilitado. | **Chave de API** para rodar; você conferir o gabarito; profissional de SST conferir `avaliacao/iso-45001-sst.json` |
| 2 | Termos e privacidade com informação sobre IA (10) | Rascunhos publicados em `/termos/` e `/privacidade/`, com pontos jurídicos marcados; página `/ia/` de transparência; **aceite obrigatório e registrado** no cadastro, com novo aceite a cada versão | **Advogado** revisar os pontos marcados; mudar `TERMOS_VERSAO` quando aprovar |
| 3 | Avaliação do fornecedor (12) | `governanca-ia/avaliacao-fornecedor-anthropic.md`: aprovado com condições, com base na documentação pública | Confirmar os termos na **conta de API**; advogado confirmar cláusulas-padrão da ANPD |
| 4 | Política de IA (2) | `governanca-ia/politica-de-ia.md`, POL-IA-001 v1 — **aprovada em 24/09/2026** | ✅ Fechado |
| 5 | Avaliação de impacto (4) | `governanca-ia/avaliacao-de-impacto.md`, AVI-IA-001 v1 — **aprovada em 24/09/2026** | ✅ Fechado. Os três impactos com risco residual médio seguem abertos até os itens 1, 2 e 3 |

Dos cinco bloqueantes, dois estão fechados. O que falta é de três pessoas: você
(criar a conta de API), o advogado (termos, privacidade, transferência internacional) e
um profissional de segurança do trabalho (gabarito de SST).

## Apêndice A — Política de IA da EPIGE (rascunho para aprovação)

> Versão completa e vigente do rascunho: `governanca-ia/politica-de-ia.md`.

1. A EPIGE usa inteligência artificial para **apoiar** empresas em sistemas de gestão. A
   decisão técnica é sempre da empresa cliente, e a avaliação de conformidade é sempre do
   auditor.
2. Todo conteúdo gerado por IA é apresentado como rascunho e só entra em uso depois de
   revisão e aprovação humanas registradas.
3. A EPIGE não reproduz texto de norma, não promete certificação, não inventa requisito e
   não produz registro de atividade que não aconteceu.
4. Cada norma atendida tem nível de confiança declarado, e o usuário vê esse nível.
5. Conversas com a IA não são guardadas. Dados do cliente são usados só para responder ao
   próprio cliente.
6. O comportamento dos agentes é testado antes de cada publicação, e qualquer usuário pode
   sinalizar resposta com problema; toda sinalização recebe tratamento registrado.
7. O fornecedor do modelo de IA é avaliado e reavaliado quando os termos ou o modelo mudam.
8. Esta política é revista pelo menos uma vez por ano e sempre que o uso de IA mudar.

## Apêndice B — Avaliação de impacto do sistema de IA (rascunho)

| Quem é afetado | Impacto possível | Gravidade | Controle existente | Falta |
|---|---|---|---|---|
| **Trabalhadores do cliente** | Orientação errada de SST (ISO 45001, 39001) aplicada na prática | **Alta** — integridade física | Regras de honestidade, confiança por norma, revisão humana obrigatória | Validação por especialista do conteúdo de SST antes de publicar |
| Empresa cliente | Documento que não reflete a prática → não conformidade | Média | Rascunho, marcador [CONFIRMAR], declaração de revisão | Monitorar sinalizações |
| Empresa cliente | Requisito legal inventado | Alta | Regra de honestidade, marcador de fonte oficial | Caso de guardrail específico por norma |
| Empresa cliente | Promessa implícita de certificação | Média | Regra 2, guardrail bloqueante | — |
| Pessoas cujos dados o cliente cola na plataforma | Exposição de dado pessoal | Média | Conversa não guardada, isolamento, orientação de não colar dado sigiloso | Termos e política de privacidade |
| Equipe do cliente | Perda de competência por dependência da ferramenta | Baixa a média | Orientação ao cliente sobre revisão competente | Acompanhar em piloto |
| Detentores de direito autoral (ISO, ABNT) | Reprodução de texto de norma | Média | Regra 1, guardrail bloqueante, exemplares fora do repositório | Consulta à ABNT (F0-1), adiada por decisão sua |

# EPIGE — Revisão dos arquivos existentes

Revisão de 09–10/09/2026 sobre os 19 arquivos entregues (14 HTML, 3 Markdown, 1 PDF, 1 DOCX).
Objetivo: saber exatamente o que existe, o que é redundante, o que está quebrado
e o que serve de base para retomar o trabalho.

> **Segunda leva (10/09).** Chegaram quatro documentos que não existiam na primeira
> revisão — identidade visual, modelo de custo, revisão completa — mais uma cópia da 8.2.
> A cópia é **byte-a-byte idêntica** à já arquivada (md5 `b8a48c29…`): nada a atualizar
> no protótipo. Os documentos mudam bastante o quadro; ver §6.

---

## 1. Inventário e veredito

| Arquivo original | Destino neste repositório | Veredito |
|---|---|---|
| `EPIGE_prototipo_8_2.html` | `prototipos/8.2/index.html` | **Canônico.** 42 telas. Superconjunto estrito de todas as versões anteriores. |
| `EPIGE_demo_10_2.html` | `prototipos/demo-10.2/index.html` | **Ativo.** Demonstração de ponta a ponta do requisito 10.2 com IA real. Peça mais avançada do conjunto. |
| `EPIGE_prototipo_6_0.html` | `_historico/6.0.html` | Superado. 35 telas, todas presentes na 8.2. |
| `EPIGE_prototipo_4_2_simbolo_corrigido.html` | `_historico/4.2-simbolo-corrigido.html` | Superado. Fonte do símbolo em PNG (617 KB embutido). |
| `EPIGE_prototipo_3_9_logo_embutida.html` | `_historico/3.9-logo-embutida.html` | Superado. |
| `EPIGE_prototipo_3_8_aprovacao_logo.html` | `_historico/3.8-aprovacao-logo.html` | Superado. |
| `EPIGE_prototipo_3_8_aprovacao_logo1.html` | — | **Descartado: byte-a-byte idêntico ao anterior.** |
| `EPIGE_prototipo_3_7_identidade_visual.html` | `_historico/3.7a-marca-svg-provisoria.html` | Superado. |
| `EPIGE_prototipo_3_7_identidade_visual1.html` | `_historico/3.7b-lockup-png-externo.html` | Superado. **Imagem quebrada** (ver §3). |
| `EPIGE_prototipo_3_7_identidade_visual2.html` | `_historico/3.7c-simbolo-png-externo.html` | Superado. **Imagem quebrada** (ver §3). |
| `..._identidade_visual3.html` / `..._4.html` | — | **Descartados: idênticos ao `visual2`.** |
| `EPIGE_opcoes_logo_preview.html` | `identidade/opcoes-logo-preview.html` | Referência. As 3 opções de marca avaliadas. |
| `EPIGE_roteiro_ate_lancamento.pdf` | `docs/roteiro-ate-lancamento.pdf` | **Ativo.** Plano mestre. Transcrito em `ROTEIRO.md`. |
| `EPIGE_prototipo_8_2.html` *(2ª leva)* | — | **Descartado: idêntico ao já arquivado.** |
| `EPIGE_revisao_completa.md` | `docs/revisao-completa.md` | **Ativo.** Auditoria de código + pesquisa normativa. Documento mais recente do conjunto. |
| `EPIGE_modelo_custo_precificacao.md` | `docs/modelo-custo-precificacao.md` | **Ativo.** Modelo de custo completo com preços, cenários e ponto de equilíbrio. |
| `EPIGE_identidade_visual.md` | `identidade/IDENTIDADE_VISUAL.md` | **Ativo.** Manual de marca, 13 seções. Fonte. |
| `EPIGE_identidade_visual.docx` | `identidade/EPIGE_identidade_visual.docx` | Mesmo conteúdo, formatado para distribuição. |

**14 arquivos HTML → 10 únicos.** Cinco eram cópias exatas (3 de `identidade_visual2`,
1 de `aprovacao_logo`, 1 da própria 8.2), provavelmente re-downloads da mesma versão.

## 2. A linhagem dos protótipos

```
3.7 (20 telas)  →  3.8 / 3.9 / 4.2  →  6.0 (35 telas)  →  8.2 (42 telas)
   núcleo do        iterações de       + conta, login,     + comercial, ajuda,
   produto          identidade         planos, jurídico,   contato, DPA, cookies,
                    visual            academy, "viva"      adquirir, MVP
```

Verificado por diff de identificadores de tela: **a 8.2 não perdeu nenhuma tela das
versões anteriores.** As demais existem só como registro histórico — a 8.2 é a única
que precisa ser mantida.

**Telas novas na 8.2 sobre a 6.0:** `adquirir`, `ajuda`, `comercial`, `contato`,
`cookies`, `dpa`, `mvp`.
**Telas novas na 6.0 sobre a 3.7:** `academy`, `autorais`, `cadastro`, `confirmacao`,
`conta`, `faq`, `login`, `noticias`, `onboarding`, `pagamento`, `privacidade`, `senha`,
`suporte`, `termos`, `viva`.

## 3. Problemas encontrados

### 3.1 Imagens quebradas nos protótipos 3.7b e 3.7c — *corrigido pela linhagem*
Essas duas versões referenciam arquivos externos que nunca acompanharam o HTML:

- `3.7b` → `<img src="EPIGE_logo_aprovada.png">`
- `3.7c` → `<img src="EPIGE_simbolo_oficial.png">`

Abertos isoladamente, mostram ícone de imagem quebrada no lugar da marca.
**Não precisa de conserto:** a partir da 6.0 a marca virou SVG inline (vetor, sem
dependência externa) e o problema desapareceu sozinho. Ficam no histórico como estão.

### 3.2 Modelo chamado ≠ modelo precificado — *pendente*
Este é o achado que mais importa, porque afeta o modelo de custo.

Tanto a `demo-10.2` quanto a `8.2` chamam a API com:

```js
{ model: "claude-sonnet-4-6", max_tokens: 1000, ... }
```

Mas o medidor de custo na tela declara, textualmente:

> "convertidos às tarifas de produção do **Claude Sonnet 5** (US$ 2 e US$ 10 por milhão)"

E o roteiro atribui Sonnet 5 ao Consultor, ao Analista e ao Legal/Regulatório.

Tarifas reais por milhão de tokens:

| Modelo | ID | Entrada | Saída |
|---|---|---|---|
| Claude Sonnet 5 | `claude-sonnet-5` | US$ 2 | US$ 10 |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | US$ 3 | US$ 15 |
| Claude Opus 5 | `claude-opus-5` | US$ 5 | US$ 25 |
| Claude Haiku 4.5 | `claude-haiku-4-5` | US$ 1 | US$ 5 |

Ou seja: **o custo real das chamadas da demo é 50% maior do que o número exibido**,
porque roda em Sonnet 4.6 e calcula em Sonnet 5. Correção de uma linha
(`claude-sonnet-4-6` → `claude-sonnet-5`), mas precisa ser feita antes de qualquer
apresentação em que o valor no medidor seja citado. Os arquivos foram arquivados
verbatim; a correção está no `BACKLOG.md` como item F1-1.

### 3.3 A demo só funciona dentro do ambiente Claude — *estrutural*
`demo-10.2` e a área "viva" da `8.2` chamam `https://api.anthropic.com/v1/messages`
direto do navegador, **sem chave de API e sem cabeçalho de autenticação**. Isso só
funciona dentro do runtime de artefatos do Claude, que injeta credencial no caminho.

Em qualquer outro lugar — arquivo local, GitHub Pages, notebook de cliente — a chamada
retorna erro e o painel exibe "IA indisponível". A própria demo detecta isso e mostra
o alerta, o que é um bom comportamento, mas não resolve o problema.

**Consequência prática:** essa demo não pode ser enviada por e-mail nem hospedada como
página. Para rodar fora do Claude, precisa de um proxy mínimo no servidor que guarde a
chave — que é, não por acaso, a primeira peça de backend real do projeto.

### 3.4 A demo 10.2 usa cores de marca fora do padrão — *pendente*
Descoberto ao confrontar os arquivos com o manual de identidade da segunda leva.
O gradiente do símbolo tem quatro paradas. A 8.2 e o manual concordam exatamente;
a `demo-10.2` diverge nas duas pontas:

| Parada | 8.2 + manual de marca | demo-10.2 |
|---|---|---|
| 1 (início) | `#2B52DC` azul profundo | `#4E74F0` ❌ |
| 2 | `#3273EE` | `#3273EE` ✅ |
| 3 | `#4391C7` | `#4391C7` ✅ |
| 4 (fim) | `#439397` verde-água | `#5FBDB0` ❌ |

Ponto (`#74D4C1`) e barra interna (`#3C8589`) batem nos dois.

Isso não é detalhe estético. O manual de identidade estabelece que o gradiente é
semântico — azul profundo é o rigor normativo, verde-água é o resultado — e veda
"recolorir fora da paleta". A demo está com as duas cores que carregam significado
trocadas por variantes mais claras.

**Já corrigido em parte:** o `identidade/simbolo-epige.svg` deste repositório foi
extraído da demo e por isso nasceu com as cores erradas. Foi corrigido para os valores
canônicos e verificado contra a 8.2. Falta corrigir a própria demo — item **ID-3**.

### 3.5 Peso dos arquivos
`4.2` tem 941 KB porque carrega o símbolo como PNG base64 de 617 KB — uma imagem
raster de 617 KB para um símbolo geométrico. O SVG equivalente
(`identidade/simbolo-epige.svg`) tem **1,6 KB**: 385× menor, e escala sem perda.
O manual de marca é explícito: *"sempre em SVG embutido, nunca em imagem vinculada
ou bitmap"*. Use sempre o SVG.

### 3.6 Qualidade do lockup raster
`identidade/originais/lockup-3.8-raster.png` é o lockup aprovado na 3.8, mas é uma
imagem gerada com artefatos visíveis: texto borrado e a palavra "TRANSFORMAR" cortada
na borda. Serve como referência de composição, **não como arte final**. O manual já
define as regras do lockup (peso 850, letter-spacing −1px, espaço de um terço da altura
do símbolo); falta executá-las em vetor.

## 4. O que já está resolvido e não precisa ser revisitado

- **Identidade visual — agora documentada.** Não só o símbolo está vetorizado e
  consistente: existe manual de marca completo com 13 seções, cobrindo significado,
  paleta, tipografia, escala φ, área de respiro e usos vedados. Isso fecha uma lacuna
  que eu havia listado como pendência na primeira revisão.
- **Arquitetura de informação.** 42 telas cobrindo produto, conta, comercial, jurídico
  e conteúdo. Está completa o bastante para guiar a implementação.
- **Estrutura de planos e preços.** Grátis / Consultor R$ 89 / Implantação R$ 279 /
  Empresarial R$ 1.490, com limites de uso definidos por plano — e agora com o modelo
  de custo por trás (`docs/modelo-custo-precificacao.md`): três faixas testadas contra
  margem de contribuição ≥ 35% no pior caso, ponto de equilíbrio por fase, teste de
  estresse e LTV/CAC. A faixa recomendada foi a escolhida.
- **Os três guardrails.** Direito autoral, imparcialidade do auditor e não-promessa de
  certificação estão escritos como regras de sistema na demo, não como sugestão — e a
  demo inclui botões que testam cada um ao vivo. É o ativo mais maduro do conjunto.

## 5. O que a demo 10.2 prova — e o que não prova

**Prova:** o ciclo completo funciona. Contexto da empresa → consultor explica o requisito →
redator gera procedimento sob medida → redator deriva o formulário RNC do procedimento →
auditor independente audita e classifica achados com evidência → fechamento com custo
real medido em tokens. Com guardrails ativos e testáveis por botão.

**Não prova:** que as respostas estão *certas*. Não há conjunto de avaliação. Nenhuma
pergunta com resposta correta conhecida foi rodada contra os agentes. Isso é exatamente
o que o roteiro chama de "camada de avaliação (evals)" e coloca como pré-requisito da
Fase 1 — e é o próximo passo recomendado no documento: **o Consultor ISO 9001 funcionando
de verdade, com 30 a 50 perguntas cuja resposta correta você define.**

A demo é a maquete desse agente. Falta o que mede se ele acerta.

---

## 6. O que a segunda leva de documentos muda

Três documentos que não existiam na primeira revisão. Dois deles mudam decisões.

### 6.1 A janela de transição das normas — a mudança mais importante

`docs/revisao-completa.md` traz pesquisa normativa que reposiciona o produto inteiro:

| Norma | Situação | Prazos |
|---|---|---|
| **ISO 14001:2026** | **Publicada em 15/04/2026**, substitui a de 2015 | 30/10/2027 encerra emissão na 2015 · 30/04/2029 certificados 2015 perdem validade |
| **ISO 9001:2026** | FDIS aprovado, publicação esperada para **setembro de 2026** | transição ~3 anos · primeiros certificados só no 2º semestre de 2027 |
| **ISO 45001** | Revisão em curso | publicação esperada para 2027 |

Duas consequências práticas:

**A EPIGE nasce dentro de uma transição simultânea das três normas.** Entre 2026 e 2029,
mais de um milhão de empresas certificadas precisam migrar de edição — cada uma
precisando de análise de lacuna, atualização documental e preparação de auditoria de
transição. A revisão completa chama isso de "a maior oportunidade comercial disponível
para o produto, e ela tem prazo", e propõe uma **ferramenta de análise de lacuna entre
edições** como a próxima coisa a construir. Concordo, e virou o item **F1-8** do backlog.

**Estamos hoje dentro do mês da publicação esperada da ISO 9001:2026.** O documento é de
agosto; hoje é 10/09/2026. Verificar se a publicação saiu é tarefa de agora, não de
depois — item **F0-7**. Se saiu, o conteúdo dos agentes precisa refletir a edição nova, e
a orientação "certifique na 2015 e transicione depois" passa a ser a mensagem comercial
mais valiosa do produto.

**Ponto de atenção sobre o escopo.** O roteiro de agosto recomenda lançar com **ISO 9001
apenas**. A revisão completa mostra a janela nas três normas. Não são recomendações
incompatíveis — a transição 9001:2015→2026 sozinha já é mercado suficiente, e a análise
de lacuna se constrói primeiro para a 9001. Mas a decisão de escopo (**F0-2**) precisa ser
tomada com essa informação na mesa, não sem ela.

### 6.2 A auditoria de código já foi feita — e três defeitos corrigidos

`docs/revisao-completa.md` registra auditoria da 8.2, com três defeitos já corrigidos no
arquivo que temos: dois `</span>` órfãos no cabeçalho, quatro campos de formulário sem
rótulo acessível, e — o mais grave — **agentes tratando a ISO 14001:2015 como vigente**.

Verificado por amostragem no arquivo arquivado: a 8.2 menciona `14001:2026`, `9001:2026`,
`FDIS`, e os prazos de 2027 e 2029. **As correções estão de fato no arquivo.**

Dívida técnica que a auditoria deixou registrada e que confirmei por contagem: nove blocos
`<style>` separados, 85 `!important`, **337 manipuladores `onclick` embutidos** (a revisão
diz 333; a diferença é irrelevante), nenhuma persistência, arquivo único de 322 KB. Nada
bloqueante para o protótipo, tudo relevante para quem for reescrever em produção.

Um ponto onde minha leitura complementa a auditoria: ela registra corretamente que **não
há chave de API embutida** — o que é um acerto de segurança. O que ela não diz, e importa,
é que também **não há autenticação nenhuma** na chamada ao `api.anthropic.com`, o que é
justamente o motivo de a demo só funcionar dentro do runtime do Claude (§3.3). As duas
observações são compatíveis: nenhuma chave vazada, e nenhuma chave disponível.

### 6.3 O modelo de custo tem uma linha nova: vigilância normativa

`docs/modelo-custo-precificacao.md` é o modelo completo. A revisão completa acrescenta a
ele um item que não estava previsto — a vigilância normativa usa busca web, cobrada à parte:

| Componente | Valor |
|---|---|
| Inferência (~9.000 tokens de entrada) | R$ 0,13 |
| Busca web (4 consultas a US$ 10/mil) | R$ 0,21 |
| **Total por execução** | **R$ 0,34** |

**É a operação mais cara da plataforma por execução — 2,6× uma consulta comum.** Sob
demanda por usuário não fecha: oito vigilâncias/mês no plano Consultor consomem 4% da
receita do plano num recurso secundário.

A conclusão do documento é uma decisão de arquitetura, não de preço: **a vigilância tem
que ser curadoria central, não consulta individual.** Uma execução por norma por dia,
resultado servido a todos, custa R$ 35,10/mês fixos — menos de 0,15 p.p. de margem
rateado entre 300 contas. No protótipo ela roda sob demanda porque não há servidor; em
produção não deve. Virou item **F2-3**.

### 6.4 O manual de identidade fecha uma pendência e abre outra

O manual (`identidade/IDENTIDADE_VISUAL.md`, 13 seções) resolve o que eu havia listado
como **ID-2**: significado do símbolo, paleta com hex, tipografia, área de respiro,
tamanho mínimo, usos vedados, e uma escala φ aplicada ao sistema.

Vale registrar a honestidade da seção 7, porque é o tipo de coisa que costuma ser
inflada em material de marca: o documento testou doze medidas do símbolo contra sete
constantes derivadas de φ, achou quatro razões a menos de 1% do alvo — e concluiu que
**isso é menos coincidência do que o acaso já produziria**, portanto o símbolo não foi
construído sobre φ. Em vez de alegar o contrário, adotou φ deliberadamente na escala
tipográfica, no espaçamento e na proporção de layout, onde havia liberdade real. É a
decisão certa: alegação verificável e falsa em material de marca é exatamente o que um
investidor com olho técnico manda checar.

E abre a pendência de §3.4: o manual estabelece a paleta canônica, e foi confrontando os
arquivos com ela que apareceu a divergência de cor da demo.

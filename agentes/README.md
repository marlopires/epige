# Os agentes

Os prompts que governam o comportamento dos agentes da EPIGE. **Esta pasta é a fonte de
verdade da aplicação publicada** — `web/build-prompts.mjs` gera o módulo que o servidor usa.

---

## Como um agente é montado

Um agente não é um prompt. É a composição de quatro camadas, nesta ordem:

```
base (identidade + regras invioláveis)
  → norma (qual norma, qual edição, mecanismos próprios)
    → conhecimento (modos de falha reais daquela norma)
      → papel (o que este agente faz)
        → contexto do cliente
```

**A ordem não é arbitrária.** As regras invioláveis vêm antes de tudo porque prompt é lido
em sequência, e o que vem depois não deve poder relaxar o que veio antes. O contexto do
cliente vai no fim porque é a única parte que muda a cada sessão — todo o resto é prefixo
estável, que é exatamente o que o cache de prompt sabe aproveitar. Essa escolha é o que
torna realizável a premissa de 85% de aproveitamento de cache do modelo de custo.

**Sessão combinada.** O auditor e o especialista em SGI aceitam uma norma principal e até
três adicionais. As camadas de norma e de conhecimento se repetem para cada uma, e entra
`conhecimento/integracao-entre-normas.txt`. Um bloco final, gerado pelo motor, diz ao
agente quais referenciais estão combinados e que a classificação é por referencial.

## Estrutura

### `base/` — vale para todo agente que fala com o usuário

| Arquivo | O que é |
|---|---|
| `00-identidade.txt` | Quem é o agente, para que a EPIGE existe, tom e idioma. |
| `01-regras-inviolaveis.txt` | As seis regras. Sem exceção, sem "entre nós". |
| `02-contexto-cliente.txt` | Template do contexto, com os marcadores `{{campo}}`. |

O orquestrador é o único que **não** carrega a base: ele não fala com o usuário, então
pagar token por identidade e conduta nele seria desperdício.

### `normas/` — onze referenciais

ISO 9001, 14001, 45001, ISO/IEC 27001, 37001, 37301, 39001, ISO/IEC 42001 e 50001, mais
**PBQP-H/SiAC** (`pbqp-h-siac.txt`, programa federal que se apoia na 9001) e **ABNT PR
2030** (`abnt-pr-2030.txt`, prática recomendada de ESG, **não certificável**).

Cada arquivo traz sigla, **edição vigente**, situação da revisão com prazos, o que muda na
próxima edição, e os **mecanismos próprios** da norma. O nível de confiança de cada um —
conferido contra exemplar ou não — fica em `web/functions/api/_motor.js`.

Os mecanismos próprios existem por causa da regra 5. Aspecto e impacto é da 14001; perigo e
risco ocupacional é da 45001; saída não conforme é da 9001. Um agente que mistura parece
erudito e está errado.

> **Este é o conteúdo de maior risco do repositório.** Edição errada aqui faz o agente dar
> orientação normativa errada com voz de autoridade — foi o defeito de gravidade alta
> registrado em `docs/revisao-completa.md`. Reverificar junto com
> `docs/situacao-normativa.md`, a cada trimestre.

### `conhecimento/` — onde as empresas realmente reprovam

Modos de falha compilados de auditorias reais, um arquivo por norma, mais um específico do
requisito 10.2. Cada modo tem sintoma, consequência e **a evidência que um auditor busca** —
é essa terceira parte que torna o conhecimento utilizável.

Quando a sessão tem escopo estreito (`escopo: "10.2"`), o conhecimento específico
substitui o geral da norma.

Três arquivos não são de modos de falha:

| Arquivo | Quem carrega |
|---|---|
| `principios-de-auditoria.txt` | Todo auditor, em qualquer norma — é a ISO 19011. |
| `integracao-entre-normas.txt` | Auditor e SGI. O que unifica, o que tem lógica própria e não deve ser fundido, os pares de normas, objetivos que competem e como conduzir auditoria combinada. |
| `avaliacao-de-maturidade.txt` | Auditor, quando a sessão inclui a PR 2030. Troca conformidade por estágio de maturidade, **só para ela**. |

Os prompts mandam **não recitar a lista**: nomear o padrão quando ele aparece no caso
concreto. Agente que despeja checklist parece competente e não ajuda ninguém.

### `papeis/` — os 14 agentes

| Agente | Modelo | O que faz |
|---|---|---|
| `orquestrador` | Haiku 4.5 | Classifica a intenção e roteia. Não fala com o usuário. |
| `diagnostico` | Sonnet 5 | Onde este cliente está e qual o primeiro passo. |
| `consultor` | Sonnet 5 | Entender e aplicar requisito. |
| `analista-documentos` | Sonnet 5 | Confronta documento do cliente com requisitos. |
| `auditor` + `auditor-relatorio` | **Opus 5** | Audita e emite relatório — uma norma ou combinada. Constata, não resolve. |
| `analise-causa` | Sonnet 5 | Conduz até a causa real, por perguntas encadeadas. |
| `plano-de-acao` | Sonnet 5 | Lacunas viram ações com responsável, prazo e verificação. |
| `redator` | Sonnet 5 | Redige o documento. |
| `formulario` | Sonnet 5 | Define os campos do registro. |
| `legal-regulatorio` | Sonnet 5 | Requisitos legais aplicáveis. |
| `especialista-sgi` | Sonnet 5 | Integração entre qualquer combinação dos onze referenciais. |
| `lacuna-edicoes` | Sonnet 5 | O que muda na transição de edição. |
| `vigilancia` | Sonnet 5 + busca | Monitora revisões e novidades. |

**Por que Opus só no auditor.** É o único papel em que o custo de errar é assimétrico: um
auditor complacente entrega relatório que passa tranquilidade falsa, e a empresa descobre na
certificação, quando custa caro. O roteamento em Haiku é o que paga esse Opus — é a decisão
de arquitetura que mais impacta o custo da operação.

## As seis regras invioláveis

1. **Direito autoral** — nunca reproduzir, transcrever ou parafrasear de perto o texto da
   norma. Explicar com linguagem própria, referenciar a cláusula, orientar a compra na ABNT.
2. **Certificação** — nunca prometer, sugerir ou estimar probabilidade de aprovação.
3. **Escopo** — responder sobre a norma da sessão; encaminhar o resto.
4. **Honestidade** — não inventar dado, prazo legal, limite ou exigência. Corrigir premissa
   falsa em vez de responder dentro dela.
5. **Não generalizar entre normas** — usar o mecanismo próprio de cada uma.
6. **A decisão técnica é do cliente** — a plataforma organiza; quem decide é a organização e
   quem julga é o auditor.

O auditor carrega uma sétima, que é a que separa auditoria de consultoria:
**constatar, não resolver** — e ela vale para pedido informal também, porque orientar é
consultar.

As seis primeiras estão testadas em `avaliacao/guardrails.json`, **incluindo três controles
negativos** — casos em que o agente deve responder. Sem eles, um agente que recusa tudo
pontuaria 100%, e a métrica mediria covardia em vez de calibragem.

## Marcadores de interpolação

`{{nome}}` `{{atividade}}` `{{porte}}` `{{nivel}}` `{{situacao}}` — todos preenchidos pelo
servidor a partir do contexto da empresa. Nenhum outro marcador deve existir: o build não
falha se sobrar um, mas ele chega ao modelo como texto literal.

## `_extraidos-*` — registro histórico

`_extraidos-demo-10.2/` e `_extraidos-prototipo-8.2/` são os prompts **extraídos dos
protótipos** em 15/09/2026, quando eles ainda viviam embutidos em `<script>`. Serviram de
matéria-prima para a estrutura atual e ficam como registro de origem.

**Não alimentam nada.** O build os ignora deliberadamente. Não edite esperando efeito.

## Quando mudar um prompt

```bash
# edite o .txt
node web/build-prompts.mjs
node avaliacao/rodar.mjs guardrails   # precisa de ANTHROPIC_API_KEY
git add -A && git commit -m "ajusta o consultor" && git push
```

Rodar os guardrails antes de publicar não é zelo excessivo: eles saem com código 2 e dizem
para não publicar. Uma mudança de redação num prompt pode abrir uma brecha que nenhuma
leitura atenta pega.

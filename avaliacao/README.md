# Conjunto de avaliação

Item **F1-2** do backlog — apontado como prioridade número um tanto pelo roteiro quanto
pela revisão completa.

---

## Por que isto é o item mais importante do projeto

A demo 10.2 prova que o ciclo funciona. Não prova que as respostas estão **certas**.

Sem conjunto de avaliação, toda alteração de prompt é um palpite: você muda uma frase,
a resposta fica diferente, e não há como saber se ficou melhor ou pior. Com conjunto de
avaliação, cada mudança vira um número comparável com o número anterior.

É a diferença entre engenharia e tentativa.

## A divisão de trabalho aqui é rígida

O roteiro é explícito, e concordo com ele:

> **Claude monta a estrutura. Você define a resposta correta.**

Você é auditor e conhece a norma. Eu escrevo com fluência, mas fluência não é correção —
e um erro de interpretação de requisito que passa despercebido vira orientação errada em
escala, para todo cliente, com voz de autoridade.

Por isso os dois arquivos são diferentes:

| Arquivo | Quem preenche | Por quê |
|---|---|---|
| `guardrails.json` | **Já está pronto** | O comportamento esperado decorre das nossas próprias regras, não de interpretação normativa. Eu posso especificar. |
| `iso-9001-10.2.json` | **Você** | Exige julgamento técnico sobre o que a norma exige. Não posso especificar sem inventar autoridade que não tenho. |

Nas 30 perguntas do segundo arquivo eu deixei `criterios` preenchidos como **rascunho** —
o que me parece que uma resposta correta precisa conter e o que não pode afirmar. Trate
isso como proposta a corrigir, não como gabarito. O campo `resposta_correta` está vazio de
propósito.

## Como preencher

Abra `iso-9001-10.2.json`. Para cada item:

```json
{
  "id": "10.2-003",
  "categoria": "correcao-vs-acao-corretiva",
  "pergunta": "...",
  "resposta_correta": "",        ← escreva aqui, em 2 a 5 linhas
  "criterios": {
    "deve_conter": ["..."],      ← corrija o rascunho
    "nao_pode_afirmar": ["..."]  ← corrija o rascunho
  },
  "peso": "alto"
}
```

Não precisa escrever a resposta que o agente daria. Escreva **o que torna uma resposta
certa** — os pontos que precisam estar lá e os erros que a desqualificam. É assim que um
avaliador automático consegue julgar sem depender de a redação bater palavra por palavra.

Se discordar de uma pergunta, mude a pergunta. Se ela não faz sentido, apague. Trinta bem
escolhidas valem mais que cinquenta genéricas.

## As categorias e por que cada uma existe

| Categoria | O que testa | Itens |
|---|---|---|
| `conceito` | Entendimento do que o requisito exige | 6 |
| `correcao-vs-acao-corretiva` | A confusão mais comum do tema | 4 |
| `analise-causa` | Profundidade — a raiz da maioria das NC | 4 |
| `evidencia-registro` | O que precisa ficar registrado | 4 |
| `verificacao-eficacia` | A etapa que quase todo mundo pula | 3 |
| `aplicado` | Se adapta ao setor e ao porte do cliente | 4 |
| `armadilha` | **Se inventa requisito que não existe** | 3 |
| `edicao` | 2015 vs 2026, e o que muda no 10.2 | 2 |

A categoria `armadilha` merece destaque. São perguntas cuja resposta correta é alguma
forma de *"a norma não exige isso"*. Um agente que quer agradar inventa requisito —
e requisito inventado é o defeito mais caro que um produto de consultoria normativa pode
ter, porque o cliente implementa, gasta e depois descobre em auditoria.

## Como rodar

```bash
export ANTHROPIC_API_KEY=sk-ant-...
node avaliacao/rodar.mjs guardrails
node avaliacao/rodar.mjs iso-9001-10.2
node avaliacao/rodar.mjs                  # todos
```

Na nuvem do Claude Code, **não** use variável de ambiente para a chave: ali ela fica
visível para quem usa o ambiente e não chega às sessões. Cadastre-a em **Credenciais de
API** do ambiente, para `api.anthropic.com`. O proxy injeta a chave na chamada, a sessão
nunca vê o valor, e o avaliador detecta isso sozinho.

O avaliador regenera os prompts, monta o sistema com **o mesmo motor da aplicação
publicada** (`web/functions/api/_motor.js`) e chama o **mesmo modelo que o agente usa em
produção** — Opus nos casos de auditor. Depois submete a resposta a um segundo modelo que
julga contra os critérios. Casos antigos, sem declaração, rodam na sessão da demo (ISO 9001,
escopo 10.2); casos novos declaram `agente`, `norma`, `escopo` e, se for sessão combinada,
`adicionais`. Grava `avaliacao/resultados/<data>.json`
e imprime o placar.

**Isso ainda não pode rodar.** Falta a conta de API em nome da empresa (**F0-6**). Enquanto
isso, o script existe para ser revisado, e para que no dia em que a conta existir seja uma
linha de comando, não uma semana de trabalho.

### Custo estimado

60 casos (22 guardrails + 30 de conteúdo da 9001 + 8 de saúde e segurança do trabalho) × (1 chamada ao agente + 1 ao avaliador). Com o
modelo de produção para o agente — Sonnet 5 na maioria, Opus 5 nos 4 casos de auditor — e
Sonnet 5 no avaliador, ordem de **R$ 1 a R$ 4 por rodada completa** nas tarifas do
`modelo-custo-precificacao.md`. Barato o suficiente para rodar a cada mudança de prompt,
que é exatamente o ponto.

## Como ler o resultado

Três números importam, em ordem:

1. **Guardrails: precisa ser 100%.** Qualquer falha aqui é bloqueante. Um agente que
   reproduz texto de norma uma vez em vinte é um agente que reproduz texto de norma.
2. **Peso alto: meta acima de 90%.** São as perguntas que um cliente realmente faz.
3. **Geral:** acompanhe a tendência entre rodadas, não o valor absoluto.

Guarde todas as rodadas. O valor do conjunto está na série histórica — uma rodada isolada
diz pouco; vinte rodadas dizem se o produto está melhorando.

## Ampliação

Quando a 9001 estiver estável, replicar para 14001 e 45001. A estrutura é a mesma; muda o
conteúdo. E vale um conjunto próprio para a **análise de lacuna entre edições**
(**F1-8**), que é a ferramenta com prazo comercial.

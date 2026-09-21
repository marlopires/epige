# O que precisa da sua revisão

Em 16/09 você delegou as decisões de conteúdo para destravar a fase de teste. Concordo com
a decisão — sem publicar e medir, gabarito é teoria. Mas delegação não apaga o risco, então
este arquivo existe para que ele fique **visível e rastreável** em vez de esquecido.

**Regra:** nenhum número saído da avaliação sustenta decisão de produto enquanto a linha
correspondente aqui estiver aberta.

---

## Estado

| Conjunto | Escrito por | Validado | Consequência de estar errado |
|---|---|---|---|
| `guardrails.json` | Claude | **Não precisa** | Baixa. O comportamento esperado decorre das regras da EPIGE, que são nossas. |
| `iso-9001-10.2.json` | Claude, 21/09/2026 | ❌ **Não** | **Alta.** Gabarito errado treina o agente para o erro e o mede como acerto. |

## Por que isto importa mais do que parece

Um gabarito errado é pior que gabarito nenhum. Sem gabarito, você sabe que não sabe. Com
gabarito errado, o painel mostra 95% e você confia — enquanto o agente aprende a repetir
uma interpretação equivocada, com voz de autoridade, para todo cliente.

O risco não é o agente errar. É o conjunto de avaliação **premiar** o erro.

## As sete que eu revisaria primeiro

Escolhidas por risco, não por ordem. São aquelas em que a distinção é fina e onde eu tenho
mais chance de ter escorregado:

| Caso | Por que esta |
|---|---|
| **10.2-017** | Digo que o 10.2 não exige procedimento documentado explicitamente. É a afirmação mais arriscada do conjunto: se eu estiver errado, o agente vai dispensar algo obrigatório. |
| **10.2-005** | Quando é legítimo parar na correção. Errar para o lado permissivo ensina o agente a autorizar o atalho que gera reincidência. |
| **10.2-026** | Digo que classificar em maior/menor é prática do certificador, não requisito. Se alguma exigência setorial contradisser isso, a resposta vira armadilha invertida. |
| **10.2-030** | A fronteira entre 8.7 e 10.2. Descrevi de memória o alcance do 8.7 — confira se não estendi demais. |
| **10.2-002** | A ação corretiva ser "apropriada aos efeitos" é o que sustenta a resposta inteira. Se a leitura estiver torta, seis outras caem junto. |
| **10.2-016** | Menciono três anos como prática comum de retenção. Tenho certeza de que não é requisito; tenho menos certeza de que seja mesmo o costume dominante no Brasil. |
| **10.2-021** | O caso aplicado à metalúrgica. Risco de eu ter contaminado com IATF 16949 sem perceber, por ser setor automotivo. |

## Como revisar sem virar um projeto

Não precisa reescrever. Para cada caso, três perguntas:

1. **A resposta está correta?** Se sim, marque e siga.
2. **Falta algo que um auditor cobraria?** Acrescente ao `deve_conter`.
3. **Tem alguma afirmação que você não assinaria?** Corrija o texto e registre aqui embaixo.

Quando validar um caso, marque na lista. Quando o conjunto inteiro estiver validado, mude
`validado_por_especialista` para `true` no JSON e apague este arquivo — ele terá cumprido
a função.

## Registro de correções

Conforme você for corrigindo, anote aqui o que mudou e por quê. Serve para eu não repetir
o mesmo erro nos conjuntos da 14001 e da 45001.

| Data | Caso | O que estava errado | Correção |
|---|---|---|---|
| | | | |

## Outros conteúdos não validados

Além do gabarito, estes também foram escritos por mim e carregam interpretação normativa:

- **`agentes/`** — os prompts. Os que vieram dos protótipos são seus; o bloco `EDIÇÃO` que
  acrescentei em 15/09 é meu.
- **`docs/orientacao-transicao-9001.md`** — orientação de transição. Baseada em fontes
  secundárias convergentes, não na norma nem no anúncio do IAF.
- **`docs/situacao-normativa.md`** — datas e prazos. Mesma ressalva, já registrada no
  próprio arquivo.

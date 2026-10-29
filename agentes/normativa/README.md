# Normativa — comentários da EPIGE, item a item

O que o cliente vê quando clica num item de norma (em resposta da IA, em documento ou na
tela **Normativa**). Cada arquivo `.md` desta pasta vira um referencial na plataforma,
gerado por `web/build-prompts.mjs`.

## A regra que não se quebra

**Isto é comentário, não a norma.** Texto de norma é protegido por direito autoral
(Lei 9.610/98) — e reescrever a norma inteira com outras palavras, item por item, continua
sendo reprodução: a lei protege também a adaptação. Por isso cada item aqui tem:

- **número e título do item** — o que permite ao cliente achar o item no exemplar dele;
- **comentário autoral** — do que o item trata, como se atende na prática, o que a
  auditoria procura e onde as empresas costumam errar.

O comentário explica e orienta; não lista o que a norma "deve" item por item nem segue a
redação dela frase a frase. Quem precisa do texto oficial consulta o exemplar licenciado.

Os exemplares servem para **conferir** número, título e interpretação — nunca são copiados
para cá (decisão de 22/09/2026 no `BACKLOG.md`).

## Formato

```
---
norma: iso-14001
rotulo: ISO 14001
titulo: Sistemas de gestão ambiental
edicao: ABNT NBR ISO 14001:2026 (adoção idêntica da ISO 14001:2026)
conferido: exemplar ABNT, outubro de 2026
---

# 4 Contexto da organização
Do que trata: abertura da seção — uma frase.

## 4.1 Entendendo a organização e seu contexto
Do que trata: ...
Na prática: ...
Na auditoria: ...
Mudou nesta edição: ...
```

- `#` é seção; `##` é item. O número vem primeiro, o título depois.
- `Do que trata:` é obrigatório. `Na prática:`, `Na auditoria:` e `Mudou nesta edição:`
  são opcionais. Um campo pode continuar nas linhas seguintes.
- O `norma:` precisa ser o mesmo id de `NORMAS` em `web/functions/api/_motor.js` quando o
  referencial também existe para os agentes — é o que liga o "requisito 6.1.2" de uma
  resposta ao comentário certo.

Depois de editar: `node web/build-prompts.mjs`.

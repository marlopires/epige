# EPIGE — Inteligência para Excelência em Gestão

Espaço de trabalho do projeto EPIGE: plataforma brasileira de inteligência para gestão da
qualidade, com escopo de lançamento em ISO 9001.

---

## Por onde começar

| Documento | O que é |
|---|---|
| **[`DIAGNOSTICO.md`](DIAGNOSTICO.md)** | Revisão dos 19 arquivos entregues: o que existe, o que é duplicata, o que está quebrado, o que já está resolvido. **Comece por aqui.** |
| **[`BACKLOG.md`](BACKLOG.md)** | O que fazer, em ordem, com caixas de marcar. E o registro de decisões. Tem um item com data — F0-7. |
| **[`ROTEIRO.md`](ROTEIRO.md)** | Plano até o lançamento: riscos, fases 0 a 5, linha do tempo, divisão de trabalho. Transcrição estruturada do PDF original. |

### Documentos de referência

| Documento | O que é |
|---|---|
| [`docs/revisao-completa.md`](docs/revisao-completa.md) | O mais recente. Auditoria de código da 8.2 + pesquisa normativa que reposiciona o produto. |
| [`docs/modelo-custo-precificacao.md`](docs/modelo-custo-precificacao.md) | Modelo de custo: preços de inferência, cenários de uso, margem, ponto de equilíbrio, estresse. |
| [`identidade/IDENTIDADE_VISUAL.md`](identidade/IDENTIDADE_VISUAL.md) | Manual de marca em 13 seções. Paleta canônica, tipografia, escala φ, usos vedados. |
| [`docs/situacao-normativa.md`](docs/situacao-normativa.md) | Qual edição de cada ISO está vigente, com prazos e fontes. **Reverificar a cada trimestre.** |
| [`docs/orientacao-transicao-9001.md`](docs/orientacao-transicao-9001.md) | Orientação de transição para clientes. Pronta para virar página, e-mail ou conversa comercial. |
| [`agentes/README.md`](agentes/README.md) | Os prompts que governam os agentes, e a ressalva de sincronia com o HTML. |
| [`avaliacao/README.md`](avaliacao/README.md) | Como preencher e rodar o conjunto de avaliação. **Tem uma parte que só você pode fazer.** |

## Estrutura

```
.
├── DIAGNOSTICO.md              revisão do material existente
├── ROTEIRO.md                  plano até o lançamento
├── BACKLOG.md                  próximos passos + registro de decisões
├── agentes/                    ← PROMPTS versionados · 15 arquivos + README
├── avaliacao/                  ← CONJUNTO DE AVALIAÇÃO · 43 casos + executor
├── prototipos/
│   ├── 8.2/index.html          ← CANÔNICO · 42 telas · toda alteração vem aqui
│   ├── demo-10.2/index.html    ← demo ao vivo do requisito 10.2, com IA real
│   └── _historico/             versões 3.7 a 6.0 · leitura, não edição
├── identidade/
│   ├── IDENTIDADE_VISUAL.md    ← MANUAL DE MARCA · 13 seções
│   ├── EPIGE_identidade_visual.docx   mesmo conteúdo, para distribuição
│   ├── simbolo-epige.svg       ← FONTE DA MARCA · vetor, 1,6 KB
│   ├── simbolo-epige.png       raster equivalente, para onde SVG não serve
│   ├── opcoes-logo-preview.html  as 3 opções avaliadas
│   └── originais/              PNGs extraídos dos protótipos
└── docs/
    ├── situacao-normativa.md        qual edição de cada ISO vale, com prazos e fontes
    ├── orientacao-transicao-9001.md conteúdo de orientação para clientes
    ├── revisao-completa.md          auditoria de código + pesquisa normativa
    ├── modelo-custo-precificacao.md modelo de custo e preços
    └── roteiro-ate-lancamento.pdf   original de 12/08/2026
```

## Estado do projeto em uma frase

Maquete madura com identidade documentada, modelo de custo fechado e 42 telas desenhadas,
mais **uma demo que já roda IA de verdade de ponta a ponta** no requisito 10.2 — e nenhuma
medição de se as respostas estão certas. O próximo marco é o Consultor ISO 9001 com
conjunto de avaliação.

**E há um relógio correndo.** A ISO 14001:2026 foi publicada em abril; a **ISO 9001:2026
publica em 16 de setembro de 2026**, data confirmada; a 45001 vem em 2027. Entre 2026 e
2029, mais de um milhão de empresas certificadas precisam migrar de edição — e os
primeiros certificados na edição nova só saem no 2º semestre de 2027, porque os
certificadores precisam ser acreditados antes. É a maior oportunidade comercial do
produto, e ela tem prazo. Ver `docs/situacao-normativa.md`.

## Como rodar os protótipos

Abra o `index.html` no navegador. Duas ressalvas:

- **Protótipo 8.2** — navegação e telas funcionam offline. As áreas "viva" e "MVP" chamam
  IA e vão exibir *"IA indisponível"*.
- **Demo 10.2** — precisa do runtime de artefatos do Claude para autenticar na API. Fora
  dele, exibe o alerta de conexão e os agentes não respondem. Item **F1-5** do backlog
  resolve isso com um proxy. Ver `DIAGNOSTICO.md` §3.3.

## Convenções

- **Um protótipo canônico.** Alterações vão para `prototipos/8.2/`. `_historico/` é
  somente leitura — está ali para registro, não para consulta de trabalho.
- **A marca é o SVG.** `identidade/simbolo-epige.svg`, cores conferidas contra o manual
  e contra a 8.2. Os PNGs são derivados. O manual veda bitmap para o símbolo.
- **Decisões viram linha no `BACKLOG.md`**, com data. O que está decidido não se re-discute.
- **Prompt alterado no HTML, prompt reextraído.** O protótipo é a fonte; `agentes/` é
  derivado. Até a reescrita para produção, editar só um dos dois cria divergência silenciosa.

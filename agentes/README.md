# Prompts dos agentes

Os prompts que governam o comportamento dos agentes da EPIGE, extraídos dos protótipos
para ficarem versionados. Item **F1-3** do backlog.

---

## Por que isso existe

Até 15/09/2026 as regras dos agentes viviam embutidas em `<script>` dentro do HTML.
Funciona para demonstrar, mas torna impossível responder à pergunta mais importante de
engenharia de prompt: **"o que mudou desde a última vez que o agente respondia bem?"**

Com os prompts em arquivo, cada alteração vira um diff. Sem isso, o conjunto de avaliação
(**F1-2**) não tem como atribuir uma mudança de resultado a uma mudança de causa.

## Um aviso honesto sobre sincronia

**Estes arquivos são extraídos dos protótipos, não consumidos por eles.** O protótipo
continua sendo o artefato que roda; estes `.txt` são a cópia legível e versionável.

Isso significa que **as duas cópias podem divergir** se alguém editar só uma. Até a
reescrita para produção (**F2-4**), a regra é:

> **O HTML é a fonte. Os `.txt` são derivados.**
> Alterou o prompt no protótipo, rode o extrator de novo.

Na reescrita, a direção se inverte: os arquivos viram a fonte e a aplicação os carrega.
É assim que deve terminar — mas afirmar que já é assim seria falso.

### Como reextrair

O extrator resolve a concatenação de literais JavaScript e troca as interpolações por
marcadores `{{campo}}`. Ele vive fora do repositório, no diretório de trabalho da sessão;
se precisar de novo, é um script de ~40 linhas que:

1. varre o bloco a partir da linha de início da função ou da atribuição `var sys = ...`;
2. junta os literais entre aspas simples, resolvendo `\n`, `\'` e `\\`;
3. substitui `N().sigla`, `p.nome`, `n.transicao` etc. por `{{sigla}}`, `{{nome}}`, `{{transicao}}`.

## O que tem aqui

### `demo-10.2/` — a demonstração do requisito 10.2

| Arquivo | Agente |
|---|---|
| `00-regras-base.txt` | As quatro regras invioláveis + contexto do cliente. Prefixo de todos os demais. |
| `01-consultor.txt` | Explica o requisito, adaptado ao nível do interlocutor. |
| `02-redator-procedimento.txt` | Redige o procedimento documentado. |
| `03-redator-formulario.txt` | Deriva o formulário RNC do procedimento. |
| `04-auditor-base.txt` | Regra de imparcialidade: constata, não resolve. |
| `05-auditor-auditoria.txt` | Audita o procedimento e classifica achados. |

### `plataforma/` — o protótipo 8.2

| Arquivo | Agente |
|---|---|
| `00-regras-base-rnc.txt` | Base do fluxo de tratamento de RNC. |
| `01-regras-base-mvp.txt` | Base do MVP, com situação da revisão e achados recorrentes por norma. |
| `02-consultor.txt` | Consultor por norma. |
| `03-redator.txt` | Redator de documentos. |
| `04-analista-documentos.txt` | Confronta documento do cliente com requisitos. |
| `05-tratamento-10-2.txt` | Tratamento de não conformidade. |
| `06-auditor.txt` | Auditor interno por norma. |
| `07-especialista-sgi.txt` | Integração 9001 / 14001 / 45001. |
| `08-vigilancia-normativa.txt` | Monitora revisões e novidades. Usa busca web. |

## As regras que se repetem em todos

Quatro delas aparecem em praticamente todo prompt, e são identidade do produto tanto
quanto a cor da marca:

1. **Direito autoral** — nunca reproduzir, transcrever ou parafrasear de perto o texto da
   norma. Explicar com linguagem própria, referenciar a cláusula por número, orientar a
   compra junto à ABNT.
2. **Certificação** — nunca prometer, sugerir ou insinuar que a EPIGE garante ou acelera
   certificação.
3. **Escopo** — responder sobre a norma do agente; encaminhar o resto.
4. **Honestidade** — não inventar dados, prazos legais nem exigências.

O agente auditor carrega uma quinta, que é a que separa auditoria de consultoria:
**constatar, não resolver.**

O prompt base do MVP carrega ainda uma sexta, mais sutil e muito fácil de violar:
**não generalizar entre normas** — usar o mecanismo próprio de cada uma, não o
equivalente de outra.

Todas elas estão escritas como regra de sistema, não como pedido. O item **F1-4** as
transforma em teste automatizado, que é o que separa "pedimos educadamente" de "bloqueia".

## Marcadores de interpolação

| Marcador | Origem |
|---|---|
| `{{nome}}` `{{atividade}}` `{{porte}}` `{{nivel}}` `{{situacao}}` | Contexto da empresa |
| `{{sigla}}` `{{nome}}` (em contexto de norma) | Norma selecionada |
| `{{transicao}}` | Situação da revisão da norma — **ver `docs/situacao-normativa.md`** |
| `{{achados}}` | Não conformidades recorrentes observadas em auditorias reais |

O `{{transicao}}` é o marcador mais perigoso do conjunto: é por ele que entra a informação
de qual edição está vigente. Um valor desatualizado ali faz o agente dar orientação
normativa errada com voz de autoridade — que é exatamente o defeito de gravidade alta
registrado na `docs/revisao-completa.md`.

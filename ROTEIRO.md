# EPIGE — Do protótipo ao lançamento

Transcrição estruturada de `docs/roteiro-ate-lancamento.pdf` (12/08/2026), para que o
conteúdo fique versionável, pesquisável e citável em commits. O PDF permanece como
original assinado.

---

## Onde estamos

**Existe:** protótipo HTML navegável, identidade visual definida, documento técnico
funcional, modelo de custo com preços calculados.

**Não existe:** código que funcione de verdade. O protótipo é maquete — telas estáticas,
botões chamando `alert()`, nenhum agente respondendo. Normal e correto para o estágio,
mas a distância entre maquete e produto é a maior parte do trabalho que resta.

> Atualização de 09/09/2026: a `demo-10.2` já é uma exceção parcial a isso — tem IA real
> e ciclo completo. Continua sem avaliação de acerto. Ver `DIAGNOSTICO.md` §5.

## Os três riscos que podem matar o projeto

### 1. Direito autoral sobre as normas — risco alto
Normas ISO/ABNT são obra protegida. Reproduzir texto de requisito, mesmo "só para
consulta interna do agente", cria exposição jurídica real.

Consequências de arquitetura:
- A base de conhecimento **não pode ser** o texto das normas indexado.
- Os agentes **não podem citar** requisitos verbatim ao usuário.
- É legítimo: referenciar cláusulas por número, explicar requisitos com linguagem
  própria, orientar sobre como atendê-los — o que consultores fazem legalmente há décadas.

Não inviabiliza o produto; inviabiliza um atalho. A base precisa ser **conhecimento
interpretativo autoral** — mais trabalhoso, e o principal ativo defensável da EPIGE.

**Ação:** consultar a ABNT sobre licenciamento e falar com advogado de PI antes de
construir a base. Semana 1.

### 2. Responsabilidade sobre a orientação — risco médio-alto
Se um cliente reprova em auditoria seguindo a plataforma, qual é a exposição? Precisa
estar resolvido em termos de uso, em comunicação de produto e no comportamento dos agentes.

Três regras do documento técnico que precisam virar código, não texto:
- auditor ≠ consultor durante auditoria
- certificação não se "compra"
- PR 2030 não é norma ISO certificável

**Ação:** transformar em guardrails testáveis, não em recomendação no prompt.

### 3. LGPD sobre documentos de clientes — risco médio
A plataforma recebe procedimentos, políticas e evidências — internos e às vezes sensíveis.
Exige base legal definida, política de retenção e decisão explícita sobre uso de dados de
cliente para melhoria de modelo.

**Ação:** definir antes do primeiro upload real, não depois.

## Fase 0 — Decisões que travam tudo
*~3 semanas · precisa de você, não de código*

| Decisão | Por que trava | Quem resolve |
|---|---|---|
| Licenciamento de conteúdo normativo | Define a arquitetura da base inteira | Você + ABNT + advogado |
| Enquadramento tributário | Move ~9,5 p.p. de margem | Você + contador |
| Escopo do MVP: quantas normas? | Multiplica ou divide o esforço | Você |
| Limites de responsabilidade | Define termos de uso e comportamento dos agentes | Você + advogado |
| Constituição da empresa e conta no Claude Platform | Sem isso não há API em produção | Você |

**Recomendação forte sobre escopo:** lançar com **ISO 9001 apenas**, mais requisitos
legais. Não com nove referenciais. Fazer bem uma norma leva a produto; fazer
superficialmente nove leva a demonstração. A ISO 9001 é a de maior mercado, a que o
gestor do zero procura primeiro, e a que você domina para validar as respostas.

## Fase 1 — Arquitetura de agentes
*~4 semanas*

| Agente | Modelo | Função |
|---|---|---|
| Orquestrador | Haiku 4.5 | Classifica intenção, roteia, monta contexto |
| Consultor ISO 9001 | Sonnet 5 | Interpreta requisitos, orienta implementação |
| Analista de documentos | Sonnet 5 | Confronta documento do cliente com requisitos |
| Auditor interno | Opus 5 | Conduz auditoria simulada — impedido de consultar |
| Legal/Regulatório | Sonnet 5 | Requisitos legais por atividade e local |
| Pesquisador | Sonnet 5 + busca | Monitora atualizações normativas |

O roteamento por Haiku custa ~R$ 0,01 por interação e é o que permite usar Opus só onde
ele é necessário. É a decisão de arquitetura que mais impacta o custo.

**O que precisa existir junto:**
- Base de conhecimento autoral — a parte mais lenta e mais valiosa
- Guardrails testáveis — regras que bloqueiam, não que pedem educadamente
- Camada de avaliação (evals) — perguntas com resposta correta conhecida, rodadas a cada
  mudança de prompt. Sem isso não há como saber se uma alteração melhorou ou piorou.
- Telemetria por tipo de interação — desde a primeira linha, senão o modelo de custo
  nunca é validado

**Entregável:** uma página funcional com o Consultor ISO 9001 respondendo de verdade.
Não a plataforma inteira — um fluxo real, testável por você e 2–3 pessoas de confiança.
É o marco que transforma a EPIGE de ideia em coisa.

## Fase 2 — MVP funcional
*~8 semanas · precisa de desenvolvedor*

Três fluxos ponta a ponta:
1. Diagnóstico inicial → perfil da empresa gera caminho sugerido
2. Consulta ao consultor → com contexto da empresa e histórico
3. Análise de documento → upload, confronto com requisitos, lacunas apontadas

Mais o que sustenta: autenticação, banco, armazenamento de documentos, RAG sobre a base
autoral, controle de limite de uso por plano.

Aqui é preciso um desenvolvedor — alguém que faça deploy, mantenha infraestrutura,
responda a incidente às duas da manhã e decida arquitetura de dados com você. Se não
houver essa pessoa, ela é a contratação número um.

## Fase 3 — Piloto fechado
*~6 semanas · valida ou derruba o modelo de custo*

10 a 15 usuários reais, preferencialmente consultores e gestores da sua rede.

| Métrica | Premissa atual | Confiança |
|---|---|---|
| Consultas/mês por usuário | 80 (Consultor) | Baixa |
| Aproveitamento de cache | 85% | Média |
| Tickets de suporte/conta | 0,18/mês | Baixa |
| Taxa de acerto dos agentes | — | Nenhuma |
| Custo real de IA por conta | R$ 20,99 | Média |

Se os volumes reais ficarem muito acima das premissas, os preços mudam antes do
lançamento — que é exatamente o objetivo de medir antes.

## Fase 4 — Prontidão comercial
*~4 semanas*

Cobrança recorrente (Pix e cartão) com controle de excedente · termos de uso, política de
privacidade e DPA · fluxo de suporte e base de ajuda · página pública com preços (o
diferencial que nenhum concorrente brasileiro tem) · onboarding sem atrito no plano gratuito.

## Fase 5 — Lançamento

Sequência, não big bang:
1. Beta aberto com lista de espera — 4 semanas, capacidade controlada
2. Lançamento do gratuito + Consultor
3. Implantação e Empresarial — 4 a 6 semanas depois, com casos reais do beta como prova

## Linha do tempo

| Fase | Duração | Acumulado |
|---|---|---|
| 0 — Decisões | 3 semanas | 3 sem |
| 1 — Arquitetura de agentes | 4 semanas | 7 sem |
| 2 — MVP funcional | 8 semanas | 15 sem |
| 3 — Piloto fechado | 6 semanas | 21 sem |
| 4 — Prontidão comercial | 4 semanas | 25 sem |
| 5 — Lançamento | 4 semanas | **29 semanas ≈ 7 meses** |

Fases 1–2 e 3–4 têm sobreposição parcial. Com execução apertada, 5 a 6 meses. Com uma
pessoa só e tempo parcial, mais.

## Divisão de trabalho

| Trabalho | Claude | Você | Terceiro |
|---|---|---|---|
| Prompts e arquitetura de agentes | ✔ integral | revisa conteúdo técnico | — |
| Base de conhecimento autoral | ✔ estruturo e redijo | valida tecnicamente | — |
| Conjunto de avaliação (evals) | ✔ monto | define resposta correta | — |
| Código de backend e frontend | ✔ escrevo | — | faz deploy e opera |
| Infraestrutura e produção | — | — | ✔ desenvolvedor |
| Decisões jurídicas | — | ✔ | advogado |
| Decisões tributárias | — | ✔ | contador |
| Preço, marca, posicionamento | apoio com dados | ✔ decide | — |
| Relacionamento com piloto | — | ✔ | — |

A coluna do meio é a que não pode ser terceirizada nem automatizada. A validação técnica
do conteúdo normativo é sua — um erro de interpretação que passa despercebido vira
orientação errada em escala.

## Sobre custo de operação

Duas coisas separadas que costumam ser confundidas:

- **Assinatura Claude (claude.ai)** — o que você usa para trabalhar. Cobre a construção.
- **Claude Platform (API)** — o que a EPIGE consome quando um cliente conversa com um
  agente. Cobrança separada, por token, em conta própria no console.

A assinatura **não** cobre uso de produção. A conta de API precisa ser criada em nome da
empresa. Durante o desenvolvimento o consumo é baixo — testes e evals custam poucas
dezenas de reais por mês. O custo sobe quando entram usuários reais: R$ 21 a R$ 30 por
conta Consultor por mês.

## Próximo passo recomendado

Enquanto a Fase 0 corre em paralelo (advogado, contador, ABNT), começar pela peça de
maior valor e menor dependência:

> **O Consultor ISO 9001 funcionando de verdade, com conjunto de avaliação.**

Não a plataforma. Um agente, bem construído, com 30 a 50 perguntas de teste cuja resposta
correta você define. É o que prova que a tese funciona, é o que se mostra para um sócio ou
investidor, e é a fundação sobre a qual todos os outros agentes são construídos.

Se esse agente não convencer você — que é auditor e conhece a norma — nada adiante
convence o mercado.

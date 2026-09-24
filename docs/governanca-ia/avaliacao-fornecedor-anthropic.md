# Avaliação do fornecedor de IA — Anthropic

**Fornecedor:** Anthropic, PBC · **Serviço:** Claude API (`api.anthropic.com`)
**Criticidade:** crítica — sem este fornecedor, a EPIGE não entrega nenhum agente.
**Avaliação:** 24/09/2026, com base em documentação pública do fornecedor.
**Resultado:** **aprovado com condições** (ver fim do documento).
**Reavaliar:** na criação da conta de API; a cada mudança nos termos comerciais; a cada
aviso de descontinuação de modelo usado; e, no mínimo, uma vez por ano.

> Esta avaliação usa a documentação pública. O que vale contratualmente são os **termos
> comerciais e o adendo de tratamento de dados aceitos na conta** — confira os pontos
> marcados como *confirmar na conta* quando ela for criada.

---

## 1. O que a EPIGE envia ao fornecedor

Em cada chamada: o prompt de sistema (regras, norma, conhecimento, papel e o contexto da
empresa — nome, atividade, porte, nível, situação) e a conversa ou o documento que o
usuário colou. **Pode conter dado pessoal** se o usuário colar. Não enviamos: senha, e-mail
de usuário, dado de sessão, nem conteúdo de outros clientes.

## 2. Critérios e evidências

| Critério | O que a documentação pública diz | Situação |
|---|---|---|
| **Uso para treinamento** | Dado retido não é usado para treinar modelo sem permissão expressa do cliente; os termos comerciais vedam treinamento com conteúdo do cliente. | ✅ Atende |
| **Retenção** | Entradas e saídas da API são apagadas em até 30 dias. | ✅ Atende |
| **Exceção de retenção** | Conversa sinalizada pelos sistemas automáticos de segurança do fornecedor pode ser retida por até 2 anos; também há retenção por exigência legal. | ⚠️ Informar na política de privacidade |
| **Retenção zero (ZDR)** | Existe acordo de retenção zero para clientes corporativos elegíveis; a API de mensagens, o cache de prompt e a busca na web são elegíveis. | ➖ Não contratado; avaliar quando houver volume |
| **Local do processamento** | Armazenamento em repouso: somente EUA. Processamento: global por padrão, ou só EUA com custo 10% maior. Não há opção Brasil. | ⚠️ Transferência internacional — ver item 3 |
| **Descontinuação de modelo** | Aviso mínimo de 60 dias antes de aposentar modelo publicado, por e-mail e na documentação. | ✅ Atende |
| **Modelos usados pela EPIGE** | `claude-sonnet-5`: ativo, aposentadoria não antes de 30/06/2027. `claude-opus-5`: ativo, não antes de 24/07/2027. `claude-haiku-4-5`: ativo, **não antes de 15/10/2026**. | ⚠️ Haiku perto da data mínima |
| **Uso aceitável** | Política de uso do fornecedor aplica-se ao serviço; conteúdo que a viole pode ser retido e a conta, suspensa. | ✅ Compatível — as regras da EPIGE são mais restritivas |

## 3. Riscos e controles

**Transferência internacional de dados (LGPD).** Todo dado enviado sai do Brasil. Desde
23/08/2025, transferência internacional exige as cláusulas-padrão aprovadas pela ANPD
(Resolução CD/ANPD nº 19/2024) ou outro mecanismo reconhecido. O adendo de tratamento de
dados público do fornecedor referencia as cláusulas-padrão europeias; **não confirmei se
contempla as brasileiras.** → *Confirmar com o advogado e na conta.* Enquanto isso:
orientar o cliente a não colar dado pessoal além do necessário (já está na orientação e na
política de privacidade).

**Dependência de fornecedor único.** Se a API cair, a plataforma continua (documentos,
equipe, log), mas os agentes param. Controles: a escolha de modelo fica em um só ponto
(`web/functions/api/_motor.js`), e o conjunto de avaliação permite testar modelo substituto
antes de trocar. Não há fornecedor alternativo configurado — decisão consciente, pelo custo
de manter prompts e avaliação para dois fornecedores nesta fase.

**Descontinuação do Haiku 4.5.** Hoje ele só é usado pelo orquestrador, que a interface não
chama. Se vier o aviso, trocar pelo substituto recomendado e rodar a avaliação.

**Mudança de comportamento do modelo.** Um modelo novo pode responder diferente com o mesmo
prompt. Controle: rodar `node avaliacao/rodar.mjs` antes de trocar qualquer modelo; exigir
100% nos bloqueantes.

**Chave de API.** Guardada só como segredo no servidor, nunca no navegador; limite de gasto
configurado no console do fornecedor; tetos diários no código.

## 4. Condições da aprovação

1. Na criação da conta: registrar aqui a versão dos termos comerciais e do adendo de dados
   aceitos, e confirmar os três pontos marcados (treinamento, retenção, cláusulas-padrão).
2. Configurar o limite de gasto mensal no console antes da primeira chamada.
3. A política de privacidade da EPIGE informa: fornecedor, finalidade, retenção de até 30
   dias, a exceção de até 2 anos e a transferência para os EUA.
4. Assinar os avisos de descontinuação de modelos (e-mail da conta).

| Data | Quem | Decisão |
|---|---|---|
| 24/09/2026 | Claude, por delegação | Aprovado com condições — aguardando confirmação na conta |
| | Marlo Pires | |

---

Fontes consultadas em 24/09/2026:
[API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention) ·
[Data residency](https://platform.claude.com/docs/en/manage-claude/data-residency) ·
[Model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations) ·
[Retenção de dados da organização — Anthropic Privacy Center](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data) ·
[Transferência internacional — Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2025/08/end-of-grace-period-implementation-of-brazils-standard-contractual-clauses-in-international-transfers-of-personal-data) ·
[Regulação brasileira de transferência — IAPP](https://iapp.org/news/a/brazil-s-new-regulation-on-international-data-transfers)

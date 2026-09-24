# Validação pela ferramenta

**Decisão da direção, 24/09/2026:** nesta fase, a EPIGE não contrata profissionais externos
(auditor, profissional de segurança do trabalho, advogado) para validar o conteúdo. A
validação é feita por Claude, como parte da ferramenta, com o método e os limites abaixo.

---

## Como foi feita

A regra é a mesma para tudo: **conferir contra a fonte primária**, não contra a memória.

| O que | Fonte primária usada | Resultado |
|---|---|---|
| 30 respostas-padrão do requisito 10.2 (`avaliacao/iso-9001-10.2.json`) | Texto das cláusulas 10.2, 8.7, 7.5, 9.1 e 6.1 da ABNT NBR ISO 9001:2015 | 28 confirmadas; **2 corrigidas** por afirmar mais do que a norma diz |
| 8 respostas-padrão de saúde e segurança do trabalho (`avaliacao/iso-45001-sst.json`) | Texto de 3.35, 5.4, 8.1.2, A.8.1.2 e 10.2 da ABNT NBR ISO 45001:2024 | 8 confirmadas; 1 complemento |
| 22 casos de guardrail (`avaliacao/guardrails.json`) | As seis regras invioláveis dos agentes | Critérios coerentes com as regras; sem alteração |
| Termos de uso e política de privacidade | LGPD (Lei 13.709/2018), Marco Civil da Internet (Lei 12.965/2014, art. 15), Resoluções CD/ANPD nº 2/2022 e nº 19/2024 | Pontos jurídicos preenchidos com base nessas fontes; ficaram só dados cadastrais da EPIGE |
| Prazos de guarda da política de privacidade | A própria política | **Implementados no código** (`web/functions/_lib/retencao.js`) e testados — a política só é verdadeira se o sistema a cumprir |
| Fornecedor de IA | Documentação oficial da Anthropic | Aprovado com condições (`avaliacao-fornecedor-anthropic.md`) |

Os exemplares das normas foram consultados só para conferência. O texto não foi armazenado
no repositório nem reproduzido nos agentes.

### As duas correções no gabarito da 9001

- **10.2-002** apresentava o registro da avaliação da necessidade de ação corretiva como
  exigência explícita. A norma pede reter a natureza da não conformidade, as ações e os
  resultados; o registro da avaliação é o meio de demonstrá-la, não um requisito escrito.
- **10.2-013** dizia que a recorrência "indica uma de duas coisas". Também pode ser causa
  nova com o mesmo sintoma. Corrigido para não ser absoluto.

### O que a legislação mudou nos textos legais

- **Registros de acesso têm guarda obrigatória** de 6 meses para provedor de aplicação
  constituído como empresa (Marco Civil, art. 15). O log de auditoria da EPIGE guarda por
  5 anos, o que cobre a obrigação.
- **A EPIGE é operadora** do conteúdo que o cliente insere e **controladora** dos dados de
  conta e de segurança (LGPD, art. 5º, VI e VII).
- **Encarregado:** empresa de pequeno porte pode dispensá-lo, mas precisa de canal de
  contato com o titular (Resolução ANPD 2/2022). A política deixa o campo para o canal.
- **Transferência internacional** exige as cláusulas-padrão da ANPD desde 23/08/2025
  (Resolução 19/2024). Ver a condição pendente abaixo.

---

## Os limites — ditos com clareza

1. **Quem valida é quem escreveu.** A conferência contra a fonte reduz muito o risco de
   interpretação errada, mas não substitui um segundo olhar. É a limitação de independência
   que a ISO 19011 pede para declarar, e ela fica aceita pela direção.
2. **Validação de conteúdo não é validação de comportamento.** O que o modelo real responde
   só se sabe rodando `node avaliacao/rodar.mjs` com a chave de API. **Continua bloqueante:**
   100% nos casos bloqueantes antes de abrir a clientes.
3. **Não é assessoria jurídica.** Os textos legais foram escritos contra a lei, mas nenhum
   advogado os revisou. A direção aceita esse risco nesta fase; rever quando houver receita.
4. **Não é avaliação de campo.** Em saúde e segurança do trabalho, o agente continua dizendo
   ao cliente que a definição do controle cabe a profissional habilitado — isso protege o
   trabalhador do cliente, e não depende de a EPIGE ter contratado alguém.

## O que ainda depende de você

| Item | Por quê |
|---|---|
| Chave de API da Anthropic | Sem ela, a validação de comportamento não roda |
| Na criação da conta: conferir se o adendo de tratamento de dados contempla as cláusulas-padrão brasileiras; se não, pedir ao fornecedor o aditivo com as cláusulas da Resolução 19/2024 | Condição da transferência internacional |
| Razão social, CNPJ, cidade da sede e canal de contato do titular | Dados cadastrais que só a EPIGE tem; marcados como **[PREENCHER]** nas páginas |

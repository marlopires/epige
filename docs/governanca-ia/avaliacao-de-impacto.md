# Avaliação de impacto do sistema de IA da EPIGE

**Código:** AVI-IA-001 · **Versão:** 1 · **Situação:** **vigente** — aprovada pela direção em 24/09/2026
**Método:** estrutura inspirada nas diretrizes da ISO/IEC 42005:2025 para avaliação de
impacto — descrição do sistema, uso pretendido, uso indevido previsível, partes afetadas,
impactos, controles e impacto residual. Redação própria da EPIGE.

---

## 1. O sistema

**O que é.** Plataforma web com agentes de IA que explicam requisitos de onze referenciais
de sistema de gestão, redigem documentos e formulários, analisam documentos do cliente,
simulam auditoria interna e apoiam análise de causa e plano de ação.

**Como decide.** Não decide. Produz texto que uma pessoa da empresa cliente lê, ajusta e
aprova — ou descarta. O modelo de IA é de terceiro (Anthropic); a EPIGE controla o que
entra no modelo (regras, conhecimento, papel) e o que acontece com a saída (rascunho,
aprovação, registro).

**Uso pretendido.** Apoio a profissionais de qualidade, meio ambiente, saúde e segurança e
conformidade de pequenas e médias empresas brasileiras.

**Uso indevido previsível.**
- Aprovar documento gerado sem ler.
- Usar a saída como parecer técnico definitivo, sem profissional habilitado.
- Pedir registro de atividade que não aconteceu para "fechar" auditoria.
- Colar dado pessoal ou sigiloso além do necessário.
- Tratar a auditoria simulada como garantia de certificação.

## 2. Impactos

Gravidade: **alta** = pode ferir pessoa, gerar dano legal relevante ou fraude; **média** =
dano financeiro ou de conformidade recuperável; **baixa** = incômodo ou retrabalho.
Probabilidade estimada sem uso real — revisar com dados do piloto.

| # | Quem é afetado | Impacto | Grav. | Prob. | Controles existentes | Residual |
|---|---|---|---|---|---|---|
| 1 | **Trabalhadores do cliente** | Orientação errada de controle de perigo (ISO 45001, 39001) aplicada na prática | **Alta** | Baixa | Hierarquia de controles no conhecimento do agente, conferido contra exemplar; limite explícito ("definição do controle cabe a profissional de SST"); revisão humana obrigatória; 8 casos de avaliação de SST | **Médio até a validação por profissional de SST** |
| 2 | Empresa cliente e terceiros | Requisito legal inventado → obrigação errada controlada, obrigação certa esquecida | Alta | Média | Regra de honestidade; marcador [CONFIRMAR NA FONTE OFICIAL]; agente não afirma número de NR; sinalização "referência legal errada" | Médio |
| 3 | Empresa cliente | Documento que não reflete a prática → não conformidade na certificação | Média | Alta | Rascunho; marcador [CONFIRMAR]; declaração de revisão; orientação ao cliente | Baixo |
| 4 | Organismo certificador e mercado | Evidência fabricada com apoio da plataforma | Alta | Baixa | Regra de honestidade proíbe; caso bloqueante de avaliação (GR-IA-001) | Baixo |
| 5 | Empresa cliente | Expectativa falsa de certificação | Média | Média | Regra 2; caso bloqueante; aviso nos termos | Baixo |
| 6 | Pessoas cujos dados o cliente cola | Exposição de dado pessoal; transferência aos EUA | Média | Média | Conversa não guardada; isolamento entre empresas; orientação de não colar dado; fornecedor não treina com o dado | Médio até as cláusulas-padrão confirmadas |
| 7 | Equipe do cliente | Perda de competência por dependência da ferramenta | Baixa | Média | Orientação: revisão por quem entende do assunto; agentes explicam o porquê | Baixo |
| 8 | ISO e ABNT | Reprodução de texto protegido | Média | Baixa | Regra 1; caso bloqueante; exemplares fora do repositório | Baixo |

## 3. Decisão

O sistema pode ser disponibilizado a clientes quando:
1. o conjunto de avaliação passar **100% nos bloqueantes** contra o modelo real;
2. o gabarito de SST (`avaliacao/iso-45001-sst.json`) for conferido por **profissional de
   segurança do trabalho** — é o que reduz o impacto 1 de médio para baixo;
3. os termos de uso e a política de privacidade estiverem aprovados pelo advogado.

## 4. Revisão

Refazer esta avaliação: ao incluir norma ou agente; ao trocar modelo; ao fim dos primeiros
90 dias de piloto, com os dados de sinalização; e sempre que uma sinalização revelar
impacto não previsto aqui.

| Versão | Data | Aprovado por | Assinatura |
|---|---|---|---|
| 1 | 24/09/2026 | Marlo Pires — direção | Aprovação dada por escrito na sessão de trabalho com Claude; reapresentar no controle de documentos da plataforma quando ela estiver no ar |

# Governança de IA da EPIGE

Os documentos que a ISO/IEC 42001 espera de quem **fornece** um serviço baseado em IA.
Nasceram da auditoria de 24/09/2026 (`../auditoria-42001-epige.md`).

| Documento | O que é | Situação |
|---|---|---|
| [`politica-de-ia.md`](politica-de-ia.md) | POL-IA-001 — dez compromissos da EPIGE no uso de IA | **Vigente** — aprovada em 24/09/2026 |
| [`avaliacao-de-impacto.md`](avaliacao-de-impacto.md) | AVI-IA-001 — quem pode ser afetado, gravidade, controles, impacto residual | **Vigente** — aprovada em 24/09/2026 |
| [`avaliacao-fornecedor-anthropic.md`](avaliacao-fornecedor-anthropic.md) | Avaliação do fornecedor do modelo | Aprovado com condições; confirmar na conta de API |
| [`validacao-pela-ferramenta.md`](validacao-pela-ferramenta.md) | Como o conteúdo foi validado sem profissional externo, e os limites disso | Decisão da direção de 24/09/2026 |
| [`/termos/`](../../web/public/termos/index.html) | Termos de uso (página pública) | Versão 1, conferida contra a lei; falta preencher dados cadastrais |
| [`/privacidade/`](../../web/public/privacidade/index.html) | Política de privacidade (página pública), com prazos de guarda aplicados no código | Versão 1, conferida contra a lei; falta preencher dados cadastrais |
| [`/ia/`](../../web/public/ia/index.html) | Como a IA da EPIGE funciona — nota de transparência | Pronta |

**Quando a plataforma estiver no ar**, a política e a avaliação de impacto devem entrar no
controle de documentos da própria EPIGE e ser aprovadas lá — é a evidência de aprovação
que um auditor pediria, com data, versão e responsável.

**Ao mudar termos ou privacidade**, mude `TERMOS_VERSAO` em `web/functions/_lib/termos.js`:
todo usuário passa a precisar aceitar de novo, e o aceite fica registrado.

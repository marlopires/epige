# Governança de IA da EPIGE

Os documentos que a ISO/IEC 42001 espera de quem **fornece** um serviço baseado em IA.
Nasceram da auditoria de 24/09/2026 (`../auditoria-42001-epige.md`).

| Documento | O que é | Situação |
|---|---|---|
| [`politica-de-ia.md`](politica-de-ia.md) | POL-IA-001 — dez compromissos da EPIGE no uso de IA | **Aguardando sua aprovação** |
| [`avaliacao-de-impacto.md`](avaliacao-de-impacto.md) | AVI-IA-001 — quem pode ser afetado, gravidade, controles, impacto residual | **Aguardando sua aprovação** |
| [`avaliacao-fornecedor-anthropic.md`](avaliacao-fornecedor-anthropic.md) | Avaliação do fornecedor do modelo | Aprovado com condições; confirmar na conta de API |
| [`/termos/`](../../web/public/termos/index.html) | Termos de uso (página pública) | Rascunho em revisão jurídica |
| [`/privacidade/`](../../web/public/privacidade/index.html) | Política de privacidade (página pública) | Rascunho em revisão jurídica |
| [`/ia/`](../../web/public/ia/index.html) | Como a IA da EPIGE funciona — nota de transparência | Pronta |

**Quando a plataforma estiver no ar**, a política e a avaliação de impacto devem entrar no
controle de documentos da própria EPIGE e ser aprovadas lá — é a evidência de aprovação
que um auditor pediria, com data, versão e responsável.

**Ao mudar termos ou privacidade**, mude `TERMOS_VERSAO` em `web/functions/_lib/termos.js`:
todo usuário passa a precisar aceitar de novo, e o aceite fica registrado.

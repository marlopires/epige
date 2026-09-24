# Publicação

A plataforma completa — contas, papéis, controle de documentos e os agentes de IA —
num domínio seu, na Cloudflare.

---

## O que existe aqui

```
web/
├── build-prompts.mjs           gera _prompts.js a partir de agentes/
├── public/
│   ├── index.html + app.js     A PLATAFORMA: acesso, 12 ferramentas de IA, documentos, equipe
│   ├── demo/                   a demonstração narrada do requisito 10.2
│   └── _headers                cabeçalhos de segurança das páginas (CSP, HSTS…)
├── functions/
│   ├── _lib/                   banco, criptografia, sessão, convites, documentos
│   └── api/
│       ├── _middleware.js      porta de entrada: CSRF, sessão, erros, cabeçalhos
│       ├── auth/               primeiro acesso, login, cadastro, senha, 2FA, sessões
│       ├── equipe/             convites, papéis, desativação, link de nova senha
│       ├── organizacao/        contexto da empresa, uso de IA, log, exportação
│       ├── documentos/         controle de documentos (cláusula 7.5)
│       ├── plataforma/         empresas e solicitações (só a sua conta)
│       ├── chat.js             o proxy da IA
│       ├── _motor.js           composição dos agentes e escolha de modelo
│       └── _prompts.js         GERADO — não editar à mão
└── testes/
    ├── api.mjs                 119 verificações da API no runtime real
    └── navegador.mjs           31 verificações clicando na interface
```

**Duas páginas.** `/` é a área de trabalho. `/demo/` é o percurso narrado do 10.2 — usa a
mesma conta, e mostra uma empresa-exemplo em vez da sua.

## Como funciona o acesso

**Não há cadastro aberto.** Cadastro livre ligaria o cartão da API a qualquer visitante.
O caminho é:

1. **Você** faz o primeiro acesso uma vez e vira a administração da plataforma.
2. Quem quer usar clica em **"solicitar acesso"** na tela de entrada. A solicitação aparece
   para você em **Plataforma**; aceitar cria a empresa e gera o convite do administrador
   dela. Você também pode criar a empresa direto, sem solicitação.
3. O **administrador da empresa** convida a equipe em **Equipe**.

Convites e links de nova senha são **links que você copia e envia** (WhatsApp, e-mail).
A plataforma ainda não manda e-mail sozinha — ver "O que ainda não tem".

| Papel | O que faz |
|---|---|
| **Administrador** | Tudo na empresa: equipe, aprovação de documentos, log de auditoria, exportação. |
| **Editor** | Usa a IA, elabora e revisa documentos, envia para aprovação. Não aprova. |
| **Leitor** | Consulta os documentos **vigentes**. Não vê rascunho e não usa a IA. |
| **Plataforma** | Só a sua conta: cria e desativa empresas, ajusta o teto de IA de cada uma. |

## Controle de documentos

Tudo que a IA gera entra como **rascunho**. Daí: enviar para aprovação → o administrador
**aprova** (vira vigente) ou **devolve** com parecer. Revisar um vigente abre a versão
seguinte, com o registro do que mudou; ao aprovar, a anterior vira **substituída** e fica
retida no histórico. Documento fora de uso vira **obsoleto**, com motivo, e some para o
leitor. **Registros e relatórios de auditoria não são revisados** — são evidência.

Cada documento tem código automático por tipo (PR-001, PO-001, FR-001, RA-001…), impressão
com cabeçalho de identificação e aviso de cópia não controlada, e exportação em `.md`.

## O que você precisa fazer

### 1. Conta de API da Anthropic — item F0-6

1. Entre em **console.anthropic.com** e crie a conta **em nome da empresa**.
2. Adicione um cartão e **coloque um limite de gasto mensal** — comece com US$ 20.
3. Crie uma API key e guarde. Ela aparece **uma vez só**.

> A assinatura do Claude que você usa para trabalhar **não** cobre isso. São contas separadas.

### 2. Cloudflare

**Plano:** o **Workers Paid (US$ 5/mês)** é necessário. A verificação de senha usa cerca de
20 ms de processamento, e o plano gratuito corta em 10 ms — o login falharia de forma
intermitente. (Existe um recuo: a variável `PBKDF2_ITERACOES=50000` cabe no plano grátis, ao
custo de senhas duas vezes mais rápidas de atacar se o banco vazar. Não recomendo.)

**Criar o banco:** Workers & Pages → **D1 SQL Database** → Create → nome `epige`.
As tabelas são criadas sozinhas na primeira visita — não há SQL para rodar.

**Criar o projeto:** Workers & Pages → Create → Pages → Connect to Git → `marlopires/epige`.

| Campo | Valor |
|---|---|
| Production branch | `main` |
| Root directory (em *Advanced*) | **`web`** |
| Build command | `node build-prompts.mjs` |
| Build output directory | `public` |

> **O *Root directory* `web` não é opcional.** A Cloudflare procura a pasta `functions/` na
> raiz do projeto; sem isso, as páginas sobem mas **nenhuma rota da API existe** — o site
> fica preso em "servidor indisponível".

**Vincular o banco:** no projeto → Settings → **Bindings** → Add → D1 database →
nome da variável **`EPIGE_DB`** → banco `epige`.

**Variáveis** (Settings → Variables and Secrets → Production):

| Nome | Valor | Tipo |
|---|---|---|
| `ANTHROPIC_API_KEY` | a chave do passo 1 | **Secret** |
| `SEGREDO` | 48 caracteres aleatórios (ver abaixo) | **Secret** |
| `CODIGO_ACESSO` | uma frase que só você sabe | **Secret** |
| `TETO_DIARIO_BRL` | `20` — teto da plataforma inteira por dia | texto |
| `TETO_ORG_BRL` | `10` — teto padrão de cada empresa por dia | texto |

**`SEGREDO`** protege as senhas e as chaves de 2FA. Gere com um gerador de senhas (48
caracteres, letras e números) ou, num terminal, `openssl rand -base64 48`. Guarde no seu
cofre de senhas. **Nunca troque depois de publicado:** trocar invalida todas as senhas e
todos os 2FA de todo mundo. Sem ele — ou com menos de 32 caracteres — a API recusa tudo.

**`CODIGO_ACESSO`** agora só serve para o **primeiro acesso**. Depois que a sua conta existe,
ele não abre mais nada.

> Se você já tinha criado o KV `EPIGE_KV` na versão anterior, pode remover o binding: o
> teto e a telemetria agora ficam no D1.

### 3. Domínio — `epige.com.br`

**Use um subdomínio, não a raiz.** A plataforma vai em `app.epige.com.br` (ou
`demo.epige.com.br`), e `epige.com.br` fica livre para o site institucional.

**No Cloudflare:** Websites → Add a site → `epige.com.br`. Ele mostra dois nameservers.

**No registro.br:** Painel → `epige.com.br` → **DNS** → *Alterar servidores DNS* → cole os
dois nameservers. A propagação leva de minutos a algumas horas.

**Depois:** projeto Pages → Custom domains → `app.epige.com.br`. DNS e HTTPS saem sozinhos.

> **Cuidado no registro.br.** Trocar os nameservers move **todo** o DNS do domínio. Se já
> houver e-mail nesse domínio, recrie os registros MX no Cloudflare antes da troca.

### 4. Primeiro acesso

Abra o site. A tela de **Primeiro acesso** aparece sozinha enquanto não existe nenhuma
conta. Informe o `CODIGO_ACESSO`, sua empresa, seu nome, e-mail e uma senha longa. Pronto:
você é administrador da sua empresa e da plataforma.

**Ative o 2FA logo em seguida** (Minha conta → Verificação em duas etapas). A sua conta
é a mais valiosa do sistema.

## Segurança — o que está fechado

| Camada | Como |
|---|---|
| Senhas | PBKDF2-SHA256, 100 mil iterações, sal por usuário e pimenta (`SEGREDO`) fora do banco. Mínimo de 10 caracteres, e senha que aparece em vazamento público é recusada. |
| Sessão | Cookie `__Host-`, `HttpOnly`, `Secure`, `SameSite=Strict`. O banco guarda só o hash do token. Expira em 12 h sem uso ou 7 dias no total. |
| Força bruta | 5 erros no mesmo e-mail ou 30 no mesmo IP bloqueiam por 15 minutos. Mesma mensagem e mesmo tempo para e-mail inexistente e senha errada. |
| 2FA | Aplicativo autenticador (TOTP). Chave cifrada no banco; código não pode ser reutilizado. |
| CSRF | Origem conferida em toda requisição que altera dado, corpo obrigatoriamente JSON, e cookie `Strict`. |
| Isolamento | Toda consulta filtra pela empresa **da sessão**, nunca por id vindo do navegador. Testado: outra empresa recebe "não encontrado". |
| Papéis | Conferidos no servidor em cada rota. Esconder botão na tela é conveniência, não controle. |
| Páginas | CSP sem script inline nem de terceiros, HSTS, bloqueio de moldura (clickjacking). |
| Tokens de link | Convite e nova senha vão no fragmento da URL (`#`), que não chega a log de servidor; uso único; guardados só como hash. |
| Conta da plataforma | Só ela mesma se altera. Admin da sua empresa não consegue gerar nova senha para você. |
| IA | Chave e prompts no servidor. Limite de 60 chamadas/hora por pessoa, teto diário por empresa e teto diário global. |
| Auditoria | Log de login, falhas, convites, mudanças de acesso, aprovações e exportações. |
| LGPD | Conversas com a IA não são guardadas — só o que a pessoa salva como documento. Exportação completa dos dados da empresa em JSON. |

**Três camadas protegem o cartão**, por ordem de confiabilidade: o limite de gasto no
console da Anthropic (a única garantia de verdade); o acesso só por conta; e os tetos
diários no código.

## Testes

```bash
node web/testes/api.mjs          # 119 verificações — não precisa de chave de API
node web/testes/navegador.mjs    # 31 verificações — precisa do Playwright com Chromium
```

Os dois sobem a plataforma localmente no **runtime real da Cloudflare** (wrangler), com
banco descartável e um simulador da API da Anthropic. Não gastam token. Rode antes de
publicar qualquer mudança em `functions/` ou `public/`.

A suíte foi conferida contra defeito proposital: removendo o filtro de empresa do
carregamento de documentos, ela acusa as 4 verificações de isolamento.

## Quando mudar um prompt

```bash
node web/build-prompts.mjs
node avaliacao/rodar.mjs guardrails   # precisa de ANTHROPIC_API_KEY
git add -A && git commit -m "ajusta prompt do consultor" && git push
```

A Cloudflare publica sozinha a cada push em `main`.

## Cópia de segurança

O D1 guarda o histórico de alterações e permite voltar o banco a qualquer ponto dos
últimos 30 dias (**Time Travel**, no painel do D1). Cada empresa também exporta os próprios
dados em **Minha conta → Exportar dados da empresa**.

## O que ainda não tem

- **E-mail automático.** Convite e nova senha são links copiados à mão. Quando houver um
  provedor de e-mail (Resend, por exemplo), o envio entra sem mudar o resto.
- **Cobrança.** O teto por empresa existe; plano e pagamento, não.
- **Histórico de conversa.** A conversa com a IA some ao recarregar a página — de
  propósito, por LGPD. O que importa se salva como documento.
- **Textos legais.** Termos de uso e política de privacidade dependem do advogado
  (F0-3 e F0-5). **Não abra para cliente real sem eles.**

## O que NÃO foi verificado

**Verificado:** API e interface completas no runtime da Cloudflare, com banco real (D1
local), incluindo isolamento entre empresas, papéis, sessão, 2FA, bloqueio por
tentativas, ciclo de aprovação, tetos de IA, CSP sem violação e layout de celular.

**Não verificado:** **nenhuma resposta real de agente** — sem chave de API, a IA foi
simulada. E o comportamento no ambiente de produção da Cloudflare (o local é o mesmo
runtime, mas não é a mesma rede). A primeira coisa a fazer quando a chave existir é
`node avaliacao/rodar.mjs guardrails`. Se os guardrails não passarem 100%, não publique.

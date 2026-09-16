# Publicação

A demonstração do requisito 10.2, com agentes funcionando de verdade, num domínio seu.

---

## Por que precisa de servidor

O protótipo em `prototipos/` chama a API da Anthropic **direto do navegador, sem chave**.
Isso só funciona dentro do runtime de artefatos do Claude, que injeta a credencial. Em
qualquer outro lugar os agentes não respondem.

A solução não é colocar a chave no JavaScript — chave de API em código de front-end é
chave vazada, e qualquer pessoa com F12 a copia. A solução é um servidor mínimo que
guarda a chave e repassa a chamada. É o que tem aqui.

De quebra, resolve duas coisas:

- **Os prompts param de ir para o navegador.** Eles são o ativo do produto. Agora o
  navegador manda "qual agente" e "o que o usuário disse"; as regras ficam no servidor.
- **`agentes/` vira a fonte de verdade.** `build-prompts.mjs` gera o módulo que o servidor
  usa. Aquela divergência entre HTML e `.txt` que o `agentes/README.md` avisa deixa de
  existir para a aplicação publicada — o protótipo passa a ser legado.

## O que existe aqui

```
web/
├── build-prompts.mjs           gera _prompts.js a partir de agentes/
├── public/index.html           a demo, agora falando com /api/chat
└── functions/api/
    ├── chat.js                 o proxy
    └── _prompts.js             GERADO — não editar à mão
```

## O que você precisa fazer

### 1. Conta de API da Anthropic — item F0-6

1. Entre em **console.anthropic.com** e crie a conta **em nome da empresa**, não pessoal.
2. Adicione um cartão e **coloque um limite de gasto mensal** — comece com US$ 20.
   Isso é a sua rede de segurança real; o teto do código é a segunda camada.
3. Crie uma API key e guarde. Ela aparece **uma vez só**.

> A assinatura do Claude que você usa para trabalhar **não** cobre isso. São contas
> separadas, cobranças separadas. Está explicado no `ROTEIRO.md`.

### 2. Cloudflare

Conta grátis em **dash.cloudflare.com**. Escolhi Cloudflare em vez de Vercel por dois
motivos: o plano grátis do Vercel exclui uso comercial, e a Cloudflare resolve site
estático e função de servidor na mesma coisa.

**Criar o projeto:** Workers & Pages → Create → Pages → Connect to Git →
`marlopires/epige`.

| Campo | Valor |
|---|---|
| Production branch | `main` |
| Build command | `node web/build-prompts.mjs` |
| Build output directory | `web/public` |

**Variáveis de ambiente** (Settings → Environment variables → Production):

| Nome | Valor | Tipo |
|---|---|---|
| `ANTHROPIC_API_KEY` | a chave do passo 1 | **Encrypt** |
| `CODIGO_ACESSO` | uma frase que só você e os testadores sabem | **Encrypt** |
| `TETO_DIARIO_BRL` | `20` | texto |

> **`CODIGO_ACESSO` não é opcional.** Sem ela o proxy recusa tudo com 503, de propósito:
> esquecer de configurar o código não pode resultar numa API aberta ligada ao seu cartão.

**Teto de gasto** (Settings → Functions → KV namespace bindings): crie um namespace
chamado `epige` e vincule com o nome de variável `EPIGE_KV`. Sem esse binding o site
funciona, mas o teto diário **não é aplicado** — a resposta devolve `medindo_teto: false`
em vez de fingir que está protegendo.

### 3. Domínio

Custom domains → Set up a domain. A Cloudflare mostra os nameservers; troque no
**registro.br** (Painel → seu domínio → DNS → Alterar servidores DNS). Propaga em algumas
horas.

**Antes disso, me confirme a grafia.** Você falou `epaid.com.br`; a marca é EPIGE, então
suspeito que seja `epige.com.br`. Nenhum dos dois resolve hoje, o que é normal em domínio
novo sem DNS — mas eu não configuro o errado no escuro.

## As três camadas que protegem sua conta

Uma página pública ligada a uma chave de API é um cartão de crédito exposto. Por ordem de
confiabilidade:

1. **Limite de gasto no console da Anthropic.** A única que é garantia de verdade, porque
   é aplicada por quem cobra.
2. **Código de acesso.** Mantém a demo fora do alcance de quem só encontrou a URL.
3. **Teto diário no código.** Para o gasto do dia quando o acumulado passa do limite.
   Depende do KV estar vinculado.

Nenhuma delas substitui as outras. A primeira é a que impede um susto na fatura.

## Verificação antes de mostrar para alguém

```bash
node web/build-prompts.mjs                     # regenera os prompts
grep -c "api.anthropic.com" web/public/index.html   # tem que dar 0
```

Depois de publicado, abra `/api/chat` no navegador. A resposta deve ser
`{"configurado":true,"autorizado":false,...}`. Se vier `configurado:false`, faltou
variável de ambiente.

## Quando mudar um prompt

```bash
# edite agentes/demo-10.2/*.txt
node web/build-prompts.mjs
git add -A && git commit -m "ajusta prompt do consultor" && git push
```

A Cloudflare publica sozinha a cada push em `main`. O protótipo em `prototipos/` **não**
acompanha — ele tem a própria cópia embutida e agora é registro histórico.

## O que ainda não tem

- **Sem persistência.** Recarregou, perdeu a conversa.
- **Sem contas de usuário.** O código de acesso é um só, compartilhado.
- **Sem limite por pessoa.** O teto é global, não individual.
- **Só o requisito 10.2.** As outras 41 telas do protótipo não estão aqui.

Isso é uma demonstração publicada para teste, não o MVP. O MVP é a Fase 2 do roteiro e
precisa de desenvolvedor.

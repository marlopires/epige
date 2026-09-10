# EPIGE — Revisão completa
### Auditoria de código, pesquisa de mercado, custos e identidade

Agosto de 2026 · protótipo v8.2

---

## 1. O que a pesquisa mudou no produto

Esta é a parte mais importante do documento, e não era esperada.

### A ISO 14001 já foi revisada

A **ISO 14001:2026 foi publicada em 15 de abril de 2026**, substituindo a edição de 2015. A transição definida é de 36 meses:

- **30 de outubro de 2027** — deixa de ser possível emitir certificados novos na versão 2015
- **30 de abril de 2029** — certificados na versão 2015 perdem validade

Os agentes da plataforma estavam tratando a 14001:2015 como corrente. Isso foi corrigido: a norma agora carrega a versão vigente, o estado da transição e os prazos, e a interface exibe um aviso âmbar quando a 14001 é selecionada.

### A ISO 9001 muda no mês que vem

O FDIS da **ISO 9001:2026 foi aprovado** e a publicação é esperada para **setembro de 2026**, com transição de aproximadamente três anos. As mudanças são evolutivas: reforço de cultura da qualidade e comportamento ético na liderança, gestão de riscos e oportunidades mais clara, integração formal da consideração sobre mudança climática. Não entraram requisitos de inteligência artificial nem ampliação de ESG.

Detalhe comercialmente relevante: os **primeiros certificados na nova edição não devem sair antes do segundo semestre de 2027**, porque os organismos certificadores precisam ser acreditados antes. Quem precisa certificar agora certifica na 2015 e transiciona depois — e essa é exatamente a orientação que os agentes agora dão.

### A ISO 45001 vem depois

Revisão em curso, publicação esperada para 2027. Sem texto final. O agente foi instruído a não especular sobre conteúdo.

### O que isso significa para o negócio

**A EPIGE está nascendo dentro de uma janela de transição das três normas simultaneamente.** Entre 2026 e 2029, mais de um milhão de empresas certificadas no mundo precisam migrar de edição. No Brasil, cada uma delas vai precisar de análise de lacuna, atualização de documentos e preparação de auditoria de transição.

Isso não é um risco a administrar. É a maior oportunidade comercial disponível para o produto, e ela tem prazo. Uma ferramenta de **análise de lacuna entre edições** — comparar o sistema atual contra a nova edição e devolver o que muda — seria a próxima coisa que eu construiria.

---

## 2. Onde as empresas mais falham

A pesquisa nas fontes de certificadoras e auditores mostrou um padrão consistente entre as três normas. Encodei esses achados nos agentes, que agora sabem o que procurar:

**Comum às três**
- Controle de informação documentada com versão desatualizada em uso
- Ações corretivas encerradas sem análise de causa real, com reincidência
- Auditoria interna conduzida por lista de verificação cláusula a cláusula, em vez de abordagem de processo

Este último merece destaque: as fontes apontam a auditoria interna fraca como **raiz da maioria das outras não conformidades**. Uma auditoria interna que não avalia o sistema como processos inter-relacionados deixa passar o que o auditor de terceira parte encontra depois.

**ISO 9001** — saída não conforme não identificada nem segregada, às vezes expedida ao cliente; análise crítica pela direção sem decisões registradas.

**ISO 14001** — levantamento de aspectos desatualizado após mudança de processo; critério de significância não declarado; requisitos legais identificados mas sem avaliação periódica de atendimento; plano de emergência nunca testado.

**ISO 45001** — consulta aos trabalhadores tratada como mera comunicação; avaliações de risco desatualizadas; controles saltando direto para EPI; quase acidentes não registrados.

---

## 3. Auditoria de código

### Defeitos encontrados e corrigidos

| Defeito | Gravidade | Situação |
|---|---|---|
| Dois `</span>` órfãos no cabeçalho, sobra de edição antiga | média — quebra o layout em navegadores estritos | corrigido |
| Quatro campos de formulário sem rótulo acessível | média — inutiliza leitor de tela | corrigido |
| Agentes tratando ISO 14001:2015 como vigente | **alta — informação normativa errada** | corrigido |

### O que foi verificado e está íntegro

- 42 telas, nenhuma quebrada, nenhuma órfã, todas alcançáveis pelo menu
- Balanceamento de tags em todo o HTML real
- Nenhum ID duplicado
- Nenhum `<form>`, nenhum `localStorage`, nenhuma chave de API embutida
- Nenhum `target="_blank"` sem atributo de segurança
- Sete blocos de script, todos com sintaxe válida
- As 27 combinações de norma × ferramenta renderizam, testadas com DOM simulado
- Toda saída de agente passa por escape antes de ir ao HTML

### Dívida técnica que permanece

Nenhuma é bloqueante, mas quem for programar precisa saber:

**Nove blocos `<style>` separados.** Consequência de construir por camadas. Funciona, mas dificulta manutenção e há 85 `!important` — sinal de especificidade brigando. Na reescrita para produção, consolidar em um sistema de tokens.

**333 manipuladores `onclick` embutidos no HTML.** Aceitável em protótipo, ruim em produção. Impede política de segurança de conteúdo restritiva.

**Sem persistência.** O trabalho não sobrevive a um recarregamento. Já documentado, continua sendo a maior distância entre protótipo e produto.

**Arquivo único de 300 KB.** Ótimo para demonstrar, insustentável para evoluir. Em produção vira componentes.

---

## 4. Revisão de custos

O modelo de precificação anterior continua válido, com **uma linha nova** que ele não previa: a ferramenta de vigilância normativa usa busca web, cobrada à parte.

### Custo da vigilância normativa

| Componente | Valor |
|---|---|
| Inferência (≈9.000 tokens de entrada com os resultados injetados) | R$ 0,13 |
| Busca web (4 consultas a US$ 10 por mil) | R$ 0,21 |
| **Total por execução** | **R$ 0,34** (R$ 0,39 no teto do câmbio) |

**É a operação mais cara da plataforma — 2,6 vezes uma consulta comum.**

### A decisão que isso força

Sob demanda por usuário, não fecha. No plano Consultor a R$ 89, oito vigilâncias por mês consomem R$ 3,12 — 4% da receita do plano por um recurso secundário, e o número escala mal.

**A vigilância precisa ser curadoria central, não consulta individual.** Uma execução por norma por dia, resultado servido a todos:

- 3 normas × 30 execuções/mês = **R$ 35,10/mês de custo fixo**
- Rateado entre 200 contas: R$ 0,18 por conta
- Rateado entre 500 contas: R$ 0,07 por conta

Impacto na margem de contribuição no cenário de 300 contas: **menos de 0,15 ponto percentual em qualquer plano.** Irrelevante.

Isso confirma a descoberta central do modelo original por outro caminho: o que escala mal é custo que cresce por usuário; o que escala bem é custo fixo diluído. A vigilância pertence à segunda categoria.

**Implicação de arquitetura:** o agente de vigilância roda agendado no servidor, grava o resultado, e a interface lê o que foi gravado. No protótipo ele roda sob demanda porque não há servidor — mas em produção não deve.

---

## 5. Identidade visual

Documento completo entregue à parte, em Markdown e Word. Os pontos que respondem diretamente ao que você pediu:

**O E e o i.** A leitura primária do símbolo é a letra E. O ponto solto no canto superior direito é o pingo do i de inteligência. A mesma forma carrega as duas iniciais sem escrever nenhuma duas vezes.

**A viagem gradual.** O traço não fecha. Sai do canto superior direito, desce, percorre e retorna sem se fechar sobre si — a forma gráfica de um sistema de gestão, onde cada ciclo volta ao início em nível superior e não há estado final. O ponto solto marca o próximo ciclo, ainda não percorrido.

**Crescimento sólido e fundamentado.** A espessura constante do traço é decisão de significado. Traço que afina comunica fragilidade; traço uniforme comunica sustentação. A base é tão espessa quanto o topo.

**O gradiente como tempo.** Azul profundo é o rigor normativo, o requisito, o ponto de partida. Verde-água é o resultado: sistema vivo, operando. A transição é gradual e sem degrau, porque a maturidade em gestão também é. O ponto no alto é verde-água puro — a cor de chegada visível desde o começo.

### A proporção áurea: o resultado honesto

Medi o símbolo. Doze medidas testadas contra sete constantes derivadas de φ. Quatro razões ficaram abaixo de 1% do alvo, a melhor sendo a largura do anel dividida pela distância do círculo à borda direita, a 0,46% de φ³.

**Mas uma simulação com medidas aleatórias da mesma ordem de grandeza produz em média doze coincidências abaixo de 2%. Encontrei quatro. Isso é menos do que o acaso já produziria.**

A conclusão correta é que o símbolo não foi construído sobre φ, e as proximidades são coincidência. Afirmar o contrário em material de marca seria alegação verificável e falsa — exatamente o tipo de coisa que um investidor com olho técnico manda checar.

A recomendação é melhor que a alegação: **não mexer no símbolo e adotar φ no sistema ao redor dele**, onde há liberdade real.

- **Escala tipográfica** em progressão φ: 9, 12, 15, 24, 39, 63
- **Espaçamento** em progressão φ: 5, 8, 13, 21, 34, 55 — que são números de Fibonacci, memorizáveis sem tabela
- **Proporção de layout**: conteúdo para painel lateral em 1,618 para 1

Assim a marca ganha coerência áurea verdadeira, construída, e não uma história inventada sobre um desenho que já existia.

---

## 6. Melhorias de layout aplicadas

**Seleção de norma em abas grandes no corpo da tela.** Estava só na barra escura lateral — foi por isso que você não achou a 14001 e a 45001. Agora são três abas largas, impossíveis de não ver, com a 14001 marcada como revisada em 2026.

**Faixa de situação normativa** no topo de cada norma, em âmbar quando há transição em curso, com atalho direto para a vigilância.

**Contexto da empresa editável dentro do MVP.** Antes o perfil era fixo no código. Agora abre em painel recolhível, e mudar o contexto reinicia as conversas para não misturar orientação de empresas diferentes.

**Linha do tempo com dados reais** das três normas, com os dois prazos que costumam pegar as empresas de surpresa.

---

## 7. O que eu faria em seguida, em ordem

1. **Conjunto de avaliação.** Trinta a cinquenta perguntas por norma, com a resposta certa marcada por você. Sem isso não há como saber se uma mudança de prompt melhorou ou piorou. Continua sendo o marco que tira o produto do papel.

2. **Ferramenta de análise de lacuna entre edições.** A janela de transição das três normas é a oportunidade comercial do momento e tem prazo. Comparar o sistema atual contra a nova edição e devolver o que muda é serviço que o mercado vai comprar entre 2026 e 2029.

3. **Fase 0 do roteiro.** Empresa constituída destrava gateway, conta de API própria e contratação de desenvolvedor. Quase tudo depende disso.

4. **Reescrita para produção.** O protótipo cumpriu o papel: define exatamente o que construir. Componentes, backend, persistência, autenticação.

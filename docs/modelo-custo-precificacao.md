# EPIGE — Modelo de Custo e Precificação

**Versão 1.0 · 12 de agosto de 2026**
Documento de trabalho para definição dos planos comerciais.

---

## Antes de mais nada: o que este documento é e o que não é

Este é um **modelo**, não uma previsão. Os custos de API são preços oficiais verificados; o resto são premissas estruturadas que precisam ser confrontadas com dados reais assim que houver uso em produção.

Três avisos honestos:

1. **Os volumes de uso por plano são estimativas minhas**, derivadas do desenho funcional da EPIGE — não de telemetria. São a maior fonte de incerteza do modelo. Trate-os como hipóteses a validar no primeiro trimestre de operação.
2. **Não sou contador nem consultor financeiro.** O tratamento tributário aqui é uma simplificação; enquadramento, anexo do Simples e incidência de ISS sobre SaaS precisam de validação profissional.
3. **A margem realista deste produto é menor que a de um SaaS tradicional.** Onde software puro entrega 80–85% de margem bruta, a EPIGE entrega 45–65%, porque o custo de inferência é variável e proporcional ao uso. Isso não é um problema — é a natureza da categoria. Mas precisa estar claro desde o início, porque muda o volume necessário para viabilizar a operação.

---

## 1. Estrutura do cálculo

O custo de uma conta se decompõe em quatro camadas:

| Camada | Natureza | Some se o cliente cancela? |
|---|---|---|
| Inferência (tokens de IA) | Variável, proporcional ao uso | Sim |
| Infraestrutura marginal | Variável, semi-proporcional | Sim |
| Suporte humano atribuível | Variável | Sim |
| Estrutura fixa (curadoria, produto, marketing) | Fixa | Não |

As três primeiras formam o **custo variável direto**. A quarta é rateada pela base e determina o ponto de equilíbrio.

Essa separação importa: um erro comum é ratear a estrutura fixa por usuário e concluir que o preço precisa ser alto. Com 50 clientes, a curadoria normativa custa R$120 por cliente; com 2.000 clientes, custa R$3. O preço não pode ser definido pelo primeiro número.

---

## 2. Custo de inferência

### 2.1 Preços de referência

Tabela oficial Anthropic, consultada em 12/08/2026 (USD por milhão de tokens):

| Modelo | Entrada | Leitura de cache | Saída |
|---|---|---|---|
| Haiku 4.5 | $1,00 | $0,10 | $5,00 |
| Sonnet 5 | $2,00 | $0,20 | $10,00 |
| Opus 5 | $5,00 | $0,50 | $25,00 |

Busca web: **$10 por 1.000 buscas**. Leitura de cache custa 10% da entrada padrão.

### 2.2 Dois ajustes que a maioria dos modelos esquece

**Português consome mais tokens.** O mesmo texto em português gera cerca de 35% mais tokens que em inglês. Todo o modelo aplica esse fator. Ignorá-lo subestimaria o custo em um terço.

**Cache de prompt muda a ordem de grandeza.** O prompt de sistema, a persona do agente e os trechos de norma são estáveis entre chamadas. Mantidos em cache, custam 10% do preço de entrada. O modelo assume 85% de aproveitamento de cache — atingível com disciplina de engenharia (conteúdo estável sempre no início do prompt), mas **não automático**. Se a ordem do prompt for quebrada, o custo de entrada multiplica por 10 silenciosamente.

### 2.3 Custo por tipo de interação

Já com fator português e cache aplicados, câmbio R$5,20:

| Interação | Modelo | Tokens entrada | Tokens saída | Custo (US$) | Custo (R$) |
|---|---|---|---|---|---|
| Consulta ao especialista | Sonnet 5 | ~14.850 | 1.080 | 0,0248 | **0,13** |
| Análise de documento | Sonnet 5 | ~35.100 | 3.375 | 0,0882 | **0,46** |
| Geração de procedimento | Sonnet 5 | ~20.250 | 5.400 | 0,0788 | **0,41** |
| Pesquisa normativa (3 buscas) | Sonnet 5 | ~32.400 | 2.025 | 0,1072 | **0,56** |
| Diagnóstico inicial | Sonnet 5 | ~13.500 | 4.050 | 0,0557 | **0,29** |
| Auditoria simulada (~15 turnos) | Opus 5 | ~162.000 | 10.800 | 0,6380 | **3,32** |
| Roteamento do Orquestrador | Haiku 4.5 | ~3.510 | 203 | 0,0026 | **0,01** |

**A leitura mais importante desta tabela:** uma consulta custa treze centavos. A inferência não é o gargalo econômico da EPIGE nos planos de entrada — suporte humano e estrutura fixa pesam mais. Isso abre espaço real para um plano gratuito generoso, que é justamente o que a proposta de "não criar barreira para o gestor do zero" exige.

A exceção é a auditoria simulada, ~25x mais cara que uma consulta por usar Opus em sessão longa. É o único item que precisa de limite explícito por plano.

---

## 3. Cenários de uso

Três perfis por plano. "Médio" é a premissa central; "pesado" representa o percentil ~90 de intensidade.

### Volume mensal por conta

| Plano | Cenário | Consultas | Análises | Gerações | Pesquisas | Auditorias |
|---|---|---|---|---|---|---|
| **Explorar** | leve | 8 | — | — | 1 | — |
| | médio | 15 | — | — | 2 | — |
| | pesado | 25 | — | — | 3 | — |
| **Consultor** | leve | 40 | 3 | 2 | 3 | — |
| | médio | 80 | 8 | 5 | 6 | — |
| | pesado | 150 | 18 | 12 | 12 | — |
| **Implantação** | leve | 90 | 12 | 10 | 6 | 1 |
| | médio | 180 | 30 | 22 | 12 | 2 |
| | pesado | 320 | 60 | 45 | 25 | 4 |
| **Empresarial** | leve | 250 | 40 | 30 | 20 | 3 |
| | médio | 500 | 90 | 70 | 40 | 6 |
| | pesado | 900 | 180 | 140 | 80 | 12 |

### Custo variável resultante (R$/conta/mês)

| Plano | Leve | Médio | Pesado | Pesado + dólar 6,00 |
|---|---|---|---|---|
| Explorar | 3,71 | 5,27 | 7,27 | 8,13 |
| Consultor | 19,40 | 30,53 | 52,07 | 58,59 |
| Implantação | 60,30 | 94,42 | 153,73 | 172,40 |
| Empresarial | 200,85 | 305,07 | 488,00 | 543,42 |

Composição no cenário médio do plano Consultor: inferência R$20,99 · suporte R$6,84 · infraestrutura R$1,80 · base vetorial R$0,90.

---

## 4. Custos sobre a receita

| Item | % | Observação |
|---|---|---|
| Meio de pagamento | 3,5% | Blend cartão/Pix com antifraude |
| Tributos | 6,0% | Simples Nacional Anexo III, 1ª faixa — **validar com contador** |
| Inadimplência | 2,0% | Típico de SaaS B2B pequeno no Brasil |
| **Total** | **11,5%** | |

O tributo sobe conforme a faixa de faturamento. Acima de R$180k/ano a alíquota efetiva do Anexo III cresce, e se o Fator R ficar abaixo de 28% o enquadramento vai para o Anexo V (bem mais caro). Isso precisa ser modelado com o contador antes de fechar os preços — pode consumir vários pontos de margem.

---

## 5. Preços propostos

### 5.1 Três faixas testadas

Critério de aprovação: margem de contribuição ≥ 35% **no pior caso** (uso no teto do plano + dólar a 6,00).

| Faixa | Consultor | Implantação | Empresarial | Veredito |
|---|---|---|---|---|
| A — agressiva | R$69 (30,1%) | R$219 (29,1%) | R$1.190 (54,9%) | Reprovada nos dois primeiros |
| **B — recomendada** | **R$89 (43,2%)** | **R$279 (41,8%)** | **R$1.490 (61,7%)** | **Aprovada** |
| C — confortável | R$109 (51,5%) | R$349 (51,2%) | R$1.890 (67,4%) | Aprovada, mas perde acessibilidade |

A faixa A quebra sob estresse: 30% de margem de contribuição não paga a estrutura fixa em volume razoável. A faixa C é segura mas abandona o posicionamento de acessibilidade — e o mercado brasileiro de SGQ já é caro, então entrar por cima elimina o principal diferencial.

**Recomendação: faixa B.**

### 5.2 Estrutura final

| | Explorar | Consultor | Implantação | Empresarial |
|---|---|---|---|---|
| **Preço** | Grátis | R$89/mês | R$279/mês | A partir de R$1.490/mês |
| Usuários | 1 | 1 | até 3 | a partir de 10 |
| Consultas/mês | 20 | 100 | 240 | 650 |
| Análises de documento | — | 10 | 40 | 120 |
| Gerações de documento | — | 6 | 30 | 90 |
| Pesquisas normativas | 2 | 8 | 16 | 50 |
| Auditorias simuladas | — | — | 3 | 8 |
| Diagnóstico inicial | 1 | 2 | 3 | 6 |

Anual com 2 meses de desconto (−16,7%): R$890, R$2.790 e R$14.900.

### 5.3 Margem garantida

Com os limites acima, mesmo o cliente que consome 100% do plano:

| Plano | Custo no teto | MC (câmbio 5,20) | MC (câmbio 6,00) |
|---|---|---|---|
| Consultor | R$36,18 | R$42,58 (47,8%) | R$38,48 (43,2%) |
| Implantação | R$116,97 | R$129,94 (46,6%) | R$116,75 (41,8%) |
| Empresarial | R$361,70 | R$956,95 (64,2%) | R$919,39 (61,7%) |

**Nenhum cenário produz margem negativa.** Esse é o objetivo do limite de uso justo: transformar um custo variável ilimitado em um custo variável com teto conhecido.

### 5.4 Excedente

Ao esgotar o limite, o cliente escolhe entre aguardar o ciclo ou comprar créditos. Preço com markup 3x sobre o custo:

| Item | Custo | Preço ao cliente |
|---|---|---|
| Consulta adicional | R$0,13 | R$0,39 |
| Análise de documento | R$0,46 | R$1,38 |
| Geração de documento | R$0,41 | R$1,23 |
| Pesquisa normativa | R$0,56 | R$1,67 |
| Auditoria simulada | R$3,32 | R$9,95 |

Pacote sugerido: R$29 por 100 créditos, onde consulta = 1 crédito, análise/geração = 4, auditoria = 30.

### 5.5 O plano gratuito se paga?

Custo de uma conta Explorar no teto: **R$5,99/mês** (R$6,65 com dólar a 6,00).

Cada conta Consultor paga sustenta **7 contas gratuitas** no teto. Com conversão típica de 3–5% em freemium B2B, a proporção natural (20–30 gratuitas por paga) **não se sustenta sozinha** — o gratuito é investimento de aquisição, não operação neutra.

Por isso o limite de 20 consultas/mês, sem análise nem geração de documentos. É suficiente para o gestor do zero entender o valor e passar pelo diagnóstico; insuficiente para operar um SGQ inteiro de graça.

---

## 6. Viabilidade

### 6.1 Estrutura fixa por fase

| Item | Inicial | Crescimento | Escala |
|---|---|---|---|
| Curadoria normativa | 6.000 | 16.000 | 38.000 |
| Produto e engenharia | 18.000 | 55.000 | 140.000 |
| Infraestrutura base | 1.800 | 5.500 | 14.000 |
| Ferramentas SaaS | 900 | 3.000 | 8.000 |
| Jurídico e contábil | 1.200 | 3.000 | 7.000 |
| Marketing e conteúdo | 2.500 | 12.000 | 40.000 |
| **Total mensal** | **R$30.400** | **R$94.500** | **R$247.000** |

### 6.2 Ponto de equilíbrio

Mix assumido: 70% Consultor, 26% Implantação, 4% Empresarial. Quatro contas gratuitas por paga.

| Fase | Fixo/mês | Equilíbrio (uso médio) | Equilíbrio (pior caso) |
|---|---|---|---|
| Inicial | R$30.400 | **327 contas** | 950 contas |
| Crescimento | R$94.500 | 1.018 contas | 2.954 contas |
| Escala | R$247.000 | 2.660 contas | 7.721 contas |

### 6.3 Projeção

| Fase | Pagantes | Receita/mês | Margem contrib. | Resultado |
|---|---|---|---|---|
| Inicial | 300 | R$58.332 | R$27.858 (48%) | −R$2.542 |
| Inicial | 600 | R$116.664 | R$55.716 (48%) | +R$25.316 |
| Crescimento | 1.500 | R$291.660 | R$139.289 (48%) | +R$44.789 |
| Crescimento | 3.000 | R$583.320 | R$278.579 (48%) | +R$184.079 |
| Escala | 8.000 | R$1.555.520 | R$742.876 (48%) | +R$495.876 |

### 6.4 Retorno sobre aquisição

| Plano | CAC estimado | MC/mês | Payback | LTV 24m | LTV/CAC |
|---|---|---|---|---|---|
| Consultor | R$180 | R$48,24 | 3,7 meses | R$1.158 | 6,4x |
| Implantação | R$900 | R$152,50 | 5,9 meses | R$3.660 | 4,1x |
| Empresarial | R$6.000 | R$1.013,58 | 5,9 meses | R$24.326 | 4,1x |

Payback abaixo de 12 meses e LTV/CAC acima de 3x são os limiares usuais de saúde em SaaS. Os três planos passam — **desde que os CACs assumidos se confirmem**, o que só o funil real dirá.

---

## 7. Testes de estresse

| Choque | Efeito | Situação |
|---|---|---|
| Dólar a R$6,00 | MC cai 4–6 p.p. | Absorvível |
| Custo de IA dobra | MC cai para 21–49% | Ainda positiva |
| Uso pesado generalizado | Equilíbrio triplica | Requer ativação dos limites |
| Tributo sobe para Anexo V (15,5%) | MC cai ~9,5 p.p. | **Exige revisão de preço** |
| Cache cai para 50% | Custo de IA sobe ~40% | Absorvível, mas corrói margem |

O risco mais concreto não é o câmbio nem o preço da API — é **o enquadramento tributário**. Uma mudança de anexo consome mais margem do que o dólar indo a R$6,00. Vale resolver isso com o contador antes de publicar preço.

---

## 8. Posicionamento

Levantamento dos concorrentes brasileiros (Qualiex/ForLogic, SoftExpert, Qualyteam, Portal ISO) em agosto de 2026: **nenhum publica preço**. Todos operam com "consulte um especialista", precificação por módulo e por usuário. Avaliações públicas de usuários mencionam "valores altos dos planos" como ponto negativo recorrente.

Isso define dois diferenciais que não custam nada para a EPIGE:

**Preço público.** Publicar valor na página é, sozinho, um diferencial competitivo nesta categoria. Reduz atrito no topo do funil e atrai justamente quem os concorrentes ignoram — a pequena empresa que não quer passar por processo comercial para descobrir se cabe no orçamento.

**Entrada por R$89.** O consultor autônomo e a microempresa estão fora do mercado atual de SGQ. Não é que sejam mal atendidos: eles simplesmente não são atendidos. É um segmento inteiro sem oferta.

O risco do posicionamento acessível é ancorar valor baixo demais e travar o upsell para Empresarial. Mitigação: o plano Implantação é o produto principal do ponto de vista de receita — o Consultor é porta de entrada, e a comunicação deve tratá-lo assim.

---

## 9. O que validar antes de publicar

Em ordem de impacto:

1. **Enquadramento tributário** — com contador. Maior risco isolado do modelo.
2. **Volumes reais de uso** — instrumentar telemetria por tipo de interação desde o primeiro dia. Todo o modelo depende disso.
3. **Taxa de aproveitamento de cache** — medir em produção. A premissa de 85% é otimista sem disciplina de engenharia.
4. **Tickets de suporte por conta** — a premissa de 0,18/mês no Consultor é a segunda maior incerteza depois dos volumes.
5. **CAC real por canal** — os paybacks dependem disso.
6. **Conversão do gratuito** — define se a proporção 4:1 assumida é realista.

Recomendação operacional: rodar os primeiros 90 dias com preço de lançamento e limites generosos, medindo tudo. Ajustar com dados em vez de premissas.

---

## Anexo — Premissas em um lugar só

| Premissa | Valor | Confiança |
|---|---|---|
| Câmbio USD/BRL | 5,20 (estresse: 6,00) | Alta — cotação verificada |
| Preços de API | Tabela Anthropic 12/08/2026 | Alta — fonte oficial |
| Fator de tokenização PT-BR | 1,35x | Média |
| Aproveitamento de cache | 85% | Média — depende de execução |
| Custo por ticket de suporte | R$38 | Média |
| Tickets/conta/mês | 0,03 a 2,20 conforme plano | Baixa |
| Volumes de uso por plano | Ver seção 3 | **Baixa — validar** |
| Tributos | 11,5% sobre receita | Baixa — validar |
| CAC | R$180 / R$900 / R$6.000 | Baixa |
| Contas gratuitas por paga | 4:1 | Baixa |

As linhas de confiança baixa são onde o modelo pode estar mais errado. Nenhuma delas invalida a estrutura do cálculo — todas mudam os números.

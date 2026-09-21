# Gerador dos lockups

Os SVGs de lockup em `identidade/` têm o texto **convertido em curvas**. Isso não é
preciosismo: SVG que referencia fonte por nome renderiza em Arial sempre que a fonte não
está disponível — inclusive dentro de `<img>`, que é como um logo é usado na maior parte
das vezes. Um logo que vira Arial não é um logo.

## Como refazer

```bash
pip install fonttools uharfbuzz brotli
curl -sL "https://fonts.gstatic.com/s/intertight/v9/NGSnv5HMAFg6IuGlBNMjxJEL2VmU3NS7Z2mjjwiqXA.ttf" -o InterTight-800.ttf
curl -sL "https://fonts.gstatic.com/s/intertight/v9/NGSnv5HMAFg6IuGlBNMjxJEL2VmU3NS7Z2mjPQ-qXA.ttf" -o InterTight-500.ttf
# usar curvas.py conforme o exemplo abaixo
```

As URLs vêm da API do Google Fonts (`css2?family=Inter+Tight:wght@500;800`). Se
quebrarem, a fonte continua em fonts.google.com/specimen/Inter+Tight. Inter Tight é
licenciada sob **SIL Open Font License**, que permite este uso.

`curvas.py` usa HarfBuzz para o posicionamento — o que traz kerning real, não só soma de
larguras — e fontTools para extrair os contornos.

## Decisões registradas

**Peso 800, não 850.** O manual de marca especifica peso 850 para o logotipo. O Google
serve estaticamente apenas 500 e 800; a fonte variável, que permitiria 850 exato, é
entregue em subsets que não continham os glifos necessários. **800 (ExtraBold) é o mais
próximo disponível** e a diferença é visualmente desprezível. Se algum dia o logotipo for
refeito por designer com a fonte completa, use 850 e atualize esta nota.

**Espaçamento do manual, aplicado.** Espaço entre símbolo e palavra = um terço da altura
do símbolo (200 ÷ 3 ≈ 67, daí x = 267). Letter-spacing negativo conforme o manual.

**Baseline calculada pela cap-height**, não pelo centro da caixa de texto — é o que
alinha oticamente a palavra ao centro vertical do símbolo.

## Não edite os paths à mão

Para mudar o texto, o peso ou o espaçamento, **regenere**. Os `d=` dos paths são saída de
script; editá-los manualmente deixa o arquivo impossível de reproduzir.

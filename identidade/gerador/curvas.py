"""Converte texto em curvas SVG usando HarfBuzz para shaping e fontTools para contornos."""
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.misc.transform import Transform

def texto_para_path(arquivo, texto, tamanho, letter_spacing=0.0):
    """Devolve (path_d, largura_total). Origem no baseline, y para baixo (convenção SVG)."""
    dados = open(arquivo, 'rb').read()
    face = hb.Face(dados); fonte = hb.Font(face)
    upem = face.upem
    fonte.scale = (upem, upem)
    hb.ot_font_set_funcs(fonte)

    buf = hb.Buffer()
    buf.add_str(texto)
    buf.guess_segment_properties()
    hb.shape(fonte, buf)

    tt = TTFont(arquivo)
    gs = tt.getGlyphSet()
    ordem = tt.getGlyphOrder()
    escala = tamanho / upem

    partes = []
    x = 0.0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        nome = ordem[info.codepoint]
        pen = SVGPathPen(gs)
        # y invertido: fonte cresce para cima, SVG para baixo
        tpen = TransformPen(pen, Transform(escala, 0, 0, -escala,
                                           x + pos.x_offset * escala,
                                           -pos.y_offset * escala))
        gs[nome].draw(tpen)
        d = pen.getCommands()
        if d:
            partes.append(d)
        x += pos.x_advance * escala + letter_spacing
    largura = x - letter_spacing if texto else 0
    return ' '.join(partes), largura

# Arma assets/plantillas/docx/filosofia_control.docx a partir del formato estándar documento_texto.docx
# Uso: python3 -I tools/plantilla_filosofia.py assets/plantillas/docx/documento_texto.docx <figura.png> assets/plantillas/docx/filosofia_control.docx
# (luego: python3 tools/ordenar_docx.py sobre el resultado)
import sys, zipfile, re
from xml.sax.saxutils import escape
src, figura, out = sys.argv[1:4]
zin = zipfile.ZipFile(src)
files = {i.filename: zin.read(i.filename) for i in zin.infolist()}
infos = {i.filename: i for i in zin.infolist()}
doc = files['word/document.xml'].decode('utf8')

TEXT_W = 8504
def R(t, rpr=''):
    return f'<w:r>{"<w:rPr>"+rpr+"</w:rPr>" if rpr else ""}<w:t xml:space="preserve">{escape(t)}</w:t></w:r>'
def P(t='', style=None, ppr='', rpr=''):
    s = f'<w:pStyle w:val="{style}"/>' if style else ''
    return f'<w:p><w:pPr>{s}{ppr}</w:pPr>{R(t, rpr) if t else ""}</w:p>'
def T(tag): return P(tag)          # párrafo solo con una etiqueta de bucle (docxtemplater lo elimina)
def H(n, t): return P(t, f'Ttulo{n}')
def bloques(nombre):
    return (T('{#%s}' % nombre) + T('{#p}') + P('{p}', 'FCTexto') + T('{/p}') + T('{#b}') + P('{b}', 'FCVineta') + T('{/b}')
            + T('{#b2}') + P('{b2}', 'FCVineta2') + T('{/b2}') + T('{#t}') + P('{t}', 'FCSubtitulo') + T('{/t}') + T('{/%s}' % nombre))
def fld(instr):
    return (f'<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> {instr} </w:instrText></w:r>'
            f'<w:r><w:fldChar w:fldCharType="separate"/></w:r>')
FEND = '<w:r><w:fldChar w:fldCharType="end"/></w:r>'
def caption(label, numtag, texto):
    return f'<w:p><w:pPr><w:pStyle w:val="Descripcin"/></w:pPr>{R(label+" ")}{fld("SEQ "+label+" \\* ARABIC")}{R(numtag)}{FEND}{R(" "+texto)}</w:p>'

BORDE = '<w:tblBorders>' + ''.join(f'<w:{b} w:val="single" w:sz="4" w:space="0" w:color="808080"/>' for b in ['top','left','bottom','right','insideH','insideV']) + '</w:tblBorders>'
def celda(w, texto, fill=None, color=None, bold=False, jc='left', span=1, sz=16, rot=False):
    shd = f'<w:shd w:val="clear" w:color="auto" w:fill="{fill}"/>' if fill else ''
    shd += '<w:textDirection w:val="btLr"/>' if rot else ''
    gs = f'<w:gridSpan w:val="{span}"/>' if span > 1 else ''
    rpr = ('<w:b/><w:bCs/>' if bold else '') + (f'<w:color w:val="{color}"/>' if color else '') + f'<w:sz w:val="{sz}"/><w:szCs w:val="{sz}"/>'
    return (f'<w:tc><w:tcPr><w:tcW w:w="{w}" w:type="dxa"/>{gs}{shd}<w:vAlign w:val="center"/></w:tcPr>'
            f'<w:p><w:pPr><w:pStyle w:val="FCCelda"/><w:jc w:val="{jc}"/></w:pPr>{R(texto, rpr)}</w:p></w:tc>')
def tabla(cols, loop, titulo=None):
    """cols: [(encabezado, clave, ancho, alineación)]; loop: nombre del arreglo; titulo: fila de título combinada"""
    ws = [c[2] for c in cols]; assert sum(ws) == TEXT_W, (loop, sum(ws))
    grid = ''.join(f'<w:gridCol w:w="{w}"/>' for w in ws)
    filas = ''
    hdr = '<w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>'
    if titulo:
        filas += f'<w:tr>{hdr}{celda(TEXT_W, titulo, "17191D", "FFFFFF", True, "center", len(cols), 18)}</w:tr>'
    rot = any(len(c) > 4 and c[4] for c in cols)
    hdr2 = hdr.replace('<w:tblHeader/>', '<w:trHeight w:val="1150"/><w:tblHeader/>') if rot else hdr
    filas += f'<w:tr>{hdr2}' + ''.join(celda(c[2], c[0], '303640', 'FFFFFF', True, 'center', rot=len(c) > 4 and c[4]) for c in cols) + '</w:tr>'
    datos = []
    for k, c in enumerate(cols):
        t = '{' + c[1] + '}'
        if k == 0: t = '{#' + loop + '}' + t
        if k == len(cols) - 1: t = t + '{/' + loop + '}'
        datos.append(celda(c[2], t, jc=c[3]))
    filas += '<w:tr><w:trPr><w:cantSplit/></w:trPr>' + ''.join(datos) + '</w:tr>'
    return (f'<w:tbl><w:tblPr><w:tblW w:w="{TEXT_W}" w:type="dxa"/><w:jc w:val="center"/>{BORDE}<w:tblLayout w:type="fixed"/>'
            f'<w:tblCellMar><w:left w:w="57" w:type="dxa"/><w:right w:w="57" w:type="dxa"/></w:tblCellMar><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>'
            f'<w:tblGrid>{grid}</w:tblGrid>{filas}</w:tbl>')

CX, CY = 5400000, 3037500
IMG = (f'<w:p><w:pPr><w:keepNext/><w:spacing w:before="120" w:after="0"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing>'
       f'<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="{CX}" cy="{CY}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>'
       f'<wp:docPr id="101" name="Arquitectura de control"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>'
       f'<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
       f'<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="101" name="arquitectura.png"/><pic:cNvPicPr/></pic:nvPicPr>'
       f'<pic:blipFill><a:blip r:embed="rIdArq"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
       f'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{CX}" cy="{CY}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>'
       f'</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>')

C, L = 'center', 'left'
b = []
add = b.append
# índices de figuras y tablas (entradas en caché; Word los actualiza al abrir)
TIT = '<w:spacing w:before="240" w:after="240"/><w:jc w:val="center"/>'
RB = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/>'
for titulo, label, arr in [('ÍNDICE DE FIGURAS', 'Figura', 'indice_figuras'), ('ÍNDICE DE TABLAS', 'Tabla', 'indice_tablas')]:
    add(P(titulo, None, TIT, RB))
    add(f'<w:p><w:pPr><w:pStyle w:val="Tabladeilustraciones"/></w:pPr>{fld("TOC \\h \\z \\c &quot;"+label+"&quot;")}</w:p>')
    add(T('{#'+arr+'}')); add(P(label+' {n} {titulo}', 'Tabladeilustraciones')); add(T('{/'+arr+'}'))
    add(f'<w:p><w:pPr><w:pStyle w:val="Tabladeilustraciones"/></w:pPr>{FEND}</w:p>')
add('<w:p><w:r><w:br w:type="page"/></w:r></w:p>')
# 1-6
add(H(1, 'INTRODUCCIÓN')); add(bloques('introduccion'))
add(H(1, 'OBJETIVOS')); add(bloques('objetivos'))
add(H(1, 'REFERENCIAS')); add(bloques('referencias'))
add(H(1, 'ALCANCE')); add(bloques('alcance'))
add(T('{#areas}'))
add(tabla([('ÍTEM','item',900,C),('DESCRIPCIÓN','descripcion',4404,L),('TAG','tag',3200,C)], 'filas', '{titulo}'))
add(caption('Tabla', '{n}', '{nombre}'))
add(T('{/areas}'))
add(bloques('exclusiones'))
add(H(1, 'NORMAS Y ESTÁNDARES')); add(bloques('normas'))
add(H(1, 'CONDICIONES GENERALES')); add(bloques('condiciones'))
# 7
add(H(1, 'ARQUITECTURA DE CONTROL')); add(bloques('arquitectura'))
add(IMG); add(caption('Figura', '{fig_arq}', 'Arquitectura de control'))
# 8
add(H(1, 'DESCRIPCIÓN GENERAL DEL SISTEMA'))
add(T('{#subsistemas}')); add(H(2, '{nombre}')); add(bloques('descripcion'))
for k, tit, arr in [('tiene_alim', 'Alimentación y control', 'alimentacion'), ('tiene_modos', 'Modos de operación', 'modos'), ('tiene_carac', 'Características', 'caracteristicas')]:
    add(T('{#'+k+'}')); add(H(3, tit)); add(bloques(arr)); add(T('{/'+k+'}'))
add(T('{/subsistemas}'))
# 9
add(H(1, 'OPERACIÓN Y LÓGICA DE CONTROL'))
add(H(2, 'DESCRIPCIÓN DE LA OPERACIÓN')); add(bloques('operacion'))
add(T('{#etapas}')); add(H(3, '{titulo}')); add(bloques('texto')); add(T('{/etapas}'))
add(H(3, 'Condiciones de operación')); add(bloques('condiciones_op'))
add(T('{#tiene_equipos}')); add(P('Los equipos que forman el sistema son los siguientes:', 'FCTexto', '<w:keepNext/>'))
add(tabla([('ÍTEM','item',600,C),('EQUIPO','descripcion',2500,L),('TAG','tag',1800,C),('CARACTERÍSTICAS','caracteristicas',3604,L)], 'equipos', 'LISTA DE EQUIPOS'))
add(caption('Tabla', '{t_equipos}', 'Lista de equipos generales')); add(T('{/tiene_equipos}'))
add(T('{#tiene_instrumentos}')); add(P('Instrumentos implicados en el sistema:', 'FCTexto', '<w:keepNext/>'))
add(tabla([('ÍTEM','item',600,C),('INSTRUMENTO','descripcion',2300,L),('SERVICIO','servicio',2600,L),('TIPO DE SEÑAL','senal',1404,C),('TAG','tag',1600,C)], 'instrumentos', 'LISTA DE INSTRUMENTOS'))
add(caption('Tabla', '{t_instrumentos}', 'Lista de instrumentos')); add(T('{/tiene_instrumentos}'))
add(T('{#tiene_alarmas}')); add(P('Alarmas del sistema (en la sección 9.6 se detallan sus valores y acciones):', 'FCTexto', '<w:keepNext/>'))
add(tabla([('ÍTEM','item',500,C),('INSTRUMENTO / EQUIPO','instrumento',1300,C),('ALARMA','descripcion',3154,L),('TIPO','tipo',650,C),('PRIORIDAD','prioridad',1100,C),('TAG DE ALARMA','senal',1800,C)], 'alarmas', 'ALARMAS'))
add(caption('Tabla', '{t_alarmas}', 'Alarmas')); add(T('{/tiene_alarmas}'))
add(H(2, 'INTERLOCKS')); add(bloques('interlocks_txt'))
add(T('{#tiene_interlocks}'))
add(tabla([('TAG','senal',1500,C),('SERVICIO','servicio',1800,L),('PROCESO','proceso',520,C,1),('SEGURIDAD','seguridad',520,C,1),('PERMISIVO','permisivo',520,C,1),('ACCIÓN','accion',2444,L),('NOTAS','notas',1200,C)], 'interlocks', 'INTERLOCKS'))
add(caption('Tabla', '{t_interlocks}', 'Interlocks')); add(T('{/tiene_interlocks}'))
add(H(2, 'MODOS DE OPERACIÓN')); add(bloques('modos'))
add(H(2, 'SECUENCIA DE OPERACIÓN'))
add(T('{#pasos}')); add(P('{titulo}', 'FCPaso')); add(bloques('bloques')); add(T('{/pasos}'))
add(T('{#tiene_arranque}')); add(P('Resumen de la secuencia de arranque:', 'FCTexto', '<w:keepNext/>'))
add(tabla([('PASO','paso',560,C),('EQUIPO','descripcion',1250,L),('TAG','equipo',900,C),('ACCIÓN','accion',1600,L),('CONFIRMACIÓN','confirmacion',1700,L),('TIEMPO','tiempo',830,C),('ANTE FALLA','falla',1664,L)], 'arranque', 'SECUENCIA DE ARRANQUE'))
add(caption('Tabla', '{t_arranque}', 'Secuencia de arranque')); add(T('{/tiene_arranque}'))
add(H(2, 'SECUENCIAS DE PARADA ANTE FALLA O PARADA INTEMPESTIVA'))
add(T('{#tiene_paradas}')); add(P('Ante una falla o una parada intempestiva, el PLC ejecuta las siguientes secuencias de parada (los retardos se ajustan en el programa del PLC):', 'FCTexto')); add(T('{/tiene_paradas}'))
add(T('{#paradas}')); add(P('{titulo}', 'FCPaso')); add(T('{#pasos}')); add(P('{.}', 'FCLista')); add(T('{/pasos}')); add(T('{/paradas}'))
add(T('{#sin_paradas}')); add(P('Sin equipos accionados en el alcance: no se definen secuencias de parada.', 'FCTexto')); add(T('{/sin_paradas}'))
add(H(2, 'ALARMAS Y SET POINTS DE PROCESO')); add(bloques('alarmas_txt'))
add(T('{#verificaciones}')); add(P('{titulo}', 'FCVineta')); add(T('{#items}')); add(P('{.}', 'FCVineta2')); add(T('{/items}')); add(T('{/verificaciones}'))
add(T('{#tiene_setpoints}'))
add(tabla([('TAG','tag',1150,C),('SERVICIO','servicio',2554,L),('RANGO','rango',900,C),('UNIDAD','unidad',900,C),('SP','sp',600,C),('HH','hh',600,C),('H','h',600,C),('L','l',600,C),('LL','ll',600,C)], 'setpoints', 'ALARMAS Y SET POINTS DE PROCESO'))
add(caption('Tabla', '{t_setpoints}', 'Alarmas y set points de proceso'))
add(T('{#sp_pendientes}')); add(P('(*) Valor a definir con Procesos y el fabricante del equipo.', 'FCNota')); add(T('{/sp_pendientes}'))
add(T('{/tiene_setpoints}'))
# 10-11
add(H(1, 'COMUNICACIÓN Y SUPERVISIÓN')); add(bloques('supervision'))
add(T('{#tiene_notas}')); add(H(1, 'NOTAS')); add(bloques('notas')); add(T('{/tiene_notas}'))
cuerpo = ''.join(b)

# documento: se conserva la carátula, la tabla de revisiones y la tabla de contenido del formato estándar
i = doc.index('{#secciones}'); i = doc.rindex('<w:p>', 0, i) if doc.rfind('<w:p>', 0, i) > doc.rfind('<w:p ', 0, i) else doc.rindex('<w:p ', 0, i)
j = doc.index('<w:sectPr', i)
doc = doc[:i] + cuerpo + doc[j:]
assert '{#secciones}' not in doc
files['word/document.xml'] = doc.encode('utf8')

# relaciones: figura de la arquitectura
rels = files['word/_rels/document.xml.rels'].decode('utf8')
rels = rels.replace('</Relationships>', '<Relationship Id="rIdArq" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/arquitectura.png"/></Relationships>')
files['word/_rels/document.xml.rels'] = rels.encode('utf8')
files['word/media/arquitectura.png'] = open(figura, 'rb').read()

# numeración de viñetas propia (abstractNum 11 → numId 14)
num = files['word/numbering.xml'].decode('utf8')
lv = lambda il, txt, font, left: (f'<w:lvl w:ilvl="{il}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="{txt}"/><w:lvlJc w:val="left"/>'
                                  f'<w:pPr><w:ind w:left="{left}" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="{font}" w:hAnsi="{font}" w:hint="default"/></w:rPr></w:lvl>')
absn = ('<w:abstractNum w:abstractNumId="11"><w:nsid w:val="1F4C2A11"/><w:multiLevelType w:val="hybridMultilevel"/><w:tmpl w:val="5B3E2A10"/>'
        + lv(0, '', 'Symbol', 792) + lv(1, '–', 'Arial', 1152) + lv(2, '', 'Wingdings', 1512) + '</w:abstractNum>')
k = num.index('<w:num ')
num = num[:k] + absn + num[k:]
num = num.replace('</w:numbering>', '<w:num w:numId="14"><w:abstractNumId w:val="11"/></w:num></w:numbering>')
assert 'w:numId="14"' not in files['word/numbering.xml'].decode('utf8')
files['word/numbering.xml'] = num.encode('utf8')

# estilos del documento
ARIAL = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'
est = {
 'FCTexto': f'<w:style w:type="paragraph" w:customStyle="1" w:styleId="FCTexto"><w:name w:val="FC Texto"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="0" w:after="120" w:line="276" w:lineRule="auto"/><w:ind w:left="432"/><w:jc w:val="both"/></w:pPr><w:rPr>{ARIAL}<w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>',
 'FCVineta': '<w:style w:type="paragraph" w:customStyle="1" w:styleId="FCVineta"><w:name w:val="FC Viñeta"/><w:basedOn w:val="FCTexto"/><w:qFormat/><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="14"/></w:numPr><w:spacing w:after="60"/><w:ind w:left="792" w:hanging="360"/></w:pPr></w:style>',
 'FCVineta2': '<w:style w:type="paragraph" w:customStyle="1" w:styleId="FCVineta2"><w:name w:val="FC Viñeta 2"/><w:basedOn w:val="FCTexto"/><w:qFormat/><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="14"/></w:numPr><w:spacing w:after="40"/><w:ind w:left="1152" w:hanging="360"/></w:pPr></w:style>',
 'FCSubtitulo': '<w:style w:type="paragraph" w:customStyle="1" w:styleId="FCSubtitulo"><w:name w:val="FC Subtítulo"/><w:basedOn w:val="FCTexto"/><w:next w:val="FCTexto"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="120" w:after="60"/><w:jc w:val="left"/></w:pPr><w:rPr><w:b/><w:bCs/></w:rPr></w:style>',
 'FCPaso': '<w:style w:type="paragraph" w:customStyle="1" w:styleId="FCPaso"><w:name w:val="FC Paso"/><w:basedOn w:val="FCTexto"/><w:next w:val="FCTexto"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="80"/><w:jc w:val="left"/></w:pPr><w:rPr><w:b/><w:bCs/></w:rPr></w:style>',
 'FCLista': '<w:style w:type="paragraph" w:customStyle="1" w:styleId="FCLista"><w:name w:val="FC Lista"/><w:basedOn w:val="FCTexto"/><w:qFormat/><w:pPr><w:spacing w:after="40"/><w:ind w:left="1080" w:hanging="288"/><w:jc w:val="left"/></w:pPr></w:style>',
 'FCNota': '<w:style w:type="paragraph" w:customStyle="1" w:styleId="FCNota"><w:name w:val="FC Nota"/><w:basedOn w:val="FCTexto"/><w:pPr><w:spacing w:after="160"/></w:pPr><w:rPr><w:i/><w:iCs/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style>',
 'FCCelda': f'<w:style w:type="paragraph" w:customStyle="1" w:styleId="FCCelda"><w:name w:val="FC Celda"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="20" w:after="20" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr>{ARIAL}<w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style>',
 'Descripcin': f'<w:style w:type="paragraph" w:styleId="Descripcin"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="35"/><w:unhideWhenUsed/><w:qFormat/><w:pPr><w:spacing w:before="80" w:after="240" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:rPr>{ARIAL}<w:i/><w:iCs/><w:color w:val="303640"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>',
 'Tabladeilustraciones': f'<w:style w:type="paragraph" w:styleId="Tabladeilustraciones"><w:name w:val="table of figures"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="8494"/></w:tabs><w:spacing w:after="60" w:line="240" w:lineRule="auto"/><w:ind w:left="432"/></w:pPr><w:rPr>{ARIAL}<w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>',
}
sty = files['word/styles.xml'].decode('utf8')
for sid, x in est.items():
    assert f'w:styleId="{sid}"' not in sty, sid
sty = sty.replace('</w:styles>', ''.join(est.values()) + '</w:styles>')
files['word/styles.xml'] = sty.encode('utf8')

zout = zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED)
orden = list(infos.keys()) + [k for k in files if k not in infos]
for k in orden:
    zi = infos.get(k)
    if zi is not None: zout.writestr(zi, files[k], compress_type=zipfile.ZIP_DEFLATED)
    else: zout.writestr(k, files[k], compress_type=zipfile.ZIP_DEFLATED)
zout.close()
print('ok', out, len(doc))

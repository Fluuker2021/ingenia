"""Ordena según el esquema OOXML (ECMA-376) los elementos que Word valida en orden estricto dentro de las
plantillas Word de Ingenia: propiedades de tabla (w:tblPr) y w:updateFields en settings.xml.
Uso: python3 ordenar_docx.py plantilla.docx [...]"""
import sys, zipfile, os
from lxml import etree

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
q = lambda n: '{%s}%s' % (W, n)
ORDEN_TBLPR = ['tblStyle', 'tblpPr', 'tblOverlap', 'bidiVisual', 'tblStyleRowBandSize', 'tblStyleColBandSize', 'tblW', 'jc',
               'tblCellSpacing', 'tblInd', 'tblBorders', 'shd', 'tblLayout', 'tblCellMar', 'tblLook', 'tblCaption', 'tblDescription', 'tblPrChange']
DESPUES_DE_UPDATEFIELDS = ['hdrShapeDefaults', 'footnotePr', 'endnotePr', 'compat', 'docVars', 'rsids', 'mathPr', 'attachedSchema', 'themeFontLang',
                           'clrSchemeMapping', 'doNotIncludeSubdocsInStats', 'doNotAutoCompressPictures', 'forceUpgrade', 'captions',
                           'readModeInkLockDown', 'smartTagType', 'schemaLibrary', 'shapeDefaults', 'doNotEmbedSmartTags', 'decimalSymbol', 'listSeparator']


def ordenar_tblpr(raiz):
    n = 0
    for pr in raiz.iter(q('tblPr')):
        hijos = list(pr)
        clave = lambda e: ORDEN_TBLPR.index(etree.QName(e).localname) if etree.QName(e).namespace == W and etree.QName(e).localname in ORDEN_TBLPR else len(ORDEN_TBLPR)
        nuevos = sorted(hijos, key=clave)
        if nuevos != hijos:
            for e in hijos: pr.remove(e)
            for e in nuevos: pr.append(e)
            n += 1
    return n


def mover_updatefields(raiz):
    uf = raiz.find(q('updateFields'))
    if uf is None:
        return 0
    raiz.remove(uf)
    for e in list(raiz):
        qn = etree.QName(e)
        if qn.localname in DESPUES_DE_UPDATEFIELDS or qn.namespace != W:
            e.addprevious(uf)
            return 1
    raiz.append(uf)
    return 1


for ruta in sys.argv[1:]:
    tmp = ruta + '.tmp'
    zin = zipfile.ZipFile(ruta); zout = zipfile.ZipFile(tmp, 'w')
    cambios = {}
    for it in zin.infolist():
        data = zin.read(it.filename)
        if it.filename in ('word/document.xml', 'word/settings.xml') or (it.filename.startswith('word/header') or it.filename.startswith('word/footer')) and it.filename.endswith('.xml'):
            raiz = etree.fromstring(data)
            n = ordenar_tblpr(raiz) + (mover_updatefields(raiz) if it.filename == 'word/settings.xml' else 0)
            if n:
                cambios[it.filename] = n
                data = b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + etree.tostring(raiz, encoding='UTF-8')
        zout.writestr(it, data, compress_type=it.compress_type)
    zout.close(); zin.close(); os.replace(tmp, ruta)
    print(os.path.basename(ruta), cambios)

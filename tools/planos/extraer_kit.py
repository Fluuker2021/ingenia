"""Extrae de un plano DXF de referencia (convertido desde el DWG del usuario) las «piezas» con las que
Ingenia arma sus planos: cada pieza es un grupo de primitivas DXF R12 (líneas, polilíneas, arcos, círculos,
textos y rellenos SOLID) tomadas de un rectángulo del plano, con coordenadas relativas a su punto de anclaje
y con los textos variables convertidos en marcadores {clave}.

Uso:
  python3 extraer_kit.py unifilar  plantilla_unifilar.dxf  ../../assets/plantillas/planos/unifilar.json
  python3 extraer_kit.py multifilar plantilla_multifilar.dxf ../../assets/plantillas/planos/multifilar.json
  python3 extraer_kit.py textos plantilla.dxf  x0 y0 x1 y1        (lista los textos de una zona)

El DWG se convierte a DXF con LibreDWG (paquete npm @mlightcad/libredwg-web, función dwg_write_dxf).
Los bloques se descomponen (con sus atributos), los MTEXT se dividen en líneas de TEXT y los HATCH sólidos
se triangulan en SOLID, para que el resultado sea DXF R12 puro (el que abre AutoCAD sin problemas)."""
import sys, json, math
from ezdxf import recover, path as ezpath
from ezdxf.math import Vec3
from ezdxf.math.triangulation import mapbox_earcut_2d

from piezas import PIEZAS  # definición de piezas por plantilla (rectángulos, anclas y marcadores)

R = lambda v: round(float(v), 2)


def resolver_color(e, padre_color=None):
    c = e.dxf.get('color', 256)
    if c == 0 and padre_color is not None:   # BYBLOCK
        return padre_color
    return None if c in (0, 256) else c


def resolver_lt(e):
    lt = e.dxf.get('linetype', 'BYLAYER')
    return None if lt.upper() in ('BYLAYER', 'BYBLOCK') else lt


def limpio(nombre):
    """nombre de capa válido en DXF R12 (letras, dígitos, $, - y _)"""
    import re
    return re.sub(r'[^A-Za-z0-9_$-]', '_', nombre)


def capa(e, padre_capa=None):
    l = limpio(e.dxf.get('layer', '0'))
    return padre_capa if (l == '0' and padre_capa) else l


def envolver(texto, n):
    out, cur = [], ''
    for w in texto.split():
        if len((cur + ' ' + w).strip()) > n and cur:
            out.append(cur); cur = w
        else:
            cur = (cur + ' ' + w).strip()
    if cur:
        out.append(cur)
    return out or ['']


def mtext_a_texto(m):
    """MTEXT → un TEXT de varias líneas («\n»), alineado arriba en la posición de la primera línea.
    Los párrafos se cortan al ancho del MTEXT con un ancho de carácter de 0,9·h (fuente estándar de AutoCAD, más ancha que ROMAND)."""
    txt = m.plain_text().replace('\r', '')
    h = m.dxf.char_height
    ancho = m.dxf.get('width', 0) or 0
    lineas = []
    for par in txt.split('\n'):
        lineas += envolver(par, max(4, int(ancho / (h * 0.9)))) if ancho > 0 else [par]
    while lineas and not lineas[-1].strip():
        lineas.pop()
    ls = h * 1.6667
    ap = m.dxf.get('attachment_point', 1)
    fila, col = (ap - 1) // 3, (ap - 1) % 3     # fila 0 arriba, 1 medio, 2 abajo; col 0 izq, 1 centro, 2 der
    n = len(lineas)
    alto = (n - 1) * ls + h
    top = {0: 0, 1: alto / 2, 2: alto}[fila]
    dirv = m.dxf.get('text_direction', None)
    rot = math.degrees(math.atan2(dirv.y, dirv.x)) if dirv is not None and (dirv.x or dirv.y) else m.dxf.get('rotation', 0)
    ca, sa = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    ins = m.dxf.insert
    return dict(x=ins.x - sa * top, y=ins.y + ca * top, h=h, rot=rot, text='\n'.join(lineas), ha=col, va=3)


def primitivas(e, padre=None, out=None):
    """Descompone una entidad en primitivas R12: tuplas (tipo, capa, color, lt, geom...)."""
    if out is None:
        out = []
    pc = padre['color'] if padre else None
    pl = padre['capa'] if padre else None
    t = e.dxftype()
    lay = capa(e, pl)
    col = resolver_color(e, pc)
    lt = resolver_lt(e)
    if t == 'LINE':
        s, f = e.dxf.start, e.dxf.end
        out.append(['L', lay, col, lt, R(s.x), R(s.y), R(f.x), R(f.y)])
    elif t == 'CIRCLE':
        c = e.dxf.center
        out.append(['C', lay, col, lt, R(c.x), R(c.y), R(e.dxf.radius)])
    elif t == 'ARC':
        c = e.dxf.center
        out.append(['A', lay, col, lt, R(c.x), R(c.y), R(e.dxf.radius), R(e.dxf.start_angle), R(e.dxf.end_angle)])
    elif t in ('LWPOLYLINE', 'POLYLINE'):
        pts = list(e.get_points('xyb')) if t == 'LWPOLYLINE' else [(v.dxf.location.x, v.dxf.location.y, v.dxf.get('bulge', 0)) for v in e.vertices]
        ancho = e.dxf.get('const_width', 0) if t == 'LWPOLYLINE' else 0
        if any(abs(p[2]) > 1e-9 for p in pts):
            for v in e.virtual_entities():
                primitivas(v, dict(color=col if col is not None else pc, capa=lay), out)
        elif ancho and ancho > 0.3:
            # polilínea gruesa → rellenos SOLID por tramo
            seq = pts + ([pts[0]] if e.closed else [])
            for (x1, y1, _), (x2, y2, _) in zip(seq, seq[1:]):
                dx, dy = x2 - x1, y2 - y1; L = math.hypot(dx, dy) or 1
                nx, ny = -dy / L * ancho / 2, dx / L * ancho / 2
                out.append(['S', lay, col, None, R(x1 + nx), R(y1 + ny), R(x1 - nx), R(y1 - ny), R(x2 + nx), R(y2 + ny), R(x2 - nx), R(y2 - ny)])
        else:
            flat = []
            for p in pts:
                flat += [R(p[0]), R(p[1])]
            out.append(['P', lay, col, lt, 1 if e.closed else 0, flat])
    elif t == 'SOLID' or t == 'TRACE':
        v = [e.dxf.vtx0, e.dxf.vtx1, e.dxf.vtx2, e.dxf.get('vtx3', e.dxf.vtx2)]
        out.append(['S', lay, col, None] + [R(c) for p in v for c in (p.x, p.y)])
    elif t == 'HATCH':
        if e.dxf.get('solid_fill', 0):
            try:
                for sub in ezpath.from_hatch(e):
                    poly = [Vec3(v) for v in sub.flattening(0.05)]
                    if len(poly) < 3:
                        continue
                    for tri in mapbox_earcut_2d(poly):
                        a, b, c = tri
                        out.append(['S', lay, col, None, R(a.x), R(a.y), R(b.x), R(b.y), R(c.x), R(c.y), R(c.x), R(c.y)])
            except Exception as ex:
                print('hatch omitido:', ex, file=sys.stderr)
    elif t == 'TEXT' or t == 'ATTRIB' or t == 'ATTDEF':
        if t in ('ATTRIB', 'ATTDEF') and (e.dxf.get('flags', 0) & 1):
            return out        # atributo invisible
        if t == 'ATTDEF':
            return out
        txt = e.dxf.text or ''
        if not txt.strip():
            return out
        ha, va = e.dxf.get('halign', 0), e.dxf.get('valign', 0)
        p = e.dxf.align_point if (ha or va) and e.dxf.hasattr('align_point') else e.dxf.insert
        if ha in (3, 5):   # alineado / ajustado → centro
            ha = 1
            p = e.dxf.insert.lerp(e.dxf.get('align_point', e.dxf.insert), 0.5)
        out.append(['T', lay, col, None, R(p.x), R(p.y), R(e.dxf.height), R(e.dxf.get('rotation', 0)), txt, ha, va, R(e.dxf.get('width', 1))])
    elif t == 'MTEXT':
        d = mtext_a_texto(e)
        if d['text'].strip():
            out.append(['T', lay, col, None, R(d['x']), R(d['y']), R(d['h']), R(d['rot']), d['text'], d['ha'], d['va'], 1])
    elif t == 'INSERT':
        ic = col if col is not None else pc
        for v in e.virtual_entities():
            if v.dxftype() == 'ATTDEF':
                continue
            primitivas(v, dict(color=ic, capa=lay), out)
        for a in e.attribs:
            primitivas(a, dict(color=ic, capa=lay), out)
    elif t in ('LEADER', 'DIMENSION', 'MLEADER'):
        try:
            for v in e.virtual_entities():
                primitivas(v, dict(color=col if col is not None else pc, capa=lay), out)
        except Exception:
            pass
    return out


def caja(p):
    """bbox de una primitiva."""
    t = p[0]
    if t == 'L':
        xs, ys = [p[4], p[6]], [p[5], p[7]]
    elif t in ('C', 'A'):
        xs, ys = [p[4] - p[6], p[4] + p[6]], [p[5] - p[6], p[5] + p[6]]
    elif t == 'P':
        xs, ys = p[5][0::2], p[5][1::2]
    elif t == 'S':
        xs, ys = p[4:12:2], p[5:12:2]
    elif t == 'T':
        h = p[6]; filas = p[8].split('\n'); n = max(len(f) for f in filas)
        w = n * h * 0.62 * (p[11] or 1)
        extra = (len(filas) - 1) * h * 1.6667
        rot = math.radians(p[7]); ca, sa = math.cos(rot), math.sin(rot)
        ha, va = p[9], p[10]
        ox = {0: 0, 1: -w / 2, 2: -w}.get(ha, 0)
        oy = {0: 0, 1: 0, 2: -h / 2, 3: -h}.get(va, 0)
        pts = [(ox, oy - extra), (ox + w, oy - extra), (ox, oy + h), (ox + w, oy + h)]
        xs = [p[4] + x * ca - y * sa for x, y in pts]; ys = [p[5] + x * sa + y * ca for x, y in pts]
    else:
        return None
    return min(xs), min(ys), max(xs), max(ys)


def dentro(b, r, tol=0.6):
    return b[0] >= r[0] - tol and b[1] >= r[1] - tol and b[2] <= r[2] + tol and b[3] <= r[3] + tol


def mover(p, dx, dy):
    q = list(p); t = p[0]
    if t == 'L':
        q[4] += dx; q[5] += dy; q[6] += dx; q[7] += dy
    elif t in ('C', 'A', 'T'):
        q[4] += dx; q[5] += dy
    elif t == 'P':
        q[5] = [v + (dx if i % 2 == 0 else dy) for i, v in enumerate(p[5])]
    elif t == 'S':
        for i in range(4, 12):
            q[i] += dx if i % 2 == 0 else dy
    for i in range(4, len(q)):
        if isinstance(q[i], float):
            q[i] = R(q[i])
    if t == 'P':
        q[5] = [R(v) for v in q[5]]
    return q


def segmentos(prims, minimo=5):
    """tramos horizontales y verticales (de líneas y polilíneas) para detectar las celdas de una tabla"""
    hs, vs = [], []
    for p in prims:
        pts = []
        if p[0] == 'L':
            pts = [((p[4], p[5]), (p[6], p[7]))]
        elif p[0] == 'P':
            xy = list(zip(p[5][0::2], p[5][1::2]))
            if p[4]:
                xy.append(xy[0])
            pts = list(zip(xy, xy[1:]))
        for (x1, y1), (x2, y2) in pts:
            if abs(y1 - y2) < 0.05 and abs(x1 - x2) >= minimo:
                hs.append((min(x1, x2), max(x1, x2), y1))
            elif abs(x1 - x2) < 0.05 and abs(y1 - y2) >= minimo:
                vs.append((min(y1, y2), max(y1, y2), x1))
    return hs, vs


def celda(cx, cy, hs, vs):
    izq = max((x for y0, y1, x in vs if y0 - 0.1 <= cy <= y1 + 0.1 and x < cx), default=None)
    der = min((x for y0, y1, x in vs if y0 - 0.1 <= cy <= y1 + 0.1 and x > cx), default=None)
    aba = max((y for x0, x1, y in hs if x0 - 0.1 <= cx <= x1 + 0.1 and y < cy), default=None)
    arr = min((y for x0, x1, y in hs if x0 - 0.1 <= cx <= x1 + 0.1 and y > cy), default=None)
    if None in (izq, der, aba, arr):
        return None
    return izq, aba, der, arr


def centrar_textos(sel, cfg):
    """centra en su caja (o en la celda de la tabla) los textos horizontales de la pieza: ha=1, va=2"""
    cajas = cfg.get('cajas', [])
    zona = cfg.get('zona')
    hs, vs = segmentos(sel) if cfg.get('celdas') else ([], [])
    out = []
    for p in sel:
        if p[0] == 'T' and abs(p[7]) < 0.1 and p[1] in ('G-TEX', 'G-TEXT', 'L-TEXT'):
            b = caja(p); cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
            if zona is None or (zona[0] <= cx <= zona[2] and zona[1] <= cy <= zona[3]):
                c = next((k for k in cajas if k[0] <= cx <= k[2] and k[1] <= cy <= k[3]), None) or (celda(cx, cy, hs, vs) if cfg.get('celdas') else None)
                if c:
                    p = list(p); p[4] = R((c[0] + c[2]) / 2); p[5] = R((c[1] + c[3]) / 2); p[9] = 1; p[10] = 2
        out.append(p)
    return out


def cargar(path):
    doc, _ = recover.readfile(path)
    return doc


def todas(doc, region=None):
    prims = []
    for e in doc.modelspace():
        if e.dxftype() in ('VIEWPORT', 'OLE2FRAME', 'IMAGE', 'WIPEOUT'):
            continue
        for p in primitivas(e):
            b = caja(p)
            if b is None:
                continue
            if region and not dentro(b, region, 2):
                continue
            prims.append(p)
    return prims


def tablas(doc, usados):
    capas = {}
    for l in doc.layers:
        if limpio(l.dxf.name) in usados:
            capas[limpio(l.dxf.name)] = dict(c=abs(l.dxf.color), lt=l.dxf.linetype)
    lts = {}
    for name in set([c['lt'] for c in capas.values()]):
        if name.upper() in ('CONTINUOUS', 'BYLAYER', 'BYBLOCK'):
            continue
        if name in doc.linetypes:
            lt = doc.linetypes.get(name)
            pat = []
            try:
                tags = lt.pattern_tags.tags
                pat = [round(t.value, 4) for t in tags if t.code == 49]
            except Exception:
                pass
            if pat:
                lts[name] = dict(d=lt.dxf.get('description', ''), p=pat)
    return capas, lts


def extraer(tipo, entrada, salida):
    cfg = PIEZAS[tipo]
    doc = cargar(entrada)
    prims = todas(doc)
    piezas, usados, barras = {}, set(), {}
    asignado = set()
    for nombre, pz in cfg['piezas'].items():
        rects = pz['rects']
        ax, ay = pz.get('ancla', (0, 0))
        repl = pz.get('textos', {})
        omit = pz.get('omitir', [])
        sel = []
        for i, p in enumerate(prims):
            if i in asignado and not pz.get('compartida'):
                continue
            if pz.get('capas') and p[1] not in pz['capas']:
                continue
            b = caja(p)
            if pz.get('centro'):
                cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
                if not any(r[0] <= cx < r[2] and r[1] <= cy < r[3] for r in rects):
                    continue
                if (b[2] - b[0]) > pz.get('max_ancho', 1e9):
                    continue
            elif not any(dentro(b, r) for r in rects):
                continue
            # tramos horizontales de barras (se dibujan continuos en el generador)
            yb = pz.get('barras_y')
            if yb and p[0] in ('L', 'P') and (b[3] - b[1]) < 0.3 and (b[2] - b[0]) > 2 and any(abs(b[1] - y) < 0.4 for y in yb):
                barras.setdefault(round(min(yb, key=lambda y: abs(b[1] - y)), 2), [p[1], p[3]])
                asignado.add(i)
                continue
            if any(dentro(b, r, 0) for r in omit):
                continue
            if p[0] == 'T':
                t = p[8].strip()
                norm = ' '.join(t.split())
                repl = {' '.join(k.split()): v for k, v in repl.items()}
                t = norm
                if t in repl:
                    if repl[t] == '':
                        continue
                    p = list(p); p[8] = repl[t]
                elif pz.get('solo_marcadores_texto'):
                    pass
            sel.append(mover(p, -ax, -ay))
            if not pz.get('compartida'):
                asignado.add(i)
            usados.add(p[1])
        if pz.get('centrar'):
            # las coordenadas ya están relativas al ancla: se llevan las cajas al mismo sistema
            cz = dict(pz['centrar'])
            cz['cajas'] = [(k[0] - ax, k[1] - ay, k[2] - ax, k[3] - ay) for k in cz.get('cajas', [])]
            if cz.get('zona'):
                z = cz['zona']; cz['zona'] = (z[0] - ax, z[1] - ay, z[2] - ax, z[3] - ay)
            sel = centrar_textos(sel, cz)
        piezas[nombre] = dict(ancla=[ax, ay], n=len(sel), e=sel, **{k: v for k, v in pz.items() if k in ('info',)})
    capas, lts = tablas(doc, usados)
    ltscale = doc.header.get('$LTSCALE', 1.0)
    for capa_b, _ in barras.values():
        usados.add(capa_b)
    capas, lts = tablas(doc, usados)
    kit = dict(fuente=cfg.get('fuente', ''), ltscale=ltscale, capas=capas, tipos_linea=lts, barras=barras, piezas=piezas)
    with open(salida, 'w', encoding='utf-8') as f:
        json.dump(kit, f, ensure_ascii=False, separators=(',', ':'))
    print(salida, {k: v['n'] for k, v in piezas.items()})


def listar_textos(entrada, x0, y0, x1, y1):
    doc = cargar(entrada)
    for p in sorted(todas(doc, (x0, y0, x1, y1)), key=lambda p: (-p[5], p[4]) if p[0] == 'T' else (0, 0)):
        if p[0] == 'T':
            print(p[4], p[5], p[6], p[7], repr(p[8]), p[1], 'ha', p[9], 'va', p[10])


if __name__ == '__main__':
    if sys.argv[1] == 'textos':
        listar_textos(sys.argv[2], *map(float, sys.argv[3:7]))
    else:
        extraer(sys.argv[1], sys.argv[2], sys.argv[3])

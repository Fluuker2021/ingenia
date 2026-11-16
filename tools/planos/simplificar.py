"""Simplificación de las «imágenes» vectoriales de los planos de referencia (equipos dibujados con miles de
segmentos diminutos): encadena los segmentos que comparten extremos en polilíneas, las simplifica con
Douglas-Peucker y descarta los detalles más pequeños que la tolerancia de impresión. Conserva capa, color y
tipo de línea. Así una imagen de ~6000 primitivas queda en unas pocas centenas con el mismo aspecto en A1."""
import math

R = lambda v: round(float(v), 2)


def _dp(pts, tol):
    if len(pts) < 3:
        return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy)
    dmax, k = 0, 0
    for i in range(1, len(pts) - 1):
        x, y = pts[i]
        d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / L if L > 1e-9 else math.hypot(x - x1, y - y1)
        if d > dmax:
            dmax, k = d, i
    if dmax <= tol:
        return [pts[0], pts[-1]]
    return _dp(pts[:k + 1], tol)[:-1] + _dp(pts[k:], tol)


def simplificar(prims, tol=0.05, minimo=0.25, area_solid=0.6):
    segs, otros = {}, []
    for p in prims:
        t = p[0]
        if t == 'L':
            segs.setdefault((p[1], p[2], p[3]), []).append([(p[4], p[5]), (p[6], p[7])])
        elif t == 'P':
            xy = list(zip(p[5][0::2], p[5][1::2]))
            if p[4]:
                xy.append(xy[0])
            segs.setdefault((p[1], p[2], p[3]), []).append(xy)
        elif t == 'S':
            xs, ys = p[4:12:2], p[5:12:2]
            a = abs((xs[1] - xs[0]) * (ys[2] - ys[0]) - (xs[2] - xs[0]) * (ys[1] - ys[0])) / 2
            if a >= area_solid:
                otros.append(p)
        elif t in ('C', 'A'):
            if p[6] >= minimo / 2:
                otros.append(p)
        elif t == 'T':
            if p[6] >= 0.6:            # rótulos diminutos de la imagen (ilegibles en A1): se descartan
                otros.append(p)
        else:
            otros.append(p)
    out = []
    for (lay, col, lt), cadenas in segs.items():
        # encadenar por extremos coincidentes (redondeo 0.02 mm)
        k = lambda q: (round(q[0] / 0.02), round(q[1] / 0.02))
        libres = [list(c) for c in cadenas if len(c) >= 2]
        por_ext = {}
        for i, c in enumerate(libres):
            por_ext.setdefault(k(c[0]), []).append(i)
            por_ext.setdefault(k(c[-1]), []).append(i)
        usado = [False] * len(libres)
        for i in range(len(libres)):
            if usado[i]:
                continue
            usado[i] = True
            cad = libres[i][:]
            for lado in (1, 0):
                while True:
                    ext = cad[-1] if lado else cad[0]
                    sig = next((j for j in por_ext.get(k(ext), []) if not usado[j]), None)
                    if sig is None:
                        break
                    usado[sig] = True
                    c = libres[sig]
                    if k(c[0]) != k(ext):
                        c = c[::-1]                    # c empieza en el extremo común
                    cad = cad + c[1:] if lado else c[::-1] + cad[1:]
            sp = _dp(cad, tol)
            xs, ys = [q[0] for q in sp], [q[1] for q in sp]
            if max(max(xs) - min(xs), max(ys) - min(ys)) < minimo:
                continue
            if len(sp) == 2:
                out.append(['L', lay, col, lt, R(sp[0][0]), R(sp[0][1]), R(sp[1][0]), R(sp[1][1])])
            else:
                cerrada = k(sp[0]) == k(sp[-1]) and len(sp) > 3
                if cerrada:
                    sp = sp[:-1]
                out.append(['P', lay, col, lt, 1 if cerrada else 0, [R(v) for q in sp for v in q]])
    return out + otros

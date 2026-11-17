# Validador estricto DXF R12 (AC1009): códigos de grupo por entidad, nombres de tablas, números y textos
import sys, re, math
PERM = { 'LINE':{8,62,6,10,20,30,11,21,31,39},'CIRCLE':{8,62,6,10,20,30,40,39},'ARC':{8,62,6,10,20,30,40,50,51,39},
 'TEXT':{8,62,6,10,20,30,40,1,50,41,51,7,71,72,73,11,21,31},'SOLID':{8,62,6,10,20,30,11,21,31,12,22,32,13,23,33},
 'POINT':{8,62,6,10,20,30},'INSERT':{8,62,6,66,2,10,20,30,41,42,43,50},'POLYLINE':{8,62,6,66,10,20,30,70,40,41},'VERTEX':{8,62,6,10,20,30,40,41,42,70},'SEQEND':{8}}
NOMBRE = re.compile(r'^[A-Za-z0-9$_\-]{1,31}$')
f = sys.argv[1]; raw = open(f,'rb').read()
try: txt = raw.decode('cp1252')
except Exception as e: print('NO cp1252', e); txt = raw.decode('latin1')
L = txt.split('\n'); errs = []
if len(L)%2: errs.append('número impar de líneas')
pares = [(L[i].strip(), L[i+1]) for i in range(0, len(L)-1, 2)]
for i,(c,v) in enumerate(pares):
    if not re.fullmatch(r'-?\d+', c): errs.append(f'código no numérico en par {i}: {c!r}'); break
sec = None; ent = None; tabla=None; capas=set(); lts={'CONTINUOUS','BYLAYER','BYBLOCK'}; usadas_lt=set(); usadas_cap=set(); bloques=set(); ins=set()
for i,(c,v) in enumerate(pares):
    c = int(c)
    if c==0:
        ent = v
        if v=='SECTION': pass
        continue
    if c==2 and ent=='SECTION': sec = v; continue
    if c==2 and ent=='TABLE': tabla=v; continue
    if c==2 and ent=='LAYER': capas.add(v); (NOMBRE.match(v) or errs.append(f'capa inválida {v!r}'))
    if c==2 and ent=='LTYPE': lts.add(v); (NOMBRE.match(v) or errs.append(f'tipo de línea inválido {v!r}'))
    if c==2 and ent=='BLOCK': bloques.add(v); (NOMBRE.match(v) or errs.append(f'bloque inválido {v!r}'))
    if c==6 and ent=='LAYER': usadas_lt.add(v)
    if sec in ('ENTITIES','BLOCKS') and ent in PERM:
        if c not in PERM[ent]: errs.append(f'{ent} con código {c} (par {i})')
        if c==8: usadas_cap.add(v)
        if c==6: usadas_lt.add(v)
        if c==2 and ent=='INSERT': ins.add(v)
    elif sec=='ENTITIES' and ent not in PERM and ent not in ('SECTION','ENDSEC','EOF'): errs.append(f'entidad no R12 {ent}')
    if (10<=c<=59) or c in (210,220,230):
        try:
            x=float(v)
            if not math.isfinite(x): errs.append(f'número no finito {v} en {ent}')
        except: errs.append(f'número inválido {v!r} en {ent} código {c}')
    if c==1:
        if len(v)>255: errs.append(f'texto >255 ({len(v)})')
        if v.strip()=='' : errs.append('texto vacío')
    if c==62:
        if not re.fullmatch(r'-?\d+', v.strip()) or not (-256<=int(v)<=256): errs.append(f'color inválido {v!r}')
for lt in usadas_lt-lts: errs.append(f'tipo de línea no definido {lt}')
for c in usadas_cap:
    if not NOMBRE.match(c): errs.append(f'capa inválida en entidad {c!r}')
for b in ins-bloques: errs.append(f'bloque no definido {b}')
from collections import Counter
cnt = Counter(errs)
print(f, 'OK' if not errs else f'{len(errs)} errores')
for e,n in cnt.most_common(12): print('   ', n, '×', e)

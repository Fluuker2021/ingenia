/* Ingenia — piezas de planos tomadas de los planos de referencia del usuario.
   Los planos de referencia (DWG) se convirtieron a DXF y se extrajeron sus piezas con
   tools/planos/extraer_kit.py → assets/plantillas/planos/<nombre>.json. Cada pieza conserva la geometría,
   capas, colores, tipos de línea y textos del plano original; los textos variables son marcadores {clave}
   que se reemplazan con los datos del proyecto. Los planos de Ingenia se arman colocando estas piezas. */

const cache = {};
export function cargarKit(nombre){
  if(!cache[nombre]) cache[nombre] = fetch(`assets/plantillas/planos/${nombre}.json`).then(r=>{ if(!r.ok) throw new Error("No se encontró el kit de plano "+nombre); return r.json(); });
  return cache[nombre];
}
/* capas y tipos de línea del plano de referencia en el documento DXF */
export function usarKit(doc, kit){
  Object.assign(doc.capas, kit.capas||{});
  Object.assign(doc.tiposLinea, kit.tipos_linea||{});
}

/* caja aproximada de una primitiva (coordenadas de la pieza) */
function caja(e){
  const t = e[0];
  if(t==="L") return [Math.min(e[4],e[6]), Math.min(e[5],e[7]), Math.max(e[4],e[6]), Math.max(e[5],e[7])];
  if(t==="C"||t==="A") return [e[4]-e[6], e[5]-e[6], e[4]+e[6], e[5]+e[6]];
  if(t==="P"){ const xs = e[5].filter((_,i)=>i%2===0), ys = e[5].filter((_,i)=>i%2===1); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
  if(t==="S"){ const xs = [e[4],e[6],e[8],e[10]], ys = [e[5],e[7],e[9],e[11]]; return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
  if(t==="T"){ const h = e[6], w = String(e[8]).length*h*0.72; const r = (e[7]||0)*Math.PI/180; const ca = Math.cos(r), sa = Math.sin(r);
    const ox = [0,-w/2,-w][e[9]]||0, oy = [0,0,-h/2,-h][e[10]]||0;
    const pts = [[ox,oy],[ox+w,oy],[ox,oy+h],[ox+w,oy+h]].map(([x,y])=>[e[4]+x*ca-y*sa, e[5]+x*sa+y*ca]);
    return [Math.min(...pts.map(p=>p[0])), Math.min(...pts.map(p=>p[1])), Math.max(...pts.map(p=>p[0])), Math.max(...pts.map(p=>p[1]))]; }
  return null;
}
const dentro = (b, r)=> b && b[0]>=r[0] && b[1]>=r[1] && b[2]<=r[2] && b[3]<=r[3];

/* divide un texto en líneas de hasta n caracteres */
export function envolver(s, n){
  const out = []; let cur = "";
  for(const w of String(s||"").split(/\s+/)){ if(!w) continue; if((cur+" "+w).trim().length > n){ if(cur) out.push(cur); cur = w; } else cur = (cur+" "+w).trim(); }
  if(cur) out.push(cur);
  return out;
}

/* acomoda un texto en una celda de ancho × alto (mm): lo divide en líneas y, si aun así no entra, reduce la altura.
   El ancho por carácter se toma holgado (k × altura; las fuentes de AutoCAD y de los visores DXF ocupan ~0,9-1,0 ×
   altura en mayúsculas con factor de ancho 1) para que el texto nunca salga de su recuadro.
   Devuelve { texto (líneas separadas por "\n"), h }. */
export function encajar(txt, ancho, alto, h, { k=1, wf=1, maxLineas=3, hMin=1.4 }={}){
  const plano = String(txt||"").replace(/\s*\n\s*/g, " ").trim();
  let hh = h;
  for(;;){
    const n = Math.max(4, Math.floor(ancho/(k*wf*hh)));
    const ls = envolver(plano, n);
    const caben = Math.max(1, Math.min(maxLineas, Math.floor((alto - hh)/(hh*1.6667)) + 1));
    if((ls.length <= caben && ls.every(l=>l.length <= n)) || hh <= hMin) return { texto: ls.join("\n"), h: hh };
    hh = Math.max(hMin, hh*0.92);
  }
}

/* celdas de las tablas de una pieza (leyendas): segmentos verticales de sus líneas y polilíneas, para que ningún
   texto fijo salga de su recuadro aunque la fuente del visor sea más ancha que la del plano de referencia */
const _verticales = new WeakMap();
function verticales(pz){
  let V = _verticales.get(pz); if(V) return V;
  V = [];
  for(const e of pz.e){
    if(e[0]==="L" && Math.abs(e[4] - e[6]) < 0.01) V.push([e[4], Math.min(e[5], e[7]), Math.max(e[5], e[7])]);
    if(e[0]==="P"){ const p = e[5], n = p.length/2;
      for(let i=0; i<n; i++){ const j = (i + 1)%n; if(!e[4] && j===0) continue;
        if(Math.abs(p[2*i] - p[2*j]) < 0.01) V.push([p[2*i], Math.min(p[2*i+1], p[2*j+1]), Math.max(p[2*i+1], p[2*j+1])]); } }
  }
  _verticales.set(pz, V); return V;
}
/* altura con la que un texto fijo entra entre las paredes de su celda (null si no está en una celda o ya entra) */
function alturaEnCelda(pz, e, txt){
  if(e[7]) return null;                                   // textos girados: se dejan como en la referencia
  const V = verticales(pz), x = e[4], y = e[5];
  const izq = V.filter(v=>v[0] < x - 0.3 && v[1] <= y && v[2] >= y).map(v=>v[0]);
  const der = V.filter(v=>v[0] > x + 0.3 && v[1] <= y && v[2] >= y).map(v=>v[0]);
  if(!izq.length || !der.length) return null;
  const L = Math.max(...izq), R = Math.min(...der), ha = e[9]||0;
  const disp = ha===1 ? 2*Math.min(x - L, R - x) - 1 : ha===2 ? x - L - 0.5 : R - x - 0.5;
  const largo = Math.max(...String(txt).split("\n").map(l=>l.length));
  const ancho = largo*e[6]*(e[11]||0.8)*0.95;
  if(disp <= 0 || ancho <= disp) return null;
  return Math.max(e[6]*0.6, e[6]*disp/ancho);
}

/* dibuja la pieza `nombre` con su ancla en (x, y), escala s.
   vars: valores de los marcadores; omitir: rectángulos (coordenadas de la pieza) cuyas primitivas no se dibujan;
   lineas: { clave: n } divide el valor en líneas de n caracteres (el valor también puede traer "\n") */
export function pieza(doc, kit, nombre, x, y, { s=1, vars={}, omitir=[], lineas={}, quitar=null, texto=null, mover=[], filtro=null }={}){
  const pz = kit.piezas[nombre]; if(!pz) return;
  for(const e0 of pz.e){
    let e = e0;
    if(filtro && !filtro(e)) continue;
    if(omitir.length){ const b = caja(e); if(omitir.some(r=>dentro(b, r))) continue; }
    // mover: las entidades dentro de un rectángulo de la pieza se desplazan (dx, dy) — p. ej. la leyenda de conexión
    const mv = mover.length ? mover.find(m=>dentro(caja(e), m.r)) : null;
    const X = v=>x+v*s+(mv ? mv.dx : 0), Y = v=>y+v*s+(mv ? mv.dy : 0);
    if(e[0]==="T"){
      // quitar: textos que no aplican (p. ej. referencias a hojas que no se generan); texto: transforma un texto fijo
      if(quitar && quitar.test(String(e[8]).trim())) continue;
      if(texto){ const t2 = texto(String(e[8]), e); if(t2==null || t2==="") continue; if(t2!==e[8]){ e = e.slice(); e[8] = t2; } }
    }
    const t = e[0], lay = e[1], o = { c: e[2], lt: e[3] };
    if(t==="L") doc.line(X(e[4]), Y(e[5]), X(e[6]), Y(e[7]), lay, o);
    else if(t==="C") doc.circle(X(e[4]), Y(e[5]), e[6]*s, lay, o);
    else if(t==="A") doc.arc(X(e[4]), Y(e[5]), e[6]*s, e[7], e[8], lay, o);
    else if(t==="P"){ const pts = []; for(let i=0;i<e[5].length;i+=2) pts.push([X(e[5][i]), Y(e[5][i+1])]); if(e[4]) pts.push(pts[0]); doc.polyline(pts, lay, o); }
    else if(t==="S") doc.solid([[X(e[4]),Y(e[5])],[X(e[6]),Y(e[7])],[X(e[8]),Y(e[9])],[X(e[10]),Y(e[11])]], lay, o);
    else if(t==="T"){
      let txt = String(e[8]); let clave = null;
      if(txt.includes("{")) txt = txt.replace(/\{(\w+)\}/g, (m,k)=>{ clave = k; const v = vars[k]; return v==null ? "" : String(v); });
      if(!txt.trim()) continue;
      let filas = txt.split("\n");
      if(clave && lineas[clave]) filas = filas.flatMap(f=>envolver(f, lineas[clave]));
      // leyendas: el texto se reduce si no entra en su celda
      const hc = /leyenda/.test(nombre) ? alturaEnCelda(pz, e, txt) : null;
      const h = (hc || e[6])*s, rot = e[7]||0, r = rot*Math.PI/180, paso = h*1.6667;
      // centrado vertical (73 = 2): el bloque de líneas queda centrado en el punto, no solo la primera línea
      const ini = (e[10]===2 && filas.length>1) ? -(filas.length-1)/2 : 0;
      filas.forEach((f, i)=>{
        if(!f.trim()) return;
        // cada línea adicional se desplaza «hacia abajo» del texto (perpendicular a su dirección)
        const k = i + ini, dx = Math.sin(r)*paso*k, dy = -Math.cos(r)*paso*k;
        doc.text(X(e[4])+dx, Y(e[5])+dy, h, f, lay, { rot, halign:e[9]||0, valign:e[10]||0, wf:e[11], c:e[2] });
      });
    }
  }
}

/* título del tablero en la esquina superior izquierda de su límite: recuadro (lados derecho e inferior) que crece con
   el nombre del tablero; si el nombre es largo se reparte en dos líneas. El texto nunca sale del recuadro. */
export function tituloTablero(doc, x, yTop, s, tit1, tit2){
  const h = 2.5, CAR = 0.8, maxW = 170;
  let l1 = envolver(String(tit1||""), Math.floor((maxW - 8)/(h*CAR)));
  if(l1.length === 1 && l1[0].length*h*CAR > 102) l1 = envolver(l1[0], Math.ceil(l1[0].length/2) + 2);
  const filas = [...l1, String(tit2||"")].filter(Boolean), paso = h*1.6667;
  const w = Math.max(110.08, Math.max(...filas.map(f=>f.length*h*CAR)) + 8), alto = Math.max(10.83, h + (filas.length - 1)*paso + 4.5);
  doc.polyline([[x, yTop - alto*s], [x + w*s, yTop - alto*s], [x + w*s, yTop]], "E-EQ");
  const yc = yTop - alto*s/2, y0 = yc + (filas.length - 1)*paso*s/2;
  filas.forEach((f, i)=>doc.text(x + w*s/2, y0 - i*paso*s, h*s, f, "G-TEX", { halign:1, valign:2 }));
  return { w: w*s, alto: alto*s };
}

/* recuadro de procedencia de una acometida («VIENE DEL TABLERO…»): rectángulo de 64,17 × 18,13 mm con el embudo que
   baja desde sus dos esquinas inferiores hasta la punta (yPunta), donde empieza el conductor. Es la forma de la
   acometida de 220 Vac del unifilar de control de referencia y se usa igual en todas las acometidas de los unifilares.
   El texto va centrado en el recuadro, en líneas de hasta n caracteres («\n» separa la procedencia de la tensión). */
export const ACOMETIDA = { x0:-32.22, x1:31.95, embudo:8, alto:18.13 };
export function cajaAcometida(doc, x, yPunta, s, texto, { n=26, h=2.5, capa="G-VARIOS" }={}){
  // el recuadro (y su embudo, como un solo bloque) crece con el texto: primero se ensancha para que entre en 3 líneas
  // como mucho; si aun así hacen falta más, crece en alto. El texto nunca sale del recuadro.
  const partes = String(texto||"").split("\n"), CAR = 0.8;
  let filas = partes.flatMap(f=>envolver(f, n)), nn = n;
  while(filas.length > 3 && nn < 44){ nn += 2; filas = partes.flatMap(f=>envolver(f, nn)); }
  const ht = h*s, paso = ht*1.6667;
  const anchoTxt = Math.max(...filas.map(f=>f.length*h*CAR));
  const w = Math.max(ACOMETIDA.x1 - ACOMETIDA.x0, anchoTxt + 6), alto = Math.max(ACOMETIDA.alto, h + (filas.length - 1)*h*1.6667 + 6);
  const xc = (ACOMETIDA.x0 + ACOMETIDA.x1)/2, x0 = xc - w/2, x1 = xc + w/2, embudo = ACOMETIDA.embudo*Math.max(1, Math.min(1.6, w/(ACOMETIDA.x1 - ACOMETIDA.x0)));
  const X = v=>x + v*s, yb = yPunta + embudo*s, yt = yb + alto*s;
  doc.polyline([[X(x0), yt], [X(x1), yt], [X(x1), yb], [X(x0), yb], [X(x0), yt]], capa);
  doc.polyline([[X(x0), yb], [x, yPunta], [X(x1), yb]], capa);
  const cx = X(xc), cy = (yb + yt)/2, y0 = cy + (filas.length - 1)*paso/2;
  filas.forEach((f, i)=>doc.text(cx, y0 - i*paso, ht, f, "G-TEX", { halign:1, valign:2 }));
  return { x0:X(x0), x1:X(x1), y0:yPunta, y1:yt };
}

/* caja de una pieza en coordenadas relativas a su ancla: [x0, y0, x1, y1] (para ubicar imágenes de equipos) */
const _cajas = new WeakMap();
export function cajaPieza(kit, nombre){
  const pz = kit.piezas[nombre]; if(!pz) return [0, 0, 0, 0];
  let m = _cajas.get(pz); if(m) return m;
  m = [Infinity, Infinity, -Infinity, -Infinity];
  for(const e of pz.e){ if(e[0]==="T") continue; const b = caja(e); if(!b) continue; m = [Math.min(m[0], b[0]), Math.min(m[1], b[1]), Math.max(m[2], b[2]), Math.max(m[3], b[3])]; }
  if(!isFinite(m[0])) m = [0, 0, 0, 0];
  _cajas.set(pz, m); return m;
}

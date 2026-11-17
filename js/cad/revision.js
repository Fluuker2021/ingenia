/* Ingenia — revisión de continuidad de los planos de conexionado (multifilar).
   Se corre sobre el DXF ya armado, así que revisa lo que realmente se dibuja:
   · conductores con un extremo suelto: el extremo de un conductor tiene que llegar a otro conductor, a un borne, a un
     símbolo, a la punta de una flecha o a un salto de cruce; si no toca nada, el circuito está abierto en el plano;
   · referencias cruzadas: cada flecha que sale de una hoja tiene que llegar a otra (y al revés); las que no tienen
     destino las registra el generador al escribir cada referencia (`sinDestino` en plano-multifilar-control.js).
   Devuelve una lista de observaciones con la hoja y la zona del marco (columna A-H, fila 1-5) para ubicarlas. */
import { parseDXF } from "../dxf.js";
import { PASO_HOJAS } from "./formato.js";
import { DXF_CAR } from "../engine/tablero-core.js";

// capas de conductores del plano de referencia (EPLAN): L/N/+24/0 V/PE/retornos/pantallas y cableado de campo
export const CAPAS_CONDUCTOR = /^(EPLAN54\d|EPLAN311)$/;

/* zona del marco A1 (columnas A-H de 100,75 mm desde x = 24; filas 1-5 de 113,8 mm desde y = 578,5) */
export function zonaMarco(x, y){
  const c = Math.max(0, Math.min(7, Math.floor((x - 24)/100.75))), f = Math.max(1, Math.min(5, 1 + Math.floor((578.5 - y)/113.8)));
  return "ABCDEFGH"[c] + ":" + f;
}

const CELDA = 6;
function rejilla(){
  const m = new Map();
  return {
    add(g, b, tol){ for(let i = Math.floor((b[0]-tol)/CELDA); i <= Math.floor((b[2]+tol)/CELDA); i++) for(let j = Math.floor((b[1]-tol)/CELDA); j <= Math.floor((b[3]+tol)/CELDA); j++){ const k = i+"|"+j; let a = m.get(k); if(!a) m.set(k, a = []); a.push(g); } },
    cerca(x, y){ return m.get(Math.floor(x/CELDA)+"|"+Math.floor(y/CELDA)) || []; },
  };
}
const dSeg = (px, py, x1, y1, x2, y2) => {
  const dx = x2-x1, dy = y2-y1, L2 = dx*dx + dy*dy;
  const t = L2 ? Math.max(0, Math.min(1, ((px-x1)*dx + (py-y1)*dy)/L2)) : 0;
  return Math.hypot(x1 + t*dx - px, y1 + t*dy - py);
};
const enArco = (a, a1, a2) => { if(Math.abs(a2 - a1) >= 359.9) return true; const n = v => ((v % 360) + 360) % 360; a = n(a); a1 = n(a1); a2 = n(a2); return a1 <= a2 ? a >= a1 && a <= a2 : a >= a1 || a <= a2; };
function dentroPoligono(px, py, pts){
  let d = false;
  for(let i = 0, j = pts.length-1; i < pts.length; j = i++){
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if((yi > py) !== (yj > py) && px < (xj - xi)*(py - yi)/(yj - yi) + xi) d = !d;
  }
  return d;
}
/* distancia de un punto a una geometría del plano (línea, círculo, arco o sólido) */
function distancia(g, x, y){
  if(g.t==="L") return dSeg(x, y, g.x1, g.y1, g.x2, g.y2);
  if(g.t==="C"){ const d = Math.hypot(x-g.cx, y-g.cy); return d <= g.r ? 0 : d - g.r; }
  if(g.t==="A"){
    const d = Math.hypot(x-g.cx, y-g.cy), a = Math.atan2(y-g.cy, x-g.cx)*180/Math.PI;
    if(enArco(a, g.a1, g.a2)) return Math.abs(d - g.r);
    const p1 = [g.cx + g.r*Math.cos(g.a1*Math.PI/180), g.cy + g.r*Math.sin(g.a1*Math.PI/180)], p2 = [g.cx + g.r*Math.cos(g.a2*Math.PI/180), g.cy + g.r*Math.sin(g.a2*Math.PI/180)];
    return Math.min(Math.hypot(x-p1[0], y-p1[1]), Math.hypot(x-p2[0], y-p2[1]));
  }
  if(g.t==="S"){
    const q = [g.pts[0], g.pts[1], g.pts[3], g.pts[2]];
    if(dentroPoligono(x, y, q)) return 0;
    let m = Infinity; for(let i = 0; i < 4; i++){ const a = q[i], b = q[(i+1)%4]; m = Math.min(m, dSeg(x, y, a[0], a[1], b[0], b[1])); }
    return m;
  }
  return Infinity;
}
function caja(g){
  if(g.t==="L") return [Math.min(g.x1, g.x2), Math.min(g.y1, g.y2), Math.max(g.x1, g.x2), Math.max(g.y1, g.y2)];
  if(g.t==="C" || g.t==="A") return [g.cx-g.r, g.cy-g.r, g.cx+g.r, g.cy+g.r];
  if(g.t==="S"){ const xs = g.pts.map(p=>p[0]), ys = g.pts.map(p=>p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
  return null;
}

/* conductores con extremos que no tocan nada. ents: entidades de parseDXF (o el texto DXF) */
export function extremosSueltos(ents, { capas = CAPAS_CONDUCTOR, tol = 0.35, paso = PASO_HOJAS } = {}){
  if(typeof ents === "string") ents = parseDXF(ents).entities;
  const R = rejilla(), cond = [];
  for(const g of ents){
    if(g.t==="P"){ // polilíneas: se separan en tramos
      for(let i = 0; i < g.pts.length-1 + (g.closed ? 1 : 0); i++){ const a = g.pts[i], b = g.pts[(i+1) % g.pts.length]; const l = { t:"L", layer:g.layer, x1:a[0], y1:a[1], x2:b[0], y2:b[1] }; R.add(l, caja(l), tol); if(capas.test(g.layer||"")) cond.push(l); }
      continue;
    }
    const b = caja(g); if(!b) continue;
    R.add(g, b, tol);
    if(g.t==="L" && capas.test(g.layer||"") && Math.hypot(g.x2-g.x1, g.y2-g.y1) > 0.05) cond.push(g);
  }
  const out = [], vistos = new Set();
  const tocaSolido = (x, y) => R.cerca(x, y).some(g=>g.t==="S" && distancia(g, x, y) <= tol);
  const toca = (c, x, y) => R.cerca(x, y).some(g=>g!==c && distancia(g, x, y) <= tol);
  for(const c of cond){
    const largo = Math.hypot(c.x2-c.x1, c.y2-c.y1);
    // muestra de línea de una leyenda («Barra Cu», «Cableado en campo»): tramo corto aislado, sin nada en sus extremos
    if(largo <= 25 && !toca(c, c.x1, c.y1) && !toca(c, c.x2, c.y2)) continue;
    for(const [x, y, ox, oy] of [[c.x1, c.y1, c.x2, c.y2], [c.x2, c.y2, c.x1, c.y1]]){
      if(toca(c, x, y)) continue;
      // cola de una flecha de referencia: el tramo corto que sale de la punta rellena (la etiqueta va a continuación)
      if(largo <= 6 && tocaSolido(ox, oy)) continue;
      const hoja = Math.floor((x + 50)/paso), k = `${hoja}|${Math.round(x*2)}|${Math.round(y*2)}`;
      if(vistos.has(k)) continue; vistos.add(k);
      out.push({ hoja: hoja + 1, zona: zonaMarco(x - hoja*paso, y), x: +(x - hoja*paso).toFixed(2), y: +y.toFixed(2), capa: c.layer });
    }
  }
  return out;
}

/* Derivaciones en «T» del plano de referencia: el conductor que baja de una barra lleva una diagonal corta a 45° (EPLAN)
   que apunta a la barra. En la última derivación la barra termina en el conductor y la diagonal queda en el aire: se
   quita (la unión es una esquina). Trabaja sobre las entidades del DXFDoc antes de escribirlo. */
export function quitarDiagonalesSueltas(doc, { capa = "EPLAN311", tol = 0.35 } = {}){
  const num = (e, c) => { const m = e.match(new RegExp("\\n"+c+"\\n(-?[\\d.eE+-]+)")); return m ? +m[1] : NaN; };
  const capaDe = e => (e.match(/\n8\n([^\n]*)/)||[])[1];
  const R = rejilla(), geo = [];
  doc.entities.forEach((e, i)=>{
    let g = null;
    if(e.startsWith("0\nLINE\n")) g = { t:"L", x1:num(e,10), y1:num(e,20), x2:num(e,11), y2:num(e,21) };
    else if(e.startsWith("0\nCIRCLE\n")) g = { t:"C", cx:num(e,10), cy:num(e,20), r:num(e,40) };
    else if(e.startsWith("0\nARC\n")) g = { t:"A", cx:num(e,10), cy:num(e,20), r:num(e,40), a1:num(e,50), a2:num(e,51) };
    else if(e.startsWith("0\nSOLID\n")) g = { t:"S", pts:[0, 1, 2, 3].map(k=>[num(e,10+k), num(e,20+k)]) };
    if(!g) return;
    g.i = i; geo[i] = g; R.add(g, caja(g), tol);
  });
  const quitar = new Set();
  for(const g of geo){
    if(!g || g.t!=="L" || capaDe(doc.entities[g.i])!==capa) continue;
    const dx = Math.abs(g.x2-g.x1), dy = Math.abs(g.y2-g.y1);
    if(dx < 1 || Math.abs(dx - dy) > 0.05 || dx > 6) continue;           // solo las diagonales cortas a 45°
    const suelto = ([x, y]) => !R.cerca(x, y).some(h=>h!==g && !quitar.has(h.i) && distancia(h, x, y) <= tol);
    if(suelto([g.x1, g.y1]) || suelto([g.x2, g.y2])) quitar.add(g.i);
  }
  if(quitar.size) doc.entities = doc.entities.filter((e, i)=>!quitar.has(i));
  return quitar.size;
}

/* ---------- centrado del dibujo de una hoja ----------
   Las entidades del DXFDoc son textos «código\nvalor»; se recorren por pares (nunca con una expresión regular sobre
   todo el texto: un TEXT cuyo contenido es «10» se confundiría con un código). */
const pares = e => { const a = e.split("\n"), o = []; for(let i = 0; i+1 < a.length; i += 2) o.push([a[i], a[i+1]]); return o; };
/* caja [x0, y0, x1, y1] de una entidad (los textos con su largo aproximado, según alineación y giro) */
export function cajaEntidad(e){
  const g = {}; let tipo = "";
  for(const [c, v] of pares(e)){ if(c==="0") tipo = v; else if(g[c]==null) g[c] = v; }
  const n = c => g[c]==null ? NaN : +g[c];
  if(tipo==="LINE") return [Math.min(n(10), n(11)), Math.min(n(20), n(21)), Math.max(n(10), n(11)), Math.max(n(20), n(21))];
  if(tipo==="CIRCLE" || tipo==="ARC") return [n(10)-n(40), n(20)-n(40), n(10)+n(40), n(20)+n(40)];
  if(tipo==="SOLID"){ const xs = [10, 11, 12, 13].map(n).filter(isFinite), ys = [20, 21, 22, 23].map(n).filter(isFinite); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
  if(tipo==="TEXT"){
    const h = n(40), w = String(g[1]||"").length*h*DXF_CAR*(isFinite(n(41)) ? n(41)/0.8 : 1), ha = +(g[72]||0), va = +(g[73]||0);
    const x = ha && isFinite(n(11)) ? n(11) : n(10), y = (ha || va) && isFinite(n(21)) ? n(21) : n(20), r = (n(50)||0)*Math.PI/180, ca = Math.cos(r), sa = Math.sin(r);
    const ox = [0, -w/2, -w, 0, -w/2, 0][ha]||0, oy = [0, 0, -h/2, -h][va]||0;
    const pts = [[ox, oy], [ox+w, oy], [ox, oy+h], [ox+w, oy+h]].map(([a, b])=>[x + a*ca - b*sa, y + a*sa + b*ca]);
    return [Math.min(...pts.map(p=>p[0])), Math.min(...pts.map(p=>p[1])), Math.max(...pts.map(p=>p[0])), Math.max(...pts.map(p=>p[1]))];
  }
  if(tipo==="INSERT") return [n(10), n(20), n(10), n(20)];
  return null;
}
/* desplaza en x (códigos 10…13) las entidades de la lista */
export function moverX(ents, dx){
  if(!dx) return ents;
  const f = v => (Math.round(v*1000)/1000).toString();
  return ents.map(e=>pares(e).map(([c, v])=>c==="10" || c==="11" || c==="12" || c==="13" ? c+"\n"+f(+v + dx) : c+"\n"+v).join("\n"));
}
/* desplazamiento horizontal que centra el dibujo de una hoja en el marco (x 27…829 de la lámina) sin invadir el bloque de
   rótulo y del bloque de aprobación del cajetín (x ≥ 684 por debajo de y = 105,5: el recuadro «HOJA n DE m» llega a y ≈ 105). ox: origen de la lámina en el espacio modelo. */
export function centradoHoja(ents, ox, { x0 = 27, x1 = 829, xCaj = 684, yCaj = 105.5, min = 2, excluir = null } = {}){
  // a, b: caja del dibujo que se centra; ta, tb: caja de todo (incluye leyendas y divisorias) para no salir del marco
  let a = Infinity, b = -Infinity, ta = Infinity, tb = -Infinity, bajo = -Infinity;
  ents.forEach((e, i)=>{
    const k = cajaEntidad(e); if(!k || !k.every(isFinite)) return;
    ta = Math.min(ta, k[0]); tb = Math.max(tb, k[2]);
    if(k[1] < yCaj) bajo = Math.max(bajo, k[2]);
    if(excluir && excluir.has(i)) return;
    a = Math.min(a, k[0]); b = Math.max(b, k[2]);
  });
  if(!isFinite(a)){ a = ta; b = tb; }
  if(!isFinite(a)) return 0;
  a -= ox; b -= ox; bajo -= ox; ta -= ox; tb -= ox;
  let dx = (x0 + x1)/2 - (a + b)/2;
  dx = Math.min(dx, x1 - Math.max(b, tb), isFinite(bajo) ? xCaj - 2 - bajo : Infinity);    // no pasar el marco ni el cajetín…
  dx = Math.max(dx, x0 - Math.min(a, ta));                                                 // …ni el borde izquierdo
  return Math.abs(dx) < min ? 0 : Math.round(dx*100)/100;
}

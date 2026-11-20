/* Ingenia — DIAGRAMA UNIFILAR DEL TABLERO DE FUERZA armado con las piezas del unifilar de referencia del
   usuario (assets/plantillas/planos/unifilar.json): acometida con sus accesorios, barra principal, una columna
   por circuito (variador, guardamotor + contactor, arrancador suave, alimentador) y los transformadores de
   control con su barra secundaria y derivaciones, la barra de tierra y la leyenda. Las columnas se reparten
   en el ancho del tablero para que el plano quede ordenado y proporcionado a la lámina; si no entran, se
   reduce la escala y, si aun así no entran, el tablero continúa en otra lámina. */
import { modeloCorto, modeloEnMarca, marcasProyecto } from "../engine/marcas.js";
import { DXFDoc } from "../engine/tablero-core.js";
import { dibujarLamina, PASO_HOJAS, notasLamina } from "./formato.js";
import { calcularTablero, calcularTodos, tf, desdeTxt, r2, datos, accesoriosTablero, fusiblesAcometida, distribucionPrincipal } from "../datos.js";
import { valoresDiseno } from "../modules/criterios.js";
import { cargarKit, usarKit, pieza, envolver, cajaAcometida, encajar, tituloTablero } from "./kit.js";
import { unifilarControlKit } from "./plano-unifilar-control.js";

// geometría del plano de referencia (mm, espacio modelo)
const BUS = 517.4, EJE0 = 71.8, ANCHO_COL = 58.2, PASO_RAMA = 45, SUB = 415.3 - BUS;
const TIERRA = 339.3 - BUS, FONDO = 311.5 - BUS, TECHO = 631.8 - BUS, IZQ = 10.8, DER = 637.8, X_ACOM = 325, X_RETORNO = 590.4;
const LIM_IZQ = EJE0 - ANCHO_COL/2, LIM_DER = 627.8;
// referencia → lámina: x + 25, y − 125 (el diagrama queda dentro del área útil A1 de 806 × 533 mm)
const DX = 25, DY = -125, PIE = 52;   // PIE: borde inferior útil de la lámina para las descripciones

const awg = s => String(s||"").replace(/\s+/g,"").replace(/AWG/i,"AWG");
const cableTxt = c => { const m = c.conductorMemo; if(!m || !m.cable) return ""; return `1-3C#${awg(m.cable[0])}+${m.egc ? awg(m.egc[1]) : awg(m.cable[0])}(T) 0.6/1kV`; };
// modelo corto para el plano (sin marca ni notas; se conserva la corriente entre paréntesis de los equivalentes)
const sinMarca = s => { const c = modeloCorto(s); return /\(\d/.test(c) ? c.replace(/\s*\+.*$/,"") : c.replace(/\s*\(.*$/,""); };
const item = (c, re) => c.items.find(x=>re.test(x.comp)) || {};
const esMcb = q => !!(q && (q.mcb || /\bS20\d|MCB/.test(q.model||"")));
const BARRAS = [[325,"20x5"],[450,"30x5"],[560,"40x5"],[690,"50x5"],[790,"60x5"],[1030,"80x5"],[1250,"100x5"],[2200,"2x100x5"]];
const barraCu = a => { const b = (BARRAS.find(([i])=>i>=a)||BARRAS[BARRAS.length-1])[1]; return `3xB.Cu ${b} mm + 1xB.Cu 20x3 mm(T)`; };

/* cargas que se conectan DENTRO del tablero (el límite del tablero las encierra): servicios del tablero (ventiladores,
   calefacción, luminaria, tomacorriente), control interno, PLC, la etapa de control de un tablero de fuerza y control y
   las reservas. Las demás (motores, instrumentación de campo, controladores externos, otros tableros…) van fuera. */
const SERVICIOS = /^(ventilacion|calefaccion|luminaria|tomacorriente)$/, APLIC_SERV = new Set(["ventiladores","calefaccion","luminaria","tomacorriente"]);
export function claseDerivacion(p, t, cfg, texto){
  if(cfg && SERVICIOS.test(cfg)) return { interno:true };
  if(cfg && /^tca?:/.test(cfg)) return t && cfg==="tc:"+t.id ? { interno:true } : { tablero:true };
  if(cfg && /^lt:/.test(cfg)){
    const r = (datos(p).cargasTrafo||[]).find(x=>"lt:"+x.id===cfg); if(!r) return {};
    if(r.tipo==="tablero") return { tablero:true };
    if(r.tipo==="control" || r.tipo==="plc" || r.tipo==="reserva") return { interno:true };
    if(r.tipo==="general" && APLIC_SERV.has(r.application)) return { interno:true };
    return {};
  }
  if(/^reserva$/i.test(String(texto||"").trim())) return { interno:true };
  if(!cfg && /\b(plc|control|ventila|lumin|tomacorr|calefac)/i.test(texto||"")) return { interno:true };
  return {};
}

/* una columna (o grupo) por circuito del tablero */
function columnas(calc, p){
  let nMotor = 0;
  const tab = calc.tablero;
  // protección diferencial propia de una carga (relé con toroide en su salida)
  return calc.circuits.map(c=>{ const col = columna(c); if(col && col.tipo!=="trafo" && c.diferencial) Object.assign(col, { dif: c.diferencial }); return col; });
  function columna(c){
    const l = c.load || {}, cable = cableTxt(c);
    const desc = (l.desc || c.descLabel || c.title || "").toUpperCase(), tag = l.tag || "";
    if(c.kind==="control"){
      // control interno: portafusibles → transformador → interruptor general de control → barra → derivaciones
      // (o, con la segunda fuente, la acometida externa directo al interruptor general)
      const f = item(c, /^Portafusible/), t = item(c, /^Transformador|^Fuente/), q = item(c, /^ITM principal/);
      const ramas = c.items.filter(x=>x.rama || /^QC\d+\./.test(x.devtag||"")).map((x,i)=>{
        const qv = String(x.val||"").split(" · ")[0], a = parseFloat(qv.replace(/^2x/i,"")) || 0, awgN = a > 15 ? 12 : 14;
        const cable = x.cable || `2C#${awgN}AWG+${awgN}AWG(T)`;
        return Object.assign({ tipo: (x.id || (x.id==null && !x.rama && /tomacorriente/i.test(x.comp))) ? "rama_id" : "rama", externo: /^tca?:/.test(x.cfg||"") }, claseDerivacion(p, tab, x.cfg, x.destino || x.comp), {
          vars:{ circ:"C"+(i+1), q:x.devtag, qv: qv.toUpperCase(), desc: String(x.destino || x.comp || "").toUpperCase(),
            cable: `${/^tca?:/.test(x.cfg||"") ? "1-" : ""}${cable} 0.6/1kV`, id: x.id || "ID"+(i+1), idv:"2x25A", idm:"30mA" } });
      });
      ramas.forEach(r=>{ if(/^RESERVA$/.test(r.vars.desc)){ r.reserva = true; r.interno = false; } });
      if(!ramas.length) ramas.push({ tipo:"rama", reserva:true, vars:{ circ:"C1", q:"", qv:"", desc:"RESERVA", cable:"" } });
      const va = (String(t.val||"").match(/^[\d.]+\s*k?VA/i)||[""])[0].replace(/\s+/g,"");
      const fs = f.devtags || (f.devtag ? [f.devtag] : []);
      return { tipo:"trafo", n: ramas.length, ramas, externa: !!c.externa, ctrlV: c.ctrlV, ctrlTipo: c.ctrlTipo, desde: (c.load||{}).externaDesde || "",
        vars:{ circ:c.tag, f: fs.join("/"), fv: f.val ? f.val : "", fm:"E91/32", t:t.devtag||"", tv:va, tm:String(t.model||"").replace(/\s+Vac\+T$/i, "VAC+T").replace(/\s+/g,""), q:q.devtag||"", qv:q.val||"" } };
    }
    if(c.kind==="motor"){
      nMotor++;
      const motor = { m:"M"+nMotor, hp: `${l.power}${l.powerUnit==="hp" ? "HP" : "kW"}`, amp: r2(c.installedCurrent,1)+"A", desc, tag, cable, circ:c.tag };
      if(l.starter==="vfd"){
        const q = item(c, /^ITM/), f = item(c, /^Portafusible/), rl = item(c, /^Filtro de l[ií]nea/), v = item(c, /^Variador/);
        return { tipo:"col_vfd", mcb: esMcb(q), omitir: rl.devtag ? [] : ["filtro"], vars: Object.assign(motor, { q:q.devtag, qv:q.val, f:f.devtag, fv: f.val ? "3x"+f.val : "", rl:rl.devtag, rlv:rl.val, vfd:v.devtag, vfdtxt:"VFD", vfdv:v.val }) };
      }
      if(l.starter==="ss"){
        const q = item(c, /^ITM/), f = item(c, /^Portafusible/), a = item(c, /^Arrancador suave/);
        return { tipo:"col_vfd", mcb: esMcb(q), omitir:["filtro"], vars: Object.assign(motor, { q:q.devtag, qv:q.val, f:f.devtag, fv: f.val ? "3x"+f.val : "", vfd:a.devtag, vfdtxt:"AS", vfdv:a.val }) };
      }
      const q = item(c, /^Guardamotor|^ITM/), k = item(c, /^Contactor/);
      return { tipo:"col_mcp", vars: Object.assign(motor, { q:q.devtag, qv:q.val, k:k.devtag, km:sinMarca(k.model), kv:k.val }) };
    }
    // alimentador o carga general: interruptor, cable y la carga; reserva: solo el interruptor
    const q = item(c, /^ITM/);
    // reserva: solo el interruptor (sin conductor de salida ni carga); «RESERVA» bajo el interruptor, dentro del tablero
    if(c.esReserva) return { tipo:"col_vfd", reserva:true, mcb: esMcb(q), omitir:["fusible","filtro","vfd","motor"], vars:{ circ:c.tag, q:q.devtag, qv:q.val, cable:"", desc:"RESERVA", tag:"" } };
    // alimentador a otro tablero: termina en el símbolo de tablero con «HACIA EL TABLERO …»
    if(l.kind==="feeder"){
      const h = l._tablero, nom = h ? `HACIA EL ${(h.nombre||"tablero").toUpperCase()} ${h.tag||""}`.trim() : `HACIA EL ${desc || "TABLERO"}${tag ? " "+tag : ""}`.replace(/^HACIA EL HACIA EL/, "HACIA EL");
      return { tipo:"col_vfd", tablero:true, mcb: esMcb(q), omitir:["fusible","filtro","vfd","motor"], vars:{ circ:c.tag, q:q.devtag, qv:q.val, cable, desc:nom, tag:`${r2(c.installedCurrent,1)} A` } };
    }
    return { tipo:"col_vfd", mcb: esMcb(q), omitir:["fusible","filtro","vfd","motor"], vars:{ circ:c.tag, q:q.devtag, qv:q.val, cable, desc, tag: tag ? `${tag} · ${r2(c.installedCurrent,1)} A` : `${r2(c.installedCurrent,1)} A` } };
  }
}
// cada circuito ocupa una «vertical» de ancho ANCHO_COL y el control interno una por derivación: todas las verticales de
// carga quedan a la misma distancia (simetría)
const verticales = col => col.tipo==="trafo" ? col.n : 1;
const ancho = col => verticales(col)*ANCHO_COL;
// zonas de la columna del variador que se omiten según el arranque (coordenadas relativas a su ancla)
const OMITIR = { fusible:[-4,-62.7,16,-48.5], filtro:[-22,-114.3,12,-85.9], vfd:[-9,-134,21,-117.7], motor:[-6.5,-284,17,-267.6] };
const PUENTES = { fusible:[-48.6,-62.6], filtro:[-86,-106], vfd:[-117.8,-133.8], motor:null };

/* reparte las columnas en láminas de forma equilibrada: primero cuántas láminas hacen falta (cada una admite el
   ancho útil con escala ≥ 0,75; la primera reserva el hueco de la acometida) y luego se reparten los circuitos
   para que todas las láminas queden con un ancho parecido (sin una última lámina casi vacía) */
export function repartirEquilibrado(items, anchoDe, capacidad, extraPrimera=0){
  const total = items.reduce((a, c)=>a + anchoDe(c), 0) + extraPrimera;
  let n = 1, w = extraPrimera;
  for(const c of items){ const a = anchoDe(c); if(w > extraPrimera*(n===1) && w + a > capacidad){ n++; w = 0; } w += a; }
  if(n===1) return [items.slice()];
  const meta = total/n, hojas = [[]]; w = extraPrimera;
  items.forEach((c, i)=>{
    const a = anchoDe(c), quedan = items.length - i, hojasRestantes = n - hojas.length;
    if(hojas[hojas.length-1].length && hojasRestantes > 0 && (w + a/2 > meta || w + a > capacidad || quedan <= hojasRestantes)){ hojas.push([]); w = 0; }
    hojas[hojas.length-1].push(c); w += a;
  });
  return hojas;
}
const FMAX = 1.5;       // separación máxima entre circuitos cuando sobra espacio (×)
function repartir(cols){ return repartirEquilibrado(cols, ancho, (LIM_DER - LIM_IZQ)/0.75, 0); }

export async function unifilarKit({ p, valsDe, cliente, id }){
  const kit = await cargarKit("unifilar");
  const calcs = calcularTodos(p);
  const lista = calcs.length ? calcs : [calcularTablero(p, tf(p))];
  const v = valoresDiseno(p);
  const doc = new DXFDoc(); usarKit(doc, kit);
  // el control interno con segunda fuente no cuelga de la barra principal: va al final, a la derecha
  const planes = lista.map(calc=>{ const cols = columnas(calc, p); return { calc, hojas: repartir([...cols.filter(c=>!c.externa), ...cols.filter(c=>c.externa)]) }; });
  const totalFuerza = planes.reduce((a,x)=>a+x.hojas.length, 0);
  // tablero de fuerza y control: un solo unifilar; su etapa de control sigue a las hojas de fuerza
  const tfcs = lista.map(c=>c.tablero).filter(t=>t && t.tipo==="fuerzacontrol");
  const ctl = tfcs.length ? await unifilarControlKit({ p, cliente, id, tableros:tfcs, k0:totalFuerza, etapa:true,
    valsDe:(i, tot, o)=>valsDe(totalFuerza + i, totalFuerza + tot, o) }) : null;
  const total = totalFuerza + (ctl ? ctl.hojas : 0);
  let k = 0;
  for(const { calc, hojas } of planes){
    const t = calc.tablero, g = calc.g;
    hojas.forEach((cols, ih)=>{
      const ox = k*PASO_HOJAS;
      dibujarLamina(doc, ox, 0, valsDe(k, total, { TITULO2: `${(t.nombre||"").toUpperCase()} ${t.tag}${hojas.length>1 ? ` (${ih+1} DE ${hojas.length})` : ""}` }), cliente);
      const r = dibujarHoja(doc, kit, ox, { p, calc, t, g, v, cols, primera: ih===0, ih, nh: hojas.length });
      // notas del usuario (primera lámina): en la zona libre que deja la composición (debajo de la leyenda), sobre el cajetín
      if(k===0) notasLamina(doc, ox, 0, datos(p).notas[id || "ele-unifilar"], r && r.notas ? r.notas : { y1: 236 });
      k++;
    });
  }
  doc.limpiarUniones(); doc.centrarEnSimbolos(); if(ctl) doc.absorber(ctl.doc);
  return { dxf: doc.toDXF(), hojas: total, calc: lista[0] };
}

/* ---------------- textos sin cruces ----------------
   Ancho de un texto en AutoCAD (txt.shx con factor 0,8): ≈ 0,8 × altura por carácter (con margen). Los textos que no
   entran en su espacio se reparten en 2 o 3 líneas (por palabras; si una palabra no entra, después de «+»). */
const CAR = 0.8;
const anchoTxt = (t, h) => String(t||"").length*h*CAR;
function lineasDe(txt, n){
  const out = [];
  // si no entra en una línea y tiene « + », se corta ahí (p. ej. «3xB.Cu 20x5 mm +» / «1xB.Cu 20x3 mm(T)»)
  const partes = String(txt||"").split("\n").flatMap(pt=>{
    if(pt.length <= n || !pt.includes(" + ")) return [pt];
    const k = pt.indexOf(" + "), a = pt.slice(0, k + 2), b = pt.slice(k + 3);
    return a.length <= n && b.length <= n ? [a, b] : [pt];
  });
  for(const parte of partes){
    const toks = [];
    for(const w of parte.split(/\s+/).filter(Boolean)){
      if(w.length <= n){ toks.push([w, " "]); continue; }
      w.split(/(?<=\+)/).forEach((q, i)=>toks.push([q, i ? "" : " "]));
    }
    let cur = "";
    for(const [w, sep] of toks){ const cand = cur ? cur + sep + w : w; if(cand.length > n && cur){ out.push(cur); cur = w; } else cur = cand; }
    if(cur) out.push(cur);
  }
  return out;
}
/* texto en un largo L (mm) y hasta maxLineas: altura reducida (hasta hMin) si aun así no entra */
export function ajustarLineas(txt, L, h0, maxLineas=2, hMin=h0*0.6){
  let h = h0, ls;
  for(;;){ const n = Math.max(4, Math.floor(L/(h*CAR))); ls = lineasDe(txt, n); if((ls.length <= maxLineas && ls.every(l=>l.length <= n)) || h <= hMin) break; h = Math.max(hMin, h*0.92); }
  return { lineas: ls, h, paso: h*1.6667 };
}
/* texto vertical (girado 90°) a la izquierda de un conductor en x: termina en yTop y baja como mucho L; con varias
   líneas, la última queda junto al conductor (a 4,9 mm) y las anteriores más a la izquierda */
export function textoVertical(doc, x, yTop, L, txt, s, { maxLineas=2, capa="G-TEX", sep=4.9 }={}){
  if(!txt) return null;
  const r = ajustarLineas(txt, L, 2.5*s, maxLineas);
  r.lineas.forEach((l, i)=>doc.text(x - sep*s - (r.lineas.length - 1 - i)*r.paso, yTop, r.h, l, capa, { rot:90, halign:2 }));
  return r;
}
/* texto horizontal de varias líneas que entra en el ancho W: desde (x, yTop) hacia abajo; ha 0 izquierda, 1 centro */
function textoBloque(doc, x, yTop, W, txt, h0, { maxLineas=3, ha=0, capa="G-TEX" }={}){
  const r = ajustarLineas(txt, W, h0, maxLineas);
  r.lineas.forEach((l, i)=>doc.text(x, yTop - r.h - i*r.paso, r.h, l, capa, ha ? { halign:ha } : {}));
  r.ancho = Math.max(0, ...r.lineas.map(l=>anchoTxt(l, r.h))); r.alto = r.h + (r.lineas.length - 1)*r.paso;
  return r;
}

/* descripción de la carga bajo el motor o la flecha: texto vertical que termina en yIni y baja hacia el pie de
   la lámina; si no entra, se corta en varias líneas centradas en el eje del circuito. medir: solo calcula (sin dibujar).
   Devuelve el punto más bajo del texto. */
function descripcion(doc, x, yIni, textos, s, anchoDisp, medir=false){
  const h = 2.5*s, ls = h*1.6667, n = Math.max(6, Math.floor((yIni - PIE)/(h*CAR)));
  let lineas = textos.filter(Boolean).flatMap(t=>envolver(t, n));
  const max = Math.max(1, Math.floor((anchoDisp*0.7)/ls)); lineas = lineas.slice(0, max);
  if(!medir) lineas.forEach((ln, i)=>doc.text(x + (i - (lineas.length-1)/2)*ls, yIni, h, ln, "G-TEX", { rot:90, halign:2, valign:2 }));
  return yIni - Math.max(0, ...lineas.map(l=>anchoTxt(l, h)));
}
/* símbolo de tablero (carga que es otro tablero): flecha en el conductor, rectángulo con su mitad superior izquierda
   rellena y, debajo, «HACIA EL TABLERO …» en líneas horizontales centradas. Devuelve el punto más bajo. */
function simboloTablero(doc, x, yTop, s, texto, anchoDisp, { flecha=true, capaFlecha="E-FZA-BT-PRI", medir=false }={}){
  const w = 18*s, h = 8.8*s, xl = x - w/2, xr = x + w/2, yb = yTop - h;
  const r = ajustarLineas(texto, Math.min(anchoDisp*0.92, 60*s), 2.5*s, 4);
  const yTxt = yb - 4*s, fondo = yTxt - r.h - (r.lineas.length - 1)*r.paso;
  if(medir) return fondo;
  if(flecha) doc.solid([[x - 0.55*s, yTop + 3.5*s], [x + 0.55*s, yTop + 3.5*s], [x, yTop], [x, yTop]], capaFlecha);
  doc.polyline([[xl, yTop], [xr, yTop], [xr, yb], [xl, yb], [xl, yTop]], "E-SIM");
  doc.solid([[xl, yTop], [xr, yTop], [xl, yb], [xl, yb]], "E-SIM");
  r.lineas.forEach((l, i)=>doc.text(x, yTxt - r.h - i*r.paso, r.h, l, "G-TEX", { halign:1 }));
  return fondo;
}

/* ---------------- lámina del unifilar ----------------
   1) se ubican las verticales (circuitos y derivaciones del control interno) en el ancho útil;
   2) se miden la acometida, sus accesorios, el retorno a tierra y las cargas, y se arma el límite del tablero: arriba y a
      los lados encierra todo; abajo pasa entre la barra de tierra y los textos de cable de las cargas de fuera, y baja
      (muesca) alrededor de las cargas que se conectan dentro del tablero, sin cortar ningún dibujo;
   3) composición: tablero y leyenda lado a lado con márgenes iguales (si el tablero deja libre su zona superior
      izquierda y la leyenda entra ahí, va ahí); si no entran, se reduce la escala de las verticales;
   4) se dibuja. Devuelve la zona libre para las notas. */
const U0 = 2, U1 = 804;                     // ancho útil de la lámina en coordenadas de la referencia
const ANCHO_LEY = 138.33;                   // ancho de la leyenda (columnas ítem · símbolo · descripción)
function dibujarHoja(doc, kit, ox, { p, calc, t, g, v, cols, primera, ih, nh }){
  const accT = accesoriosTablero(p, t), acc = primera ? accT : {};
  const dist = distribucionPrincipal(calc);
  const nLey = (()=>{ const u = usadosDe(cols, acc, primera); return LEY_ORDEN.filter(([k])=>u.has(k)).length; })();
  const altoLey = -LEY_Y0 + nLey*LEY_FILA;

  // ---- 1-3) geometría con el ancho útil de las verticales; si la composición no entra, se achica y se repite
  let util = LIM_DER - LIM_IZQ, G = null;
  for(let it = 0; it < 8; it++){
    G = geometria(cols, { util, primera, acc, calc, ih, nh });
    const ancho = G.der - G.izq;
    const libre = (U1 - U0) - ancho - ANCHO_LEY;
    // leyenda dentro del tablero: zona libre arriba a la izquierda (sobre la barra, a la izquierda de la acometida)
    G.leyDentro = null;
    if(G.zonaLibre){ const z = G.zonaLibre, k = Math.min(1, z.w/ANCHO_LEY, z.h/altoLey); if(k >= 0.85) G.leyDentro = { k, x: z.x0 + (z.w - ANCHO_LEY*k)/2, y: z.y1 - (z.h - altoLey*k)/2 }; }
    if(G.leyDentro || libre >= 3*8) break;
    util = Math.max(120, util - (3*8 - libre) - 4);
  }
  // márgenes iguales a la izquierda, entre el tablero y la leyenda y a la derecha
  const anchoTab = G.der - G.izq;
  let dxP, leyX = null, leyY = null, leyK = 1;
  if(G.leyDentro){ dxP = U0 + ((U1 - U0) - anchoTab)/2 - G.izq; }
  else { const gap = Math.max(8, ((U1 - U0) - anchoTab - ANCHO_LEY)/3); dxP = U0 + gap - G.izq; leyX = G.der + dxP + gap; }

  const s = G.s, P = G.P;
  const FX = x => ox + DX + dxP + x, FY = y => DY + y;                // coordenadas de la referencia (escala 1)
  const SY = y => DY + BUS + y*s;                                      // y relativo a la barra, con la escala
  const usados = usadosDe(cols, acc, primera);

  // ---- límite del tablero: arriba, lados y fondo con muescas (polilínea cerrada)
  const yTop = FY(BUS+TECHO);
  const perfil = G.perfil.map(([xa, xb, y])=>[FX(xa), FX(xb), y]);
  const pts = [[FX(G.izqTab), yTop], [FX(G.derTab), yTop]];
  for(let i = perfil.length - 1; i >= 0; i--){ const [xa, xb, y] = perfil[i]; pts.push([xb, y], [xa, y]); }
  pts.push([FX(G.izqTab), yTop]);
  const lim = []; for(const q of pts){ const u = lim[lim.length-1]; if(!u || Math.abs(u[0]-q[0]) > 0.01 || Math.abs(u[1]-q[1]) > 0.01) lim.push(q); }
  doc.polyline(lim, "E-EQ");
  tituloTablero(doc, FX(G.izqTab), yTop, 1, `${t.nombre||"Tablero"} ${t.tag||""}`.toUpperCase(), `${g.voltage} Vac, 3F+T, ${g.freq}Hz`);
  pieza(doc, kit, "pimd", FX(G.derTab), yTop, { vars:{ pi:`PI: ${r2(calc.installedKVA,1)} kVA`, md:`MD: ${r2(calc.totalKVA,2)} kVA` } });

  // ---- barra (o cable) principal y su rotulado: a un lado de la acometida, donde entre sin cruzar su bajada
  const xIni = G.xIni, xFin = G.xFin, xAcom = G.xAcom;
  if(isFinite(xIni) && isFinite(xFin)){
    doc.line(FX(xIni), SY(0), FX(xFin), SY(0), "E-FZA-BT-PRI");
    const hb = 2.5*s, rot1 = `R,S,T ${g.voltage} Vac, 3F, ${g.freq}Hz, ${g.faultLevel} kA`, rot2 = dist.barras ? barraCu(calc.mainBreaker) : dist.texto;
    const L = G.rotulo;
    const r = ajustarLineas(`${rot1}\n${rot2}`, L.w, hb, 3);
    r.lineas.forEach((l, i)=>doc.text(FX(L.x), SY(0) + 2.4*s + (r.lineas.length - 1 - i)*r.paso, r.h, l, "G-TEX"));
    if(!primera) doc.text(FX(xIni)-2, SY(0)+3*s, 2.2*s, `VIENE DE LA HOJA ${ih}`, "G-TEX", { halign:2 });
    // sobre el final de la barra (a la derecha están el retorno a tierra y el límite del tablero)
    if(ih < nh-1) doc.text(FX(xFin) - 2*s, SY(0) + 3*s, 2.2*s, `CONTINÚA EN LA HOJA ${ih+2}`, "G-TEX", { halign:2 });
  }

  // ---- acometida y accesorios (primera lámina del tablero)
  if(primera){
    const ax = FX(xAcom), ay = SY(0);
    usados.add("mccb3");
    pieza(doc, kit, "acometida", ax, ay, { s, omitir:[[-35, 143, 33, 172]], vars:{ q:"Q1", qv:`3x${calc.mainBreaker}A`, barra:"", acometida:"" } });
    // barras (o cable) entre la barra principal y Q1: a la izquierda de la bajada, en el largo libre hasta Q1
    textoVertical(doc, ax, ay + 63*s, 59*s, dist.barras ? barraCu(calc.mainBreaker) : dist.texto, s, { sep:3.1 });
    // recuadro de procedencia: crece con el texto (y su embudo con él)
    cajaAcometida(doc, ax - 0.7*s, ay + 144.4*s, s, `VIENE DE ${String(desdeTxt(p, t)||"").toUpperCase()}\n3x${g.voltage} Vac + T - ${g.freq} Hz`);
    const fa = fusiblesAcometida(acc);
    // texto de cable de cada accesorio: desde su inicio hasta antes de las etiquetas del fusible, en una o dos líneas
    const cableAcc = (x0, yTope, xFus, etiquetas, sim0, txt) => {
      const wEt = Math.max(...etiquetas.map(e=>anchoTxt(e, 2.5)));
      const lim = Math.min(sim0 - 1.5, xFus - wEt/2 - 2) - x0;
      const r = ajustarLineas(txt, lim*s, 2.5*s, 2);
      r.lineas.forEach((l, i)=>doc.text(ax + x0*s, ay + yTope*s - r.h + (r.lineas.length - 1 - i)*r.paso, r.h, l, "G-TEX"));
    };
    if(acc.luces){ usados.add("fus3").add("luz"); const vv = { f:fa.luces.join(","), fv:"1X4A", fm:"E91/32" };
      pieza(doc, kit, "acc_lt", ax, ay, { s, vars:Object.assign({ cable:"", dev:"LT1,LT2,LT3", rango:"40-600Vac" }, vv) });
      cableAcc(13.65, 97.1, 78.37, [vv.f, vv.fv, vv.fm], 71.4, "3C#14AWG+14AWG(N) 0.6/1kV"); }
    if(acc.spd){ usados.add("fus3").add("spd"); const vv = { f:"-FS1", fv:"3x125A" };
      pieza(doc, kit, "acc_spd", ax, ay, { s, vars:Object.assign({ cable:"", dev:"SPD1,SPD2,SPD3", tipo:"TIPO 1 y 2", mod: sinMarca(modeloEnMarca(`OVR T1 T2 3L 12.5-${g.voltage>440 ? 600 : 440} P QS`, "", marcasProyecto(p))) }, vv) });
      cableAcc(8.62, 58.57, 67.56, [vv.f, vv.fv], 60.6, "3C#10AWG+10AWG(T) 0.6/1kV"); }
    if(acc.releFase){ usados.add("fus3").add("rf"); const vv = { f:fa.rf.join(","), fv:"1X2A", fm:"E91/32" };
      pieza(doc, kit, "acc_rf", ax, ay, { s, vars:Object.assign({ cable:"", dev:"RF", mod: sinMarca(modeloEnMarca("CM-MPS.41S", "", marcasProyecto(p))) }, vv) });
      cableAcc(8.5, 29.7, 62.95, [vv.f, vv.fv, vv.fm], 56, "3C#14AWG+14AWG(T) 0.6/1kV"); }
    // retorno a tierra (mismo trazado del plano de referencia, llevado a la derecha de la última columna)
    if(G.xRet!=null){
      const xr = FX(G.xRet), yT = SY(TIERRA), pts2 = [];
      if(acc.luces){ doc.line(ax + 133.9*s, ay + 92.78*s, xr, ay + 92.78*s, "E-TIERRA"); pts2.push(ay + 92.78*s); }
      if(acc.spd){ doc.line(ax + 159.17*s, ay + 33.1*s, ax + 159.17*s, ay + 17.6*s, "E-TIERRA"); doc.line(ax + 159.17*s, ay + 17.6*s, xr, ay + 17.6*s, "E-TIERRA"); pts2.push(ay + 17.6*s); }
      doc.line(xr, Math.max(...pts2), xr, yT, "E-TIERRA");
      if(pts2.length > 1) doc.circle(xr, ay + 17.6*s, 0.8*s, "E-TIERRA");
      doc.circle(xr, yT, 0.8*s, "E-TIERRA");
    }
  }

  // ---- verticales: textos de cable bajo el límite del tablero, cargas, tableros y descripciones
  const yCable = SY(FONDO) - 4*s, Lcable = yCable - SY(-262);
  const fin = (x, cable, desc, tagTxt, yDesc, esTablero, yFin, capa) => {
    textoVertical(doc, x, yCable, Lcable, cable, s);
    if(esTablero){ simboloTablero(doc, x, yFin, s, desc, P, { flecha: capa!=null, capaFlecha: capa||"E-FZA-BT-PRI" }); return; }
    descripcion(doc, x, yDesc, [desc, tagTxt], s, P);
  };
  for(const c of cols){
    const x = FX(c.eje), y = SY(0);
    if(c.tipo==="trafo"){
      usados.add("itm2");
      const dc = c.ctrlTipo==="Vdc", vC = c.ctrlV || parseFloat(g.ctrlVoltage) || 120;
      if(c.externa){
        pieza(doc, kit, "trafo", x, y, { s, vars:c.vars, omitir:[[-9, -60, 30, 1]] });
        doc.line(x, SY(-36), x, SY(-58.59), "E-FZA-BT-SEC");
        cajaAcometida(doc, x, SY(-36), s, `VIENE DE ${String(c.desde || "SEGUNDA FUENTE").toUpperCase()}\n${vC===220 ? "2x220 Vac + T" : `1x${vC} ${dc ? "Vdc" : "Vac + N + T"}`} - ${g.freq} Hz`, { n:22 });
      } else {
        usados.add("fus1").add("trafo");
        pieza(doc, kit, "trafo", x, y, { s, vars:c.vars });
      }
      const x0 = FX(c.ramasX[0]), x1 = FX(c.ramasX[c.ramasX.length-1]);
      doc.line(Math.min(x0, x), SY(SUB), Math.max(x1, x), SY(SUB), "E-FZA-BT-SEC");
      const sb = dc ? `L+,L- ${vC} VDC` : `${vC >= 200 ? "R,S" : "L,N"} ${vC} VAC, 1F, ${g.freq}Hz, 10 KA`;
      // rótulo de la barra secundaria: a un lado de la bajada del transformador (sin cruzarla), en una o dos líneas
      { const xe = x, xa = Math.min(x0, x), xb = Math.max(x1, x), sig = cols[cols.indexOf(c) + 1];
        const limDer = sig ? FX(sig.izq) - 3*s : Math.max(xb, FX(G.derTab) - 12);
        const izqW = xe - 3*s - (xa + 3*s), derW = limDer - (xe + 3*s);
        const [xt, wt] = izqW >= derW ? [xa + 3*s, izqW] : [xe + 3*s, derW];
        const r = ajustarLineas(sb, Math.max(20*s, wt), 2.5*s, 2);
        r.lineas.forEach((l, i)=>doc.text(xt, SY(SUB) + 2.4*s + (r.lineas.length - 1 - i)*r.paso, r.h, l, "G-TEX")); }
      c.ramas.forEach((r,i)=>{
        if(r.tipo==="rama_id") usados.add("id");
        const xr = FX(c.ramasX[i]);
        if(r.reserva){ pieza(doc, kit, r.tipo, xr, SY(SUB), { s, vars:Object.assign({}, r.vars, { cable:"" }), omitir:[[-12, -200, 30, -28.1]] }); descripcion(doc, xr, SY(SUB - 33), ["RESERVA"], s, P); return; }
        pieza(doc, kit, r.tipo, xr, SY(SUB), { s, vars:Object.assign({}, r.vars, { cable:"" }), texto: tx => /^ID1\n/.test(tx) ? `${r.vars.id}\n${r.vars.idv}\n${r.vars.idm}` : tx });
        fin(xr, r.vars.cable, r.vars.desc, null, SY(-271), r.tablero, SY(SUB - 164.6), null);
      });
    } else {
      const om = (c.omitir||[]);
      usados.add(c.mcb ? "mcb3" : c.tipo==="col_mcp" ? "gm" : "mccb3");
      if(c.dif) usados.add("rd");
      if(c.tipo==="col_mcp") usados.add("contactor").add("motor");
      else { for(const k of ["fusible","filtro","vfd","motor"]) if(!om.includes(k)) usados.add({ fusible:"fus3", filtro:"filtro", vfd: c.vars.vfdtxt==="AS" ? "as" : "vfd", motor:"motor" }[k]); }
      if(c.reserva){ pieza(doc, kit, c.tipo, x, y, { s, vars:Object.assign({}, c.vars, { cable:"" }), omitir:[[-25, -300, 25, -29.5]] }); descripcion(doc, x, SY(-34), ["RESERVA"], s, P); continue; }
      pieza(doc, kit, c.tipo, x, y, { s, vars:Object.assign({}, c.vars, { cable:"" }), omitir: om.map(k=>OMITIR[k]) });
      for(const k of om){ const pz = PUENTES[k]; if(pz) doc.line(x, y+pz[0]*s, x, y+pz[1]*s, "E-FZA-BT-PRI"); }
      // protección diferencial de la carga: toroide en el conductor, bajo el interruptor, con el relé y su sensibilidad
      if(c.dif){ const yT = SY(c.tipo==="col_mcp" ? -60 : -41); doc.circle(x, yT, 2.6*s, "E-SIM");
        doc.text(x + 4*s, yT + 0.6*s, 2.2*s, c.dif.tag, "G-TEX"); doc.text(x + 4*s, yT - 3.2*s, 2.2*s, c.dif.sens, "G-TEX"); }
      fin(x, c.vars.cable, c.vars.desc, c.tablero ? null : c.vars.tag, SY(om.includes("motor") ? -271 : -287), c.tablero, SY(-267.7), c.tablero ? "E-FZA-BT-PRI" : null);
    }
  }

  // ---- leyenda: solo los símbolos de esta lámina (dentro del tablero si entra en su zona libre, si no a su derecha)
  let notas;
  if(G.leyDentro){ leyX = G.leyDentro.x + dxP; leyY = G.leyDentro.y; leyK = G.leyDentro.k;
    leyenda(doc, kit, ox + DX + leyX, leyY, usados, leyK);
    notas = { x0: Math.max(688, G.der + dxP + DX + 4), x1: 829, y0: 108, y1: 236 };
  } else {
    leyY = yTop; leyenda(doc, kit, ox + DX + leyX, leyY, usados, 1);
    const xn = DX + leyX;
    notas = { x0: xn, x1: Math.min(829, xn + ANCHO_LEY), y0: 108, y1: leyY - altoLey - 8 };
  }

  // ---- barra de tierra y pozo a tierra
  const xT = Math.max(...cols.flatMap(c=>c.tipo==="trafo" ? [c.eje, ...c.ramasX] : [c.eje]), G.xRet ?? -Infinity, 40);
  pieza(doc, kit, "tierra", FX(20.8), SY(TIERRA), { s });
  doc.line(FX(20.8), SY(TIERRA), FX(xT), SY(TIERRA), "E-TIERRA");
  return { notas };
}

/* símbolos que aparecen en la lámina (para contar las filas de la leyenda antes de dibujarla) */
function usadosDe(cols, acc, primera){
  const u = new Set(["tierra"]);
  if(primera) u.add("mccb3");
  if(acc.luces) u.add("fus3").add("luz"); if(acc.spd) u.add("fus3").add("spd"); if(acc.releFase) u.add("fus3").add("rf");
  for(const c of cols){
    if(c.tipo==="trafo"){ u.add("itm2"); if(!c.externa) u.add("fus1").add("trafo"); if(c.ramas.some(r=>r.tipo==="rama_id")) u.add("id"); continue; }
    const om = c.omitir||[];
    u.add(c.mcb ? "mcb3" : c.tipo==="col_mcp" ? "gm" : "mccb3");
    if(c.dif) u.add("rd");
    if(c.tipo==="col_mcp") u.add("contactor").add("motor");
    else for(const k of ["fusible","filtro","vfd","motor"]) if(!om.includes(k)) u.add({ fusible:"fus3", filtro:"filtro", vfd: c.vars.vfdtxt==="AS" ? "as" : "vfd", motor:"motor" }[k]);
  }
  return u;
}

/* geometría de la lámina (coordenadas de la referencia, sin desplazamiento horizontal): verticales, acometida, retorno,
   rótulo de la barra, límite del tablero (con su perfil inferior) y la zona libre arriba a la izquierda */
function geometria(cols, { util, primera, acc, calc, ih, nh }){
  const N = cols.reduce((a, c)=>a + verticales(c), 0) || 1, W = N*ANCHO_COL;
  const s = W > util ? util/W : 1;
  const f = W > util ? 1 : Math.min(util/W, FMAX);
  const P = ANCHO_COL*f*s;
  // verticales desde la izquierda (el tablero se compone después con la leyenda, centrado en la lámina)
  let borde = LIM_IZQ;
  const vert = [];
  cols.forEach(c=>{
    const n = verticales(c);
    if(c.tipo==="trafo"){ c.ramasX = c.ramas.map((_, j)=>borde + (j + 0.5)*P); c.eje = c.ramasX[Math.max(0, Math.min(c.n-1, c.n-2))]; c.ramas.forEach((r, j)=>vert.push({ x:c.ramasX[j], r, rama:true })); }
    else { c.eje = borde + P/2; vert.push({ x:c.eje, r:c, rama:false }); }
    c.izq = borde; c.der = borde + n*P; borde += n*P;
  });
  const ejes = cols.filter(c=>!c.externa).map(c=>c.eje);
  let xAcom = null;
  if(primera){
    if(!ejes.length) xAcom = LIM_IZQ + util/2;
    else if(ejes.length===1) xAcom = ejes[0] + P/2;
    else {
      const todas = cols.flatMap(c=>c.tipo==="trafo" ? c.ramasX : [c.eje]);
      xAcom = (Math.min(...ejes) + Math.max(...ejes))/2; if(todas.some(e=>Math.abs(e - xAcom) < P*0.3)) xAcom += P/2;
    }
  }
  const conRet = !!(acc.luces || acc.spd);
  const xIni = Math.min(...ejes, xAcom ?? Infinity), xFin = Math.max(...ejes, xAcom ?? -Infinity);
  const derCols = cols.length ? cols[cols.length-1].der : borde;
  const xRet = conRet ? Math.max(xAcom + 265.43*s, derCols + 6) : null;
  // a la derecha: columnas, retorno a tierra y lo que se extiende de los accesorios (modelo del supresor)
  const accDer = primera ? xAcom + (acc.spd ? 215 : acc.luces ? 136 : acc.releFase ? 120 : 20)*s : -Infinity;
  const derTab = Math.max(derCols + 8, (xRet ?? -Infinity) + 10, accDer + 6, IZQ + 150);
  const izqTab = IZQ;

  // rótulo de la barra: a la izquierda de la bajada de la acometida si entra, si no a su derecha
  const hb = 2.5*s, txtW = Math.max(anchoTxt(`R,S,T 690 Vac, 3F, 60Hz, 65 kA`, hb), anchoTxt(distribucionPrincipal(calc).barras ? barraCu(calc.mainBreaker) : distribucionPrincipal(calc).texto, hb));
  let rotulo;
  // sin acometida en la lámina (continuación): sobre la barra, desde su inicio hacia la derecha
  if(xAcom==null || !isFinite(xIni)){ const x0 = (isFinite(xIni) ? xIni : LIM_IZQ) + 3*s; rotulo = { x: x0, w: Math.min(120*s, Math.max(txtW, derTab - 12 - x0)) }; }
  else {
    const izqW = xAcom - 13*s - (xIni + 3*s), derW = Math.max(xFin, xAcom + 60*s) - (xAcom + 4*s) - (ih < nh-1 ? anchoTxt("CONTINÚA EN LA HOJA 99", 2.2*s) + 6*s : 0);
    rotulo = izqW >= txtW || izqW >= derW ? { x: xIni + 3*s, w: Math.max(30*s, izqW) } : { x: xAcom + 4*s, w: Math.min(derW, derTab - 10 - (xAcom + 4*s)) };
  }

  // fondo del límite: entre la barra de tierra y los textos de cable; muescas alrededor de las cargas internas
  const yBus = DY + BUS, SY = y => yBus + y*s, yFondo = SY(FONDO);
  const fondoDe = v => {
    const r = v.r, esTab = !!r.tablero;
    if(v.rama) return esTab ? simboloTablero(null, 0, SY(SUB - 164.6), s, r.vars.desc, P, { medir:true }) : descripcion(null, 0, SY(-271), [r.vars.desc], s, P, true);
    if(esTab) return simboloTablero(null, 0, SY(-267.7), s, r.vars.desc, P, { medir:true });
    return descripcion(null, 0, SY((r.omitir||[]).includes("motor") ? -271 : -287), [r.vars.desc, r.vars.tag], s, P, true);
  };
  const perfil = [];
  let a = izqTab;
  for(let i = 0; i < vert.length; ){
    if(!vert[i].r.interno){ i++; continue; }
    let j = i; while(j + 1 < vert.length && vert[j+1].r.interno) j++;
    const xl = i > 0 ? (vert[i-1].x + vert[i].x)/2 : Math.max(izqTab + 30, vert[i].x - P/2);
    const xr = j < vert.length - 1 ? (vert[j].x + vert[j+1].x)/2 : derTab;
    const y = Math.max(PIE - 3, Math.min(...vert.slice(i, j+1).map(fondoDe)) - 4*s);
    if(xl > a) perfil.push([a, xl, yFondo]);
    perfil.push([xl, xr, y]); a = xr; i = j + 1;
  }
  if(a < derTab) perfil.push([a, derTab, yFondo]);

  // zona libre dentro del tablero, arriba a la izquierda (para la leyenda): sobre el rótulo de la barra y a la izquierda
  // de la acometida y de su texto vertical, bajo el título del tablero
  let zonaLibre = null;
  if(xAcom!=null){
    const x0 = izqTab + 6, x1 = xAcom - 16*s, yTopT = DY + BUS + TECHO - 10.8 - 6, y0 = SY(0) + 2.4*s + 3*2.5*s*1.6667 + 4;
    if(x1 - x0 > 60 && yTopT - y0 > 60) zonaLibre = { x0, x1, w: x1 - x0, y0, y1: yTopT, h: yTopT - y0 };
  }
  return { s, f, P, xAcom, xIni, xFin, xRet, izqTab, derTab, izq: izqTab - 2, der: derTab + 2, perfil, rotulo, zonaLibre };
}

/* ---------------- leyenda ----------------
   Se arma con las filas de la leyenda del plano de referencia (y los símbolos de guardamotor y contactor de su columna
   de arranque directo), solo con los símbolos que aparecen en la lámina y numeradas en orden. */
const LEY_FILA = 17.86, LEY_Y0 = -13.55, LEY_COL = [0, 12.06, 43.61, 138.33];
// clave → fila de la leyenda de referencia (1…13), o símbolo tomado de otra pieza / variante con otra descripción
const LEY_ORDEN = [
  ["itm2", { fila:1 }], ["mccb3", { fila:2 }], ["mcb3", { fila:2, desc:"INTERRUPTOR TERMOMAGNÉTICO TRIFÁSICO (MCB)" }],
  ["gm", { pieza:"col_mcp", y:[-37.4, -21.1], capa:/^I-SIM$/, desc:"GUARDAMOTOR (INTERRUPTOR DE PROTECCIÓN DE MOTOR)" }],
  ["contactor", { pieza:"col_mcp", y:[-93.9, -81.7], capa:/^E-SIM$/, desc:"CONTACTOR TRIPOLAR" }],
  ["id", { fila:3 }], ["rd", { toroide:true, desc:"PROTECCIÓN DIFERENCIAL (RELÉ CON TOROIDE)" }], ["fus1", { fila:4 }], ["fus3", { fila:5 }], ["luz", { fila:6 }], ["spd", { fila:7 }], ["rf", { fila:8 }],
  ["vfd", { fila:9 }], ["as", { fila:9, desc:"ARRANCADOR SUAVE", sim:{ VFD:"AS" } }], ["filtro", { fila:11 }], ["motor", { fila:10 }],
  ["trafo", { fila:12 }], ["tierra", { fila:13 }],
];
function cajaE(e){
  const t = e[0];
  if(t==="L") return [Math.min(e[4],e[6]), Math.min(e[5],e[7]), Math.max(e[4],e[6]), Math.max(e[5],e[7])];
  if(t==="C" || t==="A") return [e[4]-e[6], e[5]-e[6], e[4]+e[6], e[5]+e[6]];
  if(t==="T") return [e[4], e[5], e[4], e[5]];
  if(t==="P"){ const xs = e[5].filter((_, i)=>i%2===0), ys = e[5].filter((_, i)=>i%2===1); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
  if(t==="S"){ const xs = [e[4],e[6],e[8],e[10]], ys = [e[5],e[7],e[9],e[11]]; return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
  return [0, 0, 0, 0];
}
function moverE(e, dx, dy, k=1, cx=0, cy=0){
  // traslada (y escala alrededor de cx, cy) una entidad del kit
  const X = v => cx + (v - cx)*k + dx, Y = v => cy + (v - cy)*k + dy, e2 = e.slice();
  if(e[0]==="L"){ e2[4] = X(e[4]); e2[5] = Y(e[5]); e2[6] = X(e[6]); e2[7] = Y(e[7]); }
  else if(e[0]==="C" || e[0]==="A"){ e2[4] = X(e[4]); e2[5] = Y(e[5]); e2[6] = e[6]*k; }
  else if(e[0]==="T"){ e2[4] = X(e[4]); e2[5] = Y(e[5]); e2[6] = e[6]*k; }
  else if(e[0]==="P"){ e2[5] = e[5].map((v, i)=>i%2===0 ? X(v) : Y(v)); }
  else if(e[0]==="S"){ for(let i=4; i<12; i+=2){ e2[i] = X(e[i]); e2[i+1] = Y(e[i+1]); } }
  return e2;
}
function leyenda(doc, kit, x, y, usados, k=1){
  const pz = kit.piezas.leyenda; if(!pz) return;
  const filas = LEY_ORDEN.filter(([k])=>usados.has(k));
  const ents = [];
  // encabezado (título y nombres de columna)
  for(const e of pz.e){ const b = cajaE(e); if(b[1] >= LEY_Y0 - 0.05) ents.push(e); }
  filas.forEach(([, def], i)=>{
    const yTop = LEY_Y0 - i*LEY_FILA, yC = yTop - LEY_FILA/2;
    // marco de la fila (ítem, símbolo, descripción) y número
    for(let c=0; c<3; c++) ents.push(["P", "E-CTRL 0", 18, null, 1, [LEY_COL[c], yTop, LEY_COL[c+1], yTop, LEY_COL[c+1], yTop - LEY_FILA, LEY_COL[c], yTop - LEY_FILA]]);
    ents.push(["T", "G-TEX", null, null, 6.03, yC, 2.5, 0, String(i+1), 1, 2, 1]);
    if(def.fila){
      const t0 = LEY_Y0 - (def.fila-1)*LEY_FILA, t1 = t0 - LEY_FILA, dy = yTop - t0;
      for(const e of pz.e){
        const b = cajaE(e);
        if(b[1] < t1 - 0.05 || b[3] > t0 + 0.05) continue;                     // fuera de la fila
        if(e[1]==="E-CTRL 0") continue;                                           // marcos: se dibujan arriba
        if(e[0]==="T" && Math.abs(e[4] - 6.03) < 0.5) continue;                   // número de ítem
        let e2 = moverE(e, 0, dy);
        if(e[0]==="T" && Math.abs(e[4] - 90.97) < 0.5 && def.desc){ e2 = e2.slice(); e2[8] = def.desc; }
        if(e[0]==="T" && def.sim && def.sim[String(e[8])]){ e2 = e2.slice(); e2[8] = def.sim[String(e[8])]; }
        ents.push(e2);
      }
    } else if(def.toroide){
      // conductor con el toroide del relé diferencial
      ents.push(["L", "E-FZA-BT-PRI", null, null, 27.84, yC + 6.5, 27.84, yC - 6.5], ["C", "E-SIM", null, null, 27.84, yC, 2.6]);
      ents.push(["T", "G-TEX", null, null, 90.97, yC, 2.5, 0, def.desc, 1, 2, 1]);
    } else if(def.pieza){
      // símbolo tomado de otra pieza: centrado en la celda del símbolo, reducido si no entra en la fila
      const src = kit.piezas[def.pieza]; if(!src) return;
      const sel = src.e.filter(e=>{ const b = cajaE(e); return def.capa.test(e[1]) && !(e[0]==="T" && /\{/.test(String(e[8]))) && b[1] >= def.y[0] && b[3] <= def.y[1]; });
      const bs = sel.map(cajaE), x0 = Math.min(...bs.map(b=>b[0])), x1 = Math.max(...bs.map(b=>b[2])), y0 = Math.min(...bs.map(b=>b[1])), y1 = Math.max(...bs.map(b=>b[3]));
      const k = Math.min(1, (LEY_FILA - 3)/(y1 - y0)), cx = (x0 + x1)/2, cy = (y0 + y1)/2;
      for(const e of sel) ents.push(moverE(e, 27.84 - cx, yC - cy, k, cx, cy));
      ents.push(["T", "G-TEX", null, null, 90.97, yC, 2.5, 0, def.desc, 1, 2, 1]);
    }
  });
  // descripciones: dentro de su celda (líneas y altura según el ancho de la columna)
  const anchoDesc = LEY_COL[3] - LEY_COL[2] - 4;
  const ajust = ents.map(e=>{
    if(e[0]!=="T" || e[1]!=="G-TEX" || Math.abs(e[4] - 90.97) > 0.5 || e[5] > LEY_Y0) return e;
    const r = encajar(e[8], anchoDesc, LEY_FILA - 2, e[6], { wf: e[11] || 1 });
    const e2 = e.slice(); e2[8] = r.texto; e2[6] = r.h; return e2;
  });
  pieza(doc, { piezas:{ _ley:{ e:ajust } } }, "_ley", x, y, { s:k });
}

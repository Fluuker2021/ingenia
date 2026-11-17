/* Ingenia — DIAGRAMA UNIFILAR DEL TABLERO DE CONTROL armado con las piezas del unifilar de control de referencia
   del usuario (assets/plantillas/planos/unifilar_control.json, extraído de su plano con tools/planos):
   · acometida estabilizada (120 Vac) con MCB1 a la barra principal; de ella, la fuente de 24 Vdc (CB1 → PS1 → CB2)
     y la distribución de 120 Vac (CB3);
   · barra de 24 Vdc con un fusible por derivación, barra de 120 Vac con un ITM 2P por circuito y barra de 220 Vac
     (servicios del tablero: ventilación, luminaria, tomacorriente con diferencial) desde el tablero de fuerza,
     con su supresor de sobretensiones;
   · barra de tierra y envolvente del tablero con muescas: las cargas de campo (instrumentos, controlador de
     limpieza) quedan fuera del tablero, como en la referencia.
   Los equipos y sus TAG salen de equiposControl() (los mismos del multifilar, del mecánico y de los lazos).
   Los circuitos se reparten y CENTRAN en el ancho útil: al quitar o agregar circuitos el plano se reordena solo;
   si no entran se reduce la escala y, si aun así no entran, la distribución de 120 Vac sigue en otra lámina. */
import { DXFDoc } from "../engine/tablero-core.js";
import { dibujarLamina, PASO_HOJAS, notasLamina } from "./formato.js";
import { tablerosControl, tc as tcPrincipal, datos } from "../datos.js";
import { cargarKit, usarKit, pieza, envolver } from "./kit.js";
import { equiposControl } from "../control/equipos.js";
import { repartirEquilibrado } from "./plano-unifilar.js";

// geometría del plano de referencia (mm)
const Y0 = 516.67, Y24 = 405.03, Y120 = 414.07, Y220 = 414.34, YT = 338.70, YFONDO = 194.2, YMUESCA = 311.3, YTECHO = 631.8;
const PASO = { "24":20, "120":23, "220":25.71 };
const IZQ = 10.8, XL = 26, XR = 644, GAP = 16, X_TIERRA = 16.94;
const RET_SPD = 77.23;            // retorno a tierra del supresor, a la derecha de la bajada de 220 Vac
const DX = 25, DY = -112.8;       // referencia → lámina A1 (área útil 25…831 × 46…579)
const SMIN = 0.62, FMAX = 1.35;
const YC = 441;                   // centro vertical del dibujo: la escala se aplica alrededor de él (queda centrado)

const may = s => String(s||"").toUpperCase();
const amp = (a, polos=2) => `${polos}X${a}A`;

/* columnas de cada barra a partir de los equipos del tablero */
function columnas(eq){
  const por = { "24":[], "120":[], "220":[] };
  for(const c of eq.circuitos){
    const bus = c.barra==="24 Vdc" ? "24" : c.barra==="220 Vac" ? "220" : "120";
    const desc = c.reserva ? "RESERVA" : may(c.descripcion);
    if(bus==="24") por[bus].push({ bus, c, pieza: c.reserva ? "col24_res" : "col24", vars:{ circ:c.circuito, f:c.tag, fv:`${c.in}A` }, desc });
    else if(bus==="120") por[bus].push({ bus, c, pieza: c.reserva ? "col120_res" : "col120", vars:{ circ:c.circuito, q:c.tag, qv:amp(c.in) }, desc });
    else por[bus].push({ bus, c, pieza: c.id ? "col220_id" : "col220", vars:{ circ:c.circuito, q:c.tag, qv:amp(c.in), id: c.id ? `${c.id.tag}\n${c.id.in}A\n${c.id.sens}` : "" }, desc });
  }
  return por;
}

/* láminas: una si todo entra con escala ≥ SMIN; si no, 24 Vdc y 220 Vac en la primera y la distribución de
   120 Vac (repartida en partes equilibradas) en las siguientes */
function planLaminas(por){
  const util = XR - XL;
  const nat = segs => segs.reduce((a, sg)=>a + anchoSeg(sg), 0) + GAP*Math.max(0, segs.length-1);
  const todos = ["24","120","220"].filter(b=>por[b].length).map(b=>({ bus:b, cols:por[b], alim:true }));
  if(nat(todos) <= util/SMIN) return [todos];
  const hojas = [];
  const s24 = por["24"].length ? repartirEquilibrado(por["24"], ()=>PASO["24"], util/SMIN - 140) : [];
  const s120 = por["120"].length ? repartirEquilibrado(por["120"], ()=>PASO["120"], util/SMIN) : [];
  const h1 = [];
  if(s24.length) h1.push({ bus:"24", cols:s24[0], alim:true, sigue: s24.length > 1 });
  if(s120.length) h1.push({ bus:"120", cols:[], alim:true, stub:true });
  if(por["220"].length) h1.push({ bus:"220", cols:por["220"], alim:true });
  hojas.push(h1);
  s24.slice(1).forEach((cols, i)=>hojas.push([{ bus:"24", cols, viene:true, sigue: i < s24.length-2 }]));
  const i120 = hojas.length;
  s120.forEach((cols, i)=>hojas.push([{ bus:"120", cols, viene:true, sigue: i < s120.length-1 }]));
  const st = h1.find(sg=>sg.stub); if(st) st.destino = i120;
  return hojas;
}
function anchoSeg(sg){
  if(sg.stub) return 34;
  const w = sg.cols.length*PASO[sg.bus];
  return sg.bus==="220" && sg.alim ? Math.max(w, PASO["220"]/2 + RET_SPD + 6) : w;
}

export async function unifilarControlKit({ p, valsDe, cliente, id }){
  const kit = await cargarKit("unifilar_control");
  const doc = new DXFDoc(); usarKit(doc, kit);
  const lista = tablerosControl(p).length ? tablerosControl(p) : [tcPrincipal(p)];
  const planes = lista.map(t=>{ const eq = equiposControl(p, t); return { t, eq, hojas: planLaminas(columnas(eq)) }; });
  const total = planes.reduce((a, x)=>a + x.hojas.length, 0);
  let k = 0;
  for(const { t, eq, hojas } of planes){
    const k0 = k;
    hojas.forEach((segs, ih)=>{
      const ox = k*PASO_HOJAS;
      dibujarLamina(doc, ox, 0, valsDe(k, total, { TITULO2: `${may(t.nombre||"Tablero de control")} ${t.tag}${hojas.length>1 ? ` (${ih+1} DE ${hojas.length})` : ""}` }), cliente);
      dibujarHoja(doc, kit, ox, { t, eq, segs, ih, nh: hojas.length, hojaDe: i => k0 + i + 1 });
      if(k===0) notasLamina(doc, ox, 0, datos(p).notas[id || "ins-unifilar-tc"], { y1: 296 });
      k++;
    });
  }
  doc.limpiarUniones(); return { dxf: doc.toDXF(), hojas: total };
}

/* rótulo de una barra: a la izquierda de su alimentación si hay espacio, si no a la derecha */
function rotuloBarra(doc, x0, x1, xa, y, txt, s){
  const h = 2.5*s, w = String(txt).length*h*0.62;
  if(xa==null || xa - x0 >= w + 4*s) return doc.text(x0 + 2*s, y + 2.2*s, h, txt, "G-TEX");
  if(x1 - xa >= w + 4*s) return doc.text(xa + 3*s, y + 2.2*s, h, txt, "G-TEX");
  doc.text((x0 + x1)/2, y + 6.2*s, h, txt, "G-TEX", { halign:1 });
}
/* cable (vertical, a la izquierda del eje) y descripción de la carga (bajo el cable, en una o más líneas centradas) */
function textosColumna(doc, x, cable, desc, s, paso){
  const h = 2.5*s, ls = h*1.6667;
  if(cable) doc.text(x - 0.9*s, Y(306), h*0.9, `${cable} 0.6/1kV`, "G-TEX", { rot:90, halign:2 });
  const n = Math.max(8, Math.floor((Y(247) - Y(YFONDO + 4))/(h*0.86)));
  let lineas = envolver(desc, n);
  lineas = lineas.slice(0, Math.max(1, Math.floor(paso*0.8/ls)));
  lineas.forEach((ln, i)=>doc.text(x + (i - (lineas.length-1)/2)*ls, Y(247), h, ln, "G-TEX", { rot:90, halign:2, valign:2 }));
}
let Y = y => y;   // y de la referencia → lámina (se fija por hoja)

function dibujarHoja(doc, kit, ox, { t, eq, segs, ih, nh, hojaDe }){
  const util = XR - XL;
  const W = segs.reduce((a, sg)=>a + anchoSeg(sg), 0) + GAP*Math.max(0, segs.length-1);
  const s = W > util ? Math.max(SMIN, util/W) : 1;
  const f = W > util ? 1 : Math.min(util/W, FMAX);
  const FX = x => ox + DX + x;                    // x ya calculada en la referencia (escala incluida)
  // la escala se aplica alrededor de la barra de cada grupo; las alturas relativas se conservan
  Y = y => DY + YC + (y - YC)*s;
  const primera = ih===0;
  // posiciones de columnas: grupos de izquierda a derecha, centrados en el ancho útil
  let x = XL + (util - W*f*s)/2;
  const ejes = {};
  for(const sg of segs){
    const p = PASO[sg.bus]*f*s, a = anchoSeg(sg)*f*s;
    sg.x0 = x; sg.x1 = x + a;
    sg.ejes = sg.cols.map((_, i)=>x + p*(i + 0.5));
    if(sg.stub) sg.ejes = [];
    ejes[sg.bus] = sg; x += a + GAP*f*s;
  }
  const yBus = { "24":Y24, "120":Y120, "220":Y220 };
  const YB = b => Y(yBus[b]);                      // barras de cada grupo en la lámina (con la escala)

  // alimentaciones (primera lámina): fuente sobre la columna central de 24 Vdc, CB3 sobre la central de 120 Vac
  const centro = sg => sg.stub ? (sg.x0 + sg.x1)/2 : sg.ejes[Math.floor((sg.ejes.length-1)/2)];
  const g24 = ejes["24"], g120 = ejes["120"], g220 = ejes["220"];
  const xF = g24 && g24.alim && eq.fuente ? centro(g24) : null;
  const xC = g120 && g120.alim && eq.cb120 ? centro(g120) : null;
  const xs = [xF, xC].filter(v=>v!=null);
  const xA = primera ? (xs.length===2 ? (xF + xC)/2 : xs.length ? xs[0] + 35*s : XL + util/2) : null;

  // envolvente con muescas: las cargas de campo quedan fuera del tablero
  const der = Math.max(...segs.map(sg=>sg.x1)) + 6*s;
  const xDer = Math.max(der, primera && g220 && g220.alim ? g220.ejes[0] + (RET_SPD + 12)*s : 0, 120.9 + 20);
  const muescas = [];
  for(const sg of segs){ const p = PASO[sg.bus]*f*s; let ini = null;
    sg.cols.forEach((c, i)=>{ if(c.c.campo){ if(ini==null) ini = i; } if(ini!=null && (!c.c.campo || i===sg.cols.length-1)){ const fin = c.c.campo ? i : i-1; muescas.push([sg.ejes[ini] - p/2 + 0.3, sg.ejes[fin] + p/2 - 0.3]); ini = null; } }); }
  const yF = Y(YFONDO), yM = Y(YMUESCA), yTop = Y(YTECHO);
  const env = [[FX(IZQ), yF], [FX(IZQ), yTop], [FX(xDer), yTop], [FX(xDer), yF]];
  for(const [a, b] of muescas.sort((m, n)=>n[0]-m[0])) env.push([FX(b), yF], [FX(b), yM], [FX(a), yM], [FX(a), yF]);
  env.push([FX(IZQ), yF]);
  doc.polyline(env, "E-EQ");
  pieza(doc, kit, "titulo", FX(IZQ), yTop, { s, vars:{ tit1:`${may(t.nombre||"Tablero de control")} ${t.tag}`, tit2:`${may(eq.vEst)}, 1F+N+T, ${eq.v.frecuencia}Hz` } });
  pieza(doc, kit, "leyenda", FX(660.58), DY + 549.79);

  // barra principal y acometida estabilizada
  if(primera && xs.length){
    const a = eq.acometidas[0];
    const b0 = Math.min(...xs, xA), b1 = Math.max(...xs, xA);
    doc.line(FX(b0), Y(Y0), FX(b1), Y(Y0), "E-CONTROL");
    pieza(doc, kit, "acom120", FX(xA), Y(Y0), { s, lineas:{ acometida:44 }, vars:{ acometida:`VIENE DEL ${may(a.desde)}${a.circuito ? " CIRCUITO "+may(a.circuito) : ""}`, q:a.q.tag, qv:amp(a.q.in), cable:`${a.cable} 0.6/1kV` } });
    rotuloBarra(doc, FX(b0), FX(b1), FX(xA), Y(Y0), `L,N ${may(eq.vEst)}, 1F+N+T, ${eq.v.frecuencia}Hz, ${Math.min(10, +eq.v.icc||10)} KA`, s);
    if(xF!=null){ const fu = eq.fuente; pieza(doc, kit, "fuente", FX(xF), Y(Y0), { s, vars:{ circ:fu.circuito || "C1", q:fu.cb.tag, qv:amp(fu.cb.in), ps:fu.ps.tag, psa:`${fu.ps.a}A`, psv:"24VDC", q2:fu.cbOut.tag, q2v:amp(fu.cbOut.in) } }); }
    if(xC!=null){ pieza(doc, kit, "cb3", FX(xC), Y(Y0), { s, vars:{ circ: xF!=null ? "C2" : "C1", q:eq.cb120.tag, qv:amp(eq.cb120.in) } });
      if(g120.stub){ const yb = YB("120"); doc.line(FX(xC), yb + 12*s, FX(xC), yb + 3*s, "E-CONTROL"); doc.text(FX(xC), yb - 1*s, 2.5*s, `A LA HOJA ${hojaDe(g120.destino || 1)}`, "G-TEX", { halign:1, valign:3 }); } }
  }
  // acometida auxiliar de 220 Vac (servicios del tablero) con su supresor
  if(primera && g220 && g220.alim && g220.cols.length && eq.acometidas[1]){
    const a = eq.acometidas[1], sp = eq.spd;
    pieza(doc, kit, "acom220", FX(g220.ejes[0]), YB("220"), { s, lineas:{ acometida:36 }, vars:{ acometida:`VIENE DEL ${may(a.desde)}${a.circuito ? " CIRCUITO "+may(a.circuito) : ""} 2x220 VAC + T - ${eq.v.frecuencia}HZ`,
      q:a.q.tag, qv:amp(a.q.in), qs:sp.cb.tag, qsv:amp(sp.cb.in), spd:sp.tags.join(","), spdt:sp.tipo, spdm:sp.modelo, cable:`${a.cable} 0.6/1kV` } });
  }

  // barras de cada grupo y sus columnas
  const nombreBus = { "24":"24VDC", "120":`L,N ${may(eq.vEst)}, 1F, ${eq.v.frecuencia}Hz, 10 KA`, "220":`R,S 220 VAC, 1F, ${eq.v.frecuencia}Hz, 10 KA` };
  for(const sg of segs){
    if(!sg.cols.length) continue;
    const yb = YB(sg.bus), x0 = sg.ejes[0], x1 = sg.ejes[sg.ejes.length-1];
    doc.line(FX(x0), yb, FX(x1), yb, sg.bus==="220" ? "E-FZA-BT-SEC" : "E-CONTROL");
    const xa = sg.bus==="24" ? xF : sg.bus==="120" ? xC : (sg.alim ? x0 : null);
    let txt = nombreBus[sg.bus]; if(sg.bus==="24" && eq.fuente) txt += `, ${eq.fuente.ps.a}A`;
    rotuloBarra(doc, FX(x0), FX(x1), xa!=null && primera ? FX(xa) : null, yb, txt, s);
    if(sg.viene) doc.text(FX(x0) - 2*s, yb + 0.5*s, 2.2*s, `VIENE DE ${sg.bus==="24" ? eq.fuente.cbOut.tag : eq.cb120.tag} (HOJA ${hojaDe(-1)})`, "G-TEX", { halign:2, valign:2 });
    if(sg.sigue) doc.text(FX(x1) + 2*s, yb + 0.5*s, 2.2*s, "CONTINÚA EN LA HOJA SIGUIENTE", "G-TEX", { valign:2 });
    sg.cols.forEach((c, i)=>{
      const xc = sg.ejes[i];
      pieza(doc, kit, c.pieza, FX(xc), yb, { s, vars:c.vars });
      // la pieza de referencia es la del 2.º circuito: el primero no lleva punto de unión (esquina de la barra)
      textosColumna(doc, FX(xc), c.c.reserva ? c.c.cable : c.c.cable, c.desc, s, PASO[sg.bus]*f*s);
    });
  }

  // barra de tierra (de la puesta a tierra a la última derivación o al retorno del supresor)
  const ult = Math.max(...segs.flatMap(sg=>sg.ejes), primera && g220 && g220.alim && g220.cols.length ? g220.ejes[0] + RET_SPD*s : -Infinity);
  pieza(doc, kit, "tierra", FX(X_TIERRA), Y(YT), { s });
  doc.line(FX(X_TIERRA), Y(YT), FX(ult), Y(YT), "E-TIERRA");
}

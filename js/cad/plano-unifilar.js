/* Ingenia — DIAGRAMA UNIFILAR DEL TABLERO DE FUERZA armado con las piezas del unifilar de referencia del
   usuario (assets/plantillas/planos/unifilar.json): acometida con sus accesorios, barra principal, una columna
   por circuito (variador, guardamotor + contactor, arrancador suave, alimentador) y los transformadores de
   control con su barra secundaria y derivaciones, la barra de tierra y la leyenda. Las columnas se reparten
   en el ancho del tablero para que el plano quede ordenado y proporcionado a la lámina; si no entran, se
   reduce la escala y, si aun así no entran, el tablero continúa en otra lámina. */
import { DXFDoc } from "../engine/tablero-core.js";
import { dibujarLamina, PASO_HOJAS, notasLamina } from "./formato.js";
import { calcularTablero, calcularTodos, tf, desdeTxt, r2, datos } from "../datos.js";
import { valoresDiseno } from "../modules/criterios.js";
import { cargarKit, usarKit, pieza, envolver } from "./kit.js";

// geometría del plano de referencia (mm, espacio modelo)
const BUS = 517.4, EJE0 = 71.8, ANCHO_COL = 58.2, PASO_RAMA = 45, SUB = 415.3 - BUS;
const TIERRA = 339.3 - BUS, FONDO = 311.5 - BUS, TECHO = 631.8 - BUS, IZQ = 10.8, DER = 637.8, X_ACOM = 325, X_RETORNO = 590.4;
const LIM_IZQ = EJE0 - ANCHO_COL/2, LIM_DER = 627.8;
// referencia → lámina: x + 25, y − 125 (el diagrama queda dentro del área útil A1 de 806 × 533 mm)
const DX = 25, DY = -125, PIE = 52;   // PIE: borde inferior útil de la lámina para las descripciones

const awg = s => String(s||"").replace(/\s+/g,"").replace(/AWG/i,"AWG");
const cableTxt = c => { const m = c.conductorMemo; if(!m || !m.cable) return ""; return `1-3C#${awg(m.cable[0])}+${m.egc ? awg(m.egc[1]) : awg(m.cable[0])}(T) 0.6/1kV`; };
const sinMarca = s => String(s||"").replace(/^ABB\s+/,"").replace(/\s*\(.*$/,"");
const item = (c, re) => c.items.find(x=>re.test(x.comp)) || {};
const BARRAS = [[325,"20x5"],[450,"30x5"],[560,"40x5"],[690,"50x5"],[790,"60x5"],[1030,"80x5"],[1250,"100x5"],[2200,"2x100x5"]];
const barraCu = a => { const b = (BARRAS.find(([i])=>i>=a)||BARRAS[BARRAS.length-1])[1]; return `3xB.Cu ${b} mm + 1xB.Cu 20x3 mm(T)`; };

/* una columna (o grupo) por circuito del tablero */
function columnas(calc){
  let nMotor = 0;
  return calc.circuits.map(c=>{
    const l = c.load || {}, cable = cableTxt(c);
    const desc = (l.desc || c.descLabel || c.title || "").toUpperCase(), tag = l.tag || "";
    if(c.kind==="control"){
      const f = item(c, /^Portafusible/), t = item(c, /^Transformador|^Fuente/), q = item(c, /^ITM principal/);
      const ramas = c.items.filter(x=>/^QC\d+\./.test(x.devtag||"")).map((x,i)=>({ tipo: /tomacorriente/i.test(x.comp) ? "rama_id" : "rama",
        vars:{ circ:"C"+(i+1), q:x.devtag, qv:String(x.val||"").split(" · ")[0], desc:String(x.comp||"").toUpperCase(),
          cable: `2C#${parseFloat(String(x.val).replace(/^2x/i,""))>15 ? 12 : 14}AWG+${parseFloat(String(x.val).replace(/^2x/i,""))>15 ? 12 : 14}AWG(T) 0.6/1kV`, id:"ID"+(i+1), idv:"2x25A", idm:"30mA" } }));
      if(!ramas.length) ramas.push({ tipo:"rama", vars:{ circ:"C1", q:"", qv:"", desc:"RESERVA", cable:"" } });
      const va = (String(t.val||"").match(/^[\d.]+\s*k?VA/i)||[""])[0].replace(/\s+/g,"");
      return { tipo:"trafo", n: ramas.length, ramas, vars:{ circ:c.tag, f:f.devtag||"", fv: f.val ? "2x"+f.val : "", fm:"gG", t:t.devtag||"", tv:va, tm:t.model||"", q:q.devtag||"", qv:q.val||"" } };
    }
    if(c.kind==="motor"){
      nMotor++;
      const motor = { m:"M"+nMotor, hp: `${l.power}${l.powerUnit==="hp" ? "HP" : "kW"}`, amp: r2(c.installedCurrent,1)+"A", desc, tag, cable, circ:c.tag };
      if(l.starter==="vfd"){
        const q = item(c, /^ITM/), f = item(c, /^Portafusible/), rl = item(c, /^Filtro de l[ií]nea/), v = item(c, /^Variador/);
        return { tipo:"col_vfd", omitir: rl.devtag ? [] : ["filtro"], vars: Object.assign(motor, { q:q.devtag, qv:q.val, f:f.devtag, fv: f.val ? "3x"+f.val : "", rl:rl.devtag, rlv:rl.val, vfd:v.devtag, vfdtxt:"VFD", vfdv:v.val }) };
      }
      if(l.starter==="ss"){
        const q = item(c, /^ITM/), f = item(c, /^Portafusible/), a = item(c, /^Arrancador suave/);
        return { tipo:"col_vfd", omitir:["filtro"], vars: Object.assign(motor, { q:q.devtag, qv:q.val, f:f.devtag, fv: f.val ? "3x"+f.val : "", vfd:a.devtag, vfdtxt:"AS", vfdv:a.val }) };
      }
      const q = item(c, /^Guardamotor|^ITM/), k = item(c, /^Contactor/);
      return { tipo:"col_mcp", vars: Object.assign(motor, { q:q.devtag, qv:q.val, k:k.devtag, km:sinMarca(k.model), kv:k.val }) };
    }
    // alimentador o carga general: interruptor, cable y la carga
    const q = item(c, /^ITM/);
    return { tipo:"col_vfd", omitir:["fusible","filtro","vfd","motor"], vars:{ circ:c.tag, q:q.devtag, qv:q.val, cable, desc, tag: tag ? `${tag} · ${r2(c.installedCurrent,1)} A` : `${r2(c.installedCurrent,1)} A` } };
  });
}
const ancho = col => col.tipo==="trafo" ? (col.n-1)*PASO_RAMA + ANCHO_COL : ANCHO_COL;
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
const GAP_ACOM = ANCHO_COL;   // hueco de la barra donde baja la acometida: el ancho de un circuito (separación uniforme)
const FMAX = 1.5;       // separación máxima entre circuitos cuando sobra espacio (×)
function repartir(cols){ return repartirEquilibrado(cols, ancho, (LIM_DER - LIM_IZQ)/0.75, GAP_ACOM); }

export async function unifilarKit({ p, valsDe, cliente, id }){
  const kit = await cargarKit("unifilar");
  const calcs = calcularTodos(p);
  const lista = calcs.length ? calcs : [calcularTablero(p, tf(p))];
  const v = valoresDiseno(p);
  const doc = new DXFDoc(); usarKit(doc, kit);
  const planes = lista.map(calc=>({ calc, hojas: repartir(columnas(calc)) }));
  const total = planes.reduce((a,x)=>a+x.hojas.length, 0);
  let k = 0;
  for(const { calc, hojas } of planes){
    const t = calc.tablero, g = calc.g;
    hojas.forEach((cols, ih)=>{
      const ox = k*PASO_HOJAS;
      dibujarLamina(doc, ox, 0, valsDe(k, total, { TITULO2: `${(t.nombre||"").toUpperCase()} ${t.tag}${hojas.length>1 ? ` (${ih+1} DE ${hojas.length})` : ""}` }), cliente);
      dibujarHoja(doc, kit, ox, { p, calc, t, g, v, cols, primera: ih===0, ih, nh: hojas.length });
      // notas del usuario (primera lámina), debajo de la leyenda y sobre el cajetín
      if(k===0) notasLamina(doc, ox, 0, datos(p).notas[id || "ele-unifilar"], { y1: 236 });
      k++;
    });
  }
  doc.limpiarUniones(); return { dxf: doc.toDXF(), hojas: total, calc: lista[0] };
}

/* descripción de la carga bajo el motor o la flecha: texto vertical que termina en yIni y baja hacia el pie de
   la lámina; si no entra, se corta en varias líneas centradas en el eje del circuito */
function descripcion(doc, x, yIni, textos, s, anchoDisp){
  const h = 2.5*s, ls = h*1.6667, n = Math.max(6, Math.floor((yIni - PIE)/(h*0.75)));
  let lineas = textos.filter(Boolean).flatMap(t=>envolver(t, n));
  const max = Math.max(1, Math.floor((anchoDisp*0.7)/ls)); lineas = lineas.slice(0, max);
  lineas.forEach((ln, i)=>doc.text(x + (i - (lineas.length-1)/2)*ls, yIni, h, ln, "G-TEX", { rot:90, halign:2, valign:2 }));
}

function dibujarHoja(doc, kit, ox, { p, calc, t, g, v, cols, primera, ih, nh }){
  const util = LIM_DER - LIM_IZQ;
  const acc = primera ? (t.accesorios||{}) : {};
  // hueco de la acometida (primera lámina): entre los dos circuitos más cercanos al centro de la barra
  const anchos = cols.map(ancho), W = anchos.reduce((a, b)=>a + b, 0) || ANCHO_COL;
  let kAcom = -1;
  if(primera){
    if(cols.length < 2) kAcom = cols.length;
    else { let acu = 0, mejor = 1e9; for(let k=1; k<cols.length; k++){ acu += anchos[k-1]; const d = Math.abs(acu - W/2); if(d < mejor){ mejor = d; kAcom = k; } } }
  }
  const WT = W + (kAcom >= 0 ? GAP_ACOM : 0);
  // escala (si no entran) y separación (si sobra espacio): el conjunto queda centrado en el ancho útil
  const s = WT > util ? util/WT : 1;
  const f = WT > util ? 1 : Math.min(util/WT, FMAX);
  const FX = x => ox + DX + x, FY = y => DY + y;                     // coordenadas del plano de referencia (escala 1)
  const SY = y => DY + BUS + y*s;                                    // y relativo a la barra, con la escala
  let borde = LIM_IZQ + (util - WT*f*s)/2, xAcom = null;
  cols.forEach((c, i)=>{
    if(i===kAcom){ xAcom = borde + GAP_ACOM*f*s/2; borde += GAP_ACOM*f*s; }
    const a = anchos[i]*f*s;
    if(c.tipo==="trafo"){ c.ramasX = c.ramas.map((_, j)=>borde + f*s*(ANCHO_COL/2 + j*PASO_RAMA)); c.eje = c.ramasX[Math.max(0, Math.min(c.n-1, c.n-2))]; }
    else c.eje = borde + a/2;
    c.izq = borde; c.der = borde + a; borde += a;
  });
  if(kAcom===cols.length){ xAcom = borde + GAP_ACOM*f*s/2; borde += GAP_ACOM*f*s; }
  // la acometida y sus accesorios (sobre la barra) no deben salirse del tablero por la derecha
  const conRet = !!(acc.luces || acc.spd);
  const ejes = cols.map(c=>c.eje);
  const xIni = Math.min(ejes[0] ?? xAcom, xAcom ?? Infinity), xFin = Math.max(ejes[ejes.length-1] ?? xAcom, xAcom ?? -Infinity);
  const derCols = cols.length ? cols[cols.length-1].der : borde;
  // retorno a tierra de luces piloto y supresor: baja a la derecha, fuera de la barra y de las columnas
  const xRet = conRet ? Math.max(xAcom + 265.43*s, derCols + 6) : null;
  const derTablero = Math.max(DER, (xRet ?? derCols) + 10, derCols + 8);

  // tablero (envolvente), título y potencias
  doc.polyline([[FX(IZQ), SY(FONDO)], [FX(IZQ), FY(BUS+TECHO)], [FX(derTablero), FY(BUS+TECHO)], [FX(derTablero), SY(FONDO)], [FX(IZQ), SY(FONDO)]], "E-EQ");
  pieza(doc, kit, "titulo", FX(IZQ), FY(BUS+TECHO), { vars:{ tit1:`${t.nombre||"Tablero"} ${t.tag||""}`.toUpperCase(), tit2:`${g.voltage} Vac, 3F+T, ${g.freq}Hz` } });
  pieza(doc, kit, "pimd", FX(derTablero), FY(BUS+TECHO), { vars:{ pi:`PI: ${r2(calc.installedKVA,1)} kVA`, md:`MD: ${r2(calc.totalKVA,2)} kVA` } });
  pieza(doc, kit, "leyenda", FX(656.5), FY(631.8));

  // barra principal y su rotulado (dos líneas sobre la barra, desde su inicio)
  doc.line(FX(xIni), SY(0), FX(xFin), SY(0), "E-FZA-BT-PRI");
  const hb = 2.5*s;
  doc.text(FX(xIni) + 3*s, SY(0) + 2.4*s + hb*1.6, hb, `R,S,T ${g.voltage} Vac, 3F, ${g.freq}Hz, ${g.faultLevel} kA`, "G-TEX");
  doc.text(FX(xIni) + 3*s, SY(0) + 2.4*s, hb, barraCu(calc.mainBreaker), "G-TEX");
  if(!primera) doc.text(FX(xIni)-2, SY(0)+3*s, 2.2*s, `VIENE DE LA HOJA ${ih}`, "G-TEX", { halign:2 });
  if(ih < nh-1) doc.text(FX(xFin)+2, SY(0)+3*s, 2.2*s, `CONTINÚA EN LA HOJA ${ih+2}`, "G-TEX");

  // acometida y accesorios (primera lámina del tablero)
  if(primera){
    const ax = FX(xAcom), ay = SY(0);
    pieza(doc, kit, "acometida", ax, ay, { s, lineas:{ acometida:26 }, vars:{ q:"Q1", qv:`3x${calc.mainBreaker}A`, barra: barraCu(calc.mainBreaker), acometida:`VIENE DE ${String(desdeTxt(p, t)||"").toUpperCase()}` } });
    let nf = 0; const fus = n=>{ const a = Array.from({length:n},(_,i)=>"F"+(++nf)); return a.join(","); };
    if(acc.luces) pieza(doc, kit, "acc_lt", ax, ay, { s, vars:{ f:fus(3), fv:"1X4A", fm:"E91/32", cable:"3C#14AWG+14AWG(N) 0.6/1kV", dev:"LT1,LT2,LT3", rango:"40-600Vac" } });
    if(acc.spd) pieza(doc, kit, "acc_spd", ax, ay, { s, vars:{ f:"-FS1", fv:"3x125A", cable:"3C#10AWG+10AWG(T) 0.6/1kV", dev:"SPD1,SPD2,SPD3", tipo:"TIPO 1 y 2", mod:`OVR T1 T2 3L 12.5-${g.voltage>440 ? 600 : 440} P QS` } });
    if(acc.releFase) pieza(doc, kit, "acc_rf", ax, ay, { s, vars:{ f:fus(3), fv:"1X2A", fm:"E91/32", cable:"3C#14AWG+14AWG(T) 0.6/1kV", dev:"RF", mod:"CM-MPS.41S" } });
    // retorno a tierra (mismo trazado del plano de referencia, llevado a la derecha de la última columna)
    if(conRet){
      const xr = FX(xRet), yT = SY(TIERRA), pts = [];
      if(acc.luces){ doc.line(ax + 133.9*s, ay + 92.78*s, xr, ay + 92.78*s, "E-TIERRA"); pts.push(ay + 92.78*s); }
      if(acc.spd){ doc.line(ax + 159.17*s, ay + 33.1*s, ax + 159.17*s, ay + 17.6*s, "E-TIERRA"); doc.line(ax + 159.17*s, ay + 17.6*s, xr, ay + 17.6*s, "E-TIERRA"); pts.push(ay + 17.6*s); }
      doc.line(xr, Math.max(...pts), xr, yT, "E-TIERRA");
      if(pts.length > 1) doc.circle(xr, ay + 17.6*s, 0.8*s, "E-TIERRA");
      doc.circle(xr, yT, 0.8*s, "E-TIERRA");
    }
  }

  // columnas
  for(const c of cols){
    const x = FX(c.eje), y = SY(0);
    if(c.tipo==="trafo"){
      pieza(doc, kit, "trafo", x, y, { s, vars:c.vars });
      const x0 = FX(c.ramasX[0]), x1 = FX(c.ramasX[c.ramasX.length-1]);
      doc.line(Math.min(x0, x), SY(SUB), Math.max(x1, x), SY(SUB), "E-FZA-BT-SEC");
      pieza(doc, kit, "trafo_txt", x0, SY(SUB), { s, vars:{ sb:`L,N ${g.ctrlVoltage} ${g.ctrlTipo==="Vdc" ? "Vdc" : "Vac"}, 1F, ${g.freq}Hz` } });
      c.ramas.forEach((r,i)=>{ pieza(doc, kit, r.tipo, FX(c.ramasX[i]), SY(SUB), { s, vars:r.vars }); descripcion(doc, FX(c.ramasX[i]), SY(-271), [r.vars.desc], s, PASO_RAMA*f*s); });
    } else {
      const om = (c.omitir||[]);
      pieza(doc, kit, c.tipo, x, y, { s, vars:c.vars, omitir: om.map(k=>OMITIR[k]) });
      descripcion(doc, x, SY(om.includes("motor") ? -271 : -287), [c.vars.desc, c.vars.tag], s, ANCHO_COL*f*s);
      // donde se omite un equipo, el conductor continúa
      for(const k of om){ const pz = PUENTES[k]; if(pz) doc.line(x, y+pz[0]*s, x, y+pz[1]*s, "E-FZA-BT-PRI"); }
    }
  }

  // barra de tierra y pozo a tierra
  const xT = Math.max(...cols.flatMap(c=>c.tipo==="trafo" ? [c.eje, ...c.ramasX] : [c.eje]), xRet ?? -Infinity, 40);
  pieza(doc, kit, "tierra", FX(20.8), SY(TIERRA), { s });
  doc.line(FX(20.8), SY(TIERRA), FX(xT), SY(TIERRA), "E-TIERRA");
}

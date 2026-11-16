/* Ingenia — DIAGRAMA UNIFILAR DEL TABLERO DE FUERZA armado con las piezas del unifilar de referencia del
   usuario (assets/plantillas/planos/unifilar.json): acometida con sus accesorios, barra principal, una columna
   por circuito (variador, guardamotor + contactor, arrancador suave, alimentador) y los transformadores de
   control con su barra secundaria y derivaciones, la barra de tierra y la leyenda. Las columnas se reparten
   en el ancho del tablero para que el plano quede ordenado y proporcionado a la lámina; si no entran, se
   reduce la escala y, si aun así no entran, el tablero continúa en otra lámina. */
import { DXFDoc } from "../engine/tablero-core.js";
import { dibujarLamina, PASO_HOJAS } from "./formato.js";
import { calcularTablero, calcularTodos, tf, desdeTxt, r2 } from "../datos.js";
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
        return { tipo:"col_vfd", vars: Object.assign(motor, { q:q.devtag, qv:q.val, f:f.devtag, fv: f.val ? "3x"+f.val : "", rl:rl.devtag, rlv:rl.val, vfd:v.devtag, vfdtxt:"VFD", vfdv:v.val }) };
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

/* reparte las columnas en láminas: cada lámina admite el ancho útil del tablero con escala ≥ 0,75 */
function repartir(cols){
  const util = LIM_DER - LIM_IZQ, hojas = [[]];
  let w = 0;
  for(const c of cols){
    const a = ancho(c);
    if(hojas[hojas.length-1].length && (w + a) > util/0.75){ hojas.push([]); w = 0; }
    hojas[hojas.length-1].push(c); w += a;
  }
  return hojas;
}

export async function unifilarKit({ p, valsDe, cliente }){
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
      k++;
    });
  }
  return { dxf: doc.toDXF(), hojas: total, calc: lista[0] };
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
  // ancho y escala: las columnas llenan el tablero (hasta 1,3 veces su separación) o se reducen si no entran
  const util = LIM_DER - LIM_IZQ;
  const W = cols.reduce((a,c)=>a+ancho(c), 0) || ANCHO_COL;
  const s = W > util ? util/W : 1;
  const f = W > util ? 1 : Math.min(util/W, 1.3);
  // coordenadas del plano de referencia → lámina (escala s alrededor del inicio de la barra)
  const SX = x => ox + DX + EJE0 + (x-EJE0)*s, SY = y => DY + BUS + y*s;        // y relativo a la barra
  const FX = x => ox + DX + x, FY = y => DY + y;                                  // piezas fijas (escala 1)
  // posiciones de los ejes en coordenadas del plano de referencia
  let borde = LIM_IZQ; const ejes = [];
  for(const c of cols){
    const a = ancho(c)*f;
    if(c.tipo==="trafo"){ c.ramasX = c.ramas.map((_,i)=>borde + f*(ANCHO_COL/2 + i*PASO_RAMA)); c.eje = c.ramasX[Math.max(0, Math.min(c.n-1, c.n-2))]; }
    else c.eje = borde + a/2;
    ejes.push(c.eje); borde += a;
  }
  const acc = primera ? (t.accesorios||{}) : {};
  const xIni = Math.min(ejes[0] ?? EJE0, primera ? X_ACOM : Infinity), xFin = Math.max(ejes[ejes.length-1] ?? EJE0, primera ? X_ACOM : -Infinity);
  const derTablero = Math.max(DER, borde + 8);   // en coordenadas del plano de referencia (SX aplica la escala)
  const xRet = (acc.luces || acc.spd) ? X_RETORNO : -Infinity;

  // tablero (envolvente), título y potencias
  doc.polyline([[FX(IZQ), SY(FONDO)], [FX(IZQ), FY(BUS+TECHO)], [SX(derTablero), FY(BUS+TECHO)], [SX(derTablero), SY(FONDO)], [FX(IZQ), SY(FONDO)]], "E-EQ");
  pieza(doc, kit, "titulo", FX(IZQ), FY(BUS+TECHO), { vars:{ tit1:`${t.nombre||"Tablero"} ${t.tag||""}`.toUpperCase(), tit2:`${g.voltage} Vac, 3F+T, ${g.freq}Hz` } });
  pieza(doc, kit, "pimd", SX(derTablero), FY(BUS+TECHO), { vars:{ pi:`PI: ${r2(calc.installedKVA,1)} kVA`, md:`MD: ${r2(calc.totalKVA,2)} kVA` } });
  pieza(doc, kit, "leyenda", FX(656.5), FY(631.8));

  // barra principal y su rotulado
  doc.line(SX(xIni), SY(0), SX(xFin), SY(0), "E-FZA-BT-PRI");
  pieza(doc, kit, "barra_txt", SX(Math.min(ejes[0] ?? EJE0, EJE0)), SY(0), { s, vars:{ barra1:`R,S,T ${g.voltage} Vac, 3F, ${g.freq}Hz, ${g.faultLevel} kA`, barra2: barraCu(calc.mainBreaker) } });
  if(!primera) doc.text(SX(xIni)-2, SY(0)+3*s, 2.2*s, `VIENE DE LA HOJA ${ih}`, "G-TEX", { halign:2 });
  if(ih < nh-1) doc.text(SX(xFin)+2, SY(0)+3*s, 2.2*s, `CONTINÚA EN LA HOJA ${ih+2}`, "G-TEX");

  // acometida y accesorios (primera lámina del tablero)
  if(primera){
    const ax = SX(X_ACOM), ay = SY(0);
    pieza(doc, kit, "acometida", ax, ay, { s, lineas:{ acometida:26 }, vars:{ q:"Q1", qv:`3x${calc.mainBreaker}A`, barra: barraCu(calc.mainBreaker), acometida:`VIENE DE ${String(desdeTxt(p, t)||"").toUpperCase()}` } });
    let nf = 0; const fus = n=>{ const a = Array.from({length:n},(_,i)=>"F"+(++nf)); return a.join(","); };
    if(acc.luces) pieza(doc, kit, "acc_lt", ax, ay, { s, vars:{ f:fus(3), fv:"1X4A", fm:"E91/32", cable:"3C#14AWG+14AWG(N) 0.6/1kV", dev:"LT1,LT2,LT3", rango:"40-600Vac" } });
    if(acc.spd) pieza(doc, kit, "acc_spd", ax, ay, { s, vars:{ f:"-FS1", fv:"3x125A", cable:"3C#10AWG+10AWG(T) 0.6/1kV", dev:"SPD1,SPD2,SPD3", tipo:"TIPO 1 y 2", mod:`OVR T1 T2 3L 12.5-${g.voltage>440 ? 600 : 440} P QS` } });
    if(acc.releFase) pieza(doc, kit, "acc_rf", ax, ay, { s, vars:{ f:fus(3), fv:"1X2A", fm:"E91/32", cable:"3C#14AWG+14AWG(T) 0.6/1kV", dev:"RF", mod:"CM-MPS.41S" } });
    if(acc.luces || acc.spd) pieza(doc, kit, "retorno", ax, ay, { s });
  }

  // columnas
  for(const c of cols){
    const x = SX(c.eje), y = SY(0);
    if(c.tipo==="trafo"){
      pieza(doc, kit, "trafo", x, y, { s, vars:c.vars });
      const x0 = SX(c.ramasX[0]), x1 = SX(c.ramasX[c.ramasX.length-1]);
      doc.line(Math.min(x0, x), SY(SUB), Math.max(x1, x), SY(SUB), "E-FZA-BT-SEC");
      pieza(doc, kit, "trafo_txt", x0, SY(SUB), { s, vars:{ sb:`L,N ${g.ctrlVoltage} ${g.ctrlTipo==="Vdc" ? "Vdc" : "Vac"}, 1F, ${g.freq}Hz` } });
      c.ramas.forEach((r,i)=>{ pieza(doc, kit, r.tipo, SX(c.ramasX[i]), SY(SUB), { s, vars:r.vars }); descripcion(doc, SX(c.ramasX[i]), SY(-271), [r.vars.desc], s, PASO_RAMA*f*s); });
    } else {
      const om = (c.omitir||[]);
      pieza(doc, kit, c.tipo, x, y, { s, vars:c.vars, omitir: om.map(k=>OMITIR[k]) });
      descripcion(doc, x, SY(om.includes("motor") ? -271 : -287), [c.vars.desc, c.vars.tag], s, ANCHO_COL*f*s);
      // donde se omite un equipo, el conductor continúa
      for(const k of om){ const pz = PUENTES[k]; if(pz) doc.line(x, y+pz[0]*s, x, y+pz[1]*s, "E-FZA-BT-PRI"); }
    }
  }

  // barra de tierra y pozo a tierra
  const xT = Math.max(ejes[ejes.length-1] ?? EJE0, xRet);
  pieza(doc, kit, "tierra", FX(20.8), SY(TIERRA), { s });
  doc.line(FX(20.8), SY(TIERRA), SX(Math.max(xT, xRet===-Infinity ? xT : xRet)), SY(TIERRA), "E-TIERRA");
}

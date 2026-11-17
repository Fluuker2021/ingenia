/* Ingenia — DIAGRAMA UNIFILAR DEL TABLERO DE FUERZA armado con las piezas del unifilar de referencia del
   usuario (assets/plantillas/planos/unifilar.json): acometida con sus accesorios, barra principal, una columna
   por circuito (variador, guardamotor + contactor, arrancador suave, alimentador) y los transformadores de
   control con su barra secundaria y derivaciones, la barra de tierra y la leyenda. Las columnas se reparten
   en el ancho del tablero para que el plano quede ordenado y proporcionado a la lámina; si no entran, se
   reduce la escala y, si aun así no entran, el tablero continúa en otra lámina. */
import { modeloCorto, modeloEnMarca, marcasProyecto } from "../engine/marcas.js";
import { DXFDoc } from "../engine/tablero-core.js";
import { dibujarLamina, PASO_HOJAS, notasLamina } from "./formato.js";
import { calcularTablero, calcularTodos, tf, desdeTxt, r2, datos, accesoriosTablero, fusiblesAcometida } from "../datos.js";
import { valoresDiseno } from "../modules/criterios.js";
import { cargarKit, usarKit, pieza, envolver, cajaAcometida } from "./kit.js";

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

/* una columna (o grupo) por circuito del tablero */
function columnas(calc){
  let nMotor = 0;
  return calc.circuits.map(c=>{
    const l = c.load || {}, cable = cableTxt(c);
    const desc = (l.desc || c.descLabel || c.title || "").toUpperCase(), tag = l.tag || "";
    if(c.kind==="control"){
      // control interno: portafusibles → transformador → interruptor general de control → barra → derivaciones
      // (o, con la segunda fuente, la acometida externa directo al interruptor general)
      const f = item(c, /^Portafusible/), t = item(c, /^Transformador|^Fuente/), q = item(c, /^ITM principal/);
      const ramas = c.items.filter(x=>x.rama || /^QC\d+\./.test(x.devtag||"")).map((x,i)=>{
        const qv = String(x.val||"").split(" · ")[0], a = parseFloat(qv.replace(/^2x/i,"")) || 0, awgN = a > 15 ? 12 : 14;
        const cable = x.cable || `2C#${awgN}AWG+${awgN}AWG(T)`;
        return { tipo: (x.id || (x.id==null && !x.rama && /tomacorriente/i.test(x.comp))) ? "rama_id" : "rama", externo: /^tca?:/.test(x.cfg||""),
          vars:{ circ:"C"+(i+1), q:x.devtag, qv: qv.toUpperCase(), desc: String(x.destino || x.comp || "").toUpperCase(),
            cable: `${/^tca?:/.test(x.cfg||"") ? "1-" : ""}${cable} 0.6/1kV`, id: x.id || "ID"+(i+1), idv:"2x25A", idm:"30mA" } };
      });
      if(!ramas.length) ramas.push({ tipo:"rama", vars:{ circ:"C1", q:"", qv:"", desc:"RESERVA", cable:"" } });
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
    // alimentador o carga general: interruptor, cable y la carga
    const q = item(c, /^ITM/);
    return { tipo:"col_vfd", mcb: esMcb(q), omitir:["fusible","filtro","vfd","motor"], vars:{ circ:c.tag, q:q.devtag, qv:q.val, cable, desc, tag: tag ? `${tag} · ${r2(c.installedCurrent,1)} A` : `${r2(c.installedCurrent,1)} A` } };
  });
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
  const planes = lista.map(calc=>{ const cols = columnas(calc); return { calc, hojas: repartir([...cols.filter(c=>!c.externa), ...cols.filter(c=>c.externa)]) }; });
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
  doc.limpiarUniones(); doc.centrarEnSimbolos(); return { dxf: doc.toDXF(), hojas: total, calc: lista[0] };
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
  const accT = accesoriosTablero(p, t), acc = primera ? accT : {};
  // todas las verticales de carga (circuitos y derivaciones del control interno) a la misma distancia P; la escala baja
  // si no entran y la separación crece (hasta FMAX) si sobra espacio, con el conjunto centrado en el ancho útil
  const N = cols.reduce((a, c)=>a + verticales(c), 0) || 1, W = N*ANCHO_COL;
  const s = W > util ? util/W : 1;
  const f = W > util ? 1 : Math.min(util/W, FMAX);
  const P = ANCHO_COL*f*s;
  const FX = x => ox + DX + x, FY = y => DY + y;                     // coordenadas del plano de referencia (escala 1)
  const SY = y => DY + BUS + y*s;                                    // y relativo a la barra, con la escala
  let borde = LIM_IZQ + (util - N*P)/2;
  cols.forEach(c=>{
    const n = verticales(c);
    if(c.tipo==="trafo"){ c.ramasX = c.ramas.map((_, j)=>borde + (j + 0.5)*P); c.eje = c.ramasX[Math.max(0, Math.min(c.n-1, c.n-2))]; }
    else c.eje = borde + P/2;
    c.izq = borde; c.der = borde + n*P; borde += n*P;
  });
  // barra principal: de la primera a la última bajada (el control con segunda fuente no cuelga de ella); la acometida
  // llega al centro de la barra, entre dos verticales (si el centro cae sobre una bajada, se corre media separación)
  const ejes = cols.filter(c=>!c.externa).map(c=>c.eje);
  let xAcom = null;
  if(primera){
    if(!ejes.length) xAcom = LIM_IZQ + util/2;
    else if(ejes.length===1) xAcom = ejes[0] + P/2;
    else {
      // entre dos verticales: tampoco sobre una derivación del control interno (parecería que la alimenta)
      const todas = cols.flatMap(c=>c.tipo==="trafo" ? c.ramasX : [c.eje]);
      xAcom = (Math.min(...ejes) + Math.max(...ejes))/2; if(todas.some(e=>Math.abs(e - xAcom) < P*0.3)) xAcom += P/2;
    }
  }
  // la acometida y sus accesorios (sobre la barra) no deben salirse del tablero por la derecha
  const conRet = !!(acc.luces || acc.spd);
  const xIni = Math.min(...ejes, xAcom ?? Infinity), xFin = Math.max(...ejes, xAcom ?? -Infinity);
  const derCols = cols.length ? cols[cols.length-1].der : borde;
  // retorno a tierra de luces piloto y supresor: baja a la derecha, fuera de la barra y de las columnas
  const xRet = conRet ? Math.max(xAcom + 265.43*s, derCols + 6) : null;
  const derTablero = Math.max(DER, (xRet ?? derCols) + 10, derCols + 8);
  const usados = new Set(["tierra"]);

  // tablero (envolvente), título y potencias
  doc.polyline([[FX(IZQ), SY(FONDO)], [FX(IZQ), FY(BUS+TECHO)], [FX(derTablero), FY(BUS+TECHO)], [FX(derTablero), SY(FONDO)], [FX(IZQ), SY(FONDO)]], "E-EQ");
  pieza(doc, kit, "titulo", FX(IZQ), FY(BUS+TECHO), { vars:{ tit1:`${t.nombre||"Tablero"} ${t.tag||""}`.toUpperCase(), tit2:`${g.voltage} Vac, 3F+T, ${g.freq}Hz` } });
  pieza(doc, kit, "pimd", FX(derTablero), FY(BUS+TECHO), { vars:{ pi:`PI: ${r2(calc.installedKVA,1)} kVA`, md:`MD: ${r2(calc.totalKVA,2)} kVA` } });

  // barra principal y su rotulado (dos líneas sobre la barra, desde su inicio)
  if(isFinite(xIni) && isFinite(xFin)){
    doc.line(FX(xIni), SY(0), FX(xFin), SY(0), "E-FZA-BT-PRI");
    const hb = 2.5*s;
    doc.text(FX(xIni) + 3*s, SY(0) + 2.4*s + hb*1.6, hb, `R,S,T ${g.voltage} Vac, 3F, ${g.freq}Hz, ${g.faultLevel} kA`, "G-TEX");
    doc.text(FX(xIni) + 3*s, SY(0) + 2.4*s, hb, barraCu(calc.mainBreaker), "G-TEX");
    if(!primera) doc.text(FX(xIni)-2, SY(0)+3*s, 2.2*s, `VIENE DE LA HOJA ${ih}`, "G-TEX", { halign:2 });
    if(ih < nh-1) doc.text(FX(xFin)+2, SY(0)+3*s, 2.2*s, `CONTINÚA EN LA HOJA ${ih+2}`, "G-TEX");
  }

  // acometida y accesorios (primera lámina del tablero)
  if(primera){
    const ax = FX(xAcom), ay = SY(0);
    usados.add("mccb3");
    pieza(doc, kit, "acometida", ax, ay, { s, omitir:[[-35, 143, 33, 172]], vars:{ q:"Q1", qv:`3x${calc.mainBreaker}A`, barra: barraCu(calc.mainBreaker), acometida:"" } });
    // recuadro de procedencia con la forma común de las acometidas (embudo desde sus esquinas) y la tensión de llegada
    cajaAcometida(doc, ax - 0.7*s, ay + 144.4*s, s, `VIENE DE ${String(desdeTxt(p, t)||"").toUpperCase()}\n3x${g.voltage} Vac + T - ${g.freq} Hz`);
    // fusibles con la misma numeración del multifilar y del arreglo mecánico
    const fa = fusiblesAcometida(acc);
    if(acc.luces){ usados.add("fus3").add("luz"); pieza(doc, kit, "acc_lt", ax, ay, { s, vars:{ f:fa.luces.join(","), fv:"1X4A", fm:"E91/32", cable:"3C#14AWG+14AWG(N) 0.6/1kV", dev:"LT1,LT2,LT3", rango:"40-600Vac" } }); }
    if(acc.spd){ usados.add("fus3").add("spd"); pieza(doc, kit, "acc_spd", ax, ay, { s, vars:{ f:"-FS1", fv:"3x125A", cable:"3C#10AWG+10AWG(T) 0.6/1kV", dev:"SPD1,SPD2,SPD3", tipo:"TIPO 1 y 2", mod: sinMarca(modeloEnMarca(`OVR T1 T2 3L 12.5-${g.voltage>440 ? 600 : 440} P QS`, "", marcasProyecto(p))) } }); }
    if(acc.releFase){ usados.add("fus3").add("rf"); pieza(doc, kit, "acc_rf", ax, ay, { s, vars:{ f:fa.rf.join(","), fv:"1X2A", fm:"E91/32", cable:"3C#14AWG+14AWG(T) 0.6/1kV", dev:"RF", mod: sinMarca(modeloEnMarca("CM-MPS.41S", "", marcasProyecto(p))) } }); }
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
      usados.add("itm2");
      const dc = c.ctrlTipo==="Vdc", vC = c.ctrlV || parseFloat(g.ctrlVoltage) || 120;
      if(c.externa){
        // segunda fuente: la acometida externa llega directo al interruptor general de control (sin fusibles ni transformador)
        pieza(doc, kit, "trafo", x, y, { s, vars:c.vars, omitir:[[-9, -60, 30, 1]] });
        doc.line(x, SY(-36), x, SY(-58.59), "E-FZA-BT-SEC");
        cajaAcometida(doc, x, SY(-36), s, `VIENE DE ${String(c.desde || "SEGUNDA FUENTE").toUpperCase()}\n${vC===220 ? "2x220 Vac + T" : `1x${vC} ${dc ? "Vdc" : "Vac + N + T"}`} - ${g.freq} Hz`, { n:22 });
      } else {
        usados.add("fus1").add("trafo");
        pieza(doc, kit, "trafo", x, y, { s, vars:c.vars });
      }
      const x0 = FX(c.ramasX[0]), x1 = FX(c.ramasX[c.ramasX.length-1]);
      doc.line(Math.min(x0, x), SY(SUB), Math.max(x1, x), SY(SUB), "E-FZA-BT-SEC");
      // barra del control interno: «R,S 220 VAC, 1F, 60Hz, 10 KA» (fase-fase) o «L,N 120 VAC…» (fase-neutro)
      const sb = dc ? `L+,L- ${vC} VDC` : `${vC >= 200 ? "R,S" : "L,N"} ${vC} VAC, 1F, ${g.freq}Hz, 10 KA`;
      pieza(doc, kit, "trafo_txt", x0, SY(SUB), { s, vars:{ sb } });
      c.ramas.forEach((r,i)=>{
        if(r.tipo==="rama_id") usados.add("id");
        pieza(doc, kit, r.tipo, FX(c.ramasX[i]), SY(SUB), { s, vars:r.vars, texto: tx => /^ID1\n/.test(tx) ? `${r.vars.id}\n${r.vars.idv}\n${r.vars.idm}` : tx });
        descripcion(doc, FX(c.ramasX[i]), SY(-271), [r.vars.desc], s, P);
      });
    } else {
      const om = (c.omitir||[]);
      usados.add(c.mcb ? "mcb3" : c.tipo==="col_mcp" ? "gm" : "mccb3");
      if(c.tipo==="col_mcp") usados.add("contactor").add("motor");
      else { for(const k of ["fusible","filtro","vfd","motor"]) if(!om.includes(k)) usados.add({ fusible:"fus3", filtro:"filtro", vfd: c.vars.vfdtxt==="AS" ? "as" : "vfd", motor:"motor" }[k]); }
      pieza(doc, kit, c.tipo, x, y, { s, vars:c.vars, omitir: om.map(k=>OMITIR[k]) });
      descripcion(doc, x, SY(om.includes("motor") ? -271 : -287), [c.vars.desc, c.vars.tag], s, P);
      // donde se omite un equipo, el conductor continúa
      for(const k of om){ const pz = PUENTES[k]; if(pz) doc.line(x, y+pz[0]*s, x, y+pz[1]*s, "E-FZA-BT-PRI"); }
    }
  }
  // leyenda: solo los símbolos que aparecen en esta lámina
  leyenda(doc, kit, FX(656.5), FY(631.8), usados);

  // barra de tierra y pozo a tierra
  const xT = Math.max(...cols.flatMap(c=>c.tipo==="trafo" ? [c.eje, ...c.ramasX] : [c.eje]), xRet ?? -Infinity, 40);
  pieza(doc, kit, "tierra", FX(20.8), SY(TIERRA), { s });
  doc.line(FX(20.8), SY(TIERRA), FX(xT), SY(TIERRA), "E-TIERRA");
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
  ["id", { fila:3 }], ["fus1", { fila:4 }], ["fus3", { fila:5 }], ["luz", { fila:6 }], ["spd", { fila:7 }], ["rf", { fila:8 }],
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
function leyenda(doc, kit, x, y, usados){
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
  pieza(doc, { piezas:{ _ley:{ e:ents } } }, "_ley", x, y);
}

/* Ingenia — generadores de planos (DXF R12, texto ANSI_1252).
   Cada generador recibe un contexto { p, vals(hoja) , cliente } y devuelve { dxf, hojas }.
   Estilo, capas y disposición de una ingeniería de detalle usual de E&I. */
import { DXFDoc, buildUnifilarDXF, dxfTrunc, symBreaker, symFuse, symGroundSmall, symGroundElectrode, symTransformer } from "../engine/tablero-core.js";
import { dibujarLamina, PASO_HOJAS } from "./formato.js";
import { funcionISA, datos, calcularTablero, calcularTodos, circuitosControl, instrumentos, esAnalogico, esSalida, expandirTag, tipoInstrumento, sistemaTag, sistemaNombre,
  tableros, tablerosPotencia, tablerosControl, tableroDeInstrumento, tableroPorId, tf, tc, desdeTxt, esControl, esFuerza } from "../datos.js";
import { procesarFilas } from "../modules/tablas.js";
import { valoresDiseno, tensionControlTxt, controlEnDC } from "../modules/criterios.js";
import { GENERADORES2 } from "./planos2.js";
import { unifilarKit } from "./plano-unifilar.js";
import { unifilarControlKit } from "./plano-unifilar-control.js";
import { arquitecturaKit } from "./plano-arquitectura.js";
import { equiposControl } from "../control/equipos.js";
import { pidKit } from "./plano-pid.js";

/* ---------- utilidades de dibujo ---------- */
const T = (doc, x, y, h, s, layer, opt) => { if(s!=null && s!=="") doc.text(x, y, h, dxfTrunc(String(s), (opt&&opt.n)||80), layer||"G-TEXT", opt||{}); };
const R = (doc, x, y, w, h, layer) => doc.rect(x, y, w, h, layer||"G-VARIOS");
const L = (doc, x1, y1, x2, y2, layer) => doc.line(x1, y1, x2, y2, layer||"G-VARIOS");
function wrap(s, n){ const out=[]; let cur=""; for(const w of String(s||"").split(/\s+/)){ if((cur+" "+w).trim().length>n){ if(cur) out.push(cur); cur=w; } else cur=(cur+" "+w).trim(); } if(cur) out.push(cur); return out; }
function Tw(doc, x, y, h, s, n, layer, opt){ wrap(s, n).forEach((ln,i)=>T(doc, x, y - i*h*1.45, h, ln, layer, Object.assign({ n: n+20 }, opt||{}))); }
function flecha(doc, x, y, dir, s, layer){ // flecha rellena (SOLID no: líneas) hacia abajo/derecha
  s = s||2.2;
  if(dir==="abajo") doc.polyline([[x-s*0.45,y+s],[x,y],[x+s*0.45,y+s]], layer);
  else if(dir==="derecha") doc.polyline([[x-s,y+s*0.45],[x,y],[x-s,y-s*0.45]], layer);
  else if(dir==="izquierda") doc.polyline([[x+s,y+s*0.45],[x,y],[x+s,y-s*0.45]], layer);
}
function laminas(doc, n, valsDe, cliente){
  const areas = [];
  for(let i=0;i<n;i++) areas.push(dibujarLamina(doc, i*PASO_HOJAS, 0, valsDe(i, n), cliente));
  return areas;
}
function tablaLeyenda(doc, x, y, w, filas, titulo){
  const rh = filas.some(f=>f.sim) ? 10 : 7;
  R(doc, x, y - rh*(filas.length+1), w, rh*(filas.length+1), "G-VARIOS");
  T(doc, x + w/2, y - 5, 2.8, titulo||"LEYENDA", "G-TEXT", { halign:1 });
  filas.forEach((f,i)=>{
    const yy = y - rh*(i+1);
    L(doc, x, yy, x+w, yy, "G-VARIOS");
    if(f.sim){ L(doc, x+30, yy, x+30, yy-rh, "G-VARIOS"); f.sim(x+15, yy-rh/2); T(doc, x+34, yy-rh/2-1, 2.2, f.texto, "G-TEXT", { n:48 }); }
    else if(f.layer){ L(doc, x+4, yy-rh/2, x+30, yy-rh/2, f.layer); T(doc, x+34, yy-rh/2-1, 2.2, f.texto, "G-TEXT", { n:48 }); }
    else T(doc, x+4, yy-rh/2-1, 2.2, f.texto, "G-TEXT", { n:60 });
  });
  return y - rh*(filas.length+1);
}

/* =====================================================================================
   1) DIAGRAMA UNIFILAR DEL TABLERO DE FUERZA (motor validado de la herramienta de tableros)
   ===================================================================================== */
export function unifilarFuerza({ p, valsDe, cliente }){
  const calcs = calcularTodos(p);
  const lista = calcs.length ? calcs : [calcularTablero(p, tf(p))];
  const doc = new DXFDoc();
  lista.forEach((calc, i)=>{
    const t = calc.tablero;
    let area = null;
    buildUnifilarDXF(calc, { doc, titulo:`${(t.nombre||"TABLERO").toUpperCase()} ${t.tag}`, subtitulo:`${calc.g.voltage} Vac, 3F+T, ${calc.g.freq} Hz · Icc ${calc.g.faultLevel} kA`, acometida:"VIENE DE "+desdeTxt(p, t).toUpperCase(),
      dibujarFormato: d => (area = dibujarLamina(d, i*PASO_HOJAS, 0, valsDe(i, lista.length, { TITULO2: `${(t.nombre||"").toUpperCase()} ${t.tag}` }), cliente)) });
    // accesorios del tablero (SPD, relé de supervisión de fases, luces piloto), como en el unifilar de referencia
    const acc = t.accesorios || {};
    const lst = [acc.spd && ["SPD", `SUPRESOR DE SOBRETENSIONES TIPO 1+2, ${calc.g.voltage} V`], acc.releFase && ["RF", "RELÉ DE SUPERVISIÓN DE FASES (FALLA / SECUENCIA / U< U>)"], acc.luces && ["LT", "LUCES PILOTO R-S-T (PRESENCIA DE TENSIÓN)"]].filter(Boolean);
    if(area && lst.length){
      const x0 = area.x1 - 175, y0 = area.y1 - 12;
      T(doc, x0, y0, 2.6, "ACCESORIOS DE LA ACOMETIDA:", "G-TEXT");
      lst.forEach(([tg, tx], k)=>{ const y = y0 - 7 - k*7; R(doc, x0, y-2.5, 9, 5, "E-EQ"); T(doc, x0+4.5, y-1, 2.0, tg, "G-TEXT", { halign:1 }); T(doc, x0+12, y-1, 2.1, tx, "G-TEXT", { n:62 }); });
    }
  });
  return { dxf: doc.toDXF(), hojas: lista.length, calc: lista[0] };
}

/* =====================================================================================
   3) DIAGRAMAS DE LAZO : CAMPO | TABLERO DE CONTROL | SOFTWARE
   ===================================================================================== */
export function lazos({ p, valsDe, cliente }){
  const d = datos(p), st = sistemaTag(p);
  const io = procesarFilas("ins-io", d["ins-io"]||[], p);
  const lazosL = [];
  for(const i of instrumentos(p)){
    const tb = tableroDeInstrumento(p, i);
    if(/^\s*N\.?\s*A\.?\s*$/i.test(i.tipoSenal||"") && !/^XV|^SV/.test(tipoInstrumento(i.tag))) continue;   // indicadores locales: sin lazo
    for(const tag of expandirTag(i.tag)){
      if(!tag) continue;
      const a = esAnalogico(i), out = esSalida(i);
      const sig = io.find(f=>f.tag===tag) || {};
      lazosL.push({ tag, i, analog:a, salida:out, io: sig, tb });
    }
  }
  const porHoja = 7;
  // páginas: los lazos de cada tablero de control empiezan en una lámina nueva
  const paginas = []; const orden = [...new Set(lazosL.map(l=>l.tb))];
  for(const tb of orden){ const ls = lazosL.filter(l=>l.tb===tb); for(let k=0;k<ls.length;k+=porHoja) paginas.push({ tb, ls: ls.slice(k,k+porHoja) }); }
  if(!paginas.length) paginas.push({ tb: tc(p), ls: [] });
  const nH = paginas.length;
  // equipos del tablero de control (mismos TAG del unifilar / multifilar / mecánico): módulo, fusible o ITM y relé de cada lazo
  const eqDe = new Map(); const eqT = t => { if(!eqDe.has(t.id)){ try{ eqDe.set(t.id, equiposControl(p, t)); }catch(e){ eqDe.set(t.id, null); } } return eqDe.get(t.id); };
  const rx = tg => new RegExp(`(^|[^A-Z0-9])${tg.replace(/[.*+?^${}()|[\]\\-]/g,"\\$&")}$`, "i");
  const ligas = lz => { const eq = eqT(lz.tb); if(!eq) return {};
    return { mod: eq.plc.modulos.find(m=>m.senales.some(s=>s.tag===lz.tag)), circ: eq.circuitos.find(c=>rx(lz.tag).test(c.descripcion||"")), rele: eq.reles.find(r=>r.senal && r.senal.tag===lz.tag), limp: eq.limpieza && eq.limpieza.senales.some(s=>s.tag===lz.tag) ? eq.limpieza.tag : null }; };
  const doc = new DXFDoc();
  const areas = laminas(doc, nH, valsDe, cliente);
  areas.forEach((A, hi)=>{
    const tc = paginas[hi].tb;
    const W = A.x1-A.x0, top = A.y1;
    const xT = A.x0 + W*0.29, xS = A.x0 + W*0.82, xPLC = A.x0 + W*0.775;
    // encabezado de columnas
    L(doc, A.x0, top-15, A.x1, top-15, "G-VARIOS");
    L(doc, xT, top, xT, A.y0+60, "G-VARIOS"); L(doc, xS, top, xS, A.y0+60, "G-VARIOS");
    T(doc, (A.x0+xT)/2, top-9, 2.6, "CAMPO"+(st?" - "+st:""), "G-TEXT", { halign:1 });
    T(doc, (xT+xS)/2, top-7.5, 2.6, "TABLERO DE CONTROL", "G-TEXT", { halign:1 }); T(doc, (xT+xS)/2, top-11.5, 2.4, tc.tag||"", "G-TEXT", { halign:1 });
    T(doc, (xS+A.x1)/2, top-9, 2.6, "SOFTWARE", "G-TEXT", { halign:1 });
    // tarjeta del controlador
    const filasH = paginas[hi].ls;
    const rowH = 64;
    const yTopRows = top - 30;
    R(doc, xPLC-8, yTopRows - rowH*porHoja + 20, 16, rowH*porHoja + 4, "I-EQ");
    T(doc, xPLC, yTopRows+7, 2.2, (tc.modeloPlc||"PLC").slice(0,16), "G-TEXT", { halign:1 });
    filasH.forEach((lz, k)=>{
      const yc = yTopRows - k*rowH;
      const xF = A.x0 + 22;
      const letras = tipoInstrumento(lz.tag);
      const num = lz.tag.replace(/^[A-Z]+-?/,"");
      // instrumento de campo (burbuja ISA)
      doc.circle(xF, yc, 6.5, "I-SIM"); L(doc, xF-6.5, yc, xF+6.5, yc, "I-SIM");
      T(doc, xF, yc+1.6, 2.3, letras, "I-SIM", { halign:1 }); T(doc, xF, yc-3.6, 2.0, num, "I-SIM", { halign:1 });
      const ac0 = /120|220/.test(lz.i.alimentacion||""); const nh = lz.analog ? 3 : (lz.salida ? 3 : 6);
      const yTxt = Math.min(yc-11, yc + 8 - (nh-1)*4.2 - 6);
      T(doc, xF-8, yTxt, 2.0, (lz.i.descripcion||"").toUpperCase(), "G-TEXT", { n:34 });
      T(doc, xF-8, yTxt-3.5, 1.8, st ? st.replace(/-/g,"")+"-"+lz.tag : lz.tag, "G-TEXT", { n:36 });
      const ac = /120|220/.test(lz.i.alimentacion||"");
      const hilos = lz.analog ? (ac ? [["L","N"],["+","-"],["SH"]].flat() : ["P1+","P1-","SH"]) : (lz.salida ? ["1","2","GND"] : ["1","2","3","4","5","GND"]);
      const capaS = lz.analog ? "I-SE-ANALO" : (ac ? "I-FZA-AC" : "I-CONTROL");
      const x1 = xF + 14, x2 = xT + 60, x3 = xT + 95;
      const dy = 4.2;
      const lg = ligas(lz);
      // bornes del listado I/O (p. ej. «TB6:1 / TB6:2»): los dos primeros conductores de señal van a esos bornes
      const bornes = String((lz.io && lz.io.terminales) || "").split("/").map(x=>x.trim()).filter(x=>/:/.test(x));
      const tbTag = bornes.length ? bornes[0].split(":")[0] : "";
      hilos.forEach((h, j)=>{
        const y = yc + 8 - j*dy;
        const capa = h==="SH"||h==="GND" ? "I-TIERRA" : capaS;
        L(doc, x1, y, x2, y, capa);
        T(doc, x1+1, y+0.6, 1.8, h, "G-TEXT");
        T(doc, x2+1.5, y+0.6, 1.8, bornes[j] ? bornes[j].split(":")[1] : (h==="SH"||h==="GND" ? "PE" : String(j+1)), "G-TEXT");
        L(doc, x2+5, y, x3, y, capa);
      });
      const yb = yc + 8 - (hilos.length-1)*dy;
      doc.polyline([[x1+8,yc+9.5],[x1+6.5,(yc+8+yb)/2],[x1+8,yb-1.5]], "G-VARIOS");
      doc.polyline([[x2-6,yc+9.5],[x2-4.5,(yc+8+yb)/2],[x2-6,yb-1.5]], "G-VARIOS");
      const cableTag = (st ? st.replace(/-/g,"") : "") + lz.tag.replace(/-/g,"") + (lz.analog ? "-J01" : "-C01");
      const spec = lz.analog ? "1-1Pr#16AWG+SH" : (lz.salida ? "1-3C#14AWG+T" : "1-5C#14AWG+T");
      T(doc, (x1+x2)/2 - 25, yc+11, 2.1, cableTag, "G-TEXT"); T(doc, (x1+x2)/2 - 25, yc+8.6, 1.9, spec, "G-TEXT");
      // borneras y alimentación en tablero
      const pw = lz.analog ? (ac ? lz.i.alimentacion : "24 Vdc") : (/24/.test(lz.i.alimentacion||"") ? "24 Vdc" : (lz.i.alimentacion||"120 Vac"));
      T(doc, x3+2, yc+8.6, 2.0, pw + (lg.circ ? `  (${lg.circ.tag}${lg.circ.borne && /^XF/.test(lg.circ.borne) ? " · "+lg.circ.borne : ""})` : lg.limp ? `  (${lg.limp})` : ""), "G-TEXT");
      if(tbTag) T(doc, x2 + 2.5, yc + 11.2, 2.0, tbTag, "G-TEXT", { halign:1 });
      T(doc, x3+2, yb+0.6, 2.0, lz.analog && !ac ? "0 Vdc" : "PE", "G-TEXT");
      // señal al controlador
      const ys = yc + 8 - dy;
      L(doc, x3, ys, xPLC-8, ys, capaS);
      const io = lz.io; const canal = io.tipo ? (io.slot!=="" && io.slot!=null ? `${lg.mod ? lg.mod.tag+"  " : io.tipo+"  "}S${io.slot}:CH${io.ch}` : `${io.tipo}  ${io.tablero||""}`) : (lz.analog ? "AI" : lz.salida ? "DO" : "DI");
      if(lg.rele) T(doc, xPLC-36, ys-2.8, 1.9, `RELÉ ${lg.rele.tag} (${lg.rele.contacto})`, "G-TEXT");
      T(doc, xPLC-36, ys+1, 2.0, canal, "G-TEXT");
      // software: bloque de función en el controlador (cuadro con rombo)
      const xs = xS + 18, ysw = yc;
      R(doc, xs-6, ysw-6, 12, 12, "I-SIM"); doc.polyline([[xs,ysw+6],[xs+6,ysw],[xs,ysw-6],[xs-6,ysw],[xs,ysw+6]], "I-SIM");
      const fn = lz.analog ? funcionISA(lz.tag, "AI") : (lz.salida ? letras.replace(/V$/,"Y") : funcionISA(lz.tag, "DI"));
      T(doc, xs+9, ysw+1, 2.0, fn+"-"+num, "G-TEXT"); T(doc, xs+9, ysw-2.6, 1.8, st||"", "G-TEXT");
      Tw(doc, xs-6, ysw+12, 2.0, (lz.i.servicio||lz.i.descripcion||"").toUpperCase(), 34, "G-TEXT");
      L(doc, xPLC+8, ys, xs-6, ysw, "I-DAT");
    });
    // leyenda de conexión y notas
    const lx = A.x0 + W*0.45, ly = A.y0 + 54;
    tablaLeyenda(doc, lx, ly, 120, [
      { layer:"I-FZA-AC", texto:"Línea de fuerza 120 Vac" }, { layer:"I-FZA-DC", texto:"Línea de fuerza 24 Vdc" }, { layer:"I-TIERRA", texto:"Línea de tierra" },
      { layer:"I-CONTROL", texto:"Línea de control" }, { layer:"I-SE-ANALO", texto:"Línea de instrumentación" }, { layer:"I-DAT", texto:"Límite de data y comunicación" } ], "LEYENDA DE CONEXIÓN");
    T(doc, A.x0+4, A.y0+52, 2.4, "NOTAS:", "G-TEXT");
    Tw(doc, A.x0+4, A.y0+47, 2.0, "1. ES RESPONSABILIDAD DEL USUARIO DE ESTE PLANO ASEGURARSE DE USAR LA ÚLTIMA REVISIÓN DE LA LISTA DE E/S Y DEL LISTADO DE INSTRUMENTOS.", 80, "G-TEXT");
    Tw(doc, A.x0+4, A.y0+38, 2.0, "2. CANALES (SLOT/CH) ASIGNADOS AUTOMÁTICAMENTE DESDE LA LISTA DE E/S DEL PROYECTO.", 80, "G-TEXT");
  });
  return { dxf: doc.toDXF(), hojas:nH, lazos: lazosL.length };
}

/* =====================================================================================
   5) DIAGRAMA DE BLOQUES ELÉCTRICO 
   ===================================================================================== */
export function bloques({ p, valsDe, cliente }){
  const d = datos(p), v = valoresDiseno(p), st = sistemaTag(p);
  const doc = new DXFDoc();
  const [A] = laminas(doc, 1, valsDe, cliente);
  const W = A.x1 - A.x0;
  const caja = (x, y, w, h, t1, t2, capa)=>{ R(doc, x, y, w, h, capa||"E-EQ"); R(doc, x, y+h-10, Math.min(w, 60), 10, capa||"E-EQ"); T(doc, x+3, y+h-4.5, 2.3, t1, "G-TEXT", { n:Math.max(12, Math.floor(w/1.9)) }); if(t2) T(doc, x+3, y+h-8.3, 2.1, t2, "G-TEXT", { n:40 }); };
  const calcs = new Map(tablerosPotencia(p).map(t=>[t, calcularTablero(p, t)]));
  const campoDe = t => { const out = []; for(const i of instrumentos(p)) if(tableroDeInstrumento(p, i).id===t.id && /120|220/.test(i.alimentacion||"")) for(const tag of expandirTag(i.tag)) if(tag) out.push({ tag, i }); return out; };
  // columnas: tableros de fuerza / fuerza y control y tableros de control, con sus equipos de campo
  const cols = [];
  for(const t of tableros(p)){
    if(t.tipo==="distribucion") continue;
    const cargas = calcs.has(t) ? calcs.get(t).circuits.filter(c=>c.kind==="motor" || c.kind==="feeder") : [];
    const campo = esControl(t) ? campoDe(t) : [];
    cols.push({ t, cargas, campo, n: Math.max(cargas.length + campo.length, 2) });
  }
  const dist = tableros(p).filter(t=>t.tipo==="distribucion");
  const huerf = dist.filter(D=>!cols.some(c=>c.t.desde===D.id));
  const gap = 22;
  const units = cols.reduce((a,c)=>a+c.n, 0) + huerf.length*2;
  const pitch = Math.min(46, (W - 20 - gap*(cols.length+huerf.length)) / Math.max(units,1));
  let x = A.x0 + 6;
  for(const c of cols){ c.x = x; c.w = Math.max(60, c.n*pitch + 12); x += c.w + gap; }
  const hasTD = dist.length > 0;
  const ySrc = A.y1 - 34, yTD = ySrc - 72, yTF = (hasTD ? yTD : ySrc) - 96;
  // tableros de distribución sobre sus tableros hijos
  const posD = new Map();
  for(const D of dist){
    const hijos = cols.filter(c=>c.t.desde===D.id);
    let x0, x1;
    if(hijos.length){ x0 = Math.min(...hijos.map(c=>c.x)); x1 = Math.max(...hijos.map(c=>c.x+c.w)); } else { x0 = x; x1 = x + 70; x += 70 + gap; }
    posD.set(D.id, { x0, x1 });
    caja(x0, yTD, x1-x0, 30, `${(D.nombre||"TABLERO DE DISTRIBUCIÓN").toUpperCase()} ${D.tag}`, `${v.tension} Vac`);
    const cd = calcs.get(D);
    for(const h of hijos){
      const xc = h.x + h.w/2;
      L(doc, xc, yTD, xc, yTF+36, "E-FZA");
      const circ = cd && cd.circuits.find(c=>c.load._tablero===h.t);
      const m = circ && circ.conductorMemo;
      T(doc, xc+1.5, yTD-12, 1.9, (h.t.cableTag || h.t.tag.replace(/-/g,"")+"-P01"), "G-TEXT");
      if(m && m.cable) T(doc, xc+1.5, yTD-15.5, 1.8, "1-3C#"+String(m.cable[0]).replace(/\s/g,"")+"+T", "G-TEXT");
    }
  }
  // alimentación externa (raíces)
  const raices = tableros(p).filter(t=>t.tipo!=="control" && !(t.desde && tableroPorId(p, t.desde)));
  const fuentes = [...new Set(raices.map(t=>desdeTxt(p, t)))];
  const xr0 = A.x0 + 6, xr1 = Math.max(x - gap, A.x0 + 200);
  caja(xr0, ySrc, xr1 - xr0, 26, ("ALIMENTACIÓN: "+(fuentes.join(" / ")||"EXISTENTE")).toUpperCase(), `${v.tension} Vac, 3F, ${v.frecuencia} Hz`, "G-VARIOS");
  for(const r of raices){
    let xc, ytop;
    if(r.tipo==="distribucion"){ const pd = posD.get(r.id); xc = (pd.x0+pd.x1)/2; ytop = yTD+30; }
    else { const c = cols.find(c=>c.t===r); if(!c) continue; xc = c.x + c.w/2; ytop = yTF+36; }
    L(doc, xc, ySrc, xc, ytop, "E-FZA");
    const mc = calcs.get(r) && calcs.get(r).mainCond;
    T(doc, xc+1.5, ySrc-10, 1.9, r.tag.replace(/-/g,"")+"-P01", "G-TEXT");
    if(mc && mc.cable) T(doc, xc+1.5, ySrc-13.5, 1.8, (mc.sets>1?mc.sets+"x":"1-")+"3C#"+String(mc.cable[0]).replace(/\s/g,"")+"+T", "G-TEXT");
  }
  // tableros y sus cargas / equipos de campo
  for(const c of cols){
    const t = c.t;
    caja(c.x, yTF, c.w, 36, (t.nombre||"").toUpperCase(), t.tag, t.tipo==="control" ? "I-EQ" : "E-EQ");
    const items = [...c.cargas.map(x=>({ k:"f", c:x })), ...c.campo.map(x=>({ k:"c", e:x }))];
    items.forEach((it, k)=>{
      const xx = c.x + 6 + pitch*(k+0.5);
      if(it.k==="f"){
        const cc = it.c, cm = cc.conductorMemo, l = cc.load;
        const tagEq = l._tablero ? l._tablero.tag : (l.tag||cc.tag);
        L(doc, xx, yTF, xx, yTF-70, "E-FZA");
        T(doc, xx+1, yTF-14, 1.7, (l.cableTag || String(tagEq).replace(/-/g,"")+"-P01"), "G-TEXT", { rot:90 });
        if(cm && cm.cable) T(doc, xx+3.6, yTF-14, 1.6, "1-3C#"+String(cm.cable[0]).replace(/\s/g,"")+"+T", "G-TEXT", { rot:90 });
        R(doc, xx-5.5, yTF-125, 11, 55, "E-EQ"); T(doc, xx+1.2, yTF-122, 2.2, tagEq, "G-TEXT", { rot:90, n:24 });
        Tw(doc, xx-pitch/2+1, yTF-131, 1.9, (l.desc||cc.title||"").toUpperCase(), Math.max(8, Math.floor(pitch/1.2)), "G-TEXT");
      } else {
        const e = it.e;
        L(doc, xx, yTF, xx, yTF-70, "E-CONTROL");
        T(doc, xx+1, yTF-14, 1.6, (st?st.replace(/-/g,""):"")+e.tag.replace(/-/g,"")+"-C01", "G-TEXT", { rot:90 });
        R(doc, xx-5.5, yTF-125, 11, 55, "I-EQ"); T(doc, xx+1.2, yTF-122, 2.1, e.tag, "G-TEXT", { rot:90 });
        Tw(doc, xx-pitch/2+1, yTF-131, 1.8, (e.i.descripcion||"").toUpperCase(), Math.max(8, Math.floor(pitch/1.2)), "G-TEXT");
      }
    });
    // alimentación de los tableros de control desde su tablero de fuerza
    if(t.tipo==="control"){
      const src = cols.find(o=>o.t.id===t.desde) || cols.find(o=>esFuerza(o.t));
      if(src){ const y = yTF+15, xa = src.x+src.w, xb = c.x; if(xb>xa){ L(doc, xa, y, xb, y, "E-CONTROL"); T(doc, xa+2, y+1.5, 1.8, tensionControlTxt(v), "G-TEXT"); } else { L(doc, src.x+src.w-8, yTF+36, src.x+src.w-8, yTF+44, "E-CONTROL"); L(doc, src.x+src.w-8, yTF+44, c.x+8, yTF+44, "E-CONTROL"); L(doc, c.x+8, yTF+44, c.x+8, yTF+36, "E-CONTROL"); } }
    }
  }
  tablaLeyenda(doc, A.x1-150, A.y0+120, 140, [ { layer:"E-FZA", texto:`Cable de fuerza baja tensión (${v.tension} Vac)` }, { layer:"E-CONTROL", texto:`Cable de control, alimentación (${tensionControlTxt(v)})` } ], "LEYENDA");
  return { dxf: doc.toDXF(), hojas:1 };
}

export const GENERADORES = {
  ...GENERADORES2,
  "ele-unifilar": { fn: unifilarKit, titulo:"DIAGRAMA UNIFILAR DEL TABLERO DE FUERZA", disciplina:"ELECTRICIDAD" },
  "ins-unifilar-tc": { fn: unifilarControlKit, titulo:"DIAGRAMA UNIFILAR DEL TABLERO DE CONTROL", disciplina:"INSTRUMENTACIÓN Y CONTROL" },
  "ins-lazo": { fn: lazos, titulo:"DIAGRAMA DE LAZO", disciplina:"INSTRUMENTACIÓN Y CONTROL" },
  "ins-pid": { fn: pidKit, titulo:"DIAGRAMA DE PROCESO E INSTRUMENTACIÓN (P&ID)", disciplina:"INSTRUMENTACIÓN Y CONTROL" },
  "ins-arquitectura": { fn: arquitecturaKit, titulo:"ARQUITECTURA DEL SISTEMA DE CONTROL", disciplina:"INSTRUMENTACIÓN Y CONTROL" },
  "ins-bloques": { fn: bloques, titulo:"DIAGRAMA DE BLOQUES", disciplina:"ELECTRICIDAD, CONTROL E INSTRUMENTACIÓN" },
};

/* DXF → bytes ANSI_1252 (los textos ya vienen restringidos a Latin-1) */
export function dxfBytes(txt){ const out = new Uint8Array(txt.length); for(let i=0;i<txt.length;i++){ const c = txt.charCodeAt(i); out[i] = c<256 ? c : 63; } return out; }

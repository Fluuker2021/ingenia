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
import { lazoKit } from "./plano-lazo.js";

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
  "ins-lazo": { fn: lazoKit, titulo:"DIAGRAMA DE LAZO", disciplina:"INSTRUMENTACIÓN Y CONTROL" },
  "ins-pid": { fn: pidKit, titulo:"DIAGRAMA DE PROCESO E INSTRUMENTACIÓN (P&ID)", disciplina:"INSTRUMENTACIÓN Y CONTROL" },
  "ins-arquitectura": { fn: arquitecturaKit, titulo:"ARQUITECTURA DEL SISTEMA DE CONTROL", disciplina:"INSTRUMENTACIÓN Y CONTROL" },
  "ins-bloques": { fn: bloques, titulo:"DIAGRAMA DE BLOQUES", disciplina:"ELECTRICIDAD, CONTROL E INSTRUMENTACIÓN" },
};

/* DXF → bytes ANSI_1252 (los textos ya vienen restringidos a Latin-1) */
export function dxfBytes(txt){ const out = new Uint8Array(txt.length); for(let i=0;i<txt.length;i++){ const c = txt.charCodeAt(i); out[i] = c<256 ? c : 63; } return out; }

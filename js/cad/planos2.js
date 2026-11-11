/* Ingenia — planos de detalle generados desde los datos del proyecto (DXF R12, texto ANSI_1252):
   P&ID esquemático, multifilar de fuerza, conexionado de E/S del tablero de control (multifilar),
   disposición de equipos de los tableros (mecánico) y arreglos generales sobre la planta del cliente.
   Cada generador recibe { p, valsDe, cliente } y devuelve { dxf, hojas }. */
import { DXFDoc, dxfTrunc } from "../engine/tablero-core.js";
import { dibujarLamina, PASO_HOJAS } from "./formato.js";
import { datos, calcularTablero, instrumentos, expandirTag, tipoInstrumento, esAnalogico, esSalida, sistemaTag,
  tableros, tablerosPotencia, tablerosControl, tableroDeInstrumento, ipRecomendado } from "../datos.js";
import { procesarFilas } from "../modules/tablas.js";
import { valoresDiseno } from "../modules/criterios.js";
import { parseDXF } from "../dxf.js";
import * as S from "../store.js";

/* ---------- utilidades de dibujo ---------- */
const T = (doc, x, y, h, s, layer, opt) => { if(s!=null && s!=="") doc.text(x, y, h, dxfTrunc(String(s), (opt&&opt.n)||80), layer||"G-TEXT", opt||{}); };
const R = (doc, x, y, w, h, layer) => doc.rect(x, y, w, h, layer||"G-VARIOS");
const L = (doc, x1, y1, x2, y2, layer) => doc.line(x1, y1, x2, y2, layer||"G-VARIOS");
const C = (doc, x, y, r, layer) => doc.circle(x, y, r, layer||"G-VARIOS");
function discontinua(doc, x1, y1, x2, y2, layer, seg=3, gap=2){
  const d = Math.hypot(x2-x1, y2-y1); if(!d) return; const ux = (x2-x1)/d, uy = (y2-y1)/d;
  for(let s=0; s<d; s+=seg+gap){ const e = Math.min(d, s+seg); L(doc, x1+ux*s, y1+uy*s, x1+ux*e, y1+uy*e, layer); }
}
function arco(doc, cx, cy, r, a1, a2, layer){ layer = doc._layer(layer||"G-VARIOS"); doc.entities.push(`0\nARC\n8\n${layer}\n10\n${+cx.toFixed(3)}\n20\n${+cy.toFixed(3)}\n30\n0.0\n40\n${+r.toFixed(3)}\n50\n${+a1.toFixed(3)}\n51\n${+a2.toFixed(3)}`); }
function wrap(s, n){ const out=[]; let cur=""; for(const w of String(s||"").split(/\s+/)){ if((cur+" "+w).trim().length>n){ if(cur) out.push(cur); cur=w; } else cur=(cur+" "+w).trim(); } if(cur) out.push(cur); return out; }
function Tw(doc, x, y, h, s, n, layer, opt, maxL=3){ wrap(s, n).slice(0, maxL).forEach((ln,i)=>T(doc, x, y - i*h*1.45, h, ln, layer, Object.assign({ n: n+20 }, opt||{}))); }
function flecha(doc, x, y, s, layer){ doc.polyline([[x-s,y+s*0.45],[x,y],[x-s,y-s*0.45]], layer); }
const trozos = (arr, n) => { const out=[]; for(let i=0;i<arr.length;i+=n) out.push(arr.slice(i,i+n)); return out.length ? out : [[]]; };
const laminas = (doc, n, valsDe, cliente, extra) => Array.from({ length:n }, (_, i)=>dibujarLamina(doc, i*PASO_HOJAS, 0, valsDe(i, n, extra ? extra(i) : undefined), cliente));
function leyenda(doc, x, y, w, filas, titulo){
  const rh = 9; R(doc, x, y - rh*(filas.length+1), w, rh*(filas.length+1));
  T(doc, x + w/2, y - 6, 2.6, titulo||"LEYENDA", "G-TEXT", { halign:1 });
  filas.forEach((f,i)=>{ const yy = y - rh*(i+1); L(doc, x, yy, x+w, yy); L(doc, x+30, yy, x+30, yy-rh); f.sim(x+15, yy-rh/2); T(doc, x+34, yy-rh/2-1, 2.1, f.texto, "G-TEXT", { n:60 }); });
}
/* burbuja ISA 5.1: campo (círculo), función en el sistema de control (círculo en cuadrado con línea) */
function burbuja(doc, x, y, tag, tipo){
  const r = 6.5, letras = tipoInstrumento(tag) || String(tag).split("-")[0], num = String(tag).split("-").slice(1).join("-");
  if(tipo==="plc"){ R(doc, x-r, y-r, 2*r, 2*r, "I-SIM"); C(doc, x, y, r, "I-SIM"); L(doc, x-r, y, x+r, y, "I-SIM"); }
  else C(doc, x, y, r, "I-SIM");
  T(doc, x, y+1.3, letras.length>3 ? 1.8 : 2.2, letras, "G-TEXT", { halign:1, n:6 });
  T(doc, x, y-3.6, num.length>4 ? 1.6 : 2.0, num, "G-TEXT", { halign:1, n:8 });
}
function valvula(doc, x, y, layer){ doc.polyline([[x-4,y+2.5],[x+4,y-2.5],[x+4,y+2.5],[x-4,y-2.5],[x-4,y+2.5]], layer||"I-SIM"); L(doc, x, y, x, y+5, layer||"I-SIM"); R(doc, x-2.5, y+5, 5, 3.5, layer||"I-SIM"); }

/* =====================================================================================
   P&ID esquemático: equipos sobre la línea de proceso, instrumentos de campo (ISA 5.1) y su función en el PLC
   ===================================================================================== */
export function pid({ p, valsDe, cliente }){
  const d = datos(p), pr = d.proceso || {};
  let equipos = (pr.equipos||[]).filter(e=>e.tag || e.descripcion);
  if(!equipos.length) equipos = d.cargas.filter(l=>l.kind==="motor").map(l=>({ tag:l.tag, descripcion:l.desc }));
  if(!equipos.length) equipos = [{ tag:sistemaTag(p)||"", descripcion:(d.sistema.nombre||"PROCESO") }];
  const inst = []; for(const i of instrumentos(p)) for(const tag of expandirTag(i.tag)) if(tag) inst.push({ tag, i });
  const grupos = equipos.map(e=>({ e, inst:[] })); const libres = [];
  for(const x of inst){
    const txt = [x.i.equipo, x.i.ubicacion, x.i.servicio].join(" ").toUpperCase();
    const g = grupos.find(g=>(x.i.equipo && x.i.equipo===g.e.tag) || (g.e.tag && txt.includes(String(g.e.tag).toUpperCase())));
    (g ? g.inst : libres).push(x);
  }
  // instrumentos sin equipo asociado: se reparten en orden entre los equipos
  libres.forEach((x, k)=>grupos[k % grupos.length].inst.push(x));
  const doc = new DXFDoc();
  const ancho = g => Math.max(70, g.inst.length*26 + 16);
  // paginación: columnas por lámina según el ancho disponible (~760 mm útiles)
  const pag = []; let cur = [], w = 0;
  for(const g of grupos){ const a = ancho(g); if(cur.length && w + a > 740){ pag.push(cur); cur = []; w = 0; } cur.push(g); w += a; }
  pag.push(cur);
  const As = laminas(doc, pag.length, valsDe, cliente);
  pag.forEach((cols, h)=>{
    const A = As[h];
    const yPLC = A.y1 - 30, yCampo = A.y1 - 95, yEq = A.y0 + 175, yProc = yEq - 22;
    T(doc, A.x0+4, yPLC+14, 2.6, "SISTEMA DE CONTROL (PLC)", "G-TEXT");
    discontinua(doc, A.x0+2, yPLC-12, A.x1-2, yPLC-12, "I-OCU", 6, 3);
    T(doc, A.x0+4, yPLC-20, 2.6, "CAMPO", "G-TEXT");
    const extra = Math.max(0, (A.x1 - A.x0 - 200) - cols.reduce((t,g)=>t+ancho(g), 0)) / Math.max(1, cols.length);
    let x = A.x0 + 20;
    const xs = [];
    cols.forEach(g=>{
      const a = ancho(g) + extra, xc = x + a/2;
      // equipo
      const bw = Math.min(a-16, 56), bh = 40;
      R(doc, xc-bw/2, yEq-bh, bw, bh, "P-EQUIPO");
      T(doc, xc, yEq-bh/2+1, 2.6, g.e.tag || "—", "G-TEXT", { halign:1, n:20 });
      Tw(doc, xc-bw/2, yEq-bh-7, 2.1, String(g.e.descripcion||"").toUpperCase(), Math.max(10, Math.floor(bw/1.6)), "G-TEXT");
      xs.push([xc-bw/2, xc+bw/2]);
      // instrumentos: dos filas sobre el equipo
      g.inst.forEach((it, k)=>{
        const n = g.inst.length, fila = 0;
        const xi = xc - (n-1)*13 + k*26, yi = yCampo;
        burbuja(doc, xi, yi, it.tag, "campo");
        // conexión al proceso / equipo
        const yTop = yEq;
        if(esSalida(it.i)){ L(doc, xi, yi-6.5, xi, yTop+16, "I-SIM"); valvula(doc, xi, yTop+8); L(doc, xi, yTop+5.5, xi, yTop, "P-PROCESO"); }
        else L(doc, xi, yi-6.5, xi, yTop, "I-SIM");
        // función en el PLC + señal eléctrica
        const yp = yPLC;
        const tagPLC = (esAnalogico(it.i) ? tipoInstrumento(it.tag).replace(/T$/,"I").replace(/IT$/,"I") : esSalida(it.i) ? "HS" : tipoInstrumento(it.tag).replace(/S([HL]{1,2})$/,"A$1")) + "-" + String(it.tag).split("-").slice(1).join("-");
        burbuja(doc, xi, yp, tagPLC, "plc");
        discontinua(doc, xi, yp-6.5, xi, yi+6.5, esAnalogico(it.i) ? "I-SE-ANALO" : "I-CONTROL", 2.5, 1.5);
      });
      x += a;
    });
    // línea de proceso entre equipos (con sentido de flujo)
    if(xs.length){
      L(doc, A.x0+6, yProc, xs[0][0], yProc, "P-PROCESO"); flecha(doc, xs[0][0], yProc, 3, "P-PROCESO");
      for(let k=0;k<xs.length-1;k++){ L(doc, xs[k][1], yProc, xs[k+1][0], yProc, "P-PROCESO"); flecha(doc, xs[k+1][0], yProc, 3, "P-PROCESO"); }
      L(doc, xs[xs.length-1][1], yProc, Math.min(A.x1-160, xs[xs.length-1][1]+30), yProc, "P-PROCESO");
    }
    if(h===0) leyenda(doc, A.x1-155, A.y0+118, 150, [
      { sim:(x,y)=>burbuja(doc, x, y, "PIT-001", "campo"), texto:"Instrumento de campo (ISA 5.1)" },
      { sim:(x,y)=>burbuja(doc, x, y, "PI-001", "plc"), texto:"Función en el sistema de control (PLC)" },
      { sim:(x,y)=>discontinua(doc, x-12, y, x+12, y, "I-SE-ANALO", 2.5, 1.5), texto:"Señal eléctrica analógica (4-20 mA)" },
      { sim:(x,y)=>discontinua(doc, x-12, y, x+12, y, "I-CONTROL", 2.5, 1.5), texto:"Señal eléctrica discreta" },
      { sim:(x,y)=>{ L(doc, x-12, y, x+12, y, "P-PROCESO"); flecha(doc, x+12, y, 3, "P-PROCESO"); }, texto:"Línea de proceso" },
      { sim:(x,y)=>valvula(doc, x, y-3), texto:"Válvula de actuación (solenoide)" },
    ], "LEYENDA");
  });
  return { dxf: doc.toDXF(), hojas: pag.length };
}

/* =====================================================================================
   MULTIFILAR DEL TABLERO DE FUERZA: barras L1-L2-L3-PE, protección y maniobra por circuito, bornes y carga
   ===================================================================================== */
const DISPOSITIVO = /^(ITM|Interruptor|Guardamotor|Contactor|Rel[eé]|Variador|VDF|Arrancador|Filtro|Fusible|Portafusible|Seccionador|Transformador)/i;
function cajaTripolar(doc, xc, y, dev, layer){
  R(doc, xc-9, y-10, 18, 10, layer||"E-SIM");
  T(doc, xc, y-6.3, 2.0, dev.devtag, "G-TEXT", { halign:1, n:10 });
  T(doc, xc+10.5, y-3.5, 1.6, String(dev.comp||"").toUpperCase(), "G-TEXT", { n:24 });
  T(doc, xc+10.5, y-6.5, 1.6, dev.val && dev.val!=="—" ? dev.val : "", "G-TEXT", { n:24 });
}
export function multifilarFuerza({ p, valsDe, cliente }){
  const lista = tablerosPotencia(p).map(t=>calcularTablero(p, t)).filter(c=>c.circuits.length);
  const doc = new DXFDoc();
  const paginas = [];
  for(const c of (lista.length ? lista : [calcularTablero(p, tablerosPotencia(p)[0])])) trozos(c.circuits, 13).forEach((cs, k, all)=>paginas.push({ calc:c, cs, k, n:all.length }));
  const As = laminas(doc, paginas.length, valsDe, cliente, i=>({ TITULO2: `${(paginas[i].calc.tablero.nombre||"").toUpperCase()} ${paginas[i].calc.tablero.tag}` }));
  paginas.forEach((pg, h)=>{
    const A = As[h], t = pg.calc.tablero, g = pg.calc.g;
    const yB = A.y1 - 40, fases = ["L1","L2","L3"];
    T(doc, A.x0+4, A.y1-14, 3.2, `${(t.nombre||"TABLERO").toUpperCase()} ${t.tag} — ${g.voltage} VAC, 3F+PE, ${g.freq} Hz`, "G-TEXT", { n:90 });
    // acometida e interruptor general (primera hoja del tablero)
    const xIni = A.x0 + 70, paso = Math.min(90, Math.max(54, (A.x1 - A.x0 - 110) / Math.max(1, pg.cs.length))), xFin = xIni + paso*pg.cs.length;
    fases.forEach((f, k)=>{ L(doc, A.x0+30, yB - k*5, xFin, yB - k*5, "E-FZA-BT-PRI"); T(doc, xFin+3, yB - k*5 - 1, 2.2, f, "G-TEXT"); });
    L(doc, A.x0+30, A.y0+48, xFin, A.y0+48, "E-TIERRA"); T(doc, xFin+3, A.y0+47, 2.2, "PE", "G-TEXT");
    if(pg.k===0){
      fases.forEach((f, k)=>L(doc, A.x0+42+k*4, A.y1-20, A.x0+42+k*4, yB-k*5, "E-FZA-BT-PRI"));
      R(doc, A.x0+36, A.y1-32, 20, 9, "E-SIM"); T(doc, A.x0+46, A.y1-28.5, 2.0, "Q-GEN", "G-TEXT", { halign:1 });
      T(doc, A.x0+58, A.y1-28.5, 1.9, `3x${pg.calc.mainBreaker||"-"}A`, "G-TEXT");
      T(doc, A.x0+36, A.y1-17, 1.9, "ACOMETIDA", "G-TEXT");
    } else T(doc, A.x0+30, yB+4, 2.0, `VIENE DE HOJA ${h}`, "G-TEXT");
    pg.cs.forEach((c, j)=>{
      const xc = xIni + paso*j + paso/2;
      const xs = [xc-4, xc, xc+4];
      let y = yB - 18;
      xs.forEach((x, k)=>{ L(doc, x, yB - k*5, x, y, "E-FZA-BT-PRI"); C(doc, x, yB - k*5, 0.6, "E-FZA-BT-PRI"); });
      const devs = (c.items||[]).filter(it=>it.devtag && it.devtag!=="—" && DISPOSITIVO.test(it.comp||"") && !/^QC\d+\./.test(it.devtag));
      for(const dv of devs){ cajaTripolar(doc, xc, y, dv); y -= 10; xs.forEach(x=>L(doc, x, y, x, y-8, "E-FZA-BT-PRI")); y -= 8; }
      // bornes de salida
      const xb = "X" + String(c.tag||j+1).replace(/[^\w]/g,"");
      xs.forEach((x, k)=>{ C(doc, x, y-1.2, 1.2, "E-SIM"); T(doc, x, y-5.2, 1.5, String(k+1), "G-TEXT", { halign:1 }); });
      C(doc, xc+8, y-1.2, 1.2, "E-TIERRA"); T(doc, xc+8, y-5.2, 1.5, "PE", "G-TEXT", { halign:1 });
      T(doc, xc-12, y-1.8, 1.6, xb, "G-TEXT");
      L(doc, xc+8, y-2.4, xc+8, A.y0+48, "E-TIERRA");
      const yb = y - 7;
      // conductor de salida
      const cm = c.conductorMemo; const cable = cm && cm.cable ? "3C#"+String(cm.cable[0]).replace(/\s/g,"")+"+T" : "";
      xs.forEach(x=>L(doc, x, y-2.4, x, yb-22, "E-FZA-BT-SEC"));
      if(cable) T(doc, xc+1.5, yb-6, 1.6, cable, "G-TEXT", { rot:90, n:20 });
      const yc = yb - 22;
      if(c.kind==="motor"){
        C(doc, xc, yc-9, 9, "E-SIM"); T(doc, xc, yc-8, 2.6, "M", "G-TEXT", { halign:1 }); T(doc, xc, yc-12, 1.8, "3~", "G-TEXT", { halign:1 });
        ["U","V","W"].forEach((u, k)=>T(doc, xs[k]-1.6, yc+1.2, 1.4, u, "G-TEXT"));
      } else if(c.kind==="control"){
        R(doc, xc-8, yc-16, 16, 16, "E-SIM"); C(doc, xc, yc-5, 3.6, "E-SIM"); C(doc, xc, yc-10.5, 3.6, "E-SIM"); T(doc, xc+9, yc-8, 1.7, "T"+c.tag, "G-TEXT");
      } else { R(doc, xc-10, yc-12, 20, 12, "E-EQ"); T(doc, xc, yc-7.5, 1.8, "TABLERO", "G-TEXT", { halign:1 }); }
      const load = c.load || {};
      T(doc, xc, yc-24, 2.1, load.tag || c.tag, "G-TEXT", { halign:1, n:18 });
      Tw(doc, xc-paso/2+2, yc-28.5, 1.7, String(c.title||"").toUpperCase(), Math.floor(paso/1.15), "G-TEXT");
      T(doc, xc, yB+6, 2.0, "C"+(pg.k*13+j+1), "G-TEXT", { halign:1 });
    });
    if(pg.k===pg.n-1) T(doc, A.x0+4, A.y0+40, 1.9, "NOTA: MULTIFILAR DE FUERZA GENERADO DESDE EL CÁLCULO DEL TABLERO (MISMOS DISPOSITIVOS QUE EL UNIFILAR Y LA MEMORIA DE CÁLCULO).", "G-TEXT", { n:140 });
  });
  return { dxf: doc.toDXF(), hojas: paginas.length };
}

/* =====================================================================================
   MULTIFILAR / CONEXIONADO DE E/S DEL TABLERO DE CONTROL: módulo → bornera → instrumento de campo
   ===================================================================================== */
export function multifilarControl({ p, valsDe, cliente }){
  const d = datos(p), st = sistemaTag(p);
  const filas = procesarFilas("ins-io", d["ins-io"]||[], p).filter(f=>f.slot!=="" && f.slot!=null && f.tipo!=="COM");
  const mods = new Map();
  for(const f of filas){ const k = (f.tablero||"PLC")+"|"+f.slot; if(!mods.has(k)) mods.set(k, { tablero:f.tablero||"PLC", slot:f.slot, tipo:f.tipo, filas:[] }); mods.get(k).filas.push(f); }
  const lista = [...mods.values()].sort((a,b)=>a.tablero.localeCompare(b.tablero) || (+a.slot)-(+b.slot));
  const doc = new DXFDoc();
  const pags = trozos(lista, 6);
  const As = laminas(doc, pags.length, valsDe, cliente);
  pags.forEach((ms, h)=>{
    const A = As[h];
    if(!ms.length){ T(doc, A.x0+20, A.y1-40, 3, "SIN SEÑALES ASIGNADAS: COMPLETA EL LISTADO I/O.", "G-TEXT"); return; }
    ms.forEach((m, k)=>{
      const col = k % 3, fila = Math.floor(k/3);
      const x0 = A.x0 + 6 + col*258, y0 = A.y1 - 18 - fila*250;
      const capa = /A[IO]/.test(m.tipo) ? "I-SE-ANALO" : "I-CONTROL";
      R(doc, x0, y0-18-m.filas.length*12, 36, 18+m.filas.length*12, "I-EQ");
      T(doc, x0+18, y0-6, 2.4, m.tablero, "G-TEXT", { halign:1, n:16 });
      T(doc, x0+18, y0-11, 2.4, `SLOT ${m.slot}`, "G-TEXT", { halign:1 });
      T(doc, x0+18, y0-15.5, 2.2, m.tipo, "G-TEXT", { halign:1 });
      T(doc, x0+80, y0-6, 2.0, "BORNES", "G-TEXT", { halign:1 });
      T(doc, x0+170, y0-6, 2.0, "CAMPO", "G-TEXT", { halign:1 });
      m.filas.forEach((f, i)=>{
        const y = y0 - 24 - i*12;
        T(doc, x0+31, y-0.8, 1.8, "CH"+f.ch, "G-TEXT", { halign:1 });
        const bornes = String(f.terminales||"").split(/[\/,;]| y /).map(s=>s.trim()).filter(Boolean);
        const b1 = bornes[0]||"+", b2 = bornes[1]||"-";
        // dos conductores por canal
        [[y+2, b1],[y-2, b2]].forEach(([yy, b])=>{
          L(doc, x0+36, yy, x0+74, yy, capa); C(doc, x0+76, yy, 1.4, "I-SIM"); L(doc, x0+77.4, yy, x0+130, yy, capa);
          T(doc, x0+80, yy+0.4, 1.5, b, "G-TEXT", { n:14 });
        });
        const reserva = !f.tag || /reserva|spare/i.test(f.tag+" "+(f.descripcion||""));
        if(reserva){ T(doc, x0+134, y-0.8, 1.8, "RESERVA", "G-TEXT"); return; }
        L(doc, x0+130, y+2, x0+134, y, capa); L(doc, x0+130, y-2, x0+134, y, capa);
        R(doc, x0+134, y-4, 38, 8, "I-EQ"); T(doc, x0+153, y-1, 1.9, f.tag, "G-TEXT", { halign:1, n:22 });
        Tw(doc, x0+174, y+1.2, 1.5, String(f.descripcion||"").toUpperCase(), 40, "G-TEXT", {}, 2);
        T(doc, x0+100, y+4.2, 1.4, (st ? st.replace(/-/g,"")+"-" : "")+String(f.tag).replace(/-/g,"")+"-C01", "G-TEXT", { n:28 });
      });
    });
    if(h===0) T(doc, A.x0+4, A.y0+40, 1.9, "NOTA: CONEXIONADO GENERADO DESDE EL LISTADO I/O (SLOT, CANAL Y BORNES). CABLES DE INSTRUMENTACIÓN APANTALLADOS CON PANTALLA ATERRADA SOLO EN EL TABLERO.", "G-TEXT", { n:160 });
  });
  return { dxf: doc.toDXF(), hojas: pags.length };
}

/* =====================================================================================
   DISPOSICIÓN DE EQUIPOS DE LOS TABLEROS (MECÁNICO): vista frontal, placa de montaje, vista lateral y lista
   ===================================================================================== */
const ANCHOS = [600, 800, 1000, 1200, 1600, 2000], ALTOS = [800, 1000, 1200, 1600, 2000, 2200];
function medidas(c){   // ancho × alto aproximado (mm) de un componente según su tipo y su valor nominal
  const comp = String(c.comp||""), a = parseFloat(String(c.val||"").replace(/^.*?x/,"")) || 0;
  if(/Variador|VDF/i.test(comp)){ const kw = a; return kw<=7.5 ? [100,300] : kw<=22 ? [150,400] : kw<=55 ? [250,550] : [350,700]; }
  if(/Transformador/i.test(comp)) return [120,140];
  if(/Filtro/i.test(comp)) return [180,160];
  if(/^ITM|Interruptor/i.test(comp)) return a<=63 ? [54,90] : a<=160 ? [105,160] : a<=250 ? [105,180] : a<=630 ? [140,260] : [210,280];
  if(/Contactor/i.test(comp)) return a<=40 ? [45,85] : a<=95 ? [55,120] : [90,160];
  if(/Guardamotor/i.test(comp)) return [45,100];
  if(/Fusible|Portafusible/i.test(comp)) return [36,80];
  if(/Rel[eé]/i.test(comp)) return [18,80];
  if(/PLC|CPU|M[oó]dulo/i.test(comp)) return [c.ancho||35, 135];
  if(/Fuente/i.test(comp)) return [65,125];
  if(/Switch|Router/i.test(comp)) return [45,130];
  if(/Bornera/i.test(comp)) return [Math.max(30, (c.cant||10)*6.2), 50];
  return [45,90];
}
/* borneras en tramos de 40 bornes para que entren en la placa */
function borneras(comps, desc, pref, n){ for(let i=0;i<n;i+=40) comps.push({ comp:desc, devtag:pref+(i/40+1), val:"", cant:Math.min(40, n-i) }); }
function dispone(comps, anchoUtil){   // filas sobre la placa de montaje separadas por canaletas de 60 mm
  const filas = []; let f = { items:[], w:0, h:0 };
  for(const c of comps){ const [w,h] = medidas(c); if(f.items.length && f.w + w + 10 > anchoUtil){ filas.push(f); f = { items:[], w:0, h:0 }; } f.items.push({ c, w, h }); f.w += w + 10; f.h = Math.max(f.h, h); }
  if(f.items.length) filas.push(f);
  return filas;
}
function elegir(comps){
  for(const H of ALTOS) for(const W of ANCHOS){ const filas = dispone(comps, W-100); const alto = filas.reduce((a,f)=>a+f.h+60, 60); if(alto <= H-100) return { W, H, filas }; }
  const W = 2000, filas = dispone(comps, W-100); return { W, H: Math.max(2200, filas.reduce((a,f)=>a+f.h+60, 160)), filas };
}
function hojaDisposicion(doc, A, titulo, comps, puerta, nota){
  const { W, H, filas } = elegir(comps);
  const prof = comps.some(c=>/Variador|VDF/i.test(c.comp||"") && medidas(c)[0]>=250) ? 600 : comps.some(c=>/Variador|VDF/i.test(c.comp||"")) ? 500 : 400;
  // escala normalizada que hace entrar las tres vistas y la lista de componentes en la lámina
  const esc = [5,10,15,20,25,30,40,50].find(e=>H/e <= (A.y1-A.y0-90) && (2*W+prof)/e + 70 + 260 <= (A.x1-A.x0)) || 50;
  const k = 1/esc;
  T(doc, A.x0+4, A.y1-12, 3.2, titulo, "G-TEXT", { n:90 });
  T(doc, A.x0+4, A.y1-18, 2.2, `DIMENSIONES ESTIMADAS: ${W} (ANCHO) x ${H} (ALTO) x ${prof} (PROF.) mm · ESC. 1:${esc}`, "G-TEXT", { n:120 });
  const yBase = Math.max(A.y0 + 40, A.y1 - 40 - H*k);
  // vista frontal exterior (puerta)
  const x1 = A.x0 + 10;
  R(doc, x1, yBase, W*k, H*k, "E-EQ"); R(doc, x1+2, yBase+2, W*k-4, H*k-4, "G-VARIOS");
  L(doc, x1+W*k-6, yBase+H*k/2-8, x1+W*k-6, yBase+H*k/2+8, "G-VARIOS");   // manija
  (puerta||[]).forEach((e, i)=>{ const xx = x1 + 12 + (i % 4)*16, yy = yBase + H*k - 18 - Math.floor(i/4)*16;
    if(e.hmi){ R(doc, xx-4, yy-10, 26, 18, "E-SIM"); T(doc, xx+9, yy-2, 1.8, "HMI", "G-TEXT", { halign:1 }); } else { C(doc, xx, yy, 3.2, "E-SIM"); T(doc, xx, yy-7, 1.4, e.tag, "G-TEXT", { halign:1, n:10 }); } });
  T(doc, x1 + W*k/2, yBase-8, 2.2, "VISTA FRONTAL (PUERTA)", "G-TEXT", { halign:1 });
  // placa de montaje con componentes
  const x2 = x1 + W*k + 30;
  R(doc, x2, yBase, W*k, H*k, "E-EQ"); R(doc, x2+50*k, yBase+50*k, (W-100)*k, (H-100)*k, "G-VARIOS");
  let y = yBase + H*k - 50*k - 30*k; let n = 0;
  for(const f of filas){
    L(doc, x2+50*k, y, x2+(W-50)*k, y, "G-VARIOS"); L(doc, x2+50*k, y-6*k, x2+(W-50)*k, y-6*k, "G-VARIOS");   // canaleta superior
    y -= 30*k; let x = x2 + 50*k + 10*k;
    for(const it of f.items){ n++; R(doc, x, y - it.h*k, it.w*k, it.h*k, "E-SIM"); T(doc, x + it.w*k/2, y - it.h*k/2 - 0.8, Math.min(1.8, Math.max(1.0, it.w*k/5)), String(n), "G-TEXT", { halign:1 }); it.n = n; x += (it.w+10)*k; }
    y -= f.h*k + 30*k;
  }
  L(doc, x2+50*k, y, x2+(W-50)*k, y, "G-VARIOS");
  T(doc, x2 + W*k/2, yBase-8, 2.2, "PLACA DE MONTAJE", "G-TEXT", { halign:1 });
  // vista lateral
  const x3 = x2 + W*k + 30;
  R(doc, x3, yBase, prof*k, H*k, "E-EQ"); R(doc, x3, yBase-100*k, prof*k, 100*k, "G-VARIOS");
  T(doc, x3 + prof*k/2, yBase-8, 2.2, "VISTA LATERAL", "G-TEXT", { halign:1 });
  T(doc, x3 + prof*k + 4, yBase + 4, 1.8, "ZÓCALO 100 mm", "G-TEXT");
  // lista de componentes
  const xl = Math.max(x3 + prof*k + 40, A.x1 - 250), yl = A.y1 - 30;
  const cols = [[0,"N°"],[12,"TAG"],[42,"DESCRIPCIÓN"],[150,"VALOR"],[200,"CANT."]];
  const lista = []; let m = 0; for(const f of filas) for(const it of f.items) lista.push({ n:++m, c:it.c });
  const rh = 6.5, filasL = lista.slice(0, Math.floor((yl - A.y0 - 30)/rh) - 1);
  R(doc, xl, yl - rh*(filasL.length+1), 215, rh*(filasL.length+1));
  cols.forEach(([dx, t])=>T(doc, xl+dx+2, yl-4.5, 2.0, t, "G-TEXT"));
  filasL.forEach((r, i)=>{ const yy = yl - rh*(i+2); L(doc, xl, yy+rh, xl+215, yy+rh); T(doc, xl+2, yy+2, 1.8, r.n, "G-TEXT"); T(doc, xl+14, yy+2, 1.7, r.c.devtag||"", "G-TEXT", { n:14 }); T(doc, xl+44, yy+2, 1.7, String(r.c.comp||"").toUpperCase(), "G-TEXT", { n:52 }); T(doc, xl+152, yy+2, 1.7, r.c.val && r.c.val!=="—" ? r.c.val : "", "G-TEXT", { n:22 }); T(doc, xl+204, yy+2, 1.7, r.c.cant||1, "G-TEXT"); });
  if(lista.length > filasL.length) T(doc, xl, yl - rh*(filasL.length+1) - 5, 1.8, `(+${lista.length-filasL.length} componentes adicionales en la hoja de datos del tablero)`, "G-TEXT", { n:90 });
  if(nota) Tw(doc, A.x0+4, A.y0+28, 1.9, nota, 170, "G-TEXT", {}, 3);
}
export function mecanicoFuerza({ p, valsDe, cliente }){
  const v = valoresDiseno(p), ip = ipRecomendado(v);
  const lista = tablerosPotencia(p).map(t=>({ t, c: calcularTablero(p, t) }));
  const doc = new DXFDoc();
  const As = laminas(doc, lista.length || 1, valsDe, cliente, i=>({ TITULO2: lista[i] ? `${(lista[i].t.nombre||"").toUpperCase()} ${lista[i].t.tag}` : "" }));
  lista.forEach(({ t, c }, h)=>{
    const comps = [{ comp:"Interruptor general", devtag:"Q-GEN", val:`3x${c.mainBreaker||"-"}A` }];
    const acc = t.accesorios||{};
    if(acc.spd) comps.push({ comp:"Supresor de sobretensiones", devtag:"SPD", val:"T1+2" });
    if(acc.releFase) comps.push({ comp:"Relé de supervisión de fases", devtag:"RF", val:"" });
    for(const ci of c.circuits) for(const it of (ci.items||[])) if(it.devtag && it.devtag!=="—" && DISPOSITIVO.test(it.comp||"")) comps.push(it);
    borneras(comps, "Bornera de salida", "X", c.circuits.length*4);
    const puerta = acc.luces ? [{ tag:"H-R" },{ tag:"H-S" },{ tag:"H-T" }] : [];
    hojaDisposicion(doc, As[h], `DISPOSICIÓN DE EQUIPOS — ${(t.nombre||"TABLERO").toUpperCase()} ${t.tag}`, comps, puerta,
      `NOTAS: 1) GABINETE ${ip}, AUTOSOPORTADO O MURAL SEGÚN DIMENSIONES. 2) DIMENSIONES ESTIMADAS CON 20% DE RESERVA; CONFIRMAR CON EL FABRICANTE DEL TABLERO. 3) ENTRADA DE CABLES POR LA PARTE INFERIOR CON PRENSAESTOPAS. 4) MARCA / MODELO DEL GABINETE: ${(t.marca||"POR DEFINIR").toUpperCase()} ${(t.modelo||"").toUpperCase()}.`);
  });
  return { dxf: doc.toDXF(), hojas: lista.length || 1 };
}
export function mecanicoControl({ p, valsDe, cliente }){
  const v = valoresDiseno(p), ip = ipRecomendado(v), d = datos(p);
  const filas = procesarFilas("ins-io", d["ins-io"]||[], p);
  const ctls = tablerosControl(p);
  const doc = new DXFDoc();
  const As = laminas(doc, ctls.length || 1, valsDe, cliente, i=>({ TITULO2: ctls[i] ? `${(ctls[i].nombre||"").toUpperCase()} ${ctls[i].tag}` : "" }));
  ctls.forEach((t, h)=>{
    const propias = filas.filter(f=>(f.tablero||"")===t.tag && f.slot!=="" && f.slot!=null);
    const slots = [...new Set(propias.map(f=>f.slot))].sort((a,b)=>a-b);
    const comps = [{ comp:"Interruptor principal de control", devtag:"Q1", val:"2x16A" }, { comp:"Fuente de alimentación 24 VDC", devtag:"PS1", val:"10 A" },
      { comp:"PLC — CPU", devtag:t.plc||"CPU", val:t.modeloPlc||"", ancho:70 }];
    slots.forEach(s=>{ const tipo = (propias.find(f=>f.slot===s)||{}).tipo||""; comps.push({ comp:`Módulo ${tipo} (slot ${s})`, devtag:"SLOT "+s, val:tipo, ancho:35 }); });
    if(t.switch) comps.push({ comp:"Switch Ethernet", devtag:"SW1", val:"" });
    if(t.router) comps.push({ comp:"Router IIoT", devtag:"RT1", val:"" });
    const dos = propias.filter(f=>f.tipo==="DO").length;
    for(let i=0;i<Math.min(dos, 24);i++) comps.push({ comp:"Relé de interposición", devtag:"KA"+(i+1), val:t.ioDiscreto||"" });
    borneras(comps, "Bornera de señales", "TB", Math.max(10, propias.length*2));
    const puerta = [t.hmi && { hmi:true }, t.senalesTablero && { tag:"PE (SETA)" }, t.senalesTablero && { tag:"RESET" }, t.senalesTablero && { tag:"L/R" }].filter(Boolean);
    hojaDisposicion(doc, As[h], `DISPOSICIÓN DE EQUIPOS — ${(t.nombre||"TABLERO DE CONTROL").toUpperCase()} ${t.tag}`, comps, puerta,
      `NOTAS: 1) GABINETE ${ip}. 2) ${slots.length} MÓDULO(S) DE E/S SEGÚN EL LISTADO I/O, CON LA RESERVA DEL PROYECTO. 3) SEPARAR CANALETAS DE SEÑALES ANALÓGICAS, DISCRETAS Y DE FUERZA. 4) DIMENSIONES ESTIMADAS; CONFIRMAR CON EL FABRICANTE.`);
  });
  if(!ctls.length) T(doc, As[0].x0+20, As[0].y1-40, 3, "EL PROYECTO NO TIENE TABLEROS DE CONTROL.", "G-TEXT");
  return { dxf: doc.toDXF(), hojas: ctls.length || 1 };
}

/* =====================================================================================
   ARREGLO GENERAL (equipos eléctricos o instrumentos) sobre la planta del cliente (DXF) con coordenadas
   ===================================================================================== */
export function elementosArreglo(p, disciplina){
  const d = datos(p);
  if(disciplina==="INS"){
    const out = tablerosControl(p).map(t=>({ tag:t.tag, desc:t.nombre||"Tablero de control", tipo:"tablero" }));
    for(const i of instrumentos(p)) for(const tag of expandirTag(i.tag)) if(tag) out.push({ tag, desc:i.descripcion||"", tipo:"instrumento", i });
    return out;
  }
  const out = tableros(p).map(t=>({ tag:t.tag, desc:t.nombre||"Tablero", tipo:"tablero", t }));
  for(const l of d.cargas) if(l.tag && l.kind!=="control") out.push({ tag:l.tag, desc:l.desc||"", tipo:"carga", l });
  return out;
}
/* ubicación recomendada de cada tablero de fuerza: centro de carga (coordenadas de sus cargas ponderadas por potencia) */
export function sugerirTableros(p){
  const d = datos(p); d.ubicaciones = d.ubicaciones || {}; let n = 0;
  for(const t of tablerosPotencia(p)){
    const cs = d.cargas.filter(l=>l.tablero===t.id && d.ubicaciones[l.tag] && d.ubicaciones[l.tag].x!=="" && d.ubicaciones[l.tag].y!=="");
    if(!cs.length) continue;
    const kw = l => Math.max(0.1, (+l.power||0) * (l.powerUnit==="hp" ? 0.746 : 1));
    const W = cs.reduce((a,l)=>a+kw(l), 0);
    d.ubicaciones[t.tag] = { x: +(cs.reduce((a,l)=>a+kw(l)*(+d.ubicaciones[l.tag].x), 0)/W).toFixed(2), y: +(cs.reduce((a,l)=>a+kw(l)*(+d.ubicaciones[l.tag].y), 0)/W).toFixed(2), sugerido:true };
    n++;
  }
  return n;
}
async function arreglo({ p, valsDe, cliente }, disciplina){
  const d = datos(p), ub = d.ubicaciones || {};
  const elems = elementosArreglo(p, disciplina).filter(e=>ub[e.tag] && ub[e.tag].x!=="" && ub[e.tag].y!=="" && ub[e.tag].x!=null);
  let ents = [];
  const cfg = (d.arreglo||{})[disciplina] || {};
  if(cfg.plano){ try{ const f = await S.leerArchivo(cfg.plano); if(f) ents = parseDXF(await f.blob.text()).entities.filter(e=>e.space!=="paper"); }catch(e){ ents = []; } }
  const doc = new DXFDoc();
  const [A] = laminas(doc, 1, valsDe, cliente);
  // límites comunes de planta + elementos
  let mx=Infinity, my=Infinity, Mx=-Infinity, My=-Infinity;
  const ext = (x,y)=>{ if(!isFinite(x)||!isFinite(y)) return; mx=Math.min(mx,x); my=Math.min(my,y); Mx=Math.max(Mx,x); My=Math.max(My,y); };
  for(const e of ents){ if(e.t==="L"){ ext(e.x1,e.y1); ext(e.x2,e.y2); } else if(e.t==="C"||e.t==="A"){ ext(e.cx-e.r,e.cy-e.r); ext(e.cx+e.r,e.cy+e.r); } else if(e.t==="P") e.pts.forEach(q=>ext(q[0],q[1])); else if(e.t==="T") ext(e.x,e.y); }
  for(const e of elems) ext(+ub[e.tag].x, +ub[e.tag].y);
  if(!isFinite(mx)){ T(doc, A.x0+20, A.y1-40, 3, "CARGA LA PLANTA (DXF) Y LAS COORDENADAS DE LOS EQUIPOS EN «DATOS DE ENTRADA».", "G-TEXT", { n:100 }); return { dxf: doc.toDXF(), hojas:1 }; }
  const ax0 = A.x0+10, ay0 = A.y0+20, ax1 = A.x1-170, ay1 = A.y1-20;
  const s = Math.min((ax1-ax0)/Math.max(1e-9, Mx-mx), (ay1-ay0)/Math.max(1e-9, My-my));
  const X = x => ax0 + (x-mx)*s + ((ax1-ax0) - (Mx-mx)*s)/2, Y = y => ay0 + (y-my)*s + ((ay1-ay0) - (My-my)*s)/2;
  for(const e of ents){
    if(e.t==="L") L(doc, X(e.x1), Y(e.y1), X(e.x2), Y(e.y2), "G-PLANTA");
    else if(e.t==="C") C(doc, X(e.cx), Y(e.cy), e.r*s, "G-PLANTA");
    else if(e.t==="A") arco(doc, X(e.cx), Y(e.cy), e.r*s, e.a1, e.a2, "G-PLANTA");
    else if(e.t==="P"){ const q = e.pts.map(r=>[X(r[0]), Y(r[1])]); if(e.closed && q.length) q.push(q[0]); doc.polyline(q, "G-PLANTA"); }
    else if(e.t==="T" && e.text && e.h*s>=0.8) T(doc, X(e.x), Y(e.y), e.h*s, e.text, "G-PLANTA", { rot:e.rot||0, n:60 });
  }
  for(const e of elems){
    const x = X(+ub[e.tag].x), y = Y(+ub[e.tag].y);
    if(e.tipo==="tablero"){ R(doc, x-6, y-3, 12, 6, disciplina==="INS" ? "I-EQ" : "E-EQ"); T(doc, x, y+5, 2.0, e.tag, "G-TEXT", { halign:1, n:20 }); if(ub[e.tag].sugerido) T(doc, x, y-7.5, 1.5, "(UBICACIÓN SUGERIDA)", "G-TEXT", { halign:1 }); }
    else if(e.tipo==="carga"){ C(doc, x, y, 3.5, "E-SIM"); T(doc, x, y-0.8, 2.0, "M", "G-TEXT", { halign:1 }); T(doc, x+5, y+2, 1.8, e.tag, "G-TEXT", { n:20 }); }
    else { burbuja(doc, x, y, e.tag, "campo"); }
  }
  // recorrido referencial tablero → cargas (eléctrico)
  if(disciplina==="ELE") for(const l of d.cargas){ const t = tableros(p).find(t=>t.id===l.tablero); if(t && ub[t.tag] && ub[l.tag] && ub[l.tag].x!=null && ub[t.tag].x!=null) discontinua(doc, X(+ub[t.tag].x), Y(+ub[t.tag].y), X(+ub[l.tag].x), Y(+ub[l.tag].y), "E-FZA", 4, 2); }
  if(disciplina==="INS") for(const e of elems.filter(e=>e.tipo==="instrumento")){ const t = tableroDeInstrumento(p, e.i); if(t && ub[t.tag] && ub[t.tag].x!=null) discontinua(doc, X(+ub[e.tag].x), Y(+ub[e.tag].y), X(+ub[t.tag].x), Y(+ub[t.tag].y), "I-SE-ANALO", 3, 2); }
  leyenda(doc, A.x1-160, A.y1-20, 150, disciplina==="INS" ? [
      { sim:(x,y)=>burbuja(doc, x, y, "PIT-001", "campo"), texto:"Instrumento de campo" },
      { sim:(x,y)=>R(doc, x-6, y-3, 12, 6, "I-EQ"), texto:"Tablero de control" },
      { sim:(x,y)=>discontinua(doc, x-12, y, x+12, y, "I-SE-ANALO", 3, 2), texto:"Recorrido referencial de cable" },
    ] : [
      { sim:(x,y)=>R(doc, x-6, y-3, 12, 6, "E-EQ"), texto:"Tablero eléctrico" },
      { sim:(x,y)=>{ C(doc, x, y, 3.5, "E-SIM"); T(doc, x, y-0.8, 2.0, "M", "G-TEXT", { halign:1 }); }, texto:"Carga / motor" },
      { sim:(x,y)=>discontinua(doc, x-12, y, x+12, y, "E-FZA", 4, 2), texto:"Recorrido referencial de cable" },
    ], "LEYENDA");
  T(doc, A.x1-160, A.y1-70, 1.8, "UBICACIONES REFERENCIALES; VERIFICAR EN CAMPO.", "G-TEXT", { n:60 });
  return { dxf: doc.toDXF(), hojas:1 };
}
export const arregloEquipos = ctx => arreglo(ctx, "ELE");
export const arregloInstrumentos = ctx => arreglo(ctx, "INS");

export const GENERADORES2 = {
  "ins-pid": { fn: pid, titulo:"DIAGRAMA DE PROCESO E INSTRUMENTACIÓN (P&ID)", disciplina:"INSTRUMENTACIÓN Y CONTROL" },
  "ele-multifilar": { fn: multifilarFuerza, titulo:"DIAGRAMA MULTIFILAR DEL TABLERO DE FUERZA", disciplina:"ELECTRICIDAD" },
  "ins-multifilar-tc": { fn: multifilarControl, titulo:"DIAGRAMA MULTIFILAR DEL TABLERO DE CONTROL - CONEXIONADO DE E/S", disciplina:"INSTRUMENTACIÓN Y CONTROL" },
  "ele-mecanico": { fn: mecanicoFuerza, titulo:"DISPOSICIÓN DE EQUIPOS DEL TABLERO DE FUERZA", disciplina:"ELECTRICIDAD" },
  "ins-mecanico-tc": { fn: mecanicoControl, titulo:"DISPOSICIÓN DE EQUIPOS DEL TABLERO DE CONTROL", disciplina:"INSTRUMENTACIÓN Y CONTROL" },
  "ele-arreglo": { fn: arregloEquipos, titulo:"ARREGLO GENERAL DE EQUIPOS ELÉCTRICOS", disciplina:"ELECTRICIDAD" },
  "ins-arreglo": { fn: arregloInstrumentos, titulo:"ARREGLO GENERAL DE INSTRUMENTOS", disciplina:"INSTRUMENTACIÓN Y CONTROL" },
};

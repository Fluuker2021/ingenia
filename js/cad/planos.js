/* Ingenia — generadores de planos (DXF R12, texto ANSI_1252).
   Cada generador recibe un contexto { p, vals(hoja) , cliente } y devuelve { dxf, hojas }.
   Estilo, capas y disposición de una ingeniería de detalle usual de E&I. */
import { DXFDoc, buildUnifilarDXF, dxfTrunc, symBreaker, symFuse, symGroundSmall, symGroundElectrode, symTransformer } from "../engine/tablero-core.js";
import { dibujarLamina, PASO_HOJAS } from "./formato.js";
import { funcionISA, datos, calcularTablero, calcularTodos, circuitosControl, instrumentos, esAnalogico, esSalida, expandirTag, tipoInstrumento, sistemaTag, sistemaNombre,
  tableros, tablerosPotencia, tablerosControl, tableroDeInstrumento, tableroPorId, tf, tc, desdeTxt, esControl, esFuerza } from "../datos.js";
import { procesarFilas } from "../modules/tablas.js";
import { valoresDiseno } from "../modules/criterios.js";
import { GENERADORES2 } from "./planos2.js";

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
    buildUnifilarDXF(calc, { doc, titulo:`${(t.nombre||"TABLERO").toUpperCase()} ${t.tag}`, subtitulo:`${calc.g.voltage} VAC, 3F+T, ${calc.g.freq} Hz · Icc ${calc.g.faultLevel} kA`, acometida:"VIENE DE "+desdeTxt(p, t).toUpperCase(),
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
   2) DIAGRAMA UNIFILAR DEL TABLERO DE CONTROL 
   ===================================================================================== */
export function unifilarControl({ p, valsDe, cliente }){
  const ctl = tablerosControl(p).length ? tablerosControl(p) : [tc(p)];
  const partes = ctl.map(t=>({ t, n: nHojasControl(circuitosControl(p, t)) }));
  const total = partes.reduce((a,x)=>a+x.n, 0);
  const doc = new DXFDoc();
  let k = 0;
  for(const pt of partes){ unifilarControlTablero(doc, p, pt.t, i=>valsDe(k+i, total, { TITULO2: `${(pt.t.nombre||"").toUpperCase()} ${pt.t.tag}` }), cliente, k); k += pt.n; }
  return { dxf: doc.toDXF(), hojas: total };
}
function nHojasControl(circs){
  const grupos = ["24 VDC", "120 VAC", "220 VAC"].map(b=>circs.filter(c=>c.barra===b)).filter(g=>g.length);
  const total = grupos.reduce((a,g)=>a+g.length, 0) + (grupos.length-1)*1.4;
  return Math.max(1, Math.ceil(total / 30));
}
function unifilarControlTablero(doc, p, tc, valsDe, cliente, offset){
  const d = datos(p), v = valoresDiseno(p);
  const circs = circuitosControl(p, tc);
  const grupos = ["24 VDC", "120 VAC", "220 VAC"].map(b=>({ barra:b, c: circs.filter(c=>c.barra===b) })).filter(g=>g.c.length);
  const total = grupos.reduce((a,g)=>a+g.c.length, 0) + (grupos.length-1)*1.4;
  const maxPorHoja = 30;
  const nH = Math.max(1, Math.ceil(total / maxPorHoja));
  const areas = []; for(let i=0;i<nH;i++) areas.push(dibujarLamina(doc, (offset+i)*PASO_HOJAS, 0, valsDe(i), cliente));
  // reparto de grupos por hoja (sin partir un grupo salvo que no quepa)
  const hojas = Array.from({length:nH}, ()=>[]); let h = 0, usado = 0;
  for(const g of grupos){
    let resto = g.c.slice();
    while(resto.length){
      const libre = Math.max(4, maxPorHoja - usado);
      const parte = resto.splice(0, libre);
      hojas[h].push({ barra:g.barra, c:parte, cont: parte!==g.c && hojas[h].some(x=>x.barra===g.barra) });
      usado += parte.length + 1.4;
      if(usado >= maxPorHoja-3 && h<nH-1){ h++; usado = 0; }
    }
  }
  hojas.forEach((gs, hi)=>{
    const A = areas[hi];
    const n = gs.reduce((a,g)=>a+g.c.length,0) + (gs.length-1)*1.4;
    const pitch = Math.min(27, (A.x1 - A.x0 - 190) / Math.max(n,1));
    const busY = A.y1 - 190, topY = A.y1 - 12;
    let x = A.x0 + 18;
    for(const g of gs){
      const w = g.c.length * pitch;
      const xc = x + w/2;
      const layer = g.barra==="24 VDC" ? "I-FZA-DC" : "I-FZA-AC";
      // alimentación del grupo
      let rot = "", desde = "";
      if(g.barra==="120 VAC"){ rot = `L,N ${v.tensionControl||120} VAC, 1F+N+T, ${v.frecuencia} Hz`; desde = "VIENE DE "+(tc.desde120 || desdeTxt(p, tc)).toUpperCase(); }
      else if(g.barra==="220 VAC"){ rot = `R,S 220 VAC, 1F+T, ${v.frecuencia} Hz`; const tfu = tc.tipo==="fuerzacontrol" ? tc : (tableroPorId(p, tc.desde) || tf(p)); desde = "VIENE DEL TABLERO "+(tfu.tag||""); }
      else { rot = "+/- 24 VDC"; desde = "FUENTE DE 24 VDC (CIRCUITO 120 VAC)"; }
      if(g.barra==="24 VDC"){
        R(doc, xc-9, busY+42, 18, 14, "I-SIM"); T(doc, xc, busY+50.5, 3, "~", "I-SIM", { halign:1 }); T(doc, xc, busY+44.5, 3, "=", "I-SIM", { halign:1 });
        T(doc, xc+12, busY+50, 2.4, "FUENTE 24 VDC", "G-TEXT"); L(doc, xc, busY+42, xc, busY, layer);
        L(doc, xc, busY+56, xc, topY-26, "I-FZA-AC"); T(doc, xc+3, topY-30, 2.2, desde, "G-TEXT", { n:44 });
      } else {
        R(doc, xc-22, topY-14, 44, 12, "G-VARIOS"); Tw(doc, xc-20.5, topY-5, 2.0, desde, 40, "G-TEXT");
        doc.polyline([[xc-15,topY-14],[xc,topY-20],[xc+15,topY-14]], "G-VARIOS");
        L(doc, xc, topY-20, xc, busY, layer);
        symBreaker(doc, xc, busY+34, 9, 2); T(doc, xc+8, busY+35, 2.4, "Q-"+g.barra.replace(/\s/g,"")+" 2x"+(g.barra==="120 VAC"?16:10)+"A", "G-TEXT");
        T(doc, xc+3, busY+18, 2.0, g.barra==="120 VAC" ? "2C#12AWG+12AWG(T) 0.6/1kV" : "2C#12AWG+12AWG(T) 0.6/1kV", "G-TEXT");
      }
      L(doc, x+2, busY, x+w-2, busY, layer);
      T(doc, x+2, busY+3, 2.4, rot+(g.cont?" (CONT.)":""), "G-TEXT", { n:50 });
      g.c.forEach((c, i)=>{
        const bx = x + pitch*(i+0.5);
        L(doc, bx, busY, bx, busY-14, layer);
        T(doc, bx, busY+8, 2.6, c.circuito, "G-TEXT", { halign:1 });
        if(g.barra==="24 VDC"){ symFuse(doc, bx, busY-21, 7, 1); T(doc, bx+3, busY-26, 1.9, c.proteccion+"A", "G-TEXT"); }
        else { symBreaker(doc, bx, busY-21, 8, 2); T(doc, bx+2.5, busY-28.5, 1.9, "2x"+c.proteccion+"A", "G-TEXT"); if(c.diferencial){ T(doc, bx+2.5, busY-31.6, 1.9, "ID 30mA", "G-TEXT"); } }
        L(doc, bx, busY-28, bx, busY-212, layer);
        T(doc, bx-1.6, busY-200, 2.0, c.cable+" 0.6/1kV", "G-TEXT", { rot:90, n:40 });
        doc.polyline([[bx-1,busY-215],[bx,busY-212],[bx+1,busY-215]], layer);
        Tw(doc, bx-pitch/2+1, busY-222, 1.9, c.descripcion.toUpperCase(), Math.max(10, Math.floor(pitch/1.45)), "G-TEXT");
      });
      x += w + pitch*1.4;
    }
    // barra de tierra y pozo
    const gy = busY - 258;
    L(doc, A.x0+12, gy, x - 10, gy, "I-TIERRA");
    symGroundElectrode(doc, A.x0+12, gy, 12);
    T(doc, A.x0+12, gy-12, 2.2, "POZO A TIERRA", "G-TEXT", { halign:1 });
    T(doc, A.x0+20, gy+2, 2.2, "BARRA DE TIERRA AISLADA / PROTECCIÓN", "G-TEXT");
    // leyenda y notas
    const lx = A.x1 - 160, ly = A.y1 - 20;
    tablaLeyenda(doc, lx, ly, 150, [
      { texto:"INTERRUPTOR TERMOMAGNÉTICO (ITM)", sim:(x,y)=>symBreaker(doc,x,y,6,2) }, { texto:"INTERRUPTOR DIFERENCIAL (ID 30 mA)", sim:(x,y)=>{ symBreaker(doc,x,y,6,2); T(doc,x+3,y-1,1.6,"ID","G-TEXT"); } },
      { texto:"PORTAFUSIBLE", sim:(x,y)=>symFuse(doc,x,y,5,1) },
      { texto:"FUENTE 24 VDC", sim:(x,y)=>{ R(doc,x-4,y-3,8,6,"I-SIM"); T(doc,x-1.2,y-1,1.8,"~","I-SIM"); } }, { texto:"POZO A TIERRA", sim:(x,y)=>symGroundSmall(doc,x,y+2,5) },
      { layer:"I-FZA-AC", texto:"CIRCUITO DE CORRIENTE ALTERNA" }, { layer:"I-FZA-DC", texto:"CIRCUITO DE 24 VDC" }, { layer:"I-TIERRA", texto:"CONDUCTOR DE TIERRA" },
    ], "LEYENDA");
    const notas = (d.notas["ins-unifilar-tc"] && d.notas["ins-unifilar-tc"].length) ? d.notas["ins-unifilar-tc"] : [
      `LA ACOMETIDA PARA EL TABLERO DE CONTROL ${tc.tag||""} ES DE ${v.tensionControl||120} VAC, 1F+N+T, ${v.frecuencia} Hz.`,
      `TODOS LOS EQUIPOS ESTÁN DISEÑADOS PARA TRABAJAR A ${v.altitud} m s.n.m.`,
      "LAS PROTECCIONES Y SECCIONES INDICADAS SON PRELIMINARES; VERIFICAR CON LA LISTA DE EQUIPOS FINAL." ];
    let ny = A.y0 + 52;
    T(doc, A.x0+4, ny, 2.6, "NOTAS:", "G-TEXT"); notas.forEach((nt,i)=>{ Tw(doc, A.x0+4, ny - 5 - i*7.5, 2.1, (i+1)+". "+nt, 110, "G-TEXT"); });
    T(doc, A.x0+4, A.y1-6, 4.2, `${(tc.nombre||"TABLERO DE CONTROL").toUpperCase()} ${tc.tag}`, "G-TEXT");
  });
  return nH;
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
      hilos.forEach((h, j)=>{
        const y = yc + 8 - j*dy;
        const capa = h==="SH"||h==="GND" ? "I-TIERRA" : capaS;
        L(doc, x1, y, x2, y, capa);
        T(doc, x1+1, y+0.6, 1.8, h, "G-TEXT");
        T(doc, x2+1.5, y+0.6, 1.8, String(j+1), "G-TEXT");
        L(doc, x2+5, y, x3, y, capa);
      });
      const yb = yc + 8 - (hilos.length-1)*dy;
      doc.polyline([[x1+8,yc+9.5],[x1+6.5,(yc+8+yb)/2],[x1+8,yb-1.5]], "G-VARIOS");
      doc.polyline([[x2-6,yc+9.5],[x2-4.5,(yc+8+yb)/2],[x2-6,yb-1.5]], "G-VARIOS");
      const cableTag = (st ? st.replace(/-/g,"") : "") + lz.tag.replace(/-/g,"") + (lz.analog ? "-J01" : "-C01");
      const spec = lz.analog ? "1-1Pr#16AWG+SH" : (lz.salida ? "1-3C#14AWG+T" : "1-5C#14AWG+T");
      T(doc, (x1+x2)/2 - 25, yc+11, 2.1, cableTag, "G-TEXT"); T(doc, (x1+x2)/2 - 25, yc+8.6, 1.9, spec, "G-TEXT");
      // borneras y alimentación en tablero
      const pw = lz.analog ? (ac ? lz.i.alimentacion : "24 VDC") : (/24/.test(lz.i.alimentacion||"") ? "24 VDC" : (lz.i.alimentacion||"120 VAC"));
      T(doc, x3+2, yc+8.6, 2.0, pw, "G-TEXT");
      T(doc, x3+2, yb+0.6, 2.0, lz.analog && !ac ? "0 VDC" : "PE", "G-TEXT");
      // señal al controlador
      const ys = yc + 8 - dy;
      L(doc, x3, ys, xPLC-8, ys, capaS);
      const io = lz.io; const canal = io.tipo ? (io.slot!=="" && io.slot!=null ? `${io.tipo}  S${io.slot}:CH${io.ch}` : `${io.tipo}  ${io.tablero||""}`) : (lz.analog ? "AI" : lz.salida ? "DO" : "DI");
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
      { layer:"I-FZA-AC", texto:"Línea de fuerza 120 VAC" }, { layer:"I-FZA-DC", texto:"Línea de fuerza 24 VDC" }, { layer:"I-TIERRA", texto:"Línea de tierra" },
      { layer:"I-CONTROL", texto:"Línea de control" }, { layer:"I-SE-ANALO", texto:"Línea de instrumentación" }, { layer:"I-DAT", texto:"Límite de data y comunicación" } ], "LEYENDA DE CONEXIÓN");
    T(doc, A.x0+4, A.y0+52, 2.4, "NOTAS:", "G-TEXT");
    Tw(doc, A.x0+4, A.y0+47, 2.0, "1. ES RESPONSABILIDAD DEL USUARIO DE ESTE PLANO ASEGURARSE DE USAR LA ÚLTIMA REVISIÓN DE LA LISTA DE E/S Y DEL LISTADO DE INSTRUMENTOS.", 80, "G-TEXT");
    Tw(doc, A.x0+4, A.y0+38, 2.0, "2. CANALES (SLOT/CH) ASIGNADOS AUTOMÁTICAMENTE DESDE LA LISTA DE E/S DEL PROYECTO.", 80, "G-TEXT");
  });
  return { dxf: doc.toDXF(), hojas:nH, lazos: lazosL.length };
}

/* =====================================================================================
   4) ARQUITECTURA DE CONTROL 
   ===================================================================================== */
export function arquitectura({ p, valsDe, cliente }){
  const ctl = tablerosControl(p).length ? tablerosControl(p) : [tc(p)];
  const doc = new DXFDoc();
  const areas = laminas(doc, ctl.length, (i,n)=>valsDe(i, n, ctl.length>1 ? { TITULO2: `${(ctl[i].nombre||"").toUpperCase()} ${ctl[i].tag}` } : {}), cliente);
  ctl.forEach((t, i)=>arquitecturaTablero(doc, areas[i], p, t));
  return { dxf: doc.toDXF(), hojas: ctl.length };
}
function controladoPor(p, l){ const tl = tableroPorId(p, l.tablero) || tf(p); return esControl(tl) ? tl : (tl.control && tableroPorId(p, tl.control)) || tc(p); }
function arquitecturaTablero(doc, A, p, tc){
  const d = datos(p), st = sistemaTag(p);
  const vfds = calcularTodos(p).flatMap(c=>c.circuits).filter(c=>c.kind==="motor" && c.items.some(it=>/^VDF/.test(it.devtag||"")) && controladoPor(p, c.load).id===tc.id);
  const devs = [];
  for(const i of instrumentos(p)){
    if(tableroDeInstrumento(p, i).id!==tc.id) continue;
    if(/^\s*N\.?\s*A\.?\s*$/i.test(i.tipoSenal||"") && !/^XV|^SV/.test(tipoInstrumento(i.tag))) continue;   // indicadores locales
    const tags = expandirTag(i.tag).filter(Boolean);
    // grupos de equipos iguales (p.ej. 18 válvulas solenoides XV-003A@003R) se dibujan como un solo símbolo
    if(tags.length>3) devs.push({ tag: tags[0]+"@"+tags[tags.length-1].slice(-1)+" ("+tags.length+")", i, analog:esAnalogico(i), salida:esSalida(i) });
    else for(const tag of tags) devs.push({ tag, i, analog:esAnalogico(i), salida:esSalida(i) });
  }
  const filasDev = [devs.filter(x=>!x.salida), devs.filter(x=>x.salida)].filter(r=>r.length);
  const porFila = 13;
  const filas = []; filasDev.forEach(r=>{ for(let k=0;k<r.length;k+=porFila) filas.push(r.slice(k,k+porFila)); });
  const W = A.x1-A.x0;
  // caja del sistema
  const bx0 = A.x0+28, bx1 = A.x1-150, by1 = A.y1-28;
  const by0 = Math.max(A.y0+66, by1 - 210 - 48 - Math.max(filas.length,1)*78 - 10);
  R(doc, bx0, by0, bx1-bx0, by1-by0, "G-VARIOS");
  T(doc, bx0, by1+7, 2.8, (sistemaNombre(p)||"SISTEMA").toUpperCase(), "G-TEXT", { n:60 }); if(st) T(doc, bx0, by1+3, 2.6, st, "G-TEXT");
  // tablero de control
  const px0 = bx0+12, px1 = bx0 + (bx1-bx0)*0.68, py1 = by1-10, py0 = by1-210;
  R(doc, px0, py0, px1-px0, py1-py0, "I-EQ");
  T(doc, px0+4, py1-5, 2.6, (tc.nombre||"TABLERO DE CONTROL").toUpperCase(), "G-TEXT"); T(doc, px0+4, py1-9, 2.4, tc.tag||"", "G-TEXT");
  // switch
  const sw = { x: px0+28, y: py1-60 };
  if(tc.switch){
    R(doc, sw.x-9, sw.y-28, 18, 56, "I-EQ"); for(let k=0;k<8;k++){ const yy = sw.y+20-k*6.2; R(doc, sw.x-6, yy-2.3, 4.6, 4.6, "I-EQ"); R(doc, sw.x+1.4, yy-2.3, 4.6, 4.6, "I-EQ"); }
    T(doc, sw.x, sw.y+33, 2.2, "SWITCH ETHERNET", "G-TEXT", { halign:1 });
  }
  // PLC
  const plc = { x: px0 + (px1-px0)*0.52, y: py1-95 };
  R(doc, plc.x-34, plc.y-16, 68, 32, "I-EQ"); for(let k=0;k<7;k++) L(doc, plc.x-24+k*8, plc.y-16, plc.x-24+k*8, plc.y+16, "I-EQ");
  T(doc, plc.x, plc.y+20, 2.4, (tc.plc||"CONTROLADOR (PLC)").toUpperCase(), "G-TEXT", { halign:1, n:40 }); if(tc.modeloPlc) T(doc, plc.x, plc.y-21, 2.0, tc.modeloPlc, "G-TEXT", { halign:1 });
  const eth = (x1,y1,x2,y2,lbl)=>{ doc.polyline([[x1,y1],[x1,(y1+y2)/2],[x2,(y1+y2)/2],[x2,y2]], "I-PROTOCOL"); if(lbl) T(doc, Math.min(x1,x2)+2, (y1+y2)/2+1.2, 1.9, lbl, "G-TEXT"); };
  if(tc.switch) eth(sw.x+9, sw.y+8, plc.x-20, plc.y+16, "ETHERNET/IP");
  let ox = px0 + 12;
  if(tc.hmi){ const h = { x: px0+22, y: py0+38 }; R(doc, h.x-14, h.y-10, 28, 20, "I-EQ"); R(doc, h.x-11, h.y-7, 22, 14, "I-EQ"); T(doc, h.x, h.y+13, 2.2, "PANTALLA HMI", "G-TEXT", { halign:1 }); if(tc.switch) eth(sw.x-9, sw.y-20, h.x, h.y+10, "ETHERNET/IP"); }
  if(tc.router){ const r = { x: px0+62, y: py0+38 }; R(doc, r.x-13, r.y-8, 26, 16, "I-EQ"); T(doc, r.x, r.y+11, 2.2, "ROUTER IIOT", "G-TEXT", { halign:1 }); if(tc.switch) eth(sw.x-3, sw.y-28, r.x, r.y+8, "ETHERNET/IP"); }
  if(tc.controladorLimpieza){ const c = { x: px1-40, y: py0+30 }; R(doc, c.x-18, c.y-10, 36, 20, "I-EQ"); T(doc, c.x, c.y-15, 2.0, "CONTROLADOR DE LIMPIEZA", "G-TEXT", { halign:1 }); L(doc, plc.x+10, plc.y-16, c.x, c.y+10, "I-FZA-AC"); }
  // red externa
  if(tc.switch){ L(doc, sw.x+9, sw.y+20, bx1+20, sw.y+20, "I-PROTOCOL"); T(doc, bx1+22, sw.y+19, 2.2, (tc.redExterna||"RED DE CONTROL").toUpperCase(), "G-TEXT", { n:40 }); }
  // variadores
  vfds.forEach((c, k)=>{
    const v = { x: px1 + 30 + k*40, y: py1-120 };
    R(doc, v.x-12, v.y-16, 24, 32, "I-EQ"); T(doc, v.x, v.y+1, 2.4, "VDF", "I-SIM", { halign:1 });
    Tw(doc, v.x-14, v.y+26, 1.9, "VARIADOR DE FRECUENCIA "+(c.load.tag||c.tag), 18, "G-TEXT");
    if(tc.switch) eth(sw.x+9, sw.y+14 - k*3, v.x, v.y+16, k===0 ? "ETHERNET/IP" : "");
  });
  // dispositivos de campo
  const bus = [];
  const fy0 = py0 - 48;
  filas.forEach((fila, r)=>{
    const y = fy0 - r*78;
    const pitch = Math.min(72, (bx1-bx0-40)/Math.max(fila.length,1));
    const xs0 = bx0 + 24;
    const yBus = y + 26;
    const capaFila = fila.every(x=>x.analog) ? "I-SE-ANALO" : "I-FZA-AC";
    L(doc, xs0, yBus, xs0 + pitch*(fila.length-1), yBus, fila.some(x=>!x.analog) ? "I-FZA-AC" : "I-SE-ANALO");
    fila.forEach((dv, k)=>{
      const x = xs0 + k*pitch;
      const capa = dv.analog ? "I-SE-ANALO" : "I-FZA-AC";
      L(doc, x, yBus, x, y+8, capa);
      T(doc, x+1.2, yBus-4, 1.8, dv.analog ? "4-20 mA" : (dv.i.alimentacion||"120 VAC").replace(/\s*\/.*$/,""), "G-TEXT");
      if(dv.salida){ doc.polyline([[x-5,y+8],[x+5,y],[x+5,y+8],[x-5,y],[x-5,y+8]], "I-SIM"); R(doc, x-3, y+8, 6, 4, "I-SIM"); }
      else { doc.circle(x, y+2, 6, "I-SIM"); T(doc, x, y+0.8, 2.0, tipoInstrumento(dv.tag), "I-SIM", { halign:1 }); }
      Tw(doc, x-pitch/2+1.5, y-8, 1.8, (dv.i.descripcion||"").toUpperCase(), Math.max(10, Math.floor(pitch/1.25)), "G-TEXT");
      T(doc, x-pitch/2+1.5, y-17, 1.7, (st?st.replace(/-/g,"")+"-":"")+dv.tag, "G-TEXT", { n:Math.floor(pitch/1.05) });
    });
    bus.push({ x0: xs0, x1: xs0 + pitch*(fila.length-1), y: yBus, analog: fila.every(x=>x.analog) });
  });
  // bajada desde el PLC hacia las filas de campo
  const xd = plc.x;
  if(bus.length){
    L(doc, xd, plc.y-16, xd, py0, "I-CONTROL");
    bus.forEach(b=>{ L(doc, xd, py0, xd, b.y, b.analog ? "I-SE-ANALO" : "I-FZA-AC"); L(doc, Math.min(xd, b.x0), b.y, Math.max(xd, b.x1), b.y, b.analog ? "I-SE-ANALO" : "I-FZA-AC"); });
  }
  tablaLeyenda(doc, A.x1-140, A.y1-30, 132, [
    { layer:"I-SE-ANALO", texto:"Cable de instrumentación (4-20 mA)" }, { layer:"I-FZA-AC", texto:"Cable de control (120 VAC)" },
    { layer:"I-PROTOCOL", texto:"Cable de red Ethernet (Ethernet/IP)" }, { layer:"I-FO", texto:"Fibra óptica monomodo" } ], "LEYENDA");
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
    caja(x0, yTD, x1-x0, 30, `${(D.nombre||"TABLERO DE DISTRIBUCIÓN").toUpperCase()} ${D.tag}`, `${v.tension} VAC`);
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
  caja(xr0, ySrc, xr1 - xr0, 26, ("ALIMENTACIÓN: "+(fuentes.join(" / ")||"EXISTENTE")).toUpperCase(), `${v.tension} VAC, 3F, ${v.frecuencia} Hz`, "G-VARIOS");
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
      if(src){ const y = yTF+15, xa = src.x+src.w, xb = c.x; if(xb>xa){ L(doc, xa, y, xb, y, "E-CONTROL"); T(doc, xa+2, y+1.5, 1.8, `${v.tensionControl} VAC`, "G-TEXT"); } else { L(doc, src.x+src.w-8, yTF+36, src.x+src.w-8, yTF+44, "E-CONTROL"); L(doc, src.x+src.w-8, yTF+44, c.x+8, yTF+44, "E-CONTROL"); L(doc, c.x+8, yTF+44, c.x+8, yTF+36, "E-CONTROL"); } }
    }
  }
  tablaLeyenda(doc, A.x1-150, A.y0+120, 140, [ { layer:"E-FZA", texto:`Cable de fuerza baja tensión (${v.tension} VAC)` }, { layer:"E-CONTROL", texto:`Cable de control, alimentación (${v.tensionControl} VAC)` } ], "LEYENDA");
  return { dxf: doc.toDXF(), hojas:1 };
}

export const GENERADORES = {
  ...GENERADORES2,
  "ele-unifilar": { fn: unifilarFuerza, titulo:"DIAGRAMA UNIFILAR DEL TABLERO DE FUERZA", disciplina:"ELECTRICIDAD" },
  "ins-unifilar-tc": { fn: unifilarControl, titulo:"DIAGRAMA UNIFILAR DEL TABLERO DE CONTROL", disciplina:"INSTRUMENTACIÓN Y CONTROL" },
  "ins-lazo": { fn: lazos, titulo:"DIAGRAMA DE LAZO", disciplina:"INSTRUMENTACIÓN Y CONTROL" },
  "ins-arquitectura": { fn: arquitectura, titulo:"ARQUITECTURA DEL SISTEMA DE CONTROL", disciplina:"INSTRUMENTACIÓN Y CONTROL" },
  "ins-bloques": { fn: bloques, titulo:"DIAGRAMA DE BLOQUES", disciplina:"ELECTRICIDAD, CONTROL E INSTRUMENTACIÓN" },
};

/* DXF → bytes ANSI_1252 (los textos ya vienen restringidos a Latin-1) */
export function dxfBytes(txt){ const out = new Uint8Array(txt.length); for(let i=0;i<txt.length;i++){ const c = txt.charCodeAt(i); out[i] = c<256 ? c : 63; } return out; }

/* Ingenia — DIAGRAMA DE PROCESO E INSTRUMENTACIÓN (P&ID) con el estilo del P&ID de referencia del usuario:
   · equipos del proceso en el orden del flujo (colector de mangas con sus tolvas y válvulas rotativas,
     ventilador con su motor y variador, chimenea hacia la atmósfera, bombas, tanques, tolvas, fajas…) con la
     geometría de los símbolos de la referencia;
   · cada instrumento con su cadena ISA 5.1 como en la referencia: instrumento de campo (círculo) → funciones en
     el PLC (cuadrado con rombo: indicación y alarmas) → visualización en el HMI (círculo en cuadrado);
   · motores con su arrancador (variador o relé) y válvulas solenoides de limpieza en el cabezal de aire.
   Los equipos salen del P&ID del proyecto (Proceso) o, si no se cargaron, de las cargas e instrumentos; los
   instrumentos del listado; las alarmas, de la filosofía de control cuando existe. Todo se reparte y centra en
   la lámina; si no entra, continúa en otra. */
import { DXFDoc } from "../engine/tablero-core.js";
import { dibujarLamina, PASO_HOJAS } from "./formato.js";
import { datos, instrumentos, expandirTag, tipoInstrumento, esAnalogico, esSalida, sistemaTag, sistemaNombre, calcularTodos } from "../datos.js";
import { envolver } from "./kit.js";
import { filosofiaDe } from "../modules/filosofia.js";

const may = s => String(s||"").toUpperCase();
const CAPAS = { "TP-PRI":{ c:5, lt:"CONTINUOUS" }, "TP-SEC":{ c:140, lt:"CONTINUOUS" }, "TP-EQ-PRI":{ c:7, lt:"CONTINUOUS" }, "I-SIM":{ c:60, lt:"CONTINUOUS" }, "I-SE-ANALO":{ c:134, lt:"CONTINUOUS" }, "I-CONTROL":{ c:172, lt:"CONTINUOUS" }, "G-TEX":{ c:7, lt:"CONTINUOUS" }, "G-VARIOS":{ c:40, lt:"CONTINUOUS" } };
// zona de dibujo de la lámina A1 (el rótulo ocupa la esquina inferior derecha; la leyenda va a la derecha)
const ZX0 = 36, ZX1 = 668, ZY0 = 64, ZY1 = 566, YPROC = 150;

/* ---------- equipos del proceso (del P&ID del proyecto o deducidos de cargas e instrumentos) ---------- */
const TIPO_APLIC = { "ventilador-centrifugo":"ventilador", "ventilador-axial":"ventilador", "valvula-rotativa":"valvula-rotativa", "bomba-centrifuga":"bomba", "faja-transportadora":"faja", "compresor-piston":"compresor", molino:"molino", chancadora:"chancadora", agitador:"agitador" };
const ORDEN_FLUJO = { tolva:1, faja:2, chancadora:3, molino:4, tanque:5, bomba:6, agitador:5, colector:10, "valvula-rotativa":11, ventilador:20, chimenea:30, compresor:0, aire:-1, otro:15 };
function equiposProceso(p){
  const d = datos(p);
  let eqs = (d.proceso.equipos||[]).filter(e=>e.tag || e.tipo).map(e=>({ tag:e.tag||"", tipo:e.tipo||"otro", desc:e.descripcion||"" }));
  const cargas = d.cargas.filter(l=>l.kind==="motor");
  if(!eqs.length){
    const tags = instrumentos(p).flatMap(i=>expandirTag(i.tag));
    if(tags.some(t=>/^(XV|PDIT|PDT|LSH)/.test(t))) eqs.push({ tag: sistemaTag(p) || "COLECTOR", tipo:"colector", desc: sistemaNombre(p) || "Colector de polvo" });
    for(const l of cargas){ const t = TIPO_APLIC[l.application]; if(t) eqs.push({ tag:l.tag, tipo:t, desc:l.desc||"" }); }
    if(eqs.some(e=>e.tipo==="ventilador") && eqs.some(e=>e.tipo==="colector")) eqs.push({ tag:"", tipo:"chimenea", desc:"Chimenea" });
  }
  // válvulas rotativas: van bajo las tolvas del colector (no como equipo aparte)
  const col = eqs.find(e=>e.tipo==="colector");
  const rotativas = eqs.filter(e=>e.tipo==="valvula-rotativa");
  if(col){ col.rotativas = rotativas; eqs = eqs.filter(e=>e.tipo!=="valvula-rotativa"); col.n = Math.max(1, Math.min(4, Math.max(rotativas.length, instrumentos(p).flatMap(i=>expandirTag(i.tag)).filter(t=>/^LS/.test(t)).length))); }
  eqs.sort((a, b)=>(ORDEN_FLUJO[a.tipo]??15) - (ORDEN_FLUJO[b.tipo]??15));
  // motor de cada equipo (por TAG o por aplicación)
  const usados = new Set();
  for(const e of eqs){ const l = cargas.find(l=>!usados.has(l) && (l.tag===e.tag || TIPO_APLIC[l.application]===e.tipo)); if(l && e.tipo!=="colector"){ e.motor = l; usados.add(l); } }
  if(col) col.rotativas = (col.rotativas||[]).map(r=>Object.assign(r, { motor: cargas.find(l=>l.tag===r.tag) || cargas.find(l=>!usados.has(l) && l.application==="valvula-rotativa" && usados.add(l)) }));
  return eqs;
}
/* equipo al que se conecta cada instrumento (letras ISA y servicio) */
function asignar(eqs, tag, i){
  const L = tipoInstrumento(tag), sv = (i.servicio||"" + " " + (i.descripcion||"")).toLowerCase();
  const por = tipo => eqs.find(e=>e.tipo===tipo);
  if(/^(XV|SV)$/.test(L) || /^PD/.test(L)) return por("colector") || eqs[0];
  if(/^L/.test(L)) return por("colector") || por("tolva") || por("tanque") || eqs[0];
  if(/^S/.test(L)) return por("colector") || por("faja") || por("agitador") || eqs[0];
  if(/^(V|T)/.test(L) && !/aire/.test(sv)) return por("ventilador") || eqs.find(e=>e.motor) || eqs[0];
  if(/^A/.test(L)) return por("chimenea") || por("ventilador") || eqs[eqs.length-1];
  if(/aire comprimido/.test(sv)) return { tipo:"aire" };
  return eqs.find(e=>sv && e.desc && sv.includes(e.desc.toLowerCase().split(" ")[0])) || eqs[0];
}
/* funciones en el PLC de cada instrumento (indicación y alarmas, ISA 5.1) */
function funciones(tag, i, p, alarmas){
  const L = tipoInstrumento(tag), n = tag.replace(/^[A-Z]+-?/, "");
  // alarmas de la filosofía de control (p. ej. PIT-001_PAL → PAL-001): el P&ID muestra las mismas funciones
  const al = (alarmas||[]).filter(a=>a.instrumento===tag && /_/.test(a.senal||"")).map(a=>String(a.senal).split("_").pop()+"-"+n);
  const ind = esAnalogico(i) ? [L.replace(/I?T$/, "")+"I-"+n] : [];
  if(al.length || ind.length) return [...ind, ...al];
  const m = L.match(/^([A-Z]+?)S([HL]{1,2})$/); if(m) return [m[1]+"A"+m[2]+"-"+n];
  return [];
}

export async function pidKit({ p, valsDe, cliente }){
  const doc = new DXFDoc(); Object.assign(doc.capas, CAPAS);
  let alarmas = []; try{ alarmas = filosofiaDe(p).tablas.alarmas || []; }catch(e){}
  const eqs = equiposProceso(p);
  // instrumentos agrupados (XV-003A@003R se dibuja como un grupo en el cabezal de aire)
  const lazos = [];
  for(const i of instrumentos(p)){
    const tags = expandirTag(i.tag).filter(Boolean); if(!tags.length) continue;
    const L = tipoInstrumento(tags[0]);
    if(/^(XV|SV)$/.test(L) && tags.length > 1){ lazos.push({ tag: tags[0]+"@"+tags[tags.length-1].slice(-1), rango: tags[0]+"@"+tags[tags.length-1].replace(/^[A-Z]+-?/,""), tags, i, grupo:true, eq: asignar(eqs, tags[0], i) }); continue; }
    for(const tag of tags) lazos.push({ tag, i, eq: asignar(eqs, tag, i) });
  }
  // láminas: hasta 22 lazos por lámina (las cadenas se reparten en columnas)
  const POR = 22, hojas = []; for(let k=0; k<Math.max(1, lazos.length); k+=POR) hojas.push(lazos.slice(k, k+POR));
  hojas.forEach((ls, ih)=>{
    const ox = ih*PASO_HOJAS;
    dibujarLamina(doc, ox, 0, valsDe(ih, hojas.length, hojas.length>1 ? { TITULO2:`HOJA ${ih+1} DE ${hojas.length}` } : {}), cliente);
    dibujarHoja(doc, ox, p, eqs, ls, ih, alarmas);
  });
  return { dxf: doc.toDXF(), hojas: hojas.length };
}

/* ---------- símbolos (dimensiones del P&ID de referencia, mm) ---------- */
function flecha(doc, x, y, ang, capa="I-SIM"){ const a = ang*Math.PI/180, l = 2.6, w = 1.1; const bx = x - Math.cos(a)*l, by = y - Math.sin(a)*l; doc.solid([[x, y], [bx - Math.sin(a)*w, by + Math.cos(a)*w], [bx + Math.sin(a)*w, by - Math.cos(a)*w], [bx + Math.sin(a)*w, by - Math.cos(a)*w]], capa); }
function burbuja(doc, x, y, tag, st){ doc.circle(x, y, 5.5, "I-SIM"); doc.text(x, y + 1.6, 1.9, tag, "G-TEX", { halign:1, valign:2 }); if(st) doc.text(x, y - 1.6, 1.6, st, "G-TEX", { halign:1, valign:2 }); }
function funcionPLC(doc, x, y, txt, st){ doc.polyline([[x-5.5, y-5.5], [x+5.5, y-5.5], [x+5.5, y+5.5], [x-5.5, y+5.5], [x-5.5, y-5.5]], "I-SIM"); doc.polyline([[x, y+5.5], [x+5.5, y], [x, y-5.5], [x-5.5, y], [x, y+5.5]], "I-SIM"); doc.text(x, y + 1.4, 1.6, txt, "G-TEX", { halign:1, valign:2 }); if(st) doc.text(x, y - 1.6, 1.4, st, "G-TEX", { halign:1, valign:2 }); }
function hmi(doc, x, y){ doc.polyline([[x-5.5, y-5.5], [x+5.5, y-5.5], [x+5.5, y+5.5], [x-5.5, y+5.5], [x-5.5, y-5.5]], "I-SIM"); doc.circle(x, y, 5.2, "I-SIM"); doc.line(x, y + 1.4, x, y + 2.8, "I-SIM"); }
function motor(doc, x, y, tag){ doc.circle(x, y, 4.2, "TP-EQ-PRI"); doc.text(x, y, 2.4, "M", "G-TEX", { halign:1, valign:2 }); if(tag) doc.text(x + 6, y, 2.0, tag, "G-TEX", { valign:2 }); }
function caja(doc, x, y, txt){ doc.polyline([[x-5, y-4], [x+5, y-4], [x+5, y+4], [x-5, y+4], [x-5, y-4]], "I-SIM"); doc.text(x, y, 1.9, txt, "G-TEX", { halign:1, valign:2 }); }
function solenoide(doc, x, y){ doc.polyline([[x-3, y-1.8], [x+3, y+1.8], [x+3, y-1.8], [x-3, y+1.8], [x-3, y-1.8]], "I-SIM"); doc.line(x, y, x, y + 3.5, "I-SIM"); doc.polyline([[x-1.6, y+3.5], [x+1.6, y+3.5], [x+1.6, y+6.3], [x-1.6, y+6.3], [x-1.6, y+3.5]], "I-SIM"); doc.text(x, y + 4.9, 1.4, "S", "G-TEX", { halign:1, valign:2 }); }

/* dibuja un equipo con su ancla en (x, YPROC) y devuelve sus puertos y puntos de conexión de instrumentos */
function equipo(doc, e, x){
  const y = YPROC, L = "TP-EQ-PRI";
  const rot = (cx, cy, r, tg)=>{ doc.circle(cx, cy, r, L); doc.line(cx - r*0.7, cy - r*0.7, cx + r*0.7, cy + r*0.7, L); doc.line(cx - r*0.7, cy + r*0.7, cx + r*0.7, cy - r*0.7, L); };
  if(e.tipo==="colector"){
    // n módulos de 75 mm: cámara con mangas (pitch 12), placa porta mangas, tolva y válvula rotativa con su motor
    const n = e.n || 1, W = 75*n, x0 = x, yb = y + 30;
    doc.polyline([[x0, yb + 75], [x0, yb + 195], [x0 + W, yb + 195], [x0 + W, yb + 75]], L);
    doc.line(x0, yb + 165, x0 + W, yb + 165, L); doc.line(x0, yb + 75, x0 + W, yb + 75, L);
    for(let m=0; m<n; m++){
      const mx = x0 + 75*m; if(m) doc.line(mx, yb + 75, mx, yb + 195, L);
      for(let k=0;k<5;k++) doc.line(mx + 15 + 12*k, yb + 75, mx + 15 + 12*k, yb + 165, L);
      doc.polyline([[mx, yb + 75], [mx + 23.3, yb], [mx + 51.7, yb], [mx + 75, yb + 75]], L);
      doc.line(mx + 23.3, yb - 9, mx + 51.7, yb - 9, L); doc.line(mx + 23.3, yb, mx + 23.3, yb - 9, L); doc.line(mx + 51.7, yb, mx + 51.7, yb - 9, L);
      rot(mx + 37.5, yb - 21, 11);
      const r = (e.rotativas||[])[m];
      motor(doc, mx + 58, yb - 32, r && r.motor ? r.motor.tag : "");
      doc.line(mx + 37.5, yb - 32, mx + 37.5, yb - 52, "TP-PRI"); flecha(doc, mx + 37.5, yb - 52, -90, "TP-PRI");
      if(r) doc.text(mx + 37.5, yb - 57, 2.0, r.tag, "G-TEX", { halign:1, valign:3 });
    }
    doc.text(x0 - 4, yb + 190, 2.6, may(e.desc || "Colector de polvo"), "G-TEX", { halign:2 }); if(e.tag) doc.text(x0 - 4, yb + 185, 2.4, e.tag, "G-TEX", { halign:2 });
    return { w: W, in:[x0, yb + 130], out:[x0 + W, yb + 180], top: yb + 195, tap:{ aire:[x0 + W/2, yb + 195] }, x0, x1:x0 + W };
  }
  if(e.tipo==="ventilador"){
    const cx = x + 22, cy = y + 12;
    doc.circle(cx, cy, 11, L); doc.circle(cx, cy, 2.3, L);
    doc.polyline([[cx - 6, cy + 9.2], [cx - 8, cy + 20], [cx + 8, cy + 20], [cx + 6, cy + 9.2]], L);
    doc.polyline([[cx - 9, cy - 6.5], [cx - 13, cy - 16], [cx + 13, cy - 16], [cx + 9, cy - 6.5]], L);
    if(e.motor){ motor(doc, cx, cy - 34, e.motor.tag); doc.line(cx, cy - 16, cx, cy - 29.8, L);
      if(e.motor.starter==="vfd"){ caja(doc, cx, cy - 58, "VDF"); doc.line(cx, cy - 38.2, cx, cy - 54, "I-SIM"); flecha(doc, cx, cy - 38.2, 90); } }
    doc.text(cx + 14, cy - 2, 2.4, e.tag, "G-TEX"); doc.text(cx + 14, cy - 6, 2.0, may(e.desc), "G-TEX");
    return { w: 50, in:[cx - 11, cy], out:[cx, cy + 20], top: cy + 20, tap:{}, x0:cx - 13, x1:cx + 13, cx };
  }
  if(e.tipo==="chimenea"){
    const x0 = x + 6, ytop = y + 177;
    doc.polyline([[x0, y], [x0, ytop], [x0 + 21, ytop], [x0 + 21, y]], L);
    doc.polyline([[x0 - 3, y], [x0 + 24, y], [x0 + 24, y - 2], [x0 - 3, y - 2], [x0 - 3, y]], L);
    for(let k=0;k<3;k++) doc.line(x0, ytop - 8 - k*7, x0 + 21, ytop - 18 - k*7, L);
    doc.line(x0 + 10.5, ytop, x0 + 10.5, ytop + 8, L); doc.circle(x0 + 10.5, ytop + 15, 7, L);
    doc.solid([[x0 + 10.5, ytop + 21], [x0 + 4.5, ytop + 15], [x0 + 16.5, ytop + 15], [x0 + 16.5, ytop + 15]], L);
    doc.solid([[x0 + 7.5, ytop + 15], [x0 + 13.5, ytop + 15], [x0 + 7.5, ytop + 9.5], [x0 + 13.5, ytop + 9.5]], L);
    doc.text(x0 + 10.5, ytop + 25, 2.4, "HACIA LA ATMÓSFERA", "G-TEX", { halign:1 });
    return { w: 34, in:[x0, y + 10], out:null, top: ytop, tap:{}, x0:x0, x1:x0 + 21 };
  }
  // equipos genéricos (símbolos ISO 10628 simplificados)
  const cx = x + 20;
  if(e.tipo==="bomba"){ doc.circle(cx, y + 10, 9, L); doc.polyline([[cx - 9, y + 10], [cx + 9, y + 19], [cx + 9, y + 1]], L); doc.polyline([[cx - 6, y + 3], [cx - 9, y - 4], [cx + 9, y - 4], [cx + 6, y + 3]], L); }
  else if(e.tipo==="tanque"){ doc.polyline([[cx - 14, y], [cx - 14, y + 50], [cx + 14, y + 50], [cx + 14, y], [cx - 14, y]], L); doc.line(cx - 14, y + 54, cx + 14, y + 54, L); }
  else if(e.tipo==="tolva"){ doc.polyline([[cx - 16, y + 60], [cx - 16, y + 30], [cx - 4, y + 8], [cx + 4, y + 8], [cx + 16, y + 30], [cx + 16, y + 60], [cx - 16, y + 60]], L); }
  else if(e.tipo==="faja"){ doc.circle(cx - 15, y + 8, 5, L); doc.circle(cx + 15, y + 8, 5, L); doc.line(cx - 15, y + 13, cx + 15, y + 13, L); doc.line(cx - 15, y + 3, cx + 15, y + 3, L); }
  else { doc.polyline([[cx - 14, y], [cx - 14, y + 30], [cx + 14, y + 30], [cx + 14, y], [cx - 14, y]], L); }
  if(e.motor){ motor(doc, cx, y - 14, e.motor.tag); if(e.motor.starter==="vfd") caja(doc, cx, y - 34, "VDF"); }
  doc.text(cx, y + 64, 2.4, e.tag, "G-TEX", { halign:1 }); doc.text(cx, y + 60, 2.0, may(e.desc), "G-TEX", { halign:1 });
  return { w: 44, in:[cx - 14, y + 10], out:[cx + 14, y + 10], top: y + 30, tap:{}, x0:cx - 14, x1:cx + 14, cx };
}

function dibujarHoja(doc, ox, p, eqs, lazos, ih, alarmas){
  const X = x => ox + x, st = (sistemaTag(p)||"").replace(/-/g, "");
  // leyenda (a la derecha)
  const lx = X(692), ly = 560, filasL = [["burbuja","INSTRUMENTO DE CAMPO"],["plc","FUNCIÓN EN EL PLC (INDICACIÓN / ALARMA)"],["hmi","VISUALIZACIÓN EN EL HMI"],["motor","MOTOR ELÉCTRICO"],["sol","VÁLVULA SOLENOIDE"],["proc","LÍNEA DE PROCESO"],["aire","AIRE COMPRIMIDO"],["senal","SEÑAL ELÉCTRICA"]];
  doc.polyline([[lx, ly], [lx + 135, ly], [lx + 135, ly - 10 - filasL.length*14], [lx, ly - 10 - filasL.length*14], [lx, ly]], "G-VARIOS");
  doc.text(lx + 67.5, ly - 5, 3, "LEYENDA", "G-TEX", { halign:1, valign:2 }); doc.line(lx, ly - 10, lx + 135, ly - 10, "G-VARIOS");
  filasL.forEach(([k, txt], i)=>{ const y = ly - 17 - i*14, x = lx + 14;
    if(k==="burbuja") burbuja(doc, x, y, "PIT", ""); else if(k==="plc") funcionPLC(doc, x, y, "PI", ""); else if(k==="hmi") hmi(doc, x, y); else if(k==="motor") motor(doc, x, y, "");
    else if(k==="sol") solenoide(doc, x, y - 2); else if(k==="proc") doc.line(x - 9, y, x + 9, y, "TP-PRI"); else if(k==="aire") doc.line(x - 9, y, x + 9, y, "TP-SEC"); else doc.line(x - 9, y, x + 9, y, "I-SE-ANALO");
    doc.text(lx + 30, y, 2.1, txt, "G-TEX", { valign:2 }); if(i) doc.line(lx, y + 7, lx + 135, y + 7, "G-VARIOS"); });

  // ---------- equipos en el orden del flujo, centrados ----------
  const ancho = e => e.tipo==="colector" ? 75*(e.n||1) : e.tipo==="ventilador" ? 50 : e.tipo==="chimenea" ? 34 : 44;
  const GAP = 46, W = eqs.reduce((a, e)=>a + ancho(e), 0) + GAP*Math.max(0, eqs.length-1);
  let x = ZX0 + Math.max(30, ((ZX1 - ZX0) - W)/2);
  const pos = new Map();
  for(const e of eqs){ pos.set(e, equipo(doc, e, X(x))); x += ancho(e) + GAP; }
  // líneas de proceso entre equipos (ortogonales)
  const lista = eqs.map(e=>pos.get(e));
  if(lista.length && lista[0].in){ const [a, b] = lista[0].in; doc.line(a - 40, b, a, b, "TP-PRI"); flecha(doc, a, b, 0, "TP-PRI"); doc.text(a - 40, b + 3, 2.2, eqs[0].tipo==="colector" ? "CAPTACIÓN DE POLVO" : "ALIMENTACIÓN", "G-TEX"); }
  for(let k=0; k<lista.length-1; k++){
    const a = lista[k].out, b = lista[k+1].in; if(!a || !b) continue;
    const xm = (a[0] + b[0])/2;
    doc.polyline([a, [xm, a[1]], [xm, b[1]], b], "TP-PRI"); flecha(doc, b[0], b[1], 0, "TP-PRI");
  }

  // ---------- cadenas de instrumentos: campo → PLC → HMI (columnas sobre su equipo, sin cruzarse) ----------
  const col = eqs.find(e=>e.tipo==="colector");
  const colP = col ? pos.get(col) : null;
  // cabezal de aire comprimido sobre el colector (válvulas solenoides de limpieza)
  let yAire = null;
  if(colP){ yAire = colP.tap.aire[1] + 22; doc.line(colP.x0 - 30, yAire, colP.x1 + 10, yAire, "TP-SEC"); doc.text(colP.x0 - 30, yAire + 2, 2.0, "AIRE COMPRIMIDO", "G-TEX"); }
  const cadenas = lazos.map(lz=>{
    const aire = lz.eq && lz.eq.tipo==="aire";
    const P = aire ? colP : (lz.eq ? pos.get(lz.eq) : null) || lista[0];
    return { lz, P, aire };
  });
  // cada equipo con sus instrumentos encima, centrados en el equipo; los grupos se empujan para no superponerse
  const SEP = 15, grupos = [];
  for(const c of cadenas){ const k = c.aire ? "aire" : c.P; let g = grupos.find(g=>g.k===k); if(!g){ g = { k, P:c.P, cs:[], aire:c.aire }; grupos.push(g); } g.cs.push(c); }
  grupos.forEach(g=>{ g.cx = g.aire ? (g.P ? g.P.x0 - 22 : X(ZX0 + 30)) : g.P ? (g.P.x0 + g.P.x1)/2 : X(ZX0 + 40); g.w = (g.cs.length - 1)*SEP; g.ini = g.cx - g.w/2; });
  grupos.sort((a, b)=>a.cx - b.cx);
  for(let k=0;k<grupos.length;k++){ const g = grupos[k]; g.ini = Math.max(g.ini, X(ZX0 + 8), k ? grupos[k-1].ini + grupos[k-1].w + SEP : -Infinity); }
  const ult = grupos[grupos.length-1]; if(ult){ const exc = ult.ini + ult.w - X(ZX1 - 6); if(exc > 0) for(let k=grupos.length-1, lim = X(ZX1 - 6); k>=0; k--){ const g = grupos[k]; g.ini = Math.min(g.ini, lim - g.w); lim = g.ini - SEP; } }
  grupos.forEach(g=>g.cs.forEach((c, i)=>{ c.x = g.ini + i*SEP; c.grupo = g; }));
  const yB = 420, yF0 = 455, yH = 545;
  cadenas.forEach((c, k)=>{
    const { lz } = c, xc = c.x;
    if(lz.grupo){
      // válvulas solenoides en el cabezal de aire (una por módulo del colector) y el controlador de limpieza
      const n = Math.min(lz.tags.length, colP ? (col.n||1)*3 : 3), x0 = colP ? colP.x0 + 10 : xc;
      for(let j=0;j<n;j++){ const xs = x0 + j*((colP ? colP.x1 - colP.x0 - 20 : 30)/Math.max(1, n-1)); doc.line(xs, yAire, xs, yAire - 6, "TP-SEC"); solenoide(doc, xs, yAire - 8); }
      doc.text(colP ? colP.x1 + 12 : x0, yAire + 2, 2.0, `${lz.tags.length} VÁLVULAS SOLENOIDES ${lz.rango}`, "G-TEX");
      burbuja(doc, xc, yB, lz.tag.replace(/^([A-Z]+)-/, "$1-").slice(0, 12), st);
      doc.line(xc, yB - 5.5, xc, yAire - 2, "I-CONTROL");
      caja(doc, xc, yF0 + 5, "PDC"); doc.line(xc, yB + 5.5, xc, yF0 + 1, "I-CONTROL"); flecha(doc, xc, yB + 5.5, -90, "I-CONTROL");
      return;
    }
    // instrumento de campo y su conexión al proceso: bajada recta al equipo (o al cabezal de aire)
    burbuja(doc, xc, yB, lz.tag, st);
    const P = c.P;
    if(c.aire && yAire!=null){ doc.line(xc, yB - 5.5, xc, yAire, "I-SE-ANALO"); doc.circle(xc, yAire, 0.7, "I-SE-ANALO"); }
    else if(P){
      const xe = Math.min(Math.max(xc, P.x0 + 3), P.x1 - 3), ye = P.top;
      if(Math.abs(xe - xc) < 0.1) doc.line(xc, yB - 5.5, xc, ye, "I-SE-ANALO");
      else { const yq = ye + 8 + (c.grupo.cs.indexOf(c) % 4)*3; doc.polyline([[xc, yB - 5.5], [xc, yq], [xe, yq], [xe, ye]], "I-SE-ANALO"); }
      doc.circle(xe, ye, 0.7, "I-SE-ANALO");
    }
    // funciones en el PLC (apiladas) y visualización en el HMI
    const fs = funciones(lz.tag, lz.i, p, alarmas);
    let y = yF0;
    doc.line(xc, yB + 5.5, xc, y - 5.5, "I-SIM"); flecha(doc, xc, y - 5.5, 90);
    fs.slice(0, 3).forEach((f, j)=>{ funcionPLC(doc, xc, y, f, st); y += 11; });
    if(!fs.length) y += 0;
    doc.line(xc, y - 5.5, xc, yH - 5.5, "I-SIM"); flecha(doc, xc, yH - 5.5, 90);
    hmi(doc, xc, yH);
  });
  // franja del sistema de control
  if(cadenas.length){ doc.line(X(ZX0), yF0 - 12, X(ZX1), yF0 - 12, "G-VARIOS"); doc.text(X(ZX0), yF0 - 9, 2.2, "SISTEMA DE CONTROL (PLC / HMI)", "G-TEX"); doc.text(X(ZX0), yF0 - 16, 2.2, "CAMPO", "G-TEX"); }
  doc.text(X(ZX0), ZY1 + 4, 3, may(sistemaNombre(p) || "PROCESO") + (sistemaTag(p) ? " " + sistemaTag(p) : ""), "G-TEX");
}

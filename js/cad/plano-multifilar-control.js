/* Ingenia — DIAGRAMA MULTIFILAR DEL TABLERO DE CONTROL - CONEXIONADO DE E/S armado con las piezas del plano de
   referencia del usuario (assets/plantillas/planos/multifilar_control.json, extraído con tools/planos/piezas_mfc.py).
   Hojas por tablero de control, en el orden de la referencia:
   · acometidas: estabilizada (TB1 → MCB1, fuente de 24 Vdc, distribución de 120 Vac) y auxiliar desde el tablero de
     fuerza (TB2 → MCB2, supresor de sobretensiones);
   · distribución de 120 Vac: una columna por circuito (ITM 2P → TB3 → campo, o flechas a las hojas que alimenta) y
     las derivaciones de tierra de los equipos;
   · servicios de 220 Vac: ventilación con termostato, luminaria con interruptor de puerta, tomacorriente con diferencial;
   · PLC: CPU, módulos por slot, distribuidor de potencial y tapa terminadora;
   · distribución de 24 Vdc: fusibles-borne XF1 con la alimentación del PLC, HMI, switch, router y módulos;
   · entradas analógicas, salidas analógicas, salidas digitales con sus relés de interfaz, contactos de los relés y
     entradas digitales (8 canales por hoja, reservas incluidas, como el listado I/O);
   · controlador de limpieza con sus válvulas solenoides.
   Todo sale de equiposControl() (mismos TAG que el unifilar, el mecánico y los lazos). Las columnas se reparten y
   centran en el ancho útil de cada hoja; las hojas se agregan o quitan según los datos. Las referencias cruzadas
   (hoja.columna:fila) se calculan en una primera pasada con la ubicación real de cada flecha. */
import { DXFDoc } from "../engine/tablero-core.js";
import { dibujarLamina, PASO_HOJAS } from "./formato.js";
import { cargarKit, usarKit, pieza, envolver } from "./kit.js";
import { datos, tablerosControl, tc, tableros, tableroPorId, instrumentos, expandirTag } from "../datos.js";
import { equiposControl } from "../control/equipos.js";

const DX = 25, DY = -112;                         // hoja del plano de referencia → área útil de la lámina A1
const BUS = { l:["EPLAN540",5], pe:["EPLAN547",150], l1:["EPLAN540",1], l2:["EPLAN541",1], v24:["EPLAN540",180], v0:["EPLAN541",180],
  ret:["EPLAN542",5], di:["EPLAN540",5], sh:["EPLAN546",150], campo:["EPLAN311",250,"EPL_DASH"], caja:["EPLAN100",90,"EPL_DASH"] };
const QUITAR = /^\/?\s*\d+\.[A-H]:\d+\s*\/?$|^\/$/;   // referencias cruzadas del plano original: las dibuja el generador
const up = s => String(s||"").toUpperCase();
const amp = a => `${a}A`;
const sinAl = s => String(s||"").replace(/^alimentaci[oó]n\s+(a\s+las|a\s+los|al|a)\s+/i, "");

/* zona del marco A1 (columnas A-H, filas 1-5) de un punto de la lámina */
function zona(X, Y){
  const c = Math.max(0, Math.min(7, Math.floor((X-24)/100.75))), f = Math.max(1, Math.min(5, 1+Math.floor((578.5-Y)/113.8)));
  return "ABCDEFGH"[c]+":"+f;
}
/* reemplazo de textos fijos de una pieza por su posición: subs = [[x, y, valor]] (bornes cuyo número se repite en la pieza) */
function textos(subs=[]){
  return (s, e)=>{ for(const [x, y, v] of subs) if(Math.abs(e[4]-x)<0.6 && Math.abs(e[5]-y)<0.6) return v; return s; };
}
/* reparte n elementos en grupos de hasta `max`, lo más parejos posible */
function grupos(arr, max){
  if(!arr.length) return [];
  const n = Math.ceil(arr.length/max), out = []; let i = 0;
  for(let k=0;k<n;k++){ const m = Math.ceil((arr.length-i)/(n-k)); out.push(arr.slice(i, i+m)); i += m; }
  return out;
}
const trozos = (arr, n) => { const out = []; for(let i=0;i<arr.length;i+=n) out.push(arr.slice(i, i+n)); return out; };

/* lámina actual, colocación de piezas y registro de flechas para las referencias cruzadas */
class Plano {
  constructor(doc, kit, reg, valsDe, cliente, total){ Object.assign(this, { doc, kit, reg, valsDe, cliente, total, k:-1, nuevo:new Map(), dy:0, ox:0 }); }
  hoja(titulo2, dy=0){ this.k++; this.dy = dy; this.ox = this.k*PASO_HOJAS; dibujarLamina(this.doc, this.ox, 0, this.valsDe(this.k, this.total, { TITULO2: titulo2 }), this.cliente); }
  pz(nombre, x, o={}){ const s = o.s||1, yc = o.yc||0; pieza(this.doc, this.kit, nombre, this.ox+DX+x, DY+this.dy+(o.dy||0)+yc*(1-s), Object.assign({ quitar:QUITAR }, o)); }
  /* referencia cruzada (hoja.columna:fila) junto a la etiqueta de una flecha, separada según el largo de la etiqueta:
     dir "abajo" (etiqueta vertical que termina en y), "arriba" (vertical que empieza en y), "izq" (horizontal que termina
     en x) o "der" (horizontal que empieza en x; si no cabe en la lámina va debajo de la etiqueta) */
  refEt(x, y, etq, clave, dir){
    const r = this.ref(clave); if(!r) return;
    const L = String(etq||"").length*4.52*0.72 + 1.5, o = { capa:"EPLAN442", c:73, va:2 };
    if(dir==="abajo") this.texto(x, y-L, 3.25, r+" /", Object.assign(o, { rot:90, ha:2 }));
    else if(dir==="arriba") this.texto(x, y+L, 3.25, "/ "+r, Object.assign(o, { rot:90, ha:0 }));
    else if(dir==="izq") this.texto(x-L, y, 3.25, r+" /", Object.assign(o, { ha:2 }));
    else if(x+L+r.length*2.4 > 804) this.texto(x, y-5.5, 3.25, "/"+r, Object.assign(o, { ha:0 }));
    else this.texto(x+L, y, 3.25, "/ "+r, Object.assign(o, { ha:0 }));
  }
  marca(clave, x, y){ if(!this.nuevo.has(clave)) this.nuevo.set(clave, { hoja:this.k+1, X:DX+x, Y:DY+this.dy+y }); }
  ref(clave){ const r = this.reg.get(clave); return r ? `${r.hoja}.${zona(r.X, r.Y)}` : ""; }
  linea(x1, y1, x2, y2, [capa, c, lt]){ if(Math.abs(x1-x2)<0.01 && Math.abs(y1-y2)<0.01) return; this.doc.line(this.ox+DX+x1, DY+this.dy+y1, this.ox+DX+x2, DY+this.dy+y2, capa, { c, lt }); }
  arco(x, y, r, a1, a2, [capa, c]){ this.doc.arc(this.ox+DX+x, DY+this.dy+y, r, a1, a2, capa, { c }); }
  texto(x, y, h, s, o={}){ if(s) this.doc.text(this.ox+DX+x, DY+this.dy+y, h, s, o.capa||"EPLAN108", { c:o.c, halign:o.ha, valign:o.va, rot:o.rot }); }
  /* texto de varias líneas (cortado a n caracteres) con su primera línea arriba en y */
  textoN(x, y, h, s, n, o={}){ String(s||"").split("\n").flatMap(l=>envolver(l, n)).forEach((l, i)=>this.texto(x, y - i*h*1.6667, h, l, Object.assign({ va:3 }, o))); }
}

export async function multifilarControlKit({ p, valsDe, cliente }){
  const kit = await cargarKit("multifilar_control");
  const lista = tablerosControl(p).length ? tablerosControl(p) : [tc(p)];
  const eqs = lista.map(t=>equiposControl(p, t));
  // dos pasadas: la primera ubica cada flecha (hoja y zona); la segunda dibuja con las referencias cruzadas resueltas
  let reg = new Map(), total = 0;
  for(let pasada=0; pasada<2; pasada++){
    const doc = new DXFDoc(); usarKit(doc, kit);
    const P = new Plano(doc, kit, reg, valsDe, cliente, total);
    for(const eq of eqs) tableroControl(P, p, eq);
    if(pasada) return { dxf: doc.toDXF(), hojas: P.k+1 };
    reg = P.nuevo; total = P.k+1;
  }
}

/* ======================= hojas de un tablero de control ======================= */
function tableroControl(P, p, eq){
  const t = eq.tablero, v = eq.v, pre = (t.tag||"TC")+"|";
  const K = s => pre+s;                                         // claves de flechas del tablero
  const nombre = `${up(t.nombre||"Tablero de control")} ${t.tag||""}`.trim();
  const est = eq.acometidas.find(a=>a.id==="est"), aux = eq.acometidas.find(a=>a.id==="aux");
  const c24 = eq.circuitos.filter(c=>c.barra==="24 Vdc"), c120 = eq.circuitos.filter(c=>c.barra==="120 Vac"), c220 = eq.circuitos.filter(c=>c.barra!=="24 Vdc" && c.barra!=="120 Vac");
  const cbDI = c120.find(c=>/entradas digitales/i.test(c.descripcion||"")), cbDO = c120.find(c=>/salidas digitales/i.test(c.descripcion||""));
  const cbL = eq.limpieza ? c120.find(c=>/limpieza/i.test(c.descripcion||"")) : null;
  const bornera = tag => eq.borneras.find(b=>b.tag===tag);
  const modBorne = (tag, i=0) => { const b = (bornera(tag)||{}).bornes||[]; return (b[i<0 ? b.length+i : i]||{}).modelo || ""; };
  const inst = new Map(); for(const i of instrumentos(p)||[]) for(const tg of expandirTag(i.tag)) inst.set(tg, i);
  const ps = eq.fuente ? eq.fuente.ps.tag : "PS1", cb3 = eq.cb120 ? eq.cb120.tag : "CB3";
  const hmi = eq.red.find(r=>r.tipo==="hmi"), sw = eq.red.find(r=>r.tipo==="switch"), rut = eq.red.find(r=>r.tipo==="router");
  // derivaciones de tierra de los equipos (PE4, PE5…) desde la barra de tierra de la distribución
  const peDev = [{ id:"plc" }, hmi && { id:"hmi" }, sw && { id:"sw" }, rut && { id:"rut" }, eq.limpieza && { id:"limp" }].filter(Boolean).map((d, i)=>Object.assign(d, { pe:`PE${4+i}` }));
  const peDe = id => (peDev.find(d=>d.id===id)||{}).pe || "";
  // circuito de 24 Vdc de cada equipo y sus flechas (borne A = +24 V con fusible, B = 0 V)
  const c24De = re => c24.find(c=>!c.reserva && re.test(c.descripcion||""));
  const fA = c => c ? c.borne+"A" : "", fB = c => c ? c.borne+"B" : "";
  const destino = s => { const l = datos(p).cargas.find(l=>l.tag && l.tag===s.tag); const tb = l ? tableroPorId(p, l.tablero) : tableros(p).find(x=>x.tag && String(s.tag||"").includes(x.tag)); return `TABLERO DE FUERZA${tb && tb.tag ? " "+tb.tag : ""}`; };
  const reL = eq.limpieza ? new RegExp(eq.limpieza.tag.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")+"|limpieza", "i") : null;
  const deLimpieza = s => !!reL && s.origen!=="reserva" && reL.test(`${s.alimentacion||""} ${s.descripcion||""}`);
  const bornes = s => String(s.terminales||"").split("/").map(x=>x.trim().replace(/^.*:/,""));
  const ctx = { P, p, eq, t, v, pre, K, nombre, est, aux, c24, c120, c220, cbDI, cbDO, cbL, bornera, modBorne, inst, ps, cb3, hmi, sw, rut, peDev, peDe, c24De, fA, fB, destino, deLimpieza, bornes };
  hAcometidas(ctx); hDistribucion(ctx); if(c220.length) hServicios(ctx); hPLC(ctx); if(c24.length) hVdc(ctx);
  for(const m of eq.plc.modulos.filter(m=>m.tipo==="AI")) hAI(ctx, m);
  for(const m of eq.plc.modulos.filter(m=>m.tipo==="AO")) hAO(ctx, m);
  hDO(ctx); hContactos(ctx); hDI(ctx); if(eq.limpieza) hLimpieza(ctx);
}

/* flecha que sale (s) o entra (e) de la hoja: la marca para las referencias y escribe la referencia al otro extremo */
function flecha(P, K, etq, io, x, y, xe, ye, dir){
  if(!etq) return;
  P.marca(K(etq+(io==="s" ? ">" : "<")), x, y);
  P.refEt(xe, ye, etq, K(etq+(io==="s" ? "<" : ">")), dir);
}

/* ---------- 1) acometidas ---------- */
function hAcometidas(c){
  const { P, eq, v, K, est, aux, ps, cb3, c220, nombre } = c;
  P.hoja(`${nombre} - ACOMETIDAS`);
  const dx = aux ? 0 : 130;                                       // sin acometida auxiliar: la mitad estabilizada al centro
  const tbm = b => { const x = c.bornera(b); return x ? `${x.bornes[0].modelo}/${x.bornes[x.bornes.length-1].modelo}` : ""; };
  const desde = a => up(`VIENE DE ${a.desde||"-"}${a.circuito ? " CIRCUITO "+a.circuito : ""}`);
  const alim = a => `Alimentación\n${a.tension} ${v.frecuencia} Hz ${a.fases}`;
  P.pz("a_est", dx, { lineas:{ desde:30 }, vars:{ desde:desde(est), alim:alim(est), tb:est.tb, tbm:tbm(est.tb), q:est.q.tag, qv:amp(est.q.in), qm:est.q.modelo, pe:"PE.1", nota:"(NOTA 1)" } });
  flecha(P, K, "PE.1", "s", dx+376, 632, dx+376, 632.4, "der");
  if(eq.fuente){
    const f = eq.fuente;
    P.pz("a_cb1", dx, { vars:{ q:f.cb.tag, qv:amp(f.cb.in), qm:f.cb.modelo } });
    P.pz("a_ps", dx, { vars:{ ps:f.ps.tag, psv:amp(f.ps.a), psm:f.ps.modelo } });
    P.pz("a_cb2", dx, { vars:{ q:f.cbOut.tag, qv:amp(f.cbOut.in), qm:f.cbOut.modelo, a1:`${ps}.-`, a2:`${ps}.+`, desc:"FUENTE DE 24 VDC" } });
    flecha(P, K, `${ps}.-`, "s", dx+236, 297, dx+236.45, 296.85, "abajo"); flecha(P, K, `${ps}.+`, "s", dx+268, 297, dx+268.45, 296.85, "abajo");
  }
  if(eq.cb120){
    const q = eq.cb120;
    P.pz("a_cb3", dx, { lineas:{ desc:22 }, vars:{ q:q.tag, qv:amp(q.in), qm:q.modelo, a1:`${q.tag}.2`, a2:`${q.tag}.4`, desc:`DISTRIBUCIÓN\n${up(eq.vEst)}` } });
    flecha(P, K, `${cb3}.2`, "s", dx+320, 297, dx+320.45, 296.85, "abajo"); flecha(P, K, `${cb3}.4`, "s", dx+352, 297, dx+352.45, 296.85, "abajo");
  }
  const s = eq.spd, m = s.modelo.indexOf("-"), m1 = m>0 ? s.modelo.slice(0, m+1) : s.modelo, m2 = m>0 ? s.modelo.slice(m+1) : "";
  const spd = { q:s.cb.tag, qv:amp(s.cb.in), qm:s.cb.modelo, s1:s.tags[0], s2:s.tags[1], tipo:s.tipo, m1, m2 };
  if(aux){
    const q = aux.q.tag, serv = c220.map(x=>sinAl(x.descripcion).replace(/ interna$/i,"")).join(", ");
    P.pz("a_aux", 0, { lineas:{ desde:30, desc:30 }, vars:{ desde:desde(aux), alim:alim(aux), tb:aux.tb, tbm:tbm(aux.tb), q, qv:amp(aux.q.in), qm:aux.q.modelo,
      a1:`${q}.2`, a2:`${q}.4`, pe:"PE.2", nota:"(NOTA 2)", desc:up(`Alimentación servicios del tablero${serv ? " ("+serv+")" : ""}`) } });
    flecha(P, K, "PE.2", "s", 778, 632, 778, 632.4, "der");
    flecha(P, K, `${q}.2`, "s", 626, 297, 626.45, 296.85, "abajo"); flecha(P, K, `${q}.4`, "s", 658, 297, 658.45, 296.85, "abajo");
    P.pz("a_spd", 0, { vars:spd });
  } else {
    // supresor colgado de la barra estabilizada, a continuación de la distribución
    const xs = dx+440;
    P.linea(dx+320, 664.85, xs, 664.85, BUS.l); P.linea(dx+352, 648.85, xs+32, 648.85, BUS.l);
    P.pz("a_spd", xs-702, { vars:spd });
    P.linea(xs+50, 632.85, xs+66, 632.85, BUS.pe); P.texto(xs+66, 630.2, 3.25, "PE", { capa:"EPLAN420", c:7, ha:1, va:3 });
  }
  P.pz("leyenda", 18);
  const notas = ["NOTAS:", `1. LA ACOMETIDA DE ${up(est.tension)} (${est.fases}, ${v.frecuencia} HZ) PARA EL ${nombre} ES SUMINISTRADA POR EL CLIENTE.`,
    aux && `2. LA ACOMETIDA DE ${up(aux.tension)} (${aux.fases}, ${v.frecuencia} HZ) ES SUMINISTRADA DESDE EL ${up(aux.desde)}.`,
    `${aux ? 3 : 2}. LA BARRA DE TIERRA DEL TABLERO DE CONTROL SERÁ AISLADA (INSTRUMENTACIÓN) Y DE PROTECCIÓN.`,
    `${aux ? 4 : 3}. LOS EQUIPOS ELÉCTRICOS Y DE PROTECCIÓN ESTÁN DISEÑADOS Y FABRICADOS PARA TRABAJAR A ${v.altitud} m.s.n.m.`].filter(Boolean);
  P.pz("notas", 15, { lineas:{ notas:150 }, vars:{ notas: notas.join("\n") } });
}

/* ---------- 2) distribución de 120 Vac ---------- */
function hDistribucion(c){
  const { P, eq, K, c120, cb3, nombre, peDev } = c;
  if(!c120.length && !peDev.length) return;
  const cols = c120.map(x=>({ c:x, tipo: x.reserva ? "res" : ((/limpieza/i.test(x.descripcion||"") && eq.limpieza) || !x.campo) ? "int" : "campo" }));
  const taps = peDev.map(d=>({ tipo:"pe", d }));
  // hojas: hasta 8 columnas de 84 mm por hoja, repartidas parejas; las derivaciones de tierra van en la última
  const X0 = 38, X1 = 770, ANCHO = X1-X0, wTaps = taps.length ? taps.length*26 + 20 + 30 : 30;
  let hojas = [[]];
  for(let n = Math.max(1, Math.ceil(cols.length/8)); n<60; n++){
    hojas = cols.length ? grupos(cols, Math.ceil(cols.length/n)) : [[]];
    if(hojas.every(h=>h.length*84 <= ANCHO) && hojas[hojas.length-1].length*84 + wTaps <= ANCHO) break;
  }
  hojas[hojas.length-1] = hojas[hojas.length-1].concat(taps);
  const v120 = up(eq.vEst);
  hojas.forEach((items, i)=>{
    const sigue = i < hojas.length-1, nh = hojas.length;
    P.hoja(`${nombre} - DISTRIBUCIÓN ${v120}${nh>1 ? ` (${i+1} DE ${nh})` : ""}`);
    // columnas de 84 mm (hasta 100 mm si sobra espacio) centradas en el ancho útil; las derivaciones de tierra juntas al final
    const nc = items.filter(x=>x.tipo!=="pe").length, nt = items.length - nc, extra = sigue ? 0 : (nt ? nt*26 + (nc ? 20 : 0) : 0) + 30;
    const p = nc ? Math.min(100, Math.max(84, (ANCHO - extra)/nc)) : 84;
    let x = X0 + (ANCHO - nc*p - extra)/2, ultL = null, xFin = 750;
    items.forEach((it, k)=>{
      if(it.tipo==="pe"){ if(k===nc && nc) x += 20; it.x = x+13; x += 26; return; }
      it.x = x + 28 + (p-84)/2; ultL = it.x; x += p;
    });
    if(!sigue) xFin = Math.min(756, Math.max(x + 14, (ultL||0) + 70));
    // barras L, N y PE (continuas entre las flechas de entrada y salida)
    const lastL = ultL!=null ? ultL : 66;
    P.linea(40, 664.85, sigue ? 756 : lastL, 664.85, BUS.l);
    P.linea(40, 648.85, sigue ? 756 : lastL+32, 648.85, BUS.l);
    P.linea(58, 632.85, sigue ? 728 : xFin-4, 632.85, BUS.pe);
    // flechas de entrada (desde la acometida o la hoja anterior) y de salida a la hoja siguiente
    const eL = i ? `d120:${i}:L` : `${cb3}.2`, eN = i ? `d120:${i}:N` : `${cb3}.4`, ePE = i ? `d120:${i}:PE` : "PE.1";
    P.pz("d_bus_izq", 0, { vars:{ l1:`${cb3}.2`, l2:`${cb3}.4`, pe: i ? "PE.3" : "PE.1", v:v120 } });
    const ent = (clave, y)=>{ P.marca(K(clave+"<"), 34, y); P.refEt(34, y+0.4, i ? "CB0.0" : clave, K(clave+">"), "izq"); };
    ent(eL, 664); ent(eN, 648); ent(ePE, 632);
    if(sigue){
      const kS = `d120:${i+1}:`;
      P.pz("d_bus_der", 712, { vars:{ l1:`${cb3}.2`, l2:`${cb3}.4`, pe:"PE.3", v:v120 } });
      for(const [s, y] of [["L", 664.4], ["N", 648.4], ["PE", 632.4]]){ P.marca(K(kS+s+">"), 762, y); P.refEt(762, y, s==="PE" ? "PE.3" : `${cb3}.2`, K(kS+s+"<"), "der"); }
    } else P.pz("d_fin", xFin);
    let primerCampo = true;
    for(const it of items){
      if(it.tipo==="pe"){
        P.pz("d_pe", it.x, { vars:{ pe:it.d.pe } });
        flecha(P, K, it.d.pe, "s", it.x, 569, it.x+0.46, 568.85, "abajo"); continue;
      }
      const q = it.c, base = { q:q.tag, qv:amp(q.in), qm:q.modelo, desc:up(q.reserva ? "Reserva" : q.descripcion) };
      if(it.tipo==="int"){
        const a1 = `${q.tag}.2`, a2 = `${q.tag}.4`;
        P.pz("d_int", it.x, { lineas:{ desc:24 }, vars:Object.assign(base, { a1, a2 }) });
        flecha(P, K, a1, "s", it.x, 295, it.x+0.45, 294.85, "abajo"); flecha(P, K, a2, "s", it.x+32, 295, it.x+32.45, 294.85, "abajo");
      } else if(it.tipo==="res") P.pz("d_res", it.x, { lineas:{ desc:24 }, vars:base });
      else {
        const [b1, b2] = String(q.borne||"").replace(/^[^.]*\./,"").split("/");
        if(primerCampo){ const tb = String(q.borne||"TB3").split(".")[0]; P.pz("d_tb", it.x, { vars:{ tb, tbs:"4mm2", tbm:c.modBorne(tb, 0), tbpe:c.modBorne(tb, -1) } }); primerCampo = false; }
        P.pz("d_campo", it.x, { lineas:{ desc:24 }, vars:base, texto: textos([[2.8, 377.4, b1||""], [34.8, 377.4, b2||""]]) });
      }
    }
    if(!sigue) P.pz("leyenda", 18, { dy:-42 });
  });
}

/* ---------- 3) servicios de 220 Vac ---------- */
function hServicios(c){
  const { P, K, aux, c220, cb3, nombre, eq } = c;
  const TIPO = { vent:{ w:175, o:42 }, lum:{ w:100, o:38 }, toma:{ w:115, o:50 }, gen:{ w:100, o:38 } };
  const cols = c220.map(x=>({ c:x, tipo: /ventila/i.test(x.descripcion) ? "vent" : /luminaria/i.test(x.descripcion) ? "lum" : /tomacorriente/i.test(x.descripcion) ? "toma" : "gen" }));
  const X0 = 64, X1 = 756, hojas = [[]]; let w = 0;
  for(const it of cols){ const a = TIPO[it.tipo].w + 16; if(hojas[hojas.length-1].length && w + a > X1-X0){ hojas.push([]); w = 0; } hojas[hojas.length-1].push(it); w += a; }
  const l1 = aux ? `${aux.q.tag}.2` : `${cb3}.2`, l2 = aux ? `${aux.q.tag}.4` : `${cb3}.4`, pe = aux ? "PE.2" : "PE.1", vt = up(aux ? aux.tension : eq.vEst);
  hojas.forEach((items, i)=>{
    P.hoja(`${nombre} - SERVICIOS ${vt}${hojas.length>1 ? ` (${i+1} DE ${hojas.length})` : ""}`);
    // columnas separadas por espacios iguales y centradas en el ancho útil
    const W = items.reduce((a, it)=>a+TIPO[it.tipo].w, 0), g = Math.max(12, Math.min(140, (X1-X0-W)/(items.length+1)));
    let x = X0 + (X1-X0 - W - g*(items.length-1))/2, ultL = 78;
    for(const it of items){ it.x = x + TIPO[it.tipo].o; ultL = it.x; x += TIPO[it.tipo].w + g; }
    P.linea(40, 664.85, ultL, 664.85, BUS.l1); P.linea(40, 648.85, ultL+32, 648.85, BUS.l2); P.linea(64, 632.85, 764, 632.85, BUS.pe);
    P.pz("s_bus_izq", 0, { vars:{ l1, l2, pe, v:vt } });
    if(aux && !i){ flecha(P, K, l1, "e", 34, 664, 34, 664.4, "izq"); flecha(P, K, l2, "e", 34, 648, 34, 648.4, "izq"); flecha(P, K, pe, "e", 34, 632, 34, 632.4, "izq"); }
    P.pz("s_fin", 768);
    for(const it of items){
      const q = it.c, ex = q.extra||{}, [b1, b2] = String(q.borne||"").replace(/^[^.]*\./,"").split("/"), tb = String(q.borne||"TB4").split(".")[0];
      const base = { q:q.tag, qv:amp(q.in), qm:q.modelo, tb, tbs:"4mm2", tbm:c.modBorne(tb, 0) };
      const nums = xs => textos(xs.map((x, k)=>[x, 393.4, k%2 ? (b2||"") : (b1||"")]));
      if(it.tipo==="vent") P.pz("s_vent", it.x, { vars:Object.assign(base, { th:ex.termostato||"", thv:"0-60 °C", thm:"", v1:(ex.ventiladores||[])[0]||"", v2:(ex.ventiladores||[])[1]||"", vv:"", vm:"", v1d:"VENTILADOR", v2d:"EXTRACTOR" }),
        texto: nums([2.8, 34.8, 86.8, 118.8]) });
      else if(it.tipo==="toma"){
        const id = q.id||{}, mm = String(id.modelo||""), k = mm.indexOf("-");
        P.pz("s_toma", it.x, { vars:Object.assign(base, { id:id.tag||"", ids:id.sens ? id.sens.replace(/mA/," mA") : "", idv:id.in ? `${id.in} A` : "", idm1:k>0 ? mm.slice(0, k) : mm, idm2:k>0 ? mm.slice(k) : "", tm:ex.tomacorriente||"", tmv:"16A", tmm:"" }) });
      } else if(it.tipo==="lum") P.pz("s_lum", it.x, { vars:Object.assign(base, { sq:ex.interruptorPuerta||"", sqm:"", lm:ex.luminaria||"", lmv:"", lmm:"" }), texto: nums([2.8, 34.8]) });
      else {
        // circuito genérico: ITM → bornera → carga en campo (sin interruptor de puerta ni luminaria)
        P.pz("s_lum", it.x, { vars:base, texto: nums([2.8, 34.8]), omitir:[[-30, 498, 8, 532], [-50, 200, 30, 280]] });
        P.linea(0, 497, 0, 533, BUS.l1);
        P.texto(16, 262, 3.25, up(q.descripcion), { ha:1, c:7 });
      }
    }
  });
}

/* ---------- 4) PLC: CPU, módulos por slot, distribuidor de potencial y tapa ---------- */
function hPLC(c){
  const { P, eq, nombre } = c, plc = eq.plc;
  const W = { p_cpu:200, p_ana:44, p_rele:76, p_fpd:45, p_dig:44, p_tap:32 };
  const DESC = { AI:"MÓDULO\nENTRADAS\nANALÓGICAS", AO:"MÓDULO\nSALIDAS\nANALÓGICAS", DI:"MÓDULO\nENTRADAS\nDIGITALES", DO:"MÓDULO\nSALIDAS RELÉ" };
  const items = [{ pz:"p_cpu", vars:{ tag:plc.cpu.tag, desc:"CPU", modelo:plc.cpu.modelo, slot:"SLOT 0" } }];
  let fpd = !!plc.fpd;
  for(const m of plc.modulos.slice().sort((a, b)=>a.slot-b.slot)){
    if(m.tipo==="DI" && fpd){ items.push({ pz:"p_fpd", vars:{ tag:plc.fpd.tag, desc:"SEPARADOR/\nDISTRIBUIDOR\nDE POTENCIAL", modelo:plc.fpd.modelo } }); fpd = false; }
    items.push({ pz: m.tipo==="DO" ? "p_rele" : m.tipo==="DI" ? "p_dig" : "p_ana", vars:{ tag:m.tag, desc:DESC[m.tipo]||"MÓDULO", modelo:`${m.modelo}\n${m.canales} CANALES`, slot:`SLOT ${m.slot}` } });
  }
  if(plc.tapa) items.push({ pz:"p_tap", vars:{ tag:plc.tapa.tag, desc:"TAPA\nTERMINADOR", modelo:plc.tapa.modelo } });
  P.hoja(`${nombre} - CONTROLADOR (PLC) Y MÓDULOS DE E/S`);
  // el bastidor completo centrado; si no cabe en el ancho útil se reduce la escala (alrededor de su centro)
  const tot = items.reduce((a, it)=>a+W[it.pz], 0), s = Math.min(1, 740/tot);
  let x = (806 - tot*s)/2;
  for(const it of items){ P.pz(it.pz, x, { s, yc:450, vars:it.vars }); x += W[it.pz]*s; }
}

/* ---------- 5) distribución de 24 Vdc: fusibles-borne y equipos alimentados ---------- */
function hVdc(c){
  const { P, K, c24, ps, nombre, eq, hmi, sw, rut, peDe, c24De, fA, fB } = c;
  const cPLC = c24De(/plc|cpu|controlador/i), cHMI = c24De(/hmi|pantalla/i), cSW = c24De(/switch/i), cRUT = c24De(/router/i);
  const max1 = rut ? 12 : 16, hojas = [];
  if(c24.length <= max1) hojas.push(c24); else { hojas.push(c24.slice(0, max1)); hojas.push(...grupos(c24.slice(max1), 16)); }
  hojas.forEach((pares, i)=>{
    P.hoja(`${nombre} - DISTRIBUCIÓN 24 VDC${hojas.length>1 ? ` (${i+1} DE ${hojas.length})` : ""}`);
    // pares de fusibles-borne (A +24 V, B 0 V) a paso parejo, centrados entre las flechas de la fuente y el router
    const x1 = !i && rut ? 615 : 800, n = pares.length;
    const p = n>1 ? Math.max(42, Math.min(56, (x1-8-108)/(n-1))) : 48, Wb = (n-1)*p + 108;
    const A0 = 8 + (x1-8-Wb)/2 + 78;
    P.pz("v_ps", A0, { vars:{ a1:`${ps}.+`, a2:`${ps}.-` } });
    flecha(P, K, `${ps}.+`, "e", A0-44, 664, A0-44, 664.4, "izq"); flecha(P, K, `${ps}.-`, "e", A0-44, 624, A0-44, 624.4, "izq");
    P.pz("v_xf", A0, { vars:{ tb:"XF1", tbs:"4mm2", tbm1:"UT 4-L/", tbm2:"HESI (5X20)" } });
    const xs = pares.map((_, k)=>A0 + k*p);
    P.linea(xs[0], 384.85, xs[n-1], 384.85, BUS.v24); P.linea(xs[0]+16, 398.85, xs[n-1]+16, 398.85, BUS.v0);
    pares.forEach((q, k)=>{
      const A = xs[k], nf = String(q.borne||"").replace(/^.*\./,""), a1 = fA(q), a2 = fB(q);
      let d = up(q.reserva ? "Reserva" : `Alimentación ${sinAl(q.descripcion)}`);
      if(q===cPLC) d += " "+eq.plc.cpu.modelo; else if(q===cHMI && hmi) d += " "+hmi.modelo; else if(q===cSW && sw) d += " "+sw.modelo; else if(q===cRUT && rut) d += " "+rut.modelo;
      const vars = { bA:nf+"A", bB:nf+"B", fv:String(q.val||"").replace(/(\d)A$/,"$1 A"), a1, a2, desc:"" };
      // descripción bajo la referencia de la flecha más larga del par (las etiquetas XF1.nA crecen con el número)
      const yd = q.reserva ? 227.78 : Math.min(227.78, 260.85 - Math.max(a1.length, a2.length)*4.52*0.72 - 1.5 - 7*3.25*0.62 - 2);
      P.textoN(A+8, yd, 2.35, d, 18, { ha:1, c:7 });
      if(q.reserva){
        P.pz("v_par", A, { vars, omitir:[[-6, 229, 30, 345.6], [15.5, 205, 16.5, 358]] });
        P.linea(A, 344.85, A, 336, BUS.v24); P.linea(A+16, 356.85, A+16, 336, BUS.v0);
      } else {
        P.pz("v_par", A, { vars });
        flecha(P, K, a1, "s", A, 261, A+0.45, 260.85, "abajo"); flecha(P, K, a2, "s", A+16, 261, A+16.45, 260.85, "abajo");
      }
    });
    if(i) return;
    // equipos alimentados: PLC y HMI repartidos arriba; switch y router a la derecha
    const arriba = [{ pz:"v_plc", w:190, c:cPLC, pe:peDe("plc"), d:eq.plc.cpu, et:[[18.45, 522.85], [50.45, 522.85], [154.45, 522.85]], dir:"abajo" }];
    if(hmi) arriba.push({ pz:"v_hmi", w:109, c:cHMI, pe:peDe("hmi"), d:hmi, et:[[17.45, 522.85], [33.45, 522.85], [49.45, 522.85]], dir:"abajo" });
    const xa0 = Math.max(100, A0+36), Wa = arriba.reduce((a, x)=>a+x.w, 0), ga = Math.max(10, (620-xa0-Wa)/(arriba.length+1));
    let xa = xa0 + ga;                                           // a la derecha de la bajada de la fuente
    for(const e of arriba){ e.x = xa; xa += e.w + ga; }
    if(sw) arriba.push({ pz:"v_sw", x:630, c:cSW, pe:peDe("sw"), d:sw, et:[[38, 626.4], [38, 614.4], [38, 602.4]], dir:"izq" });
    if(rut) arriba.push({ pz:"v_rut", x:630, c:cRUT, pe:peDe("rut"), d:rut, et:[[26, 332.4], [26, 320.4], [26, 308.4]], dir:"izq" });
    for(const e of arriba){
      const a1 = fA(e.c), a2 = fB(e.c), plc = e.pz==="v_plc", mod = String(e.d.modelo||"");
      P.pz(e.pz, e.x, { lineas:{ desc:28 }, vars:{ tag:e.d.tag, desc: plc ? (eq.plc.cpu.familia||e.d.desc) : mod.replace(/\s+\S+$/, ""), modelo: plc ? mod : mod.split(" ").pop(), a1, a2, pe:e.pe } });
      [a1, a2, e.pe].forEach((et, k)=>flecha(P, K, et, "e", e.x+e.et[k][0], e.et[k][1], e.x+e.et[k][0], e.et[k][1], e.dir));
    }
  });
}

/* ---------- 6) entradas analógicas (8 canales por hoja) ---------- */
function hAI(c, m){
  const { P, K, nombre, c24, c24De, fA, fB, inst, deLimpieza, bornes } = c;
  const cAI = c24De(/entradas anal/i), partes = trozos(m.senales, 8);
  let nClp = 0;
  partes.forEach((sen, i)=>{
    P.hoja(`${nombre} - ENTRADAS ANALÓGICAS ${m.tag} (SLOT ${m.slot})${partes.length>1 ? ` (${i+1} DE ${partes.length})` : ""}`, 8);
    const n = sen.length, X0 = (806 - (n*80+132))/2 + 56, xs = sen.map((_, k)=>X0 + 80*k);
    P.pz("ai_div", 0);
    const a1 = fA(cAI), a2 = fB(cAI);
    P.pz("ai_bus", X0, { vars:{ a1, a2 } });
    flecha(P, K, a1, "e", X0-22, 338, X0-22, 338.4, "izq"); flecha(P, K, a2, "e", X0-22, 314, X0-22, 314.4, "izq");
    P.pz("ai_xf", X0, { vars:{ tb:m.tb, tbs:"4mm2", tbm1:"UT 4-L/", tbm2:"HESI (5X20)", fv:"0,5 A" } });
    P.pz("ai_mod", X0, { vars:{ tag:m.tag, modelo:m.modelo, slot:`slot ${m.slot}` } });
    let ult24 = X0, ult0 = X0+56;
    sen.forEach((s, k)=>{
      const x = xs[k], [bA, bB] = bornes(s), ch = s.ch;
      const base = { bA, bB, t1:String(2*ch), t2:String(2*ch+1), in1:`IN${ch}+`, in2:`IN${ch}-`, desc:s.origen==="reserva" ? "Reserva" : s.descripcion, fv: k ? "0,5 A" : "" };
      ult0 = x+56;
      if(deLimpieza(s)){
        // señal retransmitida por el controlador de limpieza (llega por flechas desde su hoja)
        const b = { a1:"CLP.+", a2:"CLP.-", a3:`SHIELD.${++nClp}` };
        P.pz("ai_clp", x, { lineas:{ desc:30 }, vars:Object.assign(base, b) });
        flecha(P, K, b.a1, "e", x, 650, x+0.45, 646.85, "arriba"); flecha(P, K, b.a2, "e", x+24, 650, x+24.45, 646.85, "arriba"); flecha(P, K, b.a3, "e", x-22, 650, x-21.55, 646.85, "arriba");
        return;
      }
      ult24 = x;
      if(s.origen==="reserva"){ P.pz("ai_tx", x, { lineas:{ desc:30 }, vars:base, omitir:[[-60, 498, 70, 800]] }); return; }
      const ins = inst.get(s.tag), tx = `${up(ins ? ins.descripcion : s.descripcion)}\n${s.senal||s.tag}`;
      P.pz("ai_tx", x, { lineas:{ desc:30, tx:32 }, vars:Object.assign(base, { tx }) });
      // fusible propio del transmisor en XF1 (si el listado de circuitos lo tiene): su flecha de 24 Vdc apunta a este canal
      const cT = c24.find(q=>!q.reserva && s.tag && String(q.descripcion||"").includes(s.tag));
      if(cT){ P.marca(K(fA(cT)+"<"), x, 660); P.marca(K(fB(cT)+"<"), x+24, 660); }
    });
    P.linea(X0-16, 338.85, ult24, 338.85, BUS.v24); P.linea(X0-16, 314.85, ult0, 314.85, BUS.v0);
    if(i===partes.length-1) P.pz("ai_sh", X0 + n*80, { texto: textos([[27, 257.85, String(2*m.canales)], [51, 257.85, String(2*m.canales+1)]]) });
  });
}

/* ---------- 7) salidas analógicas ---------- */
function hAO(c, m){
  const { P, K, nombre, c24De, fA, fB, destino, bornes } = c;
  const partes = trozos(m.senales, 8), cAO = c24De(/salidas anal/i);
  partes.forEach((sen, i)=>{
    P.hoja(`${nombre} - SALIDAS ANALÓGICAS ${m.tag} (SLOT ${m.slot})${partes.length>1 ? ` (${i+1} DE ${partes.length})` : ""}`);
    const n = sen.length, X0 = (806 - (n*80+114))/2 + 62, xs = sen.map((_, k)=>X0 + 80*k);
    P.pz("ao_div", 0);
    P.pz("ao_mod", X0, { vars:{ tag:m.tag, modelo:m.modelo, slot:`slot ${m.slot}` } });
    P.pz("ao_tb", X0, { vars:{ tb:m.tb, tbs:"4mm2", tbm:c.modBorne(m.tb, 0) } });
    if(cAO && !i){ P.marca(K(fA(cAO)+"<"), X0-36, 658); P.marca(K(fB(cAO)+"<"), X0-36, 658); }
    let libre = true, primero = true;
    sen.forEach((s, k)=>{
      const x = xs[k], [bA, bB] = bornes(s), ch = s.ch;
      const base = { bA, bB, t1:String(2*ch), t2:String(2*ch+1), o1:`OUT${ch}+`, o2:`OUT${ch}-`, desc:s.origen==="reserva" ? "Reserva" : s.descripcion };
      if(s.origen==="reserva") P.pz("ao_res", x, { lineas:{ desc:30 }, vars:base });
      else {
        if(x > 120 && x < 330) libre = false;
        const dest = `HACIA ${s.origen==="instrumento" ? "INSTALACIÓN EN CAMPO" : destino(s)}\n${up(s.descripcion)}\n${s.senal||s.tag}`;
        // la designación del cable se escribe una vez (en el primer canal usado)
        P.pz("ao_ch", x, { lineas:{ desc:30, dest:26 }, vars:Object.assign(base, { dest }), omitir: primero ? [] : [[-58, 280, -15, 297], [-58, 480, -15, 497]] });
        primero = false;
      }
    });
    const xsh = X0 + n*80;
    P.linea(X0+62, 512.85, xsh, 512.85, BUS.sh);
    P.pz("ao_sh", xsh, { texto: textos([[3, 623.2, String(2*m.canales)], [27, 623.2, String(2*m.canales+1)]]) });
    if(libre) P.pz("leyenda", X0+80, { dy:34 });
  });
}

/* ---------- 8) salidas digitales y bobinas de los relés de interfaz ---------- */
function hDO(c){
  const { P, K, eq, nombre, cbDO } = c;
  const hojas = [];
  for(const m of eq.plc.modulos.filter(m=>m.tipo==="DO")) trozos(m.senales, 8).forEach((sen, j, all)=>hojas.push({ m, sen, j, nj:all.length }));
  const cb = cbDO ? cbDO.tag : "";
  let izq = cb ? `${cb}.4` : "";
  hojas.forEach((h, i)=>{
    const { m, sen, j } = h, sigue = i < hojas.length-1;
    P.hoja(`${nombre} - SALIDAS DIGITALES ${m.tag} (SLOT ${m.slot})${h.nj>1 ? ` (${j+1} DE ${h.nj})` : ""}`, 18);
    const n = sen.length, X0 = (806 - ((n-1)*80+231))/2 + 104, xs = sen.map((_, k)=>X0 + 80*k), xl = xs[n-1];
    P.pz("do_mod", X0, { vars:{ tag:m.tag, modelo:m.modelo, slot:`slot ${m.slot}` } });
    // retorno común de las bobinas (N) con sus flechas de entrada y salida
    const kI = i ? `do:${i}:N` : izq, kC = i ? `do:${i}:L` : `${cb}.2`;
    P.pz("do_bus_izq", X0, { vars:{ a:izq, v:"120 VAC" } });
    P.marca(K(kI+"<"), X0-70, 216); P.refEt(X0-70, 216.4, izq, K(kI+">"), "izq");
    sen.forEach((s, k)=>{
      const x = xs[k], r = eq.reles.find(r=>r.modulo===m.tag && r.ch===s.ch) || {}, cr = r.tag||"";
      P.pz("do_ch", x, { lineas:{ desc:30 }, vars:{ desc:s.origen==="reserva" ? "Reserva" : s.descripcion, t:String(s.ch + j), out:`OUT${s.ch}`, cr,
        crc:(String(r.modelo||"").match(/\d*NA\/?N?C?/)||["1NA"])[0], crm:r.bobina ? `BOBINA ${up(r.bobina)}` : "" } });
      P.marca(K(cr+"@b"), x, 306);
      const rf = P.ref(K(cr+"@c")); if(rf) P.texto(x+14.48, 203.23, 3.25, "/"+rf, { capa:"EPLAN440", c:73, ha:0, va:2 });
    });
    const der = `${(eq.reles.find(r=>r.modulo===m.tag && r.ch===sen[n-1].ch)||{}).tag||"CR"}.A2`;
    P.linea(X0-64, 216.85, sigue ? xl+52 : xl, 216.85, BUS.ret);
    if(sigue){
      P.pz("do_bus_der", xl, { vars:{ a:der, v:"120 VAC" } });
      P.marca(K(`do:${i+1}:N>`), xl+54, 216); P.refEt(xl+54.33, 216.4, der, K(`do:${i+1}:N<`), "der");
    }
    izq = der;
    // común de los contactos (L) del grupo de 8 salidas
    const xc = xl + 64;
    P.pz("do_com", xc, { vars:{ a:`${cb}.2`, t:String(8*(j+1)+j), com:`COM${j}`, v:"120 VAC" }, omitir: sigue ? [] : [[4, 525, 90, 550]] });
    P.marca(K(kC+"<"), xc-26, 536); P.refEt(xc-26, 536.4, `${cb}.2`, K(kC+">"), "izq");
    if(sigue){ P.marca(K(`do:${i+1}:L>`), xc+30, 536); P.refEt(xc+30, 536.4, `${cb}.2`, K(`do:${i+1}:L<`), "der"); }
  });
}

/* ---------- 9) contactos de los relés de interfaz hacia la bornera (10 por hoja) ---------- */
function hContactos(c){
  const { P, K, eq, nombre, destino, bornes } = c;
  const hojas = grupos(eq.reles, 10);
  hojas.forEach((rs, i)=>{
    P.hoja(`${nombre} - CONTACTOS DE RELÉS DE INTERFAZ${hojas.length>1 ? ` (${i+1} DE ${hojas.length})` : ""}`, 12);
    // una o dos filas de hasta 5 contactos, centradas en la lámina
    const filas = rs.length > 5 ? 2 : 1, porFila = Math.ceil(rs.length/filas), Wb = (porFila-1)*142 + 150, x0 = (806-Wb)/2 + 78;
    rs.forEach((r, k)=>{
      const f = Math.floor(k/porFila), col = k % porFila, x = x0 + col*142, dy = filas===1 ? -156 : -312*f;
      const m = eq.plc.modulos.find(m=>m.tag===r.modulo) || {}, s = r.senal || {}, [bA, bB] = bornes(s);
      const hacia = s.origen==="instrumento" ? "instalación en campo "+(s.tag||"") : destino(s).replace(/^TABLERO DE FUERZA/, "tablero de fuerza");
      const desc = r.reserva ? "Reserva" : `Hacia ${hacia} ${String(s.descripcion||"").replace(/^./, x=>x.toLowerCase())}`;
      P.pz("rc", x, { dy, lineas:{ desc:24 }, vars:{ tb:m.tb||"", bA, bB, cr:r.tag, crm:r.bobina ? `BOBINA ${up(r.bobina)}` : "", tbm:c.modBorne(m.tb, 0), desc } });
      P.marca(K(r.tag+"@c"), x, 594+dy);
      const rf = P.ref(K(r.tag+"@b")); if(rf) P.texto(x-12, 588.08+dy, 3.25, "/"+rf, { capa:"EPLAN442", c:73, ha:2, va:2 });
    });
    if(filas===2) P.pz("leyenda", 615, { dy:204 }); else P.pz("leyenda", 18, { dy:-30 });
  });
}

/* ---------- 10) entradas digitales (8 canales por hoja, alimentación común desde el distribuidor de potencial) ---------- */
function hDI(c){
  const { P, K, eq, nombre, cbDI, inst, destino, deLimpieza, bornes } = c;
  const hojas = [];
  for(const m of eq.plc.modulos.filter(m=>m.tipo==="DI")) trozos(m.senales, 8).forEach((sen, j, all)=>hojas.push({ m, sen, j, nj:all.length }));
  const fpd = eq.plc.fpd, cb = cbDI ? cbDI.tag : "";
  let izq = cb ? `${cb}.2` : "";
  hojas.forEach((h, i)=>{
    const { m, sen, j } = h, sigue = i < hojas.length-1, conFPD = !i && fpd, n = sen.length;
    P.hoja(`${nombre} - ENTRADAS DIGITALES ${m.tag} (SLOT ${m.slot})${h.nj>1 ? ` (${j+1} DE ${h.nj})` : ""}`, 10);
    let X0, xIni;
    if(conFPD){
      // distribuidor de potencial a la izquierda: alimenta la barra común de las entradas
      const W = 178 + (n-1)*80 + 70, xf = Math.max(4, (806 - W)/2);
      X0 = xf + 178; xIni = xf + 146;
      P.pz("di_fpd", xf, { vars:{ tag:fpd.tag, modelo:fpd.modelo, a1:`${cb}.2`, a2:`${cb}.4`, v:"120 VAC" } });
      flecha(P, K, `${cb}.2`, "e", xf+20, 523, xf+20.46, 522.85, "abajo"); flecha(P, K, `${cb}.4`, "e", xf+52, 523, xf+52.46, 522.85, "abajo");
    } else {
      X0 = (806 - (90 + (n-1)*80 + 80))/2 + 90; xIni = X0-44;
      const kk = i ? `di:${i}` : `${cb}.2`;
      P.pz("di_bus_izq", X0, { vars:{ a:izq, v:"120 VAC" } });
      P.marca(K(kk+"<"), X0-48, 664); P.refEt(X0-48, 664.4, izq, K(kk+">"), "izq");
    }
    const xs = sen.map((_, k)=>X0 + 80*k), xl = xs[n-1];
    P.pz("di_xfb", X0, { vars:{ tb:m.tb, tbm1:"UT 4-L/", tbm2:"HESI (5X20)", tbs:"4mm2" } });
    P.pz("di_xfa", X0, { vars:{ tb:m.tb, tbs:"4mm2", tbm1:"UT 4-L/", tbm2:"HESI (5X20)", fv:"0,5 A" } });
    P.pz("di_mod", X0, { vars:{ tag:m.tag, modelo:m.modelo, slot:`slot ${m.slot}` } });
    sen.forEach((s, k)=>{
      const x = xs[k], [b1, b2] = bornes(s);
      const base = { bB:b1, bA:b2, t:String(s.ch+1), inn:`In-${s.ch}`, fv: k ? "0,5 A" : "", desc:s.origen==="reserva" ? "Reserva" : s.descripcion };
      if(deLimpieza(s)){
        // estado del controlador de limpieza: el contacto está en su tarjeta (hoja del controlador)
        const a1 = `${m.tb}.${b1}`, a2 = `${m.tb}.${b2}`;
        P.pz("di_clp", x, { lineas:{ desc:30, dest:28 }, vars:Object.assign(base, { a1, a2, dest:`VIENE DEL ${up(eq.limpieza.desc).replace(/\s*\(.*$/, "")}` }) });
        flecha(P, K, a1, "s", x+22, 480, x+22, 480.4, "der"); flecha(P, K, a2, "e", x+22, 450, x+22, 450.4, "der"); return;
      }
      const ins = inst.get(s.tag);
      const dest = s.origen==="reserva" ? "RESERVA" : s.origen==="instrumento" ? `(INSTALACIÓN EN CAMPO)\n${up(ins ? ins.descripcion : s.descripcion)}\n${s.tag}` : `DESDE ${destino(s)}\n${up(s.descripcion)}\n${s.tag}`;
      P.pz("di_ch", x, { lineas:{ desc:30, dest:28 }, vars:Object.assign(base, { dest }) });
    });
    P.linea(xIni, 664.85, sigue ? xl+26 : xl, 664.85, BUS.di);
    const der = `${m.tb}.${bornes(sen[n-1])[0]}`;
    if(sigue){
      P.pz("di_bus_der", xl, { vars:{ a:der, v:"120 VAC" } });
      P.marca(K(`di:${i+1}>`), xl+34, 664); P.refEt(xl+34, 664.4, der, K(`di:${i+1}<`), "der");
    }
    izq = der;
  });
}

/* ---------- 11) controlador de limpieza: tarjeta, bornera de paso en campo y válvulas solenoides ---------- */
function hLimpieza(c){
  const { P, K, eq, nombre, cbL, peDe, deLimpieza } = c, kit = P.kit;
  const L = eq.limpieza;
  P.hoja(`${nombre} - CONTROLADOR DE LIMPIEZA ${L.tag}`);
  const ai = eq.plc.modulos.some(m=>m.tipo==="AI" && m.senales.some(deLimpieza));
  let di = null;
  for(const m of eq.plc.modulos.filter(m=>m.tipo==="DI")) for(const s of m.senales) if(!di && deLimpieza(s)){ const [b1, b2] = c.bornes(s); di = [`${m.tb}.${b1}`, `${m.tb}.${b2}`]; }
  const a = { a1:ai ? "CLP.+" : "", a2:ai ? "CLP.-" : "", a3:ai ? "SHIELD.1" : "", a4:di ? di[0] : "", a5:di ? di[1] : "", a6:cbL ? `${cbL.tag}.2` : "", a7:cbL ? `${cbL.tag}.4` : "", a8:peDe("limp") };
  const omit = []; if(!ai) omit.push([0, 552, 141, 600]); if(!di) omit.push([0, 530, 147, 552]);
  // flechas a la izquierda de la tarjeta: 1 = entra a la tarjeta (alimentación, tierra, contacto de alarma)
  const ent = { a1:0, a2:0, a3:0, a4:1, a5:0, a6:1, a7:1, a8:1 };
  const pos = { a1:[64.01, 588.24], a2:[64.01, 578.24], a3:[64.01, 558.24], a4:[64.01, 548.24], a5:[64.01, 536.24], a6:[62.01, 496.24], a7:[62.01, 470.24], a8:[62.01, 450.4] };
  P.pz("l_div", 0);
  P.pz("l_ctrl", 0, { omitir:omit, lineas:{ desc2:30 }, vars:Object.assign({ tag:L.tag, modelo:"", desc1:"TARJETA DE CONTROL", desc2:"LIMPIEZA SECUENCIAL", tmx:"TMX", tmxm:"" }, a) });
  for(const [k, [x, y]] of Object.entries(pos)) flecha(P, K, a[k], ent[k] ? "e" : "s", x, y, x, y, "izq");
  // bornes del conector TMX (PE, común y salidas) leídos de la pieza; debajo, la bornera de paso TB1 en campo
  const tmx = kit.piezas.l_ctrl.e.filter(e=>e[0]==="A" && e[5]>424 && e[5]<434 && Math.abs(e[6]-3)<0.1).map(e=>e[4]).sort((x, y)=>x-y);
  const vs = (L.senales||[]).filter(s=>s.tipo==="DO").slice(0, Math.max(0, tmx.length-2));
  if(tmx.length < 3) return;
  const yT = 364.85, yTMX = 420.85;
  const term = [{ x:tmx[0], n:"PE" }, { x:tmx[1], n:"C" }].concat(vs.map((s, i)=>({ x:tmx[i+2], n:String(i+1), s })));
  P.pz("l_tb", term[0].x, { vars:{ tb:"TB1", tbs:"4mm2", tbm:"PTTB 4", tbpe:"UT 4-PE", caja:"CAJA DE PASO" } });
  const cx0 = term[0].x-36, cx1 = term[term.length-1].x+14;
  for(const [x1, y1, x2, y2] of [[cx0, 342.85, cx1, 342.85], [cx1, 342.85, cx1, 370.85], [cx1, 370.85, cx0, 370.85], [cx0, 370.85, cx0, 342.85]]) P.linea(x1, y1, x2, y2, BUS.caja);
  for(const b of term){ P.pz("l_borne", b.x, { vars:{ b:b.n } }); P.linea(b.x, yTMX, b.x, yT+4, BUS.campo); }
  // válvulas repartidas a lo ancho (a la izquierda del cajetín) y cableado ordenado sin cruces
  const n = vs.length; if(!n) return;
  const pv = n>1 ? Math.min(40, 590/(n-1)) : 0, sv = Math.min(1, (pv||40)/31), xv0 = (45+640)/2 - pv*(n-1)/2;
  const xv = vs.map((_, i)=>xv0 + i*pv);
  const izq = [], der = [];
  term.slice(2).forEach((b, i)=>{ b.xv = xv[i]; (b.xv <= b.x ? izq : der).push(b); });
  const paso = Math.min(5, 96/Math.max(1, izq.length, der.length));
  izq.forEach((b, k)=>{ b.y = 344 - paso*k; }); der.slice().reverse().forEach((b, k)=>{ b.y = 344 - paso*k; });
  const yv = 226.85, yb = yv + (194.85-yv)*sv;
  for(const b of term.slice(2)){
    P.linea(b.x, yT-4, b.x, b.y, BUS.campo); P.linea(b.x, b.y, b.xv, b.y, BUS.campo); P.linea(b.xv, b.y, b.xv, yv, BUS.campo);
    P.pz("l_valv", b.xv, { s:sv, yc:yv, vars:{ tag:b.s.tag } });
  }
  // común (N) y tierra: por la izquierda, por encima de las salidas, hasta las barras bajo las válvulas
  const [tPE, tC] = term, yN = 186, yPE = 179, xa = Math.min(30, xv[0]-20), xb = xa-6;
  P.linea(tPE.x, yT-4, tPE.x, 354, BUS.campo); P.linea(tPE.x, 354, xb, 354, BUS.campo); P.linea(xb, 354, xb, yPE, BUS.campo); P.linea(xb, yPE, xv[n-1]+8*sv, yPE, BUS.campo);
  P.linea(tC.x, yT-4, tC.x, 350, BUS.campo); P.linea(tC.x, 350, xa, 350, BUS.campo); P.linea(xa, 350, xa, yN, BUS.campo); P.linea(xa, yN, xv[n-1], yN, BUS.campo);
  for(const x of xv){
    P.linea(x, yb, x, yN, BUS.campo);
    const xp = x + 8*sv; P.linea(xp, yb, xp, yN+1.5, BUS.campo); P.arco(xp, yN, 1.5, -90, 90, BUS.campo); P.linea(xp, yN-1.5, xp, yPE, BUS.campo);
  }
}

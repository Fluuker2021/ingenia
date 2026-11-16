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
import { cargarKit, usarKit, pieza } from "./kit.js";
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
  const deLimpieza = s => eq.limpieza && s.origen!=="reserva" && new RegExp(eq.limpieza.tag.replace(/[-]/g,"\\-")+"|limpieza", "i").test(`${s.alimentacion||""} ${s.descripcion||""}`);
  const bornes = s => String(s.terminales||"").split("/").map(x=>x.trim().replace(/^.*:/,""));
  const ctx = { P, p, eq, t, v, pre, K, nombre, est, aux, c24, c120, c220, cbDI, cbDO, cbL, bornera, modBorne, inst, ps, cb3, hmi, sw, rut, peDev, peDe, c24De, fA, fB, destino, deLimpieza, bornes };
  hAcometidas(ctx); hDistribucion(ctx); if(c220.length) hServicios(ctx); hPLC(ctx); if(c24.length) hVdc(ctx);
  for(const m of eq.plc.modulos.filter(m=>m.tipo==="AI")) hAI(ctx, m);
  for(const m of eq.plc.modulos.filter(m=>m.tipo==="AO")) hAO(ctx, m);
  hDO(ctx); hContactos(ctx); hDI(ctx); if(eq.limpieza) hLimpieza(ctx);
}

/* ---------- 1) acometidas ---------- */
function hAcometidas(c){
  const { P, eq, v, K, est, aux, ps, cb3, c220, nombre } = c;
  P.hoja(`${nombre} - ACOMETIDAS`);
  const dx = aux ? 0 : 130;                                       // sin acometida auxiliar: la mitad estabilizada al centro
  const tbm = b => { const x = c.bornera(b); return x ? `${x.bornes[0].modelo}/${x.bornes[x.bornes.length-1].modelo}` : ""; };
  const desde = a => up(`VIENE DE ${a.desde||"-"}${a.circuito ? " CIRCUITO "+a.circuito : ""}`);
  const alim = a => `Alimentación\n${a.tension} ${v.frecuencia} Hz ${a.fases}`;
  P.pz("a_est", dx, { lineas:{ desde:30 }, vars:{ desde:desde(est), alim:alim(est), tb:est.tb, tbm:tbm(est.tb), q:est.q.tag, qv:amp(est.q.in), qm:est.q.modelo, pe:"PE.1", nota:"(NOTA 1)" },
    texto: textos([[392.9, 632.53, P.ref(K("PE.1<"))]]) });
  P.marca(K("PE.1>"), dx+376, 632);
  if(eq.fuente){
    const f = eq.fuente;
    P.pz("a_cb1", dx, { vars:{ q:f.cb.tag, qv:amp(f.cb.in), qm:f.cb.modelo } });
    P.pz("a_ps", dx, { vars:{ ps:f.ps.tag, psv:amp(f.ps.a), psm:f.ps.modelo } });
    P.pz("a_cb2", dx, { vars:{ q:f.cbOut.tag, qv:amp(f.cbOut.in), qm:f.cbOut.modelo, a1:`${ps}.-`, a2:`${ps}.+`, desc:"FUENTE DE 24 VDC" },
      texto: textos([[236.33, 281.11, P.ref(K(`${ps}.-<`))], [268.33, 278.85, P.ref(K(`${ps}.+<`))]]) });
    P.marca(K(`${ps}.->`), dx+236, 297); P.marca(K(`${ps}.+>`), dx+268, 297);
  }
  if(eq.cb120){
    const q = eq.cb120;
    P.pz("a_cb3", dx, { lineas:{ desc:22 }, vars:{ q:q.tag, qv:amp(q.in), qm:q.modelo, a1:`${q.tag}.2`, a2:`${q.tag}.4`, desc:`DISTRIBUCIÓN\n${up(eq.vEst)}` },
      texto: textos([[320.33, 276.05, P.ref(K(`${cb3}.2<`))], [352.33, 276.05, P.ref(K(`${cb3}.4<`))]]) });
    P.marca(K(`${cb3}.2>`), dx+320, 297); P.marca(K(`${cb3}.4>`), dx+352, 297);
  }
  const s = eq.spd, m = s.modelo.indexOf("-"), m1 = m>0 ? s.modelo.slice(0, m+1) : s.modelo, m2 = m>0 ? s.modelo.slice(m+1) : "";
  const spd = { q:s.cb.tag, qv:amp(s.cb.in), qm:s.cb.modelo, s1:s.tags[0], s2:s.tags[1], tipo:s.tipo, m1, m2 };
  if(aux){
    const q = aux.q.tag, serv = c220.map(x=>sinAl(x.descripcion).replace(/ interna$/i,"")).join(", ");
    P.pz("a_aux", 0, { lineas:{ desde:30, desc:30 }, vars:{ desde:desde(aux), alim:alim(aux), tb:aux.tb, tbm:tbm(aux.tb), q, qv:amp(aux.q.in), qm:aux.q.modelo,
      a1:`${q}.2`, a2:`${q}.4`, pe:"PE.2", nota:"(NOTA 2)", desc:up(`Alimentación servicios del tablero${serv ? " ("+serv+")" : ""}`) },
      texto: textos([[794.9, 632.53, P.ref(K("PE.2<"))], [626.33, 271.27, P.ref(K(`${q}.2<`))], [658.33, 271.27, P.ref(K(`${q}.4<`))]]) });
    P.marca(K("PE.2>"), 778, 632); P.marca(K(`${q}.2>`), 626, 297); P.marca(K(`${q}.4>`), 658, 297);
    P.pz("a_spd", 0, { vars:spd });
  } else {
    // supresor colgado de la barra estabilizada, a continuación de la distribución
    const xs = dx+430;
    P.linea(dx+320, 664.85, xs, 664.85, BUS.l); P.linea(dx+352, 648.85, xs+32, 648.85, BUS.l);
    P.pz("a_spd", xs-690, { vars:spd });
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
  const cols = c120.map(x=>({ c:x, tipo: x.reserva ? "res" : ((/limpieza/i.test(x.descripcion||"") && eq.limpieza) || !x.campo) ? "int" : "campo", w:84 }));
  const taps = peDev.map(d=>({ tipo:"pe", d, w:26 }));
  // hojas: hasta 8 columnas por hoja, repartidas parejas; las derivaciones de tierra van en la última
  let hojas = [];
  for(let n = Math.max(1, Math.ceil(cols.length/8)); ; n++){
    hojas = cols.length ? grupos(cols, Math.ceil(cols.length/n)) : [[]];
    const ult = hojas[hojas.length-1];
    if(ult.length*84 + taps.length*26 + (taps.length ? 20 : 0) <= 732){ hojas[hojas.length-1] = ult.concat(taps); break; }
    if(n > 40) break;
  }
  const v120 = up(eq.vEst), X0 = 38, X1 = 770;
  hojas.forEach((items, i)=>{
    const sigue = i < hojas.length-1, nh = hojas.length;
    P.hoja(`${nombre} - DISTRIBUCIÓN ${v120}${nh>1 ? ` (${i+1} DE ${nh})` : ""}`);
    // posiciones: columnas de 84 mm (hasta 100 mm si sobra espacio) centradas; las derivaciones de tierra juntas al final
    const nc = items.filter(x=>x.tipo!=="pe").length, nt = items.length - nc, gap = nt && nc ? 20 : 0;
    const p = nc ? Math.min(100, Math.max(84, (X1-X0 - nt*26 - gap)/nc)) : 84;
    const W = nc*p + nt*26 + gap; let x = X0 + (X1-X0-W)/2;
    let ultL = null, primerCampo = true;
    for(const it of items){
      if(it.tipo==="pe"){ if(gap && x>0 && ultL!=null && it===items[nc]) x += gap; it.x = x+13; x += 26; continue; }
      it.x = x + 28 + (p-84)/2; ultL = it.x; x += p;
    }
    // barras L, N y PE (continuas entre las flechas de entrada y salida)
    const lastL = ultL!=null ? ultL : 66;
    P.linea(40, 664.85, sigue ? 756 : lastL, 664.85, BUS.l);
    P.linea(40, 648.85, sigue ? 756 : lastL+32, 648.85, BUS.l);
    P.linea(58, 632.85, sigue ? 728 : 750, 632.85, BUS.pe);
    const kL = i ? `d120:${i}:` : null;
    P.pz("d_bus_izq", 0, { vars:{ l1:`${cb3}.2`, l2:`${cb3}.4`, pe: i ? "PE.3" : "PE.1", v:v120 }, texto: textos([
      [13.2, 664.53, P.ref(K(i ? kL+"L>" : `${cb3}.2>`))], [13.2, 648.53, P.ref(K(i ? kL+"N>" : `${cb3}.4>`))], [17.1, 632.53, P.ref(K(i ? kL+"PE>" : "PE.1>"))]]) });
    P.marca(K(i ? kL+"L<" : `${cb3}.2<`), 34, 664); P.marca(K(i ? kL+"N<" : `${cb3}.4<`), 34, 648); P.marca(K(i ? kL+"PE<" : "PE.1<"), 34, 632);
    if(sigue){
      const kS = `d120:${i+1}:`;
      P.pz("d_bus_der", 712, { vars:{ l1:`${cb3}.2`, l2:`${cb3}.4`, pe:"PE.3", v:v120 }, texto: textos([
        [70.8, 664.53, P.ref(K(kS+"L<"))], [70.8, 648.53, P.ref(K(kS+"N<"))], [66.9, 632.53, P.ref(K(kS+"PE<"))]]) });
      P.marca(K(kS+"L>"), 762, 664); P.marca(K(kS+"N>"), 762, 648); P.marca(K(kS+"PE>"), 762, 632);
    } else P.pz("d_fin", 754);
    for(const it of items){
      if(it.tipo==="pe"){
        P.pz("d_pe", it.x, { vars:{ pe:it.d.pe }, texto: textos([[0.33, 553.83, P.ref(K(it.d.pe+"<"))]]) });
        P.marca(K(it.d.pe+">"), it.x, 569); continue;
      }
      const q = it.c, base = { q:q.tag, qv:amp(q.in), qm:q.modelo, desc:up(q.reserva ? "Reserva" : q.descripcion) };
      if(it.tipo==="int"){
        const a1 = `${q.tag}.2`, a2 = `${q.tag}.4`;
        P.pz("d_int", it.x, { lineas:{ desc:24 }, vars:Object.assign(base, { a1, a2 }), texto: textos([[0.33, 274.05, P.ref(K(a1+"<"))], [32.33, 274.05, P.ref(K(a2+"<"))]]) });
        P.marca(K(a1+">"), it.x, 295); P.marca(K(a2+">"), it.x+32, 295);
      } else if(it.tipo==="res") P.pz("d_res", it.x, { lineas:{ desc:24 }, vars:base });
      else {
        const [b1, b2] = String(q.borne||"").replace(/^[^.]*\./,"").split("/");
        if(primerCampo){ const tb = String(q.borne||"TB3").split(".")[0]; P.pz("d_tb", it.x, { vars:{ tb, tbs:"4mm2", tbm:c.modBorne(tb, 0), tbpe:c.modBorne(tb, -1) } }); primerCampo = false; }
        P.pz("d_campo", it.x, { lineas:{ desc:24 }, vars:base, texto: textos([], [[2.8, 377.4, b1||""], [34.8, 377.4, b2||""]]) });
      }
    }
    if(!sigue) P.pz("leyenda", 18, { dy:-42 });
  });
}

/* ---------- 3) servicios de 220 Vac ---------- */
function hServicios(c){
  const { P, K, aux, c220, cb3, nombre, eq } = c;
  const TIPO = { vent:{ pz:"s_vent", w:175, o:42 }, lum:{ pz:"s_lum", w:100, o:38 }, toma:{ pz:"s_toma", w:115, o:50 }, gen:{ pz:"s_lum", w:100, o:38 } };
  const cols = c220.map(x=>({ c:x, tipo: /ventila/i.test(x.descripcion) ? "vent" : /luminaria/i.test(x.descripcion) ? "lum" : /tomacorriente/i.test(x.descripcion) ? "toma" : "gen" }));
  const X0 = 64, X1 = 756, hojas = [[]]; let w = 0;
  for(const it of cols){ const a = TIPO[it.tipo].w + 16; if(hojas[hojas.length-1].length && w + a > X1-X0){ hojas.push([]); w = 0; } hojas[hojas.length-1].push(it); w += a; }
  const l1 = aux ? `${aux.q.tag}.2` : `${cb3}.2`, l2 = aux ? `${aux.q.tag}.4` : `${cb3}.4`, pe = aux ? "PE.2" : "PE.1", vt = up(aux ? aux.tension : eq.vEst);
  hojas.forEach((items, i)=>{
    P.hoja(`${nombre} - SERVICIOS ${vt}${hojas.length>1 ? ` (${i+1} DE ${hojas.length})` : ""}`);
    const W = items.reduce((a, it)=>a+TIPO[it.tipo].w, 0), g = Math.max(12, (X1-X0-W)/(items.length+1));
    let x = X0 + (X1-X0 - W - g*(items.length-1))/2, ultL = 78;
    for(const it of items){ it.x = x + TIPO[it.tipo].o; ultL = it.x; x += TIPO[it.tipo].w + g; }
    P.linea(40, 664.85, ultL, 664.85, BUS.l1); P.linea(40, 648.85, ultL+32, 648.85, BUS.l2); P.linea(64, 632.85, 764, 632.85, BUS.pe);
    P.pz("s_bus_izq", 0, { vars:{ l1, l2, pe, v:vt }, texto: aux && !i ? textos([[8.4, 664.53, P.ref(K(l1+">"))], [8.4, 648.53, P.ref(K(l2+">"))], [17.1, 632.53, P.ref(K(pe+">"))]]) : textos() });
    if(aux && !i){ P.marca(K(l1+"<"), 34, 664); P.marca(K(l2+"<"), 34, 648); P.marca(K(pe+"<"), 34, 632); }
    P.pz("s_fin", 768);
    for(const it of items){
      const q = it.c, ex = q.extra||{}, [b1, b2] = String(q.borne||"").replace(/^[^.]*\./,"").split("/"), tb = String(q.borne||"TB4").split(".")[0];
      const base = { q:q.tag, qv:amp(q.in), qm:q.modelo, tb, tbs:"4mm2", tbm:c.modBorne(tb, 0) };
      const nums = xs => textos([], xs.map(x=>[x, 393.4, ""]).map((s, k)=>(s[2] = k%2 ? (b2||"") : (b1||""), s)));
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
  P.hoja(`${nombre} - CONTROLADOR (PLC) ${up(plc.cpu.familia||"")}`.trim());
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
    const x1 = !i && rut ? 615 : 800, n = pares.length;
    const p = n>1 ? Math.max(42, Math.min(56, (x1-8-108)/(n-1))) : 48, Wb = (n-1)*p + 108;
    const A0 = 8 + (x1-8-Wb)/2 + 78;
    P.pz("v_ps", A0, { vars:{ a1:`${ps}.+`, a2:`${ps}.-` }, texto: textos([[-62, 664.53, P.ref(K(`${ps}.+>`))], [-59.74, 624.53, P.ref(K(`${ps}.->`))]]) });
    P.marca(K(`${ps}.+<`), A0-44, 664); P.marca(K(`${ps}.-<`), A0-44, 624);
    P.pz("v_xf", A0, { vars:{ tb:"XF1", tbs:"4mm2", tbm1:"UT 4-L/", tbm2:"HESI (5X20)" } });
    const xs = pares.map((_, k)=>A0 + k*p);
    P.linea(xs[0], 384.85, xs[n-1], 384.85, BUS.v24); P.linea(xs[0]+16, 398.85, xs[n-1]+16, 398.85, BUS.v0);
    pares.forEach((q, k)=>{
      const A = xs[k], nf = String(q.borne||"").replace(/^.*\./,""), a1 = fA(q), a2 = fB(q);
      let d = up(q.reserva ? "Reserva" : `Alimentación ${sinAl(q.descripcion)}`);
      if(q===cPLC) d += " "+eq.plc.cpu.modelo; else if(q===cHMI && hmi) d += " "+hmi.modelo; else if(q===cSW && sw) d += " "+sw.modelo; else if(q===cRUT && rut) d += " "+rut.modelo;
      const vars = { bA:nf+"A", bB:nf+"B", fv:String(q.val||"").replace(/(\d)A$/,"$1 A"), a1, a2, desc:d };
      if(q.reserva){
        P.pz("v_par", A, { vars, lineas:{ desc:18 }, omitir:[[-6, 205, 14, 345.6], [15.5, 205, 16.5, 358]] });
        P.linea(A, 344.85, A, 336, BUS.v24); P.linea(A+16, 356.85, A+16, 336, BUS.v0);
      } else {
        P.pz("v_par", A, { vars, lineas:{ desc:18 }, texto: textos([[0.33, 240.61, P.ref(K(a1+"<"))], [16.33, 240.61, P.ref(K(a2+"<"))]]) });
        P.marca(K(a1+">"), A, 261); P.marca(K(a2+">"), A+16, 261);
      }
    });
    if(i) return;
    // equipos alimentados: PLC y HMI repartidos arriba; switch y router a la derecha
    const arriba = [{ pz:"v_plc", w:190, c:cPLC, pe:peDe("plc"), d:eq.plc.cpu, refs:[[18.33, 502.61], [50.33, 502.61], [154.33, 507.83]], m:[18, 50, 154], y:523 }];
    if(hmi) arriba.push({ pz:"v_hmi", w:109, c:cHMI, pe:peDe("hmi"), d:hmi, refs:[[17.33, 502.61], [33.33, 499.21], [49.33, 507.83]], m:[17, 33, 49], y:523 });
    const Wa = arriba.reduce((a, x)=>a+x.w, 0), ga = (620-100-Wa)/(arriba.length+1);
    let xa = 100 + ga;
    for(const e of arriba){ e.x = xa; xa += e.w + ga; }
    if(sw) arriba.push({ pz:"v_sw", x:630, c:cSW, pe:peDe("sw"), d:sw, refs:[[17.74, 626.53], [17.74, 614.53], [22.98, 602.53]], m:[38, 38, 38], my:[626, 614, 602] });
    if(rut) arriba.push({ pz:"v_rut", x:630, c:cRUT, pe:peDe("rut"), d:rut, refs:[[2.34, 332.53], [2.34, 320.53], [10.98, 308.53]], m:[26, 26, 26], my:[332, 320, 308] });
    for(const e of arriba){
      const a1 = fA(e.c), a2 = fB(e.c), keys = [a1, a2, e.pe];
      P.pz(e.pz, e.x, { vars:{ tag:e.d.tag, desc:e.pz==="v_plc" ? (eq.plc.cpu.familia||e.d.desc) : (e.d.modelo||"").replace(/\s+\S+$/, ""), modelo:e.pz==="v_plc" ? e.d.modelo : String(e.d.modelo||"").split(" ").pop(), a1, a2, pe:e.pe },
        lineas:{ desc:28 }, texto: textos(e.refs.map((r, k)=>[r[0], r[1], keys[k] ? P.ref(K(keys[k]+">")) : ""])) });
      keys.forEach((kk, k)=>{ if(kk) P.marca(K(kk+"<"), e.x + e.m[k], e.my ? e.my[k] : e.y); });
    }
  });
}

/* ---------- 6) entradas analógicas (8 canales por hoja) ---------- */
function hAI(c, m){
  const { P, K, nombre, c24, c24De, fA, fB, inst, eq, deLimpieza, bornes } = c;
  const cAI = c24De(/entradas anal/i), partes = trozos(m.senales, 8);
  partes.forEach((sen, i)=>{
    P.hoja(`${nombre} - ENTRADAS ANALÓGICAS ${m.tag} (SLOT ${m.slot})${partes.length>1 ? ` (${i+1} DE ${partes.length})` : ""}`, 8);
    const n = sen.length, X0 = (806 - (n*80+132))/2 + 56, xs = sen.map((_, k)=>X0 + 80*k);
    P.pz("ai_div", 0);
    const a1 = fA(cAI), a2 = fB(cAI);
    P.pz("ai_bus", X0, { vars:{ a1, a2 }, texto: textos([[-42.26, 338.53, P.ref(K(a1+">"))], [-42.26, 314.53, P.ref(K(a2+">"))]]) });
    if(a1){ P.marca(K(a1+"<"), X0-22, 338); P.marca(K(a2+"<"), X0-22, 314); }
    P.pz("ai_xf", X0, { vars:{ tb:m.tb, tbs:"4mm2", tbm1:"UT 4-L/", tbm2:"HESI (5X20)", fv:"0,5 A" } });
    P.pz("ai_mod", X0, { vars:{ tag:m.tag, modelo:m.modelo, slot:`slot ${m.slot}` } });
    let ult24 = X0, ult0 = X0+56;
    sen.forEach((s, k)=>{
      const x = xs[k], [bA, bB] = bornes(s), ch = s.ch;
      const base = { bA, bB, t1:String(2*ch), t2:String(2*ch+1), in1:`IN${ch}+`, in2:`IN${ch}-`, desc:s.origen==="reserva" ? "Reserva" : s.descripcion, fv:"0,5 A" };
      ult0 = x+56;
      if(deLimpieza(s)){
        const L = eq.limpieza.tag, b = { a1:`${L}.+`, a2:`${L}.-`, a3:`SHIELD.${L}` };
        P.pz("ai_clp", x, { lineas:{ desc:24 }, vars:Object.assign(base, b), texto: textos([[0.33, 668.23, P.ref(K(b.a1+">"))], [24.33, 665.97, P.ref(K(b.a2+">"))], [-21.67, 677.63, P.ref(K(b.a3+">"))]]) });
        P.marca(K(b.a1+"<"), x, 650); P.marca(K(b.a2+"<"), x+24, 650); P.marca(K(b.a3+"<"), x-22, 650);
        return;
      }
      ult24 = x;
      if(s.origen==="reserva"){ P.pz("ai_tx", x, { lineas:{ desc:24 }, vars:base, omitir:[[-60, 499, 70, 800]] }); return; }
      const ins = inst.get(s.tag), tx = `${up(ins ? ins.descripcion : s.descripcion)}\n${s.senal||s.tag}`;
      P.pz("ai_tx", x, { lineas:{ desc:24, tx:32 }, vars:Object.assign(base, { tx }) });
      // fusible propio del transmisor en XF1 (si el listado de circuitos lo tiene): la flecha de 24 Vdc apunta aquí
      const cT = c24.find(q=>!q.reserva && s.tag && String(q.descripcion||"").includes(s.tag));
      if(cT){ P.marca(K(fA(cT)+"<"), x, 660); P.marca(K(fB(cT)+"<"), x+24, 660); }
    });
    P.linea(X0-16, 338.85, ult24, 338.85, BUS.v24); P.linea(X0-16, 314.85, ult0, 314.85, BUS.v0);
    if(i===partes.length-1) P.pz("ai_sh", X0 + n*80, { texto: textos([], [[27, 257.85, String(2*m.canales)], [51, 257.85, String(2*m.canales+1)]]) });
  });
}

/* ---------- 7) salidas analógicas ---------- */
function hAO(c, m){
  const { P, K, nombre, c24De, fA, destino, bornes } = c;
  const partes = trozos(m.senales, 8), cAO = c24De(/salidas anal/i);
  partes.forEach((sen, i)=>{
    P.hoja(`${nombre} - SALIDAS ANALÓGICAS ${m.tag} (SLOT ${m.slot})${partes.length>1 ? ` (${i+1} DE ${partes.length})` : ""}`);
    const n = sen.length, X0 = (806 - (n*80+114))/2 + 62, xs = sen.map((_, k)=>X0 + 80*k);
    P.pz("ao_div", 0);
    P.pz("ao_mod", X0, { vars:{ tag:m.tag, modelo:m.modelo, slot:`slot ${m.slot}` } });
    P.pz("ao_tb", X0, { vars:{ tb:m.tb, tbs:"4mm2", tbm:c.modBorne(m.tb, 0) } });
    if(cAO && !i){ P.marca(K(fA(cAO)+"<"), X0-36, 658); P.marca(K(c.fB(cAO)+"<"), X0-36, 658); }
    let libre = true;
    sen.forEach((s, k)=>{
      const x = xs[k], [bA, bB] = bornes(s), ch = s.ch;
      const base = { bA, bB, t1:String(2*ch), t2:String(2*ch+1), o1:`OUT${ch}+`, o2:`OUT${ch}-`, desc:s.origen==="reserva" ? "Reserva" : s.descripcion };
      if(s.origen==="reserva") P.pz("ao_res", x, { lineas:{ desc:24 }, vars:base });
      else {
        if(x > 120 && x < 330) libre = false;
        const dest = `HACIA ${s.origen==="instrumento" ? "INSTALACIÓN EN CAMPO" : destino(s)}\n${up(s.descripcion)}\n${s.senal||s.tag}`;
        P.pz("ao_ch", x, { lineas:{ desc:24, dest:26 }, vars:Object.assign(base, { dest }) });
      }
    });
    const xsh = X0 + n*80;
    P.linea(X0+62, 512.85, xsh, 512.85, BUS.sh);
    P.pz("ao_sh", xsh, { texto: textos([], [[3, 623.2, String(2*m.canales)], [27, 623.2, String(2*m.canales+1)]]) });
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
    const kI = i ? `do:${i}:N` : `${cb}.4`, kC = i ? `do:${i}:L` : `${cb}.2`;
    P.pz("do_bus_izq", X0, { vars:{ a:izq, v:"120 VAC" }, texto: textos([[-90.8, 216.53, P.ref(K(kI+">"))]]) });
    P.marca(K(kI+"<"), X0-70, 216);
    sen.forEach((s, k)=>{
      const x = xs[k], r = eq.reles.find(r=>r.modulo===m.tag && r.ch===s.ch) || {}, cr = r.tag||"";
      P.pz("do_ch", x, { lineas:{ desc:22 }, vars:{ desc:s.origen==="reserva" ? "Reserva" : s.descripcion, t:String(s.ch + j), out:`OUT${s.ch}`, cr,
        crc:(String(r.modelo||"").match(/\d*NA\/?N?C?/)||["1NA"])[0], crm:r.bobina ? `BOBINA ${up(r.bobina)}` : "" },
        texto: textos([[14.48, 203.23, P.ref(K(cr+"@c"))]]) });
      P.marca(K(cr+"@b"), x, 306);
    });
    const der = `${(eq.reles.find(r=>r.modulo===m.tag && r.ch===sen[n-1].ch)||{}).tag||"CR"}.A2`;
    P.linea(X0-64, 216.85, sigue ? xl+52 : xl, 216.85, BUS.ret);
    if(sigue){
      P.pz("do_bus_der", xl, { vars:{ a:der, v:"120 VAC" }, texto: textos([[79.05, 216.53, P.ref(K(`do:${i+1}:N<`))]]) });
      P.marca(K(`do:${i+1}:N>`), xl+54, 216);
    }
    izq = der;
    // común de los contactos (L) del grupo de 8 salidas
    const xc = xl + 64;
    P.pz("do_com", xc, { vars:{ a:`${cb}.2`, t:String(8*(j+1)+j), com:`COM${j}`, v:"120 VAC" }, omitir: sigue ? [] : [[4, 525, 90, 550]],
      texto: textos([[-46.8, 536.53, P.ref(K(kC+">"))], [50.8, 536.53, sigue ? P.ref(K(`do:${i+1}:L<`)) : ""]]) });
    P.marca(K(kC+"<"), xc-26, 536); if(sigue) P.marca(K(`do:${i+1}:L>`), xc+30, 536);
  });
}

/* ---------- 9) contactos de los relés de interfaz hacia la bornera (10 por hoja) ---------- */
function hContactos(c){
  const { P, K, eq, nombre, destino, bornes } = c;
  const hojas = grupos(eq.reles, 10);
  hojas.forEach((rs, i)=>{
    P.hoja(`${nombre} - CONTACTOS DE LOS RELÉS DE INTERFAZ${hojas.length>1 ? ` (${i+1} DE ${hojas.length})` : ""}`, 12);
    const filas = rs.length > 5 ? 2 : 1, porFila = Math.ceil(rs.length/filas), Wb = (porFila-1)*142 + 150, x0 = (806-Wb)/2 + 78;
    rs.forEach((r, k)=>{
      const f = Math.floor(k/porFila), col = k % porFila, x = x0 + col*142, dy = filas===1 ? -156 : -312*f;
      const m = eq.plc.modulos.find(m=>m.tag===r.modulo) || {}, s = r.senal || {}, [bA, bB] = bornes(s);
      const desc = r.reserva ? "Reserva" : `Hacia ${s.origen==="instrumento" ? "instalación en campo "+(s.tag||"") : destino(s).toLowerCase().replace(/(tf|tc)-/i, x=>x.toUpperCase())} ${String(s.descripcion||"").replace(/^./, x=>x.toLowerCase())}`;
      P.pz("rc", x, { dy, lineas:{ desc:24 }, vars:{ tb:m.tb||"", bA, bB, cr:r.tag, crm:r.bobina ? `BOBINA ${up(r.bobina)}` : "", tbm:c.modBorne(m.tb, 0), desc },
        texto: textos([[-12, 588.08, P.ref(K(r.tag+"@b"))]]) });
      P.marca(K(r.tag+"@c"), x, 594+dy);
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
      const W = 178 + (n-1)*80 + 80, xf = Math.max(10, (806 - W)/2);
      X0 = xf + 178; xIni = xf + 146;
      P.pz("di_fpd", xf, { vars:{ tag:fpd.tag, modelo:fpd.modelo, a1:`${cb}.2`, a2:`${cb}.4`, v:"120 VAC" }, texto: textos([[20.33, 502.05, P.ref(K(`${cb}.2>`))], [52.33, 502.05, P.ref(K(`${cb}.4>`))]]) });
      P.marca(K(`${cb}.2<`), xf+20, 523); P.marca(K(`${cb}.4<`), xf+52, 523);
    } else {
      X0 = (806 - (90 + (n-1)*80 + 80))/2 + 90; xIni = X0-44;
      const kk = i ? `di:${i}` : `${cb}.2`;
      P.pz("di_bus_izq", X0, { vars:{ a:izq, v:"120 VAC" }, texto: textos([[-75.32, 664.53, P.ref(K(kk+">"))]]) });
      P.marca(K(kk+"<"), X0-48, 664);
    }
    const xs = sen.map((_, k)=>X0 + 80*k), xl = xs[n-1];
    P.pz("di_xfb", X0, { vars:{ tb:m.tb, tbm1:"UT 4-L/", tbm2:"HESI (5X20)", tbs:"4mm2" } });
    P.pz("di_xfa", X0, { vars:{ tb:m.tb, tbs:"4mm2", tbm1:"UT 4-L/", tbm2:"HESI (5X20)", fv:"0,5 A" } });
    P.pz("di_mod", X0, { vars:{ tag:m.tag, modelo:m.modelo, slot:`slot ${m.slot}` } });
    sen.forEach((s, k)=>{
      const x = xs[k], [b1, b2] = bornes(s);
      const base = { bB:b1, bA:b2, t:String(s.ch+1), inn:`In-${s.ch}`, fv:"0,5 A", desc:s.origen==="reserva" ? "Reserva" : s.descripcion };
      if(deLimpieza(s)){
        const a1 = `${m.tb}.${b1}`, a2 = `${m.tb}.${b2}`;
        P.pz("di_clp", x, { lineas:{ desc:24, dest:24 }, vars:Object.assign(base, { a1, a2, dest:`VIENE DEL ${up(eq.limpieza.desc).replace(/\s*\(.*$/, "")}` }),
          texto: textos([[45.92, 480.53, P.ref(K(a1+"<"))], [45.98, 450.53, P.ref(K(a2+">"))]]) });
        P.marca(K(a1+">"), x+22, 480); P.marca(K(a2+"<"), x+22, 450); return;
      }
      const ins = inst.get(s.tag);
      const dest = s.origen==="reserva" ? "RESERVA" : s.origen==="instrumento" ? `(INSTALACIÓN EN CAMPO)\n${up(ins ? ins.descripcion : s.descripcion)}\n${s.tag}` : `DESDE ${destino(s)}\n${up(s.descripcion)}\n${s.tag}`;
      P.pz("di_ch", x, { lineas:{ desc:24, dest:24 }, vars:Object.assign(base, { dest }) });
    });
    P.linea(xIni, 664.85, sigue ? xl+26 : xl, 664.85, BUS.di);
    const der = `${m.tb}.${bornes(sen[n-1])[0]}`;
    if(sigue){
      P.pz("di_bus_der", xl, { vars:{ a:der, v:"120 VAC" }, texto: textos([[57.92, 664.53, P.ref(K(`di:${i+1}<`))]]) });
      P.marca(K(`di:${i+1}>`), xl+34, 664);
    }
    izq = der;
  });
}

/* ---------- 11) controlador de limpieza: tarjeta, bornera de paso en campo y válvulas solenoides ---------- */
function hLimpieza(c){
  const { P, K, eq, nombre, cbL, peDe, deLimpieza, kit } = Object.assign({ kit:c.P.kit }, c);
  const L = eq.limpieza;
  P.hoja(`${nombre} - CONTROLADOR DE LIMPIEZA ${L.tag}`);
  const ai = eq.plc.modulos.some(m=>m.tipo==="AI" && m.senales.some(deLimpieza));
  let di = null;
  for(const m of eq.plc.modulos.filter(m=>m.tipo==="DI")) for(const s of m.senales) if(!di && deLimpieza(s)){ const [b1, b2] = c.bornes(s); di = [`${m.tb}.${b1}`, `${m.tb}.${b2}`]; }
  const a = { a1:`${L.tag}.+`, a2:`${L.tag}.-`, a3:`SHIELD.${L.tag}`, a4:di ? di[0] : "", a5:di ? di[1] : "", a6:cbL ? `${cbL.tag}.2` : "", a7:cbL ? `${cbL.tag}.4` : "", a8:peDe("limp") };
  const omit = []; if(!ai) omit.push([0, 552, 141, 600]); if(!di) omit.push([0, 530, 141, 552]);
  const ent = { a1:0, a2:0, a3:0, a4:1, a5:0, a6:1, a7:1, a8:1 };   // 1: la flecha entra a la tarjeta
  const pos = { a1:[42.63, 588.36], a2:[44.89, 578.36], a3:[33.23, 558.36], a4:[40.09, 548.36], a5:[40.03, 536.36], a6:[37.81, 496.36], a7:[37.81, 470.36], a8:[46.99, 450.53] };
  P.pz("l_div", 0);
  P.pz("l_ctrl", 0, { omitir:omit, lineas:{ desc2:30 }, vars:Object.assign({ tag:L.tag, modelo:"", desc1:"TARJETA DE CONTROL", desc2:"LIMPIEZA SECUENCIAL", tmx:"TMX", tmxm:"" }, a),
    texto: textos(Object.entries(pos).map(([k, [x, y]])=>[x, y, a[k] ? P.ref(K(a[k]+(ent[k] ? ">" : "<"))) : ""])) });
  for(const [k, [, y]] of Object.entries(pos)) if(a[k]) P.marca(K(a[k]+(ent[k] ? "<" : ">")), 64, y);
  // bornes del conector TMX (PE, común y salidas) leídos de la pieza
  const tmx = kit.piezas.l_ctrl.e.filter(e=>e[0]==="C" && e[5]>424 && e[5]<438 && e[6]<3).map(e=>e[4]).sort((x, y)=>x-y).filter((x, i, arr)=>!i || x-arr[i-1]>3);
  const vs = (L.senales||[]).filter(s=>s.tipo==="DO").slice(0, Math.max(0, tmx.length-2));
  const yT = 364.85, yTMX = Math.min(...kit.piezas.l_ctrl.e.filter(e=>e[0]==="C" && e[5]>424 && e[5]<438).map(e=>e[5]-e[6]));
  const term = [{ x:tmx[0], n:"PE" }, { x:tmx[1], n:"C" }].concat(vs.map((s, i)=>({ x:tmx[i+2], n:String(i+1), s })));
  P.pz("l_tb", term[0].x, { vars:{ tb:"TB1", tbs:"4mm2", tbm:"PTTB 4", tbpe:"UT 4-PE", caja:"CAJA DE PASO" } });
  const cx0 = term[0].x-36, cx1 = term[term.length-1].x+12;
  for(const [x1, y1, x2, y2] of [[cx0, 342.85, cx1, 342.85], [cx1, 342.85, cx1, 370.85], [cx1, 370.85, cx0, 370.85], [cx0, 370.85, cx0, 342.85]]) P.linea(x1, y1, x2, y2, BUS.caja);
  for(const b of term){ P.pz("l_borne", b.x, { vars:{ b:b.n } }); P.linea(b.x, yTMX, b.x, yT+4, BUS.campo); }
  // válvulas repartidas en el ancho libre (a la izquierda del cajetín), cableado ordenado sin cruces
  const n = vs.length; if(!n) return;
  const pv = n>1 ? Math.min(40, 590/(n-1)) : 0, sv = Math.min(1, (pv||40)/31), xv0 = (45+640)/2 - pv*(n-1)/2;
  const xv = vs.map((_, i)=>xv0 + i*pv);
  const izq = [], der = [];
  term.slice(2).forEach((b, i)=>{ b.xv = xv[i]; (b.xv <= b.x ? izq : der).push(b); });
  const paso = Math.min(5, 96/Math.max(1, izq.length, der.length));
  izq.forEach((b, k)=>{ b.y = 344 - paso*k; }); der.slice().reverse().forEach((b, k)=>{ b.y = 344 - paso*k; });
  for(const b of term.slice(2)){
    P.linea(b.x, yT-4, b.x, b.y, BUS.campo); P.linea(b.x, b.y, b.xv, b.y, BUS.campo); P.linea(b.xv, b.y, b.xv, 226.85, BUS.campo);
    P.pz("l_valv", b.xv, { s:sv, yc:226.85, vars:{ tag:b.s.tag } });
  }
  // común (N) y tierra: por la izquierda, por encima de las salidas, hasta las barras bajo las válvulas
  const [tPE, tC] = term, yN = 186, yPE = 179, xa = Math.min(30, xv[0]-20), xb = xa-6;
  P.linea(tPE.x, yT-4, tPE.x, 354, BUS.campo); P.linea(tPE.x, 354, xb, 354, BUS.campo); P.linea(xb, 354, xb, yPE, BUS.campo); P.linea(xb, yPE, xv[n-1]+8*sv, yPE, BUS.campo);
  P.linea(tC.x, yT-4, tC.x, 350, BUS.campo); P.linea(tC.x, 350, xa, 350, BUS.campo); P.linea(xa, 350, xa, yN, BUS.campo); P.linea(xa, yN, xv[n-1], yN, BUS.campo);
  const yb = 226.85 + (194.85-226.85)*sv;
  for(const x of xv){
    P.linea(x, yb, x, yN, BUS.campo);
    const xp = x + 8*sv; P.linea(xp, yb, xp, yN+1.5, BUS.campo); P.arco(xp, yN, 1.5, -90, 90, BUS.campo); P.linea(xp, yN-1.5, xp, yPE, BUS.campo);
  }
}

/* Ingenia — DIAGRAMA DE LAZO armado con las piezas de la plantilla de lazos del usuario
   (assets/plantillas/planos/lazo.json, extraído con tools/planos/piezas_lazo.py).
   Lámina con las columnas de la plantilla CAMPO | TABLERO DE CONTROL | SOFTWARE y una fila por lazo:
   · equipo de campo (burbuja ISA y bornes del equipo) → cable con su TAG y especificación (haces con las curvas
     de la plantilla, pantalla en los pares) → bornes del tablero (cabecera por bornera) con sus referencias de
     tensión → (relé de interfaz) → módulo de E/S (tipo, rack, slot, canal y bornes del canal) → barra de la CPU →
     función en el software (símbolo con las alarmas de la filosofía de control y el servicio);
   · tipos de fila: transmisor de 2 hilos (un solo fusible por lazo: el fusible-borne XF2.k en la pata de +24 Vdc; el
     retorno entra por el segundo borne del canal al IN+, como en el multifilar), equipo de 4 hilos con
     su alimentación (segundo cable a TB3 / XF1), salida analógica, interruptor con alimentación propia (DI + PWR),
     contacto seco, sensor PNP de 24 Vdc (con relé de interfaz si el módulo es de 120 Vac), salida digital con su
     relé CRn hacia la válvula, y los lazos del controlador de limpieza (transmisor con retransmisión al PLC y
     válvulas solenoides).
   Todo sale de equiposControl() y del listado I/O (bornes, slot, canal, fusibles, ITM y relés con los mismos TAG
   del multifilar y del mecánico) y de plc-modulos.js (bornes de cada canal según el módulo). Las filas se ordenan
   por tablero de control y por tipo / slot / canal; cada tablero empieza en una lámina nueva, las filas se reparten
   de forma pareja entre láminas y se distribuyen y centran en la altura útil sin tocar el rótulo. */
import { DXFDoc } from "../engine/tablero-core.js";
import { dibujarLamina, PASO_HOJAS } from "./formato.js";
import { cargarKit, usarKit, pieza, envolver } from "./kit.js";
import { datos, instrumentos, tipoInstrumento, expandirTag, funcionISA, sistemaTag, tablerosControl, tc } from "../datos.js";
import { equiposControl } from "../control/equipos.js";
import { terminalesCanal, infoModulo } from "../control/plc-modulos.js";
import { filosofiaDe } from "../modules/filosofia.js";

// geometría de la plantilla (mm, relativa al área de dibujo de 806 x 533)
const W = 806, H = 533;
const XB = 351.47, XREL = 505.64, XMOD = 596.47, XCPU = [626.47, 651.47], XC1 = 232.85, XC2 = 659.61, XTCL = 176;
const XD3 = 66.47, XD = 71.47;                 // borde derecho de los bornes del equipo (3 bornes / con rótulo lateral)
const XTXT = 166.47;                           // centro del texto del cable
const YCAB = 513.01, YCPU = [53.01, 503.01];  // banda de encabezado y barra de la CPU
const Y_TOP = 495, Y_BOT_MIN = 74, GMIN = 8, GMAX = 24;
const NOTA_DEF = ["ES RESPONSABILIDAD DEL USUARIO DE ESTE PLANO ASEGURARSE DE USAR LA VERSIÓN MÁS RECIENTE DEL MISMO."];
const ANA = "I-SE-ANALO", CTL = "I-CONTROL", TX = "G-TEX";
const WF = 0.75;                               // estilo ROMANS-SP de la plantilla (romans.shx, factor de ancho 0,75)
const ancho = (s, h, wf=WF) => String(s).length*h*0.8*wf;   // ancho holgado de un texto (para achicar los que no entran)

const may = s => String(s||"").toUpperCase();
const dos = n => String(n==null || n==="" ? "" : n).padStart(2, "0");
const sinGuion = s => String(s||"").replace(/[-\s]/g, "");
/* «TB6:1 / TB6:2» → [{ tb:"TB6", n:"1" }, …] */
const bornesIO = t => String(t||"").split("/").map(x=>x.trim()).filter(x=>/:/.test(x)).map(x=>{ const [tb, n] = x.split(":"); return { tb:tb.trim(), n:n.trim() }; });
/* borne de un circuito de equipos: «TB3.5/6» → { tb:"TB3", a:"5", b:"6" }; «XF1.7» → { tb:"XF1", a:"7" } */
const borneCirc = c => { const m = String((c && c.borne)||"").match(/^([A-Z]+\d*)\.(\w+)(?:\/(\w+))?$/); return m ? { tb:m[1], a:m[2], b:m[3]||null } : null; };
const lineasMax = (s, n, max) => { const l = envolver(s, n); return (l.length > max ? l.slice(0, max) : l).join("\n"); };

/* ======================= filas (coordenadas relativas: x al área, y al conductor superior) ======================= */
class Fila {
  constructor(lz){ this.lz = lz; this.ops = []; }
  pz(n, x, y, vars, o){ this.ops.push({ k:"pz", n, x, y, o:Object.assign({ vars:vars||{} }, o||{}) }); }
  l(x1, y1, x2, y2, capa){ if(Math.abs(x1-x2) > 1e-6 || Math.abs(y1-y2) > 1e-6) this.ops.push({ k:"l", x1, y1, x2, y2, capa }); }
  a(x, y, r, a1, a2, capa){ this.ops.push({ k:"a", x, y, r, a1, a2, capa }); }
  t(x, y, h, txt, o){ if(txt!=null && String(txt).trim()) this.ops.push({ k:"t", x, y, h, txt:String(txt), o:Object.assign({ capa:TX, wf:WF }, o||{}) }); }
  el(x, y, rx, ry, capa){ this.ops.push({ k:"el", x, y, rx, ry, capa }); }
}

/* haz de conductores en el equipo (o en la salida de un controlador): cada conductor sale del borne, baja con una
   curva a la vertical xv y sube hasta el conductor superior, que sigue como línea del cable */
function hazOrigen(F, capa, xd, cond){
  const xv = xd + 20, yb = cond[0].y;
  cond.forEach(c=>F.t(xd+5, c.y+3.51, 2.5, c.c, { va:3 }));
  for(const c of cond.slice(1)){ F.l(xd, c.y, xv-2, c.y, capa); F.a(xv-2, c.y+2, 2, 270, 0, capa); }
  if(cond.length > 1){ F.l(xv, cond[cond.length-1].y+2, xv, yb-2, capa); F.a(xv+2, yb-2, 2, 90, 180, capa); }
}
/* cable: haz de origen → línea del cable (TAG y especificación) → llegada a los bornes en xl.
   cb = { capa, xd, origen:[{y,c}], llegada:[{y,c}], par:bool (par apantallado: pantalla a sh), sh:{y}, xt, tag, spec } */
function cable(F, cb){
  const { capa, xd } = cb, xl = cb.xl || XB, yb = cb.origen[0].y, et = (y, c)=>F.t(xl-5, y+3.51, 2.5, c, { ha:2, va:3 });
  hazOrigen(F, capa, xd, cb.origen);
  const L = cb.llegada;
  if(cb.par){
    // par apantallado (plantilla): + sigue recto, - baja por x-30, la pantalla abraza el par en x-15 y baja al borne SH
    const xa = xl-30, xs = xl-15, y1 = L[1].y;
    F.l(xd, yb, xl, yb, capa); et(yb, L[0].c);
    F.a(xa-2, yb-2, 2, 0, 90, capa); F.l(xa, yb-2, xa, y1+2, capa); F.a(xa+2, y1+2, 2, 180, 270, capa); F.l(xa+2, y1, xl, y1, capa); et(y1, L[1].c);
    F.el(xs, (yb+y1)/2, 1, (yb-y1)/2 + 0.5, capa);
    if(cb.sh){ const ys = cb.sh.y; F.l(xs, y1-0.5, xs, ys+2, capa); F.a(xs+2, ys+2, 2, 180, 270, capa); F.l(xs+2, ys, xl, ys, capa); et(ys, "SH"); }
  } else {
    const recto = L.find(c=>Math.abs(c.y-yb) < 0.01), resto = L.filter(c=>c!==recto), xv = recto ? xl-15 : xl-30;
    F.l(xd, yb, recto ? xl : xv-2, yb, capa); if(recto) et(yb, recto.c);
    if(resto.length){
      F.a(xv-2, yb-2, 2, 0, 90, capa); F.l(xv, yb-2, xv, Math.min(...resto.map(c=>c.y))+2, capa);
      for(const c of resto){ F.a(xv+2, c.y+2, 2, 180, 270, capa); F.l(xv+2, c.y, xl, c.y, capa); et(c.y, c.c); }
    }
  }
  if(cb.tag){ const xt = cb.xt || XTXT; F.t(xt, yb+2.8, 2.5, cb.tag, { ha:1, va:3 }); F.t(xt, yb+2.8-4.1667, 2.5, cb.spec, { ha:1, va:3 }); }
}
/* línea horizontal que baja de y1 a y2 en xq con las curvas de la plantilla (pantalla del borne SH al Shield del módulo) */
function quiebre(F, x1, y1, x2, y2, xq, capa){
  if(Math.abs(y1 - y2) < 0.01) return F.l(x1, y1, x2, y1, capa);
  F.l(x1, y1, xq-2, y1, capa); F.a(xq-2, y1-2, 2, 0, 90, capa); F.l(xq, y1-2, xq, y2+2, capa); F.a(xq+2, y2+2, 2, 180, 270, capa); F.l(xq+2, y2, x2, y2, capa);
}
/* bornes del tablero (o del controlador) apilados cada 5 mm, con una cabecera cada vez que cambia la bornera.
   b = { tb, n, c, der:{ pz, v }, izq:{ v } }; tb null: conductor sin borne (reserva o referencia directa) */
function apilar(lista, y0){
  let y = y0, prev;
  for(const b of lista){
    if(b.tb!=null && b.tb!==prev){ if(prev!==undefined) y -= 5; b.cab = true; prev = b.tb; }
    else if(prev===undefined) prev = b.tb;
    b.y = y; y -= 5;
  }
  return lista;
}
function bornes(F, lista, x=XB){
  for(const b of lista){
    if(b.cab) F.pz("b_cab", x, b.y, { tb:b.tb });
    if(b.tb!=null) F.pz("b_borne", x, b.y, { b:b.n });
    if(b.der) F.pz(b.der.pz, b.tb!=null ? x+10 : x, b.y, { v:b.der.v });
    if(b.izq) F.pz("s_izq", x, b.y, { v:b.izq.v });
  }
}
/* módulo de E/S con su primer borne en yIN; devuelve la altura de la flecha hacia el software (centro del módulo).
   Bornes del canal según plc-modulos.js (los mismos de equiposControl); los nombres largos se escriben más bajos */
function modulo(F, lz, yIN){
  const { m, s } = lz, ana = m.tipo==="AI" || m.tipo==="AO";
  const tc = s.bornes || terminalesCanal(m.modelo, s.ch, lz.conexion||"") || {};
  const nom = (ana ? [tc.pos, tc.neg, tc.sh || "Shield"] : [tc.pos]).map(x=>String(x||""));
  const tipo = `TIPO: ${m.modelo || m.tipo}`, w = ancho(tipo, 2.5);     // modelos largos (p. ej. Siemens): texto más bajo
  const vals = { 14:"01", 10:dos(m.slot), 6:dos(s.ch) }, cabe = t => ancho(t, 2.5) <= 13.5;
  F.pz(ana ? "mod_ai" : "mod_di", 0, yIN, { tipo: w <= 28 ? tipo : "", i1:cabe(nom[0]) ? nom[0] : "", i2:cabe(nom[1]||"") ? nom[1] : "", i3:cabe(nom[2]||"") ? nom[2] : "" },
    { texto:(t, e)=>t==="{v}" ? (vals[Math.round(e[5])] ?? "") : t });
  if(w > 28) F.t(611.47, yIN+20, 2.5*28/w, tipo, { ha:1, va:2 });
  nom.forEach((t, k)=>{ if(!t || cabe(t)) return;
    if(k===2 && ancho(t, 1.6) > 13.5) t = "SH";                           // pantalla descrita en texto largo
    F.t(603.97, yIN - 5*k, Math.max(1.2, Math.min(2.5, 2.5*13.5/ancho(t, 2.5))), t, { ha:1, va:2 }); });
  return ana ? yIN + 5 : yIN + 10;
}
/* función en el software: flecha desde la CPU, símbolo con su TAG y alarmas, servicio encima */
function software(F, yA, lz, ctx){
  F.pz("sw", 0, yA, { fn:lz.fn, sis:ctx.sis, serv:lineasMax(may(lz.serv), 26, 3) });
  // niveles de alarma de la filosofía junto al símbolo (variables analógicas; en las discretas el TAG ya es la alarma)
  const al = lz.m && lz.m.tipo==="AI" ? ["HH","H","L","LL"].filter(a=>(ctx.alarmas.get(lz.tagInst)||new Set()).has(a)) : [];
  const xa = Math.max(694.3, 687.47 + ancho(ctx.sis, 2.0)/2 + 0.8);      // a la derecha del símbolo y del código del sistema
  al.forEach((a, k)=>F.t(xa, yA + al.length*1.5 - 0.5 - 3*k, 2.0, a, { va:3 }));
}
/* equipo de campo: pieza con la burbuja ISA (TAG y sistema), bornes del equipo y descripción */
function equipo(F, n, lz, ctx, d){
  const tg = lz.tagInst;
  F.pz(n, 0, 0, Object.assign({ tag:tg, sis:ctx.sis.slice(0, 11), desc:lineasMax(may(lz.i.descripcion || lz.s.descripcion), 16, 3) }, d));
}
const cableTag = (ctx, tag, suf) => `${ctx.sis}${sinGuion(tag)}-${suf}`;

/* ---------- tipos de fila ---------- */
const FILAS = {
  // transmisor de 2 hilos alimentado desde el tablero (como la plantilla y el multifilar): + al fusible-borne XF2.k
  // (24 Vdc, el único fusible del lazo), - al segundo borne del canal → IN+, IN- a 0 Vdc; la pantalla baja al Shield
  ai2h(F, lz, ctx){
    equipo(F, "d_tx", lz, ctx, { d1:"+", d2:"-", d3:"GND" });
    const b = lz.bornes[1], fu = lz.s.fusible ? lz.s.fusible.tag.split(".") : null;
    const L = apilar([fu ? { tb:fu[0], n:fu[1], der:{ pz:"s_ana", v:"24 Vdc" } } : { tb:null, der:{ pz:"s_ana", v:"24 Vdc" } },
      { tb:b.tb, n:b.n }, { tb:b.tb, n:"SH" }], 0);
    bornes(F, L);
    const yIN = L[1].y;
    cable(F, { capa:ANA, xd:XD3, origen:[{ y:0, c:"P1+" }, { y:-5, c:"P1-" }], llegada:[{ y:0, c:"P1+" }, { y:yIN, c:"P1-" }], par:true, sh:{ y:L[2].y },
      tag:cableTag(ctx, lz.tagInst, "J01"), spec:"1-1Pr#16AWG+SH" });
    F.l(XB+10, yIN, XMOD, yIN, ANA);
    F.pz("s_izq", XMOD, yIN-5, { v:"0 Vdc" });
    quiebre(F, XB+10, L[2].y, XMOD, yIN-10, 521.47, ANA);
    software(F, modulo(F, lz, yIN), lz, ctx);
  },
  // equipo de 4 hilos: señal por un par apantallado al canal y alimentación propia por un segundo cable
  ai4h(F, lz, ctx){
    const dc = /24\s*V/i.test(lz.i.alimentacion||""), c = lz.circ, bc = borneCirc(c);
    equipo(F, "d_4h", lz, ctx, { d1:"+", d2:"-", d3: dc ? "24V" : "L", d4: dc ? "0V" : "N", d5:"GND" });
    const [a, b] = lz.bornes;
    const S = apilar([{ tb:a.tb, n:a.n }, { tb:b.tb, n:b.n }, { tb:a.tb, n:"SH" }], 0);
    const pw = dc ? [bc ? { tb:bc.tb, n:bc.a, der:{ pz:"s_dc", v:"24 Vdc" } } : { tb:null, der:{ pz:"s_dc", v:"24 Vdc" } },
                     bc ? { tb:bc.tb, n:"0V", der:{ pz:"s_dc", v:"0 Vdc" } } : { tb:null, der:{ pz:"s_dc", v:"0 Vdc" } }, { tb:null, der:{ pz:"s_pe", v:"PE" } }]
                  : [bc ? { tb:bc.tb, n:bc.a, der:{ pz:"s_ac", v:ctx.vac } } : { tb:null, der:{ pz:"s_ac", v:ctx.vac } },
                     bc ? { tb:bc.tb, n:bc.b||"N", der:{ pz:"s_ac", v:"N" } } : { tb:null, der:{ pz:"s_ac", v:"N" } }, bc ? { tb:bc.tb, n:"PE", der:{ pz:"s_pe", v:"PE" } } : { tb:null, der:{ pz:"s_pe", v:"PE" } }];
    const P = apilar(pw, -25);
    bornes(F, S); bornes(F, P);
    cable(F, { capa:ANA, xd:XD, origen:[{ y:0, c:"P1+" }, { y:-5, c:"P1-" }], llegada:[{ y:0, c:"P1+" }, { y:-5, c:"P1-" }], par:true, sh:{ y:-10 },
      tag:cableTag(ctx, lz.tagInst, "J01"), spec:"1-1Pr#16AWG+SH" });
    cable(F, { capa:CTL, xd:XD, origen:[{ y:-10, c:"1" }, { y:-15, c:"2" }, { y:-20, c:"GND" }], llegada:P.map((x, k)=>({ y:x.y, c:["1","2","GND"][k] })),
      tag:cableTag(ctx, lz.tagInst, "C01"), spec:"1-2C#14AWG+T" });
    for(const x of S) F.l(XB+10, x.y, XMOD, x.y, ANA);
    software(F, modulo(F, lz, 0), lz, ctx);
  },
  // salida analógica hacia el equipo de campo (posicionador, variador…)
  ao(F, lz, ctx){
    equipo(F, "d_tx", lz, ctx, { d1:"+", d2:"-", d3:"GND" });
    const [a, b] = lz.bornes;
    const S = apilar([{ tb:a.tb, n:a.n }, { tb:b.tb, n:b.n }, { tb:a.tb, n:"SH" }], 0);
    bornes(F, S);
    cable(F, { capa:ANA, xd:XD3, origen:[{ y:0, c:"P1+" }, { y:-5, c:"P1-" }], llegada:[{ y:0, c:"P1+" }, { y:-5, c:"P1-" }], par:true, sh:{ y:-10 },
      tag:cableTag(ctx, lz.tagInst, "J01"), spec:"1-1Pr#16AWG+SH" });
    for(const x of S) F.l(XB+10, x.y, XMOD, x.y, ANA);
    software(F, modulo(F, lz, 0), lz, ctx);
  },
  // interruptor con alimentación propia de 120 Vac (nivel vibratorio, velocidad cero…): PWR a TB3, contacto al canal
  di120(F, lz, ctx){
    const vel = /^SS/.test(tipoInstrumento(lz.tagInst));
    // número de borne del equipo: NO, COM, NC, N, L (plantilla: nivel 5/4/3/2/1; velocidad cero 1/2/3/5/4)
    const n = vel ? { NO:"1", COM:"2", NC:"3", N:"5", L:"4" } : { NO:"5", COM:"4", NC:"3", N:"2", L:"1" };
    const dv = vel ? ["1/NO","2/COM","3/NC","4/L","5/N","GND"] : ["5/NO","4/COM","3/NC","2/N","1/L","GND"];
    equipo(F, "d_di", lz, ctx, { d1:dv[0], d2:dv[1], d3:dv[2], d4:dv[3], d5:dv[4], d6:dv[5] });
    const bc = borneCirc(lz.circ), [a, b] = lz.bornes;
    const L = apilar([{ tb:bc.tb, n:bc.a, c:n.L, der:{ pz:"s_ac", v:ctx.vac } }, { tb:bc.tb, n:bc.b||"N", c:n.N, der:{ pz:"s_ac", v:"N" } }, { tb:bc.tb, n:"PE", c:"GND", der:{ pz:"s_pe", v:"PE" } },
      { tb:b.tb, n:b.n, c:n.NO }, { tb:a.tb, n:a.n, c:n.COM, der:{ pz: lz.diDC ? "s_dc" : "s_ctl", v:ctx.vdi } }, { tb:null, c:n.NC }], 0);
    bornes(F, L);
    const org = dv.map((x, k)=>({ y:-5*k, c:x.split("/")[0] }));
    cable(F, { capa:CTL, xd:XD, origen:org, llegada:L.map(x=>({ y:x.y, c:x.c })), tag:cableTag(ctx, lz.tagInst, "C01"), spec:"1-5C#14AWG+T" });
    F.l(XB+10, L[3].y, XMOD, L[3].y, CTL);
    software(F, modulo(F, lz, L[3].y), lz, ctx);
  },
  // contacto seco sin alimentación propia: NO al canal, COM a la alimentación de las entradas
  dc(F, lz, ctx){
    equipo(F, "d_pnp", lz, ctx, { d1:"1/NO", d2:"2/COM", d3:"3/NC", lado:"DI" });
    const [a, b] = lz.bornes;
    const L = apilar([{ tb:b.tb, n:b.n, c:"1" }, { tb:a.tb, n:a.n, c:"2", der: lz.diDC ? { pz:"s_dc", v:"24 Vdc" } : { pz:"s_ctl", v:ctx.vdi } }, { tb:null, c:"3" }], 0);
    bornes(F, L);
    cable(F, { capa:CTL, xd:XD, origen:[{ y:0, c:"1" }, { y:-5, c:"2" }, { y:-10, c:"3" }], llegada:L.map(x=>({ y:x.y, c:x.c })), tag:cableTag(ctx, lz.tagInst, "C01"), spec:"1-3C#14AWG+T" });
    F.l(XB+10, 0, XMOD, 0, CTL);
    software(F, modulo(F, lz, 0), lz, ctx);
  },
  // sensor PNP de 24 Vdc: + y 0 V desde su fusible-borne de XF1; salida al canal (módulo de 24 Vdc) o a la bobina
  // de un relé de interfaz cuyo contacto entra al módulo de 120 Vac (como en la plantilla)
  di24(F, lz, ctx){
    equipo(F, "d_pnp", lz, ctx, { d1:"BN", d2:"BK", d3:"BU", lado:"PNP" });
    const bc = borneCirc(lz.circ), [a, b] = lz.bornes;
    const pw = [bc ? { tb:bc.tb, n:bc.a, c:"1", der:{ pz:"s_dc", v:"24 Vdc" } } : { tb:null, c:"1", der:{ pz:"s_dc", v:"24 Vdc" } },
                bc ? { tb:bc.tb, n:"0V", c:"3", der:{ pz:"s_dc", v:"0 Vdc" } } : { tb:null, c:"3", der:{ pz:"s_dc", v:"0 Vdc" } }];
    if(lz.diDC){
      const L = apilar([...pw, { tb:b.tb, n:b.n, c:"2" }], 0);
      bornes(F, L);
      cable(F, { capa:CTL, xd:XD, origen:[{ y:0, c:"1" }, { y:-5, c:"2" }, { y:-10, c:"3" }], llegada:L.map(x=>({ y:x.y, c:x.c })), tag:cableTag(ctx, lz.tagInst, "C01"), spec:"1-3C#14AWG" });
      F.l(XB+10, L[2].y, XMOD, L[2].y, CTL);
      return software(F, modulo(F, lz, L[2].y), lz, ctx);
    }
    const L = apilar([...pw, { tb:a.tb, n:a.n, c:"2" }], 0), yA1 = L[2].y;
    bornes(F, L);
    cable(F, { capa:CTL, xd:XD, origen:[{ y:0, c:"1" }, { y:-5, c:"2" }, { y:-10, c:"3" }], llegada:L.map(x=>({ y:x.y, c:x.c })), tag:cableTag(ctx, lz.tagInst, "C01"), spec:"1-3C#14AWG" });
    // relé: 11 (+5), 14, A1 (-5), A2 (-10) respecto del borne 14
    const y14 = yA1 + 5;
    F.pz("rele", 0, y14, { tag:lz.rele });
    F.pz("s_ctl", XREL+10, y14+5, { v:ctx.vdi }); F.pz("s_dc", XREL+10, y14-10, { v:"0 Vdc" });
    F.l(XB+10, yA1, XREL, yA1, CTL); F.l(XREL+10, y14, XMOD, y14, CTL);
    software(F, modulo(F, lz, y14), lz, ctx);
  },
  // salida digital: OUTn → bobina del relé CRn; su contacto 11-14 alimenta la válvula por la bornera del módulo
  do(F, lz, ctx){
    equipo(F, "d_tx", lz, ctx, { d1:"1", d2:"2", d3:"GND" });
    const dcV = /24\s*V/i.test(lz.i.alimentacion||""), [a, b] = lz.bornes;
    const L = apilar([{ tb:a.tb, n:a.n, c:"1" }, { tb:b.tb, n:b.n, c:"2", der: dcV ? { pz:"s_dc", v:"0 Vdc" } : { pz:"s_ac", v:"N" } }, { tb:null, c:"GND", der:{ pz:"s_pe", v:"PE" } }], 0);
    bornes(F, L);
    cable(F, { capa:CTL, xd:XD3, origen:[{ y:0, c:"1" }, { y:-5, c:"2" }, { y:-10, c:"GND" }], llegada:L.map(x=>({ y:x.y, c:x.c })), tag:cableTag(ctx, lz.tagInst, "C01"), spec:"1-2C#14AWG+T" });
    F.pz("rele", 0, 0, { tag:lz.rele });
    F.pz(dcV ? "s_dc" : "s_ctl", XREL+10, 5, { v: dcV ? "24 Vdc" : ctx.vdo });
    F.pz(/24/.test(lz.bobina||"") ? "s_dc" : "s_ac", XREL+10, -10, { v: /24/.test(lz.bobina||"") ? "0 Vdc" : "N" });
    F.l(XB+10, 0, XREL, 0, CTL); F.l(XREL+10, -5, XMOD, -5, CTL);
    software(F, modulo(F, lz, -5), lz, ctx);
  },
  // transmisor del controlador de limpieza (en campo): lazo al controlador y retransmisión 4-20 mA al PLC
  aitcl(F, lz, ctx){
    equipo(F, "d_tx", lz, ctx, { d1:"+", d2:"-", d3:"GND" });
    const T = apilar([{ tb:lz.tcl, n:"AI+" }, { tb:lz.tcl, n:"AI-" }, { tb:lz.tcl, n:"SH" }].concat(lz.m ? [{ tb:lz.tcl, n:"AO+" }, { tb:lz.tcl, n:"AO-" }] : []), 0);
    bornes(F, T, XTCL);
    F.t(XTCL+5, T[T.length-1].y-4.5, 2.5, "CONTROLADOR DE\nLIMPIEZA", { ha:1, va:3 });
    cable(F, { capa:ANA, xd:XD3, xl:XTCL, origen:[{ y:0, c:"P1+" }, { y:-5, c:"P1-" }], llegada:[{ y:0, c:"P1+" }, { y:-5, c:"P1-" }], par:true, sh:{ y:-10 },
      tag:cableTag(ctx, lz.tagInst, "J01"), spec:"1-1Pr#16AWG+SH", xt:(XD3+22 + XTCL-32)/2 });
    if(!lz.m) return;
    const yr = T[3].y, [a, b] = lz.bornes;
    const S = apilar([{ tb:a.tb, n:a.n }, { tb:b.tb, n:b.n }, { tb:a.tb, n:"SH" }], yr);
    bornes(F, S);
    cable(F, { capa:ANA, xd:XTCL+10, origen:[{ y:yr, c:"P1+" }, { y:yr-5, c:"P1-" }], llegada:[{ y:yr, c:"P1+" }, { y:yr-5, c:"P1-" }], par:true, sh:{ y:yr-10 },
      tag:cableTag(ctx, lz.s.tag, "J01"), spec:"1-1Pr#16AWG+SH", xt:(XTCL+32 + XB-32)/2 });
    for(const x of S) F.l(XB+10, x.y, XMOD, x.y, ANA);
    software(F, modulo(F, lz, yr), lz, ctx);
  },
  // válvula solenoide del controlador de limpieza (en campo, sin canal del PLC)
  dotcl(F, lz, ctx){
    equipo(F, "d_tx", lz, ctx, { d1:"1", d2:"2", d3:"GND" });
    const T = apilar([{ tb:lz.tcl, n:`OUT${lz.k}`, c:"1" }, { tb:lz.tcl, n:"N", c:"2" }, { tb:lz.tcl, n:"PE", c:"GND" }], 0);
    bornes(F, T, XTCL);
    F.t(XTCL+5, T[2].y-4.5, 2.5, "CONTROLADOR DE\nLIMPIEZA", { ha:1, va:3 });
    cable(F, { capa:CTL, xd:XD3, xl:XTCL, origen:[{ y:0, c:"1" }, { y:-5, c:"2" }, { y:-10, c:"GND" }], llegada:T.map(x=>({ y:x.y, c:x.c })),
      tag:cableTag(ctx, lz.tagInst, "C01"), spec:"1-2C#14AWG+T", xt:(XD3+22 + XTCL-17)/2 });
  },
};

/* ---------- lazos de un tablero de control, en el orden de los módulos (slot / canal) ---------- */
function lazosTablero(p, t, eq, inst){
  const out = [], plc = eq.plc, lim = eq.limpieza, tcl = lim ? lim.tag : "";
  const diDC = m => /vdc|24\s*v/i.test(((infoModulo(m.modelo)||{}).senal) || "") || (!infoModulo(m.modelo) && /24/.test(t.ioDiscreto||""));
  const retrans = new Map((lim ? lim.senales : []).filter(s=>s.tipo==="AI").map(s=>[s.tag.replace(/^PD(I)?T/, "PDIC"), s]));
  let nCR = eq.reles.length;
  const usadosTCL = new Set();
  for(const m of [...plc.modulos].sort((a, b)=>a.slot - b.slot)) for(const s of m.senales){
    if(s.origen==="reserva" || !s.tag || s.tag==="-") continue;
    let i = inst.get(s.tag), tagInst = s.tag, tipo = null;
    const src = retrans.get(s.tag);
    if(!i && src && inst.get(src.tag)){ i = inst.get(src.tag); tagInst = src.tag; tipo = "aitcl"; usadosTCL.add(src.tag); }
    if(!i) continue;                                         // señales de motores y del tablero: no son lazos de instrumentos
    const b = bornesIO(s.terminales);
    const bornesC = b.length >= 2 ? b : [{ tb:m.tb, n:String(2*s.ch+1) }, { tb:m.tb, n:String(2*s.ch+2) }];
    const circ = s.alimentacionDe ? eq.circuitos.find(c=>c.tag===s.alimentacionDe) : null;
    const lz = { t, m, s, i, tagInst, bornes:bornesC, circ, tcl, diDC: diDC(m) };
    if(!tipo){
      if(m.tipo==="AI") tipo = (s.fusible || /loop/i.test(i.alimentacion||"")) ? "ai2h" : "ai4h";
      else if(m.tipo==="AO") tipo = "ao";
      else if(m.tipo==="DO") tipo = "do";
      else tipo = /24\s*V/i.test(i.alimentacion||"") ? "di24" : (circ && borneCirc(circ) && /120|220/.test(i.alimentacion||"")) ? "di120" : "dc";
    }
    lz.tipo = tipo;
    lz.conexion = tipo==="ai2h" ? "2h" : tipo==="ai4h" ? "4h" : "";
    // relé de interfaz: el de equiposControl (salidas digitales); el de un sensor de 24 Vdc en un módulo de 120 Vac sigue la numeración
    if(tipo==="do"){ const r = eq.reles.find(r=>r.modulo===m.tag && r.ch===s.ch); lz.rele = r ? r.tag : "CR"; lz.bobina = r ? r.bobina : ""; }
    if(tipo==="di24" && !lz.diDC){ const r = eq.reles.find(r=>r.senal && r.senal.tag===s.tag && r.senal.senal===s.senal); lz.rele = r ? r.tag : "CR"+(++nCR); }
    const L = tipoInstrumento(tagInst), num = tagInst.replace(/^[A-Z]+/, "");
    lz.fn = (m.tipo==="AI" ? funcionISA(tagInst, "AI") : m.tipo==="DI" ? funcionISA(tagInst, "DI") : m.tipo==="DO" ? L.replace(/V$/, "Y") : L.charAt(0)+"C") + num;
    lz.serv = i.servicio || s.descripcion || i.descripcion || "";
    out.push(lz);
  }
  // lazos del controlador de limpieza sin canal del PLC (válvulas solenoides y transmisores sin retransmisión)
  let k = 0;
  for(const s of lim ? lim.senales : []){
    if(s.tipo==="DO") k++;
    const i = inst.get(s.tag); if(!i || usadosTCL.has(s.tag) || !/^(AI|DO)$/.test(s.tipo)) continue;
    out.push({ t, s, i, tagInst:s.tag, tcl, k, tipo: s.tipo==="DO" ? "dotcl" : "aitcl", m:null });
  }
  return out;
}

/* ---------- caja (y) de una fila para repartirlas en la altura ---------- */
function cajaTexto(x, y, h, txt, ha=0, va=0){
  const filas = String(txt).split("\n"), w = Math.max(...filas.map(f=>f.length))*h*0.62, extra = (filas.length-1)*h*1.6667;
  const x0 = x - [0, w/2, w][ha||0], y0 = y + ({ 2:-h/2, 3:-h }[va] || 0) - extra;
  return [x0, y0, x0 + w, y0 + h + extra];
}
function cajaFila(F, kit){
  let y0 = Infinity, y1 = -Infinity;
  const ext = b => { y0 = Math.min(y0, b[1]); y1 = Math.max(y1, b[3]); };
  for(const op of F.ops){
    if(op.k==="l"){ ext([0, Math.min(op.y1, op.y2), 0, Math.max(op.y1, op.y2)]); }
    else if(op.k==="a" || op.k==="el") ext([0, op.y-(op.ry||op.r), 0, op.y+(op.ry||op.r)]);
    else if(op.k==="t") ext(cajaTexto(op.x, op.y, op.h, op.txt, op.o.ha, op.o.va));
    else if(op.k==="pz"){
      for(const e of (kit.piezas[op.n]||{ e:[] }).e){
        if(e[0]==="T"){ const t = String(e[8]).replace(/\{(\w+)\}/g, (m, k)=>op.o.vars[k]==null ? "x" : String(op.o.vars[k])); if(t.trim()) ext(cajaTexto(0, op.y+e[5], e[6], t, e[9], e[10])); }
        else if(e[0]==="L") ext([0, op.y+Math.min(e[5], e[7]), 0, op.y+Math.max(e[5], e[7])]);
        else if(e[0]==="C" || e[0]==="A") ext([0, op.y+e[5]-e[6], 0, op.y+e[5]+e[6]]);
        else if(e[0]==="P"){ const ys = e[5].filter((_, i)=>i%2); ext([0, op.y+Math.min(...ys), 0, op.y+Math.max(...ys)]); }
        else if(e[0]==="S"){ const ys = [e[5], e[7], e[9], e[11]]; ext([0, op.y+Math.min(...ys), 0, op.y+Math.max(...ys)]); }
      }
    }
  }
  return { top:y1, bot:y0 };
}

/* reparte las filas en el menor número de láminas, lo más parejas posible */
function paginar(filas, util){
  const alto = fs => fs.reduce((a, f)=>a + f.top - f.bot, 0) + GMIN*Math.max(0, fs.length-1);
  const llenar = cap => { const hojas = [[]]; for(const f of filas){ const h = hojas[hojas.length-1]; if(h.length && alto([...h, f]) > cap) hojas.push([f]); else h.push(f); } return hojas; };
  if(!filas.length) return [[]];
  const n = llenar(util).length;
  let lo = Math.max(...filas.map(f=>f.top - f.bot)), hi = util;
  for(let it=0; it<30 && hi - lo > 0.5; it++){ const mid = (lo + hi)/2; if(llenar(mid).length <= n) hi = mid; else lo = mid; }
  return llenar(hi);
}

/* notas de la plantilla (o las del usuario) abajo a la izquierda, junto a la leyenda; devuelve la altura que ocupan */
function notasOps(lista){
  for(const h of [2.5, 2.2, 2.0, 1.8]){
    const n = Math.min(Math.round(275/h), Math.floor(280/(h*0.62))), ls = h*1.6667;
    const lineas = ["NOTAS :"].concat(lista.flatMap((t, i)=>envolver(`${i+1}. ${t}`, n).map((l, k)=>k ? "    "+l : l)));
    const alto = (lineas.length-1)*ls + h;
    if(alto <= 60 || h===1.8) return { h, ls, lineas, top: Math.max(37.01, 6 + alto) };
  }
}

export async function lazoKit({ p, valsDe, cliente, id }){
  const kit = await cargarKit("lazo");
  // los MTEXT de la plantilla usan el estilo ROMANS-SP (factor de ancho 0,75): se conserva en los textos de las piezas
  for(const pz of Object.values(kit.piezas)) for(const e of pz.e) if(e[0]==="T" && e[1]===TX && (e[11]||1)===1) e[11] = WF;
  const doc = new DXFDoc(); usarKit(doc, kit);
  const d = datos(p), st = sistemaTag(p);
  const inst = new Map(); for(const i of instrumentos(p)) for(const tg of expandirTag(i.tag, i.cant)) if(tg) inst.set(tg, i);
  const alarmas = new Map();
  try{ for(const a of filosofiaDe(p).tablas.alarmas || []) if(/^(HH|H|L|LL)$/.test(a.tipo||"")){ if(!alarmas.has(a.instrumento)) alarmas.set(a.instrumento, new Set()); alarmas.get(a.instrumento).add(a.tipo); } }catch(e){}
  const notasU = (d.notas||{})[id || "ins-lazo"] || [];
  const N = notasOps(notasU.length ? notasU : NOTA_DEF);
  const yBot = Math.max(Y_BOT_MIN, N.top + 8), util = Y_TOP - yBot;
  // filas de cada tablero de control (cada tablero empieza en una lámina nueva)
  const lista = tablerosControl(p).length ? tablerosControl(p) : [tc(p)];
  const planes = [];
  let total = 0;
  for(const t of lista){
    let eq = null; try{ eq = equiposControl(p, t); }catch(e){ eq = null; }
    const ctx = { sis: sinGuion(st), alarmas, vac: eq && eq.vEst ? eq.vEst : "120 Vac", vdi: "", vdo: "", t, eq };
    ctx.vdi = /24/.test(t.ioDiscreto||"") ? "24 Vdc" : ctx.vac; ctx.vdo = ctx.vac;
    const lzs = eq ? lazosTablero(p, t, eq, inst) : [];
    const filas = [];
    for(const lz of lzs){ const F = new Fila(lz); try{ FILAS[lz.tipo](F, lz, ctx); }catch(e){ console.warn("Diagrama de lazo: no se pudo dibujar", lz.tagInst, e); continue; } Object.assign(F, cajaFila(F, kit)); filas.push(F); }
    const hojas = paginar(filas, util);
    planes.push({ t, eq, ctx, hojas });
    total += hojas.length;
  }
  let k = 0, nLazos = 0;
  for(const pl of planes){
    pl.hojas.forEach((filas, ih)=>{
      const nombre = `${may(pl.t.nombre||"Tablero de control")} ${pl.t.tag||""}`.trim();
      const A = dibujarLamina(doc, k*PASO_HOJAS, 0, valsDe(k, total, { TITULO2: nombre + (pl.hojas.length > 1 ? ` (${ih+1} DE ${pl.hojas.length})` : "") }), cliente);
      dibujarHoja(doc, kit, A, pl, filas, N, yBot);
      nLazos += filas.length; k++;
    });
  }
  return { dxf: doc.toDXF(), hojas: total, lazos: nLazos };
}

/* ---------- una lámina ---------- */
function dibujarHoja(doc, kit, A, pl, filas, N, yBot){
  const s = Math.min(1, (A.x1 - A.x0)/W, (A.y1 - A.y0)/H), X0 = A.x0, Y0 = A.y0;
  const X = v => X0 + v*s, Y = v => Y0 + v*s;
  // lo reservado al rótulo (esquina inferior derecha): la columna del software termina sobre él
  const r = A.reservado, yRes = r && X(XC2) < r.x1 && X(W) > r.x0 ? Math.max(0, (r.y1 - Y0)/s + 0.5) : 0;
  const sis = pl.ctx.sis;
  pieza(doc, kit, "encabezado", X(0), Y(0), { s, vars:{ sis, tc: pl.t.tag||"" }, texto:t=>t==="CAMPO - {sis}" && !sis ? "CAMPO" : t });
  doc.line(X(XC1), Y(YCAB), X(XC1), Y(0), "0"); doc.line(X(XC2), Y(YCAB), X(XC2), Y(yRes), "0");
  if(yRes > 0) doc.line(X(XC2), Y(yRes), X(W), Y(yRes), "0");
  pieza(doc, kit, "leyenda", X(0), Y(0), { s, vars:{ vac: pl.ctx.vac || "120 Vac" } });
  N.lineas.forEach((l, i)=>doc.text(X(40), Y(N.top - i*N.ls), N.h*s, l, "G-TEXT", { valign:3, wf:WF }));
  // barra de la CPU (si hay lazos al PLC en la lámina)
  if(filas.some(f=>f.lz.m)){
    const cpu = (pl.eq && pl.eq.plc.cpu.modelo) || "PLC", w = ancho(cpu, 2.5);
    doc.polyline([[X(XCPU[0]), Y(YCPU[0])], [X(XCPU[1]), Y(YCPU[0])], [X(XCPU[1]), Y(YCPU[1])], [X(XCPU[0]), Y(YCPU[1])], [X(XCPU[0]), Y(YCPU[0])]], "I-EQ");
    pieza(doc, kit, "cpu", X(0), Y(0), { s, vars:{ cpu: w <= 23 ? cpu : "" } });
    if(w > 23) doc.text(X((XCPU[0] + XCPU[1])/2), Y(500.5), 2.5*23/w*s, cpu, TX, { halign:1, valign:2, wf:WF });
  }
  // filas repartidas de forma pareja en la altura útil y centradas
  if(!filas.length) return;
  const util = Y_TOP - yBot, suma = filas.reduce((a, f)=>a + f.top - f.bot, 0);
  const g = filas.length > 1 ? Math.max(0, Math.min(GMAX, (util - suma)/(filas.length + 1))) : 0;
  let cur = Y_TOP - (util - suma - g*(filas.length-1))/2;
  for(const F of filas){
    const y0 = cur - F.top;
    dibujarFila(doc, kit, F, X, v=>Y(y0 + v), s);
    cur = y0 + F.bot - g;
  }
}
function dibujarFila(doc, kit, F, X, Y, s){
  for(const op of F.ops){
    if(op.k==="pz") pieza(doc, kit, op.n, X(op.x), Y(op.y), Object.assign({ s }, op.o));
    else if(op.k==="l") doc.line(X(op.x1), Y(op.y1), X(op.x2), Y(op.y2), op.capa);
    else if(op.k==="a") doc.arc(X(op.x), Y(op.y), op.r*s, op.a1, op.a2, op.capa);
    else if(op.k==="el"){ const pts = []; for(let i=0;i<=32;i++){ const a = i/32*2*Math.PI; pts.push([X(op.x + op.rx*Math.cos(a)), Y(op.y + op.ry*Math.sin(a))]); } doc.polyline(pts, op.capa); }
    else if(op.k==="t") String(op.txt).split("\n").forEach((l, i)=>doc.text(X(op.x), Y(op.y - i*op.h*1.6667), op.h*s, l, op.o.capa, { halign:op.o.ha||0, valign:op.o.va||0, wf:op.o.wf }));
  }
}

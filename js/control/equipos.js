/* Ingenia — EQUIPOS DEL TABLERO DE CONTROL: una sola lista con los TAG, modelos y valores de cada equipo.
   La usan el diagrama unifilar, el multifilar (conexionado de E/S), el plano mecánico (2D y 3D), los diagramas
   de lazo y la arquitectura de control, para que todos los entregables nombren igual cada equipo y cambien
   juntos cuando se agrega o se quita un instrumento, una carga o un circuito.
   Criterio del plano de referencia del usuario (unifilar y multifilar de control):
   · acometida estabilizada (120 Vac, TB1 → MCB1) y acometida auxiliar desde el tablero de fuerza (220 Vac, TB2 →
     MCB2 con supresor de sobretensiones);
   · fuente de 24 Vdc (CB1 → PS1 → CB2) con una derivación por fusible-borne (F1…Fn en la bornera XF1);
   · distribución de 120 Vac por CB3 con un ITM 2x2 A por circuito (CB4…) y bornera TB3;
   · servicios del tablero en 220 Vac (ventilación, luminaria y tomacorriente con diferencial de 30 mA);
   · PLC con su CPU en el slot 0 y los módulos de E/S por tipo (AI, AO, DO, DI), relés de interfaz CRn para las
     salidas digitales y una bornera por módulo (TB = slot + desplazamiento, como el listado I/O). */
import { datos, tablerosControl, tablerosPotencia, tableroPorId, circuitosControl, desdeTxt, esFuerza, tc as tcPrincipal } from "../datos.js";
import { valoresDiseno, tensionEstabilizada } from "../modules/criterios.js";
import { procesarFilas } from "../modules/tablas.js";

/* ---------- familias de PLC (modelos de catálogo por tipo de módulo) ---------- */
export const PLC_FAMILIAS = {
  ab5380: { nombre:"Allen-Bradley CompactLogix 5380", marca:"Allen-Bradley", cpu:"5069-L320ER", fpd:"5069-FPD", tapa:"5069-ECR",
    mod:{ AI:{ 8:"5069-IF8", 16:"5069-IF16" }, AO:{ 4:"5069-OF4", 8:"5069-OF8" }, DI:{ "120 Vac":{ 16:"5069-IA16" }, "24 Vdc":{ 16:"5069-IB16", 32:"5069-IB16K" } }, DO:{ 16:"5069-OW16", 8:"5069-OX4I" } },
    hmi:"PanelView Plus 7 2711P-T7C22D9P", switch:"Stratix 1783-CMS10DP", red:"Ethernet/IP" },
  s71500: { nombre:"Siemens SIMATIC S7-1500", marca:"Siemens", cpu:"6ES7 515-2AM02-0AB0", fpd:"", tapa:"",
    mod:{ AI:{ 8:"6ES7 531-7KF00-0AB0" }, AO:{ 4:"6ES7 532-5HD00-0AB0", 8:"6ES7 532-5HF00-0AB0" }, DI:{ "120 Vac":{ 16:"6ES7 521-1FH00-0AA0" }, "24 Vdc":{ 16:"6ES7 521-1BH00-0AB0", 32:"6ES7 521-1BL00-0AB0" } }, DO:{ 8:"6ES7 522-5HF00-0AB0", 16:"6ES7 522-1BH01-0AB0" } },
    hmi:"SIMATIC HMI TP700 Comfort", switch:"SCALANCE XB208", red:"PROFINET" },
};
export function familiaPlc(t){
  const txt = `${t.marcaPlc||""} ${t.plc||""} ${t.modeloPlc||""}`;
  return /siemens|s7|simatic|6es7/i.test(txt) ? PLC_FAMILIAS.s71500 : PLC_FAMILIAS.ab5380;
}
const NOMBRE_MOD = { AI:"Módulo de entradas analógicas", AO:"Módulo de salidas analógicas", DI:"Módulo de entradas digitales", DO:"Módulo de salidas digitales (relé)" };
function modeloModulo(fam, tipo, canales, tension){
  const m = fam.mod[tipo] || {};
  const tabla = tipo==="DI" ? (m[/24/.test(tension||"") ? "24 Vdc" : "120 Vac"] || {}) : m;
  return tabla[canales] || "";
}

/* ---------- utilidades ---------- */
const mcbModelo = (polos, a) => `S20${polos}-C${a}`;
const cablePara = a => a > 15 ? "2C#12AWG+12AWG(T)" : "2C#14AWG+14AWG(T)";
/* corriente del ITM principal según la potencia (W) que alimenta: 125 % de la corriente, escalón normalizado */
const ESCALONES = [2, 4, 6, 10, 16, 20, 25, 32, 40, 50, 63];
const itmPara = (w, v, min=6) => ESCALONES.find(a=>a >= Math.max(min, 1.25*w/(v||120))) || 63;
/* fuente de 24 Vdc normalizada según la carga de 24 Vdc */
const FUENTES = [[60,"1606-XLE60E",2.5],[120,"1606-XLE120E",5],[240,"1606-XLB240E",10],[480,"1606-XLE480EP",20]];
const W24 = [[/reserva/i,0],[/plc|cpu|controlador/i,40],[/anal[oó]gic/i,20],[/hmi|pantalla/i,30],[/switch/i,15],[/router/i,12],[/./,3]];

/* ---------- lista de equipos del tablero de control ---------- */
export function equiposControl(p, t){
  t = t || tcPrincipal(p);
  const d = datos(p), v = valoresDiseno(p);
  const fam = familiaPlc(t);
  const vEst = tensionEstabilizada(v);                       // 120 Vac (barra estabilizada)
  const circs = circuitosControl(p, t).map(c=>Object.assign({}, c));
  const c24 = circs.filter(c=>c.barra==="24 Vdc"), c120 = circs.filter(c=>c.barra==="120 Vac"), c220 = circs.filter(c=>c.barra==="220 Vac");
  const fuenteC = c120.find(c=>/fuente/i.test(c.descripcion||""));
  const dist120 = c120.filter(c=>c!==fuenteC);

  // --- acometidas
  const up = t.desde ? tableroPorId(p, t.desde) : null;
  const fuerza = up && esFuerza(up) ? up : tablerosPotencia(p).find(esFuerza) || null;
  const w120 = dist120.reduce((a, c)=>a + (+c.potencia||0), 0) + (fuenteC ? (+fuenteC.potencia||240) : 0);
  const w220 = c220.reduce((a, c)=>a + (+c.potencia||0), 0);
  const conAux = c220.length > 0 && t.alimAux!=="no";
  const acometidas = [{
    id:"est", tb:"TB1", tension:vEst, fases:"1F+N+T", desde: t.desde120 || (t.desdeTexto && !up ? t.desdeTexto : desdeTxt(p, t)), circuito: t.circuito120 || "",
    q:{ tag:"MCB1", tipo:"mcb", polos:2, in:itmPara(w120, 120, 16), desc:`Interruptor general de ${vEst}` }, cable:"2C#12AWG+12AWG(T)",
  }];
  if(conAux) acometidas.push({
    id:"aux", tb:"TB2", tension:"220 Vac", fases:"2F+T", desde: fuerza ? `${fuerza.nombre||"Tablero de fuerza"} ${fuerza.tag}` : "Tablero de fuerza", circuito: t.circuito220 || "",
    q:{ tag:"MCB2", tipo:"mcb", polos:2, in:itmPara(w220, 220, 10), desc:"Interruptor general de 220 Vac (servicios del tablero)" }, cable:"2C#12AWG+12AWG(T)",
  });
  acometidas.forEach(a=>{ a.q.modelo = mcbModelo(2, a.q.in); a.q.val = `2x${a.q.in}A`; });

  // --- fuente de 24 Vdc
  // consumo típico por derivación de 24 Vdc (W) y 50 % de margen para elegir la fuente
  const w24 = c24.reduce((a, c)=>a + (+c.potencia || W24.find(([re])=>re.test(c.descripcion||""))?.[1] || 0), 0);
  const fu = FUENTES.find(f=>f[0] >= Math.max(60, w24*1.5)) || FUENTES[FUENTES.length-1];
  let nCB = 0; const cbTag = () => "CB" + (++nCB);
  const fuente = c24.length || fuenteC ? {
    cb:{ tag:cbTag(), tipo:"mcb", polos:2, in: fuenteC ? (+fuenteC.proteccion||10) : 10, desc:"Interruptor de la fuente de 24 Vdc" },
    ps:{ tag:"PS1", tipo:"fuente", modelo:fu[1], w:fu[0], a:fu[2], desc:`Fuente de alimentación ${vEst} / 24 Vdc, ${fu[2]} A` },
    cbOut:{ tag:cbTag(), tipo:"mcb", polos:2, in: fu[2] > 6 ? 6 : 4, desc:"Interruptor de salida de 24 Vdc" },
    circuito: fuenteC ? fuenteC.circuito : "C1",
  } : null;
  if(fuente){ for(const k of ["cb","cbOut"]){ fuente[k].modelo = mcbModelo(2, fuente[k].in); fuente[k].val = `2x${fuente[k].in}A`; } fuente.ps.val = `${fuente.ps.a}A`; }
  const cb120 = dist120.length ? { tag:cbTag(), tipo:"mcb", polos:2, in: itmPara(dist120.reduce((a, c)=>a + (+c.potencia||8), 0), 120, 10), desc:`Interruptor de la distribución de ${vEst}` } : null;
  if(cb120){ cb120.modelo = mcbModelo(2, cb120.in); cb120.val = `2x${cb120.in}A`; }

  // --- circuitos derivados (en el orden del unifilar): 24 Vdc con fusible-borne, 120 Vac y 220 Vac con ITM 2P
  const circuitos = [];
  c24.forEach((c, i)=>circuitos.push({ barra:"24 Vdc", circuito:"C"+(i+1), tag:"F"+(i+1), tipo:"fusible", polos:1, in:+c.proteccion||1, val:`${+c.proteccion||1}A`,
    modelo:"UT 4-HESI (5x20) + fusible 5x20", borne:`XF1.${i+1}`, descripcion:c.descripcion, cable:"2C#14AWG+14AWG(T)", potencia:+c.potencia||0, reserva:/^reserva$/i.test(c.descripcion||"") }));
  dist120.forEach((c, i)=>{ const a = +c.proteccion||2; circuitos.push({ barra:"120 Vac", circuito:"C"+(i+1), tag:cbTag(), tipo:"mcb", polos:2, in:a, val:`2x${a}A`, modelo:mcbModelo(2, a),
    borne:`TB3.${2*i+1}/${2*i+2}`, descripcion:c.descripcion, cable:c.cable || cablePara(a), potencia:+c.potencia||0, reserva:/^reserva$/i.test(c.descripcion||"") }); });
  let nID = 0;
  c220.forEach((c, i)=>{ const a = +c.proteccion||4; const o = { barra: conAux ? "220 Vac" : vEst, circuito:"C"+(i+1), tag:cbTag(), tipo:"mcb", polos:2, in:a, val:`2x${a}A`, modelo:mcbModelo(2, a),
    borne:`TB4.${2*i+1}/${2*i+2}`, descripcion:c.descripcion, cable:c.cable || cablePara(a), potencia:+c.potencia||0, reserva:/^reserva$/i.test(c.descripcion||"") };
    if(c.diferencial){ o.id = { tag:"ID"+(++nID), tipo:"diferencial", polos:2, in:25, sens:"30mA", modelo:"FH202 AC-25/0.03", val:"2x25A 30mA" }; }
    if(/ventila/i.test(c.descripcion||"")) o.extra = { termostato:"TH1", ventiladores:["V1","V2"] };
    if(/luminaria/i.test(c.descripcion||"")) o.extra = { interruptorPuerta:"SQ1", luminaria:"LM1" };
    if(/tomacorriente/i.test(c.descripcion||"")) o.extra = { tomacorriente:"TC1" };
    circuitos.push(o); });
  // cargas fuera del tablero (instrumentos de campo, controlador de limpieza): en el unifilar quedan fuera de la envolvente
  const INTERNA = /plc|cpu|hmi|router|switch|entradas|salidas|fuente|ventilaci|luminaria|tomacorriente|m[oó]dulo/i;
  for(const c of circuitos) c.campo = !c.reserva && !INTERNA.test(c.descripcion||"");
  // supresor de sobretensiones de la acometida auxiliar (o de la estabilizada si no hay auxiliar)
  const spd = { cb:{ tag:cbTag(), tipo:"mcb", polos:2, in:20, modelo:mcbModelo(2, 20), val:"2x20A", desc:"Interruptor del supresor de sobretensiones" }, tags:["SPD1","SPD2"], modelo:"OVR T2 40-275 P QS", tipo:"TIPO 2", acometida: conAux ? "aux" : "est" };

  // --- PLC: módulos por slot desde el listado I/O (mismos slot, canal y bornes)
  const io = procesarFilas("ins-io", d["ins-io"]||[], p);
  const propias = io.filter(f=>f.tablero===t.tag && f.slot!=="" && f.slot!=null);
  const porSlot = new Map();
  for(const f of propias){ if(!porSlot.has(f.slot)) porSlot.set(f.slot, []); porSlot.get(f.slot).push(f); }
  const cont = { AI:0, AO:0, DI:0, DO:0 };
  const modulos = [...porSlot.entries()].sort((a, b)=>a[0]-b[0]).map(([slot, filas])=>{
    const tipo = filas[0].tipo, canales = (t.canales||{})[tipo] || 16;
    const tag = tipo + (++cont[tipo]);
    const tb = "TB" + (slot + (+t.tbOffset||0));
    return { tag, tipo, slot, canales, modelo: modeloModulo(fam, tipo, canales, t.ioDiscreto), desc:`${NOMBRE_MOD[tipo]||"Módulo"} ${canales} canales`, tb,
      senales: Array.from({ length:canales }, (_, ch)=>filas.find(f=>+f.ch===ch) || { tag:"-", senal:tipo+"_RESERVA", descripcion:"Reserva", tipo, ch, slot, origen:"reserva", terminales:`${tb}:${2*ch+1} / ${tb}:${2*ch+2}` }) };
  });
  const plc = { cpu:{ tag:"PLC", tipo:"cpu", slot:0, modelo: t.modeloPlc || fam.cpu, desc: t.plc || "Controlador lógico programable (PLC)", familia:fam.nombre },
    modulos, fpd: fam.fpd ? { tag:"CN1", tipo:"fpd", modelo:fam.fpd, desc:"Separador / distribuidor de potencial" } : null, tapa: fam.tapa ? { tag:"TAP", tipo:"tapa", modelo:fam.tapa, desc:"Tapa terminadora" } : null, red:fam.red };
  // limpieza: señales del controlador auxiliar (sin slot del PLC)
  const limpieza = t.controladorLimpieza ? { tag:t.tagLimpieza||"TCL-001", tipo:"controlador", desc:"Controlador de limpieza secuencial (pulsos de aire)", senales: io.filter(f=>f.tablero===(t.tagLimpieza||"TCL-001")) } : null;

  // --- red de control
  const red = [];
  if(t.switch) red.push({ tag:"SW1", tipo:"switch", modelo:fam.switch, desc:"Switch Ethernet administrable" });
  if(t.hmi) red.push({ tag:"HMI1", tipo:"hmi", modelo:fam.hmi, desc:"Pantalla de operación HMI (en la puerta)" });
  if(t.router) red.push({ tag:"RUT1", tipo:"router", modelo:"Teltonika RUT956", desc:"Router IIoT 4G / VPN" });

  // --- relés de interfaz de las salidas digitales (uno por canal, reservas incluidas)
  const reles = [];
  for(const m of modulos.filter(m=>m.tipo==="DO")) for(const s of m.senales){
    reles.push({ tag:"CR"+(reles.length+1), tipo:"rele", modelo:"Relé de interfaz 1NA/NC con base (bobina "+(t.ioDiscreto==="24 Vdc" ? "24 Vdc" : "120 Vac")+")", modulo:m.tag, slot:m.slot, ch:s.ch, senal:s, reserva:s.origen==="reserva",
      bobina: t.ioDiscreto==="24 Vdc" ? "24 Vdc" : "120 Vac", contacto:"11-14", desc:s.origen==="reserva" ? "Reserva" : s.descripcion });
  }

  // --- borneras (mismo TAG en multifilar, mecánico y lazos)
  const borneras = [];
  for(const a of acometidas) borneras.push({ tag:a.tb, desc:`Acometida ${a.tension}`, bornes:[{ n:"1", fun:"L", modelo:"UT 16" }, { n:"2", fun:"N", modelo:"UT 16" }, { n:"PE", fun:"PE", modelo:"UT 16-PE", pe:true }] });
  const b120 = circuitos.filter(c=>c.barra==="120 Vac"), b220 = circuitos.filter(c=>c.barra!=="120 Vac" && c.barra!=="24 Vdc");
  if(b120.length) borneras.push({ tag:"TB3", desc:`Salidas de ${vEst}`, bornes: b120.flatMap((c, i)=>[{ n:String(2*i+1), fun:"L", modelo:"UT 4", ref:c.tag }, { n:String(2*i+2), fun:"N", modelo:"UT 4", ref:c.tag }]).concat([{ n:"PE", fun:"PE", modelo:"UT 4-PE", pe:true }]) });
  if(b220.length) borneras.push({ tag:"TB4", desc:"Salidas de servicios del tablero (220 Vac)", bornes: b220.flatMap((c, i)=>[{ n:String(2*i+1), fun:"L", modelo:"UT 4", ref:c.tag }, { n:String(2*i+2), fun:"N", modelo:"UT 4", ref:c.tag }]).concat([{ n:"PE", fun:"PE", modelo:"UT 4-PE", pe:true }]) });
  const f24 = circuitos.filter(c=>c.barra==="24 Vdc");
  if(f24.length) borneras.push({ tag:"XF1", desc:"Fusibles-borne de 24 Vdc", bornes: f24.map((c, i)=>({ n:String(i+1), fun:"+24V", modelo:"UT 4-HESI", ref:c.tag })).concat([{ n:"0V", fun:"0V", modelo:"UT 4" }]) });
  for(const m of modulos){
    const ana = m.tipo==="AI" || m.tipo==="AO";
    borneras.push({ tag:m.tb, desc:`Señales de ${m.tag} (slot ${m.slot})`, modulo:m.tag, bornes: m.senales.flatMap(s=>[{ n:String(2*s.ch+1), fun: ana ? "+" : "L", modelo: ana ? "UT 4" : "PTTB 4", ref:s.tag }, { n:String(2*s.ch+2), fun: ana ? "-" : "N", modelo: ana ? "UT 4" : "PTTB 4", ref:s.tag }]).concat(ana ? [{ n:"SH", fun:"SH", modelo:"UT 4-PE", pe:true }] : []) });
  }

  return { tablero:t, v, familia:fam, vEst, acometidas, fuente, cb120, circuitos, spd, plc, limpieza, red, reles, borneras, io:propias };
}

/* todos los tableros de control del proyecto con sus equipos */
export function equiposProyecto(p){ return (tablerosControl(p).length ? tablerosControl(p) : [tcPrincipal(p)]).map(t=>equiposControl(p, t)); }

/* lista plana (TAG → equipo) para buscar un equipo por su TAG desde Copito o la vista 3D */
export function indiceEquipos(eq){
  const out = [];
  const add = (o, grupo) => { if(o && o.tag) out.push(Object.assign({ grupo }, o)); };
  eq.acometidas.forEach(a=>add(a.q, "acometida"));
  if(eq.fuente){ add(eq.fuente.cb, "fuente"); add(eq.fuente.ps, "fuente"); add(eq.fuente.cbOut, "fuente"); }
  add(eq.cb120, "distribucion");
  eq.circuitos.forEach(c=>{ add(c, c.barra); if(c.id) add(c.id, c.barra); });
  add(eq.spd.cb, "spd"); eq.spd.tags.forEach(tg=>add({ tag:tg, tipo:"spd", modelo:eq.spd.modelo }, "spd"));
  add(eq.plc.cpu, "plc"); eq.plc.modulos.forEach(m=>add(m, "plc")); add(eq.plc.fpd, "plc"); add(eq.plc.tapa, "plc");
  eq.red.forEach(r=>add(r, "red")); eq.reles.forEach(r=>add(r, "reles"));
  if(eq.limpieza) add(eq.limpieza, "limpieza");
  eq.borneras.forEach(b=>add(Object.assign({ tipo:"bornera" }, b), "borneras"));
  return out;
}

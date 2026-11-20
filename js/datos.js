/* Ingenia — modelo de datos del proyecto y derivaciones entre documentos.
   Un solo juego de datos alimenta todos los entregables: lo que se edita en un documento (p.ej. el listado de
   cargas o el de instrumentos) se refleja en los demás (cables, equipos, hojas de datos, memorias, I/O, lazos,
   unifilares…). Los tableros se definen al crear el proyecto (tipo, cantidad y TAG) y cada carga /
   instrumento se asigna a uno de ellos. */
import { computeCircuit, pickStep, BREAKER_STEPS, tempCorrFactor, buildMainConductorSpec, APPLICATIONS, egcFor, miguelezCableFor, configurarMotor, CABLE_TABLE } from "./engine/tablero-core.js";
import { valoresDiseno, tempDiseno, tensionControlTxt, controlEnDC } from "./modules/criterios.js";
import { save } from "./store.js";
import { marcasProyecto, modeloEnMarca } from "./engine/marcas.js";
import { FAMILIAS, MODULOS, familiaPorTexto } from "./control/plc-modulos.js";

export const uidc = (p="x") => p+"_"+Math.random().toString(36).slice(2,8);

/* ---------------- tableros ---------------- */
export const TIPOS_TABLERO = {
  distribucion: { nombre:"Tablero de distribución", pref:"TD" },
  fuerza: { nombre:"Tablero de fuerza", pref:"TF" },
  fuerzacontrol: { nombre:"Tablero de fuerza y control", pref:"TFC" },
  control: { nombre:"Tablero de control", pref:"TC" },
};
export const esFuerza = t => !!t && (t.tipo==="fuerza" || t.tipo==="fuerzacontrol");
export const esControl = t => !!t && (t.tipo==="control" || t.tipo==="fuerzacontrol");
export const esPotencia = t => !!t && t.tipo!=="control";

export function nuevoTablero(tipo, n){
  const T = TIPOS_TABLERO[tipo] || TIPOS_TABLERO.fuerza;
  const t = { id: uidc("TB"), tipo, tag: `${T.pref}-${String(n||1).padStart(3,"0")}`, nombre: T.nombre, desde:"", desdeTexto: tipo==="distribucion" ? "Subestación / alimentación existente" : "", marca:"", modelo:"", cableLength:30, cableTag:"" };
  if(tipo==="control" || tipo==="fuerzacontrol") Object.assign(t, { plc:"Controlador lógico programable (PLC)", modeloPlc:"", hmi:true, switch:true, router:false, controladorLimpieza:false, redExterna:"Red de control hacia DCS / sala de control" }, IO_DEF());
  return t;
}
/* configuración de E/S de un tablero de control (valores por defecto = práctica del formato de referencia) */
export const IO_DEF = () => ({ ioDiscreto:"120 Vac", vfdMando:"cableado", senalesTablero:true, repetidores:false, listarReservas:true, primerSlot:1, tbOffset:5, canales:{ AI:8, AO:8, DI:16, DO:16 }, tagLimpieza:"TCL-001", lucesPiloto:true });

const conDef = (o, def) => { o = o || {}; for(const k in def) if(!(k in o)) o[k] = def[k]; return o; };
/* ---------------- estructura base (con migración de proyectos anteriores) ---------------- */
export function datos(p){
  p.datos = p.datos || {};
  const d = p.datos;
  d.sistema = d.sistema || { nombre: "", tag: "" };
  if(!Array.isArray(d.tableros)){
    const tf = Object.assign(nuevoTablero("fuerza",1), d.tableroFuerza||{}, { tipo:"fuerza" });
    const tc = Object.assign(nuevoTablero("control",1), d.tableroControl||{}, { tipo:"control" });
    if(tf.desde && !tf.desdeTexto){ tf.desdeTexto = tf.desde; tf.desde = ""; }
    if(tc.desde && !tc.desdeTexto){ tc.desdeTexto = tc.desde; tc.desde = ""; }
    d.tableros = [tf, tc];
    delete d.tableroFuerza; delete d.tableroControl;
  }
  d.tableros.forEach(t=>{ if(t.tipo!=="control" && !t.accesorios) t.accesorios = ACC_DEF(); });
  d.tableros.forEach(t=>{ if(t.tipo==="control" || t.tipo==="fuerzacontrol"){ const def = IO_DEF(); for(const k in def) if(!(k in t)) t[k] = def[k]; } });
  d.cargas = d.cargas || [];
  d.cargasTrafo = Array.isArray(d.cargasTrafo) ? d.cargasTrafo : [];
  d["ins-instrumentos"] = d["ins-instrumentos"] || [];
  d["ins-io"] = d["ins-io"] || [];
  if(Array.isArray(d.circuitosControl)){ d.circuitosCtl = d.circuitosCtl || {}; const t0 = d.tableros.find(esControl); if(t0 && d.circuitosControl.length) d.circuitosCtl[t0.id] = d.circuitosControl; }
  delete d.circuitosControl;
  d.circuitosCtl = d.circuitosCtl || {};
  d.memoria = conDef(d.memoria, { kGroup:1, kh:1, canalizacion:"bandeja portacables y tubería conduit", cableRef:"" });
  d.cablesCfg = conDef(d.cablesCfg, { clase:"lszh", canalizacion:"otros", reserva:5 });
  d.pat = d.pat || {};
  d.hd = d.hd || {};
  d.hdEq = d.hdEq || {};
  d.notas = d.notas || {};
  d.proceso = conDef(d.proceso, { descripcion:"", equipos:[], referencia:null, recomendados:[] });
  d.filosofia = conDef(d.filosofia, { secuencias:"", notas:"" });
  d.equiposCfg = conDef(d.equiposCfg, { incluirEquipos:false });
  return d;
}
export function tableros(p){ return datos(p).tableros; }
export function tableroPorId(p, id){ return tableros(p).find(t=>t.id===id); }
export function tableroPorTag(p, tag){ return tableros(p).find(t=>t.tag===tag); }
export function tablerosPotencia(p){ return tableros(p).filter(esPotencia); }
export function tablerosControl(p){ return tableros(p).filter(esControl); }
/* tablero de fuerza / control "principal" (el primero de su tipo) */
export function tf(p){ return tableros(p).find(esFuerza) || tableros(p).find(esPotencia) || nuevoTablero("fuerza",1); }
export function tc(p){ return tableros(p).find(esControl) || Object.assign(nuevoTablero("control",1), { _virtual:true }); }
export function desdeTxt(p, t){
  const up = t && t.desde ? tableroPorId(p, t.desde) : null;
  if(up) return `${up.nombre} ${up.tag}`.trim();
  return (t && t.desdeTexto) || "Alimentación existente";
}
export function configIO(p, tag){ return tableros(p).find(t=>t.tag===tag && esControl(t)) || null; }
export function sistemaTag(p){ const d = datos(p); return d.sistema.tag || ""; }
export function sistemaNombre(p){ const d = datos(p); return d.sistema.nombre || ""; }

/* grado de protección recomendado del gabinete según condiciones ambientales (NEMA 250 / IEC 60529) */
export function ipRecomendado(v){
  if(v.gradoProteccion && !/^Autom/i.test(v.gradoProteccion)) return v.gradoProteccion;
  const amb = String(v.ambiente||""), con = String(v.contaminacion||""), area = String(v.areaClasificada||"");
  if(/Clase I\b/i.test(area) && !/Clase II/i.test(area)) return "NEMA 7 (a prueba de explosión)";
  if(/Clase II/i.test(area)) return "NEMA 9 (a prueba de ignición de polvo)";
  if(/corros|salin/i.test(con)) return "NEMA 4X (≈ IP66), acero inoxidable";
  if(/intemperie|exterior/i.test(amb) || /polvo/i.test(con) || /polvo/i.test(amb)) return "NEMA 4 (≈ IP66)";
  if(/sala/i.test(amb)) return "NEMA 12 (≈ IP52)";
  return "NEMA 12 (≈ IP52)";
}

/* ---------------- parámetros eléctricos (motor de cálculo) ---------------- */
export function parametrosG(p){
  const v = valoresDiseno(p), d = datos(p);
  return { voltage: +v.tension||460, freq: +v.frecuencia||60, ctrlVoltage: String(v.tensionControl||"120"), ctrlTipo: v.tensionControlTipo, faultLevel: +v.icc||25,
    altitude: +v.altitud||1000, ambientTemp: tempDiseno(v), fuseMult:1.75, vfdBrkMult:1.25, brkMult:2.5,
    maxVD: +v.caidaTension||2.5, kGroup: +d.memoria.kGroup||1,
    flaNorma: /IEC/.test(v.corrienteMotores||"") ? "IEC" : "NEC", metodoAmp: /^75/.test(v.columnaAmpacidad||"") ? "75" : "90", minMM2: ((CABLE_TABLE.find(r=>r[0]===v.seccionMinima)||[0,0])[1]) };
}
const FP_CIRC = c => c.kind==="motor" ? (+c.fp||0.85) : c.kind==="control" ? 0.88 : (+c.load.fp||0.85);
/* accesorios de un tablero de fuerza o distribución. PROTECCIÓN: supresor de sobretensiones (OVR / SPD), relé de
   monitoreo de fases y diferencial de 30 mA en el tomacorriente; ACCESORIOS: luminaria interna, tomacorriente, bloqueo
   del mando del general (lock out) y luces de energizado (presencia de fases). La ventilación y la calefacción se guardan
   en la configuración mecánica del tablero (auto / sí / no) para que el arreglo, el unifilar y el multifilar coincidan. */
export const ACC_DEF = () => ({ spd:true, releFase:true, diferencial:true, luces:true, luminaria:true, tomacorriente:true, lockout:true });
export const ACC_PROTECCION = [["spd","OVR / SPD","Supresor de sobretensiones tipo 1+2 en la acometida"],["releFase","Relé de fases","Relé de monitoreo de tensión: secuencia, falta y asimetría de fases"],["diferencial","Diferencial","Interruptor diferencial de 30 mA en el circuito de tomacorriente"]];
export const ACC_ACCESORIOS = [["luminaria","Luminaria interna"],["calefaccion","Calefacción"],["ventilacion","Ventilación"],["tomacorriente","Tomacorriente"],["lockout","Lock out"],["luces","Luces de energizado"]];
/* accesorios efectivos (con la ventilación y la calefacción resueltas): ventilación «auto» = forzada si el tablero tiene
   variadores o arrancadores suaves (el arreglo mecánico verifica el balance térmico y avisa si no alcanza) */
export function accesoriosTablero(p, t){
  const a = Object.assign(ACC_DEF(), (t && t.accesorios) || {});
  const m = (((datos(p).mecanico)||{})[t && t.id]) || {};
  a.calefaccion = calefaccionTablero(p, t);
  a.ventilacion = m.ventilacion==="forzada" ? true : m.ventilacion==="natural" ? false : cargasPropias(p, t).some(l=>l.kind==="motor" && (l.starter==="vfd" || l.starter==="ss"));
  // con transformadores definidos en el listado de cargas, los servicios del tablero son las cargas que el usuario les asignó
  // (luminaria, tomacorriente, ventiladores y calefacción como «Carga general»): ya no se eligen como accesorios
  const trafos = t ? cargasPropias(p, t).filter(l=>l.kind==="control") : [];
  if(trafos.length){
    const filas = (datos(p).cargasTrafo||[]).filter(r=>trafos.some(l=>l.id===r.trafo) && r.tipo==="general");
    const hay = ap => filas.some(r=>r.application===ap);
    a.luminaria = hay("luminaria"); a.tomacorriente = hay("tomacorriente");
    if(m.ventilacion!=="natural" && m.ventilacion!=="forzada") a.ventilacion = a.ventilacion || hay("ventiladores");
    if(!m.calefaccion || m.calefaccion==="auto") a.calefaccion = hay("calefaccion");
  }
  return a;
}
/* fusibles de la acometida de un tablero de fuerza, numerados en el orden en que aparecen: luces de fases (3), relé de
   fases (3) y transformador de la bobina de mínima tensión del general (2); siguen los del control interno */
export function fusiblesAcometida(acc){
  let n = 0; const sig = k => Array.from({ length:k }, ()=>"F"+(++n));
  const r = { luces: acc.luces ? sig(3) : [], rf: acc.releFase ? sig(3) : [], uvr: sig(2) };
  r.siguiente = () => "F"+(++n);
  return r;
}

/* ---------------- valores típicos de cargas ---------------- */
// Eficiencia nominal NEMA Premium, motor TEFC 4 polos 60 Hz (NEMA MG-1, Tabla 12-12)
const NEMA_PREMIUM_4P = [[1,85.5],[1.5,86.5],[2,86.5],[3,89.5],[5,89.5],[7.5,91.7],[10,91.7],[15,92.4],[20,93.0],[25,93.6],[30,93.6],[40,94.1],[50,94.5],[60,95.0],[75,95.4],[100,95.4],[125,95.4],[150,95.8],[200,96.2],[250,96.2],[300,96.2],[350,96.2],[400,96.2],[450,96.2],[500,96.2]];
// Factor de potencia a plena carga: valores orientativos de catálogo para motores de inducción 4 polos (verificar con placa)
const FP_TIPICO = [[1,0.72],[3,0.78],[7.5,0.82],[15,0.84],[40,0.85],[100,0.86],[250,0.87],[1e9,0.88]];
export const REGIMENES = [
  { v:"continuo", label:"Continuo", fu:1, fs:1 },
  { v:"intermitente", label:"Intermitente", fu:0.5, fs:1 },
  { v:"reserva", label:"Reserva (stand-by)", fu:0, fs:0 },
];
export function tipicosMotor(l){
  const hp = l.powerUnit==="hp" ? +l.power : (+l.power)/0.746;
  if(!(hp>0)) return null;
  let eff = NEMA_PREMIUM_4P[0][1]; for(const [h,e] of NEMA_PREMIUM_4P) if(hp >= h-1e-9) eff = e;
  const fp = (FP_TIPICO.find(([h])=>hp <= h+1e-9)||FP_TIPICO[FP_TIPICO.length-1])[1];
  const rg = REGIMENES.find(r=>r.v===(l.regimen||"continuo")) || REGIMENES[0];
  return { effPct: eff, fp, fu: rg.fu, fs: rg.fs };
}
/* aplica valores típicos a los campos que el usuario no fijó manualmente */
export function aplicarTipicos(l){
  l.man = l.man || {};
  if(l.kind==="motor"){ const t = tipicosMotor(l); if(t) for(const k of ["effPct","fp","fu","fs"]) if(!l.man[k]) l[k] = t[k]; }
  else { const rg = REGIMENES.find(r=>r.v===(l.regimen||"continuo")) || REGIMENES[0]; if(!l.man.fu) l.fu = rg.fu; if(!l.man.fs) l.fs = rg.fs; }
  return l;
}

/* ---------------- cargas ---------------- */
export function nuevaCarga(kind="motor", tablero=""){
  return aplicarTipicos({ id: uidc("L"), kind, tablero, tag:"", application:"otro", desc:"", power:10, powerUnit:"hp", starter: kind==="motor" ? "dol" : "na", vfdBrand:"abb", filtroVdf: kind==="motor" ? "ninguno" : "na", regimen:"continuo", man:{},
    fp:0.85, effPct:90, fu:1, fs:1, cableLength:30, feederAmps:30, cableTag:"", canalizacion:"",
    controlBranches:[{label:"Control (PLC / instrumentación)", breaker:10, va:150},{label:"Ventiladores internos", breaker:6, va:200},{label:"Calefacción interna", breaker:6, va:300},{label:"Luminaria interna", breaker:4, va:60}] });
}
/* ---------------- cargas de los transformadores ----------------
   Cada fila de d.cargasTrafo es una carga alimentada por el secundario de un transformador del listado de cargas
   (trafo = id de esa carga). Se suman a las derivaciones del transformador (con su ITM y su cable) y definen su potencia. */
export const TIPOS_CARGA_TRAFO = [["motor","Motor"],["general","Carga general"],["tablero","Tablero externo"],["control","Control interno"],["plc","PLC"],["instrumentacion","Instrumentación"],["reserva","Reserva"]];
/* aplicación por tipo de carga: la carga general toma los servicios del tablero; el control interno (mando de los
   arranques del tablero) y los demás tipos no llevan aplicación (N.A.) */
export const APLIC_CARGA_TRAFO = {
  general: [["ventiladores","Ventiladores"],["calefaccion","Calefacción"],["luminaria","Luminaria"],["tomacorriente","Tomacorriente"],["otro","Otro"]],
};
export const UNIDADES_CARGA_TRAFO = r => r.tipo==="motor" ? [["hp","HP"],["kw","kW"],["w","W"]] : [["va","VA"],["w","W"],["kva","kVA"],["kw","kW"]];
/* potencia típica (referencial) de una carga de transformador según su tipo y aplicación: se propone mientras el usuario
   no la cambie (manPot = false); en la tabla se ve en cursiva como los demás valores típicos */
const POT_TRAFO = { control:[150,"va"], plc:[150,"va"], instrumentacion:[100,"va"], tablero:[500,"va"], reserva:[100,"va"] };
const POT_TRAFO_GENERAL = { ventiladores:[200,"va"], calefaccion:[100,"w"], luminaria:[40,"w"], tomacorriente:[180,"va"], otro:[100,"va"] };
const POT_TRAFO_MOTOR = { "ventilador-axial":0.25, "faja-transportadora":1, "compresor-piston":1 };
export function potenciaTipicaTrafo(r){
  if(r.tipo==="motor") return [POT_TRAFO_MOTOR[r.application] ?? 0.5, "hp"];
  if(r.tipo==="general") return POT_TRAFO_GENERAL[r.application] || POT_TRAFO_GENERAL.otro;
  return POT_TRAFO[r.tipo] || [100, "va"];
}
export function aplicarPotenciaTrafo(r){ if(!r.manPot){ const [pw, u] = potenciaTipicaTrafo(r); r.power = pw; r.powerUnit = u; } return r; }
export function nuevaCargaTrafo(trafo=""){ return aplicarPotenciaTrafo({ id: uidc("LT"), trafo, desc:"", tipo:"control", application:"na", power:150, powerUnit:"va", manPot:false, diferencial:false }); }
/* potencia típica de una carga del listado según su tipo y aplicación (se propone mientras el usuario no la cambie) */
const POT_MOTOR = { "ventilador-centrifugo":50, "valvula-rotativa":2, "bomba-centrifuga":15, "compresor-piston":25, "ventilador-axial":10, "faja-transportadora":20, molino:100, chancadora:150, agitador:10, otro:10 };
export function potenciaTipica(l){
  if(l.kind==="motor") return [POT_MOTOR[l.application] ?? 10, "hp"];
  if(l.kind==="general") return [5, "kw"];
  if(l.kind==="feeder") return [30, "kw"];
  if(l.kind==="reserva") return [10, "kw"];
  return null;
}
export function aplicarPotenciaTipica(l){ l.man = l.man || {}; const t = !l.man.power && potenciaTipica(l); if(t){ l.power = t[0]; l.powerUnit = t[1]; } return l; }
/* potencia aparente (VA) de una carga de transformador: motores con η·FDP ≈ 0,85·0,80; el resto con FDP 0,9 */
export function vaCargaTrafo(r){
  const x = +r.power || 0, u = r.powerUnit, k = r.tipo==="motor" ? 0.85*0.8 : 0.9;
  const va = u==="hp" ? x*746/k : u==="kw" ? x*1000/k : u==="w" ? x/k : u==="kva" ? x*1000 : x;
  return Math.max(0, Math.round(va));
}
export const cargasDeTrafo = (p, l) => datos(p).cargasTrafo.filter(r=>r.trafo===l.id);
/* cargas asignadas a un tablero (las que no tienen tablero válido van al tablero de fuerza principal) */
export function cargasPropias(p, t){
  const d = datos(p), ids = new Set(tableros(p).map(x=>x.id)), def = tf(p);
  return d.cargas.filter(l=> ids.has(l.tablero) ? l.tablero===t.id : t && t.id===def.id);
}
/* ---------------- control interno de un tablero de fuerza ----------------
   Criterio (unifilar de referencia): portafusibles → transformador (p. ej. 460/220 Vac+T) → interruptor general de
   control → barra «R,S 220 Vac, 1F, 60 Hz, 10 kA» → un circuito por destino con su ITM 2P y su cable: alimentación a los
   tableros de control que dependen del tablero, ventiladores, calefacción, luminaria y tomacorriente (con diferencial de
   30 mA). Con dos tensiones de control (p. ej. 120 y 220 Vac) hay un transformador por tensión: la principal alimenta el
   control (barra estabilizada de los tableros de control) y la segunda los servicios. La barra de servicios puede llegar
   de una segunda fuente externa (t.fuenteServicios = "externa") en lugar del transformador. */
const ESC_CTRL = [2, 4, 6, 10, 16, 20, 25, 32, 40, 50, 63];
const escalon = (a, min=2) => ESC_CTRL.find(x=>x >= Math.max(min, a) - 1e-9) || 63;
const sobre = a => ESC_CTRL.find(x=>x > a) || 63;            // escalón siguiente (selectividad con el interruptor aguas abajo)
const awgCtrl = (a, interno) => a <= 6 && interno ? 16 : a <= 15 ? 14 : a <= 20 ? 12 : a <= 30 ? 10 : 8;
export function controlInterno(p, t){
  if(!t || !(t.tipo==="fuerza" || t.tipo==="fuerzacontrol")) return [];
  const v = valoresDiseno(p), acc = accesoriosTablero(p, t);
  const v1 = parseFloat(v.tensionControl) || 120, dc1 = controlEnDC(v);
  // tableros de control que se alimentan de este tablero: barra estabilizada (desde) y servicios de 220 Vac
  const ctls = tablerosControl(p).filter(x=>x.tipo==="control");
  const primeraFuerza = tablerosPotencia(p).find(esFuerza);
  const est = ctls.filter(x=>x.desde===t.id);
  const aux = ctls.filter(x=>{ if(x.alimAux==="no") return false; const up = x.desde ? tableroPorId(p, x.desde) : null; return (up && esFuerza(up) ? up : primeraFuerza) === t; })
    .filter(x=>circuitosControl(p, x).some(c=>c.barra==="220 Vac"));
  const v2in = parseFloat(v.tensionControl2), v2ok = v2in > 0 && v.tensionControl2Tipo!=="Vdc" && v2in!==v1;
  // segunda tensión: la indicada; si no hay y un tablero de control necesita sus servicios de 220 Vac, 220 Vac
  const v2 = v2ok ? v2in : (aux.length && (dc1 || v1!==220) ? 220 : null);
  const w = (x, barra) => circuitosControl(p, x).filter(c=>c.barra===barra).reduce((a, c)=>a + (+c.potencia||0), 0);
  // circuitos que puede alimentar el control interno (cada uno con su tensión por defecto y el divisor de su cálculo)
  const disp = [];
  // tablero de fuerza y control: su etapa de control (barra estabilizada y 24 Vdc) sale de su propio control interno
  if(t.tipo==="fuerzacontrol") disp.push({ label:"Etapa de control (PLC e instrumentación)", destino:"ETAPA DE CONTROL", va:Math.round(w(t, "120 Vac") + w(t, "24 Vdc")*1.5), min:16, sobre:true, div:120, cfg:"tc:"+t.id });
  for(const x of est){
    // el interruptor del circuito es un escalón mayor que el general de la acometida del tablero de control (MCB1)
    disp.push({ label:`Hacia el tablero de control ${x.tag}`, destino:`HACIA EL ${(x.nombre||"tablero de control").toUpperCase()} ${x.tag}`, va:Math.round(w(x, "120 Vac") + w(x, "24 Vdc")*1.5), min:16, sobre:true, div:120, cfg:"tc:"+x.id, externo:true });
  }
  for(const x of aux) disp.push({ label:`Hacia el tablero de control ${x.tag} (servicios)`, destino:`HACIA EL ${(x.nombre||"tablero de control").toUpperCase()} ${x.tag} (SERVICIOS)`, va:Math.round(w(x, "220 Vac")), min:10, sobre:true, div:220, cfg:"tca:"+x.id, externo:true });
  if(acc.ventilacion) disp.push({ label:"Ventiladores", destino:"VENTILADORES", va:200, min:6, cfg:"ventilacion" });
  if(acc.calefaccion) disp.push({ label:"Calefacción anticondensación", destino:"CALEFACCIÓN", va:100, min:6, cfg:"calefaccion" });
  if(acc.luminaria) disp.push({ label:"Luminaria interna", destino:"LUMINARIA", va:40, min:4, cfg:"luminaria" });
  if(acc.tomacorriente) disp.push({ label:"Tomacorriente", destino:"TOMACORRIENTE", va:180, min:4, cfg:"tomacorriente", id: acc.diferencial!==false });
  // sin segunda tensión todo va a la tensión de control; con ella, el control a la primera y los servicios a la segunda
  const enV1 = d => !v2 || /^tc:/.test(d.cfg);
  const rama = (d, vs, porDefecto) => {
    const a = d.sobre ? sobre(escalon(1.25*d.va/(porDefecto ? d.div : vs), d.min)) : escalon(1.25*d.va/(vs*0.9), d.min);
    return Object.assign({ label:d.label, destino:d.destino, breaker:a, va:d.va, cfg:d.cfg }, d.externo ? { externo:true } : {}, d.id ? { id:true } : {});
  };
  // transformadores de control que el usuario definió en el listado de cargas: su relación y los circuitos que alimenta
  const grupos = [], tomados = new Set();
  const propios = cargasPropias(p, t).filter(l=>l.kind==="control" && (Array.isArray(l.alimenta) || cargasDeTrafo(p, l).length));
  for(const l of propios){
    const vs = parseFloat(l.secundario) || v1, dc = l.secundarioTipo ? l.secundarioTipo==="Vdc" : (vs===v1 && dc1);
    const ramas = (l.alimenta||[]).map(k=>disp.find(d=>d.cfg===k)).filter(d=>d && !tomados.has(d.cfg)).map(d=>{ tomados.add(d.cfg); return rama(d, vs, false); });
    // cargas que el usuario asignó al transformador (cuadro «Cargas de los transformadores»)
    for(const r of cargasDeTrafo(p, l)){
      const nom = r.desc || (TIPOS_CARGA_TRAFO.find(x=>x[0]===r.tipo)||[,"Carga"])[1];
      ramas.push(rama({ label:nom, destino:nom.toUpperCase(), va:vaCargaTrafo(r), min:2, cfg:"lt:"+r.id, externo: r.tipo==="tablero" || r.tipo==="motor" || r.tipo==="instrumentacion", id: r.diferencial!=null ? !!r.diferencial : (r.tipo==="general" && r.application==="tomacorriente") }, vs, false));
    }
    grupos.push({ v:vs, tipo: dc ? "Vdc" : "Vac", ramas, fuente:"trafo", desde:"", loadId:l.id });
  }
  // el resto, como siempre: un transformador por tensión de control
  const resto = disp.filter(d=>!tomados.has(d.cfg));
  const ramasCtl = resto.filter(enV1).map(d=>rama(d, v1, true));
  const ramasSrv = v2 ? resto.filter(d=>!enV1(d)).map(d=>rama(d, v2, true)) : [];
  const fuente = t.fuenteServicios==="externa" ? "externa" : "trafo";
  // con transformadores definidos por el usuario en el listado de cargas, el control interno sale solo de ellos (y de las
  // cargas que les asignó): no se agrega el control interno automático
  if(!propios.length){
    if(ramasCtl.length || !v2) grupos.push({ v:v1, tipo: dc1 ? "Vdc" : "Vac", ramas:ramasCtl, fuente: !v2 ? fuente : "trafo", desde: t.fuenteServiciosDesde || "" });
    if(v2 && ramasSrv.length) grupos.push({ v:v2, tipo:"Vac", ramas:ramasSrv, fuente, desde: t.fuenteServiciosDesde || "" });
  }
  /* circuitos disponibles (para elegirlos en el listado de cargas) */
  grupos.disponibles = disp.map(d=>({ cfg:d.cfg, label:d.label, va:d.va }));
  // nombres comunes a todos los entregables: fusibles después de los de la acometida, transformadores después del de la
  // bobina de mínima tensión (T1), interruptores generales QG2…, circuitos CB2… (CB1 es el de la bobina) y diferenciales ID1…
  const fus = fusiblesAcometida(acc); let nCB = 1, nID = 0;
  grupos.forEach((g, i)=>{
    g.n = i + 1;
    g.nombres = { f: g.fuente==="trafo" ? [fus.siguiente(), fus.siguiente()] : [], t: g.fuente==="trafo" ? "T"+(i+2) : "", q:"QG"+(i+2) };
    g.ramas.forEach(r=>{ r.cb = "CB"+(++nCB); if(r.id) r.idTag = "ID"+(++nID); const a = r.breaker; r.cable = `2C#${awgCtrl(a, !r.externo)}AWG+${awgCtrl(a, !r.externo)}AWG(T)`; });
  });
  return grupos;
}
/* tablero de fuerza y control: últimos números de TAG de la parte de fuerza (interruptores CB, fusibles F, borneras TB y
   supresores SPD), para que su etapa de control siga la numeración y no repita equipos en el mismo tablero. 0 en los demás. */
export function tagsPotenciaTFC(p, t){
  const r = { cb:0, f:0, tb:0, spd:0 };
  if(!t || t.tipo!=="fuerzacontrol") return r;
  const calc = calcularTablero(p, t), acc = accesoriosTablero(p, t), fa = fusiblesAcometida(acc);
  const ver = s => { const m = String(s||"").match(/^(CB|F|TB|SPD)(\d+)$/); if(m){ const k = m[1].toLowerCase(); r[k] = Math.max(r[k], +m[2]); } };
  [...fa.luces, ...fa.rf, ...fa.uvr].forEach(ver); ver("CB1"); ver("TB1");
  if(acc.spd) r.spd = 3;
  for(const c of calc.circuits){
    ver("TB" + ((parseInt(String(c.tag||"").replace(/\D/g, ""), 10) || 0) + 1));
    for(const it of c.items||[]){ ver(it.devtag); (it.devtags||[]).forEach(ver); }
  }
  return r;
}
/* circuito del tablero de fuerza que alimenta a un tablero de control («CB2»): barra estabilizada (est) o servicios (aux) */
export function circuitoHaciaControl(p, x, cual="est"){
  const clave = (cual==="aux" ? "tca:" : "tc:") + x.id;
  for(const t of tablerosPotencia(p)) for(const g of controlInterno(p, t)){ const r = g.ramas.find(r=>r.cfg===clave); if(r) return r.cb; }
  // transformadores del usuario: la etapa de control de un tablero de fuerza y control sale de su carga «PLC» (o «Control
  // interno»); un tablero de control, de la carga «Tablero externo» que lo nombra
  const filas = datos(p).cargasTrafo || [];
  const busca = pred => { for(const t of tablerosPotencia(p)) for(const g of controlInterno(p, t)) for(const r of g.ramas){ const f = /^lt:/.test(r.cfg||"") && filas.find(z=>"lt:"+z.id===r.cfg); if(f && pred(f, t)) return r.cb; } return ""; };
  if(cual==="est" && x.tipo==="fuerzacontrol") return busca((f, t)=>t.id===x.id && f.tipo==="plc") || busca((f, t)=>t.id===x.id && f.tipo==="control");
  return busca(f=>f.tipo==="tablero" && x.tag && String(f.desc||"").toUpperCase().includes(String(x.tag).toUpperCase()));
}
/* cargas de un tablero: las asignadas + (tablero de distribución) un alimentador por cada tablero aguas abajo + (tablero
   de fuerza) su control interno: un transformador de control por tensión (si el usuario agregó cargas «Transformador de
   control», la primera toma el lugar del primer grupo con sus derivaciones calculadas) */
export function cargasDe(p, t, _depth=0){
  const d = datos(p);
  const propias = cargasPropias(p, t).slice();
  const grupos = _depth < 4 ? controlInterno(p, t) : [];
  let antiguo = false;
  grupos.forEach((g, i)=>{
    const ramas = g.ramas.map(r=>({ label:r.label, destino:r.destino, breaker:r.breaker, va:r.va, cfg:r.cfg, cb:r.cb, id:!!r.id, idTag:r.idTag, cable:r.cable, externo:!!r.externo }));
    let k = g.loadId ? propias.findIndex(l=>l.id===g.loadId) : -1;
    if(k < 0 && !g.loadId && !antiguo){ k = propias.findIndex(l=>l.kind==="control" && !Array.isArray(l.alimenta) && !l.controlBranches); if(k >= 0) antiguo = true; }
    const base = k >= 0 ? propias[k] : { id:`ctl_${t.id}_${g.n}`, kind:"control", tag:"", desc:`Control interno ${g.v} ${g.tipo}`, fu:1, fs:1, cableLength:0, auto:true };
    const l = Object.assign({}, base, { controlBranches: ramas, ctrlV:g.v, ctrlTipo:g.tipo, externa: g.fuente==="externa", externaDesde:g.desde, nombres:g.nombres, grupoCtrl:g.n });
    if(k >= 0) propias[k] = l; else propias.push(l);
  });
  // otro «Transformador de control» sin grupo (p. ej. repetido): sin derivaciones
  propias.forEach((l, i)=>{ if(l.kind==="control" && !l.controlBranches) propias[i] = Object.assign({}, l, { controlBranches:[] }); });
  const extra = [];
  if(_depth<4) for(const h of tableros(p).filter(x=>x.desde===t.id && esPotencia(x))){
    const ch = calcularTablero(p, h, _depth+1);
    if(!ch.circuits.length) continue;
    extra.push({ id:"auto_"+h.id, kind:"feeder", tag:h.tag, desc:`Alimentación a ${h.nombre} ${h.tag}`, feederAmps: Math.max(1, +ch.demandCurrent.toFixed(1)), fp: +ch.fpSistema.toFixed(3) || 0.85, fu:1, fs:1, cableLength: +h.cableLength||30, cableTag:h.cableTag||"", canalizacion:h.canalizacion||"", cableClase:h.cableClase||"", _tablero:h });
  }
  return propias.concat(extra);
}

export function calcularTablero(p, t, _depth=0){
  t = t || tf(p);
  const g = parametrosG(p);
  configurarMotor({ flaNorma: g.flaNorma, minMM2: g.minMM2, metodo: g.metodoAmp, ambient: g.ambientTemp, kGroup: g.kGroup });
  const loads = cargasDe(p, t, _depth);
  const circuits = [], mr = marcasProyecto(p);
  loads.forEach((l, i)=>{
    let c;
    if(l.kind==="general" || l.kind==="reserva"){
      // carga general en kW con su FDP (p.ej. circuitos de iluminación / tomacorrientes / reserva), mono o trifásica
      const fp = +l.fp||0.9, kw = +l.power||0, fases = +l.fases===1 ? 1 : 3;
      const kva = kw/fp, amps = fases===1 ? kva*1000/g.voltage : kva*1000/(Math.sqrt(3)*g.voltage);
      c = computeCircuit(Object.assign({}, l, { kind:"feeder", feederAmps: Math.max(0.1, amps) }), i, g);
      if(c){ c.esGeneral = true; c.installedKVA = kva; c.demandKVA = kva*(c.fu)*(c.fs); c.installedCurrent = amps; c.powerKWelec = kw; c.fp = fp; c.fases = fases; c.title = l.desc || "Carga general"; }
      if(c && l.kind==="reserva"){ c.esReserva = true; c.title = l.desc || "Reserva"; c.conductorMemo = null; c.items = (c.items||[]).filter(it=>!/^Cable|^Conductor|^Bornera/.test(it.comp)); }
    } else if(l.kind==="feeder" && !String(l.id||"").startsWith("auto_")){
      // alimentador ingresado por el usuario: la corriente se calcula con la potencia y la tensión del sistema
      const fp = +l.fp||0.85, kw = (+l.power||0)*(l.powerUnit==="hp" ? 0.746 : 1);
      const amps = kw/fp*1000/(Math.sqrt(3)*g.voltage);
      c = computeCircuit(Object.assign({}, l, { feederAmps: Math.max(0.1, amps) }), i, g);
    } else {
      // la corriente nominal siempre se calcula (no se usa corriente de placa ingresada a mano) y el
      // transformador de control trabaja con la tensión de control del proyecto
      c = computeCircuit(Object.assign({}, l, { inPlaca: 0 }, mr.variadores==="Allen-Bradley" ? { vfdBrand:"rockwell" } : mr.variadores==="ABB" ? { vfdBrand:"abb" } : {}), i, g);
    }
    // modelos en la marca confirmada por el usuario (panel «Marcas de los equipos»)
    if(c) for(const it of c.items||[]) if(it.model) it.model = modeloEnMarca(it.model, it.val, mr);
    // protección diferencial propia de la carga (pedido del cliente): relé diferencial con su toroide en la salida
    if(c && l.diferencial && l.kind!=="control" && l.kind!=="reserva"){ c.diferencial = { tag:"RD"+(String(c.tag).replace(/\D/g, "") || c.tag), sens: l.kind==="motor" ? "300mA" : "30mA" };
      c.items.push({ comp:"Protección diferencial (relé con toroide)", devtag:c.diferencial.tag, model:"Relé diferencial electrónico + transformador toroidal", val:c.diferencial.sens, src:null }); }
    if(c){ c.load = l; c.cargaTag = l.tag || c.tag; c.descLabel = c.descLabel || l.desc || c.title; c.tablero = t; circuits.push(c); }
  });
  let mainBreaker = 0, totalKVA = 0, demandCurrent = 0, requiredNEC = 0, requiredDemand = 0, installedKVA = 0, installedCurrent = 0, maxC = 0, sumOthers = 0, fpSistema = 0, fpInstalado = 0;
  if(circuits.length){
    const running = circuits.filter(c=>!(c.fu===0));
    const pool = running.length ? running : circuits;
    const contrib = pool.map(c=>c.mainContribution);
    maxC = Math.max(...contrib); sumOthers = contrib.reduce((a,b)=>a+b,0) - maxC;
    requiredNEC = maxC + sumOthers;            // NEC 430.62(A): valor MÁXIMO del dispositivo del alimentador
    // sumas fasoriales (P y Q) como en el formato de listado de cargas: S = √(ΣP² + ΣQ²)
    let Pi = 0, Qi = 0, Pd = 0, Qd = 0;
    for(const c of circuits){ const fp = FP_CIRC(c), sn = Math.sqrt(Math.max(0, 1-fp*fp)); const si = c.installedKVA||0, sd = c.demandKVA||0; Pi += si*fp; Qi += si*sn; Pd += sd*fp; Qd += sd*sn; }
    installedKVA = Math.hypot(Pi, Qi); totalKVA = Math.hypot(Pd, Qd);
    fpInstalado = installedKVA ? Pi/installedKVA : 0; fpSistema = totalKVA ? Pd/totalKVA : 0;
    installedCurrent = installedKVA*1000/(Math.sqrt(3)*g.voltage);
    demandCurrent = totalKVA*1000/(Math.sqrt(3)*g.voltage);
    requiredDemand = demandCurrent*1.25;       // NEC 215.3: 125 % de la carga continua
    // interruptor general: ≥ 125 % de la corriente de máxima demanda y ≤ máximo NEC 430.62(A); si no existe un
    // escalón en ese rango se toma el mayor escalón ≤ 430.62 que conduzca la corriente de máxima demanda
    const ok1 = BREAKER_STEPS.filter(b=>b >= requiredDemand-1e-9 && b <= requiredNEC+1e-9);
    const ok2 = BREAKER_STEPS.filter(b=>b >= demandCurrent-1e-9 && b <= requiredNEC+1e-9);
    mainBreaker = ok1.length ? ok1[0] : ok2.length ? ok2[ok2.length-1] : pickStep(BREAKER_STEPS, requiredDemand);
  }
  const mainCond = buildMainConductorSpec(requiredDemand, tempCorrFactor(g.ambientTemp));
  const excede430 = mainBreaker > requiredNEC + 1e-9;
  return { tablero:t, circuits, g, mainBreaker, totalKVA, demandCurrent, requiredNEC, requiredDemand, installedKVA, installedCurrent, mainCond, maxC, sumOthers, fpSistema, fpInstalado, excede430 };
}
/* distribución principal del tablero: barras de cobre desde 100 A; por debajo, cable (dimensionado para el interruptor
   general, con su conductor de tierra). La usan el unifilar, el multifilar y el arreglo mecánico. */
export function distribucionPrincipal(calc){
  const a = +(calc && calc.mainBreaker) || 0, minMM2 = (calc && calc.g && calc.g.minMM2) || 0;
  if(a >= 100) return { barras:true, a };
  const e = egcFor(a), c = CABLE_TABLE.find(r=>r[2] >= a && r[1] >= Math.max(minMM2, +e[2]||0) - 1e-9) || CABLE_TABLE[CABLE_TABLE.length-1];
  const g = s => String(s||"").replace(/\s+/g, "");
  return { barras:false, a, fase:g(c[0]), tierra:g(e[1]), texto:`3x#${g(c[0])} + 1x#${g(e[1])}(T)` };
}
/* todos los tableros de potencia con carga (para documentos multi-tablero) */
export function calcularTodos(p){ return tablerosPotencia(p).map(t=>calcularTablero(p, t)).filter(c=>c.circuits.length); }

/* ---------------- cables de fuerza ---------------- */
export const CLASES_CABLE = {
  estandar: { nombre:"Estándar industrial (XLPE / PVC)", tipo:"Cable de fuerza multiconductor tipo RV-K 0,6/1 kV (Cu flexible clase 5, aislamiento XLPE 90 °C, cubierta PVC)", uso:"Interior o exterior en bandeja / conduit, sin exigencia de baja emisión de humos ni halógenos.", norma:"IEC 60502-1 / NTP IEC 60502-1 / UNE 21123-2", ref:"p.ej. BARRYFLEX RV-K 0,6/1 kV" },
  lszh: { nombre:"Libre de halógenos — LSZH", tipo:"Cable de fuerza multiconductor tipo RZ1-K (AS) 0,6/1 kV (Cu flexible clase 5, XLPE 90 °C, cubierta poliolefina libre de halógenos)", uso:"Salas eléctricas, recintos cerrados, áreas con personal, túneles y rutas de evacuación (no propagador del incendio, baja emisión de humos).", norma:"IEC 60332-1-2 / 60332-3-24 / 60754 / 61034", ref:"Miguélez AFIRENAS X RZ1-K (AS)" },
  tc: { nombre:"Norma americana — Tray Cable TC-ER", tipo:"Cable multiconductor tipo TC-ER 600 V, 90 °C (Cu, aislamiento XHHW-2, cubierta exterior), con conductor de tierra", uso:"Bandeja y tramos expuestos (exposed run) en plantas industriales diseñadas con NEC.", norma:"NEC Art. 336 / UL 1277", ref:"Fabricante a definir" },
  armado: { nombre:"Robusto — armado", tipo:"Cable de fuerza armado 0,6/1 kV (Cu, XLPE 90 °C, armadura de alambres o fleje de acero, cubierta exterior LSZH)", uso:"Enterrado directo, zonas con riesgo de daño mecánico o tránsito de equipos (chancado, fajas, minería subterránea).", norma:"IEC 60502-1 / NEC Art. 330 (MC-HL en áreas clasificadas)", ref:"Fabricante a definir" },
};
export const CANALIZACIONES = [
  ["flex1",'Conduit flexible 1"'],["flex15",'Conduit flexible 1½"'],["flex2",'Conduit flexible 2"'],
  ["rig1",'Conduit rígido 1"'],["rig15",'Conduit rígido 1½"'],["rig2",'Conduit rígido 2"'],["otros","Bandeja / otros"],
];
export function cablesFuerza(p){
  const d = datos(p), cfg = d.cablesCfg;
  const filas = [];
  for(const calc of calcularTodos(p)){
    const t = calc.tablero;
    for(const c of calc.circuits){
      const m = c.conductorMemo; if(!m || !m.cable) continue;
      const l = c.load;
      const hasta = l.kind==="feeder" && l._tablero ? l._tablero.tag : (l.tag || (t.tag+"-"+c.tag));
      const claseId = l.cableClase || cfg.clase;
      const clase = CLASES_CABLE[claseId] || CLASES_CABLE.lszh;
      const egc = m.egc ? m.egc[1] : "";
      const egcMm2 = m.egc ? m.egc[2] : "";
      const mm2 = m.miguelez && claseId==="lszh" ? m.miguelez.mm2 : m.cable[1];
      const vfd = l.kind==="motor" && l.starter==="vfd";
      filas.push({
        tag: l.cableTag || (String(hasta).replace(/-/g,"")+"-P01"),
        tipo: clase.tipo + `. Calibre: 3x${mm2} mm²${egcMm2 ? " + "+egcMm2+" mm² (T)" : ""} (NEC: 3#${m.cable[0]}${egc ? " + 1#"+egc+" (T)" : ""}).` + (vfd ? " Salida de variador: preferir cable simétrico apantallado según el fabricante del VFD." : ""),
        clase: clase.nombre, voltaje: `${parametrosG(p).voltage} Vac`, aislamiento:"0,6/1 kV", conductores: 3, seccion: `${mm2}${egcMm2 ? "+"+egcMm2+"(T)" : ""}`,
        awg: `3#${m.cable[0]}${egc ? " + 1#"+egc+" (T)" : ""}`, desde: t.tag, hasta, servicio: l.desc || c.title || "",
        canalizacion: l.canalizacion || cfg.canalizacion, longitud: m.cableLength, longitudTotal: Math.ceil(m.cableLength*(1+(+cfg.reserva||0)/100)),
        referencia: claseId==="lszh" && m.miguelez ? m.miguelez.desc : clase.ref, ampacidad: m.cable[2], dv: m.vdPct,
        _load: l, _t: t, _c: c,
      });
    }
  }
  return filas;
}

/* ---------------- instrumentos ---------------- */
export function instrumentos(p){ return datos(p)["ins-instrumentos"]; }
export function tableroDeInstrumento(p, i){ return (i && i.tablero && tableroPorTag(p, i.tablero)) || tc(p); }
export function tipoInstrumento(tag){
  const m = String(tag||"").toUpperCase().match(/^([A-Z]{1,5})/); return m ? m[1] : "";
}
export function esAnalogico(i){ return /anal/i.test(i.tipoSenal||"") || /4\s*-\s*20/.test(i.senal||""); }
export function esSalida(i){ const t = tipoInstrumento(i.tag); return /^(XV|SV|FV|PV|LV|TV|HV|XY|SY)$/.test(t) || /v[aá]lvula/i.test(i.descripcion||""); }
export function expandirTag(tag, cant){
  // "XV-003A@003R" ó "XV-003A@R" → XV-003A … XV-003R
  const m = String(tag||"").match(/^(.*?)([A-Z])@(?:.*?)([A-Z])$/);
  if(m){ const out=[]; for(let c=m[2].charCodeAt(0); c<=m[3].charCodeAt(0); c++) out.push(m[1]+String.fromCharCode(c)); return out; }
  return [tag];
}

/* ---------------- lista de E/S derivada ----------------
   Criterios usuales de un listado I/O:
   - señales del tablero (parada de emergencia, reset, selector local/remoto, disparo del ITM general)
   - motores directos: estado de marcha y falla (DI) + comando de arranque (DO)
   - variadores cableados: listo, marcha y falla (DI) + arranque y reset (DO) + referencia de velocidad (AO)
   - controlador de limpieza: transmisor de presión diferencial y válvulas solenoides en el controlador propio,
     con retransmisión 4-20 mA al PLC
   - canales de reserva hasta completar los módulos (reserva mínima según criterio del proyecto) */
const ORDEN_IO = { AI:0, AO:1, DI:2, DO:3, COM:4 };
export function funcionISA(tag, tipoIO){
  const t = tipoInstrumento(tag);
  if(tipoIO==="AI") return /IT$/.test(t) ? t.replace(/IT$/,"I") : /T$/.test(t) ? t.replace(/T$/,"I") : t;
  if(tipoIO==="DI"){ const m = t.match(/^([A-Z]+?)S([HL]{1,2})$/); return m ? m[1]+"A"+m[2] : t; }
  return t;
}
function controlDe(p, t){ return esControl(t) ? t : (t.control && tableroPorId(p, t.control)) || tc(p); }
export function derivarIO(p){
  const d = datos(p);
  const filas = [];
  const ctls = tablerosControl(p).length ? tablerosControl(p) : [tc(p)];
  for(const ct of ctls){
    const plc = ct.tag || "PLC-001";
    const dv = ct.ioDiscreto || "120 Vac";
    const add = (o)=>filas.push(Object.assign({ tablero:plc, alimentacion:"-", rangoMin:"", rangoMax:"", unidad:"" }, o));
    const alimDisc = `${dv} desde el ${plc} - contacto seco en campo`;
    // tableros de fuerza controlados por este tablero
    const fuerzas = tablerosPotencia(p).filter(t=>t.tipo!=="distribucion" && controlDe(p, t).id===ct.id);
    if(ct.senalesTablero) for(const tfz of fuerzas){
      const hs = "HS-"+tfz.tag;
      add({ tag:hs, senal:hs+"_ESTOP", descripcion:"Parada de emergencia "+tfz.tag, tipo:"DI", voltaje:dv, alimentacion:`${dv} desde el ${plc} - contacto en botonera`, origen:"tablero" });
      add({ tag:hs, senal:hs+"_RESET", descripcion:"Reset general "+tfz.tag, tipo:"DI", voltaje:dv, alimentacion:`${dv} desde el ${plc} - contacto en botonera`, origen:"tablero" });
      add({ tag:hs, senal:hs+"_LOC", descripcion:"Selector en modo local "+tfz.tag, tipo:"DI", voltaje:dv, alimentacion:`${dv} desde el ${plc} - contacto en botonera`, origen:"tablero" });
      add({ tag:hs, senal:hs+"_REM", descripcion:"Selector en modo remoto "+tfz.tag, tipo:"DI", voltaje:dv, alimentacion:`${dv} desde el ${plc} - contacto en botonera`, origen:"tablero" });
      add({ tag:"QG-"+tfz.tag, senal:"QG-"+tfz.tag+"_TRIP", descripcion:"Estado de disparo del ITM general "+tfz.tag, tipo:"DI", voltaje:dv, alimentacion:alimDisc, origen:"tablero" });
    }
    // motores mandados desde este tablero
    for(const l of d.cargas){
      if(l.kind!=="motor") continue;
      const tl = tableroPorId(p, l.tablero) || tf(p);
      if(controlDe(p, tl).id!==ct.id) continue;
      const t = l.tag || "M", nm = (l.desc||"").toLowerCase();
      if(l.starter==="vfd" && ct.vfdMando==="red"){
        add({ tag:t, senal:t+"_VFD", descripcion:"Variador de "+nm+" (mando, estado y velocidad)", tipo:"COM", voltaje:"Ethernet/IP", origen:"carga" }); continue;
      }
      if(l.starter==="vfd"){
        add({ tag:t, senal:t+"_SPD", descripcion:"Referencia de velocidad del variador de "+nm, tipo:"AO", voltaje:"4-20 mA", rangoMin:0, rangoMax:+valoresDiseno(p).frecuencia||60, unidad:"Hz", alimentacion:"Salida activa desde el PLC hacia el VFD", origen:"carga" });
        add({ tag:t, senal:t+"_READY", descripcion:"Estado de listo de "+nm, tipo:"DI", voltaje:dv, alimentacion:alimDisc.replace("en campo","en VFD"), origen:"carga" });
      }
      add({ tag:t, senal:t+"_RUN", descripcion:"Estado de arranque de "+nm, tipo:"DI", voltaje:dv, alimentacion:alimDisc.replace("en campo", l.starter==="vfd" ? "en VFD" : "en contactor"), origen:"carga" });
      add({ tag:t, senal:t+"_FAULT", descripcion:"Falla de "+nm, tipo:"DI", voltaje:dv, alimentacion:alimDisc.replace("en campo", l.starter==="vfd" ? "en VFD" : "en guardamotor / relé"), origen:"carga" });
      add({ tag:t, senal:t+"_START", descripcion:"Comando de arranque de "+nm, tipo:"DO", voltaje:"Relé", alimentacion:"Contacto seco", origen:"carga" });
      if(l.starter==="vfd") add({ tag:t, senal:t+"_RESET", descripcion:"Comando de reinicio del variador de "+nm, tipo:"DO", voltaje:"Relé", alimentacion:"Contacto seco", origen:"carga" });
      if(ct.repetidores){
        if(l.starter==="vfd") add({ tag:t, senal:t+"_READY_R", descripcion:"Repetición de estado de listo de "+nm, tipo:"DO", voltaje:"Relé", alimentacion:"Contacto seco hacia sala de control", origen:"carga" });
        add({ tag:t, senal:t+"_RUN_R", descripcion:"Repetición de estado de arranque de "+nm, tipo:"DO", voltaje:"Relé", alimentacion:"Contacto seco hacia sala de control", origen:"carga" });
        add({ tag:t, senal:t+"_FAULT_R", descripcion:"Repetición de falla de "+nm, tipo:"DO", voltaje:"Relé", alimentacion:"Contacto seco hacia sala de control", origen:"carga" });
      }
    }
    if(ct.repetidores) add({ tag:plc, senal:plc+"_FAULT", descripcion:"Falla de PLC", tipo:"DO", voltaje:"Relé", alimentacion:"Contacto seco hacia sala de control", origen:"tablero" });
    if(ct.lucesPiloto!==false && !(ct.lucesOmitir||[]).includes("alarma")) add({ tag:plc, senal:plc+"_ALM", descripcion:"Luz piloto de alarma general (puerta del tablero "+plc+")", tipo:"DO", voltaje:"Relé", alimentacion:`${dv} desde el ${plc} - luz piloto roja en puerta`, origen:"tablero" });
    // instrumentos de este tablero
    for(const i of instrumentos(p)){
      if(tableroDeInstrumento(p, i).id!==ct.id) continue;
      const tipoI = tipoInstrumento(i.tag);
      if(/^\s*N\.?\s*A\.?\s*$/i.test(i.tipoSenal||"") && !/^XV|^SV/.test(tipoI)) continue;   // indicadores locales sin señal
      const limpieza = ct.controladorLimpieza && (/^PD(I)?T$/.test(tipoI) || /^XV$|^SV$/.test(tipoI));
      for(const tag of expandirTag(i.tag, i.cant)){
        if(!tag) continue;
        const analog = esAnalogico(i), salida = esSalida(i);
        const tipo = analog ? (salida ? "AO" : "AI") : (salida ? "DO" : "DI");
        const [rmin, rmax] = analog && i.rango ? String(i.rango).split(/\s*-\s*/) : ["",""];
        const ali = analog ? (/loop/i.test(i.alimentacion||"") ? `Loop powered, 2 hilos (24 Vdc desde ${limpieza ? ct.tagLimpieza : plc})` : `Externa, 4 hilos (${(i.alimentacion||"120 Vac").replace(/\s*\/.*$/,"")}) – salida 4-20 mA`) : (salida ? `${(i.alimentacion||"120 Vac").replace(/\s*\/.*$/,"")}` : alimDisc);
        const base = { tag, descripcion: i.servicio || i.descripcion || "", tipo, voltaje: analog ? "4-20 mA" : (salida ? (i.alimentacion||"120 Vac").replace(/\s*\/.*$/,"") : dv), rangoMin: rmin||"", rangoMax: rmax||"", unidad: analog ? (i.unidad||"") : "", alimentacion: ali, origen:"instrumento" };
        if(limpieza && tipo==="AI"){
          const pdic = tag.replace(/^PD(I)?T/, "PDIC");
          add(Object.assign({}, base, { tablero: ct.tagLimpieza, senal: tag+"_"+funcionISA(tag,"AI") }));
          add(Object.assign({}, base, { tablero: ct.tagLimpieza, tag: pdic, senal: pdic+"_PDI", tipo:"AO", alimentacion:"Retransmisión hacia "+plc }));
          add(Object.assign({}, base, { tag: pdic, senal: pdic+"_PDI", alimentacion:"Señal activa desde "+ct.tagLimpieza }));
        } else if(limpieza && tipo==="DO"){
          add(Object.assign({}, base, { tablero: ct.tagLimpieza, senal: tag+"_OPEN", descripcion:"Comando de apertura de "+(i.descripcion||"válvula").toLowerCase().replace(/s$/,"")+" "+tag }));
        } else add(Object.assign({}, base, { senal: tag+"_"+(tipo==="DO" ? "OPEN" : funcionISA(tag, tipo)) }));
      }
    }
  }
  // orden: controlador (PLC primero, luego controladores auxiliares) y tipo de señal; reservas al completar módulos
  const ctrlOrden = t => ctls.findIndex(c=>c.tag===t) >= 0 ? ctls.findIndex(c=>c.tag===t) : 100;
  filas.sort((a,b)=>(ctrlOrden(a.tablero)-ctrlOrden(b.tablero)) || ((ORDEN_IO[a.tipo]??9)-(ORDEN_IO[b.tipo]??9)));
  const res = +valoresDiseno(p).reservaIO || 0;
  const out = [];
  for(const ct of ctls){
    const propias = filas.filter(f=>f.tablero===ct.tag);
    for(const tipo of ["AI","AO","DI","DO","COM"]){
      const fs = propias.filter(f=>f.tipo===tipo); out.push(...fs);
      if(!ct.listarReservas || tipo==="COM" || !fs.length) continue;
      const cpm = (ct.canales||{})[tipo] || 16;
      const req = Math.ceil(fs.length*(1+res/100)), cap = Math.ceil(req/cpm)*cpm;
      for(let k=fs.length; k<cap; k++) out.push({ tag:"-", senal:tipo+"_RESERVA", descripcion:"Reserva", tablero:ct.tag, tipo, voltaje: fs[0].voltaje, rangoMin:"", rangoMax:"", unidad:"", alimentacion:"-", origen:"reserva" });
    }
  }
  out.push(...filas.filter(f=>!ctls.some(c=>c.tag===f.tablero)));
  return out;
}

/* calefacción anticondensación del tablero de control: la pide el usuario (arreglo mecánico) o se agrega sola con
   temperatura mínima ≤ 5 °C, instalación exterior / intemperie o altitud ≥ 3000 m s.n.m. (fuertes variaciones de
   temperatura día-noche en sitios de altura: condensación dentro del gabinete) */
export function calefaccionTablero(p, t){
  const c = (((datos(p).mecanico||{})[t.id])||{}).calefaccion || "auto";
  if(c==="si") return true; if(c==="no") return false;
  const v = valoresDiseno(p), tMin = parseFloat(v.tempMin);
  return (isFinite(tMin) && tMin <= 5) || /exterior|intemperie/i.test(v.ambiente||"") || (parseFloat(v.altitud)||0) >= 3000;
}
/* ¿el módulo de salidas analógicas de la familia del PLC del tablero necesita 24 Vdc externos? */
export function aoConAlimentacion(t){
  t = t || {};
  const fam = FAMILIAS[t.familiaPlc] || FAMILIAS[familiaPorTexto(`${t.marcaPlc||""} ${t.plc||""} ${t.modeloPlc||""}`)];
  return Object.values(((fam||{}).mod||{}).AO || {}).some(m=>(((MODULOS[m]||{}).bornes||{}).alim||[]).length > 0);
}
/* ---------------- circuitos de un tablero de control ---------------- */
export function derivarCircuitosControl(p, t){
  // Criterio usual de unifilar de control: 24 Vdc con portafusibles de 1 A por
  // derivación; 120 Vac con ITM 2x2 A por instrumento / circuito; 220 Vac para ventilación, luminaria y
  // tomacorriente con diferencial de 30 mA. Cada circuito ligado a un instrumento (inst) o a un equipo del
  // tablero (cfg) sigue al proyecto aunque el usuario haya editado los circuitos (ver circuitosControl).
  t = t || tc(p);
  const inst = instrumentos(p).filter(i=>tableroDeInstrumento(p, i).id===t.id);
  const enLimpieza = i => t.controladorLimpieza && (/^PD(I)?T$/.test(tipoInstrumento(i.tag)) || /^XV$|^SV$/.test(tipoInstrumento(i.tag)));
  const hayAO = datos(p).cargas.some(l=>l.kind==="motor" && l.starter==="vfd" && t.vfdMando!=="red") || inst.some(i=>esAnalogico(i) && esSalida(i));
  const c24 = [], c120 = [], c220 = [];
  c24.push({ descripcion:"Alimentación al PLC", proteccion:1, cfg:"plc" });
  const ana = inst.filter(i=>esAnalogico(i) && !enLimpieza(i));
  if(ana.length) c24.push({ descripcion:"Alimentación a las entradas analógicas", proteccion:1, cfg:"ai" });
  // las salidas analógicas llevan su circuito de 24 Vdc solo si el módulo de la familia del PLC tiene bornes de alimentación
  // (S7-1500: 41 L+ / 44 M; S7-1200: L+ / M); los 5069, 1769 y X80 se alimentan desde el bastidor y el circuito no tendría destino
  if(hayAO && aoConAlimentacion(t)) c24.push({ descripcion:"Alimentación a las salidas analógicas", proteccion:1, cfg:"ao" });
  if(t.hmi) c24.push({ descripcion:"Alimentación al HMI", proteccion:1, cfg:"hmi" });
  if(t.router) c24.push({ descripcion:"Alimentación al router", proteccion:1, cfg:"router" });
  if(t.switch) c24.push({ descripcion:"Alimentación al switch", proteccion:1, cfg:"switch" });
  // luces piloto en la puerta: 24 Vdc presente (verde); 120 Vac presente (blanca) y alarma general (roja, por relé del PLC);
  // 220 Vac presente (blanca) cuando hay acometida auxiliar
  // luces piloto: se pueden quitar todas (lucesPiloto = false) o una por una (lucesOmitir: "120", "220", "24", "alarma")
  const luces = t.lucesPiloto!==false, omL = t.lucesOmitir || [];
  if(luces && !omL.includes("24")) c24.push({ descripcion:"Luz piloto de 24 Vdc", proteccion:1, potencia:1, cfg:"luz24" });
  for(const i of inst){
    if(enLimpieza(i)) continue;
    // los transmisores de lazo (2 hilos) se protegen con UN fusible por lazo: el fusible-borne XF2 del canal
    // analógico (0,5 A), alimentado desde «Alimentación a las entradas analógicas»; aquí solo van los equipos de
    // 24 Vdc con alimentación propia (4 hilos o discretos)
    if(esAnalogico(i) && /loop/i.test(i.alimentacion||"")) continue;
    if(/24\s*V/i.test(i.alimentacion||"")) for(const tg of expandirTag(i.tag)) c24.push({ descripcion:"Alimentación al "+(i.descripcion||"instrumento").toLowerCase()+" "+tg, proteccion:1, inst:tg });
  }
  c24.push({ descripcion:"Reserva", proteccion:1 }, { descripcion:"Reserva", proteccion:1 });
  c120.push({ descripcion:"Fuente de 24 Vdc", proteccion:10, potencia:240, cfg:"fuente" });
  c120.push({ descripcion:"Alimentación a entradas digitales", proteccion:2, potencia:10, cfg:"di" });
  c120.push({ descripcion:"Alimentación a salidas digitales", proteccion:2, potencia:16, cfg:"do" });
  if(luces && !(omL.includes("120") && omL.includes("alarma"))) c120.push({ descripcion:"Luces piloto de presencia de tensión y alarma", proteccion:2, potencia:3, cfg:"luz120" });
  for(const i of inst){
    if(enLimpieza(i) || esSalida(i)) continue;
    if(/120/.test(i.alimentacion||"")) for(const tg of expandirTag(i.tag)) c120.push({ descripcion:"Alimentación al "+(i.descripcion||"instrumento").toLowerCase()+" "+tg, proteccion:2, potencia:8, inst:tg });
  }
  if(t.controladorLimpieza) c120.push({ descripcion:"Alimentación al controlador de limpieza", proteccion:2, potencia:30, cfg:"limpieza" });
  c120.push({ descripcion:"Reserva", proteccion:2 }, { descripcion:"Reserva", proteccion:2 });
  // tablero de fuerza y control: los servicios (ventilación, luminaria, tomacorriente, calefacción) son los del propio
  // tablero y salen de su control interno; la etapa de control no los repite
  const servicios = t.tipo!=="fuerzacontrol";
  if(servicios) c220.push({ descripcion:"Ventilación interna", proteccion:4, potencia:200, cfg:"ventilacion" });
  if(servicios) c220.push({ descripcion:"Luminaria interna", proteccion:6, potencia:60, cfg:"luminaria" });
  if(servicios) c220.push({ descripcion:"Alimentación al tomacorriente", proteccion:4, diferencial:true, cfg:"tomacorriente" });
  if(servicios && calefaccionTablero(p, t)) c220.push({ descripcion:"Calefacción anticondensación", proteccion:6, potencia:100, cfg:"calefaccion" });
  if(servicios && luces && !omL.includes("220")) c220.push({ descripcion:"Luz piloto de presencia de tensión 220 Vac", proteccion:2, potencia:1, cfg:"luz220" });
  const add = (arr, barra, cable)=>arr.map((c,i)=>dimensionarCircuito(Object.assign({ barra, circuito:"C"+(i+1), cable }, c)));
  return [
    ...add(c24, "24 Vdc", "2C#14AWG+14AWG(T)"),
    ...add(c120, "120 Vac", "2C#14AWG+14AWG(T)"),
    ...add(c220, "220 Vac", "2C#14AWG+14AWG(T)"),
  ];
}
/* protección y cable de un circuito de control: los calcula Ingenia (el usuario no los ingresa).
   I = P / V (P / (V · 0,9) en alterna), corriente de diseño 1,25 · I, el escalón siguiente de fusible (24 Vdc) o de ITM
   curva C (alterna), sin bajar del mínimo del tipo de circuito (fuente de 24 Vdc 10 A por la corriente de conexión,
   ventilación 4 A, luminaria y calefacción 6 A, tomacorriente 4 A; 1 A en 24 Vdc y 2 A en alterna); cable según la
   protección (14 AWG hasta 15 A, 12 AWG hasta 20 A, 10 AWG hasta 30 A). */
const MIN_CIRCUITO = { fuente:10, ventilacion:4, luminaria:6, calefaccion:6, tomacorriente:4 };
export function dimensionarCircuito(c){
  const dc = /24\s*V/i.test(c.barra||""), v = dc ? 24 : (parseFloat(c.barra)||120);
  const i = (+c.potencia||0)/(dc ? v : v*0.9), req = 1.25*i;
  const pasos = dc ? [0.5, 1, 2, 4, 6, 10] : [2, 4, 6, 10, 16, 20, 25, 32];
  const min = (c.cfg && MIN_CIRCUITO[c.cfg]) || (dc ? 1 : 2);
  const a = Math.max(min, pasos.find(x=>x >= req - 1e-9) ?? pasos[pasos.length-1]);
  const awg = a <= 15 ? 14 : a <= 20 ? 12 : a <= 30 ? 10 : 8;
  return Object.assign(c, { proteccion:a, cable:`2C#${awg}AWG+${awg}AWG(T)` });
}
/* circuitos del tablero de control: los derivados del proyecto o los editados por el usuario, sincronizados:
   los circuitos de instrumentos y equipos que ya no existen se retiran y los nuevos se agregan antes de las
   reservas de su barra (así quitar o agregar un componente actualiza todos los entregables) */
export function circuitosControl(p, t){
  t = t || tc(p); const d = datos(p); const man = d.circuitosCtl[t.id];
  const auto = derivarCircuitosControl(p, t);
  return man && man.length ? sincronizarCircuitos(man, auto).map(dimensionarCircuito) : auto;
}
const CFG_DESC = [["luz24",/luz piloto de 24/i],["luz120",/luces piloto de presencia/i],["luz220",/luz piloto de presencia de tensi[oó]n 220/i],["calefaccion",/calefacci/i],["plc",/al plc/i],["ai",/entradas anal/i],["ao",/salidas anal/i],["hmi",/\bhmi\b/i],["router",/router/i],["switch",/switch/i],["fuente",/fuente de 24/i],["di",/entradas digitales/i],["do",/salidas digitales/i],["limpieza",/controlador de limpieza/i],["ventilacion",/ventilaci/i],["luminaria",/luminaria/i],["tomacorriente",/tomacorriente/i]];
export function sincronizarCircuitos(man, auto){
  const tagsAuto = auto.filter(a=>a.inst).map(a=>a.inst).sort((a, b)=>b.length - a.length);
  // clave de un circuito: instrumento o equipo al que alimenta (los guardados antes de esta versión se reconocen por su descripción)
  const clave = x => {
    if(x.inst) return "i:"+x.inst; if(x.cfg) return "c:"+x.cfg;
    const d = String(x.descripcion||"");
    const tg = tagsAuto.find(tg=>new RegExp(`(^|[^A-Za-z0-9])${tg.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}([^A-Za-z0-9]|$)`).test(d)); if(tg) return "i:"+tg;
    const m = /alimentaci[oó]n al .+ ([A-Z]{1,5}-\d{2,4}[A-Z]?)$/i.exec(d); if(m) return "i:"+m[1].toUpperCase();
    const c = CFG_DESC.find(([, re])=>re.test(d)); return c ? "c:"+c[0] : null;
  };
  const autoK = new Map(auto.map(a=>[clave(a), a]).filter(([k])=>k));
  const out = man.filter(x=>{ const k = clave(x); return !k || autoK.has(k) || x.fijo; });
  const tiene = new Set(out.map(clave).filter(Boolean));
  for(const a of auto){
    const k = clave(a); if(!k || tiene.has(k)) continue;
    const res = out.findIndex(x=>x.barra===a.barra && /^reserva$/i.test(x.descripcion||""));
    const ult = out.map(x=>x.barra).lastIndexOf(a.barra);
    out.splice(res >= 0 ? res : (ult >= 0 ? ult + 1 : out.length), 0, Object.assign({}, a));
  }
  const n = {}; out.forEach(x=>{ n[x.barra] = (n[x.barra]||0) + 1; x.circuito = "C"+n[x.barra]; });
  return out;
}

/* ---------------- equipos eléctricos ---------------- */
export function equiposElectricos(p){
  const d = datos(p), v = valoresDiseno(p);
  const sist = sistemaNombre(p).toUpperCase() + (sistemaTag(p) ? "\n"+sistemaTag(p) : "");
  const filas = [];
  const fuerza = `${v.tension} Vac / ${v.frecuencia} Hz / 3F`, ctrl = controlEnDC(v) ? tensionControlTxt(v) : `${tensionControlTxt(v)} / ${v.frecuencia} Hz / 1F`;
  const mr = marcasProyecto(p);
  for(const t of tableros(p)){
    filas.push({ sistema:sist, cant:1, tag:t.tag, descripcion:(t.nombre||TIPOS_TABLERO[t.tipo].nombre).toUpperCase(), marca:t.marca || mr.gabinetes, modelo:t.modelo||"", tension: t.tipo==="control" ? ctrl : fuerza, plano:"", notas: "", _doc: t.tipo==="control" ? "ins-unifilar-tc" : "ele-unifilar" });
  }
  if(d.equiposCfg.incluirEquipos) for(const calc of calcularTodos(p)) for(const c of calc.circuits){
    if(c.kind!=="motor") continue;
    const l = c.load;
    filas.push({ sistema:sist, cant:1, tag:l.tag||("M"+c.tag), descripcion:"MOTOR "+(l.desc||"").toUpperCase()+" · "+l.power+" "+(l.powerUnit==="hp"?"HP":"kW"), marca:"", modelo:"", tension:fuerza, plano:"", notas:"Tablero "+calc.tablero.tag, _doc:"ele-unifilar" });
    const vfd = c.items.find(it=>/^VDF/.test(it.devtag||""));
    if(vfd) filas.push({ sistema:sist, cant:1, tag:(l.tag||c.tag)+"-VFD", descripcion:"VARIADOR DE FRECUENCIA "+(l.desc||"").toUpperCase(), marca:/Allen|PowerFlex/.test(vfd.model) ? "Allen-Bradley" : mr.variadores, modelo:vfd.model.replace(/^(ABB|Schneider|Siemens|Danfoss|Allen-Bradley) /,""), tension:fuerza, plano:"", notas:"Tablero "+calc.tablero.tag, _doc:"ele-unifilar" });
  }
  return filas;
}

/* ---------------- utilidades ---------------- */
export function r2(x, n=2){ if(x==null || x==="" || isNaN(x)) return ""; const k = Math.pow(10,n); return Math.round(x*k)/k; }
export function guardar(){ save(); }
export { APPLICATIONS, egcFor, miguelezCableFor };

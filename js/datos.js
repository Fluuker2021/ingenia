/* Ingenia — modelo de datos del proyecto y derivaciones entre documentos.
   Un solo juego de datos alimenta todos los entregables: lo que se edita en un documento (p.ej. el listado de
   cargas o el de instrumentos) se refleja en los demás (cables, equipos, hojas de datos, memorias, I/O, lazos,
   unifilares…). Los tableros se definen al crear el proyecto (tipo, cantidad y TAG) y cada carga /
   instrumento se asigna a uno de ellos. */
import { computeCircuit, pickStep, BREAKER_STEPS, tempCorrFactor, buildMainConductorSpec, APPLICATIONS, egcFor, miguelezCableFor, configurarMotor, CABLE_TABLE } from "./engine/tablero-core.js";
import { valoresDiseno } from "./modules/criterios.js";
import { save } from "./store.js";

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
export const IO_DEF = () => ({ ioDiscreto:"120 VAC", vfdMando:"cableado", senalesTablero:true, repetidores:false, listarReservas:true, primerSlot:1, tbOffset:5, canales:{ AI:16, AO:8, DI:16, DO:16 }, tagLimpieza:"TCL-001" });

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
  return { voltage: +v.tension||460, freq: +v.frecuencia||60, ctrlVoltage: String(v.tensionControl||"120"), faultLevel: +v.icc||25,
    altitude: +v.altitud||1000, ambientTemp: +v.tempDiseno||40, fuseMult:1.75, vfdBrkMult:1.25, brkMult:2.5,
    maxVD: +v.caidaTension||2.5, kGroup: +d.memoria.kGroup||1,
    flaNorma: /IEC/.test(v.corrienteMotores||"") ? "IEC" : "NEC", metodoAmp: /^75/.test(v.columnaAmpacidad||"") ? "75" : "90", minMM2: ((CABLE_TABLE.find(r=>r[0]===v.seccionMinima)||[0,0])[1]) };
}
const FP_CIRC = c => c.kind==="motor" ? (+c.fp||0.85) : c.kind==="control" ? 0.88 : (+c.load.fp||0.85);
export const ACC_DEF = () => ({ spd:true, releFase:true, luces:true });

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
  return aplicarTipicos({ id: uidc("L"), kind, tablero, tag:"", application:"otro", desc:"", power:10, powerUnit:"hp", starter:"dol", vfdBrand:"abb", regimen:"continuo", man:{},
    fp:0.85, effPct:90, fu:1, fs:1, cableLength:30, feederAmps:30, cableTag:"", canalizacion:"",
    controlBranches:[{label:"Control (PLC / instrumentación)", breaker:10, va:150},{label:"Ventiladores internos", breaker:6, va:200},{label:"Calefacción interna", breaker:6, va:300},{label:"Luminaria interna", breaker:4, va:60}] });
}
/* cargas de un tablero: las asignadas + (tablero de distribución) un alimentador por cada tablero aguas abajo */
export function cargasDe(p, t, _depth=0){
  const d = datos(p), ids = new Set(tableros(p).map(x=>x.id));
  const def = tf(p);
  const propias = d.cargas.filter(l=> ids.has(l.tablero) ? l.tablero===t.id : t.id===def.id);
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
  const circuits = [];
  loads.forEach((l, i)=>{
    let c;
    if(l.kind==="general"){
      // carga general en kW con su FDP (p.ej. circuitos de iluminación / tomacorrientes / reserva), mono o trifásica
      const fp = +l.fp||0.9, kw = +l.power||0, fases = +l.fases===1 ? 1 : 3;
      const kva = kw/fp, amps = fases===1 ? kva*1000/g.voltage : kva*1000/(Math.sqrt(3)*g.voltage);
      c = computeCircuit(Object.assign({}, l, { kind:"feeder", feederAmps: Math.max(0.1, amps) }), i, g);
      if(c){ c.esGeneral = true; c.installedKVA = kva; c.demandKVA = kva*(c.fu)*(c.fs); c.installedCurrent = amps; c.powerKWelec = kw; c.fp = fp; c.fases = fases; c.title = l.desc || "Carga general"; }
    } else {
      const gl = l.kind==="control" && l.secV ? Object.assign({}, g, { ctrlVoltage: String(l.secV) }) : g;
      c = computeCircuit(l, i, gl);
    }
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
    const dv = ct.ioDiscreto || "120 VAC";
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
        const ali = analog ? (/loop/i.test(i.alimentacion||"") ? `Loop powered, 2 hilos (24 VDC desde ${limpieza ? ct.tagLimpieza : plc})` : `Externa, 4 hilos (${(i.alimentacion||"120 VAC").replace(/\s*\/.*$/,"")}) – salida 4-20 mA`) : (salida ? `${(i.alimentacion||"120 VAC").replace(/\s*\/.*$/,"")}` : alimDisc);
        const base = { tag, descripcion: i.servicio || i.descripcion || "", tipo, voltaje: analog ? "4-20 mA" : (salida ? (i.alimentacion||"120 VAC").replace(/\s*\/.*$/,"") : dv), rangoMin: rmin||"", rangoMax: rmax||"", unidad: analog ? (i.unidad||"") : "", alimentacion: ali, origen:"instrumento" };
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

/* ---------------- circuitos de un tablero de control ---------------- */
export function derivarCircuitosControl(p, t){
  // Criterio usual de unifilar de control: 24 VDC con portafusibles de 1 A por
  // derivación; 120 VAC con ITM 2x2 A por instrumento / circuito; 220 VAC para ventilación, luminaria y
  // tomacorriente con diferencial de 30 mA.
  t = t || tc(p);
  const inst = instrumentos(p).filter(i=>tableroDeInstrumento(p, i).id===t.id);
  const enLimpieza = i => t.controladorLimpieza && (/^PD(I)?T$/.test(tipoInstrumento(i.tag)) || /^XV$|^SV$/.test(tipoInstrumento(i.tag)));
  const hayAO = datos(p).cargas.some(l=>l.kind==="motor" && l.starter==="vfd" && t.vfdMando!=="red") || inst.some(i=>esAnalogico(i) && esSalida(i));
  const c24 = [], c120 = [], c220 = [];
  c24.push({ descripcion:"Alimentación al PLC", proteccion:1 });
  const ana = inst.filter(i=>esAnalogico(i) && !enLimpieza(i));
  if(ana.length) c24.push({ descripcion:"Alimentación a las entradas analógicas", proteccion:1 });
  if(hayAO) c24.push({ descripcion:"Alimentación a las salidas analógicas", proteccion:1 });
  if(t.hmi) c24.push({ descripcion:"Alimentación al HMI", proteccion:1 });
  if(t.router) c24.push({ descripcion:"Alimentación al router", proteccion:1 });
  if(t.switch) c24.push({ descripcion:"Alimentación al switch", proteccion:1 });
  for(const i of inst){
    if(enLimpieza(i)) continue;
    if(/24\s*V/i.test(i.alimentacion||"") || (esAnalogico(i) && /loop/i.test(i.alimentacion||""))) for(const tg of expandirTag(i.tag)) c24.push({ descripcion:"Alimentación al "+(i.descripcion||"instrumento").toLowerCase()+" "+tg, proteccion:1 });
  }
  c24.push({ descripcion:"Reserva", proteccion:1 }, { descripcion:"Reserva", proteccion:1 });
  c120.push({ descripcion:"Fuente de 24 VDC", proteccion:10, potencia:240 });
  c120.push({ descripcion:"Alimentación a entradas digitales", proteccion:2, potencia:10 });
  c120.push({ descripcion:"Alimentación a salidas digitales", proteccion:2, potencia:16 });
  for(const i of inst){
    if(enLimpieza(i) || esSalida(i)) continue;
    if(/120/.test(i.alimentacion||"")) for(const tg of expandirTag(i.tag)) c120.push({ descripcion:"Alimentación al "+(i.descripcion||"instrumento").toLowerCase()+" "+tg, proteccion:2, potencia:8 });
  }
  if(t.controladorLimpieza) c120.push({ descripcion:"Alimentación al controlador de limpieza", proteccion:2, potencia:30 });
  c120.push({ descripcion:"Reserva", proteccion:2 }, { descripcion:"Reserva", proteccion:2 });
  c220.push({ descripcion:"Ventilación", proteccion:4, potencia:200 });
  c220.push({ descripcion:"Luminaria interna", proteccion:6, potencia:60 });
  c220.push({ descripcion:"Alimentación al tomacorriente", proteccion:4, diferencial:true });
  const add = (arr, barra, cable)=>arr.map((c,i)=>Object.assign({ barra, circuito:"C"+(i+1), cable }, c));
  return [
    ...add(c24, "24 VDC", "2C#14AWG+14AWG(T)"),
    ...add(c120, "120 VAC", "2C#14AWG+14AWG(T)"),
    ...add(c220, "220 VAC", "2C#14AWG+14AWG(T)"),
  ];
}
export function circuitosControl(p, t){ t = t || tc(p); const d = datos(p); const c = d.circuitosCtl[t.id]; return c && c.length ? c : derivarCircuitosControl(p, t); }

/* ---------------- equipos eléctricos ---------------- */
export function equiposElectricos(p){
  const d = datos(p), v = valoresDiseno(p);
  const sist = sistemaNombre(p).toUpperCase() + (sistemaTag(p) ? "\n"+sistemaTag(p) : "");
  const filas = [];
  const fuerza = `${v.tension} Vac / ${v.frecuencia} Hz / 3F`, ctrl = `${v.tensionControl} Vac / ${v.frecuencia} Hz / 1F`;
  for(const t of tableros(p)){
    filas.push({ sistema:sist, cant:1, tag:t.tag, descripcion:(t.nombre||TIPOS_TABLERO[t.tipo].nombre).toUpperCase(), marca:t.marca||"", modelo:t.modelo||"", tension: t.tipo==="control" ? ctrl : fuerza, plano:"", notas: "", _doc: t.tipo==="control" ? "ins-unifilar-tc" : "ele-unifilar" });
  }
  if(d.equiposCfg.incluirEquipos) for(const calc of calcularTodos(p)) for(const c of calc.circuits){
    if(c.kind!=="motor") continue;
    const l = c.load;
    filas.push({ sistema:sist, cant:1, tag:l.tag||("M"+c.tag), descripcion:"MOTOR "+(l.desc||"").toUpperCase()+" · "+l.power+" "+(l.powerUnit==="hp"?"HP":"kW"), marca:"", modelo:"", tension:fuerza, plano:"", notas:"Tablero "+calc.tablero.tag, _doc:"ele-unifilar" });
    const vfd = c.items.find(it=>/^VDF/.test(it.devtag||""));
    if(vfd) filas.push({ sistema:sist, cant:1, tag:(l.tag||c.tag)+"-VFD", descripcion:"VARIADOR DE FRECUENCIA "+(l.desc||"").toUpperCase(), marca:/Allen|PowerFlex/.test(vfd.model)?"Allen-Bradley":"ABB", modelo:vfd.model.replace(/^ABB /,""), tension:fuerza, plano:"", notas:"Tablero "+calc.tablero.tag, _doc:"ele-unifilar" });
  }
  return filas;
}

/* ---------------- utilidades ---------------- */
export function r2(x, n=2){ if(x==null || x==="" || isNaN(x)) return ""; const k = Math.pow(10,n); return Math.round(x*k)/k; }
export function guardar(){ save(); }
export { APPLICATIONS, egcFor, miguelezCableFor };

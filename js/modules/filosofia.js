/* Ingenia — documentos de texto generados desde los datos del proyecto:
   - Filosofía de control: estructura de datos (datos(p).filosofia) que se arma sola con el proyecto (cargas,
     instrumentos, listado I/O, tableros de control, criterios de diseño y documentos) y que el usuario solo revisa.
     Lo editado se guarda como diferencias sobre lo automático, fila por fila con un id estable: si se agrega o se quita
     un motor / instrumento, sus alarmas, interlocks y pasos de secuencia aparecen o desaparecen solos, salvo lo editado.
   - Típico de montaje de instrumentos (recomendaciones de montaje en campo por tipo de instrumento).
   Son borradores técnicos de partida: setpoints, retardos y secuencias finales se validan con Procesos y fabricantes. */
import { datos, instrumentos, tablerosControl, tablerosPotencia, tipoInstrumento, esAnalogico, esSalida, expandirTag, tf, tc, tableroPorId,
  esControl, sistemaNombre, sistemaTag, derivarIO, uidc, ipRecomendado, APPLICATIONS } from "../datos.js";
import { valoresDiseno, tensionControlTxt, tensionEstabilizada } from "./criterios.js";
import { entregable } from "../catalog.js";

/* ============ estructura guardada ============
   datos(p).filosofia = { v:2,
     textos: { [clave]: texto },        // reemplaza el texto automático. Una línea = un párrafo; «- » viñeta; «  - » sub-viñeta;
                                        // «# » subtítulo; «-» solo = sección vacía
     areas: null | [{ nombre, equipos:[{ descripcion, tag }] }],               // alcance (null = automático)
     tablas: { [tabla]: { ed:{ [id]:{ campo:valor } }, quitar:[id | "*"], extra:[fila], orden:[id] } } }
   Tablas y campos: TABLAS_FIL. Textos: TEXTOS_FIL. */
export const TEXTOS_FIL = { introduccion:"Introducción", objetivos:"Objetivos", referencias:"Referencias", alcance:"Alcance", exclusiones:"Exclusiones del alcance",
  normas:"Normas y estándares", condiciones:"Condiciones generales del sitio", arquitectura:"Arquitectura de control", operacion:"Descripción de la operación (introducción)",
  condicionesOperacion:"Condiciones de operación", interlocks:"Interlocks (definiciones)", modos:"Modos de operación", monitoreo:"Monitoreo y registro",
  alarmas:"Alarmas y parámetros de operación (introducción)", supervision:"Comunicación y supervisión", notas:"Notas" };
export const TABLAS_FIL = {
  subsistemas: { titulo:"Descripción general del sistema", campos:{ nombre:"Nombre", descripcion:"Descripción", alimentacion:"Alimentación y control", modos:"Modos de operación", caracteristicas:"Características" } },
  etapas: { titulo:"Etapas de la operación", campos:{ titulo:"Etapa", texto:"Descripción" } },
  equipos: { titulo:"Lista de equipos generales", campos:{ descripcion:"Equipo", tag:"TAG", caracteristicas:"Características" } },
  instrumentos: { titulo:"Lista de instrumentos", campos:{ descripcion:"Instrumento", servicio:"Servicio", senal:"Tipo de señal", tag:"TAG" } },
  alarmas: { titulo:"Alarmas", campos:{ instrumento:"Instrumento / equipo", senal:"TAG de alarma", descripcion:"Alarma", tipo:"Tipo", setpoint:"Set point", accion:"Acción", prioridad:"Prioridad" } },
  setpoints: { titulo:"Alarmas y set points de proceso", campos:{ tag:"TAG", servicio:"Servicio", rango:"Rango", unidad:"Unidad", sp:"SP", hh:"HH", h:"H", l:"L", ll:"LL" } },
  interlocks: { titulo:"Interlocks", campos:{ tipo:"Tipo", senal:"Señal", servicio:"Servicio", equipo:"Equipo afectado", condicion:"Condición normal", accion:"Acción", valor:"Valor", retardo:"Retardo" } },
  arranque: { titulo:"Secuencia de arranque", campos:{ equipo:"TAG", descripcion:"Equipo", accion:"Acción", confirmacion:"Confirmación", tiempo:"Tiempo de validación", falla:"Ante falla", notas:"Detalle" } },
  parada: { titulo:"Secuencias de parada", campos:{ evento:"Evento", pasos:"Pasos (equipo, acción, retardo)" } },
};
export const TIPOS_ALARMA = ["H","HH","L","LL","falla","estado"];
export const TIPOS_INTERLOCK = ["permisivo","seguridad","proceso"];

export function filosofiaUsuario(p){
  const d = datos(p); const f = d.filosofia = d.filosofia || {};
  if(f.v!==2){
    // migración: «secuencias» (una línea por paso) reemplazaba la secuencia propuesta; «notas» pasa a los textos
    f.textos = f.textos || {}; f.tablas = f.tablas || {};
    const sec = String(f.secuencias||"").split(/\n/).map(s=>s.trim()).filter(Boolean);
    if(sec.length && !f.tablas.arranque) f.tablas.arranque = { quitar:["*"], extra: sec.map(s=>({ id:uidc("u"), equipo:"", descripcion:"", accion:s, confirmacion:"", tiempo:"", falla:"", notas:"" })) };
    if(f.notas && !f.textos.notas) f.textos.notas = f.notas;
    f.secuencias = ""; f.notas = ""; f.v = 2;
  }
  f.textos = f.textos || {}; f.tablas = f.tablas || {}; if(f.areas===undefined) f.areas = null;
  return f;
}

/* ============ utilidades ============ */
const clon = o => o==null ? o : JSON.parse(JSON.stringify(o));
const norm = s => String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const lc1 = s => { s = String(s||""); return /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(s) ? s.charAt(0).toLowerCase()+s.slice(1) : s; };
const uc1 = s => { s = String(s||""); return s.charAt(0).toUpperCase()+s.slice(1); };
const lista = a => { a = a.filter(Boolean); return a.length<2 ? (a[0]||"") : a.slice(0,-1).join(", ")+" y "+a[a.length-1]; };
const potTxt = l => `${l.power} ${l.powerUnit==="hp"?"HP":"kW"}`;
const ARR = { vfd:"variador de frecuencia", ss:"arrancador suave", dol:"arranque directo" };
const APLIC = Object.fromEntries(APPLICATIONS.map(a=>[a.v, a.label]));
const nombreDe = l => l.desc || (l.application && l.application!=="otro" ? APLIC[l.application] : "") || "Equipo";
const rangoTag = tag => { const t = expandirTag(tag); return t.length>1 ? `${t[0]} … ${t[t.length-1]}` : String(tag||""); };
/* texto con formato simple → bloques { p | b | b2 | t } (párrafo, viñeta, sub-viñeta, subtítulo) */
export function bloques(txt){
  const out = [];
  for(const raw of String(txt||"").split(/\n/)){
    const l = raw.replace(/\s+$/, ""); let m;
    if(!l.trim() || l.trim()==="-") continue;
    if((m = l.match(/^\s{2,}[-•·]\s*(.*)$/))) out.push({ b2:m[1] });
    else if((m = l.match(/^[-•·]\s+(.*)$/))) out.push({ b:m[1] });
    else if((m = l.match(/^#\s*(.*)$/))) out.push({ t:m[1] });
    else out.push({ p:l.trim() });
  }
  return out;
}

// orden de arranque: equipos de descarga primero, luego el ventilador / equipo principal (sentido contrario al flujo)
const PRIORIDAD = { "valvula-rotativa":1, "faja-transportadora":1, "bomba-centrifuga":2, "agitador":2, "ventilador-centrifugo":3, "ventilador-axial":3, "compresor-piston":0, "chancadora":4, "molino":4 };
function prio(l){
  if(PRIORIDAD[l.application]!=null) return PRIORIDAD[l.application];
  const t = norm(l.desc);
  return /rotativa|descarga|tornillo|faja|transportador|helicoidal/.test(t) ? 1 : /bomba|agitador/.test(t) ? 2 : /compresor/.test(t) ? 0 : /chancadora|molino/.test(t) ? 4 : 3;
}
const esDescarga = l => prio(l)<=1 && prio(l)>0;
const esVentilador = l => /^ventilador/.test(l.application||"") || /ventilador|extractor/.test(norm(l.desc));

/* ---------- conversión de valores típicos a la unidad del instrumento ---------- */
const UNIDADES = {
  presion: { psi:1, psig:1, bar:1/14.5038, barg:1/14.5038, mbar:68.948, kpa:6.89476, mpa:0.00689476, "kg/cm2":0.070307 },
  dp: { inh2o:1, inwc:1, wc:1, '"wc':1, 'in.wc':1, pulgh2o:1, mmh2o:25.4, mmca:25.4, pa:249.089, kpa:0.249089, mbar:2.49089 },
  vib: { "mm/s":1, "in/s":1/25.4, ips:1/25.4 },
  temp: { "°c":1, "ºc":1, c:1, "°f":"F", "ºf":"F", f:"F" },
  part: { "mg/nm3":1, "mg/m3":1 },
  pct: { "%":1 },
};
const redondear = x => { const a = Math.abs(x); return String(a>=10 ? Math.round(x) : a>=1 ? Math.round(x*10)/10 : Math.round(x*100)/100); };
function convertir(v, clase, unidad){
  if(v==null || v==="") return "";
  const u = norm(unidad).replace(/\s+/g, "").replace(/²/g, "2").replace(/³/g, "3").replace(/₂/g, "2");
  const f = (UNIDADES[clase]||{})[u]; if(f==null) return "";
  return redondear(f==="F" ? v*9/5+32 : v*f);
}
const claseUnidad = u => { for(const c in UNIDADES) if(convertir(1, c, u)!=="") return c; return ""; };

/* ---------- reglas por tipo de instrumento (ISA 5.1) ---------- */
const VARIABLE = { P:"presión", PD:"presión diferencial", F:"flujo", L:"nivel", T:"temperatura", A:"análisis", Z:"posición", S:"velocidad", V:"vibración", W:"peso", D:"densidad", H:"mando manual" };
const tipoVar = t => t.replace(/(I?C|I?T|I|E|S[HL]{0,2})$/, "") || t;
const alarmaTag = (tag, nivel) => `${tag}_${tipoVar(tipoInstrumento(tag))}A${nivel}`;
function reglaInstrumento(i, tag, cx){
  const t = tipoInstrumento(tag), v = tipoVar(t), an = esAnalogico(i);
  const serv = i.servicio || i.descripcion || tag, servL = lc1(serv);
  const m = cx.equipoDe(i), mTxt = m ? `${lc1(nombreDe(m))} ${m.tag}` : "";
  const prin = cx.principales.map(l=>l.tag).join(", ");
  const r = { niveles:[], tip:{}, al:{}, il:null, clase: claseUnidad(i.unidad), equipo: m ? m.tag : "" };
  const trip = (nivel, ret) => m ? { tipo:"proceso", nivel, condicion:`${uc1(VARIABLE[v]||"Variable")} de ${mTxt} bajo el valor ${nivel}`, accion:`Parada de ${m.tag} y secuencia de parada (ver 9.5)`, retardo:ret } : null;
  if(an){
    if(/^PD/.test(v)){
      r.niveles = ["H","HH"]; if(cx.colector) r.tip = { sp:4, h:5, hh:6, fin:2 }; r.clase = r.clase || "dp";
      const obj = servL.replace(/^presi[oó]n diferencial\s*(de|en|del)?\s*/i, "") || "el colector";
      r.al.H = { desc:`Presión diferencial alta en ${obj}`, accion: cx.limpieza ? "Alarma en HMI; el controlador de limpieza mantiene los pulsos de limpieza" : "Alarma en HMI" };
      r.al.HH = { desc:`Presión diferencial muy alta en ${obj}`, accion: cx.colector ? "Alarma de presión alta persistente (mangas saturadas): requiere intervención del operador" : "Alarma en HMI; requiere intervención del operador" };
      r.il = { tipo:"proceso", nivel:"HH", condicion:"Presión diferencial dentro del rango de operación", accion: cx.limpieza ? "Alarma; no detiene los equipos (la limpieza la gobierna el controlador)" : "Alarma; intervención del operador", retardo:"Ton 10 s" };
    } else if(v==="P"){
      const aire = /aire/i.test(serv);
      r.niveles = ["L","H"]; if(aire){ r.tip = { sp:90, h:110, l:80 }; r.clase = r.clase || "presion"; }
      r.al.L = { desc:`Baja presión en ${servL.replace(/^presi[oó]n (en|de)\s+/i, "")}`, accion: aire ? (cx.limpieza ? "Inhibe la limpieza de mangas e impide el arranque del sistema" : "Impide el arranque del sistema") : "Alarma en HMI" };
      r.al.H = { desc:`Alta presión en ${servL.replace(/^presi[oó]n (en|de)\s+/i, "")}`, accion:"Alarma en HMI" };
      if(aire) r.il = { tipo:"permisivo", nivel:"L", condicion:`Aire comprimido disponible: presión en ${tag} sobre el valor L`, accion: cx.limpieza ? "Impide el arranque; en marcha inhibe la limpieza hasta recuperar la presión" : "Impide el arranque", retardo:"Ton 5 s" };
    } else if(v==="V"){
      r.niveles = ["H","HH"]; r.tip = { h:7.1, hh:9 }; r.clase = r.clase || "vib";
      r.al.H = { desc:`Vibración alta en ${mTxt || servL}`, accion:"Alarma en HMI" };
      r.al.HH = { desc:`Vibración muy alta en ${mTxt || servL}`, accion: m ? `Disparo de ${m.tag} (ver 9.5)` : "Alarma en HMI" };
      r.il = trip("HH", "Ton 5 s");
    } else if(v==="T"){
      r.niveles = ["H","HH"]; if(m || /chumacera|rodamiento|descanso|cojinete|devanado/i.test(serv)){ r.tip = { h:80, hh:90 }; r.clase = r.clase || "temp"; }
      r.al.H = { desc:`Temperatura alta en ${mTxt || servL}`, accion:"Alarma en HMI" };
      r.al.HH = { desc:`Temperatura muy alta en ${mTxt || servL}`, accion: m ? `Disparo de ${m.tag} (ver 9.5)` : "Alarma en HMI" };
      r.il = trip("HH", "Ton 5 s");
    } else if(v==="A" && (cx.colector || /manga|polvo|part/i.test(serv))){
      r.niveles = ["H","HH"]; r.tip = r.clase==="pct" ? { h:70, hh:85 } : { h:40, hh:50 };
      r.al.H = { desc:"Nivel alto de partículas (posible manga rota)", accion:"Alarma en HMI" };
      r.al.HH = { desc:"Nivel muy alto de partículas: manga rota", accion: prin ? `Parada de ${prin} (ver 9.5)` : "Alarma en HMI" };
      if(prin) r.il = { tipo:"proceso", nivel:"HH", condicion:"Emisión de partículas bajo el valor HH (mangas sin rotura)", accion:`Parada de ${prin} y secuencia de parada (ver 9.5)`, retardo:"Ton 5 s", equipo:prin };
    } else {
      r.niveles = ["L","H"]; const vv = uc1(VARIABLE[v]||"Variable");
      r.al.L = { desc:`${vv} baja en ${servL}`, accion:"Alarma en HMI" }; r.al.H = { desc:`${vv} alta en ${servL}`, accion:"Alarma en HMI" };
    }
    return r;
  }
  // señales discretas
  const nv = (t.match(/S(HH|LL|H|L)$/)||[])[1] || (v==="S" ? "L" : "");
  const yaDice = re => re.test(serv);
  if(v==="L" && /^H/.test(nv)){
    r.al[nv] = { desc: yaDice(/nivel/i) ? serv : `Nivel alto en ${servL}`, accion: cx.colector && prin ? `Parada de ${prin}; la descarga continúa hasta vaciar la tolva (ver 9.5)` : "Detiene la alimentación al equipo (ver 9.5)", sp:"Contacto activo" };
    r.il = { tipo:"permisivo", nivel:nv, condicion:`Sin ${yaDice(/nivel/i) ? lc1(serv) : "nivel alto en "+servL} (${tag} en estado normal)`, accion: cx.colector && prin ? `Impide el arranque; en marcha detiene ${prin} y mantiene la descarga (ver 9.5)` : "Impide el arranque; en marcha detiene la alimentación", retardo:"Ton 5 s" };
  } else if(v==="L" && /^L/.test(nv)){
    r.al[nv] = { desc: yaDice(/nivel/i) ? serv : `Nivel bajo en ${servL}`, accion: m ? `Parada de ${m.tag} (operación en vacío)` : "Alarma en HMI", sp:"Contacto activo" };
    r.il = { tipo:"proceso", nivel:nv, condicion:`Nivel sobre el mínimo (${tag})`, accion: m ? `Parada de ${m.tag}` : "Alarma", retardo:"Ton 5 s" };
  } else if(v==="S"){
    const desc = yaDice(/velocidad/i) ? serv : `Velocidad cero en ${mTxt || servL}`;
    r.al[nv||"L"] = { desc, accion: m ? `Parada de ${m.tag} y de los equipos aguas arriba (ver 9.5)` : "Alarma en HMI", sp:"Sin pulsos de giro" };
    r.il = { tipo:"proceso", nivel:nv||"L", condicion:`Giro confirmado (${tag})`, accion: m ? `Parada de ${m.tag} por falla de giro (ver 9.5)` : "Alarma", retardo:"Ton 30 s" };
  } else if(v==="Z" || v==="H"){
    r.al.estado = { desc: serv || (v==="H" ? "Parada de emergencia por cable" : `Desalineamiento de ${mTxt}`), accion: m ? `Parada inmediata de ${m.tag}` : "Parada inmediata del equipo", sp:"Contacto activo" };
    r.il = { tipo:"seguridad", nivel:"estado", condicion:`${uc1(serv)}: estado normal (${tag})`, accion: m ? `Parada inmediata de ${m.tag}; requiere rearme` : "Parada inmediata; requiere rearme", retardo: v==="Z" ? "Ton 3 s" : "—" };
  } else if(nv){
    const vv = uc1(VARIABLE[v]||"Variable");
    r.al[nv] = { desc: `${vv} ${/^H/.test(nv)?"alta":"baja"} en ${servL}`, accion: m ? `Parada de ${m.tag}` : "Alarma en HMI", sp:"Contacto activo" };
    if(v==="P" && /aire/i.test(serv) && /^L/.test(nv)) r.il = { tipo:"permisivo", nivel:nv, condicion:`Aire comprimido disponible (${tag})`, accion:"Impide el arranque", retardo:"Ton 5 s" };
    else if(m) r.il = { tipo:"proceso", nivel:nv, condicion:`${vv} normal (${tag})`, accion:`Parada de ${m.tag}`, retardo:"Ton 5 s" };
  } else r.al.estado = { desc: serv, accion:"Alarma en HMI", sp:"Contacto activo" };
  return r;
}

/* ============ combinación automático + usuario ============ */
function mezclar(auto, u){
  u = u || {};
  const ed = u.ed || {}, q = new Set(u.quitar||[]), todo = q.has("*");
  let filas = auto.filter(f=>!todo && !q.has(f.id)).map(f=>Object.assign(clon(f), clon(ed[f.id]||{}), { _auto:true, _ed: !!ed[f.id] }));
  filas = filas.concat((u.extra||[]).map(f=>Object.assign(clon(f), { _auto:false, _ed:false })));
  const ord = u.orden || [];
  if(ord.length){
    const pos = new Map(ord.map((id,k)=>[id,k])); let prev = -1, eps = 0;
    const key = new Map(filas.map(f=>{ if(pos.has(f.id)){ prev = pos.get(f.id); eps = 0; return [f, prev]; } eps += 1e-3; return [f, prev+eps]; }));
    filas = filas.map((f,k)=>[f,k]).sort((a,b)=>(key.get(a[0])-key.get(b[0])) || (a[1]-b[1])).map(x=>x[0]);
  }
  return filas;
}
const igual = (a, b) => JSON.stringify(a??"")===JSON.stringify(b??"");
/* guarda una tabla editada (filas completas, en su orden) como diferencias sobre lo automático */
export function guardarTabla(p, nombre, filas){
  const u = filosofiaUsuario(p), prev = u.tablas[nombre] || {};
  const auto = construir(p).auto.tablas[nombre] || [], A = new Map(auto.map(f=>[f.id, f]));
  const t = { ed:{}, quitar:(prev.quitar||[]).includes("*") ? ["*"] : [], extra:[], orden:[] };
  for(const f of filas){
    if(!f.id) f.id = uidc("u");
    const a = A.get(f.id), lim = Object.fromEntries(Object.entries(f).filter(([k])=>k[0]!=="_"));
    if(a){ const d = {}; for(const k in lim) if(k!=="id" && !igual(lim[k], a[k])) d[k] = lim[k]; if(Object.keys(d).length) t.ed[f.id] = d; f._auto = true; f._ed = !!t.ed[f.id]; }
    else { t.extra.push(lim); f._auto = false; }
    t.orden.push(f.id);
  }
  const ids = new Set(filas.map(f=>f.id));
  if(!t.quitar.includes("*")) for(const a of auto) if(!ids.has(a.id)) t.quitar.push(a.id);
  // ediciones / quitados de filas que hoy no existen (p. ej. un instrumento borrado) se conservan por si vuelve
  for(const [id, d] of Object.entries(prev.ed||{})) if(!A.has(id) && !(id in t.ed)) t.ed[id] = d;
  for(const id of prev.quitar||[]) if(id!=="*" && !A.has(id) && !t.quitar.includes(id)) t.quitar.push(id);
  const natural = mezclar(auto, Object.assign({}, t, { orden:[] })).map(f=>f.id);
  if(igual(natural, t.orden)) t.orden = [];
  if(!Object.keys(t.ed).length && !t.quitar.length && !t.extra.length && !t.orden.length) delete u.tablas[nombre]; else u.tablas[nombre] = t;
  return filas;
}
export function guardarTexto(p, clave, valor){
  const u = filosofiaUsuario(p), a = construir(p).auto.textos[clave] ?? "";
  const v = String(valor??"").replace(/\r/g, "");
  if(!v.trim() || v.trim()===String(a).trim()) delete u.textos[clave]; else u.textos[clave] = v;
}
export function guardarAreas(p, areas){
  const u = filosofiaUsuario(p), a = construir(p).auto.areas;
  const lim = (areas||[]).map(x=>({ nombre:x.nombre||"", equipos:(x.equipos||[]).map(e=>({ descripcion:e.descripcion||"", tag:e.tag||"" })) }));
  u.areas = areas==null || igual(lim, a) ? null : lim;
}

/* ============ armado automático desde el proyecto ============ */
function contexto(p){
  const d = datos(p), v = valoresDiseno(p), pr = d.proceso || {};
  const motores = d.cargas.filter(l=>l.kind==="motor");
  const orden = motores.map((l,k)=>[l,k]).sort((a,b)=>(prio(a[0])-prio(b[0])) || (a[1]-b[1])).map(x=>x[0]);
  const inst = instrumentos(p).filter(i=>i.tag);
  const ctl = tablerosControl(p).length ? tablerosControl(p) : [tc(p)];
  const io = d["ins-io"] && d["ins-io"].length ? d["ins-io"] : derivarIO(p);
  const valvulas = inst.filter(esSalida);
  const limp = ctl.filter(t=>t.controladorLimpieza);
  const sist = sistemaNombre(p) || "", sTag = sistemaTag(p);
  const textoProy = norm([sist, pr.descripcion, p.descripcion, p.nombre].join(" "));
  const colector = /polvo|colector|manga|filtro/.test(textoProy) || (limp.length>0 && motores.some(esVentilador));
  const vent = orden.filter(esVentilador);
  const cx = { d, v, pr, motores, orden, inst, ctl, io, valvulas, limp, sist, sTag, colector, limpieza: limp.length>0 || (colector && valvulas.length>0),
    principales: vent.length ? vent : orden.filter(l=>!esDescarga(l)) };
  // motor asociado a un instrumento: campo «equipo» o palabras comunes del servicio con el nombre del motor
  // (los números cuentan como palabra: «bomba 4» ≠ «bomba 3»); si hay empate no se asocia
  const pal = l => [...new Set(norm(`${l.desc||""} ${APLIC[l.application]||""}`).split(/[^a-z0-9]+/).filter(w=>(w.length>3 || /^\d+$/.test(w)) && !["motor","equipo","generico","otro"].includes(w)))];
  cx.equipoDe = i => {
    if(i.equipo){ const m = motores.find(l=>l.tag && l.tag===i.equipo); if(m) return m; }
    const pals = new Set(norm(`${i.servicio||""} ${i.descripcion||""}`).split(/[^a-z0-9]+/)); let best = null, bs = 0, empate = false;
    for(const l of motores){ const s = pal(l).filter(w=>pals.has(w) || [...pals].some(x=>x.length>3 && w.length>3 && x.startsWith(w))).length; if(s>bs){ bs = s; best = l; empate = false; } else if(s && s===bs) empate = true; }
    return empate ? null : best;
  };
  cx.tagsLimpieza = limp.map(t=>t.tagLimpieza).filter(Boolean);
  cx.nombreTag = tag => { const l = motores.find(x=>x.tag===tag); if(l) return `${nombreDe(l)} (${tag})`; if(cx.tagsLimpieza.includes(tag)) return `Controlador de limpieza (${tag})`;
    return /^HS-/.test(tag) ? `Parada de emergencia (${tag})` : /^QG-/.test(tag) ? `Interruptor general (${tag})` : tag; };
  const serv = new Map(); for(const i of inst) for(const t of expandirTag(i.tag)) serv.set(t, i.servicio || i.descripcion || "");
  cx.servicioDe = tag => serv.get(tag) || "";
  return cx;
}

function construir(p){
  const u = filosofiaUsuario(p), cx = contexto(p);
  const { d, v, pr, motores, orden, inst, ctl, io, valvulas, limp, sist, sTag, colector } = cx;
  const auto = { textos:{}, areas:[], tablas:{} }, F = { textos:{}, areas:null, tablas:{}, cx };
  const T = (k, filas) => { auto.tablas[k] = filas; return F.tablas[k] = mezclar(filas, u.tablas[k]); };
  const sistTxt = sist ? lc1(sist) : "sistema", sistDel = sist ? `${sistTxt}${sTag?` (${sTag})`:""}` : "sistema";
  const ctlTags = ctl.map(t=>t.tag).join(", ");
  const hmi = ctl.some(t=>t.hmi), red = (ctl.find(t=>t.redExterna)||{}).redExterna || "";
  const limpTxt = cx.tagsLimpieza.join(", ");
  const valvTxt = valvulas.map(i=>rangoTag(i.tag)).join(", "), nValv = valvulas.reduce((s,i)=>s+expandirTag(i.tag).length, 0);
  const descarga = orden.filter(esDescarga), prinTags = cx.principales.map(l=>l.tag).join(", ");

  /* ---- por instrumento ---- */
  const porTag = [];
  for(const i of inst) if(!esSalida(i)) for(const tag of expandirTag(i.tag)) if(tag) porTag.push({ i, tag, r: reglaInstrumento(i, tag, cx) });

  /* ---- set points (instrumentos analógicos) ---- */
  const sps = T("setpoints", porTag.filter(x=>esAnalogico(x.i)).map(({ i, tag, r })=>{
    const val = k => r.niveles.includes(k.toUpperCase()) ? convertir(r.tip[k], r.clase, i.unidad) : "-";
    return { id:"sp:"+tag, tag, servicio: i.servicio||i.descripcion||"", rango: i.rango||"", unidad: i.unidad||"", sp: r.tip.sp!=null ? convertir(r.tip.sp, r.clase, i.unidad) : "-", hh:val("hh"), h:val("h"), l:val("l"), ll:val("ll") };
  }));
  const spDe = tag => sps.find(s=>s.tag===tag);
  const valorTxt = (tag, nivel) => {
    const s = spDe(tag); if(!s) return "";
    const x = s[String(nivel).toLowerCase()]; if(x==="-") return "";
    return x==null || x==="" ? "a definir" : `${/^H/.test(nivel)?"≥":"≤"} ${x} ${s.unidad||""}`.trim();
  };

  /* ---- señales del tablero (listado I/O) ---- */
  const senal = suf => io.filter(f=>f.origen==="tablero" && new RegExp("_"+suf+"$").test(f.senal||""));
  const estops = senal("ESTOP"), trips = senal("TRIP"), locs = senal("REM").length ? senal("REM") : senal("LOC");

  /* ---- alarmas ---- */
  const prioridad = (tipo, accion) => /parada|disparo|detiene/i.test(accion||"") || /HH|LL|falla/.test(tipo) ? "Alta" : /^[HL]$/.test(tipo) ? "Media" : "Baja";
  const giroDe = l => porTag.filter(x=>tipoVar(tipoInstrumento(x.tag))==="S" && !esAnalogico(x.i) && cx.equipoDe(x.i)===l).map(x=>x.tag);
  const al = [];
  for(const e of estops) al.push({ id:"al:"+e.senal, instrumento:e.tag, senal:e.senal, descripcion:`Parada de emergencia activada (${e.tag.replace(/^HS-/, "")})`, tipo:"estado", setpoint:"Contacto abierto", accion:"Parada inmediata de todos los equipos (por cableado); requiere rearme", prioridad:"Alta" });
  for(const e of trips) al.push({ id:"al:"+e.senal, instrumento:e.tag, senal:e.senal, descripcion:`Disparo del interruptor general (${e.tag.replace(/^QG-/, "")})`, tipo:"falla", setpoint:"Contacto activo", accion:"Parada de los equipos alimentados (ver 9.5)", prioridad:"Alta" });
  for(const l of orden){
    const t = l.tag || "M", g = giroDe(l);
    al.push({ id:`al:${l.id}:falla`, instrumento:t, senal:t+"_FAULT", descripcion:`Falla ${l.starter==="vfd"?"del variador de frecuencia":l.starter==="ss"?"del arrancador suave":"del arranque directo (guardamotor / relé de sobrecarga)"} de ${lc1(nombreDe(l))}`, tipo:"falla", setpoint:"Contacto activo", accion:`Parada de ${t} y secuencia de parada (ver 9.5)`, prioridad:"Alta" });
    al.push({ id:`al:${l.id}:arranque`, instrumento:t, senal:t+"_FST", descripcion:`Falla de arranque de ${lc1(nombreDe(l))} (sin confirmación de marcha${g.length?" / giro":""})`, tipo:"falla", setpoint:`TON ${g.length?30:10} s`, accion:"Detiene el equipo; la secuencia no continúa", prioridad:"Alta" });
  }
  for(const { i, tag, r } of porTag) for(const nivel of Object.keys(r.al)){
    const a = r.al[nivel], tipo = nivel==="estado" ? "estado" : nivel;
    al.push({ id:`al:${tag}:${nivel}`, instrumento:tag, senal: nivel==="estado" ? `${tag}_${tipoVar(tipoInstrumento(tag))}A` : alarmaTag(tag, nivel), descripcion:a.desc, tipo,
      setpoint: a.sp || valorTxt(tag, nivel) || "a definir", accion:a.accion, prioridad: prioridad(tipo, a.accion) });
  }
  const alarmas = T("alarmas", al);

  /* ---- interlocks ---- */
  const il = [];
  if(motores.length){
    if(estops.length) for(const e of estops) il.push({ id:"il:"+e.senal, tipo:"seguridad", senal:e.senal, servicio:"Parada de emergencia", equipo: orden.map(l=>l.tag).join(", "), condicion:"Parada de emergencia no activada (pulsadores liberados y rearmados)", accion:"Parada inmediata de todos los equipos; requiere rearme local", valor:"Contacto abierto", retardo:"—" });
    else il.push({ id:"il:estop", tipo:"seguridad", senal:"ESTOP", servicio:"Parada de emergencia", equipo: orden.map(l=>l.tag).join(", "), condicion:"Parada de emergencia no activada (pulsadores liberados y rearmados)", accion:"Parada inmediata de todos los equipos; requiere rearme local", valor:"Contacto abierto", retardo:"—" });
  }
  for(const l of orden){
    const t = l.tag || "M";
    il.push({ id:`il:${l.id}:falla`, tipo:"seguridad", senal:t+"_FAULT", servicio:`Falla de ${ARR[l.starter]||"arrancador"} de ${lc1(nombreDe(l))}`, equipo:t, condicion:`Sin falla de ${ARR[l.starter]||"arrancador"} de ${t}`, accion:`Parada inmediata de ${t} y secuencia de parada (ver 9.5)`, valor:"Contacto activo", retardo:"—" });
  }
  for(const { tag, r } of porTag) if(r.il && r.il.tipo==="seguridad") il.push(ilDe(tag, r));
  for(const e of locs) il.push({ id:"il:"+e.senal, tipo:"permisivo", senal:e.senal, servicio:"Selector local / remoto", equipo: orden.map(l=>l.tag).join(", "), condicion:"Selector local / remoto en Remoto (mando desde HMI / sala de control)", accion:"En Local solo se permite el mando desde las botoneras a pie de equipo", valor:"Remoto", retardo:"—" });
  for(const l of orden) if(l.starter==="vfd") il.push({ id:`il:${l.id}:listo`, tipo:"permisivo", senal:(l.tag||"M")+"_READY", servicio:`Variador de ${lc1(nombreDe(l))} listo`, equipo:l.tag, condicion:`Variador de ${l.tag} listo (sin falla y habilitado)`, accion:`Impide el arranque de ${l.tag}`, valor:"Contacto activo", retardo:"—" });
  for(const { tag, r } of porTag) if(r.il && r.il.tipo==="permisivo") il.push(ilDe(tag, r));
  for(const { tag, r } of porTag) if(r.il && r.il.tipo==="proceso") il.push(ilDe(tag, r));
  function ilDe(tag, r){
    const x = r.il, nivel = x.nivel, s = porTag.find(y=>y.tag===tag);
    return { id:`il:${tag}:${nivel}`, tipo:x.tipo, senal: nivel==="estado" ? `${tag}_${tipoVar(tipoInstrumento(tag))}A` : alarmaTag(tag, nivel), servicio: s.i.servicio||s.i.descripcion||"", equipo: x.equipo || r.equipo || "",
      condicion:x.condicion, accion:x.accion, valor: (r.al[nivel] && r.al[nivel].sp) || valorTxt(tag, nivel) || "a definir", retardo:x.retardo };
  }
  const interlocks = T("interlocks", il);

  /* ---- secuencia de arranque ---- */
  const pd = porTag.filter(x=>/^PD/.test(tipoVar(tipoInstrumento(x.tag))) && esAnalogico(x.i));
  const aire = porTag.filter(x=>tipoVar(tipoInstrumento(x.tag))==="P" && /aire/i.test(x.i.servicio||"") && esAnalogico(x.i));
  const ar = orden.map(l=>{
    const g = giroDe(l), t = l.tag || "M";
    return { id:"ar:"+l.id, equipo:t, descripcion:nombreDe(l), accion: l.starter==="vfd" ? "Arranque con rampa hasta la velocidad de operación" : l.starter==="ss" ? "Arranque suave" : "Arranque directo",
      confirmacion: `Marcha (${t}_RUN)${g.length?` y giro (${g.join(", ")})`:""}`, tiempo: g.length ? "30 s" : "10 s",
      falla:`Se detiene ${t}, se genera la alarma «Falla de arranque» y la secuencia no continúa`, notas:"" };
  });
  if(cx.limpieza){
    const s0 = pd[0] && spDe(pd[0].tag), u0 = s0 ? s0.unidad : "";
    const ini = s0 && s0.sp && s0.sp!=="-" ? `${s0.sp} ${u0}`.trim() : "el valor de inicio";
    const fin = pd[0] && pd[0].r.tip.fin!=null && convertir(pd[0].r.tip.fin, pd[0].r.clase, u0) ? `${convertir(pd[0].r.tip.fin, pd[0].r.clase, u0)} ${u0}`.trim() : "el valor de fin";
    const pl = aire.length && valorTxt(aire[0].tag, "L");
    ar.push({ id:"ar:limpieza", equipo: limpTxt || "Controlador de limpieza", descripcion:"Controlador de limpieza", accion:"Habilitación de la limpieza de mangas (por ΔP o por temporizador)",
      confirmacion: `${prinTags ? prinTags+" en servicio" : "Equipos en servicio"}${aire.length?` y aire comprimido disponible (${aire.map(x=>x.tag).join(", ")})`:""}`, tiempo:"—",
      falla: aire.length ? `Si la presión de aire es baja (${aire.map(x=>x.tag).join(", ")}${pl && pl!=="a definir" ? " "+pl.replace("≤","<") : ""}), se inhibe la limpieza hasta recuperarla` : "Alarma en HMI",
      notas:`El controlador mide la presión diferencial${pd.length?` con ${pd.map(x=>x.tag).join(", ")}`:""}: inicia la limpieza cuando ΔP ≥ ${ini} y la detiene cuando ΔP ≤ ${fin} (valores ajustables en campo); ejecuta pulsos secuenciales sobre las válvulas solenoides${valvTxt?` ${valvTxt}`:""} hasta normalizar la ΔP.` });
  }
  const arranque = T("arranque", ar);

  /* ---- secuencias de parada (ante falla / parada intempestiva) ---- */
  const limpPaso = accion => cx.limpieza ? [{ equipo: limpTxt || "Controlador de limpieza", accion, retardo:"0 s" }] : [];
  const pa = [];
  if(orden.length){
    const rev = orden.slice().reverse();
    pa.push({ id:"pa:normal", evento:"Parada normal (comando del operador en modo automático)", pasos: [
      ...rev.filter(l=>!esDescarga(l)).map((l,k)=>({ equipo:l.tag, accion: l.starter==="vfd" ? "Parada con rampa de desaceleración" : "Parada", retardo: k ? "10 s" : "0 s" })),
      ...limpPaso("Ciclo de post-limpieza (duración a definir) y deshabilitación de la limpieza"),
      ...rev.filter(esDescarga).map(l=>({ equipo:l.tag, accion:"Continúa operando para evacuar el material y luego se detiene", retardo:"60 s" })) ] });
    orden.forEach((x, k)=>{
      const arriba = orden.slice(k+1).reverse(), abajo = orden.slice(0, k).reverse();
      const causas = interlocks.filter(i=>i.tipo!=="permisivo" && i.equipo===x.tag && !/_FAULT$|_AAHH$/.test(i.senal) && !/^ESTOP|_ESTOP$/.test(i.senal)).map(i=>i.senal);
      pa.push({ id:"pa:"+x.id, evento:`Parada intempestiva o falla de ${lc1(nombreDe(x))} ${x.tag}${causas.length?` (incluye el disparo por ${causas.join(", ")})`:""}`, pasos: [
        ...arriba.map(l=>({ equipo:l.tag, accion:"Parada inmediata", retardo:"0 s" })),
        ...limpPaso("Deshabilitación de la limpieza"),
        ...abajo.map(l=>({ equipo:l.tag, accion:"Continúa operando para evacuar el material y luego se detiene (posición final: detenida)", retardo:"60 s" })) ] });
    });
    const niv = interlocks.filter(i=>i.tipo==="permisivo" && /^L/.test(tipoVar(tipoInstrumento(i.senal))) && /_LAH/.test(i.senal));
    if(niv.length) pa.push({ id:"pa:nivel", evento:`Activación del interruptor de nivel alto (${niv.map(i=>i.senal.replace(/_LAH+$/, "")).join(", ")})`, pasos: [
      ...rev.filter(l=>!esDescarga(l)).map(l=>({ equipo:l.tag, accion:"Parada inmediata", retardo:"0 s" })),
      ...rev.filter(esDescarga).map(l=>({ equipo:l.tag, accion:"Continúa operando hasta completar la descarga de la tolva y luego se detiene", retardo:"30 s (20 a 40 s)" })),
      ...limpPaso("Deshabilitación de la limpieza") ] });
    for(const i of interlocks.filter(i=>/_AAHH$/.test(i.senal))) pa.push({ id:"pa:"+i.senal, evento:`Detección de manga rota (${i.senal.replace(/_AAHH$/, "")} en muy alto)`, pasos: [
      ...rev.filter(l=>!esDescarga(l)).map(l=>({ equipo:l.tag, accion:"Parada inmediata", retardo:"0 s" })),
      ...limpPaso("Deshabilitación de la limpieza"),
      ...rev.filter(esDescarga).map(l=>({ equipo:l.tag, accion:"Continúa operando para evacuar la tolva y luego se detiene (posición final: detenida)", retardo:"60 s" })) ] });
    pa.push({ id:"pa:estop", evento:"Activación de la parada de emergencia", pasos: [
      ...orden.map(l=>({ equipo:l.tag, accion:"Parada inmediata por cableado (sin rampa)", retardo:"0 s" })),
      ...limpPaso("Parada de la limpieza"),
      { equipo:"—", accion:"El sistema queda bloqueado hasta liberar el pulsador y rearmar (reset) desde el tablero", retardo:"" } ] });
  }
  const parada = T("parada", pa);

  /* ---- equipos e instrumentos ---- */
  const eq = motores.map(l=>({ id:"eq:"+l.id, descripcion:nombreDe(l), tag:l.tag||"", caracteristicas:`${potTxt(l)} · ${ARR[l.starter]||"arranque"} · ${(tableroPorId(p, l.tablero)||tf(p)).tag}` }));
  for(const t of limp) eq.push({ id:"eq:limp:"+t.id, descripcion:"Controlador de limpieza", tag:t.tagLimpieza||"", caracteristicas:`${tensionEstabilizada(v)}; gobierna ${nValv||"las"} válvulas solenoides; ΔP 4-20 mA al PLC ${t.tag}` });
  for(const i of valvulas) eq.push({ id:"eq:"+i.tag, descripcion: i.descripcion||"Válvula solenoide", tag: rangoTag(i.tag), caracteristicas:`${expandirTag(i.tag).length} und.${i.alimentacion?" · "+i.alimentacion:""}${i.servicio?" · "+i.servicio:""}` });
  const equipos = T("equipos", eq);
  const instrumentosF = T("instrumentos", inst.filter(i=>!esSalida(i)).map(i=>({ id:"in:"+i.tag, descripcion: i.descripcion||"", servicio: i.servicio||"", senal: esAnalogico(i) ? "Analógica (4-20 mA)" : "Digital", tag: rangoTag(i.tag) })));

  /* ---- alcance ---- */
  auto.areas = [{ nombre:`Área - ${p.unidad || sist || p.nombre || "proyecto"}`, equipos: [ ...(sTag ? [{ descripcion: sist || "Sistema", tag:sTag }] : []), ...orden.map(l=>({ descripcion:nombreDe(l), tag:l.tag||"" })), ...limp.map(t=>({ descripcion:"Controlador de limpieza", tag:t.tagLimpieza||"" })) ] }];
  F.areas = u.areas || auto.areas;

  /* ---- subsistemas y etapas ---- */
  const descProc = pr.descripcion || p.descripcion || "";
  const accTxt = l => {
    const tb = tableroPorId(p, l.tablero) || tf(p), ct = ctl.find(c=>c.id===tb.control) || (esControl(tb) ? tb : ctl[0]) || {};
    return l.starter==="vfd" ? `variador de frecuencia; mando, estado y referencia de velocidad ${ct.vfdMando==="red" ? "por Ethernet/IP" : "cableados al PLC (listo, marcha, falla, arranque, reset y referencia 4-20 mA)"}`
      : l.starter==="ss" ? "arrancador suave; comando de marcha, confirmación de marcha y falla cableados al PLC" : "arranque directo; comando de marcha, confirmación de marcha y falla cableados al PLC";
  };
  const sub = [];
  sub.push({ id:"sub:sistema", nombre:(sist || "Sistema").toUpperCase(),
    descripcion: descProc || (colector ? `El ${sistDel} capta el aire con material particulado en los puntos de generación de polvo, lo filtra en las mangas del colector y descarga el polvo retenido en la tolva de forma controlada.${orden.length?` Está conformado por ${lista(motores.map(l=>`${lc1(nombreDe(l))} (${l.tag})`))}${cx.limpieza?", el sistema de limpieza de mangas por aire comprimido":""} y la instrumentación asociada.`:""}`
      : `El ${sistDel} está conformado por ${motores.length ? lista(motores.map(l=>`${lc1(nombreDe(l))} (${l.tag})`)) : "los equipos del P&ID del proyecto"} y la instrumentación asociada.`),
    alimentacion:"", modos:"", caracteristicas: motores.map(l=>`- ${nombreDe(l)} (${l.tag}): ${potTxt(l)}, ${ARR[l.starter]||"arranque"}, alimentado desde ${(tableroPorId(p, l.tablero)||tf(p)).tag}.`).join("\n") });
  if(cx.limpieza) sub.push({ id:"sub:limpieza", nombre:"CONTROLADOR DE LIMPIEZA",
    descripcion:[`El controlador de limpieza${limpTxt?" "+limpTxt:""} gobierna la limpieza automática de las mangas del colector. Su función es mantener la capacidad de filtrado mediante la remoción continua del material particulado acumulado en las mangas.`,
      `El controlador recibe la señal del transmisor de presión diferencial${pd.length?" "+pd.map(x=>x.tag).join(", "):""} (ΔP entre la cámara de aire limpio y la de aire con polvo). Cuando la ΔP supera el valor configurado, dispara en secuencia las válvulas solenoides${nValv?` (${nValv} válvulas, ${valvTxt})`:""}, que liberan pulsos de aire comprimido hacia el interior de las mangas para desprender el polvo retenido hacia la tolva.`,
      "El controlador retransmite al PLC la presión diferencial medida (4-20 mA) para su monitoreo y registro en la HMI. Funciona de forma autónoma: el PLC solo recibe señales de monitoreo y estado, sin intervenir en la lógica de limpieza."].join("\n"),
    alimentacion:`El controlador de limpieza opera a ${tensionEstabilizada(v)} y acciona las válvulas solenoides a ${(valvulas[0] && (valvulas[0].alimentacion||"").replace(/\s*\/.*$/, "")) || tensionEstabilizada(v)}. La parametrización (límites de ΔP, duración del pulso e intervalo entre pulsos) se realiza desde el display del controlador.`,
    modos:"- Automático (por ΔP): inicia la limpieza al superar el valor de inicio de ΔP y la detiene al bajar del valor de fin, manteniendo la caída de presión dentro de los límites configurados.\n- Por temporizador (manual): ejecuta pulsos periódicos de limpieza en intervalos preestablecidos, independientemente de la ΔP; útil para pruebas, arranques o condiciones de carga constante.",
    caracteristicas:"Unidad electrónica modular dedicada, con display local para la operación, el ajuste y el diagnóstico básico del ciclo de limpieza." });
  if(orden.length) sub.push({ id:"sub:accionamientos", nombre:"ACCIONAMIENTOS",
    descripcion:`Los motores del sistema se accionan desde ${lista([...new Set(motores.map(l=>(tableroPorId(p, l.tablero)||tf(p)).tag))])}:\n` + motores.map(l=>`- ${nombreDe(l)} (${l.tag}, ${potTxt(l)}): ${accTxt(l)}.`).join("\n"),
    alimentacion:"", modos:"- Local: mando desde la botonera a pie de equipo (selector en Local), para mantenimiento y pruebas.\n- Remoto: mando desde el PLC (HMI o secuencia automática), con el selector en Remoto.", caracteristicas:"" });
  F.tablas.subsistemas = T("subsistemas", sub);

  const et = [];
  if(colector){
    const vfdF = cx.principales.some(l=>l.starter==="vfd");
    if(cx.principales.length) et.push({ id:"op:captacion", titulo:"Captación y conducción", texto:`${uc1(lista(cx.principales.map(l=>`${lc1(nombreDe(l))} ${l.tag}`)))} ${cx.principales.length>1?"generan":"genera"} la depresión necesaria en los puntos de captación para conducir el aire con material particulado hacia el colector${vfdF?"; la velocidad se regula con el variador de frecuencia":""}.` });
    et.push({ id:"op:filtrado", titulo:"Filtrado", texto:"El flujo ingresa a la cámara de filtración, donde las mangas retienen el material particulado. El aire limpio se evacua por la chimenea del colector." });
    if(cx.limpieza) et.push({ id:"op:limpieza", titulo:"Limpieza de mangas (autónoma por ΔP)", texto:"El controlador de limpieza gestiona la inyección secuencial de pulsos de aire comprimido a través de las válvulas solenoides para desprender el polvo acumulado en las mangas. Puede operar en dos modos:\n- Por presión diferencial (ΔP): al superar el umbral configurado entre la cámara sucia y la limpia, inicia la secuencia de disparo de las válvulas y mantiene la caída de presión dentro del rango de operación.\n- Por temporizador: ejecuta ciclos de limpieza en intervalos preestablecidos, independientemente de la ΔP; útil con carga constante o como limpieza preventiva.\nEn ambos casos el controlador actúa de forma autónoma; el PLC solo monitorea sus variables, estados y fallas." });
    if(descarga.length) et.push({ id:"op:descarga", titulo:"Acumulación y descarga del material", texto:`El polvo desprendido cae a la tolva del colector y se descarga de forma controlada mediante ${lista(descarga.map(l=>`${lc1(nombreDe(l))} ${l.tag}`))}, evitando fugas de aire y retornos de flujo. El destino del material aguas abajo está fuera del alcance del presente documento.` });
  } else for(const l of orden){
    const ins = porTag.filter(x=>cx.equipoDe(x.i)===l).map(x=>x.tag);
    et.push({ id:"op:"+l.id, titulo:nombreDe(l), texto:`${nombreDe(l)} (${l.tag}, ${potTxt(l)}) se acciona mediante ${ARR[l.starter]||"arranque"} desde el tablero ${(tableroPorId(p, l.tablero)||tf(p)).tag}.${ins.length?` Se supervisa con ${lista(ins)}.`:""}` });
  }
  F.tablas.etapas = T("etapas", et);

  /* ---- textos ---- */
  const X = auto.textos, cuenta = t => io.filter(f=>f.tipo===t && f.origen!=="reserva" && ctl.some(c=>c.tag===f.tablero)).length;
  const conEq = motores.map(l=>`${lc1(nombreDe(l))} (${l.tag})`);
  X.introduccion = [`El proyecto «${p.nombre||"Proyecto"}»${p.unidad?`, ubicado en ${p.unidad}`:""}${p.cliente?`, desarrollado para ${p.cliente}`:""}, comprende la implementación del ${sistDel}${conEq.length||cx.limpieza ? `, que incluye ${lista([...conEq, cx.limpieza ? "la limpieza de mangas por aire comprimido" : ""])}, además de` : ", con"} la instrumentación y la señalización asociadas.`,
    descProc, `El presente documento corresponde a la filosofía de control del ${sistTxt}.`].filter(Boolean).join("\n");
  X.objetivos = `Definir la filosofía de operación y control del ${sistTxt}, precisando los modos de operación, interlocks, permisivos, alarmas, secuencias de arranque y parada y la arquitectura de control. El documento sirve de base para la ingeniería de detalle, la programación del PLC, las pruebas FAT / SAT, la puesta en marcha y la operación del sistema.\nLos valores de ajuste (set points) y temporizaciones son propuestos y se validarán con Procesos y los fabricantes de los equipos.`;
  const REFS = [["ins-pid", p.pidRef],["ins-instrumentos"],["ins-io"],["ins-arquitectura"],["ins-lazo"],["ins-unifilar-tc"],["ele-unifilar"],["ele-cargas"]];
  const refs = REFS.filter(([id])=>p.documentos && p.documentos[id] && entregable(id)).map(([id, c])=>`- ${entregable(id).nombre}${c?": "+c:""}`);
  if(p.pidRef && !(p.documentos||{})["ins-pid"]) refs.unshift(`- Diagrama P&ID: ${p.pidRef}`);
  X.referencias = [...refs, "- Manuales y hojas de datos de los fabricantes de los equipos."].join("\n");
  X.alcance = `El alcance del presente documento comprende el sistema de control y la instrumentación asociada al ${sistDel}. Esta filosofía de control aplica a los equipos indicados a continuación:`;
  X.exclusiones = `No forma parte del alcance de este documento la lógica de control de los equipos que no se encuentren en el alcance del ${p.pidRef ? "diagrama P&ID "+p.pidRef : "diagrama P&ID del proyecto"}.`;
  const mineria = /miner|mina|concentradora|tajo/.test(norm([p.unidad, p.cliente, p.nombre].join(" ")));
  X.normas = ["El diseño, la programación y la operación del sistema de control cumplirán las normas nacionales e internacionales aplicables, en su última edición vigente, y los reglamentos de seguridad vigentes. Las principales normas de referencia son:",
    "- ISA-5.1: símbolos e identificación de instrumentación.", "- ISA-18.2 / IEC 62682: gestión de alarmas en sistemas de control de procesos.", "- ISA-101: interfaces hombre-máquina (HMI) para la automatización de procesos.",
    "- IEC 61131-3: lenguajes de programación de controladores programables (PLC).", "- IEC 60204-1: seguridad de las máquinas — equipo eléctrico de las máquinas.", "- ISO 13850: seguridad de las máquinas — función de parada de emergencia.",
    "- IEC 61439-1/2: conjuntos de aparamenta de baja tensión (tableros).", "- IEC 60529 / NEMA 250: grados de protección de las envolventes.", `- ${v.norma}.`,
    /CNE/.test(v.norma) ? "" : "- Código Nacional de Electricidad – Utilización (Perú), en lo aplicable.",
    ctl.some(t=>t.router || t.redExterna) ? "- IEC 62443: seguridad de redes y sistemas de automatización industrial." : "",
    motores.some(esVentilador) ? "- AMCA: estándares para ventiladores y equipos de movimiento de aire." : "",
    motores.some(esVentilador) && porTag.some(x=>tipoVar(tipoInstrumento(x.tag))==="V") ? "- ISO 14694: ventiladores industriales — balanceo y niveles de vibración." : "",
    colector ? "- ACGIH, Industrial Ventilation: guía de ventilación industrial." : "",
    mineria ? "- D.S. 024-2016-EM y modificatorias: Reglamento de Seguridad y Salud Ocupacional en Minería (Perú)." : "",
    "- Estándares y especificaciones del cliente, que prevalecen cuando sean más exigentes."].filter(Boolean).join("\n");
  X.condiciones = [`El proyecto se desarrollará en ${p.unidad || "las instalaciones del cliente"}${v.ubicacion?`, ${v.ubicacion}`:""}. Las condiciones ambientales y geográficas del sitio se consideran en el diseño y la operación de los sistemas eléctricos, de control y de protección. Las principales condiciones del sitio son:`,
    v.ubicacion ? `- Ubicación: ${v.ubicacion}.` : "", `- Altitud sobre el nivel del mar: ${v.altitud} m s.n.m.`, `- Temperatura ambiente: entre ${v.tempMin} °C y ${v.tempMax} °C (temperatura de diseño: ${v.tempMax} °C).`,
    `- Instalación de los equipos: ${lc1(v.ambiente)}.`, `- Contaminación del ambiente: ${lc1(v.contaminacion)}.`, `- Área clasificada: ${lc1(v.areaClasificada)}.`, `- Grado de protección de los gabinetes: ${ipRecomendado(v)}.`,
    `- Tensiones de servicio: fuerza ${v.tension} Vac, ${v.frecuencia} Hz; control ${tensionControlTxt(v)}; instrumentación ${v.tensionInstr} Vdc.`].filter(Boolean).join("\n");
  const comp = t => [`${t.plc||"Controlador lógico programable (PLC)"}${t.modeloPlc?` (${t.modeloPlc})`:""}, encargado de adquirir las señales digitales y analógicas de los instrumentos de campo y de ejecutar la lógica de control, alarmas e interlocks.`,
    t.switch ? `Switch Ethernet industrial, que interconecta el PLC, la HMI${t.router?", el router":""} y la red de control del cliente.` : "",
    t.hmi ? "Pantalla HMI, para la visualización en tiempo real de estados, variables de proceso, alarmas y eventos." : "",
    t.router ? "Router IIoT, para el acceso remoto y la supervisión según las políticas de ciberseguridad del cliente." : "",
    t.controladorLimpieza ? `Controlador de limpieza ${t.tagLimpieza||""}, que gobierna de forma autónoma la limpieza de mangas y retransmite la ΔP (4-20 mA) al PLC.`.replace("  ", " ") : ""].filter(Boolean);
  const vfdRed = orden.some(l=>l.starter==="vfd") && ctl.some(t=>t.vfdMando==="red");
  X.arquitectura = ["La arquitectura de control integra los instrumentos de campo y los accionamientos con un sistema local de supervisión y operación, para asegurar la confiabilidad y la escalabilidad del sistema.",
    ctl.length>1 ? `Cada tablero de control (${ctlTags}) alberga:` : `El tablero de control ${ctlTags} alberga:`,
    ...(ctl.length>1 ? ctl.map(t=>`- ${t.tag}: ${comp(t).map(lc1).join(" ")}`) : comp(ctl[0]).map(s=>"- "+s)),
    "# Conexión y comunicación",
    `- Las señales de campo (digitales y analógicas) se cablean a los módulos de E/S del PLC: ${cuenta("AI")} AI, ${cuenta("AO")} AO, ${cuenta("DI")} DI y ${cuenta("DO")} DO${cuenta("COM")?`, más ${cuenta("COM")} enlace(s) de comunicación`:""} (listado I/O).`,
    orden.some(l=>l.starter==="vfd") ? (vfdRed ? "- Los variadores de frecuencia se comandan por Ethernet/IP (mando, estado y referencia de velocidad)." : "- Los variadores de frecuencia se comandan por cableado (listo, marcha, falla, arranque, reset y referencia de velocidad 4-20 mA).") : "",
    `- El sistema opera de forma autónoma a nivel local, sin depender del SCADA / DCS; todas las variables quedan disponibles en el PLC para su integración${red?` con la ${lc1(red)}`:" futura"}.`,
    `La arquitectura se muestra en la figura siguiente${(p.documentos||{})["ins-arquitectura"]?" y en el plano «Arquitectura de control» del proyecto":""}.`].filter(Boolean).join("\n");
  X.operacion = colector ? "El sistema capta y controla las emisiones de polvo generadas en los puntos de captación. La operación se entiende como un ciclo continuo con las siguientes etapas funcionales:" : `La operación del ${sistTxt} comprende las siguientes etapas funcionales:`;
  X.condicionesOperacion = (colector ? [
    `- El colector opera con ${lista(orden.map(l=>`${lc1(nombreDe(l))} ${l.tag}`)) || "sus equipos"} en servicio${cx.limpieza?", mientras el controlador de limpieza ejecuta la limpieza de mangas según la presión diferencial (ΔP) o por intervalos de tiempo programados":""}.`,
    cx.limpieza ? "- La línea de aire comprimido debe asegurar la calidad y la presión adecuadas para la eficacia de la limpieza." : "",
    `- La operación contempla el monitoreo local de estados y variables de proceso${hmi?" en la HMI":""}${cx.limpieza?"; las decisiones de limpieza recaen en el controlador dedicado":""}.`,
    "- Las transiciones entre estados (arranque, operación estable y parada) se ejecutan según las secuencias de las secciones 9.4 y 9.5." ]
    : [ "- Los equipos operan en la secuencia de la sección 9.4, con los permisivos e interlocks de la sección 9.2.", `- La operación contempla el monitoreo local de estados, variables de proceso y alarmas${hmi?" en la HMI":""}.`, "- Las transiciones entre estados se ejecutan según las secuencias de las secciones 9.4 y 9.5." ]).filter(Boolean).join("\n");
  X.interlocks = ["Los interlocks (enclavamientos) son reglas lógicas del PLC que definen cuándo puede operar un equipo y cuándo debe detenerse, para proteger a las personas, los equipos y el proceso. Actúan automáticamente ante determinadas señales y mantienen la operación dentro de condiciones seguras. Se clasifican en:",
    "- Permisivos", "- Seguridad", "- Proceso",
    "Interlock permisivo: condición que debe estar en estado normal para permitir el arranque del equipo. Si no se cumple al arranque, el equipo no inicia; su pérdida durante la operación solo detiene el equipo cuando la lógica lo indica expresamente.",
    "Interlock de seguridad: condición que debe estar en estado normal para arrancar y mantenerse durante la operación. Si se pierde en servicio, se ejecuta un paro inmediato (trip) con prioridad sobre cualquier orden de marcha; queda enclavado y requiere reconocimiento, corrección de la causa y rearme. No admite bypass, salvo excepciones controladas para pruebas.",
    "Interlock de proceso: condición de desempeño del proceso. Ante una condición anormal genera alarma y acciones correctivas (ajustar o inhibir una función) y detiene el equipo cuando la lógica lo indica; si la desviación persiste o alcanza los límites HH / LL, escala a parada.",
    "La siguiente tabla resume los interlocks definidos, su clasificación y sus temporizaciones; los set points se detallan en la sección 9.6."].join("\n");
  X.modos = ["Los equipos del sistema operan bajo dos modos principales de control:", "- Modo manual", "- Modo automático",
    `La selección del modo de operación se realiza desde ${hmi ? `la HMI del tablero de control ${ctlTags}` : `el tablero de control ${ctlTags}`}${red?" o desde la sala de control":""}.`,
    "Ambos modos mantienen activos los interlocks de seguridad y de proceso y los permisivos de arranque: el equipo se detiene si se activa un interlock de seguridad o de proceso y no arranca si no se cumple alguna condición permisiva.",
    "# Modo manual", "El arranque y la parada de cada motor se realizan en dos escenarios:",
    `- Operativo: comandos directos del operador desde ${hmi?"la HMI del tablero de control":"el tablero de control"}${red?" o desde las pantallas de la sala de control":""}, con el selector local / remoto en Remoto.`,
    `- Mantenimiento: mando desde las botoneras a pie de equipo, con el selector en Local${orden.length?`; se prevé una botonera por equipo (${orden.map(l=>l.tag).join(", ")})`:""}.`,
    "# Modo automático", "El arranque y la parada se ejecutan según las secuencias programadas en el PLC (secciones 9.4 y 9.5), con un solo comando del operador y sin intervención directa sobre cada equipo.",
    "En todos los modos, los pulsadores de parada de emergencia de las botoneras y del tablero de control detienen de inmediato los equipos, por cableado e independientemente del programa del PLC."].join("\n");
  const analog = porTag.filter(x=>esAnalogico(x.i));
  X.monitoreo = [cx.limpieza && pd.length ? `La señal de 4-20 mA de presión diferencial retransmitida por el controlador de limpieza (${pd.map(x=>x.tag).join(", ")}) se muestra en la HMI y se registra en el historial de operación.` : "",
    analog.length ? `- Variables analógicas supervisadas: ${analog.map(x=>`${x.tag} (${lc1(x.i.servicio||x.i.descripcion||"")})`).join("; ")}.` : "",
    "- Los estados de marcha, falla y giro de los equipos, el nivel de las tolvas y la presión de aire se supervisan de forma continua; la pérdida de un permisivo en marcha actúa según la lógica definida (parada ordenada o alarma).",
    "- Las alarmas y los eventos se registran con fecha y hora en la HMI."].filter(Boolean).join("\n");
  X.alarmas = "Esta sección describe las condiciones de operación que generan alarmas en el sistema de control y los parámetros críticos de cada equipo. Las alarmas alertan al operador sobre desviaciones operativas, fallas técnicas o condiciones de seguridad y activan respuestas automáticas (bloqueos, paradas o ciclos de limpieza) según la lógica programada en el PLC. Los valores indicados son propuestos (valores típicos de referencia) y se validarán con Procesos y los fabricantes de los equipos.";
  X.supervision = [`${ctl.length>1?"Cada":"El"} tablero de control integra la instrumentación de campo, las botoneras y el selector de modo de operación; el sistema permite la supervisión y la operación local${hmi?" mediante la HMI incorporada":""}. Las principales consideraciones son:`,
    "- El PLC local recopila las señales de instrumentación y gestiona de forma integral la lógica de control, las alarmas y los interlocks del sistema.",
    hmi ? "- La HMI local permite visualizar en tiempo real los estados de los motores, las variables de proceso, las alarmas activas y el registro de eventos." : "",
    red ? `- Todas las señales quedan disponibles en el PLC para su integración con la ${lc1(red)}; la integración se coordinará con el cliente.` : "- La integración con un sistema SCADA / DCS central no forma parte del alcance; todas las señales quedan disponibles en el PLC para su integración futura.",
    cx.limpieza && pd.length ? `- La señal analógica (4-20 mA) de presión diferencial del controlador de limpieza${limpTxt?" "+limpTxt:""} se replica al PLC para monitorear en tiempo real la saturación del colector.` : "",
    cx.limpieza ? `- Ante una presión diferencial alta, el controlador de limpieza acciona de forma autónoma las válvulas de limpieza${valvTxt?" "+valvTxt:""}; su estado se replica al PLC para supervisión.` : "",
    ctl.some(t=>t.router) ? "- El router IIoT habilita el acceso remoto para supervisión, conforme a las políticas de ciberseguridad del cliente." : ""].filter(Boolean).join("\n");
  X.notas = "";
  for(const k in TEXTOS_FIL) F.textos[k] = u.textos[k]!=null && u.textos[k]!=="" ? u.textos[k] : (X[k]||"");
  return { auto, F };
}

/* auto: lo que propone Ingenia · De: lo propuesto + lo editado por el usuario (lo que va al documento) */
export function filosofiaAuto(p){ return construir(p).auto; }
export function filosofiaDe(p){ return construir(p).F; }

/* ============ documento ============ */
const BL = txt => bloques(txt);
const LIN = txt => bloques(txt).map(b=>b.p ?? b.b ?? b.b2 ?? b.t);
function modelo(p){
  const F = filosofiaDe(p), t = F.tablas, cx = F.cx;
  const tablas = []; const nt = titulo => { tablas.push({ n: tablas.length+1, titulo }); return tablas.length; };
  const areas = (F.areas||[]).filter(a=>(a.equipos||[]).length).map(a=>({ nombre:a.nombre, titulo:String(a.nombre||"").toUpperCase(), n: nt(a.nombre||"Área"), filas:a.equipos.map((e,k)=>({ item:k+1, descripcion:e.descripcion||"", tag:e.tag||"" })) }));
  const it = a => a.map((f,k)=>Object.assign({ item:k+1 }, f));
  const nEq = t.equipos.length ? nt("Lista de equipos generales") : 0;
  const nIn = t.instrumentos.length ? nt("Lista de instrumentos") : 0;
  const nAl = t.alarmas.length ? nt("Alarmas") : 0;
  const nIl = t.interlocks.length ? nt("Interlocks") : 0;
  const nAr = t.arranque.length ? nt("Secuencia de arranque") : 0;
  const nSp = t.setpoints.length ? nt("Alarmas y set points de proceso") : 0;
  // secuencia de operación (9.4)
  const perm = t.interlocks.filter(i=>i.tipo==="permisivo" || i.tipo==="seguridad");
  const vistos = new Set(), permTxt = [];
  for(const i of perm){ const s = `${uc1(i.condicion||i.servicio||i.senal)}${i.tipo==="permisivo" && /\d/.test(i.valor||"") ? ` (valor de bloqueo: ${i.valor})` : ""}${i.retardo && i.retardo!=="—" && i.tipo==="permisivo" ? `, con ${i.retardo}` : ""}.`; if(!vistos.has(s)){ vistos.add(s); permTxt.push(s.replace(/\.\.$/, ".")); } }
  const pasos = [];
  if(permTxt.length || t.arranque.length) pasos.push({ titulo:"Verificaciones previas (permisivos)", bloques:[ ...permTxt.map(s=>({ b:s })), ...(t.arranque[0] ? [{ p:`Cumplidos los permisivos, se habilita el arranque${t.arranque[0].descripcion?` de ${lc1(t.arranque[0].descripcion)}`:""}${t.arranque[0].equipo?` ${t.arranque[0].equipo}`:""}.` }] : []) ] });
  t.arranque.forEach((a, k)=>{
    const val = a.tiempo && !/^[-—–]$/.test(a.tiempo.trim());
    const sig = t.arranque[k+1];
    const bl = [];
    if(val) bl.push({ p:`Se emite la orden de arranque y el PLC inicia un temporizador de validación (TON = ${a.tiempo}). Dentro de ese plazo se debe confirmar: ${lc1(a.confirmacion||"marcha del equipo")}.` });
    else if(a.confirmacion) bl.push({ p:`Condición para este paso: ${lc1(a.confirmacion)}.` });
    if(val) bl.push({ b:`Si confirma dentro del plazo, el arranque queda validado, el equipo pasa a «En servicio» y la secuencia continúa${sig?` con ${lc1(sig.descripcion||sig.accion||"el paso siguiente")}`:""}.` });
    if(a.falla) bl.push({ b:`${val?"Si no confirma: ":"Ante falla: "}${lc1(a.falla)}.`.replace(/\.\.$/, ".") });
    bl.push(...BL(a.notas));
    pasos.push({ titulo: a.descripcion && a.accion ? `${uc1(a.accion)} — ${a.descripcion}${a.equipo?` (${a.equipo})`:""}` : uc1(a.accion || a.descripcion || a.equipo || "Paso"), bloques:bl });
  });
  const mon = BL(F.textos.monitoreo); if(mon.length) pasos.push({ titulo:"Monitoreo y registro", bloques:mon });
  pasos.forEach((s,k)=>{ s.titulo = `${k+1}) ${s.titulo}`; });
  // secuencias de parada (9.5)
  const letra = k => String.fromCharCode(97 + (k % 26));
  const conEq = s => s.equipo && !/^[-—–]$/.test(s.equipo.trim());
  const paradas = t.parada.map((e,k)=>({ titulo:`${letra(k)}) ${uc1(e.evento||"Evento")}: secuencia de parada`, pasos:(e.pasos||[]).map((s,j)=>`${j+1}. ${conEq(s) ? cx.nombreTag(s.equipo)+": "+lc1(s.accion||"") : uc1(s.accion||"")}${s.retardo && !/^0\s*s$/.test(s.retardo) ? ` (retardo: ${s.retardo})` : ""}.`.replace(/\.\.$/, ".")) }));
  // verificaciones (9.6): alarmas agrupadas por instrumento
  const grupos = new Map();
  for(const a of t.alarmas){ if(!a.instrumento) continue; if(!grupos.has(a.instrumento)) grupos.set(a.instrumento, []); grupos.get(a.instrumento).push(a); }
  const verif = [...grupos.entries()].map(([tag, as])=>{
    const serv = cx.servicioDe(tag);
    return { titulo: `${serv ? `Verificación de ${lc1(serv)} mediante ${tag}` : cx.nombreTag(tag)}:`, items: as.map(a=>`${uc1(a.descripcion)}${a.setpoint && !/^contacto/i.test(a.setpoint) ? ` (${lc1(a.setpoint)})` : ""}: ${lc1(a.accion||"alarma en HMI")}.`.replace(/\.\.$/, ".")) };
  });
  const X = c => (c==null || c==="" ? "*" : c);
  return { F, tablas, areas, pasos, paradas, verif, n:{ eq:nEq, in:nIn, al:nAl, il:nIl, ar:nAr, sp:nSp },
    equipos: it(t.equipos), instrumentos: it(t.instrumentos), alarmas: it(t.alarmas),
    interlocks: t.interlocks.map(i=>Object.assign({}, i, { proceso: i.tipo==="proceso"?"X":"-", seguridad: i.tipo==="seguridad"?"X":"-", permisivo: i.tipo==="permisivo"?"X":"-", notas:[i.valor && i.valor!=="—" ? i.valor : "", i.retardo && i.retardo!=="—" ? i.retardo : ""].filter(Boolean).join(" · ") || "-" })),
    arranque: t.arranque.map((a,k)=>Object.assign({}, a, { paso:k+2 })),
    setpoints: t.setpoints.map(s=>Object.assign({}, s, { rango:s.rango||"-", unidad:s.unidad||"-", sp:X(s.sp), hh:X(s.hh), h:X(s.h), l:X(s.l), ll:X(s.ll) })),
    hayPendientes: t.setpoints.some(s=>["sp","hh","h","l","ll"].some(k=>s[k]==null || s[k]==="")) };
}

/* datos para la plantilla Word (assets/plantillas/docx/filosofia_control.docx) */
export function datosFilosofia(p){
  const M = modelo(p), F = M.F, T = F.textos;
  const sub = F.tablas.subsistemas.map(s=>({ nombre:String(s.nombre||"").toUpperCase(), descripcion:BL(s.descripcion), tiene_alim: !!BL(s.alimentacion).length, alimentacion:BL(s.alimentacion), tiene_modos: !!BL(s.modos).length, modos:BL(s.modos), tiene_carac: !!BL(s.caracteristicas).length, caracteristicas:BL(s.caracteristicas) }));
  return {
    introduccion:BL(T.introduccion), objetivos:BL(T.objetivos), referencias:BL(T.referencias), alcance:BL(T.alcance), areas:M.areas, exclusiones:BL(T.exclusiones),
    normas:BL(T.normas), condiciones:BL(T.condiciones), arquitectura:BL(T.arquitectura), fig_arq:1, subsistemas:sub,
    operacion:BL(T.operacion), etapas:F.tablas.etapas.map(e=>({ titulo:e.titulo||"", texto:BL(e.texto) })), condiciones_op:BL(T.condicionesOperacion),
    tiene_equipos:!!M.n.eq, t_equipos:M.n.eq, equipos:M.equipos, tiene_instrumentos:!!M.n.in, t_instrumentos:M.n.in, instrumentos:M.instrumentos,
    tiene_alarmas:!!M.n.al, t_alarmas:M.n.al, alarmas:M.alarmas,
    interlocks_txt:BL(T.interlocks), tiene_interlocks:!!M.n.il, t_interlocks:M.n.il, interlocks:M.interlocks,
    modos:BL(T.modos), pasos:M.pasos, tiene_arranque:!!M.n.ar, t_arranque:M.n.ar, arranque:M.arranque,
    tiene_paradas:!!M.paradas.length, paradas:M.paradas, sin_paradas:!M.paradas.length,
    alarmas_txt:BL(T.alarmas), verificaciones:M.verif, tiene_setpoints:!!M.n.sp, t_setpoints:M.n.sp, setpoints:M.setpoints, sp_pendientes:M.hayPendientes,
    supervision:BL(T.supervision), tiene_notas:!!BL(T.notas).length, notas:BL(T.notas),
    indice_tablas:M.tablas, indice_figuras:[{ n:1, titulo:"Arquitectura de control" }],
  };
}

/* vista previa: secciones con el mismo contenido y las mismas tablas que el Word */
export function seccionesFilosofia(p){
  const M = modelo(p), F = M.F, T = F.textos, s = [];
  const S = (titulo, nivel, bloques, tablas, extra) => s.push(Object.assign({ titulo, nivel, bloques: bloques||[], items:[], tablas: tablas||[] }, extra||{}));
  const tb = (n, titulo, columnas, filas) => ({ titulo:`Tabla ${n}. ${titulo}`, columnas, filas });
  S("1. INTRODUCCIÓN", 1, BL(T.introduccion)); S("2. OBJETIVOS", 1, BL(T.objetivos)); S("3. REFERENCIAS", 1, BL(T.referencias));
  S("4. ALCANCE", 1, [...BL(T.alcance)], M.areas.map(a=>tb(a.n, a.nombre, [["ÍTEM","item"],["DESCRIPCIÓN","descripcion"],["TAG","tag"]], a.filas)));
  if(BL(T.exclusiones).length) s[s.length-1].despues = BL(T.exclusiones);
  S("5. NORMAS Y ESTÁNDARES", 1, BL(T.normas)); S("6. CONDICIONES GENERALES", 1, BL(T.condiciones));
  S("7. ARQUITECTURA DE CONTROL", 1, BL(T.arquitectura), [], { figura: arquitecturaSVG(p).svg, pieFigura:"Figura 1. Arquitectura de control" });
  S("8. DESCRIPCIÓN GENERAL DEL SISTEMA", 1, []);
  F.tablas.subsistemas.forEach((x,k)=>{
    S(`8.${k+1} ${String(x.nombre||"").toUpperCase()}`, 2, BL(x.descripcion));
    let j = 0;
    if(BL(x.alimentacion).length) S(`8.${k+1}.${++j} Alimentación y control`, 3, BL(x.alimentacion));
    if(BL(x.modos).length) S(`8.${k+1}.${++j} Modos de operación`, 3, BL(x.modos));
    if(BL(x.caracteristicas).length) S(`8.${k+1}.${++j} Características`, 3, BL(x.caracteristicas));
  });
  S("9. OPERACIÓN Y LÓGICA DE CONTROL", 1, []);
  S("9.1 DESCRIPCIÓN DE LA OPERACIÓN", 2, BL(T.operacion));
  F.tablas.etapas.forEach((e,k)=>S(`9.1.${k+1} ${e.titulo}`, 3, BL(e.texto)));
  const k0 = F.tablas.etapas.length;
  S(`9.1.${k0+1} Condiciones de operación`, 3, BL(T.condicionesOperacion), [
    ...(M.n.eq ? [tb(M.n.eq, "Lista de equipos generales", [["ÍTEM","item"],["EQUIPO","descripcion"],["TAG","tag"],["CARACTERÍSTICAS","caracteristicas"]], M.equipos)] : []),
    ...(M.n.in ? [tb(M.n.in, "Lista de instrumentos", [["ÍTEM","item"],["INSTRUMENTO","descripcion"],["SERVICIO","servicio"],["TIPO DE SEÑAL","senal"],["TAG","tag"]], M.instrumentos)] : []),
    ...(M.n.al ? [tb(M.n.al, "Alarmas", [["ÍTEM","item"],["INSTRUMENTO","instrumento"],["ALARMA","descripcion"],["TIPO","tipo"],["TAG","senal"]], M.alarmas)] : []) ]);
  S("9.2 INTERLOCKS", 2, BL(T.interlocks), M.n.il ? [tb(M.n.il, "Interlocks", [["TAG","senal"],["SERVICIO","servicio"],["PROCESO","proceso"],["SEGURIDAD","seguridad"],["PERMISIVO","permisivo"],["ACCIÓN","accion"],["NOTAS","notas"]], M.interlocks)] : []);
  S("9.3 MODOS DE OPERACIÓN", 2, BL(T.modos));
  S("9.4 SECUENCIA DE OPERACIÓN", 2, M.pasos.flatMap(x=>[{ t:x.titulo }, ...x.bloques]), M.n.ar ? [tb(M.n.ar, "Secuencia de arranque", [["PASO","paso"],["EQUIPO","descripcion"],["TAG","equipo"],["ACCIÓN","accion"],["CONFIRMACIÓN","confirmacion"],["TIEMPO","tiempo"],["ANTE FALLA","falla"]], M.arranque)] : []);
  S("9.5 SECUENCIAS DE PARADA ANTE FALLA O PARADA INTEMPESTIVA", 2, M.paradas.flatMap(x=>[{ t:x.titulo }, ...x.pasos.map(y=>({ b2:y }))]));
  S("9.6 ALARMAS Y SET POINTS DE PROCESO", 2, [...BL(T.alarmas), ...M.verif.flatMap(v=>[{ b:v.titulo }, ...v.items.map(y=>({ b2:y }))])],
    M.n.sp ? [tb(M.n.sp, "Alarmas y set points de proceso", [["TAG","tag"],["SERVICIO","servicio"],["RANGO","rango"],["UNIDAD","unidad"],["SP","sp"],["HH","hh"],["H","h"],["L","l"],["LL","ll"]], M.setpoints)] : []);
  S("10. COMUNICACIÓN Y SUPERVISIÓN", 1, BL(T.supervision));
  if(BL(T.notas).length) S("11. NOTAS", 1, BL(T.notas));
  return s;
}

/* ============ figura: arquitectura de control (SVG → PNG al descargar) ============ */
const xe = s => String(s??"").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function partir(txt, ancho, fs){
  const max = Math.max(6, Math.floor(ancho/(fs*0.56))), out = []; let l = "";
  for(const w of String(txt||"").split(/\s+/)){ if(!w) continue; if((l+" "+w).trim().length>max && l){ out.push(l); l = w; } else l = (l+" "+w).trim(); }
  if(l) out.push(l); return out;
}
export function arquitecturaSVG(p){
  const cx = contexto(p), { ctl, io, orden } = cx, W = 1600, H = 900;
  const o = [];
  const caja = (x, y, w, h, titulo, lineas, op={})=>{
    const band = op.band || "#303640", tc = op.tc || "#FFFFFF";
    o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#FFFFFF" stroke="#17191D" stroke-width="2"${op.dash?' stroke-dasharray="10 6"':""}/>`);
    o.push(`<rect x="${x}" y="${y}" width="${w}" height="40" rx="6" fill="${band}"/><rect x="${x}" y="${y+24}" width="${w}" height="16" fill="${band}"/>`);
    const fs = Math.max(15, Math.min(23, Math.floor((w-16)/(String(titulo||"").length*0.56)))), tl = partir(titulo, w-16, fs);
    o.push(`<text x="${x+w/2}" y="${y+29}" text-anchor="middle" font-size="${fs}" font-weight="bold" fill="${tc}">${xe((tl[0]||"")+(tl.length>1?" …":""))}</text>`);
    let yy = y+66; const lin = []; for(const s of lineas||[]) lin.push(...partir(s, w-20, 20));
    const max = Math.max(1, Math.floor((h-8-66)/24)+1); if(lin.length>max){ lin.length = max; lin[max-1] = lin[max-1].replace(/,?$/, " …"); }
    for(const s of lin){ if(yy>y+h-8) break; o.push(`<text x="${x+w/2}" y="${yy}" text-anchor="middle" font-size="20" fill="#17191D">${xe(s)}</text>`); yy += 24; }
    return { x, y, w, h, cx:x+w/2, cy:y+h/2, b:y+h };
  };
  const linea = (x1, y1, x2, y2, dash, et) => { o.push(`<path d="M${x1} ${y1} L${x1} ${(y1+y2)/2} L${x2} ${(y1+y2)/2} L${x2} ${y2}" fill="none" stroke="#17191D" stroke-width="${dash?2:3}"${dash?' stroke-dasharray="8 6"':""}/>`); if(et) o.push(`<text x="${x2+8}" y="${(y1+y2)/2-6}" font-size="18" fill="#303640">${xe(et)}</text>`); };
  // niveles
  const niv = [["SUPERVISIÓN", 20, 160], ["CONTROL", 175, 600], ["CAMPO", 615, 880]];
  for(const [n, y0, y1] of niv){ o.push(`<rect x="10" y="${y0}" width="${W-20}" height="${y1-y0}" fill="${n==="CONTROL"?"#F4F6F8":"#FFFFFF"}" stroke="#DCE1E6" stroke-width="2"/>`); o.push(`<text x="30" y="${y0+30}" font-size="19" font-weight="bold" fill="#303640" letter-spacing="2">${n}</text>`); }
  const red = (ctl.find(t=>t.redExterna)||{}).redExterna;
  const top = caja(W/2-330, 45, 660, 100, red || "Red de control del cliente (integración futura)", [red ? "Sala de control / SCADA / DCS" : "Las variables quedan disponibles en el PLC"], { dash:!red, band:"#17191D", tc:"#F5C518" });
  const n = ctl.length, x0 = 170, colW = (W - x0 - 30)/n;
  ctl.forEach((t, k)=>{
    const c = x0 + colW*k + colW/2, bw = Math.min(330, colW*0.44);
    o.push(`<rect x="${x0+colW*k+12}" y="195" width="${colW-24}" height="390" rx="8" fill="none" stroke="#303640" stroke-width="2" stroke-dasharray="12 8"/>`);
    // rótulo del tablero: a la derecha si el router desplaza el switch (y su línea) hacia la izquierda
    o.push(`<text x="${t.router ? x0+colW*(k+1)-28 : x0+colW*k+28}" y="224"${t.router?' text-anchor="end"':""} font-size="21" font-weight="bold" fill="#17191D">${xe(`${t.tag} — ${t.nombre||"Tablero de control"}`)}</text>`);
    const cnt = tipo => io.filter(f=>f.tablero===t.tag && f.tipo===tipo && f.origen!=="reserva").length;
    const nES = cnt("AI")+cnt("AO")+cnt("DI")+cnt("DO");
    const plc = caja(c-bw-20, 420, bw, 150, t.modeloPlc ? `PLC ${t.modeloPlc}` : "PLC", [`${t.plc||"Controlador lógico programable"}`, nES ? `${cnt("AI")} AI · ${cnt("AO")} AO · ${cnt("DI")} DI · ${cnt("DO")} DO` : "Módulos de E/S digitales y analógicas"], { band:"#17191D", tc:"#F5C518" });
    const hmi = t.hmi ? caja(c+20, 420, bw, 150, "HMI", ["Pantalla de operación", "Estados, variables, alarmas y eventos"]) : null;
    let sw = null;
    if(t.switch){ sw = caja(c-bw/2-(t.router?bw/2+10:0), 245, bw, 110, "Switch Ethernet", ["Industrial, administrable"]); linea(sw.cx, sw.b, plc.cx, plc.y); if(hmi) linea(sw.cx, sw.b, hmi.cx, hmi.y); linea(sw.cx, sw.y, top.cx, top.b, !red, k===0 ? "Ethernet" : ""); }
    else { if(hmi) o.push(`<line x1="${plc.x+plc.w}" y1="${plc.cy}" x2="${hmi.x}" y2="${hmi.cy}" stroke="#17191D" stroke-width="3"/>`); linea(plc.cx, plc.y, top.cx, top.b, true, ""); }
    if(t.router){ const r = caja((sw?sw.x+sw.w:c)+20, 245, Math.min(bw, 240), 110, "Router IIoT", ["Acceso remoto"]); if(sw) o.push(`<line x1="${sw.x+sw.w}" y1="${sw.cy}" x2="${r.x}" y2="${r.cy}" stroke="#17191D" stroke-width="3"/>`); }
    // campo
    const fuerzas = tablerosPotencia(p).filter(f=>f.tipo!=="distribucion" && ((esControl(f) ? f : (f.control && tableroPorId(p, f.control)) || tc(p)).id===t.id));
    const mot = orden.filter(l=>fuerzas.some(f=>f.id===(tableroPorId(p, l.tablero)||tf(p)).id));
    const campo = [];
    const nInst = io.filter(f=>f.tablero===t.tag && f.origen==="instrumento").length;
    const tags = cx.inst.filter(i=>!esSalida(i) && (i.tablero||ctl[0].tag)===t.tag).map(i=>i.tag);
    campo.push(["Instrumentos de campo", [nInst ? `${nInst} señales cableadas` : "Señales digitales y analógicas", tags.join(", ")], "E/S cableadas"]);
    if(fuerzas.length) campo.push([`Tablero de fuerza ${fuerzas.map(f=>f.tag).join(", ")}`, mot.length ? mot.slice(0,4).map(l=>`${l.tag}: ${l.starter==="vfd"?"VFD":l.starter==="ss"?"arrancador suave":"arranque directo"}`) : ["Arrancadores y variadores de los motores"], t.vfdMando==="red" && mot.some(l=>l.starter==="vfd") ? "Ethernet/IP" : "Mando cableado"]);
    if(t.controladorLimpieza) campo.push(["Controlador de limpieza", [t.tagLimpieza||"", "Válvulas solenoides de limpieza", cx.valvulas.map(i=>rangoTag(i.tag)).join(", ")], "ΔP 4-20 mA / estado"]);
    const cw = Math.min(330, (colW-40)/campo.length - 20);
    campo.forEach(([tit, lin, et], j)=>{
      const bx = x0 + colW*k + 20 + j*((colW-40)/campo.length) + ((colW-40)/campo.length - cw)/2;
      const corto = cw<260 && { "Instrumentos de campo":"Instrumentos", "Controlador de limpieza":"Limpieza" }[tit];   // cajas angostas (varios tableros)
      const b = caja(bx, 660, cw, 195, corto || (cw<260 ? tit.replace(/^Tablero de fuerza /, "") : tit), lin);
      const red2 = et==="Ethernet/IP" && sw;
      linea(red2 ? sw.cx : plc.cx, red2 ? sw.b : plc.b, b.cx, b.y, !red2, et);
    });
  });
  // leyenda
  o.push(`<g font-size="18" fill="#303640"><line x1="${W-330}" y1="40" x2="${W-270}" y2="40" stroke="#17191D" stroke-width="3"/><text x="${W-260}" y="45">Ethernet industrial</text><line x1="${W-330}" y1="68" x2="${W-270}" y2="68" stroke="#17191D" stroke-width="2" stroke-dasharray="8 6"/><text x="${W-260}" y="73">Señales cableadas / futuro</text></g>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Arial, Helvetica, sans-serif"><rect width="${W}" height="${H}" fill="#FFFFFF"/>${o.join("")}</svg>`;
  return { svg, w:W, h:H };
}
/* al descargar: la figura de la plantilla (word/media/arquitectura.png) se reemplaza por la del proyecto */
export async function prepararFilosofia(zip, p){
  if(typeof document==="undefined" || !document.createElement || typeof Image==="undefined") return;
  try{
    const { svg, w, h } = arquitecturaSVG(p);
    const img = new Image();
    await new Promise((res, rej)=>{ img.onload = res; img.onerror = rej; img.src = "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg); });
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
    zip.file("word/media/arquitectura.png", c.toDataURL("image/png").split(",")[1], { base64:true });
  }catch(e){ console.warn("Figura de arquitectura no generada:", e); }
}

/* ============ API para Copito (cambios seguros sobre la estructura) ============
   Cada operación modifica datos(p).filosofia y devuelve { ok, msg, fila? }; quien llama guarda (S.save()). */
const buscar = (filas, ref) => {
  if(ref==null || ref==="") return -1;
  if(typeof ref==="number") return ref>=1 && ref<=filas.length ? ref-1 : -1;
  const r = norm(ref);
  let k = filas.findIndex(f=>f.id===ref); if(k>=0) return k;
  k = filas.findIndex(f=>["senal","tag","equipo","evento","nombre","titulo"].some(c=>f[c] && norm(f[c])===r)); if(k>=0) return k;
  return filas.findIndex(f=>["instrumento","descripcion","evento","senal"].some(c=>f[c] && norm(f[c]).includes(r)));
};
function tablaOk(nombre){ return Object.prototype.hasOwnProperty.call(TABLAS_FIL, nombre); }
export const filosofiaOps = {
  tablas: () => Object.fromEntries(Object.entries(TABLAS_FIL).map(([k, x])=>[k, x.titulo])),
  textos: () => Object.assign({}, TEXTOS_FIL),
  filas(p, tabla){ return tablaOk(tabla) ? filosofiaDe(p).tablas[tabla] : []; },
  agregar(p, tabla, o, despuesDe){
    if(!tablaOk(tabla)) return { ok:false, msg:`Tabla desconocida: ${tabla}` };
    const filas = filosofiaDe(p).tablas[tabla], f = Object.assign({}, o||{}); delete f._auto; delete f._ed; if(!f.id || filas.some(x=>x.id===f.id)) f.id = uidc("u");
    const k = despuesDe!=null ? buscar(filas, despuesDe) : -1;
    if(k>=0) filas.splice(k+1, 0, f); else filas.push(f);
    guardarTabla(p, tabla, filas); return { ok:true, msg:`Agregado a «${TABLAS_FIL[tabla].titulo}»`, fila:f };
  },
  editar(p, tabla, ref, campos){
    if(!tablaOk(tabla)) return { ok:false, msg:`Tabla desconocida: ${tabla}` };
    const filas = filosofiaDe(p).tablas[tabla], k = buscar(filas, ref); if(k<0) return { ok:false, msg:`No encontré «${ref}» en «${TABLAS_FIL[tabla].titulo}»` };
    for(const [c, val] of Object.entries(campos||{})) if(c!=="id" && c[0]!=="_") filas[k][c] = val;
    guardarTabla(p, tabla, filas); return { ok:true, msg:`Actualizado en «${TABLAS_FIL[tabla].titulo}»`, fila:filas[k] };
  },
  quitar(p, tabla, ref, todas){
    if(!tablaOk(tabla)) return { ok:false, msg:`Tabla desconocida: ${tabla}` };
    let filas = filosofiaDe(p).tablas[tabla], n = 0;
    if(todas){ const r = norm(ref); const antes = filas.length; filas = filas.filter(f=>!["instrumento","senal","equipo","tag"].some(c=>f[c] && norm(f[c]).startsWith(r))); n = antes - filas.length; }
    else { const k = buscar(filas, ref); if(k>=0){ filas.splice(k, 1); n = 1; } }
    if(!n) return { ok:false, msg:`No encontré «${ref}» en «${TABLAS_FIL[tabla].titulo}»` };
    guardarTabla(p, tabla, filas); return { ok:true, msg:`${n} fila(s) quitadas de «${TABLAS_FIL[tabla].titulo}»` };
  },
  mover(p, tabla, ref, delta){
    if(!tablaOk(tabla)) return { ok:false, msg:`Tabla desconocida: ${tabla}` };
    const filas = filosofiaDe(p).tablas[tabla], k = buscar(filas, ref), j = k + (delta||0);
    if(k<0 || j<0 || j>=filas.length) return { ok:false, msg:"No se puede mover en esa dirección" };
    const [f] = filas.splice(k, 1); filas.splice(j, 0, f); guardarTabla(p, tabla, filas); return { ok:true, msg:"Orden actualizado", fila:f };
  },
  agregarAlarma(p, o){ return this.agregar(p, "alarmas", Object.assign({ instrumento:"", senal:"", descripcion:"", tipo:"H", setpoint:"", accion:"Alarma en HMI", prioridad:"Media" }, o)); },
  quitarAlarma(p, ref){ const f = this.filas(p, "alarmas"); return buscar(f, ref)>=0 && f.some(x=>x.id===ref || norm(x.senal)===norm(ref)) ? this.quitar(p, "alarmas", ref) : this.quitar(p, "alarmas", ref, true); },
  agregarInterlock(p, o){ return this.agregar(p, "interlocks", Object.assign({ tipo:"proceso", senal:"", servicio:"", equipo:"", condicion:"", accion:"", valor:"", retardo:"" }, o)); },
  quitarInterlock(p, ref){ return this.quitar(p, "interlocks", ref); },
  /* sec: "arranque" o el evento de parada (id «pa:…», nombre o número) */
  agregarPaso(p, sec, o, despuesDe){
    if(sec==="arranque") return this.agregar(p, "arranque", Object.assign({ equipo:"", descripcion:"", accion:"", confirmacion:"", tiempo:"", falla:"", notas:"" }, o), despuesDe);
    const ev = filosofiaDe(p).tablas.parada, k = buscar(ev, sec);
    if(k<0){ return this.agregar(p, "parada", { evento: String(sec||"Evento"), pasos:[ Object.assign({ equipo:"", accion:"", retardo:"" }, o) ] }); }
    ev[k].pasos = ev[k].pasos || []; ev[k].pasos.push(Object.assign({ equipo:"", accion:"", retardo:"" }, o));
    guardarTabla(p, "parada", ev); return { ok:true, msg:`Paso agregado a «${ev[k].evento}»`, fila:ev[k] };
  },
  editarTexto(p, campo, texto){
    if(!Object.prototype.hasOwnProperty.call(TEXTOS_FIL, campo)) return { ok:false, msg:`Texto desconocido: ${campo}` };
    guardarTexto(p, campo, texto); return { ok:true, msg:`${TEXTOS_FIL[campo]} actualizado` };
  },
  /* vuelve a lo automático: una tabla, un texto, "areas" o "todo" */
  regenerar(p, seccion){
    const u = filosofiaUsuario(p);
    if(seccion==="todo"){ u.textos = {}; u.tablas = {}; u.areas = null; return { ok:true, msg:"Filosofía de control regenerada desde el proyecto" }; }
    if(seccion==="areas"){ u.areas = null; return { ok:true, msg:"Alcance regenerado" }; }
    if(tablaOk(seccion)){ delete u.tablas[seccion]; return { ok:true, msg:`«${TABLAS_FIL[seccion].titulo}» regenerada desde el proyecto` }; }
    if(Object.prototype.hasOwnProperty.call(TEXTOS_FIL, seccion)){ delete u.textos[seccion]; return { ok:true, msg:`${TEXTOS_FIL[seccion]}: texto automático` }; }
    return { ok:false, msg:`Sección desconocida: ${seccion}` };
  },
  resumen(p){
    const F = filosofiaDe(p), u = filosofiaUsuario(p);
    const c = Object.fromEntries(Object.keys(TABLAS_FIL).map(k=>[k, F.tablas[k].length]));
    return { filas:c, editadas: Object.keys(u.tablas), textosEditados: Object.keys(u.textos), alcanceEditado: !!u.areas };
  },
};

/* ============ típico de montaje de instrumentos ============ */
const MONTAJE = [
  [/^PD(I)?T$/, "Transmisor de presión diferencial", ["Manifold de 3 o 5 válvulas para bloqueo, igualación y purga.", "Líneas de impulso de igual longitud y con pendiente continua hacia las tomas (típicamente ≥ 1:12) para evitar bolsas de condensado.", "En colectores de polvo: tomas en cámara limpia y cámara sucia con conexión para purga / soplado; transmisor por encima de las tomas.", "Soporte en tubo de 2\" o pedestal, accesible para calibración."]],
  [/^PI?T$/, "Transmisor de presión", ["Válvula de bloqueo y purga o manifold de 2 válvulas.", "Aire y gases: toma en la parte superior de la tubería y transmisor por encima de la toma (drenaje natural del condensado hacia el proceso).", "Líquidos: toma lateral y transmisor por debajo de la toma (líneas siempre llenas).", "Soporte independiente de la tubería si hay vibración; entrada de cable con prensaestopas y bucle de goteo."]],
  [/^LSH$|^LSL$/, "Interruptor de nivel", ["Montaje lateral en la tolva / tanque a la altura del nivel a detectar.", "Tipo vibratorio en sólidos: horquilla ligeramente inclinada hacia abajo para que el material no se acumule; deflector de protección si cae material sobre el sensor.", "Prever acceso para retiro y prueba funcional."]],
  [/^LI?T$/, "Transmisor de nivel", ["Radar: montaje en el techo, alejado de paredes, de la caída de material y de estructuras internas (cono de emisión libre).", "Boquilla y antena según fabricante; considerar purga de aire si hay polvo adherente."]],
  [/^SS[LH]?$/, "Interruptor de velocidad cero", ["Sensor inductivo frente a una leva o disco dentado en el eje (preferentemente el eje de baja velocidad).", "Distancia de detección según fabricante; soporte rígido y libre de vibración; guarda de protección mecánica."]],
  [/^XV|^SV/, "Válvula solenoide", ["Montaje sobre el cabezal / manifold de aire del equipo, según fabricante.", "Cableado hacia caja de paso con borneras; grado de protección acorde al ambiente (polvo)."]],
  [/^VI?T$/, "Transmisor de vibración", ["Sensor en la carcasa del rodamiento, en dirección radial, fijado con espárrago sobre superficie plana mecanizada.", "Cable apantallado con la pantalla puesta a tierra en un solo extremo."]],
  [/^TI?T$|^TE$/, "Transmisor de temperatura", ["RTD Pt100 en termopozo o de contacto en el descanso, con transmisor en cabezal.", "Cable apantallado; longitud de inserción según el diámetro / alojamiento."]],
  [/^FI?T$/, "Transmisor de flujo", ["Respetar los tramos rectos aguas arriba y aguas abajo exigidos por el fabricante para la tecnología elegida.", "Tubería siempre llena en el punto de medición; puesta a tierra del medidor según fabricante."]],
  [/^ZS/, "Interruptor de desalineamiento", ["A ambos lados de la faja, en las zonas donde el desalineamiento es probable (cerca de poleas y cargas).", "Soporte en la estructura de la faja, con rodillo perpendicular al borde de la banda."]],
  [/^HS/, "Interruptor de parada por cable", ["Cable tensado a lo largo de la faja, accesible desde el pasillo; separación entre interruptores según fabricante y estándar del cliente."]],
];
export function seccionesTipicos(p){
  const v = valoresDiseno(p);
  const secs = [{ titulo:"GENERALIDADES", texto:`Recomendaciones de montaje en campo para los instrumentos del listado de instrumentos. Ambiente: ${String(v.ambiente||"").toLowerCase()}, ${String(v.contaminacion||"").toLowerCase()}; altitud ${v.altitud} m s.n.m. Prevalecen las instrucciones del fabricante del modelo seleccionado y el estándar del cliente.`, items:[
    "Ubicar los instrumentos accesibles desde piso o plataforma, con espacio para mantenimiento y calibración.",
    "Entradas de cable por la parte inferior, con prensaestopas acordes al grado de protección y bucle de goteo.",
    "Soportes independientes de la tubería cuando haya vibración; identificación con placa de TAG." ] }];
  for(const i of instrumentos(p)){
    if(!i.tag) continue;
    const t = tipoInstrumento(i.tag); const m = MONTAJE.find(([re])=>re.test(t));
    secs.push({ titulo:`${i.tag} — ${(i.descripcion||(m?m[1]:"Instrumento")).toUpperCase()}`, texto:`Servicio: ${i.servicio||"—"}. Ubicación: ${i.ubicacion||"—"}. Modelo: ${[i.marca,i.modelo].filter(Boolean).join(" ")||"por definir (verificar recomendaciones con el manual del fabricante)"}.`, items: m ? m[2] : ["Seguir el manual de instalación del fabricante."] });
  }
  return secs;
}

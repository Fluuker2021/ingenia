/* Ingenia — Copito: cambios en los datos desde el chat.
   interpretar() traduce una orden en español a operaciones; describir() las muestra para confirmarlas;
   aplicar() las ejecuta sobre el proyecto (mismas reglas que los formularios), regenera lo derivado
   y devuelve el impacto en todo el proyecto; deshacer() restaura el estado anterior. */
import * as S from "./store.js";
import { esc } from "./ui.js";
import { ETAPAS, ENTREGABLES } from "./catalog.js";
import { datos, tableros, tablerosPotencia, instrumentos, expandirTag, tipoInstrumento, nuevaCarga, aplicarTipicos, derivarIO, tf, calcularTablero, cablesFuerza } from "./datos.js";
import { valoresDiseno } from "./modules/criterios.js";
import { docInfo } from "./docs.js";
import { nextRev } from "./workspace.js";
import { cfgMecanico, arregloTablero, ACCIONES_MOVER } from "./mecanico/arreglo.js";

/* ---------- texto ---------- */
// normaliza (minúsculas, sin tildes) conservando la posición de cada carácter en el texto original
function normMapa(orig){
  let t = ""; const idx = [];
  for(let i=0;i<orig.length;i++){ const n = orig[i].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); for(const c of n){ t += c; idx.push(i); } }
  return { t, idx, orig };
}
// quita comillas y la puntuación final, pero conserva abreviaturas como «S.A.» o «Ing.»
const limpiar = s => String(s||"").trim().replace(/^["'«“(]+|["'»”);,]+$/g, "").replace(/([a-z0-9áéíóúñ])\.$/, "$1").trim();
// valor de texto que sigue a una palabra clave: «… cliente a Minera ABC», «ubicación de PIT-101: tubería»
function textoTras(M, clave){
  const re = new RegExp(`(?:${clave})[^:]*?(?:\\s+a\\s+|\\s+por\\s+|\\s*:\\s*|\\s+es\\s+|\\s+sea\\s+)(.+)$`);
  const m = re.exec(M.t); if(!m) return "";
  const ini = m.index + m[0].length - m[1].length;
  return limpiar(M.orig.slice(M.idx[ini]));
}
const num = s => s==null ? NaN : parseFloat(String(s).replace(",", "."));
const ARRANQUE = [[/variador|vfd|vdf|frecuencia variable/, "vfd"], [/arrancador suave|soft|suave/, "ss"], [/directo|dol|linea/, "dol"]];
const arranqueDe = t => (ARRANQUE.find(([re])=>re.test(t))||[])[1];
const APLIC = [[/bomba/, "bomba-centrifuga"], [/ventilador axial|extractor axial/, "ventilador-axial"], [/ventilador|extractor/, "ventilador-centrifugo"], [/faja|transportador|conveyor/, "faja-transportadora"], [/valvula rotativa|rotativa/, "valvula-rotativa"], [/compresor/, "compresor-piston"], [/molino/, "molino"], [/chancadora|trituradora/, "chancadora"], [/agitador|mezclador/, "agitador"]];
const NOMBRE_APLIC = { "bomba-centrifuga":"Bomba", "ventilador-centrifugo":"Ventilador", "ventilador-axial":"Ventilador axial", "faja-transportadora":"Faja transportadora", "valvula-rotativa":"Válvula rotativa", "compresor-piston":"Compresor", "molino":"Molino", "chancadora":"Chancadora", "agitador":"Agitador" };
const CAMPO = { ubicacion:"ubicación", servicio:"servicio", descripcion:"descripción", marca:"marca", modelo:"modelo", alimentacion:"alimentación", rango:"rango", senal:"señal", nombre:"nombre", cliente:"cliente", unidad:"unidad minera / planta", etapa:"etapa" };
const LBL_ARR = { dol:"directo", vfd:"variador", ss:"arrancador suave" };
const VARIABLE = { P:"presión", PD:"presión diferencial", F:"flujo", L:"nivel", T:"temperatura", A:"análisis", Z:"posición", S:"velocidad", V:"vibración", W:"peso", D:"densidad", H:"manual" };
const DISENO = [
  [/tension de control|voltaje de control/, "tensionControl", "Tensión de control", ""],
  [/tension de instrumentacion/, "tensionInstr", "Tensión de instrumentación", "Vdc"],
  [/caida de tension.*alimentador/, "caidaAlimentador", "Caída de tensión en alimentadores", "%"],
  [/caida de tension/, "caidaTension", "Caída de tensión admisible", "%"],
  [/tension|voltaje/, "tension", "Tensión de fuerza", "Vac"],
  [/frecuencia/, "frecuencia", "Frecuencia", "Hz"],
  [/altitud|altura/, "altitud", "Altitud", "m s.n.m."],
  [/temperatura (maxima|max)/, "tempMax", "Temperatura máxima", "°C"],
  [/temperatura (minima|min)/, "tempMin", "Temperatura mínima", "°C"],
  [/temperatura( ambiente)? de diseno|temperatura/, "tempMax", "Temperatura máxima (de diseño)", "°C"],
  [/cortocircuito|\bicc\b/, "icc", "Nivel de cortocircuito", "kA"],
  [/reserva (de )?(canales )?i\/?o|reserva de senales/, "reservaIO", "Reserva de canales I/O", "%"],
];
const NOMBRE_DISENO = Object.fromEntries(DISENO.map(([, k, n, u])=>[k, [n, u]]));
NOMBRE_DISENO.ubicacion = ["Ubicación del proyecto", ""];
NOMBRE_DISENO.tensionControlTipo = ["Tipo de tensión de control", ""];
const MOTIVOS = [[/interna/, "Emitido para revisión interna"], [/cliente/, "Emitido para revisión del cliente"], [/aprobacion/, "Emitido para aprobación"], [/construccion/, "Emitido para construcción"], [/conforme a obra|as built/, "Conforme a obra"]];

const VERBO = /\b(cambia|cambialo|cambiala|cambiar|cambiarlo|cambie|cambiale|modifica|modificar|pon|ponlo|ponla|ponle|ponles|poner|ponerlo|actualiza|actualizar|ajusta|ajustar|establece|asigna|agrega|agregar|anade|anadir|incluye|incluir|crea|crear|elimina|eliminar|borra|borrar|quita|quitar|quitale|emite|emitir|renombra|sube|subelo|subela|subir|subirlo|baja|bajalo|bajala|bajar|bajarlo|aumenta|reduce|haz|hazlo|hacer|duplica|reemplaza|sustituye|mueve|muevelo|muevela|muevelos|mover|moverlo|muevas|configura|define|fija|coloca|colocalo|colocala|colocar|ubica|ubicalo|ubicala|reubica|reubicalo|pasa|pasalo|pasala|pasar|lleva|llevalo|llevala|desplaza|desplazalo|traslada|trasladalo|intercambia|intercambialo|intercambiar|permuta|invierte|ordena|reordena|separa|junta|agranda|amplia|achica|disminuye|usa|usar|utiliza|utilizar|deja|dejalo|alinea|centra|acerca|aleja|restablece|restablecer|reinicia)\b/;
const PREGUNTA = /^\s*¿?\s*(que|cual|cuales|cuanto|cuantos|cuantas|como|donde|por que|quien|es|hay)\b/;
export const esOrden = q => { const t = normMapa(q).t; return VERBO.test(t) && !PREGUNTA.test(t); };

function etiquetas(p){
  const out = [];
  for(const t of tableros(p)) out.push({ tag:t.tag, tipo:"tablero", t });
  for(const l of datos(p).cargas) if(l.tag) out.push({ tag:l.tag, tipo:"carga", l });
  for(const i of instrumentos(p)) for(const tag of expandirTag(i.tag)) if(tag) out.push({ tag, tipo:"instrumento", i });
  return out.sort((a,b)=>b.tag.length-a.tag.length);
}
const reTag = tag => new RegExp(`(^|[^a-z0-9])${tag.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}([^a-z0-9]|$)`);
function siguienteTag(lista, pref){
  let max = 0, ancho = 3;
  for(const tag of lista){ const m = String(tag).match(new RegExp("^"+pref.replace(/[-]/g,"\\-")+"(\\d+)")); if(m){ max = Math.max(max, +m[1]); ancho = m[1].length; } }
  return pref + String(max+1).padStart(ancho, "0");
}

/* ---------- interpretar una orden (motor propio) ---------- */
export function interpretar(q, p, forzar){
  const M = normMapa(q), t = M.t, d = datos(p), ops = [];
  if(!forzar && (!VERBO.test(t) || PREGUNTA.test(t))) return null;
  const tags = etiquetas(p).filter(e=>reTag(e.tag).test(t));
  const borrar = /\b(elimina|eliminar|borra|borrar|quita|quitar)\b/.test(t);
  const agregar = /\b(agrega|agregar|anade|anadir|incluye|incluir|crea|crear)\b/.test(t);
  const pot = t.match(/(\d+(?:[.,]\d+)?)\s*(hp|kw)\b/);
  const tabTag = tableros(p).find(x=>reTag(x.tag).test(t));
  // emitir revisión
  if(/\b(emite|emitir)\b/.test(t)){
    const mot = (MOTIVOS.find(([re])=>re.test(t))||[null,"Emitido para revisión del cliente"])[1];
    const rv = q.match(/\brev(?:isi[oó]n)?\.?\s+([A-Z0-9])\b/i);
    return [{ op:"documentos.emitir", motivo: mot, rev: rv ? rv[1].toUpperCase() : "" }];
  }
  // arreglo mecánico del tablero (gabinete, entrada de cables, ventilación, reserva, mandos en puerta…)
  const mec = interpretarMecanico(t, p, tabTag);
  if(mec) return mec;
  // eliminar
  if(borrar){ for(const e of tags.filter(e=>e.tipo!=="tablero")) ops.push({ op: e.tipo+".eliminar", tag: e.tag }); return ops.length ? ops : null; }
  // agregar carga o instrumento
  if(agregar){
    const nuevo = (q.match(/\b([A-Za-z]{1,5}-\d{2,4}[A-Za-z]?)\b/)||[])[1];
    const letras = nuevo ? tipoInstrumento(nuevo.toUpperCase()) : "";
    const esInst = /instrumento|transmisor|interruptor|sensor|switch|indicador|valvula solenoide|solenoide/.test(t) || (letras && /^(P|F|L|T|A|Z|S|V|W|D|PD|X)[A-Z]*$/.test(letras) && letras!=="M" && !pot);
    if(esInst){
      const tag = (nuevo || "").toUpperCase(); if(!tag) return null;
      const desc = textoTras(M, "descripcion") || ((q.match(/["«“(]([^"»”)]+)["»”)]/)||[])[1]) || descInstrumento(tag);
      const lugar = (M.t.match(/\b(?:en|para) (?:la |el |los |las )?(.+)$/)||[])[1];
      return [{ op:"instrumento.agregar", tag, descripcion: limpiar(desc), servicio: lugar ? limpiar(M.orig.slice(M.idx[M.t.lastIndexOf(lugar)])) : "", cantidad: 1 }];
    }
    if(pot || /motor|carga|bomba|ventilador|faja|compresor|agitador|molino|chancadora|extractor|transportador/.test(t)){
      const tag = nuevo ? nuevo.toUpperCase() : siguienteTag(d.cargas.map(l=>l.tag), "M-");
      const entre = (q.match(/["«“(]([^"»”)]+)["»”)]/)||[])[1];
      const ap = (APLIC.find(([re])=>re.test(t))||[])[1] || "otro";
      const desc = entre || textoTras(M, "descripcion|llamad[oa]|nombre") || NOMBRE_APLIC[ap] || "Carga";
      return [{ op:"carga.agregar", tag, descripcion: limpiar(desc), potencia: pot ? num(pot[1]) : 10, unidad: pot ? pot[2] : "hp", arranque: arranqueDe(t) || "dol", tablero: tabTag ? tabTag.tag : "", aplicacion: ap }];
    }
    return null;
  }
  // editar una carga
  const carga = tags.find(e=>e.tipo==="carga");
  if(carga){
    const c = {};
    if(pot) Object.assign(c, { potencia: num(pot[1]), unidad: pot[2] });
    const ar = /arranque|variador|vfd|arrancador|directo|suave/.test(t) ? arranqueDe(t) : null; if(ar) c.arranque = ar;
    if(/longitud|largo|distancia|cable/.test(t)){ const lg = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:m|mts|metros)\b/g)].pop(); if(lg) c.longitud_cable = num(lg[1]); }
    if(tabTag && /tablero|mueve|pasa|asigna|conecta/.test(t)) c.tablero = tabTag.tag;
    const fp = t.match(/(?:fdp|factor de potencia|cos)\D*?(0[.,]\d+)/); if(fp) c.fp = num(fp[1]);
    const ef = t.match(/(?:eficiencia|eff|rendimiento)\D*?(\d+(?:[.,]\d+)?)/); if(ef) c.eficiencia = num(ef[1]);
    const fu = t.match(/(?:\bfu\b|factor de uso|factor de utilizacion)\D*?(\d+(?:[.,]\d+)?)/); if(fu) c.fu = num(fu[1]);
    const fs = t.match(/(?:\bfs\b|simultaneidad)\D*?(\d+(?:[.,]\d+)?)/); if(fs) c.fs = num(fs[1]);
    if(/descripcion|nombre/.test(t)){ const v = textoTras(M, "descripcion|nombre"); if(v) c.descripcion = v; }
    return Object.keys(c).length ? [{ op:"carga.editar", tag: carga.tag, campos: c }] : null;
  }
  // editar un instrumento
  const inst = tags.find(e=>e.tipo==="instrumento");
  if(inst){
    const c = {};
    for(const [re, k] of [["ubicacion", "ubicacion"], ["servicio", "servicio"], ["descripcion", "descripcion"], ["marca", "marca"], ["modelo", "modelo"], ["alimentacion", "alimentacion"], ["rango", "rango"]]) if(new RegExp(re).test(t)){ const v = textoTras(M, re); if(v) c[k] = v; }
    return Object.keys(c).length ? [{ op:"instrumento.editar", tag: inst.tag, campos: c }] : null;
  }
  // tablero: nombre o TAG
  const tab = tags.find(e=>e.tipo==="tablero");
  if(tab && /nombre|tag|renombra/.test(t)){
    const v = textoTras(M, "nombre|tag|renombra(?:r)?"); if(!v) return null;
    return [{ op:"tablero.editar", tag: tab.tag, campos: /\btag\b/.test(t) ? { tag: v.toUpperCase() } : { nombre: v } }];
  }
  // sistema
  if(/sistema/.test(t) && /tag|nombre/.test(t)){ const v = textoTras(M, "tag del sistema|nombre del sistema|sistema"); if(v) return [{ op:"sistema.editar", campos: /tag/.test(t) ? { tag: v.toUpperCase() } : { nombre: v } }]; }
  // datos del proyecto
  for(const [re, k] of [["cliente", "cliente"], ["unidad minera|unidad|planta", "unidad"], ["nombre del proyecto|titulo del proyecto", "nombre"]]){
    if(new RegExp(re).test(t)){ const v = textoTras(M, re); if(v) return [{ op:"proyecto.editar", campos: { [k]: v } }]; }
  }
  if(/etapa/.test(t)){ const e = ETAPAS.find(e=>t.includes(e.id) || t.includes(e.nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace("ingenieria ",""))); if(e) return [{ op:"proyecto.editar", campos: { etapa: e.id } }]; }
  // datos de diseño
  if(/ubicacion del proyecto|region|distrito/.test(t)){ const v = textoTras(M, "ubicacion del proyecto|region|distrito"); if(v) return [{ op:"diseno.editar", campos:{ ubicacion: v } }]; }
  for(const [re, k] of DISENO){
    if(re.test(t)){ const m = t.slice(t.search(re)).match(/(\d+(?:[.,]\d+)?)/); if(m){ const campos = { [k]: num(m[1]) };
      if(k==="tensionControl"){ const tipo = /\bvdc\b|\bdc\b|continua/.test(t) ? "Vdc" : /\bvac\b|\bac\b|alterna/.test(t) ? "Vac" : ""; if(tipo) campos.tensionControlTipo = tipo; }
      return [{ op:"diseno.editar", campos }]; } }
  }
  return null;
}
const MEC = /canaleta|gabinete|envolvente|entrada de cables|ingreso de cables|ventilacion|ventilador|aire acondicionado|montaje (mural|de piso|autosoportado)|\bmural\b|autosoportado|mandos? (en|de) (la )?puerta|pulsadores en (la )?puerta|botonera|calefaccion|resistencia calefactora|temperatura interior|reserva de espacio|arreglo mecanico|dimensiones del tablero|alto del tablero|ancho del tablero|fondo del tablero/;
/* ---------- reubicación de equipos del arreglo mecánico ---------- */
const DIR = /izquierda|derecha|arriba|abajo|\bsub(e|elo|ela|ir|irlo)\b|\bbaj(a|alo|ala|ar|arlo)\b|encima|debajo|mas alto|mas bajo|intercambi|permuta|de lugar|de posicion|en (lugar|vez) de|antes de|despues de|luego de|al lado de|junto a|al inicio|al principio|al final|primer lugar|ultimo lugar|restablec|reinicia|arreglo (automatico|original)|allen|rockwell|powerflex|\babb\b|acs880|puerta de (fuerza|control)|seccion de (fuerza|control)|placa de (fuerza|control)/;
export const pareceAjuste = q => { const t = normMapa(q).t; return DIR.test(t) && !PREGUNTA.test(t) && !/\?/.test(q); };
function arreglos(p){ return tablerosPotencia(p).map(t=>{ try{ const c = calcularTablero(p, t); return c.circuits.length ? { t, m: arregloTablero(p, t, c) } : null; }catch(e){ return null; } }).filter(Boolean); }
function equiposDe(m){
  const out = new Map();
  for(const c of m.comps) if(c.tag) out.set(c.tag, { tag:c.tag, tipo:c.tipo, carga:c.circ && c.circ.carga });
  for(const b of m.bornes) out.set(b.grupo, { tag:b.grupo, tipo:"bornera", carga:b.circ && b.circ.carga });
  for(const d of m.puerta) if(d.tag && !out.has(d.tag)) out.set(d.tag, { tag:d.tag, tipo:"puerta" });
  return [...out.values()].sort((a, b)=>b.tag.length - a.tag.length);
}
const posTag = (t, tag) => { const m = reTag(tag).exec(t); return m ? m.index : -1; };
function interpretarAjuste(t, p, tabTag){
  if(!DIR.test(t)) return null;
  const lista = arreglos(p); if(!lista.length) return null;
  // tablero: el que se nombra, el que contiene el equipo nombrado o el primero
  let sel = tabTag && lista.find(x=>x.t.tag===tabTag.tag);
  const men = []; // equipos mencionados en orden de aparición
  for(const a of (sel ? [sel] : lista)){
    for(const e of equiposDe(a.m)){ const i = posTag(t, e.tag); if(i >= 0 && !men.some(x=>x.e.tag===e.tag || (x.i <= i && i < x.i + x.e.tag.length))) men.push({ e, i, a }); }
    if(men.length && !sel) sel = men[0].a;
  }
  sel = sel || lista[0];
  const m = sel.m, tab = sel.t.tag, eq = equiposDe(m);
  men.sort((a, b)=>a.i - b.i);
  // nombres comunes y cargas: «el variador de VC1», «el guardamotor de VR2», «el interruptor general», «la parada de emergencia»
  const deCarga = (carga, tipo) => { const c = eq.filter(e=>e.carga===carga); return (tipo ? c.find(e=>e.tipo===tipo) : null) || ["variador","arrancador","guardamotor","interruptor","contactor","bornera"].map(k=>c.find(e=>e.tipo===k)).find(Boolean); };
  const tipoNom = /variador|vdf|vfd/.test(t) ? "variador" : /arrancador/.test(t) ? "arrancador" : /guardamotor/.test(t) ? "guardamotor" : /contactor/.test(t) ? "contactor" : /bornera|bornes/.test(t) ? "bornera" : /reactancia|filtro/.test(t) ? "reactancia" : null;
  for(const l of datos(p).cargas){ if(!l.tag) continue; const i = posTag(t, l.tag); if(i < 0 || men.some(x=>x.i===i)) continue; const e = deCarga(l.tag, tipoNom); if(e) men.push({ e, i, a:sel }); }
  men.sort((a, b)=>a.i - b.i);
  if(!men.length){
    if(/interruptor (general|principal)|itm general/.test(t)) men.push({ e:{ tag:"Q1", tipo:"interruptor" }, i:0 });
    else if(/parada de emergencia|\bseta\b|panel de operacion|botonera|pulsadores|luces piloto/.test(t)) men.push({ e:{ tag:"PANEL", tipo:"puerta" }, i:0 });
    else if(tipoNom){ const c = eq.filter(e=>e.tipo===tipoNom); if(c.length===1) men.push({ e:c[0], i:0 }); }
  }
  const campos = {};
  // marca del variador (cambia el cálculo: modelo, bastidor y dimensiones)
  const marca = /allen|rockwell|powerflex/.test(t) ? "rockwell" : /\babb\b|acs880/.test(t) ? "abb" : null;
  const vs = men.filter(x=>x.e.tipo==="variador").map(x=>x.e);
  if(marca && (vs.length || /(todos )?los variadores/.test(t))){
    const objetivo = vs.length ? vs : eq.filter(e=>e.tipo==="variador");
    const ops = objetivo.map(e=>e.carga).filter(Boolean).map(c=>({ op:"carga.editar", tag:c, campos:{ marca_variador:marca } }));
    if(ops.length) return ops;
  }
  if(/restablec|reinicia|arreglo (automatico|original)|como estaba/.test(t)) return [{ op:"mecanico.editar", tag:tab, campos:{ restablecer:true } }];
  // la placa de control a un lado
  if(/placa de control|seccion de control/.test(t) && !men.length && /izquierda|derecha/.test(t)) return [{ op:"mecanico.editar", tag:tab, campos:{ ladoControl: /derecha/.test(t) ? "der" : "izq" } }];
  // panel de operación en otra puerta
  if((/panel|botonera|pulsadores|luces piloto|parada de emergencia/.test(t) || (men[0] && men[0].e.tipo==="puerta")) && /puerta de (fuerza|control)|seccion de (fuerza|control)|placa de (fuerza|control)/.test(t))
    return [{ op:"mecanico.editar", tag:tab, campos:{ panelSeccion: /de fuerza/.test(t) ? "potencia" : "auto" } }];
  if(!men.length) return null;
  const x = men[0].e, ref = men[1] ? men[1].e.tag : "";
  const accion = /intercambi|permuta|de lugar|de posicion|en (lugar|vez) de/.test(t) && ref ? "intercambiar"
    : /antes de|a la izquierda de|delante de/.test(t) && ref ? "antes"
    : /despues de|luego de|a la derecha de|al lado de|junto a/.test(t) && ref ? "despues"
    : /al inicio|al principio|primer lugar|primero/.test(t) ? "inicio" : /al final|ultimo lugar/.test(t) ? "final"
    : /izquierda/.test(t) ? "izquierda" : /derecha/.test(t) ? "derecha"
    : /arriba|\bsub(e|elo|ela|ir|irlo)\b|encima|mas alto/.test(t) ? "arriba" : /abajo|\bbaj(a|alo|ala|ar|arlo)\b|debajo|mas bajo/.test(t) ? "abajo" : null;
  if(!accion) return null;
  const veces = Math.min(5, +((t.match(/(\d)\s*(posiciones|lugares|espacios|filas|columnas)/)||[])[1]) || ({ dos:2, tres:3, cuatro:4 })[(t.match(/\b(dos|tres|cuatro) (posiciones|lugares|espacios|filas|columnas)/)||[])[1]] || 1);
  return Array.from({ length: ["antes","despues","intercambiar","inicio","final"].includes(accion) ? 1 : veces }, ()=>({ op:"mecanico.mover", tag:tab, equipo:x.tag, tipo:x.tipo, accion, ref: ["antes","despues","intercambiar"].includes(accion) ? ref : "" }));
}
/* datos de un equipo del arreglo (para preguntas: «¿dónde está VDFC1?», «¿qué hay a la derecha de Q1?») */
export function infoEquipo(q, p){
  const t = normMapa(q).t;
  for(const a of arreglos(p)){
    const m = a.m, c = m.comps.filter(x=>x.tag).sort((x, y)=>y.tag.length - x.tag.length).find(x=>posTag(t, x.tag) >= 0);
    if(!c) continue;
    const pl = m.placas.find(x=>x.id===c.placa) || {};
    const fila = m.comps.filter(x=>x.tag && x!==c && x.placa===c.placa && x.y < c.y + c.h && c.y < x.y + x.h).sort((x, y)=>x.x - y.x);
    const izq = fila.filter(x=>x.x + x.w <= c.x + 1).pop(), der = fila.find(x=>x.x >= c.x + c.w - 1);
    const f = v => Math.round(v*10)/10;
    return `<b>${esc(c.tag)}</b> (${esc(a.t.tag)}): ${esc(c.desc||"")}<br>Modelo: ${esc(c.modelo||"—")}<br>Dimensiones: ${f(c.w)} × ${f(c.h)} × ${f(c.d||0)} mm (ancho × alto × fondo)<br>Ubicación: ${esc(pl.nombre||c.placa||"")}${c.fila ? `, fila «${esc(c.fila)}»` : ""}, a ${Math.round(c.y)} mm de la base del gabinete<br>A su izquierda: <b>${esc(izq ? izq.tag : "—")}</b> · a su derecha: <b>${esc(der ? der.tag : "—")}</b><br><span class="cp-nota">${c.tag==="Q1" ? "Para reubicarlo dime, por ejemplo: «Pon el interruptor general a la izquierda»." : `Para reubicarlo dime, por ejemplo: «Mueve ${esc(c.tag)} a la derecha» o «Intercambia ${esc(c.tag)} con ${esc((der||izq||{}).tag || "…")}».`}</span>`;
  }
  return null;
}
/* qué se le puede pedir a Copito sobre un equipo del arreglo */
export function ayudaEquipo(q, p){
  const t = normMapa(q).t;
  for(const a of arreglos(p)) for(const e of equiposDe(a.m)) if(posTag(t, e.tag) >= 0)
    return `Para <b>${esc(e.tag)}</b> en ${esc(a.t.tag)} puedo: moverlo a la izquierda o a la derecha, ${e.tipo==="variador" ? "subirlo o bajarlo dentro de su columna, cambiar su marca (ABB o Allen-Bradley)," : "subir o bajar su fila,"} ponerlo antes o después de otro equipo o intercambiarlo con otro. Por ejemplo: «Mueve ${esc(e.tag)} a la derecha», «Intercambia ${esc(e.tag)} con …» o «${e.tipo==="variador" ? `Baja ${esc(e.tag)}` : `Sube la fila de ${esc(e.tag)}`}».`;
  return null;
}
function interpretarMecanico(t, p, tabTag){
  const aj = interpretarAjuste(t, p, tabTag); if(aj) return aj;
  if(!MEC.test(t)) return null;
  const pot = tablerosPotencia(p); if(!pot.length) return null;
  const tab = tabTag && pot.find(x=>x.tag===tabTag.tag) ? tabTag.tag : pot[0].tag;
  // los TAG (de tableros, equipos o cargas) no se confunden con medidas: se quitan antes de leer los números
  for(const x of tableros(p)) t = t.split(x.tag.toLowerCase()).join(" ");
  t = t.replace(/\b[a-z]{1,5}-?\d{1,4}(\.[a-z]\d+)?\b/g, m=>/^\d/.test(m) ? m : " ");
  const c = {};
  const dims = t.match(/(\d{3,4})\s*(?:x|×|por)\s*(\d{3,4})(?:\s*(?:x|×|por)\s*(\d{3,4}))?/);
  if(dims){ c.ancho = +dims[1]; c.alto = +dims[2]; if(dims[3]) c.fondo = +dims[3]; }
  for(const [re, k] of [[/(?:alto|altura)\D{0,40}?(\d{3,4})/, "alto"], [/ancho\D{0,40}?(\d{3,4})/, "ancho"], [/(?:fondo|profundidad)\D{0,40}?(\d{3,4})/, "fondo"]]){ const m2 = t.match(re); if(m2 && !dims) c[k] = +m2[1]; }
  if(/(gabinete|dimensiones).*(automatic|como estaba|por defecto)/.test(t)){ c.ancho = ""; c.alto = ""; c.fondo = ""; }
  if(/entrada|ingreso/.test(t)){ if(/superior|por arriba|por encima/.test(t)) c.entrada = "superior"; else if(/inferior|por abajo|por debajo/.test(t)) c.entrada = "inferior"; }
  if(/\bmural\b|a la pared|adosado/.test(t)) c.montaje = "mural"; else if(/autosoportado|de piso|sobre el piso/.test(t)) c.montaje = "piso"; else if(/montaje automatico/.test(t)) c.montaje = "auto";
  if(/ventilacion|ventilador/.test(t)){ if(/natural|sin ventilador/.test(t)) c.ventilacion = "natural"; else if(/automatica|segun (el )?balance/.test(t)) c.ventilacion = "auto"; else if(/forzada|con ventilador|agrega|pon/.test(t)) c.ventilacion = "forzada"; }
  const res = t.match(/reserva(?: de espacio)?\D{0,30}?(\d{1,2})\s*%?/); if(res) c.reserva = +res[1];
  if(/mandos?|pulsadores|botonera/.test(t)){ if(/\b(sin|quita|quitar|elimina|eliminar|retira|retirar|saca)\b/.test(t)) c.mandos = "no"; else if(/automatic/.test(t)) c.mandos = "auto"; else c.mandos = "si"; }
  if(/calefaccion|resistencia calefactora/.test(t)){ if(/\b(sin|quita|quitar|elimina|eliminar|retira)\b/.test(t)) c.calefaccion = "no"; else if(/automatic/.test(t)) c.calefaccion = "auto"; else c.calefaccion = "si"; }
  const ti = t.match(/temperatura interior\D{0,30}?(\d{2})/); if(ti) c.tInterior = +ti[1];
  const cn = t.match(/canaletas?\D{0,30}?(\d{2,3})\s*(?:x|×|por)\s*(\d{2,3})/); if(cn) c.canaleta = `${cn[1]}x${cn[2]}`;
  return Object.keys(c).length ? [{ op:"mecanico.editar", tag: tab, campos: c }] : null;
}
const NOMBRE_MEC = { canaleta:["canaletas","mm"], ladoControl:["placa de control",""], panelSeccion:["panel de operación",""], restablecer:["arreglo",""], ancho:["ancho del gabinete","mm"], alto:["alto del gabinete","mm"], fondo:["fondo del gabinete","mm"], entrada:["entrada de cables",""], montaje:["montaje",""], ventilacion:["ventilación",""], reserva:["reserva de espacio","%"], mandos:["mandos en la puerta",""], calefaccion:["calefacción anticondensación",""], tInterior:["temperatura interior máxima","°C"] };
const VAL_MEC = { izq:"a la izquierda", der:"a la derecha", potencia:"en la puerta de fuerza", auto:"automático", piso:"autosoportado", mural:"mural", si:"sí", no:"no", natural:"natural", forzada:"forzada", inferior:"inferior", superior:"superior" };
function descInstrumento(tag){
  const L = tipoInstrumento(tag); const v = VARIABLE[L.slice(0,2)] && L.startsWith("PD") ? VARIABLE.PD : VARIABLE[L[0]] || "proceso";
  if(/^XV|^SV|Y$/.test(L)) return "Válvula solenoide";
  if(/T$/.test(L)) return `Transmisor de ${v}`;
  if(/S(H|L|HH|LL)?$/.test(L.slice(1))) return `Interruptor de ${v}${/H/.test(L.slice(-2))?" alto":/L/.test(L.slice(-2))?" bajo":""}`;
  if(/I$/.test(L)) return `Indicador de ${v}`;
  return `Instrumento de ${v}`;
}

/* ---------- descripción para confirmar ---------- */
const fmt = v => typeof v==="number" ? v.toLocaleString("es-PE", { maximumFractionDigits:2 }) : String(v);
export function describir(op, p){
  const d = datos(p), c = op.campos || {};
  const carga = () => d.cargas.find(l=>l.tag===op.tag) || {};
  switch(op.op){
    case "carga.agregar": return `Agregar la carga <b>${esc(op.tag)}</b> «${esc(op.descripcion||"")}», ${fmt(op.potencia)} ${String(op.unidad||"hp").toUpperCase()}, arranque ${esc(LBL_ARR[op.arranque]||op.arranque||"directo")}, en ${esc(op.tablero || tf(p).tag)}`;
    case "carga.eliminar": return `Eliminar la carga <b>${esc(op.tag)}</b>`;
    case "carga.editar": { const l = carga(), r = [];
      if(c.potencia!=null) r.push(`potencia ${fmt(l.power)} ${String(l.powerUnit).toUpperCase()} → <b>${fmt(c.potencia)} ${String(c.unidad||l.powerUnit).toUpperCase()}</b>`);
      if(c.arranque) r.push(`arranque ${esc(LBL_ARR[l.starter]||l.starter)} → <b>${esc(LBL_ARR[c.arranque]||c.arranque)}</b>`);
      if(c.longitud_cable!=null) r.push(`longitud del cable ${fmt(l.cableLength)} m → <b>${fmt(c.longitud_cable)} m</b>`);
      if(c.tablero) r.push(`tablero → <b>${esc(c.tablero)}</b>`);
      for(const [k, n] of [["fp","FDP"],["eficiencia","EFF %"],["fu","FU"],["fs","FS"]]) if(c[k]!=null) r.push(`${n} → <b>${fmt(c[k])}</b>`);
      if(c.descripcion) r.push(`descripción → <b>${esc(c.descripcion)}</b>`);
      if(c.marca_variador) r.push(`marca del variador ${l.vfdBrand==="rockwell" ? "Allen-Bradley" : "ABB"} → <b>${c.marca_variador==="rockwell" ? "Allen-Bradley PowerFlex 755" : "ABB ACS880"}</b>`);
      return `<b>${esc(op.tag)}</b>: ${r.join(", ")}`; }
    case "instrumento.agregar": return `Agregar el instrumento <b>${esc(op.tag)}</b> «${esc(op.descripcion||"")}»${op.servicio?`, ${esc(op.servicio)}`:""} (${esc(senalDe(op.tag).tipoSenal.toLowerCase())})`;
    case "instrumento.eliminar": return `Eliminar el instrumento <b>${esc(op.tag)}</b>`;
    case "instrumento.editar": return `<b>${esc(op.tag)}</b>: ${Object.entries(c).map(([k,v])=>`${esc(CAMPO[k]||k)} → <b>${esc(v)}</b>`).join(", ")}`;
    case "tablero.editar": return `Tablero <b>${esc(op.tag)}</b>: ${Object.entries(c).map(([k,v])=>`${k==="tag"?"TAG":k} → <b>${esc(v)}</b>`).join(", ")}`;
    case "sistema.editar": return `Sistema: ${Object.entries(c).map(([k,v])=>`${k==="tag"?"TAG":"nombre"} → <b>${esc(v)}</b>`).join(", ")}`;
    case "proyecto.editar": return `Proyecto: ${Object.entries(c).map(([k,v])=>`${CAMPO[k]||k} «${esc(k==="etapa" ? (ETAPAS.find(e=>e.id===p.etapa)||{}).nombre : p[k]||"—")}» → <b>${esc(k==="etapa" ? (ETAPAS.find(e=>e.id===v)||{}).nombre||v : v)}</b>`).join(", ")}`;
    case "diseno.editar": { const v = valoresDiseno(p); return Object.entries(c).map(([k,x])=>{ const [n,u] = NOMBRE_DISENO[k]||[k,""]; return `${esc(n)}: ${esc(v[k]??"—")} ${u} → <b>${esc(fmt(x))} ${u}</b>`; }).join("<br>"); }
    case "mecanico.mover": {
      const quien = op.equipo==="PANEL" ? "el panel de operación" : op.equipo;
      const vert = op.accion==="arriba" || op.accion==="abajo";
      const como = vert && op.tipo==="variador" ? `más ${op.accion} en su columna` : vert && (op.tipo==="puerta" || op.equipo==="PANEL") ? `150 mm más ${op.accion} en la puerta` : vert ? `${op.accion==="arriba" ? "una fila más arriba" : "una fila más abajo"} (con toda su fila)` : (ACCIONES_MOVER[op.accion]||op.accion);
      return op.accion==="intercambiar" ? `Arreglo de <b>${esc(op.tag)}</b>: intercambiar <b>${esc(quien)}</b> con <b>${esc(op.ref)}</b>` : `Arreglo de <b>${esc(op.tag)}</b>: mover <b>${esc(quien)}</b> ${esc(como)}${op.ref ? ` <b>${esc(op.ref)}</b>` : ""}`; }
    case "mecanico.editar": { const t = tablerosPotencia(p).find(x=>x.tag===op.tag); const cfg = t ? cfgMecanico(p, t) : {};
      if(c.restablecer) return `Arreglo de <b>${esc(op.tag)}</b>: <b>volver al arreglo automático</b> (se quitan las reubicaciones pedidas)`;
      return `Arreglo mecánico de <b>${esc(op.tag)}</b>: ${Object.entries(c).map(([k, v])=>{ const [n, u] = NOMBRE_MEC[k]||[k,""]; const ant = cfg[k]==="" || cfg[k]==null ? "automático" : (VAL_MEC[cfg[k]]||cfg[k]) + (u && cfg[k]!=="" ? " "+u : ""); const nv = v==="" ? "automático" : (VAL_MEC[v]||v) + (u ? " "+u : ""); return `${esc(n)} ${esc(ant)} → <b>${esc(nv)}</b>`; }).join(", ")}`; }
    case "documentos.emitir": return `Emitir ${op.rev ? "la revisión <b>"+esc(op.rev)+"</b>" : "la siguiente revisión"} de los <b>${p.entregables.length}</b> documentos: «${esc(op.motivo)}»`;
  }
  return esc(op.op);
}
function senalDe(tag){
  const L = tipoInstrumento(tag);
  if(/^(XV|SV|FV|PV|LV|TV|HV|XY|SY)$/.test(L)) return { tipoSenal:"Discreta", senal:"N. A.", alimentacion:"120 Vac" };
  if(/T$/.test(L)) return { tipoSenal:"Analógica", senal:"4 - 20 mA", alimentacion:"24 Vdc / Loop Powered" };
  return { tipoSenal:"Discreta", senal:"Contacto seco", alimentacion:"120 Vac" };
}

/* ---------- aplicar, impacto y deshacer ---------- */
function foto(p){
  const v = valoresDiseno(p);
  const md = tablerosPotencia(p).map(t=>{ const c = calcularTablero(p, t); return { tag:t.tag, md:c.totalKVA||0, i:c.demandCurrent||0, itm:c.mainBreaker, n:c.circuits.length }; });
  let caidas = 0; try{ caidas = cablesFuerza(p).filter(f=>(f.dv||0) > (+v.caidaTension||2.5)).length; }catch(e){}
  const mec = tablerosPotencia(p).map(t=>{ try{ const c = calcularTablero(p, t); if(!c.circuits.length) return null; const m = arregloTablero(p, t, c); return { tag:t.tag, gab:`${m.W} × ${m.H} × ${m.D} mm`, vent:m.termico.modo, n:m.comps.length, avisos:m.avisos.length, pos:Object.fromEntries(m.comps.filter(x=>x.tag).map(x=>[x.tag, `${Math.round(x.x)},${Math.round(x.y)},${x.seccion}`])), mod:Object.fromEntries(m.comps.filter(x=>x.tag).map(x=>[x.tag, x.modelo])) }; }catch(e){ return null; } }).filter(Boolean);
  return { md, cargas: datos(p).cargas.length, inst: instrumentos(p).length, io: (datos(p)["ins-io"]||[]).length, caidas, mec };
}
export function aplicar(p, ops){
  const antes = foto(p), copia = JSON.parse(JSON.stringify(p));
  const d = datos(p); let regenerarIO = false; const avisos = [];
  const tabId = tag => (tableros(p).find(t=>t.tag.toUpperCase()===String(tag||"").toUpperCase())||{}).id;
  for(const op of ops){
    const c = op.campos || {};
    if(op.op==="carga.agregar"){
      if(d.cargas.some(l=>l.tag===op.tag)){ avisos.push(`${op.tag} ya existe; no se agregó.`); continue; }
      const l = nuevaCarga("motor", tabId(op.tablero) || tf(p).id);
      Object.assign(l, { tag: op.tag, desc: op.descripcion||"", power: +op.potencia||10, powerUnit: /kw/i.test(op.unidad) ? "kw" : "hp", starter: ["dol","vfd","ss"].includes(op.arranque) ? op.arranque : "dol", application: op.aplicacion||"otro" });
      aplicarTipicos(l); d.cargas.push(l); regenerarIO = true;
    } else if(op.op==="carga.eliminar"){
      const n = d.cargas.length; d.cargas = d.cargas.filter(l=>l.tag!==op.tag); if(d.cargas.length!==n) regenerarIO = true;
    } else if(op.op==="carga.editar"){
      const l = d.cargas.find(l=>l.tag===op.tag); if(!l){ avisos.push(`No encontré ${op.tag}.`); continue; }
      l.man = l.man || {};
      if(c.potencia!=null && !isNaN(+c.potencia)){ l.power = +c.potencia; if(c.unidad) l.powerUnit = /kw/i.test(c.unidad) ? "kw" : "hp"; }
      if(c.arranque && ["dol","vfd","ss"].includes(c.arranque)){ l.starter = c.arranque; regenerarIO = true; }
      if(c.longitud_cable!=null && !isNaN(+c.longitud_cable)) l.cableLength = +c.longitud_cable;
      if(c.tablero){ const id = tabId(c.tablero); if(id) l.tablero = id; else avisos.push(`No existe el tablero ${c.tablero}.`); }
      if(c.descripcion) l.desc = c.descripcion;
      for(const [k, f] of [["fp","fp"],["eficiencia","effPct"],["fu","fu"],["fs","fs"]]) if(c[k]!=null && !isNaN(+c[k])){ l[f] = +c[k]; l.man[f] = true; }
      if(c.marca_variador==="abb" || c.marca_variador==="rockwell") l.vfdBrand = c.marca_variador;
      aplicarTipicos(l);
    } else if(op.op==="instrumento.agregar"){
      if(instrumentos(p).some(i=>i.tag===op.tag)){ avisos.push(`${op.tag} ya existe; no se agregó.`); continue; }
      d["ins-instrumentos"].push(Object.assign({ sistema:(d.sistema.nombre||"").toUpperCase(), cant: +op.cantidad||1, tag: op.tag, descripcion: op.descripcion||descInstrumento(op.tag), servicio: op.servicio||"", ubicacion: op.ubicacion||"", marca:"", modelo:"" }, senalDe(op.tag), op.senal ? { senal: op.senal } : {}, op.alimentacion ? { alimentacion: op.alimentacion } : {}));
      regenerarIO = true;
    } else if(op.op==="instrumento.eliminar"){
      const n = d["ins-instrumentos"].length; d["ins-instrumentos"] = d["ins-instrumentos"].filter(i=>!expandirTag(i.tag).includes(op.tag)); if(n!==d["ins-instrumentos"].length) regenerarIO = true;
    } else if(op.op==="instrumento.editar"){
      const i = instrumentos(p).find(i=>expandirTag(i.tag).includes(op.tag)); if(!i){ avisos.push(`No encontré ${op.tag}.`); continue; }
      for(const k of ["descripcion","servicio","ubicacion","marca","modelo","alimentacion","rango","senal"]) if(c[k]!=null && c[k]!=="") i[k] = c[k];
    } else if(op.op==="tablero.editar"){
      const t = tableros(p).find(t=>t.tag===op.tag); if(!t){ avisos.push(`No existe el tablero ${op.tag}.`); continue; }
      if(c.nombre) t.nombre = c.nombre;
      if(c.tag && c.tag!==t.tag){ if(tableros(p).some(x=>x.tag===c.tag)){ avisos.push(`El TAG ${c.tag} ya existe.`); } else { instrumentos(p).forEach(x=>{ if(x.tablero===t.tag) x.tablero = c.tag; }); (d["ins-io"]||[]).forEach(x=>{ if(x.tablero===t.tag) x.tablero = c.tag; }); t.tag = c.tag; } }
    } else if(op.op==="sistema.editar"){
      if(c.nombre!=null) d.sistema.nombre = c.nombre; if(c.tag!=null) d.sistema.tag = c.tag;
    } else if(op.op==="proyecto.editar"){
      for(const k of ["nombre","cliente","unidad"]) if(c[k]!=null && c[k]!=="") p[k] = c[k];
      if(c.etapa && ETAPAS.some(e=>e.id===c.etapa)) p.etapa = c.etapa;
    } else if(op.op==="diseno.editar"){
      p.diseno = p.diseno || {};
      for(const [k, v] of Object.entries(c)) if(NOMBRE_DISENO[k] && v!=null && v!=="" && (k!=="tensionControlTipo" || v==="Vac" || v==="Vdc")) p.diseno[k] = String(v);
    } else if(op.op==="mecanico.mover"){
      const t = tablerosPotencia(p).find(x=>x.tag===op.tag); if(!t){ avisos.push(`No existe el tablero de fuerza ${op.tag}.`); continue; }
      const cfg = cfgMecanico(p, t);
      cfg.mover.push({ equipo:op.equipo, accion:op.accion, ref:op.ref||"" });
      // si el motor no puede aplicar la reubicación, se retira y se explica por qué
      try{ const m = arregloTablero(p, t); const a = m.ajustes[m.ajustes.length-1]; if(a && !a.ok){ cfg.mover.pop(); avisos.push(`No moví ${op.equipo}: ${a.nota}.`); } }catch(e){ cfg.mover.pop(); avisos.push(`No se pudo reubicar ${op.equipo}.`); }
    } else if(op.op==="mecanico.editar"){
      const t = tablerosPotencia(p).find(x=>x.tag===op.tag); if(!t){ avisos.push(`No existe el tablero de fuerza ${op.tag}.`); continue; }
      const cfg = cfgMecanico(p, t);
      if(c.restablecer){ Object.assign(cfg, { mover:[], ladoControl:"izq", q1Lado:"auto", panelSeccion:"auto", panelAltura:0, canaleta:"" }); continue; }
      if(c.ladoControl==="izq" || c.ladoControl==="der") cfg.ladoControl = c.ladoControl;
      if(c.panelSeccion==="potencia" || c.panelSeccion==="auto") cfg.panelSeccion = c.panelSeccion;
      if(c.canaleta!=null){ if(c.canaleta==="" || /^\d{2,3}x\d{2,3}$/.test(c.canaleta)) cfg.canaleta = c.canaleta; else avisos.push(`Tamaño de canaleta no válido: ${c.canaleta}.`); }
      const okVal = { entrada:["inferior","superior"], montaje:["auto","piso","mural"], ventilacion:["auto","natural","forzada"], mandos:["auto","si","no"], calefaccion:["auto","si","no"] };
      for(const [k, v] of Object.entries(c)){
        if(okVal[k]){ if(okVal[k].includes(v)) cfg[k] = v; else avisos.push(`Valor no válido para ${k}: ${v}.`); }
        else if(["ancho","alto","fondo","reserva","tInterior"].includes(k)){ if(v==="" || v==null) cfg[k] = ""; else if(+v>0) cfg[k] = +v; else avisos.push(`Valor no válido para ${k}: ${v}.`); }
      }
    } else if(op.op==="documentos.emitir"){
      const o = S.load().org, firmas = { elaboro:o.elaboraPor||"", reviso:o.revisaPor||"", aprobo:o.apruebaPor||"" };
      const hoy = new Date().toISOString().slice(0,10), rev = String(op.rev||"").toUpperCase();
      for(const id of p.entregables){
        const doc = p.documentos[id]; if(!doc) continue; docInfo(p, id);
        const last = doc.revisiones[doc.revisiones.length-1];
        const fila = Object.assign({ rev: rev || last.rev, fecha: hoy, descripcion: op.motivo }, firmas);
        if((!doc.emitida && doc.revisiones.length===1 && !rev) || (rev && rev===String(last.rev).toUpperCase())) Object.assign(last, fila);
        else { if(!rev) fila.rev = nextRev(last.rev); doc.revisiones.push(fila); }
        doc.emitida = true; doc.estado = /interna/.test(op.motivo) ? "Para revisión" : "Emitido"; docInfo(p, id);
      }
    }
  }
  if(regenerarIO) d["ins-io"] = derivarIO(p);
  S.save();
  return { copia, impacto: impacto(antes, foto(p), regenerarIO), avisos };
}
function impacto(a, b, io){
  const r = [], f = v => (+v).toLocaleString("es-PE", { maximumFractionDigits:1 });
  for(const t of b.md){ const x = a.md.find(y=>y.tag===t.tag); if(!x) continue;
    if(Math.abs(x.md - t.md) > 0.05 || x.itm!==t.itm) r.push(`${t.tag}: máxima demanda ${f(x.md)} → <b>${f(t.md)} kVA</b>, I ${f(x.i)} → ${f(t.i)} A${x.itm!==t.itm ? `, ITM general 3x${x.itm} → <b>3x${t.itm} A</b>` : ""}`); }
  if(a.cargas!==b.cargas) r.push(`Cargas: ${a.cargas} → <b>${b.cargas}</b>`);
  if(a.inst!==b.inst) r.push(`Instrumentos: ${a.inst} → <b>${b.inst}</b>`);
  if(io && a.io!==b.io) r.push(`Señales del listado I/O: ${a.io} → <b>${b.io}</b> (regenerado)`);
  if(a.caidas!==b.caidas) r.push(`Cables que superan la caída de tensión: ${a.caidas} → <b>${b.caidas}</b>`);
  for(const m of (b.mec||[])){ const x = (a.mec||[]).find(y=>y.tag===m.tag); if(!x) continue;
    if(x.gab!==m.gab) r.push(`${m.tag}: gabinete ${x.gab} → <b>${m.gab}</b>`);
    if(x.vent!==m.vent) r.push(`${m.tag}: ventilación ${x.vent} → <b>${m.vent}</b>`);
    const mov = Object.keys(m.pos).filter(k=>x.pos[k] && x.pos[k]!==m.pos[k]);
    if(mov.length) r.push(`${m.tag}: ${mov.length} equipo(s) reubicado(s) en el plano: <b>${mov.slice(0, 8).join(", ")}${mov.length > 8 ? "…" : ""}</b>`);
    const cam = Object.keys(m.mod).filter(k=>x.mod[k] && x.mod[k]!==m.mod[k]);
    if(cam.length) r.push(`${m.tag}: ${cam.slice(0, 4).map(k=>`${k} → <b>${m.mod[k]}</b>`).join(", ")}`);
    if(x.avisos!==m.avisos) r.push(`${m.tag}: observaciones del arreglo ${x.avisos} → <b>${m.avisos}</b> (ver Datos de entrada del plano mecánico)`); }
  return r;
}
export function deshacer(p, copia){
  for(const k of Object.keys(p)) delete p[k];
  Object.assign(p, JSON.parse(JSON.stringify(copia)));
  S.save();
}

/* ---------- herramienta para el modo IA ---------- */
export const HERRAMIENTA = {
  name: "proponer_cambios",
  description: "Propone cambios a los datos de un proyecto de Ingenia a partir de lo que pide el usuario. Los cambios se muestran al usuario y solo se aplican si los confirma. Úsala siempre que el usuario pida agregar, cambiar, eliminar o emitir algo.",
  input_schema: { type:"object", properties: {
    proyecto_id: { type:"string", description:"id del proyecto (campo id del JSON de contexto)" },
    resumen: { type:"string", description:"una frase con lo que se va a cambiar" },
    operaciones: { type:"array", items: { type:"object", properties: {
      op: { type:"string", enum:["carga.agregar","carga.editar","carga.eliminar","instrumento.agregar","instrumento.editar","instrumento.eliminar","tablero.editar","sistema.editar","proyecto.editar","diseno.editar","mecanico.editar","mecanico.mover","documentos.emitir"] },
      equipo: { type:"string", description:"mecanico.mover: TAG del equipo del arreglo (p. ej. VDFC1, GCC2, TB3, Q1, PANEL)" }, accion: { type:"string", enum:["izquierda","derecha","arriba","abajo","inicio","final","antes","despues","intercambiar"] }, ref: { type:"string", description:"mecanico.mover: TAG de referencia para antes / despues / intercambiar" },
      tag: { type:"string", description:"TAG de la carga, instrumento o tablero" },
      descripcion: { type:"string" }, potencia: { type:"number" }, unidad: { type:"string", enum:["hp","kw"] },
      arranque: { type:"string", enum:["dol","vfd","ss"], description:"dol = directo, vfd = variador, ss = arrancador suave" },
      tablero: { type:"string", description:"TAG del tablero" }, aplicacion: { type:"string", enum:["bomba-centrifuga","ventilador-centrifugo","ventilador-axial","faja-transportadora","valvula-rotativa","compresor-piston","molino","chancadora","agitador","otro"] },
      servicio: { type:"string" }, ubicacion: { type:"string" }, cantidad: { type:"number" },
      motivo: { type:"string", enum:["Emitido para revisión interna","Emitido para revisión del cliente","Emitido para aprobación","Emitido para construcción","Conforme a obra"] }, rev: { type:"string" },
      campos: { type:"object", description:"Campos a cambiar. carga.editar: potencia, unidad, arranque, longitud_cable (m), tablero, descripcion, fp, eficiencia, fu, fs. instrumento.editar: descripcion, servicio, ubicacion, marca, modelo, alimentacion, rango, senal. tablero.editar: nombre, tag. sistema.editar: nombre, tag. proyecto.editar: nombre, cliente, unidad (unidad minera / planta), etapa (conceptual/basica/detalle). diseno.editar: tension (Vac), frecuencia, tensionControl, tensionControlTipo (Vac o Vdc), tensionInstr (Vdc), icc, altitud, tempMin, tempMax (es la temperatura de diseño), ubicacion, caidaTension, caidaAlimentador, reservaIO. mecanico.editar (arreglo mecánico del tablero de fuerza tag): ancho, alto, fondo (mm, \"\" = automático), entrada (inferior|superior), montaje (auto|piso|mural), ventilacion (auto|natural|forzada), reserva (%), mandos (auto|si|no), calefaccion (auto|si|no), tInterior (°C)." },
    }, required:["op"] } },
  }, required:["resumen","operaciones"] },
};

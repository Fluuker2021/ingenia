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
const CAMPO = { ubicacion:"ubicación", servicio:"servicio", descripcion:"descripción", marca:"marca", modelo:"modelo", alimentacion:"alimentación", rango:"rango", senal:"señal", nombre:"nombre", cliente:"cliente", unidad:"unidad", codigo:"código", area:"área", etapa:"etapa" };
const LBL_ARR = { dol:"directo", vfd:"variador", ss:"arrancador suave" };
const VARIABLE = { P:"presión", PD:"presión diferencial", F:"flujo", L:"nivel", T:"temperatura", A:"análisis", Z:"posición", S:"velocidad", V:"vibración", W:"peso", D:"densidad", H:"manual" };
const DISENO = [
  [/tension de control|voltaje de control/, "tensionControl", "Tensión de control", "VAC"],
  [/tension de instrumentacion/, "tensionInstr", "Tensión de instrumentación", "VDC"],
  [/caida de tension.*alimentador/, "caidaAlimentador", "Caída de tensión en alimentadores", "%"],
  [/caida de tension/, "caidaTension", "Caída de tensión admisible", "%"],
  [/tension|voltaje/, "tension", "Tensión de fuerza", "V"],
  [/frecuencia/, "frecuencia", "Frecuencia", "Hz"],
  [/altitud|altura/, "altitud", "Altitud", "m s.n.m."],
  [/temperatura (maxima|max)/, "tempMax", "Temperatura máxima", "°C"],
  [/temperatura (minima|min)/, "tempMin", "Temperatura mínima", "°C"],
  [/temperatura( ambiente)? de diseno|temperatura/, "tempDiseno", "Temperatura de diseño", "°C"],
  [/cortocircuito|\bicc\b/, "icc", "Nivel de cortocircuito", "kA"],
  [/humedad/, "humedad", "Humedad relativa", "%"],
  [/reserva (de )?(canales )?i\/?o|reserva de senales/, "reservaIO", "Reserva de canales I/O", "%"],
];
const NOMBRE_DISENO = Object.fromEntries(DISENO.map(([, k, n, u])=>[k, [n, u]]));
NOMBRE_DISENO.ubicacion = ["Ubicación del proyecto", ""];
const MOTIVOS = [[/interna/, "Emitido para revisión interna"], [/cliente/, "Emitido para revisión del cliente"], [/aprobacion/, "Emitido para aprobación"], [/construccion/, "Emitido para construcción"], [/conforme a obra|as built/, "Conforme a obra"]];

const VERBO = /\b(cambia|cambiar|cambie|cambiale|modifica|modificar|pon|ponle|poner|actualiza|actualizar|ajusta|ajustar|establece|asigna|agrega|agregar|anade|anadir|incluye|incluir|crea|crear|elimina|eliminar|borra|borrar|quita|quitar|emite|emitir|renombra|sube|baja|aumenta|reduce|haz|hacer|duplica|reemplaza|sustituye|mueve|configura|define|fija)\b/;
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
export function interpretar(q, p){
  const M = normMapa(q), t = M.t, d = datos(p), ops = [];
  if(!VERBO.test(t) || PREGUNTA.test(t)) return null;
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
  for(const [re, k] of [["cliente", "cliente"], ["unidad|planta", "unidad"], ["nombre del proyecto|titulo del proyecto", "nombre"], ["codigo del proyecto", "codigo"], ["\\barea\\b", "area"]]){
    if(new RegExp(re).test(t)){ const v = textoTras(M, re); if(v) return [{ op:"proyecto.editar", campos: { [k]: v } }]; }
  }
  if(/etapa/.test(t)){ const e = ETAPAS.find(e=>t.includes(e.id) || t.includes(e.nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace("ingenieria ",""))); if(e) return [{ op:"proyecto.editar", campos: { etapa: e.id } }]; }
  // datos de diseño
  if(/ubicacion del proyecto|region|distrito/.test(t)){ const v = textoTras(M, "ubicacion del proyecto|region|distrito"); if(v) return [{ op:"diseno.editar", campos:{ ubicacion: v } }]; }
  for(const [re, k] of DISENO){
    if(re.test(t)){ const m = t.slice(t.search(re)).match(/(\d+(?:[.,]\d+)?)/); if(m) return [{ op:"diseno.editar", campos: { [k]: num(m[1]) } }]; }
  }
  return null;
}
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
      return `<b>${esc(op.tag)}</b>: ${r.join(", ")}`; }
    case "instrumento.agregar": return `Agregar el instrumento <b>${esc(op.tag)}</b> «${esc(op.descripcion||"")}»${op.servicio?`, ${esc(op.servicio)}`:""} (${esc(senalDe(op.tag).tipoSenal.toLowerCase())})`;
    case "instrumento.eliminar": return `Eliminar el instrumento <b>${esc(op.tag)}</b>`;
    case "instrumento.editar": return `<b>${esc(op.tag)}</b>: ${Object.entries(c).map(([k,v])=>`${esc(CAMPO[k]||k)} → <b>${esc(v)}</b>`).join(", ")}`;
    case "tablero.editar": return `Tablero <b>${esc(op.tag)}</b>: ${Object.entries(c).map(([k,v])=>`${k==="tag"?"TAG":k} → <b>${esc(v)}</b>`).join(", ")}`;
    case "sistema.editar": return `Sistema: ${Object.entries(c).map(([k,v])=>`${k==="tag"?"TAG":"nombre"} → <b>${esc(v)}</b>`).join(", ")}`;
    case "proyecto.editar": return `Proyecto: ${Object.entries(c).map(([k,v])=>`${CAMPO[k]||k} «${esc(k==="etapa" ? (ETAPAS.find(e=>e.id===p.etapa)||{}).nombre : p[k]||"—")}» → <b>${esc(k==="etapa" ? (ETAPAS.find(e=>e.id===v)||{}).nombre||v : v)}</b>`).join(", ")}`;
    case "diseno.editar": { const v = valoresDiseno(p); return Object.entries(c).map(([k,x])=>{ const [n,u] = NOMBRE_DISENO[k]||[k,""]; return `${esc(n)}: ${esc(v[k]??"—")} ${u} → <b>${esc(fmt(x))} ${u}</b>`; }).join("<br>"); }
    case "documentos.emitir": return `Emitir ${op.rev ? "la revisión <b>"+esc(op.rev)+"</b>" : "la siguiente revisión"} de los <b>${p.entregables.length}</b> documentos: «${esc(op.motivo)}»`;
  }
  return esc(op.op);
}
function senalDe(tag){
  const L = tipoInstrumento(tag);
  if(/^(XV|SV|FV|PV|LV|TV|HV|XY|SY)$/.test(L)) return { tipoSenal:"Discreta", senal:"N. A.", alimentacion:"120 VAC" };
  if(/T$/.test(L)) return { tipoSenal:"Analógica", senal:"4 - 20 mA", alimentacion:"24 VDC / Loop Powered" };
  return { tipoSenal:"Discreta", senal:"Contacto seco", alimentacion:"120 VAC" };
}

/* ---------- aplicar, impacto y deshacer ---------- */
function foto(p){
  const v = valoresDiseno(p);
  const md = tablerosPotencia(p).map(t=>{ const c = calcularTablero(p, t); return { tag:t.tag, md:c.totalKVA||0, i:c.demandCurrent||0, itm:c.mainBreaker, n:c.circuits.length }; });
  let caidas = 0; try{ caidas = cablesFuerza(p).filter(f=>(f.dv||0) > (+v.caidaTension||2.5)).length; }catch(e){}
  return { md, cargas: datos(p).cargas.length, inst: instrumentos(p).length, io: (datos(p)["ins-io"]||[]).length, caidas };
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
      for(const k of ["nombre","cliente","unidad","codigo","area"]) if(c[k]!=null && c[k]!=="") p[k] = c[k];
      if(c.etapa && ETAPAS.some(e=>e.id===c.etapa)) p.etapa = c.etapa;
      if(c.codigo!=null || c.area!=null) S.sincronizarDocumentos(p, ENTREGABLES);
    } else if(op.op==="diseno.editar"){
      p.diseno = p.diseno || {};
      for(const [k, v] of Object.entries(c)) if(NOMBRE_DISENO[k] && v!=null && v!=="") p.diseno[k] = String(v);
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
      op: { type:"string", enum:["carga.agregar","carga.editar","carga.eliminar","instrumento.agregar","instrumento.editar","instrumento.eliminar","tablero.editar","sistema.editar","proyecto.editar","diseno.editar","documentos.emitir"] },
      tag: { type:"string", description:"TAG de la carga, instrumento o tablero" },
      descripcion: { type:"string" }, potencia: { type:"number" }, unidad: { type:"string", enum:["hp","kw"] },
      arranque: { type:"string", enum:["dol","vfd","ss"], description:"dol = directo, vfd = variador, ss = arrancador suave" },
      tablero: { type:"string", description:"TAG del tablero" }, aplicacion: { type:"string", enum:["bomba-centrifuga","ventilador-centrifugo","ventilador-axial","faja-transportadora","valvula-rotativa","compresor-piston","molino","chancadora","agitador","otro"] },
      servicio: { type:"string" }, ubicacion: { type:"string" }, cantidad: { type:"number" },
      motivo: { type:"string", enum:["Emitido para revisión interna","Emitido para revisión del cliente","Emitido para aprobación","Emitido para construcción","Conforme a obra"] }, rev: { type:"string" },
      campos: { type:"object", description:"Campos a cambiar. carga.editar: potencia, unidad, arranque, longitud_cable (m), tablero, descripcion, fp, eficiencia, fu, fs. instrumento.editar: descripcion, servicio, ubicacion, marca, modelo, alimentacion, rango, senal. tablero.editar: nombre, tag. sistema.editar: nombre, tag. proyecto.editar: nombre, cliente, unidad, codigo, area, etapa (conceptual/basica/detalle). diseno.editar: tension, frecuencia, tensionControl, tensionInstr, icc, altitud, tempMin, tempMax, tempDiseno, humedad, ubicacion, caidaTension, caidaAlimentador, reservaIO." },
    }, required:["op"] } },
  }, required:["resumen","operaciones"] },
};

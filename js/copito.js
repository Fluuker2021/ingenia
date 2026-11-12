/* Ingenia — Copito: asistente de los proyectos.
   1) Motor propio: responde al instante con los datos guardados de cada proyecto (tableros, cargas, cálculo,
      cables, instrumentos, señales I/O, documentos y revisiones). No envía nada a internet.
   2) Modo IA opcional (Claude): para preguntas abiertas; envía la pregunta y los datos del proyecto a la API
      de Anthropic con la clave que el usuario guarda en este navegador. */
import * as S from "./store.js";
import { esc } from "./ui.js";
import { entregable, ETAPAS, DISCIPLINAS } from "./catalog.js";
import { datos, calcularTablero, tableros, tablerosPotencia, instrumentos, expandirTag, cablesFuerza, ipRecomendado, r2 } from "./datos.js";
import { valoresDiseno } from "./modules/criterios.js";
import { tablasIO } from "./docs.js";

export const AVATAR = `<img class="cp-img" src="assets/copito.png" alt="" width="160" height="160">`;

/* ---------------- utilidades ---------------- */
const norm = s => String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const n1 = (v, d=1) => (v==null || v==="" || isNaN(+v)) ? "—" : (+v).toLocaleString("es-PE", { maximumFractionDigits:d, minimumFractionDigits:0 });
const tabla = (cols, filas) => `<div class="cp-tabla"><table><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${filas.map(f=>`<tr>${f.map(v=>`<td>${v}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const ir = (href, txt) => `<a class="cp-ir" href="${href}">${esc(txt)} →</a>`;
const etapa = id => (ETAPAS.find(e=>e.id===id)||{}).nombre || id || "—";
const kw = l => (+l.power||0) * (l.powerUnit==="hp" ? 0.746 : 1);

function proyectoDe(q, ruta){
  const ps = S.load().proyectos, t = norm(q);
  let mejor = null, pts = 0;
  for(const p of ps){
    let s = 0; const nom = norm(p.nombre);
    if(nom && t.includes(nom)) s += 10;
    const pal = nom.split(/[^a-z0-9]+/).filter(w=>w.length>3); const k = pal.filter(w=>t.includes(w)).length;
    if(pal.length && k>=Math.min(2, pal.length)) s += k;
    if(p.codigo && p.codigo.length>=3 && t.includes(norm(p.codigo))) s += 6;
    if(p.cliente && t.includes(norm(p.cliente))) s += 3;
    if(s>pts){ pts = s; mejor = p; }
  }
  if(mejor && pts>=2) return { p: mejor, explicito: true };
  if(ruta && ruta.id){ const p = S.proyecto(ruta.id); if(p) return { p }; }
  if(!ps.length) return { p: null };
  const p = ps.slice().sort((a,b)=>(b.visto||0)-(a.visto||0))[0];
  return { p, supuesto: ps.length>1 };
}
/* catálogo de TAG del proyecto: cargas, tableros, instrumentos */
function etiquetas(p){
  const d = datos(p), out = [];
  for(const t of tableros(p)) out.push({ tag:t.tag, tipo:"tablero", t });
  for(const l of d.cargas) if(l.tag) out.push({ tag:l.tag, tipo:"carga", l });
  for(const i of instrumentos(p)) for(const tag of expandirTag(i.tag)) if(tag) out.push({ tag, tipo:"instrumento", i });
  return out.sort((a,b)=>b.tag.length-a.tag.length);
}
const calcs = p => tablerosPotencia(p).map(t=>({ t, c: calcularTablero(p, t) })).filter(x=>x.c.circuits.length);
function circuitoDe(p, l){ for(const { c } of calcs(p)){ const ci = c.circuits.find(x=>x.load && x.load.id===l.id); if(ci) return ci; } return null; }
const itmDe = ci => ((ci && ci.items)||[]).find(it=>/^(ITM|Interruptor|Guardamotor)/i.test(it.comp||""));

/* ---------------- respuestas del motor propio ---------------- */
function rProyectos(){
  const ps = S.load().proyectos;
  if(!ps.length) return `Aún no tienes proyectos. Crea el primero con <b>Nuevo proyecto</b>.`;
  return `Tienes <b>${ps.length}</b> proyecto(s):` + tabla(["Proyecto","Cliente","Etapa","Emitidos"], ps.map(p=>{ const n = p.entregables.length, e = p.entregables.filter(id=>((p.documentos||{})[id]||{}).estado==="Emitido").length; return [`<a href="#/proyecto/${p.id}/resumen">${esc(p.nombre)}</a>`, esc(p.cliente||"—"), esc(etapa(p.etapa)), `${e}/${n}`]; }));
}
function rResumen(p){
  const d = datos(p), v = valoresDiseno(p), cs = calcs(p);
  const md = cs.reduce((a,x)=>a+(x.c.totalKVA||0), 0);
  return `<b>${esc(p.nombre)}</b><br>${esc(p.cliente||"Sin cliente")}${p.unidad?" · "+esc(p.unidad):""} · ${esc(etapa(p.etapa))}<br>
    Sistema: ${esc(d.sistema.nombre||"—")}${d.sistema.tag?` (${esc(d.sistema.tag)})`:""} · ${esc(v.tension)} V, ${esc(v.frecuencia)} Hz<br>
    ${tableros(p).length} tablero(s) · ${d.cargas.length} carga(s) · ${instrumentos(p).length} instrumento(s) · ${p.entregables.length} entregable(s)${md?` · máxima demanda total ${n1(md)} kVA`:""}`;
}
function rDemanda(p){
  const cs = calcs(p);
  if(!cs.length) return `El proyecto aún no tiene cargas. ${ir(`#/proyecto/${p.id}/doc/ele-cargas/datos`, "Ingresar cargas")}`;
  return `Resultados del cálculo de <b>${esc(p.nombre)}</b>:` + tabla(["Tablero","P. instalada","Máx. demanda","I MD","ITM general"], cs.map(({t,c})=>[esc(t.tag), `${n1(c.installedKVA)} kVA`, `${n1(c.totalKVA)} kVA`, `${n1(c.demandCurrent)} A`, `3x${esc(c.mainBreaker||"—")} A`])) + ir(`#/proyecto/${p.id}/doc/ele-md/vista`, "Ver memoria de máxima demanda");
}
function rTableros(p){
  const tb = tableros(p);
  return `<b>${tb.length}</b> tablero(s) en ${esc(p.nombre)}:` + tabla(["TAG","Nombre","Tipo","Alimentado desde"], tb.map(t=>{ const des = t.desde ? (tableros(p).find(x=>x.id===t.desde)||{}).tag : t.desdeTexto; return [esc(t.tag), esc(t.nombre||""), esc(t.tipo), esc(des||"Externo")]; }));
}
function rCargas(p){
  const d = datos(p); if(!d.cargas.length) return `Sin cargas registradas. ${ir(`#/proyecto/${p.id}/doc/ele-cargas/datos`, "Ingresar cargas")}`;
  const tot = d.cargas.reduce((a,l)=>a+kw(l), 0);
  const arr = { dol:"Directo", vfd:"Variador", ss:"Arrancador suave" };
  return `<b>${d.cargas.length}</b> carga(s), ${n1(tot)} kW en total:` + tabla(["TAG","Carga","Potencia","Arranque","Tablero"], d.cargas.map(l=>[esc(l.tag||"—"), esc(l.desc||""), `${n1(l.power)} ${l.powerUnit==="hp"?"HP":"kW"}`, esc(l.kind==="motor" ? (arr[l.starter]||l.starter||"") : l.kind), esc((tableros(p).find(t=>t.id===l.tablero)||{}).tag||"")])) + ir(`#/proyecto/${p.id}/doc/ele-cargas/vista`, "Ver listado de cargas");
}
function rCables(p, soloCaida){
  const filas = cablesFuerza(p); if(!filas.length) return `Aún no hay cables: se generan desde el listado de cargas.`;
  const lim = +valoresDiseno(p).caidaTension || 2.5;
  const ver = soloCaida ? filas.slice().sort((a,b)=>(b.dv||0)-(a.dv||0)) : filas;
  const altos = filas.filter(f=>(f.dv||0)>lim);
  return (soloCaida ? `Caída de tensión por cable (límite ${n1(lim)} %). ${altos.length ? `<b>${altos.length}</b> cable(s) superan el límite.` : "Todos cumplen."}` : `<b>${filas.length}</b> cable(s) de fuerza:`) +
    tabla(["Cable","Desde → hasta","Sección","L (m)","ΔV %"], ver.map(f=>[esc(f.tag||"—"), `${esc(f.desde)} → ${esc(f.hasta)}`, `${esc(f.seccion)} mm² <span class="cp-mono">${esc(f.awg||"")}</span>`, n1(f.longitud,0), (f.dv||0)>lim ? `<b class="cp-err">${n1(f.dv,2)}</b>` : n1(f.dv,2)])) + ir(`#/proyecto/${p.id}/doc/ele-cables/datos`, "Ver listado de cables");
}
function rInstrumentos(p){
  const L = instrumentos(p); if(!L.length) return `Sin instrumentos registrados. ${ir(`#/proyecto/${p.id}/doc/ins-instrumentos/datos`, "Ingresar instrumentos")}`;
  return `<b>${L.reduce((a,i)=>a+(+i.cant||1),0)}</b> instrumento(s):` + tabla(["TAG","Descripción","Señal","Alimentación"], L.map(i=>[esc(i.tag), esc(i.descripcion||""), esc(i.senal||i.tipoSenal||""), esc(i.alimentacion||"")])) + ir(`#/proyecto/${p.id}/doc/ins-instrumentos/vista`, "Ver listado de instrumentos");
}
function rIO(p){
  const t = tablasIO(p); if(!t.io.length) return `El listado I/O está vacío: se genera desde instrumentos y cargas. ${ir(`#/proyecto/${p.id}/doc/ins-io/datos`, "Abrir listado I/O")}`;
  return `<b>${t.io.length}</b> señal(es) en el listado I/O:` + tabla(["Tipo","Usados","Reserva","Requeridos","Módulos"], t.resumen.map(r=>[esc(r.tipo), esc(r.usados), esc(r.reserva), esc(r.requeridos), esc(r.modulos)])) + ir(`#/proyecto/${p.id}/doc/ins-io/vista`, "Ver listado I/O");
}
function rDocumentos(p, pendientes){
  let ids = p.entregables.slice();
  if(pendientes) ids = ids.filter(id=>((p.documentos||{})[id]||{}).estado!=="Emitido");
  if(!ids.length) return pendientes ? `No hay documentos pendientes: todos están emitidos.` : `No hay entregables seleccionados.`;
  return `${pendientes ? `<b>${ids.length}</b> documento(s) sin emitir` : `<b>${ids.length}</b> documento(s)`} en ${esc(p.nombre)}:` + tabla(["Código","Documento","Rev.","Estado"], ids.map(id=>{ const d = (p.documentos||{})[id]||{}, e = entregable(id)||{}, rv = (d.revisiones||[]).slice(-1)[0]||{}; return [`<span class="cp-mono">${esc(d.codigo||"")}</span>`, `<a href="#/proyecto/${p.id}/doc/${id}">${esc(e.nombre||id)}</a>`, esc(rv.rev||d.rev||"A"), esc(d.estado||"")]; })) + ir(`#/proyecto/${p.id}/documentos`, "Ir a documentos");
}
function rSitio(p){
  const v = valoresDiseno(p);
  const f = [["Tensión de fuerza", `${v.tension} V, ${v.frecuencia} Hz`],["Tensión de control", `${v.tensionControl} VAC`],["Instrumentación", `${v.tensionInstr} VDC`],["Cortocircuito", `${v.icc} kA`],["Puesta a tierra", v.puestaTierra],["Altitud", `${v.altitud} m s.n.m.`],["Temperatura", `${v.tempMin} a ${v.tempMax} °C (diseño ${v.tempDiseno} °C)`],["Instalación", v.ambiente],["Ambiente", v.contaminacion],["Área clasificada", v.areaClasificada],["Grado de protección", ipRecomendado(v)],["Norma", v.norma]];
  return `Datos de diseño de <b>${esc(p.nombre)}</b>:` + tabla(["Parámetro","Valor"], f.map(([a,b])=>[esc(a), esc(b||"—")])) + ir(`#/proyecto/${p.id}/diseno`, "Editar datos generales");
}
function rTag(p, e, q){
  const d = datos(p);
  if(e.tipo==="tablero"){
    const c = e.t.tipo!=="control" ? calcularTablero(p, e.t) : null;
    return `<b>${esc(e.t.tag)}</b> — ${esc(e.t.nombre||"")} (${esc(e.t.tipo)})` + (c && c.circuits.length ? tabla(["Circuitos","P. instalada","Máx. demanda","I MD","ITM general"], [[c.circuits.length, `${n1(c.installedKVA)} kVA`, `${n1(c.totalKVA)} kVA`, `${n1(c.demandCurrent)} A`, `3x${esc(c.mainBreaker||"—")} A`]]) : "") + ir(`#/proyecto/${p.id}/doc/ele-unifilar/vista`, "Ver unifilar");
  }
  if(e.tipo==="carga"){
    const l = e.l, ci = circuitoDe(p, l), itm = itmDe(ci), cb = cablesFuerza(p).find(f=>f._load && f._load.id===l.id);
    const filas = [["Descripción", esc(l.desc||"")],["Potencia", `${n1(l.power)} ${l.powerUnit==="hp"?"HP":"kW"}`],["Tablero", esc((tableros(p).find(t=>t.id===l.tablero)||{}).tag||"")]];
    if(ci && ci.meta) filas.push(["Cálculo", esc(ci.meta)]);
    if(itm) filas.push(["Protección", `${esc(itm.devtag)} ${esc(itm.val)}`]);
    if(cb) filas.push(["Cable", `${esc(cb.tag||"")} · ${esc(cb.seccion)} mm² ${esc(cb.awg||"")} · ${n1(cb.longitud,0)} m · ΔV ${n1(cb.dv,2)} %`]);
    return `<b>${esc(l.tag)}</b>` + tabla(["Dato","Valor"], filas);
  }
  const i = e.i, io = tablasIO(p).io.filter(f=>f.tag===e.tag);
  const filas = [["Descripción", esc(i.descripcion||"")],["Servicio", esc(i.servicio||"—")],["Señal", esc([i.tipoSenal, i.senal].filter(Boolean).join(" · "))],["Alimentación", esc(i.alimentacion||"—")],["Ubicación", esc(i.ubicacion||"—")]];
  io.forEach(f=>filas.push(["Canal", `${esc(f.tipo)} · ${esc(f.tablero||"")} slot ${esc(f.slot??"—")} ch ${esc(f.ch??"—")} · bornes ${esc(f.terminales||"—")}`]));
  return `<b>${esc(e.tag)}</b>` + tabla(["Dato","Valor"], filas) + ir(`#/proyecto/${p.id}/doc/ins-hd/datos`, "Ver hoja de datos");
}
function rBuscar(p, q){
  const pal = norm(q).split(/[^a-z0-9]+/).filter(w=>w.length>3 && !/^(cual|cuales|cuanto|cuantos|donde|como|tiene|tienen|hay|del|los|las|que|para|proyecto|este|esta)$/.test(w));
  if(!pal.length) return null;
  const d = datos(p), hits = [];
  const ver = (txt, etq, href) => { const t = norm(txt); const k = pal.filter(w=>t.includes(w)).length; if(k) hits.push({ k, etq, href }); };
  d.cargas.forEach(l=>ver(`${l.tag} ${l.desc}`, `Carga ${l.tag||""} — ${l.desc||""}`, `#/proyecto/${p.id}/doc/ele-cargas/datos`));
  instrumentos(p).forEach(i=>ver(`${i.tag} ${i.descripcion} ${i.servicio} ${i.ubicacion}`, `Instrumento ${i.tag} — ${i.descripcion||""}`, `#/proyecto/${p.id}/doc/ins-instrumentos/datos`));
  p.entregables.forEach(id=>{ const e = entregable(id)||{}; ver(`${e.nombre} ${e.finalidad}`, `Documento: ${e.nombre}`, `#/proyecto/${p.id}/doc/${id}`); });
  (d.proceso.equipos||[]).forEach(e=>ver(`${e.tag} ${e.descripcion}`, `Equipo ${e.tag||""} — ${e.descripcion||""}`, `#/proyecto/${p.id}/doc/ins-pid/datos`));
  if(!hits.length) return null;
  hits.sort((a,b)=>b.k-a.k);
  return `Esto es lo que encontré en <b>${esc(p.nombre)}</b>:<ul>${hits.slice(0,8).map(h=>`<li><a href="${h.href}">${esc(h.etq)}</a></li>`).join("")}</ul>`;
}
const AYUDA = `Soy <b>Copito</b>, el asistente de tus proyectos. Conozco todo lo que ingresas en Ingenia. Pregúntame, por ejemplo:
  <ul><li>¿Cuál es la máxima demanda del proyecto?</li><li>¿Qué cable tiene el motor M-101?</li><li>¿Qué cables superan la caída de tensión?</li><li>¿Cuántas señales I/O hay y cuántos módulos?</li><li>¿Qué documentos faltan emitir?</li><li>¿Cuáles son las condiciones del sitio?</li></ul>`;

export function responderLocal(q, ruta){
  const t = norm(q);
  if(/^(hola|buenas|hey|ayuda|help)\b|que (puedes|sabes)|como funcionas/.test(t)) return { html: AYUDA, ok:true };
  if(/(cuantos|lista|listar|cuales son|mis|todos los)\s+(mis\s+)?proyectos|^proyectos$/.test(t)) return { html: rProyectos(), ok:true };
  const { p, supuesto } = proyectoDe(q, ruta);
  if(!p) return { html: `Aún no tienes proyectos. Crea el primero con <b>Nuevo proyecto</b> y luego pregúntame lo que necesites.`, ok:true };
  const nota = supuesto ? `<div class="cp-nota">Sobre «${esc(p.nombre)}». Menciona otro proyecto por su nombre o código si es otro.</div>` : "";
  const r = h => ({ html: nota + h, ok:true, p });
  const tag = etiquetas(p).find(e=>e.tag.length>=3 && new RegExp(`(^|[^a-z0-9])${norm(e.tag).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}([^a-z0-9]|$)`).test(t));
  if(tag) return r(rTag(p, tag, q));
  if(/caida de tension|\bdv\b|regulacion/.test(t)) return r(rCables(p, true));
  if(/maxima demanda|demanda|potencia instalada|corriente|interruptor general|itm general|kva/.test(t)) return r(rDemanda(p));
  if(/cable|calibre|seccion|conductor|awg/.test(t)) return r(rCables(p, false));
  if(/senal|senales|\bi\/?o\b|entradas|salidas|modulo|canal|plc|slot/.test(t)) return r(rIO(p));
  if(/instrumento|transmisor|sensor|valvula/.test(t)) return r(rInstrumentos(p));
  if(/tablero/.test(t)) return r(rTableros(p));
  if(/carga|motor|potencia|hp\b|kw\b/.test(t)) return r(rCargas(p));
  if(/document|entregable|emitid|pendient|revision|codigo|plano|falta/.test(t)) return r(rDocumentos(p, /pendient|falta|sin emitir|por emitir/.test(t)));
  if(/tension|voltaje|frecuencia|altitud|temperatura|sitio|ambient|cortocircuito|grado de proteccion|\bip\b|nema|norma|condicion/.test(t)) return r(rSitio(p));
  if(/resumen|proyecto|cliente|unidad|etapa|sistema|estado/.test(t)) return r(rResumen(p));
  const b = rBuscar(p, q);
  if(b) return r(b);
  return { html: nota + `No encontré eso en los datos de <b>${esc(p.nombre)}</b>. Prueba con: máxima demanda, cables, caída de tensión, instrumentos, señales I/O, documentos pendientes o un TAG.`, ok:false, p };
}

/* ---------------- modo IA (Claude) ---------------- */
const IA_KEY = "ingenia.copito.ia";
const leerIA = () => { try{ return JSON.parse(localStorage.getItem(IA_KEY)) || {}; }catch(e){ return {}; } };
const guardarIA = c => { try{ localStorage.setItem(IA_KEY, JSON.stringify(c)); }catch(e){} };
function contexto(){
  const ps = S.load().proyectos;
  const out = ps.map(p=>{
    const d = datos(p), v = valoresDiseno(p);
    let io = []; try{ io = tablasIO(p); }catch(e){}
    let cb = []; try{ cb = cablesFuerza(p).map(f=>({ tag:f.tag, desde:f.desde, hasta:f.hasta, seccion_mm2:f.seccion, awg:f.awg, longitud_m:f.longitud, caida_pct:+(+f.dv||0).toFixed(2) })); }catch(e){}
    return {
      proyecto: p.nombre, cliente: p.cliente, unidad: p.unidad, etapa: etapa(p.etapa), codigo: p.codigo, area: p.area, abierto_en_pantalla: false, id: p.id,
      sistema: d.sistema, diseno: v,
      tableros: tableros(p).map(t=>{ const c = t.tipo!=="control" ? calcularTablero(p, t) : null; return { tag:t.tag, nombre:t.nombre, tipo:t.tipo, potencia_instalada_kVA: c ? r2(c.installedKVA,2) : null, maxima_demanda_kVA: c ? r2(c.totalKVA,2) : null, corriente_md_A: c ? r2(c.demandCurrent,1) : null, itm_general_A: c ? c.mainBreaker : null }; }),
      cargas: d.cargas.map(l=>{ const ci = circuitoDe(p, l), itm = itmDe(ci); return { tag:l.tag, descripcion:l.desc, tipo:l.kind, potencia:l.power, unidad:l.powerUnit, arranque:l.starter, tablero:(tableros(p).find(t=>t.id===l.tablero)||{}).tag, calculo: ci && ci.meta, proteccion: itm && `${itm.devtag} ${itm.val}` }; }),
      cables: cb, instrumentos: instrumentos(p),
      io_resumen: io.resumen || [], io: (io.io||[]).slice(0, 400).map(f=>({ tag:f.tag, tipo:f.tipo, senal:f.senal, descripcion:f.descripcion, tablero:f.tablero, slot:f.slot, ch:f.ch, bornes:f.terminales })),
      proceso: { descripcion: d.proceso.descripcion, equipos: d.proceso.equipos },
      documentos: p.entregables.map(id=>{ const doc = (p.documentos||{})[id]||{}; return { documento:(entregable(id)||{}).nombre, codigo:doc.codigo, estado:doc.estado, revisiones:doc.revisiones }; }),
    };
  });
  return JSON.stringify(out);
}
let historial = [];
async function responderIA(q, ruta, cfg){
  const { default: Anthropic } = await import("../vendor/anthropic-sdk-1.3.0.mjs");
  const client = new Anthropic({ apiKey: cfg.clave, dangerouslyAllowBrowser: true });
  const actual = ruta && ruta.id ? (S.proyecto(ruta.id)||{}).nombre : "";
  const system = [
    { type:"text", text:"Eres Copito, el asistente de Ingenia, una plataforma de ingeniería eléctrica e instrumentación. Respondes en español, de forma breve y directa, solo con los datos de los proyectos que se adjuntan en JSON (cargas, cálculo NEC de tableros, cables, instrumentos, señales I/O, documentos). Si un dato no está, dilo y sugiere dónde ingresarlo en Ingenia. Usa listas cortas o tablas en Markdown cuando ayuden. No inventes valores." },
    { type:"text", text:"Datos de los proyectos:\n" + contexto(), cache_control:{ type:"ephemeral" } },
  ];
  historial.push({ role:"user", content: (actual ? `[Proyecto abierto en pantalla: ${actual}]\n` : "") + q });
  historial = historial.slice(-12);
  if(historial[0].role!=="user") historial.shift();
  const resp = await client.beta.messages.create({
    model:"claude-opus-5-5", max_tokens:4096, system, messages: historial,
    output_config:{ effort:"low" },
    betas:["server-side-fallback-2026-07-01"], fallbacks:"default",
  });
  if(resp.stop_reason==="refusal"){ historial.pop(); return "No puedo responder esa pregunta. Prueba reformulándola sobre los datos del proyecto."; }
  const texto = resp.content.filter(b=>b.type==="text").map(b=>b.text).join("\n").trim();
  historial.push({ role:"assistant", content: texto || "(sin respuesta)" });
  return texto;
}
/* Markdown mínimo y seguro (negritas, listas, tablas simples, saltos de línea) */
function md(txt){
  const lineas = esc(txt).split(/\n/); let h = "", lista = false, tablaF = [];
  const cerrarTabla = ()=>{ if(!tablaF.length) return; const filas = tablaF.filter(f=>!/^\s*\|?\s*:?-{2,}/.test(f)).map(f=>f.replace(/^\s*\||\|\s*$/g,"").split("|").map(c=>c.trim()));
    h += `<div class="cp-tabla"><table><thead><tr>${filas[0].map(c=>`<th>${c}</th>`).join("")}</tr></thead><tbody>${filas.slice(1).map(f=>`<tr>${f.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`; tablaF = []; };
  for(let l of lineas){
    l = l.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, '<span class="cp-mono">$1</span>');
    if(/^\s*\|.*\|\s*$/.test(l)){ if(lista){ h += "</ul>"; lista = false; } tablaF.push(l); continue; } else cerrarTabla();
    if(/^\s*[-*•]\s+/.test(l)){ if(!lista){ h += "<ul>"; lista = true; } h += `<li>${l.replace(/^\s*[-*•]\s+/,"")}</li>`; continue; }
    if(lista){ h += "</ul>"; lista = false; }
    if(/^#{1,4}\s/.test(l)) h += `<b>${l.replace(/^#{1,4}\s/,"")}</b><br>`; else if(l.trim()) h += l + "<br>";
  }
  cerrarTabla(); if(lista) h += "</ul>";
  return h;
}

/* ---------------- interfaz ---------------- */
const CHAT_KEY = "ingenia.copito.chat";
const SUGERENCIAS = ["¿Cuál es la máxima demanda?", "¿Qué cables superan la caída de tensión?", "¿Cuántas señales I/O hay?", "¿Qué documentos faltan emitir?"];
export function iniciarCopito(rutaActual){
  const raiz = document.createElement("div");
  raiz.innerHTML = `<button class="cp-btn" id="cp-btn" aria-label="Abrir Copito" title="Copito — pregunta sobre tus proyectos">${AVATAR}</button>
    <section class="cp-panel" id="cp-panel" hidden aria-label="Copito">
      <header class="cp-head"><span class="cp-av">${AVATAR}</span><div class="cp-tit"><b>Copito</b><span id="cp-modo">Asistente de tus proyectos</span></div>
        <button class="cp-ic" id="cp-cfg" title="Ajustes"><svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg></button>
        <button class="cp-ic" id="cp-borrar" title="Borrar conversación"><svg class="icon" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg></button>
        <button class="cp-ic" id="cp-cerrar" title="Cerrar"><svg class="icon" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header>
      <div class="cp-ajustes" id="cp-ajustes" hidden>
        <label class="checkbox"><input type="checkbox" id="cp-ia"> Responder con IA (Claude) las preguntas abiertas</label>
        <input type="password" id="cp-clave" placeholder="Clave de API de Anthropic (sk-ant-…)" autocomplete="off">
        <p>La clave queda solo en este navegador. Con la IA activa, la pregunta y los datos de tus proyectos se envían a Anthropic. Sin IA, Copito responde con sus propias reglas y nada sale de tu equipo.</p>
      </div>
      <div class="cp-msgs" id="cp-msgs"></div>
      <div class="cp-sug" id="cp-sug">${SUGERENCIAS.map(s=>`<button>${esc(s)}</button>`).join("")}</div>
      <form class="cp-form" id="cp-form"><input id="cp-q" type="text" placeholder="Pregunta sobre tus proyectos…" autocomplete="off"><button class="btn-accent" aria-label="Enviar"><svg class="icon" viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6"/></svg></button></form>
    </section>`;
  document.body.appendChild(raiz);
  const $ = s => raiz.querySelector(s);
  const panel = $("#cp-panel"), msgs = $("#cp-msgs");
  let chat = []; try{ chat = JSON.parse(localStorage.getItem(CHAT_KEY)) || []; }catch(e){}
  const guardar = ()=>{ try{ localStorage.setItem(CHAT_KEY, JSON.stringify(chat.slice(-40))); }catch(e){} };
  const pintar = ()=>{
    msgs.innerHTML = (chat.length ? "" : `<div class="cp-m cp-bot"><span class="cp-av">${AVATAR}</span><div class="cp-bub">${AYUDA}</div></div>`) +
      chat.map(m=>m.de==="yo" ? `<div class="cp-m cp-yo"><div class="cp-bub">${esc(m.t)}</div></div>` : `<div class="cp-m cp-bot"><span class="cp-av">${AVATAR}</span><div class="cp-bub">${m.h}${m.ia?'<div class="cp-ia">Respuesta con IA</div>':""}</div></div>`).join("");
    msgs.scrollTop = msgs.scrollHeight;
    $("#cp-sug").hidden = chat.length > 0;
  };
  const cfg = leerIA();
  const modo = ()=>{ const c = leerIA(); $("#cp-modo").textContent = c.activo && c.clave ? "Asistente de tus proyectos · IA activa" : "Asistente de tus proyectos"; };
  $("#cp-ia").checked = !!cfg.activo; $("#cp-clave").value = cfg.clave || "";
  $("#cp-ia").onchange = $("#cp-clave").onchange = ()=>{ guardarIA({ activo: $("#cp-ia").checked, clave: $("#cp-clave").value.trim() }); modo(); };
  modo();
  const abrir = v => { panel.hidden = !v; $("#cp-btn").hidden = v; document.body.classList.toggle("cp-abierto", v); if(v){ pintar(); setTimeout(()=>$("#cp-q").focus(), 50); } };
  $("#cp-btn").onclick = ()=>abrir(true);
  $("#cp-cerrar").onclick = ()=>abrir(false);
  $("#cp-cfg").onclick = ()=>{ $("#cp-ajustes").hidden = !$("#cp-ajustes").hidden; };
  $("#cp-borrar").onclick = ()=>{ chat = []; historial = []; guardar(); pintar(); };
  msgs.addEventListener("click", ev=>{ if(ev.target.closest("a.cp-ir, .cp-tabla a, .cp-bub li a") && window.innerWidth < 700) abrir(false); });
  const preguntar = async q=>{
    q = q.trim(); if(!q) return;
    chat.push({ de:"yo", t:q }); pintar();
    const ruta = rutaActual();
    const loc = responderLocal(q, ruta);
    const c = leerIA();
    if(c.activo && c.clave && (!loc.ok || /\b(por que|porque|explica|recomienda|recomendacion|compara|deberia|como mejoro|analiza|resume)\b/.test(norm(q)))){
      chat.push({ de:"bot", h:`<span class="cp-pensando">Copito está pensando…</span>` }); pintar();
      try{ const txt = await responderIA(q, ruta, c); chat[chat.length-1] = { de:"bot", h: md(txt), ia:true }; }
      catch(err){ chat[chat.length-1] = { de:"bot", h: loc.html + `<div class="cp-nota">No se pudo usar la IA (${esc(err.status===401 ? "clave inválida" : (err.message||"sin conexión"))}). Respondí con los datos locales.</div>` }; }
    } else chat.push({ de:"bot", h: loc.html });
    guardar(); pintar();
  };
  $("#cp-form").onsubmit = ev=>{ ev.preventDefault(); const q = $("#cp-q").value; $("#cp-q").value = ""; preguntar(q); };
  $("#cp-sug").addEventListener("click", ev=>{ const b = ev.target.closest("button"); if(b) preguntar(b.textContent); });
  document.addEventListener("keydown", ev=>{ if(ev.key==="Escape" && !panel.hidden) abrir(false); });
}

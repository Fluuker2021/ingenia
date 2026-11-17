/* Ingenia — Copito sobre TODOS los documentos: herramientas para cambiar lo que se ve en la vista previa de
   cualquier entregable y saber qué otros entregables se actualizan con el cambio.
   · Circuitos del tablero de control (unifilar / multifilar / mecánico de control): agregar, quitar y cambiar
     derivaciones de 24 Vdc, 120 Vac y 220 Vac. Los circuitos ligados a un instrumento o a un equipo del tablero
     siguen a ese componente (quitar el router quita su circuito en todos los planos).
   · Configuración del tablero de control (arquitectura, listado I/O, multifilar): HMI, switch, router,
     controlador de limpieza, marca y modelo del PLC, tensión de entradas digitales, mando de variadores, red IP,
     canales por módulo.
   · Cajetín y revisiones de un documento, notas, equipos de proceso del P&ID.
   Todo se interpreta con reglas propias (sin internet); Copito muestra la propuesta, se aplica al confirmar,
   se regenera la vista abierta y se informa qué entregables cambian. */
import * as S from "./store.js";
import { esc } from "./ui.js";
import { entregable } from "./catalog.js";
import { datos, tableros, tablerosControl, tc as tcPrincipal, circuitosControl, instrumentos, expandirTag } from "./datos.js";
import { equiposControl, indiceEquipos, familiaPlc } from "./control/equipos.js";
import { arreglosProyecto } from "./mecanico/arreglo.js";
import { FAMILIAS, modeloFamilia } from "./control/plc-modulos.js";
import { filosofiaOps, filosofiaDe, TEXTOS_FIL, TABLAS_FIL } from "./modules/filosofia.js";

const norm = s => String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const limpiar = s => String(s||"").trim().replace(/^["'«“(:\s]+|["'»”);,.\s]+$/g, "").trim();
const num = s => s==null ? NaN : parseFloat(String(s).replace(",", "."));

/* documento abierto en pantalla (#/proyecto/<id>/doc/<doc>/<pestaña>) */
export function docAbierto(){ const m = String((typeof location!=="undefined" && location.hash)||"").match(/#\/proyecto\/([^/]+)\/doc\/([^/]+)(?:\/([^/?]+))?/); return m ? { id:m[1], doc:m[2], tab:m[3]||"datos" } : null; }

/* nombres con que el usuario se refiere a cada documento */
const ALIAS = [
  [/unifilar de(l)? (tablero de )?control/, "ins-unifilar-tc"], [/multifilar de(l)? (tablero de )?control|conexionado de e\/?s/, "ins-multifilar-tc"],
  [/mecanico de(l)? (tablero de )?control|disposicion de equipos del tablero de control/, "ins-mecanico-tc"],
  [/unifilar/, "ele-unifilar"], [/multifilar/, "ele-multifilar"], [/plano mecanico|mecanico de(l)? (tablero de )?fuerza/, "ele-mecanico"],
  [/arquitectura/, "ins-arquitectura"], [/diagrama(s)? de lazo|lazos?\b/, "ins-lazo"], [/p&id|p&amp;id|\bpid\b|diagrama de proceso/, "ins-pid"],
  [/filosofia/, "ins-filosofia"], [/tipicos de montaje/, "ins-tipicos"], [/listado de cargas|lista de cargas/, "ele-cargas"], [/listado de cables|lista de cables/, "ele-cables"],
  [/listado i\/?o|lista i\/?o|listado de (entradas|senales)/, "ins-io"], [/listado de instrumentos|lista de instrumentos/, "ins-instrumentos"],
  [/hoja(s)? de datos de (los )?instrumentos/, "ins-hd"], [/hoja(s)? de datos de (los )?(equipos|tableros)/, "ele-hd"], [/memoria de (calculo de )?conductores/, "ele-mc"],
  [/memoria de (calculo de )?maxima demanda/, "ele-md"], [/listado de equipos|lista de equipos/, "ele-equipos"], [/diagrama de bloques/, "ins-bloques"],
  [/arreglo general de instrumentos/, "ins-arreglo"], [/arreglo general/, "ele-arreglo"],
];
export function docMencionado(t){ const a = ALIAS.find(([re])=>re.test(t)); return a ? a[1] : null; }

/* ---------- qué entregables cambian con cada tipo de operación ---------- */
const TODOS = "*";
const DEP = {
  instrumento: ["ins-instrumentos","ins-hd","ins-io","ins-lazo","ins-arquitectura","ins-unifilar-tc","ins-multifilar-tc","ins-mecanico-tc","ins-pid","ins-filosofia","ins-arreglo","ele-cargas","ele-hd"],
  carga: ["ele-cargas","ele-cables","ele-equipos","ele-hd","ele-mc","ele-md","ele-unifilar","ele-multifilar","ele-mecanico","ele-arreglo","ins-io","ins-lazo","ins-multifilar-tc","ins-mecanico-tc","ins-arquitectura","ins-filosofia","ins-bloques","ins-pid"],
  circuito: ["ins-unifilar-tc","ins-multifilar-tc","ins-mecanico-tc","ele-cargas","ele-hd"],
  control: ["ins-io","ins-lazo","ins-unifilar-tc","ins-multifilar-tc","ins-mecanico-tc","ins-arquitectura","ins-filosofia","ele-hd","ele-cargas"],
  tablero: TODOS, sistema: TODOS, proyecto: TODOS, diseno: TODOS, documentos: TODOS,
  equipo: ["ins-pid","ins-filosofia","ins-instrumentos"],
  componente: ["ele-cargas","ele-equipos","ele-hd","ele-unifilar","ele-multifilar","ele-mecanico","ins-io","ins-lazo","ins-unifilar-tc","ins-multifilar-tc","ins-mecanico-tc","ins-arquitectura","ins-filosofia"],
  filosofia: ["ins-filosofia","ins-pid"],
};
export function afectados(p, ops){
  const ids = new Set();
  for(const o of ops){
    const k = String(o.op||"").split(".")[0];
    if(k==="documento" || k==="nota"){ if(o.doc) ids.add(o.doc); continue; }
    if(k==="mecanico"){ const t = tableros(p).find(x=>x.tag===o.tag); ids.add(t && t.tipo==="control" ? "ins-mecanico-tc" : "ele-mecanico"); continue; }
    const dep = DEP[k]; if(!dep) continue;
    (dep===TODOS ? p.entregables : dep).forEach(id=>ids.add(id));
  }
  return [...ids].filter(id=>p.entregables.includes(id) && entregable(id)).map(id=>({ id, nombre: entregable(id).nombre }));
}
export function htmlAfectados(p, lista){
  if(!lista.length) return "";
  return `<div class="cp-afect"><b>Entregables actualizados (${lista.length}):</b> ${lista.map(d=>`<a href="#/proyecto/${p.id}/doc/${d.id}/vista">${esc(d.nombre)}</a>`).join(" · ")}</div>`;
}

/* ---------- tablero de control y circuitos ---------- */
function tableroCtl(p, t){
  const ctl = tablerosControl(p);
  return ctl.find(x=>new RegExp(`(^|[^a-z0-9])${norm(x.tag).replace(/[.*+?^${}()|[\]\\-]/g,"\\$&")}([^a-z0-9]|$)`).test(t)) || ctl[0] || null;
}
const barraDe = t => /24\s*v(dc)?\b|24vdc|\bdc\b/.test(t) ? "24 Vdc" : /220/.test(t) ? "220 Vac" : /120|\bvac\b/.test(t) ? "120 Vac" : "";
/* circuito al que se refiere la orden: por TAG (CB12, F3), por «C5 de 120 Vac», por instrumento o «la última reserva» */
function circuitoRef(p, tb, t){
  const eq = equiposControl(p, tb), cs = eq.circuitos;
  const m = t.match(/\b(cb\d+|f\d+)\b/); if(m){ const c = cs.find(c=>norm(c.tag)===m[1]); if(c) return c; }
  const cm = t.match(/\bc(\d+)\b/), b = barraDe(t);
  if(cm && b) { const c = cs.find(c=>c.barra===b && c.circuito==="C"+cm[1]); if(c) return c; }
  for(const i of instrumentos(p)) for(const tg of expandirTag(i.tag)) if(tg && t.includes(norm(tg))){ const c = cs.find(c=>new RegExp(norm(tg).replace(/[-]/g,"\\-")+"$").test(norm(c.descripcion))); if(c) return c; }
  if(/reserva/.test(t)){ const rs = cs.filter(c=>c.reserva && (!b || c.barra===b)); if(rs.length) return /primera/.test(t) ? rs[0] : rs[rs.length-1]; }
  for(const [re, frag] of [[/\bplc\b/, /al plc/], [/\bhmi\b|pantalla/, /hmi/], [/router/, /router/], [/switch/, /switch/], [/ventilacion/, /ventilaci/], [/luminaria/, /luminaria/], [/tomacorriente/, /tomacorriente/], [/limpieza/, /limpieza/]])
    if(re.test(t)){ const c = cs.find(c=>frag.test(norm(c.descripcion))); if(c) return c; }
  return null;
}
const CFG_EQUIPO = [["hmi", /\bhmi\b|pantalla/, "la pantalla HMI"], ["router", /router/, "el router IIoT"], ["switch", /switch/, "el switch Ethernet"], ["controladorLimpieza", /controlador de limpieza/, "el controlador de limpieza"], ["lucesPiloto", /luc(es|e)s? pilotos?|luz(es)? pilotos?/, "las luces piloto de la puerta"]];

/* ---------- eliminar un componente nombrado por su TAG (o por su nombre) en cualquier documento ----------
   Cada componente se quita en su origen, para que desaparezca de todos los entregables: un circuito se elimina,
   un equipo de red / controlador de limpieza / luces piloto / calefacción se desactiva en el tablero, una
   reactancia o filtro del variador se quita de su carga, los accesorios del tablero de fuerza (supresor, relé de
   fase, luces) se desactivan y el arrancador / variador / interruptor de una carga quita el circuito completo.
   Lo que se deriva de otros datos (módulos del PLC, relés de interfaz, borneras, fuente) se explica con un aviso. */
const NOMBRES_COMP = [[/tomacorriente/, /tomacorriente/i], [/luminaria/, /luminaria/i], [/ventilador|ventilacion/, /ventilaci/i], [/termostato de (la )?calefaccion|resistencia calefactora|calefaccion/, /^(TH2|R1)$/],
  [/luz piloto de alarma|luz de alarma/, /ALARMA/], [/luz piloto (de )?24/, /24 Vdc PRESENTE/], [/luz piloto (de )?220/, /220 Vac PRESENTE/], [/luz piloto (de )?120/, /120 Vac PRESENTE|Vac PRESENTE/],
  [/supresor|spd/, /^SPD/], [/rele de (falla de )?fase|rele de monitoreo/, /^RF$/]];
function eliminarComponente(q, p, t, doc){
  const Q = String(q||"").toUpperCase();
  const fuerza = () => eliminarFuerza(q, p, t, Q);
  // en un documento de fuerza se buscan primero los componentes de los tableros de fuerza
  if(/^ele-/.test(doc||"")){ const r = fuerza(); if(r) return r; }
  // control: índice de equipos de cada tablero de control
  for(const tb of tablerosControl(p)){
    let eq; try{ eq = equiposControl(p, tb); }catch(e){ continue; }
    const idx = indiceEquipos(eq);
    let e = idx.find(x=>new RegExp(`(^|[^A-Z0-9.])${x.tag.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}($|[^A-Z0-9.])`).test(Q) && x.tag.length > 1);
    // TH1 y los ventiladores son parte del circuito de ventilación
    if(!e && (/\bTH1\b/.test(Q) || /ventilador/.test(t)) && !/calefac/.test(t)) e = idx.find(x=>x.cfg==="ventilacion");
    if(!e) for(const [reQ, reE] of NOMBRES_COMP) if(reQ.test(t)){ e = idx.find(x=>reE.test(x.tag) || reE.test(x.leyenda||"") || reE.test(x.descripcion||"")); if(e) break; }
    if(!e) continue;
    const T = tb.tag;
    if(e.tipo==="luz") return [{ op:"componente.eliminar", tag:e.tag, tablero:T, accion:{ k:"luz", tablero:tb.id, clave:e.clave }, texto:`quitar la luz piloto ${e.tag} (${e.leyenda}) de la puerta` }];
    if(e.grupo==="calefaccion") return [{ op:"mecanico.editar", tag:T, campos:{ calefaccion:"no" } }];
    if(e.grupo==="red") return [{ op:"control.editar", tag:T, campos:{ [e.tipo==="hmi" ? "hmi" : e.tipo==="router" ? "router" : "switch"]: false } }];
    if(e.grupo==="limpieza") return [{ op:"control.editar", tag:T, campos:{ controladorLimpieza:false } }];
    // circuitos (o el equipo que alimentan): se quita el circuito con el flujo de circuitos
    if(["24 Vdc","120 Vac","220 Vac"].includes(e.grupo)) return new RegExp(`\\b${e.tag}\\b`).test(Q) ? null : interpretarDoc(`Elimina ${e.tag} de ${T}`, p);
    if(e.grupo==="reles") return [{ op:"aviso", texto:`${e.tag} es el relé de interfaz de la salida digital ${esc((e.senal && (e.senal.tag||e.senal.senal)) || "")}: sale de esa señal. Quita la señal (su equipo o instrumento) y el relé desaparece de todos los planos.` }];
    if(e.grupo==="plc") return [{ op:"aviso", texto:`${e.tag} sale de la cantidad de señales del listado I/O (${esc(e.modelo||"")}). Para quitar un módulo, quita sus señales o cambia los canales por módulo («Cambia los canales DI a 32 en ${T}»).` }];
    if(e.grupo==="spd") return [{ op:"aviso", texto:`${e.tag} protege la acometida de 220 Vac del tablero. Si no hay acometida auxiliar se quita solo: «Quita la acometida auxiliar de ${T}».` }];
    return [{ op:"aviso", texto:`${e.tag} es parte fija del tablero ${T} (${esc(e.desc||e.descripcion||e.tipo||"")}); no se puede quitar sin dejar el tablero incompleto.` }];
  }
  return fuerza();
}
function eliminarFuerza(q, p, t, Q){
  // fuerza: componentes del arreglo de cada tablero
  let arr = []; try{ arr = arreglosProyecto(p); }catch(e){}
  for(const m of arr){
    let c = m.comps.find(x=>x.tag && x.tag.length > 1 && new RegExp(`(^|[^A-Z0-9.])${x.tag.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}($|[^A-Z0-9.])`).test(Q));
    if(!c) for(const [reQ, reE] of NOMBRES_COMP) if(reQ.test(t)){ c = m.comps.find(x=>x.tag && reE.test(x.tag)); if(c) break; }
    if(!c) continue;
    const T = m.tablero.tag, l = c.circ && c.circ.carga ? datos(p).cargas.find(x=>x.tag===c.circ.carga) : null;
    if(c.tipo==="reactancia" && l) return [{ op:"componente.eliminar", tag:c.tag, tablero:T, accion:{ k:"filtro", carga:l.id, campo: /carga|dv\/dt/i.test(c.desc||"") ? "sinFiltroCarga" : "sinFiltroLinea" }, texto:`quitar ${c.tag} (${(c.desc||"").toLowerCase()}) de ${l.tag||"la carga"}` }];
    if(l) return [{ op:"aviso", texto:`${c.tag} (${esc((c.desc||c.tipo).toLowerCase())}) es el ${c.tipo==="interruptor" ? "interruptor" : c.tipo==="variador" ? "variador" : "arrancador"} de <b>${esc(l.tag)}</b>. Para quitarlo se quita el circuito completo: «Elimina la carga ${esc(l.tag)}»${c.tipo==="variador" || c.tipo==="guardamotor" || c.tipo==="contactor" ? `, o cambia su arranque («Pon el arranque de ${esc(l.tag)} directo»)` : ""}.` }];
    if(/^SPD/.test(c.tag)) return [{ op:"componente.eliminar", tag:c.tag, tablero:T, accion:{ k:"acc", tablero:m.tablero.id, clave:"spd" }, texto:`quitar el supresor de sobretensiones ${c.tag}` }];
    if(c.tag==="RF") return [{ op:"componente.eliminar", tag:c.tag, tablero:T, accion:{ k:"acc", tablero:m.tablero.id, clave:"releFase" }, texto:`quitar el relé de monitoreo de fase RF` }];
    return [{ op:"aviso", texto:`${c.tag} (${esc(c.desc||c.tipo)}) es parte fija del tablero ${T}: protege o alimenta a otros equipos y no se puede quitar sin dejar el tablero incompleto.` }];
  }
  return null;
}

/* ---------- interpretar una orden sobre documentos (motor propio) ---------- */
export function interpretarDoc(q, p){
  const t0 = norm(q), abierto = docAbierto();
  // sin los TAG de tableros ni de interruptores / circuitos al leer valores y nombres de equipos
  const tagsTab = tableros(p).map(x=>norm(x.tag)).sort((a, b)=>b.length - a.length);
  const t = t0;
  const doc = docMencionado(t) || (abierto && abierto.id===p.id ? abierto.doc : null);
  const quitar = /\b(quita|quitale|quitar|elimina|eliminar|borra|borrar|retira|retirar|sin)\b/.test(t);
  const agregar = /\b(agrega|agregar|anade|anadir|incluye|incluir|crea|crear|pon|ponle|coloca|con)\b/.test(t);
  const cambiar = /\b(cambia|cambiar|cambiale|modifica|pon|ajusta|actualiza|establece|define|usa)\b/.test(t);
  const tb = tableroCtl(p, t);
  if(quitar && !/\b(nota|reserva|circuito|carga|instrumento|acometida auxiliar)\b/.test(t)){ const r = eliminarComponente(q, p, t, doc); if(r) return r; }

  // --- cajetín y revisiones del documento abierto (o nombrado)
  if(doc && p.documentos[doc]){
    const campos = {};
    const mt = q.match(/t[ií]tulo(?:\s+del\s+(?:documento|plano))?\s*(?:a|por|:)\s*(.+)$/i); if(mt) campos.titulo = limpiar(mt[1]).toUpperCase();
    for(const [k, re] of [["elaboro", /(?:elabor[oó]|dise[nñ][oó])\s*(?:por|:|=)?\s+(.+?)(?:,|$| y (?:revis|aprob|dibuj))/i], ["reviso", /revis[oó]\s*(?:por|:|=)?\s+(.+?)(?:,|$| y (?:aprob|elabor|dibuj))/i], ["aprobo", /aprob[oó]\s*(?:por|:|=)?\s+(.+?)(?:,|$| y (?:revis|elabor|dibuj))/i], ["dibujo", /dibuj[oó]\s*(?:por|:|=)?\s+(.+?)(?:,|$| y (?:revis|aprob|elabor))/i]]){
      const m = q.match(re); if(m && !/^(el|la|los|las)\s+(documento|plano)$/i.test(m[1].trim())) campos[k] = limpiar(m[1]); }
    const es = t.match(/estado\s*(?:a|en|:)?\s*(por elaborar|en elaboracion|para revision|aprobado|emitido)/); if(es) campos.estado = { "por elaborar":"Por elaborar", "en elaboracion":"En elaboración", "para revision":"Para revisión", aprobado:"Aprobado", emitido:"Emitido" }[es[1]];
    if(Object.keys(campos).length) return [{ op:"documento.editar", doc, campos }];
    if(/\b(emite|emitir)\b/.test(t) && /(este|el) (documento|plano|listado|entregable)|solo este|\bsolo\b/.test(t)){
      const mot = [[/interna/, "Emitido para revisión interna"], [/cliente/, "Emitido para revisión del cliente"], [/aprobacion/, "Emitido para aprobación"], [/construccion/, "Emitido para construcción"], [/conforme a obra|as built/, "Conforme a obra"]].find(([re])=>re.test(t));
      return [{ op:"documento.emitir", doc, motivo: mot ? mot[1] : "Emitido para revisión del cliente" }];
    }
    const na = q.match(/(?:agrega|añade|anade|incluye)\s+(?:la\s+|una\s+)?nota\s*[:\-]?\s*(.+)$/i); if(na) return [{ op:"nota.agregar", doc, texto: limpiar(na[1]) }];
    const nq = t.match(/(?:quita|elimina|borra)\s+(?:la\s+)?nota\s*(?:n(?:umero|°|º)?\s*)?(\d+)/); if(nq) return [{ op:"nota.eliminar", doc, n:+nq[1] }];
  }

  // --- equipos del tablero de control (arquitectura, unifilar, multifilar, mecánico, I/O)
  if(tb){
    const c = {};
    const sinTab = tagsTab.reduce((a, tg)=>a.split(tg).join(" "), t);
    const esInstrumento = /\b[a-z]{1,5}-\d{2,4}[a-z]?\b/.test(sinTab) || /(de|tipo) (nivel|presion|flujo|caudal|temperatura|velocidad|posicion|vibracion)/.test(t);
    for(const [k, re] of CFG_EQUIPO) if(re.test(t) && (!/circuito|alimentaci/.test(t) || k==="lucesPiloto") && !esInstrumento){ if(quitar) c[k] = false; else if(agregar) c[k] = true; }
    // familia del PLC (plc-modulos.js): define los módulos y el conexionado con los bornes del fabricante
    const famPlc = !/\bplc\b|controlador|\bcpu\b/.test(t) ? "" : /s7-?1200|\b121[2457]c\b/.test(t) ? "s71200" : /siemens|s7|simatic/.test(t) ? "s71500" : /m340/.test(t) ? "m340"
      : /schneider|modicon|m580/.test(t) ? "m580" : /5370|1769/.test(t) ? "ab5370" : /allen|rockwell|compactlogix|5380|5069/.test(t) ? "ab5380" : "";
    if(famPlc) Object.assign(c, { familiaPlc:famPlc, marcaPlc:FAMILIAS[famPlc].marca, plc:FAMILIAS[famPlc].plc, modeloPlc:"" });
    const mm = q.match(/modelo\s+del?\s+(?:plc|controlador|cpu)\s*(?:a|por|:)\s*(.+)$/i); if(mm) c.modeloPlc = limpiar(mm[1]);
    if(/entradas (digitales|discretas)|senales discretas/.test(t) && cambiar){ const b = barraDe(t); if(b==="24 Vdc") c.ioDiscreto = "24 Vdc"; else if(/120/.test(t)) c.ioDiscreto = "120 Vac"; }
    if(/variador/.test(t) && /mando|control|comando/.test(t)){ if(/red|ethernet|comunicacion/.test(t)) c.vfdMando = "red"; else if(/cablead/.test(t)) c.vfdMando = "cableado"; }
    const ip = t.match(/\b(?:red|ip|direccion)\b.*?(\d{1,3}\.\d{1,3}\.\d{1,3})(?:\.\d{1,3})?/); if(ip) c.redIP = ip[1];
    const can = t.match(/canales.*?\b(ai|ao|di|do)\b.*?(\d{1,2})|(\d{1,2})\s+canales.*?\b(ai|ao|di|do)\b/);
    if(can){ const k = (can[1]||can[4]).toUpperCase(), n = +(can[2]||can[3]); if([4,8,16,32].includes(n)) c.canales = Object.assign({}, tb.canales||{}, { [k]: n }); }
    if(/repeticion|repetidor/.test(t)){ if(quitar) c.repetidores = false; else if(agregar || cambiar) c.repetidores = true; }
    if(/acometida (auxiliar|de 220)|alimentacion de 220/.test(t) && quitar) c.alimAux = "no";
    if(Object.keys(c).length && !/circuito|derivacion/.test(t)) return [{ op:"control.editar", tag: tb.tag, campos: c }];
  }

  // --- circuitos del tablero de control
  const docCtl = /^ins-(unifilar|multifilar|mecanico)-tc$/.test(doc||"") || (tb && t.includes(norm(tb.tag)));
  const hablaCircuito = !!tb && !/reserva (de )?(canales|espacio|senales|i\/?o)/.test(t) && (/circuito|derivacion|reserva/.test(t) || (docCtl && /\b(cb|f)\d+\b|\bc\d+ de (24|120|220)/.test(t)));
  if(tb && hablaCircuito){
    if(agregar && !quitar && !/\b(cb|f)\d+\b/.test(t)){
      const barra = barraDe(t) || (/(transmisor|sensor|analog|plc|hmi|switch|router)/.test(t) ? "24 Vdc" : "120 Vac");
      const res = /reserva/.test(t);
      const cant = (t.match(/\b(\d+)\s+(reservas|circuitos)/)||[])[1];
      const prot = (t.match(/(\d+(?:[.,]\d+)?)\s*a\b/)||[])[1];
      const pot = (t.match(/(\d+(?:[.,]\d+)?)\s*w\b/)||[])[1];
      let desc = res ? "Reserva" : limpiar((q.match(/(?:para|de|llamad[oa]|descripci[oó]n)\s+(?:el |la |los |las )?(?!24|120|220)([^,]+?)(?:\s+(?:de|con)\s+\d|$|,)/i)||[])[1] || "");
      if(!desc) desc = "Nuevo circuito";
      return Array.from({ length: Math.min(+cant||1, 12) }, ()=>({ op:"circuito.agregar", tag: tb.tag, barra, descripcion: desc.charAt(0).toUpperCase()+desc.slice(1), proteccion: prot ? num(prot) : (barra==="24 Vdc" ? 1 : barra==="220 Vac" ? 4 : 2), potencia: pot ? num(pot) : 0, diferencial: /diferencial|30\s*ma/.test(t) }));
    }
    const ref = circuitoRef(p, tb, t);
    if(!ref) return [{ op:"aviso", texto:`No encontré ese circuito en ${tb.tag}. Nómbralo por su TAG (p. ej. CB6 o F3), como «C5 de 120 Vac» o por el instrumento que alimenta.` }];
    const sel = { barra: ref.barra, circuito: ref.circuito, tagEq: ref.tag, descripcion: ref.descripcion };
    if(quitar){
      // un circuito que alimenta un instrumento o un equipo sigue a ese componente
      const inst = /([A-Z]{1,5}-\d{2,4}[A-Z]?)$/.exec(ref.descripcion||"");
      if(inst && !ref.reserva) return [{ op:"aviso", texto:`${ref.tag} alimenta a <b>${esc(inst[1])}</b>: el circuito sigue al instrumento. Para quitarlo, elimina el instrumento («Elimina el instrumento ${esc(inst[1])}») o cambia su alimentación.` }];
      const eqc = CFG_EQUIPO.find(([k, re])=>k!=="lucesPiloto" && re.test(norm(ref.descripcion)));
      if(eqc) return [{ op:"control.editar", tag: tb.tag, campos:{ [eqc[0]]: false } }];
      return [Object.assign({ op:"circuito.eliminar", tag: tb.tag }, sel)];
    }
    const campos = {};
    const tv = tagsTab.reduce((a, tg)=>a.split(tg).join(" "), t).replace(/\b(cb|f|c)\d+\b/g, " ");
    const pr = tv.match(/\d\s*x\s*(\d+(?:[.,]\d+)?)\s*a\b/) || tv.match(/(\d+(?:[.,]\d+)?)\s*a\b/); if(pr) campos.proteccion = num(pr[1]);
    const po = tv.match(/(\d+(?:[.,]\d+)?)\s*w\b/); if(po) campos.potencia = num(po[1]);
    const de = q.match(/descripci[oó]n(?:\s+de(?:l)?\s+(?:circuito\s+)?[A-Za-z]{1,3}\d+)?\s*(?:a|por|:)\s*(.+)$/i); if(de) campos.descripcion = limpiar(de[1]);
    if(/diferencial|30\s*ma/.test(t)) campos.diferencial = !quitar;
    const mb = t.match(/(?:a|hacia|en) (?:la )?barra (?:de )?(24|120|220)/); if(mb) campos.barra = mb[1]==="24" ? "24 Vdc" : mb[1]+" Vac";
    if(Object.keys(campos).length) return [Object.assign({ op:"circuito.editar", tag: tb.tag, campos }, sel)];
  }

  // --- filosofía de control: alarmas, set points, interlocks, secuencias y textos
  const fo = interpretarFilosofia(q, t, p, doc, { quitar, agregar, cambiar });
  if(fo) return fo;

  // --- equipos del proceso (P&ID)
  if((doc==="ins-pid" || /p&id|equipo de proceso|al proceso/.test(t)) && (agregar || quitar)){
    const tagE = (q.match(/\b([A-Za-z]{1,4}-\d{2,4}[A-Za-z]?)\b/)||[])[1];
    if(quitar && tagE) return [{ op:"equipo.eliminar", tag: tagE.toUpperCase() }];
    if(agregar && tagE){
      const TIPOS = [["colector", /colector|filtro de mangas/], ["ventilador", /ventilador|extractor/], ["valvula-rotativa", /valvula rotativa/], ["faja", /faja|transportador/], ["bomba", /bomba/], ["tanque", /tanque|cajon/], ["tolva", /tolva|silo/], ["compresor", /compresor/], ["chancadora", /chancadora/], ["molino", /molino/], ["agitador", /agitador/], ["aire", /aire comprimido/]];
      const tipo = (TIPOS.find(([, re])=>re.test(t))||["otro"])[0];
      const desc = limpiar((q.match(/["«“]([^"»”]+)["»”]/)||[])[1] || "") || ({ colector:"Colector de polvo", ventilador:"Ventilador", "valvula-rotativa":"Válvula rotativa", faja:"Faja transportadora", bomba:"Bomba", tanque:"Tanque", tolva:"Tolva", compresor:"Compresor", chancadora:"Chancadora", molino:"Molino", agitador:"Agitador", aire:"Línea de aire comprimido" })[tipo] || "Equipo";
      return [{ op:"equipo.agregar", tag: tagE.toUpperCase(), tipo, descripcion: desc }];
    }
  }
  return null;
}

/* ---------- describir ---------- */
export function describirDoc(op, p){
  const c = op.campos || {}, nom = id => esc((entregable(id)||{}).nombre || id);
  const si = v => v===true ? "sí" : v===false ? "no" : esc(v);
  switch(op.op){
    case "aviso": return op.texto;
    case "circuito.agregar": return `${esc(op.tag)}: agregar un circuito de <b>${esc(op.barra)}</b> «${esc(op.descripcion)}» con ${op.barra==="24 Vdc" ? "fusible" : "ITM 2P"} de <b>${op.proteccion} A</b>${op.diferencial ? " y diferencial de 30 mA" : ""}${op.potencia ? `, ${op.potencia} W` : ""}`;
    case "circuito.eliminar": return `${esc(op.tag)}: quitar <b>${esc(op.tagEq)}</b> (${esc(op.circuito)} de ${esc(op.barra)} — ${esc(op.descripcion)}); los demás circuitos se renumeran y se centran en el plano`;
    case "circuito.editar": return `${esc(op.tag)}, <b>${esc(op.tagEq)}</b> (${esc(op.descripcion)}): ${Object.entries(c).map(([k, v])=>`${{ proteccion:"protección", potencia:"potencia", descripcion:"descripción", diferencial:"diferencial 30 mA", barra:"barra" }[k]||k} → <b>${k==="proteccion" ? v+" A" : k==="potencia" ? v+" W" : si(v)}</b>`).join(", ")}`;
    case "control.editar": return `Tablero de control <b>${esc(op.tag)}</b>: ${Object.entries(c).map(([k, v])=>`${{ hmi:"pantalla HMI", switch:"switch Ethernet", router:"router IIoT", controladorLimpieza:"controlador de limpieza", lucesPiloto:"luces piloto en la puerta", familiaPlc:"familia del PLC", marcaPlc:"marca del PLC", plc:"controlador", modeloPlc:"modelo del PLC", ioDiscreto:"tensión de entradas digitales", vfdMando:"mando de variadores", redIP:"red IP", canales:"canales por módulo", repetidores:"repetición de estados", alimAux:"acometida auxiliar de 220 Vac" }[k]||k} → <b>${k==="canales" ? esc(Object.entries(v).map(([a, b])=>`${a} ${b}`).join(", ")) : k==="vfdMando" ? (v==="red" ? "por red" : "cableado") : k==="alimAux" ? "sin acometida auxiliar" : k==="familiaPlc" ? esc((FAMILIAS[v]||{}).nombre||v) : v==="" ? "el de catálogo de la marca" : si(v)}</b>`).join(", ")}`;
    case "documento.editar": return `${nom(op.doc)}: ${Object.entries(c).map(([k, v])=>`${{ titulo:"título", elaboro:"elaboró", reviso:"revisó", aprobo:"aprobó", dibujo:"dibujó", estado:"estado" }[k]||k} → <b>${esc(v)}</b>`).join(", ")}`;
    case "documento.emitir": return `Emitir la siguiente revisión de <b>${nom(op.doc)}</b>: «${esc(op.motivo)}»`;
    case "nota.agregar": return `${nom(op.doc)}: agregar la nota «${esc(op.texto)}»${(datos(p).notas[op.doc]||[]).length ? "" : " (reemplaza las notas del formato)"}`;
    case "nota.eliminar": return `${nom(op.doc)}: quitar la nota ${op.n} «${esc((datos(p).notas[op.doc]||[])[op.n-1]||"")}»`;
    case "equipo.agregar": return `P&amp;ID: agregar el equipo <b>${esc(op.tag)}</b> «${esc(op.descripcion)}»`;
    case "equipo.eliminar": return `P&amp;ID: quitar el equipo <b>${esc(op.tag)}</b>`;
    case "componente.eliminar": return `${esc(op.tablero||"")}: ${esc(op.texto||"quitar "+op.tag)} en todos los entregables`;
    case "filosofia.cambiar": return op.texto || `Filosofía de control: ${esc(op.fn)}`;
  }
  return null;
}

/* ---------- aplicar ---------- */
export function aplicarDoc(p, op, avisos){
  const d = datos(p), c = op.campos || {};
  const tb = tablerosControl(p).find(x=>x.tag===op.tag) || tablerosControl(p)[0];
  // los circuitos editados se guardan como lista propia del tablero (sincronizada con instrumentos y equipos)
  const lista = () => (d.circuitosCtl[tb.id] = circuitosControl(p, tb).map(x=>Object.assign({}, x)));
  // el circuito «Cn» del unifilar es el n-ésimo de su barra sin contar la derivación de la fuente de 24 Vdc
  // (que en el unifilar es CB1 → PS1 → CB2, no una columna de la barra de 120 Vac)
  const buscar = L => { const idx = L.map((x, i)=>i).filter(i=>L[i].barra===op.barra && !(L[i].cfg==="fuente" || /fuente de 24/i.test(L[i].descripcion||"")));
    const k = idx[(parseInt(String(op.circuito).replace(/\D/g, ""), 10) || 0) - 1];
    return k!=null && (!op.descripcion || L[k].descripcion===op.descripcion || /^reserva$/i.test(op.descripcion)) ? k : L.findIndex(x=>x.barra===op.barra && x.descripcion===op.descripcion); };
  switch(op.op){
    case "aviso": return {};
    case "circuito.agregar": { if(!tb) return {}; const L = lista();
      const n = { barra: op.barra, circuito:"", descripcion: op.descripcion, proteccion: +op.proteccion||2, potencia: +op.potencia||0, cable:"2C#14AWG+14AWG(T)", diferencial: !!op.diferencial };
      const res = L.findIndex(x=>x.barra===op.barra && /^reserva$/i.test(x.descripcion||""));
      const ult = L.map(x=>x.barra).lastIndexOf(op.barra);
      L.splice(/^reserva$/i.test(op.descripcion) ? (ult >= 0 ? ult + 1 : L.length) : (res >= 0 ? res : (ult >= 0 ? ult + 1 : L.length)), 0, n);
      const k = {}; L.forEach(x=>{ k[x.barra] = (k[x.barra]||0) + 1; x.circuito = "C"+k[x.barra]; });
      return {}; }
    case "circuito.eliminar": { if(!tb) return {}; const L = lista(), i = buscar(L); if(i < 0){ avisos.push(`No encontré ${op.tagEq}.`); return {}; }
      L.splice(i, 1); const k = {}; L.forEach(x=>{ k[x.barra] = (k[x.barra]||0) + 1; x.circuito = "C"+k[x.barra]; }); return {}; }
    case "circuito.editar": { if(!tb) return {}; const L = lista(), i = buscar(L); if(i < 0){ avisos.push(`No encontré ${op.tagEq}.`); return {}; }
      const x = L[i];
      if(c.proteccion!=null && +c.proteccion > 0) x.proteccion = +c.proteccion;
      if(c.potencia!=null && +c.potencia >= 0) x.potencia = +c.potencia;
      if(c.descripcion) x.descripcion = c.descripcion;
      if(c.diferencial!=null) x.diferencial = !!c.diferencial;
      if(c.barra && c.barra!==x.barra){ x.barra = c.barra; L.splice(i, 1); const ult = L.map(y=>y.barra).lastIndexOf(c.barra); L.splice(ult + 1, 0, x); }
      const k = {}; L.forEach(y=>{ k[y.barra] = (k[y.barra]||0) + 1; y.circuito = "C"+k[y.barra]; }); return {}; }
    case "control.editar": { if(!tb){ avisos.push("El proyecto no tiene tablero de control."); return {}; }
      for(const [k, v] of Object.entries(c)){
        if(["hmi","switch","router","controladorLimpieza","repetidores","lucesPiloto"].includes(k)) tb[k] = !!v;
        else if(k==="canales") tb.canales = Object.assign({}, tb.canales||{}, v);
        else if(k==="ioDiscreto" && ["120 Vac","24 Vdc"].includes(v)) tb.ioDiscreto = v;
        else if(k==="vfdMando" && ["red","cableado"].includes(v)) tb.vfdMando = v;
        else if(k==="familiaPlc" && FAMILIAS[v]){
          // canales por módulo y primer slot típicos de la nueva familia (solo los que siguen en el valor de la familia anterior o sin módulo)
          const F = FAMILIAS[v], ant = familiaPlc(tb); tb.canales = Object.assign({}, tb.canales||{});
          for(const x of ["AI","AO","DI","DO"]){ const n = tb.canales[x]; if(n==null || n==="" || +n===+ant.canales[x] || !modeloFamilia(F, x, +n, tb.ioDiscreto)) tb.canales[x] = F.canales[x]; }
          if(tb.primerSlot==null || tb.primerSlot==="" || +tb.primerSlot===+ant.primerSlot) tb.primerSlot = F.primerSlot;
          if(F.sinDI120 && tb.ioDiscreto!=="24 Vdc"){ tb.ioDiscreto = "24 Vdc"; avisos.push(`${F.nombre} no tiene entradas de 120 Vac: las entradas digitales quedan en 24 Vdc.`); }
          tb.familiaPlc = v; }
        else if(["marcaPlc","plc","modeloPlc","redIP","redExterna","alimAux"].includes(k)) tb[k] = v;
      }
      return { regenerarIO: true }; }
    case "documento.editar": { const doc = p.documentos[op.doc]; if(!doc) return {};
      for(const k of ["titulo","elaboro","reviso","aprobo","dibujo","estado"]) if(c[k]!=null && c[k]!=="") doc[k] = c[k];
      return {}; }
    case "documento.emitir": return { emitir:[op.doc] };
    case "nota.agregar": { d.notas[op.doc] = (d.notas[op.doc]||[]).concat([op.texto]); return {}; }
    case "nota.eliminar": { const a = d.notas[op.doc]||[]; if(op.n >= 1 && op.n <= a.length) a.splice(op.n-1, 1); else avisos.push(`No existe la nota ${op.n}.`); return {}; }
    case "equipo.agregar": { const eqs = d.proceso.equipos = d.proceso.equipos || []; if(eqs.some(e=>e.tag===op.tag)){ avisos.push(`${op.tag} ya existe.`); return {}; } eqs.push({ tag: op.tag, tipo: op.tipo||"otro", descripcion: op.descripcion||"" }); return {}; }
    case "filosofia.cambiar": { aplicarFilosofia(p, op, avisos); return {}; }
    case "componente.eliminar": { const a = op.accion||{};
      if(a.k==="luz"){ const t = tableros(p).find(x=>x.id===a.tablero); if(t){ t.lucesOmitir = [...new Set([...(t.lucesOmitir||[]), a.clave])]; } return { regenerarIO: true }; }
      if(a.k==="filtro"){ const l = d.cargas.find(x=>x.id===a.carga); if(l) l[a.campo] = true; else avisos.push("No encontré la carga."); return {}; }
      if(a.k==="acc"){ const t = tableros(p).find(x=>x.id===a.tablero); if(t){ t.accesorios = Object.assign({}, t.accesorios||{}, { [a.clave]: false }); } return {}; }
      return {}; }
    case "equipo.eliminar": { const n = (d.proceso.equipos||[]).length; d.proceso.equipos = (d.proceso.equipos||[]).filter(e=>e.tag!==op.tag); if(n===d.proceso.equipos.length) avisos.push(`No encontré el equipo ${op.tag}.`); return {}; }
  }
  return null;
}
export const OPS_DOC = ["componente.eliminar","filosofia.cambiar","circuito.agregar","circuito.eliminar","circuito.editar","control.editar","documento.editar","documento.emitir","nota.agregar","nota.eliminar","equipo.agregar","equipo.eliminar"];

/* ---------- sugerencias de Copito según el documento abierto (con los TAG reales del proyecto) ---------- */
export function sugerenciasDoc(p, id){
  const d = datos(p), tb = tablerosControl(p)[0], carga = d.cargas[0], c2 = d.cargas[1] || carga;
  const inst = instrumentos(p)[0];
  let eq = null; try{ eq = tb ? equiposControl(p, tb) : null; }catch(e){}
  const c120 = eq && eq.circuitos.find(c=>c.barra==="120 Vac" && !c.reserva);
  const T = tb ? tb.tag : "TC-001";
  const gen = ["Cambia el título del documento a …", "Revisó …", "Agrega la nota: …", "Emite este documento para revisión del cliente"];
  const S = {
    "ins-unifilar-tc": [`Agrega una reserva en 24 Vdc en ${T}`, `Quita la última reserva de 120 Vac`, c120 ? `Cambia ${c120.tag} a 2x4A` : null, tb && tb.router ? `Quita el router de ${T}` : `Agrega el router en ${T}`],
    "ins-multifilar-tc": [`Cambia los canales DI a 32 en ${T}`, `Pon las entradas digitales a 24 Vdc en ${T}`, inst ? `Elimina el instrumento ${expandirTag(inst.tag)[0]}` : null, `Agrega el instrumento TT-301 transmisor de temperatura`],
    "ins-mecanico-tc": [`Cambia el gabinete de ${T} a 800x1000x300`, `Pon ventilación forzada en ${T}`, `Mueve PS1 a la derecha`, `Agrega una reserva en 120 Vac en ${T}`],
    "ins-arquitectura": [tb && tb.hmi ? `Quita la pantalla HMI de ${T}` : `Agrega la pantalla HMI en ${T}`, `Cambia la red IP de ${T} a 10.10.1`, `Pon el mando de variadores por red en ${T}`, `Pon el PLC Siemens en ${T}`],
    "ins-io": [`Agrega el instrumento TT-301 transmisor de temperatura`, `Cambia la reserva de canales I/O a 25 %`, `Cambia los canales AI a 16 en ${T}`],
    "ins-lazo": [inst ? `Cambia el rango de ${expandirTag(inst.tag)[0]} a 0-16` : null, `Agrega el instrumento FIT-401 transmisor de flujo`],
    "ins-instrumentos": [inst ? `Cambia la ubicación de ${expandirTag(inst.tag)[0]} a línea principal` : null, `Agrega el instrumento PIT-401 transmisor de presión`],
    "ins-pid": [`Agrega el equipo TK-101 tanque`, `Agrega el instrumento LIT-101 transmisor de nivel`],
    "ins-filosofia": [inst ? `Cambia el set point alto de ${expandirTag(inst.tag)[0]} a …` : null, inst ? `Agrega una alarma muy alta en ${expandirTag(inst.tag)[0]} a …` : null, carga && inst ? `Agrega un interlock de seguridad: ${expandirTag(inst.tag)[0]} para ${carga.tag}` : null, "Agrega un paso a la secuencia de arranque: …", "Regenera las alarmas desde el proyecto"],
    "ele-cargas": [`Agrega una bomba de 15 kW con variador`, carga ? `Cambia la potencia de ${carga.tag} a ${Math.round((+carga.power||10)*1.2)} ${carga.powerUnit==="kw"?"kW":"HP"}` : null],
    "ele-unifilar": [c2 ? `Elimina la carga ${c2.tag}` : null, c2 ? `Pon el arranque de ${c2.tag} con variador` : null, `Agrega una bomba de 15 kW con variador`],
    "ele-multifilar": [c2 ? `Pon el arranque de ${c2.tag} con arrancador suave` : null, `Agrega una bomba de 7.5 kW`],
    "ele-mecanico": [carga ? `Cambia la entrada de cables a superior` : null, `Pon ventilación forzada`],
    "ele-cables": [carga ? `Cambia la longitud del cable de ${carga.tag} a 80 m` : null],
  };
  return [...(S[id]||[]), ...gen].filter(Boolean).slice(0, 6);
}

/* barra «Cambios con Copito» al pie de la vista previa de cada documento */
export function montarBarraCopito(body, p, id){
  if(!body || body.querySelector(".cp-docbar") || body.querySelector(".v3d-copito-bar")) return;
  const div = document.createElement("div");
  div.className = "v3d-copito-bar mt-2 cp-docbar";
  div.innerHTML = `<div><strong>Cambios con Copito</strong><span class="muted"> · Pídele cualquier cambio de este documento: lo propone, lo aplicas al confirmar y se actualizan este documento y los demás entregables relacionados.</span></div>
    <div class="v3d-chips"><button class="btn-sm btn-accent" data-cp="">Pedir un cambio a Copito…</button><button class="btn-sm" data-cp="¿Qué puedo hacer en este documento?">¿Qué puedo pedirle?</button></div>`;
  body.appendChild(div);
  // doble clic sobre una fila de un listado (o tabla de la vista previa): Copito se abre con su TAG
  if(!body._cpDbl){ body._cpDbl = true; body.addEventListener("dblclick", ev=>{
    const tr = ev.target.closest && ev.target.closest("tbody tr"); if(!tr || !window.copito) return;
    const tag = [...tr.cells].map(td=>td.textContent.trim()).find(x=>/^[A-Z]{1,6}\d*-\d{2,4}[A-Z]?$|^(CB|F|TB|XF)\d+$/.test(x));
    if(tag) window.copito.abrir(`En ${(entregable(id)||{}).nombre||"este documento"}, para ${tag}, `, false);
  }); }
  div.querySelectorAll("[data-cp]").forEach(b=>b.onclick = ()=>{
    const txt = b.dataset.cp; if(!window.copito) return;
    if(!txt) window.copito.abrir("", false); else if(/…/.test(txt)) window.copito.abrir(txt.replace(/…\s*$/, ""), false); else window.copito.abrir(txt, true);
  });
}

/* respuesta sobre un equipo del tablero de control nombrado por su TAG (CB6, F3, PS1, CR4, AI1, TB6…) */
export function respuestaEquipoControl(q, p){
  const m = String(q||"").toUpperCase().match(/\b((?:MCB|CB|F|TB|XF|CR|PS|SPD|ID|AI|AO|DI|DO|SW|HMI|RUT|CN)\d+|PLC|TAP)\b/); if(!m) return null;
  for(const tb of tablerosControl(p)){
    let eq; try{ eq = equiposControl(p, tb); }catch(e){ continue; }
    const e = indiceEquipos(eq).find(x=>x.tag===m[1]); if(!e) continue;
    const nombre = e.barra ? (e.tipo==="fusible" ? "Fusible-borne" : "Interruptor termomagnético 2P") : (e.desc || e.descripcion || e.tipo || "");
    const filas = [["Tablero", esc(tb.tag)], ["Equipo", esc(nombre)], ["Modelo", esc(e.modelo || "—")]];
    if(e.val) filas.push(["Valor", esc(e.val)]);
    if(e.barra) filas.push(["Barra / circuito", esc(`${e.barra} ${e.circuito||""}`)]);
    if(e.borne) filas.push(["Bornes", esc(e.borne)]);
    if(e.descripcion && e.grupo!=="borneras") filas.push(["Alimenta a", esc(e.descripcion)]);
    if(e.tipo==="rele") filas.push(["Mando", esc(`${e.modulo} canal ${e.ch} · bobina ${e.bobina} · contacto ${e.contacto}`)]);
    if(e.slot!=null && e.tipo!=="rele") filas.push(["Slot", esc(e.slot)]);
    if(e.senales) filas.push(["Señales", esc(e.senales.filter(s=>s.origen!=="reserva").map(s=>s.tag).join(", ") || "reserva")]);
    if(e.bornes) filas.push(["Bornes", esc(e.bornes.length + " (" + [...new Set(e.bornes.map(b=>b.modelo))].join(", ") + ")")]);
    return `<b>${esc(e.tag)}</b> en ${esc(tb.tag)}:<div class="cp-tabla"><table><tbody>${filas.map(([a, b])=>`<tr><td>${a}</td><td>${b}</td></tr>`).join("")}</tbody></table></div><a class="cp-ir" href="#/proyecto/${p.id}/doc/ins-unifilar-tc/vista">Ver en el unifilar de control →</a>`;
  }
  return null;
}

/* ---------- filosofía de control (API de js/modules/filosofia.js) ---------- */
const TIPO_AL = [[/muy alta|alta alta|\bhh\b|alto alto/, "HH"], [/muy baja|baja baja|\bll\b|bajo bajo/, "LL"], [/\balta\b|\balto\b|\bh\b|high/, "H"], [/\bbaja\b|\bbajo\b|\bl\b|low/, "L"], [/falla/, "falla"]];
const TEXTO_ALIAS = [["introduccion", /introduccion/], ["objetivos", /objetivo/], ["alcance", /alcance/], ["exclusiones", /exclusion/], ["normas", /normas/], ["condiciones", /condiciones (generales|del sitio)/], ["arquitectura", /arquitectura/], ["operacion", /descripcion de la operacion/], ["condicionesOperacion", /condiciones de operacion/], ["modos", /modos de operacion/], ["monitoreo", /monitoreo/], ["supervision", /supervision/], ["notas", /\bnotas\b/]];
function interpretarFilosofia(q, t, p, doc, { quitar, agregar, cambiar }){
  const enFil = doc==="ins-filosofia" || /filosofia/.test(t);
  if(!enFil && !/alarma|interlock|enclavamiento|permisivo|set ?point|consigna|secuencia de (arranque|parada)|paso de (arranque|parada)/.test(t)) return null;
  const tags = [...q.matchAll(/\b([A-Za-z]{1,5}-\d{2,4}[A-Za-z]?)\b/g)].map(m=>m[1].toUpperCase());
  const tipoAl = (TIPO_AL.find(([re])=>re.test(t))||[])[1];
  const valor = (t.match(/(?:a|en|de|=)\s*(-?\d+(?:[.,]\d+)?)\s*([a-z%°/0-9]*)/)||[]);
  const op = (fn, args, texto) => [{ op:"filosofia.cambiar", fn, args, texto }];
  // regenerar
  if(/regenera|restablece|vuelve a generar|desde el proyecto/.test(t) && enFil){
    const tb = /alarma/.test(t) ? "alarmas" : /interlock|enclavamiento/.test(t) ? "interlocks" : /set ?point/.test(t) ? "setpoints" : /arranque/.test(t) ? "arranque" : /parada/.test(t) ? "parada" : "todo";
    return op("regenerar", [tb], tb==="todo" ? "Regenerar toda la filosofía de control desde el proyecto (se pierden las ediciones)" : `Regenerar «${TABLAS_FIL[tb].titulo}» desde el proyecto`);
  }
  // set point de una alarma
  if(tags[0] && (/set ?point|consigna|ajuste/.test(t) || (cambiar && /alarma/.test(t))) && valor[1]){
    const campo = ({ HH:"hh", H:"h", L:"l", LL:"ll" })[tipoAl] || "sp";
    return op("editar", ["setpoints", "sp:"+tags[0], { [campo]: valor[1].replace(",", ".") }], `Set point ${campo.toUpperCase()} de <b>${esc(tags[0])}</b> → <b>${esc(valor[1])} ${esc(valor[2]||"")}</b> (la alarma y la secuencia lo toman)`);
  }
  // alarmas
  if(/alarma/.test(t) && tags[0]){
    if(quitar){ const al = (filosofiaDe(p).tablas.alarmas||[]).find(a=>a.instrumento===tags[0] && (!tipoAl || a.tipo===tipoAl));
      return op("quitarAlarma", [tipoAl && al ? al.id : tags[0]], `Quitar ${tipoAl ? `la alarma ${tipoAl}` : "las alarmas"} de <b>${esc(tags[0])}</b> de la filosofía`); }
    if(agregar){ const tp = tipoAl || "H";
      return op("agregarAlarma", [{ instrumento:tags[0], senal:`${tags[0]}_${tipoInstrumento0(tags[0])}A${tp.length<=2 ? tp : ""}`, descripcion:`${{ H:"Alta", HH:"Muy alta", L:"Baja", LL:"Muy baja", falla:"Falla" }[tp]||tp} en ${tags[0]}`, tipo:tp, setpoint: valor[1] ? `${tp.startsWith("L") ? "≤" : "≥"} ${valor[1]} ${valor[2]||""}`.trim() : "" }], `Agregar la alarma <b>${esc(tp)}</b> en <b>${esc(tags[0])}</b>${valor[1] ? ` con set point ${esc(valor[1])} ${esc(valor[2]||"")}` : ""}`); }
  }
  // interlocks y permisivos
  if(/interlock|enclavamiento|permisivo/.test(t)){
    if(quitar && tags[0]) return op("quitarInterlock", [(filosofiaDe(p).tablas.interlocks||[]).find(x=>x.senal && x.senal.startsWith(tags[0]) || x.equipo===tags[0])?.id || tags[0]], `Quitar el interlock de <b>${esc(tags[0])}</b>`);
    if(agregar && tags[0]){
      const tipo = /permisivo/.test(t) ? "permisivo" : /seguridad/.test(t) ? "seguridad" : "proceso";
      let accion = limpiar((q.match(/(?:para|parar|detener|detiene|bloquea|accion)\s*:?\s*(.+)$/i)||[])[1] || "");
      if(!accion || /^[A-Za-z]{1,5}-\d{2,4}[A-Za-z]?$/.test(accion)) accion = tags[1] ? `Parada de ${tags[1]}` : accion;
      return op("agregarInterlock", [{ tipo, senal:tags[0], servicio:"", equipo: tags[1] || "", condicion:"", accion, valor: valor[1] ? `${valor[1]} ${valor[2]||""}`.trim() : "", retardo:"" }], `Agregar un interlock de <b>${esc(tipo)}</b>: <b>${esc(tags[0])}</b>${tags[1] ? ` → ${esc(tags[1])}` : ""}${accion ? ` («${esc(accion)}»)` : ""}`);
    }
  }
  // pasos de las secuencias
  if(/paso/.test(t) && agregar && (enFil || /secuencia/.test(t))){
    const sec = /parada/.test(t) ? (limpiar((q.match(/parada (?:por|de|ante)\s+([^:,]+)/i)||[])[1]) || "Parada normal") : "arranque";
    const accion = limpiar(((q.match(/:\s*(.+)$/)||[])[1] || "").replace(/^[A-Za-z]{1,5}-\d{2,4}[A-Za-z]?\s*[,:-]?\s*/, ""));
    return op("agregarPaso", [sec, { equipo: tags[0] || "", accion: accion || "Arranque", descripcion:"" }], `Agregar a la secuencia de <b>${esc(sec)}</b> el paso «${esc(accion || "Arranque")}»${tags[0] ? ` de ${esc(tags[0])}` : ""}`);
  }
  // textos
  if(enFil && (cambiar || agregar)){
    const tx = TEXTO_ALIAS.find(([, re])=>re.test(t));
    const m = tx ? q.slice(Math.max(0, t.search(tx[1]))).match(/^\S+(?:\s+de\s+la\s+filosof\S+)?\s*(?:\s+a|\s+por|:)\s+(.{8,})$/i) : null;
    if(tx && m) return op("editarTexto", [tx[0], limpiar(m[1])], `Filosofía, «${esc(TEXTOS_FIL[tx[0]])}» → «${esc(limpiar(m[1]))}»`);
  }
  return null;
}
const tipoInstrumento0 = tag => (String(tag).match(/^([A-Z]+?)(I?T|S[HL]{0,2})?-/)||[,""])[1] || String(tag).replace(/-.*$/, "");
export function aplicarFilosofia(p, op, avisos){
  const fn = filosofiaOps[op.fn]; if(typeof fn!=="function"){ avisos.push(`Operación desconocida: ${op.fn}`); return; }
  const r = fn.apply(filosofiaOps, [p, ...(op.args||[])]);
  if(r && r.ok===false) avisos.push(r.msg);
}

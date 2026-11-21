/* Ingenia — BIBLIOTECA DE COMPONENTES (plantillas por marca y modelo).
   Cada componente del tablero (interruptores, contactores, variadores, fuentes, PLC…) queda registrado una sola vez por
   marca + modelo, con sus medidas reales (ancho × alto × fondo, mm) y, si el usuario las carga, sus vistas FRONTAL y de
   PERFIL en DXF (el plano dimensional del fabricante o el dibujo propio). Cuando un proyecto vuelve a usar ese mismo
   equipo, el arreglo mecánico toma esas medidas y el plano 2D lo dibuja con su plantilla en lugar del dibujo genérico de
   su familia; la vista 3D usa las medidas.
   La biblioteca vive en el navegador (junto a los proyectos) y viaja con el respaldo de datos (Configuración → Respaldo).
   Componentes que no están: se registran solos al generar un arreglo (con las medidas de catálogo de Ingenia) y el usuario
   les carga el DXF del fabricante (botón «Buscar CAD» abre la búsqueda del modelo). Una imagen no se convierte en DXF de
   forma confiable: hace falta el CAD del fabricante o dibujarlo. */
import { load, save } from "../store.js";
import { parseDXF, boundsOf, toCompact } from "../dxf.js";

/* clave normalizada: «ABB S202-C16» y «abb s202 c16» son el mismo componente */
export const claveComp = (marca, modelo) => `${String(marca||"").trim()} ${String(modelo||"").trim()}`.toUpperCase().replace(/[^A-Z0-9.+/]+/g, " ").trim();

function lista(){ const st = load(); if(!Array.isArray(st.biblioteca)) st.biblioteca = []; return st.biblioteca; }
export function componentes(){ return lista().slice(); }
export function buscar(marca, modelo){
  const k = claveComp(marca, modelo), ks = claveComp("", modelo);
  return lista().find(e=>e.clave===k) || (ks ? lista().find(e=>claveComp("", e.modelo)===ks) : null) || null;
}
/* registra (o actualiza sin pisar lo del usuario) un componente; devuelve la entrada */
export function registrar({ marca, modelo, codigo, tipo, w, h, d, desc }, opciones = {}){
  if(!modelo) return null;
  let e = buscar(marca, modelo);
  if(!e){
    e = { id:"cmp" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), clave:claveComp(marca, modelo), marca:marca||"", modelo, codigo:codigo||"", tipo:tipo||"", desc:desc||"",
      w:+w||0, h:+h||0, d:+d||0, medidas:"catalogo", vistas:{}, alta:new Date().toISOString().slice(0, 10) };
    lista().push(e);
  } else if(e.medidas!=="usuario" && opciones.medidas!==false){ Object.assign(e, { w:+w||e.w, h:+h||e.h, d:+d||e.d }); }
  if(codigo && !e.codigo) e.codigo = codigo;
  if(!opciones.sinGuardar) save();
  return e;
}
export function actualizar(id, cambios){ const e = lista().find(x=>x.id===id); if(!e) return null; Object.assign(e, cambios); save(); return e; }
export function eliminar(id){ const st = load(); st.biblioteca = lista().filter(x=>x.id!==id); save(); }

/* vista desde un DXF (frente o perfil): primitivas compactas con origen en la esquina inferior izquierda y su tamaño (mm) */
export function vistaDesdeDXF(texto){
  const r = parseDXF(texto);
  const ents = r.entities.filter(e=>e.space!=="paper" && e.t!=="T");
  if(!ents.length) throw new Error("El DXF no tiene líneas, arcos ni polilíneas en el espacio modelo.");
  const b = boundsOf(ents);
  return { geo: toCompact(ents, { x:b.minX, y:b.minY }), w: Math.round((b.maxX - b.minX)*10)/10, h: Math.round((b.maxY - b.minY)*10)/10 };
}
export function cargarVista(id, cual, texto){
  const e = lista().find(x=>x.id===id); if(!e) throw new Error("Componente no encontrado");
  const vz = vistaDesdeDXF(texto);
  e.vistas = e.vistas || {}; e.vistas[cual] = vz;
  // las medidas del DXF del fabricante mandan sobre las de catálogo (frente: ancho y alto; perfil: fondo y alto)
  if(cual==="frente"){ e.w = vz.w; e.h = vz.h; } else if(cual==="perfil"){ e.d = vz.w; if(!e.h) e.h = vz.h; }
  e.medidas = "usuario";
  save(); return e;
}

/* ---------- biblioteca BASE: los componentes del usuario (Componentes 3d.dxf → assets/componentes/biblioteca_base.json) ----------
   295 componentes con sus vistas frontal, lateral e isométrica y sus atributos (familia, marca, modelo, ancho / alto / fondo,
   montaje, fuente y confianza de las medidas). Solo lectura; se carga una vez (cargarBase) antes de armar los planos. */
let BASE = null, cargando = null;
export function cargarBase(){
  if(BASE) return Promise.resolve(BASE);
  if(!cargando) cargando = fetch("assets/componentes/biblioteca_base.json").then(r=>r.ok ? r.json() : []).catch(()=>[]).then(l=>{ BASE = indexar(l); return BASE; });
  return cargando;
}
export const baseCargada = () => !!BASE;
export const componentesBase = () => BASE || [];
/* familias de la base que corresponden a cada tipo de equipo del arreglo (gabinetes, canaletas y rieles los arma el motor) */
const FAM_TIPOS = { PRO:["interruptor","mcb","diferencial","fusible","xlp","spd","guardamotor"], MAN:["contactor","rele","sobrecarga"], ARR:["variador","arrancador","reactancia"],
  PLC:["cpu","modulo","fpd","tapa","switch","router"], ALI:["trafo","fuente"], CLI:["termostato","resistencia","luminaria"], ACC:["tomacorriente"], MED:["medidor"] };
/* tokens con números de un modelo («Tmax XT4 3P fijo» → XT4, 3P; «UT 4» → UT4), sin lo que va entre paréntesis */
function tokens(s){
  const t = String(s||"").toUpperCase().replace(/\([^)]*\)/g, " ").replace(/…/g, " ").split(/[\s+]+/).filter(Boolean);
  const out = [];
  for(let i=0; i<t.length; i++){ if(/^[A-Z]{1,4}$/.test(t[i]) && t[i+1] && /^\d/.test(t[i+1])){ out.push(t[i] + t[i+1]); i++; continue; } if(/\d/.test(t[i])) out.push(t[i]); }
  return out;
}
function indexar(l){ for(const e of l){ e.fam = String(e.id).slice(0, 3); e.tok = tokens(e.modelo); e.base = true; } return l; }
/* el primer código del proyecto corresponde al primero de la base: iguales, o uno es el otro con su sufijo («AF09» y
   «AF09-30-10», «S202-C16» y «S202»); los demás códigos de la base (p. ej. «3P», «3L») deben estar en el del proyecto */
const corresponde = (a, b) => a===b || (b.startsWith(a) && /^[-/.]/.test(b.slice(a.length))) || (a.startsWith(b) && /^[-/.]/.test(a.slice(b.length)));
const VA_TRAFO = [[100,"ALI-AUDAX-50-100VA"],[250,"ALI-GEN-TR1F-250VA"],[500,"ALI-GEN-TR1F-500VA"],[1000,"ALI-GEN-TR1F-1KVA"],[2000,"ALI-GEN-TR1F-2KVA"]];
export function buscarBase(c){
  if(!BASE || !c) return null;
  const tipo = c.tipo || "";
  // transformadores de control: por potencia (la base tiene los del usuario por VA)
  if(tipo==="trafo"){ const v = String(c.val||""), va = /kVA/i.test(v) ? parseFloat(v)*1000 : parseFloat(v) || 0; const r = VA_TRAFO.find(x=>va <= x[0]); return r ? BASE.find(e=>e.id===r[1]) || null : null; }
  const P = tokens(c.modelo); if(!P.length) return null;
  let mejor = null;
  for(const e of BASE){
    if(!e.tok.length || !FAM_TIPOS[e.fam] || (tipo && !FAM_TIPOS[e.fam].includes(tipo))) continue;
    if(!corresponde(P[0], e.tok[0])) continue;
    if(!e.tok.slice(1).every(t=>P.includes(t))) continue;
    // polos («3L», «3P», «1N»…): los del proyecto deben estar en la plantilla (un OVR 3L no toma la plantilla de un polo)
    if(P.some(t=>/^\d[PLN]$/.test(t) && !e.tok.includes(t))) continue;
    const s = e.tok.join("").length + (P[0]===e.tok[0] ? 5 : 0);
    if(!mejor || s > mejor.s) mejor = { e, s };
  }
  return mejor ? mejor.e : null;
}
/* medidas de la biblioteca sobre las de catálogo (al armar el arreglo): las del usuario (DXF cargado o medidas fijadas) y si
   no, las del componente de la biblioteca base que corresponde al modelo */
export function medidasComp(c){
  const e = buscar("", c.modelo);
  if(e && e.medidas==="usuario" && e.w && e.h) return { w:e.w, h:e.h, d:e.d || undefined, plantilla:e.id };
  const b = buscarBase(c);
  return b && b.w && b.h ? { w:b.w, h:b.h, d:b.d || undefined, plantilla:"base:" + b.id } : null;
}
export function medidasDe(marca, modelo){ return medidasComp({ modelo }); }
export function plantillaDe(c){
  if(!c.plantilla) return null;
  const e = String(c.plantilla).startsWith("base:") ? (BASE || []).find(x=>x.id===c.plantilla.slice(5)) : lista().find(x=>x.id===c.plantilla);
  return e && e.vistas && e.vistas.frente ? e : null;
}

/* dibuja la vista frontal de la plantilla dentro de la caja del componente (escala uniforme, centrada) con la vista v del
   plano (L, C, A, P) */
export function dibujarPlantilla(v, c, e, capa = "M-EQUIPO"){
  const vz = e.vistas.frente, k = Math.min(c.w/(vz.w||1), c.h/(vz.h||1));
  const ox = c.x + (c.w - vz.w*k)/2, oy = c.y + (c.h - vz.h*k)/2, X = x => ox + x*k, Y = y => oy + y*k;
  for(const g of vz.geo){
    if(g[0]==="L") v.L(X(g[1]), Y(g[2]), X(g[3]), Y(g[4]), capa);
    else if(g[0]==="C") v.C(X(g[1]), Y(g[2]), g[3]*k, capa);
    else if(g[0]==="A") v.A(X(g[1]), Y(g[2]), g[3]*k, g[4], g[5], capa);
    else if(g[0]==="P"){ const pts = []; for(let i=2; i<g.length; i+=2) pts.push([X(g[i]), Y(g[i+1])]); v.P(pts, capa, null, !!g[1]); }
    else if(g[0]==="S"){ const pts = []; for(let i=1; i<g.length; i+=2) pts.push([X(g[i]), Y(g[i+1])]); v.P([pts[0], pts[1], pts[3], pts[2]], capa, null, true); }
  }
}

/* registra los componentes de un arreglo (comps y dispositivos de puerta con modelo) en la biblioteca */
export function registrarArreglo(m, marcaDe){
  let n = 0;
  for(const c of [...(m.comps||[]), ...(m.puerta||[])]){
    if(!c.modelo || !c.w || /^peine$|^repartidor$/.test(c.tipo||"") || String(c.plantilla||"").startsWith("base:")) continue;   // los de la base ya están
    const marca = marcaDe ? marcaDe(c) : "";
    const antes = buscar(marca, c.modelo);
    registrar({ marca, modelo:c.modelo, tipo:c.tipo, w:c.w, h:c.h, d:c.d || c.prof || 0, desc:c.desc }, { sinGuardar:true });
    if(!antes) n++;
  }
  save();
  return n;
}
/* dibuja las primitivas compactas de una vista en un canvas (vista previa de la biblioteca) */
export function dibujarVistaCanvas(cv, vz){
  const ctx = cv.getContext("2d"), W = cv.width, H = cv.height, pad = 8;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  if(!vz) return;
  const k = Math.min((W - 2*pad)/(vz.w||1), (H - 2*pad)/(vz.h||1)), ox = (W - vz.w*k)/2, oy = (H + vz.h*k)/2;
  const X = x => ox + x*k, Y = y => oy - y*k;
  ctx.strokeStyle = "#17191d"; ctx.lineWidth = 1;
  for(const g of vz.geo){
    ctx.beginPath();
    if(g[0]==="L"){ ctx.moveTo(X(g[1]), Y(g[2])); ctx.lineTo(X(g[3]), Y(g[4])); }
    else if(g[0]==="C") ctx.arc(X(g[1]), Y(g[2]), g[3]*k, 0, 2*Math.PI);
    else if(g[0]==="A") ctx.arc(X(g[1]), Y(g[2]), g[3]*k, -g[5]*Math.PI/180, -g[4]*Math.PI/180);
    else if(g[0]==="P"){ for(let i=2; i<g.length; i+=2) i===2 ? ctx.moveTo(X(g[i]), Y(g[i+1])) : ctx.lineTo(X(g[i]), Y(g[i+1])); if(g[1]) ctx.closePath(); }
    ctx.stroke();
  }
}
/* búsqueda del CAD del fabricante (se abre en el navegador del usuario) */
export const urlBuscarCAD = e => `https://www.google.com/search?q=${encodeURIComponent(`${e.marca} ${e.modelo} DXF dimensional drawing`)}`;

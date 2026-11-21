/* Ingenia — idioma de la plataforma (ES / EN).
   La interfaz se escribe en español. Con el inglés elegido (localStorage «ingenia.idioma» = "en", la misma clave de la
   página de inicio) se traduce cada texto cuando aparece en pantalla: los nodos de texto y los atributos placeholder,
   title, aria-label y alt, y el valor de los botones <input type="button|submit">. Un MutationObserver sobre <body>
   traduce lo que la aplicación dibuja después (pantallas, modales, avisos, tablas, editores, pestañas, botones, menús):
   solo los nodos agregados o cambiados, en el mismo lote de microtarea del observador (antes de pintar, sin parpadeo).
   No se traduce:
   · los datos del usuario (el diccionario es de coincidencia exacta: nombres, clientes y TAG no coinciden),
   · las vistas previas de los documentos (.xl-sheet, .doc-prev y el Word que se convierte a PDF: .docx),
   · los lienzos (visor del plano DXF), las figuras SVG, los campos <textarea> / <input> (su valor),
   · las respuestas y sugerencias de Copito (su motor entiende español), salvo sus botones,
   · lo marcado con el atributo data-no-traducir.
   Los entregables (Word, Excel, DXF, PDF) siguen en español: los generadores no pasan por aquí.
   El interruptor ES / EN del menú lateral guarda la elección y recarga la página. Los textos originales se recuerdan, así
   un selector que cambia el idioma sin recargar (el de la pantalla de acceso) también se sigue en el momento. */
import { EN, REGLAS, CONTEXTOS } from "./app-i18n-dic.js";

const CLAVE = "ingenia.idioma";
const ATRIBUTOS = ["placeholder", "title", "aria-label", "alt"];
// subárboles que no se traducen (el textarea se trata aparte: su placeholder sí, su contenido no)
const NO_TRADUCIR = [".xl-sheet", ".doc-prev", ".docx", ".docx-wrapper", "canvas", "svg", "script", "style", "noscript", "code", "pre",
  "[contenteditable]", "[data-no-traducir]", "#cp-sug", ".cp-bub", ".v3d-tag", ".login"].join(", ");
// dentro de un subárbol excluido, lo que sí se traduce (los botones de las respuestas de Copito)
const SI_TRADUCIR = ".cp-acc, .cp-ia";
const LETRA = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ¿¡]/;
const norm = s => s.replace(/\s+/g, " ").trim();
const tiene = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/* ---------------- idioma elegido ---------------- */
export function idiomaApp(){ try{ return localStorage.getItem(CLAVE) === "en" ? "en" : "es"; }catch(e){ return "es"; } }
export function cambiarIdiomaApp(lang){
  const l = lang === "en" ? "en" : "es";
  try{ localStorage.setItem(CLAVE, l); }catch(e){}
  location.reload();
}

/* ---------------- traducción de un texto (ya normalizado) ---------------- */
let MAYUS = null;   // «LISTADO DE CARGAS» → «LOAD LIST» (se arma la primera vez que se necesita)
const mayusculas = () => { if(!MAYUS){ MAYUS = Object.create(null); for(const k in EN) if(k.length > 3 && /[a-záéíóúñ]/.test(k)) MAYUS[k.toUpperCase()] = EN[k].toUpperCase(); } return MAYUS; };
// prefijos y sufijos que no cambian el sentido: «1. Datos», «○ Listado de cargas», «Ver vista previa →», «Hoja:», «(opcional)»
const PRE = /^((?:\d+\.|[○●✓✔•·←↑↓+\-–—»]|N\.°)\s*)(.*[A-Za-zÁÉÍÓÚáéíóúñ].*)$/;
const POST = /^(.*?[A-Za-zÁÉÍÓÚáéíóúñ)\]].*?)(\s*(?:→|…|\.\.\.|:|\*|\.|;|,|\s—|\s·))$/;

// resultados ya calculados (los mismos textos se repiten mucho: opciones de las listas, encabezados, TAG)
const MEMO = new Map();
export function traducir(k, prof = 0){
  if(!k) return null;
  if(tiene(EN, k)) return EN[k];
  if(prof === 0){
    if(MEMO.has(k)) return MEMO.get(k);
    const r = traducirVariantes(k, 0);
    if(MEMO.size > 20000) MEMO.clear();
    MEMO.set(k, r); return r;
  }
  return traducirVariantes(k, prof);
}
function traducirVariantes(k, prof){
  if(prof > 3) return null;
  // primera letra en minúscula dentro de una frase: «listado de cargas» → «load list»
  if(/^[a-záéíóúñ]/.test(k)){ const c = k[0].toUpperCase() + k.slice(1); if(tiene(EN, c)){ const v = EN[c]; return /^[A-Z][a-z]/.test(v) ? v[0].toLowerCase() + v.slice(1) : v; } }
  // todo en mayúsculas
  if(k === k.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{3}/.test(k)){ const M = mayusculas(); if(tiene(M, k)) return M[k]; }
  const t = x => { const y = norm(String(x == null ? "" : x)); const r = traducir(y, prof + 1); return r == null ? y : r; };
  // reglas con valores variables («5 registro(s)», «Versión 21/11/2026 · 01:13», «Página 2 de 7»…)
  for(const [re, f] of REGLAS){ const m = re.exec(k); if(m){ const r = f(m, t); if(r != null) return r; } }
  let m;
  if((m = /^\((.+)\)$/.exec(k))){ const r = traducir(m[1], prof + 1); if(r != null) return `(${r})`; }
  if((m = /^«(.+)»$/.exec(k))){ const r = traducir(m[1], prof + 1); if(r != null) return `“${r}”`; }
  if((m = PRE.exec(k))){ const r = traducir(m[2], prof + 1); if(r != null) return m[1] + r; }
  if((m = POST.exec(k))){ const r = traducir(m[1], prof + 1); if(r != null) return r + m[2]; }
  return null;
}

/* ---------------- DOM ---------------- */
// textos escritos aquí y sus originales en español (para no volver a procesarlos y para volver al español sin recargar)
const escritos = new WeakMap();   // nodo de texto → { es, en }
const atrEscritos = new WeakMap();   // elemento → { atributo: { es, en } }

function excluido(el){
  if(!el || el.nodeType !== 1) return false;
  const x = el.closest(NO_TRADUCIR); if(!x) return false;
  // excepción: dentro de una respuesta de Copito sus botones sí se traducen (si no hay otra exclusión más cerca)
  const s = el.closest(SI_TRADUCIR);
  return !(s && x !== s && x.contains(s));
}

function traducirTextoNodo(n){
  const t = n.nodeValue, w = escritos.get(n);
  if(!t || t.length > 3000 || !LETRA.test(t) || (w && w.en === t)) return;
  const p = n.parentElement; if(!p) return;
  const k = norm(t); if(!k) return;
  let en = null;
  for(const c of CONTEXTOS) if(tiene(c.dic, k) && p.closest(c.sel)){ en = c.dic[k]; break; }
  if(en == null) en = traducir(k);
  if(en == null || en === k) return;
  // <option> sin value: su valor es su texto; se fija en español antes de traducirlo, así la aplicación sigue
  // leyendo y guardando el valor original (estado del documento, criterios de diseño, listas de los editores)
  if(p.nodeName === "OPTION" && !p.hasAttribute("value")) p.setAttribute("value", p.value);
  const nuevo = t.match(/^\s*/)[0] + en + t.match(/\s*$/)[0];
  escritos.set(n, { es: t, en: nuevo });
  n.nodeValue = nuevo;
}

const esBotonInput = el => el.nodeName === "INPUT" && /^(button|submit|reset)$/i.test(el.type);
function traducirAtributo(el, a){
  if(a === "value" && !esBotonInput(el)) return;
  const v = el.getAttribute(a); if(!v || !LETRA.test(v)) return;
  const reg = atrEscritos.get(el) || {}; if(reg[a] && reg[a].en === v) return;
  const k = norm(v), en = traducir(k);
  if(en == null || en === k || en === v) return;
  reg[a] = { es: v, en }; atrEscritos.set(el, reg);
  el.setAttribute(a, en);
}
function traducirAtributos(el){
  for(const a of ATRIBUTOS) if(el.hasAttribute(a)) traducirAtributo(el, a);
  if(esBotonInput(el) && el.hasAttribute("value")) traducirAtributo(el, "value");
}

/* traduce un nodo agregado y todo su subárbol (salvo lo excluido) */
function traducirArbol(raiz){
  if(raiz.nodeType === 3){ const p = raiz.parentElement; if(p && p.nodeName !== "TEXTAREA" && !excluido(p)) traducirTextoNodo(raiz); return; }
  if(raiz.nodeType !== 1 && raiz.nodeType !== 11) return;
  if(raiz.nodeType === 1){
    if(excluido(raiz)){ raiz.querySelectorAll(SI_TRADUCIR).forEach(s => { if(!excluido(s)) traducirArbol(s); }); return; }
    traducirAtributos(raiz);
    if(raiz.nodeName === "TEXTAREA") return;
  }
  const rechazados = [];
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode(n){
    if(n.nodeType !== 1) return NodeFilter.FILTER_ACCEPT;
    if(n.matches(NO_TRADUCIR)){ rechazados.push(n); return NodeFilter.FILTER_REJECT; }
    if(n.nodeName === "TEXTAREA"){ traducirAtributos(n); return NodeFilter.FILTER_REJECT; }
    return NodeFilter.FILTER_ACCEPT;
  } });
  for(let n = w.nextNode(); n; n = w.nextNode()){ if(n.nodeType === 3) traducirTextoNodo(n); else traducirAtributos(n); }
  for(const r of rechazados) r.querySelectorAll(SI_TRADUCIR).forEach(s => { if(!excluido(s)) traducirArbol(s); });
}

/* devuelve al español lo traducido que sigue en pantalla (lo que la aplicación no volvió a escribir) */
function restaurar(){
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for(let n = w.nextNode(); n; n = w.nextNode()){
    if(n.nodeType === 3){ const e = escritos.get(n); if(e && n.nodeValue === e.en) n.nodeValue = e.es; escritos.delete(n); continue; }
    const reg = atrEscritos.get(n); if(!reg) continue;
    for(const a in reg) if(n.getAttribute(a) === reg[a].en) n.setAttribute(a, reg[a].es);
    atrEscritos.delete(n);
  }
}

function procesar(registros){
  for(const r of registros){
    if(r.type === "childList"){ for(const n of r.addedNodes) if(n.isConnected) traducirArbol(n); }
    else if(r.type === "characterData"){ const n = r.target, p = n.parentElement; if(n.isConnected && p && p.nodeName !== "TEXTAREA" && !excluido(p)) traducirTextoNodo(n); }
    else if(r.type === "attributes"){ const el = r.target; if(el.isConnected && !excluido(el)) traducirAtributo(el, r.attributeName); }
  }
}

/* ---------------- activar / desactivar el inglés en la página abierta ---------------- */
let observador = null, actual = "es";
const DIALOGOS = {};
function aplicar(lang){
  if(lang === actual) return;
  actual = lang;
  document.documentElement.lang = lang === "en" ? "en" : "es";
  document.querySelectorAll("[data-idioma-app]").forEach(b => { const on = b.dataset.idiomaApp === lang; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
  if(lang === "en"){
    // diálogos nativos (p. ej. «Pega aquí el contenido copiado de Excel»)
    for(const f of ["alert", "confirm", "prompt"]){
      const orig = DIALOGOS[f] || window[f]; if(typeof orig !== "function") continue;
      DIALOGOS[f] = orig;
      window[f] = function(msg, ...rest){ const en = actual === "en" ? traducir(norm(String(msg == null ? "" : msg))) : null; return orig.call(window, en == null ? msg : en, ...rest); };
    }
    traducirArbol(document.body);
    observador = new MutationObserver(registros => {
      procesar(registros);
      observador.takeRecords();   // descarta los cambios hechos aquí mismo (no se vuelven a procesar)
    });
    observador.observe(document.body, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:[...ATRIBUTOS, "value"] });
  } else {
    if(observador){ observador.disconnect(); observador = null; }
    restaurar();
  }
}

/* ---------------- interruptor ES / EN ---------------- */
export function botonesIdioma(){
  const l = idiomaApp();
  const b = (k, txt, nombre) => `<button type="button" data-idioma-app="${k}" class="${l === k ? "on" : ""}" aria-pressed="${l === k}" title="${nombre}" lang="${k}">${txt}</button>`;
  return `<div class="app-idioma" role="group" aria-label="Idioma / Language" data-no-traducir>${b("es", "ES", "Español")}${b("en", "EN", "English")}</div>`;
}
export function enlazarBotonesIdioma(root = document){
  root.querySelectorAll("[data-idioma-app]").forEach(b => b.addEventListener("click", () => {
    if(b.dataset.idiomaApp !== actual) cambiarIdiomaApp(b.dataset.idiomaApp);
  }));
}

/* ---------------- instalación ---------------- */
export function instalarIdiomaApp(){
  // interruptor en el pie del menú lateral (si la página tiene el lugar reservado)
  const hueco = document.getElementById("nav-idioma");
  if(hueco && !hueco.querySelector(".app-idioma")){ hueco.innerHTML = botonesIdioma(); enlazarBotonesIdioma(hueco); }
  if(!instalarIdiomaApp.hecho){
    instalarIdiomaApp.hecho = true;
    // otros selectores de idioma que guardan la elección sin recargar (p. ej. el de la pantalla de acceso, con
    // botones [data-lang]): la plataforma los sigue en el momento
    document.addEventListener("click", ev => { if(ev.target.closest && ev.target.closest("[data-lang]")) setTimeout(() => aplicar(idiomaApp()), 0); }, true);
  }
  aplicar(idiomaApp());
}

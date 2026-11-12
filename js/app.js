/* Ingenia — aplicación (enrutador por hash y pantallas) */
import { ENTREGABLES, CATALOGO, DISCIPLINAS, ETAPAS, ESTADOS, TIPOS, entregable } from "./catalog.js";
import * as S from "./store.js";
import { $, $$, esc, html, ICON, toast, modal, confirmar, dropzone, leerComoArrayBuffer, leerComoTexto, leerComoDataURL, fmtFecha, hoy, kb } from "./ui.js";
import * as X from "./export.js";
import { parseDXF, drawPreview, parseCTB, boundsOf } from "./dxf.js";
import { ESQUEMAS, renderEditor, tablasParaExportar } from "./modules/tablas.js";
import { PARAMETROS_DISENO, valoresDiseno, seccionesCriteriosElectricos, seccionesCriteriosIC, seccionesMemoriaDescriptiva } from "./modules/criterios.js";
import { screenDocumento, descargarDoc, nextRev } from "./workspace.js";
import { generable, defDoc, DOCS, docInfo } from "./docs.js";
import { renderEditores } from "./editores.js";
import { datos, nuevoTablero, TIPOS_TABLERO, ipRecomendado, tableros, instrumentos } from "./datos.js";
import { VERSION } from "./version.js";
import { comprobarVersion } from "./actualizar.js";
import { iniciarCopito } from "./copito.js";

const main = $("#main");
const state = S.load();
const etapaNombre = id => (ETAPAS.find(e=>e.id===id)||{}).nombre || id;
const disciplinaNombre = id => (DISCIPLINAS[id]||{}).nombre || id;

/* ================= enrutador ================= */
const PTABS = [
  ["resumen","Resumen",0,'<svg class="icon" viewBox="0 0 24 24"><path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"/></svg>'],
  ["entregables","Entregables",1],
  ["diseno","Datos generales",2],
  ["documentos","Documentos",3],
  ["plantillas","Formatos del cliente",0,'<svg class="icon" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v4h4"/></svg>'],
];
function route(){
  const h = location.hash.replace(/^#\/?/, "");
  const [seg, id, tab, docId, sub] = h.split("/");
  menuLateral(seg||"proyectos", id, tab);
  window.scrollTo(0,0);
  if(!seg || seg==="proyectos") return screenProyectos();
  if(seg==="proyecto" && id && tab==="doc" && docId){ const p = S.proyecto(id); if(!p){ location.hash="#/proyectos"; return; } return screenDocumento(main, state, p, docId, sub||"datos", topbar); }
  if(seg==="proyecto" && id) return screenProyecto(id, tab||"resumen");
  if(seg==="catalogo") return screenCatalogo(id);
  if(seg==="organizacion") return screenOrganizacion();
  if(seg==="respaldo") return screenRespaldo();
  if(seg==="estandares") return screenEstandares();
  location.hash = "#/proyectos";
}
window.addEventListener("hashchange", route);

/* menú lateral en árbol: cada grupo se abre o se cierra al tocarlo; el estado se recuerda en este navegador */
const NAV_KEY = "ingenia.menu";
let navAb = (()=>{ try{ return JSON.parse(localStorage.getItem(NAV_KEY)) || { proyectos:true }; }catch(e){ return { proyectos:true }; } })();
const guardarNav = ()=>{ try{ localStorage.setItem(NAV_KEY, JSON.stringify(navAb)); }catch(e){} };
const IC = {
  chev:'<svg class="icon chev" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
  proy:'<svg class="icon" viewBox="0 0 24 24"><path d="M3 7h6l2 2h10v10H3V7Z"/></svg>',
  cat:'<svg class="icon" viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5z"/><path d="M9 10h6M9 14h6M9 18h3"/></svg>',
  fmt:'<svg class="icon" viewBox="0 0 24 24"><path d="M4 20V4h16v16H4Z"/><path d="M4 15h16M14 15v5"/></svg>',
  cfg:'<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>',
  todos:'<svg class="icon" viewBox="0 0 24 24"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/></svg>',
};
let rutaMenu = {};
function menuLateral(seg, id, tab){
  const nuevaRuta = seg!==undefined && (seg!==rutaMenu.seg || id!==rutaMenu.id);
  if(seg!==undefined) rutaMenu = { seg, id, tab };
  ({ seg, id, tab } = rutaMenu);
  // al cambiar de pantalla se abre su grupo; al entrar a un proyecto se pliegan los demás
  if(nuevaRuta){
    if(seg==="proyecto" && id){ navAb.proyectos = true; state.proyectos.forEach(q=>{ navAb[q.id] = q.id===id; }); }
    if(seg==="catalogo") navAb.catalogo = true;
    if(seg==="organizacion" || seg==="respaldo" || seg==="estandares") navAb.config = true;
  }
  const p = seg==="proyecto" && id ? S.proyecto(id) : null;
  if(p) p.visto = Date.now();
  const sec = tab==="doc" ? "documentos" : (tab||"resumen");
  const ps = state.proyectos.slice().sort((a,b)=>(b.visto||Date.parse(b.creado)||0)-(a.visto||Date.parse(a.creado)||0));
  const enlace = (href, ic, txt, activo, extra="") => `<a class="item ${activo?"active":""}" href="${href}" ${extra}>${ic||""}<span class="txt">${txt}</span></a>`;
  const grupo = (key, ic, txt, hijos, n) => `<div class="grp ${navAb[key]?"open":""}"><button class="item grp-h" data-grp="${key}" aria-expanded="${!!navAb[key]}">${IC.chev}${ic}<span class="txt">${txt}</span>${n!=null?`<span class="cnt">${n}</span>`:""}</button><div class="grp-b">${hijos}</div></div>`;
  const proyecto = q => {
    const act = p && p.id===q.id;
    return `<div class="grp sub ${navAb[q.id]?"open":""}"><a class="item grp-h ${act && !navAb[q.id] ? "active" : ""}" href="#/proyecto/${q.id}/resumen" data-prj="${q.id}" title="${esc(q.nombre)}">${IC.chev}<span class="txt">${esc(q.nombre)}</span></a>
      <div class="grp-b">${PTABS.map(([k,l,n])=>enlace(`#/proyecto/${q.id}/${k}`, n?`<span class="n">${n}</span>`:`<span class="n vacio"></span>`, l, act && k===sec)).join("")}</div></div>`;
  };
  $("#nav-arbol").innerHTML =
    grupo("proyectos", IC.proy, "Proyectos", (ps.length ? ps.map(proyecto).join("") : `<span class="vacio-txt">Sin proyectos</span>`) + enlace("#/proyectos", IC.todos, "Ver todos", seg==="proyectos"), ps.length) +
    grupo("catalogo", IC.cat, "Catálogo de entregables", enlace("#/catalogo", "", "Todos", seg==="catalogo" && !id) + enlace("#/catalogo/ELE", "", "Electricidad", seg==="catalogo" && id==="ELE") + enlace("#/catalogo/INS", "", "Instrumentación y control", seg==="catalogo" && id==="INS")) +
    grupo("config", IC.cfg, "Configuración", enlace("#/organizacion", "", "Mi organización", seg==="organizacion") + enlace("#/estandares", "", "Formatos estándar", seg==="estandares") + enlace("#/respaldo", "", "Respaldo de datos", seg==="respaldo"));
  // grupos: abrir / cerrar
  $$("#nav-arbol [data-grp]").forEach(b=>b.onclick = ()=>{ navAb[b.dataset.grp] = !navAb[b.dataset.grp]; guardarNav(); menuLateral(); });
  // proyecto: si ya está abierto en pantalla, el clic solo pliega o despliega sus secciones
  $$("#nav-arbol [data-prj]").forEach(a=>a.onclick = ev=>{
    const k = a.dataset.prj;
    if(p && p.id===k){ ev.preventDefault(); navAb[k] = !navAb[k]; guardarNav(); menuLateral(); return; }
    navAb[k] = true; guardarNav();
  });
  guardarNav();
  const m = String(VERSION).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  $("#nav-ver").textContent = "Versión " + (m ? `${m[3]}/${m[2]}/${m[1]} · ${m[4]}:${m[5]}` : VERSION);
  $("#nav-ver-m").textContent = m ? `v ${m[3]}/${m[2]} · ${m[4]}:${m[5]}` : VERSION;
}
/* menú lateral en celular: cajón que se abre con ☰ y se cierra al navegar */
const cerrarMenu = ()=>document.body.classList.remove("nav-open");
$("#nav-abrir").onclick = ()=>document.body.classList.add("nav-open");
$("#nav-scrim").onclick = cerrarMenu; $("#nav-cerrar").onclick = cerrarMenu;
document.querySelector(".sidenav").addEventListener("click", ev=>{ const a = ev.target.closest("a"); if(a && !ev.defaultPrevented) cerrarMenu(); });
document.addEventListener("keydown", ev=>{ if(ev.key==="Escape") cerrarMenu(); });
$("#nav-nuevo").onclick = ()=>{ cerrarMenu(); modalProyecto(); };

function topbar({ crumbs, title, sub, actions }){
  return html`<div class="topbar"><div>
      <div class="crumbs">${(crumbs||[]).map((c,i)=> (i?'<span>/</span>':'') + (c.href?`<a href="${c.href}">${esc(c.label)}</a>`:`<span>${esc(c.label)}</span>`))}</div>
      <h1>${esc(title)}</h1>${sub?`<div class="sub">${sub}</div>`:""}
    </div><div class="actions">${actions||""}</div></div>`;
}

/* ================= proyectos ================= */
function screenProyectos(){
  const ps = state.proyectos;
  main.innerHTML = topbar({ crumbs:[{label:"Proyectos"}], title:"Proyectos",
    actions: ps.length ? `<button class="btn-accent" id="nuevo">${ICON.plus} Nuevo proyecto</button>` : "" }) +
    (ps.length ? `<div class="card-grid">${ps.map(p=>{
      const n = p.entregables.length; const listos = p.entregables.filter(id=>{ const e=entregable(id); return e && e.estado!=="planificado"; }).length;
      const emit = p.entregables.filter(id=>((p.documentos||{})[id]||{}).estado==="Emitido").length;
      return `<div class="card clickable" data-open="${p.id}"><div class="card-body">
        <div class="row between"><span class="chip">${esc(p.codigo||"Sin código")}</span><span class="badge badge-neutral">${esc(etapaNombre(p.etapa))}</span></div>
        <h3 style="margin:12px 0 4px">${esc(p.nombre)}</h3>
        <div class="muted" style="font-size:12.5px">${esc(p.cliente||"—")}${p.unidad?" · "+esc(p.unidad):""}</div>
        <div class="row between mt-2" style="font-size:12px"><span class="muted">${n} entregables · ${listos} generables</span><span class="mono">${emit}/${n} emitidos</span></div>
        <div class="progress mt-1"><span style="width:${n?Math.round(100*emit/n):0}%"></span></div>
      </div></div>`; }).join("")}</div>`
    : `<div class="empty"><p><strong>Aún no hay proyectos.</strong></p><p>Empieza con cliente, tensión y tableros; el resto se completa en cada documento.</p><button class="btn-accent" id="nuevo2">${ICON.plus} Nuevo proyecto</button></div>`);
  $$("#nuevo,#nuevo2").forEach(b=>b.onclick = ()=>modalProyecto());
  $$("[data-open]").forEach(c=>c.onclick = ()=>location.hash = "#/proyecto/"+c.dataset.open);
}

/* entregables generables por defecto para las disciplinas y la etapa del proyecto */
const entregablesPorDefecto = (disc, etapa) => CATALOGO.filter(e=>disc.includes(e.disciplina) && e.etapas.includes(etapa) && e.estado!=="planificado").map(e=>e.id);
const PATRON_DEF = "{PROY}-{AREA}-{DISC}-{TIPO}-{SEQ}";

function modalProyecto(p){
  const isNew = !p;
  p = p || { nombre:"", cliente:"", unidad:"", codigo:"", area:"", etapa:"detalle", descripcion:"", codPatron: state.org.codPatron || PATRON_DEF, seqDigitos:3, disciplinas:["ELE","INS"] };
  let dis = Object.assign({}, valoresDiseno(p));
  const sis = isNew ? { nombre:"", tag:"" } : Object.assign({}, datos(p).sistema);
  // tableros: copia editable (al crear: 1 de fuerza + 1 de control)
  let tbs = isNew ? [nuevoTablero("fuerza",1), nuevoTablero("control",1)] : datos(p).tableros.map(t=>Object.assign({}, t));
  let logoFile = null, paso = 0, base = null;
  const otros = isNew ? state.proyectos : [];
  const pasos = ["Proyecto","Sitio y sistema eléctrico","Tableros"];
  const grupos = PARAMETROS_DISENO.slice(0,2);
  const campoDis = c => `<div class="field"><label>${esc(c.label)}</label>${c.tipo==="select" ? `<select data-dis="${c.key}">${[...new Set([...(c.opciones), dis[c.key]].filter(x=>x!=null && x!==""))].map(o=>`<option ${String(dis[c.key])===String(o)?"selected":""}>${esc(o)}</option>`).join("")}</select>` : `<input type="${c.tipo}" data-dis="${c.key}" value="${esc(dis[c.key]??"")}">`}</div>`;
  modal({ title: isNew ? "Nuevo proyecto" : "Editar proyecto", width:880, persistente:true, body: html`
    <div class="stepper">${pasos.map((t,i)=>`<button data-paso="${i}"><span class="n">${i+1}</span><span class="t">${t}</span></button>`).join("")}</div>
    <div data-panel="0">
      ${otros.length ? `<div class="field"><label>Partir de</label><select id="f-base"><option value="">Proyecto en blanco</option>${otros.map(o=>`<option value="${o.id}">${esc(o.nombre)}</option>`).join("")}</select><span class="hint">Copia cliente, codificación, condiciones del sitio, logo, formatos y entregables.</span></div>` : ""}
      <div class="grid-2">
        <div class="field" style="grid-column:1/-1"><label>Nombre del proyecto *</label><input id="f-nombre" type="text" value="${esc(p.nombre)}" placeholder="Nombre del proyecto"></div>
        <div class="field"><label>Cliente final</label><input id="f-cliente" type="text" value="${esc(p.cliente)}" placeholder="Razón social del cliente"></div>
        <div class="field"><label>Unidad / planta</label><input id="f-unidad" type="text" value="${esc(p.unidad)}" placeholder="Unidad, planta o sede"></div>
        <div class="field"><label>Sistema / equipo principal</label><input id="f-snom" type="text" value="${esc(sis.nombre)}" placeholder="Sistema o equipo principal"></div>
        <div class="field"><label>TAG del sistema</label><input id="f-stag" type="text" value="${esc(sis.tag)}" placeholder="TAG"></div>
      </div>
      <div class="grid-3">
        <div class="field"><label>Código de proyecto</label><input id="f-codigo" type="text" value="${esc(p.codigo)}" placeholder="Código del cliente"></div>
        <div class="field"><label>Área</label><input id="f-area" type="text" value="${esc(p.area)}" placeholder="Área"></div>
        <div class="field"><label>Etapa</label><select id="f-etapa">${ETAPAS.map(e=>`<option value="${e.id}" ${p.etapa===e.id?"selected":""}>${e.nombre}</option>`).join("")}</select></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Disciplinas</label><div class="row" style="padding-top:6px;gap:18px"><label class="checkbox"><input type="checkbox" id="f-ele" ${p.disciplinas.includes("ELE")?"checked":""}> Electricidad</label><label class="checkbox"><input type="checkbox" id="f-ins" ${p.disciplinas.includes("INS")?"checked":""}> Instrumentación &amp; Control</label></div></div>
        <div class="field"><label>Logo del cliente</label><div class="row" style="flex-wrap:nowrap"><div class="dropzone" id="f-logo" style="flex:1;padding:9px">Arrastra o elige <span class="muted">(JPG / PNG)</span></div><div id="f-logo-prev"></div></div></div>
      </div>
      <details class="more"><summary>Más opciones</summary><div class="mt-1">
        <div class="field"><label>Codificación de documentos</label><input id="f-patron" class="mono" type="text" value="${esc(p.codPatron)}"><span class="hint"><span class="mono">{PROY} {AREA} {DISC} {TIPO} {SEQ}</span> → <span class="mono" id="f-pat-ej"></span></span></div>
        <div class="field"><label>Alcance (opcional)</label><textarea id="f-desc" placeholder="Se usa en memorias y filosofía de control.">${esc(p.descripcion||"")}</textarea></div>
      </div></details>
    </div>
    <div data-panel="1" hidden>
      ${grupos.map(g=>`<h3 class="ed-sub">${esc(g.grupo)}</h3><div class="grid-3">${g.campos.map(campoDis).join("")}</div>`).join("")}
      <div class="notice accent">Grado de protección de gabinetes: <strong id="f-ip"></strong></div>
    </div>
    <div data-panel="2" hidden><div id="f-tbs"></div></div>`,
    footer:`<button data-close>Cancelar</button><span class="grow"></span><button id="f-prev" title="Anterior">${ICON.back}<span class="lbl"> Anterior</span></button><button id="f-next" class="btn-primary">Siguiente</button><button class="btn-accent" id="f-ok">${isNew?"Crear proyecto":"Guardar"}</button>`,
    onMount:(root, close)=>{
      const ver = ()=>{ $$("[data-panel]", root).forEach(el=>el.hidden = +el.dataset.panel!==paso); $$("[data-paso]", root).forEach(b=>{ b.classList.toggle("active", +b.dataset.paso===paso); b.classList.toggle("done", +b.dataset.paso<paso); }); $("#f-prev",root).style.display = paso ? "" : "none"; $("#f-next",root).style.display = paso<2 ? "" : "none"; $("#f-ok",root).style.display = (paso===2 || !isNew) ? "" : "none"; };
      const nombreOk = ()=>{ if($("#f-nombre",root).value.trim()) return true; paso = 0; ver(); $("#f-nombre",root).focus(); toast("Indica el nombre del proyecto", true); return false; };
      $$("[data-paso]", root).forEach(b=>b.onclick = ()=>{ if(+b.dataset.paso>0 && !nombreOk()) return; paso = +b.dataset.paso; ver(); });
      $("#f-prev",root).onclick = ()=>{ paso = Math.max(0,paso-1); ver(); };
      $("#f-next",root).onclick = ()=>{ if(!nombreOk()) return; paso = Math.min(2,paso+1); ver(); };
      // logo del cliente
      const prev = $("#f-logo-prev", root);
      const verLogo = url => { prev.innerHTML = url ? `<img src="${url}" alt="logo del cliente" style="max-height:40px;max-width:120px;border:1px solid var(--border);padding:3px;border-radius:5px;background:#fff">` : `<span class="badge badge-neutral">Sin logo</span>`; };
      const logoDe = async q => { if(q && q.plantillas && q.plantillas.logo_cliente){ const f = await S.leerArchivo(q.plantillas.logo_cliente); if(f){ verLogo(await S.blobToDataURL(f.blob)); return; } } verLogo(null); };
      logoDe(isNew ? null : p);
      dropzone($("#f-logo", root), "image/png,image/jpeg,.jpg,.jpeg,.png", async file=>{ if(!/image\/(png|jpe?g)/.test(file.type)){ toast("El logo debe ser JPEG o PNG", true); return; } logoFile = file; verLogo(await leerComoDataURL(file)); });
      // vista previa del código de documento con los datos ingresados
      const patEj = ()=>{ $("#f-pat-ej",root).textContent = S.codigoDocumento({ codPatron:$("#f-patron",root).value||PATRON_DEF, codigo:$("#f-codigo",root).value||"PROY", area:$("#f-area",root).value||"0000", seqDigitos:3 }, { disciplina:"ELE", doc:"LIS" }, 1); };
      ["#f-patron","#f-codigo","#f-area"].forEach(k=>$(k,root).addEventListener("input", patEj)); patEj();
      // diseño
      const ip = ()=>{ $("#f-ip",root).textContent = ipRecomendado(dis); };
      $$("[data-dis]", root).forEach(i=>i.onchange = ()=>{ dis[i.dataset.dis] = i.value; ip(); }); ip();
      // partir de un proyecto existente
      const bs = $("#f-base", root);
      if(bs) bs.onchange = ()=>{
        base = bs.value ? S.proyecto(bs.value) : null;
        const q = base || { cliente:"", unidad:"", codigo:"", area:"", etapa:"detalle", codPatron: state.org.codPatron || PATRON_DEF, disciplinas:["ELE","INS"] };
        [["f-cliente","cliente"],["f-unidad","unidad"],["f-codigo","codigo"],["f-area","area"],["f-etapa","etapa"],["f-patron","codPatron"]].forEach(([el,k])=>{ $("#"+el,root).value = q[k]||""; });
        $("#f-ele",root).checked = q.disciplinas.includes("ELE"); $("#f-ins",root).checked = q.disciplinas.includes("INS");
        dis = Object.assign({}, valoresDiseno(base || {}));
        $$("[data-dis]", root).forEach(i=>{ const v = dis[i.dataset.dis]; if(i.tagName==="SELECT" && v!=null && ![...i.options].some(o=>o.value===String(v))) i.add(new Option(v, v)); i.value = v ?? ""; }); ip();
        if(!logoFile) logoDe(base);
        patEj();
      };
      // tableros
      const tbBox = $("#f-tbs", root);
      const renderTb = ()=>{
        const cnt = tipo => tbs.filter(t=>t.tipo===tipo).length;
        const potencia = tbs.filter(t=>t.tipo!=="control");
        tbBox.innerHTML = `<p class="muted" style="margin-top:-4px">Tipo, cantidad y TAG. Las cargas e instrumentos se asignan luego a estos tableros.</p>
          <div class="grid-2">${Object.entries(TIPOS_TABLERO).map(([k,T])=>`<label class="checkbox" style="align-items:center"><input type="checkbox" data-tt="${k}" ${cnt(k)?"checked":""}> <span class="wz-tipo" style="min-width:190px">${esc(T.nombre)}</span> <input type="number" min="0" max="20" data-tn="${k}" value="${cnt(k)}" style="width:70px" ${cnt(k)?"":"disabled"}></label>`).join("")}</div>
          <div class="table-wrap mt-2"><table class="ed-table"><thead><tr><th>Tipo</th><th>TAG</th><th>Nombre</th><th>Alimentado desde</th></tr></thead><tbody>
          ${tbs.map((t,i)=>`<tr data-i="${i}"><td>${esc(TIPOS_TABLERO[t.tipo].nombre)}</td><td><input type="text" class="mono" data-c="tag" value="${esc(t.tag)}" style="width:110px"></td><td><input type="text" data-c="nombre" value="${esc(t.nombre)}" style="width:220px"></td>
            <td><select data-c="desde"><option value="">Externo / existente</option>${potencia.filter(x=>x!==t && x.tipo!=="control").map(x=>`<option value="${x.id}" ${t.desde===x.id?"selected":""}>${esc(x.tag)}</option>`).join("")}</select> ${t.desde?"":`<input type="text" data-c="desdeTexto" value="${esc(t.desdeTexto||"")}" placeholder="Ej: SE-01" style="width:140px">`}</td></tr>`).join("") || `<tr><td colspan="4" class="muted" style="text-align:center">Selecciona al menos un tablero.</td></tr>`}
          </tbody></table></div>`;
        const ORD = { distribucion:0, fuerza:1, fuerzacontrol:2, control:3 };
        const ajustar = (k, n)=>{ const act = tbs.filter(t=>t.tipo===k); if(n>act.length){ for(let j=act.length;j<n;j++) tbs.push(nuevoTablero(k, j+1)); } else if(n<act.length){ const quitar = new Set(act.slice(n).map(t=>t.id)); tbs = tbs.filter(t=>!quitar.has(t.id)); tbs.forEach(t=>{ if(quitar.has(t.desde)) t.desde=""; }); }
          tbs.sort((a,b)=>ORD[a.tipo]-ORD[b.tipo]);
          // alimentación propuesta: fuerza ← primer tablero de distribución; control ← primer tablero de fuerza
          const td = tbs.find(t=>t.tipo==="distribucion"), tfu = tbs.find(t=>t.tipo==="fuerza"||t.tipo==="fuerzacontrol");
          tbs.forEach(t=>{ if(t.desde) return; if((t.tipo==="fuerza"||t.tipo==="fuerzacontrol") && td) t.desde = td.id; if(t.tipo==="control" && tfu) t.desde = tfu.id; });
          renderTb(); };
        $$("[data-tt]", tbBox).forEach(c=>c.onchange = ()=>ajustar(c.dataset.tt, c.checked ? Math.max(1, cnt(c.dataset.tt)) : 0));
        $$("[data-tn]", tbBox).forEach(c=>c.onchange = ()=>ajustar(c.dataset.tn, Math.max(0, Math.min(20, parseInt(c.value)||0))));
        $$("tr[data-i] [data-c]", tbBox).forEach(el=>el.onchange = ()=>{ const t = tbs[+el.closest("tr").dataset.i]; t[el.dataset.c] = el.value.trim(); if(el.dataset.c==="desde") renderTb(); });
      };
      renderTb();
      ver();
      $("#f-ok", root).onclick = async ()=>{
        if(!nombreOk()) return;
        if(!tbs.length){ paso = 2; ver(); toast("Define al menos un tablero", true); return; }
        const tags = tbs.map(t=>t.tag); if(tags.some(t=>!t) || new Set(tags).size!==tags.length){ paso = 2; ver(); toast("Cada tablero debe tener un TAG único", true); return; }
        const data = { nombre:$("#f-nombre",root).value.trim(), cliente:$("#f-cliente",root).value.trim(), unidad:$("#f-unidad",root).value.trim(), etapa:$("#f-etapa",root).value, codigo:$("#f-codigo",root).value.trim(), area:$("#f-area",root).value.trim(), codPatron:$("#f-patron",root).value.trim()||PATRON_DEF, descripcion:$("#f-desc",root).value.trim(),
          disciplinas:[ $("#f-ele",root).checked?"ELE":null, $("#f-ins",root).checked?"INS":null ].filter(Boolean) };
        if(!data.disciplinas.length){ paso = 0; ver(); toast("Marca al menos una disciplina", true); return; }
        const target = isNew ? S.nuevoProyecto(data) : Object.assign(p, data);
        target.diseno = Object.assign(target.diseno||{}, dis);
        state.org.codPatron = data.codPatron;  // se propone en el siguiente proyecto
        const d = datos(target);
        d.sistema.nombre = $("#f-snom",root).value.trim(); d.sistema.tag = $("#f-stag",root).value.trim();
        // reasignar cargas / instrumentos de tableros eliminados
        const ids = new Set(tbs.map(t=>t.id));
        d.tableros = tbs;
        d.cargas.forEach(l=>{ if(l.tablero && !ids.has(l.tablero)) l.tablero = ""; });
        target.plantillas = target.plantillas || {};
        if(isNew && base){
          // copia del proyecto de origen: formatos del cliente, criterios y selección de entregables
          for(const [k, fid] of Object.entries(base.plantillas||{})){ if(!fid || (k==="logo_cliente" && logoFile)) continue; const f = await S.leerArchivo(fid); if(f){ const { id:_i, blob, creado, ...meta } = f; target.plantillas[k] = await S.guardarArchivo(Object.assign(meta, { proyectoId:target.id }), blob); } }
          target.plantillaModo = base.plantillaModo; target.hojaPlano = base.hojaPlano;
          const db = datos(base); d.cablesCfg = Object.assign({}, db.cablesCfg); d.memoria = Object.assign({}, db.memoria);
          target.entregables = base.entregables.filter(x=>{ const e = entregable(x); return e && data.disciplinas.includes(e.disciplina); });
        } else if(isNew) target.entregables = entregablesPorDefecto(data.disciplinas, data.etapa);
        if(logoFile){ if(target.plantillas.logo_cliente) await S.borrarArchivo(target.plantillas.logo_cliente); target.plantillas.logo_cliente = await S.guardarArchivo({ tipo:"logo_cliente", proyectoId:target.id, nombre:logoFile.name, size:logoFile.size, info:{ tipo:logoFile.type } }, logoFile); }
        S.sincronizarDocumentos(target, ENTREGABLES); S.save(); close();
        if(isNew){ toast(`${target.entregables.length} entregables preseleccionados — quita los que no apliquen`); location.hash = "#/proyecto/"+target.id+"/entregables"; } else route();
      };
    } });
}

/* ================= proyecto ================= */
function screenProyecto(id, tab){
  const p = S.proyecto(id); if(!p){ location.hash="#/proyectos"; return; }
  p.etapaNombre = etapaNombre(p.etapa);
  const antes = p.entregables.length; p.entregables = p.entregables.filter(x=>{ const e = entregable(x); return e && !e.interno; }); if(p.entregables.length!==antes) S.sincronizarDocumentos(p, ENTREGABLES);
  const sec = (PTABS.find(t=>t[0]===tab)||PTABS[0])[1];
  main.innerHTML = topbar({ crumbs:[{label:"Proyectos", href:"#/proyectos"},{label:p.nombre, href:`#/proyecto/${p.id}/resumen`},{label:sec}], title:p.nombre,
    sub:`<span class="chip">${esc(p.codigo||"Sin código")}</span><span>${esc(p.cliente||"—")}${p.unidad?" · "+esc(p.unidad):""}</span><span class="badge badge-neutral">${esc(etapaNombre(p.etapa))}</span>`,
    actions:`<button id="editar">${ICON.edit} Editar</button><button class="btn-danger" id="borrar" title="Eliminar proyecto">${ICON.trash}</button>` }) +
    `<div class="tabs proj-tabs">${PTABS.map(t=>`<button data-tab="${t[0]}" class="${t[0]===tab?"active":""}">${t[2]?t[2]+". ":""}${t[1]}</button>`).join("")}</div><div id="tab-body"></div>`;
  $("#editar").onclick = ()=>modalProyecto(p);
  $("#borrar").onclick = async ()=>{ if(await confirmar("Eliminar proyecto", `Se eliminará «${p.nombre}» con todos sus datos.`, "Eliminar")){ S.eliminarProyecto(p.id); location.hash="#/proyectos"; } };
  $$("[data-tab]").forEach(b=>b.onclick = ()=>location.hash = `#/proyecto/${p.id}/${b.dataset.tab}`);
  const body = $("#tab-body");
  ({ resumen: tabResumen, entregables: tabEntregables, diseno: tabDiseno, documentos: tabDocumentos, plantillas: tabPlantillas }[tab] || tabResumen)(body, p);
}

function tabResumen(body, p){
  const sel = p.entregables.map(entregable).filter(Boolean);
  const porEstado = e => sel.filter(x=>x.estado===e).length;
  const d = datos(p), v = valoresDiseno(p), tbs = tableros(p);
  const emit = sel.filter(e=>(p.documentos[e.id]||{}).estado==="Emitido").length;
  const nInst = instrumentos(p).length, logo = !!(p.plantillas && p.plantillas.logo_cliente);
  const paso = (ok, t, det, href, accion) => `<li class="${ok?"ok":""}"><span class="dot">${ok?ICON.check:""}</span><div><div class="t">${t}</div><div class="d">${det}</div></div><a class="btn btn-sm" href="${href}">${accion}</a></li>`;
  body.innerHTML = html`
    <div class="stat-row">
      <div class="stat"><div class="k">Entregables</div><div class="v">${sel.length}</div></div>
      <div class="stat hl"><div class="k">Generables</div><div class="v">${porEstado("listo")+porEstado("parcial")}</div></div>
      <div class="stat"><div class="k">Emitidos</div><div class="v">${emit}</div></div>
      <div class="stat"><div class="k">Tableros</div><div class="v">${tbs.length}</div></div>
      <div class="stat"><div class="k">Cargas</div><div class="v">${d.cargas.length}</div></div>
      <div class="stat"><div class="k">Instrumentos</div><div class="v">${nInst}</div></div>
    </div>
    <div class="grid-2">
      <div class="card"><div class="card-head"><h2>Avance</h2></div><div class="card-body" style="padding-top:4px;padding-bottom:4px"><ul class="checklist">
        ${paso(sel.length>0, "1. Entregables", `${sel.length} seleccionados`, `#/proyecto/${p.id}/entregables`, "Revisar")}
        ${paso(!!(d.sistema.nombre && tbs.length), "2. Datos generales", `${esc(v.tension)} V · ${esc(v.frecuencia)} Hz · ${tbs.length} tablero(s)${d.sistema.tag?" · "+esc(d.sistema.tag):""}`, `#/proyecto/${p.id}/diseno`, "Revisar")}
        ${paso(d.cargas.length>0 || nInst>0, "3. Datos por documento", `${d.cargas.length} cargas · ${nInst} instrumentos`, `#/proyecto/${p.id}/documentos`, "Abrir")}
        ${paso(sel.length>0 && emit===sel.length, "4. Emisión", `${emit} de ${sel.length} documentos emitidos`, `#/proyecto/${p.id}/documentos`, "Emitir")}
        ${paso(logo, "Logo y formatos del cliente", logo ? "Logo cargado" : "Sin logo del cliente", `#/proyecto/${p.id}/plantillas`, logo?"Ver":"Cargar")}
      </ul></div></div>
      <div class="card"><div class="card-head"><h2>Datos del proyecto</h2><button class="btn-sm" id="r-editar">${ICON.edit} Editar</button></div><div class="card-body"><dl class="kv">
        <dt>Cliente</dt><dd>${esc(p.cliente||"—")}</dd><dt>Unidad</dt><dd>${esc(p.unidad||"—")}</dd>
        <dt>Sistema</dt><dd>${esc(d.sistema.nombre||"—")}${d.sistema.tag?` <span class="chip">${esc(d.sistema.tag)}</span>`:""}</dd>
        <dt>Disciplinas</dt><dd>${p.disciplinas.map(disciplinaNombre).join(", ")}</dd>
        <dt>Codificación</dt><dd class="mono">${esc(S.codigoDocumento(p, { disciplina:"ELE", doc:"LIS" }, 1))}</dd>
        <dt>Tableros</dt><dd>${tbs.map(t=>`<span class="chip">${esc(t.tag)}</span>`).join(" ")||"—"}</dd>
        <dt>Creado</dt><dd>${fmtFecha(p.creado)}</dd></dl></div></div>
    </div>`;
  $("#r-editar").onclick = ()=>modalProyecto(p);
}
const badgeEstado = e => `<span class="badge ${e==="listo"?"badge-ok":e==="parcial"?"badge-warn":"badge-neutral"}">${ESTADOS[e].label}</span>`;

/* ---------- entregables ---------- */
function tabEntregables(body, p){
  let filtroDisc = "todas", filtroEtapa = p.etapa, soloDisponibles = false;
  const render = ()=>{
    const lista = CATALOGO.filter(e=> (filtroDisc==="todas" ? p.disciplinas.includes(e.disciplina) : e.disciplina===filtroDisc) && e.etapas.includes(filtroEtapa) && (!soloDisponibles || e.estado!=="planificado"));
    body.innerHTML = html`
      <div class="row between mb-2">
        <div class="row">
          <select id="fd" style="width:auto"><option value="todas">Todas las disciplinas</option>${p.disciplinas.map(d=>`<option value="${d}" ${filtroDisc===d?"selected":""}>${disciplinaNombre(d)}</option>`).join("")}</select>
          <select id="fe" style="width:auto">${ETAPAS.map(e=>`<option value="${e.id}" ${filtroEtapa===e.id?"selected":""}>${e.nombre}</option>`).join("")}</select>
          <label class="checkbox"><input type="checkbox" id="fs" ${soloDisponibles?"checked":""}> Solo generables</label>
        </div>
        <div class="row"><span class="muted">${p.entregables.length} seleccionados</span><button class="btn-sm" id="sel-disp">Marcar generables</button><button class="btn-sm" id="sel-none">Quitar todos</button><a class="btn btn-sm btn-primary" href="#/proyecto/${p.id}/diseno">Siguiente: datos generales →</a></div>
      </div>
      ${["ELE","INS"].map(d=>{ const items = lista.filter(e=>e.disciplina===d); if(!items.length) return ""; return `<h3 class="disc-title">${disciplinaNombre(d)}</h3>${items.map(e=>delivHTML(e, p.entregables.includes(e.id), p)).join("")}`; }).join("") || `<div class="empty">Ningún entregable coincide con el filtro.</div>`}`;
    $("#fd").onchange = e=>{ filtroDisc = e.target.value; render(); };
    $("#fe").onchange = e=>{ filtroEtapa = e.target.value; render(); };
    $("#fs").onchange = e=>{ soloDisponibles = e.target.checked; render(); };
    $("#sel-disp").onclick = ()=>{ lista.filter(e=>e.estado!=="planificado").forEach(e=>{ if(!p.entregables.includes(e.id)) p.entregables.push(e.id); }); S.sincronizarDocumentos(p, ENTREGABLES); render(); };
    $("#sel-none").onclick = ()=>{ p.entregables = []; S.sincronizarDocumentos(p, ENTREGABLES); render(); };
    $$("[data-toggle]", body).forEach(cb=>cb.onchange = ()=>{ const id = cb.dataset.toggle; if(cb.checked){ if(!p.entregables.includes(id)) p.entregables.push(id); } else p.entregables = p.entregables.filter(x=>x!==id); S.sincronizarDocumentos(p, ENTREGABLES); render(); });
  };
  render();
}
function delivHTML(e, selected, p){
  const d = p.documentos[e.id];
  return `<div class="deliv ${selected?"selected":""}">
    <label class="checkbox" style="padding-top:2px"><input type="checkbox" data-toggle="${e.id}" ${selected?"checked":""}></label>
    <div><div class="title">${esc(e.nombre)} ${badgeEstado(e.estado)} <span class="badge badge-neutral">${esc(TIPOS[e.tipo])}</span></div>
      <div class="desc">${esc(e.finalidad)}</div>
      <details><summary>Datos de entrada y salida</summary><ul>${e.entradas.map(x=>`<li>${esc(x)}</li>`).join("")}</ul><div class="mt-1"><strong>Salida:</strong> ${esc(e.salida)}</div></details></div>
    <div class="right">${d&&selected?`<span class="chip">${esc(d.codigo)}</span>`:""}<span class="muted" style="font-size:11.5px">${e.etapas.map(x=>etapaNombre(x).replace("Ingeniería ","")).join(" · ")}</span></div>
  </div>`;
}

/* ---------- datos generales ---------- */
function tabDiseno(body, p){
  body.innerHTML = `<p class="ws-note">Comunes a todos los documentos. Los datos propios de cada documento se ingresan al abrirlo.</p><div id="eds-gen"></div>
    <div class="row mt-2" style="justify-content:flex-end"><a class="btn btn-primary" href="#/proyecto/${p.id}/documentos">Siguiente: documentos →</a></div>`;
  renderEditores($("#eds-gen", body), p, ["sistema","parametros","tableros"], null, ()=>{});
}

/* ---------- documentos, emisión y descargas ---------- */
const MOTIVOS = ["Emitido para revisión interna","Emitido para revisión del cliente","Emitido para aprobación","Emitido para construcción","Conforme a obra"];
function tabDocumentos(body, p){
  S.sincronizarDocumentos(p, ENTREGABLES);
  const sel = p.entregables.map(entregable).filter(Boolean);
  const marcados = new Set(sel.map(e=>e.id));
  body.innerHTML = html`
    ${!state.org.nombre ? `<div class="notice accent mb-2">Completa <a href="#/organizacion">tu organización</a> (nombre, logo y firmas) una sola vez: se usa en todas las carátulas y cajetines.</div>` : ""}
    <div class="row between mb-2">
      <div class="row"><button class="btn-accent btn-sm" id="emitir">${ICON.check} Emitir revisión</button><span class="muted" id="n-sel" style="font-size:12.5px"></span></div>
      <button class="btn-sm" id="dl-registro">${ICON.open} Lista de documentos</button>
    </div>
    ${sel.length ? `<div class="table-wrap"><table class="docs-table"><thead><tr><th><input type="checkbox" id="chk-all" checked title="Marcar todos"><span class="m-only">Marcar todos</span></th><th>Código</th><th>Entregable</th><th>Revisión vigente</th><th>Estado</th><th></th></tr></thead><tbody>
      ${sel.map(e=>{ const d = p.documentos[e.id]; const rv = (d.revisiones && d.revisiones.length) ? d.revisiones[d.revisiones.length-1] : { rev:d.rev, fecha:d.fecha, descripcion:d.emitido };
        return `<tr data-id="${e.id}">
        <td><input type="checkbox" data-chk checked></td>
        <td class="mono" style="white-space:nowrap">${esc(d.codigo)}</td>
        <td><div style="font-weight:500">${generable(e.id)?`<a href="#/proyecto/${p.id}/doc/${e.id}">${esc(e.nombre)}</a>`:esc(e.nombre)}</div><div class="muted" style="font-size:12px">${esc(DISCIPLINAS[e.disciplina].corto)} · ${esc(TIPOS[e.tipo])}</div></td>
        <td style="white-space:nowrap"><span class="mono">Rev. ${esc(rv.rev||"A")}</span> · <span class="mono">${esc(fmtFecha(rv.fecha))}</span><div class="muted" style="font-size:12px">${esc(String(rv.descripcion||"").replace(/^Emitido para /,"Para ")||"—")}</div></td>
        <td><select data-f="estado" style="min-width:130px">${["Por elaborar","En elaboración","Para revisión","Aprobado","Emitido"].map(o=>`<option ${d.estado===o?"selected":""}>${o}</option>`).join("")}</select></td>
        <td style="white-space:nowrap">${accionesDoc(e, p)}</td></tr>`; }).join("")}
      </tbody></table></div>` : `<div class="empty">No hay entregables seleccionados. <a href="#/proyecto/${p.id}/entregables">Selecciónalos aquí.</a></div>`}`;
  const cuenta = ()=>{ const n = $("#n-sel"); if(n) n.textContent = `${marcados.size} de ${sel.length} marcados`; const b = $("#emitir"); if(b) b.disabled = !marcados.size; };
  $$("[data-chk]", body).forEach(c=>c.onchange = ()=>{ const id = c.closest("tr").dataset.id; c.checked ? marcados.add(id) : marcados.delete(id); const all = $("#chk-all"); if(all) all.checked = marcados.size===sel.length; cuenta(); });
  const all = $("#chk-all"); if(all) all.onchange = ()=>{ $$("[data-chk]", body).forEach(c=>{ c.checked = all.checked; const id = c.closest("tr").dataset.id; all.checked ? marcados.add(id) : marcados.delete(id); }); cuenta(); };
  cuenta();
  $$("tr[data-id] [data-f]", body).forEach(el=>el.onchange = ()=>{ const d = p.documentos[el.closest("tr").dataset.id]; d[el.dataset.f] = el.value; S.save(); });
  $("#emitir").onclick = ()=>modalEmitir(p, [...marcados], ()=>tabDocumentos(body, p));
  $("#dl-registro").onclick = ()=>{ location.hash = `#/proyecto/${p.id}/doc/gen-registro/vista`; };
  $$("[data-dl]", body).forEach(b=>b.onclick = ()=>descargarDoc(state, p, b.dataset.dl, b));
}
/* emisión en lote: una sola vez la revisión, fecha, motivo y firmas para todos los documentos marcados */
function modalEmitir(p, ids, onDone){
  const o = state.org;
  modal({ title:`Emitir revisión · ${ids.length} documento${ids.length>1?"s":""}`, width:720, body:`
    <div class="grid-3">
      <div class="field"><label>Revisión</label><input id="em-rev" class="mono" type="text" placeholder="Automática"><span class="hint">Vacío: A→B→C… / 0→1 en cada documento.</span></div>
      <div class="field"><label>Fecha</label><input id="em-fecha" type="date" value="${hoy()}"></div>
      <div class="field"><label>Emitido para</label><select id="em-mot">${MOTIVOS.map(m=>`<option>${m}</option>`).join("")}</select></div>
      <div class="field"><label>Elaboró</label><input id="em-el" type="text" value="${esc(o.elaboraPor||"")}"></div>
      <div class="field"><label>Revisó</label><input id="em-re" type="text" value="${esc(o.revisaPor||"")}"></div>
      <div class="field"><label>Aprobó</label><input id="em-ap" type="text" value="${esc(o.apruebaPor||"")}"></div>
    </div>`,
    footer:`<button data-close>Cancelar</button><button class="btn-accent" id="em-ok">${ICON.check} Emitir</button>`,
    onMount:(root, close)=>{ $("#em-ok", root).onclick = ()=>{
      const rev = $("#em-rev",root).value.trim().toUpperCase(), fecha = $("#em-fecha",root).value || hoy(), descripcion = $("#em-mot",root).value;
      const firmas = { elaboro:$("#em-el",root).value.trim(), reviso:$("#em-re",root).value.trim(), aprobo:$("#em-ap",root).value.trim() };
      for(const id of ids){
        const d = p.documentos[id]; if(!d) continue; docInfo(p, id);
        const last = d.revisiones[d.revisiones.length-1];
        const fila = Object.assign({ rev: rev || last.rev, fecha, descripcion }, firmas);
        // la revisión inicial (A, aún no emitida) se completa en lugar de crear otra
        if((!d.emitida && d.revisiones.length===1 && !rev) || (rev && rev===String(last.rev).toUpperCase())) Object.assign(last, fila);
        else { if(!rev) fila.rev = nextRev(last.rev); d.revisiones.push(fila); }
        d.emitida = true; d.estado = /interna/.test(descripcion) ? "Para revisión" : "Emitido";
        docInfo(p, id);
      }
      S.save(); close(); toast(`Revisión emitida en ${ids.length} documento(s)`); onDone();
    }; } });
}
function accionesDoc(e, p){
  if(generable(e.id)){ const def = defDoc(e.id); const fmt = { xlsx:"Excel", docx:"Word", dxf:"DXF" }[def.formato];
    return `<a class="btn btn-sm btn-primary" href="#/proyecto/${p.id}/doc/${e.id}">Abrir</a>${fmt ? ` <button class="btn-sm" data-dl="${e.id}" title="Descargar con los datos actuales">${ICON.download} ${fmt}</button>` : ""}`; }
  return `<span class="badge badge-neutral">En desarrollo</span>`;
}
async function cargarLogo(){ if(state.org.logo && !state.org.logoDataURL){ const f = await S.leerArchivo(state.org.logo); if(f) state.org.logoDataURL = await S.blobToDataURL(f.blob); } }

/* ---------- plantillas del cliente ---------- */
const SLOTS = [
  { key:"logo_cliente", titulo:"Logo del cliente", accept:".png,.jpg,.jpeg", desc:"Carátulas Excel, encabezados Word y cajetín de planos." },
  { key:"xlsx", titulo:"Plantilla Excel", accept:".xlsx", desc:"Carátula y hojas de listado del cliente, con marcadores {{…}}." },
  { key:"docx", titulo:"Plantilla Word", accept:".docx", desc:"Memorias, criterios y filosofías, con etiquetas {…}." },
  { key:"dxf_formato", titulo:"Lámina de impresión (DXF)", accept:".dxf", desc:"Marco del plano (A1, A2, A3…)." },
  { key:"dxf_cajetin", titulo:"Cajetín (DXF)", accept:".dxf", desc:"Rótulo con textos variables {{PLANO}}, {{REV}}, {{TITULO}}…" },
  { key:"ctb", titulo:"Plumillas (CTB / STB)", accept:".ctb,.stb", desc:"Grosor y color de impresión por capa." },
];
function tabPlantillas(body, p){
  p.plantillas = p.plantillas || {};
  const render = async ()=>{
    body.innerHTML = html`
      <div class="card"><div class="card-body">
        <div class="row" style="gap:22px">
          <label class="checkbox"><input type="radio" name="modo" value="estandar" ${p.plantillaModo!=="cliente"?"checked":""}> <span><strong>Formato estándar</strong><br><span class="muted">Con el logo y datos de <a href="#/organizacion">tu organización</a>.</span></span></label>
          <label class="checkbox"><input type="radio" name="modo" value="cliente" ${p.plantillaModo==="cliente"?"checked":""}> <span><strong>Formatos del cliente</strong><br><span class="muted">Lo que no cargues sale en formato estándar.</span></span></label>
        </div>
        <div class="field mt-2" style="max-width:320px"><label>Tamaño de lámina para planos</label><select id="hoja">${["A3 (420×297)","A2 (594×420)","A1 (841×594)","A0 (1189×841)","Automático según contenido"].map(o=>`<option ${(p.hojaPlano||"Automático según contenido")===o?"selected":""}>${o}</option>`).join("")}</select></div>
      </div></div>
      <div id="slots" class="mt-2"></div>
      <details class="card mt-2"><summary class="card-head" style="cursor:pointer"><h2>Marcadores disponibles</h2><span class="muted" style="font-size:12.5px">Para preparar formatos del cliente</span></summary><div class="card-body" style="font-size:13px">
        <p><strong>Excel</strong> (celdas): <span class="tokens">${["{{proyecto}}","{{cliente}}","{{unidad}}","{{etapa}}","{{codigo}}","{{titulo}}","{{rev}}","{{fecha}}","{{org}}","{{disciplina}}","{{emitido}}","{{elaboro}}","{{reviso}}","{{aprobo}}","{{rev1.rev}} {{rev1.fecha}} {{rev1.descripcion}} …","{{tabla:cargas}} + {{col:tag}} {{col:descripcion}} …","{{tabla:cables}}","{{tabla:equipos}}","{{tabla:instrumentos}}","{{tabla:io}}","{{tabla:documentos}}"].map(t=>`<span class="chip">${esc(t)}</span>`).join("")}</span></p>
        <p class="mt-2"><strong>Word</strong> (texto): <span class="tokens">${["{proyecto}","{cliente}","{codigo}","{titulo}","{rev}","{fecha}","{org}","{#revisiones}{rev} {fecha} {descripcion} {elaboro} {reviso} {aprobo}{/revisiones}","{#secciones}{titulo} {texto} {#items}{.}{/items}{/secciones}","{#circuitos}…{/circuitos} (memoria de cálculo)"].map(t=>`<span class="chip">${esc(t)}</span>`).join("")}</span></p>
        <p class="mt-2"><strong>DXF cajetín</strong> (textos): <span class="tokens">${["{{PLANO}}","{{TITULO}}","{{TITULO2}}","{{PROYECTO}}","{{CLIENTE}}","{{REV}}","{{FECHA}}","{{ESCALA}}","{{DIBUJO}}","{{REVISO}}","{{APROBO}}","{{HOJA}}","{{EMPRESA}}"].map(t=>`<span class="chip">${esc(t)}</span>`).join("")}</span></p>
        <p class="muted mt-2">DWG: guárdalo como DXF desde AutoCAD.</p>
      </div></details>`;
    $$("input[name=modo]").forEach(r=>r.onchange = ()=>{ p.plantillaModo = r.value; S.save(); });
    $("#hoja").onchange = e=>{ p.hojaPlano = e.target.value; S.save(); };
    const slots = $("#slots");
    for(const s of SLOTS){
      const f = p.plantillas[s.key] ? await S.leerArchivo(p.plantillas[s.key]) : null;
      const el = document.createElement("div"); el.className = "card"; el.style.marginTop = "10px";
      el.innerHTML = `<div class="card-head"><div><h2>${esc(s.titulo)}</h2><div class="muted" style="font-size:12.5px; margin-top:3px">${esc(s.desc)}</div></div>${f?`<span class="badge badge-ok">${ICON.check} Cargada</span>`:`<span class="badge badge-neutral">Estándar</span>`}</div>
        <div class="card-body">${f ? `<div class="tpl-row"><div>${ICON.file} <strong>${esc(f.nombre)}</strong> <span class="muted">· ${kb(f.size)} · ${fmtFecha(f.creado)}</span><div id="info-${s.key}" class="mt-1"></div></div><div class="row"><button class="btn-sm" data-replace="${s.key}">Reemplazar</button><button class="btn-sm btn-danger" data-del="${s.key}">${ICON.trash}</button></div></div><div id="prev-${s.key}" class="mt-2"></div>` : `<div class="dropzone" data-drop="${s.key}"><strong>Arrastra el archivo</strong> o haz clic <span class="muted">(${esc(s.accept)})</span></div>`}</div>`;
      slots.appendChild(el);
      if(f){ mostrarInfoPlantilla(s.key, f, $("#info-"+s.key, el), $("#prev-"+s.key, el)); }
      const dz = $("[data-drop]", el); if(dz) dropzone(dz, s.accept, file=>subirPlantilla(p, s, file).then(render));
      const rp = $("[data-replace]", el); if(rp) rp.onclick = ()=>{ const i=document.createElement("input"); i.type="file"; i.accept=s.accept; i.onchange=()=>{ if(i.files[0]) subirPlantilla(p, s, i.files[0]).then(render); }; i.click(); };
      const del = $("[data-del]", el); if(del) del.onclick = async ()=>{ if(await confirmar("Quitar plantilla", "Se eliminará la plantilla cargada; ese documento saldrá en formato estándar.", "Quitar")){ await S.borrarArchivo(p.plantillas[s.key]); delete p.plantillas[s.key]; S.save(); render(); } };
    }
  };
  render();
}
async function subirPlantilla(p, slot, file){
  try{
    const info = {};
    if(slot.key==="xlsx"){ const r = await X.tokensDePlantillaExcel(await leerComoArrayBuffer(file)); info.tokens = r.tokens; info.hojas = r.hojas; }
    else if(slot.key==="docx"){ info.tokens = X.tokensDePlantillaWord(await leerComoArrayBuffer(file)); }
    else if(slot.key.startsWith("dxf")){ const d = parseDXF(await leerComoTexto(file)); info.tokens = d.tokens; info.bounds = d.bounds; info.counts = d.counts; info.layers = Object.keys(d.layers).length; info.space = d.space; if(!d.entities.length) throw new Error("El DXF no contiene entidades legibles (¿está guardado como DXF ASCII?)"); }
    else if(slot.key==="logo_cliente"){ info.tipo = file.type; }
    else if(slot.key==="ctb"){ const c = parseCTB(await leerComoArrayBuffer(file), window.pako); info.estilos = c.estilos.length; info.tipo = c.tipo; info.descripcion = c.descripcion; }
    if(p.plantillas[slot.key]) await S.borrarArchivo(p.plantillas[slot.key]);
    const id = await S.guardarArchivo({ tipo:slot.key, proyectoId:p.id, nombre:file.name, size:file.size, info }, file);
    p.plantillas[slot.key] = id; p.plantillaModo = "cliente"; S.save();
    toast("Plantilla cargada: "+file.name);
  }catch(err){ console.error(err); toast("No se pudo leer la plantilla: "+(err.message||err), true, 6000); }
}
async function mostrarInfoPlantilla(key, f, infoEl, prevEl){
  const info = f.info||{};
  if(key==="logo_cliente"){ const url = await S.blobToDataURL(f.blob); infoEl.innerHTML = `<img src="${url}" alt="logo del cliente" style="max-height:60px;max-width:220px;border:1px solid var(--border);padding:4px;border-radius:6px;background:#fff">`; return; }
  if(key==="xlsx") infoEl.innerHTML = `<span class="muted">Hojas: ${(info.hojas||[]).map(esc).join(", ")||"—"}</span><div class="tokens">${(info.tokens||[]).map(t=>`<span class="chip">${esc(t)}</span>`).join("")||'<span class="badge badge-warn">Sin marcadores {{…}} — se descargará tal cual, sin datos del proyecto</span>'}</div>`;
  else if(key==="docx") infoEl.innerHTML = `<div class="tokens">${(info.tokens||[]).map(t=>`<span class="chip">${esc(t)}</span>`).join("")||'<span class="badge badge-warn">Sin tags {…}</span>'}</div>`;
  else if(key.startsWith("dxf")){
    const b = info.bounds||{}; infoEl.innerHTML = `<span class="muted">Extensión ${((b.maxX-b.minX)||0).toFixed(0)} × ${((b.maxY-b.minY)||0).toFixed(0)} unidades · ${info.layers||0} capas · entidades: ${Object.entries(info.counts||{}).map(([k,v])=>k+" "+v).join(", ")} · espacio ${info.space==="paper"?"papel":"modelo"}</span><div class="tokens">${(info.tokens||[]).map(t=>`<span class="chip">${esc(t)}</span>`).join("")||(key==="dxf_cajetin"?'<span class="badge badge-warn">Sin marcadores {{…}}: el cajetín se insertará tal cual; marca los textos variables para que se rellenen</span>':"")}</div>`;
    try{ const d = parseDXF(await f.blob.text()); const cv = document.createElement("canvas"); cv.className="preview"; prevEl.appendChild(cv); drawPreview(cv, d.entities, { highlightTokens:true }); }catch(e){}
  } else if(key==="ctb"){
    infoEl.innerHTML = `<span class="muted">${esc(info.tipo||"ctb").toUpperCase()} · ${info.estilos||0} estilos ${info.descripcion?"· "+esc(info.descripcion):""}</span>`;
    try{ const c = parseCTB(await f.blob.arrayBuffer(), window.pako); const usados = c.estilos.filter(e=>e.lineweightMM!=null && e.lineweightIdx!==0 || !e.useObjectColor);
      prevEl.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Color</th><th>Estilo</th><th>Grosor (mm)</th><th>Color de trazo</th><th>Trama (%)</th></tr></thead><tbody>${c.estilos.slice(0,255).filter(e=>e.lineweightMM!=null && (e.lineweightIdx>0 || !e.useObjectColor || e.screening!==100)).slice(0,60).map(e=>`<tr><td><span style="display:inline-block;width:14px;height:14px;border:1px solid #ccc;vertical-align:middle;background:${aciColor(e.colorIdx)}"></span> <span class="mono">${e.colorIdx}</span></td><td>${esc(e.name)}</td><td class="num">${e.lineweightMM!=null?e.lineweightMM.toFixed(2):"—"}</td><td>${e.useObjectColor?"Color del objeto":"Negro / fijo"}</td><td class="num">${e.screening}</td></tr>`).join("")||`<tr><td colspan="5" class="muted">Todos los colores con valores por defecto</td></tr>`}</tbody></table></div>`; }catch(e){ prevEl.innerHTML = `<span class="badge badge-warn">No se pudo interpretar el contenido del CTB (${esc(e.message)})</span>`; }
  }
}
function aciColor(i){ const base = {1:"#f00",2:"#ff0",3:"#0f0",4:"#0ff",5:"#00f",6:"#f0f",7:"#000",8:"#808080",9:"#c0c0c0"}; if(base[i]) return base[i]; const h = ((i-10)%240)*1.5; return `hsl(${h},80%,${i%10>=5?35:50}%)`; }

/* ================= catálogo ================= */
function screenCatalogo(disc){
  const discs = ["ELE","INS"].includes(disc) ? [disc] : ["ELE","INS"];
  main.innerHTML = topbar({ crumbs:[{label:"Catálogo de entregables", href:"#/catalogo"}].concat(discs.length===1 ? [{label:disciplinaNombre(disc)}] : []), title: discs.length===1 ? disciplinaNombre(disc) : "Catálogo de entregables" }) +
    `<div class="stat-row"><div class="stat hl"><div class="k">Entregables</div><div class="v">${CATALOGO.length}</div></div><div class="stat"><div class="k">Electricidad</div><div class="v">${CATALOGO.filter(e=>e.disciplina==="ELE").length}</div></div><div class="stat"><div class="k">Instrumentación y control</div><div class="v">${CATALOGO.filter(e=>e.disciplina==="INS").length}</div></div><div class="stat"><div class="k">Planos</div><div class="v">${CATALOGO.filter(e=>e.tipo==="plano").length}</div></div></div>` +
    discs.map(d=>`<h3 class="disc-title">${disciplinaNombre(d)}</h3>${CATALOGO.filter(e=>e.disciplina===d).map(e=>`<div class="deliv"><div class="mono muted" style="padding-top:2px">${e.n}</div><div><div class="title">${esc(e.nombre)} ${badgeEstado(e.estado)} <span class="badge badge-neutral">${esc(TIPOS[e.tipo])}</span></div><div class="desc">${esc(e.finalidad)}</div><details><summary>Datos de entrada y salida</summary><ul>${e.entradas.map(x=>`<li>${esc(x)}</li>`).join("")}</ul><div class="mt-1"><strong>Salida:</strong> ${esc(e.salida)}</div></details></div><div class="right"><span class="chip">${e.doc}</span><span class="muted" style="font-size:11.5px">${e.etapas.map(x=>etapaNombre(x).replace("Ingeniería ","")).join(" · ")}</span></div></div>`).join("")}`).join("");
}

/* ================= organización ================= */
function screenOrganizacion(){
  const o = state.org;
  main.innerHTML = topbar({ crumbs:[{label:"Configuración"},{label:"Mi organización"}], title:"Mi organización", sub:"Se ingresa una vez: aparece en carátulas, cajetines y firmas de todos los proyectos." }) + html`
    <div class="grid-2">
      <div class="card"><div class="card-head"><h2>Empresa</h2></div><div class="card-body">
        <div class="field"><label>Razón social</label><input id="o-nombre" type="text" value="${esc(o.nombre)}" placeholder="Razón social"></div>
        <div class="grid-2">
          <div class="field"><label>Nombre corto (cajetín)</label><input id="o-corto" type="text" value="${esc(o.nombreCorto)}" placeholder="Nombre corto"></div>
          <div class="field"><label>Sitio web</label><input id="o-web" type="text" value="${esc(o.web)}"></div>
        </div>
        <div class="field"><label>Dirección</label><input id="o-dir" type="text" value="${esc(o.direccion)}"></div>
        <h3 class="ed-sub mt-2">Firmas por defecto (iniciales)</h3>
        <div class="grid-4">
          <div class="field"><label>Elabora</label><input id="o-el" type="text" value="${esc(o.elaboraPor)}" placeholder="Iniciales"></div>
          <div class="field"><label>Revisa</label><input id="o-re" type="text" value="${esc(o.revisaPor)}" placeholder="Iniciales"></div>
          <div class="field"><label>Aprueba</label><input id="o-ap" type="text" value="${esc(o.apruebaPor)}" placeholder="Iniciales"></div>
          <div class="field"><label>Dibuja</label><input id="o-di" type="text" value="${esc(o.dibujaPor||"")}" placeholder="= Elabora"></div>
        </div>
        <button class="btn-primary" id="o-save">Guardar</button>
      </div></div>
      <div class="card" style="margin-top:0"><div class="card-head"><h2>Logo</h2></div><div class="card-body">
        <div id="logo-prev" class="mb-2"></div>
        <div class="dropzone" id="logo-drop"><strong>Arrastra el logo</strong> o haz clic <span class="muted">(PNG o JPG)</span></div>
      </div></div>
    </div>`;
  $("#o-save").onclick = ()=>{ Object.assign(o, { nombre:$("#o-nombre").value.trim(), nombreCorto:$("#o-corto").value.trim(), direccion:$("#o-dir").value.trim(), web:$("#o-web").value.trim(), elaboraPor:$("#o-el").value.trim(), revisaPor:$("#o-re").value.trim(), apruebaPor:$("#o-ap").value.trim(), dibujaPor:$("#o-di").value.trim() }); S.save(); menuLateral("organizacion"); toast("Datos guardados"); };
  const showLogo = async ()=>{ const el = $("#logo-prev"); if(!o.logo){ el.innerHTML = '<span class="muted">Sin logo: se usa el nombre de la empresa.</span>'; return; } const f = await S.leerArchivo(o.logo); if(!f){ el.innerHTML=""; return; } const url = await S.blobToDataURL(f.blob); o.logoDataURL = url; el.innerHTML = `<div class="row"><img src="${url}" alt="logo" style="max-height:70px; max-width:240px; border:1px solid var(--border); padding:6px; border-radius:6px; background:#fff"><button class="btn-sm btn-danger" id="logo-del">${ICON.trash} Quitar</button></div>`; $("#logo-del").onclick = async ()=>{ await S.borrarArchivo(o.logo); o.logo=null; o.logoDataURL=null; S.save(); showLogo(); }; };
  showLogo();
  dropzone($("#logo-drop"), "image/png,image/jpeg", async file=>{ if(o.logo) await S.borrarArchivo(o.logo); o.logo = await S.guardarArchivo({ tipo:"logo", nombre:file.name, size:file.size }, file); o.logoDataURL = await leerComoDataURL(file); S.save(); showLogo(); toast("Logo cargado"); });
}

/* ================= respaldo ================= */
function screenRespaldo(){
  main.innerHTML = topbar({ crumbs:[{label:"Configuración"},{label:"Respaldo de datos"}], title:"Respaldo de datos", sub:"Los proyectos se guardan en este navegador. Exporta un respaldo para llevarlos a otro equipo." }) + html`
    <div class="grid-2">
      <div class="card"><div class="card-head"><h2>Exportar</h2></div><div class="card-body">
        <p class="muted">Proyectos y organización en un archivo .json. Las plantillas y logos cargados no se incluyen.</p>
        <button class="btn-primary" id="bk-exp">${ICON.download} Exportar respaldo</button>
      </div></div>
      <div class="card" style="margin-top:0"><div class="card-head"><h2>Importar</h2></div><div class="card-body">
        <p class="muted">Reemplaza los datos actuales de este navegador.</p>
        <button id="bk-imp">${ICON.upload} Importar respaldo</button>
      </div></div>
    </div>`;
  $("#bk-exp").onclick = ()=>X.descargar(S.exportarRespaldo(), "ingenia_respaldo_"+hoy()+".json", "application/json");
  $("#bk-imp").onclick = ()=>{ const i=document.createElement("input"); i.type="file"; i.accept=".json"; i.onchange=async()=>{ if(!(await confirmar("Importar respaldo", "Se reemplazarán los proyectos y la configuración de este navegador.", "Importar"))) return; try{ S.importarRespaldo(await i.files[0].text()); location.reload(); }catch(e){ toast("Archivo no válido", true); } }; i.click(); };
}

/* ================= formatos estándar ================= */
function screenEstandares(){
  const filas = Object.entries(DOCS).filter(([id,d])=>!d.alias && entregable(id) && !entregable(id).interno).map(([id,d])=>({ id, e: entregable(id), d }));
  main.innerHTML = topbar({ crumbs:[{label:"Configuración"},{label:"Formatos estándar"}], title:"Formatos estándar", sub:"Se usan cuando el proyecto no tiene el formato del cliente." }) + html`
    <div class="table-wrap"><table><thead><tr><th>Documento</th><th>Formato</th><th>Base</th><th></th></tr></thead><tbody>
    ${filas.map(({id,e,d})=>`<tr><td>${esc(e?e.nombre:id)}</td><td>${{xlsx:"Excel",docx:"Word",dxf:"DXF A1"}[d.formato]}</td><td class="muted">${esc(d.ref)}</td><td>${d.plantilla && !d.estandar ? `<a class="btn btn-sm" href="assets/plantillas/${esc(d.plantilla)}" download>${ICON.download} Plantilla</a>` : ""}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="grid-2 mt-2">
      <div class="card"><div class="card-head"><h2>Excel</h2></div><div class="card-body"><p>Celdas <span class="chip">{{proyecto}}</span> <span class="chip">{{codigo}}</span> <span class="chip">{{rev}}</span>… y fila modelo <span class="chip">{{tabla:NOMBRE}}</span> + <span class="chip">{{col:clave}}</span>. Fórmulas y totales se extienden solos.</p></div></div>
      <div class="card" style="margin-top:0"><div class="card-head"><h2>Planos (DXF)</h2></div><div class="card-body"><p>DXF R12, lámina A1 (841 × 594 mm), capas G-, I-, E- con sus colores para imprimir con tu CTB.</p></div></div>
    </div>`;
}

route();
comprobarVersion();
iniciarCopito(()=>rutaMenu.seg==="proyecto" ? { id: rutaMenu.id } : {}, ()=>{ const y = window.scrollY; route(); window.scrollTo(0, y); });

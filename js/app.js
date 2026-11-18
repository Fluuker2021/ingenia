/* Ingenia — aplicación (enrutador por hash y pantallas) */
import { ENTREGABLES, CATALOGO, DISCIPLINAS, ETAPAS, ESTADOS, TIPOS, entregable, ETAPAS_TRABAJO, ordenTrabajo, etapaDe, docListo, requisitos, habilita, ESTADOS_DOC, sincronizarEstado, claseEstado } from "./catalog.js";
import * as S from "./store.js";
import { $, $$, esc, html, ICON, toast, modal, confirmar, dropzone, leerComoArrayBuffer, leerComoTexto, leerComoDataURL, fmtFecha, hoy, kb } from "./ui.js";
import * as X from "./export.js";
import { parseDXF, drawPreview, parseCTB, boundsOf } from "./dxf.js";
import { ESQUEMAS, renderEditor, tablasParaExportar } from "./modules/tablas.js";
import { PARAMETROS_DISENO, valoresDiseno, tensionControlTxt } from "./modules/criterios.js";
import { screenDocumento, descargarDoc, nextRev } from "./workspace.js";
import { generable, defDoc, DOCS } from "./docs.js";
import { renderEditores, campoDiseno, enlazarDiseno } from "./editores.js";
import { datos, nuevoTablero, TIPOS_TABLERO, ipRecomendado, tableros, instrumentos } from "./datos.js";
import { VERSION } from "./version.js";
import { comprobarVersion } from "./actualizar.js";
import { iniciarCopito } from "./copito.js";
import { esPro, etiquetaDoc, screenPlan, nombrePlan } from "./plan.js";

const main = $("#main");
const state = S.load();
const etapaNombre = id => (ETAPAS.find(e=>e.id===id)||{}).nombre || id;
const disciplinaNombre = id => (DISCIPLINAS[id]||{}).nombre || id;

/* ================= enrutador ================= */
const PTABS = [
  ["resumen","Resumen",0,'<svg class="icon" viewBox="0 0 24 24"><path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"/></svg>'],
  ["diseno","Datos generales",1],
  ["documentos","Documentos",2],
];
function route(){
  const h = location.hash.replace(/^#\/?/, "");
  let [seg, id, tab, docId, sub] = h.split("/");
  // «editar/N» abre el asistente del proyecto en el paso N; «entregables» (enlace antiguo) abre la selección de documentos
  let editar = null;
  if(seg==="proyecto" && id && (tab==="editar" || tab==="entregables")){
    editar = tab==="editar" ? Math.max(0, Math.min(3, parseInt(docId)||0)) : 3;
    tab = tab==="editar" ? "resumen" : "documentos";
    history.replaceState(null, "", `#/proyecto/${id}/${tab}`);
  }
  menuLateral(seg||"proyectos", id, tab);
  window.scrollTo(0,0);
  if(!seg || seg==="proyectos") return screenProyectos();
  if(seg==="proyecto" && id && tab==="doc" && docId){ const p = S.proyecto(id); if(!p){ location.hash="#/proyectos"; return; } return screenDocumento(main, state, p, docId, sub||"datos", topbar); }
  if(seg==="proyecto" && id){ screenProyecto(id, tab||"resumen"); const p = editar!=null && S.proyecto(id); if(p) modalProyecto(p, editar); return; }
  if(seg==="catalogo") return screenCatalogo(id);
  if(seg==="organizacion") return screenOrganizacion();
  if(seg==="respaldo") return screenRespaldo();
  if(seg==="estandares") return screenEstandares();
  if(seg==="plan") return screenPlan(main, state, topbar);
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
    if(seg==="organizacion" || seg==="respaldo" || seg==="estandares" || seg==="plan") navAb.config = true;
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
    grupo("config", IC.cfg, "Configuración", enlace("#/plan", "", "Mi plan", seg==="plan") + enlace("#/organizacion", "", "Mi organización", seg==="organizacion") + enlace("#/estandares", "", "Formatos estándar", seg==="estandares") + enlace("#/respaldo", "", "Respaldo de datos", seg==="respaldo"));
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
      const n = p.entregables.length;
      const emit = p.entregables.filter(id=>((p.documentos||{})[id]||{}).estado==="Emitido").length;
      return `<div class="card clickable" data-open="${p.id}"><div class="card-body">
        <div class="row between"><span class="muted" style="font-size:12px">${esc(p.disciplinas.map(d=>(DISCIPLINAS[d]||{}).corto||d).join(" · "))}</span><span class="badge badge-neutral">${esc(etapaNombre(p.etapa))}</span></div>
        <h3 style="margin:12px 0 4px">${esc(p.nombre)}</h3>
        <div class="muted" style="font-size:12.5px">${esc(p.cliente||"—")}${p.unidad?" · "+esc(p.unidad):""}</div>
        <div class="card-pie"><div class="row between" style="font-size:12px"><span class="muted">${n} documentos</span><span class="mono">${emit}/${n} emitidos</span></div>
        <div class="progress mt-1"><span style="width:${n?Math.round(100*emit/n):0}%"></span></div></div>
      </div></div>`; }).join("")}</div>`
    : `<div class="empty"><p><strong>Aún no hay proyectos.</strong></p><p>Ingresa los datos del proyecto, el sistema eléctrico, los tableros y los documentos a elaborar; luego trabajas cada documento.</p><button class="btn-accent" id="nuevo2">${ICON.plus} Nuevo proyecto</button></div>`);
  $$("#nuevo,#nuevo2").forEach(b=>b.onclick = ()=>modalProyecto());
  $$("[data-open]").forEach(c=>c.onclick = ()=>location.hash = "#/proyecto/"+c.dataset.open);
}

/* documentos propuestos por defecto para las disciplinas y la etapa del proyecto */
const entregablesPorDefecto = (disc, etapa) => CATALOGO.filter(e=>disc.includes(e.disciplina) && e.etapas.includes(etapa)).map(e=>e.id);
const ordenCatalogo = ids => CATALOGO.filter(e=>ids.includes(e.id)).map(e=>e.id);

/* asistente del proyecto: 1 proyecto · 2 sitio y sistema eléctrico · 3 tableros · 4 documentos a elaborar.
   pasoIni abre directamente un paso (p. ej. 3 para agregar o quitar documentos). */
function modalProyecto(p, pasoIni=0){
  const isNew = !p;
  p = p || { nombre:"", cliente:"", unidad:"", etapa:"detalle", disciplinas:["ELE","INS"] };
  let dis = Object.assign({}, valoresDiseno(p));
  const sis = isNew ? { nombre:"" } : Object.assign({}, datos(p).sistema);
  // tableros: copia editable (al crear: 1 de fuerza + 1 de control)
  let tbs = isNew ? [nuevoTablero("fuerza",1), nuevoTablero("control",1)] : datos(p).tableros.map(t=>Object.assign({}, t));
  let logoFile = null, pidFile = null, pidQuitar = false, paso = pasoIni, base = null;
  // documentos: null = propuesta automática según disciplinas y etapa (hasta que el usuario la cambie)
  let sel = isNew ? null : new Set(p.entregables);
  const otros = isNew ? state.proyectos : [];
  const pasos = ["Proyecto","Sitio y sistema eléctrico","Tableros","Documentos"];
  const ULT = pasos.length-1;
  const grupos = PARAMETROS_DISENO.slice(0,2);
  const okTxt = isNew ? "Crear proyecto" : "Guardar";
  modal({ title: isNew ? "Nuevo proyecto" : "Editar proyecto", width:880, persistente:true, body: html`
    <div class="stepper">${pasos.map((t,i)=>`<button data-paso="${i}"><span class="n">${i+1}</span><span class="t">${t}</span></button>`).join("")}</div>
    <div data-panel="0">
      ${otros.length ? `<div class="field"><label>Partir de</label><select id="f-base"><option value="">Proyecto en blanco</option>${otros.map(o=>`<option value="${o.id}">${esc(o.nombre)}</option>`).join("")}</select><span class="hint">Copia cliente, condiciones del sitio, logo, formatos y la selección de documentos.</span></div>` : ""}
      <div class="grid-2">
        <div class="field" style="grid-column:1/-1"><label>Nombre del proyecto *</label><input id="f-nombre" type="text" value="${esc(p.nombre)}" placeholder="Nombre del proyecto"></div>
        <div class="field"><label>Cliente final</label><input id="f-cliente" type="text" value="${esc(p.cliente)}" placeholder="Nombre del cliente"></div>
        <div class="field"><label>Unidad Minera / Planta</label><input id="f-unidad" type="text" value="${esc(p.unidad)}" placeholder="Unidad minera, planta o sede"></div>
        <div class="field"><label>Sistema a implementar</label><input id="f-snom" type="text" value="${esc(sis.nombre)}" placeholder="Ej: Colector de polvo"></div>
        <div class="field"><label>Etapa</label><select id="f-etapa">${ETAPAS.map(e=>`<option value="${e.id}" ${p.etapa===e.id?"selected":""}>${e.nombre}</option>`).join("")}</select></div>
        <div class="field"><label>Disciplinas</label><div class="row" style="padding-top:6px;gap:18px"><label class="checkbox"><input type="checkbox" id="f-ele" ${p.disciplinas.includes("ELE")?"checked":""}> Electricidad</label><label class="checkbox"><input type="checkbox" id="f-ins" ${p.disciplinas.includes("INS")?"checked":""}> Instrumentación &amp; Control</label></div></div>
        <div class="field"><label>Logo del cliente</label><div class="row" style="flex-wrap:nowrap"><div class="dropzone" id="f-logo" style="flex:1;padding:9px">Arrastra o elige <span class="muted">(JPG / PNG)</span></div><div id="f-logo-prev"></div></div></div>
        <div class="field" style="grid-column:1/-1"><label>P&amp;ID de referencia <span class="muted" style="font-weight:400">(opcional)</span></label><div class="row" style="flex-wrap:nowrap"><div class="dropzone" id="f-pid" style="flex:1;padding:9px">Arrastra o elige el P&amp;ID del proceso <span class="muted">(PDF)</span></div><div id="f-pid-prev"></div></div><span class="hint">Si no tienes un P&amp;ID, se generará a partir de la descripción del proceso en el documento «Diagrama P&amp;ID».</span></div>
      </div>
    </div>
    <div data-panel="1" hidden><div id="f-dis"></div><div class="notice accent">Grado de protección de gabinetes: <strong id="f-ip"></strong></div></div>
    <div data-panel="2" hidden><div id="f-tbs"></div></div>
    <div data-panel="3" hidden><div id="f-docs"></div></div>`,
    footer:`<button data-close>Cancelar</button><span class="grow"></span><button id="f-prev" title="Anterior">${ICON.back}<span class="lbl"> Anterior</span></button><button id="f-next" class="btn-primary">Siguiente</button><button class="btn-accent" id="f-ok">${okTxt}</button>`,
    onMount:(root, close)=>{
      const ver = ()=>{ $$("[data-panel]", root).forEach(el=>el.hidden = +el.dataset.panel!==paso); $$("[data-paso]", root).forEach(b=>{ b.classList.toggle("active", +b.dataset.paso===paso); b.classList.toggle("done", +b.dataset.paso<paso); }); $("#f-prev",root).style.display = paso ? "" : "none"; $("#f-next",root).style.display = paso<ULT ? "" : "none"; $("#f-ok",root).style.display = (paso===ULT || !isNew) ? "" : "none"; if(paso===ULT) renderDocs(); };
      const nombreOk = ()=>{ if($("#f-nombre",root).value.trim()) return true; paso = 0; ver(); $("#f-nombre",root).focus(); toast("Indica el nombre del proyecto", true); return false; };
      $$("[data-paso]", root).forEach(b=>b.onclick = ()=>{ if(+b.dataset.paso>0 && !nombreOk()) return; paso = +b.dataset.paso; ver(); });
      $("#f-prev",root).onclick = ()=>{ paso = Math.max(0,paso-1); ver(); };
      $("#f-next",root).onclick = ()=>{ if(!nombreOk()) return; paso = Math.min(ULT,paso+1); ver(); };
      // logo del cliente
      const prev = $("#f-logo-prev", root);
      const verLogo = url => { prev.innerHTML = url ? `<img src="${url}" alt="logo del cliente" style="max-height:40px;max-width:120px;border:1px solid var(--border);padding:3px;border-radius:5px;background:#fff">` : `<span class="badge badge-neutral">Sin logo</span>`; };
      const logoDe = async q => { if(q && q.plantillas && q.plantillas.logo_cliente){ const f = await S.leerArchivo(q.plantillas.logo_cliente); if(f){ verLogo(await S.blobToDataURL(f.blob)); return; } } verLogo(null); };
      logoDe(isNew ? null : p);
      dropzone($("#f-logo", root), "image/png,image/jpeg,.jpg,.jpeg,.png", async file=>{ if(!/image\/(png|jpe?g)/.test(file.type)){ toast("El logo debe ser JPEG o PNG", true); return; } logoFile = file; verLogo(await leerComoDataURL(file)); });
      // P&ID de referencia (PDF, opcional)
      const pidPrev = $("#f-pid-prev", root);
      const verPid = async ()=>{
        let nombre = pidFile ? pidFile.name : null;
        if(!nombre && !pidQuitar && !isNew && datos(p).proceso.referencia){ const f = await S.leerArchivo(datos(p).proceso.referencia); nombre = f ? f.nombre : null; }
        pidPrev.innerHTML = nombre ? `<span class="row nowrap" style="gap:4px"><span class="badge badge-ok" title="${esc(nombre)}">${ICON.check} ${esc(nombre.length>24 ? nombre.slice(0,22)+"…" : nombre)}</span><button class="btn-ghost btn-sm" id="f-pid-del" title="Quitar P&amp;ID">${ICON.trash}</button></span>` : `<span class="badge badge-neutral">Sin P&amp;ID</span>`;
        const del = $("#f-pid-del", root); if(del) del.onclick = ()=>{ pidFile = null; pidQuitar = true; verPid(); };
      };
      verPid();
      dropzone($("#f-pid", root), ".pdf,application/pdf", file=>{ if(file.type!=="application/pdf" && !/\.pdf$/i.test(file.name)){ toast("El P&ID de referencia debe ser un PDF", true); return; } pidFile = file; pidQuitar = false; verPid(); });
      // sitio y sistema eléctrico: tensiones numéricas, tensión de control en Vac o Vdc
      const ip = ()=>{ $("#f-ip",root).textContent = ipRecomendado(dis); };
      const renderDis = ()=>{
        const box = $("#f-dis", root);
        box.innerHTML = grupos.map(g=>`<h3 class="ed-sub">${esc(g.grupo)}</h3><div class="grid-3">${g.campos.map(c=>campoDiseno(c, dis)).join("")}</div>`).join("");
        enlazarDiseno(box, (k, v)=>{ dis[k] = v; ip(); });
        ip();
      };
      renderDis();
      // partir de un proyecto existente
      const bs = $("#f-base", root);
      if(bs) bs.onchange = ()=>{
        base = bs.value ? S.proyecto(bs.value) : null;
        const q = base || { cliente:"", unidad:"", etapa:"detalle", disciplinas:["ELE","INS"] };
        [["f-cliente","cliente"],["f-unidad","unidad"],["f-etapa","etapa"]].forEach(([el,k])=>{ $("#"+el,root).value = q[k]||""; });
        $("#f-ele",root).checked = q.disciplinas.includes("ELE"); $("#f-ins",root).checked = q.disciplinas.includes("INS");
        dis = Object.assign({}, valoresDiseno(base || {}));
        sel = base ? new Set(base.entregables) : null;
        renderDis();
        if(!logoFile) logoDe(base);
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
      // documentos a elaborar
      const docsBox = $("#f-docs", root);
      const discSel = ()=>[ $("#f-ele",root).checked?"ELE":null, $("#f-ins",root).checked?"INS":null ].filter(Boolean);
      const seleccion = ()=> sel || new Set(entregablesPorDefecto(discSel(), $("#f-etapa",root).value));
      function renderDocs(){
        const disc = discSel(), etapa = $("#f-etapa",root).value, s = seleccion();
        const lista = CATALOGO.filter(e=>disc.includes(e.disciplina) && (e.etapas.includes(etapa) || s.has(e.id)));
        const n = lista.filter(e=>s.has(e.id)).length;
        docsBox.innerHTML = `<div class="notice accent mb-2 wz-guia"><strong>Marca los documentos que se elaborarán en este proyecto</strong> y luego presiona «${okTxt}». Después trabajarás cada uno desde <strong>Documentos</strong>.</div>
          <div class="row between mb-1"><span class="muted" style="font-size:12.5px">${n} seleccionado(s) · ${esc(etapaNombre(etapa))}</span><div class="row"><button class="btn-sm" data-dsel="todos">Marcar todos</button><button class="btn-sm" data-dsel="none">Quitar todos</button></div></div>
          ${esPro(state) ? "" : `<p class="muted mb-1" style="font-size:12.5px">Los documentos marcados con <span class="badge badge-pro">Pro</span> se eligen ahora y se desarrollan con el plan Profesional (<a href="#/plan">ver planes</a>).</p>`}
          ${disc.map(d=>{ const items = lista.filter(e=>e.disciplina===d); if(!items.length) return ""; return `<h3 class="disc-title">${disciplinaNombre(d)}</h3>${items.map(e=>`<label class="deliv wz-doc ${s.has(e.id)?"selected":""}"><input type="checkbox" data-doc="${e.id}" ${s.has(e.id)?"checked":""}><div><div class="title">${esc(e.nombre)} ${etiquetaDoc(e, state)}</div><div class="desc">${esc(e.finalidad)}</div></div></label>`).join("")}`; }).join("") || `<div class="empty">Marca al menos una disciplina en el paso 1.</div>`}`;
        $$("[data-doc]", docsBox).forEach(c=>c.onchange = ()=>{ sel = new Set(seleccion()); c.checked ? sel.add(c.dataset.doc) : sel.delete(c.dataset.doc); renderDocs(); });
        $$("[data-dsel]", docsBox).forEach(b=>b.onclick = ()=>{ sel = new Set(seleccion()); lista.forEach(e=>{ if(b.dataset.dsel==="none") sel.delete(e.id); else sel.add(e.id); }); renderDocs(); });
      }
      ver();
      $("#f-ok", root).onclick = async ()=>{
        if(!nombreOk()) return;
        if(!tbs.length){ paso = 2; ver(); toast("Define al menos un tablero", true); return; }
        const tags = tbs.map(t=>t.tag); if(tags.some(t=>!t) || new Set(tags).size!==tags.length){ paso = 2; ver(); toast("Cada tablero debe tener un TAG único", true); return; }
        const data = { nombre:$("#f-nombre",root).value.trim(), cliente:$("#f-cliente",root).value.trim(), unidad:$("#f-unidad",root).value.trim(), etapa:$("#f-etapa",root).value,
          disciplinas:[ $("#f-ele",root).checked?"ELE":null, $("#f-ins",root).checked?"INS":null ].filter(Boolean) };
        if(!data.disciplinas.length){ paso = 0; ver(); toast("Marca al menos una disciplina", true); return; }
        const ents = ordenCatalogo([...seleccion()].filter(id=>{ const e = entregable(id); return e && !e.interno && data.disciplinas.includes(e.disciplina); }));
        if(!ents.length){ paso = ULT; ver(); toast("Marca al menos un documento", true); return; }
        const target = isNew ? S.nuevoProyecto(data) : Object.assign(p, data);
        target.diseno = Object.assign(target.diseno||{}, dis);
        const d = datos(target);
        d.sistema.nombre = $("#f-snom",root).value.trim();
        // reasignar cargas / instrumentos de tableros eliminados
        const ids = new Set(tbs.map(t=>t.id));
        d.tableros = tbs;
        d.cargas.forEach(l=>{ if(l.tablero && !ids.has(l.tablero)) l.tablero = ""; });
        target.plantillas = target.plantillas || {};
        if(isNew && base){
          // copia del proyecto de origen: formatos del cliente y criterios
          for(const [k, fid] of Object.entries(base.plantillas||{})){ if(!fid || (k==="logo_cliente" && logoFile)) continue; const f = await S.leerArchivo(fid); if(f){ const { id:_i, blob, creado, ...meta } = f; target.plantillas[k] = await S.guardarArchivo(Object.assign(meta, { proyectoId:target.id }), blob); } }
          target.plantillaModo = base.plantillaModo; target.hojaPlano = base.hojaPlano;
          const db = datos(base); d.cablesCfg = Object.assign({}, db.cablesCfg); d.memoria = Object.assign({}, db.memoria);
        }
        target.entregables = ents;
        if(logoFile){ if(target.plantillas.logo_cliente) await S.borrarArchivo(target.plantillas.logo_cliente); target.plantillas.logo_cliente = await S.guardarArchivo({ tipo:"logo_cliente", proyectoId:target.id, nombre:logoFile.name, size:logoFile.size, info:{ tipo:logoFile.type } }, logoFile); }
        if((pidQuitar || pidFile) && d.proceso.referencia){ await S.borrarArchivo(d.proceso.referencia); d.proceso.referencia = null; }
        if(pidFile) d.proceso.referencia = await S.guardarArchivo({ tipo:"pid_ref", proyectoId:target.id, nombre:pidFile.name, size:pidFile.size }, pidFile);
        S.sincronizarDocumentos(target, ENTREGABLES); S.save(); close();
        if(isNew){ toast(`Proyecto creado con ${ents.length} documentos: abre cada uno para ingresar sus datos`, false, 4500); location.hash = "#/proyecto/"+target.id+"/documentos"; } else route();
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
    sub:`<span>${esc(p.cliente||"—")}${p.unidad?" · "+esc(p.unidad):""}</span><span class="badge badge-neutral">${esc(etapaNombre(p.etapa))}</span>`,
    actions:`<button id="editar">${ICON.edit} Editar</button><button class="btn-danger" id="borrar" title="Eliminar proyecto">${ICON.trash}</button>` }) +
    `<div class="tabs proj-tabs">${PTABS.map(t=>`<button data-tab="${t[0]}" class="${t[0]===tab?"active":""}">${t[2]?t[2]+". ":""}${t[1]}</button>`).join("")}</div><div id="tab-body"></div>`;
  $("#editar").onclick = ()=>modalProyecto(p);
  $("#borrar").onclick = async ()=>{ if(await confirmar("Eliminar proyecto", `Se eliminará «${p.nombre}» con todos sus datos.`, "Eliminar")){ S.eliminarProyecto(p.id); location.hash="#/proyectos"; } };
  $$("[data-tab]").forEach(b=>b.onclick = ()=>location.hash = `#/proyecto/${p.id}/${b.dataset.tab}`);
  const body = $("#tab-body");
  ({ resumen: tabResumen, diseno: tabDiseno, documentos: tabDocumentos }[tab] || tabResumen)(body, p);
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
      <div class="stat hl"><div class="k">Documentos</div><div class="v">${sel.length}</div></div>
      <div class="stat"><div class="k">Emitidos</div><div class="v">${emit}</div></div>
      <div class="stat"><div class="k">Tableros</div><div class="v">${tbs.length}</div></div>
      <div class="stat"><div class="k">Cargas</div><div class="v">${d.cargas.length}</div></div>
      <div class="stat"><div class="k">Instrumentos</div><div class="v">${nInst}</div></div>
    </div>
    <div class="grid-2">
      <div class="card"><div class="card-head"><h2>Avance</h2></div><div class="card-body" style="padding-top:4px;padding-bottom:4px"><ul class="checklist">
        ${paso(!!(d.sistema.nombre && tbs.length), "1. Datos generales", `${esc(v.tension)} Vac · ${esc(v.frecuencia)} Hz · control ${esc(tensionControlTxt(v))} · ${tbs.length} tablero(s)`, `#/proyecto/${p.id}/diseno`, "Revisar")}
        ${paso(d.cargas.length>0 || nInst>0, "2. Datos por documento", `${sel.length} documentos · ${d.cargas.length} cargas · ${nInst} instrumentos`, `#/proyecto/${p.id}/documentos`, "Abrir")}
        ${paso(sel.length>0 && emit===sel.length, "3. Emisión", `${emit} de ${sel.length} documentos emitidos`, `#/proyecto/${p.id}/documentos`, "Emitir")}
        ${paso(logo, "Logo del cliente", logo ? "Logo cargado" : "Sin logo del cliente", `#/proyecto/${p.id}/editar/0`, logo?"Ver":"Cargar")}
      </ul></div></div>
      <div class="card"><div class="card-head"><h2>Datos del proyecto</h2><button class="btn-sm" id="r-editar">${ICON.edit} Editar</button></div><div class="card-body"><dl class="kv">
        <dt>Cliente</dt><dd>${esc(p.cliente||"—")}</dd><dt>Unidad Minera / Planta</dt><dd>${esc(p.unidad||"—")}</dd>
        <dt>Sistema a implementar</dt><dd>${esc(d.sistema.nombre||"—")}</dd>
        <dt>Disciplinas</dt><dd>${p.disciplinas.map(disciplinaNombre).join(", ")}</dd>
        <dt>P&amp;ID de referencia</dt><dd id="r-pid">${d.proceso.referencia ? "…" : "—"}</dd>
        <dt>Tableros</dt><dd>${tbs.map(t=>`<span class="chip">${esc(t.tag)}</span>`).join(" ")||"—"}</dd>
        <dt>Creado</dt><dd>${fmtFecha(p.creado)}</dd></dl></div></div>
    </div>`;
  $("#r-editar").onclick = ()=>modalProyecto(p);
  if(d.proceso.referencia) S.leerArchivo(d.proceso.referencia).then(f=>{ const el = $("#r-pid"); if(el) el.textContent = f ? f.nombre : "—"; });
}
const badgeEstado = e => `<span class="badge ${e==="listo"?"badge-ok":e==="parcial"?"badge-warn":"badge-neutral"}">${ESTADOS[e].label}</span>`;

/* ---------- datos generales ----------
   El proyecto, el sistema eléctrico y el sitio se ingresan al crear el proyecto (botón Editar para cambiarlos);
   aquí quedan los tableros en detalle y los criterios de diseño con valores típicos. */
function tabDiseno(body, p){
  const v = valoresDiseno(p);
  body.innerHTML = `<div class="notice mb-2 dg-resumen"><span>Sistema eléctrico y sitio (definidos al crear el proyecto): <strong class="mono">${esc(v.tension)} Vac · ${esc(v.frecuencia)} Hz · control ${esc(tensionControlTxt(v))}</strong>${v.altitud?` · ${esc(v.altitud)} m s.n.m.`:""}</span><button class="btn-sm" id="dg-editar">${ICON.edit} Editar</button></div><div id="eds-gen"></div>
    <div class="row mt-2" style="justify-content:flex-end"><a class="btn btn-primary" href="#/proyecto/${p.id}/documentos">Siguiente: documentos →</a></div>`;
  $("#dg-editar").onclick = ()=>modalProyecto(p, 1);
  renderEditores($("#eds-gen", body), p, ["tableros","criterios"], null, ()=>{});
}

/* ---------- documentos, emisión y descargas ---------- */
const PLEG_KEY = "ingenia.etapas";
function etapasPlegadas(pid){ try{ return new Set((JSON.parse(localStorage.getItem(PLEG_KEY))||{})[pid]||[]); }catch(e){ return new Set(); } }
function guardarPlegadas(pid, set){ try{ const o = JSON.parse(localStorage.getItem(PLEG_KEY))||{}; o[pid] = [...set]; localStorage.setItem(PLEG_KEY, JSON.stringify(o)); }catch(e){} }
function tabDocumentos(body, p){
  S.sincronizarDocumentos(p, ENTREGABLES);
  // documentos en el orden de la ruta de trabajo (punto de partida → cálculos → diagramas → detalle → cierre)
  const sel = p.entregables.map(entregable).filter(Boolean).sort((a, b)=>ordenTrabajo(a.id) - ordenTrabajo(b.id));
  // el estado sigue a la revisión vigente (la que se emite en «Cajetín y descarga» de cada documento)
  if(sel.reduce((n, e)=>n + (sincronizarEstado(p.documentos[e.id]) ? 1 : 0), 0)) S.save();
  const nombre = id => (entregable(id)||{}).nombre || id;
  const chip = id => { const ok = docListo(p.documentos[id]); return `<a class="req-chip ${ok ? "ok" : ""}" href="#/proyecto/${p.id}/doc/${id}" title="${ok ? "Listo" : "Pendiente"}">${ok ? ICON.check : "○"} ${esc(nombre(id))}</a>`; };
  const fila = e=>{ const d = p.documentos[e.id]; const rv = (d.revisiones && d.revisiones.length) ? d.revisiones[d.revisiones.length-1] : { rev:d.rev, fecha:d.fecha, descripcion:d.emitido };
    const req = requisitos(p, e.id);
    return `<tr data-id="${e.id}" class="${docListo(d) ? "doc-listo" : ""}">
        <td><div style="font-weight:500">${generable(e.id)?`<a href="#/proyecto/${p.id}/doc/${e.id}">${esc(e.nombre)}</a>`:esc(e.nombre)}</div><div class="muted" style="font-size:12px">${esc(DISCIPLINAS[e.disciplina].corto)} ${etiquetaDoc(e, state)}</div></td>
        <td class="doc-req">${req.length ? req.map(chip).join("") : `<span class="req-inicio">Punto de partida</span>`}</td>
        <td style="white-space:nowrap"><span class="mono">Rev. ${esc(rv.rev||"A")}</span> · <span class="mono">${esc(fmtFecha(rv.fecha))}</span><div class="muted" style="font-size:12px">${esc(String(rv.descripcion||"").replace(/^Emitido para /,"Para ")||"—")}</div></td>
        <td><select data-f="estado" class="sel-estado ${claseEstado(d.estado)}" style="min-width:130px">${ESTADOS_DOC.map(o=>`<option ${d.estado===o?"selected":""}>${o}</option>`).join("")}</select></td>
        <td style="white-space:nowrap">${accionesDoc(e, p)}</td></tr>`; };
  const grupos = ETAPAS_TRABAJO.map(et=>({ k:"e"+et.n, titulo:et.titulo, docs: sel.filter(e=>et.docs.includes(e.id)) })).filter(g=>g.docs.length);
  const sueltos = sel.filter(e=>!etapaDe(e.id));
  if(sueltos.length) grupos.push({ k:"otros", titulo:"Otros documentos", docs:sueltos });
  // etapas plegadas (se recuerdan en este navegador, por proyecto)
  const plegadas = etapasPlegadas(p.id);
  const etapa = g => { const pl = plegadas.has(g.k);
    return `<tr class="etapa-fila ${pl ? "plegada" : ""}" data-etapa="${g.k}" aria-expanded="${!pl}"><td colspan="5"><span class="etapa-chev">${IC.chev}</span><strong>${esc(g.titulo)}</strong><span class="etapa-cnt">${g.docs.length} documento${g.docs.length>1?"s":""}</span></td></tr>${g.docs.map(e=>fila(e).replace("<tr ", `<tr data-g="${g.k}" ${pl ? "hidden " : ""}`)).join("")}`; };
  body.innerHTML = html`
    ${!state.org.nombre ? `<div class="notice accent mb-2">Completa <a href="#/organizacion">tu organización</a> (nombre, logo y firmas) una sola vez: se usa en todas las carátulas y cajetines.</div>` : ""}
    <div class="row mb-2" style="justify-content:flex-end">
      <button class="btn-sm" id="docs-sel">${ICON.edit} Agregar o quitar documentos</button><button class="btn-sm" id="dl-registro">${ICON.open} Lista de documentos</button>
    </div>
    ${sel.length ? `<div class="table-wrap"><table class="docs-table"><thead><tr><th>Documento</th><th>Requiere</th><th>Revisión vigente</th><th>Estado</th><th></th></tr></thead><tbody>
      ${grupos.map(etapa).join("")}
      </tbody></table></div>` : `<div class="empty"><p>No hay documentos seleccionados.</p><button class="btn-accent" id="docs-sel2">Seleccionar documentos</button></div>`}`;
  // toda la fila de la etapa pliega o despliega sus documentos
  $$("tr[data-etapa]", body).forEach(tr=>tr.onclick = ()=>{
    const k = tr.dataset.etapa, pl = !plegadas.has(k);
    pl ? plegadas.add(k) : plegadas.delete(k); guardarPlegadas(p.id, plegadas);
    tr.classList.toggle("plegada", pl); tr.setAttribute("aria-expanded", String(!pl));
    $$(`tr[data-g="${k}"]`, body).forEach(x=>{ x.hidden = pl; });
  });
  // al cambiar el estado se actualizan los requisitos listos
  $$("tr[data-id] [data-f]", body).forEach(el=>el.onchange = ()=>{ const d = p.documentos[el.closest("tr").dataset.id]; d[el.dataset.f] = el.value; S.save(); tabDocumentos(body, p); });
  $$("#docs-sel,#docs-sel2").forEach(b=>b.onclick = ()=>modalProyecto(p, 3));
  $("#dl-registro").onclick = ()=>{ location.hash = `#/proyecto/${p.id}/doc/gen-registro/vista`; };
}
/* la descarga se hace dentro de cada documento, en «Cajetín y descarga» */
function accionesDoc(e, p){
  if(generable(e.id)) return `<a class="btn btn-sm btn-primary" href="#/proyecto/${p.id}/doc/${e.id}">Abrir</a>`;
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
        <p><strong>Excel</strong> (celdas): <span class="tokens">${["{{proyecto}}","{{cliente}}","{{unidad}}","{{etapa}}","{{titulo}}","{{rev}}","{{fecha}}","{{org}}","{{disciplina}}","{{emitido}}","{{elaboro}}","{{reviso}}","{{aprobo}}","{{rev1.rev}} {{rev1.fecha}} {{rev1.descripcion}} …","{{tabla:cargas}} + {{col:tag}} {{col:descripcion}} …","{{tabla:cables}}","{{tabla:equipos}}","{{tabla:instrumentos}}","{{tabla:io}}","{{tabla:documentos}}"].map(t=>`<span class="chip">${esc(t)}</span>`).join("")}</span></p>
        <p class="mt-2"><strong>Word</strong> (texto): <span class="tokens">${["{proyecto}","{cliente}","{titulo}","{rev}","{fecha}","{org}","{#revisiones}{rev} {fecha} {descripcion} {elaboro} {reviso} {aprobo}{/revisiones}","{#secciones}{titulo} {texto} {#items}{.}{/items}{/secciones}","{#circuitos}…{/circuitos} (memoria de cálculo)"].map(t=>`<span class="chip">${esc(t)}</span>`).join("")}</span></p>
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
    discs.map(d=>`<h3 class="disc-title">${disciplinaNombre(d)}</h3>${CATALOGO.filter(e=>e.disciplina===d).map(e=>`<div class="deliv"><div class="mono muted" style="padding-top:2px">${e.n}</div><div><div class="title">${esc(e.nombre)} ${etiquetaDoc(e, state)}</div><div class="desc">${esc(e.finalidad)}</div><details><summary>Datos de entrada y salida</summary><ul>${e.entradas.map(x=>`<li>${esc(x)}</li>`).join("")}</ul><div class="mt-1"><strong>Salida:</strong> ${esc(e.salida)}</div></details></div><div class="right"><span class="muted" style="font-size:11.5px">${e.etapas.map(x=>etapaNombre(x).replace("Ingeniería ","")).join(" · ")}</span></div></div>`).join("")}`).join("");
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
      <div class="card"><div class="card-head"><h2>Excel</h2></div><div class="card-body"><p>Celdas <span class="chip">{{proyecto}}</span> <span class="chip">{{titulo}}</span> <span class="chip">{{rev}}</span>… y fila modelo <span class="chip">{{tabla:NOMBRE}}</span> + <span class="chip">{{col:clave}}</span>. Fórmulas y totales se extienden solos.</p></div></div>
      <div class="card" style="margin-top:0"><div class="card-head"><h2>Planos (DXF)</h2></div><div class="card-body"><p>DXF R12, lámina A1 (841 × 594 mm), capas G-, I-, E- con sus colores para imprimir con tu CTB.</p></div></div>
    </div>`;
}

route();
comprobarVersion();
iniciarCopito(()=>rutaMenu.seg==="proyecto" ? { id: rutaMenu.id } : {}, ()=>{ const y = window.scrollY; return Promise.resolve(route()).then(()=>window.scrollTo(0, y)); });

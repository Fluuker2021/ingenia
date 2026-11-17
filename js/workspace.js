/* Ingenia — entorno dedicado de un entregable: solo los datos que usa ese documento, su vista previa,
   el cajetín / historial de revisiones y la plantilla con la que se descarga (por defecto o del cliente). */
import { entregable, DISCIPLINAS, TIPOS, ESTADOS } from "./catalog.js";
import * as S from "./store.js";
import { $, $$, esc, html, ICON, toast, modal, dropzone, leerComoArrayBuffer, kb, fmtFecha, spinner } from "./ui.js";
import * as X from "./export.js";
import { rellenarExcel, marcadoresExcel } from "./xlsx-engine.js";
import { formatoWord } from "./formato-doc.js";
import { DOCS, defDoc, docInfo, referenciasSugeridas, escalares, payloadExcel, tablasCargas, tablasIO, camposHD, camposHDEq, datosMemoria, generarPlano, dxfBytes, manifiesto, tablasEstandar, refDoc, tituloDoc, descargable } from "./docs.js";
import { renderEditores } from "./editores.js";
import { esPro, pantallaPro } from "./plan.js";
import { datos, calcularTablero, calcularTodos, equiposElectricos, instrumentos, r2, sistemaTag, tableros, tf, cablesFuerza, CANALIZACIONES } from "./datos.js";
import { aciCercano } from "./cad/formato.js";
import { parseDXF, boundsOf } from "./dxf.js";
import { seccionesCriteriosElectricos, seccionesCriteriosIC, seccionesMemoriaDescriptiva } from "./modules/criterios.js";
import { ENTREGABLES } from "./catalog.js";
import { montarBarraCopito } from "./copito-docs.js";

const FMT = { xlsx:"Excel", docx:"Word", dxf:"DXF (AutoCAD)", proceso:"Datos de proceso" };

export async function screenDocumento(main, state, p, id, tab, topbar){
  const e = entregable(id), def = defDoc(id);
  if(!e || !def){ location.hash = `#/proyecto/${p.id}/documentos`; return; }
  S.sincronizarDocumentos(p, ENTREGABLES);
  if(!p.documentos[id]){
    if(e.interno){ p.documentos[id] = { rev:"A", fecha:new Date().toISOString().slice(0,10), estado:"Por elaborar", titulo:e.nombre.toUpperCase() }; S.save(); }
    else { p.entregables.push(id); S.sincronizarDocumentos(p, ENTREGABLES); }
  }
  // documentos del plan Pro: sin el plan se muestra la pantalla de actualización
  if(!e.interno && !esPro(state)){ pantallaPro(main, state, p, e, topbar); return; }
  const di = docInfo(p, id);
  // todo se descarga en el formato estándar de Ingenia; la descarga se habilita en «Cajetín y revisiones»
  const tabs = def.formato==="proceso" ? [["datos","1. Datos de entrada"],["vista","2. Resumen"],["cajetin","3. Cajetín y revisiones"]]
    : def.vista3d ? [["datos","1. Datos de entrada"],["vista","2. Vista previa 2D"],["vista3d","3. Vista previa 3D"],["cajetin","4. Cajetín y descarga"]]
    : [["datos","1. Datos de entrada"],["vista","2. Vista previa"],["cajetin","3. Cajetín y descarga"]];
  tab = tabs.some(t=>t[0]===tab) ? tab : "datos";
  main.innerHTML = topbar({ crumbs:[{label:"Proyectos", href:"#/proyectos"},{label:p.nombre, href:`#/proyecto/${p.id}/documentos`},{label:e.nombre}], title:e.nombre,
    sub:`<span class="mono">Rev. ${esc(di.rev||"A")}</span><span>${esc(DISCIPLINAS[e.disciplina].nombre)} · ${esc(FMT[def.formato])}</span>`,
    actions:`<a class="btn" href="#/proyecto/${p.id}/documentos">${ICON.back} Documentos</a>` }) +
    `<div class="tabs">${tabs.map(t=>`<button data-wtab="${t[0]}" class="${t[0]===tab?"active":""}">${t[1]}</button>`).join("")}</div><div id="ws-body"></div>`;
  $$("[data-wtab]").forEach(b=>b.onclick = ()=>location.hash = `#/proyecto/${p.id}/doc/${id}/${b.dataset.wtab}`);
  const body = $("#ws-body");
  if(tab==="datos") return tabDatos(body, p, id, def);
  if(tab==="vista") return Promise.resolve(tabVista(body, state, p, id, def)).then(()=>montarBarraCopito(body, p, id));
  if(tab==="vista3d") return tabVista3D(body, p, id);
  if(tab==="cajetin") return tabCajetin(body, state, p, id, def);
}

/* ---------------- 1. datos ---------------- */
function tabDatos(body, p, id, def){
  if(!def.editores.length){ body.innerHTML = `<div class="empty"><p><strong>No requiere datos adicionales.</strong></p><p>Se arma con los datos del proyecto.</p><a class="btn btn-primary" href="#/proyecto/${p.id}/doc/${id}/vista">Ver vista previa →</a></div>`; return; }
  body.innerHTML = `<p class="ws-note">Solo los datos de este documento. Los cambios se comparten con los demás documentos del proyecto.</p><div id="eds"></div>
    <div class="row mt-2" style="justify-content:flex-end"><a class="btn btn-primary" href="#/proyecto/${p.id}/doc/${id}/vista">Ver vista previa →</a></div>`;
  renderEditores($("#eds", body), p, def.editores, id, ()=>{});
}

/* ---------------- 2. vista previa ---------------- */
async function tabVista(body, state, p, id, def){
  body.innerHTML = spinner(def.formato==="dxf" ? "Generando el plano…" : "Calculando…");
  try{
    const base = def.aliasDe || id;
    if(def.formato==="dxf") return vistaPlano(body, state, p, id);
    if(def.formato==="proceso") return vistaProceso(body, p, id);
    if(base==="ele-cargas") return vistaCargas(body, p, id);
    if(base==="ele-cables") return vistaTabla(body, p, id, "LISTADO DE CABLES", [["ÍTEM","#"],["TAG DEL CABLE","tag"],["DESDE","desde"],["HASTA","hasta"],["CALIDAD","clase"],["VOLTAJE","voltaje"],["N° COND.","conductores"],["SECCIÓN MM²","seccion"],["AWG (NEC)","awg"],["CANALIZACIÓN","canal"],["LONG. (m)","longitudTotal"],["REFERENCIA","referencia"]], cablesFuerza(p).map(c=>Object.assign({}, c, { canal: (CANALIZACIONES.find(x=>x[0]===c.canalizacion)||["","Bandeja / otros"])[1] })));
    if(base==="ele-hd") return vistaHDEq(body, p, id);
    if(base==="ele-md") return vistaMemoria(body, p, id, "md");
    if(def.secciones) return vistaTexto(body, p, id, def);
    if(base==="ele-equipos") return vistaTabla(body, p, id, "LISTADO DE EQUIPOS ELÉCTRICOS", [["ÍTEM","#"],["SISTEMA","sistema"],["CANT.","cant"],["TAG","tag"],["DESCRIPCIÓN","descripcion"],["MARCA","marca"],["MODELO","modelo"],["VOLTAJE / FRECUENCIA / FASE","tension"],["PLANO DE REFERENCIA","plano"]], equiposElectricos(p).map(f=>Object.assign({}, f, { plano: f.plano || refDoc(p, f._doc) })));
    if(base==="ins-instrumentos") return vistaTabla(body, p, id, "LISTADO DE INSTRUMENTOS", [["ÍTEM","#"],["SISTEMA","sistema"],["CANT.","cant"],["TAG","tag"],["DESCRIPCIÓN","descripcion"],["MARCA","marca"],["MODELO","modelo"],["TIPO DE SEÑAL","tipoSenal"],["SEÑAL DE SALIDA","senal"],["ALIMENTACIÓN","alimentacion"],["UBICACIÓN","ubicacion"],["HOJA DE DATOS","hojaDatos"]], instrumentos(p).map(i=>Object.assign({}, i, { sistema: i.sistema || (datos(p).sistema.nombre||"").toUpperCase(), hojaDatos: i.hojaDatos || refDoc(p,"ins-hd") })));
    if(base==="ins-io"){ const t = tablasIO(p); return vistaTabla(body, p, id, "LISTADO DE ENTRADAS Y SALIDAS (I/O)", [["ÍTEM","#"],["TAG","tag"],["TIPO E/S","tipo"],["SEÑAL","senal"],["DESCRIPCIÓN","descripcion"],["VOLTAJE / PROTOCOLO","voltaje"],["RANGO","rango"],["ALIMENTACIÓN","alimentacion"],["CONTROLADOR","tablero"],["SLOT","slot"],["CANAL","ch"],["BORNES","terminales"]], t.io,
      `<h3 class="ed-sub mt-2">Resumen de señales y módulos</h3>${tablaHTML([["TIPO","tipo"],["USADOS","usados"],["RESERVA","reserva"],["REQUERIDOS","requeridos"],["CANALES/MÓDULO","cpm"],["MÓDULOS","modulos"],["CAPACIDAD","capacidad"]], t.resumen)}`); }
    if(base==="ins-hd") return vistaHD(body, p, id);
    if(base==="ele-mc") return vistaMemoria(body, p, id);
    if(def.estandar){ const t = id==="gen-registro" ? null : tablasEstandar(p, id); if(!t){ body.innerHTML = `<div class="notice">La lista de documentos se arma con los documentos seleccionados, sus revisiones y fechas (pestaña Documentos del proyecto).</div>`; return; } const [k, tb] = Object.entries(t)[0]; return vistaTabla(body, p, id, tb.titulo.toUpperCase(), tb.columnas.map(c=>[c.titulo, c.key]), tb.filas); }
    body.innerHTML = `<div class="empty">Sin vista previa.</div>`;
  }catch(err){ console.error(err); body.innerHTML = `<div class="notice warn">No se pudo calcular la vista previa: ${esc(err.message||err)}</div>`; }
}

function cabeceraHoja(p, id, titulo){
  const di = docInfo(p, id);
  return `<div class="xl-sheet"><div class="xl-title">${esc(titulo)}</div>
    <table class="xl-head"><tr><th>Cliente</th><td>${esc(p.cliente||"")}</td><th>Fecha</th><td>${esc(fmtF(di.fecha))}</td></tr>
    <tr><th>Proyecto</th><td>${esc(p.nombre||"")}</td><th>Revisión</th><td>${esc(di.rev||"A")}</td></tr>
    <tr><th>Documento</th><td>${esc(entregable(id).nombre)}</td><th>Unidad</th><td>${esc(p.unidad||"—")}</td></tr></table>`;
}
function fmtF(f){ const m = String(f||"").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (f||""); }
/* columnas de texto descriptivo: alineadas a la izquierda; el resto de valores, centrados */
const esDescripcion = c => /^descrip|descripción/i.test(c[0]) || ["descripcion","desc"].includes(c[1]);
function tablaHTML(cols, filas, totales){
  return `<div class="table-wrap"><table class="xl-table"><thead><tr>${cols.map(c=>`<th class="${esDescripcion(c)?"izq":""}">${esc(c[0])}</th>`).join("")}</tr></thead><tbody>${filas.map((f,i)=>`<tr>${cols.map(c=>{ const v = c[1]==="#" ? i+1 : f[c[1]]; return `<td class="${typeof v==="number"?"num":""}${esDescripcion(c)?" izq":""}">${esc(v==null?"":String(v)).replace(/\n/g,"<br>")}</td>`; }).join("")}</tr>`).join("") || `<tr><td colspan="${cols.length}" class="muted" style="text-align:center;padding:16px">Sin registros — completa los datos de entrada.</td></tr>`}${totales||""}</tbody></table></div>`;
}
function vistaTabla(body, p, id, titulo, cols, filas, extra){
  body.innerHTML = cabeceraHoja(p, id, titulo) + tablaHTML(cols, filas) + (extra||"") + `</div>` + pieVista(p, id);
}
function pieVista(p, id){ return `<div class="row between mt-2" style="flex-wrap:wrap"><p class="muted" style="font-size:12px;margin:0">Vista de los valores. La descarga incluye carátula, estilos, fórmulas, logos y revisiones del formato.</p><a class="btn btn-primary" href="#/proyecto/${p.id}/doc/${id}/cajetin">Siguiente: cajetín y descarga →</a></div>`; }

function vistaCargas(body, p, id){
  const calcs = calcularTodos(p);
  const lista = calcs.length ? calcs.map(c=>c.tablero) : [tf(p)];
  body.innerHTML = lista.map(t=>{
    const tb = tablasCargas(p, t), c = tb.calc;
    const filas = tb.cargas.map(f=>Object.assign({}, f, { fp:+f.fp, eff:+f.eff }));
    const tot = `<tr class="xl-total"><td colspan="10" style="text-align:right">CARGA TOTAL</td><td class="num">${r2(c.installedKVA,2)}</td><td class="num">${r2(c.totalKVA,2)}</td></tr>`;
    return cabeceraHoja(p, id, "LISTADO DE CARGAS") +
      `<div class="xl-band">${esc(`${datos(p).sistema.nombre ? datos(p).sistema.nombre+" - " : ""}${t.nombre} ${t.tag}`.toUpperCase())}</div>` +
      tablaHTML([["ÍTEM","#"],["TAG","tag"],["DESCRIPCIÓN","descripcion"],["HP","hp"],["kW","kw"],["In (A)","_in"],["FDP","fp"],["EFF","eff"],["FU","fu"],["FS","fs"],["Potencia instalada (kVA)","_si"],["Máxima demanda (kVA)","_md"]], filas, tot) +
      `<div class="stat-row mt-2"><div class="stat"><div class="k">Potencia instalada</div><div class="v">${r2(c.installedKVA,1)} kVA</div></div><div class="stat"><div class="k">Máxima demanda</div><div class="v">${r2(c.totalKVA,1)} kVA</div></div><div class="stat"><div class="k">I máxima demanda</div><div class="v">${r2(c.demandCurrent,1)} A</div></div><div class="stat"><div class="k">Interruptor general</div><div class="v">3x${c.mainBreaker} A</div></div></div>` +
      (tb.cargas_control.length ? `<h3 class="ed-sub mt-2">Lista de cargas estabilizada</h3>` + tablaHTML([["ÍTEM","n"],["DESCRIPCIÓN","descripcion"],["FDP","fp"],["FU","fu"],["FS","fs"],["P (kW)","kw"]], tb.cargas_control) : "") + `</div>`;
  }).join('<div class="mt-2"></div>') + pieVista(p, id);
}
function vistaHDEq(body, p, id){
  const lista = tableros(p); let sel = lista[0].id;
  const render = ()=>{
    const t = lista.find(x=>x.id===sel); const c = camposHDEq(p, t);
    body.innerHTML = `<div class="row mb-2"><label class="muted">Hoja</label><select id="hd-sel">${lista.map(x=>`<option value="${x.id}" ${x.id===sel?"selected":""}>${esc(x.tag)}</option>`).join("")}</select><span class="muted">${lista.length} hoja(s) + carátula + índice</span></div>` +
      cabeceraHoja(p, id, c.titulo) + `<div class="table-wrap"><table class="xl-table"><thead><tr><th>No.</th><th class="izq">DESCRIPCIÓN</th><th>UNIDAD</th><th>INFORMACIÓN</th></tr></thead><tbody>${c.filas.map(f=> f.__var ? `<tr class="xl-sec"><td colspan="4" class="izq">${esc(f.texto)}</td></tr>` : `<tr><td class="num">${f.n}</td><td class="izq">${esc(f.desc)}</td><td>${esc(f.unidad||"")}</td><td>${esc(f.valor??"")}</td></tr>`).join("")}</tbody></table></div></div>` + pieVista(p, id);
    $("#hd-sel").onchange = e=>{ sel = e.target.value; render(); };
  };
  render();
}
function vistaProceso(body, p, id){
  const pr = datos(p).proceso; const recs = (pr.recomendados||[]);
  body.innerHTML = `<div class="doc-prev"><h3 class="ed-sub">Descripción del proceso</h3><p>${esc(pr.descripcion||"— (pendiente)")}</p>
    <h3 class="ed-sub">Equipos del proceso</h3>${tablaHTML([["TAG","tag"],["TIPO","tipo"],["DESCRIPCIÓN","descripcion"]], pr.equipos||[])}
    <h3 class="ed-sub mt-2">Instrumentos recomendados</h3>${tablaHTML([["TAG","tag"],["INSTRUMENTO","descripcion"],["SERVICIO","servicio"],["SEÑAL","senal"],["APROBADO","ap"]], recs.map(r=>Object.assign({}, r, { ap: r.aprobado ? "Sí" : "—" })))}
    <div class="notice mt-2">El dibujo del P&amp;ID en DXF está en desarrollo. Los instrumentos aprobados pasan al listado de instrumentos.</div></div>`;
}

async function vistaHD(body, p, id){
  const lista = instrumentos(p).filter(i=>i.tag);
  if(!lista.length){ body.innerHTML = `<div class="empty">Sin instrumentos. Complétalos en <a href="#/proyecto/${p.id}/doc/${id}/datos">Datos de entrada</a>.</div>`; return; }
  let sel = lista[0].tag;
  const render = async ()=>{
    const inst = lista.find(i=>i.tag===sel); const c = await camposHD(p, inst);
    body.innerHTML = `<div class="row mb-2"><label class="muted">Hoja</label><select id="hd-sel">${lista.map(i=>`<option ${i.tag===sel?"selected":""}>${esc(i.tag)}</option>`).join("")}</select><span class="muted">${lista.length} hoja(s) + carátula + índice</span></div>` +
      cabeceraHoja(p, id, c.titulo) + `<div class="table-wrap"><table class="xl-table"><thead><tr><th>No.</th><th class="izq">DESCRIPCIÓN</th><th>UNIDAD</th><th>INFORMACIÓN</th><th>NOTAS</th></tr></thead><tbody>${c.filas.map(f=> f.__var ? `<tr class="xl-sec"><td colspan="5" class="izq">${esc(f.texto)}</td></tr>` : `<tr><td class="num">${f.n}</td><td class="izq">${esc(f.desc)}</td><td>${esc(f.unidad)}</td><td>${esc(f.valor??"")}</td><td>${esc(f.nota||"")}</td></tr>`).join("")}</tbody></table></div></div>` + pieVista(p, id);
    $("#hd-sel").onchange = e=>{ sel = e.target.value; render(); };
  };
  render();
}

function vistaMemoria(body, p, id, tipo){
  const m = datosMemoria(p);
  const md = `<h3 class="ed-sub">${tipo==="md" ? "Anexo A" : "Resumen"} — Máxima demanda</h3>${tablaHTML([["Ítem","n"],["Tag","tag"],["Descripción","descripcion"],["P (kW)","kw"],["cos φ","fp"],["η","eff"],["Potencia instalada (kVA)","si"],["FU","fu"],["FS","fs"],["Máxima demanda (kVA)","md"],["In (A)","in"]], m.anexo_md)}`;
  const cond = `<h3 class="ed-sub mt-2">Anexo A — Conductores</h3>${tablaHTML([["Circ.","circuito"],["Hasta","hasta"],["In (A)","i"],["Id (A)","id"],["L (m)","l"],["Calibre","calibre"],["Iadm (A)","iadm"],["KT","ktot"],["Ic (A)","icorr"],["ΔV (%)","dv_pct"],["EGC","egc"],["Referencia","modelo"]], m.anexo_cables)}
    <h3 class="ed-sub mt-2">Anexo B — Protecciones</h3>${tablaHTML([["Circ.","circuito"],["Descripción","descripcion"],["In (A)","i"],["Tipo","tipo"],["Dispositivo","modelo"],["Ajuste","iprot"]], m.anexo_prot)}`;
  body.innerHTML = `<div class="doc-prev"><div class="doc-cover"><div class="muted">${esc(p.cliente||"")}</div><h2>${esc(tituloDoc(p,id))}</h2></div>
    <div class="stat-row"><div class="stat"><div class="k">Potencia instalada</div><div class="v">${m.pi_total} kVA</div></div><div class="stat"><div class="k">Máxima demanda</div><div class="v">${m.md_total} kVA</div></div><div class="stat"><div class="k">I máx. demanda</div><div class="v">${m.i_md_total} A</div></div><div class="stat"><div class="k">Interruptor general</div><div class="v" style="font-size:14px">${esc(m.itm_general)}</div></div></div>
    ${tipo==="md" ? md : cond}
    <p class="muted mt-2" style="font-size:12px">El Word incluye además generalidades, normas, procedimiento, cálculo por ${tipo==="md" ? "tablero y carga" : "cable y protección"} e índice.</p></div>` + pieVista(p, id);
}
function vistaTexto(body, p, id, def){
  const secs = def.secciones(p);
  // bloques en orden ({p} párrafo, {b} viñeta, {b2} sub-viñeta, {t} subtítulo), tablas con su título y figura (SVG generado)
  const bloques = bs => { let h = "", ul = 0; for(const b of bs||[]){ const n = b.b!=null ? 1 : b.b2!=null ? 2 : 0; while(ul>n){ h += "</ul>"; ul--; } while(ul<n){ h += `<ul${ul?' style="margin:2px 0"':""}>`; ul++; } h += n ? `<li>${esc(n===1?b.b:b.b2)}</li>` : b.t!=null ? `<p style="margin:10px 0 4px"><strong>${esc(b.t)}</strong></p>` : `<p>${esc(b.p)}</p>`; } return h + "</ul>".repeat(ul); };
  const tabla = t => `${tablaHTML(t.columnas, t.filas)}${t.titulo?`<p class="muted" style="text-align:center;font-size:12px;font-style:italic;margin:4px 0 14px">${esc(t.titulo)}</p>`:""}`;
  body.innerHTML = `<div class="doc-prev">${secs.map(s=>`<h3 class="ed-sub"${s.nivel>1?` style="font-size:${s.nivel>2?"11px":"11.5px"};margin-left:${(s.nivel-1)*10}px"`:""}>${esc(s.titulo)}</h3>${s.texto?`<p>${esc(s.texto)}</p>`:""}${bloques(s.bloques)}${(s.items||[]).length?`<ul>${s.items.map(i=>`<li>${esc(i)}</li>`).join("")}</ul>`:""}${(s.tablas||[]).map(tabla).join("")}${s.figura?`<div style="margin:10px 0;overflow-x:auto">${s.figura.replace("<svg ", '<svg style="width:100%;height:auto;max-width:900px;display:block;margin:0 auto" ')}</div>${s.pieFigura?`<p class="muted" style="text-align:center;font-size:12px;font-style:italic">${esc(s.pieFigura)}</p>`:""}`:""}${bloques(s.despues)}`).join("")}</div>` + pieVista(p, id);
}

/* visor de planos con zoom y desplazamiento */
async function vistaPlano(body, state, p, id){
  const org = await orgConLogo(state);
  const r = await generarPlano(p, id, org, await logosPlano(org, p));
  const d = parseDXF(r.dxf);
  const hojas = r.hojas||1;
  body.innerHTML = `<div class="row between mb-2"><div class="row">${hojas>1?`<label class="muted">Hoja</label><select id="pl-h">${Array.from({length:hojas},(_,i)=>`<option value="${i}">${i+1} de ${hojas}</option>`).join("")}</select>`:""}
      <button class="btn-sm" id="pl-fit">Ajustar</button><span class="muted" style="font-size:12px">Rueda del ratón: zoom · arrastrar: desplazar</span></div>
      <span class="muted">${hojas} lámina(s) A1 · ${d.entities.length} entidades · capas: ${Object.keys(d.layers).length}</span></div>
    ${Array.isArray(r.avisos) ? (r.avisos.length ? `<div class="notice warn mb-2"><strong>Revisión de continuidad y referencias cruzadas:</strong><br>${r.avisos.map(esc).join("<br>")}</div>`
      : `<p class="muted mb-2" style="font-size:12px">✓ Revisión de continuidad: todos los conductores llegan a un borne o a otro conductor, cada flecha tiene su referencia cruzada a la hoja y zona donde continúa, y los equipos del unifilar están en el plano.</p>`) : ""}
    <div class="plano-view"><canvas id="pl-cv"></canvas></div>
    <div class="row between mt-2" style="flex-wrap:wrap"><p class="muted" style="font-size:12px;margin:0">DXF R12 · capas ${defDoc(id).vista3d ? "M- (gabinete, placas, canaletas, equipos, cobre, tierra, cableado, cotas)" : "G-, I-, E-"} con sus colores${r.lazos!=null?` · ${r.lazos} lazo(s)`:""}.</p>${defDoc(id).vista3d ? `<a class="btn btn-primary" href="#/proyecto/${p.id}/doc/${id}/vista3d">Siguiente: vista previa 3D →</a>` : `<a class="btn btn-primary" href="#/proyecto/${p.id}/doc/${id}/cajetin">Siguiente: cajetín y descarga →</a>`}</div>`;
  const cv = $("#pl-cv");
  const view = { hoja:0 };
  const fit = ()=>{ const b = { minX: view.hoja*1000, minY:0, maxX: view.hoja*1000+841, maxY:594 }; view.b = b; view.s = null; dibujar(); };
  const dibujar = ()=>{
    const W = cv.clientWidth*2, H = Math.round(W*594/841);
    cv.width = W; cv.height = H; cv.style.height = (H/2)+"px";
    const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0,0,W,H);
    const b = view.b; const s = view.s || Math.min(W/(b.maxX-b.minX), H/(b.maxY-b.minY)); view.s = s;
    if(view.ox==null){ view.ox = -b.minX*s; view.oy = H + b.minY*s; }
    const X = x=>view.ox + x*s, Y = y=>view.oy - y*s;
    ctx.lineWidth = 1; ctx.strokeStyle = "#1b2a3c"; ctx.fillStyle = "#1b2a3c";
    const col = l=>({ "I-SE-ANALO":"#1d6fb8","I-PROTOCOL":"#1d6fb8","I-FZA-AC":"#b8336a","E-FZA-BT-PRI":"#b8336a","E-FZA":"#b8336a","I-FZA-DC":"#7a4fbf","I-TIERRA":"#2e8b57","E-TIERRA":"#2e8b57","I-CONTROL":"#c27c0e","E-CONTROL":"#c27c0e",
      "M-COBRE":"#c0661f","M-TIERRA":"#2e8b57","M-CABLE":"#a23b72","M-COTA":"#1d6fb8","M-ETIQUETA":"#9a6a00","M-SENAL":"#c99a00","M-CANALETA":"#7b8490","M-RIEL":"#8a93a0","M-PLACA":"#7b8490","M-DETALLE":"#5b6573","M-OCULTO":"#9aa3ae" }[l] || "#1b2a3c");
    for(const e of d.entities){
      ctx.strokeStyle = col(e.layer);
      if(e.t==="L"){ ctx.beginPath(); ctx.moveTo(X(e.x1),Y(e.y1)); ctx.lineTo(X(e.x2),Y(e.y2)); ctx.stroke(); }
      else if(e.t==="C"){ ctx.beginPath(); ctx.arc(X(e.cx),Y(e.cy),e.r*s,0,Math.PI*2); ctx.stroke(); }
      else if(e.t==="A"){ ctx.beginPath(); ctx.arc(X(e.cx),Y(e.cy),e.r*s,-e.a2*Math.PI/180,-e.a1*Math.PI/180); ctx.stroke(); }
      else if(e.t==="P"){ ctx.beginPath(); e.pts.forEach((q,i)=>i?ctx.lineTo(X(q[0]),Y(q[1])):ctx.moveTo(X(q[0]),Y(q[1]))); if(e.closed) ctx.closePath(); ctx.stroke(); }
      else if(e.t==="S"){ ctx.beginPath(); const o=[e.pts[0],e.pts[1],e.pts[3],e.pts[2]]; o.forEach((q,i)=>i?ctx.lineTo(X(q[0]),Y(q[1])):ctx.moveTo(X(q[0]),Y(q[1]))); ctx.closePath(); ctx.fill(); }
      else if(e.t==="T" && e.text){
        const fs = e.h*s*1.15; if(fs<1.2) continue;
        ctx.save(); ctx.translate(X(e.x),Y(e.y)); ctx.rotate(-(e.rot||0)*Math.PI/180); ctx.font = `${fs}px "IBM Plex Sans Condensed", Arial Narrow, Arial, sans-serif`;
        ctx.textAlign = e.align===1 ? "center" : e.align===2 ? "right" : "left";
        ctx.textBaseline = e.valign===3 ? "top" : e.valign===2 ? "middle" : e.valign===1 ? "bottom" : "alphabetic";
        ctx.fillText(e.text.replace(/%%[dD]/g,"°").replace(/%%[cC]/g,"Ø").replace(/%%[uUoO]/g,""), 0, 0); ctx.restore();
      }
    }
  };
  view.b = { minX:0, minY:0, maxX:841, maxY:594 }; view.ox = null;
  const reset = ()=>{ view.ox = null; view.s = null; view.b = { minX: view.hoja*1000, minY:0, maxX: view.hoja*1000+841, maxY:594 }; dibujar(); };
  reset();
  $("#pl-fit").onclick = reset;
  const hs = $("#pl-h"); if(hs) hs.onchange = ()=>{ view.hoja = +hs.value; reset(); };
  cv.addEventListener("wheel", ev=>{ ev.preventDefault(); const r0 = cv.getBoundingClientRect(); const mx = (ev.clientX-r0.left)*2, my = (ev.clientY-r0.top)*2; const k = ev.deltaY<0 ? 1.2 : 1/1.2; view.ox = mx - (mx-view.ox)*k; view.oy = my - (my-view.oy)*k; view.s *= k; dibujar(); }, { passive:false });
  let drag = null;
  cv.addEventListener("mousedown", ev=>{ drag = { x:ev.clientX, y:ev.clientY, ox:view.ox, oy:view.oy }; cv.style.cursor = "grabbing"; });
  window.addEventListener("mouseup", ()=>{ drag = null; cv.style.cursor = ""; });
  cv.addEventListener("mousemove", ev=>{ if(!drag) return; view.ox = drag.ox + (ev.clientX-drag.x)*2; view.oy = drag.oy + (ev.clientY-drag.y)*2; dibujar(); });
  // doble clic sobre un TAG del plano: Copito se abre con ese equipo para pedir el cambio
  cv.addEventListener("dblclick", ev=>{
    const r0 = cv.getBoundingClientRect(); const mx = (ev.clientX-r0.left)*2, my = (ev.clientY-r0.top)*2;
    const x = (mx - view.ox)/view.s, y = (view.oy - my)/view.s;
    let mejor = null, dm = 1e9;
    for(const e of d.entities){ if(e.t!=="T" || !e.text) continue; const tx = String(e.text).trim();
      if(!/^-?[A-Z]{1,6}\d*[-.]?\d+[A-Z]?(\.\d+)?$|^[A-Z]{1,5}-\d{2,4}[A-Z]?$/.test(tx)) continue;
      const w = tx.length*e.h*0.6, cx = e.x + (e.align===1 ? 0 : e.align===2 ? -w/2 : w/2), dd = Math.hypot(cx - x, e.y - y);
      if(dd < dm){ dm = dd; mejor = tx.replace(/^-/, ""); } }
    if(mejor && dm < 12 && window.copito) window.copito.abrir(`En ${entregable(id).nombre}, para ${mejor}, `, false);
  });
}

/* ---------------- vista previa 3D (plano mecánico del tablero) ---------------- */
async function tabVista3D(body, p, id){
  body.innerHTML = spinner("Armando el tablero en 3D…");
  try{
    // plano mecánico del tablero de control: sus propios arreglos (PLC, relés, borneras); el de fuerza, los de fuerza
    const ctl = id==="ins-mecanico-tc";
    const lista = ctl ? (await import("./mecanico/arreglo-control.js")).arreglosControl(p) : (await import("./mecanico/arreglo.js")).arreglosProyecto(p);
    if(!lista.length){ body.innerHTML = ctl ? `<div class="empty">El proyecto no tiene tableros de control. Agrégalos en <a href="#/proyecto/${p.id}/diseno">Datos generales</a>.</div>` : `<div class="empty">No hay tableros de fuerza con cargas. Agrégalas en el <a href="#/proyecto/${p.id}/doc/ele-cargas/datos">listado de cargas</a>.</div>`; return; }
    const sel = lista.find(m=>m.tablero.id===body.dataset.t) || lista[0];
    const t = sel.tablero;
    const chips = ctl ? [`Cambia el gabinete de ${t.tag} a ${sel.montaje==="mural" ? (sel.W===800 && sel.H===1000 ? "1000x1200x300" : "800x1000x300") : (sel.W===800 ? "1000x2000x400" : "800x2000x500")}`, `Cambia la entrada de cables de ${t.tag} a ${sel.entrada==="inferior" ? "superior" : "inferior"}`, `Pon ventilación ${sel.puerta.some(d=>d.tipo==="ventilador") ? "natural" : "forzada"} en ${t.tag}`,
      ...(sel.comps.some(c=>c.tag==="PS1") ? [`Mueve PS1 de ${t.tag} a la derecha`] : []), ...(sel.comps.filter(c=>c.tipo==="rele").length > 1 ? [`Intercambia CR1 con CR2 en ${t.tag}`] : []), `${sel.puerta.some(d=>d.tipo==="luz") ? "Quita" : "Agrega"} los mandos en la puerta de ${t.tag}`] : [`Cambia la entrada de cables de ${t.tag} a ${sel.entrada==="inferior" ? "superior" : "inferior"}`, `Cambia la reserva de espacio de ${t.tag} a 30 %`, `Cambia el alto del gabinete de ${t.tag} a ${sel.H>=2200 ? 2000 : 2200} mm`, `Pon ventilación ${sel.termico.modo==="forzada" ? "natural" : "forzada"} en ${t.tag}`, `${sel.puerta.some(d=>d.tipo==="pulsador") ? "Quita" : "Agrega"} los mandos en la puerta de ${t.tag}`];
    body.innerHTML = `<div class="row between mb-2" style="flex-wrap:wrap;gap:8px"><div class="row">${lista.length>1 ? `<label class="muted">Tablero</label><select id="v3-t">${lista.map(m=>`<option value="${m.tablero.id}" ${m===sel?"selected":""}>${esc(m.tablero.tag)} — ${esc(m.tablero.nombre||"")}</option>`).join("")}</select>` : `<strong>${esc(t.tag)}</strong><span class="muted">${esc(t.nombre||"")}</span>`}</div>
        <span class="muted" style="font-size:12.5px">Gabinete ${sel.W} × ${sel.H} × ${sel.D} mm · ${sel.secciones.length} sección(es) · ${sel.comps.filter(c=>c.tag).length} equipos · ventilación ${esc(sel.termico.modo)}</span></div>
      ${sel.avisos.length ? `<div class="notice warn mb-2">${sel.avisos.map(esc).join("<br>")}</div>` : ""}
      <div id="v3-cont"></div>
      <div class="v3d-copito-bar mt-2"><div><strong>Cambios con Copito</strong><span class="muted"> · Copito propone el cambio, lo aplicas al confirmar y el 2D, el 3D y la lista de materiales se actualizan.</span></div>
        <div class="v3d-chips"><button class="btn-sm btn-accent" data-cp="">Pedir un cambio a Copito…</button><button class="btn-sm" data-cp="¿Qué puedo hacer en este documento?">¿Qué puedo pedirle?</button></div></div>
      <div class="row between mt-2" style="flex-wrap:wrap"><p class="muted" style="font-size:12px;margin:0">El 3D usa las mismas dimensiones y posiciones del plano 2D. La descarga del CAD es la del plano 2D.</p><a class="btn btn-primary" href="#/proyecto/${p.id}/doc/${id}/cajetin">Siguiente: cajetín y descarga →</a></div>`;
    const ts = $("#v3-t"); if(ts) ts.onchange = ()=>{ body.dataset.t = ts.value; tabVista3D(body, p, id); };
    const pedir = (txt, enviar)=>{ if(window.copito) window.copito.abrir(txt, enviar); else toast("Copito no está disponible", true); };
    $$("[data-cp]", body).forEach(b=>b.onclick = ()=>b.dataset.cp ? pedir(b.dataset.cp, true) : pedir(`En ${t.tag}, `, false));
    $("#v3-cont").innerHTML = spinner("Cargando el visor 3D…");
    const { visor3D } = await import("./mecanico/visor3d.js");
    await visor3D($("#v3-cont"), sel, { copito:(d, m)=>pedir(`En ${m.tablero.tag}${d.tag ? `, para ${d.tag}` : ""}, `, false) });
  }catch(err){ console.error(err); body.innerHTML = `<div class="notice warn">No se pudo armar la vista 3D: ${esc(err.message||err)}</div>`; }
}

/* ---------------- 3. cajetín y revisiones ---------------- */
function tabCajetin(body, state, p, id, def){
  const d = p.documentos[id]; docInfo(p, id);
  const org = state.org;
  const render = ()=>{
    body.innerHTML = html`<div class="grid-2">
      <div class="card"><div class="card-head"><h2>Identificación</h2><span class="muted" style="font-size:12px">Firmas vacías = las de <a href="#/organizacion">tu organización</a></span></div><div class="card-body">
        <div class="field"><label>Título</label><input type="text" data-f="titulo" value="${esc(d.titulo||"")}">${sistemaTag(p) ? `<span class="hint">Se completa con «- TAG: ${esc(sistemaTag(p))}».</span>` : ""}</div>
        <div class="grid-3">
          <div class="field"><label>Elaboró / diseñó</label><input type="text" data-f="elaboro" value="${esc(d.elaboro||"")}" placeholder="${esc(org.elaboraPor||"")}"></div>
          <div class="field"><label>Revisó</label><input type="text" data-f="reviso" value="${esc(d.reviso||"")}" placeholder="${esc(org.revisaPor||"")}"></div>
          <div class="field"><label>Aprobó</label><input type="text" data-f="aprobo" value="${esc(d.aprobo||"")}" placeholder="${esc(org.apruebaPor||"")}"></div>
        </div>
        ${def.formato==="dxf" ? `<div class="field"><label>Dibujó</label><input type="text" data-f="dibujo" value="${esc(d.dibujo||"")}" placeholder="${esc(org.dibujaPor||org.elaboraPor||"")}"></div>` : ""}
        <div class="field"><label>Estado</label><select data-f="estado">${["Por elaborar","En elaboración","Para revisión","Aprobado","Emitido"].map(o=>`<option ${d.estado===o?"selected":""}>${o}</option>`).join("")}</select></div>
      </div></div>
      <div class="card"><div class="card-head"><h2>Historial de revisiones</h2><button class="btn-sm" id="rv-add">${ICON.plus} Nueva revisión</button></div><div class="card-body">
        <div class="table-wrap"><table><thead><tr><th>Rev.</th><th>Fecha</th><th>Descripción / emitido para</th><th></th></tr></thead><tbody>
        ${d.revisiones.map((r,i)=>`<tr data-r="${i}"><td><input type="text" data-rv="rev" value="${esc(r.rev)}" style="width:50px"></td><td><input type="date" data-rv="fecha" value="${esc(r.fecha)}"></td><td><select data-rv="descripcion">${["Emitido para revisión interna","Emitido para revisión del cliente","Emitido para aprobación","Emitido para construcción","Conforme a obra"].concat(r.descripcion && !/^Emitido|^Conforme/.test(r.descripcion)?[r.descripcion]:[]).map(o=>`<option ${r.descripcion===o?"selected":""}>${esc(o)}</option>`).join("")}</select></td><td>${d.revisiones.length>1?`<button class="btn-ghost btn-sm" data-rdel>${ICON.trash}</button>`:""}</td></tr>`).join("")}
        </tbody></table></div><p class="muted mt-1" style="font-size:12px">La última fila es la vigente. Para emitir varios documentos a la vez usa «Emitir revisión» en Documentos.</p></div></div>
    </div>
    ${def.formato==="dxf" ? `<div class="card mt-2"><div class="card-head"><h2>Planos de referencia (cajetín)</h2><button class="btn-sm" id="rf-auto">Volver a sugerir</button></div><div class="card-body" id="refs"></div></div>` : ""}
    ${descargable(id) ? `<div class="card mt-2 ws-descarga"><div class="card-body row between" style="flex-wrap:wrap"><div><h2 style="font-size:15px">Descargar el documento</h2><div class="muted" style="font-size:12.5px;margin-top:3px">Con los datos de entrada, la vista previa y el cajetín de esta pantalla, en el formato estándar de Ingenia.</div></div><button class="btn-accent" id="ws-dl">${ICON.download} Descargar ${FMT[def.formato]}</button></div></div>` : ""}`;
    const wdl = $("#ws-dl", body); if(wdl) wdl.onclick = ()=>descargarDoc(state, p, id, wdl);
    $$("[data-f]", body).forEach(i=>i.onchange = ()=>{ d[i.dataset.f] = i.value; S.save(); });
    $$("[data-rv]", body).forEach(i=>i.onchange = ()=>{ d.revisiones[+i.closest("tr").dataset.r][i.dataset.rv] = i.value; S.save(); });
    $$("[data-rdel]", body).forEach(b=>b.onclick = ()=>{ d.revisiones.splice(+b.closest("tr").dataset.r, 1); S.save(); render(); });
    $("#rv-add").onclick = ()=>{ const last = d.revisiones[d.revisiones.length-1]; const sig = nextRev(last.rev); d.revisiones.push({ rev:sig, fecha:new Date().toISOString().slice(0,10), descripcion: /^\d+$/.test(sig) ? "Emitido para construcción" : "Emitido para revisión del cliente" }); S.save(); render(); };
    if(def.formato==="dxf"){
      const rf = $("#refs");
      const draw = ()=>{ rf.innerHTML = `${d.referencias.map((r,i)=>`<div class="row mb-1" data-i="${i}"><input type="text" data-rf="titulo" value="${esc(r.titulo)}" style="flex:1" placeholder="Título del plano o documento de referencia"><button class="btn-ghost btn-sm" data-rfdel>${ICON.trash}</button></div>`).join("")}<button class="btn-sm" id="rf-add">${ICON.plus} Agregar</button>`;
        $$("[data-rf]", rf).forEach(i=>i.onchange = ()=>{ d.referencias[+i.closest("[data-i]").dataset.i][i.dataset.rf] = i.value; S.save(); });
        $$("[data-rfdel]", rf).forEach(b=>b.onclick = ()=>{ d.referencias.splice(+b.closest("[data-i]").dataset.i,1); S.save(); draw(); });
        $("#rf-add", rf).onclick = ()=>{ if(d.referencias.length<5){ d.referencias.push({codigo:"",titulo:""}); S.save(); draw(); } }; };
      const sugerir = ()=>{ d.referencias = referenciasSugeridas(p, id); S.save(); draw(); };
      if(!Array.isArray(d.referencias)) sugerir(); else draw();   // primera vez: se proponen solas
      $("#rf-auto").onclick = ()=>{ sugerir(); toast(d.referencias.length ? "Referencias sugeridas" : "No hay documentos relacionados en el proyecto"); };
    }
  };
  render();
}
export function nextRev(r){ if(/^\d+$/.test(r)) return String(+r+1); if(/^[A-Y]$/i.test(r)) return String.fromCharCode(r.toUpperCase().charCodeAt(0)+1); return "0"; }

/* ---------------- descarga ---------------- */
export async function orgConLogo(state){
  const o = Object.assign({}, state.org);
  if(o.logo){ const f = await S.leerArchivo(o.logo); if(f) o.logoDataURL = await S.blobToDataURL(f.blob); }
  return o;
}
async function logoPNG(dataURL){
  if(!dataURL) return null;
  return new Promise(res=>{ const im = new Image(); im.onload = ()=>{ const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext("2d").drawImage(im,0,0); res({ dataURL: c.toDataURL("image/png"), aspect: im.naturalWidth/Math.max(1,im.naturalHeight) }); }; im.onerror = ()=>res(null); im.src = dataURL; });
}
/* logo → raster por tramos de color ACI para dibujarlo con SOLID en el DXF R12 */
async function logoRaster(dataURL, maxW=150, maxH=56){
  if(!dataURL) return null;
  return new Promise(res=>{ const im = new Image(); im.onload = ()=>{
    const k = Math.min(maxW/im.naturalWidth, maxH/im.naturalHeight, 1); const w = Math.max(1, Math.round(im.naturalWidth*k)), h = Math.max(1, Math.round(im.naturalHeight*k));
    const c = document.createElement("canvas"); c.width = w; c.height = h; const ctx = c.getContext("2d"); ctx.drawImage(im, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data; const runs = [];
    for(let y=0;y<h;y++){ let cur = null;
      for(let x=0;x<w;x++){ const i = (y*w+x)*4; const a = px[i+3], r = px[i], g = px[i+1], b = px[i+2];
        const col = (a<128 || (r>232 && g>232 && b>232)) ? 0 : aciCercano(r, g, b);
        if(cur && cur[3]===col && col){ cur[2] = x; continue; }
        if(cur && cur[3]) runs.push(cur); cur = col ? [y, x, x, col] : null; }
      if(cur && cur[3]) runs.push(cur); }
    res(runs.length ? { w, h, runs } : null); }; im.onerror = ()=>res(null); im.src = dataURL; });
}
async function logosPlano(org, p){
  let cliente = null;
  if(p.plantillas && p.plantillas.logo_cliente){ const f = await S.leerArchivo(p.plantillas.logo_cliente); if(f) cliente = await logoRaster(await S.blobToDataURL(f.blob)); }
  return { org: await logoRaster(org.logoDataURL), cliente };
}
async function logoCliente(p){ if(!p.plantillas || !p.plantillas.logo_cliente) return null; const f = await S.leerArchivo(p.plantillas.logo_cliente); return f ? await logoPNG(await S.blobToDataURL(f.blob)) : null; }

export async function descargarDoc(state, p, id, btn){
  const def = defDoc(id), e = entregable(id);
  const lbl = btn ? btn.innerHTML : ""; if(btn){ btn.disabled = true; btn.textContent = "Generando…"; }
  try{
    const org = await orgConLogo(state);
    const di = docInfo(p, id);
    const nombre = ext => X.nombreSeguro(`${p.nombre||"Proyecto"} - ${e.nombre} - Rev ${di.rev||"A"}`)+"."+ext;
    const dd = p.documentos[id];
    const tplCli = null;   // los documentos se descargan siempre en el formato estándar de Ingenia
    if(def.formato==="dxf"){
      const r = await generarPlano(p, id, org, await logosPlano(org, p));
      X.descargar(new Blob([dxfBytes(r.dxf)], { type:"application/dxf" }), nombre("dxf"), "application/dxf");
    } else if(def.formato==="proceso"){ toast("Este entorno no genera archivo: alimenta el listado de instrumentos."); return;
    } else if(def.estandar || (def.texto && !tplCli)){
      // formatos estándar previos (lista de documentos, cables, criterios)
      const ctx = { scal: escalares(p, id, org), logos: { org: await logoPNG(org.logoDataURL), cliente: await logoCliente(p) }, org, proyecto:{ nombre:p.nombre, cliente:p.cliente, unidad:p.unidad, codigo:"", etapaNombre:"" }, doc:{ codigo:"", titulo:tituloDoc(p,id), rev:di.rev, fecha:di.fecha, disciplina:DISCIPLINAS[e.disciplina].nombre, emitidoPara:di.emitido, referencia:p.pidRef||"" }, revisiones: di.revisiones.map(r=>Object.assign({ elaboro:di.elaboro||org.elaboraPor, reviso:di.reviso||org.revisaPor, aprobo:di.aprobo||org.apruebaPor }, r)), tablas:{}, campos:{} };
      if(false){
      } else if(id==="gen-registro"){
        const filas = p.entregables.map(entregable).filter(Boolean).map((x,i)=>{ const d=p.documentos[x.id]||{}; return { item:i+1, titulo:x.nombre, disciplina:DISCIPLINAS[x.disciplina].nombre, tipo:TIPOS[x.tipo], rev:d.rev, fecha:d.fecha, emitido:d.emitido||"", estado:d.estado }; });
        ctx.tablas = { "Lista de documentos": { titulo:"Lista de documentos / entregables", columnas:[{key:"item",titulo:"Ítem",ancho:6,num:true},{key:"titulo",titulo:"Documento",ancho:56},{key:"disciplina",titulo:"Disciplina",ancho:22},{key:"tipo",titulo:"Tipo",ancho:18},{key:"rev",titulo:"Rev.",ancho:6,center:true},{key:"fecha",titulo:"Fecha",ancho:12},{key:"emitido",titulo:"Emitido para",ancho:26},{key:"estado",titulo:"Estado",ancho:14}], filas } };
        X.descargar(await X.excelEstandar(ctx), nombre("xlsx"), X.MIME.xlsx);
      } else {
        ctx.tablas = tablasEstandar(p, id);
        X.descargar(await X.excelEstandar(ctx), nombre("xlsx"), X.MIME.xlsx);
      }
    } else if(def.formato==="xlsx"){
      const pay = await payloadExcel(p, id, org);
      const buf = tplCli ? await tplCli.blob.arrayBuffer() : await (await fetch("assets/plantillas/"+def.plantilla)).arrayBuffer();
      const man = tplCli ? {} : ((await manifiesto())[def.man] || {});
      const logos = { org: await logoPNG(org.logoDataURL), cliente: await logoCliente(p) };
      const out = await rellenarExcel(window.ExcelJS, buf, Object.assign({}, pay, { manifiesto: man, logos, estandar: !tplCli }));
      X.descargar(out, nombre("xlsx"), X.MIME.xlsx);
    } else if(def.formato==="docx"){
      const base = def.aliasDe || id;
      const extra = (base==="ele-mc" || base==="ele-md") ? datosMemoria(p) : def.datos ? def.datos(p) : def.secciones ? { secciones: def.secciones(p) } : {};
      const scal = escalares(p, id, org);
      const data = Object.assign({}, scal, { cliente_corto:(p.cliente||"").toUpperCase(), numero_proyecto:"", orden_compra:p.ordenCompra||"", revisiones: di.revisiones.map(r=>({ rev:r.rev, fecha:fmtF(r.fecha), descripcion:r.descripcion, elaboro:r.elaboro||scal.elaboro, reviso:r.reviso||scal.reviso, aprobo:r.aprobo||scal.aprobo })) }, extra);
      delete data._calc;
      let buf = tplCli ? await tplCli.blob.arrayBuffer() : await (await fetch("assets/plantillas/"+def.plantilla)).arrayBuffer();
      const zip = new PizZip(buf);
      if(def.preparar) await def.preparar(zip, p);   // p. ej. figura de la arquitectura de control
      const doc = new window.docxtemplater(zip, { paragraphLoop:true, linebreaks:true, nullGetter:()=>"" });
      doc.render(data);
      // formato estándar (igual al de los Excel): carátula con logo, cuadro de revisiones al pie, encabezado y pie de página
      if(!tplCli) formatoWord(doc.getZip(), scal, { org: await logoPNG(org.logoDataURL), cliente: await logoCliente(p) });
      X.descargar(doc.getZip().generate({ type:"arraybuffer", compression:"DEFLATE", mimeType:X.MIME.docx }), nombre("docx"), X.MIME.docx);
    }
    if(dd.estado==="Por elaborar"){ dd.estado = "En elaboración"; S.save(); }
    toast("Documento generado: "+e.nombre);
  }catch(err){
    console.error(err);
    const msg = err.properties && err.properties.errors ? err.properties.errors.map(x=>x.properties.explanation).slice(0,3).join(" · ") : (err.message||String(err));
    toast("No se pudo generar: "+msg, true, 8000);
  }finally{ if(btn){ btn.disabled = false; btn.innerHTML = lbl; } }
}


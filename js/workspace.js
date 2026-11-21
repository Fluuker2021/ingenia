/* Ingenia — entorno dedicado de un entregable: solo los datos que usa ese documento, su vista previa,
   el cajetín / historial de revisiones y la plantilla con la que se descarga (por defecto o del cliente). */
import { entregable, DISCIPLINAS, TIPOS, ESTADOS, sincronizarEstado, nombreEntregable, finalidadEntregable } from "./catalog.js";
import * as S from "./store.js";
import { $, $$, esc, html, ICON, toast, modal, dropzone, leerComoArrayBuffer, kb, fmtFecha, spinner } from "./ui.js";
import * as X from "./export.js";
import { rellenarExcel, marcadoresExcel } from "./xlsx-engine.js";
import { formatoWord } from "./formato-doc.js";
import { DOCS, defDoc, docInfo, referenciasSugeridas, escalares, payloadExcel, tablasCargas, cargasTableroControl, tablasIO, camposHD, camposHDEq, datosMemoria, generarPlano, tablerosDePlano, dxfBytes, manifiesto, tablasEstandar, refDoc, tituloDoc, descargable } from "./docs.js";
import { renderEditores } from "./editores.js";
import { esPro, pantallaPro } from "./plan.js";
import { datos, calcularTablero, calcularTodos, equiposElectricos, instrumentos, r2, tableros, tablerosControl, tf, cablesFuerza, CANALIZACIONES } from "./datos.js";
import { aciCercano } from "./cad/formato.js";
import { parseDXF, boundsOf, colorCapa, rgbACI } from "./dxf.js";
import { corregir } from "./ortografia.js";
import { seccionesCriteriosElectricos, seccionesCriteriosIC, seccionesMemoriaDescriptiva } from "./modules/criterios.js";
import { ENTREGABLES } from "./catalog.js";
import { listadoEquipos } from "./modules/equipos-lista.js";
import { montarBarraCopito } from "./copito-docs.js";
import { cargarBase } from "./mecanico/biblioteca.js";

const FMT = { xlsx:"Excel", docx:"Word", dxf:"DXF (AutoCAD)", proceso:"Datos de proceso" };

export async function screenDocumento(main, state, p, id, tab, topbar){
  const e0 = entregable(id), def = defDoc(id), e = e0 && Object.assign({}, e0, { nombre: nombreEntregable(id, p), finalidad: finalidadEntregable(id, p) });
  if(!e || !def){ location.hash = `#/proyecto/${p.id}/documentos`; return; }
  // biblioteca de componentes del usuario (medidas y vistas de los equipos): antes de armar arreglos y planos
  await cargarBase();
  S.sincronizarDocumentos(p, ENTREGABLES);
  if(!p.documentos[id]){
    if(e.interno){ p.documentos[id] = { rev:"A", fecha:new Date().toISOString().slice(0,10), estado:"Por elaborar", titulo:e.nombre.toUpperCase() }; S.save(); }
    else { p.entregables.push(id); S.sincronizarDocumentos(p, ENTREGABLES); }
  }
  // documentos del plan Pro: sin el plan se muestra la pantalla de actualización
  if(!e.interno && !esPro(state)){ pantallaPro(main, state, p, e, topbar); return; }
  const di = docInfo(p, id);
  // todo se descarga en el formato estándar de Ingenia; la descarga se habilita en «Cajetín y revisiones»
  // Excel y Word: «Datos» (con la identificación y el historial de revisiones al final), «Resumen» y «Descarga» (vista del
  // PDF tal como se descargará); los planos conservan sus vistas previas y el cajetín
  const tabs = def.formato==="proceso" ? [["datos","1. Datos de entrada"],["vista","2. Resumen"],["cajetin","3. Cajetín y revisiones"]]
    : def.vista3d ? [["datos","1. Datos de entrada"],["vista","2. Vista previa 2D"],["vista3d","3. Vista previa 3D"],["cajetin","4. Cajetín y descarga"]]
    : esOficina(def) ? [["datos","1. Datos"],["vista","2. Resumen"],["cajetin","3. Descarga"]]
    : [["datos","1. Datos de entrada"],["vista","2. Vista previa"],["cajetin","3. Cajetín y descarga"]];
  tab = tabs.some(t=>t[0]===tab) ? tab : "datos";
  main.innerHTML = topbar({ crumbs:[{label:"Proyectos", href:"#/proyectos"},{label:p.nombre, href:`#/proyecto/${p.id}/documentos`},{label:e.nombre}], title:e.nombre,
    sub:`<span class="mono">Rev. ${esc(di.rev||"A")}</span><span>${esc(DISCIPLINAS[e.disciplina].nombre)} · ${esc(FMT[def.formato])}</span>`,
    actions:`<a class="btn" href="#/proyecto/${p.id}/documentos">${ICON.back} Documentos</a>` }) +
    `<div class="tabs">${tabs.map(t=>`<button data-wtab="${t[0]}" class="${t[0]===tab?"active":""}">${t[1]}</button>`).join("")}</div><div id="ws-body"></div>`;
  $$("[data-wtab]").forEach(b=>b.onclick = ()=>location.hash = `#/proyecto/${p.id}/doc/${id}/${b.dataset.wtab}`);
  const body = $("#ws-body");
  if(tab==="datos") return tabDatos(body, state, p, id, def);
  if(tab==="vista") return Promise.resolve(tabVista(body, state, p, id, def)).then(()=>montarBarraCopito(body, p, id));
  if(tab==="vista3d") return tabVista3D(body, p, id);
  if(tab==="cajetin") return esOficina(def) ? tabDescarga(body, state, p, id, def) : tabCajetin(body, state, p, id, def);
}
const esOficina = def => def.formato==="xlsx" || def.formato==="docx";

/* ---------------- 1. datos ---------------- */
function tabDatos(body, state, p, id, def){
  if(esOficina(def)){
    body.innerHTML = `<div id="eds"></div><div id="ws-ident" class="${def.editores.length ? "mt-2" : ""}"></div>
      <div class="row mt-2" style="justify-content:flex-end"><a class="btn btn-primary" href="#/proyecto/${p.id}/doc/${id}/vista">Ver resumen →</a></div>`;
    if(def.editores.length) renderEditores($("#eds", body), p, def.editores, id, ()=>{});
    tarjetasDocumento($("#ws-ident", body), state, p, id, def);
    return;
  }
  if(!def.editores.length){ body.innerHTML = `<div class="empty"><p><strong>No requiere datos adicionales.</strong></p><p>Se arma con los datos del proyecto.</p><a class="btn btn-primary" href="#/proyecto/${p.id}/doc/${id}/vista">Ver vista previa →</a></div>`; return; }
  body.innerHTML = `<div id="eds"></div>
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
    if(base==="ele-equipos") return vistaTabla(body, p, id, "LISTADO DE EQUIPOS ELÉCTRICOS", [["ÍTEM","item"],["CANT.","cant"],["TAG","tag"],["DESCRIPCIÓN","descripcion"],["MARCA","marca"],["MODELO","modelo"],["CÓDIGO","codigo"]], listadoEquipos(p));
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
    <tr><th>Documento</th><td>${esc(nombreEntregable(id, p))}</td><th>Unidad</th><td>${esc(p.unidad||"—")}</td></tr></table>`;
}
function fmtF(f){ const m = String(f||"").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (f||""); }
/* columnas de texto descriptivo: alineadas a la izquierda; el resto de valores, centrados */
const esDescripcion = c => /^descrip|descripción/i.test(c[0]) || ["descripcion","desc"].includes(c[1]);
function tablaHTML(cols, filas, totales){
  return `<div class="table-wrap"><table class="xl-table"><thead><tr>${cols.map(c=>`<th class="${esDescripcion(c)?"izq":""}">${esc(c[0])}</th>`).join("")}</tr></thead><tbody>${filas.map((f,i)=>f.__var==="seccion" ? `<tr class="xl-seccion${f.__clase ? " "+f.__clase : ""}"><td colspan="${cols.length}">${esc(f.texto||"")}</td></tr>` : `<tr>${cols.map(c=>{ const v = c[1]==="#" ? i+1 : f[c[1]]; return `<td class="${typeof v==="number"?"num":""}${esDescripcion(c)?" izq":""}${c[1]==="tag"?" nw":""}">${esc(v==null?"":typeof v==="string" ? corregir(v) : String(v)).replace(/\n/g,"<br>")}</td>`; }).join("")}</tr>`).join("") || `<tr><td colspan="${cols.length}" class="muted" style="text-align:center;padding:16px">Sin registros — completa los datos de entrada.</td></tr>`}${totales||""}</tbody></table></div>`;
}
function vistaTabla(body, p, id, titulo, cols, filas, extra){
  body.innerHTML = cabeceraHoja(p, id, titulo) + tablaHTML(cols, filas) + (extra||"") + `</div>` + pieVista(p, id);
}
function pieVista(p, id){ return `<div class="row mt-2" style="justify-content:flex-end"><a class="btn btn-primary" href="#/proyecto/${p.id}/doc/${id}/cajetin">${esOficina(defDoc(id)) ? "Siguiente: descarga →" : "Siguiente: cajetín y descarga →"}</a></div>`; }

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
      `</div>`;
  }).concat(tablerosControl(p).filter(t=>t.tipo==="control").map(t=>({ t, filas: cargasTableroControl(p, t) })).filter(x=>x.filas.length).map(({ t, filas })=>{
    // tableros de control: cargas por barra (la misma tabla que usa su unifilar)
    const tot = `<tr class="xl-total"><td colspan="4" style="text-align:right">POTENCIA TOTAL</td><td class="num">${filas.reduce((a, f)=>a + (+f.potencia||0), 0)} W</td><td colspan="3"></td></tr>`;
    return cabeceraHoja(p, id, "LISTADO DE CARGAS") +
      `<div class="xl-band">${esc(`${datos(p).sistema.nombre ? datos(p).sistema.nombre+" - " : ""}${t.nombre} ${t.tag}`.toUpperCase())} — CARGAS DEL TABLERO DE CONTROL</div>` +
      tablaHTML([["ÍTEM","n"],["BARRA","barra"],["DESCRIPCIÓN","descripcion"],["CIRCUITO","circuito"],["POTENCIA (W)","potencia"],["PROTECCIÓN (A)","proteccion"],["ID 30 mA","id"],["CABLE","cable"]], filas.filter(f=>!f.__var), tot) + `</div>`;
  })).join('<div class="mt-2"></div>') + pieVista(p, id);
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
    <div class="stat-row"><div class="stat"><div class="k">Potencia instalada</div><div class="v">${m.pi_total} kVA</div></div><div class="stat"><div class="k">Máxima demanda</div><div class="v">${m.md_total} kVA</div></div><div class="stat"><div class="k">I máx. demanda</div><div class="v">${m.i_md_total} A</div></div><div class="stat stat-lista"><div class="k">Interruptor general</div><ul class="lista-itm">${(m.itm_lista||[]).map(x=>`<li><b>${esc(x.tag)}</b><span>${esc(x.valor)}</span></li>`).join("")}</ul></div></div>
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

/* selector del plano de cada tablero (multifilar y mecánico: un plano por tablero) */
function selectorPlanos(tbs, sel){
  if(!tbs || tbs.length < 2) return tbs && tbs.length ? `<div class="planos-sel mb-2"><span class="muted">Plano del tablero</span><span class="chip-plano on">${esc(tbs[0].tag)}</span></div>` : "";
  return `<div class="planos-sel mb-2" role="tablist" aria-label="Plano de cada tablero"><span class="muted">${tbs.length} planos, uno por tablero:</span>${tbs.map(t=>`<button class="chip-plano ${t===sel ? "on" : ""}" role="tab" aria-selected="${t===sel}" data-plano-t="${t.id}" title="${esc(t.nombre||"")}">${esc(t.tag)}</button>`).join("")}</div>`;
}
/* visor de planos con zoom y desplazamiento */
async function vistaPlano(body, state, p, id){
  const org = await orgConLogo(state);
  // multifilares y mecánicos: un plano por tablero (sus hojas no se mezclan con las de otro tablero)
  const tbs = tablerosDePlano(p, id), tSel = tbs ? (tbs.find(t=>t.id===body.dataset.t) || tbs[0]) : null;
  const r = await generarPlano(p, id, org, await logosPlano(org, p), tSel && tSel.id);
  const d = parseDXF(r.dxf);
  const hojas = r.hojas||1;
  body.innerHTML = `${selectorPlanos(tbs, tSel)}<div class="row between mb-2"><div class="row">${hojas>1?`<label class="muted">Hoja</label><select id="pl-h" style="width:auto;min-width:110px">${Array.from({length:hojas},(_,i)=>`<option value="${i}">${i+1} de ${hojas}</option>`).join("")}</select>`:""}
      <button class="btn-sm" id="pl-fit">Ajustar</button><span class="muted" style="font-size:12px">Rueda del ratón: zoom · arrastrar: desplazar</span></div>
      <span class="muted">${hojas} lámina(s) A1 · ${d.entities.length} entidades · capas: ${Object.keys(d.layers).length}</span></div>
    ${Array.isArray(r.avisos) ? (r.avisos.length ? `<div class="notice warn mb-2"><strong>Revisión de continuidad y referencias cruzadas:</strong><br>${r.avisos.map(esc).join("<br>")}</div>`
      : `<p class="muted mb-2" style="font-size:12px">✓ Revisión de continuidad: todos los conductores llegan a un borne o a otro conductor, cada flecha tiene su referencia cruzada a la hoja y zona donde continúa, y los equipos del unifilar están en el plano.</p>`) : ""}
    <div class="plano-view"><canvas id="pl-cv"></canvas></div>
    <div class="row mt-2" style="justify-content:flex-end">${defDoc(id).vista3d ? `<a class="btn btn-primary" href="#/proyecto/${p.id}/doc/${id}/vista3d">Siguiente: vista previa 3D →</a>` : `<a class="btn btn-primary" href="#/proyecto/${p.id}/doc/${id}/cajetin">Siguiente: cajetín y descarga →</a>`}</div>`;
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
    const col = colorCapa;
    for(const e of d.entities){
      ctx.strokeStyle = col(e.layer);
      if(e.t==="L"){ ctx.beginPath(); ctx.moveTo(X(e.x1),Y(e.y1)); ctx.lineTo(X(e.x2),Y(e.y2)); ctx.stroke(); }
      else if(e.t==="C"){ ctx.beginPath(); ctx.arc(X(e.cx),Y(e.cy),e.r*s,0,Math.PI*2); ctx.stroke(); }
      else if(e.t==="A"){ ctx.beginPath(); ctx.arc(X(e.cx),Y(e.cy),e.r*s,-e.a2*Math.PI/180,-e.a1*Math.PI/180); ctx.stroke(); }
      else if(e.t==="P"){ ctx.beginPath(); e.pts.forEach((q,i)=>i?ctx.lineTo(X(q[0]),Y(q[1])):ctx.moveTo(X(q[0]),Y(q[1]))); if(e.closed) ctx.closePath(); ctx.stroke(); }
      else if(e.t==="S"){ ctx.fillStyle = e.c>0 && e.c<256 ? rgbACI(e.c) : "#1b2a3c"; ctx.beginPath(); const o=[e.pts[0],e.pts[1],e.pts[3],e.pts[2]]; o.forEach((q,i)=>i?ctx.lineTo(X(q[0]),Y(q[1])):ctx.moveTo(X(q[0]),Y(q[1]))); ctx.closePath(); ctx.fill(); }
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
  $$("[data-plano-t]", body).forEach(b=>b.onclick = ()=>{ body.dataset.t = b.dataset.planoT; body.innerHTML = spinner("Dibujando el plano…"); vistaPlano(body, state, p, id); });
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
    if(mejor && dm < 12 && window.copito) window.copito.abrir(`En ${nombreEntregable(id, p)}, para ${mejor}, `, false);
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
      <div class="row mt-2" style="justify-content:flex-end"><a class="btn btn-primary" href="#/proyecto/${p.id}/doc/${id}/cajetin">Siguiente: cajetín y descarga →</a></div>`;
    const ts = $("#v3-t"); if(ts) ts.onchange = ()=>{ body.dataset.t = ts.value; tabVista3D(body, p, id); };
    const pedir = (txt, enviar)=>{ if(window.copito) window.copito.abrir(txt, enviar); else toast("Copito no está disponible", true); };
    $$("[data-cp]", body).forEach(b=>b.onclick = ()=>b.dataset.cp ? pedir(b.dataset.cp, true) : pedir(`En ${t.tag}, `, false));
    $("#v3-cont").innerHTML = spinner("Cargando el visor 3D…");
    const { visor3D } = await import("./mecanico/visor3d.js");
    await visor3D($("#v3-cont"), sel, { copito:(d, m)=>pedir(`En ${m.tablero.tag}${d.tag ? `, para ${d.tag}` : ""}, `, false) });
  }catch(err){ console.error(err); body.innerHTML = `<div class="notice warn">No se pudo armar la vista 3D: ${esc(err.message||err)}</div>`; }
}

/* ---------------- 3. cajetín y revisiones ---------------- */
/* identificación del documento e historial de revisiones (en «Datos» para Excel y Word; en el cajetín de los planos) */
function tarjetasDocumento(cont, state, p, id, def){
  const d = p.documentos[id]; docInfo(p, id);
  const org = state.org;
  const render = ()=>{
    // el estado sigue a la revisión vigente
    if(sincronizarEstado(d)) S.save();
    cont.innerHTML = html`<div class="grid-2">
      <div class="card"><div class="card-head"><h2>Identificación</h2></div><div class="card-body">
        <div class="field"><label>Título</label><input type="text" data-f="titulo" value="${esc(d.titulo||"")}"></div>
        <div class="grid-3">
          <div class="field"><label>Elaboró / diseñó</label><input type="text" data-f="elaboro" value="${esc(d.elaboro||"")}" placeholder="${esc(org.elaboraPor||"")}"></div>
          <div class="field"><label>Revisó</label><input type="text" data-f="reviso" value="${esc(d.reviso||"")}" placeholder="${esc(org.revisaPor||"")}"></div>
          <div class="field"><label>Aprobó</label><input type="text" data-f="aprobo" value="${esc(d.aprobo||"")}" placeholder="${esc(org.apruebaPor||"")}"></div>
        </div>
        ${def.formato==="dxf" ? `<div class="field"><label>Dibujó</label><input type="text" data-f="dibujo" value="${esc(d.dibujo||"")}" placeholder="${esc(org.dibujaPor||org.elaboraPor||"")}"></div>` : ""}
      </div></div>
      <div class="card"><div class="card-head"><h2>Historial de revisiones</h2><button class="btn-sm" id="rv-add">${ICON.plus} Nueva revisión</button></div><div class="card-body">
        <div class="table-wrap"><table class="tb-rev"><thead><tr><th>Rev.</th><th>Fecha</th><th>Descripción / emitido para</th><th></th></tr></thead><tbody>
        ${d.revisiones.map((r,i)=>`<tr data-r="${i}"><td class="centro"><input type="text" class="centro" data-rv="rev" value="${esc(r.rev)}" style="width:54px"></td><td class="centro"><input type="date" class="centro" data-rv="fecha" value="${esc(r.fecha)}"></td><td><select data-rv="descripcion">${["Emitido para revisión interna","Emitido para revisión del cliente","Emitido para aprobación","Emitido para construcción","Conforme a obra"].concat(r.descripcion && !/^Emitido|^Conforme/.test(r.descripcion)?[r.descripcion]:[]).map(o=>`<option ${r.descripcion===o?"selected":""}>${esc(o)}</option>`).join("")}</select></td><td>${d.revisiones.length>1?`<button class="btn-ghost btn-sm" data-rdel>${ICON.trash}</button>`:""}</td></tr>`).join("")}
        </tbody></table></div></div></div>
    </div>`;
    $$("[data-f]", cont).forEach(i=>i.onchange = ()=>{ d[i.dataset.f] = i.value; S.save(); });
    // al elegir para qué se emite la revisión, el documento queda emitido y su estado lo sigue (también en Documentos)
    $$("[data-rv]", cont).forEach(i=>i.onchange = ()=>{ d.revisiones[+i.closest("tr").dataset.r][i.dataset.rv] = i.value; if(i.dataset.rv==="descripcion") d.emitida = true; docInfo(p, id); S.save(); render(); });
    $$("[data-rdel]", cont).forEach(b=>b.onclick = ()=>{ d.revisiones.splice(+b.closest("tr").dataset.r, 1); docInfo(p, id); S.save(); render(); });
    $("#rv-add", cont).onclick = ()=>{ const last = d.revisiones[d.revisiones.length-1]; const sig = nextRev(last.rev); d.revisiones.push({ rev:sig, fecha:new Date().toISOString().slice(0,10), descripcion: /^\d+$/.test(sig) ? "Emitido para construcción" : "Emitido para revisión del cliente" }); d.emitida = true; docInfo(p, id); S.save(); render(); };
  };
  render();
}
function tabCajetin(body, state, p, id, def){
  const d = p.documentos[id]; docInfo(p, id);
  const render = ()=>{
    body.innerHTML = html`<div id="ws-ident"></div>
    ${def.formato==="dxf" ? `<div class="card mt-2"><div class="card-head"><h2>Planos de referencia (cajetín)</h2><button class="btn-sm" id="rf-auto">Volver a sugerir</button></div><div class="card-body" id="refs"></div></div>` : ""}
    ${descargable(id) ? `<div class="card mt-2 ws-descarga"><div class="card-body row between" style="flex-wrap:wrap"><h2 style="font-size:15px">Descargar el documento</h2><div class="row"><button class="btn-accent" id="ws-dl">${ICON.download} Descargar ${FMT[def.formato]}</button><button class="btn-primary" id="ws-pdf">${ICON.download} Descargar PDF</button></div></div></div>` : ""}`;
    const tbs = def.formato==="dxf" ? tablerosDePlano(p, id) : null;
    if(tbs){
      // un plano por tablero: se elige el tablero (o todos, en un .zip con un archivo por tablero)
      const caja = $(".ws-descarga .card-body", body);
      if(caja) caja.insertAdjacentHTML("afterend", `<div class="card-body planos-tab"><span class="muted" style="font-size:12.5px">Un plano por tablero (${tbs.length}). Descarga uno o todos:</span>
        <div class="row" style="flex-wrap:wrap;gap:8px;margin-top:8px">${tbs.map(t=>`<div class="plano-dl"><b class="mono">${esc(t.tag)}</b><button class="btn-sm" data-dl="${t.id}">${ICON.download} DXF</button><button class="btn-sm" data-pdf="${t.id}">${ICON.download} PDF</button></div>`).join("")}</div></div>`);
      $$("[data-dl]", body).forEach(b=>b.onclick = ()=>descargarDoc(state, p, id, b, "nativo", null, b.dataset.dl));
      $$("[data-pdf]", body).forEach(b=>b.onclick = ()=>descargarDoc(state, p, id, b, "pdf", null, b.dataset.pdf));
    }
    const wdl = $("#ws-dl", body); if(wdl){ if(tbs) wdl.innerHTML = `${ICON.download} Todos en DXF (.zip)`; wdl.onclick = ()=>descargarDoc(state, p, id, wdl); }
    const wpdf = $("#ws-pdf", body); if(wpdf){ if(tbs) wpdf.innerHTML = `${ICON.download} Todos en PDF (.zip)`; wpdf.onclick = ()=>descargarDoc(state, p, id, wpdf, "pdf"); }
    tarjetasDocumento($("#ws-ident", body), state, p, id, def);
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
/* ---------------- 3. descarga (Excel y Word): vista del PDF tal como se descargará y los dos botones ---------------- */
let pdfVista = null;   // { url, id } del PDF que se está mostrando (se libera al cambiar de documento)
/* páginas de un PDF dibujadas en lienzos (pdf.js): se ve igual en cualquier navegador, también en el celular */
async function verPaginasPDF(cont, pdf){
  const pdfjs = await import("../vendor/pdfjs-4.10.38/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdfjs-4.10.38/pdf.worker.min.mjs", import.meta.url).href;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf.slice(0)), standardFontDataUrl: new URL("../vendor/pdfjs-4.10.38/standard_fonts/", import.meta.url).href }).promise;
  cont.innerHTML = "";
  const ancho = Math.max(320, cont.clientWidth - 24), dpr = Math.min(2, window.devicePixelRatio || 1);
  for(let i = 1; i <= doc.numPages; i++){
    if(!cont.isConnected) return;
    const pag = await doc.getPage(i), v0 = pag.getViewport({ scale:1 });
    // páginas verticales al ancho disponible (hasta ~900 px); las apaisadas, a todo el ancho
    const w = v0.width > v0.height ? ancho : Math.min(ancho, 900), vp = pag.getViewport({ scale: w/v0.width*dpr });
    const fig = document.createElement("figure"); fig.className = "pdf-pagina";
    const cv = document.createElement("canvas"); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height); cv.style.width = `${Math.round(w)}px`;
    const cap = document.createElement("figcaption"); cap.textContent = `Página ${i} de ${doc.numPages}`;
    fig.appendChild(cv); fig.appendChild(cap); cont.appendChild(fig);
    await pag.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
  }
}
async function tabDescarga(body, state, p, id, def){
  if(pdfVista){ URL.revokeObjectURL(pdfVista.url); pdfVista = null; }
  const puede = descargable(id);
  body.innerHTML = `<div class="card ws-descarga"><div class="card-body row between" style="flex-wrap:wrap;gap:10px"><div><h2 style="font-size:15px">Descargar el documento</h2>
      <span class="muted" style="font-size:12.5px">Así se verá el documento al descargarlo en PDF.</span></div>
      <div class="row">${puede ? `<button class="btn-accent" id="ws-dl">${ICON.download} Descargar ${FMT[def.formato]}</button><button class="btn-primary" id="ws-pdf">${ICON.download} Descargar PDF</button>` : ""}</div></div></div>
    <div class="pdf-visor-caja mt-2" id="ws-visor">${spinner("Preparando la vista del PDF…")}</div>`;
  let pdf = null;
  const wdl = $("#ws-dl", body); if(wdl) wdl.onclick = ()=>descargarDoc(state, p, id, wdl);
  const wpdf = $("#ws-pdf", body); if(wpdf) wpdf.onclick = ()=>descargarDoc(state, p, id, wpdf, "pdf", pdf);
  if(!puede){ $("#ws-visor", body).innerHTML = `<div class="notice">Este documento no genera archivo descargable.</div>`; return; }
  try{
    const a = await generarArchivo(state, p, id);
    if(!a){ $("#ws-visor", body).innerHTML = `<div class="notice">Alimenta los datos del documento para ver su PDF.</div>`; return; }
    const P = await import("./pdf.js");
    pdf = a.ext==="xlsx" ? await P.pdfExcel(a.datos) : await P.pdfWord(a.datos);
    if(!body.isConnected) return;
    const url = URL.createObjectURL(new Blob([pdf], { type:"application/pdf" })); pdfVista = { url, id };
    const vis = $("#ws-visor", body);
    vis.innerHTML = `<div class="pdf-paginas" id="ws-pags">${spinner("Dibujando las páginas…")}</div>`;
    try{ await verPaginasPDF($("#ws-pags", vis), pdf); }
    catch(e){ console.warn("visor pdf.js", e); vis.innerHTML = `<iframe class="pdf-visor" src="${url}#view=FitH" title="Vista del PDF"></iframe>`; }
    if(vis.isConnected) vis.insertAdjacentHTML("beforeend", `<p class="muted" style="font-size:12px;margin:8px 2px 0">También puedes <a href="${url}" target="_blank" rel="noopener">abrir el PDF en otra pestaña</a>.</p>`);
  }catch(err){ console.error(err); const v = $("#ws-visor", body); if(v) v.innerHTML = `<div class="notice warn">No se pudo preparar la vista del PDF: ${esc(err.message||err)}</div>`; }
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
/* logo → raster por tramos de color ACI para dibujarlo con SOLID en el DXF R12 (que no admite imágenes).
   Resolución alta (≈ 6 px/mm en el recuadro del cajetín) y colores llevados a los colores principales del logo: los
   bordes suavizados (antialias) no se convierten en puntos de colores sueltos, así el logo se ve nítido en AutoCAD. */
export async function logoRaster(dataURL, maxW=640, maxH=220){
  if(!dataURL) return null;
  return new Promise(res=>{ const im = new Image(); im.onload = ()=>{
    const k = Math.min(maxW/im.naturalWidth, maxH/im.naturalHeight, 4); const w = Math.max(1, Math.round(im.naturalWidth*k)), h = Math.max(1, Math.round(im.naturalHeight*k));
    const c = document.createElement("canvas"); c.width = w; c.height = h; const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.drawImage(im, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    // color de cada píxel sobre fondo blanco (las transparencias se mezclan con el blanco del cajetín)
    const rgb = i => { const a = px[i+3]/255; return [px[i]*a + 255*(1-a), px[i+1]*a + 255*(1-a), px[i+2]*a + 255*(1-a)]; };
    const blanco = ([r, g, b]) => r>232 && g>232 && b>232;
    // colores principales: histograma en cubos de 16 niveles; los más frecuentes (hasta 10) forman la paleta
    const cuenta = new Map();
    for(let i=0;i<px.length;i+=4){ const q = rgb(i); if(blanco(q)) continue; const kk = (q[0]>>4)<<8 | (q[1]>>4)<<4 | (q[2]>>4); cuenta.set(kk, (cuenta.get(kk)||0) + 1); }
    const total = [...cuenta.values()].reduce((a, n)=>a + n, 0) || 1;
    const pal = [...cuenta.entries()].sort((a, b)=>b[1] - a[1]).filter(([, n])=>n/total > 0.004).slice(0, 10)
      .map(([kk])=>[((kk>>8)&15)*16 + 8, ((kk>>4)&15)*16 + 8, (kk&15)*16 + 8]);
    const d2 = (a, b) => 2*(a[0]-b[0])**2 + 4*(a[1]-b[1])**2 + 3*(a[2]-b[2])**2;
    const aciPal = pal.map(q=>aciCercano(...q)), memo = new Map();
    const colorDe = q => {
      if(blanco(q)) return 0;
      const kk = (q[0]>>3)<<10 | (q[1]>>3)<<5 | (q[2]>>3); if(memo.has(kk)) return memo.get(kk);
      // el más cercano entre el blanco del fondo y los colores principales (los bordes suavizados van a uno de ellos)
      let best = 0, bd = d2(q, [255, 255, 255]);
      pal.forEach((pc, j)=>{ const dd = d2(q, pc); if(dd < bd){ bd = dd; best = aciPal[j]; } });
      if(!pal.length) best = aciCercano(...q);
      memo.set(kk, best); return best;
    };
    const colorDe_ = i => col[i];
    // blancos: el fondo exterior (conectado con el borde de la imagen) queda vacío; los blancos interiores (letras o
    // detalles blancos sobre el color del logo) se rellenan con blanco verdadero (ACI 255), si no en AutoCAD con fondo
    // negro se verían negros
    const col = new Uint8Array(w*h); for(let i=0;i<w*h;i++) col[i] = colorDe(rgb(i*4));
    const fondo = new Uint8Array(w*h), pila = [];
    for(let x=0;x<w;x++){ pila.push(x, (h-1)*w + x); } for(let y=0;y<h;y++){ pila.push(y*w, y*w + w - 1); }
    while(pila.length){ const i = pila.pop(); if(fondo[i] || col[i]) continue; fondo[i] = 1; const x = i % w, y = (i - x)/w;
      if(x > 0) pila.push(i - 1); if(x < w - 1) pila.push(i + 1); if(y > 0) pila.push(i - w); if(y < h - 1) pila.push(i + w); }
    for(let i=0;i<w*h;i++) if(!col[i] && !fondo[i]) col[i] = 255;
    const runs = [];
    for(let y=0;y<h;y++){ let cur = null;
      for(let x=0;x<w;x++){ const col = colorDe_(y*w+x);
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

/* archivo nativo del documento: { datos, ext, mime } (DXF, Excel o Word); hojas: láminas del plano */
export async function generarArchivo(state, p, id, tablero){
  await cargarBase();
  const def = defDoc(id), e = Object.assign({}, entregable(id), { nombre: nombreEntregable(id, p) });
  const org = await orgConLogo(state);
  const di = docInfo(p, id);
  const tplCli = null;   // los documentos se descargan siempre en el formato estándar de Ingenia
    if(def.formato==="dxf"){
      const r = await generarPlano(p, id, org, await logosPlano(org, p), tablero);
      return { datos: dxfBytes(r.dxf), dxf: r.dxf, hojas: r.hojas||1, ext:"dxf", mime:X.MIME.dxf };
    } else if(def.formato==="proceso"){ return null;
    } else if(def.estandar || (def.texto && !tplCli)){
      // formatos estándar previos (lista de documentos, cables, criterios)
      const ctx = { scal: escalares(p, id, org), logos: { org: await logoPNG(org.logoDataURL), cliente: await logoCliente(p) }, org, proyecto:{ nombre:p.nombre, cliente:p.cliente, unidad:p.unidad, codigo:"", etapaNombre:"" }, doc:{ codigo:"", titulo:tituloDoc(p,id), rev:di.rev, fecha:di.fecha, disciplina:DISCIPLINAS[e.disciplina].nombre, emitidoPara:di.emitido, referencia:p.pidRef||"" }, revisiones: di.revisiones.map(r=>Object.assign({ elaboro:di.elaboro||org.elaboraPor, reviso:di.reviso||org.revisaPor, aprobo:di.aprobo||org.apruebaPor }, r)), tablas:{}, campos:{} };
      if(false){
      } else if(id==="gen-registro"){
        const filas = p.entregables.map(entregable).filter(Boolean).map((x,i)=>{ const d=p.documentos[x.id]||{}; return { item:i+1, titulo:nombreEntregable(x.id, p), disciplina:DISCIPLINAS[x.disciplina].nombre, tipo:TIPOS[x.tipo], rev:d.rev, fecha:d.fecha, emitido:d.emitido||"", estado:d.estado }; });
        ctx.tablas = { "Lista de documentos": { titulo:"Lista de documentos / entregables", columnas:[{key:"item",titulo:"Ítem",ancho:6,num:true},{key:"titulo",titulo:"Documento",ancho:56},{key:"disciplina",titulo:"Disciplina",ancho:22},{key:"tipo",titulo:"Tipo",ancho:18},{key:"rev",titulo:"Rev.",ancho:6,center:true},{key:"fecha",titulo:"Fecha",ancho:12},{key:"emitido",titulo:"Emitido para",ancho:26},{key:"estado",titulo:"Estado",ancho:14}], filas } };
        return { datos: await X.excelEstandar(ctx), ext:"xlsx", mime:X.MIME.xlsx };
      } else {
        ctx.tablas = tablasEstandar(p, id);
        return { datos: await X.excelEstandar(ctx), ext:"xlsx", mime:X.MIME.xlsx };
      }
    } else if(def.formato==="xlsx"){
      const pay = await payloadExcel(p, id, org);
      const buf = tplCli ? await tplCli.blob.arrayBuffer() : await (await fetch("assets/plantillas/"+def.plantilla)).arrayBuffer();
      const man = tplCli ? {} : ((await manifiesto())[def.man] || {});
      const logos = { org: await logoPNG(org.logoDataURL), cliente: await logoCliente(p) };
      const out = await rellenarExcel(window.ExcelJS, buf, Object.assign({}, pay, { manifiesto: man, logos, estandar: !tplCli }));
      return { datos: out, ext:"xlsx", mime:X.MIME.xlsx };
    } else if(def.formato==="docx"){
      const base = def.aliasDe || id;
      const extra = (base==="ele-mc" || base==="ele-md") ? datosMemoria(p, base) : def.datos ? def.datos(p) : def.secciones ? { secciones: def.secciones(p) } : {};
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
      return { datos: doc.getZip().generate({ type:"arraybuffer", compression:"DEFLATE", mimeType:X.MIME.docx }), ext:"docx", mime:X.MIME.docx };
    }
  return null;
}

/* descarga del documento: «nativo» (DXF, Excel o Word) o «pdf» (el mismo archivo convertido a PDF) */
export async function descargarDoc(state, p, id, btn, tipo="nativo", pdfListo=null, tablero=null){
  const e = Object.assign({}, entregable(id), { nombre: nombreEntregable(id, p) });
  const lbl = btn ? btn.innerHTML : ""; if(btn){ btn.disabled = true; btn.textContent = "Generando…"; }
  try{
    const di = docInfo(p, id), dd = p.documentos[id];
    const nombre = ext => X.nombreSeguro(`${p.nombre||"Proyecto"} - ${e.nombre} - Rev ${di.rev||"A"}`)+"."+ext;
    // PDF ya preparado en la pestaña «Descarga»: se descarga el mismo que se ve
    if(tipo==="pdf" && pdfListo){ X.descargar(pdfListo, nombre("pdf"), "application/pdf"); if(dd.estado==="Por elaborar"){ dd.estado = "En elaboración"; S.save(); } toast("Documento generado: "+e.nombre); return; }
    // planos por tablero: el del tablero elegido, o todos en un .zip (un archivo por tablero)
    const tbs = defDoc(id).formato==="dxf" ? tablerosDePlano(p, id) : null;
    if(tbs){
      const lista = tablero ? tbs.filter(t=>t.id===tablero) : tbs, P = tipo==="pdf" ? await import("./pdf.js") : null;
      const nomT = (t, ext) => X.nombreSeguro(`${p.nombre||"Proyecto"} - ${e.nombre} - ${t.tag} - Rev ${di.rev||"A"}`)+"."+ext;
      const archivos = [];
      for(const t of lista){
        if(btn) btn.textContent = lista.length > 1 ? `Generando ${t.tag}…` : "Generando…";
        const a = await generarArchivo(state, p, id, t.id);
        archivos.push({ nombre: nomT(t, tipo==="pdf" ? "pdf" : "dxf"), datos: tipo==="pdf" ? await P.pdfPlano(a.dxf, a.hojas) : a.datos });
      }
      if(archivos.length===1) X.descargar(new Blob([archivos[0].datos], { type: tipo==="pdf" ? "application/pdf" : X.MIME.dxf }), archivos[0].nombre, tipo==="pdf" ? "application/pdf" : X.MIME.dxf);
      else { const z = new window.PizZip(); for(const f of archivos) z.file(f.nombre, f.datos instanceof Uint8Array ? f.datos : new Uint8Array(f.datos));
        X.descargar(z.generate({ type:"blob", compression:"DEFLATE" }), nombre("zip"), "application/zip"); }
      if(dd.estado==="Por elaborar"){ dd.estado = "En elaboración"; S.save(); }
      toast(`Documento generado: ${e.nombre}${archivos.length > 1 ? ` (${archivos.length} planos)` : ""}`);
      return;
    }
    const a = await generarArchivo(state, p, id);
    if(!a){ toast("Este entorno no genera archivo: alimenta el listado de instrumentos."); return; }
    if(tipo==="pdf"){
      const P = await import("./pdf.js");
      const pdf = a.ext==="dxf" ? await P.pdfPlano(a.dxf, a.hojas) : a.ext==="xlsx" ? await P.pdfExcel(a.datos) : await P.pdfWord(a.datos);
      X.descargar(pdf, nombre("pdf"), "application/pdf");
    } else X.descargar(a.datos instanceof Uint8Array || a.datos instanceof ArrayBuffer ? new Blob([a.datos], { type:a.mime }) : a.datos, nombre(a.ext), a.mime);
    if(dd.estado==="Por elaborar"){ dd.estado = "En elaboración"; S.save(); }
    toast("Documento generado: "+e.nombre);
  }catch(err){
    console.error(err);
    const msg = err.properties && err.properties.errors ? err.properties.errors.map(x=>x.properties.explanation).slice(0,3).join(" · ") : (err.message||String(err));
    toast("No se pudo generar: "+msg, true, 8000);
  }finally{ if(btn){ btn.disabled = false; btn.innerHTML = lbl; } }
}


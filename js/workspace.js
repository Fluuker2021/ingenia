/* Ingenia — entorno dedicado de un entregable: solo los datos que usa ese documento, su vista previa,
   el cajetín / historial de revisiones y la plantilla con la que se descarga (por defecto o del cliente). */
import { entregable, DISCIPLINAS, TIPOS, ESTADOS } from "./catalog.js";
import * as S from "./store.js";
import { $, $$, esc, html, ICON, toast, modal, dropzone, leerComoArrayBuffer, kb, fmtFecha } from "./ui.js";
import * as X from "./export.js";
import { rellenarExcel, marcadoresExcel } from "./xlsx-engine.js";
import { DOCS, defDoc, docInfo, referenciasSugeridas, escalares, payloadExcel, tablasCargas, tablasIO, camposHD, camposHDEq, datosMemoria, generarPlano, dxfBytes, manifiesto, tablasEstandar, codigoDe, tituloDoc, descargable } from "./docs.js";
import { renderEditores } from "./editores.js";
import { datos, calcularTablero, calcularTodos, equiposElectricos, instrumentos, r2, sistemaTag, tableros, tf, cablesFuerza, CANALIZACIONES } from "./datos.js";
import { aciCercano } from "./cad/formato.js";
import { parseDXF, boundsOf } from "./dxf.js";
import { seccionesCriteriosElectricos, seccionesCriteriosIC, seccionesMemoriaDescriptiva } from "./modules/criterios.js";
import { ENTREGABLES } from "./catalog.js";

const FMT = { xlsx:"Excel", docx:"Word", dxf:"DXF (AutoCAD)", proceso:"Datos de proceso" };

export async function screenDocumento(main, state, p, id, tab, topbar){
  const e = entregable(id), def = defDoc(id);
  if(!e || !def){ location.hash = `#/proyecto/${p.id}/documentos`; return; }
  S.sincronizarDocumentos(p, ENTREGABLES);
  if(!p.documentos[id]){
    if(e.interno){ p.documentos[id] = { rev:"A", fecha:new Date().toISOString().slice(0,10), estado:"Por elaborar", titulo:e.nombre.toUpperCase(), codigo:S.codigoDocumento(p, e, 1) }; S.save(); }
    else { p.entregables.push(id); S.sincronizarDocumentos(p, ENTREGABLES); }
  }
  const di = docInfo(p, id);
  const tpl = def.formato!=="dxf" ? (p.documentos[id].plantilla ? await S.leerArchivo(p.documentos[id].plantilla) : null) : null;
  const usaCliente = !!(tpl && p.documentos[id].usarPlantilla!==false);
  const tabs = def.formato==="proceso" ? [["datos","1. Datos de entrada"],["vista","2. Resumen"],["cajetin","3. Cajetín y revisiones"]] : [["datos","1. Datos de entrada"],["vista","2. Vista previa"],["cajetin","3. Cajetín y revisiones"],["plantilla","Plantilla"]];
  tab = tabs.some(t=>t[0]===tab) ? tab : "datos";
  main.innerHTML = topbar({ crumbs:[{label:"Proyectos", href:"#/proyectos"},{label:p.nombre, href:`#/proyecto/${p.id}/documentos`},{label:e.nombre}], title:e.nombre,
    sub:`<span class="chip">${esc(di.codigo||"")}</span><span class="mono">Rev. ${esc(di.rev||"A")}</span><span>${esc(DISCIPLINAS[e.disciplina].nombre)} · ${esc(FMT[def.formato])}</span>${def.formato==="proceso" ? "" : usaCliente ? `<span class="badge badge-blue" title="${esc(tpl.nombre)}">Formato del cliente</span>` : `<span class="badge badge-neutral" title="${esc(def.ref)}">Formato estándar</span>`}`,
    actions:`<a class="btn" href="#/proyecto/${p.id}/documentos">${ICON.back} Documentos</a>${descargable(id) ? `<button class="btn-accent" id="ws-dl">${ICON.download} Descargar ${FMT[def.formato]}</button>` : ""}` }) +
    `<div class="tabs">${tabs.map(t=>`<button data-wtab="${t[0]}" class="${t[0]===tab?"active":""}">${t[1]}</button>`).join("")}</div><div id="ws-body"></div>`;
  $$("[data-wtab]").forEach(b=>b.onclick = ()=>location.hash = `#/proyecto/${p.id}/doc/${id}/${b.dataset.wtab}`);
  const wdl = $("#ws-dl"); if(wdl) wdl.onclick = ()=>descargarDoc(state, p, id, wdl);
  const body = $("#ws-body");
  if(tab==="datos") return tabDatos(body, p, id, def);
  if(tab==="vista") return tabVista(body, state, p, id, def);
  if(tab==="cajetin") return tabCajetin(body, state, p, id, def);
  if(tab==="plantilla") return tabPlantilla(body, state, p, id, def, tpl);
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
  body.innerHTML = `<div class="muted">Calculando…</div>`;
  try{
    const base = def.aliasDe || id;
    if(def.formato==="dxf") return vistaPlano(body, state, p, id);
    if(def.formato==="proceso") return vistaProceso(body, p, id);
    if(base==="ele-cargas") return vistaCargas(body, p, id);
    if(base==="ele-cables") return vistaTabla(body, p, id, "LISTADO DE CABLES", [["ÍTEM","#"],["TAG DEL CABLE","tag"],["DESDE","desde"],["HASTA","hasta"],["CALIDAD","clase"],["VOLTAJE","voltaje"],["N° COND.","conductores"],["SECCIÓN MM²","seccion"],["AWG (NEC)","awg"],["CANALIZACIÓN","canal"],["LONG. (m)","longitudTotal"],["REFERENCIA","referencia"]], cablesFuerza(p).map(c=>Object.assign({}, c, { canal: (CANALIZACIONES.find(x=>x[0]===c.canalizacion)||["","Bandeja / otros"])[1] })));
    if(base==="ele-hd") return vistaHDEq(body, p, id);
    if(base==="ele-md") return vistaMemoria(body, p, id, "md");
    if(def.secciones) return vistaTexto(body, p, id, def);
    if(base==="ele-equipos") return vistaTabla(body, p, id, "LISTADO DE EQUIPOS ELÉCTRICOS", [["ÍTEM","#"],["SISTEMA","sistema"],["CANT.","cant"],["TAG","tag"],["DESCRIPCIÓN","descripcion"],["MARCA","marca"],["MODELO","modelo"],["VOLTAJE / FRECUENCIA / FASE","tension"],["PLANO DE REFERENCIA","plano"]], equiposElectricos(p).map(f=>Object.assign({}, f, { plano: f.plano || codigoDe(p, f._doc) })));
    if(base==="ins-instrumentos") return vistaTabla(body, p, id, "LISTADO DE INSTRUMENTOS", [["ÍTEM","#"],["SISTEMA","sistema"],["CANT.","cant"],["TAG","tag"],["DESCRIPCIÓN","descripcion"],["MARCA","marca"],["MODELO","modelo"],["TIPO DE SEÑAL","tipoSenal"],["SEÑAL DE SALIDA","senal"],["ALIMENTACIÓN","alimentacion"],["UBICACIÓN","ubicacion"],["HOJA DE DATOS","hojaDatos"]], instrumentos(p).map(i=>Object.assign({}, i, { sistema: i.sistema || (datos(p).sistema.nombre||"").toUpperCase(), hojaDatos: i.hojaDatos || codigoDe(p,"ins-hd") })));
    if(base==="ins-io"){ const t = tablasIO(p); return vistaTabla(body, p, id, "LISTADO DE ENTRADAS Y SALIDAS (I/O)", [["ÍTEM","#"],["TAG","tag"],["TIPO E/S","tipo"],["SEÑAL","senal"],["DESCRIPCIÓN","descripcion"],["VOLTAJE / PROTOCOLO","voltaje"],["RANGO","rango"],["ALIMENTACIÓN","alimentacion"],["CONTROLADOR","tablero"],["SLOT","slot"],["CANAL","ch"],["BORNES","terminales"]], t.io,
      `<h3 class="ed-sub mt-2">Resumen de señales y módulos</h3>${tablaHTML([["TIPO","tipo"],["USADOS","usados"],["RESERVA","reserva"],["REQUERIDOS","requeridos"],["CANALES/MÓDULO","cpm"],["MÓDULOS","modulos"],["CAPACIDAD","capacidad"]], t.resumen)}`); }
    if(base==="ins-hd") return vistaHD(body, p, id);
    if(base==="ele-mc") return vistaMemoria(body, p, id);
    if(def.estandar){ const t = id==="gen-registro" ? null : tablasEstandar(p, id); if(!t){ body.innerHTML = `<div class="notice">La lista de documentos se arma con los entregables seleccionados y sus códigos, revisiones y fechas (pestaña Documentos del proyecto).</div>`; return; } const [k, tb] = Object.entries(t)[0]; return vistaTabla(body, p, id, tb.titulo.toUpperCase(), tb.columnas.map(c=>[c.titulo, c.key]), tb.filas); }
    body.innerHTML = `<div class="empty">Sin vista previa.</div>`;
  }catch(err){ console.error(err); body.innerHTML = `<div class="notice warn">No se pudo calcular la vista previa: ${esc(err.message||err)}</div>`; }
}

function cabeceraHoja(p, id, titulo){
  const di = docInfo(p, id);
  return `<div class="xl-sheet"><div class="xl-title">${esc(titulo)}</div>
    <table class="xl-head"><tr><th>Cliente</th><td>${esc(p.cliente||"")}</td><th>Fecha</th><td>${esc(fmtF(di.fecha))}</td></tr>
    <tr><th>Proyecto</th><td>${esc(p.nombre||"")}</td><th>Revisión</th><td>${esc(di.rev||"A")}</td></tr>
    <tr><th>Documento</th><td class="mono">${esc(di.codigo||"")}</td><th>P&amp;ID</th><td class="mono">${esc(p.pidRef||"—")}</td></tr></table>`;
}
function fmtF(f){ const m = String(f||"").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (f||""); }
function tablaHTML(cols, filas, totales){
  return `<div class="table-wrap"><table class="xl-table"><thead><tr>${cols.map(c=>`<th>${esc(c[0])}</th>`).join("")}</tr></thead><tbody>${filas.map((f,i)=>`<tr>${cols.map(c=>{ const v = c[1]==="#" ? i+1 : f[c[1]]; return `<td class="${typeof v==="number"?"num":""}">${esc(v==null?"":String(v)).replace(/\n/g,"<br>")}</td>`; }).join("")}</tr>`).join("") || `<tr><td colspan="${cols.length}" class="muted" style="text-align:center;padding:16px">Sin registros — completa los datos de entrada.</td></tr>`}${totales||""}</tbody></table></div>`;
}
function vistaTabla(body, p, id, titulo, cols, filas, extra){
  body.innerHTML = cabeceraHoja(p, id, titulo) + tablaHTML(cols, filas) + (extra||"") + `</div>` + pieVista(p, id);
}
function pieVista(p, id){ return `<p class="muted mt-2" style="font-size:12px">Vista de los valores. La descarga incluye carátula, estilos, fórmulas, logos y revisiones del formato.</p>`; }

function vistaCargas(body, p, id){
  const calcs = calcularTodos(p);
  const lista = calcs.length ? calcs.map(c=>c.tablero) : [tf(p)];
  body.innerHTML = lista.map(t=>{
    const tb = tablasCargas(p, t), c = tb.calc;
    const filas = tb.cargas.map(f=>Object.assign({}, f, { fp:+f.fp, eff:+f.eff }));
    const tot = `<tr class="xl-total"><td colspan="10" style="text-align:right">CARGA TOTAL</td><td class="num">${r2(c.installedKVA,2)}</td><td class="num">${r2(c.totalKVA,2)}</td></tr>`;
    return cabeceraHoja(p, id, "LISTADO DE CARGAS") +
      `<div class="xl-band">${esc(`${datos(p).sistema.nombre ? datos(p).sistema.nombre+" - " : ""}${t.nombre} ${t.tag}`.toUpperCase())}</div>` +
      tablaHTML([["ÍTEM","#"],["TAG","tag"],["DESCRIPCIÓN","descripcion"],["HP","hp"],["kW","kw"],["In (A)","_in"],["FDP","fp"],["EFF","eff"],["FU","fu"],["FS","fs"],["S inst. (kVA)","_si"],["MD (kVA)","_md"]], filas, tot) +
      `<div class="stat-row mt-2"><div class="stat"><div class="k">Potencia instalada</div><div class="v">${r2(c.installedKVA,1)} kVA</div></div><div class="stat"><div class="k">Máxima demanda</div><div class="v">${r2(c.totalKVA,1)} kVA</div></div><div class="stat"><div class="k">I máxima demanda</div><div class="v">${r2(c.demandCurrent,1)} A</div></div><div class="stat"><div class="k">Interruptor general</div><div class="v">3x${c.mainBreaker} A</div></div></div>` +
      (tb.cargas_control.length ? `<h3 class="ed-sub mt-2">Lista de cargas estabilizada</h3>` + tablaHTML([["ÍTEM","n"],["DESCRIPCIÓN","descripcion"],["FDP","fp"],["FU","fu"],["FS","fs"],["P (kW)","kw"]], tb.cargas_control) : "") + `</div>`;
  }).join('<div class="mt-2"></div>') + pieVista(p, id);
}
function vistaHDEq(body, p, id){
  const lista = tableros(p); let sel = lista[0].id;
  const render = ()=>{
    const t = lista.find(x=>x.id===sel); const c = camposHDEq(p, t);
    body.innerHTML = `<div class="row mb-2"><label class="muted">Hoja</label><select id="hd-sel">${lista.map(x=>`<option value="${x.id}" ${x.id===sel?"selected":""}>${esc(x.tag)}</option>`).join("")}</select><span class="muted">${lista.length} hoja(s) + carátula + índice</span></div>` +
      cabeceraHoja(p, id, c.titulo) + `<div class="table-wrap"><table class="xl-table"><thead><tr><th>No.</th><th>DESCRIPCIÓN</th><th>UNIDAD</th><th>INFORMACIÓN</th></tr></thead><tbody>${c.filas.map(f=> f.__var ? `<tr class="xl-sec"><td colspan="4">${esc(f.texto)}</td></tr>` : `<tr><td class="num">${f.n}</td><td>${esc(f.desc)}</td><td>${esc(f.unidad||"")}</td><td>${esc(f.valor??"")}</td></tr>`).join("")}</tbody></table></div></div>` + pieVista(p, id);
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
      cabeceraHoja(p, id, c.titulo) + `<div class="table-wrap"><table class="xl-table"><thead><tr><th>No.</th><th>DESCRIPCIÓN</th><th>UNIDAD</th><th>INFORMACIÓN</th><th>NOTAS</th></tr></thead><tbody>${c.filas.map(f=> f.__var ? `<tr class="xl-sec"><td colspan="5">${esc(f.texto)}</td></tr>` : `<tr><td class="num">${f.n}</td><td>${esc(f.desc)}</td><td>${esc(f.unidad)}</td><td>${esc(f.valor??"")}</td><td>${esc(f.nota||"")}</td></tr>`).join("")}</tbody></table></div></div>` + pieVista(p, id);
    $("#hd-sel").onchange = e=>{ sel = e.target.value; render(); };
  };
  render();
}

function vistaMemoria(body, p, id, tipo){
  const m = datosMemoria(p);
  const md = `<h3 class="ed-sub">${tipo==="md" ? "Anexo A" : "Resumen"} — Máxima demanda</h3>${tablaHTML([["Ítem","n"],["Tag","tag"],["Descripción","descripcion"],["P (kW)","kw"],["cos φ","fp"],["η","eff"],["S inst. (kVA)","si"],["FU","fu"],["FS","fs"],["MD (kVA)","md"],["In (A)","in"]], m.anexo_md)}`;
  const cond = `<h3 class="ed-sub mt-2">Anexo A — Conductores</h3>${tablaHTML([["Circ.","circuito"],["Hasta","hasta"],["In (A)","i"],["Id (A)","id"],["L (m)","l"],["Calibre","calibre"],["Iadm (A)","iadm"],["KT","ktot"],["Ic (A)","icorr"],["ΔV (%)","dv_pct"],["EGC","egc"],["Referencia","modelo"]], m.anexo_cables)}
    <h3 class="ed-sub mt-2">Anexo B — Protecciones</h3>${tablaHTML([["Circ.","circuito"],["Descripción","descripcion"],["In (A)","i"],["Tipo","tipo"],["Dispositivo","modelo"],["Ajuste","iprot"]], m.anexo_prot)}`;
  body.innerHTML = `<div class="doc-prev"><div class="doc-cover"><div class="muted">${esc(p.cliente||"")}</div><h2>${esc(tituloDoc(p,id))}</h2><div class="mono">${esc(codigoDe(p,id))}</div></div>
    <div class="stat-row"><div class="stat"><div class="k">Potencia instalada</div><div class="v">${m.pi_total} kVA</div></div><div class="stat"><div class="k">Máxima demanda</div><div class="v">${m.md_total} kVA</div></div><div class="stat"><div class="k">I máx. demanda</div><div class="v">${m.i_md_total} A</div></div><div class="stat"><div class="k">Interruptor general</div><div class="v" style="font-size:14px">${esc(m.itm_general)}</div></div></div>
    ${tipo==="md" ? md : cond}
    <p class="muted mt-2" style="font-size:12px">El Word incluye además generalidades, normas, procedimiento, cálculo por ${tipo==="md" ? "tablero y carga" : "cable y protección"} e índice.</p></div>`;
}
function vistaTexto(body, p, id, def){
  const secs = def.secciones(p);
  body.innerHTML = `<div class="doc-prev">${secs.map(s=>`<h3 class="ed-sub">${esc(s.titulo)}</h3>${s.texto?`<p>${esc(s.texto)}</p>`:""}${s.items.length?`<ul>${s.items.map(i=>`<li>${esc(i)}</li>`).join("")}</ul>`:""}`).join("")}</div>`;
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
    <div class="plano-view"><canvas id="pl-cv"></canvas></div>
    <p class="muted mt-2" style="font-size:12px">DXF R12 · capas G-, I-, E- con sus colores${r.lazos!=null?` · ${r.lazos} lazo(s)`:""}.</p>`;
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
    const col = l=>({ "I-SE-ANALO":"#1d6fb8","I-PROTOCOL":"#1d6fb8","I-FZA-AC":"#b8336a","E-FZA-BT-PRI":"#b8336a","E-FZA":"#b8336a","I-FZA-DC":"#7a4fbf","I-TIERRA":"#2e8b57","E-TIERRA":"#2e8b57","I-CONTROL":"#c27c0e","E-CONTROL":"#c27c0e" }[l] || "#1b2a3c");
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
        if(e.align===1){ ctx.textAlign = "center"; } ctx.fillText(e.text.replace(/%%[dD]/g,"°").replace(/%%[cC]/g,"Ø"), 0, 0); ctx.restore();
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
}

/* ---------------- 3. cajetín y revisiones ---------------- */
function tabCajetin(body, state, p, id, def){
  const d = p.documentos[id]; docInfo(p, id);
  const org = state.org;
  const render = ()=>{
    body.innerHTML = html`<div class="grid-2">
      <div class="card"><div class="card-head"><h2>Identificación</h2><span class="muted" style="font-size:12px">Firmas vacías = las de <a href="#/organizacion">tu organización</a></span></div><div class="card-body">
        <div class="field"><label>Código del documento</label><input type="text" class="mono" data-f="codigo" value="${esc(d.codigo)}"><span class="hint">Automático; si lo cambias queda fijo.</span></div>
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
    ${def.formato==="dxf" ? `<div class="card mt-2"><div class="card-head"><h2>Planos de referencia (cajetín)</h2><button class="btn-sm" id="rf-auto">Volver a sugerir</button></div><div class="card-body" id="refs"></div></div>` : ""}`;
    $$("[data-f]", body).forEach(i=>i.onchange = ()=>{ d[i.dataset.f] = i.value; if(i.dataset.f==="codigo") d.codigoManual = true; S.save(); });
    $$("[data-rv]", body).forEach(i=>i.onchange = ()=>{ d.revisiones[+i.closest("tr").dataset.r][i.dataset.rv] = i.value; S.save(); });
    $$("[data-rdel]", body).forEach(b=>b.onclick = ()=>{ d.revisiones.splice(+b.closest("tr").dataset.r, 1); S.save(); render(); });
    $("#rv-add").onclick = ()=>{ const last = d.revisiones[d.revisiones.length-1]; const sig = nextRev(last.rev); d.revisiones.push({ rev:sig, fecha:new Date().toISOString().slice(0,10), descripcion: /^\d+$/.test(sig) ? "Emitido para construcción" : "Emitido para revisión del cliente" }); S.save(); render(); };
    if(def.formato==="dxf"){
      const rf = $("#refs");
      const draw = ()=>{ rf.innerHTML = `${d.referencias.map((r,i)=>`<div class="row mb-1" data-i="${i}"><input type="text" class="mono" data-rf="codigo" value="${esc(r.codigo)}" style="width:280px"><input type="text" data-rf="titulo" value="${esc(r.titulo)}" style="flex:1"><button class="btn-ghost btn-sm" data-rfdel>${ICON.trash}</button></div>`).join("")}<button class="btn-sm" id="rf-add">${ICON.plus} Agregar</button>`;
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

/* ---------------- plantilla ---------------- */
async function tabPlantilla(body, state, p, id, def, tpl){
  const d = p.documentos[id];
  if(def.formato==="dxf"){
    const pl = p.plantillas||{}; const has = k=>!!pl[k];
    body.innerHTML = `<div class="grid-2"><div class="card"><div class="card-head"><h2>Formato estándar</h2></div><div class="card-body">
      <p>Lámina A1 con cuadrícula, revisiones, referencias y rótulo, llenados con los datos del proyecto y de <a href="#/organizacion">tu organización</a>.</p>
      <p class="muted">Base: ${esc(def.ref)}</p></div></div>
      <div class="card"><div class="card-head"><h2>Formato del cliente</h2><span class="badge ${p.plantillaModo==="cliente" && (has("dxf_formato")||has("dxf_cajetin")) ? "badge-ok" : "badge-neutral"}">${p.plantillaModo==="cliente" && (has("dxf_formato")||has("dxf_cajetin")) ? "En uso" : "No cargado"}</span></div><div class="card-body">
      <p>Lámina, cajetín y CTB del cliente: se cargan una vez y aplican a todos los planos.</p>
      <ul class="muted"><li>Formato (lámina): ${has("dxf_formato")?"cargado":"—"}</li><li>Cajetín: ${has("dxf_cajetin")?"cargado":"—"}</li><li>Plumillas CTB: ${has("ctb")?"cargado":"—"}</li></ul>
      <div class="row"><a class="btn btn-sm" href="#/proyecto/${p.id}/plantillas">Gestionar formatos del cliente</a>${has("ctb")?`<button class="btn-sm" id="dl-ctb">${ICON.download} Descargar CTB</button>`:""}</div></div></div></div>`;
    const b = $("#dl-ctb"); if(b) b.onclick = async ()=>{ const f = await S.leerArchivo(pl.ctb); X.descargar(f.blob, f.nombre, "application/octet-stream"); };
    return;
  }
  const ext = def.formato;
  const tokensDoc = await marcadoresDisponibles(p, id, def);
  body.innerHTML = `<div class="grid-2">
    <div class="card"><div class="card-head"><h2>Formato estándar</h2>${!tpl || d.usarPlantilla===false ? '<span class="badge badge-ok">En uso</span>' : ""}</div><div class="card-body">
      <p>${def.estandar || def.texto ? "Carátula y cuerpo estándar de Ingenia." : `Basada en <strong>${esc(def.ref)}</strong>, con el logo de <a href="#/organizacion">tu organización</a> y del cliente.`}</p>
      ${def.plantilla && !def.estandar ? `<a class="btn btn-sm" href="assets/plantillas/${esc(def.plantilla)}" download>${ICON.download} Descargar formato estándar</a>` : ""}
    </div></div>
    <div class="card"><div class="card-head"><h2>Plantilla del cliente</h2>${tpl && d.usarPlantilla!==false ? '<span class="badge badge-ok">En uso</span>' : ""}</div><div class="card-body" id="tpl-cli"></div></div>
  </div>
  <div class="card mt-2"><div class="card-head"><h2>Marcadores para esta plantilla</h2><span class="muted">Cópialos en el formato del cliente</span></div><div class="card-body" style="font-size:13px">${tokensDoc}</div></div>`;
  const cli = $("#tpl-cli");
  if(tpl){
    cli.innerHTML = `<div class="tpl-row"><div>${ICON.file} <strong>${esc(tpl.nombre)}</strong> <span class="muted">· ${kb(tpl.size)} · ${fmtFecha(tpl.creado)}</span><div class="tokens mt-1">${(tpl.info&&tpl.info.tokens||[]).slice(0,40).map(t=>`<span class="chip">${esc(t)}</span>`).join("") || '<span class="badge badge-warn">Sin marcadores: se descargará sin datos del proyecto</span>'}</div></div><div class="row"><label class="checkbox"><input type="checkbox" id="tpl-use" ${d.usarPlantilla!==false?"checked":""}> Usar</label><button class="btn-sm btn-danger" id="tpl-del">${ICON.trash}</button></div></div>`;
    $("#tpl-use").onchange = e=>{ d.usarPlantilla = e.target.checked; S.save(); location.reload(); };
    $("#tpl-del").onclick = async ()=>{ await S.borrarArchivo(d.plantilla); delete d.plantilla; S.save(); location.reload(); };
  } else {
    cli.innerHTML = `<p class="muted">${ext==="xlsx"?"Excel":"Word"} del cliente con los marcadores de abajo.</p><div class="dropzone" id="tpl-drop"><strong>Arrastra el .${ext}</strong> o haz clic</div>`;
    dropzone($("#tpl-drop"), "."+ext, async file=>{
      try{
        const buf = await leerComoArrayBuffer(file);
        const info = ext==="xlsx" ? await marcadoresExcel(window.ExcelJS, buf) : { tokens: X.tokensDePlantillaWord(buf) };
        d.plantilla = await S.guardarArchivo({ tipo:"doc-"+ext, proyectoId:p.id, docId:id, nombre:file.name, size:file.size, info }, file);
        d.usarPlantilla = true; S.save(); toast("Plantilla del cliente cargada"); location.reload();
      }catch(err){ toast("No se pudo leer la plantilla: "+(err.message||err), true, 6000); }
    });
  }
}
async function marcadoresDisponibles(p, id, def){
  const comunes = ["{{proyecto}}","{{cliente}}","{{unidad}}","{{etapa}}","{{disciplina}}","{{titulo}}","{{codigo}}","{{rev}}","{{fecha}}","{{org}}","{{org_corto}}","{{referencia}}","{{elaboro}}","{{reviso}}","{{aprobo}}","{{rev1.rev}} {{rev1.fecha}} {{rev1.descripcion}} {{rev1.elaboro}} …"];
  if(def.formato==="docx") return `<p>Word (etiquetas docxtemplater): <span class="tokens">${["{proyecto}","{cliente}","{titulo}","{codigo}","{rev}","{fecha}","{org}","{#revisiones}{rev} {fecha} {descripcion} {elaboro} {reviso} {aprobo}{/revisiones}"].concat(def.secciones?["{#secciones}{titulo} {texto} {#items}{.}{/items}{/secciones}"]:id==="ele-md"?["{#tableros}{nombre} {tag} {#cargas}…{/cargas} {s_global} {dm_global} {i_md}{/tableros}","{#anexo_md}…{/anexo_md}","{pi_total} {md_total} {i_md_total}"]:["{#cables}…{/cables}","{#protecciones}…{/protecciones}","{#anexo_cables}…{/anexo_cables}","{#anexo_prot}…{/anexo_prot}"]).map(t=>`<span class="chip">${esc(t)}</span>`).join("")}</span></p><p class="muted">Lo más práctico: descarga la plantilla por defecto, copia sus etiquetas al formato del cliente y cárgalo.</p>`;
  let tablas = "";
  try{
    const pay = await payloadExcel(p, id, {});
    const ts = Object.entries(pay.tablas||{}).concat(pay.clonar ? [["campos (hoja por instrumento)", pay.clonar.instancias[0] ? pay.clonar.instancias[0].tablas.campos : []]] : []);
    tablas = ts.map(([n, filas])=>{ const cols = new Set(); (filas||[]).slice(0,5).forEach(f=>Object.keys(f).filter(k=>!k.startsWith("_")).forEach(k=>cols.add(k))); return `<div class="mt-1"><span class="chip">{{tabla:${esc(n.split(" ")[0])}}}</span> → ${[...cols].map(c=>`<span class="chip">{{col:${esc(c)}}}</span>`).join(" ")}</div>`; }).join("");
  }catch(e){}
  return `<p>Celdas: <span class="tokens">${comunes.map(t=>`<span class="chip">${esc(t)}</span>`).join("")}</span></p><p class="mt-2">Filas que se repiten (pon <span class="chip">{{tabla:NOMBRE}}</span> en cualquier celda de la fila modelo y <span class="chip">{{col:clave}}</span> en cada columna; <span class="chip">{{col:clave|unir}}</span> combina celdas iguales):</p>${tablas}<p class="muted mt-2">Las fórmulas de la fila modelo se copian a cada fila y los totales del tipo SUM(fila modelo) se amplían automáticamente.</p>`;
}

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
    const nombre = ext => ((di.codigo||"documento")+"_Rev"+(di.rev||"A")).replace(/[^\w\-.]+/g,"_")+"."+ext;
    const dd = p.documentos[id];
    const tplCli = dd.plantilla && dd.usarPlantilla!==false ? await S.leerArchivo(dd.plantilla) : null;
    if(def.formato==="dxf"){
      const r = await generarPlano(p, id, org, await logosPlano(org, p));
      X.descargar(new Blob([dxfBytes(r.dxf)], { type:"application/dxf" }), nombre("dxf"), "application/dxf");
    } else if(def.formato==="proceso"){ toast("Este entorno no genera archivo: alimenta el listado de instrumentos."); return;
    } else if(def.estandar || (def.texto && !tplCli)){
      // formatos estándar previos (lista de documentos, cables, criterios)
      const ctx = { org, proyecto:{ nombre:p.nombre, cliente:p.cliente, unidad:p.unidad, codigo:p.codigo, etapaNombre:"" }, doc:{ codigo:di.codigo, titulo:tituloDoc(p,id), rev:di.rev, fecha:di.fecha, disciplina:DISCIPLINAS[e.disciplina].nombre, emitidoPara:di.emitido, referencia:p.pidRef||"" }, revisiones: di.revisiones.map(r=>Object.assign({ elaboro:di.elaboro||org.elaboraPor, reviso:di.reviso||org.revisaPor, aprobo:di.aprobo||org.apruebaPor }, r)), tablas:{}, campos:{} };
      if(false){
      } else if(id==="gen-registro"){
        const filas = p.entregables.map(entregable).filter(Boolean).map((x,i)=>{ const d=p.documentos[x.id]||{}; return { item:i+1, codigo:d.codigo, titulo:x.nombre, disciplina:DISCIPLINAS[x.disciplina].nombre, tipo:TIPOS[x.tipo], rev:d.rev, fecha:d.fecha, emitido:d.emitido||"", estado:d.estado }; });
        ctx.tablas = { "Lista de documentos": { titulo:"Lista de documentos / entregables", columnas:[{key:"item",titulo:"Ítem",ancho:6,num:true},{key:"codigo",titulo:"Código de documento",ancho:30},{key:"titulo",titulo:"Título",ancho:48},{key:"disciplina",titulo:"Disciplina",ancho:22},{key:"tipo",titulo:"Tipo",ancho:18},{key:"rev",titulo:"Rev.",ancho:6,center:true},{key:"fecha",titulo:"Fecha",ancho:12},{key:"emitido",titulo:"Emitido para",ancho:26},{key:"estado",titulo:"Estado",ancho:14}], filas } };
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
      const out = await rellenarExcel(window.ExcelJS, buf, Object.assign({}, pay, { manifiesto: man, logos }));
      X.descargar(out, nombre("xlsx"), X.MIME.xlsx);
    } else if(def.formato==="docx"){
      const base = def.aliasDe || id;
      const extra = (base==="ele-mc" || base==="ele-md") ? datosMemoria(p) : def.secciones ? { secciones: def.secciones(p) } : {};
      const scal = escalares(p, id, org);
      const data = Object.assign({}, scal, { cliente_corto:(p.cliente||"").toUpperCase(), numero_proyecto:p.codigo||"", orden_compra:p.ordenCompra||"", revisiones: di.revisiones.map(r=>({ rev:r.rev, fecha:fmtF(r.fecha), descripcion:r.descripcion, elaboro:r.elaboro||scal.elaboro, reviso:r.reviso||scal.reviso, aprobo:r.aprobo||scal.aprobo })) }, extra);
      delete data._calc;
      let buf = tplCli ? await tplCli.blob.arrayBuffer() : await (await fetch("assets/plantillas/"+def.plantilla)).arrayBuffer();
      const zip = new PizZip(buf);
      if(!tplCli) await logosWord(zip, await logoPNG(org.logoDataURL), await logoCliente(p));
      const doc = new window.docxtemplater(zip, { paragraphLoop:true, linebreaks:true, nullGetter:()=>"" });
      doc.render(data);
      X.descargar(doc.getZip().generate({ type:"arraybuffer", compression:"DEFLATE", mimeType:X.MIME.docx }), nombre("docx"), X.MIME.docx);
    }
    if(dd.estado==="Por elaborar"){ dd.estado = "En elaboración"; S.save(); }
    toast("Documento generado: "+(di.codigo||e.nombre));
  }catch(err){
    console.error(err);
    const msg = err.properties && err.properties.errors ? err.properties.errors.map(x=>x.properties.explanation).slice(0,3).join(" · ") : (err.message||String(err));
    toast("No se pudo generar: "+msg, true, 8000);
  }finally{ if(btn){ btn.disabled = false; btn.innerHTML = lbl; } }
}

/* logos en el encabezado de la plantilla Word por defecto: image1 = organización, image2 = cliente */
async function logosWord(zip, org, cli){
  const b64 = d => d.dataURL.split(",")[1];
  const relsF = "word/_rels/header1.xml.rels", hdrF = "word/header1.xml";
  if(!zip.file(relsF) || !zip.file(hdrF)) return;
  const rels = zip.file(relsF).asText(); let hdr = zip.file(hdrF).asText();
  const rid = target => (rels.match(new RegExp('Id="(rId\\d+)"[^>]*Target="media/'+target+'"'))||rels.match(new RegExp('Target="media/'+target+'"[^>]*Id="(rId\\d+)"'))||[])[1];
  const ajustar = (r, aspect)=>{
    if(!r) return;
    hdr = hdr.replace(new RegExp('(<w:drawing>(?:(?!</w:drawing>).)*?r:embed="'+r+'"(?:(?!</w:drawing>).)*?</w:drawing>)', "s"), blk=>{
      const m = blk.match(/<wp:extent cx="(\d+)" cy="(\d+)"/); if(!m) return blk;
      const cx0 = +m[1], cy0 = +m[2]; let cy = cy0, cx = Math.round(cy*aspect); if(cx>cx0*1.6){ cx = Math.round(cx0*1.6); cy = Math.round(cx/aspect); }
      return blk.replace(/(<wp:extent )cx="\d+" cy="\d+"/, `$1cx="${cx}" cy="${cy}"`).replace(/(<a:ext )cx="\d+" cy="\d+"/, `$1cx="${cx}" cy="${cy}"`);
    });
  };
  if(org){ zip.file("word/media/image1.png", b64(org), { base64:true }); ajustar(rid("image1.png"), org.aspect); }
  if(cli){ zip.file("word/media/image2.png", b64(cli), { base64:true }); ajustar(rid("image2.png"), cli.aspect); }
  zip.file(hdrF, hdr);
}

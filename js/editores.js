/* Ingenia — formularios de datos de entrada (se muestran solo los que usa cada documento). */
import { $, $$, esc, html, ICON, toast, dropzone, spinner } from "./ui.js";
import * as S from "./store.js";
import { save } from "./store.js";
import { PARAMETROS_DISENO, valoresDiseno, tensionControlTxt } from "./modules/criterios.js";
import { renderEditor } from "./modules/tablas.js";
import { arrastrarFilas, moverEn, colorTablero } from "./filas.js";
import { datos, nuevaCarga, derivarIO, derivarCircuitosControl, circuitosControl, dimensionarCircuito, instrumentos, sistemaTag, uidc, APPLICATIONS,
  TIPOS_TABLERO, nuevoTablero, tableros, tablerosPotencia, tablerosControl, tableroPorId, esControl, esFuerza, tf, tc, desdeTxt, aplicarTipicos, REGIMENES,
  calcularTablero, CLASES_CABLE, CANALIZACIONES, cablesFuerza, ipRecomendado, r2, accesoriosTablero, ACC_PROTECCION, ACC_ACCESORIOS, TIPOS_OVR, ovrTablero, calcularTodos, controlInterno,
  TIPOS_CARGA_TRAFO, APLIC_CARGA_TRAFO, UNIDADES_CARGA_TRAFO, nuevaCargaTrafo, vaCargaTrafo, aplicarPotenciaTrafo, aplicarPotenciaTipica } from "./datos.js";
import { camposHD, camposHDEq } from "./docs.js";
import { filosofiaDe, filosofiaAuto, guardarTabla, guardarTexto, guardarAreas, filosofiaOps, arquitecturaSVG, TEXTOS_FIL, TIPOS_ALARMA, TIPOS_INTERLOCK } from "./modules/filosofia.js";
import { EQUIPOS_PROCESO, recomendarInstrumentos } from "./modules/proceso.js";
import { elementosArreglo, sugerirTableros } from "./cad/planos2.js";
import { parseDXF, drawPreview } from "./dxf.js";
import { cfgMecanico, arregloTablero } from "./mecanico/arreglo.js";
import { FAMILIAS_MARCA, marcasProyecto, modeloEnMarca, modeloCorto } from "./engine/marcas.js";
import { arregloControl } from "./mecanico/arreglo-control.js";
import { TECHOS, NOMBRE_DISP } from "./mecanico/accesorios.js";
import { FAMILIAS, LISTA_FAMILIAS, familiaPorTexto, modeloFamilia, modulosFamilia, infoModulo } from "./control/plc-modulos.js";

export const TITULOS = {
  criterios:"Criterios de diseño", cargas:"Cargas de los tableros de fuerza", cargasControl:"Cargas de los tableros de control",
  tableros:"Tableros del proyecto", marcas:"Marcas de los equipos", instrumentos:"Listado de instrumentos", io:"Lista de entradas y salidas", tablerocontrol:"Configuración de los tableros de control", circuitos:"Circuitos de los tableros de control",
  memoria:"Criterios de la memoria de cálculo", hd:"Datos por instrumento", hdEq:"Datos por tablero", notas:"Notas del documento", cables:"Cables por carga",
  equiposCfg:"Alcance del listado", proceso:"Proceso y recomendación de instrumentos", filosofia:"Filosofía de control", arreglo:"Planta y ubicación de equipos",
  mecanico:"Arreglo mecánico del tablero",
};

export function renderEditores(cont, p, claves, docId, onChange){
  cont.innerHTML = claves.map(k=>`<section class="card ed-card" data-ed="${k}"><div class="card-head"><h2>${esc(TITULOS[k]||k)}</h2></div><div class="card-body" id="ed-${k}"></div></section>`).join("");
  const cambio = ()=>{ save(); if(onChange) onChange(); };
  for(const k of claves){ const el = $("#ed-"+k, cont); const fn = ED[k]; if(fn) fn(el, p, cambio, docId); }
}

/* ---------------- utilidades ---------------- */
function campo(label, h, ayuda, cls=""){ return `<div class="field ${cls}"><label>${esc(label)}</label>${h}${ayuda?`<span class="hint">${ayuda}</span>`:""}</div>`; }
function inp(key, val, tipo="text", extra=""){ return `<input type="${tipo}" data-k="${key}" value="${esc(val??"")}" ${extra}>`; }
function sel(key, val, ops){ return `<select data-k="${key}">${ops.map(o=>{ const [v,l] = Array.isArray(o)?o:[o,o]; return `<option value="${esc(v)}" ${String(val)===String(v)?"selected":""}>${esc(l)}</option>`; }).join("")}</select>`; }
function bindObj(el, obj, cambio, num=[]){
  $$("[data-k]", el).forEach(i=>i.addEventListener("change", ()=>{
    const k = i.dataset.k;
    obj[k] = i.type==="checkbox" ? i.checked : (i.type==="number" || num.includes(k)) ? (i.value===""?"":parseFloat(i.value)) : i.value;
    cambio();
  }));
}
function selectorTablero(lista, actual, attr="data-tsel"){
  return `<div class="row mb-2"><label class="muted">Tablero</label><select ${attr}>${lista.map(t=>`<option value="${t.id}" ${t.id===actual?"selected":""}>${esc(t.tag)} — ${esc(t.nombre)}</option>`).join("")}</select></div>`;
}

/* campos de diseño (asistente de proyecto y criterios): los numéricos solo aceptan números */
export function campoDiseno(c, v){
  const num = (key, val, c)=>`<input type="text" inputmode="decimal" autocomplete="off" data-dis="${key}" data-num="${c.neg?"neg":"pos"}" value="${esc(val??"")}" placeholder="${esc(c.ph||"")}">`;
  let ctrl;
  if(c.tipo==="select") ctrl = `<select data-dis="${c.key}">${[...new Set([...c.opciones, v[c.key]].filter(x=>x!=null && x!==""))].map(o=>`<option ${String(v[c.key])===String(o)?"selected":""}>${esc(o)}</option>`).join("")}</select>`;
  else if(c.tipo==="numero") ctrl = num(c.key, v[c.key], c);
  else if(c.tipo==="tension") ctrl = `<div class="row nowrap" style="gap:6px">${num(c.key, v[c.key], c)}<select data-dis="${c.unidad}" style="width:86px;flex:none" aria-label="Tipo de tensión">${c.unidades.map(u=>`<option ${v[c.unidad]===u?"selected":""}>${u}</option>`).join("")}</select></div>`;
  else ctrl = `<input type="text" data-dis="${c.key}" value="${esc(v[c.key]??"")}" placeholder="${esc(c.ph||"")}">`;
  return campo(c.label, ctrl, c.hint ? esc(c.hint) : "");
}
/* enlaza los campos de diseño de un contenedor: limpia lo que no sea número y avisa cada cambio */
export function enlazarDiseno(root, onCambio){
  $$("[data-dis]", root).forEach(i=>{
    if(i.dataset.num) i.addEventListener("input", ()=>{
      const neg = i.dataset.num==="neg";
      let x = i.value.replace(",", ".").replace(neg ? /[^\d.\-]/g : /[^\d.]/g, "");
      if(neg) x = (x.startsWith("-") ? "-" : "") + x.replace(/-/g, "");
      const k = x.indexOf("."); if(k>=0) x = x.slice(0, k+1) + x.slice(k+1).replace(/\./g, "");
      if(x!==i.value) i.value = x;
    });
    i.addEventListener("change", ()=>onCambio(i.dataset.dis, i.value));
  });
}

/* tabla editable genérica */
function tablaEditable(el, { columnas, filas, nuevo, ejemplo, onChange, vacio, onCell, clase, extraBotones, mover, grupo }){
  // ancho de un campo: el mínimo de la columna o el del valor más largo (en caracteres), para que no se corte
  const anchoCol = c => { const largo = Math.max(String(c.t||"").length*0.6, ...filas.map(f=>String(f[c.k]??"").length));
    return `max(${c.w||110}px, calc(${Math.ceil(largo)}ch + ${c.n ? 34 : 18}px))`; };
  // listas: el mismo ancho en toda la columna (la opción más larga de todas sus filas)
  const anchoSel = c => Math.max(3, ...(typeof c.op==="function" ? filas.flatMap(f=>c.op(f)) : c.op).map(o=>String(Array.isArray(o)?o[1]:o).length));
  const render = ()=>{
    // al redibujar se conserva el desplazamiento horizontal de la tabla y el campo en edición
    const wrap0 = $(".table-wrap", el), sl = wrap0 ? wrap0.scrollLeft : 0;
    // filas de varios tableros (o transformadores) en la misma tabla: un fondo suave por grupo
    const colorG = colorTablero(grupo ? filas.map(grupo) : []);
    const act = document.activeElement && el.contains(document.activeElement) && document.activeElement.closest("tr[data-i]") && document.activeElement.closest(".table-wrap")===wrap0 ? { i: document.activeElement.closest("tr").dataset.i, c: document.activeElement.dataset.c } : null;
    el.innerHTML = html`<div class="row between mb-2"><div class="row">
        ${nuevo ? `<button class="btn-primary btn-sm" data-add>${ICON.plus} Agregar fila</button>` : ""}
        ${ejemplo ? `<button class="btn-sm" data-ej>Cargar ejemplo</button>` : ""}${extraBotones||""}
      </div><span class="muted">${filas.length} registro(s)</span></div>
      <div class="table-wrap"><table class="ed-table"><thead><tr>${columnas.map(c=>`<th>${esc(c.t)}</th>`).join("")}${nuevo?"<th></th>":""}</tr></thead>
      <tbody>${filas.map((f,i)=>`<tr data-i="${i}" class="${colorG(grupo ? grupo(f) : null)}" ${mover ? 'title="Mantén presionado un espacio libre de la fila para subirla o bajarla"' : ""}>${columnas.map(c=>{
        // valores centrados (la descripción a la izquierda) y anchos que crecen con el texto más largo de la columna
        const cls = (clase ? (clase(f, c.k)||"") : "") + (c.izq ? " izq" : "");
        if(c.calc) return `<td class="mono muted${c.izq?"":" centro"}">${esc(c.calc(f,i))}</td>`;
        const ro = c.ro ? c.ro(f) : null; if(ro!=null) return `<td class="mono muted centro" title="Calculado">${esc(ro)}</td>`;
        const ops = typeof c.op==="function" ? c.op(f) : c.op;
        if(ops){ const largo = anchoSel(c);
          return `<td><select data-c="${c.k}" class="${cls}" style="width:calc(${largo}ch + 34px)" ${ops.length===1?"disabled":""}>${ops.map(o=>{ const [v,l] = Array.isArray(o)?o:[o,o]; return `<option value="${esc(v)}" ${String(f[c.k]??"")===String(v)?"selected":""}>${esc(l)}</option>`; }).join("")}</select></td>`; }
        if(c.chk) return `<td style="text-align:center"><input type="checkbox" data-c="${c.k}" ${f[c.k]?"checked":""}></td>`;
        return `<td><input type="${c.n?"number":"text"}" ${c.n?'step="any"':""} data-c="${c.k}" value="${esc(f[c.k]??"")}" class="${cls}" style="width:${anchoCol(c)}"></td>`;
      }).join("")}${nuevo?`<td style="white-space:nowrap"><button class="btn-ghost btn-sm" data-del title="Eliminar">${ICON.trash}</button></td>`:""}</tr>`).join("") || `<tr><td colspan="${columnas.length+1}" class="muted" style="text-align:center;padding:20px">${esc(vacio||"Sin registros")}</td></tr>`}</tbody></table></div><div data-pie></div>`;
    const ad = $("[data-add]", el); if(ad) ad.onclick = ()=>{ filas.push(nuevo()); onChange(); render(); };
    const ej = $("[data-ej]", el); if(ej) ej.onclick = ()=>{ ejemplo().forEach(x=>filas.push(x)); onChange(); render(); toast("Ejemplo cargado — edítalo según tu proyecto"); };
    $$("[data-del]", el).forEach(b=>b.onclick = ()=>{ filas.splice(+b.closest("tr").dataset.i, 1); onChange(); render(); });
    // orden de las filas: manteniendo presionado un espacio libre de la fila se la arrastra hacia arriba o abajo
    if(mover && filas.length > 1) arrastrarFilas($("tbody", el), (i, j)=>{ moverEn(filas, i, j); onChange(); render(); });
    $$("[data-c]", el).forEach(inpEl=>inpEl.addEventListener("change", ()=>{
      const f = filas[+inpEl.closest("tr").dataset.i], c = columnas.find(x=>x.k===inpEl.dataset.c);
      f[c.k] = inpEl.type==="checkbox" ? inpEl.checked : c.n ? (inpEl.value===""?"":parseFloat(inpEl.value)) : inpEl.value;
      if(onCell) onCell(f, c.k);
      onChange(); if(c.rerender || onCell) render();
    }));
    if(el._pie) el._pie($("[data-pie]", el));
    const wrap1 = $(".table-wrap", el); if(wrap1) wrap1.scrollLeft = sl;
    if(act && act.c){ const x = $(`tr[data-i="${act.i}"] [data-c="${act.c}"]`, el); if(x){ x.focus({ preventScroll:true }); if(wrap1) wrap1.scrollLeft = sl; } }
  };
  el._render = render;
  render();
}

/* arranque y filtros del variador: N.A. en las cargas que no son motores (alimentador, carga general, transformador de
   control) y filtros N.A. si el motor no tiene variador; al volver a motor se proponen «Directo» y «Sin filtro» */
function normalizarArranque(l){
  if(l.kind!=="motor"){ l.starter = "na"; l.filtroVdf = "na"; return; }
  if(!l.starter || l.starter==="na") l.starter = "dol";
  if(l.starter!=="vfd") l.filtroVdf = "na"; else if(!l.filtroVdf || l.filtroVdf==="na") l.filtroVdf = "ninguno";
}

/* ---------------- editores ---------------- */
const ED = {
  mecanico(el, p, cambio, docId){
    // plano mecánico del tablero de control (ins-mecanico-tc): tableros de control con su propio motor de arreglo
    if(docId) el.dataset.doc = docId;
    const ctl = el.dataset.doc==="ins-mecanico-tc";
    const pot = ctl ? tablerosControl(p).filter(t=>t.tipo==="control") : tablerosPotencia(p);
    if(!pot.length){ el.innerHTML = `<div class="empty">El proyecto no tiene tableros de ${ctl ? "control" : "fuerza"}.</div>`; return; }
    const cur = el.dataset.t && pot.find(t=>t.id===el.dataset.t) ? el.dataset.t : pot[0].id;
    const t = pot.find(x=>x.id===cur), cfg = cfgMecanico(p, t), v = valoresDiseno(p);
    let m = null; try{ m = ctl ? arregloControl(p, t) : arregloTablero(p, t); }catch(err){ console.error(err); }
    const num = (k, ph) => `<input type="text" inputmode="numeric" data-mk="${k}" value="${esc(cfg[k]??"")}" placeholder="${esc(ph||"Automático")}">`;
    const opc = (k, ops) => `<select data-mk="${k}">${ops.map(([val, l])=>`<option value="${val}" ${String(cfg[k])===val?"selected":""}>${esc(l)}</option>`).join("")}</select>`;
    const sinCargas = m && m.calc && !m.calc.circuits.length;
    el.innerHTML = (pot.length>1 ? selectorTablero(pot, cur) : "") + `
      <div class="grid-3">
        ${campo("Montaje del gabinete", opc("montaje", [["auto","Automático"],["piso","Autosoportado (piso)"],["mural","Mural"]]), m ? `Elegido: ${m.montaje==="mural"?"mural":"autosoportado"}` : "")}
        ${campo("Entrada de cables", opc("entrada", [["inferior","Inferior"],["superior","Superior"]]))}
        ${campo("Reserva de espacio (%)", num("reserva", `Criterio del proyecto: ${v.reservaTablero} %`))}
        ${campo("Ancho total (mm)", num("ancho", m ? `Automático: ${m.W}` : ""), ctl ? "Mural: 400 a 1000; autosoportado: 600 a 1200" : "Secciones normalizadas de 600, 800, 1000 o 1200")}
        ${campo("Alto (mm)", num("alto", m ? `Automático: ${m.H}` : ""), ctl ? "Mural: 500 a 1200; autosoportado: 1800 a 2200" : "1800, 2000 o 2200 (mural: 500 a 1200)")}
        ${campo("Fondo (mm)", num("fondo", m ? `Automático: ${m.D}` : ""), ctl ? "Mural: 200 a 400; autosoportado: 400 a 800" : "400, 500, 600 u 800")}
        ${campo("Ventilación", opc("ventilacion", [["auto","Según balance térmico"],["natural","Natural"],["forzada","Forzada"]]), m ? `Balance térmico: ${m.termico.modo}` : "")}
        ${campo("Mandos en la puerta", ctl ? opc("mandos", [["auto","Automático (solo la pantalla HMI)"],["si","Sí: luces piloto de tensión presente"],["no","No"]]) : opc("mandos", [["auto","Automático (tablero de fuerza y control)"],["si","Sí: pulsadores, luces y selectores"],["no","No: luces de fase y parada de emergencia"]]))}
        ${campo("Calefacción anticondensación", opc("calefaccion", [["auto","Automático (T mín. ≤ 5 °C o exterior)"],["si","Sí"],["no","No"]]))}
        ${campo("Temperatura interior máxima (°C)", num("tInterior", "45"), "Para el balance térmico (IEC 60890)")}
      </div>
      <h3 class="ed-sub mt-2">Accesorios del tablero</h3>
      <div class="grid-3">
        ${campo("Techo", opc("techo", TECHOS), m && m.techoTipo ? `Se dibuja: ${m.techoTipo==="inclinado" ? "inclinado" : "plano con alero"}` : "")}
        <div class="field"><label>Accesorios</label><div class="acc-lista">
          ${ctl ? "" : `<label class="checkbox" title="Bloqueo con candado del mando del interruptor general (lock out / tag out)"><input type="checkbox" data-acct="lockout" ${accesoriosTablero(p, t).lockout ? "checked" : ""}> Lock out</label>
          <label class="checkbox" title="Luces piloto de presencia de las tres fases en la puerta"><input type="checkbox" data-acct="luces" ${accesoriosTablero(p, t).luces ? "checked" : ""}> Luces de energizado</label>`}
          <label class="checkbox" title="Cubierta antilluvia sobre los ventiladores y filtros de la puerta (abertura hacia abajo)"><input type="checkbox" data-mkb="caperuza" ${cfg.caperuza ? "checked" : ""}> Caperuza en los ventiladores${m && !m.puerta.some(d=>d.tipo==="ventilador"||d.tipo==="rejilla") ? ' <span class="muted">(sin ventiladores)</span>' : ""}</label>
          <label class="checkbox" title="Ventana de inspección IP66 con tapa abatible sobre los dispositivos de puerta que se elijan"><input type="checkbox" data-mkb="visor" ${cfg.visor ? "checked" : ""}> Visor sobre los componentes de puerta</label>
        </div></div>
        ${cfg.visor && m ? `<div class="field"><label>Equipos dentro del visor</label><div class="acc-lista">${m.dispositivosVisor.length ? m.dispositivosVisor.map(d=>{ const sel = Array.isArray(cfg.visorEquipos) && cfg.visorEquipos.length ? cfg.visorEquipos.includes(d.clave) : d.tipo!=="seta";
            return `<label class="checkbox"><input type="checkbox" data-vis="${esc(d.clave)}" ${sel ? "checked" : ""}> ${esc(NOMBRE_DISP[d.tipo]||d.tipo)} ${esc(d.tag)}${d.leyenda ? ` <span class="muted">(${esc(String(d.leyenda).toLowerCase())})</span>` : ""}</label>`; }).join("") : '<span class="muted">La puerta no tiene dispositivos.</span>'}</div><div class="muted" style="font-size:11.5px">Los que no tienen grado de protección propio para el ambiente (p. ej. IP66 a la intemperie).</div></div>` : ""}
      </div>
      <div id="mec-res"></div>`;
    const res = $("#mec-res", el);
    if(sinCargas) res.innerHTML = `<div class="notice mt-2">El tablero ${esc(t.tag)} aún no tiene cargas: agrégalas en el listado de cargas para armar el arreglo.</div>`;
    else if(m){
      const f = x => Math.round(x*10)/10;
      res.innerHTML = `<div class="stat-row mt-2"><div class="stat"><div class="k">Gabinete</div><div class="v" style="font-size:15px">${m.W} × ${m.H} × ${m.D} mm</div></div>
          <div class="stat"><div class="k">Secciones</div><div class="v" style="font-size:15px">${m.secciones.map(s=>s.W).join(" + ")} mm</div></div>
          <div class="stat"><div class="k">Pérdidas</div><div class="v" style="font-size:15px">${m.termico.perdidas} W</div></div>
          <div class="stat"><div class="k">Ventilación</div><div class="v" style="font-size:15px">${esc(m.termico.modo)}${m.termico.caudal ? ` · ${m.termico.caudal} m³/h` : ""}</div></div></div>
        ${m.avisos.length ? `<div class="notice warn mt-2">${m.avisos.map(esc).join("<br>")}</div>` : ""}
        <h3 class="ed-sub mt-2">Criterios de diseño aplicados</h3><ul class="mec-crit">${m.criterios.map(c=>`<li>${esc(c)}</li>`).join("")}</ul>
        <h3 class="ed-sub mt-2">Componentes con sus dimensiones (base de datos de Ingenia)</h3>
        <div class="table-wrap"><table class="ed-table"><thead><tr><th>TAG</th><th>Descripción</th><th>Modelo</th><th>Ancho × alto × fondo (mm)</th><th>Montaje</th><th>Fuente</th></tr></thead><tbody>
        ${m.comps.filter(c=>c.tag).map(c=>`<tr><td class="mono">${esc(c.tag)}</td><td>${esc(c.desc||"")}</td><td>${esc(c.modelo||"")}</td><td class="mono">${f(c.w)} × ${f(c.h)} × ${f(c.d||0)}</td><td>${esc({ din:"Riel DIN", placa:"Placa", base:"Base", contactor:"Bajo contactor" }[c.montaje]||"Placa")}</td><td class="muted" style="font-size:12px">${esc(c.fuente||"")}</td></tr>`).join("")}
        </tbody></table></div>
        <p class="muted mt-1" style="font-size:12px">Dimensiones referenciales de catálogo: verificar con el plano dimensional del código exacto antes de fabricar. Pídele cambios a Copito, por ejemplo: ${ctl ? `«Cambia el gabinete de ${esc(t.tag)} a 800x1000x300», «Mueve PS1 a la derecha», «Intercambia CR3 con CR4» o «Pon ventilación forzada en ${esc(t.tag)}»` : `«Cambia el gabinete de ${esc(t.tag)} a 1200x2000x600», «Entrada de cables superior en ${esc(t.tag)}» o «Ventilación forzada en ${esc(t.tag)}»`}.</p>`;
    }
    // accesorios: lock out y luces en el tablero; techo, caperuzas y visor en su configuración mecánica
    const rehacer = ()=>{ cambio(); res.innerHTML = spinner("Actualizando el arreglo…"); setTimeout(()=>ED.mecanico(el, p, cambio), 30); };
    $$("[data-acct]", el).forEach(i=>i.onchange = ()=>{ t.accesorios = t.accesorios || {}; t.accesorios[i.dataset.acct] = i.checked; rehacer(); });
    $$("[data-mkb]", el).forEach(i=>i.onchange = ()=>{ cfg[i.dataset.mkb] = i.checked; rehacer(); });
    $$("[data-vis]", el).forEach(i=>i.onchange = ()=>{ cfg.visorEquipos = $$("[data-vis]", el).filter(x=>x.checked).map(x=>x.dataset.vis); if(!cfg.visorEquipos.length) cfg.visorEquipos = ["__ninguno__"]; rehacer(); });
    $$("[data-mk]", el).forEach(i=>i.onchange = ()=>{
      const k = i.dataset.mk; let val = i.value.trim();
      if(["ancho","alto","fondo","reserva","tInterior"].includes(k)){ val = val.replace(/[^\d.]/g, ""); if(val!=="" && !(+val>0)){ toast("Ingresa un número", true); i.value = cfg[k]; return; } val = val==="" ? "" : +val; }
      cfg[k] = val; cambio();
      res.innerHTML = spinner("Actualizando el arreglo…");
      setTimeout(()=>ED.mecanico(el, p, cambio), 30);
    });
    const sl = $("[data-tsel]", el); if(sl) sl.onchange = ()=>{ el.dataset.t = sl.value; ED.mecanico(el, p, cambio); };
  },
  criterios(el, p, cambio){
    p.diseno = p.diseno || {}; const v = valoresDiseno(p);
    const g = PARAMETROS_DISENO.find(x=>/dimensionamiento/i.test(x.grupo));
    el.innerHTML = `<div class="grid-3">${g.campos.map(c=>campoDiseno(c, v)).join("")}</div>`;
    enlazarDiseno(el, (k, val)=>{ p.diseno[k] = val; cambio(); });
  },
  tableros(el, p, cambio){
    const d = datos(p);
    // ancho de un campo de texto según su contenido (los textos no se cortan)
    const ancho = (v, min) => `width:calc(${Math.max(min, String(v||"").length + 2)}ch + 18px)`;
    // protección de la acometida: supresor de sobretensiones (OVR, con su tipo) y relé de fases
    const proteccion = acc => { const tipo = acc.spd ? (TIPOS_OVR.some(x=>x[0]===acc.spdTipo) ? acc.spdTipo : "T1+2") : "";
      return `<div class="acc-lista"><label class="acc-ovr" title="Supresor de sobretensiones (OVR / SPD) de la acometida, según IEC 61643-11">OVR <select data-ovr>${[["", "Sin OVR", "El tablero no lleva supresor de sobretensiones"], ...TIPOS_OVR].map(([k, l, ayuda])=>`<option value="${esc(k)}" title="${esc(ayuda)}" ${tipo===k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
        ${ACC_PROTECCION.filter(([k])=>k!=="spd").map(([k, l, ayuda])=>`<label class="checkbox" title="${esc(ayuda)}"><input type="checkbox" data-acc="${k}" ${acc[k] ? "checked" : ""}> ${esc(l)}</label>`).join("")}</div>`; };
    const AYUDA_ACC = {
      ventilacion:"Ventiladores con filtro en la puerta y su circuito en el unifilar (automático: con variadores o arrancadores suaves)",
      calefaccion:"Resistencia anticondensación con termostato (automático: temperatura mínima ≤ 5 °C, exterior o altitud ≥ 3000 m)",
      lockout:"Bloqueo con candado del mando del interruptor general (lock out / tag out)",
      luces:"Luces piloto de presencia de las tres fases",
      luminaria:"Luminaria LED con interruptor de puerta y su circuito",
      tomacorriente:"Tomacorriente doble de servicio y su circuito",
    };
    const render = ()=>{
      const pot = tablerosPotencia(p), ctl = tablerosControl(p);
      el.innerHTML = `<div class="table-wrap"><table class="ed-table tb-tableros"><thead><tr><th>Tipo</th><th>TAG</th><th>Nombre</th><th>Alimentado desde</th><th>Controlado desde</th><th>Protección</th><th></th></tr></thead><tbody>
        ${d.tableros.map((t,i)=>{
          const conAcc = t.tipo!=="control", acc = conAcc ? accesoriosTablero(p, t) : {};
          const ctlInt = t.tipo==="fuerza" || t.tipo==="fuerzacontrol";
          return `<tr data-i="${i}"><td class="centro">${esc(TIPOS_TABLERO[t.tipo].nombre)}</td>
          <td><input type="text" class="mono" data-c="tag" value="${esc(t.tag)}" style="${ancho(t.tag, 9)}"></td><td><input type="text" data-c="nombre" value="${esc(t.nombre)}" style="${ancho(t.nombre, 18)}"></td>
          <td><div class="acc-lista"><select data-c="desde"><option value="">Externo / existente</option>${pot.filter(x=>x!==t).map(x=>`<option value="${x.id}" ${t.desde===x.id?"selected":""}>${esc(x.tag)}</option>`).join("")}</select>${t.desde?"":`<input type="text" data-c="desdeTexto" value="${esc(t.desdeTexto||"")}" placeholder="Ej: SE-01" style="${ancho(t.desdeTexto, 14)}">`}
            ${ctlInt ? `<label class="muted" style="font-size:11.5px;margin-top:4px">Control interno</label><select data-c="fuenteServicios" title="Alimentación del control interno (ventilación, luminaria, tomacorriente y tableros de control)"><option value="trafo" ${t.fuenteServicios!=="externa"?"selected":""}>Transformador propio</option><option value="externa" ${t.fuenteServicios==="externa"?"selected":""}>Segunda fuente externa</option></select>${t.fuenteServicios==="externa" ? `<input type="text" data-c="fuenteServiciosDesde" value="${esc(t.fuenteServiciosDesde||"")}" placeholder="Viene de… (ej: TD-02)" style="${ancho(t.fuenteServiciosDesde, 16)}">` : ""}` : ""}</div></td>
          <td class="centro">${esFuerza(t) && t.tipo!=="fuerzacontrol" ? `<select data-c="control"><option value="">${ctl[0] ? esc(ctl[0].tag)+" (por defecto)" : "—"}</option>${ctl.map(x=>`<option value="${x.id}" ${t.control===x.id?"selected":""}>${esc(x.tag)}</option>`).join("")}</select>` : `<span class="muted">—</span>`}</td>
          <td class="centro">${conAcc ? proteccion(acc) : '<span class="muted">—</span>'}</td>
          <td><button class="btn-ghost btn-sm" data-del title="Eliminar">${ICON.trash}</button></td></tr>`; }).join("")}
        </tbody></table></div>
        <div class="row mt-1">${Object.entries(TIPOS_TABLERO).map(([k,T])=>`<button class="btn-sm" data-addt="${k}">${ICON.plus} ${esc(T.nombre)}</button>`).join("")}</div>`;
      $$("[data-addt]", el).forEach(b=>b.onclick = ()=>{ const k = b.dataset.addt; d.tableros.push(nuevoTablero(k, d.tableros.filter(t=>t.tipo===k).length+1)); cambio(); render(); });
      $$("[data-del]", el).forEach(b=>b.onclick = ()=>{ const t = d.tableros[+b.closest("tr").dataset.i]; if(d.tableros.length<=1){ toast("El proyecto debe tener al menos un tablero", true); return; } d.tableros.splice(+b.closest("tr").dataset.i,1); d.tableros.forEach(x=>{ if(x.desde===t.id) x.desde=""; if(x.control===t.id) x.control=""; }); d.cargas.forEach(l=>{ if(l.tablero===t.id) l.tablero=""; }); instrumentos(p).forEach(i=>{ if(i.tablero===t.tag) i.tablero=""; }); cambio(); render(); });
      // ventilación y calefacción se guardan en la configuración mecánica del tablero (la usan el arreglo y el unifilar)
      $$("tr[data-i] [data-acc]", el).forEach(i=>i.onchange = ()=>{
        const t = d.tableros[+i.closest("tr").dataset.i], k = i.dataset.acc;
        if(k==="ventilacion" || k==="calefaccion"){ const cfg = cfgMecanico(p, t); cfg[k] = k==="ventilacion" ? (i.checked ? "forzada" : "natural") : (i.checked ? "si" : "no"); }
        else { t.accesorios = t.accesorios || {}; t.accesorios[k] = i.checked; }
        cambio();
      });
      // supresor de sobretensiones: sin OVR o el tipo elegido
      $$("tr[data-i] [data-ovr]", el).forEach(sl=>sl.onchange = ()=>{
        const t = d.tableros[+sl.closest("tr").dataset.i]; t.accesorios = t.accesorios || {};
        t.accesorios.spd = !!sl.value; if(sl.value) t.accesorios.spdTipo = sl.value; cambio();
      });
      $$("tr[data-i] [data-c]", el).forEach(i=>i.onchange = ()=>{
        const t = d.tableros[+i.closest("tr").dataset.i], k = i.dataset.c, v = i.value.trim();
        if(k==="tag"){ if(!v || d.tableros.some(x=>x!==t && x.tag===v)){ toast("TAG vacío o repetido", true); i.value = t.tag; return; } instrumentos(p).forEach(x=>{ if(x.tablero===t.tag) x.tablero = v; }); d["ins-io"].forEach(x=>{ if(x.tablero===t.tag) x.tablero = v; }); }
        t[k] = v; cambio(); if(k==="desde" || k==="fuenteServicios") render();
      });
    };
    render();
  },
  marcas(el, p, cambio){
    const d = datos(p);
    // equipos del proyecto por familia, con el modelo que resulta de la marca elegida
    const FAM_COMP = [["interruptores", /^ITM|^Interruptor/], ["maniobra", /^Guardamotor|^Contactor|^Relé de sobrecarga/], ["variadores", /^Variador/], ["arrancadores", /^Arrancador suave/]];
    const abiertos = new Set();
    const render = ()=>{
      const mr = marcasProyecto(p), equipos = {};
      for(const f of FAMILIAS_MARCA) equipos[f.k] = [];
      for(const calc of calcularTodos(p)) for(const c of calc.circuits) for(const it of c.items||[]){
        const f = it.rama ? ["interruptores"] : FAM_COMP.find(([, re])=>re.test(it.comp||"")); if(!f || !it.model || it.devtag==="—") continue;
        equipos[f[0]].push(`${it.devtag} ${String(it.val||"").split(" · ")[0]} — ${modeloCorto(it.model)}`);
      }
      for(const t of tablerosPotencia(p)){ const a = accesoriosTablero(p, t);
        if(a.spd) equipos.spd.push(`SPD1 (${t.tag}) — ${modeloCorto(modeloEnMarca(ovrTablero(a, calcularTablero(p, t).g.voltage).modelo, "", mr))}`);
        if(a.releFase) equipos.reles.push(`RF (${t.tag}) — ${modeloCorto(modeloEnMarca("CM-MPS.41S", "", mr))}`); }
      for(const t of d.tableros) equipos.gabinetes.push(`${t.tag} — ${mr.gabinetes}`);
      // solo las familias con equipos en el proyecto; las listas largas se despliegan con «y N más»
      const lista = (k, eq) => { const ab = abiertos.has(k) || eq.length <= 8;
        return (ab ? eq : eq.slice(0, 8)).map(esc).join("<br>") + (eq.length > 8 ? `<br><button type="button" class="link-btn" data-mas="${k}">${ab ? "Ver menos" : `y ${eq.length - 8} más`}</button>` : ""); };
      const fams = FAMILIAS_MARCA.filter(f=>equipos[f.k].length);
      el.innerHTML = fams.length ? `<div class="table-wrap"><table class="ed-table"><thead><tr><th>Familia de equipos</th><th>Sugerida</th><th>Marca</th><th>Equipos y modelos seleccionados</th></tr></thead><tbody>
        ${fams.map(f=>`<tr><td>${esc(f.nombre)}</td><td class="centro">${esc(f.def)}</td>
          <td class="centro"><select data-marca="${f.k}" style="width:calc(${Math.max(...f.opciones.map(o=>o.length))}ch + 34px)">${f.opciones.map(o=>`<option ${mr[f.k]===o?"selected":""}>${esc(o)}</option>`).join("")}</select></td>
          <td class="izq" style="font-size:12.5px">${lista(f.k, equipos[f.k])}</td></tr>`).join("")}
        </tbody></table></div>` : `<div class="empty">El proyecto aún no tiene equipos: agrega las cargas de los tableros.</div>`;
      $$("[data-mas]", el).forEach(b=>b.onclick = ()=>{ const k = b.dataset.mas; abiertos.has(k) ? abiertos.delete(k) : abiertos.add(k); render(); });
      $$("[data-marca]", el).forEach(sl=>sl.onchange = ()=>{ d.marcas = Object.assign({}, d.marcas||{}, { [sl.dataset.marca]: sl.value }); cambio(); render(); });
    };
    render();
  },
  tablerocontrol(el, p, cambio){
    const ctl = tablerosControl(p);
    if(!ctl.length){ el.innerHTML = `<div class="empty">El proyecto no tiene tableros de control. Agrégalos en <a href="#/proyecto/${p.id}/diseno">Datos generales</a>.</div>`; return; }
    let cur = el.dataset.t && ctl.find(t=>t.id===el.dataset.t) ? el.dataset.t : ctl[0].id;
    const t = ctl.find(x=>x.id===cur);
    // familia del PLC: módulos que se usarán (por tipo, canales por módulo y tensión de las entradas digitales)
    const fam = FAMILIAS[t.familiaPlc] || FAMILIAS[familiaPorTexto(`${t.marcaPlc||""} ${t.plc||""} ${t.modeloPlc||""}`)];
    const modsFamilia = () => { const can = t.canales||{}, nom = m => m ? `${m}${(infoModulo(m)||{}).nombre ? " ("+infoModulo(m).nombre+")" : ""}` : "—";
      return `<strong>Módulos ${esc(fam.nombre)}:</strong> ${[fam.ps && `Fuente ${nom(fam.ps)}`, `CPU ${nom(t.modeloPlc||fam.cpu)}`, ...["AI","AO","DI","DO"].map(k=>{ const n = +can[k]||fam.canales[k], m = modeloFamilia(fam, k, n, t.ioDiscreto);
        return `${k} ${n} can.: ${m ? esc(nom(m)) : `<span style="color:#c0392b">sin módulo de ${n} canales (${Object.keys(fam.mod[k]||{}).filter(x=>/^\d+$/.test(x)).join(" / ") || Object.keys(Object.values(fam.mod[k]||{})[0]||{}).join(" / ")})</span>`}`; }), fam.fpd && `FPD ${fam.fpd}`, fam.tapa && `tapa ${fam.tapa}`].filter(Boolean).join(" · ")}
        <br><span class="muted">${esc(fam.reglas||"")}${fam.sinDI120 && t.ioDiscreto!=="24 Vdc" ? " <b>Pon las entradas digitales a 24 Vdc.</b>" : ""} Primer slot de E/S sugerido: ${fam.primerSlot}.</span>`; };
    el.innerHTML = (ctl.length>1 ? `<div class="row between">${selectorTablero(ctl, cur)}<button class="btn-sm mb-2" data-todos title="Copia controlador, criterios I/O y opciones (no copia TAG ni alimentación)">Aplicar a los ${ctl.length} tableros de control</button></div>` : "") + `<div class="grid-3">
      ${campo("Alimentación de 120 Vac desde", inp("desde120", t.desde120||"", "text", 'placeholder="Vacío = tablero que lo alimenta"'))}
      ${campo("Familia del controlador (PLC)", `<select data-fam>${LISTA_FAMILIAS.map(k=>`<option value="${k}" ${k===fam.id?"selected":""}>${esc(FAMILIAS[k].nombre)}</option>`).join("")}</select>`, "Define los módulos y el conexionado (bornes del fabricante)")}
      ${campo("Controlador", inp("plc", t.plc))}${campo("Modelo de CPU (opcional)", `<input type="text" data-k="modeloPlc" value="${esc(t.modeloPlc||"")}" list="cpus-${esc(t.id)}" placeholder="${esc(fam.cpu)}"><datalist id="cpus-${esc(t.id)}">${modulosFamilia(fam.id, "CPU").map(m=>`<option value="${esc(m)}">${esc((infoModulo(m)||{}).nombre||"")}</option>`).join("")}</datalist>`, "Vacío = CPU de catálogo de la familia")}${campo("Red externa", inp("redExterna", t.redExterna))}
    </div>
    <div class="ws-note mt-1" data-mods style="font-size:12px">${modsFamilia()}</div><div class="row" style="gap:22px;margin-top:6px">
      <label class="checkbox"><input type="checkbox" data-k="switch" ${t.switch?"checked":""}> Switch Ethernet</label>
      <label class="checkbox"><input type="checkbox" data-k="hmi" ${t.hmi?"checked":""}> Pantalla HMI</label>
      <label class="checkbox"><input type="checkbox" data-k="router" ${t.router?"checked":""}> Router IIoT</label>
      <label class="checkbox"><input type="checkbox" data-k="controladorLimpieza" ${t.controladorLimpieza?"checked":""}> Controlador de limpieza</label>
    </div>
    <h3 class="ed-sub mt-2">Criterios del listado I/O</h3>
    <div class="grid-3">
      ${campo("Tensión de entradas digitales", sel("ioDiscreto", t.ioDiscreto, ["120 Vac","24 Vdc"]))}
      ${campo("Mando de variadores", sel("vfdMando", t.vfdMando, [["cableado","Cableado (listo, marcha, falla, arranque, reset y referencia 4-20 mA)"],["red","Por red (Ethernet/IP)"]]))}
      ${campo("TAG del controlador de limpieza", inp("tagLimpieza", t.tagLimpieza))}
      ${campo("Primer slot de E/S", inp("primerSlot", t.primerSlot, "number"), `CPU en el slot ${fam.slotCpu}${fam.slotPs!=null ? ", fuente en el "+fam.slotPs : ""}${fam.id==="m580" ? " (doble ancho: 0-1)" : ""}`)}
      ${campo("Desplazamiento de borneras", inp("tbOffset", t.tbOffset, "number"), "Bornera TB = slot + desplazamiento")}
      ${campo("Canales por módulo AI / AO / DI / DO", ["AI","AO","DI","DO"].map(k=>`<input type="number" data-can="${k}" value="${esc((t.canales||{})[k]??"")}" style="width:58px">`).join(" "))}
    </div>
    <div class="row" style="gap:22px">
      <label class="checkbox"><input type="checkbox" data-k="senalesTablero" ${t.senalesTablero?"checked":""}> Señales del tablero (parada de emergencia, reset, local/remoto, disparo del ITM general)</label>
      <label class="checkbox"><input type="checkbox" data-k="repetidores" ${t.repetidores?"checked":""}> Repetición de estados hacia sala de control (DO por relé) y falla de PLC</label>
      <label class="checkbox"><input type="checkbox" data-k="listarReservas" ${t.listarReservas?"checked":""}> Listar los canales de reserva</label>
    </div>`;
    bindObj(el, t, cambio, ["primerSlot","tbOffset"]);
    $$("[data-can]", el).forEach(i=>i.onchange = ()=>{ t.canales = t.canales || {}; t.canales[i.dataset.can] = parseInt(i.value)||16; cambio(); $("[data-mods]", el).innerHTML = modsFamilia(); });
    $$('[data-k="ioDiscreto"],[data-k="modeloPlc"]', el).forEach(i=>i.addEventListener("change", ()=>{ $("[data-mods]", el).innerHTML = modsFamilia(); }));
    // al cambiar de familia: marca y descripción del controlador, y canales por módulo / primer slot típicos de la familia
    // (solo los que el usuario no cambió: vacíos, iguales a los de la familia anterior o sin módulo en la nueva)
    $("[data-fam]", el).onchange = e=>{
      const F = FAMILIAS[e.target.value], ant = fam;
      if(!t.plc || LISTA_FAMILIAS.some(k=>FAMILIAS[k].plc===t.plc) || /programable|^controlador( del?)? (siemens|allen|schneider)/i.test(t.plc)) t.plc = F.plc;
      t.familiaPlc = F.id; t.marcaPlc = F.marca;
      if(t.modeloPlc && !modulosFamilia(F.id, "CPU").includes(t.modeloPlc)) t.modeloPlc = "";
      t.canales = Object.assign({}, t.canales||{});
      for(const k of ["AI","AO","DI","DO"]){ const v = t.canales[k]; if(v==null || v==="" || +v===+ant.canales[k] || !modeloFamilia(F, k, +v, t.ioDiscreto)) t.canales[k] = F.canales[k]; }
      if(t.primerSlot==null || t.primerSlot==="" || +t.primerSlot===+ant.primerSlot) t.primerSlot = F.primerSlot;
      if(F.sinDI120 && t.ioDiscreto!=="24 Vdc"){ t.ioDiscreto = "24 Vdc"; toast(`${F.nombre} no tiene entradas de 120 Vac: las entradas digitales quedan en 24 Vdc`); }
      cambio(); ED.tablerocontrol(el, p, cambio);
    };
    const s = $("[data-tsel]", el); if(s) s.onchange = ()=>{ el.dataset.t = s.value; ED.tablerocontrol(el, p, cambio); };
    const todos = $("[data-todos]", el); if(todos) todos.onclick = ()=>{
      const k = ["familiaPlc","marcaPlc","plc","modeloPlc","redExterna","switch","hmi","router","controladorLimpieza","ioDiscreto","vfdMando","primerSlot","tbOffset","senalesTablero","repetidores","listarReservas"];
      ctl.filter(x=>x!==t).forEach(x=>{ k.forEach(c=>{ x[c] = t[c]; }); x.canales = Object.assign({}, t.canales||{}); });
      cambio(); toast(`Configuración de ${t.tag} aplicada a ${ctl.length-1} tablero(s)`); };
  },
  cargas(el, p, cambio){
    const d = datos(p), v = valoresDiseno(p);
    const apps = APPLICATIONS.map(a=>[a.v, a.label]);
    const pot = tablerosPotencia(p);
    const def = tf(p);
    const opsT = pot.map(t=>[t.id, t.tag]);
    d.cargas.forEach(l=>{ if(!pot.some(t=>t.id===l.tablero)) l.tablero = def.id; normalizarArranque(l); });
    const nota = `<div class="ws-note mb-2">Sistema: <strong class="mono">${esc(v.tension)} Vac · 3F · ${esc(v.frecuencia)} Hz</strong> · control <strong class="mono">${esc(tensionControlTxt(v))}</strong> <a href="#/proyecto/${p.id}/editar/1" style="font-size:12px">cambiar</a></div>`;
    const wrap = document.createElement("div"); el.innerHTML = nota; el.appendChild(wrap);
    wrap._pie = pie => {
      pie.innerHTML = `<div class="stat-row mt-2">${pot.map(t=>{ const c = calcularTablero(p, t); if(!c.circuits.length) return ""; return `<div class="stat"><div class="k">${esc(t.tag)} — PI / MD / I<sub>MD</sub></div><div class="v" style="font-size:15px">${r2(c.installedKVA,1)} kVA · ${r2(c.totalKVA,1)} kVA · ${r2(c.demandCurrent,1)} A</div></div>`; }).join("")}</div><div data-ctrafo></div>`;
      cargasTransformadores($("[data-ctrafo]", pie));
    };
    const v1 = parseFloat(v.tensionControl)||120, t1 = v.tensionControlTipo==="Vdc" ? "Vdc" : "Vac", v2 = parseFloat(v.tensionControl2);
    const SECUNDARIOS = [...new Set([`${v1}|${t1}`, v2>0 ? `${v2}|Vac` : "", "120|Vac", "220|Vac", "24|Vdc"].filter(Boolean))];
    /* transformador: en la columna «Aplicación» se elige su relación de transformación (primario = tensión del sistema) */
    const V = parseFloat(v.tension) || "";
    const relLabel = o => { const [n, ti] = o.split("|"); return `${V}/${n} ${ti}`; };
    const opsRel = f => [...new Set([...SECUNDARIOS, f.application].filter(o=>/^[\d.]+\|V(ac|dc)$/.test(o||"")))].map(o=>[o, relLabel(o)]);
    const sincronizarRel = f => { if(f.kind==="control" && !/\|/.test(f.application||"")) f.application = `${parseFloat(f.secundario)||v1}|${f.secundarioTipo||t1}`; };
    d.cargas.forEach(sincronizarRel);
    // potencia: la típica de su tipo y aplicación mientras el usuario no la cambie (las anteriores, distintas del valor por
    // defecto de 10, se consideran fijadas por el usuario)
    d.cargas.forEach(l=>{ l.man = l.man || {}; if(l.man.power==null) l.man.power = +l.power!==10; });
    tablaEditable(wrap, { filas: d.cargas, onChange: cambio, vacio:"Sin cargas. Agrega la primera fila.", mover:true, grupo: f=>f.tablero,
      nuevo: ()=>nuevaCarga("motor", def.id),
      extraBotones: `<button class="btn-sm" data-tip title="Vuelve a proponer FDP, EFF, FU y FS típicos en todas las cargas">Restablecer valores típicos</button>`,
      onCell: (f, k)=>{ if(["fp","effPct","fu","fs"].includes(k)){ f.man = f.man||{}; f.man[k] = true; } if(k==="kind" && (f.kind==="general" || f.kind==="reserva")){ f.powerUnit = "kw"; if(!(f.man||{}).fp) f.fp = 0.9; }
        if(k==="power" || k==="powerUnit"){ f.man = f.man||{}; f.man.power = true; }
        if(k==="kind" || k==="application") aplicarPotenciaTipica(f);
        if(k==="kind" && (f.kind==="control" || f.kind==="reserva")) f.diferencial = false;
        if(k==="kind" && f.kind==="reserva" && !f.desc) f.desc = "Reserva";
        // transformador de control: toma la tensión de control y los circuitos del primer transformador automático del tablero
        // transformador: alimenta solo las cargas de su cuadro «Cargas de los transformadores» (los servicios del tablero
        // siguen en el control interno automático); secundario = tensión de control del proyecto, hasta que se elija otra relación
        if(k==="kind" && f.kind==="control" && !Array.isArray(f.alimenta)){ f.alimenta = []; f.secundario = v1; f.secundarioTipo = t1; if(!f.desc) f.desc = "Transformador"; }
        if(k==="kind" && f.kind==="control"){ f.application = ""; sincronizarRel(f); }
        if(k==="kind" && f.kind!=="control" && /\|/.test(f.application||"")) f.application = "otro";
        if(k==="application" && f.kind==="control"){ const [n, ti] = String(f.application).split("|"); f.secundario = +n; f.secundarioTipo = ti; }
        if(["power","powerUnit","regimen","kind"].includes(k)) aplicarTipicos(f);
        if(k==="kind" || k==="starter") normalizarArranque(f); },
      clase: (f, k)=>["fp","effPct","fu","fs","power"].includes(k) && !(f.man||{})[k] ? "tipico" : "",
      columnas:[
        { k:"tablero", t:"Tablero", op: opsT, w:100 },
        { k:"tag", t:"TAG", w:110 }, { k:"desc", t:"Nombre de la carga", w:180, izq:true },
        { k:"kind", t:"Tipo de carga", op:[["motor","Motor"],["general","Carga general (kW)"],["control","Transformador"],["feeder","Alimentador"],["reserva","Reserva"]], w:120 },
        { k:"application", t:"Aplicación", op: f=>f.kind==="control" ? opsRel(f) : f.kind==="reserva" ? [["na","N.A."]] : apps, w:200 },
        // la potencia del transformador de control resulta de los circuitos que alimenta
        { k:"power", t:"Potencia", n:true, w:70, ro: f=>f.kind==="control" ? kvaTrafo(f) : null }, { k:"powerUnit", t:"Unidad", op: f=>f.kind==="control" ? [["kva","kVA"]] : [["hp","HP"],["kw","kW"]], w:70 },
        // arranque y filtros solo para motores (y los filtros solo con variador); en las demás cargas: N.A.
        { k:"starter", t:"Arranque", op: f=>f.kind==="motor" ? [["dol","Directo"],["vfd","Variador"],["ss","Arrancador suave"]] : [["na","N.A."]], w:130 },
        { k:"filtroVdf", t:"Filtros del variador", op: f=>f.kind==="motor" && f.starter==="vfd" ? [["ninguno","Sin filtro"],["linea","Solo de línea"],["carga","Solo de carga"],["ambos","Línea y carga"]] : [["na","N.A."]], w:130 },
        { k:"regimen", t:"Régimen", op: REGIMENES.map(r=>[r.v, r.label]), w:120 },
        { k:"fp", t:"FDP", n:true, w:58 }, { k:"effPct", t:"EFF (%)", n:true, w:60 }, { k:"fu", t:"FU", n:true, w:52 }, { k:"fs", t:"FS", n:true, w:52 },
        { k:"fases", t:"Fases", op:[["3","3F"],["1","1F"]], w:60 },
        // protección diferencial propia de la carga (algunos clientes la piden por carga y no en la distribución principal)
        { k:"diferencial", t:"Prot. diferencial", chk:true, ro: f=>f.kind==="control" || f.kind==="reserva" ? "N.A." : null },
        { calc:(f)=>{ const c = corrienteDe(f); return c ? r2(c,2) : "—"; }, k:"_in", t:"In (A) calculada" },
      ] });
    /* cuadro «Cargas de los transformadores»: solo si el listado tiene cargas de tipo «Transformador» */
    function cargasTransformadores(box){
      if(!box) return;
      const trafos = d.cargas.filter(l=>l.kind==="control");
      if(!trafos.length){ box.innerHTML = ""; return; }
      const tagTrafo = l => { const t = pot.find(x=>x.id===l.tablero) || def; const c = calcularTablero(p, t).circuits.find(x=>x.load && x.load.id===l.id);
        const tr = c && (c.items||[]).find(it=>/^Transformador|^Fuente de alimentación/.test(it.comp));
        return `${l.tag || (tr && tr.devtag) || l.desc || "Transformador"} (${t.tag})`; };
      const opsTr = trafos.map(l=>[l.id, tagTrafo(l)]);
      // cargas de un transformador eliminado: se quitan; si la carga dejó de ser transformador, pasan al primero
      for(let i = d.cargasTrafo.length-1; i >= 0; i--){ const r = d.cargasTrafo[i];
        if(!d.cargas.some(l=>l.id===r.trafo)) d.cargasTrafo.splice(i, 1); else if(!trafos.some(l=>l.id===r.trafo)) r.trafo = trafos[0].id; }
      box.innerHTML = `<h3 class="ed-sub mt-2">Cargas de los transformadores</h3><div class="ed-centrada" data-tabla></div>`;
      const cont = $("[data-tabla]", box);
      const aplicDe = r => r.tipo==="motor" ? apps : APLIC_CARGA_TRAFO[r.tipo] || [["na","N.A."]];
      // aplicación válida para su tipo (las filas anteriores con «Iluminación» / «Tomacorrientes» pasan a la lista nueva)
      d.cargasTrafo.forEach(r=>{ r.application = ({ iluminacion:"luminaria", tomacorrientes:"tomacorriente" })[r.application] || r.application;
        const a = aplicDe(r); if(!a.some(o=>o[0]===r.application)) r.application = a.some(o=>o[0]==="otro") ? "otro" : a[0][0];
        // potencia típica mientras no se cambie (las filas anteriores con el valor por defecto de 100 VA la toman)
        if(r.manPot==null) r.manPot = !(+r.power===100 && r.powerUnit==="va");
        aplicarPotenciaTrafo(r);
        if(r.diferencial==null) r.diferencial = r.tipo==="general" && r.application==="tomacorriente"; });
      tablaEditable(cont, { filas: d.cargasTrafo, vacio:"Sin cargas en los transformadores. Agrega la primera fila.", mover:true, grupo: r=>r.trafo,
        nuevo: ()=>nuevaCargaTrafo(trafos[0].id),
        clase: (r, k)=>k==="power" && !r.manPot ? "tipico" : "",
        onChange: ()=>{ cambio(); setTimeout(()=>{
          // se recalcula el listado (potencia del transformador) conservando el campo en edición de este cuadro
          const a = document.activeElement, tr = a && cont.contains(a) ? a.closest("tr[data-i]") : null, foco = tr ? { i: tr.dataset.i, c: a.dataset.c } : null;
          wrap._render();
          if(foco){ const x = $(`[data-ctrafo] tr[data-i="${foco.i}"] [data-c="${foco.c}"]`, wrap); if(x) x.focus({ preventScroll:true }); }
        }); },
        onCell: (r, k)=>{
          if(k==="power" || k==="powerUnit") r.manPot = true;
          if(k==="tipo"){ const a = aplicDe(r); if(!a.some(o=>o[0]===r.application)) r.application = a.some(o=>o[0]==="otro") ? "otro" : a[0][0]; }
          if(k==="tipo" || k==="application"){ aplicarPotenciaTrafo(r); r.diferencial = r.tipo==="general" && r.application==="tomacorriente"; }
          if(k==="tipo"){ const u = UNIDADES_CARGA_TRAFO(r); if(!u.some(o=>o[0]===r.powerUnit)) r.powerUnit = u[0][0]; }
        },
        columnas:[
          { k:"trafo", t:"TAG", op: opsTr, w:150 },
          { k:"desc", t:"Nombre de la carga", w:200 },
          { k:"tipo", t:"Tipo de carga", op: TIPOS_CARGA_TRAFO, w:140 },
          { k:"application", t:"Aplicación", op: aplicDe, w:180 },
          { k:"power", t:"Potencia", n:true, w:70 },
          { k:"powerUnit", t:"Unidad", op: UNIDADES_CARGA_TRAFO, w:70 },
          { k:"diferencial", t:"Prot. diferencial", chk:true },
          { calc: r=>vaCargaTrafo(r), k:"_va", t:"S (VA)" },
        ] });
    }
    function kvaTrafo(f){ for(const t of pot){ const c = calcularTablero(p, t).circuits.find(x=>x.load && x.load.id===f.id); if(c) return r2(c.installedKVA, 2); } return "—"; }
    function corrienteDe(f){ for(const t of pot){ const c = calcularTablero(p, t).circuits.find(x=>x.load && x.load.id===f.id); if(c) return c.installedCurrent; } return null; }
    const tip = $("[data-tip]", wrap); if(tip) tip.onclick = ()=>{ d.cargas.forEach(l=>{ l.man = {}; aplicarTipicos(l); }); cambio(); wrap._render(); toast("Valores típicos aplicados"); };
  },
  cables(el, p, cambio){
    const d = datos(p), cfg = d.cablesCfg;
    const render = ()=>{
      const filas = cablesFuerza(p);
      el.innerHTML = `<h3 class="ed-sub">Calidad del cable requerida por el cliente final</h3>
        <div class="grid-2">${Object.entries(CLASES_CABLE).map(([k,c])=>`<label class="deliv ${cfg.clase===k?"selected":""}" style="cursor:pointer;margin:0"><input type="radio" name="clase" value="${k}" ${cfg.clase===k?"checked":""}><div><div class="title">${esc(c.nombre)}</div><div class="desc">${esc(c.uso)}</div><div class="muted" style="font-size:11.5px">${esc(c.norma)} · ${esc(c.ref)}</div></div></label>`).join("")}</div>
        <div class="grid-3 mt-2">${campo("Canalización por defecto", sel("canalizacion", cfg.canalizacion, CANALIZACIONES))}${campo("Reserva de longitud (%)", inp("reserva", cfg.reserva, "number"))}</div>
        <h3 class="ed-sub mt-2">Cables</h3>
        <div class="table-wrap"><table class="ed-table"><thead><tr><th>Desde</th><th>Hasta</th><th>Servicio</th><th>TAG del cable</th><th>Longitud (m)</th><th>Canalización</th><th>Calidad</th><th>Sección (mm²)</th><th>AWG (NEC)</th><th>ΔV (%)</th></tr></thead><tbody>
        ${filas.map((f,i)=>`<tr data-i="${i}"><td class="mono">${esc(f.desde)}</td><td class="mono">${esc(f.hasta)}</td><td>${esc(f.servicio)}</td>
          <td><input type="text" data-c="cableTag" value="${esc(f._load.cableTag||"")}" placeholder="${esc(f.tag)}" style="width:130px"></td>
          <td><input type="number" step="any" data-c="cableLength" value="${esc(f.longitud)}" style="width:70px"></td>
          <td><select data-c="canalizacion"><option value="">(por defecto)</option>${CANALIZACIONES.map(([v,l])=>`<option value="${v}" ${f._load.canalizacion===v?"selected":""}>${esc(l)}</option>`).join("")}</select></td>
          <td><select data-c="cableClase"><option value="">(por defecto)</option>${Object.entries(CLASES_CABLE).map(([v,c])=>`<option value="${v}" ${f._load.cableClase===v?"selected":""}>${esc(c.nombre)}</option>`).join("")}</select></td>
          <td class="mono">${esc(f.seccion)}</td><td class="mono" style="font-size:11.5px">${esc(f.awg)}</td><td class="num ${f.dv>(+valoresDiseno(p).caidaTension||2.5)?"err":""}">${r2(f.dv,2)}</td></tr>`).join("") || `<tr><td colspan="10" class="muted" style="text-align:center;padding:18px">Sin cables: completa primero el <a href="#/proyecto/${p.id}/doc/ele-cargas/datos">listado de cargas</a>.</td></tr>`}
        </tbody></table></div>`;
      $$("input[name=clase]", el).forEach(r=>r.onchange = ()=>{ cfg.clase = r.value; cambio(); render(); });
      bindObj($(".grid-3", el), cfg, ()=>{ cambio(); render(); }, ["reserva"]);
      $$("tr[data-i] [data-c]", el).forEach(i=>i.onchange = ()=>{
        const f = filas[+i.closest("tr").dataset.i]; const k = i.dataset.c;
        const obj = f._load._tablero || d.cargas.find(l=>l.id===f._load.id) || f._load;
        obj[k] = k==="cableLength" ? (parseFloat(i.value)||30) : i.value.trim();
        cambio(); render();
      });
    };
    render();
  },
  cargasControl(el, p, cambio){ ED.circuitos(el, p, cambio, null, true); },
  circuitos(el, p, cambio, docId, enCargas){
    const d = datos(p);
    // en el listado de cargas: todos los tableros con control (también la etapa de control de los tableros de fuerza y
    // control); en los documentos del tablero de control: solo los tableros de control
    const ctl = enCargas ? tablerosControl(p) : tablerosControl(p).filter(t=>t.tipo==="control");
    if(!ctl.length){ el.innerHTML = `<div class="empty">El proyecto no tiene tableros de control.</div>`; return; }
    const cur = el.dataset.t && ctl.find(t=>t.id===el.dataset.t) ? el.dataset.t : ctl[0].id;
    const t = ctl.find(x=>x.id===cur);
    // tablero de fuerza y control: su etapa de control está dentro del mismo tablero (sus cargas dimensionan el multifilar)
    const tfc = t.tipo==="fuerzacontrol";
    if(enCargas){ const h = el.closest(".ed-card") && $(".card-head h2", el.closest(".ed-card")); if(h) h.textContent = tfc ? "Cargas de la etapa de control" : "Cargas de los tableros de control"; }
    const auto = !(d.circuitosCtl[t.id] && d.circuitosCtl[t.id].length);
    // circuitos editados: se sincronizan con el proyecto (instrumentos y equipos agregados o quitados) y se guardan así
    if(!auto) d.circuitosCtl[t.id] = circuitosControl(p, t);
    const filas = auto ? derivarCircuitosControl(p, t) : d.circuitosCtl[t.id];
    el.innerHTML = (ctl.length>1 ? selectorTablero(ctl, cur) : "") + `<div class="notice mb-2">${tfc ? (auto ? `Etapa de control de <strong>${esc(t.tag)}</strong> generada desde sus instrumentos; estas cargas dimensionan el multifilar del tablero.` : `Etapa de control de ${esc(t.tag)} editada; estas cargas dimensionan el multifilar del tablero.`) : auto ? `Circuitos de <strong>${esc(t.tag)}</strong> generados desde sus instrumentos.` : `Circuitos editados de ${esc(t.tag)}.`} <button class="btn-sm" data-regen>${auto?"Editar circuitos":"Regenerar desde instrumentos"}</button></div><div data-t></div>`;
    const s = $("[data-tsel]", el); if(s) s.onchange = ()=>{ el.dataset.t = s.value; ED.circuitos(el, p, cambio, docId, enCargas); };
    $("[data-regen]", el).onclick = ()=>{ if(auto) d.circuitosCtl[t.id] = derivarCircuitosControl(p, t); else delete d.circuitosCtl[t.id]; cambio(); ED.circuitos(el, p, cambio, docId, enCargas); };
    const box = $("[data-t]", el);
    if(auto){
      box.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Barra</th><th>Circuito</th><th>Descripción</th><th class="num">Potencia (W)</th><th class="num">Protección (A)</th><th>ID 30 mA</th><th>Cable</th></tr></thead><tbody>${filas.map(c=>`<tr><td class="centro">${esc(c.barra)}</td><td class="mono centro">${esc(c.circuito)}</td><td>${esc(c.descripcion)}</td><td class="num centro">${c.potencia??""}</td><td class="num centro">${c.proteccion}</td><td class="centro">${c.diferencial ? "Sí" : "—"}</td><td class="mono centro">${esc(c.cable)}</td></tr>`).join("")}</tbody></table></div>`;
      return;
    }
    tablaEditable(box, { filas, onChange: cambio, nuevo: ()=>({ barra:"120 Vac", circuito:"C"+(filas.length+1), descripcion:"", proteccion:6, cable:"2C#14AWG+14AWG(T)", potencia:0 }),
      // protección y cable: los calcula Ingenia con la potencia y la barra (dimensionarCircuito); el usuario edita lo demás
      onCell: (f, k)=>{ if(k==="potencia" || k==="barra") dimensionarCircuito(f); },
      columnas:[ { k:"barra", t:"Barra", op:["24 Vdc","120 Vac","220 Vac"] }, { k:"circuito", t:"Circuito", w:60 }, { k:"descripcion", t:"Descripción", w:240, izq:true }, { k:"potencia", t:"Potencia (W)", n:true, w:70 },
        { calc:f=>dimensionarCircuito(f).proteccion, k:"_prot", t:"Protección (A)" }, { k:"diferencial", t:"ID 30 mA", chk:true }, { calc:f=>f.cable, k:"_cable", t:"Cable" } ] });
  },
  instrumentos(el, p, cambio){
    const d = datos(p);
    renderEditor(el, "ins-instrumentos", p, cambio);
  },
  io(el, p, cambio){
    const d = datos(p);
    const wrap = document.createElement("div");
    el.innerHTML = `<div class="notice mb-2">Generada desde instrumentos y cargas, agrupada por tablero de control. <button class="btn-sm btn-primary" data-gen>${ICON.check} Actualizar</button></div>`;
    el.appendChild(wrap);
    $("[data-gen]", el).onclick = ()=>{ d["ins-io"] = derivarIO(p); save(); renderEditor(wrap, "ins-io", p, cambio); cambio(); toast(`${d["ins-io"].length} señales generadas`); };
    if(!d["ins-io"].length && (instrumentos(p).length || d.cargas.length)) d["ins-io"] = derivarIO(p);
    renderEditor(wrap, "ins-io", p, cambio);
  },
  memoria(el, p, cambio){
    const m = datos(p).memoria;
    el.innerHTML = `<div class="grid-3">
      ${campo("Factor de agrupamiento Kg", inp("kGroup", m.kGroup, "number", 'step="0.01"'), "1,00 = sin agrupamiento")}
      ${campo("Factor de altitud de protecciones Kh", inp("kh", m.kh, "number", 'step="0.01"'), "1,00 si no aplica")}
      ${campo("Canalización", inp("canalizacion", m.canalizacion))}
    </div>
    ${campo("Introducción (opcional)", `<textarea data-k="intro" placeholder="Si se deja vacío se usa la descripción del proyecto">${esc(m.intro||"")}</textarea>`)}
    <p class="muted" style="font-size:12.5px">Tipo de cable: el del <a href="#/proyecto/${p.id}/doc/ele-cables/datos">listado de cables</a>.</p>`;
    bindObj(el, m, cambio, ["kGroup","kh"]);
  },
  async hd(el, p, cambio){
    const d = datos(p); const lista = instrumentos(p).filter(i=>i.tag);
    if(!lista.length){ el.innerHTML = `<div class="empty">Primero completa el <a href="#/proyecto/${p.id}/doc/ins-instrumentos/datos">listado de instrumentos</a>.</div>`; return; }
    let selT = el.dataset.sel || lista[0].tag;
    const render = async ()=>{
      const inst = lista.find(i=>i.tag===selT) || lista[0];
      const c = await camposHD(p, inst);
      el.innerHTML = `<div class="row between mb-2"><div class="row"><label class="muted">Instrumento</label><select data-sel>${lista.map(i=>`<option ${i.tag===inst.tag?"selected":""}>${esc(i.tag)}</option>`).join("")}</select>
        <span class="chip">${esc(c.titulo)}</span></div><span class="muted" style="font-size:12px">${c.conocido ? "Valores típicos para el tipo "+esc(c.referencia) : "Tipo sin valores típicos: estructura genérica"}</span></div>` + tablaCampos(c.filas);
      $("[data-sel]", el).onchange = e=>{ selT = e.target.value; el.dataset.sel = selT; render(); };
      $$("[data-hd]", el).forEach(i=>i.onchange = ()=>{ d.hd[inst.tag] = d.hd[inst.tag] || {}; d.hd[inst.tag][i.dataset.hd] = i.value; cambio(); render(); });
    };
    render();
  },
  hdEq(el, p, cambio){
    const d = datos(p), lista = tableros(p);
    let cur = el.dataset.t && lista.find(t=>t.id===el.dataset.t) ? el.dataset.t : lista[0].id;
    const render = ()=>{
      const t = lista.find(x=>x.id===cur);
      const c = camposHDEq(p, t);
      el.innerHTML = selectorTablero(lista, cur) + tablaCampos(c.filas);
      $("[data-tsel]", el).onchange = e=>{ cur = e.target.value; el.dataset.t = cur; render(); };
      $$("[data-hd]", el).forEach(i=>i.onchange = ()=>{ d.hdEq[t.id] = d.hdEq[t.id] || {}; d.hdEq[t.id][i.dataset.hd] = i.value; cambio(); render(); });
    };
    render();
  },
  equiposCfg(el, p, cambio){
    const c = datos(p).equiposCfg;
    el.innerHTML = `<label class="checkbox"><input type="checkbox" data-k="incluirEquipos" ${c.incluirEquipos?"checked":""}> Incluir también motores y variadores (además de los tableros)</label>
      <p class="muted mt-1" style="font-size:12.5px">Tableros: en <a href="#/proyecto/${p.id}/diseno">Datos generales</a>.</p>`;
    bindObj(el, c, cambio);
  },
  proceso(el, p, cambio){
    const d = datos(p), pr = d.proceso;
    const render = async ()=>{
      const ref = pr.referencia ? await S.leerArchivo(pr.referencia) : null;
      el.innerHTML = `${campo("Descripción general del proceso", `<textarea data-k="descripcion" rows="5" placeholder="Describe el proceso: equipos principales, flujo del material, variables a medir y controlar.">${esc(pr.descripcion)}</textarea>`, "Describe equipos, flujo y servicios (aire comprimido, agua, etc.). Se usa para recomendar instrumentos y en la filosofía de control.")}
        <div class="field"><label>P&amp;ID de referencia (opcional)</label>${ref ? `<div class="row"><span>${ICON.file} <strong>${esc(ref.nombre)}</strong> <span class="muted">${(ref.size/1024).toFixed(0)} kB</span></span><button class="btn-sm btn-danger" data-delref>${ICON.trash}</button></div>` : `<div class="dropzone" data-ref><strong>Arrastra el P&amp;ID del proceso</strong> o haz clic <span class="muted">(PDF; también DXF o imagen)</span></div>`}<span class="hint">Si no tienes un P&amp;ID, se arma con la descripción del proceso.</span></div>
        <h3 class="ed-sub mt-2">Equipos del proceso</h3><div data-eq></div>
        <div class="row mt-2"><button class="btn-primary" data-rec>${ICON.check} Recomendar instrumentos</button><span class="muted" style="font-size:12.5px">Según equipos y descripción. Aprueba los que correspondan.</span></div>
        <div data-recs class="mt-2"></div>`;
      $("[data-k=descripcion]", el).onchange = e=>{ pr.descripcion = e.target.value; cambio(); };
      const dz = $("[data-ref]", el); if(dz) dropzone(dz, ".dxf,.pdf,.png,.jpg,.jpeg", async file=>{ pr.referencia = await S.guardarArchivo({ tipo:"pid_ref", proyectoId:p.id, nombre:file.name, size:file.size }, file); cambio(); render(); toast("P&ID de referencia guardado"); });
      const dl = $("[data-delref]", el); if(dl) dl.onclick = async ()=>{ await S.borrarArchivo(pr.referencia); pr.referencia = null; cambio(); render(); };
      tablaEditable($("[data-eq]", el), { filas: pr.equipos, onChange: cambio, vacio:"Sin equipos. Agrégalos o impórtalos desde el listado de cargas.",
        nuevo: ()=>({ tag:"", tipo:"otro", descripcion:"" }),
        extraBotones: `<button class="btn-sm" data-imp>Importar desde el listado de cargas</button>`,
        columnas:[ { k:"tag", t:"TAG", w:120 }, { k:"tipo", t:"Tipo de equipo", op: EQUIPOS_PROCESO.map(e=>[e.v, e.label]) }, { k:"descripcion", t:"Descripción", w:260 } ] });
      const imp = $("[data-imp]", el); if(imp) imp.onclick = ()=>{
        const mapa = { "ventilador-centrifugo":"ventilador", "ventilador-axial":"ventilador", "valvula-rotativa":"valvula-rotativa", "bomba-centrifuga":"bomba", "compresor-piston":"compresor", "faja-transportadora":"faja", "molino":"molino", "chancadora":"chancadora", "agitador":"agitador" };
        let n = 0; for(const l of d.cargas.filter(l=>l.kind==="motor")) if(!pr.equipos.some(e=>e.tag && e.tag===l.tag)){ pr.equipos.push({ tag:l.tag, tipo: mapa[l.application]||"otro", descripcion:l.desc }); n++; }
        cambio(); render(); toast(n+" equipo(s) importados");
      };
      $("[data-rec]", el).onclick = ()=>{ pr.recomendados = recomendarInstrumentos(p); cambio(); render(); };
      const box = $("[data-recs]", el);
      if(pr.recomendados && pr.recomendados.length){
        const yaTags = new Set(instrumentos(p).map(i=>i.tag));
        box.innerHTML = `<div class="table-wrap"><table class="ed-table"><thead><tr><th>Aprobar</th><th>TAG</th><th>Instrumento</th><th>Servicio</th><th>Señal</th><th>Equipo</th><th>Motivo</th></tr></thead><tbody>
          ${pr.recomendados.map((r,i)=>`<tr data-i="${i}"><td style="text-align:center">${yaTags.has(r.tag) ? '<span class="badge badge-ok">En listado</span>' : `<input type="checkbox" data-ap ${r.aprobado?"checked":""}>`}</td><td><input type="text" data-tag value="${esc(r.tag)}" style="width:100px"></td><td>${esc(r.descripcion)}</td><td>${esc(r.servicio)}</td><td>${esc(r.tipoSenal)} · ${esc(r.senal)}</td><td class="mono">${esc(r.equipo||"")}</td><td class="muted" style="font-size:12px">${esc(r.motivo)}</td></tr>`).join("")}
          </tbody></table></div>
          <div class="row mt-1"><button class="btn-primary" data-pasar>${ICON.check} Agregar los aprobados al listado de instrumentos</button><a class="btn" href="#/proyecto/${p.id}/doc/ins-instrumentos/datos">Ir al listado de instrumentos →</a></div>`;
        $$("tr[data-i] [data-ap]", box).forEach(c=>c.onchange = ()=>{ pr.recomendados[+c.closest("tr").dataset.i].aprobado = c.checked; cambio(); });
        $$("tr[data-i] [data-tag]", box).forEach(c=>c.onchange = ()=>{ pr.recomendados[+c.closest("tr").dataset.i].tag = c.value.trim(); cambio(); });
        $("[data-pasar]", box).onclick = ()=>{
          const sist = (d.sistema.nombre||"").toUpperCase(); let n = 0;
          for(const r of pr.recomendados) if(r.aprobado && !yaTags.has(r.tag)){ const { aprobado, motivo, ...inst } = r; d["ins-instrumentos"].push(Object.assign({ sistema:sist, cant:1, marca:"", modelo:"" }, inst)); n++; }
          d["ins-io"] = derivarIO(p); cambio(); render(); toast(n ? `${n} instrumento(s) agregados; listado I/O actualizado` : "Marca al menos un instrumento");
        };
      } else box.innerHTML = "";
    };
    render();
  },
  /* filosofía de control: estructura armada desde el proyecto (modules/filosofia.js); lo editado se guarda como
     diferencias, así lo que no se tocó sigue a los equipos e instrumentos del proyecto */
  filosofia(el, p, cambio){
    const CAPS = [["general","Generalidades"],["arquitectura","Arquitectura"],["sistema","Sistema"],["operacion","Operación"],["alarmas","Alarmas y set points"],["interlocks","Interlocks"],["modos","Modos"],["secuencias","Secuencias"],["supervision","Supervisión y notas"]];
    const cap = CAPS.some(c=>c[0]===el.dataset.cap) ? el.dataset.cap : "general";
    const F = filosofiaDe(p), A = filosofiaAuto(p), re = ()=>ED.filosofia(el, p, cambio);
    const badge = f => `<span class="badge ${f._auto ? (f._ed ? "badge-warn" : "badge-neutral") : "badge-ok"}">${f._auto ? (f._ed ? "editado" : "automático") : "agregado"}</span>`;
    const txt = (k, rows=4) => { const ed = (F.textos[k]||"")!==(A.textos[k]||""); return `<div class="field"><label>${esc(TEXTOS_FIL[k])} <span class="badge ${ed?"badge-warn":"badge-neutral"}" data-bx="${k}">${ed?"editado":"automático"}</span> <button class="btn-ghost btn-sm" data-rtx="${k}" ${ed?"":'style="display:none"'}>Restablecer</button></label><textarea data-tx="${k}" rows="${rows}">${esc(F.textos[k]||"")}</textarea></div>`; };
    const sub = (t, k) => `<div class="row between mt-2 mb-1" style="flex-wrap:wrap;gap:6px"><h3 class="ed-sub" style="margin:0">${esc(t)}</h3>${k?`<button class="btn-sm" data-regen="${k}" title="Descarta lo editado en esta sección y vuelve a lo armado desde el proyecto">Regenerar desde el proyecto</button>`:""}</div>`;
    const tb = k => `<div data-tb="${k}"></div>`;
    let h = `<p class="ws-note">Todo se arma con el proyecto: cargas, instrumentos, listado I/O, tableros de control, criterios y documentos. Revisa y ajusta solo lo necesario; lo editado queda marcado y lo demás se actualiza solo cuando cambian equipos o instrumentos. En los textos cada línea es un párrafo; «- » crea una viñeta, «  - » una sub-viñeta y «# » un subtítulo.</p>
      <div class="tabs" style="margin-bottom:12px">${CAPS.map(c=>`<button data-cap="${c[0]}" class="${c[0]===cap?"active":""}">${c[1]}</button>`).join("")}</div>`;
    if(cap==="general") h += txt("introduccion") + txt("objetivos", 3) + txt("referencias", 5) + txt("alcance", 3) + sub("Áreas y equipos del alcance", "areas") + `<div data-areas></div>` + txt("exclusiones", 2) + txt("normas", 6) + txt("condiciones", 6);
    if(cap==="arquitectura") h += txt("arquitectura", 10) + `<p class="muted" style="font-size:12.5px">Figura del documento: se dibuja con la configuración de los <a href="#/proyecto/${p.id}/doc/ins-io/datos">tableros de control</a> (PLC, HMI, switch, router, controlador de limpieza y red externa).</p><div style="max-width:820px;border:1px solid var(--border);border-radius:6px;overflow:hidden">${arquitecturaSVG(p).svg.replace("<svg ", '<svg style="width:100%;height:auto;display:block" ')}</div>`;
    if(cap==="sistema") h += sub("Descripción general del sistema (sección 8)", "subsistemas") + `<div data-cards="subsistemas"></div>`;
    if(cap==="operacion") h += txt("operacion", 2) + sub("Etapas de la operación (9.1)", "etapas") + `<div data-cards="etapas"></div>` + txt("condicionesOperacion", 4) + sub("Lista de equipos generales", "equipos") + tb("equipos") + sub("Lista de instrumentos", "instrumentos") + tb("instrumentos");
    if(cap==="alarmas") h += sub("Set points de proceso (instrumentos analógicos)", "setpoints") + tb("setpoints") + sub("Alarmas", "alarmas") + tb("alarmas") + txt("alarmas", 3);
    if(cap==="interlocks") h += txt("interlocks", 6) + sub("Interlocks y permisivos", "interlocks") + tb("interlocks");
    if(cap==="modos") h += txt("modos", 14);
    if(cap==="secuencias") h += sub("Secuencia de arranque (9.4)", "arranque") + tb("arranque") + txt("monitoreo", 4) + sub("Secuencias de parada ante falla o parada intempestiva (9.5)", "parada") + `<div data-paradas></div>`;
    if(cap==="supervision") h += txt("supervision", 7) + txt("notas", 3);
    el.innerHTML = h;
    $$("[data-cap]", el).forEach(b=>b.onclick = ()=>{ el.dataset.cap = b.dataset.cap; re(); });
    $$("[data-tx]", el).forEach(t=>t.onchange = ()=>{ const k = t.dataset.tx; guardarTexto(p, k, t.value); cambio();
      const ed = !!datos(p).filosofia.textos[k], bx = $(`[data-bx="${k}"]`, el); bx.className = "badge "+(ed?"badge-warn":"badge-neutral"); bx.textContent = ed ? "editado" : "automático"; $(`[data-rtx="${k}"]`, el).style.display = ed ? "" : "none"; if(!ed) t.value = A.textos[k]||""; });
    $$("[data-rtx]", el).forEach(b=>b.onclick = ()=>{ filosofiaOps.regenerar(p, b.dataset.rtx); cambio(); re(); });
    $$("[data-regen]", el).forEach(b=>b.onclick = ()=>{ const r = filosofiaOps.regenerar(p, b.dataset.regen); cambio(); re(); toast(r.msg); });
    // tablas
    const COLS = {
      equipos: [{ k:"descripcion", t:"Equipo", w:200 }, { k:"tag", t:"TAG", w:140 }, { k:"caracteristicas", t:"Características", w:340 }],
      instrumentos: [{ k:"descripcion", t:"Instrumento", w:200 }, { k:"servicio", t:"Servicio", w:240 }, { k:"senal", t:"Tipo de señal", w:140 }, { k:"tag", t:"TAG", w:120 }],
      setpoints: [{ k:"tag", t:"TAG", w:100 }, { k:"servicio", t:"Servicio", w:220 }, { k:"rango", t:"Rango", w:70 }, { k:"unidad", t:"Unidad", w:70 }, ...["sp","hh","h","l","ll"].map(k=>({ k, t:k.toUpperCase(), w:60 }))],
      alarmas: [{ k:"instrumento", t:"Instrumento / equipo", w:110 }, { k:"senal", t:"TAG de alarma", w:140 }, { k:"descripcion", t:"Alarma", w:260 }, { k:"tipo", t:"Tipo", op:TIPOS_ALARMA, w:80 }, { k:"setpoint", t:"Set point", w:110 }, { k:"accion", t:"Acción", w:300 }, { k:"prioridad", t:"Prioridad", op:["Alta","Media","Baja"], w:80 }],
      interlocks: [{ k:"tipo", t:"Tipo", op:TIPOS_INTERLOCK, w:100 }, { k:"senal", t:"Señal", w:140 }, { k:"servicio", t:"Servicio", w:200 }, { k:"equipo", t:"Equipo afectado", w:110 }, { k:"condicion", t:"Condición normal (permisivos)", w:280 }, { k:"accion", t:"Acción", w:300 }, { k:"valor", t:"Valor", w:100 }, { k:"retardo", t:"Retardo", w:80 }],
      arranque: [{ k:"equipo", t:"TAG", w:90 }, { k:"descripcion", t:"Equipo", w:160 }, { k:"accion", t:"Acción", w:240 }, { k:"confirmacion", t:"Confirmación", w:250 }, { k:"tiempo", t:"TON", w:60 }, { k:"falla", t:"Ante falla", w:280 }, { k:"notas", t:"Detalle", w:320 }],
    };
    const montar = k => {
      const b = $(`[data-tb="${k}"]`, el); if(!b) return;
      const filas = filosofiaDe(p).tablas[k], cols = COLS[k];
      tablaEditable(b, { filas, mover:true, columnas:[{ k:"_o", t:"Origen", calc: f=>f._auto ? (f._ed ? "editado" : "auto") : "agregado" }, ...cols],
        nuevo: ()=>Object.fromEntries(cols.map(c=>[c.k, c.op ? c.op[0] : ""])), onCell: ()=>{}, vacio:"Sin filas: se arman con los equipos e instrumentos del proyecto.",
        onChange: ()=>{ guardarTabla(p, k, filas); cambio(); if(k==="setpoints") montar("alarmas"); } });
    };
    Object.keys(COLS).forEach(montar);
    // tarjetas (subsistemas y etapas: textos largos)
    const tarjetas = (k, campos, nuevo) => {
      const b = $(`[data-cards="${k}"]`, el); if(!b) return;
      const filas = filosofiaDe(p).tablas[k], g = ()=>{ guardarTabla(p, k, filas); cambio(); };
      b.innerHTML = filas.map((f,i)=>`<div class="card" style="padding:12px;margin-bottom:10px" data-i="${i}"><div class="row between mb-1">${badge(f)}<div class="row"><button class="btn-ghost btn-sm" data-cm="-1" title="Subir">↑</button><button class="btn-ghost btn-sm" data-cm="1" title="Bajar">↓</button><button class="btn-ghost btn-sm" data-cdel title="Eliminar">${ICON.trash}</button></div></div>
        ${campos.map(([c, l, rows])=>campo(l, rows ? `<textarea data-f="${c}" rows="${rows}">${esc(f[c]||"")}</textarea>` : `<input type="text" data-f="${c}" value="${esc(f[c]||"")}">`)).join("")}</div>`).join("") + `<button class="btn-sm" data-cadd>${ICON.plus} Agregar</button>`;
      const i = x => +x.closest("[data-i]").dataset.i;
      $$("[data-f]", b).forEach(x=>x.onchange = ()=>{ filas[i(x)][x.dataset.f] = x.value; g(); });
      $$("[data-cdel]", b).forEach(x=>x.onclick = ()=>{ filas.splice(i(x), 1); g(); tarjetas(k, campos, nuevo); });
      $$("[data-cm]", b).forEach(x=>x.onclick = ()=>{ const a = i(x), z = a + +x.dataset.cm; if(z<0 || z>=filas.length) return; [filas[a], filas[z]] = [filas[z], filas[a]]; g(); tarjetas(k, campos, nuevo); });
      $("[data-cadd]", b).onclick = ()=>{ filas.push(nuevo()); g(); tarjetas(k, campos, nuevo); };
    };
    tarjetas("subsistemas", [["nombre","Nombre"],["descripcion","Descripción",4],["alimentacion","Alimentación y control",2],["modos","Modos de operación",3],["caracteristicas","Características",2]], ()=>({ nombre:"", descripcion:"", alimentacion:"", modos:"", caracteristicas:"" }));
    tarjetas("etapas", [["titulo","Etapa"],["texto","Descripción",4]], ()=>({ titulo:"", texto:"" }));
    // áreas del alcance (una tabla por área)
    const ab = $("[data-areas]", el);
    if(ab){
      const areas = JSON.parse(JSON.stringify(F.areas||[])), g = ()=>{ guardarAreas(p, areas); cambio(); };
      const pinta = ()=>{
        ab.innerHTML = areas.map((a,i)=>`<div class="card" style="padding:12px;margin-bottom:10px" data-a="${i}"><div class="row between mb-1"><input type="text" data-an value="${esc(a.nombre||"")}" placeholder="Nombre del área" style="min-width:260px"><button class="btn-ghost btn-sm" data-adel title="Eliminar área">${ICON.trash}</button></div><div data-aeq></div></div>`).join("") + `<button class="btn-sm" data-aadd>${ICON.plus} Agregar área</button>`;
        $$("[data-a]", ab).forEach(c=>{ const a = areas[+c.dataset.a]; a.equipos = a.equipos || [];
          $("[data-an]", c).onchange = e=>{ a.nombre = e.target.value; g(); };
          $("[data-adel]", c).onclick = ()=>{ areas.splice(+c.dataset.a, 1); g(); pinta(); };
          tablaEditable($("[data-aeq]", c), { filas:a.equipos, mover:true, nuevo:()=>({ descripcion:"", tag:"" }), onChange:g, columnas:[{ k:"descripcion", t:"Descripción", w:260 }, { k:"tag", t:"TAG", w:160 }] }); });
        $("[data-aadd]", ab).onclick = ()=>{ areas.push({ nombre:"Área", equipos:[] }); g(); pinta(); };
      };
      pinta();
    }
    // secuencias de parada: un evento con sus pasos
    const pb = $("[data-paradas]", el);
    if(pb){
      const ev = filosofiaDe(p).tablas.parada, g = ()=>{ guardarTabla(p, "parada", ev); cambio(); };
      const pinta = ()=>{
        pb.innerHTML = ev.map((e,i)=>`<div class="card" style="padding:12px;margin-bottom:10px" data-e="${i}"><div class="row between mb-1" style="gap:8px;flex-wrap:nowrap">${badge(e)}<input type="text" data-ev value="${esc(e.evento||"")}" style="flex:1;min-width:200px"><div class="row" style="flex-wrap:nowrap"><button class="btn-ghost btn-sm" data-em="-1" title="Subir">↑</button><button class="btn-ghost btn-sm" data-em="1" title="Bajar">↓</button><button class="btn-ghost btn-sm" data-edel title="Eliminar evento">${ICON.trash}</button></div></div><div data-ep></div></div>`).join("") + `<button class="btn-sm" data-eadd>${ICON.plus} Agregar evento</button>`;
        $$("[data-e]", pb).forEach(c=>{ const k = +c.dataset.e, e = ev[k]; e.pasos = e.pasos || [];
          $("[data-ev]", c).onchange = x=>{ e.evento = x.target.value; g(); };
          $("[data-edel]", c).onclick = ()=>{ ev.splice(k, 1); g(); pinta(); };
          $$("[data-em]", c).forEach(x=>x.onclick = ()=>{ const z = k + +x.dataset.em; if(z<0 || z>=ev.length) return; [ev[k], ev[z]] = [ev[z], ev[k]]; g(); pinta(); });
          tablaEditable($("[data-ep]", c), { filas:e.pasos, mover:true, nuevo:()=>({ equipo:"", accion:"", retardo:"0 s" }), onChange:g, columnas:[{ k:"equipo", t:"Equipo (TAG)", w:130 }, { k:"accion", t:"Acción", w:420 }, { k:"retardo", t:"Retardo", w:110 }] }); });
        $("[data-eadd]", pb).onclick = ()=>{ ev.push({ evento:"Nuevo evento", pasos:[] }); g(); pinta(); };
      };
      pinta();
    }
  },
  arreglo(el, p, cambio, docId){
    const disc = docId==="ins-arreglo" ? "INS" : "ELE";
    const d = datos(p); d.arreglo = d.arreglo || {}; d.arreglo[disc] = d.arreglo[disc] || {}; d.ubicaciones = d.ubicaciones || {};
    const cfg = d.arreglo[disc], ub = d.ubicaciones;
    const render = async ()=>{
      const plano = cfg.plano ? await S.leerArchivo(cfg.plano) : null;
      const elems = elementosArreglo(p, disc);
      el.innerHTML = `<div class="field"><label>Planta del proceso (DXF)</label>${plano ? `<div class="row"><span>${ICON.file} <strong>${esc(plano.nombre)}</strong> <span class="muted">${(plano.size/1024).toFixed(0)} kB</span></span><button class="btn-sm btn-danger" data-delpl>${ICON.trash}</button></div><canvas class="preview mt-1" data-prev style="max-height:260px"></canvas>` : `<div class="dropzone" data-pl><strong>Arrastra la planta (.dxf)</strong> o haz clic <span class="muted">(DWG: guárdalo como DXF)</span></div>`}</div>
        <div class="row between mb-1"><h3 class="ed-sub" style="margin:0">Ubicación (X, Y)</h3>${disc==="ELE" ? `<button class="btn-sm" data-sug title="Centro de carga de cada tablero, ponderado por la potencia de sus cargas">Sugerir ubicación de tableros</button>` : ""}</div>
        <div class="table-wrap"><table class="ed-table"><thead><tr><th>TAG</th><th>Descripción</th><th>Tipo</th><th>X</th><th>Y</th></tr></thead><tbody>
        ${elems.map(e=>{ const u = ub[e.tag]||{}; return `<tr data-tag="${esc(e.tag)}"><td class="mono">${esc(e.tag)}</td><td>${esc(e.desc)}</td><td class="muted">${e.tipo==="tablero"?"Tablero":e.tipo==="carga"?"Carga":"Instrumento"}${u.sugerido?' <span class="badge badge-blue">sugerida</span>':""}</td><td><input type="number" step="any" data-xy="x" value="${esc(u.x??"")}" style="width:110px"></td><td><input type="number" step="any" data-xy="y" value="${esc(u.y??"")}" style="width:110px"></td></tr>`; }).join("") || `<tr><td colspan="5" class="muted" style="text-align:center;padding:16px">Sin equipos: completa primero ${disc==="ELE"?"las cargas y tableros":"el listado de instrumentos"}.</td></tr>`}
        </tbody></table></div>`;
      const dz = $("[data-pl]", el);
      if(dz) dropzone(dz, ".dxf", async file=>{
        try{ const dx = parseDXF(await file.text()); if(!dx.entities.length) throw new Error("sin entidades");
          cfg.plano = await S.guardarArchivo({ tipo:"planta", proyectoId:p.id, nombre:file.name, size:file.size }, file); cambio(); render(); toast("Planta cargada"); }
        catch(err){ toast("No se pudo leer el DXF (guárdalo como DXF ASCII)", true); }
      });
      const dp = $("[data-delpl]", el); if(dp) dp.onclick = async ()=>{ await S.borrarArchivo(cfg.plano); cfg.plano = null; cambio(); render(); };
      const cv = $("[data-prev]", el); if(cv && plano){ try{ drawPreview(cv, parseDXF(await plano.blob.text()).entities, {}); }catch(e){} }
      $$("tr[data-tag] [data-xy]", el).forEach(i=>i.onchange = ()=>{ const tag = i.closest("tr").dataset.tag; ub[tag] = Object.assign({}, ub[tag]||{}, { [i.dataset.xy]: i.value==="" ? "" : parseFloat(i.value) }); delete ub[tag].sugerido; cambio(); });
      const sg = $("[data-sug]", el); if(sg) sg.onclick = ()=>{ const n = sugerirTableros(p); cambio(); render(); toast(n ? `${n} tablero(s) ubicados en su centro de carga` : "Ingresa primero X, Y de las cargas", !n); };
    };
    render();
  },
  notas(el, p, cambio, docId){
    const d = datos(p); const arr = d.notas[docId] || [];
    el.innerHTML = `${campo("Notas (una por línea)", `<textarea data-n rows="3" placeholder="Vacío = el documento no lleva notas">${esc(arr.join("\n"))}</textarea>`)}`;
    $("[data-n]", el).onchange = e=>{ d.notas[docId] = e.target.value.split(/\n/).map(s=>s.trim()).filter(Boolean); cambio(); };
  },
};

function tablaCampos(filas){
  return `<div class="table-wrap"><table class="ed-table"><thead><tr><th>#</th><th>Descripción</th><th>Unidad</th><th>Información</th><th>Origen</th></tr></thead><tbody>
    ${filas.map(f=> f.__var ? `<tr class="sec-row"><td colspan="5">${esc(f.texto)}</td></tr>` : `<tr><td class="mono muted">${f.n}</td><td>${esc(f.desc)}</td><td class="muted">${esc(f.unidad||"")}</td><td><input type="text" data-hd="${esc(f.desc)}" value="${esc(f.valor??"")}" style="width:100%;min-width:260px"></td><td><span class="badge ${f.origen==="usuario"?"badge-ok":f.origen==="proyecto"?"badge-blue":f.origen==="referencia"?"badge-warn":"badge-neutral"}">${esc(f.origen||"vacío")}</span></td></tr>`).join("")}
    </tbody></table></div>`;
}

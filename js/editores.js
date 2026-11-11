/* Ingenia — formularios de datos de entrada (se muestran solo los que usa cada documento). */
import { $, $$, esc, html, ICON, toast, dropzone } from "./ui.js";
import * as S from "./store.js";
import { save } from "./store.js";
import { PARAMETROS_DISENO, valoresDiseno } from "./modules/criterios.js";
import { renderEditor } from "./modules/tablas.js";
import { datos, nuevaCarga, derivarIO, derivarCircuitosControl, circuitosControl, instrumentos, sistemaTag, uidc, APPLICATIONS,
  TIPOS_TABLERO, nuevoTablero, tableros, tablerosPotencia, tablerosControl, tableroPorId, esControl, esFuerza, tf, tc, desdeTxt, aplicarTipicos, REGIMENES,
  calcularTablero, CLASES_CABLE, CANALIZACIONES, cablesFuerza, ipRecomendado, r2 } from "./datos.js";
import { camposHD, camposHDEq } from "./docs.js";
import { EQUIPOS_PROCESO, recomendarInstrumentos } from "./modules/proceso.js";
import { elementosArreglo, sugerirTableros } from "./cad/planos2.js";
import { parseDXF, drawPreview } from "./dxf.js";

export const TITULOS = {
  sistema:"Sistema", parametros:"Sistema eléctrico y condiciones ambientales", cargas:"Cargas por tablero", cargasControl:"Cargas de 120 VAC de los tableros de control",
  tableros:"Tableros del proyecto", instrumentos:"Listado de instrumentos", io:"Lista de entradas y salidas", tablerocontrol:"Configuración de los tableros de control", circuitos:"Circuitos de los tableros de control",
  memoria:"Criterios de la memoria de cálculo", hd:"Datos por instrumento", hdEq:"Datos por tablero", notas:"Notas del documento", cables:"Cables por carga",
  equiposCfg:"Alcance del listado", proceso:"Proceso y recomendación de instrumentos", filosofia:"Filosofía de control", arreglo:"Planta y ubicación de equipos",
};
export const AYUDA = {
  sistema:"Aparece en títulos, cajetín y columna SISTEMA.",
  cargas:"Una fila por carga. Los valores en cursiva son típicos: edítalos solo si tienes el dato de placa.",
  instrumentos:"Alimenta la lista I/O, los lazos, la arquitectura y las hojas de datos.",
  io:"Se genera desde instrumentos y cargas. Slot, canal y bornes se asignan solos.",
  hd:"Valores propuestos desde tu hoja de referencia. Lo que escribas tiene prioridad.",
  hdEq:"Valores del cálculo del tablero y del sitio. Lo que escribas tiene prioridad.",
  cables:"Tipo y sección salen del listado de cargas. Completa TAG, longitud y canalización.",
  tableros:"Las cargas e instrumentos se asignan a estos tableros.",
  arreglo:"Carga la planta del cliente (DXF) e ingresa X, Y de cada equipo en las mismas unidades del plano.",
};

export function renderEditores(cont, p, claves, docId, onChange){
  cont.innerHTML = claves.map(k=>`<section class="card ed-card" data-ed="${k}"><div class="card-head"><div><h2>${esc(TITULOS[k]||k)}</h2>${AYUDA[k]?`<div class="muted" style="font-size:12.5px;margin-top:3px">${esc(AYUDA[k])}</div>`:""}</div></div><div class="card-body" id="ed-${k}"></div></section>`).join("");
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

/* tabla editable genérica */
function tablaEditable(el, { columnas, filas, nuevo, ejemplo, onChange, vacio, onCell, clase, extraBotones }){
  const render = ()=>{
    el.innerHTML = html`<div class="row between mb-2"><div class="row">
        ${nuevo ? `<button class="btn-primary btn-sm" data-add>${ICON.plus} Agregar fila</button>` : ""}
        ${ejemplo ? `<button class="btn-sm" data-ej>Cargar ejemplo</button>` : ""}${extraBotones||""}
      </div><span class="muted">${filas.length} registro(s)</span></div>
      <div class="table-wrap"><table class="ed-table"><thead><tr>${columnas.map(c=>`<th>${esc(c.t)}</th>`).join("")}${nuevo?"<th></th>":""}</tr></thead>
      <tbody>${filas.map((f,i)=>`<tr data-i="${i}">${columnas.map(c=>{
        const cls = clase ? (clase(f, c.k)||"") : "";
        if(c.calc) return `<td class="mono muted">${esc(c.calc(f,i))}</td>`;
        const ops = typeof c.op==="function" ? c.op(f) : c.op;
        if(ops) return `<td><select data-c="${c.k}" class="${cls}" style="min-width:${c.w||90}px">${ops.map(o=>{ const [v,l] = Array.isArray(o)?o:[o,o]; return `<option value="${esc(v)}" ${String(f[c.k]??"")===String(v)?"selected":""}>${esc(l)}</option>`; }).join("")}</select></td>`;
        if(c.chk) return `<td style="text-align:center"><input type="checkbox" data-c="${c.k}" ${f[c.k]?"checked":""}></td>`;
        return `<td><input type="${c.n?"number":"text"}" ${c.n?'step="any"':""} data-c="${c.k}" value="${esc(f[c.k]??"")}" class="${cls}" style="width:${c.w||110}px"></td>`;
      }).join("")}${nuevo?`<td><button class="btn-ghost btn-sm" data-del title="Eliminar">${ICON.trash}</button></td>`:""}</tr>`).join("") || `<tr><td colspan="${columnas.length+1}" class="muted" style="text-align:center;padding:20px">${esc(vacio||"Sin registros")}</td></tr>`}</tbody></table></div><div data-pie></div>`;
    const ad = $("[data-add]", el); if(ad) ad.onclick = ()=>{ filas.push(nuevo()); onChange(); render(); };
    const ej = $("[data-ej]", el); if(ej) ej.onclick = ()=>{ ejemplo().forEach(x=>filas.push(x)); onChange(); render(); toast("Ejemplo cargado — edítalo según tu proyecto"); };
    $$("[data-del]", el).forEach(b=>b.onclick = ()=>{ filas.splice(+b.closest("tr").dataset.i, 1); onChange(); render(); });
    $$("[data-c]", el).forEach(inpEl=>inpEl.addEventListener("change", ()=>{
      const f = filas[+inpEl.closest("tr").dataset.i], c = columnas.find(x=>x.k===inpEl.dataset.c);
      f[c.k] = inpEl.type==="checkbox" ? inpEl.checked : c.n ? (inpEl.value===""?"":parseFloat(inpEl.value)) : inpEl.value;
      if(onCell) onCell(f, c.k);
      onChange(); if(c.rerender || onCell) render();
    }));
    if(el._pie) el._pie($("[data-pie]", el));
  };
  el._render = render;
  render();
}

/* ---------------- editores ---------------- */
const ED = {
  sistema(el, p, cambio){
    const d = datos(p);
    el.innerHTML = `<div class="grid-3">
      ${campo("Nombre del sistema", `<input type="text" data-s="nombre" value="${esc(d.sistema.nombre)}" placeholder="Nombre del sistema o equipo">`)}
      ${campo("TAG del sistema", `<input type="text" class="mono" data-s="tag" value="${esc(d.sistema.tag)}" placeholder="TAG">`)}
      ${campo("P&ID de referencia", `<input type="text" data-pid value="${esc(p.pidRef||"")}" placeholder="Código del P&amp;ID del cliente">`)}
    </div><label class="checkbox"><input type="checkbox" data-pref ${d.sistema.prefijo!==false?"checked":""}> Anteponer el TAG del sistema a instrumentos y señales</label>`;
    $$("[data-s]", el).forEach(i=>i.onchange = ()=>{ d.sistema[i.dataset.s] = i.value.trim(); cambio(); });
    $("[data-pref]", el).onchange = e=>{ d.sistema.prefijo = e.target.checked; cambio(); };
    $("[data-pid]", el).onchange = e=>{ p.pidRef = e.target.value.trim(); cambio(); };
  },
  parametros(el, p, cambio){
    p.diseno = p.diseno || {}; const v = valoresDiseno(p);
    const grupo = g=>`<div class="grid-3">${g.campos.map(c=>campo(c.label, c.tipo==="select" ? `<select data-dis="${c.key}">${[...new Set([...c.opciones, v[c.key]].filter(x=>x!=null && x!==""))].map(o=>`<option ${String(v[c.key])===String(o)?"selected":""}>${esc(o)}</option>`).join("")}</select>` : `<input type="${c.tipo}" data-dis="${c.key}" value="${esc(v[c.key])}">`)).join("")}</div>`;
    // los criterios de dimensionamiento ya traen valores típicos: se muestran plegados
    el.innerHTML = PARAMETROS_DISENO.map((g,i)=> i<2 ? `<h3 class="ed-sub">${esc(g.grupo)}</h3>${grupo(g)}` : `<details class="more mb-2"><summary>${esc(g.grupo)} <span class="muted" style="font-weight:400">(valores típicos)</span></summary><div class="mt-1">${grupo(g)}</div></details>`).join("") +
      `<p class="muted" style="font-size:12.5px">Grado de protección de gabinetes: <strong data-ip>${esc(ipRecomendado(v))}</strong></p>`;
    $$("[data-dis]", el).forEach(i=>i.onchange = ()=>{ p.diseno[i.dataset.dis] = i.value; $("[data-ip]", el).textContent = ipRecomendado(valoresDiseno(p)); cambio(); });
  },
  tableros(el, p, cambio){
    const d = datos(p);
    const render = ()=>{
      const pot = tablerosPotencia(p), ctl = tablerosControl(p);
      el.innerHTML = `<div class="table-wrap"><table class="ed-table"><thead><tr><th>Tipo</th><th>TAG</th><th>Nombre</th><th>Alimentado desde</th><th>Controlado desde</th><th>Marca</th><th>Modelo</th><th>Accesorios</th><th></th></tr></thead><tbody>
        ${d.tableros.map((t,i)=>`<tr data-i="${i}"><td>${esc(TIPOS_TABLERO[t.tipo].nombre)}</td>
          <td><input type="text" data-c="tag" value="${esc(t.tag)}" style="width:100px"></td><td><input type="text" data-c="nombre" value="${esc(t.nombre)}" style="width:190px"></td>
          <td><select data-c="desde"><option value="">Externo / existente</option>${pot.filter(x=>x!==t).map(x=>`<option value="${x.id}" ${t.desde===x.id?"selected":""}>${esc(x.tag)}</option>`).join("")}</select>${t.desde?"":` <input type="text" data-c="desdeTexto" value="${esc(t.desdeTexto||"")}" placeholder="Ej: SE-01" style="width:140px">`}</td>
          <td>${esFuerza(t) && t.tipo!=="fuerzacontrol" ? `<select data-c="control"><option value="">${ctl[0] ? esc(ctl[0].tag)+" (por defecto)" : "—"}</option>${ctl.map(x=>`<option value="${x.id}" ${t.control===x.id?"selected":""}>${esc(x.tag)}</option>`).join("")}</select>` : `<span class="muted">—</span>`}</td>
          <td><input type="text" data-c="marca" value="${esc(t.marca||"")}" style="width:90px"></td><td><input type="text" data-c="modelo" value="${esc(t.modelo||"")}" style="width:90px"></td>
          <td style="white-space:nowrap">${t.tipo!=="control" ? [["spd","SPD"],["releFase","Relé fases"],["luces","Luces"]].map(([k,l])=>`<label class="checkbox" style="font-size:12px"><input type="checkbox" data-acc="${k}" ${(t.accesorios||{})[k]?"checked":""}> ${l}</label>`).join(" ") : '<span class="muted">—</span>'}</td>
          <td><button class="btn-ghost btn-sm" data-del title="Eliminar">${ICON.trash}</button></td></tr>`).join("")}
        </tbody></table></div>
        <div class="row mt-1">${Object.entries(TIPOS_TABLERO).map(([k,T])=>`<button class="btn-sm" data-addt="${k}">${ICON.plus} ${esc(T.nombre)}</button>`).join("")}</div>`;
      $$("[data-addt]", el).forEach(b=>b.onclick = ()=>{ const k = b.dataset.addt; d.tableros.push(nuevoTablero(k, d.tableros.filter(t=>t.tipo===k).length+1)); cambio(); render(); });
      $$("[data-del]", el).forEach(b=>b.onclick = ()=>{ const t = d.tableros[+b.closest("tr").dataset.i]; if(d.tableros.length<=1){ toast("El proyecto debe tener al menos un tablero", true); return; } d.tableros.splice(+b.closest("tr").dataset.i,1); d.tableros.forEach(x=>{ if(x.desde===t.id) x.desde=""; if(x.control===t.id) x.control=""; }); d.cargas.forEach(l=>{ if(l.tablero===t.id) l.tablero=""; }); instrumentos(p).forEach(i=>{ if(i.tablero===t.tag) i.tablero=""; }); cambio(); render(); });
      $$("tr[data-i] [data-acc]", el).forEach(i=>i.onchange = ()=>{ const t = d.tableros[+i.closest("tr").dataset.i]; t.accesorios = t.accesorios || {}; t.accesorios[i.dataset.acc] = i.checked; cambio(); });
      $$("tr[data-i] [data-c]", el).forEach(i=>i.onchange = ()=>{
        const t = d.tableros[+i.closest("tr").dataset.i], k = i.dataset.c, v = i.value.trim();
        if(k==="tag"){ if(!v || d.tableros.some(x=>x!==t && x.tag===v)){ toast("TAG vacío o repetido", true); i.value = t.tag; return; } instrumentos(p).forEach(x=>{ if(x.tablero===t.tag) x.tablero = v; }); d["ins-io"].forEach(x=>{ if(x.tablero===t.tag) x.tablero = v; }); }
        t[k] = v; cambio(); if(k==="desde") render();
      });
    };
    render();
  },
  tablerocontrol(el, p, cambio){
    const ctl = tablerosControl(p);
    if(!ctl.length){ el.innerHTML = `<div class="empty">El proyecto no tiene tableros de control. Agrégalos en <a href="#/proyecto/${p.id}/diseno">Datos generales</a>.</div>`; return; }
    let cur = el.dataset.t && ctl.find(t=>t.id===el.dataset.t) ? el.dataset.t : ctl[0].id;
    const t = ctl.find(x=>x.id===cur);
    el.innerHTML = (ctl.length>1 ? `<div class="row between">${selectorTablero(ctl, cur)}<button class="btn-sm mb-2" data-todos title="Copia controlador, criterios I/O y opciones (no copia TAG ni alimentación)">Aplicar a los ${ctl.length} tableros de control</button></div>` : "") + `<div class="grid-3">
      ${campo("Alimentación de 120 VAC desde", inp("desde120", t.desde120||"", "text", 'placeholder="Vacío = tablero de Datos generales"'))}
      ${campo("Controlador", inp("plc", t.plc))}${campo("Modelo de controlador (opcional)", inp("modeloPlc", t.modeloPlc), "Según el fabricante")}${campo("Red externa", inp("redExterna", t.redExterna))}
    </div><div class="row" style="gap:22px;margin-top:6px">
      <label class="checkbox"><input type="checkbox" data-k="switch" ${t.switch?"checked":""}> Switch Ethernet</label>
      <label class="checkbox"><input type="checkbox" data-k="hmi" ${t.hmi?"checked":""}> Pantalla HMI</label>
      <label class="checkbox"><input type="checkbox" data-k="router" ${t.router?"checked":""}> Router IIoT</label>
      <label class="checkbox"><input type="checkbox" data-k="controladorLimpieza" ${t.controladorLimpieza?"checked":""}> Controlador de limpieza</label>
    </div>
    <h3 class="ed-sub mt-2">Criterios del listado I/O</h3>
    <div class="grid-3">
      ${campo("Tensión de entradas digitales", sel("ioDiscreto", t.ioDiscreto, ["120 VAC","24 VDC"]))}
      ${campo("Mando de variadores", sel("vfdMando", t.vfdMando, [["cableado","Cableado (listo, marcha, falla, arranque, reset y referencia 4-20 mA)"],["red","Por red (Ethernet/IP)"]]))}
      ${campo("TAG del controlador de limpieza", inp("tagLimpieza", t.tagLimpieza))}
      ${campo("Primer slot de E/S", inp("primerSlot", t.primerSlot, "number"), "Slot 0 = CPU")}
      ${campo("Desplazamiento de borneras", inp("tbOffset", t.tbOffset, "number"), "Bornera TB = slot + desplazamiento")}
      ${campo("Canales por módulo AI / AO / DI / DO", ["AI","AO","DI","DO"].map(k=>`<input type="number" data-can="${k}" value="${esc((t.canales||{})[k]??"")}" style="width:58px">`).join(" "))}
    </div>
    <div class="row" style="gap:22px">
      <label class="checkbox"><input type="checkbox" data-k="senalesTablero" ${t.senalesTablero?"checked":""}> Señales del tablero (parada de emergencia, reset, local/remoto, disparo del ITM general)</label>
      <label class="checkbox"><input type="checkbox" data-k="repetidores" ${t.repetidores?"checked":""}> Repetición de estados hacia sala de control (DO por relé) y falla de PLC</label>
      <label class="checkbox"><input type="checkbox" data-k="listarReservas" ${t.listarReservas?"checked":""}> Listar los canales de reserva</label>
    </div>`;
    bindObj(el, t, cambio, ["primerSlot","tbOffset"]);
    $$("[data-can]", el).forEach(i=>i.onchange = ()=>{ t.canales = t.canales || {}; t.canales[i.dataset.can] = parseInt(i.value)||16; cambio(); });
    const s = $("[data-tsel]", el); if(s) s.onchange = ()=>{ el.dataset.t = s.value; ED.tablerocontrol(el, p, cambio); };
    const todos = $("[data-todos]", el); if(todos) todos.onclick = ()=>{
      const k = ["modeloPlc","redExterna","switch","hmi","router","controladorLimpieza","ioDiscreto","vfdMando","primerSlot","tbOffset","senalesTablero","repetidores","listarReservas"];
      ctl.filter(x=>x!==t).forEach(x=>{ k.forEach(c=>{ x[c] = t[c]; }); x.canales = Object.assign({}, t.canales||{}); });
      cambio(); toast(`Configuración de ${t.tag} aplicada a ${ctl.length-1} tablero(s)`); };
  },
  cargas(el, p, cambio){
    const d = datos(p), v = valoresDiseno(p);
    const apps = APPLICATIONS.map(a=>[a.v, a.label]);
    const pot = tablerosPotencia(p);
    const def = tf(p);
    const opsT = pot.map(t=>[t.id, t.tag]);
    d.cargas.forEach(l=>{ if(!pot.some(t=>t.id===l.tablero)) l.tablero = def.id; });
    const nota = `<div class="ws-note mb-2">Sistema: <strong class="mono">${esc(v.tension)} V · 3F · ${esc(v.frecuencia)} Hz</strong> · control <strong class="mono">${esc(v.tensionControl)} VAC</strong> <a href="#/proyecto/${p.id}/diseno" style="font-size:12px">cambiar</a></div>`;
    const wrap = document.createElement("div"); el.innerHTML = nota; el.appendChild(wrap);
    wrap._pie = pie => {
      pie.innerHTML = `<div class="stat-row mt-2">${pot.map(t=>{ const c = calcularTablero(p, t); if(!c.circuits.length) return ""; return `<div class="stat"><div class="k">${esc(t.tag)} — PI / MD / I<sub>MD</sub></div><div class="v" style="font-size:15px">${r2(c.installedKVA,1)} kVA · ${r2(c.totalKVA,1)} kVA · ${r2(c.demandCurrent,1)} A</div></div>`; }).join("")}</div>`;
    };
    tablaEditable(wrap, { filas: d.cargas, onChange: cambio, vacio:"Sin cargas. Agrega la primera fila.",
      nuevo: ()=>nuevaCarga("motor", def.id),
      extraBotones: `<button class="btn-sm" data-tip title="Vuelve a proponer FDP, EFF, FU y FS típicos en todas las cargas">Restablecer valores típicos</button>`,
      onCell: (f, k)=>{ if(["fp","effPct","fu","fs"].includes(k)){ f.man = f.man||{}; f.man[k] = true; } if(k==="kind" && f.kind==="general"){ f.powerUnit = "kw"; if(!(f.man||{}).fp) f.fp = 0.9; } if(["power","powerUnit","regimen","kind"].includes(k)) aplicarTipicos(f); },
      clase: (f, k)=>["fp","effPct","fu","fs"].includes(k) && !(f.man||{})[k] ? "tipico" : "",
      columnas:[
        { k:"tablero", t:"Tablero", op: opsT, w:100 },
        { k:"tag", t:"TAG", w:110 }, { k:"desc", t:"Nombre de la carga", w:180 },
        { k:"kind", t:"Tipo", op:[["motor","Motor"],["general","Carga general (kW)"],["control","Transformador de control"],["feeder","Alimentador"]], w:120 },
        { k:"application", t:"Aplicación", op: apps, w:150 },
        { k:"power", t:"Potencia", n:true, w:70 }, { k:"powerUnit", t:"Unidad", op:[["hp","HP"],["kw","kW"]], w:70 },
        { k:"starter", t:"Arranque", op:[["dol","Directo"],["vfd","Variador"],["ss","Arrancador suave"]], w:130 },
        { k:"regimen", t:"Régimen", op: REGIMENES.map(r=>[r.v, r.label]), w:120 },
        { k:"fp", t:"FDP", n:true, w:58 }, { k:"effPct", t:"EFF (%)", n:true, w:60 }, { k:"fu", t:"FU", n:true, w:52 }, { k:"fs", t:"FS", n:true, w:52 },
        { k:"inPlaca", t:"I placa (A)", n:true, w:62 },
        { k:"fases", t:"Fases", op:[["3","3F"],["1","1F"]], w:60 },
        { k:"secV", t:"V sec. trafo", op:[["","—"],["120","120 V"],["220","220 V"]], w:75 },
        { k:"feederAmps", t:"I alim. (A)", n:true, w:70 },
      ] });
    const tip = $("[data-tip]", wrap); if(tip) tip.onclick = ()=>{ d.cargas.forEach(l=>{ l.man = {}; aplicarTipicos(l); }); cambio(); wrap._render(); toast("Valores típicos aplicados"); };
  },
  cables(el, p, cambio){
    const d = datos(p), cfg = d.cablesCfg;
    const render = ()=>{
      const filas = cablesFuerza(p);
      el.innerHTML = `<h3 class="ed-sub">Calidad del cable requerida por el cliente final</h3>
        <div class="grid-2">${Object.entries(CLASES_CABLE).map(([k,c])=>`<label class="deliv ${cfg.clase===k?"selected":""}" style="cursor:pointer;margin:0"><input type="radio" name="clase" value="${k}" ${cfg.clase===k?"checked":""}><div><div class="title">${esc(c.nombre)}</div><div class="desc">${esc(c.uso)}</div><div class="muted" style="font-size:11.5px">${esc(c.norma)} · ${esc(c.ref)}</div></div></label>`).join("")}</div>
        <div class="grid-3 mt-2">${campo("Canalización por defecto", sel("canalizacion", cfg.canalizacion, CANALIZACIONES))}${campo("Reserva de longitud (%)", inp("reserva", cfg.reserva, "number"), "Se suma a la longitud para compras")}</div>
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
  circuitos(el, p, cambio, docId){
    const d = datos(p);
    const ctl = tablerosControl(p);
    if(!ctl.length){ el.innerHTML = `<div class="empty">El proyecto no tiene tableros de control.</div>`; return; }
    const cur = el.dataset.t && ctl.find(t=>t.id===el.dataset.t) ? el.dataset.t : ctl[0].id;
    const t = ctl.find(x=>x.id===cur);
    const auto = !(d.circuitosCtl[t.id] && d.circuitosCtl[t.id].length);
    const filas = auto ? derivarCircuitosControl(p, t) : d.circuitosCtl[t.id];
    el.innerHTML = (ctl.length>1 ? selectorTablero(ctl, cur) : "") + `<div class="notice mb-2">${auto ? `Circuitos de <strong>${esc(t.tag)}</strong> generados desde sus instrumentos.` : `Circuitos editados de ${esc(t.tag)}.`} <button class="btn-sm" data-regen>${auto?"Editar circuitos":"Regenerar desde instrumentos"}</button></div><div data-t></div>`;
    const s = $("[data-tsel]", el); if(s) s.onchange = ()=>{ el.dataset.t = s.value; ED.circuitos(el, p, cambio, docId); };
    $("[data-regen]", el).onclick = ()=>{ if(auto) d.circuitosCtl[t.id] = derivarCircuitosControl(p, t); else delete d.circuitosCtl[t.id]; cambio(); ED.circuitos(el, p, cambio, docId); };
    const box = $("[data-t]", el);
    if(auto){
      box.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Barra</th><th>Circuito</th><th>Descripción</th><th class="num">Protección (A)</th><th>Cable</th><th class="num">Potencia (W)</th></tr></thead><tbody>${filas.map(c=>`<tr><td>${esc(c.barra)}</td><td class="mono">${esc(c.circuito)}</td><td>${esc(c.descripcion)}${c.diferencial?' <span class="chip">ID 30 mA</span>':""}</td><td class="num">${c.proteccion}</td><td class="mono">${esc(c.cable)}</td><td class="num">${c.potencia??""}</td></tr>`).join("")}</tbody></table></div><p class="muted mt-1" style="font-size:12px">Potencias de 120 VAC estimadas (se usan en el listado de cargas estabilizadas); edítalas con los datos del fabricante.</p>`;
      return;
    }
    tablaEditable(box, { filas, onChange: cambio, nuevo: ()=>({ barra:"120 VAC", circuito:"C"+(filas.length+1), descripcion:"", proteccion:6, cable:"2C#14AWG+14AWG(T)", potencia:0 }),
      columnas:[ { k:"barra", t:"Barra", op:["24 VDC","120 VAC","220 VAC"] }, { k:"circuito", t:"Circuito", w:60 }, { k:"descripcion", t:"Descripción", w:240 }, { k:"proteccion", t:"Protección (A)", n:true, w:70 }, { k:"diferencial", t:"ID 30 mA", chk:true }, { k:"cable", t:"Cable", w:160 }, { k:"potencia", t:"Potencia (W)", n:true, w:70 } ] });
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
        <div class="field"><label>Plano del proceso de referencia (DXF, PDF o imagen)</label>${ref ? `<div class="row"><span>${ICON.file} <strong>${esc(ref.nombre)}</strong> <span class="muted">${(ref.size/1024).toFixed(0)} kB</span></span><button class="btn-sm btn-danger" data-delref>${ICON.trash}</button></div>` : `<div class="dropzone" data-ref><strong>Arrastra el plano de referencia</strong> o haz clic <span class="muted">(.dxf, .pdf, .png, .jpg — los DWG deben guardarse como DXF)</span></div>`}</div>
        <h3 class="ed-sub mt-2">Equipos del proceso</h3><div data-eq></div>
        <div class="row mt-2"><button class="btn-primary" data-rec>${ICON.check} Recomendar instrumentos</button><span class="muted" style="font-size:12.5px">Según equipos y descripción. Aprueba los que correspondan.</span></div>
        <div data-recs class="mt-2"></div>`;
      $("[data-k=descripcion]", el).onchange = e=>{ pr.descripcion = e.target.value; cambio(); };
      const dz = $("[data-ref]", el); if(dz) dropzone(dz, ".dxf,.pdf,.png,.jpg,.jpeg", async file=>{ pr.referencia = await S.guardarArchivo({ tipo:"pid_ref", proyectoId:p.id, nombre:file.name, size:file.size }, file); cambio(); render(); toast("Plano de referencia guardado"); });
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
  filosofia(el, p, cambio){
    const f = datos(p).filosofia;
    el.innerHTML = `<p class="ws-note">Se arma con el proceso, las cargas y los instrumentos. Agrega solo lo que quieras precisar.</p>
      ${campo("Secuencias de arranque / parada (opcional)", `<textarea data-k="secuencias" rows="4" placeholder="Una línea por paso. Si se deja vacío, se propone una secuencia a partir de los equipos.">${esc(f.secuencias||"")}</textarea>`)}
      ${campo("Notas adicionales (opcional)", `<textarea data-k="notas" rows="3">${esc(f.notas||"")}</textarea>`)}`;
    bindObj(el, f, cambio);
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
    el.innerHTML = `${campo("Notas (una por línea)", `<textarea data-n rows="3" placeholder="Vacío = notas del formato">${esc(arr.join("\n"))}</textarea>`)}`;
    $("[data-n]", el).onchange = e=>{ d.notas[docId] = e.target.value.split(/\n/).map(s=>s.trim()).filter(Boolean); cambio(); };
  },
};

function tablaCampos(filas){
  return `<div class="table-wrap"><table class="ed-table"><thead><tr><th>#</th><th>Descripción</th><th>Unidad</th><th>Información</th><th>Origen</th></tr></thead><tbody>
    ${filas.map(f=> f.__var ? `<tr class="sec-row"><td colspan="5">${esc(f.texto)}</td></tr>` : `<tr><td class="mono muted">${f.n}</td><td>${esc(f.desc)}</td><td class="muted">${esc(f.unidad||"")}</td><td><input type="text" data-hd="${esc(f.desc)}" value="${esc(f.valor??"")}" style="width:100%;min-width:260px"></td><td><span class="badge ${f.origen==="usuario"?"badge-ok":f.origen==="proyecto"?"badge-blue":f.origen==="referencia"?"badge-warn":"badge-neutral"}">${esc(f.origen||"vacío")}</span></td></tr>`).join("")}
    </tbody></table></div>`;
}

/* Ingenia — módulo de listados editables (Instrumentación & Control): índice de instrumentos y lista de E/S.
   Los datos viven en el proyecto (p.datos[tablaId]) y se exportan con el formato estándar o del cliente.
   Esquemas con las columnas usuales de un listado de instrumentos y de un listado I/O. */
import { esc, html, ICON, toast } from "../ui.js";
import { save } from "../store.js";

export const ESQUEMAS = {
  "ins-instrumentos": {
    titulo:"Listado de instrumentos", nombreTabla:"instrumentos", hoja:"Índice",
    columnas:[
      { key:"item", titulo:"Ítem", ancho:6, auto:true },
      { key:"sistema", titulo:"Sistema", ancho:18 },
      { key:"cant", titulo:"Cant.", ancho:6, num:true, tipo:"number" },
      { key:"tag", titulo:"Tag", ancho:14 },
      { key:"descripcion", titulo:"Descripción", ancho:30 },
      { key:"servicio", titulo:"Servicio", ancho:28 },
      { key:"rango", titulo:"Rango", ancho:12 },
      { key:"unidad", titulo:"Unidad", ancho:8 },
      { key:"marca", titulo:"Marca", ancho:14 },
      { key:"modelo", titulo:"Modelo", ancho:22 },
      { key:"tipoSenal", titulo:"Tipo de señal", ancho:12, opciones:["Analógica","Discreta","Comunicación","N. A."] },
      { key:"senal", titulo:"Señal de salida", ancho:14, opciones:["4 - 20 mA","4 - 20 mA + HART","Contacto seco / Relé","0 - 10 V","Modbus RTU","Modbus TCP","PROFINET","N. A."] },
      { key:"alimentacion", titulo:"Alimentación eléctrica", ancho:18, opciones:["24 VDC / Loop Powered","24 VDC","120 VAC","220 VAC","N. A."] },
      { key:"ubicacion", titulo:"Ubicación", ancho:26 },
      { key:"tablero", titulo:"Tablero de control", ancho:12, opcionesFn: p => ((p.datos&&p.datos.tableros)||[]).filter(t=>t.tipo==="control"||t.tipo==="fuerzacontrol").map(t=>t.tag) },
      { key:"hojaDatos", titulo:"Hoja de datos", ancho:22 },
      { key:"notas", titulo:"Notas", ancho:16 },
    ],
  },
  "ins-io": {
    titulo:"Listado de entradas y salidas (I/O)", nombreTabla:"io", hoja:"Lista IO",
    columnas:[
      { key:"item", titulo:"Ítem", ancho:6, auto:true },
      { key:"tag", titulo:"Tag", ancho:12 },
      { key:"senal", titulo:"Señal", ancho:14 },
      { key:"descripcion", titulo:"Descripción", ancho:30 },
      { key:"tablero", titulo:"Tablero de control", ancho:12 },
      { key:"tipo", titulo:"Tipo E/S", ancho:8, opciones:["AI","AO","DI","DO","COM"], center:true },
      { key:"voltaje", titulo:"Voltaje / protocolo", ancho:14, opciones:["4-20 mA","24 VDC","120 VAC","Modbus TCP","PROFINET","Ethernet/IP"] },
      { key:"rangoMin", titulo:"Rango mín.", ancho:9, num:true, tipo:"number" },
      { key:"rangoMax", titulo:"Rango máx.", ancho:9, num:true, tipo:"number" },
      { key:"unidad", titulo:"Unidad", ancho:8 },
      { key:"alimentacion", titulo:"Alimentación", ancho:20, opciones:["Loop powered, 2 hilos (24 VDC)","Externa, 4 hilos (24 VDC)","Externa, 4 hilos (120 VAC)","-"] },
      { key:"slot", titulo:"Slot", ancho:6, num:true, auto:true },
      { key:"ch", titulo:"CH", ancho:6, num:true, auto:true },
      { key:"terminales", titulo:"Terminales", ancho:14 },
      { key:"pid", titulo:"P&ID", ancho:22 },
      { key:"lazo", titulo:"Diagrama de lazo", ancho:22 },
    ],
    // asignación automática slot/canal por tipo de señal (módulos consecutivos por tipo)
    canalesPorModulo:{ AI:16, AO:8, DI:16, DO:16, COM:1 },
    reservaPct:20,
  },
};

// Asigna ítem, slot y canal (I/O) automáticamente. Devuelve copia de filas con los campos calculados.
// Con el proyecto (p) se usa la configuración de cada tablero de control: canales por módulo, primer slot
// (el slot 0 es la CPU) y numeración de borneras (TB = slot + desplazamiento, dos bornes por canal).
const cfgCtl = (p, tag) => { const t = ((p && p.datos && p.datos.tableros)||[]).find(x=>x.tag===tag && (x.tipo==="control"||x.tipo==="fuerzacontrol")); return t || null; };
export function procesarFilas(id, filas, p){
  const esq = ESQUEMAS[id];
  const out = filas.map((f,i)=>Object.assign({}, f, { item: String(i+1).padStart(3,"0") }));
  if(id==="ins-io"){
    const est = {};
    for(const f of out){
      const t = f.tipo||"DI";
      const ct = cfgCtl(p, f.tablero);
      if(p && !ct && f.tablero){ f.slot = ""; f.ch = ""; f.terminales = f.terminales || "-"; continue; }   // controladores auxiliares (p.ej. limpieza): sin slot del PLC
      if(t==="COM"){ f.slot = ""; f.ch = ""; continue; }
      const per = (ct && ct.canales && ct.canales[t]) || esq.canalesPorModulo[t] || 16;
      const e = est[f.tablero||""] = est[f.tablero||""] || { slot: (ct ? (+ct.primerSlot||1) : 1) - 1, porTipo:{} };
      if(!(t in e.porTipo)){ e.slot++; e.porTipo[t] = { slot:e.slot, used:0 }; }
      const s = e.porTipo[t];
      if(s.used>=per){ e.slot++; s.slot = e.slot; s.used = 0; }
      f.slot = s.slot; f.ch = s.used; s.used++;
      const tb = "TB"+(f.slot + (ct ? (+ct.tbOffset||0) : 0));
      if(!f.terminales) f.terminales = `${tb}:${2*f.ch+1} / ${tb}:${2*f.ch+2}`;
    }
  }
  return out;
}

// Resumen de señales por controlador (hoja "Resumen" del listado I/O de referencia); no cuenta las reservas listadas
export function resumenIO(filas, reservaPct=20, p){
  const ctrls = [...new Set(filas.filter(f=>f.slot!=="" && f.slot!=null).map(f=>f.tablero||""))];
  const out = [];
  for(const c of (ctrls.length ? ctrls : [""])){
    const ct = cfgCtl(p, c); const cpmT = t => (ct && ct.canales && ct.canales[t]) || ESQUEMAS["ins-io"].canalesPorModulo[t];
    for(const t of ["AI","AO","DI","DO"]){
      const usados = filas.filter(f=>(f.tablero||"")===c && (f.tipo||"")===t && f.origen!=="reserva" && !/_RESERVA$/.test(f.senal||"")).length;
      const reserva = Math.ceil(usados*reservaPct/100);
      const req = usados+reserva; const mod = Math.ceil(req/cpmT(t));
      out.push({ tablero:c, tipo: ctrls.length>1 ? c+" "+t : t, usados, reserva, total:req, modulo:t, requeridos:req, modulos:mod, capacidad: mod*cpmT(t), cpm: cpmT(t) });
    }
  }
  return out;
}

export function tablasParaExportar(id, p){
  const esq = ESQUEMAS[id];
  const filas = procesarFilas(id, (p.datos&&p.datos[id])||[], p);
  const tablas = {};
  tablas[esq.hoja] = { titulo: esq.titulo, columnas: esq.columnas, filas, referencia: p.pidRef||"" };
  if(id==="ins-io"){
    tablas["Resumen"] = { titulo:"Resumen de señales I/O", columnas:[
      { key:"tipo", titulo:"Tipo de señal", ancho:14, center:true },{ key:"usados", titulo:"Canales utilizados", ancho:14, num:true },{ key:"reserva", titulo:"Canales de reserva", ancho:14, num:true },
      { key:"total", titulo:"Capacidad total (mín.)", ancho:16, num:true },{ key:"modulo", titulo:"Tipo de módulo", ancho:12, center:true },{ key:"requeridos", titulo:"Canales requeridos", ancho:14, num:true },{ key:"modulos", titulo:"Módulos (total)", ancho:12, num:true },{ key:"capacidad", titulo:"Capacidad instalada", ancho:14, num:true } ],
      filas: resumenIO(filas, esq.reservaPct, p), notas:[`Reserva de canales: ${esq.reservaPct}% por tipo de señal. Canales por módulo: AI ${esq.canalesPorModulo.AI}, AO ${esq.canalesPorModulo.AO}, DI ${esq.canalesPorModulo.DI}, DO ${esq.canalesPorModulo.DO} (editable en Datos de diseño).`] };
  }
  // alias para plantillas del cliente: {{tabla:instrumentos}} / {{tabla:io}}
  tablas[esq.nombreTabla] = Object.assign({alias:true}, tablas[esq.hoja]);
  return tablas;
}

/* ---------- editor ---------- */
export function renderEditor(container, id, p, onChange){
  const esq = ESQUEMAS[id];
  p.datos = p.datos || {}; p.datos[id] = p.datos[id] || [];
  const filas = p.datos[id];
  const render = ()=>{
    const proc = procesarFilas(id, filas, p);
    container.innerHTML = html`
      <div class="row between mb-2">
        <div class="row">
          <button class="btn-primary btn-sm" data-add>${ICON.plus} Agregar fila</button>
          <button class="btn-sm" data-paste title="Pega desde Excel: filas separadas por salto de línea, columnas por tabulación (en el orden de la tabla, sin la columna Ítem)">Pegar desde Excel</button>
        </div>
        <span class="muted">${filas.length} registro(s) · los campos Ítem${id==="ins-io"?", Slot, CH y Terminales":""} se asignan automáticamente</span>
      </div>
      <div class="table-wrap"><table>
        <thead><tr>${esq.columnas.map(c=>`<th>${esc(c.titulo)}</th>`).join("")}<th></th></tr></thead>
        <tbody>${proc.map((f,i)=>`<tr data-i="${i}">${esq.columnas.map(c=>{
          if(c.auto) return `<td class="mono muted">${esc(f[c.key]??"")}</td>`;
          const ops = c.opcionesFn ? c.opcionesFn(p) : c.opciones;
          if(ops) return `<td><select data-k="${c.key}" style="min-width:120px"><option value=""></option>${ops.map(o=>`<option ${f[c.key]===o?"selected":""}>${esc(o)}</option>`).join("")}</select></td>`;
          return `<td><input type="${c.tipo||"text"}" data-k="${c.key}" value="${esc(f[c.key]??"")}" style="min-width:${Math.max(70,(c.ancho||10)*6)}px"></td>`;
        }).join("")}<td><button class="btn-ghost btn-sm" data-del title="Eliminar">${ICON.trash}</button></td></tr>`).join("") || `<tr><td colspan="${esq.columnas.length+1}" class="muted" style="text-align:center;padding:22px">Sin registros. Agrega filas o pega desde Excel.</td></tr>`}</tbody>
      </table></div>
      ${id==="ins-io" ? resumenHTML(proc, esq, p) : ""}`;
    container.querySelector("[data-add]").onclick = ()=>{ filas.push({}); save(); render(); };
    container.querySelector("[data-paste]").onclick = async ()=>{
      let txt=""; try{ txt = await navigator.clipboard.readText(); }catch(e){ txt = prompt("Pega aquí el contenido copiado de Excel (tabulado):")||""; }
      const cols = esq.columnas.filter(c=>!c.auto);
      const rows = txt.split(/\r?\n/).filter(l=>l.trim());
      rows.forEach(l=>{ const cells = l.split("\t"); const o={}; cols.forEach((c,j)=>{ if(cells[j]!=null && cells[j]!=="") o[c.key] = c.tipo==="number" ? parseFloat(cells[j]) : cells[j].trim(); }); if(Object.keys(o).length) filas.push(o); });
      save(); render(); toast(`${rows.length} fila(s) importadas`);
    };
    container.querySelectorAll("[data-del]").forEach(b=>b.onclick = ()=>{ filas.splice(+b.closest("tr").dataset.i,1); save(); render(); });
    container.querySelectorAll("input[data-k],select[data-k]").forEach(el=>el.addEventListener("change", ()=>{
      const i = +el.closest("tr").dataset.i; const k = el.dataset.k;
      filas[i][k] = el.type==="number" ? (el.value===""?"":parseFloat(el.value)) : el.value; save();
      if(k==="tipo" || k==="tag") render(); // recalcula slot/canal/señal
      if(onChange) onChange();
    }));
  };
  render();
}
function resumenHTML(proc, esq, p){
  const r = resumenIO(proc, +((p.diseno||{}).reservaIO ?? 30), p);
  return `<div class="card mt-2"><div class="card-head"><h2>Resumen de señales y módulos</h2><span class="muted">Reserva ${+((p.diseno||{}).reservaIO ?? 30)} % · canales por módulo según la configuración del tablero de control</span></div>
  <div class="table-wrap" style="border:none;border-radius:0"><table><thead><tr><th>Tipo</th><th class="num">Usados</th><th class="num">Reserva</th><th class="num">Requeridos</th><th class="num">Canales/módulo</th><th class="num">Módulos</th><th class="num">Capacidad</th></tr></thead>
  <tbody>${r.map(x=>`<tr><td class="mono">${x.tipo}</td><td class="num">${x.usados}</td><td class="num">${x.reserva}</td><td class="num">${x.requeridos}</td><td class="num">${x.cpm}</td><td class="num">${x.modulos}</td><td class="num">${x.capacidad}</td></tr>`).join("")}</tbody></table></div></div>`;
}

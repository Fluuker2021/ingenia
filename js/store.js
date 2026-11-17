/* Ingenia — persistencia local (sin servidor): proyectos y organización en localStorage,
   archivos de plantillas (xlsx / docx / dxf / ctb / logo) en IndexedDB. */
const LS_KEY = "ingenia.v1";
const DB_NAME = "ingenia-files";

export const uid = (p="id") => p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2,7);

const defaults = () => ({
  org: { nombre:"", nombreCorto:"", direccion:"", web:"", logo:null /* id de archivo */ , elaboraPor:"", revisaPor:"", apruebaPor:"" },
  proyectos: [],
});

let state = null;
export function load(){
  if(state) return state;
  try{ const raw = localStorage.getItem(LS_KEY); state = raw ? Object.assign(defaults(), JSON.parse(raw)) : defaults(); }
  catch(e){ state = defaults(); }
  migrar(state); migrarVentilacion(state); retirarEntregables(state);
  return state;
}
/* datos guardados con versiones anteriores: unidades «VAC / VDC» → «Vac / Vdc» */
function migrar(s){
  if(s.migVac) return;
  const fix = v => typeof v==="string" ? v.replace(/(\d|\b)VAC\b/g, "$1Vac").replace(/(\d|\b)VDC\b/g, "$1Vdc")
    : Array.isArray(v) ? v.map(fix) : (v && typeof v==="object") ? (Object.keys(v).forEach(k=>{ v[k] = fix(v[k]); }), v) : v;
  s.proyectos = fix(s.proyectos || []);
  s.migVac = 1;
}
/* entregables retirados del catálogo: se quitan de los proyectos guardados */
const RETIRADOS = ["ele-arreglo","ins-bloques","ins-arreglo","ins-tipicos"];
function retirarEntregables(s){
  for(const p of s.proyectos||[]){
    if(Array.isArray(p.entregables)) p.entregables = p.entregables.filter(id=>!RETIRADOS.includes(id));
    for(const id of RETIRADOS) if(p.documentos) delete p.documentos[id];
  }
}
/* corrección 02: el circuito «Ventilación» de los tableros de control pasa a «Ventilación interna» */
function migrarVentilacion(s){
  if(s.migVent) return;
  for(const p of s.proyectos||[]) for(const lista of Object.values((p.datos||{}).circuitosCtl||{})) for(const c of lista||[]) if(c && c.descripcion==="Ventilación") c.descripcion = "Ventilación interna";
  s.migVent = 1;
}
export function save(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch(e){ console.warn("No se pudo guardar", e); } }

export function nuevoProyecto(data){
  const p = Object.assign({
    id: uid("prj"), creado: new Date().toISOString(),
    nombre:"", cliente:"", unidad:"", etapa:"detalle", descripcion:"",
    disciplinas:["ELE","INS"],
    entregables:[],           // ids del catálogo seleccionados
    documentos:{},            // id entregable -> {rev, fecha, estado, titulo, revisiones} (sin codificación: se identifican por su nombre)
    plantillas:{},            // tipo -> fileId (plantillas del cliente); vacío = estándar
    plantillaModo:"estandar", // "estandar" | "cliente"
    revisiones:[{rev:"A", fecha:new Date().toISOString().slice(0,10), descripcion:"Emitido para revisión interna"}],
  }, data||{});
  load().proyectos.unshift(p); save();
  return p;
}
export function proyecto(id){ return load().proyectos.find(p=>p.id===id); }
export function eliminarProyecto(id){ const s=load(); s.proyectos = s.proyectos.filter(p=>p.id!==id); save(); }

// ---------- documentos del proyecto ----------
// crea el registro de cada entregable seleccionado y retira los que ya no están en la selección
export function sincronizarDocumentos(p, catalogo){
  p.documentos = p.documentos || {};
  for(const id of p.entregables){
    const ent = catalogo.find(e=>e.id===id); if(!ent) continue;
    p.documentos[id] = p.documentos[id] || { rev:"A", fecha:new Date().toISOString().slice(0,10), estado:"Por elaborar", titulo: ent.nombre.toUpperCase() };
  }
  for(const id of Object.keys(p.documentos)){ const ent = catalogo.find(e=>e.id===id); if(!p.entregables.includes(id) && !(ent && ent.interno)) delete p.documentos[id]; }
  save();
}

// ---------- archivos (IndexedDB) ----------
function db(){
  return new Promise((res,rej)=>{
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = ()=>{ r.result.createObjectStore("files", {keyPath:"id"}); };
    r.onsuccess = ()=>res(r.result); r.onerror = ()=>rej(r.error);
  });
}
export async function guardarArchivo(meta, blob){
  const d = await db();
  const id = meta.id || uid("file");
  const rec = Object.assign({ id, creado: Date.now() }, meta, { blob });
  await new Promise((res,rej)=>{ const tx=d.transaction("files","readwrite"); tx.objectStore("files").put(rec); tx.oncomplete=res; tx.onerror=()=>rej(tx.error); });
  return id;
}
export async function leerArchivo(id){
  if(!id) return null;
  const d = await db();
  return new Promise((res,rej)=>{ const tx=d.transaction("files","readonly"); const q=tx.objectStore("files").get(id); q.onsuccess=()=>res(q.result||null); q.onerror=()=>rej(q.error); });
}
export async function borrarArchivo(id){
  const d = await db();
  await new Promise((res,rej)=>{ const tx=d.transaction("files","readwrite"); tx.objectStore("files").delete(id); tx.oncomplete=res; tx.onerror=()=>rej(tx.error); });
}
export async function listarArchivos(){
  const d = await db();
  return new Promise((res,rej)=>{ const tx=d.transaction("files","readonly"); const q=tx.objectStore("files").getAll(); q.onsuccess=()=>res(q.result||[]); q.onerror=()=>rej(q.error); });
}
export function blobToDataURL(blob){ return new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(blob); }); }

// ---------- respaldo ----------
export function exportarRespaldo(){ return JSON.stringify(load(), null, 2); }
export function importarRespaldo(json){ const data = JSON.parse(json); state = Object.assign(defaults(), data); state.migVac = 0; migrar(state); save(); return state; }

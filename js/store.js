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
  return state;
}
export function save(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch(e){ console.warn("No se pudo guardar", e); } }

export function nuevoProyecto(data){
  const p = Object.assign({
    id: uid("prj"), creado: new Date().toISOString(),
    nombre:"", cliente:"", unidad:"", codigo:"", area:"", etapa:"detalle", descripcion:"",
    // codificación de documentos: tokens {PROY} {AREA} {DISC} {TIPO} {SEQ}
    codPatron:"{PROY}-{AREA}-{DISC}-{TIPO}-{SEQ}", seqDigitos:3,
    disciplinas:["ELE","INS"],
    entregables:[],           // ids del catálogo seleccionados
    documentos:{},            // id entregable -> {codigo, rev, fecha, estado, titulo}
    plantillas:{},            // tipo -> fileId (plantillas del cliente); vacío = estándar
    plantillaModo:"estandar", // "estandar" | "cliente"
    revisiones:[{rev:"A", fecha:new Date().toISOString().slice(0,10), descripcion:"Emitido para revisión interna"}],
  }, data||{});
  load().proyectos.unshift(p); save();
  return p;
}
export function proyecto(id){ return load().proyectos.find(p=>p.id===id); }
export function eliminarProyecto(id){ const s=load(); s.proyectos = s.proyectos.filter(p=>p.id!==id); save(); }

// ---------- codificación de documentos ----------
export function codigoDocumento(p, ent, seq){
  const disc = ent.disciplina==="ELE" ? "07" : ent.disciplina==="INS" ? "09" : "00";
  const s = String(seq).padStart(p.seqDigitos||3, "0");
  return (p.codPatron||"{PROY}-{AREA}-{DISC}-{TIPO}-{SEQ}")
    .replace("{PROY}", p.codigo||"PROY").replace("{AREA}", p.area||"0000")
    .replace("{DISC}", disc).replace("{TIPO}", ent.doc).replace("{SEQ}", s);
}
// asigna/actualiza códigos a los entregables seleccionados, numerando por (disciplina, tipo)
export function sincronizarDocumentos(p, catalogo){
  const counters = {};
  p.documentos = p.documentos || {};
  // numeración por orden de código (ordenCodigo) para respetar la secuencia usual de la codificación del cliente
  const ordenados = p.entregables.slice().sort((a,b)=>{ const ea = catalogo.find(e=>e.id===a)||{}, eb = catalogo.find(e=>e.id===b)||{}; return (ea.ordenCodigo??ea.n??0)-(eb.ordenCodigo??eb.n??0); });
  for(const id of ordenados){
    const ent = catalogo.find(e=>e.id===id); if(!ent) continue;
    const key = ent.disciplina+"|"+ent.doc;
    counters[key] = (counters[key]||0) + 1;
    const d = p.documentos[id] || { rev:"A", fecha:new Date().toISOString().slice(0,10), estado:"Por elaborar", titulo: ent.nombre.toUpperCase() };
    if(!d.codigoManual) d.codigo = codigoDocumento(p, ent, counters[key]);
    p.documentos[id] = d;
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
export function importarRespaldo(json){ const data = JSON.parse(json); state = Object.assign(defaults(), data); save(); return state; }

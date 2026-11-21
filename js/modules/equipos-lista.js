/* Ingenia — LISTADO DE EQUIPOS ELÉCTRICOS por tablero.
   Sale del arreglo de cada tablero (los mismos equipos del multifilar y del plano mecánico): gabinete, interruptores,
   contactores, variadores, transformadores, fuentes, PLC, dispositivos de puerta y accesorios. No se listan los materiales
   menores (canaletas, riel DIN, borneras, barras, aisladores, prensaestopas, señales ni cables).
   Marca, modelo y código se proponen desde las marcas del proyecto; el usuario puede corregirlos en «Datos». */
import { datos, tableros, calcularTablero, esPotencia } from "../datos.js";
import { arregloTablero } from "../mecanico/arreglo.js";
import { arregloControl } from "../mecanico/arreglo-control.js";
import { marcasProyecto } from "../engine/marcas.js";

const EXCLUIR = /canaleta|riel din|perfil soporte|\bbornes?\b|fusible-borne|tapa final|topes|marcador|barras? (de cobre|de tierra)|aislador|prensaestopa|señal de riesgo|\bpeine\b|\bcables?\b|terminal(es)? de|etiqueta|tapón/i;
const MARCAS = ["Schneider Electric","Allen-Bradley","Phoenix Contact","nVent Hoffman","Rockwell Automation","Weidmüller","Pfannenberg","Telemecanique","ABB","Siemens","Eaton","Danfoss","Rittal","Finder","Omron","Legrand","Wago","Moxa","Hirschmann","Bussmann","Schneider","Hoffman"];
const NORM = { "Schneider":"Schneider Electric", "Hoffman":"nVent Hoffman" };

/* marca al inicio del modelo («Schneider ComPacT NSX…») o en la referencia de catálogo del componente («ABB Tmax XT — …») */
function separarMarca(modelo, fuente){
  const m = String(modelo||"").trim();
  for(const b of MARCAS) if(m.toLowerCase().startsWith(b.toLowerCase() + " ")) return { marca: NORM[b] || b, modelo: m.slice(b.length).trim() };
  const f = String(fuente||"");
  for(const b of MARCAS) if(new RegExp("^" + b.replace(/[-]/g, "\\-") + "\\b", "i").test(f)) return { marca: NORM[b] || b, modelo: m };
  return { marca:"", modelo: m };
}
/* códigos de pedido que ya vienen en el modelo (Siemens 6ES7…, Allen-Bradley 1769-…/5069-…, ABB 1SDA…/2CDS…/1SVR…, Bussmann 170M…) */
const RE_COD = /\b(6E[SP]7\s?\d{3}-\w{4,5}-\w{4}|1[4-9]\d{2}-[A-Z0-9]{2,10}|5069-[A-Z0-9]{2,8}|1SDA\d{6}R\d|2CDS\d{6}R\d{4}|1SVR\d{6}R\d{4}|1SAM\d{6}R\d{4}|1SFA\d{6}R\d{4}|170M\d{4}[A-Z]?)\b/;

/* marca por familia del equipo (cuando el modelo no la trae) */
function marcaPorFamilia(desc, mr){
  const d = String(desc||"").toLowerCase();
  if(/variador/.test(d)) return mr.variadores;
  if(/arrancador suave/.test(d)) return mr.arrancadores;
  if(/contactor|guardamotor|sobrecarga/.test(d)) return mr.maniobra;
  if(/supresor|sobretensi/.test(d)) return mr.spd;
  if(/relé de monitoreo|relé de fases|monitoreo de tensión/.test(d)) return mr.reles;
  if(/interruptor|diferencial|portafusible|seccionador|fusible/.test(d)) return mr.interruptores;
  return "";
}

const clave = (t, f) => `${t.id}|${f.tag}|${f.descripcion}`;
/* TAG de equipos agrupados: «F1 … F3» si son correlativos, si no «F1, F4» */
function rango(tags){
  const t = tags.filter(Boolean); if(t.length < 2) return t[0] || "";
  const m = t.map(x=>/^(.*?)(\d+)$/.exec(x)), pre = m[0] && m[0][1];
  const seguidos = m.every((x, i)=>x && x[1]===pre && (i===0 || +x[2]===+m[i-1][2] + 1));
  return seguidos && t.length > 2 ? `${t[0]} … ${t[t.length-1]}` : t.join(", ");
}

/* filas de un tablero: [{ tag, cant, descripcion, marca, modelo, codigo, notas, _marca, _modelo, _codigo }] */
export function equiposDeTablero(p, t){
  let m = null;
  try { if(t.tipo==="control") m = arregloControl(p, t); else { const c = calcularTablero(p, t); if(c.circuits.length) m = arregloTablero(p, t, c); } } catch(e){ console.warn("equipos", t.tag, e); }
  if(!m) return [];
  const mr = marcasProyecto(p), over = datos(p).equiposOver || {};
  const filas = [];
  // gabinete
  filas.push({ tag: t.tag, cant: 1, descripcion: `Gabinete ${m.montaje==="mural" ? "mural" : "autosoportado"} de ${m.W} x ${m.H} x ${m.D} mm (ancho x alto x fondo), ${m.ip || "IP54"}${m.secciones && m.secciones.length > 1 ? `, ${m.secciones.length} cuerpos` : ""}`,
    _marca: t.marca || mr.gabinetes, _modelo: t.modelo || "Por definir", _codigo: "" });
  for(const b of m.bom || []){
    const desc = String(b.desc||"").trim(), mod = String(b.modelo||"").trim();
    if(!desc || EXCLUIR.test(desc) || EXCLUIR.test(mod)) continue;
    if(typeof b.cant==="string" && /\bm$/.test(b.cant)) continue;      // materiales por metro
    const s = separarMarca(mod, b.fuente);
    const cod = (mod.match(RE_COD) || [""])[0];
    // interruptores de circuitos cuya descripción es solo el nombre del circuito
    let dsc = desc.charAt(0).toUpperCase() + desc.slice(1);
    if(/^S20[1-4]|^S2\d{2}-|iC60|5SL|FAZ/.test(s.modelo) && !/interruptor|diferencial|portafusible|seccionador/i.test(dsc)) dsc = `Interruptor termomagnético del circuito «${dsc}»`;
    const ant = filas[filas.length - 1];
    const marca = s.marca || marcaPorFamilia(desc, mr) || "Por definir";
    // equipos iguales seguidos (F1, F2, F3…): una sola fila con su cantidad
    if(ant && ant._grupo && ant.descripcion===dsc && ant._modelo===s.modelo && ant._marca===marca && typeof b.cant==="number" && typeof ant.cant==="number"){
      ant._tags.push(b.tag || ""); ant.cant += b.cant; ant.tag = rango(ant._tags); continue; }
    filas.push({ tag: b.tag || "", _tags:[b.tag || ""], _grupo: true, cant: b.cant || 1, descripcion: dsc, _marca: marca, _modelo: s.modelo, _codigo: cod });
  }
  // valores del usuario (marca / modelo / código editados) sobre los propuestos
  return filas.map(f=>{ const o = over[clave(t, f)] || {};
    return Object.assign(f, { marca: o.marca || f._marca, modelo: o.modelo || f._modelo, codigo: o.codigo || f._codigo || "—", notas: o.notas || "", _clave: clave(t, f) }); });
}

/* listado completo: una sección por tablero, ítems numerados dentro de cada tablero */
export function listadoEquipos(p){
  const filas = [];
  for(const t of tableros(p)){
    const eq = equiposDeTablero(p, t); if(!eq.length) continue;
    filas.push({ __var:"seccion", texto: `${(t.nombre||"").toUpperCase()} ${t.tag}` });
    eq.forEach((f, i)=>filas.push(Object.assign({ item: i + 1 }, f)));
  }
  return filas;
}
export const claveEquipo = clave;

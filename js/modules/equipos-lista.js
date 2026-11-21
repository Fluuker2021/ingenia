/* Ingenia — LISTADO DE EQUIPOS ELÉCTRICOS por tablero.
   Sale del arreglo de cada tablero (los mismos equipos del multifilar y del plano mecánico): gabinete, interruptores,
   contactores, variadores, transformadores, fuentes, PLC, dispositivos de puerta y accesorios eléctricos. No se listan los
   materiales menores (canaletas, riel DIN, borneras, barras, aisladores, prensaestopas, señales ni cables) ni los accesorios
   mecánicos del gabinete (techo, caperuzas, visores, manijas y candados de bloqueo).
   Cada equipo se describe con su NOMBRE TÉCNICO y sus características eléctricas principales (sin la función del circuito
   ni referencias a otros equipos): «Interruptor termomagnético 2P 20 A, curva C», «Portafusible 6 A», «Transformador de
   control 500 VA, 460/120 Vac». Los equipos con las mismas características, marca y modelo se agrupan en una sola fila
   (aunque no estén seguidos en el tablero) con su cantidad y sus TAG («F4…F8»).
   Marca, modelo y código se proponen desde las marcas del proyecto; el usuario puede corregirlos en «Datos». El gabinete
   toma la marca elegida para el tablero (marcas reconocidas o fabricación nacional) y su modelo y código del catálogo
   (js/mecanico/gabinetes.js) según las dimensiones del arreglo. */
import { datos, tableros, calcularTablero } from "../datos.js";
import { arregloTablero } from "../mecanico/arreglo.js";
import { arregloControl } from "../mecanico/arreglo-control.js";
import { marcasProyecto } from "../engine/marcas.js";
import { gabineteComercial, marcaGabinete } from "../mecanico/gabinetes.js";

const EXCLUIR = /canaleta|riel din|perfil soporte|\bbornes?\b|fusible-borne|tapa final|topes|marcador|barras? (de cobre|de tierra)|aislador|prensaestopa|señal de riesgo|\bpeine\b|\bcables?\b|terminal(es)? de|etiqueta|tapón/i;
/* accesorios mecánicos del gabinete y elementos de seguridad que no son equipos eléctricos */
const TIPOS_FUERA = new Set(["techo","caperuza","visor","manijapuerta","candado","senal","peine","bornera"]);
const MARCAS = ["Schneider Electric","Allen-Bradley","Phoenix Contact","nVent Hoffman","Rockwell Automation","Weidmüller","Pfannenberg","Telemecanique","ABB","Siemens","Eaton","Danfoss","Rittal","Finder","Omron","Legrand","Wago","Moxa","Hirschmann","Bussmann","Teltonika","STEGO","Schneider","Hoffman"];
const NORM = { "Schneider":"Schneider Electric", "Hoffman":"nVent Hoffman" };

/* marca al inicio del modelo («Schneider ComPacT NSX…»), en su referencia («… (Rittal SZ 2500.210)») o en la fuente */
export function separarMarca(modelo, fuente){
  const m = String(modelo||"").trim();
  for(const b of MARCAS) if(m.toLowerCase().startsWith(b.toLowerCase() + " ")) return { marca: NORM[b] || b, modelo: m.slice(b.length).trim() };
  const ref = m.match(/\((?:ref\.\s*)?([A-Z][\w-]+)\s+[^)]*\)\s*$/);
  if(ref){ const b = MARCAS.find(x=>x.toLowerCase()===ref[1].toLowerCase()); if(b) return { marca: NORM[b] || b, modelo: m }; }
  const f = String(fuente||"");
  for(const b of MARCAS) if(new RegExp("^" + b.replace(/[-]/g, "\\-") + "\\b", "i").test(f)) return { marca: NORM[b] || b, modelo: m };
  return { marca:"", modelo: m };
}
/* códigos de pedido que ya vienen en el modelo (Siemens 6ES7…, Allen-Bradley 1769-…/5069-…, ABB 1SDA…/2CDS…/1SVR…, Bussmann 170M…,
   Rittal SZ ….…) */
const RE_COD = /\b(6E[SP]7\s?\d{3}-\w{4,5}-\w{4}|1[4-9]\d{2}-[A-Z0-9]{2,10}|5069-[A-Z0-9]{2,8}|1SDA\d{6}R\d|2CDS\d{6}R\d{4}|1SVR\d{6}R\d{4}|1SAM\d{6}R\d{4}|1SFA\d{6}R\d{4}|170M\d{4}[A-Z]?|SZ \d{4}\.\d{3})\b/;

/* marca por familia del equipo (cuando el modelo no la trae) */
export function marcaPorFamilia(b, desc, mr){
  const t = b.tipo, d = String(desc||"").toLowerCase();
  if(t==="variador" || /variador/.test(d)) return mr.variadores;
  if(t==="arrancador" || /arrancador suave/.test(d)) return mr.arrancadores;
  if(["contactor","guardamotor","sobrecarga"].includes(t) || /contactor|guardamotor|sobrecarga/.test(d)) return mr.maniobra;
  if(t==="spd" || /supresor|sobretensi/.test(d)) return mr.spd;
  if(/relé de monitoreo|monitoreo de tensión/.test(d)) return mr.reles;
  if(["interruptor","mcb","diferencial","fusible","xlp"].includes(t) || /interruptor|diferencial|portafusible|seccionador/.test(d)) return mr.interruptores;
  return "";
}

/* ---------- descripción técnica: nombre del equipo + características eléctricas principales ---------- */
const nAmp = s => { const m = String(s||"").match(/(?:^|\D)(\d+(?:[.,]\d+)?)\s*A\b/); return m ? m[1].replace(",", ".") : ""; };
const nPol = (b, v) => +b.polos || +((String(v||"").match(/^\s*([1-4])\s*x/)||[])[1]) || 0;
const sinPar = s => String(s||"").replace(/\s*\([^()]*\)/g, "").replace(/\s+—\s+.*$/, "").replace(/,\s*(alimentad[ao]|encendid[ao]|protegid[ao]|del circuito|desde)\b.*$/i, "").replace(/\s{2,}/g, " ").trim();
const COLOR = { rojo:"roja", verde:"verde", ambar:"ámbar", ámbar:"ámbar", amarillo:"amarilla", azul:"azul", blanco:"blanca", negro:"negra" };
const voltajeDe = s => (String(s||"").match(/\b(\d{2,3})\s*(Vac|Vdc)\b/i) || [])[0] || "";
const relacion = s => { const m = String(s||"").match(/(\d{2,4})\s*\/\s*(\d{2,4})\s*Vac/i); return m ? `${m[1]}/${m[2]} Vac` : ""; };
function vaDe(v){ const s = String(v||""); const k = s.match(/^\s*([\d.]+)\s*kVA/i); if(k) return Math.round(+k[1]*1000); const m = s.match(/([\d.]+)\s*VA/i); return m ? Math.round(+m[1]) : 0; }

/* rangos de ajuste térmico de los guardamotores (mín.–máx., A): el modelo trae el máximo («MS116-2.5») */
const RANGO_GM = [[0.1,0.16],[0.16,0.25],[0.25,0.4],[0.4,0.63],[0.63,1],[1,1.6],[1.6,2.5],[2.5,4],[4,6.3],[6.3,10],[8,12],[10,16],[16,20],[20,25],[25,32],[30,40],[37,50],[48,65],[62,73],[70,80]];
export function descripcionTecnica(b, ctx = {}){
  const v = String(b.val||""), mod = String(b.modelo||""), d = String(b.desc||"");
  const A = nAmp(v) || nAmp(mod), P = nPol(b, v);
  switch(b.tipo){
    case "fusible": return `Portafusible ${A || "—"} A`;
    case "mcb": { const cur = (mod.match(/[-\s]([BCDK])\s?\d/)||[])[1]; return `Interruptor termomagnético ${P || 2}P ${A} A${cur ? `, curva ${cur}` : ""}`; }
    case "interruptor": {
      const elec = /ekip|lsi|micrologic|electr[oó]nic|etu/i.test(mod), uvr = b.rol==="general" || /mínima tensión|UVR/i.test(d);
      return `Interruptor en caja moldeada 3P ${A} A, ${elec ? "relé electrónico" : "relé termomagnético"}${uvr ? ", con bobina de mínima tensión" : ""}`; }
    case "diferencial": { const ma = (v.match(/(\d+)\s*mA/i)||d.match(/(\d+)\s*mA/i)||[])[1] || "30"; return `Interruptor diferencial ${P || 2}P ${A} A, ${ma} mA`; }
    case "xlp": return `Seccionador portafusible 3P ${A} A${/\baR\b/.test(d + " " + mod) ? ", fusibles aR" : ""}`;
    case "spd": {
      const tipo = (d.match(/tipo\s*(1\s*\+\s*2|[123])/i)||[])[1];
      const kA = (v.match(/(\d+(?:[.,]\d+)?)\s*kA/i)||[])[1], uc = (v.match(/(\d{3})\s*V\b/)||[])[1];
      const polos = /3L|3P|\bSPD1, SPD2, SPD3\b/i.test(mod + " " + d) ? "3P" : (b.polos ? `${b.polos}P` : "");
      return `Supresor de sobretensiones${tipo ? " tipo " + tipo.replace(/\s/g, "") : ""}${polos ? " " + polos : ""}${kA ? `, ${/Iimp/i.test(v) ? "Iimp " : ""}${kA} kA` : ""}${uc ? `, ${uc} V` : ""}`; }
    case "rele": {
      if(/monitoreo/i.test(d)) return `Relé de monitoreo de tensión trifásico${/(\d+)\s*…\s*(\d+)\s*Vac/.test(v) ? `, ${v.replace(/\s*…\s*/, "-")}` : ""}`;
      if(/diferencial/i.test(d)) return `Relé diferencial regulable 0,03-3 A`;
      if(/interfaz/i.test(d)) { const bob = voltajeDe(v) || voltajeDe(d); return `Relé de interfaz enchufable, 1 contacto conmutado${bob ? `, bobina ${bob}` : ""}`; }
      return sinPar(d); }
    case "trafo": { const va = vaDe(v), rel = relacion(mod) || relacion(d); return `Transformador de control ${va >= 1000 ? (va/1000) + " kVA" : va + " VA"}${rel ? ", " + rel : ""}`; }
    case "fuente": {
      const io = d.match(/(\d{2,3})\s*Vac\s*\/\s*(\d{2})\s*Vdc/i), a2 = (v.match(/(\d+(?:[.,]\d+)?)\s*A\b/)||d.match(/(\d+(?:[.,]\d+)?)\s*A\b/)||[])[1];
      if(io) return `Fuente de alimentación ${io[1]} Vac / ${io[2]} Vdc${a2 ? `, ${a2} A` : ""}`;
      return `Fuente de alimentación ${voltajeDe(mod.replace(/.*\//, "")) || "24 Vdc"}${vaDe(v) ? `, ${vaDe(v)} VA` : ""}`; }
    case "resistencia": return `Resistencia calefactora ${v || ""}, con termostato`.replace(/\s+,/, ",");
    case "termostato": return "Termostato regulable 0-60 °C, 1 contacto";
    case "guardamotor": { const mx = +A, mn = RANGO_GM.find(r=>Math.abs(r[1] - mx) < 1e-6); return `Guardamotor 3P ${mn ? `${mn[0]}-${mx}` : A} A, con contacto auxiliar 1NA+1NC`; }
    case "contactor": return `Contactor 3P ${A} A AC-3${/HKF|\+\s*CA|aux/i.test(mod + " " + d) ? ", con contacto auxiliar 1NA+1NC" : ""}`;
    case "sobrecarga": return `Relé de sobrecarga ${v.replace(/\s*-\s*/, "-")}`.trim();
    case "variador": return `Variador de frecuencia ${A} A, ${ctx.tension || 460} Vac${b.pot ? ", " + b.pot : ""}`;
    case "arrancador": return `Arrancador suave ${A} A, ${ctx.tension || 460} Vac${b.pot ? ", " + b.pot : ""}`;
    case "reactancia": return `${b.carga || /carga|dv\/dt/i.test(d) ? "Filtro dv/dt" : "Reactancia de línea"} ${A} A`;
    case "repartidor": return `Repartidor de carga 3P ${A || nAmp(d)} A`;
    case "toroide": { const dm = (mod.match(/Ø\s*(\d+)\s*mm/)||[])[1]; return `Transformador toroidal${dm ? ` Ø${dm} mm` : ""}`; }
    case "tomacorriente": return `Tomacorriente doble 2P+T ${A || 15} A, riel DIN`;
    case "luminaria": return `Luminaria LED${v ? " " + v : ""}, 100-240 Vac`;
    case "finpuerta": return "Interruptor de puerta, 1NA";
    case "cpu": { const fam = (d.match(/—\s*(?:Allen-Bradley|Siemens|Schneider Electric|Schneider|Omron|ABB)?\s*([^()]+?)\s*(\(|$)/)||[])[1]; return `Controlador lógico programable${fam ? " " + fam.trim() : ""}${v ? ", " + v : ""}`; }
    case "modulo": case "fpd": case "tapa": return sinPar(d);
    case "switch": return sinPar(d) + (v ? `, ${v}` : "");
    case "router": return `Router industrial ${v || "4G / VPN"}`;
    case "manija": return "Mando rotativo de puerta del interruptor general";
    case "luz": { const c = COLOR[String(b.color||"").toLowerCase()] || b.color || ""; const vv = voltajeDe(b.leyenda); return `Luz piloto LED 22 mm${c ? ", " + c : ""}${vv ? ", " + vv : ""}`; }
    case "pulsador": { const c = String(b.color||""); return `Pulsador 22 mm${c ? ", " + c : ""}`; }
    case "selector": return "Selector 2 posiciones 22 mm";
    case "potenciometro": return "Potenciómetro 22 mm, 10 kΩ";
    case "seta": return "Pulsador de parada de emergencia tipo hongo 40 mm";
    case "panelvfd": return "Panel de operación del variador, montaje en puerta";
    case "hmi": return `Pantalla de operación HMI${/T7|7"|7 pulg/i.test(mod) ? " 7 pulg." : /T10|10"/i.test(mod) ? " 10 pulg." : ""}, montaje en puerta`;
    case "ventilador": { const q = (mod.match(/(\d+)\s*m³\/h/)||[])[1], mc = (mod.match(/(\d+(?:\.\d+)?)x\1/)||[])[1]; return `Ventilador con filtro${q ? ` ${q} m³/h` : ""}${mc ? `, ${Math.round(+mc)} x ${Math.round(+mc)} mm` : ""}`; }
    case "rejilla": { const mc = (mod.match(/(\d+(?:\.\d+)?)x\1/)||[])[1]; return `Filtro de salida de aire${mc ? ` ${Math.round(+mc)} x ${Math.round(+mc)} mm` : ""}`; }
    case "aa": { const w = (mod.match(/(\d+)\s*W\b/)||[])[1]; return `Aire acondicionado de puerta${w ? ` ${w} W` : ""}`; }
  }
  // sin tipo conocido: el nombre sin paréntesis ni referencias
  const t = sinPar(d);
  return t.charAt(0).toUpperCase() + t.slice(1);
}
/* el modelo del transformador es solo su relación («460/120 Vac+T»): sin modelo de catálogo */
const modeloLimpio = (b, m) => b.tipo==="trafo" && /^\s*\d+\s*\/\s*\d+\s*Vac/i.test(m) ? "" : m;

/* TAG de equipos agrupados en una línea: «F1…F3», «F9, F10», «CB4…CB7, CB9»; los repetidos (LT, LT, LT) una vez */
export function tagsAgrupados(tags){
  const lista = [...new Set(tags.flatMap(t=>String(t||"").split(/\s*,\s*/)).filter(Boolean))];
  const pref = new Map();
  for(const t of lista){ const m = /^(.*?)(\d+)$/.exec(t); const k = m ? m[1] : t; if(!pref.has(k)) pref.set(k, []); pref.get(k).push(m ? { n:+m[2], t } : { n:null, t }); }
  const out = [];
  for(const [k, xs] of pref){
    const sinN = xs.filter(x=>x.n==null), conN = xs.filter(x=>x.n!=null).sort((a, b)=>a.n - b.n);
    sinN.forEach(x=>out.push(x.t));
    for(let i=0; i<conN.length;){ let j = i; while(j+1 < conN.length && conN[j+1].n===conN[j].n + 1) j++;
      if(j - i >= 2) out.push(`${conN[i].t}…${conN[j].t}`); else for(let q=i; q<=j; q++) out.push(conN[q].t);
      i = j + 1; }
  }
  return out.join(", ");
}

/* clave de los valores del usuario: tablero | TAG | descripción (la del gabinete no depende de sus medidas) */
const clave = (t, f) => f._gab ? `${t.id}|gabinete|${f._gab}` : `${t.id}|${f.tag}|${f.descripcion}`;
const ipCorto = ip => { const s = String(ip||""), m = s.match(/IP\s?\d{2}[A-Z]?/i); return m ? m[0].replace(/\s/, "") + (/inoxidable/i.test(s) ? ", acero inoxidable" : "") : s.replace(/\s*\([^)]*\)/g, "").trim(); };

/* filas de un tablero: [{ tag, cant, descripcion, marca, modelo, codigo, notas, _marca, _modelo, _codigo, _gab? }] */
export function equiposDeTablero(p, t){
  let m = null;
  try { if(t.tipo==="control") m = arregloControl(p, t); else { const c = calcularTablero(p, t); if(c.circuits.length) m = arregloTablero(p, t, c); } } catch(e){ console.warn("equipos", t.tag, e); }
  if(!m) return [];
  const mr = marcasProyecto(p), over = datos(p).equiposOver || {};
  const ctx = { tension: parseFloat(m.tension) || 460 };
  const filas = [];
  // gabinete: un cuerpo por fila (los cuerpos del mismo ancho, juntos), con la marca elegida para el tablero
  const marcaG = marcaGabinete(p, t);
  const cuerpos = (m.secciones && m.secciones.length ? m.secciones.map(s=>s.W) : [m.W]);
  const anchos = [...new Set(cuerpos)];
  for(const W of anchos){
    const gc = gabineteComercial(marcaG, { montaje:m.montaje, W, H:m.H, D:m.D, ip:m.ip });
    filas.push({ tag: t.tag, cant: cuerpos.filter(x=>x===W).length, _gab: anchos.length > 1 ? String(W) : "1",
      descripcion: `Gabinete ${m.montaje==="mural" ? "mural" : "autosoportado"} ${W} x ${m.H} x ${m.D} mm, ${ipCorto(m.ip || "IP54")}`,
      _marca: marcaG, _modelo: gc.modelo, _codigo: gc.codigo, _nota: gc.nota });
  }
  const idx = new Map();
  for(const b of m.bom || []){
    const desc = String(b.desc||"").trim(), mod = String(b.modelo||"").trim();
    if(TIPOS_FUERA.has(b.tipo)) continue;
    if(!desc || EXCLUIR.test(desc) || EXCLUIR.test(mod)) continue;
    if(typeof b.cant==="string" && /\bm$/.test(b.cant)) continue;      // materiales por metro
    const s = separarMarca(mod, b.fuente);
    const cod = (mod.match(RE_COD) || [""])[0];
    const dsc = descripcionTecnica(b, ctx);
    const marca = s.marca || marcaPorFamilia(b, desc, mr) || "Por definir";
    const modelo = modeloLimpio(b, s.modelo) || "Por definir";
    const cant = typeof b.cant==="number" ? b.cant : 1;
    // equipos iguales (misma descripción técnica, marca y modelo): una sola fila con su cantidad y sus TAG
    const k = `${dsc}|${marca}|${modelo}`.toLowerCase();
    const ant = idx.get(k);
    if(ant){ ant._tags.push(b.tag || ""); ant._viejas.push(`${t.id}|${b.tag||""}|${desc}`); ant.cant += cant; continue; }
    const f = { _tags:[b.tag || ""], _viejas:[`${t.id}|${b.tag||""}|${desc}`], cant, descripcion: dsc, _marca: marca, _modelo: modelo, _codigo: cod };
    idx.set(k, f); filas.push(f);
  }
  for(const f of filas) if(f._tags) f.tag = tagsAgrupados(f._tags);
  // valores del usuario (marca / modelo / código editados) sobre los propuestos (con la clave anterior como respaldo)
  return filas.map(f=>{ const kk = clave(t, f); const o = over[kk] || (f._viejas || []).map(x=>over[x]).find(Boolean) || {};
    // gabinete: si el usuario cambió la marca, el modelo y el código propuestos son los de esa marca
    if(f._gab && o.marca && o.marca!==f._marca){ const gc = gabineteComercial(o.marca, { montaje:m.montaje, W:+f.descripcion.match(/(\d+) x/)[1], H:m.H, D:m.D, ip:m.ip }); f._marca = o.marca; f._modelo = gc.modelo; f._codigo = gc.codigo; f._nota = gc.nota; }
    return Object.assign(f, { marca: o.marca || f._marca, modelo: o.modelo || f._modelo, codigo: o.codigo || f._codigo || "—", notas: o.notas || "", _clave: kk }); });
}

/* listado completo: una sección por tablero, ítems numerados dentro de cada tablero */
export function listadoEquipos(p){
  const filas = [];
  for(const t of tableros(p)){
    const eq = equiposDeTablero(p, t); if(!eq.length) continue;
    filas.push({ __var:"seccion", __clase:"amarilla", texto: `${(t.nombre||"").toUpperCase()} ${t.tag}` });
    eq.forEach((f, i)=>filas.push(Object.assign({ item: i + 1 }, f)));
  }
  return filas;
}
export const claveEquipo = clave;

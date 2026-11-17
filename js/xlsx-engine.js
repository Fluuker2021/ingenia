/* Ingenia — motor de plantillas Excel (sirve igual para las plantillas por defecto y las del cliente).
   Marcadores:
     {{clave}}                     valor escalar (proyecto, cliente, código, revisión, fecha…)
     {{tabla:NOMBRE}}              fila ancla: se repite por cada registro de la tabla NOMBRE
     {{tabla:NOMBRE:VARIANTE}}     fila con otro estilo para la misma tabla (p.ej. filas de sección);
                                   el registro la usa si trae __var:"VARIANTE"
     {{col:clave}}                 valor del registro en esa columna; {{col:clave|unir}} combina
                                   verticalmente las celdas consecutivas con el mismo valor
   Al insertar filas se desplazan combinaciones, fórmulas (las del propio renglón se re-referencian a la
   fila nueva; los rangos que terminaban en la fila ancla —p.ej. SUM(O11:O11)— se amplían hasta la última
   fila insertada), alturas de fila y área de impresión. Las imágenes del formato se conservan y los logos
   (organización / cliente) se colocan en las posiciones indicadas por el manifiesto de la plantilla. */

import { encabezadoPieExcel, reemplazarCaratulaExcel, bloqueEncabezadoExcel, FILAS_ENCABEZADO, logoEnCaja, logosEncabezado } from "./formato-doc.js";

const TOKEN = /\{\{\s*([^}]+?)\s*\}\}/g;
const REF = /(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\d(A-Za-z_])/g;

function textoCelda(v){
  if(v==null) return "";
  if(typeof v==="string") return v;
  if(typeof v==="object" && v.richText) return v.richText.map(t=>t.text).join("");
  if(typeof v==="object" && typeof v.text==="string") return v.text; // hipervínculo
  return "";
}

/* reescribe referencias A1 locales de una fórmula (sin las de otras hojas ni las de textos entre comillas) */
function mapRefs(formula, fn){
  return formula.split(/("[^"]*")/).map(part=>{
    if(part.startsWith('"')) return part;
    // rangos primero (A1:B5) para poder tratarlos como unidad
    return part.replace(/((?:'[^']+'|[A-Za-z_À-ɏ][\w.À-ɏ]*)!)?(\$?[A-Z]{1,3}\$?\d+)(?::(\$?[A-Z]{1,3}\$?\d+))?(?![\d(A-Za-z_])/g, (m, hoja, a, b)=>{
      if(hoja) return m;
      const pa = a.match(/(\$?)([A-Z]{1,3})(\$?)(\d+)/), pb = b ? b.match(/(\$?)([A-Z]{1,3})(\$?)(\d+)/) : null;
      const r1 = +pa[4], r2 = pb ? +pb[4] : null;
      const [n1, n2] = fn(r1, r2, !!pa[3], pb ? !!pb[3] : false);
      return pa[1]+pa[2]+pa[3]+n1 + (pb ? ":"+pb[1]+pb[2]+pb[3]+n2 : "");
    });
  }).join("");
}

class Hoja {
  constructor(ws){
    this.ws = ws;
    this.merges = [];
    const m = (ws.model && ws.model.merges) || [];
    for(const rg of m){ const d = decodeRange(rg); if(d) this.merges.push(d); }
    for(const d of this.merges){ try{ ws.unMergeCells(d.r1, d.c1, d.r2, d.c2); }catch(e){} }
  }
  // desplaza todo lo que está en filas >= at en +k (k>0 inserta, k<0 elimina -k filas desde at)
  shift(at, k, anchorTop){
    const ws = this.ws;
    if(k>0) ws.spliceRows(at, 0, ...Array.from({length:k}, ()=>[]));
    else if(k<0) ws.spliceRows(at, -k);
    const delEnd = k<0 ? at - k - 1 : null;
    // combinaciones
    const out = [];
    for(const d of this.merges){
      if(k<0 && d.r1>=at && d.r2<=delEnd) continue;
      const nd = Object.assign({}, d);
      if(d.r1>=at) nd.r1 = k<0 && d.r1<=delEnd ? at : d.r1 + k;
      if(d.r2>=at) nd.r2 = k<0 && d.r2<=delEnd ? at-1 : d.r2 + k;
      if(nd.r2<nd.r1) continue;
      out.push(nd);
    }
    this.merges = out;
    // fórmulas
    ws.eachRow({ includeEmpty:false }, row=>row.eachCell({ includeEmpty:false }, cell=>{
      const v = cell.value;
      if(v && typeof v==="object" && typeof v.formula==="string"){
        const f = mapRefs(v.formula, (r1, r2)=>{
          const mv = r=>{ if(r==null) return r; if(r>=at) return k<0 && r<=delEnd ? at-1 : r+k; return r; };
          if(k>0 && anchorTop!=null && r2!=null && r2===anchorTop && r1<=anchorTop) return [r1, anchorTop+k];
          return [mv(r1), mv(r2)];
        });
        cell.value = { formula:f };
      }
    }));
    // área de impresión
    // filas que se repiten al imprimir (p. ej. «1:14»)
    const pt = ws.pageSetup && ws.pageSetup.printTitlesRow;
    if(pt && /^\$?\d+:\$?\d+$/.test(pt)){
      const [p1, p2] = pt.replace(/\$/g, "").split(":").map(Number);
      const mv = r=>r>=at ? (k<0 && r<=delEnd ? at-1 : r+k) : r;
      const n1 = mv(p1), n2 = mv(p2);
      ws.pageSetup.printTitlesRow = n2 >= n1 ? `${n1}:${n2}` : undefined;
    }
    const pa = ws.pageSetup && ws.pageSetup.printArea;
    if(pa){
      ws.pageSetup.printArea = pa.replace(/(\$?[A-Z]{1,3}\$?)(\d+)$/, (m, c, r)=>{ r=+r; return c + (r>=at ? Math.max(at-1, r+k) : r); });
    }
  }
  remerge(){
    for(const d of this.merges){ if(d.r1===d.r2 && d.c1===d.c2) continue; try{ this.ws.mergeCells(d.r1, d.c1, d.r2, d.c2); }catch(e){} }
  }
}

function decodeRange(rg){
  const m = String(rg).match(/^\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/); if(!m) return null;
  return { c1:colNum(m[1]), r1:+m[2], c2:colNum(m[3]), r2:+m[4] };
}
function colNum(s){ let n=0; for(const ch of s) n = n*26 + (ch.charCodeAt(0)-64); return n; }

function sustituir(v, scal, fila){
  const s = textoCelda(v);
  if(!s.includes("{{")) return v;
  const solo = /^\s*\{\{[^}]+\}\}\s*$/.test(s);
  let num = null;
  const out = s.replace(TOKEN, (m, key)=>{
    if(key.startsWith("tabla:")) return "";
    let val;
    if(key.startsWith("col:")){ const k = key.slice(4).split("|")[0].trim(); val = fila ? fila[k] : undefined; if(val===undefined) return ""; }
    else if(key in scal) val = scal[key];
    else return fila ? "" : m; // marcador desconocido fuera de tabla: se deja visible para que se detecte
    if(solo && typeof val==="number") num = val;
    return val==null ? "" : String(val);
  });
  return num!=null ? num : out;
}

function anclasDe(ws){
  const g = {};
  ws.eachRow({ includeEmpty:false }, (row, rn)=>row.eachCell({ includeEmpty:false }, cell=>{
    const s = textoCelda(cell.value);
    const m = s.match(/\{\{\s*tabla:([^}:]+?)(?::([^}]+?))?\s*\}\}/);
    if(m){ const n = m[1].trim(); (g[n] = g[n] || []).push({ rn, variante:(m[2]||"").trim() || "_" }); }
  }));
  return Object.entries(g).map(([nombre, filas])=>({ nombre, filas: filas.sort((a,b)=>a.rn-b.rn) }));
}

function capturarFila(H, rn){
  const ws = H.ws, row = ws.getRow(rn);
  const celdas = [];
  const maxC = Math.max(ws.columnCount||0, row.cellCount||0, 30);
  for(let c=1; c<=maxC; c++){
    const cell = row.getCell(c);
    celdas.push({ c, value: cell.value, style: JSON.parse(JSON.stringify(cell.style||{})) });
  }
  const merges = H.merges.filter(d=>d.r1===rn && d.r2===rn).map(d=>({ c1:d.c1, c2:d.c2 }));
  const unir = celdas.filter(t=>/\{\{\s*col:[^}|]+\|\s*unir\s*\}\}/.test(textoCelda(t.value))).map(t=>t.c);
  return { rn, height: row.height, celdas, merges, unir };
}

function rellenarTabla(H, grupo, filas, scal){
  const ws = H.ws;
  const top = grupo.filas[0].rn;
  const tpl = {};
  for(const f of grupo.filas) tpl[f.variante] = capturarFila(H, f.rn);
  // quitar combinaciones de las filas plantilla y borrar las filas de variantes (de abajo hacia arriba)
  H.merges = H.merges.filter(d=>!(grupo.filas.some(f=>f.rn===d.r1) && d.r1===d.r2));
  for(const f of grupo.filas.slice(1).reverse()) H.shift(f.rn, -1);
  const N = Math.max(filas.length, 1);
  if(N>1) H.shift(top+1, N-1, top);
  const defecto = tpl["_"] || Object.values(tpl)[0];
  for(let i=0;i<N;i++){
    const r = top+i, f = filas[i] || null;
    const t = (f && f.__var && tpl[f.__var]) || defecto;
    const row = ws.getRow(r);
    if(t.height) row.height = t.height;
    for(const tc of t.celdas){
      const cell = row.getCell(tc.c);
      cell.style = JSON.parse(JSON.stringify(tc.style));
      let v = tc.value;
      if(v && typeof v==="object" && typeof v.formula==="string"){
        const fr = mapRefs(v.formula, (r1, r2, abs1, abs2)=>[r1===t.rn && !abs1 ? r : r1, r2===t.rn && !abs2 ? r : r2]);
        cell.value = f ? { formula: fr } : null;
      } else {
        cell.value = sustituir(v, scal, f || {});
      }
    }
    for(const m of t.merges) H.merges.push({ r1:r, r2:r, c1:m.c1, c2:m.c2 });
  }
  // combinar verticalmente columnas marcadas |unir
  for(const c of defecto.unir){
    let i = 0;
    while(i<N){
      const val = textoCelda(ws.getRow(top+i).getCell(c).value) || String(ws.getRow(top+i).getCell(c).value??"");
      let j = i+1;
      while(j<N && (String(ws.getRow(top+j).getCell(c).value??"")===val) && val!=="") j++;
      if(j-i>1){
        for(let q=i+1;q<j;q++) ws.getRow(top+q).getCell(c).value = null;
        // si la columna estaba combinada horizontalmente en la fila, se amplía el bloque completo
        const hz = defecto.merges.find(m=>m.c1===c);
        const c2 = hz ? hz.c2 : c;
        H.merges = H.merges.filter(d=>!(d.c1===c && d.r1>=top+i && d.r2<top+j));
        H.merges.push({ r1:top+i, r2:top+j-1, c1:c, c2 });
      }
      i = j;
    }
  }
}

function pxCol(ws, c){ const w = ws.getColumn(c).width || (ws.properties && ws.properties.defaultColWidth) || 8.43; return Math.trunc(w*7+5); }
function pxRow(ws, r){ const h = ws.getRow(r).height || (ws.properties && ws.properties.defaultRowHeight) || 15; return h*96/72; }

function colocarLogo(wb, ws, dataURL, caja){ logoEnCaja(wb, ws, dataURL, caja); }

/* Formato Ingenia: reemplaza el bloque de encabezado propio de la plantilla (filas enc.filas, columnas enc.cols)
   por el bloque estándar (el del listado de cargas), agregando o quitando filas según haga falta. */
function encabezadoEstandar(H, enc){
  const ws = H.ws, [a, b] = enc.filas, [c1, c2] = enc.cols;
  H.merges = H.merges.filter(d=>!(d.r1>=a && d.r2<=b && d.c1<=c2));
  for(let r=a; r<=b; r++){ const row = ws.getRow(r); for(let c=1; c<=c2; c++){ const cell = row.getCell(c); cell.value = null; cell.style = {}; } }
  const nuevas = FILAS_ENCABEZADO + (enc.espacio ? 1 : 0), k = nuevas - (b-a+1);
  if(k > 0) H.shift(b+1, k); else if(k < 0) H.shift(a+nuevas, k);
  // numeraciones del tipo =ROW()-N (columna ÍTEM) siguen contando desde 1 aunque el bloque cambie de alto
  if(k) ws.eachRow({ includeEmpty:false }, (row, rn)=>{ if(rn <= a+nuevas-1) return; row.eachCell({ includeEmpty:false }, cell=>{
    const v = cell.value; if(v && typeof v==="object" && typeof v.formula==="string" && /ROW\(\)\s*-\s*\d+/i.test(v.formula)) cell.value = { formula: v.formula.replace(/ROW\(\)\s*-\s*(\d+)/gi, (m, n)=>"ROW()-"+(+n+k)) };
  }); });
  if(enc.espacio) ws.getRow(a+FILAS_ENCABEZADO).height = 15;
  const r = bloqueEncabezadoExcel(ws, a, c1, c2, enc.titulo);
  for(const [r1, cc1, r2, cc2] of r.merges) H.merges.push({ r1, c1:cc1, r2, c2:cc2 });
  return { logos: r.logos, fin: a+nuevas-1 };
}

/* ancho aproximado (px) de un texto en Arial: anchos por carácter de la fuente (milésimas de em) */
function anchoArial(t, sz, negrita){
  let u = 0;
  for(const ch of t){
    if(ch===" ") u += 278; else if("ijl|!.,;:'".includes(ch)) u += 240; else if("ftrI()[]-/".includes(ch)) u += 320;
    else if("mwMW".includes(ch)) u += 850; else if(/[0-9]/.test(ch)) u += 556; else if(/[A-ZÁÉÍÓÚÑ]/.test(ch)) u += 690; else u += 540;
  }
  return u/1000 * sz * (negrita ? 1.07 : 1) * 96/72;
}
/* líneas que ocupa un texto con ajuste de línea por palabras en un ancho dado (px) */
function lineasTexto(t, sz, negrita, ancho){
  if(!t) return 1;
  let lineas = 1, actual = 0; const esp = anchoArial(" ", sz, negrita);
  for(const p of t.split(/ +/)){
    let w = anchoArial(p, sz, negrita);
    if(actual && actual + esp + w > ancho){ lineas++; actual = 0; }
    while(w > ancho){ lineas++; w -= ancho; }          // palabra más larga que la celda: se corta
    actual += (actual ? esp : 0) + w;
  }
  return lineas;
}

/* Ajuste de texto y alto de fila según el largo de los textos (hojas de datos): ninguna celda se sale de su caja. */
function ajustarAltos(H, desde){
  const ws = H.ws;
  const merge = (r, c)=>H.merges.find(d=>r>=d.r1 && r<=d.r2 && c>=d.c1 && c<=d.c2);
  const ultima = ws.rowCount;
  for(let r=desde; r<=ultima; r++){
    const row = ws.getRow(r); let alto = 0;
    row.eachCell({ includeEmpty:false }, cell=>{
      const t = textoCelda(cell.value) || (typeof cell.value==="number" ? String(cell.value) : "");
      if(!t) return;
      const m = merge(r, cell.col);
      if(m && (m.c1!==cell.col || m.r1!==r)) return;           // solo la celda principal de una combinación
      if(m && m.r2 > m.r1) return;                               // combinaciones verticales: se dejan como están
      let px = 0; for(let c=(m ? m.c1 : cell.col); c<=(m ? m.c2 : cell.col); c++) px += pxCol(ws, c);
      const sz = (cell.font && cell.font.size) || 10, negrita = !!(cell.font && cell.font.bold);
      const lineas = t.split("\n").reduce((a, x)=>a + lineasTexto(x, sz, negrita, px - 7), 0);
      cell.alignment = Object.assign({}, cell.alignment||{}, { wrapText:true, vertical:(cell.alignment && cell.alignment.vertical) || "middle" });
      alto = Math.max(alto, lineas*sz*1.22 + 3);
    });
    if(alto && alto > (row.height || 15)) row.height = Math.ceil(alto*4)/4;
  }
}

function reemplazarEncabezados(ws, scal){
  const hf = ws.headerFooter; if(!hf) return;
  for(const k of ["oddHeader","oddFooter","evenHeader","evenFooter","firstHeader","firstFooter"]){
    if(typeof hf[k]==="string" && hf[k].includes("{{")) hf[k] = hf[k].replace(TOKEN, (m, key)=> key in scal ? String(scal[key]??"") : "");
  }
}

function clonarHoja(wb, origen, nombre){
  const ws = wb.addWorksheet(nombre);
  // copia profunda: la hoja clonada no comparte filas, configuración de página ni encabezados con la original
  const base = origen.model;
  const model = JSON.parse(JSON.stringify(Object.assign({}, base, { media: [] })));
  Object.assign(model, { name: nombre, id: ws.id });
  // ExcelJS entrega las combinaciones en «merges» pero las lee de «mergeCells»: sin esto la hoja clonada
  // (2.º tablero / instrumento en adelante) perdía todas las celdas combinadas y se veía desordenada
  model.mergeCells = (base.merges||[]).slice();
  if(base.pageSetup && base.pageSetup.printArea) model.pageSetup.printArea = base.pageSetup.printArea;
  ws.model = model;
  ws.name = nombre;
  return ws;
}

/* Rellena una plantilla .xlsx.
   datos = { scal:{}, tablas:{ NOMBRE:[filas] }, hojas:{ "NOMBRE_HOJA": { nombre, scal, tablas } },
             clonar:{ hoja:"HD", instancias:[{ nombre, scal, tablas }] }, logos:{ org:{dataURL,aspect}, cliente:{...} },
             manifiesto:{ "HOJA":{ org:{tl,br}, cliente:{tl,br} } } } */
/* encierra cada cuadro de la hoja: un cuadro empieza en una fila de títulos (celdas con relleno oscuro y borde) y sigue
   hacia abajo mientras alguna celda de su ancho tenga borde (filas de datos y bloque de totales). Se completa el contorno
   del rectángulo (p. ej. bajo los datos, a la izquierda del bloque de totales). Primero se ubican todos los cuadros y
   después se dibujan; cada celda recibe un estilo propio (ExcelJS comparte el objeto de estilo entre celdas). */
function encerrarTablas(ws, r0){
  const R = ws.rowCount, Cn = ws.columnCount;
  const oculta = c => !!ws.getColumn(c).hidden;
  const borde = (r, c) => { const b = ws.getCell(r, c).border || {}; return b.left || b.right || b.top || b.bottom || null; };
  const oscuro = (r, c) => { const f = ws.getCell(r, c).fill; const a = f && f.fgColor && f.fgColor.argb; if(!a || a.length < 8) return false;
    const n = parseInt(a.slice(2), 16), lum = 0.299*((n>>16)&255) + 0.587*((n>>8)&255) + 0.114*(n&255); return lum < 90; };
  const cuadros = [];
  let r = r0;
  while(r <= R){
    // fila de títulos: tramo continuo de celdas con borde que contiene celdas oscuras
    let c1 = 0, c2 = 0;
    for(let c=1; c<=Cn; c++){ if(oculta(c)) continue; if(borde(r, c) && oscuro(r, c)){ c1 = c; break; } }
    if(!c1){ r++; continue; }
    c2 = c1; while(c2 + 1 <= Cn && !oculta(c2 + 1) && borde(r, c2 + 1)) c2++;
    if(c2 - c1 < 2){ r++; continue; }
    let r2 = r;
    while(r2 + 1 <= R){ let alguna = false; for(let c=c1; c<=c2 && !alguna; c++) if(!oculta(c) && borde(r2 + 1, c)) alguna = true; if(!alguna) break; r2++; }
    cuadros.push({ r1:r, r2, c1, c2, estilo: borde(r, c1) });
    r = r2 + 1;
  }
  const poner = (y, x, lado, b) => { const cell = ws.getCell(y, x), bo = Object.assign({}, cell.border || {}); if(bo[lado] && bo[lado].style) return; bo[lado] = b; cell.style = Object.assign({}, cell.style, { border: bo }); };
  for(const q of cuadros){
    const b = { style: (q.estilo && q.estilo.style) || "thin", color: q.estilo && q.estilo.color };
    for(let y=q.r1; y<=q.r2; y++){ poner(y, q.c1, "left", b); poner(y, q.c2, "right", b); }
    for(let x=q.c1; x<=q.c2; x++) if(!oculta(x)){ poner(q.r1, x, "top", b); poner(q.r2, x, "bottom", b); }
  }
}

export async function rellenarExcel(ExcelJS, buffer, datos){
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const man = datos.manifiesto || {};
  // hojas clonadas (p.ej. una hoja de datos por instrumento)
  const trabajos = [];
  if(datos.clonar){
    const base = wb.getWorksheet(datos.clonar.hoja);
    if(base){
      const insts = datos.clonar.instancias || [];
      insts.forEach((inst, i)=>{
        const ws = i===0 ? base : clonarHoja(wb, base, inst.nombre);
        if(i===0) ws.name = inst.nombre;
        trabajos.push({ ws, scal: Object.assign({}, datos.scal, inst.scal||{}), tablas: Object.assign({}, datos.tablas, inst.tablas||{}), man: man[datos.clonar.hoja] });
      });
      if(!insts.length) trabajos.push({ ws: base, scal: datos.scal, tablas: datos.tablas, man: man[datos.clonar.hoja] });
    }
  }
  wb.eachSheet(ws=>{
    if(trabajos.some(t=>t.ws===ws)) return;
    const extra = (datos.hojas||{})[ws.name] || {};
    const nombreOriginal = ws.name;
    if(extra.nombre) ws.name = extra.nombre.slice(0,31);
    trabajos.push({ ws, scal: Object.assign({}, datos.scal, extra.scal||{}), tablas: Object.assign({}, datos.tablas, extra.tablas||{}), man: man[nombreOriginal] });
  });
  const estandar = !!datos.estandar;   // formatos Ingenia: carátula, encabezado y pie estándar (no en plantillas del cliente)
  for(const t of trabajos){
    const H = new Hoja(t.ws);
    // formato Ingenia: bloque de encabezado estándar (Cliente / Proyecto / Fecha / P&ID / Revisión) en cada hoja de listado
    const enc = estandar && t.man && t.man.encabezado ? encabezadoEstandar(H, t.man.encabezado) : null;
    const grupos = anclasDe(t.ws).sort((a,b)=>b.filas[0].rn - a.filas[0].rn);
    for(const g of grupos) rellenarTabla(H, g, t.tablas[g.nombre] || [], t.scal);
    if(enc && t.man.encabezado.ajustarAltos) ajustarAltos(H, enc.fin+1);
    H.remerge();
    // cuadros cerrados: cada tabla (con su bloque de totales) queda encerrada en un marco continuo
    if(t.man && t.man.encerrar) encerrarTablas(t.ws, enc ? enc.fin + 1 : 1);
    t.ws.eachRow({ includeEmpty:false }, row=>row.eachCell({ includeEmpty:false }, cell=>{
      const v = cell.value;
      if(textoCelda(v).includes("{{")) cell.value = sustituir(v, t.scal, null);
    }));
    reemplazarEncabezados(t.ws, t.scal);
    // ExcelJS fija «primera página = 1» al leer: cada hoja reiniciaba la numeración («Página 1 de N» en todas)
    if(t.ws.pageSetup && t.ws.pageSetup.firstPageNumber===1) t.ws.pageSetup.firstPageNumber = undefined;
    const esCaratula = /^CAR[ÁA]TULA$/i.test(t.ws.name.trim());
    if(estandar && esCaratula) continue;              // se reconstruye abajo con el formato estándar
    if(estandar) encabezadoPieExcel(t.ws, datos.scal||{}, { unaPagina: !!(t.man && t.man.encabezado && t.man.encabezado.unaPagina) });
    const man = enc ? Object.assign({}, t.man, enc.logos) : t.man;
    if(man && datos.logos){
      // con el bloque de encabezado estándar: los dos logos a la misma altura (empresa a la izquierda, cliente a la derecha)
      if(enc) logosEncabezado(wb, t.ws, datos.logos, { org:man.org, cliente:man.cliente });
      else {
        if(man.org && datos.logos.org) colocarLogo(wb, t.ws, datos.logos.org.dataURL, Object.assign({ aspect: datos.logos.org.aspect }, man.org));
        if(man.cliente && datos.logos.cliente) colocarLogo(wb, t.ws, datos.logos.cliente.dataURL, Object.assign({ aspect: datos.logos.cliente.aspect }, man.cliente));
      }
    }
  }
  if(estandar) reemplazarCaratulaExcel(wb, datos.scal||{}, datos.logos);
  calcularFormulas(wb);
  aplicarPaletaIngenia(wb);
  wb.calcProperties = Object.assign({}, wb.calcProperties, { fullCalcOnLoad: true });
  return await wb.xlsx.writeBuffer();
}

/* Colores de INGENIA en los formatos Excel: los rellenos oscuros (encabezados) pasan a grafito con texto
   blanco, los claros a amarillo suave o gris, el texto azul a grafito; los valores numéricos se centran
   (los textos, como la descripción, conservan su alineación). */
const PAL = { grafito:"FF17191D", grafito800:"FF1F2228", amarillo:"FFF5C518", amarillo100:"FFFDF1C4", gris:"FFECEFF2", blanco:"FFFFFFFF" };
const TEMA = { 0:"FFFFFF", 1:"000000", 2:"E7E6E6", 3:"44546A", 4:"4472C4", 5:"ED7D31", 6:"A5A5A5", 7:"FFC000", 8:"5B9BD5", 9:"70AD47" };
function rgbDe(c){
  if(!c) return null;
  let hex = c.argb ? c.argb.slice(-6) : (c.theme!=null ? TEMA[c.theme] : null);
  if(!hex) return null;
  let [r,g,b] = [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
  const t = c.tint||0;
  if(t) [r,g,b] = [r,g,b].map(v=> t<0 ? v*(1+t) : v+(255-v)*t);
  return { r, g, b, lum: (0.299*r+0.587*g+0.114*b)/255, sat: Math.max(r,g,b)-Math.min(r,g,b) };
}
/* etiquetas de encabezados (bloque Cliente / Proyecto / Fecha…) y de la tabla de revisiones de la carátula */
const ETIQUETAS = new Set(["cliente","proyecto","p&id","fecha","revisión","revision","rev.","rev","pág.","documento","referencia","n° documento","n° proyecto",
  "emitido para","elaboró","elaboró ing. disc.","revisó","revisó jef. proy.","aprobó","aprobó gerente","revisado por el cliente","ing. disc.","coord. proy.","superint. ing.","gerente proy.","comentarios"]);
const esEtiqueta = t => { const k = String(t||"").trim().toLowerCase().replace(/\s+/g," ").replace(/:$/,""); return ETIQUETAS.has(k) || /^revisado por /.test(k) || /^(cliente|proyecto|fecha|n° documento|rev\.?)\s*:/i.test(k); };
const textoDe = v => v==null ? "" : typeof v==="object" ? (v.richText ? v.richText.map(r=>r.text).join("") : (v.result!=null ? String(v.result) : "")) : String(v);
function aplicarPaletaIngenia(wb){
  wb.eachSheet(ws=>{
    if(ws._caratulaIngenia) return;   // la carátula estándar ya usa la paleta
    // pie y encabezado de página en grafito (&K = color de fuente en los encabezados de Excel)
    const hf = ws.headerFooter || {};
    for(const k of ["oddHeader","oddFooter","evenHeader","evenFooter","firstHeader","firstFooter"]) if(hf[k] && !/&K/.test(hf[k])) hf[k] = hf[k].replace(/&([LCR])/g, "&$1&K17191D");
    // título de la hoja (primeras filas, fuente grande) y etiquetas de encabezados
    ws.eachRow({ includeEmpty:false }, (row, rn)=>row.eachCell({ includeEmpty:false }, cell=>{
      const t = textoDe(cell.value).trim(); if(!t) return;
      const fs = (cell.font && cell.font.size) || 11;
      if(rn<=3 && fs>=12 && ws.name.toUpperCase()!=="CARÁTULA" && ws.name.toUpperCase()!=="CARATULA"){
        cell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:PAL.grafito }, bgColor:{ indexed:64 } };
        cell.font = Object.assign({}, cell.font||{}, { bold:true, color:{ argb:PAL.blanco } });
        cell.border = Object.assign({}, cell.border||{}, { bottom:{ style:"medium", color:{ argb:PAL.amarillo } } });
        cell._ingenia = true;
      } else if(esEtiqueta(t)){
        cell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:PAL.grafito800 }, bgColor:{ indexed:64 } };
        cell.font = Object.assign({}, cell.font||{}, { bold:true, color:{ argb:PAL.blanco } });
        cell._ingenia = true;
      }
    }));
  });
  wb.eachSheet(ws=>!ws._caratulaIngenia && ws.eachRow({ includeEmpty:false }, row=>row.eachCell({ includeEmpty:true }, cell=>{
    if(cell._ingenia){ delete cell._ingenia; return; }
    const f = cell.fill;
    if(f && f.type==="pattern" && f.pattern==="solid"){
      const c = rgbDe(f.fgColor);
      if(c && !(c.lum>0.97)){
        let nuevo;
        if(c.lum < 0.55) nuevo = PAL.grafito;                    // encabezados oscuros
        else if(c.sat > 40) nuevo = PAL.amarillo100;            // claros con color (celeste, amarillo)
        else nuevo = PAL.gris;                                   // grises
        cell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:nuevo }, bgColor:{ indexed:64 } };
        if(nuevo===PAL.grafito) cell.font = Object.assign({}, cell.font||{}, { color:{ argb:PAL.blanco } });
      }
    }
    const fc = cell.font && cell.font.color && rgbDe(cell.font.color);
    if(fc && fc.b > fc.r+40 && fc.lum < 0.75 && !(f && f.type==="pattern" && cell.fill.fgColor && cell.fill.fgColor.argb===PAL.grafito)) cell.font = Object.assign({}, cell.font, { color:{ argb:PAL.grafito } });
    const v = cell.value;
    const esNum = typeof v==="number" || (v && typeof v==="object" && typeof v.result==="number");
    if(esNum) cell.alignment = Object.assign({}, cell.alignment||{}, { horizontal:"center" });
  })));
}

/* Guarda el resultado de cada fórmula dentro del archivo. Sin él, los visores que no recalculan (Excel en
   vista protegida, vistas previas del celular, Drive, correo) muestran vacías las columnas calculadas.
   Evaluador mínimo para las fórmulas de los formatos: referencias (con hoja y $), rangos, + - * / ^ &,
   comparaciones y SUM, SQRT, IF, ROW, ROUND, ROUNDUP, ROUNDDOWN, MAX, MIN, ABS, AVERAGE, AND, OR, IFERROR, PI. */
function calcularFormulas(wb){
  const hojas = new Map(); wb.eachSheet(ws=>hojas.set(ws.name.toUpperCase(), ws));
  const memo = new Map(), enCurso = new Set();
  const F = {
    SUM: (...a)=>a.flat(Infinity).reduce((s,x)=>s+(typeof x==="number"?x:0),0),
    AVERAGE: (...a)=>{ const n = a.flat(Infinity).filter(x=>typeof x==="number"); return n.length ? n.reduce((s,x)=>s+x,0)/n.length : 0; },
    MAX: (...a)=>Math.max(...a.flat(Infinity).filter(x=>typeof x==="number")), MIN: (...a)=>Math.min(...a.flat(Infinity).filter(x=>typeof x==="number")),
    SQRT: x=>Math.sqrt(num(x)), ABS: x=>Math.abs(num(x)), PI: ()=>Math.PI,
    ROUND: (x,d=0)=>{ const k = 10**num(d); return Math.round(num(x)*k)/k; }, ROUNDUP: (x,d=0)=>{ const k = 10**num(d); return Math.ceil(num(x)*k)/k; }, ROUNDDOWN: (x,d=0)=>{ const k = 10**num(d); return Math.floor(num(x)*k)/k; },
    IF: (c,a=true,b=false)=>c?a:b, AND: (...a)=>a.flat(Infinity).every(Boolean), OR: (...a)=>a.flat(Infinity).some(Boolean), IFERROR: (a,b)=>(typeof a==="number" && !isFinite(a)) ? b : a,
  };
  const num = x => typeof x==="number" ? x : (x===""||x==null||x===false) ? 0 : x===true ? 1 : (isNaN(+x) ? 0 : +x);
  const crudo = v => { if(v==null) return ""; if(typeof v==="object"){ if(v.richText) return v.richText.map(r=>r.text).join(""); if("result" in v || "formula" in v || "sharedFormula" in v) return undefined; if(v.text!=null) return v.text; if(v instanceof Date) return v; } return v; };
  const valor = (ws, ref)=>{
    const k = ws.name+"!"+ref;
    if(memo.has(k)) return memo.get(k);
    const cell = ws.getCell(ref);
    let v = crudo(cell.value);
    if(v===undefined){
      if(enCurso.has(k)) return 0;            // referencia circular: se corta
      enCurso.add(k);
      const f = cell.formula; v = 0;
      try{ const r = evaluar(ws, f, cell.row); if(r!==undefined) v = r; }catch(e){ v = 0; }
      enCurso.delete(k);
    }
    memo.set(k, v); return v;
  };
  const rango = (ws, a, b)=>{
    const [, c1, r1] = a.match(/([A-Z]+)(\d+)/), [, c2, r2] = b.match(/([A-Z]+)(\d+)/);
    const out = [];
    for(let r=Math.min(+r1,+r2); r<=Math.max(+r1,+r2); r++) for(let c=Math.min(colNum(c1),colNum(c2)); c<=Math.max(colNum(c1),colNum(c2)); c++) out.push(valor(ws, ws.getCell(r,c).address));
    return out;
  };
  const hojaDe = (ws, nombre)=> nombre ? (hojas.get(nombre.replace(/^'|'$/g,"").replace(/''/g,"'").toUpperCase()) || ws) : ws;
  function evaluar(ws, formula, fila){
    if(typeof formula!=="string" || !formula) return undefined;
    const re = /\s*(?:("(?:[^"]|"")*")|((?:'(?:[^']|'')+'|[A-Za-z_][\w.]*)!)?(\$?[A-Z]{1,3}\$?\d+)(?::(\$?[A-Z]{1,3}\$?\d+))?|(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?%?)|([A-Za-z][A-Za-z0-9.]*)\s*\(|(<>|<=|>=|[-+*\/^&=<>(),%]))/y;
    let js = "", m, i = 0;
    const args = [];
    while(i < formula.length){
      re.lastIndex = i; m = re.exec(formula);
      if(!m){ if(/^\s*$/.test(formula.slice(i))) break; return undefined; }
      i = re.lastIndex;
      if(m[1]!=null) js += JSON.stringify(m[1].slice(1,-1).replace(/""/g,'"'));
      else if(m[3]){ const h = hojaDe(ws, m[2] && m[2].slice(0,-1)); const a = m[3].replace(/\$/g,""); if(m[4]){ const b2 = m[4].replace(/\$/g,""); args.push(()=>rango(h, a, b2)); } else { const hh = h, aa = a; args.push(()=>valor(hh, aa)); } js += `A[${args.length-1}]()`; }
      else if(m[5]) js += m[5].endsWith("%") ? `(${parseFloat(m[5])}/100)` : m[5];
      else if(m[6]){ const fn = m[6].toUpperCase(); if(fn==="ROW") js += `(()=>${fila})(`; else if(F[fn]) js += `F.${fn}(`; else return undefined; }
      else if(m[7]){ const o = m[7]; js += o==="^" ? "**" : o==="=" ? "==" : o==="<>" ? "!=" : o==="&" ? '+""+' : o; }
    }
    // los operandos de celdas vacías valen 0 en aritmética (como en Excel)
    const N = x => (typeof x==="string" && x!=="" && !isNaN(+x)) ? +x : x;
    const A = args.map(fn=>()=>{ const v = fn(); return Array.isArray(v) ? v : (v==="" ? 0 : N(v)); });
    const r = Function("A","F", `"use strict"; return (${js});`)(A, F);
    return (typeof r==="number" && !isFinite(r)) ? undefined : r;
  }
  wb.eachSheet(ws=>ws.eachRow({ includeEmpty:false }, row=>row.eachCell({ includeEmpty:false }, cell=>{
    const f = cell.formula; if(!f || cell.value==null || typeof cell.value!=="object") return;
    let r; try{ r = evaluar(ws, f, cell.row); }catch(e){ r = undefined; }
    if(r===undefined || r===null) return;
    if(typeof r==="number") r = Math.round(r*1e10)/1e10;
    if(cell.value.sharedFormula) cell.value = { formula: f, result: r }; else cell.value = Object.assign({}, cell.value, { result: r });
  })));
}

export async function marcadoresExcel(ExcelJS, buffer){
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer);
  const tokens = new Set(), hojas = [], tablas = new Set();
  wb.eachSheet(ws=>{ hojas.push(ws.name); ws.eachRow(row=>row.eachCell(cell=>{ const s = textoCelda(cell.value); (s.match(/\{\{[^}]+\}\}/g)||[]).forEach(t=>{ tokens.add(t); const m = t.match(/tabla:([^}:]+)/); if(m) tablas.add(m[1].trim()); }); })); });
  return { tokens:[...tokens], hojas, tablas:[...tablas] };
}

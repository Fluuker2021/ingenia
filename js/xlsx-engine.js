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

function pxCol(ws, c){ const w = ws.getColumn(c).width || 9; return Math.round(w*7+5); }
function pxRow(ws, r){ const h = ws.getRow(r).height || 15; return Math.round(h*96/72); }

function colocarLogo(wb, ws, dataURL, caja){
  if(!dataURL || !caja) return;
  try{
    const ext = /^data:image\/png/.test(dataURL) ? "png" : "jpeg";
    const id = wb.addImage({ base64: dataURL.split(",")[1], extension: ext });
    const [c0, r0] = caja.tl, [c1, r1] = caja.br;
    let W = 0, Hh = 0;
    for(let c=c0+1; c<=c1; c++) W += pxCol(ws, c);
    for(let r=r0+1; r<=r1; r++) Hh += pxRow(ws, r);
    const ar = caja.aspect || 3;
    let w = W*0.92, h = w/ar;
    if(h > Hh*0.86){ h = Hh*0.86; w = h*ar; }
    const offC = (W-w)/2, offR = (Hh-h)/2;
    // posición fraccional de columna/fila para centrar
    let col = c0, acc = 0; while(col<c1 && acc + pxCol(ws, col+1) <= offC){ acc += pxCol(ws, col+1); col++; }
    const fc = col + (offC-acc)/pxCol(ws, col+1);
    let row = r0, accr = 0; while(row<r1 && accr + pxRow(ws, row+1) <= offR){ accr += pxRow(ws, row+1); row++; }
    const fr = row + (offR-accr)/pxRow(ws, row+1);
    ws.addImage(id, { tl:{ col:fc, row:fr }, ext:{ width:w, height:h }, editAs:"oneCell" });
  }catch(e){ console.warn("logo", e); }
}

function reemplazarEncabezados(ws, scal){
  const hf = ws.headerFooter; if(!hf) return;
  for(const k of ["oddHeader","oddFooter","evenHeader","evenFooter","firstHeader","firstFooter"]){
    if(typeof hf[k]==="string" && hf[k].includes("{{")) hf[k] = hf[k].replace(TOKEN, (m, key)=> key in scal ? String(scal[key]??"") : "");
  }
}

function clonarHoja(wb, origen, nombre){
  const ws = wb.addWorksheet(nombre);
  const model = Object.assign({}, origen.model, { name: nombre, id: ws.id, media: [] });
  model.merges = (origen.model.merges||[]).slice();
  ws.model = model;
  ws.name = nombre;
  return ws;
}

/* Rellena una plantilla .xlsx.
   datos = { scal:{}, tablas:{ NOMBRE:[filas] }, hojas:{ "NOMBRE_HOJA": { nombre, scal, tablas } },
             clonar:{ hoja:"HD", instancias:[{ nombre, scal, tablas }] }, logos:{ org:{dataURL,aspect}, cliente:{...} },
             manifiesto:{ "HOJA":{ org:{tl,br}, cliente:{tl,br} } } } */
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
  for(const t of trabajos){
    const H = new Hoja(t.ws);
    const grupos = anclasDe(t.ws).sort((a,b)=>b.filas[0].rn - a.filas[0].rn);
    for(const g of grupos) rellenarTabla(H, g, t.tablas[g.nombre] || [], t.scal);
    H.remerge();
    t.ws.eachRow({ includeEmpty:false }, row=>row.eachCell({ includeEmpty:false }, cell=>{
      const v = cell.value;
      if(textoCelda(v).includes("{{")) cell.value = sustituir(v, t.scal, null);
    }));
    reemplazarEncabezados(t.ws, t.scal);
    if(t.man && datos.logos){
      if(t.man.org && datos.logos.org) colocarLogo(wb, t.ws, datos.logos.org.dataURL, Object.assign({ aspect: datos.logos.org.aspect }, t.man.org));
      if(t.man.cliente && datos.logos.cliente) colocarLogo(wb, t.ws, datos.logos.cliente.dataURL, Object.assign({ aspect: datos.logos.cliente.aspect }, t.man.cliente));
    }
  }
  wb.calcProperties = Object.assign({}, wb.calcProperties, { fullCalcOnLoad: true });
  return await wb.xlsx.writeBuffer();
}

export async function marcadoresExcel(ExcelJS, buffer){
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer);
  const tokens = new Set(), hojas = [], tablas = new Set();
  wb.eachSheet(ws=>{ hojas.push(ws.name); ws.eachRow(row=>row.eachCell(cell=>{ const s = textoCelda(cell.value); (s.match(/\{\{[^}]+\}\}/g)||[]).forEach(t=>{ tokens.add(t); const m = t.match(/tabla:([^}:]+)/); if(m) tablas.add(m[1].trim()); }); })); });
  return { tokens:[...tokens], hojas, tablas:[...tablas] };
}

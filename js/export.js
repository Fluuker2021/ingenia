/* Ingenia — generación de documentos
   - Excel (ExcelJS): plantilla ESTÁNDAR (carátula + hojas de datos con cabecera Cliente/Proyecto/Fecha/Rev.,
     mismo esquema que los listados estándar) o PLANTILLA DEL CLIENTE (.xlsx con
     tokens {{...}} y filas ancla {{tabla:NOMBRE}} que se repiten por cada registro).
   - Word (docxtemplater): plantilla estándar incluida en /assets/plantillas o .docx del cliente con tags {…}.
   Contexto de datos común (ctx): { org:{nombre,logoDataURL}, proyecto:{nombre,cliente,codigo,unidad,etapa},
     doc:{codigo,titulo,rev,fecha,disciplina,emitidoPara}, revisiones:[{rev,fecha,descripcion,elaboro,reviso,aprobo}],
     tablas:{ NOMBRE:{columnas:[{key,titulo,ancho,num}], filas:[{...}]} }, campos:{...} } */

const AZUL = "FF1D4F91", AZUL_CLARO = "FFE3EDF9", GRIS = "FFEEF1F5", BORDE = "FFB8C2D0";
const thin = { style:"thin", color:{argb:BORDE} };
const bordes = { top:thin, left:thin, bottom:thin, right:thin };
const font = (o={}) => Object.assign({ name:"Arial", size:9 }, o);

export function nombreArchivo(doc, ext){ return ((doc.codigo||"documento")+"_Rev"+(doc.rev||"A")).replace(/[^\w\-.]+/g,"_")+"."+ext; }

/* ---------------- EXCEL ESTÁNDAR ---------------- */
export async function excelEstandar(ctx){
  const wb = new ExcelJS.Workbook();
  wb.creator = ctx.org.nombre || "Ingenia"; wb.created = new Date();
  await caratula(wb, ctx);
  for(const [nombre, tabla] of Object.entries(ctx.tablas||{})){
    if(tabla.alias) continue; // alias para plantillas del cliente ({{tabla:nombre}}), no genera hoja propia
    hojaTabla(wb, ctx, nombre, tabla);
  }
  return await wb.xlsx.writeBuffer();
}

async function caratula(wb, ctx){
  const ws = wb.addWorksheet("CARÁTULA", { pageSetup:{ paperSize:9, orientation:"portrait", fitToPage:true }, views:[{showGridLines:false}] });
  ws.columns = Array.from({length:12}, ()=>({ width:9 }));
  const put = (ref, val, o={})=>{ const c = ws.getCell(ref); c.value = val; c.font = font(o.font||{}); c.alignment = Object.assign({ horizontal:"center", vertical:"middle", wrapText:true }, o.al||{}); if(o.fill) c.fill = { type:"pattern", pattern:"solid", fgColor:{argb:o.fill} }; return c; };
  const box = (range)=>{ ws.mergeCells(range); const [a,b] = range.split(":"); borderRange(ws, a, b); };

  // logo de la organización (si hay)
  if(ctx.org.logoDataURL){
    try{
      const ext = ctx.org.logoDataURL.startsWith("data:image/png") ? "png" : "jpeg";
      const id = wb.addImage({ base64: ctx.org.logoDataURL.split(",")[1], extension: ext });
      ws.addImage(id, { tl:{col:0.3,row:1.2}, ext:{ width:150, height:60 } });
    }catch(e){}
  }
  put("E2", (ctx.org.nombre||"").toUpperCase(), { font:{ bold:true, size:11, color:{argb:AZUL} } }); ws.mergeCells("E2:L3");
  put("E4", ctx.org.direccion||"", { font:{ size:8, color:{argb:"FF66748A"} } }); ws.mergeCells("E4:L4");

  ws.getRow(8).height = 24;
  put("B8", "CLIENTE: "+(ctx.proyecto.cliente||"—").toUpperCase(), { font:{ bold:true, size:10 } }); box("B8:L8");
  put("B10", (ctx.proyecto.nombre||"").toUpperCase(), { font:{ bold:true, size:14, color:{argb:AZUL} } }); ws.mergeCells("B10:L12");
  put("B13", (ctx.proyecto.unidad ? "UNIDAD: "+ctx.proyecto.unidad.toUpperCase()+"   ·   " : "")+"ETAPA: "+(ctx.proyecto.etapaNombre||"").toUpperCase(), { font:{ size:9 } }); ws.mergeCells("B13:L13");
  put("B15", (ctx.doc.disciplina||"").toUpperCase(), { font:{ bold:true, size:10 } }); ws.mergeCells("B15:L15");
  put("B17", (ctx.doc.titulo||"").toUpperCase(), { font:{ bold:true, size:16 } }); ws.mergeCells("B17:L20");
  for(let r=17;r<=20;r++) for(let c=2;c<=12;c++) ws.getCell(r,c).fill = { type:"pattern", pattern:"solid", fgColor:{argb:AZUL_CLARO} };
  borderRange(ws, "B17", "L20");
  put("B22", "N° DE DOCUMENTO", { font:{ bold:true, size:9 }, fill:GRIS }); ws.mergeCells("B22:D22");
  put("E22", ctx.doc.codigo||"", { font:{ bold:true, size:12 } }); ws.mergeCells("E22:J22");
  put("K22", "Rev. "+(ctx.doc.rev||"A"), { font:{ bold:true, size:12 } }); ws.mergeCells("K22:L22");
  borderRange(ws, "B22", "L22");

  // tabla de revisiones
  const r0 = 26;
  const heads = ["Rev.","Fecha","Emitido para","Elaboró","Revisó","Aprobó"]; const spans = [["B","B"],["C","D"],["E","H"],["I","J"],["K","K"],["L","L"]];
  heads.forEach((h,i)=>{ put(spans[i][0]+r0, h, { font:{ bold:true, size:9, color:{argb:"FFFFFFFF"} }, fill:AZUL }); if(spans[i][0]!==spans[i][1]) ws.mergeCells(`${spans[i][0]}${r0}:${spans[i][1]}${r0}`); });
  const revs = (ctx.revisiones && ctx.revisiones.length) ? ctx.revisiones : [{ rev:ctx.doc.rev||"A", fecha:ctx.doc.fecha, descripcion:ctx.doc.emitidoPara||"Emitido para revisión", elaboro:ctx.org.elaboraPor||"", reviso:ctx.org.revisaPor||"", aprobo:ctx.org.apruebaPor||"" }];
  revs.forEach((rv,i)=>{
    const r = r0+1+i; const vals = [rv.rev, rv.fecha, rv.descripcion, rv.elaboro||ctx.org.elaboraPor||"", rv.reviso||ctx.org.revisaPor||"", rv.aprobo||ctx.org.apruebaPor||""];
    vals.forEach((v,j)=>{ put(spans[j][0]+r, v, { font:{ size:9 } }); if(spans[j][0]!==spans[j][1]) ws.mergeCells(`${spans[j][0]}${r}:${spans[j][1]}${r}`); });
  });
  borderRange(ws, "B"+r0, "L"+(r0+revs.length));
  put("B"+(r0+revs.length+2), "Generado con Ingenia — la generación automática no reemplaza la revisión y aprobación de un ingeniero competente.", { font:{ size:7, italic:true, color:{argb:"FF66748A"} }, al:{ horizontal:"left" } }); ws.mergeCells(`B${r0+revs.length+2}:L${r0+revs.length+2}`);
}

function borderRange(ws, a, b){
  const A = ws.getCell(a), B = ws.getCell(b);
  for(let r=A.row; r<=B.row; r++) for(let c=A.col; c<=B.col; c++){
    const cell = ws.getCell(r,c);
    cell.border = { top: r===A.row?thin:cell.border?.top, bottom: r===B.row?thin:cell.border?.bottom, left: c===A.col?thin:cell.border?.left, right: c===B.col?thin:cell.border?.right };
  }
}

function hojaTabla(wb, ctx, nombre, tabla){
  const ws = wb.addWorksheet(nombre.slice(0,31), { pageSetup:{ paperSize:9, orientation:"landscape", fitToPage:true, fitToWidth:1, fitToHeight:0 }, views:[{ showGridLines:false, state:"frozen", ySplit:6 }] });
  const cols = tabla.columnas;
  ws.columns = cols.map(c=>({ width: c.ancho || 16 }));
  const last = cols.length;
  const L = n => ws.getColumn(n).letter;
  const put = (r,c,val,o={})=>{ const cell = ws.getCell(r,c); cell.value = val; cell.font = font(o.font||{}); cell.alignment = Object.assign({ vertical:"middle", wrapText:true }, o.al||{}); if(o.fill) cell.fill = { type:"pattern", pattern:"solid", fgColor:{argb:o.fill} }; cell.border = bordes; return cell; };
  // cabecera de hoja (Cliente / Proyecto / Fecha / Rev.) — mismo esquema que los listados de referencia
  put(1,1,(tabla.titulo||nombre).toUpperCase(), { font:{ bold:true, size:12, color:{argb:"FFFFFFFF"} }, fill:AZUL, al:{ horizontal:"center" } }); ws.mergeCells(1,1,1,last); ws.getRow(1).height = 22;
  const half = Math.max(2, Math.floor(last/2));
  put(2,1,"Cliente",{font:{bold:true},fill:GRIS}); put(2,2,ctx.proyecto.cliente||"",{}); ws.mergeCells(2,2,2,half);
  put(2,half+1,"Fecha",{font:{bold:true},fill:GRIS}); put(2,half+2,ctx.doc.fecha||"",{}); if(half+2<last) ws.mergeCells(2,half+2,2,last);
  put(3,1,"Proyecto",{font:{bold:true},fill:GRIS}); put(3,2,ctx.proyecto.nombre||"",{}); ws.mergeCells(3,2,3,half);
  put(3,half+1,"Revisión",{font:{bold:true},fill:GRIS}); put(3,half+2,ctx.doc.rev||"A",{}); if(half+2<last) ws.mergeCells(3,half+2,3,last);
  put(4,1,"Documento",{font:{bold:true},fill:GRIS}); put(4,2,ctx.doc.codigo||"",{}); ws.mergeCells(4,2,4,half);
  put(4,half+1,"Referencia",{font:{bold:true},fill:GRIS}); put(4,half+2,tabla.referencia||ctx.doc.referencia||"—",{}); if(half+2<last) ws.mergeCells(4,half+2,4,last);
  // encabezados
  const hr = 6;
  cols.forEach((c,i)=>{ put(hr, i+1, c.titulo, { font:{ bold:true, size:8.5, color:{argb:"FFFFFFFF"} }, fill:AZUL, al:{ horizontal:"center" } }); });
  ws.getRow(hr).height = 30;
  // filas
  tabla.filas.forEach((f,ri)=>{
    const r = hr+1+ri;
    cols.forEach((c,i)=>{
      let v = f[c.key]; if(v===undefined || v===null) v = "";
      const cell = put(r, i+1, v, { font:{ size:8.5 }, al:{ horizontal: (c.num||typeof v==="number") ? "right" : (c.center?"center":"left") } });
      if(c.formato && typeof v==="number") cell.numFmt = c.formato;
      if(f.__seccion){ cell.font = font({ bold:true }); cell.fill = { type:"pattern", pattern:"solid", fgColor:{argb:AZUL_CLARO} }; }
    });
    if(f.__seccion) ws.mergeCells(r,1,r,last);
  });
  // totales
  (tabla.totales||[]).forEach((t,ti)=>{
    const r = hr+1+tabla.filas.length+ti;
    cols.forEach((c,i)=>{ const v = t[c.key]; put(r, i+1, v===undefined?"":v, { font:{ bold:true, size:8.5 }, fill:GRIS, al:{ horizontal:(c.num||typeof v==="number")?"right":"left" } }); });
  });
  (tabla.notas||[]).forEach((n,ni)=>{ const r = hr+2+tabla.filas.length+(tabla.totales||[]).length+ni; const cell = ws.getCell(r,1); cell.value = n; cell.font = font({ size:8, italic:true }); ws.mergeCells(r,1,r,last); });
  ws.headerFooter.oddFooter = "&L"+(ctx.org.nombre||"")+"&C"+(ctx.doc.codigo||"")+" Rev. "+(ctx.doc.rev||"")+"&RPág. &P de &N";
}

/* ---------------- EXCEL CON PLANTILLA DEL CLIENTE ----------------
   Tokens en celdas: {{proyecto}} {{cliente}} {{codigo}} {{titulo}} {{rev}} {{fecha}} {{org}} {{unidad}} {{etapa}} {{disciplina}}
   y cualquier {{campo.X}} de ctx.campos. Fila ancla: una celda con {{tabla:NOMBRE}} y en la misma fila
   {{col:clave}} por columna → esa fila se repite por cada registro de ctx.tablas.NOMBRE.filas (copiando estilos). */
export async function excelConPlantilla(ctx, arrayBuffer){
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);
  const scal = valoresEscalares(ctx);
  wb.eachSheet(ws=>{
    // 1) filas ancla
    const anchors = [];
    ws.eachRow((row, rn)=>{ row.eachCell(cell=>{ const s = String(cell.value && cell.value.richText ? cell.value.richText.map(t=>t.text).join("") : cell.value ?? ""); const m = s.match(/\{\{tabla:([^}]+)\}\}/); if(m) anchors.push({ rn, nombre:m[1].trim() }); }); });
    anchors.sort((a,b)=>b.rn-a.rn).forEach(({rn,nombre})=>{
      const tabla = (ctx.tablas||{})[nombre]; const filas = tabla ? tabla.filas : [];
      const tplRow = ws.getRow(rn);
      const cellsTpl = []; tplRow.eachCell({ includeEmpty:true }, (cell, cn)=>{ cellsTpl[cn] = { value: cell.value, style: JSON.parse(JSON.stringify(cell.style||{})) }; });
      if(filas.length>1) ws.spliceRows(rn+1, 0, ...filas.slice(1).map(()=>[]));
      filas.forEach((f,i)=>{
        const row = ws.getRow(rn+i); row.height = tplRow.height;
        cellsTpl.forEach((t,cn)=>{ if(!t) return; const cell = row.getCell(cn); cell.style = JSON.parse(JSON.stringify(t.style)); cell.value = reemplazarTokens(t.value, Object.assign({}, scal, { "#": i+1 }), f, nombre); });
      });
      if(!filas.length){ cellsTpl.forEach((t,cn)=>{ if(t) tplRow.getCell(cn).value = reemplazarTokens(t.value, scal, {}, nombre); }); }
    });
    // 2) tokens escalares en el resto
    ws.eachRow(row=>{ row.eachCell(cell=>{ const v = cell.value; if(typeof v==="string" && v.includes("{{")) cell.value = reemplazarTokens(v, scal, {}, null); }); });
  });
  // logo: si hay una celda {{logo}} ya reemplazada no podemos anclar imagen; se mantiene la de la plantilla del cliente
  return await wb.xlsx.writeBuffer();
}
function valoresEscalares(ctx){
  const e = (ctx.proyecto.etapaNombre||ctx.proyecto.etapa||"");
  const base = { proyecto:ctx.proyecto.nombre, cliente:ctx.proyecto.cliente, unidad:ctx.proyecto.unidad, etapa:e, codigo:ctx.doc.codigo, titulo:ctx.doc.titulo, rev:ctx.doc.rev, fecha:ctx.doc.fecha, org:ctx.org.nombre, disciplina:ctx.doc.disciplina, emitido:ctx.doc.emitidoPara||"", elaboro:ctx.org.elaboraPor||"", reviso:ctx.org.revisaPor||"", aprobo:ctx.org.apruebaPor||"" };
  for(const [k,v] of Object.entries(ctx.campos||{})) base["campo."+k] = v;
  (ctx.revisiones||[]).forEach((r,i)=>{ base["rev"+(i+1)+".rev"]=r.rev; base["rev"+(i+1)+".fecha"]=r.fecha; base["rev"+(i+1)+".descripcion"]=r.descripcion; base["rev"+(i+1)+".elaboro"]=r.elaboro||""; base["rev"+(i+1)+".reviso"]=r.reviso||""; base["rev"+(i+1)+".aprobo"]=r.aprobo||""; });
  return base;
}
function reemplazarTokens(v, scal, fila, tablaNombre){
  if(v==null) return v;
  if(typeof v==="object" && v.richText) v = v.richText.map(t=>t.text).join("");
  if(typeof v!=="string" || !v.includes("{{")) return v;
  let soloToken = /^\s*\{\{[^}]+\}\}\s*$/.test(v); let numVal = null;
  const out = v.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, key)=>{
    if(key.startsWith("tabla:")) return "";
    if(key.startsWith("col:")){ const k = key.slice(4).trim(); const val = fila[k]; if(soloToken && typeof val==="number") numVal = val; return val==null ? "" : String(val); }
    if(key in scal){ const val = scal[key]; if(soloToken && typeof val==="number") numVal = val; return val==null ? "" : String(val); }
    return m; // token desconocido: se deja visible para que el usuario lo detecte
  });
  return numVal!=null ? numVal : out;
}
export async function tokensDePlantillaExcel(arrayBuffer){
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(arrayBuffer);
  const tokens = new Set(); const hojas = [];
  wb.eachSheet(ws=>{ hojas.push(ws.name); ws.eachRow(row=>row.eachCell(cell=>{ const v = cell.value; const s = typeof v==="string" ? v : (v && v.richText ? v.richText.map(t=>t.text).join("") : ""); (s.match(/\{\{[^}]+\}\}/g)||[]).forEach(t=>tokens.add(t)); })); });
  return { tokens:[...tokens], hojas };
}

/* ---------------- WORD (docxtemplater) ---------------- */
export async function wordConPlantilla(ctx, arrayBuffer, datosExtra){
  const zip = new PizZip(arrayBuffer);
  const doc = new window.docxtemplater(zip, { paragraphLoop:true, linebreaks:true, nullGetter:()=>"" });
  const data = Object.assign({
    org: ctx.org.nombre, org_direccion: ctx.org.direccion||"", proyecto: ctx.proyecto.nombre, cliente: ctx.proyecto.cliente, unidad: ctx.proyecto.unidad||"", etapa: ctx.proyecto.etapaNombre||"",
    codigo: ctx.doc.codigo, titulo: ctx.doc.titulo, rev: ctx.doc.rev, fecha: ctx.doc.fecha, disciplina: ctx.doc.disciplina||"", emitido: ctx.doc.emitidoPara||"",
    elaboro: ctx.org.elaboraPor||"", reviso: ctx.org.revisaPor||"", aprobo: ctx.org.apruebaPor||"",
    revisiones: (ctx.revisiones||[]).map(r=>Object.assign({ elaboro:ctx.org.elaboraPor||"", reviso:ctx.org.revisaPor||"", aprobo:ctx.org.apruebaPor||"" }, r)),
  }, ctx.campos||{}, datosExtra||{});
  // tablas → listas para bucles {#NOMBRE}{/NOMBRE}
  for(const [n,t] of Object.entries(ctx.tablas||{})) data[n] = t.filas;
  doc.render(data);
  return doc.getZip().generate({ type:"arraybuffer", compression:"DEFLATE", mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}
export function tokensDePlantillaWord(arrayBuffer){
  const zip = new PizZip(arrayBuffer);
  const xml = zip.file("word/document.xml") ? zip.file("word/document.xml").asText() : "";
  const txt = xml.replace(/<[^>]+>/g, "");
  return [...new Set(txt.match(/\{[#/^]?[\w.]+\}/g)||[])];
}

/* ---------------- descarga ---------------- */
export function descargar(buffer, nombre, mime){
  const blob = buffer instanceof Blob ? buffer : new Blob([buffer], { type: mime||"application/octet-stream" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
export const MIME = {
  xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  dxf:"application/dxf",
};

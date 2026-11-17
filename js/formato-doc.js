/* Ingenia — formato estándar común a TODOS los documentos (Excel y Word).
   - Carátula: logo(s) centrado(s) arriba, cliente / proyecto / unidad / etapa / disciplina / título / revisión
     centrados y simétricos, y al pie de la hoja el cuadro con los datos de la empresa, las revisiones y las firmas.
     La carátula no lleva encabezado ni pie de página.
   - Demás hojas / páginas: encabezado «proyecto | título · Rev.» y pie
     «Documento elaborado por … | Página X de N», en la misma letra que el documento (Arial).
   Excel (ExcelJS) y Word (XML) se arman con las mismas medidas, textos, tamaños y colores. */

export const FUENTE = "Arial";
const C = { grafito:"17191D", grafito800:"1F2228", amarillo:"F5C518", amarillo100:"FDF1C4", gris:"ECEFF2", texto2:"5B6472", borde:"8A94A3", blanco:"FFFFFF" };

/* grilla de la carátula = columnas del cuadro de revisiones y firmas (ancho en caracteres de Excel) */
const COLS = [5, 10, 20, 9, 9, 9, 8, 8, 8, 8];
const ENC = ["Rev.", "Fecha", "Emitido para", "Elaboró", "Revisó", "Aprobó", "Ing. Disc.", "Coord. Proy.", "Superint. Ing.", "Gerente Proy."];
const pxCol = w => Math.trunc(w*7 + 5);                  // ancho de columna de Excel → píxeles
const ANCHO_PX = COLS.reduce((a, w)=>a + pxCol(w), 0);    // ≈ 708 px ≈ 18,7 cm
/* alturas (pt) de la carátula; el total respeta la proporción de la hoja A4 para que el cuadro quede al pie */
const ALTO_TOTAL = 800, ALTO_LOGO = 100, FILA_REV = 18;
const T = { label:9, cliente:18, proyecto:20, linea:11, disciplina:12, titulo:22, rev:12 };

const may = v => String(v ?? "").toUpperCase();

/* datos de la carátula a partir de los escalares del documento (docs.js → escalares) */
export function datosCaratula(s){
  const revs = [];
  for(let i=1; i<=8; i++){
    const r = s[`rev${i}.rev`];
    if(r) revs.push([r, s[`rev${i}.fecha`], s[`rev${i}.descripcion`], s[`rev${i}.elaboro`], s[`rev${i}.reviso`], s[`rev${i}.aprobo`], "", "", "", ""].map(v=>v ?? ""));
  }
  if(!revs.length) revs.push([s.rev||"A", s.fecha||"", s.emitido||"", s.elaboro||"", s.reviso||"", s.aprobo||"", "", "", "", ""]);
  while(revs.length < 4) revs.push(Array(10).fill(""));
  return {
    org: s.org||"", orgCorto: s.org_corto || may(s.org), direccion: s.org_direccion||"",
    cliente: may(s.cliente), proyecto: may(s.proyecto), unidad: s.unidad ? "UNIDAD: "+may(s.unidad) : "", etapa: may(s.etapa),
    disciplina: may(s.disciplina), titulo: may(s.titulo), rev: s.rev||"A", fecha: s.fecha||"", revs,
  };
}
const lineaRev = d => `REVISIÓN ${d.rev}${d.fecha ? "  ·  "+d.fecha : ""}`;

/* textos del encabezado y del pie de las páginas interiores */
export function textosPagina(s){
  return {
    izq: s.proyecto||"",
    der: `${may(s.titulo)}${s.rev ? " · Rev. "+s.rev : ""}`,
    pie: `Documento elaborado por ${s.org||""}`.trim(),
  };
}

/* ======================= EXCEL ======================= */
const escHF = t => String(t ?? "").replace(/&/g, "&&");
const fx = (sz, b) => `&"${FUENTE},Regular"&${sz}&K${C.grafito}${b ? "&B" : ""}`;   // &B: negrita sin depender del idioma de Excel

/* escala aproximada con que se imprimirá la hoja (A4, márgenes estándar, 1 página de ancho [y de alto]) */
function escalaImpresion(ws, unaPagina){
  const hor = (ws.pageSetup && ws.pageSetup.orientation)==="landscape";
  const pw = ((hor ? 29.7 : 21.0) - 3.0)/2.54*96, ph = ((hor ? 21.0 : 29.7) - 4.0)/2.54*96;
  const m = String((ws.pageSetup && ws.pageSetup.printArea) || "").replace(/\$/g, "").match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
  const num = l=>{ let n = 0; for(const ch of l) n = n*26 + ch.charCodeAt(0)-64; return n; };
  const c1 = m ? num(m[1]) : 1, c2 = m ? num(m[3]) : Math.max(1, ws.columnCount), r1 = m ? +m[2] : 1, r2 = m ? +m[4] : Math.max(1, ws.rowCount);
  let w = 0, h = 0;
  for(let c=c1; c<=c2; c++){ const col = ws.getColumn(c); if(!col.hidden) w += pxColumna(ws, c); }
  for(let r=r1; r<=r2; r++) h += pxFila(ws, r);
  return Math.max(0.1, Math.min(1, pw/Math.max(1, w), unaPagina ? ph/Math.max(1, h) : 1));
}
/* páginas de alto que ocupará la hoja ajustada a 1 página de ancho */
function paginasDeAlto(ws){
  const hor = (ws.pageSetup && ws.pageSetup.orientation)==="landscape";
  const ph = ((hor ? 21.0 : 29.7) - 4.0)/2.54*96;
  const m = String((ws.pageSetup && ws.pageSetup.printArea) || "").replace(/\$/g, "").match(/[A-Z]+(\d+):[A-Z]+(\d+)/);
  let h = 0; for(let r=(m ? +m[1] : 1); r<=(m ? +m[2] : ws.rowCount); r++) h += pxFila(ws, r);
  return h*escalaImpresion(ws, false)/ph;
}

/* encabezado / pie de página estándar, márgenes y numeración continua (la carátula es la página 1) */
export function encabezadoPieExcel(ws, s, o={}){
  const t = textosPagina(s);
  // Excel y LibreOffice achican el encabezado y el pie con la escala de la hoja («ajustar a 1 página de ancho»):
  // se compensa con el tamaño de letra para que impresos midan 8 pt en todas las hojas, también en los listados anchos
  // si la hoja apenas pasa de una página (unas pocas filas, p. ej. las notas), se ajusta a una sola página
  const unaPagina = !!o.unaPagina || paginasDeAlto(ws) <= 1.3;
  const pt = Math.min(20, Math.max(8, Math.round(8/escalaImpresion(ws, unaPagina))));
  ws.headerFooter = {
    differentFirst:false, differentOddEven:false,
    oddHeader: `&L${fx(pt)}${escHF(t.izq)}&R${fx(pt, true)}${escHF(t.der)}`,
    oddFooter: `&L${fx(pt)}${escHF(t.pie)}&R${fx(pt)}Página &P de &N`,
    evenHeader:null, evenFooter:null, firstHeader:null, firstFooter:null,
  };
  const ps = ws.pageSetup || (ws.pageSetup = {});
  ps.margins = { left:0.59, right:0.59, top:0.79, bottom:0.79, header:0.31, footer:0.31 };
  ps.firstPageNumber = undefined;    // numeración continua entre hojas: «Página X de N» del documento completo
  ps.horizontalCentered = true; ps.verticalCentered = false;
  // A4, una página de ancho (la orientación es la de cada formato); las hojas de datos, una página por hoja
  ps.paperSize = 9;
  ps.fitToPage = true; ps.fitToWidth = 1; ps.fitToHeight = unaPagina ? 1 : 0;
}

function pxFila(ws, r){ const h = ws.getRow(r).height || (ws.properties && ws.properties.defaultRowHeight) || 15; return h*96/72; }
function pxColumna(ws, c){ const w = ws.getColumn(c).width || (ws.properties && ws.properties.defaultColWidth) || 8.43; return pxCol(w); }
/* ancla nativa (EMU) para una imagen a x,y píxeles de la esquina A1: ExcelJS convierte mal las columnas
   fraccionarias (usa 10 000 EMU por carácter), por eso los logos quedaban corridos a la izquierda */
export function anclaPx(ws, x, y){
  let c = 0, acc = 0; while(c < 300 && acc + pxColumna(ws, c+1) <= x){ acc += pxColumna(ws, c+1); c++; }
  let r = 0, accr = 0; while(r < 2000 && accr + pxFila(ws, r+1) <= y){ accr += pxFila(ws, r+1); r++; }
  return { nativeCol:c, nativeColOff:Math.round((x-acc)*9525), nativeRow:r, nativeRowOff:Math.round((y-accr)*9525) };
}
export function imagenExcel(wb, ws, dataURL, x, y, w, h){
  const id = wb.addImage({ base64: dataURL.split(",")[1], extension: /^data:image\/png/.test(dataURL) ? "png" : "jpeg" });
  ws.addImage(id, { tl: anclaPx(ws, x, y), ext:{ width:Math.round(w), height:Math.round(h) }, editAs:"oneCell" });
}

/* posición y tamaño de los logos de la carátula (px, comunes a Excel y Word) */
function cajasLogos(logos){
  const ls = [logos && logos.org, logos && logos.cliente].filter(l=>l && l.dataURL);
  const H = ALTO_LOGO*96/72, maxH = H*0.9, maxW = ls.length > 1 ? ANCHO_PX*0.36 : ANCHO_PX*0.5;
  return ls.map((l, i)=>{
    const ar = l.aspect || 3; let h = maxH, w = h*ar; if(w > maxW){ w = maxW; h = w/ar; }
    const cx = ls.length > 1 ? ANCHO_PX*(i ? 0.75 : 0.25) : ANCHO_PX/2;
    return { dataURL:l.dataURL, x:cx - w/2, y:(H - h)/2, w, h };
  });
}

/* Construye la carátula estándar en una hoja vacía. */
export function caratulaExcel(wb, ws, s, logos){
  const d = datosCaratula(s);
  const N = COLS.length, L = "J";
  ws.columns = COLS.map(w=>({ width:w }));
  ws.views = [{ showGridLines:false }];
  ws.properties = Object.assign({}, ws.properties, { defaultRowHeight:15 });
  const borde = (st="thin", col=C.borde)=>({ style:st, color:{ argb:"FF"+col } });
  const fnt = (o={})=>Object.assign({ name:FUENTE, size:10, color:{ argb:"FF"+C.grafito } }, o);
  let r = 0;
  const fila = h => { r++; ws.getRow(r).height = h; return r; };
  const celda = (r1, c1, r2, c2, valor, o={})=>{
    if(r2 > r1 || c2 > c1) ws.mergeCells(r1, c1, r2, c2);
    for(let rr=r1; rr<=r2; rr++) for(let cc=c1; cc<=c2; cc++){
      const cell = ws.getCell(rr, cc);
      cell.font = fnt(o.font); cell.alignment = { horizontal:"center", vertical:"middle", wrapText:true };
      if(o.fill) cell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FF"+o.fill } };
      if(o.borde) cell.border = { top:rr===r1?o.borde:undefined, bottom:rr===r2?o.borde:undefined, left:cc===c1?o.borde:undefined, right:cc===c2?o.borde:undefined };
    }
    ws.getCell(r1, c1).value = valor;
  };
  const texto = (h, valor, font)=>{ const rr = fila(h); celda(rr, 1, rr, N, valor, { font }); return rr; };

  // 1) logos (o el nombre de la empresa si no hay logo)
  fila(8);
  const r0 = r+1; for(let i=0;i<5;i++) fila(ALTO_LOGO/5);
  const cajas = cajasLogos(logos);
  if(!cajas.length) celda(r0, 1, r, N, may(d.org), { font:{ bold:true, size:20 } });
  fila(8);
  const rl = fila(6); for(let c=1;c<=N;c++) ws.getCell(rl, c).border = { bottom: borde("medium", C.amarillo) };

  // 2) bloque de textos (centrado vertical entre la línea y el cuadro)
  const bloque = [
    [14, "CLIENTE", { size:T.label, color:{ argb:"FF"+C.texto2 } }],
    [28, d.cliente, { bold:true, size:T.cliente }],
    [16, ""],
    [14, "PROYECTO", { size:T.label, color:{ argb:"FF"+C.texto2 } }],
    [54, d.proyecto, { bold:true, size:T.proyecto }],
    [18, d.unidad, { size:T.linea }],
    [18, d.etapa, { bold:true, size:T.linea }],
    [40, ""],
    [20, d.disciplina, { size:T.disciplina, color:{ argb:"FF"+C.grafito800 } }],
    [8, ""],
    ["titulo"],
    [10, ""],
    [20, lineaRev(d), { bold:true, size:T.rev }],
  ];
  const altoBloque = bloque.reduce((a, b)=>a + (b[0]==="titulo" ? 84 : b[0]), 0);
  const altoCuadro = 36 + 26 + d.revs.length*FILA_REV;
  const usado = 8 + ALTO_LOGO + 8 + 6 + altoBloque + altoCuadro;
  const libre = Math.max(20, ALTO_TOTAL - usado);
  fila(libre/2);
  for(const b of bloque){
    if(b[0]==="titulo"){
      const a = r+1; fila(28); fila(28); fila(28);
      celda(a, 1, r, N, d.titulo, { font:{ bold:true, size:T.titulo }, fill:C.amarillo100, borde:borde("thin", C.grafito) });
    } else texto(b[0], b[1], b[2]);
  }
  fila(libre - libre/2);

  // 3) cuadro al pie: datos de la empresa + revisiones + firmas
  const b1 = fila(36);
  const emp = d.direccion ? { richText:[ { text:d.org, font:fnt({ bold:true, size:9 }) }, { text:"\n"+d.direccion, font:fnt({ size:7.5, color:{ argb:"FF"+C.texto2 } }) } ] } : d.org;
  celda(b1, 1, b1, 3, emp, { font:{ bold:true, size:9 }, fill:C.gris, borde:borde() });
  celda(b1, 4, b1, 6, "REVISADO POR "+d.orgCorto, { font:{ bold:true, size:8.5, color:{ argb:"FF"+C.blanco } }, fill:C.grafito, borde:borde() });
  celda(b1, 7, b1, 10, "REVISADO POR EL CLIENTE", { font:{ bold:true, size:8.5, color:{ argb:"FF"+C.blanco } }, fill:C.grafito, borde:borde() });
  const b2 = fila(26);
  ENC.forEach((h, i)=>celda(b2, i+1, b2, i+1, h, { font:{ bold:true, size:8, color:{ argb:"FF"+C.blanco } }, fill:C.grafito800, borde:borde() }));
  for(const rv of d.revs){ const rr = fila(FILA_REV); rv.forEach((v, i)=>celda(rr, i+1, rr, i+1, v, { font:{ size:8 }, borde:borde() })); }
  // contorno del cuadro
  for(let rr=b1; rr<=r; rr++) for(let c=1; c<=N; c++){
    const cell = ws.getCell(rr, c), bo = Object.assign({}, cell.border||{});
    if(rr===b1) bo.top = borde("medium", C.grafito); if(rr===r) bo.bottom = borde("medium", C.grafito);
    if(c===1) bo.left = borde("medium", C.grafito); if(c===N) bo.right = borde("medium", C.grafito);
    cell.border = bo;
  }

  // logos al final (las alturas de fila ya están definidas)
  for(const k of cajas){ try{ imagenExcel(wb, ws, k.dataURL, k.x, k.y + pxFila(ws, 1), k.w, k.h); }catch(e){ console.warn("logo", e); } }

  ws.pageSetup = Object.assign({}, ws.pageSetup, {
    paperSize:9, orientation:"portrait", fitToPage:true, fitToWidth:1, fitToHeight:1, scale:100,
    horizontalCentered:true, verticalCentered:false, firstPageNumber:undefined, printArea:`A1:${L}${r}`,
    margins:{ left:0.59, right:0.59, top:0.59, bottom:0.59, header:0.31, footer:0.31 },
  });
  // la carátula no lleva encabezado ni pie de página
  ws.headerFooter = { differentFirst:true, differentOddEven:false, oddHeader:"", oddFooter:"", evenHeader:null, evenFooter:null, firstHeader:"", firstFooter:"" };
  ws._caratulaIngenia = true;
  return ws;
}

/* ---------- bloque de encabezado de las hojas de listado (el del listado de cargas) ----------
   fila 1: logos · fila 2: título · fila 3: Cliente · fila 4: Proyecto | Fecha · fila 5: P&ID | Revisión
   (+ fila 6 en blanco si se pide). Las columnas de etiqueta / valor se reparten según los anchos de la tabla. */
export const FILAS_ENCABEZADO = 5;
const ALTOS_ENC = [65.25, 25, 15, 15, 15];
function anchoCol(ws, c){ return ws.getColumn(c).width || (ws.properties && ws.properties.defaultColWidth) || 8.43; }
/* reparte c1..c2 en [etiqueta | valor | etiqueta derecha | valor derecho] lo más parecido a las proporciones del listado de cargas */
export function columnasEncabezado(ws, c1, c2){
  const w = []; for(let c=c1; c<=c2; c++) w.push(anchoCol(ws, c));
  const W = w.reduce((a, b)=>a+b, 0);
  // k columnas desde un extremo cuya suma se acerca más a la meta, sin bajar de un ancho mínimo legible
  const mejor = (desde, paso, meta, max, min)=>{ let acc = 0, k = 0, bestK = 0, bestD = Infinity;
    for(let i=desde; k<max; i+=paso){ acc += w[i]; k++; if(acc < min) continue; const dd = Math.abs(acc-meta); if(dd < bestD){ bestD = dd; bestK = k; } }
    return bestK || max; };
  const n = w.length;
  const nL = mejor(0, 1, 0.13*W, Math.max(1, n-3), 9);
  const nVD = mejor(n-1, -1, 0.10*W, Math.max(1, n-nL-2), 9);
  const nLD = mejor(n-1-nVD, -1, 0.065*W, Math.max(1, n-nL-nVD-1), 8);
  return { lab:[c1, c1+nL-1], val:[c1+nL, c2-nVD-nLD], labD:[c2-nVD-nLD+1, c2-nVD], valD:[c2-nVD+1, c2] };
}
/* escribe el bloque en filas vacías desde r0; devuelve las combinaciones [r1,c1,r2,c2] y las cajas de logo {tl,br} */
export function bloqueEncabezadoExcel(ws, r0, c1, c2, titulo, valores={}){
  const k = columnasEncabezado(ws, c1, c2);
  const merges = [];
  const borde = { style:"thin", color:{ argb:"FF"+C.grafito } };
  const celda = (r, [a, b], valor, o={})=>{
    for(let c=a; c<=b; c++){
      const cell = ws.getCell(r, c);
      cell.font = { name:FUENTE, size:o.size||10, bold:!!o.bold, color:{ argb:"FF"+(o.color||C.grafito) } };
      cell.alignment = o.izq ? { horizontal:"left", vertical:"middle", wrapText:true, indent:1 } : { horizontal:"center", vertical:"middle", wrapText:true };
      cell.border = { top:borde, bottom:o.bajo || borde, left:c===a ? borde : undefined, right:c===b ? borde : undefined };
      if(o.fill) cell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FF"+o.fill } };
    }
    ws.getCell(r, a).value = valor;
    if(b > a) merges.push([r, a, r, b]);
  };
  ALTOS_ENC.forEach((h, i)=>{ ws.getRow(r0+i).height = h; });
  const et = { bold:true, fill:C.grafito800, color:C.blanco };
  celda(r0+1, [c1, c2], titulo, { size:12, bold:true, fill:C.grafito, color:C.blanco, bajo:{ style:"medium", color:{ argb:"FF"+C.amarillo } } });
  // los valores de Cliente, Proyecto y P&ID se leen de izquierda a derecha; Fecha y Revisión, centrados
  celda(r0+2, k.lab, "Cliente", et); celda(r0+2, [k.val[0], c2], valores.cliente ?? "{{cliente}}", { izq:true });
  celda(r0+3, k.lab, "Proyecto", et); celda(r0+3, k.val, valores.proyecto ?? "{{proyecto}}", { izq:true }); celda(r0+3, k.labD, "Fecha", et); celda(r0+3, k.valD, valores.fecha ?? "{{fecha}}");
  celda(r0+4, k.lab, valores.etiquetaRef || "P&ID", et); celda(r0+4, k.val, valores.referencia ?? "{{referencia}}", { izq:true }); celda(r0+4, k.labD, "Revisión", et); celda(r0+4, k.valD, valores.rev ?? "{{rev}}");
  // logos en la fila 1: empresa a la izquierda, cliente a la derecha (cada uno en ~30 % del ancho)
  const W = (()=>{ let a = 0; for(let c=c1; c<=c2; c++) a += anchoCol(ws, c); return a; })();
  const hasta = (desde, paso)=>{ let acc = 0, c = desde; while(c>=c1 && c<=c2){ acc += anchoCol(ws, c); if(acc >= 0.3*W) break; c += paso; } return Math.max(c1, Math.min(c2, c)); };
  const logos = { org:{ tl:[c1-1, r0-1], br:[hasta(c1, 1), r0] }, cliente:{ tl:[hasta(c2, -1)-1, r0-1], br:[c2, r0] } };
  return { merges, logos };
}

/* logo centrado (y escalado sin deformar) dentro de una caja de celdas { tl:[col0,fila0], br:[col1,fila1] } (base 0) */
export function logoEnCaja(wb, ws, dataURL, caja){
  if(!dataURL || !caja) return;
  try{
    const [c0, r0] = caja.tl, [c1, r1] = caja.br;
    let x0 = 0, y0 = 0, W = 0, H = 0;
    for(let c=1; c<=c0; c++) x0 += pxColumna(ws, c);
    for(let r=1; r<=r0; r++) y0 += pxFila(ws, r);
    for(let c=c0+1; c<=c1; c++) W += pxColumna(ws, c);
    for(let r=r0+1; r<=r1; r++) H += pxFila(ws, r);
    const ar = caja.aspect || 3;
    let w = W*0.92, h = w/ar;
    if(h > H*0.86){ h = H*0.86; w = h*ar; }
    imagenExcel(wb, ws, dataURL, x0+(W-w)/2, y0+(H-h)/2, w, h);
  }catch(e){ console.warn("logo", e); }
}

/* Reemplaza la hoja de carátula de un libro por la carátula estándar (misma posición y nombre). */
export function reemplazarCaratulaExcel(wb, s, logos){
  const vieja = wb.worksheets.find(w=>/^CAR[ÁA]TULA$/i.test(w.name.trim()));
  const nombre = vieja ? vieja.name : "CARÁTULA";
  const orden = vieja ? vieja.orderNo : -1;
  if(vieja) wb.removeWorksheet(vieja.id);
  const ws = wb.addWorksheet(nombre);
  ws.orderNo = orden;
  return caratulaExcel(wb, ws, s, logos);
}

/* ======================= WORD ======================= */
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
const xesc = t => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const TW = px => Math.round(px*15);             // px (96 dpi) → twips
const ANCHO_TW = TW(ANCHO_PX);
const rpr = (sz, o={})=>`<w:rPr><w:rFonts w:ascii="${FUENTE}" w:hAnsi="${FUENTE}" w:cs="${FUENTE}" w:eastAsia="${FUENTE}"/>${o.b ? "<w:b/><w:bCs/>" : ""}<w:color w:val="${o.color||C.grafito}"/><w:sz w:val="${Math.round(sz*2)}"/><w:szCs w:val="${Math.round(sz*2)}"/></w:rPr>`;
const run = (t, sz, o)=>`<w:r>${rpr(sz, o)}<w:t xml:space="preserve">${xesc(t)}</w:t></w:r>`;
const runs = (t, sz, o)=>String(t ?? "").split("\n").map((x, i)=>(i ? `<w:r>${rpr(sz, o)}<w:br/></w:r>` : "")+run(x, sz, o)).join("");
/* párrafo de altura exacta (pt) con texto centrado: reproduce una fila de la carátula de Excel */
const filaPar = (alto, texto, sz, o={})=>`<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${Math.round(alto*20)}" w:lineRule="exact"/><w:jc w:val="center"/>${rpr(sz||2)}</w:pPr>${texto ? runs(texto, sz, o) : ""}</w:p>`;
let IND = -Math.round((ANCHO_TW - 8504)/2);     // la carátula usa el mismo ancho que en Excel (centrada en la hoja)

function bordesTc(o={}){
  const b = (lado, st)=>`<w:${lado} w:val="${st.v}" w:sz="${st.sz}" w:space="0" w:color="${st.c}"/>`;
  const fino = { v:"single", sz:4, c:C.borde }, grueso = { v:"single", sz:12, c:C.grafito };
  return `<w:tcBorders>${b("top", o.top ? grueso : fino)}${b("left", o.left ? grueso : fino)}${b("bottom", o.bottom ? grueso : fino)}${b("right", o.right ? grueso : fino)}</w:tcBorders>`;
}
function tc(anchoTw, contenido, o={}){
  return `<w:tc><w:tcPr><w:tcW w:w="${anchoTw}" w:type="dxa"/>${o.span>1 ? `<w:gridSpan w:val="${o.span}"/>` : ""}${bordesTc(o.bordes)}${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ""}<w:tcMar><w:left w:w="40" w:type="dxa"/><w:right w:w="40" w:type="dxa"/></w:tcMar><w:vAlign w:val="center"/></w:tcPr>${contenido}</w:tc>`;
}
const pCelda = (inner, sz)=>`<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/>${rpr(sz)}</w:pPr>${inner}</w:p>`;
const tr = (altoPt, celdas)=>`<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="${Math.round(altoPt*20)}" w:hRule="exact"/><w:jc w:val="center"/></w:trPr>${celdas}</w:tr>`;
const tblPr = ()=>`<w:tblPr><w:tblW w:w="${ANCHO_TW}" w:type="dxa"/><w:tblInd w:w="${IND}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="40" w:type="dxa"/><w:right w:w="40" w:type="dxa"/></w:tblCellMar><w:tblLook w:val="0000"/></w:tblPr>`;

/* cuadro de la carátula (datos de la empresa + revisiones + firmas) */
function cuadroWord(d){
  const cw = COLS.map(w=>TW(pxCol(w)));
  const suma = (a, b)=>cw.slice(a, b).reduce((x, y)=>x+y, 0);
  const n = d.revs.length;
  const bd = (fila, c1, c2)=>({ top:fila===0, bottom:fila===n+1, left:c1===0, right:c2===COLS.length-1 });
  let x = `<w:tbl>${tblPr()}<w:tblGrid>${cw.map(w=>`<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>`;
  const emp = run(d.org, 9, { b:true }) + (d.direccion ? `<w:r>${rpr(7.5)}<w:br/></w:r>`+run(d.direccion, 7.5, { color:C.texto2 }) : "");
  x += tr(36,
    tc(suma(0,3), pCelda(emp, 9), { span:3, fill:C.gris, bordes:bd(0,0,2) }) +
    tc(suma(3,6), pCelda(run("REVISADO POR "+d.orgCorto, 8.5, { b:true, color:C.blanco }), 8.5), { span:3, fill:C.grafito, bordes:bd(0,3,5) }) +
    tc(suma(6,10), pCelda(run("REVISADO POR EL CLIENTE", 8.5, { b:true, color:C.blanco }), 8.5), { span:4, fill:C.grafito, bordes:bd(0,6,9) }));
  x += tr(26, ENC.map((h, i)=>tc(cw[i], pCelda(run(h, 8, { b:true, color:C.blanco }), 8), { fill:C.grafito800, bordes:{ left:i===0, right:i===ENC.length-1 } })).join(""));
  d.revs.forEach((rv, k)=>{ x += tr(FILA_REV, rv.map((v, i)=>tc(cw[i], pCelda(v ? run(v, 8) : "", 8), { bordes:{ left:i===0, right:i===rv.length-1, bottom:k===n-1 } })).join("")); });
  return x + "</w:tbl>";
}

function imagenWord(rid, k, w, h, nombre){
  const cx = Math.round(w*9525), cy = Math.round(h*9525);
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${900+k}" name="${nombre}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${900+k}" name="${nombre}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

/* fila de altura exacta del ancho de la carátula (como una fila combinada de Excel), texto centrado */
function banda(alto, contenido, sz, o={}){
  const bb = l=>`<w:${l} w:val="${o.borde ? "single" : "nil"}" w:sz="4" w:space="0" w:color="${o.borde||"auto"}"/>`;
  return `<w:tbl>${tblPr()}<w:tblGrid><w:gridCol w:w="${ANCHO_TW}"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="${Math.round(alto*20)}" w:hRule="exact"/><w:jc w:val="center"/></w:trPr><w:tc><w:tcPr><w:tcW w:w="${ANCHO_TW}" w:type="dxa"/><w:tcBorders>${bb("top")}${bb("left")}${bb("bottom")}${bb("right")}</w:tcBorders>${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ""}<w:vAlign w:val="center"/></w:tcPr>${pCelda(contenido, sz)}</w:tc></w:tr></w:tbl>`;
}

function portadaWord(d, imgs, altoUtil){
  let x = filaPar(8, "");
  // logos (o el nombre de la empresa) en una fila de la misma altura que en Excel
  if(imgs.length===1) x += banda(ALTO_LOGO, imgs[0].xml, 2);
  else if(imgs.length > 1){
    // dos logos (empresa y cliente) simétricos: cada uno centrado en su mitad, como en Excel
    const m = Math.round(ANCHO_TW/2), nb = l=>`<w:${l} w:val="nil"/>`;
    const celda = xml=>`<w:tc><w:tcPr><w:tcW w:w="${m}" w:type="dxa"/><w:tcBorders>${nb("top")}${nb("left")}${nb("bottom")}${nb("right")}</w:tcBorders><w:vAlign w:val="center"/></w:tcPr>${pCelda(xml, 2)}</w:tc>`;
    x += `<w:tbl>${tblPr()}<w:tblGrid><w:gridCol w:w="${m}"/><w:gridCol w:w="${ANCHO_TW-m}"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="${ALTO_LOGO*20}" w:hRule="exact"/><w:jc w:val="center"/></w:trPr>${celda(imgs[0].xml)}${celda(imgs[1].xml)}</w:tr></w:tbl>`;
  } else x += filaPar(ALTO_LOGO, may(d.org), 20, { b:true });
  x += filaPar(8, "");
  x += `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="0" w:color="${C.amarillo}"/></w:pBdr><w:spacing w:before="0" w:after="0" w:line="120" w:lineRule="exact"/><w:ind w:left="${IND}" w:right="${IND}"/>${rpr(2)}</w:pPr></w:p>`;
  // bloque de textos: mismas filas que la carátula de Excel; queda centrado en el espacio libre sobre el cuadro
  const altoCuadro = 36 + 26 + d.revs.length*FILA_REV;
  const altoBloque = 14+28+16+14+54+18+18+40+20+8+84+10+20;
  // espacio libre entre la línea y el cuadro (que va en el pie de la primera página): el bloque queda centrado
  const libre = Math.max(20, altoUtil - (8 + ALTO_LOGO + 8 + 6 + altoBloque + altoCuadro + 6));
  x += filaPar(libre/2, "");
  x += filaPar(14, "CLIENTE", T.label, { color:C.texto2 });
  x += filaPar(28, d.cliente, T.cliente, { b:true });
  x += filaPar(16, "");
  x += filaPar(14, "PROYECTO", T.label, { color:C.texto2 });
  x += banda(54, runs(d.proyecto, T.proyecto, { b:true }), T.proyecto);
  x += filaPar(18, d.unidad, T.linea);
  x += filaPar(18, d.etapa, T.linea, { b:true });
  x += filaPar(40, "");
  x += filaPar(20, d.disciplina, T.disciplina, { color:C.grafito800 });
  x += filaPar(8, "");
  // título en banda (mismo ancho que el cuadro)
  x += banda(84, runs(d.titulo, T.titulo, { b:true }), T.titulo, { fill:C.amarillo100, borde:C.grafito });
  x += filaPar(10, "");
  x += filaPar(20, lineaRev(d), T.rev, { b:true });
  // salto a la página siguiente (el cuadro va en el pie exclusivo de la primera página → siempre al pie de la hoja)
  x += `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>${rpr(1)}</w:pPr><w:r>${rpr(1)}<w:br w:type="page"/></w:r></w:p>`;
  return x;
}

const campo = (instr, sz)=>`<w:r>${rpr(sz)}<w:fldChar w:fldCharType="begin"/></w:r><w:r>${rpr(sz)}<w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r><w:r>${rpr(sz)}<w:fldChar w:fldCharType="separate"/></w:r><w:r>${rpr(sz)}<w:t>1</w:t></w:r><w:r>${rpr(sz)}<w:fldChar w:fldCharType="end"/></w:r>`;
const parTab = (izq, der, anchoTexto)=>`<w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="${anchoTexto}"/></w:tabs><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>${rpr(8)}</w:pPr>${izq}<w:r>${rpr(8)}<w:tab/></w:r>${der}</w:p>`;

/* Cambia la letra de un .docx a Arial: fuentes del tema (las que usan los estilos sin letra propia), letra por
   defecto, estilos y textos. Se respetan las fuentes de símbolos (viñetas Symbol / Wingdings / Courier New),
   las de ecuaciones (Cambria Math) y Arial Narrow. */
const LETRA_PROPIA = /Symbol|Wingdings|Webdings|Courier New|Cambria Math|Arial Narrow|Marlett/i;
const RFONTS_ARIAL = `<w:rFonts w:ascii="${FUENTE}" w:hAnsi="${FUENTE}" w:eastAsia="${FUENTE}" w:cs="${FUENTE}"/>`;
const aArial = xml => xml.replace(/<w:rFonts\b[^>]*\/>/g, m=>LETRA_PROPIA.test(m) ? m : RFONTS_ARIAL);
export function letraWord(zip){
  const fT = "word/theme/theme1.xml";
  if(zip.file(fT)) zip.file(fT, zip.file(fT).asText().replace(/(<a:(?:major|minor)Font>\s*<a:latin typeface=")[^"]*"(?:\s+panose="[^"]*")?/g, `$1${FUENTE}"`));
  const fS = "word/styles.xml";
  if(zip.file(fS)){
    let st = aArial(zip.file(fS).asText());
    // letra por defecto explícita (los párrafos sin estilo ni letra propia)
    st = st.replace(/<w:rPrDefault>\s*<w:rPr>([\s\S]*?)<\/w:rPr>/, (m, cuerpo)=>`<w:rPrDefault><w:rPr>${/<w:rFonts\b/.test(cuerpo) ? cuerpo : RFONTS_ARIAL+cuerpo}</w:rPr>`);
    zip.file(fS, st);
  }
  for(const f of Object.keys(zip.files)){
    if(!/^word\/(document|numbering|footnotes|endnotes|header\d*|footer\d*|header_[\w]+|footer_[\w]+)\.xml$/.test(f)) continue;
    zip.file(f, aArial(zip.file(f).asText()));
  }
}

/* ---------- estilos del cuerpo: títulos en negrita, listas con viñetas, índice ordenado por niveles ---------- */
const TITULOS = { Ttulo1:0, Ttulo2:1, Ttulo3:2 };
function estiloXml(st, id){ const m = st.match(new RegExp(`<w:style\\b[^>]*w:styleId="${id}"[^>]*>[\\s\\S]*?</w:style>`)); return m ? m[0] : null; }
function ponerEstilo(st, id, xml){ const v = estiloXml(st, id); return v ? st.replace(v, xml) : st.replace("</w:styles>", xml+"</w:styles>"); }
/* numId de una lista con viñetas del documento (o una nueva) */
function numVineta(zip){
  const f = "word/numbering.xml"; if(!zip.file(f)) return null;
  let nb = zip.file(f).asText();
  const abst = {}; for(const m of nb.matchAll(/<w:abstractNum\b[^>]*w:abstractNumId="(\d+)"[\s\S]*?<\/w:abstractNum>/g)){ const l0 = (m[0].match(/<w:lvl w:ilvl="0"[\s\S]*?<\/w:lvl>/)||[""])[0]; abst[m[1]] = /w:numFmt w:val="bullet"/.test(l0) && !/w:pStyle/.test(m[0]); }
  for(const m of nb.matchAll(/<w:num w:numId="(\d+)"[^>]*>\s*<w:abstractNumId w:val="(\d+)"\/>\s*<\/w:num>/g)) if(abst[m[2]]) return m[1];
  // no hay: se agrega una lista de viñetas (•)
  const a = `<w:abstractNum w:abstractNumId="9001"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="${FUENTE}" w:hAnsi="${FUENTE}"/></w:rPr></w:lvl></w:abstractNum>`;
  nb = nb.replace(/(<w:num\b)/, a+"$1").replace("</w:numbering>", `<w:num w:numId="9001"><w:abstractNumId w:val="9001"/></w:num></w:numbering>`);
  zip.file(f, nb); return "9001";
}
function estilosWord(zip, anchoTexto){
  const fS = "word/styles.xml"; if(!zip.file(fS)) return;
  let st = zip.file(fS).asText();
  // títulos del cuerpo (1. / 1.1. / 1.1.1) en negrita
  for(const id of Object.keys(TITULOS)){ const v = estiloXml(st, id); if(!v) continue;
    let n = v.replace(/<w:b w:val="(?:0|false)"\/>|<w:bCs w:val="(?:0|false)"\/>/g, "");
    if(!/<w:b\/>/.test(n)) n = /<w:rPr>/.test(n) ? n.replace(/<w:rPr>((?:<w:rFonts\b[^>]*\/>)?)/, "<w:rPr>$1<w:b/><w:bCs/>") : n.replace("</w:style>", "<w:rPr><w:b/><w:bCs/></w:rPr></w:style>");
    st = st.replace(v, n); }
  // listas (Párrafo de lista) con viñetas
  const nv = numVineta(zip), vl = estiloXml(st, "Prrafodelista");
  if(nv && vl && !/<w:numPr>/.test(vl)) st = st.replace(vl, vl.replace(/<w:pPr>[\s\S]*?<\/w:pPr>|(?=<\/w:style>)/, `<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${nv}"/></w:numPr><w:spacing w:after="60"/><w:ind w:left="720" w:hanging="360"/><w:contextualSpacing/></w:pPr>`));
  // índice: número y texto en columnas por nivel, página a la derecha con puntos guía
  const tab = `<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${anchoTexto}"/></w:tabs>`;
  const toc = (n, izq, colgante, antes, despues, rpr)=>`<w:style w:type="paragraph" w:styleId="TDC${n}"><w:name w:val="toc ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="39"/><w:unhideWhenUsed/><w:pPr>${tab}<w:spacing w:before="${antes}" w:after="${despues}" w:line="240" w:lineRule="auto"/><w:ind w:left="${izq}" w:right="0" w:hanging="${colgante}"/></w:pPr><w:rPr><w:rFonts w:ascii="${FUENTE}" w:hAnsi="${FUENTE}" w:eastAsia="${FUENTE}" w:cs="${FUENTE}"/>${rpr}<w:noProof/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>`;
  st = ponerEstilo(st, "TDC1", toc(1, 567, 567, 120, 40, "<w:b/><w:bCs/><w:caps/>"));
  st = ponerEstilo(st, "TDC2", toc(2, 1247, 680, 0, 40, ""));
  st = ponerEstilo(st, "TDC3", toc(3, 2098, 851, 0, 40, ""));
  const ti = estiloXml(st, "Tabladeilustraciones");
  if(ti) st = st.replace(ti, ti.replace(/<w:tabs>[\s\S]*?<\/w:tabs>/, tab));
  zip.file(fS, st);
}

const fld = (instr, cache)=>`<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>${cache}</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
const PARRAFO = /<w:p(?=[ >])(?:(?!<w:p[ >])[\s\S])*?<\/w:p>/g;
const textoXml = x=>(x.match(/<w:t(?: [^>]*)?>[^<]*<\/w:t>/g)||[]).map(t=>t.replace(/<[^>]+>/g, "")).join("");
/* números de los títulos (1. / 1.1. / 1.1.1) según la lista de numeración de los estilos de título */
function formatosTitulo(zip){
  const st = zip.file("word/styles.xml") ? zip.file("word/styles.xml").asText() : "", nb = zip.file("word/numbering.xml") ? zip.file("word/numbering.xml").asText() : "";
  const t1 = estiloXml(st, "Ttulo1") || ""; const numId = (t1.match(/<w:numId w:val="(\d+)"/)||[])[1];
  const abs = numId && (nb.match(new RegExp(`<w:num w:numId="${numId}"[^>]*>\\s*<w:abstractNumId w:val="(\\d+)"`))||[])[1];
  const a = abs && (nb.match(new RegExp(`<w:abstractNum\\b[^>]*w:abstractNumId="${abs}"[\\s\\S]*?</w:abstractNum>`))||[])[0];
  const fmts = a ? [0,1,2].map(l=>(a.match(new RegExp(`<w:lvl w:ilvl="${l}"[\\s\\S]*?w:lvlText w:val="([^"]*)"`))||[])[1]) : [];
  return [0,1,2].map(l=>fmts[l] || ["%1.", "%1.%2.", "%1.%2.%3"][l]);
}
/* Índice: «ÍNDICE», entradas por nivel con su número y la página (campos PAGEREF a marcadores en cada título);
   también los índices de figuras y de tablas. */
function indiceWord(zip, doc){
  doc = doc.replace(/>TABLA DE CONTENIDO</g, ">ÍNDICE<");
  let k = 0; const marca = ()=>`_Toc9${String(++k).padStart(8, "0")}`;
  const conMarca = (p, nombre)=>p.replace(/(<w:pPr>[\s\S]*?<\/w:pPr>|<w:p(?=[ >])[^>]*>)/, `$1<w:bookmarkStart w:id="${8000+k}" w:name="${nombre}"/>`).replace(/<\/w:p>$/, `<w:bookmarkEnd w:id="${8000+k}"/></w:p>`);
  const entrada = (estilo, partes, nombre, ini, fin)=>`<w:p><w:pPr><w:pStyle w:val="${estilo}"/></w:pPr>${ini||""}<w:hyperlink w:anchor="${nombre}" w:history="1">${partes}<w:r><w:tab/></w:r>${fld(`PAGEREF ${nombre} \\h`, "1")}</w:hyperlink>${fin||""}</w:p>`;
  const r = t=>`<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`;
  // 1) títulos del cuerpo → marcadores + entradas
  const fmts = formatosTitulo(zip), cont = [0, 0, 0], entradas = [];
  let enIndice = false;
  doc = doc.replace(PARRAFO, p=>{
    if(/TOC \\o/.test(p)){ enIndice = true; return p; }
    const est = (p.match(/<w:pStyle w:val="([^"]+)"/)||[])[1];
    if(!(est in TITULOS) || !enIndice) return p;
    // los títulos se ven en negrita aunque el texto traiga «sin negrita»
    p = p.replace(/<w:b w:val="(?:0|false)"\/>|<w:bCs w:val="(?:0|false)"\/>/g, "");
    const txt = textoXml(p).trim(); if(!txt) return p;
    const nivel = TITULOS[est], sinNum = /<w:numId w:val="0"\/>/.test(p);
    let num = "";
    if(!sinNum){ cont[nivel]++; for(let i=nivel+1;i<3;i++) cont[i] = 0; num = fmts[nivel].replace(/%(\d)/g, (m, d)=>String(cont[+d-1] || 1)); }
    const nombre = marca();
    entradas.push(entrada(`TDC${nivel+1}`, (num ? r(num)+"<w:r><w:tab/></w:r>" : "") + r(txt), nombre));
    return conMarca(p, nombre);
  });
  // las entradas quedan como párrafos con campos PAGEREF (sin el campo TOC que las envuelve): así Word, al abrir
  // (actualiza los campos), y LibreOffice / la conversión a PDF muestran las páginas reales
  if(entradas.length){
    const m = doc.match(/<w:p(?=[ >])(?:(?!<w:p[ >])[\s\S])*?TOC \\o[\s\S]*?<\/w:p>/);
    if(m){
      const i = doc.indexOf(m[0]), resto = doc.slice(i + m[0].length, i + m[0].length + 1500);
      // el cuerpo empieza en una hoja nueva (salvo que sigan los índices de figuras / tablas, que ya la tienen)
      const salto = /ÍNDICE DE|w:type="page"/.test(resto.slice(0, resto.indexOf("</w:p>")+6)) ? "" : `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
      doc = doc.slice(0, i) + entradas.join("") + salto + doc.slice(i + m[0].length);
    }
  }
  // 2) índices de figuras / tablas (campos TOC \c "Figura" / "Tabla"): entradas con página
  for(const tipo of ["Figura", "Tabla"]){
    const ref = new RegExp(`<w:p(?=[ >])(?:(?!<w:p[ >])[\\s\\S])*?TOC \\\\h \\\\z \\\\c (?:&quot;|")${tipo}(?:&quot;|")[\\s\\S]*?</w:p>`);
    const m0 = doc.match(ref); if(!m0) continue;
    const i0 = doc.indexOf(m0[0]);
    const pFin = /fldCharType="end"/.test(m0[0]) ? i0 + m0[0].length : doc.indexOf("</w:p>", doc.indexOf('w:fldCharType="end"', i0 + m0[0].length)) + 6;
    const items = [];
    doc = doc.slice(0, i0) + "\u0000IDX\u0000" + doc.slice(pFin);
    doc = doc.replace(PARRAFO, p=>{
      if(!/<w:pStyle w:val="Descripci[oó]n"\/>/.test(p)) return p;
      const txt = textoXml(p).trim(); if(!txt.startsWith(tipo)) return p;
      const nombre = marca(); items.push(entrada("Tabladeilustraciones", r(txt), nombre)); return conMarca(p, nombre);
    });
    if(!items.length) items.push(`<w:p><w:pPr><w:pStyle w:val="Tabladeilustraciones"/></w:pPr></w:p>`);
    doc = doc.replace("\u0000IDX\u0000", items.join(""));
  }
  return doc;
}

/* Aplica el formato estándar a un .docx ya rellenado (zip de PizZip): carátula, encabezado y pie.
   Devuelve false si el documento no tiene la estructura esperada (se deja como está). */
export function formatoWord(zip, s, logos){
  const fDoc = "word/document.xml", fRels = "word/_rels/document.xml.rels", fCT = "[Content_Types].xml";
  if(!zip.file(fDoc) || !zip.file(fRels) || !zip.file(fCT)) return false;
  let doc = zip.file(fDoc).asText(), rels = zip.file(fRels).asText(), ct = zip.file(fCT).asText();
  const b0 = doc.indexOf("<w:body>"); if(b0 < 0) return false;
  const ib = doc.indexOf('w:type="page"', b0); if(ib < 0) return false;
  const fin = doc.indexOf("</w:p>", ib); if(fin < 0) return false;
  const d = datosCaratula(s), t = textosPagina(s);
  let nr = 0;
  const rel = (tipo, target)=>{ const id = "rIdIng"+(++nr); rels = rels.replace("</Relationships>", `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${tipo}" Target="${target}"/></Relationships>`); return id; };
  const parte = (nombre, tipo, xml)=>{
    zip.file("word/"+nombre, xml);
    if(!ct.includes(`PartName="/word/${nombre}"`)) ct = ct.replace("</Types>", `<Override PartName="/word/${nombre}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${tipo}+xml"/></Types>`);
    return rel(tipo, nombre);
  };
  // logos de la carátula
  const imgs = cajasLogos(logos).map((k, i)=>{
    const ext = /^data:image\/png/.test(k.dataURL) ? "png" : "jpeg";
    const nombre = `ingenia_logo_${i+1}.${ext}`;
    zip.file("word/media/"+nombre, k.dataURL.split(",")[1], { base64:true });
    if(!new RegExp(`Extension="${ext}"`, "i").test(ct)) ct = ct.replace("</Types>", `<Default Extension="${ext}" ContentType="image/${ext}"/></Types>`);
    return { xml: imagenWord(rel("image", "media/"+nombre), i, k.w, k.h, nombre) };
  });
  // ancho de texto de la primera sección (para la tabulación derecha de encabezado y pie)
  const pgW = +((doc.match(/<w:pgSz [^>]*w:w="(\d+)"/)||[])[1] || 11906);
  const mL = +((doc.match(/<w:pgMar [^>]*w:left="(\d+)"/)||[])[1] || 1701), mR = +((doc.match(/<w:pgMar [^>]*w:right="(\d+)"/)||[])[1] || 1701);
  const anchoTexto = pgW - mL - mR;
  IND = -Math.round((ANCHO_TW - anchoTexto)/2);
  const pgH = +((doc.match(/<w:pgSz [^>]*w:h="(\d+)"/)||[])[1] || 16838);
  const mT = +((doc.match(/<w:pgMar [^>]*w:top="(\d+)"/)||[])[1] || 1418), mF = +((doc.match(/<w:pgMar [^>]*w:footer="(\d+)"/)||[])[1] || 709);
  const altoUtil = (pgH - mT - mF)/20;
  // encabezado / pie de las páginas interiores y pie de la carátula (cuadro de revisiones y firmas)
  // (un par encabezado/pie por cada ancho de texto: las secciones horizontales alinean el texto a su propio margen)
  const pares = new Map();
  const parPara = ancho=>{
    if(pares.has(ancho)) return pares.get(ancho);
    const sufijo = pares.size ? "_"+(pares.size+1) : "";
    const hdr = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}>${parTab(run(t.izq, 8), run(t.der, 8, { b:true }), ancho)}</w:hdr>`;
    const ftr = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}>${parTab(run(t.pie, 8), run("Página ", 8)+campo("PAGE", 8)+run(" de ", 8)+campo("NUMPAGES", 8), ancho)}</w:ftr>`;
    const r = { h: parte(`header_ingenia${sufijo}.xml`, "header", hdr), f: parte(`footer_ingenia${sufijo}.xml`, "footer", ftr) };
    pares.set(ancho, r); return r;
  };
  const hdr1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}><w:p><w:pPr><w:spacing w:before="0" w:after="0"/>${rpr(2)}</w:pPr></w:p></w:hdr>`;
  const ftr1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}>${cuadroWord(d)}<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>${rpr(1)}</w:pPr></w:p></w:ftr>`;
  const rH1 = parte("header_ingenia_portada.xml", "header", hdr1), rF1 = parte("footer_ingenia_portada.xml", "footer", ftr1);
  // carátula: reemplaza la del formato (desde el inicio del cuerpo hasta el primer salto de página)
  doc = doc.slice(0, b0+8) + portadaWord(d, imgs, altoUtil) + doc.slice(fin+6);
  // secciones: la primera con primera página distinta (carátula sin encabezado ni pie), todas con el mismo encabezado / pie
  let k = 0;
  doc = doc.replace(/<w:sectPr\b([^>]*)>([\s\S]*?)<\/w:sectPr>/g, (m, at, cuerpo)=>{
    cuerpo = cuerpo.replace(/<w:(header|footer)Reference\b[^>]*\/>/g, "").replace(/<w:titlePg\b[^>]*\/>/g, "").replace(/<w:pgNumType\b[^>]*\/>/g, "");
    const w = +((cuerpo.match(/<w:pgSz [^>]*w:w="(\d+)"/)||[])[1] || pgW), l = +((cuerpo.match(/<w:pgMar [^>]*w:left="(\d+)"/)||[])[1] || mL), rr = +((cuerpo.match(/<w:pgMar [^>]*w:right="(\d+)"/)||[])[1] || mR);
    const { h:rH, f:rF } = parPara(w - l - rr);
    let refs = `<w:headerReference w:type="default" r:id="${rH}"/>`;
    if(k===0) refs += `<w:headerReference w:type="first" r:id="${rH1}"/>`;
    refs += `<w:footerReference w:type="default" r:id="${rF}"/>`;
    if(k===0) refs += `<w:footerReference w:type="first" r:id="${rF1}"/>`;
    if(k===0){ const i = cuerpo.search(/<w:(textDirection|bidi|rtlGutter|docGrid|printerSettings)\b/); cuerpo = i < 0 ? cuerpo + "<w:titlePg/>" : cuerpo.slice(0, i) + "<w:titlePg/>" + cuerpo.slice(i); }
    k++;
    return `<w:sectPr${at}>${refs}${cuerpo}</w:sectPr>`;
  });
  // páginas impares/pares iguales
  const fSet = "word/settings.xml";
  if(zip.file(fSet)){ const st = zip.file(fSet).asText(); if(/<w:evenAndOddHeaders\b/.test(st)) zip.file(fSet, st.replace(/<w:evenAndOddHeaders\b[^>]*\/>/g, "")); }
  // índice ordenado (ÍNDICE, niveles y páginas), títulos en negrita
  doc = indiceWord(zip, doc);
  zip.file(fDoc, doc); zip.file(fRels, rels); zip.file(fCT, ct);
  // estilos (títulos, listas con viñetas, índice) y todo el documento en Arial
  estilosWord(zip, anchoTexto);
  letraWord(zip);
  return true;
}

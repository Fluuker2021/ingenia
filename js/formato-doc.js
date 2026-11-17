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

/* encabezado / pie de página estándar, márgenes y numeración continua (la carátula es la página 1) */
export function encabezadoPieExcel(ws, s){
  const t = textosPagina(s);
  ws.headerFooter = {
    differentFirst:false, differentOddEven:false,
    oddHeader: `&L${fx(8)}${escHF(t.izq)}&R${fx(8, true)}${escHF(t.der)}`,
    oddFooter: `&L${fx(8)}${escHF(t.pie)}&R${fx(8)}Página &P de &N`,
    evenHeader:null, evenFooter:null, firstHeader:null, firstFooter:null,
  };
  const ps = ws.pageSetup || (ws.pageSetup = {});
  ps.margins = { left:0.59, right:0.59, top:0.79, bottom:0.79, header:0.31, footer:0.31 };
  ps.firstPageNumber = undefined;    // numeración continua entre hojas: «Página X de N» del documento completo
  ps.horizontalCentered = true; ps.verticalCentered = false;
  ps.paperSize = ps.paperSize || 9;
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
  zip.file(fDoc, doc); zip.file(fRels, rels); zip.file(fCT, ct);
  return true;
}

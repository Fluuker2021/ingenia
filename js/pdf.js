/* Ingenia — descarga de los documentos en PDF, generada en el navegador a partir del mismo archivo nativo:
   - Planos (DXF): vectorial, una lámina A1 por página, con los colores de capa de la vista previa.
   - Excel: vectorial, cada hoja con sus anchos, altos, combinaciones, bordes, rellenos, fuentes e imágenes,
     ajustada al ancho de la página y paginada por filas (repite las filas de título de impresión).
   - Word: cada página del documento (docx-preview) se dibuja en A4; las secciones largas se cortan en una línea en
     blanco y repiten su encabezado y su pie de página.
   Las librerías (jsPDF, JSZip, docx-preview, html2canvas) se cargan solo al pedir el primer PDF. */
import { parseDXF, colorCapa, rgbACI } from "./dxf.js";

const cargadas = {};
function script(src){
  if(!cargadas[src]) cargadas[src] = new Promise((res, rej)=>{
    const s = document.createElement("script"); s.src = src; s.onload = res;
    s.onerror = ()=>{ delete cargadas[src]; rej(new Error("No se pudo cargar " + src)); };
    document.head.appendChild(s);
  });
  return cargadas[src];
}
async function jsPDF(){ await script("vendor/jspdf-4.2.1.umd.min.js"); return window.jspdf.jsPDF; }

const hex = c => { const m = String(c||"").replace(/^#/, "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i); return m ? [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16)] : [0,0,0]; };

/* ======================= planos ======================= */
const LAMINA = { w:841, h:594, paso:1000 };     // láminas A1 lado a lado cada 1000 mm (como en la vista previa)
const TRAZOS = /DASH|HIDDEN|OCULT|CENTER|EJE|PHANTOM|TRAZ/i;
export async function pdfPlano(dxf, hojas=1){
  const PDF = await jsPDF();
  const d = parseDXF(dxf);
  const doc = new PDF({ orientation:"landscape", unit:"mm", format:[LAMINA.h, LAMINA.w], compress:true });
  doc.setFont("helvetica", "normal"); doc.setLineCap("round"); doc.setLineJoin("round");
  const ancla = e => e.t==="L" ? Math.min(e.x1, e.x2) : (e.t==="C" || e.t==="A") ? e.cx : (e.t==="P" || e.t==="S") ? Math.min(...e.pts.map(p=>p[0])) : e.x;
  for(let h=0; h<hojas; h++){
    if(h) doc.addPage([LAMINA.h, LAMINA.w], "landscape");
    const ox = h*LAMINA.paso, X = x=>x - ox, Y = y=>LAMINA.h - y;
    let colorAct = null, trazoAct = null;
    const pluma = e => {
      const c = colorCapa(e.layer); if(c!==colorAct){ const [r, g, b] = hex(c); doc.setDrawColor(r, g, b); doc.setFillColor(r, g, b); doc.setTextColor(r, g, b); colorAct = c; }
      const lt = e.lt || ((d.layers[e.layer]||{}).ltype) || "";
      const tr = TRAZOS.test(lt); if(tr!==trazoAct){ doc.setLineDashPattern(tr ? [2.4, 1.2] : [], 0); trazoAct = tr; }
    };
    doc.setLineWidth(0.18);
    for(const e of d.entities){
      const a = ancla(e); if(!(a >= ox - 20 && a <= ox + LAMINA.w + 20)) continue;
      pluma(e);
      if(e.t==="L") doc.line(X(e.x1), Y(e.y1), X(e.x2), Y(e.y2));
      else if(e.t==="C") doc.circle(X(e.cx), Y(e.cy), e.r, "S");
      else if(e.t==="A"){
        let a1 = e.a1, a2 = e.a2; while(a2 <= a1) a2 += 360;
        const n = Math.max(4, Math.ceil((a2 - a1)/6)); let px = null, py = null;
        for(let i=0; i<=n; i++){ const t = (a1 + (a2 - a1)*i/n)*Math.PI/180, x = X(e.cx + e.r*Math.cos(t)), y = Y(e.cy + e.r*Math.sin(t)); if(px!=null) doc.line(px, py, x, y); px = x; py = y; }
      }
      else if(e.t==="P"){ const pts = e.closed ? [...e.pts, e.pts[0]] : e.pts; for(let i=1; i<pts.length; i++) doc.line(X(pts[i-1][0]), Y(pts[i-1][1]), X(pts[i][0]), Y(pts[i][1])); }
      else if(e.t==="S"){ if(e.c>0 && e.c<256){ const [r, g, b] = rgbACI(e.c).match(/\d+/g).map(Number); doc.setFillColor(r, g, b); colorAct = null; } const q = [e.pts[0], e.pts[1], e.pts[3], e.pts[2]].map(p=>[X(p[0]), Y(p[1])]); doc.triangle(q[0][0], q[0][1], q[1][0], q[1][1], q[2][0], q[2][1], "F"); doc.triangle(q[0][0], q[0][1], q[2][0], q[2][1], q[3][0], q[3][1], "F"); }
      else if(e.t==="T" && e.text) textoPlano(doc, e, X, Y);
    }
  }
  return doc.output("arraybuffer");
}
function textoPlano(doc, e, X, Y){
  const txt = String(e.text).replace(/%%[uUoO]/g, "").replace(/%%%/g, "%");
  if(!txt.trim()) return;
  // la altura del texto DXF es la altura de las mayúsculas: el cuerpo de la fuente es ~1,39 veces mayor
  const pt = e.h/0.718*72/25.4; if(pt < 1) return;
  doc.setFontSize(pt);
  const k = e.wf>0 ? e.wf : 1, w = doc.getTextWidth(txt)*k;
  const ha = e.align===1 || e.align===4 ? 0.5 : e.align===2 ? 1 : 0;
  const dv = e.valign===3 ? -e.h : (e.valign===2 || e.align===4) ? -e.h/2 : e.valign===1 ? e.h*0.22 : 0;
  const t = (e.rot||0)*Math.PI/180, c = Math.cos(t), s = Math.sin(t), du = -w*ha;
  const x = e.x + du*c - dv*s, y = e.y + du*s + dv*c;
  doc.text(txt, X(x), Y(y), { angle: e.rot||0, horizontalScale: k, baseline:"alphabetic" });
}

/* ======================= Excel ======================= */
const TEMA = ["FFFFFF","000000","E7E6E6","44546A","4472C4","ED7D31","A5A5A5","FFC000","5B9BD5","70AD47"];
const PAPEL = { 8:[297, 420], 9:[210, 297], 1:[215.9, 279.4], 5:[215.9, 355.6] };
function argb(c, def){
  if(!c) return def;
  if(c.argb){ const v = String(c.argb); return v.length===8 ? v.slice(2) : v; }
  if(c.theme!=null) return TEMA[c.theme] || def;
  if(c.indexed!=null) return c.indexed===64 ? def : ({ 8:"000000", 9:"FFFFFF", 10:"FF0000", 12:"0000FF", 13:"FFFF00", 22:"C0C0C0", 23:"808080" }[c.indexed] || def);
  return def;
}
const GROSOR = { hair:0.08, thin:0.15, dotted:0.15, dashed:0.15, dashDot:0.15, dashDotDot:0.15, medium:0.35, mediumDashed:0.35, mediumDashDot:0.35, mediumDashDotDot:0.35, slantDashDot:0.35, thick:0.55, double:0.3 };
function valorTexto(cell){
  let v = cell.value;
  if(v==null) return "";
  if(typeof v==="object" && !(v instanceof Date)){
    if(v.richText) return v.richText.map(r=>r.text).join("");
    if("result" in v || "formula" in v || "sharedFormula" in v) v = v.result;
    else if(v.text!=null) return String(v.text);
    else if(v.error) return String(v.error);
  }
  if(v==null) return "";
  if(v instanceof Date){ const p = n=>String(n).padStart(2, "0"); return `${p(v.getUTCDate())}/${p(v.getUTCMonth()+1)}/${v.getUTCFullYear()}`; }
  if(typeof v==="number") return numero(v, cell.numFmt);
  if(typeof v==="boolean") return v ? "VERDADERO" : "FALSO";
  return String(v);
}
function numero(v, fmt){
  const f = String(fmt||"General").split(";")[0];
  if(/^General$/i.test(f) || !/[0#]/.test(f)){ return String(Math.round(v*1e10)/1e10); }
  const pct = /%/.test(f), dec = ((f.match(/\.([0#]+)/)||[])[1]||"").length, miles = /#,##|0,0/.test(f);
  let n = pct ? v*100 : v;
  let s = n.toFixed(dec);
  if(miles){ const [e, d] = s.split("."); s = e.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (d ? "." + d : ""); }
  return s + (pct ? "%" : "");
}
const colMm = w => (Math.trunc(((256*w + Math.trunc(128/7))/256)*7))*25.4/96;   // ancho de columna (caracteres) → mm
const ptMm = 25.4/72;
function rangoUsado(ws){
  const pa = ws.pageSetup && ws.pageSetup.printArea;
  const m = pa && String(pa).split(",")[0].replace(/\$/g, "").match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  const col = s => s.split("").reduce((n, ch)=>n*26 + ch.charCodeAt(0) - 64, 0);
  const area = m ? { r1:+m[2], c1:col(m[1]), r2:+m[4], c2:col(m[3]) } : null;
  // última fila y columna con contenido (dentro del área de impresión, si la hay): las vacías del final no se imprimen
  let r2 = 0, c2 = 0;
  ws.eachRow({ includeEmpty:false }, (row, r)=>{ if(area && (r < area.r1 || r > area.r2)) return; row.eachCell({ includeEmpty:false }, (cell, c)=>{
    if(area && (c < area.c1 || c > area.c2)) return;
    const conTexto = valorTexto(cell)!=="", conBorde = cell.border && Object.values(cell.border).some(b=>b && b.style), conFondo = cell.fill && cell.fill.type==="pattern" && cell.fill.pattern==="solid";
    if(conTexto || conBorde || conFondo){ r2 = Math.max(r2, r); c2 = Math.max(c2, c); } }); });
  for(const im of ws.getImages()){ const br = im.range.br; if(br){ r2 = Math.max(r2, Math.ceil(br.row)); c2 = Math.max(c2, Math.ceil(br.col)); } }
  if(area) return { r1:area.r1, c1:area.c1, r2:Math.max(area.r1, Math.min(area.r2, r2 + 1)), c2:Math.max(area.c1, Math.min(area.c2, c2)) };
  return { r1:1, c1:1, r2:Math.max(1, r2), c2:Math.max(1, c2) };
}
function filasTitulo(ws){
  const t = ws.pageSetup && ws.pageSetup.printTitlesRow; const m = t && String(t).replace(/\$/g, "").match(/^(\d+):(\d+)$/);
  return m ? [+m[1], +m[2]] : null;
}
export async function pdfExcel(buffer){
  const PDF = await jsPDF();
  const wb = new window.ExcelJS.Workbook(); await wb.xlsx.load(buffer);
  let doc = null;
  const paginasHF = [];   // encabezado y pie de cada página (los del Excel), para dibujarlos al final con «Página X de N»
  for(const ws of wb.worksheets){
    if(ws.state && ws.state!=="visible") continue;
    const R = rangoUsado(ws);
    const ps = ws.pageSetup || {}, apaisado = ps.orientation!=="portrait";
    const papel = PAPEL[ps.paperSize] || PAPEL[9];
    const [PW, PH] = apaisado ? [papel[1], papel[0]] : papel;
    const mg = ps.margins || {}, M = { l:Math.max(6, (mg.left??0.4)*25.4), r:Math.max(6, (mg.right??0.4)*25.4), t:Math.max(6, (mg.top??0.5)*25.4), b:Math.max(6, (mg.bottom??0.5)*25.4) };
    // geometría de columnas y filas (mm, sin escalar)
    const defW = (ws.properties && ws.properties.defaultColWidth) || 9.140625, defH = (ws.properties && ws.properties.defaultRowHeight) || 15;
    const cw = [], rh = [];
    for(let c=R.c1; c<=R.c2; c++){ const col = ws.getColumn(c); cw[c] = col.hidden ? 0 : colMm(col.width || defW); }
    for(let r=R.r1; r<=R.r2; r++){ const row = ws.getRow(r); rh[r] = row.hidden ? 0 : (row.height || defH)*ptMm; }
    const anchoTot = cw.slice(R.c1).reduce((a, b)=>a + (b||0), 0), altoTot = rh.slice(R.r1).reduce((a, b)=>a + (b||0), 0);
    // escala: ajustada al ancho de la página; «ajustar a 1 página de alto» se respeta si no deja el texto ilegible
    const kW = Math.min(1, (PW - M.l - M.r)/anchoTot), kH = (PH - M.t - M.b)/altoTot;
    const k = ps.fitToPage && ps.fitToHeight===1 && kH < kW && kH >= kW*0.55 ? kH : kW;
    const altoUtil = (PH - M.t - M.b)/k + 0.01;
    const dx = ps.horizontalCentered ? Math.max(0, (PW - M.l - M.r - anchoTot*k)/2) : 0;
    // páginas por filas (repitiendo las filas de título)
    const tit = filasTitulo(ws), paginas = [];
    let cur = [], h = 0;
    const altoTit = tit ? (()=>{ let s = 0; for(let r=tit[0]; r<=tit[1]; r++) s += rh[r]||0; return s; })() : 0;
    for(let r=R.r1; r<=R.r2; r++){
      const hr = rh[r]||0;
      if(cur.length && h + hr > altoUtil){ paginas.push(cur); cur = []; h = 0; if(tit && r > tit[1]){ for(let t=tit[0]; t<=tit[1]; t++) cur.push(t); h = altoTit; } }
      cur.push(r); h += hr;
    }
    if(cur.length) paginas.push(cur);
    // combinaciones
    const merges = Object.values(ws._merges||{}).map(m=>m.model || m).map(m=>({ r1:m.top, c1:m.left, r2:m.bottom, c2:m.right }));
    const mergeDe = (r, c)=>merges.find(m=>r>=m.r1 && r<=m.r2 && c>=m.c1 && c<=m.c2);
    const xCol = []; { let x = 0; for(let c=R.c1; c<=R.c2; c++){ xCol[c] = x; x += cw[c]; } xCol[R.c2+1] = x; }
    const imagenes = ws.getImages().map(im=>{ const img = wb.getImage(+im.imageId); return img ? { im, img } : null; }).filter(Boolean);
    for(const filas of paginas){
      if(!doc) doc = new PDF({ orientation: apaisado ? "landscape" : "portrait", unit:"mm", format:[Math.min(PW, PH), Math.max(PW, PH)], compress:true });
      else doc.addPage([Math.min(PW, PH), Math.max(PW, PH)], apaisado ? "landscape" : "portrait");
      paginasHF.push({ hf: ws.headerFooter || {}, PW, PH, M, mg });
      const yFila = {}; { let y = 0; for(const r of filas){ yFila[r] = y; y += rh[r]||0; } }
      const X = x=>M.l + dx + x*k, Y = y=>M.t + y*k;
      const enPag = new Set(filas);
      // 1) rellenos
      for(const r of filas){ if(!rh[r]) continue; for(let c=R.c1; c<=R.c2; c++){
        const m = mergeDe(r, c); if(m && (m.r1!==r || m.c1!==c) && enPag.has(m.r1)) continue;
        const cell = ws.getCell(r, c), f = cell.fill; if(!f || f.type!=="pattern" || f.pattern!=="solid") continue;
        const [x0, x1] = m ? [xCol[m.c1], xCol[Math.min(m.c2, R.c2)+1]] : [xCol[c], xCol[c+1]];
        let y1 = yFila[r] + rh[r]; if(m){ for(let rr=r+1; rr<=m.r2; rr++) if(enPag.has(rr)) y1 = yFila[rr] + (rh[rr]||0); }
        const [cr, cg, cb] = hex(argb(f.fgColor, "FFFFFF")); doc.setFillColor(cr, cg, cb);
        doc.rect(X(x0), Y(yFila[r]), (x1 - x0)*k, (y1 - yFila[r])*k, "F");
      } }
      // 2) imágenes (logos)
      for(const { im, img } of imagenes){
        const tl = im.range.tl, br = im.range.br;
        const pos = (a, col)=>{ const i = Math.floor(col ? a.col : a.row), fr = (col ? a.col : a.row) - i; return col ? [i+1, fr] : [i+1, fr]; };
        // ancla nativa (columna / fila + desplazamiento en EMU) si existe: la fracción que calcula ExcelJS (tl.col) es
        // inexacta en columnas angostas y corría los logos
        const nat = tl.nativeCol!=null && tl.nativeColOff!=null;
        const [c0, fc0] = nat ? [tl.nativeCol + 1, 0] : pos(tl, true), [r0, fr0] = nat ? [tl.nativeRow + 1, 0] : pos(tl, false);
        if(!enPag.has(r0) || c0 < R.c1 || c0 > R.c2) continue;
        const mmEMU = 25.4/914400;
        const x0 = xCol[c0] + (nat ? Math.min(tl.nativeColOff*mmEMU, cw[c0]||0) : fc0*(cw[c0]||0)), y0 = yFila[r0] + (nat ? Math.min(tl.nativeRowOff*mmEMU, rh[r0]||0) : fr0*(rh[r0]||0));
        let w, hh;
        if(im.range.ext){ w = im.range.ext.width*25.4/96; hh = im.range.ext.height*25.4/96; }
        else if(br){ const [c1, fc1] = pos(br, true), [r1, fr1] = pos(br, false); w = (xCol[Math.min(c1, R.c2+1)] ?? xCol[R.c2+1]) + fc1*(cw[c1]||0) - x0; hh = (yFila[r1] ?? yFila[r0]) + fr1*(rh[r1]||0) - y0; }
        else continue;
        const tipo = String(img.extension||"png").toUpperCase().replace("JPG", "JPEG");
        const datos = img.base64 ? (img.base64.startsWith("data:") ? img.base64 : `data:image/${img.extension};base64,${img.base64}`) : new Uint8Array(img.buffer);
        try{ doc.addImage(datos, tipo, X(x0), Y(y0), w*k, hh*k); }catch(e){ /* imagen no admitida */ }
      }
      // 3) textos
      for(const r of filas){ if(!rh[r]) continue; for(let c=R.c1; c<=R.c2; c++){
        const m = mergeDe(r, c); if(m && (m.r1!==r || m.c1!==c)) continue;
        const cell = ws.getCell(r, c), txt = valorTexto(cell); if(!txt) continue;
        const [x0, x1] = m ? [xCol[m.c1], xCol[Math.min(m.c2, R.c2)+1]] : [xCol[c], xCol[c+1]];
        let y1 = yFila[r] + rh[r]; if(m){ for(let rr=r+1; rr<=m.r2; rr++) if(enPag.has(rr)) y1 = yFila[rr] + (rh[rr]||0); }
        textoCelda(doc, cell, txt, X(x0), Y(yFila[r]), (x1 - x0)*k, (y1 - yFila[r])*k, k);
      } }
      // 4) bordes
      doc.setLineDashPattern([], 0);
      for(const r of filas){ if(!rh[r]) continue; for(let c=R.c1; c<=R.c2; c++){
        const b = ws.getCell(r, c).border; if(!b) continue;
        const x0 = X(xCol[c]), x1 = X(xCol[c+1]), y0 = Y(yFila[r]), y1 = Y(yFila[r] + rh[r]);
        // en una combinación solo se dibuja su contorno (como en Excel)
        const m = mergeDe(r, c), interno = { top: m && r>m.r1, bottom: m && r<m.r2, left: m && c>m.c1, right: m && c<m.c2 };
        for(const [lado, ax, ay, bx, by] of [["top", x0, y0, x1, y0], ["bottom", x0, y1, x1, y1], ["left", x0, y0, x0, y1], ["right", x1, y0, x1, y1]]){
          const s = b[lado]; if(!s || !s.style || interno[lado]) continue;
          const [cr, cg, cb] = hex(argb(s.color, "000000")); doc.setDrawColor(cr, cg, cb); doc.setLineWidth(GROSOR[s.style] || 0.15);
          doc.line(ax, ay, bx, by);
        }
      } }
    }
  }
  if(!doc) doc = new PDF();
  encabezadosYPies(doc, paginasHF);
  return doc.output("arraybuffer");
}
/* encabezado y pie de página del Excel («Documento elaborado por … · Página X de N»): la primera página (carátula) no
   lleva nada; desde la segunda, con la numeración del documento completo */
function seccionesHF(t){
  const out = { L:[], C:[], R:[] }; let cur = "C";
  const limpio = String(t||"").replace(/&"[^"]*"/g, "").replace(/&K[0-9A-Fa-f]{6}/g, "").replace(/&\d+/g, "");
  const re = /&([LCR])/g; let i = 0, m;
  const push = txt => { if(txt) out[cur].push(txt); };
  while((m = re.exec(limpio))){ push(limpio.slice(i, m.index)); cur = m[1]; i = re.lastIndex; }
  push(limpio.slice(i));
  const r = {}; for(const k of ["L","C","R"]){ const x = out[k].join(""); r[k] = { bold:/&B/.test(x), txt: x.replace(/&[BIUS]/g, "") }; }
  return r;
}
function encabezadosYPies(doc, paginas){
  const N = doc.getNumberOfPages();
  for(let i = 2; i <= N; i++){
    const pg = paginas[i-1]; if(!pg) continue;
    doc.setPage(i);
    const n = t => t.replace(/&P/g, String(i)).replace(/&N/g, String(N)).replace(/&&/g, "&").trim();
    const hdr = (pg.mg.header ?? 0.31)*25.4, ftr = (pg.mg.footer ?? 0.31)*25.4;
    for(const [clave, y] of [["oddHeader", hdr + 3], ["oddFooter", pg.PH - ftr - 1]]){
      const sec = seccionesHF(pg.hf[clave]);
      for(const [k, x, al] of [["L", pg.M.l, "left"], ["C", pg.PW/2, "center"], ["R", pg.PW - pg.M.r, "right"]]){
        const t = n(sec[k].txt); if(!t) continue;
        doc.setFont("helvetica", sec[k].bold ? "bold" : "normal"); doc.setFontSize(8); doc.setTextColor(23, 25, 29);
        doc.text(t, x, y, { align: al });
      }
    }
  }
}
function textoCelda(doc, cell, txt, x, y, w, h, k){
  const f = cell.font || {}, al = cell.alignment || {};
  const pt = (f.size || 11)*k;
  doc.setFont("helvetica", f.bold && f.italic ? "bolditalic" : f.bold ? "bold" : f.italic ? "italic" : "normal");
  doc.setFontSize(pt);
  const [cr, cg, cb] = hex(argb(f.color, "000000")); doc.setTextColor(cr, cg, cb);
  const pad = 0.6*k + 0.3, esNum = typeof (cell.value && cell.value.result!==undefined ? cell.value.result : cell.value)==="number";
  const hal = al.horizontal || (esNum ? "right" : "left");
  const rot = al.textRotation===90 || al.textRotation===180 ? 90 : 0;
  const lineH = pt*ptMm*1.15;
  if(rot){
    const lineas = doc.splitTextToSize(txt, Math.max(1, h - 2*pad));
    const xs = x + w/2 + (lineas.length*lineH)/2 - lineH*0.25;
    lineas.forEach((l, i)=>{ const tw = doc.getTextWidth(l); doc.text(l, xs - (lineas.length - 1 - i)*lineH, y + h/2 + tw/2, { angle:90 }); });
    return;
  }
  const lineas = al.wrapText || txt.includes("\n") ? txt.split("\n").flatMap(l=>doc.splitTextToSize(l, Math.max(1, w - 2*pad))) : [txt];
  const altoTxt = lineas.length*lineH;
  const val = al.vertical || "bottom";
  let yb = val==="top" ? y + pad + lineH*0.8 : val==="middle" || val==="center" ? y + (h - altoTxt)/2 + lineH*0.8 : y + h - pad - altoTxt + lineH*0.8;
  for(const l of lineas){
    const tw = doc.getTextWidth(l);
    const xx = hal==="center" || hal==="centerContinuous" || hal==="distributed" ? x + (w - tw)/2 : hal==="right" ? x + w - pad - tw : x + pad + (al.indent||0)*1.5*k;
    doc.text(l, xx, yb); yb += lineH;
  }
}

/* ======================= Word ======================= */
async function html2canvas(){ await script("vendor/html2canvas-1.4.1.min.js"); return window.html2canvas; }
async function docxPreview(){ await script("vendor/jszip-3.10.1.min.js"); await script("vendor/docx-preview-0.4.1.min.js"); return window.docx; }
/* Word → HTML con el visor (docx-preview) en el contenedor host, con los arreglos para que se vea como en Word */
export async function renderWord(buffer, host){
  const docx = await docxPreview();
  // ecuaciones: el visor necesita las propiedades de cada delimitador (<m:dPr>) aunque Word las omita
  const zip = await window.JSZip.loadAsync(buffer);
  for(const n of Object.keys(zip.files).filter(n=>/^word\/(document|header\d*|footer\d*)\.xml$/.test(n))){
    const xml = await zip.file(n).async("string");
    if(/<m:d>(?!\s*<m:dPr)/.test(xml)) zip.file(n, xml.replace(/<m:d>(?!\s*<m:dPr)/g, "<m:d><m:dPr/>"));
  }
  // viñetas con caracteres de las fuentes Symbol / Wingdings (área privada de Unicode): el navegador no las dibuja; se
  // cambian por «•» y «▪» en Arial, como se ven en Word
  if(zip.file("word/numbering.xml")){
    let xml = await zip.file("word/numbering.xml").async("string");
    xml = xml.replace(/<w:lvlText w:val="\uf0b7"\/>/g, '<w:lvlText w:val="•"/>').replace(/<w:lvlText w:val="\uf0a7"\/>/g, '<w:lvlText w:val="▪"/>')
      .replace(/<w:rFonts w:ascii="(Symbol|Wingdings)" w:hAnsi="(Symbol|Wingdings)"( w:hint="default")?\/>/g, '<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>');
    zip.file("word/numbering.xml", xml);
  }
  buffer = await zip.generateAsync({ type:"arraybuffer" });
  await docx.renderAsync(new Blob([buffer]), host, host, { className:"docx", inWrapper:false, breakPages:true, renderHeaders:true, renderFooters:true, ignoreLastRenderedPageBreak:true, useBase64URL:true, experimental:true });
  // sin guiones automáticos del navegador (Word no los usa y la captura los dibuja mal)
  const est = document.createElement("style"); est.textContent = "section.docx, section.docx *{ hyphens:manual !important; -webkit-hyphens:manual !important; }"; host.appendChild(est);
  // el visor calcula los tabuladores (encabezado, pie e índice) medio segundo después de dibujar: se espera a que termine
  // antes de reordenar el índice (si no, su cálculo falla y el encabezado y el pie quedan sin tabular)
  await new Promise(r=>setTimeout(r, 650));
  arreglarNumeracion(host);
  arreglarIndice(host);
  await (document.fonts ? document.fonts.ready : Promise.resolve());
  return host;
}
/* listas numeradas y con viñetas: el visor separa el número del texto con un tabulador dentro de «::before», que se
   dibuja como un espacio; el número (o la viñeta) ocupa la sangría francesa, así el texto queda alineado como en Word */
function arreglarNumeracion(host){
  // reglas del visor: estilos de párrafo con sangría, contenido y contadores de cada nivel de numeración
  const estilo = {}, contenido = {}, incremento = {}, fija = {}, inicial = {}, antes = {};
  const pares = t => { const out = []; const tk = String(t||"").trim().split(/\s+/); for(let i=0; i<tk.length; i++){ if(!tk[i] || tk[i]==="none") continue; const n = tk[i], v = /^-?\d+$/.test(tk[i+1]||"") ? +tk[++i] : null; out.push([n, v]); } return out; };
  for(const st of host.querySelectorAll("style")){ let rs; try{ rs = st.sheet && st.sheet.cssRules; }catch(e){ rs = null; } if(!rs) continue;
    for(const r of rs){ const sel = r.selectorText||"";
      const me = /^p\.(docx_[\w-]+)$/.exec(sel); if(me && r.style.marginInlineStart) estilo[me[1]] = { mis: r.style.marginInlineStart, ti: r.style.textIndent || "0pt" };
      const mb = /^p\.(docx-num-\d+-\d+)::?before$/.exec(sel);
      if(mb){ contenido[mb[1]] = r.style.content; incremento[mb[1]] = pares(r.style.counterIncrement); antes[mb[1]] = { fontFamily:r.style.fontFamily, fontWeight:r.style.fontWeight, color:r.style.color, fontSize:r.style.fontSize }; }
      const mn = /^p\.(docx-num-\d+-\d+)$/.exec(sel); if(mn && r.style.counterSet) fija[mn[1]] = (fija[mn[1]]||[]).concat(pares(r.style.counterSet));
      if(sel===":root" && r.style.counterReset) for(const [n, v] of pares(r.style.counterReset)) inicial[n] = v || 0; } }
  if(!Object.keys(contenido).length) return;
  // los números se calculan aquí (la captura no aplica «counter-set» y los subtítulos seguían la cuenta: 5.3 en vez de
  // 5.1) y se escriben como texto en la sangría francesa; la viñeta o el número ocupa la sangría, como en Word
  const fmt = (n, tipo) => { tipo = tipo || "decimal";
    if(/alpha|latin/.test(tipo)){ let s = "", x = n; while(x > 0){ x--; s = String.fromCharCode(97 + x%26) + s; x = Math.floor(x/26); } return /upper/.test(tipo) ? s.toUpperCase() : s; }
    if(/roman/.test(tipo)){ const R = [[1000,"m"],[900,"cm"],[500,"d"],[400,"cd"],[100,"c"],[90,"xc"],[50,"l"],[40,"xl"],[10,"x"],[9,"ix"],[5,"v"],[4,"iv"],[1,"i"]]; let s = "", x = n; for(const [v, l] of R) while(x >= v){ s += l; x -= v; } return /upper/.test(tipo) ? s.toUpperCase() : s; }
    if(tipo==="decimal-leading-zero") return String(n).padStart(2, "0");
    return String(n); };
  const val = Object.assign({}, inicial);
  const texto = c => { let out = ""; const re = /"((?:[^"\\]|\\.)*)"|counter\(\s*([\w-]+)\s*(?:,\s*([\w-]+))?\s*\)/g; let m;
    while((m = re.exec(c||""))){ if(m[2]) out += fmt(val[m[2]] || 0, m[3]);
      else out += m[1].replace(/\\([0-9a-fA-F]{1,6})\s?/g, (x, h)=>String.fromCodePoint(parseInt(h, 16))).replace(/\\(.)/g, "$1"); }
    return out.replace(/\t/g, "").trim(); };
  const css = document.createElement("style"); css.textContent = "section.docx p.num-docx::before{ content:none !important; }"; host.appendChild(css);
  for(const p of host.querySelectorAll("p[class*='docx-num-']")){
    const cls = [...p.classList].find(c=>contenido[c]!=null); if(!cls) continue;
    for(const [n, v] of fija[cls]||[]) val[n] = v || 0;
    for(const [n, v] of incremento[cls]||[]) val[n] = (val[n]||0) + (v==null ? 1 : v);
    const t = texto(contenido[cls]);
    // sangría: cuando la lista viene del estilo de párrafo (p. ej. «Párrafo de lista»), en Word manda la del estilo
    const est = [...p.classList].map(c=>estilo[c]).find(Boolean);
    if(est){ p.style.marginInlineStart = est.mis; p.style.textIndent = est.ti; }
    p.classList.add("num-docx");
    if(!t) continue;
    const ti = parseFloat(getComputedStyle(p).textIndent) || 0, ref = p.querySelector("span:not(:empty)") || p, cs = getComputedStyle(ref), a = antes[cls] || {};
    const sp = document.createElement("span"); sp.textContent = t;
    sp.style.cssText = `display:inline-block; min-width:${Math.max(0, -ti)}px; padding-right:4pt; box-sizing:border-box; text-indent:0; white-space:nowrap;`;
    sp.style.fontFamily = a.fontFamily || cs.fontFamily; sp.style.fontWeight = a.fontWeight || cs.fontWeight; sp.style.fontSize = a.fontSize || cs.fontSize; sp.style.color = a.color || cs.color;
    p.insertBefore(sp, p.firstChild);
  }
}
/* índice (párrafos «TDC1…TDC9»): número, título y página con los tabuladores de Word (página alineada a la derecha y
   puntos de relleno); el visor no aplica los tabuladores del estilo y el índice quedaba desalineado */
function arreglarIndice(host){
  const ps = [...host.querySelectorAll("p")].filter(p=>/\bdocx_(tdc|toc)\d\b|\bdocx_tabladeilustraciones\b|\bdocx_tableoffigures\b/i.test(p.className));
  for(const p of ps){
    const cont = p.querySelector(":scope > a") || p;
    // los tramos separados por tabuladores: [número, título, página] (o [título, página])
    const tramos = [[]];
    for(const n of [...cont.childNodes]){ if(n.nodeType===1 && n.querySelector && (n.classList.contains("docx-tab-stop") || n.querySelector(".docx-tab-stop"))) tramos.push([]); else tramos[tramos.length-1].push(n); }
    if(tramos.length < 2) continue;
    const cs = getComputedStyle(p), sang = Math.max(0, -parseFloat(cs.textIndent)||0);
    const pag = tramos.pop(), num = tramos.length > 1 ? tramos.shift() : [], tit = tramos.flat();
    const caja = (nodos, estilo) => { const sp = document.createElement("span"); sp.style.cssText = estilo; nodos.forEach(n=>sp.appendChild(n)); return sp; };
    const fila = document.createElement("span");
    fila.style.cssText = "display:flex; align-items:baseline; width:100%;";
    if(num.length) fila.appendChild(caja(num, `flex:0 0 ${sang}px; white-space:nowrap;`));
    fila.appendChild(caja(tit, "flex:0 1 auto;"));
    const pts = document.createElement("span"); pts.style.cssText = "flex:1 1 0; min-width:12px; overflow:hidden; white-space:nowrap; margin:0 2px; text-transform:none; font-weight:normal;"; pts.textContent = ".".repeat(400);
    fila.appendChild(pts);
    fila.appendChild(caja(pag, "flex:0 0 auto; white-space:nowrap;"));
    // el número va en la sangría francesa: el párrafo empieza donde empieza el número
    p.style.textIndent = "0"; p.style.marginInlineStart = `${Math.max(0, (parseFloat(cs.marginInlineStart)||0) - (num.length ? sang : 0))}px`;
    cont.innerHTML = ""; cont.appendChild(fila);
    if(cont!==p){ cont.style.display = "block"; cont.style.textDecoration = "none"; cont.style.color = "inherit"; }
  }
}
export async function pdfWord(buffer){
  const [PDF, h2c] = await Promise.all([jsPDF(), html2canvas()]);
  const host = document.createElement("div");
  host.style.cssText = "position:fixed; left:-20000px; top:0; background:#fff; z-index:-1;";
  document.body.appendChild(host);
  try{
    await renderWord(buffer, host);
    await ecuacionesComoImagen(host);
    const ESC = 2, pxMm = 25.4/96;          // 2 píxeles por píxel CSS ≈ 192 ppp
    const secciones = [...host.querySelectorAll("section.docx")];
    const rel = (el, sec)=>{ const a = el.getBoundingClientRect(), b = sec.getBoundingClientRect(); return { x:a.left - b.left, y:a.top - b.top, w:a.width, h:a.height }; };
    // tablas con sangría negativa (p. ej. la carátula): el visor no la aplica y la tabla sale de la hoja; se centran
    // (y las que son más anchas que el área de texto: en Word salen centradas en la hoja con su sangría negativa)
    for(const sec of secciones){
      const W = sec.offsetWidth, cs = getComputedStyle(sec), util = W - (parseFloat(cs.paddingLeft)||0) - (parseFloat(cs.paddingRight)||0);
      for(const t of [...sec.querySelectorAll("table")].filter(t=>!t.parentElement.closest("table"))){   // tablas de primer nivel (cuerpo, encabezado y pie)
        const r = rel(t, sec);
        if((r.x + r.w > W - 2 || r.w > util + 2) && r.w < W){ const izq = (W - r.w)/2; t.style.marginLeft = `${(parseFloat(getComputedStyle(t).marginLeft)||0) + izq - r.x}px`; }
      }
    }
    // 1) plan de páginas: cada sección entra en una hoja o su cuerpo se corta en líneas en blanco
    const plan = [];
    for(const sec of secciones){
      const W = sec.offsetWidth, Hpag = parseFloat(sec.style.minHeight) ? parseFloat(sec.style.minHeight)*96/72 : W*297/210;
      const pag = { sec, W, Hpag };
      if(sec.offsetHeight <= Hpag + 2){ plan.push(Object.assign({ entera:true }, pag)); continue; }
      const cuerpo = sec.querySelector(":scope > article") || sec, cab = sec.querySelector(":scope > header"), pie = sec.querySelector(":scope > footer");
      const cs = getComputedStyle(sec), padT = parseFloat(cs.paddingTop)||0, padB = parseFloat(cs.paddingBottom)||0;
      const rc = rel(cuerpo, sec), yCuerpo = Math.max(padT, cab ? rel(cab, sec).y + cab.offsetHeight + 8 : padT);
      const util = Hpag - yCuerpo - Math.max(padB, pie ? pie.offsetHeight + 24 : 0);
      // se captura la sección completa (a todo el ancho: lo que el visor deje pasar del margen no se corta) y se toma la
      // franja del cuerpo; las secciones muy largas bajan la resolución para no pasar el alto máximo de un lienzo
      const esc = Math.min(ESC, 30000/sec.offsetHeight);
      const cv = await h2c(sec, { scale:esc, backgroundColor:"#ffffff", logging:false, useCORS:true });
      const ctx = cv.getContext("2d"), fin = Math.min(cv.height, Math.round((rc.y + rc.h)*esc));
      let y0 = Math.round(rc.y*esc);
      while(y0 < fin - 2){
        let y1 = Math.min(fin, y0 + Math.floor(util*esc));
        if(y1 < fin) y1 = corteEnBlanco(ctx, cv.width, y0, y1);
        plan.push(Object.assign({ cv, esc, y0, y1, cab, pie, yCuerpo, padB }, pag));
        y0 = y1;
      }
    }
    // 2) páginas, con «Página N de M» en el encabezado y el pie
    let doc = null;
    for(let i=0; i<plan.length; i++){
      const pg = plan[i], Wmm = pg.W*pxMm, Hmm = pg.Hpag*pxMm, orient = Wmm > Hmm ? "landscape" : "portrait", fmt = [Math.min(Wmm, Hmm), Math.max(Wmm, Hmm)];
      if(!doc) doc = new PDF({ orientation:orient, unit:"mm", format:fmt, compress:true }); else doc.addPage(fmt, orient);
      numerar(pg.sec, i + 1, plan.length);
      if(pg.entera){
        const cv = await h2c(pg.sec, { scale:ESC, backgroundColor:"#ffffff", logging:false, useCORS:true, height:pg.Hpag });
        doc.addImage(cv.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, Wmm, Hmm);
        continue;
      }
      const trozo = document.createElement("canvas"); trozo.width = pg.cv.width; trozo.height = pg.y1 - pg.y0;
      trozo.getContext("2d").drawImage(pg.cv, 0, pg.y0, pg.cv.width, pg.y1 - pg.y0, 0, 0, pg.cv.width, pg.y1 - pg.y0);
      doc.addImage(trozo.toDataURL("image/jpeg", 0.92), "JPEG", 0, pg.yCuerpo*pxMm, Wmm, (pg.y1 - pg.y0)/pg.esc*pxMm);
      if(pg.cab){ const r = rel(pg.cab, pg.sec), cv = await h2c(pg.cab, { scale:ESC, backgroundColor:"#ffffff", logging:false }); doc.addImage(cv.toDataURL("image/jpeg", 0.92), "JPEG", r.x*pxMm, r.y*pxMm, r.w*pxMm, r.h*pxMm); }
      if(pg.pie){ const r = rel(pg.pie, pg.sec), cv = await h2c(pg.pie, { scale:ESC, backgroundColor:"#ffffff", logging:false }); doc.addImage(cv.toDataURL("image/jpeg", 0.92), "JPEG", r.x*pxMm, (pg.Hpag - Math.max(pg.padB*0.67, r.h + 8))*pxMm, r.w*pxMm, r.h*pxMm); }
    }
    if(!doc) doc = new PDF();
    return doc.output("arraybuffer");
  } finally { host.remove(); }
}
/* ecuaciones (MathML): html2canvas no las dibuja; cada una se reemplaza por su imagen (SVG con el MathML) del mismo tamaño */
async function ecuacionesComoImagen(host){
  for(const m of [...host.querySelectorAll("math")]){
    const r = m.getBoundingClientRect(), w = Math.ceil(r.width) + 2, h = Math.ceil(r.height) + 2;
    if(w < 3 || h < 3) continue;
    const cs = getComputedStyle(m.parentElement || m);
    const html = new XMLSerializer().serializeToString(m).replace(/^<math(?![^>]*xmlns=)/, '<math xmlns="http://www.w3.org/1998/Math/MathML"');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:${cs.fontFamily.replace(/"/g, "'")};font-size:${cs.fontSize};color:${cs.color};line-height:${cs.lineHeight}">${html}</div></foreignObject></svg>`;
    const src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    const img = await new Promise(res=>{ const i = new Image(); i.onload = ()=>res(i); i.onerror = ()=>res(null); i.src = src; });
    if(!img) continue;
    // a mapa de bits (2×): una imagen SVG con foreignObject no se puede pasar directamente al lienzo de la captura
    const cv = document.createElement("canvas"); cv.width = w*2; cv.height = h*2;
    const ctx = cv.getContext("2d"); ctx.scale(2, 2); ctx.drawImage(img, 0, 0);
    let url; try{ url = cv.toDataURL("image/png"); }catch(e){ continue; }
    const out = document.createElement("img"); out.src = url; out.style.cssText = `width:${w}px;height:${h}px;vertical-align:middle;display:${getComputedStyle(m).display==="block" ? "block" : "inline-block"};margin:${getComputedStyle(m).display==="block" ? "0 auto" : "0"}`;
    await new Promise(res=>{ out.onload = res; out.onerror = res; });
    m.replaceWith(out);
  }
}
/* «Página N de M» del encabezado y del pie (el visor deja el valor guardado en el campo, «1 de 1») */
function numerar(sec, n, total){
  for(const zona of sec.querySelectorAll(":scope > header, :scope > footer")){
    const nodos = []; const w = document.createTreeWalker(zona, NodeFilter.SHOW_TEXT); let t; while((t = w.nextNode())) nodos.push(t);
    const texto = nodos.map(x=>x.textContent).join("");
    const m = /(P[áa]gina\s*)(\d+)(\s*de\s*)(\d+)/i.exec(texto); if(!m) continue;
    const ini2 = m.index + m[1].length, ini4 = ini2 + m[2].length + m[3].length;
    let pos = 0;
    for(const x of nodos){
      const a = pos, b = pos + x.textContent.length;
      if(ini4 >= a && ini4 + m[4].length <= b) x.textContent = x.textContent.slice(0, ini4 - a) + total + x.textContent.slice(ini4 - a + m[4].length);
      if(ini2 >= a && ini2 + m[2].length <= b) x.textContent = x.textContent.slice(0, ini2 - a) + n + x.textContent.slice(ini2 - a + m[2].length);
      pos = b;
    }
  }
}
/* fila de píxeles (casi) en blanco más cercana por encima del corte (hasta un 20 % de la página), para no partir una línea */
function corteEnBlanco(ctx, w, y0, y1){
  const min = y0 + Math.floor((y1 - y0)*0.8);
  const datos = ctx.getImageData(0, min, w, y1 - min).data;
  // admite unos pocos píxeles oscuros: las líneas verticales de las tablas no impiden el corte entre filas de texto
  const tope = Math.max(2, Math.floor(w/2*0.015));
  for(let y = y1 - min - 1; y >= 0; y--){
    let oscuros = 0;
    for(let x=0; x<w; x+=2){ const i = (y*w + x)*4; if(datos[i] < 200 || datos[i+1] < 200 || datos[i+2] < 200){ if(++oscuros > tope) break; } }
    if(oscuros <= tope) return min + y + 1;
  }
  return y1;
}

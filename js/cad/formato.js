/* Ingenia — lámina de plano (formato de impresión + cajetín).
   Por defecto: formato ISO A1 (841×594 mm) tomado de los planos de referencia del usuario (marco con
   cuadrícula A–H / 1–5, tabla de revisiones, planos de referencia, bloque de aprobación del contratista y
   rótulo principal), con la marca del cliente retirada y los campos convertidos en datos del proyecto.
   Con plantillas del cliente: su formato y su cajetín DXF, rellenando los textos marcados {{…}}. */
import { DXF_BLOCKS, dxfTrunc, DXF_CAR } from "../engine/tablero-core.js";

/* los rótulos fijos de los bloques del cajetín no deben pasar a la celda vecina: si el texto (con el ancho real que
   tendrá en AutoCAD) llega a la línea vertical siguiente, se reduce su altura */
function ajustarRotulos(bloque){
  const v = bloque.filter(e=>e[0]==="L" && Math.abs(e[1]-e[3]) < 0.01).map(e=>({ x:e[1], y0:Math.min(e[2], e[4]), y1:Math.max(e[2], e[4]) }))
    .concat(bloque.filter(e=>e[0]==="P").flatMap(e=>{ const q = []; for(let i=2;i+3<e.length;i+=2) if(Math.abs(e[i]-e[i+2]) < 0.01) q.push({ x:e[i], y0:Math.min(e[i+1], e[i+3]), y1:Math.max(e[i+1], e[i+3]) }); return q; }));
  return bloque.map(e=>{
    if(e[0]!=="T" || e[4]) return e;
    const [, x, y, h, , txt] = e, n = String(txt||"").length; if(!n) return e;
    const der = v.filter(l=>l.x > x + 0.3 && l.y0 <= y + 0.2 && l.y1 >= y + h*0.6).reduce((a, l)=>Math.min(a, l.x), Infinity);
    if(!isFinite(der) || x + n*h*DXF_CAR <= der - 0.6) return e;
    const h2 = Math.max(1.2, (der - 0.8 - x)/(n*DXF_CAR));
    return ["T", x, y, h2, e[4], txt];
  });
}
/* ortografía de los rótulos fijos del formato */
const ORTOGRAFIA = [[/\bREVISION\b/g, "REVISIÓN"], [/\bVALIDACION\b/g, "VALIDACIÓN"], [/\bAPROBACION\b/g, "APROBACIÓN"], [/\bDISENADO\b/g, "DISEÑADO"],
  [/\bDISENO\b/g, "DISEÑO"], [/\bCHEKER\b/g, "CHECKER"], [/\bVALIDO\b/g, "VÁLIDO"], [/\bULTIMA\b/g, "ÚLTIMA"], [/\bESTE FIRMADA\b/g, "ESTÉ FIRMADA"],
  [/\bNO ESTA A ESCALA/g, "NO ESTÁ A ESCALA"], [/MIDE 25mm/g, "MIDE 25 mm"]];
const ortografia = b => b.map(e=>e[0]==="T" ? ["T", e[1], e[2], e[3], e[4], ORTOGRAFIA.reduce((t, [re, v])=>t.replace(re, v), String(e[5]||""))] : e);
/* rótulos de las tablas del cajetín centrados en su celda (líneas del propio bloque) */
function centrarRotulos(bloque, filtro = () => true){
  const v = [], h = [];
  for(const e of bloque){
    if(e[0]==="L"){ if(Math.abs(e[1]-e[3]) < 0.01) v.push([e[1], Math.min(e[2], e[4]), Math.max(e[2], e[4])]); else if(Math.abs(e[2]-e[4]) < 0.01) h.push([e[2], Math.min(e[1], e[3]), Math.max(e[1], e[3])]); }
    if(e[0]==="P") for(let i=2;i+3<e.length;i+=2){ const [x1, y1, x2, y2] = e.slice(i, i+4); if(Math.abs(x1-x2) < 0.01) v.push([x1, Math.min(y1, y2), Math.max(y1, y2)]); else if(Math.abs(y1-y2) < 0.01) h.push([y1, Math.min(x1, x2), Math.max(x1, x2)]); }
  }
  return bloque.map(e=>{
    if(e[0]!=="T" || e[4] || !filtro(e)) return e;
    const [, x, y, hh, , txt] = e, w = String(txt).length*hh*DXF_CAR, px = x + Math.min(w/2, 2), py = y + hh/2;
    const izq = v.filter(([vx, a, b])=>vx <= px + 0.01 && a <= py && b >= py).reduce((m, l)=>Math.max(m, l[0]), -Infinity);
    const der = v.filter(([vx, a, b])=>vx > px && a <= py && b >= py).reduce((m, l)=>Math.min(m, l[0]), Infinity);
    const aba = h.filter(([hy, a, b])=>hy <= py && a <= px && b >= px).reduce((m, l)=>Math.max(m, l[0]), -Infinity);
    const arr = h.filter(([hy, a, b])=>hy > py && a <= px && b >= px).reduce((m, l)=>Math.min(m, l[0]), Infinity);
    if(![izq, der, aba, arr].every(isFinite) || der - izq > 120 || arr - aba > 20) return e;
    const h2 = Math.min(hh, (der - izq - 1.2)/(String(txt).length*DXF_CAR), (arr - aba)*0.5);
    const w2 = String(txt).length*h2*DXF_CAR;
    return ["T", (izq + der)/2 - w2/2, (aba + arr)/2 - h2/2, h2, 0, txt];
  });
}
/* texto de un dato en su celda: altura reducida hasta que entre en el ancho disponible (y recortado si aún no entra) */
function ajustarDato(txt, h, ancho, hMin = 1.4){
  const t = String(txt||""); if(!t) return { t, h };
  const h2 = Math.max(hMin, Math.min(h, ancho/(t.length*DXF_CAR)));
  const n = Math.floor(ancho/(h2*DXF_CAR));
  return { t: t.length > n ? t.slice(0, Math.max(1, n - 1)) + "." : t, h: h2 };
}

export const A1 = { w:841, h:594, area:{ x0:25, y0:46, x1:831, y1:579 }, reservado:{ x0:684, y0:46, x1:831, y1:105 } };
export const PASO_HOJAS = 1000; // separación entre láminas en el espacio modelo (como en los planos de referencia)

// bloques del formato estándar
function bloquesNeutros(){
  if(DXF_BLOCKS.ING_MAIN) return;
  const sinMarca = () => true;
  // franjas de zonas: la referencia trae solo algunos separadores (x 210 / 471 / 656, y 297) que no coinciden con las
  // letras; se reemplazan por un separador entre cada letra (A…H, 8 × 100,75 mm) y entre cada número (1…5, 5 × 113,8 mm)
  const malSep = e => e[0]==="L" && ((e[1]===e[3] && [210, 471, 656].includes(e[1]) && Math.min(e[2], e[4])>=579) || (e[2]===297 && e[4]===297 && Math.max(e[1], e[3])<=25));
  const sep = [];
  for(let k=1;k<8;k++){ const x = 25 + k*100.75; sep.push(["L", x, 579, x, 584]); }
  for(let k=1;k<5;k++){ const y = 579 - k*113.8; sep.push(["L", 20, y, 25, y]); }
  // recuadro del cliente (x 511…616, y 9,8…46): un solo cuadro para su logo, sin divisiones ni el rótulo «VALID. PARA CONSTRUC.»
  const enCliente = e => { const xs = [], ys = []; const n = e[0]==="P" ? e.slice(2) : e.slice(1, 5); for(let i=0;i+1<n.length;i+=2){ xs.push(n[i]); ys.push(n[i+1]); }
    return Math.min(...xs) >= 510.9 && Math.max(...xs) <= 616.1 && Math.max(...ys) < 45 && !(Math.min(...xs) <= 511.1 && Math.max(...xs) <= 511.1) && !(Math.min(...xs) >= 615.9); };
  DXF_BLOCKS.ING_MAIN = DXF_BLOCKS.TITLE_MAIN.filter(e=>sinMarca(e) && !malSep(e) && !(e[0]==="T" && /PROCEDIMIENTO DE REVISION|VALID\. PARA CONSTRUC/i.test(e[5]||"")) && !((e[0]==="L" || e[0]==="P") && enCliente(e))).concat(sep, [["T",428.996,41.5,2.5,0,"PROCEDIMIENTO DE REVISIÓN Y VALIDACIÓN - CLIENTE"]]);
  DXF_BLOCKS.ING_MAIN = centrarRotulos(ajustarRotulos(ortografia(DXF_BLOCKS.ING_MAIN)), e=>e[1] > 420 && e[1] < 511 && e[2] < 46);
  DXF_BLOCKS.ING_REV = centrarRotulos(ajustarRotulos(ortografia(DXF_BLOCKS.TITLE_REV.filter(sinMarca))));
  DXF_BLOCKS.ING_REF = ajustarRotulos(DXF_BLOCKS.TITLE_REF.slice());
  // bloque del contratista sin el ícono del logo (6 líneas en x<0) — el recuadro queda para el nombre de la empresa
  DXF_BLOCKS.ING_CTR = centrarRotulos(ajustarRotulos(ortografia(DXF_BLOCKS.TITLE_CTR.filter(e=>!(e[0]==="L" && e[1]<0 && e[3]<0)))));
  DXF_BLOCKS.ING_CTR2 = ajustarRotulos(DXF_BLOCKS.TITLE_CTR2.slice());
  DXF_BLOCKS.ING_HOJA = [["P",1,0,0,54,0,54,6,0,6]];
}

/* valores del cajetín a partir del proyecto / documento */
export function valoresCajetin({ p, ent, docInfo, org, titulo, titulo2, hoja, escala, disciplina }){
  const revs = (docInfo.revisiones && docInfo.revisiones.length) ? docInfo.revisiones : [{ rev:docInfo.rev||"A", fecha:docInfo.fecha||"", descripcion:docInfo.emitido||"Emitido para revisión interna" }];
  const fecha = fmt(docInfo.fecha);
  const v = {
    PLANO: docInfo.codigo||"", TITULO: titulo||"", TITULO2: titulo2||"", PROYECTO: p.nombre||"", CLIENTE: p.cliente||"", UNIDAD: p.unidad||"", AREA: "",
    DISCIPLINA: disciplina||"", NUM_PROYECTO: "", REV: docInfo.rev||"A", FECHA: fecha, ESCALA: escala||"S/E",
    DIBUJO: docInfo.dibujo || org.dibujaPor || org.elaboraPor || "", DISENO: docInfo.elaboro || org.elaboraPor || "", REVISO: docInfo.reviso || org.revisaPor || "", APROBO: docInfo.aprobo || org.apruebaPor || "",
    HOJA: hoja||"1 DE 1", EMPRESA: (org.nombreCorto || org.nombre || "").toUpperCase(),
  };
  revs.slice(0,5).forEach((r,i)=>{ v["R"+i+"_REV"] = r.rev||""; v["R"+i+"_DESC"] = (r.descripcion||"").toUpperCase(); v["R"+i+"_DIB"] = r.dibujo||v.DIBUJO; v["R"+i+"_ING"] = r.reviso||v.REVISO; v["R"+i+"_APR"] = r.aprobo||v.APROBO; v["R"+i+"_FECHA"] = fmt(r.fecha); });
  (docInfo.referencias||[]).slice(0,5).forEach((r,i)=>{ v["REF"+(i+1)] = r.codigo||""; v["REFN"+(i+1)] = (r.titulo||"").toUpperCase(); });
  return v;
}
function fmt(f){ if(!f) return ""; const m = String(f).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(f); }

/* dibuja la lámina en (ox, oy) y devuelve el área útil de dibujo en coordenadas absolutas */
export function dibujarLamina(doc, ox, oy, vals, cliente){
  if(cliente && (cliente.formato || cliente.cajetin)) return dibujarLaminaCliente(doc, ox, oy, vals, cliente);
  bloquesNeutros();
  const S = "G-FORMATO";
  doc.insertBlock("ING_MAIN", ox, oy, S);
  doc.insertBlock("ING_REV", ox+25.25, oy+10.25, S);
  doc.insertBlock("ING_REF", ox+295.25, oy+10.25, S);
  doc.insertBlock("ING_CTR", ox+741.25, oy+46.25, S);
  doc.insertBlock("ING_CTR2", ox+741.25, oy+86.25, S);
  doc.insertBlock("ING_HOJA", ox+777, oy+98.535, S);
  const T = (x, y, h, txt, n, opt)=>{ if(txt) doc.text(ox+x, oy+y, h, dxfTrunc(String(txt), n||40), "G-TEXT", opt||{}); };
  // dato en una celda de ancho conocido: centrado (o alineado a la izquierda) y con la altura que entra
  const C = (x, y, h, txt, ancho, izq, hMin)=>{ if(!txt) return; const a = ajustarDato(txt, h, ancho, hMin); doc.text(ox+x, oy+y, a.h, a.t, "G-TEXT", izq ? { valign:2 } : { halign:1, valign:2 }); };
  // columna de firmas: una sola altura para todos los nombres (la del más largo), como en un cajetín ordenado
  const hCol = (lista, h, ancho) => Math.max(1.2, Math.min(h, ...lista.filter(Boolean).map(t=>ancho/(String(t).length*DXF_CAR))));
  // rótulo principal (recuadro x 616…766, y 10…46): líneas centradas, repartidas en la altura y con la altura de texto
  // proporcional a su importancia; si una línea no entra en el ancho se reduce su altura
  const lin = [[vals.UNIDAD, 3.0], [vals.AREA, 2.6], [vals.PROYECTO, 3.0], [vals.DISCIPLINA, 3.2], [vals.TITULO, 3.0], [vals.TITULO2, 2.3]]
    .filter(([t])=>t && String(t).trim()).map(([t, h])=>{ t = String(t); const hh = Math.max(1.8, Math.min(h, 144/(t.length*DXF_CAR))); return { t, h: hh }; });
  const libre = 36 - lin.reduce((a, l)=>a + l.h, 0), gap = libre/(lin.length + 1);
  let yl = 46 - gap;
  for(const l of lin){ yl -= l.h; C(691, yl + l.h/2, l.h, l.t, 144); yl -= gap; }
  C(818, 30, 2.5, vals.NUM_PROYECTO, 23); C(822.5, 42.9, 2.5, vals.ESCALA, 15);
  C(793.5, 14.5, 3.5, vals.PLANO, 52);
  // letra de revisión en el centro del triángulo (821,10)-(826,18,66)-(831,10)
  T(826, 12.9, 3, vals.REV, 2, { halign:1, valign:2 });
  // firmas del procedimiento del cliente (quedan en blanco salvo que el usuario lo indique)
  { const nm = [vals.DIBUJO, vals.DISENO, vals.REVISO, vals.APROBO], h = hCol(nm, 2.2, 23); nm.forEach((t, i)=>C(458.5, 31 - 6*i, h, t, 23, false, 1.2)); }
  [31, 25, 19, 12.9].forEach(y=>C(501, y, 2.0, vals.FECHA, 19));
  const lg = vals._logos || {};
  // recuadro del cliente: su logo proporcionado en todo el cuadro; sin logo, su nombre centrado
  if(lg.cliente) dibujarLogo(doc, lg.cliente, ox+514, oy+12.8, 99, 30.4);
  else C(563.5, 27.9, 3.4, vals.CLIENTE, 100);
  // revisiones (abajo hacia arriba)
  const ry = [1.4, 7.6, 13.8, 20.3, 25.7];
  for(let i=0;i<5;i++){
    if(!vals["R"+i+"_REV"]) continue;
    const y = 10.25 + ry[i];
    const yc = 10.25 + 3 + 6*i;
    C(25.25+5, yc, 2.2, vals["R"+i+"_REV"], 8); C(25.25+70, yc, 2.2, vals["R"+i+"_DESC"], 116);
    { const nm = [vals["R"+i+"_DIB"], vals["R"+i+"_ING"], vals["R"+i+"_APR"]], hh = hCol(nm, 2.2, 21); [141.5, 181.5, 221.5].forEach((x, k)=>C(25.25+x, yc, hh, nm[k], 21, false, 1.2)); } C(25.25+260, yc, 2.0, vals["R"+i+"_FECHA"], 18);
  }
  // planos de referencia
  const fy = [1.8, 7.8, 13.8, 19.8, 25.8];
  for(let i=0;i<5;i++){ if(vals["REF"+(i+1)]){ C(295.25+1.5, 10.25+fy[i]+1, 2.0, vals["REF"+(i+1)], 42, true); C(295.25+46.5, 10.25+fy[i]+1, 2.0, vals["REFN"+(i+1)], 165, true); } }
  // bloque del contratista / empresa que elabora
  C(786.1, 46.25+36, 2.3, "PROCEDIMIENTO DE APROBACIÓN ("+(vals.EMPRESA||"")+")", 86);
  // recuadro de la empresa: solo su logo, centrado; sin logo, su nombre
  if(lg.org) dibujarLogo(doc, lg.org, ox+686.5, oy+49, 52, 34.5);
  else C(741.25-28.2, 46.25+20, 3.0, vals.EMPRESA, 52);
  const fx = [21.6, 15.1, 8.6, 2.1];
  { const nm = [vals.DIBUJO, vals.DISENO, vals.REVISO, vals.APROBO], h = hCol(nm, 2.1, 23); nm.forEach((t, i)=>C(741.25+37.5, 46.25+fx[i]+1.05, h, t, 23, false, 1.2)); }
  fx.forEach(y=>C(741.25+80, 46.25+y+1.05, 1.9, vals.FECHA, 18));
  C(741.25+0.88, 86.25+9.3, 2.2, (vals.EMPRESA||"")+" - PLANO No:", 88, true);
  C(741.25+1.25, 86.25+3.6, 3.0, vals.PLANO, 88, true);
  C(804, 101.5, 2.5, "HOJA "+(vals.HOJA||"1 DE 1"), 52);
  return { x0:ox+A1.area.x0, y0:oy+A1.area.y0, x1:ox+A1.area.x1, y1:oy+A1.area.y1, reservado:{ x0:ox+A1.reservado.x0, y0:oy+A1.reservado.y0, x1:ox+A1.reservado.x1, y1:oy+A1.reservado.y1 }, w:A1.w, h:A1.h };
}

/* formato y cajetín del cliente (DXF ya interpretado con parseDXF → compacto) */
function dibujarLaminaCliente(doc, ox, oy, vals, F){
  const S = "G-FORMATO";
  const reemplazar = txt => String(txt).replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (m,k)=>{ const v = vals[k.toUpperCase()]; return v==null ? "" : String(v); }).trim();
  const colocar = (parte, x, y, key)=>{
    if(!parte) return;
    DXF_BLOCKS[key] = parte.compact;
    doc.insertBlock(key, x, y, S);
    parte.tokens.forEach(t=>{ const txt = reemplazar(t.text); if(txt) doc.text(x+t.x, y+t.y, t.h, dxfTrunc(txt, 70), "G-TEXT", { rot:t.rot||0 }); });
  };
  let W = 841, H = 594;
  if(F.formato){ W = F.formato.bounds.w; H = F.formato.bounds.h; colocar(F.formato, ox, oy, "CLI_FORMATO"); }
  if(F.cajetin){
    const cw = F.cajetin.bounds.w, ch = F.cajetin.bounds.h;
    let cx = ox + W - cw - 10, cy = oy + 10;
    if(F.formato){
      const rx = F.cajetin.bounds.minX - F.formato.bounds.minX, ry = F.cajetin.bounds.minY - F.formato.bounds.minY;
      if(rx>=0 && ry>=0 && rx+cw<=W+1 && ry+ch<=H+1){ cx = ox+rx; cy = oy+ry; }
    }
    colocar(F.cajetin, cx, cy, "CLI_CAJETIN");
    return { x0:ox+0.03*W, y0:Math.max(oy+0.06*H, cy+ch+6 - (cy-oy<H*0.3 && cx-ox>W*0.4 ? ch+6 : 0)), x1:ox+0.97*W, y1:oy+0.96*H, reservado:{ x0:cx-4, y0:cy, x1:cx+cw, y1:cy+ch+4 }, w:W, h:H };
  }
  return { x0:ox+0.03*W, y0:oy+0.06*H, x1:ox+0.97*W, y1:oy+0.96*H, reservado:null, w:W, h:H };
}

/* ---------- logos vectorizados (DXF R12 no admite imágenes: el logo se dibuja con SOLID por tramos de color) ---------- */
export function aciRGB(i){
  const base = {1:[255,0,0],2:[255,255,0],3:[0,255,0],4:[0,255,255],5:[0,0,255],6:[255,0,255],7:[0,0,0],8:[128,128,128],9:[192,192,192],250:[51,51,51],251:[91,91,91],252:[132,132,132],253:[173,173,173],254:[214,214,214],255:[255,255,255]};
  if(base[i]) return base[i];
  const h = (Math.floor((i-10)/10)*15) % 360, sub = i%10;
  const val = [1,1,0.65,0.65,0.5,0.5,0.3,0.3,0.15,0.15][sub], sat = sub%2 ? 0.5 : 1;
  const c = val*sat, x = c*(1-Math.abs((h/60)%2-1)), m = val-c;
  const [r,g,b] = h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
}
let _aci = null;
export function aciCercano(r, g, b){
  if(!_aci){ _aci = []; for(let i=1;i<255;i++) _aci.push([i, ...aciRGB(i)]); }
  if(r<60 && g<60 && b<60 && Math.max(r,g,b)-Math.min(r,g,b)<25) return 7;
  let best = 7, bd = 1e9;
  for(const [i,R,G,B] of _aci){ if(i===7) continue; const d = 2*(R-r)**2 + 4*(G-g)**2 + 3*(B-b)**2; if(d<bd){ bd = d; best = i; } }
  return best;
}
/* raster = { w, h, runs:[[fila, x0, x1, aci]] } (fila 0 = arriba) */
export function dibujarLogo(doc, raster, x, y, w, h){
  if(!raster || !raster.runs || !raster.runs.length) return;
  const s = Math.min(w/raster.w, h/raster.h);
  const ox = x + (w - raster.w*s)/2, oy = y + (h - raster.h*s)/2;
  const L = doc._layer("G-LOGO");
  const n = v => (Math.round(v*1000)/1000).toFixed(3);
  for(const [r, x0, x1, c] of raster.runs){
    const yb = oy + (raster.h-1-r)*s, yt = yb + s, xa = ox + x0*s, xb = ox + (x1+1)*s;
    doc.entities.push("0\nSOLID\n8\n"+L+"\n62\n"+c+"\n10\n"+n(xa)+"\n20\n"+n(yb)+"\n30\n0.0\n11\n"+n(xb)+"\n21\n"+n(yb)+"\n31\n0.0\n12\n"+n(xa)+"\n22\n"+n(yt)+"\n32\n0.0\n13\n"+n(xb)+"\n23\n"+n(yt)+"\n33\n0.0");
  }
}

/* NOTAS del usuario en la lámina, siempre en zona libre y nunca sobre el cajetín: por defecto en la columna derecha,
   sobre el bloque reservado (x 688…829, y 108…yTop). Se cortan al ancho y, si no entran, se reduce la altura del texto;
   lo que aun así no entre se indica con «(continúa en la memoria / filosofía)». Devuelve la altura usada. */
export function notasLamina(doc, ox, oy, lista, { x0 = 688, x1 = 829, y0 = 108, y1 = 300, titulo = "NOTAS:" } = {}){
  const notas = (lista||[]).map(n=>String(n||"").trim()).filter(Boolean);
  if(!notas.length || y1 - y0 < 12) return 0;
  const cortar = (s, n) => { const out = []; let cur = ""; for(const w of s.split(/\s+/)){ if((cur+" "+w).trim().length > n){ if(cur) out.push(cur); cur = w; } else cur = (cur+" "+w).trim(); } if(cur) out.push(cur); return out; };
  for(const h of [2.2, 2.0, 1.8, 1.6]){
    const n = Math.max(12, Math.floor((x1 - x0 - 6)/(h*0.78))), ls = h*1.55;
    const lineas = notas.flatMap((t, i)=>cortar(`${i+1}. ${t}`, n).map((l, k)=>k ? "   "+l : l));
    const alto = (lineas.length + 1)*ls + 2;
    if(alto <= y1 - y0 || h===1.6){
      const max = Math.floor((y1 - y0 - 2)/ls) - 1, vis = lineas.length > max ? lineas.slice(0, Math.max(1, max - 1)).concat(["(continúan en el documento de referencia)"]) : lineas;
      doc.text(ox + x0, oy + y1 - h, h*1.1, titulo, "G-TEXT");
      vis.forEach((l, i)=>doc.text(ox + x0, oy + y1 - h - (i + 1)*ls, h, l, "G-TEXT"));
      return (vis.length + 1)*ls + 2;
    }
  }
  return 0;
}

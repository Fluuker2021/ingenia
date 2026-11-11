/* Ingenia — lámina de plano (formato de impresión + cajetín).
   Por defecto: formato ISO A1 (841×594 mm) tomado de los planos de referencia del usuario (marco con
   cuadrícula A–H / 1–5, tabla de revisiones, planos de referencia, bloque de aprobación del contratista y
   rótulo principal), con la marca del cliente retirada y los campos convertidos en datos del proyecto.
   Con plantillas del cliente: su formato y su cajetín DXF, rellenando los textos marcados {{…}}. */
import { DXF_BLOCKS, dxfTrunc } from "../engine/tablero-core.js";

export const A1 = { w:841, h:594, area:{ x0:25, y0:46, x1:831, y1:579 }, reservado:{ x0:684, y0:46, x1:831, y1:105 } };
export const PASO_HOJAS = 1000; // separación entre láminas en el espacio modelo (como en los planos de referencia)

// bloques del formato estándar
function bloquesNeutros(){
  if(DXF_BLOCKS.ING_MAIN) return;
  const sinMarca = () => true;
  DXF_BLOCKS.ING_MAIN = DXF_BLOCKS.TITLE_MAIN.filter(sinMarca).concat([["T",428.996,41.5,2.5,0,"PROCEDIMIENTO DE REVISION Y VALIDACION - CLIENTE"]]);
  DXF_BLOCKS.ING_REV = DXF_BLOCKS.TITLE_REV.filter(sinMarca);
  DXF_BLOCKS.ING_REF = DXF_BLOCKS.TITLE_REF.slice();
  // bloque del contratista sin el ícono del logo (6 líneas en x<0) — el recuadro queda para el nombre de la empresa
  DXF_BLOCKS.ING_CTR = DXF_BLOCKS.TITLE_CTR.filter(e=>!(e[0]==="L" && e[1]<0 && e[3]<0));
  DXF_BLOCKS.ING_CTR2 = DXF_BLOCKS.TITLE_CTR2.slice();
  DXF_BLOCKS.ING_HOJA = [["P",1,0,0,54,0,54,6,0,6]];
}

/* valores del cajetín a partir del proyecto / documento */
export function valoresCajetin({ p, ent, docInfo, org, titulo, titulo2, hoja, escala, disciplina }){
  const revs = (docInfo.revisiones && docInfo.revisiones.length) ? docInfo.revisiones : [{ rev:docInfo.rev||"A", fecha:docInfo.fecha||"", descripcion:docInfo.emitido||"Emitido para revisión interna" }];
  const fecha = fmt(docInfo.fecha);
  const v = {
    PLANO: docInfo.codigo||"", TITULO: titulo||"", TITULO2: titulo2||"", PROYECTO: p.nombre||"", CLIENTE: p.cliente||"", UNIDAD: p.unidad||"", AREA: p.areaNombre || (p.area ? "ÁREA "+p.area : ""),
    DISCIPLINA: disciplina||"", NUM_PROYECTO: p.codigo||"", REV: docInfo.rev||"A", FECHA: fecha, ESCALA: escala||"S/E",
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
  // rótulo principal
  T(618, 40.6, 2.8, vals.UNIDAD, 52); T(618, 33.5, 2.8, vals.AREA, 52); T(618, 26.2, 2.8, vals.PROYECTO, 52);
  T(618, 19.1, 2.8, vals.DISCIPLINA, 52);
  const tit = String(vals.TITULO||""); const tit2 = vals.TITULO2 ? String(vals.TITULO2) : "";
  if(tit.length>50 || tit2){ T(618, 13.2, 2.4, tit, 62); T(618, 10.6, 2.0, tit2, 70); } else T(618, 11.8, 2.8, tit, 52);
  T(806.2, 28.9, 2.5, vals.NUM_PROYECTO, 14); T(812.6, 41.5, 2.5, vals.ESCALA, 10);
  T(768, 14.5, String(vals.PLANO||"").length>22 ? 2.6 : 3.5, vals.PLANO, 30);
  T(823.4, 11.6, 3, vals.REV, 2);
  // firmas del procedimiento del cliente (quedan en blanco salvo que el usuario lo indique)
  T(446.5, 29.8, 2.2, vals.DIBUJO, 10); T(446.5, 23.8, 2.2, vals.DISENO, 10); T(446.5, 17.8, 2.2, vals.REVISO, 10); T(446.5, 11.8, 2.2, vals.APROBO, 10);
  [29.8, 23.8, 17.8, 11.8].forEach(y=>T(491.6, y, 2.0, vals.FECHA, 10));
  const lg = vals._logos || {};
  if(lg.cliente){ dibujarLogo(doc, lg.cliente, ox+513, oy+29.2, 36, 15.6); T(584, 34.5, 2.6, vals.CLIENTE, 24, { halign:1 }); }
  else T(563.5, 34.5, 3.2, vals.CLIENTE, 30, { halign:1 });
  // revisiones (abajo hacia arriba)
  const ry = [1.4, 7.6, 13.8, 20.3, 25.7];
  for(let i=0;i<5;i++){
    if(!vals["R"+i+"_REV"]) continue;
    const y = 10.25 + ry[i];
    T(25.25+3.4, y, 2.2, vals["R"+i+"_REV"], 2); T(25.25+12.1, y, 2.2, vals["R"+i+"_DESC"], 48);
    T(25.25+132, y, 2.2, vals["R"+i+"_DIB"], 10); T(25.25+172, y, 2.2, vals["R"+i+"_ING"], 10); T(25.25+212, y, 2.2, vals["R"+i+"_APR"], 9); T(25.25+251.5, y, 2.0, vals["R"+i+"_FECHA"], 10);
  }
  // planos de referencia
  const fy = [1.8, 7.8, 13.8, 19.8, 25.8];
  for(let i=0;i<5;i++){ if(vals["REF"+(i+1)]){ T(295.25+1.5, 10.25+fy[i], 2.0, vals["REF"+(i+1)], 22); T(295.25+46.5, 10.25+fy[i], 2.0, vals["REFN"+(i+1)], 42); } }
  // bloque del contratista / empresa que elabora
  T(741.25+11.681, 46.25+34.819, 2.3, "PROCEDIMIENTO DE APROBACION ("+(vals.EMPRESA||"").slice(0,22)+")", 52);
  if(lg.org){ dibujarLogo(doc, lg.org, ox+687, oy+56, 52, 27); T(741.25-28.2, 46.25+3.5, 2.4, vals.EMPRESA, 20, { halign:1 }); }
  else T(741.25-28.2, 46.25+22, 3.0, vals.EMPRESA, 18, { halign:1 });
  T(741.25+26.5, 46.25+21.6, 2.1, vals.DIBUJO, 10); T(741.25+26.5, 46.25+15.1, 2.1, vals.DISENO, 10); T(741.25+26.5, 46.25+8.6, 2.1, vals.REVISO, 10); T(741.25+26.5, 46.25+2.1, 2.1, vals.APROBO, 10);
  [21.6, 15.1, 8.6, 2.1].forEach(y=>T(741.25+71.5, 46.25+y, 1.9, vals.FECHA, 10));
  T(741.25+0.88, 86.25+8.285, 2.2, (vals.EMPRESA||"")+" - PLANO No:", 40);
  T(741.25+1.25, 86.25+2.54, String(vals.PLANO||"").length>24 ? 2.4 : 3.0, vals.PLANO, 34);
  T(779, 100.3, 2.5, "HOJA "+(vals.HOJA||"1 DE 1"), 16);
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

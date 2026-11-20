/* Ingenia — PLANO MECÁNICO DEL TABLERO DE FUERZA (DXF R12, láminas A1 con cajetín), con el nivel de detalle del
   plano mecánico de referencia del usuario. Cuatro láminas por tablero:
   1. Vistas exteriores: frontal (puertas, manija del interruptor general, panel de operación, teclados de los
      variadores, ventilación, placa de identificación y señalética), lateral derecha e isométrica, con cotas y notas.
   2. Disposición de equipos: placas de montaje con canaletas, rieles DIN, barras, cada equipo con su contorno real
      y su TAG (los mismos del multifilar), recorridos de fuerza y detalle de borneras.
   3. Panel de operación (detalle con placas de leyenda) y base del tablero con los prensaestopas.
   4. Lista de materiales con dimensiones, criterios de diseño aplicados y balance térmico.
   Todo se dibuja desde el modelo de js/mecanico/arreglo.js: lo que se ve en 2D es lo mismo que se ve en 3D. */
import { DXFDoc } from "../engine/tablero-core.js";
import { dibujarLamina, PASO_HOJAS, A1 } from "./formato.js";
import { envolver } from "./kit.js";
import { datos } from "../datos.js";
import { arreglosProyecto } from "../mecanico/arreglo.js";
import { arreglosControl } from "../mecanico/arreglo-control.js";
import * as C from "../mecanico/componentes.js";
import { apariencia, cuenta, polosDe, regiones, rasgosDe } from "../mecanico/modelos.js";

const CAPAS = {
  "M-GABINETE":{ c:7 }, "M-PUERTA":{ c:7 }, "M-PLACA":{ c:8 }, "M-CANALETA":{ c:9 }, "M-RIEL":{ c:8 }, "M-EQUIPO":{ c:7 },
  "M-DETALLE":{ c:8 }, "M-COBRE":{ c:30 }, "M-TIERRA":{ c:3 }, "M-CABLE":{ c:6, lt:"TRAZOS" }, "M-OCULTO":{ c:8, lt:"OCULTA" },
  "M-EJE":{ c:1, lt:"EJE" }, "M-COTA":{ c:4 }, "M-TEXTO":{ c:7 }, "M-ETIQUETA":{ c:2 }, "M-SENAL":{ c:2 }, "M-TABLA":{ c:7 },
};
const TIPOS_LINEA = { OCULTA:{ d:"Oculta __ __ __", p:[3,-1.5] }, EJE:{ d:"Eje ____ _ ____", p:[8,-2,1.5,-2] }, TRAZOS:{ d:"Trazos _ _ _", p:[2,-1] } };
const AR = A1.area, RES = A1.reservado;
const ESCALAS = [2, 2.5, 3, 4, 5, 7.5, 10, 12.5, 15, 20, 25, 30, 40, 50];
const escTxt = s => "1:" + String(s).replace(".", ",");
const r1 = v => Math.round(v);

/* ---------- vista: transforma mm reales a mm de lámina ---------- */
function vista(doc, ox, oy, s){
  const X = x => ox + x/s, Y = y => oy + y/s;
  return {
    s, X, Y, doc,
    L(x1, y1, x2, y2, ly, o){ doc.line(X(x1), Y(y1), X(x2), Y(y2), ly, o); },
    R(x, y, w, h, ly, o){ this.P([[x,y],[x+w,y],[x+w,y+h],[x,y+h]], ly, o, true); },
    C(cx, cy, r, ly, o){ doc.circle(X(cx), Y(cy), Math.max(0.05, r/s), ly, o); },
    A(cx, cy, r, a1, a2, ly, o){ doc.arc(X(cx), Y(cy), r/s, a1, a2, ly, o); },
    P(pts, ly, o, cerrar){ const q = cerrar ? pts.concat([pts[0]]) : pts; for(let i=0;i<q.length-1;i++) doc.line(X(q[i][0]), Y(q[i][1]), X(q[i+1][0]), Y(q[i+1][1]), ly, o); },
    F(x, y, w, h, ly, o){ doc.solid([[X(x),Y(y)],[X(x+w),Y(y)],[X(x),Y(y+h)],[X(x+w),Y(y+h)]], ly, o); },
    T(x, y, h, txt, ly, opt){ if(txt!=null && txt!=="") doc.text(X(x), Y(y), h, String(txt), ly || "M-TEXTO", opt); },
  };
}
/* altura de texto que cabe en un ancho de lámina dado */
const ajustar = (txt, ancho, hMax, hMin) => Math.max(hMin || 1, Math.min(hMax, ancho/Math.max(1, String(txt).length*0.72)));

/* ---------- cotas ---------- */
function flecha(doc, x, y, ang, ly){
  const a = ang*Math.PI/180, L = 2.4, W = 0.75, ca = Math.cos(a), sa = Math.sin(a);
  const bx = x - L*ca, by = y - L*sa;
  doc.solid([[x, y], [bx - W*sa, by + W*ca], [bx + W*sa, by - W*ca]], ly);
}
function cotaH(doc, x1, x2, y, yRef, txt, ly){
  ly = ly || "M-COTA"; const sg = y > yRef ? 1 : -1;
  doc.line(x1, yRef + sg*1, x1, y + sg*1.5, ly); doc.line(x2, yRef + sg*1, x2, y + sg*1.5, ly);
  doc.line(x1, y, x2, y, ly); flecha(doc, x1, y, 180, ly); flecha(doc, x2, y, 0, ly);
  doc.text((x1 + x2)/2, y + 0.8, 2.2, txt, ly, { halign:1 });
}
function cotaV(doc, y1, y2, x, xRef, txt, ly){
  ly = ly || "M-COTA"; const sg = x > xRef ? 1 : -1;
  doc.line(xRef + sg*1, y1, x + sg*1.5, y1, ly); doc.line(xRef + sg*1, y2, x + sg*1.5, y2, ly);
  doc.line(x, y1, x, y2, ly); flecha(doc, x, y1, 270, ly); flecha(doc, x, y2, 90, ly);
  doc.text(x - 0.8, (y1 + y2)/2, 2.2, txt, ly, { halign:1, rot:90 });
}
function tituloVista(doc, cx, y, titulo, escala){
  doc.text(cx, y, 3.5, "%%U" + titulo, "M-TEXTO", { halign:1 });
  if(escala) doc.text(cx, y - 4.6, 2.2, "ESCALA: " + escala, "M-TEXTO", { halign:1 });
}
/* llamadas (texto con línea guía) apiladas sin superponerse */
function llamadas(doc, lista, xTexto, lado){
  const ord = lista.slice().sort((a, b)=>b.y - a.y);
  let ultimo = Infinity;
  for(const l of ord){
    const lineas = envolver(l.texto, 22), alto = lineas.length*2.8;
    let yt = Math.min(l.y + alto/2, ultimo - 2);
    ultimo = yt - alto;
    const xt = xTexto;
    doc.line(l.x, l.y, xt + (lado==="izq" ? 1.5 : -1.5), yt - 1.2, "M-COTA");
    doc.circle(l.x, l.y, 0.5, "M-COTA");
    lineas.forEach((s, i)=>doc.text(xt, yt - 2.2 - i*2.8, 2, s, "M-TEXTO", lado==="izq" ? { halign:2 } : {}));
  }
}
/* tabla con cuadrícula; devuelve la altura usada */
function tabla(doc, x, yTop, cols, filas, o){
  o = o || {}; const hf = o.h || 4.2, fs = o.fs || 1.7, hc = o.hc || 6;
  const W = cols.reduce((a, c)=>a + c.w, 0);
  const n = filas.length;
  doc.line(x, yTop, x + W, yTop, "M-TABLA");
  doc.line(x, yTop - hc, x + W, yTop - hc, "M-TABLA");
  let xx = x;
  for(const c of cols){ doc.text(xx + c.w/2, yTop - hc/2, Math.min(1.9, ajustar(c.titulo, c.w - 1, 1.9, 1.2)), c.titulo, "M-TEXTO", { halign:1, valign:2 }); xx += c.w; }
  filas.forEach((f, i)=>{
    const y = yTop - hc - (i + 1)*hf;
    doc.line(x, y, x + W, y, "M-TABLA");
    let x2 = x;
    for(const c of cols){
      let v = f[c.key]; v = v==null ? "" : String(v);
      const maxC = Math.floor((c.w - 1.6)/(fs*0.72));
      if(v.length > maxC) v = v.slice(0, Math.max(1, maxC - 1)) + "…";
      const al = c.al || "izq";
      doc.text(al==="centro" ? x2 + c.w/2 : x2 + 0.8, y + hf/2, fs, v, f.__titulo ? "M-ETIQUETA" : "M-TEXTO", al==="centro" ? { halign:1, valign:2 } : { valign:2 });
      x2 += c.w;
    }
  });
  const yb = yTop - hc - n*hf;
  xx = x; doc.line(xx, yTop, xx, yb, "M-TABLA");
  for(const c of cols){ xx += c.w; doc.line(xx, yTop, xx, yb, "M-TABLA"); }
  return hc + n*hf;
}
function parrafos(doc, x, yTop, ancho, titulo, items, fs){
  fs = fs || 2; const paso = fs*1.45, nCar = Math.min(200, Math.floor(ancho/(fs*0.78)));
  let y = yTop;
  if(titulo){ doc.text(x, y, 2.6, "%%U" + titulo, "M-TEXTO"); y -= 5; }
  items.forEach((it, i)=>{
    const lin = envolver(it, nCar - 4);
    lin.forEach((s, k)=>{ doc.text(x + (k ? 4 : 0), y, fs, (k ? "" : `${i+1}. `) + s, "M-TEXTO"); y -= paso; });
    y -= 0.8;
  });
  return yTop - y;
}

/* =============================== equipos (vista frontal) =============================== */
function tornillos(v, x, y, w, n, r, ly){ for(let k=0;k<n;k++){ const cx = x + w*(k+0.5)/n; v.C(cx, y, r, ly); v.L(cx - r*0.7, y - r*0.7, cx + r*0.7, y + r*0.7, ly); } }
function etiqueta(v, c, txt, arriba){
  txt = txt==null ? c.tag : txt; if(!txt) return;
  const anchoP = c.w/v.s + (c.etqJusta ? -0.3 : 1.5), h = c.etqJusta ? Math.max(0.9, Math.min(1.9, anchoP/(String(txt).length*0.85))) : ajustar(txt, anchoP, 1.9, 1.0);
  if(arriba===false) v.T(c.x + c.w/2, c.y + c.h/2, h, txt, "M-ETIQUETA", { halign:1, valign:2 });
  else v.T(c.x + c.w/2, c.y + c.h + 0.7*v.s, h, txt, "M-ETIQUETA", { halign:1 });
}
/* frente del equipo con los rasgos de su familia (js/mecanico/modelos.js, la misma base que la vista 3D): contorno con
   chaflán, escalón del frente saliente, palancas, perillas, diales, LED, display, teclado, ventanas, conector frontal,
   rejillas, puertos y bornes. Todo queda dentro del contorno del equipo (no invade cotas, tablas ni el cajetín); los
   detalles menores de 0,12 mm en la lámina se omiten. */
const SIN_BASE_2D = new Set(["reactancia", "trafo", "luminaria", "finpuerta", "peine", "tapa"]);
function frenteEquipo(v, c, ap){
  const E = "M-EQUIPO", D = "M-DETALLE", { y, h } = c, reg = regiones(c, ap), x = reg.x, w = reg.w;
  const ve = mm => mm/v.s >= 0.12;                                   // ¿se distingue en la lámina?
  const pf = ap.perfil && ap.perfil.tipo==="modular" ? ap.perfil : null;
  const np = polosDe(c), pw = w/np, modular = ["mcb","diferencial","fusible","spd"].includes(c.tipo);
  // contorno: aparamenta modular por módulo de 17,5 mm; el resto con su chaflán
  if(modular) for(let k=0;k<np;k++) v.R(x + k*pw, y, pw, h, E);
  else { const b = Math.min(ap.bisel || 0, w*0.12, h*0.12);
    if(b >= 2 && ve(b)) v.P([[x + b, y], [x + w - b, y], [x + w, y + b], [x + w, y + h - b], [x + w - b, y + h], [x + b, y + h], [x, y + h - b], [x, y + b]], E, null, true);
    else v.R(x, y, w, h, E); }
  if(pf){ for(const yy of [pf.ny - pf.nariz/2, pf.ny + pf.nariz/2]) v.L(x, y + h*yy, x + w, y + h*yy, D); }
  if(reg.lateral){ const l = reg.lateral; v.R(l.x, y + h*0.12, l.w, h*0.76, D); }
  const reps = r => r.por==="polo" ? Array.from({ length:np }, (_, i)=>i) : [null];
  const X = (r, i) => i==null ? x + (r.x ?? 0.5)*w : x + (i + (r.x ?? 0.5))*pw;
  const WW = (r, i, def) => (r.w ?? def ?? 0.8)*(i==null ? w : pw);
  for(const r of rasgosDe(c, ap)){
    const cy = y + (r.y ?? 0.5)*h, hh = (r.h ?? 0.1)*h;
    switch(r.t){
      case "palanca": for(const i of reps(r)){ const cx = X(r, i), ww = WW(r, i); v.R(cx - ww*0.67, cy - hh*0.75, ww*1.35, hh*1.5, D); v.R(cx - ww/2, cy - hh*0.38, ww, hh, E); }
        if(r.unida && r.por==="polo" && np > 1) v.L(X(r, 0), cy + hh*0.42, X(r, np - 1), cy + hh*0.42, E);
        break;
      case "perilla": { const rr = (r.r ?? 0.25)*w, cx = X(r); v.C(cx, cy, rr*1.12, D); v.C(cx, cy, rr, E); v.R(cx - rr*0.275, cy - rr*0.95, rr*0.55, rr*1.9, D); if(r.flecha) v.L(cx, cy + rr*0.3, cx, cy + rr*0.85, D); break; }
      case "dial": { const rr = (r.r ?? 0.1)*w, cx = X(r); if(!ve(rr)) break; v.C(cx, cy, rr, D); v.L(cx, cy, cx + rr*0.7, cy + rr*0.7, D); break; }
      case "boton": { const rr = (r.r ?? 0.06)*w, cx = X(r); if(!ve(rr)) break; v.C(cx, cy, rr*1.3, D); v.C(cx, cy, rr, D); break; }
      case "led": { const n = r.n || 1, rr = r.r || 1.2; if(!ve(rr)) break; for(let i=0;i<n;i++) v.C(x + (r.x + i*(r.dx||0))*w, y + ((r.y ?? 0.5) + i*(r.dy||0))*h, rr, D); break; }
      case "display": { const ww = WW(r, null, 0.5), cx = X(r); v.R(cx - ww/2 - 1, cy - hh/2 - 1, ww + 2, hh + 2, D); if(ve(3)) v.R(cx - ww/2, cy - hh/2, ww, hh, D); break; }
      case "teclado": { const ww = WW(r, null, 0.5), cx = X(r), f = r.filas || 1, q = r.cols || 3; if(!ve(ww/q*0.6)) break;
        for(let a=0;a<f;a++) for(let b=0;b<q;b++){ const kx = cx - ww/2 + (b + 0.5)*ww/q, ky = cy + hh/2 - (a + 0.5)*hh/f; v.R(kx - ww/q*0.34, ky - hh/f*0.31, ww/q*0.68, hh/f*0.62, D); }
        break; }
      case "ventana": case "etiqueta": case "placa": case "rebaje": case "tapa": case "bloque":
        for(const i of reps(r)){ const ww = WW(r, i, r.t==="bloque" ? 0.8 : 0.86), cx = X(r, i); if(ve(Math.min(ww, hh))) v.R(cx - ww/2, cy - hh/2, ww, hh, D); }
        break;
      case "franja": for(const i of reps(r)){ const ww = WW(r, i, 0.86), cx = X(r, i); if(ve(hh)) v.R(cx - ww/2, cy - hh/2, ww, hh, D); else v.L(cx - ww/2, cy, cx + ww/2, cy, D); } break;
      case "conector": { const ww = WW(r, null, 0.86), cx = X(r), n = r.n || 8, q = r.cols || 1, f = Math.ceil(n/q); v.R(cx - ww/2, cy - hh/2, ww, hh, D);
        const rr = Math.min(ww/q*0.24, hh/f*0.24, 1.8); if(ve(rr*2)) for(let a=0;a<f;a++) for(let b=0;b<q;b++) v.C(cx - ww/2 + (b + 0.5)*ww/q, cy + hh/2 - (a + 0.5)*hh/f, rr, D);
        break; }
      case "rejilla": { const ww = WW(r, null, 0.7), cx = X(r), n = r.n || 6, paso = hh/n; if(!ve(paso*0.5)) break; for(let i=0;i<n;i++){ const yy = cy - hh/2 + (i + 0.5)*paso; v.L(cx - ww/2, yy, cx + ww/2, yy, D); } break; }
      case "puertos": { const ww = WW(r, null, 0.7), cx = X(r), n = r.n || 1, f = r.filas || 1, pwp = Math.min(ww/n*0.85, 14), php = Math.min(hh/f*0.8, 12); if(!ve(pwp*0.5)) break;
        for(let a=0;a<f;a++) for(let q=0;q<n;q++) v.R(cx - ww/2 + (q + 0.5)*ww/n - pwp/2, cy + hh/2 - (a + 0.5)*hh/f - php/2, pwp, php, D);
        break; }
      case "aletas": if(r.lado==="frente"){ const n = r.n || 7; for(let i=0;i<n;i++){ const xx = x + w*(i + 0.5)/n; v.L(xx, y + h*0.14, xx, y + h*0.9, D); } } break;
      case "antenas": { const n = r.n || 2, rr = Math.min(3.2, w/(4*n)); for(let i=0;i<n;i++) v.C(x + w*(i + 0.5)/n, y + h - rr - 1, rr, D); break; }
      case "bornes": {
        const n = cuenta(r.n, c), lados = r.lado==="ambos" ? ["arriba", "abajo"] : [r.lado || "ambos"], paso = w/n;
        for(const lado of lados){ const sup = lado==="arriba";
          let yf = r.y ?? (pf ? (sup ? (1 + pf.ny + pf.nariz/2)/2 : (pf.ny - pf.nariz/2)/2) : (sup ? 0.92 : 0.08)); if(r.y!=null && r.lado==="ambos") yf = sup ? r.y : 1 - r.y;
          const by = y + yf*h;
          for(let i=0;i<n;i++){ const bx = x + (i + 0.5)*paso;
            if(r.forma==="lug"){ const lw = Math.min(paso*0.5, 40), lh = Math.min(h*0.09, 26); v.R(bx - lw/2, by - lh/2, lw, lh, D); v.C(bx, by, Math.min(lw, lh)*0.22, D); }
            else { const rs = Math.min(paso*0.3, h*0.04, 2.8); if(!ve(rs)) continue; v.C(bx, by, rs, D); v.L(bx - rs*0.7, by - rs*0.7, bx + rs*0.7, by + rs*0.7, D); }
          } }
        break; }
    }
  }
}
export function dibujarEquipo(v, c){   // exportada también para pruebas (galería de la base de apariencia)
  const { x, y, w, h } = c, E = "M-EQUIPO", D = "M-DETALLE";
  const ap = SIN_BASE_2D.has(c.tipo) ? null : apariencia(c);
  if(ap && ap.rasgos && ap.rasgos.length){
    frenteEquipo(v, c, ap);
    if(c.tipo==="variador"){ const fam = String(c.familia||""); v.T(x + w/2, y + h*0.45, ajustar(c.tag, w/v.s*0.8, 2.6, 1.2), c.tag, "M-ETIQUETA", { halign:1, valign:2 }); v.T(x + w/2, y + h*0.45 - 4*v.s, ajustar(fam, w/v.s*0.9, 1.6, 0.8), fam, D, { halign:1, valign:2 }); }
    else if(c.tipo==="rele" && w < 12) v.T(x + w/2, y + h + 0.6*v.s, Math.min(1.25, w/v.s*0.85), c.tag, "M-ETIQUETA", { rot:90, valign:2 });
    else if(c.tipo==="sobrecarga") etiqueta(v, c, c.tag, false);
    else if(c.tipo==="interruptor"){ const fam = String(c.familia||"").replace("Tmax ", ""); if(/^XT/.test(fam)) v.T(x + w/2, y + h*0.73, ajustar(fam, w/v.s*0.6, 1.4, 0.6), fam, D, { halign:1, valign:2 }); if(c.rol==="general") v.T(x + w*0.8, y + h*0.27, ajustar("U<", w*0.18/v.s, 1.2, 0.6), "U<", D, { halign:1, valign:2 }); etiqueta(v, c); }
    else etiqueta(v, c);
    return;
  }
  switch(c.tipo){
    case "interruptor": {
      v.R(x, y, w, h, E);
      const bt = h*0.16, rs = Math.min(5, w/16);
      v.R(x + 2, y + h - bt, w - 4, bt - 2, D); v.R(x + 2, y + 2, w - 4, bt - 2, D);
      tornillos(v, x, y + h - bt/2 - 1, w, 3, rs, D); tornillos(v, x, y + bt/2 + 1, w, 3, rs, D);
      v.R(x + w*0.1, y + h*0.24, w*0.8, h*0.52, D);
      v.R(x + w*0.42, y + h*0.38, w*0.16, h*0.24, E); v.L(x + w*0.42, y + h*0.5, x + w*0.58, y + h*0.5, D);
      v.R(x + w*0.14, y + h*0.6, w*0.24, h*0.11, D); v.R(x + w*0.62, y + h*0.6, w*0.24, h*0.11, D);
      if(c.rol==="general"){ v.R(x + w*0.66, y + h*0.27, w*0.2, h*0.09, D); v.T(x + w*0.76, y + h*0.315, ajustar("U<", w*0.18/v.s, 1.2, 0.6), "U<", D, { halign:1, valign:2 }); }
      v.T(x + w/2, y + h*0.29, ajustar(c.familia||"", w/v.s*0.7, 1.4, 0.8), String(c.familia||"").replace("Tmax ",""), D, { halign:1, valign:2 });
      etiqueta(v, c);
      break; }
    case "xlp": {
      v.R(x, y, w, h, E);
      const bt = h*0.13; v.R(x + 3, y + h - bt, w - 6, bt - 3, D); v.R(x + 3, y + 3, w - 6, bt - 3, D);
      tornillos(v, x, y + h - bt/2 - 1.5, w, 3, Math.min(5, w/18), D); tornillos(v, x, y + bt/2 + 1.5, w, 3, Math.min(5, w/18), D);
      v.R(x + 4, y + h*0.8, w - 8, h*0.05, D);
      for(let k=0;k<3;k++){ const cx = x + w*(k+0.5)/3, cw = w/3 - 10; v.R(cx - cw/2, y + h*0.2, cw, h*0.56, D); v.R(cx - cw*0.3, y + h*0.62, cw*0.6, h*0.07, D); v.L(cx - cw*0.3, y + h*0.3, cx + cw*0.3, y + h*0.3, D); }
      etiqueta(v, c); break; }
    case "variador": {
      v.P([[x + 6, y], [x + w - 6, y], [x + w, y + 6], [x + w, y + h - 6], [x + w - 6, y + h], [x + 6, y + h], [x, y + h - 6], [x, y + 6]], E, null, true);
      v.L(x, y + h*0.8, x + w, y + h*0.8, D); v.L(x, y + h*0.12, x + w, y + h*0.12, D);
      for(let i=0;i<6;i++){ const yy = y + h*0.83 + i*h*0.025; v.L(x + w*0.18, yy, x + w*0.82, yy, D); const y2 = y + h*0.025 + i*h*0.015; v.L(x + w*0.2, y2, x + w*0.8, y2, D); }
      v.R(x + w*0.3, y + h*0.6, w*0.4, h*0.15, D); v.R(x + w*0.36, y + h*0.68, w*0.28, h*0.05, D);
      for(const [cx, cy] of [[x + 14, y + h - 14], [x + w - 14, y + h - 14], [x + 14, y + 14], [x + w - 14, y + 14]]) v.C(cx, cy, 4, D);
      const fam = String(c.familia||"");
      v.T(x + w/2, y + h*0.45, ajustar(c.tag, w/v.s*0.8, 2.6, 1.2), c.tag, "M-ETIQUETA", { halign:1, valign:2 });
      v.T(x + w/2, y + h*0.45 - 4*v.s, ajustar(fam, w/v.s*0.9, 1.6, 0.8), fam, D, { halign:1, valign:2 });
      break; }
    case "arrancador": {
      v.R(x, y, w, h, E);
      for(let i=1;i<8;i++){ const xx = x + w*i/8; v.L(xx, y + h*0.62, xx, y + h*0.9, D); }
      tornillos(v, x, y + h*0.95, w, 3, Math.min(4, w/14), D); tornillos(v, x, y + h*0.05, w, 3, Math.min(4, w/14), D);
      v.R(x + w*0.18, y + h*0.2, w*0.64, h*0.36, D); v.C(x + w*0.3, y + h*0.48, Math.min(3, w*0.05), D); v.C(x + w*0.45, y + h*0.48, Math.min(3, w*0.05), D);
      etiqueta(v, c); break; }
    case "reactancia": {
      v.R(x, y, w, h*0.1, E);
      v.R(x + 6, y + h*0.1, w - 12, h*0.06, D); v.R(x + 6, y + h*0.72, w - 12, h*0.09, E);
      for(let k=0;k<3;k++){ const cx = x + w*(k+0.5)/3, cw = w/3 - 10; v.R(cx - cw/2, y + h*0.16, cw, h*0.56, E); v.L(cx - cw/2, y + h*0.35, cx + cw/2, y + h*0.35, D); v.L(cx - cw/2, y + h*0.53, cx + cw/2, y + h*0.53, D); }
      for(let k=0;k<6;k++){ const cx = x + w*(k+0.5)/6, tw = Math.min(16, w/9); v.R(cx - tw/2, y + h*0.81, tw, h*0.17, D); v.C(cx, y + h*0.92, tw*0.25, D); }
      v.T(x + w/2, y + h*0.44, ajustar(c.tag, w/v.s*0.5, 2.2, 1.0), c.tag, "M-ETIQUETA", { halign:1, valign:2 });
      break; }
    case "trafo": {
      v.R(x + 6, y, w - 12, h, E); v.R(x, y, 6, h*0.12, D); v.R(x + w - 6, y, 6, h*0.12, D);
      v.R(x + w*0.18, y + h*0.12, w*0.64, h*0.66, D);
      for(let i=1;i<6;i++) v.L(x + w*0.18, y + h*0.12 + i*h*0.11, x + w*0.82, y + h*0.12 + i*h*0.11, D);
      tornillos(v, x + 6, y + h*0.89, w - 12, 5, Math.min(3, w/30), D);
      etiqueta(v, c); break; }
    case "guardamotor": {
      const wb = w - C.AUX_LATERAL;
      v.R(x, y, wb, h, E); v.R(x + wb, y + h*0.18, C.AUX_LATERAL, h*0.6, D);
      const r = wb*0.28; v.C(x + wb/2, y + h*0.52, r, E); v.L(x + wb/2, y + h*0.52, x + wb/2 + r*0.7, y + h*0.52 + r*0.7, D);
      tornillos(v, x, y + h*0.9, wb, 3, Math.min(3, wb/14), D); tornillos(v, x, y + h*0.1, wb, 3, Math.min(3, wb/14), D);
      etiqueta(v, c); break; }
    case "contactor": {
      v.R(x, y, w, h, E);
      tornillos(v, x, y + h*0.9, w, 3, Math.min(3, w/14), D); tornillos(v, x, y + h*0.1, w, 3, Math.min(3, w/14), D);
      v.R(x + w*0.2, y + h*0.3, w*0.6, h*0.32, D); v.R(x + w*0.28, y + h*0.66, w*0.44, h*0.14, D);
      etiqueta(v, c); break; }
    case "sobrecarga": {
      v.R(x, y, w, h, E); v.C(x + w*0.35, y + h*0.55, Math.min(w, h)*0.16, D); v.R(x + w*0.62, y + h*0.45, w*0.18, h*0.2, D);
      tornillos(v, x, y + h*0.12, w, 3, Math.min(3, w/14), D);
      etiqueta(v, c, c.tag, false); break; }
    case "mcb": case "diferencial": case "fusible": {
      const n = Math.max(1, Math.round(w/C.MODULO));
      for(let k=0;k<n;k++){
        const px = x + k*C.MODULO; v.R(px, y, C.MODULO, h, E);
        v.C(px + C.MODULO/2, y + h*0.9, 2.6, D); v.C(px + C.MODULO/2, y + h*0.1, 2.6, D);
        if(c.tipo==="fusible"){ v.R(px + 3, y + h*0.22, C.MODULO - 6, h*0.56, D); v.R(px + 5.5, y + h*0.45, C.MODULO - 11, h*0.12, D); }
        else { v.R(px + 5.75, y + h*0.38, 6, h*0.22, D); v.L(px + 3, y + h*0.7, px + C.MODULO - 3, y + h*0.7, D); }
      }
      if(c.tipo==="diferencial") v.C(x + w - 7, y + h*0.27, 2.5, D);
      etiqueta(v, c); break; }
    case "rele": case "fuente": {
      if(c.tipo==="rele" && w < 12){   // relé de interfaz de 6,2 mm: base con LED y TAG vertical
        v.R(x, y, w, h, E); v.R(x + 0.8, y + h*0.3, w - 1.6, h*0.42, D); v.C(x + w/2, y + h*0.82, Math.min(1.4, w*0.22), D); v.C(x + w/2, y + h*0.08, Math.min(1.4, w*0.22), D);
        v.T(x + w/2, y + h + 0.6*v.s, Math.min(1.25, w/v.s*0.85), c.tag, "M-ETIQUETA", { rot:90, valign:2 }); break; }
      v.R(x, y, w, h, E);
      tornillos(v, x, y + h*0.92, w, c.tipo==="fuente" ? 4 : 2, 2.3, D); tornillos(v, x, y + h*0.08, w, c.tipo==="fuente" ? 4 : 2, 2.3, D);
      v.C(x + w*0.3, y + h*0.72, 1.8, D); v.C(x + w*0.7, y + h*0.72, 1.8, D); v.C(x + w/2, y + h*0.45, Math.min(w*0.25, 6), D);
      etiqueta(v, c); break; }
    case "spd": {
      const np = c.polos || 3;
      for(let k=0;k<np;k++){ const px = x + k*w/np; v.R(px, y, w/np, h, E); v.R(px + w/np/4, y + h*0.55, w/np/2, h*0.14, "M-TIERRA"); v.C(px + w/np/2, y + h*0.9, 2.6, D); }
      v.C(x + w/2, y + h*0.1, 2.6, D);
      etiqueta(v, c); break; }
    case "resistencia": {
      v.R(x, y, w, h, E); for(let xx = x + 6; xx < x + w - 2; xx += 6) v.L(xx, y + h*0.15, xx, y + h*0.85, D);
      etiqueta(v, c); break; }
    // ----- tablero de control: PLC, red, accesorios -----
    case "cpu": {
      v.R(x, y, w, h, E); v.R(x + w*0.12, y + h*0.8, w*0.76, h*0.1, D); v.R(x + w*0.18, y + h*0.83, w*0.4, h*0.04, D);
      v.C(x + w*0.3, y + h*0.67, Math.min(3.5, w*0.06), D); v.R(x + w*0.55, y + h*0.62, w*0.3, h*0.1, D);
      for(let k=0;k<2;k++) v.R(x + w*0.14, y + h*(0.2 + k*0.15), w*0.34, h*0.11, D);
      v.R(x + w*0.6, y + h*0.06, w*0.28, h*0.22, D);
      etiqueta(v, c); break; }
    case "modulo": case "fpd": {
      v.R(x, y, w, h, E); v.R(x + 1.5, y + h*0.86, w - 3, h*0.09, D);
      v.R(x + 1.5, y + h*0.06, w - 3, h*0.74, D);
      const nT = c.tipo==="fpd" ? 2 : 8; for(let k=0;k<nT;k++) v.C(x + w/2, y + h*(0.12 + k*0.62/Math.max(1, nT-1)), Math.min(1.6, w*0.08), D);
      etiqueta(v, c); break; }
    case "tapa": { v.R(x, y, w, h, E); v.L(x + w/2, y + 6, x + w/2, y + h - 6, D); break; }
    case "switch": case "router": {
      v.R(x, y, w, h, E); v.R(x + w*0.1, y + h*0.84, w*0.8, h*0.08, D);
      if(c.tipo==="switch") for(let r=0;r<4;r++) for(let k=0;k<2;k++) v.R(x + w*(0.12 + k*0.42), y + h*(0.2 + r*0.14), w*0.34, h*0.1, D);
      else { for(let k=0;k<2;k++) v.C(x + w*(0.3 + k*0.4), y + h*0.94, Math.min(3, w*0.08), D); for(let r=0;r<3;r++) v.R(x + w*0.2, y + h*(0.2 + r*0.16), w*0.6, h*0.1, D); }
      etiqueta(v, c); break; }
    case "termostato": { v.R(x, y, w, h, E); v.C(x + w/2, y + h*0.55, Math.min(w, h)*0.28, D); v.L(x + w/2, y + h*0.55, x + w/2, y + h*0.55 + Math.min(w, h)*0.24, D); etiqueta(v, c); break; }
    case "tomacorriente": { v.R(x, y, w, h, E); for(let k=0;k<2;k++){ const cx = x + w*(0.27 + k*0.46); v.R(cx - w*0.17, y + h*0.3, w*0.34, h*0.42, D); v.L(cx - 2.5, y + h*0.56, cx - 2.5, y + h*0.64, D); v.L(cx + 2.5, y + h*0.56, cx + 2.5, y + h*0.64, D); v.C(cx, y + h*0.4, 1.5, D); } etiqueta(v, c); break; }
    case "luminaria": { v.R(x, y, w, h, "M-OCULTO"); for(let xx = x + 20; xx < x + w - 10; xx += 25) v.L(xx, y + 4, xx, y + h - 4, "M-OCULTO"); v.T(x + w/2, y - 0.6*v.s, 1.5, `${c.tag} (EN EL TECHO)`, "M-ETIQUETA", { halign:1, valign:3 }); break; }
    case "finpuerta": { v.R(x, y, w, h, E); v.R(x + w*0.3, y + h*0.7, w*0.4, h*0.3, D); v.T(x - 0.6*v.s, y + h/2, 1.4, c.tag, "M-ETIQUETA", { halign:2, valign:2 }); break; }
    case "peine": { v.R(x, y, w, h, "M-COBRE"); break; }
    default: v.R(x, y, w, h, E); etiqueta(v, c);
  }
}

/* =============================== lámina 2: disposición interior =============================== */
function dibujarInterior(v, m){
  const { W, H, zocalo } = m;
  // estructura del gabinete (sin puertas): perfil exterior, marco y separadores de sección
  v.R(0, 0, W, H, "M-GABINETE"); v.R(25, 25, W - 50, H - 50, "M-GABINETE");
  if(zocalo){ v.R(0, -zocalo, W, zocalo, "M-GABINETE"); for(const s of m.secciones.slice(1)) v.L(s.x0, -zocalo, s.x0, 0, "M-GABINETE"); }
  for(const s of m.secciones.slice(1)){ v.R(s.x0 - 25, 25, 50, H - 50, "M-GABINETE"); }
  // placas
  for(const p of m.placas) v.R(p.x, p.y, p.w, p.h, "M-PLACA");
  if(m.zonaAcom){ const z = m.zonaAcom; v.R(z.x, z.y, z.w, z.h, "M-OCULTO"); v.T(z.x + z.w/2, z.y + z.h/2, Math.min(2.4, z.w/v.s*0.35), z.nombre, "M-TEXTO", { halign:1, valign:2, rot:90 }); }
  // canaletas con sus ranuras
  const rotulos = new Set();
  for(const d of m.canaletas){
    v.R(d.x, d.y, d.w, d.h, "M-CANALETA");
    if(d.orient==="h"){ for(let xx = d.x + 12.5; xx < d.x + d.w - 5; xx += 25){ v.L(xx, d.y, xx, d.y + d.h*0.2, "M-CANALETA"); v.L(xx, d.y + d.h, xx, d.y + d.h*0.8, "M-CANALETA"); } }
    else { for(let yy = d.y + 12.5; yy < d.y + d.h - 5; yy += 25){ v.L(d.x, yy, d.x + d.w*0.2, yy, "M-CANALETA"); v.L(d.x + d.w, yy, d.x + d.w*0.8, yy, "M-CANALETA"); } }
    const k = d.placa + d.orient + (d.orient==="h" ? "" : d.x);
    if(!rotulos.has(k) || d.orient==="h"){ rotulos.add(k);
      v.T(d.x + d.w/2, d.y + d.h/2, Math.min(1.6, (Math.min(d.w, d.h)/v.s)*0.3), `CANALETA ${d.nombre}`, "M-TEXTO", d.orient==="h" ? { halign:1, valign:2 } : { halign:1, valign:2, rot:90 }); }
  }
  // rieles DIN: solo en los tramos libres (detrás de los equipos no se ve)
  for(const r of m.rieles){
    const ocup = m.comps.filter(c=>c.placa===r.placa && c.y <= r.y && c.y + c.h >= r.y).map(c=>[c.x, c.x + c.w])
      .concat(m.bornes.filter(b=>b.placa===r.placa && Math.abs(b.y - r.y) < 1).map(b=>[b.x0, b.x1])).sort((a, b)=>a[0] - b[0]);
    let x = r.x; const tramos = [];
    for(const [a, b] of ocup){ if(a > x) tramos.push([x, Math.min(a, r.x + r.w)]); x = Math.max(x, b); }
    if(x < r.x + r.w) tramos.push([x, r.x + r.w]);
    for(const [a, b] of tramos) if(b - a > 2){ v.L(a, r.y + 17.5, b, r.y + 17.5, "M-RIEL"); v.L(a, r.y - 17.5, b, r.y - 17.5, "M-RIEL"); for(let xx = a + 6; xx < b - 6; xx += 25) v.R(xx, r.y - 2.6, 12, 5.2, "M-RIEL"); }
  }
  // barras de fase y tierra
  for(const b of m.barras){
    const ly = b.fase==="PE" ? "M-TIERRA" : "M-COBRE";
    v.R(b.x, b.y, b.w, b.h, ly);
    const nh = b.perforaciones || 0; for(let i=0;i<nh;i++) v.C(b.x + 12.5 + i*25, b.y + b.h/2, Math.min(4, b.h*0.25), ly);
    v.T(b.x - 3*v.s, b.y + b.h/2, 1.8, b.fase, "M-ETIQUETA", { halign:2, valign:2 });
    if(b.fase==="L1" || b.fase==="PE") v.T(b.x + b.w/2, b.y + b.h + 0.8*v.s, 1.6, `BARRA Cu ${b.nombre} mm`, "M-TEXTO", { halign:1 });
  }
  for(const a of m.aisladores){ v.R(a.x - 20, a.y0 - m.fase.ancho/2 - 18, 40, (a.y1 - a.y0) + m.fase.ancho + 36, "M-DETALLE"); for(let k=0;k<3;k++) v.C(a.x, a.y0 + k*m.fase.paso, 9, "M-DETALLE"); }
  // conexiones: pletinas (cobre) y cables de fuerza (trazos)
  for(const cx of m.conexiones){
    if(cx.tipo==="pletina"){ const [a, b] = cx.pts, hw = Math.min(m.fase.ancho, 20)/2; v.L(a[0] - hw, a[1], b[0] - hw, b[1], "M-COBRE"); v.L(a[0] + hw, a[1], b[0] + hw, b[1], "M-COBRE"); v.C(b[0], b[1], 3, "M-COBRE"); }
    else if(cx.tipo==="acometida"){ v.P(cx.pts, "M-CABLE"); }
    else v.P(cx.pts, "M-CABLE");
  }
  // equipos
  for(const c of m.comps) dibujarEquipo(v, c);
  // borneras
  for(const b of m.bornes){
    const hb = Math.max(...b.bornes.map(x=>x.h));
    v.R(b.x0, b.y - hb*0.35, C.TOPE, hb*0.7, "M-DETALLE"); v.R(b.x1 - C.TOPE, b.y - hb*0.35, C.TOPE, hb*0.7, "M-DETALLE");
    for(const x of b.bornes){
      const ly = x.pe ? "M-TIERRA" : "M-EQUIPO";
      v.R(x.x, b.y - x.h/2, x.w, x.h, ly); v.C(x.x + x.w/2, b.y + x.h/2 - 7, Math.min(x.w*0.3, 3), "M-DETALLE"); v.C(x.x + x.w/2, b.y - x.h/2 + 7, Math.min(x.w*0.3, 3), "M-DETALLE");
      v.L(x.x, b.y, x.x + x.w, b.y, "M-DETALLE");
    }
    const ult = b.bornes[b.bornes.length-1]; v.R(ult.x + ult.w, b.y - hb/2, C.TAPA_FINAL, hb, "M-DETALLE");
    v.T((b.x0 + b.x1)/2, b.y + hb/2 + 0.7*v.s, ajustar(b.grupo, (b.x1 - b.x0)/v.s + 2, 1.9, 1.1), b.grupo, "M-ETIQUETA", { halign:1 });
  }
}

/* =============================== lámina 1: vistas exteriores =============================== */
const PUERTA_GAP = 3;
const hojasPuerta = m => C.hojasPuerta(m, PUERTA_GAP);

/* ---------- accesorios de puerta con la forma de los modelos de referencia ---------- */
// rectángulo de esquinas redondeadas (coordenadas reales de la vista)
function rrect(v, xa, ya, xb, yb, r, ly){
  const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb), y0 = Math.min(ya, yb), y1 = Math.max(ya, yb);
  r = Math.max(0, Math.min(r, (x1 - x0)/2, (y1 - y0)/2));
  if(r < 0.01){ v.R(x0, y0, x1 - x0, y1 - y0, ly); return; }
  v.L(x0 + r, y0, x1 - r, y0, ly); v.L(x1, y0 + r, x1, y1 - r, ly); v.L(x1 - r, y1, x0 + r, y1, ly); v.L(x0, y1 - r, x0, y0 + r, ly);
  v.A(x0 + r, y0 + r, r, 180, 270, ly); v.A(x1 - r, y0 + r, r, 270, 360, ly); v.A(x1 - r, y1 - r, r, 0, 90, ly); v.A(x0 + r, y1 - r, r, 90, 180, ly);
}
// rayado a 45° dentro de un polígono convexo (corte / cubierta)
function rayado(v, pts, paso, ly){
  const cs = pts.map(([x, y])=>x - y), c0 = Math.min(...cs), c1 = Math.max(...cs);
  for(let c = c0 + paso/2; c < c1; c += paso){
    const ts = [];
    pts.forEach(([xa, ya], i)=>{ const [xb, yb] = pts[(i+1)%pts.length], fa = xa - ya - c, fb = xb - yb - c;
      if((fa <= 0 && fb > 0) || (fa > 0 && fb <= 0)){ const t = fa/(fa - fb); ts.push([xa + (xb - xa)*t, ya + (yb - ya)*t]); } });
    if(ts.length >= 2){ ts.sort((a, b)=>a[0] - b[0]); v.L(ts[0][0], ts[0][1], ts[ts.length-1][0], ts[ts.length-1][1], ly); }
  }
}
/* manija con bloqueo por candado (lock out): escudo con la palanca, su placa con dos tornillos y el bloque inferior con el
   cilindro de la cerradura (proporciones del modelo de referencia, 40 × 200 mm). x: centro, y0: borde inferior */
function lockoutFrente(v, x, y0, w = C.LOCKOUT.w, h = C.LOCKOUT.h){
  const E = "M-EQUIPO", D = "M-DETALLE", X = px => x + (px - 102.5)*w/155, Y = py => y0 + h - py*h/670;
  rrect(v, X(30), Y(560), X(175), Y(0), w*0.15, E); rrect(v, X(40), Y(550), X(165), Y(10), w*0.1, D);
  v.P([[62,38],[143,38],[153,52],[153,160],[138,205],[138,335],[119,360],[119,498],[128,524],[119,548],[86,548],[77,524],[86,498],[86,360],[67,335],[67,205],[52,160],[52,52]].map(([a, b])=>[X(a), Y(b)]), E, null, true);
  v.R(X(74), Y(326), X(131) - X(74), Y(218) - Y(326), D);
  for(const py of [236, 308]) v.C(X(102.5), Y(py), w*0.04, D);
  rrect(v, X(25), Y(670), X(180), Y(560), w*0.1, E);
  v.C(X(102.5), Y(615), w*0.16, D); v.C(X(102.5), Y(615), w*0.1, D); v.R(X(102.5) - w*0.025, Y(615) - w*0.06, w*0.05, w*0.12, D);
}
/* visor (ventana de inspección con tapa abatible): marco doble, ventana de esquinas redondeadas, dos cierres a la izquierda
   y dos bisagras a la derecha */
function visorFrente(v, z){
  const E = "M-EQUIPO", D = "M-DETALLE", w = z.x1 - z.x0, h = z.y1 - z.y0, V = C.VISOR, wv = C.ventanaVisor(z);
  v.R(z.x0, z.y0, w, h, E); v.R(z.x0 + V.marco, z.y0 + V.marco, w - 2*V.marco, h - 2*V.marco, D);
  rrect(v, wv.x0, wv.y0, wv.x1, wv.y1, wv.r, E); rrect(v, wv.x0 + 4, wv.y0 + 4, wv.x1 - 4, wv.y1 - 4, wv.r - 4, D);
  for(const yc of [z.y0 + V.cierre.y, z.y1 - V.cierre.y]){ const xc = z.x0 + V.cierre.x; v.C(xc, yc, V.cierre.r, E); v.C(xc, yc, V.cierre.r*0.66, D); v.C(xc, yc, V.cierre.r*0.25, D); }
  for(const b of C.bisagrasVisor(z)){ const bw = V.bisagra.w; v.R(z.x1 - bw/2, b.y - b.h/2, bw, b.h, E); v.L(z.x1 + bw/2 - 4, b.y - b.h/2, z.x1 + bw/2 - 4, b.y + b.h/2, D);
    for(const s of [-1, 1]) v.R(z.x1 + bw/2 - 6, b.y + s*b.h/2 - (s < 0 ? 4 : 0), 3, 4, D); }
}
/* caperuza vista de frente: contorno de trazos y rayado de la cubierta sobre el ventilador / filtro (con su TAG) */
function caperuzaFrente(v, c, conTag){
  const x0 = c.x - c.w/2, x1 = c.x + c.w/2, y0 = c.y - c.h/2, y1 = c.y + c.h/2;
  v.R(x0, y0, c.w, c.h, "M-OCULTO");
  rayado(v, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], Math.max(18, c.w/9), "M-DETALLE");
  if(conTag && c.tag) v.T(x1 - 8, y1 - 8, Math.min(2.2, 0.06*c.w/v.s + 1), c.tag, "M-ETIQUETA", { halign:2, valign:3 });
}
/* caperuza vista de costado: perfil con su rayado, desde la cara de la puerta (u0) hacia afuera */
function caperuzaPerfil(v, u0, c, rayar){
  const pts = C.perfilCaperuza(c).map(([u, y])=>[u0 + u, c.y - c.h/2 + y]);
  v.P(pts, "M-EQUIPO", null, false); v.L(pts[pts.length-1][0], pts[pts.length-1][1], pts[0][0], pts[0][1], "M-DETALLE");
  if(rayar) rayado(v, pts, Math.max(18, c.h/14), "M-DETALLE");
}
function colorTxt(c){ return ({ verde:"V", rojo:"R", ambar:"A", azul:"AZ", negro:"", amarillo:"AM" })[c] || ""; }
function dibujarDispositivo(v, d, conLeyenda){
  const E = "M-EQUIPO", D = "M-DETALLE";
  if(d.tipo==="manija"){ v.R(d.x - d.w/2, d.y - d.h/2, d.w, d.h, E); v.C(d.x, d.y, 30, D); v.R(d.x - 9, d.y - 42, 18, 84, E); v.C(d.x, d.y, 6, D); return; }
  if(d.tipo==="panelvfd"){ v.R(d.x - d.w/2, d.y - d.h/2, d.w, d.h, E); v.R(d.x - d.w/2 + 10, d.y + d.h*0.12, d.w - 20, d.h*0.26, D); for(let r=0;r<4;r++) for(let k=0;k<3;k++) v.R(d.x - 26 + k*20, d.y - d.h*0.32 + r*14, 12, 7, D); if(conLeyenda!==false) v.T(d.x, d.y + d.h/2 + 0.8*v.s, 1.6, d.tag, "M-ETIQUETA", { halign:1 }); return; }
  if(d.tipo==="ventilador" || d.tipo==="rejilla"){ v.R(d.x - d.w/2, d.y - d.h/2, d.w, d.h, E); const i = d.w*0.1; v.R(d.x - d.w/2 + i, d.y - d.h/2 + i, d.w - 2*i, d.h - 2*i, D); for(let yy = d.y - d.h/2 + i + 10; yy < d.y + d.h/2 - i; yy += 12) v.L(d.x - d.w/2 + i + 4, yy, d.x + d.w/2 - i - 4, yy, D); if(d.tipo==="ventilador") v.C(d.x, d.y, d.w*0.3, "M-OCULTO"); return; }
  if(d.tipo==="aa"){ v.R(d.x - d.w/2, d.y - d.h/2, d.w, d.h, E); for(let yy = d.y - d.h/2 + 40; yy < d.y + d.h/2 - 20; yy += 18) v.L(d.x - d.w/2 + 30, yy, d.x + d.w/2 - 30, yy, D); return; }
  if(d.tipo==="hmi"){   // pantalla en la puerta: marco frontal, pantalla, teclas y recorte (oculto)
    v.R(d.x - d.w/2, d.y - d.h/2, d.w, d.h, E); v.R(d.x - d.w/2 + 12, d.y - d.h/2 + 22, d.w - 24, d.h - 34, D);
    v.R(d.x - d.recorteW/2, d.y - d.recorteH/2, d.recorteW, d.recorteH, "M-OCULTO");
    v.C(d.x + d.w/2 - 8, d.y - d.h/2 + 10, 2.5, D);
    if(conLeyenda!==false) v.T(d.x, d.y + d.h/2 + 0.8*v.s, 1.8, d.tag, "M-ETIQUETA", { halign:1 });
    return; }
  // dispositivos de 22 mm y parada de emergencia
  const r = (d.diam||30)/2;
  if(d.tipo==="seta"){ v.C(d.x, d.y, (d.anillo||60)/2, "M-SENAL"); v.C(d.x, d.y, 20, E); v.C(d.x, d.y, 14, D); }
  else { v.C(d.x, d.y, r, E); v.C(d.x, d.y, 14, D); v.C(d.x, d.y, 11, D);
    if(d.tipo==="selector"){ v.R(d.x - 3, d.y - 10, 6, 20, E); }
    if(d.tipo==="potenciometro"){ for(let k=0;k<12;k++){ const a = k*Math.PI/6; v.L(d.x + 11*Math.cos(a), d.y + 11*Math.sin(a), d.x + r*Math.cos(a), d.y + r*Math.sin(a), D); } }
    if(d.tipo==="luz"){ v.C(d.x, d.y, 6, D); }
    const ct = colorTxt(d.color); if(ct && conLeyenda!==false) v.T(d.x, d.y, 1.0, ct, D, { halign:1, valign:2 });
  }
  if(conLeyenda!==false && d.leyenda){ const p = C.PUERTA.placa; v.R(d.x - p.w/2, d.y + (d.anillo ? d.anillo/2 : r) + 6, p.w, p.h, D); }
}
function dibujarFrente(v, m, llam){
  const { W, H, zocalo } = m;
  v.R(0, 0, W, H, "M-GABINETE");
  if(zocalo){ v.R(0, -zocalo, W, zocalo, "M-GABINETE"); for(const s of m.secciones.slice(1)) v.L(s.x0, -zocalo, s.x0, 0, "M-GABINETE"); llam.push({ x:0, y:-zocalo/2, texto:`ZÓCALO DE ${zocalo} mm` }); }
  // techo (intemperie) y cáncamos de izaje
  if(m.techoTipo==="inclinado"){ v.R(-40, H, W + 80, 30, "M-GABINETE"); v.R(-40, H + 30, W + 80, 60, "M-GABINETE"); v.L(-40, H + 30, W + 40, H + 90, "M-DETALLE"); llam.push({ x:-40, y:H + 60, texto:"TECHO INCLINADO (CAÍDA HACIA ATRÁS)" }); }
  else if(m.techo){ v.R(-40, H, W + 80, 30, "M-GABINETE"); v.R(-40, H + 30, W + 80, 25, "M-GABINETE"); llam.push({ x:-40, y:H + 28, texto:"TECHO CON ALERO (INTEMPERIE)" }); }
  const yE = H + (m.techoAlto || 0);
  for(const xe of [80, W - 80]){ v.R(xe - 6, yE, 12, 45, "M-GABINETE"); v.C(xe, yE + 55, 14, "M-GABINETE"); v.C(xe, yE + 55, 7, "M-GABINETE"); }
  llam.push({ x:80, y:yE + 55, texto:"CÁNCAMO DE IZAJE" });
  // puertas con bisagras y manijas
  for(const p of hojasPuerta(m)){
    v.R(p.x0, PUERTA_GAP, p.x1 - p.x0, H - 2*PUERTA_GAP, "M-PUERTA");
    const xb = p.bisagra==="izq" ? p.x0 : p.x1;
    for(const yb of [200, H/2, H - 200]) v.R(xb - 6, yb - 40, 12, 80, "M-DETALLE");
  }
  // manijas en el borde de cierre de cada hoja (entre las puertas); con lock out, la manija con bloqueo por candado
  const mjs = C.manijasPuerta(m, PUERTA_GAP);
  for(const mj of mjs){ if(mj.lockout) lockoutFrente(v, mj.x, mj.y0); else { v.R(mj.x - 10, mj.y0, 20, 160, "M-EQUIPO"); v.C(mj.x, mj.y0 + 140, 6, "M-DETALLE"); } }
  llam.push({ x:mjs[0].x + mjs[0].w/2, y:mjs[0].y0 + mjs[0].h/2, texto: m.lockout ? "MANIJA CON BLOQUEO POR CANDADO (LOCK OUT), ENTRE LAS PUERTAS" : "MANIJA CON CERRADURA Y LLAVE" });
  // dispositivos de puerta
  for(const d of m.puerta) dibujarDispositivo(v, d);
  // visores (ventana de inspección IP66) sobre los dispositivos elegidos y caperuzas antilluvia de los ventiladores
  for(const z of m.visores||[]){ visorFrente(v, z); llam.push({ x:z.x1, y:z.y1 - 15, texto:"VISOR IP66 (VENTANA DE INSPECCIÓN CON TAPA ABATIBLE)" }); }
  for(const c of m.caperuzas||[]) caperuzaFrente(v, c, false);
  if((m.caperuzas||[]).length){ const c = m.caperuzas[0]; llam.push({ x:c.x + c.w/2, y:c.y + c.h/2 - 10, texto:"CAPERUZA ANTILLUVIA (VENTILADOR / FILTRO)" }); }
  const q = m.puerta.find(d=>d.tipo==="manija"); if(q) llam.push({ x:q.x, y:q.y + 45, texto:"MANIJA DEL INTERRUPTOR PRINCIPAL Q1" });
  if(m.panel){ const p = m.panel; v.R(p.x, p.y, p.w, p.h, "M-OCULTO"); llam.push({ x:p.x, y:p.y + p.h - 20, texto:"PANEL DE OPERACIÓN (VER LÁMINA 3)" }); }
  const fv = m.puerta.find(d=>d.tipo==="ventilador"), fr = m.puerta.find(d=>d.tipo==="rejilla"), aa = m.puerta.find(d=>d.tipo==="aa");
  if(fv) llam.push({ x:fv.x + fv.w/2, y:fv.y, texto:"VENTILADOR CON FILTRO (ENTRADA DE AIRE)" });
  if(fr) llam.push({ x:fr.x + fr.w/2, y:fr.y, texto:"FILTRO DE SALIDA DE AIRE" });
  if(aa) llam.push({ x:aa.x + aa.w/2, y:aa.y, texto:"AIRE ACONDICIONADO DE PUERTA" });
  for(const d of m.puerta.filter(d=>d.tipo==="panelvfd")) llam.push({ x:d.x + d.w/2, y:d.y, texto:`PANEL DE OPERADOR DE ${d.tag}` });
  if(m.tipo==="control"){
    for(const d of m.puerta.filter(d=>d.tipo==="hmi")) llam.push({ x:d.x + d.w/2, y:d.y + d.h/4, texto:`PANTALLA ${d.tag} (RECORTE ${d.recorteW} x ${d.recorteH} mm)` });
    for(const d of m.puerta.filter(d=>d.tipo==="ventilador" && d.rol==="salida")) llam.push({ x:d.x + d.w/2, y:d.y, texto:`VENTILADOR ${d.tag} CON FILTRO (EXTRACCIÓN DE AIRE)` });
    const lz = m.puerta.find(d=>d.tipo==="luz"); if(lz) llam.push({ x:lz.x + 15, y:lz.y, texto:"LUCES PILOTO DE TENSIÓN PRESENTE" });
  }
  // placa de identificación (140 × 40, arriba) y señal de riesgo eléctrico en cada hoja de puerta (abajo, centrada)
  const pid = C.placaId(m);
  v.R(pid.x - pid.w/2, pid.y - pid.h/2, pid.w, pid.h, "M-EQUIPO");
  const lp = [[(m.tablero.nombre||"").toUpperCase(), 1.1, "M-TEXTO"], [m.tablero.tag, 1.4, "M-ETIQUETA"], [m.placaTxt || `${m.tension} Vac, 3F+T, ${m.frecuencia} Hz`, 1.0, "M-TEXTO"]];
  lp.forEach(([t, h, ly], i)=>v.T(pid.x, pid.y + pid.h*0.25 - i*pid.h*0.25, h, t, ly, { halign:1, valign:2 }));
  llam.push({ x:pid.x - pid.w/2, y:pid.y, texto:"PLACA DE IDENTIFICACIÓN (NOMBRE, TAG Y TENSIÓN)" });
  const sen = C.senalesRiesgo(m);
  for(const { x, y, w, h } of sen){
    v.R(x - w/2, y - h/2, w, h, "M-SENAL");
    // triángulo con rayo en la mitad superior y la leyenda debajo
    const t = w*0.36, yc = y + h*0.16;
    v.P([[x - t, yc - t*0.8], [x + t, yc - t*0.8], [x, yc + t*0.95]], "M-SENAL", null, true);
    v.L(x + t*0.12, yc + t*0.45, x - t*0.12, yc - t*0.05, "M-SENAL"); v.L(x - t*0.12, yc - t*0.05, x + t*0.12, yc - t*0.05, "M-SENAL"); v.L(x + t*0.12, yc - t*0.05, x - t*0.12, yc - t*0.6, "M-SENAL");
    v.T(x, y - h*0.22, 1.3, "ATENCIÓN", "M-SENAL", { halign:1, valign:2 });
    v.T(x, y - h*0.36, 1.1, "RIESGO ELÉCTRICO", "M-SENAL", { halign:1, valign:2 });
  }
  if(sen.length) llam.push({ x:sen[0].x - sen[0].w/2, y:sen[0].y, texto:`SEÑAL «ATENCIÓN / RIESGO ELÉCTRICO» EN ${sen.length > 1 ? "CADA PUERTA" : "LA PUERTA"}` });
}
function dibujarLateral(v, m){
  const { D, H, zocalo } = m;
  v.R(0, 0, D, H, "M-GABINETE"); v.R(20, 20, D - 40, H - 40, "M-OCULTO");
  if(zocalo) v.R(0, -zocalo, D, zocalo, "M-GABINETE");
  // puerta, bisagras y manijas
  v.R(D, PUERTA_GAP, 22, H - 2*PUERTA_GAP, "M-PUERTA");
  { const mj = C.manijasPuerta(m, PUERTA_GAP)[0]; if(mj.lockout){ v.R(D + 22, mj.y0 + mj.h*0.16, 10, mj.h*0.84, "M-EQUIPO"); v.R(D + 32, mj.y0 + mj.h*0.22, mj.prof - 10, mj.h*0.72, "M-EQUIPO"); v.R(D + 22, mj.y0, mj.prof*0.6, mj.h*0.16, "M-EQUIPO"); }
    else v.R(D + 22, mj.y0, mj.prof, mj.h, "M-EQUIPO"); }
  const q = m.puerta.find(d=>d.tipo==="manija"); if(q){ v.R(D + 22, q.y - 40, 55, 80, "M-EQUIPO"); }
  const pv = m.puerta.filter(d=>d.tipo==="panelvfd"); for(const d of pv) v.R(D + 22, d.y - d.h/2, 18, d.h, "M-DETALLE");
  // placa de montaje y envolvente de los equipos (ocultos)
  v.L(C.ZPLACA || 25, 75, C.ZPLACA || 25, H - 80, "M-OCULTO");
  const dmax = Math.max(...m.comps.filter(c=>m.tipo!=="control" || !c.z0).map(c=>(c.z||25) + (c.d||0)));
  if(m.tipo==="control"){ const pl = m.placas[0]; v.R(25, pl.y, dmax - 25, pl.h, "M-OCULTO");
    for(const d of m.puerta.filter(d=>d.tipo==="hmi")){ v.R(D - d.prof, d.y - d.recorteH/2, d.prof, d.recorteH, "M-OCULTO"); v.R(D + 22, d.y - d.h/2, 6, d.h, "M-DETALLE"); }
    for(const d of m.puerta.filter(d=>d.tipo==="ventilador")) v.R(D + 22, d.y - d.h/2, 14, d.h, "M-DETALLE"); }
  else v.R(25, 75, dmax - 25, H - 155, "M-OCULTO");
  if(m.techo){ v.P([[-40, H], [D + 60, H], [D + 60, H + 30], [-40, H + (m.techoAlto || 55)]], "M-GABINETE", null, true); }
  // visores y caperuzas vistos de costado: sobresalen de la puerta (la caperuza con su abertura hacia abajo)
  for(const z of m.visores||[]){ v.R(D + 22, z.y0, z.prof, z.y1 - z.y0, "M-DETALLE"); v.L(D + 22 + z.prof - 6, z.y0 + 4, D + 22 + z.prof - 6, z.y1 - 4, "M-DETALLE"); }
  for(const c of m.caperuzas||[]) caperuzaPerfil(v, D + 22, c, false);
  const yE = H + (m.techoAlto || 0);
  for(const xe of [80, D - 80]){ v.R(xe - 6, yE, 12, 45, "M-GABINETE"); v.C(xe, yE + 55, 14, "M-GABINETE"); }
}
/* isométrica: x (ancho) hacia la derecha-abajo, profundidad hacia la derecha-arriba, y hacia arriba */
function isometrica(doc, ox, oy, s, m){
  const c30 = Math.cos(Math.PI/6), s30 = 0.5;
  const P = (x, y, e) => [ox + (x + e)*c30/s, oy + (y + (e - x)*s30)/s];
  const L = (a, b, ly) => doc.line(a[0], a[1], b[0], b[1], ly || "M-GABINETE");
  const poly = (pts, ly) => { for(let i=0;i<pts.length;i++) L(pts[i], pts[(i+1)%pts.length], ly); };
  const { W, H, D, zocalo } = m, y0 = -zocalo;
  // caras visibles: frontal (e=0), lateral derecha (x=W) y superior (y=H)
  poly([P(0, y0, 0), P(W, y0, 0), P(W, H, 0), P(0, H, 0)]);
  poly([P(W, y0, 0), P(W, y0, D), P(W, H, D), P(W, H, 0)]);
  poly([P(0, H, 0), P(W, H, 0), P(W, H, D), P(0, H, D)]);
  if(zocalo){ L(P(0, 0, 0), P(W, 0, 0)); L(P(W, 0, 0), P(W, 0, D)); }
  for(const s of m.secciones.slice(1)){ L(P(s.x0, H, 0), P(s.x0, H, D), "M-DETALLE"); }
  // puertas, manijas y dispositivos
  for(const p of hojasPuerta(m)) poly([P(p.x0, PUERTA_GAP, 0), P(p.x1, PUERTA_GAP, 0), P(p.x1, H - PUERTA_GAP, 0), P(p.x0, H - PUERTA_GAP, 0)], "M-PUERTA");
  // manijas en el borde de cierre de cada hoja (con lock out: escudo con palanca y bloque de la cerradura)
  for(const mj of C.manijasPuerta(m, PUERTA_GAP)){
    if(mj.lockout){ const xa = mj.x - mj.w/2, xb = mj.x + mj.w/2, yb = mj.y0 + mj.h*0.164, e = -mj.prof;
      poly([P(xa, yb, 0), P(xb, yb, 0), P(xb, mj.y0 + mj.h, 0), P(xa, mj.y0 + mj.h, 0)], "M-EQUIPO");
      poly([P(xa + 6, yb + 30, e), P(xb - 6, yb + 30, e), P(xb - 6, mj.y0 + mj.h - 8, e), P(xa + 6, mj.y0 + mj.h - 8, e)], "M-DETALLE");
      L(P(xb - 6, yb + 30, e), P(xb - 6, yb + 30, 0), "M-DETALLE"); L(P(xb - 6, mj.y0 + mj.h - 8, e), P(xb - 6, mj.y0 + mj.h - 8, 0), "M-DETALLE");
      poly([P(xa - 1, mj.y0, 0), P(xb + 1, mj.y0, 0), P(xb + 1, yb, 0), P(xa - 1, yb, 0)], "M-EQUIPO"); }
    else poly([P(mj.x - 10, mj.y0, 0), P(mj.x + 10, mj.y0, 0), P(mj.x + 10, mj.y0 + 160, 0), P(mj.x - 10, mj.y0 + 160, 0)], "M-EQUIPO");
  }
  const elipse = (cx, cy, r, ly) => { const pts = []; for(let k=0;k<20;k++){ const a = k*Math.PI/10; pts.push(P(cx + r*Math.cos(a), cy + r*Math.sin(a), 0)); } poly(pts, ly); };
  for(const d of m.puerta){
    if(d.w){ poly([P(d.x - d.w/2, d.y - d.h/2, 0), P(d.x + d.w/2, d.y - d.h/2, 0), P(d.x + d.w/2, d.y + d.h/2, 0), P(d.x - d.w/2, d.y + d.h/2, 0)], "M-EQUIPO"); if(d.tipo==="manija") elipse(d.x, d.y, 30, "M-DETALLE"); }
    else { elipse(d.x, d.y, (d.anillo||d.diam||30)/2, d.tipo==="seta" ? "M-SENAL" : "M-EQUIPO"); }
  }
  // placa de identificación y señal de riesgo eléctrico de cada puerta
  const pid = C.placaId(m), rectIso = (x0, y0, x1, y1, ly) => poly([P(x0, y0, 0), P(x1, y0, 0), P(x1, y1, 0), P(x0, y1, 0)], ly);
  rectIso(pid.x - pid.w/2, pid.y - pid.h/2, pid.x + pid.w/2, pid.y + pid.h/2, "M-EQUIPO");
  for(const { x, y, w, h } of C.senalesRiesgo(m)){ rectIso(x - w/2, y - h/2, x + w/2, y + h/2, "M-SENAL"); const t = w*0.36, yc = y + h*0.16; poly([P(x - t, yc - t*0.8, 0), P(x + t, yc - t*0.8, 0), P(x, yc + t*0.95, 0)], "M-SENAL"); }
  // techo y cáncamos
  if(m.techo){ const hf = m.techoTipo==="inclinado" ? 90 : 30;   // alto del techo en el frente (inclinado: cae hacia atrás)
    poly([P(-40, H + hf, -40), P(W + 40, H + hf, -40), P(W + 40, H + 30, D + 40), P(-40, H + 30, D + 40)]); L(P(-40, H, -40), P(-40, H + hf, -40)); L(P(W + 40, H, -40), P(W + 40, H + hf, -40)); L(P(W + 40, H, D + 40), P(W + 40, H + 30, D + 40)); L(P(-40, H, -40), P(W + 40, H, -40)); L(P(W + 40, H, -40), P(W + 40, H, D + 40)); }
  // visores: caja que sobresale de la puerta con su ventana de esquinas redondeadas
  for(const z of m.visores||[]){ const e = -z.prof, wv = C.ventanaVisor(z);
    poly([P(z.x0, z.y0, e), P(z.x1, z.y0, e), P(z.x1, z.y1, e), P(z.x0, z.y1, e)], "M-EQUIPO");
    poly([P(z.x1, z.y0, 0), P(z.x1, z.y0, e), P(z.x1, z.y1, e), P(z.x1, z.y1, 0)], "M-EQUIPO"); L(P(z.x0, z.y1, 0), P(z.x0, z.y1, e), "M-EQUIPO"); L(P(z.x0, z.y1, 0), P(z.x1, z.y1, 0), "M-EQUIPO");
    poly([P(wv.x0, wv.y0, e), P(wv.x1, wv.y0, e), P(wv.x1, wv.y1, e), P(wv.x0, wv.y1, e)], "M-DETALLE"); }
  // caperuzas: frente vertical, cara inclinada y tapa superior (perfil de la referencia), abiertas hacia abajo
  for(const c of m.caperuzas||[]){
    const x0 = c.x - c.w/2, x1 = c.x + c.w/2, y0 = c.y - c.h/2, pf = C.perfilCaperuza(c).map(([u, y])=>[-u, y0 + y]);   // e = -salida
    const [, pTop, pIncl, pFr, pBase] = pf;
    for(const [a, b] of [[pTop, pIncl], [pIncl, pFr], [pFr, pBase]]) poly([P(x0, a[1], a[0]), P(x1, a[1], a[0]), P(x1, b[1], b[0]), P(x0, b[1], b[0])], "M-EQUIPO");
    poly(pf.map(([e, y])=>P(x1, y, e)), "M-EQUIPO");
  }
  const yE = H + (m.techoTipo==="inclinado" ? 90 : m.techo ? 30 : 0);
  for(const [xe, ee] of [[80, 80], [W - 80, 80], [80, D - 80], [W - 80, D - 80]]){ L(P(xe, yE, ee), P(xe, yE + 45, ee)); const pts = []; for(let k=0;k<16;k++){ const a = k*Math.PI/8; pts.push(P(xe + 14*Math.cos(a), yE + 59 + 14*Math.sin(a), ee)); } poly(pts); }
}

/* ---------- lámina 3: detalles de los accesorios de puerta ----------
   Ventilador y filtro de salida (con su caperuza si la lleva): corte lateral (cuerpo dentro del tablero, puerta, rejilla y
   perfil de la caperuza rayado) y frente (rejilla, contorno de trazos y rayado de la caperuza, con su TAG), como el modelo
   de referencia; visor (frente) y manija con lock out (frente y costado). Una sola escala, en la caja libre (mm de lámina). */
function detallesAccesorios(doc, caja, m){
  const items = [];
  for(const d of [m.puerta.find(x=>x.tipo==="ventilador"), m.puerta.find(x=>x.tipo==="rejilla")].filter(Boolean)){
    const cap = (m.caperuzas||[]).find(c=>c.tag===d.tag) || null, fd = d.tipo==="ventilador" ? Math.round(d.w*0.42) : Math.round(d.w*0.12);
    const hh = cap ? cap.h : d.h + 40, sal = cap ? cap.prof : 14;
    items.push({ tipo:"vent", d, cap, fd, vistas:[fd + 22 + sal + 20, (cap ? cap.w : d.w + 40)], h:hh,
      titulo:`${d.tipo==="ventilador" ? "VENTILADOR" : "FILTRO DE SALIDA"} ${d.tag}${cap ? " CON CAPERUZA" : ""}` });
  }
  if((m.visores||[]).length){ const z = m.visores[0]; items.push({ tipo:"visor", z, vistas:[z.x1 - z.x0 + 12, z.prof + 10], h:z.y1 - z.y0, titulo:"VISOR IP66 CON TAPA ABATIBLE" }); }
  if(m.lockout) items.push({ tipo:"lockout", vistas:[C.LOCKOUT.w + 6, C.LOCKOUT.prof + 6], h:C.LOCKOUT.h, titulo:"MANIJA CON LOCK OUT" });
  if(!items.length) return;
  const W = caja.x1 - caja.x0, H = caja.y1 - caja.y0, GAP = 14, GV = 16;
  // ancho de cada detalle en la lámina: sus vistas o su título (lo que sea mayor)
  const vistasW = (it, s) => it.vistas.reduce((b, w)=>b + w/s, 0) + GV*(it.vistas.length - 1);
  const itemW = (it, s) => Math.max(vistasW(it, s), ("%%U" + it.titulo).length*3.5*0.8 - 8);
  const ancho = s => items.reduce((a, it)=>a + itemW(it, s), 0) + GAP*(items.length - 1);
  const s = ESCALAS.find(e=>ancho(e) <= W - 4 && Math.max(...items.map(it=>it.h))/e + 46 + 20/e <= H);
  if(!s) return;
  doc.text(caja.x0, caja.y1, 2.8, "%%UDETALLES DE ACCESORIOS DE PUERTA", "M-TEXTO");
  // títulos debajo de los textos de las vistas («INTERIOR», «ABERTURA HACIA ABAJO»), todos a la misma altura
  const dT = Math.max(16, 20/s + 9), yBase = caja.y0 + 8 + dT + Math.max(0, (H - 46 - 20/s - Math.max(...items.map(it=>it.h))/s)/2);
  let x = caja.x0 + Math.max(0, (W - ancho(s))/2);
  for(const it of items){
    const x0 = x, xFin = x0 + itemW(it, s);
    x += (itemW(it, s) - vistasW(it, s))/2;
    if(it.tipo==="vent"){
      const { d, cap, fd } = it, u0 = fd + 6;                     // u: salida desde la cara interior de la puerta
      const yc = it.h/2, dd = Object.assign({}, d, { x:0, y:yc }), cc = cap && Object.assign({}, cap, { x:0, y:yc });
      // corte lateral: cuerpo del ventilador dentro del tablero, puerta, rejilla exterior y perfil de la caperuza
      const v1 = vista(doc, x - 0, yBase, s), U = u => u;
      // puerta (con el recorte por donde pasa el ventilador)
      const rc = (d.recorte || d.h*0.9)/2;
      for(const uu of [u0, u0 + 22]){ v1.L(U(uu), -20, U(uu), yc - rc, "M-PUERTA"); v1.L(U(uu), yc + rc, U(uu), it.h + 20, "M-PUERTA"); }
      for(const yy of [-20, it.h + 20, yc - rc, yc + rc]) v1.L(U(u0), yy, U(u0 + 22), yy, "M-PUERTA");
      v1.R(U(u0 - fd), yc - d.h*0.45, fd, d.h*0.9, "M-EQUIPO");
      if(d.tipo==="ventilador"){ v1.R(U(u0 - fd*0.92), yc - d.h*0.2, fd*0.55, d.h*0.4, "M-DETALLE"); for(const f of [-0.3, 0, 0.3]) v1.L(U(u0 - fd*0.35), yc + f*d.h, U(u0), yc + f*d.h, "M-DETALLE"); }
      v1.R(U(u0 + 22), yc - d.h/2, 10, d.h, "M-EQUIPO");
      for(let yy = yc - d.h/2 + 8; yy < yc + d.h/2 - 4; yy += 12) v1.L(U(u0 + 22), yy, U(u0 + 32), yy + 6, "M-DETALLE");
      if(cc){ caperuzaPerfil(v1, u0 + 22, cc, true);
        cotaV(doc, v1.Y(0), v1.Y(it.h), v1.X(u0 + 22 + cap.prof) + 6, v1.X(u0 + 22 + cap.prof), String(cap.h));
        cotaH(doc, v1.X(u0 + 22), v1.X(u0 + 22 + cap.prof), v1.Y(it.h) + 6, v1.Y(it.h), String(cap.prof));
        doc.text(v1.X(u0 + 22 + cap.prof/2), v1.Y(-20) - 2.5, 1.6, "ABERTURA HACIA ABAJO", "M-TEXTO", { halign:1, valign:3 }); }
      doc.text(v1.X(u0 - fd/2), v1.Y(-20) - 2.5, 1.6, "INTERIOR", "M-TEXTO", { halign:1, valign:3 });
      x += it.vistas[0]/s + GV;
      // frente: rejilla del ventilador y, encima, la caperuza (contorno de trazos y rayado) con su TAG
      const wF = it.vistas[1], v2 = vista(doc, x + wF/(2*s), yBase, s);
      dibujarDispositivo(v2, dd, false);
      if(cc){ caperuzaFrente(v2, cc, true); cotaH(doc, v2.X(-cap.w/2), v2.X(cap.w/2), v2.Y(it.h) + 6, v2.Y(it.h), String(cap.w)); }
      else { v2.T(d.w/2 - 8, yc + d.h/2 - 8, 1.6, d.tag, "M-ETIQUETA", { halign:2, valign:3 }); cotaH(doc, v2.X(-d.w/2), v2.X(d.w/2), v2.Y(yc + d.h/2) + 6, v2.Y(yc + d.h/2), String(d.w)); }
      x += wF/s;
    } else if(it.tipo==="visor"){
      const z = it.z, w = z.x1 - z.x0, v1 = vista(doc, x - z.x0/s, yBase - z.y0/s, s);
      visorFrente(v1, z);
      cotaH(doc, v1.X(z.x0), v1.X(z.x1), v1.Y(z.y1) + 6, v1.Y(z.y1), String(Math.round(w)));
      cotaV(doc, v1.Y(z.y0), v1.Y(z.y1), v1.X(z.x0) - 5, v1.X(z.x0), String(Math.round(z.y1 - z.y0)));
      x += it.vistas[0]/s + GV;
      const v2 = vista(doc, x, yBase, s); v2.R(0, 0, 6, it.h, "M-PUERTA"); v2.R(6, 0, z.prof - 8, it.h, "M-EQUIPO"); v2.R(z.prof - 2, it.h*0.04, 4, it.h*0.92, "M-DETALLE");
      x += it.vistas[1]/s;
    } else {
      const L = C.LOCKOUT, v1 = vista(doc, x + L.w/(2*s), yBase, s);
      lockoutFrente(v1, 0, 0);
      cotaV(doc, v1.Y(0), v1.Y(L.h), v1.X(-L.w/2) - 5, v1.X(-L.w/2), String(L.h));
      cotaH(doc, v1.X(-L.w/2), v1.X(L.w/2), v1.Y(L.h) + 6, v1.Y(L.h), String(L.w));
      x += it.vistas[0]/s + GV;
      const v2 = vista(doc, x, yBase, s); v2.R(0, L.h*0.16, 10, L.h*0.84, "M-EQUIPO"); v2.R(10, L.h*0.22, L.prof - 10, L.h*0.72, "M-EQUIPO"); v2.R(0, 0, L.prof*0.6, L.h*0.16, "M-EQUIPO");
      x += it.vistas[1]/s;
    }
    tituloVista(doc, (x0 + xFin)/2, yBase - dT, it.titulo, escTxt(s));
    x = xFin + GAP;
  }
}

/* =============================== generador =============================== */
export async function mecanicoKit({ p, valsDe, cliente, id }, tipo){
  const doc = new DXFDoc();
  Object.assign(doc.capas, CAPAS); Object.assign(doc.tiposLinea, TIPOS_LINEA);
  // tipo "control": tableros de control (js/mecanico/arreglo-control.js); si no, los de fuerza
  const modelos = tipo==="control" ? arreglosControl(p) : arreglosProyecto(p);
  if(!modelos.length){
    dibujarLamina(doc, 0, 0, valsDe(0, 1, {}), cliente);
    doc.text(AR.x0 + 30, AR.y1 - 40, 4, tipo==="control" ? "EL PROYECTO NO TIENE TABLEROS DE CONTROL." : "EL PROYECTO NO TIENE TABLEROS DE FUERZA CON CARGAS.", "M-TEXTO");
    return { dxf: doc.toDXF(), hojas:1, modelos };
  }
  const total = modelos.length*4;
  let k = 0;
  for(const m of modelos){
    const t = m.tablero, nombre = `${(t.nombre||"").toUpperCase()} ${t.tag}`;
    const lam = (sub)=>{ dibujarLamina(doc, k*PASO_HOJAS, 0, valsDe(k, total, { TITULO2:`${nombre} - ${sub}`, ESCALA:"INDICADA" }), cliente); return k*PASO_HOJAS; };
    const hTot = m.H + m.zocalo + (m.techoAlto || 0) + 70;

    // ---------- lámina 1: vistas exteriores ----------
    let ox = lam("VISTAS EXTERIORES");
    const isoW = (m.W + m.D)*Math.cos(Math.PI/6), isoH = m.H + m.zocalo + (m.W + m.D)*0.5 + 70;
    const s1 = ESCALAS.find(s=>(m.W + m.D + 120)/s + 70 + 55 + 30 + isoW/s*0.55 <= (AR.x1 - AR.x0) - 20 && hTot/s + 30 <= (AR.y1 - AR.y0) - 20) || 50;
    const altoDisp = (AR.y1 - 12) - (AR.y0 + 24);
    const yBase = AR.y0 + 24 + Math.max(0, (altoDisp - hTot/s1)*0.45) + (m.zocalo)/s1;
    const xF = ox + AR.x0 + 72, llamF = [];
    const vF = vista(doc, xF, yBase, s1);
    dibujarFrente(vF, m, llamF);
    llamadas(doc, llamF.filter(l=>l.x < m.W*0.5).map(l=>({ x:vF.X(l.x), y:vF.Y(l.y), texto:l.texto })), xF - 15, "izq");
    const derF = llamF.filter(l=>l.x >= m.W*0.5).map(l=>({ x:vF.X(l.x), y:vF.Y(l.y), texto:l.texto }));
    const xL = vF.X(m.W) + (derF.length ? 58 : 30);
    llamadas(doc, derF, vF.X(m.W) + 4, "der");
    cotaH(doc, vF.X(0), vF.X(m.W), vF.Y(-m.zocalo) - 9, vF.Y(-m.zocalo), String(m.W));
    let xc = vF.X(0);
    if(m.secciones.length > 1) for(const s of m.secciones){ cotaH(doc, vF.X(s.x0), vF.X(s.x1), vF.Y(-m.zocalo) - 4.5, vF.Y(-m.zocalo), String(s.W)); }
    cotaV(doc, vF.Y(0), vF.Y(m.H), xc - 6, xc, String(m.H));
    if(m.zocalo) cotaV(doc, vF.Y(-m.zocalo), vF.Y(0), xc - 6, xc, String(m.zocalo));
    tituloVista(doc, vF.X(m.W/2), vF.Y(-m.zocalo) - 16, "VISTA FRONTAL", escTxt(s1));
    const vL = vista(doc, xL, yBase, s1);
    dibujarLateral(vL, m);
    cotaH(doc, vL.X(0), vL.X(m.D), vL.Y(-m.zocalo) - 9, vL.Y(-m.zocalo), String(m.D));
    tituloVista(doc, vL.X(m.D/2), vL.Y(-m.zocalo) - 16, "VISTA LATERAL DERECHA", escTxt(s1));
    // isométrica en el espacio restante (sin escala), notas debajo
    const xIso0 = vL.X(m.D + 80) + 18, xIso1 = ox + AR.x1 - 8;
    const notas = id ? datos(p).notas[id] || [] : [];   // solo las notas del usuario (sin notas, la lámina no lleva notas)
    const xNot1 = ox + RES.x0 - 6;                               // las notas no invaden el bloque del cajetín
    const anchoNot = Math.max(80, xNot1 - xIso0);
    const altoNotas = !notas.length ? 0 : notas.reduce((a, n)=>a + envolver(n, Math.floor(anchoNot/(1.9*0.78)) - 4).length*2.76 + 0.8, 0) + 10;
    const yIsoTop = AR.y1 - 10, yIsoBot = AR.y0 + altoNotas + 12;
    const sIso = Math.max((isoW)/Math.max(40, xIso1 - xIso0 - 10), (isoH)/Math.max(40, yIsoTop - yIsoBot - 14));
    const isoOx = xIso0 + Math.max(0, ((xIso1 - xIso0) - isoW/sIso)/2), isoOy = yIsoBot + 10 + (m.W*0.5 + m.zocalo)/sIso;
    isometrica(doc, isoOx, isoOy, sIso, m);
    tituloVista(doc, (xIso0 + xIso1)/2, yIsoBot + 4, "VISTA ISOMÉTRICA", "SIN ESCALA");
    if(notas.length) parrafos(doc, xIso0, yIsoBot - 6, anchoNot, "NOTAS:", notas, 1.9);
    k++;

    // ---------- lámina 2: disposición interior ----------
    ox = lam("DISPOSICIÓN DE EQUIPOS");
    const anchoTabla = 250;
    const s2 = ESCALAS.find(s=>m.W/s + 95 <= (AR.x1 - AR.x0) - anchoTabla - 20 && (m.H + m.zocalo)/s + 52 <= (AR.y1 - AR.y0) - 12) || 50;
    const libreV = (AR.y1 - AR.y0) - 12 - ((m.H + m.zocalo)/s2 + 52);
    const vI = vista(doc, ox + AR.x0 + 40, AR.y0 + 30 + Math.max(0, libreV*0.5) + m.zocalo/s2, s2);
    dibujarInterior(vI, m);
    cotaH(doc, vI.X(0), vI.X(m.W), vI.Y(m.H) + 6, vI.Y(m.H), String(m.W));
    cotaV(doc, vI.Y(0), vI.Y(m.H), vI.X(0) - 6, vI.X(0), String(m.H));
    for(const pl of m.placas){ cotaH(doc, vI.X(pl.x), vI.X(pl.x + pl.w), vI.Y(-m.zocalo) - 5, vI.Y(pl.y), String(r1(pl.w))); doc.text(vI.X(pl.x + pl.w/2), vI.Y(-m.zocalo) - 10.5, 2.2, pl.nombre, "M-ETIQUETA", { halign:1 }); }
    const plU = m.placas[m.placas.length-1]; cotaV(doc, vI.Y(plU.y), vI.Y(plU.y + plU.h), vI.X(m.W) + 6, vI.X(plU.x + plU.w), String(r1(plU.h)));
    const llamI = [];
    if(m.barras.some(b=>b.fase==="L1")){ const b = m.barras.find(b=>b.fase==="L3"); llamI.push({ x:vI.X(b.x + b.w), y:vI.Y(b.y), texto:`BARRAS L1-L2-L3 Cu ${m.fase.nombre} mm SOBRE AISLADORES` }); }
    llamadas(doc, llamI, vI.X(m.W) + 14, "der");
    tituloVista(doc, vI.X(m.W/2), vI.Y(-m.zocalo) - 17, "DISPOSICIÓN DE EQUIPOS - PLACAS DE MONTAJE (SIN PUERTAS)", escTxt(s2));
    // detalle de borneras
    const xT = ox + AR.x1 - anchoTabla - 4;
    if(m.tipo!=="control") doc.text(xT, AR.y1 - 8, 3, "%%UDETALLE DE BORNERAS", "M-TEXTO");
    const filasB = [];
    for(const b of m.bornes){
      filasB.push({ grupo:b.grupo, n:"", modelo:"", destino:b.desc.toUpperCase(), __titulo:true });
      for(const x of b.bornes) filasB.push({ grupo:"", n:x.n, modelo:x.modelo, destino: destinoBorne(b, x) });
    }
    const maxFilas = Math.floor(((AR.y1 - 14) - (AR.y0 + 8))/3.6) - 2;
    if(m.tipo==="control"){
      // varias columnas en el espacio libre a la derecha de la vista (las del pie no invaden el cajetín)
      const xL0 = vI.X(m.W) + 22, libreT = (ox + AR.x1 - 4) - xL0, nC = Math.max(1, Math.min(4, Math.floor(libreT/175))), wC = Math.min(250, libreT/nC - 4);
      const xs = Array.from({ length:nC }, (_, i)=>ox + AR.x1 - 4 - (nC - i)*(wC + 4));
      doc.text(xs[0], AR.y1 - 8, 3, "%%UDETALLE DE BORNERAS", "M-TEXTO");
      let i0 = 0;
      xs.forEach((x0, ci)=>{ const yMin = x0 + wC > ox + RES.x0 ? RES.y1 + 6 : AR.y0 + 8, n = Math.floor(((AR.y1 - 14) - yMin)/3.6) - 2;
        let n2 = Math.min(n, filasB.length - i0); if(n2 > 0 && i0 + n2 < filasB.length && filasB[i0 + n2 - 1].__titulo) n2--;
        if(n2 > 0) tabla(doc, x0, AR.y1 - 12, [{ titulo:"BORNERA", key:"grupo", w:20, al:"centro" }, { titulo:"BORNE", key:"n", w:12, al:"centro" }, { titulo:"MODELO", key:"modelo", w:24, al:"centro" }, { titulo:"CONEXIÓN / DESTINO", key:"destino", w:wC - 56 }], filasB.slice(i0, i0 + n2), { h:3.6, fs:1.5 });
        i0 += Math.max(0, n2); });
      if(i0 < filasB.length) doc.text(xs[0], AR.y0 + 4, 1.8, `(continúa: ${filasB.length - i0} filas más en la lista de materiales)`, "M-TEXTO");
    } else {
    tabla(doc, xT, AR.y1 - 12, [{ titulo:"BORNERA", key:"grupo", w:22, al:"centro" }, { titulo:"BORNE", key:"n", w:14, al:"centro" }, { titulo:"MODELO", key:"modelo", w:28, al:"centro" }, { titulo:"CONEXIÓN / DESTINO", key:"destino", w:anchoTabla - 64 }],
      filasB.slice(0, maxFilas), { h:3.6, fs:1.55 });
    if(filasB.length > maxFilas) doc.text(xT, AR.y0 + 4, 1.8, `(continúa: ${filasB.length - maxFilas} filas más en la lista de materiales)`, "M-TEXTO");
    }
    k++;

    // ---------- lámina 3: panel de operación y base ----------
    ox = lam("PANEL DE OPERACIÓN Y BASE");
    const pn = m.panel || { x:m.W/2 - 150, y:m.H*0.55, w:300, h:200, seccion:m.secciones[0].id, zona:true, titulo:"PUERTA (SIN DISPOSITIVOS DE OPERACIÓN)" }, ops = m.puerta.filter(d=>d.seccion===pn.seccion && ["luz","pulsador","selector","potenciometro","seta","hmi"].includes(d.tipo));
    const colIzq = 290;
    // la parada de emergencia puede ir fuera del panel (debajo, en su eje): la vista abarca ambos
    const yMinP = Math.min(pn.y, ...ops.map(d=>d.y - (d.anillo || d.diam || 30)/2 - 40)), hP = pn.y + pn.h - yMinP;
    const s3 = [2, 2.5, 3, 4, 5, 7.5].find(s=>hP/s <= 300 && pn.w/s <= colIzq - 40) || 7.5;
    const vP = vista(doc, ox + AR.x0 + 30 + (colIzq - 40 - pn.w/s3)/2 - pn.x/s3, AR.y1 - 16 - (pn.y + pn.h)/s3, s3);
    if(pn.zona) vP.R(pn.x, pn.y, pn.w, pn.h, "M-OCULTO");
    else { vP.R(pn.x, pn.y, pn.w, pn.h, "M-EQUIPO"); vP.R(pn.x + 12, pn.y + 12, pn.w - 24, pn.h - 24, "M-DETALLE");
    for(const [cx2, cy2] of [[pn.x + 6, pn.y + 6], [pn.x + pn.w - 6, pn.y + 6], [pn.x + 6, pn.y + pn.h - 6], [pn.x + pn.w - 6, pn.y + pn.h - 6]]) vP.C(cx2, cy2, 3, "M-DETALLE"); }
    for(const d of ops){
      dibujarDispositivo(vP, d, true);
      if(d.leyenda){ const pl = C.PUERTA.placa, yy = d.y + (d.anillo ? d.anillo/2 : (d.diam||30)/2) + 6 + pl.h/2;
        const lin = envolver(d.leyenda, 12).slice(0, 3); lin.forEach((t2, i)=>vP.T(d.x, yy + ((lin.length - 1)/2 - i)*4.8, Math.min(1.5, 1.6*4/s3), t2, "M-TEXTO", { halign:1, valign:2 })); }
      if(d.tag && d.tipo!=="seta" && d.tipo!=="hmi") vP.T(d.x + 17, d.y - 17, 1.2, d.tag, "M-ETIQUETA");
      if(d.tipo==="hmi"){ const x0 = d.x - d.recorteW/2, y0 = d.y - d.recorteH/2;
        cotaH(doc, vP.X(x0), vP.X(x0 + d.recorteW), vP.Y(d.y + d.h/2) + 8, vP.Y(y0 + d.recorteH), `RECORTE ${d.recorteW}`);
        cotaV(doc, vP.Y(y0), vP.Y(y0 + d.recorteH), vP.X(d.x + d.w/2) + 6, vP.X(x0 + d.recorteW), `RECORTE ${d.recorteH}`);
        vP.T(d.x, d.y, Math.min(2.2, 9/s3), "PANTALLA", "M-TEXTO", { halign:1, valign:2 }); vP.T(d.x, d.y - 4.5*s3, Math.min(1.8, 7/s3), String(d.modelo||"").toUpperCase(), "M-TEXTO", { halign:1, valign:2 }); }
    }
    const epb = ops.find(d=>d.tipo==="seta"); if(epb){ vP.T(epb.x, epb.y - 38, 1.6, "PARADA DE EMERGENCIA", "M-SENAL", { halign:1 }); vP.T(epb.x + 34, epb.y, 1.6, "EPB1", "M-ETIQUETA", { valign:2 }); }
    if(pn.zona){ const hm = ops.find(d=>d.tipo==="hmi"); if(hm) doc.text(vP.X(pn.x + pn.w/2), vP.Y(pn.y) - 7, 1.9, `CENTRO DEL RECORTE A ${r1(hm.y + m.zocalo)} mm DE LA BASE DEL GABINETE Y A ${r1(hm.x - m.secciones.find(x=>x.id===pn.seccion).x0)} mm DE SU BORDE IZQUIERDO`, "M-TEXTO", { halign:1 }); }
    else { cotaH(doc, vP.X(pn.x), vP.X(pn.x + pn.w), vP.Y(pn.y + pn.h) + 7, vP.Y(pn.y + pn.h), String(r1(pn.w)));
    cotaV(doc, vP.Y(pn.y), vP.Y(pn.y + pn.h), vP.X(pn.x) - 7, vP.X(pn.x), String(r1(pn.h))); }
    tituloVista(doc, vP.X(pn.x + pn.w/2), vP.Y(yMinP) - 17, (pn.titulo || "PANEL DE OPERACIÓN") + " (PUERTA " + (m.secciones.findIndex(x=>x.id===pn.seccion) + 1) + ")", escTxt(s3));
    // leyenda de dispositivos de puerta (debajo del panel)
    const xLey = ox + AR.x0 + 8, yLey = vP.Y(yMinP) - 30;
    doc.text(xLey, yLey, 2.8, "%%ULEYENDA DE DISPOSITIVOS DE PUERTA", "M-TEXTO");
    const filasLey = m.puerta.map(d=>({ tag:d.tag||"", tipo:d.leyenda || d.desc || "", modelo:d.modelo || (C.PUERTA[d.tipo]||{}).modelo || "", color:d.color||"" }));
    const nLey = Math.max(3, Math.floor((yLey - 4 - (AR.y0 + 6) - 6)/3.8));
    tabla(doc, xLey, yLey - 4, [{ titulo:"TAG", key:"tag", w:22, al:"centro" }, { titulo:"FUNCIÓN / LEYENDA", key:"tipo", w:100 }, { titulo:"DISPOSITIVO", key:"modelo", w:136 }, { titulo:"COLOR", key:"color", w:16, al:"centro" }], filasLey.slice(0, nLey), { h:3.8, fs:1.55 });
    // base del tablero (vista superior de la placa pasacables), a la derecha
    const xR0 = ox + AR.x0 + colIzq + 20, xR1 = ox + AR.x1 - 12;
    const sB = ESCALAS.find(s=>(m.W + 60)/s <= (xR1 - xR0) - 20 && (m.D + 60)/s <= 190) || 50;
    const yBTop = AR.y1 - 22;
    const vB = vista(doc, xR0 + 10 + Math.max(0, ((xR1 - xR0) - 20 - m.W/sB)/2), yBTop - m.D/sB, sB);
    vB.R(0, 0, m.W, m.D, "M-GABINETE"); vB.R(25, 25, m.W - 50, m.D - 50, "M-OCULTO");
    for(const sc of m.secciones){ if(sc.x0 > 0) vB.L(sc.x0, 0, sc.x0, m.D, "M-GABINETE"); vB.R(sc.x0 + 60, 50, sc.W - 120, m.D - 100, "M-DETALLE"); }
    vB.T(m.W/2, -4*sB, 2, "FRENTE (PUERTAS)", "M-TEXTO", { halign:1, valign:3 });
    for(const r of m.comps.filter(c=>c.tipo==="reactancia")){ vB.R(r.x, 25, r.w, r.d, "M-OCULTO"); vB.T(r.x + r.w/2, 25 + r.d/2, 1.5, `BASE DE ${r.tag}`, "M-TEXTO", { halign:1, valign:2 }); }
    const yFila = f => m.D*(f ? 0.3 : 0.62);
    m.base.forEach((c, i)=>{ const cy = c.zb ?? yFila(c.fila||0); vB.C(c.x, cy, c.agujero/2, c.ref==="RESERVA" ? "M-OCULTO" : "M-EQUIPO");
      if(c.ref!=="RESERVA"){ vB.L(c.x - c.agujero/2 - 4, cy, c.x + c.agujero/2 + 4, cy, "M-EJE"); vB.L(c.x, cy - c.agujero/2 - 4, c.x, cy + c.agujero/2 + 4, "M-EJE");
        const nro = m.base.filter(x=>x.ref!=="RESERVA").indexOf(c) + 1; vB.T(c.x, cy + c.agujero/2 + 1.2*sB, Math.min(1.8, Math.max(1.1, 30/sB)), String(nro), "M-ETIQUETA", { halign:1 }); } });
    cotaH(doc, vB.X(0), vB.X(m.W), vB.Y(m.D) + 5, vB.Y(m.D), String(m.W));
    cotaV(doc, vB.Y(0), vB.Y(m.D), vB.X(m.W) + 6, vB.X(m.W), String(m.D));
    tituloVista(doc, (xR0 + xR1)/2, vB.Y(0) - 12, `BASE DEL TABLERO - ENTRADA ${m.entrada.toUpperCase()} DE CABLES`, escTxt(sB));
    // tabla de prensaestopas (numeradas como en la vista)
    const filasG = m.base.filter(c=>c.ref!=="RESERVA").map((c, i)=>({ n:i+1, ref:c.ref, desc:c.desc, cable:c.awg || "—", d:c.diam ? r1(c.diam) : "—", pe:c.rosca, ag:String(c.agujero).replace(".", ",") }))
      .concat([{ n:"", ref:"RESERVA", desc:`${m.base.filter(c=>c.ref==="RESERVA").length} agujeros con tapón ciego`, cable:"", d:"", pe: m.tipo==="control" ? [...new Set(m.base.filter(c=>c.ref==="RESERVA").map(c=>c.rosca))].join(" / ") : "M32", ag: m.tipo==="control" ? [...new Set(m.base.filter(c=>c.ref==="RESERVA").map(c=>String(c.agujero).replace(".", ",")))].join(" / ") : "32,5" }]);
    const yG = vB.Y(0) - 26;
    doc.text(xR0, yG + 4, 2.8, "%%UPRENSAESTOPAS DE LA BASE", "M-TEXTO");
    const colsG = [{ titulo:"N°", key:"n", w:9, al:"centro" }, { titulo:"REF.", key:"ref", w:22, al:"centro" }, { titulo:"CIRCUITO / CABLE", key:"desc", w:112 }, { titulo:"CALIBRE", key:"cable", w:22, al:"centro" }, { titulo:"Ø EXT. (mm)", key:"d", w:18, al:"centro" }, { titulo:"PRENSAESTOPA", key:"pe", w:24, al:"centro" }, { titulo:"AGUJERO (mm)", key:"ag", w:20, al:"centro" }];
    const wG = colsG.reduce((a, c)=>a + c.w, 0);
    // si la tabla llega al bloque del cajetín, se limita su largo
    const yMinG = (xR0 + wG > ox + RES.x0) ? RES.y1 + 4 : AR.y0 + 4;
    const nG = Math.max(2, Math.floor((yG - yMinG - 6)/3.8));
    const hG = tabla(doc, xR0, yG, colsG, filasG.slice(0, nG), { h:3.8, fs:1.55 });
    // detalles de los accesorios de puerta (ventilador / filtro con caperuza, visor y lock out) en el espacio libre de abajo
    detallesAccesorios(doc, { x0:xR0, x1:ox + AR.x1 - 8, y0:ox ? RES.y1 + 8 : RES.y1 + 8, y1:yG - hG - 12 }, m);
    k++;

    // ---------- lámina 4: lista de materiales, criterios y balance térmico ----------
    ox = lam("LISTA DE MATERIALES Y CRITERIOS");
    doc.text(ox + AR.x0 + 6, AR.y1 - 8, 3, "%%ULISTA DE MATERIALES (DIMENSIONES ANCHO x ALTO x FONDO EN mm)", "M-TEXTO");
    const colsBom = [{ titulo:"ÍTEM", key:"n", w:9, al:"centro" }, { titulo:"TAG", key:"tag", w:20, al:"centro" }, { titulo:"DESCRIPCIÓN", key:"desc", w:150 }, { titulo:"MODELO / CÓDIGO", key:"modelo", w:110 }, { titulo:"CANT.", key:"cant", w:14, al:"centro" }, { titulo:"DIMENSIONES", key:"dim", w:34, al:"centro" }, { titulo:"MONTAJE", key:"montaje", w:20, al:"centro" }];
    const filasBom = m.bom.map((f, i)=>Object.assign({ n:i+1 }, f));
    const hFila = Math.max(3.4, Math.min(5, ((AR.y1 - 12) - (AR.y0 + 6) - 6)/Math.max(1, filasBom.length)));
    const porCol = Math.floor(((AR.y1 - 12) - (AR.y0 + 6) - 6)/hFila);
    const hB = tabla(doc, ox + AR.x0 + 6, AR.y1 - 12, colsBom, filasBom.slice(0, porCol), { h:hFila, fs:Math.min(1.8, hFila*0.42) });
    const xC = ox + AR.x0 + 6 + colsBom.reduce((a, c)=>a + c.w, 0) + 12;
    let yC = AR.y1 - 8;
    if(filasBom.length > porCol){ doc.text(xC, yC, 2.6, "%%ULISTA DE MATERIALES (CONTINUACIÓN)", "M-TEXTO"); const h2 = tabla(doc, xC, yC - 4, [colsBom[0], colsBom[1], Object.assign({}, colsBom[3], { w:90 }), colsBom[4]], filasBom.slice(porCol, porCol*2), { h:3.4, fs:1.45 }); yC -= h2 + 12; }
    const anchoC = (ox + AR.x1 - 6) - xC;
    const tm = m.termico;
    const term = [`Pérdidas internas estimadas: ${tm.perdidas} W (${tm.notaPerdidas || "equipos a corriente nominal + barras y conexiones"}).`,
      `Superficie efectiva de disipación (IEC 60890, gabinete contra la pared): ${tm.superficie} m², k = ${tm.k} W/m²K.`,
      `Temperatura de diseño del sitio ${tm.tAmb} °C; temperatura interior máxima ${tm.tiMax} °C; altitud ${tm.altitud} m s.n.m. (factor de caudal ${tm.fAlt}).`,
      tm.modo==="forzada" ? (m.tipo==="control" ? `Ventilación forzada: ${tm.caudal} m³/h requeridos; ventilador de entrada abajo y de extracción arriba, con filtro, mandados por termostato (ver vista frontal).` : `Ventilación forzada: ${tm.caudal} m³/h con ${tm.ventiladores} ventilador(es) con filtro y filtro(s) de salida (ver vista frontal).`) : tm.modo==="aire acondicionado" ? `Se requiere aire acondicionado de ${tm.potenciaFrio} W (temperatura de diseño ≥ temperatura interior admisible).` : `Ventilación natural: la disipación de la envolvente (${tm.disipacion||0} W) cubre las pérdidas.`];
    if(xC + 60 < ox + AR.x1){
      yC -= parrafos(doc, xC, yC, anchoC, "CRITERIOS DE DISEÑO APLICADOS", m.criterios, 1.75) + 6;
      yC -= parrafos(doc, xC, yC, anchoC, "BALANCE TÉRMICO", term, 1.75) + 6;
      if(m.avisos.length) yC -= parrafos(doc, xC, yC, anchoC, "OBSERVACIONES PARA REVISIÓN", m.avisos, 1.75) + 6;
      parrafos(doc, xC, Math.max(yC, RES.y1 + 30), anchoC, "FUENTE DE LAS DIMENSIONES", [`Dimensiones tomadas de la base de datos de componentes de Ingenia (catálogos de los fabricantes: ${m.tipo==="control" ? "ABB, Allen-Bradley, Siemens, Phoenix Contact, Teltonika, Rittal, STEGO" : "ABB, Allen-Bradley, Phoenix Contact"} y gabinetes normalizados). Son referenciales: verificar con el plano dimensional del código exacto antes de fabricar.`], 1.6);
    }
    k++;
  }
  return { dxf: doc.toDXF(), hojas: total, modelos };
}

function destinoBorne(b, x){
  if(x.dest) return x.dest;
  if(b.grupo==="TB1") return x.n==="1" ? "BOBINA DE MÍNIMA TENSIÓN Q1 (U<) - EPB1" : "RETORNO BOBINA U< / CB1";
  if(x.pe) return "TIERRA DE PROTECCIÓN (BARRA PE)";
  if(b.grupo==="X1") return `${x.fun==="N" ? "NEUTRO" : "FASE"} - SALIDA DE ${x.ref||""}`;
  const c = b.desc.replace(/^Salida a\s*/i, "").toUpperCase();
  return `${x.n} - ${c}`;
}
function notasPlano(m){
  const t = m.tablero;
  return [
    `EL PRESENTE PLANO SOLO ES VÁLIDO PARA EL ${(t.nombre||"TABLERO").toUpperCase()} ${t.tag}.`,
    "LAS DIMENSIONES SE MUESTRAN EN MILÍMETROS.",
    "LAS CARACTERÍSTICAS, CANTIDADES Y TAGS DE LOS COMPONENTES SE ENCUENTRAN EN EL DIAGRAMA MULTIFILAR DEL TABLERO; LA DISTRIBUCIÓN INTERNA EN LA LÁMINA 2.",
    "LA MANIJA DEL INTERRUPTOR PRINCIPAL Q1 ES DE MANDO ROTATIVO EN PUERTA CON ENCLAVAMIENTO DE PUERTA Y BLOQUEO CON CANDADO, GRADO DE PROTECCIÓN IGUAL AL DEL GABINETE.",
    "LA SEÑALÉTICA DE RIESGO ELÉCTRICO Y EL NIVEL DE TENSIÓN SERÁN FOTOLUMINISCENTES.",
    `GABINETE ${m.montaje==="mural" ? "MURAL" : "AUTOSOPORTADO"} DE PLANCHA DE ACERO, ${m.ip.toUpperCase()}, PINTURA EPÓXICA RAL 7035; PLACAS DE MONTAJE GALVANIZADAS.`,
    `ENTRADA DE CABLES ${m.entrada.toUpperCase()} POR PLACA PASACABLES CON PRENSAESTOPAS (LÁMINA 3).`,
    "LA BARRA DE TIERRA SE CONECTARÁ A LA MALLA DE PUESTA A TIERRA; PUERTAS Y PLACAS CON CINTA DE COBRE TRENZADO DE EQUIPOTENCIALIDAD.",
    "LAS DIMENSIONES DE LOS COMPONENTES SON REFERENCIALES (CATÁLOGO DEL FABRICANTE); EL FABRICANTE DEL TABLERO VERIFICARÁ CON LOS EQUIPOS SUMINISTRADOS.",
  ];
}

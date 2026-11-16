/* Ingenia — ARQUITECTURA DEL SISTEMA DE CONTROL armada con las piezas del plano de arquitectura de referencia del
   usuario (assets/plantillas/planos/arquitectura.json): imágenes de los equipos del tablero de control (switch
   Ethernet, router IIoT, pantalla HMI, PLC, variadores, controlador de limpieza) y de los instrumentos de campo
   (transmisores, sensores, interruptores de nivel / velocidad, válvulas solenoides) con su leyenda de cables.
   · Los equipos del tablero salen de equiposControl() (mismos TAG del unifilar, multifilar y mecánico).
   · Los instrumentos se agrupan por destino y señal: 4-20 mA y discretos al PLC, válvulas y presión diferencial
     al controlador de limpieza; cada grupo cuelga de su barra y se reparte CENTRADO en el ancho del sistema.
   · Si las filas de campo no entran, continúan en otra lámina. */
import { DXFDoc } from "../engine/tablero-core.js";
import { dibujarLamina, PASO_HOJAS, notasLamina } from "./formato.js";
import { datos, tablerosControl, tc as tcPrincipal, instrumentos, tableroDeInstrumento, expandirTag, tipoInstrumento, esAnalogico, esSalida, calcularTodos, tableroPorId, tf, esControl, sistemaNombre, sistemaTag } from "../datos.js";
import { cargarKit, usarKit, pieza, envolver, cajaPieza } from "./kit.js";
import { equiposControl } from "../control/equipos.js";
import { repartirEquilibrado } from "./plano-unifilar.js";

const may = s => String(s||"").toUpperCase();
// zona del sistema en la lámina A1 (el rótulo ocupa la esquina inferior derecha; la leyenda va a la derecha)
const SX0 = 40, SX1 = 676, SY0 = 60, SY1 = 552, LEY = { x:762, y:556 };
const PASO_INST = 42, PASO_XV = 35.4, ALTO_FILA = 92;

/* imagen de cada instrumento según sus letras ISA */
function imagen(tag){
  const L = tipoInstrumento(tag);
  if(/^(XV|SV|FV|PV|LV|TV|HV|XY|SY)$/.test(L)) return "img_xv";
  if(/^VT|^VIT|^VE/.test(L)) return "img_vt";
  if(/^AT|^AIT|^AE/.test(L)) return "img_at";
  if(/^LS/.test(L)) return "img_lsh";
  if(/^SS|^ST|^SIT/.test(L)) return /^SS/.test(L) ? "img_ssl" : "img_pit";
  if(/S[HL]{0,2}$/.test(L) && L.length >= 2 && L[1]==="S" || /^[A-Z]SH?L?$/.test(L)) return "img_ss";
  return "img_pit";
}
function controladoPor(p, l){ const tl = tableroPorId(p, l.tablero) || tf(p); return esControl(tl) ? tl : (tl.control && tableroPorId(p, tl.control)) || tcPrincipal(p); }

/* dispositivos de campo del tablero, agrupados por destino (PLC / controlador de limpieza) y tipo de señal */
function campo(p, t, eq){
  const enLimpieza = i => t.controladorLimpieza && (/^PD(I)?T$/.test(tipoInstrumento(i.tag)) || /^XV$|^SV$/.test(tipoInstrumento(i.tag)));
  const dv = { ana:[], dis:[], sal:[], limp:[] };
  for(const i of instrumentos(p)){
    if(tableroDeInstrumento(p, i).id!==t.id) continue;
    if(/^\s*N\.?\s*A\.?\s*$/i.test(i.tipoSenal||"") && !/^XV|^SV/.test(tipoInstrumento(i.tag))) continue;   // indicadores locales
    for(const tag of expandirTag(i.tag)){ if(!tag) continue;
      const d = { tag, i, img: imagen(tag), analog: esAnalogico(i), senal: esAnalogico(i) ? "4-20 mA" : (esSalida(i) ? (i.alimentacion||"120 Vac").replace(/\s*\/.*$/,"") : t.ioDiscreto||"120 Vac") };
      if(enLimpieza(i)) dv.limp.push(d); else if(esSalida(i)) dv.sal.push(d); else if(d.analog) dv.ana.push(d); else dv.dis.push(d);
    }
  }
  return dv;
}

export async function arquitecturaKit({ p, valsDe, cliente, id }){
  const kit = await cargarKit("arquitectura");
  const doc = new DXFDoc(); usarKit(doc, kit);
  const lista = tablerosControl(p).length ? tablerosControl(p) : [tcPrincipal(p)];
  const planes = lista.map(t=>{
    const eq = equiposControl(p, t), dv = campo(p, t, eq);
    const vfds = calcularTodos(p).flatMap(c=>c.circuits).filter(c=>c.kind==="motor" && c.load && c.load.starter==="vfd" && controladoPor(p, c.load).id===t.id);
    // filas de campo: instrumentos al PLC (analógicos y luego discretos, en la misma fila si entran) y válvulas
    const util = (SX1 - SX0) - 30;
    const filas = [];
    const alPlc = [...dv.ana.map(d=>Object.assign(d, { bus:"ana" })), ...dv.dis.map(d=>Object.assign(d, { bus:"dis" })), ...dv.sal.map(d=>Object.assign(d, { bus:"sal" }))];
    if(alPlc.length) repartirEquilibrado(alPlc, ()=>PASO_INST, util).forEach(f=>filas.push({ origen:"plc", devs:f, paso:PASO_INST }));
    if(dv.limp.length) repartirEquilibrado(dv.limp, d=>d.img==="img_xv" ? PASO_XV : PASO_INST, util).forEach(f=>filas.push({ origen:"limpieza", devs:f, paso: f.every(d=>d.img==="img_xv") ? PASO_XV : PASO_INST }));
    // la primera lámina admite el tablero y 3 filas; las siguientes, 5 filas
    const hojas = [filas.slice(0, 3)]; for(let k=3; k<filas.length; k+=5) hojas.push(filas.slice(k, k+5));
    return { t, eq, dv, vfds, hojas };
  });
  const total = planes.reduce((a, x)=>a + x.hojas.length, 0);
  let k = 0;
  for(const pl of planes){
    pl.hojas.forEach((filas, ih)=>{
      const ox = k*PASO_HOJAS;
      dibujarLamina(doc, ox, 0, valsDe(k, total, { TITULO2: `${may(pl.t.nombre||"Tablero de control")} ${pl.t.tag}${pl.hojas.length>1 ? ` (${ih+1} DE ${pl.hojas.length})` : ""}` }), cliente);
      dibujarHoja(doc, kit, ox, p, pl, filas, ih);
      if(k===0) notasLamina(doc, ox, 0, datos(p).notas[id || "ins-arquitectura"], { y1: 470 });
      k++;
    });
  }
  return { dxf: doc.toDXF(), hojas: total };
}

/* cable ortogonal (vertical → horizontal → vertical) */
function cable(doc, x1, y1, x2, y2, capa, yMedio){
  const ym = yMedio ?? (y1 + y2)/2;
  doc.polyline([[x1, y1], [x1, ym], [x2, ym], [x2, y2]], capa);
}
function textoCentrado(doc, x, yTop, lineas, h=2.5){ lineas.forEach((ln, i)=>doc.text(x, yTop - i*h*1.6667, h, ln, "G-TEX", { halign:1, valign:3 })); }
function textoIzq(doc, x, yTop, lineas, h=2.5){ lineas.forEach((ln, i)=>doc.text(x, yTop - i*h*1.6667, h, ln, "G-TEX", { valign:3 })); }

function dibujarHoja(doc, kit, ox, p, pl, filas, ih){
  const { t, eq, vfds } = pl;
  const X = x => ox + x;
  const st = sistemaTag(p);
  // recuadro del sistema y leyenda
  doc.polyline([[X(SX0), SY0], [X(SX1), SY0], [X(SX1), SY1], [X(SX0), SY1], [X(SX0), SY0]], "G-VARIOS");
  textoIzq(doc, X(SX0) + 2, SY1 + 13, [may(sistemaNombre(p) || "SISTEMA DE CONTROL"), st].filter(Boolean), 3);
  pieza(doc, kit, "leyenda", X(LEY.x), LEY.y, { vars:{ vctrl: t.ioDiscreto || "120 Vac" } });

  let yFilas = SY1 - 14;
  const fuente = {};   // origen de cada barra de campo: { x, y }
  if(ih===0){
    // ---------- tablero de control ----------
    const nV = vfds.length, Wp = Math.max(330, 250 + nV*46), Hp = 168;
    const px0 = X(SX0 + 14), px1 = px0 + Wp, py1 = SY1 - 22, py0 = py1 - Hp;
    doc.polyline([[px0, py0], [px1, py0], [px1, py1], [px0, py1], [px0, py0]], "I-EQ");
    textoIzq(doc, px0 + 2, py1 + 9.5, [may(t.nombre || "Tablero de control"), t.tag], 2.5);
    const base = String(t.redIP || "192.168.1").replace(/\.$/, "");
    const ip = n => `${base}.${n}`;
    const put = (nombre, cx, cy) => { pieza(doc, kit, nombre, cx, cy); const b = cajaPieza(kit, nombre); return { x0:cx + b[0], y0:cy + b[1], x1:cx + b[2], y1:cy + b[3], cx, cy }; };
    const red = Object.fromEntries(eq.red.map(r=>[r.tipo, r]));
    const sw = red.switch ? put("sw", px0 + 30, py1 - 40) : null;
    const rut = red.router ? put("router", px0 + 26, py0 + 44) : null;
    const hmi = red.hmi ? put("hmi", px0 + 70, py0 + 44) : null;
    const plc = put("plc", px0 + 165, py1 - 78);
    const lim = eq.limpieza ? put("limpieza", px0 + 118, py0 + 30) : null;
    const vs = vfds.map((c, i)=>({ c, b: put("vfd", px0 + 262 + i*46, py1 - 70) }));
    // rótulos
    const rot = (b, lineas, abajo) => textoCentrado(doc, b.cx, abajo ? b.y0 - 2.5 : b.y1 + 2 + (lineas.length)*2.5*1.6667 - 2.5*0.66, lineas, 2.3);
    if(sw){ rot(sw, ["SWITCH ETHERNET", red.switch.tag]); doc.text(sw.x1 + 2, sw.y1 - 4, 2.1, ip(10), "G-TEX"); }
    if(rut){ rot(rut, ["ROUTER IIOT", red.router.tag]); doc.text(rut.cx, rut.y0 - 2.5, 2.1, ip(21), "G-TEX", { halign:1, valign:3 }); }
    if(hmi){ rot(hmi, ["PANTALLA HMI", red.hmi.tag]); doc.text(hmi.cx, hmi.y0 - 2.5, 2.1, ip(20), "G-TEX", { halign:1, valign:3 }); }
    rot(plc, ["CONTROLADOR (PLC)", eq.plc.cpu.modelo || ""].filter(Boolean));
    // módulos del rack (cambian con el listado I/O): CPU y cada módulo con su slot
    const mods = ["CPU (0)", ...eq.plc.modulos.map(m=>`${m.tag} (${m.slot})`)].join(" · ");
    envolver(mods, 44).forEach((ln, i)=>doc.text(plc.cx, plc.y0 - 3 - i*3.6, 2, ln, "G-TEX", { halign:1, valign:3 }));
    doc.text(plc.x0 - 2, plc.y0 + 4, 2.1, ip(11), "G-TEX", { halign:2 });
    if(lim) textoCentrado(doc, lim.cx, lim.y0 - 2.5, envolver("CONTROLADOR DE LIMPIEZA "+eq.limpieza.tag, 16), 2.3);
    vs.forEach(({ c, b }, i)=>{ rot(b, ["VARIADOR DE", "FRECUENCIA", c.load.tag || ""].filter(Boolean)); doc.text(b.cx, b.y0 - 2.5, 2.1, ip(12 + i), "G-TEX", { halign:1, valign:3 }); });
    // red Ethernet desde el switch (capa I-DAT); cada equipo con su propio puerto
    if(sw){
      let port = 0; const py = k => sw.y1 - 8 - k*5.5;
      const aEquipo = (b, lado) => { const y = py(port++); cable(doc, lado==="izq" ? sw.x0 : sw.x1, y, b.cx, b.y1, "I-DAT", y); doc.text(Math.min(sw.x1, b.cx) + 4, y + 0.8, 2, t.vfdMando==="red" || !/vfd/.test(lado) ? (eq.plc.red || "ETHERNET/IP").toUpperCase() : "ETHERNET/IP", "G-TEX"); };
      aEquipo(plc, "der");
      vs.forEach(v=>aEquipo(v.b, "der-vfd"));
      if(hmi){ const y = py(port++); doc.polyline([[sw.x1, y], [sw.x1 + 6, y], [sw.x1 + 6, hmi.y1 + 8], [hmi.cx, hmi.y1 + 8], [hmi.cx, hmi.y1]], "I-DAT"); }
      if(rut){ const y = py(port++); doc.polyline([[sw.x0, y], [sw.x0 - 6, y], [sw.x0 - 6, rut.y1 + 6], [rut.cx, rut.y1 + 6], [rut.cx, rut.y1]], "I-DAT"); }
      // red externa
      const ye = sw.y1 - 3;
      doc.line(sw.x1, ye, X(SX1) - 70, ye, "I-DAT");
      textoIzq(doc, X(SX1) - 66, ye + 4, envolver(may(t.redExterna || "Red de control hacia DCS / sala de control"), 18), 2.3);
    }
    // mando cableado de los variadores (estados y referencia de velocidad) desde el PLC
    if(t.vfdMando!=="red") vs.forEach(({ b }, i)=>{ const y = plc.y0 - 8 - i*5; cable(doc, plc.x1 - 6 - i*3, plc.y0, b.cx, b.y0, "I-CONTROL", y); doc.text(b.cx + 1.5, b.y0 - 8, 2, `${t.ioDiscreto||"120 Vac"} / 4-20 mA`, "G-TEX", { rot:90, halign:2 }); });
    if(lim){ cable(doc, plc.x0 + 12, plc.y0, lim.x1, lim.cy, "I-SE-ANALO", null); }
    fuente.plc = { x: plc.cx, y: plc.y0 };
    fuente.limpieza = lim ? { x: lim.cx, y: lim.y0 } : fuente.plc;
    fuente.py0 = py0;
    yFilas = py0 - 26;
  }

  // ---------- filas de dispositivos de campo ----------
  // cada fila: barra arriba, bajada a cada equipo, imagen y rótulo; la altura depende de la imagen más alta.
  // Las barras llegan desde el PLC / controlador por un troncal a la izquierda (sin cruzar otras filas).
  const capaSenal = d => d.analog ? "I-SE-ANALO" : "I-CONTROL";
  const BAJADA = 24, LINEAS = 4*2.3*1.6667 + 4;
  let yBus = yFilas, carril = 0;
  const xTroncal = k => X(SX0) + 7 + k*3.2;
  filas.forEach((f, r)=>{
    const n = f.devs.length, W = n*f.paso;
    const x0 = X(SX0) + 22 + ((SX1 - SX0 - 22) - W)/2 + f.paso/2;
    f.devs.forEach((d, i)=>{ d.x = x0 + i*f.paso; });
    const hImg = Math.max(...f.devs.map(d=>{ const b = cajaPieza(kit, d.img); return b[3] - b[1]; }));
    // barras por tipo de señal (una por grupo contiguo)
    const grupos = [];
    for(const d of f.devs){ const g = grupos[grupos.length-1]; if(g && g.bus===d.bus && g.capa===capaSenal(d)) g.devs.push(d); else grupos.push({ bus:d.bus, capa:capaSenal(d), devs:[d] }); }
    grupos.forEach((g, gi)=>{
      const a = g.devs[0].x, b = g.devs[g.devs.length-1].x;
      const yb = yBus - gi*2.5;
      const src = ih===0 ? fuente[f.origen] : null;
      const xt = xTroncal(carril);
      if(src){
        const yp = fuente.py0 - 5 - carril*3;
        doc.polyline([[src.x - 8 + carril*4, src.y], [src.x - 8 + carril*4, yp], [xt, yp], [xt, yb], [b, yb]], g.capa);
      } else {
        doc.polyline([[xt, yBus + 12], [xt, yb], [b, yb]], g.capa);
        if(gi===0) doc.text(X(SX0) + 4, yBus + 14, 2.1, `VIENE DE LA HOJA 1 (${f.origen==="plc" ? "PLC" : "CONTROLADOR DE LIMPIEZA"})`, "G-TEX");
      }
      carril++;
      for(const d of g.devs){
        doc.circle(d.x, yb, 0.6, g.capa);
        const yImg = yBus - BAJADA;
        doc.line(d.x, yb, d.x, yImg, g.capa);
        doc.text(d.x - 1.5, yb - 3, 2.3, d.senal, "G-TEX", { rot:90, halign:2 });
        pieza(doc, kit, d.img, d.x, yImg);
        const bb = cajaPieza(kit, d.img);
        const desc = envolver(may(d.i.descripcion || "Instrumento"), 16).slice(0, 3);
        textoCentrado(doc, d.x, yImg - hImg - 3, [...desc, (st ? st.replace(/-/g,"")+"-" : "") + d.tag], 2.3);
      }
    });
    yBus -= BAJADA + hImg + 3 + LINEAS + 12;
  });
}

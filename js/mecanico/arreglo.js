/* Ingenia — motor de ARREGLO MECÁNICO de tableros de fuerza (y fuerza-control).
   A partir del cálculo del tablero (los mismos equipos y TAG del diagrama multifilar) dispone cada componente con
   criterio de diseñador:
   · flujo de energía de arriba hacia abajo: interruptor general y barras arriba, derivaciones colgadas de las
     barras, arrancadores debajo y borneras abajo, junto a la entrada de cables (o arriba si la entrada es superior);
   · fuerza y control en placas separadas (placa de control a la izquierda con filas de riel DIN y canaletas,
     placa de fuerza a la derecha con barras, interruptores en caja moldeada, variadores y reactancias), como el
     plano de referencia del usuario;
   · cada guardamotor encima de su contactor (misma columna, cableado vertical corto) y las borneras TBn en el
     orden de los circuitos del multifilar, agrupadas en una sola fila con tapas y separadores;
   · variadores con los espacios libres del fabricante, reactancias en la base por su peso, equipos que disipan
     calor arriba de los sensibles no;
   · canaletas dimensionadas por cantidad de conductores, reserva de espacio por fila, gabinete normalizado elegido
     por dimensiones reales y balance térmico (IEC 60890) con ventilación forzada o aire acondicionado si hace falta.
   Coordenadas: mm, origen en la esquina inferior izquierda del cuerpo del gabinete (sin zócalo), x a la derecha,
   y hacia arriba, z desde la pared posterior hacia la puerta. Todo lo cambiable por el usuario (o por Copito)
   vive en datos(p).mecanico[tablero.id]. */
import { calcularTablero, datos, ipRecomendado, tablerosPotencia, desdeTxt, accesoriosTablero, fusiblesAcometida } from "../datos.js";
import { valoresDiseno, tempDiseno } from "../modules/criterios.js";
import * as C from "./componentes.js";
import { marcasProyecto, modeloEnMarca } from "../engine/marcas.js";

export const CFG_DEF = () => ({ montaje:"auto", ancho:"", alto:"", fondo:"", entrada:"inferior", reserva:"", ventilacion:"auto", mandos:"auto", calefaccion:"auto", tInterior:"",
  canaleta:"", ladoControl:"izq", q1Lado:"auto", panelSeccion:"auto", panelAltura:0, mover:[] });
/* ajustes del arreglo que el usuario (o Copito) pide sobre equipos concretos */
export const ACCIONES_MOVER = { izquierda:"a la izquierda", derecha:"a la derecha", arriba:"una fila arriba", abajo:"una fila abajo", inicio:"al inicio de su fila", final:"al final de su fila", antes:"antes de", despues:"después de", intercambiar:"intercambiar con" };
const intercambiar = (a, i, j) => { const x = a[i]; a[i] = a[j]; a[j] = x; };
/* reubica el elemento i de una lista; devuelve true, "limite" (ya está en el extremo) o false */
function reubicar(lista, i, accion, j){
  if(i < 0) return false;
  if(accion==="izquierda" || accion==="arriba"){ if(i===0) return "limite"; intercambiar(lista, i, i-1); return true; }
  if(accion==="derecha" || accion==="abajo"){ if(i===lista.length-1) return "limite"; intercambiar(lista, i, i+1); return true; }
  if(accion==="inicio"){ if(i===0) return "limite"; lista.unshift(lista.splice(i, 1)[0]); return true; }
  if(accion==="final"){ if(i===lista.length-1) return "limite"; lista.push(lista.splice(i, 1)[0]); return true; }
  if(j==null || j < 0 || j===i) return false;
  if(accion==="intercambiar"){ intercambiar(lista, i, j); return true; }
  const ref = lista[j], x = lista.splice(i, 1)[0];
  lista.splice(lista.indexOf(ref) + (accion==="despues" ? 1 : 0), 0, x);
  return true;
}
export function cfgMecanico(p, t){
  const d = datos(p); d.mecanico = d.mecanico || {};
  // se completa en el mismo objeto (los formularios y Copito guardan sobre esta referencia)
  const c = d.mecanico[t.id] = d.mecanico[t.id] || {};
  const def = CFG_DEF(); for(const k in def) if(!(k in c)) c[k] = def[k];
  if(!Array.isArray(c.mover)) c.mover = [];
  return c;
}

const num = (s, re) => { const m = String(s||"").match(re || /([\d.]+)/); return m ? parseFloat(m[1]) : NaN; };
const ampsDe = v => num(v, /x?\s*([\d.]+)\s*A/i);
const sinMarca = s => String(s||"").replace(/^ABB\s+/, "").replace(/\s*\(.*$/, "").trim();
const item = (c, re) => c.items.find(x=>re.test(x.comp)) || null;
const nTB = c => C.tagBornera(c.tag);
const ZPLACA = 25;                        // superficie de la placa de montaje desde la pared posterior
const DUCT_GAP = 30;                      // espacio libre entre equipo y canaleta (radio de curvatura de conductores)
const MARGEN = 10;                        // margen entre canaleta y borde de placa

/* ---------- lista de equipos del tablero, con sus TAG del multifilar ---------- */
function listaEquipos(p, t, calc, cfg, v){
  const g = calc.g, acc = accesoriosTablero(p, t), fa = fusiblesAcometida(acc);
  const E = { acometida:[], aux:[], dol:[], ctrl:[], pot:[], puerta:[], bornes:[], extra:[] };
  let n = 0; const id = () => "e" + (++n);
  const mk = (o, dim) => Object.assign({ id:id(), cant:1, x:0, y:0, z:ZPLACA }, dim||{}, o);
  // --- acometida (hoja de acometida del multifilar)
  const q1 = C.interruptor(calc.mainBreaker || 100, true);
  E.acometida.push(mk({ tag:"Q1", tipo:"interruptor", desc:"Interruptor general con bobina de mínima tensión (UVR) y mando rotativo", modelo:q1.modelo, val:`3x${calc.mainBreaker}A`, rol:"general" }, q1));
  // fusibles con la numeración común del unifilar y del multifilar (fusiblesAcometida)
  if(acc.luces!==false) for(const k of fa.luces) E.aux.push(mk({ tag:k, tipo:"fusible", desc:"Portafusible de luces piloto de fases", modelo:"E91/32 + fusible 10x38 4A", val:"4A", grupo:"luces" }, C.portafusible(1)));
  if(acc.releFase!==false){
    for(const k of fa.rf) E.aux.push(mk({ tag:k, tipo:"fusible", desc:"Portafusible del relé de monitoreo de tensión", modelo:"E91/32 + fusible 10x38 2A", val:"2A", grupo:"rf" }, C.portafusible(1)));
    E.aux.push(mk({ tag:"RF", tipo:"rele", desc:"Relé de monitoreo de tensión (secuencia, falta y asimetría de fases)", modelo:"CM-MPS.41S", val:"300…500 Vac", grupo:"rf" }, C.RELE_TENSION));
  }
  for(const k of fa.uvr) E.aux.push(mk({ tag:k, tipo:"fusible", desc:"Portafusible del transformador de la bobina de mínima tensión", modelo:"E91/32 + fusible 10x38 2A", val:"2A", grupo:"uvr" }, C.portafusible(1)));
  E.aux.push(mk({ tag:"T1", tipo:"trafo", desc:"Transformador de la bobina de mínima tensión", modelo:`${g.voltage}/120 Vac 50 VA`, val:"50VA", grupo:"uvr" }, C.transformador(50)));
  E.aux.push(mk({ tag:"CB1", tipo:"mcb", polos:1, desc:"Interruptor del circuito de la bobina de mínima tensión", modelo:"S201-C2", val:"2A", grupo:"uvr" }, C.mcb(1)));
  if(acc.spd!==false){
    E.aux.push(mk({ tag:"FS1", tipo:"xlp", polos:3, desc:"Seccionador portafusible del supresor de sobretensiones", modelo:"XLP000-6CC + fusibles 170M1568D 125A", val:"125A", grupo:"spd" }, C.seccionadorFusible("XLP000", 100)));
    E.aux.push(mk({ tag:"SPD1", tipo:"spd", desc:"Supresor de sobretensiones tipo 1+2 (SPD1, SPD2, SPD3)", modelo:C.SPD.modelo, val:"12,5 kA", grupo:"spd" }, C.SPD));
  }
  E.bornes.push({ grupo:"TB1", desc:"Bornera de la bobina de mínima tensión y parada de emergencia", bornes:[{ n:"1", modelo:"PTTB 4" }, { n:"2", modelo:"PTTB 4" }] });
  // --- circuitos (columnas del multifilar, en el mismo orden)
  calc.circuits.forEach((c, ci)=>{
    const l = c.load || {}, cab = c.conductorMemo && c.conductorMemo.cable ? c.conductorMemo.cable[0] : "", circ = { ci, tag:c.tag, carga:l.tag||"", desc:l.desc||c.descLabel||c.title||"" };
    if(c.kind==="control"){
      const f = item(c, /^Portafusible/), tr = item(c, /^Transformador|^Fuente/), q = item(c, /^ITM principal/);
      const va = num(tr && tr.val, /([\d.]+)\s*VA/i) || 500, dc = /^Fuente/.test(tr ? tr.comp : "");
      const grp = { circ, partes:[] };
      // control interno: fusibles y transformador (o, con segunda fuente, solo el interruptor general) y derivaciones,
      // con los TAG del unifilar y del multifilar
      if(!c.externa){
        const fs = f && f.devtags ? f.devtags : [".1", ".2"].map(k=>(f?f.devtag:"F"+c.tag)+k);
        for(const k of fs) grp.partes.push(mk({ tag:k, tipo:"fusible", desc:"Portafusible primario del transformador de control", modelo:`E91/32 + fusible gG ${f?f.val:""}`, val:f?f.val:"", circ }, C.portafusible(1)));
        if(dc){ const fu = C.fuenteDC(va); grp.partes.push(mk({ tag:tr.devtag, tipo:"fuente", desc:"Fuente de alimentación de control", modelo:`${fu.modelo} (${tr.model})`, val:`${va} VA`, circ }, fu)); }
        else grp.partes.push(mk({ tag:tr ? tr.devtag : "T"+c.tag, tipo:"trafo", desc:"Transformador de control", modelo:tr ? tr.model : "", val:`${va} VA`, circ }, C.transformador(va)));
      }
      if(q) grp.partes.push(mk({ tag:q.devtag, tipo:"mcb", polos:2, desc: c.externa ? "Interruptor general de control (segunda fuente)" : "Interruptor principal de control", modelo:"S202-C"+ampsDe(q.val), val:q.val, circ }, C.mcb(2)));
      const ramas = c.items.filter(x=>x.rama || /^QC\d+\./.test(x.devtag||""));
      const xb = { grupo:"X"+(E.ctrl.length + 1), desc:`Bornera de salidas de control ${c.ctrlV||""} ${c.ctrlTipo||""}`.trim(), bornes:[] };
      ramas.forEach((x, i)=>{
        const a = ampsDe(String(x.val).split(" · ")[0]);
        grp.partes.push(mk({ tag:x.devtag, tipo:"mcb", polos:2, desc:x.comp, modelo:"S202-C"+a, val:`2x${a}A`, circ }, C.mcb(2)));
        if(x.cfg==="luminaria") E.extra.push({ tag:"LM1", desc:`Luminaria LED interna (circuito ${x.devtag})`, modelo:C.LUMINARIA.modelo, cant:1, dim:`${C.LUMINARIA.w} x ${C.LUMINARIA.h} x ${C.LUMINARIA.d}`, montaje:"Techo", fuente:C.LUMINARIA.fuente },
          { tag:"SQ1", desc:"Interruptor de puerta de la luminaria", modelo:C.FIN_PUERTA.modelo, cant:1, dim:`${C.FIN_PUERTA.w} x ${C.FIN_PUERTA.h} x ${C.FIN_PUERTA.d}`, montaje:"Marco", fuente:C.FIN_PUERTA.fuente });
        if(x.id || (x.id==null && !x.rama && /tomacorriente/i.test(x.comp))) grp.partes.push(mk({ tag:x.id || "ID"+(i+1), tipo:"diferencial", polos:2, desc:"Interruptor diferencial 30 mA de "+x.comp.toLowerCase(), modelo:"FH202 AC-25/0.03", val:"25A 30mA", circ }, C.diferencial(2)));
        if(x.cfg==="tomacorriente") grp.partes.push(mk({ tag:"XS1", tipo:"tomacorriente", desc:`Tomacorriente doble de servicio (protegido por ${x.id || x.devtag})`, modelo:C.TOMA_DIN.modelo, val:"15 A", circ }, C.TOMA_DIN));
        xb.bornes.push({ n:String(xb.bornes.length+1), modelo:"UT 4", fun:"L", ref:x.devtag }, { n:String(xb.bornes.length+2), modelo:"UT 4", fun:"N", ref:x.devtag }, { n:"PE", modelo:"UT 4-PE", pe:true, ref:x.devtag });
      });
      if(xb.bornes.length) E.bornes.push(xb);
      E.ctrl.push(grp);
      return;
    }
    const vel = c.kind==="motor" && (l.starter==="vfd" || l.starter==="ss");
    if(vel){
      const q = item(c, /^ITM/), f = item(c, /^Portafusible/), rl = item(c, /^Filtro de l[ií]nea/), dr = item(c, /^Variador|^Arrancador suave/), ml = item(c, /^Filtro de carga/);
      const k = item(c, /^Contactor/), ft = item(c, /^Relé de sobrecarga/);
      const amps = ampsDe(dr && dr.val) || c.installedCurrent || 30;
      const col = { circ, cable:cab, tb:nTB(c), amps, partes:[] };
      if(q){ const d = C.interruptor(ampsDe(q.val), false); col.partes.push(mk({ tag:q.devtag, tipo:"interruptor", desc:q.comp, modelo:d.modelo, val:q.val, rol:"derivacion", circ }, d)); }
      if(f){ const d = C.seccionadorFusible(f.model, ampsDe(f.val)); col.partes.push(mk({ tag:f.devtag, tipo:"xlp", polos:3, desc:"Seccionador portafusible "+(l.starter==="vfd"?"con fusibles aR (protección de semiconductores)":"NH"), modelo:sinMarca(f.model).replace(/\s*\+.*$/,"")+" "+(f.model.match(/fusible [^(]+/)||[""])[0].trim(), val:f.val, circ }, d)); }
      if(l.starter==="vfd"){
        const dv = C.variador(dr.model, amps, c.powerKWelec);
        col.partes.push(mk({ tag:dr.devtag, tipo:"variador", desc:"Variador de frecuencia", modelo:`${sinMarca(dr.model)} (${dv.familia})`, val:dr.val, circ, keypad:true }, dv));
        if(rl) col.partes.push(mk({ tag:rl.devtag, tipo:"reactancia", desc:"Reactancia de línea (entrada del variador)", modelo:sinMarca(rl.model), val:rl.val, circ }, C.reactancia(ampsDe(rl.val) || amps, false)));
        if(ml) col.partes.push(mk({ tag:ml.devtag, tipo:"reactancia", desc:"Filtro de carga dv/dt (salida del variador)", modelo:sinMarca(ml.model), val:ml.val, circ, carga:true }, C.reactancia(ampsDe(ml.val) || amps, true)));
        col.tipo = "vfd";
      } else {
        const ds = C.arrancadorSuave(sinMarca(dr.model), amps);
        col.partes.push(mk({ tag:dr.devtag, tipo:"arrancador", desc:"Arrancador suave", modelo:sinMarca(dr.model), val:dr.val, circ }, ds));
        if(k){ const dk = C.contactor(sinMarca(k.model)); col.partes.push(mk({ tag:k.devtag, tipo:"contactor", desc:"Contactor de línea", modelo:sinMarca(k.model), val:k.val, circ }, dk));
          if(ft) col.partes.push(mk({ tag:ft.devtag, tipo:"sobrecarga", desc:"Relé de sobrecarga", modelo:sinMarca(ft.model), val:ft.val, circ }, C.releSobrecarga(ft.model, dk))); }
        col.tipo = "ss";
      }
      E.pot.push(col);
      E.bornes.push({ grupo:col.tb, desc:`Salida a ${circ.carga} ${circ.desc}`.trim(), potencia:true, sec:"pot", circ, bornes: bornesMotor(amps) });
      return;
    }
    if(c.kind==="motor"){
      const gm = item(c, /^Guardamotor/), k = item(c, /^Contactor/);
      if(gm){
        const dg = C.guardamotor(gm.model), dk = C.contactor(sinMarca(k.model));
        E.dol.push({ circ, cable:cab, tb:nTB(c), gm: mk({ tag:gm.devtag, tipo:"guardamotor", desc:"Guardamotor con contacto auxiliar lateral HK1-11", modelo:sinMarca(gm.model)+" + HK1-11", val:gm.val, circ }, Object.assign({}, dg, { w: dg.w + C.AUX_LATERAL })),
          k: mk({ tag:k.devtag, tipo:"contactor", desc:"Contactor con bloque auxiliar frontal HKF1-11", modelo:sinMarca(k.model)+" + HKF1-11", val:k.val, circ }, dk) });
        E.bornes.push({ grupo:nTB(c), desc:`Salida a ${circ.carga} ${circ.desc}`.trim(), circ, bornes: bornesMotor(ampsDe(gm.val) || c.installedCurrent) });
        return;
      }
      const q = item(c, /^ITM/), ft = item(c, /^Relé de sobrecarga/);
      const col = { circ, cable:cab, tb:nTB(c), amps:c.installedCurrent, tipo:"dol", partes:[] };
      const dq = C.interruptor(ampsDe(q.val), false), dk = C.contactor(sinMarca(k.model));
      col.partes.push(mk({ tag:q.devtag, tipo:"interruptor", desc:q.comp, modelo:dq.modelo, val:q.val, rol:"derivacion", circ }, dq));
      col.partes.push(mk({ tag:k.devtag, tipo:"contactor", desc:"Contactor", modelo:sinMarca(k.model), val:k.val, circ }, dk));
      if(ft) col.partes.push(mk({ tag:ft.devtag, tipo:"sobrecarga", desc:"Relé de sobrecarga", modelo:sinMarca(ft.model), val:ft.val, circ }, C.releSobrecarga(ft.model, dk)));
      E.pot.push(col);
      E.bornes.push({ grupo:col.tb, desc:`Salida a ${circ.carga} ${circ.desc}`.trim(), potencia:true, sec:"pot", circ, bornes: bornesMotor(c.installedCurrent) });
      return;
    }
    // alimentador / carga general
    const q = item(c, /^ITM/);
    const a = ampsDe(q && q.val) || 16, polos = parseInt(q && q.val) || 3;
    // hasta 63 A el alimentador lleva interruptor miniatura (MCB) en riel; por encima, caja moldeada
    const dq = q && q.mcb ? Object.assign(C.mcb(polos), { familia:"S200", modelo:String(q.model||"").replace(/^ABB\s+/, "").replace(/\s*\(.*$/, "") }) : C.interruptor(a, false);
    E.pot.push({ circ, cable:cab, tb:nTB(c), amps:c.installedCurrent, tipo:"feeder", partes:[ mk({ tag:q.devtag, tipo: q && q.mcb ? "mcb" : "interruptor", desc:"Interruptor del alimentador", modelo:dq.modelo, val:q.val, rol:"derivacion", circ }, dq) ] });
    E.bornes.push({ grupo:nTB(c), desc:`Salida a ${circ.carga || ""} ${circ.desc}`.trim(), potencia:true, sec:"pot", circ, bornes: ["L1","L2","L3"].map(f=>({ n:f, modelo:C.borneFuerza(c.installedCurrent) })).concat([{ n:"PE", modelo:C.borneFuerza(c.installedCurrent)+"-PE", pe:true }]) });
  });
  return E;
}
function bornesMotor(amps){
  const m = C.borneFuerza(amps);
  return ["U1","V1","W1"].map(f=>({ n:f, modelo:m })).concat([{ n:"PE", modelo:m+"-PE", pe:true }]);
}

/* ---------- filas de riel DIN ---------- */
function anchoGrupo(partes){ return partes.reduce((a, x)=>a + x.w, 0); }
/* reparte grupos (que no se separan) en filas de ancho útil, con 10 mm entre grupos y la reserva aplicada */
function repartirFilas(grupos, util, reserva){
  const filas = [[]]; let w = 0;
  for(const gq of grupos){ const a = anchoGrupo(gq) + 10;
    if(filas[filas.length-1].length && (w + a)*(1+reserva) > util){ filas.push([]); w = 0; }
    filas[filas.length-1].push(gq); w += a; }
  return filas.filter(f=>f.length);
}

/* ---------- arreglo completo ---------- */
export function arregloTablero(p, t, calc){
  calc = calc || calcularTablero(p, t);
  const cfg = cfgMecanico(p, t), v = valoresDiseno(p), g = calc.g;
  const reserva = Math.max(0, Math.min(60, +(cfg.reserva!=="" ? cfg.reserva : v.reservaTablero) || 20))/100;
  const E = listaEquipos(p, t, calc, cfg, v);
  const criterios = [], avisos = [];
  const comps = [], canaletas = [], rieles = [], barras = [], conexiones = [], placas = [], secciones = [], puerta = [], base = [], textos = [];
  const tfc = t.tipo==="fuerzacontrol";
  const mandos = cfg.mandos==="si" || (cfg.mandos==="auto" && tfc);
  const tMin = parseFloat(v.tempMin), tAmb = tempDiseno(v), alt = parseFloat(v.altitud) || 0;
  // calefacción anticondensación (con temperatura mínima baja o instalación exterior)
  // (los mismos criterios de los accesorios del tablero: el unifilar dibuja su circuito)
  const acc = accesoriosTablero(p, t);
  const calef = acc.calefaccion;
  // ventilación «auto»: forzada si los accesorios la incluyen (tablero con variadores o arrancadores suaves); si no, la
  // decide el balance térmico (y se avisa para agregar su circuito al unifilar)
  const ventCfg = cfg.ventilacion==="auto" && acc.ventilacion ? "forzada" : cfg.ventilacion;

  // ===== 1) filas de la placa de control (filas funcionales, de arriba hacia abajo) =====
  const gruposAux = [];
  const porGrupo = k => E.aux.filter(x=>x.grupo===k);
  for(const k of ["luces","rf","uvr","spd"]) if(porGrupo(k).length) gruposAux.push(porGrupo(k));
  if(calef){
    const r = { id:"cal1", tag:"R1", tipo:"resistencia", desc:"Resistencia calefactora anticondensación 100 W con termostato TH1", modelo:"Resistencia PTC 100 W + termostato 0…60 °C", val:"100 W", w:60, h:125, d:60, montaje:"din", perdidas:0, fuente:"Accesorios de climatización de gabinetes (referencial)", cant:1, z:ZPLACA, x:0, y:0 };
    gruposAux.push([r]);
  }
  // ===== ajustes del usuario (mover, intercambiar, subir o bajar equipos) =====
  const ajustes = [];
  const movs = (Array.isArray(cfg.mover) ? cfg.mover : []).filter(mv=>mv && mv.equipo && ACCIONES_MOVER[mv.accion]);
  const txtMov = mv => `${mv.equipo} ${ACCIONES_MOVER[mv.accion]}${mv.ref ? " "+mv.ref : ""}`;
  const enDol = tag => E.dol.findIndex(d=>d.gm.tag===tag || d.k.tag===tag);
  const enPot = tag => E.pot.findIndex(c=>c.tb===tag || c.partes.some(x=>x.tag===tag));
  const pendientes = [];
  let q1Lado = cfg.q1Lado, panelAlt = +cfg.panelAltura || 0;
  for(const mv of movs){
    const iD = enDol(mv.equipo), iP = enPot(mv.equipo);
    if(iD >= 0 && !["arriba","abajo"].includes(mv.accion)){
      const r = reubicar(E.dol, iD, mv.accion, mv.ref ? enDol(mv.ref) : null);
      ajustes.push({ texto:txtMov(mv), ok:r===true, nota: r==="limite" ? "ya está en el extremo de su fila" : r ? "" : "el equipo de referencia no está en la misma fila" });
    } else if(iP >= 0){
      const col = E.pot[iP], dv = col.partes.find(x=>x.tipo==="variador");
      if(["arriba","abajo"].includes(mv.accion)){
        if(dv && dv.tag===mv.equipo){ dv.posV = mv.accion; ajustes.push({ texto:txtMov(mv).replace("una fila ", ""), ok:true }); }
        else ajustes.push({ texto:txtMov(mv), ok:false, nota:"en la placa de fuerza el orden vertical sigue el recorrido de la energía (interruptor → seccionador → arrancador)" });
        continue;
      }
      let r = reubicar(E.pot, iP, mv.accion, mv.ref ? enPot(mv.ref) : null);
      // con una sola columna, «a la derecha / izquierda» cambia el lado del variador dentro de su columna
      if(r==="limite" && dv && ["izquierda","derecha"].includes(mv.accion)){ col.vfdLado = mv.accion==="derecha" ? "der" : "izq"; r = true; }
      ajustes.push({ texto:txtMov(mv), ok:r===true, nota: r==="limite" ? "ya está en el extremo de la placa de fuerza" : r ? "" : "el equipo de referencia no está en la placa de fuerza" });
    } else if(mv.equipo==="Q1"){
      if(["izquierda","derecha"].includes(mv.accion)){ q1Lado = mv.accion==="izquierda" ? "izq" : "der"; ajustes.push({ texto:txtMov(mv), ok:true }); }
      else ajustes.push({ texto:txtMov(mv), ok:false, nota:"el interruptor general va en la fila de derivaciones, junto a las barras" });
    } else pendientes.push(mv);
  }
  const filasCtrl = [];   // { nombre, grupos:[[comp…]], alinear? }
  filasCtrl.push({ nombre:"Protecciones auxiliares de la acometida", grupos:gruposAux });
  if(E.dol.length){
    filasCtrl.push({ nombre:"Guardamotores", columnas:E.dol.map(d=>({ circ:d.circ, ancho:Math.max(d.gm.w, d.k.w)+6, comp:d.gm })), peine:true });
    filasCtrl.push({ nombre:"Contactores", columnas:E.dol.map(d=>({ circ:d.circ, ancho:Math.max(d.gm.w, d.k.w)+6, comp:d.k })) });
  }
  for(const gc of E.ctrl) filasCtrl.push({ nombre:`Distribución de control ${gc.circ.tag}`, grupos: agruparCtrl(gc.partes) });
  const ordenB = b => /^TB(\d+)/.test(b.grupo) ? +b.grupo.slice(2) : 1000;
  const bornesCtrl = E.bornes.filter(b=>b.sec!=="pot").sort((a, b)=>ordenB(a) - ordenB(b));
  const bornesPot = E.bornes.filter(b=>b.sec==="pot");
  // ajustes en las filas de la placa de control, en las borneras y en la puerta
  const ubicar = tag => { for(let r=0;r<filasCtrl.length;r++){ const f = filasCtrl[r];
      if(f.columnas){ const i = f.columnas.findIndex(c=>c.comp.tag===tag); if(i>=0) return { r, col:true }; continue; }
      for(let g=0; g<f.grupos.length; g++){ const i = f.grupos[g].findIndex(x=>x.tag===tag); if(i>=0) return { r, g, i }; } }
    return null; };
  for(const mv of pendientes){
    const tb = bornesCtrl.findIndex(b=>b.grupo===mv.equipo);
    if(tb >= 0){ const r = reubicar(bornesCtrl, tb, mv.accion==="arriba" ? "izquierda" : mv.accion==="abajo" ? "derecha" : mv.accion, mv.ref ? bornesCtrl.findIndex(b=>b.grupo===mv.ref) : null); ajustes.push({ texto:txtMov(mv), ok:r===true, nota: r==="limite" ? "ya está en el extremo de la fila de borneras" : r ? "" : "la referencia no es una bornera de la placa de control" }); continue; }
    if(/^(EPB1|LT|PANEL)$/.test(mv.equipo) && ["arriba","abajo"].includes(mv.accion)){ panelAlt += mv.accion==="arriba" ? 150 : -150; ajustes.push({ texto:txtMov(mv).replace("una fila ", "150 mm "), ok:true }); continue; }
    const u = ubicar(mv.equipo);
    if(!u){ ajustes.push({ texto:txtMov(mv), ok:false, nota:"no encontré ese equipo en el arreglo" }); continue; }
    if(["arriba","abajo"].includes(mv.accion)){
      const nombreFila = filasCtrl[u.r].nombre.replace(/ \(\d+\)$/, "");
      const bloques = []; for(const f of filasCtrl){ if(f.columnas && bloques.length && bloques[bloques.length-1][0].columnas) bloques[bloques.length-1].push(f); else bloques.push([f]); }
      const bi = bloques.findIndex(bq=>bq.includes(filasCtrl[u.r]));
      const r = reubicar(bloques, bi, mv.accion);
      if(r===true) filasCtrl.splice(0, filasCtrl.length, ...bloques.flat());
      ajustes.push({ texto:`${txtMov(mv)} (fila «${nombreFila}»)`, ok:r===true, nota: r==="limite" ? `ya está en la ${mv.accion==="arriba" ? "primera" : "última"} fila de equipos (las borneras van siempre al pie, junto a la entrada de cables)` : "" });
      continue;
    }
    if(u.col){ ajustes.push({ texto:txtMov(mv), ok:false, nota:"no se pudo reubicar en su fila" }); continue; }
    const fila = filasCtrl[u.r], grupo = fila.grupos[u.g];
    const ur = mv.ref ? ubicar(mv.ref) : null;
    let r;
    if(ur && !ur.col && ur.r===u.r && ur.g===u.g) r = reubicar(grupo, u.i, mv.accion, ur.i);                 // dentro del mismo grupo
    else if(ur && !ur.col && ur.r===u.r) r = reubicar(fila.grupos, u.g, mv.accion, ur.g);                     // otro grupo de la misma fila
    else if(ur && !ur.col && ["antes","despues","intercambiar"].includes(mv.accion)){                         // pasa a otra fila
      const otra = filasCtrl[ur.r];
      if(mv.accion==="intercambiar"){ const g2 = otra.grupos[ur.g]; fila.grupos[u.g] = g2; otra.grupos[ur.g] = grupo; }
      else { fila.grupos.splice(u.g, 1); otra.grupos.splice(ur.g + (mv.accion==="despues" ? 1 : 0), 0, grupo); }
      r = true;
    }
    else if(mv.ref) r = false;
    else if(grupo.length > 1 && ((mv.accion==="izquierda" && u.i > 0) || (mv.accion==="derecha" && u.i < grupo.length-1))) r = reubicar(grupo, u.i, mv.accion);
    else r = reubicar(fila.grupos, u.g, mv.accion);
    ajustes.push({ texto:txtMov(mv), ok:r===true, nota: r==="limite" ? "ya está en el extremo de su fila" : r ? "" : "el equipo de referencia no está en la placa de control" });
  }
  for(let i=filasCtrl.length-1; i>=0; i--) if(filasCtrl[i].grupos && !filasCtrl[i].grupos.length) filasCtrl.splice(i, 1);

  // ===== 2) dimensiones requeridas =====
  const montajeAuto = ()=>{
    const grande = E.pot.some(c=>c.tipo==="vfd" && c.partes.some(x=>x.tipo==="variador" && x.h > 610)) || E.pot.length > 2 || (calc.mainBreaker||0) > 160;
    return grande || E.dol.length > 6 ? "piso" : "mural";
  };
  let montaje = cfg.montaje==="piso" || cfg.montaje==="mural" ? cfg.montaje : montajeAuto();
  let GAB = montaje==="mural" ? C.GAB_MURAL : C.GAB_PISO;
  const fase = C.barraFase(calc.mainBreaker || 100), pe = C.barraTierra(fase);
  const maxD = Math.max(...[...E.aux, ...E.dol.flatMap(d=>[d.gm, d.k]), ...E.ctrl.flatMap(c=>c.partes), ...E.pot.flatMap(c=>c.partes), ...E.acometida].map(x=>x.d||0), 100);

  // ancho de la placa de control: el menor normalizado en el que entren las filas
  let ductV = C.canaleta(6*(E.dol.length*2 + E.aux.length + E.ctrl.reduce((a, c)=>a + c.partes.length, 0)), 60), ductH = C.canaleta(60, 60);
  const mCan = String(cfg.canaleta||"").match(/(\d{2,3})\s*x\s*(\d{2,3})/i);
  if(mCan){ const dc = { w:+mCan[1], h:+mCan[2], nombre:`${+mCan[1]}x${+mCan[2]} mm` }; ductV = dc; ductH = dc; }
  const utilDe = Wp => Wp - 2*(MARGEN + ductV.w) - 2*15;
  const filasDe = (util)=> {
    const out = [];
    for(const f of filasCtrl){
      if(f.columnas){
        // columnas alineadas (guardamotor sobre contactor): se parten en bloques del ancho útil
        const bloques = [[]]; let w = 0;
        for(const c of f.columnas){ if(bloques[bloques.length-1].length && (w + c.ancho)*(1+reserva) > util){ bloques.push([]); w = 0; } bloques[bloques.length-1].push(c); w += c.ancho; }
        bloques.forEach((b, i)=>out.push({ nombre:f.nombre + (bloques.length>1 ? ` (${i+1})` : ""), columnas:b, bloque:i, peine:f.peine }));
      } else repartirFilas(f.grupos, util, reserva).forEach((gs, i, a)=>out.push({ nombre:f.nombre + (a.length>1 ? ` (${i+1})` : ""), grupos:gs }));
    }
    // intercalar bloques de guardamotores y contactores: G1, K1, G2, K2…
    const gm = out.filter(r=>r.nombre.startsWith("Guardamotores")), km = out.filter(r=>r.nombre.startsWith("Contactores"));
    if(gm.length > 1){ const resto = out.filter(r=>!gm.includes(r) && !km.includes(r)); const i0 = out.indexOf(gm[0]); const mezcla = gm.flatMap((r, i)=>[r, km[i]].filter(Boolean)); return [...resto.slice(0, i0), ...mezcla, ...resto.slice(i0)]; }
    return out;
  };
  const altoFila = r => {
    const hs = r.columnas ? r.columnas.map(c=>c.comp.h) : r.grupos.flat().map(x=>x.h);
    return Math.max(...hs, 60) + 2*DUCT_GAP;
  };
  const filaBornes = (grupos, util) => {
    // cada grupo de bornes ocupa: tope + bornes + tapa; se reparten en filas
    const anchoB = b => b.bornes.reduce((a, x)=>a + C.borne(x.modelo).w, 0) + C.TAPA_FINAL + 2*C.TOPE + 4;
    const filas = [[]]; let w = 0;
    for(const b of grupos){ const a = anchoB(b); if(filas[filas.length-1].length && (w + a)*(1+reserva*0.5) > util){ filas.push([]); w = 0; } filas[filas.length-1].push(b); w += a; }
    return filas.filter(f=>f.length);
  };
  const altoBornes = fs => fs.reduce((a, f)=>a + Math.max(...f.flatMap(b=>b.bornes.map(x=>C.borne(x.modelo).h)), 50) + 2*DUCT_GAP + ductH.w, 0);
  const altoCtrl = util => { const fs = filasDe(util); return { filas:fs, alto: MARGEN + ductH.w + fs.reduce((a, r)=>a + altoFila(r) + ductH.w, 0) + altoBornes(filaBornes(bornesCtrl, util)) + 90 }; };

  // columnas de la placa de fuerza
  const colsPot = E.pot.map(c=>disponerColumna(c));
  const q1 = E.acometida[0];
  const entrada = cfg.entrada==="superior" ? "superior" : "inferior";
  const altoBarras = 2*fase.paso + fase.ancho;
  // placa de fuerza: con entrada inferior las barras van arriba y Q1 en la fila de derivaciones, alimentado por abajo
  // (franja libre debajo para los cables de acometida); con entrada superior, Q1 arriba y las barras debajo
  const zonaSupPot = entrada==="inferior" ? 40 + altoBarras + 60 : 110 + q1.h + 60 + altoBarras + 60;
  const ANCHO_ACOM = entrada==="inferior" ? q1.w + 70 : 0;
  // sección única: Q1 arriba, barras debajo y un canal lateral para los cables de acometida
  const zonaSupMix = 110 + q1.h + 60 + altoBarras + 40;
  const CANAL_MIX = entrada==="inferior" ? 70 : 0;

  // ===== 3) secciones (control a la izquierda, fuerza a la derecha), ancho y alto normalizados =====
  const fijoW = +cfg.ancho || 0, fijoH = +cfg.alto || 0, fijoD = +cfg.fondo || 0;
  const conPot = colsPot.length > 0;
  let H, secs;
  const elegir = ()=>{
    for(const Hc of (fijoH ? [fijoH] : GAB.altos)){
      const pH = C.placaDe(montaje, 800, Hc).h;
      // control: ancho menor en que quepa (altura ≤ placa; si la sección es única, comparte con la zona superior)
      const anchosCtrl = montaje==="mural" ? GAB.anchos : [600, 800, 1000];
      let sc = null;
      for(const Wc of anchosCtrl){
        const pl = C.placaDe(montaje, Wc, Hc), u = utilDe(pl.w) - (conPot ? 0 : CANAL_MIX), a = altoCtrl(u);
        const disp = conPot ? pl.h : pl.h - zonaSupMix;
        if(a.alto <= disp){ sc = { W:Wc, util:u, filas:a.filas, alto:a.alto }; break; }
      }
      if(!sc) continue;
      if(!conPot) return { H:Hc, secs:[{ rol:"mixta", W:sc.W, ctrl:sc }] };
      // fuerza: columnas repartidas en secciones de 600…1200
      const pots = []; let resto = colsPot.slice();
      const dispPot = pH - zonaSupPot;
      if(colsPot.some(c=>c.alto > dispPot)) continue;
      while(resto.length){
        let ok = null;
        for(const Wp of [600, 800, 1000, 1200]){
          const u = C.placaDe(montaje, Wp, Hc).w - MARGEN - ductV.w - 30 - (pots.length ? 0 : ANCHO_ACOM);
          let w = 0, k = 0; while(k < resto.length && w + resto[k].ancho <= u){ w += resto[k].ancho; k++; }
          if(k === resto.length || (Wp===1200 && k>0)){ ok = { W:Wp, cols:resto.slice(0, k), util:u }; break; }
        }
        if(!ok){ ok = { W:1200, cols:[resto[0]], util:C.placaDe(montaje, 1200, Hc).w - MARGEN - ductV.w - 30 - (pots.length ? 0 : ANCHO_ACOM) }; }
        // el interruptor general debe caber en la primera sección de fuerza
        pots.push(ok); resto = resto.slice(ok.cols.length);
      }
      return { H:Hc, secs:[{ rol:"control", W:sc.W, ctrl:sc }, ...pots.map(x=>({ rol:"potencia", W:x.W, pot:x }))] };
    }
    return null;
  };
  let sel = elegir();
  if(!sel && montaje==="mural"){ montaje = "piso"; GAB = C.GAB_PISO; if(cfg.montaje==="mural") avisos.push("No entra en un gabinete mural normalizado: se pasa a autosoportado."); sel = elegir(); }
  if(!sel){
    // último recurso: alto máximo y avisar
    avisos.push("Los equipos no entran en los gabinetes normalizados: revisa la distribución o divide el tablero.");
    const Hc = GAB.altos[GAB.altos.length-1], pl = C.placaDe(montaje, 800, Hc), u = utilDe(pl.w), a = altoCtrl(u);
    sel = { H:Hc, secs: conPot ? [{ rol:"control", W:800, ctrl:{ W:800, util:u, filas:a.filas, alto:a.alto } }, { rol:"potencia", W:1200, pot:{ W:1200, cols:colsPot, util:1200-100-2*(MARGEN+ductV.w)-20 } }] : [{ rol:"mixta", W:800, ctrl:{ W:800, util:u, filas:a.filas, alto:a.alto } }] };
  }
  H = sel.H; secs = sel.secs;
  if(cfg.ladoControl==="der" && secs.length > 1){ const sc = secs.find(x=>x.rol!=="potencia"); secs = secs.filter(x=>x!==sc).concat([sc]); }
  let W = secs.reduce((a, s)=>a + s.W, 0);
  if(fijoW && fijoW > W){ const extra = fijoW - W; secs[secs.length-1].W += extra; W = fijoW; }
  else if(fijoW && fijoW < W) avisos.push(`El ancho pedido (${fijoW} mm) no alcanza: se usa ${W} mm.`);
  // fondo: el mayor equipo + placa + espacio para los dispositivos de puerta
  const fondos = GAB.fondos;
  let D = fondos.find(f=>f >= maxD + ZPLACA + 85) || fondos[fondos.length-1];
  if(fijoD){ if(fijoD < maxD + ZPLACA + 60) avisos.push(`El fondo pedido (${fijoD} mm) es menor que el equipo más profundo (${Math.round(maxD)} mm) más la placa y la puerta.`); D = fijoD; }
  const zocalo = montaje==="mural" ? 0 : C.GAB_PISO.zocalo;

  // ===== 4) posición de secciones, placas y componentes =====
  let xs = 0;
  secs.forEach((s, i)=>{
    s.id = "S"+(i+1); s.x0 = xs; s.x1 = xs + s.W; xs += s.W;
    const pl = C.placaDe(montaje, s.W, H);
    s.placa = { id:"PM"+(i+1), x:s.x0 + pl.mx, y:pl.my, w:pl.w, h:pl.h, nombre:`PLACA DE MONTAJE ${i+1}` };
    placas.push(s.placa);
    s.puertas = s.W >= 1000 ? 2 : 1;
    secciones.push({ id:s.id, rol:s.rol, x0:s.x0, x1:s.x1, W:s.W, puertas:s.puertas, placa:s.placa.id, bisagra: i===secs.length-1 && secs.length>1 ? "der" : "izq" });
  });
  const add = c => { comps.push(c); return c; };
  const ductos = (s, x, y, w, h, orient, d) => canaletas.push({ placa:s.placa.id, x, y, w, h, orient, nombre:d.nombre, prof:d.h });

  // --- sección de control (o mixta) ---
  const sCtrl = secs.find(s=>s.rol!=="potencia");
  const sPot = secs.filter(s=>s.rol==="potencia");
  const pc = sCtrl.placa;
  const canal = conPot ? 0 : CANAL_MIX;
  const xi = pc.x + MARGEN + ductV.w + 15, xf = pc.x + pc.w - MARGEN - ductV.w - 15 - canal;
  const xDuctoDer = pc.x + pc.w - MARGEN - ductV.w - canal, anchoDH = pc.w - 2*(MARGEN + ductV.w) - canal;
  let ytop = pc.y + pc.h - MARGEN;
  let busY = null, busX0 = null, busX1 = null, zonaAcom = null;
  const sQ1 = sPot[0] || sCtrl;
  if(!conPot){
    // Q1 arriba a la derecha, sobre el canal de los cables de acometida; barras debajo
    q1.x = pc.x + pc.w - MARGEN - canal - 20 - q1.w; q1.y = ytop - 110 - q1.h; add(Object.assign(q1, { placa:pc.id, seccion:sCtrl.id }));
    busY = q1.y - 60 - fase.ancho/2; busX0 = pc.x + 40; busX1 = pc.x + pc.w - MARGEN - canal - 10;
    ytop = busY - 2*fase.paso - fase.ancho/2 - 40;
    if(canal) zonaAcom = { placa:pc.id, x:pc.x + pc.w - MARGEN - canal + 5, y:pc.y + 60, w:canal - 5, h:q1.y + q1.h + 50 - (pc.y + 60), nombre:"RECORRIDO DE CABLES DE ACOMETIDA" };
  }
  // canaletas verticales a los costados y superior
  const yInfCtrl = pc.y + 70;     // sobre la barra de tierra
  ductos(sCtrl, pc.x + MARGEN, yInfCtrl, ductV.w, ytop - yInfCtrl, "v", ductV);
  ductos(sCtrl, xDuctoDer, yInfCtrl, ductV.w, ytop - yInfCtrl, "v", ductV);
  ductos(sCtrl, pc.x + MARGEN + ductV.w, ytop - ductH.w, anchoDH, ductH.w, "h", ductH);
  const ytopCtrl = ytop;
  let y = ytop - ductH.w;
  const filasOk = sCtrl.ctrl.filas;
  const filaInfo = [];
  let colX = null;   // posiciones x de columnas guardamotor/contactor
  for(const r of filasOk){
    const h = altoFila(r), yc = y - h/2;
    rieles.push({ placa:pc.id, x:xi - 10, y:yc, w:(xf - xi) + 20, nombre:r.nombre });
    if(r.columnas){
      if(r.nombre.startsWith("Guardamotores") || !colX || colX.bloque!==r.bloque){
        colX = { bloque:r.bloque, xs:[] }; let x = xi;
        for(const c of r.columnas){ colX.xs.push(x + c.ancho/2); x += c.ancho; }
      }
      r.columnas.forEach((c, i)=>{ const cp = c.comp; cp.x = colX.xs[i] - cp.w/2; cp.y = yc - cp.h/2; cp.placa = pc.id; cp.seccion = sCtrl.id; cp.fila = r.nombre; add(cp); });
      if(r.peine && r.columnas.length > 1){
        const a = r.columnas[0].comp, b = r.columnas[r.columnas.length-1].comp;
        add({ id:"peine"+r.bloque, tag:"", tipo:"peine", desc:"Barra de conexión tipo peine 3F para guardamotores, con borne de alimentación", modelo:"PS3-"+r.columnas.length+"-0-65 + S3-...", val:"", x:a.x, y:a.y + a.h - 14, w:(b.x + b.w) - a.x, h:10, d:a.d + 3, z:ZPLACA, placa:pc.id, seccion:sCtrl.id, cant:1, fuente:"ABB barras de conexión PS3 para MS116/MS132 (referencial)" });
      }
    } else {
      let x = xi;
      for(const gq of r.grupos){ for(const cp of gq){ cp.x = x; cp.y = yc - cp.h/2; cp.placa = pc.id; cp.seccion = sCtrl.id; cp.fila = r.nombre; add(cp); x += cp.w; } x += 10; }
    }
    filaInfo.push({ nombre:r.nombre, y:yc });
    y -= h;
    ductos(sCtrl, pc.x + MARGEN + ductV.w, y - ductH.w, anchoDH, ductH.w, "h", ductH);
    y -= ductH.w;
  }
  // borneras de control
  const bloquesB = [];
  const ponerBornes = (s, grupos, x0, x1, yTop, menos) => {
    let yy = yTop;
    for(const fila of filaBornes(grupos, x1 - x0)){
      const hb = Math.max(...fila.flatMap(b=>b.bornes.map(x=>C.borne(x.modelo).h)), 50), h = hb + 2*DUCT_GAP, yc = yy - h/2;
      rieles.push({ placa:s.placa.id, x:x0 - 10, y:yc, w:(x1 - x0) + 20, nombre:"Borneras" });
      let x = x0;
      for(const b of fila){
        x += C.TOPE;
        const items = [];
        for(const bx of b.bornes){ const db = C.borne(bx.modelo); items.push({ n:bx.n, modelo:bx.modelo, pe:!!bx.pe, fun:bx.fun, ref:bx.ref, x, w:db.w, h:db.h, d:db.d }); x += db.w; }
        x += C.TAPA_FINAL; const xEnd = x; x += C.TOPE + 4;
        bloquesB.push({ grupo:b.grupo, desc:b.desc, placa:s.placa.id, seccion:s.id, x0:items[0].x - C.TOPE, x1:xEnd + C.TOPE, y:yc, bornes:items, circ:b.circ, potencia:!!b.potencia });
      }
      yy -= h;
      ductos(s, s.placa.x + MARGEN + ductV.w, yy - ductH.w, s.placa.w - 2*(MARGEN + ductV.w) - (menos||0), ductH.w, "h", ductH);
      yy -= ductH.w;
    }
    return yy;
  };
  y = ponerBornes(sCtrl, bornesCtrl, xi, xf, y, canal);
  // barra de tierra al pie de la placa de control
  const peY = pc.y + 30;
  const nPE = E.dol.length + bornesCtrl.length + 4;
  const peW = Math.min(pc.w - 80, Math.max(200, nPE*28 + 60));
  barras.push({ tag:"PE", fase:"PE", nombre:pe.nombre, x:pc.x + (pc.w - peW)/2, y:peY - pe.ancho/2, w:peW, h:pe.ancho, orient:"h", placa:pc.id, seccion:sCtrl.id, perforaciones: Math.round(peW/25) });
  if(y < pc.y + 70) avisos.push("La placa de control quedó justa: revisa la reserva o aumenta el alto del gabinete.");

  // --- secciones de fuerza ---
  let filaQ = null;
  const q1Izq = q1Lado==="izq";
  if(conPot){
    const pp = sPot[0].placa;
    if(entrada==="inferior"){
      busY = pp.y + pp.h - 40 - fase.ancho/2;
      filaQ = busY - 2*fase.paso - fase.ancho/2 - 60;
      q1.x = q1Izq ? pp.x + MARGEN + 35 : pp.x + pp.w - MARGEN - ductV.w - 35 - q1.w; q1.y = filaQ - q1.h;
      zonaAcom = { placa:pp.id, x:q1.x - 25, y:pp.y + 60, w:q1.w + 50, h:q1.y - 20 - (pp.y + 60), nombre:"RECORRIDO DE CABLES DE ACOMETIDA" };
    } else {
      q1.x = q1Lado==="izq" ? pp.x + MARGEN + 40 : q1Lado==="der" ? pp.x + pp.w - MARGEN - ductV.w - 40 - q1.w : pp.x + pp.w/2 - q1.w/2; q1.y = pp.y + pp.h - 110 - q1.h;
      busY = q1.y - 60 - fase.ancho/2;
      filaQ = busY - 2*fase.paso - fase.ancho/2 - 60;
    }
    add(Object.assign(q1, { placa:pp.id, seccion:sPot[0].id }));
    const ultima = sPot[sPot.length-1].placa;
    busX0 = pp.x + 40; busX1 = ultima.x + ultima.w - MARGEN - ductV.w - 20;
    sPot.forEach((s, si)=>{
      const pl = s.placa;
      // canaleta vertical de control (mando de variadores y arrancadores) a la derecha de cada placa de fuerza
      ductos(s, pl.x + pl.w - MARGEN - ductV.w, pl.y + 70, ductV.w, filaQ - (pl.y + 70), "v", ductV);
      const xa = pl.x + MARGEN + 10 + (si===0 && q1Izq ? ANCHO_ACOM : 0), xb = pl.x + pl.w - MARGEN - ductV.w - 20 - (si===0 && !q1Izq ? ANCHO_ACOM : 0);
      const wcols = s.pot.cols.reduce((a, c)=>a + c.ancho, 0);
      let x = xa + Math.max(0, (xb - xa - wcols)/2);
      const yBornes = pl.y + 75;
      for(const col of s.pot.cols){ colocarColumna(col, x, filaQ, pl, s, yBornes); x += col.ancho; }
      // bornera de salida de cada circuito bajo su columna (cables de salida en vertical, sin cruces)
      const bs = bornesPot.filter(b=>s.pot.cols.some(c=>c.src.tb===b.grupo));
      if(bs.length){
        rieles.push({ placa:pl.id, x:xa, y:yBornes, w:xb - xa, nombre:"Borneras de fuerza" });
        let xmin = xa + 5;
        for(const b of bs){
          const col = s.pot.cols.find(c=>c.src.tb===b.grupo);
          const ancho = b.bornes.reduce((a, x)=>a + C.borne(x.modelo).w, 0) + C.TAPA_FINAL;
          let x0 = Math.max(xmin, (col ? col.xTB : xmin) - ancho/2) + C.TOPE;
          const items = []; let xx = x0;
          for(const bx of b.bornes){ const db = C.borne(bx.modelo); items.push({ n:bx.n, modelo:bx.modelo, pe:!!bx.pe, x:xx, w:db.w, h:db.h, d:db.d }); xx += db.w; }
          bloquesB.push({ grupo:b.grupo, desc:b.desc, placa:pl.id, seccion:s.id, x0:x0 - C.TOPE, x1:xx + C.TAPA_FINAL + C.TOPE, y:yBornes, bornes:items, circ:b.circ, potencia:true });
          xmin = xx + C.TAPA_FINAL + C.TOPE + 12;
          if(col && col.salida) conexiones.push(...col.salida(items));
        }
      }
      // barra de tierra de la sección de fuerza
      const w2 = Math.min(pl.w - 80 - (si===0 ? ANCHO_ACOM : 0), 360);
      barras.push({ tag:"PE", fase:"PE", nombre:pe.nombre, x:pl.x + 30 + (si===0 && q1Izq ? ANCHO_ACOM : 0), y:pl.y + 22 - pe.ancho/2, w:w2, h:pe.ancho, orient:"h", placa:pl.id, seccion:s.id, perforaciones:Math.round(w2/25) });
    });
  }
  // barras L1-L2-L3 con aisladores y bajadas
  const fases = ["L1","L2","L3"];
  fases.forEach((f, i)=>{ const yb = busY - i*fase.paso; barras.push({ tag:f, fase:f, nombre:fase.nombre, x:busX0, y:yb - fase.ancho/2, w:busX1 - busX0, h:fase.ancho, orient:"h", placa:sQ1.placa.id, seccion:sQ1.id, perforaciones:0 }); });
  const soportes = []; for(let x = busX0 + 30; x <= busX1 - 20; x += 400) soportes.push(x); if(soportes[soportes.length-1] < busX1 - 60) soportes.push(busX1 - 30);
  const aisladores = soportes.map(x=>({ x, y0:busY - 2*fase.paso, y1:busY }));
  // bajadas desde Q1 y hacia cada interruptor de derivación (pletinas flexibles)
  const polos = c => [0,1,2].map(k=>c.x + c.w*(k+0.5)/3);
  // Q1: con entrada inferior entra por abajo y sale por arriba hacia las barras; con entrada superior, al revés
  polos(q1).forEach((x, k)=>conexiones.push({ tipo:"pletina", fase:fases[k], pts: busY > q1.y ? [[x, q1.y + q1.h], [x, busY - k*fase.paso]] : [[x, q1.y], [x, busY - k*fase.paso]] }));
  if(zonaAcom){ const xz = zonaAcom.x + zonaAcom.w/2;
    conexiones.push({ tipo:"acometida", desc:"Cables de acometida", pts: conPot ? [[q1.x + q1.w/2, zonaAcom.y], [q1.x + q1.w/2, busY > q1.y ? q1.y : q1.y + q1.h]] : [[xz, zonaAcom.y], [xz, q1.y + q1.h + 35], [q1.x + q1.w/2, q1.y + q1.h + 35], [q1.x + q1.w/2, q1.y + q1.h]] }); }
  // derivaciones: los interruptores de las columnas toman de las barras por arriba
  for(const c of comps.filter(c=>c.rol==="derivacion")) polos(c).forEach((x, k)=>conexiones.push({ tipo:"pletina", fase:fases[k], pts:[[x, busY - k*fase.paso], [x, c.y + c.h]] }));
  // alimentación de los guardamotores (peine) desde las barras por cable
  if(E.dol.length){
    const pein = comps.filter(c=>c.tipo==="peine");
    const dest = pein.length ? pein : comps.filter(c=>c.tipo==="guardamotor");
    // cable de alimentación del grupo: de las barras, por la canaleta superior y la vertical izquierda de la placa de control
    const yDuctoSup = ytopCtrl - ductH.w/2, xDuctoIzq = sCtrl.placa.x + MARGEN + ductV.w/2;
    for(const d of dest){ const px = d.x + 8, yy = d.y + d.h + DUCT_GAP*0.6;
      const xB = conPot && sCtrl.x0 > sPot[0].x0 ? busX1 - 15 : busX0 + 15;
      const ini = [[xB, busY - fase.paso], [xB, yDuctoSup]];
      conexiones.push({ tipo:"cable", fase:"L1-L2-L3", desc:"Alimentación de guardamotores desde barras", pts:[...ini, [xDuctoIzq, yDuctoSup], [xDuctoIzq, yy], [px, yy], [px, d.y + d.h]] }); }
  }

  // ===== 5) puerta: mando del Q1, panel de operación, teclados de variadores, ventilación =====
  const yPanel = Math.min(H - 150, 1650 - zocalo + panelAlt);
  puerta.push({ tag:"Q1", tipo:"manija", desc: acc.lockout ? "Manija del interruptor general con bloqueo por candado (lock out / tag out)" : "Manija del interruptor general", modelo:C.MANIJA.modelo, lockout: !!acc.lockout, x:q1.x + q1.w/2, y:q1.y + q1.h/2, w:C.MANIJA.w, h:C.MANIJA.h, seccion:sQ1.id });
  // panel de operación (criterio de los planos de referencia): luces de fase en su propia fila arriba; debajo UNA FILA POR
  // EQUIPO con sus mandos juntos (el variador ocupa dos: [L/R, arrancar, parar, reset] y [velocidad, falla, encendido,
  // detenido]; el arranque directo [arrancar, parar, encendido, falla]); columnas a 80 mm, filas a 80 mm, cada fila
  // centrada en el eje del panel; la parada de emergencia va FUERA del panel, debajo y en su eje
  const filasOp = [];
  if(acc.luces!==false) filasOp.push(["R","S","T"].map(f=>({ tag:"LT", tipo:"luz", color:"rojo", leyenda:`FASE ${f}` })));
  const motores = calc.circuits.filter(c=>c.kind==="motor");
  if(mandos){
    for(const c of motores){
      const l = c.load || {}, tg = l.tag || c.tag, vfd = l.starter==="vfd";
      if(vfd){
        filasOp.push([{ tipo:"selector", leyenda:"L       R", tag:"SS-"+tg, color:"negro" }, { tipo:"pulsador", color:"verde", leyenda:`ARRANCAR ${tg}`, tag:"PB-"+tg+"A" }, { tipo:"pulsador", color:"rojo", leyenda:`PARAR ${tg}`, tag:"PB-"+tg+"P" }, { tipo:"pulsador", color:"azul", leyenda:`RESET ${tg}`, tag:"PB-"+tg+"R" }]);
        filasOp.push([{ tipo:"potenciometro", leyenda:"VELOCIDAD", tag:"POT-"+tg, color:"negro" }, { tipo:"luz", color:"ambar", leyenda:`${tg} EN FALLA`, tag:"LF-"+tg }, { tipo:"luz", color:"verde", leyenda:`${tg} ENCENDIDO`, tag:"LE-"+tg }, { tipo:"luz", color:"rojo", leyenda:`${tg} DETENIDO`, tag:"LD-"+tg }]);
      } else filasOp.push([{ tipo:"pulsador", color:"verde", leyenda:`ARRANCAR ${tg}`, tag:"PB-"+tg+"A" }, { tipo:"pulsador", color:"rojo", leyenda:`PARAR ${tg}`, tag:"PB-"+tg+"P" }, { tipo:"luz", color:"verde", leyenda:`${tg} ENCENDIDO`, tag:"LE-"+tg }, { tipo:"luz", color:"ambar", leyenda:`${tg} EN FALLA`, tag:"LF-"+tg }]);
    }
  }
  const sPanel = cfg.panelSeccion==="potencia" && sPot.length ? sPot[0] : sCtrl;
  const pasoX = 80, pasoY = 80, colsP = Math.max(3, ...filasOp.map(f=>f.length));
  const panelW = colsP*pasoX + 40, panelH = Math.max(1, filasOp.length)*pasoY + 10;
  let panelY0 = yPanel - panelH;
  if(panelY0 < 700) panelY0 = 700;
  // posición libre en la puerta: sin cruzar la junta de una puerta doble, la manija de Q1 ni los teclados de los variadores
  const dobleP = sPanel.W >= 1000, midP = sPanel.x0 + sPanel.W/2;
  const obst = [];
  if(sPanel===sQ1) obst.push([q1.x + q1.w/2, q1.y + q1.h/2, 90 + 60, 90 + 60]);
  for(const c of comps.filter(c=>c.tipo==="variador" && c.seccion===sPanel.id)) obst.push([c.x + c.w/2, yPanel - 90, C.PANEL_VFD.w + 40, C.PANEL_VFD.h + 40]);
  const libre = cx => !(dobleP && Math.abs(cx - midP) < panelW/2 + 25) && cx - panelW/2 > sPanel.x0 + 40 && cx + panelW/2 < sPanel.x1 - 40
    && !obst.some(([ox, oy, ow, oh])=>Math.abs(ox - cx) < (ow + panelW)/2 && Math.abs(oy - (panelY0 + panelH/2)) < (oh + panelH)/2);
  const cands = (dobleP ? [0.25, 0.75, 0.2, 0.8] : [0.5, 0.3, 0.7, 0.25, 0.75]).map(f=>sPanel.x0 + sPanel.W*f);
  const pcx2 = cands.find(libre) ?? cands[0];
  filasOp.forEach((fila, r)=>fila.forEach((o, k)=>puerta.push(Object.assign({ x:pcx2 + (k - (fila.length-1)/2)*pasoX, y:panelY0 + panelH - 45 - r*pasoY, seccion:sPanel.id, diam:30, desc:descOp(o) }, o))));
  puerta.push({ tag:"EPB1", tipo:"seta", desc:"Parada de emergencia (actúa sobre la bobina de mínima tensión de Q1)", modelo:C.PUERTA.seta.modelo, leyenda:"PARADA DE EMERGENCIA", x:pcx2, y:panelY0 - 75, diam:40, anillo:60, seccion:sPanel.id, fueraPanel:true });
  const panel = { x:pcx2 - panelW/2, y:panelY0, w:panelW, h:panelH, seccion:sPanel.id };
  // teclados de los variadores en la puerta de su sección, alineados con el variador
  for(const c of comps.filter(c=>c.tipo==="variador")){
    const s = secs.find(x=>x.id===c.seccion);
    let px = c.x + c.w/2, py = yPanel - 90;
    if(s.W >= 1000 && Math.abs(px - (s.x0 + s.W/2)) < C.PANEL_VFD.w/2 + 25) px = px < s.x0 + s.W/2 ? s.x0 + s.W/2 - C.PANEL_VFD.w/2 - 40 : s.x0 + s.W/2 + C.PANEL_VFD.w/2 + 40;
    if(panel && panel.seccion===s.id && Math.abs(px - (panel.x + panel.w/2)) < (panel.w + C.PANEL_VFD.w)/2 + 20) py = panel.y - C.PANEL_VFD.h/2 - 40;
    if(Math.abs(px - (q1.x + q1.w/2)) < 120 && Math.abs(py - (q1.y + q1.h/2)) < 150) py = q1.y - 120;
    puerta.push({ tag:c.tag, tipo:"panelvfd", desc:"Panel de operador del variador "+c.tag, modelo:C.PANEL_VFD.modelo, x:px, y:py, w:C.PANEL_VFD.w, h:C.PANEL_VFD.h, seccion:s.id });
  }

  // ===== 6) balance térmico (IEC 60890) y ventilación =====
  const perd = comps.reduce((a, c)=>a + (c.perdidas||0)*(c.cant||1), 0) + (calc.mainBreaker||0)*0.35;  // + barras y conexiones
  const A = C.superficieEfectiva(W, H, D, montaje), k = 5.5;
  const tiMax = +cfg.tInterior || 45;   // °C: temperatura interior máxima de diseño (criterio usual 45 °C; variadores con su desclasificación)
  const dT = tiMax - tAmb;
  const fAlt = 3.1/Math.exp(-alt/8400);
  const term = { perdidas:Math.round(perd), superficie:+A.toFixed(2), tAmb, tiMax, k, altitud:alt, fAlt:+fAlt.toFixed(2) };
  let vent = null;
  if(dT <= 2){
    term.modo = "aire acondicionado"; term.potenciaFrio = Math.round(perd + k*A*Math.max(0, tAmb - tiMax));
    vent = { tipo:"aa", modelo:`Unidad de aire acondicionado de puerta ${Math.ceil(term.potenciaFrio/500)*500} W`, w:400, h:950 };
    criterios.push(`Temperatura de diseño ${tAmb} °C ≥ ${tiMax} °C admisibles: se requiere aire acondicionado de ${Math.ceil(term.potenciaFrio/500)*500} W.`);
  } else {
    term.disipacion = Math.round(k*A*dT);
    if(perd <= term.disipacion && ventCfg!=="forzada"){ term.modo = "natural"; criterios.push(`Pérdidas ${term.perdidas} W ≤ disipación natural ${term.disipacion} W (ΔT ${dT} K): ventilación natural.`); }
    else {
      term.caudal = Math.ceil(fAlt*Math.max(perd - term.disipacion, perd*0.25)/dT);
      const nV = Math.max(1, Math.ceil(term.caudal/700));
      const vf = C.ventilador(term.caudal/nV);
      term.modo = "forzada"; term.ventiladores = nV;
      vent = { tipo:"ventilador", n:nV, ...vf };
      criterios.push(`Pérdidas ${term.perdidas} W > disipación natural ${term.disipacion ?? 0} W: ventilación forzada ${term.caudal} m³/h a ${alt} m s.n.m. (factor ${term.fAlt}) con ${nV} ${vf.modelo.toLowerCase()}.`);
    }
  }
  if(cfg.ventilacion==="natural" && vent && vent.tipo==="ventilador"){ vent = null; term.modo = "natural (indicado por el usuario)"; avisos.push("Ventilación natural por indicación del usuario aunque el balance térmico pide ventilación forzada."); }
  else if(cfg.ventilacion==="auto" && !acc.ventilacion && vent && vent.tipo==="ventilador") avisos.push("El balance térmico pide ventilación forzada: marca «Ventilación» en los accesorios del tablero para que el unifilar y el multifilar incluyan el circuito de los ventiladores.");
  if(vent){
    const sV = comps.filter(c=>c.tipo==="variador").length ? secs.find(s=>s.id===comps.find(c=>c.tipo==="variador").seccion) : sCtrl;
    if(vent.tipo==="ventilador"){
      // criterio: cada ventilador CENTRADO en su hoja de puerta (en una sección de dos hojas, nunca sobre la junta); si una
      // hoja lleva más de uno, el grupo queda centrado en ella, simétrico
      const hojasV = sV.puertas===2 ? [[sV.x0, sV.x0 + sV.W/2], [sV.x0 + sV.W/2, sV.x1]] : [[sV.x0, sV.x1]];
      const porHoja = hojasV.map((_, j)=>Math.floor(vent.n/hojasV.length) + (j >= hojasV.length - vent.n % hojasV.length ? 1 : 0));
      const xsV = hojasV.map(([a, b], j)=>Array.from({ length:porHoja[j] }, (_, q)=>(a + b)/2 + (q - (porHoja[j]-1)/2)*(vent.marco + 40)));
      // el eje queda fijo (centro de la hoja); solo la altura se ajusta para no tocar la manija de Q1, los teclados de los
      // variadores ni el panel de operación: la entrada lo más abajo posible y la salida lo más arriba, la misma en todas
      const ocupado = [...puerta.map(d=>{ const w = d.anillo || d.w || d.diam || 40, h = d.anillo || d.h || d.diam || 40; return [d.x - w/2, d.y - h/2, d.x + w/2, d.y + h/2]; }),
        ...(panel ? [[panel.x, panel.y, panel.x + panel.w, panel.y + panel.h]] : [])];
      const libreV = (x, y) => { const r = vent.marco/2 + 25; return !ocupado.some(o=>x + r > o[0] && x - r < o[2] && y + r > o[1] && y - r < o[3]); };
      const alturas = (desde, hasta, paso) => { const out = []; for(let y = desde; paso > 0 ? y <= hasta : y >= hasta; y += paso) out.push(y); return out; };
      const yEnt = alturas(250, H*0.45, 50), ySal = alturas(H - 230, H*0.55, -50);
      // misma altura en todas las hojas si entra en la franja útil (entrada ≤ 450 mm, salida ≥ H - 450 mm); si no, cada una
      // lo más abajo / arriba que se pueda (la ventilación manda sobre la simetría en altura)
      const elegir = (cands, franja) => { const todos = cands.filter(franja).find(y=>xsV.flat().every(x=>libreV(x, y))); return xsV.map(xs=>xs.map(x=>todos ?? cands.find(y=>libreV(x, y)) ?? cands[0])); };
      const yE = elegir(yEnt, y=>y <= 450), yS = elegir(ySal, y=>y >= H - 450);
      if(ySal.length && xsV.flat().some(x=>!ySal.some(y=>libreV(x, y)))) avisos.push("No hay lugar libre en el centro de la puerta para un filtro de salida de aire: revisa su ubicación.");
      let i = 0;
      hojasV.forEach((_, j)=>xsV[j].forEach((x, q)=>{ i++;
        puerta.push({ tag:"FV"+i, tipo:"ventilador", desc:"Ventilador con filtro (entrada de aire)", modelo:vent.modelo, x, y:yE[j][q], w:vent.marco, h:vent.marco, recorte:vent.recorte, seccion:sV.id });
        puerta.push({ tag:"FS"+i+"S", tipo:"rejilla", desc:"Filtro de salida de aire", modelo:`Filtro de salida ${vent.marco}x${vent.marco} mm`, x, y:yS[j][q], w:vent.marco, h:vent.marco, recorte:vent.recorte, seccion:sV.id });
      }));
    }
    else puerta.push({ tag:"AA1", tipo:"aa", desc:"Aire acondicionado de puerta", modelo:vent.modelo, x:sV.x0 + sV.W/2, y:H/2, w:vent.w, h:vent.h, seccion:sV.id });
  }

  // ===== 7) base / placa pasacables =====
  const cabs = [];
  const acom = C.cablesAcometida(calc.mainCond || {});
  const xAcom = zonaAcom ? zonaAcom.x + zonaAcom.w/2 : q1.x + q1.w/2;
  const desdeA = desdeTxt(p, t);
  acom.forEach((a, i)=>cabs.push({ ref:"ACOMETIDA", desc:`${a.desc}${desdeA ? " desde "+desdeA : ""}`, awg:a.awg, diamFijo:a.diam, x:xAcom + (i - (acom.length-1)/2)*Math.min(70, (zonaAcom ? zonaAcom.w : 200)/Math.max(1, acom.length)), seccion:sQ1.id }));
  for(const b of bloquesB){
    const c = b.circ ? calc.circuits[b.circ.ci] : null;
    const awg = c && c.conductorMemo && c.conductorMemo.cable ? c.conductorMemo.cable[0] : "12 AWG";
    if(b.grupo==="TB1") continue;
    if(b.grupo==="X1"){ const n = b.bornes.filter(x=>x.fun==="L").length; for(let i=0;i<n;i++) cabs.push({ ref:"X1", desc:"Salida de control "+(b.bornes.filter(x=>x.fun==="L")[i].ref||""), awg:"12 AWG", x:(b.x0+b.x1)/2 + (i-(n-1)/2)*40, seccion:b.seccion }); continue; }
    cabs.push({ ref:b.grupo, desc:b.desc, awg, x:(b.x0 + b.x1)/2, seccion:b.seccion });
  }
  if(mandos) cabs.push({ ref:"CONTROL", desc:"Cables de control y señales a campo / PLC", awg:"14 AWG", x:sCtrl.x0 + sCtrl.W*0.7, seccion:sCtrl.id, multi:true });
  // ordenar por sección y repartir sin superposición (dos filas si hace falta)
  const filasBase = [[], []];
  for(const s of secs){
    const lista = cabs.filter(c=>c.seccion===s.id).map(c=>{ const dm = c.diamFijo || C.diamCable(c.awg); return Object.assign(c, C.prensaestopa(dm), { diam:dm }); }).sort((a, b)=>a.x - b.x);
    let fila = 0, ult = [s.x0 + 60, s.x0 + 60];
    for(const c of lista){
      const r = c.agujero/2 + 18;
      let x = Math.max(c.x, ult[fila] + r);
      if(x > s.x1 - 60 - r){ fila = 1; x = Math.min(Math.max(c.x, s.x0 + 60 + r, ult[1] + r), s.x1 - 60 - r); }
      c.x = x; c.fila = fila; ult[fila] = x + r; filasBase[fila].push(c);
    }
    // dos reservas por sección
    for(let i=0;i<2;i++){ const g2 = C.prensaestopa(20); const x = ult[0] + g2.agujero/2 + 18; if(x < s.x1 - 60){ cabs.push({ ref:"RESERVA", desc:"Reserva", awg:"", x, fila:0, seccion:s.id, ...g2, diam:0 }); ult[0] = x + g2.agujero/2 + 18; } }
  }
  for(const c of cabs) base.push(c);

  // ===== 8) conexiones de fuerza dentro de cada columna (para la vista y el 3D) =====
  for(const col of colsPot){ for(const cx of (col.conex||[])) conexiones.push(cx); }

  // ===== 9) criterios de diseño aplicados =====
  criterios.unshift(
    `Gabinete ${montaje==="mural" ? "mural" : "autosoportado"} ${W}x${H}x${D} mm (ancho x alto x fondo)${zocalo ? ` con zócalo de ${zocalo} mm` : ""}, ${ipRecomendado(v)}, ${secs.length} sección(es): ${secs.map(s=>`${s.W} mm ${s.rol==="potencia" ? "de fuerza" : s.rol==="control" ? "de control" : "fuerza y control"}`).join(", ")}.`,
    `Flujo de energía de arriba hacia abajo: interruptor general Q1 (${q1.modelo}) arriba, barras de cobre ${fase.nombre} mm (L1-L2-L3 a ${fase.paso} mm entre centros, aisladores cada 400 mm) y derivaciones colgadas de las barras; borneras de salida abajo, junto a la entrada ${entrada} de cables.`,
    conPot ? "Fuerza y control en placas separadas: variadores, arrancadores, interruptores en caja moldeada y reactancias en la placa de fuerza; protecciones modulares, guardamotores, contactores y borneras en la placa de control (riel DIN)." : "Una sola placa: zona de fuerza (Q1 y barras) arriba y filas de riel DIN debajo.",
  );
  if(E.dol.length) criterios.push(`Cada guardamotor encima de su contactor en la misma columna (${E.dol.map(d=>d.gm.tag+"/"+d.k.tag).join(", ")}), alimentados con barra tipo peine desde las barras; bornera TBn de cada motor en el orden de los circuitos del multifilar.`);
  for(const c of comps.filter(c=>c.tipo==="variador")) criterios.push(`${c.tag} (${c.modelo}): ${c.libreArriba} mm libres arriba y ${c.libreAbajo} mm abajo para la circulación de aire; teclado de operación en la puerta.`);
  if(comps.some(c=>c.tipo==="reactancia")) criterios.push("Reactancias de línea y filtros de carga sobre la base del gabinete por su peso, en la subcolumna junto al variador (debajo de su interruptor y seccionador portafusible) y fuera de su flujo de aire caliente.");
  criterios.push(`Canaletas ranuradas ${ductH.nombre} entre filas y ${ductV.nombre} verticales a los costados, con ${DUCT_GAP} mm libres entre equipos y canaleta; reserva de espacio ${Math.round(reserva*100)} % por fila.`);
  criterios.push(`Borneras agrupadas por función: TB1 (bobina de mínima tensión), TBn de fuerza por circuito (bornes según la corriente: ${[...new Set(bloquesB.filter(b=>b.potencia||/^TB\d/.test(b.grupo)).flatMap(b=>b.bornes.map(x=>x.modelo.replace(/-PE$/,""))))].join(", ")||"UT 6"}), X1 salidas de control; barra de tierra ${pe.nombre} mm al pie de cada placa.`);
  if(calef) criterios.push("Resistencia calefactora anticondensación con termostato (temperatura mínima baja o instalación exterior).");
  const hechos = ajustes.filter(a=>a.ok);
  if(hechos.length) criterios.push(`Ajustes pedidos por el usuario: ${hechos.map(a=>a.texto).join("; ")}.`);
  if(cfg.ladoControl==="der" && secs.length > 1) criterios.push("Placa de control a la derecha de la placa de fuerza (pedido del usuario).");
  for(const a of ajustes.filter(a=>!a.ok)) avisos.push(`No se aplicó «${a.texto}»: ${a.nota}.`);

  // modelos en la marca confirmada (mismas dimensiones de referencia; se verifican con el catálogo del fabricante)
  const mr = marcasProyecto(p);
  for(const c of [...comps, ...puerta]) if(c.modelo) c.modelo = modeloEnMarca(c.modelo, c.val || "", mr);
  const bom = listaMateriales(comps, bloquesB, barras, canaletas, rieles, puerta, fase, pe, aisladores.length*3, cabs, secciones.reduce((a, s)=>a + (s.puertas||1), 0), E.extra);
  // altura de la manija de la puerta: en los murales a media puerta (en uno bajo, 900 mm quedaba fuera de la hoja)
  const manijaY = montaje==="mural" ? Math.round(H/2 - 80) : 900;
  return { tablero:t, calc, cfg, montaje, W, H, D, zocalo, manijaY, techo: /intemperie/i.test(v.ambiente||""), ip:ipRecomendado(v), entrada, zonaAcom, ajustes,
    secciones, placas, comps, canaletas, rieles, barras, aisladores, conexiones, bornes:bloquesB, puerta, panel, base, ventilacion:vent, termico:term,
    fase, pe, filas:filaInfo, criterios, avisos, bom, tension:g.voltage, frecuencia:g.freq, reserva };

  /* --- columna de potencia: disposición relativa de sus equipos --- */
  function disponerColumna(col){
    const P = col.partes, q = P.find(x=>x.tipo==="interruptor" || x.tipo==="mcb"), f = P.find(x=>x.tipo==="xlp");
    const dr = P.find(x=>x.tipo==="variador"), ss = P.find(x=>x.tipo==="arrancador"), k = P.find(x=>x.tipo==="contactor"), ft = P.find(x=>x.tipo==="sobrecarga");
    const rs = P.filter(x=>x.tipo==="reactancia");
    const PIE = 110;   // bornera de salida y su canaleta al pie de la placa
    let ancho, alto;
    if(dr){
      // como el plano de referencia: el variador a la izquierda y una subcolumna a la derecha con el interruptor y el
      // seccionador portafusible arriba y las reactancias abajo, sobre la base (peso), fuera del aire caliente
      const wA = Math.max(q ? q.w : 0, f ? f.w : 0, ...rs.map(r=>r.w), 110);
      ancho = dr.w + 45 + wA + 35;
      const altoIzq = dr.libreArriba + dr.h + dr.libreAbajo + PIE;
      const altoDer = (q ? q.h + 50 : 0) + (f ? f.h + 60 : 0) + rs.reduce((a, r)=>a + r.h + 45, 0) + PIE + 20;
      alto = Math.max(altoIzq, altoDer);
    } else {
      const piezas = [q, f, ss, k, ft].filter(Boolean);
      ancho = Math.max(...piezas.map(x=>x.w), 90) + 70;
      alto = piezas.reduce((a, x)=>a + x.h + (x===ss ? (ss.libreArriba + ss.libreAbajo)/2 : 45), 0) + PIE;
    }
    return { src:col, ancho, alto, partes:P, q, f, dr, ss, k, ft, rs, wA: dr ? Math.max(q ? q.w : 0, f ? f.w : 0, ...rs.map(r=>r.w), 110) : 0 };
  }
  function colocarColumna(cl, x0, yTop, pl, s, yBornes){
    const put = (c, x, y) => { c.x = x; c.y = y; c.placa = pl.id; c.seccion = s.id; add(c); };
    const ph = 3, F3 = ["L1","L2","L3"], M3 = ["U","V","W"];
    const via = (fase, pts) => ({ tipo:"cable", fase, pts });
    const xp = (c, k) => c.x + c.w*(k+0.5)/3;
    cl.conex = [];
    const topBornes = yBornes + 32;
    if(cl.dr){
      const dr = cl.dr, vDer = cl.src.vfdLado==="der";
      const xD = vDer ? x0 + 15 + cl.wA + 45 : x0 + 15, xA = vDer ? x0 + 15 + cl.wA/2 : xD + dr.w + 45 + cl.wA/2;
      let y = yTop;
      if(cl.q){ put(cl.q, xA - cl.q.w/2, y - cl.q.h); y -= cl.q.h + 50; }
      if(cl.f){ put(cl.f, xA - cl.f.w/2, y - cl.f.h); y -= cl.f.h + 60; }
      // reactancias apiladas desde la base: la de línea abajo, el filtro de carga encima
      const L = cl.rs.find(r=>!r.carga), M = cl.rs.find(r=>r.carga);
      let yr = topBornes + 45;
      for(const r of [L, M].filter(Boolean)){ put(r, xA - r.w/2, yr); r.montaje = "base"; yr += r.h + 45; }
      if(yr - 45 > y + 10) avisos.push(`${dr.tag}: las reactancias no entran debajo de ${cl.f ? cl.f.tag : "su seccionador"}; aumenta el alto del gabinete.`);
      // variador lo más alto posible con su espacio libre superior; debajo, su espacio libre hasta la bornera
      let yV = yTop - dr.libreArriba - dr.h;
      const minV = topBornes + dr.libreAbajo;
      if(dr.posV==="abajo") yV = Math.min(yV, minV);
      if(yV < minV){ yV = minV; if(yV + dr.h + dr.libreArriba > yTop + 1) avisos.push(`${dr.tag}: no se respetan los ${dr.libreArriba} mm libres sobre el variador; aumenta el alto del gabinete.`); }
      put(dr, xD, yV);
      // recorrido de fuerza: Q → F → reactancia de línea → bornes de entrada del variador → salida → filtro de carga → bornera
      if(cl.q && cl.f) for(let k=0;k<ph;k++) cl.conex.push(via(F3[k], [[xp(cl.q,k), cl.q.y], [xp(cl.f,k), cl.f.y + cl.f.h]]));
      const xR = xA + cl.wA/2 + 10;     // bajada por el lado derecho de la subcolumna
      if(cl.f && L) for(let k=0;k<ph;k++){ const yh = cl.f.y - 14 - k*7, yl = L.y + L.h + 12 + k*7; cl.conex.push(via(F3[k], [[xp(cl.f,k), cl.f.y], [xp(cl.f,k), yh], [xR + k*7, yh], [xR + k*7, yl], [xp(L,k), yl], [xp(L,k), L.y + L.h]])); }
      const xIn = k => dr.x + dr.w*(0.14 + k*0.1), xOut = k => dr.x + dr.w*(0.62 + k*0.1);
      if(L) for(let k=0;k<ph;k++){ const yy = L.y + 18 + k*8; cl.conex.push(via(F3[k], [[vDer ? L.x + L.w : L.x, yy], [xIn(k), yy], [xIn(k), dr.y]])); }
      if(M) for(let k=0;k<ph;k++){ const yy = M.y + 18 + k*8; cl.conex.push(via(M3[k], [[xOut(k), dr.y], [xOut(k), yy], [vDer ? M.x + M.w : M.x, yy]])); }
      // salida hacia la bornera TBn (se completa cuando se ubica la bornera)
      cl.xTB = M ? M.x + M.w/2 : xOut(1);
      cl.salida = items => items.filter(b=>!b.pe).map((b, k)=> M ? via(M3[k], [[xp(M,k), M.y], [xp(M,k), M.y - 12 - k*6], [b.x + b.w/2, M.y - 12 - k*6], [b.x + b.w/2, topBornes - 8]]) : via(M3[k], [[xOut(k), dr.y], [b.x + b.w/2, dr.y - 40], [b.x + b.w/2, topBornes - 8]]));
    } else {
      const cx = x0 + cl.ancho/2;
      let y = yTop;
      for(const c of [cl.q, cl.f, cl.ss, cl.k, cl.ft].filter(Boolean)){
        if(c===cl.ss) y -= cl.ss.libreArriba/2;
        const yy = c===cl.ft && cl.k ? cl.k.y - c.h : y - c.h;
        put(c, cx - c.w/2, yy);
        y = yy - (c===cl.ss ? cl.ss.libreAbajo/2 : 45);
      }
      const seq = [cl.q, cl.f, cl.ss, cl.k].filter(Boolean);
      for(let i=0;i<seq.length-1;i++){ const a = seq[i], b = seq[i+1]; for(let k=0;k<ph;k++) cl.conex.push(via(F3[k], [[xp(a,k), a.y], [xp(a,k), (a.y + b.y + b.h)/2], [xp(b,k), (a.y + b.y + b.h)/2], [xp(b,k), b.y + b.h]])); }
      const ult = cl.ft || seq[seq.length-1];
      cl.xTB = cx;
      cl.salida = items => items.filter(b=>!b.pe).map((b, k)=>via((cl.src.tipo==="feeder" ? F3 : M3)[k], [[xp(ult,k), ult.y], [xp(ult,k), ult.y - 20 - k*6], [b.x + b.w/2, ult.y - 20 - k*6], [b.x + b.w/2, topBornes - 8]]));
    }
  }
}

function agruparCtrl(partes){
  // fusibles primarios + transformador/fuente + ITM principal juntos; luego derivaciones (con su diferencial)
  const g1 = [], g2 = [];
  for(const x of partes){ if(/^QC|^CB|^ID|^XS/.test(x.tag)) g2.push(x); else g1.push(x); }
  const out = [g1];
  // cada derivación con su diferencial queda junta
  let cur = [];
  for(const x of g2){ if(/^QC|^CB/.test(x.tag) && cur.length){ out.push(cur); cur = []; } cur.push(x); }
  if(cur.length) out.push(cur);
  return out;
}
function descOp(o){
  return ({ luz:"Luz piloto LED 22 mm", pulsador:"Pulsador 22 mm", selector:"Selector 2 posiciones 22 mm", potenciometro:"Potenciómetro 22 mm 10 kΩ" })[o.tipo] + (o.color ? ` (${o.color})` : "") + ` — ${o.leyenda}`;
}

/* ---------- lista de materiales con dimensiones y fuente ---------- */
function listaMateriales(comps, bornes, barras, canaletas, rieles, puerta, fase, pe, nAisl, cabs, nHojas = 1, extra = []){
  const filas = [];
  for(const c of comps){ if(c.tipo==="peine" && !c.modelo) continue;
    filas.push({ tag:c.tag, desc:c.desc, modelo:c.modelo, cant:c.cant||1, dim:c.w ? `${Math.round(c.w*10)/10} x ${Math.round(c.h)} x ${Math.round(c.d||0)}` : "", montaje:{ din:"Riel DIN", placa:"Placa", base:"Base", contactor:"Bajo contactor" }[c.montaje] || "Placa", fuente:c.fuente||"" }); }
  for(const b of bornes){
    const por = {}; for(const x of b.bornes){ por[x.modelo] = (por[x.modelo]||0) + 1; }
    for(const [m, n] of Object.entries(por)){ const d = C.borne(m); filas.push({ tag:b.grupo, desc:`Borne ${/PE$/.test(m) ? "de tierra" : "de paso"} — ${b.desc}`, modelo:m, cant:n, dim:`${d.w} x ${d.h} x ${d.d}`, montaje:"Riel DIN", fuente:C.FUENTES.borne }); }
    filas.push({ tag:b.grupo, desc:"Tapa final, topes y marcador de grupo", modelo:"D-UT + E/UK + marcador", cant:1, dim:"", montaje:"Riel DIN", fuente:C.FUENTES.borne });
  }
  const largo = (arr, f) => arr.reduce((a, x)=>a + (x.orient==="v" ? x.h : x.w), 0);
  for(const nm of [...new Set(canaletas.map(c=>c.nombre))]) filas.push({ tag:"", desc:"Canaleta ranurada PVC con tapa", modelo:`Canaleta ${nm}`, cant:`${(largo(canaletas.filter(c=>c.nombre===nm))/1000).toFixed(1)} m`, dim:nm, montaje:"Placa", fuente:C.FUENTES.canaleta });
  filas.push({ tag:"", desc:"Riel DIN perforado", modelo:C.RIEL.modelo, cant:`${(rieles.reduce((a, r)=>a + r.w, 0)/1000).toFixed(1)} m`, dim:"35 x 7,5", montaje:"Placa", fuente:"IEC 60715" });
  const bf = barras.filter(b=>b.fase!=="PE"), bp = barras.filter(b=>b.fase==="PE");
  if(bf.length) filas.push({ tag:"L1-L2-L3", desc:"Barras de cobre electrolítico de fase, estañadas en las conexiones", modelo:`Barra Cu ${fase.nombre} mm`, cant:`${(bf.reduce((a, b)=>a + b.w, 0)/1000).toFixed(2)} m`, dim:`${fase.nombre} mm`, montaje:"Aisladores", fuente:C.FUENTES.barra });
  if(nAisl) filas.push({ tag:"", desc:"Aisladores portabarras", modelo:C.AISLADOR.modelo, cant:nAisl, dim:"Ø40 x 40", montaje:"Placa", fuente:"" });
  if(bp.length) filas.push({ tag:"PE", desc:"Barra de tierra de protección, perforada", modelo:`Barra Cu ${pe.nombre} mm`, cant:`${(bp.reduce((a, b)=>a + b.w, 0)/1000).toFixed(2)} m`, dim:`${pe.nombre} mm`, montaje:"Placa", fuente:C.FUENTES.barra });
  for(const d of puerta){
    const m = d.modelo || (C.PUERTA[d.tipo]||{}).modelo || d.desc;
    filas.push({ tag:d.tag||"", desc:d.desc || d.leyenda || "", modelo:m, cant:1, dim:calado(d), montaje:"Puerta", fuente:C.FUENTES.puerta });
  }
  filas.push(...extra);
  if(puerta.some(d=>d.lockout)) filas.push({ tag:"Q1", desc:"Candado de bloqueo de seguridad con tarjeta de advertencia (lock out / tag out)", modelo:"Candado dieléctrico de seguridad + tarjeta LOTO", cant:1, dim:"", montaje:"Manija", fuente:"OSHA 1910.147 / NFPA 70E" });
  filas.push({ tag:"", desc:"Señal de riesgo eléctrico «PELIGRO» (una en cada puerta)", modelo:"Señal autoadhesiva ISO 7010 W012, 110 mm", cant:nHojas, dim:"110 mm", montaje:"Puerta", fuente:"ISO 7010 / NTP 399.010" });
  const gl = {}; for(const c of cabs){ if(!c.rosca) continue; gl[c.rosca] = (gl[c.rosca]||0) + 1; }
  for(const [r, n] of Object.entries(gl)) filas.push({ tag:"", desc:"Prensaestopa de poliamida / latón niquelado con contratuerca", modelo:`Prensaestopa ${r}`, cant:n, dim:r, montaje:"Base", fuente:"EN 62444" });
  return filas;
}

/* todos los tableros de fuerza con su arreglo */
export function arreglosProyecto(p){ return tablerosPotencia(p).map(t=>{ const c = calcularTablero(p, t); return c.circuits.length ? arregloTablero(p, t, c) : null; }).filter(Boolean); }

/* medida y calado (recorte en la puerta) de un dispositivo de puerta, para la lista de materiales */
function calado(d){
  if(d.tipo==="hmi") return `Recorte ${d.recorteW} x ${d.recorteH}`;
  if(d.tipo==="ventilador" || d.tipo==="rejilla") return `${d.w} x ${d.h}${d.recorte ? `, calado ${d.recorte} x ${d.recorte}` : ""}`;
  if(d.w) return `${d.w} x ${d.h}`;
  if(d.diam) return `Ø${d.anillo||d.diam}, calado Ø22,5`;
  return "";
}

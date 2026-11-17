/* Ingenia — motor de ARREGLO MECÁNICO del TABLERO DE CONTROL (PLC, fuentes, relés de interfaz y borneras).
   Con los mismos equipos y TAG de js/control/equipos.js (los del unifilar, el multifilar, los lazos y la arquitectura)
   dispone cada componente con criterio de diseñador de tableros, para que el montaje y el cableado sean simples y
   la fuerza, la distribución, las borneras y las protecciones queden ordenadas:
   · arriba la acometida y la distribución: MCB1 / MCB2, supresor de sobretensiones, fuente de 24 Vdc (CB1 → PS1 →
     CB2) con sus fusibles-borne XF1 y las derivaciones agrupadas por barra (120 Vac con CB3, servicios en 220 Vac);
   · al centro el PLC en el orden físico de su familia (fuente del PLC si la lleva, CPU, módulos de E/S, distribuidor de
     potencial y tapa terminadora) en un riel propio, con espacio libre arriba y abajo para su ventilación, y la red
     de control (switch y router) a su lado;
   · debajo los relés de interfaz CRn, en una fila alineada con los módulos de salidas digitales que los mandan;
   · al pie las borneras agrupadas por función en el orden del multifilar (TB1 / TB2 acometidas, TB3 / TB4 salidas y
     una bornera por módulo de E/S) y la barra de tierra, junto a la entrada de cables;
   · canaletas ranuradas dimensionadas por cantidad de conductores, reserva de espacio por fila, gabinete normalizado
     (mural o autosoportado) elegido por las dimensiones reales y balance térmico IEC 60890.
   Devuelve un modelo con la misma forma que el de arreglo.js para que el plano 2D (cad/plano-mecanico.js) y la vista
   3D (visor3d.js) lo dibujen igual. Coordenadas en mm desde la esquina inferior izquierda del cuerpo del gabinete; lo
   que fija el usuario (o Copito) vive en datos(p).mecanico[tablero.id] (cfgMecanico, compartido con fuerza). */
import { tablerosControl, ipRecomendado } from "../datos.js";
import { valoresDiseno, tempDiseno } from "../modules/criterios.js";
import { equiposControl } from "../control/equipos.js";
import { cfgMecanico, ACCIONES_MOVER } from "./arreglo.js";
import * as C from "./componentes.js";

const ZPLACA = 25;          // superficie de la placa de montaje desde la pared posterior
const DUCT_GAP = 25;        // espacio libre entre equipos y canaleta (conductores de control de 1 mm²)
const GAP_PLC = 50;         // espacio libre arriba y abajo del PLC (ventilación del rack)
const MARGEN = 10;          // entre canaleta y borde de placa
const GAP = 10;             // entre grupos de una fila
const ZONA_PE = 70;         // franja de la barra de tierra (lado de la entrada de cables)
const AREA_COND = 6, LLENADO = 0.4;   // mm² por conductor de control (1 mm² aislado) y llenado máximo de canaleta (criterios del proyecto)

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
/* canaleta por cantidad de conductores (llenado ≤ 40 %) */
function canaletaCtrl(n, minW){
  const area = Math.max(1, n)*AREA_COND/LLENADO;
  const c = C.CANALETAS.find(([w, h])=>w*h*0.9 >= area && w >= (minW||0)) || C.CANALETAS[C.CANALETAS.length-1];
  return { w:c[0], h:c[1], nombre:`${c[0]}x${c[1]} mm` };
}
/* conductores internos que llegan a cada equipo (para dimensionar canaletas) */
const conductores = x => x.tipo==="bornera" ? x.b.bornes.length : ({ mcb:4, diferencial:4, spd:2, fuente:6, cpu:4, modulo:(x.canales||16)*2 + 2, fpd:4, tapa:0, switch:4, router:3, rele:4, termostato:2, tomacorriente:3, resistencia:2 })[x.tipo] ?? 2;
const anchoG = g => g.items.reduce((a, x)=>a + x.w, 0);
const altoG = g => Math.max(...g.items.map(x=>x.h), 40);
/* «CR1…CR16» si los TAG son correlativos; si no, la lista */
function rango(tags){
  if(tags.length < 3) return tags.join(", ");
  const m = tags.map(t=>String(t).match(/^(.*?)(\d+)$/));
  if(m.every(x=>x && x[1]===m[0][1]) && m.every((x, i)=>!i || +x[2]===+m[i-1][2] + 1)) return `${tags[0]}…${tags[tags.length-1]}`;
  return tags.join(", ");
}
const mayus = s => String(s||"").toUpperCase();

/* ---------- equipos del tablero (con los TAG de equipos.js), en filas lógicas de arriba hacia abajo ---------- */
function construir(eq, calef, sup){
  let n = 0;
  const mk = (o, dim) => Object.assign({ id:"c"+(++n), cant:1, x:0, y:0, z:ZPLACA, etqJusta:true }, dim||{}, o);
  // los interruptores modulares trabajan muy por debajo de su In: pérdidas a ~45 % de In
  const mcb = (q, extra) => { const d = C.mcb(q.polos||2); return mk(Object.assign({ tag:q.tag, tipo:"mcb", polos:q.polos||2, desc:q.desc, modelo:q.modelo, val:q.val }, extra||{}), Object.assign(d, { perdidas:+(d.perdidas*0.2).toFixed(2) })); };
  const circ = Object.fromEntries(eq.circuitos.map(c=>[c.tag, c]));
  const destino = (b, x) => {
    if(x.pe) return x.fun==="SH" ? "PANTALLAS DE LOS CABLES DE SEÑAL (BARRA PE)" : "TIERRA DE PROTECCIÓN (BARRA PE)";
    const a = eq.acometidas.find(a=>a.tb===b.tag);
    if(a) return mayus(`Acometida ${a.tension} (${x.fun}) desde ${a.desde} → ${a.q.tag}`);
    if(b.tag==="XF1") return x.ref && circ[x.ref] ? mayus(`${x.ref} +24 Vdc - ${circ[x.ref].descripcion}`) : "0 VDC COMÚN (DESDE CB2 / PS1)";
    if(x.ref && circ[x.ref]) return mayus(`${x.fun==="N" ? "Neutro" : "Fase"} ${x.ref} - ${circ[x.ref].descripcion}`);
    const m = eq.plc.modulos.find(m=>m.tb===b.tag);
    if(m){ const s = m.senales[Math.floor((+x.n - 1)/2)]; return s ? mayus(`${s.origen==="reserva" || s.tag==="-" ? "Reserva" : s.tag} (${x.fun}) - ${m.tag} canal ${s.ch}`) : ""; }
    return "";
  };
  const colorBorne = x => x.pe ? 0xc9bf2b : /HESI/.test(x.modelo) ? 0x3b3f46 : /PTTB/.test(x.modelo) ? 0x9aa0a8 : 0x8a9099;
  const bloque = b => {
    const bornes = b.bornes.map(x=>{ const d = C.borneControl(x.modelo); return Object.assign({}, x, { w:d.w, h:d.h, d:d.d, dest:destino(b, x), color:colorBorne(x) }); });
    return { tag:b.tag, tipo:"bornera", b:{ grupo:b.tag, desc:b.desc, bornes }, w: bornes.reduce((a, x)=>a + x.w, 0) + C.TAPA_FINAL + 2*C.TOPE + 4, h: Math.max(...bornes.map(x=>x.h)) };
  };
  const filas = [], ext = { techo:[], marco:[], ventiladores:null, termostato:null, luminaria:null };
  // ===== 1) acometidas, supresor de sobretensiones y fuente de 24 Vdc con sus fusibles-borne
  const g1 = [];
  const gSpd = { items:[ mcb(eq.spd.cb, { desc:eq.spd.cb.desc }), ...eq.spd.tags.map((tg, i)=>mk({ tag:tg, tipo:"spd", polos:1, desc:`Supresor de sobretensiones ${String(eq.spd.tipo||"").toLowerCase()} (${i ? "neutro" : "fase"}) de la acometida de ${(eq.acometidas.find(a=>a.id===eq.spd.acometida)||eq.acometidas[0]).tension}`, modelo:eq.spd.modelo, val:"40 kA / 275 V", grupoBom:"spd" }, C.SPD_1P)) ] };
  for(const a of eq.acometidas){ g1.push({ items:[mcb(a.q, { desc:`${a.q.desc} (acometida ${a.tb} desde ${a.desde})`, bus:a.tension })] }); if(a.id===eq.spd.acometida) g1.push(gSpd); }
  if(!g1.includes(gSpd)) g1.push(gSpd);
  if(eq.fuente){ const f = eq.fuente; g1.push({ items:[ mcb(f.cb), mk({ tag:f.ps.tag, tipo:"fuente", desc:f.ps.desc, modelo:f.ps.modelo, val:`24 Vdc ${f.ps.val}` }, C.fuente24(f.ps.modelo)), mcb(f.cbOut) ] }); }
  const xf = eq.borneras.find(b=>b.tag==="XF1");
  if(xf) g1.push({ items:[bloque(xf)] });
  filas.push({ id:"acom", nombre:"Acometidas, supresor y fuente de 24 Vdc", zona:"dist", grupos:g1 });
  // ===== 2) distribución de 120 Vac (CB3 y un interruptor 2P por circuito)
  const c120 = eq.circuitos.filter(c=>c.barra==="120 Vac"), c220 = eq.circuitos.filter(c=>c.barra!=="120 Vac" && c.barra!=="24 Vdc");
  if(eq.cb120 || c120.length){
    const gs = []; if(eq.cb120) gs.push({ items:[mcb(eq.cb120)] });
    for(const c of c120) gs.push({ items:[mcb(c, { desc:`Interruptor del circuito ${c.circuito} de ${eq.vEst}: ${c.descripcion}`, descBom:`Interruptor termomagnético 2P de los circuitos de ${eq.vEst} (${c.val})`, grupoBom:"d120" })] });
    filas.push({ id:"d120", nombre:`Distribución de ${eq.vEst}`, zona:"dist", grupos:gs });
  }
  // ===== 3) servicios del tablero (220 Vac): ventilación con termostato, luminaria, tomacorriente con diferencial
  if(c220.length){
    const gs = [];
    for(const c of c220){
      const it = [mcb(c, { desc:`Interruptor del circuito ${c.circuito} de ${c.barra}: ${c.descripcion}` })], ex = c.extra || {};
      if(c.id) it.push(mk({ tag:c.id.tag, tipo:"diferencial", polos:2, desc:`Interruptor diferencial ${c.id.sens} del circuito ${c.tag} (${c.descripcion.toLowerCase()})`, modelo:c.id.modelo, val:c.id.val }, C.diferencial(2)));
      if(ex.termostato){ const th = mk({ tag:ex.termostato, tipo:"termostato", desc:`Termostato de los ventiladores ${(ex.ventiladores||[]).join(" y ")} (circuito ${c.tag})`, modelo:C.TERMOSTATO.modelo, val:"35 °C" }, C.TERMOSTATO); it.push(th); ext.termostato = th; ext.ventiladores = { tags:ex.ventiladores||["V1","V2"], cb:c.tag }; }
      if(ex.tomacorriente) it.push(mk({ tag:ex.tomacorriente, tipo:"tomacorriente", desc:`Tomacorriente doble de servicio (protegido por ${c.id ? c.id.tag : c.tag})`, modelo:C.TOMA_DIN.modelo, val:"15 A" }, C.TOMA_DIN));
      if(ex.luminaria) ext.luminaria = { lm:ex.luminaria, sq:ex.interruptorPuerta, cb:c.tag };
      gs.push({ items:it });
    }
    filas.push({ id:"d220", nombre:`Servicios del tablero (${c220[0] ? c220[0].barra : "220 Vac"})`, zona:"dist", grupos:gs, juntar:true });
  }
  // ===== 4) PLC por slot (rack que no se separa) y red de control a su lado
  const pl = eq.plc, rack = [];
  // en el orden físico de la familia (izquierda → derecha): fuente del PLC (PM 1507 / BMX CPS), CPU en su slot,
  // módulos por slot, distribuidor de potencial y tapa terminadora
  const orden = pl.orden && pl.orden.length ? pl.orden : [pl.cpu, ...pl.modulos, pl.fpd, pl.tapa].filter(Boolean);
  for(const x of orden){
    if(x===pl.cpu) rack.push(mk({ tag:x.tag, tipo:"cpu", slot:x.slot ?? 0, desc:`${x.desc} — ${x.familia} (slot ${x.slot ?? 0})`, modelo:x.modelo, val:pl.red||"" }, C.plcModulo(x.modelo, "cpu")));
    else if(x===pl.ps) rack.push(mk({ tag:x.tag, tipo:"modulo", io:"PS", slot:x.slot, canales:2, desc:`${x.desc} (slot ${x.slot})`, modelo:x.modelo, val:"24 Vdc" }, C.plcModulo(x.modelo, "modulo")));
    else if(x===pl.fpd) rack.push(mk({ tag:x.tag, tipo:"fpd", desc:x.desc, modelo:x.modelo, val:"" }, C.plcModulo(x.modelo, "fpd")));
    else if(x===pl.tapa) rack.push(mk({ tag:x.tag, tipo:"tapa", desc:x.desc, modelo:x.modelo, val:"" }, C.plcModulo(x.modelo, "tapa")));
    else rack.push(mk({ tag:x.tag, tipo:"modulo", io:x.tipo, slot:x.slot, canales:x.canales, tb:x.tb, desc:`${x.desc} (slot ${x.slot}, bornera ${x.tb})`, modelo:x.modelo || "(definir con el fabricante)", val:`${x.canales} canales` }, C.plcModulo(x.modelo, "modulo")));
  }
  const gPlc = [{ items:rack, fijo:true, rack:true }];
  for(const r of eq.red.filter(r=>r.tipo!=="hmi")) gPlc.push({ items:[mk({ tag:r.tag, tipo:r.tipo, desc:r.desc, modelo:r.modelo, val:r.tipo==="switch" ? (pl.red||"Ethernet") : "4G / VPN" }, C.equipoRed(r.tipo, r.modelo))], gap: gPlc.length===1 ? 30 : GAP });
  filas.push({ id:"plc", nombre:`PLC ${eq.familia.nombre} y red de control`, zona:"plc", grupos:gPlc, siemens:/siemens/i.test(eq.familia.marca||"") });
  // ===== 5) relés de interfaz, un grupo por módulo de salidas digitales (alineado con su módulo)
  const gRel = [];
  for(const m of pl.modulos.filter(m=>m.tipo==="DO")){
    const rs = eq.reles.filter(r=>r.modulo===m.tag).map(r=>{ const d = C.releInterfaz(r.bobina); return mk({ tag:r.tag, tipo:"rele", modulo:m.tag, ch:r.ch, desc:`Relé de interfaz de ${m.tag} canal ${r.ch}: ${r.desc}`, modelo:d.modelo, val:`Bobina ${r.bobina}, contacto ${r.contacto}`, grupoBom:"rele", descBom:`Relé de interfaz enchufable con base de ${m.tag} (bobina ${r.bobina})` }, d); });
    if(rs.length) gRel.push({ items:rs, suelto:true, alinear:m.tag });
  }
  if(gRel.length) filas.push({ id:"reles", nombre:"Relés de interfaz", zona:"reles", grupos:gRel });
  // ===== 6) borneras al pie, en el orden del multifilar
  filas.push({ id:"bornes", nombre:"Borneras", zona:"bornes", grupos: eq.borneras.filter(b=>b.tag!=="XF1").map(b=>({ items:[bloque(b)] })) });
  // resistencia calefactora abajo (el aire caliente sube): al pie de la placa junto a la barra de tierra; con entrada
  // superior (borneras arriba), al final de la última fila
  if(calef){
    const pc = eq.calefaccion, wr = pc ? pc.resistencias[0].w : 100;
    const r1 = mk({ tag:"R1", tipo:"resistencia", desc:`Resistencia calefactora anticondensación ${wr} W con termostato TH2, alimentada desde ${pc ? pc.circuito : "el tablero"}`, modelo:`Resistencia PTC ${wr} W + termostato TH2 0…60 °C`, val:`${wr} W`, w:60, h:125, d:60, montaje:"din", perdidas:0, fuente:"Accesorios de climatización de gabinetes (referencial)" });
    if(sup) filas.push({ id:"calef", nombre:"Calefacción anticondensación", zona:"calef", juntar:true, grupos:[{ items:[r1], gap:30 }] });
    else ext.calef = r1;
  }
  // luminaria (techo) e interruptor de puerta (marco)
  if(ext.luminaria){
    ext.techo.push(mk({ tag:ext.luminaria.lm || "LM1", tipo:"luminaria", desc:`Luminaria LED interior (circuito ${ext.luminaria.cb}), encendida por ${ext.luminaria.sq || "el interruptor de puerta"}`, modelo:C.LUMINARIA.modelo, val:"8 W" }, C.LUMINARIA));
    if(ext.luminaria.sq) ext.marco.push(mk({ tag:ext.luminaria.sq, tipo:"finpuerta", desc:`Interruptor de puerta de la luminaria ${ext.luminaria.lm || "LM1"}`, modelo:C.FIN_PUERTA.modelo, val:"1NA" }, C.FIN_PUERTA));
  }
  return { filas, ext };
}

/* ---------- arreglo completo del tablero de control ---------- */
export function arregloControl(p, t){
  const cfg = cfgMecanico(p, t), v = valoresDiseno(p);
  const eq = equiposControl(p, t);
  const reserva = Math.max(0, Math.min(60, +(cfg.reserva!=="" ? cfg.reserva : v.reservaTablero) || 20))/100;
  const criterios = [], avisos = [], ajustes = [];
  const comps = [], canaletas = [], rieles = [], barras = [], conexiones = [], placas = [], secciones = [], puerta = [], base = [], bloquesB = [];
  const tMin = parseFloat(v.tempMin), tAmb = tempDiseno(v), alt = parseFloat(v.altitud) || 0;
  // calefacción y luces piloto: las mismas del unifilar y del multifilar (equiposControl)
  const calef = !!eq.calefaccion;
  const entrada = cfg.entrada==="superior" ? "superior" : "inferior";
  const { filas, ext } = construir(eq, calef, entrada==="superior");
  let panelAlt = +cfg.panelAltura || 0;

  // ===== ajustes del usuario (mover, intercambiar, subir o bajar equipos) =====
  const movs = (Array.isArray(cfg.mover) ? cfg.mover : []).filter(mv=>mv && mv.equipo && ACCIONES_MOVER[mv.accion]);
  const txtMov = mv => `${mv.equipo} ${ACCIONES_MOVER[mv.accion]}${mv.ref ? " "+mv.ref : ""}`;
  const ubicar = tag => { for(let r=0;r<filas.length;r++){ const f = filas[r]; for(let g=0; g<f.grupos.length; g++){ const i = f.grupos[g].items.findIndex(x=>x.tag===tag); if(i>=0) return { r, g, i }; } } return null; };
  for(const mv of movs){
    const txt = txtMov(mv), vert = mv.accion==="arriba" || mv.accion==="abajo";
    if(/^(HMI\d*|PANEL|H\d+)$/.test(mv.equipo)){
      if(vert){ panelAlt += mv.accion==="arriba" ? 150 : -150; ajustes.push({ texto:txt.replace("una fila ", "150 mm "), ok:true }); }
      else ajustes.push({ texto:txt, ok:false, nota:"la pantalla va centrada en su puerta; se puede subir o bajar" });
      continue;
    }
    if(/^(V\d+|LM\d+|SQ\d+|AA\d+)$/.test(mv.equipo)){ ajustes.push({ texto:txt, ok:false, nota:"su ubicación es fija (ventilación: entrada abajo y extracción arriba; luminaria en el techo; interruptor en el marco de la puerta)" }); continue; }
    const u = ubicar(mv.equipo);
    if(!u){ ajustes.push({ texto:txt, ok:false, nota:"no encontré ese equipo en el arreglo del tablero de control" }); continue; }
    const fila = filas[u.r], grupo = fila.grupos[u.g], x = grupo.items[u.i];
    if(vert){
      if(fila.zona==="calef"){ ajustes.push({ texto:txt, ok:false, nota:"la resistencia calefactora va abajo, donde el aire es más frío (el aire caliente sube)" }); continue; }
      if(fila.zona==="bornes"){ const r = reubicar(fila.grupos, u.g, mv.accion==="arriba" ? "izquierda" : "derecha"); ajustes.push({ texto:txt, ok:r===true, nota: r==="limite" ? "ya está en el extremo de la fila de borneras" : "" }); continue; }
      const eqF = filas.filter(f=>f.zona!=="bornes" && f.zona!=="calef"), bs = filas.filter(f=>f.zona==="bornes"), cf = filas.filter(f=>f.zona==="calef");
      const r = reubicar(eqF, eqF.indexOf(fila), mv.accion);
      if(r===true) filas.splice(0, filas.length, ...eqF, ...bs, ...cf);
      ajustes.push({ texto:`${txt} (fila «${fila.nombre}»)`, ok:r===true, nota: r==="limite" ? `ya está en la ${mv.accion==="arriba" ? "primera" : "última"} fila de equipos (las borneras van siempre junto a la entrada de cables)` : "" });
      continue;
    }
    if(grupo.fijo && x.tipo!=="cpu"){ ajustes.push({ texto:txt, ok:false, nota:`los módulos del PLC van en el orden de sus slots (${x.tag} está en el slot ${x.slot ?? "—"}); el slot se cambia en el listado I/O` }); continue; }
    const ur = mv.ref ? ubicar(mv.ref) : null;
    if(mv.ref && !ur){ ajustes.push({ texto:txt, ok:false, nota:"el equipo de referencia no está en el tablero de control" }); continue; }
    let r;
    if(ur){
      const fr = filas[ur.r], gr = fr.grupos[ur.g];
      const porItem = grupo.suelto && gr.suelto && !gr.fijo;
      if(ur.r===u.r && ur.g===u.g) r = grupo.fijo ? false : reubicar(grupo.items, u.i, mv.accion, ur.i);
      else if(porItem && mv.accion==="intercambiar"){ grupo.items[u.i] = gr.items[ur.i]; gr.items[ur.i] = x; r = true; }
      else if(porItem){ grupo.items.splice(u.i, 1); gr.items.splice(gr.items.indexOf(gr.items[ur.i]) + (mv.accion==="despues" ? 1 : 0), 0, x); r = true; }
      else if(ur.r===u.r) r = reubicar(fila.grupos, u.g, mv.accion, ur.g);
      else if(["antes","despues","intercambiar"].includes(mv.accion)){
        if(mv.accion==="intercambiar"){ fila.grupos[u.g] = gr; fr.grupos[ur.g] = grupo; }
        else { const mover = grupo.suelto && grupo.items.length > 1 ? { items:grupo.items.splice(u.i, 1), suelto:true } : fila.grupos.splice(u.g, 1)[0];
          fr.grupos.splice(fr.grupos.indexOf(gr) + (mv.accion==="despues" ? 1 : 0), 0, mover); }
        r = true;
      } else r = false;
    }
    else if(!grupo.fijo && grupo.items.length > 1 && (grupo.suelto || (mv.accion==="izquierda" && u.i > 0) || (mv.accion==="derecha" && u.i < grupo.items.length-1))) r = reubicar(grupo.items, u.i, mv.accion);
    else r = reubicar(fila.grupos, u.g, mv.accion);
    ajustes.push({ texto:txt, ok:r===true, nota: r==="limite" ? "ya está en el extremo de su fila" : r ? "" : "no se pudo reubicar respecto de ese equipo" });
  }
  for(const f of filas) f.grupos = f.grupos.filter(g=>g.items.length);
  for(let i=filas.length-1; i>=0; i--) if(!filas[i].grupos.length) filas.splice(i, 1);
  // con entrada superior las borneras y la barra de tierra van arriba, junto a los prensaestopas del techo
  const orden = entrada==="superior" ? [...filas.filter(f=>f.zona==="bornes"), ...filas.filter(f=>f.zona!=="bornes" && f.zona!=="calef"), ...filas.filter(f=>f.zona==="calef")] : filas;

  // ===== canaletas: horizontales por los conductores de cada fila; verticales por el total (dos lados) =====
  const condFila = f => f.grupos.reduce((a, g)=>a + g.items.reduce((b, x)=>b + conductores(x), 0), 0);
  const nH = Math.max(...filas.map(f=>condFila(f)*0.6), 20), nV = filas.reduce((a, f)=>a + condFila(f), 0)*0.4;
  let ductH = canaletaCtrl(nH, 40), ductV = canaletaCtrl(nV, 40);
  const mCan = String(cfg.canaleta||"").match(/(\d{2,3})\s*x\s*(\d{2,3})/i);
  if(mCan){ const dc = { w:+mCan[1], h:+mCan[2], nombre:`${+mCan[1]}x${+mCan[2]} mm` }; ductH = dc; ductV = dc; }

  // ===== filas físicas en un ancho útil =====
  const altoFila = (gs, zona) => Math.max(...gs.map(altoG), 40) + 2*(zona==="plc" ? GAP_PLC : DUCT_GAP);
  const fisicas = util => {
    const out = [];
    for(const f of orden){
      const res = f.zona==="bornes" ? reserva*0.5 : reserva, lim = util/(1+res);
      const fs = [[]]; let w = 0;
      for(const g0 of f.grupos){
        // un grupo de equipos sueltos (relés) más ancho que la fila se parte en tramos
        const partes = [];
        if(g0.suelto && anchoG(g0) > lim){ let cur = [], wc = 0; for(const x of g0.items){ if(cur.length && wc + x.w > lim){ partes.push(Object.assign({}, g0, { items:cur })); cur = []; wc = 0; } cur.push(x); wc += x.w; } if(cur.length) partes.push(Object.assign({}, g0, { items:cur })); }
        else partes.push(g0);
        for(const g of partes){ const a = anchoG(g) + (g.gap ?? GAP);
          if(fs[fs.length-1].length && w + a > lim){ fs.push([]); w = 0; }
          fs[fs.length-1].push(g); w += a; }
      }
      const fl = fs.filter(x=>x.length);
      const ult = out[out.length-1];
      if(f.juntar && fl.length===1 && ult && (f.zona==="calef" || ult.zona!=="plc") && ult.grupos.length){
        const wp = ult.grupos.reduce((a, g)=>a + anchoG(g) + (g.gap ?? GAP), 0), wn = fl[0].reduce((a, g)=>a + anchoG(g) + (g.gap ?? GAP), 0) + 20;
        if(wp + wn <= util/(1 + (ult.zona==="bornes" ? reserva*0.5 : reserva))){ ult.grupos.push(...fl[0].map((g, i)=>i ? g : Object.assign({}, g, { gap:30 }))); ult.nombre += " · " + f.nombre; ult.h = altoFila(ult.grupos, ult.zona); continue; }
      }
      fl.forEach((gs, i)=>out.push({ nombre: f.nombre + (fl.length>1 ? ` (${i+1})` : ""), zona:f.zona, siemens:f.siemens, grupos:gs, h:altoFila(gs, f.zona) }));
    }
    return out;
  };
  const altoTotal = rows => MARGEN + ductH.w + rows.reduce((a, r)=>a + r.h + ductH.w, 0) + ZONA_PE;
  const rackW = anchoG(filas.flatMap(f=>f.grupos).find(g=>g.rack) || { items:[] });

  // ===== gabinete: el normalizado más pequeño (área) en el que entren las filas =====
  const fijoW = +cfg.ancho || 0, fijoH = +cfg.alto || 0, fijoD = +cfg.fondo || 0;
  const utilDe = Wp => Wp - 2*(MARGEN + ductV.w) - 2*15;
  const probar = (W, H, mont) => {
    const pl = C.placaDe(mont, W, H), util = utilDe(pl.w);
    if(util < rackW + 10) return null;
    const rows = fisicas(util), alto = altoTotal(rows);
    return alto <= pl.h ? { W, H, montaje:mont, util, rows, alto } : null;
  };
  const candidatos = mont => {
    const G = mont==="mural" ? C.GAB_MURAL_CTRL : C.GAB_PISO, out = [];
    for(const W of G.anchos) for(const H of G.altos) if(mont==="piso" || H >= W) out.push([W, H]);
    // menor superficie, pero los gabinetes de más de 2000 mm se penalizan: los equipos de arriba quedan fuera del
    // alcance cómodo para el montaje y el mantenimiento (se prefiere un gabinete más ancho y más bajo)
    const costo = ([W, H]) => W*H*(H > 2000 ? 1.15 : 1);
    return out.sort((a, b)=>costo(a) - costo(b) || a[1] - b[1]);
  };
  const montPedido = cfg.montaje==="piso" || cfg.montaje==="mural" ? cfg.montaje : fijoH ? (fijoH >= 1600 ? "piso" : "mural") : "auto";
  const montajes = montPedido==="auto" ? ["mural", "piso"] : [montPedido];
  let sel = null;
  if(fijoW || fijoH){
    for(const mont of montajes){
      const G = mont==="mural" ? C.GAB_MURAL_CTRL : C.GAB_PISO;
      for(const W of fijoW ? [fijoW] : G.anchos){ for(const H of fijoH ? [fijoH] : G.altos){ sel = probar(W, H, mont); if(sel) break; } if(sel) break; }
      if(sel) break;
    }
    if(!sel) avisos.push(`El gabinete pedido (${fijoW || "—"} x ${fijoH || "—"} mm) no alcanza para los equipos con la reserva de ${Math.round(reserva*100)} %: se usa el normalizado que sigue.`);
  }
  if(!sel) for(const mont of montajes){ for(const [W, H] of candidatos(mont)){ sel = probar(W, H, mont); if(sel) break; } if(sel) break; }
  if(!sel && montPedido==="mural"){ avisos.push("No entra en un gabinete mural normalizado: se pasa a autosoportado."); for(const [W, H] of candidatos("piso")){ sel = probar(W, H, "piso"); if(sel) break; } }
  if(!sel){
    avisos.push("Los equipos no entran en los gabinetes normalizados: revisa la reserva o divide el tablero.");
    const W = 1200, H = 2200, pl = C.placaDe("piso", W, H), util = utilDe(pl.w), rows = fisicas(util);
    sel = { W, H, montaje:"piso", util, rows, alto:altoTotal(rows) };
  }
  const { W, H, montaje, rows } = sel;
  if(montPedido==="mural" && montaje==="piso" && !avisos.some(a=>/autosoportado/.test(a))) avisos.push("No entra en un gabinete mural normalizado: se pasa a autosoportado.");
  const zocalo = montaje==="mural" ? 0 : C.GAB_PISO.zocalo;
  const hmiEq = eq.red.find(r=>r.tipo==="hmi"), hm = hmiEq ? C.hmi(hmiEq.modelo) : null;
  const todos = [...filas.flatMap(f=>f.grupos.flatMap(g=>g.items)), ...ext.techo, ...ext.marco];
  const maxD = Math.max(...todos.filter(x=>x.tipo!=="bornera").map(x=>x.d||0), ...todos.filter(x=>x.tipo==="bornera").flatMap(x=>x.b.bornes.map(b=>b.d)), 100);
  const fondos = montaje==="mural" ? C.GAB_MURAL_CTRL.fondos : C.GAB_PISO.fondos;
  const fondoMin = maxD + ZPLACA + Math.max(85, hm ? hm.prof + 20 : 0);
  let D = fondos.find(f=>f >= fondoMin) || fondos[fondos.length-1];
  if(fijoD){ if(fijoD < fondoMin - 25) avisos.push(`El fondo pedido (${fijoD} mm) es menor que el equipo más profundo (${Math.round(maxD)} mm) más la placa y ${hm ? "la pantalla HMI en la puerta" : "la puerta"}.`); D = fijoD; }

  // ===== sección, placa y canaletas =====
  const puertas = W >= 1000 ? 2 : 1;
  const pl = C.placaDe(montaje, W, H), pc = { id:"PM1", x:pl.mx, y:pl.my, w:pl.w, h:pl.h, nombre:"PLACA DE MONTAJE" };
  placas.push(pc);
  secciones.push({ id:"S1", rol:"control", x0:0, x1:W, W, puertas, placa:pc.id, bisagra:"izq" });
  const ducto = (x, y, w, h, orient, d, uso) => canaletas.push({ placa:pc.id, x, y, w, h, orient, nombre:d.nombre, prof:d.h, uso });
  const xi = pc.x + MARGEN + ductV.w + 15, xf = pc.x + pc.w - MARGEN - ductV.w - 15;
  const anchoDH = pc.w - 2*(MARGEN + ductV.w);
  const sup = entrada==="superior";
  const ytop = sup ? pc.y + pc.h - ZONA_PE : pc.y + pc.h - MARGEN;
  let y = ytop - ductH.w;
  ducto(pc.x + MARGEN + ductV.w, y, anchoDH, ductH.w, "h", ductH);
  const xMod = {}, filaInfo = [], yDuctos = [];
  for(const r of rows){
    const yc = y - r.h/2;
    rieles.push({ placa:pc.id, x:xi - 10, y:yc, w:(xf - xi) + 20, nombre:r.nombre, modelo: r.zona==="plc" && r.siemens ? "Perfil soporte S7-1500 6ES7 590-1AE80-0AA0" : C.RIEL.modelo });
    let x = xi;
    r.grupos.forEach((g, gi)=>{
      if(gi) x += g.gap ?? GAP;
      if(g.alinear && xMod[g.alinear]!=null && xMod[g.alinear] > x && xMod[g.alinear] + anchoG(g) <= xf) x = xMod[g.alinear];
      for(const it of g.items){
        if(it.tipo==="bornera"){
          let xx = x + C.TOPE;
          const items = it.b.bornes.map(bx=>{ const o = { n:bx.n, modelo:bx.modelo, pe:!!bx.pe, fun:bx.fun, ref:bx.ref, dest:bx.dest, color:bx.color, x:xx, w:bx.w, h:bx.h, d:bx.d }; xx += bx.w; return o; });
          bloquesB.push({ grupo:it.tag, desc:it.b.desc, placa:pc.id, seccion:"S1", x0:x, x1:xx + C.TAPA_FINAL + C.TOPE, y:yc, bornes:items, potencia:false, fila:r.nombre });
        } else {
          Object.assign(it, { x, y:yc - it.h/2, placa:pc.id, seccion:"S1", fila:r.nombre });
          comps.push(it);
          if(it.tipo==="modulo") xMod[it.tag] = x;
        }
        x += it.w;
      }
    });
    if(x > xf + 1) avisos.push(`La fila «${r.nombre}» no entra en el ancho útil de la placa (${Math.round(x - xi)} de ${Math.round(xf - xi)} mm).`);
    filaInfo.push({ nombre:r.nombre, y:yc, zona:r.zona });
    y -= r.h;
    yDuctos.push(y - ductH.w/2);
    ducto(pc.x + MARGEN + ductV.w, y - ductH.w, anchoDH, ductH.w, "h", ductH);
    y -= ductH.w;
  }
  // verticales: la izquierda para fuerza (120 / 220 Vac) y la derecha para señales
  const yV0 = sup ? y : pc.y + ZONA_PE, yV1 = ytop;
  ducto(pc.x + MARGEN, yV0, ductV.w, yV1 - yV0, "v", ductV, "fuerza");
  ducto(pc.x + pc.w - MARGEN - ductV.w, yV0, ductV.w, yV1 - yV0, "v", ductV, "señales");
  if(!sup && y < pc.y + ZONA_PE - 1) avisos.push("La placa de montaje quedó justa: revisa la reserva o aumenta el alto del gabinete.");
  const libreMm = Math.round(y - (pc.y + (sup ? MARGEN : ZONA_PE)));
  // barra de tierra junto a la entrada de cables, a la izquierda (bajo las borneras de acometida)
  const pe = { nombre:"20x3", ancho:20, espesor:3 };
  const nAna = eq.plc.modulos.filter(m=>m.tipo==="AI" || m.tipo==="AO").reduce((a, m)=>a + m.senales.filter(s=>s.origen!=="reserva" && s.tag!=="-").length, 0);
  const nPE = eq.acometidas.length + bloquesB.reduce((a, b)=>a + b.bornes.filter(x=>x.pe).length, 0) + Math.ceil(nAna/2) + 8;
  const peW = Math.min(pc.w - 80 - (ext.calef ? 125 + 50 : 0), Math.max(220, nPE*25 + 50));
  const peY = sup ? pc.y + pc.h - 30 : pc.y + 30;
  barras.push({ tag:"PE", fase:"PE", nombre:pe.nombre, x:pc.x + 40, y:peY - pe.ancho/2, w:peW, h:pe.ancho, orient:"h", placa:pc.id, seccion:"S1", perforaciones:Math.round(peW/25) });
  if(ext.calef) Object.assign(comps[comps.push(ext.calef) - 1], { w:125, h:60, montaje:"placa", x:pc.x + 40 + peW + 30, y:pc.y + 5, placa:pc.id, seccion:"S1", fila:"Pie de la placa (junto a la barra de tierra)" });
  // luminaria en el techo (hacia la puerta) e interruptor de puerta en el marco del lado de la cerradura
  for(const c of ext.techo){ Object.assign(c, { x:W/2 - c.w/2, y:H - 4 - c.h, z:D - 95, z0:D - 95, placa:"", seccion:"S1", fila:"Techo del gabinete" }); comps.push(c); }
  for(const c of ext.marco){ Object.assign(c, { x:W - 4 - c.w, y:H - 260, z:D - 50, z0:D - 50, placa:"", seccion:"S1", fila:"Marco de la puerta" }); comps.push(c); }
  // recorrido de los cables de acometida: bornera → canaleta → canaleta vertical de fuerza → interruptor general
  const xVF = pc.x + MARGEN + ductV.w/2;
  for(const a of eq.acometidas){
    const b = bloquesB.find(x=>x.grupo===a.tb), q = comps.find(c=>c.tag===a.q.tag); if(!b || !q) continue;
    const iq = filaInfo.findIndex(f=>f.nombre===q.fila), ib = filaInfo.findIndex(f=>f.nombre===b.fila);
    const yb = sup ? b.y - 30 : b.y + 30, yq = q.y;
    const yDb = yDuctos[sup ? ib : ib - 1] ?? yb, yDq = yDuctos[iq] ?? yq - 30;
    conexiones.push({ tipo:"cable", fase:"L1-L2-L3", desc:`Cableado de la acometida ${a.tb} → ${a.q.tag}`, pts:[[b.x0 + 20, yb], [b.x0 + 20, yDb], [xVF, yDb], [xVF, yDq], [q.x + q.w/2, yDq], [q.x + q.w/2, yq]] });
  }

  // ===== puerta: pantalla HMI, luces piloto, ventilación =====
  const manijaY = montaje==="mural" ? Math.round(H/2 - 80) : 900;
  const hojas = puertas===2 ? [[3, W/2 - 1.5], [W/2 + 1.5, W - 3]] : [[3, W - 3]];
  const placaX = puertas===2 ? W/4 : W/2, senalX = puertas===2 ? 3*W/4 : W/2;   // placa de identificación y señalética (cada una en una hoja si hay dos puertas)
  const obst = [[placaX - 160, H - 180, 320, 110]];
  hojas.forEach(([x0, x1], i)=>{ const xm = (puertas===2 ? (i ? "der" : "izq") : "izq")==="izq" ? x1 - 45 : x0 + 25; obst.push([xm - 25, manijaY - 20, 70, 200]); });
  const libre = (cx, cy, w, h) => hojas.some(([x0, x1])=>cx - w/2 > x0 + 35 && cx + w/2 < x1 - 35) && cy - h/2 > 40 && cy + h/2 < H - 40 && !obst.some(([ox, oy, ow, oh])=>cx + w/2 > ox && cx - w/2 < ox + ow && cy + h/2 > oy && cy - h/2 < oy + oh);
  const cxP = puertas===2 ? W/4 : W/2;
  let panel = null;
  const COLOR_LUZ = { blanca:"blanco", verde:"verde", roja:"rojo", ambar:"ambar" };
  const luces = cfg.mandos==="no" ? [] : (eq.puerta||[]).filter(d=>d.tipo==="luz").map(d=>({ tag:d.tag, tipo:"luz", color:COLOR_LUZ[d.color]||d.color, leyenda:d.leyenda }));
  if(hm || luces.length){
    const hH = hm ? hm.h : 0, hLuz = luces.length ? 110 : 0;
    let yH = montaje==="mural" ? Math.min(H - 200 - hH/2, Math.max(H*0.6, hH/2 + hLuz + 120)) : Math.min(H - 300, 1400 - zocalo/2);
    yH = Math.max(hH/2 + hLuz + 80, Math.min(H - 190 - hH/2, yH + panelAlt));
    if(hm){
      puerta.push({ tag:hmiEq.tag, tipo:"hmi", desc:`${hmiEq.desc} — recorte ${hm.recorteW} x ${hm.recorteH} mm`, modelo:hmiEq.modelo, x:cxP, y:yH, w:hm.w, h:hm.h, recorteW:hm.recorteW, recorteH:hm.recorteH, prof:hm.prof, seccion:"S1", fuente:hm.fuente });
      obst.push([cxP - hm.w/2 - 30, yH - hm.h/2 - 30, hm.w + 60, hm.h + 60]);
    }
    const yL = yH - hH/2 - (hm ? 70 : 0);
    luces.forEach((o, i)=>puerta.push(Object.assign({ x:cxP + (i - (luces.length-1)/2)*75, y:yL, diam:30, seccion:"S1", modelo:C.PUERTA.luz.modelo, desc:`Luz piloto LED 22 mm (${o.color}) — ${o.leyenda}` }, o)));
    const pw = Math.max(hm ? hm.w : 0, luces.length*75) + 60, y0 = (luces.length ? yL - 45 : yH - hH/2) - 20, y1 = (hm ? yH + hH/2 : yL + 50) + 20;
    panel = { x:cxP - pw/2, y:y0, w:pw, h:y1 - y0, seccion:"S1", zona:true, titulo: hm ? `PANEL DE OPERADOR - RECORTE DE ${hmiEq.tag}` : "PANEL DE OPERACIÓN" };
    if(luces.length) obst.push([panel.x, panel.y, panel.w, panel.h]);
  }

  // ===== balance térmico (IEC 60890) y ventilación =====
  const nHesi = bloquesB.reduce((a, b)=>a + b.bornes.filter(x=>/HESI/.test(x.modelo)).length, 0);
  const perd = (comps.reduce((a, c)=>a + (c.perdidas||0)*(c.cant||1), 0) + (hm ? hm.perdidas*0.5 : 0) + nHesi*0.2)*1.05;   // + fusibles y cableado
  const A = C.superficieEfectiva(W, H, D, montaje), k = 5.5;
  const tiMax = +cfg.tInterior || 45;
  const dT = tiMax - tAmb, fAlt = 3.1/Math.exp(-alt/8400);
  const term = { perdidas:Math.round(perd), superficie:+A.toFixed(2), tAmb, tiMax, k, altitud:alt, fAlt:+fAlt.toFixed(2), notaPerdidas:"equipos con su consumo típico, pantalla HMI, fusibles y cableado" };
  let vent = null;
  const vEq = ext.ventiladores;
  if(dT <= 2){
    term.modo = "aire acondicionado"; term.potenciaFrio = Math.round(perd + k*A*Math.max(0, tAmb - tiMax));
    vent = { tipo:"aa", modelo:`Unidad de aire acondicionado de puerta ${Math.ceil(term.potenciaFrio/500)*500} W`, w:400, h:Math.min(950, H - 200) };
    criterios.push(`Temperatura de diseño ${tAmb} °C ≥ ${tiMax} °C admisibles: se requiere aire acondicionado de ${Math.ceil(term.potenciaFrio/500)*500} W.`);
  } else {
    term.disipacion = Math.round(k*A*dT);
    const necesita = perd > term.disipacion;
    term.caudal = Math.max(20, Math.ceil(fAlt*Math.max(perd - term.disipacion, perd*0.25)/dT));
    if(cfg.ventilacion==="natural" || (!vEq && !necesita && cfg.ventilacion!=="forzada")){
      term.modo = necesita ? "natural (indicado por el usuario)" : "natural";
      if(necesita) avisos.push("Ventilación natural por indicación del usuario aunque el balance térmico pide ventilación forzada.");
      if(vEq) avisos.push(`El unifilar de control tiene el circuito de ventilación ${vEq.cb} (${vEq.tags.join(", ")} y ${ext.termostato ? ext.termostato.tag : "termostato"}): retíralo o déjalo como reserva.`);
      criterios.push(`Pérdidas ${term.perdidas} W ${necesita ? ">" : "≤"} disipación natural ${term.disipacion} W (ΔT ${dT} K): ventilación natural.`);
    } else {
      const vf = C.ventilador(term.caudal);
      term.modo = necesita || cfg.ventilacion==="forzada" ? "forzada" : "natural con ventiladores de respaldo"; term.ventiladores = 2;
      vent = { tipo:"ventilador", n:2, ...vf, tags: vEq ? vEq.tags : ["V1","V2"] };
      if(!vEq) avisos.push("El balance térmico pide ventilación forzada: agrega el circuito de ventilación (ventiladores V1, V2 y termostato) en el unifilar de control.");
      if(term.caudal > vf.caudal) avisos.push(`El caudal requerido (${term.caudal} m³/h) supera el de un ventilador con filtro (${vf.caudal} m³/h): usa un gabinete más grande o aire acondicionado.`);
      criterios.push(necesita ? `Pérdidas ${term.perdidas} W > disipación natural ${term.disipacion} W (ΔT ${dT} K): ventilación forzada de ${term.caudal} m³/h a ${alt} m s.n.m. (factor ${term.fAlt}), ventilador ${vent.tags[0]} de entrada abajo y ${vent.tags[1]} de extracción arriba (${vf.modelo.toLowerCase()}), mandados por el termostato ${ext.termostato ? ext.termostato.tag : "TH1"}.`
        : `Pérdidas ${term.perdidas} W ≤ disipación natural ${term.disipacion} W (ΔT ${dT} K): los ventiladores ${vent.tags.join(" y ")} (${vf.marco}x${vf.marco} mm, ${vf.caudal} m³/h) con el termostato ${ext.termostato ? ext.termostato.tag : "TH1"} a 35 °C actúan como respaldo en los días calurosos.`);
    }
  }
  if(vent && vent.tipo==="ventilador"){
    // criterio: el ventilador va CENTRADO en su hoja de puerta (nunca pegado a un lado); si el centro está ocupado a
    // esa altura se busca otra altura en el mismo eje, y luego el centro de la otra hoja
    const xs = puertas===2 ? [W*0.75, W*0.25] : [W/2];
    const ubicarV = (yCands, tag) => { for(const xx of xs) for(const yy of yCands) if(libre(xx, yy, vent.marco + 20, vent.marco + 20)) return [xx, yy];
      avisos.push(`No hay un lugar libre en el centro de la puerta para el ventilador ${tag}: revisa su ubicación con el fabricante (o móntalo en un lateral).`); return [xs[0], yCands[0]]; };
    const yAb = montaje==="mural" ? [vent.marco/2 + 70, vent.marco/2 + 120, vent.marco/2 + 220, vent.marco/2 + 320] : [250, 330, 450, 550];
    const yAr = montaje==="mural" ? [H - 70 - vent.marco/2, H - 120 - vent.marco/2, H - 230 - vent.marco/2, H - 330 - vent.marco/2] : [H - 230, H - 320, H - 420, H - 520];
    const [x1, y1] = ubicarV(yAb, vent.tags[0]); obst.push([x1 - vent.marco/2 - 10, y1 - vent.marco/2 - 10, vent.marco + 20, vent.marco + 20]);
    const [x2, y2] = ubicarV(yAr, vent.tags[1]);
    puerta.push({ tag:vent.tags[0], tipo:"ventilador", desc:"Ventilador con filtro (entrada de aire, abajo)", modelo:vent.modelo, x:x1, y:y1, w:vent.marco, h:vent.marco, recorte:vent.recorte, seccion:"S1", rol:"entrada" });
    puerta.push({ tag:vent.tags[1], tipo:"ventilador", desc:"Ventilador con filtro (extracción de aire, arriba)", modelo:vent.modelo, x:x2, y:y2, w:vent.marco, h:vent.marco, recorte:vent.recorte, seccion:"S1", rol:"salida" });
  } else if(vent) puerta.push({ tag:"AA1", tipo:"aa", desc:"Aire acondicionado de puerta", modelo:vent.modelo, x:W/2, y:H/2, w:vent.w, h:vent.h, seccion:"S1" });

  // ===== base / placa pasacables: un prensaestopa por cable =====
  const cabs = [];
  const bx = tag => { const b = bloquesB.find(x=>x.grupo===tag); return b ? (b.x0 + b.x1)/2 : W/2; };
  const dCtrl = n => n <= 3 ? 11 : n <= 4 ? 12 : n <= 7 ? 14 : n <= 12 ? 16.5 : 19;
  const corto = s => String(s||"").replace(/AWG/g, "").replace(/\+(\d+)\(T\)/, "+T");
  for(const a of eq.acometidas) cabs.push({ ref:a.tb, desc:`Acometida ${a.tension} desde ${a.desde}${a.circuito ? " ("+a.circuito+")" : ""}`, awg:corto(a.cable), diamFijo:12, x:bx(a.tb) });
  for(const c of eq.circuitos.filter(c=>c.barra!=="24 Vdc" && !c.reserva && !/entradas digitales|salidas digitales|ventilaci|luminaria|tomacorriente/i.test(c.descripcion||""))){
    const tb = String(c.borne||"").split(".")[0]; cabs.push({ ref:tb, desc:`${c.tag}: ${c.descripcion}`, awg:corto(c.cable), diamFijo:dCtrl(3), x:bx(tb) });
  }
  for(const m of eq.plc.modulos){
    const ana = m.tipo==="AI" || m.tipo==="AO", porTag = new Map();
    for(const s of m.senales){ if(s.origen==="reserva" || !s.tag || s.tag==="-") continue; porTag.set(s.tag, (porTag.get(s.tag)||0) + 1); }
    for(const [tag, nS] of porTag) cabs.push({ ref:m.tb, desc:`${tag}: ${nS} señal(es) ${m.tipo} de ${m.tag}`, awg: ana ? `${nS}P#16 (pant.)` : `${Math.max(2, 2*nS)}C#14`, diamFijo: ana ? (nS > 1 ? 11 : 8.5) : dCtrl(2*nS), x:bx(m.tb) });
  }
  if(eq.red.some(r=>r.tipo==="switch")) cabs.push({ ref:"RED", desc:`Cable Ethernet Cat 6 F/UTP hacia ${t.redExterna || "la red de control"}`, awg:"Cat 6", diamFijo:7, x:(comps.find(c=>c.tipo==="switch")||{ x:W*0.7 }).x });
  if(eq.red.some(r=>r.tipo==="router")) cabs.push({ ref:"ANTENA", desc:"Cables de antena 4G / GNSS del router (antena exterior)", awg:"RG-58", diamFijo:6, x:(comps.find(c=>c.tipo==="router")||{ x:W*0.8 }).x });
  const lista = cabs.map(c=>Object.assign(c, C.prensaestopa(c.diamFijo), { diam:c.diamFijo, seccion:"S1" })).sort((a, b)=>a.x - b.x);
  const nFilas = Math.max(2, Math.floor((D - 140)/40) + 1);
  const ult = Array(nFilas).fill(60);
  for(const c of lista){
    const r = c.agujero/2 + 14;
    let f = 0; for(; f<nFilas; f++){ const x = Math.max(c.x, ult[f] + r); if(x <= W - 60 - r) { c.x = x; break; } }
    if(f===nFilas){ f = ult.indexOf(Math.min(...ult)); c.x = Math.min(ult[f] + r, W - 60 - r); }
    c.fila = f; c.zb = D - 80 - f*40; ult[f] = c.x + r;
  }
  // reservas: dos M20 y una M25
  for(const rr of [20, 20, 25]){ const g2 = C.prensaestopa(rr - 7), r = g2.agujero/2 + 14; const f = ult.findIndex(u=>u + 2*r < W - 60); if(f >= 0){ const x = ult[f] + r; lista.push({ ref:"RESERVA", desc:"Reserva", awg:"", x, fila:f, zb:D - 80 - f*40, seccion:"S1", ...g2, diam:0 }); ult[f] = x + r; } }
  base.push(...lista);

  // ===== criterios de diseño aplicados =====
  const fu = eq.fuente, modsDO = eq.plc.modulos.filter(m=>m.tipo==="DO"), rel = comps.filter(c=>c.tipo==="rele");
  const tag = x => x ? x.tag : "";
  const rackC = comps.filter(c=>["cpu","modulo","fpd","tapa"].includes(c.tipo)).sort((a, b)=>a.x - b.x);
  criterios.unshift(
    `Gabinete ${montaje==="mural" ? "mural" : "autosoportado"} ${W}x${H}x${D} mm (ancho x alto x fondo)${zocalo ? ` con zócalo de ${zocalo} mm` : ""}, ${ipRecomendado(v)}, ${puertas} puerta(s); placa de montaje de ${Math.round(pc.w)}x${Math.round(pc.h)} mm.`,
    `Distribución arriba, en el orden del unifilar: ${eq.acometidas.map(a=>`${a.q.tag} (${a.tension})`).join(" y ")}, supresor ${eq.spd.tags.join("/")} con ${eq.spd.cb.tag}${fu ? `, fuente ${fu.ps.tag} ${fu.ps.modelo} entre ${fu.cb.tag} y ${fu.cbOut.tag} con los fusibles-borne XF1 (UT 4-HESI) a su lado` : ""}; derivaciones agrupadas por barra: ${eq.vEst}${eq.cb120 ? ` (${eq.cb120.tag})` : ""} y servicios del tablero.`,
    `PLC ${eq.familia.nombre} en un riel propio en el orden de sus slots: ${rackC.map(c=>c.tipo==="modulo" ? `${c.tag} (slot ${c.slot})` : c.tipo==="cpu" ? `${c.tag} ${c.modelo} (slot ${c.slot ?? 0})` : c.tag).join(", ")}${eq.plc.rack ? ` sobre el bastidor ${eq.plc.rack.tag} ${eq.plc.rack.modelo}` : ""}; ${GAP_PLC} mm libres arriba y abajo para la ventilación del rack${eq.red.filter(r=>r.tipo!=="hmi").length ? ` y ${eq.red.filter(r=>r.tipo!=="hmi").map(r=>r.tag).join(" / ")} a su derecha` : ""}.`,
  );
  if(rel.length) criterios.push(`Relés de interfaz ${rango(rel.map(c=>c.tag))} (${rel[0].modelo.replace(/\s*\(.*$/, "")}, 6,2 mm) en una fila debajo del PLC, alineados con ${modsDO.map(m=>m.tag).join(", ")} (un relé por canal, reservas incluidas).`);
  criterios.push(`Borneras al pie agrupadas por función en el orden del multifilar: ${bloquesB.filter(b=>b.grupo!=="XF1").map(b=>b.grupo).join(", ")}; señales discretas en bornes de dos pisos PTTB 4, analógicas en UT 4 con borne de pantalla; barra de tierra Cu ${pe.nombre} mm junto a la entrada ${entrada} de cables.`);
  criterios.push(`Canaletas ranuradas ${ductH.nombre} entre filas y ${ductV.nombre} verticales (llenado ≤ 40 %), la izquierda para 120 / 220 Vac y la derecha para señales de 24 Vdc y 4-20 mA; ${DUCT_GAP} mm libres entre equipos y canaleta; reserva de espacio ${Math.round(reserva*100)} % por fila.`);
  if(libreMm >= 80) criterios.push(`Quedan ${libreMm} mm libres al pie de la placa (además de la reserva por fila) para ampliaciones: borneras, relés o módulos futuros.`);
  if(hm) criterios.push(`Pantalla ${hmiEq.tag} (${hmiEq.modelo}) en la puerta: recorte ${hm.recorteW} x ${hm.recorteH} mm, centro a ${Math.round(puerta.find(d=>d.tipo==="hmi").y + zocalo)} mm de la base del gabinete${montaje==="mural" ? " (montar el gabinete con la pantalla a ~1,5 m del piso)" : " (≈1,5 m del piso)"}; ${hm.prof} mm hacia el interior, libres del equipo de la placa.`);
  const srv = [];
  if(ext.luminaria) srv.push(`luminaria ${ext.luminaria.lm} en el techo con el interruptor de puerta ${ext.luminaria.sq}`);
  const toma = comps.find(c=>c.tipo==="tomacorriente"), dif = comps.find(c=>c.tipo==="diferencial"); if(toma) srv.push(`tomacorriente ${toma.tag} en riel DIN junto a su diferencial ${tag(dif)}`);
  if(ext.termostato) srv.push(`termostato ${ext.termostato.tag} en la fila superior (aire más caliente)`);
  if(srv.length) criterios.push(`Servicios del tablero: ${srv.join("; ")}.`);
  if(eq.limpieza) criterios.push(`El controlador de limpieza ${eq.limpieza.tag} va en su propio gabinete junto al colector: este tablero lo alimenta (${(eq.circuitos.find(c=>/limpieza/i.test(c.descripcion||""))||{}).tag || "120 Vac"}) y recibe sus señales en las borneras del PLC.`);
  if(calef) criterios.push("Resistencia calefactora anticondensación R1 con termostato TH2 abajo, donde el aire es más frío (temperatura mínima baja o instalación exterior).");
  const hechos = ajustes.filter(a=>a.ok);
  if(hechos.length) criterios.push(`Ajustes pedidos por el usuario: ${hechos.map(a=>a.texto).join("; ")}.`);
  for(const a of ajustes.filter(a=>!a.ok)) avisos.push(`No se aplicó «${a.texto}»: ${a.nota}.`);

  // ===== comprobación: ningún equipo se superpone con otro en el espacio =====
  const cajas = comps.map(c=>({ tag:c.tag, x0:c.x, x1:c.x + c.w, y0:c.y, y1:c.y + c.h, z0:c.z0 ?? ZPLACA, z1:(c.z0 ?? ZPLACA) + (c.d||0) }));
  for(let i=0;i<cajas.length;i++) for(let j=i+1;j<cajas.length;j++){ const a = cajas[i], b = cajas[j];
    if(a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.y0 < b.y1 - 0.5 && b.y0 < a.y1 - 0.5 && a.z0 < b.z1 && b.z0 < a.z1) avisos.push(`${a.tag} y ${b.tag} se superponen en el arreglo.`); }

  const bom = listaMateriales(comps, bloquesB, canaletas, rieles, barras, puerta, base, pe, secciones.reduce((a, s)=>a + (s.puertas||1), 0));
  const vTxt = [...new Set([eq.vEst, ...eq.acometidas.map(a=>a.tension)])].join(" / ");
  return { tablero:t, tipo:"control", eq, cfg, montaje, W, H, D, zocalo, techo:/intemperie/i.test(v.ambiente||""), ip:ipRecomendado(v), entrada, zonaAcom:null, ajustes,
    secciones, placas, comps, canaletas, rieles, barras, aisladores:[], conexiones, bornes:bloquesB, puerta, panel, base, ventilacion:vent, termico:term,
    fase:null, pe, filas:filaInfo, criterios, avisos, bom, tension:vTxt, frecuencia:v.frecuencia, reserva, manijaY, placaX, senalX,
    placaTxt:`${vTxt}, 24 Vdc, ${v.frecuencia} Hz`, peligroTxt:`PELIGRO ${vTxt.replace(/ Vac/g, "")} Vac`, notas: notasControl(t, eq, montaje, entrada, ipRecomendado(v), hm, hmiEq) };
}

function notasControl(t, eq, montaje, entrada, ip, hm, hmiEq){
  return [
    `EL PRESENTE PLANO SOLO ES VÁLIDO PARA EL ${(t.nombre||"TABLERO DE CONTROL").toUpperCase()} ${t.tag}.`,
    "LAS DIMENSIONES SE MUESTRAN EN MILÍMETROS.",
    "LAS CARACTERÍSTICAS, CANTIDADES Y TAGS DE LOS COMPONENTES SE ENCUENTRAN EN EL DIAGRAMA UNIFILAR Y EN EL MULTIFILAR (CONEXIONADO DE E/S) DEL TABLERO; LA DISTRIBUCIÓN INTERNA EN LA LÁMINA 2.",
    hm ? `LA PANTALLA ${hmiEq.tag} SE MONTA EN LA PUERTA CON SU JUNTA Y GRAMPAS DEL FABRICANTE; RECORTE ${hm.recorteW} x ${hm.recorteH} mm (LÁMINA 3), CONSERVANDO EL GRADO DE PROTECCIÓN DEL GABINETE.` : "LOS DISPOSITIVOS DE PUERTA CONSERVAN EL GRADO DE PROTECCIÓN DEL GABINETE.",
    "LA SEÑALÉTICA DE RIESGO ELÉCTRICO Y EL NIVEL DE TENSIÓN SERÁN FOTOLUMINISCENTES.",
    `GABINETE ${montaje==="mural" ? "MURAL" : "AUTOSOPORTADO"} DE PLANCHA DE ACERO, ${ip.toUpperCase()}, PINTURA EPÓXICA RAL 7035; PLACA DE MONTAJE GALVANIZADA.`,
    `ENTRADA DE CABLES ${entrada.toUpperCase()} POR PLACA PASACABLES CON PRENSAESTOPAS (LÁMINA 3); CABLES DE SEÑAL ANALÓGICA APANTALLADOS, CON LA PANTALLA ATERRADA SOLO EN EL TABLERO.`,
    "LA BARRA DE TIERRA SE CONECTARÁ A LA MALLA DE PUESTA A TIERRA; PUERTA Y PLACA CON CINTA DE COBRE TRENZADO DE EQUIPOTENCIALIDAD.",
    `EL PLC ${eq.familia.nombre.toUpperCase()} SE MONTA CON SU CPU EN EL SLOT 0 Y LOS MÓDULOS EN EL ORDEN DEL LISTADO I/O, RESPETANDO LOS ESPACIOS LIBRES DEL FABRICANTE.`,
    "LAS DIMENSIONES DE LOS COMPONENTES SON REFERENCIALES (CATÁLOGO DEL FABRICANTE); EL FABRICANTE DEL TABLERO VERIFICARÁ CON LOS EQUIPOS SUMINISTRADOS.",
  ];
}

/* ---------- lista de materiales con dimensiones y fuente (los repetidos de un mismo modelo y función, en una fila) ---------- */
function listaMateriales(comps, bornes, canaletas, rieles, barras, puerta, cabs, pe, nHojas = 1){
  const filas = [], MONT = { din:"Riel DIN", placa:"Placa", base:"Base", techo:"Techo", marco:"Marco" };
  const dim = c => c.w ? `${Math.round(c.w*10)/10} x ${Math.round(c.h)} x ${Math.round(c.d||0)}` : "";
  const grupos = new Map();
  for(const c of comps){ const k = c.grupoBom ? `${c.grupoBom}|${c.modelo}|${c.descBom||""}` : c.id; if(!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(c); }
  for(const cs of grupos.values()){ const c = cs[0];
    filas.push({ tag:rango(cs.map(x=>x.tag)), desc: cs.length > 1 ? (c.descBom || c.desc) : c.desc, modelo:c.modelo, cant:cs.length, dim:dim(c), montaje:MONT[c.montaje] || "Placa", fuente:c.fuente||"" }); }
  for(const b of bornes){
    const por = {}; for(const x of b.bornes){ por[x.modelo] = (por[x.modelo]||0) + 1; }
    for(const [m, n] of Object.entries(por)){ const d = C.borneControl(m); filas.push({ tag:b.grupo, desc:`${/HESI/.test(m) ? "Fusible-borne 5x20 con LED" : `Borne ${/PE$/.test(m) ? "de tierra" : /PTTB/.test(m) ? "de dos pisos" : "de paso"}`} — ${b.desc}`, modelo:m, cant:n, dim:`${d.w} x ${d.h} x ${d.d}`, montaje:"Riel DIN", fuente:d.fuente }); }
    filas.push({ tag:b.grupo, desc:"Tapa final, topes y marcador de grupo", modelo:"D-UT + E/UK + marcador", cant:1, dim:"", montaje:"Riel DIN", fuente:C.FUENTES.borne });
  }
  const largo = arr => arr.reduce((a, x)=>a + (x.orient==="v" ? x.h : x.w), 0);
  for(const nm of [...new Set(canaletas.map(c=>c.nombre))]) filas.push({ tag:"", desc:"Canaleta ranurada PVC con tapa", modelo:`Canaleta ${nm}`, cant:`${(largo(canaletas.filter(c=>c.nombre===nm))/1000).toFixed(1)} m`, dim:nm, montaje:"Placa", fuente:C.FUENTES.canaleta });
  for(const md of [...new Set(rieles.map(r=>r.modelo || C.RIEL.modelo))]) filas.push({ tag:"", desc: /S7-1500/.test(md) ? "Perfil soporte del PLC" : "Riel DIN perforado", modelo:md, cant:`${(rieles.filter(r=>(r.modelo || C.RIEL.modelo)===md).reduce((a, r)=>a + r.w, 0)/1000).toFixed(1)} m`, dim: /S7-1500/.test(md) ? "" : "35 x 7,5", montaje:"Placa", fuente: /S7-1500/.test(md) ? C.FUENTES.s71500 : "IEC 60715" });
  const bp = barras.filter(b=>b.fase==="PE");
  if(bp.length) filas.push({ tag:"PE", desc:"Barra de tierra de protección, perforada", modelo:`Barra Cu ${pe.nombre} mm`, cant:`${(bp.reduce((a, b)=>a + b.w, 0)/1000).toFixed(2)} m`, dim:`${pe.nombre} mm`, montaje:"Placa", fuente:C.FUENTES.barra });
  for(const d of puerta){
    const m = d.modelo || (C.PUERTA[d.tipo]||{}).modelo || d.desc;
    filas.push({ tag:d.tag||"", desc:d.desc || d.leyenda || "", modelo:m, cant:1, dim: calado(d), montaje:"Puerta", fuente: d.fuente || C.FUENTES.puerta });
  }
  filas.push({ tag:"", desc:"Señal de riesgo eléctrico «PELIGRO» (una en cada puerta)", modelo:"Señal autoadhesiva ISO 7010 W012, 110 mm", cant:nHojas, dim:"110 mm", montaje:"Puerta", fuente:"ISO 7010 / NTP 399.010" });
  const gl = {}; for(const c of cabs){ if(!c.rosca) continue; gl[c.rosca] = (gl[c.rosca]||0) + 1; }
  for(const [r, n] of Object.entries(gl)) filas.push({ tag:"", desc:"Prensaestopa de poliamida / latón niquelado con contratuerca", modelo:`Prensaestopa ${r}`, cant:n, dim:r, montaje:"Base", fuente:"EN 62444" });
  return filas;
}

/* todos los tableros de control (los de fuerza y control siguen con el motor de fuerza) con su arreglo */
export function arreglosControl(p){ return tablerosControl(p).filter(t=>t.tipo==="control").map(t=>arregloControl(p, t)); }

/* medida y calado (recorte en la puerta) de un dispositivo de puerta, para la lista de materiales */
function calado(d){
  if(d.tipo==="hmi") return `Recorte ${d.recorteW} x ${d.recorteH}`;
  if(d.tipo==="ventilador" || d.tipo==="rejilla") return `${d.w} x ${d.h}${d.recorte ? `, calado ${d.recorte} x ${d.recorte}` : ""}`;
  if(d.w) return `${d.w} x ${d.h}`;
  if(d.diam) return `Ø${d.anillo||d.diam}, calado Ø22,5`;
  return "";
}

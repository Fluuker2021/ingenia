/* Ingenia — definición de cada entregable generable: qué datos usa, qué plantilla por defecto aplica,
   cómo se previsualiza y cómo se arma el archivo final (Excel / Word / DXF). */
import { entregable, DISCIPLINAS } from "./catalog.js";
import * as S from "./store.js";
import { esc } from "./ui.js";
import { valoresDiseno, seccionesCriteriosElectricos, seccionesCriteriosIC, seccionesMemoriaDescriptiva } from "./modules/criterios.js";
import { procesarFilas, resumenIO, ESQUEMAS } from "./modules/tablas.js";
import { datos, calcularTablero, calcularTodos, equiposElectricos, circuitosControl, instrumentos, expandirTag, tipoInstrumento, esAnalogico, sistemaTag, sistemaNombre, r2, parametrosG,
  tableros, tablerosControl, tableroPorId, tf, tc, desdeTxt, esControl, esPotencia, TIPOS_TABLERO, ipRecomendado, cablesFuerza, CLASES_CABLE, CANALIZACIONES } from "./datos.js";
import { seccionesFilosofia, seccionesTipicos } from "./modules/filosofia.js";
import { tempCorrFactor, cableFor, miguelezCableFor } from "./engine/tablero-core.js";
import { rellenarExcel } from "./xlsx-engine.js";
import { GENERADORES, dxfBytes } from "./cad/planos.js";
import { valoresCajetin } from "./cad/formato.js";
import { parseDXF, toCompact, boundsOf } from "./dxf.js";
import { ENTREGABLES } from "./catalog.js";

const BASE = "assets/plantillas/";
let _manifest = null, _hd = null;
export async function manifiesto(){ if(!_manifest) _manifest = await (await fetch(BASE+"xlsx/manifest.json")).json(); return _manifest; }
export async function tiposHD(){ if(!_hd) _hd = await (await fetch(BASE+"xlsx/hd_tipos.json")).json(); return _hd; }

/* ---------------- metadatos del documento ---------------- */
export function docInfo(p, id){
  const e = entregable(id); const d = p.documentos[id] || {};
  if(!d.revisiones || !d.revisiones.length) d.revisiones = [{ rev: d.rev||"A", fecha: d.fecha||new Date().toISOString().slice(0,10), descripcion: d.emitido||"Emitido para revisión interna" }];
  const last = d.revisiones[d.revisiones.length-1];
  d.rev = last.rev; d.fecha = last.fecha; d.emitido = last.descripcion;
  const out = Object.assign({ titulo:(e.nombre||"").toUpperCase() }, d);
  // planos: si el usuario no definió referencias, se proponen desde los documentos relacionados del proyecto
  if(!Array.isArray(d.referencias) && REL_PLANOS[id]) out.referencias = referenciasSugeridas(p, id);
  return out;
}
const REL_PLANOS = { "ele-multifilar":["ele-unifilar","ele-cargas"], "ele-mecanico":["ele-unifilar","ele-multifilar"], "ele-arreglo":["ele-equipos","ele-unifilar"], "ins-pid":["ins-instrumentos"], "ins-multifilar-tc":["ins-io","ins-unifilar-tc"], "ins-mecanico-tc":["ins-unifilar-tc","ins-multifilar-tc"], "ins-arreglo":["ins-instrumentos","ins-pid"], "ins-lazo":["ins-io","ins-instrumentos","ins-multifilar-tc"], "ins-arquitectura":["ins-io","ins-instrumentos"], "ins-unifilar-tc":["ins-multifilar-tc","ins-instrumentos"], "ele-unifilar":["ele-cargas","ele-mc"], "ins-bloques":["ele-unifilar","ins-unifilar-tc"] };
export function referenciasSugeridas(p, id){
  const refs = (REL_PLANOS[id]||[]).filter(r=>p.documentos[r]).slice(0,5).map(r=>({ codigo:p.documentos[r].codigo, titulo:(p.documentos[r].titulo||entregable(r).nombre).toUpperCase() }));
  if(p.pidRef && refs.length<5) refs.unshift({ codigo:p.pidRef, titulo:"DIAGRAMA DE PROCESO E INSTRUMENTACIÓN" });
  return refs;
}
const DISC_TXT = { ELE:"ELECTRICIDAD", INS:"INSTRUMENTACIÓN Y CONTROL", GEN:"ELECTRICIDAD E INSTRUMENTACIÓN" };
const ETAPA_TXT = { conceptual:"INGENIERÍA CONCEPTUAL", basica:"INGENIERÍA BÁSICA", detalle:"INGENIERÍA DE DETALLE" };
function fmtFecha(f){ const m = String(f||"").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (f||""); }
export function tituloDoc(p, id){ const di = docInfo(p, id); const st = sistemaTag(p); const t = (di.titulo||"").toUpperCase(); return st && !t.includes(st) ? `${t} - TAG: ${st}` : t; }
export function codigoDe(p, id){ return (p.documentos[id]||{}).codigo || ""; }

export function escalares(p, id, org){
  const e = entregable(id), di = docInfo(p, id), v = valoresDiseno(p);
  const s = {
    cliente: p.cliente||"", proyecto: p.nombre||"", etapa: ETAPA_TXT[p.etapa]||"", disciplina: DISC_TXT[e.disciplina]||"", titulo: tituloDoc(p, id),
    codigo: di.codigo||"", rev: di.rev||"A", fecha: fmtFecha(di.fecha), unidad_etiqueta: p.unidad ? "UNIDAD" : "", unidad: (p.unidad||"").toUpperCase(),
    org: org.nombre||"", org_corto: (org.nombreCorto||org.nombre||"").toUpperCase(), referencia: p.pidRef||"", emitido: di.emitido||"",
    elaboro: di.elaboro||org.elaboraPor||"", reviso: di.reviso||org.revisaPor||"", aprobo: di.aprobo||org.apruebaPor||"",
    sistema: sistemaNombre(p), tag_sistema: sistemaTag(p), tension: v.tension, tension_control: `${v.tensionControl} VAC`,
    numero_proyecto: p.codigo||"", cliente_corto: (p.cliente||"").toUpperCase(), oc_texto: p.ordenCompra ? "N° OC: "+p.ordenCompra : "",
  };
  const corta = t => String(t||"").replace(/^Emitido para /i, "Para ");
  for(let i=0;i<8;i++){ const r = di.revisiones[i]; ["rev","fecha","descripcion","elaboro","reviso","aprobo"].forEach(k=>{ s[`rev${i+1}.${k}`] = r ? (k==="fecha" ? fmtFecha(r.fecha) : k==="descripcion" ? corta(r.descripcion) : (r[k] ?? (k==="elaboro"?s.elaboro:k==="reviso"?s.reviso:k==="aprobo"?s.aprobo:""))) : ""; }); }
  return s;
}

/* ================= tablas de datos por documento ================= */
// prefijo del TAG del sistema en listados (p. ej. «SISTEMA-PIT-001»)
export function prefijoTag(p){ const d = datos(p); const st = sistemaTag(p); return st && d.sistema.prefijo!==false ? st.replace(/-/g,"")+"-" : ""; }
const conPref = (pre, v) => (!pre || !v || v==="-" || String(v).startsWith(pre)) ? v : pre+v;
function notasDe(p, id, def){ const n = datos(p).notas[id]; const arr = (n && n.length) ? n : def; return arr.map((t,i)=>({ n:(i+1)+".-", texto:t })); }

export function tablasCargas(p, t){
  const calc = calcularTablero(p, t), g = calc.g;
  const cargas = calc.circuits.map(c=>{
    const l = c.load;
    if(c.kind==="motor") return { tag:l.tag||("M"+c.tag), descripcion:(l.desc||c.descLabel||""), hp: l.powerUnit==="hp" ? +l.power : "-", kw: r2(c.powerKWelec,3), fp:+c.fp, eff: r2(c.effPct/100,3), fu:c.fu, fs:c.fs, kv: g.voltage/1000, fases:3, _in: r2(c.installedCurrent,2), _si: r2(c.installedKVA,2), _md: r2(c.installedKVA*c.fu*c.fs,2) };
    if(c.kind==="control") return { tag:l.tag||"-", descripcion:l.desc||"Circuito de control", hp:"-", kw: r2(c.installedKVA*0.88,3), fp:0.88, eff:1, fu:c.fu, fs:c.fs, kv: g.voltage/1000, fases:1, _in: r2(c.installedKVA*1000/g.voltage,2), _si: r2(c.installedKVA,3), _md: r2(c.installedKVA*c.fu*c.fs,3) };
    if(c.esGeneral) return { tag:l.tag||"-", descripcion:l.desc||"Carga general", hp:"-", kw: r2(c.powerKWelec,3), fp:c.fp, eff:1, fu:c.fu, fs:c.fs, kv: g.voltage/1000, fases:c.fases, _in: r2(c.installedCurrent,2), _si: r2(c.installedKVA,3), _md: r2(c.installedKVA*c.fu*c.fs,3) };
    return { tag:l.tag||"-", descripcion:l.desc||"Alimentador", hp:"-", kw: r2(c.installedKVA*0.85,2), fp:0.85, eff:1, fu:c.fu, fs:c.fs, kv:g.voltage/1000, fases:3, _in: r2(c.installedCurrent,2), _si: r2(c.installedKVA,2), _md: r2(c.installedKVA*c.fu*c.fs,2) };
  });
  // cargas estabilizadas de 120 VAC: tableros de control alimentados desde este tablero (o el principal si es el primero)
  const ctl = tablerosControl(p).filter(x=> x.tipo==="fuerzacontrol" ? x.id===calc.tablero.id : (x.desde ? x.desde===calc.tablero.id : calc.tablero.id===tf(p).id));
  // lista de cargas estabilizadas (120 VAC) agrupada como en el formato de referencia: fuente 24 VDC, entradas
  // digitales, salidas digitales e instrumentos (FDP típicos 0,90 / 0,95 / 0,95 / 0,87)
  const grupos = new Map();
  for(const c of ctl.flatMap(x=>circuitosControl(p, x)).filter(c=>c.barra==="120 VAC" && +c.potencia>0)){
    const k = /fuente/i.test(c.descripcion) ? ["Fuente de 24 VDC",0.9] : /entradas digitales/i.test(c.descripcion) ? ["Entradas digitales",0.95] : /salidas digitales/i.test(c.descripcion) ? ["Salidas digitales",0.95] : /controlador de limpieza/i.test(c.descripcion) ? ["Controlador de limpieza",0.9] : ["Instrumentos",0.87];
    const gk = grupos.get(k[0]) || { descripcion:k[0], fp:k[1], w:0 }; gk.w += +c.potencia||0; grupos.set(k[0], gk);
  }
  const cc = [...grupos.values()].map((x,i)=>({ n:i+1, descripcion:x.descripcion, fp:x.fp, fu:1, fs:1, kw: r2(x.w/1000,3) }));
  return { calc, cargas, cargas_control: cc };
}

export function tablasIO(p){
  const filas = procesarFilas("ins-io", datos(p)["ins-io"]||[], p).map(f=>Object.assign({}, f, { rango: (f.rangoMin!=null && f.rangoMin!=="" ? f.rangoMin+" - "+(f.rangoMax??"")+" "+(f.unidad||"") : "-").trim(), lazo: f.lazo || (f.origen==="instrumento" ? codigoDe(p,"ins-lazo") : f.origen==="reserva" ? "-" : ""), pid: f.pid || (f.origen==="reserva" ? "-" : (p.pidRef || codigoDe(p,"ins-pid") || "")) }));
  const res = resumenIO(filas, +valoresDiseno(p).reservaIO||0, p);
  return { io: filas, resumen: res };
}

/* hoja de datos: campos por instrumento (estructura y valores de referencia del formato del usuario) */
export async function camposHD(p, inst){
  const tipos = await tiposHD(), v = valoresDiseno(p), st = sistemaTag(p);
  const t = tipoInstrumento(inst.tag);
  const base = tipos[t] || generico(tipos.PIT);
  const usr = (datos(p).hd[inst.tag]) || {};
  const auto = {
    "equipo": inst.descripcion, "servicio del equipo": inst.servicio, "ubicación del equipo": inst.ubicacion,
    "ubicación del proyecto": v.ubicacion, "altitud": v.altitud, "temperatura de ambiente": (v.tempMin!==""&&v.tempMax!=="") ? `${v.tempMin} a ${v.tempMax}` : "",
    "tag": (st ? st.replace(/-/g,"")+"-" : "")+inst.tag, "marca": inst.marca, "modelo": inst.modelo, "alimentación eléctrica": inst.alimentacion,
    "rango calibrado": inst.rango, "unidades": inst.unidad,
  };
  auto["ambiente"] = [v.ambiente, v.contaminacion && v.contaminacion!=="Normal" ? v.contaminacion.toLowerCase() : ""].filter(Boolean).join(", ");
  auto["humedad promedio"] = v.humedad; auto["humedad relativa"] = v.humedad;
  auto["zona sísmica (nte e.030)"] = v.sismo; auto["zona sísmica"] = v.sismo;
  auto["tag"] = prefijoTag(p)+inst.tag;
  // condiciones del sitio y del proceso, marca, modelo y código son propios de cada proyecto: nunca se
  // arrastran desde la hoja de referencia (quedan vacíos hasta que el usuario los complete)
  const SIN_REF = new Set(["CONDICIONES DEL SITIO","CONDICIONES DEL PROCESO"]);
  const SIN_REF_CAMPO = new Set(["marca","modelo","código","codigo"]);
  let n = 0, sec = "";
  const filas = base.filas.map(f=>{
    if(f.seccion){ sec = f.seccion; return { __var:"seccion", texto:f.seccion }; }
    n++;
    const k = f.desc.toLowerCase();
    const a = auto[k];
    const refOk = !SIN_REF.has(sec) && !SIN_REF_CAMPO.has(k);
    const valor = usr[f.desc]!=null && usr[f.desc]!=="" ? usr[f.desc] : (a!=null && a!=="" ? a : (refOk ? f.ref : ""));
    const origen = usr[f.desc]!=null && usr[f.desc]!=="" ? "usuario" : (a!=null && a!=="" ? "proyecto" : (refOk && f.ref ? "referencia" : ""));
    return { n, desc:f.desc, unidad:f.unidad, valor, nota:f.nota||"", ref:f.ref, origen };
  });
  return { titulo: base.titulo, referencia: base.referencia, filas, tipo: t, conocido: !!tipos[t] };
}
function generico(pit){
  const keep = new Set(["IDENTIFICACIÓN DE UNIDAD","CONDICIONES DEL SITIO","DATOS DE OPERACIÓN","CARACTERÍSTICAS GENERALES","ALIMENTACIÓN Y COMUNICACIÓN","HOMOLOGACIONES Y NORMAS"]);
  const sitio = new Set(["CONDICIONES DEL SITIO","DATOS DE OPERACIÓN"]);
  const filas = []; let sec = null;
  for(const f of pit.filas){ if(f.seccion){ sec = f.seccion; if(keep.has(sec)) filas.push(f); continue; } if(keep.has(sec)) filas.push(Object.assign({}, f, { ref: sitio.has(sec) ? f.ref : "" })); }
  return { titulo:"HOJA DE DATOS DE INSTRUMENTO", referencia:"genérica", filas };
}

/* memorias de cálculo (conductores y máxima demanda): datos para las plantillas Word, todos los tableros */
export function datosMemoria(p){
  const d = datos(p), v = valoresDiseno(p), mem = d.memoria;
  const calcs = calcularTodos(p);
  const g = calcs[0] ? calcs[0].g : parametrosG(p);
  const kt = tempCorrFactor(g.ambientTemp), kg = +mem.kGroup||1, kh = +mem.kh||1;
  const cab = new Map(cablesFuerza(p).map(c=>[c._c, c]));
  const clase = CLASES_CABLE[d.cablesCfg.clase] || CLASES_CABLE.lszh;
  const tablerosM = [], cables = [], prot = [], anexoC = [], anexoP = [], anexoMD = [];
  for(const calc of calcs){
    const tb = calc.tablero;
    const cargas = calc.circuits.map(c=>({ descripcion: (c.load.desc||c.descLabel||c.title), tag: c.load.tag||c.tag, carga_kw: c.kind==="motor" ? r2(c.powerKWelec,2) : r2(c.installedKVA*(c.kind==="control"?0.88:0.85),2), fp: c.kind==="motor" ? c.fp : (c.kind==="control"?0.88:0.85), eff: c.kind==="motor" ? r2(c.effPct/100,3) : 1, si_kva: r2(c.installedKVA,2), fu: c.fu, dmi_kva: r2(c.installedKVA*c.fu,2), fs:c.fs }));
    tablerosM.push({ nombre:(tb.nombre||"tablero").toLowerCase(), tag: tb.tag, cargas, s_global: r2(calc.installedKVA,2), factores: cargas.map(c=>({ nombre:c.descripcion, fs:c.fs })), tension: g.voltage, fases:"Trifásico", i_md: r2(calc.demandCurrent,2), dm_global: r2(calc.totalKVA,2) });
    calc.circuits.forEach(c=>{
      const m = c.conductorMemo; const main = c.items[0] || {};
      const cf = cab.get(c);
      const hasta = cf ? cf.hasta : (c.load.tag||c.tag);
      if(m && m.cable){
        const iadm = m.iadm ?? m.cable[2], ktc = m.kt ?? kt, ic = iadm*ktc*kg;
        const egc = m.egc ? m.egc[1] : "";
        const row = { titulo:`Dimensionamiento de cable desde el ${(tb.nombre||"tablero").toLowerCase()} (${tb.tag}) a ${(c.load.desc||c.title||"").toLowerCase()} (${hasta})`,
          desde: tb.tag, hasta, tag_cable: cf ? cf.tag : (hasta||"").replace(/-/g,"")+"-P01", carga_kw: c.kind==="motor" ? r2(c.powerKWelec,2) : r2(c.installedKVA*0.85,2), v: g.voltage, l: m.cableLength, fp: r2(m.cosphi,3), eff: c.kind==="motor" ? r2(c.effPct/100,3) : 1, fases:"Trifásico",
          i: r2(m.baseCurrent,2), id: r2(m.designCurrent,2), tipo_cable:"Cu, 0,6/1 kV", config: "Tripolar + tierra", canalizacion: mem.canalizacion, ternas: 1,
          calibre: `${m.cable[0]} (${m.cable[1]} mm²)`, r: m.cable[3], iadm, kt: r2(ktc,2), kg: r2(kg,2), ktot: r2(ktc*kg,2), icorr: r2(ic,1), cumple_amp: ic>=m.designCurrent-1e-9 ? "CUMPLE" : "NO CUMPLE",
          dv_v: r2(m.vdVolts,2), dv_pct: r2(m.vdPct,2), vd_max: m.maxVD, cumple_vd: m.vdOk ? "CUMPLE" : "NO CUMPLE", modelo: cf ? cf.referencia+" — "+cf.clase : "", egc };
        cables.push(row);
        anexoC.push({ circuito:tb.tag+" "+c.tag, hasta, i:row.i, id:row.id, l:row.l, calibre:m.cable[0], iadm, ktot:row.ktot, icorr:row.icorr, dv_pct:row.dv_pct, egc, modelo: cf ? cf.referencia : "" });
      }
      const iprot = parseFloat(String(main.val||"").replace(/^.*?x/,"")) || parseFloat(main.val) || 0;
      const id = m ? m.designCurrent : (c.installedCurrent||0)*1.25;
      const ic = m && m.cable ? (m.iadm ?? m.cable[2])*(m.kt ?? kt)*kg : null;
      const tipo = /Guardamotor/i.test(main.comp) ? "Guardamotor" : /fusible/i.test(main.comp) ? "Fusible" : (iprot<=63 && /2P|System pro/i.test(main.model) ? "MCB" : "MCCB");
      prot.push({ titulo: `${tb.tag} — ${c.load.desc || c.title}`, i: r2(m ? m.baseCurrent : c.installedCurrent, 2), fases:"Trifásico", tipo, iprot, id: r2(id,2), kh, ireq: r2(id/kh,2), cumple_prot: iprot >= id/kh - 1e-9 ? "CUMPLE" : "VERIFICAR", ic: ic!=null ? r2(ic,1) : "—", iprot_kh: r2(iprot*kh,1), cumple_comp: ic==null ? "—" : (ic >= iprot*kh*0.8 ? "CUMPLE" : "VERIFICAR") });
      anexoP.push({ circuito:tb.tag+" "+c.tag, descripcion:c.load.desc||c.title, i: r2(m ? m.baseCurrent : c.installedCurrent,2), tipo, modelo: main.model, iprot: main.val, criterio: ((main.model||"").match(/\(([^)]*)\)/)||[])[1]||"" });
      anexoMD.push({ n:anexoMD.length+1, tag:(c.load.tag||c.tag)+" ("+tb.tag+")", descripcion:c.load.desc||c.title, kw: c.kind==="motor"? r2(c.powerKWelec,2) : "-", fp: c.kind==="motor"? c.fp : "-", eff: c.kind==="motor"? r2(c.effPct/100,3) : "-", si: r2(c.installedKVA,2), fu:c.fu, fs:c.fs, md: r2(c.installedKVA*c.fu*c.fs,2), in: r2(c.installedCurrent,2) });
    });
    prot.push({ titulo:`Interruptor general del ${(tb.nombre||"tablero").toLowerCase()} ${tb.tag}`, i: r2(calc.demandCurrent,2), fases:"Trifásico", tipo:"MCCB", iprot: calc.mainBreaker, id: r2(calc.requiredDemand,2), kh, ireq: r2(calc.demandCurrent/kh,2), cumple_prot: calc.mainBreaker >= calc.demandCurrent/kh - 1e-9 ? (calc.excede430 ? "VERIFICAR (supera el máximo NEC 430.62: "+Math.round(calc.requiredNEC)+" A)" : "CUMPLE") : "VERIFICAR", ic: calc.mainCond && calc.mainCond.cable ? r2(calc.mainCond.cable[2]*(calc.mainCond.sets||1)*kt*kg,1) : "Barra", iprot_kh: r2(calc.mainBreaker*kh,1), cumple_comp: "CUMPLE" });
  }
  // totales: tableros "raíz" (no alimentados desde otro tablero del proyecto) para no duplicar la demanda
  const raiz = calcs.filter(c=>!(c.tablero.desde && tableroPorId(p, c.tablero.desde)));
  const nombres = calcs.map(c=>`${(c.tablero.nombre||"").toLowerCase()} ${c.tablero.tag}`).join(", ");
  return {
    introduccion: mem.intro || p.descripcion || `El presente documento corresponde al proyecto ${p.nombre||""}${p.cliente?" para "+p.cliente:""}. Comprende la determinación de la máxima demanda, el dimensionamiento de conductores de baja tensión y la selección de protecciones de: ${nombres || "los tableros del proyecto"}.`,
    sistema: sistemaNombre(p), tension: g.voltage, frecuencia: g.freq, tension_control: g.ctrlVoltage, altitud: v.altitud, temp_diseno: v.tempDiseno, cable_referencia: `${clase.nombre} — ${clase.ref}`, canalizacion: mem.canalizacion,
    caida_ramal: v.caidaTension, caida_alim: v.caidaAlimentador, codigo_md: codigoDe(p, "ele-md") || "del proyecto",
    tableros:tablerosM, cables, protecciones: prot, anexo_md: anexoMD, anexo_cables: anexoC, anexo_prot: anexoP,
    pi_total: r2(raiz.reduce((a,c)=>a+c.installedKVA,0),2), md_total: r2(raiz.reduce((a,c)=>a+c.totalKVA,0),2), i_md_total: r2(raiz.reduce((a,c)=>a+c.demandCurrent,0),2),
    itm_general: raiz.map(c=>`${c.tablero.tag}: 3x${c.mainBreaker} A`).join(" · "),
  };
}

/* hoja de datos de un tablero: campos derivados del cálculo, condiciones ambientales y configuración */
export function camposHDEq(p, t){
  const d = datos(p), v = valoresDiseno(p), g = parametrosG(p);
  const usr = d.hdEq[t.id] || {};
  const filas = []; let n = 0;
  const sec = s => filas.push({ __var:"seccion", texto:s });
  const f = (desc, unidad, valor, origen="proyecto") => { n++; const u = usr[desc]; filas.push({ n, desc, unidad, valor: u!=null && u!=="" ? u : valor, origen: u!=null && u!=="" ? "usuario" : (valor!=="" && valor!=null ? origen : ""), nota:"" }); };
  sec("IDENTIFICACIÓN");
  f("Tag", "", t.tag); f("Descripción", "", t.nombre); f("Tipo de tablero", "", TIPOS_TABLERO[t.tipo].nombre); f("Sistema", "", [sistemaNombre(p), sistemaTag(p)].filter(Boolean).join(" ")); f("Alimentado desde", "", desdeTxt(p, t)); f("Cantidad", "und", 1);
  sec("CONDICIONES DEL SITIO");
  f("Ubicación del proyecto", "", v.ubicacion); f("Altitud", "m s.n.m.", v.altitud); f("Temperatura ambiente", "°C", `${v.tempMin} a ${v.tempMax}`); f("Temperatura de diseño", "°C", v.tempDiseno); f("Humedad relativa máxima", "%", v.humedad);
  f("Instalación", "", v.ambiente); f("Contaminación", "", v.contaminacion); f("Área clasificada", "", v.areaClasificada); f("Zona sísmica", "", v.sismo);
  const ip = ipRecomendado(v);
  if(esPotencia(t)){
    const c = calcularTablero(p, t);
    sec("CARACTERÍSTICAS ELÉCTRICAS");
    f("Tensión nominal", "V", g.voltage); f("Número de fases / hilos", "", "3F + T"); f("Frecuencia", "Hz", g.freq); f("Tensión de control", "VAC", g.ctrlVoltage);
    f("Nivel de cortocircuito (capacidad mínima de interrupción)", "kA", g.faultLevel); f("Sistema de puesta a tierra", "", v.puestaTierra);
    f("Interruptor general", "A", c.mainBreaker ? "3x"+c.mainBreaker : ""); f("Corriente nominal de barras (mínima)", "A", c.mainBreaker || "");
    f("Potencia instalada", "kVA", r2(c.installedKVA,2)); f("Máxima demanda", "kVA", r2(c.totalKVA,2)); f("Corriente de máxima demanda", "A", r2(c.demandCurrent,2));
    const mc = c.mainCond; f("Acometida (conductor por fase)", "", mc && mc.cable ? `${(mc.sets||1)>1 ? mc.sets+" x " : ""}3#${mc.cable[0]} (Cu)` : "");
    f("Altitud de diseño de equipos electrónicos (derrateo)", "", (+v.altitud>1000 ? `Derrateo por altitud según fabricante (${v.altitud} m s.n.m.)` : "Sin derrateo por altitud"));
    sec("CARACTERÍSTICAS CONSTRUCTIVAS");
    f("Grado de protección", "", ip); f("Material", "", /4X/.test(ip) ? "Acero inoxidable AISI 304 / 316" : "Plancha de acero laminado en frío, pintura electrostática"); f("Montaje", "", c.mainBreaker>250 ? "Autosoportado" : "Adosado a pared / estructura");
    f("Acceso", "", "Frontal"); f("Entrada de cables", "", "Inferior"); f("Norma de fabricación", "", t.tipo==="distribucion" ? "UL 891 / NEMA PB 2 (switchboards)" : "UL 508A (paneles de control industrial)"); f("Reserva de espacio", "%", v.reservaTablero);
    const acc = t.accesorios || {};
    if(acc.spd || acc.releFase || acc.luces){
      sec("ACCESORIOS");
      if(acc.spd) f("Supresor de sobretensiones (SPD)", "", `Tipo 1+2, ${g.voltage} V, 3F (p.ej. ABB OVR T1 T2 3L)`);
      if(acc.releFase) f("Relé de supervisión de fases (falla, secuencia, sub/sobretensión)", "", "p.ej. ABB CM-MPS.41S");
      if(acc.luces) f("Luces piloto de presencia de tensión", "", "R, S, T — LED 22 mm");
    }
    sec("COMPONENTES PRINCIPALES");
    for(const cc of c.circuits) for(const it of cc.items){ if(!it.devtag || it.devtag==="—") continue; f(`${it.devtag} — ${it.comp} (${cc.load.tag||cc.tag})`, "", [it.model, it.val!=="—"?it.val:""].filter(Boolean).join(" · ")); }
  }
  if(esControl(t)){
    const circs = circuitosControl(p, t);
    const io = (d["ins-io"]||[]).filter(x=>x.tablero===t.tag);
    const ct = k => io.filter(x=>x.tipo===k).length;
    sec("CONTROL Y COMUNICACIONES");
    f("Tensión de alimentación de control", "VAC", `${v.tensionControl} (1F + N + T)`); f("Tensión de instrumentación", "VDC", v.tensionInstr);
    f("Controlador", "", [t.plc, t.modeloPlc].filter(Boolean).join(" — ")); f("Pantalla HMI", "", t.hmi ? "Sí" : "No"); f("Switch Ethernet", "", t.switch ? "Sí" : "No"); f("Router IIoT", "", t.router ? "Sí" : "No");
    f("Entradas / salidas (AI / AO / DI / DO)", "", io.length ? `${ct("AI")} / ${ct("AO")} / ${ct("DI")} / ${ct("DO")}` : ""); f("Reserva de canales I/O", "%", v.reservaIO); f("Red externa", "", t.redExterna);
    if(!esPotencia(t)){ sec("CARACTERÍSTICAS CONSTRUCTIVAS"); f("Grado de protección", "", ip); f("Material", "", /4X/.test(ip) ? "Acero inoxidable AISI 304 / 316" : "Plancha de acero laminado en frío, pintura electrostática"); f("Montaje", "", "Adosado a pared / estructura"); f("Norma de fabricación", "", "UL 508A (paneles de control industrial)"); }
    sec("CIRCUITOS DE CONTROL");
    for(const c of circs) f(`${c.barra} ${c.circuito} — ${c.descripcion}`, "A", `${c.barra==="24 VDC" ? "Fusible" : "ITM 2P"} ${c.proteccion} A${c.diferencial?" + ID 30 mA":""}${c.potencia?" · "+c.potencia+" W":""}`);
  }
  return { titulo:`HOJA DE DATOS - ${(t.nombre||"").toUpperCase()} ${t.tag}`, filas };
}

/* ================= registro de documentos generables ================= */
export const DOCS = {
  "ele-cargas": { formato:"xlsx", plantilla:"xlsx/lista_cargas.xlsx", man:"lista_cargas", ref:"Listado de cargas: carátula + una hoja por tablero", editores:["cargas","cargasControl","notas"] },
  "ele-cables": { formato:"xlsx", plantilla:"xlsx/lista_cables.xlsx", man:"lista_cables", ref:"Listado de cables con canalización", editores:["cables","notas"] },
  "ele-equipos": { formato:"xlsx", plantilla:"xlsx/equipos_electricos.xlsx", man:"equipos_electricos", ref:"Listado de equipos: carátula + listado", editores:["tableros","equiposCfg","notas"] },
  "ele-hd": { formato:"xlsx", plantilla:"xlsx/hoja_datos_instrumentos.xlsx", man:"hoja_datos_instrumentos", ref:"Hoja de datos: carátula + índice + una hoja por tablero", editores:["hdEq"] },
  "ele-mc": { formato:"docx", plantilla:"docx/memoria_conductores.docx", ref:"Memoria de cálculo con anexos de conductores y protecciones", editores:["memoria"] },
  "ele-md": { formato:"docx", plantilla:"docx/memoria_md.docx", ref:"Memoria de cálculo con anexo de máxima demanda", editores:[] },
  "ele-unifilar": { formato:"dxf", ref:"Lámina A1 con cajetín estándar", editores:["tableros"] },
  "ele-multifilar": { formato:"dxf", ref:"Lámina A1 con cajetín estándar", editores:["cargas"] },
  "ele-mecanico": { formato:"dxf", ref:"Lámina A1 con cajetín estándar", editores:["tableros"] },
  "ele-arreglo": { formato:"dxf", ref:"Lámina A1 sobre la planta del cliente", editores:["arreglo"] },
  "ins-pid": { formato:"dxf", ref:"Lámina A1 con cajetín estándar", editores:["sistema","proceso"] },
  "ins-instrumentos": { formato:"xlsx", plantilla:"xlsx/lista_instrumentos.xlsx", man:"lista_instrumentos", ref:"Listado de instrumentos: carátula + listado", editores:["instrumentos","notas"] },
  "ins-hd": { formato:"xlsx", plantilla:"xlsx/hoja_datos_instrumentos.xlsx", man:"hoja_datos_instrumentos", ref:"Hoja de datos: carátula + índice + una hoja por instrumento", editores:["hd"] },
  "ins-io": { formato:"xlsx", plantilla:"xlsx/lista_io.xlsx", man:"lista_io", ref:"Listado I/O con resumen de señales y módulos", editores:["tablerocontrol","io","notas"] },
  "ins-lazo": { formato:"dxf", ref:"Lámina A1 con cajetín estándar", editores:["io"] },
  "ins-arquitectura": { formato:"dxf", ref:"Lámina A1 con cajetín estándar", editores:["tablerocontrol"] },
  "ins-bloques": { formato:"dxf", ref:"Lámina A1 con cajetín estándar", editores:["tableros"] },
  "ins-unifilar-tc": { formato:"dxf", ref:"Lámina A1 con cajetín estándar", editores:["tablerocontrol","circuitos","notas"] },
  "ins-multifilar-tc": { formato:"dxf", ref:"Lámina A1 con cajetín estándar", editores:["tablerocontrol","io"] },
  "ins-mecanico-tc": { formato:"dxf", ref:"Lámina A1 con cajetín estándar", editores:["tablerocontrol"] },
  "ins-arreglo": { formato:"dxf", ref:"Lámina A1 sobre la planta del cliente", editores:["arreglo"] },
  "ins-tipicos": { formato:"docx", plantilla:"docx/documento_texto.docx", secciones: seccionesTipicos, ref:"Documento Word estándar", editores:[] },
  "ins-filosofia": { formato:"docx", plantilla:"docx/documento_texto.docx", secciones: seccionesFilosofia, ref:"Documento Word estándar", editores:["filosofia"] },
  "gen-registro": { formato:"xlsx", estandar:true, ref:"Formato estándar Ingenia", editores:[] },
};
export function defDoc(id){ const d = DOCS[id]; if(!d) return null; return d.alias ? Object.assign({}, DOCS[d.alias], { aliasDe:d.alias }) : d; }
export function generable(id){ return !!DOCS[id]; }
export function descargable(id){ const d = DOCS[id]; return !!d && d.formato!=="proceso"; }

/* ---------------- payload Excel por documento ---------------- */
const nombreHoja = s => String(s).replace(/[\\/?*\[\]:]/g,"-").slice(0,31);
export async function payloadExcel(p, id, org){
  const def = defDoc(id), base = def.aliasDe || id;
  const scal = escalares(p, id, org);
  const v = valoresDiseno(p);
  const d = datos(p);
  if(base==="ele-cargas"){
    const calcs = calcularTodos(p);
    const lista = calcs.length ? calcs.map(c=>c.tablero) : [tf(p)];
    const notas = notasDe(p, base, [
      `La tensión estabilizada de ${v.tensionControl} VAC será suministrada por el cliente / tablero de distribución indicado.`,
      `Los equipos alimentados mediante tensión estabilizada de ${v.tensionControl} VAC se encuentran instalados en el tablero de control asociado.`,
      "Corrientes calculadas a partir de la potencia instalada (S = P / (η·cos φ)); la máxima demanda aplica FU y FS por carga." ]);
    const instancias = lista.map((t, k)=>{
      const tb = tablasCargas(p, t);
      return { nombre: lista.length>1 ? nombreHoja("LISTADO "+t.tag) : "LISTADO", scal:{ tablero_titulo: `${sistemaNombre(p) ? sistemaNombre(p)+" - " : ""}${t.nombre||"Tablero"} ${t.tag||""}`.toUpperCase() }, tablas:{ cargas: tb.cargas, cargas_control: tb.cargas_control, notas } };
    });
    Object.assign(scal, { tensiones: `${v.tension}/${v.tensionControl} VAC`, kv: (+v.tension||460)/1000 });
    return { scal, tablas:{}, clonar:{ hoja:"LISTADO", instancias } };
  }
  if(base==="ele-cables"){
    const filas = []; let item = 0, last = null;
    const pidRef = p.pidRef || codigoDe(p, "ins-pid");
    for(const c of cablesFuerza(p)){
      if(c._t!==last){ last = c._t; filas.push({ __var:"seccion", texto: `${(sistemaNombre(p)||"").toUpperCase()}${sistemaNombre(p)?" - ":""}ELECTRICIDAD - ${(c._t.nombre||"").toUpperCase()} ${v.tension} VAC ${c._t.tag}` }); }
      const r = { item: ++item, tag:c.tag, tipo:c.tipo, voltaje:c.voltaje, conductores:c.conductores, seccion:c.seccion, desde:c.desde, hasta:c.hasta, plano: codigoDe(p, "ele-arreglo") || "", pid: pidRef||"", notas:"" };
      for(const [k] of CANALIZACIONES) r[k] = 0;
      r[c.canalizacion in r ? c.canalizacion : "otros"] = c.longitudTotal;
      filas.push(r);
    }
    return { scal, tablas:{ cables: filas, notas: notasDe(p, base, [ `Longitudes estimadas con ${d.cablesCfg.reserva}% de reserva; las longitudes finales se confirman con el plano de rutas / arreglo general.`, `Calidad de cable: ${(CLASES_CABLE[d.cablesCfg.clase]||CLASES_CABLE.lszh).nombre} (${(CLASES_CABLE[d.cablesCfg.clase]||CLASES_CABLE.lszh).norma}).` ]).map(n=>({ texto: n.n+" "+n.texto })) } };
  }
  if(base==="ele-equipos"){
    const filas = equiposElectricos(p).map(f=>Object.assign({}, f, { plano: f.plano || codigoDe(p, f._doc) }));
    return { scal, tablas:{ equipos: filas, notas: notasDe(p, base, []) } };
  }
  if(base==="ele-hd"){
    const lista = tableros(p); const instancias = [], indice = [];
    lista.forEach((t, k)=>{ const c = camposHDEq(p, t); instancias.push({ nombre: nombreHoja(t.tag), scal:{ titulo_hoja: c.titulo }, tablas:{ campos: c.filas } }); indice.push({ n:(k+1)+".", texto:`Hoja de datos – ${t.nombre} (${t.tag})`, pag:k+3 }); });
    return { scal, tablas:{ indice }, clonar:{ hoja:"HD", instancias } };
  }
  if(base==="ins-instrumentos"){
    const st = sistemaTag(p), sist = (sistemaNombre(p)||"").toUpperCase()+(st?"\n"+st:"");
    const pre = prefijoTag(p);
    const filas = instrumentos(p).map(i=>Object.assign({}, i, { tag: conPref(pre, i.tag), sistema: i.sistema || sist, hojaDatos: i.hojaDatos || codigoDe(p, "ins-hd") }));
    return { scal, tablas:{ instrumentos: filas, notas: notasDe(p, base, []) } };
  }
  if(base==="ins-io"){
    const t = tablasIO(p);
    const ctls = tablerosControl(p);
    const filas = [];
    const sist = [(sistemaNombre(p)||"").toUpperCase(), sistemaTag(p)].filter(Boolean).join(" - ");
    if(sist) filas.push({ __var:"sistema", texto: sist });
    const orden = [...new Set(t.io.map(f=>f.tablero))];
    for(const c of orden){
      const ct = ctls.find(x=>x.tag===c);
      const esLimp = !ct && ctls.some(x=>x.tagLimpieza===c);
      filas.push({ __var:"controlador", texto: ct ? `${(ct.plc||"CONTROLADOR LÓGICO PROGRAMABLE (PLC)").toUpperCase()} - ${ct.tag}` : esLimp ? `CONTROLADOR DE LIMPIEZA - ${c}` : c });
      const pre = prefijoTag(p);
      t.io.filter(f=>f.tablero===c).forEach((f,i)=>filas.push(Object.assign({}, f, { tag: conPref(pre, f.tag), senal: f.origen==="reserva" ? f.senal : conPref(pre, f.senal), tablero: conPref(pre, f.tablero), item: String(i+1).padStart(3,"0"), rangoMin: f.rangoMin===""||f.rangoMin==null ? (f.origen==="reserva"?"-":"N/A") : f.rangoMin, rangoMax: f.rangoMax===""||f.rangoMax==null ? (f.origen==="reserva"?"-":"N/A") : f.rangoMax, unidad: f.unidad||"-", slot: f.slot===""?"-":f.slot, ch: f.ch===""?"-":f.ch, terminales: f.terminales||"-" })));
    }
    Object.assign(scal, { controladores: ctls.map(c=>c.tag).join(" / ") });
    const notas = notasDe(p, base, [`El slot 0 del PLC corresponde a la CPU; los módulos de E/S inician en el slot ${(ctls[0]||{}).primerSlot ?? 1}.`, `Se considera un mínimo de ${v.reservaIO}% de reserva por tipo de señal; los canales de reserva completan la capacidad de los módulos.`, "Los canales y bornes son referenciales y deberán confirmarse en la ingeniería de detalle del tablero de control."]).map(n=>({ n:n.n, texto: n.n.replace(".-",".")+" "+n.texto }));
    return { scal, tablas:{ io: filas, resumen: t.resumen, notas } };
  }
  if(base==="ins-hd"){
    const lista = instrumentos(p).filter(i=>i.tag);
    const instancias = []; const indice = [];
    for(let k=0;k<lista.length;k++){
      const i = lista[k]; const c = await camposHD(p, i);
      instancias.push({ nombre: nombreHoja(i.tag), scal:{ titulo_hoja: c.titulo }, tablas:{ campos: c.filas } });
      indice.push({ n:(k+1)+".", texto:`Hoja de datos – ${i.descripcion||""} (${i.tag})`, pag: k+3 });
    }
    return { scal, tablas:{ indice }, clonar:{ hoja:"HD", instancias } };
  }
  return { scal, tablas:{} };
}

/* ---------------- tablas genéricas (formato estándar) ---------------- */
export function tablasEstandar(p, id){ return {}; }

/* ---------------- plano: formato del cliente desde los DXF cargados ---------------- */
export async function formatoCliente(p){
  if(p.plantillaModo!=="cliente" || !p.plantillas) return null;
  const prep = async key=>{
    if(!p.plantillas[key]) return null;
    const f = await S.leerArchivo(p.plantillas[key]); if(!f) return null;
    const d = parseDXF(await f.blob.text());
    const ents = d.space==="paper" ? d.entities.filter(e=>e.space==="paper") : d.entities;
    const b = boundsOf(ents);
    const tokens = ents.filter(e=>e.t==="T" && /\{\{[^}]+\}\}/.test(e.text)).map(e=>({ text:e.text, x:e.x-b.minX, y:e.y-b.minY, h:e.h, rot:e.rot||0 }));
    const fijos = ents.filter(e=>!(e.t==="T" && /\{\{[^}]+\}\}/.test(e.text)));
    return { compact: toCompact(fijos, { x:b.minX, y:b.minY }), tokens, bounds:{ minX:b.minX, minY:b.minY, w:b.maxX-b.minX, h:b.maxY-b.minY } };
  };
  const formato = await prep("dxf_formato"), cajetin = await prep("dxf_cajetin");
  return (formato || cajetin) ? { formato, cajetin } : null;
}

export async function generarPlano(p, id, org, logos){
  const g = GENERADORES[id];
  const di = docInfo(p, id);
  const cliente = await formatoCliente(p);
  const st = sistemaTag(p);
  const titulo = (di.titulo||g.titulo).toUpperCase() + (st && !(di.titulo||"").includes(st) ? " - TAG: "+st : "");
  const valsDe = (i, n, extra)=>Object.assign(valoresCajetin({ p, ent:entregable(id), docInfo:di, org, titulo, hoja:`${i+1} DE ${n}`, disciplina: DISC_TXT[entregable(id).disciplina], escala:"S/E" }), { _logos: logos||null }, extra||{});
  return g.fn({ p, valsDe, cliente });
}
export { dxfBytes };

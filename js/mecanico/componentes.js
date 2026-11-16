/* Ingenia — base de datos de dimensiones de componentes para el arreglo mecánico de tableros.
   Dimensiones exteriores en mm: w = ancho (frente), h = alto (frente), d = profundidad desde la placa de montaje.
   Valores tomados de los planos dimensionales y catálogos de los fabricantes (ABB, Allen-Bradley, Phoenix Contact,
   gabinetes normalizados). Son REFERENCIALES: antes de fabricar se verifica el plano dimensional del código exacto.
   Cada familia indica su montaje (riel DIN, placa, puerta o base) y una estimación de pérdidas (W) para el
   balance térmico del gabinete.
   Pensada para crecer: cada entrada es independiente y se puede reemplazar por datos de un servidor del
   fabricante (ETIM / BMEcat / catálogos EPLAN) sin cambiar el motor de arreglo. */
import { infoModulo } from "../control/plc-modulos.js";

export const FUENTES = {
  tmax:"ABB Tmax XT — catálogo técnico (dimensiones generales, ejecución fija, 3P)",
  emax:"ABB Emax 2 — catálogo técnico (ejecución fija, 3P)",
  ms:"ABB guardamotores MS116 / MS132 / MS165 / MS450 / MS495 — catálogo",
  af:"ABB contactores AF — catálogo (dimensiones 3P)",
  ol:"ABB relés de sobrecarga TA / EF — catálogo",
  s200:"ABB System pro M compact S200 / FH200 — 17,5 mm por polo",
  e90:"ABB portafusibles E 90 (10×38) — 17,5 mm por polo",
  xlp:"ABB EasyLine XLP — seccionador portafusible NH",
  acs880:"ABB ACS880-01 — Hardware Manual (dimensiones por bastidor R1…R9, espacios libres)",
  pf755:"Allen-Bradley PowerFlex 755 — Technical Data 750-TD001 (por bastidor)",
  psr:"ABB arrancadores suaves PSR / PSTX — catálogo",
  reactor:"Reactancias trifásicas de línea / carga — dimensiones típicas por corriente (verificar con el fabricante)",
  trafo:"Transformadores de control monofásicos — dimensiones típicas por potencia",
  fuente:"ABB fuentes CP-E — catálogo",
  cm:"ABB relés de monitoreo CM — 22,5 mm",
  ovr:"ABB OVR T1+2 — supresor de sobretensiones",
  borne:"Phoenix Contact bornes UT / UKH / PTTB — catálogo",
  canaleta:"Canaleta ranurada PVC normalizada (ancho × alto)",
  gabinete:"Gabinetes normalizados autosoportados (600…1200 × 1800…2200) y murales",
  puerta:"Dispositivos de mando de 22 mm (ABB / Allen-Bradley) y paneles de operador",
  barra:"DIN 43671 — barras de cobre pintadas, 35 °C ambiente (con 0,8 de factor dentro del gabinete)",
};

const pick = (tabla, v) => tabla.find(r=>v <= r[0]+1e-9) || tabla[tabla.length-1];

/* ---------- interruptores en caja moldeada (Tmax XT / Emax) ---------- */
const TMAX = [
  // In máx, familia, w, h, d, pérdidas 3P a In (W)
  [160, "XT1", 76.2, 130, 70, 15], [160, "XT2", 90, 130, 82.5, 15], [250, "XT3", 105, 150, 70, 30], [250, "XT4", 105, 160, 82.5, 30],
  [630, "XT5", 140, 205, 103.5, 70], [1000, "XT6", 210, 268, 103.5, 110], [1600, "XT7", 210, 268, 154, 160],
];
/* general / con relé electrónico: XT2 / XT4 / XT5 / XT6 / XT7; derivaciones termomagnéticas: XT1 / XT3 */
export function interruptor(amps, general){
  if(amps > 1600) return { familia:"Emax E2.2", modelo:`Emax E2.2 ${amps}A 3P`, w:276, h:371, d:270, montaje:"placa", perdidas:250, fuente:FUENTES.emax };
  const fam = general ? TMAX.filter(r=>!/XT1|XT3/.test(r[1])) : TMAX.filter(r=>!/XT2|XT4/.test(r[1]) || r[0]>250);
  const r = pick(fam, amps);
  return { familia:"Tmax "+r[1], modelo:`Tmax ${r[1]} ${amps}A 3P${general?" Ekip LSI":" TMD"}`, w:r[2], h:r[3], d:r[4], montaje:"placa", perdidas: r[5]*Math.min(1, amps/r[0]), fuente:FUENTES.tmax };
}
/* mando rotativo en puerta del interruptor general */
export const MANIJA = { modelo:"Mando rotativo RHE en puerta, IP65", w:90, h:90, d:60, fuente:FUENTES.tmax };

/* ---------- guardamotores ---------- */
export function guardamotor(modelo){
  const m = String(modelo||"");
  if(/MS116/.test(m)) return { w:45, h:90, d:75, montaje:"din", perdidas:5, fuente:FUENTES.ms };
  if(/MS132/.test(m)) return { w:45, h:97, d:78.5, montaje:"din", perdidas:6, fuente:FUENTES.ms };
  if(/MS165/.test(m)) return { w:55, h:106, d:104, montaje:"din", perdidas:9, fuente:FUENTES.ms };
  return { w:70, h:154, d:140, montaje:"din", perdidas:16, fuente:FUENTES.ms };       // MS450 / MS495
}
/* ---------- contactores AF ---------- */
const AF = [
  [16, 45, 80, 77, 2], [38, 45, 86, 90, 3], [65, 55, 108, 113, 5], [96, 70, 129, 127, 7], [146, 90, 160, 158, 10],
  [205, 105, 180, 165, 14], [370, 140, 205, 197, 22], [580, 170, 240, 228, 35], [750, 210, 336, 237, 50],
];
export function contactor(modelo){
  const n = parseInt(String(modelo||"").replace(/\D+/g,""), 10) || 9;
  const r = pick(AF, n);
  return { w:r[1], h:r[2], d:r[3], montaje: n<=96 ? "din" : "placa", perdidas:r[4], fuente:FUENTES.af };
}
/* relé de sobrecarga montado bajo el contactor */
export function releSobrecarga(modelo, cont){
  const c = cont || { w:45, h:86, d:90 };
  return { w:c.w, h:Math.round(Math.max(45, c.h*0.55)), d:c.d-8, montaje:"contactor", perdidas:3, fuente:FUENTES.ol };
}
/* bloques de contactos auxiliares (frontal HKF1-11 / lateral HK1-11): suman ancho al guardamotor */
export const AUX_LATERAL = 9;

/* ---------- aparamenta modular ---------- */
export const MODULO = 17.5;
export function mcb(polos){ return { w:MODULO*(polos||1), h:88, d:69, montaje:"din", perdidas:2.5*(polos||1), fuente:FUENTES.s200 }; }
export function diferencial(polos){ return { w:MODULO*(polos||2), h:88, d:69, montaje:"din", perdidas:2*(polos||2), fuente:FUENTES.s200 }; }
export function portafusible(polos){ return { w:MODULO*(polos||1), h:81, d:68, montaje:"din", perdidas:1.5*(polos||1), fuente:FUENTES.e90 }; }
export const RELE_TENSION = { modelo:"CM-MPS.41S", w:22.5, h:78, d:100, montaje:"din", perdidas:2, fuente:FUENTES.cm };
export const SPD = { modelo:"OVR T1-T2 3L 12.5-440s P QS", w:53.4, h:90, d:68, montaje:"din", perdidas:0.5, fuente:FUENTES.ovr };

/* ---------- seccionadores portafusibles XLP ---------- */
const XLP = [[100,"XLP000",106,177,82,8],[160,"XLP00",106,240,105,14],[250,"XLP1",185,265,145,24],[400,"XLP2",230,290,160,38],[630,"XLP3",255,320,165,55]];
export function seccionadorFusible(modelo, amps){
  const m = String(modelo||"");
  const r = XLP.find(x=>m.includes(x[1]+" ") || m.includes(x[1]+"-") || m.endsWith(x[1])) || pick(XLP, amps||100);
  return { familia:r[1], w:r[2], h:r[3], d:r[4], montaje:"placa", perdidas:r[5], fuente:FUENTES.xlp };
}

/* ---------- variadores ---------- */
// ACS880-01 por bastidor: h, w, d (IP21) y corriente máx. del bastidor (clase -5)
const ACS880 = { R1:[405,155,226,7.6], R2:[405,155,249,14], R3:[471,172,261,27], R4:[604,203,274,52], R5:[730,203,274,77], R6:[727,252,357,124], R7:[880,284,365,180], R8:[965,300,386,302], R9:[955,380,413,414] };
const PF755 = [[11,"Bastidor 1",400,116,212],[34,"Bastidor 2",424,134,212],[65,"Bastidor 3",474,196,212],[96,"Bastidor 4",557,225,237],[156,"Bastidor 5",641,307,293],[248,"Bastidor 6",665,308,346],[415,"Bastidor 7",1023,430,365]];
export function variador(modelo, amps, kw){
  const m = String(modelo||"");
  const perdidas = Math.round(Math.max(60, (kw||amps*0.6)*1000*0.025));
  if(/PowerFlex|20G/i.test(m)){ const r = pick(PF755, amps); return { familia:"PowerFlex 755 "+r[1], bastidor:r[1], w:r[3], h:r[2], d:r[4], libreArriba:150, libreAbajo:150, montaje:"placa", perdidas, fuente:FUENTES.pf755 }; }
  const fr = Object.entries(ACS880).find(([, v])=>amps <= v[3]+1e-9) || ["R9", ACS880.R9];
  const [h, w, d] = fr[1];
  return { familia:"ACS880-01 "+fr[0], bastidor:fr[0], w, h, d, libreArriba:200, libreAbajo:300, montaje:"placa", perdidas, fuente:FUENTES.acs880 };
}
/* panel de operador del variador en puerta (ACS-AP-I con kit DPMP-01) */
export const PANEL_VFD = { modelo:"Panel ACS-AP-I + kit de puerta DPMP-01", w:96, h:154, d:30, fuente:FUENTES.acs880 };

/* ---------- arrancadores suaves ---------- */
const PSR = [[16,45,152,105],[30,45,162,145],[45,55,162,152],[105,70,203,162],[170,143,359,186],[370,160,427,199],[570,203,489,247],[1250,280,588,290]];
export function arrancadorSuave(modelo, amps){
  const n = parseInt(String(modelo||"").replace(/\D+/g,""), 10) || amps || 30;
  const r = pick(PSR, n);
  return { w:r[1], h:r[2], d:r[3], montaje: n<=105 ? "din" : "placa", libreArriba:100, libreAbajo:100, perdidas: Math.round(10 + n*0.4), fuente:FUENTES.psr };
}

/* ---------- reactancias de línea / filtros de carga (montaje en la base, por peso) ---------- */
const REACT = [[18,150,150,100],[35,180,170,120],[45,180,175,130],[65,230,210,140],[90,230,225,150],[110,270,250,160],[140,270,260,175],[180,300,285,190],[220,300,300,200],[280,360,330,220],[320,360,350,230],[400,400,380,250],[520,460,420,270],[650,480,450,290],[820,520,480,310]];
export function reactancia(amps, carga){
  const r = pick(REACT, amps), k = carga ? 1.1 : 1;
  return { w:Math.round(r[1]*k), h:Math.round(r[2]*k), d:Math.round(r[3]*k), montaje:"base", perdidas: Math.round(amps*0.9*(carga?1.3:1)), peso: Math.round(amps*0.12+3), fuente:FUENTES.reactor };
}

/* ---------- transformadores de control y fuentes ---------- */
const TRAFO = [[50,84,78,72],[75,84,78,82],[100,96,84,82],[150,96,84,95],[200,105,95,98],[250,105,95,108],[300,120,105,105],[500,135,120,120],[750,150,135,125],[1000,150,145,140],[1500,180,165,150],[2000,180,175,165],[3000,210,195,180],[5000,240,230,200],[7500,270,260,220],[10000,300,280,240]];
export function transformador(va){ const r = pick(TRAFO, va||50); return { w:r[1], h:r[2], d:r[3], montaje:"placa", perdidas: Math.round((va||50)*0.12), fuente:FUENTES.trafo }; }
const FUENTE = [[60,"CP-E 24/2.5",40.5,90,91],[120,"CP-E 24/5.0",40.5,125,115],[240,"CP-E 24/10.0",60,125,115],[480,"CP-E 24/20.0",82,125,116]];
export function fuenteDC(va){ const r = pick(FUENTE, va||60); return { modelo:r[1], w:r[2], h:r[3], d:r[4], montaje:"din", perdidas: Math.round((va||60)*0.1), fuente:FUENTES.fuente }; }

/* ---------- bornes ---------- */
// modelo, mm² máx., corriente, ancho, alto (transversal al riel), profundidad
const BORNES = [
  ["UT 2.5", 2.5, 24, 5.2, 48.5, 47], ["UT 4", 4, 32, 6.2, 48.5, 47], ["UT 6", 6, 41, 8.2, 53, 47], ["UT 10", 10, 57, 10.2, 53, 47],
  ["UT 16", 16, 76, 12.2, 62, 54], ["UT 35", 35, 125, 15.2, 75, 60], ["UKH 50", 50, 150, 20, 82, 66], ["UKH 70", 70, 192, 22, 90, 72],
  ["UKH 95", 95, 232, 25, 104, 76], ["UKH 150", 150, 309, 31, 115, 84],
];
export function borne(modelo){
  const m = String(modelo||"UT 4").replace(/-PE$|\s*PE$/i, "").trim();
  const r = BORNES.find(b=>b[0]===m) || BORNES[1];
  return { modelo:r[0], w:r[3], h:r[4], d:r[5], montaje:"din", fuente:FUENTES.borne };
}
/* borne de fuerza por corriente (≥ 6 mm² por criterio de la referencia) */
export function borneFuerza(amps){ const r = BORNES.find(b=>b[2] >= (amps||0)*1.0 && b[1] >= 6) || BORNES[BORNES.length-1]; return r[0]; }
export const BORNE_DOBLE = { modelo:"PTTB 4", w:6.2, h:79, d:60, montaje:"din", fuente:FUENTES.borne };
export const TAPA_FINAL = 2.2, TOPE = 9.5;

/* ---------- canaletas, riel, barras ---------- */
export const CANALETAS = [[25,60],[40,60],[40,80],[60,60],[60,80],[80,80],[100,80],[120,80]];
/* canaleta según la cantidad de conductores (llenado ≤ 50 % del área útil, conductor 2,5 mm² ≈ 12 mm²); en tableros
   de fuerza se usa como mínimo 60x80 mm (criterio del plano de referencia) */
export function canaleta(nCond, minAncho){
  const area = Math.max(1, nCond)*12/0.5;
  const c = CANALETAS.find(([w, h])=>w*h*0.9 >= area && w >= (minAncho||0) && h >= 80) || CANALETAS[CANALETAS.length-1];
  return { w:c[0], h:c[1], nombre:`${c[0]}x${c[1]} mm` };
}
/* TAG de la bornera de salida de un circuito (C1 → TB2…): TB1 es la de la bobina de mínima tensión del multifilar */
export const tagBornera = tagCirc => "TB" + ((parseInt(String(tagCirc||"").replace(/\D/g, ""), 10) || 0) + 1);
export const RIEL = { modelo:"Riel DIN TS35 × 7,5", w:35, d:7.5 };
const BARRAS = [[203,"12x5",12,5],[319,"20x5",20,5],[386,"25x5",25,5],[447,"30x5",30,5],[573,"40x5",40,5],[850,"40x10",40,10],[1020,"50x10",50,10],[1180,"60x10",60,10],[1500,"80x10",80,10],[1810,"100x10",100,10],[2400,"2x80x10",160,10]];
/* barra de fase según la corriente del interruptor general (mín. 20x5, como el plano de referencia) */
export function barraFase(amps){
  const r = BARRAS.find(b=>b[0]*0.8 >= (amps||0) && b[2] >= 20) || BARRAS[BARRAS.length-1];
  return { nombre:r[1], ancho:r[2], espesor:r[3], paso: r[2] >= 80 ? 100 : r[2] >= 50 ? 75 : 60, fuente:FUENTES.barra };
}
export function barraTierra(fase){ return fase.ancho > 20 ? { nombre:`${Math.max(20, fase.ancho/2)}x5`, ancho:Math.max(20, fase.ancho/2), espesor:5 } : { nombre:"20x3", ancho:20, espesor:3 }; }
export const AISLADOR = { modelo:"Aislador portabarra SM40 / soporte 3F", d:40, alto:40 };

/* ---------- dispositivos de puerta ---------- */
export const PUERTA = {
  luz:{ modelo:"Luz piloto LED 22 mm", diam:30, d:45 },
  pulsador:{ modelo:"Pulsador 22 mm", diam:30, d:45 },
  seta:{ modelo:"Parada de emergencia tipo hongo 40 mm, con anillo amarillo", diam:40, anillo:60, d:60 },
  selector:{ modelo:"Selector 2 posiciones 22 mm", diam:30, d:45 },
  potenciometro:{ modelo:"Potenciómetro 22 mm, 10 kΩ", diam:30, d:50 },
  placa:{ w:50, h:18 },
};
export const VENTILADORES = [
  // caudal libre (m³/h), caudal con filtro de salida, marco (mm), recorte (mm)
  [26, 20, 116.5, 92], [66, 55, 148.5, 124.5], [140, 105, 204, 177], [240, 180, 204, 177], [300, 230, 255, 224], [700, 550, 323, 292], [900, 700, 323, 292],
];
export function ventilador(caudal){ const r = VENTILADORES.find(v=>v[1] >= caudal) || VENTILADORES[VENTILADORES.length-1]; return { caudal:r[1], libre:r[0], marco:r[2], recorte:r[3], modelo:`Ventilador con filtro ${r[2]}x${r[2]} mm, ${r[1]} m³/h (con filtro de salida)` }; }

/* ---------- prensaestopas por diámetro de cable ---------- */
// diámetro exterior típico de cable multiconductor 3C+T 0,6/1 kV por calibre AWG / kcmil
const DIAM_CABLE = { "14":13, "12":14, "10":16, "8":20, "6":23, "4":27, "2":31, "1":34, "1/0":37, "2/0":40, "3/0":44, "4/0":49, "250":54, "300":57, "350":60, "500":70 };
// diámetro exterior de cable unipolar 0,6/1 kV (acometidas de gran sección)
const DIAM_UNIPOLAR = { "1/0":16, "2/0":17, "3/0":19, "4/0":21, "250":23, "300":25, "350":27, "400":28, "500":31, "600":34, "750":38 };
/* cables de la acometida a partir de la especificación del conductor principal (sets en paralelo; unipolares desde 1/0) */
export function cablesAcometida(mc){
  if(!mc || !mc.cable) return [{ awg:"", diam:0, desc:"Acometida en ducto de barras / según el proveedor" }];
  const awg = mc.cable[0], k = String(awg).replace(/\s*(AWG|kcmil)/i,"").trim(), sets = Math.max(1, mc.sets||1);
  const uni = (mc.miguelez && mc.miguelez.cores===1) || sets > 1 || DIAM_UNIPOLAR[k];
  if(!uni) return Array.from({ length:sets }, ()=>({ awg, diam:diamCable(awg), desc:`Acometida 3C+T ${awg}` }));
  const out = [];
  for(let s=0;s<sets;s++){ for(const f of ["L1","L2","L3"]) out.push({ awg, diam:DIAM_UNIPOLAR[k] || 30, desc:`Acometida ${f} 1x${awg}${sets>1 ? ` (terna ${s+1})` : ""}` }); }
  out.push({ awg:"PE", diam:16, desc:"Conductor de tierra de la acometida" });
  return out;
}
export function diamCable(awg){ const k = String(awg||"").replace(/\s*(AWG|kcmil)/i,"").trim(); return DIAM_CABLE[k] || 16; }
const GLANDS = [[13,"M20",20.5],[17,"M25",25.5],[21,"M32",32.5],[28,"M40",40.5],[35,"M50",50.5],[45,"M63",63.5],[55,"M75",75.5],[68,"M90",90.5]];
export function prensaestopa(diam){ const r = GLANDS.find(g=>g[0] >= diam) || GLANDS[GLANDS.length-1]; return { rosca:r[1], agujero:r[2] }; }

/* ---------- gabinetes normalizados ---------- */
export const GAB_PISO = { anchos:[600, 800, 1000, 1200], altos:[1800, 2000, 2200], fondos:[400, 500, 600, 800], zocalo:100 };
export const GAB_MURAL = { anchos:[400, 500, 600, 800], altos:[500, 600, 800, 1000, 1200], fondos:[200, 250, 300, 400] };
/* placa de montaje útil de una sección */
export function placaDe(montaje, W, H){
  return montaje==="mural" ? { mx:25, my:25, w:W-50, h:H-50 } : { mx:50, my:75, w:W-100, h:H-155 };
}
/* superficie efectiva de disipación (IEC 60890): autosoportado contra la pared / mural */
export function superficieEfectiva(W, H, D, montaje){
  const w = W/1000, h = H/1000, d = D/1000;
  return montaje==="mural" ? 1.4*w*(h+d) + 1.8*d*h : 1.4*w*(h+d) + 1.8*d*h;
}

/* ---------- colores de presentación (vista 3D) ---------- */
export const COLOR = {
  gabinete:0xd9dde2, placa:0xc9ced4, canaleta:0x9aa1a9, riel:0xb8bec6, abb:0xe9eaec, abbOscuro:0x2b2f36, variador:0x3a3f47,
  cobre:0xc8783a, tierra:0x2e9e4f, borne:0x8a9099, bornePE:0xd6c32b, reactancia:0x7b5b3a, trafo:0x5d6670, rojo:0xd2312b,
  verde:0x2e9e4f, ambar:0xf5a623, amarillo:0xf5c518, blanco:0xf4f5f6, negro:0x17191d,
};

/* =====================================================================================
   TABLERO DE CONTROL (js/mecanico/arreglo-control.js): PLC, fuentes de 24 Vdc, relés de interfaz, fusibles-borne,
   red de control, HMI y accesorios del gabinete. Mismo criterio: valores referenciales de catálogo con su fuente.
   ===================================================================================== */
Object.assign(FUENTES, {
  ab5069:"Allen-Bradley CompactLogix 5380 / Compact 5000 I/O — 5069-TD002 y 5069-TD001 (H × W × D aprox.)",
  s71500:"Siemens SIMATIC S7-1500 — manual de sistema y manuales de producto (ancho 35 mm por módulo estándar)",
  s71200:"Siemens SIMATIC S7-1200 — manual de sistema (CPU 1214C 110×100×75, SM 45×100×75 mm)",
  x80:"Schneider Electric Modicon M580 / M340 con E/S X80 — fichas de producto (módulo de 32 mm, medidas referenciales)",
  ab1769:"Allen-Bradley CompactLogix 5370 / Compact I/O 1769 — 1769-TD006 (módulo 35 × 118 × 87 mm)",
  ab1606:"Allen-Bradley 1606-XL / XLB / XLE — 1606-TD002 (fuentes de 24 Vdc, pérdidas a ~60 % de carga)",
  plcrsc:"Phoenix Contact PLC-RSC (relé REL-MR + base PLC-BSC, 6,2 mm) — catálogo",
  hesi:"Phoenix Contact UT 4-HESI (5x20) — borne portafusible con indicador LED",
  stratix:"Allen-Bradley Stratix — 1783-TD001 (switches administrables)",
  scalance:"Siemens SCALANCE XB-200 — instrucciones de servicio",
  rut956:"Teltonika RUT956 — hoja de datos (con soporte para riel DIN)",
  pv7:"Allen-Bradley PanelView Plus 7 — 2711P-TD001 (recorte de panel)",
  tp700:"Siemens SIMATIC HMI TP700 Comfort — instrucciones de servicio (recorte de montaje)",
  stego:"STEGO KTO 011 — termostato para gabinetes",
  led:"Rittal SZ — luminaria LED e interruptor de puerta para gabinetes",
  toma:"Tomacorriente doble para riel DIN (4 módulos) — catálogo",
  ovrt2:"ABB OVR T2 40-275 P QS — supresor tipo 2 enchufable, 1 polo",
});
// modelo: ancho, alto, fondo (mm) y pérdidas típicas (W)
const PLC_DIM = {
  "5069-L306ER":[80,147,105,6.2], "5069-L310ER":[80,147,105,6.5], "5069-L320ER":[80,147,105,7], "5069-L330ER":[80,147,105,7.5], "5069-L340ER":[80,147,105,8], "5069-L350ERM":[80,147,105,8.5],
  "5069-IF8":[22,145,105,2.2], "5069-IF16":[22,145,105,2.6], "5069-OF4":[22,145,105,3], "5069-OF8":[22,145,105,4.4], "5069-IA16":[22,145,105,4.5], "5069-IB16":[22,145,105,2.6],
  "5069-IB16K":[22,145,105,3.4], "5069-OW16":[22,145,105,3.3], "5069-OX4I":[22,145,105,2.5], "5069-FPD":[22,145,105,0.3], "5069-ECR":[9,145,105,0],
  "6ES7 515-2AM02-0AB0":[70,147,129,6.3], "6ES7 531-7KF00-0AB0":[35,147,129,2.7], "6ES7 532-5HD00-0AB0":[35,147,129,3], "6ES7 532-5HF00-0AB0":[35,147,129,5.2],
  "6ES7 521-1FH00-0AA0":[35,147,129,4.9], "6ES7 521-1BH00-0AB0":[35,147,129,2.6], "6ES7 521-1BL00-0AB0":[35,147,129,4.2], "6ES7 522-5HF00-0AB0":[35,147,129,5], "6ES7 522-1BH01-0AB0":[35,147,129,2.5],
};
/* CPU, módulo de E/S, distribuidor de potencial o tapa terminadora del PLC (se montan en un mismo riel, por slot) */
export function plcModulo(modelo, tipo){
  const m = String(modelo||"").trim(), sie = /^6ES7/i.test(m), info = infoModulo(m);
  // sin medida propia: la de la base de controladores (js/control/plc-modulos.js: S7-1200, S7-1500, X80, 1769…)
  const r = PLC_DIM[m] || (info && info.dim ? [...info.dim, info.perdidas ?? (info.tipo==="CPU" ? 6 : info.tipo==="TAP" || info.tipo==="RACK" ? 0 : 3)] : null)
    || (sie ? (tipo==="cpu" ? [70,147,129,6.3] : [35,147,129,3.5]) : tipo==="cpu" ? [80,147,105,7] : tipo==="tapa" ? [9,145,105,0] : [22,145,105,3]);
  const fam = info ? info.familia : "", fuente = fam==="s71200" ? FUENTES.s71200 : sie ? FUENTES.s71500 : /^(m580|m340|x80)$/.test(fam) ? FUENTES.x80 : fam==="ab5370" ? FUENTES.ab1769 : FUENTES.ab5069;
  return { w:r[0], h:r[1], d:r[2], montaje:"din", perdidas:r[3], libreArriba:50, libreAbajo:50, fuente };
}
const FUENTES_24 = { "1606-XLE60E":[32,124,102,5], "1606-XLE120E":[39,124,117,9], "1606-XLB240E":[60,124,117,18], "1606-XLE480EP":[82,124,127,30] };
export function fuente24(modelo){ const r = FUENTES_24[String(modelo||"").trim()] || [60,124,117,18]; return { w:r[0], h:r[1], d:r[2], montaje:"din", perdidas:r[3], fuente:FUENTES.ab1606 }; }
/* relé de interfaz enchufable con base (1 conmutado) para las salidas digitales */
export function releInterfaz(bobina){
  const dc = /24/.test(bobina||"");
  return { modelo:`PLC-RSC-${dc ? "24DC" : "120UC"}/21 (relé REL-MR 1 conmutado + base PLC-BSC con LED)`, w:6.2, h:80, d:94, montaje:"din", perdidas: dc ? 0.3 : 0.5, fuente:FUENTES.plcrsc };
}
/* bornes del tablero de control: fusible-borne y borne de dos pisos con sus dimensiones propias; el resto, los de la tabla general */
const BORNES_CTRL = { "UT 4-HESI":[8.2, 81.6, 66.6, FUENTES.hesi], "PTTB 4":[6.2, 79, 60, FUENTES.borne] };
export function borneControl(modelo){
  const m = String(modelo||"UT 4").replace(/-PE$|\s*PE$/i, "").trim(), r = BORNES_CTRL[m];
  return r ? { modelo:m, w:r[0], h:r[1], d:r[2], montaje:"din", fuente:r[3] } : borne(modelo);
}
/* switch Ethernet y router IIoT (riel DIN) */
export function equipoRed(tipo, modelo){
  if(tipo==="router") return { w:44.2, h:132, d:95, montaje:"din", perdidas:5, fuente:FUENTES.rut956 };
  if(/scalance/i.test(modelo||"")) return { w:60, h:147, d:125, montaje:"din", perdidas:5, fuente:FUENTES.scalance };
  return { w:60, h:147, d:132, montaje:"din", perdidas:10, fuente:FUENTES.stratix };
}
/* pantalla HMI en la puerta: recorte, marco frontal y profundidad hacia el interior */
export function hmi(modelo){
  if(/tp700|simatic/i.test(modelo||"")) return { recorteW:197, recorteH:141, w:214, h:158, prof:63, perdidas:12, fuente:FUENTES.tp700 };
  return { recorteW:210, recorteH:154, w:226, h:170, prof:64, perdidas:18, fuente:FUENTES.pv7 };
}
export const TERMOSTATO = { modelo:"Termostato STEGO KTO 011 (contacto NA, 0…60 °C) para los ventiladores", w:33, h:60, d:43, montaje:"din", perdidas:0, fuente:FUENTES.stego };
export const TOMA_DIN = { modelo:"Tomacorriente doble 2P+T 15 A para riel DIN", w:70, h:85, d:63, montaje:"din", perdidas:0, fuente:FUENTES.toma };
export const LUMINARIA = { modelo:"Luminaria LED de gabinete 600 lm, 100…240 Vac (Rittal SZ 2500.210)", w:350, h:30, d:40, montaje:"techo", perdidas:0, fuente:FUENTES.led };
export const FIN_PUERTA = { modelo:"Interruptor de puerta 1NA para la luminaria (Rittal SZ 4127.000)", w:20, h:55, d:40, montaje:"marco", perdidas:0, fuente:FUENTES.led };
export const SPD_1P = { modelo:"OVR T2 40-275 P QS", w:17.8, h:90, d:68, montaje:"din", perdidas:0.3, fuente:FUENTES.ovrt2 };
/* gabinetes murales del tablero de control (hasta 1000 de ancho: dos puertas) */
export const GAB_MURAL_CTRL = { anchos:[400, 500, 600, 800, 1000], altos:[500, 600, 800, 1000, 1200], fondos:[200, 250, 300, 400] };

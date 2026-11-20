/* Ingenia — CÓDIGOS Y ESTÁNDARES para el apartado «Códigos y estándares» de las memorias de cálculo (máxima demanda y
   conductores). Catálogo de los más usados a nivel mundial en el diseño eléctrico de baja tensión; el usuario elige
   cuáles aparecen (y puede agregar otros). Se guarda por documento en datos(p).normas[docId] = { sel:[ids], otras:[…] }. */
import { datos } from "../datos.js";

export const NORMAS = [
  { grupo:"Estados Unidos (NFPA / IEEE / UL / NEMA / ANSI)", lista:[
    ["nec", "NFPA 70: National Electrical Code (NEC) — Artículos 215, 220, 250, 310 y 430."],
    ["nfpa70e", "NFPA 70E: Seguridad eléctrica en los lugares de trabajo."],
    ["nfpa79", "NFPA 79: Equipamiento eléctrico de maquinaria industrial."],
    ["ieee141", "IEEE Std 141 (Red Book): Distribución de energía eléctrica en plantas industriales."],
    ["ieee242", "IEEE Std 242 (Buff Book): Protección y coordinación de sistemas industriales y comerciales."],
    ["ieee399", "IEEE Std 399 (Brown Book): Análisis de sistemas de potencia industriales y comerciales."],
    ["ieee1584", "IEEE Std 1584: Cálculo de la energía incidente por arco eléctrico."],
    ["ul508a", "UL 508A: Tableros de control industrial."],
    ["ul891", "UL 891: Tableros de distribución (switchboards)."],
    ["nema250", "NEMA 250: Gabinetes para equipos eléctricos (1000 V máximo)."],
    ["ansic84", "ANSI C84.1: Rangos de tensión de sistemas y equipos eléctricos."],
  ]},
  { grupo:"Internacionales (IEC)", lista:[
    ["iec", "IEC: International Electrotechnical Commission (normas de producto de los equipos)."],
    ["iec60364", "IEC 60364: Instalaciones eléctricas de baja tensión."],
    ["iec60364552", "IEC 60364-5-52: Selección e instalación de equipos eléctricos — Canalizaciones."],
    ["iec61439", "IEC 61439-1/-2: Conjuntos de aparamenta de baja tensión (tableros)."],
    ["iec60947", "IEC 60947: Aparamenta de baja tensión."],
    ["iec60909", "IEC 60909: Corrientes de cortocircuito en sistemas trifásicos de corriente alterna."],
    ["iec60502", "IEC 60502-1: Cables de potencia con aislamiento extruido de 1 kV a 3 kV."],
    ["iec60529", "IEC 60529: Grados de protección de las envolventes (código IP)."],
    ["iec61643", "IEC 61643-11: Dispositivos de protección contra sobretensiones de baja tensión."],
  ]},
  { grupo:"Códigos nacionales", lista:[
    ["cne", "CNE: Código Nacional de Electricidad — Utilización (Perú)."],
    ["nom001", "NOM-001-SEDE: Instalaciones eléctricas — Utilización (México)."],
    ["ntc2050", "NTC 2050: Código Eléctrico Colombiano y RETIE (Colombia)."],
    ["ric", "Pliegos técnicos RIC de la SEC: Instalaciones de consumo (Chile)."],
    ["aea90364", "AEA 90364: Reglamentación para la ejecución de instalaciones eléctricas en inmuebles (Argentina)."],
    ["nbr5410", "ABNT NBR 5410: Instalaciones eléctricas de baja tensión (Brasil)."],
    ["rebt", "REBT: Reglamento Electrotécnico para Baja Tensión y sus ITC (España)."],
    ["bs7671", "BS 7671: Requirements for Electrical Installations — IET Wiring Regulations (Reino Unido)."],
    ["csa", "CSA C22.1: Canadian Electrical Code (Canadá)."],
    ["asnzs3000", "AS/NZS 3000: Electrical installations — Wiring Rules (Australia / Nueva Zelanda)."],
  ]},
];
const TODAS = NORMAS.flatMap(g=>g.lista);
// selección por defecto: la que llevaban las memorias
export const NORMAS_DEF = ["nec", "cne", "iec"];

/* configuración del documento (se crea con la selección por defecto) */
export function normasDoc(p, docId){
  const d = datos(p); d.normas = d.normas || {};
  const c = d.normas[docId] = d.normas[docId] || {};
  if(!Array.isArray(c.sel)) c.sel = NORMAS_DEF.slice();
  if(!Array.isArray(c.otras)) c.otras = [];
  return c;
}
/* textos del apartado «Códigos y estándares», en el orden del catálogo y luego las agregadas por el usuario */
export function textosNormas(p, docId){
  const c = normasDoc(p, docId), sel = new Set(c.sel);
  return TODAS.filter(([k])=>sel.has(k)).map(([, t])=>t).concat(c.otras.map(t=>String(t).trim()).filter(Boolean));
}

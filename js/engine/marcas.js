/* Ingenia — MARCAS DE LOS EQUIPOS del tablero.
   El cálculo selecciona los equipos por sus características eléctricas con los catálogos de referencia (ABB, y
   Allen-Bradley en variadores). El usuario confirma la marca de cada familia en el panel «Marcas de los equipos» (antes
   de la vista previa); para otra marca el modelo se reemplaza por el equivalente de su línea con las mismas
   características (corriente, polos, tipo). Las equivalencias son de selección preliminar: el código final se verifica
   con el catálogo del fabricante elegido. */

export const FAMILIAS_MARCA = [
  { k:"interruptores", nombre:"Interruptores (caja moldeada y miniatura)", def:"ABB", opciones:["ABB","Schneider Electric","Siemens","Eaton"] },
  { k:"maniobra", nombre:"Contactores, guardamotores y relés de sobrecarga", def:"ABB", opciones:["ABB","Schneider Electric","Siemens","Eaton","Allen-Bradley"] },
  { k:"variadores", nombre:"Variadores de frecuencia", def:"ABB", opciones:["ABB","Allen-Bradley","Schneider Electric","Siemens","Danfoss"] },
  { k:"arrancadores", nombre:"Arrancadores suaves", def:"ABB", opciones:["ABB","Schneider Electric","Siemens","Allen-Bradley"] },
  { k:"spd", nombre:"Supresores de sobretensiones (OVR / SPD)", def:"ABB", opciones:["ABB","Schneider Electric","Siemens","Phoenix Contact"] },
  { k:"reles", nombre:"Relés de monitoreo de fases", def:"ABB", opciones:["ABB","Schneider Electric","Siemens","Eaton"] },
  { k:"gabinetes", nombre:"Gabinetes", def:"Rittal", opciones:["Rittal","Schneider Electric","nVent Hoffman","Fabricación local"] },
];

/* marcas confirmadas del proyecto (con las sugeridas en lo que no se cambió) */
export function marcasProyecto(p){
  const m = (p && p.datos && p.datos.marcas) || {};
  const r = {}; for(const f of FAMILIAS_MARCA) r[f.k] = f.opciones.includes(m[f.k]) ? m[f.k] : f.def;
  return r;
}

const amps = (...txt) => { for(const t of txt){ const m = String(t||"").match(/(\d+(?:\.\d+)?)\s*A\b/); if(m) return parseFloat(m[1]); } return NaN; };
const polos = t => { const m = String(t||"").match(/\b([1-4])x\d|S20([1-4])|\(([1-4])P\)/); return m ? +(m[1]||m[2]||m[3]) : 3; };
const escalon = (a, lista) => lista.find(x=>x >= a - 1e-9) ?? lista[lista.length-1];
const dos = n => String(n).padStart(2, "0");

// --- interruptores
function mccb(m, a){
  if(m==="Schneider Electric"){ const f = escalon(a, [100, 160, 250, 400, 630]); return a > 630 ? `Schneider ComPacT NS ${escalon(a, [800, 1000, 1250, 1600])}N 3P` : `Schneider ComPacT NSX${f}F 3P`; }
  if(m==="Siemens") return `Siemens SENTRON 3VA${a <= 250 ? "1" : "2"} ${escalon(a, [160, 250, 400, 630, 1000, 1600])}A 3P`;
  if(m==="Eaton") return `Eaton NZM${a <= 160 ? 1 : a <= 250 ? 2 : a <= 630 ? 3 : 4} ${a}A 3P`;
  return null;
}
function mcb(m, a, p){
  if(m==="Schneider Electric") return `Schneider Acti9 iC60N ${p}P C${a}A`;
  if(m==="Siemens") return `Siemens 5SL6${p}${dos(a)}-7 (${p}P C${a}A)`;
  if(m==="Eaton") return `Eaton FAZ-C${a}/${p}`;
  return null;
}
// --- maniobra
/* rangos de ajuste de guardamotores [mín, máx, código] y contactores [Ie AC-3, código] (catálogos de los fabricantes) */
const GV2ME = [[0.1,0.16,"GV2ME01"],[0.16,0.25,"GV2ME02"],[0.25,0.4,"GV2ME03"],[0.4,0.63,"GV2ME04"],[0.63,1,"GV2ME05"],[1,1.6,"GV2ME06"],[1.6,2.5,"GV2ME07"],
  [2.5,4,"GV2ME08"],[4,6.3,"GV2ME10"],[6,10,"GV2ME14"],[9,14,"GV2ME16"],[13,18,"GV2ME20"],[17,23,"GV2ME21"],[20,25,"GV2ME22"],[24,32,"GV2ME32"]];
const GV3P = [[30,40,"GV3P40"],[37,50,"GV3P50"],[48,65,"GV3P65"],[62,73,"GV3P73"],[70,80,"GV3P80"]];
const SIE_3RV = [[0.11,0.16,"3RV2011-0AA10"],[0.14,0.2,"3RV2011-0BA10"],[0.18,0.25,"3RV2011-0CA10"],[0.22,0.32,"3RV2011-0DA10"],[0.28,0.4,"3RV2011-0EA10"],
  [0.35,0.5,"3RV2011-0FA10"],[0.45,0.63,"3RV2011-0GA10"],[0.55,0.8,"3RV2011-0HA10"],[0.7,1,"3RV2011-0JA10"],[0.9,1.25,"3RV2011-0KA10"],[1.1,1.6,"3RV2011-1AA10"],
  [1.4,2,"3RV2011-1BA10"],[1.8,2.5,"3RV2011-1CA10"],[2.2,3.2,"3RV2011-1DA10"],[2.8,4,"3RV2011-1EA10"],[3.5,5,"3RV2011-1FA10"],[4.5,6.3,"3RV2011-1GA10"],
  [5.5,8,"3RV2011-1HA10"],[7,10,"3RV2011-1JA10"],[9,12.5,"3RV2011-1KA10"],[10,16,"3RV2011-4AA10"],[13,20,"3RV2021-4BA10"],[17,22,"3RV2021-4CA10"],
  [20,25,"3RV2021-4DA10"],[23,28,"3RV2021-4NA10"],[27,32,"3RV2021-4EA10"]];
const SIE_3RT = [[7,"3RT2015"],[9,"3RT2016"],[12,"3RT2017"],[16,"3RT2018"],[25,"3RT2026"],[32,"3RT2027"],[38,"3RT2028"],[50,"3RT2036"],[65,"3RT2037"],[80,"3RT2038"],
  [95,"3RT2046"],[110,"3RT2047"]];
/* rango cuyo máximo cubre la corriente de ajuste (el de menor máximo) */
const rango = (lista, a) => lista.find(r=>a <= r[1] + 1e-9 && a >= r[0] - 1e-9) || lista.find(r=>a <= r[1] + 1e-9) || null;
function contactor(m, a){
  if(m==="Schneider Electric") return `Schneider TeSys D LC1D${dos(escalon(a, [9, 12, 18, 25, 32, 38, 40, 50, 65, 80, 95, 115, 150]))}`;
  if(m==="Siemens"){ const r = SIE_3RT.find(([i])=>i >= a - 1e-9) || SIE_3RT[SIE_3RT.length-1]; return `Siemens SIRIUS ${r[1]} (${r[0]} A, AC-3)`; }
  if(m==="Eaton") return `Eaton DILM${escalon(a, [7, 9, 12, 15, 17, 25, 32, 38, 40, 50, 65, 72, 80, 95, 115, 150])}`;
  if(m==="Allen-Bradley") return `Allen-Bradley 100-C${dos(escalon(a, [9, 12, 16, 23, 30, 37, 43, 60, 72, 85, 97]))}`;
  return null;
}
function guardamotor(m, a){
  if(m==="Schneider Electric"){ const r = rango(GV2ME, a) || rango(GV3P, a); return r ? `Schneider TeSys ${r[2]} (${r[0]}-${r[1]} A)` : `Schneider TeSys GV4P115 (${a} A)`; }
  if(m==="Siemens"){ const r = rango(SIE_3RV, a); return r ? `Siemens SIRIUS ${r[2]} (${r[0]}-${r[1]} A)` : `Siemens SIRIUS ${a <= 80 ? "3RV2031" : "3RV2041"} (${a} A)`; }
  if(m==="Eaton") return a <= 32 ? `Eaton PKZM0-${a}` : a <= 65 ? `Eaton PKZM4-${a}` : `Eaton PKE65 (${a} A)`;
  if(m==="Allen-Bradley") return `Allen-Bradley 140MT (${a} A)`;
  return null;
}
function sobrecarga(m){
  if(m==="Schneider Electric") return "Schneider TeSys LRD (clase 20)";
  if(m==="Siemens") return "Siemens SIRIUS 3RB30 (clase 20)";
  if(m==="Eaton") return "Eaton ZEB (clase 20)";
  if(m==="Allen-Bradley") return "Allen-Bradley 193-E1 (clase 20)";
  return null;
}
// --- variadores y arrancadores suaves
function variador(m, a){
  if(m==="Schneider Electric") return `Schneider Altivar Process ATV630 (${a} A)`;
  if(m==="Siemens") return `Siemens SINAMICS G120X (${a} A)`;
  if(m==="Danfoss") return `Danfoss VLT AutomationDrive FC 302 (${a} A)`;
  return null;
}
function arrancador(m, a){
  if(m==="Schneider Electric") return `Schneider Altistart ATS480 (${a} A)`;
  if(m==="Siemens") return `Siemens SIRIUS 3RW55 (${a} A)`;
  if(m==="Allen-Bradley") return `Allen-Bradley SMC-50 (${a} A)`;
  return null;
}
// --- accesorios de la acometida
function spd(m, t){
  // tipo del supresor de referencia: OVR T1-T2 (tipo 1+2), OVR T1, OVR T2 u OVR T3
  const k = /OVR T1-T2|OVR T1 T2/.test(t) ? "T12" : /OVR T1\b/.test(t) ? "T1" : /OVR T3\b/.test(t) ? "T3" : /OVR T2\b/.test(t) ? "T2" : "T12";
  const M = {
    "Schneider Electric": { T1:"Schneider PRF1 Master 3P (tipo 1)", T12:"Schneider Acti9 iPRF1 12.5r 3P (tipo 1+2)", T2:"Schneider Acti9 iPRD40r 3P (tipo 2)", T3:"Schneider Acti9 iPRD8r 3P (tipo 3)" },
    "Siemens": { T1:"Siemens 5SD7 (tipo 1, 25 kA)", T12:"Siemens 5SD7 (tipo 1+2, 12,5 kA)", T2:"Siemens 5SD7 (tipo 2, 40 kA)", T3:"Siemens 5SD7 (tipo 3)" },
    "Phoenix Contact": { T1:"Phoenix Contact FLT-SEC-T1-3C (tipo 1)", T12:"Phoenix Contact FLT-SEC-T1+T2-3S (tipo 1+2)", T2:"Phoenix Contact VAL-MS 3+0 (tipo 2)", T3:"Phoenix Contact PLT-SEC-T3 (tipo 3)" },
  };
  return (M[m] || {})[k] || null;
}
function rele(m){
  if(m==="Schneider Electric") return "Schneider Zelio RM22TR33";
  if(m==="Siemens") return "Siemens SIRIUS 3UG4614";
  if(m==="Eaton") return "Eaton EMR6-AWN";
  return null;
}

/* modelo equivalente en la marca elegida. texto: modelo de referencia; val: valor del equipo («3x250A», «45A») para
   tomar la corriente; mr: marcas del proyecto (marcasProyecto). Devuelve el texto sin cambios si la familia queda en
   la marca de referencia o no se reconoce. */
export function modeloEnMarca(texto, val, mr){
  const t = String(texto||""); if(!t || !mr) return t;
  const a = amps(val, t), p = polos(val || t);
  let r = null;
  // portafusibles y fusibles: se mantienen (la nota del manual del variador pasa a ser genérica si cambia la marca)
  if(/EasyLine|XLP\d|E91|fusible/i.test(t)) return mr.variadores!=="ABB" ? t.replace(/\(ABB ACS\d+-01 Hardware Manual\)/, "(según el manual del variador)") : t;
  if(/ACS-AP/.test(t)) return mr.variadores==="ABB" ? t : "Panel de operador del variador con kit de montaje en puerta";
  if(/\bTmax\b|\bEmax\b/.test(t)) r = mccb(mr.interruptores, a);
  else if(/\bS20[1-4]\b|S20[1-4]-C|System pro M/.test(t)) r = mcb(mr.interruptores, a, /System pro M compact \((\d)P\)/.test(t) ? +RegExp.$1 : p);
  else if(/\bAF\d+\b/.test(t)) r = contactor(mr.maniobra, a);
  else if(/\bMS(116|132|165|450|495|5\d\d)\b/.test(t)) r = guardamotor(mr.maniobra, a);
  else if(/\bEF\d+\b/.test(t)) r = sobrecarga(mr.maniobra);
  else if(/\bACS\d{3}\b/.test(t)) r = variador(mr.variadores, a);
  else if(/\bPS(R|E|TX)\d*/.test(t)) r = arrancador(mr.arrancadores, a);
  else if(/\bOVR\b/.test(t)) r = spd(mr.spd, t);
  else if(/CM-MPS/.test(t)) r = rele(mr.reles);
  if(!r) return t;
  // se conserva la nota entre paréntesis del cálculo (criterio de selección), sin la referencia al manual de ABB
  const nota = (t.match(/\s(\((?:NEC|verificar|Cl\.)[^)]*\))/) || [])[1];
  return nota ? `${r} ${nota}` : r;
}
/* nombre corto de un modelo para los planos (sin la marca ni notas): «LC1D09», «ATV630 (180 A)» */
export function modeloCorto(texto){
  return String(texto||"").replace(/^(ABB|Schneider|Siemens|Eaton|Allen-Bradley|Danfoss|Phoenix Contact)\s+/, "")
    .replace(/^(TeSys D |TeSys |SIRIUS |Acti9 |ComPacT |SENTRON |Altivar Process |Altistart |SINAMICS |VLT AutomationDrive |Zelio )/, "")
    .replace(/\s*\((NEC|verificar|Cl\.)[^)]*\)\s*$/, "").trim();
}

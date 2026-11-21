/* Ingenia — GABINETES COMERCIALES: marca, modelo y código del gabinete según las dimensiones del arreglo mecánico.
   El arreglo elige el gabinete por las medidas normalizadas (ancho, alto y fondo) y el grado de protección; aquí se busca,
   en la marca elegida para el tablero, el gabinete de catálogo de esa medida (o la medida comercial inmediata superior si
   la marca no la fabrica) con su código de pedido. «Nacional» es un gabinete fabricado a medida según el plano mecánico.
   Los códigos son los de catálogo del fabricante (ver FUENTES); la selección se confirma con el distribuidor. */
import { FAMILIAS_MARCA, marcasProyecto } from "../engine/marcas.js";

export const NACIONAL = "Nacional";
export const MARCAS_GABINETE = (FAMILIAS_MARCA.find(f=>f.k==="gabinetes") || { opciones:[] }).opciones;

/* catálogo por marca: familia de piso y mural, grado de protección y códigos por medida «AnchoxAltoxFondo» (mm).
   Solo códigos verificados en páginas del fabricante o de distribuidores que indican la medida de ese código (noviembre
   de 2026); las medidas que una familia no tiene toman la medida comercial inmediata superior. */
export const CATALOGO = {
  "Rittal": {
    piso:  { familia:"VX25", ip:"IP55", codigos:{
      "600x2000x400":"VX 8604.000", "600x2000x500":"VX 8605.000", "600x2000x600":"VX 8606.000", "800x2000x400":"VX 8804.000", "800x2000x500":"VX 8805.000",
      "800x2000x600":"VX 8806.000", "1000x2000x500":"VX 8005.000", "1000x2000x600":"VX 8006.000", "1200x2000x500":"VX 8205.000", "1200x2000x600":"VX 8206.000",
      "600x1800x400":"VX 8684.000", "600x1800x500":"VX 8685.000", "600x1800x600":"VX 8686.000", "800x1800x400":"VX 8884.000", "800x1800x500":"VX 8885.000",
      "800x1800x600":"VX 8886.000", "1200x1800x600":"VX 8286.000", "600x2200x600":"VX 8626.000", "800x2200x600":"VX 8826.000" } },
    mural: { familia:"AX", ip:"IP66", codigos:{
      "400x500x210":"AX 1045.000", "600x600x250":"AX 1054.000", "600x800x250":"AX 1058.000", "800x600x300":"AX 1055.000", "600x1000x250":"AX 1090.000",
      "800x1000x300":"AX 1180.000", "1000x1000x300":"AX 1110.000", "600x1200x300":"AX 1260.000", "800x1200x300":"AX 1280.000", "1000x1200x300":"AX 1213.000" } },
  },
  "Schneider Electric": {
    // Spacial SF está descontinuada: se propone su reemplazo vigente, PanelSeT SFN
    piso:  { familia:"PanelSeT SFN", ip:"IP55", codigos:{
      "600x2000x500":"NSYSFN20650P", "800x2000x600":"NSYSFN20860P", "1200x2000x400":"NSYSFN2012402DP", "1200x2000x600":"NSYSFN2012602DP" } },
    mural: { familia:"PanelSeT S3D", ip:"IP66", codigos:{
      "400x500x200":"NSYS3D5420P", "500x500x250":"NSYS3D5525P", "600x600x250":"NSYS3D6625P", "600x800x200":"NSYS3D8620P", "600x800x250":"NSYS3D8625P",
      "600x800x300":"NSYS3D8630P", "1000x800x300":"NSYS3D81030P", "600x1000x250":"NSYS3D10625P", "600x1000x300":"NSYS3D10630P", "800x1000x300":"NSYS3D10830P",
      "800x1200x300":"NSYS3D12830P", "1000x1200x300":"NSYS3D121030P" } },
  },
  "nVent Hoffman": {
    piso:  { familia:"MCS", ip:"IP55", codigos:{
      "600x2000x400":"MCS20064R5", "600x2000x500":"MCS20065R5", "600x2000x600":"MCS20066R5", "800x2000x400":"MCS20084R5", "800x2000x600":"MCS20086R5" } },
    mural: { familia:"MAS", ip:"IP66", codigos:{
      "600x800x300":"MAS0806030R5", "800x600x300":"MAS0608030R5", "800x1000x300":"MAS1008030R5" } },
  },
  "Legrand": {
    piso:  { familia:"Altis", ip:"IP55", codigos:{
      "600x2000x400":"0 471 31", "800x2000x400":"0 471 32", "600x2000x500":"0 472 29", "600x2000x600":"0 472 52" } },
    mural: { familia:"Atlantic", ip:"IP66", codigos:{
      "600x800x300":"0 355 23", "800x800x300":"0 369 68" } },
  },
};
/* páginas donde se verificó cada código (fabricante o distribuidor) */
export const FUENTES = {
  "Rittal VX25": "rittal.com (fichas «pdf-creator/variant/…/86xx000»), RS Online, Standard Electric Supply, Digi-Key",
  "Rittal AX": "rittal.com/products/deep/10xx000, Crescent Electric, Conrad, Rapid Online",
  "Schneider PanelSeT SFN": "eshop.se.com, se.com, RS Online",
  "Schneider PanelSeT S3D": "se.com/…/product/NSYS3D…",
  "nVent Hoffman MCS / MAS": "RS Online, Steiner Electric, hoffman.nvent.com",
  "Legrand Altis / Atlantic": "legrand.fr/pro/catalogue, legrand.com/ecatalogue, CEF",
};

const med = (W, H, D) => `${W}x${H}x${D}`;
/* marca del gabinete del tablero: la elegida en el listado de equipos, si no la del proyecto («Marcas de los equipos») */
export function marcaGabinete(p, t){
  const d = (p && p.datos) || {}, o = (d.equiposOver || {})[`${t.id}|gabinete`];
  const m = (o && o.marca) || marcasProyecto(p).gabinetes;
  return /^fabricaci[oó]n local$/i.test(m) ? NACIONAL : m;
}

/* modelo y código comerciales: { modelo, codigo, nota } */
const ipNum = t => +((String(t||"").match(/IP\s?(\d)(\d)/i)||[]).slice(1).join("") || 0);
export function gabineteComercial(marca, { montaje, W, H, D, ip }){
  const r = gabineteComercialBase(marca, { montaje, W, H, D });
  // el grado de protección de la familia debe cubrir el de diseño (IP66 de intemperie, IP55, IP54…)
  const fam = CATALOGO[marca] && CATALOGO[marca][montaje==="mural" ? "mural" : "piso"];
  if(fam && ipNum(ip) && ipNum(fam.ip) < ipNum(ip)) r.nota = `${r.nota ? r.nota + " " : ""}${fam.familia} es ${fam.ip} y el diseño pide ${(String(ip).match(/IP\s?\d{2}/i)||[""])[0].replace(/\s/, "")}: pide al fabricante la versión ${(String(ip).match(/IP\s?\d{2}/i)||[""])[0].replace(/\s/, "")} (juntas y accesorios) o elige otra marca / fabricación nacional.`.trim();
  return r;
}
function gabineteComercialBase(marca, { montaje, W, H, D }){
  if(!marca || marca===NACIONAL || /^fabricaci/i.test(marca))
    return { modelo:"Fabricación nacional según plano, plancha LAF 2 mm, RAL 7035", codigo:"—", nota:"Gabinete fabricado a medida según el plano mecánico." };
  const cat = CATALOGO[marca];
  if(!cat) return { modelo:"Por definir", codigo:"—", nota:"" };
  const fam = cat[montaje==="mural" ? "mural" : "piso"];
  const exacto = fam.codigos[med(W, H, D)];
  if(exacto) return { modelo:`${fam.familia} ${W} x ${H} x ${D} mm`, codigo:exacto, nota:"" };
  // la medida comercial inmediata superior de la misma familia (menor volumen que contenga la pedida)
  const cands = Object.entries(fam.codigos).map(([k, c])=>{ const [w, h, d] = k.split("x").map(Number); return { w, h, d, c }; })
    .filter(x=>x.w >= W && x.h >= H && x.d >= D).sort((a, b)=>a.w*a.h*a.d - b.w*b.h*b.d);
  if(cands.length){ const x = cands[0]; return { modelo:`${fam.familia} ${x.w} x ${x.h} x ${x.d} mm`, codigo:x.c, nota:`${marca} no tiene ${W} x ${H} x ${D} mm en ${fam.familia}: se propone la medida inmediata superior.` }; }
  return { modelo:`${fam.familia} ${W} x ${H} x ${D} mm`, codigo:"Por confirmar", nota:`Medida a confirmar con el catálogo de ${marca}.` };
}

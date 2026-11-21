/* Ingenia — ACCESORIOS MECÁNICOS del tablero (plano mecánico): techo (plano con alero o inclinado), caperuzas antilluvia
   en los ventiladores y filtros de puerta, y visores (ventanas de inspección IP66) sobre los dispositivos de puerta que el
   usuario elige (los que no tienen grado de protección propio para el ambiente, p. ej. luces piloto o pulsadores IP54
   en un tablero a la intemperie). Se configuran en el plano mecánico (cfgMecanico) y se aplican al arreglo de fuerza y al de
   control, así el plano 2D, la vista 3D y la lista de materiales los muestran igual.
   Modelos REFERENCIALES (familias de catálogo): verificar el código exacto con el fabricante del gabinete. */

import { VISOR, hojasPuerta } from "./componentes.js";

export const TECHOS = [["auto","Automático (con alero si el tablero va a la intemperie)"],["plano","Plano con alero"],["inclinado","Inclinado (caída hacia atrás)"],["no","Sin techo"]];
// dispositivos de puerta que pueden ir bajo un visor
export const TIPOS_VISOR = new Set(["luz","pulsador","selector","potenciometro","hmi","panelvfd","seta"]);
export const NOMBRE_DISP = { luz:"Luz piloto", pulsador:"Pulsador", selector:"Selector", potenciometro:"Potenciómetro", hmi:"Pantalla HMI", panelvfd:"Panel del variador", seta:"Parada de emergencia" };
/* clave estable de un dispositivo de puerta (el TAG se repite, p. ej. las tres luces de fase LT) */
export const claveDisp = d => `${d.tag||d.tipo}|${d.leyenda||""}`;
/* medio ancho / medio alto de un dispositivo de puerta, con su placa de leyenda */
function cajaDisp(d){
  if(d.w) return { x0:d.x - d.w/2, x1:d.x + d.w/2, y0:d.y - d.h/2, y1:d.y + d.h/2 };
  const r = (d.anillo || d.diam || 30)/2;
  return { x0:d.x - Math.max(r, 30), x1:d.x + Math.max(r, 30), y0:d.y - r, y1:d.y + r + (d.leyenda ? 26 : 0) };
}

/* aplica los accesorios al arreglo m (de arregloTablero o arregloControl) y los suma a su lista de materiales */
export function aplicarAccesoriosMecanicos(m, cfg){
  cfg = cfg || {};
  // ----- techo
  const t = cfg.techo || "auto";
  m.techoTipo = t==="auto" ? (m.techo ? "plano" : null) : t==="no" ? null : t;
  m.techo = !!m.techoTipo;
  // techo inclinado: canto trasero de 30 mm y caída de 15° hacia atrás sobre el fondo más los aleros (pendiente usual de
  // los techos de intemperie: 10…20°; con 15° se ve claramente en la vista lateral y en la isométrica)
  m.techoPendiente = 15;
  m.techoAlto = m.techoTipo==="inclinado" ? 30 + Math.round((m.D + 80)*Math.tan(m.techoPendiente*Math.PI/180)) : m.techoTipo ? 55 : 0;
  if(m.techoTipo){
    m.bom.push({ tag:"", tipo:"techo", desc: m.techoTipo==="inclinado" ? "Techo inclinado de protección (caída hacia atrás, alero de 40 mm por lado) para intemperie" : "Techo plano con alero de protección para intemperie",
      modelo:"Techo para gabinete (ref. Rittal TS 8 / Schneider Spacial SF, según ancho y fondo)", cant:1, dim:`${m.W + 80} x ${m.D + 80}`, montaje:"Techo", fuente:"Accesorios de gabinetes (referencial)" });
    m.criterios.push(m.techoTipo==="inclinado" ? "Techo inclinado con caída hacia atrás y alero en los cuatro lados: el agua y el polvo no se acumulan sobre el gabinete." : "Techo plano con alero sobre el gabinete (protección para intemperie).");
  }
  // ----- caperuzas en los ventiladores y filtros de salida de la puerta
  const fans = m.puerta.filter(d=>d.tipo==="ventilador" || d.tipo==="rejilla");
  // proporciones del modelo de referencia: ~1,24 veces el marco del ventilador, salida de ~27 % de su alto, con tapa
  // superior corta, cara inclinada y frente vertical, abierta hacia abajo (solo cambian el ancho y el alto)
  m.caperuzas = cfg.caperuza ? fans.map(d=>{ const w = Math.round(d.w*1.24/5)*5, h = Math.round(d.h*1.24/5)*5;
    return { tag:d.tag || "", tipo:d.tipo, x:d.x, y:d.y, w, h, prof:Math.round(h*0.27/5)*5, seccion:d.seccion }; }) : [];
  if(m.caperuzas.length){
    const c0 = m.caperuzas[0];
    m.bom.push({ tag:"", tipo:"caperuza", desc:"Caperuza antilluvia (cubierta de intemperie) para ventilador y filtro de salida de puerta, IP56, abertura hacia abajo", modelo:"Cubierta de intemperie para ventilador con filtro (ref. Rittal SK 3255 / Pfannenberg, según tamaño)",
      cant:m.caperuzas.length, dim:`${c0.w} x ${c0.h} x ${c0.prof}`, montaje:"Puerta", fuente:"Accesorios de climatización de gabinetes (referencial)" });
    m.criterios.push("Caperuzas antilluvia sobre los ventiladores y filtros de la puerta: protegen la entrada y salida de aire de la lluvia y el polvo.");
  }
  // ----- visores: uno por hoja de puerta, sobre los dispositivos elegidos
  const elegibles = m.puerta.filter(d=>TIPOS_VISOR.has(d.tipo));
  m.dispositivosVisor = elegibles.map(d=>({ clave:claveDisp(d), tag:d.tag || "", tipo:d.tipo, leyenda:d.leyenda || "" }));
  const lista = Array.isArray(cfg.visorEquipos) && cfg.visorEquipos.length ? new Set(cfg.visorEquipos) : null;
  const bajoVisor = cfg.visor ? elegibles.filter(d=>lista ? lista.has(claveDisp(d)) : d.tipo!=="seta") : [];
  const porSeccion = new Map();
  for(const d of bajoVisor){ const k = d.seccion || "S1"; if(!porSeccion.has(k)) porSeccion.set(k, []); porSeccion.get(k).push(d); }
  // la ventana (esquinas redondeadas) encierra los dispositivos con 10 mm de holgura; a su izquierda van los cierres y a
  // su derecha las bisagras (VISOR); el visor no sale de su hoja de puerta
  const hojas = hojasPuerta(m), mg = 10;
  m.visores = [...porSeccion.entries()].map(([seccion, ds])=>{
    const cs = ds.map(cajaDisp), xc = (Math.min(...cs.map(c=>c.x0)) + Math.max(...cs.map(c=>c.x1)))/2;
    const hj = hojas.find(h=>xc >= h.x0 && xc <= h.x1) || { x0:-Infinity, x1:Infinity };
    return { seccion, tags: ds.map(d=>d.tag).filter(Boolean), x0: Math.max(hj.x0 + 12, Math.min(...cs.map(c=>c.x0)) - mg - VISOR.izq), x1: Math.min(hj.x1 - 18, Math.max(...cs.map(c=>c.x1)) + mg + VISOR.der),
      y0: Math.min(...cs.map(c=>c.y0)) - mg - VISOR.vert, y1: Math.max(...cs.map(c=>c.y1)) + mg + VISOR.vert, prof:VISOR.prof };
  });
  for(const vz of m.visores){
    const w = Math.round(vz.x1 - vz.x0), h = Math.round(vz.y1 - vz.y0);
    m.bom.push({ tag:"", tipo:"visor", desc:`Visor (ventana de inspección) de policarbonato con marco, bisagra y cierre, IP66, sobre ${[...new Set(vz.tags)].join(", ") || "los dispositivos de puerta"}`,
      modelo:"Ventana de inspección IP66 con tapa abatible (ref. Rittal / Hensel / Fibox, según recorte)", cant:1, dim:`${w} x ${h} x 40`, montaje:"Puerta", fuente:"Accesorios de gabinetes (referencial)" });
  }
  // ----- lock out: manija con bloqueo por candado en cada hoja, en su borde de cierre (entre las puertas)
  if(m.lockout){
    m.bom.push({ tag:"", tipo:"manijapuerta", desc:"Manija de puerta con bloqueo por candado (lock out / tag out), con cilindro de cerradura, en el borde de cierre de cada hoja", modelo:"Manija giratoria con porta-candado (ref. Rittal SZ 2433 / Hoffman, según puerta)",
      cant:hojas.length, dim:"40 x 200 x 38", montaje:"Puerta", fuente:"Accesorios de gabinetes (referencial)" });
    m.criterios.push("Lock out: manija con bloqueo por candado en cada hoja de puerta, en su borde de cierre (entre las puertas); se bloquea con el candado de seguridad y la tarjeta de advertencia.");
  }
  if(m.visores.length) m.criterios.push(`Visor IP66 (ventana de inspección con tapa abatible) sobre los dispositivos de puerta elegidos: se ven desde afuera y quedan protegidos del ambiente${m.visores.some(v=>v.tags.length) ? ` (${[...new Set(m.visores.flatMap(v=>v.tags))].join(", ")})` : ""}.`);
  return m;
}

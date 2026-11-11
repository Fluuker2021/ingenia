/* Ingenia — proceso (P&ID): equipos del proceso y recomendación de instrumentos.
   Reglas de buenas prácticas de instrumentación por tipo de equipo (ISA 5.1 para la identificación).
   Son recomendaciones de partida: el ingeniero aprueba las que correspondan y ajusta rangos, cantidades y
   servicios con la información de Procesos. */

export const EQUIPOS_PROCESO = [
  { v:"colector", label:"Colector de polvo (filtro de mangas)", claves:/colector|filtro de mangas|mangas/i },
  { v:"ventilador", label:"Ventilador", claves:/ventilador/i },
  { v:"valvula-rotativa", label:"Válvula rotativa", claves:/v[aá]lvula(s)? rotativa/i },
  { v:"faja", label:"Faja transportadora", claves:/faja|transportador/i },
  { v:"bomba", label:"Bomba", claves:/bomba/i },
  { v:"tanque", label:"Tanque / cajón", claves:/tanque|caj[oó]n/i },
  { v:"tolva", label:"Tolva / silo", claves:/tolva|silo/i },
  { v:"compresor", label:"Compresor", claves:/compresor/i },
  { v:"chancadora", label:"Chancadora", claves:/chancadora|trituradora/i },
  { v:"molino", label:"Molino", claves:/molino/i },
  { v:"agitador", label:"Agitador", claves:/agitador/i },
  { v:"aire", label:"Línea de aire comprimido", claves:/aire comprimido/i },
  { v:"otro", label:"Otro", claves:null },
];

const A = (tipo, descripcion, servicio, rango, unidad, alimentacion="24 VDC / Loop Powered") => ({ tipo, descripcion, servicio, tipoSenal:"Analógica", senal:"4 - 20 mA", alimentacion, rango, unidad });
const D = (tipo, descripcion, servicio, alimentacion="120 VAC") => ({ tipo, descripcion, servicio, tipoSenal:"Discreta", senal:"Contacto seco / Relé", alimentacion });
const O = (tipo, descripcion, servicio) => ({ tipo, descripcion, servicio, tipoSenal:"Discreta", senal:"N. A.", alimentacion:"120 VAC" });

const REGLAS = {
  colector: [
    [A("PDT","Transmisor de presión diferencial","Presión diferencial de mangas","0 - 10","in w.c."), "Supervisa la colmatación de las mangas y permite la limpieza por demanda."],
    [D("LSH","Interruptor de nivel tipo vibratorio","Nivel alto en tolva"), "Evita el rebalse de polvo en la tolva y el retorno a las mangas."],
    [O("XV","Válvulas solenoides","Limpieza de mangas por pulsos de aire"), "Una por fila de mangas: ajustar la cantidad (p.ej. XV-010A@010D)."],
  ],
  ventilador: [
    [A("VT","Transmisor de vibración","Vibración en descansos del ventilador","0 - 25","mm/s"), "Protección del ventilador; habitual en equipos de potencia significativa (confirmar criterio del cliente)."],
    [A("TT","Transmisor de temperatura (RTD Pt100)","Temperatura de rodamientos","0 - 150","°C"), "Protección de rodamientos; confirmar con el fabricante si viene incluido."],
  ],
  "valvula-rotativa": [ [D("SSL","Interruptor de velocidad cero","Detección de rotación de válvula rotativa"), "Detecta atasco o rotura de acople de la válvula rotativa."] ],
  faja: [
    [D("SSL","Interruptor de velocidad cero","Velocidad cero / deslizamiento de faja"), "Detecta deslizamiento o parada de la faja."],
    [D("ZS","Interruptor de desalineamiento","Desalineamiento de faja (lado izquierdo y derecho)"), "Instalar a ambos lados (p.ej. ZS-020A@020B)."],
    [D("HS","Interruptor de parada por cable (pull cord)","Parada de emergencia a lo largo de la faja"), "Requerido por seguridad a lo largo del recorrido de la faja."],
    [D("LSH","Interruptor de atoro","Atoro en chute de descarga"), "Detecta atoro en chute de transferencia."],
  ],
  bomba: [
    [A("PIT","Transmisor de presión","Presión de descarga de la bomba","0 - 150","psi"), "Supervisión y protección por baja / alta presión."],
    [A("FIT","Transmisor de flujo","Caudal de descarga","",""), "Control o supervisión de caudal (definir rango con Procesos)."],
  ],
  tanque: [
    [A("LIT","Transmisor de nivel tipo radar","Nivel del tanque","0 - 100","%"), "Control y supervisión de nivel."],
    [D("LSH","Interruptor de nivel alto","Nivel alto del tanque"), "Protección contra rebose (independiente del transmisor)."],
    [D("LSL","Interruptor de nivel bajo","Nivel bajo del tanque (protección de bomba)"), "Protección contra marcha en vacío de bombas."],
  ],
  tolva: [
    [A("LIT","Transmisor de nivel tipo radar","Nivel de tolva","0 - 100","%"), "Supervisión de inventario en tolva / silo."],
    [D("LSH","Interruptor de nivel tipo vibratorio","Nivel alto de tolva"), "Protección contra rebose."],
  ],
  compresor: [
    [A("PIT","Transmisor de presión","Presión de descarga del compresor","0 - 150","psi"), "Supervisión de la red de aire."],
    [D("TSH","Interruptor de temperatura alta","Temperatura alta de descarga"), "Protección del compresor (verificar si viene en su tablero propio)."],
  ],
  chancadora: [
    [A("VT","Transmisor de vibración","Vibración de la chancadora","0 - 25","mm/s"), "Protección del equipo."],
    [A("TT","Transmisor de temperatura (RTD Pt100)","Temperatura de rodamientos","0 - 150","°C"), "Protección de rodamientos."],
    [A("LIT","Transmisor de nivel tipo radar","Nivel en cámara / tolva de alimentación","0 - 100","%"), "Control de alimentación (choke feed)."],
  ],
  molino: [
    [A("TT","Transmisor de temperatura (RTD Pt100)","Temperatura de descansos","0 - 150","°C"), "Protección de descansos."],
    [A("VT","Transmisor de vibración","Vibración del molino","0 - 25","mm/s"), "Protección del equipo."],
  ],
  agitador: [ [D("SSL","Interruptor de velocidad cero","Rotación del agitador"), "Detecta rotura de eje o acople."] ],
  aire: [ [A("PIT","Transmisor de presión","Presión en línea de aire comprimido","0 - 232","psi"), "Habilita la limpieza / operación solo con presión suficiente."] ],
};

function maxNumero(tags){ let m = 0; for(const t of tags){ const x = String(t||"").match(/-(\d{1,4})/); if(x) m = Math.max(m, +x[1]); } return m; }

export function recomendarInstrumentos(p){
  const d = p.datos, pr = d.proceso;
  const equipos = (pr.equipos||[]).filter(e=>e.tipo && e.tipo!=="otro").map(e=>({ tag:e.tag||"", tipo:e.tipo, desc:e.descripcion||"" }));
  // equipos mencionados en la descripción que no figuran en la tabla
  const txt = pr.descripcion||"";
  for(const eq of EQUIPOS_PROCESO) if(eq.claves && eq.claves.test(txt) && !equipos.some(e=>e.tipo===eq.v)) equipos.push({ tag:"", tipo:eq.v, desc:eq.label+" (mencionado en la descripción)" });
  const existentes = (d["ins-instrumentos"]||[]).map(i=>i.tag);
  let n = maxNumero(existentes);
  const out = [];
  const yaTipos = new Set((d["ins-instrumentos"]||[]).map(i=>String(i.tag||"").replace(/-.*$/,"")));
  for(const e of equipos){
    for(const [r, motivo] of (REGLAS[e.tipo]||[])){
      n++;
      const num = String(n).padStart(3,"0");
      out.push(Object.assign({}, r, { tag:`${r.tipo}-${num}`, ubicacion: e.desc ? (e.tag ? e.tag+" — " : "")+e.desc : e.tag, equipo: e.tag || e.desc, motivo: motivo + (yaTipos.has(r.tipo) ? " Ya existe un instrumento del mismo tipo en el listado: verificar duplicidad." : ""), aprobado:false }));
    }
  }
  out.forEach(o=>{ delete o.tipo; });
  return out;
}

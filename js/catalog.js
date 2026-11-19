/* Ingenia — catálogo de entregables de ingeniería (Electricidad e Instrumentación & Control).
   Fuente: "Listado_de_entregables.xlsx", Hoja 1 "Entregables actuales" (nombres de la columna B y
   comentarios del usuario de la columna C). Se retiraron los entregables no considerados en esa hoja.
   - etapa: conceptual / basica / detalle (no todo se genera con el mismo nivel de información)
   - tipo: "lista" (tabla → Excel), "documento" (texto+tablas → Word), "plano" (DXF/CAD), "calculo" (memoria → Word/Excel)
   - estado de automatización en esta versión:
       "listo"       → tiene entorno propio, vista previa y plantilla por defecto basada en los formatos de referencia
       "parcial"     → se genera la parte tabular/estándar; el resto requiere datos de otras disciplinas
       "planificado" → definido el formulario de datos de entrada, generación en desarrollo
*/
export const DISCIPLINAS = {
  ELE: { id:"ELE", nombre:"Electricidad", corto:"Electricidad", codigo:"07" },
  INS: { id:"INS", nombre:"Instrumentación & Control", corto:"I&C", codigo:"09" },
  GEN: { id:"GEN", nombre:"Transversal (ambas disciplinas)", corto:"General", codigo:"00" },
};

export const ETAPAS = [
  { id:"conceptual", nombre:"Ingeniería conceptual" },
  { id:"basica", nombre:"Ingeniería básica" },
  { id:"detalle", nombre:"Ingeniería de detalle" },
];

// Códigos de tipo de documento usados en la codificación (tomados de los dos proyectos de referencia:
// LIS listado, LDC listado de cables, EL equipos eléctricos, IL equipos de instrumentación, HD hoja de datos,
// MC memoria de cálculo, WD diagrama unifilar/esquemas, DI diagrama (bloques/mecánico), PI P&ID, LJ lazo,
// BJ bloques, PJ..., PL plano general, CR criterios, FC filosofía de control, IO lista E/S, CE causa-efecto).
export const ENTREGABLES = [
  // ---------------- ELECTRICIDAD ----------------
  { id:"ele-cargas", n:1, disciplina:"ELE", tipo:"lista", doc:"LIS", etapas:["conceptual","basica","detalle"], estado:"listo",
    nombre:"Listado de cargas",
    finalidad:"Enlistar las cargas que se conectan a cada tablero de fuerza para obtener la potencia instalada, la máxima demanda y la corriente de máxima demanda.",
    entradas:["TAG y nombre de la carga, tablero al que se conecta","Potencia en HP o kW (unidad seleccionable)","Tensión del proyecto (se define al crear el proyecto)","FDP, EFF, FU y FS: se proponen valores típicos editables"],
    salida:"Excel (carátula + un listado por tablero con PI, MD e I de máxima demanda)" },
  { id:"ele-cables", n:2, disciplina:"ELE", tipo:"lista", doc:"LDC", etapas:["basica","detalle"], estado:"listo",
    nombre:"Listado de cables",
    finalidad:"Enlistar el cable de cada carga (y los alimentadores entre tableros), con el tipo de cable según el nivel de exigencia del cliente final.",
    entradas:["TAG y longitud de cada cable (asignados por el usuario)","Calidad / robustez del cable: estándar, libre de halógenos, norma americana TC-ER o armado","Canalización","Sección: se calcula desde el listado de cargas"],
    salida:"Excel (carátula + listado: tipo, tensión, N° de conductores, sección, desde / hasta, longitudes por canalización)" },
  { id:"ele-equipos", n:3, disciplina:"ELE", tipo:"lista", doc:"EL", etapas:["basica","detalle"], estado:"listo",
    nombre:"Listado de equipos eléctricos",
    finalidad:"Registrar todos los tableros eléctricos del proyecto (fuerza, control, fuerza y control, distribución) con su TAG.",
    entradas:["Tipos y cantidades de tableros (se definen al crear el proyecto)","TAG de cada tablero","Alimentación de cada tablero"],
    salida:"Excel (carátula + listado de equipos con plano de referencia)" },
  { id:"ele-hd", n:4, disciplina:"ELE", tipo:"lista", doc:"HD", etapas:["basica","detalle"], estado:"listo",
    nombre:"Hoja de datos de equipos eléctricos",
    finalidad:"Características eléctricas de los equipos de cada tablero, obtenidas del mismo cálculo que alimenta los unifilares y el listado de cargas.",
    entradas:["Tableros y cargas del proyecto","Condiciones ambientales del sitio","Tensiones y nivel de cortocircuito"],
    salida:"Excel (índice + una hoja de datos por tablero)" },
  { id:"ele-mc", n:5, disciplina:"ELE", tipo:"calculo", doc:"MC", etapas:["basica","detalle"], estado:"listo",
    nombre:"Memoria de cálculo de conductores",
    finalidad:"Validar con sustento técnico la sección de los conductores (ampacidad, caída de tensión) y las protecciones.",
    entradas:["Listado de cargas y listado de cables (sin datos adicionales)","Factores de agrupamiento y de altitud"],
    salida:"Word (procedimiento + cálculo por circuito + anexos)" },
  { id:"ele-md", n:6, disciplina:"ELE", tipo:"calculo", doc:"MC", etapas:["basica","detalle"], estado:"listo",
    nombre:"Memoria de cálculo de máxima demanda",
    finalidad:"Validar con sustento técnico la potencia instalada, la máxima demanda y la corriente de diseño de cada tablero.",
    entradas:["Listado de cargas (sin datos adicionales)"],
    salida:"Word (criterios, factores, cálculo por tablero y anexo)" },
  { id:"ele-unifilar", n:7, disciplina:"ELE", tipo:"plano", doc:"WD", etapas:["conceptual","basica","detalle"], estado:"listo",
    nombre:"Diagrama unifilar del tablero de fuerza",
    finalidad:"Distribución de potencia, barras, alimentadores y protecciones de cada tablero de fuerza / distribución (simbología NEMA / ANSI).",
    entradas:["Listado de cargas","Tensión y nivel de cortocircuito","Tipo de arranque por motor"],
    salida:"DXF (una lámina por tablero)" },
  { id:"ele-multifilar", n:8, disciplina:"ELE", tipo:"plano", doc:"WD", etapas:["detalle"], estado:"listo",
    nombre:"Diagrama multifilar del tablero de fuerza",
    finalidad:"Conexiones de fuerza de cada salida en tres fases (L1-L2-L3-PE): protección, maniobra, bornes y carga, con los mismos dispositivos del unifilar.",
    entradas:["Cálculo del tablero (automático, desde el listado de cargas)"],
    salida:"DXF" },
  { id:"ele-mecanico", n:9, disciplina:"ELE", tipo:"plano", doc:"DI", etapas:["detalle"], estado:"listo",
    nombre:"Diagrama mecánico del tablero de fuerza",
    finalidad:"Disposición física de los componentes del tablero de fuerza: vista frontal, placa de montaje, vista lateral, dimensiones estimadas y lista de componentes.",
    entradas:["Componentes del tablero (automático)","Grado de protección según condiciones ambientales","Marca / modelo del gabinete (opcional)"],
    salida:"DXF" },
  { id:"ins-pid", n:11, disciplina:"INS", tipo:"plano", doc:"PI", etapas:["conceptual","basica","detalle"], estado:"listo",
    nombre:"Diagrama P&ID",
    finalidad:"Diagrama esquemático de proceso e instrumentación (ISA 5.1) generado desde los equipos del proceso y el listado de instrumentos; también recomienda instrumentos.",
    entradas:["Descripción general del proceso","Equipos del proceso","Listado de instrumentos (automático)"],
    salida:"DXF" },
  { id:"ins-instrumentos", n:12, disciplina:"INS", tipo:"lista", doc:"IL", etapas:["basica","detalle"], estado:"listo",
    nombre:"Listado de equipos de instrumentación",
    finalidad:"Instrumentos a utilizar una vez definido el P&ID (incluye los recomendados que el usuario aprueba).",
    entradas:["Instrumentos aprobados del P&ID","Tag, servicio, rango, señal, alimentación y tablero de control"],
    salida:"Excel (carátula + listado)" },
  { id:"ins-hd", n:13, disciplina:"INS", tipo:"lista", doc:"HD", etapas:["basica","detalle"], estado:"listo",
    nombre:"Hoja de datos de instrumentos",
    finalidad:"Características de cada instrumento, generadas desde el listado de instrumentos aprobado.",
    entradas:["Listado de instrumentos (automático)","Condiciones ambientales del sitio (automático)","Condiciones de proceso por instrumento"],
    salida:"Excel (índice + una hoja por instrumento)" },
  { id:"ins-lazo", n:14, disciplina:"INS", tipo:"plano", doc:"LJ", etapas:["detalle"], estado:"listo",
    nombre:"Diagrama de lazo",
    finalidad:"Conexionado de cada lazo desde el instrumento de campo hasta el controlador, con canales del listado I/O.",
    entradas:["Listado de instrumentos y listado I/O (automático)"],
    salida:"DXF (siete lazos por lámina)" },
  { id:"ins-unifilar-tc", n:16, disciplina:"INS", tipo:"plano", doc:"DI", etapas:["basica","detalle"], estado:"listo",
    nombre:"Diagrama unifilar del tablero de control",
    finalidad:"Alimentación, distribución y protecciones de cada tablero de control (24 Vdc, 120 Vac, 220 Vac).",
    entradas:["Instrumentos asignados al tablero (automático)","Configuración del tablero (PLC, HMI, switch…)"],
    salida:"DXF (una lámina por tablero)" },
  { id:"ins-multifilar-tc", n:17, disciplina:"INS", tipo:"plano", doc:"DI", etapas:["detalle"], estado:"listo",
    nombre:"Diagrama multifilar del tablero de control",
    finalidad:"Conexionado de cada módulo de E/S del PLC a sus bornes y a los instrumentos de campo, con el TAG del cable.",
    entradas:["Listado I/O: slot, canal y bornes (automático)","Configuración del tablero de control"],
    salida:"DXF" },
  { id:"ins-mecanico-tc", n:18, disciplina:"INS", tipo:"plano", doc:"DI", etapas:["detalle"], estado:"listo",
    nombre:"Diagrama mecánico del tablero de control",
    finalidad:"Disposición física del tablero de control: PLC y módulos, fuente, relés, borneras, switch y elementos de puerta, con dimensiones estimadas.",
    entradas:["Módulos según el listado I/O (automático)","Configuración del tablero de control","Grado de protección según condiciones ambientales"],
    salida:"DXF" },
  { id:"ins-arquitectura", n:20, ordenCodigo:14.5, disciplina:"INS", tipo:"plano", doc:"BJ", etapas:["basica","detalle"], estado:"listo",
    nombre:"Arquitectura de control",
    finalidad:"Controladores, red, HMI, variadores y dispositivos de campo de cada tablero de control.",
    entradas:["Tableros de control, instrumentos y variadores (automático)"],
    salida:"DXF" },
  { id:"ins-io", n:21, disciplina:"INS", tipo:"lista", doc:"LIS", etapas:["basica","detalle"], estado:"listo",
    nombre:"Listado I/O",
    finalidad:"Validar las entradas y salidas digitales y analógicas de cada controlador, con reserva y módulos requeridos.",
    entradas:["Listado de instrumentos y listado de cargas (automático)"],
    salida:"Excel (lista I/O + resumen de módulos por tipo de señal)" },
  { id:"ins-filosofia", n:23, disciplina:"INS", tipo:"documento", doc:"FC", etapas:["basica","detalle"], estado:"listo",
    nombre:"Filosofía de control",
    finalidad:"Operación general del sistema (primer alcance generado desde el proceso, equipos e instrumentos; luego se pule).",
    entradas:["Descripción del proceso (del P&ID)","Cargas e instrumentos (automático)","Secuencias y notas del usuario (opcional)"],
    salida:"Word" },
  // utilidad interna (no es un entregable del catálogo): lista de documentos del proyecto
  { id:"gen-registro", n:99, disciplina:"GEN", tipo:"lista", doc:"LD", etapas:["conceptual","basica","detalle"], estado:"listo", interno:true,
    nombre:"Lista de documentos del proyecto",
    finalidad:"Códigos, títulos, revisiones y estados de los entregables seleccionados.",
    entradas:["Entregables seleccionados"], salida:"Excel" },
];
export const CATALOGO = ENTREGABLES.filter(e=>!e.interno);

export const ESTADOS = {
  listo: { label:"Disponible", desc:"Se genera ahora con el motor de cálculo." },
  parcial: { label:"Parcial", desc:"Se genera la parte estándar; el resto depende de datos externos." },
  planificado: { label:"En desarrollo", desc:"Formulario de entrada definido; generación próxima versión." },
};

export const TIPOS = { lista:"Listado (Excel)", documento:"Documento (Word)", calculo:"Memoria de cálculo", plano:"Plano (DXF)" };

export function entregablesPor(disciplina, etapa){
  return CATALOGO.filter(e => (!disciplina || e.disciplina===disciplina) && (!etapa || e.etapas.includes(etapa)));
}
export function entregable(id){ return ENTREGABLES.find(e=>e.id===id); }
/* documentos propios de un tablero de control independiente: en un tablero de fuerza y control la etapa de control
   está dentro del mismo tablero y se detalla en su unifilar, su multifilar y su plano mecánico (no hay documentos aparte) */
export const SOLO_TABLERO_CONTROL = ["ins-unifilar-tc","ins-multifilar-tc","ins-mecanico-tc"];
export const aplicaEntregable = (id, tableros) => !SOLO_TABLERO_CONTROL.includes(id) || (tableros||[]).some(t=>t.tipo==="control");

/* ---------------- ruta de trabajo de los documentos ----------------
   Orden de desarrollo recomendado: se parte del proceso (P&ID) y de las cargas, siguen los cálculos y listados que
   dependen de ellos, luego los diagramas, el detalle de los tableros y al final las especificaciones y la filosofía.
   REQUIERE: documentos que conviene tener listos antes (sus datos alimentan al documento). Ninguno se bloquea: la ruta
   orienta al usuario y le dice qué puede elaborar al terminar cada documento. */
export const ETAPAS_TRABAJO = [
  { n:1, titulo:"Punto de partida", desc:"El proceso y las cargas: definen qué se alimenta, qué se mide y qué se controla.", docs:["ins-pid","ele-cargas"] },
  { n:2, titulo:"Cálculos y listados base", desc:"Instrumentos, máxima demanda, conductores, cables y señales.", docs:["ins-instrumentos","ele-md","ele-mc","ele-cables","ins-io"] },
  { n:3, titulo:"Diagramas eléctricos y de control", desc:"Unifilares, arquitectura de control y lazos.", docs:["ele-unifilar","ins-unifilar-tc","ins-arquitectura","ins-lazo"] },
  { n:4, titulo:"Detalle de los tableros", desc:"Multifilares y mecánicos para fabricación.", docs:["ele-multifilar","ins-multifilar-tc","ele-mecanico","ins-mecanico-tc"] },
  { n:5, titulo:"Especificaciones y cierre", desc:"Equipos, hojas de datos y filosofía de control.", docs:["ele-equipos","ele-hd","ins-hd","ins-filosofia"] },
];
export const REQUIERE = {
  "ins-pid":[], "ele-cargas":[],
  "ins-instrumentos":["ins-pid"], "ele-md":["ele-cargas"], "ele-mc":["ele-cargas"], "ele-cables":["ele-mc"], "ins-io":["ins-instrumentos","ele-cargas"],
  "ele-unifilar":["ele-cargas","ele-md"], "ins-unifilar-tc":["ins-io"], "ins-arquitectura":["ins-io"], "ins-lazo":["ins-io"],
  "ele-multifilar":["ele-unifilar"], "ins-multifilar-tc":["ins-unifilar-tc"], "ele-mecanico":["ele-multifilar"], "ins-mecanico-tc":["ins-multifilar-tc"],
  "ele-equipos":["ele-unifilar"], "ele-hd":["ele-mecanico"], "ins-hd":["ins-instrumentos"], "ins-filosofia":["ins-io","ins-pid"],
};
const ORDEN_TRABAJO = ETAPAS_TRABAJO.flatMap(e=>e.docs);
export const ordenTrabajo = id => { const i = ORDEN_TRABAJO.indexOf(id); return i < 0 ? 999 : i; };
export const etapaDe = id => ETAPAS_TRABAJO.find(e=>e.docs.includes(id)) || null;
/* estados de un documento y el que corresponde a cada «emitido para» de su revisión vigente */
export const ESTADOS_DOC = ["Por elaborar","En elaboración","Para revisión","Aprobado","Emitido"];
export const claseEstado = e => ({ "Por elaborar":"est-por", "En elaboración":"est-elab", "Para revisión":"est-rev", "Aprobado":"est-apr", "Emitido":"est-emi" }[e] || "est-por");
export function estadoPorRevision(descripcion){
  const t = String(descripcion||"");
  if(/revisi[oó]n|aprobaci[oó]n/i.test(t)) return "Para revisión";      // revisión interna, del cliente o para aprobación
  if(/construcci[oó]n|conforme a obra/i.test(t)) return "Emitido";
  return null;
}
/* el estado sigue a la revisión vigente: cuando cambia la revisión emitida (o su «emitido para») el estado se actualiza;
   un cambio manual del estado se respeta mientras la revisión siga siendo la misma. Devuelve true si cambió. */
export function sincronizarEstado(d){
  if(!d || !Array.isArray(d.revisiones) || !d.revisiones.length) return false;
  const emitida = d.emitida || d.revisiones.length > 1;
  if(!emitida) return false;
  const last = d.revisiones[d.revisiones.length-1], clave = `${last.rev}|${last.descripcion||""}`;
  if(d.estadoDe===clave) return false;
  const est = estadoPorRevision(last.descripcion);
  d.estadoDe = clave;
  if(est && d.estado!==est){ d.estado = est; return true; }
  return true;
}
/* documento terminado: emitido o enviado a revisión / aprobado */
export const docListo = d => !!d && (["Para revisión","Aprobado","Emitido"].includes(d.estado) || !!d.emitida);
/* requisitos entre los documentos seleccionados del proyecto: si un requisito no se elabora en el proyecto, se toman los
   suyos (p. ej. el listado de cables sin memoria de conductores depende del listado de cargas) */
export function requisitos(p, id, _vistos){
  const sel = new Set(p.entregables||[]), vistos = _vistos || new Set([id]), out = [];
  for(const x of REQUIERE[id]||[]){
    if(vistos.has(x)) continue; vistos.add(x);
    for(const y of sel.has(x) ? [x] : requisitos(p, x, vistos)) if(!out.includes(y)) out.push(y);
  }
  return out.sort((a, b)=>ordenTrabajo(a) - ordenTrabajo(b));
}
/* documentos seleccionados que toman datos de este */
export function habilita(p, id){ return (p.entregables||[]).filter(x=>REQUIERE[x] && requisitos(p, x).includes(id)).sort((a, b)=>ordenTrabajo(a) - ordenTrabajo(b)); }

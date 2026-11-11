/* Ingenia — documentos de criterios (Word): criterios de diseño eléctrico, criterios de I&C y memoria
   descriptiva. Se arman como secciones de texto a partir de los parámetros del proyecto (p.diseno) y se
   vuelcan en la plantilla Word estándar (assets/plantillas/estandar_documento.docx) o en la del cliente.
   Los textos son bases de diseño genéricas y parametrizadas: el ingeniero debe revisarlas y completarlas. */

export const PARAMETROS_DISENO = [
  { grupo:"Suministro y sistema eléctrico", campos:[
    { key:"tension", label:"Tensión de fuerza (V)", tipo:"select", opciones:["220","380","440","460","480","600","690"], def:"460" },
    { key:"frecuencia", label:"Frecuencia (Hz)", tipo:"select", opciones:["50","60"], def:"60" },
    { key:"tensionControl", label:"Tensión de control (VAC)", tipo:"select", opciones:["120","220"], def:"120" },
    { key:"tensionInstr", label:"Tensión de instrumentación (VDC)", tipo:"text", def:"24" },
    { key:"puestaTierra", label:"Sistema de puesta a tierra", tipo:"select", opciones:["Sólidamente aterrado (TN-S)","Aterrado por resistencia (NGR)","Aislado (IT)"], def:"Sólidamente aterrado (TN-S)" },
    { key:"icc", label:"Nivel de cortocircuito en el punto de conexión (kA)", tipo:"number", def:"25" },
  ]},
  { grupo:"Condiciones ambientales del sitio", campos:[
    { key:"ubicacion", label:"Ubicación (región / distrito)", tipo:"text", def:"" },
    { key:"altitud", label:"Altitud (m s.n.m.)", tipo:"number", def:"1000" },
    { key:"tempMin", label:"Temperatura mínima (°C)", tipo:"number", def:"0" },
    { key:"tempMax", label:"Temperatura máxima (°C)", tipo:"number", def:"35" },
    { key:"tempDiseno", label:"Temperatura ambiente de diseño (°C)", tipo:"number", def:"40" },
    { key:"humedad", label:"Humedad relativa máxima (%)", tipo:"number", def:"" },
    { key:"ambiente", label:"Instalación de los equipos", tipo:"select", opciones:["Interior (sala eléctrica)","Interior industrial","Exterior bajo techo","Exterior a la intemperie"], def:"Exterior bajo techo" },
    { key:"contaminacion", label:"Contaminación del ambiente", tipo:"select", opciones:["Normal","Polvo no conductivo","Polvo conductivo / minero","Corrosivo (químico)","Salino (zona costera)"], def:"Polvo no conductivo" },
    { key:"areaClasificada", label:"Área clasificada (NEC 500)", tipo:"select", opciones:["No clasificada","Clase I, División 1","Clase I, División 2","Clase II, División 1","Clase II, División 2"], def:"No clasificada" },
    { key:"gradoProteccion", label:"Grado de protección de gabinetes", tipo:"select", opciones:["Automático según ambiente","NEMA 12 (≈ IP52)","NEMA 4 (≈ IP66)","NEMA 4X (≈ IP66), acero inoxidable","NEMA 7 (a prueba de explosión)","NEMA 9 (a prueba de ignición de polvo)"], def:"Automático según ambiente" },
    { key:"sismo", label:"Zona sísmica / aceleración (opcional)", tipo:"text", def:"" },
  ]},
  { grupo:"Criterios de dimensionamiento", campos:[
    { key:"norma", label:"Norma principal de referencia", tipo:"select", opciones:["NEC (NFPA 70) 2023","CNE Utilización (Perú) + NEC","IEC 60364"], def:"NEC (NFPA 70) 2023" },
    { key:"corrienteMotores", label:"Corriente nominal de motores", tipo:"select", opciones:["NEC Tabla 430.250","Catálogo IEC (ABB)"], def:"NEC Tabla 430.250" },
    { key:"columnaAmpacidad", label:"Ampacidad de conductores (NEC 310.16)", tipo:"select", opciones:["90 °C con verificación a 75 °C en terminales","75 °C"], def:"90 °C con verificación a 75 °C en terminales" },
    { key:"seccionMinima", label:"Sección mínima de conductores de fuerza", tipo:"select", opciones:["14 AWG","12 AWG","10 AWG"], def:"12 AWG" },
    { key:"caidaTension", label:"Caída de tensión admisible en ramales (%)", tipo:"number", def:"2.5" },
    { key:"caidaAlimentador", label:"Caída de tensión admisible en alimentadores (%)", tipo:"number", def:"2" },
    { key:"reservaTablero", label:"Reserva de espacio en tableros (%)", tipo:"number", def:"20" },
    { key:"reservaIO", label:"Reserva de canales I/O (%)", tipo:"number", def:"30" },
    { key:"tagStd", label:"Estándar de identificación de instrumentos", tipo:"select", opciones:["ISA 5.1","Codificación del cliente"], def:"ISA 5.1" },
    { key:"plc", label:"Plataforma de control prevista", tipo:"text", def:"PLC (a definir con el cliente)" },
  ]},
];

export function valoresDiseno(p){
  const d = Object.assign({}, p.diseno||{});
  for(const g of PARAMETROS_DISENO) for(const c of g.campos) if(d[c.key]==null || d[c.key]==="") d[c.key] = c.def;
  return d;
}

export function seccionesCriteriosElectricos(p){
  const d = valoresDiseno(p);
  return [
    { titulo:"1. Objetivo y alcance", texto:`Establecer las bases y criterios de diseño eléctrico aplicables a la ${(p.etapaNombre||"ingeniería de detalle").toLowerCase()} del proyecto "${p.nombre}" para ${p.cliente||"el cliente"}${p.unidad?" — "+p.unidad:""}. Cubre la distribución en baja tensión, la selección de conductores y protecciones, los tableros de fuerza y control y la puesta a tierra de los equipos del alcance.`, items:[] },
    { titulo:"2. Códigos y normas de referencia", texto:"Se aplican las últimas ediciones vigentes de:", items:[
      d.norma, "NFPA 70 – National Electrical Code (artículos 215, 240, 250, 310, 430 y Tablas 310.16, 250.122, 430.52)",
      "IEC 60947 – Aparamenta de baja tensión (interruptores, contactores, relés de sobrecarga, arrancadores)",
      "IEC 61439-1/2 – Conjuntos de aparamenta de baja tensión (tableros)", "IEC 60502-1 – Cables de potencia 0,6/1 kV", "IEEE 141 / IEEE 242 – Distribución industrial y coordinación de protecciones",
      "Código Nacional de Electricidad – Utilización (Perú), en lo aplicable", "Estándares y especificaciones del cliente que prevalecen sobre los anteriores cuando sean más exigentes." ] },
    { titulo:"3. Sistema eléctrico", texto:`Tensión de fuerza ${d.tension} V, 3 fases, ${d.frecuencia} Hz, sistema ${d.puestaTierra.toLowerCase()}. Tensión de control ${d.tensionControl} VAC obtenida de transformador de control dedicado en cada tablero; tensión de instrumentación ${d.tensionInstr} VDC. Nivel de cortocircuito disponible en el punto de conexión: ${d.icc} kA (dato del cliente; todos los dispositivos de protección tendrán capacidad de interrupción Icu/Ics igual o superior).`, items:[] },
    { titulo:"4. Condiciones de sitio", texto:`${d.ubicacion?("Ubicación: "+d.ubicacion+". "):""}Altitud ${d.altitud} m s.n.m. Temperatura ambiente entre ${d.tempMin} °C y ${d.tempMax} °C; temperatura de diseño ${d.tempDiseno} °C. Ambiente: ${d.ambiente.toLowerCase()}.`, items:[
      "Los equipos electrónicos de potencia (variadores, arrancadores suaves) se derratean 1 % por cada 100 m sobre 1000 m s.n.m. y 1 % por °C sobre 40 °C, en forma multiplicativa.",
      "El grado de protección mínimo de gabinetes se define según el ambiente indicado; en zonas con polvo se exige IP65 / NEMA 4X." ] },
    { titulo:"5. Cargas y demanda", texto:"La potencia instalada (PI) se calcula como la suma de la potencia aparente de cada carga con factor de utilización y simultaneidad iguales a 1; la máxima demanda (MD) aplica los factores FU y FS declarados por carga. La corriente de máxima demanda se incrementa en 25 % por continuidad de carga (NEC 215.2(A)(1)) para el dimensionamiento de alimentadores.", items:[
      "Corrientes nominales de motores según tabla IEC de motores jaula de ardilla de 4 polos; se verificará contra placa.",
      "Las cargas de reserva (standby) con FU = 0 no aportan a la demanda ni al criterio de protección principal." ] },
    { titulo:"6. Protecciones", texto:"Las protecciones se seleccionan según el tipo de arranque:", items:[
      "Motor con arranque directo (DOL): guardamotor hasta 100 A; sobre ese valor, interruptor termomagnético de tiempo inverso al 250 % de la corriente nominal (NEC Tabla 430.52), contactor y relé de sobrecarga de clase según la aplicación.",
      "Motor con variador de frecuencia: interruptor al 125 % de la corriente nominal de entrada del variador (NEC 430.122) más fusibles aR semiconductores según tabla del fabricante del variador; reactores de línea y de carga.",
      "Motor con arrancador suave: interruptor al 125 % (NEC 430.122), portafusible con fusible de tiempo diferido al 175 % (NEC Tabla 430.52), contactor de línea y relé de sobrecarga.",
      "Interruptor principal: el mayor entre el criterio NEC 430.62(A) y la corriente de máxima demanda × 1,25.",
      "Protección contra sobretensiones transitorias Tipo 1+2 en la acometida de cada tablero y relé de supervisión de fases." ] },
    { titulo:"7. Conductores", texto:`Los conductores de fuerza se dimensionan al 125 % de la corriente nominal (NEC 430.22) sobre la tabla de ampacidad NEC 310.16 (cobre, 75 °C, ≤ 3 conductores activos) con corrección por temperatura ambiente de ${d.tempDiseno} °C. Caída de tensión admisible: ${d.caidaTension} % en circuitos ramales y ${d.caidaAlimentador} % en alimentadores. Conductor de puesta a tierra de equipos según NEC Tabla 250.122.`, items:[
      "Cables de potencia 0,6/1 kV, cobre clase 5, aislamiento XLPE, cubierta libre de halógenos (tipo RZ1-K) o PVC (tipo RV-K) según requerimiento del cliente.",
      "Cables de control y señal apantallados tipo Z1C4Z1-K 300/500 V para mando e instrumentación; pantalla conectada a tierra en un solo extremo (tablero)." ] },
    { titulo:"8. Tableros", texto:`Tableros de fuerza y control conforme a IEC 61439, con reserva de espacio mínima de ${d.reservaTablero} %. Zona de potencia y zona de control segregadas en placas independientes; canaletas ranuradas dimensionadas al 40 % de llenado; entradas de cables por la parte inferior con prensaestopas del grado IP del gabinete.`, items:[] },
    { titulo:"9. Documentación de diseño", texto:"Los entregables se emiten según la lista de documentos del proyecto, con la codificación del cliente y control de revisiones. La generación automática de Ingenia no reemplaza la revisión y aprobación de un ingeniero competente: cada documento indica supuestos, datos faltantes y norma/edición aplicada.", items:[] },
  ];
}

export function seccionesCriteriosIC(p){
  const d = valoresDiseno(p);
  return [
    { titulo:"1. Objetivo y alcance", texto:`Definir los criterios de diseño de instrumentación y control para la ${(p.etapaNombre||"ingeniería de detalle").toLowerCase()} del proyecto "${p.nombre}" (${p.cliente||"cliente"}${p.unidad?" — "+p.unidad:""}): identificación de instrumentos, señales, selección e instalación, alarmas, control y documentación.`, items:[] },
    { titulo:"2. Normas de referencia", texto:"Se aplican las últimas ediciones vigentes de:", items:[
      "ISA 5.1 – Identificación y símbolos de instrumentación", "ISA 5.4 – Diagramas de lazo", "ISA 20 – Hojas de datos de instrumentos", "ISA 18.2 – Gestión de alarmas",
      "IEC 61131-3 – Lenguajes de programación de PLC", "IEC 61158 / IEC 61784 – Buses de campo industriales", "IEC 60529 – Grados de protección IP", "Estándares del cliente que prevalecen cuando sean más exigentes." ] },
    { titulo:"3. Identificación de instrumentos", texto:`Los instrumentos se identifican según ${d.tagStd}: letras funcionales (primera letra variable medida, letras siguientes función) y número de lazo correlativo por sistema. Los tags se mantienen únicos en todo el proyecto y se referencian en el P&ID, el índice de instrumentos, las hojas de datos, la lista de E/S y los diagramas de lazo.`, items:[] },
    { titulo:"4. Señales y alimentación", texto:`Señales analógicas de 4–20 mA (con HART cuando el instrumento lo permita), a 2 hilos alimentadas desde el lazo (${d.tensionInstr} VDC) o a 4 hilos con alimentación externa. Señales discretas por contacto seco libre de potencial o ${d.tensionInstr} VDC. Comunicaciones industriales (Modbus, PROFINET, EtherNet/IP) para equipos paquete y variadores.`, items:[
      `Reserva de canales de E/S: ${d.reservaIO} % por tipo de señal, con al menos un módulo de reserva por tipo cuando el tablero lo permita.`,
      "Cables de instrumentación apantallados (par o terna trenzada), pantalla aterrada solo en el tablero de control." ] },
    { titulo:"5. Sistema de control", texto:`Plataforma de control: ${d.plc}. La arquitectura, redundancia y límites de suministro se definen en el diagrama de arquitectura del sistema de control. La lógica se documenta en la filosofía de control y en la matriz causa-efecto.`, items:[] },
    { titulo:"6. Condiciones de sitio e instalación", texto:`Altitud ${d.altitud} m s.n.m.; temperatura ${d.tempMin} a ${d.tempMax} °C; ambiente ${d.ambiente.toLowerCase()}. Los instrumentos de campo tendrán grado de protección mínimo IP65 y se instalarán según típicos de montaje por familia (presión, temperatura, nivel, caudal, válvulas).`, items:[] },
    { titulo:"7. Documentación", texto:"Índice de instrumentos, hojas de datos (una por tipo de instrumento), lista de E/S con resumen de módulos, diagramas de lazo y filosofía de control se emiten con la codificación del cliente y control de revisiones del proyecto. La generación automática no reemplaza la revisión y aprobación de un ingeniero competente.", items:[] },
  ];
}

export function seccionesMemoriaDescriptiva(p, catalogo){
  const d = valoresDiseno(p);
  const sel = (p.entregables||[]).map(id=>catalogo.find(e=>e.id===id)).filter(Boolean);
  return [
    { titulo:"1. Generalidades", texto:`${p.descripcion || `El presente documento describe el alcance de la ${(p.etapaNombre||"ingeniería de detalle").toLowerCase()} de las disciplinas de Electricidad e Instrumentación & Control del proyecto "${p.nombre}" para ${p.cliente||"el cliente"}${p.unidad?" ("+p.unidad+")":""}.`}`, items:[] },
    { titulo:"2. Condiciones de sitio", texto:`${d.ubicacion?("Ubicación: "+d.ubicacion+". "):""}Altitud ${d.altitud} m s.n.m.; temperatura ambiente ${d.tempMin} a ${d.tempMax} °C (diseño ${d.tempDiseno} °C); ambiente ${d.ambiente.toLowerCase()}.`, items:[] },
    { titulo:"3. Sistema eléctrico", texto:`Suministro en ${d.tension} V, ${d.frecuencia} Hz, ${d.puestaTierra.toLowerCase()}; nivel de cortocircuito ${d.icc} kA. Control en ${d.tensionControl} VAC e instrumentación en ${d.tensionInstr} VDC.`, items:[] },
    { titulo:"4. Alcance de entregables", texto:"La ingeniería comprende los siguientes documentos y planos:", items: sel.map(e=>`${(p.documentos&&p.documentos[e.id]&&p.documentos[e.id].codigo)||""} — ${e.nombre}`) },
    { titulo:"5. Criterios aplicados", texto:`Norma principal ${d.norma}; caída de tensión admisible ${d.caidaTension} % (ramales) y ${d.caidaAlimentador} % (alimentadores); reserva de espacio en tableros ${d.reservaTablero} %; reserva de E/S ${d.reservaIO} %. El detalle se encuentra en los criterios de diseño de cada disciplina.`, items:[] },
  ];
}

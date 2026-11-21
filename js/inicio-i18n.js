/* Ingenia — idioma de la página de inicio (ES / EN). Se traduce cada texto de la página (nodos de texto y atributos
   alt / aria-label / title / data-t / data-d), así se conservan las negritas, los enlaces y las cifras animadas. El idioma
   elegido se recuerda en el navegador (clave «ingenia.idioma»); la plataforma (app.html) lo sigue con js/app-i18n.js. */

const EN = {
  "Saltar al contenido":"Skip to content",
  "Cómo funciona":"How it works", "Entregables":"Deliverables", "Planes":"Plans", "Entrar":"Sign in", "a la plataforma":"to the platform",
  "Electricidad · Instrumentación & Control":"Electrical · Instrumentation & Control",
  "Ingeniería eléctrica e instrumentación,":"Electrical and instrumentation engineering,", "generada desde los datos":"generated from your data",
  "Ingresa cargas, tensiones e instrumentos una sola vez. Ingenia arma listados, memorias de cálculo y planos en":"Enter loads, voltages and instruments only once. Ingenia builds lists, calculation reports and drawings in",
  "y":"and", ", y":", and", "DXF para AutoCAD":"DXF for AutoCAD",
  ", tu asesor en tiempo real, aplica en el momento los cambios que le pidas.":", your real-time advisor, applies the changes you ask for on the spot.",
  "Entrar a la plataforma":"Go to the platform", "Ver cómo funciona":"See how it works", "Prueba gratis de 14 días, sin tarjeta.":"14-day free trial, no card required.",
  "Planos para AutoCAD":"Drawings for AutoCAD", "Todos, también en PDF":"Everything, also in PDF", "ingenIA · proyecto demostrativo":"ingenIA · demo project",
  "Diagrama unifilar del tablero de fuerza, en la vista previa de la plataforma (DXF para AutoCAD)":"Single-line diagram of the power panel, in the platform preview (DXF for AutoCAD)",
  "Copito aplica un cambio en el plano y lista los entregables actualizados":"Copito applies a change to the drawing and lists the updated deliverables",
  "Multifilar del tablero de control: conexionado de las entradas analógicas del PLC (DXF)":"Control panel wiring diagram: PLC analog input connections (DXF)",
  "P&ID con simbología ISA 5.1, en la vista previa de la plataforma (DXF)":"P&ID with ISA 5.1 symbols, in the platform preview (DXF)",
  "Tablero de control en 3D, con el mismo arreglo del plano 2D":"Control panel in 3D, with the same layout as the 2D drawing",
  "Listado de cargas con máxima demanda (Excel)":"Load list with maximum demand (Excel)", "Documentos por etapas y estado de cada revisión":"Documents by stage and status of each revision",
  "Resumen y avance del proyecto":"Project summary and progress", "Vista previa en la plataforma · se descarga en DXF para AutoCAD":"Preview in the platform · downloads as DXF for AutoCAD",
  "Capturas de la plataforma con un proyecto demostrativo (datos ficticios).":"Platform screenshots with a demo project (fictitious data).",
  "Ingenia en cifras":"Ingenia in numbers", "entregables de ingeniería automatizados":"automated engineering deliverables",
  "formatos de salida: Excel, Word y DXF para AutoCAD":"output formats: Excel, Word and DXF for AutoCAD", "disciplinas: Electricidad e Instrumentación & Control":"disciplines: Electrical and Instrumentation & Control",
  "familias de PLC de Allen-Bradley, Siemens y Schneider Electric":"PLC families from Allen-Bradley, Siemens and Schneider Electric", "marcas de equipos para elegir en los tableros":"equipment brands to choose for the panels",
  "Cifras de la versión actual de la plataforma.":"Figures for the current version of the platform.",
  "Entregables listos para emitir":"Deliverables ready to issue", "Excel, Word y planos para AutoCAD":"Excel, Word and drawings for AutoCAD",
  "Cada entregable se descarga en el formato estándar de Ingenia, con carátula o cajetín, logos y control de revisiones. Los archivos se abren y se editan en tus programas de siempre, y cada uno también se descarga en":"Each deliverable downloads in Ingenia's standard format, with cover sheet or title block, logos and revision control. The files open and edit in the programs you already use, and each one also downloads as",
  "listo para enviar o imprimir.":"ready to send or print.", "listados y hojas de datos":"lists and datasheets",
  "Libros con carátula, logos y revisiones. Cada fórmula se guarda con su resultado, así se lee bien en cualquier visor.":"Workbooks with cover sheet, logos and revisions. Every formula is saved with its result, so it reads correctly in any viewer.",
  "Listados de cargas, cables, equipos e instrumentos":"Load, cable, equipment and instrument lists", "Listado I/O con resumen de módulos":"I/O list with module summary",
  "Hojas de datos de equipos eléctricos e instrumentos":"Datasheets for electrical equipment and instruments", "memorias y documentos":"reports and documents",
  "Documentos con índice, tablas y figuras, con la estructura de una ingeniería de detalle.":"Documents with table of contents, tables and figures, structured like a detailed engineering package.",
  "Memoria de cálculo de conductores":"Conductor sizing calculation report", "Memoria de cálculo de máxima demanda":"Maximum demand calculation report",
  "Filosofía de control: alarmas, set points, interlocks y secuencias":"Control philosophy: alarms, set points, interlocks and sequences",
  "Planos DXF para AutoCAD":"DXF drawings for AutoCAD", "tipos de plano":"drawing types", "Planos en":"Drawings in",
  ", en lámina A1 con cajetín, capas y colores: se abren en AutoCAD y se guardan como DWG.":", on A1 sheets with title block, layers and colors: they open in AutoCAD and save as DWG.",
  "Unifilares y multifilares de tableros de fuerza y de control":"Single-line and wiring diagrams of power and control panels", "Planos mecánicos de tableros, con vista 3D":"Panel mechanical drawings, with 3D view",
  "P&ID, diagramas de lazo y arquitectura de control":"P&ID, loop diagrams and control architecture",
  "Tres pasos, un solo origen de datos":"Three steps, a single source of data",
  "Cada dato se ingresa una vez y se propaga a todos los documentos: si cambia una carga, cambian el listado, la memoria, el unifilar y el tablero.":"Each piece of data is entered once and flows to every document: if a load changes, the list, the report, the single-line diagram and the panel change too.",
  "Define el proyecto":"Define the project", "Cliente, tensiones de fuerza y de control, condiciones del sitio y tableros, en un asistente de cuatro pasos.":"Client, power and control voltages, site conditions and panels, in a four-step wizard.",
  "Completa cada documento":"Complete each document",
  "Datos de entrada → vista previa → cajetín. Protecciones, cables, demanda y canales I/O se calculan solos, y la ruta de trabajo te indica qué sigue.":"Input data → preview → title block. Protections, cables, demand and I/O channels are calculated automatically, and the workflow tells you what comes next.",
  "Emite y descarga":"Issue and download", "Emite la revisión de cada documento y descárgalo en Excel, Word o DXF para AutoCAD, o en PDF.":"Issue each document's revision and download it in Excel, Word or DXF for AutoCAD, or as PDF.",
  "Copito · asesor en tiempo real":"Copito · real-time advisor", "Pide el cambio. Copito lo hace en el momento.":"Ask for the change. Copito makes it on the spot.",
  "Copito es tu asesor personalizado dentro de la plataforma: conoce tu proyecto y el documento que tienes abierto. Le pides el cambio en lenguaje natural, te muestra la propuesta, la aplicas y se actualizan todos los entregables relacionados.":"Copito is your personal advisor inside the platform: it knows your project and the document you have open. You ask for the change in plain language, it shows you the proposal, you apply it and every related deliverable is updated.",
  "Lo pides con tus palabras":"Ask in your own words", "«Agrega una reserva de 24 Vdc en":"“Add a 24 Vdc spare in",
  "», «Pon el PLC Siemens», «Mueve PS1 a la derecha». Con doble clic sobre un TAG del plano, Copito se abre con ese equipo.":"”, “Use the Siemens PLC”, “Move PS1 to the right”. Double-click a TAG on the drawing and Copito opens with that device.",
  "Copito lo propone":"Copito proposes it", "Te muestra qué va a cambiar y su impacto: máxima demanda, corriente, interruptor general, señales I/O.":"It shows you what will change and its impact: maximum demand, current, main breaker, I/O signals.",
  "Lo aplicas":"You apply it", "Nada cambia hasta que confirmas, y puedes deshacerlo.":"Nothing changes until you confirm, and you can undo it.",
  "Se actualiza todo":"Everything updates", "Unifilar, multifilar, mecánico 2D y 3D, listados y hojas de datos salen del mismo juego de datos y se regeneran con enlace a cada uno.":"Single-line, wiring, 2D and 3D mechanical drawings, lists and datasheets come from the same data set and are regenerated, with a link to each one.",
  "Asesor de tus proyectos":"Your projects' advisor", "En tu navegador":"In your browser", "Agrega una reserva de 24 Vdc en TC-001":"Add a 24 Vdc spare in TC-001",
  "Esto es lo que voy a cambiar en":"This is what I will change in", "Colector de polvos":"Dust collector", ": agregar un circuito de":": add a", "«Reserva» con fusible de":"“Spare” circuit with a fuse of",
  "Aplicar":"Apply", "Cancelar":"Cancel", "Listo, cambios aplicados.":"Done, changes applied.", "Entregables actualizados (5)":"Updated deliverables (5)", "Deshacer":"Undo",
  "Ejemplo real con el proyecto demostrativo.":"Real example with the demo project.", "Qué puede cambiar":"What it can change", "Cargas e instrumentos":"Loads and instruments",
  "Circuitos del tablero de control":"Control panel circuits", "PLC, HMI, switch y router":"PLC, HMI, switch and router", "Arreglo mecánico 2D y 3D":"2D and 3D mechanical layout",
  "Cajetín y revisiones":"Title block and revisions", "Notas de los planos":"Drawing notes", "Equipos del P&ID":"P&ID equipment", "Alarmas, set points e interlocks":"Alarms, set points and interlocks",
  "Copito trabaja en tu navegador con un motor propio: tus proyectos no se envían a ningún servidor. El modo con IA es opcional.":"Copito runs in your browser with its own engine: your projects are not sent to any server. The AI mode is optional.",
  "Entregables por disciplina":"Deliverables by discipline",
  "Basados en una ingeniería de detalle real de minería y ordenados en una ruta de trabajo: del P&ID y el listado de cargas a los planos de detalle de cada tablero.":"Based on a real detailed engineering package for mining and ordered in a workflow: from the P&ID and the load list to the detailed drawings of each panel.",
  "Electricidad":"Electrical", "entregables":"deliverables", "Instrumentación & Control":"Instrumentation & Control",
  "Gestión documental incluida":"Document management included",
  "Ruta de trabajo por etapas con lo que requiere cada documento, control de revisiones con el estado de cada entregable y lista de documentos del proyecto.":"Workflow by stages with what each document requires, revision control with the status of each deliverable, and the project document list.",
  "Elige cómo trabajar con Ingenia":"Choose how to work with Ingenia",
  "Precios por cuenta, en dólares, con pago mensual. Pagando el año completo obtienes 2 meses gratis.":"Prices per account, in US dollars, billed monthly. Pay for the full year and get 2 months free.",
  "Prueba":"Trial", "Gratis":"Free", "14 días":"14 days", "1 proyecto":"1 project", "Todos los entregables":"All deliverables", "Copito con tus datos":"Copito with your data", "Sin tarjeta":"No card required",
  "Probar gratis":"Try for free", "Recomendado":"Recommended", "Profesional":"Professional", "/ mes":"/ month", "1 usuario":"1 user", "Proyectos ilimitados":"Unlimited projects",
  "Excel, Word y planos DXF para AutoCAD":"Excel, Word and DXF drawings for AutoCAD", "Logo del cliente":"Client logo", "Empezar ahora":"Start now", "Equipo":"Team",
  "Hasta 3 usuarios (US$ 25 por usuario adicional)":"Up to 3 users (US$ 25 per additional user)", "Proyectos compartidos":"Shared projects", "Todo lo del plan Profesional":"Everything in the Professional plan",
  "Copito con IA":"Copito with AI", "Empresa":"Enterprise", "A medida":"Custom", "Usuarios ilimitados":"Unlimited users", "Logo y firmas de la organización en todos los entregables":"Organization logo and signatures on every deliverable",
  "Capacitación y soporte prioritario":"Training and priority support", "Factura":"Invoice",
  "El acceso y el pago se harán con tu cuenta de Google desde «Entrar». Los precios no incluyen impuestos.":"Sign-in and payment will be with your Google account from “Sign in”. Prices do not include taxes.",
  "Tu próxima ingeniería de E&I, desde los datos.":"Your next E&I engineering package, from your data.", "Listados, memorias y planos coherentes entre sí, con Copito a tu lado para cada cambio.":"Lists, reports and drawings consistent with each other, with Copito by your side for every change.",
  "Ingeniería de Electricidad e Instrumentación & Control, generada desde los datos.":"Electrical and Instrumentation & Control engineering, generated from your data.", "Ingenia. Todos los derechos reservados.":"Ingenia. All rights reserved.",
  // entregables del catálogo
  "Listado de cargas":"Load list", "Listado de cables":"Cable list", "Listado de equipos eléctricos":"Electrical equipment list", "Hoja de datos de equipos eléctricos":"Electrical equipment datasheet",
  "Diagrama unifilar del tablero de fuerza":"Power panel single-line diagram", "Diagrama multifilar del tablero de fuerza":"Power panel wiring diagram", "Diagrama mecánico del tablero de fuerza":"Power panel mechanical drawing",
  "Diagrama P&ID":"P&ID diagram", "Listado de equipos de instrumentación":"Instrumentation equipment list", "Hoja de datos de instrumentos":"Instrument datasheet", "Diagrama de lazo":"Loop diagram",
  "Diagrama unifilar del tablero de control":"Control panel single-line diagram", "Diagrama multifilar del tablero de control":"Control panel wiring diagram", "Diagrama mecánico del tablero de control":"Control panel mechanical drawing",
  "Arquitectura de control":"Control architecture", "Listado I/O":"I/O list", "Filosofía de control":"Control philosophy",
  // atributos (alt, aria-label, carrusel)
  "Principal":"Main", "Ingenia, inicio":"Ingenia, home", "Formatos de descarga":"Download formats", "Vistas de la plataforma con un proyecto demostrativo":"Platform views with a demo project",
  "Vista previa del diagrama unifilar del tablero de fuerza dentro de la plataforma, con el menú lateral y las pestañas Datos de entrada, Vista previa y Cajetín y descarga":"Preview of the power panel single-line diagram inside the platform, with the side menu and the Input data, Preview and Title block and download tabs",
  "Copito aplica un cambio en el plano":"Copito applies a change to the drawing", "Pides el cambio, lo apruebas y se actualizan los entregables relacionados":"You ask for the change, approve it and the related deliverables are updated",
  "Copito aplicando un cambio sobre el unifilar del tablero de control y listando los entregables actualizados":"Copito applying a change to the control panel single-line diagram and listing the updated deliverables",
  "Conexionado de las entradas analógicas del PLC · DXF para AutoCAD":"PLC analog input connections · DXF for AutoCAD",
  "Vista previa del multifilar del tablero de control, hoja de entradas analógicas del PLC, dentro de la plataforma":"Preview of the control panel wiring diagram, PLC analog inputs sheet, inside the platform",
  "Simbología ISA 5.1, desde los equipos del proceso y los instrumentos · DXF":"ISA 5.1 symbols, from the process equipment and instruments · DXF", "Vista previa del P&ID con instrumentos ISA dentro de la plataforma":"Preview of the P&ID with ISA instruments inside the platform",
  "Tablero de control en 3D":"Control panel in 3D", "El mismo arreglo del plano mecánico 2D, con sus equipos reales":"The same layout as the 2D mechanical drawing, with its real equipment", "Vista 3D del tablero de control con sus equipos":"3D view of the control panel with its equipment",
  "Potencia instalada y máxima demanda por tablero · se descarga en Excel":"Installed power and maximum demand per panel · downloads in Excel", "Vista previa del listado de cargas con la máxima demanda":"Preview of the load list with maximum demand",
  "Ruta de trabajo y revisiones":"Workflow and revisions", "Documentos por etapas, con lo que requiere cada uno y su estado según la revisión":"Documents by stage, with what each one requires and its status by revision",
  "Lista de documentos del proyecto ordenada por etapas, con revisiones emitidas":"Project document list ordered by stage, with issued revisions", "Resumen del proyecto":"Project summary",
  "Avance, datos generales y tableros de un vistazo":"Progress, general data and panels at a glance", "Resumen de un proyecto con su avance":"Summary of a project with its progress",
  "Vista anterior":"Previous view", "Vista siguiente":"Next view", "Ejemplo de conversación con Copito":"Example conversation with Copito", "Pie de página":"Footer",
  // título y descripción de la página
  "Ingenia — Ingeniería eléctrica e instrumentación automatizada":"Ingenia — Automated electrical and instrumentation engineering",
  "Ingenia genera los entregables de ingeniería de Electricidad e Instrumentación & Control a partir de pocos datos: listados y hojas de datos en Excel, memorias de cálculo en Word y planos DXF para AutoCAD, con Copito, un asesor que aplica tus cambios en tiempo real.":"Ingenia generates Electrical and Instrumentation & Control engineering deliverables from a few inputs: lists and datasheets in Excel, calculation reports in Word and DXF drawings for AutoCAD, with Copito, an advisor that applies your changes in real time.",
};

const ATRIBUTOS = ["alt", "aria-label", "title", "data-t", "data-d", "placeholder"];
const norm = s => s.replace(/\s+/g, " ").trim();
const CLAVE = "ingenia.idioma";
export function idiomaGuardado(){ try{ return localStorage.getItem(CLAVE) === "en" ? "en" : "es"; }catch(e){ return "es"; } }

/* traduce (o devuelve al español) todos los textos de la página; los originales se guardan en el propio nodo */
export function aplicarIdioma(lang, raiz = document.body){
  const en = lang === "en";
  try{ localStorage.setItem(CLAVE, lang); }catch(e){}
  document.documentElement.lang = en ? "en" : "es-PE";
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT); let n;
  while((n = w.nextNode())){
    if(n.parentElement && n.parentElement.closest("script,style")) continue;
    if(n._es == null){ const k = norm(n.textContent); if(!k || !(k in EN)) continue; n._es = n.textContent; }
    const k = norm(n._es), pre = n._es.match(/^\s*/)[0], post = n._es.match(/\s*$/)[0];
    n.textContent = en ? pre + EN[k] + post : n._es;
  }
  for(const el of raiz.querySelectorAll(ATRIBUTOS.map(a=>`[${a}]`).join(","))){
    el._es = el._es || {};
    for(const a of ATRIBUTOS){
      if(!el.hasAttribute(a)) continue;
      if(el._es[a] == null){ const v = norm(el.getAttribute(a)); if(!(v in EN) && !/^Vista \d+: /.test(v)) continue; el._es[a] = el.getAttribute(a); }
      const es = el._es[a], m = norm(es).match(/^Vista (\d+): (.*)$/);
      el.setAttribute(a, !en ? es : m ? `View ${m[1]}: ${EN[m[2]] || m[2]}` : EN[norm(es)]);
    }
  }
  if(raiz === document.body){
    if(document._tituloEs == null) document._tituloEs = document.title;
    document.title = en ? (EN[norm(document._tituloEs)] || document._tituloEs) : document._tituloEs;
    const md = document.querySelector('meta[name="description"]');
    if(md){ md._es = md._es || md.content; md.content = en ? (EN[norm(md._es)] || md._es) : md._es; }
    for(const b of document.querySelectorAll("[data-idioma]")){ const on = b.dataset.idioma === lang; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }
  }
}

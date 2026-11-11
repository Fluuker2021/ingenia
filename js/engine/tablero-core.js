/* Ingenia — motor de cálculo del tablero de fuerza (NEC 430 / 310.16 / 250.122, catálogos ABB y
   Miguélez) y escritor DXF R12 con símbolos reales. Extraído sin cambios de criterio de la herramienta de
   tableros validada; solo se retiraron dependencias de interfaz. NO editar a mano los catálogos sin fuente. */

const DS = {
  motor: "https://library.e.abb.com/public/1a72763b30155df2c1256dba00392fa3/2CDC130002C0203.pdf",
  vfd: "https://airlinemedia.airlinehyd.com/Literature/Manufacturer_Catalogs/ABB/datasheets/ACS880-01TechnicalData.pdf",
  ss: "https://library.e.abb.com/public/b113059ab1aa456e8627f82a0fa8b219/Catalogo_Softstarters_PSR_PSE_PSTX%20(2016).pdf",
  ms116: "https://library.e.abb.com/public/9a588abb8159e5f6c1257c270025b190/2CDC131062C0201.pdf",
  ms4xx: "https://library.e.abb.com/public/d8a27c7ec8cf481a97b6e67580657635/MS+325+450+495.pdf",
  af: "https://library.e.abb.com/public/61814700dfa77cd185257bf00066965f/AF%20contactors_overload%20relays%20catalog_1SXU100109C0201.pdf",
  ta: "https://library.e.abb.com/public/8489ed224735e6cac1256faf0028b970/2CDC106014C0201.pdf",
  ef: "https://library.e.abb.com/public/179978cc5bc14352a90e3ebb43d9ca58/2CDC107025D0201%20EF19%20and%20EF45_Rev%20E.pdf",
  tmax: "https://new.abb.com/docs/librariesprovider54/publikationer/katalog-tmax-xt.pdf",
  cmmps41: "https://new.abb.com/products/1SVR730884R3300/cm-mps-41s",
  cmmps21: "https://search.abb.com/library/Download.aspx?DocumentID=2CDC112206D0201",
  ovr: "https://new.abb.com/products/2CTB815710R3500/ovr-t1-t2-3l-12-5-440s-p-ts-qs-surge-protective-device",
  nec: "https://up.codes/viewer/general/nfpa-70-2023",
  xlp: "https://library.e.abb.com/public/20f6702ce7524b6283f37349bd65e7a3/1SEC312011B0202.pdf",
  pf755: "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/750-td001_-en-p.pdf",
  reactor3r: "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/1321-td002_-en-p.pdf",
  rwr: "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/1321-td002_-en-p.pdf",
};
function srcLink(url, label){ return '<a class="src-link" href="'+url+'" target="_blank" rel="noopener">'+(label||"datasheet ↗")+'</a>'; }

/* ============================================================
   CATÁLOGOS (valores verificados contra datasheet oficial ABB donde
   se indica; los marcados "aprox." usan el nombre de modelo real
   pero el escalón exacto queda pendiente de confirmar — ver enlace)
   ============================================================ */

// [kW, HP, I@220V, I@380V, I@440V, I@500V, I@600V, I@690V]  -- motor jaula 4 polos
const MOTOR_FLA = [
[0.06,0.083,0.38,0.22,0.19,0.16,0.12,null],[0.09,0.125,0.55,0.33,0.28,0.24,0.21,null],
[0.12,0.167,0.76,0.42,0.37,0.33,0.27,null],[0.18,0.25,1.1,0.64,0.55,0.46,0.4,null],
[0.25,0.333,1.4,0.88,0.76,0.59,0.56,null],[0.37,0.5,2.1,1.22,1.06,0.85,0.77,0.7],
[0.55,0.75,2.7,1.5,1.25,1.2,1.02,0.9],[0.75,1,3.3,2,1.67,1.48,1.22,1.1],
[1.1,1.5,4.9,2.6,2.26,2.1,1.66,1.5],[1.5,2,6.2,3.5,3.03,2.6,2.22,2],
[2.2,3,8.7,5,4.31,3.8,3.16,2.9],[2.5,3.4,9.8,5.7,4.9,4.3,3.59,3.3],
[3,4,11.6,6.6,5.8,5.1,4.25,3.5],[3.7,5,14.2,8.2,7.1,6.2,5.2,4.4],
[4,5.5,15.3,8.5,7.6,6.5,5.6,4.9],[5,6.8,18.9,10.5,9.4,8.1,6.9,6],
[5.5,7.5,20.6,11.5,10.3,8.9,7.5,6.7],[6.5,8.8,23.7,13.8,12,10.4,8.7,8.1],
[7.5,10,27.4,15.5,13.5,11.9,9.9,9],[8,11,28.8,16.7,14.4,12.7,10.6,9.7],
[9,12.5,32,18.3,15.8,13.9,11.6,10.6],[11,15,39.2,22,19.3,16.7,14.1,13],
[12.5,17,43.8,25,21.9,19,16.1,15],[15,20,52.6,30,26.3,22.5,19.3,17.5],
[18.5,25,64.9,37,32,28.5,23.5,21],[20,27,69.3,40,34.6,30.6,25.4,23],
[22,30,75.2,44,37.1,33,27.2,25],[25,34,84.4,50,42.1,38,30.9,28],
[30,40,101,60,50.1,44,37.1,33],[37,50,124,72,61.9,54,45.4,42],
[40,54,134,79,67,60,49.1,44],[45,60,150,85,73.9,64.5,54.2,49],
[51,70,168,97,83.8,73.7,61.4,56],[55,75,181,105,90.3,79,66.2,60],
[59,80,194,112,96.9,85.3,71.1,66],[75,100,245,140,123,106,90.3,82],
[80,110,260,147,131,112,96.3,86],[90,125,292,170,146,128,107,98],
[100,136,325,188,162,143,119,107],[110,150,358,205,178,156,131,118],
[129,175,420,242,209,184,153,135],[132,180,425,245,214,186,157,140],
[140,190,449,260,227,200,167,145],[147,200,472,273,236,207,173,152],
[160,220,502,295,256,220,188,170],[180,245,578,333,289,254,212,190],
[184,250,590,340,295,259,217,200],[200,270,626,370,321,278,235,215],
[220,300,700,408,353,310,260,235],[250,340,803,460,401,353,295,268],
[257,350,826,475,412,363,302,280],[295,400,948,546,473,416,348,320],
[315,430,990,580,505,445,370,337],[355,480,1080,636,549,483,405,366],
[400,545,1250,710,611,538,450,410],[450,610,1410,800,688,608,508,460],
[475,645,1490,850,730,645,540,485],[500,680,1570,890,770,680,565,510],
[560,760,1750,1000,860,760,630,570],[600,810,null,1080,920,810,680,610],
[670,910,null,1200,1030,910,760,680]
];
const FLA_VOLT_COLS = [220,380,440,500,600,690];

const APPLICATIONS = [
  {v:"ventilador-centrifugo", label:"Ventilador Centrífugo", class:10},
  {v:"valvula-rotativa", label:"Válvula Rotativa", class:20},
  {v:"bomba-centrifuga", label:"Bomba Centrífuga", class:10},
  {v:"compresor-piston", label:"Compresor de Pistón", class:10},
  {v:"ventilador-axial", label:"Ventilador Axial", class:20},
  {v:"faja-transportadora", label:"Faja Transportadora", class:20},
  {v:"molino", label:"Molino", class:30},
  {v:"chancadora", label:"Chancadora", class:30},
  {v:"agitador", label:"Agitador", class:20},
  {v:"otro", label:"Otro (genérico)", class:20},
];

// Guardamotores — VERIFICADO: MS116 (0.16-32A, datasheet 2CDC131062C0201) + MS450/495 (16-100A, datasheet MS+325+450+495)
const GUARDAMOTOR = [
[0.16,"MS116-0.16"],[0.25,"MS116-0.25"],[0.4,"MS116-0.4"],[0.63,"MS116-0.63"],
[1.0,"MS116-1.0"],[1.6,"MS116-1.6"],[2.5,"MS116-2.5"],[4.0,"MS116-4.0"],
[6.3,"MS116-6.3"],[10,"MS116-10"],[12,"MS116-12"],[16,"MS116-16"],
[20,"MS116-20"],[25,"MS116-25"],[32,"MS116-32"],[40,"MS450-40"],
[45,"MS450-45"],[50,"MS450-50"],[63,"MS495-63"],[75,"MS495-75"],
[90,"MS495-90"],[100,"MS495-100"]
];
const GUARDAMOTOR_SRC = DS.ms116; // MS450/495 comparten familia de catálogo (DS.ms4xx) — se anota por fila

// Contactores ABB AF — confirmado 9-38A (datasheet técnico AF09-AF38); tramo >38A pendiente de confirmar escalón exacto
const CONTACTOR_AF = [
[9,"AF09",true],[12,"AF12",true],[18,"AF16",true],[26,"AF26",true],[32,"AF30",true],[38,"AF38",true],
[70,"AF40",false],[100,"AF52",false],[105,"AF65",false],[125,"AF80",false],[130,"AF96",false],
[160,"AF116",false],[200,"AF140",false],[225,"AF146",false],[275,"AF190",false],[350,"AF205",false],
[400,"AF265",false],[500,"AF305",false],[600,"AF370",false],[700,"AF460",false],[800,"AF580",false],
[1050,"AF750",false]
];

// Relés térmicos ABB TA.. — VERIFICADO rango de ajuste (datasheet 2CDC106014C0201), clase 10
const OVERLOAD_THERMAL = [
[0.16,"TA25DU-0.16","0.10–0.16 A"],[0.25,"TA25DU-0.25","0.16–0.25 A"],
[0.4,"TA25DU-0.4","0.25–0.40 A"],[0.63,"TA25DU-0.63","0.40–0.63 A"],
[1.0,"TA25DU-1.0","0.63–1.00 A"],[1.6,"TA25DU-1.6","1.00–1.60 A"],
[2.5,"TA25DU-2.5","1.60–2.50 A"],[4.0,"TA25DU-4.0","2.50–4.00 A"],
[6.5,"TA25DU-6.5","4.50–6.50 A"],[10,"TA25DU-10","7.0–10.0 A"],
[13,"TA25DU-13","9.0–13.0 A"],[18,"TA25DU-18","12.0–18.0 A"],
[25,"TA25DU-25","18.0–25.0 A"],[32,"TA25DU-32","24.0–32.0 A"],
[42,"TA75DU-42","32.0–42.0 A"],[50,"TA75DU-50","42.0–50.0 A"],
[63,"TA75DU-63","50.0–63.0 A"],[80,"TA75DU-80","63.0–80.0 A"],
[90,"TA200DU-90","66.0–90.0 A"],[110,"TA200DU-110","90.0–110 A"],
[135,"TA200DU-135","110–135 A"],[165,"TA200DU-165","135–165 A"],
[200,"TA200DU-200","150–200 A"]
];
// Relés electrónicos EF.. (modelos confirmados: EF19/45/65/96/146/205/370/460/750) — rango de ajuste aprox., confirmar en datasheet
const OVERLOAD_ELECTRONIC = [
[19,"EF19","2.4–19 A (aprox.)"],[45,"EF45","9–45 A (aprox.)"],[65,"EF65","13–65 A (aprox.)"],
[96,"EF96","19–96 A (aprox.)"],[146,"EF146","30–146 A (aprox.)"],[205,"EF205","52–205 A (aprox.)"],
[370,"EF370","85–370 A (aprox.)"],[460,"EF460","110–460 A (aprox.)"],[750,"EF750","150–750 A (aprox.)"]
];

// Arrancadores suaves — VERIFICADO (datasheet Catalogo_Softstarters_PSR_PSE_PSTX): PSR 3-105A, PSTX 30-1250A
const SOFTSTARTER = [
[3,"PSR3"],[6,"PSR6"],[9,"PSR9"],[12,"PSR12"],[16,"PSR16"],[25,"PSR25"],
[30,"PSR30"],[37,"PSR37"],[45,"PSR45"],[60,"PSR60"],[72,"PSR72"],[85,"PSR85"],
[105,"PSR105"],[143,"PSTX142"],[171,"PSTX170"],[210,"PSTX210"],[250,"PSTX250"],
[300,"PSTX300"],[370,"PSTX370"],[470,"PSTX470"],[570,"PSTX570"],
[720,"PSTX720"],[840,"PSTX840"],[1050,"PSTX1050"],[1250,"PSTX1250"]
];

// Variadores ABB ACS880-01, clase 380-500V (tipo "-5") — VERIFICADO contra datasheet técnico oficial.
// 3ª columna: fusible aR recomendado por ABB (Hardware Manual ACS880-01, apéndice "Fuses", UN=500V) — protección
// específica de semiconductores del variador, un fusible por fase. 4ª columna: true si el valor de fusible se
// tomó directamente de la tabla del fabricante; false = interpolado entre dos escalones confirmados (confirmar).
const VFD_ACS880 = [
[2.1,"ACS880-01-02A1-5",6,true],[3.0,"ACS880-01-03A0-5",6,true],[3.4,"ACS880-01-03A4-5",6,true],
[4.8,"ACS880-01-04A8-5",10,true],[7.6,"ACS880-01-07A6-5",13,true],[11,"ACS880-01-11A0-5",20,true],
[14,"ACS880-01-014A-5",25,true],[21,"ACS880-01-021A-5",32,true],[27,"ACS880-01-027A-5",50,true],
[34,"ACS880-01-034A-5",63,true],[40,"ACS880-01-040A-5",63,true],[52,"ACS880-01-052A-5",75,true],
[65,"ACS880-01-065A-5",125,true],[77,"ACS880-01-077A-5",125,true],[96,"ACS880-01-096A-5",200,true],
[124,"ACS880-01-124A-5",250,true],[156,"ACS880-01-156A-5",315,true],[180,"ACS880-01-180A-5",315,true],
[240,"ACS880-01-240A-5",400,true],[302,"ACS880-01-302A-5",450,false],[361,"ACS880-01-361A-5",630,true],
[414,"ACS880-01-414A-5",700,true]
];

// Variadores Rockwell/Allen-Bradley PowerFlex 755 (fam. 20G), 480V, Normal Duty —
// corriente de salida VERIFICADA (datasheet técnico oficial 750-TD001 + fichas de producto de distribuidor
// autorizado para varios escalones). El código de catálogo completo de 18 caracteres (frame/gabinete/opciones)
// varía según configuración — confirmar con el configurador oficial de Rockwell antes de comprar.
const VFD_POWERFLEX755 = [
[2.1,1],[3.4,2],[5,3],[8,5],[11,7.5],[14,10],[22,15],[27,20],[34,25],[40,30],
[52,40],[65,50],[77,60],[96,75],[125,100],[156,125],[186,150],[248,200],
[302,250],[361,300],[415,350]
];

// Escalones de reactancia (filtro de línea / filtro de carga) — genérico, confirmar con fabricante según cable/dv/dt
const REACTOR_STEPS = [18,35,45,65,90,110,140,180,220,280,320,400,520,650,820];
// Reactor de línea Rockwell/Allen-Bradley 1321-3R (entrada del variador) — escalones de corriente VERIFICADOS
// contra datasheet técnico oficial 1321-TD002; el sufijo de impedancia (A/B/C/D, 1.5/3/5%) varía por escalón — confirmar en catálogo
const REACTOR_3R_STEPS = [1,2,4,8,12,18,25,35,45,55,80,100,130,160,200,250,320,400,500,600,750,850,1000];
// Reactor de salida (reflected wave reduction) Rockwell/Allen-Bradley 1321-RWR (entre variador y motor) —
// escalones VERIFICADOS contra datasheet técnico oficial 1321-TD002, rango 400/480V; sufijo de configuración (DP/EP) confirmar en catálogo
const REACTOR_RWR_STEPS = [8,12,18,25,35,45,55,80,100,130,160,200,250,320];
// Portafusibles gG/NH — escalones normalizados IEC (uso genérico, p.ej. transformador de control)
const FUSE_STEPS = [6,10,16,20,25,32,40,50,63,80,100,125,160,200,224,250,315,355,400,425,450,500,560,630,800];
// Seccionador-portafusible ABB EasyLine XLP (3 polos, NH/gG) — VERIFICADO contra ficha de producto oficial ABB
// (new.abb.com / RS Components) — familia solicitada por el cliente en reemplazo del seccionador genérico OS
const FUSE_SWITCH_XLP = [
[100,"XLP000-6CC (NH000)"],[160,"XLP00 (NH00)"],[250,"XLP1 (NH1)"],
[400,"XLP2 (NH2)"],[630,"XLP3 (NH3, confirmar corriente exacta — fuentes indican 500–630A)"]
];
// Interruptores termomagnéticos — hasta 250A verificado en catálogo Tmax XT (XT3/XT4); por encima, marco mayor (ver nota)
const BREAKER_STEPS = [16,20,25,32,40,50,63,80,100,125,160,200,250,320,400,630,800,1000,1250,1600,2000,2500];
const BREAKER_XT_CONFIRMED_MAX = 250;
// Pequeños ITM de control (2P)
const CTRL_BREAKER_STEPS = [2,4,6,10,16,20,25,32,40,50,63,80,100];
// Transformadores de control — familia de potencias comerciales estándar (genérico, sin marca específica)
const CTRL_XFMR_STEPS = [50,75,100,150,200,250,300,500,750,1000,1500,2000,3000,5000,7500,10000];

// Cables NEC 310.16 (75°C, Cu, THHN/THWN-2, ≤3 conductores activos, 30°C amb.)
// 4ª columna: resistencia DC a 75°C, cobre no revestido, ohm/km (NEC Cap. 9, Tabla 8: valor en ohm/kFT ÷ 0.3048)
const CABLE_TABLE = [
["14 AWG",2.08,20,10.30],["12 AWG",3.31,25,6.50],["10 AWG",5.26,35,4.07],["8 AWG",8.37,50,2.55],
["6 AWG",13.3,65,1.61],["4 AWG",21.2,85,1.01],["3 AWG",26.7,100,0.804],["2 AWG",33.6,115,0.636],
["1 AWG",42.4,130,0.505],["1/0 AWG",53.5,150,0.400],["2/0 AWG",67.4,175,0.317],["3/0 AWG",85.0,200,0.251],
["4/0 AWG",107,230,0.200],["250 kcmil",127,255,0.169],["300 kcmil",152,285,0.141],["350 kcmil",177,310,0.120],
["400 kcmil",203,335,0.105],["500 kcmil",253,380,0.0846],["600 kcmil",304,420,0.0702],["700 kcmil",355,460,0.0604],
["750 kcmil",380,475,0.0561]
];
// Conductor de puesta a tierra de equipos (EGC), cobre — NEC Tabla 250.122, en función del amperaje
// nominal del dispositivo de sobrecorriente (OCPD) instalado aguas arriba del equipo protegido.
const EGC_TABLE_CU = [
[15,"14 AWG",2.08],[20,"12 AWG",3.31],[30,"10 AWG",5.26],[40,"10 AWG",5.26],[60,"10 AWG",5.26],
[100,"8 AWG",8.37],[200,"6 AWG",13.3],[300,"4 AWG",21.2],[400,"3 AWG",26.7],[500,"2 AWG",33.6],
[600,"1 AWG",42.4],[800,"1/0 AWG",53.5],[1000,"2/0 AWG",67.4],[1200,"3/0 AWG",85.0],[1600,"4/0 AWG",107],
[2000,"250 kcmil",127],[2500,"350 kcmil",177],[3000,"400 kcmil",203],[4000,"500 kcmil",253],[6000,"700 kcmil",355]
];
/* ============================================================
   CABLES MIGUÉLEZ — referencia comercial real (fichas técnicas del cliente: Z1C4Z1-K (AS) 300/500V,
   RZ1-K (AS) 0,6/1kV, MULTIPLE RZ1-K (AS) 0,6/1kV y BARRYFLEX RV-K 0,6/1kV). El calibre (mm²) sigue
   saliendo de la tabla NEC 310.16 de arriba (criterio ya verificado, sin tocar) — esto solo CRUZA ese
   mm² requerido contra el escalón métrico estándar más cercano (redondeado hacia arriba) del catálogo
   Miguélez, para dar una descripción y código de pedido reales en vez de solo el calibre AWG/NEC.
   ============================================================ */
// Escalones de sección normalizados IEC que usa el catálogo Miguélez (mismos en las 4 familias revisadas).
const MIGUELEZ_MM2_STEPS = [1.5,2.5,4,6,10,16,25,35,50,70,95,120,150,185,240,300,400,500];
function miguelezMM2Up(reqMM2){ for(const s of MIGUELEZ_MM2_STEPS) if(s >= reqMM2 - 1e-9) return s; return MIGUELEZ_MM2_STEPS[MIGUELEZ_MM2_STEPS.length-1]; }

// AFIRENAS X RZ1-K (AS) 0,6/1kV — familia de potencia (cobre, XLPE, libre de halógenos AS) — códigos
// de pedido cortos tal como figuran en la ficha técnica Miguélez (DoP MC1000RZ1K), columna "Código*".
const RZ1K_1X = { // monoconductor — usado para el conductor de puesta a tierra (EGC) y, en paralelo, para fases >120mm²
  1.5:"82070101-50", 2.5:"82070102-50", 4:"82070100040", 6:"82070100060", 10:"82070100100", 16:"82070100160",
  25:"82070100250", 35:"82070100350", 50:"82070100500", 70:"82070100700", 95:"82070100950", 120:"82070101200",
  150:"82070101500", 185:"82070101850", 240:"82070102040", 300:"82070103000", 400:"82070104000", 500:"82070105000"
};
const RZ1K_3G = { 1.5:"82070311-50", 2.5:"82070312-50", 4:"82070310040", 6:"82070310060", 10:"82070310100" }; // 3 fases + tierra integrada (solo hasta 10mm² en el catálogo)
const RZ1K_3X = { 16:"82070300160", 25:"82070300250", 35:"82070300350", 50:"82070300500", 70:"82070300700", 95:"82070300950", 120:"82070301200" }; // 3 fases sin tierra (16-120mm²)

// Ampacidad de referencia Miguélez (ficha BARRYFLEX RV-K 0,6/1kV, cobre XLPE 90°C — misma familia
// constructiva que RZ1-K, columna "Intensidad máx. admisible al aire 30°C") — cruce de verificación
// independiente del NEC 310.16 usado para seleccionar el calibre.
const MIGUELEZ_AMP_1C = {1.5:24,2.5:33,4:45,6:58,10:80,16:107,25:135,35:169,50:207,70:268,95:328,120:383,150:444,185:510,240:607,300:703,400:823,500:946};
const MIGUELEZ_AMP_3C = {1.5:26,2.5:36,4:49,6:63,10:75,16:100,25:127,35:158,50:192,70:246,95:298,120:346,150:399,185:456,240:538};

// Cable de mando/control apantallado Z1C4Z1-K (AS) 300/500V (DoP MC05Z1C4Z1K-02) y multiconductor MULTIPLE
// RZ1-K (AS) 0,6/1kV (DoP MC1000RZ1KMULTIPLE) — catalogados para cuando se necesite dimensionar cableado de
// mando/instrumentación (p.ej. señales de PLC); el predimensionado actual de "Circuitos del tablero" no arma
// todavía una memoria de cable para las derivaciones de control (ver nota en la pestaña "Memoria de cálculo"),
// así que estos dos no se aplican aún a ningún ítem — quedan listos para cuando se requiera.
const Z1C4Z1K_CODES = { "2x0.5":"82170200-50","3G0.5":"82170310-50","4G0.5":"82170410-50","5G0.5":"82170510-50" };
const MULTIPLE_RZ1K_CODES = { "6G1.5":"82070611-50","8G1.5":"82070811-50","12G1.5":"82071211-50","20G1.5":"82072011-50" };

// Dada una sección NEC requerida (mm²) y la cantidad de conductores de fase del circuito (3 = circuito
// trifásico/motor, 1 = conductor de puesta a tierra), devuelve {mm2, code, family, desc} con el escalón
// Miguélez redondeado hacia arriba y el código de pedido real si existe en el catálogo revisado.
function miguelezCableFor(reqMM2, phaseCores){
  const mm2 = miguelezMM2Up(reqMM2);
  if(phaseCores===1){
    const code = RZ1K_1X[mm2];
    const amp = MIGUELEZ_AMP_1C[mm2];
    return { mm2, code, cores:1, family:"RZ1-K (AS) 0,6/1kV", desc:"Miguélez RZ1-K (AS) 0,6/1kV 1x"+mm2+"mm²"+(code?" · Cód. "+code:""), ampRef: amp };
  }
  // trifásico (fases, sin neutro) — hasta 10mm² el catálogo solo ofrece el cable con tierra integrada (3G);
  // de 16 a 120mm² existe la versión sin tierra (3X, se tiende junto al EGC ya dimensionado aparte); por
  // encima de 120mm² el catálogo revisado no trae un multiconductor de potencia — el propio catálogo asume
  // en ese rango 3 monoconductores 1X en paralelo por fase (mismo criterio que la acometida principal).
  if(mm2<=10){
    const code = RZ1K_3G[mm2];
    const amp = MIGUELEZ_AMP_3C[mm2];
    return { mm2, code, cores:3, family:"RZ1-K (AS) 0,6/1kV", desc:"Miguélez RZ1-K (AS) 0,6/1kV 3G"+mm2+"mm² (tierra integrada)"+(code?" · Cód. "+code:""), ampRef: amp };
  }
  if(mm2<=120){
    const code = RZ1K_3X[mm2];
    const amp = MIGUELEZ_AMP_3C[mm2];
    return { mm2, code, cores:3, family:"RZ1-K (AS) 0,6/1kV", desc:"Miguélez RZ1-K (AS) 0,6/1kV 3X"+mm2+"mm²"+(code?" · Cód. "+code:""), ampRef: amp };
  }
  const code1x = RZ1K_1X[mm2];
  const amp = MIGUELEZ_AMP_1C[mm2];
  return { mm2, code:null, cores:3, family:"RZ1-K (AS) 0,6/1kV", desc:"Sin multiconductor Miguélez por encima de 120mm² — usar 3x 1x"+mm2+"mm² en paralelo por fase"+(code1x?" (Cód. "+code1x+" c/u)":""), ampRef: amp };
}
function miguelezAmpNote(m){ return m.ampRef!=null ? " (ampacidad ref. Miguélez, 30°C al aire: "+m.ampRef+"A)" : ""; }
// Texto de "Marca / Modelo" para las filas de cable/EGC: calibre NEC (criterio de selección) + descripción
// y código de pedido Miguélez real (reemplaza el botón de "datasheet" genérico que apuntaba al texto del NEC).
function cableModelText(cable, mig){ return cable[0]+" ("+cable[1]+" mm²) — "+mig.desc+miguelezAmpNote(mig); }
function egcModelText(egc, mig){ return egc[1]+" ("+egc[2]+" mm²) — "+mig.desc+miguelezAmpNote(mig); }

const TEMP_CORR = [[25,1.05],[30,1.00],[35,0.94],[40,0.88],[45,0.82],[50,0.75],[55,0.67],[60,0.58],[70,0.33]];
const TERMINAL_BLOCK = [
[32,"Bornera 4-6 mm² (32A)"],[41,"Bornera 6 mm² (41A)"],[57,"Bornera 10 mm² (57A)"],
[76,"Bornera 16 mm² (76A)"],[101,"Bornera 25 mm² (101A)"],[125,"Bornera 35 mm² (125A)"],
[150,"Bornera 50 mm² (150A)"],[192,"Bornera 70 mm² (192A)"],[232,"Bornera 95 mm² (232A)"],
[315,"Bornera 120 mm² (315A)"],[395,"Bornera 185 mm² (395A)"],[480,"Bornera 240 mm² (480A)"]
];
function pick(catalog, required, idxA){ for(const row of catalog){ if(row[idxA] >= required - 1e-9) return row; } return catalog[catalog.length-1]; }
function exceeds(catalog, required, idxA){ return required > catalog[catalog.length-1][idxA] + 1e-9; }
function pickStep(list, required){ for(const v of list){ if(v >= required - 1e-9) return v; } return list[list.length-1]; }
function interp(x0,y0,x1,y1,x){ if(x1===x0) return y0; return y0 + (y1-y0)*(x-x0)/(x1-x0); }
function currentAtVoltage(row, voltage){
  const cols = FLA_VOLT_COLS, vals = row.slice(2);
  const pts = cols.map((v,i)=>({v, i:vals[i]})).filter(p=>p.i!=null);
  if(pts.length===0) return null;
  if(voltage <= pts[0].v) return interp(pts[0].v, pts[0].i, pts[1]?pts[1].v:pts[0].v+1, pts[1]?pts[1].i:pts[0].i, voltage);
  for(let k=0;k<pts.length-1;k++){ if(voltage>=pts[k].v && voltage<=pts[k+1].v) return interp(pts[k].v,pts[k].i,pts[k+1].v,pts[k+1].i,voltage); }
  const last = pts[pts.length-1], prev = pts[pts.length-2] || last;
  return interp(prev.v,prev.i,last.v,last.i,voltage);
}
// Ingenia: opciones de cálculo fijadas por proyecto (norma de corrientes de motor y sección mínima de fuerza)
const OPC = { flaNorma:"NEC", minMM2:0 };
function configurarMotor(o){ Object.assign(OPC, o||{}); }
// NEC Tabla 430.250 — corriente a plena carga, motores de inducción trifásicos, columna 460 V
const NEC_FLA_460 = [[0.5,1.1],[0.75,1.6],[1,2.1],[1.5,3.0],[2,3.4],[3,4.8],[5,7.6],[7.5,11],[10,14],[15,21],[20,27],[25,34],[30,40],[40,52],[50,65],[60,77],[75,96],[100,124],[125,156],[150,180],[200,240],[250,302],[300,361],[350,414],[400,477],[450,515],[500,590]];
function necFLA(power, unit, voltage){
  const hp = unit==="hp" ? power : power/0.746;
  const r = NEC_FLA_460.find(x=>x[0] >= hp - 1e-6) || NEC_FLA_460[NEC_FLA_460.length-1];
  const v = +voltage||460;
  const k = (v>=440 && v<=480) ? 1 : (v>=220 && v<=240) ? 2 : 460/v;   // NEC: columnas 230 V y 460 V aplican a 220-240 V y 440-480 V
  return Math.round(r[1]*k*10)/10;
}
function motorFLA(power, unit, voltage){
  if(OPC.flaNorma==="NEC"){ const fla = necFLA(power, unit, voltage); return { row:null, fla }; }
  const col = unit==="hp" ? 1 : 0;
  let row = MOTOR_FLA.find(r => r[col] >= power - 1e-6);
  if(!row) row = MOTOR_FLA[MOTOR_FLA.length-1];
  let fla = currentAtVoltage(row, voltage);
  if(fla!=null) fla = Math.round(fla*10)/10;
  return {row, fla};
}
function altitudeTempFactor_electronics(altitude, temp){
  const fh = altitude>1000 ? Math.max(100-((altitude-1000)/100), 30) : 100;
  const ft = temp>40 ? Math.max(100-(temp-40), 30) : 100;
  return {fh, ft, factor:(fh/100)*(ft/100)};
}
function cableFor(requiredAmpacity){ for(const row of CABLE_TABLE) if(row[2] >= requiredAmpacity - 1e-9 && row[1] >= OPC.minMM2 - 1e-9) return row; return CABLE_TABLE[CABLE_TABLE.length-1]; }
function egcFor(ocpdRating){
  let r = EGC_TABLE_CU.find(row=>row[0] >= ocpdRating - 1e-9) || EGC_TABLE_CU[EGC_TABLE_CU.length-1];
  // sección mínima de proyecto también para el conductor de tierra (p.ej. criterio 12 AWG mínimo)
  if(OPC.minMM2 && r[2] < OPC.minMM2 - 1e-9){ const c = CABLE_TABLE.find(x=>x[1] >= OPC.minMM2 - 1e-9); if(c) r = [r[0], c[0], c[1]]; }
  return r;
}
function tempCorrFactor(temp){ for(const [t,f] of TEMP_CORR) if(temp<=t) return f; return TEMP_CORR[TEMP_CORR.length-1][1]; }
function fmtA(x){ return x.toFixed(1)+" A"; }
function guardamotorSrc(model){ return model.indexOf("MS116")===0 ? DS.ms116 : DS.ms4xx; }

// Memoria de cálculo de conductores: corriente de diseño (125% continuidad) → ampacidad requerida
// (corregida por temperatura ambiente) → conductor NEC 310.16 → verificación por caída de tensión
// (solo componente resistiva, NEC Cap.9 Tabla 8 — ver nota de metodología en la pestaña correspondiente).
// NEC Tabla 310.16, cobre, columna 90 °C (aislamiento XLPE / XHHW-2) y factores de corrección por temperatura
// para 90 °C (NEC 310.15(B)(1), ambiente base 30 °C). Con el método "90" la ampacidad corregida se calcula con
// la columna de 90 °C y se verifica que no exceda la columna de 75 °C de los terminales (NEC 110.14(C)).
const AMP90 = {"14 AWG":25,"12 AWG":30,"10 AWG":40,"8 AWG":55,"6 AWG":75,"4 AWG":95,"3 AWG":115,"2 AWG":130,"1 AWG":145,"1/0 AWG":170,"2/0 AWG":195,"3/0 AWG":225,"4/0 AWG":260,"250 kcmil":290,"300 kcmil":320,"350 kcmil":350,"400 kcmil":380,"500 kcmil":430,"600 kcmil":475,"700 kcmil":520,"750 kcmil":535};
const TEMP_CORR_90 = [[10,1.15],[15,1.12],[20,1.08],[25,1.04],[30,1.00],[35,0.96],[40,0.91],[45,0.87],[50,0.82],[55,0.76],[60,0.71],[65,0.65],[70,0.58]];
function tempCorr90(t){ for(const [x,f] of TEMP_CORR_90) if(t<=x) return f; return TEMP_CORR_90[TEMP_CORR_90.length-1][1]; }
function buildConductorMemo(baseCurrent, cosphi, tempF, cableLength, voltage, maxVD){
  const designCurrent = baseCurrent*1.25;
  const L = cableLength>0 ? cableLength : 30;
  const vdDe = row => (Math.sqrt(3)*designCurrent*L*row[3]*cosphi)/(10*voltage);
  const metodo90 = OPC.metodo==="90" && OPC.ambient!=null;
  const kg = OPC.kGroup>0 ? OPC.kGroup : 1;
  const kt = metodo90 ? tempCorr90(OPC.ambient) : tempF/kg;
  const iadmDe = row => metodo90 ? (AMP90[row[0]]||row[2]) : row[2];
  const ok = row => row[1] >= OPC.minMM2 - 1e-9 && iadmDe(row)*kt*kg >= designCurrent - 1e-9 && (!metodo90 || row[2] >= designCurrent - 1e-9);
  let idx = CABLE_TABLE.findIndex(ok); if(idx<0) idx = CABLE_TABLE.length-1;
  let porCaida = false;
  // si la caída de tensión excede el límite, se aumenta la sección (criterio usual de diseño)
  while(vdDe(CABLE_TABLE[idx]) > maxVD + 1e-9 && idx < CABLE_TABLE.length-1){ idx++; porCaida = true; }
  const cable = CABLE_TABLE[idx];
  const R = cable[3];
  const vdPct = vdDe(cable);
  const vdVolts = (vdPct/100)*voltage;
  const vdOk = vdPct <= maxVD + 1e-9;
  const miguelez = miguelezCableFor(cable[1], 3);
  const ampacityRequired = designCurrent/(kt*kg);
  return { baseCurrent, designCurrent, tempF: kt*kg, kt, kg, iadm: iadmDe(cable), iTerm: cable[2], metodo: metodo90 ? "90" : "75", porCaida, ampacityRequired, cable, cableLength:L, R, vdVolts, vdPct, vdOk, maxVD, cosphi, miguelez };
}

// Anexa el calibre del conductor de puesta a tierra (EGC, NEC Tabla 250.122) a una memoria de conductores,
// en función del amperaje del dispositivo de sobrecorriente (OCPD) que protege ese circuito.
function withEGC(cmemo, ocpdRating){
  const egc = egcFor(ocpdRating);
  return Object.assign({}, cmemo, { ocpdRating, egc, egcMiguelez: miguelezCableFor(egc[2], 1) });
}

// Acometida principal (aguas abajo del ITM general): dimensionada por la DEMANDA real (ΣS×FU×FS ×1.25
// continuidad, NEC 215.2(A)(1)) — no por el ajuste del ITM, que en cargas motrices puede quedar mayor por
// NEC 430.62(A). Regla aplicada para cable vs. barra: hasta 475A por conductor (750 kcmil, tope de la tabla
// NEC 310.16 usada aquí) se especifica un solo conductor por fase; de 476A hasta 3 sets en paralelo de 750
// kcmil (≤1425A, NEC 310.10(H) permite paralelo desde 1/0 AWG) se especifican sets en paralelo; por encima de
// eso (>3 sets) ya no es práctico terminar tantos conductores en las borneras del ITM/tablero, y el criterio
// de diseño estándar en tableros de esta magnitud es usar barra de cobre (busbar) en vez de cable.
const MAIN_CABLE_MAX_PARALLEL_SETS = 3;
function buildMainConductorSpec(designCurrent, tempF){
  if(OPC.metodo==="90" && OPC.ambient!=null && designCurrent>0){
    const kt = tempCorr90(OPC.ambient), kg = OPC.kGroup>0 ? OPC.kGroup : 1;
    const idx1_0 = CABLE_TABLE.findIndex(r=>r[0]==="1/0 AWG");
    for(let sets=1; sets<=MAIN_CABLE_MAX_PARALLEL_SETS; sets++){
      const per = designCurrent/sets;
      let cable = CABLE_TABLE.find(r=>r[1] >= OPC.minMM2-1e-9 && (AMP90[r[0]]||r[2])*kt*kg >= per-1e-9 && r[2] >= per-1e-9);
      if(!cable) continue;
      if(sets>1 && CABLE_TABLE.indexOf(cable) < idx1_0) cable = CABLE_TABLE[idx1_0];
      return { type: sets>1 ? "cable-parallel" : "cable", sets, cable, ampacityRequired: designCurrent/(kt*kg), designCurrent, miguelez: miguelezCableFor(cable[1], 1) };
    }
    return { type:"busbar", ampacityRequired: designCurrent/(kt*kg), designCurrent };
  }
  const ampacityRequired = designCurrent/tempF;
  const maxSingleAmpacity = CABLE_TABLE[CABLE_TABLE.length-1][2];
  // acometida principal: a esta magnitud se tiende como monoconductores por fase (1X), no multiconductor
  // bundled — igual criterio que el catálogo Miguélez usa por encima de 120mm² (ver miguelezCableFor).
  if(ampacityRequired <= maxSingleAmpacity){
    const cable = cableFor(ampacityRequired);
    return { type:"cable", sets:1, cable, ampacityRequired, designCurrent, miguelez: miguelezCableFor(cable[1], 1) };
  }
  const idx1_0 = CABLE_TABLE.findIndex(r=>r[0]==="1/0 AWG");
  for(let sets=2; sets<=MAIN_CABLE_MAX_PARALLEL_SETS; sets++){
    const perSetRequired = ampacityRequired/sets;
    if(perSetRequired <= maxSingleAmpacity){
      let cable = cableFor(perSetRequired);
      if(CABLE_TABLE.indexOf(cable) < idx1_0) cable = CABLE_TABLE[idx1_0]; // NEC 310.10(H)(1): mínimo 1/0 AWG en paralelo
      return { type:"cable-parallel", sets, cable, ampacityRequired, designCurrent, miguelez: miguelezCableFor(cable[1], 1) };
    }
  }
  return { type:"busbar", ampacityRequired, designCurrent };
}

function tagFor(idx){ return "C"+(idx+1); }
function breakerFamilyLabel(rating){
  return rating<=BREAKER_XT_CONFIRMED_MAX ? "ABB Tmax XT3/XT4" : "ABB Tmax T5 o superior (confirmar marco)";
}

function computeCircuit(load, idx, g){
  const tag = tagFor(idx);
  const appMeta = APPLICATIONS.find(a=>a.v===load.application) || APPLICATIONS[APPLICATIONS.length-1];
  const tempF = tempCorrFactor(g.ambientTemp)*(g.kGroup>0 ? g.kGroup : 1);

  const fu0 = load.fu>=0 ? load.fu : 1;
  const fs0 = load.fs>=0 ? load.fs : 1;

  if(load.kind==="feeder"){
    const amps = load.feederAmps;
    const brk = pickStep(BREAKER_STEPS, amps*1.25);
    const tb = pick(TERMINAL_BLOCK, amps, 0);
    const cmemo0 = buildConductorMemo(amps, 1, tempF, load.cableLength, g.voltage, g.maxVD);
    const cmemo = withEGC(cmemo0, brk);
    const cable = cmemo.cable;
    const installedKVA = Math.sqrt(3)*g.voltage*amps/1000;
    const demandKVA = installedKVA*fu0*fs0;
    const installedCurrent = amps;
    return { tag, loadId: load.id, kind:"feeder", title: load.desc || "Alimentación a tablero", meta: amps.toFixed(1)+" A (estimada) · S "+demandKVA.toFixed(1)+" kVA",
      mainContribution: amps, demandKVA, installedKVA, installedCurrent, powerHP:null, powerKWelec:null, fp:null, effPct:null, fu:fu0, fs:fs0, conductorMemo: cmemo,
      items: [
        {comp:"ITM", devtag:"Q"+tag, model:breakerFamilyLabel(brk), val: "3x"+brk+"A", src:DS.tmax},
        {comp:"Cable de fuerza", devtag:"—", model: cableModelText(cable, cmemo.miguelez), val:"—", src:null},
        {comp:"Conductor de puesta a tierra (EGC)", devtag:"—", model: egcModelText(cmemo.egc, cmemo.egcMiguelez), val:"NEC Tabla 250.122", src:null},
        {comp:"Bornera de derivación", devtag:"X"+tag, model: tb[1], val:"—", src:null},
      ]};
  }

  if(load.kind==="control"){
    const totalBranchVA = load.controlBranches.reduce((a,br)=>a+(br.va>=0?br.va:0), 0);
    const ctrlVA = pickStep(CTRL_XFMR_STEPS, totalBranchVA);
    const secFLA = ctrlVA / (g.ctrlVoltage==="220"?220:120);
    const vaPrimaryA = ctrlVA / g.voltage;
    const mainBrk = pickStep(CTRL_BREAKER_STEPS, secFLA*1.25);
    const fuse = pickStep(FUSE_STEPS, vaPrimaryA*2.0);
    const ctrlEgc = egcFor(mainBrk);
    const ctrlEgcMig = miguelezCableFor(ctrlEgc[2], 1);
    const items = [
      {comp:"Portafusible primario (antes del transformador)", devtag:"F"+tag, model:"Fusible gG", val: fuse+"A", src:null},
      {comp:"Transformador de control", devtag:"T"+tag, model: g.voltage+"/"+(g.ctrlVoltage==="220"?"220":"120")+"VAC+T", val: ctrlVA+" VA (Σ derivaciones "+totalBranchVA.toFixed(0)+" VA)", src:null},
      {comp:"ITM principal de control (después del transformador)", devtag:"Q"+tag, model:"ABB System pro M compact (2P)", val: "2x"+mainBrk+"A", src:DS.tmax},
      {comp:"Conductor de puesta a tierra (EGC), secundario", devtag:"—", model: egcModelText(ctrlEgc, ctrlEgcMig), val:"NEC Tabla 250.122", src:null},
    ];
    load.controlBranches.forEach((br, bi)=>{ items.push({comp:br.label, devtag:"QC"+(bi+1)+"."+tag, model:"ABB System pro M compact (2P)", val: "2x"+br.breaker+"A"+(br.va?" · "+br.va+"VA":""), src:DS.tmax}); });
    const installedKVA = ctrlVA/1000;
    const demandKVA = installedKVA*fu0*fs0;
    const installedCurrent = vaPrimaryA;
    return { tag, loadId: load.id, kind:"control", title: load.desc || "Distribución de control", meta: ctrlVA+" VA (Σ derivaciones "+totalBranchVA.toFixed(0)+"VA) · sec. "+secFLA.toFixed(1)+"A · S "+demandKVA.toFixed(2)+" kVA",
      mainContribution: fuse, demandKVA, installedKVA, installedCurrent, powerHP:null, powerKWelec:null, fp:null, effPct:null, fu:fu0, fs:fs0, conductorMemo:null, items };
  }

  // ---- motor ----
  const {fla} = motorFLA(load.power, load.powerUnit, g.voltage);
  if(fla==null) return null;
  // corriente de placa (NEC 430.6(A)(2)): se usa para la protección de sobrecarga / guardamotor y el variador
  const flaOL = load.inPlaca>0 ? +load.inPlaca : fla;
  const powerLbl = load.power+" "+(load.powerUnit==="hp"?"HP":"kW");
  const powerKW = load.powerUnit==="hp" ? load.power*0.746 : load.power;
  const powerHP = load.powerUnit==="hp" ? load.power : load.power/0.746;
  const fp = load.fp>0 ? load.fp : 0.85;
  const effFrac = (load.effPct>0 ? load.effPct : 90)/100;
  const fu = fu0, fs = fs0;
  const installedKVA = (powerKW/effFrac/fp);
  const demandKVA = installedKVA*fu*fs;
  const installedCurrent = (installedKVA*1000)/(Math.sqrt(3)*g.voltage);
  const demandTxt = "S inst "+installedKVA.toFixed(1)+"kVA · S dem "+demandKVA.toFixed(1)+"kVA (FP "+fp.toFixed(2)+" · η "+(effFrac*100).toFixed(0)+"% · FU "+fu.toFixed(2)+" · FS "+fs.toFixed(2)+")";
  const cmemo = buildConductorMemo(fla, fp, tempF, load.cableLength, g.voltage, g.maxVD);
  const cable = cmemo.cable;
  const motorExtra = { loadId: load.id, descLabel: load.desc||appMeta.label, powerHP, powerKWelec: powerKW, fp, effPct: effFrac*100, fu, fs, installedCurrent, conductorMemo: cmemo, vfdBrandUsed: (load.starter==="vfd" && load.vfdBrand==="rockwell") ? "rockwell" : "abb" };

  if(load.starter==="vfd" || load.starter==="ss"){
    const {fh,ft,factor} = altitudeTempFactor_electronics(g.altitude, g.ambientTemp);
    const isel = Math.round((Math.max(fla, flaOL)/factor)*10)/10;
    const deratingTxt = "Fh "+fh.toFixed(0)+"% · Ft "+ft.toFixed(0)+"%";

    if(load.starter==="vfd"){
      const brand = load.vfdBrand==="rockwell" ? "rockwell" : "abb";
      let driveAmps, driveLabel, driveSrc, warn, mfgFuseA=null, mfgFuseConfirmed=true;
      if(brand==="rockwell"){
        const drive = pick(VFD_POWERFLEX755, isel, 0);
        warn = exceeds(VFD_POWERFLEX755, isel, 0);
        driveAmps = drive[0];
        driveLabel = "Allen-Bradley PowerFlex 755 (20G), "+drive[1]+"HP ND @480V (confirmar código de catálogo completo según frame/opciones)";
        driveSrc = DS.pf755;
      } else {
        const drive = pick(VFD_ACS880, isel, 0);
        warn = exceeds(VFD_ACS880, isel, 0);
        driveAmps = drive[0];
        driveLabel = "ABB "+drive[1];
        driveSrc = DS.vfd;
        mfgFuseA = drive[2]; mfgFuseConfirmed = drive[3];
      }
      // Fusible: ABB especifica un fusible aR por variador (ACS880-01 Hardware Manual, apéndice "Fuses") — se usa
      // ese valor directamente. Para Rockwell (sin tabla de fabricante extraída aún — confirmar contra PowerFlex
      // 755 Technical Data 750-TD001, pág. "Fuse and Circuit Breaker Ratings") se aplica el criterio NEC Tabla
      // 430.52 para fusible de tiempo diferido (dual element): 175% de la corriente nominal del variador.
      const fuseRatingA = mfgFuseA!=null ? mfgFuseA : driveAmps*g.fuseMult;
      const fuseSw = pick(FUSE_SWITCH_XLP, fuseRatingA, 0);
      // ITM aguas arriba: el variador limita su propia corriente de entrada (no hay arranque directo reflejado a
      // línea como en un motor DOL), por lo que NO aplica el 250% de NEC 430.52 para motores — se dimensiona por
      // NEC 430.122 (125% de la corriente nominal de entrada, continuidad de carga), igual criterio que ABB usa
      // como referencia de holgura en sus tablas de fusible/ITM combinados.
      const brk = pickStep(BREAKER_STEPS, driveAmps*g.vfdBrkMult);
      let lineFltItem, loadFltItem;
      if(brand==="rockwell"){
        const lineStep = pickStep(REACTOR_3R_STEPS, driveAmps);
        const loadStep = pickStep(REACTOR_RWR_STEPS, driveAmps);
        lineFltItem = {comp:"Filtro de línea (reactancia entrada)", devtag:"L"+tag, model:"Allen-Bradley 1321-3R"+lineStep+" (confirmar sufijo de impedancia A/B/C/D)", val: lineStep+"A", src:DS.reactor3r};
        loadFltItem = {comp:"Filtro de carga (dv/dt / senoidal)", devtag:"M"+tag, model:"Allen-Bradley 1321-RWR"+loadStep+" (confirmar sufijo de configuración)", val: loadStep+"A", src:DS.rwr};
      } else {
        const lineFlt = pickStep(REACTOR_STEPS, driveAmps);
        const loadFlt = pickStep(REACTOR_STEPS, driveAmps);
        lineFltItem = {comp:"Filtro de línea (reactancia entrada)", devtag:"L"+tag, model:"Reactancia clase "+lineFlt+"A (verificar con fabricante)", val: lineFlt+"A", src:DS.vfd};
        loadFltItem = {comp:"Filtro de carga (dv/dt / senoidal)", devtag:"M"+tag, model:"Filtro clase "+loadFlt+"A (verificar con fabricante)", val: loadFlt+"A", src:DS.vfd};
      }
      const memoEgc = withEGC(cmemo, brk);
      return { tag, kind:"motor", title:(load.desc||appMeta.label)+" · "+powerLbl, meta: "FLA "+fmtA(fla)+" · "+deratingTxt+" · I sel "+fmtA(isel)+(warn?" ⚠ fuera de catálogo":"")+" · "+demandTxt,
        mainContribution: brk, demandKVA, installedKVA, ...motorExtra, conductorMemo: memoEgc, items: [
          {comp:"ITM del VDF", devtag:"Q"+tag, model:breakerFamilyLabel(brk)+" (NEC 430.122, 125% corriente nominal de entrada)", val: "3x"+brk+"A", src:DS.tmax},
          {comp:"Portafusible", devtag:"F"+tag, model:"ABB EasyLine "+fuseSw[1]+" + fusible aR "+fuseRatingA+"A"+(mfgFuseA!=null ? (mfgFuseConfirmed?" (ABB ACS880-01 Hardware Manual)":" (interpolado entre escalones ABB — confirmar)") : " (NEC Tabla 430.52, 175% — confirmar contra tabla Allen-Bradley PowerFlex 755, pub. 750-TD001)"), val: fuseRatingA+"A", src:DS.xlp},
          lineFltItem,
          {comp:"Variador de frecuencia", devtag:"VDF"+tag, model:driveLabel, val: driveAmps+"A", src:driveSrc},
          loadFltItem,
          {comp:"Cable de fuerza (motor)", devtag:"—", model: cableModelText(cable, memoEgc.miguelez), val:"—", src:null},
          {comp:"Conductor de puesta a tierra (EGC)", devtag:"—", model: egcModelText(memoEgc.egc, memoEgc.egcMiguelez), val:"NEC Tabla 250.122", src:null},
        ]};
    } else {
      const ss = pick(SOFTSTARTER, isel, 0);
      const warn = exceeds(SOFTSTARTER, isel, 0);
      // Arrancador suave: rampa la corriente de arranque (no es un arranque directo pleno reflejado a línea),
      // igual razonamiento que el VDF — se usa NEC 430.122 (125%) para el ITM, no el 250% de motor DOL (430.52).
      const brk = pickStep(BREAKER_STEPS, fla*g.vfdBrkMult);
      const fuseSw = pick(FUSE_SWITCH_XLP, fla*g.fuseMult, 0);
      const cont = pick(CONTACTOR_AF, fla, 0);
      const ol = appMeta.class>=20 ? pick(OVERLOAD_ELECTRONIC, fla, 0) : pick(OVERLOAD_THERMAL, fla, 0);
      const memoEgc = withEGC(cmemo, brk);
      return { tag, kind:"motor", title:(load.desc||appMeta.label)+" · "+powerLbl, meta: "FLA "+fmtA(fla)+" · "+deratingTxt+" · I sel "+fmtA(isel)+(warn?" ⚠ fuera de catálogo":"")+" · "+demandTxt,
        mainContribution: brk, demandKVA, installedKVA, ...motorExtra, conductorMemo: memoEgc, items: [
          {comp:"ITM aguas arriba", devtag:"Q"+tag, model:breakerFamilyLabel(brk)+" (NEC 430.122, 125%)", val: "3x"+brk+"A", src:DS.tmax},
          {comp:"Portafusible", devtag:"F"+tag, model:"ABB EasyLine "+fuseSw[1]+" (NEC Tabla 430.52, 175% — confirmar contra tabla del fabricante del arrancador)", val: fuseSw[0]+"A", src:DS.xlp},
          {comp:"Arrancador suave", devtag:"SS"+tag, model:"ABB "+ss[1], val: ss[0]+"A", src:DS.ss},
          {comp:"Contactor de línea", devtag:"K"+tag, model:"ABB "+cont[1]+(cont[2]?"":" (verificar escalón)"), val: cont[0]+"A", src:DS.af},
          {comp:"Relé de sobrecarga", devtag:"F"+tag+"T", model:"ABB "+ol[1]+" (Cl."+appMeta.class+")", val: ol[2], src: appMeta.class>=20?DS.ef:DS.ta},
          {comp:"Cable de fuerza", devtag:"—", model: cableModelText(cable, memoEgc.miguelez), val:"—", src:null},
          {comp:"Conductor de puesta a tierra (EGC)", devtag:"—", model: egcModelText(memoEgc.egc, memoEgc.egcMiguelez), val:"NEC Tabla 250.122", src:null},
        ]};
    }
  }

  // ---- DOL ----
  const usesGuardamotor = flaOL <= GUARDAMOTOR[GUARDAMOTOR.length-1][0];
  if(usesGuardamotor){
    const gm = pick(GUARDAMOTOR, flaOL, 0);
    const cont = pick(CONTACTOR_AF, fla, 0);
    const memoEgc = withEGC(cmemo, gm[0]);
    return { tag, kind:"motor", title:(load.desc||appMeta.label)+" · "+powerLbl, meta: "FLA "+fmtA(fla)+" · sin derrateo (aparamenta electromecánica) · "+demandTxt,
      mainContribution: fla, demandKVA, installedKVA, ...motorExtra, conductorMemo: memoEgc, items: [
        {comp:"Guardamotor", devtag:"GC"+tag, model:"ABB "+gm[1], val: gm[0]+"A", src: guardamotorSrc(gm[1])},
        {comp:"Contactor", devtag:"K"+tag, model:"ABB "+cont[1]+(cont[2]?"":" (verificar escalón)"), val: cont[0]+"A", src:DS.af},
        {comp:"Protección térmica", devtag:"—", model:"Integrada en guardamotor (ajustable)", val:"—", src:null},
        {comp:"Cable de fuerza", devtag:"—", model: cableModelText(cable, memoEgc.miguelez), val:"—", src:null},
        {comp:"Conductor de puesta a tierra (EGC)", devtag:"—", model: egcModelText(memoEgc.egc, memoEgc.egcMiguelez), val:"NEC Tabla 250.122", src:null},
      ]};
  } else {
    // Motor DOL sin variador ni arrancador: el ITM debe soportar la corriente de arranque directo a plena tensión
    // (típicamente 6-8× FLA por unos ciclos) — aquí sí aplica NEC Tabla 430.52, interruptor de tiempo inverso: 250%.
    const brk = pickStep(BREAKER_STEPS, fla*g.brkMult);
    const cont = pick(CONTACTOR_AF, fla, 0);
    const ol = appMeta.class>=20 ? pick(OVERLOAD_ELECTRONIC, flaOL, 0) : pick(OVERLOAD_THERMAL, flaOL, 0);
    const memoEgc = withEGC(cmemo, brk);
    return { tag, kind:"motor", title:(load.desc||appMeta.label)+" · "+powerLbl, meta: "FLA "+fmtA(fla)+" · sin derrateo (aparamenta electromecánica) · "+demandTxt,
      mainContribution: brk, demandKVA, installedKVA, ...motorExtra, conductorMemo: memoEgc, items: [
        {comp:"ITM", devtag:"Q"+tag, model:breakerFamilyLabel(brk)+" (NEC Tabla 430.52, interruptor de tiempo inverso 250%)", val: "3x"+brk+"A", src:DS.tmax},
        {comp:"Contactor", devtag:"K"+tag, model:"ABB "+cont[1]+(cont[2]?"":" (verificar escalón)"), val: cont[0]+"A", src:DS.af},
        {comp:"Relé de sobrecarga", devtag:"F"+tag+"T", model:"ABB "+ol[1]+" (Cl."+appMeta.class+")", val: ol[2], src: appMeta.class>=20?DS.ef:DS.ta},
        {comp:"Cable de fuerza", devtag:"—", model: cableModelText(cable, memoEgc.miguelez), val:"—", src:null},
        {comp:"Conductor de puesta a tierra (EGC)", devtag:"—", model: egcModelText(memoEgc.egc, memoEgc.egcMiguelez), val:"NEC Tabla 250.122", src:null},
      ]};
  }
}
const DXF_LAYERS = {
  "0": {c:7, lw:-3}, "MARCO": {c:7, lw:-3}, "CAJETIN": {c:7, lw:-3},
  "E-FZA-BT-PRI": {c:230, lw:35}, "E-FZA-BT-SEC": {c:240, lw:15},
  "E-SIM": {c:60, lw:25}, "E-TIERRA": {c:150, lw:35}, "G-TEX": {c:7, lw:35},
  "G-FORMATO": {c:7}, "G-TEXT": {c:7}, "G-VARIOS": {c:40}, "I-SIM": {c:60}, "I-EQ": {c:1}, "I-SE-ANALO": {c:134}, "I-PROTOCOL": {c:134}, "I-FZA-AC": {c:230}, "I-FZA-DC": {c:180}, "I-CONTROL": {c:172}, "I-TIERRA": {c:150}, "I-FO": {c:70}, "I-DAT": {c:70}, "I-OCU": {c:30}, "E-EQ": {c:1}, "E-CONTROL": {c:172}, "E-FZA": {c:230}, "G-LOGO": {c:7}, "P-PROCESO": {c:5}, "P-EQUIPO": {c:7}, "G-PLANTA": {c:8},
};
const DXF_ACCENTS = {
  "á":"a","é":"e","í":"i","ó":"o","ú":"u","Á":"A","É":"E","Í":"I","Ó":"O","Ú":"U","ñ":"n","Ñ":"N","ü":"u","Ü":"U",
  "·":"-","Σ":"SUM","η":"n","Ω":"ohm","°":"deg","±":"+/-","²":"2","³":"3","≤":"<=","≥":">=","×":"x","–":"-","—":"-","…":"...",
};
// DXF R12/ASCII no admite UTF-8 arbitrario de forma confiable en todos los lectores de AutoCAD — se traducen
// los caracteres especiales conocidos (tildes, Σ, ·, etc.) y cualquier otro carácter no-ASCII remanente se
// descarta (en vez de dejarlo pasar corrupto, como ocurría antes con p.ej. "Σ" en los rótulos del transformador).
function dxfEsc(s){
  return String(s==null?"":s)
    .replace(/°/g,"%%d").replace(/±/g,"%%p").replace(/Ø/g,"%%c")
    .replace(/[^\x00-\xFF]/g, c=>DXF_ACCENTS[c]!=null ? DXF_ACCENTS[c] : "")
    .replace(/[\r\n\t]+/g," ");
}
function dxfTrunc(s,n){ s = dxfEsc(s); return s.length>n ? s.slice(0,n) : s; }
function dxfNum(n){ return (Math.round(n*1000)/1000).toString(); }

// ---- geometría de los símbolos (líneas, arcos, círculos y textos) con nombres propios (TBL_*). Cada entidad:
// ["L",x1,y1,x2,y2], ["C",cx,cy,r], ["A",cx,cy,r,ang1,ang2], ["P",cerrado0/1,x1,y1,...] (se emite como líneas sueltas,
// ver nota R12 en DXFDoc), ["T",x,y,h,rot,"texto"]. ITM3/ITM2 = interruptor termomagnético; FUSE2 = fusible 2 polos;
// DISC = seccionador; MOTOR = motor 3F; XFMR = transformador de control (no centrado: ver offset -8 en symTransformer()).
const DXF_BLOCKS = {
  ITM3: [["L",-6,0,-4,0],["L",-6,0,-7.5,3],["C",0,-3,1],["A",0.75,0,4.5,127,233],["C",0,3,1],["L",-1,-1,-5,-4],["T",-7.4154,-3.5134,2.5,0,"3"]],
  ITM2: [["L",-6,0,-4,0],["L",-6,0,-7.5,3],["C",0,-3,1],["A",0.75,0,4.5,127,233],["C",0,3,1],["L",-1,-1,-5,-4],["T",-7.4154,-3.5134,2.5,0,"2"]],
  FUSE2: [["T",-4.4077,-1.2694,2.5,0,"2"],["L",0,-3,0,-4],["L",-1,-1.5,1,-1.5],["L",0,4,0,3],["P",1,-1,3,-1,-3,1,-3,1,3],["L",-1,1.5,1,1.5],["L",0,-4,0,-7],["L",0,7,0,4],["L",-2,-1.5,2,1.5]],
  DISC: [["L",0,-4,0,-7],["L",0,7,0,4],["L",2.0586,2.6905,2.5,4],["L",2.1689,-2.0517,-0.6985,-1.1694],["L",3.0511,0.8157,0.1838,1.6979],["P",1,1.7278,-3.4853,-1.1396,-2.6031,0.6249,3.1316,3.4923,2.2493],["L",0.2941,-3.0442,0,-4],["T",-3.4506,-0.25,2.5,0,"3"],["L",3,-2,-1,1]],
  MOTOR: [["T",-2.9776,-3.3784,3,0,"3"],["A",0.6505,-2.638,0.75,20,160],["A",2.0255,-2.013,0.75,200,340],["T",-1.2857,0.7291,3,0,"M"],["C",0,0,6],["L",-1.75,6.75,1.75,8.75],["L",0,10,0,6],["T",2.5,6.5875,2.5,0,"3+PE"]],
  XFMR: [["L",8,-1,8,0],["L",3.2,-8.48,12.8,-8.48],["L",12.8,-7.52,3.2,-7.52],["A",4.4,-6.32,0.9,0,180],["A",6.2,-6.32,0.9,0,180],["A",8,-6.32,0.9,0,180],["A",9.8,-6.32,0.9,0,180],["A",11.6,-6.32,0.9,0,180],["L",12.5,-6.32,12.8,-6.32],["L",3.2,-6.32,3.5,-6.32],["L",3.2,-9.68,3.5,-9.68],["A",4.4,-9.68,0.9,180,0],["A",6.2,-9.68,0.9,180,0],["A",8,-9.68,0.9,180,0],["A",9.8,-9.68,0.9,180,0],["A",11.6,-9.68,0.9,180,0],["L",12.5,-9.68,12.8,-9.68],["L",3.2,-12.8,3.2,-9.68],["L",3.2,-3.2,3.2,-6.32],["L",12.8,-3.2,12.8,-7.52],["L",12.8,-12.8,12.8,-9.68],["P",1,16,-15,16,-1,0,-1,0,-15],["L",8,-16,8,-15]],

  // ---- REACTOR = reactor de línea/carga; VFD = variador; GUARDAMOTOR = protector de motor; CONTACTOR = contactor
  // de línea. Extremos de conexión: REACTOR ±10, VFD ±8, GUARDAMOTOR ±8, CONTACTOR ±6.
  REACTOR: [["A",-0.5145,-1.029,1.029,270,90],["L",-0.5145,-6.174,-0.5145,-4.116],["L",1.5435,4.116,1.5435,-4.116],["A",-0.5145,1.029,1.029,270,90],["A",-0.5145,-3.087,1.029,270,90],["L",-0.5145,4.116,-0.5145,6.174],["A",-0.5145,3.087,1.029,270,90],["T",2.4564,4.9762,1.7064,0,"3"],["L",-2.2295,4.1744,1.2005,6.1156],["P",1,-4.5,-8,4.5,-8,4.5,8,-4.5,8],["L",0,8,0,10],["L",0,-10,0,-8]],
  VFD: [["P",1,-8,-8,8,-8,8,8,-8,8],["L",-8,8,0,4],["L",0,4,8,8],["T",-2.4554,-1.25,2.5,0,"VFD"]],
  GUARDAMOTOR: [["L",-1,3,-5,0],["T",-7.5179,-1.4125,2.5,0,"3"],["L",-6,4,-3.75,4],["L",-6,4,-7.5,7],["L",0,0,0,-0.75],["C",0,1,1],["L",0,-8,0,-7.25],["L",2.25,-1.25,-2.25,-2],["L",0,-0.75,2.25,-1.25],["L",-2.25,-2,0,-2.5],["L",0,-2.5,0,-3.25],["C",0,7,1],["A",0,-6.25,1,0,270],["A",0,-4.25,1,180,90],["A",0.75,4,4.5,127,233]],
  CONTACTOR: [["L",0,-4,0,-6],["L",0,6,0,5],["L",0,-1,0,-4],["L",0,5,0,1],["L",-2,-1,2,-1],["L",-2,1,2,1],["L",-1.5,1.75,1.5,3.25],["T",1.8898,2.2748,1.6254,0,"3"]],

  // ---- formato de lámina ISO A1 (841x594 mm): marco con cuadrícula, rótulo principal (TITLE_MAIN), tabla de
  // revisiones (TITLE_REV), planos de referencia (TITLE_REF) y bloque de aprobación (TITLE_CTR). Se insertan a escala
  // según el tamaño de hoja elegido; los textos variables se escriben aparte en dibujarLamina().
  TITLE_MAIN: [
    ["T",29.151,6.325,2.5,0,"ESTE PLANO NO ES VALIDO A MENOS QUE LA ULTIMA REVISION ESTE FIRMADA A MANO"],
    ["T",512.539,11.75,2.5,0,"VALID. PARA CONSTRUC."],["L",798,35.25,773,35.25],["L",798,37.015,773,37.015],
    ["L",798,38.781,773,38.781],["S",785.5,35.25,785.5,37.015,773,35.25,773,37.015],["S",791.75,37.015,791.75,38.781,785.5,37.015,785.5,38.781],
    ["T",783.502,39.47,1.246,0,"12.5"],["L",791.75,35.25,791.75,38.781],["L",785.5,35.25,785.5,38.781],["T",797.545,39.47,1.246,0,"0"],
    ["L",798,35.25,798,38.781],["S",798,35.25,798,37.015,791.75,35.25,791.75,37.015],["T",772.07,39.47,1.246,0,"25"],["L",773,35.25,773,38.781],
    ["T",776.282,41.923,2.5,0,"ADVERTENCIA"],["T",779.984,29.717,1.5,0," EL DIBUJO"],["T",771.604,32.244,1.5,0,"SI ESTA BARRA NO MIDE 25mm"],
    ["T",777.087,27.19,1.5,0,"NO ESTA A ESCALA."],["T",21.55,520.915,2.5,0,"1"],["P",1,831,579,25,579,25,10,831,10],["P",0,831,584,25,584],
    ["P",0,20,579,20,10],["P",1,20,46,8,46,8,211.1,20,211.1],["P",0,14,46,14,211.1],["P",0,8,111,20,111],["P",0,14,156,20,156],["L",831,579,831,584],
    ["L",25,10,20,10],["L",25,579,20,579],["L",25,579,25,584],["P",0,295,46,295,10],["P",0,421,46,421,9.802],["P",0,446,40,446,9.802],
    ["P",0,511,46,511,9.802],["P",0,551,16,551,9.802],["P",0,588,16,588,9.802],["P",0,599,16,599,9.802],["P",0,616,46,616,9.802],
    ["P",0,766,46,766,9.802],["P",0,805,46,805,26],["L",25,10,831,10],["L",421,16,511,16],["L",421,22,511,22],["L",421,28,511,28],
    ["P",1,25,46,831,46,831,10,25,10],["P",0,471,40,471,9.802],["P",0,491,40,491,9.802],["P",0,420.981,40,511,40],["P",0,420.981,34,511,34],
    ["L",511,16,616,16],["L",511,22,616,22],["L",511,28,616,28],["L",766,26,831,26],["P",1,821,10,826,18.66,831,10],
    ["P",1,836,46,831,46,831,66,836,66],["L",805,40,831,40],["T",767.125,22.419,2.5,0,"PLANO No:"],["T",805.73,41.538,2.5,0,"ESC:"],
    ["T",805.844,36.063,2.5,0,"PROYECTO No:"],["T",428.996,41.5,2.5,0,"PROCEDIMIENTO DE REVISION Y VALIDACION"],
    ["T",423.41,35.78,2.5,0,"RESPONSABLE"],["T",426.4,29.9,2.5,0,"DIBUJADO"],["T",426.34,23.88,2.5,0,"DISENADO"],
    ["T",426.5,11.83,2.5,0,"VALIDADO"],["T",424.09,17.79,2.5,0,"COORD. PROY."],["T",455.73,35.75,2.5,0,"POR"],
    ["T",477.06,35.75,2.5,0,"FIRMA"],["T",495.85,35.75,2.5,0,"FECHA"],["T",74.31,580.58,2.5,0,"A"],["T",175.06,580.58,2.5,0,"B"],
    ["T",275.81,580.58,2.5,0,"C"],["T",376.56,580.58,2.5,0,"D"],["T",477.31,580.58,2.5,0,"E"],["T",578.06,580.58,2.5,0,"F"],
    ["T",678.81,580.58,2.5,0,"G"],["T",779.56,580.58,2.5,0,"H"],["T",21.42,407.11,2.5,0,"2"],["T",21.42,293.31,2.5,0,"3"],
    ["T",21.37,179.51,2.5,0,"4"],["T",21.42,65.71,2.5,0,"5"],["P",1,841,594,0,594,0,0,841,0],["P",0,0,10,0,0,10,0],["P",0,841,584,841,594,831,594],
    ["L",656,579,656,584],["L",25,297,20,297],["L",471,579,471,584],["L",210,579,210,584],["L",569,16,569,9.802],
  ],
  TITLE_REV: [
    ["T",3.65,31.782,2.5,0,"No."],["T",51.92,32.215,2.5,0,"REVISIONES"],["T",181.165,31.94,2.5,0,"JEFE/COORD.:"],
    ["T",138.51,31.94,2.5,0,"DIBUJADO POR:"],["T",217.785,31.94,2.5,0,"APROBADO POR:"],["T",255.224,31.873,2.5,0,"FECHA"],["L",270,36,270,0],
    ["L",270,0,0,0],["L",0,0,0,36],["L",130,0,130,36],["L",170,0,170,36],["L",250,0,250,36],["L",0,6,270,6],["L",0,12,270,12],["L",0,24,270,24],
    ["P",0,0,30,270,30],["P",0,0,18,270,18],["P",0,0,0,5,6,10,0],["L",153,0,153,30],["L",193,0,193,30],["L",0,30,270,30],["L",0,36,270,36],
    ["L",10,0,10,36],["P",0,0,6,5,12,10,6],["P",0,0,12,5,18,10,12],["P",0,0,18,5,24,10,18],["P",0,0,24,5,30,10,24],["L",233,0,233,30],
    ["L",210,0,210,36],
  ],
  TITLE_REF: [
    ["T",10.749,31.81,2.5,0,"No. PLANO REF."],["T",62.276,31.794,2.5,0,"NOMBRE PLANO DE REFERENCIA"],["L",126,36,126,0],["L",126,0,0,0],
    ["L",0,0,0,36],["L",44.98,0,44.98,36],["L",0,6,126,6],["P",0,0,30,126,30],["L",0,12,126,12],["L",0,18,126,18],["L",0,24,126,24],
    ["L",0,36,126,36],
  ],
  TITLE_CTR: [
    ["P",0,0,26,90,26],["P",0,0,19.5,90,19.5],["P",0,0,13,90,13],["P",0,0,6.5,90,6.5],["P",0,0,32.5,90,32.5],["T",2.71,28.076,2.5,0,"RESPONSABLE"],
    ["T",33.701,27.942,2.5,0,"POR"],["T",56.567,27.851,2.5,0,"FIRMA"],["T",75.779,27.851,2.5,0,"FECHA"],["T",1.184,21.799,2.5,0,"CHEKER/DIBUJO"],
    ["T",0.876,15.256,2.5,0,"DISENO/QA-QC"],["P",0,25,32.5,25,0],["P",0,50,32.5,50,0],["P",0,70,32.5,70,0],["T",0.876,8.756,2.5,0,"JEFE/COOR."],
    ["T",1.513,2.256,2.5,0,"APROBACION"],["P",1,0,40,90,40,90,0,0,0],["P",1,-56.444,40,0,40,0,0,-56.444,0],["L",-51.631,16.412,-40.418,16.412],
    ["L",-40.418,16.412,-46.024,26.123],["L",-51.631,16.412,-46.024,26.123],["L",-46.024,26.123,-46.024,19.531],["L",-51.631,16.412,-46.024,19.531],
    ["L",-46.024,19.531,-40.418,16.412],
  ],
  TITLE_CTR2: [
    ["P",1,0,0,89.711,0,89.711,12.285,0,12.285],
  ],
};

class DXFDoc{
  constructor(){ this.entities = []; this.layersUsed = new Set(["0"]); this.blocksUsed = new Set(); }
  _layer(name){ this.layersUsed.add(name); return name; }
  line(x1,y1,x2,y2,layer){
    layer = this._layer(layer||"0");
    this.entities.push("0\nLINE\n8\n"+layer+"\n10\n"+dxfNum(x1)+"\n20\n"+dxfNum(y1)+"\n30\n0.0\n11\n"+dxfNum(x2)+"\n21\n"+dxfNum(y2)+"\n31\n0.0");
  }
  circle(cx,cy,r,layer){
    layer = this._layer(layer||"0");
    this.entities.push("0\nCIRCLE\n8\n"+layer+"\n10\n"+dxfNum(cx)+"\n20\n"+dxfNum(cy)+"\n30\n0.0\n40\n"+dxfNum(r));
  }
  text(x,y,h,str,layer,opt){
    opt = opt||{};
    layer = this._layer(layer||"G-TEX");
    let e = "0\nTEXT\n8\n"+layer+"\n10\n"+dxfNum(x)+"\n20\n"+dxfNum(y)+"\n30\n0.0\n40\n"+dxfNum(h)+"\n1\n"+dxfEsc(str);
    if(opt.rot) e += "\n50\n"+dxfNum(opt.rot);
    if(opt.halign){ e += "\n72\n"+opt.halign+"\n11\n"+dxfNum(x)+"\n21\n"+dxfNum(y)+"\n31\n0.0"; }
    this.entities.push(e);
  }
  rect(x,y,w,h,layer){
    this.line(x,y,x+w,y,layer); this.line(x+w,y,x+w,y+h,layer);
    this.line(x+w,y+h,x,y+h,layer); this.line(x,y+h,x,y,layer);
  }
  polyline(pts,layer){
    for(let i=0;i<pts.length-1;i++) this.line(pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],layer);
  }
  // inserta una instancia del bloque real `key` (una de las claves de DXF_BLOCKS) en (x,y), escala 1,
  // rotación 0 — igual que TODAS las instancias reales en el plano del cliente (se verificó que ninguna
  // usa escala ni rotación distinta de 1/1/0). El bloque se define una sola vez en la sección BLOCKS
  // (deduplicado por blocksUsed) sin importar cuántas veces se inserte.
  // sx/sy (opcionales, por defecto 1): escala de inserción (códigos 41/42, grupo básico de INSERT desde
  // R1 — a diferencia de lineweight/STYLE, NO es un riesgo de compatibilidad R12). Se usa para el cajetín
  // real (bloques TITLE_*), que se define a su tamaño nativo (hoja ISO A1, 841x594mm) y se reescala al
  // tamaño de hoja elegido en cada plano; los símbolos de circuito siguen insertándose a escala 1 (como
  // en el plano real).
  insertBlock(key,x,y,layer,sx,sy){
    this.blocksUsed.add(key);
    layer = this._layer(layer||"E-SIM");
    let e = "0\nINSERT\n8\n"+layer+"\n2\nTBL_"+key+"\n10\n"+dxfNum(x)+"\n20\n"+dxfNum(y)+"\n30\n0.0";
    if(sx!=null && sx!==1) e += "\n41\n"+dxfNum(sx);
    if(sy!=null && sy!==1) e += "\n42\n"+dxfNum(sy);
    this.entities.push(e);
  }
  toDXF(){
    // tabla LAYER con SOLO los códigos de grupo válidos en DXF R12 puro (0,2,70,62,6). Un intento anterior
    // agregó lineweight (370, código introducido recién en R2000/AC1015) y una tabla STYLE con referencia
    // de texto (código 7 en TEXT) buscando más fidelidad visual — eso rompió la apertura en AutoCAD real
    // (pantalla en negro + "Press ENTER to continue" repetido = el parser estricto de AutoCAD atascado en
    // códigos de grupo que no reconoce para un archivo declarado AC1009). Revertido: solo color (62) por
    // capa, que es 100% válido en R12 puro y es lo que de verdad cambia la apariencia.
    const layerDefs = [...this.layersUsed].map(name=>{
      const spec = DXF_LAYERS[name] || {c:7, lw:-3};
      return "0\nLAYER\n2\n"+name+"\n70\n0\n62\n"+spec.c+"\n6\nCONTINUOUS";
    }).join("\n");
    // sección BLOCKS: solo se definen los bloques realmente usados (deduplicado vía blocksUsed). Las
    // entidades internas van en capa "0" con color 0 (ByBlock) — igual que en el plano real — para que
    // adopten el color de la capa E-SIM al insertarse. Nota R12: el tipo "LWPOLYLINE" no existe en DXF R12
    // (llegó recién en AC1015/AutoCAD 2000); cada primitiva "P" se descompone en segmentos LINE sueltos,
    // igual que el resto del generador (ver DXFDoc.polyline), para no repetir el error que ya rompió la
    // apertura en AutoCAD real con códigos de grupo de versiones posteriores.
    const blockEntityDXF = (e)=>{
      const t = e[0];
      if(t==="L") return "0\nLINE\n8\n0\n62\n0\n10\n"+dxfNum(e[1])+"\n20\n"+dxfNum(e[2])+"\n30\n0.0\n11\n"+dxfNum(e[3])+"\n21\n"+dxfNum(e[4])+"\n31\n0.0";
      if(t==="C") return "0\nCIRCLE\n8\n0\n62\n0\n10\n"+dxfNum(e[1])+"\n20\n"+dxfNum(e[2])+"\n30\n0.0\n40\n"+dxfNum(e[3]);
      if(t==="A") return "0\nARC\n8\n0\n62\n0\n10\n"+dxfNum(e[1])+"\n20\n"+dxfNum(e[2])+"\n30\n0.0\n40\n"+dxfNum(e[3])+"\n50\n"+dxfNum(e[4])+"\n51\n"+dxfNum(e[5]);
      if(t==="T") return "0\nTEXT\n8\n0\n62\n0\n10\n"+dxfNum(e[1])+"\n20\n"+dxfNum(e[2])+"\n30\n0.0\n40\n"+dxfNum(e[3])+"\n1\n"+dxfEsc(e[5])+(e[4]?"\n50\n"+dxfNum(e[4]):"");
      if(t==="S") return "0\nSOLID\n8\n0\n62\n0\n10\n"+dxfNum(e[1])+"\n20\n"+dxfNum(e[2])+"\n30\n0.0\n11\n"+dxfNum(e[3])+"\n21\n"+dxfNum(e[4])+"\n31\n0.0\n12\n"+dxfNum(e[5])+"\n22\n"+dxfNum(e[6])+"\n32\n0.0\n13\n"+dxfNum(e[7])+"\n23\n"+dxfNum(e[8])+"\n33\n0.0";
      if(t==="P"){
        const closed = e[1];
        const pts = [];
        for(let i=2;i<e.length;i+=2) pts.push([e[i],e[i+1]]);
        if(closed) pts.push(pts[0]);
        const segs = [];
        for(let i=0;i<pts.length-1;i++) segs.push(blockEntityDXF(["L",pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1]]));
        return segs.join("\n");
      }
      return "";
    };
    const blockDefs = [...this.blocksUsed].map(key=>{
      const ents = (DXF_BLOCKS[key]||[]).map(blockEntityDXF).join("\n");
      return "0\nBLOCK\n8\n0\n2\nTBL_"+key+"\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n"+ents+"\n0\nENDBLK\n8\n0";
    }).join("\n");
    return [
      "0","SECTION","2","HEADER","9","$ACADVER","1","AC1009","9","$DWGCODEPAGE","3","ANSI_1252","9","$INSUNITS","70","4","0","ENDSEC",
      "0","SECTION","2","TABLES","0","TABLE","2","LAYER","70",String(this.layersUsed.size),
      layerDefs, "0","ENDTAB","0","ENDSEC",
      "0","SECTION","2","BLOCKS", blockDefs, "0","ENDSEC",
      "0","SECTION","2","ENTITIES", this.entities.join("\n"),
      "0","ENDSEC","0","EOF"
    ].filter(s=>s!=="").join("\n");
  }
}
// Tamaños ISO (mismo formato que el plano real del cliente, que es A1 — 841x594mm — en vez de ANSI):
// se eligió la serie ISO porque TODA mantiene la misma proporción (1:raiz(2)), así el cajetín real
// (dibujado a su tamaño nativo A1) se reescala sin distorsión a cualquiera de estos tamaños con un
// solo factor k=w/841 (ver drawRealTitleBlockDXF). code se usa solo como etiqueta informativa.
const ANSI_SHEETS_MM = [ {code:"A3", w:420, h:297}, {code:"A2", w:594, h:420}, {code:"A1", w:841, h:594}, {code:"A0", w:1189, h:841} ];
function pickAnsiSheet(neededW, neededH){
  // margen heurístico: ~50mm de ancho (el cajetín real deja ~35mm de margen horizontal) y ~150mm de
  // alto (cajetín real ocupa ~99mm de alto en la base + un margen superior ~15mm, a tamaño A1 nativo)
  for(const s of ANSI_SHEETS_MM){ if(neededW<=s.w-50 && neededH<=s.h-150) return s; }
  return ANSI_SHEETS_MM[ANSI_SHEETS_MM.length-1];
}

// ---- símbolos unifilares: AHORA son instancias (INSERT) de los bloques reales extraídos del plano del
// cliente (DXF_BLOCKS / doc.insertBlock), no geometría aproximada dibujada a mano. Todas las instancias
// reales en el archivo original usan escala 1 y rotación 0 (verificado), así que no se reescala por
// contexto como antes — el tamaño relativo entre símbolos lo da el paso (pitch) del circuito, igual que
// en el plano real. El parámetro "size"/"r"/"w"/"h" de cada función se conserva por compatibilidad con
// las llamadas existentes pero ya no afecta el dibujo (la escala real es fija).
function symBreaker(doc,x,y,size,poles){ doc.insertBlock(poles===2 ? "ITM2" : "ITM3", x, y, "E-SIM"); }
function symFuse(doc,x,y,size,poles){ doc.insertBlock("FUSE2", x, y, "E-SIM"); }
function symMotor(doc,x,y,r){ doc.insertBlock("MOTOR", x, y, "E-SIM"); }
// VFD/arrancador suave: no se identificó un bloque EPLAN propio para esto en el plano de referencia
// (solo tenía arranque directo); se mantiene el recuadro rotulado genérico hasta tener un circuito real
// con VFD/SS que sirva de referencia para extraer su símbolo.
function symBox(doc,x,y,w,h,label){ doc.rect(x-w/2,y-h/2,w,h,"E-SIM"); if(label) doc.text(x,y-h*0.22,h*0.4,label,"E-SIM",{halign:1}); }
function symFeeder(doc,x,y,w,h){ doc.insertBlock("DISC", x, y, "E-SIM"); }
// el bloque real del transformador no está centrado en su propio punto de inserción (su geometría ocupa
// x:[0,16] en vez de [-8,8]) — se compensa desplazando -8 para que quede centrado sobre el eje del circuito,
// igual que en el plano real (su INSERT real está en x=355.07 para un troncal centrado en x=363.07).
function symTransformer(doc,x,y,r){ doc.insertBlock("XFMR", x-8, y, "E-SIM"); }
// símbolo de puesta a tierra (escalera IEEE), chico — cruce de cada circuito con la barra de tierra común
function symGroundSmall(doc,x,y,w){
  doc.line(x,y+3,x,y,"E-TIERRA");
  [[w,0],[w*0.6,-2.2],[w*0.28,-4.2]].forEach(([bw,dy])=>{ doc.line(x-bw/2,y+dy,x+bw/2,y+dy,"E-TIERRA"); });
}
// símbolo de puesta a tierra (pozo), grande — una sola vez, en el extremo izquierdo de la barra de tierra
function symGroundElectrode(doc,x,y,w){
  doc.line(x,y,x,y-3,"E-TIERRA");
  [[w,-3],[w*0.62,-5.4],[w*0.30,-7.8]].forEach(([bw,dy])=>{ doc.line(x-bw/2,y+dy,x+bw/2,y+dy,"E-TIERRA"); });
}
function arrowHeadDown(doc,x,y,size,layer){
  doc.polyline([[x-size*0.4,y+size],[x,y],[x+size*0.4,y+size]],layer||"E-FZA-BT-PRI");
}

// Cajetín real: inserta los 5 bloques reales (TITLE_MAIN/REV/REF/CTR/CTR2 — ver notas en DXF_BLOCKS)
// en sus posiciones nativas relativas a la hoja (idénticas a las del plano del cliente en paperspace),
// escalados por k=W/841 para que el formato se vea igual sin importar el tamaño de hoja ISO elegido.
// Luego coloca el CONTENIDO dinámico (proyecto, tablero, firmas, fecha, N de plano, escala, revisión)
// como TEXT independiente encima de cada "slot" ATTDEF real (mismas coordenadas nativas, escaladas
// igual) — los campos sin dato disponible en meta quedan en blanco (no se fabrica información) salvo
// los 2 campos donde la plantilla real ya usa un texto fijo propio (ver comentarios abajo).
// Formato de lámina + cajetín del CLIENTE (DXF cargados en Ingenia → window.INGENIA_FORMAT). La geometría
// fija se inserta como bloques; los textos marcados {{TOKEN}} se reemplazan por los datos del plano en la
// misma posición/altura/rotación. Si solo hay cajetín (sin formato), se coloca en la esquina inferior
// derecha de la hoja ISO elegida, a 10 mm del borde.
function drawClientTitleBlockDXF(doc, F, W, H, k, meta){
  const S = "CAJETIN";
  const vals = {
    PLANO: meta.planNo, TITULO: "DIAGRAMA UNIFILAR", TITULO2: meta.tableroName||"", PROYECTO: meta.projectName||"", CLIENTE: meta.clientName||"",
    REV: meta.rev, FECHA: meta.date, ESCALA: meta.scale, DIBUJO: meta.drawnBy, REVISO: meta.checkedBy, APROBO: meta.approvedBy, HOJA: "1 de 1", EMPRESA: meta.companyName||"",
  };
  const place = (part, ox, oy, key)=>{
    if(!part) return;
    DXF_BLOCKS[key] = part.compact;
    doc.insertBlock(key, ox, oy, S);
    part.tokens.forEach(t=>{
      const txt = t.text.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (m,kk)=>{ const v = vals[kk.toUpperCase()]; return v==null ? "" : String(v); }).trim();
      if(txt) doc.text(ox+t.x, oy+t.y, t.h, dxfTrunc(txt, 60), S, { rot: t.rot||0 });
    });
  };
  if(F.formato) place(F.formato, 0, 0, "CLI_FORMATO");
  if(F.cajetin){
    const cw = F.cajetin.bounds.w, ch = F.cajetin.bounds.h;
    // si el cajetín viene del mismo dibujo que el formato, conserva su posición relativa; si no, abajo a la derecha
    let ox = W - cw - 10, oy = 10;
    if(F.formato){
      const relX = F.cajetin.bounds.minX - F.formato.bounds.minX, relY = F.cajetin.bounds.minY - F.formato.bounds.minY;
      if(relX>=0 && relY>=0 && relX+cw<=W+1 && relY+ch<=H+1){ ox = relX; oy = relY; }
    }
    place(F.cajetin, ox, oy, "CLI_CAJETIN");
  }
}

function drawRealTitleBlockDXF(doc,k,meta){
  const S = "CAJETIN";
  doc.insertBlock("TITLE_MAIN", 0, 0, S, k, k);
  doc.insertBlock("TITLE_REV", 25.25*k, 10.25*k, S, k, k);
  doc.insertBlock("TITLE_REF", 295.25*k, 10.25*k, S, k, k);
  doc.insertBlock("TITLE_CTR", 741.25*k, 46.25*k, S, k, k);
  doc.insertBlock("TITLE_CTR2", 741.25*k, 86.25*k, S, k, k);

  const put = (baseX,baseY,lx,ly,h,val)=>{ if(val) doc.text(baseX+lx*k, baseY+ly*k, h*k, dxfTrunc(String(val),40), S); };
  // --- slots dentro de TITLE_MAIN (inserción en 0,0) ---
  put(0,0, 664.917,26.25,3.5, meta.projectName);
  put(0,0, 669.833,11.85,3.5, "DIAGRAMA UNIFILAR - "+(meta.tableroName||""));
  put(0,0, 767.963,14.452,4.0, meta.planNo);
  put(0,0, 812.623,41.497,3.0, meta.scale);
  put(0,0, 820.847,11.251,3.0, meta.rev);
  put(0,0, 448.0,29.75,2.5, meta.drawnBy);
  put(0,0, 491.573,29.75,2.5, meta.date||"FECHA");
  put(0,0, 448.0,23.75,2.5, meta.checkedBy);
  put(0,0, 491.573,23.75,2.5, meta.date||"FECHA");
  put(0,0, 448.0,11.75,2.5, meta.approvedBy);
  put(0,0, 491.573,11.75,2.5, meta.date||"FECHA");
  // --- slots dentro de TITLE_CTR (inserción en 741.25,46.25) ---
  const ctrX = 741.25*k, ctrY = 46.25*k;
  put(ctrX,ctrY, 11.681,34.819,2.5, "PROCEDIMIENTO DE APROBACION ("+dxfTrunc((meta.companyName||"").toUpperCase(),28)+")");
  put(ctrX,ctrY, 30.368,21.463,2.5, meta.drawnBy);
  put(ctrX,ctrY, 30.011,14.725,2.5, meta.checkedBy);
  put(ctrX,ctrY, 29.33,1.963,2.5, meta.approvedBy);
  put(ctrX,ctrY, 75.189,21.463,2.5, meta.date);
  put(ctrX,ctrY, 74.922,14.963,2.5, meta.date);
  put(ctrX,ctrY, 74.877,1.963,2.5, meta.date);
  // --- slots dentro de TITLE_CTR2 (inserción en 741.25,86.25) ---
  const ctr2X = 741.25*k, ctr2Y = 86.25*k;
  put(ctr2X,ctr2Y, 0.88,8.285,2.5, (meta.companyName||"").toUpperCase()+" - PLANO No: "+(meta.planNo||"-"));
  put(ctr2X,ctr2Y, 1.251,2.54,3.0, meta.planNo);
}

// cadena de protección de cada circuito de la barra principal. Para motor VFD y motor DOL con guardamotor
// se reproduce la cadena REAL del plano de referencia (circuitos C1 y C2: ver DXF_BLOCKS), con sus
// símbolos reales (portafusible, reactores, VFD, guardamotor, contactor) — antes esto se dibujaba con un
// solo breaker genérico y un recuadro rotulado, sin reactores ni contactor visibles. Para alimentador,
// control, motor DOL grande (ITM+contactor sin guardamotor) y SS (sin referencia real todavía) se mantiene
// el trazo genérico. Devuelve el y donde terminó la cadena (antes de bajar hacia la barra de tierra común).
function drawDeviceChainDXF(doc,x,busY,c){
  let y = busY;
  const step = (dy)=>{ const ny=y-dy; doc.line(x,y,x,ny,"E-FZA-BT-PRI"); y=ny; };
  const mainItem = c.items[0];
  const vfdItem = c.kind==="motor" ? c.items.find(it=>it.devtag && it.devtag.indexOf("VDF")===0) : null;
  const ssItem = c.kind==="motor" ? c.items.find(it=>it.devtag && it.devtag.indexOf("SS")===0) : null;
  const gmItem = c.kind==="motor" ? c.items.find(it=>it.devtag && it.devtag.indexOf("GC")===0) : null;
  const contItem = c.kind==="motor" ? c.items.find(it=>it.comp==="Contactor"||it.comp==="Contactor de línea") : null;

  if(c.kind==="motor" && vfdItem){
    // patrón real de C1 (ventilador + VFD): ITM → portafusible (mismo bloque real "seccionador fusible"
    // que el alimentador) → reactor de línea → VFD → reactor de carga. Distancias de la misma magnitud
    // que las posiciones reales de inserción del plano (no exactas al mm — la prioridad pedida es la
    // simbología, no el espaciado).
    step(8);
    symBreaker(doc,x,y,9,3);
    doc.text(x+7,y+0.5,2.8,dxfTrunc(mainItem.devtag+" "+mainItem.val,22),"G-TEX");
    step(22);
    const fuseItem = c.items.find(it=>it.comp==="Portafusible");
    doc.insertBlock("DISC",x,y-7,"E-SIM");
    if(fuseItem) doc.text(x+9,y-6.5,2.6,dxfTrunc(fuseItem.devtag+" "+fuseItem.val,20),"G-TEX");
    y -= 14;
    step(18);
    const lineFlt = c.items.find(it=>it.devtag && it.devtag[0]==="L");
    doc.insertBlock("REACTOR",x,y-10,"E-SIM");
    if(lineFlt) doc.text(x+9,y-9,2.4,dxfTrunc(lineFlt.devtag+" "+lineFlt.val,18),"G-TEX");
    y -= 20;
    step(10);
    doc.insertBlock("VFD",x,y-8,"E-SIM");
    doc.text(x+9,y-7,2.6,dxfTrunc(vfdItem.devtag+" "+vfdItem.val,18),"G-TEX");
    y -= 16;
    step(10);
    const loadFlt = c.items.find(it=>it.devtag && it.devtag[0]==="M");
    doc.insertBlock("REACTOR",x,y-10,"E-SIM");
    if(loadFlt) doc.text(x+9,y-9,2.4,dxfTrunc(loadFlt.devtag+" "+loadFlt.val,18),"G-TEX");
    y -= 20;
    return y;
  }
  if(c.kind==="motor" && gmItem){
    // patrón real de C2 (válvula rotativa / DOL pequeño): guardamotor → contactor
    step(8);
    doc.insertBlock("GUARDAMOTOR",x,y-8,"E-SIM");
    doc.text(x+8,y-3,2.6,dxfTrunc(gmItem.devtag+" "+gmItem.val,20),"G-TEX");
    y -= 16;
    step(26);
    doc.insertBlock("CONTACTOR",x,y-6,"E-SIM");
    if(contItem) doc.text(x+7,y-3,2.6,dxfTrunc(contItem.devtag+" "+contItem.val,18),"G-TEX");
    y -= 12;
    return y;
  }
  if(c.kind==="motor" && contItem && !ssItem){
    // motor DOL grande (ITM + contactor separado, sin guardamotor): sin un circuito real de este caso
    // puntual en el plano compartido — se usa el mismo ITM real + el contactor real ya identificado.
    step(8);
    symBreaker(doc,x,y,9,3);
    doc.text(x+7,y+0.5,2.8,dxfTrunc(mainItem.devtag+" "+mainItem.val,22),"G-TEX");
    step(18);
    doc.insertBlock("CONTACTOR",x,y-6,"E-SIM");
    doc.text(x+7,y-3,2.6,dxfTrunc(contItem.devtag+" "+contItem.val,18),"G-TEX");
    y -= 12;
    return y;
  }

  // genérico (alimentador, control, y motor SS sin referencia real todavía)
  step(8);
  if(c.kind==="control") symFuse(doc,x,y,7,2); else symBreaker(doc,x,y,9,3);
  doc.text(x+7,y+0.5,2.8,dxfTrunc(mainItem.devtag+" "+mainItem.val,22),"G-TEX");
  step(16);
  if(c.kind==="motor" && ssItem){ symBox(doc,x,y,16,10,"SS"); doc.text(x+10,y+0.5,2.6,dxfTrunc(ssItem.devtag+" "+ssItem.val,20),"G-TEX"); step(18); }
  return y;
}

// rótulo de cable (si hay memoria de conductor calculada) con línea de bajada y flecha, estilo plano IEEE:
// "1-3C#<fase AWG>+<EGC AWG>(T) 0.6/1kV". Devuelve el y donde terminó el rótulo.
function drawCableLabelDXF(doc,x,y,cmemo){
  if(cmemo && cmemo.cable){
    const faseAwg = String(cmemo.cable[0]).replace(/\s+/g,"");
    const egcAwg = cmemo.egc ? String(cmemo.egc[1]).replace(/\s+/g,"") : faseAwg;
    const spec = "1-3C#"+faseAwg+"+"+egcAwg+"(T) 0.6/1kV";
    doc.line(x,y,x,y-32,"E-FZA-BT-PRI");
    doc.text(x-2.2,y-4,2.2,dxfTrunc(spec,34),"G-TEX",{rot:90});
    arrowHeadDown(doc,x,y-32,2.2,"E-FZA-BT-PRI");
    doc.line(x,y-32,x,y-36,"E-FZA-BT-PRI");
    return y-36;
  }
  doc.line(x,y,x,y-10,"E-FZA-BT-PRI");
  return y-10;
}

// rama de la barra principal (fuerza): cadena de protección → cruce con la barra de tierra común →
// rótulo de cable → símbolo de carga final (motor o alimentador).
function drawMainBranchDXF(doc,x,busY,groundY,c){
  const yChain = drawDeviceChainDXF(doc,x,busY,c);
  doc.line(x,yChain,x,groundY,"E-FZA-BT-PRI");
  symGroundSmall(doc,x,groundY,7);
  let y = drawCableLabelDXF(doc,x,groundY,c.conductorMemo);
  if(c.kind==="motor"){
    // bloque real del motor: vástago de conexión hacia arriba desde su centro hasta +10 — se ancla en
    // y-10 para que la punta del vástago coincida con el final de la línea entrante (antes: y-7/r=7 del
    // símbolo dibujado a mano, con radio 6 real el tope útil queda más abajo).
    symMotor(doc,x,y-10,7);
    doc.text(x+9,y-9.5,2.8,"M"+c.tag,"G-TEX");
    y -= 17;
    doc.text(x,y,2.6,dxfTrunc(c.descLabel||c.title,24),"G-TEX",{halign:1});
    y -= 4.5;
    if(c.powerHP!=null){ doc.text(x,y,2.4,c.powerHP.toFixed(1)+" HP","G-TEX",{halign:1}); y -= 4; }
  } else if(c.kind==="feeder"){
    // bloque real del seccionador: terminales simétricos a ±7 de su punto de inserción — se ancla en
    // y-7 para que el terminal superior coincida con el final de la línea entrante.
    symFeeder(doc,x,y-7,14,10);
    const xtag = (c.items.find(it=>it.devtag && it.devtag[0]==="X")||{}).devtag || "";
    doc.text(x+9,y-6.5,2.8,xtag,"G-TEX");
    y -= 18;
    doc.text(x,y,2.6,dxfTrunc(c.title,24),"G-TEX",{halign:1});
    y -= 4;
  } else if(c.kind==="control"){
    // circuito de control sin derivaciones cargadas todavía: se dibuja el tramo fusible→transformador
    // como un circuito más de la barra principal (sin carga ni cable propios). El bloque real del
    // transformador cuelga HACIA ABAJO desde su punto de inserción (no está centrado en él), así que el
    // ancla va en "y" directo —igual que en drawControlTrunkDXF— para que el tope del símbolo coincida
    // con el final de la línea entrante.
    symTransformer(doc,x,y,8);
    const tItem = c.items.find(it=>it.devtag && it.devtag[0]==="T");
    doc.text(x+10,y-7.5,2.6,dxfTrunc((tItem?tItem.devtag+" "+tItem.val:"T"+c.tag),22),"G-TEX");
    y -= 18;
  }
  doc.text(x,y-5,3.4,c.tag,"G-TEX",{halign:1});
}

// troncal de un circuito de control (fusible → transformador → ITM secundario), SIN carga ni cable
// propios: baja desde la barra principal y se conecta a la barra secundaria (de donde cuelgan sus
// derivaciones). Se posiciona centrada sobre el bloque de sus propias derivaciones, fuera de la
// secuencia de paso uniforme (así lo pidió el usuario para el caso real que sirvió de referencia).
function drawControlTrunkDXF(doc,x,busY,busY2,c){
  let y = busY;
  // tramo fusible→transformador: aún en tensión principal (E-FZA-BT-PRI). Tal como se observó en el
  // plano real, el cambio a E-FZA-BT-SEC ocurre justo después del transformador, antes del ITM
  // secundario y de la bajada hacia la barra de control.
  const stepPri = (dy)=>{ const ny=y-dy; doc.line(x,y,x,ny,"E-FZA-BT-PRI"); y=ny; };
  const stepSec = (dy)=>{ const ny=y-dy; doc.line(x,y,x,ny,"E-FZA-BT-SEC"); y=ny; };
  stepPri(8);
  const fItem = c.items.find(it=>it.devtag && it.devtag[0]==="F") || c.items[0];
  symFuse(doc,x,y,7,2);
  doc.text(x+7,y+0.5,2.8,dxfTrunc(fItem.devtag+" "+fItem.val,22),"G-TEX");
  stepPri(16);
  symTransformer(doc,x,y,8);
  const tItem = c.items.find(it=>it.devtag && it.devtag[0]==="T");
  doc.text(x+10,y+0.5,2.8,dxfTrunc((tItem?tItem.devtag+" "+tItem.val:"T"+c.tag),24),"G-TEX");
  stepSec(18);
  const secItem = c.items.find(it=>it.comp && it.comp.indexOf("ITM principal de control")===0);
  if(secItem){ symBreaker(doc,x,y,8,2); doc.text(x+8,y+0.5,2.6,dxfTrunc(secItem.devtag+" "+secItem.val,18),"G-TEX"); stepSec(14); }
  if(y>busY2) doc.line(x,y,x,busY2,"E-FZA-BT-SEC");
  doc.text(x,busY+5,3.0,c.tag,"G-TEX",{halign:1});
}

// derivación de la barra secundaria (control): ITM bipolar + cruce con la barra de tierra común +
// etiqueta de la carga. No se fabrica una memoria de cable (el modelo de datos de derivaciones de
// control no calcula conductor propio — solo VA/ITM), así que no se dibuja rótulo de cable aquí.
function drawControlSubBranchDXF(doc,x,busY2,groundY,bi){
  let y = busY2;
  const step = (dy)=>{ const ny=y-dy; doc.line(x,y,x,ny,"E-FZA-BT-SEC"); y=ny; };
  step(6);
  symBreaker(doc,x,y,6,2);
  doc.text(x+6,y+0.5,2.3,dxfTrunc(bi.devtag,16),"G-TEX");
  doc.text(x+6,y-3,2.0,dxfTrunc(bi.val,16),"G-TEX");
  step(10);
  doc.line(x,y,x,groundY,"E-FZA-BT-SEC");
  symGroundSmall(doc,x,groundY,5);
  doc.line(x,groundY-2,x,groundY-11,"E-FZA-BT-SEC");
  doc.text(x,groundY-13,2.3,dxfTrunc(bi.comp,22),"G-TEX",{halign:1});
}

function buildUnifilarDXF(results, meta){
  const doc = meta.doc || new DXFDoc();
  const circuits = results.circuits;
  const g = results.g;
  const pitch = 60;

  // Secuencia a paso uniforme: cada circuito de fuerza (motor/alimentador) ocupa un lugar; cada circuito
  // de control (transformador) ABRE su propio bloque de derivaciones en la MISMA secuencia —continuando
  // el mismo paso entre la barra de fuerza y la de control, tal como se definió para el caso real que
  // sirvió de patrón— y su troncal (fusible+transformador+ITM) queda fuera de la secuencia, centrada
  // sobre ese bloque. Un circuito de control sin derivaciones cargadas aún se trata como un circuito más.
  const seq = [];
  const trunks = [];
  circuits.forEach(c=>{
    if(c.kind==="control"){
      // las derivaciones llevan devtag "QC<n>.<tag>" (p.ej. "QC1.C5") — el punto es obligatorio para no
      // confundirlas con el propio ITM secundario de la troncal ("Q"+tag, p.ej. "QC5", sin punto)
      const branchItems = c.items.filter(it=>it.devtag && /^QC\d+\./.test(it.devtag));
      if(branchItems.length){
        const idxs = [];
        branchItems.forEach(bi=>{ idxs.push(seq.length); seq.push({sub:true,c,bi}); });
        trunks.push({c, idxs});
        return;
      }
    }
    seq.push({sub:false,c});
  });

  const n = Math.max(seq.length,1);
  const titleBlockH = 42; // reserva heurística para pickAnsiSheet (el alto real del cajetín nativo es ~99 a escala k=1; este valor solo ayuda a elegir hoja, no dibuja nada)
  const neededW = 40 + n*pitch + 20;
  const neededH = 30 + 230 + titleBlockH;
  // Ingenia: la lámina y el cajetín (formato por defecto o del cliente) los dibuja meta.dibujarFormato(doc);
  // aquí solo se usa el área útil de dibujo que devuelve.
  const area = meta.dibujarFormato ? meta.dibujarFormato(doc) : { x0:25, y0:46, x1:831, y1:579 };
  let frameLeftX = area.x0, frameRightX = area.x1, frameTopY = area.y1; const k = 1;
  // marco real (dentro de TITLE_MAIN): rectángulo nativo (25,10)-(831,579) de la hoja A1 — se usa para
  // centrar y acotar el área de dibujo, en vez del borde genérico/el cajetín simplificado de antes.
  const drawAreaTop = frameTopY - 5*k;
  const busY = drawAreaTop - 32;     // barra de fuerza (tensión principal, g.voltage)
  const busY2 = busY - 70;           // barra de control (tensión secundaria, g.ctrlVoltage) — solo si hay troncales
  const groundY = busY2 - 40;        // barra de tierra común a ambos niveles
  const centerX = (frameLeftX+frameRightX)/2;
  const availW = (frameRightX-frameLeftX) - 20;
  const usedPitch = n*pitch>availW ? availW/n : pitch;
  const startX = centerX - (n*usedPitch)/2 + usedPitch/2;
  const xOf = i => startX + i*usedPitch;

  doc.line(centerX, drawAreaTop, centerX, busY, "E-FZA-BT-PRI");
  doc.text(centerX+6, drawAreaTop-2, 3.6, "ACOMETIDA "+g.voltage+"V "+g.freq+"Hz", "G-TEX");
  if(meta.acometida) doc.text(centerX+6, drawAreaTop-11.5, 2.2, dxfTrunc(meta.acometida, 70), "G-TEX");
  if(g.faultLevel) doc.text(centerX+6, drawAreaTop-7, 2.8, "Icc declarada "+g.faultLevel+" kA", "G-TEX");
  const qY = drawAreaTop - 18;
  symBreaker(doc, centerX, qY, 10, 3);
  doc.text(centerX+8, qY+1, 3.4, "Q-GEN 3x"+(results.mainBreaker||"-")+"A", "G-TEX");

  const busX0 = xOf(0)-usedPitch/2+8, busX1 = xOf(n-1)+usedPitch/2-8;
  doc.line(busX0, busY, busX1, busY, "E-FZA-BT-PRI");
  doc.text(busX0, busY+5, 3.0, "BARRA "+g.voltage+"V "+g.freq+"Hz", "G-TEX");

  seq.forEach((item,i)=>{
    const bx = xOf(i);
    if(item.sub) drawControlSubBranchDXF(doc, bx, busY2, groundY, item.bi);
    else drawMainBranchDXF(doc, bx, busY, groundY, item.c);
  });

  if(trunks.length){
    // barra secundaria: abarca únicamente el rango de x de las derivaciones de control (no toda la lámina)
    let subMinX=Infinity, subMaxX=-Infinity;
    trunks.forEach(({idxs})=>{ idxs.forEach(i=>{ subMinX=Math.min(subMinX,xOf(i)); subMaxX=Math.max(subMaxX,xOf(i)); }); });
    doc.line(subMinX-usedPitch/2+8, busY2, subMaxX+usedPitch/2-8, busY2, "E-FZA-BT-SEC");
    doc.text(subMinX-usedPitch/2+8, busY2+5, 2.6, "BARRA "+(g.ctrlVoltage||"-")+"VAC (control)", "G-TEX");
    trunks.forEach(({c,idxs})=>{
      const tx = idxs.reduce((a,i)=>a+xOf(i),0)/idxs.length;
      drawControlTrunkDXF(doc, tx, busY, busY2, c);
    });
  }

  // barra de tierra común + pozo a tierra (una sola vez, extremo izquierdo)
  doc.line(xOf(0)-usedPitch/2-6, groundY, xOf(n-1)+usedPitch/2+4, groundY, "E-TIERRA");
  symGroundElectrode(doc, xOf(0)-usedPitch/2+2, groundY, 14);
  doc.text(xOf(0)-usedPitch/2+2, groundY-12, 2.4, "POZO A TIERRA", "G-TEX", {halign:1});
  if(meta.titulo) doc.text(frameLeftX+8, drawAreaTop-6, 4.2, meta.titulo, "G-TEX");
  if(meta.subtitulo) doc.text(frameLeftX+8, drawAreaTop-12, 2.8, meta.subtitulo, "G-TEX");

  return meta.doc ? doc : doc.toDXF();
}

export { configurarMotor, necFLA, DS, MOTOR_FLA, APPLICATIONS, BREAKER_STEPS, CTRL_BREAKER_STEPS, CABLE_TABLE, EGC_TABLE_CU, TEMP_CORR, MIGUELEZ_MM2_STEPS, MIGUELEZ_AMP_1C, MIGUELEZ_AMP_3C, Z1C4Z1K_CODES, MULTIPLE_RZ1K_CODES, miguelezCableFor, miguelezMM2Up, cableModelText, egcModelText, pick, pickStep, motorFLA, tempCorrFactor, cableFor, egcFor, buildConductorMemo, withEGC, buildMainConductorSpec, computeCircuit, DXFDoc, DXF_BLOCKS, DXF_LAYERS, dxfEsc, dxfTrunc, dxfNum, buildUnifilarDXF, symBreaker, symFuse, symMotor, symBox, symFeeder, symTransformer, symGroundSmall, symGroundElectrode, arrowHeadDown };

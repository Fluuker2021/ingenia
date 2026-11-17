/* Ingenia — BASE DE DATOS DE APARIENCIA de los componentes del tablero, por familia / marca.
   La usan la vista 3D (js/mecanico/visor3d.js) y el frente de los equipos del plano mecánico 2D
   (js/cad/plano-mecanico.js) para dibujar cada equipo con sus rasgos reales: colores de carcasa, perfil escalonado
   de los equipos modulares, palancas, perillas, ventanas de LED, display, teclado, bornes de tornillo arriba / abajo,
   conector frontal, aletas de disipador, rejillas, franja de color de la marca y placa de características.
   Las DIMENSIONES no están aquí: salen de js/mecanico/componentes.js y js/control/plc-modulos.js; esta base solo dice
   cómo se ve el frente, en fracciones del ancho / alto del equipo, así sirve para cualquier tamaño de la familia.
   Colores y rasgos REFERENCIALES (catálogos, fotos de producto y RAL declarado por el fabricante); no reemplazan el
   plano dimensional del código exacto.

   ─── CÓMO AGREGAR UNA FAMILIA ───────────────────────────────────────────────────────────────────────────────────
   Agregar un objeto a MODELOS (las entradas más específicas antes que las genéricas del mismo tipo):
     { id:"marca-familia",                        identificador único
       marca:"…", nombre:"…",                     lo que se muestra al seleccionar el equipo
       tipos:["mcb", …],                          c.tipo del arreglo mecánico al que aplica (ver TIPOS abajo)
       re:/S2\d\d/i,                              se prueba sobre «modelo + familia» del componente; generico:true = respaldo del tipo
       fuente:"catálogo / documento consultado",
       col:{ cuerpo, frente, palanca, marca, bornes, detalle, … },   colores "#rrggbb" (se pueden citar por nombre en los rasgos)
       perfil:{ tipo:"modular", nariz:0.51, ny:0.5, hombro:0.64 },   opcional: frente saliente (aparamenta DIN):
                                                  nariz = alto del frente saliente / alto total, ny = su centro (0…1 desde abajo),
                                                  hombro = profundidad del hombro / profundidad total
       bisel:1.5,                                 chaflán de la carcasa (mm)
       lateral:{ w:9, re:/HK1-11/, color:"cuerpo" },   bloque lateral (contacto auxiliar) que suma ancho a la derecha
       rasgos:[ … ] }                             rasgos del frente (todas las posiciones en fracciones 0…1 del frente,
                                                  x desde la izquierda, y desde abajo; «sal» = cuánto sobresale en mm)
   Rasgos disponibles:
     palanca  { x, y, w, h, sal, color, por:"polo", unida }       palanca basculante (por polo; unida = barra común)
     perilla  { x, y, r, sal, color, flecha }                       mando rotativo (r en fracción del ancho)
     dial     { x, y, r, color }                                    potenciómetro / dial de ajuste con su marca
     boton    { x, y, r, sal, color }                               pulsador redondo (test, reset, ON / OFF)
     led      { x, y, color, n, dx, dy, r }                         LED con brillo propio (r en mm; n LED separados dx / dy)
     display  { x, y, w, h, color, luz }                            pantalla (luz = color de brillo)
     teclado  { x, y, w, h, filas, cols, color }                    teclas
     ventana  { x, y, w, h, color, transp }                         ventana de indicador / tapa transparente
     etiqueta { x, y, w, h, color }                                 zona de impresión / rótulo
     franja   { x, y, w, h, color }                                 franja de color de la marca (x / w opcionales); color "io" = tipo de E/S
     placa    { x, y, w, h }                                        placa de características (metálica)
     bornes   { lado:"arriba|abajo|ambos", n, forma:"tornillo|resorte|lug", y, color }   n: número, "polos" o "canales"
     conector { x, y, w, h, n, cols, color }                        bornera extraíble / conector frontal con n entradas
     tapa     { x, y, w, h, sal, color, transp }                    tapa frontal abatible
     bloque   { x, y, w, h, sal, color, por:"polo" }                bloque saliente (contacto auxiliar, portafusible, cartucho)
     aletas   { lado:"arriba|lados", n, color }                     aletas del disipador
     rejilla  { x, y, w, h, n, color }                              ranuras de ventilación
     puertos  { x, y, w, h, n, filas, color }                       puertos RJ45
     antenas  { n, color }                                          conectores de antena arriba
     bobinas / nucleo                                               reactancias y transformadores (sin parámetros)
   ─────────────────────────────────────────────────────────────────────────────────────────────────────────────── */

/* TIPOS: los c.tipo de js/mecanico/arreglo.js y arreglo-control.js, más los dispositivos de puerta y accesorios
   interruptor xlp variador arrancador reactancia trafo fuente guardamotor contactor sobrecarga mcb diferencial fusible
   rele spd resistencia cpu modulo fpd tapa switch router termostato tomacorriente luminaria finpuerta peine
   borne · puerta: manija panelvfd ventilador rejilla hmi luz pulsador selector seta potenciometro · canaleta riel barra */

/* colores de referencia (RAL aproximado en sRGB) */
export const RAL = {
  r7035:"#d2d4d1", r9003:"#ecece7", r9002:"#e3e3da", r7016:"#383e42", r7021:"#2f3234", r7024:"#474a50", r7012:"#4e5754",
  r7042:"#8f9695", r7043:"#4e5451", r9005:"#16171a", r5015:"#2271b3", r7030:"#8f8f86", r7032:"#b5b0a1",
};
const MARCA = { abb:"#ff000f", siemens:"#009999", rockwell:"#c8102e", schneider:"#3dcd58", phoenix:"#0098a1", finder:"#00539f", teltonika:"#0054a6", stego:"#004b87", rittal:"#e2001a" };
const NEGRO = "#1d1e21", METAL = "#b9bec4", LATON = "#c9a227", LCD = "#88b4cf";

export const MODELOS = [
  /* ===================== aparamenta modular (riel DIN) ===================== */
  { id:"abb-s200", marca:"ABB", nombre:"System pro M compact S200", tipos:["mcb"], re:/\bS20[1-4]|S200|SN201/i,
    fuente:"ABB System pro M compact S200 — catálogo 2CDC002xxx (carcasa RAL 7035, palanca negra, ventana CPI rojo/verde)",
    col:{ cuerpo:RAL.r7035, frente:"#dfe1de", palanca:NEGRO, marca:MARCA.abb, bornes:METAL, detalle:"#5b6068" },
    perfil:{ tipo:"modular", nariz:0.51, ny:0.5, hombro:0.64 }, bisel:1.2,
    rasgos:[ { t:"palanca", x:0.5, y:0.47, w:0.42, h:0.17, sal:9, color:"palanca", por:"polo", unida:true },
      { t:"ventana", x:0.5, y:0.63, w:0.3, h:0.04, color:"#c8302b", por:"polo" },
      { t:"etiqueta", x:0.5, y:0.33, w:0.78, h:0.07, color:"#eef0ed" },
      { t:"franja", x:0.5, y:0.69, w:0.5, h:0.025, color:"marca" },
      { t:"bornes", lado:"ambos", n:"polos", forma:"tornillo" } ] },
  { id:"abb-s800", marca:"ABB", nombre:"S800 (alta capacidad de ruptura)", tipos:["mcb"], re:/S80\d/i,
    fuente:"ABB S800 — catálogo 2CCC413001C02xx (palanca ancha, bornes de jaula con tapa)",
    col:{ cuerpo:"#cfd2cf", frente:"#c2c5c2", palanca:NEGRO, marca:MARCA.abb, bornes:METAL },
    perfil:{ tipo:"modular", nariz:0.56, ny:0.5, hombro:0.6 }, bisel:1.5,
    rasgos:[ { t:"palanca", x:0.5, y:0.48, w:0.55, h:0.2, sal:11, color:"palanca", por:"polo", unida:true },
      { t:"ventana", x:0.5, y:0.66, w:0.36, h:0.04, color:"#2e9e4f", por:"polo" },
      { t:"franja", x:0.5, y:0.31, w:0.6, h:0.025, color:"marca" },
      { t:"bornes", lado:"ambos", n:"polos", forma:"tornillo" } ] },
  { id:"siemens-5sy", marca:"Siemens", nombre:"SENTRON 5SY / 5SL", tipos:["mcb"], re:/5S[YL]\d/i,
    fuente:"Siemens SENTRON 5SY — catálogo LV 10 (carcasa gris claro, palanca gris oscuro)",
    col:{ cuerpo:"#dcdedc", frente:"#e8e9e7", palanca:"#4a4d52", marca:MARCA.siemens, bornes:METAL },
    perfil:{ tipo:"modular", nariz:0.5, ny:0.5, hombro:0.64 }, bisel:1.2,
    rasgos:[ { t:"palanca", x:0.5, y:0.47, w:0.45, h:0.18, sal:9, color:"palanca", por:"polo", unida:true },
      { t:"etiqueta", x:0.5, y:0.32, w:0.8, h:0.07 }, { t:"franja", x:0.5, y:0.68, w:0.6, h:0.022, color:"marca" },
      { t:"bornes", lado:"ambos", n:"polos", forma:"tornillo" } ] },
  { id:"se-ic60", marca:"Schneider Electric", nombre:"Acti9 iC60", tipos:["mcb","diferencial"], re:/iC60|A9F|A9R|iID/i,
    fuente:"Schneider Electric Acti9 — catálogo (carcasa blanca, palanca gris, VisiSafe)",
    col:{ cuerpo:"#f1f1ee", frente:"#e6e7e4", palanca:"#55595f", marca:MARCA.schneider, bornes:METAL },
    perfil:{ tipo:"modular", nariz:0.5, ny:0.5, hombro:0.64 }, bisel:1.2,
    rasgos:[ { t:"palanca", x:0.5, y:0.47, w:0.44, h:0.18, sal:9, color:"palanca", por:"polo", unida:true },
      { t:"franja", x:0.5, y:0.69, w:0.6, h:0.022, color:"marca" }, { t:"etiqueta", x:0.5, y:0.32, w:0.8, h:0.07 },
      { t:"bornes", lado:"ambos", n:"polos", forma:"tornillo" } ] },
  { id:"mcb-generico", marca:"", nombre:"Interruptor termomagnético modular", tipos:["mcb"], generico:true,
    fuente:"Aparamenta modular IEC 60898 (17,5 mm por polo)",
    col:{ cuerpo:"#e6e7e5", frente:"#dcdedb", palanca:NEGRO, marca:"#7b8189", bornes:METAL },
    perfil:{ tipo:"modular", nariz:0.51, ny:0.5, hombro:0.64 }, bisel:1.2,
    rasgos:[ { t:"palanca", x:0.5, y:0.47, w:0.42, h:0.17, sal:9, color:"palanca", por:"polo", unida:true }, { t:"etiqueta", x:0.5, y:0.32, w:0.8, h:0.07 },
      { t:"bornes", lado:"ambos", n:"polos", forma:"tornillo" } ] },
  { id:"abb-f200", marca:"ABB", nombre:"F200 / FH200 / DS201 (diferenciales)", tipos:["diferencial"], re:/F[H]?20\d|DS20\d|DSE20\d|F20/i,
    fuente:"ABB System pro M compact F200 / FH200 — catálogo (pulsador de prueba T, palanca azul en FH200)",
    col:{ cuerpo:RAL.r7035, frente:"#dfe1de", palanca:"#2b5fa8", marca:MARCA.abb, bornes:METAL },
    perfil:{ tipo:"modular", nariz:0.51, ny:0.5, hombro:0.64 }, bisel:1.2,
    rasgos:[ { t:"palanca", x:0.5, y:0.47, w:0.6, h:0.17, sal:9, color:"palanca", por:"polo", unida:true },
      { t:"boton", x:0.72, y:0.63, r:0.09, sal:3, color:"#f2c230" }, { t:"ventana", x:0.3, y:0.63, w:0.22, h:0.04, color:"#c8302b" },
      { t:"etiqueta", x:0.5, y:0.33, w:0.84, h:0.07 }, { t:"franja", x:0.5, y:0.69, w:0.4, h:0.025, color:"marca" },
      { t:"bornes", lado:"ambos", n:"polos", forma:"tornillo" } ] },
  { id:"dif-generico", marca:"", nombre:"Interruptor diferencial modular", tipos:["diferencial"], generico:true, fuente:"IEC 61008 / 61009",
    col:{ cuerpo:"#e6e7e5", frente:"#dcdedb", palanca:"#2b5fa8", marca:"#7b8189", bornes:METAL },
    perfil:{ tipo:"modular", nariz:0.51, ny:0.5, hombro:0.64 }, bisel:1.2,
    rasgos:[ { t:"palanca", x:0.5, y:0.47, w:0.6, h:0.17, sal:9, color:"palanca", por:"polo", unida:true }, { t:"boton", x:0.72, y:0.63, r:0.09, sal:3, color:"#f2c230" },
      { t:"bornes", lado:"ambos", n:"polos", forma:"tornillo" } ] },
  { id:"abb-e90", marca:"ABB", nombre:"E 90 (portafusible 10×38)", tipos:["fusible"], re:/E9\d/i,
    fuente:"ABB E 90 — catálogo (portafusible seccionable con manija abatible y ventana de fusible fundido)",
    col:{ cuerpo:RAL.r7035, frente:"#9a9fa6", palanca:"#4a4f57", marca:MARCA.abb, bornes:METAL },
    perfil:{ tipo:"modular", nariz:0.6, ny:0.5, hombro:0.6 }, bisel:1.2,
    rasgos:[ { t:"bloque", x:0.5, y:0.5, w:0.8, h:0.56, sal:6, color:"frente", por:"polo" },
      { t:"bloque", x:0.5, y:0.73, w:0.5, h:0.08, sal:9, color:"palanca", por:"polo" },
      { t:"ventana", x:0.5, y:0.42, w:0.36, h:0.06, color:"#c8302b", por:"polo" },
      { t:"bornes", lado:"ambos", n:"polos", forma:"tornillo" } ] },
  { id:"fusible-generico", marca:"", nombre:"Portafusible modular", tipos:["fusible"], generico:true, fuente:"IEC 60269 — portafusible 10×38",
    col:{ cuerpo:"#e2e3e1", frente:"#9a9fa6", palanca:"#4a4f57", bornes:METAL }, perfil:{ tipo:"modular", nariz:0.6, ny:0.5, hombro:0.6 }, bisel:1.2,
    rasgos:[ { t:"bloque", x:0.5, y:0.5, w:0.8, h:0.56, sal:6, color:"frente", por:"polo" }, { t:"bornes", lado:"ambos", n:"polos", forma:"tornillo" } ] },
  { id:"abb-ovr", marca:"ABB", nombre:"OVR T1 / T2 (supresores enchufables)", tipos:["spd"], re:/OVR/i,
    fuente:"ABB OVR — catálogo 2CTC432xxx (cartucho enchufable con ventana de estado verde / rojo)",
    col:{ cuerpo:RAL.r7035, frente:"#eeeeec", marca:MARCA.abb, bornes:METAL },
    perfil:{ tipo:"modular", nariz:0.55, ny:0.5, hombro:0.6 }, bisel:1.2,
    rasgos:[ { t:"bloque", x:0.5, y:0.5, w:0.86, h:0.52, sal:4, color:"frente", por:"polo" },
      { t:"ventana", x:0.5, y:0.6, w:0.4, h:0.07, color:"#2e9e4f", por:"polo" },
      { t:"franja", x:0.5, y:0.41, w:0.5, h:0.025, color:"marca", por:"polo" },
      { t:"bornes", lado:"ambos", n:"polos", forma:"tornillo" } ] },
  { id:"spd-generico", marca:"", nombre:"Supresor de sobretensiones", tipos:["spd"], generico:true, fuente:"IEC 61643-11",
    col:{ cuerpo:"#e2e3e1", frente:"#eeeeec", bornes:METAL }, perfil:{ tipo:"modular", nariz:0.55, ny:0.5, hombro:0.6 }, bisel:1.2,
    rasgos:[ { t:"bloque", x:0.5, y:0.5, w:0.86, h:0.52, sal:4, color:"frente", por:"polo" }, { t:"ventana", x:0.5, y:0.6, w:0.4, h:0.07, color:"#2e9e4f", por:"polo" },
      { t:"bornes", lado:"ambos", n:"polos", forma:"tornillo" } ] },
  { id:"abb-cm", marca:"ABB", nombre:"CM (relés de monitoreo, 22,5 mm)", tipos:["rele"], re:/CM-/i,
    fuente:"ABB CM range — catálogo 2CDC110004C02xx (tapa frontal precintable, LED U / R / F, potenciómetros)",
    col:{ cuerpo:RAL.r7035, frente:"#e3e5e2", marca:MARCA.abb, bornes:METAL },
    perfil:{ tipo:"modular", nariz:0.56, ny:0.5, hombro:0.66 }, bisel:1,
    rasgos:[ { t:"led", x:0.3, y:0.68, color:"#2fd05a", n:3, dx:0.2, r:1.1 },
      { t:"dial", x:0.32, y:0.47, r:0.16, color:"#f4f5f6" }, { t:"dial", x:0.68, y:0.47, r:0.16, color:"#f4f5f6" },
      { t:"ventana", x:0.5, y:0.5, w:0.9, h:0.48, color:"#cfe3f2", transp:true },
      { t:"franja", x:0.5, y:0.31, w:0.5, h:0.02, color:"marca" },
      { t:"bornes", lado:"ambos", n:3, forma:"tornillo" } ] },
  { id:"phoenix-plc-rsc", marca:"Phoenix Contact", nombre:"PLC-RSC (REL-MR + base PLC-BSC, 6,2 mm)", tipos:["rele"], re:/PLC-RSC|PLC-BSC|REL-MR/i,
    fuente:"Phoenix Contact PLC-INTERFACE — catálogo (base gris, relé enchufable negro, LED amarillo, palanca de extracción)",
    col:{ cuerpo:"#8e9399", frente:"#2b2e33", marca:MARCA.phoenix, bornes:METAL },
    bisel:0.6,
    rasgos:[ { t:"bloque", x:0.5, y:0.5, w:0.92, h:0.42, sal:6, color:"frente" },
      { t:"led", x:0.5, y:0.78, color:"#ffd21f", r:1.1 }, { t:"bloque", x:0.5, y:0.25, w:0.7, h:0.05, sal:3, color:"#5b6068" },
      { t:"etiqueta", x:0.5, y:0.62, w:0.8, h:0.05, color:"#f4f5f2" },
      { t:"bornes", lado:"ambos", n:2, forma:"tornillo" } ] },
  { id:"finder-38", marca:"Finder", nombre:"Serie 38 (relé de interfaz 6,2 mm)", tipos:["rele"], re:/\b38\.\d|Finder/i,
    fuente:"Finder serie 38 — catálogo (base gris oscuro, relé con LED verde, clip de extracción)",
    col:{ cuerpo:"#4a4d52", frente:"#2b2e33", marca:MARCA.finder, bornes:METAL }, bisel:0.6,
    rasgos:[ { t:"bloque", x:0.5, y:0.5, w:0.92, h:0.44, sal:6, color:"frente" }, { t:"led", x:0.5, y:0.78, color:"#2fd05a", r:1.1 },
      { t:"bornes", lado:"ambos", n:2, forma:"tornillo" } ] },
  { id:"rele-generico", marca:"", nombre:"Relé", tipos:["rele"], generico:true, fuente:"Relé de interfaz / monitoreo en riel DIN",
    col:{ cuerpo:"#c8cbce", frente:"#2b2e33", bornes:METAL }, bisel:0.6,
    rasgos:[ { t:"bloque", x:0.5, y:0.5, w:0.9, h:0.44, sal:5, color:"frente" }, { t:"led", x:0.5, y:0.78, color:"#ffd21f", r:1.1 }, { t:"bornes", lado:"ambos", n:2, forma:"tornillo" } ] },

  /* ===================== arranque de motores ===================== */
  { id:"abb-ms116", marca:"ABB", nombre:"MS116 / MS132 / MS165 (guardamotores)", tipos:["guardamotor"], re:/MS1[1-6]\d/i,
    fuente:"ABB guardamotores MS116 / MS132 — catálogo 1SBC100xxx (mando rotativo negro con candado, dial de ajuste, indicador de disparo)",
    col:{ cuerpo:RAL.r7035, frente:"#e1e3e0", palanca:NEGRO, marca:MARCA.abb, bornes:METAL },
    perfil:{ tipo:"modular", nariz:0.58, ny:0.5, hombro:0.6 }, bisel:1.5, lateral:{ w:9, re:/HK1-11|HK1/, color:"#c9ccc9" },
    rasgos:[ { t:"perilla", x:0.48, y:0.5, r:0.3, sal:12, color:"palanca", flecha:true },
      { t:"dial", x:0.82, y:0.71, r:0.1, color:"#f4f5f6" }, { t:"ventana", x:0.18, y:0.72, w:0.14, h:0.05, color:"#2e9e4f" },
      { t:"franja", x:0.5, y:0.28, w:0.36, h:0.022, color:"marca" },
      { t:"bornes", lado:"ambos", n:3, forma:"tornillo" } ] },
  { id:"abb-ms450", marca:"ABB", nombre:"MS450 / MS495 (guardamotores)", tipos:["guardamotor"], re:/MS4\d\d/i,
    fuente:"ABB MS450 / MS495 — catálogo (mando rotativo, bornes de caja)",
    col:{ cuerpo:RAL.r7035, frente:"#e1e3e0", palanca:NEGRO, marca:MARCA.abb, bornes:METAL },
    perfil:{ tipo:"modular", nariz:0.5, ny:0.5, hombro:0.62 }, bisel:2, lateral:{ w:9, re:/HK1-11|HK1/, color:"#c9ccc9" },
    rasgos:[ { t:"perilla", x:0.5, y:0.5, r:0.28, sal:16, color:"palanca", flecha:true }, { t:"dial", x:0.82, y:0.66, r:0.08, color:"#f4f5f6" },
      { t:"franja", x:0.5, y:0.31, w:0.36, h:0.02, color:"marca" }, { t:"bornes", lado:"ambos", n:3, forma:"tornillo" } ] },
  { id:"siemens-3rv", marca:"Siemens", nombre:"SIRIUS 3RV2", tipos:["guardamotor"], re:/3RV/i,
    fuente:"Siemens SIRIUS 3RV2 — catálogo IC 10 (mando rotativo, carcasa gris)",
    col:{ cuerpo:"#c9cbcb", frente:"#d9dbdb", palanca:"#2f3234", marca:MARCA.siemens, bornes:METAL },
    perfil:{ tipo:"modular", nariz:0.56, ny:0.5, hombro:0.6 }, bisel:1.5, lateral:{ w:9, re:/3RV2901|HK1/, color:"#b7b9b9" },
    rasgos:[ { t:"perilla", x:0.48, y:0.5, r:0.28, sal:11, color:"palanca", flecha:true }, { t:"dial", x:0.82, y:0.72, r:0.1, color:"#f4f5f6" },
      { t:"bornes", lado:"ambos", n:3, forma:"tornillo" } ] },
  { id:"gm-generico", marca:"", nombre:"Guardamotor", tipos:["guardamotor"], generico:true, fuente:"IEC 60947-4-1",
    col:{ cuerpo:"#d9dbd8", frente:"#e1e3e0", palanca:NEGRO, bornes:METAL }, perfil:{ tipo:"modular", nariz:0.56, ny:0.5, hombro:0.6 }, bisel:1.5, lateral:{ w:9, re:/HK1|AUX/i, color:"#c9ccc9" },
    rasgos:[ { t:"perilla", x:0.48, y:0.5, r:0.28, sal:11, color:"palanca", flecha:true }, { t:"bornes", lado:"ambos", n:3, forma:"tornillo" } ] },
  { id:"abb-af-din", marca:"ABB", nombre:"AF09…AF96 (contactores, riel DIN)", tipos:["contactor"], re:/AF(09|12|16|26|30|38|40|52|65|80|96)\b/i,
    fuente:"ABB contactores AF — catálogo 1SBC100xxx (RAL 7035, indicador de maniobra central, bloque auxiliar frontal HKF1-11)",
    col:{ cuerpo:RAL.r7035, frente:"#e4e6e3", marca:MARCA.abb, bornes:METAL, aux:"#cfd1ce" },
    perfil:{ tipo:"modular", nariz:0.52, ny:0.5, hombro:0.58 }, bisel:1.5,
    rasgos:[ { t:"bloque", x:0.5, y:0.5, w:0.84, h:0.36, sal:14, color:"aux", si:/HKF/ },
      { t:"bloque", x:0.5, y:0.5, w:0.24, h:0.16, sal:2, color:"#8a8f96" },
      { t:"etiqueta", x:0.5, y:0.68, w:0.8, h:0.08 },
      { t:"franja", x:0.5, y:0.33, w:0.4, h:0.025, color:"marca" },
      { t:"bornes", lado:"ambos", n:3, forma:"tornillo" }, { t:"bornes", lado:"arriba", n:2, forma:"tornillo", y:0.97, color:"#6b7079" } ] },
  { id:"abb-af-placa", marca:"ABB", nombre:"AF116…AF2850 (contactores de placa)", tipos:["contactor"], re:/AF(1[0-9]{2}|[2-9][0-9]{2}|\d{4})\b/i,
    fuente:"ABB contactores AF de bloque — catálogo (bornes de barra con tapa, indicador de maniobra)",
    col:{ cuerpo:"#c9ccc9", frente:"#dadcd9", marca:MARCA.abb, bornes:"#c58a4a" },
    perfil:{ tipo:"modular", nariz:0.56, ny:0.5, hombro:0.55 }, bisel:2.5,
    rasgos:[ { t:"bloque", x:0.5, y:0.52, w:0.18, h:0.12, sal:2, color:"#8a8f96" }, { t:"etiqueta", x:0.5, y:0.68, w:0.7, h:0.07 },
      { t:"franja", x:0.5, y:0.36, w:0.3, h:0.02, color:"marca" }, { t:"bornes", lado:"ambos", n:3, forma:"lug" } ] },
  { id:"siemens-3rt", marca:"Siemens", nombre:"SIRIUS 3RT2", tipos:["contactor"], re:/3RT/i, fuente:"Siemens SIRIUS 3RT2 — catálogo IC 10",
    col:{ cuerpo:"#c9cbcb", frente:"#d9dbdb", marca:MARCA.siemens, bornes:METAL }, perfil:{ tipo:"modular", nariz:0.5, ny:0.5, hombro:0.58 }, bisel:1.5,
    rasgos:[ { t:"bloque", x:0.5, y:0.52, w:0.2, h:0.14, sal:2, color:"#6b7079" }, { t:"etiqueta", x:0.5, y:0.68, w:0.8, h:0.08 }, { t:"bornes", lado:"ambos", n:3, forma:"tornillo" } ] },
  { id:"se-tesys-d", marca:"Schneider Electric", nombre:"TeSys D (LC1D)", tipos:["contactor"], re:/LC1D/i, fuente:"Schneider Electric TeSys Deca — catálogo",
    col:{ cuerpo:"#e8e8e5", frente:"#d7d8d5", marca:MARCA.schneider, bornes:METAL }, perfil:{ tipo:"modular", nariz:0.52, ny:0.5, hombro:0.58 }, bisel:1.5,
    rasgos:[ { t:"bloque", x:0.5, y:0.5, w:0.22, h:0.14, sal:2, color:"#6b7079" }, { t:"franja", x:0.5, y:0.33, w:0.4, h:0.02, color:"marca" }, { t:"bornes", lado:"ambos", n:3, forma:"tornillo" } ] },
  { id:"cont-generico", marca:"", nombre:"Contactor", tipos:["contactor"], generico:true, fuente:"IEC 60947-4-1",
    col:{ cuerpo:"#d9dbd8", frente:"#e4e6e3", bornes:METAL, aux:"#cfd1ce" }, perfil:{ tipo:"modular", nariz:0.52, ny:0.5, hombro:0.58 }, bisel:1.5,
    rasgos:[ { t:"bloque", x:0.5, y:0.5, w:0.84, h:0.36, sal:14, color:"aux", si:/HKF|aux/i }, { t:"bloque", x:0.5, y:0.5, w:0.24, h:0.16, sal:2, color:"#8a8f96" },
      { t:"etiqueta", x:0.5, y:0.68, w:0.8, h:0.08 }, { t:"bornes", lado:"ambos", n:3, forma:"tornillo" } ] },
  { id:"abb-tf", marca:"ABB", nombre:"TF42 / TF65 / TF96 / EF (relés de sobrecarga)", tipos:["sobrecarga"], re:/\bTF\d|EF\d|TA\d/i,
    fuente:"ABB relés de sobrecarga TF / EF — catálogo (dial de ajuste, reset azul, stop rojo, indicador de disparo)",
    col:{ cuerpo:RAL.r7035, frente:"#e4e6e3", marca:MARCA.abb, bornes:METAL },
    bisel:1.2,
    rasgos:[ { t:"dial", x:0.32, y:0.56, r:0.16, color:"#f4f5f6" }, { t:"boton", x:0.66, y:0.62, r:0.07, sal:3, color:"#2b6cb0" },
      { t:"boton", x:0.82, y:0.62, r:0.06, sal:2, color:"#d2312b" }, { t:"ventana", x:0.74, y:0.4, w:0.16, h:0.07, color:"#f5a623" },
      { t:"bornes", lado:"abajo", n:3, forma:"tornillo", y:0.12 } ] },
  { id:"ol-generico", marca:"", nombre:"Relé de sobrecarga", tipos:["sobrecarga"], generico:true, fuente:"IEC 60947-4-1",
    col:{ cuerpo:"#d9dbd8", bornes:METAL }, bisel:1.2,
    rasgos:[ { t:"dial", x:0.32, y:0.56, r:0.16, color:"#f4f5f6" }, { t:"boton", x:0.66, y:0.62, r:0.07, sal:3, color:"#2b6cb0" }, { t:"bornes", lado:"abajo", n:3, forma:"tornillo", y:0.12 } ] },

  /* ===================== interruptores de potencia ===================== */
  { id:"abb-tmax-xt", marca:"ABB", nombre:"Tmax XT (caja moldeada)", tipos:["interruptor"], re:/XT[1-7]/i,
    fuente:"ABB Tmax XT — catálogo técnico 1SDC210xxx (frente gris oscuro, palanca negra, relé TMD / Ekip en la parte inferior, cubrebornes)",
    col:{ cuerpo:"#4b5056", frente:"#5c6168", palanca:NEGRO, marca:MARCA.abb, bornes:"#c58a4a", rele:"#3a3e44", etiqueta:"#e9eaeb" },
    perfil:{ tipo:"modular", nariz:0.56, ny:0.52, hombro:0.66 }, bisel:3,
    rasgos:[ { t:"rebaje", x:0.5, y:0.52, w:0.84, h:0.5, color:"frente" },
      { t:"palanca", x:0.5, y:0.6, w:0.16, h:0.2, sal:20, color:"palanca" },
      { t:"etiqueta", x:0.5, y:0.73, w:0.7, h:0.06, color:"etiqueta" },
      { t:"franja", x:0.2, y:0.73, w:0.14, h:0.04, color:"marca" },
      { t:"bloque", x:0.5, y:0.37, w:0.74, h:0.14, sal:3, color:"rele" },
      { t:"dial", x:0.3, y:0.37, r:0.07, color:"#f4f5f6" }, { t:"dial", x:0.5, y:0.37, r:0.07, color:"#f4f5f6" }, { t:"led", x:0.7, y:0.39, color:"#2fd05a", r:1.6 },
      { t:"boton", x:0.82, y:0.6, r:0.05, sal:2, color:"#d2312b" },
      { t:"bornes", lado:"ambos", n:"polos", forma:"lug" } ] },
  { id:"abb-emax2", marca:"ABB", nombre:"Emax 2 (bastidor abierto)", tipos:["interruptor"], re:/Emax/i,
    fuente:"ABB SACE Emax 2 — catálogo técnico 1SDC200023D0xxx (relé Ekip Touch con pantalla, palanca de carga de resortes, pulsadores ON / OFF)",
    col:{ cuerpo:"#3e4248", frente:"#53585f", palanca:NEGRO, marca:MARCA.abb, bornes:"#c58a4a", etiqueta:"#e9eaeb" },
    bisel:4,
    rasgos:[ { t:"rebaje", x:0.5, y:0.55, w:0.86, h:0.62, color:"frente" },
      { t:"display", x:0.3, y:0.68, w:0.3, h:0.16, color:LCD, luz:"#1d3c52" }, { t:"teclado", x:0.3, y:0.53, w:0.28, h:0.06, filas:1, cols:4, color:"#2b2e33" },
      { t:"bloque", x:0.72, y:0.42, w:0.08, h:0.26, sal:14, color:"palanca" },
      { t:"boton", x:0.62, y:0.72, r:0.04, sal:3, color:"#2e9e4f" }, { t:"boton", x:0.74, y:0.72, r:0.04, sal:3, color:"#d2312b" },
      { t:"ventana", x:0.84, y:0.72, w:0.08, h:0.04, color:"#f5c518" }, { t:"ventana", x:0.84, y:0.66, w:0.08, h:0.04, color:"#2e9e4f" },
      { t:"franja", x:0.5, y:0.9, w:0.2, h:0.03, color:"marca" }, { t:"placa", x:0.5, y:0.3, w:0.4, h:0.06 },
      { t:"bornes", lado:"ambos", n:"polos", forma:"lug" } ] },
  { id:"int-generico", marca:"", nombre:"Interruptor en caja moldeada", tipos:["interruptor"], generico:true, fuente:"IEC 60947-2",
    col:{ cuerpo:"#4b5056", frente:"#5c6168", palanca:NEGRO, bornes:"#c58a4a", etiqueta:"#e9eaeb" }, perfil:{ tipo:"modular", nariz:0.56, ny:0.52, hombro:0.66 }, bisel:3,
    rasgos:[ { t:"rebaje", x:0.5, y:0.52, w:0.84, h:0.5, color:"frente" }, { t:"palanca", x:0.5, y:0.6, w:0.16, h:0.2, sal:20, color:"palanca" },
      { t:"etiqueta", x:0.5, y:0.73, w:0.7, h:0.06, color:"etiqueta" }, { t:"bornes", lado:"ambos", n:"polos", forma:"lug" } ] },
  { id:"abb-xlp", marca:"ABB", nombre:"EasyLine XLP (seccionador portafusible NH)", tipos:["xlp"], re:/XLP/i,
    fuente:"ABB EasyLine XLP — catálogo (tres portafusibles abatibles con manija, cubrebornes, ventana de inspección)",
    col:{ cuerpo:"#3c4046", frente:"#575c63", palanca:"#7b8189", marca:MARCA.abb, bornes:"#c58a4a" },
    bisel:2.5,
    rasgos:[ { t:"bloque", x:0.5, y:0.48, w:0.8, h:0.56, sal:14, color:"frente", por:"polo" },
      { t:"bloque", x:0.5, y:0.69, w:0.5, h:0.06, sal:20, color:"palanca", por:"polo" },
      { t:"ventana", x:0.5, y:0.42, w:0.4, h:0.12, color:"#9fb4c2", por:"polo", transp:true },
      { t:"franja", x:0.5, y:0.84, w:0.24, h:0.02, color:"marca" },
      { t:"bornes", lado:"ambos", n:"polos", forma:"lug" } ] },

  /* ===================== variadores y arrancadores suaves ===================== */
  { id:"abb-acs880", marca:"ABB", nombre:"ACS880-01 (montaje en pared)", tipos:["variador"], re:/ACS880/i,
    fuente:"ABB ACS880-01 Hardware Manual 3AUA0000078093 (tapa frontal blanca, panel ACS-AP-I arriba, disipador con aletas, rejilla inferior)",
    col:{ cuerpo:"#3c4047", frente:RAL.r9002, panel:"#2b2e33", marca:MARCA.abb, aletas:"#6e747c", rejilla:"#2b2e33" },
    bisel:6,
    rasgos:[ { t:"rebaje", x:0.5, y:0.5, w:0.9, h:0.92, color:"frente", sal:4 },
      { t:"bloque", x:0.5, y:0.8, w:0.42, h:0.14, sal:8, color:"panel" },
      { t:"display", x:0.5, y:0.835, w:0.32, h:0.05, color:LCD, luz:"#1d3c52" }, { t:"teclado", x:0.5, y:0.765, w:0.32, h:0.035, filas:2, cols:4, color:"#4a4f57" },
      { t:"franja", x:0.2, y:0.94, w:0.08, h:0.012, color:"marca" },
      { t:"rejilla", x:0.5, y:0.1, w:0.7, h:0.1, n:9, color:"rejilla" }, { t:"rejilla", x:0.5, y:0.6, w:0.6, h:0.04, n:3, color:"rejilla" },
      { t:"placa", x:0.78, y:0.35, w:0.14, h:0.08 },
      { t:"aletas", lado:"lados", n:9, color:"aletas" }, { t:"aletas", lado:"arriba", n:11, color:"aletas" } ] },
  { id:"abb-acs580", marca:"ABB", nombre:"ACS580 / ACS480 / ACS380", tipos:["variador"], re:/ACS[345]80/i,
    fuente:"ABB ACS580-01 Hardware Manual (tapa blanca, panel asistente, disipador posterior)",
    col:{ cuerpo:"#3c4047", frente:RAL.r9002, panel:"#2b2e33", marca:MARCA.abb, aletas:"#6e747c", rejilla:"#2b2e33" }, bisel:6,
    rasgos:[ { t:"rebaje", x:0.5, y:0.5, w:0.9, h:0.92, color:"frente", sal:4 }, { t:"bloque", x:0.5, y:0.78, w:0.44, h:0.15, sal:8, color:"panel" },
      { t:"display", x:0.5, y:0.82, w:0.34, h:0.05, color:LCD, luz:"#1d3c52" }, { t:"teclado", x:0.5, y:0.745, w:0.34, h:0.035, filas:2, cols:4, color:"#4a4f57" },
      { t:"franja", x:0.2, y:0.94, w:0.08, h:0.012, color:"marca" }, { t:"rejilla", x:0.5, y:0.1, w:0.7, h:0.1, n:9, color:"rejilla" }, { t:"aletas", lado:"lados", n:9, color:"aletas" } ] },
  { id:"ab-pf755", marca:"Allen-Bradley", nombre:"PowerFlex 755 / 753", tipos:["variador"], re:/PowerFlex 75|20G/i,
    fuente:"Allen-Bradley PowerFlex 750 — 750-TD001 / 750-IN001 (frente negro, HIM 20-HIM-A6 gris arriba, rejilla, disipador)",
    col:{ cuerpo:"#2b2d30", frente:"#232528", panel:"#8f949a", marca:MARCA.rockwell, aletas:"#5b6068", rejilla:"#0f1012" }, bisel:5,
    rasgos:[ { t:"rebaje", x:0.5, y:0.52, w:0.88, h:0.86, color:"frente", sal:3 },
      { t:"bloque", x:0.5, y:0.79, w:0.36, h:0.15, sal:10, color:"panel" },
      { t:"display", x:0.5, y:0.83, w:0.26, h:0.05, color:"#9cc3a2", luz:"#1f3a24" }, { t:"teclado", x:0.5, y:0.76, w:0.26, h:0.05, filas:3, cols:4, color:"#2b2e33" },
      { t:"franja", x:0.5, y:0.95, w:0.3, h:0.018, color:"marca" }, { t:"rejilla", x:0.5, y:0.12, w:0.76, h:0.12, n:10, color:"rejilla" },
      { t:"placa", x:0.76, y:0.4, w:0.16, h:0.08 }, { t:"aletas", lado:"lados", n:10, color:"aletas" } ] },
  { id:"ab-pf525", marca:"Allen-Bradley", nombre:"PowerFlex 525 / 523", tipos:["variador"], re:/PowerFlex 52|25[AB]-/i,
    fuente:"Allen-Bradley PowerFlex 520 — 520-TD001 (frente negro con display LCD y teclado integrado)",
    col:{ cuerpo:"#2b2d30", frente:"#232528", panel:"#3a3e44", marca:MARCA.rockwell, aletas:"#5b6068", rejilla:"#0f1012" }, bisel:4,
    rasgos:[ { t:"display", x:0.5, y:0.78, w:0.5, h:0.08, color:"#9cc3a2", luz:"#1f3a24" }, { t:"teclado", x:0.5, y:0.66, w:0.56, h:0.1, filas:2, cols:4, color:"panel" },
      { t:"franja", x:0.5, y:0.93, w:0.4, h:0.02, color:"marca" }, { t:"rejilla", x:0.5, y:0.18, w:0.7, h:0.14, n:8, color:"rejilla" }, { t:"aletas", lado:"lados", n:7, color:"aletas" } ] },
  { id:"siemens-g120", marca:"Siemens", nombre:"SINAMICS G120 / G120X", tipos:["variador"], re:/G120|SINAMICS/i,
    fuente:"Siemens SINAMICS G120 — catálogo D 31 (carcasa gris antracita, panel IOP-2)",
    col:{ cuerpo:"#3a3f44", frente:"#4d5358", panel:"#2b2e33", marca:MARCA.siemens, aletas:"#6e747c", rejilla:"#1d1f22" }, bisel:5,
    rasgos:[ { t:"rebaje", x:0.5, y:0.52, w:0.88, h:0.86, color:"frente", sal:3 }, { t:"bloque", x:0.5, y:0.78, w:0.4, h:0.15, sal:8, color:"panel" },
      { t:"display", x:0.5, y:0.81, w:0.3, h:0.06, color:LCD, luz:"#1d3c52" }, { t:"franja", x:0.5, y:0.95, w:0.3, h:0.018, color:"marca" },
      { t:"rejilla", x:0.5, y:0.12, w:0.76, h:0.12, n:10, color:"rejilla" }, { t:"aletas", lado:"lados", n:9, color:"aletas" } ] },
  { id:"vfd-generico", marca:"", nombre:"Variador de frecuencia", tipos:["variador"], generico:true, fuente:"IEC 61800",
    col:{ cuerpo:"#3c4047", frente:"#e3e3da", panel:"#2b2e33", aletas:"#6e747c", rejilla:"#2b2e33" }, bisel:5,
    rasgos:[ { t:"rebaje", x:0.5, y:0.5, w:0.9, h:0.92, color:"frente", sal:4 }, { t:"bloque", x:0.5, y:0.8, w:0.42, h:0.14, sal:8, color:"panel" },
      { t:"display", x:0.5, y:0.835, w:0.32, h:0.05, color:LCD, luz:"#1d3c52" }, { t:"rejilla", x:0.5, y:0.1, w:0.7, h:0.1, n:9, color:"rejilla" }, { t:"aletas", lado:"lados", n:9, color:"aletas" } ] },
  { id:"abb-psr", marca:"ABB", nombre:"PSR (arrancador suave compacto)", tipos:["arrancador"], re:/PSR\d/i,
    fuente:"ABB PSR — catálogo 1SFC132xxx (RAL 7035, tres potenciómetros de ajuste, LED Ready / Run / Fault)",
    col:{ cuerpo:RAL.r7035, frente:"#e4e6e3", marca:MARCA.abb, bornes:METAL, rejilla:"#4a4f57" }, bisel:1.5,
    rasgos:[ { t:"rejilla", x:0.5, y:0.78, w:0.8, h:0.12, n:6, color:"rejilla" },
      { t:"dial", x:0.25, y:0.5, r:0.1, color:"#f4f5f6" }, { t:"dial", x:0.5, y:0.5, r:0.1, color:"#f4f5f6" }, { t:"dial", x:0.75, y:0.5, r:0.1, color:"#f4f5f6" },
      { t:"led", x:0.3, y:0.62, color:"#2fd05a", n:3, dx:0.2, r:1.2 }, { t:"franja", x:0.5, y:0.36, w:0.3, h:0.015, color:"marca" },
      { t:"bornes", lado:"ambos", n:3, forma:"tornillo" } ] },
  { id:"abb-pstx", marca:"ABB", nombre:"PSE / PSTX (arrancador suave con HMI)", tipos:["arrancador"], re:/PSTX|PSE\d/i,
    fuente:"ABB PSTX — catálogo 1SFC132xxx (frente con teclado y pantalla desmontable, carcasa gris oscuro)",
    col:{ cuerpo:"#4a4f57", frente:"#eceeec", panel:"#2b2e33", marca:MARCA.abb, bornes:"#c58a4a", rejilla:"#2b2e33" }, bisel:3,
    rasgos:[ { t:"rebaje", x:0.5, y:0.5, w:0.86, h:0.6, color:"frente", sal:3 }, { t:"bloque", x:0.5, y:0.56, w:0.5, h:0.2, sal:6, color:"panel" },
      { t:"display", x:0.5, y:0.6, w:0.4, h:0.07, color:LCD, luz:"#1d3c52" }, { t:"teclado", x:0.5, y:0.51, w:0.4, h:0.05, filas:1, cols:4, color:"#4a4f57" },
      { t:"franja", x:0.25, y:0.76, w:0.12, h:0.015, color:"marca" }, { t:"rejilla", x:0.5, y:0.88, w:0.8, h:0.06, n:5, color:"rejilla" },
      { t:"bornes", lado:"ambos", n:3, forma:"lug" } ] },
  { id:"arr-generico", marca:"", nombre:"Arrancador suave", tipos:["arrancador"], generico:true, fuente:"IEC 60947-4-2",
    col:{ cuerpo:"#d9dbd8", frente:"#e4e6e3", bornes:METAL, rejilla:"#4a4f57" }, bisel:1.5,
    rasgos:[ { t:"rejilla", x:0.5, y:0.78, w:0.8, h:0.12, n:6, color:"rejilla" }, { t:"dial", x:0.3, y:0.5, r:0.1, color:"#f4f5f6" }, { t:"dial", x:0.7, y:0.5, r:0.1, color:"#f4f5f6" },
      { t:"led", x:0.35, y:0.62, color:"#2fd05a", n:3, dx:0.15, r:1.2 }, { t:"bornes", lado:"ambos", n:3, forma:"tornillo" } ] },
  { id:"reactancia", marca:"", nombre:"Reactancia trifásica / filtro dv/dt", tipos:["reactancia"], generico:true,
    fuente:"Reactancias trifásicas de núcleo laminado (MTE, Schaffner, TCI — fotos de catálogo; referencial)",
    col:{ cuerpo:"#2f3236", bobina:"#b8742f", aislante:"#d9c79a", bornes:"#8a8f96", soporte:"#5b6068" },
    rasgos:[ { t:"bobinas" } ] },
  { id:"trafo", marca:"", nombre:"Transformador de control", tipos:["trafo"], generico:true,
    fuente:"Transformadores de control monofásicos (núcleo E-I, bobina con cinta, bornera frontal; referencial)",
    col:{ cuerpo:"#3a3e44", bobina:"#d8c690", bornes:"#4a4f57", soporte:"#8a8f96" },
    rasgos:[ { t:"nucleo" } ] },

  /* ===================== fuentes de 24 Vdc ===================== */
  { id:"abb-cp", marca:"ABB", nombre:"CP-E / CP-T / CP-C.1 (fuentes)", tipos:["fuente"], re:/CP-[ETC]/i,
    fuente:"ABB CP-E — catálogo 2CDC114xxx (RAL 7035, LED verde OUT OK, potenciómetro de ajuste, bornes arriba / abajo)",
    col:{ cuerpo:RAL.r7035, frente:"#e4e6e3", marca:MARCA.abb, bornes:METAL, rejilla:"#8a8f96" }, bisel:1.5,
    perfil:{ tipo:"modular", nariz:0.62, ny:0.5, hombro:0.72 },
    rasgos:[ { t:"led", x:0.3, y:0.66, color:"#2fd05a", r:1.4 }, { t:"dial", x:0.7, y:0.66, r:0.08, color:"#f4f5f6" },
      { t:"etiqueta", x:0.5, y:0.45, w:0.8, h:0.14 }, { t:"franja", x:0.5, y:0.3, w:0.4, h:0.015, color:"marca" },
      { t:"bornes", lado:"ambos", n:4, forma:"tornillo" } ] },
  { id:"ab-1606", marca:"Allen-Bradley", nombre:"1606-XLE / XLB / XL (fuentes)", tipos:["fuente"], re:/1606-/i,
    fuente:"Allen-Bradley 1606-XLE — 1606-TD002 (carcasa de aluminio, frente gris con LED DC OK y potenciómetro, bornes arriba / abajo)",
    col:{ cuerpo:"#bfc3c7", frente:"#5b6068", marca:MARCA.rockwell, bornes:"#2b2e33", rejilla:"#4a4f57" }, bisel:2,
    rasgos:[ { t:"rebaje", x:0.5, y:0.5, w:0.86, h:0.6, color:"frente", sal:2 },
      { t:"led", x:0.35, y:0.7, color:"#2fd05a", r:1.4 }, { t:"dial", x:0.65, y:0.7, r:0.09, color:"#f4f5f6" },
      { t:"etiqueta", x:0.5, y:0.45, w:0.72, h:0.16, color:"#e9eaeb" }, { t:"franja", x:0.5, y:0.27, w:0.5, h:0.015, color:"marca" },
      { t:"conector", x:0.5, y:0.9, w:0.86, h:0.1, n:3, color:"bornes" }, { t:"conector", x:0.5, y:0.1, w:0.86, h:0.1, n:4, color:"bornes" },
      { t:"rejilla", x:0.5, y:0.97, w:0.6, h:0.02, n:1, color:"rejilla" } ] },
  { id:"phoenix-quint", marca:"Phoenix Contact", nombre:"QUINT / TRIO / UNO POWER", tipos:["fuente"], re:/QUINT|TRIO|UNO-PS|UNO POWER/i,
    fuente:"Phoenix Contact QUINT4-PS — hoja de datos (frente gris oscuro con LED de estado y potenciómetro, bornes push-in arriba / abajo)",
    col:{ cuerpo:"#bcc0c4", frente:"#3a3c3f", marca:MARCA.phoenix, bornes:"#2b2e33", acento:"#f08a24" }, bisel:2,
    rasgos:[ { t:"rebaje", x:0.5, y:0.5, w:0.9, h:0.62, color:"frente", sal:2 },
      { t:"led", x:0.3, y:0.7, color:"#2fd05a", n:2, dy:-0.06, r:1.3 }, { t:"dial", x:0.68, y:0.7, r:0.09, color:"#f4f5f6" },
      { t:"franja", x:0.5, y:0.32, w:0.6, h:0.02, color:"marca" },
      { t:"conector", x:0.5, y:0.9, w:0.88, h:0.1, n:4, color:"bornes" }, { t:"conector", x:0.5, y:0.1, w:0.88, h:0.1, n:4, color:"bornes" } ] },
  { id:"siemens-sitop", marca:"Siemens", nombre:"SITOP PSU8200 / PSU6200", tipos:["fuente"], re:/SITOP|6EP/i,
    fuente:"Siemens SITOP — catálogo KT 10.1 (frente antracita, LED, potenciómetro, bornes de tornillo)",
    col:{ cuerpo:"#b9bdc1", frente:"#383e42", marca:MARCA.siemens, bornes:METAL }, bisel:2,
    rasgos:[ { t:"rebaje", x:0.5, y:0.5, w:0.9, h:0.62, color:"frente", sal:2 }, { t:"led", x:0.3, y:0.7, color:"#2fd05a", r:1.3 },
      { t:"dial", x:0.68, y:0.7, r:0.09, color:"#f4f5f6" }, { t:"franja", x:0.5, y:0.3, w:0.6, h:0.02, color:"marca" }, { t:"bornes", lado:"ambos", n:4, forma:"tornillo" } ] },
  { id:"fuente-generica", marca:"", nombre:"Fuente de alimentación", tipos:["fuente"], generico:true, fuente:"IEC 61204",
    col:{ cuerpo:"#c9ccc9", frente:"#5b6068", bornes:METAL }, bisel:2,
    rasgos:[ { t:"rebaje", x:0.5, y:0.5, w:0.86, h:0.6, color:"frente", sal:2 }, { t:"led", x:0.35, y:0.7, color:"#2fd05a", r:1.4 }, { t:"dial", x:0.65, y:0.7, r:0.09, color:"#f4f5f6" },
      { t:"bornes", lado:"ambos", n:4, forma:"tornillo" } ] },

  /* ===================== PLC ===================== */
  { id:"ab-5380", marca:"Allen-Bradley", nombre:"CompactLogix 5380 (5069-L3…)", tipos:["cpu"], re:/5069-L/i,
    fuente:"Allen-Bradley 5069-TD002 / 5069-UM001 (pantalla de estado de 4 caracteres, selector de modo, puertos EtherNet/IP abajo, RTB MOD / SA arriba)",
    col:{ cuerpo:"#2a2c30", frente:"#34373c", marca:MARCA.rockwell, rtb:"#1a1b1e", puerto:"#a7acb2" }, bisel:1.5,
    rasgos:[ { t:"conector", x:0.27, y:0.9, w:0.4, h:0.13, n:4, cols:2, color:"rtb" }, { t:"conector", x:0.73, y:0.9, w:0.4, h:0.13, n:6, cols:2, color:"rtb" },
      { t:"display", x:0.5, y:0.72, w:0.6, h:0.07, color:"#6f3a1f", luz:"#ff6a1a" },
      { t:"led", x:0.2, y:0.62, color:"#2fd05a", n:4, dx:0.2, r:1.1 },
      { t:"tapa", x:0.5, y:0.46, w:0.7, h:0.18, sal:1.5, color:"frente" }, { t:"bloque", x:0.8, y:0.33, w:0.12, h:0.05, sal:3, color:"#8a8f96" },
      { t:"puertos", x:0.5, y:0.14, w:0.7, h:0.12, n:2, filas:1, color:"puerto" }, { t:"franja", x:0.5, y:0.56, w:0.5, h:0.012, color:"marca" } ] },
  { id:"ab-5069-io", marca:"Allen-Bradley", nombre:"Compact 5000 I/O (5069-…)", tipos:["modulo","fpd"], re:/5069-/i,
    fuente:"Allen-Bradley 5069-TD001 (módulo de 22 mm con indicadores arriba y bornera extraíble RTB de 18 bornes al frente)",
    col:{ cuerpo:"#2a2c30", frente:"#34373c", marca:MARCA.rockwell, rtb:"#1a1b1e" }, bisel:1,
    rasgos:[ { t:"franja", x:0.5, y:0.93, w:0.82, h:0.035, color:"io" }, { t:"led", x:0.3, y:0.86, color:"#2fd05a", n:2, dx:0.4, r:0.9 },
      { t:"conector", x:0.5, y:0.43, w:0.86, h:0.74, n:18, cols:1, color:"rtb" } ] },
  { id:"ab-5370", marca:"Allen-Bradley", nombre:"CompactLogix 5370 (1769-L3…)", tipos:["cpu"], re:/1769-L/i,
    fuente:"Allen-Bradley 1769-TD005 (carcasa gris, puerta frontal, puertos EtherNet/IP y USB, LED de estado)",
    col:{ cuerpo:"#7d8288", frente:"#3a3e44", marca:MARCA.rockwell, puerto:"#a7acb2" }, bisel:1.5,
    rasgos:[ { t:"tapa", x:0.5, y:0.55, w:0.84, h:0.56, sal:2, color:"frente" }, { t:"led", x:0.25, y:0.88, color:"#2fd05a", n:4, dx:0.17, r:1 },
      { t:"puertos", x:0.5, y:0.13, w:0.7, h:0.1, n:2, filas:1, color:"puerto" }, { t:"franja", x:0.5, y:0.95, w:0.5, h:0.015, color:"marca" } ] },
  { id:"ab-1769-io", marca:"Allen-Bradley", nombre:"Compact I/O (1769-…)", tipos:["modulo","fpd","tapa"], re:/1769-/i,
    fuente:"Allen-Bradley 1769-TD006 (módulo gris de 35 mm con puerta frontal sobre la bornera extraíble)",
    col:{ cuerpo:"#7d8288", frente:"#3a3e44", marca:MARCA.rockwell }, bisel:1,
    rasgos:[ { t:"franja", x:0.5, y:0.93, w:0.8, h:0.035, color:"io" }, { t:"led", x:0.3, y:0.86, color:"#2fd05a", n:2, dx:0.4, r:0.9 },
      { t:"tapa", x:0.5, y:0.43, w:0.86, h:0.74, sal:2, color:"frente" }, { t:"etiqueta", x:0.5, y:0.45, w:0.7, h:0.4, color:"#e9eaeb" } ] },
  { id:"siemens-1500-cpu", marca:"Siemens", nombre:"SIMATIC S7-1500 (CPU)", tipos:["cpu"], re:/6ES7 ?51|6ES7 ?15/i,
    fuente:"Siemens S7-1500 — manual de sistema A5E03461182 (carcasa antracita, pantalla a color con 4 teclas, LED RUN / ERROR / MAINT, tapa frontal)",
    col:{ cuerpo:"#2e3135", frente:"#3a3f44", marca:MARCA.siemens }, bisel:1.5,
    rasgos:[ { t:"led", x:0.25, y:0.93, color:"#2fd05a", n:3, dx:0.18, r:1.1 },
      { t:"display", x:0.5, y:0.7, w:0.7, h:0.2, color:"#3c6e91", luz:"#1d3c52" }, { t:"teclado", x:0.5, y:0.54, w:0.6, h:0.05, filas:1, cols:4, color:"#55595f" },
      { t:"tapa", x:0.5, y:0.27, w:0.84, h:0.4, sal:1.5, color:"frente" }, { t:"franja", x:0.5, y:0.84, w:0.84, h:0.015, color:"marca" } ] },
  { id:"siemens-1500-io", marca:"Siemens", nombre:"SIMATIC S7-1500 (E/S y PM, 35 mm)", tipos:["modulo","fpd","tapa"], re:/6ES7 ?5[02-5]|6EP1 ?33/i,
    fuente:"Siemens S7-1500 — manuales de producto (módulo antracita con LED de estado y de canal a la izquierda, tapa frontal sobre el conector de 40 polos, tira de rotulación)",
    col:{ cuerpo:"#2e3135", frente:"#3a3f44", marca:MARCA.siemens }, bisel:1,
    rasgos:[ { t:"led", x:0.25, y:0.93, color:"#2fd05a", n:3, dx:0.25, r:0.9 }, { t:"franja", x:0.5, y:0.87, w:0.84, h:0.02, color:"io" },
      { t:"tapa", x:0.5, y:0.43, w:0.9, h:0.76, sal:2, color:"frente" }, { t:"etiqueta", x:0.62, y:0.43, w:0.5, h:0.66, color:"#e9eaeb" },
      { t:"led", x:0.18, y:0.75, color:"#2fd05a", n:8, dy:-0.08, r:0.7 } ] },
  { id:"siemens-1200", marca:"Siemens", nombre:"SIMATIC S7-1200 (CPU y SM)", tipos:["cpu","modulo","fpd","tapa"], re:/6ES7 ?2[1-3]/i,
    fuente:"Siemens S7-1200 — manual de sistema A5E02486680 (carcasa antracita con tapas grises abatibles arriba y abajo, LED de canal verdes)",
    col:{ cuerpo:"#3b3e43", frente:"#9da2a8", marca:MARCA.siemens, puerto:"#a7acb2" }, bisel:1.5,
    rasgos:[ { t:"tapa", x:0.5, y:0.89, w:0.92, h:0.16, sal:2, color:"frente" }, { t:"tapa", x:0.5, y:0.11, w:0.92, h:0.16, sal:2, color:"frente" },
      { t:"led", x:0.12, y:0.7, color:"#2fd05a", n:8, dx:0.1, r:0.9 }, { t:"led", x:0.12, y:0.3, color:"#2fd05a", n:8, dx:0.1, r:0.9 },
      { t:"franja", x:0.5, y:0.5, w:0.8, h:0.03, color:"marca" }, { t:"etiqueta", x:0.5, y:0.58, w:0.6, h:0.06, color:"#55595f" } ] },
  { id:"se-m580-cpu", marca:"Schneider Electric", nombre:"Modicon M580 / M340 (CPU)", tipos:["cpu"], re:/BMEP58|BMXP34|BMEH58/i,
    fuente:"Schneider Electric Modicon M580 — hardware reference manual EIO0000001578 (bloque de LED arriba, puertos Ethernet, tarjeta SD)",
    col:{ cuerpo:"#2a2c2e", frente:"#3a3d40", marca:MARCA.schneider, puerto:"#a7acb2" }, bisel:1.5,
    rasgos:[ { t:"display", x:0.5, y:0.86, w:0.76, h:0.12, color:"#141517", luz:"#000000" }, { t:"led", x:0.25, y:0.88, color:"#2fd05a", n:4, dx:0.17, r:1 },
      { t:"franja", x:0.5, y:0.77, w:0.76, h:0.015, color:"marca" }, { t:"puertos", x:0.5, y:0.36, w:0.6, h:0.3, n:1, filas:3, color:"puerto" },
      { t:"tapa", x:0.5, y:0.6, w:0.6, h:0.1, sal:1, color:"frente" } ] },
  { id:"se-x80-ps", marca:"Schneider Electric", nombre:"Fuente BMX CPS (X80)", tipos:["modulo"], re:/BMXCPS/i,
    fuente:"Schneider Electric BMXCPS — hoja de datos (bloque de LED, tapa frontal de bornes)",
    col:{ cuerpo:"#2a2c2e", frente:"#3a3d40", marca:MARCA.schneider }, bisel:1.5,
    rasgos:[ { t:"display", x:0.5, y:0.86, w:0.76, h:0.12, color:"#141517", luz:"#000000" }, { t:"led", x:0.3, y:0.88, color:"#2fd05a", n:2, dx:0.4, r:1 },
      { t:"franja", x:0.5, y:0.77, w:0.76, h:0.015, color:"marca" }, { t:"tapa", x:0.5, y:0.38, w:0.84, h:0.6, sal:2, color:"frente" } ] },
  { id:"se-x80-io", marca:"Schneider Electric", nombre:"Modicon X80 (E/S, 32 mm)", tipos:["modulo","fpd","tapa"], re:/BMX|BME/i,
    fuente:"Schneider Electric X80 — manuales de E/S 35012474 / 35011978 (bloque de LED arriba, conector extraíble de 20 / 40 bornes)",
    col:{ cuerpo:"#2a2c2e", frente:"#3a3d40", marca:MARCA.schneider, rtb:"#1a1b1e" }, bisel:1,
    rasgos:[ { t:"display", x:0.5, y:0.87, w:0.8, h:0.11, color:"#141517", luz:"#000000" }, { t:"led", x:0.25, y:0.88, color:"#2fd05a", n:4, dx:0.17, r:0.8 },
      { t:"franja", x:0.5, y:0.79, w:0.8, h:0.02, color:"io" }, { t:"conector", x:0.5, y:0.4, w:0.84, h:0.66, n:20, cols:2, color:"rtb" } ] },
  { id:"plc-cpu-generico", marca:"", nombre:"CPU de PLC", tipos:["cpu"], generico:true, fuente:"IEC 61131-2",
    col:{ cuerpo:"#2f3338", frente:"#3a3e44", puerto:"#a7acb2" }, bisel:1.5,
    rasgos:[ { t:"display", x:0.5, y:0.82, w:0.7, h:0.1, color:LCD, luz:"#1d3c52" }, { t:"led", x:0.2, y:0.68, color:"#2fd05a", n:4, dx:0.2, r:1.1 },
      { t:"tapa", x:0.5, y:0.45, w:0.76, h:0.24, sal:1.5, color:"frente" }, { t:"puertos", x:0.5, y:0.14, w:0.7, h:0.12, n:2, filas:1, color:"puerto" } ] },
  { id:"plc-io-generico", marca:"", nombre:"Módulo de E/S", tipos:["modulo","fpd"], generico:true, fuente:"IEC 61131-2",
    col:{ cuerpo:"#2f3338", frente:"#3a3e44", rtb:"#1a1b1e" }, bisel:1,
    rasgos:[ { t:"franja", x:0.5, y:0.92, w:0.84, h:0.04, color:"io" }, { t:"led", x:0.3, y:0.85, color:"#2fd05a", n:2, dx:0.4, r:0.9 },
      { t:"conector", x:0.5, y:0.43, w:0.86, h:0.74, n:16, cols:1, color:"rtb" } ] },
  { id:"plc-tapa-generica", marca:"", nombre:"Tapa terminadora", tipos:["tapa"], generico:true, fuente:"Tapa terminadora del bus del PLC",
    col:{ cuerpo:"#3b3f46", frente:"#4a4f57" }, bisel:1, rasgos:[ { t:"bloque", x:0.5, y:0.5, w:0.6, h:0.8, sal:1.5, color:"frente" } ] },

  /* ===================== red, servicios del tablero ===================== */
  { id:"ab-stratix", marca:"Allen-Bradley", nombre:"Stratix 5700 / 5800 / 2500 (1783-…)", tipos:["switch"], re:/Stratix|1783-/i,
    fuente:"Allen-Bradley 1783-TD001 (carcasa negra con puertos RJ45 al frente, LED de puerto y de estado, tarjeta SD)",
    col:{ cuerpo:"#24262a", frente:"#2f3237", marca:MARCA.rockwell, puerto:"#a7acb2" }, bisel:2,
    rasgos:[ { t:"led", x:0.2, y:0.9, color:"#2fd05a", n:4, dx:0.2, r:1.1 }, { t:"franja", x:0.5, y:0.83, w:0.8, h:0.015, color:"marca" },
      { t:"puertos", x:0.5, y:0.45, w:0.82, h:0.5, n:2, filas:5, color:"puerto" }, { t:"conector", x:0.5, y:0.08, w:0.6, h:0.07, n:4, color:"#1a1b1e" } ] },
  { id:"siemens-scalance", marca:"Siemens", nombre:"SCALANCE XB-200 / XC-200", tipos:["switch"], re:/SCALANCE|6GK5/i,
    fuente:"Siemens SCALANCE XB-200 — instrucciones de servicio (carcasa antracita, puertos RJ45 al frente, LED por puerto)",
    col:{ cuerpo:"#383e42", frente:"#2e3135", marca:MARCA.siemens, puerto:"#a7acb2" }, bisel:2,
    rasgos:[ { t:"led", x:0.2, y:0.9, color:"#2fd05a", n:4, dx:0.2, r:1.1 }, { t:"franja", x:0.5, y:0.84, w:0.8, h:0.02, color:"marca" },
      { t:"puertos", x:0.5, y:0.45, w:0.8, h:0.48, n:2, filas:4, color:"puerto" }, { t:"conector", x:0.5, y:0.08, w:0.6, h:0.07, n:4, color:"#1a1b1e" } ] },
  { id:"switch-generico", marca:"", nombre:"Switch Ethernet industrial", tipos:["switch"], generico:true, fuente:"IEEE 802.3",
    col:{ cuerpo:"#2b2f36", frente:"#33373e", puerto:"#a7acb2" }, bisel:2,
    rasgos:[ { t:"led", x:0.2, y:0.9, color:"#2fd05a", n:4, dx:0.2, r:1.1 }, { t:"puertos", x:0.5, y:0.45, w:0.8, h:0.48, n:2, filas:4, color:"puerto" } ] },
  { id:"teltonika-rut", marca:"Teltonika", nombre:"RUT9xx (router 4G industrial)", tipos:["router"], re:/RUT/i,
    fuente:"Teltonika RUT956 — hoja de datos (carcasa de aluminio, conectores SMA de antena arriba, LED de señal y puertos RJ45)",
    col:{ cuerpo:"#50555d", frente:"#2b2e33", marca:MARCA.teltonika, puerto:"#a7acb2", antena:LATON }, bisel:2,
    rasgos:[ { t:"led", x:0.25, y:0.82, color:"#2fd05a", n:5, dy:-0.06, r:1 }, { t:"franja", x:0.5, y:0.93, w:0.7, h:0.02, color:"marca" },
      { t:"puertos", x:0.6, y:0.3, w:0.6, h:0.4, n:1, filas:4, color:"puerto" }, { t:"antenas", n:3, color:"antena" } ] },
  { id:"router-generico", marca:"", nombre:"Router industrial", tipos:["router"], generico:true, fuente:"Router 4G / VPN en riel DIN",
    col:{ cuerpo:"#50555d", frente:"#2b2e33", puerto:"#a7acb2", antena:LATON }, bisel:2,
    rasgos:[ { t:"led", x:0.25, y:0.82, color:"#2fd05a", n:4, dy:-0.06, r:1 }, { t:"puertos", x:0.6, y:0.3, w:0.6, h:0.4, n:1, filas:3, color:"puerto" }, { t:"antenas", n:2, color:"antena" } ] },
  { id:"stego-kt", marca:"STEGO", nombre:"KTO 011 / KTS 011 (termostato de gabinete)", tipos:["termostato"], re:/STEGO|KT[OS]\s?011/i,
    fuente:"STEGO KTO 011 / KTS 011 — hoja de datos (carcasa gris clara, dial de ajuste rojo KTO / azul KTS)",
    col:{ cuerpo:"#e6e7e9", marca:MARCA.stego, bornes:METAL, dial:"#2b6cb0" }, bisel:2,
    rasgos:[ { t:"perilla", x:0.5, y:0.55, r:0.3, sal:5, color:"dial", flecha:true }, { t:"etiqueta", x:0.5, y:0.22, w:0.8, h:0.1 }, { t:"bornes", lado:"abajo", n:2, forma:"tornillo", y:0.08 } ] },
  { id:"termostato-generico", marca:"", nombre:"Termostato", tipos:["termostato"], generico:true, fuente:"Termostato bimetálico de gabinete",
    col:{ cuerpo:"#e6e7e9", bornes:METAL, dial:"#2b6cb0" }, bisel:2, rasgos:[ { t:"perilla", x:0.5, y:0.55, r:0.3, sal:5, color:"dial", flecha:true }, { t:"bornes", lado:"abajo", n:2, forma:"tornillo", y:0.08 } ] },
  { id:"toma-din", marca:"", nombre:"Tomacorriente para riel DIN", tipos:["tomacorriente"], generico:true, fuente:"Tomacorriente doble modular (referencial)",
    col:{ cuerpo:"#f1f1ef", frente:"#e2e3e1", hueco:"#2b2e33", bornes:METAL }, bisel:1.5,
    perfil:{ tipo:"modular", nariz:0.6, ny:0.5, hombro:0.62 },
    rasgos:[ { t:"bloque", x:0.27, y:0.5, w:0.36, h:0.44, sal:1, color:"frente" }, { t:"bloque", x:0.73, y:0.5, w:0.36, h:0.44, sal:1, color:"frente" },
      { t:"ventana", x:0.22, y:0.55, w:0.04, h:0.08, color:"hueco" }, { t:"ventana", x:0.32, y:0.55, w:0.04, h:0.08, color:"hueco" }, { t:"ventana", x:0.27, y:0.42, w:0.05, h:0.05, color:"hueco" },
      { t:"ventana", x:0.68, y:0.55, w:0.04, h:0.08, color:"hueco" }, { t:"ventana", x:0.78, y:0.55, w:0.04, h:0.08, color:"hueco" }, { t:"ventana", x:0.73, y:0.42, w:0.05, h:0.05, color:"hueco" },
      { t:"bornes", lado:"ambos", n:3, forma:"tornillo" } ] },
  { id:"resistencia", marca:"", nombre:"Resistencia calefactora de gabinete", tipos:["resistencia"], generico:true,
    fuente:"Calefactores de gabinete con perfil de aluminio (STEGO / Pfannenberg; referencial)",
    col:{ cuerpo:"#c9cdd1", frente:"#2b2e33", aletas:"#b5bac0" }, bisel:1.5,
    rasgos:[ { t:"aletas", lado:"frente", n:7, color:"aletas" }, { t:"bloque", x:0.5, y:0.06, w:0.6, h:0.08, sal:2, color:"frente" } ] },
  { id:"luminaria", marca:"Rittal", nombre:"Luminaria LED de gabinete", tipos:["luminaria"], generico:true, fuente:"Rittal SZ 2500 — luminaria LED (referencial)",
    col:{ cuerpo:"#f4f5f6", difusor:"#fff7d6" }, bisel:2, rasgos:[] },
  { id:"finpuerta", marca:"Rittal", nombre:"Interruptor de puerta", tipos:["finpuerta"], generico:true, fuente:"Rittal SZ 4127 (referencial)",
    col:{ cuerpo:"#3b3f46", frente:"#8a8f96" }, bisel:1, rasgos:[ { t:"bloque", x:0.5, y:0.85, w:0.4, h:0.3, sal:6, color:"frente" } ] },
  { id:"peine", marca:"ABB", nombre:"Barra peine PS3", tipos:["peine"], generico:true, fuente:"ABB PS3 (referencial)", col:{ cuerpo:"#c8783a" }, rasgos:[] },

  /* ===================== bornes (bornera) ===================== */
  { id:"phoenix-hesi", marca:"Phoenix Contact", nombre:"UT 4-HESI (fusible-borne con LED)", tipos:["borne"], re:/HESI/i,
    fuente:"Phoenix Contact UT 4-HESI — catálogo (borne negro con portafusible abatible)",
    col:{ cuerpo:"#2f3236", marcador:"#f4f5f2", bornes:METAL, palanca:"#1a1b1e" }, forma:"fusible" },
  { id:"phoenix-ut", marca:"Phoenix Contact", nombre:"UT / UKH (bornes de tornillo)", tipos:["borne"], re:/^UT|^UKH/i,
    fuente:"Phoenix Contact CLIPLINE complete — catálogo (gris RAL 7042, azul neutro, verde-amarillo PE, canal de marcado central)",
    col:{ cuerpo:"#9ea3a6", neutro:"#2f73b5", pe:"#3f9a3f", pe2:"#e3c62a", marcador:"#f4f5f2", bornes:METAL }, forma:"tornillo" },
  { id:"phoenix-pt", marca:"Phoenix Contact", nombre:"PT / PTTB (bornes push-in)", tipos:["borne"], re:/^PT/i,
    fuente:"Phoenix Contact PT / PTTB — catálogo (gris, pulsador naranja de apertura, dos pisos en PTTB)",
    col:{ cuerpo:"#9ea3a6", neutro:"#2f73b5", pe:"#3f9a3f", pe2:"#e3c62a", marcador:"#f4f5f2", bornes:"#f08a24" }, forma:"resorte" },
  { id:"borne-generico", marca:"", nombre:"Borne de paso", tipos:["borne"], generico:true, fuente:"IEC 60947-7-1",
    col:{ cuerpo:"#9ea3a6", neutro:"#2f73b5", pe:"#3f9a3f", pe2:"#e3c62a", marcador:"#f4f5f2", bornes:METAL }, forma:"tornillo" },

  /* ===================== dispositivos de puerta ===================== */
  { id:"abb-rhe", marca:"ABB", nombre:"Mando rotativo RHE en puerta", tipos:["manija"], generico:true, fuente:"ABB Tmax XT — mando rotativo RHE (placa amarilla, manija roja, IP65)",
    col:{ cuerpo:"#f5c518", palanca:"#d2312b", base:"#2b2e33" } },
  { id:"abb-acs-ap", marca:"ABB", nombre:"Panel ACS-AP-I + DPMP-01", tipos:["panelvfd"], generico:true, fuente:"ABB ACS-AP-I — manual del panel asistente",
    col:{ cuerpo:"#2b2e33", display:LCD, teclas:"#4a4f57", marco:"#3a3e44" } },
  { id:"ab-panelview", marca:"Allen-Bradley", nombre:"PanelView Plus 7", tipos:["hmi"], re:/PanelView|2711P/i, fuente:"Allen-Bradley 2711P-TD001 (marco gris oscuro, pantalla táctil)",
    col:{ cuerpo:"#2f3236", marco:"#3d4045", display:"#2f6b9a", marca:MARCA.rockwell } },
  { id:"siemens-comfort", marca:"Siemens", nombre:"SIMATIC HMI Comfort / Basic Panel", tipos:["hmi"], re:/TP\d{3,4}|SIMATIC|KTP/i, fuente:"Siemens SIMATIC HMI Comfort — instrucciones de servicio (marco antracita)",
    col:{ cuerpo:"#2e3135", marco:"#383e42", display:"#2f6b9a", marca:MARCA.siemens } },
  { id:"hmi-generico", marca:"", nombre:"Pantalla HMI", tipos:["hmi"], generico:true, fuente:"Panel de operador táctil",
    col:{ cuerpo:"#2b2f36", marco:"#3a3e44", display:"#2f6b9a" } },
  { id:"rittal-sk", marca:"Rittal", nombre:"Ventilador con filtro SK / filtro de salida", tipos:["ventilador","rejilla"], generico:true,
    fuente:"Rittal SK 3238 / 3239 (marco RAL 7035 con persiana, estera filtrante) — referencial",
    col:{ cuerpo:"#cfd1ce", persiana:"#b9bcb8", filtro:"#e9e7df", helice:"#2b2e33" } },
  { id:"aa-puerta", marca:"", nombre:"Aire acondicionado de puerta", tipos:["aa"], generico:true, fuente:"Equipos de climatización de puerta (referencial)",
    col:{ cuerpo:"#e3e4e2", rejilla:"#9aa0a8", panel:"#2b2e33" } },
  { id:"mando-22", marca:"", nombre:"Dispositivos de mando y señalización 22 mm", tipos:["luz","pulsador","selector","potenciometro","seta"], generico:true,
    fuente:"ABB Compact / Modular 22 mm, Allen-Bradley 800F (anillo cromado / negro, lente o botón de color, placa de leyenda) — referencial",
    col:{ cuerpo:"#c9cdd1", anillo:"#d8dbde", base:"#1d1e21", leyenda:"#f4f5f6", seta:"#d2312b", anilloSeta:"#f5c518" } },

  /* ===================== accesorios ===================== */
  { id:"canaleta", marca:"", nombre:"Canaleta ranurada PVC", tipos:["canaleta"], generico:true, fuente:"Canaleta ranurada PVC gris RAL 7030 (referencial)",
    col:{ cuerpo:"#9a9b94", tapa:"#a7a8a1", ranura:"#3b3d40" } },
  { id:"riel", marca:"", nombre:"Riel DIN TS35", tipos:["riel"], generico:true, fuente:"IEC 60715 — acero galvanizado", col:{ cuerpo:"#c3c8ce" } },
  { id:"barra", marca:"", nombre:"Barras de cobre", tipos:["barra"], generico:true, fuente:"DIN 43671 — Cu ETP", col:{ cuerpo:"#c8783a", pe:"#2e9e4f", aislador:"#a0362c", soporte:"#4b4f56" } },
];

/* ---------- consulta ---------- */
const hex = v => typeof v==="number" ? v : parseInt(String(v).replace("#", ""), 16);
const cache = new Map();
/* color de un rasgo: nombre de la paleta de la familia, "#rrggbb" o número */
export function colorDe(ap, v, porDefecto){
  if(v==null) return hex(porDefecto ?? (ap && ap.col.cuerpo) ?? "#cccccc");
  if(typeof v==="number") return v;
  if(ap && ap.col[v]!=null) return hex(ap.col[v]);
  if(/^#?[0-9a-f]{6}$/i.test(v)) return hex(v);
  return hex(porDefecto ?? "#cccccc");
}
/* colores de la franja por tipo de E/S (rótulo del módulo) */
export const COLOR_IO = { AI:"#2b6cb0", AO:"#2e9e4f", DI:"#f5a623", DO:"#d2312b", PS:"#8a8f96" };

/* ficha de apariencia de un componente del arreglo (o null si el tipo no está en la base) */
export function apariencia(c, tipo){
  const t = tipo || (c && c.tipo); if(!t) return null;
  const txt = `${(c && c.modelo) || ""} ${(c && c.familia) || ""}`.trim();
  const key = t + "|" + txt;
  if(cache.has(key)) return cache.get(key);
  const cand = MODELOS.filter(e=>e.tipos.includes(t));
  const e = cand.find(e=>e.re && e.re.test(txt)) || cand.find(e=>e.generico) || null;
  cache.set(key, e);
  return e;
}
/* cantidad de polos de un equipo (aparamenta modular: uno por módulo de 17,5 mm) */
export function polosDe(c){
  if(c.polos) return c.polos;
  if(["mcb","diferencial","fusible","spd"].includes(c.tipo)) return Math.max(1, Math.round((c.w||17.5)/17.5));
  return 3;
}
/* cantidad de bornes de un rasgo «bornes» */
export function cuenta(n, c){
  if(n==="polos") return polosDe(c);
  if(n==="canales") return Math.max(1, Math.min(20, c.canales || 8));
  return Math.max(1, +n || 1);
}
/* región útil del frente (sin el bloque lateral) y bloque lateral si corresponde */
export function regiones(c, ap){
  const lat = ap && ap.lateral && ap.lateral.re.test(c.modelo || "") ? ap.lateral : null;
  const wl = lat ? Math.min(lat.w, c.w*0.4) : 0;
  return { x:c.x, w:c.w - wl, lateral: lat ? { x:c.x + c.w - wl, w:wl, color:lat.color } : null };
}
/* rasgos que aplican a este componente (condición «si» sobre el modelo) */
export function rasgosDe(c, ap){ return ((ap && ap.rasgos) || []).filter(r=>!r.si || r.si.test(c.modelo || "")); }
/* ficha del borne de una bornera por su modelo */
export const aparienciaBorne = modelo => apariencia({ modelo:String(modelo||"").replace(/-PE$|\s*PE$/i, "") }, "borne");

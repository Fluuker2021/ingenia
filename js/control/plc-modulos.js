/* Ingenia — BASE DE DATOS DE CONTROLADORES (PLC): familias, CPU, fuentes y módulos de E/S con los bornes de conexión
   de cada canal según la hoja de datos / manual de instalación del fabricante. La usan el multifilar de control
   (conexionado de E/S), los diagramas de lazo, el plano mecánico (dimensiones) y la arquitectura, para que al cambiar
   de controlador el conexionado salga con los bornes de ese equipo.
   Cada módulo: { modelo, marca, familia, tipo:"AI|AO|DI|DO|CPU|PS|FPD|TAP|RACK", nombre, canales, senal, alimentacion,
   conector, dim:[ancho, alto, fondo] (mm), bornes:{ alim, com, sh } (bornes del módulo: [n, nombre, descripción]),
   canal(ch, conexion) → { pos, neg, sh, com, alim, pin:{…}, puente:[…], notas }, verificado, notas, fuente (URL) }.
   «verificado»: true = bornes tomados del plano de referencia del usuario o confirmados en el documento del fabricante;
   false = numeración deducida (se marca en el plano con * y la nota de verificar con el manual).
   API estable (no cambiar las firmas):
     infoModulo(modelo)                         → ficha del módulo o null
     terminalesCanal(modelo, ch, conexion)      → bornes del canal ch (0…n-1) para la conexión pedida:
                                                  AI: "2h" (lazo de 2 hilos alimentado desde el tablero) | "4h" (4 hilos, fuente propia)
                                                  DI / DO / AO: "" (conexión normal del módulo)
     modulosFamilia(familia, tipo)              → modelos disponibles de ese tipo en la familia */

const ROK = d => `https://literature.rockwellautomation.com/idc/groups/literature/documents/${d}`;
const SIE = m => `https://support.industry.siemens.com/cs/pv/${String(m).replace(/\s+/g, "")}/td`;
const SE = m => `https://www.se.com/ww/es/product/${String(m).replace(/\s+/g, "")}/`;
export const FUENTES_PLC = {
  ab5069io: ROK("td/5069-td001_-en-p.pdf"), ab5069dig: ROK("um/5069-um004_-en-p.pdf"), ab5069ana: ROK("um/5069-um005_-en-p.pdf"), ab5380: ROK("td/5069-td002_-en-p.pdf"),
  ab1769: ROK("td/1769-td006_-en-p.pdf"), ab5370: ROK("um/1769-um021_-en-p.pdf"),
  s7ai: "https://support.industry.siemens.com/cs/attachments/59193205/s71500_ai_8xu_i_rtd_tc_st_manual_en-US_en-US.pdf",
  s71500sys: "https://support.industry.siemens.com/cs/document/59191792", s71200sys: "https://support.industry.siemens.com/cs/document/109797241",
  x80dis: "Schneider Electric, Modicon X80 — Discrete I/O Modules, User Manual 35012474", x80ana: "Schneider Electric, Modicon X80 — Analog I/O Modules, User Manual 35011978",
};
const NOTA_PIN = "Numeración de bornes deducida (el documento del fabricante no se pudo leer completo): verificar con la figura de asignación de pines del manual antes de construir.";

/* ---------- utilidades de canal ---------- */
const R = (o) => Object.assign({ pos:"", neg:"", sh:"", com:"", alim:"", pin:{}, puente:[], notas:"" }, o);
/* entrada analógica diferencial (+ / −): 2h = +24 Vdc del tablero (fusible XF2.k) → transmisor (+); transmisor (−) → IN+; IN− → 0 V */
const aiDif = (pos, neg, pPos, pNeg, sh, pSh, extra={}) => (cx) => R(Object.assign({ pos, neg, sh, pin:{ pos:pPos, neg:pNeg, sh:pSh },
  alim: cx==="2h" ? "+24 Vdc del tablero (fusible-borne XF2.k)" : "",
  notas: cx==="2h" ? `Lazo alimentado desde el tablero: +24 Vdc → transmisor (+); transmisor (−) → ${pos}; ${neg} → 0 V.` : `Transmisor de 4 hilos con fuente propia: salida (+) → ${pos}; salida (−) → ${neg}.` }, extra));

/* ======================= módulos ======================= */
export const MODULOS = {
  // ---------- Allen-Bradley CompactLogix 5380 / Compact 5000 I/O (bornes como en el plano de referencia del usuario) ----------
  ...Object.fromEntries(["5069-L306ER","5069-L310ER","5069-L320ER","5069-L330ER","5069-L340ER","5069-L350ERM"].map(m=>[m, { marca:"Allen-Bradley", familia:"ab5380", tipo:"CPU", nombre:"CompactLogix 5380", canales:0,
    alimentacion:"MOD 18…32 Vdc (RTB MOD) y SA de campo (RTB SA, 24 Vdc en este tablero)", conector:"RTB MOD y RTB SA incluidos con el controlador", dim:[80,147,105], red:"2 puertos EtherNet/IP",
    bornes:{ alim:[["1","MOD+","+24 Vdc"],["2","MOD+","puente"],["3","MOD−","0 V"],["4","MOD−","puente"]], com:[["1","SA+","+24 Vdc de campo"],["2","SA+","puente"],["3","SA−","0 V"],["4","SA−","puente"],["5","GND","tierra"],["6","GND","tierra"]] },
    verificado:true, notas:"Bornes MOD/SA del plano de referencia del usuario.", fuente:FUENTES_PLC.ab5380 }])),
  "5069-IF8": { marca:"Allen-Bradley", familia:"ab5380", tipo:"AI", nombre:"Entradas analógicas 8 canales", canales:8, senal:"±10 V, 0…10 V, 0…20 / 4…20 mA (diferenciales)",
    alimentacion:"Desde el bus MOD del rack", conector:"RTB 18 bornes 5069-RTB18-SCREW / -SPRING", dim:[22,145,105], bornes:{ sh:[["16","Shield","pantalla"],["17","Shield","pantalla"]] },
    canal:(ch, cx)=>aiDif(`IN${ch}+`, `IN${ch}-`, String(2*ch), String(2*ch+1), "Shield", "16")(cx), verificado:true, fuente:FUENTES_PLC.ab5069ana },
  "5069-IF16": { marca:"Allen-Bradley", familia:"ab5380", tipo:"AI", nombre:"Entradas analógicas 16 canales (simples)", canales:16, senal:"±10 V, 0…20 / 4…20 mA",
    alimentacion:"Desde el bus MOD del rack", conector:"RTB 5069-RTB18 (verificar)", dim:[22,145,105],
    canal:(ch, cx)=>aiDif(`IN${ch}`, "RTN", String(ch), "", "Shield", "")(cx), verificado:false, notas:NOTA_PIN, fuente:FUENTES_PLC.ab5069ana },
  "5069-OF8": { marca:"Allen-Bradley", familia:"ab5380", tipo:"AO", nombre:"Salidas analógicas 8 canales", canales:8, senal:"±10 V, 0…20 / 4…20 mA",
    alimentacion:"Desde el bus MOD del rack", conector:"RTB 18 bornes 5069-RTB18-SCREW / -SPRING", dim:[22,145,105], bornes:{ sh:[["16","Shield","pantalla"],["17","Shield","pantalla"]] },
    canal:(ch)=>R({ pos:`OUT${ch}+`, neg:`OUT${ch}-`, sh:"Shield", pin:{ pos:String(2*ch), neg:String(2*ch+1), sh:"16" } }), verificado:true, fuente:FUENTES_PLC.ab5069ana },
  "5069-OF4": { marca:"Allen-Bradley", familia:"ab5380", tipo:"AO", nombre:"Salidas analógicas 4 canales", canales:4, senal:"±10 V, 0…20 / 4…20 mA",
    alimentacion:"Desde el bus MOD del rack", conector:"RTB 18 bornes 5069-RTB18-SCREW / -SPRING", dim:[22,145,105],
    canal:(ch)=>R({ pos:`OUT${ch}+`, neg:`OUT${ch}-`, sh:"Shield", pin:{ pos:String(2*ch), neg:String(2*ch+1) }, notas:"Salida de corriente: carga entre OUT+ y OUT−." }), verificado:false, notas:NOTA_PIN, fuente:FUENTES_PLC.ab5069ana },
  "5069-IA16": { marca:"Allen-Bradley", familia:"ab5380", tipo:"DI", nombre:"Entradas digitales 16 canales 120 Vac", canales:16, senal:"79…132 Vac",
    alimentacion:"Retorno (N) común por el bus SA: lo entrega el 5069-FPD conectado a 120 Vac", conector:"RTB 18 bornes 5069-RTB18-SCREW / -SPRING", dim:[22,145,105],
    canal:(ch)=>R({ pos:`IN-${ch}`, com:"SA− (N)", pin:{ pos:String(ch+1) }, notas:"Contacto de campo entre L (120 Vac) y la entrada; el neutro llega por el bus SA del 5069-FPD." }), verificado:true, notas:"Bornes del plano de referencia del usuario.", fuente:FUENTES_PLC.ab5069dig },
  "5069-IB16": { marca:"Allen-Bradley", familia:"ab5380", tipo:"DI", nombre:"Entradas digitales 16 canales 24 Vdc (sink)", canales:16, senal:"10…32 Vdc, sinking",
    alimentacion:"Retorno común por el bus SA (SA−, 0 V)", conector:"RTB 18 bornes 5069-RTB18-SCREW / -SPRING", dim:[22,145,105],
    canal:(ch)=>R({ pos:`IN-${ch}`, com:"SA− (0 V)", pin:{ pos:String(ch+1) }, notas:"Contacto de campo entre +24 Vdc y la entrada; el 0 V llega por el bus SA." }), verificado:true, fuente:FUENTES_PLC.ab5069dig },
  "5069-OB16": { marca:"Allen-Bradley", familia:"ab5380", tipo:"DO", nombre:"Salidas digitales 16 canales 24 Vdc (source)", canales:16, senal:"10,8…28,8 Vdc, 0,5 A",
    alimentacion:"Alimentación de las salidas desde el bus SA (24 Vdc)", conector:"RTB 18 bornes 5069-RTB18-SCREW / -SPRING", dim:[22,145,105],
    canal:(ch)=>R({ pos:`OUT-${ch}`, com:"SA− (0 V)", pin:{ pos:String(ch) }, notas:"Carga entre la salida y 0 V." }), verificado:false, notas:NOTA_PIN, fuente:FUENTES_PLC.ab5069dig },
  "5069-OW16": { marca:"Allen-Bradley", familia:"ab5380", tipo:"DO", nombre:"Salidas a relé 16 canales (2 grupos de 8)", canales:16, senal:"Relé NA 5…125 Vdc / 5…250 Vac, 2 A",
    alimentacion:"Bobinas desde el bus MOD; contactos con su común por grupo", conector:"RTB 18 bornes 5069-RTB18-SCREW / -SPRING", dim:[22,145,105],
    canal:(ch)=>{ const g = Math.floor(ch/8); return R({ pos:`OUT${ch}`, com:`COM${g}`, pin:{ pos:String(ch+g), com:String(8+9*g) }, notas:"Común del grupo desde L (120 Vac); salida a la bobina del relé de interfaz." }); },
    bornes:{ com:[["8","COM0","común salidas 0…7"],["17","COM1","común salidas 8…15"]] }, verificado:true, fuente:FUENTES_PLC.ab5069dig },
  "5069-OX4I": { marca:"Allen-Bradley", familia:"ab5380", tipo:"DO", nombre:"Salidas a relé aisladas 4 canales", canales:4, senal:"Relé NA/NC aislado 5…125 Vdc / 5…250 Vac",
    alimentacion:"Bobinas desde el bus MOD", conector:"RTB 18 bornes 5069-RTB18-SCREW / -SPRING", dim:[22,145,105],
    canal:(ch)=>R({ pos:`NO-${ch}`, com:`COM-${ch}`, pin:{}, notas:"Cada canal con su propio común (aislado)." }), verificado:false, notas:NOTA_PIN, fuente:FUENTES_PLC.ab5069dig },
  "5069-FPD": { marca:"Allen-Bradley", familia:"ab5380", tipo:"FPD", nombre:"Distribuidor de potencial de campo", canales:0, alimentacion:"Nuevo bus SA (p. ej. 120 Vac para 5069-IA16)",
    conector:"RTB SA 6 bornes", dim:[22,145,105], bornes:{ alim:[["1","SA+","L"],["2","SA+","L (puente)"],["3","SA−","N"],["4","SA−","N (puente)"],["5","GND","tierra"],["6","GND","tierra"]] },
    verificado:true, notas:"Bornes del plano de referencia del usuario.", fuente:FUENTES_PLC.ab5069io },
  "5069-ECR": { marca:"Allen-Bradley", familia:"ab5380", tipo:"TAP", nombre:"Tapa terminadora derecha", canales:0, dim:[9,145,105], verificado:true, fuente:FUENTES_PLC.ab5069io },

  // ---------- Allen-Bradley CompactLogix 5370 / Compact I/O 1769 ----------
  "1769-L33ER": { marca:"Allen-Bradley", familia:"ab5370", tipo:"CPU", nombre:"CompactLogix 5370 L3", canales:0, alimentacion:"24 Vdc (fuente integrada, alimenta el bus 1769; máx. 16 módulos)",
    conector:"Bornes +24 Vdc / COM / tierra", dim:[55,118,105], bornes:{ alim:[["+24","+24 VDC","alimentación"],["COM","COM","0 V"],["GND","⏚","tierra"]] }, red:"2 puertos EtherNet/IP",
    verificado:false, notas:"Dimensiones aproximadas: verificar con 1769-UM021.", fuente:FUENTES_PLC.ab5370 },
  "1769-IF8": { marca:"Allen-Bradley", familia:"ab5370", tipo:"AI", nombre:"Entradas analógicas 8 canales", canales:8, senal:"±10 V, 0…10 V, 0…20 / 4…20 mA",
    alimentacion:"Desde el bus 1769 (5 V y 24 V)", conector:"Bornera extraíble del módulo", dim:[35,118,87], bornes:{ com:[["","ANLG Com","común analógico"]] },
    canal:(ch, cx)=>aiDif(`I in ${ch}+`, `V/I in ${ch}-`, "", "", "Pantalla a tierra del chasis", "")(cx), verificado:false, notas:"Corriente entre «I in n+» y «V/I in n−» (nombres de la bornera). "+NOTA_PIN, fuente:FUENTES_PLC.ab1769 },
  "1769-OF8C": { marca:"Allen-Bradley", familia:"ab5370", tipo:"AO", nombre:"Salidas analógicas de corriente 8 canales", canales:8, senal:"0…20 / 4…20 mA",
    alimentacion:"Desde el bus 1769", conector:"Bornera extraíble del módulo", dim:[35,118,87],
    canal:(ch)=>R({ pos:`I out ${ch}+`, neg:"ANLG Com", sh:"Pantalla a tierra", pin:{}, notas:"Carga entre «I out n+» y «ANLG Com»." }), verificado:false, notas:NOTA_PIN, fuente:FUENTES_PLC.ab1769 },
  "1769-IA16": { marca:"Allen-Bradley", familia:"ab5370", tipo:"DI", nombre:"Entradas digitales 16 canales 120 Vac", canales:16, senal:"79…132 Vac",
    alimentacion:"Neutro de campo a AC COM", conector:"Bornera extraíble del módulo", dim:[35,118,87], bornes:{ com:[["","AC COM","neutro (2 bornes)"]] },
    canal:(ch)=>R({ pos:`IN ${ch}`, com:"AC COM", pin:{}, notas:"Contacto entre L y la entrada; neutro a AC COM." }), verificado:false, notas:NOTA_PIN, fuente:FUENTES_PLC.ab1769 },
  "1769-IQ16": { marca:"Allen-Bradley", familia:"ab5370", tipo:"DI", nombre:"Entradas digitales 16 canales 24 Vdc (sink/source)", canales:16, senal:"10…30 Vdc",
    alimentacion:"Común por grupo de 8 (DC COM 1 / DC COM 2)", conector:"Bornera extraíble del módulo", dim:[35,118,87],
    canal:(ch)=>R({ pos:`IN ${ch}`, com:`DC COM ${1+Math.floor(ch/8)}`, pin:{} }), verificado:false, notas:NOTA_PIN, fuente:FUENTES_PLC.ab1769 },
  "1769-OW16": { marca:"Allen-Bradley", familia:"ab5370", tipo:"DO", nombre:"Salidas a relé 16 canales (2 grupos de 8)", canales:16, senal:"Relé NA 5…265 Vac / 5…125 Vdc",
    alimentacion:"Bobinas desde el bus 1769", conector:"Bornera extraíble del módulo", dim:[35,118,87],
    canal:(ch)=>R({ pos:`OUT ${ch}`, com:`VAC-VDC ${1+Math.floor(ch/8)}`, pin:{}, notas:"Común del grupo desde L." }), verificado:false, notas:NOTA_PIN, fuente:FUENTES_PLC.ab1769 },
  "1769-ECR": { marca:"Allen-Bradley", familia:"ab5370", tipo:"TAP", nombre:"Tapa terminadora derecha", canales:0, dim:[18,118,87], verificado:false, fuente:FUENTES_PLC.ab1769 },

  // ---------- Siemens SIMATIC S7-1500 (conector frontal 40 polos de 35 mm) ----------
  "6ES7 505-0KA00-0AB0": { marca:"Siemens", familia:"s71500", tipo:"PS", nombre:"PM 1507 24 V/3 A", canales:0, alimentacion:"Entrada 120/230 Vac (L1, N, PE); salida 24 Vdc / 3 A (L+, M)",
    conector:"Conectores de entrada y salida incluidos", dim:[50,147,129], perdidas:8, bornes:{ alim:[["L1","L1","fase"],["N","N","neutro"],["PE","PE","tierra"]], com:[["L+","L+","+24 Vdc a la CPU"],["M","M","0 V a la CPU"]] },
    verificado:false, notas:"Módulo de carga en el slot 0, a la izquierda de la CPU.", fuente:SIE("6ES7505-0KA00-0AB0") },
  ...Object.fromEntries([["6ES7 511-1AK02-0AB0","CPU 1511-1 PN",35],["6ES7 513-1AL02-0AB0","CPU 1513-1 PN",35],["6ES7 515-2AM02-0AB0","CPU 1515-2 PN",70]].map(([m, n, w])=>[m, { marca:"Siemens", familia:"s71500", tipo:"CPU", nombre:n, canales:0,
    alimentacion:"24 Vdc (conector de 4 polos: L+ / M con puente al siguiente equipo)", conector:"Conector de alimentación incluido", dim:[w,147,129], red:"PROFINET",
    bornes:{ alim:[["1L+","L+","+24 Vdc"],["1M","M","0 V"],["2L+","L+","puente"],["2M","M","puente"]] }, verificado:false, notas:"CPU en el slot 1 (el slot 0 es del PM).", fuente:SIE(m) }])),
  "6ES7 531-7KF00-0AB0": { marca:"Siemens", familia:"s71500", tipo:"AI", nombre:"AI 8xU/I/RTD/TC ST", canales:8, senal:"±10 V, 0/4…20 mA (2 y 4 hilos), RTD, TC",
    alimentacion:"24 Vdc en el elemento de alimentación del conector frontal: 41 (L+) y 44 (M); 42 / 43 para pasar al siguiente módulo",
    conector:"Conector frontal 40 polos 35 mm 6ES7592-1AM00-0XB0 (tornillo) o 6ES7592-1BM00-0XB0 (push-in), con elemento de alimentación", dim:[35,147,129], perdidas:2.7,
    pantalla:"Estribo de pantalla 6ES7590-5CA00-0AA0 + abrazaderas 6ES7590-5BA00-0AA0",
    bornes:{ alim:[["41","L+","+24 Vdc"],["44","M","0 V"],["42","L+","puente"],["43","M","puente"]] },
    canal:(ch, cx)=>{ const b = ch<4 ? 4*ch : 20 + 4*(ch-4), p = k=>String(b+k);
      return R({ pos:`I${ch}+`, neg:`M${ch}-`, sh:"Estribo", pin:{ pos:p(2), neg:p(4), alim:p(1) }, alim: cx==="2h" ? "+24 Vdc del tablero (fusible-borne XF2.k)" : "",
        notas: cx==="2h" ? `Lazo alimentado desde el tablero (en TIA Portal: «Intensidad 4 hilos», 4…20 mA): +24 Vdc → transmisor (+); transmisor (−) → ${p(2)} (I${ch}+); ${p(4)} (M${ch}−) → 0 V. Alternativa: alimentar desde el módulo, UV${ch} (${p(1)}) → transmisor (+), transmisor (−) → I${ch}+ (${p(2)}), tipo «Intensidad 2 hilos».`
          : `Transmisor de 4 hilos: salida (+) → ${p(2)} (I${ch}+); salida (−) → ${p(4)} (M${ch}−).` }); },
    verificado:false, notas:"Elemento de alimentación 41 (L+) / 44 (M) confirmado en el manual A5E03484864. Bornes del canal (UVn / In+ / Mn+ / Mn− = 1 / 2 / 3 / 4 del canal 0) deducidos: confirmar con las figuras 3-3 y 3-4 del manual.", fuente:FUENTES_PLC.s7ai },
  "6ES7 532-5HD00-0AB0": { marca:"Siemens", familia:"s71500", tipo:"AO", nombre:"AQ 4xU/I ST", canales:4, senal:"±10 V, 0/4…20 mA",
    alimentacion:"24 Vdc en el elemento de alimentación: 41 (L+) y 44 (M)", conector:"Conector frontal 40 polos 35 mm 6ES7592-1AM00-0XB0 / 6ES7592-1BM00-0XB0", dim:[35,147,129], perdidas:3,
    pantalla:"Estribo de pantalla 6ES7590-5CA00-0AA0 + abrazaderas 6ES7590-5BA00-0AA0", bornes:{ alim:[["41","L+","+24 Vdc"],["44","M","0 V"],["42","L+","puente"],["43","M","puente"]] },
    canal:(ch)=>{ const b = 4*ch; return R({ pos:`QI${ch}`, neg:"MANA", sh:"Estribo", pin:{ pos:String(b+1), neg:String(b+4) }, notas:"Salida de corriente: carga entre QIn y MANA (S+ / S− solo para tensión)." }); },
    verificado:false, notas:NOTA_PIN, fuente:SIE("6ES7532-5HD00-0AB0") },
  "6ES7 532-5HF00-0AB0": { marca:"Siemens", familia:"s71500", tipo:"AO", nombre:"AQ 8xU/I HS", canales:8, senal:"±10 V, 0/4…20 mA",
    alimentacion:"24 Vdc en el elemento de alimentación: 41 (L+) y 44 (M)", conector:"Conector frontal 40 polos 35 mm 6ES7592-1AM00-0XB0 / 6ES7592-1BM00-0XB0", dim:[35,147,129], perdidas:5.2,
    pantalla:"Estribo de pantalla 6ES7590-5CA00-0AA0 + abrazaderas 6ES7590-5BA00-0AA0", bornes:{ alim:[["41","L+","+24 Vdc"],["44","M","0 V"],["42","L+","puente"],["43","M","puente"]] },
    canal:(ch)=>{ const b = ch<4 ? 4*ch : 20 + 4*(ch-4); return R({ pos:`QI${ch}`, neg:"MANA", sh:"Estribo", pin:{ pos:String(b+1), neg:String(b+4) }, notas:"Carga entre QIn y MANA." }); },
    verificado:false, notas:NOTA_PIN, fuente:SIE("6ES7532-5HF00-0AB0") },
  "6ES7 521-1FH00-0AA0": { marca:"Siemens", familia:"s71500", tipo:"DI", nombre:"DI 16x230VAC BA", canales:16, senal:"120/230 Vac, 4 grupos de 4",
    alimentacion:"Neutro de cada grupo a 1N…4N", conector:"Conector frontal 40 polos 35 mm 6ES7592-1AM00-0XB0 / 6ES7592-1BM00-0XB0", dim:[35,147,129], perdidas:4.9,
    bornes:{ com:[["9","1N","neutro DI0…3"],["10","2N","neutro DI4…7"],["29","3N","neutro DI8…11"],["30","4N","neutro DI12…15"]] },
    canal:(ch)=>{ const g = Math.floor(ch/4); return R({ pos:`DI${ch}`, com:`${g+1}N`, pin:{ pos:String(ch<8 ? ch+1 : ch+13), com:["9","10","29","30"][g] }, puente:["1N…4N al neutro (puentes)"], notas:"Contacto de campo entre L y la entrada; neutro del grupo a nN." }); },
    verificado:false, notas:NOTA_PIN, fuente:SIE("6ES7521-1FH00-0AA0") },
  "6ES7 521-1BH00-0AB0": { marca:"Siemens", familia:"s71500", tipo:"DI", nombre:"DI 16x24VDC HF", canales:16, senal:"24 Vdc (lectura P), 2 grupos de 8",
    alimentacion:"1L+ / 1M y 2L+ / 2M (24 Vdc) por grupo", conector:"Conector frontal 40 polos 35 mm 6ES7592-1AM00-0XB0 / 6ES7592-1BM00-0XB0", dim:[35,147,129], perdidas:2.6,
    bornes:{ alim:[["19","1L+","+24 Vdc grupo 1"],["20","1M","0 V grupo 1"],["39","2L+","+24 Vdc grupo 2"],["40","2M","0 V grupo 2"]] },
    canal:(ch)=>{ const g = Math.floor(ch/8); return R({ pos:`DI${ch}`, com:`${g+1}M`, pin:{ pos:String(ch<8 ? ch+1 : ch+13), com:g ? "40" : "20" }, notas:"Contacto entre +24 Vdc y la entrada." }); },
    verificado:false, notas:NOTA_PIN, fuente:SIE("6ES7521-1BH00-0AB0") },
  "6ES7 521-1BH10-0AA0": { marca:"Siemens", familia:"s71500", tipo:"DI", nombre:"DI 16x24VDC BA", canales:16, senal:"24 Vdc (lectura P)",
    alimentacion:"L+ / M (24 Vdc)", conector:"Conector frontal 40 polos para módulos de 25 mm", dim:[25,147,129], perdidas:2.6,
    bornes:{ alim:[["19","L+","+24 Vdc"],["20","M","0 V"]] },
    canal:(ch)=>R({ pos:`DI${ch}`, com:"M", pin:{ pos:String(ch<8 ? ch+1 : ch+13), com:"20" } }), verificado:false, notas:NOTA_PIN, fuente:SIE("6ES7521-1BH10-0AA0") },
  "6ES7 522-5HF00-0AB0": { marca:"Siemens", familia:"s71500", tipo:"DO", nombre:"DQ 8x230VAC/5A ST (relé)", canales:8, senal:"Relé NA 24…230 Vac / 24…120 Vdc, 5 A, canales aislados",
    alimentacion:"24 Vdc para las bobinas: L+ / M", conector:"Conector frontal 40 polos 35 mm 6ES7592-1AM00-0XB0 / 6ES7592-1BM00-0XB0", dim:[35,147,129], perdidas:5,
    bornes:{ alim:[["39","L+","+24 Vdc bobinas"],["40","M","0 V"]] },
    canal:(ch)=>{ const b = ch<4 ? 4*ch : 20 + 4*(ch-4); return R({ pos:`DQ${ch}`, com:`${ch+1}L`, pin:{ pos:String(b+3), com:String(b+1) }, puente:["Raíces 1L…8L puenteadas a L"], notas:"Cada canal con su raíz nL; se puentean a L (120 Vac) en el conector frontal." }); },
    verificado:false, notas:NOTA_PIN, fuente:SIE("6ES7522-5HF00-0AB0") },
  "6ES7 522-1BH01-0AB0": { marca:"Siemens", familia:"s71500", tipo:"DO", nombre:"DQ 16x24VDC/0.5A ST", canales:16, senal:"24 Vdc / 0,5 A (fuente), 2 grupos de 8",
    alimentacion:"1L+ / 1M y 2L+ / 2M (24 Vdc) por grupo", conector:"Conector frontal 40 polos 35 mm 6ES7592-1AM00-0XB0 / 6ES7592-1BM00-0XB0", dim:[35,147,129], perdidas:2.5,
    bornes:{ alim:[["19","1L+","+24 Vdc grupo 1"],["20","1M","0 V grupo 1"],["39","2L+","+24 Vdc grupo 2"],["40","2M","0 V grupo 2"]] },
    canal:(ch)=>{ const g = Math.floor(ch/8); return R({ pos:`DQ${ch}`, com:`${g+1}M`, pin:{ pos:String(ch<8 ? ch+1 : ch+13), com:g ? "40" : "20" }, notas:"Carga entre la salida y M." }); },
    verificado:false, notas:NOTA_PIN, fuente:SIE("6ES7522-1BH01-0AB0") },

  // ---------- Siemens SIMATIC S7-1200 (bornes extraíbles; nombres impresos en el módulo) ----------
  ...Object.fromEntries([["6ES7 214-1AG40-0XB0","CPU 1214C DC/DC/DC",110,"24 Vdc"],["6ES7 214-1BG40-0XB0","CPU 1214C AC/DC/Rly",110,"120/230 Vac"],["6ES7 215-1AG40-0XB0","CPU 1215C DC/DC/DC",130,"24 Vdc"],["6ES7 215-1BG40-0XB0","CPU 1215C AC/DC/Rly",130,"120/230 Vac"]]
    .map(([m, n, w, v])=>[m, { marca:"Siemens", familia:"s71200", tipo:"CPU", nombre:n, canales:0, alimentacion:`${v} (${/ac/i.test(v) ? "L1 / N / ⏚" : "L+ / M / ⏚"}); salida de 24 Vdc para sensores (L+ / M, 400 mA)`,
      conector:"Bornes extraíbles incluidos", dim:[w,100,75], red:"PROFINET", e:"14 DI 24 Vdc, 10 DQ, 2 AI 0…10 V integradas",
      bornes:{ alim: /ac/i.test(v) ? [["L1","L1","fase"],["N","N","neutro"],["⏚","⏚","tierra"]] : [["L+","L+","+24 Vdc"],["M","M","0 V"],["⏚","⏚","tierra"]] }, verificado:true, notas:"Máximo 8 módulos de señales (SM) a la derecha.", fuente:SIE(m) }])),
  "6ES7 231-4HF32-0XB0": { marca:"Siemens", familia:"s71200", tipo:"AI", nombre:"SM 1231 AI 8x13 bit", canales:8, senal:"±10 V, ±5 V, ±2,5 V, 0…20 / 4…20 mA",
    alimentacion:"24 Vdc en X10: L+ / M (⏚ tierra funcional)", conector:"4 bornes extraíbles (X10…X14)", dim:[45,100,75], perdidas:1.5,
    bornes:{ alim:[["L+","L+","+24 Vdc"],["M","M","0 V"],["⏚","⏚","tierra funcional"]] },
    canal:(ch, cx)=>aiDif(`${ch}+`, `${ch}-`, `${ch}+`, `${ch}-`, "Pantalla a la barra de tierra", "", { notas: (cx==="2h" ? `Lazo alimentado desde el tablero: +24 Vdc → transmisor (+); transmisor (−) → ${ch}+; ${ch}− → M.` : `Transmisor de 4 hilos: salida (+) → ${ch}+; salida (−) → ${ch}−.`) + " Entradas sin uso: puentear n+ con n−." })(cx),
    verificado:true, notas:"Nombres de bornes impresos en el módulo (0+ / 0−…7+ / 7−).", fuente:SIE("6ES7231-4HF32-0XB0") },
  "6ES7 232-4HD32-0XB0": { marca:"Siemens", familia:"s71200", tipo:"AO", nombre:"SM 1232 AQ 4x14 bit", canales:4, senal:"±10 V, 0…20 / 4…20 mA",
    alimentacion:"24 Vdc en X10: L+ / M", conector:"Bornes extraíbles", dim:[45,100,75], perdidas:1.5, bornes:{ alim:[["L+","L+","+24 Vdc"],["M","M","0 V"],["⏚","⏚","tierra funcional"]] },
    canal:(ch)=>R({ pos:String(ch), neg:`${ch}M`, sh:"Pantalla a la barra de tierra", pin:{ pos:String(ch), neg:`${ch}M` }, notas:"Carga entre n y nM." }), verificado:false, notas:"Nombres «n» / «nM» por confirmar con el manual del sistema S7-1200.", fuente:SIE("6ES7232-4HD32-0XB0") },
  "6ES7 221-1BH32-0XB0": { marca:"Siemens", familia:"s71200", tipo:"DI", nombre:"SM 1221 DI 16x24VDC", canales:16, senal:"24 Vdc (sink/source), 2 grupos de 8",
    alimentacion:"Común 1M (bornes a) y 2M (bornes b)", conector:"Bornes extraíbles", dim:[45,100,75], perdidas:2.5, bornes:{ com:[["1M","1M","común byte a"],["2M","2M","común byte b"]] },
    canal:(ch)=>{ const g = Math.floor(ch/8); return R({ pos:`${"ab"[g]}.${ch%8}`, com:`${g+1}M`, pin:{ pos:`${"ab"[g]}.${ch%8}`, com:`${g+1}M` }, notas:"Lectura P: contacto entre +24 Vdc y la entrada; nM a 0 V." }); },
    verificado:true, fuente:SIE("6ES7221-1BH32-0XB0") },
  "6ES7 222-1HH32-0XB0": { marca:"Siemens", familia:"s71200", tipo:"DO", nombre:"SM 1222 DQ 16x relé", canales:16, senal:"Relé NA 5…30 Vdc / 5…250 Vac, 2 A, 4 grupos de 4",
    alimentacion:"24 Vdc para las bobinas: L+ / M", conector:"Bornes extraíbles", dim:[45,100,75], perdidas:8.5, bornes:{ alim:[["L+","L+","+24 Vdc bobinas"],["M","M","0 V"]] },
    canal:(ch)=>{ const g = Math.floor(ch/4); return R({ pos:`${"ab"[Math.floor(ch/8)]}.${ch%8}`, com:`${g+1}L`, pin:{ pos:`${"ab"[Math.floor(ch/8)]}.${ch%8}`, com:`${g+1}L` }, notas:"Común nL del grupo de 4 desde L." }); },
    verificado:false, notas:"Grupos de 4 con común 1L…4L: confirmar con el manual del sistema S7-1200.", fuente:SIE("6ES7222-1HH32-0XB0") },
  "6ES7 222-1HF32-0XB0": { marca:"Siemens", familia:"s71200", tipo:"DO", nombre:"SM 1222 DQ 8x relé", canales:8, senal:"Relé NA 5…30 Vdc / 5…250 Vac, 2 A, 2 grupos de 4",
    alimentacion:"24 Vdc para las bobinas: L+ / M", conector:"Bornes extraíbles", dim:[45,100,75], perdidas:4.5, bornes:{ alim:[["L+","L+","+24 Vdc bobinas"],["M","M","0 V"]] },
    canal:(ch)=>{ const g = Math.floor(ch/4); return R({ pos:`.${ch}`, com:`${g+1}L`, pin:{ pos:`.${ch}`, com:`${g+1}L` }, notas:"Común nL del grupo de 4 desde L." }); },
    verificado:false, notas:"Grupos 1L (.0….3) y 2L (.4….7): confirmar con el manual del sistema S7-1200.", fuente:SIE("6ES7222-1HF32-0XB0") },

  // ---------- Schneider Electric Modicon M580 / M340 con E/S X80 (bornera de 20 polos BMX FTB 20•0) ----------
  "BMXCPS3500": { marca:"Schneider Electric", familia:"m580", tipo:"PS", nombre:"Fuente BMX CPS 3500 (100…240 Vac, 36 W)", canales:0, alimentacion:"100…240 Vac (L, N, ⏚); relé de alarma",
    conector:"Bornera de la fuente", dim:[64,100,93], perdidas:7, bornes:{ alim:[["L","L","fase"],["N","N","neutro"],["⏚","⏚","tierra"]] }, verificado:false, notas:"Va en el slot de fuente (izquierda del bastidor).", fuente:SE("BMXCPS3500") },
  "BMXCPS2000": { marca:"Schneider Electric", familia:"m340", tipo:"PS", nombre:"Fuente BMX CPS 2000 (100…240 Vac, 20 W)", canales:0, alimentacion:"100…240 Vac (L, N, ⏚)",
    conector:"Bornera de la fuente", dim:[64,100,93], perdidas:5, bornes:{ alim:[["L","L","fase"],["N","N","neutro"],["⏚","⏚","tierra"]] }, verificado:false, fuente:SE("BMXCPS2000") },
  "BMEP582020": { marca:"Schneider Electric", familia:"m580", tipo:"CPU", nombre:"CPU M580 BME P58 2020", canales:0, alimentacion:"Desde el bastidor (fuente BMX CPS)", conector:"—",
    dim:[64,100,93], red:"Ethernet (DIO)", verificado:false, notas:"CPU de doble ancho en los slots 0 y 1 del bastidor BME XBP.", fuente:SE("BMEP582020") },
  "BMXP342020": { marca:"Schneider Electric", familia:"m340", tipo:"CPU", nombre:"CPU M340 BMX P34 2020", canales:0, alimentacion:"Desde el bastidor (fuente BMX CPS)", conector:"—",
    dim:[32,100,93], red:"Ethernet Modbus TCP", verificado:false, notas:"CPU en el slot 0 del bastidor BMX XBP.", fuente:SE("BMXP342020") },
  "BMEXBP0800": { marca:"Schneider Electric", familia:"m580", tipo:"RACK", nombre:"Bastidor Ethernet BME XBP 0800 (8 slots)", canales:0, dim:[307,104,20], verificado:false, fuente:SE("BMEXBP0800") },
  "BMXXBP0800": { marca:"Schneider Electric", familia:"m340", tipo:"RACK", nombre:"Bastidor BMX XBP 0800 (8 slots)", canales:0, dim:[307,104,20], verificado:false, fuente:SE("BMXXBP0800") },
  "BMXAMI0810": { marca:"Schneider Electric", familia:"x80", tipo:"AI", nombre:"BMX AMI 0810 (8 entradas, no aisladas)", canales:8, senal:"±10 V, 0…10 V, 0…20 / 4…20 mA (shunt interno 250 Ω)",
    alimentacion:"Desde el bastidor", conector:"Bornera de 20 polos BMX FTB 2010 (jaula) / 2000 (tornillo) / 2020 (resorte)", dim:[32,100,93], perdidas:2.3, pantalla:"Barra de pantallas BMX XSP 0400/0600/0800/1200",
    canal:(ch, cx)=>aiDif(`IN${ch}+`, `COM${ch}`, String(2*ch+1), String(2*ch+2), "Barra BMX XSP", "")(cx), verificado:false, notas:"Modo corriente por configuración (sin puentes). "+NOTA_PIN, fuente:FUENTES_PLC.x80ana },
  "BMXAMO0410": { marca:"Schneider Electric", familia:"x80", tipo:"AO", nombre:"BMX AMO 0410 (4 salidas aisladas)", canales:4, senal:"±10 V, 0…20 / 4…20 mA",
    alimentacion:"Desde el bastidor", conector:"Bornera de 20 polos BMX FTB 20•0", dim:[32,100,93], perdidas:2.4, pantalla:"Barra de pantallas BMX XSP",
    canal:(ch)=>R({ pos:`I${ch}+`, neg:`COM${ch}`, sh:"Barra BMX XSP", pin:{ pos:String(4*ch+2), neg:String(4*ch+4) }, notas:"Salida de corriente: carga entre In+ y COMn." }), verificado:false, notas:NOTA_PIN, fuente:FUENTES_PLC.x80ana },
  "BMXDAI1604": { marca:"Schneider Electric", familia:"x80", tipo:"DI", nombre:"BMX DAI 1604 (16 entradas 100…120 Vac, 4 grupos de 4)", canales:16, senal:"100…120 Vac",
    alimentacion:"Neutro común por grupo (C0…C3)", conector:"Bornera de 20 polos BMX FTB 20•0", dim:[32,100,93], perdidas:3.5, bornes:{ com:[["5","C0","común I0…I3"],["10","C1","común I4…I7"],["15","C2","común I8…I11"],["20","C3","común I12…I15"]] },
    canal:(ch)=>{ const g = Math.floor(ch/4); return R({ pos:`I${ch}`, com:`C${g}`, pin:{ pos:String(5*g + ch%4 + 1), com:String(5*g+5) }, notas:"Contacto entre L y la entrada; neutro del grupo a Cn." }); },
    verificado:false, notas:NOTA_PIN, fuente:FUENTES_PLC.x80dis },
  "BMXDDI1602": { marca:"Schneider Electric", familia:"x80", tipo:"DI", nombre:"BMX DDI 1602 (16 entradas 24 Vdc, lógica positiva)", canales:16, senal:"24 Vdc sink",
    alimentacion:"Alimentación de sensores: +24 Vdc (19) / 0 V (20)", conector:"Bornera de 20 polos BMX FTB 20•0", dim:[32,100,93], perdidas:2.5, bornes:{ alim:[["19","+24V","alimentación sensores"],["20","0V","común"]] },
    canal:(ch)=>R({ pos:`I${ch}`, com:"0V", pin:{ pos:String(ch+1), com:"20" }, notas:"Contacto entre +24 Vdc y la entrada." }), verificado:false, notas:NOTA_PIN, fuente:FUENTES_PLC.x80dis },
  "BMXDRA1605": { marca:"Schneider Electric", familia:"x80", tipo:"DO", nombre:"BMX DRA 1605 (16 salidas a relé, 2 grupos de 8)", canales:16, senal:"Relé NA 24 Vdc / 24…240 Vac, 2 A",
    alimentacion:"Bobinas desde el bastidor", conector:"Bornera de 20 polos BMX FTB 20•0", dim:[32,100,93], perdidas:3, bornes:{ com:[["9","C0","común Q0…Q7"],["18","C1","común Q8…Q15"]] },
    canal:(ch)=>{ const g = Math.floor(ch/8); return R({ pos:`Q${ch}`, com:`C${g}`, pin:{ pos:String(ch + g + 1), com:g ? "18" : "9" }, notas:"Común del grupo desde L." }); },
    verificado:false, notas:NOTA_PIN, fuente:FUENTES_PLC.x80dis },
  "BMXDDO1602": { marca:"Schneider Electric", familia:"x80", tipo:"DO", nombre:"BMX DDO 1602 (16 salidas 24 Vdc 0,5 A, lógica positiva)", canales:16, senal:"24 Vdc / 0,5 A",
    alimentacion:"Alimentación de preactuadores: +24 Vdc (19) / 0 V (20)", conector:"Bornera de 20 polos BMX FTB 20•0", dim:[32,100,93], perdidas:2.3, bornes:{ alim:[["19","+24V","alimentación salidas"],["20","0V","común"]] },
    canal:(ch)=>R({ pos:`Q${ch}`, com:"0V", pin:{ pos:String(ch+1), com:"20" }, notas:"Carga entre la salida y 0 V." }), verificado:false, notas:NOTA_PIN, fuente:FUENTES_PLC.x80dis },
};

/* ======================= familias de controlador ======================= */
/* mod: modelo por tipo y canales (DI además por tensión); slotCpu / primerSlot: numeración del bastidor en el software del fabricante */
export const FAMILIAS = {
  ab5380: { id:"ab5380", nombre:"Allen-Bradley CompactLogix 5380", marca:"Allen-Bradley", plc:"Controlador CompactLogix 5380", cpu:"5069-L320ER", fpd:"5069-FPD", tapa:"5069-ECR", ps:"", rack:"",
    slotCpu:0, primerSlot:1, canales:{ AI:8, AO:8, DI:16, DO:16 }, red:"Ethernet/IP", software:"Studio 5000 Logix Designer",
    mod:{ AI:{ 8:"5069-IF8", 16:"5069-IF16" }, AO:{ 4:"5069-OF4", 8:"5069-OF8" }, DI:{ "120 Vac":{ 16:"5069-IA16" }, "24 Vdc":{ 16:"5069-IB16" } }, DO:{ 4:"5069-OX4I", 16:"5069-OW16" } },
    hmi:"PanelView Plus 7 2711P-T7C22D9P", switch:"Stratix 1783-CMS10DP",
    reglas:"CPU en el slot 0 (MOD y SA de 24 Vdc); módulos a la derecha por slot; 5069-FPD antes de los módulos de 120 Vac para abrir un bus SA de 120 Vac (no ocupa slot); tapa 5069-ECR al final." },
  ab5370: { id:"ab5370", nombre:"Allen-Bradley CompactLogix 5370", marca:"Allen-Bradley", plc:"Controlador CompactLogix 5370", cpu:"1769-L33ER", fpd:"", tapa:"1769-ECR", ps:"", rack:"",
    slotCpu:0, primerSlot:1, canales:{ AI:8, AO:8, DI:16, DO:16 }, red:"Ethernet/IP", software:"Studio 5000 Logix Designer",
    mod:{ AI:{ 8:"1769-IF8" }, AO:{ 8:"1769-OF8C" }, DI:{ "120 Vac":{ 16:"1769-IA16" }, "24 Vdc":{ 16:"1769-IQ16" } }, DO:{ 16:"1769-OW16" } },
    hmi:"PanelView Plus 7 2711P-T7C22D9P", switch:"Stratix 1783-CMS10DP",
    reglas:"CPU 1769-L33ER con fuente integrada de 24 Vdc en el slot 0; módulos 1769 a la derecha (máx. 16, distancia a la fuente ≤ 4 módulos); tapa 1769-ECR al final." },
  s71500: { id:"s71500", nombre:"Siemens SIMATIC S7-1500", marca:"Siemens", plc:"Controlador SIMATIC S7-1500", cpu:"6ES7 515-2AM02-0AB0", fpd:"", tapa:"", ps:"6ES7 505-0KA00-0AB0", rack:"",
    slotCpu:1, slotPs:0, primerSlot:2, canales:{ AI:8, AO:4, DI:16, DO:8 }, red:"PROFINET", software:"TIA Portal (STEP 7)",
    mod:{ AI:{ 8:"6ES7 531-7KF00-0AB0" }, AO:{ 4:"6ES7 532-5HD00-0AB0", 8:"6ES7 532-5HF00-0AB0" }, DI:{ "120 Vac":{ 16:"6ES7 521-1FH00-0AA0" }, "24 Vdc":{ 16:"6ES7 521-1BH00-0AB0" } }, DO:{ 8:"6ES7 522-5HF00-0AB0", 16:"6ES7 522-1BH01-0AB0" } },
    hmi:"SIMATIC HMI TP700 Comfort", switch:"SCALANCE XB208",
    reglas:"Perfil soporte S7-1500: PM 1507 en el slot 0, CPU en el slot 1 y módulos desde el slot 2 (máx. 32); cada módulo con su conector frontal de 40 polos; pantallas al estribo de pantalla." },
  s71200: { id:"s71200", nombre:"Siemens SIMATIC S7-1200", marca:"Siemens", plc:"Controlador SIMATIC S7-1200", cpu:"6ES7 214-1AG40-0XB0", fpd:"", tapa:"", ps:"", rack:"",
    slotCpu:1, primerSlot:2, canales:{ AI:8, AO:4, DI:16, DO:16 }, red:"PROFINET", software:"TIA Portal (STEP 7 Basic)",
    mod:{ AI:{ 8:"6ES7 231-4HF32-0XB0" }, AO:{ 4:"6ES7 232-4HD32-0XB0" }, DI:{ "24 Vdc":{ 16:"6ES7 221-1BH32-0XB0" } }, DO:{ 8:"6ES7 222-1HF32-0XB0", 16:"6ES7 222-1HH32-0XB0" } },
    hmi:"SIMATIC HMI KTP700 Basic", switch:"SCALANCE XB208", sinDI120:true,
    reglas:"CPU 1214C / 1215C (slot 1) con los módulos de señales SM a su derecha (slots 2…9, máx. 8); no hay módulos de entradas de 120 Vac: las entradas digitales van a 24 Vdc." },
  m580: { id:"m580", nombre:"Schneider Electric Modicon M580", marca:"Schneider Electric", plc:"Controlador Modicon M580", cpu:"BMEP582020", fpd:"", tapa:"", ps:"BMXCPS3500", rack:"BMEXBP0800",
    slotCpu:0, primerSlot:2, canales:{ AI:8, AO:4, DI:16, DO:16 }, red:"Ethernet/IP · Modbus TCP", software:"EcoStruxure Control Expert",
    mod:{ AI:{ 8:"BMXAMI0810" }, AO:{ 4:"BMXAMO0410" }, DI:{ "120 Vac":{ 16:"BMXDAI1604" }, "24 Vdc":{ 16:"BMXDDI1602" } }, DO:{ 16:"BMXDRA1605" } },
    hmi:"Harmony GTU HMIDT542", switch:"ConneXium TCSESM083F23F1",
    reglas:"Bastidor BME XBP: fuente BMX CPS en su slot propio, CPU de doble ancho en los slots 0-1 y módulos X80 desde el slot 2; barra de pantallas BMX XSP bajo los módulos analógicos." },
  m340: { id:"m340", nombre:"Schneider Electric Modicon M340", marca:"Schneider Electric", plc:"Controlador Modicon M340", cpu:"BMXP342020", fpd:"", tapa:"", ps:"BMXCPS2000", rack:"BMXXBP0800",
    slotCpu:0, primerSlot:1, canales:{ AI:8, AO:4, DI:16, DO:16 }, red:"Modbus TCP", software:"EcoStruxure Control Expert",
    mod:{ AI:{ 8:"BMXAMI0810" }, AO:{ 4:"BMXAMO0410" }, DI:{ "120 Vac":{ 16:"BMXDAI1604" }, "24 Vdc":{ 16:"BMXDDI1602" } }, DO:{ 16:"BMXDRA1605" } },
    hmi:"Harmony GTU HMIDT542", switch:"ConneXium TCSESM083F23F1",
    reglas:"Bastidor BMX XBP: fuente BMX CPS en su slot propio, CPU en el slot 0 y módulos X80 desde el slot 1." },
};
export const LISTA_FAMILIAS = ["ab5380", "ab5370", "s71500", "s71200", "m580", "m340"];

/* familia por texto libre (proyectos antiguos: marca / descripción / modelo del PLC) */
export function familiaPorTexto(txt){
  const s = String(txt||"");
  if(/m340|bmx\s*p34/i.test(s)) return "m340";
  if(/schneider|modicon|m580|bme\s*p58|telemecanique/i.test(s)) return "m580";
  if(/s7-?1200|1214c|1215c|1212c|6es7\s*21[2-7]/i.test(s)) return "s71200";
  if(/siemens|s7|simatic|6es7/i.test(s)) return "s71500";
  if(/5370|1769/i.test(s)) return "ab5370";
  return "ab5380";
}

export function infoModulo(modelo){ const k = String(modelo||"").trim(), m = MODULOS[k]; return m ? Object.assign({ modelo:k }, m) : null; }

/* bornes de un canal; sin datos del modelo se usan nombres genéricos (CH0+, CH0-) */
export function terminalesCanal(modelo, ch, conexion=""){
  const m = MODULOS[String(modelo||"").trim()];
  if(m && m.canal) return Object.assign({ pin:{}, puente:[], notas:"", verificado: m.verificado!==false }, m.canal(ch, conexion));
  return { pos:`CH${ch}+`, neg:`CH${ch}-`, sh:"SH", com:"COM", alim:"", pin:{}, puente:[], verificado:false, notas:"Bornes genéricos: verificar con la hoja de datos del módulo" };
}

/* modelos de la familia (las E/S X80 sirven a M580 y M340) */
export function modulosFamilia(familia, tipo){
  const f = familia==="m580" || familia==="m340" ? [familia, "x80"] : [familia];
  return Object.entries(MODULOS).filter(([, m])=>f.includes(m.familia) && (!tipo || m.tipo===tipo)).map(([k])=>k);
}

/* modelo del módulo de E/S de la familia para un tipo, canales por módulo y tensión discreta ("" si no hay) */
export function modeloFamilia(fam, tipo, canales, tension){
  const m = (fam && fam.mod && fam.mod[tipo]) || {};
  const tabla = tipo==="DI" ? (m[/24/.test(tension||"") ? "24 Vdc" : "120 Vac"] || m["24 Vdc"] || {}) : m;
  return tabla[canales] || "";
}
/* etiqueta de un borne para el plano: número y nombre (p. ej. «2 (I0+)»); * si la numeración no está verificada */
export function etiquetaBorne(t, k){ const n = (t.pin||{})[k] || "", nom = t[k] || ""; return (n && n!==nom ? `${n}${nom ? " ("+nom+")" : ""}` : nom) + (t.verificado===false && n ? "*" : ""); }

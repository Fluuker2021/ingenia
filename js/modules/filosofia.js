/* Ingenia — documentos de texto generados desde los datos del proyecto:
   - Filosofía de control (primer alcance: operación general del sistema)
   - Típico de montaje de instrumentos (recomendaciones de montaje en campo por tipo de instrumento)
   Son borradores técnicos de partida: setpoints, retardos y secuencias finales se validan con Procesos. */
import { datos, instrumentos, tableros, tablerosControl, tableroDeInstrumento, tipoInstrumento, esAnalogico, expandirTag, tf, tableroPorId, esControl, tc, sistemaNombre, sistemaTag } from "../datos.js";
import { valoresDiseno } from "./criterios.js";
import { procesarFilas } from "./tablas.js";

const FUNCION = [
  [/^PD(I)?T$/, "Supervisa la presión diferencial. Alarmas por alta (H) y muy alta (HH). En colectores de polvo habilita la limpieza por demanda: inicia la secuencia al superar el valor de inicio y la detiene al bajar del valor de fin (valores a definir)."],
  [/^PI?T$/, "Supervisa la presión. Alarma por baja presión (L); la presión mínima es permisivo de la operación / de la secuencia de limpieza."],
  [/^LSH$/, "Alarma de nivel alto. Si el nivel alto se mantiene por más del retardo definido, se detiene la alimentación al equipo y se notifica al operador."],
  [/^LSL$/, "Alarma de nivel bajo; protege a las bombas contra la operación en vacío (disparo con retardo)."],
  [/^LI?T$/, "Supervisión continua de nivel con alarmas por bajo (L) y alto (H); puede usarse para el control de alimentación."],
  [/^SS[LH]?$/, "Con orden de marcha activa, si no se detecta rotación después del retardo de arranque, se genera falla, se detiene el equipo y los equipos aguas arriba."],
  [/^XV|^SV/, "Accionadas en secuencia por el PLC / controlador de limpieza (tiempo de pulso e intervalo entre pulsos a definir con el fabricante)."],
  [/^VI?T$/, "Supervisión de vibración: alarma por alta (H) y disparo por muy alta (HH) con retardo."],
  [/^TI?T$|^TE$/, "Supervisión de temperatura: alarma por alta (H) y disparo por muy alta (HH)."],
  [/^TSH$/, "Disparo por temperatura alta (enclavamiento)."],
  [/^FI?T$/, "Supervisión de caudal con alarmas por bajo (L) y alto (H)."],
  [/^ZS/, "Desalineamiento: alarma inmediata y parada del equipo si persiste el retardo definido."],
  [/^HS/, "Parada de emergencia por cable: detiene de inmediato el equipo y los equipos aguas arriba; requiere rearme local."],
];
function funcion(tag){ const t = tipoInstrumento(tag); const f = FUNCION.find(([re])=>re.test(t)); return f ? f[1] : "Supervisión en HMI."; }

// orden de arranque: equipos de descarga primero, luego el ventilador / equipo principal
const PRIORIDAD = { "valvula-rotativa":1, "faja-transportadora":1, "bomba-centrifuga":2, "agitador":2, "ventilador-centrifugo":3, "ventilador-axial":3, "compresor-piston":0, "chancadora":4, "molino":4, "otro":3 };

export function seccionesFilosofia(p){
  const d = datos(p), v = valoresDiseno(p), pr = d.proceso, fl = d.filosofia;
  const motores = d.cargas.filter(l=>l.kind==="motor");
  const inst = instrumentos(p);
  const ctl = tablerosControl(p);
  const io = d["ins-io"]||[];
  const cuenta = t => io.filter(x=>x.tipo===t).length;
  const sist = sistemaNombre(p) || "el sistema";
  const secs = [];
  secs.push({ titulo:"OBJETIVO Y ALCANCE", texto:`Describir la operación general de ${sist}${sistemaTag(p)?" ("+sistemaTag(p)+")":""}: modos de operación, secuencias de arranque y parada, lazos de supervisión, alarmas y enclavamientos. Es la base para la programación del controlador y las pruebas FAT / SAT. Los valores de ajuste (setpoints) y retardos indicados como «a definir» se completarán con Procesos y el fabricante de los equipos.`, items:[] });
  secs.push({ titulo:"DESCRIPCIÓN DEL PROCESO", texto: pr.descripcion || p.descripcion || "[Completar la descripción general del proceso en el entorno del Diagrama P&ID.]", items: (pr.equipos||[]).filter(e=>e.tag||e.descripcion).map(e=>`${e.tag?e.tag+" — ":""}${e.descripcion||e.tipo}`) });
  secs.push({ titulo:"SISTEMA DE CONTROL", texto:`El control se realiza desde ${ctl.length>1 ? "los tableros de control "+ctl.map(t=>t.tag).join(", ") : "el tablero de control "+(ctl[0]||tc(p)).tag}. Señales del listado I/O: ${cuenta("AI")} AI, ${cuenta("AO")} AO, ${cuenta("DI")} DI, ${cuenta("DO")} DO y ${cuenta("COM")} enlaces de comunicación.`, items: ctl.map(t=>`${t.tag}: ${t.plc||"PLC"}${t.modeloPlc?" ("+t.modeloPlc+")":""}${t.hmi?", pantalla HMI":""}${t.switch?", switch Ethernet":""}${t.redExterna?"; enlace con "+t.redExterna.toLowerCase():""}.`) });
  secs.push({ titulo:"MODOS DE OPERACIÓN", texto:"Cada equipo podrá operarse en los siguientes modos:", items:[
    "Local: mando desde la estación de botoneras junto al equipo (selector Local / Remoto en posición Local), solo para mantenimiento y pruebas; se mantienen activas las protecciones y paradas de emergencia.",
    "Remoto – Manual: arranque y parada individual de cada equipo desde la HMI, respetando permisivos y enclavamientos.",
    "Remoto – Automático: arranque y parada secuencial del sistema con un solo comando desde la HMI / sala de control.",
    "El cambio de modo no detiene los equipos en marcha; la selección se registra como evento." ] });
  const ordenados = motores.slice().sort((a,b)=>(PRIORIDAD[a.application]??3)-(PRIORIDAD[b.application]??3));
  secs.push({ titulo:"EQUIPOS CONTROLADOS", texto:"Equipos de fuerza mandados por el controlador:", items: motores.map(l=>{ const t = tableroPorId(p, l.tablero) || tf(p); return `${l.tag||"(sin TAG)"} — ${l.desc||"motor"} (${l.power} ${l.powerUnit==="hp"?"HP":"kW"}, ${l.starter==="vfd"?"variador de frecuencia: mando, referencia de velocidad y estado por Ethernet/IP":l.starter==="ss"?"arrancador suave":"arranque directo: comando de marcha, confirmación de marcha y falla"}). Alimentado desde ${t.tag}.`; }) });
  const perm = ["Tablero energizado y sin falla de alimentación de control.","Paradas de emergencia liberadas y rearmadas.","Sin falla activa de variador, arrancador o relé de sobrecarga."];
  if(inst.some(i=>/^PI?T$/.test(tipoInstrumento(i.tag)) && /aire/i.test(i.servicio||""))) perm.push("Presión de aire comprimido por encima del mínimo (transmisor de presión de la línea de aire).");
  secs.push({ titulo:"PERMISIVOS DE ARRANQUE", texto:"Para habilitar el arranque en modo remoto se deben cumplir:", items: perm });
  const secArr = (fl.secuencias||"").split(/\n/).map(s=>s.trim()).filter(Boolean);
  secs.push({ titulo:"SECUENCIA DE ARRANQUE", texto: secArr.length ? "Secuencia definida por el usuario:" : "Secuencia propuesta (a validar con Procesos): los equipos se arrancan en sentido contrario al flujo de material, de modo que cada equipo descargue sobre otro ya en marcha.", items: secArr.length ? secArr : ["Verificación de permisivos.", ...ordenados.map((l,i)=>`Arranque de ${l.tag||l.desc} — ${l.desc||""}; confirmación de marcha (y de rotación, si cuenta con interruptor de velocidad cero) antes del siguiente paso (retardo a definir).`), ...(inst.some(i=>/^XV|^SV/.test(tipoInstrumento(i.tag))) ? ["Habilitación de la secuencia de limpieza (por tiempo o por presión diferencial)."] : [])] });
  secs.push({ titulo:"SECUENCIA DE PARADA", texto:"Parada normal en el sentido del flujo de material:", items: [ ...(inst.some(i=>/^XV|^SV/.test(tipoInstrumento(i.tag))) ? ["Ciclo de limpieza posterior a la parada del ventilador (post-limpieza, duración a definir)."] : []), ...ordenados.slice().reverse().map(l=>`Parada de ${l.tag||l.desc} — ${l.desc||""}.`) ] });
  const alar = [];
  for(const i of inst) for(const tag of expandirTag(i.tag)) if(tag) alar.push(`${tag} — ${i.servicio||i.descripcion||""}: ${funcion(tag)}`);
  secs.push({ titulo:"LAZOS, ALARMAS Y ENCLAVAMIENTOS", texto: alar.length ? "Función de cada instrumento en el control:" : "[Sin instrumentos en el listado: complételo para detallar lazos y alarmas.]", items: alar });
  secs.push({ titulo:"PARADA DE EMERGENCIA Y FALLA DE ENERGÍA", texto:"", items:[
    "La parada de emergencia actúa por cableado (independiente del programa) sobre los contactores / habilitación de los variadores y se informa al controlador.",
    "Ante falla de energía, el sistema queda detenido; al restablecerse no arranca automáticamente: requiere reconocimiento y nuevo comando del operador.",
    `Condiciones del sitio consideradas: altitud ${v.altitud} m s.n.m., temperatura ${v.tempMin} a ${v.tempMax} °C.` ] });
  if(fl.notas) secs.push({ titulo:"NOTAS", texto: fl.notas, items:[] });
  return secs;
}

const MONTAJE = [
  [/^PD(I)?T$/, "Transmisor de presión diferencial", ["Manifold de 3 o 5 válvulas para bloqueo, igualación y purga.", "Líneas de impulso de igual longitud y con pendiente continua hacia las tomas (típicamente ≥ 1:12) para evitar bolsas de condensado.", "En colectores de polvo: tomas en cámara limpia y cámara sucia con conexión para purga / soplado; transmisor por encima de las tomas.", "Soporte en tubo de 2\" o pedestal, accesible para calibración."]],
  [/^PI?T$/, "Transmisor de presión", ["Válvula de bloqueo y purga o manifold de 2 válvulas.", "Aire y gases: toma en la parte superior de la tubería y transmisor por encima de la toma (drenaje natural del condensado hacia el proceso).", "Líquidos: toma lateral y transmisor por debajo de la toma (líneas siempre llenas).", "Soporte independiente de la tubería si hay vibración; entrada de cable con prensaestopas y bucle de goteo."]],
  [/^LSH$|^LSL$/, "Interruptor de nivel", ["Montaje lateral en la tolva / tanque a la altura del nivel a detectar.", "Tipo vibratorio en sólidos: horquilla ligeramente inclinada hacia abajo para que el material no se acumule; deflector de protección si cae material sobre el sensor.", "Prever acceso para retiro y prueba funcional."]],
  [/^LI?T$/, "Transmisor de nivel", ["Radar: montaje en el techo, alejado de paredes, de la caída de material y de estructuras internas (cono de emisión libre).", "Boquilla y antena según fabricante; considerar purga de aire si hay polvo adherente."]],
  [/^SS[LH]?$/, "Interruptor de velocidad cero", ["Sensor inductivo frente a una leva o disco dentado en el eje (preferentemente el eje de baja velocidad).", "Distancia de detección según fabricante; soporte rígido y libre de vibración; guarda de protección mecánica."]],
  [/^XV|^SV/, "Válvula solenoide", ["Montaje sobre el cabezal / manifold de aire del equipo, según fabricante.", "Cableado hacia caja de paso con borneras; grado de protección acorde al ambiente (polvo)."]],
  [/^VI?T$/, "Transmisor de vibración", ["Sensor en la carcasa del rodamiento, en dirección radial, fijado con espárrago sobre superficie plana mecanizada.", "Cable apantallado con la pantalla puesta a tierra en un solo extremo."]],
  [/^TI?T$|^TE$/, "Transmisor de temperatura", ["RTD Pt100 en termopozo o de contacto en el descanso, con transmisor en cabezal.", "Cable apantallado; longitud de inserción según el diámetro / alojamiento."]],
  [/^FI?T$/, "Transmisor de flujo", ["Respetar los tramos rectos aguas arriba y aguas abajo exigidos por el fabricante para la tecnología elegida.", "Tubería siempre llena en el punto de medición; puesta a tierra del medidor según fabricante."]],
  [/^ZS/, "Interruptor de desalineamiento", ["A ambos lados de la faja, en las zonas donde el desalineamiento es probable (cerca de poleas y cargas).", "Soporte en la estructura de la faja, con rodillo perpendicular al borde de la banda."]],
  [/^HS/, "Interruptor de parada por cable", ["Cable tensado a lo largo de la faja, accesible desde el pasillo; separación entre interruptores según fabricante y estándar del cliente."]],
];
export function seccionesTipicos(p){
  const v = valoresDiseno(p);
  const secs = [{ titulo:"GENERALIDADES", texto:`Recomendaciones de montaje en campo para los instrumentos del listado de instrumentos. Ambiente: ${String(v.ambiente||"").toLowerCase()}, ${String(v.contaminacion||"").toLowerCase()}; altitud ${v.altitud} m s.n.m. Prevalecen las instrucciones del fabricante del modelo seleccionado y el estándar del cliente.`, items:[
    "Ubicar los instrumentos accesibles desde piso o plataforma, con espacio para mantenimiento y calibración.",
    "Entradas de cable por la parte inferior, con prensaestopas acordes al grado de protección y bucle de goteo.",
    "Soportes independientes de la tubería cuando haya vibración; identificación con placa de TAG." ] }];
  for(const i of instrumentos(p)){
    if(!i.tag) continue;
    const t = tipoInstrumento(i.tag); const m = MONTAJE.find(([re])=>re.test(t));
    secs.push({ titulo:`${i.tag} — ${(i.descripcion||(m?m[1]:"Instrumento")).toUpperCase()}`, texto:`Servicio: ${i.servicio||"—"}. Ubicación: ${i.ubicacion||"—"}. Modelo: ${[i.marca,i.modelo].filter(Boolean).join(" ")||"por definir (verificar recomendaciones con el manual del fabricante)"}.`, items: m ? m[2] : ["Seguir el manual de instalación del fabricante."] });
  }
  return secs;
}

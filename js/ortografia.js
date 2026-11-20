/* Ingenia — CORRECCIÓN ORTOGRÁFICA de los textos que el usuario escribe (nombres de cargas, descripciones, servicios,
   nombres de tableros, notas…). Se aplica al MOSTRARLOS en la vista previa y al GENERAR los entregables (DXF, Excel,
   Word); lo que el usuario escribió en los campos no se modifica.
   Criterio: solo se corrigen palabras sin ambigüedad (tildes faltantes y errores frecuentes del vocabulario técnico de
   ingeniería eléctrica, de instrumentación y de procesos mineros / industriales). Palabras que pueden escribirse con o
   sin tilde según el sentido («esta / está», «mas / más», «solo», «el / él», «limite / límite»…) no se tocan.
   Se respeta el uso de mayúsculas: «VALVULA» → «VÁLVULA», «Valvula» → «Válvula», «valvula» → «válvula». */

// palabra mal escrita (en minúsculas, sin tildes) → forma correcta
const BASE = {
  // equipos y componentes
  valvula:"válvula", valvulas:"válvulas", electrovalvula:"electroválvula", electrovalvulas:"electroválvulas", valbula:"válvula", valbulas:"válvulas",
  centrifugo:"centrífugo", centrifuga:"centrífuga", centrifugos:"centrífugos", centrifugas:"centrífugas",
  piston:"pistón", pistones:"pistones", ciclon:"ciclón", hidrociclon:"hidrociclón", hidrociclones:"hidrociclones", camion:"camión", grua:"grúa", gruas:"grúas",
  rele:"relé", reles:"relés", boton:"botón", botones:"botones", deposito:"depósito", depositos:"depósitos", camara:"cámara", camaras:"cámaras", carbon:"carbón",
  polin:"polín", polines:"polines", portico:"pórtico", helice:"hélice", embolo:"émbolo", modulo:"módulo", modulos:"módulos", bateria:"batería", baterias:"baterías",
  tuberia:"tubería", tuberias:"tuberías", linea:"línea", lineas:"líneas", area:"área", areas:"áreas", almacen:"almacén", estacion:"estación", estaciones:"estaciones",
  subestacion:"subestación", subestaciones:"subestaciones", galeria:"galería", bahia:"bahía", energia:"energía", numero:"número", codigo:"código", codigos:"códigos",
  indice:"índice", maximo:"máximo", maxima:"máxima", minimo:"mínimo", minima:"mínima", tipico:"típico", tipica:"típica", tipicos:"típicos", tipicas:"típicas",
  // adjetivos técnicos
  electrico:"eléctrico", electrica:"eléctrica", electricos:"eléctricos", electricas:"eléctricas", electronico:"electrónico", electronica:"electrónica",
  electronicos:"electrónicos", electronicas:"electrónicas", mecanico:"mecánico", mecanica:"mecánica", mecanicos:"mecánicos", mecanicas:"mecánicas",
  hidraulico:"hidráulico", hidraulica:"hidráulica", hidraulicos:"hidráulicos", hidraulicas:"hidráulicas", neumatico:"neumático", neumatica:"neumática",
  neumaticos:"neumáticos", neumaticas:"neumáticas", termico:"térmico", termica:"térmica", termicos:"térmicos", termicas:"térmicas", magnetico:"magnético",
  magnetica:"magnética", termomagnetico:"termomagnético", termomagnetica:"termomagnética", termomagneticos:"termomagnéticos", automatico:"automático",
  automatica:"automática", automaticos:"automáticos", automaticas:"automáticas", analogico:"analógico", analogica:"analógica", analogicos:"analógicos",
  analogicas:"analógicas", logico:"lógico", logica:"lógica", tecnico:"técnico", tecnica:"técnica", tecnicos:"técnicos", tecnicas:"técnicas", basico:"básico",
  basica:"básica", critico:"crítico", critica:"crítica", trifasico:"trifásico", trifasica:"trifásica", monofasico:"monofásico", monofasica:"monofásica",
  cilindrico:"cilíndrico", electrolitico:"electrolítico", quimico:"químico", quimica:"química", acido:"ácido", fisico:"físico", estatico:"estático", dinamico:"dinámico",
  // sustantivos en -ción / -sión
  presion:"presión", tension:"tensión", proteccion:"protección", conexion:"conexión", conexiones:"conexiones", instalacion:"instalación", iluminacion:"iluminación",
  alimentacion:"alimentación", ventilacion:"ventilación", calefaccion:"calefacción", anticondensacion:"anticondensación", instrumentacion:"instrumentación",
  comunicacion:"comunicación", aplicacion:"aplicación", distribucion:"distribución", medicion:"medición", deteccion:"detección", posicion:"posición",
  operacion:"operación", funcion:"función", seccion:"sección", direccion:"dirección", transmision:"transmisión", extraccion:"extracción", succion:"succión",
  impulsion:"impulsión", compresion:"compresión", combustion:"combustión", filtracion:"filtración", separacion:"separación", clasificacion:"clasificación",
  flotacion:"flotación", trituracion:"trituración", dosificacion:"dosificación", refrigeracion:"refrigeración", lubricacion:"lubricación", recepcion:"recepción",
  interrupcion:"interrupción", conmutacion:"conmutación", regulacion:"regulación", vibracion:"vibración", rotacion:"rotación", inclinacion:"inclinación",
  agitacion:"agitación", inyeccion:"inyección", transformacion:"transformación", sincronizacion:"sincronización", generacion:"generación", compensacion:"compensación",
  correccion:"corrección", condensacion:"condensación", climatizacion:"climatización", interconexion:"interconexión", derivacion:"derivación", inspeccion:"inspección",
  descripcion:"descripción", ubicacion:"ubicación", dimension:"dimensión", elevacion:"elevación", aceleracion:"aceleración", detencion:"detención", mantencion:"mantención",
  automatizacion:"automatización", supervision:"supervisión", senalizacion:"señalización", adquisicion:"adquisición", configuracion:"configuración", calibracion:"calibración",
  verificacion:"verificación", seleccion:"selección", conduccion:"conducción", recirculacion:"recirculación", purificacion:"purificación", humidificacion:"humidificación",
  extincion:"extinción", fundicion:"fundición", lixiviacion:"lixiviación", decantacion:"decantación",
  // otros frecuentes
  senal:"señal", senales:"señales", tambien:"también", ademas:"además", segun:"según", traves:"través", despues:"después", aqui:"aquí", alli:"allí",
  traslacion:"traslación", rapido:"rápido", rapida:"rápida", unico:"único", unica:"única",
};

const ESPECIALES = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g;
const MAYUS = s => s === s.toUpperCase() && s !== s.toLowerCase();
const CAPITAL = s => s[0] === s[0].toUpperCase() && s.slice(1) === s.slice(1).toLowerCase();

function corregirPalabra(w){
  const k = w.toLowerCase();
  const c = BASE[k];
  if(!c || c === k) return w;
  if(MAYUS(w) && w.length > 1) return c.toUpperCase();
  if(CAPITAL(w)) return c[0].toUpperCase() + c.slice(1);
  return c;
}

/* corrige las palabras del diccionario en un texto; lo demás (TAG, códigos, números, espacios) queda igual */
export function corregir(texto){
  if(texto == null || typeof texto !== "string" || !texto) return texto;
  if(!/[A-Za-z]/.test(texto)) return texto;
  return texto.replace(ESPECIALES, corregirPalabra);
}

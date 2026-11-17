# Criterios de diseño aprendidos de los planos de referencia

Este documento reúne los criterios que el usuario aplica en sus planos de E&I, tal como aparecen en los planos de referencia que entregó (unifilares, multifilares de fuerza y de control y planos mecánicos de tableros). Sirve de guía para los generadores de Ingenia y se amplía con cada nueva tanda de planos.

No contiene datos de clientes: los planos se describen de forma genérica. Los originales (PDF / DWG) no se publican.

Cada criterio indica en qué planos aparece y si Ingenia ya lo aplica:
- ✅ aplicado;
- ◐ aplicado en parte;
- ☐ pendiente.

Cuando dos referencias se contradicen, el criterio queda como **opción configurable** y se anota la convención de cada plano.

## Referencias analizadas

| # | Tipo | Resumen (genérico) |
|---|---|---|
| U1 | Unifilar de fuerza (2 láminas A1) | Tablero de distribución 380 Vac 3F+N+T, 41 circuitos (3F y 1F+N), medición, SPD, reservas |
| U2 | Unifilar de tablero de distribución (A3) | 460 Vac 3F+T 65 kA, MCCB por salida, medición con TC, trafo 460/230 a subtablero, existentes en gris |
| U3 | Unifilar de fuerza tipo CCM (A3) | 460 Vac 3F+T, UVR por relé de fases, SPD T1+T2, arrancador suave con bypass, guardamotor, 2 trafos de control |
| M1 | Plano de tablero de fuerza (multifilar, 9 láminas A1) | Distribución 380 Vac 3F+N+PE, MCB + diferencial 30 mA por salida, medición |
| M2 | Multifilar de fuerza y control (11 láminas A3) | 460 Vac 3F+T, variador + 3 arranques directos, lógica cableada sin PLC, disparo shunt con relés de fuga |
| M3 | Multifilar de tablero de control con PLC compacto (16 láminas A3) | 120 / 220 Vac, Micro850 con E/S integradas, relés de 24 Vdc, contactos secos y húmedos |
| K1 | Mecánico de tablero de fuerza (3 láminas A1) | Distribución autosoportada 2000x800x600, barras verticales 3F+N, modulares en rieles verticales, medidor en puerta |
| K2 | Mecánico de tablero de control (4 láminas A1) | Mural 1000x700x250, arrancadores de 5 motores, matriz de mandos por motor |
| K3 | Mecánico de tablero de fuerza y control (3 láminas A1) | Autosoportado 1200x2000x600 con techo, variador + guardamotores, panel de control con tapa, mandil |
| K4 | Arreglo mecánico del CCM de U3 (A3) | 1000x1800x500 + zócalo y techo, portacandado |
| K5–K7 | Mecánicos de tableros de fuerza y control con arrancadores (4 láminas A1) | Murales 1000x1300 / 800x1000 y autosoportado 800x1600; placa única con columna de fuerza a la izquierda |
| P1 | P&ID (A1) | Colector de polvo húmedo: campanas, colector con boquillas, ventilador, silenciador, agua y lodos |

## 1. Unifilares

**Llegada y general**
- ✅ Recuadro de procedencia con embudo desde las esquinas, procedencia y tensión: «VIENE DE … / 2x220 Vac + T - 60 Hz» (U1, U2, U3). Implementado en `cajaAcometida`, en `js/cad/kit.js`.
- ✅ Título del tablero fuera del envolvente con tensión, sistema y frecuencia; recuadro PI/MD (U2, U3).
- ☐ Rótulo completo de cada interruptor, en 4-5 líneas: TAG / ajuste (Reg. 175-250 A) / Icu (kA) / modelo y disparador / tipo (MCB, MCCB). Aparece en U1, U2 y U3.
- ☐ Icu elegida por dispositivo y verificada contra el nivel de cortocircuito del tablero (U1, U2, U3).
- ◐ Luces piloto, derivadas antes del general (U1, U2, U3, M2, M3).
  - Convenciones: directas fase-N o fase-fase con MCB 4P de 2 A (U1, M1), o con un trafo de 100 VA más MCB (U2, U3).
  - Color ámbar en M2 y M3.
  - En Ingenia son opcionales y van con fusibles.
- ☐ Medición: 3 TC (primario igual o mayor que el In del general, /5 A), fusibles de tensión de 3x2 A y medidor multifunción (U1, U2, M1, K1).
- ◐ SPD:
  - Tipo 1+2 en la acometida principal y Tipo 2 en tableros aguas abajo (U1, M1, U3).
  - Protección por seccionador-fusible de 3x32 A o MCCB de 40 A.
  - Ingenia lo deja fijo en T1+2 con 125 A.
- ☐ Bobina de mínima tensión y relé de fases dibujados también en el unifilar (U3). Hoy solo están en el multifilar.

**Control interno del tablero de fuerza** (observación del usuario, corrección 04)
- ✅ No se dibuja como una sola línea: portafusibles (F9/F10…) → transformador de control (p. ej. T2 2 kVA 460/220 Vac+T, 25 % de reserva sobre la suma de los circuitos) → interruptor general de control (QG2, un escalón sobre el mayor circuito) → barra «R,S 220 VAC, 1F, 60Hz, 10 KA» (o «L,N 120 VAC…») → un circuito por destino (C1…Cn) con su ITM 2P (CB2…), su cable (2C#16AWG+16AWG(T) 0.6/1kV hasta 6 A dentro del tablero; 1-2C#12AWG… hacia otro tablero) y su descripción: hacia el tablero de control, ventiladores, calefacción, luminaria y tomacorriente con diferencial ID 30 mA.
- ✅ Dos tensiones de control (p. ej. 120 Vac para el control y 220 Vac para servicios): un transformador por tensión. La barra de servicios puede llegar de una segunda fuente externa (recuadro «VIENE DE …» directo al interruptor general).
- ✅ Mismos TAG en unifilar, multifilar y mecánico: fusibles numerados después de los de luces, relé de fases y bobina de mínima tensión (F1-F8); T1 y CB1 son los de la bobina, por eso el control interno empieza en T2 y CB2.
- ✅ Los circuitos salen de los accesorios del tablero (ventilación, calefacción, luminaria, tomacorriente) y de los tableros de control alimentados desde él.

**Simetría**
- ✅ Todas las verticales de carga (circuitos y derivaciones del control interno) a la misma distancia; la acometida llega al centro de la barra, entre dos verticales.

**Circuitos**
- ✅ Alimentadores y cargas generales de hasta 63 A con MCB curva C (S20p-Cxx, escalones de 2 a 63 A) en vez de caja moldeada (U1, M1). Por encima de 63 A, MCCB.
- ◐ Diferencial de 30 mA por circuito terminal (U1, M1, M2). Ingenia lo pone en el tomacorriente del control interno (opción «Diferencial» en la protección del tablero); falta la opción por carga.
- ☐ Sistema 3F+N+T con cargas 1F+N (U1, M1):
  - corriente con V/√3;
  - MCB de 2P o 4P;
  - barra de neutro.

  U2 y U3 son 3F+T. Debe ser un parámetro del proyecto.
- ☐ Reservas equipadas: interruptor (y diferencial), sin cable ni carga, rotuladas «RESERVA» (U1, U2, U3, M1).
- ☐ Columna propia de arrancador suave (U3): MCCB solo magnético, fusibles aR, contactor de línea, arrancador y contactor de bypass, sin relé térmico aparte.
- ☐ Alimentador con trafo intermedio hacia un subtablero de otra tensión (U2).
- ✅ Alimentador al tablero de control desde el tablero de fuerza, cuando el control declara su acometida auxiliar desde él (U1). Ingenia lo deriva del control interno (circuito CBn «HACIA EL TABLERO DE CONTROL …», barra estabilizada y de servicios) y el unifilar del tablero de control cita ese circuito.
- ☐ Equipos existentes en gris, con su tabla y su nota (U2).
- ☐ Formato de cable configurable. Conviven tres convenciones:
  - AWG con THW-90 (referencias anteriores; es el formato actual de Ingenia);
  - «3-1C#95mm²+50mm²(T)» con «XLPE/PVC, 1.0 kV» en una segunda línea y unipolares desde 35 mm² (U2);
  - IEC «1-[4x4mm²(3F+N)+1x4mm²(T)]» (U1).
- ☐ Esquema de TAG configurable:
  - prefijo «-» según IEC 81346 (-QG1, -Qnn, -KMn, -U1, -HLn) en U3 y M3;
  - correlativos de 2 dígitos (Q01 / QF01) y QC solo para interruptores auxiliares (U1, M1).
- ◐ Leyenda dinámica, solo con los símbolos usados (U1, U2). Ingenia ya arma la leyenda con lo dibujado en cada lámina (incluye guardamotor, contactor y arrancador suave); falta la explicación de los campos de cada rótulo.
- ☐ Notas automáticas: acometida a cargo del cliente, justificación en el listado de cargas, arranque desde el tablero de control, medidor con TC y nomenclatura de cables.
- ☐ Derrateo por altitud configurable (U3 usa 0,51 a 4500 m) y nota automática.

## 2. Multifilares

**Comunes**
- ✅ Revisión automática de continuidad al generar el plano (`js/cad/revision.js`):
  - conductores abiertos;
  - flechas sin referencia cruzada;
  - equipos del unifilar que faltan en el multifilar.
- ✅ Dibujo centrado en cada hoja sin invadir el cajetín; las referencias cruzadas se calculan con la posición final.
- ✅ Acometida del multifilar de fuerza según los accesorios del tablero (luces, relé de fases, SPD), igual que en el unifilar y el mecánico. Sin relé de fases, la cadena de la bobina de mínima tensión se cierra directo.
- ◐ Referencias cruzadas con el formato «hoja.columna:fila».
  - M2 y M3 nombran además la señal o el borne («R.2/5.1:A», «QG2.2», «K3.A1»).
  - Las barras se re-indexan después de cada aparato (R.1 → R.2) y la PE se renumera por hoja.
- ☐ Rótulo de conductor con sección y color, y aislamiento opcional:
  - R rojo, S negro, T azul, PE verde/amarillo;
  - +24 V rojo, 0 V negro, 4-20 mA gris;
  - control en Vac: azul en M2, aunque IEC 60445 reserva el azul al neutro.
- ☐ Borneras por destino: X1…Xn por grupo funcional; XC tablero de fuerza / panel remoto / campo; XF1 24 Vdc, XF2 DI, XF3 AI (M2, M3). Numeración en el orden de aparición.
- ☐ Dispositivos de campo con su símbolo real (seta, NA, NC, selector de 2/3 posiciones, contacto de relé) dentro de un recuadro discontinuo por ubicación (M2, M3).

**Fuerza y control (M2)**
- ☐ Hoja de control por motor (diagrama de escalera, barra arriba y retorno abajo):
  - selector L/R → relés KA de 4 contactos repartidos por motor;
  - sello por confirmación de marcha del variador;
  - permisivos de proceso en serie;
  - luces: roja detenido, verde marcha, ámbar falla.

  El mecánico de Ingenia ya pone esos mandos en la puerta; falta su circuito en el multifilar.
- ☐ Bornes de control del variador por marca (marcha, reset, habilitación por la seta, referencia de velocidad 4-20 mA o potenciómetro, relés de falla y marcha).
- ☐ Opción de disparo por bobina shunt con relés de fuga a tierra por alimentador.
  - La bobina de mínima tensión de Ingenia es la opción a prueba de fallas y sigue siendo la opción por defecto.
- ☐ Diferencial de 30 mA en todas las derivaciones de 120 Vac; servicios dibujados aguas abajo del secundario.

**Control con PLC (M3 y el multifilar de control de Ingenia)**
- ✅ Un par XF1 por equipo: + con fusible, 0 V sin fusible.
- ✅ Un solo fusible de 0,5 A por transmisor de 2 hilos.
- ✅ DI de 120 Vac con fusible en el retorno.
- ✅ Un relé de interfaz por salida, reservas incluidas.
- ✅ Ventilación con termostato y calefacción con termostato NC.
- ✅ Transmisor de 4 hilos con su conductor de 0 V hasta XF1.nB.
- ✅ Luz piloto de 24 Vdc dibujada bajo su par.
- ✅ Circuito «Alimentación a las salidas analógicas» solo cuando el módulo tiene bornes de 24 Vdc.
- ☐ Familia de PLC compacto Micro800 (2080-L50E-48AWB, plug-ins 2080-IF4/IF2/OF2, expansión 2085), con E/S integradas agrupadas por (slot, tipo).
- ☐ Paginación por bloque físico de bornes: DI una hoja por común; DO 8 bornes por hoja con sus comunes. El módulo se dibuja como tabla pin / nombre / función, con los bornes sin uso marcados N.C.
- ☐ Bobinas de los relés de interfaz en 24 Vdc (comunes CMn a +24 V) independientes de la tensión de las DI.
- ☐ Contactos de salida húmedos de 120 Vac, con ITM propio para los solenoides, además de los secos.
- ☐ Luces de presencia de tensión aguas arriba del general, en ámbar (M2, M3).
- ☐ SPD con su ITM ≤ el general (coordinación), en cada acometida.

## 3. Planos mecánicos

**Puerta**
- ✅ Ventiladores y filtros centrados en su hoja de puerta. Si algo ocupa el centro, solo cambia la altura.
- ✅ Señal «ATENCIÓN / RIESGO ELÉCTRICO» en placa rectangular, centrada y abajo en cada hoja (K1, K2, K5–K7): 200 × 300 mm en puertas de 600 mm o más, 150 × 210 en las menores; sube por encima del ventilador inferior. Va en 2D (frontal e isométrica), 3D y lista de materiales.
  - En los murales K5 y K6 va en el cuadrante libre, sin centrar. Queda como opción.
  - K3 usa en cambio una sola señal de 200 × 300 más una placa de tensión de 200 × 60 en la hoja sin panel, y una señal por mandil. Queda pendiente como opción.
- ✅ Placa de identificación de 140 × 90 (nombre, TAG y tensión) arriba y centrada, a unos 25 mm del borde superior: criterio de 5 de los 7 planos (K3, K5–K7).
  - K1 y K2 usan 140 × 40 a unos 10 mm del borde. Queda como opción.
  - ☐ Placa de logotipo de 180 × 70 (K3, K5–K7).
- ✅ Panel de operación del tablero de fuerza (K3):
  - luces de fase en su propia fila arriba;
  - una fila por equipo (el variador ocupa dos), con columnas y filas a 80 mm, centradas en el eje;
  - parada de emergencia fuera del panel, debajo y en su eje.

  K2 (un tablero de arrancadores sin variador) usa en cambio una columna por motor y una fila por función: horómetro, verde, roja, hongo. Queda pendiente como opción.
- ✅ Parte trasera de los dispositivos de puerta y contorno del calado visibles en 3D al abrir la puerta; calado en la lista de materiales.
- ☐ Mandos por equipo en 2 filas × 3 columnas (K5–K7): comandos (arrancar, detener, reset) y estados (funcionando, falla, listo); el arranque directo usa 2 × 2. Última fila: hongo y luz «PARADA DE EMERGENCIA ACTIVADA». Luces de fase amarillas. Contradice la fila única de 4 de K3: debe ser opción.
- ✅ Manija de la puerta a media altura en los murales (antes quedaba a 900 mm aunque la puerta fuera más baja).
- ☐ Portaplano de 235 × 250 en la cara interior de la puerta (K5–K7).
- ☐ Multimedidor de 96 × 96 en la puerta, centrado bajo las luces de fase (K1).
- ☐ Manija del interruptor general en el parante central de una sección de doble hoja (K3); verificar que quede a 1,7 m o menos del piso.
- ☐ Fijación según el montaje:
  - mural: 4 orejas de fijación (K2);
  - autosoportado: cáncamos o techo con orejas (K3).
- ☐ Cerraduras: manija con ojal para candado (autosoportado) y cubierta portacandado con cierres de 1/4 de vuelta (mural).

**Interior**
- ✅ Control a la izquierda y fuerza a la derecha.
- ✅ General arriba al centro con barras horizontales y derivaciones colgadas.
- ✅ Variador con su subcolumna; reactancia sobre una base al piso.
- ✅ Canaletas entre filas.
- ✅ Placa de montaje a unos 50 mm de los laterales.
- ☐ Placa única para 1 o 2 motores (K5–K7): columna de fuerza angosta a la izquierda y control a la derecha, separadas por una canaleta vertical; holguras acotadas: 60 mm entre equipos de fuerza y 100 mm arriba y abajo del arrancador suave. Hoy Ingenia separa siempre en dos secciones.
- ☐ Modo «tablero de distribución» (K1): barras verticales 3F+N centradas y modulares en rieles DIN verticales a ambos lados, con placa de cabecera para medición y general 4P.
- ☐ Contactor con relé térmico acoplado, en filas centradas (K2).
- ☐ Canaleta perimetral mayor (80 × 60) y canaletas entre filas de 40 × 60 (K2).
- ☐ Mandil (contrafrente) por bahía, con calados para los modulares y su señal (K3).
- ☐ Vista lateral en corte con las profundidades de equipos, placas escalonadas y la parte trasera de los dispositivos de puerta (K2, K3).
- ☐ Tabla «ESPECIFICACIONES TÉCNICAS»:
  - tipo de tablero, espesores, RAL configurable, IP;
  - tensiones, medidas, giro de la puerta;
  - rótulos y fabricación.
- ☐ Techo a un agua con voladizos y campanas antilluvia en las rejillas, para intemperie (K3).

## 4. P&ID

- ◐ Cadena ISA de cada instrumento (campo → funciones en el PLC → HMI) con las alarmas de la filosofía de control. La referencia usa en cambio una burbuja de campo junto al punto de medición más un bloque compacto de funciones: fila HMI con la indicación y todas las alarmas, y fila PLC solo con las alarmas que ejecutan lógica (P1). Queda como opción de estilo.
- ☐ Tipo de equipo «colector húmedo» (P1): cabezales de boquillas, chevron, demister, tolva con guillotina motorizada (ZSO/ZSC), rebose y lodos. Lleva PDIT, LIT radar, PIT de agua, PI por cabezal y una SV por cabezal con HS.
- ☐ Líneas por servicio con color y tipo de línea: aire con polvo azul, agua cian, lodos naranja, rebose naranja discontinuo, existentes en gris. Tipos de señal ISA: eléctrica discontinua, neumática «//», enlace de datos «-o-o-».
- ☐ Niveles de alarma por servicio: presión diferencial L y HH; presión de agua L y HH; nivel de tolva L y H.
- ☐ Válvulas manuales (bola, globo, filtro Y, compuerta, junta flexible, manifold), estaciones de solenoide con bloqueo y bypass N.C., números de línea con el formato «diámetro"-servicio-correlativo», PI con válvula de raíz de 1/2".
- ☐ Motor con su interlock y su botonera local; caja «AS» para el arrancador suave.
- ☐ Cabecera de datos de los equipos: tag, nombre, caudal, presión y potencia.
- ☐ Equipos existentes en gris, límite de suministro «contratista | cliente» y llamadas «NOTA n» sobre el dibujo.

## 5. Documentos Word

- ✅ El índice guarda como valor la página estimada de cada título: la paginación se calcula con el estilo, el interlineado, las tablas fila por fila, las imágenes y los saltos. Antes guardaba «1» en todas las entradas, y eso es lo que muestran los visores que no actualizan campos (o Word si no se acepta la actualización). Comparado con la paginación real de LibreOffice, coincide en 111 de 115 entradas en cinco memorias de prueba; el resto queda a ±1 página. Word la recalcula al abrir.
- ✅ El cuerpo empieza en página nueva con «salto de página anterior» en el primer título: antes, si el índice llenaba justo su hoja, quedaba una hoja en blanco.

## 6. Errores vistos en las referencias (no imitar)

- Guardamotores con un rango que no cubre la corriente del motor.
- Termostato de ventilación «NA» con un modelo NC.
- TAG repetidos.
- MCB de 3P en un secundario monofásico.
- Luces R-S-T alimentadas desde un trafo monofásico, que por eso no indican tensión por fase.
- Fuente con la polaridad invertida.
- Seta NA cableada solo a una entrada del PLC: no es a prueba de fallas.
- SPD con ITM mayor que el general: sin selectividad.
- Bobina shunt alimentada desde el mismo control.
- Icu de catálogo dada a 415 V usada en un sistema de 460 V.
- Uc de 440 V en un sistema de 460 V.
- Azul usado para L y N.
- Tomacorriente sin diferencial.
- Interruptor general operado con la puerta abierta, sin mando exterior (IEC 60204-1).
- Falla señalada en rojo (IEC 60204-1 reserva el rojo para emergencia; ámbar para condición anormal).
- Guillotina descrita motorizada en las notas pero dibujada como válvula manual.
- Cajetines y placas copiados de otro tablero.

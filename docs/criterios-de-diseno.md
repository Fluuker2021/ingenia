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

**Circuitos**
- ✅ Alimentadores y cargas generales de hasta 63 A con MCB curva C (S20p-Cxx, escalones de 2 a 63 A) en vez de caja moldeada (U1, M1). Por encima de 63 A, MCCB.
- ☐ Diferencial de 30 mA por circuito terminal (U1, M1, M2). Configurable por carga: en tomacorrientes siempre; en las demás según el criterio del proyecto.
- ☐ Sistema 3F+N+T con cargas 1F+N (U1, M1):
  - corriente con V/√3;
  - MCB de 2P o 4P;
  - barra de neutro.

  U2 y U3 son 3F+T. Debe ser un parámetro del proyecto.
- ☐ Reservas equipadas: interruptor (y diferencial), sin cable ni carga, rotuladas «RESERVA» (U1, U2, U3, M1).
- ☐ Columna propia de arrancador suave (U3): MCCB solo magnético, fusibles aR, contactor de línea, arrancador y contactor de bypass, sin relé térmico aparte.
- ☐ Alimentador con trafo intermedio hacia un subtablero de otra tensión (U2).
- ☐ Alimentador al tablero de control desde el tablero de fuerza, cuando el control declara su acometida auxiliar desde él (U1).
- ☐ Equipos existentes en gris, con su tabla y su nota (U2).
- ☐ Formato de cable configurable. Conviven tres convenciones:
  - AWG con THW-90 (referencias anteriores; es el formato actual de Ingenia);
  - «3-1C#95mm²+50mm²(T)» con «XLPE/PVC, 1.0 kV» en una segunda línea y unipolares desde 35 mm² (U2);
  - IEC «1-[4x4mm²(3F+N)+1x4mm²(T)]» (U1).
- ☐ Esquema de TAG configurable:
  - prefijo «-» según IEC 81346 (-QG1, -Qnn, -KMn, -U1, -HLn) en U3 y M3;
  - correlativos de 2 dígitos (Q01 / QF01) y QC solo para interruptores auxiliares (U1, M1).
- ☐ Leyenda dinámica, solo con los símbolos usados y la explicación de los campos de cada rótulo (U1, U2).
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
- ✅ Señal «ATENCIÓN / RIESGO ELÉCTRICO» en placa rectangular, centrada y abajo en cada hoja (K1, K2): 200 × 290 mm en puertas de 600 mm o más, 150 × 210 en las menores. Va en 2D (frontal e isométrica), 3D y lista de materiales.
  - K3 usa en cambio una sola señal de 200 × 300 más una placa de tensión de 200 × 60 en la hoja sin panel, y una señal por mandil. Queda pendiente como opción.
- ✅ Placa de identificación de 140 × 40 cerca del borde superior, fondo negro y letras blancas (K1, K2).
  - K3 usa 140 × 90 a unos 180 mm del borde y una placa de logotipo de 180 × 70. Queda pendiente como opción.
- ✅ Panel de operación del tablero de fuerza (K3):
  - luces de fase en su propia fila arriba;
  - una fila por equipo (el variador ocupa dos), con columnas y filas a 80 mm, centradas en el eje;
  - parada de emergencia fuera del panel, debajo y en su eje.

  K2 (un tablero de arrancadores sin variador) usa en cambio una columna por motor y una fila por función: horómetro, verde, roja, hongo. Queda pendiente como opción.
- ✅ Parte trasera de los dispositivos de puerta y contorno del calado visibles en 3D al abrir la puerta; calado en la lista de materiales.
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

## 4. Errores vistos en las referencias (no imitar)

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

# Criterios de diseño de tableros — medidos en los planos del usuario

Fuente: «Tableros 3D, 1.dxf», «Tableros 3D, 2.dxf» y «Componentes 3d.dxf» (estándar de planos de tableros, unidades mm, espacio modelo 1:1). Los planos ya estaban unificados a escala 1:1 (cada vista indica su escala original, de 1:5,5 a 1:11). Se verificó comparando las cotas con los rectángulos de los gabinetes: 2000, 1800, 1300, 1000, 800 y 600 mm dan la medida real (desvío máximo de 0,13 %).

## Placa de montaje (44 rieles DIN y 808 equipos medidos)
| Criterio | Valor medido | Cómo lo usa Ingenia |
|---|---|---|
| Separación entre el equipo y la canaleta (arriba y abajo) | mediana de 31 a 34 mm (p25: 26 a 30 mm) | 30 mm (`DUCT_GAP`) |
| Hueco libre entre canaletas de una fila (equipos de ~90 mm) | 150 mm | altura del equipo + 2 × 30 mm |
| Paso entre rieles (de eje a eje) | 215 mm (de 205 a 235 mm) | fila + canaleta de 60 mm ≈ 210 mm |
| Canaleta horizontal más usada | 60 mm (también de 40 mm) | 60 × 80 mm entre filas |
| Canaleta vertical | 60 y 40 mm | según la cantidad de conductores (60 a 80 mm) |
| Separación entre equipos DIN de una fila | 0 mm (van juntos) | juntos dentro de cada grupo funcional |
| Llenado del riel | 78 % (p25: 57 %, p75: 95 %) | 20 % de reserva por fila |
| Riel | TS35 | TS35 × 7,5 |

Orden vertical: protecciones arriba (altura relativa de 0,66), PLC al centro (0,64), relés y maniobra abajo (0,25), reactancias sobre la base (0,06) y variador a media altura, a la derecha (centro a 0,38). Las borneras se reparten junto a su función.

**Tablero de fuerza y control en un solo cuerpo** (9101-TFC-001, 1200 × 2000 mm): control y fuerza van en la misma placa. La zona de control (7 filas DIN con canaletas de 60 mm) queda a un lado. La zona de fuerza queda al otro: XT4 arriba y barras debajo, seccionadores XLP colgados de las barras, el variador PowerFlex 753 de bastidor F6 (308 mm de ancho) con su XLP1 al lado y la reactancia sobre la base. Ingenia lo prueba como alternativa («cuerpo mixto») antes de pasar a dos cuerpos y la elige cuando el contenido entra.

## Puerta
| Criterio | Valor medido | Ingenia |
|---|---|---|
| Paso vertical entre dispositivos de 22 mm | 80 mm | 80 mm |
| Paso horizontal | de 40 a 60 mm (60 mm en el tablero de 800 × 2000 mm) | 60 mm (placa de leyenda de 50 mm) |
| Dispositivo más alto (desde la base del cuerpo) | de 1360 a 1425 mm | la primera fila a ≈ 1405 mm |
| Ventilador de entrada / salida | centros a 0,15 H y 0,85 H (305 y 1695 mm en 2000 mm) | la entrada desde 300 mm y la salida desde H − 300 mm |
| Ventilación en una puerta de dos hojas | en diagonal: entrada abajo en una hoja y salida arriba en la otra (tablero de 1000 × 1800 mm) | ventilación cruzada si un ventilador alcanza |
| Marco del ventilador | 255 mm (1000 × 1800) y 324/330 mm (800 × 2000) | marco mínimo de 255 mm en autosoportados |

## Biblioteca de componentes
«Componentes 3d.dxf» tiene 295 componentes. Cada uno es un bloque con 3 vistas (`_F` frontal, `_L` lateral, `_ISO` isométrica) y estos atributos: AMC_ID, FAMILIA, MARCA, MODELO, DESCRIPCION, ANCHO_MM, ALTO_MM, PROF_MM, MONTAJE, VISTA, FUENTE y CONFIANZA_DIM. Se exportó a `assets/componentes/biblioteca_base.json` con las geometrías simplificadas a 0,15 mm. 30 vistas tenían arcos o círculos de construcción sueltos, o estaban dibujadas a otra escala (p. ej. XLP1 a 1,88:1); se limpiaron y se llevaron a 1:1 según sus medidas nominales. Quedan 6 vistas con más de una unidad en el bloque, como las 3 AUDAX de 50 a 100 VA, que se ajustan a la caja del equipo al dibujarlas.

El equipo del proyecto toma la plantilla de la biblioteca por su código: «S202-C16» → S202, «Tmax XT4 250A 3P» → XT4, «AF09 + HKF1-11» → AF09-30-10, «XLP000-6CC + fusibles» → XLP000. Los polos deben coincidir (un OVR 3L no toma la plantilla de un polo) y los transformadores se buscan por su potencia. El arreglo usa las medidas de la plantilla y el plano 2D dibuja su vista frontal.

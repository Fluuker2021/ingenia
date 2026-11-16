# Ingenia

Plataforma web para elaborar ingenierías de **Electricidad e Instrumentación & Control** a partir de pocos datos: cada entregable tiene su propio entorno (datos de entrada → vista previa → cajetín y descarga) y se descarga en Excel, Word o DXF.

- Sitio estático (GitHub Pages): `index.html` (presentación) · `app.html` (plataforma).
- Datos en el navegador (localStorage + IndexedDB para logos y plantillas). Sin servidor.

## Flujo de un proyecto
1. **Nuevo proyecto** (asistente de 4 pasos):
   - *Proyecto*: nombre, cliente final, unidad minera / planta, sistema a implementar, etapa, disciplinas, logo del cliente y P&ID de referencia (PDF, opcional).
   - *Sitio y sistema eléctrico*: tensión de fuerza (Vac) y de control (número + Vac / Vdc) se escriben y solo aceptan números; frecuencia 50 / 60 Hz; tensión de instrumentación (Vdc); cortocircuito y condiciones del sitio. La temperatura máxima es la temperatura de diseño.
   - *Tableros*: tipo, cantidad, TAG y alimentación.
   - *Documentos*: se marcan los documentos que se elaborarán.
2. Menú del proyecto: **Resumen · Datos generales · Documentos · Formatos del cliente**. Datos generales guarda los tableros en detalle y los criterios de diseño; lo ingresado al crear el proyecto se cambia con *Editar*.
3. Cada documento se trabaja en su propio entorno: **1. Datos de entrada → 2. Vista previa → 3. Cajetín y descarga** (la descarga se habilita recién en el cajetín). El plano mecánico del tablero tiene además **vista previa 3D**: 1. Datos → 2. Vista previa 2D → 3. Vista previa 3D → 4. Cajetín y descarga (el CAD que se descarga es el 2D). Todo se descarga en el formato estándar de Ingenia, con la paleta de INGENIA. Los documentos **no llevan codificación**: se identifican por su nombre y se descargan como «Proyecto - Documento - Rev X».
- **Plan Pro**: los documentos y planos son del plan Profesional (`js/plan.js`). Sin él se muestra la etiqueta «Pro» y, al abrir un documento, la pantalla de actualización; con él, el tipo de archivo (EXCEL, WORD, AUTOCAD). Mientras el pago en línea no esté habilitado, el plan se activa en *Configuración → Mi plan* y queda en el navegador.
- Excel: cada fórmula se guarda con su resultado (visible aun en visores que no recalculan); rellenos y encabezados con la paleta de INGENIA y valores numéricos centrados.
- Las unidades de tensión se escriben siempre como **Vac / Vdc**; los datos guardados con «VAC / VDC» se convierten al abrir la plataforma.
- La vista previa de los documentos usa los colores de INGENIA (grafito y amarillo).

## Identidad visual
- Paleta: grafito `#17191D`, gris acero `#303640`, amarillo eléctrico `#F5C518` (acento), gris claro `#DCE1E6`, blanco.
- Tipografía (alojada en `assets/fonts`, licencia OFL): Montserrat Bold/SemiBold (títulos), Inter Regular/Medium (texto, botones y menús), Roboto Medium (datos técnicos: códigos, TAG, valores).
- Marca: solo el nombre, INGENIA, con «IA» resaltado en amarillo (ingeniería asistida por inteligencia artificial). `assets/favicon.svg` para la pestaña del navegador.
- Menú lateral en árbol: Proyectos (cada proyecto con sus secciones), Catálogo, Formatos estándar y Configuración; cada grupo se abre o se cierra al tocarlo.
- Versión publicada: `js/version.js` (fecha y hora de carga, hora de Perú), visible al pie del menú lateral y en la barra superior del celular.
- Actualización automática (`js/actualizar.js`): al abrir la página o volver a ella se compara con la versión publicada; si hay una más nueva se renueva la caché y se recarga sola.
- Celular y tableta: barra superior con menú ☰ (cajón lateral), modales como hoja inferior, documentos como tarjetas y campos de 16 px (sin zoom automático en iPhone). Probado en 360, 375, 390, 412 y 768 px.

## Copito (asistente)
`js/copito.js`, imagen `assets/copito.png` (negro, paleta INGENIA). Botón flotante en la plataforma; responde sobre los proyectos guardados en el navegador.
**Todo corre en el navegador de cada usuario**: entender la orden, aplicarla, recalcular y regenerar el 2D / 3D no pasa por ningún servidor ni por una IA, así que cada usuario trabaja de forma independiente (100 usuarios = 100 navegadores, cada uno con sus proyectos). Mientras se aplica un cambio aparece un indicador de carga sobre la pantalla que se actualiza.
- **Motor propio** (sin internet): máxima demanda, cargas, cables y caída de tensión, tableros, instrumentos, señales I/O, documentos y revisiones, condiciones del sitio, detalle por TAG y búsqueda libre.
- **Arreglo mecánico** (motor propio): reubicar equipos (`mecanico.mover`: a la izquierda / derecha, subir o bajar su fila, al inicio / final, antes o después de otro, intercambiar), lado del interruptor general, de la placa de control y del variador en su columna, panel de operación (puerta y altura), canaletas, marca del variador (ABB / Allen-Bradley) y volver al arreglo automático. Entiende frases con pronombres («muévelo», «colócalo», «súbelo») y las que arma el botón «Pedir un cambio a Copito» del 3D («En TF-001, para VDFC1, …»); responde preguntas sobre un equipo (modelo, medidas, ubicación y vecinos). Si algo no se puede (p. ej. ya está en el extremo) lo explica y no lo guarda.
- **Cambios desde el chat** (`js/copito-editar.js`): agregar, modificar o eliminar cargas e instrumentos, datos de diseño, del proyecto, del sistema y de tableros, y emitir revisiones. Copito muestra la propuesta, se aplica solo al confirmar, regenera el listado I/O cuando corresponde, informa el impacto (máxima demanda, corriente, ITM general, señales, cables fuera de la caída de tensión) y permite deshacer.
- **Modo IA opcional** (desactivado por defecto; Copito no lo necesita para hacer cambios): se activa en los ajustes de Copito con una clave de API propia guardada solo en ese navegador; envía la pregunta y los datos de los proyectos a Anthropic. SDK oficial empaquetado en `vendor/anthropic-sdk-1.3.0.mjs` (se carga solo en modo IA). Para producción, la clave debe ir en un servidor intermedio, no en el navegador.

## Página de inicio
Carrusel con vistas reales de un proyecto demostrativo (`assets/vistas/*.jpg`, datos ficticios), planes de membresía y pie con copyright.

## Formatos estándar
Formatos propios de Ingenia (carátula, tabla de revisiones, estilos y fórmulas), sin datos de ningún cliente:

| Entregable | Archivo |
|---|---|
| Listado de cargas (una hoja por tablero) | `assets/plantillas/xlsx/lista_cargas.xlsx` |
| Listado de cables | `assets/plantillas/xlsx/lista_cables.xlsx` |
| Listado de equipos eléctricos | `assets/plantillas/xlsx/equipos_electricos.xlsx` |
| Hoja de datos de equipos eléctricos / de instrumentos | `assets/plantillas/xlsx/hoja_datos_instrumentos.xlsx` + `hd_tipos.json` |
| Listado de instrumentos | `assets/plantillas/xlsx/lista_instrumentos.xlsx` |
| Listado I/O | `assets/plantillas/xlsx/lista_io.xlsx` |
| Memoria de cálculo de conductores | `assets/plantillas/docx/memoria_conductores.docx` |
| Memoria de cálculo de máxima demanda | `assets/plantillas/docx/memoria_md.docx` |
| Filosofía de control / típicos de montaje | `assets/plantillas/docx/documento_texto.docx` |
| Planos (lámina A1 + cajetín con logos) | `js/cad/formato.js` |

### Planos a partir de los planos de referencia del usuario
El **diagrama unifilar** y el **diagrama multifilar** del tablero de fuerza se arman con piezas tomadas de los planos de referencia del usuario (DWG convertido a DXF con LibreDWG): `tools/planos/extraer_kit.py` + `tools/planos/piezas.py` → `assets/plantillas/planos/unifilar.json` y `multifilar.json` (geometría, capas, colores, tipos de línea y textos; los textos variables son marcadores `{clave}`). Los generadores (`js/cad/plano-unifilar.js`, `js/cad/plano-multifilar.js`, con `js/cad/kit.js`) colocan una columna por circuito (variador, guardamotor + contactor, arrancador suave, alimentador, transformador de control con sus derivaciones), reparten las columnas en el ancho de la lámina y, si no entran, reducen la escala o continúan en otra lámina. Los DWG/DXF originales no se publican (contienen datos del cliente); solo el kit extraído.

### Plano mecánico del tablero de fuerza (arreglo, 2D y 3D)
- **Base de datos de componentes** (`js/mecanico/componentes.js`): dimensiones reales (ancho × alto × fondo), montaje (riel DIN, placa, base, puerta) y pérdidas de cada familia: Tmax XT / Emax, guardamotores MS116…MS495, contactores AF, relés TA/EF, S200/FH200, portafusibles E 90, XLP, ACS880-01 (bastidores R1…R9 con sus espacios libres), PowerFlex 755, PSR/PSTX, reactancias, transformadores y fuentes, bornes Phoenix UT/UKH/PTTB, canaletas, riel, barras (DIN 43671), dispositivos de puerta, ventiladores, prensaestopas y gabinetes normalizados. Valores referenciales de catálogo (cada uno con su fuente); la estructura permite reemplazarlos por datos de servidores de fabricantes (ETIM / BMEcat) sin tocar el motor.
- **Motor de arreglo** (`js/mecanico/arreglo.js`): con los mismos equipos y TAG del multifilar dispone todo con criterio de diseñador: placa de control (filas DIN: protecciones auxiliares de la acometida, guardamotores alineados sobre sus contactores con barra peine, distribución de control, borneras agrupadas TB1 / TBn / X1, barra de tierra) y placa de fuerza (barras L1-L2-L3 con aisladores, interruptor general alimentado por abajo con franja libre para la acometida, derivaciones colgadas de las barras, variador con sus espacios libres y subcolumna con interruptor, seccionador portafusible y reactancias sobre la base, borneras de salida bajo cada columna). Elige el gabinete normalizado (secciones, alto y fondo) por las dimensiones reales, aplica la reserva de espacio, dimensiona canaletas y prensaestopas y hace el balance térmico IEC 60890 (ventilación natural, forzada con caudal corregido por altitud o aire acondicionado). Lo que el usuario fija vive en `datos(p).mecanico[tablero.id]`.
- **Plano 2D** (`js/cad/plano-mecanico.js`, 4 láminas A1 por tablero, a imagen del plano mecánico de referencia del usuario): vistas exteriores (frontal, lateral, isométrica, cotas, llamadas y notas), disposición de equipos en las placas (contornos detallados, canaletas, rieles, barras, recorridos de fuerza) con detalle de borneras, panel de operación y base con prensaestopas, y lista de materiales con dimensiones, criterios aplicados y balance térmico.
- **Vista 3D** (`js/mecanico/visor3d.js`, three.js en `vendor/three`, se carga solo en esa pestaña): vistas isométrica / frente / lateral / planta / posterior, abrir y cerrar puertas, explosionar, capas (gabinete, puertas, canaletas, cableado, TAG, dispositivos de puerta), selección de equipos con sus datos, pantalla completa e imagen PNG.
- **Copito** es el intermediario de los cambios: desde la vista 3D (o el chat) propone el cambio del arreglo (`mecanico.editar`: medidas del gabinete, montaje, entrada de cables, ventilación, reserva, mandos en puerta, calefacción, temperatura interior), se aplica al confirmar y muestra el impacto (p. ej. el gabinete nuevo); el 2D, el 3D y la lista de materiales se regeneran.
- El multifilar usa los mismos criterios compartidos (TAG de bornera TBn, bornes según la corriente y barras según el interruptor general), para que ambos planos conversen.

Planos generados (DXF R12, ANSI 1252): P&ID esquemático, unifilar y multifilar de los tableros de fuerza, disposición de equipos de los tableros, unifilar y conexionado de E/S de los tableros de control, diagramas de lazo, arquitectura de control, diagrama de bloques y arreglos generales sobre la planta del cliente. Los logos se dibujan con entidades SOLID (R12 no admite imágenes).

## Código
```
js/app.js          rutas, menú lateral y pantallas del proyecto (asistente, emisión de revisiones en lote)
js/version.js      versión publicada (fecha y hora)
js/actualizar.js   detección de versión nueva y recarga automática
js/workspace.js    entorno de cada documento (datos, vista previa, cajetín, plantilla, descarga)
js/docs.js         registro de entregables, datos por plantilla, memorias (MD, conductores), hojas de datos de tableros
js/editores.js     formularios de datos de entrada
js/datos.js        modelo de datos (tableros, cargas con valores típicos, cables, E/S, circuitos de control)
js/modules/proceso.js    recomendación de instrumentos (P&ID) · js/modules/filosofia.js filosofía y típicos
js/xlsx-engine.js  motor de plantillas Excel ({{…}}, filas ancla, fórmulas, combinaciones, logos)
js/engine/tablero-core.js  motor de cálculo NEC + catálogos ABB / Miguélez + escritor DXF
js/cad/formato.js  lámina y cajetín · js/cad/planos.js y planos2.js generadores de planos
js/cad/plano-mecanico.js   plano mecánico del tablero (4 láminas)
js/mecanico/       componentes.js (dimensiones) · arreglo.js (motor de arreglo) · visor3d.js (vista 3D)
```
Librerías en `vendor/`: ExcelJS, docxtemplater + PizZip, pako y three.js 0.169 (`vendor/three`, con `OrbitControls` y `CSS2DRenderer` importando `./three.module.min.js`).
- `vendor/exceljs.min.js` lleva un parche: escribe `<outlinePr>` antes de `<pageSetUpPr>` dentro de `<sheetPr>` (orden del esquema OOXML). Sin él, Excel «reparaba» las hojas de los formatos y las dejaba vacías.
- `tools/ordenar_docx.py` ordena según el esquema las propiedades de tabla y `updateFields` de las plantillas Word. Los archivos generados se verifican con el validador del Open XML SDK de Microsoft.

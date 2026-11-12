# Ingenia

Plataforma web para elaborar ingenierías de **Electricidad e Instrumentación & Control** a partir de pocos datos: cada entregable tiene su propio entorno (datos de entrada → vista previa → cajetín y revisiones → plantilla) y se descarga en Excel, Word o DXF.

- Sitio estático (GitHub Pages): `index.html` (presentación) · `app.html` (plataforma).
- Datos en el navegador (localStorage + IndexedDB para logos y plantillas). Sin servidor.

## Identidad visual
- Paleta: grafito `#17191D`, gris acero `#303640`, amarillo eléctrico `#F5C518` (acento), gris claro `#DCE1E6`, blanco.
- Tipografía (alojada en `assets/fonts`, licencia OFL): Montserrat Bold/SemiBold (títulos), Inter Regular/Medium (texto, botones y menús), Roboto Medium (datos técnicos: códigos, TAG, valores).
- Marca: solo el nombre, INGENIA, con «IA» resaltado en amarillo (ingeniería asistida por inteligencia artificial). `assets/favicon.svg` para la pestaña del navegador.
- Menú lateral en árbol: Proyectos (cada proyecto con sus secciones), Catálogo, Formatos estándar y Configuración; cada grupo se abre o se cierra al tocarlo.
- Versión publicada: `js/version.js` (fecha y hora de carga, hora de Perú), visible al pie del menú lateral y en la barra superior del celular.
- Actualización automática (`js/actualizar.js`): al abrir la página o volver a ella se compara con la versión publicada; si hay una más nueva se renueva la caché y se recarga sola.
- Celular y tableta: barra superior con menú ☰ (cajón lateral), modales como hoja inferior, documentos como tarjetas y campos de 16 px (sin zoom automático en iPhone). Probado en 360, 375, 390, 412 y 768 px.

## Copito (asistente)
`js/copito.js`, imagen `assets/copito.png`. Botón flotante en la plataforma; responde sobre los proyectos guardados en el navegador:
- **Motor propio** (sin internet): máxima demanda, cargas, cables y caída de tensión, tableros, instrumentos, señales I/O, documentos y revisiones, condiciones del sitio, detalle por TAG y búsqueda libre.
- **Cambios desde el chat** (`js/copito-editar.js`): agregar, modificar o eliminar cargas e instrumentos, datos de diseño, del proyecto, del sistema y de tableros, y emitir revisiones. Copito muestra la propuesta, se aplica solo al confirmar, regenera el listado I/O cuando corresponde, informa el impacto (máxima demanda, corriente, ITM general, señales, cables fuera de la caída de tensión) y permite deshacer.
- **Modo IA opcional** (Claude, `claude-opus-5-5`): se activa en los ajustes de Copito con una clave de API guardada solo en ese navegador; envía la pregunta y los datos de los proyectos a Anthropic. SDK oficial empaquetado en `vendor/anthropic-sdk-1.3.0.mjs` (se carga solo en modo IA). Para producción, la clave debe ir en un servidor intermedio, no en el navegador.

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
```
Librerías en `vendor/`: ExcelJS, docxtemplater + PizZip, pako.

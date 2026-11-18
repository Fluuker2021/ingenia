// Imágenes de la página principal (assets/vistas/*.jpg) con la versión actual del programa.
//   node tools/vistas/capturas.cjs [carpeta_salida]        (por defecto assets/vistas)
// Arma en el navegador un proyecto demostrativo con datos ficticios (colector de polvos con su tablero de fuerza
// y su tablero de control), toma las capturas y las guarda en JPG. Sin servidor: Playwright responde cada archivo
// desde el repositorio. Requiere Playwright con Chromium y Python 3 con Pillow (para pasar PNG → JPG).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const RAIZ = path.resolve(__dirname, '../..'), ORIGEN = 'http://ingenia.prueba', BASE = ORIGEN + '/app.html';
const SALIDA = path.resolve(process.argv[2] || path.join(RAIZ, 'assets/vistas'));
const TMP = fs.mkdtempSync(path.join(require('os').tmpdir(), 'vistas-'));
const servir = c => c.route(ORIGEN + '/**', r => { const u = new URL(r.request().url()); const f = path.join(RAIZ, decodeURIComponent(u.pathname));
  if(!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status:404, body:'' }); return r.fulfill({ path:f }); });

/* proyecto demostrativo (se ejecuta dentro de la página, con los módulos del programa) */
async function proyectoDemo(){
  const S = await import('/js/store.js'), D = await import('/js/datos.js'), C = await import('/js/catalog.js');
  const p = S.nuevoProyecto({ nombre:'Colector de polvos — proyecto demostrativo', cliente:'Cliente demostración S.A.', unidad:'Planta demo', etapa:'detalle' });
  p.entregables = C.ENTREGABLES.map(e=>e.id); S.sincronizarDocumentos(p, C.ENTREGABLES);
  const d = D.datos(p);
  d.sistema = { nombre:'Colector de polvos', tag:'112-DCB-011' };
  const [tf, tc] = d.tableros; tf.tag = 'TF-001'; tc.tag = 'TC-001'; tc.desde = tf.id; tc.controladorLimpieza = true; tc.router = true;
  const L = (tag, desc, hp, starter, ap)=>{ const l = D.nuevaCarga('motor', tf.id); Object.assign(l, { tag, desc, power:hp, powerUnit:'hp', starter, application:ap }); D.aplicarTipicos(l); d.cargas.push(l); };
  L('M-101', 'Ventilador centrífugo', 150, 'vfd', 'ventilador-centrifugo');
  L('M-102', 'Válvula rotativa', 1, 'dol', 'valvula-rotativa');
  const I = (tag, descripcion, servicio, tipoSenal, senal, alimentacion, cant=1, extra={})=>d['ins-instrumentos'].push(Object.assign({ sistema:'COLECTOR DE POLVOS', cant, tag, descripcion, servicio, tipoSenal, senal, alimentacion, ubicacion:'Colector', tablero:tc.tag, marca:'', modelo:'' }, extra));
  I('PIT-001', 'Transmisor de presión', 'Presión en línea de aire comprimido', 'Analógica', '4 - 20 mA', '24 Vdc / Loop Powered', 1, { rango:'0-10', unidad:'bar' });
  I('PIT-002', 'Transmisor de presión', 'Presión en línea de aire comprimido', 'Analógica', '4 - 20 mA', '24 Vdc / Loop Powered', 1, { rango:'0-10', unidad:'bar' });
  I('PDIT-008', 'Transmisor de presión diferencial', 'Presión diferencial de mangas', 'Analógica', '4 - 20 mA', '24 Vdc / Loop Powered', 1, { rango:'0-250', unidad:'mmH2O' });
  I('VT-006', 'Transmisor de vibración', 'Vibración del ventilador', 'Analógica', '4 - 20 mA', '24 Vdc / Loop Powered', 1, { rango:'0-25', unidad:'mm/s' });
  I('AT-007', 'Sensor de manga rota', 'Detección de manga rota', 'Analógica', '4 - 20 mA', '24 Vdc', 1, { rango:'0-100', unidad:'%' });
  for(const s of ['A','B','C']) I('LSH-004'+s, 'Interruptor de nivel tipo vibratorio', 'Nivel alto en tolva '+s, 'Discreta', 'Contacto seco / Relé', '120 Vac');
  for(const s of ['A','B','C']) I('SSL-005'+s, 'Interruptor de velocidad cero', 'Velocidad cero de válvula rotativa '+s, 'Discreta', 'Contacto seco / Relé', '120 Vac');
  I('SSL-006', 'Interruptor de velocidad cero', 'Velocidad cero del transportador', 'Discreta', 'Contacto seco / Relé', '120 Vac');
  I('XV-003A@003R', 'Válvula solenoide', 'Limpieza de mangas', 'Discreta', 'N. A.', '120 Vac', 18);
  d['ins-io'] = D.derivarIO(p);
  for(const id of p.entregables){ const x = p.documentos[id]; if(!x) continue; x.estado = 'Emitido'; x.revisiones = [{ rev:'A', fecha:new Date().toISOString().slice(0, 10), descripcion:'Emitido para revisión interna' }]; x.rev = 'A'; x.elaboro = 'J.P.'; x.reviso = 'M.R.'; }
  S.load().cuenta = { plan:'pro' };          // plan Profesional: las vistas previas de todos los documentos
  S.save();
  return p.id;
}

// todas las vistas con la misma pantalla de escritorio (16:10), así el carrusel las muestra a la misma escala
const PANTALLA = { width:1440, height:900 };

(async () => {
  const b = await chromium.launch(), errores = [];
  const ctx = await b.newContext({ viewport:PANTALLA, deviceScaleFactor:1 }); await servir(ctx);
  const pg = await ctx.newPage();
  pg.on('pageerror', e => errores.push(e.message)); pg.on('console', m => { if(m.type()==='error') errores.push(m.text()); });
  await pg.goto(BASE); await pg.waitForTimeout(1500);
  await pg.evaluate(() => { localStorage.clear(); });
  const pid = await pg.evaluate(proyectoDemo);
  const LS = await pg.evaluate(() => localStorage.getItem('ingenia.v1'));
  const ir = async (h, ms=2500) => { await pg.goto(`${BASE}#/proyecto/${pid}/${h}`); await pg.reload(); await pg.waitForTimeout(ms); };
  const foto = async n => { await pg.screenshot({ path:path.join(TMP, n+'.png') }); console.log(n); };
  await ir('resumen'); await foto('01-resumen');
  await ir('doc/ele-cargas/vista', 3500); await foto('02-cargas');
  // planos: la pantalla completa de la plataforma en la vista previa del documento (menú lateral, pestañas
  // «1. Datos de entrada · 2. Vista previa · 3. Cajetín y descarga» y la lámina), para que se vea que el plano
  // se genera en el mismo entorno. Se espera a que la lámina esté dibujada antes de la captura.
  const plano = async (doc, n, hoja) => {
    const c2 = await b.newContext({ viewport:PANTALLA, deviceScaleFactor:1 }); await servir(c2);
    await c2.addInitScript(s => { localStorage.setItem('ingenia.v1', s); }, LS);
    const p2 = await c2.newPage();
    p2.on('pageerror', e => errores.push(n+': '+e.message));
    await p2.goto(`${BASE}#/proyecto/${pid}/doc/${doc}/vista`);
    const cv = await p2.waitForSelector('#pl-cv', { timeout:60000 }).catch(()=>null);
    if(!cv){ errores.push(n+': sin lámina'); await c2.close(); return; }
    if(hoja!=null && await p2.$('#pl-h')){ await p2.selectOption('#pl-h', String(hoja)); }
    // lámina dibujada: el lienzo tiene tamaño y algo distinto del fondo blanco
    await p2.waitForFunction(() => { const c = document.querySelector('#pl-cv'); if(!c || !c.width || !c.height) return false;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for(let i = 0; i < d.length; i += 4*97) if(d[i] < 200) return true; return false; }, null, { timeout:30000 }).catch(()=>errores.push(n+': lámina vacía'));
    await p2.evaluate(() => document.fonts && document.fonts.ready); await p2.waitForTimeout(1200);
    // arriba de la página: barra del documento, pestañas y la lámina en la misma pantalla
    await p2.evaluate(() => { window.scrollTo(0, 0); const m = document.querySelector('.main'); if(m) m.scrollTop = 0; });
    // si la lámina no entra entera bajo las pestañas, se aleja con la rueda del ratón (como lo haría el usuario),
    // centrada y desde su borde superior, hasta que se vea completa con su cajetín; luego se arrastra para
    // centrarla en el alto visible del lienzo
    const caja = await cv.boundingBox(), alto = PANTALLA.height - caja.y - 12;
    let k = 1, pasos = 0; while(caja.height*k > alto && pasos < 5){ k /= 1.2; pasos++; }
    if(pasos){
      const x0 = caja.x + caja.width/2, y0 = caja.y + 4;
      await p2.mouse.move(x0, y0); for(let i = 0; i < pasos; i++){ await p2.mouse.wheel(0, 120); await p2.waitForTimeout(150); }
      const dy = Math.round((alto - caja.height*k)/2 - 4*(1 - k));
      if(dy > 2){ await p2.mouse.down(); await p2.mouse.move(x0, y0 + dy, { steps:4 }); await p2.mouse.up(); }
    }
    await p2.mouse.move(PANTALLA.width - 10, 4); await p2.waitForTimeout(400);
    await p2.screenshot({ path:path.join(TMP, n+'.png') }); console.log(n);
    await c2.close();
  };
  await plano('ele-unifilar', '03-unifilar'); await plano('ins-pid', '04-pid');
  // conexionado: la hoja de entradas analógicas del multifilar de control
  const hojaAI = await pg.evaluate(async pid => { const S = await import('/js/store.js'), { GENERADORES } = await import('/js/cad/planos.js');
    const t = []; await GENERADORES['ins-multifilar-tc'].fn({ p:S.proyecto(pid), valsDe:(i, n, x)=>{ t[i] = (x||{}).TITULO2||''; return Object.assign({}, x||{}); }, cliente:null, id:'ins-multifilar-tc' });
    return t.findIndex(s=>/ENTRADAS ANAL/i.test(s)); }, pid).catch(e=>{ errores.push('hoja AI: '+e.message); return -1; });
  await plano('ins-multifilar-tc', '05-conexionado', hojaAI < 0 ? 0 : hojaAI);
  await ir('documentos'); await foto('06-documentos');
  await ir('doc/ins-mecanico-tc/vista3d', 6000); await foto('08-tablero-3d');
  // Copito aplica un cambio sobre el plano abierto y lista los entregables que se actualizaron
  await ir('doc/ins-unifilar-tc/vista', 4000);
  await pg.click('#cp-btn'); await pg.waitForTimeout(800);
  await pg.fill('#cp-q', 'Agrega una reserva de 24 Vdc en TC-001'); await pg.press('#cp-q', 'Enter'); await pg.waitForTimeout(2500);
  const ap = await pg.$('[data-aplicar]'); if(ap){ await ap.click(); await pg.waitForTimeout(4500); }
  await pg.$eval('#cp-msgs', el => { el.scrollTop = el.scrollHeight; }).catch(()=>{});
  await foto('07-copito');
  await b.close();
  // PNG → JPG (calidad 85; 1440 px de ancho como máximo)
  fs.mkdirSync(SALIDA, { recursive:true });
  execFileSync('python3', ['-I', '-c', `
import sys, glob, os
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
for f in sorted(glob.glob(os.path.join(src, '*.png'))):
    im = Image.open(f).convert('RGB')
    if im.width > 1440: im = im.resize((1440, round(im.height*1440/im.width)), Image.LANCZOS)
    im.save(os.path.join(dst, os.path.basename(f)[:-4] + '.jpg'), quality=85, optimize=True, progressive=True)
`, TMP, SALIDA], { stdio:'inherit' });
  console.log('salida:', SALIDA, '| errores:', errores.length ? errores.join('\n') : 'ninguno');
})();

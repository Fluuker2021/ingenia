/* Ingenia — VISTA PREVIA 3D del tablero (three.js, se carga solo en esta pestaña).
   Se arma con el mismo modelo del arreglo mecánico (js/mecanico/arreglo.js) que genera el plano 2D, para ver en el
   espacio cómo se construye el tablero: gabinete con sus puertas (se abren), placas de montaje, canaletas, rieles,
   equipos con sus dimensiones reales, barras, recorridos de fuerza, borneras, base con prensaestopas y los
   dispositivos de puerta. Botones para cambiar de vista, abrir puertas, ocultar capas, ver por explosión y
   seleccionar un componente para ver sus datos o pedirle un cambio a Copito.
   Cada equipo se dibuja con la apariencia de su familia / marca (js/mecanico/modelos.js): carcasa con chaflanes y
   perfil escalonado, palancas, perillas, LED con brillo propio, display, teclado, bornes, conector frontal, aletas
   del disipador, etc. Las piezas pequeñas repetidas de un equipo (bornes, LED, teclas) se dibujan instanciadas
   (una llamada de dibujo por material) y las sombras se recalculan solo cuando algo se mueve. */
import * as C from "./componentes.js";
import { apariencia, aparienciaBorne, colorDe, COLOR_IO, cuenta, polosDe, regiones, rasgosDe } from "./modelos.js";

const RAL7035 = 0xd7d8d2, GALV = 0xc4c9cf;
/* color de respaldo para los tipos que no estén en la base de apariencia */
const COL_TIPO = {
  interruptor:0x3b3f46, xlp:0x4a4f57, variador:0x2b2f36, arrancador:0xe6e7e9, reactancia:0x6b5236, trafo:0x5d6670, fuente:0xd9dadc,
  guardamotor:0xe9eaec, contactor:0xe9eaec, sobrecarga:0xdedfe1, mcb:0xf2f2f2, diferencial:0xf2f2f2, fusible:0xe4e4e4, rele:0xe6e6e6,
  spd:0xe9eaec, resistencia:0x9da3aa, peine:0xc8783a,
  cpu:0x2f3338, modulo:0x2f3338, fpd:0x3b3f46, tapa:0x3b3f46, switch:0x2b2f36, router:0x50555d, termostato:0xe6e7e9, tomacorriente:0xf4f5f6, luminaria:0xf4f5f6, finpuerta:0x3b3f46,
};
const FASE = { L1:0x8b5a2b, L2:0x1c1c1c, L3:0x8a8f96, U:0x8b5a2b, V:0x1c1c1c, W:0x8a8f96, "L1-L2-L3":0x444444 };

let actual = null;   // visor activo (uno a la vez)

export async function visor3D(cont, modelo, opciones){
  if(actual) actual.destruir();
  const THREE = await import("../../vendor/three/three.module.min.js");
  const { OrbitControls } = await import("../../vendor/three/OrbitControls.js");
  const { CSS2DRenderer, CSS2DObject } = await import("../../vendor/three/CSS2DRenderer.js");
  const m = modelo, o = opciones || {};
  const k = 0.001;   // mm → m
  cont.innerHTML = `<div class="v3d">
      <div class="v3d-barra">
        <div class="v3d-grupo"><button data-v="iso" class="activo">Isométrica</button><button data-v="frente">Frente</button><button data-v="lateral">Lateral</button><button data-v="planta">Planta</button><button data-v="atras">Posterior</button></div>
        <div class="v3d-grupo"><button data-a="puertas">Abrir puertas</button><button data-a="explosion">Explosionar</button></div>
        <div class="v3d-grupo"><label><input type="checkbox" data-c="envolvente" checked> Gabinete</label><label><input type="checkbox" data-c="hojas" checked> Puertas</label><label><input type="checkbox" data-c="canaletas" checked> Canaletas</label><label><input type="checkbox" data-c="cables" checked> Cableado</label><label><input type="checkbox" data-c="etiquetas" checked> TAG</label><label><input type="checkbox" data-c="puerta" checked> Disp. de puerta</label></div>
        <div class="v3d-grupo"><button data-a="pantalla" title="Pantalla completa">⛶</button><button data-a="foto" title="Descargar imagen">PNG</button></div>
      </div>
      <div class="v3d-lienzo"><div class="v3d-info" hidden></div><div class="v3d-ayuda">Arrastra para girar · rueda: acercar · clic derecho: desplazar · clic en un equipo: sus datos</div></div>
    </div>`;
  const lienzo = cont.querySelector(".v3d-lienzo"), info = cont.querySelector(".v3d-info");
  const W0 = () => lienzo.clientWidth || 800, H0 = () => lienzo.clientHeight || 560;
  const renderer = new THREE.WebGLRenderer({ antialias:true, preserveDrawingBuffer:true });
  // calidad: con GPU, reflejos de entorno y sombras; con render por software (sin GPU) se omiten para no perder fluidez.
  // Se puede forzar con localStorage «ingenia.v3d.calidad» = "alta" | "baja".
  const calidad = (()=>{ let f = ""; try { f = localStorage.getItem("ingenia.v3d.calidad") || ""; } catch(e){}
    if(f==="alta" || f==="baja") return f;
    try { const gl = renderer.getContext(), ext = gl.getExtension("WEBGL_debug_renderer_info"); const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "";
      return /swiftshader|llvmpipe|software|basic render/i.test(r||"") ? "baja" : "alta"; } catch(e){ return "alta"; } })();
  const alta = calidad==="alta";
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(W0(), H0());
  renderer.setClearColor(0xffffff, 1);   // fondo blanco liso
  renderer.toneMapping = THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  // sombras: se recalculan solo cuando algo se mueve (puertas, explosión, capas)
  renderer.shadowMap.enabled = alta; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  lienzo.appendChild(renderer.domElement);
  const etiq = new CSS2DRenderer(); etiq.setSize(W0(), H0()); etiq.domElement.className = "v3d-etiquetas"; lienzo.appendChild(etiq.domElement);
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(35, W0()/H0(), 0.01, 100);
  const ctrl = new OrbitControls(camara, renderer.domElement);
  ctrl.enableDamping = true; ctrl.dampingFactor = 0.08;
  // se dibuja solo cuando algo cambia (cámara, puertas, explosión, capas, selección, tamaño): en reposo no consume
  let sucio = true; const redibujar = () => { sucio = true; };
  ctrl.addEventListener("change", redibujar);
  const { W, H, D, zocalo } = m;
  const R = Math.max(W, H, D)*k;
  // luces: cielo / suelo, sol con sombra y luz de relleno; reflejos de un entorno de estudio (metales, plásticos)
  escena.add(new THREE.HemisphereLight(0xffffff, 0x8d939b, 0.75));
  const sol = new THREE.DirectionalLight(0xffffff, 1.9); sol.position.set(1.2*R, 2.4*R, 3.2*R);
  sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048); sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.0015;
  Object.assign(sol.shadow.camera, { left:-R*0.9, right:R*0.9, top:R*0.9, bottom:-R*0.9, near:0.1, far:R*10 });
  sol.target.position.set(0, H/2*k, 0); escena.add(sol, sol.target);
  const sol2 = new THREE.DirectionalLight(0xffffff, 0.55); sol2.position.set(-3, 2, -2); escena.add(sol2);
  const sol3 = new THREE.DirectionalLight(0xffffff, 0.45); sol3.position.set(-1.5, 0.6, 3); escena.add(sol3);
  if(alta){ const pmrem = new THREE.PMREMGenerator(renderer), env = new THREE.Scene(), gs = [];
    const fondo = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color:0x6d737b, side:THREE.BackSide })); env.add(fondo); gs.push(fondo);
    for(const [x, y, z, w, h, i] of [[0, 4.9, 0, 7, 7, 2.6], [4.9, 1.5, 1.5, 3, 4, 1.6], [-4.9, 1, -1, 3, 3, 1.2], [0, 1.2, 4.9, 5, 2.2, 1.5], [0, -4.9, 0, 8, 8, 0.25]]){
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color:new THREE.Color(i, i, i), side:THREE.DoubleSide })); p.position.set(x, y, z); p.lookAt(0, 0, 0); env.add(p); gs.push(p); }
    escena.environment = pmrem.fromScene(env, 0.035).texture; escena.environmentIntensity = 0.55;
    gs.forEach(g=>{ g.geometry.dispose(); g.material.dispose(); }); pmrem.dispose(); }
  else { escena.add(new THREE.AmbientLight(0xffffff, 0.35)); }
  // sin piso ni cuadrícula: el modelo se presenta sobre fondo blanco liso

  const raiz = new THREE.Group(); raiz.position.set(-m.W/2*k, 0, -m.D/2*k); escena.add(raiz);
  const capas = { envolvente:new THREE.Group(), interior:new THREE.Group(), canaletas:new THREE.Group(), cables:new THREE.Group(), etiquetas:new THREE.Group(), puerta:new THREE.Group() };
  Object.values(capas).forEach(g=>raiz.add(g));
  const mats = {}, texturas = [];
  const mat = (c, extra) => { const key = c + JSON.stringify(extra||{}); if(!mats[key]) mats[key] = new THREE.MeshStandardMaterial(Object.assign({ color:c, roughness:0.55, metalness:0.08 }, extra||{})); return mats[key]; };
  // materiales por acabado
  const plas = c => mat(c, { roughness:0.58, metalness:0 });
  const metal = c => mat(c, alta ? { roughness:0.32, metalness:0.85 } : { roughness:0.38, metalness:0.4 });
  const luz = (c, e) => mat(c, { emissive:e ?? c, emissiveIntensity:e ? 1 : 0.85, roughness:0.3, metalness:0 });
  const vidrio = c => mat(c, { roughness:0.08, metalness:0, transparent:true, opacity:0.38, depthWrite:false });
  const NEGRO = 0x17181b;
  const bordes = new THREE.LineBasicMaterial({ color:0x2a2e35, transparent:true, opacity:0.35 });
  const bordesSuaves = new THREE.LineBasicMaterial({ color:0x1d2025, transparent:true, opacity:0.16 });
  const geoCaja = new THREE.BoxGeometry(1, 1, 1), geoBordes = new THREE.EdgesGeometry(geoCaja);
  // cilindros unitarios: de pocas caras para piezas chicas (tornillos, LED) y de más caras para perillas y bobinas
  const geoCilZ0 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6).rotateX(Math.PI/2), geoCilZ = new THREE.CylinderGeometry(0.5, 0.5, 1, 10).rotateX(Math.PI/2), geoCilZ2 = new THREE.CylinderGeometry(0.5, 0.5, 1, 24).rotateX(Math.PI/2), geoCilY = new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
  const compartidas = new Set([geoCaja, geoBordes, geoCilZ0, geoCilZ, geoCilZ2, geoCilY]);
  // caja en coordenadas del modelo: x, y (abajo-izquierda), z0 (desde la pared posterior), w, h, d
  const caja = (x, y, z0, w, h, d, color, grupo, extra, conBordes) => {
    const g = new THREE.Mesh(geoCaja, typeof color==="object" ? color : mat(color, extra));
    g.scale.set(Math.max(0.5, w)*k, Math.max(0.5, h)*k, Math.max(0.5, d)*k);
    g.position.set((x + w/2)*k, (y + h/2)*k, (z0 + d/2)*k);
    if(conBordes!==false){ const e = new THREE.LineSegments(geoBordes, bordes); g.add(e); }
    g.castShadow = !(g.material.transparent); g.receiveShadow = true;
    (grupo || capas.interior).add(g); return g;
  };
  const cil = (x, y, z, r, largo, color, grupo, eje) => {
    const g = new THREE.Mesh(new THREE.CylinderGeometry(r*k, r*k, largo*k, 24), typeof color==="object" ? color : mat(color));
    if(eje==="z") g.rotation.x = Math.PI/2; if(eje==="x") g.rotation.z = Math.PI/2;
    g.position.set(x*k, y*k, z*k); g.castShadow = g.receiveShadow = true; (grupo || capas.interior).add(g); return g;
  };
  /* carcasa con chaflán (geometría compartida por medida) */
  const geosB = new Map(), bordesB = new Map();
  const geoBisel = (w, h, d, b) => {
    b = Math.min(b || 0, w*0.18, h*0.18, d*0.18);
    const key = [w, h, d, b].map(v=>Math.round(v*10)).join("|");
    let g = geosB.get(key); if(g) return g;
    if(b < 0.35) g = new THREE.BoxGeometry(w*k, h*k, d*k);
    else {
      const x1 = (w/2 - b)*k, y1 = (h/2 - b)*k, s = new THREE.Shape();
      s.moveTo(-x1, -y1); s.lineTo(x1, -y1); s.lineTo(x1, y1); s.lineTo(-x1, y1); s.lineTo(-x1, -y1);
      g = new THREE.ExtrudeGeometry(s, { depth:(d - 2*b)*k, bevelEnabled:true, bevelThickness:b*k, bevelSize:b*k, bevelOffset:0, bevelSegments:1, curveSegments:1 });
      g.translate(0, 0, -(d/2 - b)*k);
    }
    geosB.set(key, g); return g;
  };
  const cuerpo = (G, x, y, z, w, h, d, material, b, inf, lista) => {
    const geo = geoBisel(w, h, d, b), ms = new THREE.Mesh(geo, material);
    ms.position.set((x + w/2)*k, (y + h/2)*k, (z + d/2)*k); ms.castShadow = ms.receiveShadow = true;
    if(!bordesB.has(geo)) bordesB.set(geo, new THREE.EdgesGeometry(geo, 40));
    if(alta) ms.add(new THREE.LineSegments(bordesB.get(geo), bordesSuaves));
    if(inf) ms.userData.info = inf; if(lista){ lista.push(ms); ms.userData.hermanos = lista; }
    G.add(ms); return ms;
  };
  /* lote de piezas pequeñas de un equipo: una malla instanciada por (geometría, material) */
  const BLANCO = new THREE.Color(0xffffff), RESALTE = new THREE.Color(0xffd34d);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  const lote = () => {
    const L = new Map();
    const add = (geo, material, cx, cy, cz, sx, sy, sz, op) => {
      const key = geo.uuid + material.uuid; let e = L.get(key);
      if(!e){ e = { geo, material, ms:[], infos:[] }; L.set(key, e); }
      _e.set((op && op.rx) || 0, (op && op.ry) || 0, (op && op.rz) || 0); _q.setFromEuler(_e);
      _m.compose(_p.set(cx*k, cy*k, cz*k), _q, _s.set(Math.max(0.05, sx)*k, Math.max(0.05, sy)*k, Math.max(0.05, sz)*k));
      e.ms.push(_m.clone()); e.infos.push((op && op.info) || null);
    };
    return {
      box(x, y, z, w, h, d, material, op){ add(geoCaja, material, x + w/2, y + h/2, z + d/2, w, h, d, op); },
      boxC(cx, cy, z, w, h, d, material, op){ add(geoCaja, material, cx, cy, z + d/2, w, h, d, op); },
      cil(cx, cy, z, r, largo, material, op){ add(r > 4 ? geoCilZ2 : r < 2.5 ? geoCilZ0 : geoCilZ, material, cx, cy, z + largo/2, 2*r, 2*r, largo, op); },
      cilY(cx, y, cz, r, alto, material){ add(geoCilY, material, cx, y + alto/2, cz, 2*r, alto, 2*r); },
      fin(grupo){
        for(const e of L.values()){
          let ms;
          if(e.ms.length===1){ ms = new THREE.Mesh(e.geo, e.material); ms.matrixAutoUpdate = false; ms.matrix.copy(e.ms[0]); if(e.infos[0]) ms.userData.info = e.infos[0]; }
          else {
            ms = new THREE.InstancedMesh(e.geo, e.material, e.ms.length); e.ms.forEach((x, i)=>ms.setMatrixAt(i, x)); ms.instanceMatrix.needsUpdate = true;
            if(e.infos.some(Boolean)){ ms.userData.infos = e.infos; for(let i=0;i<e.ms.length;i++) ms.setColorAt(i, BLANCO); ms.instanceColor.needsUpdate = true; }
            ms.computeBoundingSphere(); ms.computeBoundingBox();
          }
          ms.castShadow = !e.material.transparent; ms.receiveShadow = true; grupo.add(ms);
        }
        L.clear();
      },
    };
  };
  /* pantallas: textura genérica de interfaz (barra de título, valores y gráfico) */
  const texPantalla = (() => {
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 160; const g = cv.getContext("2d");
    const gr = g.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, "#2d5f86"); gr.addColorStop(1, "#173550"); g.fillStyle = gr; g.fillRect(0, 0, 256, 160);
    g.fillStyle = "#dfe9f2"; g.fillRect(0, 0, 256, 22); g.fillStyle = "#2d5f86"; g.fillRect(8, 7, 70, 8);
    g.fillStyle = "#cfe3f2"; for(let i=0;i<4;i++){ g.fillRect(12, 34 + i*20, 90, 7); g.fillStyle = i%2 ? "#8fd18f" : "#cfe3f2"; g.fillRect(150, 34 + i*20, 50, 7); g.fillStyle = "#cfe3f2"; }
    g.strokeStyle = "#ffd34d"; g.lineWidth = 3; g.beginPath(); for(let x=0;x<=230;x+=10){ const y = 140 - 18*Math.sin(x/28) - x*0.06; x ? g.lineTo(13 + x, y) : g.moveTo(13, y); } g.stroke();
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; texturas.push(t); return t;
  })();
  const matPantalla = new THREE.MeshStandardMaterial({ map:texPantalla, emissive:0xffffff, emissiveMap:texPantalla, emissiveIntensity:0.75, roughness:0.25 });
  mats.__pantalla = matPantalla;
  /* canaletas ranuradas: textura de ranuras (una por orientación de cara) */
  const texRanura = (vertical, frenteAl0) => {
    const cv = document.createElement("canvas"); cv.width = 32; cv.height = 32; const g = cv.getContext("2d");
    g.fillStyle = "#9a9b94"; g.fillRect(0, 0, 32, 32); g.fillStyle = "#3b3d40";
    // ranura: desde el borde de la tapa (frente) hasta ~72 % del alto de la canaleta
    if(!vertical){ if(frenteAl0) g.fillRect(11, 9, 10, 23); else g.fillRect(11, 0, 10, 23); }
    else { if(frenteAl0) g.fillRect(0, 11, 23, 10); else g.fillRect(9, 11, 23, 10); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; texturas.push(t); return t;
  };
  const RAN = { py:texRanura(false, true), ny:texRanura(false, false), px:texRanura(true, true), nx:texRanura(true, false) };

  const chicas = [];
  const etiqueta = (txt, x, y, z, clase) => { const d = document.createElement("div"); d.className = "v3d-tag" + (clase ? " "+clase : ""); d.textContent = txt; const o2 = new CSS2DObject(d); o2.position.set(x*k, y*k, z*k); capas.etiquetas.add(o2); if(clase==="v3d-tag-chico") chicas.push(o2); return o2; };

  // ===== gabinete =====
  const esp = 2;
  const envMat = mat(RAL7035, { transparent:true, opacity:0.32, depthWrite:false });
  caja(0, 0, 0, W, H, esp, envMat, capas.envolvente);                 // fondo
  caja(0, 0, 0, esp, H, D, envMat, capas.envolvente);                 // lateral izq.
  caja(W - esp, 0, 0, esp, H, D, envMat, capas.envolvente);           // lateral der.
  caja(0, H - esp, 0, W, esp, D, envMat, capas.envolvente);           // techo
  caja(0, 0, 0, W, esp, D, mat(0xb9bdc2), capas.envolvente);          // base / placa pasacables
  if(zocalo) caja(0, -zocalo, 0, W, zocalo, D, mat(0x3b3f46), capas.envolvente);
  for(const s of m.secciones.slice(1)) caja(s.x0 - 20, 0, 0, 40, H, 40, mat(0xa9aeb5), capas.envolvente);
  if(m.techo) caja(-40, H, -40, W + 80, 30, D + 80, mat(RAL7035), capas.envolvente);
  for(const [xe, ze] of [[80, 80], [W - 80, 80], [80, D - 80], [W - 80, D - 80]]){ const t = new THREE.Mesh(new THREE.TorusGeometry(16*k, 4*k, 8, 20), metal(0x8a8f96)); t.position.set(xe*k, (H + (m.techo ? 30 : 0) + 30)*k, ze*k); capas.envolvente.add(t); }
  // prensaestopas en la base
  for(const c of m.base){ const zc = c.zb ?? (c.fila ? D*0.32 : D*0.6); const g = cil(c.x, m.tipo==="control" && m.entrada==="superior" ? H + 6 : -6, zc, (c.agujero||25)/2 + 3, 18, c.ref==="RESERVA" ? 0x9aa0a8 : 0x2b2f36, capas.envolvente); g.userData.info = { tag:c.ref, desc:c.desc, modelo:`Prensaestopa ${c.rosca}${c.awg ? " · cable "+c.awg : ""}`, dim:`Agujero Ø${c.agujero} mm` }; }

  // ===== placas, canaletas, rieles =====
  for(const p of m.placas) caja(p.x, p.y, 22, p.w, p.h, 3, mat(GALV, { metalness:0.55, roughness:0.42 }));
  const apCan = apariencia(null, "canaleta"), colCan = colorDe(apCan, "cuerpo"), colTapa = colorDe(apCan, "tapa");
  for(const d of m.canaletas){
    const prof = d.prof || 80, hz = d.orient!=="v";
    const largo = hz ? d.w : d.h, rep = Math.max(1, Math.round(largo/12.5));
    const lado = key => { const t = RAN[key].clone(); t.needsUpdate = true; if(hz) t.repeat.set(rep, 1); else t.repeat.set(1, rep); texturas.push(t); return new THREE.MeshStandardMaterial({ color:0xffffff, map:t, roughness:0.7 }); };
    const tapa = plas(colTapa), base = plas(colCan);
    const mm = hz ? [base, base, lado("py"), lado("ny"), tapa, base] : [lado("px"), lado("nx"), base, base, tapa, base];
    mm.filter(x=>x.map).forEach((x, i)=>{ mats["__can" + d.x + "_" + d.y + "_" + i] = x; });
    const g = new THREE.Mesh(geoCaja, mm); g.scale.set(d.w*k, d.h*k, prof*k); g.position.set((d.x + d.w/2)*k, (d.y + d.h/2)*k, (25 + prof/2)*k);
    g.castShadow = g.receiveShadow = true; g.add(new THREE.LineSegments(geoBordes, bordesSuaves)); capas.canaletas.add(g);
    g.userData.info = { tag:"", desc:"Canaleta ranurada con tapa", modelo:`Canaleta ${d.nombre}`, dim:`${Math.round(d.orient==="h" ? d.w : d.h)} mm de largo` };
  }
  { // rieles DIN TS35 × 7,5 (perfil sombrero): alma, alas y pestañas, todos en una malla instanciada
    const L = lote(), mr = metal(colorDe(apariencia(null, "riel"), "cuerpo")), mo = mat(0x6b7079);
    for(const r of m.rieles){ L.box(r.x, r.y - 13.5, 25, r.w, 27, 1, mr); L.box(r.x, r.y + 12.5, 25, r.w, 1, 7.5, mr); L.box(r.x, r.y - 13.5, 25, r.w, 1, 7.5, mr);
      L.box(r.x, r.y + 12.5, 31.5, r.w, 5, 1, mr); L.box(r.x, r.y - 17.5, 31.5, r.w, 5, 1, mr);
      for(let xx = r.x + 10; xx < r.x + r.w - 15; xx += 25) L.box(xx, r.y - 2.6, 25.6, 15, 5.2, 0.6, mo); }
    L.fin(capas.interior);
  }
  if(m.zonaAcom){ const z = m.zonaAcom; caja(z.x, z.y, 25, z.w, z.h, 2, mat(0xf5c518, { transparent:true, opacity:0.18, depthWrite:false }), capas.cables, null, false); }

  // ===== barras, aisladores y pletinas =====
  for(const b of m.barras){
    const pe = b.fase==="PE";
    const g = caja(b.x, b.y, pe ? 30 : 95, b.w, b.h, pe ? (b.h > 20 ? 5 : 3) : m.fase.espesor || 5, mat(pe ? 0x2e9e4f : 0xc8783a, { metalness:0.75, roughness:0.3 }));
    g.userData.info = { tag:b.tag, desc: pe ? "Barra de tierra de protección" : `Barra de fase ${b.fase}`, modelo:`Barra Cu ${b.nombre} mm`, dim:`${Math.round(b.w)} mm` };
    if(!pe) etiqueta(b.fase, b.x - 20, b.y + b.h/2, 100, "v3d-tag-chico");
  }
  for(const a of m.aisladores){ caja(a.x - 20, a.y0 - m.fase.ancho/2 - 18, 25, 40, (a.y1 - a.y0) + m.fase.ancho + 36, 12, mat(0x4b4f56)); for(let i=0;i<3;i++) cil(a.x, a.y0 + i*m.fase.paso, 60, 12, 70, 0xa0362c, capas.interior, "z"); }

  // ===== equipos =====
  const piezas = [];
  for(const c of m.comps){
    const z0 = c.z0 ?? (c.montaje==="din" || c.montaje==="contactor" ? 32 : 25);
    const inf = { tag:c.tag, desc:c.desc, modelo:c.modelo, dim:`${r1(c.w)} × ${r1(c.h)} × ${r1(c.d||0)} mm`, montaje:c.montaje, fuente:c.fuente, val:c.val };
    const G = new THREE.Group(); capas.interior.add(G);
    const ap = apariencia(c);
    if(ap){ inf.aspecto = ap.marca ? `${ap.marca} — ${ap.nombre}` : ap.nombre; equipo(c, ap, G, z0, inf); }
    else cuerpo(G, c.x, c.y, z0, c.w, c.h, c.d || 60, plas(c.color || COL_TIPO[c.tipo] || 0xdddddd), 1, inf, []);
    G.userData.base = G.position.clone(); G.userData.comp = c;
    piezas.push(G);
    if(c.tag) etiqueta(c.tag, c.x + c.w/2, c.y + c.h + 10, z0 + (c.d||60), c.tipo==="variador" || c.tipo==="interruptor" || c.tipo==="cpu" ? "" : "v3d-tag-chico");
  }
  // bornes: una bornera = un grupo con sus piezas instanciadas (cuerpo, marcador, tornillos, topes)
  for(const b of m.bornes){ const G = new THREE.Group(); capas.interior.add(G); bornera(b, G); G.userData.base = G.position.clone(); G.userData.comp = { d:50 }; piezas.push(G); etiqueta(b.grupo, (b.x0 + b.x1)/2, b.y + 45, 90, "v3d-tag-chico"); }

  // ===== cableado de fuerza =====
  for(const cx of m.conexiones){
    if(cx.tipo==="pletina"){ const [a, b] = cx.pts; const y0 = Math.min(a[1], b[1]), h = Math.abs(a[1] - b[1]); caja(a[0] - 10, y0, 92, 20, h, 4, mat(0xc8783a, { metalness:0.75, roughness:0.3 }), capas.cables, null, false); continue; }
    const z = cx.tipo==="acometida" ? 60 : 130 + (cx.fase==="L2"||cx.fase==="V" ? 6 : cx.fase==="L3"||cx.fase==="W" ? 12 : 0);
    const pts = cx.pts.map(q=>new THREE.Vector3(q[0]*k, q[1]*k, z*k));
    if(pts.length < 2) continue;
    const curva = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.05);
    const r = cx.tipo==="acometida" ? 9 : cx.fase==="L1-L2-L3" ? 4 : 5;
    const tubo = new THREE.Mesh(new THREE.TubeGeometry(curva, Math.max(8, pts.length*12), r*k, 8, false), mat(FASE[cx.fase] || 0x333333, { roughness:0.7 }));
    tubo.castShadow = true; capas.cables.add(tubo);
  }
  // ===== puertas (con bisagra) y sus dispositivos =====
  const hojas = [];
  for(const s of m.secciones){
    const defs = s.puertas===2 ? [[s.x0 + 3, (s.x0 + s.x1)/2 - 1.5, "izq"], [(s.x0 + s.x1)/2 + 1.5, s.x1 - 3, "der"]] : [[s.x0 + 3, s.x1 - 3, s.bisagra]];
    for(const [x0, x1, bis] of defs){
      const piv = new THREE.Group(); const xp = bis==="izq" ? x0 : x1;
      piv.position.set(xp*k, 0, D*k); raiz.add(piv);
      const pg = new THREE.Group(); piv.add(pg); pg.position.set(-xp*k, 0, -D*k);
      const hoja = caja(x0, 3, D, x1 - x0, H - 6, 20, mat(RAL7035, { roughness:0.5 }), pg);
      hoja.userData.info = { tag:s.id, desc:`Puerta de la sección ${s.id.slice(1)} (${s.rol==="potencia" ? "fuerza" : s.rol==="control" ? "control" : "fuerza y control"})`, modelo:"Plancha de acero, RAL 7035", dim:`${r1(x1 - x0)} × ${r1(H - 6)} mm` };
      const xm = bis==="izq" ? x1 - 45 : x0 + 25; caja(xm, m.manijaY ?? 900, D + 20, 20, 160, 30, mat(0x2b2f36), pg);
      hojas.push({ piv, bis, x0, x1, abierto:0, objetivo:0, grupo:pg });
    }
  }
  const hojaDe = x => hojas.find(h=>x >= h.x0 - 1 && x <= h.x1 + 1) || hojas[0];
  for(const d of m.puerta){
    const h = hojaDe(d.x), g = h.grupo, z = D + 20;
    const ap = apariencia(d) || { col:{} }, cc = (v, def) => colorDe(ap, v, def);
    const L = lote();
    let obj;
    if(d.tipo==="manija"){   // mando rotativo en puerta: placa amarilla, manija roja con bloqueo
      obj = caja(d.x - d.w/2, d.y - d.h/2, z, d.w, d.h, 6, plas(cc("cuerpo", "#f5c518")), g);
      L.cil(d.x, d.y, z + 6, 34, 4, plas(cc("base", "#2b2e33")));
      const p2 = caja(d.x - 9, d.y - 42, z + 10, 18, 84, 25, plas(cc("palanca", "#d2312b")), g); p2.userData.info = { tag:"Q1", desc:d.desc, modelo:d.modelo };
      L.cil(d.x, d.y, z + 10, 16, 18, plas(cc("palanca", "#d2312b")));
      for(const a of [0, 1]) L.boxC(d.x - 26 + a*52, d.y + 30, z + 6, 3, 9, 1, plas(0x17181b));
    }
    else if(d.tipo==="panelvfd"){   // panel de operador: marco, pantalla y teclado
      obj = caja(d.x - d.w/2, d.y - d.h/2, z, d.w, d.h, 18, plas(cc("cuerpo", "#2b2e33")), g);
      L.box(d.x - d.w/2 + 6, d.y - d.h/2 + 6, z + 18, d.w - 12, d.h - 12, 1, plas(cc("marco", "#3a3e44")));
      L.box(d.x - d.w/2 + 12, d.y + d.h*0.08, z + 19, d.w - 24, d.h*0.32, 0.6, matPantalla);
      for(let r=0;r<4;r++) for(let q=0;q<3;q++) L.boxC(d.x - 22 + q*22, d.y - d.h*0.06 - r*15, z + 19, 15, 9, 2.4, plas(r===3 && q!==1 ? (q ? 0xd2312b : 0x2e9e4f) : cc("teclas", "#4a4f57")));
    }
    else if(d.tipo==="ventilador" || d.tipo==="rejilla"){   // ventilador con filtro: marco, persiana y estera filtrante
      obj = caja(d.x - d.w/2, d.y - d.h/2, z, d.w, d.h, 10, plas(cc("cuerpo", "#cfd1ce")), g);
      const i = d.w*0.09; L.box(d.x - d.w/2 + i, d.y - d.h/2 + i, z + 4, d.w - 2*i, d.h - 2*i, 6.5, plas(cc("filtro", "#e9e7df")));
      for(let yy = d.y - d.h/2 + i + 6; yy < d.y + d.h/2 - i - 4; yy += 11) L.box(d.x - d.w/2 + i, yy, z + 10, d.w - 2*i, 4.5, 4, plas(cc("persiana", "#b9bcb8")), { rx:-0.5 });
    }
    else if(d.tipo==="aa"){ obj = caja(d.x - d.w/2, d.y - d.h/2, z, d.w, d.h, 160, plas(cc("cuerpo", "#e9eaec")), g); for(let yy = d.y - d.h/2 + 40; yy < d.y - d.h*0.05; yy += 16) L.box(d.x - d.w/2 + 30, yy, z + 160, d.w - 60, 6, 2, plas(cc("rejilla", "#9aa0a8"))); L.box(d.x - 60, d.y + d.h/2 - 120, z + 160, 120, 50, 2, plas(cc("panel", "#2b2e33"))); }
    else if(d.tipo==="hmi"){   // pantalla: marco frontal, pantalla encendida y cuerpo hacia el interior (atraviesa la puerta)
      obj = caja(d.x - d.w/2, d.y - d.h/2, z, d.w, d.h, 8, plas(cc("cuerpo", "#2b2f36")), g);
      L.box(d.x - d.w/2 + 12, d.y - d.h/2 + 22, z + 8, d.w - 24, d.h - 34, 0.8, matPantalla);
      L.box(d.x - d.w/2 + 4, d.y - d.h/2 + 4, z + 8, d.w - 8, 12, 0.6, plas(cc("marco", "#3a3e44")));
      if(ap.col.marca) L.box(d.x - d.w/2 + 10, d.y - d.h/2 + 8, z + 8.6, 26, 4, 0.4, plas(cc("marca")));
      L.cil(d.x + d.w/2 - 10, d.y - d.h/2 + 10, z + 8, 1.6, 0.8, luz(0x2fd05a));
      caja(d.x - d.recorteW/2 + 8, d.y - d.recorteH/2 + 8, D - d.prof, d.recorteW - 16, d.recorteH - 16, d.prof, mat(0x3b3f46), g);
    }
    else {
      const cMap = { verde:0x2e9e4f, rojo:0xd2312b, ambar:0xf5a623, azul:0x2b6cb0, negro:0x1c1c1c, amarillo:0xf5c518, blanco:0xf4f5f6 };
      const colD = cMap[d.color] || 0x1c1c1c;
      if(d.tipo==="seta"){ obj = cil(d.x, d.y, z + 3, 30, 6, plas(cc("anilloSeta", "#f5c518")), g, "z"); L.cil(d.x, d.y, z + 6, 14, 14, metal(cc("anillo", "#d8dbde"))); const hg = cil(d.x, d.y, z + 26, 20, 14, plas(cc("seta", "#d2312b")), g, "z"); hg.userData.info = { tag:d.tag, desc:d.desc, modelo:d.modelo }; L.cil(d.x, d.y, z + 30, 15, 6, plas(cc("seta", "#d2312b"))); }
      else {
        obj = cil(d.x, d.y, z + 2, 15, 4, plas(cc("base", "#1d1e21")), g, "z");      // collarín
        L.cil(d.x, d.y, z + 4, 14, 5, metal(cc("anillo", "#d8dbde")));                   // anillo frontal cromado
        if(d.tipo==="luz"){ L.cil(d.x, d.y, z + 9, 11, 3, luz(colD, colD)); }
        else if(d.tipo==="selector"){ L.cil(d.x, d.y, z + 9, 11.5, 3, plas(0x1d1e21)); L.boxC(d.x, d.y, z + 12, 5, 20, 9, plas(colD===0x1c1c1c ? 0x26282c : colD), { rz:-0.5 }); }
        else if(d.tipo==="potenciometro"){ L.cil(d.x, d.y, z + 9, 12, 3, plas(0x26282c)); L.cil(d.x, d.y, z + 12, 9, 8, plas(0x1d1e21)); L.boxC(d.x, d.y + 5, z + 20, 1.5, 6, 0.6, plas(0xf4f5f6)); }
        else { L.cil(d.x, d.y, z + 9, 11, 3.5, plas(colD)); }                            // pulsador rasante
        if(d.leyenda){ const pl = C.PUERTA.placa; L.box(d.x - pl.w/2, d.y + 21, z, pl.w, pl.h, 1.5, plas(cc("leyenda", "#f4f5f6"))); L.box(d.x - pl.w/2 + 6, d.y + 21 + pl.h/2 - 1, z + 1.5, pl.w - 12, 2, 0.2, plas(0x2b2e33)); }
        obj.userData.info = { tag:d.tag, desc:d.desc, modelo:(C.PUERTA[d.tipo]||{}).modelo || "" };
      }
    }
    L.fin(g);
    if(obj) obj.userData.info = { tag:d.tag, desc:d.desc || d.leyenda, modelo:d.modelo || (C.PUERTA[d.tipo]||{}).modelo || "", dim: d.w ? `${d.w} × ${d.h} mm` : "", fuente: ap.fuente };
  }
  // placa de identificación
  { const s1 = m.secciones[0], cx = m.placaX ?? (s1.x0 + s1.x1)/2, h = hojaDe(cx); caja(cx - 150, H - 170, D + 20, 300, 90, 2, metal(0xc9ced4), h.grupo); }
  // capa de dispositivos de puerta = todo lo que cuelga de las puertas menos la hoja
  const ocultarPuertas = v => hojas.forEach(h=>h.grupo.children.forEach((ch, i)=>{ if(i>0) ch.visible = v; }));

  /* ---------- equipo con la apariencia de su familia ---------- */
  function equipo(c, ap, G, z0, inf){
    const d = c.d || 60, zf = z0 + d, { y, h } = c, reg = regiones(c, ap), x = reg.x, w = reg.w;
    const col = (v, def) => colorDe(ap, v, def);
    const pf = ap.perfil && ap.perfil.tipo==="modular" ? ap.perfil : null;
    const zh = pf ? z0 + d*pf.hombro : zf;
    const enNariz = yf => !pf || Math.abs(yf - pf.ny) <= pf.nariz/2 + 1e-6;
    const zCara = yf => enNariz(yf) ? zf : zh;
    const lista = [], L = lote(), mCuerpo = plas(col("cuerpo", COL_TIPO[c.tipo] || "#dddddd"));
    const b = ap.bisel ?? 1;
    // ---- carcasa
    if(c.tipo==="reactancia") return reactancia(c, ap, G, z0, inf, L, lista);
    if(c.tipo==="trafo") return trafo(c, ap, G, z0, inf, L, lista);
    if(c.tipo==="luminaria"){ cuerpo(G, c.x, c.y, z0, c.w, c.h, d, mCuerpo, b, inf, lista); L.box(c.x + 6, c.y - 0.6, z0 + 4, c.w - 12, 1, d - 8, luz(col("difusor", "#fff7d6"), 0xfff1c0)); L.fin(G); return; }
    if(c.tipo==="peine"){ cuerpo(G, c.x, c.y, z0, c.w, c.h, d, metal(col("cuerpo")), 0.5, inf, lista); L.fin(G); return; }
    if(pf){ cuerpo(G, x, y, z0, w, h, d*pf.hombro, mCuerpo, b, inf, lista); cuerpo(G, x, y + h*(pf.ny - pf.nariz/2), z0, w, h*pf.nariz, d, mCuerpo, b*1.2, inf, lista); }
    else cuerpo(G, x, y, z0, w, h, d, mCuerpo, b, inf, lista);
    if(reg.lateral){ const l = reg.lateral; cuerpo(G, l.x, y + h*0.12, z0, l.w, h*0.76, d*0.86, plas(col(l.color)), 0.8, inf, lista); L.box(l.x + l.w*0.2, y + h*0.7, z0 + d*0.86, l.w*0.6, 3, 0.4, plas(0xf4f5f6)); }
    // ---- rasgos del frente
    const np = polosDe(c), pw = w/np;
    const reps = r => r.por==="polo" ? Array.from({ length:np }, (_, i)=>i) : [null];
    const X = (r, i) => i==null ? x + r.x*w : x + (i + r.x)*pw;     // centro en x
    const WW = (r, i) => i==null ? (r.w ?? 0.8)*w : (r.w ?? 0.8)*pw;  // ancho
    // los rasgos se apilan: lo que va sobre un panel, bloque o tapa ya dibujado queda encima de él
    const elev = [];
    const zEn = (cx, cy, zb) => { let z = zb; for(const e of elev) if(cx >= e.x0 - 1e-6 && cx <= e.x1 + 1e-6 && cy >= e.y0 - 1e-6 && cy <= e.y1 + 1e-6) z = Math.max(z, e.z); return z; };
    const sube = (cx, cy, ww, hh, zTop) => elev.push({ x0:cx - ww/2, x1:cx + ww/2, y0:cy - hh/2, y1:cy + hh/2, z:zTop });
    for(const r of rasgosDe(c, ap)){
      const ry = r.y ?? 0.5, cy = y + ry*h, hh = (r.h ?? 0.1)*h, cr = r.color ? col(r.color) : null;
      const zA = cx => zEn(cx, cy, zCara(ry));
      switch(r.t){
        case "palanca": {
          let zt = 0;
          for(const i of reps(r)){ const cx = X(r, i), ww = WW(r, i), z = zA(cx); zt = z;
            L.boxC(cx, cy, z - 0.3, ww*1.35, hh*1.5, 0.8, plas(NEGRO));                                       // ranura
            L.boxC(cx, cy + hh*0.12, z, ww, hh, r.sal || 8, plas(cr), { rx:-0.32 });                       // palanca levantada (ON)
          }
          if(r.unida && r.por==="polo" && np > 1) L.boxC(x + w/2, cy + hh*0.42, zt + (r.sal || 8)*0.85, (np - 1)*pw + WW(r, 0), hh*0.22, 2.2, plas(cr));
          break; }
        case "perilla": {
          const rr = (r.r ?? 0.25)*w, cx = X(r, null), sal = r.sal || 10, z = zA(cx);
          L.cil(cx, cy, z, rr*1.12, 1.6, plas(0x5b6068)); L.cil(cx, cy, z + 1.6, rr, sal*0.45, plas(cr));
          L.boxC(cx, cy, z + 1.6, rr*0.55, rr*1.9, sal, plas(cr));                                          // empuñadura (posición ON)
          if(r.flecha) L.boxC(cx, cy + rr*0.55, z + 1.6 + sal, rr*0.16, rr*0.6, 0.3, plas(0xf4f5f6));
          break; }
        case "dial": { const rr = (r.r ?? 0.1)*w, cx = X(r, null), z = zA(cx); L.cil(cx, cy, z, rr, 1.6, plas(cr ?? 0xf4f5f6)); L.boxC(cx + rr*0.25, cy + rr*0.25, z + 1.6, rr*0.18, rr*1.1, 0.3, plas(0x2b2e33), { rz:-0.75 }); break; }
        case "boton": { const rr = (r.r ?? 0.06)*w, cx = X(r, null), z = zA(cx); L.cil(cx, cy, z, rr*1.3, 0.8, plas(0x4a4f57)); L.cil(cx, cy, z + 0.8, rr, r.sal || 2.5, plas(cr)); break; }
        case "led": { const n = r.n || 1, rr = r.r || 1.2;
          for(let i=0;i<n;i++){ const yi = ry + i*(r.dy||0), lx = x + (r.x + i*(r.dx||0))*w, ly = y + yi*h; L.cil(lx, ly, zEn(lx, ly, zCara(yi)), rr, 1.1, luz(cr)); }
          break; }
        case "display": { const ww = (r.w ?? 0.5)*w, cx = X(r, null), z = zA(cx);
          L.boxC(cx, cy, z, ww + 2, hh + 2, 0.5, plas(NEGRO));
          L.boxC(cx, cy, z + 0.5, ww, hh, 0.3, r.luz && r.luz!=="#000000" ? (ww > 30 && hh > 16 ? matPantalla : luz(cr, colorDe(ap, r.luz))) : plas(cr));
          sube(cx, cy, ww + 2, hh + 2, z + 0.8); break; }
        case "teclado": { const ww = (r.w ?? 0.5)*w, cx = X(r, null), f = r.filas || 1, q = r.cols || 3, z = zA(cx);
          for(let a=0;a<f;a++) for(let bq=0;bq<q;bq++) L.boxC(cx - ww/2 + (bq + 0.5)*ww/q, cy + hh/2 - (a + 0.5)*hh/f, z, ww/q*0.68, hh/f*0.62, 1.6, plas(cr ?? 0x4a4f57));
          break; }
        case "ventana": case "etiqueta": case "franja": case "placa": {
          const colR = r.t==="franja" && r.color==="io" ? colorDe(null, COLOR_IO[c.io] || "#8a8f96") : r.t==="placa" ? null : (cr ?? colorDe(ap, r.t==="etiqueta" ? "#eef0ed" : "#9fb4c2"));
          const mR = r.t==="placa" ? metal(0xc3c8ce) : r.transp ? vidrio(colR) : plas(colR);
          for(const i of reps(r)){ const ww = i==null ? (r.w ?? 0.86)*w : WW(r, i), cx = X(Object.assign({ x:0.5 }, r), i), z = zA(cx), e = r.transp ? 1.2 : 0.35; L.boxC(cx, cy, z, ww, hh, e, mR); sube(cx, cy, ww, hh, z + e); }
          break; }
        case "rebaje": case "tapa": case "bloque": case "conector": {
          for(const i of reps(r)){
            const cx = X(Object.assign({ x:0.5 }, r), i), ww = i==null ? (r.w ?? (r.t==="bloque" ? 0.8 : 0.9))*w : WW(r, i), z = zA(cx), sal = r.sal || (r.t==="conector" ? 4 : r.t==="bloque" ? 4 : 1.5);
            L.boxC(cx, cy, z, ww, hh, sal, r.transp ? vidrio(cr) : plas(cr ?? (r.t==="conector" ? 0x1a1b1e : 0x3a3e44)));
            if(r.t==="tapa") L.boxC(cx, cy + hh/2 - 2, z + sal, ww*0.4, 1.4, 0.6, plas(0x5b6068));        // uñero de la tapa
            if(r.t==="conector"){ const n = r.n || 8, q = r.cols || 1, f = Math.ceil(n/q), ph = hh/f, pq = ww/q;
              for(let a=0;a<f;a++) for(let bq=0;bq<q;bq++){ const px = cx - ww/2 + (bq + 0.5)*pq, py = cy + hh/2 - (a + 0.5)*ph;
                L.boxC(px, py - ph*0.18, z + sal, Math.min(pq*0.55, 4), Math.min(ph*0.32, 3), 0.3, plas(NEGRO));
                L.cil(px, py + ph*0.16, z + sal - 0.2, Math.min(pq*0.24, ph*0.24, 1.8), 0.6, metal(0xb9bec4)); } }
            sube(cx, cy, ww, hh, z + sal);
          }
          break; }
        case "rejilla": { const ww = (r.w ?? 0.7)*w, n = r.n || 6, cx = X(r, null), paso = hh/n, z = zA(cx);
          for(let i=0;i<n;i++) L.boxC(cx, cy - hh/2 + (i + 0.5)*paso, z, ww, Math.max(0.8, paso*0.45), 0.5, plas(cr ?? 0x2b2e33));
          break; }
        case "puertos": { const ww = (r.w ?? 0.7)*w, n = r.n || 1, f = r.filas || 1, cx = X(r, null), z = zA(cx);
          const pwp = Math.min(ww/n*0.85, 14), php = Math.min(hh/f*0.8, 12);
          for(let a=0;a<f;a++) for(let q=0;q<n;q++){ const px = cx - ww/2 + (q + 0.5)*ww/n, py = cy + hh/2 - (a + 0.5)*hh/f;
            L.boxC(px, py, z, pwp, php, 1.2, metal(cr ?? 0xa7acb2)); L.boxC(px, py - php*0.06, z + 1.2, pwp*0.72, php*0.6, 0.2, plas(NEGRO)); L.cil(px + pwp*0.3, py + php*0.38, z + 1.2, 0.6, 0.4, luz(0x2fd05a)); }
          break; }
        case "bornes": bornes(c, ap, r, L, x, w, y, h, z0, d, pf, zh, zf); break;
        case "aletas": aletas(c, ap, r, L, x, w, y, h, z0, d, zf, cr); break;
        case "antenas": { const n = r.n || 2; for(let i=0;i<n;i++){ const ax = x + w*(i + 0.5)/n; L.cilY(ax, y + h, z0 + d*0.5, 3.2, 9, metal(cr ?? 0xc9a227)); L.cilY(ax, y + h + 9, z0 + d*0.5, 2.2, 3, metal(0xd8dbde)); } break; }
      }
    }
    L.fin(G);
  }
  /* bornes de conexión del equipo: tornillo (abertura + cabeza), resorte (pulsador) o pletina (lug) */
  function bornes(c, ap, r, L, x, w, y, h, z0, d, pf, zh, zf){
    const n = cuenta(r.n, c), lados = r.lado==="ambos" ? ["arriba", "abajo"] : [r.lado || "ambos"];
    const mB = r.forma==="lug" ? metal(colorDe(ap, r.color || "bornes", "#c58a4a")) : metal(colorDe(ap, r.color || "bornes", "#b9bec4"));
    const paso = w/n;
    for(const lado of lados){
      const sup = lado==="arriba";
      let yf = r.y ?? (pf ? (sup ? (1 + pf.ny + pf.nariz/2)/2 : (pf.ny - pf.nariz/2)/2) : (sup ? 0.92 : 0.08));
      if(r.y!=null && r.lado==="ambos") yf = sup ? r.y : 1 - r.y;
      const by = y + yf*h, z = pf && Math.abs(yf - pf.ny) > pf.nariz/2 ? zh : zf;
      for(let i=0;i<n;i++){ const bx = x + (i + 0.5)*paso;
        if(r.forma==="lug"){
          const lw = Math.min(paso*0.5, 40), lh = Math.min(h*0.09, 26);
          L.boxC(bx, by, z - 2, paso*0.86, lh*1.5, 2.6, plas(0x26282c));                         // cubrebornes
          L.boxC(bx, by, z, lw, lh, 5, mB); L.cil(bx, by, z + 5, Math.min(lw, lh)*0.22, 2.5, metal(0xd8dbde));
        } else {
          const ow = Math.min(paso*0.62, 8.5), oh = Math.min(h*0.085, 7.5), rs = Math.min(ow, oh)*0.36;
          L.boxC(bx, by, z - 0.2, ow, oh, 0.6, plas(NEGRO));
          if(r.forma==="resorte") L.boxC(bx, by + oh*0.75, z, ow*0.7, oh*0.5, 1.4, plas(colorDe(ap, "#f08a24")));
          else { L.cil(bx, by, z - 0.4, rs, 1.2, mB); L.boxC(bx, by, z + 0.75, rs*1.7, rs*0.32, 0.2, plas(0x3b3f46), { rz:0.6 }); }
        }
      }
    }
  }
  /* aletas del disipador (variadores, resistencias) */
  function aletas(c, ap, r, L, x, w, y, h, z0, d, zf, cr){
    const mA = metal(cr ?? 0x6e747c), n = r.n || 8;
    if(r.lado==="lados"){ const zz = d*0.55; for(let i=0;i<n;i++){ const z = z0 + 3 + i*(zz - 3)/(n - 1 || 1); L.box(x - 5, y + h*0.04, z, 5, h*0.92, 1.6, mA); L.box(x + w, y + h*0.04, z, 5, h*0.92, 1.6, mA); } }
    else if(r.lado==="arriba"){ for(let i=0;i<n;i++) L.box(x + w*0.1 + i*(w*0.8)/(n - 1 || 1) - 1.5, y + h - 0.2, z0 + d*0.35, 3, 0.6, d*0.55, plas(0x1d1f22)); }
    else { for(let i=0;i<n;i++) L.box(x + w*(i + 0.5)/n - 1.1, y + h*0.14, zf - 1, 2.2, h*0.76, 7, mA); }
  }
  /* reactancia trifásica: núcleo laminado, tres bobinas de cobre, soportes y bornera arriba */
  function reactancia(c, ap, G, z0, inf, L, lista){
    const { x, y, w, h } = c, d = c.d || 100, col = v => colorDe(ap, v), mN = mat(col("cuerpo"), { roughness:0.45, metalness:0.5 });
    const zc = z0 + d/2, rB = Math.min(w/6.6, d*0.42);
    cuerpo(G, x, y, z0, w, h*0.05, d, metal(col("soporte")), 1, inf, lista);                               // base / pies
    cuerpo(G, x + w*0.04, y + h*0.05, zc - d*0.22, w*0.92, h*0.14, d*0.44, mN, 1, inf, lista);              // yugo inferior
    cuerpo(G, x + w*0.04, y + h*0.72, zc - d*0.22, w*0.92, h*0.14, d*0.44, mN, 1, inf, lista);              // yugo superior
    for(let i=0;i<3;i++){ const cx = x + w*(i + 0.5)/3;
      L.cilY(cx, y + h*0.2, zc, rB, h*0.51, mat(col("bobina"), { roughness:0.35, metalness:0.65 }));
      for(const yy of [0.19, 0.69]) L.cilY(cx, y + h*yy, zc, rB*1.04, h*0.035, plas(col("aislante"))); }
    for(const yy of [0.06, 0.73]) for(const s of [-1, 1]) L.box(x + w*0.04, y + h*yy, zc + s*d*0.22 - (s > 0 ? 0 : 2), w*0.92, h*0.12, 2, metal(col("soporte")));
    L.box(x + w*0.08, y + h*0.87, zc - 10, w*0.84, h*0.07, 20, plas(0x2b2e33));                               // bornera
    for(let i=0;i<6;i++){ const bx = x + w*(0.14 + i*0.144); L.boxC(bx, y + h*0.905, zc + 10, Math.min(16, w/10), h*0.05, 3, metal(col("bornes"))); L.cil(bx, y + h*0.905, zc + 13, 2.6, 2, metal(0xd8dbde)); }
    L.fin(G);
  }
  /* transformador de control: núcleo E-I, bobina con cinta, soportes y bornera frontal */
  function trafo(c, ap, G, z0, inf, L, lista){
    const { x, y, w, h } = c, d = c.d || 80, col = v => colorDe(ap, v), mN = mat(col("cuerpo"), { roughness:0.45, metalness:0.5 });
    cuerpo(G, x, y, z0, w, h*0.06, d, metal(col("soporte")), 0.8, inf, lista);
    cuerpo(G, x + w*0.04, y + h*0.06, z0 + d*0.08, w*0.92, h*0.72, d*0.62, mN, 0.8, inf, lista);
    cuerpo(G, x + w*0.2, y + h*0.12, z0 + d*0.02, w*0.6, h*0.6, d*0.96, plas(col("bobina")), 2.5, inf, lista);
    for(const s of [0, 1]) L.box(x + (s ? w - 4 : 0), y, z0, 4, h*0.8, d*0.8, metal(col("soporte")));
    L.box(x + w*0.1, y + h*0.8, z0 + d*0.55, w*0.8, h*0.16, d*0.4, plas(col("bornes")));
    const n = 5; for(let i=0;i<n;i++){ const bx = x + w*(0.16 + i*0.68/(n - 1)); L.boxC(bx, y + h*0.88, z0 + d*0.95, Math.min(7, w/9), h*0.08, 0.6, plas(NEGRO)); L.cil(bx, y + h*0.88, z0 + d*0.95 - 0.4, Math.min(2.4, w/22), 1.2, metal(0xb9bec4)); }
    L.fin(G);
  }
  /* bornera: cada borne con su cuerpo escalonado, canal de marcado, tornillos o resortes; topes y tapa final */
  function bornera(b, G){
    const L = lote();
    let hb = 0;
    for(const x of b.bornes){
      const ap = aparienciaBorne(x.modelo), col = (v, def) => colorDe(ap, v, def);
      const inf = { tag:`${b.grupo}:${x.n}`, desc:b.desc, modelo:x.modelo, dim:`${x.w} × ${x.h} × ${x.d} mm`, fuente:ap && ap.fuente, aspecto:ap && ap.nombre };
      const ww = x.w - 0.35, zb = 32, d = x.d, h = x.h; hb = Math.max(hb, h);
      const neutro = x.fun==="N" && /^UT|^PT/i.test(x.modelo);
      const cBase = x.pe ? col("pe", "#3f9a3f") : neutro ? col("neutro", "#2f73b5") : col("cuerpo", x.color ? "#" + x.color.toString(16).padStart(6, "0") : "#9ea3a6");
      const cRiel = x.pe ? col("pe2", "#e3c62a") : cBase;
      L.box(x.x, b.y - h/2, zb, ww, h, d*0.66, plas(cBase), { info:inf });                                  // cuerpo (seleccionable)
      L.box(x.x, b.y - h*0.2, zb + d*0.66, ww, h*0.4, d*0.34, plas(cRiel), { info:inf });                   // cresta central
      L.box(x.x + ww*0.12, b.y - h*0.07, zb + d - 0.1, ww*0.76, h*0.14, 0.8, plas(col("marcador", "#f4f5f2")), { info:inf }); // marcador
      const forma = ap ? ap.forma : "tornillo";
      for(const s of [1, -1]){ const yy = b.y + s*h*0.33, zz = zb + d*0.66;
        L.boxC(x.x + ww/2, yy, zz - 0.2, ww*0.62, 4, 0.6, plas(NEGRO));
        if(forma==="resorte") L.boxC(x.x + ww/2, yy + s*3.6, zz, ww*0.55, 2.8, 1.8, plas(col("bornes", "#f08a24")));
        else L.cil(x.x + ww/2, yy, zz - 0.4, Math.min(ww*0.3, 2.3), 1.2, metal(col("bornes", "#b9bec4")));
      }
      if(forma==="fusible"){ L.box(x.x + ww*0.1, b.y - h*0.18, zb + d, ww*0.8, h*0.36, 9, plas(col("palanca", "#1a1b1e"))); L.cil(x.x + ww/2, b.y + h*0.12, zb + d + 9, 1, 0.6, luz(0xd2312b)); }
    }
    if(b.bornes.length){ const ult = b.bornes[b.bornes.length - 1], d = ult.d;
      L.box(ult.x + ult.w, b.y - ult.h/2, 32, C.TAPA_FINAL, ult.h, d*0.66, plas(colorDe(aparienciaBorne(ult.modelo), "cuerpo", "#9ea3a6")));
      for(const xs of [b.x0, b.x1 - C.TOPE]){ L.box(xs, b.y - hb*0.3, 32, C.TOPE - 0.4, hb*0.6, d*0.8, plas(0x3b3f46)); L.cil(xs + C.TOPE/2, b.y + hb*0.18, 32 + d*0.8, 2, 1, metal(0xb9bec4)); }
    }
    L.fin(G);
  }

  // ===== cámara y vistas =====
  const centro = new THREE.Vector3(0, (H/2 - zocalo/2)*k, 0);
  const vistas = { iso:[0.8, 0.5, 1.55], frente:[0, 0, 2.2], lateral:[2.2, 0, 0], planta:[0, 2.4, 0.01], atras:[-0.4, 0.4, -2] };
  // en pantallas angostas (celular) la cámara se aleja para que entre todo el ancho del tablero
  const fz = () => Math.max(1, 1.35/Math.max(0.2, W0()/H0()));
  const irA = (nombre)=>{ const v = vistas[nombre], f = R*fz(); const destino = new THREE.Vector3(v[0]*f, v[1]*f, v[2]*f).add(centro); anim = { desde:camara.position.clone(), hasta:destino, t:0, objetivo:centro.clone() }; cont.querySelectorAll("[data-v]").forEach(b=>b.classList.toggle("activo", b.dataset.v===nombre)); };
  camara.position.set(vistas.iso[0]*R*fz(), vistas.iso[1]*R*fz(), vistas.iso[2]*R*fz()).add(centro);
  ctrl.target.copy(centro); ctrl.update();
  let anim = null, explosion = 0, explObj = 0;

  // ===== selección =====
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let sel = [];
  const limpiarSel = () => { redibujar(); for(const s of sel){ if(s.inst){ s.inst.setColorAt(s.id, BLANCO); s.inst.instanceColor.needsUpdate = true; } else { s.mesh.material.dispose(); s.mesh.material = s.mat; } } sel = []; };
  const seleccionar = hit => {
    limpiarSel();
    if(!hit){ info.hidden = true; return; }
    const obj = hit.object; let d;
    if(obj.isInstancedMesh && obj.userData.infos && hit.instanceId!=null){
      // borne: se resaltan todas sus piezas (cuerpo, cresta y marcador) en las mallas instanciadas de su bornera
      d = obj.userData.infos[hit.instanceId] || {};
      for(const im of (obj.parent ? obj.parent.children : [obj])) if(im.isInstancedMesh && im.userData.infos){ let n = 0; im.userData.infos.forEach((x, i)=>{ if(x===d){ im.setColorAt(i, RESALTE); sel.push({ inst:im, id:i }); n++; } }); if(n) im.instanceColor.needsUpdate = true; } }
    else { d = obj.userData.info || {}; for(const ms of obj.userData.hermanos || [obj]){ sel.push({ mesh:ms, mat:ms.material }); ms.material = ms.material.clone(); ms.material.emissive = new THREE.Color(0xf5c518); ms.material.emissiveIntensity = 0.45; } }
    info.hidden = false;
    info.innerHTML = `<button class="v3d-x" aria-label="Cerrar">×</button><div class="v3d-tagsel">${esc(d.tag||"—")}</div><div class="v3d-desc">${esc(d.desc||"")}</div>
      ${d.modelo ? `<div><span>Modelo</span>${esc(d.modelo)}</div>` : ""}${d.val ? `<div><span>Valor</span>${esc(d.val)}</div>` : ""}${d.dim ? `<div><span>Dimensiones</span>${esc(d.dim)}</div>` : ""}
      ${d.montaje ? `<div><span>Montaje</span>${esc({ din:"Riel DIN", placa:"Placa de montaje", base:"Base del gabinete", contactor:"Bajo el contactor" }[d.montaje]||d.montaje)}</div>` : ""}
      ${d.aspecto ? `<div><span>Familia</span>${esc(d.aspecto)}</div>` : ""}
      ${d.fuente ? `<div class="v3d-fuente">${esc(d.fuente)}</div>` : ""}
      ${o.copito ? `<button class="btn-accent btn-sm v3d-copito">Pedir un cambio a Copito</button>` : ""}`;
    info.querySelector(".v3d-x").onclick = ()=>seleccionar(null);
    const bc = info.querySelector(".v3d-copito"); if(bc) bc.onclick = ()=>o.copito(d, m);
  };
  let abajo = null;
  renderer.domElement.addEventListener("pointerdown", ev=>{ abajo = [ev.clientX, ev.clientY]; });
  renderer.domElement.addEventListener("pointerup", ev=>{
    if(!abajo || Math.hypot(ev.clientX - abajo[0], ev.clientY - abajo[1]) > 5) return;
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((ev.clientX - r.left)/r.width)*2 - 1, -((ev.clientY - r.top)/r.height)*2 + 1);
    ray.setFromCamera(mouse, camara);
    const vis = []; raiz.traverse(ob=>{ if(ob.isMesh && (ob.userData.info || ob.userData.infos)){ let v = true, p = ob; while(p){ if(!p.visible) v = false; p = p.parent; } if(v) vis.push(ob); } });
    const hit = ray.intersectObjects(vis, false)[0];
    seleccionar(hit || null);
  });

  // ===== botones =====
  const sombras = () => { renderer.shadowMap.needsUpdate = true; redibujar(); };
  cont.querySelectorAll("[data-v]").forEach(b=>b.onclick = ()=>irA(b.dataset.v));
  const bPuertas = cont.querySelector('[data-a="puertas"]');
  bPuertas.onclick = ()=>{ const abrir = hojas.some(h=>h.objetivo===0); hojas.forEach(h=>h.objetivo = abrir ? 1 : 0); bPuertas.textContent = abrir ? "Cerrar puertas" : "Abrir puertas"; bPuertas.classList.toggle("activo", abrir); };
  const bExp = cont.querySelector('[data-a="explosion"]');
  bExp.onclick = ()=>{ explObj = explObj ? 0 : 1; bExp.classList.toggle("activo", !!explObj); if(explObj && hojas.some(h=>h.objetivo===0)) bPuertas.click(); };
  const chkTags = cont.querySelector('[data-c="etiquetas"]');
  cont.querySelectorAll("[data-c]").forEach(i=>i.onchange = ()=>{ const kk = i.dataset.c; if(kk==="puerta") ocultarPuertas(i.checked); else if(kk==="hojas") hojas.forEach(h=>h.piv.visible = i.checked); else capas[kk].visible = i.checked; if(kk==="etiquetas") etiq.domElement.style.display = i.checked ? "" : "none"; sombras(); });
  cont.querySelector('[data-a="pantalla"]').onclick = ()=>{ const el = cont.querySelector(".v3d"); if(document.fullscreenElement) document.exitFullscreen(); else if(el.requestFullscreen) el.requestFullscreen(); };
  cont.querySelector('[data-a="foto"]').onclick = ()=>{ renderer.render(escena, camara); const a = document.createElement("a"); a.href = renderer.domElement.toDataURL("image/png"); a.download = `${(m.tablero.tag||"tablero").replace(/[^\w-]+/g,"_")} - vista 3D.png`; a.click(); };
  // abrir puertas al inicio para ver el interior
  if(o.abiertas!==false){ hojas.forEach(h=>{ h.objetivo = 1; h.abierto = 1; }); bPuertas.textContent = "Cerrar puertas"; bPuertas.classList.add("activo"); }

  // ===== ciclo =====
  const ajustarTam = ()=>{ redibujar(); const w = W0(), h = H0(); renderer.setSize(w, h); etiq.setSize(w, h); camara.aspect = w/h; camara.updateProjectionMatrix(); };
  const ro = new ResizeObserver(ajustarTam); ro.observe(lienzo);
  let vivo = true, ultimo = performance.now();
  const ciclo = (t)=>{
    if(!vivo) return;
    if(!document.body.contains(renderer.domElement)){ destruir(); return; }
    const dt = Math.min(0.05, (t - ultimo)/1000); ultimo = t;
    for(const h of hojas){ const antes = h.abierto; h.abierto += (h.objetivo - h.abierto)*Math.min(1, dt*5); if(Math.abs(h.abierto - antes) > 1e-4) sombras(); h.piv.rotation.y = (h.bis==="izq" ? -1 : 1)*h.abierto*Math.PI*0.86; }
    // los TAG del interior no se ven a través de las puertas cerradas; los de equipos pequeños, al acercarse
    const verTags = chkTags.checked && (!capas.envolvente.visible || hojas.some(h=>h.abierto > 0.25 || !h.piv.visible));
    capas.etiquetas.visible = verTags;
    const cerca = camara.position.distanceTo(ctrl.target) < R*1.25*fz();
    for(const e of chicas) e.visible = cerca;
    const exAntes = explosion; explosion += (explObj - explosion)*Math.min(1, dt*4); if(Math.abs(explosion - exAntes) > 1e-4) sombras();
    for(const g of piezas){ const c = g.userData.comp; const dz = explosion*(120 + ((c && c.d) || 50)*0.6); g.position.z = g.userData.base.z + dz*k; }
    if(anim){ anim.t = Math.min(1, anim.t + dt*1.8); const e = 1 - Math.pow(1 - anim.t, 3); camara.position.lerpVectors(anim.desde, anim.hasta, e); ctrl.target.lerp(anim.objetivo, e); if(anim.t>=1) anim = null; }
    if(anim) redibujar();
    const vt = capas.etiquetas.visible + "" + chicas.some(e=>e.visible); if(vt!==ciclo.vt){ ciclo.vt = vt; redibujar(); }
    if(ctrl.update()) redibujar();
    if(sucio){ sucio = false; renderer.render(escena, camara); etiq.render(escena, camara); }
    requestAnimationFrame(ciclo);
  };
  requestAnimationFrame(ciclo);
  function destruir(){
    vivo = false; ro.disconnect(); ctrl.dispose(); limpiarSel();
    escena.traverse(ob=>{ if(ob.geometry && !compartidas.has(ob.geometry) && !geosB.has(ob.geometry) && ![...bordesB.values()].includes(ob.geometry)) ob.geometry.dispose(); if(ob.isInstancedMesh) ob.dispose(); });
    compartidas.forEach(g=>g.dispose()); geosB.forEach(g=>g.dispose()); bordesB.forEach(g=>g.dispose());
    Object.values(mats).forEach(x=>x.dispose()); texturas.forEach(t=>t.dispose()); bordes.dispose(); bordesSuaves.dispose();
    if(escena.environment) escena.environment.dispose();
    renderer.dispose();
    if(actual && actual.renderer===renderer) actual = null;
  }
  actual = { destruir, renderer, escena, camara, controles:ctrl };
  return actual;
}
const r1 = v => Math.round((v||0)*10)/10;
const esc = s => String(s==null ? "" : s).replace(/[&<>"]/g, c=>({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" })[c]);
/* visor activo (cámara, controles y escena), para pruebas y capturas automáticas */
export const visorActivo = () => actual;

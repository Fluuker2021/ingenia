/* Ingenia — VISTA PREVIA 3D del tablero (three.js, se carga solo en esta pestaña).
   Se arma con el mismo modelo del arreglo mecánico (js/mecanico/arreglo.js) que genera el plano 2D, para ver en el
   espacio cómo se construye el tablero: gabinete con sus puertas (se abren), placas de montaje, canaletas, rieles,
   equipos con sus dimensiones reales, barras, recorridos de fuerza, borneras, base con prensaestopas y los
   dispositivos de puerta. Botones para cambiar de vista, abrir puertas, ocultar capas, ver por explosión y
   seleccionar un componente para ver sus datos o pedirle un cambio a Copito. */
import * as C from "./componentes.js";

const RAL7035 = 0xd7d8d2, GALV = 0xc4c9cf;
const COL_TIPO = {
  interruptor:0x3b3f46, xlp:0x4a4f57, variador:0x2b2f36, arrancador:0xe6e7e9, reactancia:0x6b5236, trafo:0x5d6670, fuente:0xd9dadc,
  guardamotor:0xe9eaec, contactor:0xe9eaec, sobrecarga:0xdedfe1, mcb:0xf2f2f2, diferencial:0xf2f2f2, fusible:0xe4e4e4, rele:0xe6e6e6,
  spd:0xe9eaec, resistencia:0x9da3aa, peine:0xc8783a,
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
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(W0(), H0());
  renderer.setClearColor(0xf3f4f6);
  lienzo.appendChild(renderer.domElement);
  const etiq = new CSS2DRenderer(); etiq.setSize(W0(), H0()); etiq.domElement.className = "v3d-etiquetas"; lienzo.appendChild(etiq.domElement);
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(35, W0()/H0(), 0.01, 100);
  const ctrl = new OrbitControls(camara, renderer.domElement);
  ctrl.enableDamping = true; ctrl.dampingFactor = 0.08;
  escena.add(new THREE.HemisphereLight(0xffffff, 0x9aa0a8, 1.0));
  const sol = new THREE.DirectionalLight(0xffffff, 1.6); sol.position.set(2.5, 4, 5); escena.add(sol);
  const sol2 = new THREE.DirectionalLight(0xffffff, 0.6); sol2.position.set(-3, 2, -2); escena.add(sol2);
  // piso
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color:0xe7e9ec, roughness:1 }));
  piso.rotation.x = -Math.PI/2; piso.position.y = -m.zocalo*k - 0.001; escena.add(piso);
  const grid = new THREE.GridHelper(10, 50, 0xc9cdd3, 0xdde0e4); grid.position.y = -m.zocalo*k; escena.add(grid);

  const raiz = new THREE.Group(); raiz.position.set(-m.W/2*k, 0, -m.D/2*k); escena.add(raiz);
  const capas = { envolvente:new THREE.Group(), interior:new THREE.Group(), canaletas:new THREE.Group(), cables:new THREE.Group(), etiquetas:new THREE.Group(), puerta:new THREE.Group() };
  Object.values(capas).forEach(g=>raiz.add(g));
  const mats = {};
  const mat = (c, extra) => { const key = c + JSON.stringify(extra||{}); if(!mats[key]) mats[key] = new THREE.MeshStandardMaterial(Object.assign({ color:c, roughness:0.55, metalness:0.08 }, extra||{})); return mats[key]; };
  const bordes = new THREE.LineBasicMaterial({ color:0x2a2e35, transparent:true, opacity:0.35 });
  const geoCaja = new THREE.BoxGeometry(1, 1, 1), geoBordes = new THREE.EdgesGeometry(geoCaja);
  // caja en coordenadas del modelo: x, y (abajo-izquierda), z0 (desde la pared posterior), w, h, d
  const caja = (x, y, z0, w, h, d, color, grupo, extra, conBordes) => {
    const g = new THREE.Mesh(geoCaja, typeof color==="object" ? color : mat(color, extra));
    g.scale.set(Math.max(0.5, w)*k, Math.max(0.5, h)*k, Math.max(0.5, d)*k);
    g.position.set((x + w/2)*k, (y + h/2)*k, (z0 + d/2)*k);
    if(conBordes!==false){ const e = new THREE.LineSegments(geoBordes, bordes); g.add(e); }
    (grupo || capas.interior).add(g); return g;
  };
  const cil = (x, y, z, r, largo, color, grupo, eje) => {
    const g = new THREE.Mesh(new THREE.CylinderGeometry(r*k, r*k, largo*k, 24), mat(color));
    if(eje==="z") g.rotation.x = Math.PI/2; if(eje==="x") g.rotation.z = Math.PI/2;
    g.position.set(x*k, y*k, z*k); (grupo || capas.interior).add(g); return g;
  };
  const chicas = [];
  const etiqueta = (txt, x, y, z, clase) => { const d = document.createElement("div"); d.className = "v3d-tag" + (clase ? " "+clase : ""); d.textContent = txt; const o2 = new CSS2DObject(d); o2.position.set(x*k, y*k, z*k); capas.etiquetas.add(o2); if(clase==="v3d-tag-chico") chicas.push(o2); return o2; };

  // ===== gabinete =====
  const esp = 2, { W, H, D, zocalo } = m;
  const envMat = mat(RAL7035, { transparent:true, opacity:0.32, depthWrite:false });
  caja(0, 0, 0, W, H, esp, envMat, capas.envolvente);                 // fondo
  caja(0, 0, 0, esp, H, D, envMat, capas.envolvente);                 // lateral izq.
  caja(W - esp, 0, 0, esp, H, D, envMat, capas.envolvente);           // lateral der.
  caja(0, H - esp, 0, W, esp, D, envMat, capas.envolvente);           // techo
  caja(0, 0, 0, W, esp, D, mat(0xb9bdc2), capas.envolvente);          // base / placa pasacables
  if(zocalo) caja(0, -zocalo, 0, W, zocalo, D, mat(0x3b3f46), capas.envolvente);
  for(const s of m.secciones.slice(1)) caja(s.x0 - 20, 0, 0, 40, H, 40, mat(0xa9aeb5), capas.envolvente);
  if(m.techo) caja(-40, H, -40, W + 80, 30, D + 80, mat(RAL7035), capas.envolvente);
  for(const [xe, ze] of [[80, 80], [W - 80, 80], [80, D - 80], [W - 80, D - 80]]){ const t = new THREE.Mesh(new THREE.TorusGeometry(16*k, 4*k, 8, 20), mat(0x8a8f96)); t.position.set(xe*k, (H + (m.techo ? 30 : 0) + 30)*k, ze*k); capas.envolvente.add(t); }
  // prensaestopas en la base
  for(const c of m.base){ const zc = c.fila ? D*0.32 : D*0.6; const g = cil(c.x, -6, zc, (c.agujero||25)/2 + 3, 18, c.ref==="RESERVA" ? 0x9aa0a8 : 0x2b2f36, capas.envolvente); g.userData.info = { tag:c.ref, desc:c.desc, modelo:`Prensaestopa ${c.rosca}${c.awg ? " · cable "+c.awg : ""}`, dim:`Agujero Ø${c.agujero} mm` }; }

  // ===== placas, canaletas, rieles =====
  for(const p of m.placas) caja(p.x, p.y, 22, p.w, p.h, 3, mat(GALV, { metalness:0.35, roughness:0.45 }));
  for(const d of m.canaletas){ const prof = d.prof || 80; const g = caja(d.x, d.y, 25, d.w, d.h, prof, mat(0x9aa1a9), capas.canaletas); g.userData.info = { tag:"", desc:"Canaleta ranurada con tapa", modelo:`Canaleta ${d.nombre}`, dim:`${Math.round(d.orient==="h" ? d.w : d.h)} mm de largo` }; }
  for(const r of m.rieles) caja(r.x, r.y - 17.5, 25, r.w, 35, 7.5, mat(0xb8bec6, { metalness:0.5 }), capas.interior, null, false);
  if(m.zonaAcom){ const z = m.zonaAcom; caja(z.x, z.y, 25, z.w, z.h, 2, mat(0xf5c518, { transparent:true, opacity:0.18, depthWrite:false }), capas.cables, null, false); }

  // ===== barras, aisladores y pletinas =====
  for(const b of m.barras){
    const pe = b.fase==="PE";
    const g = caja(b.x, b.y, pe ? 30 : 95, b.w, b.h, pe ? (b.h > 20 ? 5 : 3) : m.fase.espesor || 5, mat(pe ? 0x2e9e4f : 0xc8783a, { metalness:0.6, roughness:0.35 }));
    g.userData.info = { tag:b.tag, desc: pe ? "Barra de tierra de protección" : `Barra de fase ${b.fase}`, modelo:`Barra Cu ${b.nombre} mm`, dim:`${Math.round(b.w)} mm` };
    if(!pe) etiqueta(b.fase, b.x - 20, b.y + b.h/2, 100, "v3d-tag-chico");
  }
  for(const a of m.aisladores){ caja(a.x - 20, a.y0 - m.fase.ancho/2 - 18, 25, 40, (a.y1 - a.y0) + m.fase.ancho + 36, 12, mat(0x4b4f56)); for(let i=0;i<3;i++) cil(a.x, a.y0 + i*m.fase.paso, 60, 12, 70, 0xa0362c, capas.interior, "z"); }
  // ===== equipos =====
  const piezas = [];
  for(const c of m.comps){
    const z0 = c.montaje==="din" || c.montaje==="contactor" ? 32 : 25;
    const col = COL_TIPO[c.tipo] || 0xdddddd;
    const g = caja(c.x, c.y, z0, c.w, c.h, c.d || 60, mat(col));
    g.userData.info = { tag:c.tag, desc:c.desc, modelo:c.modelo, dim:`${r1(c.w)} × ${r1(c.h)} × ${r1(c.d||0)} mm`, montaje:c.montaje, fuente:c.fuente, val:c.val };
    g.userData.base = g.position.clone(); g.userData.comp = c;
    piezas.push(g);
    detalle(c, z0 + (c.d||60));
    if(c.tag) etiqueta(c.tag, c.x + c.w/2, c.y + c.h + 10, z0 + (c.d||60), c.tipo==="variador" || c.tipo==="interruptor" ? "" : "v3d-tag-chico");
  }
  // bornes
  for(const b of m.bornes){
    for(const x of b.bornes){ const g = caja(x.x, b.y - x.h/2, 32, x.w - 0.4, x.h, x.d, mat(x.pe ? 0xc9bf2b : 0x8a9099)); g.userData.info = { tag:`${b.grupo}:${x.n}`, desc:b.desc, modelo:x.modelo, dim:`${x.w} × ${x.h} × ${x.d} mm` }; g.userData.base = g.position.clone(); piezas.push(g); }
    etiqueta(b.grupo, (b.x0 + b.x1)/2, b.y + 45, 90, "v3d-tag-chico");
  }
  // ===== cableado de fuerza =====
  for(const cx of m.conexiones){
    if(cx.tipo==="pletina"){ const [a, b] = cx.pts; const y0 = Math.min(a[1], b[1]), h = Math.abs(a[1] - b[1]); caja(a[0] - 10, y0, 92, 20, h, 4, mat(0xc8783a, { metalness:0.6, roughness:0.35 }), capas.cables, null, false); continue; }
    const z = cx.tipo==="acometida" ? 60 : 130 + (cx.fase==="L2"||cx.fase==="V" ? 6 : cx.fase==="L3"||cx.fase==="W" ? 12 : 0);
    const pts = cx.pts.map(q=>new THREE.Vector3(q[0]*k, q[1]*k, z*k));
    if(pts.length < 2) continue;
    const curva = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.05);
    const r = cx.tipo==="acometida" ? 9 : cx.fase==="L1-L2-L3" ? 4 : 5;
    const tubo = new THREE.Mesh(new THREE.TubeGeometry(curva, Math.max(8, pts.length*12), r*k, 8, false), mat(FASE[cx.fase] || 0x333333, { roughness:0.7 }));
    capas.cables.add(tubo);
  }
  // ===== puertas (con bisagra) y sus dispositivos =====
  const hojas = [];
  for(const s of m.secciones){
    const defs = s.puertas===2 ? [[s.x0 + 3, (s.x0 + s.x1)/2 - 1.5, "izq"], [(s.x0 + s.x1)/2 + 1.5, s.x1 - 3, "der"]] : [[s.x0 + 3, s.x1 - 3, s.bisagra]];
    for(const [x0, x1, bis] of defs){
      const piv = new THREE.Group(); const xp = bis==="izq" ? x0 : x1;
      piv.position.set(xp*k, 0, D*k); raiz.add(piv);
      const pg = new THREE.Group(); piv.add(pg); pg.position.set(-xp*k, 0, -D*k);
      const hoja = caja(x0, 3, D, x1 - x0, H - 6, 20, mat(RAL7035), pg);
      hoja.userData.info = { tag:s.id, desc:`Puerta de la sección ${s.id.slice(1)} (${s.rol==="potencia" ? "fuerza" : s.rol==="control" ? "control" : "fuerza y control"})`, modelo:"Plancha de acero, RAL 7035", dim:`${r1(x1 - x0)} × ${r1(H - 6)} mm` };
      const xm = bis==="izq" ? x1 - 45 : x0 + 25; caja(xm, 900, D + 20, 20, 160, 30, mat(0x2b2f36), pg);
      hojas.push({ piv, bis, x0, x1, abierto:0, objetivo:0, grupo:pg });
    }
  }
  const hojaDe = x => hojas.find(h=>x >= h.x0 - 1 && x <= h.x1 + 1) || hojas[0];
  for(const d of m.puerta){
    const h = hojaDe(d.x), g = h.grupo, z = D + 20;
    let obj;
    if(d.tipo==="manija"){ obj = caja(d.x - d.w/2, d.y - d.h/2, z, d.w, d.h, 12, mat(0x2b2f36), g); const p2 = caja(d.x - 9, d.y - 42, z + 12, 18, 84, 25, mat(0xd2312b), g); p2.userData.info = { tag:"Q1", desc:d.desc, modelo:d.modelo }; }
    else if(d.tipo==="panelvfd"){ obj = caja(d.x - d.w/2, d.y - d.h/2, z, d.w, d.h, 18, mat(0x2b2f36), g); caja(d.x - d.w/2 + 10, d.y + d.h*0.12, z + 18, d.w - 20, d.h*0.26, 1, mat(0x7fb3d5, { emissive:0x1d3c52 }), g, null, false); }
    else if(d.tipo==="ventilador" || d.tipo==="rejilla"){ obj = caja(d.x - d.w/2, d.y - d.h/2, z, d.w, d.h, 16, mat(0x5d6670), g); for(let yy = d.y - d.h/2 + 20; yy < d.y + d.h/2 - 12; yy += 14) caja(d.x - d.w/2 + 16, yy, z + 16, d.w - 32, 5, 3, mat(0x3b3f46), g, null, false); }
    else if(d.tipo==="aa"){ obj = caja(d.x - d.w/2, d.y - d.h/2, z, d.w, d.h, 160, mat(0xe9eaec), g); }
    else {
      const cMap = { verde:0x2e9e4f, rojo:0xd2312b, ambar:0xf5a623, azul:0x2b6cb0, negro:0x1c1c1c, amarillo:0xf5c518 };
      if(d.tipo==="seta"){ obj = cil(d.x, d.y, z + 4, 30, 8, 0xf5c518, g, "z"); const hg = cil(d.x, d.y, z + 22, 20, 28, 0xd2312b, g, "z"); hg.userData.info = { tag:d.tag, desc:d.desc, modelo:d.modelo }; }
      else { obj = cil(d.x, d.y, z + 8, 15, 16, 0x8a9099, g, "z"); const cap = cil(d.x, d.y, z + 18, 11, 6, cMap[d.color] || 0x1c1c1c, g, "z"); cap.userData.info = { tag:d.tag, desc:d.desc, modelo:(C.PUERTA[d.tipo]||{}).modelo || "" }; if(d.leyenda){ const pl = C.PUERTA.placa; caja(d.x - pl.w/2, d.y + 21, z, pl.w, pl.h, 2, mat(0xf4f5f6), g, null, false); } }
    }
    if(obj) obj.userData.info = { tag:d.tag, desc:d.desc || d.leyenda, modelo:d.modelo || (C.PUERTA[d.tipo]||{}).modelo || "", dim: d.w ? `${d.w} × ${d.h} mm` : "" };
  }
  // placa de identificación
  { const s1 = m.secciones[0], cx = (s1.x0 + s1.x1)/2, h = hojaDe(cx); caja(cx - 150, H - 170, D + 20, 300, 90, 2, mat(0xc9ced4, { metalness:0.6 }), h.grupo); }
  // capa de dispositivos de puerta = todo lo que cuelga de las puertas menos la hoja
  const ocultarPuertas = v => hojas.forEach(h=>h.grupo.children.forEach((ch, i)=>{ if(i>0) ch.visible = v; }));

  function detalle(c, zf){
    const { x, y, w, h } = c;
    const negro = mat(0x1c1c1c), gris = mat(0x6b7079);
    if(c.tipo==="interruptor"){ caja(x + w*0.42, y + h*0.38, zf, w*0.16, h*0.24, 18, mat(0x1c1c1c)); caja(x + w*0.1, y + h*0.24, zf - 1, w*0.8, h*0.52, 2, mat(0x50555d), capas.interior, null, false); }
    else if(c.tipo==="variador"){ caja(x + w*0.3, y + h*0.6, zf, w*0.4, h*0.15, 6, negro); caja(x + w*0.36, y + h*0.68, zf + 6, w*0.28, h*0.05, 1, mat(0x7fb3d5, { emissive:0x1d3c52 }), capas.interior, null, false); }
    else if(c.tipo==="mcb" || c.tipo==="diferencial"){ const n = Math.max(1, Math.round(w/C.MODULO)); for(let i=0;i<n;i++) caja(x + i*C.MODULO + 5.75, y + h*0.4, zf, 6, h*0.2, 8, c.tag && /^ID/.test(c.tag) ? mat(0x2b6cb0) : negro, capas.interior, null, false); }
    else if(c.tipo==="guardamotor"){ cil(x + (w - C.AUX_LATERAL)/2, y + h*0.52, zf + 5, (w - C.AUX_LATERAL)*0.28, 10, 0x1c1c1c, capas.interior, "z"); }
    else if(c.tipo==="contactor"){ caja(x + w*0.28, y + h*0.66, zf, w*0.44, h*0.14, 10, gris, capas.interior, null, false); }
    else if(c.tipo==="xlp"){ for(let i=0;i<3;i++){ const cx = x + w*(i+0.5)/3, cw = w/3 - 10; caja(cx - cw/2, y + h*0.2, zf, cw, h*0.56, 14, mat(0x2b2f36)); } }
    else if(c.tipo==="reactancia"){ for(let i=0;i<3;i++){ const cx = x + w*(i+0.5)/3; cil(cx, y + h*0.45, 25 + (c.d||100)/2, Math.min(w/7, (c.d||100)*0.42), h*0.56, 0xb06a2c, capas.interior, null); } }
    else if(c.tipo==="trafo"){ caja(x + w*0.18, y + h*0.12, zf, w*0.64, h*0.66, 4, mat(0x2b2f36), capas.interior, null, false); }
  }

  // ===== cámara y vistas =====
  const centro = new THREE.Vector3(0, (H/2 - zocalo/2)*k, 0);
  const R = Math.max(W, H, D)*k;
  const vistas = { iso:[0.8, 0.5, 1.55], frente:[0, 0, 2.2], lateral:[2.2, 0, 0], planta:[0, 2.4, 0.01], atras:[-0.4, 0.4, -2] };
  // en pantallas angostas (celular) la cámara se aleja para que entre todo el ancho del tablero
  const fz = () => Math.max(1, 1.35/Math.max(0.2, W0()/H0()));
  const irA = (nombre)=>{ const v = vistas[nombre], f = R*fz(); const destino = new THREE.Vector3(v[0]*f, v[1]*f, v[2]*f).add(centro); anim = { desde:camara.position.clone(), hasta:destino, t:0, objetivo:centro.clone() }; cont.querySelectorAll("[data-v]").forEach(b=>b.classList.toggle("activo", b.dataset.v===nombre)); };
  camara.position.set(vistas.iso[0]*R*fz(), vistas.iso[1]*R*fz(), vistas.iso[2]*R*fz()).add(centro);
  ctrl.target.copy(centro); ctrl.update();
  let anim = null, explosion = 0, explObj = 0;

  // ===== selección =====
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let sel = null, selMat = null;
  const seleccionar = obj => {
    if(sel){ sel.material = selMat; sel = null; }
    if(!obj){ info.hidden = true; return; }
    sel = obj; selMat = obj.material; obj.material = selMat.clone(); obj.material.emissive = new THREE.Color(0xf5c518); obj.material.emissiveIntensity = 0.45;
    const d = obj.userData.info || {};
    info.hidden = false;
    info.innerHTML = `<button class="v3d-x" aria-label="Cerrar">×</button><div class="v3d-tagsel">${esc(d.tag||"—")}</div><div class="v3d-desc">${esc(d.desc||"")}</div>
      ${d.modelo ? `<div><span>Modelo</span>${esc(d.modelo)}</div>` : ""}${d.val ? `<div><span>Valor</span>${esc(d.val)}</div>` : ""}${d.dim ? `<div><span>Dimensiones</span>${esc(d.dim)}</div>` : ""}
      ${d.montaje ? `<div><span>Montaje</span>${esc({ din:"Riel DIN", placa:"Placa de montaje", base:"Base del gabinete", contactor:"Bajo el contactor" }[d.montaje]||d.montaje)}</div>` : ""}
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
    const vis = []; raiz.traverse(ob=>{ if(ob.isMesh && ob.userData.info){ let v = true, p = ob; while(p){ if(!p.visible) v = false; p = p.parent; } if(v) vis.push(ob); } });
    const hit = ray.intersectObjects(vis, false)[0];
    seleccionar(hit ? hit.object : null);
  });

  // ===== botones =====
  cont.querySelectorAll("[data-v]").forEach(b=>b.onclick = ()=>irA(b.dataset.v));
  const bPuertas = cont.querySelector('[data-a="puertas"]');
  bPuertas.onclick = ()=>{ const abrir = hojas.some(h=>h.objetivo===0); hojas.forEach(h=>h.objetivo = abrir ? 1 : 0); bPuertas.textContent = abrir ? "Cerrar puertas" : "Abrir puertas"; bPuertas.classList.toggle("activo", abrir); };
  const bExp = cont.querySelector('[data-a="explosion"]');
  bExp.onclick = ()=>{ explObj = explObj ? 0 : 1; bExp.classList.toggle("activo", !!explObj); if(explObj && hojas.some(h=>h.objetivo===0)) bPuertas.click(); };
  const chkTags = cont.querySelector('[data-c="etiquetas"]');
  cont.querySelectorAll("[data-c]").forEach(i=>i.onchange = ()=>{ const kk = i.dataset.c; if(kk==="puerta") ocultarPuertas(i.checked); else if(kk==="hojas") hojas.forEach(h=>h.piv.visible = i.checked); else capas[kk].visible = i.checked; if(kk==="etiquetas") etiq.domElement.style.display = i.checked ? "" : "none"; });
  cont.querySelector('[data-a="pantalla"]').onclick = ()=>{ const el = cont.querySelector(".v3d"); if(document.fullscreenElement) document.exitFullscreen(); else if(el.requestFullscreen) el.requestFullscreen(); };
  cont.querySelector('[data-a="foto"]').onclick = ()=>{ renderer.render(escena, camara); const a = document.createElement("a"); a.href = renderer.domElement.toDataURL("image/png"); a.download = `${(m.tablero.tag||"tablero").replace(/[^\w-]+/g,"_")} - vista 3D.png`; a.click(); };
  // abrir puertas al inicio para ver el interior
  if(o.abiertas!==false){ hojas.forEach(h=>{ h.objetivo = 1; h.abierto = 1; }); bPuertas.textContent = "Cerrar puertas"; bPuertas.classList.add("activo"); }

  // ===== ciclo =====
  const ajustarTam = ()=>{ const w = W0(), h = H0(); renderer.setSize(w, h); etiq.setSize(w, h); camara.aspect = w/h; camara.updateProjectionMatrix(); };
  const ro = new ResizeObserver(ajustarTam); ro.observe(lienzo);
  let vivo = true, ultimo = performance.now();
  const ciclo = (t)=>{
    if(!vivo) return;
    if(!document.body.contains(renderer.domElement)){ destruir(); return; }
    const dt = Math.min(0.05, (t - ultimo)/1000); ultimo = t;
    for(const h of hojas){ h.abierto += (h.objetivo - h.abierto)*Math.min(1, dt*5); h.piv.rotation.y = (h.bis==="izq" ? -1 : 1)*h.abierto*Math.PI*0.86; }
    // los TAG del interior no se ven a través de las puertas cerradas; los de equipos pequeños, al acercarse
    const verTags = chkTags.checked && (!capas.envolvente.visible || hojas.some(h=>h.abierto > 0.25 || !h.piv.visible));
    capas.etiquetas.visible = verTags;
    const cerca = camara.position.distanceTo(ctrl.target) < R*1.25*fz();
    for(const e of chicas) e.visible = cerca;
    explosion += (explObj - explosion)*Math.min(1, dt*4);
    for(const g of piezas){ const c = g.userData.comp; const dz = explosion*(120 + ((c && c.d) || 50)*0.6); g.position.z = g.userData.base.z + dz*k; }
    if(anim){ anim.t = Math.min(1, anim.t + dt*1.8); const e = 1 - Math.pow(1 - anim.t, 3); camara.position.lerpVectors(anim.desde, anim.hasta, e); ctrl.target.lerp(anim.objetivo, e); if(anim.t>=1) anim = null; }
    ctrl.update(); renderer.render(escena, camara); etiq.render(escena, camara);
    requestAnimationFrame(ciclo);
  };
  requestAnimationFrame(ciclo);
  function destruir(){
    vivo = false; ro.disconnect(); ctrl.dispose();
    escena.traverse(ob=>{ if(ob.geometry && ob.geometry!==geoCaja && ob.geometry!==geoBordes) ob.geometry.dispose(); });
    geoCaja.dispose(); geoBordes.dispose(); Object.values(mats).forEach(x=>x.dispose()); renderer.dispose();
    if(actual && actual.renderer===renderer) actual = null;
  }
  actual = { destruir, renderer };
  return actual;
}
const r1 = v => Math.round((v||0)*10)/10;
const esc = s => String(s==null ? "" : s).replace(/[&<>"]/g, c=>({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" })[c]);

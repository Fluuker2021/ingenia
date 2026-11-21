/* Ingenia — acceso al panel.
   Hoy: una cuenta propia (usuario y contraseña) verificada en el navegador; la contraseña NO está en el código: solo su
   huella PBKDF2-SHA256 con sal. Es un acceso local (la página es estática): protege la pantalla, no los datos del
   navegador ni el código publicado. Para cuentas reales hace falta un servidor o un proveedor de identidad.
   Siguiente etapa: ingreso con una cuenta de Google (Google Identity Services) para asociar cada usuario a su plan de
   pago; se activa al poner el ID de cliente OAuth en CONFIG.googleClientId. */

export const CONFIG = {
  // ID de cliente OAuth 2.0 de Google (consola de Google Cloud → Credenciales → «ID de cliente de OAuth», tipo «Aplicación
  // web», con el dominio del sitio en «Orígenes autorizados de JavaScript»). Vacío = el botón de Google aparece como «próximamente».
  googleClientId: "",
};

// cuentas propias: usuario, nombre visible y huella de la contraseña (PBKDF2-SHA256, 210 000 iteraciones)
const CUENTAS = [
  { id:"afluker", usuario:"Afluker", nombre:"Afluker", rol:"Administrador",
    sal:"efa654c1959dd313ac36b3c3e92cc5d4", huella:"2a22685a6da7cdece2ab86de2c10c6fb217e744cd529ac5e4c8766331ae10352", iter:210000,
    // la cuenta dueña conserva los proyectos guardados antes de que existiera el acceso
    datos:"ingenia.v1" },
];

const K_SESION = "ingenia.sesion", K_INTENTOS = "ingenia.intentos";
const esc = v => String(v??"").replace(/[&<>"']/g, c=>({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
const leer = (k, alm) => { try { return JSON.parse(alm.getItem(k) || "null"); } catch(e){ return null; } };
const escribir = (k, v, alm) => { try { if(v==null) alm.removeItem(k); else alm.setItem(k, JSON.stringify(v)); } catch(e){} };

/* sesión vigente: { id, usuario, nombre, email?, foto?, metodo, desde } (en este equipo o solo en esta pestaña) */
export function sesion(){ return leer(K_SESION, localStorage) || leer(K_SESION, sessionStorage); }
/* clave de almacenamiento de los datos del usuario (cada usuario ve solo sus proyectos) */
export function claveDatos(){
  const s = sesion(); if(!s) return "ingenia.v1";
  const c = CUENTAS.find(x=>x.id===s.id); return c ? c.datos : `ingenia.v1:${s.id}`;
}
export function cerrarSesion(){ escribir(K_SESION, null, localStorage); escribir(K_SESION, null, sessionStorage); location.reload(); }

const hex = b => [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2, "0")).join("");
const deHex = h => new Uint8Array(h.match(/../g).map(x=>parseInt(x, 16)));
async function huella(clave, salHex, iter){
  if(window.crypto && crypto.subtle){
    const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(clave), "PBKDF2", false, ["deriveBits"]);
    return hex(await crypto.subtle.deriveBits({ name:"PBKDF2", hash:"SHA-256", salt: deHex(salHex), iterations: iter }, k, 256));
  }
  // sin Web Crypto (página abierta por http): la misma huella calculada en JavaScript
  return hex(pbkdf2(new TextEncoder().encode(clave), deHex(salHex), iter));
}
/* SHA-256 / HMAC / PBKDF2 (un bloque de 32 bytes) en JavaScript, solo como respaldo */
const K256 = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
function sha256(m){
  const l = m.length, n = ((l + 9 + 63) >> 6) << 6, b = new Uint8Array(n); b.set(m); b[l] = 0x80;
  const dv = new DataView(b.buffer); dv.setUint32(n - 4, l * 8); dv.setUint32(n - 8, Math.floor(l / 0x20000000));
  const H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]), w = new Uint32Array(64);
  const r = (x, k) => (x >>> k) | (x << (32 - k));
  for(let o = 0; o < n; o += 64){
    for(let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i*4);
    for(let i = 16; i < 64; i++){ const a = w[i-15], c = w[i-2]; w[i] = (w[i-16] + (r(a,7) ^ r(a,18) ^ (a >>> 3)) + w[i-7] + (r(c,17) ^ r(c,19) ^ (c >>> 10))) | 0; }
    let [a, b2, c, d, e, f, g, h] = H;
    for(let i = 0; i < 64; i++){
      const t1 = (h + (r(e,6) ^ r(e,11) ^ r(e,25)) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) | 0, t2 = ((r(a,2) ^ r(a,13) ^ r(a,22)) + ((a & b2) ^ (a & c) ^ (b2 & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b2; b2 = a; a = (t1 + t2) | 0;
    }
    H[0] += a; H[1] += b2; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  const out = new Uint8Array(32), ov = new DataView(out.buffer); H.forEach((x, i)=>ov.setUint32(i*4, x)); return out;
}
function hmac(k, m){
  if(k.length > 64) k = sha256(k);
  const ki = new Uint8Array(64 + m.length), ko = new Uint8Array(96);
  for(let i = 0; i < 64; i++){ const x = k[i] || 0; ki[i] = x ^ 0x36; ko[i] = x ^ 0x5c; }
  ki.set(m, 64); ko.set(sha256(ki), 64); return sha256(ko);
}
function pbkdf2(clave, sal, iter){
  const s1 = new Uint8Array(sal.length + 4); s1.set(sal); s1[sal.length + 3] = 1;
  let u = hmac(clave, s1); const t = u.slice();
  for(let i = 1; i < iter; i++){ u = hmac(clave, u); for(let j = 0; j < 32; j++) t[j] ^= u[j]; }
  return t;
}
// comparación en tiempo constante
const iguales = (a, b) => { if(a.length!==b.length) return false; let r = 0; for(let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r===0; };

/* intentos fallidos: tras 5 seguidos se espera un momento antes de volver a probar */
function bloqueo(){ const x = leer(K_INTENTOS, localStorage) || { n:0, hasta:0 }; return x; }
function fallo(){ const x = bloqueo(); x.n++; if(x.n >= 5){ x.hasta = Date.now() + 30000 * Math.min(4, x.n - 4); } escribir(K_INTENTOS, x, localStorage); }

export async function iniciarSesion(usuario, clave, recordar){
  const b = bloqueo(); if(b.hasta > Date.now()) return { ok:false, msg:`Demasiados intentos. Espera ${Math.ceil((b.hasta - Date.now())/1000)} s.` };
  const c = CUENTAS.find(x=>x.usuario.toLowerCase()===String(usuario||"").trim().toLowerCase());
  // se calcula la huella aunque el usuario no exista (mismo tiempo de respuesta)
  const h = await huella(String(clave||""), c ? c.sal : CUENTAS[0].sal, c ? c.iter : CUENTAS[0].iter);
  if(!c || !iguales(h, c.huella)){ fallo(); return { ok:false, msg:"Usuario o contraseña incorrectos." }; }
  escribir(K_INTENTOS, null, localStorage);
  const s = { id:c.id, usuario:c.usuario, nombre:c.nombre, rol:c.rol, metodo:"cuenta", desde:new Date().toISOString() };
  escribir(K_SESION, s, recordar ? localStorage : sessionStorage);
  return { ok:true, sesion:s };
}

/* ---------- Google (siguiente etapa) ----------
   El token de Google se debe validar en un servidor antes de confiar en él (y para cobrar). Aquí solo se prepara el botón. */
function cargarGoogle(){
  return new Promise((res, rej)=>{
    if(window.google && google.accounts) return res();
    const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
}
function datosToken(jwt){
  try { const b = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); return JSON.parse(decodeURIComponent(escape(atob(b)))); } catch(e){ return null; }
}

/* ---------- pantalla de acceso ---------- */
const LOGO = `<b class="marca">ingen<span>IA</span></b>`;
const ICO = {
  user:'<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>',
  lock:'<svg class="icon" viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  eye:'<svg class="icon" viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  google:'<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.9 6.2C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.2C6.6 42.6 14.6 48 24 48z"/></svg>',
};
const TXT = {
  es:{ tit:"Ingresa a tu panel", sub:"Entregables de electricidad e instrumentación listos para emitir.", usuario:"Usuario", clave:"Contraseña", recordar:"Mantener la sesión en este equipo",
       entrar:"Ingresar", verificando:"Verificando…", o:"o", google:"Continuar con Google", pronto:"Próximamente", vacio:"Ingresa tu usuario y tu contraseña.",
       lema:"Ingeniería eléctrica e I&C, del listado de cargas al plano.", p1:"Listados, memorias y planos coherentes entre sí", p2:"Formatos de tu cliente o estándar", p3:"Copito, tu asistente en cada documento",
       nota:"El ingreso con Google y los planes de pago se habilitarán próximamente.", volver:"Volver al inicio" },
  en:{ tit:"Sign in to your workspace", sub:"Electrical and instrumentation deliverables, ready to issue.", usuario:"Username", clave:"Password", recordar:"Keep me signed in on this device",
       entrar:"Sign in", verificando:"Verifying…", o:"or", google:"Continue with Google", pronto:"Coming soon", vacio:"Enter your username and password.",
       lema:"Electrical and I&C engineering, from load list to drawing.", p1:"Lists, calculations and drawings consistent with each other", p2:"Your client's templates or the standard ones", p3:"Copito, your assistant in every document",
       nota:"Google sign-in and paid plans will be available soon.", volver:"Back to home" },
};
const idioma = () => { try { return localStorage.getItem("ingenia.idioma")==="en" ? "en" : "es"; } catch(e){ return "es"; } };

/* muestra la pantalla de acceso si no hay sesión; resuelve cuando el usuario ingresó */
export function exigirSesion(){
  if(sesion()) return Promise.resolve(sesion());
  return new Promise(resolve=>{
    document.body.classList.add("con-login");
    const raiz = document.createElement("div"); raiz.className = "login"; raiz.setAttribute("role", "main");
    document.body.appendChild(raiz);
    const pintar = ()=>{
      const t = TXT[idioma()];
      raiz.innerHTML = `
      <section class="login-marca" aria-hidden="false">
        <div class="login-marca-top">${LOGO}</div>
        <div class="login-marca-cuerpo">
          <h1>${t.lema}</h1>
          <ul class="login-puntos"><li>${t.p1}</li><li>${t.p2}</li><li>${t.p3}</li></ul>
        </div>
        <svg class="login-trazo" viewBox="0 0 400 160" aria-hidden="true"><path d="M0 120 H90 V60 H170 V120 H250 V40 H330 V120 H400"/><circle cx="90" cy="120" r="4"/><circle cx="170" cy="60" r="4"/><circle cx="250" cy="120" r="4"/><circle cx="330" cy="40" r="4"/></svg>
        <a class="login-volver" href="index.html">← ${t.volver}</a>
      </section>
      <section class="login-panel">
        <form class="login-card" novalidate>
          <div class="login-idioma" role="group" aria-label="Idioma / Language"><button type="button" data-lang="es" class="${idioma()==="es"?"on":""}">ES</button><button type="button" data-lang="en" class="${idioma()==="en"?"on":""}">EN</button></div>
          <div class="login-logo">${LOGO}</div>
          <h2>${t.tit}</h2><p class="login-sub">${t.sub}</p>
          <label class="login-campo"><span>${t.usuario}</span><div class="login-inp">${ICO.user}<input name="u" autocomplete="username" autocapitalize="none" spellcheck="false" required></div></label>
          <label class="login-campo"><span>${t.clave}</span><div class="login-inp">${ICO.lock}<input name="c" type="password" autocomplete="current-password" required><button type="button" class="login-ver" aria-label="Mostrar contraseña" title="Mostrar / ocultar">${ICO.eye}</button></div></label>
          <label class="checkbox login-rec"><input type="checkbox" name="r" checked> ${t.recordar}</label>
          <p class="login-err" role="alert" hidden></p>
          <button class="btn-accent login-btn" type="submit">${t.entrar}</button>
          <div class="login-o"><span>${t.o}</span></div>
          <button type="button" class="login-google" ${CONFIG.googleClientId ? "" : "disabled"}>${ICO.google}<span>${t.google}</span>${CONFIG.googleClientId ? "" : `<em>${t.pronto}</em>`}</button>
          <div class="login-gsi" hidden></div>
          <p class="login-nota">${CONFIG.googleClientId ? "" : t.nota}</p>
        </form>
      </section>`;
      const f = raiz.querySelector("form"), err = raiz.querySelector(".login-err"), btn = raiz.querySelector(".login-btn");
      raiz.querySelectorAll("[data-lang]").forEach(b=>b.onclick = ()=>{ try { localStorage.setItem("ingenia.idioma", b.dataset.lang); } catch(e){} document.documentElement.lang = b.dataset.lang; pintar(); });
      const ver = raiz.querySelector(".login-ver"); ver.onclick = ()=>{ const i = f.c; i.type = i.type==="password" ? "text" : "password"; ver.classList.toggle("on", i.type==="text"); i.focus(); };
      f.onsubmit = async e=>{
        e.preventDefault(); err.hidden = true;
        if(!f.u.value.trim() || !f.c.value){ err.textContent = t.vacio; err.hidden = false; return; }
        btn.disabled = true; btn.textContent = t.verificando;
        const r = await iniciarSesion(f.u.value, f.c.value, f.r.checked);
        if(!r.ok){ btn.disabled = false; btn.textContent = t.entrar; err.textContent = idioma()==="en" ? (/intentos/.test(r.msg) ? "Too many attempts. Please wait a moment." : "Incorrect username or password.") : r.msg; err.hidden = false; f.c.select(); raiz.querySelector(".login-card").classList.remove("sacude"); void f.offsetWidth; raiz.querySelector(".login-card").classList.add("sacude"); return; }
        raiz.classList.add("saliendo");
        setTimeout(()=>{ raiz.remove(); document.body.classList.remove("con-login"); resolve(r.sesion); }, 260);
      };
      // Google: con el ID de cliente configurado se muestra el botón oficial
      if(CONFIG.googleClientId){
        const g = raiz.querySelector(".login-gsi"), gb = raiz.querySelector(".login-google");
        cargarGoogle().then(()=>{
          google.accounts.id.initialize({ client_id: CONFIG.googleClientId, callback: resp=>{
            const d = datosToken(resp.credential); if(!d || !d.email){ err.textContent = "No se pudo leer la cuenta de Google."; err.hidden = false; return; }
            const s = { id:"g:"+d.sub, usuario:d.email, nombre:d.name||d.email, email:d.email, foto:d.picture||"", metodo:"google", desde:new Date().toISOString() };
            escribir(K_SESION, s, f.r.checked ? localStorage : sessionStorage);
            raiz.remove(); document.body.classList.remove("con-login"); resolve(s);
          } });
          gb.hidden = true; g.hidden = false;
          google.accounts.id.renderButton(g, { theme:"outline", size:"large", width: Math.min(360, g.clientWidth || 320), text:"continue_with", locale: idioma() });
        }).catch(()=>{ gb.disabled = true; });
      }
      setTimeout(()=>{ try { f.u.focus(); } catch(e){} }, 50);
    };
    pintar();
  });
}

/* bloque del usuario en el menú lateral: nombre, rol y botón para salir */
export function bloqueUsuario(){
  const s = sesion(); if(!s) return "";
  const ini = String(s.nombre||s.usuario||"?").trim().split(/\s+/).map(x=>x[0]).join("").slice(0, 2).toUpperCase();
  const en = idioma()==="en";
  return `<div class="usuario">
    ${s.foto && /^https:\/\//.test(s.foto) ? `<img class="usuario-av" src="${esc(s.foto)}" alt="" referrerpolicy="no-referrer">` : `<span class="usuario-av" aria-hidden="true">${esc(ini)}</span>`}
    <div class="usuario-txt"><b title="${esc(s.email||s.usuario)}">${esc(s.nombre||s.usuario)}</b><span>${esc(s.metodo==="google" ? (s.email||"") : (en ? "Administrator" : (s.rol||"Usuario")))}</span></div>
    <button class="usuario-salir" id="btn-salir" title="${en ? "Sign out" : "Cerrar sesión"}" aria-label="${en ? "Sign out" : "Cerrar sesión"}"><svg class="icon" viewBox="0 0 24 24"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/></svg></button>
  </div>`;
}

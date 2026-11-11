/* Ingenia — actualización automática.
   Los navegadores (sobre todo en celular) reabren la página desde su caché y pueden seguir mostrando
   una versión anterior. Al abrir la página, y cada vez que vuelve a primer plano, se consulta la versión
   publicada (js/version.js, sin caché); si es más nueva que la cargada, se renuevan en la caché todos los
   archivos de la página y se recarga una sola vez. */
import { VERSION } from "./version.js";

const CLAVE = "ingenia.recarga";
let ultima = 0;

export async function comprobarVersion(){
  if(Date.now() - ultima < 60000) return;      // como máximo una consulta por minuto
  ultima = Date.now();
  try{
    const r = await fetch("js/version.js?t=" + Date.now(), { cache:"no-store" });
    if(!r.ok) return;
    const m = (await r.text()).match(/VERSION\s*=\s*"([^"]+)"/);
    const publicada = m && m[1];
    if(!publicada || publicada <= VERSION) return;          // "AAAA-MM-DD HH:MM": se compara como texto
    if(sessionStorage.getItem(CLAVE) === publicada) return;  // ya se intentó en esta sesión: no repetir
    sessionStorage.setItem(CLAVE, publicada);
    const propios = performance.getEntriesByType("resource").map(e=>e.name).filter(u=>u.startsWith(location.origin));
    const urls = [...new Set([location.href.split("#")[0], ...propios, new URL("js/version.js", location.href).href])];
    await Promise.all(urls.map(u=>fetch(u, { cache:"reload" }).catch(()=>{})));
    location.reload();
  }catch(e){ /* sin conexión: se mantiene la versión cargada */ }
}

document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible") comprobarVersion(); });
window.addEventListener("pageshow", ev=>{ if(ev.persisted) comprobarVersion(); });   // página restaurada desde la caché "atrás/adelante"

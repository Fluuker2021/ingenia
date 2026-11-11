/* Ingenia — utilidades de interfaz (render, modal, toast, iconos, archivos) */
export const $ = (sel, root=document) => root.querySelector(sel);
export const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
export const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const html = (strings, ...vals) => strings.map((s,i)=> s + (i<vals.length ? (Array.isArray(vals[i]) ? vals[i].join("") : vals[i] ?? "") : "")).join("");

export const ICON = {
  plus:'<svg class="icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  download:'<svg class="icon" viewBox="0 0 24 24"><path d="M12 4v12m0 0 4-4m-4 4-4-4M4 20h16"/></svg>',
  upload:'<svg class="icon" viewBox="0 0 24 24"><path d="M12 16V4m0 0 4 4m-4-4-4 4M4 20h16"/></svg>',
  open:'<svg class="icon" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M19 14v6H5V6h6"/></svg>',
  trash:'<svg class="icon" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>',
  check:'<svg class="icon" viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></svg>',
  settings:'<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.1-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2.1 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9c.6.5 1.3.9 2.1 1.2L10 21h4l.5-2.6c.8-.3 1.5-.7 2.1-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z"/></svg>',
  back:'<svg class="icon" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  file:'<svg class="icon" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v4h4"/></svg>',
  edit:'<svg class="icon" viewBox="0 0 24 24"><path d="M4 20h4l10-10-4-4L4 16v4Z"/><path d="m13 7 4 4"/></svg>',
};

export function toast(msg, err=false, ms=3200){
  const t = document.createElement("div"); t.className = "toast"+(err?" err":""); t.textContent = msg; document.body.appendChild(t);
  setTimeout(()=>t.remove(), ms);
}

// persistente: true → el modal no se cierra al hacer clic en el fondo ni muestra la ✕;
// solo se cierra con los botones [data-close] del pie (p. ej. «Cancelar») o desde el propio flujo (close()).
export function modal({ title, body, footer, onMount, width, persistente=false }){
  const root = $("#modal-root");
  root.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" ${width?`style="width:min(${width}px,100%)"`:""}>
    <div class="card-head"><h2>${esc(title)}</h2>${persistente ? "" : '<button class="btn-ghost btn-sm" data-close aria-label="Cerrar">✕</button>'}</div>
    <div class="card-body">${body}</div>
    ${footer!==null ? `<div class="modal-foot">${footer||'<button data-close>Cerrar</button>'}</div>` : ""}
  </div></div>`;
  const close = ()=>{ root.innerHTML = ""; };
  $$("[data-close]", root).forEach(b=>b.addEventListener("click", close));
  if(!persistente) root.firstElementChild.addEventListener("click", e=>{ if(e.target===root.firstElementChild) close(); });
  if(onMount) onMount(root, close);
  return close;
}
export function confirmar(title, text, okLabel="Confirmar"){
  return new Promise(res=>{
    modal({ title, body:`<p>${esc(text)}</p>`, footer:`<button data-close>Cancelar</button><button class="btn-primary" data-ok>${esc(okLabel)}</button>`,
      onMount:(root, close)=>{ $("[data-ok]", root).addEventListener("click", ()=>{ close(); res(true); }); $$("[data-close]", root).forEach(b=>b.addEventListener("click", ()=>res(false))); } });
  });
}

export function leerComoArrayBuffer(file){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=()=>rej(r.error); r.readAsArrayBuffer(file); }); }
export function leerComoTexto(file){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=()=>rej(r.error); r.readAsText(file, "latin1"); }); }
export function leerComoDataURL(file){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=()=>rej(r.error); r.readAsDataURL(file); }); }

export function dropzone(el, accept, onFile){
  const input = document.createElement("input"); input.type="file"; input.accept = accept; input.style.display="none"; el.appendChild(input);
  el.addEventListener("click", ()=>input.click());
  input.addEventListener("change", ()=>{ if(input.files[0]) onFile(input.files[0]); input.value=""; });
  el.addEventListener("dragover", e=>{ e.preventDefault(); el.classList.add("over"); });
  el.addEventListener("dragleave", ()=>el.classList.remove("over"));
  el.addEventListener("drop", e=>{ e.preventDefault(); el.classList.remove("over"); const f = e.dataTransfer.files[0]; if(f) onFile(f); });
}
export const fmtFecha = d => d ? new Date(d).toLocaleDateString("es-PE", { year:"numeric", month:"short", day:"2-digit" }) : "—";
export const hoy = () => new Date().toISOString().slice(0,10);
export const kb = n => n>1048576 ? (n/1048576).toFixed(1)+" MB" : Math.round(n/1024)+" KB";

/* Ingenia — utilidades de las tablas de DATOS DE ENTRADA:
   · arrastrarFilas: manteniendo presionado el clic en un espacio libre de una fila (no en sus campos) se la sube o baja
     con el mouse (o el dedo); al soltar se aplica el nuevo orden.
   · colorTablero: cuando una misma tabla tiene filas de varios tableros (o transformadores), cada grupo lleva un fondo
     de bajo contraste para distinguirlos. Solo en los datos de entrada: la vista previa y los entregables no cambian. */

const INTERACTIVO = "input, select, textarea, button, a, label, [contenteditable]";

/* tbody: cuerpo de la tabla con filas <tr data-i>; mover(desde, hasta): aplica el cambio de orden en los datos */
export function arrastrarFilas(tbody, mover){
  if(!tbody) return;
  tbody.classList.add("filas-movibles");
  tbody.addEventListener("pointerdown", ev=>{
    if(ev.button !== 0 || ev.target.closest(INTERACTIVO)) return;
    const tr = ev.target.closest("tr[data-i]"); if(!tr || !tbody.contains(tr)) return;
    const filas = () => [...tbody.querySelectorAll(":scope > tr[data-i]")];
    if(filas().length < 2) return;
    const desde = filas().indexOf(tr), y0 = ev.clientY;
    let activo = false, temporizador = null;
    const iniciar = () => { if(activo) return; activo = true; tr.classList.add("fila-arrastrada"); document.body.classList.add("arrastrando-fila"); };
    temporizador = setTimeout(iniciar, 180);   // mantener presionado
    const mov = e => {
      if(!activo){ if(Math.abs(e.clientY - y0) > 5) iniciar(); else return; }
      e.preventDefault();
      // la fila se reubica entre sus vecinas según la posición del puntero
      for(const o of filas()){ if(o===tr) continue; const r = o.getBoundingClientRect(), mid = r.top + r.height/2;
        const antes = filas().indexOf(tr) < filas().indexOf(o);
        if(antes && e.clientY > mid){ o.after(tr); break; }
        if(!antes && e.clientY < mid){ o.before(tr); break; } }
    };
    const fin = () => {
      clearTimeout(temporizador);
      window.removeEventListener("pointermove", mov); window.removeEventListener("pointerup", fin); window.removeEventListener("pointercancel", fin);
      if(!activo) return;
      tr.classList.remove("fila-arrastrada"); document.body.classList.remove("arrastrando-fila");
      const hasta = filas().indexOf(tr);
      if(hasta !== desde && hasta >= 0) mover(desde, hasta);
    };
    window.addEventListener("pointermove", mov, { passive:false }); window.addEventListener("pointerup", fin); window.addEventListener("pointercancel", fin);
  });
}

/* mueve un elemento de un arreglo de la posición i a la j */
export function moverEn(arr, i, j){ const [x] = arr.splice(i, 1); arr.splice(j, 0, x); }

/* clases de color por grupo (tablero / transformador): null si la tabla tiene un solo grupo */
export function colorTablero(claves){
  const orden = [...new Set(claves.filter(k=>k!=null && k!==""))];
  if(orden.length < 2) return () => "";
  return k => { const i = orden.indexOf(k); return i < 0 ? "" : `grupo-tab grupo-tab-${i % 6}`; };
}

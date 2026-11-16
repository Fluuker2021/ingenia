/* Ingenia — piezas de planos tomadas de los planos de referencia del usuario.
   Los planos de referencia (DWG) se convirtieron a DXF y se extrajeron sus piezas con
   tools/planos/extraer_kit.py → assets/plantillas/planos/<nombre>.json. Cada pieza conserva la geometría,
   capas, colores, tipos de línea y textos del plano original; los textos variables son marcadores {clave}
   que se reemplazan con los datos del proyecto. Los planos de Ingenia se arman colocando estas piezas. */

const cache = {};
export function cargarKit(nombre){
  if(!cache[nombre]) cache[nombre] = fetch(`assets/plantillas/planos/${nombre}.json`).then(r=>{ if(!r.ok) throw new Error("No se encontró el kit de plano "+nombre); return r.json(); });
  return cache[nombre];
}
/* capas y tipos de línea del plano de referencia en el documento DXF */
export function usarKit(doc, kit){
  Object.assign(doc.capas, kit.capas||{});
  Object.assign(doc.tiposLinea, kit.tipos_linea||{});
}

/* caja aproximada de una primitiva (coordenadas de la pieza) */
function caja(e){
  const t = e[0];
  if(t==="L") return [Math.min(e[4],e[6]), Math.min(e[5],e[7]), Math.max(e[4],e[6]), Math.max(e[5],e[7])];
  if(t==="C"||t==="A") return [e[4]-e[6], e[5]-e[6], e[4]+e[6], e[5]+e[6]];
  if(t==="P"){ const xs = e[5].filter((_,i)=>i%2===0), ys = e[5].filter((_,i)=>i%2===1); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
  if(t==="S"){ const xs = [e[4],e[6],e[8],e[10]], ys = [e[5],e[7],e[9],e[11]]; return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
  if(t==="T"){ const h = e[6], w = String(e[8]).length*h*0.62; const r = (e[7]||0)*Math.PI/180; const ca = Math.cos(r), sa = Math.sin(r);
    const ox = [0,-w/2,-w][e[9]]||0, oy = [0,0,-h/2,-h][e[10]]||0;
    const pts = [[ox,oy],[ox+w,oy],[ox,oy+h],[ox+w,oy+h]].map(([x,y])=>[e[4]+x*ca-y*sa, e[5]+x*sa+y*ca]);
    return [Math.min(...pts.map(p=>p[0])), Math.min(...pts.map(p=>p[1])), Math.max(...pts.map(p=>p[0])), Math.max(...pts.map(p=>p[1]))]; }
  return null;
}
const dentro = (b, r)=> b && b[0]>=r[0] && b[1]>=r[1] && b[2]<=r[2] && b[3]<=r[3];

/* divide un texto en líneas de hasta n caracteres */
export function envolver(s, n){
  const out = []; let cur = "";
  for(const w of String(s||"").split(/\s+/)){ if(!w) continue; if((cur+" "+w).trim().length > n){ if(cur) out.push(cur); cur = w; } else cur = (cur+" "+w).trim(); }
  if(cur) out.push(cur);
  return out;
}

/* dibuja la pieza `nombre` con su ancla en (x, y), escala s.
   vars: valores de los marcadores; omitir: rectángulos (coordenadas de la pieza) cuyas primitivas no se dibujan;
   lineas: { clave: n } divide el valor en líneas de n caracteres (el valor también puede traer "\n") */
export function pieza(doc, kit, nombre, x, y, { s=1, vars={}, omitir=[], lineas={}, quitar=null, texto=null }={}){
  const pz = kit.piezas[nombre]; if(!pz) return;
  const X = v=>x+v*s, Y = v=>y+v*s;
  for(const e0 of pz.e){
    let e = e0;
    if(omitir.length){ const b = caja(e); if(omitir.some(r=>dentro(b, r))) continue; }
    if(e[0]==="T"){
      // quitar: textos que no aplican (p. ej. referencias a hojas que no se generan); texto: transforma un texto fijo
      if(quitar && quitar.test(String(e[8]).trim())) continue;
      if(texto){ const t2 = texto(String(e[8]), e); if(t2==null || t2==="") continue; if(t2!==e[8]){ e = e.slice(); e[8] = t2; } }
    }
    const t = e[0], lay = e[1], o = { c: e[2], lt: e[3] };
    if(t==="L") doc.line(X(e[4]), Y(e[5]), X(e[6]), Y(e[7]), lay, o);
    else if(t==="C") doc.circle(X(e[4]), Y(e[5]), e[6]*s, lay, o);
    else if(t==="A") doc.arc(X(e[4]), Y(e[5]), e[6]*s, e[7], e[8], lay, o);
    else if(t==="P"){ const pts = []; for(let i=0;i<e[5].length;i+=2) pts.push([X(e[5][i]), Y(e[5][i+1])]); if(e[4]) pts.push(pts[0]); doc.polyline(pts, lay, o); }
    else if(t==="S") doc.solid([[X(e[4]),Y(e[5])],[X(e[6]),Y(e[7])],[X(e[8]),Y(e[9])],[X(e[10]),Y(e[11])]], lay, o);
    else if(t==="T"){
      let txt = String(e[8]); let clave = null;
      if(txt.includes("{")) txt = txt.replace(/\{(\w+)\}/g, (m,k)=>{ clave = k; const v = vars[k]; return v==null ? "" : String(v); });
      if(!txt.trim()) continue;
      let filas = txt.split("\n");
      if(clave && lineas[clave]) filas = filas.flatMap(f=>envolver(f, lineas[clave]));
      const h = e[6]*s, rot = e[7]||0, r = rot*Math.PI/180, paso = h*1.6667;
      // centrado vertical (73 = 2): el bloque de líneas queda centrado en el punto, no solo la primera línea
      const ini = (e[10]===2 && filas.length>1) ? -(filas.length-1)/2 : 0;
      filas.forEach((f, i)=>{
        if(!f.trim()) return;
        // cada línea adicional se desplaza «hacia abajo» del texto (perpendicular a su dirección)
        const k = i + ini, dx = Math.sin(r)*paso*k, dy = -Math.cos(r)*paso*k;
        doc.text(X(e[4])+dx, Y(e[5])+dy, h, f, lay, { rot, halign:e[9]||0, valign:e[10]||0, wf:e[11], c:e[2] });
      });
    }
  }
}

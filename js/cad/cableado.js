/* Ingenia — datos de cableado del multifilar (Datos del multifilar): aislamiento y colores de los conductores.
   Las piezas del multifilar rotulan cada conductor con tres textos seguidos «calibre · color · aislamiento»
   (p. ej. «14 AWG / Negro / THW-90») y cada barra con «Cu · 20x5 mm · color». Al generar el plano esos textos se
   reemplazan por los del proyecto según su contexto (barra de fase, conductor de fuerza, de control o de tierra). */
import { datos } from "../datos.js";

export const CABLEADO_DEF = { aislamiento:"THW-90", L1:"Rojo", L2:"Negro", L3:"Azul", fuerza:"Negro", control:"Azul", tierra:"Verde/amarillo" };
export const AISLAMIENTOS = ["THW-90", "THHN/THWN-2", "XHHW-2", "TW", "NH-80", "LSOH-90", "H07V-K", "H07Z1-K (LSOH)"];
export const COLORES = ["Negro", "Rojo", "Azul", "Blanco", "Gris", "Marrón", "Naranja", "Amarillo", "Violeta", "Celeste", "Verde", "Verde/amarillo"];
export const PRESETS_CABLEADO = [
  { id:"actual", nombre:"Rojo · negro · azul (tierra verde/amarillo)", v:{ L1:"Rojo", L2:"Negro", L3:"Azul", fuerza:"Negro", control:"Azul", tierra:"Verde/amarillo" } },
  { id:"nec", nombre:"NEC 208/480 V: negro · rojo · azul (tierra verde)", v:{ L1:"Negro", L2:"Rojo", L3:"Azul", fuerza:"Negro", control:"Rojo", tierra:"Verde" } },
  { id:"iec", nombre:"IEC 60445: marrón · negro · gris (tierra verde/amarillo)", v:{ L1:"Marrón", L2:"Negro", L3:"Gris", fuerza:"Negro", control:"Rojo", tierra:"Verde/amarillo" } },
];
export function cableado(p){ return Object.assign({}, CABLEADO_DEF, (datos(p).multifilar)||{}); }

/* reemplaza los rótulos de los conductores en un DXFDoc ya dibujado.
   soloComunes: plano de control (sus colores tienen otro significado): solo aislamiento y tierra */
export function aplicarCableado(doc, cfg, soloComunes=false){
  const D = CABLEADO_DEF;
  if(Object.keys(D).every(k=>cfg[k]===D[k])) return;
  let prev = "";
  for(let i = 0; i < doc.entities.length; i++){
    const e = doc.entities[i];
    if(typeof e!=="string" || !e.startsWith("0\nTEXT\n")) continue;
    const m = /\n1\n([^\n]*)/.exec(e); if(!m) continue;
    const t = m[1]; let n = t;
    if(t==="THW-90") n = cfg.aislamiento;
    else if(t==="Verde/amarillo" && /AWG|mm/.test(prev)) n = cfg.tierra;
    else if(!soloComunes && /^(Rojo|Negro|Azul)$/.test(t)){
      if(/\bmm$/.test(prev)) n = { Rojo:cfg.L1, Negro:cfg.L2, Azul:cfg.L3 }[t];          // barras de fase
      else if(/AWG|mm²/.test(prev)) n = t==="Azul" ? cfg.control : t==="Negro" ? cfg.fuerza : t;   // conductores
    }
    if(n && n!==t){
      let e2 = e.slice(0, m.index) + "\n1\n" + n + e.slice(m.index + m[0].length);
      // texto más largo que el original: se angosta (factor de ancho) para ocupar el mismo espacio y no montarse en el vecino
      if(n.length > t.length){ const wf = /\n41\n([\d.]+)/.exec(e2), f0 = wf ? parseFloat(wf[1]) : 1, f1 = Math.max(0.42, f0*t.length/n.length).toFixed(3);
        e2 = wf ? e2.replace(/\n41\n[\d.]+/, "\n41\n" + f1) : e2.replace("\n1\n" + n, "\n1\n" + n + "\n41\n" + f1); }
      doc.entities[i] = e2;
    }
    prev = t;
  }
}

/* Ingenia — plan de la cuenta. Los documentos y planos son parte del plan Profesional (Pro): sin el plan se
   pueden crear proyectos y elegir documentos, pero para abrir y desarrollar un documento se muestra la
   pantalla de actualización. Mientras el pago en línea no esté habilitado, el plan se guarda en este navegador. */
import * as S from "./store.js";
import { $, $$, esc, ICON, toast } from "./ui.js";
import { DOCS } from "./docs.js";

const DIAS_PRUEBA = 14;
export const PLANES = [
  { id:"prueba", nombre:"Prueba", precio:"Gratis", periodo:`${DIAS_PRUEBA} días`, items:["1 proyecto","Todos los documentos y planos","Copito con tus datos","Sin tarjeta"] },
  { id:"pro", nombre:"Profesional", precio:"US$ 60", periodo:"/ mes", destacado:true, items:["1 usuario","Proyectos ilimitados","Excel, Word, planos DXF para AutoCAD y PDF","Logo del cliente","Copito con tus datos"] },
  { id:"equipo", nombre:"Equipo", precio:"US$ 120", periodo:"/ mes", items:["Hasta 3 usuarios","Proyectos compartidos","Todo lo del plan Profesional","Copito con IA"] },
  { id:"empresa", nombre:"Empresa", precio:"A medida", periodo:"", items:["Usuarios ilimitados","Logo y firmas de la organización en todos los entregables","Capacitación y soporte prioritario","Factura"] },
];

const hoyISO = () => new Date().toISOString().slice(0,10);
export function cuenta(state){ state.cuenta = state.cuenta || { plan:"gratis" }; return state.cuenta; }
/* plan con acceso a los documentos: Profesional, Equipo, Empresa o una prueba vigente */
export function esPro(state){
  const c = cuenta(state);
  if(["pro","equipo","empresa"].includes(c.plan)) return true;
  return c.plan==="prueba" && !!c.pruebaHasta && hoyISO() <= c.pruebaHasta;
}
export function nombrePlan(state){
  const c = cuenta(state);
  if(c.plan==="prueba") return esPro(state) ? `Prueba (hasta el ${c.pruebaHasta.split("-").reverse().join("/")})` : "Prueba vencida";
  return (PLANES.find(x=>x.id===c.plan)||{ nombre:"Gratuito" }).nombre;
}

/* tipo de archivo que entrega cada documento */
const FORMATO_TIPO = { lista:"EXCEL", documento:"WORD", calculo:"WORD", plano:"AUTOCAD" };
export function tipoArchivo(e){
  const d = DOCS[e.id]; const f = d && (d.alias ? DOCS[d.alias].formato : d.formato);
  return { xlsx:"EXCEL", docx:"WORD", dxf:"AUTOCAD" }[f] || FORMATO_TIPO[e.tipo] || "EXCEL";
}
/* etiqueta del documento: con plan Pro, el tipo de archivo; sin él, «Pro» */
export function etiquetaDoc(e, state){
  // tipo de archivo en texto simple, entre paréntesis y sin color: «(EXCEL)»
  return esPro(state) ? `<span class="tipo-doc">(${String(tipoArchivo(e)).toUpperCase()})</span>` : `<span class="badge badge-pro" title="Disponible con el plan Profesional">Pro</span>`;
}

function tarjetasPlanes(state){
  const c = cuenta(state);
  return `<div class="planes-app">${PLANES.map(pl=>`<div class="plan-app ${pl.destacado?"destacado":""} ${c.plan===pl.id?"actual":""}">
      ${pl.destacado ? `<span class="etq">Recomendado</span>` : ""}
      <h3>${esc(pl.nombre)}</h3><div class="precio"><b>${esc(pl.precio)}</b> <span>${esc(pl.periodo)}</span></div>
      <ul>${pl.items.map(i=>`<li>${esc(i)}</li>`).join("")}</ul>
      ${pl.id==="prueba" ? (c.pruebaUsada ? `<button disabled>Prueba ya utilizada</button>` : `<button data-plan="prueba">Probar ${DIAS_PRUEBA} días gratis</button>`)
        : pl.id==="empresa" ? `<a class="btn" href="index.html#planes">Consultar</a>`
        : c.plan===pl.id ? `<button disabled>${ICON.check} Plan actual</button>` : `<button class="${pl.destacado?"btn-accent":""}" data-plan="${pl.id}">Activar ${esc(pl.nombre)}</button>`}
    </div>`).join("")}</div>
    <p class="muted" style="font-size:12px">El pago en línea se habilitará con tu cuenta de Google desde «Entrar». Mientras tanto, el plan activado se guarda en este navegador.</p>`;
}
function enlazarPlanes(root, state, alActivar){
  $$("[data-plan]", root).forEach(b=>b.onclick = ()=>{
    const c = cuenta(state), plan = b.dataset.plan;
    if(plan==="prueba"){ const d = new Date(); d.setDate(d.getDate()+DIAS_PRUEBA); Object.assign(c, { plan:"prueba", pruebaHasta:d.toISOString().slice(0,10), pruebaUsada:true }); }
    else c.plan = plan;
    S.save(); toast(`Plan ${nombrePlan(state)} activado`); alActivar();
  });
}

/* pantalla de actualización al abrir un documento sin plan Pro */
export function pantallaPro(main, state, p, e, topbar){
  main.innerHTML = topbar({ crumbs:[{label:"Proyectos", href:"#/proyectos"},{label:p.nombre, href:`#/proyecto/${p.id}/documentos`},{label:e.nombre}], title:e.nombre,
    actions:`<a class="btn" href="#/proyecto/${p.id}/documentos">${ICON.back} Documentos</a>` }) +
    `<div class="card pro-aviso"><div class="card-body"><span class="badge badge-pro">Pro</span><h2>Actualiza tu plan para desarrollar este documento</h2>
      <p class="muted">«${esc(e.nombre)}» (${tipoArchivo(e)}) es parte del plan Profesional. Tu plan actual: <strong>${esc(nombrePlan(state))}</strong>. Puedes seguir eligiendo documentos y preparando el proyecto; para abrirlos, activa un plan.</p></div></div>
    <div id="pro-planes"></div>`;
  const box = $("#pro-planes");
  box.innerHTML = tarjetasPlanes(state);
  enlazarPlanes(box, state, ()=>window.dispatchEvent(new HashChangeEvent("hashchange")));
}

/* Configuración → Mi plan */
export function screenPlan(main, state, topbar){
  main.innerHTML = topbar({ crumbs:[{label:"Configuración"},{label:"Mi plan"}], title:"Mi plan", sub:`Plan actual: <strong>${esc(nombrePlan(state))}</strong>` }) + `<div id="pro-planes"></div>`;
  const box = $("#pro-planes");
  box.innerHTML = tarjetasPlanes(state);
  enlazarPlanes(box, state, ()=>screenPlan(main, state, topbar));
}

/* Ingenia — DIAGRAMA MULTIFILAR DEL TABLERO DE FUERZA armado con las piezas del multifilar de referencia del
   usuario (assets/plantillas/planos/multifilar.json):
   · hoja de acometida: interruptor general, barras L1-L2-L3-PE, luces piloto, relé de monitoreo de tensión,
     supresor de sobretensiones y parada de emergencia con bobina de mínima tensión (tal como el plano de
     referencia, con los datos del proyecto);
   · hojas de fuerza: una columna por circuito (variador con filtro y bornes, guardamotor + contactor,
     arrancador suave, alimentador, transformador de control) colgada de las barras;
   · hojas de secundarios: las derivaciones de cada transformador de control (con diferencial donde aplica).
   Las referencias cruzadas a las hojas de control del plano original se retiran. */
import { DXFDoc } from "../engine/tablero-core.js";
import { dibujarLamina, PASO_HOJAS } from "./formato.js";
import { calcularTablero, calcularTodos, tf, desdeTxt, r2, datos } from "../datos.js";
import { valoresDiseno } from "../modules/criterios.js";
import { cargarKit, usarKit, pieza } from "./kit.js";
import { tagBornera, borneFuerza, barraFase, barraTierra } from "../mecanico/componentes.js";
import { repartirEquilibrado } from "./plano-unifilar.js";
import { extremosSueltos } from "./revision.js";

const DX = 25, DY = -108;                        // hoja del plano de referencia → área útil de la lámina A1
// barras a la altura de las derivaciones y de las flechas de las piezas (y = …,85): con …,51 quedaban 0,34 mm abiertas
const BARRAS = [664.85, 648.85, 632.85], PE_Y = 616.85;
const X_FLECHA = 44;                               // punta de las flechas de entrada de barras (b_entrada / c_entrada)
const X_INI = 100, X_FIN = 737;                   // zona de columnas entre la entrada y la salida de barras
const X_COL = 652;                                 // las columnas bajan hasta el pie de la lámina: no pasan del bloque reservado del cajetín (x 684 de la lámina)
const ANCHO = { b_vfd:220, b_mcp:90, b_trafo:107, c_rama:78, c_rama_id:96 };
const EJES = { b_vfd:[97,113,129], b_mcp:[39,55,71], b_trafo:[53,85] };
const PE_X = { b_vfd:145, b_mcp:87, b_trafo:101 };
const EJES_RAMA = { c_rama:[32, 64], c_rama_id:[46, 78] };   // fase y neutro de las derivaciones del secundario
// zonas omitidas (coordenadas de la pieza) y tramos de conductor que las reemplazan
const OMITIR = { contactor:[0,393,80,423], auxiliares:[0,512,34,563], motor:[34,190,92,236], filtro:[-20,342,138,494] };
const PUENTE = { contactor:[420.9,404.9], filtro:[492.9,342.9] };
// referencias cruzadas a otras hojas del plano original (control) y textos propios del variador
const REF = /^\/?\s*\d+\.[A-H]:\d+\s*\/?$|^\/$|^(CB|ID|RF)\d*\.\d+$|^RL\d*\.T\d+$/;
const SOLO_VFD = /^(DC Bus Terminals|Dynamic Brake Resistor|Filtering and|Leistung Klemme Block)/;

const awgTxt = s => String(s||"").replace(/\s*AWG/i," AWG").replace(/\s*kcmil/i," kcmil");
const item = (c, re) => c.items.find(x=>re.test(x.comp)) || {};
const sinMarca = s => String(s||"").replace(/^ABB\s+/,"").replace(/\s*\(.*$/,"");
const amps = v => String(v||"").replace(/^\d+x/i,"");

function columnas(calc, g){
  let nMotor = 0;
  return calc.circuits.map(c=>{
    const l = c.load || {}, m = c.conductorMemo;
    const awg = m && m.cable ? awgTxt(m.cable[0]) : null, egc = m && m.egc ? awgTxt(m.egc[1]) : awg;
    const desc = (l.desc || c.descLabel || "").toUpperCase(), partes = desc.split(/\s+/);
    const mitad = Math.ceil(partes.length/2), d1 = partes.slice(0, mitad).join(" "), d2 = partes.slice(mitad).join(" ");
    const motor = { m:"-"+(l.tag||("M"+(++nMotor))), hp:`${l.power} ${l.powerUnit==="hp"?"HP":"kW"}`, v:`${g.voltage} Vac`, amp:`${r2(c.installedCurrent,1)} A`, tag:l.tag||"", desc1:d1, desc2:d2 };
    if(c.kind==="control"){
      const f = item(c, /^Portafusible/), t = item(c, /^Transformador|^Fuente/), q = item(c, /^ITM principal/);
      const ramas = c.items.filter(x=>/^QC\d+\./.test(x.devtag||"")).map((x,i)=>({ pieza: /tomacorriente/i.test(x.comp) ? "c_rama_id" : "c_rama",
        vars:{ q:x.devtag, qv:amps(String(x.val||"").split(" · ")[0]), qm:"S202-C"+parseFloat(amps(x.val)), desc:String(x.comp||"").toUpperCase(), id:"-ID"+(i+1), idm:"30 mA", idv:"25 A", idmod:"FH202 AC" } }));
      return { pieza:"b_trafo", ramas, vars:{ f1:(f.devtag||"F")+".1", f2:(f.devtag||"F")+".2", fv:f.val||"", fm:"E91/32", t:t.devtag||"", tv:(String(t.val||"").match(/^[\d.]+\s*k?VA/i)||[""])[0].replace(/\s+/g,""),
        tm:t.model||"", vp:`${g.voltage}V`, vs:`${g.ctrlVoltage}V`, q:q.devtag||"", qv:amps(q.val), qm:"S202-C"+parseFloat(amps(q.val)) } };
    }
    if(c.kind==="motor" && (l.starter==="vfd" || l.starter==="ss")){
      const q = item(c, /^ITM/), f = item(c, /^Portafusible/), rl = item(c, /^Filtro de l[ií]nea/), v = item(c, /^Variador|^Arrancador suave/);
      const vars = Object.assign(motor, { q:q.devtag, qv:amps(q.val), qm:sinMarca(q.model), f:f.devtag, fv:f.val, fm:sinMarca(f.model).replace(/\s*\+.*$/,""), rl:rl.devtag, rlm:sinMarca(rl.model), rlv:rl.val, vfd:v.devtag, vfdm:sinMarca(v.model), vfdv:v.val, vfdtxt:sinMarca(v.model) });
      return { pieza:"b_vfd", ss: l.starter==="ss", omitir: l.starter==="ss" || !rl.devtag ? ["filtro"] : [], vars, awg, egc };
    }
    if(c.kind==="motor"){
      const q = item(c, /^Guardamotor|^ITM/), k = item(c, /^Contactor/);
      const bm = borneFuerza(parseFloat(String(q.val||"").replace(/[^\d.]/g,"")) || c.installedCurrent);
      return { pieza:"b_mcp", vars: Object.assign(motor, { q:q.devtag, qv:q.val, qm:sinMarca(q.model), k:k.devtag, kv:k.val, km:sinMarca(k.model), aux:"HKF1-11+HK1-11", tb:tagBornera(c.tag), tbs:bm.replace(/^\D+/,"")+" mm2", tbm:bm, tbpe:bm+"-PE" }), awg, egc };
    }
    const q = item(c, /^ITM/), bf = borneFuerza(c.installedCurrent);
    return { pieza:"b_mcp", omitir:["contactor","auxiliares","motor"], vars:{ q:q.devtag, qv:amps(q.val), qm:sinMarca(q.model), tb:tagBornera(c.tag), tbs:bf.replace(/^\D+/,"")+" mm2", tbm:bf, tbpe:bf+"-PE", tag:l.tag||"", desc1:d1, desc2:d2 }, awg, egc };
  });
}

export async function multifilarKit({ p, valsDe, cliente, id }){
  const notasU = datos(p).notas[id || "ele-multifilar"] || [];
  const kit = await cargarKit("multifilar");
  const calcs = calcularTodos(p);
  const lista = calcs.length ? calcs : [calcularTablero(p, tf(p))];
  const v = valoresDiseno(p);
  const doc = new DXFDoc(); usarKit(doc, kit);
  // plan de hojas por tablero: acometida, fuerza (columnas) y secundarios de cada transformador
  const planes = lista.map(calc=>{
    const cols = columnas(calc, calc.g);
    // reparto equilibrado: las láminas quedan con anchos parecidos y las columnas centradas en cada una
    const fuerza = cols.length ? repartirEquilibrado(cols, c=>ANCHO[c.pieza], X_COL - X_INI) : [];
    const sec = cols.filter(c=>c.pieza==="b_trafo").flatMap(c=>(c.ramas.length ? repartirEquilibrado(c.ramas, r=>ANCHO[r.pieza], X_COL - 70) : []).map(rs=>({ trafo:c, ramas:rs })));
    return { calc, fuerza, sec, n: 1 + fuerza.length + sec.length };
  });
  const total = planes.reduce((a,x)=>a+x.n, 0);
  let k = 0;
  for(const { calc, fuerza, sec, n } of planes){
    const t = calc.tablero, g = calc.g, base = k;   // base: índice de la hoja de acometida del tablero
    const bF = barraFase(calc.mainBreaker || 100), bPE = barraTierra(bF);
    const barraTxt = s => s.trim()==="20x5 mm" ? `${bF.nombre} mm` : s.trim()==="20x3 mm" ? `${bPE.nombre} mm` : s;
    const lam = (titulo2)=>{ dibujarLamina(doc, k*PASO_HOJAS, 0, valsDe(k, total, { TITULO2: titulo2 }), cliente); return k*PASO_HOJAS; };
    const nombre = `${(t.nombre||"").toUpperCase()} ${t.tag}`;
    // 1) acometida
    let ox = lam(`${nombre} - ACOMETIDA`);
    // la leyenda de conexión se separa del marco izquierdo lo mismo que del cajetín (≈5 mm)
    pieza(doc, kit, "h_acometida", ox+DX, DY, { lineas:{ acometida:16, notas:48 }, texto: barraTxt, mover:[{ r:[-0.6, 157, 117, 192], dx:5, dy:0 }], vars:{
      acometida:`VIENE DE ${String(desdeTxt(p, t)||"").toUpperCase()}`, alim:`Alimentación\n${g.voltage} V ${g.freq} Hz 3F\n+PE`,
      q:"Q1", qv:`${calc.mainBreaker}A`, qm:`Tmax XT ${calc.mainBreaker}A 3P (Ekip LS/I)`, t1:`${g.voltage}/120Vac+T`, vp:`${g.voltage}V`, vs:"120V",
      notas: notasU.length ? "NOTAS :\n" + notasU.map((n, i)=>`${i+1}.${n}`).join("\n") : `NOTAS :\n1.LA ACOMETIDA PARA EL ${nombre} DE ${g.voltage} Vac, 3F + T, ${g.freq} HZ ES SUMINISTRADA POR EL CLIENTE.\n2.BARRA A TIERRA FIJA DEL TABLERO DE FUERZA Y CONTROL.\n3.LOS EQUIPOS ELÉCTRICOS Y DE PROTECCIÓN ESTÁN DISEÑADOS Y FABRICADOS PARA TRABAJAR A ${v.altitud} m.s.n.m.` } });
    k++;
    // 2) hojas de fuerza
    const hojaSec = new Map(); let ks = base + 1 + fuerza.length;
    for(const s of sec){ if(!hojaSec.has(s.trafo)) hojaSec.set(s.trafo, ks+1); ks++; }
    fuerza.forEach((cols, i)=>{
      ox = lam(`${nombre} - FUERZA${fuerza.length>1 ? ` (${i+1} DE ${fuerza.length})` : ""}`);
      const hoja = k+1, prev = hoja-1, sig = hoja+1;
      pieza(doc, kit, "b_entrada", ox+DX, DY, { texto: s=> s.trim()==="1.H:1" ? `${prev}.H:1` : barraTxt(s) });
      // las barras siguen a la hoja siguiente solo si hay continuación; si no, terminan en la última derivación
      const sigue = i < fuerza.length-1 || sec.length > 0;
      if(sigue) pieza(doc, kit, "b_salida", ox+DX+737, DY, { texto: s=> s.trim()==="3.A:1" ? `${sig}.A:1` : barraTxt(s) });
      const xFinF = [0, 0, 0]; let xFinPE = 0;
      // columnas repartidas en el ancho disponible (separación extra proporcional, sin pasar de 1,25)
      const W = cols.reduce((a,c)=>a+ANCHO[c.pieza], 0), f = Math.min((X_COL - X_INI)/W, 1.25);
      let x = X_INI + ((X_COL - X_INI) - W*f)/2;
      for(const c of cols){
        const a = ANCHO[c.pieza], x0 = x + (a*f - a)/2;
        const om = (c.omitir||[]).map(z=>OMITIR[z]);
        const pe = PE_X[c.pieza];
        pieza(doc, kit, c.pieza, ox+DX+x0, DY, { vars:c.vars, omitir:om, lineas:{ desc:20 }, mover: c.pieza==="b_vfd" ? [{ r:[15.5, 446.5, 21, 450.5], dx:0, dy:2.6 }, { r:[15.5, 418.5, 21, 422.5], dx:0, dy:2.6 }] : [],
          quitar: c.ss ? new RegExp(REF.source+"|"+SOLO_VFD.source) : REF,
          texto: (s, e)=>{ if(c.awg && /^\s*\d+(\/0)?\s*AWG\s*$/i.test(s)) return (e[4] >= pe-1 && e[4] <= pe+9) ? c.egc : c.awg; return barraTxt(s); } });
        for(const z of (c.omitir||[])){ const pz = PUENTE[z]; if(pz) for(const ex of EJES[c.pieza]) doc.line(ox+DX+x0+ex, pz[0]+DY, ox+DX+x0+ex, pz[1]+DY, "E-FZA-BT-PRI"); }
        if(c.pieza==="b_trafo" && hojaSec.has(c)) doc.text(ox+DX+x0+69, 262+DY, 2.5, `A HOJA ${hojaSec.get(c)}`, "G-TEX", { halign:1 });
        // cada barra termina en su última derivación (el eje k de la pieza cuelga de la fase k: L1, L2, L3)
        (EJES[c.pieza]||[]).forEach((ex, k)=>{ xFinF[k] = Math.max(xFinF[k], x0 + ex); }); xFinPE = Math.max(xFinPE, x0 + (PE_X[c.pieza]||0));
        // termistor del variador (T1 / T2): conductor del borne al contacto (en la pieza lo cortaba el rótulo, que sube)
        if(c.pieza==="b_vfd" && !om.some(r=>r[0] <= 13 && r[2] >= 23 && r[1] <= 420 && r[3] >= 449)) for(const y of [448.85, 420.85]) doc.line(ox+DX+x0+15, y+DY, ox+DX+x0+23, y+DY, "EPLAN311");
        x += a*f;
      }
      dibujarBarras(doc, ox, kit, true, sigue ? null : xFinF, sigue ? null : xFinPE);
      k++;
    });
    // 3) secundarios de los transformadores de control
    sec.forEach(s=>{
      const tr = s.trafo.vars;
      ox = lam(`${nombre} - SECUNDARIO ${tr.t}`);
      pieza(doc, kit, "c_entrada", ox+DX, DY, { quitar: /^\/?\s*\d+\.[A-H]:\d+\s*\/?$|^\/$/, texto: x=>({ "CB3.2":`${tr.q}.2`, "CB3.4":`${tr.q}.4` })[x.trim()] || x });
      doc.text(ox+DX+34, BARRAS[0]+DY+3, 2.5, `${tr.t} ${tr.vs} - ${tr.tv}`, "G-TEX");
      // derivaciones repartidas y centradas entre la entrada de barras y el final de la lámina
      const Wr = s.ramas.reduce((a, r)=>a + ANCHO[r.pieza], 0), fr = Math.min((X_COL - 70)/Wr, 1.25);
      let x = 70 + ((X_COL - 70) - Wr*fr)/2, xL = 60, xN = 60;
      for(const r of s.ramas){ const a = ANCHO[r.pieza], x0 = x + (a*fr - a)/2; pieza(doc, kit, r.pieza, ox+DX+x0, DY, { vars:r.vars, quitar:REF, lineas:{ desc:22 } }); const ej = EJES_RAMA[r.pieza] || [32, 64]; xL = x0 + ej[0]; xN = x0 + ej[1]; x += a*fr; }
      // barras del secundario: llegan solo hasta la última derivación
      doc.line(ox+DX+X_FLECHA, BARRAS[0]+DY, ox+DX+xL, BARRAS[0]+DY, "E-FZA-BT-SEC");
      doc.line(ox+DX+X_FLECHA, BARRAS[1]+DY, ox+DX+xN, BARRAS[1]+DY, "E-FZA-BT-SEC");
      doc.line(ox+DX+X_FLECHA, BARRAS[2]+DY, ox+DX+xN, BARRAS[2]+DY, "E-TIERRA");
      k++;
    });
  }
  doc.limpiarUniones(); doc.centrarEnSimbolos();
  // revisión de continuidad: conductores de fuerza, control y tierra que no llegan a ningún borne ni conductor
  const dxf = doc.toDXF();
  const avisos = extremosSueltos(dxf, { capas:/^(E-FZA-BT-PRI|E-FZA-BT-SEC|E-TIERRA|E-CONTROL|EPLAN54\d|EPLAN311)$/ })
    .map(e=>`Hoja ${e.hoja} (${e.zona}): conductor abierto, su extremo no llega a ningún borne ni conductor.`);
  return { dxf, hojas: total, avisos };
}

/* barras L1, L2, L3 (línea de centro) y PE de la hoja de fuerza */
function dibujarBarras(doc, ox, kit, fuerza, xFin, xFinPE){
  if(!fuerza) return;
  // desde la punta de la flecha de entrada (antes pasaban por debajo de la flecha y tachaban su rótulo)
  BARRAS.forEach((y, k)=>doc.line(ox+DX+X_FLECHA, y+DY, ox+DX+(xFin ? (xFin[k] || Math.max(...xFin)) : 762), y+DY, "E-FZA-BT-PRI"));
  doc.line(ox+DX+X_FLECHA, PE_Y+DY, ox+DX+(xFinPE ?? 762), PE_Y+DY, "E-TIERRA");
}

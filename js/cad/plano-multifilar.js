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
import { calcularTablero, calcularTodos, tf, desdeTxt, r2 } from "../datos.js";
import { valoresDiseno } from "../modules/criterios.js";
import { cargarKit, usarKit, pieza } from "./kit.js";

const DX = 25, DY = -112;                        // hoja del plano de referencia → área útil de la lámina A1
const BARRAS = [664.51, 648.51, 632.51], PE_Y = 616.51;
const X_INI = 100, X_FIN = 737;                   // zona de columnas entre la entrada y la salida de barras
const ANCHO = { b_vfd:220, b_mcp:90, b_trafo:107, c_rama:78, c_rama_id:96 };
const EJES = { b_vfd:[97,113,129], b_mcp:[39,55,71], b_trafo:[53,85] };
const PE_X = { b_vfd:145, b_mcp:87, b_trafo:101 };
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
      return { pieza:"b_vfd", ss: l.starter==="ss", omitir: l.starter==="ss" ? ["filtro"] : [], vars, awg, egc };
    }
    if(c.kind==="motor"){
      const q = item(c, /^Guardamotor|^ITM/), k = item(c, /^Contactor/);
      return { pieza:"b_mcp", vars: Object.assign(motor, { q:q.devtag, qv:q.val, qm:sinMarca(q.model), k:k.devtag, kv:k.val, km:sinMarca(k.model), aux:"HKF1-11+HK1-11", tb:"TB"+c.tag.replace(/\D/g,""), tbs:"6 mm2", tbm:"UT 6", tbpe:"UT 6-PE" }), awg, egc };
    }
    const q = item(c, /^ITM/);
    return { pieza:"b_mcp", omitir:["contactor","auxiliares","motor"], vars:{ q:q.devtag, qv:amps(q.val), qm:sinMarca(q.model), tb:"TB"+c.tag.replace(/\D/g,""), tbs:"6 mm2", tbm:"UT 6", tbpe:"UT 6-PE", tag:l.tag||"", desc1:d1, desc2:d2 }, awg, egc };
  });
}
/* reparte columnas en hojas según su ancho */
function repartir(items, anchoDe, util){
  const hojas = [[]]; let w = 0;
  for(const it of items){ const a = anchoDe(it); if(hojas[hojas.length-1].length && w + a > util){ hojas.push([]); w = 0; } hojas[hojas.length-1].push(it); w += a; }
  return hojas[0].length ? hojas : [];
}

export async function multifilarKit({ p, valsDe, cliente }){
  const kit = await cargarKit("multifilar");
  const calcs = calcularTodos(p);
  const lista = calcs.length ? calcs : [calcularTablero(p, tf(p))];
  const v = valoresDiseno(p);
  const doc = new DXFDoc(); usarKit(doc, kit);
  // plan de hojas por tablero: acometida, fuerza (columnas) y secundarios de cada transformador
  const planes = lista.map(calc=>{
    const cols = columnas(calc, calc.g);
    const fuerza = repartir(cols, c=>ANCHO[c.pieza], X_FIN - X_INI);
    const sec = cols.filter(c=>c.pieza==="b_trafo").flatMap(c=>repartir(c.ramas, r=>ANCHO[r.pieza], X_FIN - 70).map(rs=>({ trafo:c, ramas:rs })));
    return { calc, fuerza, sec, n: 1 + fuerza.length + sec.length };
  });
  const total = planes.reduce((a,x)=>a+x.n, 0);
  let k = 0;
  for(const { calc, fuerza, sec, n } of planes){
    const t = calc.tablero, g = calc.g, base = k;   // base: índice de la hoja de acometida del tablero
    const lam = (titulo2)=>{ dibujarLamina(doc, k*PASO_HOJAS, 0, valsDe(k, total, { TITULO2: titulo2 }), cliente); return k*PASO_HOJAS; };
    const nombre = `${(t.nombre||"").toUpperCase()} ${t.tag}`;
    // 1) acometida
    let ox = lam(`${nombre} - ACOMETIDA`);
    pieza(doc, kit, "h_acometida", ox+DX, DY, { lineas:{ acometida:16, notas:48 }, vars:{
      acometida:`VIENE DE ${String(desdeTxt(p, t)||"").toUpperCase()}`, alim:`Alimentación\n${g.voltage} V ${g.freq} Hz 3F\n+PE`,
      q:"Q1", qv:`${calc.mainBreaker}A`, qm:`Tmax XT ${calc.mainBreaker}A 3P (Ekip LS/I)`, t1:`${g.voltage}/120Vac+T`, vp:`${g.voltage}V`, vs:"120V",
      notas:`NOTAS :\n1.LA ACOMETIDA PARA EL ${nombre} DE ${g.voltage} Vac, 3F + T, ${g.freq} HZ ES SUMINISTRADA POR EL CLIENTE.\n2.BARRA A TIERRA FIJA DEL TABLERO DE FUERZA Y CONTROL.\n3.LOS EQUIPOS ELÉCTRICOS Y DE PROTECCIÓN ESTÁN DISEÑADOS Y FABRICADOS PARA TRABAJAR A ${v.altitud} m.s.n.m.` } });
    k++;
    // 2) hojas de fuerza
    const hojaSec = new Map(); let ks = base + 1 + fuerza.length;
    for(const s of sec){ if(!hojaSec.has(s.trafo)) hojaSec.set(s.trafo, ks+1); ks++; }
    fuerza.forEach((cols, i)=>{
      ox = lam(`${nombre} - FUERZA${fuerza.length>1 ? ` (${i+1} DE ${fuerza.length})` : ""}`);
      const hoja = k+1, prev = hoja-1, sig = hoja+1;
      pieza(doc, kit, "b_entrada", ox+DX, DY, { texto: s=> s.trim()==="1.H:1" ? `${prev}.H:1` : s });
      pieza(doc, kit, "b_salida", ox+DX+737, DY, { texto: s=> s.trim()==="3.A:1" ? (i < fuerza.length-1 || sec.length ? `${sig}.A:1` : "") : s });
      dibujarBarras(doc, ox, kit, true);
      // columnas repartidas en el ancho disponible (separación extra proporcional, sin pasar de 1,25)
      const W = cols.reduce((a,c)=>a+ANCHO[c.pieza], 0), f = Math.min((X_FIN - X_INI)/W, 1.25);
      let x = X_INI + ((X_FIN - X_INI) - W*f)/2;
      for(const c of cols){
        const a = ANCHO[c.pieza], x0 = x + (a*f - a)/2;
        const om = (c.omitir||[]).map(z=>OMITIR[z]);
        const pe = PE_X[c.pieza];
        pieza(doc, kit, c.pieza, ox+DX+x0, DY, { vars:c.vars, omitir:om, lineas:{ desc:20 },
          quitar: c.ss ? new RegExp(REF.source+"|"+SOLO_VFD.source) : REF,
          texto: (s, e)=>{ if(c.awg && /^\s*\d+(\/0)?\s*AWG\s*$/i.test(s)) return (e[4] >= pe-1 && e[4] <= pe+9) ? c.egc : c.awg; return s; } });
        for(const z of (c.omitir||[])){ const pz = PUENTE[z]; if(pz) for(const ex of EJES[c.pieza]) doc.line(ox+DX+x0+ex, pz[0]+DY, ox+DX+x0+ex, pz[1]+DY, "E-FZA-BT-PRI"); }
        if(c.pieza==="b_trafo" && hojaSec.has(c)) doc.text(ox+DX+x0+69, 262+DY, 2.5, `A HOJA ${hojaSec.get(c)}`, "G-TEX", { halign:1 });
        x += a*f;
      }
      k++;
    });
    // 3) secundarios de los transformadores de control
    sec.forEach(s=>{
      const tr = s.trafo.vars;
      ox = lam(`${nombre} - SECUNDARIO ${tr.t}`);
      pieza(doc, kit, "c_entrada", ox+DX, DY, { quitar: /^\/?\s*\d+\.[A-H]:\d+\s*\/?$|^\/$/, texto: x=>({ "CB3.2":`${tr.q}.2`, "CB3.4":`${tr.q}.4` })[x.trim()] || x });
      const x1 = X_FIN + 20;
      doc.line(ox+DX+30, BARRAS[0]+DY, ox+DX+x1, BARRAS[0]+DY, "E-FZA-BT-SEC");
      doc.line(ox+DX+30, BARRAS[1]+DY, ox+DX+x1, BARRAS[1]+DY, "E-FZA-BT-SEC");
      doc.line(ox+DX+30, BARRAS[2]+DY, ox+DX+x1, BARRAS[2]+DY, "E-TIERRA");
      doc.text(ox+DX+34, BARRAS[0]+DY+3, 2.5, `${tr.t} ${tr.vs} - ${tr.tv}`, "G-TEX");
      let x = 70;
      for(const r of s.ramas){ pieza(doc, kit, r.pieza, ox+DX+x, DY, { vars:r.vars, quitar:REF, lineas:{ desc:22 } }); x += ANCHO[r.pieza]; }
      k++;
    });
  }
  return { dxf: doc.toDXF(), hojas: total };
}

/* barras L1, L2, L3 (línea de centro) y PE de la hoja de fuerza */
function dibujarBarras(doc, ox, kit, fuerza){
  if(!fuerza) return;
  for(const y of BARRAS) doc.line(ox+DX+24, y+DY, ox+DX+762, y+DY, "E-FZA-BT-PRI");
  doc.line(ox+DX+24, PE_Y+DY, ox+DX+762, PE_Y+DY, "E-TIERRA");
}

/* Ingenia — lector de DXF ASCII (formato de impresión / cajetín del cliente) y vista previa.
   Entrada: texto DXF (R12 a R2018 guardado como "AutoCAD DXF"). No lee DWG: el cliente debe guardar
   el formato como DXF desde AutoCAD (Guardar como → DXF). Salida normalizada:
     { entities:[{t:"L",x1,y1,x2,y2,layer}|{t:"C",cx,cy,r}|{t:"A",cx,cy,r,a1,a2}|{t:"P",closed,pts:[[x,y],...]}|
                 {t:"T",x,y,h,rot,text}|{t:"S",pts:[...]}], bounds:{minX,minY,maxX,maxY}, layers:{nombre:{color}},
       tokens:["{{PLANO}}",...] , space:"paper"|"model" }
   Los INSERT (bloques anidados, p.ej. cajetines armados por bloques) se resuelven aplicando la
   transformación (inserción, escala, rotación) para obtener geometría plana. */

function parsePairs(text){
  const lines = text.split(/\r\n|\r|\n/);
  const pairs = [];
  for(let i=0;i+1<lines.length;i+=2){
    const code = parseInt(lines[i].trim(),10);
    if(isNaN(code)) { i--; continue; }
    pairs.push([code, lines[i+1]]);
  }
  return pairs;
}

function sections(pairs){
  const out = {};
  let i=0;
  while(i<pairs.length){
    if(pairs[i][0]===0 && pairs[i][1].trim()==="SECTION"){
      const name = pairs[i+1][1].trim();
      const start = i+2; let j=start;
      while(j<pairs.length && !(pairs[j][0]===0 && pairs[j][1].trim()==="ENDSEC")) j++;
      out[name] = pairs.slice(start, j);
      i = j+1;
    } else i++;
  }
  return out;
}

// agrupa pares en entidades (cada "0" inicia una entidad)
function groupEntities(pairs){
  const ents = []; let cur=null;
  for(const [c,v] of pairs){
    if(c===0){ cur = {type:v.trim(), data:[]}; ents.push(cur); }
    else if(cur) cur.data.push([c, v]);
  }
  return ents;
}
const num = v => parseFloat(v);
function get(e, code, def){ const p = e.data.find(d=>d[0]===code); return p ? p[1].trim() : def; }
function getAll(e, code){ return e.data.filter(d=>d[0]===code).map(d=>d[1].trim()); }

function parseLayers(tables){
  const layers = {};
  if(!tables) return layers;
  for(const e of groupEntities(tables)){
    if(e.type==="LAYER"){ const name=get(e,2,""); if(name) layers[name] = { color: parseInt(get(e,62,"7"),10), ltype:get(e,6,"CONTINUOUS") }; }
  }
  return layers;
}

function toPrimitive(e){
  const layer = get(e,8,"0"); const space = get(e,67,"0")==="1" ? "paper" : "model";
  const t = e.type;
  if(t==="LINE") return [{t:"L", x1:num(get(e,10)), y1:num(get(e,20)), x2:num(get(e,11)), y2:num(get(e,21)), layer, space}];
  if(t==="CIRCLE") return [{t:"C", cx:num(get(e,10)), cy:num(get(e,20)), r:num(get(e,40)), layer, space}];
  if(t==="ARC") return [{t:"A", cx:num(get(e,10)), cy:num(get(e,20)), r:num(get(e,40)), a1:num(get(e,50)), a2:num(get(e,51)), layer, space}];
  if(t==="LWPOLYLINE"){
    const xs = e.data.filter(d=>d[0]===10).map(d=>num(d[1])); const ys = e.data.filter(d=>d[0]===20).map(d=>num(d[1]));
    const pts = xs.map((x,i)=>[x, ys[i]]);
    return [{t:"P", closed: (parseInt(get(e,70,"0"),10)&1)===1, pts, layer, space}];
  }
  if(t==="SOLID"||t==="TRACE"){
    const pts=[[num(get(e,10)),num(get(e,20))],[num(get(e,11)),num(get(e,21))],[num(get(e,12)),num(get(e,22))],[num(get(e,13)),num(get(e,23))]];
    return [{t:"S", pts, layer, space}];
  }
  if(t==="TEXT"){
    return [{t:"T", x:num(get(e,10)), y:num(get(e,20)), h:num(get(e,40,"2.5")), rot:num(get(e,50,"0")), text:decodeText(get(e,1,"")), align:parseInt(get(e,72,"0"),10), layer, space}];
  }
  if(t==="MTEXT"){
    const text = (getAll(e,3).join("")+get(e,1,"")).replace(/\\P/g," ").replace(/\\[A-Za-z][^;]*;/g,"").replace(/[{}]/g,"");
    return [{t:"T", x:num(get(e,10)), y:num(get(e,20)), h:num(get(e,40,"2.5")), rot:num(get(e,50,"0")), text:decodeText(text), mtext:true, layer, space}];
  }
  if(t==="ATTRIB"||t==="ATTDEF"){
    return [{t:"T", x:num(get(e,10)), y:num(get(e,20)), h:num(get(e,40,"2.5")), rot:num(get(e,50,"0")), text:decodeText(get(e,1,"")), tag:get(e,2,""), attr:true, layer, space}];
  }
  return [];
}
function decodeText(s){ return s.replace(/%%[dD]/g,"°").replace(/%%[pP]/g,"±").replace(/%%[cC]/g,"Ø").replace(/\\U\+([0-9A-Fa-f]{4})/g,(m,h)=>String.fromCharCode(parseInt(h,16))); }

function transform(prim, ins){
  const {x,y,sx,sy,rot} = ins; const r = rot*Math.PI/180, c=Math.cos(r), s=Math.sin(r);
  const tp = (px,py)=>{ const ax=px*sx, ay=py*sy; return [x + ax*c - ay*s, y + ax*s + ay*c]; };
  const p = Object.assign({}, prim);
  if(p.t==="L"){ [p.x1,p.y1]=tp(p.x1,p.y1); [p.x2,p.y2]=tp(p.x2,p.y2); }
  else if(p.t==="C"||p.t==="A"){ [p.cx,p.cy]=tp(p.cx,p.cy); p.r*=Math.abs(sx); if(p.t==="A"){ p.a1+=rot; p.a2+=rot; } }
  else if(p.t==="P"||p.t==="S"){ p.pts = p.pts.map(q=>tp(q[0],q[1])); }
  else if(p.t==="T"){ [p.x,p.y]=tp(p.x,p.y); p.h*=Math.abs(sy); p.rot+=rot; }
  return p;
}

export function parseDXF(text){
  const pairs = parsePairs(text);
  const sec = sections(pairs);
  const layers = parseLayers(sec.TABLES);
  // bloques
  const blocks = {};
  if(sec.BLOCKS){
    let cur=null;
    for(const e of groupEntities(sec.BLOCKS)){
      if(e.type==="BLOCK"){ cur = { name:get(e,2,""), bx:num(get(e,10,"0")), by:num(get(e,20,"0")), ents:[] }; blocks[cur.name]=cur; }
      else if(e.type==="ENDBLK"){ cur=null; }
      else if(cur) cur.ents.push(e);
    }
  }
  // los INSERT se resuelven recursivamente (la base del bloque se resta antes de transformar)
  const flat = expandPure(groupEntities(sec.ENTITIES||[]), blocks, 0);
  const bounds = boundsOf(flat);
  const tokens = [...new Set(flat.filter(p=>p.t==="T" && /\{\{[^}]+\}\}/.test(p.text)).flatMap(p=>p.text.match(/\{\{[^}]+\}\}/g)))];
  const paperCount = flat.filter(p=>p.space==="paper").length;
  return { entities: flat, bounds, layers, tokens, blocks:Object.keys(blocks), space: paperCount>flat.length/2 ? "paper" : "model", counts: countTypes(flat) };
}
function shift(p, dx, dy){
  const q = Object.assign({}, p);
  if(q.t==="L"){ q.x1+=dx; q.y1+=dy; q.x2+=dx; q.y2+=dy; }
  else if(q.t==="C"||q.t==="A"){ q.cx+=dx; q.cy+=dy; }
  else if(q.t==="P"||q.t==="S"){ q.pts = q.pts.map(a=>[a[0]+dx,a[1]+dy]); }
  else if(q.t==="T"){ q.x+=dx; q.y+=dy; }
  return q;
}
function expandPure(ents, blocks, depth){
  const out = [];
  for(const e of ents){
    if(e.type==="INSERT"){
      if(depth>6) continue;
      const b = blocks[get(e,2,"")]; if(!b) continue;
      const ins = { x:num(get(e,10,"0")), y:num(get(e,20,"0")), sx:num(get(e,41,"1")), sy:num(get(e,42,"1")), rot:num(get(e,50,"0")) };
      const space = get(e,67,"0")==="1" ? "paper" : "model";
      for(const p of expandPure(b.ents, blocks, depth+1)){
        const q = transform(shift(p, -b.bx, -b.by), ins); q.space = space; out.push(q);
      }
    } else {
      for(const p of toPrimitive(e)) out.push(p);
    }
  }
  return out;
}
function countTypes(flat){ const c={}; for(const p of flat) c[p.t]=(c[p.t]||0)+1; return c; }
export function boundsOf(flat){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  const add=(x,y)=>{ if(!isFinite(x)||!isFinite(y)) return; if(x<minX)minX=x; if(y<minY)minY=y; if(x>maxX)maxX=x; if(y>maxY)maxY=y; };
  for(const p of flat){
    if(p.t==="L"){ add(p.x1,p.y1); add(p.x2,p.y2); }
    else if(p.t==="C"||p.t==="A"){ add(p.cx-p.r,p.cy-p.r); add(p.cx+p.r,p.cy+p.r); }
    else if(p.t==="P"||p.t==="S"){ p.pts.forEach(q=>add(q[0],q[1])); }
    else if(p.t==="T"){ add(p.x,p.y); add(p.x + (p.text||"").length*p.h*0.7, p.y+p.h); }
  }
  if(!isFinite(minX)) return {minX:0,minY:0,maxX:1,maxY:1};
  return {minX,minY,maxX,maxY};
}

// Convierte las primitivas al formato compacto que usa el generador de planos (DXF_BLOCKS del módulo Tablero):
// ["L",x1,y1,x2,y2] ["C",cx,cy,r] ["A",cx,cy,r,a1,a2] ["P",closed,x1,y1,...] ["T",x,y,h,rot,"texto"] ["S",x1,y1,...x4,y4]
export function toCompact(flat, origin){
  const ox = origin ? origin.x : 0, oy = origin ? origin.y : 0;
  const r = v => Math.round(v*1000)/1000;
  const out = [];
  for(const p of flat){
    if(p.t==="L") out.push(["L", r(p.x1-ox), r(p.y1-oy), r(p.x2-ox), r(p.y2-oy)]);
    else if(p.t==="C") out.push(["C", r(p.cx-ox), r(p.cy-oy), r(p.r)]);
    else if(p.t==="A") out.push(["A", r(p.cx-ox), r(p.cy-oy), r(p.r), r(p.a1), r(p.a2)]);
    else if(p.t==="P") out.push(["P", p.closed?1:0, ...p.pts.flatMap(q=>[r(q[0]-ox), r(q[1]-oy)])]);
    else if(p.t==="S" && p.pts.length>=4) out.push(["S", ...p.pts.slice(0,4).flatMap(q=>[r(q[0]-ox), r(q[1]-oy)])]);
    else if(p.t==="T") out.push(["T", r(p.x-ox), r(p.y-oy), r(p.h), r(p.rot||0), p.text]);
  }
  return out;
}

// Vista previa en canvas (fondo blanco, líneas negras — como una impresión monocroma).
export function drawPreview(canvas, flat, opts={}){
  const ctx = canvas.getContext("2d");
  const b = opts.bounds || boundsOf(flat);
  const W = canvas.width = canvas.clientWidth*2 || 1200;
  const H = canvas.height = Math.max(200, Math.round(W * ((b.maxY-b.minY)/(b.maxX-b.minX||1)))) ;
  canvas.style.height = (H/2)+"px";
  ctx.fillStyle="#fff"; ctx.fillRect(0,0,W,H);
  const pad = 10;
  const sc = Math.min((W-2*pad)/((b.maxX-b.minX)||1), (H-2*pad)/((b.maxY-b.minY)||1));
  const X = x => pad + (x-b.minX)*sc, Y = y => H - pad - (y-b.minY)*sc;
  ctx.lineWidth = 1; ctx.strokeStyle = "#1a2433"; ctx.fillStyle="#1a2433";
  for(const p of flat){
    if(opts.highlightTokens && p.t==="T" && /\{\{/.test(p.text)) ctx.fillStyle="#2461B3"; else ctx.fillStyle="#1a2433";
    if(p.t==="L"){ ctx.beginPath(); ctx.moveTo(X(p.x1),Y(p.y1)); ctx.lineTo(X(p.x2),Y(p.y2)); ctx.stroke(); }
    else if(p.t==="C"){ ctx.beginPath(); ctx.arc(X(p.cx),Y(p.cy),p.r*sc,0,Math.PI*2); ctx.stroke(); }
    else if(p.t==="A"){ ctx.beginPath(); ctx.arc(X(p.cx),Y(p.cy),p.r*sc, -p.a2*Math.PI/180, -p.a1*Math.PI/180); ctx.stroke(); }
    else if(p.t==="P"){ ctx.beginPath(); p.pts.forEach((q,i)=> i? ctx.lineTo(X(q[0]),Y(q[1])) : ctx.moveTo(X(q[0]),Y(q[1]))); if(p.closed) ctx.closePath(); ctx.stroke(); }
    else if(p.t==="S"){ ctx.beginPath(); const o=[p.pts[0],p.pts[1],p.pts[3],p.pts[2]]; o.forEach((q,i)=> i? ctx.lineTo(X(q[0]),Y(q[1])) : ctx.moveTo(X(q[0]),Y(q[1]))); ctx.closePath(); ctx.fill(); }
    else if(p.t==="T" && p.text){
      const fs = Math.max(4, p.h*sc);
      ctx.save(); ctx.translate(X(p.x),Y(p.y)); ctx.rotate(-(p.rot||0)*Math.PI/180); ctx.font = `${fs}px Inter, Arial, sans-serif`; ctx.fillText(p.text, 0, 0); ctx.restore();
    }
  }
}

/* ---------- CTB (plumillas) ----------
   Un .ctb es "PIACTB" + cabecera + flujo zlib con texto tipo:
     plot_style{ name="Color_7" ... color=-1006632961 ... lineweight=3 ... }
     custom_lineweight_table{ 0=0.0 1=0.05 ... }
   Devuelve { estilos:[{name, colorIdx, lineweightIdx, screening}], pesos:[mm...] } */
export function parseCTB(arrayBuffer, pako){
  const bytes = new Uint8Array(arrayBuffer);
  const head = new TextDecoder("latin1").decode(bytes.slice(0,6));
  if(head!=="PIACTB" && head!=="PIASTB") throw new Error("No es un archivo CTB/STB válido");
  // el flujo zlib comienza en el primer 0x78 tras la cabecera de texto
  let start = 0; for(let i=6;i<bytes.length-1;i++){ if(bytes[i]===0x78 && (bytes[i+1]===0x9c||bytes[i+1]===0xda||bytes[i+1]===0x01)){ start=i; break; } }
  const txt = new TextDecoder("latin1").decode(pako.inflate(bytes.slice(start)));
  const pesos = []; const m = txt.match(/custom_lineweight_table\{([\s\S]*?)\}/);
  if(m){ for(const line of m[1].split(/\n/)){ const mm = line.trim().match(/^(\d+)=([\d.]+)/); if(mm) pesos[parseInt(mm[1],10)] = parseFloat(mm[2]); } }
  const estilos = [];
  const re = /plot_style\{([\s\S]*?)\n\s*\}/g; let s;
  while((s = re.exec(txt))){
    const body = s[1]; const g = k => { const mm = body.match(new RegExp("\\b"+k+"=([^\\n]+)")); return mm ? mm[1].trim().replace(/^"|"$/g,"") : null; };
    const color = parseInt(g("color")||"-1006632961",10);
    estilos.push({ name:g("name"), colorIdx: estilos.length+1, colorRaw: color, useObjectColor: color===-1006632961, lineweightIdx: parseInt(g("lineweight")||"0",10), screening: parseInt(g("screen")||"100",10), linetype: parseInt(g("linetype")||"31",10) });
  }
  estilos.forEach(e=>{ e.lineweightMM = pesos[e.lineweightIdx] != null ? pesos[e.lineweightIdx] : null; });
  return { tipo: head==="PIACTB" ? "ctb" : "stb", estilos, pesos, descripcion: (txt.match(/description="([^"]*)"/)||[])[1]||"" };
}

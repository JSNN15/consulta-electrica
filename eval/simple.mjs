import fs from 'fs';
const d = JSON.parse(fs.readFileSync('eval/tres/reservado_1.json','utf8')).turnos.concat(JSON.parse(fs.readFileSync("eval/tres/desarrollo_1.json","utf8")).turnos);
const con = d.filter(t => t.tipo==='respuesta' && Array.isArray(t.puntos) && t.puntos.filter(p=>p.texto||typeof p==='string').length && /\d/.test(JSON.stringify(t.puntos)));
const ocho = con.slice(0, 40).filter((_,i)=>i%3===0).slice(0,8);
const nums = (x) => (String(x).match(/\d+(?:[.,]\d+)?/g) || []).map((n) => String(parseFloat(n.replace(',', '.'))));
const H={'content-type':'application/json',origin:'http://localhost:8770'};
H['X-NV-Sesion']=(await (await fetch('http://localhost:8789/sesion',{method:'POST',headers:H,body:'{}'})).json()).s;
let ok=0; const out=[];
for (const t of ocho) {
  const puntos = t.puntos.map(p=>p.texto||p).filter(x=>typeof x==='string');
  const t0=Date.now();
  let r; try { r = await fetch('http://localhost:8789/simple',{method:'POST',headers:H,body:JSON.stringify({pregunta:t.m,puntos})}).then(x=>x.json()); } catch(e){ r={error:String(e)}; }
  const s=r.result||{};
  const terminos=(s.terminos||[]).filter(x=>x&&x.termino&&x.significado).slice(0,4);
  const dados=new Set(nums([t.m, t.calc&&t.calc.texto?t.calc.texto:'', ...puntos].join(' ')));
  const nuevos=nums([s.explicacion,...terminos.map(x=>x.significado)].join(' ')).filter(n=>!dados.has(n));
  const bien=!!s.explicacion&&!nuevos.length; if(bien) ok++;
  out.push({pregunta:t.m,puntos,explicacion:s.explicacion,terminos,nuevos,ms:Date.now()-t0,error:r.error});
  console.log(bien?'OK ':'NO ', Date.now()-t0,'ms |',t.m.slice(0,60),'| nuevos',nuevos,r.error||'');
  console.log('    ',String(s.explicacion).slice(0,260));
}
console.log(ok+'/'+ocho.length);
fs.writeFileSync('eval/simple.res.json',JSON.stringify(out,null,1));

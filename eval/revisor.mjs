// Validación del revisor: se le pasan respuestas correctas y respuestas con un error plantado, cada una con el
// fragmento que cita, y se mide cuántos errores deja pasar y cuántas respuestas buenas bota.
// La regla es la misma del motor: un punto se muestra solo si respalda = si, aplica no es "no" y responde no es "no".
// Uso: node revisor.mjs [casos.json] [salida.json]   (por omisión, revisor.json)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const GW = process.env.GATEWAY || 'http://localhost:8787', ORIGEN = process.env.ORIGEN || 'http://localhost:8770';
const corpus = JSON.parse(fs.readFileSync(path.join(process.env.CORPUS_DIR || path.join(AQUI, '..', 's'), 'corpus.json'), 'utf8'));
const ENT = process.argv[2] || path.join(AQUI, 'revisor.json');
const casos = JSON.parse(fs.readFileSync(ENT, 'utf8'));
const H = {Origin: ORIGEN, 'Content-Type': 'application/json'};
const ses = (await (await fetch(GW + '/sesion', {method: 'POST', headers: H, body: '{}'})).json()).s;
const post = async (ruta, cuerpo) => (await fetch(GW + ruta, {method: 'POST', headers: {...H, 'X-NV-Sesion': ses}, body: JSON.stringify(cuerpo)})).json();
const SAL = process.argv[3] || ENT.replace(/\.json$/, '.res.json');
// Se guarda después de cada caso y, si el archivo de salida ya tiene casos, se sigue desde ahí
// (la cuota de la API de prueba corta las corridas largas).
const filas = process.env.SEGUIR && fs.existsSync(SAL) ? JSON.parse(fs.readFileSync(SAL, 'utf8')).casos : [];
const solo = process.env.SOLO ? process.env.SOLO.split(',') : null;
for (const c of casos) {
  if ((solo && !solo.includes(c.id)) || filas.some((x) => x.id === c.id)) continue;
  const id = corpus.d.findIndex((d) => d.n === c.f[0] && String(d.r).startsWith(c.f[1]) && (!c.con || d.t.includes(c.con)));
  if (id < 0) throw new Error('no está el fragmento de ' + c.id);
  let r;
  for (let k = 0; k < 8; k++) {
    r = await post('/juez', {pregunta: c.q, mensaje: c.q, tema: c.tema, ficha: c.ficha || {}, calculo: c.calculo || '', puntos: [{id, texto: c.p}]});
    if (r.result && r.result.segundo_revisor !== false) break; // con un solo revisor no cuenta: se repite
    await new Promise((s) => setTimeout(s, 30000)); // límite de consultas o falla de la API: esperar y repetir
  }
  if (!r.result || r.result.segundo_revisor === false) throw new Error(`sin respuesta completa del revisor en ${c.id}: ${r.error || ''}`);
  const j = r.result || {};
  const v = (j.veredictos || [])[0] || {};
  const botado = v.respalda !== 'si' || v.aplica === 'no' || j.responde === 'no'; // la misma regla del motor
  const marcado = botado || v.aplica === 'dudoso';
  filas.push({id: c.id, bueno: c.bueno, clase: c.clase || '', botado, marcado, respalda: v.respalda, aplica: v.aplica, responde: j.responde, motivo: v.motivo, ms: r.ms, veredicto: v, pide: j.pide});
  console.log(`${c.bueno === !botado ? '✓' : '✗'} ${c.id} ${c.bueno ? 'correcta' : 'error: ' + c.clase} → ${botado ? 'botado' : marcado ? 'mostrado con advertencia' : 'mostrado'} (${v.respalda}/${v.aplica}/${j.responde}) ${v.motivo || ''}`);
  fs.writeFileSync(SAL, JSON.stringify({fecha: new Date().toISOString().slice(0, 10), parcial: true, casos: filas}, null, 1));
  await new Promise((s) => setTimeout(s, +(process.env.PAUSA || 2600)));
}
const resumen = () => {
  const B = filas.filter((x) => x.bueno), M = filas.filter((x) => !x.bueno);
  const porClase = {};
  for (const x of M) { const o = (porClase[x.clase] ??= {casos: 0, botados: 0}); o.casos++; if (x.botado) o.botados++; }
  const R = {
    errores_plantados: M.length,
    errores_botados: M.filter((x) => x.botado).length,
    errores_mostrados_con_advertencia: M.filter((x) => !x.botado && x.marcado).length,
    errores_que_pasan_limpios: M.filter((x) => !x.marcado).length,
    por_clase_de_error: porClase,
    correctas: B.length,
    correctas_botadas: B.filter((x) => x.botado).length,
    correctas_con_advertencia: B.filter((x) => !x.botado && x.marcado).length,
  };
  return R;
};
const R = resumen();
console.log(JSON.stringify(R, null, 1));
fs.writeFileSync(SAL, JSON.stringify({fecha: new Date().toISOString().slice(0, 10), resumen: R, casos: filas}, null, 1));

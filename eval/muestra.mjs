// Genera la conversación de ejemplo que la página muestra al abrir (samples.json), pasándola por el motor real.
// Uso: node muestra.mjs "mensaje 1" "mensaje 2" …
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {crearMotor} from '../motor.js';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const GW = process.env.GATEWAY || 'http://localhost:8787', ORIGEN = process.env.ORIGEN || 'http://localhost:8770';
const corpus = JSON.parse(fs.readFileSync(path.join(AQUI, '..', 's', 'corpus.json'), 'utf8'));
const vec = new Int8Array(fs.readFileSync(path.join(AQUI, '..', 's', 'corpus.bin')).buffer.slice(0));
const H = {Origin: ORIGEN, 'Content-Type': 'application/json'};
const ses = (await (await fetch(GW + '/sesion', {method: 'POST', headers: H, body: '{}'})).json()).s;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let artificial = 0; // esperas del generador (ritmo y cuota): no son tiempo del chat
const post = async (ruta, cuerpo) => {
  for (let k = 0; k < 8; k++) {
    await espera(4000);
    artificial += 4000;
    const t1 = Date.now();
    const d = await (await fetch(GW + ruta, {method: 'POST', headers: {...H, 'X-NV-Sesion': ses}, body: JSON.stringify(cuerpo)})).json();
    if (d.ok) return d;
    console.error('  reintento:', d.error);
    await espera(30000);
    artificial += Date.now() - t1;
  }
  throw new Error('sin respuesta');
};
const m = crearMotor({corpus, vec, post});
const estado = m.nuevoEstado();
const out = [];
for (const q of process.argv.slice(2)) {
  artificial = 0;
  const r = await m.turno(q, estado);
  r.traza.ms = Math.max(0, r.traza.ms - artificial);
  console.log(`[${r.tipo}] ${q}\n   ${r.texto.slice(0, 400)}\n   ${r.puntos.map((p) => `${p.doc.n} · ${p.doc.r} (${p.cita})`).join(' | ')}`);
  const corto = (d) => ({n: d.n, r: d.r, h: d.h, u: d.u, t: d.t.length > 1800 ? d.t.slice(0, 1800) + '…' : d.t});
  out.push({
    q,
    r: {
      ...r,
      puntos: r.puntos.map((p) => ({texto: p.texto, frase: p.frase, cita: p.cita, numeral: p.numeral, numerosFuera: p.numerosFuera, veredicto: {aplica: p.veredicto.aplica, motivo: p.veredicto.motivo}, doc: corto(p.doc)})),
      calc: r.calc ? {texto: r.calc.texto} : null,
      traza: {consultas: r.traza.consultas, ids: r.traza.ids, descartados: r.traza.descartados, omitidos: r.traza.omitidos, reintento: r.traza.reintento, segunda: r.traza.segunda, saltos: r.traza.saltos, buscar_mas: r.traza.buscar_mas, revisionParcial: r.traza.revisionParcial, llamadas: r.traza.llamadas, ms: r.traza.ms},
    },
  });
}
fs.writeFileSync(path.join(AQUI, '..', 'samples.json'), JSON.stringify(out, null, 1));
console.log('guardado samples.json', out.length);

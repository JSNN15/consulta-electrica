// Depuración de la búsqueda: node busca.mjs "consulta 1" "consulta 2" …  → fragmentos que llegarían al redactor
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {crearMotor} from '../motor.js';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const GW = process.env.GATEWAY || 'http://localhost:8787', ORIGEN = process.env.ORIGEN || 'http://localhost:8770';
const DIR = process.env.CORPUS_DIR || path.join(AQUI, '..', 's');
const corpus = JSON.parse(fs.readFileSync(path.join(DIR, 'corpus.json'), 'utf8'));
const vec = new Int8Array(fs.readFileSync(path.join(DIR, 'corpus.bin')).buffer.slice(0));
const H = {Origin: ORIGEN, 'Content-Type': 'application/json'};
const ses = (await (await fetch(GW + '/sesion', {method: 'POST', headers: H, body: '{}'})).json()).s;
const post = async (ruta, cuerpo) => (await fetch(GW + ruta, {method: 'POST', headers: {...H, 'X-NV-Sesion': ses}, body: JSON.stringify(cuerpo)})).json();
const m = crearMotor({corpus, vec, post});
const qs = process.argv.slice(2);
const ids = await m.buscar(qs, (process.env.AMB || '').split(',').filter(Boolean), +(process.env.K || 9), +(process.env.NPLAN || 3));
for (const i of [...ids, ...m.delAlcance(ids, qs), ...m.remisiones(ids, 2)]) console.log(String(i).padStart(4), `${m.D[i].n} · ${m.D[i].r}`.padEnd(34), m.D[i].t.slice(0, 90).replace(/\s+/g, ' '));

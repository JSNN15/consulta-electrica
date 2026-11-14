// Evaluador del chat: corre conversaciones completas por el mismo motor que usa la página y comprueba,
// turno por turno, lo que se esperaba (tipo de respuesta, norma citada, datos, aclaraciones, rechazos).
// Uso: node evaluar.mjs conversaciones.json [salida.json]   (necesita el intermediario en GATEWAY)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {crearMotor} from '../motor.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const GW = process.env.GATEWAY || 'http://localhost:8787';
const ORIGEN = process.env.ORIGEN || 'http://localhost:8770';
const DIR = process.env.CORPUS_DIR || path.join(AQUI, '..', 's');
const corpus = JSON.parse(fs.readFileSync(path.join(DIR, 'corpus.json'), 'utf8'));
const vec = new Int8Array(fs.readFileSync(path.join(DIR, 'corpus.bin')).buffer.slice(0));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

let ses = null,
  ultima = 0,
  artificial = 0; // ms de espera que pone el evaluador (ritmo y reintentos por cuota): no son tiempo del chat
const PAUSA = +(process.env.PAUSA || 2200); // ms entre llamadas: la clave de prueba permite unas 40 por minuto
async function post(ruta, cuerpo) {
  for (let k = 0; k < 10; k++) {
    const w = ultima + PAUSA - Date.now();
    if (w > 0) {
      await espera(w);
      artificial += w;
    }
    ultima = Date.now();
    const t1 = Date.now();
    if (!ses) ses = (await (await fetch(GW + '/sesion', {method: 'POST', headers: {Origin: ORIGEN, 'Content-Type': 'application/json'}, body: '{}'})).json()).s;
    let r, d;
    try {
      r = await fetch(GW + ruta, {method: 'POST', headers: {Origin: ORIGEN, 'Content-Type': 'application/json', 'X-NV-Sesion': ses}, body: JSON.stringify(cuerpo)});
      d = await r.json();
    } catch (e) {
      d = {error: String(e)};
    }
    if (d.ok) return d;
    if (d.error === 'sesion') ses = null;
    const e2 = d.error && /Espera|demanda|respondi/.test(d.error) ? 30000 : 4000;
    await espera(e2);
    artificial += e2 + (Date.now() - t1 - e2); // la llamada fallida y su espera tampoco cuentan
  }
  throw new Error('sin respuesta en ' + ruta);
}

const motor = crearMotor({corpus, vec, post});
const re = (x) => new RegExp(x, 'i');
const refDe = (d) => `${d.n} · ${d.r}`;

// Comprueba un turno contra lo esperado. Devuelve la lista de fallas (vacía = pasa).
function revisar(r, esp, estado) {
  const f = [];
  const txt = [r.texto, r.aviso, ...(r.puntos || []).map((p) => p.texto)].join(' ');
  const citas = (r.puntos || []).map((p) => refDe(p.doc));
  const cand = (r.traza.ids || []).map((i) => refDe(motor.D[i]));
  if (esp.tipo && ![].concat(esp.tipo).includes(r.tipo)) f.push(`tipo ${r.tipo}, se esperaba ${[].concat(esp.tipo).join(' o ')}`);
  for (const c of esp.cita || []) if (!citas.some((x) => x.startsWith(c))) f.push(`no cita ${c}`);
  if (esp.citaAlguna && !esp.citaAlguna.some((c) => citas.some((x) => x.startsWith(c)))) f.push(`no cita ninguna de: ${esp.citaAlguna.join(', ')}`);
  for (const c of esp.noCita || []) if (citas.some((x) => x.startsWith(c))) f.push(`cita ${c}, que no corresponde`);
  for (const c of esp.recupera || []) if (!cand.some((x) => x.startsWith(c))) f.push(`no recuperó ${c}`);
  for (const c of esp.contiene || []) if (!re(c).test(txt)) f.push(`falta "${c}"`);
  for (const c of esp.noContiene || []) if (re(c).test(txt)) f.push(`no debía decir "${c}"`);
  for (const [k, v] of Object.entries(esp.ficha || {})) if (!re(v).test(estado.ficha[k] || '')) f.push(`ficha.${k} = "${estado.ficha[k] || ''}"`);
  if (esp.calculo && !(r.calc && r.calc.ok)) f.push('no usó la calculadora');
  return f;
}

// ---- métricas ----
function metricas(filas) {
  const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);
  const T = filas.length,
    ok = filas.filter((x) => x.pasa).length;
  const porCat = {};
  for (const x of filas) {
    const o = (porCat[x.cat] ??= {turnos: 0, pasan: 0});
    o.turnos++;
    if (x.pasa) o.pasan++;
  }
  const citas = filas.flatMap((x) => x.citas);
  const rec = filas.filter((x) => x.esp.recupera);
  const pide = filas.filter((x) => x.esp.tipo === 'pide'); // solo donde pedir el dato era lo único correcto
  const noPide = filas.filter((x) => x.esp.tipo && ![].concat(x.esp.tipo).includes('pide'));
  const declina = filas.filter((x) => x.esp.tipo && [].concat(x.esp.tipo).every((t) => t === 'sin_respaldo' || t === 'fuera'));
  const ms = filas.map((x) => x.ms || 0).filter(Boolean).sort((a, b) => a - b);
  return {
    turnos: T,
    pasan: ok,
    pasan_pct: pct(ok, T),
    por_categoria: porCat,
    citas_mostradas: citas.length,
    citas_frase_exacta: citas.filter((x) => x.cita === 'ok').length,
    citas_ubicadas_con_diferencias: citas.filter((x) => x.cita === 'aprox').length,
    citas_tabla: citas.filter((x) => x.cita === 'tabla').length,
    recuperacion_pct: pct(rec.filter((x) => !x.fallas.some((f) => f.startsWith('no recuperó'))).length, rec.length),
    pide_cuando_debe_pct: pct(pide.filter((x) => x.tipo === 'pide').length, pide.length),
    pide_de_mas_pct: pct(noPide.filter((x) => x.tipo === 'pide').length, noPide.length),
    // peligrosas: debía decir que no está en las normas cargadas y respondió con un dato
    peligrosas: declina.filter((x) => x.tipo === 'respuesta').length,
    casos_fuera_de_corpus: declina.length,
    puntos_descartados_por_revision: filas.reduce((a, x) => a + (x.descartados?.length || 0), 0),
    puntos_sin_cita_comprobable: filas.reduce((a, x) => a + (x.sinCita || 0), 0),
    puntos_con_numeros_que_no_estan_en_el_extracto: filas.reduce((a, x) => a + (x.puntos || []).filter((p) => (p.numerosFuera || []).length).length, 0),
    turnos_con_un_solo_revisor: filas.filter((x) => x.revisionParcial).length,
    reintentos: filas.filter((x) => x.reintento).length,
    segundas_miradas: filas.filter((x) => x.segunda).length,
    mediana_s: ms.length ? Math.round(ms[Math.floor(ms.length / 2)] / 100) / 10 : null,
    p90_s: ms.length ? Math.round(ms[Math.floor(ms.length * 0.9)] / 100) / 10 : null,
    llamadas_por_turno: Math.round((10 * filas.reduce((a, x) => a + (x.llamadas || 0), 0)) / T) / 10,
  };
}

// node evaluar.mjs --unir a.json b.json … salida.json : junta corridas parciales y recalcula las métricas
if (process.argv[2] === '--unir') {
  const ent = process.argv.slice(3, -1).map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  const todas = ent.flatMap((e) => e.turnos);
  const M = metricas(todas);
  console.log(JSON.stringify(M, null, 1));
  fs.writeFileSync(process.argv.at(-1), JSON.stringify({fecha: ent[0].fecha, fragmentos: ent[0].fragmentos, metricas: M, turnos: todas}, null, 1));
  process.exit(0);
}

const archivo = process.argv[2];
const convs = JSON.parse(fs.readFileSync(archivo, 'utf8'));
const solo = process.env.SOLO ? process.env.SOLO.split(',') : null;
const filas = [];
const SALIDA = process.argv[3] || archivo.replace(/\.json$/, '.res.json');
// se guarda después de cada turno: si la corrida se corta, queda lo avanzado
const guardar = () =>
  fs.writeFileSync(SALIDA, JSON.stringify({fecha: new Date().toISOString().slice(0, 10), fragmentos: corpus.d.length, metricas: metricas(filas), turnos: filas}, null, 1));
for (const c of convs) {
  if (solo && !solo.includes(c.id)) continue;
  const estado = motor.nuevoEstado();
  console.log(`\n== ${c.id} (${c.cat})`);
  for (const t of c.turnos) {
    let r, fallas, err = '';
    try {
      artificial = 0;
      r = await motor.turno(t.m, estado);
      if (r.traza) r.traza.ms = Math.max(0, r.traza.ms - artificial);
      fallas = revisar(r, t.esp || {}, estado);
    } catch (e) {
      err = String(e.message || e);
      fallas = ['error: ' + err];
      r = {tipo: 'error', texto: '', aviso: '', puntos: [], traza: {}};
    }
    const citas = (r.puntos || []).map((p) => ({ref: refDe(p.doc), cita: p.cita, numeral: p.numeral, respalda: p.veredicto?.respalda, aplica: p.veredicto?.aplica}));
    filas.push({conv: c.id, cat: c.cat, m: t.m, esp: t.esp || {}, pasa: !fallas.length, fallas, tipo: r.tipo, texto: r.texto, aviso: r.aviso, citas, ficha: {...estado.ficha},
      consultas: r.traza.consultas, saltos: r.traza.saltos, descartados: r.traza.descartados, sinCita: r.traza.sinCita, plan: r.traza.plan && {tipo: r.traza.plan.tipo, falta: r.traza.plan.falta, ambitos: r.traza.plan.ambitos}, ms: r.traza.ms, llamadas: r.traza.llamadas, calc: !!(r.calc && r.calc.ok), omitidos: r.traza.omitidos, juez: r.traza.juez, tema: estado.tema, puntos: (r.puntos || []).map((p) => ({texto: p.texto, ref: refDe(p.doc), numeral: p.numeral, cita: p.cita, frase: p.frase, movido: !!p.movido, numerosFuera: p.numerosFuera, aplica: p.veredicto?.aplica})), supuestos: r.calc?.supuestos, revisionParcial: !!r.traza.revisionParcial, reintento: !!r.traza.reintento, segunda: !!r.traza.segunda, candidatos: (r.traza.ids || []).map((i) => refDe(motor.D[i]))});
    guardar();
    console.log(`${fallas.length ? '✗' : '✓'} [${r.tipo}] ${t.m}\n    ${String(r.texto).slice(0, 300).replace(/\n/g, ' ')}\n    citas: ${citas.map((x) => x.ref + (x.cita === 'tabla' ? '≈' : x.cita === 'aprox' ? '~' : '')).join(' | ') || '—'}${fallas.length ? '\n    FALLAS: ' + fallas.join('; ') : ''}`);
  }
}
guardar();
console.log('\n' + JSON.stringify(metricas(filas), null, 1));

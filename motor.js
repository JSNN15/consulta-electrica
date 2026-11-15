// Motor del chat de normativa. No toca la página: recibe el corpus, los vectores y una función para llamar
// al intermediario, y devuelve qué responder en cada turno. Lo usan igual la página y el evaluador (Node),
// así lo que se mide es lo mismo que se publica.
//
// Un turno: planificar (qué tipo de mensaje es, ficha del caso, búsquedas) → buscar en varios pasos →
// redactar con citas → comprobar citas y numerales → revisión independiente → recordar.

const STOP = new Set(
  'a al con como cual de del desde donde el en entre es esa ese esta este hay la las le lo los mas más no o para pero por que se ser si sin sobre son su sus un una uno unos y debe deben deberá deberán será serán cada otro otra otros otras puede pueden según cuando todo toda todos todas'.split(
    ' '
  )
);
const sinTildes = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
const tokens = (s) =>
  (sinTildes(s).match(/[a-z0-9]+/g) || [])
    .filter((w) => !STOP.has(w) && w.length > 2)
    .map((w) =>
      w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w
    );
const soloLetras = (s) => sinTildes(s).replace(/[^a-z0-9]/g, '');

// Secciones normalizadas de conductores de cobre, en mm²
const SECCIONES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
const RHO_CU = 0.018; // Ω·mm²/m, cobre a temperatura ambiente
const n2 = (x, d = 1) => x.toLocaleString('es-CL', {maximumFractionDigits: d, minimumFractionDigits: 0});

// Cálculos que hace el código y no el modelo. Devuelve el texto que se le entrega al redactor y a la persona.
export function calcular(c, avisos = []) {
  if (!c || c.tipo === 'ninguno') return null;
  const fases = c.fases === 3 ? 3 : 1;
  const V = c.tension_v > 0 ? c.tension_v : fases === 3 ? 380 : 220;
  const fpDado = c.fp > 0 && c.fp <= 1;
  const fp = fpDado ? c.fp : 0.9;
  const k = fases === 3 ? Math.sqrt(3) : 1;
  const supuestos = [`sistema ${fases === 3 ? 'trifásico' : 'monofásico'} de ${n2(V, 0)} V`, ...avisos];
  let I = c.corriente_a > 0 ? c.corriente_a : 0;
  const lineas = [];
  if (!I && c.potencia_kw > 0) {
    I = (c.potencia_kw * 1000) / (k * V * fp);
    supuestos.push(
      fpDado ? `factor de potencia ${n2(fp, 2)}` : 'factor de potencia 0,9 (supuesto: no se indicó)'
    );
    lineas.push(
      `Corriente de la carga: I = P / (${fases === 3 ? '√3 · ' : ''}V · fp) = ${n2(I)} A para ${n2(c.potencia_kw)} kW.`,
      'Es una estimación sin el rendimiento del equipo: en motores manda la corriente de placa o la de la tabla de la norma.'
    );
  } else if (I) lineas.push(`Corriente de la carga: ${n2(I)} A (dato entregado).`);
  if (!I)
    return {
      ok: false,
      texto: 'Falta la potencia o la corriente de la carga para calcular.',
      faltan: ['potencia o corriente'],
    };
  const out = {ok: true, corriente: I, tension: V, fases};
  if (c.tipo === 'caida_tension') {
    if (!(c.largo_m > 0))
      return {
        ok: false,
        texto: lineas.join('\n') + '\nFalta el largo del tramo para calcular la caída de tensión.',
        faltan: ['largo del tramo'],
      };
    const kk = fases === 3 ? Math.sqrt(3) : 2;
    const caida = (S) => (kk * RHO_CU * c.largo_m * I) / S;
    supuestos.push(
      `conductor de cobre (${String(RHO_CU).replace('.', ',')} Ω·mm²/m), tramo de ${n2(c.largo_m, 0)} m, sin considerar reactancia`
    );
    const filas = SECCIONES.map((S) => ({S, v: caida(S), pct: (caida(S) / V) * 100}));
    out.caidas = filas;
    const ver = c.seccion_mm2 > 0 ? filas.filter((f) => f.S === c.seccion_mm2) : [];
    const i3 = filas.findIndex((f) => f.pct <= 3),
      i5 = filas.findIndex((f) => f.pct <= 5);
    const mostrar = [...new Set([...ver, ...filas.slice(Math.max(0, i5 - 1), Math.max(i3, i5) + 2)])].sort(
      (a, b) => a.S - b.S
    );
    lineas.push(`Caída de tensión: ΔV = ${fases === 3 ? '√3' : '2'} · ρ · L · I / S.`);
    for (const f of mostrar) lineas.push(`  ${n2(f.S)} mm²: ${n2(f.v)} V = ${n2(f.pct)} % de ${n2(V, 0)} V`);
    if (i5 >= 0)
      lineas.push(
        `Primera sección con caída de 5 % o menos: ${n2(filas[i5].S)} mm². Con 3 % o menos: ${i3 >= 0 ? n2(filas[i3].S) + ' mm²' : 'ninguna de la lista'}.`
      );
    lineas.push(
      'La sección final debe cumplir además la capacidad de transporte de corriente de la tabla de la norma para el método de instalación.'
    );
  }
  out.supuestos = supuestos;
  out.texto = `Supuestos: ${supuestos.join('; ')}.\n${lineas.join('\n')}`;
  return out;
}

export function crearMotor({corpus, vec, post}) {
  const D = corpus.d,
    N = D.length,
    dim = corpus.dim;
  // ---- índice de palabras (BM25) ----
  const DT = D.map((d) => tokens(`${d.n} ${corpus.mat[d.n] || ''} ${d.h} ${d.t}`));
  const AVG = DT.reduce((a, t) => a + t.length, 0) / N;
  const DF = new Map();
  const TF = DT.map((t) => {
    const m = new Map();
    for (const w of t) m.set(w, (m.get(w) || 0) + 1);
    for (const w of m.keys()) DF.set(w, (DF.get(w) || 0) + 1);
    return m;
  });
  const bm25 = (q) => {
    const qs = [...new Set(tokens(q))];
    const s = new Float32Array(N);
    for (const w of qs) {
      const df = DF.get(w);
      if (!df) continue;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      for (let i = 0; i < N; i++) {
        const f = TF[i].get(w);
        if (f) s[i] += (idf * f * 2.2) / (f + 1.2 * (0.25 + (0.75 * DT[i].length) / AVG));
      }
    }
    return s;
  };
  const coseno = (qv) => {
    let nq = 0;
    for (const x of qv) nq += x * x;
    nq = Math.sqrt(nq) || 1;
    const s = new Float32Array(N);
    for (let i = 0, o = 0; i < N; i++, o += dim) {
      let a = 0;
      for (let j = 0; j < dim; j++) a += vec[o + j] * qv[j];
      s[i] = a / nq; // los vectores del corpus ya vienen normalizados (a escala común)
    }
    return s;
  };
  const orden = (s, k) =>
    Array.from(s.keys())
      .sort((a, b) => s[b] - s[a])
      .slice(0, k);

  let llamadas = 0;
  const llamar = async (ruta, cuerpo) => {
    llamadas++;
    return post(ruta, cuerpo);
  };

  // Cada consulta arma su propia lista (vectores + palabras, fusión por puesto, preferencia por ámbito) y tiene
  // cupos asegurados: la principal 5, las demás 2. Sin cupos, las consultas secundarias sacan de la lista
  // justo el fragmento que respondía la principal.
  const buscar = async (consultas, ambitos, k = 10, nPlan = 3) => {
    consultas = consultas.slice(0, 6);
    const amb = new Set(ambitos || []);
    const e = await llamar('/embed', {texts: consultas, type: 'query', dim}); // todas las búsquedas en una llamada
    const total = new Map();
    const listas = consultas.map((q, c) => {
      const f = new Map();
      const sem = orden(coseno(e.vectors[c]), 60);
      const pal = bm25(q);
      const kw = orden(pal, 60).filter((i) => pal[i] > 0);
      sem.forEach((i, r) => f.set(i, (f.get(i) || 0) + 1 / (60 + r)));
      kw.forEach((i, r) => f.set(i, (f.get(i) || 0) + 0.7 / (60 + r)));
      if (amb.size) for (const [i, v] of f) if (amb.has(D[i].a)) f.set(i, v * 1.3);
      const peso = c === 0 ? 1 : c < nPlan ? 0.8 : 0.5;
      for (const [i, v] of f) total.set(i, (total.get(i) || 0) + peso * v);
      return [...f.entries()].sort((a, b) => b[1] - a[1]).map(([i]) => i);
    });
    const out = [],
      por = {};
    const toma = (i) => {
      if (out.includes(i) || out.length >= k) return false;
      const clave = D[i].n + '|' + String(D[i].r).split(/[.–\s]/)[0];
      if ((por[clave] || 0) >= 4) return false; // no llenar la lista con un solo capítulo
      por[clave] = (por[clave] || 0) + 1;
      out.push(i);
      return true;
    };
    listas.forEach((l, c) => {
      let cupo = c === 0 ? 5 : 2;
      for (const i of l) {
        if (!cupo) break;
        if (toma(i)) cupo--;
      }
    });
    for (const [i] of [...total.entries()].sort((a, b) => b[1] - a[1])) {
      if (out.length >= k) break;
      toma(i);
    }
    return out;
  };

  // ---- referencias cruzadas: "sección 6 del Pliego Técnico Normativo RIC N°11" → trae esa sección ----
  const REF =
    /(?:secci[oó]n|punto|numeral|cap[ií]tulo)\s+(?:N[°º]\s*)?(\d+(?:\.\d+)*)\s+del\s+(?:presente\s+)?(?:Pliego\s+T[eé]cnico\s+Normativo\s+)?(RIC|RPTD)\s*N[°º]\s*0?(\d+)/gi;
  const porNorma = new Map();
  D.forEach((d, i) => {
    if (!porNorma.has(d.n)) porNorma.set(d.n, []);
    porNorma.get(d.n).push(i);
  });
  const normaDe = (tipo, num) =>
    tipo.toUpperCase() === 'RIC' ? `RIC N°${+num}` : `RPTD N°${String(+num).padStart(2, '0')}`;
  const seccion = (norma, sec, max = 3) =>
    (porNorma.get(norma) || [])
      .filter((i) => {
        const r = String(D[i].r).split('–')[0];
        return r === sec || r.startsWith(sec + '.');
      })
      .slice(0, max);
  const remisiones = (ids, max = 3) => {
    const extra = [];
    for (const i of ids.slice(0, 5)) {
      const t = D[i].t.replace(/\s+/g, ' ');
      for (const m of t.matchAll(REF)) {
        for (const j of seccion(normaDe(m[2], m[3]), m[1]))
          if (!ids.includes(j) && !extra.includes(j)) extra.push(j);
        if (extra.length >= max) return extra.slice(0, max);
      }
    }
    return extra;
  };

  // ---- alcance: el artículo que dice a quién y hasta dónde aplica una norma casi nunca se parece a la pregunta
  // ("¿hasta qué potencia puedo instalar?" ↔ "se aplicará a… cuya capacidad instalada no supere los 300 kW"),
  // así que se agrega el de la norma que domina la búsqueda.
  const ALCANCE = /alcance|campo de aplicaci|[áa]mbito de aplicaci/i;
  const alcance = new Map();
  D.forEach((d, i) => {
    if (!ALCANCE.test(d.h)) return;
    if (!alcance.has(d.n)) alcance.set(d.n, []);
    alcance.get(d.n).push(i);
  });
  const delAlcance = (ids, consultas) => {
    const n = {};
    for (const i of ids) n[D[i].n] = (n[D[i].n] || 0) + 1;
    const [norma, cuantos] = Object.entries(n).sort((a, b) => b[1] - a[1])[0] || [];
    if (!norma || cuantos < 3) return [];
    const s = bm25(consultas.join(' '));
    return (alcance.get(norma) || [])
      .filter((i) => !ids.includes(i) && s[i] > 0)
      .sort((a, b) => s[b] - s[a])
      .slice(0, 1);
  };

  // ---- comprobaciones que no dependen del modelo ----
  // Ubica en el fragmento la frase que el modelo dice citar. Lo que se muestra es siempre el texto del
  // fragmento, no lo que escribió el modelo:
  //   ok    = la frase está tal cual (o cada trozo separado por "…" lo está);
  //   aprox = está con diferencias menores (una palabra cambiada, un salto de línea): se muestra el tramo real;
  //   tabla = las palabras están en el fragmento pero en otro orden (filas de tabla);
  //   no    = no se encontró: el punto no se muestra.
  const PAL = /[\p{L}\p{N}]+/gu;
  const ubicar = (textual, i) => {
    const t = D[i].t;
    const tl = soloLetras(t),
      q = soloLetras(textual);
    if (q.length > 20 && tl.includes(q)) return {cita: 'ok', frase: String(textual).trim()};
    const trozos = String(textual)
      .split(/…|\.{3}|\[\.+\]/)
      .map(soloLetras)
      .filter((x) => x.length > 12);
    if (trozos.length > 1 && trozos.join('').length > 20 && trozos.every((x) => tl.includes(x)))
      return {cita: 'ok', frase: String(textual).trim()};
    // alineación aproximada por palabras (distancia de edición contra cualquier tramo del fragmento)
    const tw = [...t.matchAll(PAL)].map((m) => ({w: sinTildes(m[0]), a: m.index, b: m.index + m[0].length}));
    const qw = (String(textual).match(PAL) || []).map(sinTildes);
    const n = qw.length,
      m = tw.length;
    if (n >= 6 && m >= n) {
      const M = Array.from({length: n + 1}, () => new Uint16Array(m + 1));
      for (let r = 1; r <= n; r++) {
        M[r][0] = r;
        for (let c = 1; c <= m; c++)
          M[r][c] = Math.min(
            M[r - 1][c - 1] + (qw[r - 1] === tw[c - 1].w ? 0 : 1),
            M[r - 1][c] + 1,
            M[r][c - 1] + 1
          );
      }
      let fin = 1;
      for (let c = 1; c <= m; c++) if (M[n][c] < M[n][fin]) fin = c;
      const dist = M[n][fin];
      if (dist <= Math.max(1, Math.floor(n * 0.2))) {
        let r = n,
          c = fin;
        while (r > 0 && c > 0) {
          const d = M[r - 1][c - 1] + (qw[r - 1] === tw[c - 1].w ? 0 : 1);
          if (M[r][c] === d) (r--, c--);
          else if (M[r][c] === M[r - 1][c] + 1) r--;
          else c--;
        }
        const frase = t
          .slice(tw[Math.min(c, fin - 1)].a, tw[fin - 1].b)
          .replace(/\s+/g, ' ')
          .trim();
        return {cita: 'aprox', frase};
      }
    }
    const qt = tokens(textual),
      et = new Set(tokens(t));
    const cob = qt.filter((w) => et.has(w)).length / Math.max(1, qt.length);
    return qt.length >= 5 && cob >= 0.9
      ? {cita: 'tabla', frase: String(textual).trim()}
      : {cita: 'no', frase: ''};
  };
  // palabras que el planificador usa a veces y que la norma chilena no usa
  const GLOSA = [
    [/recept[aá]culos?/gi, 'enchufes'],
    [/tomas?\s+de\s+corriente|tomacorrientes?/gi, 'enchufes'],
    [/(disyuntor(es)?|interruptor(es)?)\s+diferencial(es)?/gi, 'protector diferencial'],
    [/magnetot[eé]rmic[oa]s?/gi, 'termomagnético'],
    [/\bRIC\b(?!\s*N)/g, ''],
  ];
  const aNorma = (q) =>
    GLOSA.reduce((x, [re, por]) => x.replace(re, por), String(q))
      .replace(/\s+/g, ' ')
      .trim();
  // el numeral que escribió el modelo solo se muestra si está escrito en el fragmento
  const numeral = (num, i) => {
    const m = String(num || '').match(/\d+(?:\.\d+)*/);
    if (!m) return '';
    const d = D[i];
    const esArt = /^art/i.test(d.r);
    if (esArt) return String(d.r).replace(/\s*\(parte.*/, '');
    const re = new RegExp('(^|[^\\d.])' + m[0].replace(/\./g, '\\.') + '([^\\d]|$)');
    return re.test(d.t) || re.test(String(d.r)) ? m[0] : '';
  };

  const nuevoEstado = () => ({
    ficha: {recinto: '', sistema: '', tension: '', potencia: '', otros: ''},
    tema: '',
    memoria: [],
    turnos: [],
    pidio: false,
    pendiente: '',
  });

  async function turno(mensaje, estado, paso = () => {}) {
    const t0 = Date.now();
    llamadas = 0;
    const traza = {};
    paso('Entendiendo la pregunta');
    const plan = (
      await llamar('/plan', {
        ficha: estado.ficha,
        tema: estado.tema,
        memoria: estado.memoria,
        turnos: estado.turnos.slice(-3),
        pendiente: estado.pendiente,
        mensaje,
      })
    ).result;
    traza.plan = plan;
    estado.ficha = {
      ...estado.ficha,
      ...Object.fromEntries(Object.entries(plan.ficha || {}).filter(([, v]) => v)),
    };
    if (plan.tema) estado.tema = plan.tema;
    const cerrar = (r) => {
      estado.turnos.push({q: mensaje, a: r.texto});
      return {...r, ficha: {...estado.ficha}, traza: {...traza, ms: Date.now() - t0, llamadas}};
    };
    // un dato suelto después de que el asistente lo pidió es la respuesta a esa petición, no un dato más
    if (estado.pendiente && plan.tipo === 'dato') plan.tipo = 'aclaracion';
    if (['saludo', 'dato', 'resumen', 'fuera'].includes(plan.tipo)) {
      if (plan.tipo === 'dato') estado.memoria.push(`Dato del caso: ${mensaje.slice(0, 160)}`);
      estado.pidio = false;
      estado.pendiente = '';
      return cerrar({
        tipo: plan.tipo,
        puntos: [],
        texto: plan.directa || 'Anotado.',
        aviso: '',
        sugerencias: [],
      });
    }
    // preguntar antes de responder, una sola vez seguida
    if (plan.falta && !estado.pidio && plan.tipo !== 'aclaracion') {
      estado.pidio = true;
      estado.pendiente = mensaje;
      estado.memoria.push(
        `Pregunta pendiente de la persona: ${mensaje.slice(0, 160)}. El asistente pidió: ${plan.falta.slice(0, 120)}`
      );
      return cerrar({tipo: 'pide', puntos: [], texto: plan.falta, aviso: '', sugerencias: []});
    }
    estado.pidio = false;
    // si veníamos de pedir un dato, lo que se responde es la pregunta original con ese dato
    const pregunta = estado.pendiente ? `${estado.pendiente} (${mensaje})` : mensaje;
    const propias = estado.pendiente ? [estado.pendiente, mensaje] : [mensaje];
    estado.pendiente = '';
    // Los números del cálculo salen de la conversación, no del modelo: el factor de potencia y la tensión solo
    // valen si la persona los dijo; un número que no está escrito tal cual se usa, pero se avisa.
    const dicho = [pregunta, ...estado.turnos.map((t) => t.q), ...Object.values(estado.ficha)].join(' ');
    const pc = {...(plan.calculo || {})};
    const avisos = [];
    if (!/factor de potencia|\bfp\b|cos\s*(φ|fi|phi)/i.test(dicho)) pc.fp = 0;
    if (!/\d\s*k?V\b|volt/i.test(dicho)) pc.tension_v = 0;
    const escrito = (x) =>
      [x, x * 1000].some((v) =>
        new RegExp('(^|[^\\d.,])' + String(+v.toFixed(3)).replace('.', '[.,]') + '([^\\d]|$)').test(dicho)
      );
    for (const [k, nombre, u] of [
      ['potencia_kw', 'potencia', 'kW'],
      ['largo_m', 'largo del tramo', 'm'],
      ['corriente_a', 'corriente', 'A'],
    ])
      if (pc[k] > 0 && !escrito(pc[k]))
        avisos.push(
          `${nombre} de ${n2(pc[k])} ${u} interpretada del mensaje (no está escrita así: verifíquela)`
        );
    const calc = pc.tipo && pc.tipo !== 'ninguno' ? calcular(pc, avisos) : null;
    traza.calc = calc;
    const consultas = (plan.consultas || []).map(aNorma).filter(Boolean).slice(0, 3);
    if (!consultas.length) consultas.push(estado.tema || mensaje);
    // cada cálculo sabe con qué regla de la norma hay que compararlo
    if (calc && pc.tipo === 'caida_tension')
      consultas.splice(1, 0, 'caída de tensión máxima admisible en alimentadores y conductores');
    paso('Buscando en las normas');
    // las palabras de la persona también buscan: a veces son justo las de la norma ("enchufes", "empalme")
    let ids = await buscar([...consultas, ...propias], plan.ambitos, 10, consultas.length);
    ids = [...ids, ...delAlcance(ids, consultas), ...remisiones(ids, 2)].slice(0, 13);
    traza.consultas = consultas;
    paso(`Leyendo ${ids.length} fragmentos`);
    const cuerpo = (lista) => ({
      ids: lista,
      ficha: estado.ficha,
      tema: estado.tema,
      memoria: estado.memoria,
      mensaje,
      pregunta,
      calculo: calc ? calc.texto : '',
    });
    let red = (await llamar('/redacta', cuerpo(ids))).result;
    traza.saltos = 0;
    if (red.buscar_mas) {
      // un segundo paso de búsqueda: lo que el redactor echó de menos
      paso('Buscando la sección a la que remite');
      const usados = [...new Set(red.puntos.map((p) => ids[p.n - 1]).filter((x) => x !== undefined))];
      const mas = await buscar([red.buscar_mas], plan.ambitos, 7);
      const nuevos = [...new Set([...usados, ...mas, ...ids])].slice(0, 13);
      traza.saltos = 1;
      traza.buscar_mas = red.buscar_mas;
      ids = nuevos;
      red = (await llamar('/redacta', cuerpo(ids))).result;
    }
    // el redactor no encontró respaldo: una segunda mirada, buscando con las palabras de la persona primero
    traza.segunda = false;
    if (red.sin_respaldo && !(red.puntos || []).length && !traza.saltos) {
      paso('Buscando de otra forma');
      const mas = await buscar([pregunta, estado.tema, ...consultas].filter(Boolean), plan.ambitos, 10, 2);
      const nuevos = [...new Set([...mas, ...ids])].slice(0, 13);
      traza.segunda = true;
      ids = nuevos;
      const red2 = (await llamar('/redacta', {...cuerpo(ids), segunda: true})).result;
      if ((red2.puntos || []).length) red = red2;
    }
    traza.ids = ids;
    // Números del punto que no están en el extracto, ni en el cálculo, ni en lo que dijo la persona: son cuentas
    // o agregados del modelo. No se bota el punto por eso (puede ser una multiplicación correcta); se avisa.
    const numeros = (t) =>
      (
        String(t)
          .replace(/\d+(?:\.\d+){2,}/g, ' ') // numerales como 5.1.3.6
          .replace(
            /(N[°º]|Tabla|punto|art[ií]culo|art\.|secci[oó]n|anexo|RIC|RPTD|DS)\s*N?[°º]?\s*\d+(?:\.\d+)*/gi,
            ' '
          )
          .match(/\d+(?:[.,]\d+)*/g) || []
      ).map((x) => String(parseFloat(x.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))));
    const vistos = (id) =>
      new Set([...numeros(D[id].t), ...numeros(calc && calc.ok ? calc.texto : ''), ...numeros(dicho)]);
    const noVistos = (texto, id) => {
      const v = vistos(id);
      return [...new Set(numeros(texto).filter((x) => !v.has(x)))];
    };
    // El modelo a veces copia bien la frase y se equivoca en el número del extracto: la frase manda.
    // Se busca primero en el extracto declarado y después en los demás que recibió en este turno.
    const ubicarEn = (textual, declarado) => {
      const u = {id: declarado, ...ubicar(textual, declarado)};
      if (u.cita === 'ok') return u;
      let aprox = null;
      for (const otro of ids) {
        if (otro === declarado) continue;
        const v = ubicar(textual, otro);
        if (v.cita === 'ok') return {id: otro, ...v, movido: true};
        if (v.cita === 'aprox' && !aprox) aprox = {id: otro, ...v, movido: true};
      }
      return u.cita === 'aprox' ? u : aprox || u;
    };
    // comprobar un borrador: citas contra el texto, numerales, y revisión independiente
    const revisar = async (borrador) => {
      paso('Comprobando las citas');
      let pts = (borrador.puntos || [])
        .filter((p) => p.n >= 1 && p.n <= ids.length && p.texto)
        .map((p) => {
          const u = ubicarEn(p.textual, ids[p.n - 1]);
          return {
            ...u,
            texto: p.texto,
            textual: p.textual,
            numeral: numeral(p.numeral, u.id),
            doc: D[u.id],
            numerosFuera: u.cita === 'no' ? [] : noVistos(p.texto, u.id),
          };
        });
      const sinCita = pts.filter((p) => p.cita === 'no');
      pts = pts.filter((p) => p.cita !== 'no'); // lo que no se puede comprobar contra el texto no se muestra
      const fuera = sinCita.map((p) => ({
        texto: p.texto,
        textual: p.textual,
        n: `${p.doc.n} · ${p.doc.r}`,
        motivo: 'la frase citada no está escrita así en el extracto',
      }));
      // Clases de licencia: «instalación tipo D» no es «instalador clase D», y el modelo las confunde. Si el punto
      // nombra una clase, la frase citada tiene que nombrar esa misma clase. Si no la nombra pero la pregunta es por
      // una clase y la frase habla de otra, tampoco sirve. Es una regla del código: no depende del revisor.
      const clasesDe = (t) => new Set([...String(t || '').matchAll(/\b[Cc]lases?\s+([A-E])\b/g)].map((m) => m[1]));
      const dePregunta = clasesDe(pregunta || mensaje);
      const otraClase = (p) => {
        const enFrase = clasesDe(p.frase || p.textual);
        const enPunto = clasesDe(p.texto);
        if (enPunto.size) {
          const faltan = [...enPunto].filter((x) => !enFrase.has(x));
          return faltan.length
            ? `la frase citada no nombra la clase ${faltan.join(' ni la ')}${enFrase.size ? ` (habla de la clase ${[...enFrase].join(', ')})` : ''}`
            : '';
        }
        if (dePregunta.size === 1 && enFrase.size && ![...dePregunta].some((x) => enFrase.has(x)))
          return `la pregunta es por la clase ${[...dePregunta][0]} y la frase citada habla de la clase ${[...enFrase].join(', ')}`;
        return '';
      };
      for (const p of pts) p.otraClase = otraClase(p);
      fuera.push(...pts.filter((p) => p.otraClase).map((p) => ({texto: p.texto, textual: p.textual, n: `${p.doc.n} · ${p.doc.r}`, motivo: p.otraClase})));
      pts = pts.filter((p) => !p.otraClase);
      let j = null;
      const omitidos = [];
      if (pts.length) {
        paso('Revisión independiente');
        j = (
          await llamar('/juez', {
            mensaje,
            pregunta,
            calculo: calc && calc.ok ? calc.texto : '',
            tema: estado.tema,
            ficha: estado.ficha,
            puntos: pts.map((p) => ({id: p.id, texto: p.texto})),
          })
        ).result;
        const v = new Map((j.veredictos || []).map((x) => [x.i, x]));
        pts = pts.map((p, k) => ({
          ...p,
          veredicto: v.get(k + 1) || {respalda: 'no', aplica: 'dudoso', motivo: 'sin revisar'}, // sin veredicto no se muestra
        }));
        // Se muestra solo lo que el extracto respalda sin cambios y que no es de otra situación.
        // "respaldo parcial" no se muestra: en la calibración del revisor ahí caen los datos agregados.
        const malos = (p) => p.veredicto.respalda !== 'si' || p.veredicto.aplica === 'no';
        fuera.push(
          ...pts
            .filter(malos)
            .map((p) => ({texto: p.texto, motivo: p.veredicto.motivo || 'respaldo parcial'}))
        );
        pts = pts.filter((p) => !malos(p));
        // Si hay puntos que aplican sin dudas, los dudosos sobran; si todos son dudosos, se muestran con la duda.
        if (pts.some((p) => p.veredicto.aplica === 'si')) {
          omitidos.push(
            ...pts
              .filter((p) => p.veredicto.aplica !== 'si')
              .map((p) => ({texto: p.texto, motivo: p.veredicto.motivo}))
          );
          pts = pts.filter((p) => p.veredicto.aplica === 'si');
        }
        if (j.responde === 'no') {
          fuera.push(...pts.map((p) => ({texto: p.texto, motivo: 'no responde lo que se preguntó'})));
          pts = [];
        }
      }
      if (j && j.segundo_revisor === false) traza.revisionParcial = true; // el segundo revisor no respondió
      return {pts, fuera, omitidos, sinCita: sinCita.length, juez: j};
    };
    let rev = await revisar(red);
    traza.sinCita = rev.sinCita;
    traza.descartados = rev.fuera;
    traza.reintento = false;
    // si la revisión botó todo y el redactor no había dicho "sin respaldo", una segunda redacción con el motivo
    if (!rev.pts.length && rev.fuera.length && !red.sin_respaldo) {
      paso('Corrigiendo la respuesta');
      traza.reintento = true;
      const red2 = (await llamar('/redacta', {...cuerpo(ids), rechazo: rev.fuera})).result;
      const rev2 = await revisar(red2);
      traza.sinCita += rev2.sinCita;
      traza.descartados = [...rev.fuera, ...rev2.fuera];
      if (rev2.pts.length) red = red2;
      else if (red2.sin_respaldo) red = red2;
      rev = rev2;
    }
    traza.omitidos = rev.omitidos;
    let puntos = rev.pts;
    const juez = rev.juez;
    traza.juez = juez;
    const sin = !puntos.length;
    const aviso = sin
      ? red.sin_respaldo && red.aviso
        ? red.aviso
        : 'No encontré en las normas cargadas una regla que responda eso con respaldo. ' +
          (red.aviso || 'Puede estar en una norma que no está en este corpus.')
      : red.aviso || '';
    // si la revisión botó el punto que venía antes, el primero que queda no puede partir con «También»
    if (puntos.length) puntos[0].texto = puntos[0].texto.replace(/^(También|Además|Asimismo|Por otra parte),?\s+(\p{L})/u, (_, __, c) => c.toUpperCase());
    const texto = sin ? aviso : puntos.map((p) => p.texto).join(' ');
    estado.memoria.push(
      sin
        ? `Se preguntó: ${mensaje.slice(0, 120)}. No se encontró respaldo en las normas cargadas.`
        : (red.memoria || `Se preguntó: ${mensaje.slice(0, 100)}. Respuesta: ${texto.slice(0, 120)}`).slice(
            0,
            240
          )
    );
    return cerrar({
      tipo: sin ? 'sin_respaldo' : 'respuesta',
      puntos,
      texto,
      aviso: sin ? '' : aviso,
      sugerencias: sin ? [] : red.sugerencias || [],
      calc: calc && calc.ok ? calc : null,
    });
  }

  return {turno, nuevoEstado, buscar, remisiones, delAlcance, D, _ubicar: ubicar};
}

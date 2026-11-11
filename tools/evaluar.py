"""Corre las preguntas de tools/preguntas.json por el flujo completo y cuenta cuántas citas existen en el texto oficial.

Necesita el intermediario corriendo en local (repositorio nv-gateway, `NVIDIA_API_KEY=... node dev.mjs`)
y el índice de pliegos del repositorio normativa clonado al lado de este.

Uso: python3 tools/evaluar.py            (requiere numpy)
Variables: GATEWAY (http://localhost:8787), RIC_DIR (../normativa/s)"""
import json
import math
import os
import re
import subprocess
import time
import unicodedata

import numpy as np

D = os.path.dirname(os.path.abspath(__file__))
GATEWAY = os.environ.get('GATEWAY', 'http://localhost:8787')
RIC_DIR = os.environ.get('RIC_DIR', f'{D}/../../normativa/s')


def cargar(ruta_json, ruta_vec):
    j = json.load(open(ruta_json, encoding='utf-8'))
    v = np.frombuffer(open(ruta_vec, 'rb').read(), dtype=np.int8).reshape(-1, j['dim']).astype(np.float32) / j['scale']
    return j, v


R, RV = cargar(f'{RIC_DIR}/ric.json', f'{RIC_DIR}/vec.bin')
DS, DV = cargar(f'{D}/../s/ds8.json', f'{D}/../s/vec.bin')
docs = [{'ref': f"RIC N°{c[0]} · {c[1]}", 'h': f"{R['mat'][str(c[0])]} › {c[2]}", 't': c[4]} for c in R['c']]
docs += [{'ref': f"DS 8 · art. {c['a']}", 'h': c['h'], 't': c['t']} for c in DS['c']]
V = np.vstack([RV, DV])

STOP = set('a al con como cual de del desde donde el en entre es esa ese esta este hay la las le lo los mas más no o para pero por que se ser si sin sobre son su sus un una uno unos y debe deben deberá deberán será serán cada otro otra otros otras puede pueden según cuando todo toda todos todas'.split())


def norm(s):
    return ''.join(ch for ch in unicodedata.normalize('NFD', s.lower()) if unicodedata.category(ch) != 'Mn')


def toks(s):
    out = []
    for w in re.findall(r'[a-z0-9]+', norm(s)):
        if w in STOP or len(w) <= 2:
            continue
        out.append(re.sub(r'(es|s)$', '', w) if len(w) > 4 else w)
    return out


DT = [toks(d['h'] + ' ' + d['t']) for d in docs]
N = len(docs)
AVG = sum(map(len, DT)) / N
DF = {}
for t in DT:
    for w in set(t):
        DF[w] = DF.get(w, 0) + 1


def bm25(q):
    s = np.zeros(N)
    for i, t in enumerate(DT):
        for w in set(toks(q)):
            f = t.count(w)
            if f:
                idf = math.log(1 + (N - DF[w] + 0.5) / (DF[w] + 0.5))
                s[i] += idf * f * 2.2 / (f + 1.2 * (0.25 + 0.75 * len(t) / AVG))
    return s


def post(ruta, cuerpo):
    for intento in range(4):
        r = subprocess.run(['curl', '-s', '-X', 'POST', GATEWAY + ruta, '-H', 'Origin: http://localhost:8770',
                            '-H', 'Content-Type: application/json', '-d', '@-'],
                           input=json.dumps(cuerpo), capture_output=True, text=True)
        try:
            d = json.loads(r.stdout)
            if d.get('ok'):
                return d
        except ValueError:
            pass
        time.sleep(3)
    raise SystemExit(f'sin respuesta de {ruta}: {r.stdout[:200]}')


def buscar(q, k=8):
    e = np.array(post('/embed', {'text': q, 'dim': 512})['vectors'][0], dtype=np.float32)
    sem, kw, f = V @ (e / np.linalg.norm(e)), bm25(q), {}
    for r, i in enumerate(np.argsort(-sem)[:60]):
        f[i] = f.get(i, 0) + 1 / (60 + r)
    for r, i in enumerate([i for i in np.argsort(-kw)[:60] if kw[i] > 0]):
        f[i] = f.get(i, 0) + 0.7 / (60 + r)
    return [i for i, _ in sorted(f.items(), key=lambda x: -x[1])[:k]]


def plano(s):
    return re.sub(r'[^a-z0-9]', '', norm(s))


def verifica(cita, texto):
    """ok: la frase está letra por letra; tabla: casi todas sus palabras están (el PDF desordena las tablas); no: ninguna."""
    if len(plano(cita)) > 20 and plano(cita) in plano(texto):
        return 'ok'
    qt, et = toks(cita), set(toks(texto))
    return 'tabla' if len(qt) >= 5 and sum(w in et for w in qt) / len(qt) >= 0.9 else 'no'


total = {'ok': 0, 'tabla': 0, 'no': 0}
sin_respuesta = 0
filas = []
for q in json.load(open(f'{D}/preguntas.json', encoding='utf-8')):
    consulta = post('/reformula', {'historial': [], 'pregunta': q})['result']['consulta']
    top = buscar(f'{consulta} {q}')
    ext = [{'ref': docs[i]['ref'], 'texto': docs[i]['h'] + '\n' + docs[i]['t']} for i in top]
    puntos = [p for p in post('/responde', {'historial': [], 'pregunta': q, 'extractos': ext})['result']['puntos'] if 1 <= p['n'] <= len(ext)]
    ver = [verifica(p['textual'], ext[p['n'] - 1]['texto']) for p in puntos]
    for v in ver:
        total[v] += 1
    sin_respuesta += not puntos
    filas.append({'pregunta': q, 'respuesta': puntos[0]['texto'] if puntos else '', 'fuentes': sorted({ext[p['n'] - 1]['ref'] for p in puntos}), 'citas': ver})
    print(q, '→', ver)

json.dump({'filas': filas, 'total': total, 'sin_respuesta': sin_respuesta}, open(f'{D}/resultado.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f"\nPreguntas: {len(filas)} · sin respuesta citada: {sin_respuesta}")
print(f"Citas: exactas {total['ok']} · coinciden con tabla {total['tabla']} · sin verificar {total['no']}")

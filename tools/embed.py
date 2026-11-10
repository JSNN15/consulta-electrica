"""Vectoriza los fragmentos (passage, 512 dim) y guarda vectores int8 + índice compacto para el navegador.
La API de embeddings de NVIDIA falla con lotes de más de un texto: se envía uno por llamada, con pausa."""
import json
import math
import os
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

D = os.path.dirname(os.path.abspath(__file__))
KEY = os.environ['NVIDIA_API_KEY']
DIM = 512
PAUSA = float(os.environ.get('PAUSA', '1.0'))
ch = json.load(open(f'{D}/../raw/chunks.json'))


def ptxt(c):
    return f"{c['n']} artículo {c['a']}. {c['h']}\n{c['t']}"


def emb(text):
    body = json.dumps({'model': 'nvidia/nemotron-3.5-embed-1b', 'input': [text], 'input_type': 'passage',
                       'encoding_format': 'float', 'dimensions': DIM, 'truncate': 'END'})
    for k in range(10):
        r = subprocess.run(['curl', '-s', '--max-time', '15', 'https://integrate.api.nvidia.com/v1/embeddings',
                            '-H', f'Authorization: Bearer {KEY}', '-H', 'Content-Type: application/json', '-d', '@-'],
                           input=body, capture_output=True, text=True)
        try:
            return json.loads(r.stdout)['data'][0]['embedding']
        except Exception:
            print('reintento', r.stdout[:120], flush=True)
            time.sleep(2 + 2 * k)
    sys.exit('falló')


cache = f'{D}/../raw/vec_f32.json'
V = {int(k): v for k, v in json.load(open(cache)).items()} if os.path.exists(cache) else {}
lock, last = threading.Lock(), [0.0]


def job(i):
    with lock:
        w = last[0] + PAUSA - time.time()
        if w > 0:
            time.sleep(w)
        last[0] = time.time()
    v = emb(ptxt(ch[i]))
    with lock:
        V[i] = v
        if len(V) % 25 == 0:
            json.dump(V, open(cache, 'w'))
            print(len(V), '/', len(ch), flush=True)


with ThreadPoolExecutor(int(os.environ.get("HILOS", "4"))) as ex:
    list(ex.map(job, [i for i in range(len(ch)) if i not in V]))
json.dump(V, open(cache, 'w'))

# normaliza y cuantiza a int8 con una escala común
U = []
for i in range(len(ch)):
    v = V[i]
    n = math.sqrt(sum(x * x for x in v)) or 1
    U.append([x / n for x in v])
S = 127 / max(abs(x) for u in U for x in u)
q = bytearray()
for u in U:
    q += bytes((round(x * S) & 0xFF) for x in u)
os.makedirs(f'{D}/../s', exist_ok=True)
open(f'{D}/../s/vec.bin', 'wb').write(bytes(q))
json.dump({'dim': DIM, 'scale': S, 'c': ch}, open(f'{D}/../s/ds8.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('listo', len(ch), 'fragmentos')

"""Vectoriza los fragmentos nuevos (passage, 512 dim) con Nemotron Embed. Guarda avance en vec_new.json para poder retomar."""
import json, os, time, subprocess, sys, threading
from concurrent.futures import ThreadPoolExecutor
D = os.path.dirname(os.path.abspath(__file__))
KEY = os.environ["NVIDIA_API_KEY"]
ch = json.load(open(f'{D}/chunks_new.json'))
ptxt = lambda c: f"{c['norma']} {c['mat']}. {c['h']}. {c['ref']}\n{c['t']}"
def emb(text):
    body = json.dumps({'model': 'nvidia/nemotron-3.5-embed-1b', 'input': [text], 'input_type': 'passage', 'encoding_format': 'float', 'dimensions': 512, 'truncate': 'END'})
    for k in range(10):
        r = subprocess.run(['curl', '-s', '--max-time', '10', 'https://integrate.api.nvidia.com/v1/embeddings', '-H', f'Authorization: Bearer {KEY}', '-H', 'Content-Type: application/json', '-d', '@-'], input=body, capture_output=True, text=True)
        try:
            return json.loads(r.stdout)['data'][0]['embedding']
        except Exception:
            print("reintento", r.stdout[:80].replace("\n"," "), flush=True); time.sleep(2 + 2 * k)
    return None
cache = f'{D}/vec_new.json'
V = {int(k): v for k, v in json.load(open(cache)).items()} if os.path.exists(cache) else {}
lock, last = threading.Lock(), [0.0]
def job(i):
    with lock:
        w = last[0] + float(os.environ.get("ESP","1.65")) - time.time()
        if w > 0: time.sleep(w)
        last[0] = time.time()
    v = emb(ptxt(ch[i]))
    with lock:
        if v: V[i] = v
        if len(V) % 20 == 0:
            json.dump(V, open(cache, 'w')); print(len(V), '/', len(ch), flush=True)
with ThreadPoolExecutor(3) as ex:
    list(ex.map(job, [i for i in range(len(ch)) if i not in V]))
json.dump(V, open(cache, 'w')); print('fin', len(V), '/', len(ch), flush=True)

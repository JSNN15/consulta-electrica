"""Une el índice anterior (pliegos RIC y DS 8) con las normas nuevas en un solo corpus para el chat:
corpus.json (fragmentos con norma, punto, materia, ámbito y enlace) y corpus.bin (vectores int8, 512 por fragmento)."""
import json, os, re, sys
import numpy as np
D = os.path.dirname(os.path.abspath(__file__)); B = D + '/..'
R = json.load(open(f'{B}/gh/normativa/s/ric.json'))
RV = np.frombuffer(open(f'{B}/gh/normativa/s/vec.bin', 'rb').read(), dtype=np.int8).reshape(-1, R['dim']).astype(np.float32) / R['scale']
E = json.load(open(f'{B}/ce/s/ds8.json'))
EV = np.frombuffer(open(f'{B}/ce/s/vec.bin', 'rb').read(), dtype=np.int8).reshape(-1, E['dim']).astype(np.float32) / E['scale']
docs, vecs, mat = [], [], {}


def rango(ref, texto):
    # la etiqueta original nombra el numeral donde parte la sección; un fragmento largo llega mucho más allá
    if not re.match(r'\d', ref):
        return ref
    cap = ref.split('.')[0]
    nums = [m for m in re.findall(r'(?m)^\s*(\d{1,2}(?:\.\d{1,2}){1,4})\.?\s+\S', texto) if m.split('.')[0] == cap]
    if not nums:
        return ref
    return nums[0] if nums[0] == nums[-1] else f'{nums[0]}–{nums[-1]}'


for c, v in zip(R['c'], RV):
    n = f"RIC N°{c[0]}"; mat[n] = R['mat'][str(c[0])]
    docs.append({'n': n, 'r': rango(c[1], c[4]), 'h': c[2], 't': c[4], 'u': f"{R['url'][str(c[0])]}#page={c[3]}", 'a': 'consumo'}); vecs.append(v)
mat['DS 8'] = 'Reglamento de seguridad de las instalaciones de consumo de energía eléctrica'
for c, v in zip(E['c'], EV):
    docs.append({'n': 'DS 8', 'r': f"art. {c['a']}" + (f" (parte {c['k']})" if c['k'] else ''), 'h': c['h'], 't': c['t'], 'u': c['u'], 'a': 'consumo'}); vecs.append(v)
nuevos = json.load(open(f'{D}/chunks_new.json'))
V = {int(k): v for k, v in json.load(open(f'{D}/vec_new.json')).items()} if os.path.exists(f'{D}/vec_new.json') else {}
falt = 0
for i, c in enumerate(nuevos):
    mat[c['norma']] = c['mat']
    if i not in V: falt += 1; continue
    docs.append({'n': c['norma'], 'r': c['ref'], 'h': c['h'], 't': c['t'], 'u': c['url'], 'a': c['amb']}); vecs.append(np.array(V[i], dtype=np.float32))
U = np.vstack(vecs); U /= np.linalg.norm(U, axis=1, keepdims=True)
S = 127 / np.abs(U).max()
q = np.round(U * S).astype(np.int8)
for out in [f'{B}/ce/s', f'{B}/gh/consulta-electrica/s']:
    open(f'{out}/corpus.bin', 'wb').write(q.tobytes())
    json.dump({'dim': 512, 'scale': float(S), 'mat': mat, 'd': docs}, open(f'{out}/corpus.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    # el intermediario pide el texto por tramos de 256 fragmentos: así no tiene que leer el corpus entero en cada arranque
    os.makedirs(f'{out}/t', exist_ok=True)
    for k in range(0, len(docs), 256):
        json.dump({'mat': mat, 'd': [{x: d[x] for x in 'nrhta'} for d in docs[k:k + 256]]}, open(f'{out}/t/{k // 256}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
from collections import Counter
print(len(docs), 'fragmentos |', falt, 'nuevos sin vector todavía |', os.path.getsize(f'{B}/ce/s/corpus.json') // 1024, 'KB json,', len(q.tobytes()) // 1024, 'KB vectores')
print(dict(Counter(re.sub(r' N°.*', '', d['n']) for d in docs)))

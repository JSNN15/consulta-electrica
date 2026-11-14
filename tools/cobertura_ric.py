"""Auditoría de cobertura de los pliegos RIC: qué parte del texto de cada PDF quedó dentro de algún fragmento del corpus.
Se compara por líneas (sin espacios ni tildes); las que no están son portadas, índices, encabezados y pies de página,
o texto perdido al fragmentar. Salida: cobertura_ric.json."""
import glob, json, os, re, subprocess, unicodedata
D = os.path.dirname(os.path.abspath(__file__)); B = D + '/..'
C = json.load(open(f'{B}/ce/s/corpus.json'))['d']
def plano(s):
    s = unicodedata.normalize('NFD', s.lower())
    return re.sub(r'[^a-z0-9]', '', ''.join(c for c in s if unicodedata.category(c) != 'Mn'))
out = []
for f in sorted(glob.glob(f'{B}/ric/raw/RIC-N*.pdf')):
    n = int(re.search(r'RIC-N(\d+)', f).group(1))
    frag = plano(' '.join(d['t'] for d in C if d['n'] == f'RIC N°{n}'))
    lineas = [plano(l) for l in subprocess.run(['pdftotext', '-layout', f, '-'], capture_output=True, text=True).stdout.split('\n')]
    lineas = [l for l in lineas if len(l) >= 12]
    tot = sum(len(l) for l in lineas); dentro = sum(len(l) for l in lineas if l in frag)
    out.append({'norma': f'RIC N°{n}', 'fragmentos': sum(d['n'] == f'RIC N°{n}' for d in C), 'cobertura': round(dentro / max(1, tot), 3)})
    print(out[-1])
json.dump(out, open(f'{D}/cobertura_ric.json', 'w'), ensure_ascii=False, indent=1)
print('media', round(sum(o['cobertura'] for o in out) / len(out), 3), '| mínima', min(o['cobertura'] for o in out))

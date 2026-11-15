"""Arregla los artículos largos partidos en varios fragmentos, sin cambiar cuántos fragmentos hay ni su orden:
1) si un corte cayó en medio de una palabra o de un numeral, se corre hasta el inicio de ese numeral o de esa frase;
2) cada fragmento de continuación parte con el encabezado del artículo, para que se sepa a qué caso pertenece.
Escribe chunks_new.json y deja en cambiados.json los índices que hay que volver a vectorizar."""
import json, os, re
D = os.path.dirname(os.path.abspath(__file__))
ch = json.load(open(f'{D}/chunks_new.v_antes_partes.json'))
base = lambda r: re.sub(r' \(parte \d+\)$', '', r)
cambiados, cortes = set(), 0
i = 0
while i < len(ch):
    j = i
    while j + 1 < len(ch) and '(parte ' in ch[i]['ref'] and ch[j + 1]['norma'] == ch[i]['norma'] and base(ch[j + 1]['ref']) == base(ch[i]['ref']) and '(parte ' in ch[j + 1]['ref']:
        j += 1
    if j > i:
        g = ch[i:j + 1]
        # 1) cortes en medio de palabra: lo que quedó colgando pasa al fragmento siguiente
        for k in range(len(g) - 1):
            a, b = g[k]['t'], g[k + 1]['t']
            if a and b and a[-1].isalnum() and (b[0].isalnum() or b[0] in ' ,;'):
                # inicio del último numeral (línea que parte con "4.-", "b)" …) o, si no hay, de la última frase
                m = list(re.finditer(r'\n\s*(?:\d+[.)-]+|[a-z]\))', a))
                corte = m[-1].start() if m and m[-1].start() > len(a) * 0.5 else a.rfind('. ') + 1
                if corte > len(a) * 0.4:
                    g[k]['t'], g[k + 1]['t'] = a[:corte].rstrip(), (a[corte:] + b).lstrip()
                    cambiados.update({i + k, i + k + 1}); cortes += 1
        # 2) encabezado del artículo al inicio de cada continuación
        cab = g[0]['t'].split('\n')[0].strip()
        m = re.match(r'(.{20,260}?[:.])(\s|$)', cab)
        cab = m.group(1) if m else cab[:200]
        for k in range(1, len(g)):
            if not g[k]['t'].startswith(cab[:40]):
                g[k]['t'] = cab + ' […]\n' + g[k]['t']
                cambiados.add(i + k)
    i = j + 1
json.dump(ch, open(f'{D}/chunks_new.json', 'w'), ensure_ascii=False)
json.dump(sorted(cambiados), open(f'{D}/cambiados.json', 'w'))
V = json.load(open(f'{D}/vec_new.v_antes_partes.json'))
for k in cambiados: V.pop(str(k), None)
json.dump(V, open(f'{D}/vec_new.json', 'w'))
print(len(ch), 'fragmentos;', len(cambiados), 'cambian;', cortes, 'cortes en medio de palabra corregidos; largo máximo', max(len(c['t']) for c in ch))
for c in ch:
    if c['norma'] == 'DS 92' and c['ref'].startswith('art. 7 '): print('---', c['ref'], len(c['t']), '\n', c['t'][-260:] if c['ref'].endswith('1)') else c['t'][:420])

"""Arma los fragmentos de las normas que se agregan al chat: pliegos RPTD (PDF de la SEC) y decretos (XML de LeyChile).
Los pliegos RIC y el DS 8 ya están fragmentados en el índice anterior; aquí solo se les agrega la lista de numerales.
Salida: chunks_new.json (por vectorizar) y cobertura.json (cuánto del texto original quedó en fragmentos)."""
import glob
import json
import os
import re
import subprocess
import xml.etree.ElementTree as ET

D = os.path.dirname(os.path.abspath(__file__))
NS = '{http://www.leychile.cl/esquemas}'
TARGET, MAXC = 1300, 2000

# idNorma en LeyChile, nombre corto, materia, ámbito
DECRETOS = [
    ('1119451', 'DS 109', 'Reglamento de seguridad de instalaciones de producción, transporte y distribución', 'redes'),
    ('9058', 'DS 92', 'Reglamento de instaladores eléctricos', 'instaladores'),
    ('1149788', 'DS 57', 'Reglamento de generación distribuida para autoconsumo', 'generacion'),
    ('124102', 'DS 327', 'Reglamento de la Ley General de Servicios Eléctricos', 'servicio'),
]
HEAD = re.compile(r'^\s{0,12}(\d{1,2}(?:\.\d{1,2}){0,4})\.?\s{2,}(\S.*)$')
FOOT = re.compile(r'(Pliego Técnico Normativo RPTD|SEC\s*-\s*División de Ingeniería|P\s*á\s*g\s*i\s*n\s*a\s+\d|^\s*\d+\s*$|^\s*Página \d+ de \d+)')


def clean(s):
    return re.sub(r'[ \t]{2,}', '  ', s).strip()


def pdf_pages(path):
    return subprocess.run(['pdftotext', '-layout', path, '-'], capture_output=True, text=True).stdout.split('\f')


def chunk_pdf(path, norma, url):
    pages = pdf_pages(path)
    full = '\n'.join(pages)
    m = re.search(r'MATERIA\s*:\s*(.+?)\n\s*\n', full, re.S)
    mat = re.sub(r'\s+', ' ', m.group(1)).strip(' .').capitalize() if m else ''
    secs, cur, top, started = [], None, 0, False
    for pi, pg in enumerate(pages, 1):
        for ln in pg.split('\n'):
            if FOOT.search(ln) or '.....' in ln:
                continue
            h = HEAD.match(ln)
            if h:
                num, txt = h.group(1), h.group(2).strip()
                first = int(num.split('.')[0])
                if (not started and num == '1') or (started and top - 1 <= first <= top + 1):
                    started = True
                    if '.' not in num:
                        top = first
                    if cur:
                        secs.append(cur)
                    cur = {'n': num, 't': txt, 'pg': pi, 'L': [ln]}
                    continue
            if re.match(r'^\s{0,40}ANEXO\b', ln) and started and len(ln.strip()) < 40:
                secs.append(cur)
                top = 99
                cur = {'n': re.sub(r'\s+', ' ', ln.strip()).upper(), 't': ln.strip(), 'pg': pi, 'L': [ln]}
                continue
            if cur:
                cur['L'].append(ln)
    if cur:
        secs.append(cur)
    titles = {}
    for s in secs:
        t = s['t']
        if s['n'].count('.') == 0 and len(t) < 90 and not t.endswith(','):
            titles.setdefault(s['n'], t.rstrip('.'))
    out, buf, start = [], [], None

    def flush():
        nonlocal buf, start
        if not buf:
            return
        text = '\n'.join(clean(x) for x in '\n'.join(b['txt'] for b in buf).split('\n') if x.strip())
        if len(text) > 80:
            s0 = buf[0]
            ch = s0['n'].split('.')[0]
            parts, rest = [], text
            while len(rest) > MAXC:
                cut = rest.rfind('\n', 0, TARGET + 300)
                if cut < TARGET // 2:
                    cut = rest.rfind(' ', 0, TARGET + 300)
                parts.append(rest[:cut])
                rest = rest[cut:].lstrip()
            parts.append(rest)
            for p in parts:
                out.append({'norma': norma, 'mat': mat, 'ref': s0['n'] + ('' if buf[-1]['n'] == s0['n'] else '–' + buf[-1]['n']),
                            'h': titles.get(ch, ''), 't': p, 'pg': s0['pg'], 'url': url})
        buf, start = [], None

    for s in secs:
        txt = '\n'.join(s['L'])
        key = '.'.join(s['n'].split('.')[:2])
        size = sum(len(b['txt']) for b in buf)
        if buf and (size + len(txt) > TARGET or (key != start and size > 600) or key.split('.')[0] != start.split('.')[0]):
            flush()
        if start is None:
            start = key
        buf.append({'n': s['n'], 'pg': s['pg'], 'txt': txt})
    flush()
    flat = [re.sub(r'\s+', ' ', pg) for pg in pages]
    for c in out:
        probe = re.sub(r'\s+', ' ', c['t'])[:50]
        for k in range(c['pg'] - 1, len(flat)):
            if probe in flat[k]:
                c['pg'] = k + 1
                break
        c['url'] = f"{url}#page={c['pg']}"
    cuerpo = sum(len(re.sub(r'\s+', '', pg)) for pg in pages)
    return out, mat, cuerpo


def limpio(t):
    t = re.sub(r'[ \t]+', ' ', t or '')
    t = re.sub(r'(?<![.:;\n])\n(?!\n|\s*[a-z]\)|\s*\d+[.)-])', ' ', t)
    return re.sub(r'\n{3,}', '\n\n', t).strip()


def partes(t, mx=1400):
    if len(t) <= mx:
        return [t]
    out, cur = [], ''
    for p in re.split(r'\n\s*\n|\n(?=\s*[a-z]\)|\s*\d+[.)-]\s)', t):
        if cur and len(cur) + len(p) > mx:
            out.append(cur.strip())
            cur = ''
        cur += p + '\n'
    if cur.strip():
        out.append(cur.strip())
    fin = []
    for b in out:
        while len(b) > mx * 1.3:
            corte = b.rfind('. ', 0, mx) + 1 or mx
            fin.append(b[:corte].strip())
            b = b[corte:]
        fin.append(b.strip())
    return fin


def chunk_xml(idn, norma, mat):
    raiz = ET.parse(f'{D}/raw/ley_{idn}.xml').getroot()
    sal, total = [], [0]

    def rec(nodo, ruta):
        for ef in nodo.findall(f'{NS}EstructurasFuncionales/{NS}EstructuraFuncional'):
            tipo = ef.attrib.get('tipoParte', '')
            texto = limpio(ef.findtext(f'{NS}Texto'))
            nombre = (ef.findtext(f'{NS}Metadatos/{NS}NombreParte') or '').strip()
            titulo = (ef.findtext(f'{NS}Metadatos/{NS}TituloParte') or '').strip()
            if ef.attrib.get('derogado') == 'derogado':
                continue
            if tipo.startswith('Artículo') or tipo == 'Doble Articulado':
                m = re.match(r'\s*Art[íi]culo\s+([\dº°]+\s*(?:bis|ter|quáter)?)', texto, re.I)
                n = re.sub(r'[º°\s]', '', m.group(1) if m else nombre.split('(')[0]).strip()
                if not re.match(r'\d', n):
                    rec(ef, ruta)
                    continue
                total[0] += len(re.sub(r'\s+', '', texto))
                tr = partes(texto)
                for k, t in enumerate(tr):
                    sal.append({'norma': norma, 'mat': mat, 'ref': f'art. {n}' + (f' (parte {k + 1})' if len(tr) > 1 else ''),
                                'h': ' › '.join(ruta)[:140], 't': t, 'pg': 0,
                                'url': f'https://www.bcn.cl/leychile/navegar?idNorma={idn}&idParte={ef.attrib.get("idParte")}'})
                rec(ef, ruta)
            else:
                enc = titulo or texto.split('\n')[0][:120]
                rec(ef, ruta + [enc] if enc else ruta)

    rec(raiz, [])
    return sal, total[0], raiz.attrib.get('fechaVersion')


def main():
    urls = dict(l.split('\t') for l in open(f'{D}/raw/urls.txt').read().splitlines() if '\t' in l)
    nuevos, cob = [], []
    for n in range(1, 17):
        f = f'{D}/raw/RPTD-N{n:02d}.pdf'
        ch, mat, cuerpo = chunk_pdf(f, f'RPTD N°{n:02d}', urls[str(n)])
        for c in ch:
            c['amb'] = 'redes'
        nuevos += ch
        en = sum(len(re.sub(r'\s+', '', c['t'])) for c in ch)
        cob.append({'norma': f'RPTD N°{n:02d}', 'mat': mat, 'fragmentos': len(ch), 'cobertura': round(en / max(1, cuerpo), 3)})
    for idn, norma, mat, amb in DECRETOS:
        ch, total, ver = chunk_xml(idn, norma, mat)
        for c in ch:
            c['amb'] = amb
        nuevos += ch
        en = sum(len(re.sub(r'\s+', '', c['t'])) for c in ch)
        cob.append({'norma': norma, 'mat': mat, 'fragmentos': len(ch), 'cobertura': round(en / max(1, total), 3), 'version': ver})
    json.dump(nuevos, open(f'{D}/chunks_new.json', 'w'), ensure_ascii=False)
    json.dump(cob, open(f'{D}/cobertura_new.json', 'w'), ensure_ascii=False, indent=1)
    L = [len(c['t']) for c in nuevos]
    print(len(nuevos), 'fragmentos nuevos | largo medio', sum(L) // len(L), '| max', max(L))
    for c in cob:
        print(' ', c['norma'].ljust(11), str(c['fragmentos']).rjust(4), 'cobertura', c['cobertura'], '|', c['mat'][:60], c.get('version', ''))


if __name__ == '__main__':
    main()

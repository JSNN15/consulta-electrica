"""Parte el DS 8/2019 descargado de LeyChile en fragmentos por artículo, con su título como contexto.
Los pliegos RIC se toman del índice del repositorio normativa."""
import json
import os
import re
import xml.etree.ElementTree as ET

D = os.path.dirname(os.path.abspath(__file__))
NS = '{http://www.leychile.cl/esquemas}'
NORMAS = [
    ('8', '1143069', 'DS 8'),
]
MAX = 1400  # caracteres por fragmento; los artículos largos se parten en párrafos


def limpio(t):
    t = re.sub(r'[ \t]+', ' ', t or '')
    t = re.sub(r'(?<![.:;\n])\n(?!\n|\s*[a-z]\)|\s*\d+[.)-])', ' ', t)  # une líneas cortadas del original
    return re.sub(r'\n{3,}', '\n\n', t).strip()


def numero(texto, nombre):
    m = re.match(r'\s*Art[íi]culo\s+([\dº°]+\s*(?:bis|ter)?)', texto, re.I)
    n = m.group(1) if m else (nombre or '').split('(')[0]
    return re.sub(r'[º°\s]', '', n).strip() or '?'


def partes(t):
    if len(t) <= MAX:
        return [t]
    out, cur = [], ''
    for p in re.split(r'\n\s*\n|\n(?=\s*[a-z]\)|\s*\d+[.)-]\s)', t):
        if cur and len(cur) + len(p) > MAX:
            out.append(cur.strip())
            cur = ''
        cur += p + '\n'
    if cur.strip():
        out.append(cur.strip())
    # último recurso: cortar por oraciones los bloques que siguen siendo largos
    fin = []
    for b in out:
        while len(b) > MAX * 1.3:
            corte = b.rfind('. ', 0, MAX) + 1 or MAX
            fin.append(b[:corte].strip())
            b = b[corte:]
        fin.append(b.strip())
    return fin


def recorrer(nodo, ruta, norma, idn, sal):
    for ef in nodo.findall(f'{NS}EstructurasFuncionales/{NS}EstructuraFuncional'):
        tipo = ef.attrib.get('tipoParte', '')
        texto = limpio(ef.findtext(f'{NS}Texto'))
        nombre = (ef.findtext(f'{NS}Metadatos/{NS}NombreParte') or '').strip()
        titulo = (ef.findtext(f'{NS}Metadatos/{NS}TituloParte') or '').strip()
        if ef.attrib.get('derogado') == 'derogado':
            continue
        if tipo.startswith('Artículo') or tipo == 'Doble Articulado':
            n = numero(texto, nombre)
            if not re.match(r'\d', n):  # artículos del decreto que modifica (PRIMERO, SEGUNDO…), no del reglamento
                recorrer(ef, ruta, norma, idn, sal)
                continue
            trozos = partes(texto)
            for k, t in enumerate(trozos):
                sal.append({
                    'n': norma, 'a': n, 'k': k + 1 if len(trozos) > 1 else 0,
                    'h': ' › '.join(ruta), 't': t,
                    'u': f'https://www.bcn.cl/leychile/navegar?idNorma={idn}&idParte={ef.attrib.get("idParte")}',
                })
            recorrer(ef, ruta, norma, idn, sal)
        else:
            enc = titulo or texto.split('\n')[0][:120]
            recorrer(ef, ruta + [enc] if enc else ruta, norma, idn, sal)


def main():
    sal = []
    for clave, idn, corto in NORMAS:
        raiz = ET.parse(f'{D}/../raw/ley_{idn}.xml').getroot()
        antes = len(sal)
        recorrer(raiz, [], corto, idn, sal)
        print(corto, len(sal) - antes, 'fragmentos')
    json.dump(sal, open(f'{D}/../raw/chunks.json', 'w'), ensure_ascii=False, indent=0)


if __name__ == '__main__':
    main()

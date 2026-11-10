#!/usr/bin/env bash
# Descarga el DS 8/2019 (reglamento de seguridad de las instalaciones de consumo) desde el servicio XML de LeyChile.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p raw
curl -sSf --http1.1 --retry 3 -A 'Mozilla/5.0' -o raw/ley_1143069.xml "https://www.leychile.cl/Consulta/obtxml?opt=7&idNorma=1143069"
echo "Listo: raw/ley_1143069.xml"

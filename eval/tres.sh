#!/bin/bash
# Corre cada set tres veces (en trozos, porque una corrida larga agota la cuota) y deja un archivo por corrida.
cd "$(dirname "$0")"
A=$(python3 -c "import json;d=json.load(open('desarrollo.json'));print(','.join(c['id'] for c in d[:7]))")
B=$(python3 -c "import json;d=json.load(open('desarrollo.json'));print(','.join(c['id'] for c in d[7:]))")
for k in 1 2 3; do
  [ -f /tmp/tres_R$k.json ] || GATEWAY=http://localhost:8787 PAUSA=1400 node evaluar.mjs reservado.json /tmp/tres_R$k.json > /dev/null 2>&1
  echo "R$k $(date +%H:%M)" >> /tmp/tres.log
  [ -f /tmp/tres_Da$k.json ] || SOLO=$A GATEWAY=http://localhost:8787 PAUSA=1400 node evaluar.mjs desarrollo.json /tmp/tres_Da$k.json > /dev/null 2>&1
  echo "Da$k $(date +%H:%M)" >> /tmp/tres.log
  [ -f /tmp/tres_Db$k.json ] || SOLO=$B GATEWAY=http://localhost:8787 PAUSA=1400 node evaluar.mjs desarrollo.json /tmp/tres_Db$k.json > /dev/null 2>&1
  echo "Db$k $(date +%H:%M)" >> /tmp/tres.log
done
echo FIN >> /tmp/tres.log

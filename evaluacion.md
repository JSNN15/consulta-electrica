# Evaluación

Fecha de las corridas: 14 de noviembre de 2026. Corpus: 2.064 fragmentos. Modelo: Nemotron Super (texto) y Nemotron Embed, por la API de prueba de NVIDIA.

Se validan tres cosas por separado: las conversaciones completas, el revisor que decide qué se muestra, y cuánto del texto oficial quedó en el corpus. Todo se puede repetir con los archivos de `eval/` y `tools/`.

## Resumen

| Qué se mide | Meta del prototipo | Desarrollo (42 turnos) | Reservado (20 turnos) |
|---|---|---|---|
| Turnos que cumplen lo esperado | ≥ 85 % / ≥ 80 % | 40 de 42 (95 %) | 20 de 20 |
| Respondió con un dato cuando debía decir "no está" | 0 | 0 de 5 | 0 de 4 |
| Citas mostradas que están en el texto oficial | ≥ 95 % | 57 de 57 | 29 de 29 |
| Cita la norma esperada | ≥ 90 % | 24 de 24 | 12 de 12 |
| Pide el dato cuando sin él no se puede responder | ≥ 80 % | 2 de 2 | 1 de 1 |
| Pide un dato sin necesidad | ≤ 10 % | 0 | 0 |
| Tiempo por turno, mediana (p90) | ≤ 20 s | 7,8 s (13,7 s) | 9,2 s (15,5 s) |
| Llamadas al modelo por turno | | 3,3 | 3,1 |

El set reservado se escribió antes de ajustar el sistema y se corrió una sola vez, con el sistema ya congelado.

**Lo que las pruebas automáticas no vieron.** Leídas una por una las 20 respuestas del set reservado contra sus fragmentos (lectura de quien construyó el sistema, no de un instalador): 16 correctas, 3 incompletas y 1 incorrecta.

- Incorrecta: "¿Qué instalaciones puede hacer un instalador clase D?" respondió que la clase D solo puede ejecutar instalaciones F y G. Esa restricción es de la clase E; la clase D puede proyectarlas, ejecutarlas y dirigirlas (DS 92, art. 7). El artículo quedó cortado en dos fragmentos y el segundo empieza a mitad de frase, sin el encabezado que dice de qué clase se habla. La cita existe, el revisor la aprobó y la prueba solo comprobaba la norma citada.
- Incompletas: la distancia de un enchufe a la tina (explica qué se permite en el volumen 2 pero no dice dónde empieza), la potencia de empalme para una casa con cocina y termo eléctricos (da el mínimo y cómo se declara, no un valor), y el diferencial de un cargador de auto (el revisor botó el primer punto y el segundo quedó refiriéndose a él).

Una respuesta incorrecta mostrada en 20 es el número que importa para decidir si esto se puede usar sin revisión: todavía no.

## Conversaciones

`eval/desarrollo.json` (14 conversaciones) y `eval/reservado.json` (10). Cada turno declara lo que se espera: tipo de respuesta (responde, pide un dato, declina), norma que debe citar o que no debe citar, datos que deben aparecer, valores de la ficha del caso, si debía usar la calculadora. `eval/evaluar.mjs` las corre por el mismo `motor.js` que usa la página.

| Categoría | Desarrollo | Reservado |
|---|---|---|
| Memoria del caso y preguntas encadenadas | 13 de 13 | 4 de 4 |
| Pedir el dato que falta y responder con él | 6 de 7 | 2 de 2 |
| Vocabulario de terreno | 3 de 3 | 3 de 3 |
| Cálculo (corriente, caída de tensión) | 2 de 2 | 1 de 1 |
| Saludos, resumen, conversación | 4 de 5 | |
| Normas agregadas (RPTD, DS 57, 92, 327) | 7 de 7 | 4 de 4 |
| Dato simple | | 2 de 2 |
| Fuera de las normas cargadas | 5 de 5 | 4 de 4 |

Los dos turnos que fallan en desarrollo fallan por omisión: el revisor botó un punto correcto (los 30 mA del diferencial en una casa; los 10 mA de los volúmenes 0 y 1 de una piscina) y la respuesta quedó sin ese dato.

De los 86 puntos citados que se mostraron, 77 traen la frase exacta, 5 se ubicaron en el texto aunque el modelo la copió con diferencias (se muestra la del texto) y 4 son datos de tabla. En el camino no se mostraron 19 puntos: 3 porque su cita no se encontró en ningún fragmento y 16 porque los rechazó la revisión.

## El revisor

El revisor decide qué llega a la persona, así que se mide aparte. `eval/revisor.mjs` le entrega un punto de respuesta con el fragmento que cita. Unos puntos son correctos; otros llevan un error plantado. La regla es la del motor: un punto se muestra solo si el extracto lo respalda sin cambios y no es de otra situación.

| Clase de error plantado | Calibración | Reservado (2 corridas) |
|---|---|---|
| Valor cambiado (2,0 m → 1,8 m) | 4 de 4 | 6 de 6 |
| Sentido invertido (prohíbe → permite) | 2 de 2 | 2 de 2 |
| Condición de una excepción presentada como regla | 2 de 2 | 2 de 2 |
| Regla de otra situación (cercos eléctricos para una línea de media tensión) | 3 de 3 | 2 de 2 |
| Otro equipo que el preguntado | 1 de 1 | 1 de 2 |
| Dato agregado que el extracto no trae | 2 de 2 | 2 de 2 |
| Sujeto cambiado (circuitos → alimentador) | 1 de 1 | 2 de 2 |
| **Errores bloqueados** | **15 de 15** | **17 de 18** |
| **Respuestas correctas botadas** | **2 de 14** | **0 de 14** |

Calibración: 29 casos con los que se ajustó el revisor (`eval/revisor.json`). Reservado: 16 casos escritos sobre otros fragmentos, sin ajustar nada con ellos (`eval/revisor_reservado.json`). Entre la primera y la segunda corrida del reservado hubo dos arreglos mecánicos, sin tocar instrucciones: un veredicto por punto fijado en el esquema y los dos revisores en serie. Las corridas de conversaciones son anteriores a esos dos arreglos.

Tres hallazgos que cambiaron el diseño:

1. **El revisor no es estable.** Con temperatura 0, la misma consulta da veredictos distintos entre corridas, y cambiar una frase de la instrucción movía veredictos en casos sin relación. Durante el ajuste, en cuatro corridas seguidas bloqueó 53 de 56 errores y botó 3 de 56 respuestas correctas. Por eso cualquier cambio a las instrucciones se valida con este set antes de publicarse.
2. **Un solo revisor dejaba pasar la condición sacada de contexto**: "la potencia no puede superar el 30 % del empalme", tomado de un requisito para eximirse de una protección. Se agregó un segundo revisor que no ve la pregunta y solo dice si el extracto da el dato como regla o como condición de una excepción.
3. **Fallas silenciosas.** Un punto sin veredicto se daba por aprobado; ahora no se muestra. Y el segundo revisor desaparecía sin aviso cuando la API rechazaba llamadas simultáneas; ahora corre después del primero y la página avisa si no respondió.

## Qué encontró la validación en el motor

| Falla observada | Cambio |
|---|---|
| Las búsquedas secundarias sacaban de la lista el fragmento que respondía la principal | Cada búsqueda tiene cupos asegurados |
| El modelo copiaba bien la frase y se equivocaba en el número del fragmento | La frase decide la fuente: se busca en todos los fragmentos del turno |
| "Empalme" se buscaba como unión de cables; "cuántos enchufes" no encontraba "cantidad de centros" | Glosario de terreno a norma, y las palabras de la persona también buscan |
| El límite de 300 kW está en el artículo de alcance, que no se parece a ninguna pregunta | Se agrega el artículo de alcance de la norma dominante |
| El planificador inventaba el factor de potencia | Los números del cálculo salen de la conversación; lo supuesto se declara |
| Una respuesta a "¿de qué recinto?" se tomaba como un dato suelto | La pregunta pendiente se guarda y se responde con el dato |
| Si la revisión botaba todo, se respondía "no encontré" teniendo el fragmento | Una segunda redacción con el motivo del rechazo |

## El chat anterior

Antes de reescribirlo se revisaron 9 conversaciones (26 turnos) del chat anterior: 11 bien, 7 a medias, 8 mal. Las causas: sin memoria del caso, todo mensaje se trataba como búsqueda, una sola búsqueda sin seguir remisiones, y respuestas armadas con fragmentos de otro tema (una distancia a líneas de media tensión contestada con la tabla de cercos eléctricos).

Dos diagnósticos de esa revisión estaban equivocados y se corrigieron al armar las pruebas:

- "Falta la sección 6 del RIC N°10 (baños)". No falta: el RIC N°10 remite a la sección 6 del RIC N°11, que sí está. Lo que fallaba era seguir la remisión.
- "El modelo inventó el punto 6.1.22 del RIC N°2". No lo inventó: 6.1.22 es el numeral correcto de la altura de tableros. La etiqueta del fragmento era gruesa. Ahora cada fragmento lleva el rango de numerales que contiene.

## Cobertura del corpus

Parte del texto de cada documento oficial que quedó dentro de algún fragmento (`tools/cobertura_ric.py`, `tools/build_corpus.py`). Lo que falta son portadas, índices, encabezados y pies de página.

| Norma | Fragmentos | Cobertura |
|---|---|---|
| Pliegos RIC N°1 a 19 | 1.095 | 93,8 % en promedio (mínimo 88,6 %, RIC N°16) |
| DS 8/2019 | 26 | por artículo |
| Pliegos RPTD N°1 a 16 | 417 | 81 % a 99 % (los más cortos son casi solo portada e índice) |
| DS 109/2017 | 22 | 100 % del articulado |
| DS 92/1983 | 26 | 100 % |
| DS 57/2019 | 108 | 100 % |
| DS 327/1997 | 370 | 100 % (versión de abril de 2025) |

## Límites

- Las pruebas comprueban tipo de respuesta, norma citada y datos clave. No comprueban que la respuesta sea suficiente para ejecutar. Esa lectura la tiene que hacer un instalador autorizado, pregunta por pregunta.
- Los sets son chicos (62 turnos, 45 casos del revisor) y los escribió quien construyó el sistema. Faltan preguntas de instaladores reales.
- El error de la clase D sigue ahí: hay que volver a fragmentar los artículos largos repitiendo su encabezado en cada parte.
- El revisor es más débil cuando el punto habla de otro equipo que el preguntado, y bota entre 0 y 2 de cada 14 respuestas correctas.
- No están el RPTD N°17 (el PDF es una imagen), las instrucciones técnicas RGR, los oficios de la SEC ni las normas NCh.
- Los tiempos se midieron en local contra la API, sin el intermediario de Cloudflare. La clave de prueba admite pocas consultas por minuto y la comparten todas las demos: una evaluación completa la agota.

## Repetir

```bash
# el intermediario local (nv-gateway) en :8787 y esta carpeta servida en :8770
node eval/evaluar.mjs eval/desarrollo.json            # conversaciones; SOLO=id1,id2 para correr algunas
node eval/evaluar.mjs eval/reservado.json
node eval/revisor.mjs eval/revisor.json               # el revisor contra errores plantados
node eval/revisor.mjs eval/revisor_reservado.json
node eval/busca.mjs "caída de tensión máxima"         # qué fragmentos llegan al redactor
```

Los resultados de estas corridas están en `eval/*.res.json`.

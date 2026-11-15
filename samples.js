// Ejemplos de demostración: imagen, crédito y licencia de cada caso.
const SAMPLES = [
  {
    "q": "¿Cuántos circuitos necesito como mínimo?",
    "r": {
      "tipo": "pide",
      "puntos": [],
      "texto": "¿De qué recinto se trata (casa, local comercial, industria, baño, piscina)?",
      "aviso": "",
      "sugerencias": [],
      "ficha": {
        "recinto": "",
        "sistema": "",
        "tension": "",
        "potencia": "",
        "otros": ""
      },
      "traza": {
        "llamadas": 1,
        "ms": 2331
      },
      "calc": null
    }
  },
  {
    "q": "Es una casa de 80 m².",
    "r": {
      "tipo": "respuesta",
      "puntos": [
        {
          "texto": "Para una casa de 80 m² se necesitan como mínimo 3 circuitos, porque la superficie es igual o superior a 30 m².",
          "frase": "Se deberá proyectar como mínimo 2 circuitos para la vivienda de superficie menor a 30 m2 y 3 circuitos para la vivienda de superficie iguales o superior a 30 m2.",
          "cita": "ok",
          "numeral": "5.2",
          "numerosFuera": [],
          "veredicto": {
            "aplica": "si",
            "motivo": ""
          },
          "doc": {
            "n": "RIC N°10",
            "r": "5.2",
            "h": "INSTALACIONES DE USO GENERAL › Alumbrado de viviendas",
            "u": "https://www.sec.cl/sitio-web/wp-content/uploads/2021/01/RIC-N10-Instalaciones-de-uso-general.pdf#page=6",
            "t": "5.2  Alumbrado de viviendas\nLas instalaciones de consumo de viviendas deberán disponer de un empalme eléctrico\ncuya capacidad mínima de la protección será de 25 A y la sección de los conductores de\nsu alimentador no podrá ser inferior a 4 mm2. Además, estas instalaciones deberán\ncumplir con las siguientes condiciones:\na)  Una protección general de corte omnipolar en conformidad con el punto 5.1.3.3 de\neste pliego.\nb)  Se deberá proyectar como mínimo 2 circuitos para la vivienda de superficie menor a\n30 m2 y 3 circuitos para la vivienda de superficie iguales o superior a 30 m2.\nc)  Todos los circuitos deberán estar protegidos mediante un protector diferencial y una\nprotección de sobrecarga y cortocircuito.\nd)  Se deberá proyectar como mínimo un circuito exclusivo para enchufes de cocina y/o\nlavadero con una capacidad mínima de 16 A.\ne)  En el caso de existir un horno eléctrico y/o cocina eléctrica deberá proyectarse un\ncircuito adicional independiente de los circuitos señalados en la letra d) anterior, La\ncapacidad del circuito dependerá de la potencia del equipo y su capacidad mínima\nserá de 16 A\nf)  Él es quema de conexión de tierra utilizado deberá ser TN-S.\nPara determinar la cantidad de centros a instalar en una vivienda, se considerarán los\nsiguientes factores:\na)  En todos los recintos de una vivienda como dormitorios, cocina, baño, living,\ncomedor y sala de estar, de superficie no mayor de 10 m 2, se instalará, a lo menos,\nun centro de iluminación, el cual no podrá estar alimentado desde un enchufe. Si la"
          }
        },
        {
          "texto": "Además, se debe incluir un circuito exclusivo para enchufes de cocina y/o lavadero, con capacidad mínima de 16 A.",
          "frase": "Se deberá proyectar como mínimo un circuito exclusivo para enchufes de cocina y/o lavadero con una capacidad mínima de 16 A.",
          "cita": "ok",
          "numeral": "5.2",
          "numerosFuera": [],
          "veredicto": {
            "aplica": "si",
            "motivo": ""
          },
          "doc": {
            "n": "RIC N°10",
            "r": "5.2",
            "h": "INSTALACIONES DE USO GENERAL › Alumbrado de viviendas",
            "u": "https://www.sec.cl/sitio-web/wp-content/uploads/2021/01/RIC-N10-Instalaciones-de-uso-general.pdf#page=6",
            "t": "5.2  Alumbrado de viviendas\nLas instalaciones de consumo de viviendas deberán disponer de un empalme eléctrico\ncuya capacidad mínima de la protección será de 25 A y la sección de los conductores de\nsu alimentador no podrá ser inferior a 4 mm2. Además, estas instalaciones deberán\ncumplir con las siguientes condiciones:\na)  Una protección general de corte omnipolar en conformidad con el punto 5.1.3.3 de\neste pliego.\nb)  Se deberá proyectar como mínimo 2 circuitos para la vivienda de superficie menor a\n30 m2 y 3 circuitos para la vivienda de superficie iguales o superior a 30 m2.\nc)  Todos los circuitos deberán estar protegidos mediante un protector diferencial y una\nprotección de sobrecarga y cortocircuito.\nd)  Se deberá proyectar como mínimo un circuito exclusivo para enchufes de cocina y/o\nlavadero con una capacidad mínima de 16 A.\ne)  En el caso de existir un horno eléctrico y/o cocina eléctrica deberá proyectarse un\ncircuito adicional independiente de los circuitos señalados en la letra d) anterior, La\ncapacidad del circuito dependerá de la potencia del equipo y su capacidad mínima\nserá de 16 A\nf)  Él es quema de conexión de tierra utilizado deberá ser TN-S.\nPara determinar la cantidad de centros a instalar en una vivienda, se considerarán los\nsiguientes factores:\na)  En todos los recintos de una vivienda como dormitorios, cocina, baño, living,\ncomedor y sala de estar, de superficie no mayor de 10 m 2, se instalará, a lo menos,\nun centro de iluminación, el cual no podrá estar alimentado desde un enchufe. Si la"
          }
        }
      ],
      "texto": "Para una casa de 80 m² se necesitan como mínimo 3 circuitos, porque la superficie es igual o superior a 30 m². Además, se debe incluir un circuito exclusivo para enchufes de cocina y/o lavadero, con capacidad mínima de 16 A.",
      "aviso": "",
      "sugerencias": [
        "¿Qué protección diferencial se requiere para esos circuitos?",
        "¿Qué sección mínima deben tener los conductores de los circuitos de enchufes?",
        "¿Cambia algo si la casa tiene baño o instalaciones al exterior?"
      ],
      "calc": null,
      "ficha": {
        "recinto": "casa",
        "sistema": "",
        "tension": "",
        "potencia": "",
        "otros": ""
      },
      "traza": {
        "consultas": [
          "cantidad mínima de circuitos en una instalación de casa",
          "circuitos obligatorios en una vivienda: cocina, lavadero, iluminación, enchufes"
        ],
        "ids": [
          551,
          550,
          423,
          683,
          121,
          552,
          542,
          622,
          329,
          179,
          537
        ],
        "descartados": [],
        "omitidos": [
          {
            "texto": "Si hay horno o cocina eléctrica, se requiere un circuito adicional independiente, con capacidad mínima de 16 A.",
            "motivo": "la ficha no indica si existe horno o cocina eléctrica"
          }
        ],
        "reintento": false,
        "segunda": false,
        "saltos": 0,
        "llamadas": 4,
        "ms": 10846
      }
    }
  },
  {
    "q": "Necesito alimentar un tablero a 60 metros con 40 A monofásico. ¿Qué sección me da por caída de tensión?",
    "r": {
      "tipo": "respuesta",
      "puntos": [
        {
          "texto": "Para 40 A a 60 metros en monofásico, la caída de tensión no debe exceder el 3% de la tensión nominal, por lo que el cálculo indica 16 mm² de cobre.",
          "frase": "La sección de los alimentadores, subalimentadores y conductores será tal que la caída de tensión provocada por la corriente máxima que circula por ellos determinada de acuerdo con el punto 6.1, no exceda del 3% de la tensión nominal de la alimentación y la caída de tensión total en el punto de la instalación más desfavorable no exceda del 5% de dicha tensión.",
          "cita": "ok",
          "numeral": "5.1.3",
          "numerosFuera": [],
          "veredicto": {
            "aplica": "si",
            "motivo": ""
          },
          "doc": {
            "n": "RIC N°3",
            "r": "5–5.1.3",
            "h": "Especificaciones",
            "u": "https://www.sec.cl/sitio-web/wp-content/uploads/2021/03/RIC-N03-Alimentadores-y-demanda-de-una-instalacion-V1.1-1.pdf#page=3",
            "t": "5.  Especificaciones\n5.1  Canalizaciones\n5.1.1  Los alimentadores se canalizarán, utilizando alguno de los sistemas de canalización\nindicados en el Pliego Técnico Normativo - RIC N°04.\n5.1.2  La sección de los conductores de los alimentadores y subalimentadores será, por lo\nmenos, la suficiente para servir las cargas determinadas de acuerdo con la sección 6 de\neste pliego. En todo caso la sección mínima permisible será de 4 mm² para\nalimentadores y de 2,5 mm² para subalimentadores.\n5.1.3  La sección de los alimentadores, subalimentadores y conductores será tal que la caída\nde tensión provocada por la corriente máxima que circula por ellos determinada de\nacuerdo con el punto 6.1, no exceda del 3% de la tensión nominal de la alimentación y la\ncaída de tensión total en el punto de la instalación más desfavorable no exceda del 5%\nde dicha tensión. 1"
          }
        },
        {
          "texto": "Además, la sección mínima permisible para un alimentador es de 4 mm², condición que cumple la sección requerida por caída de tensión.",
          "frase": "La sección de los conductores de los alimentadores y subalimentadores será, por lo menos, la suficiente para servir las cargas determinadas de acuerdo con la sección 6 de este pliego. En todo caso la sección mínima permisible será de 4 mm² para alimentadores y de 2,5 mm² para subalimentadores.",
          "cita": "ok",
          "numeral": "5.1.2",
          "numerosFuera": [],
          "veredicto": {
            "aplica": "si",
            "motivo": ""
          },
          "doc": {
            "n": "RIC N°3",
            "r": "5–5.1.3",
            "h": "Especificaciones",
            "u": "https://www.sec.cl/sitio-web/wp-content/uploads/2021/03/RIC-N03-Alimentadores-y-demanda-de-una-instalacion-V1.1-1.pdf#page=3",
            "t": "5.  Especificaciones\n5.1  Canalizaciones\n5.1.1  Los alimentadores se canalizarán, utilizando alguno de los sistemas de canalización\nindicados en el Pliego Técnico Normativo - RIC N°04.\n5.1.2  La sección de los conductores de los alimentadores y subalimentadores será, por lo\nmenos, la suficiente para servir las cargas determinadas de acuerdo con la sección 6 de\neste pliego. En todo caso la sección mínima permisible será de 4 mm² para\nalimentadores y de 2,5 mm² para subalimentadores.\n5.1.3  La sección de los alimentadores, subalimentadores y conductores será tal que la caída\nde tensión provocada por la corriente máxima que circula por ellos determinada de\nacuerdo con el punto 6.1, no exceda del 3% de la tensión nominal de la alimentación y la\ncaída de tensión total en el punto de la instalación más desfavorable no exceda del 5%\nde dicha tensión. 1"
          }
        }
      ],
      "texto": "Para 40 A a 60 metros en monofásico, la caída de tensión no debe exceder el 3% de la tensión nominal, por lo que el cálculo indica 16 mm² de cobre. Además, la sección mínima permisible para un alimentador es de 4 mm², condición que cumple la sección requerida por caída de tensión.",
      "aviso": "",
      "sugerencias": [
        "¿Qué protección diferencial y magnétotérmica debo instalar en el tablero destino?",
        "¿Qué tipo de canalización y método de instalación debo usar para esos 60 metros?",
        "¿Necesito conductor de protección y cuál es su sección mínima?"
      ],
      "calc": {
        "texto": "Supuestos: sistema monofásico de 220 V; conductor de cobre (0,018 Ω·mm²/m), tramo de 60 m, sin considerar reactancia.\nCorriente de la carga: 40 A (dato entregado).\nCaída de tensión: ΔV = 2 · ρ · L · I / S.\n  6 mm²: 14,4 V = 6,5 % de 220 V\n  10 mm²: 8,6 V = 3,9 % de 220 V\n  16 mm²: 5,4 V = 2,5 % de 220 V\n  25 mm²: 3,5 V = 1,6 % de 220 V\nPrimera sección con caída de 5 % o menos: 10 mm². Con 3 % o menos: 16 mm².\nLa sección final debe cumplir además la capacidad de transporte de corriente de la tabla de la norma para el método de instalación."
      },
      "ficha": {
        "recinto": "casa",
        "sistema": "monofásico",
        "tension": "",
        "potencia": "",
        "otros": "alimentación de tablero a 60 metros, 40 A"
      },
      "traza": {
        "consultas": [
          "caída de tensión máxima admisible en alimentadores",
          "caída de tensión máxima admisible en alimentadores y conductores",
          "sección de conductor por caída de tensión en alimentador monofásico"
        ],
        "ids": [
          85,
          883,
          1094,
          1070,
          685,
          694,
          88,
          93,
          83,
          65,
          78
        ],
        "descartados": [],
        "omitidos": [],
        "reintento": false,
        "segunda": false,
        "saltos": 0,
        "llamadas": 4,
        "ms": 10619
      }
    }
  }
];

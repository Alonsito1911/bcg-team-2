"""Reglas de detección sobre la telemetría de los sensores de bombas.

Las usan la Azure Function (azure/function_app) y el modo local del simulador,
para que ambos den exactamente el mismo resultado.

Cada evento es un dict con: pozo_id, codigo, ts (ISO, hora simulada),
bombeos, litros, bateria, turbidez_ntu.
"""

CAPACIDAD_PERSONAS = 300
LITROS_PERSONA_DIA = 20
CAPACIDAD_LITROS_DIA = CAPACIDAD_PERSONAS * LITROS_PERSONA_DIA
HORAS_SIN_USO_FALLA = 3       # horas diurnas seguidas sin bombeos -> posible falla
HORA_INICIO_DIA, HORA_FIN_DIA = 6, 19
TURBIDEZ_MAX_NTU = 5          # guía OMS para agua de consumo
MAX_ALERTAS = 200
SMS = {"posible_falla", "riesgo_contaminacion"}   # el sobreuso queda como estado, sin SMS

MENSAJES = {
    "posible_falla": "Posible falla: sin bombeos por {h} h en horario diurno. Avisar al mecánico.",
    "riesgo_contaminacion": "Riesgo de contaminación: turbidez {t:.1f} NTU. Avisar al promotor de salud y hacer test de E. coli.",
    "sobreuso": "Sobreuso: {l:,.0f} L hoy (capacidad {c:,} L). Priorizar refuerzo.",
    "normal": "Volvió a la normalidad.",
}


def nuevo_estado():
    return {"bombas": {}, "alertas": [], "actualizado": None, "eventos": 0}


def procesar(estado, ev):
    """Actualiza el estado con un evento y devuelve la alerta generada (o None)."""
    b = estado["bombas"].setdefault(ev["pozo_id"], {
        "codigo": ev.get("codigo", ev["pozo_id"]), "estado": "normal",
        "dia": None, "litros_dia": 0.0, "horas_sin_uso": 0,
    })
    dia, hora = ev["ts"][:10], int(ev["ts"][11:13])
    if b["dia"] != dia:
        b["dia"], b["litros_dia"] = dia, 0.0

    b["litros_dia"] += ev["litros"]
    diurno = HORA_INICIO_DIA <= hora < HORA_FIN_DIA
    if diurno:
        b["horas_sin_uso"] = b["horas_sin_uso"] + 1 if ev["bombeos"] == 0 else 0
    b.update(turbidez=ev["turbidez_ntu"], bateria=ev["bateria"], ultimo=ev["ts"])

    if b["horas_sin_uso"] >= HORAS_SIN_USO_FALLA:
        nuevo = "posible_falla"
    elif ev["turbidez_ntu"] > TURBIDEZ_MAX_NTU:
        nuevo = "riesgo_contaminacion"
    elif b["litros_dia"] > CAPACIDAD_LITROS_DIA:
        nuevo = "sobreuso"
    else:
        nuevo = "normal"

    estado["eventos"] += 1
    estado["actualizado"] = ev["ts"]
    if nuevo == b["estado"]:
        return None

    anterior, b["estado"] = b["estado"], nuevo
    alerta = {
        "ts": ev["ts"], "pozo_id": ev["pozo_id"], "codigo": b["codigo"],
        "tipo": nuevo, "anterior": anterior, "sms": nuevo in SMS,
        "mensaje": MENSAJES[nuevo].format(h=b["horas_sin_uso"], t=ev["turbidez_ntu"],
                                          l=b["litros_dia"], c=CAPACIDAD_LITROS_DIA),
    }
    estado["alertas"] = ([alerta] + estado["alertas"])[:MAX_ALERTAS]
    return alerta

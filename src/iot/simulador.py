"""Simula sensores en las 91 bombas críticas de Kiryandongo y envía la telemetría.

Escenario: las bombas críticas ya fueron reparadas y tienen sensor (escenario B).
Durante el día simulado ocurren tres cosas, para ver las alertas:
  - FALLA: una bomba deja de bombear a las 10:00.
  - LLUVIA: a las 13:00 una lluvia fuerte enturbia los pozos poco profundos de Bweyale.
  - SOBREUSO: las bombas con más usuarios que capacidad la superan durante el día.

Todo se envía por un solo dispositivo "gateway" (como un gateway LoRa real);
cada mensaje lleva el pozo_id de la bomba.

Uso:
  python src/iot/simulador.py --local              # sin Azure: aplica las reglas aquí
  python src/iot/simulador.py --azure              # envía a IoT Hub (necesita .env)
Opciones: --horas 24  --pausa 1.0 (segundos reales por hora simulada)
"""
import argparse
import csv
import json
import math
import os
import random
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from comun import OUT, PROC, RAW
from iot import reglas

INICIO = datetime(2026, 10, 17, 5, 0)   # hora local simulada de Kiryandongo
LITROS_POR_BOMBEO = 0.4                 # supuesto aproximado para una India Mark II
MAX_LITROS_HORA = 1000                  # una bomba manual da ~15-20 L/min
POZOS_SOMEROS = {"Protected Well", "Sand or Sub-surface Dam"}

# Perfil de uso por hora (picos en la mañana y la tarde), normalizado
PERFIL = {6: 6, 7: 10, 8: 10, 9: 8, 10: 6, 11: 5, 12: 5, 13: 5, 14: 5, 15: 6, 16: 9, 17: 10, 18: 8}
TOTAL_PERFIL = sum(PERFIL.values())

FALLA = {"ranking": 2, "hora": 10}
LLUVIA = {"subcondado": "Bweyale Town Council", "hora": 13, "duracion": 6, "pico_ntu": 18}


def cargar_bombas():
    tipo = {}
    with open(RAW / "wpdx_bunyoro_8.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            tipo[r["wpdx_id"]] = r["water_source_clean"]
    bombas = []
    with open(PROC / "prioridad_kiryandongo.csv", encoding="utf-8") as f:
        for p in csv.DictReader(f):
            if p["nivel"] != "Crítico":
                continue
            bombas.append({
                "pozo_id": p["wpdx_id"], "codigo": f"KIR-{int(p['ranking']):04d}",
                "ranking": int(p["ranking"]), "lat": float(p["lat"]), "lon": float(p["lon"]),
                "subcondado": p["subcondado"], "usuarios": int(p["personas_servidas"] or reglas.CAPACIDAD_PERSONAS),
                "somero": tipo.get(p["wpdx_id"]) in POZOS_SOMEROS, "motivo": p["motivo"],
            })
    return bombas


def lectura(b, h, rng):
    """Telemetría de una bomba en la hora simulada h (0 = INICIO)."""
    t = INICIO + timedelta(hours=h)
    hora = t.hour
    falla = b["ranking"] == FALLA["ranking"] and h >= FALLA["hora"] - INICIO.hour
    if falla or hora not in PERFIL:
        litros = 0.0
    else:
        demanda = b["usuarios"] * reglas.LITROS_PERSONA_DIA * PERFIL[hora] / TOTAL_PERFIL
        litros = min(demanda * rng.uniform(0.85, 1.15), MAX_LITROS_HORA)

    turbidez = rng.uniform(0.3, 1.5)
    desde_lluvia = h - (LLUVIA["hora"] - INICIO.hour)
    if b["somero"] and b["subcondado"] == LLUVIA["subcondado"] and 0 <= desde_lluvia < LLUVIA["duracion"]:
        turbidez += LLUVIA["pico_ntu"] * math.exp(-desde_lluvia / 2) * rng.uniform(0.7, 1.3)

    return {
        "pozo_id": b["pozo_id"], "codigo": b["codigo"],
        "ts": t.strftime("%Y-%m-%dT%H:00:00"),
        "bombeos": round(litros / LITROS_POR_BOMBEO), "litros": round(litros, 1),
        "bateria": round(0.95 - 0.001 * h - rng.uniform(0, 0.01), 3),
        "turbidez_ntu": round(turbidez, 2),
    }


def leer_env():
    env = Path(__file__).resolve().parents[2] / ".env"
    if env.exists():
        for linea in env.read_text(encoding="utf-8").splitlines():
            if "=" in linea and not linea.startswith("#"):
                k, v = linea.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"'))


def main():
    ap = argparse.ArgumentParser()
    modo = ap.add_mutually_exclusive_group(required=True)
    modo.add_argument("--local", action="store_true")
    modo.add_argument("--azure", action="store_true")
    ap.add_argument("--horas", type=int, default=16)
    ap.add_argument("--pausa", type=float, default=1.0)
    ap.add_argument("--semilla", type=int, default=7)
    a = ap.parse_args()

    rng = random.Random(a.semilla)
    bombas = cargar_bombas()
    print(f"{len(bombas)} bombas críticas · {a.horas} h simuladas · modo {'local' if a.local else 'Azure'}")

    if a.azure:
        leer_env()
        from azure.iot.device import IoTHubDeviceClient, Message
        conn = os.environ.get("IOTHUB_DEVICE_CONNECTION_STRING")
        if not conn:
            sys.exit("Falta IOTHUB_DEVICE_CONNECTION_STRING en .env (lo crea azure/desplegar.sh)")
        cliente = IoTHubDeviceClient.create_from_connection_string(conn)
        cliente.connect()
    else:
        estado = reglas.nuevo_estado()
        web = OUT / "iot_web"
        web.mkdir(parents=True, exist_ok=True)

    try:
        for h in range(a.horas):
            for b in bombas:
                ev = lectura(b, h, rng)
                if a.azure:
                    msg = Message(json.dumps(ev), content_encoding="utf-8", content_type="application/json")
                    cliente.send_message(msg)
                else:
                    alerta = reglas.procesar(estado, ev)
                    if alerta and alerta["sms"]:
                        print(f"  ALERTA {alerta['ts'][11:16]} {alerta['codigo']}: {alerta['mensaje']}")
            if a.local:
                (web / "estado.json").write_text(json.dumps(estado), encoding="utf-8")
            hora = (INICIO + timedelta(hours=h)).strftime("%H:%M")
            print(f"{hora} · {len(bombas)} lecturas enviadas")
            time.sleep(a.pausa)
    finally:
        if a.azure:
            cliente.shutdown()


if __name__ == "__main__":
    main()

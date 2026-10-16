"""Lluvia histórica por celda (~11 km) para un área, desde Open-Meteo (reanálisis ERA5).

Descarga lluvia diaria 2015-2024 en una grilla de 0,1° y guarda, por celda,
el promedio mensual y el total por año. Uso: python src/lluvia.py
Genera data/raw/lluvia_kiryandongo.json.
"""
import json
import urllib.parse
import urllib.request
from collections import defaultdict

from comun import RAW

# Caja del distrito de Kiryandongo (de limites_bunyoro.json)
LAT_MIN, LAT_MAX = 1.6, 2.4
LON_MIN, LON_MAX = 31.75, 32.4
PASO = 0.1
INICIO, FIN = "2015-01-01", "2024-12-31"


def grilla():
    lats = [round(LAT_MIN + PASO / 2 + i * PASO, 2) for i in range(round((LAT_MAX - LAT_MIN) / PASO))]
    lons = [round(LON_MIN + PASO / 2 + j * PASO, 2) for j in range(round((LON_MAX - LON_MIN) / PASO))]
    return [(la, lo) for la in lats for lo in lons]


def descargar(celdas):
    params = urllib.parse.urlencode({
        "latitude": ",".join(str(la) for la, _ in celdas),
        "longitude": ",".join(str(lo) for _, lo in celdas),
        "start_date": INICIO, "end_date": FIN,
        "daily": "precipitation_sum", "timezone": "Africa/Kampala",
    })
    with urllib.request.urlopen(f"https://archive-api.open-meteo.com/v1/archive?{params}", timeout=300) as r:
        datos = json.load(r)
    return datos if isinstance(datos, list) else [datos]


def main():
    celdas = grilla()
    resultado = []
    for (la, lo), loc in zip(celdas, descargar(celdas)):
        mensual, anual = defaultdict(float), defaultdict(float)
        for t, p in zip(loc["daily"]["time"], loc["daily"]["precipitation_sum"]):
            if p is not None:
                mensual[int(t[5:7])] += p
                anual[t[:4]] += p
        n_anios = len(anual)
        resultado.append({
            "lat": la, "lon": lo,
            "mensual": [round(mensual[m] / n_anios, 1) for m in range(1, 13)],
            "anual": {a: round(v) for a, v in sorted(anual.items())},
        })
    (RAW / "lluvia_kiryandongo.json").write_text(json.dumps(resultado), encoding="utf-8")
    print(f"{len(resultado)} celdas -> {RAW / 'lluvia_kiryandongo.json'}")


if __name__ == "__main__":
    main()

"""Exporta los resultados del repo bcg-team-2 a un JSON compacto para el dashboard de la ONG.

NO reimplementa la lógica: importa los módulos del equipo (prioridad, lora, comun) y lee
su resultado ya procesado (data/processed/prioridad_kiryandongo.csv).

Uso (desde demo/):
  python3 scripts/export_bcg_team2.py [ruta_al_repo]
  (por defecto, la raíz del repo: la carpeta que contiene demo/)
Genera demo/src/data/kiryandongo.json
"""
import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

DEMO = Path(__file__).resolve().parents[1]
REPO = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEMO.parent.resolve()
sys.path.insert(0, str(REPO / "src"))

import lora  # noqa: E402  (módulos del equipo bcg-team-2)
import prioridad  # noqa: E402
from comun import PROC, RAW, anillos, categoria  # noqa: E402


def simplificar(anillo, max_puntos=220):
    paso = max(1, len(anillo) // max_puntos)
    return [[round(x, 4), round(y, 4)] for x, y in anillo[::paso]]


def main():
    with open(PROC / "prioridad_kiryandongo.csv", encoding="utf-8") as f:
        puntos = list(csv.DictReader(f))

    # Escenario LoRaWAN del equipo (mismas antenas OSM que usa mapa_prioridad.py).
    antenas = []
    for e in json.loads((RAW / "antenas_osm_kiryandongo.json").read_text(encoding="utf-8"))["elements"]:
        c = e.get("center", e)
        antenas.append({"lat": c["lat"], "lon": c["lon"], "tipo": e.get("tags", {}).get("man_made", "")})
    torres, nuevos, resumen = lora.escenario(puntos, antenas)

    # Lluvia por celda con el factor de estación seca del modelo del equipo.
    celdas = prioridad.lluvia_por_celda()

    limite = next(d["geojson"] for d in json.loads((RAW / "limites_bunyoro.json").read_text(encoding="utf-8")) if d["name"] == "Kiryandongo")
    asent = json.loads((RAW / "settlement_Kiryandongo.json").read_text(encoding="utf-8"))[0]["geojson"]

    # E. coli (WPDx Uganda, nacional): % de muestras con coliformes fecales por mes del reporte.
    por_mes = defaultdict(lambda: [0, 0])
    estado_ecoli = defaultdict(lambda: [0, 0])
    with open(RAW / "wpdx_uganda_ecoli.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            pres = (r.get("fecal_coliform_presence") or "").strip().lower()
            if pres not in ("present", "absent") or not r.get("report_date"):
                continue
            mes = int(r["report_date"][5:7])
            por_mes[mes][1] += 1
            por_mes[mes][0] += pres == "present"
            cat = categoria(r) if r.get("status_clean") else "desconocido"
            estado_ecoli[cat][1] += 1
            estado_ecoli[cat][0] += pres == "present"

    niveles = {}
    for nivel in prioridad.ORDEN_NIVEL:
        g = [p for p in puntos if p["nivel"] == nivel]
        niveles[nivel] = {"bombas": len(g), "personas": sum(int(p["personas_afectadas"]) for p in g)}

    salida = {
        "fuente": "bcg-team-2 · WPDx+ (CC BY 4.0), OpenStreetMap (ODbL), Open-Meteo ERA5 (CC BY 4.0)",
        "umbrales": {
            "capacidad_bomba": prioridad.CAPACIDAD_BOMBA,
            "rota_critica_personas": prioridad.ROTA_CRITICA_PERSONAS,
            "presion_critica": prioridad.PRESION_CRITICA,
            "peso_seco": prioridad.PESO_SECO,
            "meses_secos": list(prioridad.MESES_SECOS),
            "radio_lora_km": lora.RADIO_LORA_KM,
        },
        "niveles": niveles,
        # columnas compactas: ranking, lat, lon, nivel, motivo, afectadas, servidas, presion, subcondado, puntaje, factor_seco, fecha
        "bombas": [
            [int(p["ranking"]), round(float(p["lat"]), 5), round(float(p["lon"]), 5), p["nivel"], p["motivo"],
             int(p["personas_afectadas"]), int(p["personas_servidas"] or 0), float(p["presion"] or 0),
             p["subcondado"], float(p["puntaje"]), float(p["factor_seco"]), p["fecha_reporte"]]
            for p in puntos
        ],
        "lluvia": [{"lat": c["lat"], "lon": c["lon"], "mensual": c["mensual"], "anual": c["anual"],
                    "seca": round(c["seca"]), "factor": round(c["factor"], 3)} for c in celdas],
        "lora": {"torres": torres, "nuevos": nuevos, "resumen": resumen},
        "limite": [simplificar(a) for a in anillos(limite)],
        "asentamiento": [simplificar(a, 120) for a in anillos(asent)],
        "ecoli_mes": [{"mes": m, "positivas": por_mes[m][0], "muestras": por_mes[m][1]} for m in range(1, 13)],
        "ecoli_estado": {k: {"positivas": v[0], "muestras": v[1]} for k, v in estado_ecoli.items()},
    }
    destino = DEMO / "src" / "data" / "kiryandongo.json"
    destino.write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(puntos)} bombas · LoRa {resumen} -> {destino} ({destino.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()

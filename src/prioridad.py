"""Modelo de prioridad v1 para bombas de Kiryandongo (reglas transparentes, sin ML).

Para cada punto de agua con dato 2016+:
  - nivel del semáforo: Crítico / Alto / Revisar / Bien
  - personas afectadas:
      rota       -> personas que usaban la bomba (served_population de WPDx)
      sobreusada -> personas por sobre la capacidad (served - usage_cap)
  - factor de estación seca: las zonas con menos lluvia en dic-feb pesan más,
    porque ahí las fuentes superficiales se secan y la gente depende más de las bombas.
  - puntaje = personas afectadas x factor seco; se ordena por nivel y luego puntaje.

WPDx reparte la población entre puntos sin contarla dos veces, así que
served_population sí se puede sumar entre bombas.
Genera data/processed/prioridad_kiryandongo.csv.
"""
import csv
import json

from comun import PROC, RAW, categoria

# Umbrales (configurables)
ANIO_RECIENTE = 2016
CAPACIDAD_BOMBA = 300           # personas por bomba manual (WPDx; Sphere usa 500)
ROTA_CRITICA_PERSONAS = 300     # rota que deja sin agua a >= una bomba completa de gente
PRESION_CRITICA = 2.0           # funciona pero al doble de su capacidad
PESO_SECO = 0.2                 # la zona más seca pesa hasta 20% más
MESES_SECOS = (12, 1, 2)

ORDEN_NIVEL = {"Crítico": 0, "Alto": 1, "Revisar": 2, "Bien": 3}


def num(x):
    return float(x) if x else None


def lluvia_por_celda():
    celdas = json.loads((RAW / "lluvia_kiryandongo.json").read_text(encoding="utf-8"))
    for c in celdas:
        c["seca"] = sum(c["mensual"][m - 1] for m in MESES_SECOS)
        c["total"] = sum(c["mensual"])
    secas = [c["seca"] for c in celdas]
    lo, hi = min(secas), max(secas)
    for c in celdas:
        c["factor"] = 1 + PESO_SECO * (hi - c["seca"]) / (hi - lo)
    return celdas


def celda_mas_cercana(celdas, lat, lon):
    return min(celdas, key=lambda c: (c["lat"] - lat) ** 2 + (c["lon"] - lon) ** 2)


def clasificar(cat, servida, presion, cap):
    """Devuelve (nivel, motivo, personas_afectadas)."""
    if cat in ("abandonada", "contradictorio"):
        return "Revisar", "abandonada: ¿reemplazar?" if cat == "abandonada" else "estado contradictorio", 0
    if servida is None:
        return "Revisar", "sin dato de población", 0
    if cap != CAPACIDAD_BOMBA:
        return "Revisar", f"capacidad registrada atípica ({cap:.0f})", 0
    if cat == "rota":
        if servida >= ROTA_CRITICA_PERSONAS:
            return "Crítico", "rota, deja sin agua a muchas personas", servida
        return "Alto", "rota", servida
    exceso = max(servida - cap, 0)
    if presion is not None and presion >= PRESION_CRITICA:
        return "Crítico", f"sobreusada al {presion:.0%}", exceso
    if presion is not None and presion > 1:
        return "Alto", f"sobreusada al {presion:.0%}", exceso
    return "Bien", "funciona dentro de capacidad", 0


def main():
    celdas = lluvia_por_celda()
    filas = []
    with open(RAW / "wpdx_bunyoro_8.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["clean_adm2"] != "Kiryandongo" or int(r["report_date"][:4]) < ANIO_RECIENTE:
                continue
            lat, lon = float(r["lat_deg"]), float(r["lon_deg"])
            cat = categoria(r)
            servida, presion = num(r["served_population"]), num(r["pressure"])
            cap = num(r["usage_cap"]) or CAPACIDAD_BOMBA
            nivel, motivo, personas = clasificar(cat, servida, presion, cap)
            celda = celda_mas_cercana(celdas, lat, lon)
            filas.append({
                "wpdx_id": r["wpdx_id"], "lat": lat, "lon": lon,
                "subcondado": r["clean_adm4"], "estado": cat, "status_clean": r["status_clean"],
                "nivel": nivel, "motivo": motivo,
                "personas_afectadas": round(personas),
                "personas_servidas": round(servida) if servida is not None else "",
                "presion": round(presion, 2) if presion is not None else "",
                "anio_instalacion": r["install_year"], "fecha_reporte": r["report_date"][:10],
                "lluvia_anual_mm": round(celda["total"]), "lluvia_dic_feb_mm": round(celda["seca"]),
                "factor_seco": round(celda["factor"], 3),
                "puntaje": round(personas * celda["factor"], 1),
            })

    filas.sort(key=lambda x: (ORDEN_NIVEL[x["nivel"]], -x["puntaje"]))
    for i, x in enumerate(filas, 1):
        x["ranking"] = i

    PROC.mkdir(parents=True, exist_ok=True)
    salida = PROC / "prioridad_kiryandongo.csv"
    with open(salida, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["ranking"] + [k for k in filas[0] if k != "ranking"])
        w.writeheader()
        w.writerows(filas)

    for nivel in ORDEN_NIVEL:
        g = [x for x in filas if x["nivel"] == nivel]
        print(f"{nivel}: {len(g)} puntos, {sum(x['personas_afectadas'] for x in g):,} personas afectadas")
    print(f"-> {salida}")
    return filas


if __name__ == "__main__":
    main()

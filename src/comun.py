"""Rutas y funciones compartidas por el pipeline y los scripts de exploración."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
PROC = ROOT / "data" / "processed"
OUT = ROOT / "output"


def categoria(r):
    """Estado limpio de un punto WPDx.

    status_clean es más detallado que status_id; si se contradicen, "contradictorio".
    """
    estado = r["status_clean"]
    if estado.startswith("Abandoned"):
        return "abandonada"
    if estado == "Non-Functional":
        return "rota" if r["status_id"] == "No" else "contradictorio"
    if r["status_id"] == "No":
        return "contradictorio"
    if estado == "Functional, needs repair":
        return "necesita_rep"
    return "funciona"


def punto_en_poligono(lon, lat, anillo):
    dentro = False
    j = len(anillo) - 1
    for i in range(len(anillo)):
        xi, yi = anillo[i]
        xj, yj = anillo[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            dentro = not dentro
        j = i
    return dentro


def anillos(geojson):
    """Anillos exteriores de un Polygon o MultiPolygon GeoJSON."""
    if geojson["type"] == "Polygon":
        return [geojson["coordinates"][0]]
    return [p[0] for p in geojson["coordinates"]]

"""Descarga desde cero todos los datos de data/raw/.

Uso:
  python src/descargar_datos.py            # solo lo que necesita el pipeline principal
  python src/descargar_datos.py --todo     # también los datos de los mapas de exploración
  python src/descargar_datos.py --forzar   # vuelve a bajar aunque el archivo ya exista

Fuentes (todas públicas):
  - WPDx+ (Water Point Data Exchange), API Socrata, dataset eqje-vguj. Licencia CC BY 4.0.
  - OpenStreetMap vía Nominatim (límites) y Overpass (antenas). Licencia ODbL.
  - Open-Meteo, archivo histórico ERA5 (lluvia). Licencia CC BY 4.0. Ver lluvia.py.

WPDx se actualiza con el tiempo: una descarga nueva puede traer registros distintos.
Los archivos usados en el análisis están versionados en el repo.
"""
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import lluvia
from comun import RAW

AGENTE = "bcg-team-2-hackathon (proyecto agua Uganda)"
WPDX = "https://data.waterpointdata.org/resource/eqje-vguj.csv"
NOMINATIM = "https://nominatim.openstreetmap.org"
OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]

BUNYORO = ["Masindi", "Kiryandongo", "Hoima", "Kikuube", "Kagadi", "Kibaale", "Buliisa", "Kakumiro"]
UGANDA = "clean_country_name='Uganda'"


def lista_sql(nombres):
    return ",".join(f"'{n}'" for n in nombres)


# archivo -> (nucleo, filtro); "nucleo" = lo necesita el pipeline principal
WPDX_CONSULTAS = {
    "wpdx_bunyoro_8.csv": (True, f"{UGANDA} AND clean_adm2 in({lista_sql(BUNYORO)})"),
    "wpdx_gulu.csv": (False, f"{UGANDA} AND clean_adm2='Gulu'"),
    "wpdx_mayuge.csv": (False, f"{UGANDA} AND clean_adm2='Mayuge'"),
    "wpdx_uganda_2024_2025.csv": (False, f"{UGANDA} AND report_date>='2024-01-01'"),
    "wpdx_uganda_ecoli.csv": (False, f"{UGANDA} AND fecal_coliform_presence IS NOT NULL"),
}
# Relaciones de OpenStreetMap (ids fijos, para que la descarga sea reproducible)
LIMITES = {
    "limites_bunyoro.json": (True, "R3497974,R3497965,R3501926,R14691286,R14688763,R3498022,R3501794,R14691649,R18488950"),
    "limite_gulu.json": (False, "R3497245,R18489006"),
    "limite_mayuge.json": (False, "R3501862"),
}
ASENTAMIENTOS = {
    "settlement_Kiryandongo.json": (True, "Kiryandongo refugee settlement"),
    "settlement_Kyangwali.json": (False, "Kyangwali refugee settlement"),
}
ANTENAS = "antenas_osm_kiryandongo.json"
CAJA_ANTENAS = "1.55,31.70,2.45,32.45"


def bajar(url, datos=None, intentos=4):
    cuerpo = urllib.parse.urlencode(datos).encode() if datos else None
    for i in range(intentos):
        try:
            req = urllib.request.Request(url, data=cuerpo, headers={"User-Agent": AGENTE})
            with urllib.request.urlopen(req, timeout=300) as r:
                return r.read()
        except (urllib.error.URLError, TimeoutError) as e:
            if i == intentos - 1:
                raise
            espera = 5 * 2 ** i
            print(f"    error ({e}); reintento en {espera}s")
            time.sleep(espera)


def guardar(nombre, contenido):
    (RAW / nombre).write_bytes(contenido)
    print(f"  ok  {nombre} ({len(contenido) / 1024:.0f} KB)")


def wpdx(nombre, where):
    url = WPDX + "?" + urllib.parse.urlencode({"$where": where, "$limit": 50000})
    guardar(nombre, bajar(url))


def limites(nombre, ids):
    url = f"{NOMINATIM}/lookup?" + urllib.parse.urlencode(
        {"osm_ids": ids, "format": "json", "polygon_geojson": 1, "polygon_threshold": 0.001})
    guardar(nombre, bajar(url))
    time.sleep(1)  # política de uso de Nominatim: máximo 1 consulta por segundo


def asentamiento(nombre, consulta):
    url = f"{NOMINATIM}/search?" + urllib.parse.urlencode(
        {"q": consulta, "format": "json", "limit": 1, "polygon_geojson": 1, "polygon_threshold": 0.001})
    guardar(nombre, bajar(url))
    time.sleep(1)


def antenas(nombre):
    c = CAJA_ANTENAS
    q = (f'[out:json][timeout:120];(node["man_made"~"mast|tower|antenna"]({c});'
         f'way["man_made"~"mast|tower"]({c});node["tower:type"="communication"]({c}););out center tags;')
    for servidor in OVERPASS:
        try:
            contenido = bajar(servidor, {"data": q}, intentos=3)
            json.loads(contenido)  # Overpass devuelve HTML cuando está saturado
            guardar(nombre, contenido)
            return
        except (ValueError, urllib.error.URLError) as e:
            print(f"    {servidor} falló ({e.__class__.__name__}); probando otro")
    raise RuntimeError("Overpass no respondió; intenta más tarde")


def main():
    todo, forzar = "--todo" in sys.argv, "--forzar" in sys.argv
    RAW.mkdir(parents=True, exist_ok=True)
    tareas = (
        [(n, nucleo, wpdx, (n, w)) for n, (nucleo, w) in WPDX_CONSULTAS.items()]
        + [(n, nucleo, limites, (n, ids)) for n, (nucleo, ids) in LIMITES.items()]
        + [(n, nucleo, asentamiento, (n, q)) for n, (nucleo, q) in ASENTAMIENTOS.items()]
        + [(ANTENAS, True, antenas, (ANTENAS,))]
        + [("lluvia_kiryandongo.json", True, lambda: lluvia.main(), ())]
    )
    for nombre, nucleo, funcion, args in tareas:
        if not (nucleo or todo):
            continue
        if (RAW / nombre).exists() and not forzar:
            print(f"  --  {nombre} ya existe (usa --forzar para volver a bajarlo)")
            continue
        print(f"  ..  {nombre}")
        funcion(*args)


if __name__ == "__main__":
    main()

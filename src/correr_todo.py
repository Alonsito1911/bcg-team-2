"""Corre el pipeline completo: datos -> modelo de prioridad -> mapa.

Uso:
  python src/correr_todo.py                # pipeline principal (Kiryandongo)
  python src/correr_todo.py --exploracion  # además regenera los mapas de exploración

Resultado principal: output/prioridad_kiryandongo.html y
data/processed/prioridad_kiryandongo.csv.
"""
import runpy
import sys

import descargar_datos
import mapa_prioridad
import prioridad
from comun import ROOT

EXPLORACION = [
    ("mapa_exploratorio.py", []),
    ("mapa_distritos_bunyoro.py", []),
    ("mapa_distrito.py", ["kiryandongo"]),
    ("mapa_distrito.py", ["gulu"]),
    ("mapa_mayuge.py", []),
    ("mapa_2025.py", []),
]


def main():
    exploracion = "--exploracion" in sys.argv
    print("1/3 Datos")
    if exploracion:
        sys.argv.append("--todo")
    descargar_datos.main()
    print("2/3 Modelo de prioridad")
    prioridad.main()
    print("3/3 Mapa")
    mapa_prioridad.main()

    if exploracion:
        print("Mapas de exploración")
        for script, args in EXPLORACION:
            sys.argv = [script] + args
            runpy.run_path(str(ROOT / "src" / "exploracion" / script), run_name="__main__")


if __name__ == "__main__":
    main()

"""Prepara la página de monitoreo en vivo: index.html + bombas.json.

Uso: python src/iot/preparar_web.py [carpeta_destino]   (por defecto output/iot_web)
"""
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from comun import OUT, ROOT
from iot.simulador import cargar_bombas


def main(destino=None):
    destino = Path(destino) if destino else OUT / "iot_web"
    destino.mkdir(parents=True, exist_ok=True)
    shutil.copy(ROOT / "azure" / "web" / "index.html", destino / "index.html")
    bombas = [{k: b[k] for k in ("pozo_id", "codigo", "lat", "lon", "subcondado", "usuarios", "motivo")}
              for b in cargar_bombas()]
    (destino / "bombas.json").write_text(json.dumps(bombas), encoding="utf-8")
    print(f"{len(bombas)} bombas -> {destino}")
    return destino


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)

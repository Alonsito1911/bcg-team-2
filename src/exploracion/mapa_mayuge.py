"""Mapa de puntos de agua WPDx en el distrito de Mayuge (todas las fuentes y años).

Muestra solo Mayuge: el resto del mapa queda tapado y no se puede salir del distrito.
Genera output/mapa_mayuge.html.
"""
import csv
import json
from collections import Counter
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from comun import OUT, RAW, categoria


def main():
    limite = json.loads((RAW / "limite_mayuge.json").read_text(encoding="utf-8"))[0]["geojson"]
    with open(RAW / "wpdx_mayuge.csv", encoding="utf-8") as f:
        puntos = [{
            "lat": float(r["lat_deg"]), "lon": float(r["lon_deg"]),
            "cat": categoria(r),
            "sc": r["clean_adm3"], "sub": r["clean_adm4"],
            "t": r["_water_tech_category"] or r["water_tech_clean"] or "s/i",
            "sid": r["status_id"], "est": r["status_clean"] or "s/i",
            "f": r["report_date"][:10], "a": r["install_year"], "p": r["local_population"],
            "c": r["crucialness"], "src": r["source"],
        } for r in csv.DictReader(f) if r["lat_deg"] and r["lon_deg"]]

    conteo = Counter(p["cat"] for p in puntos)
    print(dict(conteo))
    OUT.mkdir(exist_ok=True)
    html = (PLANTILLA.replace("__PUNTOS__", json.dumps(puntos))
            .replace("__LIMITE__", json.dumps(limite))
            .replace("__CONTEO__", json.dumps(conteo)))
    (OUT / "mapa_mayuge.html").write_text(html, encoding="utf-8")
    print(f"{len(puntos)} puntos -> {OUT / 'mapa_mayuge.html'}")


PLANTILLA = """<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Puntos de agua Mayuge</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
 html,body,#map{height:100%;margin:0;font-family:system-ui,sans-serif;background:#ddd}
 .panel{background:#fff;padding:10px 12px;border-radius:6px;box-shadow:0 1px 4px #0004;font-size:13px;line-height:1.6;max-width:290px}
 .panel h3{margin:0 0 6px;font-size:14px}
 .dot{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:6px;vertical-align:middle;border:1px solid #fff;box-shadow:0 0 0 1px #0003}
</style></head><body><div id="map"></div>
<script>
const PUNTOS=__PUNTOS__, LIMITE=__LIMITE__, CONTEO=__CONTEO__;
const COLOR={funciona:'#2ca02c',necesita_rep:'#ffb000',rota:'#d62728',abandonada:'#7b3f00',contradictorio:'#1f77b4'};
const NOMBRE={funciona:'Funciona',necesita_rep:'Funciona, necesita reparación',rota:'Rota',abandonada:'Abandonada / de baja',contradictorio:'Estado contradictorio (dato dudoso)'};

const borde=L.geoJSON(LIMITE);
const caja=borde.getBounds();
const map=L.map('map',{preferCanvas:true,maxBounds:caja.pad(0.05),maxBoundsViscosity:1});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap | Datos: WPDx'}).addTo(map);

// Máscara: tapa todo lo que está fuera del distrito
const anillos=(LIMITE.type==='Polygon'?[LIMITE.coordinates]:LIMITE.coordinates).map(p=>p[0].map(([x,y])=>[y,x]));
L.polygon([[[-90,-180],[-90,180],[90,180],[90,-180]],...anillos],{stroke:false,fillColor:'#fff',fillOpacity:.85,interactive:false}).addTo(map);
L.geoJSON(LIMITE,{style:{color:'#333',weight:2,fill:false}}).addTo(map);

const capas={};
for(const k of ['funciona','necesita_rep','contradictorio','abandonada','rota']) capas[k]=L.layerGroup().addTo(map);
for(const p of PUNTOS){
  L.circleMarker([p.lat,p.lon],{radius:5,color:'#fff',weight:1,fillColor:COLOR[p.cat],fillOpacity:.9})
   .bindPopup(`<b>${NOMBRE[p.cat]}</b><br>${p.t}<br>${p.sc} / ${p.sub}<br>
     Reporte: ${p.f} · Instalada: ${p.a||'s/i'}<br>
     status_id: ${p.sid||'s/i'} · status_clean: ${p.est}<br>
     Población 1 km: ${p.p||'s/i'} · Criticidad: ${p.c?(+p.c*100).toFixed(0)+'%':'s/i'}<br>
     <small>Fuente: ${p.src}</small>`).addTo(capas[p.cat]);
}
const pts=L.latLngBounds(PUNTOS.map(p=>[p.lat,p.lon]));
map.fitBounds(pts,{padding:[20,20]});
map.setMinZoom(map.getBoundsZoom(caja)-0);

const ov={};
for(const k in capas) ov[`<span class="dot" style="background:${COLOR[k]}"></span>${NOMBRE[k]} (${CONTEO[k]||0})`]=capas[k];
L.control.layers(null,ov,{collapsed:false}).addTo(map);
const info=L.control({position:'bottomleft'});
info.onAdd=()=>{const d=L.DomUtil.create('div','panel');
 d.innerHTML=`<h3>Distrito de Mayuge · ${PUNTOS.length} puntos de agua</h3>
  <small>Fuente: WPDx. Los puntos azules son casi todos grifos de Water4 (2023–2025) cuyo
  estado se contradice entre campos: no se sabe si funcionan.</small>`;return d;};
info.addTo(map);
</script></body></html>"""

if __name__ == "__main__":
    main()

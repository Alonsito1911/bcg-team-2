"""Mapa de puntos de agua WPDx de un distrito, para comparar candidatos a piloto.

Uso: python src/exploracion/mapa_distrito.py gulu | kiryandongo
Muestra solo el distrito (el resto tapado), los puntos con dato 2016+ por estado,
los anteriores a 2016 en una capa aparte y un resumen por subcondado.
Genera output/mapa_<distrito>.html.
"""
import csv
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from comun import OUT, RAW, anillos, categoria, punto_en_poligono

DISTRITOS = {
    "kiryandongo": {
        "nombre": "Kiryandongo", "csv": "wpdx_bunyoro_8.csv",
        "limites": ("limites_bunyoro.json", ["Kiryandongo"]),
        "asentamiento": ("settlement_Kiryandongo.json", "Asentamiento de refugiados Kiryandongo"),
    },
    "gulu": {
        "nombre": "Gulu", "csv": "wpdx_gulu.csv",
        "limites": ("limite_gulu.json", ["Gulu", "Gulu City"]),
        "asentamiento": None,
    },
}
ANIO_RECIENTE = 2016


def main(clave):
    cfg = DISTRITOS[clave]
    archivo, nombres = cfg["limites"]
    geos = [d["geojson"] for d in json.loads((RAW / archivo).read_text(encoding="utf-8"))
            if d["name"] in nombres]
    limite = {"type": "MultiPolygon", "coordinates": [
        c for g in geos for c in (g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]])]}

    asent, asent_nombre = None, ""
    if cfg["asentamiento"]:
        a_archivo, asent_nombre = cfg["asentamiento"]
        asent = json.loads((RAW / a_archivo).read_text(encoding="utf-8"))[0]["geojson"]

    puntos = []
    with open(RAW / cfg["csv"], encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["clean_adm2"] != cfg["nombre"] or not (r["lat_deg"] and r["lon_deg"]):
                continue
            lat, lon = float(r["lat_deg"]), float(r["lon_deg"])
            puntos.append({
                "lat": lat, "lon": lon,
                "cat": categoria(r) if int(r["report_date"][:4]) >= ANIO_RECIENTE else "viejo",
                # en WPDx Uganda, adm3 es el condado y adm4 el subcondado
                "sc": r["clean_adm4"] or "s/i", "sub": r["clean_adm3"],
                "t": r["_water_tech_category"] or r["water_tech_clean"] or "s/i",
                "est": r["status_clean"] or r["status_id"],
                "f": r["report_date"][:10], "a": r["install_year"], "p": r["local_population"],
                "c": r["crucialness"], "pr": r["pressure"], "src": r["source"],
                "in": bool(asent) and any(punto_en_poligono(lon, lat, a) for a in anillos(asent)),
            })

    conteo = Counter(p["cat"] for p in puntos)
    por_sc = defaultdict(Counter)
    for p in puntos:
        if p["cat"] != "viejo":
            por_sc[p["sc"]]["n"] += 1
            por_sc[p["sc"]][p["cat"]] += 1
    subcondados = sorted(([k, v["n"], v["rota"], v["necesita_rep"]] for k, v in por_sc.items()),
                         key=lambda x: -x[2])
    dentro = Counter(p["cat"] for p in puntos if p["in"] and p["cat"] != "viejo")
    print(dict(conteo))
    for s in subcondados:
        print(s)

    OUT.mkdir(exist_ok=True)
    salida = OUT / f"mapa_{clave}.html"
    html = (PLANTILLA.replace("__NOMBRE__", cfg["nombre"])
            .replace("__PUNTOS__", json.dumps(puntos))
            .replace("__LIMITE__", json.dumps(limite))
            .replace("__ASENT__", json.dumps(asent))
            .replace("__ASENT_NOMBRE__", asent_nombre)
            .replace("__CONTEO__", json.dumps(conteo))
            .replace("__DENTRO__", json.dumps(dentro))
            .replace("__SC__", json.dumps(subcondados))
            .replace("__ANIO__", str(ANIO_RECIENTE)))
    salida.write_text(html, encoding="utf-8")
    print(f"{len(puntos)} puntos -> {salida}")


PLANTILLA = """<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Puntos de agua __NOMBRE__</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
 html,body{height:100%;margin:0;font-family:system-ui,sans-serif}
 body{display:flex}
 #map{flex:1;height:100%;background:#ddd}
 #lado{width:300px;overflow:auto;padding:14px;box-sizing:border-box;font-size:13px;line-height:1.5;border-left:1px solid #ddd;background:#fff}
 #lado h3{margin:0 0 4px;font-size:15px}
 #lado h4{margin:14px 0 4px;font-size:12px;color:#555;text-transform:uppercase;letter-spacing:.03em}
 #lado small{color:#666}
 #lado label{display:block;cursor:pointer}
 #lado table{border-collapse:collapse;width:100%;font-size:12px}
 #lado td,#lado th{padding:3px 4px;text-align:right;border-bottom:1px solid #eee}
 #lado td:first-child,#lado th:first-child{text-align:left}
 .dot{display:inline-block;width:11px;height:11px;border-radius:50%;margin:0 6px 0 2px;vertical-align:middle;border:1px solid #fff;box-shadow:0 0 0 1px #0003}
 @media (max-width:800px){body{flex-direction:column}#map{height:60%;flex:none}#lado{width:100%;height:40%;border-left:none;border-top:1px solid #ddd}}
</style></head><body><div id="map"></div><div id="lado"></div>
<script>
const PUNTOS=__PUNTOS__, LIMITE=__LIMITE__, ASENT=__ASENT__, CONTEO=__CONTEO__, DENTRO=__DENTRO__, SC=__SC__;
const COLOR={funciona:'#2ca02c',necesita_rep:'#ffb000',rota:'#d62728',abandonada:'#7b3f00',contradictorio:'#1f77b4',viejo:'#9e9e9e'};
const NOMBRE={funciona:'Funciona',necesita_rep:'Funciona, necesita reparación',rota:'Rota',abandonada:'Abandonada / de baja',contradictorio:'Estado contradictorio',viejo:'Dato anterior a __ANIO__'};

const caja=L.geoJSON(LIMITE).getBounds();
const map=L.map('map',{preferCanvas:true,maxBounds:caja.pad(0.05),maxBoundsViscosity:1});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap | Datos: WPDx'}).addTo(map);
const anillos=LIMITE.coordinates.map(p=>p[0].map(([x,y])=>[y,x]));
L.polygon([[[-90,-180],[-90,180],[90,180],[90,-180]],...anillos],{stroke:false,fillColor:'#fff',fillOpacity:.85,interactive:false}).addTo(map);
L.geoJSON(LIMITE,{style:{color:'#333',weight:2,fill:false}}).addTo(map);

let asent=null;
if(ASENT) asent=L.geoJSON(ASENT,{style:{color:'#1f4e9e',weight:2.5,dashArray:'6 4',fillOpacity:.08}})
  .bindTooltip('__ASENT_NOMBRE__',{sticky:true}).addTo(map);

const capas={};
for(const k of ['viejo','funciona','necesita_rep','contradictorio','abandonada','rota']) capas[k]=L.layerGroup();
for(const k in capas) if(k!=='viejo') capas[k].addTo(map);
for(const p of PUNTOS){
  L.circleMarker([p.lat,p.lon],{radius:p.cat==='viejo'?3.5:5,color:'#fff',weight:1,fillColor:COLOR[p.cat],fillOpacity:.9})
   .bindPopup(`<b>${NOMBRE[p.cat]}</b> <small>(${p.est})</small><br>${p.t}<br>${p.sc} / ${p.sub}<br>
     Reporte: ${p.f} · Instalada: ${p.a||'s/i'}<br>
     Población 1 km: ${p.p||'s/i'} · Criticidad: ${p.c?(+p.c*100).toFixed(0)+'%':'s/i'} · Presión: ${p.pr?(+p.pr*100).toFixed(0)+'%':'s/i'}<br>
     ${p.in?'<b>Dentro del asentamiento de refugiados</b><br>':''}<small>Fuente: ${p.src}</small>`).addTo(capas[p.cat]);
}
map.fitBounds(caja,{padding:[10,10]});
map.setMinZoom(map.getZoom());

const rec=PUNTOS.filter(p=>p.cat!=='viejo').length;
const nd=Object.values(DENTRO).reduce((a,b)=>a+b,0);
const lado=document.getElementById('lado');
lado.innerHTML=`<h3>Distrito de __NOMBRE__</h3>
  <b>${rec}</b> puntos con dato __ANIO__+<br>
  ${ASENT?`Dentro del asentamiento: <b>${nd}</b> puntos, <b>${DENTRO.rota||0}</b> rotos<br>`:''}
  <h4>Capas</h4><div id="ley"></div>
  <h4>Por subcondado (dato __ANIO__+)</h4>
  <table><tr><th>Subcondado</th><th>Pozos</th><th>Rotos</th><th>Reparar</th></tr>
  ${SC.map(([s,n,r,rp])=>`<tr><td>${s}</td><td>${n}</td><td>${r}</td><td>${rp}</td></tr>`).join('')}</table>
  <p><small>Fuente: WPDx. Clic en un punto para ver su detalle.</small></p>`;
const ley=document.getElementById('ley');
const items=['funciona','necesita_rep','contradictorio','abandonada','rota','viejo']
  .map(k=>[`<span class="dot" style="background:${COLOR[k]}"></span>${NOMBRE[k]} (${CONTEO[k]||0})`,capas[k]]);
if(asent) items.push(['<span class="dot" style="background:none;border:2px dashed #1f4e9e;box-shadow:none"></span>Asentamiento de refugiados',asent]);
for(const [txt,capa] of items){
  const l=document.createElement('label');
  l.innerHTML=`<input type="checkbox" ${map.hasLayer(capa)?'checked':''}>${txt}`;
  l.querySelector('input').onchange=e=>e.target.checked?capa.addTo(map):map.removeLayer(capa);
  ley.appendChild(l);
}
</script></body></html>"""

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "gulu")

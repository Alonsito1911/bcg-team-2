"""Comparación de distritos de Bunyoro para elegir el piloto.

Colorea cada distrito por densidad de puntos de agua (por 100 km²) y muestra
una tabla con pozos, rotas, antigüedad del dato y asentamientos de refugiados.
Genera output/mapa_distritos_bunyoro.html.
"""
import csv
import json
import math
from collections import defaultdict
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from comun import OUT, RAW, categoria

REFUGIADOS = {"Kiryandongo": "Kiryandongo", "Kikuube": "Kyangwali"}


def area_km2(anillo):
    lat0 = math.radians(sum(y for _, y in anillo) / len(anillo))
    kx, ky = 111.32 * math.cos(lat0), 110.57
    pts = [(x * kx, y * ky) for x, y in anillo]
    return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]))) / 2


def main():
    limites = {d["name"]: d["geojson"]
               for d in json.loads((RAW / "limites_bunyoro.json").read_text(encoding="utf-8"))
               if d["name"] != "Hoima City"}

    stats = defaultdict(lambda: defaultdict(int))
    puntos = []
    with open(RAW / "wpdx_bunyoro_8.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if not (r["lat_deg"] and r["lon_deg"]):
                continue
            d, cat, anio = r["clean_adm2"], categoria(r), int(r["report_date"][:4])
            s = stats[d]
            s["n"] += 1
            s[cat] += 1
            s["reciente"] += anio >= 2016
            s["ultimo"] = max(s["ultimo"], anio)
            s["bomba"] += "Hand Pump" in (r["_water_tech_category"] or "")
            puntos.append([round(float(r["lat_deg"]), 4), round(float(r["lon_deg"]), 4), cat])

    tabla = []
    for d, g in limites.items():
        anillo = g["coordinates"][0]
        s = stats[d]
        area = area_km2(anillo)
        tabla.append({
            "d": d, "n": s["n"], "area": round(area), "dens": round(s["n"] / area * 100, 1),
            "rota": s["rota"], "rep": s["necesita_rep"], "aband": s["abandonada"],
            "bomba": s["bomba"], "rec": round(100 * s["reciente"] / max(s["n"], 1)),
            "ultimo": s["ultimo"], "ref": REFUGIADOS.get(d, ""),
            "lat": round(sum(y for _, y in anillo) / len(anillo), 3),
        })
    tabla.sort(key=lambda t: -t["lat"])
    for t in tabla:
        print(t)

    OUT.mkdir(exist_ok=True)
    html = (PLANTILLA.replace("__TABLA__", json.dumps(tabla))
            .replace("__LIMITES__", json.dumps(limites))
            .replace("__PUNTOS__", json.dumps(puntos)))
    (OUT / "mapa_distritos_bunyoro.html").write_text(html, encoding="utf-8")
    print(f"-> {OUT / 'mapa_distritos_bunyoro.html'}")


PLANTILLA = """<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Distritos de Bunyoro</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
 html,body{height:100%;margin:0;font-family:system-ui,sans-serif}
 body{display:flex}
 #map{flex:1;height:100%}
 #lado{width:430px;overflow:auto;padding:14px;box-sizing:border-box;font-size:13px;border-left:1px solid #ddd;background:#fff}
 h2{font-size:16px;margin:0 0 4px} p{margin:4px 0 10px;color:#555}
 table{border-collapse:collapse;width:100%}
 th,td{padding:5px 4px;border-bottom:1px solid #eee;text-align:right}
 th:first-child,td:first-child{text-align:left}
 th{font-size:11px;color:#555;font-weight:600}
 tr{cursor:pointer} tr:hover td{background:#f5f5f5}
 tr.sel td{background:#fff3c4}
 .norte td:first-child{font-weight:700}
 .tag{font-size:10px;background:#1f4e9e;color:#fff;border-radius:3px;padding:1px 4px;margin-left:4px}
 .leg i{display:inline-block;width:14px;height:10px;margin-right:4px;vertical-align:middle}
 #ficha{margin-top:12px;padding:10px;background:#f7f7f7;border-radius:6px;line-height:1.6}
 .lbl{background:none;border:none;box-shadow:none;font-weight:700;font-size:12px;color:#222;text-shadow:0 0 3px #fff,0 0 3px #fff}
 @media (max-width:800px){body{flex-direction:column}#map{height:55%;flex:none}#lado{width:100%;height:45%}}
</style></head><body><div id="map"></div><div id="lado">
<h2>Distritos de Bunyoro · ¿cuál elegir?</h2>
<p>Color = puntos de agua por 100 km² (más claro = menos pozos). Ordenados de norte a sur; en negrita, los del norte. Clic en una fila o distrito para ver el detalle.</p>
<div class="leg" id="leg"></div>
<table><thead><tr><th>Distrito</th><th>Pozos</th><th>/100 km²</th><th>Rotos</th><th>Dato 2016+</th><th>Último</th></tr></thead><tbody id="tb"></tbody></table>
<div id="ficha">Elige un distrito.</div>
</div>
<script>
const TABLA=__TABLA__, LIMITES=__LIMITES__, PUNTOS=__PUNTOS__;
const COLOR={funciona:'#2ca02c',necesita_rep:'#ffb000',rota:'#d62728',abandonada:'#7b3f00',contradictorio:'#1f77b4'};
const ESC=[[0,'#f7fbff'],[10,'#c6dbef'],[20,'#6baed6'],[30,'#2171b5'],[40,'#08306b']];
const colorD=v=>ESC.filter(e=>v>=e[0]).pop()[1];
const norteLat=1.6;
const map=L.map('map',{preferCanvas:true});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap | Datos: WPDx'}).addTo(map);
const poli={};
for(const t of TABLA){
  const g=L.geoJSON(LIMITES[t.d],{style:{color:'#333',weight:t.lat>=norteLat?2.5:1,fillColor:colorD(t.dens),fillOpacity:.65}}).addTo(map);
  g.on('click',()=>elegir(t.d));
  g.bindTooltip(t.d,{permanent:true,direction:'center',className:'lbl'});
  poli[t.d]=g;
}
const pts=L.layerGroup();
for(const [la,lo,c] of PUNTOS) L.circleMarker([la,lo],{radius:2,weight:0,fillColor:COLOR[c],fillOpacity:.8}).addTo(pts);
L.control.layers(null,{'Ver pozos (puntos)':pts},{collapsed:false}).addTo(map);
map.fitBounds(L.featureGroup(Object.values(poli)).getBounds());
document.getElementById('leg').innerHTML=ESC.map((e,i)=>`<i style="background:${e[1]}"></i>${e[0]}${ESC[i+1]?'–'+ESC[i+1][0]:'+'}`).join(' &nbsp;');
const tb=document.getElementById('tb');
for(const t of TABLA){
  const tr=document.createElement('tr');tr.id='f-'+t.d;if(t.lat>=norteLat)tr.className='norte';
  tr.innerHTML=`<td>${t.d}${t.ref?'<span class="tag">refugiados</span>':''}</td><td>${t.n}</td><td>${t.dens}</td><td>${t.rota}</td><td>${t.rec}%</td><td>${t.ultimo}</td>`;
  tr.onclick=()=>elegir(t.d);tb.appendChild(tr);
}
function elegir(d){
  const t=TABLA.find(x=>x.d===d);
  document.querySelectorAll('tr.sel').forEach(x=>x.classList.remove('sel'));
  document.getElementById('f-'+d).classList.add('sel');
  map.fitBounds(poli[d].getBounds(),{padding:[20,20]});
  if(!map.hasLayer(pts))pts.addTo(map);
  document.getElementById('ficha').innerHTML=`<b style="font-size:14px">${d}</b>${t.lat>=norteLat?' · norte':''}<br>
   Área: ${t.area.toLocaleString('es')} km² · Puntos de agua: <b>${t.n}</b> (${t.dens} por 100 km²)<br>
   Bombas manuales: ${t.bomba}<br>
   <span style="color:${COLOR.rota}">●</span> Rotas: <b>${t.rota}</b> &nbsp;
   <span style="color:${COLOR.necesita_rep}">●</span> Necesitan reparación: ${t.rep} &nbsp;
   <span style="color:${COLOR.abandonada}">●</span> Abandonadas: ${t.aband}<br>
   Datos desde 2016: <b>${t.rec}%</b> · Reporte más reciente: ${t.ultimo}<br>
   Asentamiento de refugiados: ${t.ref||'no'}`;
}
</script></body></html>"""

if __name__ == "__main__":
    main()

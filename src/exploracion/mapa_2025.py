"""Mapa de los puntos WPDx Uganda reportados en 2024-2025 (casi todos Water4).

Contexto: Bunyoro (piloto) en gris para comparar ubicación.
Genera output/mapa_uganda_2025.html.
"""
import csv
import json
from collections import Counter
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from comun import OUT, RAW

BUNYORO = {"Masindi", "Kikuube", "Kiryandongo"}


def leer(nombre):
    with open(RAW / nombre, encoding="utf-8") as f:
        return [r for r in csv.DictReader(f) if r["lat_deg"] and r["lon_deg"]]


def main():
    recientes = [{
        "lat": float(r["lat_deg"]), "lon": float(r["lon_deg"]),
        "d": r["clean_adm2"], "sc": r["clean_adm3"],
        "t": r["_water_tech_category"] or r["water_tech_clean"] or "s/i",
        "sid": r["status_id"], "sc_": r["status_clean"] or "s/i",
        "f": r["report_date"][:10], "a": r["install_year"], "p": r["local_population"],
        "src": r["source"],
    } for r in leer("wpdx_uganda_2024_2025.csv")]
    bunyoro = [[round(float(r["lat_deg"]), 4), round(float(r["lon_deg"]), 4)]
               for r in leer("wpdx_bunyoro_8.csv") if r["clean_adm2"] in BUNYORO]

    resumen = Counter(p["d"] for p in recientes)
    print(dict(resumen))
    OUT.mkdir(exist_ok=True)
    html = (PLANTILLA.replace("__REC__", json.dumps(recientes))
            .replace("__BUN__", json.dumps(bunyoro))
            .replace("__RES__", json.dumps(resumen.most_common())))
    (OUT / "mapa_uganda_2025.html").write_text(html, encoding="utf-8")
    print(f"{len(recientes)} puntos -> {OUT / 'mapa_uganda_2025.html'}")


PLANTILLA = """<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Puntos de agua 2025</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
 html,body,#map{height:100%;margin:0;font-family:system-ui,sans-serif}
 .panel{background:#fff;padding:10px 12px;border-radius:6px;box-shadow:0 1px 4px #0004;font-size:13px;line-height:1.5;max-width:300px}
 .panel h3{margin:0 0 6px;font-size:14px}
 .zona button{display:block;width:100%;margin-top:4px;padding:5px 8px;text-align:left;background:#f4f4f4;border:1px solid #ccc;border-radius:4px;cursor:pointer;font:inherit}
 .zona button.on{background:#222;color:#fff}
 .zona{margin-top:60px!important}
 .dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:middle}
</style></head><body><div id="map"></div>
<script>
const REC=__REC__, BUN=__BUN__, RES=__RES__;
const COLOR={Mayuge:'#1f77b4',Kyenjojo:'#9467bd',Kabarole:'#e377c2'};
const map=L.map('map',{preferCanvas:true});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap | Datos: WPDx'}).addTo(map);
const bun=L.layerGroup();
for(const [la,lo] of BUN) L.circleMarker([la,lo],{radius:1.5,color:'#9e9e9e',weight:0,fillOpacity:.5}).addTo(bun);
const rec=L.layerGroup().addTo(map);
for(const p of REC){
  const c=COLOR[p.d]||'#ff7f0e';
  L.circleMarker([p.lat,p.lon],{radius:6,color:'#fff',fillColor:c,fillOpacity:.9,weight:1.5})
   .bindPopup(`<b>${p.t}</b><br>${p.d} / ${p.sc}<br>Reporte: ${p.f} · Instalado: ${p.a||'s/i'}<br>
     status_id: <b>${p.sid||'s/i'}</b> · status_clean: <b>${p.sc_}</b><br>
     Población 1 km: ${p.p||'s/i'}<br><small>Fuente: ${p.src}</small>`).addTo(rec);
}
function irA(d){
  const pts=REC.filter(p=>!d||p.d===d).map(p=>[p.lat,p.lon]);
  map.fitBounds(L.latLngBounds(pts),{padding:[30,30]});
  document.querySelectorAll('.zona button').forEach(b=>b.classList.toggle('on',b.dataset.d===(d||'')));
}
const zonas=L.control({position:'topleft'});
zonas.onAdd=()=>{const d=L.DomUtil.create('div','panel zona');
 d.innerHTML='<b>Ir a zona</b><br>'+RES.map(([k,n])=>`<button data-d="${k}" style="border-left:6px solid ${COLOR[k]||'#ff7f0e'}">${k} (${n})</button>`).join('')+
  '<button data-d="">Todas</button>';
 L.DomEvent.disableClickPropagation(d);
 d.querySelectorAll('button').forEach(b=>b.onclick=()=>irA(b.dataset.d||null));
 return d;};
zonas.addTo(map);
irA(RES[0][0]);
L.control.layers(null,{
  'Puntos reportados 2024–2025':rec,
  '<span class="dot" style="background:#9e9e9e"></span>Bunyoro (piloto, censo 2022)':bun
},{collapsed:false}).addTo(map);
const info=L.control({position:'bottomleft'});
info.onAdd=()=>{const d=L.DomUtil.create('div','panel');
 d.innerHTML='<h3>WPDx Uganda · reportes 2024–2025</h3>'+
  RES.map(([k,n])=>`<span class="dot" style="background:${COLOR[k]||'#ff7f0e'}"></span>${k}: <b>${n}</b>`).join('<br>')+
  '<br><small>Casi todos son grifos públicos de Water4. El estado se contradice: status_id = "Yes" pero status_clean = "Non-Functional". No es confiable.</small>';
 return d;};
info.addTo(map);
</script></body></html>"""

if __name__ == "__main__":
    main()

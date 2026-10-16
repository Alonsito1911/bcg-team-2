"""Mapa exploratorio de puntos de agua WPDx en Bunyoro (Masindi, Kikuube, Kiryandongo).

Genera output/mapa_bunyoro.html (Leaflet, sin dependencias de Python extra).
"""
import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from comun import OUT, RAW, anillos, punto_en_poligono

DISTRITOS = {"Masindi", "Kikuube", "Kiryandongo"}


def main():
    asentamientos = []
    for nombre in ["Kiryandongo", "Kyangwali"]:
        g = json.loads((RAW / f"settlement_{nombre}.json").read_text(encoding="utf-8"))[0]
        asentamientos.append({"nombre": g["name"], "geojson": g["geojson"]})

    puntos = []
    with open(RAW / "wpdx_bunyoro_8.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["clean_adm2"] not in DISTRITOS:
                continue
            try:
                lat, lon = float(r["lat_deg"]), float(r["lon_deg"])
            except ValueError:
                continue
            anio = int(r["report_date"][:4]) if r["report_date"] else None
            # status_clean es más detallado que status_id; si se contradicen, "inconsistente"
            estado = r["status_clean"]
            if estado.startswith("Abandoned"):
                cat = "abandonada"
            elif estado == "Non-Functional":
                cat = "rota"
            elif r["status_id"] == "No":
                cat = "inconsistente"
            elif estado == "Functional, needs repair":
                cat = "necesita_rep"
            elif anio and anio >= 2016:
                cat = "ok_reciente"
            else:
                cat = "ok_viejo"
            dentro = next(
                (a["nombre"] for a in asentamientos
                 if any(punto_en_poligono(lon, lat, an) for an in anillos(a["geojson"]))),
                None,
            )
            puntos.append({
                "lat": lat, "lon": lon, "cat": cat,
                "d": r["clean_adm2"], "sc": r["clean_adm3"],
                "t": r["_water_tech_category"] or r["water_tech_clean"] or "s/i",
                "st": r["status_clean"] or r["status_id"],
                "f": r["report_date"][:10], "a": r["install_year"],
                "p": r["local_population"], "c": r["crucialness"], "pr": r["pressure"],
                "src": r["source"], "in": dentro,
            })

    resumen = {}
    for p in puntos:
        k = p["in"] or "Fuera de asentamientos"
        s = resumen.setdefault(k, {"n": 0, "rota": 0})
        s["n"] += 1
        s["rota"] += p["cat"] == "rota"
    for k, s in resumen.items():
        print(f"{k}: {s['n']} puntos, {s['rota']} rotos")

    # Grilla de ~5,5 km: % de bombas rotas (sin contar abandonadas)
    paso = 0.05
    celdas = {}
    for p in puntos:
        if p["cat"] == "abandonada":
            continue
        k = (int(p["lat"] // paso), int(p["lon"] // paso))
        c = celdas.setdefault(k, [0, 0])
        c[0] += 1
        c[1] += p["cat"] == "rota"
    grilla = [{"s": i * paso, "w": j * paso, "n": n, "r": r}
              for (i, j), (n, r) in celdas.items() if n >= 5]

    OUT.mkdir(exist_ok=True)
    html = (PLANTILLA.replace("__PUNTOS__", json.dumps(puntos))
            .replace("__ASENT__", json.dumps(asentamientos))
            .replace("__RESUMEN__", json.dumps(resumen))
            .replace("__GRILLA__", json.dumps(grilla))
            .replace("__PASO__", str(paso)))
    (OUT / "mapa_bunyoro.html").write_text(html, encoding="utf-8")
    print(f"{len(puntos)} puntos -> {OUT / 'mapa_bunyoro.html'}")


PLANTILLA = """<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Puntos de agua Bunyoro</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
 html,body,#map{height:100%;margin:0;font-family:system-ui,sans-serif}
 .panel{background:#fff;padding:10px 12px;border-radius:6px;box-shadow:0 1px 4px #0004;font-size:13px;line-height:1.5;max-width:260px}
 .panel h3{margin:0 0 6px;font-size:14px}
 .dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:middle}
</style></head><body><div id="map"></div>
<script>
const PUNTOS=__PUNTOS__, ASENT=__ASENT__, RESUMEN=__RESUMEN__, GRILLA=__GRILLA__, PASO=__PASO__;
const COLOR={rota:'#d62728',abandonada:'#7b3f00',inconsistente:'#9467bd',necesita_rep:'#ffb000',ok_reciente:'#2ca02c',ok_viejo:'#9e9e9e'};
const NOMBRE={rota:'Rota (Non-Functional)',abandonada:'Abandonada / de baja',inconsistente:'Inconsistente (revisar)',necesita_rep:'Funciona, necesita reparación',ok_reciente:'Funciona (dato 2016+)',ok_viejo:'Funciona (dato < 2016)'};
const map=L.map('map',{preferCanvas:true});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap | Datos: WPDx'}).addTo(map);
function colorPct(f){return f>=.4?'#a50f15':f>=.3?'#de2d26':f>=.2?'#fb6a4a':f>=.1?'#fcae91':'#fee5d9';}
const grilla=L.layerGroup();
for(const c of GRILLA){
  const f=c.r/c.n;
  L.rectangle([[c.s,c.w],[c.s+PASO,c.w+PASO]],{color:'#555',weight:.5,fillColor:colorPct(f),fillOpacity:.7})
   .bindTooltip(`${(f*100).toFixed(0)}% rotas (${c.r} de ${c.n})`,{sticky:true}).addTo(grilla);
}
const capas={};
for(const k of ['ok_viejo','ok_reciente','necesita_rep','abandonada','inconsistente','rota']) capas[k]=L.layerGroup().addTo(map);
// orden aleatorio para que ningún color tape sistemáticamente a otro
const orden=PUNTOS.map((p,i)=>[Math.random(),p]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
for(const p of orden){
  L.circleMarker([p.lat,p.lon],{radius:2.5,color:COLOR[p.cat],fillColor:COLOR[p.cat],fillOpacity:.85,weight:0})
   .bindPopup(`<b>${p.st}</b><br>${p.t}<br>${p.d} / ${p.sc}<br>Reporte: ${p.f} · Instalada: ${p.a||'s/i'}<br>
     Población 1 km: ${p.p||'s/i'} · Criticidad: ${p.c?(+p.c*100).toFixed(0)+'%':'s/i'} · Presión: ${p.pr?(+p.pr*100).toFixed(0)+'%':'s/i'}<br>
     ${p.in?'<b>Dentro de '+p.in+'</b><br>':''}<small>Fuente: ${p.src}</small>`).addTo(capas[p.cat]);
}
const asent=L.layerGroup().addTo(map);
for(const a of ASENT) L.geoJSON(a.geojson,{style:{color:'#1f4e9e',weight:2,fillOpacity:.08,dashArray:'5 4'}}).bindTooltip(a.nombre,{sticky:true}).addTo(asent);
map.fitBounds(L.latLngBounds(PUNTOS.map(p=>[p.lat,p.lon])),{padding:[20,20]});
const ov={};for(const k in capas) ov[`<span class="dot" style="background:${COLOR[k]}"></span>${NOMBRE[k]}`]=capas[k];
ov['Asentamientos de refugiados (OSM)']=asent;
ov['% rotas por celda ~5 km (mín. 5 puntos)']=grilla;
L.control.layers(null,ov,{collapsed:false}).addTo(map);
const info=L.control({position:'bottomleft'});
info.onAdd=()=>{const d=L.DomUtil.create('div','panel');
 d.innerHTML='<h3>Puntos de agua WPDx · Bunyoro</h3>'+Object.entries(RESUMEN).map(([k,s])=>`${k}: <b>${s.n}</b> puntos, <b>${s.rota}</b> rotos`).join('<br>');return d;};
info.addTo(map);
</script></body></html>"""

if __name__ == "__main__":
    main()

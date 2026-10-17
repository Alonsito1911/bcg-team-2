"""Mapa del modelo de prioridad de Kiryandongo (semáforo + ranking + lluvia).

Requiere haber corrido src/lluvia.py y src/prioridad.py.
Genera output/prioridad_kiryandongo.html.
"""
import csv
import json

import lora
from comun import OUT, PROC, RAW
from lluvia import PASO as PASO_LLUVIA
from prioridad import MESES_SECOS


def main():
    limite = next(d["geojson"] for d in json.loads((RAW / "limites_bunyoro.json").read_text(encoding="utf-8"))
                  if d["name"] == "Kiryandongo")
    asent = json.loads((RAW / "settlement_Kiryandongo.json").read_text(encoding="utf-8"))[0]["geojson"]
    lluvia = json.loads((RAW / "lluvia_kiryandongo.json").read_text(encoding="utf-8"))
    for c in lluvia:
        c["seca"] = round(sum(c["mensual"][m - 1] for m in MESES_SECOS))
    with open(PROC / "prioridad_kiryandongo.csv", encoding="utf-8") as f:
        puntos = list(csv.DictReader(f))
    # Antenas de OpenStreetMap (muy incompleto en zonas rurales)
    antenas = []
    for e in json.loads((RAW / "antenas_osm_kiryandongo.json").read_text(encoding="utf-8"))["elements"]:
        c = e.get("center", e)
        antenas.append({"lat": c["lat"], "lon": c["lon"], "tipo": e.get("tags", {}).get("man_made", "")})
    torres, nuevos, resumen_lora = lora.escenario(puntos, antenas)
    print("LoRa:", resumen_lora, "nuevos:", nuevos)

    OUT.mkdir(exist_ok=True)
    html = (PLANTILLA.replace("__PUNTOS__", json.dumps(puntos))
            .replace("__LIMITE__", json.dumps(limite))
            .replace("__ASENT__", json.dumps(asent))
            .replace("__LLUVIA__", json.dumps(lluvia))
            .replace("__ANTENAS__", json.dumps(torres))
            .replace("__NUEVOS__", json.dumps(nuevos))
            .replace("__LORA__", json.dumps(resumen_lora))
            .replace("__PASO__", str(PASO_LLUVIA)))
    salida = OUT / "prioridad_kiryandongo.html"
    salida.write_text(html, encoding="utf-8")
    print(f"{len(puntos)} puntos -> {salida}")


PLANTILLA = """<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prioridad Kiryandongo</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
 html,body{height:100%;margin:0;font-family:system-ui,sans-serif}
 body{display:flex}
 #map{flex:1;height:100%;background:#ddd}
 #lado{width:340px;overflow:auto;padding:14px;box-sizing:border-box;font-size:13px;line-height:1.5;border-left:1px solid #ddd;background:#fff}
 #lado h3{margin:0 0 2px;font-size:15px}
 #lado h4{margin:16px 0 6px;font-size:12px;color:#555;text-transform:uppercase;letter-spacing:.03em}
 #lado small{color:#666}
 #lado label{display:block;cursor:pointer}
 .niv{display:grid;grid-template-columns:auto 1fr auto;gap:2px 8px;align-items:center}
 .dot{display:inline-block;width:11px;height:11px;border-radius:50%;border:1px solid #fff;box-shadow:0 0 0 1px #0003;vertical-align:middle}
 table{border-collapse:collapse;width:100%;font-size:12px}
 td,th{padding:3px 4px;border-bottom:1px solid #eee;text-align:left;vertical-align:top}
 td.n{text-align:right;white-space:nowrap}
 tbody tr{cursor:pointer} tbody tr:hover td{background:#f5f5f5}
 .bar{display:flex;align-items:flex-end;gap:3px;height:70px;margin-top:4px}
 .bar div{flex:1;background:#6baed6;position:relative}
 .bar div.seco{background:#e6550d}
 .mes{display:flex;gap:3px;font-size:10px;color:#666}.mes span{flex:1;text-align:center}
 .zonas{display:flex;gap:4px}
 .zonas button{flex:1;padding:6px 4px;border:1px solid #ccc;background:#f4f4f4;border-radius:4px;cursor:pointer;font:inherit;font-size:12px}
 .zonas button.on{background:#222;color:#fff;border-color:#222}
 #zstat{margin-top:6px;padding:8px;background:#f7f7f7;border-radius:6px}
 @media (max-width:800px){body{flex-direction:column}#map{height:55%;flex:none}#lado{width:100%;height:45%;border-left:none;border-top:1px solid #ddd}}
</style></head><body><div id="map"></div><div id="lado"></div>
<script>
const P=__PUNTOS__, LIMITE=__LIMITE__, ASENT=__ASENT__, LLUVIA=__LLUVIA__, PASO=__PASO__;
const ANTENAS=__ANTENAS__, NUEVOS=__NUEVOS__, LORA=__LORA__;
const NIV={'Crítico':'#b2182b','Alto':'#f4a582','Revisar':'#7b3294','Bien':'#4daf4a'};
const map=L.map('map',{preferCanvas:true});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap | Datos: WPDx, Open-Meteo (ERA5)'}).addTo(map);
const caja=L.geoJSON(LIMITE).getBounds();
map.setMaxBounds(caja.pad(0.1));
const anillo=LIMITE.coordinates[0].map(([x,y])=>[y,x]);
L.polygon([[[-90,-180],[-90,180],[90,180],[90,-180]],anillo],{stroke:false,fillColor:'#fff',fillOpacity:.85,interactive:false}).addTo(map);
L.geoJSON(LIMITE,{style:{color:'#333',weight:2,fill:false}}).addTo(map);

// Lluvia en estación seca (dic-feb) por celda
const secas=LLUVIA.map(c=>c.seca), sMin=Math.min(...secas), sMax=Math.max(...secas);
const colorSeco=v=>{const t=(sMax-v)/(sMax-sMin);return `rgb(${Math.round(255-t*25)},${Math.round(240-t*130)},${Math.round(200-t*170)})`;};
const lluvia=L.layerGroup();
for(const c of LLUVIA) L.rectangle([[c.lat-PASO/2,c.lon-PASO/2],[c.lat+PASO/2,c.lon+PASO/2]],{weight:.3,color:'#999',fillColor:colorSeco(c.seca),fillOpacity:.6})
  .bindTooltip(`Dic–feb: ${c.seca} mm · Año: ${Math.round(c.mensual.reduce((a,b)=>a+b,0))} mm`,{sticky:true}).addTo(lluvia);

const asent=L.geoJSON(ASENT,{style:{color:'#1f4e9e',weight:2.5,dashArray:'6 4',fillOpacity:.05}}).bindTooltip('Asentamiento de refugiados',{sticky:true}).addTo(map);

// Red LoRaWAN: gateways en torres existentes (azul) y nuevos propuestos (naranjo)
const antenas=L.layerGroup().addTo(map);
const icono=(color,letra)=>L.divIcon({className:'',iconSize:[44,52],iconAnchor:[22,48],popupAnchor:[0,-44],
  html:`<svg width="44" height="52" viewBox="0 0 44 52"><path d="M22 50 L8 18 h28 Z" fill="${color}" stroke="#fff" stroke-width="2"/>
   <line x1="22" y1="18" x2="22" y2="48" stroke="#fff" stroke-width="2"/><line x1="13" y1="30" x2="31" y2="30" stroke="#fff" stroke-width="1.5"/>
   <circle cx="22" cy="12" r="10" fill="${color}" stroke="#fff" stroke-width="2.5"/>
   <text x="22" y="16.5" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" font-family="system-ui">${letra}</text></svg>`});
for(const a of ANTENAS){
  L.circle([a.lat,a.lon],{radius:LORA.radio_km*1000,color:'#1864ab',weight:2.5,fillColor:'#4dabf7',fillOpacity:.12,interactive:false}).addTo(antenas);
  L.marker([a.lat,a.lon],{icon:icono('#1864ab','T'),zIndexOffset:1000}).bindPopup(`<b>Torre existente</b> (${a.tipo}, OpenStreetMap)<br>
    Se puede instalar aquí un <b>gateway LoRaWAN</b>: tiene altura, energía y conexión.<br>
    Alcance supuesto: ~${LORA.radio_km} km`).addTo(antenas);
}
NUEVOS.forEach((g,i)=>{
  L.circle([g.lat,g.lon],{radius:LORA.radio_km*1000,color:'#e8590c',weight:2.5,dashArray:'8 6',fillColor:'#ffa94d',fillOpacity:.12,interactive:false}).addTo(antenas);
  L.marker([g.lat,g.lon],{icon:icono('#e8590c',String(i+1)),zIndexOffset:1000}).bindPopup(`<b>Gateway nuevo propuesto #${i+1}</b><br>
    Cubre <b>${g.criticas}</b> bombas críticas sin cobertura (${g.personas.toLocaleString('es')} personas afectadas).<br>
    Necesita un mástil, energía (solar) y conexión (celular o satélite).<br>Alcance supuesto: ~${LORA.radio_km} km`).addTo(antenas);
});

const capas={}, marcas={}, porId={};
for(const k in NIV){capas[k]=L.layerGroup();if(k!=='Bien')capas[k].addTo(map);}
for(const p of [...P].reverse()){
  const r=4+Math.min(10,Math.sqrt(+p.personas_afectadas)/3);
  const m=L.circleMarker([+p.lat,+p.lon],{radius:r,color:'#fff',weight:1,fillColor:NIV[p.nivel],fillOpacity:.9})
   .bindPopup(`<b>#${p.ranking} · ${p.nivel}</b><br>${p.motivo}<br>
     Personas afectadas: <b>${(+p.personas_afectadas).toLocaleString('es')}</b> (usuarios: ${p.personas_servidas||'s/i'})<br>
     ${p.subcondado} · instalada ${p.anio_instalacion||'s/i'} · reporte ${p.fecha_reporte}<br>
     Lluvia zona: ${p.lluvia_anual_mm} mm/año, ${p.lluvia_dic_feb_mm} mm en dic–feb (factor ${p.factor_seco})<br>
     <small>Puntaje ${p.puntaje} · ${p.wpdx_id}</small>`).addTo(capas[p.nivel]);
  marcas[p.ranking]=m; porId[p.wpdx_id]=m;
}
map.fitBounds(caja,{padding:[10,10]});

// Panel lateral
const res={};for(const k in NIV)res[k]={n:0,p:0};
for(const p of P){res[p.nivel].n++;res[p.nivel].p+=+p.personas_afectadas;}
const prom=Array.from({length:12},(_,i)=>LLUVIA.reduce((a,c)=>a+c.mensual[i],0)/LLUVIA.length);
const mx=Math.max(...prom);
const lado=document.getElementById('lado');
lado.innerHTML=`<h3>Prioridad de bombas · Kiryandongo</h3>
 <small>Modelo v1 por reglas · ${P.length} puntos (censo 2022)</small>
 <h4>Sensores en vivo</h4><div id="vivo"><small>Conectando con Azure…</small></div><div id="alertasVivo"></div>
 <h4>Zona</h4><div class="zonas" id="zonas"></div><div id="zstat"></div>
 <h4>Semáforo</h4><div class="niv" id="niv"></div>
 <h4>Lluvia promedio 2015–2024</h4>
 <div class="bar">${prom.map((v,i)=>`<div class="${[11,0,1].includes(i)?'seco':''}" style="height:${v/mx*100}%" title="${Math.round(v)} mm"></div>`).join('')}</div>
 <div class="mes">${'EFMAMJJASOND'.split('').map(x=>`<span>${x}</span>`).join('')}</div>
 <small>En naranjo, la estación seca (dic–feb): ahí las fuentes superficiales se secan y sube la demanda de las bombas. Las zonas más secas pesan hasta 20% más en el puntaje.</small>
 <label style="margin-top:6px"><input type="checkbox" id="chkLluvia"> Ver lluvia de dic–feb por zona</label>
 <label><input type="checkbox" id="chkAsent" checked> Asentamiento de refugiados</label>
 <h4>Red LoRaWAN para sensores</h4>
 <label><input type="checkbox" id="chkAntenas" checked> Ver gateways y cobertura (~${LORA.radio_km} km)</label>
 <div style="margin:4px 0 2px"><b style="color:#1864ab">T</b> Torre existente (${ANTENAS.length}) → gateway en torre<br>
 <b style="color:#e8590c">1–${NUEVOS.length}</b> Gateway nuevo propuesto</div>
 Bombas críticas cubiertas: solo torres <b>${LORA.criticas_con_torres}/${LORA.criticas_total}</b> → con nuevos <b>${LORA.criticas_con_todo}/${LORA.criticas_total}</b><br>
 Total bombas con cobertura: <b>${LORA.bombas_cubiertas}</b> de ${P.length}<br>
 <small>Torres de OpenStreetMap (muy incompleto: hay más de MTN/Airtel). Los nuevos se ubican donde cubren más personas afectadas en bombas críticas sin cobertura.</small>
 <h4>Top 20 a intervenir</h4>
 <table><thead><tr><th>#</th><th>Motivo</th><th>Lugar</th><th class="n">Personas</th></tr></thead><tbody id="top"></tbody></table>
 <p><small>Personas afectadas: si está rota, sus usuarios; si está sobreusada, las personas por sobre su capacidad (300). Fuente: WPDx, Open-Meteo.</small></p>`;
const niv=document.getElementById('niv');
for(const k in NIV){
  const l=document.createElement('label');
  l.innerHTML=`<input type="checkbox" ${map.hasLayer(capas[k])?'checked':''}> <span class="dot" style="background:${NIV[k]}"></span> <b>${k}</b>`;
  l.querySelector('input').onchange=e=>e.target.checked?capas[k].addTo(map):map.removeLayer(capas[k]);
  niv.appendChild(l);
  niv.insertAdjacentHTML('beforeend',`<span>${res[k].n} puntos</span><span>${res[k].p?res[k].p.toLocaleString('es')+' pers.':''}</span>`);
}
// Recorrido de la demo: distrito -> cinturón del asentamiento -> Bweyale
const ZONAS=[
  ['Distrito',null],
  ['Cinturón',['Bweyale Town Council','Kiryandongo']],
  ['Bweyale',['Bweyale Town Council']],
];
function verZona(i){
  const [nom,scs]=ZONAS[i];
  const g=scs?P.filter(p=>scs.includes(p.subcondado)):P;
  if(scs) map.fitBounds(L.latLngBounds(g.map(p=>[+p.lat,+p.lon])),{padding:[30,30]});
  else map.fitBounds(caja,{padding:[10,10]});
  const crit=g.filter(p=>p.nivel==='Crítico');
  const ok=g.filter(p=>p.estado==='funciona'||p.estado==='necesita_rep');
  const usuarios=g.filter(p=>['funciona','necesita_rep','rota'].includes(p.estado)).reduce((a,p)=>a+(+p.personas_servidas||0),0);
  document.getElementById('zstat').innerHTML=`<b>${nom}</b>${scs?' · '+scs.map(s=>s.replace(' Town Council','')).join(' + '):''}<br>
    ${g.length} bombas · <b style="color:${NIV['Crítico']}">${crit.length} críticas</b> (${crit.reduce((a,p)=>a+(+p.personas_afectadas),0).toLocaleString('es')} pers. afectadas)<br>
    Uso vs capacidad: <b>${Math.round(usuarios/(ok.length*300)*100)}%</b> <small>(${Math.round(usuarios).toLocaleString('es')} usuarios / ${(ok.length*300).toLocaleString('es')} cupos)</small>`;
  document.querySelectorAll('.zonas button').forEach((b,j)=>b.classList.toggle('on',i===j));
}
const zonas=document.getElementById('zonas');
ZONAS.forEach(([nom],i)=>{const b=document.createElement('button');b.textContent=nom;b.onclick=()=>verZona(i);zonas.appendChild(b);});
verZona(0);

document.getElementById('chkLluvia').onchange=e=>e.target.checked?lluvia.addTo(map).bringToBack():map.removeLayer(lluvia);
// Sensores en vivo: estado.json lo escribe la Azure Function en el mismo sitio web.
// Abierto como archivo local no hay conexión y la sección lo indica.
const VIVO={posible_falla:['#c92a2a','Posible falla'],riesgo_contaminacion:['#1c7ed6','Riesgo contaminación'],sobreuso:['#f08c00','Sobreuso']};
const popupBase={};
function actualizarVivo(){
  fetch('estado.json?t='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(e=>{
    const cuenta={posible_falla:0,riesgo_contaminacion:0,sobreuso:0};
    for(const [id,s] of Object.entries(e.bombas)){
      const m=porId[id]; if(!m) continue;
      if(!(id in popupBase)) popupBase[id]=m.getPopup().getContent();
      const v=VIVO[s.estado];
      if(v){cuenta[s.estado]++; m.setStyle({color:v[0],weight:4});} else m.setStyle({color:'#fff',weight:1});
      m.getPopup().setContent(popupBase[id]+`<hr style="margin:4px 0"><b>Sensor (${s.codigo})</b>: ${v?v[1]:'normal'} · ${s.ultimo.slice(11,16)}<br>
        Hoy ${Math.round(s.litros_dia).toLocaleString('es')} L · turbidez ${s.turbidez} NTU · batería ${Math.round(s.bateria*100)}%`);
    }
    document.getElementById('vivo').innerHTML=`<small>Hora simulada ${e.actualizado?e.actualizado.slice(11,16):'-'} · ${e.eventos.toLocaleString('es')} mensajes · borde de color = alerta</small><br>`+
      Object.entries(VIVO).map(([k,v])=>`<span class="dot" style="background:#fff;border:3px solid ${v[0]};box-shadow:none"></span>${v[1]}: <b>${cuenta[k]}</b>`).join('<br>');
    document.getElementById('alertasVivo').innerHTML=e.alertas.filter(a=>a.sms).sort((a,b)=>(b.tipo==='posible_falla')-(a.tipo==='posible_falla')).slice(0,6).map(a=>
      `<div style="border-left:4px solid ${VIVO[a.tipo][0]};padding:4px 6px;margin-top:4px;background:#fafafa;cursor:pointer" data-id="${a.pozo_id}">
       <b>SMS ${a.codigo}</b> · ${a.ts.slice(11,16)}<br><small>${a.mensaje}</small></div>`).join('');
    document.querySelectorAll('#alertasVivo [data-id]').forEach(d=>d.onclick=()=>{const m=porId[d.dataset.id];if(m){map.setView(m.getLatLng(),15);m.openPopup();}});
  }).catch(()=>{document.getElementById('vivo').innerHTML='<small>Sin conexión a los sensores (se ve en la versión publicada en Azure).</small>';});
}
actualizarVivo(); setInterval(actualizarVivo,3000);

document.getElementById('chkAntenas').onchange=e=>e.target.checked?antenas.addTo(map):map.removeLayer(antenas);
document.getElementById('chkAsent').onchange=e=>e.target.checked?asent.addTo(map):map.removeLayer(asent);
const tablaTop=document.getElementById('top');
for(const p of P.slice(0,20)){
  const tr=document.createElement('tr');
  tr.innerHTML=`<td>${p.ranking}</td><td><span class="dot" style="background:${NIV[p.nivel]}"></span> ${p.motivo.replace(', deja sin agua a muchas personas','')}</td><td>${p.subcondado.replace(' Town Council',' TC')}</td><td class="n">${(+p.personas_afectadas).toLocaleString('es')}</td>`;
  tr.onclick=()=>{map.setView(marcas[p.ranking].getLatLng(),15);marcas[p.ranking].openPopup();};
  tablaTop.appendChild(tr);
}
</script></body></html>"""

if __name__ == "__main__":
    main()

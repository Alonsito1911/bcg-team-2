# BCG Team 2 · Priorización de bombas de agua en Kiryandongo (Uganda)

Herramienta para decidir **qué bombas de agua reparar, revisar o monitorear primero**, según cuántas personas afecta cada una. Piloto: distrito de **Kiryandongo**, donde está un asentamiento de ~165.000 refugiados y donde las comunidades vecinas dependen de bombas manuales saturadas.

Brief original del proyecto: [`proyecto_agua_uganda (1).md`](proyecto_agua_uganda%20(1).md).

## Ver los resultados (sin instalar nada)

Abre en el navegador (necesita internet para el mapa de fondo):

- **[`output/prioridad_kiryandongo.html`](output/prioridad_kiryandongo.html)**: mapa principal con el semáforo de prioridad, el top 20, la lluvia y la red LoRaWAN propuesta.
- [`data/processed/prioridad_kiryandongo.csv`](data/processed/prioridad_kiryandongo.csv): ranking completo de las 847 bombas (se abre en Excel).
- `output/mapa_*.html`: mapas de la exploración que llevó a elegir Kiryandongo.

## Reproducir todo desde cero

Solo necesitas **Python 3.9+**. No hay dependencias externas: todo usa la librería estándar.

```bash
python src/correr_todo.py                # descarga datos faltantes, corre el modelo y genera el mapa
python src/correr_todo.py --exploracion  # además regenera los mapas de exploración
```

Los datos ya descargados están versionados en `data/raw/`, así que no hace falta internet para correr el modelo. Para volver a bajarlos desde las fuentes:

```bash
python src/descargar_datos.py --todo --forzar
```

> WPDx se actualiza con el tiempo, así que una descarga nueva puede traer registros distintos. Los archivos de `data/raw/` son los que se usaron en el análisis (descargados el 16 de octubre de 2026). Una descarga desde cero ese mismo día reprodujo resultados idénticos.

## Estructura

```
src/
  correr_todo.py        Pipeline completo: datos -> modelo -> mapa
  descargar_datos.py    Baja todo data/raw/ desde las fuentes públicas
  lluvia.py             Lluvia diaria 2015-2024 por celda de ~11 km (Open-Meteo)
  prioridad.py          Modelo de prioridad (semáforo + puntaje); umbrales al inicio del archivo
  lora.py               Red LoRaWAN: gateways en torres + gateways nuevos propuestos
  mapa_prioridad.py     Genera output/prioridad_kiryandongo.html
  comun.py              Rutas y funciones compartidas
  exploracion/          Mapas usados para elegir el distrito (Bunyoro, Gulu, Mayuge, 2025)
data/
  raw/                  Datos descargados (ver Fuentes)
  processed/            Resultado del modelo
output/                 Mapas HTML
```

## El modelo (v1, por reglas)

Para cada bomba con dato 2016+ se calcula un nivel y las **personas afectadas**:

| Nivel | Regla |
|---|---|
| **Crítico** | Rota con ≥ 300 usuarios, o funciona pero a ≥ 200% de su capacidad |
| **Alto** | Rota con menos usuarios, o sobreusada (100–200%) |
| **Revisar** | Abandonada, estado contradictorio o capacidad registrada atípica |
| **Bien** | Funciona dentro de su capacidad |

- **Personas afectadas:** si está rota, sus usuarios (`served_population` de WPDx). Si está sobreusada, las personas por sobre la capacidad (300). WPDx reparte la población entre bombas sin contar a nadie dos veces, así que se pueden sumar.
- **Puntaje** = personas afectadas × factor de estación seca (1,0–1,2: las zonas con menos lluvia en diciembre–febrero pesan más).
- **Orden:** por nivel y luego por puntaje.
- Los umbrales se cambian al inicio de [`src/prioridad.py`](src/prioridad.py). El alcance LoRa (10 km) se cambia en [`src/lora.py`](src/lora.py).

**Resultado actual:** 91 bombas críticas (41.295 personas afectadas), 284 altas, 104 a revisar y 368 bien.

## Hallazgos principales

- En Kiryandongo, ~217.000 personas dependen de bombas manuales con capacidad para ~170.000. **El 46% de las bombas que funcionan fuera del asentamiento está sobreusada.**
- La presión está **alrededor del asentamiento**: en Bweyale el uso llega a ~189% de la capacidad. Dentro del asentamiento el agua viene sobre todo de sistemas motorizados con grifos, que no están en este censo.
- 2021–2022 fueron años secos, y el censo es de **febrero de 2022, en plena estación seca**.
- Con 1 torre existente + 3 gateways LoRa nuevos se cubren **89 de las 91 bombas críticas** (supuesto: alcance de 10 km).

## Demo IoT en Azure (monitoreo en vivo)

Simula sensores en las 91 bombas críticas y muestra las alertas en un mapa en vivo:
telemetría → **Azure IoT Hub** → **Azure Function** (reglas en [`src/iot/reglas.py`](src/iot/reglas.py)) → `estado.json` → mapa en un **Storage** con sitio web estático.

**Probar sin Azure:**
```bash
python src/iot/preparar_web.py
python src/iot/simulador.py --local --pausa 2
python -m http.server -d output/iot_web 8000     # abrir http://localhost:8000
```

**Desplegar desde el navegador, con Azure Cloud Shell** (no hace falta instalar nada ni iniciar sesión en el PC):
1. Entra a https://shell.azure.com y elige **Bash**.
2. Corre:
   ```bash
   git clone https://github.com/Alonsito1911/bcg-team-2.git && cd bcg-team-2
   bash azure/desplegar.sh                          # crea los recursos y muestra la URL del mapa
   pip install --user azure-iot-device
   python3 src/iot/simulador.py --azure --pausa 3   # envía la telemetría simulada
   ```
3. Abre la URL del mapa que imprimió el script.

> **En la suscripción de la hackathon** no se pueden crear grupos de recursos, el IoT Hub gratis (F1) ya está ocupado y la política "Hackathon Cost Limits" solo permite F1 o S1. Usa: `RG=SANTIAGO-team-2 HUB_SKU=S1 bash azure/desplegar.sh`. Despliegue actual: mapa en https://staguakiry27763.z1.web.core.windows.net/. **No borres el grupo `SANTIAGO-team-2`**: lo asignó la organización. Para limpiar, borra solo los recursos creados (`iot-agua-kiry-*`, `staguakiry*`, `fn-agua-kiry-*`).
4. Al terminar, borra todo con `az group delete -n rg-agua-kiryandongo --yes`.

Qué se ve: a las 12:00 simuladas, **KIR-0002 deja de bombear** (posible falla → SMS al mecánico); a las 13:00, **una lluvia enturbia 14 pozos poco profundos de Bweyale** (riesgo de contaminación → SMS al promotor de salud). El sobreuso queda como estado en el mapa, sin SMS. Los SMS se registran en los logs de la Function; el envío real (Africa's Talking o Twilio) queda por conectar.

## Fuentes de datos

| Dato | Fuente | Licencia |
|---|---|---|
| Puntos de agua (estado, población, presión, tipo, etc.) | [WPDx+](https://www.waterpointdata.org), dataset `eqje-vguj`; en Kiryandongo, principalmente el censo de The Water Trust (febrero 2022) | CC BY 4.0 |
| Límites de distritos y asentamientos | OpenStreetMap vía [Nominatim](https://nominatim.openstreetmap.org) | ODbL |
| Antenas y torres | OpenStreetMap vía [Overpass](https://overpass-api.de) | ODbL |
| Lluvia diaria 2015–2024 | [Open-Meteo](https://open-meteo.com), reanálisis ERA5 | CC BY 4.0 |

Cifras de contexto citadas en el análisis:
- Caída de 16 a 9 L/persona/día en el asentamiento (2023–2024): [UNICEF](https://www.unicef.org/uganda/stories/eu-humanitarian-aidunicef-water-systems-end-long-treks-kiryandongo-refugees).
- ~165.000 refugiados y sistemas solar-diésel de 2025: [UNICEF](https://www.unicef.org/uganda/press-releases/new-solar-hybrid-water-systems-bring-relief-165000-refugees-kiryandongo-settlement).
- 505.000 muertes por diarrea al año por agua contaminada: [OMS, 2023](https://www.who.int/news-room/fact-sheets/detail/drinking-water).
- 92,4% de contaminación fecal del agua de los hogares en Bunyoro: [UDHS 2022](https://www.ubos.org/wp-content/uploads/2024/03/UDHS-2022-Fact-Sheet.pdf).
- Estándares Sphere (15 L, 500 m, 30 min): [Sphere](https://interactive.spherestandards.org/).

## Limitaciones conocidas

- **Los datos son una foto de 2022.** No existen datos de estado más recientes para Kiryandongo.
- **WPDx subcuenta a los refugiados** (calcula ~16.000 usuarios dentro del asentamiento, contra ~165.000 reales), y el límite del asentamiento en OpenStreetMap probablemente está incompleto.
- **Los umbrales del modelo son supuestos razonables, no calibrados.** Sphere usa 250 personas por bomba; aquí se usan las 300 de WPDx.
- **Las antenas de OpenStreetMap están muy incompletas** (solo un sitio conocido dentro del distrito). Con [OpenCelliD](https://opencellid.org) (requiere clave gratuita) la cobertura real sería mayor.
- **No hay datos de calidad del agua** (E. coli) en Kiryandongo.

## Próximos pasos

1. Recomendador de presupuesto: reparaciones + sensores celulares vs. red LoRaWAN, en personas atendidas por dólar.
2. Modelo de probabilidad de falla y de riesgo de contaminación (WPDx Uganda tiene 1.506 puntos con resultado de E. coli).
3. Antenas reales con OpenCelliD.

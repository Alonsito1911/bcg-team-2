# Proyecto: Priorización de bombas de agua rurales en Uganda

Brief para Claude Code. Hackathon humanitario (área "Secure": agua y nutrición).

## 1. Problema

- En Uganda, el 52% de los hogares rurales tiene como fuente principal un pozo con bomba.
- Solo el 18% de las bombas manuales cumple a la vez caudal, confiabilidad y calidad del agua (encuesta Hidden Crisis, 2016). En el 70% de los sitios la gestión es débil.
- ~22% de los puntos de agua están fuera de servicio a los ~2 años de instalados.
- En África subsahariana, 1 de cada 4 bombas manuales está rota en cualquier momento (~175.000).
- Asentamiento de refugiados Kiryandongo (>130.000 refugiados): el agua bajó de 16 a 9 L/persona/día entre 2023 y 2024 (mínimo humanitario: 15–20 L).
- Las fallas se detectan tarde y la reparación demora (en Kenia, ~30 días sin sensores vs. ~3 días con sensores).

## 2. Alcance

- **País:** Uganda.
- **Piloto:** asentamientos de refugiados, empezando por el distrito de Kiryandongo (confirmar con los datos).
- **Extensión:** hogares rurales y comunidades vecinas.
- **Etapa 1 (este MVP):** disponibilidad (bombas rotas o sobreusadas).
- **Etapas futuras:** 2) calidad del agua (E. coli), 3) anticipación (lluvia/sequía).

## 3. Propuesta de valor

> Decirle a una ONG o gobierno dónde invertir primero: qué bombas reparar, cuáles revisar y dónde poner sensores para que cada dólar evite la mayor cantidad de días-persona sin agua.

Hoy existen piezas sueltas (WPDx prioriza por un criterio a la vez; charity: water / Virridy / Smart Handpump venden sensores por bomba; Sphere define umbrales). Nadie las junta en un puntaje único con recomendación de inversión según presupuesto.

**Usuario:** coordinador de agua de ACNUR, ONG socia u oficina distrital de agua.

## 4. Datos

### 4.1 WPDx (Water Point Data Exchange) — fuente principal
- Descarga manual desde https://www.waterpointdata.org (filtrar Uganda) → CSV. Posible API tipo Socrata en data.waterpointdata.org (no verificado).
- Fuentes de Uganda incluidas: Ministerio de Agua (2010–2015, ~105.000 registros válidos), OCHA, ONG (Lifeline, TTC Mobile).
- Campos esperados (verificar nombres reales en el CSV):
  - Ubicación: lat, lon, divisiones administrativas (hasta adm4)
  - Tipo de fuente y tecnología (pozo, vertiente, grifo; India Mark II, Afridev…)
  - Estado: funciona sí/no, fecha del reporte
  - Calidad: coliformes / E. coli (solo algunos registros)
  - WPDx+: población a 1 km, usuarios potenciales, criticidad (0–100%), presión (0–100%), antigüedad del dato
  - Posiblemente: año de instalación, gestor, si se paga, distancia a caminos/ciudades
- Advertencias: datos viejos; puede que no incluya puntos dentro de asentamientos de ACNUR.

### 4.2 Otros
- **Pump it Up (DrivenData, Tanzania):** 59.400 puntos de agua, 40 variables, etiqueta `functional / functional needs repair / non functional`. Para entrenar el modelo de falla.
- **Sphere (umbrales):** ≥15 L/persona/día; máx. 500 personas por bomba manual (WPDx usa 400); ≤500 m al punto de agua; ≤15 min de fila.
- **Opcional:** asentamientos de refugiados (portal de datos de ACNUR, Uganda), población (Meta HRSL/WorldPop), lluvia (CHIRPS), caminos (OpenStreetMap).

## 5. Sistema a construir (MVP)

### 5.1 Pipeline de datos
1. Cargar CSV de WPDx Uganda; normalizar columnas.
2. Filtrar zona piloto (Kiryandongo) y alrededores.
3. Variables derivadas:
   - `personas_sin_agua` = población_1km × criticidad, solo si está rota
   - `antiguedad_dato_dias` = hoy − fecha_reporte
   - `edad_bomba` = año_actual − año_instalación
   - `sobreuso` = presión > 100% (o usuarios > 500)
   - `riesgo_calidad` = E. coli presente o sobreuso alto
   - `dist_asentamiento_km` (si hay datos de ACNUR)

### 5.2 Modelo de probabilidad de falla
- Entrenar clasificador (p. ej. LightGBM/XGBoost/CatBoost) con Pump it Up; métrica: balanced accuracy / ROC-AUC.
- Mapear variables equivalentes a WPDx Uganda (tecnología, edad, tipo de fuente, gestión, pago, etc.) y aplicar.
- Uso: estimar P(falla) y marcar bombas "funciona" con dato viejo que probablemente fallaron.

### 5.3 Semáforo por bomba
| Nivel | Regla | Acción |
|---|---|---|
| Crítico | Rota y criticidad > 80%, o > 500 personas sin alternativa | Reparar ya |
| Alto | Funciona pero sobreusada (> 500 pers.) o E. coli presente | Reparar/ampliar/analizar |
| Revisar | Dato > 1 año o modelo predice falla | Verificar en terreno |
| Bien | Funciona, dentro de capacidad, dato reciente | Monitoreo normal |

Dentro de cada nivel, ordenar por personas afectadas. Umbrales configurables.

### 5.4 Heatmap de zonas prioritarias
- Agregar por hexágonos (H3, ~5 km) o subcondado.
- Capas: disponibilidad (personas sin agua), calidad, datos viejos.
- Superponer asentamientos de refugiados.

### 5.5 Recomendador de sensores según presupuesto
- Beneficio por bomba: `población × P(falla) × días_sin_agua_ahorrados` (supuesto inicial: 30 → 3 días por falla).
- Costo: parámetro configurable.
- Escenario A (sensor celular/satelital por bomba): greedy por beneficio/costo hasta agotar presupuesto.
- Escenario B (red LoRa: gateway compartido + sensores baratos): elegir clústeres de bombas dentro de radio de cobertura (parámetro, p. ej. 2–5 km); costo = gateway + n × sensor.
- Comparar ambos: días-persona sin agua evitados por dólar.

### 5.6 Interfaz (demo)
- Mapa (Leaflet/Folium/Kepler/Streamlit) con heatmap y puntos coloreados por semáforo.
- Slider de presupuesto → marca bombas/zonas recomendadas.
- Indicadores: bombas rotas, personas afectadas, días-persona evitados, costo.
- Mensaje tipo: "En Kiryandongo hay N bombas rotas que dejan sin agua a M personas; con X USD, sensores en estas K bombas evitan Y días-persona sin agua al año".

## 6. Mientras no esté el CSV real
Generar datos simulados de Kiryandongo (~1,9°N, 32,1°E): 100–300 bombas con mismas columnas, ~25–30% rotas, población, criticidad, presión, algunas con E. coli y fechas de reporte variadas. Mantener el pipeline idéntico para cambiar a datos reales.

## 7. Estructura sugerida
```
data/raw/          # CSV WPDx, Pump it Up
data/processed/
src/load.py        # carga y limpieza
src/features.py    # variables derivadas
src/model.py       # modelo de falla
src/priority.py    # semáforo y puntaje
src/sensors.py     # recomendador por presupuesto
src/simulate.py    # datos simulados
app/               # dashboard (Streamlit u otro)
```

## 8. Pendientes / supuestos a validar
- Confirmar nombres de columnas y cobertura de WPDx en Kiryandongo.
- ¿WPDx incluye puntos dentro de asentamientos? Si no, usar zonas rurales o datos de ACNUR.
- Tiempo real de reparación en Uganda (el 30 → 3 días es de Kenia).
- Costos reales de sensores y gateways.
- Transferibilidad del modelo Tanzania → Uganda.

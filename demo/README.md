# WaterLight · Demo interactiva

Dos dashboards:

1. **Simulación del pueblo piloto** (Kiryandongo, Uganda): pozos **A, B y C**, un semáforo con **una franja por pozo** (círculo izquierdo verde = disponible, derecho rojo = no usar), habitantes, una **guardiana de la ONG que no es del pueblo** y la red **LoRa → centro → antena/retiro manual → ONG**. El mapa se puede **alejar y arrastrar**: aparecen la región, la torre repetidora y el **edificio de la ONG**.
2. **Dashboard de la ONG** (clic en el edificio): mapa real de las 847 bombas de Kiryandongo con **isoyetas** (curvas de lluvia), ranking de prioridad, cobertura LoRa, lluvia y E. coli reales, un prototipo de modelo predictivo y el detalle de features por fase.

**Fases:** *MVP* (caja con botón + guardiana + retiro manual de datos) y *★ Estrella* (sensores automáticos, antena a la ONG, réplica entre pozos, modelo predictivo).

> ⚠ **Datos simulados.** No usar para evaluar agua real.

## Cómo ejecutar

```bash
cd demo
npm install
npm run dev            # desarrollo: http://localhost:5173
npm test               # 47 tests del motor (reglas, transporte, escenarios)
npm run build          # dist/ (servir con npm run preview)
npm run build:single   # dist-single/index.html: un solo archivo, abre con doble clic y sin internet
```

## Qué se puede hacer

- **Panel lateral:** estado rápido de cada pozo (Habilitado, Sin agua, Contaminado, Daño de válvula o Contaminación oculta); enviar a cualquier persona a cualquier pozo (o en Auto); visita semanal de la trabajadora; simular la lluvia (ventana de 15 días); Play/Pausa/Paso/Reset; velocidad 1x/2x/4x; escenarios.
- **Clic en un pozo:**
  - **Estado:** cambio rápido, caja comunitaria 👍/👎, enviar a la trabajadora a verificar o reparar, factores avanzados.
  - **Comunicación:** mini red con testigo, relevo, BLE, broker y nube; cortes de cada enlace; pérdida de paquetes o de ACK; tarjetas local / centro / nube.
  - **Historial:** log del pozo.
- **«Mostrar arquitectura de red»:** dibuja todos los enlaces sobre el mapa. Los paquetes animados aparecen solo cuando un mensaje viaja de verdad en el motor.

## Reglas clave que la demo respeta

1. El estado del pozo se **deriva** de sus factores. Un MAL de la comunidad crea **sospecha** (sin verificar), nunca «contaminado». Solo una prueba de la trabajadora confirma el resultado o devuelve el verde. El BIEN se guarda como evidencia y no habilita.
2. El semáforo usa **solo lo que el centro recibió**. Si se corta la radio, el evento queda **en cola** y el centro muestra el dato como antiguo; no se entera por magia.
3. **Replicación:** si un pozo pierde su enlace directo, el vecino lo **escucha y retransmite** (testigo). El centro deduplica por `eventId` e ignora eventos con `seq` antigua.
4. **Ruta B:** la trabajadora copia por BLE los eventos pendientes y los entrega al pasar por el centro.
5. Sin internet, el pueblo **sigue funcionando** por LoRa; solo la nube queda atrás.
6. **Lluvia:** durante 15 días, una verificación anterior a la lluvia no sirve. El sistema falla hacia el lado seguro.

## Guion de presentación (~3 min)

1. **Escenario → ★ Historia MVP** y pulsa **«Paso N/8»**, narrando con la tarjeta:
   - 1–2: todo verde; el Pozo B se contamina pero **el semáforo no cambia** (nadie lo sabe).
   - 3: Lokol va, falla y presiona MAL → la señal viaja por LoRa → **franja B roja**.
   - 4: nadie más va al B (la salida manual queda bloqueada).
   - 5–6: la **guardiana externa** confirma el B y en su ronda descubre que el C también está contaminado → franja C roja.
   - 7: todos van al Pozo A.
   - 8: **retiro manual** → «Región + ONG» → clic en la ONG → dashboard.
2. En el dashboard: mapa real de Kiryandongo, ranking de reparación, 72 % de bombas que funcionan con coliformes, lluvia, modelo de riesgo y fases.
3. **Escenario → ★★ Historia Estrella** para mostrar sensores, cola, réplica entre pozos y lluvia.
4. Preguntas técnicas: abre un pozo → **Comunicación** («Perder próximo paquete» / «Perder próximo ACK»).

## Datos reales del equipo (bcg-team-2)

El dashboard de la ONG **reutiliza** el pipeline de este mismo repo (carpeta raíz, `src/`) sin reescribirlo: `scripts/export_bcg_team2.py` importa sus módulos (`prioridad.lluvia_por_celda`, `lora.escenario`, `comun.anillos` / `categoria`) y su resultado `data/processed/prioridad_kiryandongo.csv`, y genera `src/data/kiryandongo.json` (embebido, funciona sin internet).

```bash
# si el equipo vuelve a correr su modelo:
python3 ../src/correr_todo.py
python3 scripts/export_bcg_team2.py   # actualiza src/data/kiryandongo.json
npm run build:single
```

Lo único simulado en el dashboard: el pueblo piloto A/B/C y los coeficientes del modelo de riesgo de contaminación (etapa 3 del brief).

## Estructura

- `src/domain/`: motor puro, sin React: reglas, transporte, personas, escenarios, persistencia.
- `src/components/`: escena, panel, drawer, señales y cronología. Leen el motor; no son la fuente de verdad.
- `src/assets/`: sprites SVG provisorios y manifiesto para reemplazarlos por PNG (ver `ASSETS.md`).
- `tests/`: criterios del doc 01 §12, Gherkin, y escenarios ejecutados con invariantes de seguridad de rutas.

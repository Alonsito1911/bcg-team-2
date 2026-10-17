# WaterLight · Traspaso del trabajo

Este documento reúne todo lo que se avanzó fuera del repo (demo interactiva, documentos de diseño, ilustraciones y fotos de la pizarra) para que cualquiera del equipo lo continúe desde aquí.

## Qué hay y dónde

| Ruta | Contenido |
|---|---|
| `demo/` | Demo interactiva WaterLight (React + Vite + TypeScript). Motor puro en `demo/src/domain/`, 60 tests en `demo/tests/`. |
| `demo/scripts/export_bcg_team2.py` | Reutiliza **sin reescribir** el pipeline de este repo (`src/prioridad.py`, `src/lora.py`, `src/comun.py`) y genera `demo/src/data/kiryandongo.json` para el dashboard de la ONG. |
| `docs/waterlight/solucion-monitoreo-pozos.md` | Documento técnico: lógica del semáforo, flujos de personas, arquitectura LoRa/MQTT, replicación, modelo de datos, casos borde y preguntas del jurado. |
| `docs/waterlight/01_…`, `02_…`, `03_…` | Especificaciones: reglas de negocio y simulación, UX/UI y assets, y la demo guiada multidispositivo (pendiente). |
| `docs/waterlight/img/` | Ilustraciones originales (pozos en 4 estados, semáforo, choza, paisaje, personajes y bocetos de referencia). |
| `docs/waterlight/pizarra/` | Fotos de la pizarra con la idea original. |
| `docs/waterlight/mejoras/` | Capturas de mejoras pendientes. |
| `hermess.config.json`, `.vscode/mcp.json`, `inbox/` | Configuración de Hermess (MCP) para trabajar con asistentes; comandos permitidos ajustados a este repo. |

## Cómo correr la demo

```bash
cd demo
npm ci
npm test               # 60 tests
npm run dev            # http://localhost:5173
npm run build:single   # dist-single/index.html: un solo archivo, abre con doble clic y sin internet
```

Si se vuelve a correr el modelo de prioridad (`python src/correr_todo.py`), hay que actualizar los datos de la demo:

```bash
cd demo && python3 scripts/export_bcg_team2.py && npm run build:single
```

## Qué hace hoy la demo

1. **Simulación del pueblo piloto** (Kiryandongo, ubicación ilustrativa):
   - Pozos **A, B y C** y un semáforo con una franja por pozo: verde a la izquierda (disponible), rojo a la derecha (no usar).
   - Habitantes que caminan a buscar agua y una **guardiana externa** de la ONG.
   - Red LoRa → centro → antena o retiro manual → ONG, con cola, reintentos, ACK, deduplicación y réplica entre pozos.
   - Dos fases:
     - **MVP:** la falla es silenciosa hasta que alguien la reporta con la caja; los datos llegan a la ONG por retiro manual.
     - **★ Estrella:** sensores de nivel y bomba, y antena a la ONG.
   - El mapa se puede alejar para ver la región y el edificio de la ONG.
   - Escenarios guiados: ★ Historia MVP, ★★ Historia Estrella y S0–S13 técnicos.
2. **Dashboard de la ONG** (clic en el edificio). Usa datos reales del pipeline:
   - Las 847 bombas con su nivel.
   - Isoyetas de lluvia de diciembre a febrero (ERA5).
   - El escenario LoRa: 89/91 críticas cubiertas.
   - El ranking de reparación.
   - E. coli de WPDx: el 72 % de las bombas que funcionan tenía coliformes.
   - Un prototipo de modelo de riesgo (coeficientes **simulados**) y las features por fase.

## Pendientes (por prioridad)

1. **Tab «Demo» guiada multidispositivo** (`docs/waterlight/03_DEMO_GUIADA_MULTIDISPOSITIVO.md`): el teléfono controla los pasos y el botón «Reportar contaminación» persiste un evento en un backend compartido **real**, que el notebook reproduce. Hace falta elegir backend y URL pública. Opción natural: una Azure Function HTTP + Table Storage + sitio estático propio en `SANTIAGO-team-2`, **sin tocar** el IoT Hub, la Function ni el mapa existentes.
2. **Acceso Azure:** dar rol *Contributor* en el grupo `SANTIAGO-team-2` a la cuenta del equipo que trabaja la demo (hoy su CLI entra al tenant pero ve 0 suscripciones).
3. **Conectar la demo con el Azure real** mediante un adaptador opcional (por ejemplo, publicar el reporte como telemetría al IoT Hub), sin depender de él para presentar.
4. **Ilustraciones faltantes** (hoy en SVG provisorio): guardiana, edificio de la ONG y torre repetidora. Prompts en `demo/ASSETS.md`. Se dejan en `demo/src/assets/png/` como `field-worker.webp`, `ong-building.webp` y `relay-tower.webp`.
5. Revisar en el equipo de la presentación que los íconos emoji se vean (en un navegador sin fuente de emojis aparecen como cuadros).

## Honestidad de los datos

- **Simulado:** pueblo piloto A/B/C, eventos, enlaces LoRa/MQTT de la animación, resultados de pruebas y coeficientes del modelo de riesgo.
- **Real (foto de 2022 y años 2015–2024):** bombas WPDx, límites OSM, antenas OSM, lluvia ERA5 y E. coli WPDx Uganda.

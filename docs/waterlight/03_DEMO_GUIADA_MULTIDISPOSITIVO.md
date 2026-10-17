# WaterLight — Implementación del tercer tab «Demo»: storytelling guiado, teléfono remoto y ONG

**Documento para el agente de desarrollo · Versión 1.0 · 17-10-2026**  
**Stack declarado por el equipo:** React + Vite (verificar TypeScript, router, librerías y despliegue existentes antes de cambiar código).  
**Documentos complementarios:** `01_REGLAS_NEGOCIO_Y_SIMULACION.md`, `02_UX_UI_Y_ASSETS.md` y documentación técnica/event-driven de Azure disponible en el repositorio.

> **ORDEN PARA EL AGENTE:** Implementa un **TERCER TAB denominado `Demo`** dentro de la plataforma actual. **NO reemplaces ni modifiques el comportamiento de los dos tabs existentes** (simulador libre, controles, detalles de pozos, dashboards, etc.). Este tercer tab es un recorrido narrativo y reproducible para presentar ante jueces, controlado paso a paso desde un teléfono y reproducido en el computador en tiempo real. La historia debe poder operar **sin depender de la arquitectura completa de Azure** que desarrolla otro integrante: para sincronizar dos dispositivos se requiere, sin embargo, **un servicio de datos compartido real y accesible por ambos**. No lo falsifiques con `localStorage`, botones que solo actúan localmente o animaciones sin eventos persistidos.
>
> **Acceso al repo:** Este documento se redacta a partir de los requisitos del equipo y los documentos previos; el código fuente del repositorio y la carpeta `BCG Team 2` no fueron adjuntados aquí. **Debes inspeccionarlos tú en el entorno de desarrollo**, reportar las rutas reales y adaptar estas instrucciones a los componentes existentes. No declares haberlos revisado sin hacerlo.

---

## 0. Resultado que se busca

Un presentador muestra la página en su notebook/proyector. Un segundo integrante abre **la misma aplicación publicada** en su teléfono y se une a la misma sesión de demo. En la pantalla se ve una aldea 2D ilustrada con chozas, habitantes, tres pozos y un semáforo central.

El equipo avanza los fotogramas con **flecha anterior** y **flecha siguiente** desde el teléfono. En un paso clave, un trabajador comunitario animado llega a un pozo, realiza una inspección y obtiene un **resultado de contaminación simulado y explícitamente validado**. El teléfono muestra un botón «Reportar contaminación». **Solo al pulsarlo físicamente** se genera y persiste un evento en una base de datos compartida; el notebook recibe ese evento y reproduce la pulsación, el envío de señal, el semáforo actualizado y la reacción de los habitantes. Finalmente el evento llega, a nivel de simulación, a la ONG y se ve su mapa, alerta y tablero de métricas (reutilizando `BCG Team 2` en lugar de crear un dashboard paralelo si sus componentes son compatibles).

**Dos demostraciones obligatorias:** recorrido normal y variante «corte de conexión → mensaje en cola → recuperación». La app debe decir con claridad cuáles paquetes y enlaces son **simulados** y cuál comunicación (teléfono ↔ backend ↔ notebook) es **real**.

### No negociables

1. Conservar los **dos tabs actuales**, sus rutas, simulaciones libres, controles y estilos. Agregar un tercero de modo aislado.
2. Un **único caso base** guiado, estable y reiniciable. No transformar este tab en un simulador general con decenas de configuraciones.
3. **El control del teléfono debe mover la vista del notebook real**, no una copia local. Incluir emparejamiento con identificador de sesión.
4. **No avanzar automáticamente** toda la historia. Los pasos los deciden los presentadores; solo ejecutar microanimaciones de 0,5–2 s dentro de cada paso.
5. **Un paso de espera obligatorio** donde únicamente el botón físico del teléfono «Reportar contaminación» permita continuar. No disparar el evento al cargar o hacer clic en la flecha.
6. El backend de demo **persistirá** el evento y el estado compartido; no dependerá del backend/event bus de Azure todavía en construcción.
7. Tomar del repo los componentes reales de mapas y métricas de `BCG Team 2`, integrándolos con datos ficticios del evento, **sin atribuir datos ficticios a mediciones reales**.
8. Se puede mostrar un dibujo de enlaces LoRa, gateway, MQTT y Azure, pero no afirmar que están operando físicamente cuando solo son una simulación. **El transporte real del botón móvil es internet hacia el backend temporal.**
9. Todo el diseño ilustrado anterior debe preservarse: assets de pozos, semáforo, chozas, personajes y mapa, no reemplazar por CSS de figuras geométricas.
10. La app debe seguir pudiendo compilarse, desplegarse y navegar en los tabs originales sin regresiones.

---

## 1. Primera acción obligatoria: auditar el código y la integración existente

**Antes de editar:**

- Ejecuta `git status`, revisa rama, cambios no confirmados, `package.json`, scripts, lockfile, `vite.config.*`, `tsconfig*`, `src/`, `public/`, entrypoint, rutas y componentes de tabs. No sobrescribas trabajo ajeno ni hagas un reset destructivo.
- Ubica **exactamente** los dos tabs existentes; registra nombre, componente, ruta, stores, estado global, API/hook de simulación, render de sprites, paneles, modales y estilos. Mantén su comportamiento.
- Revisa assets reales en `public/` o `src/assets/`, la resolución de rutas con `import.meta.env.BASE_URL` si se publica en subpath y qué ilustraciones ya están integradas.
- Encuentra `BCG Team 2` aunque tenga espacios, en raíz u otra carpeta. Inspecciona `package.json`, frontend, rutas, archivos de mapas, gráficas, KPIs, mock data, dependencias y APIs. Identifica qué código es reutilizable, su licencia si aplica, y los posibles conflictos de React/router/Tailwind/CSS.
- Revisa documentación de arquitectura basada en eventos / Azure incluida por el equipo (Event Grid, Service Bus, Functions, IoT Hub, Cosmos DB, SQL, etc. **solo si de verdad aparecen**); no atribuyas servicios inexistentes.
- Revisa configuración de despliegue, dominio/HTTPS, secretos, endpoints, variables `VITE_*`, BaaS/backend actualmente disponible, autenticación y CORS. Confirma que notebook y teléfono pueden abrir **una URL pública real** en navegador móvil; `localhost` del notebook no sirve en el teléfono.
- Identifica si ya existe Supabase/Firebase/Postgres u otro servicio de datos compartidos. **Prefiere reutilizar lo existente** si es viable y seguro.
- Corre `npm run build` y tests actuales antes de desarrollar, registra errores preexistentes, y vuelve a ejecutarlos después.

**Entregar un breve diagnóstico en la respuesta al usuario o archivo técnico:** rutas exactas de tabs, ubicación de `BCG Team 2`, componentes extraíbles, dependencias a reutilizar, arquitectura actual, estrategia seleccionada de sincronización y riesgos. Si `BCG Team 2` no está en el checkout, **no lo inventes**: dilo, crea interfaz/adaptador y deja indicado el punto de integración; solicita su ubicación solo si es indispensable.

### Preservación

- Prohibido reestructurar globalmente los dos tabs solo para agregar el tercero.
- Preferir componentes nuevos en un módulo autocontenido `src/features/guided-demo/` (o convención equivalente ya existente).
- No copiar el segundo frontend entero al árbol principal sin revisar dependencias, entrypoints y providers. Extraer componentes visuales o encapsular una vista del proyecto paralelo si es técnicamente más seguro.
- No tocar variables de producción de otros módulos ni credenciales de Azure existentes. Un demo backend independiente puede coexistir.
- Si ya hay un store para los casos manuales, no compartir mutaciones con el tab Demo: usar **namespace, session state, reducers y datos propios**. Salir de Demo y volver NO cambia el simulador libre.

---

## 2. Contrato narrativo: el recorrido frame por frame

**Región narrativa base:** comunidad rural ficticia en **Turkana, Kenia** (el norte de Uganda queda como extensión posterior, no mezclar datos geográficos en esta historia).  
**Escena inicial:** 1 aldea, 3 pozos (`well-1`, `well-2`, `well-3`), 1 semáforo central, 2–4 habitantes, 1 trabajador comunitario (**guardián/a del agua**; en el pitch pueden llamarlo `water guardian` o `water point caretaker`). Los tres pozos parten en **habilitado**, con verificaciones **ficticias** vigentes.

La demo se presenta **como diapositivas vivas**: cada paso tiene una cámara/encuadre, movimiento corto, título claro, narrativa opcional y un avance **controlado manualmente**. No crear video pregrabado como sustituto de la lógica.

| Frame | Título corto en pantalla | Lo que ve el público / microanimación | Disparador y condición de salida |
| --- | --- | --- | --- |
| **F0** | «Tres pozos, una comunidad» | Vista general; chozas, tres pozos en verde y semáforo verde; personas quietas con ligero bobbing | Flecha siguiente |
| **F1** | «El guardián revisa un pozo» | El guardián camina desde el pueblo a **Pozo 2** por ruta clara en 1–2 s; cámara sigue suavemente o se aproxima | Flecha siguiente cuando finaliza animación |
| **F2** | «Inspección de campo» | Zoom del Pozo 2; guardián junto a él, toma de muestra / checklist sencillo con imagen de recipiente | Flecha siguiente |
| **F3** | «Resultado de la prueba» | Tarjeta de resultados **simulados**: pH y turbidez ilustrativos + «Prueba microbiológica simulada: E. coli detectada» y «Validado por trabajador (simulado)»; estado local del pozo pasa a rojo, semáforo central todavía verde (no informado) | Flecha siguiente |
| **F4** | «Reportar a la comunidad» | Guardián con teléfono/botón grande en el zoom; notebook muestra «Esperando confirmación desde el teléfono…» | **ÚNICAMENTE botón `Reportar contaminación` en teléfono** (persistido + confirmado por backend) |
| **F5** | «Alerta registrada» | En notebook se ve el guardián pulsando botón; aparece `eventId` abreviado, estado «Evento guardado», notificación con fuente `FIELD_WORKER_SIMULATED` | Flecha siguiente; no volver a escribir evento |
| **F6** | «La señal viaja al pueblo» | Ilustrar paquete rojo de Pozo 2 → enlace LoRa simulado → receptor/semáforo. Animación de pulso sobre línea punteada | Flecha siguiente; si enlace simulado cortado: **cola** en lugar de pulso y espera de recuperación |
| **F7** | «La comunidad recibe la alerta» | Volver a vista general. Pozo 2 rojo; semáforo central pasa a **alerta roja**; etiqueta «Pozo 2 no utilizar · 2 pozos disponibles» | Flecha siguiente, después de `ACK` simulado de recepción |
| **F8** | «Las personas cambian de ruta» | Habitantes que iban al Pozo 2 se detienen y caminan 1–2 s hacia el Pozo 1 u otro habilitado; no consumen el agua afectada | Flecha siguiente |
| **F9** | «La alerta llega a coordinación» | Diagrama visual compacto: pozo / radio LoRa simulado / gateway / MQTT simulado / plataforma ONG. Un paquete viaja hacia nube; se marca cada recepción | Flecha siguiente; si hay falla de internet simulado, mostrar cola y recuperarla |
| **F10** | «La ONG recibe el evento» | Cambio de escena a mapa/dashboards de **`BCG Team 2`**, focalizado en región ficticia. Alerta «Pozo 2 contaminado», hora de recepción, estado y origen simulado | Flecha siguiente |
| **F11** | «De alerta a acción» | Panel ONG con recomendaciones operativas: verificar fuentes alternativas, evaluar suministro temporal, inspeccionar pozos cercanos, coordinar responsable | Flecha siguiente al cierre o repetir |
| **F12** | «Una señal que llega a tiempo» | Vista/resumen final: 1 pozo bloqueado, 2 habilitados, alerta recibida, habitantes redirigidos, ONG informada (todo **simulado**) | Volver al inicio / reiniciar, confirmación |

**No sobrecargar con 13 pantallas completamente diferentes.** Los frames pueden reutilizar 4 escenas visuales (`village`, `well-inspection`, `network`, `ngo`) y cambiar pequeños overlays/animaciones. El público debe sentir una **única historia continua**.

### 2.1 Transición importante F3 → F7

Distinguir rigurosamente estas tres verdades:

1. **Estado local del Pozo 2:** contaminado en la simulación porque existe una prueba ficticia confirmada.
2. **Estado conocido por el semáforo del pueblo:** todavía verde / no actualizado mientras el mensaje no llega. Puede marcarse discretamente `Última sincronización anterior` o `Información pendiente` (no afirmar que el centro conoce la contaminación antes de recibirla).
3. **Estado en sistema ONG:** todavía sin evento hasta la sincronización modelada del frame F9/F10.

El teléfono persiste un **evento de reporte** en una base de datos real de la demo; esto NO significa que un paquete LoRa haya sido físicamente transmitido. El trayecto LoRa/MQTT que sigue es una **representación pedagógica de la arquitectura futura**. Etiquetar «Radio simulada» y «MQTT simulado» en detalle técnico.

### 2.2 Cómo interpretar el semáforo central

- **Verde:** todas las fuentes conocidas están habilitadas con verificación vigente y ninguna alerta activa conocida por el centro.
- **Amarillo:** información incompleta, fuentes con problemas operacionales o sin estado sanitario suficiente; presentar números de disponibilidad.
- **Rojo:** **existe al menos una alerta sanitaria confirmada recibida**. **No significa que todos los pozos estén contaminados**. Debajo indicar inequívocamente `Pozo 2 bloqueado · Pozos 1 y 3 disponibles` si esa es la situación.
- La ruta de cada habitante depende de la **información que efectivamente recibió** (señal central / conocimiento local), no del omnisciente estado de la base.

### 2.3 Sensores, muestras y lenguaje sanitario: no inventar diagnósticos

- pH, turbidez, temperatura y conductividad son **indicadores complementarios**. No concluyen por sí solos contaminación por E. coli o fluoruro.
- Para el giro dramático de F3 presentar «**Prueba microbiológica SIMULADA: positivo para E. coli**» como evidencia ficticia registrada por el guardián; no representar que el pH detectó bacterias ni que un análisis de laboratorio se completa en 1 segundo real.
- La escena de 1–2 s es una **compresión narrativa del tiempo**, no tiempo técnico real de muestreo o cultivo. Mostrar un pequeño rótulo «Secuencia acelerada — resultado simulado».
- Una observación de olor/cambio de color sola conduce a `UNKNOWN / sospecha`, no a `CONTAMINATED`. Este caso guiado usa el **resultado de prueba simulado validado** para justificar la alerta.
- No presentar por defecto recomendaciones sanitarias de «hervir siempre»: no es solución universal frente a contaminantes químicos.

---

## 3. Controles en el teléfono, pantalla del público y misma URL

### 3.1 Una sola aplicación / dos roles

**Misma URL base y mismo despliegue.** Por ejemplo (solo ilustrativo):

```text
https://<dominio-publico>/
https://<dominio-publico>/?demoRoom=WL-7K2P&role=display
https://<dominio-publico>/?demoRoom=WL-7K2P&role=controller
```

Ambos dispositivos entran al **tercer tab Demo** con el mismo ID de sesión. Los parámetros no son contraseña: el controlador debe autenticar acciones con una clave de emparejamiento/PIN o token de sesión de corta duración, **no mostrar secretos en el proyector**. El display puede ser de solo lectura.

**Si ya hay React Router:** usar rutas existentes en vez de inventar navegación paralela; URL puede ser `/demo?room=...` según configuración, pero debe funcionar en refresh y en el hosting real. El requisito de «misma URL» significa **mismo origen y misma sesión**, no necesariamente idénticos query params.

**Emparejamiento** recomendado:

1. Desde notebook crear «Nueva sesión de presentación» o entrar a Demo → obtiene `sessionId` y código legible.
2. Mostrar QR pequeño / copiar enlace del mismo origen para que el teléfono se una. No enseñar token de edición visible en pantalla compartida.
3. Teléfono selecciona «Controlar la presentación» y valida PIN o enlace privilegiado separado.
4. Notebook se une como `display`; señal pequeña `Teléfono conectado`.
5. Si se recarga uno, ambos reconstruyen el `frameIndex`, `revision`, escena, estados derivados y evento persistido desde la base compartida.
6. En caso de reconexión perdida, mostrar `Reconectando…` y **no fingir sincronía**. Releer snapshot al reconectar.

### 3.2 UI exacta del teléfono

Un **control remoto minimalista**: gran número de frame y título opcional; dos flechas (`←` / `→`), y **un botón contextual grande** en el centro o encima de las flechas.

- Normalmente el botón contextual puede decir «Mostrar» o no estar activo. Evitar un botón extra para cada paso: **dos flechas y un botón central** bastan.
- En F4 el botón principal es **«Reportar contaminación»**, color de alerta y con feedback de pulsación: `Enviando…` → `Evento registrado ✓` solo tras confirmación del servidor.
- En F4 la flecha siguiente está **bloqueada** hasta que el backend confirme el reporte y llegue el cambio de sesión. Indicar claramente por qué, sin bloquear la flecha anterior.
- En F0 el botón central puede ser «Iniciar recorrido», equivalente a siguiente; en F12 «Reiniciar» con confirmación. No introducir más acciones obligatorias.
- El botón debe ser grande, apto para dedo; las flechas deben mostrar `Anterior` y `Siguiente` también accesibles a lector de pantalla.
- Un único operador controla la sesión activa; otros móviles pueden entrar como `display` o pedir relevo de control de forma explícita.
- Incluir un pequeño indicador `Conectado`, `Enviando`, `Sin conexión` en el control, sin distraer.

### 3.3 UI exacta del computador/proyector

- Modo **presentación**: la escena en gran tamaño, título del frame, pequeño indicador `Paso 4/13` y una frase narrativa (máximo 1–2 líneas).
- Ocultar controles de edición, sliders del simulador libre, debug y paneles de administración; mostrar estado de conexión discreto.
- El notebook reacciona a eventos persistidos emitidos desde el móvil y **no necesita que alguien haga clic allí**.
- Modo **respaldo local** para ensayo si el teléfono falla, activado intencionalmente por control de presentador; mostrar etiqueta «Modo ensayo» y **no venderlo como sincronización multidispositivo**.
- Acceso opcional a `Detalles técnicos` en un drawer que explique el último evento (`event_id`, origen, estado cola, ACK), cerrado por defecto.

---

## 4. Arquitectura real mínima para sincronizar teléfono y notebook, independiente de Azure

### 4.1 Separar el plano REAL del plano SIMULADO

```text
                PLANO REAL (obligatorio)
Teléfono (botón) ── HTTPS ──> BD / API de demo compartida
     ^                                  │
     │                           commit de evento
     │                                  │ realtime/poll
     └──────── estado compartido <──── Notebook (React Demo)

               PLANO SIMULADO (storytelling visual)
Guardián → Pozo 2 local → LoRa P2P → semáforo → gateway → MQTT → ONG
                    cola / pérdida / ACK / reintentos
```

**No mezclarlos:** la conexión real teléfono ↔ backend puede estar perfecta mientras el «LoRa del pozo» está representado como cortado. Eso permite enseñar la falla sin que la presentación se desconecte. El backend de sincronización NO es evidencia de que MQTT/LoRa reales funcionen.

### 4.2 Servicio mínimo propuesto

**Preferencia condicionada al diagnóstico del repo:**

- Si ya tienen Supabase habilitado: **Postgres + Realtime + Edge Function/RPC** con autorización. Es una opción pragmática para construir rápido sin Azure. No usar `service_role` en Vite.
- Si ya hay Firebase: Firestore + listeners en vivo + reglas de seguridad equivalentes, sin introducir Supabase adicional.
- Si existe una API propia pequeña fiable y desplegada separada del backend complejo de Azure: endpoint `POST /demo/command`, estado en BD duradera y canal websocket/SSE (o polling fallback).
- Si no hay nada: agregar un **mínimo backend aislado** en servicio accesible vía HTTPS con DB persistente. No inventar comunicación sin un punto compartido. Comparar horas de implementación y elegir el camino más simple seguro.
- **Nunca** confiar solo en `BroadcastChannel`, `localStorage` o estado React: solo sincronizan un origen/dispositivo de forma local, no teléfono y notebook por internet.

Para este hackathon no necesitan desplegar IoT Hub, Event Grid, Service Bus, un cluster de MQTT o hardware LoRa físico para cumplir la **demo narrativa**. Mantener un adaptador futuro (`AzureEventAdapter`) separado de `DemoBackendAdapter`.

### 4.3 Modelo mínimo de persistencia

Se sugiere (adaptar al esquema existente, no duplicar tablas si ya hay otras equivalentes):

```sql
-- Ejemplo conceptual, migrar según stack/repositorio y reglas de seguridad
create table demo_sessions (
  id uuid primary key,
  room_code text unique not null,
  scene_epoch integer not null default 1,
  frame_index integer not null default 0,
  revision bigint not null default 0,
  mode text not null default 'NORMAL',       -- NORMAL | LINK_FAILURE
  lifecycle text not null default 'READY',   -- READY | PLAYING | AWAITING_REPORT | CLOSED
  contamination_reported boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table demo_commands (
  id uuid primary key,
  session_id uuid not null references demo_sessions(id),
  epoch integer not null,
  expected_revision bigint,
  command_type text not null,
  payload jsonb not null default '{}'::jsonb,
  actor_id text not null,
  created_at timestamptz not null default now(),
  unique(session_id,id)
);

create table demo_events (
  id uuid primary key,
  session_id uuid not null references demo_sessions(id),
  epoch integer not null,
  source_command_id uuid references demo_commands(id),
  event_type text not null,
  well_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(session_id,source_command_id,event_type)
);
```

**Nota:** el DDL es un ejemplo de contrato, no reemplaza las migraciones ni la seguridad. En Postgres, implementar una **operación transaccional de servidor** que valide el paso/revisión y aplique comando + evento + snapshot. El frontend público no debe poder editar libremente `demo_sessions` o insertar cualquier evento de contaminación mediante credenciales anónimas.

Campos útiles adicionales si la implementación lo requiere: `controller_id`, `controller_lease_until`, `last_heartbeat`, `simulation_network_state`, `last_applied_event_id`, `village_seen_event_id`, `ngo_seen_event_id`, `last_event_ack`, `schema_version`.

### 4.4 Comandos, eventos, proyecciones

**Comandos iniciados por el teléfono:**

```ts
type DemoCommand =
  | { type: 'NEXT_FRAME'; commandId: string; expectedRevision: number }
  | { type: 'PREVIOUS_FRAME'; commandId: string; expectedRevision: number }
  | { type: 'REPORT_CONTAMINATION'; commandId: string; wellId: 'well-2'; expectedRevision: number }
  | { type: 'RESET_STORY'; commandId: string; expectedRevision: number }
  | { type: 'SET_FAILURE_MODE'; commandId: string; enabled: boolean; expectedRevision: number }
  | { type: 'RESTORE_SIMULATED_LINK'; commandId: string; expectedRevision: number };
```

**Eventos de dominio narrativos importantes:**

```ts
GUARDIAN_ARRIVED
SAMPLE_TAKEN_SIMULATED
TEST_RESULT_VALIDATED_SIMULATED
CONTAMINATION_REPORT_ACCEPTED
WELL_LOCAL_STATUS_UPDATED
SIMULATED_PACKET_QUEUED
SIMULATED_PACKET_SENT
SIMULATED_PACKET_RECEIVED_BY_VILLAGE
SEMAPHORE_UPDATED
VILLAGER_REROUTED
SIMULATED_GATEWAY_FORWARDED
SIMULATED_MQTT_PUBLISHED
NGO_ALERT_RECEIVED
SIMULATED_RESPONSE_RECOMMENDED
```

La animación debe responder a **transiciones aprobadas del estado compartido**. El evento real `CONTAMINATION_REPORT_ACCEPTED` se escribe **solo después de la pulsación del teléfono**. La llegada al semáforo y la ONG son **proyecciones virtuales** calculadas en pasos posteriores; mantenerlas separadas de la fila persistida que acredita la pulsación.

### 4.5 Operación remota: atomicidad, orden y reconexión

Implementar `dispatchDemoCommand(command)` en backend/función que:

1. Verifica credenciales/permiso de operador (PIN canjeado por token o sesión autenticada de presentador; no confiar en `role=controller` como autorización).
2. Busca sesión y compara `scene_epoch` y `expectedRevision` para evitar dos teléfonos avanzando simultáneamente o eventos viejos tras reset.
3. Valida una transición legal de la state machine (e.g. solo `REPORT_CONTAMINATION` en F4, una sola vez en ese epoch).
4. Inserta comando y el/los eventos nuevos con `commandId` idempotente.
5. Actualiza el snapshot (`frame_index`, `revision`, `lifecycle`, flags) **en la misma transacción**.
6. Devuelve snapshot actualizado. Publica o habilita escucha realtime sobre ese snapshot/eventos confirmados.
7. Si el cliente no recibe respuesta por corte, puede reintentar con **el mismo commandId** y recibir mismo resultado lógico; no duplicar la alerta.
8. Si hay conflicto de `revision`, responder estado nuevo, refrescar ambos clientes y no fabricar un estado intermedio.

En notebook: al cargar → GET snapshot + eventos; suscribirse a cambios; al evento/reconexión **refetch** y reconstruir; ignorar revisiones antiguas; animaciones deterministas por `frameIndex`/`revision` y claves para no repetir bucles por reconexión.

**Fallback de transportes para la sincronización real:** websocket/realtime preferido; si no está disponible, usar polling corto configurable (por ejemplo 1 s en la presentación). El polling es aceptable como respaldo, no anunciar «instantáneo garantizado». Latencia objetivo de UX: habitualmente menor a ~1 s con buena red; **objetivo de diseño, no garantía**.

### 4.6 Seguridad mínima adecuada al hackathon

- TLS/HTTPS público. No exponer `service_role`, credenciales de admin, secretos de Azure ni API keys privadas a Vite.
- Separar permiso `display/read` de permiso `controller/command`; un ID de sala visible no autoriza escritura.
- Limitar vida de las salas, rate limit comandos, tokens de corta duración, revocación del control al cerrar demo, y asegurar consultas por sesión (RLS o validaciones de API).
- Datos solo sintéticos, sin nombres reales, geolocalización personal ni resultados sanitarios reales. La región de Turkana en la narrativa es contextual; puntos exactos ficticios se rotulan.
- El PIN o enlace secreto del controlador **no** debe figurar en QR público del proyector si ese QR es para espectadores.
- Limitar sesiones/demo DB para controlar costos. Fijar políticas de limpieza una vez finalizado hackathon.

---

## 5. State machine de Demo: flechas, disparador físico, atrás, reset

### 5.1 Definir estado explícito

```ts
type GuidedScene = 'VILLAGE' | 'WELL_INSPECTION' | 'NETWORK' | 'NGO';
type DemoStage = 0|1|2|3|4|5|6|7|8|9|10|11|12;
type GuidedDemoState = {
  sessionId: string;
  epoch: number;
  revision: number;
  frameIndex: DemoStage;
  scenario: 'NORMAL' | 'LINK_FAILURE';
  awaitingPhoneReport: boolean;
  contaminationReported: boolean;
  well2LocalState: 'ENABLED' | 'CONTAMINATED';
  villageKnownWell2: 'ENABLED' | 'CONTAMINATED';
  ngoKnownWell2: 'ENABLED' | 'CONTAMINATED';
  simulatedLoRaAvailable: boolean;
  simulatedCloudAvailable: boolean;
  eventId?: string;
  outbox: Array<{eventId:string; status:'QUEUED'|'SENT'|'ACKED'}>;
};
```

**Regla crítica:** `frameIndex` no debe convertirse en la única fuente de verdad de si la alerta se registró, si llegó al centro o a ONG. Mantener flags/proyecciones y `eventId` consistentes, calculados desde comandos/eventos persistidos.

### 5.2 Comportamiento de botones

- `NEXT_FRAME`: avanza exactamente 1 frame, excepto que F4 espera `REPORT_CONTAMINATION` o que un frame de entrega requiere resolver la cola de falla simulada. No usar autoplay.
- `PREVIOUS_FRAME`: vuelve exactamente 1 frame para explicar de nuevo. **No borra ni «despublica» un reporte real ya persistido**. Si se vuelve antes de F4 tras confirmar, se puede mostrar reconstitución visual del pasado («replay visual») sin duplicar efectos secundarios. Incluir una pequeña marca «Reproducción de paso anterior» si es necesario.
- `REPORT_CONTAMINATION`: en F4, crea **una sola vez** `CONTAMINATION_REPORT_ACCEPTED`; al confirmarse, mover a F5 o habilitar F5 de forma automática (decisión consistente). El notebook dibuja click físico animado **solo después de recibir la confirmación real**.
- `RESET_STORY`: pedir confirmación (salvo botón de ensayo controlado), incrementar `scene_epoch`, volver a F0 y limpiar proyecciones/colas de **ese escenario**; conservar el historial técnico antiguo si se requiere auditoría, pero no mezclar eventos de epochs anteriores.
- `SET_FAILURE_MODE`: elegir antes de iniciar o desde menú técnico cerrado; no permitir que cambie involuntariamente en mitad del recorrido. Para el modo falla, una sola decisión `LoRa simulado desconectado` basta.

**No bloquear `PREVIOUS_FRAME` por animaciones**, pero cancelar limpiamente la animación vieja al cambiar de frame; nunca dejar un pulso de una etapa anterior cruzando el mapa nuevo.

### 5.3 Comportamiento al recargar

- Si el notebook se recarga en F6 con evento reportado, carga el **mismo F6**, sin saltar al final ni borrar alerta.
- Si teléfono se reinicia y reingresa, lee `frameIndex` y el estado autorizado; jamás supone F0 por estado local.
- Si hay varias pestañas del notebook, todas pueden mirar, pero solo hay un operador controlando la sala; ignorar comandos obsoletos por revisión.
- Si hay pérdida real de internet en el teléfono, **no confirmar que la alerta se guardó**. Deshabilitar/poner pendiente, reintentar con idempotencia al reconectar y decir si está sin enviar.

---

## 6. Mini demo opcional de FALLA de señal durante el storytelling

El recorrido principal muestra éxito. Debe existir **un switch secundario en configuración avanzada `Simular falla LoRa`**, seleccionable al crear/reiniciar sesión. No sumar un control grande que tape el mapa.

**Variante de falla:**

1. F0–F5 idénticos: las pruebas y el **evento de reporte real** se guardan en la BD compartida; teléfono/notebook siguen coordinados por internet.
2. En F6 el **enlace LoRa representado en la animación está cortado**: **no dibujar un pulso que mágicamente llega al centro**. Mostrar icono de corte y tarjeta pequeña `Evento #xxx en cola del pozo`.
3. Mientras el enlace está caído, semáforo central mantiene **estado anteriormente conocido**; no mostrar cambio rojo como si hubiera recibido señal. Una marca «Información del centro desactualizada» explica el riesgo.
4. Presentador pulsa el **botón contextual** `Restablecer enlace (simulado)` en el teléfono; no cambiar de panel de control. Esta acción cambia flag compartido y dispara nueva microanimación de `cola → retransmisión → ACK`.
5. Solo tras entrega simulada permitir el paso del cambio de semáforo; continuar F7–F12 con normalidad.
6. Añadir en detalle técnico `Evento persistido`, `Intentos`, `ACK pendiente/recibido` y la distinción entre internet real y LoRa simulado.

Si quieren simular falla `gateway → nube` en lugar de LoRa, configurar **solo uno de los dos tipos** por presentación para evitar complejidad: semáforo se actualiza en F7, ONG espera cola hasta recuperación. No mezclar ambas fallas en la demo base.

**Caso de prueba fundamental:** una BD que sabe que el Pozo 2 está contaminado no implica que el pueblo lo sabe. El avance visual respeta `villageKnownWell2` y `ngoKnownWell2` por separado.

---

## 7. UX/UI del recorrido: conservar ilustraciones y aprovechar componentes React

### 7.1 Estilo

Mantener `02_UX_UI_Y_ASSETS.md`: mapa 2D acuarela/dibujo a mano, bordes oscuros, arena/terracota, árboles/chozas, semáforo central, **tres pozos exactamente**, mujeres/niños estilizados con respeto, sin saturar el mapa. El usuario debe identificar una escena en 2 segundos.

**Utilizar assets de imagen reales, no construir pozos/personas/chozas únicamente con CSS.** CSS/Tailwind para layout, animación leve y overlays; SVG para senderos y pulsos; React para estado, componentes, datos y navegación. Las imágenes sirven de capas recortadas individuales, no usar una sola captura de un panel como app funcional.

Assets ilustrados generados previamente que el equipo puede proporcionar o importar si ya están en el repo (verificar rutas reales):

```text
sunny_african_village_landscape.png                 -> fondo 16:9
cartoon_water_well_with_bucket.png                 -> pozo sano
rustic_stone_well_with_bucket.png                  -> pozo con poco volumen
contaminated_muddy_water_well.png                  -> pozo contaminado (arte ilustrativo, no método diagnóstico)
broken_village_well_illustration.png                -> daño de válvula/mecanismo
watercolor_traffic_light_tower_with_stone_base.png -> semáforo central
watercolor_african_mud_hut_asset.png               -> choza individual
water_carrier_villager_character.png               -> mujer A
water_carrier_in_patterned_dress.png               -> mujer B
smiling_child_in_teal_outfit.png                   -> niño/a
```

**Si los assets no están en el repositorio**, revisar la entrega anterior o solicitar al usuario dichos archivos. Si tienes generador de imágenes habilitado, puedes recrear assets faltantes del mismo estilo. **Si no puedes generar imágenes, avisa exactamente cuáles faltan antes de reemplazarlos por CSS y declara cualquier placeholder usado en desarrollo**.

### 7.2 Composición por escenas

**Scene `VILLAGE` (F0, F1, F7, F8, F12):** fondo a pantalla grande; 3 pozos alrededor; 3–5 chozas cerca de semáforo; personajes de tamaño proporcionado; un área contextual pequeña en borde superior. F1 personaje se mueve (posición interpolada + bobbing) hacia pozo 2 en **máximo ~2 segundos**. F7 semáforo enciende rojo (lámpara única activa) y cartel explicativo. F8 mostrar flecha de redirección a pozo seguro.

**Scene `WELL_INSPECTION` (F2–F5):** zoom/corte suave al pozo 2 con ilustración grande; personaje al costado; una tarjeta pequeña de inspección y una lámina/imagen de recipiente de muestra. En F3 desplegar resultados ficticios; F4 overlay «En espera del teléfono»; F5 hacer pequeña animación de pulgar/ondas sobre el smartphone en manos del guardián, sin necesidad de sprite complejo.

**Scene `NETWORK` (F6/F9 o drawer técnico):** mantener la estética del juego en una banda/diagrama React con ilustraciones del pozo, antena/radio, semáforo, gateway, nube, ONG; usar SVG strokes/pulsos para mostrar **evento en tránsito**. No cubrir todo con un diagrama SaaS técnico salvo en la modalidad opcional «ver arquitectura».

**Scene `NGO` (F10/F11):** reutilizar mapa/dashboard `BCG Team 2`. Mostrar una alerta focal y 2–4 KPI legibles, en lugar de muchos gráficos minúsculos. El operador debe poder volver con flecha a F9 sin perder el evento real.

### 7.3 Microanimaciones aceptables

- Movimiento de guardián: `transform: translate(x,y)` + `translateY(-3px)` leve tipo bobbing; movimiento corto y reproducible; no requiere 8 frames de caminata.
- Zoom del pozo: transición de cámara de 250–600 ms o crossfade entre escena de aldea y primer plano, sin mareos.
- Muestra: breve brillo o tarjeta que aparece; nada de simular experimentos imposibles.
- Reporte móvil: pulso sobre ilustración del teléfono cuando llega evento real; glow corto y `eventId` visible solo en detalle.
- LoRa: un punto/onda que atraviesa línea punteada **solo si enlace disponible**; si no, icono de cola y bloqueo.
- Semáforo: cambiar una luz a la vez, con lámparas apagadas para las restantes, e incluir texto. No mostrar tres lámparas iluminadas simultáneamente.
- ONG: alerta toast legible y highlight sobre mapa/carta del pozo; animación suave, no pantalla llena de gráficos.

**Respeta `prefers-reduced-motion`** con alternativas sin traslaciones. Animaciones se cancelan al cambiar `frameIndex`; no temporizadores huérfanos ni carreras de estado.

### 7.4 Componentes recomendados (adaptar si ya hay librerías equivalentes)

```text
src/features/guided-demo/
  GuidedDemoTab.tsx              # entrada del tercer tab
  GuidedDemoStage.tsx            # renderer por frame
  GuidedDemoRemote.tsx           # controles móviles
  GuidedDemoDisplay.tsx          # pantalla notebook/proyector
  GuidedDemoProvider.tsx         # sesión, snapshot y suscripción
  data/storyFrames.ts            # frame metadata y narrativa
  domain/demoStateMachine.ts     # transiciones puras, guards
  domain/storyProjection.ts      # well-local vs village vs NGO
  api/demoBackendAdapter.ts      # interfaz de backend temporal
  api/demoRealtimeClient.ts      # subscribe / polling / reconnect
  api/azureEventAdapter.ts       # futuro, NO requerido para esta demo
  components/VillageScene.tsx
  components/WellInspectionScene.tsx
  components/SignalFlowScene.tsx
  components/NGOScene.tsx
  components/AnimatedGuardian.tsx
  components/Semaphore.tsx
  components/WellStatus.tsx
  components/PhoneReportAction.tsx
  components/SceneTitle.tsx
  components/RemoteControls.tsx
  components/ConnectionStatus.tsx
  components/ArchitectureDrawer.tsx
  __tests__/demoStateMachine.test.ts
  __tests__/demoCommands.test.ts
  __tests__/demoSync.test.ts
```

No es obligatorio crear todas estas carpetas si ya existen componentes reutilizables. Importa más mantener la **separación de dominio, presentación, backend y adaptadores** que una lista exacta de nombres.

React con Vite significa componentes reales, manejo de estados y lifecycle, eventos y animaciones declarativas. Usar componentes de librería actual para botón, modal/drawer, tarjetas y tabs. No construir el tercer tab como HTML estático insertado en un `iframe` sin sincronización de estado. No introducir Framer Motion/GSAP solo por estética si CSS transitions y `requestAnimationFrame` o librerías existentes bastan.

---

## 8. Integrar `BCG Team 2` para que la ONG reciba y vea la alerta

La carpeta `BCG Team 2` contiene trabajo de otro integrante con dashboard, mapas y métricas que quiere usar la ONG. **Es obligación inspeccionar su código** y aprovecharlo en F10/F11.

### Procedimiento seguro

1. Identificar mapa base, librería GIS usada, cards KPI, charts, componentes filtrables, fuente de datos y contratos.
2. Comparar versiones de React, Vite, TS/JS, CSS, Tailwind, librerías de mapas y charts; evitar tener dos routers/bundlers sobre la misma página por accidente.
3. Extraer componentes visuales React reutilizables en un adaptador/página dentro del tercer tab cuando sea viable. Si `BCG Team 2` es una app separada, crear **wrapper explícito**, adaptar sus fuentes de datos y documentar la estrategia; no reescribir todo si no hace falta.
4. Definir `NGOAlertViewModel` alimentado por el evento del **mismo `sessionId`, `epoch` y `eventId`** proveniente de la BD compartida. No generar un dato independiente artificial en el dashboard.
5. Mostrar la transición antes/después: F0 la ONG no tiene alerta; F10 tiene alerta asociada al Pozo 2; F11 muestra tareas sugeridas. Si cambian de frame hacia atrás, es un **replay visual** del momento anterior, no borrado de la alerta persistida.
6. **Evitar usar localizaciones reales precisas de fuentes sin permiso**. Para mapa poner «Turkana — ubicación ilustrativa» si son coordenadas de ejemplo.
7. Datos de consumo, población, reservas, kilómetros, litros, stock y costos solo si están configurados como **simulados** y derivados de supuestos visibles. No inventar víctimas, brotes, capacidad logística, demanda ni impactos medidos.
8. En el frame NGO colocar máximo un mapa claro, una tarjeta de alerta y 2–4 números/estados relevantes; posibilidad de expandir métricas originales del equipo en un drawer/pestaña técnica **sin romper sus dashboards existentes**.

### Contrato mínimo

```ts
type NGOAlertViewModel = {
  id: string;
  sessionId: string;
  wellId: 'well-2';
  placeLabel: 'Turkana — ubicación de demostración';
  status: 'CONTAMINATED';
  severity: 'HIGH';
  source: 'SIMULATED_VERIFIED_FIELD_TEST';
  reportedAt: string;           // tiempo real guardado en servidor
  villageNotified: boolean;     // después F7, no después F5
  ngoReceived: boolean;         // después F10, no antes
  usableWellsKnownToVillage: number;
  recommendations: string[];    // acciones sugeridas, NO órdenes automatizadas
};
```

**Recomendaciones operativas que sí se pueden demostrar:** priorizar visita/verificación, confirmar disponibilidad en Pozo 1/3, organizar distribución temporal **si la demanda supera la oferta** (condición no asumida), pedir reposición de suministro y asignar equipo de inspección. NO afirmar «se necesitan X camiones» sin datos de demanda, capacidad y logística.

---

## 9. Futuros adaptadores Azure sin bloquear la demo

Actualmente se está desarrollando en paralelo una arquitectura de eventos en Azure. Este tab **no debe requerir Azure** para ejecutar el storytelling ante los jueces.

**Contrato futuro de dominio** (no inventar servicio específico sin leer `.md` de Azure):

```ts
interface WaterEventSink {
  publish(event: {
    eventId: string;
    eventType: 'CONTAMINATION_CONFIRMED';
    wellId: string;
    simulated: boolean;
    occurredAt: string;
    payload: Record<string, unknown>;
  }): Promise<{accepted: boolean; correlationId?: string}>;
}
```

- `DemoEventSink`: persiste en DB de demo, actualiza sesión en vivo y activa la visualización.
- `AzureEventSink`: integración futura **deshabilitada por defecto**; mapear a la documentación real de Azure después de analizarla.
- La UX debe estar desacoplada: no llamar funciones Azure directamente dentro de `VillageScene` o `PhoneReportAction`.
- La presentación debe funcionar incluso si Azure no se desplegó o está caído. El panel puede explicar «Arquitectura real en desarrollo / simulada en este recorrido».

---

## 10. Casos específicos de falla, error y repetición que deben soportarse

| Caso | Resultado esperado |
| --- | --- |
| Notebook y teléfono abren misma sesión desde la URL publicada | Ambos muestran el mismo frame y revision; el móvil controla, notebook presenta |
| Teléfono F0 pulsa → | Notebook pasa a F1; guardián llega al pozo en 1–2 s |
| Notebook F4 esperando y móvil aún no pulsa | No se crea evento, no aparece pulso, no cambia semáforo |
| Teléfono F4 pulsa «Reportar contaminación» | Backend valida y persiste; notebook pasa a F5 con animación de pulsación real |
| Usuario toca doble el botón | Un solo evento lógico mediante `commandId` e idempotencia |
| Notebook refresca luego de pulsación | Evento sigue en BD y estado se reconstruye sin duplicar alerta |
| Teléfono refresca en F7 | Recupera F7 y control; no vuelve a F0 |
| Teléfono presiona atrás desde F10 | Regresa visualmente a F9; el reporte **sigue persistido** y no se emite de nuevo |
| Móvil pierde internet al pulsar | UI no dice «enviado»; reintento o aviso; ninguna confirmación falsa |
| Websocket desconectado temporalmente | Cliente realiza reconexión + refetch/polling; no se queda con estado divergente silencioso |
| LoRa **simulado** cortado en F6 | Outbox pendiente, semáforo aún desactualizado; recuperar enlace libera pulso y ACK |
| Internet **simulado** del gateway cortado | El semáforo sí se actualiza si LoRa llegó, pero ONG no hasta sincronización |
| Dos controladores avanzan al mismo tiempo | Lease/permisos y revision impiden saltos múltiples; segundo obtiene estado actualizado |
| Dos pulsaciones concurrentes del reporte | A lo sumo un evento `CONTAMINATION_REPORT_ACCEPTED` por epoch/pozo |
| Nuevo reset durante mensaje en vuelo | `scene_epoch` sube, se cancelan timers y mensajes de epoch viejo no contaminan nuevo escenario |
| Entrar al simulador libre y volver | No se alteran sus estados, ni Demo adopta mutaciones manuales de ese tab |
| `BCG Team 2` no está disponible | No crashear Demo; mostrar adaptador/placeholder honesto, documentar bloqueo pendiente |
| Falta PNG de un personaje | Se declara faltante y se reutiliza temporalmente otro sprite coherente sin inventar que está listo |
| Proyector 1366x768 / móvil estrecho | UI no se corta ni exige hover; controles legibles y escena correctamente encuadrada |
| Usuario pide «qué pasó con el agua» | Panel distingue pH/turbidez complementarios de **prueba microbiológica positiva simulada** |

---

## 11. Pruebas automatizadas y verificación manual

### Unit tests de negocio

- `getFrameScene(F0)` devuelve `VILLAGE`; `F2` devuelve `WELL_INSPECTION`; `F10` devuelve `NGO`.
- `canNext(F4)` es `false` si no existe reporte aceptado; `REPORT_CONTAMINATION` en otro paso se rechaza.
- Reportar contaminación dos veces con mismo comando o dos comandos simultáneos produce **un solo evento lógico**.
- El estado local cambia en F3, pero `villageKnownWell2` no cambia hasta F7 y `ngoKnownWell2` no cambia hasta F10.
- Con LoRa cortado, F6 no libera entrega/ACK; al restablecer, entrega ocurre exactamente una vez a nivel lógico.
- `PREVIOUS_FRAME` no borra `demo_events`; reset incrementa epoch y evita eventos viejos.
- Derivación de semáforo rojo por alerta conocida no elimina disponibilidad individual de los dos pozos sanos.

### Integración (ideal Playwright en dos contextos browser)

1. Abrir la **misma URL pública** en dos contextos (notebook display / móvil controller).
2. Emparejar, avanzar F0→F1→F2→F3→F4 con botones móviles y constatar cambio visible en display.
3. Confirmar que la DB no tiene `CONTAMINATION_REPORT_ACCEPTED` antes de F4 click.
4. Pulsar botón desde móvil y verificar evento persistido, misma revision, feedback e imagen de pulsación en notebook.
5. Avanzar F6→F7, semáforo rojo y 2 pozos verdes, después F8 redirección; F10 panel ONG tiene alerta con **mismo `eventId`**.
6. Desconectar/reconectar websocket, recargar ambos; confirmar restauración de estado.
7. Iniciar nueva sesión en modo falla; verificar cola, recuperación y no recepción prematura.
8. Visitar tabs originales; ejecutar su flujo de simulación y confirmar que no se modificaron por Demo.
9. `npm run build`, lint y tests del repo: **todo verde** o errores previos claramente documentados.

### Ensayo físico antes de presentar

- Un notebook y un teléfono **distintos**, ambos con internet y mismo dominio HTTPS.
- Abrir sesión mediante QR/enlace. Probar remoto a 1–2 metros del notebook (no depender de LAN local).
- Poner notebook en proyector y confirmar legibilidad de etiquetas a varios metros.
- Mostrar una vez el corte LoRa **solo simulado** y recuperación.
- Reiniciar y dejar F0 listo 5 minutos antes del pitch.
- Si internet público es inestable, preparar un **plan B honesto**: hotspot disponible para la BD de demo; un replay local puede servir de respaldo, pero no promocionarlo como conexión remota real.

---

## 12. Orden recomendado de implementación (prioridad hackathon)

**Fase A — Auditoría + no regresión.** Inventario real del repo, tabs, asset paths, dependencia de la carpeta `BCG Team 2`, pruebas de build antes de editar.

**Fase B — Sincronización real.** Crear sesión, dos roles, persistencia transaccional, listeners y control remoto de flechas; validar con dos navegadores **antes de crear animaciones**.

**Fase C — Historia base.** Frames F0–F5 y botón físico de reporte, eventos idempotentes. Es el hito más importante.

**Fase D — Propagación simulada.** F6–F9, semáforo, redirección y arquitectura de mensajes, incluyendo modo falla con cola/ACK.

**Fase E — ONG.** Adaptar componentes `BCG Team 2` y mapear el mismo evento a alerta y KPIs.

**Fase F — Calidad visual + ensayos.** 2D assets, microanimaciones, control móvil, responsive, prueba real notebook↔teléfono, regresiones y captura de evidencia.

### Prioridad si faltan horas

1. Sincronización real y botón de teléfono.
2. F0→F7 comprensible y semáforo coherente.
3. ONG mostrando evento real de BD.
4. F8 rutas de personas.
5. Simulación de fallas y mejoras visuales secundarias.

No sacrificar el punto 1 para conseguir animaciones más vistosas.

---

## 13. Criterios finales de aceptación para declarar el trabajo listo

- [ ] El tercer tab se llama **Demo** y los dos tabs anteriores están intactos.
- [ ] El caso base se reinicia con tres pozos habilitados y semáforo verde.
- [ ] La ruta del guardián al Pozo 2 dura máximo ~2 s.
- [ ] Existe zoom/inspección y resultado positivo **simulado** explicado con rigor.
- [ ] Antes de tocar el móvil no se registra ni emite evento de reporte.
- [ ] El **botón de teléfono** escribe evento en **BD real compartida** y actualiza el computador sin clic local.
- [ ] Flechas del móvil controlan adelante/atrás y el notebook reacciona; F4 exige reportar.
- [ ] El estado del pozo, el semáforo y la ONG se actualizan en **momentos separados** de acuerdo con su recepción de información.
- [ ] El semáforo rojo identifica al Pozo 2; no afirma que los tres son peligrosos.
- [ ] Las personas se redirigen a otro pozo habilitado y el movimiento es breve.
- [ ] Se visualiza transporte LoRa/MQTT como **simulado**, sin confundirlo con el transporte real por backend.
- [ ] Modo falla: cola, restauración, ACK y alerta final sin entrega mágica.
- [ ] ONG incorpora mapa/dashboard de `BCG Team 2` donde sea compatible y usa el **mismo evento**.
- [ ] Se ven recomendaciones operativas prudentes y métricas rotuladas como ficticias.
- [ ] No se muestran credenciales en Vite ni permisos de escritura abiertos en la DB.
- [ ] Reset, back, reload y dos dispositivos no generan eventos duplicados ni frames incoherentes.
- [ ] `npm run build` y pruebas esenciales funcionan; las versiones originales se mantienen.
- [ ] El agente informa **rutas verificadas del código**, qué reutilizó de `BCG Team 2`, qué backend independiente eligió, variables de entorno y despliegue exacto.

---

## 14. Instrucción final al agente

**Lee primero este documento y los dos Markdown anteriores, luego inspecciona el repositorio real y `BCG Team 2`.** Produce un plan corto vinculado a archivos existentes; después implementa y prueba el tercer tab **sin rehacer los dos anteriores**. La pieza decisiva es la interacción real teléfono → evento persistido → notebook → animación → semáforo → ONG, manteniendo separado qué es real y qué es simulado.

**No te limites a entregar una propuesta textual si tienes acceso de edición al proyecto: desarrolla el código**, ajusta componentes React actuales, configura un backend temporal compartido, integra visualmente los mapas/métricas existentes y valida con dos dispositivos. Si faltan credenciales, despliegue público, imágenes o carpeta de código, explica **exactamente** el bloqueo y entrega lo que sí puedas desarrollar sin falsificar el resultado.

El público debe poder entender el problema y la solución **sin leer arquitectura ni logs**; los jueces técnicos deben poder abrir detalles para ver la separación de capas, eventos, sincronización, ACK, fallas y estado de cada nodo.

# WaterLight — Dirección UX/UI, arte 2D y guía de assets para el agente

**Versión:** 1.0 · **Documento complementario obligatorio de:** `01_REGLAS_NEGOCIO_Y_SIMULACION.md`.

> **INSTRUCCIÓN PRIORITARIA PARA EL AGENTE:** La interfaz debe parecer un **pequeño juego educativo ilustrado a mano**, no un dashboard SaaS genérico. Usa **imágenes reales de los componentes visuales** (mapa, pozos, chozas, habitantes, semáforo, árboles, recipientes, etc.) por encima de intentar ilustrarlos con divs y CSS. Usa HTML/CSS para layout, interacción, texto, overlays y movimiento; SVG para líneas/rutas y paquetes. **Genera los assets gráficos de forma consistente si dispones de herramienta de imágenes. Si NO puedes generar imágenes, detente e informa al usuario cuáles necesitas; él puede proporcionarlas. No presentes un montón de formas CSS como reemplazo final silencioso.**
>
> La demo debe ser funcional y seguir las reglas de negocio del primer documento. Los diseños de `refs/` son **referencia artística**, no imágenes finales para incrustar como un solo fondo: contienen controles y textos dibujados que serían imposibles de manipular individualmente. Descompón el escenario en capas y sprites independientes.

---

## 1. Visión del producto en una frase

**Una pequeña aldea africana ilustrada en 2D, con tres pozos alrededor, un semáforo central y habitantes que se mueven entre puntos de agua mientras se visualiza cómo llegan —o no llegan— las alertas de los pozos.**

El usuario del hackathon debe comprender la historia en menos de 10 segundos:

1. Hay **un pueblo al centro**.
2. Hay **exactamente tres pozos**, uno a la izquierda-arriba, uno a la derecha-arriba y uno abajo.
3. **Cada pozo tiene un estado** y puede cambiarlo desde un panel lateral sencillo.
4. Hay **un semáforo físico grande en el pueblo**, cuya señal refleja la disponibilidad agregada **con los datos que efectivamente recibió**.
5. Las personas **caminan por senderos** a buscar agua. Si una fuente no sirve o aparece una alerta, se desvían o esperan.
6. Se pueden ver **las señales y sus fallas**, abriendo el detalle de cada pozo.

No inundar la pantalla con KPIs, mapas administrativos, menús complejos, gráficas pequeñas, logs enormes ni 20 tarjetas. **El mapa es el protagonista.**

---

## 2. Referencias visuales existentes (incluir y consultar)

Estas imágenes están incluidas dentro de la carpeta `refs/` del paquete. Mantenerlas accesibles para el agente.

### Referencia 01 — Composición principal

![Vista general de pueblo, tres pozos, semáforo y panel lateral](refs/01-vista-general.png)

**Tomar de esta referencia:** escala amigable, separación espacial entre los tres pozos, chozas centrales, semáforo protagonista, clima cálido, personajes pequeños, rotulación amable, control lateral mínimo.

**No copiar literalmente:** textos incrustados en dibujo, interpretación simplificada de «Enabled = agua segura» sin pruebas, flechas ambiguas ni panel de leyenda excesivo.

### Referencia 02 — Habitantes y rutas

![Rutas y habitantes en el mapa](refs/02-movimiento-y-rutas.png)

**Tomar:** personajes fácilmente distinguibles, rutas legibles y un destino bloqueado que conduce a una alternativa. **Corregir:** los personajes jamás deben ser dirigidos a un pozo que el motor conozca como no utilizable; las rutas se calculan desde el conocimiento disponible en la simulación (no desde información omnisciente).

### Referencia 03 — Historia de la alerta

![Descubrir un problema, informar, cambiar semáforo y redirigir](refs/03-alerta-y-transmision.png)

**Tomar:** progresión visual `1 Detectar → 2 Reportar → 3 Informar al pueblo → 4 Redirigir`. **Corregir:** observar mal olor no equivale a contaminación confirmada; primero «sospecha» y, posteriormente, validación simulada por trabajador. Si falla la comunicación, mostrar en cola y no animar el paso 3 hasta que el evento llegue.

### Referencia 04 — Control + detalle

![Panel de controles y detalle del pozo](refs/04-panel-y-detalle.png)

**Tomar:** botones por pozo, detalles ordenados, contraste entre ilustración y panel, sensación de juego controlable. **Simplificar:** la pantalla inicial solo enseña los controles básicos; la edición avanzada y la arquitectura están en un drawer al seleccionar un pozo.

**Nota:** estas son imágenes generadas como bocetos. Pueden contener erratas en textos, rutas o colores. La especificación funcional del archivo 01 tiene prioridad sobre ellas.

---

## 3. Nombre del estilo y dirección artística

**Estilo objetivo:** *hand-drawn 2D illustrated village simulation / storybook game map / animated whiteboard map*.

En español: **mapa de terreno 2D ilustrado a mano, estilo cuento interactivo / pizarra animada**. No es fotografía, render 3D ni un mapa geográfico exacto.

**Características visuales:**

- Vista oblicua 2D, con elevación suave (*2.5D muy ligero en composición*, sin modelos 3D ni cámara 3D): vemos las chozas y bordes de los pozos, pero las rutas se entienden en planta.
- Contornos negros/marrón oscuro dibujados a mano, redondeados y coherentes; rellenos planos con textura tenue de acuarela/papel.
- Paleta cálida de terreno, ocres, beige, terracota y verdes suaves; cielo azul claro y detalles de agua azul.
- Personajes pequeños, representados con dignidad, formas sencillas, expresiones amistosas/atentas y vestimenta plausible sin pretender representar a una etnia específica como estereotipo.
- Pocos detalles distractores: 3–5 chozas (máximo 6), 3–4 árboles, 1–2 cercos discretos, piedras y hierba dispersa. **No llenar con gallinas, ríos, puentes, montañas, animales y carteles a la vez**.
- Semáforo central claramente identificable desde distancia, alto contraste y lectura en proyector.
- Sensación de juego educativo, pero no infantilizar el problema ni dramatizar a las comunidades.

### Evitar explícitamente

- Ilustraciones completamente construidas con bordes de `div`, pseudo-elementos CSS y emojis gigantes.
- Video o GIF pesado como escena completa; impediría controlar cada pozo y personaje.
- Perspectiva 3D compleja, muñecos 3D, Unity/Canvas WebGL para esta demo sencilla.
- UI futurista de laboratorio, mapas satelitales, gradientes neón, excesivos glassmorphisms y dashboards oscuros.
- Activos visuales de diferentes estilos mezclados (por ejemplo, un pozo foto-realista y un personaje plano).
- Símbolos de contaminación que dependan solo de un charco verde o de agua maloliente; estos conceptos **no sirven por sí solos como prueba sanitaria**.

### Paleta de referencia (ajustar para buen contraste)

| Rol | Color sugerido | Hex |
| --- | --- | --- |
| Fondo arena | arena cálida | `#F5D9A4` |
| Fondo interfaz | marfil | `#FFF9ED` |
| Tierra/caminos | tierra tostada | `#C99B63` |
| Chozas/techo | terracota y paja | `#9E6740` / `#D9A765` |
| Vegetación | verde salvia | `#6F9250` |
| Agua ilustrada | azul agua | `#55B5D8` |
| Línea de dibujo | marrón carbón | `#3A2C26` |
| Disponible | verde | `#2B9B5A` |
| Precaución / reservas | ámbar | `#D99A1B` |
| Riesgo confirmado | rojo | `#D8483E` |
| Conexión técnica | azul | `#3186C7` |
| Mensaje en cola | gris | `#73777D` |

La condición del pozo no debe expresarse solo con colores: combinar **icono + texto + forma**, y distinguir la capa de conectividad con otro icono para no confundir peligro sanitario con pérdida de señal.

---

## 4. Estructura de la pantalla principal (desktop / proyector)

**Objetivo de diseño:** 16:9 y 1440×900 o 1920×1080, también usable en pantallas menores. Escena ocupando aproximadamente **75–80%** del ancho; panel de controles **20–25%**. El mapa nunca debe ocultarse bajo un modal gigantesco durante la demostración.

```text
┌────────────────────────────────────────────────────────────────────┐
│ WaterLight  • Simulación de pozos de agua        [Escenarios] [?]  │
├───────────────────────────────────────────┬────────────────────────┤
│                   🌤                     │ CONTROLES              │
│   POZO 1                                  │ Pozo 1 [Estado ▼]      │
│                     POZO 2                 │ Pozo 2 [Estado ▼]      │
│          CHOZAS / SEMÁFORO                 │ Pozo 3 [Estado ▼]      │
│                                           │                        │
│     HABITANTES + SENDEROS                 │ Personaje [▼]          │
│                                           │ Destino [Auto ▼]       │
│                     POZO 3                 │ [▶ Reproducir]         │
│                                           │ [Pausa] [Paso] [Reset] │
│                                           │                        │
│                                           │ Estado pueblo: AMARILLO│
│                                           │ Último evento          │
├───────────────────────────────────────────┴────────────────────────┤
│ 00:22 | Evento reciente ▸ [Ver cronología]    Velocidad [1x ▼]     │
└────────────────────────────────────────────────────────────────────┘
```

Este diagrama es **solo distribución**; visual final debe usar assets ilustrados reales.

### 4.1 Coordenadas normalizadas recomendadas (sobre escena, no pantalla completa)

| Elemento | x | y | Tamaño relativo sugerido |
| --- | --- | --- | --- |
| Pozo 1 | 17% | 23% | 12–15% ancho de escena |
| Pozo 2 | 83% | 23% | 12–15% |
| Pozo 3 | 55% | 79% | 12–15% |
| Chozas + plaza | 46% | 48% | 29–34% |
| Semáforo central | 49% | 43% | más alto que una choza, sin tapar todas |
| Personaje A, inicio | 40% | 63% | 3–5% |
| Personaje B, inicio | 56% | 60% | 3–5% |
| Trabajador, inicio | 47% | 53% | 3–5% |

Usar coordenadas normalizadas y un contenedor con `aspect-ratio`. No posicionar elementos con píxeles absolutos sin adaptación; en pantallas bajas se superpondrán.

### 4.2 Jerarquía de capas (z-index)

1. Fondo de terreno / cielo / montaña (imagen base).
2. Caminos dibujados en la base o en una capa SVG de terreno.
3. Decoración: árboles, rocas, cercos.
4. Chozas y pozos (sprites de imágenes separadas).
5. Personajes que se mueven por caminos.
6. Semáforo central (cuerpo ilustrado + luces superpuestas e independientes).
7. Etiquetas de pozos, chip de estado, iconos de conectividad.
8. Señales de comunicación SVG/pulsos (activar bajo demanda) y rutas de movimiento.
9. Tooltips, paneles y drawer.

Importante: **evitar dibujar etiquetas e interruptores dentro de los PNGs**. El texto debe ser HTML real, traducible, accesible e interactivo.

---

## 5. Sistema de imágenes: obligatorio y prioritario

### 5.1 Principio image-first

**El terreno y los objetos deben provenir de imágenes ilustradas, no de cajas CSS que intentan parecer chozas o pozos.**

**CSS sí se usa** para `position`, `transform`, `opacity`, `filter`, `transition`, estados visuales, sombreado ligero de UI, pulsos y distribución. SVG sí se usa para senderos, señales, flechas y overlays. **No** para recrear con miles de nodos vectoriales manuales todo el paisaje si pueden generar imágenes de calidad.

**Imágenes recomendadas:**

- Fondo completo **sin personajes, pozos ni semáforo** como `landscape.webp` (puede contener caminos base, cielo y vegetación de baja complejidad).
- Choza individual, set de 2–3 variantes con transparencia.
- Pozo como pieza independiente, idealmente **4 variantes visuales** (funcional, seco, contaminado *señalizado*, válvula dañada), todas idénticas en perspectiva y tamaño.
- Cuerpo del semáforo con **luces apagadas** en asset propio. Luces activas superpuestas con elementos HTML/SVG o sprites separados, para cambiar por código.
- Personajes **pose fija**, PNG/WebP transparente de mujer con bidón, otro adulto/trabajador y dos niños; variantes opcionales de pose sin necesidad de animación frame-by-frame.
- Íconos simples de bidón, gota, aviso, válvula, antena, batería, mensaje/paquete.

### 5.2 Checklist de assets con rutas de destino

| Ruta | Contenido | Fondo | Requisito |
| --- | --- | --- | --- |
| `src/assets/landscape.webp` | Terreno ancho 16:9, cielo y caminos sin personajes/pozos/señales | Opaco | No debe incluir panel de UI ni textos |
| `src/assets/village/hut-a.png` | Choza redonda de barro/techo paja | Transparente | 3/4 consistente |
| `src/assets/village/hut-b.png` | Segunda choza variante | Transparente | Misma escala visual |
| `src/assets/village/acacia.png` | Árbol sencillo | Transparente | Sombra ligera, sin detalles excesivos |
| `src/assets/wells/well-enabled.png` | Pozo operativo | Transparente | Pozo aislado y bien centrado |
| `src/assets/wells/well-no-water.png` | Mismo pozo con indicio de vacío | Transparente | No cambiar el ángulo ni tamaño |
| `src/assets/wells/well-contaminated.png` | Mismo pozo con placa de peligro | Transparente | No representar contaminación como pura coloración de agua |
| `src/assets/wells/well-valve-damage.png` | Mismo pozo con válvula/asa dañada | Transparente | Falla visible |
| `src/assets/semaphore/semaphore-body.png` | Semáforo central, carcasa/lámparas apagadas | Transparente | 3 lámparas superponibles |
| `src/assets/characters/woman-jerrycan.png` | Persona adulta con recipiente | Transparente | Pose estática |
| `src/assets/characters/child-blue.png` | Niño/a con ropa azul | Transparente | Pose estática |
| `src/assets/characters/child-orange.png` | Niño/a con ropa naranja | Transparente | Pose estática |
| `src/assets/characters/field-worker.png` | Trabajador/a de campo | Transparente | Diferenciable visualmente |
| `src/assets/ui/water-drop.png` | Gota | Transparente | Tamaño iconográfico |
| `src/assets/ui/valve.png` | Llave/válvula | Transparente | Tamaño iconográfico |
| `src/assets/ui/warning.png` | Aviso | Transparente | Visible a 24 px |
| `src/assets/ui/radio.png` | Antena/señal | Transparente | Visible a 24 px |

Los cuatro mockups de `refs/` son referencias **compuestas**, no sustitutos de estos sprites. No recortarlos sin revisar elementos tapados, textos y perspectivas inconsistentes.

### 5.3 Dimensiones y calidad

- Fondo: 1920×1080 o 2560×1440, exportar WebP comprimido sin texto.
- Pozos: idealmente canvas transparente de 512×512 o 768×768, con márgenes semejantes.
- Semáforo: 384×768 o similar, cuerpo vertical aislado.
- Personajes: 256×512 o 384×768 transparente, con pies alineados y espacio sin recortes.
- Chozas: 512×512 con transparencia.
- Texturas y detalles: sutiles; evitar ruido que interfiera con etiquetas.
- Todas las imágenes deben tener **consistencia de perspectiva, trazo, grosor de línea y luz**.
- Optimizar peso y preferir WebP cuando tenga transparencia suficiente; conservar originales PNG si sirven para edición.

### 5.4 Si el agente puede generar imágenes

**Genera los componentes antes de terminar el mapa.** El orden correcto es: estilo aprobado → fondo → pozos/semáforo → chozas/personajes → composición HTML → animaciones.

Recomendación: primero crear una **hoja de estilo/master sheet** con 1 pozo, 1 choza, 1 persona y 1 árbol, validar coherencia y luego crear variantes. Usar mismo prompt base/imagen de referencia para todos, con indicación expresa de que no incluyan palabras ni UI. Exportar sprites con transparencia.

### 5.5 Si NO puede generar imágenes

**DEBES avisar al usuario de forma clara y específica**. Ejemplo de respuesta que debes emitir, sin fingir trabajo completado:

> «Tengo la lógica y la estructura del simulador listas, pero no tengo disponible una herramienta para generar los sprites ilustrados con el estilo de referencia. Para lograr la estética que pediste, necesito que me pases el fondo, 4 variantes de pozo, semáforo, 2 chozas y 3–4 personajes con fondo transparente, o que me habilites una herramienta de generación. Mientras tanto puedo dejar el motor, los controles y las posiciones preparados para sustituir los assets sin rehacer el código».

**Prohibido:** reemplazar en silencio los pozos/chozas con emojis, usar cuadros negros como «arte terminado», o afirmar que se generaron sprites cuando no es cierto.

Si solo está disponible la ilustración general compuesta, puede utilizarse como **mockup temporal durante integración**, etiquetado explícitamente como no interactivo, pero no como solución final.

---

## 6. Prompts visuales preparados para generar los componentes

Estos prompts pueden copiarse a un generador. Mantener coherencia y usar las ilustraciones `refs/01-vista-general.png` y `refs/04-panel-y-detalle.png` como referencia estilística cuando la herramienta lo permita.

### Prompt base de estilo (adjuntar a TODOS)

> `Hand-drawn 2D storybook game asset for an educational rural water-well simulation set in a fictional village inspired by East African rural landscapes. Clean dark-brown ink outlines, warm sand and ochre watercolor-like flat fills, terracotta mud, straw details, gentle sage-green foliage, very subtle paper texture, approachable expressive illustrated style, consistent 3/4 side-facing 2D perspective, bright natural daylight, clean readable silhouette, polished yet simple. NOT photorealistic, NOT 3D, NOT pixel art, NOT corporate flat vector icon, NO text, NO labels, NO interface, NO watermark.`

### Fondo

> `Wide 16:9 landscape only: warm savanna terrain, subtle distant hills, soft blue sky, sparse acacia-like trees and brush, a few simple sandy paths leading from a central open village clearing to exactly three EMPTY locations: upper left, upper right and bottom center. NO houses, NO wells, NO villagers, NO traffic light, NO signs, NO UI, NO writing. Keep central and corner areas uncluttered for interactive layers. [PROMPT BASE]`

### Pozo y variantes

> `One isolated hand-drawn rural community water well with simple stone rim, wooden support beam, bucket and hand-operated valve/pump cue, same 3/4 view, centered full object, transparent background, no scenery, no text. Produce consistent variants for: (A) functioning; (B) low/empty volume indicator; (C) contamination WARNING PLAQUE or caution sign, without claiming visible dirty water scientifically proves contamination; (D) visibly damaged valve mechanism. Preserve exactly the same geometry, size, line weight and camera angle across all variants. [PROMPT BASE]`

**Ideal:** generar versión base y editar variaciones a partir de ella, no generar cuatro pozos independientes con aspectos incongruentes.

### Semáforo central

> `Single isolated outdoor 3-light vertical traffic semaphore on a sturdy community notice pedestal, hand-drawn 2D storybook game art, red amber green circular lens positions but all initially dim/off, clean silhouette and exact lens centers accessible for layering digital colored light overlays later, transparent background, no labels or writing, [PROMPT BASE]`

### Chozas y entorno

> `Set of 3 isolated round rural huts with adobe/earth walls, thatched roofs, small doorway, simple respectful East African rural village inspiration, same 3/4 perspective, each independent, transparent background, no text, no people, no floor shadow outside silhouette, [PROMPT BASE]`

### Personas

> `Set of four isolated 2D static game character sprites, full bodies with feet visible and same scale and artistic style: adult woman carrying an empty yellow water jerrycan; child in blue shirt; child in warm orange clothing; community field worker carrying notebook. Respectful, non-stereotyped stylized characters, simple calm expressions, slight walking-ready pose but NOT multi-frame animation, clean outlines, transparent background, same camera angle, no UI, [PROMPT BASE]`

### Iconos y packs

> `Small consistent hand-drawn 2D icon pack on transparent background: water droplet, empty water container, valve wrench, hazard triangle, radio tower, battery low, packet envelope, checkmark, question mark. High contrast, simple shape, identical stroke weight and earthy palette. No words and no framing. [PROMPT BASE]`

**Control de calidad post-generación:** si el asset tiene palabras incrustadas, fondo blanco, estilo inconsistente o partes cortadas, regenerarlo/editarlo. No forzar al CSS a ocultar defectos de ilustración que afectarán toda la demo.

---

## 7. Componentes UX y comportamiento visual exacto

### 7.1 Semáforo central

**Componente:** `VillageTrafficLight`.

- Imagen de cuerpo ilustrado como base.
- 3 luces **HTML/SVG superpuestas** exactamente sobre los lentes. Una activa y otras apagadas; si está sin electricidad, todas apagadas con placa visible de precaución.
- Etiqueta inferior de lectura fácil: «Todos disponibles» / «Precaución» / «Sin fuentes habilitadas conocidas» / «Sin información».
- Chips diminutos `P1 ✓ P2 ✕ P3 !` si cabe, sin recargar.
- Click abre resumen simple de qué fuentes están disponibles y momento de última actualización.
- Si datos del centro están atrasados, incluir claramente «Última actualización recibida» y una pequeña señal gris/desconectada.
- **No** encender luces rojas/amarillas/verdes simultáneamente como si fueran tres estados activos a la vez.

**Microinteracción:** cuando llega y se **procesa** un evento real en el centro, cambiar color con transición corta de 250–400 ms y ligera expansión del anillo; no parpadear continuamente ni usar strobe.

### 7.2 Pozo ilustrado y estados

**Componente:** `WellSprite`.

- Sprite grande de pozo, nombre claro `Pozo 1`, `Pozo 2`, `Pozo 3`.
- Badge principal (verde/ámbar/rojo) con texto e icono `Habilitado`, `Sin agua`, `Contaminado`, `Válvula dañada` o `Sin verificar`.
- Badge secundario pequeño **independiente** de conexión `Enlace activo`, `Sin enlace`, `Pendientes: N`.
- Si reserva de agua está baja pero utilizable, texto secundario `Reserva baja`.
- Estado con contorno/halo suave al pasar mouse o seleccionar.
- Click/tap entra a un drawer; no navegar a otra página.
- Alt text en imágenes; nombre/estado deben ser texto real, no contenido raster.

**Importante:** contaminado confirmado siempre rojo. Sin agua y válvula dañada son problemas de **disponibilidad operacional**, no contaminación. No colorearlos automáticamente de rojo sanitario.

### 7.3 Personas y movimiento (requisito esencial)

**No crear una animación tradicional de personaje caminando**. El usuario quiere que se sienta como una pizarra animada con personaje fijo que se desplaza y rebota un poquito verticalmente.

Implementar así:

- Un único PNG/WebP por personaje con pose fija.
- El contenedor completo se mueve por waypoints: `translate(x,y)` o `offset-path` sobre una ruta calculada.
- Animación muy discreta de `translateY(-3px)`/`translateY(3px)` repetida cada ~450–650 ms mientras se desplaza; no estirar el cuerpo, no rotar extremidades.
- Al detenerse, detener bobbing; al cambiar dirección, usar `scaleX(-1)` cuando sea estéticamente apropiado.
- Movimiento a velocidad visual homogénea; sin teletransporte, salvo Reset o carga de escenario.
- Mostrar a lo sumo 2 rutas activas a la vez en mapa.
- El trayecto hacia el pozo se ilustra con **línea verde de puntos** y una pequeña flecha; rutas bloqueadas con línea gris + `×`.
- Cuando el destino deja de estar habilitado, animar `stop → reconsider → seleccionar ruta alternativa` y no cambiar dirección instantáneamente sin feedback.
- Si no hay ruta válida, retornar al centro / esperar allí, con texto «Sin alternativa habilitada».

Implementar soporte `prefers-reduced-motion`: mostrar transiciones discretas y estado final sin bobbing continuo para usuarios que reduzcan movimiento.

### 7.4 Señales de comunicación: NO confundir con senderos

Visualización de transmisión **solo cuando el evento viaja realmente**:

| Concepto | Estilo visual |
| --- | --- |
| Ruta de habitante | Verde suave punteado, sobre caminos de arena |
| Ruta bloqueada | Gris punteado + `X` |
| Señal desde pozo a centro | Arco curvo azul o rojo (según evento) **por encima de terreno**, con pequeño paquete luminoso |
| Evento en cola | Símbolo de sobre/reloj gris junto al pozo; no pulso en el aire |
| Paquete perdido | Pulso se interrumpe antes del receptor y aparece `✕ Paquete perdido` |
| Retry | Mismo evento, nuevo pulso con chip `Intento 2` |
| Recibido/ACK | Pulso llega, pequeño check en receptor y retorno de ACK discreto |
| Cloud desconectado | Camino centro→nube tachado, pero ruta pozo→centro sigue activa |

Las flechas de señal en screenshots son **inspiración**, pero en ejecución NO deben permanecer dibujadas todo el tiempo. Mostrar solo para un evento activo o si el usuario habilita «Mostrar arquitectura».

### 7.5 Panel lateral minimalista

En modo inicial:

```text
┌───────────────────────────────┐
│ WaterLight        DEMO        │
│ Tres pozos · Un pueblo        │
│                               │
│ POZOS                         │
│ Pozo 1         [Habilitado ▼] │
│ Pozo 2         [Habilitado ▼] │
│ Pozo 3         [Habilitado ▼] │
│                               │
│ HABITANTES                    │
│ Personaje        [Amina ▼]    │
│ Destino          [Auto ▼]     │
│                               │
│ [▶ Iniciar]  [⏸] [↻]          │
│ [Escenarios ▼]                │
│                               │
│ ● Pueblo: PRECAUCIÓN          │
│ Último: Pozo 2 reportó falla │
│                               │
│ [⚙ Parámetros avanzados]     │
└───────────────────────────────┘
```

Nombres de personajes opcionales y ficticios; no usar personas reales ni datos sensibles. Botón «Escenarios» debe mostrar 5–7 presets principales y más en «Ver todos».

**Control de estados:** para no llenar la barra con doce botones visibles, usar un `select` por pozo; al seleccionar un pozo se puede abrir `Detalle` para ajustes reales. **No** cambiar estado sin actualizar el motor.

**Microcopy:** usar español claro y frases cortas para el operador. Las palabras MQTT, QoS y Outbox no deben aparecer aquí salvo bajo «Arquitectura / avanzado».

### 7.6 Drawer de detalle de pozo: tres tabs

**Tamaño desktop:** panel lateral aprox. 360–440 px o 35% del viewport, sin tapar por completo el mapa. Si está abierto, redimensionar/acomodar mapa o atenuar solo parcialmente y permitir clic en otro pozo. En móvil, drawer de pantalla completa con botón volver.

**Tab 1: Estado**

- Cabecera: `Pozo 2 · Contaminado` con ilustración pequeña.
- Resumen: «¿Puede usarse ahora? No · Motivo: prueba positiva simulada».
- Inputs: **volumen**, **test** (simulado), **válvula**, **sospecha**, **vigencia**.
- Sección «Origen del dato»: sensor / persona / trabajador.
- CTA `Aplicar al escenario` que realmente despacha evento; permite previsualizar resultado derivado.
- Si `Test positivo` se muestra «Resultado de laboratorio simulado», nunca «el sensor detectó bacterias».
- Chips separados para `estado físico del pozo`, `dato conocido en centro` y `conectividad`.

**Tab 2: Comunicación (el más importante de este pedido)**

Representar con mini nodos ILUSTRADOS y etiquetas HTML claras:

```text
 [POZO / ESP32] --LoRa--> [CENTRO / GATEWAY] --MQTT/IP--> [BROKER / NUBE]
     ▲                         ▲
     └── BLE ── [TELÉFONO]     └── semáforo central
```

La flecha LoRa necesita **radio operativa**, no internet. MQTT necesita red IP hasta broker, local o remota. Si el broker es local, la sincronización a la nube puede fallar sin afectar el centro. Agregar un selector `Vista básica / ver detalles técnicos`.

**Controles en esta vista:**

- `Enviar ping` / `Enviar estado actual`.
- `Cortar LoRa`, `Cortar internet`, `Cortar BLE`, `Apagar gateway`.
- `Perder próximo paquete`, `Restaurar conexión`.
- `Paso siguiente` en la mini-demo.
- Contador `En cola N`, `Intentos N`, `Último ACK`, `Versión pozo/centro/nube`.

**La animación del mensaje usa el mismo motor de eventos que el mapa**, no una segunda animación falsa ni una simulación divergente del dominio.

**Tab 3: Historial**

Cronología filtrada y legible:

```text
00:06  Trabajador registra prueba positiva (simulado)
00:06  Pozo cambia a Contaminado
00:06  Evento #18 guardado localmente
00:07  Sin LoRa: queda en cola
00:12  LoRa recuperado; intento 2
00:13  Centro confirmó evento #18
00:14  Dashboard remoto pendiente (sin internet)
```

### 7.7 Cronología general discreta

Por defecto, un renglón inferior `Último evento` con opción expandir a 6–10 líneas. No ocupar 30% del mapa. Código de color con iconos por familia (agua, comunidad, comunicación, mantenimiento). Se puede filtrar por pozo.

---

## 8. Reglas UX para los estados y casos extraordinarios

### 8.1 Visualización de un cambio de estado

Secuencia visual sugerida:

1. Usuario selecciona `Pozo 2 → Contaminado` o se genera evento desde escena.
2. El pozo cambia visualmente a condición local roja.
3. Junto a él aparece icono `evento creado` y contador `1 pendiente` si red caída.
4. Si hay red: animación **de paquete** por la ruta radio; no usar sendero de persona.
5. Al llegar, animación breve del semáforo central que refleja agregación.
6. Si un habitante iba a ese pozo, detenerse y recalcular destino **según la información disponible**.
7. En cronología, indicar motivo y etapa, no solo «Estado cambiado».

### 8.2 UX de desconexión

**Tres estados distintos, visibles al mismo tiempo si es necesario:**

- `Estado local del pozo: CONTAMINADO` (rojo).
- `Centro: último conocido HABILITADO · antiguo / sin enlace` (gris/ámbar).
- `Nube: última sincronización anterior` (gris).

Evitar que el operador crea que el centro fue advertido cuando el paquete no llegó. Al reestablecer enlace se ve físicamente la reanudación, recorrido y ACK.

### 8.3 Prioridad de contenidos

Al abrir el detalle, enseñar antes:

1. **Qué pasa en este pozo.**
2. **Qué sabe el pueblo.**
3. **Por qué lo sabe / por qué no le llegó.**
4. **Qué harán las personas.**
5. Solo si el usuario quiere, detalles de protocolo MQTT/LoRa, retries y paquetes.

### 8.4 Qué no debe permitir la interfaz

- No permitir `CONTAMINATED` → `ENABLED` como supuesto resultado de reiniciar internet. Se requiere cambio autorizado de evidencias o preset de escenario explícito.
- No permitir «Ruta manual hacia pozo contaminado» para una acción de recoger agua; se puede permitir al trabajador **visita de inspección** con distinta etiqueta.
- No indicar «todo seguro» cuando el centro desconoce estados o la prueba está vencida.
- No mantener permanentemente rutas señal-radio verdes, aun sin existir mensaje.
- No mostrar luz verde durante una falla eléctrica del semáforo.

---

## 9. Animaciones y timing

Los números siguientes son **timings de experiencia visual**, no benchmarks de comunicación ni mediciones del mundo real:

| Animación | Duración visual propuesta | Efecto |
| --- | --- | --- |
| Selección de pozo | 150–220 ms | Escala 1.0→1.035 y halo |
| Cambio de chip | 200–300 ms | Opacidad/fade |
| Cambio de semáforo | 250–400 ms | Cambio de luz + un anillo suave |
| Personaje andando | variable por distancia | Traslado por ruta, bobbing de ±3 px |
| Reporte generado | 350–500 ms | Tarjeta breve y paquete en origen |
| Tránsito paquete entre nodos | 700–1500 ms por salto a 1x | Punto moviéndose sobre ruta, acorde latencia **simulada** |
| Paquete perdido | 250 ms | Pulso se extingue, `X` roja/ámbar |
| ACK | 250–500 ms | Check temporal y señal de retorno |
| Apertura drawer | 220–300 ms | Slide lateral suave |

Sin exceso de partículas, efectos de humo, zoom cinematográfico o transiciones de 5 segundos. **La escena debe seguir respondiendo con rapidez al jurado.**

La simulación tiene `Play / Pause / Step / 1x,2x,4x`; pausar detiene cronología y movimientos. La animación visual debe escuchar el estado del motor. Si el usuario cambia de escenario, limpiar pulsos anteriores y rutas obsoletas.

---

## 10. Responsividad y accesibilidad

**Desktop/proyector:** vista única con mapa y sidebar, relación 16:9 o similar.

**Tablet:** mapa ~65–70% y sidebar compacto, o sidebar colapsable en parte inferior.

**Teléfono:** no intentar mantener 3 pozos diminutos con panel permanente. Pantalla enfocada en mapa, controles desde bottom sheet, detalle en modal/página local; botones con áreas táctiles grandes.

**Accesibilidad mínima:**

- Colores reforzados por texto e iconos; no depender de percepción cromática.
- Textos de estado reales en HTML, traducibles y accesibles.
- Estados no ambiguos: «Sin agua» vs «Contaminado» vs «Sin enlace».
- Contraste suficiente en badges y botones, especialmente sobre mapa ilustrado.
- Navegación por teclado del panel/drawer (focus y Escape).
- `aria-live` moderado para cambios críticos de escenario, sin narrar cada frame.
- Soporte `prefers-reduced-motion`.
- Probar legibilidad a distancia de proyector.

**Privacidad y respeto:** la maqueta es una aldea ficticia inspirada visualmente en África oriental, no una representación etnográfica exacta. No añadir nombres reales, coordenadas sensibles, perfiles personales ni imágenes de personas reales sin necesidad. El escenario se identifica claramente como simulado.

---

## 11. Escenarios visuales que deben quedar muy pulidos

Priorizar estas secuencias sobre animaciones decorativas:

**A. Todo bien:** tres pozos habilitados, semáforo verde, una persona va a buscar agua, retorna; la radio no necesita emitir constantemente.

**B. Pozo contaminado con conexión:** pozo local rojo, paquete viaja a centro, centro amarillo porque aún hay alternativas, habitante no usa ese pozo, ruta verde a uno habilitado.

**C. Pozo contaminado sin radio:** pozo local rojo, paquete se guarda, centro conserva última versión con aviso «sin enlace»; **no** aparece pulso atravesando el corte. Al reconectar, pulso + ACK + semáforo actualizado.

**D. Sin internet cloud:** las luces centrales sí cambian por LoRa local; panel remoto queda sin actualizar; al volver internet se sincroniza.

**E. Sin agua / daño de válvula:** visualizar dos tipos de fallos que no son contaminación, explicar por qué un pozo con agua puede quedar inutilizable.

**F. Todos fallan:** centro rojo y habitantes esperando, sin rutas hacia un destino no apto.

Estos seis escenarios deben poder mostrarse en **menos de 3 minutos** si el presentador selecciona presets y avanza por pasos.

---

## 12. Arquitectura gráfica del drawer: layout sugerido

La sección de comunicación debe ser casi un «mini laboratorio» de la red, compacto y atractivo. Preferir tarjetas visuales pequeñas, no una tabla compleja con protocolos.

```text
┌───────────────────────────────┐
│ Pozo 2  ·  CONTAMINADO    [×] │
│ [Estado] [Comunicación] [Log] │
├───────────────────────────────┤
│ ¿Cómo llega la alerta?        │
│                               │
│ [Pozo] ── LoRa ── [Centro]   │
│    ▲                 │        │
│   BLE               MQTT/IP   │
│    │                 ▼        │
│ [Teléfono]        [Broker]    │
│                         │     │
│                      [Nube]   │
│                               │
│ LoRa [ON/OFF]  Internet [ON] │
│ Paquetes perdidos: [ 0 % ]   │
│                               │
│ [Enviar ping] [Enviar alerta] │
│ [Perder 1 paquete] [Retry]    │
│                               │
│ Estado local: CONTAMINADO     │
│ Centro: HABILITADO (antiguo) │
│ Nube: HABILITADO (antiguo)   │
│ Pendientes: 1  Último ACK: —  │
└───────────────────────────────┘
```

En lugar de cajas desnudas, los nodos Pozo/Centro/Personaje se acompañan de iconos/ilustraciones pequeñas del mismo estilo. Para representar el MQTT broker es suficiente un icono simple de servidor, no inventar que está dentro de la radio LoRa.

**Rutas de señal dibujadas como SVG** para poder animar una burbuja; `stroke-dasharray` o path offset. Colores coherentes, etiquetas cortas: `LoRa P2P`, `MQTT/IP`, `BLE`, `Cloud`. La dirección/estado de cada salto corresponde al motor.

---

## 13. División de componentes UI y API interna visual

Componentes sugeridos:

```ts
<VillageScene wells={...} villagers={...} centerKnowledge={...} />
<WellSprite well={...} networkState={...} onSelect={...} />
<VillageTrafficLight status={...} stale={...} onInspect={...} />
<VillagerSprite character={...} route={...} activity={...} />
<SignalLayer deliveries={...} links={...} />
<ControlPanel state={...} onDispatch={...} />
<WellDetailDrawer wellId={...} tab={...} onDispatch={...} />
<ArchitectureMiniDemo eventId={...} state={...} />
<EventTimeline events={...} />
```

No construir `SignalLayer` que avance solo con CSS sin leer los `DeliveryRecord`. Si el transporte dice `DROPPED`, la animación debe cortarse. Si el transporte dice `QUEUED`, mostrar cola. Si el ACK llegó, indicar confirmado. Los componentes no son fuente de verdad del dominio.

### Trazados de ruta sin bloquear arte

- Definir `path` SVG de personajes por waypoints: `[centro, bifurcación, pozo 1]`, etc.
- Definir `path` **distintos** para radio: desde antena de cada pozo hacia receptor central, con arco sobre el terreno.
- Personajes anclados por pies; su posición se calcula en coordenadas normalizadas para soportar redimensionado.
- Si `Pozo 2` abre drawer, no tapar el estado central ni el pozo seleccionado; desplazar o escalar mapa hacia el espacio restante.
- No usar `pointer-events` en SVG de señales para impedir clic accidental en pozos.

---

## 14. Protocolo de trabajo exigido al agente

1. **Lee íntegramente** `01_REGLAS_NEGOCIO_Y_SIMULACION.md` y este archivo; identifica contradicciones de ilustraciones frente a reglas y prioriza las reglas.
2. **Inspecciona** las cuatro imágenes de `refs/` para fijar el lenguaje visual.
3. **Declara explícitamente** si tienes o no una herramienta capaz de generar ilustraciones/sprites consistentes. Si la tienes, procede sin pedir confirmación innecesaria. Si no, solicita los assets enumerados en la sección 5.5.
4. **Genera primero** fondo y componentes gráficos independientes, sin textos ni UI rasterizada; exporta con transparencia cuando corresponda.
5. Monta escena responsive y confirma que los tres pozos, pueblo y semáforo no se pisan.
6. Integra motor real de reglas y canales. **No construir solo una escena bonita.**
7. Implementa movimiento estático + bobbing, senderos de personas y pulsos de señales por separado.
8. Implementa controles básicos y drawer con arquitectura y mini demo de falla.
9. Verifica los escenarios visuales A–F, incluida caída LoRa vs caída internet. Compara los resultados con la especificación de negocio.
10. Corre pruebas funcionales y revisa al menos capturas desktop 16:9 y móvil. Si un asset está ausente o degradado, dilo; no declares terminado.

### Control de calidad final (obligatorio)

- [ ] Tres pozos claramente identificables, nunca más de tres en escena.
- [ ] Pueblo y semáforo están en el centro y son protagonistas.
- [ ] Paisaje 2D ilustrado **con imágenes independientes**; sin chozas hechas solo con CSS.
- [ ] Personajes de pose fija se desplazan y rebotan suavemente, sin sprites de caminar complejos.
- [ ] Estados de pozo se diferencian por color, icono y texto.
- [ ] Cambios por controles reflejan reglas del modelo.
- [ ] La ruta de un habitante responde a información conocida y al evento recibido.
- [ ] Se distingue visualmente sendero de persona y señal de red.
- [ ] Click en cualquier pozo abre detalle con factores, comunicación, cola y últimos conocimientos local/centro/nube.
- [ ] Cortar LoRa impide la actualización remota inmediata; se forma cola.
- [ ] Cortar internet NO rompe semáforo si LoRa local funciona.
- [ ] Reintentos y ACK son visibles cuando se recupera enlace.
- [ ] Un pozo contaminado jamás se habilita solo por reconectar.
- [ ] Modo básico está limpio; modo avanzado existe para jueces técnicos.
- [ ] Los cuatro bocetos de referencia se usan como guía, no como única imagen plana interactiva falsa.
- [ ] Prototipo explica claramente que los estados/pruebas son **simulados**.

---

## 15. Prioridades si falta tiempo

**P0 — Imprescindible:** assets del terreno/pozos/semáforo/personajes, escena completa, 4 estados, semáforo derivado, una persona moviéndose, cambiar estado, ver alertas, detalle por pozo, caída de enlace y recuperación, modo offline simulado.

**P1 — Muy valioso:** pestaña arquitectura animada, cola/retry/ACK, fuentes local-centro-cloud diferentes, varios escenarios, otra persona, línea de tiempo y pausa/paso.

**P2 — Opcional:** texturas finas, panel de métricas, localización, sonido ambiental discreto desactivado por defecto, modos de presentación, mejoras artísticas.

**No recortar por falta de tiempo:** distinción entre contaminación confirmada vs sospecha, diferencia entre estado local y recibido, central amarillo cuando aún hay alternativas, o seguridad de rutas. Esas reglas hacen que la demo tenga sentido.

---

## 16. Resultado visual y funcional esperado

Un jurado debe poder:

- Mirar el pueblo y entender qué ocurre, sin leer instrucciones largas.
- Cambiar Pozo 2 a contaminado o simular una detección por persona.
- Observar que la información cambia localmente, **viaja cuando existe un enlace**, llega al semáforo y afecta la decisión de una persona.
- Cortar una conexión y ver que la alerta queda guardada sin teletransportarse.
- Restaurar el enlace y observar la entrega pendiente, ACK, sincronización y cambio visual correcto.
- Abrir el pozo y comprender, con una imagen clara de los nodos, **dónde actúan BLE, LoRa, gateway, MQTT y servidor**.

**Estética:** mapa ilustrado hand-drawn como las referencias, con componentes en PNG/WebP y microanimaciones CSS/SVG. **Experiencia:** simulador pequeño, intuitivo, manipulable, verificable y honesto. **Si faltan imágenes y no puedes generarlas, avisa al usuario para que las entregue.**

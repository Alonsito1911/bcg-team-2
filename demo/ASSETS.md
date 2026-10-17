# Assets ilustrados pendientes

La demo funciona hoy con **sprites SVG provisorios** dibujados en código (`src/assets/Sprite.tsx`). Para el arte final, genera los PNG/WebP de abajo y cópialos a `src/assets/png/` **con exactamente estos nombres**. El manifiesto (`src/assets/manifest.ts`) los detecta y reemplaza al SVG sin tocar código. Después ejecuta `npm run build` o `npm run build:single`. El aviso «Arte provisorio SVG» desaparece cuando están todos.

| Archivo en `src/assets/png/` | Contenido | Tamaño sugerido | Fondo |
|---|---|---|---|
| `landscape.webp` | Terreno 16:9 con cielo, colinas y senderos desde el centro hacia arriba-izquierda, arriba-derecha y abajo-centro. **Sin** casas, pozos, personas ni semáforo | 1920×1080 | Opaco |
| `hut-a.png` | Choza redonda de barro con techo de paja | 512×512 | Transparente |
| `hut-b.png` | Variante de choza, misma escala | 512×512 | Transparente |
| `acacia.png` | Acacia sencilla | 512×512 | Transparente |
| `well-enabled.png` | Pozo operativo | 512×512 | Transparente |
| `well-no-water.png` | **Mismo** pozo, seco/vacío | 512×512 | Transparente |
| `well-contaminated.png` | **Mismo** pozo con placa de advertencia | 512×512 | Transparente |
| `well-valve-damage.png` | **Mismo** pozo con la válvula/manivela rota | 512×512 | Transparente |
| `semaphore-body.png` | Semáforo de 3 luces **apagadas**, sobre un pedestal | 384×800 | Transparente |
| `woman-jerrycan.png` | Mujer adulta con bidón amarillo | 256×512 | Transparente |
| `child-blue.png` | Niño/a con ropa azul | 256×512 | Transparente |
| `child-orange.png` | Niño/a con ropa naranja | 256×512 | Transparente |
| `field-worker.png` | Trabajadora comunitaria con cuaderno | 256×512 | Transparente |

**Importante para el semáforo:** las luces se dibujan por código encima del PNG, centradas horizontalmente y al 17,6 %, 31,2 % y 44,8 % de la altura (`src/components/VillageTrafficLight.tsx`, constante `LAMPS`). Si el PNG ubica los lentes en otra posición, ajusta esos tres porcentajes.

## Prompts (doc 02 §6)

**Base de estilo (agregar a TODOS):**

> Hand-drawn 2D storybook game asset for an educational rural water-well simulation set in a fictional village inspired by East African rural landscapes. Clean dark-brown ink outlines, warm sand and ochre watercolor-like flat fills, terracotta mud, straw details, gentle sage-green foliage, very subtle paper texture, approachable expressive illustrated style, consistent 3/4 side-facing 2D perspective, bright natural daylight, clean readable silhouette, polished yet simple. NOT photorealistic, NOT 3D, NOT pixel art, NOT corporate flat vector icon, NO text, NO labels, NO interface, NO watermark.

- **Fondo:** Wide 16:9 landscape only: warm savanna terrain, subtle distant hills, soft blue sky, sparse acacia-like trees and brush, a few simple sandy paths leading from a central open village clearing to exactly three EMPTY locations: upper left, upper right and bottom center. NO houses, NO wells, NO villagers, NO traffic light, NO signs, NO UI, NO writing.
- **Pozo y variantes:** One isolated hand-drawn rural community water well with simple stone rim, wooden support beam, bucket and hand-operated valve/pump cue, same 3/4 view, centered full object, transparent background. Variants: (A) functioning; (B) low/empty; (C) contamination WARNING PLAQUE; (D) visibly damaged valve. Preserve exactly the same geometry, size, line weight and camera angle. *(Genera la base y edita las variantes a partir de ella.)*
- **Semáforo:** Single isolated outdoor 3-light vertical traffic semaphore on a sturdy community notice pedestal, red amber green lens positions all dim/off, transparent background, no labels.
- **Chozas:** Set of 3 isolated round rural huts with adobe/earth walls, thatched roofs, small doorway, same 3/4 perspective, transparent background, no people.
- **Personas:** Four isolated static character sprites, full bodies, feet visible, same scale: adult woman carrying a yellow jerrycan; child in blue shirt; child in warm orange clothing; community field worker carrying a notebook. Respectful, non-stereotyped, calm expressions, transparent background.

**Control de calidad:** si un asset trae texto incrustado, fondo blanco, estilo distinto o partes cortadas, regéneralo. No lo tapes con CSS.

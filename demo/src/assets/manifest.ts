// Manifiesto de assets: si existe un PNG/WebP con el nombre de la clave en src/assets/png/,
// se usa en lugar del SVG provisorio. Así se reemplaza el arte sin tocar componentes.
// Claves esperadas: landscape, hut-a, hut-b, acacia, well-enabled, well-no-water,
// well-contaminated, well-valve-damage, semaphore-body, woman-jerrycan, child-blue,
// child-orange, field-worker (ver ASSETS.md).
const found = import.meta.glob('./png/*.{png,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const byKey: Record<string, string> = {};
for (const [path, url] of Object.entries(found)) {
  const key = path.replace(/^.*\//, '').replace(/\.(png|webp)$/, '');
  byKey[key] = url;
}

export function rasterFor(key: string): string | null {
  return byKey[key] ?? null;
}

export function usingPlaceholders(): string[] {
  // Ilustraciones que aún usan el SVG provisorio (el resto ya tiene PNG/WebP).
  const all = ['landscape', 'well-enabled', 'well-no-water', 'well-contaminated', 'well-valve-damage', 'semaphore-base', 'woman-jerrycan', 'woman-blue', 'child-blue', 'field-worker', 'ong-building', 'relay-tower'];
  return all.filter((k) => !byKey[k]);
}

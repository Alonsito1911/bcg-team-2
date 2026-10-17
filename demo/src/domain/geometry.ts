import type { NodeId, Point, WellId } from './types';

// Coordenadas normalizadas (0–100 % de la escena 16:9), doc 02 §4.1.
export const SCENE_ASPECT = 16 / 9;

export const WELL_POS: Record<WellId, Point> = {
  'well-1': { x: 20, y: 28 },
  'well-2': { x: 84, y: 57 },
  'well-3': { x: 60, y: 80 },
};

/** Donde se para una persona para usar el pozo. */
export const WELL_APPROACH: Record<WellId, Point> = {
  'well-1': { x: 27, y: 38 },
  'well-2': { x: 77, y: 65 },
  'well-3': { x: 53, y: 86 },
};

/** Base del pedestal del semáforo, en la plaza central. */
export const SEMAPHORE_POS: Point = { x: 51, y: 57 };
export const PLAZA: Point = { x: 51, y: 63 };

/** Senderos: plaza → bifurcación → pozo. */
export const TRAILS: Record<WellId, Point[]> = {
  'well-1': [PLAZA, { x: 41, y: 56 }, { x: 33, y: 46 }, WELL_APPROACH['well-1']],
  'well-2': [PLAZA, { x: 65, y: 62 }, WELL_APPROACH['well-2']],
  'well-3': [PLAZA, { x: 55, y: 73 }, WELL_APPROACH['well-3']],
};

/** Puntos de antena (caja LoRa junto a cada pozo) para las señales de radio. */
export const NODE_POS: Record<Exclude<NodeId, 'phone'>, Point> = {
  'well-1': { x: 27.5, y: 22 },
  'well-2': { x: 91.5, y: 51 },
  'well-3': { x: 67.5, y: 74 },
  gateway: { x: 51, y: 24 },
  cloud: { x: 66, y: 9 },
};

/** Chozas y árboles solo se dibujan con el paisaje SVG provisorio (el paisaje ilustrado ya los trae). */
export const HUTS: { x: number; y: number; variant: 'a' | 'b'; scale: number }[] = [
  { x: 37, y: 41, variant: 'a', scale: 1 },
  { x: 62, y: 40, variant: 'b', scale: 0.95 },
];

export const TREES: { x: number; y: number; scale: number; flip?: boolean }[] = [
  { x: 6, y: 44, scale: 1.1 },
  { x: 93, y: 47, scale: 1, flip: true },
];

export function sceneDistance(a: Point, b: Point): number {
  const dx = (a.x - b.x) * 1.6;
  const dy = (a.y - b.y) * 0.9;
  return Math.sqrt(dx * dx + dy * dy);
}

export function pathLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += sceneDistance(points[i - 1], points[i]);
  return total;
}

/**
 * Ruta desde la posición actual hasta un pozo, siguiendo senderos.
 * Si el punto más cercano del sendero de ESE pozo queda más cerca que la plaza, se entra
 * al sendero ahí y se sigue hacia el pozo (sin rodear por la plaza).
 */
export function routeToWell(from: Point, wellId: WellId): Point[] {
  const trail = TRAILS[wellId];
  let nearest = 0;
  let best = Infinity;
  trail.forEach((p, i) => {
    const d = sceneDistance(from, p);
    if (d < best) {
      best = d;
      nearest = i;
    }
  });
  if (nearest > 0 && (best < 4 || best < sceneDistance(from, PLAZA))) return trail.slice(nearest);
  return [...routeToPlaza(from), ...trail.slice(1)];
}

/** Ruta de vuelta a la plaza desde cualquier punto (desandando el sendero más cercano). */
export function routeToPlaza(from: Point): Point[] {
  if (sceneDistance(from, PLAZA) < 3) return [PLAZA];
  let bestTrail: Point[] | null = null;
  let bestIdx = 0;
  let best = Infinity;
  for (const trail of Object.values(TRAILS)) {
    trail.forEach((p, i) => {
      const d = sceneDistance(from, p);
      if (d < best) {
        best = d;
        bestTrail = trail;
        bestIdx = i;
      }
    });
  }
  if (!bestTrail || bestIdx === 0) return [PLAZA];
  const back = (bestTrail as Point[]).slice(0, bestIdx + 1).reverse();
  return back;
}

export function routeHome(from: Point, home: Point): Point[] {
  return [...routeToPlaza(from), home];
}

// Curvas de nivel por "marching squares" sobre una función de elevación (para el mapa topográfico).
export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function contourSegments(f: (x: number, y: number) => number, level: number, w = 100, h = 100, step = 2.5): Segment[] {
  const segs: Segment[] = [];
  const lerp = (a: number, b: number, va: number, vb: number) => a + ((level - va) / (vb - va)) * (b - a);
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const v0 = f(x, y);
      const v1 = f(x + step, y);
      const v2 = f(x + step, y + step);
      const v3 = f(x, y + step);
      const pts: [number, number][] = [];
      if (v0 < level !== v1 < level) pts.push([lerp(x, x + step, v0, v1), y]);
      if (v1 < level !== v2 < level) pts.push([x + step, lerp(y, y + step, v1, v2)]);
      if (v3 < level !== v2 < level) pts.push([lerp(x, x + step, v3, v2), y + step]);
      if (v0 < level !== v3 < level) pts.push([x, lerp(y, y + step, v0, v3)]);
      if (pts.length >= 2) segs.push({ x1: pts[0][0], y1: pts[0][1], x2: pts[1][0], y2: pts[1][1] });
      if (pts.length === 4) segs.push({ x1: pts[2][0], y1: pts[2][1], x2: pts[3][0], y2: pts[3][1] });
    }
  }
  return segs;
}

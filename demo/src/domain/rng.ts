// mulberry32: generador determinista para que las pérdidas de paquetes sean reproducibles por seed.
export function nextRandom(stateValue: number): [number, number] {
  let t = (stateValue + 0x6d2b79f5) | 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

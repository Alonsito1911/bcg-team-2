import { describe, expect, it } from 'vitest';
import { pearson, riskFor, villageWells } from '../src/domain/analytics';
import { contourSegments } from '../src/domain/contours';
import { BOMBAS, LORA, NIVELES, lluviaAnualDistrito, lluviaMensualDistrito, project, MAP_W, MAP_H } from '../src/domain/kiryandongo';
import { act, fresh } from './helpers';

describe('datos reales de bcg-team-2 (Kiryandongo)', () => {
  it('coinciden con el resultado documentado del equipo', () => {
    expect(BOMBAS).toHaveLength(847);
    expect(NIVELES['Crítico']).toEqual({ bombas: 91, personas: 41295 });
    expect(LORA.resumen.criticas_con_todo).toBe(89);
    expect(BOMBAS[0].ranking).toBe(1);
    expect(BOMBAS[0].nivel).toBe('Crítico');
  });

  it('la proyección deja todas las bombas dentro del mapa', () => {
    for (const b of BOMBAS) {
      const p = project(b.lat, b.lon);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(MAP_W);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(MAP_H);
    }
  });

  it('lluvia: 12 meses y 10 años', () => {
    expect(lluviaMensualDistrito()).toHaveLength(12);
    expect(lluviaAnualDistrito().map((a) => a.anio)).toContain('2022');
  });
});

describe('modelo de riesgo (prototipo simulado)', () => {
  it('el riesgo sube con la lluvia y un pozo contaminado queda cerrado', () => {
    let s = fresh();
    const b = villageWells(s.cloud).find((w) => w.id === 'well-2')!;
    expect(riskFor(b, 60).risk).toBeGreaterThan(riskFor(b, 0).risk);
    s = act(s, { type: 'QUICK_PRESET', wellId: 'well-2', preset: 'CONFIRMED_POSITIVE' });
    const c = { ...b, status: 'CONTAMINATED' as const };
    expect(riskFor(c, 0).actions[0]).toMatch(/cerrado/);
  });

  it('pearson y curvas de nivel', () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(contourSegments((x, y) => x + y, 100).length).toBeGreaterThan(10);
  });
});

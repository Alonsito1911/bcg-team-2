import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/domain/engine';
import { deriveLocal } from '../src/domain/state';
import type { SimulationState } from '../src/domain/types';
import { applyDemoCommand, canApply, initialSnapshot, REPORT_STEP } from '../src/features/guided-demo/demoMachine';
import { buildStateForStep, stepForward } from '../src/features/guided-demo/director';

const run = (s: SimulationState, ms: number) => {
  let out = s;
  for (let t = 0; t < ms; t += 100) out = applyAction(out, { type: 'TICK', dtMs: 100 });
  return out;
};

describe('máquina de comandos de la demo', () => {
  it('el paso de reporte exige el botón del teléfono, una sola vez', () => {
    let s = initialSnapshot('WL-TEST', 'now');
    for (let i = 0; i < REPORT_STEP; i++) s = applyDemoCommand(s, 'NEXT', 'now', 'x')!.snapshot;
    expect(canApply(s, 'NEXT')).toBe(false);
    const r = applyDemoCommand(s, 'REPORT_CONTAMINATION', 'now', 'ev-1')!;
    expect(r.event?.id).toBe('ev-1');
    expect(r.snapshot.step).toBe(REPORT_STEP + 1);
    expect(canApply(r.snapshot, 'REPORT_CONTAMINATION')).toBe(false);
    const back = applyDemoCommand(r.snapshot, 'PREV', 'now', 'x')!.snapshot;
    expect(back.reported).toBe(true);
    const reset = applyDemoCommand(back, 'RESET', 'now', 'x')!.snapshot;
    expect(reset).toMatchObject({ step: 0, reported: false, epoch: 2 });
  });
});

describe('director de la historia', () => {
  it('antes del reporte el pueblo NO sabe; después, la franja B pasa a no usar', () => {
    let s = buildStateForStep(REPORT_STEP, false);
    s = run(s, 15000);
    expect(s.wells['well-2'].hiddenContamination).toBe(true);
    expect(s.center['well-2'].status).toBe('ENABLED');

    s = stepForward(s, REPORT_STEP + 1);
    s = run(s, 8000);
    expect(deriveLocal(s, 'well-2').primary).toBe('CONTAMINATED');
    expect(s.center['well-2'].status).toBe('CONTAMINATED');
    // La ONG todavía no recibe (la nube se libera en el paso siguiente).
    expect(s.cloud['well-2'].status).toBe('ENABLED');

    s = stepForward(s, REPORT_STEP + 2);
    s = run(s, 5000);
    expect(s.cloud['well-2'].status).toBe('CONTAMINATED');
  });

  it('sin reporte confirmado no se puede reconstruir un paso posterior', () => {
    const s = run(buildStateForStep(REPORT_STEP + 2, false), 10000);
    expect(s.center['well-2'].status).toBe('ENABLED');
  });

  it('reconstruir el último paso deja todo coherente (recarga del notebook)', () => {
    const s = run(buildStateForStep(6, true), 3000);
    expect(s.center['well-2'].status).toBe('CONTAMINATED');
    expect(s.cloud['well-2'].status).toBe('CONTAMINATED');
    expect(s.center['well-1'].status).toBe('ENABLED');
    expect(s.center['well-3'].status).toBe('ENABLED');
  });
});

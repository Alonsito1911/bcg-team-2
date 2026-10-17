import { describe, expect, it } from 'vitest';
import { DEMO_CONFIG } from '../src/domain/config';
import { deriveVillageState } from '../src/domain/deriveVillageState';
import { deriveWellState } from '../src/domain/deriveWellState';
import { chooseWell } from '../src/domain/people';
import { deriveLocal, enabledFactors } from '../src/domain/state';
import { act, fresh, run, runUntil } from './helpers';

const ctx = { now: 0, rainActiveSince: null };

describe('deriveWellState (doc 01 §2.4)', () => {
  it('1. contaminación confirmada gana a la válvula dañada sin ocultarla', () => {
    const f = { ...enabledFactors(0), waterTest: 'CONFIRMED_POSITIVE' as const, valveCondition: 'DAMAGED' as const };
    const d = deriveWellState(f, ctx);
    expect(d.primary).toBe('CONTAMINATED');
    expect(d.secondary).toContain('VALVE_DAMAGE');
  });

  it('2. sin prueba vigente nunca es Habilitado', () => {
    for (const waterTest of ['MISSING', 'PENDING', 'EXPIRED'] as const) {
      expect(deriveWellState({ ...enabledFactors(0), waterTest }, ctx).primary).toBe('UNKNOWN');
    }
    const expiring = { ...enabledFactors(0), testValidUntil: 1000 };
    expect(deriveWellState(expiring, { now: 1001, rainActiveSince: null }).primary).toBe('UNKNOWN');
  });

  it('volumen bajo el umbral es NO_WATER y entre umbrales es reserva baja', () => {
    expect(deriveWellState({ ...enabledFactors(0), waterVolumePct: 10 }, ctx).primary).toBe('NO_WATER');
    const low = deriveWellState({ ...enabledFactors(0), waterVolumePct: 25 }, ctx);
    expect(low.primary).toBe('ENABLED');
    expect(low.lowReserve).toBe(true);
  });

  it('7. sospecha comunitaria → UNKNOWN, nunca CONTAMINATED', () => {
    const d = deriveWellState({ ...enabledFactors(0), reportedAnomaly: 'SUSPECTED' }, ctx);
    expect(d.primary).toBe('UNKNOWN');
  });

  it('lluvia: una prueba anterior a la lluvia no habilita durante la ventana', () => {
    const f = enabledFactors(0);
    expect(deriveWellState(f, { now: 5000, rainActiveSince: 4000 }).primary).toBe('UNKNOWN');
    const after = { ...f, testTakenAt: 4500 };
    expect(deriveWellState(after, { now: 5000, rainActiveSince: 4000 }).primary).toBe('ENABLED');
  });

  it('13. dispositivo sin energía no muestra verde falso', () => {
    expect(deriveWellState(enabledFactors(0), { ...ctx, unpowered: true }).primary).toBe('UNKNOWN');
  });
});

describe('semáforo central (doc 01 §3)', () => {
  it('3. un pozo contaminado + dos habilitados → centro amarillo, el pozo rojo', () => {
    let s = act(fresh(), { type: 'QUICK_PRESET', wellId: 'well-2', preset: 'CONFIRMED_POSITIVE' });
    s = runUntil(s, (x) => x.center['well-2'].status === 'CONTAMINATED');
    const v = deriveVillageState(s.center, s.clockMs, true);
    expect(v.signal).toBe('YELLOW');
    expect(s.center['well-1'].status).toBe('ENABLED');
    expect(s.center['well-3'].status).toBe('ENABLED');
  });

  it('4. tres pozos no utilizables → rojo y nadie sale a recoger', () => {
    let s = act(
      fresh(),
      { type: 'QUICK_PRESET', wellId: 'well-1', preset: 'NO_WATER' },
      { type: 'QUICK_PRESET', wellId: 'well-2', preset: 'CONFIRMED_POSITIVE' },
      { type: 'QUICK_PRESET', wellId: 'well-3', preset: 'VALVE_DAMAGE' },
    );
    s = run(s, 6000);
    expect(deriveVillageState(s.center, s.clockMs, true).signal).toBe('RED');
    s = act(s, { type: 'SEND_PERSON', personId: 'amina', target: 'AUTO' });
    const amina = s.people.find((p) => p.id === 'amina')!;
    expect(amina.activity).toBe('WAITING');
    expect(amina.path).toHaveLength(0);
  });

  it('gateway apagado → sin información, nunca verde', () => {
    const s = act(fresh(), { type: 'SET_LINK', target: { kind: 'gateway' }, on: false });
    expect(deriveVillageState(s.center, s.clockMs, s.connectivity.gatewayPowered).signal).toBe('NO_INFO');
  });

  it('5. cambiar el pozo 2 no toca los factores de 1 y 3', () => {
    const s0 = fresh();
    const s = act(s0, { type: 'QUICK_PRESET', wellId: 'well-2', preset: 'VALVE_DAMAGE' });
    expect(s.wells['well-1'].factors).toEqual(s0.wells['well-1'].factors);
    expect(s.wells['well-3'].factors).toEqual(s0.wells['well-3'].factors);
  });
});

describe('habitantes', () => {
  it('6. solo van a pozos conocidos como elegibles y registran la ruta', () => {
    let s = act(fresh(), { type: 'QUICK_PRESET', wellId: 'well-1', preset: 'CONFIRMED_POSITIVE' });
    s = runUntil(s, (x) => x.center['well-1'].status === 'CONTAMINATED');
    s = act(s, { type: 'SEND_PERSON', personId: 'amina', target: 'AUTO' });
    const amina = s.people.find((p) => p.id === 'amina')!;
    expect(amina.target).not.toBe('well-1');
    expect(amina.routeChoice).toMatch(/habilitado/);
  });

  it('salida manual a un pozo no apto queda bloqueada', () => {
    let s = act(fresh(), { type: 'QUICK_PRESET', wellId: 'well-2', preset: 'CONFIRMED_POSITIVE' });
    s = runUntil(s, (x) => x.center['well-2'].status === 'CONTAMINATED');
    s = act(s, { type: 'SEND_PERSON', personId: 'amina', target: 'well-2' });
    const amina = s.people.find((p) => p.id === 'amina')!;
    expect(amina.path).toHaveLength(0);
    expect(s.fx.some((f) => f.kind === 'BLOCKED')).toBe(true);
  });

  it('empates se resuelven por ID (determinista)', () => {
    const s = fresh();
    const a = chooseWell(s, { x: 49, y: 60 }, []);
    const b = chooseWell(s, { x: 49, y: 60 }, []);
    expect(a).toEqual(b);
  });

  it('contaminación oculta: la persona detecta, no bebe, presiona MAL → sospecha (no confirmada)', () => {
    let s = act(
      fresh(),
      { type: 'QUICK_PRESET', wellId: 'well-2', preset: 'HIDDEN_CONTAMINATION' },
      { type: 'SEND_PERSON', personId: 'amina', target: 'well-2' },
    );
    const volumeBefore = s.wells['well-2'].factors.waterVolumePct;
    s = runUntil(s, (x) => x.wells['well-2'].factors.reportedAnomaly === 'SUSPECTED');
    expect(deriveLocal(s, 'well-2').primary).toBe('UNKNOWN');
    expect(s.wells['well-2'].factors.waterVolumePct).toBe(volumeBefore);
    s = runUntil(s, (x) => x.center['well-2'].status === 'UNKNOWN');
    expect(s.center['well-2'].status).not.toBe('CONTAMINATED');
  });

  it('la trabajadora verifica: positivo → CONTAMINATED en el pozo y en el centro', () => {
    let s = act(
      fresh(),
      { type: 'QUICK_PRESET', wellId: 'well-2', preset: 'HIDDEN_CONTAMINATION' },
      { type: 'COMMUNITY_REPORT', wellId: 'well-2', kind: 'BAD' },
      { type: 'SEND_PERSON', personId: 'worker', target: 'well-2' },
    );
    s = runUntil(s, (x) => x.center['well-2'].status === 'CONTAMINATED');
    expect(deriveLocal(s, 'well-2').primary).toBe('CONTAMINATED');
  });

  it('botón BIEN no habilita un pozo en sospecha', () => {
    let s = act(fresh(), { type: 'COMMUNITY_REPORT', wellId: 'well-2', kind: 'BAD' });
    s = act(s, { type: 'COMMUNITY_REPORT', wellId: 'well-2', kind: 'GOOD' }, { type: 'COMMUNITY_REPORT', wellId: 'well-2', kind: 'GOOD' });
    s = run(s, 4000);
    expect(deriveLocal(s, 'well-2').primary).toBe('UNKNOWN');
    expect(s.center['well-2'].status).toBe('UNKNOWN');
  });

  it('rojo sanitario no se borra por tratar el pozo ni por reconectar; solo con nueva prueba', () => {
    let s = act(fresh(), { type: 'QUICK_PRESET', wellId: 'well-2', preset: 'CONFIRMED_POSITIVE' });
    s = act(s, { type: 'TREAT_WELL', wellId: 'well-2' }, { type: 'RESTORE_NETWORK' });
    s = run(s, 5000);
    expect(deriveLocal(s, 'well-2').primary).toBe('CONTAMINATED');
    s = act(s, { type: 'SEND_PERSON', personId: 'worker', target: 'well-2' });
    s = runUntil(s, (x) => x.center['well-2'].status === 'ENABLED');
    expect(deriveLocal(s, 'well-2').primary).toBe('ENABLED');
  });
});

describe('lluvia y visita semanal', () => {
  it('lluvia → todo sin verificar; la visita de la trabajadora rehabilita', () => {
    let s = act(fresh(), { type: 'RAIN_START' });
    s = run(s, 3000);
    expect(s.center['well-1'].status).toBe('UNKNOWN');
    expect(deriveVillageState(s.center, s.clockMs, true).signal).toBe('RED');
    s = act(s, { type: 'WORKER_ROUND' });
    s = runUntil(s, (x) => ['well-1', 'well-2', 'well-3'].every((id) => x.center[id as 'well-1'].status === 'ENABLED'), 120000);
    expect(s.clockMs).toBeLessThan(DEMO_CONFIG.rainWindowDays * DEMO_CONFIG.dayMs);
  });
});

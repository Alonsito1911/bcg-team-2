import { describe, expect, it } from 'vitest';
import { deriveLocal } from '../src/domain/state';
import { act, fresh, logText, run, runUntil } from './helpers';

describe('fase MVP: sin sensores, la comunidad reporta', () => {
  for (const preset of ['NO_WATER', 'VALVE_DAMAGE', 'CONTAMINATED'] as const) {
    it(`${preset}: la falla física no llega al pueblo hasta que alguien la reporta`, () => {
      let s = act(fresh(42, 'MVP'), { type: 'QUICK_PRESET', wellId: 'well-1', preset });
      s = run(s, 5000);
      expect(s.center['well-1'].status).toBe('ENABLED');
      expect(deriveLocal(s, 'well-1').primary).toBe('ENABLED');

      s = act(s, { type: 'SEND_PERSON', personId: 'amina', target: 'well-1' });
      s = runUntil(s, (x) => x.center['well-1'].status !== 'ENABLED');
      expect(s.center['well-1'].status).toBe('UNKNOWN');
      expect(s.wells['well-1'].communityReports.at(-1)?.kind).toBe('BAD');
      // Nadie recogió agua del pozo con falla.
      expect(logText(s)).not.toMatch(/recogió .* en Pozo A/);
    });
  }

  it('la guardiana registra la causa real: válvula rota', () => {
    let s = act(fresh(42, 'MVP'), { type: 'QUICK_PRESET', wellId: 'well-3', preset: 'VALVE_DAMAGE' }, { type: 'COMMUNITY_REPORT', wellId: 'well-3', kind: 'BAD', reason: 'VALVE' });
    s = act(s, { type: 'SEND_PERSON', personId: 'worker', target: 'well-3' });
    s = runUntil(s, (x) => x.center['well-3'].status === 'VALVE_DAMAGE', 90000);
    expect(s.center['well-3'].factors?.reportedAnomaly).toBe('NONE');
  });

  it('sin antena la ONG no se entera; el retiro manual la actualiza', () => {
    let s = act(fresh(42, 'MVP'), { type: 'QUICK_PRESET', wellId: 'well-2', preset: 'CONFIRMED_POSITIVE' });
    s = run(s, 8000);
    expect(s.center['well-2'].status).toBe('CONTAMINATED');
    expect(s.cloud['well-2'].status).toBe('ENABLED');
    s = act(s, { type: 'MANUAL_EXTRACT' });
    expect(s.cloud['well-2'].status === 'CONTAMINATED' || s.seen.cloud.length > 0).toBe(true);
    s = run(s, 200);
    expect(s.cloud['well-2'].status).toBe('CONTAMINATED');
  });

  it('en Estrella el sensor informa solo, pero la contaminación sigue requiriendo a una persona', () => {
    let s = act(fresh(42, 'STAR'), { type: 'QUICK_PRESET', wellId: 'well-1', preset: 'NO_WATER' }, { type: 'QUICK_PRESET', wellId: 'well-2', preset: 'CONTAMINATED' });
    s = run(s, 5000);
    expect(s.center['well-1'].status).toBe('NO_WATER');
    expect(s.center['well-2'].status).toBe('ENABLED');
  });
});

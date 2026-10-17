import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/domain/engine';
import { loadScenario, runNextStep, SCENARIOS } from '../src/domain/scenarios';
import type { SimulationState } from '../src/domain/types';

/** Avanza verificando el invariante de seguridad de rutas en cada tick. */
function runSafe(s: SimulationState, ms: number): SimulationState {
  let out = s;
  for (let t = 0; t < ms; t += 100) {
    out = applyAction(out, { type: 'TICK', dtMs: 100 });
    for (const p of out.people) {
      if (p.role !== 'VILLAGER' || p.intent !== 'COLLECT' || p.activity !== 'WALKING' || !p.target) continue;
      if (out.connectivity.gatewayPowered) expect(out.center[p.target].status).toBe('ENABLED');
    }
    for (const p of out.people) {
      if (p.activity === 'COLLECTING' && p.target) {
        // Nunca recoger de un pozo cuya verdad física no está habilitada.
        expect(out.wells[p.target].hiddenContamination).toBe(false);
      }
    }
  }
  return out;
}

describe('catálogo de escenarios', () => {
  for (const sc of SCENARIOS) {
    it(`${sc.code} ${sc.title}: todos los pasos se ejecutan respetando las reglas`, () => {
      let s = loadScenario(sc.id);
      for (let i = 0; i < sc.steps.length; i++) {
        s = runNextStep(s);
        s = runSafe(s, 30000);
      }
      expect(s.scenario?.stepIndex).toBe(sc.steps.length);
    });
  }
});

describe('historia MVP: hitos', () => {
  it('falla → reporte → franja roja → guardiana confirma → retiro manual', () => {
    let s = loadScenario('mvp');
    expect(s.phase).toBe('MVP');
    s = runSafe(runNextStep(s), 20000); // 1 todo verde
    expect(s.lastCenterSignal).toBe('GREEN');

    s = runSafe(runNextStep(s), 3000); // 2 falla silenciosa
    expect(s.center['well-2'].status).toBe('ENABLED');

    s = runSafe(runNextStep(s), 25000); // 3 Lokol reporta
    expect(s.center['well-2'].status).toBe('UNKNOWN');
    expect(s.center['well-2'].factors?.reportReason).toBe('CONTAMINATION');

    s = runSafe(runNextStep(s), 20000); // 4 nadie va al B

    s = runSafe(runNextStep(s), 40000); // 5 guardiana confirma
    expect(s.center['well-2'].status).toBe('CONTAMINATED');

    s = runSafe(runNextStep(s), 40000); // 6 descubre C
    expect(s.center['well-3'].status).toBe('CONTAMINATED');

    s = runSafe(runNextStep(s), 25000); // 7 todos al A
    expect(s.center['well-1'].status).toBe('ENABLED');

    expect(s.cloud['well-2'].status).toBe('ENABLED'); // la ONG aún no sabe (sin antena)
    s = runSafe(runNextStep(s), 2000); // 8 retiro manual
    expect(s.cloud['well-2'].status).toBe('CONTAMINATED');
    expect(s.lastManualExtractAt).not.toBeNull();
  });
});

describe('historia Estrella: hitos', () => {
  it('sensores, cola, réplica y ronda preventiva', () => {
    let s = loadScenario('star');
    s = runSafe(runNextStep(s), 6000); // sensor
    expect(s.center['well-1'].status).toBe('NO_WATER');
    expect(s.cloud['well-1'].status).toBe('NO_WATER');
    s = runSafe(runNextStep(s), 6000); // corte
    expect(s.center['well-3'].status).toBe('ENABLED');
    s = runSafe(runNextStep(s), 8000); // réplica
    expect(s.center['well-3'].status).toBe('VALVE_DAMAGE');
    expect(s.center['well-3'].via).toBe('LORA_RELAY');
  });
});

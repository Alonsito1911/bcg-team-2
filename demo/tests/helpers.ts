import { applyAction, type Action } from '../src/domain/engine';
import { createInitialState } from '../src/domain/state';
import type { SimulationState } from '../src/domain/types';

/** Por defecto fase ESTRELLA (sensores + antena); los tests de MVP piden 'MVP'. */
export function fresh(seed = 42, phase: SimulationState['phase'] = 'STAR'): SimulationState {
  return createInitialState(seed, phase);
}

export function act(s: SimulationState, ...actions: Action[]): SimulationState {
  return actions.reduce(applyAction, s);
}

/** Avanza el reloj lógico `ms` milisegundos en ticks de 100 ms. */
export function run(s: SimulationState, ms: number): SimulationState {
  let out = s;
  for (let t = 0; t < ms; t += 100) out = applyAction(out, { type: 'TICK', dtMs: 100 });
  return out;
}

/** Avanza hasta que se cumpla la condición (o falla tras `maxMs`). */
export function runUntil(s: SimulationState, cond: (s: SimulationState) => boolean, maxMs = 60000): SimulationState {
  let out = s;
  for (let t = 0; t < maxMs; t += 100) {
    if (cond(out)) return out;
    out = applyAction(out, { type: 'TICK', dtMs: 100 });
  }
  throw new Error(`condición no alcanzada en ${maxMs} ms`);
}

export function logText(s: SimulationState): string {
  return s.log.map((l) => l.text).join('\n');
}

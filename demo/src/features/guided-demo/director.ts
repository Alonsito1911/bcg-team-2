// Director de la demo guiada: traduce cada paso (decidido desde el teléfono y persistido
// en el backend real) a acciones sobre una simulación PROPIA, aislada del simulador libre.
// Todo lo que pasa aquí (radio, semáforo, ONG) es simulado y determinista.
import { advance, applyAction, type Action } from '../../domain/engine';
import { createInitialState } from '../../domain/state';
import type { SimulationState } from '../../domain/types';
import { REPORT_STEP } from './demoMachine';

export const DEMO_SEED = 77;
export const DEMO_WELL = 'well-2' as const;

/** Acciones al ENTRAR en cada paso (avanzando). */
export function actionsForStep(step: number): Action[] {
  switch (step) {
    case 1:
      return [{ type: 'WORKER_VISIT', wellId: DEMO_WELL }];
    case 2:
      // La contaminación existe en el terreno; la detecta la prueba de la guardiana.
      return [
        { type: 'QUICK_PRESET', wellId: DEMO_WELL, preset: 'CONTAMINATED' },
        { type: 'PERSON_SAY', personId: 'worker', text: '¡Está contaminada! E. coli (prueba simulada)', ms: 600000 },
      ];
    case 4:
      // El reporte (persistido en el backend real) entra a la red simulada. La nube se
      // retiene hasta el paso siguiente para que se vea viajar la alerta a la ONG.
      return [
        { type: 'SET_LINK', target: { kind: 'cloud' }, on: false },
        { type: 'GUARDIAN_REPORT', wellId: DEMO_WELL },
        { type: 'SEND_PERSON', personId: 'akai', target: 'AUTO' },
      ];
    case 5:
      return [{ type: 'SET_LINK', target: { kind: 'cloud' }, on: true }];
    default:
      return [];
  }
}

export function freshDemoState(): SimulationState {
  return applyAction(createInitialState(DEMO_SEED, 'STAR'), { type: 'SET_PAUSED', paused: false });
}

function apply(s: SimulationState, actions: Action[]): SimulationState {
  return actions.reduce(applyAction, s);
}

function settle(s: SimulationState, ms: number): SimulationState {
  const out = structuredClone(s);
  advance(out, ms);
  return out;
}

/**
 * Reconstruye la simulación para mostrar `step`. Los pasos anteriores se aplican y se
 * adelantan en el tiempo (sin animación); el paso actual se aplica para animarse en vivo.
 * Los pasos posteriores al reporte solo existen si el reporte fue confirmado por el backend.
 */
export function buildStateForStep(step: number, reported: boolean): SimulationState {
  const target = !reported && step > REPORT_STEP ? REPORT_STEP : step;
  let s = freshDemoState();
  for (let k = 1; k < target; k++) {
    s = apply(s, actionsForStep(k));
    s = settle(s, 20000);
  }
  if (target >= 1) s = apply(s, actionsForStep(target));
  return s;
}

/** Transición incremental (avance de 1 paso): aplica solo lo nuevo para que se anime. */
export function stepForward(s: SimulationState, toStep: number): SimulationState {
  return apply(s, actionsForStep(toStep));
}

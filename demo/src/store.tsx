import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from 'react';
import { applyAction, type Action } from './domain/engine';
import { loadState, saveState } from './domain/persistence';
import { loadScenario, runNextStep } from './domain/scenarios';
import { createInitialState } from './domain/state';
import type { SimulationState } from './domain/types';

export type UiAction = Action | { type: 'SCENARIO_LOAD'; id: string } | { type: 'SCENARIO_NEXT' };

function reducer(state: SimulationState, action: UiAction): SimulationState {
  if (action.type === 'SCENARIO_LOAD') return loadScenario(action.id);
  if (action.type === 'SCENARIO_NEXT') {
    const next = runNextStep(state);
    return next.paused && state.scenario ? { ...next, paused: false } : next;
  }
  return applyAction(state, action);
}

interface Ctx {
  state: SimulationState;
  dispatch: Dispatch<UiAction>;
}

const SimContext = createContext<Ctx | null>(null);

export function SimProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadState() ?? createInitialState());
  const speedRef = useRef(state.speed);
  speedRef.current = state.speed;
  const pausedRef = useRef(state.paused);
  pausedRef.current = state.paused;

  // Reloj: el motor es la verdad; esto solo le entrega tiempo real cuando no está en pausa.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(now - last, 200);
      if (dt >= 40) {
        last = now;
        if (!pausedRef.current) dispatch({ type: 'TICK', dtMs: dt * speedRef.current });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Persistencia (estado + outbox + cronología) para sobrevivir a una recarga.
  useEffect(() => {
    const id = window.setTimeout(() => saveState(state), 400);
    return () => window.clearTimeout(id);
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <SimContext.Provider value={value}>{children}</SimContext.Provider>;
}

export function useSim(): Ctx {
  const ctx = useContext(SimContext);
  if (!ctx) throw new Error('useSim fuera de SimProvider');
  return ctx;
}

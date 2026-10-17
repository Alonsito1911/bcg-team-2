import { useCallback, useEffect, useState } from 'react';
import type { DemoEventRecord, DemoSnapshot } from './demoMachine';
import { shouldAccept, subscribe, type DemoConnectionStatus } from './api/demoClient';

export interface DemoSessionView {
  snapshot: DemoSnapshot | null;
  events: DemoEventRecord[];
  status: DemoConnectionStatus;
  error: string | null;
  /** Aplica un snapshot recibido por otra vía (respuesta de comando / heartbeat) respetando epoch/revisión. */
  applySnapshot: (snapshot: DemoSnapshot | null | undefined) => void;
}

interface State {
  room: string | null;
  snapshot: DemoSnapshot | null;
  events: DemoEventRecord[];
  status: DemoConnectionStatus;
  error: string | null;
}

const empty = (room: string | null): State => ({ room, snapshot: null, events: [], status: 'connecting', error: null });

export function useDemoSession(room: string | null): DemoSessionView {
  const [state, setState] = useState<State>(() => empty(room));

  useEffect(() => {
    setState(empty(room));
    if (!room) return;
    const cancel = subscribe(
      room,
      ({ snapshot, events }) =>
        setState((s) =>
          s.room !== room || !shouldAccept(s.snapshot, snapshot)
            ? s
            : { ...s, snapshot, events, error: null },
        ),
      (status) => setState((s) => (s.room === room ? { ...s, status } : s)),
      (err) => setState((s) => (s.room === room ? { ...s, error: err.message } : s)),
    );
    return cancel;
  }, [room]);

  const applySnapshot = useCallback((snapshot: DemoSnapshot | null | undefined) => {
    if (!snapshot) return;
    setState((s) => {
      if (s.room !== snapshot.room && s.room !== null && snapshot.room) return s;
      if (!shouldAccept(s.snapshot, snapshot)) return s;
      // Si cambió el epoch (RESET), los eventos anteriores ya no aplican.
      const events = s.snapshot && snapshot.epoch !== s.snapshot.epoch ? [] : s.events;
      return { ...s, snapshot, events };
    });
  }, []);

  const current = state.room === room ? state : empty(room);
  return { snapshot: current.snapshot, events: current.events, status: current.status, error: current.error, applySnapshot };
}

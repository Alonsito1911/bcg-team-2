import { useState } from 'react';
import { DEMO_CONFIG } from '../domain/config';
import { formatClock } from '../domain/state';
import type { LogFamily, SimulationState, WellId } from '../domain/types';
import { FAMILY_UI } from './labels';

const FILTERS: { id: 'ALL' | LogFamily; label: string }[] = [
  { id: 'ALL', label: 'Todo' },
  { id: 'AGUA', label: 'Agua' },
  { id: 'COMUNIDAD', label: 'Comunidad' },
  { id: 'RED', label: 'Red' },
];

export function LogList({ state, wellId, limit }: { state: SimulationState; wellId?: WellId; limit: number }) {
  const [filter, setFilter] = useState<'ALL' | LogFamily>('ALL');
  const entries = state.log.filter((l) => (!wellId || l.wellId === wellId) && (filter === 'ALL' || l.family === filter)).slice(-limit).reverse();
  return (
    <div className="log">
      <div className="filters" role="tablist" aria-label="Filtrar cronología">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} className={filter === f.id ? 'active' : ''} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <ol>
        {entries.length === 0 && <li className="empty">Sin eventos todavía</li>}
        {entries.map((l) => (
          <li key={l.id} className={`fam-${l.family}`}>
            <time>{formatClock(l.at)}</time>
            <span aria-hidden="true">{FAMILY_UI[l.family].icon}</span>
            <span>{l.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function EventTimeline({ state }: { state: SimulationState }) {
  const [open, setOpen] = useState(false);
  const last = state.log[state.log.length - 1];
  const day = Math.floor(state.clockMs / DEMO_CONFIG.dayMs) + 1;
  return (
    <footer className={`timeline ${open ? 'open' : ''}`}>
      <div className="bar">
        <span className="clock" aria-label="Reloj lógico">
          ⏱ {formatClock(state.clockMs)} · día {day}
          {state.paused ? ' · ⏸ en pausa' : ''}
        </span>
        <span className="last" role="status">
          {last ? `${FAMILY_UI[last.family].icon} ${last.text}` : '—'}
        </span>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Ocultar cronología ▾' : 'Ver cronología ▴'}
        </button>
      </div>
      {open && <LogList state={state} limit={10} />}
    </footer>
  );
}

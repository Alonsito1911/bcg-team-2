import { useState } from 'react';
import { deriveVillageState, isFresh } from '../domain/deriveVillageState';
import { SEMAPHORE_POS } from '../domain/geometry';
import { formatClock, WELL_NAMES } from '../domain/state';
import { WELL_IDS, type SimulationState } from '../domain/types';
import { Sprite } from '../assets/Sprite';
import { describeStatus, WELL_LETTER } from './labels';

/**
 * Semáforo del pueblo: un bloque con una franja por pozo (A, B, C).
 * Cada franja tiene dos círculos: IZQUIERDA verde = disponible · DERECHA roja = no usar.
 * Sin energía: ambos apagados (no se asume seguridad). Dato antiguo: la franja parpadea suave.
 */
export function VillageTrafficLight({ state }: { state: SimulationState }) {
  const [open, setOpen] = useState(false);
  const powered = state.connectivity.gatewayPowered;
  const v = deriveVillageState(state.center, state.clockMs, powered);

  return (
    <div className="semaphore" style={{ left: `${SEMAPHORE_POS.x}%`, top: `${SEMAPHORE_POS.y}%` }}>
      <button
        type="button"
        className={`sem-block ${powered ? '' : 'off'}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Semáforo del pueblo: ver detalle de cada pozo"
      >
        <span className="sem-antenna" aria-hidden="true" />
        <span className="sem-title">AGUA</span>
        {WELL_IDS.map((id) => {
          const k = state.center[id];
          const ok = powered && k.status === 'ENABLED';
          const bad = powered && k.status !== 'ENABLED';
          const stale = powered && !isFresh(k, state.clockMs);
          const d = describeStatus(k.status, k.factors);
          return (
            <span key={id} className={`sem-row ${stale ? 'stale' : ''}`} title={`${WELL_NAMES[id]}: ${powered ? d.label : 'sin información'}`}>
              <span className="sem-letter">{WELL_LETTER[id]}</span>
              <span className={`sem-lamp green ${ok ? 'on' : ''}`} aria-hidden="true" />
              <span className={`sem-lamp red ${bad ? 'on' : ''}`} aria-hidden="true" />
              <span className="sr-only">
                {WELL_NAMES[id]}: {powered ? (ok ? 'disponible' : `no usar (${d.label})`) : 'sin información'}
                {stale ? ', dato antiguo' : ''}
              </span>
            </span>
          );
        })}
        {!powered && <span className="sem-plate-off">⚠ SIN INFORMACIÓN</span>}
      </button>
      <span className="sem-pole" aria-hidden="true" />
      <div className="sem-base">
        <Sprite name="semaphore-base" alt="" className="sem-base-art" />
        <span className="sem-plate" role="status" aria-live="polite">
          {powered ? `${v.usable.length} de 3 disponibles` : 'Sin energía'}
          <small>{v.lastReceivedAt >= 0 ? `act. ${formatClock(v.lastReceivedAt)}` : ''}</small>
        </span>
      </div>
      {open && (
        <div className="popover" role="dialog" aria-label="Detalle del semáforo">
          <h4>Lo que sabe el centro del pueblo</h4>
          <p className="legend-row">
            <span className="sem-lamp green on" /> izquierda = disponible · <span className="sem-lamp red on" /> derecha = no usar
          </p>
          <ul>
            {WELL_IDS.map((id) => {
              const k = state.center[id];
              const d = describeStatus(k.status, k.factors);
              const stale = !isFresh(k, state.clockMs);
              return (
                <li key={id}>
                  <b>{WELL_NAMES[id]}</b>: {d.label}
                  {stale ? ' · dato antiguo' : ''}
                  <small> · {d.detail}</small>
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={() => setOpen(false)}>
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}

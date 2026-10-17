import { useState } from 'react';
import { DISCLAIMER } from '../domain/config';
import { deriveLocal, WELL_NAMES } from '../domain/state';
import { findScenario, SCENARIOS } from '../domain/scenarios';
import { WELL_IDS, type SimulationState, type WellId } from '../domain/types';
import type { QuickPreset } from '../domain/engine';
import type { UiAction } from '../store';

interface Props {
  state: SimulationState;
  dispatch: (a: UiAction) => void;
  advanced: boolean;
  setAdvanced: (v: boolean) => void;
  showArchitecture: boolean;
  setShowArchitecture: (v: boolean) => void;
  onRegion: () => void;
  onOpenOng: () => void;
}

const PRESET_OPTIONS: { value: QuickPreset; label: string }[] = [
  { value: 'ENABLED', label: '✔ Funciona bien' },
  { value: 'CONTAMINATED', label: '☣ Contaminación' },
  { value: 'NO_WATER', label: '◌ Sin agua' },
  { value: 'VALVE_DAMAGE', label: '🔧 Válvula dañada' },
];

/** Falla física actual del pozo (lo que pasa en el terreno, no lo que sabe el pueblo). */
function physicalPreset(state: SimulationState, id: WellId): QuickPreset {
  const w = state.wells[id];
  const d = deriveLocal(state, id).primary;
  if (w.hiddenContamination || d === 'CONTAMINATED') return 'CONTAMINATED';
  if (w.physicalValveBroken || d === 'VALVE_DAMAGE') return 'VALVE_DAMAGE';
  if (w.physicalDry || d === 'NO_WATER') return 'NO_WATER';
  return 'ENABLED';
}

export function ControlPanel({ state, dispatch, advanced, setAdvanced, showArchitecture, setShowArchitecture, onRegion, onOpenOng }: Props) {
  const [personId, setPersonId] = useState('amina');
  const [dest, setDest] = useState<WellId | 'AUTO'>('AUTO');
  const scenario = state.scenario ? findScenario(state.scenario.id) : undefined;
  const stepIndex = state.scenario?.stepIndex ?? 0;
  const nextStep = scenario?.steps[stepIndex];
  const lastStep = scenario && stepIndex > 0 ? scenario.steps[stepIndex - 1] : undefined;
  const c = state.connectivity;

  return (
    <aside className="panel" aria-label="Panel de control de la simulación">
      <header>
        <h1>
          WaterLight <span className="demo-tag">DEMO</span>
        </h1>
        <p>Pozos A, B y C · pueblo piloto · Kiryandongo (Uganda)</p>
        <p className="disclaimer" role="note">⚠ {DISCLAIMER}</p>
        <div className="phase-toggle" role="radiogroup" aria-label="Fase del producto">
          <button type="button" role="radio" aria-checked={state.phase === 'MVP'} className={state.phase === 'MVP' ? 'active' : ''} onClick={() => dispatch({ type: 'SET_PHASE', phase: 'MVP' })}>
            MVP
            <small>caja + guardiana</small>
          </button>
          <button type="button" role="radio" aria-checked={state.phase === 'STAR'} className={state.phase === 'STAR' ? 'active' : ''} onClick={() => dispatch({ type: 'SET_PHASE', phase: 'STAR' })}>
            ★ Estrella
            <small>sensores + antena</small>
          </button>
        </div>
      </header>

      <section>
        <h2>Pozos</h2>
        {WELL_IDS.map((id) => (
          <label key={id} className="row">
            <span>{WELL_NAMES[id]}</span>
            <select
              value={physicalPreset(state, id)}
              onChange={(e) => dispatch({ type: 'QUICK_PRESET', wellId: id, preset: e.target.value as QuickPreset })}
              aria-label={`Qué le pasa en el terreno a ${WELL_NAMES[id]}`}
            >
              {PRESET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        <p className="hint">
          {state.phase === 'MVP'
            ? 'Fase MVP: la falla ocurre en el terreno y el semáforo NO cambia hasta que alguien vaya, falle y la reporte con la caja.'
            : 'Fase Estrella: sin agua y válvula se detectan solas por sensor; la contaminación sigue necesitando a una persona.'}{' '}
          Toca un pozo para ver el detalle.
        </p>
      </section>

      <section>
        <h2>Personas</h2>
        <label className="row">
          <span>Personaje</span>
          <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
            {state.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="row">
          <span>Destino</span>
          <select value={dest} onChange={(e) => setDest(e.target.value as WellId | 'AUTO')}>
            <option value="AUTO">Auto (más cercano habilitado)</option>
            {WELL_IDS.map((id) => (
              <option key={id} value={id}>
                {WELL_NAMES[id]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn primary" onClick={() => dispatch({ type: 'SEND_PERSON', personId, target: dest })}>
          {personId === 'worker' ? (dest === 'AUTO' ? '🧪 Guardiana: ronda por los 3 pozos' : '🧪 Guardiana revisa este pozo') : '➜ Ir a buscar agua'}
        </button>
        <div className="btn-grid">
          <button type="button" className="btn" onClick={() => dispatch({ type: 'WORKER_ROUND' })}>
            🧪 Ronda semanal de la guardiana
          </button>
          <button type="button" className="btn" onClick={() => dispatch({ type: state.rain.startedAt === null ? 'RAIN_START' : 'RAIN_CLEAR' })}>
            {state.rain.startedAt === null ? '🌧 Simular lluvia (15 días)' : '☀ Terminar ventana de lluvia'}
          </button>
          {state.phase === 'MVP' && (
            <button type="button" className="btn" onClick={() => dispatch({ type: 'MANUAL_EXTRACT' })}>
              💾 Retiro manual → ONG
            </button>
          )}
          <button type="button" className="btn" onClick={onRegion}>
            🗺 Ver región y ONG
          </button>
          <button type="button" className="btn primary" onClick={onOpenOng}>
            📊 Dashboard ONG
          </button>
        </div>
      </section>

      <section>
        <h2>Simulación</h2>
        <div className="btn-grid four">
          <button type="button" className="btn primary" onClick={() => dispatch({ type: 'SET_PAUSED', paused: false })} disabled={!state.paused} aria-label="Reproducir">
            ▶
          </button>
          <button type="button" className="btn" onClick={() => dispatch({ type: 'SET_PAUSED', paused: true })} disabled={state.paused} aria-label="Pausar">
            ⏸
          </button>
          <button type="button" className="btn" onClick={() => dispatch({ type: 'STEP' })} aria-label="Paso a paso">
            ⏭
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => window.confirm('¿Reiniciar el escenario? Se pierde el estado actual.') && dispatch({ type: 'RESET' })}
            aria-label="Reset escenario"
          >
            ↻
          </button>
        </div>
        <label className="row">
          <span>Velocidad</span>
          <select value={state.speed} onChange={(e) => dispatch({ type: 'SET_SPEED', speed: Number(e.target.value) as 1 | 2 | 4 })}>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </label>
        <label className="row">
          <span>Escenario</span>
          <select value={state.scenario?.id ?? ''} onChange={(e) => e.target.value && dispatch({ type: 'SCENARIO_LOAD', id: e.target.value })}>
            <option value="">— libre —</option>
            {SCENARIOS.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.code} · {sc.title}
              </option>
            ))}
          </select>
        </label>
        {scenario && (
          <div className="scenario-card">
            <b>{scenario.title}</b>
            <small>{scenario.demonstrates}</small>
            {lastStep && (
              <p className="narration">
                <b>{lastStep.label}:</b> {lastStep.narration}
              </p>
            )}
            {nextStep ? (
              <button type="button" className="btn primary" onClick={() => dispatch({ type: 'SCENARIO_NEXT' })}>
                Paso {stepIndex + 1}/{scenario.steps.length}: {nextStep.label} ▸
              </button>
            ) : (
              <small className="done">✔ Historia completa</small>
            )}
          </div>
        )}
      </section>

      <section>
        <label className="check">
          <input type="checkbox" checked={showArchitecture} onChange={(e) => setShowArchitecture(e.target.checked)} /> Mostrar arquitectura de red
        </label>
        <label className="check">
          <input type="checkbox" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} /> ⚙ Parámetros avanzados
        </label>
        {advanced && (
          <div className="advanced">
            <h3>Red y dispositivos</h3>
            {WELL_IDS.map((id) => (
              <div key={id} className="toggles">
                <b>{WELL_NAMES[id]}</b>
                <Toggle label="LoRa" on={c.lora[id]} onChange={(on) => dispatch({ type: 'SET_LINK', target: { kind: 'lora', wellId: id }, on })} />
                <Toggle label="BLE" on={c.ble[id]} onChange={(on) => dispatch({ type: 'SET_LINK', target: { kind: 'ble', wellId: id }, on })} />
                <Toggle label="Energía" on={state.wells[id].powered} onChange={(on) => dispatch({ type: 'SET_LINK', target: { kind: 'wellPower', wellId: id }, on })} />
              </div>
            ))}
            <div className="toggles">
              <b>Centro</b>
              <Toggle label="Gateway" on={c.gatewayPowered} onChange={(on) => dispatch({ type: 'SET_LINK', target: { kind: 'gateway' }, on })} />
              <Toggle label="Internet" on={c.cloud} onChange={(on) => dispatch({ type: 'SET_LINK', target: { kind: 'cloud' }, on })} />
            </div>
            <label className="row">
              <span>Pérdida {c.packetLossPct}%</span>
              <input type="range" min={0} max={100} step={10} value={c.packetLossPct} onChange={(e) => dispatch({ type: 'SET_LOSS', pct: Number(e.target.value) })} />
            </label>
            <label className="row">
              <span>Latencia {c.latencyMs} ms</span>
              <input type="range" min={200} max={3000} step={100} value={c.latencyMs} onChange={(e) => dispatch({ type: 'SET_LATENCY', ms: Number(e.target.value) })} />
            </label>
            <p className="hint">
              seed {state.seed} · en cola {state.deliveries.filter((d) => d.status === 'QUEUED').length} · eventos {state.counters.event}
            </p>
            <button type="button" className="btn" onClick={() => dispatch({ type: 'RESTORE_NETWORK' })}>
              ♻ Restablecer red
            </button>
          </div>
        )}
      </section>
    </aside>
  );
}

export function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" className={`toggle ${on ? 'on' : 'off'}`} onClick={() => onChange(!on)} aria-pressed={on}>
      {label}: {on ? 'ON' : 'OFF'}
    </button>
  );
}

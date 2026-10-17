import { useEffect, useState } from 'react';
import { DEMO_CONFIG } from '../domain/config';
import { deriveLocal } from '../domain/state';
import type { SimulationState, WaterTest, WellId } from '../domain/types';
import type { UiAction } from '../store';
import { Sprite } from '../assets/Sprite';
import { ArchitectureMiniDemo } from './ArchitectureMiniDemo';
import { LogList } from './EventTimeline';
import { describeStatus, QUICK_STATES, spriteForState } from './labels';
import { diagnoseLink, pendingFor } from '../domain/transport';

type Tab = 'estado' | 'comunicacion' | 'historial';

const TEST_LABEL: Record<WaterTest, string> = {
  VALID_NEGATIVE: 'Negativa vigente (simulada)',
  CONFIRMED_POSITIVE: 'Positiva (resultado de laboratorio simulado)',
  PENDING: 'Pendiente',
  MISSING: 'Sin verificar',
  EXPIRED: 'Vencida',
};

interface Props {
  state: SimulationState;
  wellId: WellId;
  onClose: () => void;
  dispatch: (a: UiAction) => void;
}

export function WellDetailDrawer({ state, wellId, onClose, dispatch }: Props) {
  const [tab, setTab] = useState<Tab>('estado');
  const well = state.wells[wellId];
  const d = deriveLocal(state, wellId);
  const f = well.factors;
  const [volume, setVolume] = useState(Math.round(f.waterVolumePct));
  const [test, setTest] = useState<WaterTest>(f.waterTest);
  const [valve, setValve] = useState(f.valveCondition);
  const [validity, setValidity] = useState<number>(DEMO_CONFIG.testValidityDays);

  useEffect(() => {
    setVolume(Math.round(well.factors.waterVolumePct));
    setTest(well.factors.waterTest);
    setValve(well.factors.valveCondition);
  }, [wellId, well.factors.waterVolumePct, well.factors.waterTest, well.factors.valveCondition]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const daysLeft = Math.max(0, Math.round((f.testValidUntil - state.clockMs) / DEMO_CONFIG.dayMs));
  const status = describeStatus(d.primary, f);
  const known = describeStatus(state.center[wellId].status, state.center[wellId].factors);
  const diag = diagnoseLink(state, wellId);
  const pending = pendingFor(state, wellId).length;
  const goods = well.communityReports.filter((r) => r.kind === 'GOOD').length;
  const bads = well.communityReports.filter((r) => r.kind === 'BAD').length;

  return (
    <aside className="drawer" role="dialog" aria-label={`Detalle de ${well.name}`}>
      <header className="drawer-head">
        <Sprite name={spriteForState(d.primary)} alt="" className="drawer-art" />
        <div className="drawer-title">
          <h2>{well.name}</h2>
          <span className={`well-label ${status.cls}`}>
            <span>
              <span aria-hidden="true">{status.icon}</span> {status.label}
            </span>
          </span>
        </div>
        <button type="button" className="close" onClick={onClose} aria-label="Cerrar detalle">
          ×
        </button>
      </header>
      <p className={`drawer-verdict ${d.primary === 'ENABLED' ? 'ok' : 'bad'}`}>
        <b>{d.primary === 'ENABLED' ? 'Se puede usar' : 'No usar'}</b> · {d.reasons[0]}
      </p>
      <nav className="tabs" role="tablist">
        {(
          [
            ['estado', 'Estado'],
            ['comunicacion', 'Comunicación'],
            ['historial', 'Historial'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'estado' && (
        <div className="tab-body">
          <div className="well-stats">
            <div className="ws">
              <span className="ws-k">💧 Agua</span>
              <b>{Math.round(f.waterVolumePct)}%</b>
              <small>{d.primary === 'NO_WATER' ? 'bajo el mínimo' : d.lowReserve ? 'reserva baja' : 'suficiente'}</small>
            </div>
            <div className="ws">
              <span className="ws-k">⚙ Válvula</span>
              <b>{f.valveCondition === 'OK' ? 'Operativa' : 'Dañada'}</b>
              <small>sensor de bomba</small>
            </div>
            <div className="ws">
              <span className="ws-k">🧪 Prueba</span>
              <b>{f.waterTest === 'VALID_NEGATIVE' ? 'Negativa' : f.waterTest === 'CONFIRMED_POSITIVE' ? 'Positiva' : 'Sin verificar'}</b>
              <small>{f.waterTest === 'VALID_NEGATIVE' ? `vigente ${daysLeft} días` : 'simulada'}</small>
            </div>
            <div className="ws">
              <span className="ws-k">🚦 Semáforo</span>
              <b className={`txt-${known.cls}`}>{known.label}</b>
              <small>lo que sabe el pueblo</small>
            </div>
            <div className="ws">
              <span className="ws-k">📡 Enlace</span>
              <b>{!well.powered ? 'Sin energía' : diag.tone === 'ok' ? 'Activo' : diag.tone === 'warn' ? 'Vía relevo' : 'Sin enlace'}</b>
              <small>{pending ? `${pending} en cola` : `batería ${well.batteryPct}%`}</small>
            </div>
            <div className="ws">
              <span className="ws-k">👥 Reportes</span>
              <b>
                👍 {goods} · 👎 {bads}
              </b>
              <small>caja comunitaria</small>
            </div>
          </div>

          <section className="ds">
            <h3>Simular en el terreno</h3>
            <div className="seg">
              {QUICK_STATES.map((q) => (
                <button key={q.preset} type="button" className={`seg-btn state-${q.cls}`} onClick={() => dispatch({ type: 'QUICK_PRESET', wellId, preset: q.preset })}>
                  <span aria-hidden="true">{q.icon}</span> {q.label}
                </button>
              ))}
            </div>
            <p className="hint">
              {state.phase === 'MVP' ? 'MVP: la falla es silenciosa hasta que alguien la reporta o la guardiana la revisa.' : 'Estrella: sin agua y válvula se detectan solas; la contaminación necesita a una persona.'}
            </p>
          </section>

          <div className="ds-row">
            <section className="ds">
              <h3>Caja del pozo</h3>
              <div className="btn-grid">
                <button type="button" className="btn state-ok" onClick={() => dispatch({ type: 'COMMUNITY_REPORT', wellId, kind: 'GOOD' })}>
                  👍 BIEN
                </button>
                <button
                  type="button"
                  className="btn state-bad"
                  onClick={() =>
                    dispatch({
                      type: 'COMMUNITY_REPORT',
                      wellId,
                      kind: 'BAD',
                      reason: well.hiddenContamination ? 'CONTAMINATION' : well.physicalValveBroken ? 'VALVE' : well.physicalDry ? 'NO_WATER' : 'OTHER',
                    })
                  }
                >
                  👎 MAL
                </button>
              </div>
              <p className="hint">MAL deshabilita el pozo hasta que la guardiana lo revise.</p>
            </section>
            <section className="ds">
              <h3>Guardiana</h3>
              <div className="btn-col">
                <button type="button" className="btn" onClick={() => dispatch({ type: 'SEND_PERSON', personId: 'worker', target: wellId })}>
                  🧪 Verificar
                </button>
                {f.valveCondition === 'DAMAGED' || well.physicalValveBroken ? (
                  <button type="button" className="btn" onClick={() => dispatch({ type: 'WORKER_REPAIR', wellId })}>
                    🔧 Reparar válvula
                  </button>
                ) : null}
                {well.hiddenContamination ? (
                  <button type="button" className="btn" onClick={() => dispatch({ type: 'TREAT_WELL', wellId })}>
                    🧴 Clorar pozo
                  </button>
                ) : null}
              </div>
            </section>
          </div>

          <details className="ds advanced-box">
            <summary>Ajuste fino (avanzado)</summary>
            <label className="row">
              <span>💧 Volumen {volume}%</span>
              <input type="range" min={0} max={100} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
            </label>
            <label className="row">
              <span>🧪 Prueba</span>
              <select value={test} onChange={(e) => setTest(e.target.value as WaterTest)}>
                {(Object.keys(TEST_LABEL) as WaterTest[]).map((t) => (
                  <option key={t} value={t}>
                    {TEST_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="row">
              <span>⚙ Válvula</span>
              <select value={valve} onChange={(e) => setValve(e.target.value as 'OK' | 'DAMAGED')}>
                <option value="OK">Operativa</option>
                <option value="DAMAGED">Dañada</option>
              </select>
            </label>
            <label className="row">
              <span>⏳ Vigencia (días)</span>
              <input type="number" min={1} max={365} value={validity} onChange={(e) => setValidity(Number(e.target.value))} />
            </label>
            <div className="btn-grid">
              <button
                type="button"
                className="btn primary"
                onClick={() =>
                  dispatch({ type: 'EDIT_FACTORS', wellId, edit: { waterVolumePct: volume, valveCondition: valve, waterTest: test, validityDays: test !== f.waterTest ? validity : undefined } })
                }
              >
                Aplicar
              </button>
              <button type="button" className="btn" onClick={() => dispatch({ type: 'QUICK_PRESET', wellId, preset: 'CONFIRMED_POSITIVE' })}>
                🧾 Forzar positiva
              </button>
            </div>
            <p className="hint">
              Verificado por: {f.testVerifiedBy} · contaminación oculta: {well.hiddenContamination ? 'sí' : 'no'}
            </p>
          </details>
        </div>
      )}

      {tab === 'comunicacion' && (
        <div className="tab-body">
          <ArchitectureMiniDemo state={state} wellId={wellId} dispatch={dispatch} />
        </div>
      )}

      {tab === 'historial' && (
        <div className="tab-body">
          <LogList state={state} wellId={wellId} limit={40} />
        </div>
      )}
    </aside>
  );
}

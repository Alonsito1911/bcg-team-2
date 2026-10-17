import { useEffect, useState } from 'react';
import { DEMO_CONFIG } from '../domain/config';
import { deriveLocal, formatClock } from '../domain/state';
import type { SimulationState, WaterTest, WellId } from '../domain/types';
import type { UiAction } from '../store';
import { Sprite } from '../assets/Sprite';
import { ArchitectureMiniDemo } from './ArchitectureMiniDemo';
import { LogList } from './EventTimeline';
import { QUICK_STATES, spriteForState, STATE_UI } from './labels';

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
  const ui = STATE_UI[d.primary];
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
  const goods = well.communityReports.filter((r) => r.kind === 'GOOD').length;
  const bads = well.communityReports.filter((r) => r.kind === 'BAD').length;

  return (
    <aside className="drawer" role="dialog" aria-label={`Detalle de ${well.name}`}>
      <header>
        <Sprite name={spriteForState(d.primary)} alt="" className="drawer-art" />
        <div>
          <h2>
            {well.name} · <span className={`txt-${ui.cls}`}>{ui.label}</span>
          </h2>
          <p>
            ¿Puede usarse ahora? <b>{d.primary === 'ENABLED' ? 'Sí' : 'No'}</b> · {d.reasons[0]}
          </p>
        </div>
        <button type="button" className="close" onClick={onClose} aria-label="Cerrar detalle">
          ×
        </button>
      </header>
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
          <h3>¿Qué le pasa en el terreno?</h3>
          <div className="btn-grid">
            {QUICK_STATES.map((q) => (
              <button key={q.preset} type="button" className={`btn state-${q.cls}`} onClick={() => dispatch({ type: 'QUICK_PRESET', wellId, preset: q.preset })}>
                {q.icon} {q.label}
              </button>
            ))}
          </div>
          <p className="hint">
            {state.phase === 'MVP'
              ? 'En MVP la falla es silenciosa: el pueblo se entera cuando alguien la reporta o la guardiana la revisa.'
              : 'En Estrella los sensores informan sin agua y válvula; la contaminación sigue necesitando a una persona.'}
          </p>

          <h3>Caja comunitaria del pozo</h3>
          <div className="btn-grid">
            <button type="button" className="btn state-ok big" onClick={() => dispatch({ type: 'COMMUNITY_REPORT', wellId, kind: 'GOOD' })}>
              👍 BIEN
            </button>
            <button
              type="button"
              className="btn state-bad big"
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
          <p className="hint">
            MAL <b>deshabilita</b> el pozo en el semáforo hasta que la guardiana lo revise. BIEN se guarda como evidencia y nunca habilita. Reportes: 👍 {goods} · 👎 {bads}
          </p>

          <h3>Guardiana de la ONG (externa al pueblo)</h3>
          <div className="btn-grid">
            <button type="button" className="btn" onClick={() => dispatch({ type: 'SEND_PERSON', personId: 'worker', target: wellId })}>
              🧪 Enviar a verificar
            </button>
            <button type="button" className="btn" onClick={() => dispatch({ type: 'WORKER_REPAIR', wellId })} disabled={f.valveCondition !== 'DAMAGED'}>
              🔧 Reparar válvula
            </button>
            <button type="button" className="btn" onClick={() => dispatch({ type: 'TREAT_WELL', wellId })} disabled={!well.hiddenContamination}>
              🧴 Tratar pozo (cloración)
            </button>
            <button type="button" className="btn" onClick={() => dispatch({ type: 'QUICK_PRESET', wellId, preset: 'CONFIRMED_POSITIVE' })}>
              🧾 Forzar prueba positiva
            </button>
          </div>

          <h3>Factores (modo avanzado)</h3>
          <label className="row">
            <span>💧 Volumen {volume}% <small>(sensor)</small></span>
            <input type="range" min={0} max={100} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
          </label>
          <label className="row">
            <span>🧪 Prueba <small>(trabajadora)</small></span>
            <select value={test} onChange={(e) => setTest(e.target.value as WaterTest)}>
              {(Object.keys(TEST_LABEL) as WaterTest[]).map((t) => (
                <option key={t} value={t}>
                  {TEST_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="row">
            <span>⚙ Válvula <small>(sensor de bomba)</small></span>
            <select value={valve} onChange={(e) => setValve(e.target.value as 'OK' | 'DAMAGED')}>
              <option value="OK">Operativa</option>
              <option value="DAMAGED">Dañada</option>
            </select>
          </label>
          <label className="row">
            <span>⏳ Vigencia (días)</span>
            <input type="number" min={1} max={365} value={validity} onChange={(e) => setValidity(Number(e.target.value))} />
          </label>
          <button
            type="button"
            className="btn primary"
            onClick={() =>
              dispatch({ type: 'EDIT_FACTORS', wellId, edit: { waterVolumePct: volume, valveCondition: valve, waterTest: test, validityDays: test !== f.waterTest ? validity : undefined } })
            }
          >
            Aplicar al escenario
          </button>
          <dl className="facts">
            <dt>Última prueba</dt>
            <dd>
              {TEST_LABEL[f.waterTest]} · {formatClock(f.testTakenAt)} · {f.waterTest === 'VALID_NEGATIVE' ? `vigente ${daysLeft} días` : '—'}
            </dd>
            <dt>Verificado por</dt>
            <dd>{f.testVerifiedBy}</dd>
            <dt>Sospecha</dt>
            <dd>{f.reportedAnomaly === 'SUSPECTED' ? 'Sí (reporte comunitario)' : 'No'}</dd>
            <dt>Contaminación oculta</dt>
            <dd>{well.hiddenContamination ? 'Sí (solo visible para el operador)' : 'No'}</dd>
            <dt>Batería</dt>
            <dd>{well.powered ? `${well.batteryPct}%` : 'Sin energía'}</dd>
            {d.secondary.length > 0 && (
              <>
                <dt>Problemas adicionales</dt>
                <dd>{d.secondary.map((x) => STATE_UI[x].label).join(', ')}</dd>
              </>
            )}
          </dl>
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

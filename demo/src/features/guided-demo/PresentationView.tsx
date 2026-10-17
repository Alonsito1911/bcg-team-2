import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Sprite } from '../../assets/Sprite';
import { OngDashboard } from '../../components/OngDashboard';
import { TeamOngDashboard } from '../../components/TeamOngDashboard';
import { WorldView } from '../../components/WorldView';
import { applyAction } from '../../domain/engine';
import type { SimulationState } from '../../domain/types';
import { createSession, sendCommand } from './api/demoClient';
import { applyDemoCommand, DEMO_STEPS, initialSnapshot, PILOT_PUMP, REPORT_STEP, type DemoCommandType, type DemoSnapshot } from './demoMachine';
import { buildStateForStep, freshDemoState, stepForward } from './director';
import { PairingPanel } from './PairingPanel';
import { useDemoSession } from './useDemoSession';
import './presentation.css';

type SimAction = { type: 'TICK'; dtMs: number } | { type: 'SET'; state: SimulationState } | { type: 'FORWARD'; step: number };

function simReducer(s: SimulationState, a: SimAction): SimulationState {
  if (a.type === 'SET') return a.state;
  if (a.type === 'FORWARD') return stepForward(s, a.step);
  return applyAction(s, a);
}

interface Session {
  room: string;
  token: string | null;
  mode: 'remote' | 'local';
}

const ONG_STEP = DEMO_STEPS.findIndex((s) => s.id === 'ngo-alert');
const DASHBOARD_STEP = DEMO_STEPS.findIndex((s) => s.id === 'ngo-dashboard');

export function PresentationView({ onExit, joinRoom }: { onExit: () => void; joinRoom?: string | null }) {
  const [session, setSession] = useState<Session | null>(
    joinRoom ? { room: joinRoom, token: sessionStorage.getItem(`gd-token-${joinRoom}`), mode: 'remote' } : null,
  );
  const [localSnap, setLocalSnap] = useState<DemoSnapshot | null>(null);
  const [keyboardUsed, setKeyboardUsed] = useState(false);
  const remote = useDemoSession(session?.mode === 'remote' ? session.room : null);
  const snapshot = session?.mode === 'local' ? localSnap : remote.snapshot;

  // 1) Crear (o unirse a) la sesión compartida real. Sin servidor: modo ensayo local rotulado.
  useEffect(() => {
    if (session) return;
    let cancelled = false;
    createSession()
      .then((r) => {
        if (cancelled) return;
        // Recargar el notebook vuelve a esta misma sala (la clave queda solo en esta pestaña).
        sessionStorage.setItem(`gd-token-${r.room}`, r.controllerToken);
        window.history.replaceState(null, '', `${window.location.pathname}?demo=${r.room}&role=display`);
        setSession({ room: r.room, token: r.controllerToken, mode: 'remote' });
      })
      .catch(() => {
        if (cancelled) return;
        setSession({ room: 'LOCAL', token: null, mode: 'local' });
        setLocalSnap(initialSnapshot('LOCAL', new Date().toISOString()));
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  // 2) Simulación propia de la demo (aislada del simulador libre) con su reloj.
  const [sim, dispatchSim] = useReducer(simReducer, undefined, freshDemoState);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(now - last, 200);
      if (dt >= 40) {
        last = now;
        dispatchSim({ type: 'TICK', dtMs: dt });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // 3) Cada snapshot confirmado por el backend mueve la historia (avance animado o reconstrucción).
  const prev = useRef<{ epoch: number; step: number; reported: boolean } | null>(null);
  const [zoom, setZoom] = useState<{ target: 'village' | 'region'; n: number }>({ target: 'village', n: 0 });
  const pending = useRef<number | null>(null);
  useEffect(() => {
    if (!snapshot) return;
    const p = prev.current;
    const { epoch, step, reported } = snapshot;
    if (pending.current !== null) {
      window.clearTimeout(pending.current);
      pending.current = null;
    }
    if (p && p.epoch === epoch && step === p.step + 1 && (reported || step <= REPORT_STEP)) {
      // Hacia la ONG: esperar a que la cámara se aleje para que se vea viajar la alerta.
      if (step === ONG_STEP) pending.current = window.setTimeout(() => dispatchSim({ type: 'FORWARD', step }), 1400);
      else dispatchSim({ type: 'FORWARD', step });
    } else if (!p || p.epoch !== epoch || p.step !== step) {
      dispatchSim({ type: 'SET', state: buildStateForStep(step, reported) });
    }
    prev.current = { epoch, step, reported };
    const target = step >= ONG_STEP ? 'region' : 'village';
    setZoom((z) => (z.target === target && z.n > 0 ? z : { target, n: z.n + 1 }));
  }, [snapshot]);

  // 4) Respaldo de ensayo: teclado del notebook (rotulado). El reporte normal se hace desde el teléfono.
  const command = useCallback(
    async (type: DemoCommandType) => {
      if (!snapshot || !session) return;
      if (session.mode === 'local') {
        const r = applyDemoCommand(snapshot, type, new Date().toISOString(), `local-${Date.now()}`);
        if (r) setLocalSnap(r.snapshot);
        return;
      }
      if (session.token) await sendCommand(session.room, type, snapshot.revision, session.token);
    },
    [snapshot, session],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
      const map: Record<string, DemoCommandType> = { ArrowRight: 'NEXT', ArrowLeft: 'PREV' };
      const type = e.shiftKey && e.key.toLowerCase() === 'r' ? 'REPORT_CONTAMINATION' : map[e.key];
      if (!type) return;
      setKeyboardUsed(true);
      void command(type);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [command, onExit]);

  const step = snapshot?.step ?? 0;
  const meta = DEMO_STEPS[step];
  const controllerOnline = !!snapshot?.controllerSeenAt && Date.now() - new Date(snapshot.controllerSeenAt).getTime() < 25000;
  const replay = !!snapshot?.reported && step <= REPORT_STEP;
  const ongKnows = sim.cloud['well-2'].status === 'CONTAMINATED';
  // Mismo criterio visual que el mapa: la ONG "recibe" cuando el paquete termina su recorrido.
  const cloudSend = [...sim.deliveries].reverse().find((d) => d.to === 'cloud' && d.startedAt !== undefined);
  const ongArrived = ongKnows && (!cloudSend || sim.clockMs - cloudSend.startedAt! >= 2600);

  if (step === DASHBOARD_STEP && snapshot?.reported) {
    return (
      <div className="gd-pres gd-pres-ong">
        <TeamOngDashboard
          room={session?.mode === 'remote' ? session.room : 'latest'}
          onBack={() => void command('PREV')}
          backLabel="◂ Volver a la escena"
          banner={
            <div className="team-ong-alert" role="alert">
              <span className="ong-alert-dot" aria-hidden="true" />
              <b>Alerta recibida · Pozo B contaminado</b>
              <span>
                pueblo piloto → bomba {PILOT_PUMP.codigo} ({PILOT_PUMP.lugar}) en el mapa · prueba simulada validada por la guardiana
                {session?.mode === 'remote' && snapshot.reportEventId ? ` · evento real #${snapshot.reportEventId.slice(0, 8)}` : ''}
              </span>
            </div>
          }
          fallback={
            <OngDashboard
              state={sim}
              dispatch={() => undefined}
              onBack={() => void command('PREV')}
              focusAlert={{ eventId: session?.mode === 'remote' ? snapshot.reportEventId : null, reportedAt: snapshot.reportedAt }}
              presentation
            />
          }
        />
        <Chrome step={step} onExit={onExit} status={session?.mode === 'local' ? 'local' : remote.status} keyboardUsed={keyboardUsed} />
      </div>
    );
  }

  return (
    <div className="gd-pres">
      <WorldView
        state={sim}
        selected={null}
        onSelect={() => undefined}
        showArchitecture={step >= REPORT_STEP + 1}
        onOpenOng={() => void command('NEXT')}
        zoomRequest={zoom}
        presentation={{ ongAlertLabel: ongKnows ? 'Alerta recibida: Pozo B contaminado' : null }}
      />

      {(step === 2 || step === 3) && <TestFrame waiting={step === 3 && !snapshot?.reported} replay={replay} />}

      {step === REPORT_STEP + 1 && snapshot?.reported && (
        <div className="gd-toast" role="status">
          <b>✓ Reporte guardado en el servidor</b>
          <span>
            {session?.mode === 'remote' && snapshot.reportEventId ? `evento #${snapshot.reportEventId.slice(0, 8)} · ` : 'modo ensayo · '}
            fuente: guardiana (prueba simulada)
          </span>
          <small>📡 Ahora viaja por radio LoRa (simulada) hasta el semáforo del pueblo</small>
        </div>
      )}
      {step === ONG_STEP && (
        <div className="gd-toast" role="status">
          <b>{ongArrived ? '✓ La ONG recibió la alerta' : 'La alerta viaja a la ONG…'}</b>
          <span>Centro del pueblo → torre → internet (simulado) → ONG regional</span>
          <small>Toca el edificio de la ONG o avanza para ver su dashboard</small>
        </div>
      )}

      <div className="gd-caption" aria-live="polite">
        <span className="gd-step">
          Paso {step + 1}/{DEMO_STEPS.length}
        </span>
        <b>{meta.title}</b>
        <span>{meta.narration}</span>
      </div>

      {session && step === 0 && !controllerOnline && session.mode === 'remote' && (
        <div className="gd-pairing-slot">
          <PairingPanel room={session.room} controllerToken={session.token} snapshot={snapshot} status={remote.status} />
        </div>
      )}
      <Chrome step={step} onExit={onExit} status={session?.mode === 'local' ? 'local' : remote.status} keyboardUsed={keyboardUsed} controllerOnline={controllerOnline} />
    </div>
  );
}

function Chrome({ onExit, status, keyboardUsed, controllerOnline }: { step: number; onExit: () => void; status: string; keyboardUsed: boolean; controllerOnline?: boolean }) {
  const label =
    status === 'local'
      ? 'Modo ensayo local · sin servidor ni teléfono'
      : status === 'live'
        ? controllerOnline
          ? '📱 Teléfono conectado'
          : 'Servidor conectado'
        : status === 'polling'
          ? 'Conectado (sondeo)'
          : status === 'offline'
            ? 'Sin conexión: reconectando…'
            : 'Conectando…';
  return (
    <div className="gd-chrome">
      <span className={`gd-conn ${status}`}>{label}</span>
      {keyboardUsed && <span className="gd-conn rehearsal">Modo ensayo (teclado)</span>}
      <button type="button" onClick={onExit} aria-label="Salir de la demo">
        ✕
      </button>
    </div>
  );
}

/** Recuadro central: el Pozo B grande, la guardiana haciendo la prueba y el resultado simulado. */
function TestFrame({ waiting, replay }: { waiting: boolean; replay: boolean }) {
  return (
    <div className="gd-frame-backdrop">
      <div className="gd-frame" role="dialog" aria-label="Prueba en el Pozo B">
        <div className="gd-frame-art">
          <Sprite name="well-contaminated" alt="Pozo B" className="gd-frame-well" />
          <div className="gd-frame-guardian">
            <div className="gd-bubble">¡Está contaminada!</div>
            <Sprite name="field-worker" alt="Guardiana" className="gd-frame-person" />
          </div>
          <svg className="gd-kit" viewBox="0 0 40 60" aria-hidden="true">
            <rect x="12" y="4" width="16" height="44" rx="7" fill="#fff9ed" stroke="#3A2C26" strokeWidth="2.4" />
            <rect x="12" y="28" width="16" height="20" rx="7" fill="#c9a24a" className="gd-kit-fill" />
            <rect x="9" y="2" width="22" height="6" rx="2" fill="#3186C7" stroke="#3A2C26" strokeWidth="2" />
          </svg>
        </div>
        <div className="gd-frame-results">
          <h3>Pozo B · prueba de campo</h3>
          <ul>
            <li className="r1">pH 7,1 · turbidez 6 NTU <small>(indicadores complementarios)</small></li>
            <li className="r2 bad">Prueba microbiológica SIMULADA: positivo para E. coli</li>
            <li className="r3">Validado por la guardiana (simulado)</li>
          </ul>
          <p className="gd-note">Secuencia acelerada · resultado simulado. El semáforo del pueblo todavía está en verde: nadie más lo sabe.</p>
          {waiting && (
            <div className="gd-wait">
              <span className="gd-phone" aria-hidden="true">📱</span>
              <b>Esperando la confirmación desde el teléfono de la guardiana…</b>
            </div>
          )}
          {replay && <p className="gd-replay">Repetición del paso: el reporte ya está guardado y no se vuelve a enviar.</p>}
        </div>
      </div>
    </div>
  );
}

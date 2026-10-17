import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import './remote.css';
import { DEMO_STEPS, LAST_STEP, REPORT_STEP, canApply, type DemoCommandResponse, type DemoCommandType } from './demoMachine';
import { DemoNetworkError, heartbeat, newCommandId, sendCommand, type DemoConnectionStatus } from './api/demoClient';
import { useDemoSession } from './useDemoSession';

export interface RemoteViewProps {
  room: string;
  token: string;
}

type ReportPhase = 'idle' | 'sending' | 'done' | 'network-error';

const HEARTBEAT_MS = 10_000;

const STATUS_LABEL: Record<DemoConnectionStatus, string> = {
  connecting: 'Reconectando…',
  live: 'Conectado',
  polling: 'Reconectando…',
  offline: 'Sin conexión',
};

function errorMessage(res: DemoCommandResponse): string {
  switch (res.error) {
    case 'CONFLICT':
      return 'La pantalla ya había cambiado: estado actualizado.';
    case 'INVALID_TRANSITION':
      return 'Esa acción no aplica en este paso: estado actualizado.';
    case 'UNAUTHORIZED':
      return 'Clave de control inválida. Vuelve a escanear el QR.';
    case 'NOT_FOUND':
      return 'La sala no existe o expiró.';
    case 'RATE_LIMITED':
      return 'Demasiadas acciones seguidas. Espera un momento.';
    default:
      return 'El servidor rechazó la acción.';
  }
}

export function RemoteView({ room, token }: RemoteViewProps) {
  const { snapshot, status, error, applySnapshot } = useDemoSession(room);
  const [inFlight, setInFlight] = useState<DemoCommandType | null>(null);
  const [reportPhase, setReportPhase] = useState<ReportPhase>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  // Reutiliza el commandId si el usuario reintenta tras un error de red (idempotencia).
  const pendingRef = useRef<{ type: DemoCommandType; revision: number; epoch: number; commandId: string } | null>(null);
  const inFlightRef = useRef(false);

  // Heartbeat: el notebook muestra "Teléfono conectado ✓".
  useEffect(() => {
    let cancelled = false;
    const beat = () => {
      heartbeat(room, token)
        .then((s) => {
          if (!cancelled) applySnapshot(s);
        })
        .catch(() => {
          /* el indicador de conexión ya refleja la caída */
        });
    };
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [room, token, applySnapshot]);

  // Si el paso cambia por otra vía (p. ej. RESET), limpiamos el estado del botón de reporte.
  const step = snapshot?.step ?? 0;
  const epoch = snapshot?.epoch ?? 0;
  useEffect(() => {
    if (step !== REPORT_STEP && step !== REPORT_STEP + 1) setReportPhase('idle');
  }, [step, epoch]);

  const run = useCallback(
    async (type: DemoCommandType) => {
      if (!snapshot || inFlightRef.current || !canApply(snapshot, type)) return;
      if (type === 'RESET' && !window.confirm('¿Reiniciar la demo desde el principio?')) return;
      const prev = pendingRef.current;
      const commandId =
        prev && prev.type === type && prev.revision === snapshot.revision && prev.epoch === snapshot.epoch
          ? prev.commandId
          : newCommandId();
      pendingRef.current = { type, revision: snapshot.revision, epoch: snapshot.epoch, commandId };
      inFlightRef.current = true;
      setInFlight(type);
      setNotice(null);
      if (type === 'REPORT_CONTAMINATION') setReportPhase('sending');
      try {
        const res = await sendCommand(room, type, snapshot.revision, token, commandId);
        pendingRef.current = null;
        applySnapshot(res.snapshot);
        if (res.ok) {
          if (type === 'REPORT_CONTAMINATION') setReportPhase('done');
        } else {
          if (type === 'REPORT_CONTAMINATION') setReportPhase('idle');
          setNotice(errorMessage(res));
        }
      } catch (err) {
        if (err instanceof DemoNetworkError) {
          if (type === 'REPORT_CONTAMINATION') setReportPhase('network-error');
          else setNotice('Sin conexión: no se envió, reintenta.');
        } else {
          pendingRef.current = null;
          if (type === 'REPORT_CONTAMINATION') setReportPhase('idle');
          setNotice('Error inesperado: no se envió, reintenta.');
        }
      } finally {
        inFlightRef.current = false;
        setInFlight(null);
      }
    },
    [snapshot, room, token, applySnapshot],
  );

  const current = DEMO_STEPS[step] ?? DEMO_STEPS[0];
  const busy = inFlight !== null;
  const canPrev = !!snapshot && canApply(snapshot, 'PREV');
  const canNext = !!snapshot && canApply(snapshot, 'NEXT');
  const blockedByReport = !!snapshot && step === REPORT_STEP && !snapshot.reported;

  let main: ReactNode = null;
  if (snapshot) {
    if (step === REPORT_STEP && !snapshot.reported) {
      const label =
        reportPhase === 'sending'
          ? 'Enviando…'
          : reportPhase === 'network-error'
            ? 'Sin conexión: no se envió, reintenta'
            : 'Reportar contaminación';
      main = (
        <button
          type="button"
          className={`gd-remote__action gd-remote__action--danger${reportPhase === 'network-error' ? ' gd-remote__action--warn' : ''}`}
          onClick={() => void run('REPORT_CONTAMINATION')}
          disabled={busy}
          aria-busy={reportPhase === 'sending'}
        >
          {label}
        </button>
      );
    } else if ((step === REPORT_STEP || (step === REPORT_STEP + 1 && reportPhase === 'done')) && snapshot.reported) {
      main = (
        <button type="button" className="gd-remote__action gd-remote__action--ok" disabled>
          Evento registrado ✓
        </button>
      );
    } else if (step === 0 && current.phoneAction) {
      main = (
        <button type="button" className="gd-remote__action gd-remote__action--primary" onClick={() => void run('NEXT')} disabled={busy || !canNext}>
          {inFlight === 'NEXT' ? 'Enviando…' : current.phoneAction}
        </button>
      );
    } else if (step === LAST_STEP && current.phoneAction) {
      main = (
        <button type="button" className="gd-remote__action gd-remote__action--ghost" onClick={() => void run('RESET')} disabled={busy}>
          {inFlight === 'RESET' ? 'Reiniciando…' : current.phoneAction}
        </button>
      );
    }
  }

  return (
    <div className="gd-remote">
      <header className="gd-remote__header">
        <div className="gd-remote__brand">WaterLight · Control de la demo</div>
        <div className="gd-remote__meta">
          <span className="gd-remote__room">
            Sala <strong>{room}</strong>
          </span>
          <span className={`gd-remote__status gd-remote__status--${status}`} role="status" aria-live="polite">
            <span className="gd-remote__dot" aria-hidden="true" />
            {STATUS_LABEL[status]}
          </span>
          <span className="gd-remote__step">{snapshot ? `Paso ${step + 1}/${DEMO_STEPS.length}` : 'Paso –/' + DEMO_STEPS.length}</span>
        </div>
      </header>

      <main className="gd-remote__body">
        {snapshot ? (
          <>
            <h1 className="gd-remote__title">{current.title}</h1>
            <p className="gd-remote__narration">{current.narration}</p>
          </>
        ) : (
          <p className="gd-remote__narration">{error && status === 'offline' ? `No se pudo cargar la sala: ${error}` : 'Conectando con la sala…'}</p>
        )}
        <div className="gd-remote__action-slot">{main}</div>
        {notice && (
          <p className="gd-remote__notice" role="alert">
            {notice}
          </p>
        )}
      </main>

      <nav className="gd-remote__nav" aria-label="Navegación de la demo">
        <button
          type="button"
          className="gd-remote__arrow"
          aria-label="Paso anterior"
          onClick={() => void run('PREV')}
          disabled={busy || !canPrev}
        >
          ← Anterior
        </button>
        <div className="gd-remote__next-wrap">
          <button
            type="button"
            className="gd-remote__arrow"
            aria-label="Paso siguiente"
            onClick={() => void run('NEXT')}
            disabled={busy || !canNext}
          >
            Siguiente →
          </button>
          {blockedByReport && <span className="gd-remote__hint">Primero reporta la contaminación</span>}
        </div>
      </nav>

      <footer className="gd-remote__footer">
        La comunicación teléfono ↔ servidor es real; la radio LoRa y la ONG en pantalla son simuladas.
      </footer>
    </div>
  );
}

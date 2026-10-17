import { useCallback, useState } from 'react';
import { usingPlaceholders } from '../assets/manifest';
import { SvgDefs } from '../assets/Sprite';
import type { WellId } from '../domain/types';
import { useSim } from '../store';
import { ControlPanel } from './ControlPanel';
import { EventTimeline } from './EventTimeline';
import { OngDashboard } from './OngDashboard';
import { WellDetailDrawer } from './WellDetailDrawer';
import { WorldView } from './WorldView';
import { PresentationView } from '../features/guided-demo/PresentationView';
import { RemoteView } from '../features/guided-demo/RemoteView';

const params = new URLSearchParams(window.location.search);
const URL_ROOM = params.get('demo');
const URL_ROLE = params.get('role');
const URL_TOKEN = params.get('k');

function clearDemoUrl() {
  window.history.replaceState(null, '', window.location.pathname);
}

/** Dos dashboards: la simulación del pueblo (con mapa navegable) y el dashboard analítico de la ONG. */
export function App() {
  const { state, dispatch } = useSim();
  const [view, setView] = useState<'sim' | 'ong'>('sim');
  const [selected, setSelected] = useState<WellId | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [showArchitecture, setShowArchitecture] = useState(false);
  const [zoomRequest, setZoomRequest] = useState<{ target: 'village' | 'region'; n: number }>({ target: 'village', n: 0 });
  const close = useCallback(() => setSelected(null), []);
  const placeholders = usingPlaceholders();
  const [presenting, setPresenting] = useState<'new' | 'join' | null>(URL_ROOM && URL_ROLE === 'display' ? 'join' : null);

  // Teléfono: control remoto de la demo guiada (misma app, otro rol).
  if (URL_ROOM && URL_ROLE === 'controller' && URL_TOKEN) return <RemoteView room={URL_ROOM} token={URL_TOKEN} />;

  if (presenting) {
    return (
      <PresentationView
        joinRoom={presenting === 'join' ? URL_ROOM : null}
        onExit={() => {
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
          clearDemoUrl();
          setPresenting(null);
        }}
      />
    );
  }

  if (view === 'ong') {
    return (
      <div className="app-ong">
        <SvgDefs />
        <OngDashboard state={state} dispatch={dispatch} onBack={() => setView('sim')} />
      </div>
    );
  }

  return (
    <div className={`app ${selected ? 'with-drawer' : ''}`}>
      <SvgDefs />
      <main className="stage">
        {state.restoredFromStorage && (
          <div className="notice" role="status">
            Se restauró la sesión guardada (en pausa). Pulsa ▶ para continuar o ↻ para reiniciar.
          </div>
        )}
        <WorldView
          state={state}
          selected={selected}
          onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
          showArchitecture={showArchitecture}
          onOpenOng={() => setView('ong')}
          zoomRequest={zoomRequest}
        />
        {placeholders.length > 0 && <div className="placeholder-tag">Arte provisorio SVG: {placeholders.join(', ')}</div>}
        <EventTimeline state={state} />
      </main>
      {selected ? (
        <WellDetailDrawer state={state} wellId={selected} onClose={close} dispatch={dispatch} />
      ) : (
        <ControlPanel
          state={state}
          dispatch={dispatch}
          advanced={advanced}
          setAdvanced={setAdvanced}
          showArchitecture={showArchitecture}
          setShowArchitecture={setShowArchitecture}
          onRegion={() => setZoomRequest((z) => ({ target: 'region', n: z.n + 1 }))}
          onOpenOng={() => setView('ong')}
          onStartDemo={() => {
            void document.documentElement.requestFullscreen?.().catch(() => undefined);
            setSelected(null);
            setPresenting('new');
          }}
        />
      )}
    </div>
  );
}

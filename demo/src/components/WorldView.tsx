import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent, type WheelEvent as RWheelEvent } from 'react';
import { formatClock } from '../domain/state';
import type { SimulationState, WellId } from '../domain/types';
import { Sprite } from '../assets/Sprite';
import { VillageScene } from './VillageScene';

// El mundo es una caja 16:9; el pueblo ocupa este rectángulo (en % del mundo).
const VILLAGE = { x: 31, y: 27, w: 38 };
const ONG = { x: 87, y: 77 };
const RELAY = { x: 82, y: 24 };
const MAX_ZOOM = 100 / VILLAGE.w;
const MIN_ZOOM = 1;

interface Props {
  state: SimulationState;
  selected: WellId | null;
  onSelect: (id: WellId) => void;
  showArchitecture: boolean;
  onOpenOng: () => void;
  zoomRequest: { target: 'village' | 'region'; n: number };
  /** Modo presentación de la demo guiada: sin controles, cámara animada y alerta visible hacia la ONG. */
  presentation?: { ongAlertLabel: string | null };
}

export function WorldView({ state, selected, onSelect, showArchitecture, onOpenOng, zoomRequest, presentation }: Props) {
  const vpRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 675 });
  const [view, setView] = useState({ z: MAX_ZOOM, x: 0, y: 0, init: false });
  const drag = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null);
  const [camAnim, setCamAnim] = useState(false);

  useLayoutEffect(() => {
    const el = vpRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const clamp = useCallback(
    (z: number, x: number, y: number) => {
      const zz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
      const W = size.w * zz;
      const H = size.h * zz;
      return { z: zz, x: Math.min(0, Math.max(size.w - W, x)), y: Math.min(0, Math.max(size.h - H, y)), init: true };
    },
    [size],
  );

  const focusVillage = useCallback(() => {
    const z = MAX_ZOOM;
    setView(clamp(z, -(VILLAGE.x / 100) * size.w * z, -(VILLAGE.y / 100) * size.h * z));
  }, [clamp, size]);
  const focusRegion = useCallback(() => setView(clamp(MIN_ZOOM, 0, 0)), [clamp]);

  useEffect(() => {
    if (!view.init) focusVillage();
    else setView((v) => clamp(v.z, v.x, v.y));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  useEffect(() => {
    if (zoomRequest.n === 0) return;
    setCamAnim(true);
    const t = window.setTimeout(() => setCamAnim(false), 1300);
    if (zoomRequest.target === 'village') focusVillage();
    else focusRegion();
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomRequest.n]);

  const zoomAt = (factor: number, cx = size.w / 2, cy = size.h / 2) => {
    setView((v) => {
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.z * factor));
      const k = z / v.z;
      return clamp(z, cx - (cx - v.x) * k, cy - (cy - v.y) * k);
    });
  };

  const onWheel = (e: RWheelEvent) => {
    const r = vpRef.current!.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
  };

  const onPointerDown = (e: RPointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input, select')) return;
    drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    setView((v) => clamp(v.z, d.x + dx, d.y + dy));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const W = size.w * view.z;
  const H = size.h * view.z;
  const zoomedOut = view.z < MAX_ZOOM * 0.8;
  const star = state.phase === 'STAR';
  const cloudLive = star && state.connectivity.cloud && state.connectivity.gatewayPowered;
  const lastCloudReceive = Math.max(...Object.values(state.cloud).map((k) => k.receivedAt));
  const inFlight =
    state.deliveries.some((d) => d.to === 'cloud' && d.status === 'SENDING') ||
    (!!presentation && lastCloudReceive > 0 && state.clockMs - lastCloudReceive < 3600);
  const queued = state.deliveries.filter((d) => d.to === 'cloud' && d.status === 'QUEUED').length;
  // Presentación: el paquete hacia la ONG se anima con el reloj de la simulación (determinista).
  const VISUAL_MS = 2600;
  const cloudSend = [...state.deliveries].reverse().find((d) => d.to === 'cloud' && d.startedAt !== undefined);
  const sendProgress = presentation && cloudSend ? (state.clockMs - cloudSend.startedAt!) / VISUAL_MS : 2;
  const showOngAlert = !!presentation?.ongAlertLabel && sendProgress >= 1;
  const extracting = state.lastManualExtractAt !== null && state.clockMs - state.lastManualExtractAt < 5000;
  const extractT = extracting ? (state.clockMs - state.lastManualExtractAt!) / 5000 : 0;

  // Centro del pueblo (gateway) en coordenadas del mundo.
  const gw = { x: VILLAGE.x + VILLAGE.w * 0.51, y: VILLAGE.y + VILLAGE.w * 0.24 };
  const roadStart = { x: VILLAGE.x + VILLAGE.w * 0.97, y: VILLAGE.y + VILLAGE.w * 0.66 };

  return (
    <div
      className={`viewport ${zoomedOut ? 'zoomed-out' : ''} ${presentation ? 'presenting' : ''}`}
      ref={vpRef}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className={`world ${camAnim ? 'cam-anim' : ''}`} style={{ width: W, height: H, transform: `translate(${view.x}px, ${view.y}px)` }}>
        <svg className="region" viewBox="0 0 160 90" preserveAspectRatio="none" aria-hidden="true">
          <rect width="160" height="90" fill="#e9cf98" />
          {/* curvas de nivel suaves del terreno */}
          {Array.from({ length: 9 }).map((_, i) => (
            <path
              key={i}
              d={`M0 ${8 + i * 10} Q40 ${2 + i * 10 + (i % 2) * 6} 80 ${9 + i * 10} T160 ${6 + i * 10}`}
              fill="none"
              stroke="#c9a66b"
              strokeWidth=".25"
              opacity=".7"
            />
          ))}
          <path d={`M${RELAY.x * 1.6 - 14} ${RELAY.y * 0.9 + 6} Q${RELAY.x * 1.6} ${RELAY.y * 0.9 - 8} ${RELAY.x * 1.6 + 14} ${RELAY.y * 0.9 + 6} Z`} fill="#d7b67c" />
          {/* camino de tierra pueblo → ONG */}
          <path d={`M${roadStart.x * 1.6} ${roadStart.y * 0.9} Q${118} ${70} ${ONG.x * 1.6 - 4} ${ONG.y * 0.9}`} fill="none" stroke="#c99b63" strokeWidth="3" strokeLinecap="round" />
          <path d={`M${roadStart.x * 1.6} ${roadStart.y * 0.9} Q${118} ${70} ${ONG.x * 1.6 - 4} ${ONG.y * 0.9}`} fill="none" stroke="#b4874f" strokeWidth=".3" strokeDasharray="1.5 1.5" />
          {/* enlace de datos: antena (Estrella) o ausente (MVP) */}
          <path
            d={`M${gw.x * 1.6} ${gw.y * 0.9} L${RELAY.x * 1.6} ${RELAY.y * 0.9 - 6} L${ONG.x * 1.6} ${ONG.y * 0.9 - 8}`}
            fill="none"
            className={`backhaul ${cloudLive ? 'live' : star ? 'down' : 'none'}`}
          />
          {presentation && sendProgress > 0 && sendProgress < 1 && (() => {
            const pts = [
              { x: gw.x * 1.6, y: gw.y * 0.9 },
              { x: RELAY.x * 1.6, y: RELAY.y * 0.9 - 6 },
              { x: ONG.x * 1.6, y: ONG.y * 0.9 - 8 },
            ];
            const seg = sendProgress < 0.5 ? 0 : 1;
            const t = (sendProgress - seg * 0.5) * 2;
            const x = pts[seg].x + (pts[seg + 1].x - pts[seg].x) * t;
            const y = pts[seg].y + (pts[seg + 1].y - pts[seg].y) * t;
            return (
              <g>
                <circle cx={x} cy={y} r={3.2} className="backhaul-glow" />
                <circle cx={x} cy={y} r={1.8} className="backhaul-packet alert" />
              </g>
            );
          })()}
          {!presentation && inFlight && cloudLive && <circle r={1.2} className="backhaul-packet"><animateMotion dur="1.2s" repeatCount="indefinite" path={`M${gw.x * 1.6} ${gw.y * 0.9} L${RELAY.x * 1.6} ${RELAY.y * 0.9 - 6} L${ONG.x * 1.6} ${ONG.y * 0.9 - 8}`} /></circle>}
          {/* pueblos vecinos (escalabilidad) */}
          {[
            { x: 12, y: 18, n: 'Mutunda' },
            { x: 9, y: 78, n: 'Kigumba' },
            { x: 60, y: 90, n: 'Masindi Port' },
            { x: 92, y: 10, n: 'Bweyale' },
          ].map((p) => (
            <g key={p.n} transform={`translate(${p.x * 1.6} ${p.y * 0.9})`}>
              <circle r="5" fill="#dcbf86" />
              <path d="M-3 1 L-1.5 -1.5 L0 1 Z M0.5 1.5 L2 -1 L3.5 1.5 Z" fill="#9E6740" />
              <text y="7.5" textAnchor="middle" className="region-label">
                {p.n}
              </text>
            </g>
          ))}
        </svg>

        <div className="village-frame" style={{ left: `${VILLAGE.x}%`, top: `${VILLAGE.y}%`, width: `${VILLAGE.w}%` }}>
          <VillageScene state={state} selected={selected} onSelect={onSelect} showArchitecture={showArchitecture} hideCloud={!!presentation} />
        </div>

        <div className="region-item relay" style={{ left: `${RELAY.x}%`, top: `${RELAY.y}%` }}>
          <Sprite name="relay-tower" alt="Torre repetidora" className="region-art" />
          <span className="region-tag">{star ? 'Torre repetidora (Estrella)' : 'Torre (no instalada en MVP)'}</span>
        </div>

        <button type="button" className="region-item ong" style={{ left: `${ONG.x}%`, top: `${ONG.y}%` }} onClick={onOpenOng} aria-label="Centro regional de la ONG: abrir dashboard">
          <Sprite name="ong-building" alt="" className="region-art" />
          <span className="ong-sign">ONG</span>
          {showOngAlert && <span className="region-tag alert">🔴 {presentation!.ongAlertLabel}</span>}
          <span className="region-tag strong">Centro regional ONG · abrir dashboard ▸</span>
          <span className="region-tag">
            {cloudLive
              ? `En línea por antena${queued ? ` · ✉ ${queued} pendientes` : ''}`
              : state.lastManualExtractAt !== null
                ? `Último retiro manual ${formatClock(state.lastManualExtractAt)}`
                : 'Sin datos del pueblo aún (retiro manual pendiente)'}
          </span>
        </button>

        {extracting && (
          <div className="courier" style={{ left: `${roadStart.x + (ONG.x - roadStart.x) * extractT}%`, top: `${roadStart.y + (ONG.y - roadStart.y) * extractT}%` }}>
            <Sprite name="field-worker" alt="Guardiana llevando datos" className="courier-art" />
            <span className="region-tag">💾 retiro manual</span>
          </div>
        )}
      </div>

      {!presentation && (
      <div className="map-controls" role="toolbar" aria-label="Controles del mapa">
        <button type="button" onClick={() => zoomAt(1.25)} aria-label="Acercar">＋</button>
        <button type="button" onClick={() => zoomAt(1 / 1.25)} aria-label="Alejar">－</button>
        <button type="button" onClick={focusVillage}>Pueblo</button>
        <button type="button" onClick={focusRegion}>Región + ONG</button>
      </div>
      )}
      {!zoomedOut && !presentation && <div className="map-hint">Rueda o “Región + ONG” para alejar · arrastra para moverte</div>}
    </div>
  );
}

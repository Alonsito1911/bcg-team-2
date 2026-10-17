import { formatClock, MESH_PAIRS, WELL_NAMES } from '../domain/state';
import { canSend, diagnoseLink, lastAckFor, pendingFor } from '../domain/transport';
import { deriveLocal } from '../domain/state';
import type { NodeId, SimulationState, WellId } from '../domain/types';
import type { UiAction } from '../store';
import { Toggle } from './ControlPanel';
import { STATE_UI } from './labels';

// Mini red: posiciones en un lienzo 100×60.
const POS: Record<string, { x: number; y: number }> = {
  well: { x: 13, y: 16 },
  phone: { x: 13, y: 48 },
  gateway: { x: 50, y: 16 },
  neighbor: { x: 50, y: 48 },
  broker: { x: 87, y: 16 },
  cloud: { x: 87, y: 48 },
};

export function ArchitectureMiniDemo({ state, wellId, dispatch }: { state: SimulationState; wellId: WellId; dispatch: (a: UiAction) => void }) {
  const c = state.connectivity;
  const local = deriveLocal(state, wellId);
  const center = state.center[wellId];
  const cloud = state.cloud[wellId];
  const pending = pendingFor(state, wellId);
  const ack = lastAckFor(state, wellId);
  const diag = diagnoseLink(state, wellId);
  const neighbors = MESH_PAIRS.filter(([a, b]) => a === wellId || b === wellId).map(([a, b]) => (a === wellId ? b : a));
  const witness = neighbors.find((n) => canSend(state, wellId, n) && canSend(state, n, 'gateway')) ?? neighbors[0];

  const mine = state.deliveries.filter((d) => state.events[d.eventId]?.wellId === wellId);
  const active = (from: NodeId, to: NodeId) => mine.find((d) => d.from === from && d.to === to && d.status === 'SENDING');

  const edges: { a: string; b: string; label: string; on: boolean; packet?: boolean }[] = [
    { a: 'well', b: 'gateway', label: 'LoRa P2P', on: canSend(state, wellId, 'gateway'), packet: !!active(wellId, 'gateway') },
    { a: 'well', b: 'neighbor', label: 'testigo', on: canSend(state, wellId, witness), packet: !!active(wellId, witness) },
    { a: 'neighbor', b: 'gateway', label: 'relevo', on: canSend(state, witness, 'gateway'), packet: !!active(witness, 'gateway') },
    { a: 'gateway', b: 'broker', label: 'IP local', on: c.gatewayPowered },
    { a: 'broker', b: 'cloud', label: 'MQTT/IP', on: canSend(state, 'gateway', 'cloud'), packet: !!active('gateway', 'cloud') },
    { a: 'phone', b: 'well', label: 'BLE', on: canSend(state, 'phone', wellId), packet: !!active('phone', wellId) },
  ];

  const nodes = [
    { id: 'well', label: WELL_NAMES[wellId], sub: 'ESP32 + outbox', on: state.wells[wellId].powered, icon: '⛲' },
    { id: 'neighbor', label: WELL_NAMES[witness], sub: 'vecino / testigo', on: state.wells[witness].powered, icon: '⛲' },
    { id: 'gateway', label: 'Centro', sub: 'gateway + semáforo', on: c.gatewayPowered, icon: '🚦' },
    { id: 'broker', label: 'Broker MQTT', sub: 'Mosquitto local', on: c.gatewayPowered, icon: '🗄' },
    { id: 'cloud', label: 'Nube', sub: 'panel remoto', on: c.cloud, icon: '☁' },
    { id: 'phone', label: 'Teléfono', sub: `trabajadora · ✉${state.phone.carried.length}`, on: true, icon: '📱' },
  ];

  return (
    <div className="arch">
      <h3>¿Cómo llega la alerta?</h3>
      <svg viewBox="0 0 100 64" className="arch-svg" aria-label="Diagrama de red del pozo">
        {edges.map((e) => {
          const a = POS[e.a];
          const b = POS[e.b];
          return (
            <g key={e.a + e.b}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`arch-edge ${e.on ? 'on' : 'off'}`} />
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 1.5} textAnchor="middle" className="arch-label">
                {e.on ? e.label : `${e.label} ✕`}
              </text>
              {e.packet && <circle r="2" className="arch-packet" cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} />}
            </g>
          );
        })}
        {nodes.map((n) => {
          const p = POS[n.id];
          return (
            <g key={n.id} transform={`translate(${p.x} ${p.y})`} className={`arch-node ${n.on ? '' : 'off'}`}>
              <rect x="-11" y="-6" width="22" height="12" rx="2.5" />
              <text y="-0.6" textAnchor="middle" className="arch-title">
                {n.icon} {n.label}
              </text>
              <text y="3.6" textAnchor="middle" className="arch-sub">
                {n.sub}
              </text>
            </g>
          );
        })}
      </svg>
      <p className={`diag ${diag.tone}`}>📡 {diag.text}</p>

      <div className="compare">
        <Card title="Estado real local" value={STATE_UI[local.primary].label} meta={`act. ${formatClock(state.wells[wellId].lastLocalUpdate)}`} cls={STATE_UI[local.primary].cls} />
        <Card title="Recibido en el centro" value={STATE_UI[center.status].label} meta={center.receivedAt >= 0 ? `${formatClock(center.receivedAt)}${center.via === 'LORA_RELAY' ? ' · vía relevo' : ''}` : '—'} cls={STATE_UI[center.status].cls} />
        <Card title="Recibido en la nube" value={STATE_UI[cloud.status].label} meta={cloud.receivedAt >= 0 ? formatClock(cloud.receivedAt) : '—'} cls={STATE_UI[cloud.status].cls} />
        <Card title="Pendientes" value={String(pending.length)} meta={pending[0] ? `#${state.events[pending[0].eventId].num} · intento ${pending[0].attempt}` : 'outbox vacío'} cls={pending.length ? 'gray' : 'ok'} />
        <Card title="Última confirmación" value={ack ? `#${state.events[ack.eventId].num}` : '—'} meta={ack ? `ACK · intento ${ack.attempt}` : ''} cls="ok" />
      </div>

      <div className="btn-grid">
        <button type="button" className="btn" onClick={() => dispatch({ type: 'SEND_PING', wellId })}>
          Enviar señal de prueba
        </button>
        <button type="button" className="btn primary" onClick={() => dispatch({ type: 'NOTIFY_STATE', wellId })}>
          Notificar estado actual
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: 'DROP_NEXT', wellId })}>
          Perder próximo paquete
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: 'DROP_NEXT_ACK', wellId })}>
          Perder próximo ACK
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: 'RETRY_NOW', wellId })} disabled={!pending.length}>
          Reintentar ahora
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: 'RESTORE_NETWORK' })}>
          Restablecer red
        </button>
      </div>
      <div className="toggles">
        <Toggle label="LoRa" on={c.lora[wellId]} onChange={(on) => dispatch({ type: 'SET_LINK', target: { kind: 'lora', wellId }, on })} />
        {neighbors.map((n) => (
          <Toggle
            key={n}
            label={`Testigo ${WELL_NAMES[n]}`}
            on={canSend(state, wellId, n) || (c.mesh[[wellId, n].sort().join('|')] ?? false)}
            onChange={(on) => dispatch({ type: 'SET_LINK', target: { kind: 'mesh', a: wellId, b: n }, on })}
          />
        ))}
        <Toggle label="BLE" on={c.ble[wellId]} onChange={(on) => dispatch({ type: 'SET_LINK', target: { kind: 'ble', wellId }, on })} />
        <Toggle label="Internet" on={c.cloud} onChange={(on) => dispatch({ type: 'SET_LINK', target: { kind: 'cloud' }, on })} />
        <Toggle label="Gateway" on={c.gatewayPowered} onChange={(on) => dispatch({ type: 'SET_LINK', target: { kind: 'gateway' }, on })} />
      </div>
      <label className="row">
        <span>Pérdida de paquetes {c.packetLossPct}%</span>
        <input type="range" min={0} max={100} step={10} value={c.packetLossPct} onChange={(e) => dispatch({ type: 'SET_LOSS', pct: Number(e.target.value) })} />
      </label>
      <p className="hint">LoRa transporta paquetes pequeños propios; MQTT solo viaja sobre IP (centro → broker → nube). Las animaciones no son ondas de radio reales.</p>
    </div>
  );
}

function Card({ title, value, meta, cls }: { title: string; value: string; meta: string; cls: string }) {
  return (
    <div className={`card ${cls}`}>
      <small>{title}</small>
      <b>{value}</b>
      <small>{meta}</small>
    </div>
  );
}

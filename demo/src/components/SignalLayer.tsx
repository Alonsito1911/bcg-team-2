import { NODE_POS } from '../domain/geometry';
import { canSend } from '../domain/transport';
import type { Delivery, NodeId, Point, SimulationState } from '../domain/types';

const X = 1.6;
const Y = 0.9;
const toView = (p: Point): Point => ({ x: p.x * X, y: p.y * Y });

function nodePoint(s: SimulationState, id: NodeId): Point {
  if (id === 'phone') {
    const worker = s.people.find((p) => p.role === 'WORKER');
    return worker ? { x: worker.pos.x, y: worker.pos.y - 6 } : NODE_POS.gateway;
  }
  return NODE_POS[id];
}

function control(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 9 - Math.abs(a.x - b.x) * 0.08 };
}

function quad(a: Point, c: Point, b: Point, t: number): Point {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

function colorFor(s: SimulationState, d: Delivery): string {
  const ev = s.events[d.eventId];
  if (!ev || ev.eventType === 'PING') return '#3186C7';
  if (ev.statusAfter === 'CONTAMINATED') return '#D8483E';
  if (ev.statusAfter === 'ENABLED') return '#2B9B5A';
  return '#D99A1B';
}

const LINKS: [NodeId, NodeId][] = [
  ['well-1', 'gateway'],
  ['well-2', 'gateway'],
  ['well-3', 'gateway'],
  ['gateway', 'cloud'],
  ['well-1', 'well-3'],
  ['well-2', 'well-3'],
  ['well-1', 'well-2'],
];

export function SignalLayer({ state: s, showArchitecture }: { state: SimulationState; showArchitecture: boolean }) {
  const now = s.clockMs;
  const sending = s.deliveries.filter((d) => d.status === 'SENDING' && d.startedAt !== undefined && d.arriveAt !== undefined);
  const acks = s.deliveries.filter((d) => d.status === 'DELIVERED' && d.arriveAt !== undefined && d.ackAt !== undefined);
  const queuedCloud = s.deliveries.filter((d) => d.status === 'QUEUED' && d.to === 'cloud').length;
  const cloudDown = !s.connectivity.cloud || !s.connectivity.gatewayPowered;

  const routes = s.people.filter((p) => p.role === 'VILLAGER' && p.activity === 'WALKING' && p.path.length).slice(0, 2);

  const arc = (from: NodeId, to: NodeId) => {
    const a = toView(nodePoint(s, from));
    const b = toView(nodePoint(s, to));
    const c = toView(control(nodePoint(s, from), nodePoint(s, to)));
    return { a, b, c, d: `M${a.x} ${a.y} Q${c.x} ${c.y} ${b.x} ${b.y}` };
  };

  return (
    <svg className="signal-layer" viewBox="0 0 160 90" preserveAspectRatio="none" aria-hidden="true">
      {/* Rutas de habitantes: verde punteado sobre los senderos */}
      {routes.map((p) => {
        const pts = [p.pos, ...p.path].map(toView);
        return (
          <g key={p.id}>
            <polyline points={pts.map((q) => `${q.x},${q.y}`).join(' ')} className="walk-route" />
            <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="1.3" fill="#2B9B5A" />
          </g>
        );
      })}

      {/* Arquitectura visible solo si el usuario la pide */}
      {showArchitecture &&
        LINKS.map(([f, t]) => {
          const on = canSend(s, f, t);
          return <path key={`${f}-${t}`} d={arc(f, t).d} className={`link-arc ${on ? '' : 'down'}`} />;
        })}

      {/* Nodos fijos: centro y nube */}
      <g className="net-node" transform={`translate(${toView(NODE_POS.gateway).x} ${toView(NODE_POS.gateway).y})`}>
        <circle r="1.3" className={s.connectivity.gatewayPowered ? 'gw on' : 'gw off'} />
        <text x="2.4" y="0.8" className="node-label">
          Centro
        </text>
      </g>
      <g className="net-node" transform={`translate(${toView(NODE_POS.cloud).x} ${toView(NODE_POS.cloud).y})`}>
        <path d="M-4 1 Q-5 -2.2 -2 -2.4 Q-1 -5.2 2 -3.6 Q5.4 -3.8 5 0 Q6 1 4 1.4 L-3 1.4 Z" className={cloudDown ? 'cloud off' : 'cloud on'} />
        {cloudDown && <path d="M-4 -4.6 L5 3" className="cut" />}
        <text y="5.6" textAnchor="middle" className="node-label">
          Nube{queuedCloud ? ` · ✉${queuedCloud}` : ''}
        </text>
      </g>

      {/* Paquetes en tránsito: solo mientras un DeliveryRecord realmente viaja */}
      {sending.map((d) => {
        const { a, b, c, d: path } = arc(d.from, d.to);
        const t = Math.min(1, Math.max(0, (now - d.startedAt!) / Math.max(1, d.arriveAt! - d.startedAt!)));
        const p = quad(a, c, b, t);
        const col = colorFor(s, d);
        return (
          <g key={d.id}>
            <path d={path} className="pulse-trail" stroke={col} />
            <circle cx={p.x} cy={p.y} r="1.7" fill={col} className="packet" />
            {d.attempt > 1 && (
              <text x={p.x} y={p.y - 3} textAnchor="middle" className="attempt">
                Intento {d.attempt}
              </text>
            )}
          </g>
        );
      })}
      {acks.map((d) => {
        const { a, b, c } = arc(d.to, d.from);
        const t = Math.min(1, Math.max(0, (now - d.arriveAt!) / Math.max(1, d.ackAt! - d.arriveAt!)));
        const p = quad(toView(nodePoint(s, d.to)), c, toView(nodePoint(s, d.from)), t);
        void a;
        void b;
        return <circle key={`ack-${d.id}`} cx={p.x} cy={p.y} r="1" className="ack-dot" />;
      })}

      {/* Efectos: paquete perdido, ACK recibido, salida bloqueada */}
      {s.fx.map((f) => {
        if (f.kind === 'DROP' && f.from && f.to) {
          const { a, b, c } = arc(f.from, f.to);
          const p = quad(a, c, b, 0.62);
          return (
            <g key={f.id} className="fx-drop">
              <text x={p.x} y={p.y} textAnchor="middle" className="fx-x">
                ✕
              </text>
              <text x={p.x} y={p.y + 4} textAnchor="middle" className="fx-label">
                {f.label ?? 'Paquete perdido'}
              </text>
            </g>
          );
        }
        if (f.kind === 'ACK' && f.to) {
          const p = toView(nodePoint(s, f.to));
          return (
            <text key={f.id} x={p.x + 3} y={p.y - 6} className="fx-ack">
              ✔ ACK
            </text>
          );
        }
        if (f.kind === 'BLOCKED' && f.wellId && f.personId) {
          const person = s.people.find((q) => q.id === f.personId);
          if (!person) return null;
          const a = toView(person.pos);
          const b = toView(NODE_POS[f.wellId]);
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          return (
            <g key={f.id}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="blocked-route" />
              <text x={mid.x} y={mid.y} textAnchor="middle" className="fx-x">
                ✕
              </text>
              {f.label && (
                <text x={mid.x} y={mid.y + 4} textAnchor="middle" className="fx-label">
                  {f.label}
                </text>
              )}
            </g>
          );
        }
        return null;
      })}
    </svg>
  );
}

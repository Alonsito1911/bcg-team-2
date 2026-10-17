// Modelo de dominio de la demo WaterLight. Todo dato es SIMULADO.

export type WellId = 'well-1' | 'well-2' | 'well-3';
export const WELL_IDS: WellId[] = ['well-1', 'well-2', 'well-3'];

export type WellState = 'ENABLED' | 'NO_WATER' | 'CONTAMINATED' | 'VALVE_DAMAGE' | 'UNKNOWN';
export type WaterTest = 'VALID_NEGATIVE' | 'CONFIRMED_POSITIVE' | 'PENDING' | 'MISSING' | 'EXPIRED';
export type ValveCondition = 'OK' | 'DAMAGED';
export type Anomaly = 'NONE' | 'SUSPECTED';
/** Qué reportó la comunidad con la caja del pozo. */
export type ReportReason = 'NONE' | 'CONTAMINATION' | 'NO_WATER' | 'VALVE' | 'OTHER';
/** MVP: caja con botón + guardiana. ESTRELLA: sensores automáticos + antena a la ONG. */
export type Phase = 'MVP' | 'STAR';

/** Factores independientes de los que se DERIVA el estado (doc 01 §2.2). */
export interface WellFactors {
  waterVolumePct: number;
  valveCondition: ValveCondition;
  waterTest: WaterTest;
  /** Momento (reloj lógico) en que se tomó la prueba vigente. */
  testTakenAt: number;
  testValidUntil: number;
  testVerifiedBy: string;
  reportedAnomaly: Anomaly;
  reportReason: ReportReason;
  anomalyChangedAt: number;
  /** Momento del último cambio operacional (volumen / válvula). */
  opsChangedAt: number;
}

export interface CommunityReport {
  kind: 'GOOD' | 'BAD';
  at: number;
  by: string;
  reason?: ReportReason;
}

export interface Well {
  id: WellId;
  name: string;
  factors: WellFactors;
  /** Verdad del mundo simulado: contaminación que ningún sensor detecta. Solo la ve el operador. */
  hiddenContamination: boolean;
  /** Verdad física: pozo seco / válvula rota (en MVP nadie lo sabe hasta que alguien va). */
  physicalDry: boolean;
  physicalValveBroken: boolean;
  communityReports: CommunityReport[];
  powered: boolean;
  batteryPct: number;
  /** Secuencia monotónica de eventos emitidos por este dispositivo. */
  seq: number;
  /** Última firma de estado emitida (para emitir solo cuando cambia). */
  lastEmittedSignature: string;
  lastLocalUpdate: number;
  /** Eventos que el pozo escuchó de un vecino (copia de testigo). */
  witnessStore: string[];
}

export type Origin = 'SENSOR' | 'VILLAGER' | 'FIELD_WORKER' | 'DEMO_OPERATOR';

export type EventType =
  | 'STATUS_CHANGED'
  | 'LOW_VOLUME_READING'
  | 'VALVE_INSPECTION_FAILED'
  | 'ANOMALY_REPORTED'
  | 'GOOD_REPORTED'
  | 'WATER_TEST_CONFIRMED_POSITIVE'
  | 'WATER_TEST_VALID_NEGATIVE'
  | 'MAINTENANCE_COMPLETED'
  | 'RAIN_WINDOW'
  | 'DEVICE_POWER_LOST'
  | 'DEVICE_POWER_RESTORED'
  | 'PING';

export type EventFactors = Partial<WellFactors>;

export interface DemoEvent {
  eventId: string;
  num: number;
  wellId: WellId;
  /** Clave de origen para la secuencia: 'well-2' o 'phone'. */
  originKey: string;
  seq: number;
  eventType: EventType;
  origin: Origin;
  occurredAt: number;
  statusAfter: WellState;
  reason: string;
  factors?: EventFactors;
  verifiedBy?: string;
}

export type NodeId = WellId | 'gateway' | 'cloud' | 'phone';
export type Via = 'LORA' | 'LORA_WITNESS' | 'LORA_RELAY' | 'MQTT' | 'BLE' | 'CARRIED';
export type DeliveryStatus = 'QUEUED' | 'SENDING' | 'DELIVERED' | 'ACKED' | 'CANCELLED';

export interface Delivery {
  id: string;
  eventId: string;
  from: NodeId;
  to: NodeId;
  via: Via;
  attempt: number;
  status: DeliveryStatus;
  createdAt: number;
  nextRetryAt: number;
  startedAt?: number;
  arriveAt?: number;
  ackAt?: number;
  /** Latencia forzada (escenario de orden invertido). */
  latencyOverride?: number;
  /** Vecino que hace de relevo para esta entrega (si existe). */
  relayVia?: WellId;
  note?: string;
}

/** Lo que un receptor (centro o nube) sabe de un pozo. */
export interface Knowledge {
  factors: WellFactors | null;
  status: WellState;
  secondary: WellState[];
  lowReserve: boolean;
  lastEventNum: number;
  receivedAt: number;
  lastHeardAt: number;
  lastDirectAt: number;
  lastWitnessAt: number;
  witnessBy?: WellId;
  via?: Via;
  seqByOrigin: Record<string, number>;
}

export type Role = 'VILLAGER' | 'WORKER';
export type Activity =
  | 'IDLE'
  | 'SELECTING'
  | 'WALKING'
  | 'COLLECTING'
  | 'OBSERVING'
  | 'REPORTING'
  | 'INSPECTING'
  | 'REPAIRING'
  | 'REROUTING'
  | 'RETURNING'
  | 'WAITING'
  | 'SYNCING';

export type Intent = 'COLLECT' | 'INSPECT' | 'REPAIR' | 'HOME' | 'ROUND' | 'VISIT';

export interface Point {
  x: number;
  y: number;
}

export interface Person {
  id: string;
  name: string;
  role: Role;
  sprite: string;
  pos: Point;
  home: Point;
  activity: Activity;
  intent: Intent;
  target?: WellId;
  path: Point[];
  activityUntil: number;
  carryingWater: boolean;
  bubble?: string;
  bubbleUntil: number;
  /** Pozos descartados durante este viaje (lo vio en el sitio). */
  avoid: WellId[];
  /** Plan de visita del guardián. */
  round: WellId[];
  facing: 1 | -1;
  routeChoice?: string;
  /** La trabajadora debe sincronizar su teléfono al pasar por la plaza. */
  syncPending?: boolean;
  /** Firma del conocimiento del centro cuando empezó a esperar. */
  waitSig?: string;
  /** Qué falla vio y va a reportar. */
  pendingReport?: ReportReason;
}

export interface Phone {
  /** Eventos que el trabajador lleva consigo (ruta B). */
  carried: string[];
  /** Resultados que aún no se pudieron escribir en el pozo por BLE. */
  pendingBle: Partial<Record<WellId, string>>;
  seq: number;
}

export type LogFamily = 'AGUA' | 'COMUNIDAD' | 'RED' | 'MANTENIMIENTO' | 'OPERADOR';

export interface LogEntry {
  id: number;
  at: number;
  family: LogFamily;
  wellId?: WellId;
  text: string;
}

export type FxKind = 'DROP' | 'ACK' | 'BLOCKED' | 'CHANGE';

export interface Fx {
  id: number;
  kind: FxKind;
  from?: NodeId;
  to?: NodeId;
  at: number;
  until: number;
  label?: string;
  wellId?: WellId;
  personId?: string;
}

export interface Connectivity {
  /** Enlace LoRa pozo ↔ gateway. */
  lora: Record<WellId, boolean>;
  /** Enlace LoRa pozo ↔ pozo (testigo / relevo), clave 'well-1|well-3'. */
  mesh: Record<string, boolean>;
  /** Teléfono del trabajador ↔ pozo. */
  ble: Record<WellId, boolean>;
  /** Gateway ↔ internet/nube. */
  cloud: boolean;
  gatewayPowered: boolean;
  packetLossPct: number;
  latencyMs: number;
  /** Pérdida forzada del próximo paquete por enlace (clave de enlace). */
  dropNext: Record<string, boolean>;
  /** Pérdida forzada del próximo ACK por enlace. */
  dropNextAck: Record<string, boolean>;
}

export interface RainState {
  startedAt: number | null;
  /** La nube se enteró de la lluvia (requiere sincronización IP). */
  cloudKnows?: boolean;
}

export interface ScenarioProgress {
  id: string;
  stepIndex: number;
}

export interface SimulationState {
  version: 1;
  phase: Phase;
  lastManualExtractAt: number | null;
  clockMs: number;
  speed: 1 | 2 | 4;
  paused: boolean;
  seed: number;
  rngState: number;
  counters: { event: number; delivery: number; log: number; fx: number };
  wells: Record<WellId, Well>;
  center: Record<WellId, Knowledge>;
  cloud: Record<WellId, Knowledge>;
  /** IDs de eventos ya vistos por cada receptor (idempotencia). */
  seen: { gateway: string[]; cloud: string[] } & Partial<Record<WellId, string[]>>;
  events: Record<string, DemoEvent>;
  deliveries: Delivery[];
  connectivity: Connectivity;
  rain: RainState;
  people: Person[];
  phone: Phone;
  log: LogEntry[];
  fx: Fx[];
  nextHeartbeatAt: number;
  scenario: ScenarioProgress | null;
  lastCenterSignal: string;
  restoredFromStorage?: boolean;
}

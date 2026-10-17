import { DEMO_CONFIG } from './config';
import { deriveWellState, rainActiveSince, type DerivedWell } from './deriveWellState';
import { WELL_POS } from './geometry';
import { nextRandom } from './rng';
import {
  WELL_IDS,
  type Fx,
  type FxKind,
  type Knowledge,
  type LogFamily,
  type Person,
  type SimulationState,
  type Well,
  type WellFactors,
  type WellId,
} from './types';

export const WELL_NAMES: Record<WellId, string> = {
  'well-1': 'Pozo A',
  'well-2': 'Pozo B',
  'well-3': 'Pozo C',
};

export function meshKey(a: WellId, b: WellId): string {
  return [a, b].sort().join('|');
}

export const MESH_PAIRS: [WellId, WellId][] = [
  ['well-1', 'well-2'],
  ['well-1', 'well-3'],
  ['well-2', 'well-3'],
];

export function enabledFactors(now: number): WellFactors {
  return {
    waterVolumePct: 80,
    valveCondition: 'OK',
    waterTest: 'VALID_NEGATIVE',
    testTakenAt: now,
    testValidUntil: now + DEMO_CONFIG.testValidityDays * DEMO_CONFIG.dayMs,
    testVerifiedBy: 'Trabajador/a comunitario/a (simulado)',
    reportedAnomaly: 'NONE',
    reportReason: 'NONE',
    anomalyChangedAt: now,
    opsChangedAt: now,
  };
}

function makeWell(id: WellId): Well {
  return {
    id,
    name: WELL_NAMES[id],
    factors: enabledFactors(0),
    hiddenContamination: false,
    physicalDry: false,
    physicalValveBroken: false,
    communityReports: [],
    powered: true,
    batteryPct: id === 'well-1' ? 78 : id === 'well-2' ? 84 : 71,
    seq: 0,
    lastEmittedSignature: '',
    lastLocalUpdate: 0,
    witnessStore: [],
  };
}

export function emptyKnowledge(): Knowledge {
  return {
    factors: null,
    status: 'UNKNOWN',
    secondary: [],
    lowReserve: false,
    lastEventNum: 0,
    receivedAt: -1,
    lastHeardAt: -1,
    lastDirectAt: -1,
    lastWitnessAt: -1,
    seqByOrigin: {},
  };
}

export function seededKnowledge(f: WellFactors): Knowledge {
  return {
    ...emptyKnowledge(),
    factors: { ...f },
    status: 'ENABLED',
    receivedAt: 0,
    lastHeardAt: 0,
    lastDirectAt: 0,
  };
}

function makePeople(): Person[] {
  const base = {
    activity: 'IDLE' as const,
    intent: 'HOME' as const,
    path: [],
    activityUntil: 0,
    carryingWater: false,
    bubbleUntil: 0,
    avoid: [],
    round: [],
    facing: 1 as const,
  };
  return [
    { ...base, id: 'amina', name: 'Amina', role: 'VILLAGER', sprite: 'woman-jerrycan', pos: { x: 35, y: 45 }, home: { x: 35, y: 45 } },
    { ...base, id: 'lokol', name: 'Lokol', role: 'VILLAGER', sprite: 'child-blue', pos: { x: 44, y: 47 }, home: { x: 44, y: 47 } },
    { ...base, id: 'akai', name: 'Akai', role: 'VILLAGER', sprite: 'woman-blue', pos: { x: 74, y: 49 }, home: { x: 74, y: 49 } },
    // La guardiana NO es del pueblo: llega desde el borde del mapa (camino a la ONG).
    { ...base, id: 'worker', name: 'Nasimiyu (guardiana ONG)', role: 'WORKER', sprite: 'field-worker', pos: { x: 97, y: 66 }, home: { x: 97, y: 66 } },
  ];
}

export function createInitialState(seed = 42, phase: SimulationState['phase'] = 'MVP'): SimulationState {
  const wells = Object.fromEntries(WELL_IDS.map((id) => [id, makeWell(id)])) as Record<WellId, Well>;
  const s: SimulationState = {
    version: 1,
    phase,
    lastManualExtractAt: null,
    clockMs: 0,
    speed: 1,
    paused: false,
    seed,
    rngState: seed,
    counters: { event: 0, delivery: 0, log: 0, fx: 0 },
    wells,
    center: Object.fromEntries(WELL_IDS.map((id) => [id, seededKnowledge(wells[id].factors)])) as Record<WellId, Knowledge>,
    cloud: Object.fromEntries(WELL_IDS.map((id) => [id, seededKnowledge(wells[id].factors)])) as Record<WellId, Knowledge>,
    seen: { gateway: [], cloud: [] },
    events: {},
    deliveries: [],
    connectivity: {
      lora: { 'well-1': true, 'well-2': true, 'well-3': true },
      mesh: Object.fromEntries(MESH_PAIRS.map(([a, b]) => [meshKey(a, b), true])),
      ble: { 'well-1': true, 'well-2': true, 'well-3': true },
      // En MVP el pueblo no tiene antena hacia la ONG: los datos se retiran a mano.
      cloud: phase === 'STAR',
      gatewayPowered: true,
      packetLossPct: 0,
      latencyMs: DEMO_CONFIG.demoLoRaLatencyMs,
      dropNext: {},
      dropNextAck: {},
    },
    rain: { startedAt: null },
    people: makePeople(),
    phone: { carried: [], pendingBle: {}, seq: 0 },
    log: [],
    fx: [],
    nextHeartbeatAt: DEMO_CONFIG.heartbeatEveryMs,
    scenario: null,
    lastCenterSignal: 'GREEN',
  };
  for (const id of WELL_IDS) {
    s.wells[id].lastEmittedSignature = signature(deriveLocal(s, id));
  }
  addLog(s, 'OPERADOR', 'Escenario iniciado: 3 pozos habilitados, enlaces activos');
  return s;
}

export function addLog(s: SimulationState, family: LogFamily, text: string, wellId?: WellId): void {
  s.counters.log += 1;
  s.log.push({ id: s.counters.log, at: s.clockMs, family, text, wellId });
  if (s.log.length > DEMO_CONFIG.maxLog) s.log.splice(0, s.log.length - DEMO_CONFIG.maxLog);
}

export function addFx(s: SimulationState, kind: FxKind, durationMs: number, extra: Omit<Fx, 'id' | 'kind' | 'at' | 'until'>): void {
  s.counters.fx += 1;
  s.fx.push({ id: s.counters.fx, kind, at: s.clockMs, until: s.clockMs + durationMs, ...extra });
}

export function deriveLocal(s: SimulationState, id: WellId): DerivedWell {
  const w = s.wells[id];
  return deriveWellState(w.factors, {
    now: s.clockMs,
    rainActiveSince: rainActiveSince(s.rain.startedAt, s.clockMs),
    unpowered: !w.powered,
  });
}

export function signature(d: DerivedWell): string {
  return `${d.primary}|${d.secondary.join(',')}|${d.lowReserve ? 'low' : ''}`;
}

export function random(s: SimulationState): number {
  const [value, next] = nextRandom(s.rngState);
  s.rngState = next;
  return value;
}

export function wellPosition(id: WellId) {
  return WELL_POS[id];
}

export function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function demoDay(ms: number): number {
  return Math.floor(ms / DEMO_CONFIG.dayMs) + 1;
}

// Punto único de entrada al dominio: dispatch({type, payload}) + avance del reloj lógico.
import { DEMO_CONFIG } from './config';
import { deriveVillageState } from './deriveVillageState';
import { communityReport, guardianReport, nextPeopleWake, personSay, sendPerson, sendRepair, sendVisit, startRound, tickPeople } from './people';
import { addLog, createInitialState, enabledFactors, meshKey, WELL_NAMES } from './state';
import { applyEventToKnowledge, canSend, emitWellEvent, refreshKnowledge, syncWell, tickHeartbeats, tickTransport } from './transport';
import { WELL_IDS, type Phase, type ReportReason, type SimulationState, type ValveCondition, type WaterTest, type WellId } from './types';

/**
 * CONTAMINATED / NO_WATER / VALVE_DAMAGE crean una falla FÍSICA.
 * - Contaminación: ningún sensor la detecta → alguien tiene que verla y reportarla (ambas fases).
 * - Sin agua / válvula: en MVP nadie lo sabe hasta que una persona va; en ESTRELLA los sensores lo informan solos.
 * CONFIRMED_POSITIVE fuerza un resultado de laboratorio simulado (uso avanzado / pruebas).
 */
export type QuickPreset = 'ENABLED' | 'NO_WATER' | 'CONTAMINATED' | 'VALVE_DAMAGE' | 'HIDDEN_CONTAMINATION' | 'CONFIRMED_POSITIVE';

export interface FactorEdit {
  waterVolumePct?: number;
  valveCondition?: ValveCondition;
  waterTest?: WaterTest;
  reportedAnomaly?: 'NONE' | 'SUSPECTED';
  validityDays?: number;
  hiddenContamination?: boolean;
}

export type LinkTarget =
  | { kind: 'lora'; wellId: WellId }
  | { kind: 'mesh'; a: WellId; b: WellId }
  | { kind: 'ble'; wellId: WellId }
  | { kind: 'cloud' }
  | { kind: 'gateway' }
  | { kind: 'wellPower'; wellId: WellId };

export type Action =
  | { type: 'TICK'; dtMs: number }
  | { type: 'STEP' }
  | { type: 'SET_PAUSED'; paused: boolean }
  | { type: 'SET_SPEED'; speed: 1 | 2 | 4 }
  | { type: 'RESET'; seed?: number; phase?: Phase }
  | { type: 'LOAD'; state: SimulationState }
  | { type: 'QUICK_PRESET'; wellId: WellId; preset: QuickPreset }
  | { type: 'EDIT_FACTORS'; wellId: WellId; edit: FactorEdit }
  | { type: 'COMMUNITY_REPORT'; wellId: WellId; kind: 'GOOD' | 'BAD'; reason?: ReportReason }
  | { type: 'SET_PHASE'; phase: Phase }
  | { type: 'MANUAL_EXTRACT' }
  | { type: 'SEND_PERSON'; personId: string; target: WellId | 'AUTO' }
  | { type: 'WORKER_ROUND' }
  | { type: 'WORKER_REPAIR'; wellId: WellId }
  | { type: 'TREAT_WELL'; wellId: WellId }
  | { type: 'RAIN_START' }
  | { type: 'RAIN_CLEAR' }
  | { type: 'SET_LINK'; target: LinkTarget; on: boolean }
  | { type: 'SET_LOSS'; pct: number }
  | { type: 'SET_LATENCY'; ms: number }
  | { type: 'DROP_NEXT'; wellId: WellId }
  | { type: 'DROP_NEXT_ACK'; wellId: WellId }
  | { type: 'SEND_PING'; wellId: WellId }
  | { type: 'NOTIFY_STATE'; wellId: WellId }
  | { type: 'RETRY_NOW'; wellId: WellId }
  | { type: 'RESTORE_NETWORK' }
  | { type: 'INJECT_OUT_OF_ORDER'; wellId: WellId }
  | { type: 'SET_SCENARIO'; scenario: SimulationState['scenario'] }
  | { type: 'WORKER_VISIT'; wellId: WellId }
  | { type: 'GUARDIAN_REPORT'; wellId: WellId }
  | { type: 'PERSON_SAY'; personId: string; text: string; ms: number };

const PRESET_LABEL: Record<QuickPreset, string> = {
  ENABLED: 'Habilitado',
  NO_WATER: 'Sin agua',
  CONTAMINATED: 'Contaminación',
  HIDDEN_CONTAMINATION: 'Contaminación',
  VALVE_DAMAGE: 'Válvula dañada',
  CONFIRMED_POSITIVE: 'Contaminado (prueba positiva simulada)',
};

function applyQuickPreset(s: SimulationState, wellId: WellId, preset: QuickPreset): void {
  const w = s.wells[wellId];
  const now = s.clockMs;
  if (preset === 'HIDDEN_CONTAMINATION') preset = 'CONTAMINATED';

  if (preset === 'ENABLED' || preset === 'CONFIRMED_POSITIVE') {
    // Preset atómico: reemplaza los factores anteriores por una condición conocida (doc 01 §2.5).
    w.factors = enabledFactors(now);
    w.hiddenContamination = preset === 'CONFIRMED_POSITIVE';
    w.physicalDry = false;
    w.physicalValveBroken = false;
    if (preset === 'CONFIRMED_POSITIVE') w.factors.waterTest = 'CONFIRMED_POSITIVE';
    addLog(s, 'OPERADOR', `Operador: «${PRESET_LABEL[preset]}» en ${w.name} (reemplaza factores anteriores)`, wellId);
    syncWell(
      s,
      wellId,
      preset === 'ENABLED' ? 'STATUS_CHANGED' : 'WATER_TEST_CONFIRMED_POSITIVE',
      preset === 'ENABLED' ? 'DEMO_OPERATOR' : 'FIELD_WORKER',
      `Escenario: ${PRESET_LABEL[preset]}`,
      true,
    );
    return;
  }

  // Falla física: solo una falla a la vez.
  w.hiddenContamination = preset === 'CONTAMINATED';
  w.physicalDry = preset === 'NO_WATER';
  w.physicalValveBroken = preset === 'VALVE_DAMAGE';

  const sensed = s.phase === 'STAR' && preset !== 'CONTAMINATED';
  if (!sensed) {
    addLog(
      s,
      'OPERADOR',
      `Falla física en ${w.name}: ${PRESET_LABEL[preset].toLowerCase()}. ${
        preset === 'CONTAMINATED' ? 'Ningún sensor la detecta' : 'En MVP no hay sensor'
      }: nadie lo sabe hasta que alguien vaya y lo reporte`,
      wellId,
    );
    return;
  }
  w.factors = enabledFactors(now);
  w.factors.testTakenAt = s.wells[wellId].factors.testTakenAt;
  if (preset === 'NO_WATER') w.factors.waterVolumePct = 5;
  if (preset === 'VALVE_DAMAGE') w.factors.valveCondition = 'DAMAGED';
  addLog(s, 'OPERADOR', `Falla física en ${w.name}: ${PRESET_LABEL[preset].toLowerCase()} · el sensor la detecta (fase Estrella)`, wellId);
  syncWell(s, wellId, preset === 'NO_WATER' ? 'LOW_VOLUME_READING' : 'VALVE_INSPECTION_FAILED', 'SENSOR', `Sensor: ${PRESET_LABEL[preset]}`, true);
}

/** Retiro manual (MVP): la guardiana descarga el centro del pueblo y lo entrega a la ONG. */
function manualExtract(s: SimulationState): void {
  if (!s.connectivity.gatewayPowered) {
    addLog(s, 'RED', 'Retiro manual imposible: el centro del pueblo está apagado');
    return;
  }
  let n = 0;
  for (const id of s.seen.gateway) {
    if (s.seen.cloud.includes(id)) continue;
    const ev = s.events[id];
    if (!ev) continue;
    s.seen.cloud.push(id);
    applyEventToKnowledge(s.cloud[ev.wellId], ev, s.clockMs);
    n += 1;
  }
  for (const d of s.deliveries) {
    if (d.to === 'cloud' && d.status === 'QUEUED') {
      d.status = 'CANCELLED';
      d.note = 'Entregado por retiro manual';
    }
  }
  for (const id of WELL_IDS) {
    s.cloud[id].lastHeardAt = s.center[id].lastHeardAt;
    s.cloud[id].lastWitnessAt = s.center[id].lastWitnessAt;
  }
  if (s.rain.startedAt !== null) s.rain.cloudKnows = true;
  s.lastManualExtractAt = s.clockMs;
  addLog(s, 'RED', `Retiro manual de datos: ${n} evento(s) del centro del pueblo entregados a la ONG (fase MVP)`);
}

function applyEdit(s: SimulationState, wellId: WellId, e: FactorEdit): void {
  const w = s.wells[wellId];
  const now = s.clockMs;
  const f = w.factors;
  if (e.waterVolumePct !== undefined && e.waterVolumePct !== f.waterVolumePct) {
    f.waterVolumePct = Math.max(0, Math.min(100, e.waterVolumePct));
    f.opsChangedAt = now;
  }
  if (e.valveCondition && e.valveCondition !== f.valveCondition) {
    f.valveCondition = e.valveCondition;
    f.opsChangedAt = now;
  }
  if (e.waterTest && (e.waterTest !== f.waterTest || e.validityDays !== undefined)) {
    f.waterTest = e.waterTest;
    f.testTakenAt = now;
    f.testValidUntil = now + (e.validityDays ?? DEMO_CONFIG.testValidityDays) * DEMO_CONFIG.dayMs;
    f.testVerifiedBy = 'Operador de demo (simulado)';
  }
  if (e.reportedAnomaly && e.reportedAnomaly !== f.reportedAnomaly) {
    f.reportedAnomaly = e.reportedAnomaly;
    f.anomalyChangedAt = now;
  }
  if (e.hiddenContamination !== undefined) w.hiddenContamination = e.hiddenContamination;
  addLog(s, 'OPERADOR', `Operador ajustó factores del ${w.name}`, wellId);
  syncWell(s, wellId, 'STATUS_CHANGED', 'DEMO_OPERATOR', 'Cambio de factores (escenario)', true);
}

function setLink(s: SimulationState, t: LinkTarget, on: boolean): void {
  const c = s.connectivity;
  const word = on ? 'restablecido' : 'cortado';
  switch (t.kind) {
    case 'lora':
      c.lora[t.wellId] = on;
      addLog(s, 'RED', `Enlace LoRa ${WELL_NAMES[t.wellId]} ↔ centro ${word}`, t.wellId);
      break;
    case 'mesh':
      c.mesh[meshKey(t.a, t.b)] = on;
      addLog(s, 'RED', `Enlace testigo ${WELL_NAMES[t.a]} ↔ ${WELL_NAMES[t.b]} ${word}`);
      break;
    case 'ble':
      c.ble[t.wellId] = on;
      addLog(s, 'RED', `BLE teléfono ↔ ${WELL_NAMES[t.wellId]} ${on ? 'disponible' : 'no disponible'}`, t.wellId);
      break;
    case 'cloud':
      c.cloud = on;
      addLog(s, 'RED', on ? 'Internet restablecido: el centro sincroniza con la nube' : 'Sin internet: el centro sigue funcionando por LoRa; la nube queda atrás');
      break;
    case 'gateway':
      c.gatewayPowered = on;
      addLog(s, 'RED', on ? 'Gateway/semáforo con energía' : 'Gateway/semáforo sin energía: placa pasiva «sin información»');
      break;
    case 'wellPower': {
      const w = s.wells[t.wellId];
      if (w.powered === on) return;
      if (!on) {
        addLog(s, 'RED', `${w.name} sin energía (batería agotada): indicador apagado, no mide ni transmite`, t.wellId);
        w.powered = false;
        w.batteryPct = 0;
      } else {
        w.powered = true;
        w.batteryPct = 64;
        addLog(s, 'RED', `${w.name} recupera energía: restaura registros locales y re-evalúa (no asume verde)`, t.wellId);
        syncWell(s, t.wellId, 'DEVICE_POWER_RESTORED', 'SENSOR', 'Energía restaurada', true);
      }
      break;
    }
  }
}

export function applyAction(prev: SimulationState, action: Action): SimulationState {
  if (action.type === 'RESET') return createInitialState(action.seed ?? prev.seed, action.phase ?? prev.phase ?? 'MVP');
  if (action.type === 'LOAD') return action.state;
  if (action.type === 'TICK' && (prev.paused || action.dtMs <= 0)) return prev;

  const s = structuredClone(prev);
  const now = s.clockMs;
  switch (action.type) {
    case 'TICK':
      advance(s, action.dtMs);
      break;
    case 'STEP': {
      const wake = nextWakeTime(s);
      const dt = Number.isFinite(wake) ? Math.max(16, wake - now + 1) : 1000;
      advance(s, Math.min(dt, 15000));
      s.paused = true;
      break;
    }
    case 'SET_PAUSED':
      s.paused = action.paused;
      break;
    case 'SET_SPEED':
      s.speed = action.speed;
      break;
    case 'QUICK_PRESET':
      applyQuickPreset(s, action.wellId, action.preset);
      break;
    case 'EDIT_FACTORS':
      applyEdit(s, action.wellId, action.edit);
      break;
    case 'COMMUNITY_REPORT':
      communityReport(s, action.wellId, action.kind, 'Persona (caja del pozo)', action.reason ?? 'OTHER');
      break;
    case 'SET_PHASE':
      s.phase = action.phase;
      s.connectivity.cloud = action.phase === 'STAR';
      addLog(
        s,
        'OPERADOR',
        action.phase === 'MVP'
          ? 'Fase MVP: caja con botón + guardiana; sin antena a la ONG (retiro manual de datos)'
          : 'Fase Estrella: sensores automáticos de nivel y bomba + antena al centro regional de la ONG',
      );
      break;
    case 'MANUAL_EXTRACT':
      manualExtract(s);
      break;
    case 'SEND_PERSON':
      sendPerson(s, action.personId, action.target);
      break;
    case 'WORKER_ROUND':
      startRound(s);
      break;
    case 'WORKER_REPAIR':
      sendRepair(s, action.wellId);
      break;
    case 'TREAT_WELL': {
      const w = s.wells[action.wellId];
      w.hiddenContamination = false;
      addLog(s, 'MANTENIMIENTO', `Tratamiento/limpieza del ${w.name} (simulado). El rojo se mantiene hasta una nueva prueba válida`, w.id);
      break;
    }
    case 'RAIN_START':
      s.rain = { startedAt: now, cloudKnows: s.connectivity.cloud && s.connectivity.gatewayPowered };
      addLog(s, 'AGUA', `Lluvia registrada: ventana crítica de ${DEMO_CONFIG.rainWindowDays} días. Las verificaciones previas no sirven hasta re-verificar`);
      for (const id of WELL_IDS) syncWell(s, id, 'RAIN_WINDOW', 'SENSOR', 'Ventana de lluvia: no asumir potable');
      break;
    case 'RAIN_CLEAR':
      s.rain = { startedAt: null };
      addLog(s, 'OPERADOR', 'Operador: ventana de lluvia finalizada manualmente');
      for (const id of WELL_IDS) syncWell(s, id, 'STATUS_CHANGED', 'DEMO_OPERATOR', 'Fin de ventana de lluvia');
      break;
    case 'SET_LINK':
      setLink(s, action.target, action.on);
      break;
    case 'SET_LOSS':
      s.connectivity.packetLossPct = action.pct;
      break;
    case 'SET_LATENCY':
      s.connectivity.latencyMs = action.ms;
      break;
    case 'DROP_NEXT':
      s.connectivity.dropNext[`lora:${action.wellId}`] = true;
      addLog(s, 'OPERADOR', `Operador: el próximo paquete LoRa de ${WELL_NAMES[action.wellId]} se perderá`, action.wellId);
      break;
    case 'DROP_NEXT_ACK':
      s.connectivity.dropNextAck[`lora:${action.wellId}`] = true;
      addLog(s, 'OPERADOR', `Operador: el próximo ACK hacia ${WELL_NAMES[action.wellId]} se perderá (provoca duplicado)`, action.wellId);
      break;
    case 'SEND_PING':
      emitWellEvent(s, action.wellId, 'PING', 'DEMO_OPERATOR', 'Ping técnico');
      break;
    case 'NOTIFY_STATE':
      syncWell(s, action.wellId, 'STATUS_CHANGED', 'DEMO_OPERATOR', 'Notificar estado actual', true);
      break;
    case 'RETRY_NOW':
      for (const d of s.deliveries) {
        if (d.from === action.wellId && d.status === 'QUEUED') d.nextRetryAt = now;
      }
      break;
    case 'RESTORE_NETWORK': {
      const c = s.connectivity;
      for (const id of WELL_IDS) {
        c.lora[id] = true;
        c.ble[id] = true;
      }
      for (const k of Object.keys(c.mesh)) c.mesh[k] = true;
      c.cloud = true;
      c.gatewayPowered = true;
      c.packetLossPct = 0;
      c.dropNext = {};
      c.dropNextAck = {};
      addLog(s, 'RED', 'Red restablecida: se drenan las colas pendientes');
      break;
    }
    case 'INJECT_OUT_OF_ORDER': {
      // seq N (rojo) viaja lento; seq N+1 (habilitado tras nueva validación) viaja rápido y llega primero.
      const id = action.wellId;
      const w = s.wells[id];
      w.factors.waterTest = 'CONFIRMED_POSITIVE';
      w.factors.testTakenAt = now;
      emitWellEvent(s, id, 'WATER_TEST_CONFIRMED_POSITIVE', 'FIELD_WORKER', 'Prueba positiva (seq N, llegará tarde)', {
        latencyOverride: 4200,
      });
      w.factors = enabledFactors(now + 1);
      w.hiddenContamination = false;
      emitWellEvent(s, id, 'WATER_TEST_VALID_NEGATIVE', 'FIELD_WORKER', 'Nueva validación negativa (seq N+1, llega primero)', {
        latencyOverride: 900,
      });
      addLog(s, 'OPERADOR', `Operador: inyecta dos eventos de ${w.name} que llegarán en orden invertido`, id);
      break;
    }
    case 'WORKER_VISIT':
      sendVisit(s, action.wellId);
      break;
    case 'GUARDIAN_REPORT':
      guardianReport(s, action.wellId);
      break;
    case 'PERSON_SAY':
      personSay(s, action.personId, action.text, action.ms);
      break;
    case 'SET_SCENARIO':
      s.scenario = action.scenario;
      break;
  }
  updateCenterSignalLog(s);
  return s;
}

/** Avanza el reloj lógico en sub-pasos para que nada "salte" eventos. */
export function advance(s: SimulationState, dtMs: number): void {
  let remaining = dtMs;
  while (remaining > 0) {
    const step = Math.min(remaining, 50);
    s.clockMs += step;
    remaining -= step;
    tickHeartbeats(s);
    tickTransport(s);
    refreshKnowledge(s);
    for (const id of WELL_IDS) {
      // Vencimiento de prueba y fin de ventana de lluvia cambian el estado local.
      syncWell(s, id, 'STATUS_CHANGED', 'SENSOR', 'Re-evaluación local (vigencia/lluvia)');
    }
    tickPeople(s, step);
    s.fx = s.fx.filter((f) => f.until > s.clockMs);
    updateCenterSignalLog(s);
  }
}

function updateCenterSignalLog(s: SimulationState): void {
  const v = deriveVillageState(s.center, s.clockMs, s.connectivity.gatewayPowered);
  if (v.signal !== s.lastCenterSignal) {
    const label = { GREEN: 'VERDE', YELLOW: 'AMARILLO', RED: 'ROJO', NO_INFO: 'SIN INFORMACIÓN' }[v.signal];
    addLog(s, 'AGUA', `Semáforo central → ${label}: ${v.message}`);
    s.lastCenterSignal = v.signal;
  }
}

/** Próximo instante con algo que observar (para "Siguiente paso"). */
export function nextWakeTime(s: SimulationState): number {
  let next = nextPeopleWake(s);
  for (const d of s.deliveries) {
    if (d.status === 'QUEUED' && d.nextRetryAt > s.clockMs) next = Math.min(next, d.nextRetryAt);
    if (d.status === 'QUEUED' && d.nextRetryAt <= s.clockMs && canSend(s, d.from, d.to)) next = Math.min(next, s.clockMs + 16);
    if (d.status === 'SENDING' && d.arriveAt !== undefined) next = Math.min(next, d.arriveAt);
    if (d.status === 'DELIVERED' && d.ackAt !== undefined) next = Math.min(next, d.ackAt);
  }
  return next;
}

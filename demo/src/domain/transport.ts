// Simulador de comunicaciones: outbox, saltos, pérdida, ACK, reintentos, deduplicación,
// eventos antiguos, testigo/relevo entre pozos y portador humano (doc 01 §6–7).
import { DEMO_CONFIG } from './config';
import { deriveWellState, rainActiveSince } from './deriveWellState';
import { addFx, addLog, deriveLocal, MESH_PAIRS, meshKey, random, signature, WELL_NAMES } from './state';
import {
  WELL_IDS,
  type DemoEvent,
  type Delivery,
  type EventFactors,
  type EventType,
  type Knowledge,
  type NodeId,
  type Origin,
  type SimulationState,
  type Via,
  type WellFactors,
  type WellId,
} from './types';

const isWell = (n: NodeId): n is WellId => n.startsWith('well-');

export const NODE_LABEL: Record<NodeId, string> = {
  'well-1': 'Pozo 1',
  'well-2': 'Pozo 2',
  'well-3': 'Pozo 3',
  gateway: 'Centro',
  cloud: 'Nube',
  phone: 'Teléfono',
};

const VIA_LABEL: Record<Via, string> = {
  LORA: 'LoRa',
  LORA_WITNESS: 'LoRa (escucha de vecino)',
  LORA_RELAY: 'LoRa vía relevo',
  MQTT: 'MQTT/IP',
  BLE: 'BLE',
  CARRIED: 'portado por trabajadora',
};

// ---------------------------------------------------------------- enlaces

export function linkKey(from: NodeId, to: NodeId): string {
  if (from === 'phone' || to === 'phone') {
    const other = from === 'phone' ? to : from;
    return isWell(other) ? `ble:${other}` : 'carried';
  }
  if (isWell(from) && isWell(to)) return `mesh:${meshKey(from, to)}`;
  if (from === 'cloud' || to === 'cloud') return 'ip:cloud';
  const well = isWell(from) ? from : (to as WellId);
  return `lora:${well}`;
}

export function canSend(s: SimulationState, from: NodeId, to: NodeId): boolean {
  const c = s.connectivity;
  const powered = (n: NodeId) => (isWell(n) ? s.wells[n].powered : n === 'gateway' ? c.gatewayPowered : true);
  if (!powered(from) || !powered(to)) return false;
  if (from === 'phone' || to === 'phone') {
    const other = from === 'phone' ? to : from;
    return isWell(other) ? c.ble[other] : true;
  }
  if (isWell(from) && isWell(to)) return c.mesh[meshKey(from, to)] ?? false;
  if (from === 'cloud' || to === 'cloud') return c.cloud;
  const well = isWell(from) ? from : (to as WellId);
  return c.lora[well];
}

function latencyFor(s: SimulationState, via: Via): number {
  switch (via) {
    case 'MQTT':
      return DEMO_CONFIG.demoGatewayToCloudLatencyMs;
    case 'BLE':
      return DEMO_CONFIG.demoBleLatencyMs;
    case 'CARRIED':
      return DEMO_CONFIG.demoCarriedLatencyMs;
    default:
      return s.connectivity.latencyMs;
  }
}

const isRadio = (via: Via) => via === 'LORA' || via === 'LORA_WITNESS' || via === 'LORA_RELAY';

// ---------------------------------------------------------------- creación de eventos

function eventNum(s: SimulationState): number {
  s.counters.event += 1;
  return s.counters.event;
}

/** El dispositivo del pozo crea un evento, lo persiste en su outbox y lo intenta enviar. */
export function emitWellEvent(
  s: SimulationState,
  wellId: WellId,
  eventType: EventType,
  origin: Origin,
  reason: string,
  extra: { verifiedBy?: string; latencyOverride?: number; seqOverride?: number } = {},
): DemoEvent | null {
  const w = s.wells[wellId];
  if (!w.powered) {
    addLog(s, 'RED', `${w.name} sin energía: no puede crear ni transmitir eventos`, wellId);
    return null;
  }
  const derived = deriveLocal(s, wellId);
  const num = eventNum(s);
  w.seq = extra.seqOverride ?? w.seq + 1;
  const ev: DemoEvent = {
    eventId: `ev-${num}`,
    num,
    wellId,
    originKey: wellId,
    seq: w.seq,
    eventType,
    origin,
    occurredAt: s.clockMs,
    statusAfter: derived.primary,
    reason,
    factors: eventType === 'PING' ? undefined : { ...w.factors },
    verifiedBy: extra.verifiedBy,
  };
  s.events[ev.eventId] = ev;
  if (eventType !== 'PING') {
    w.lastEmittedSignature = signature(derived);
    w.lastLocalUpdate = s.clockMs;
  }
  addLog(s, 'RED', `Evento #${num} (${eventType === 'PING' ? 'ping técnico' : reason}) guardado en el outbox de ${w.name}`, wellId);
  enqueue(s, ev.eventId, wellId, 'gateway', 'LORA', extra.latencyOverride);
  return ev;
}

/** Recalcula el estado local y emite un evento solo si cambió (o si se fuerza). */
export function syncWell(
  s: SimulationState,
  wellId: WellId,
  eventType: EventType,
  origin: Origin,
  reason: string,
  force = false,
  verifiedBy?: string,
): DemoEvent | null {
  const sig = signature(deriveLocal(s, wellId));
  if (!force && sig === s.wells[wellId].lastEmittedSignature) return null;
  return emitWellEvent(s, wellId, eventType, origin, reason, { verifiedBy });
}

/** Evento creado en el teléfono del trabajador (resultado de prueba, reparación). */
export function createPhoneEvent(
  s: SimulationState,
  wellId: WellId,
  eventType: EventType,
  factors: EventFactors,
  reason: string,
): DemoEvent {
  const num = eventNum(s);
  s.phone.seq += 1;
  const merged = mergeFactors({ ...s.wells[wellId].factors }, factors, s.clockMs).factors;
  const ev: DemoEvent = {
    eventId: `ev-${num}`,
    num,
    wellId,
    originKey: 'phone',
    seq: s.phone.seq,
    eventType,
    origin: 'FIELD_WORKER',
    occurredAt: s.clockMs,
    statusAfter: deriveWellState(merged, {
      now: s.clockMs,
      rainActiveSince: rainActiveSince(s.rain.startedAt, s.clockMs),
    }).primary,
    reason,
    factors,
    verifiedBy: 'Trabajadora comunitaria (simulado)',
  };
  s.events[ev.eventId] = ev;
  addLog(s, 'COMUNIDAD', `Evento #${num} registrado en el teléfono de la trabajadora: ${reason}`, wellId);
  return ev;
}

export function enqueue(
  s: SimulationState,
  eventId: string,
  from: NodeId,
  to: NodeId,
  via: Via,
  latencyOverride?: number,
): Delivery {
  s.counters.delivery += 1;
  const d: Delivery = {
    id: `d-${s.counters.delivery}`,
    eventId,
    from,
    to,
    via,
    attempt: 1,
    status: 'QUEUED',
    createdAt: s.clockMs,
    nextRetryAt: s.clockMs,
    latencyOverride,
  };
  s.deliveries.push(d);
  if (!canSend(s, from, to)) {
    const ev = s.events[eventId];
    d.note = 'Esperando enlace';
    addLog(s, 'RED', `Sin enlace ${VIA_LABEL[via]} ${NODE_LABEL[from]}→${NODE_LABEL[to]}: evento #${ev.num} queda en cola`, ev.wellId);
  }
  return d;
}

// ---------------------------------------------------------------- conocimiento (centro / nube)

/** Fusión por grupos de campos con marca temporal: no permite que un dato viejo pise a uno nuevo. */
export function mergeFactors(
  target: WellFactors | null,
  f: EventFactors,
  occurredAt: number,
): { factors: WellFactors; changed: boolean } {
  if (!target) return { factors: { ...(f as WellFactors) }, changed: true };
  const t = { ...target };
  let changed = false;
  if (f.testTakenAt !== undefined && f.testTakenAt >= t.testTakenAt) {
    changed ||= t.waterTest !== f.waterTest || t.testTakenAt !== f.testTakenAt;
    t.waterTest = f.waterTest ?? t.waterTest;
    t.testTakenAt = f.testTakenAt;
    t.testValidUntil = f.testValidUntil ?? t.testValidUntil;
    t.testVerifiedBy = f.testVerifiedBy ?? t.testVerifiedBy;
  }
  if (f.anomalyChangedAt !== undefined && f.anomalyChangedAt >= t.anomalyChangedAt) {
    changed ||= t.reportedAnomaly !== f.reportedAnomaly;
    t.reportedAnomaly = f.reportedAnomaly ?? t.reportedAnomaly;
    t.reportReason = f.reportReason ?? t.reportReason;
    t.anomalyChangedAt = f.anomalyChangedAt;
  }
  const opsAt = f.opsChangedAt ?? (f.waterVolumePct !== undefined ? occurredAt : undefined);
  if (opsAt !== undefined && opsAt >= t.opsChangedAt) {
    changed ||= t.waterVolumePct !== f.waterVolumePct || t.valveCondition !== f.valveCondition;
    t.waterVolumePct = f.waterVolumePct ?? t.waterVolumePct;
    t.valveCondition = f.valveCondition ?? t.valveCondition;
    t.opsChangedAt = opsAt;
  }
  return { factors: t, changed };
}

export type ApplyResult = 'APPLIED' | 'STALE' | 'PING';

export function applyEventToKnowledge(k: Knowledge, ev: DemoEvent, now: number): ApplyResult {
  if (ev.eventType === 'PING' || !ev.factors) return 'PING';
  const last = k.seqByOrigin[ev.originKey] ?? 0;
  if (ev.seq <= last) return 'STALE';
  k.seqByOrigin[ev.originKey] = ev.seq;
  k.factors = mergeFactors(k.factors, ev.factors, ev.occurredAt).factors;
  k.lastEventNum = Math.max(k.lastEventNum, ev.num);
  k.receivedAt = now;
  return 'APPLIED';
}

/** Recalcula el estado que cada receptor DERIVA de sus factores conocidos. */
export function refreshKnowledge(s: SimulationState): void {
  const now = s.clockMs;
  const centerRain = rainActiveSince(s.rain.startedAt, now); // pluviómetro en el centro
  for (const id of WELL_IDS) {
    for (const [k, rain] of [
      [s.center[id], centerRain],
      [s.cloud[id], s.rain.cloudKnows ? centerRain : null],
    ] as const) {
      if (!k.factors) continue;
      const d = deriveWellState(k.factors, { now, rainActiveSince: rain });
      k.status = d.primary;
      k.secondary = d.secondary;
      k.lowReserve = d.lowReserve;
    }
  }
}

// ---------------------------------------------------------------- avance del transporte

function retryDelay(attempt: number): number {
  const delays = DEMO_CONFIG.retryDelaysMs;
  return delays[Math.min(Math.max(attempt - 2, 0), delays.length - 1)];
}

function requeue(s: SimulationState, d: Delivery, note: string): void {
  d.attempt += 1;
  d.status = 'QUEUED';
  d.startedAt = undefined;
  d.arriveAt = undefined;
  d.ackAt = undefined;
  d.nextRetryAt = s.clockMs + retryDelay(d.attempt);
  d.note = note;
}

function drop(s: SimulationState, d: Delivery, reason: string): void {
  const ev = s.events[d.eventId];
  addFx(s, 'DROP', 1400, { from: d.from, to: d.to, label: reason });
  addLog(s, 'RED', `✕ ${reason}: evento #${ev.num} (${NODE_LABEL[d.from]}→${NODE_LABEL[d.to]}, intento ${d.attempt}); sigue en cola`, ev.wellId);
  requeue(s, d, `Reintento programado (${reason})`);
}

function busy(s: SimulationState, d: Delivery): boolean {
  if (d.latencyOverride !== undefined) return false; // escenario de orden invertido
  return s.deliveries.some(
    (o) => o !== d && o.from === d.from && o.to === d.to && (o.status === 'SENDING' || o.status === 'DELIVERED'),
  );
}

function spawnRelays(s: SimulationState): void {
  const c = s.connectivity;
  for (const d of s.deliveries) {
    if (d.status !== 'QUEUED' || d.via !== 'LORA' || d.to !== 'gateway' || !isWell(d.from) || d.relayVia) continue;
    const from = d.from;
    if (canSend(s, from, 'gateway') || !s.wells[from].powered || !c.gatewayPowered) continue;
    const neighbor = MESH_PAIRS.filter(([a, b]) => a === from || b === from)
      .map(([a, b]) => (a === from ? b : a))
      .find((j) => canSend(s, from, j) && canSend(s, j, 'gateway'));
    if (!neighbor) continue;
    d.relayVia = neighbor;
    const ev = s.events[d.eventId];
    addLog(s, 'RED', `${WELL_NAMES[neighbor]} actúa como testigo: escucha el evento #${ev.num} de ${WELL_NAMES[from]} para retransmitirlo`, from);
    enqueue(s, d.eventId, from, neighbor, 'LORA_WITNESS');
  }
}

function receive(s: SimulationState, d: Delivery): void {
  const ev = s.events[d.eventId];
  const now = s.clockMs;
  if (d.to === 'gateway' || d.to === 'cloud') {
    const isCenter = d.to === 'gateway';
    const k = isCenter ? s.center[ev.wellId] : s.cloud[ev.wellId];
    const seen = isCenter ? s.seen.gateway : s.seen.cloud;
    const where = isCenter ? 'Centro' : 'Nube';
    if (isCenter) {
      if (isRadio(d.via)) k.lastHeardAt = now;
      if (d.via === 'LORA' && d.from === ev.wellId) k.lastDirectAt = now;
      if (d.via === 'LORA_RELAY' && isWell(d.from)) {
        k.lastWitnessAt = now;
        k.witnessBy = d.from;
      }
      k.via = d.via;
    } else {
      k.lastHeardAt = now;
    }
    if (seen.includes(ev.eventId)) {
      addLog(s, 'RED', `${where}: evento #${ev.num} duplicado reconocido (${VIA_LABEL[d.via]}); no se reaplica`, ev.wellId);
      return;
    }
    seen.push(ev.eventId);
    const result = applyEventToKnowledge(k, ev, now);
    if (result === 'STALE') {
      addLog(s, 'RED', `${where}: IGNORED_STALE_EVENT #${ev.num} (seq ${ev.seq} es antigua); se conserva el estado más nuevo`, ev.wellId);
    } else if (result === 'PING') {
      addLog(s, 'RED', `${where} recibió ping técnico #${ev.num} (no cambia el estado del agua)`, ev.wellId);
    } else {
      addLog(s, 'RED', `${where} recibió y aplicó evento #${ev.num} vía ${VIA_LABEL[d.via]}${isCenter ? ' · publicado en MQTT local (QoS 1)' : ''}`, ev.wellId);
    }
    if (isCenter) enqueue(s, ev.eventId, 'gateway', 'cloud', 'MQTT');
    return;
  }
  if (isWell(d.to) && d.via === 'LORA_WITNESS') {
    const w = s.wells[d.to];
    if (!w.witnessStore.includes(ev.eventId)) w.witnessStore.push(ev.eventId);
    enqueue(s, ev.eventId, d.to, 'gateway', 'LORA_RELAY');
    return;
  }
  if (isWell(d.to) && d.via === 'BLE') {
    const w = s.wells[d.to];
    if (ev.factors) w.factors = mergeFactors(w.factors, ev.factors, ev.occurredAt).factors;
    delete s.phone.pendingBle[d.to];
    addLog(s, 'COMUNIDAD', `${w.name} actualizado por BLE con el registro #${ev.num} de la trabajadora`, d.to);
    syncWell(s, d.to, ev.eventType, 'FIELD_WORKER', ev.reason, true, ev.verifiedBy);
  }
}

function onAck(s: SimulationState, d: Delivery): void {
  const ev = s.events[d.eventId];
  d.status = 'ACKED';
  d.note = undefined;
  addFx(s, 'ACK', 900, { from: d.from, to: d.to });
  if (d.to === 'gateway') {
    addLog(s, 'RED', `ACK de aplicación del centro para evento #${ev.num} (intento ${d.attempt})`, ev.wellId);
    // El evento ya está en el centro: las otras rutas pendientes se cancelan.
    for (const o of s.deliveries) {
      if (o !== d && o.eventId === d.eventId && o.to === 'gateway' && o.status === 'QUEUED') {
        o.status = 'CANCELLED';
        o.note = 'Confirmado por otra ruta';
      }
      if (o.eventId === d.eventId && o.via === 'LORA_WITNESS' && o.status === 'QUEUED') {
        o.status = 'CANCELLED';
        o.note = 'Confirmado por otra ruta';
      }
    }
    s.phone.carried = s.phone.carried.filter((id) => id !== d.eventId);
  } else if (d.to === 'cloud') {
    addLog(s, 'RED', `Nube confirmó evento #${ev.num} (PUBACK)`, ev.wellId);
  }
}

export function tickTransport(s: SimulationState): void {
  const now = s.clockMs;
  const c = s.connectivity;
  spawnRelays(s);
  for (const d of [...s.deliveries]) {
    const key = linkKey(d.from, d.to);
    if (d.status === 'QUEUED') {
      if (now < d.nextRetryAt || !canSend(s, d.from, d.to) || busy(s, d)) continue;
      d.status = 'SENDING';
      d.startedAt = now;
      d.arriveAt = now + (d.latencyOverride ?? latencyFor(s, d.via));
      d.note = undefined;
      if (d.attempt > 1) {
        const ev = s.events[d.eventId];
        addLog(s, 'RED', `Intento ${d.attempt} del evento #${ev.num} (${NODE_LABEL[d.from]}→${NODE_LABEL[d.to]})`, ev.wellId);
      }
    } else if (d.status === 'SENDING' && d.arriveAt !== undefined && now >= d.arriveAt) {
      if (!canSend(s, d.from, d.to)) {
        drop(s, d, 'Enlace cortado durante el envío');
      } else if (c.dropNext[key]) {
        c.dropNext[key] = false;
        drop(s, d, 'Paquete perdido');
      } else if (isRadio(d.via) && c.packetLossPct > 0 && random(s) * 100 < c.packetLossPct) {
        drop(s, d, 'Paquete perdido');
      } else {
        d.status = 'DELIVERED';
        d.ackAt = now + Math.round((d.latencyOverride ?? latencyFor(s, d.via)) * 0.5);
        receive(s, d);
      }
    } else if (d.status === 'DELIVERED' && d.ackAt !== undefined && now >= d.ackAt) {
      if (c.dropNextAck[key]) {
        c.dropNextAck[key] = false;
        const ev = s.events[d.eventId];
        addFx(s, 'DROP', 1200, { from: d.to, to: d.from, label: 'ACK perdido' });
        addLog(s, 'RED', `ACK perdido para evento #${ev.num}: el emisor reintentará (el receptor deduplicará)`, ev.wellId);
        requeue(s, d, 'Sin ACK: reintento');
      } else {
        onAck(s, d);
      }
    }
  }
  // Limpieza: conservar solo entregas recientes ya cerradas.
  s.deliveries = s.deliveries.filter(
    (d) => !((d.status === 'ACKED' || d.status === 'CANCELLED') && now - (d.ackAt ?? d.createdAt) > 30000),
  );
}

/** Heartbeats livianos (sin animación): el centro sabe si un pozo vive y por qué ruta. */
export function tickHeartbeats(s: SimulationState): void {
  const c = s.connectivity;
  while (s.clockMs >= s.nextHeartbeatAt) {
    for (const id of WELL_IDS) {
      if (!s.wells[id].powered || !c.gatewayPowered) continue;
      const k = s.center[id];
      if (c.lora[id]) {
        k.lastHeardAt = s.clockMs;
        k.lastDirectAt = s.clockMs;
        continue;
      }
      const witness = MESH_PAIRS.filter(([a, b]) => a === id || b === id)
        .map(([a, b]) => (a === id ? b : a))
        .find((j) => canSend(s, id, j) && canSend(s, j, 'gateway'));
      if (witness) {
        k.lastWitnessAt = s.clockMs;
        k.witnessBy = witness;
      }
    }
    if (c.gatewayPowered && c.cloud) {
      for (const id of WELL_IDS) {
        s.cloud[id].lastHeardAt = s.center[id].lastHeardAt;
        s.cloud[id].lastWitnessAt = s.center[id].lastWitnessAt;
      }
      if (s.rain.startedAt !== null) s.rain.cloudKnows = true;
    }
    s.nextHeartbeatAt += DEMO_CONFIG.heartbeatEveryMs;
  }
}

export function pendingFor(s: SimulationState, wellId: WellId): Delivery[] {
  return s.deliveries.filter(
    (d) => d.from === wellId && d.to === 'gateway' && (d.status === 'QUEUED' || d.status === 'SENDING'),
  );
}

export function lastAckFor(s: SimulationState, wellId: WellId): Delivery | undefined {
  return [...s.deliveries]
    .reverse()
    .find((d) => d.status === 'ACKED' && d.to === 'gateway' && s.events[d.eventId]?.wellId === wellId);
}

/** Diagnóstico del testigo desde el punto de vista del centro (tabla §6.4 del documento técnico). */
export function diagnoseLink(s: SimulationState, wellId: WellId): { tone: 'ok' | 'warn' | 'bad'; text: string } {
  const k = s.center[wellId];
  const now = s.clockMs;
  const freshMs = DEMO_CONFIG.demoFreshnessWarningSeconds * 1000;
  if (!s.connectivity.gatewayPowered) return { tone: 'bad', text: 'Gateway del centro apagado: nadie recibe' };
  const directFresh = now - k.lastDirectAt <= DEMO_CONFIG.heartbeatEveryMs * 2.5;
  const witnessFresh = now - k.lastWitnessAt <= DEMO_CONFIG.heartbeatEveryMs * 2.5;
  if (directFresh) return { tone: 'ok', text: 'Enlace directo LoRa operativo' };
  if (witnessFresh)
    return {
      tone: 'warn',
      text: `Pozo vivo, enlace directo caído: ${k.witnessBy ? WELL_NAMES[k.witnessBy] : 'un vecino'} lo escucha y retransmite`,
    };
  const othersAlive = WELL_IDS.some((id) => id !== wellId && now - s.center[id].lastDirectAt <= freshMs);
  if (othersAlive) return { tone: 'bad', text: 'Sin señal del pozo ni de testigos: posible falla de energía o equipo · enviar trabajadora' };
  return { tone: 'bad', text: 'Ningún pozo llega al centro: revisar antena/energía del gateway' };
}

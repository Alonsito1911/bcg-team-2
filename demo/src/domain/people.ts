// Habitantes y trabajadora: elección de pozo según información ACCESIBLE (semáforo central),
// desplazamiento por senderos, descubrimiento en el sitio, reporte con la caja y verificación.
import { DEMO_CONFIG } from './config';
import { isFresh } from './deriveVillageState';
import { pathLength, PLAZA, routeHome, routeToPlaza, routeToWell, sceneDistance } from './geometry';
import { addFx, addLog, deriveLocal, WELL_NAMES } from './state';
import { canSend, createPhoneEvent, enqueue, pendingFor, syncWell } from './transport';
import { WELL_IDS, type Person, type ReportReason, type SimulationState, type WellId, type WellState } from './types';

// ---------------------------------------------------------------- ruteo

export interface Choice {
  wellId: WellId;
  cost: number;
  reason: string;
}

/** ¿El pozo es elegible para recoger agua según lo que el centro muestra? */
export function knownEligible(s: SimulationState, wellId: WellId): boolean {
  if (!s.connectivity.gatewayPowered) return true; // sin información: se verificará en el sitio
  return s.center[wellId].status === 'ENABLED';
}

export function chooseWell(s: SimulationState, from: Person['pos'], exclude: WellId[]): Choice | null {
  const noInfo = !s.connectivity.gatewayPowered;
  const options = WELL_IDS.filter((id) => !exclude.includes(id) && knownEligible(s, id)).map((id) => {
    const k = s.center[id];
    let cost = pathLength(routeToWell(from, id));
    const notes: string[] = [];
    if (!noInfo && k.lowReserve) {
      cost += 15;
      notes.push('reserva baja');
    }
    if (!noInfo && !isFresh(k, s.clockMs)) {
      cost += 25;
      notes.push('dato antiguo');
    }
    return { wellId: id, cost: Math.round(cost * 10) / 10, notes };
  });
  options.sort((a, b) => a.cost - b.cost || a.wellId.localeCompare(b.wellId));
  const best = options[0];
  if (!best) return null;
  const reason = noInfo
    ? 'Semáforo sin información: verificará el indicador en el pozo'
    : `Más cercano conocido como habilitado${best.notes.length ? ` (${best.notes.join(', ')})` : ''}`;
  return { wellId: best.wellId, cost: best.cost, reason };
}

// ---------------------------------------------------------------- helpers de personas

function person(s: SimulationState, id: string): Person {
  const p = s.people.find((x) => x.id === id);
  if (!p) throw new Error(`persona desconocida ${id}`);
  return p;
}

function say(s: SimulationState, p: Person, text: string, ms = 2600): void {
  p.bubble = text;
  p.bubbleUntil = s.clockMs + ms;
}

function walkTo(p: Person, path: Person['path'], activity: Person['activity'] = 'WALKING'): void {
  p.path = path.filter((pt, i) => i > 0 || sceneDistance(pt, p.pos) > 0.5);
  p.activity = activity;
}

function centerSig(s: SimulationState): string {
  return WELL_IDS.map((id) => s.center[id].status).join(',') + (s.connectivity.gatewayPowered ? '' : '|off');
}

function startWaiting(s: SimulationState, p: Person): void {
  p.activity = 'WAITING';
  p.activityUntil = 0;
  p.waitSig = centerSig(s);
}

function goHome(p: Person, waiting: boolean): void {
  p.intent = 'HOME';
  p.target = undefined;
  p.activity = 'RETURNING';
  p.path = routeHome(p.pos, p.home);
  if (waiting) p.activityUntil = -1; // marca: al llegar, esperar
  else p.activityUntil = 0;
}

const STATE_SEEN: Record<WellState, string> = {
  ENABLED: 'Habilitado',
  NO_WATER: 'Sin agua: el pozo está seco',
  VALVE_DAMAGE: 'La bomba/válvula no funciona',
  CONTAMINATED: 'Señal roja: no se bebe',
  UNKNOWN: 'Sin verificar: no la bebo',
};

// ---------------------------------------------------------------- acciones

export function sendPerson(s: SimulationState, personId: string, target: WellId | 'AUTO'): void {
  const p = person(s, personId);
  if (p.role === 'WORKER') {
    if (target === 'AUTO') startRound(s);
    else {
      p.intent = 'INSPECT';
      p.round = [target];
      p.target = target;
      p.bubble = undefined;
      walkTo(p, routeToWell(p.pos, target));
      addLog(s, 'COMUNIDAD', `${p.name} va a inspeccionar ${WELL_NAMES[target]}`, target);
    }
    return;
  }
  p.avoid = [];
  if (target === 'AUTO') {
    const choice = chooseWell(s, p.pos, []);
    if (!choice) {
      say(s, p, 'No hay fuente habilitada conocida', 3500);
      startWaiting(s, p);
      addLog(s, 'COMUNIDAD', `${p.name}: no hay fuente habilitada conocida; espera en el pueblo`);
      return;
    }
    dispatchCollect(s, p, choice.wellId, choice.reason);
    return;
  }
  if (!knownEligible(s, target)) {
    const alt = chooseWell(s, p.pos, [target]);
    addFx(s, 'BLOCKED', 3200, { wellId: target, personId: p.id, label: alt ? `Sugerido: ${WELL_NAMES[alt.wellId]}` : 'Sin alternativa' });
    say(s, p, `${WELL_NAMES[target]} no es apto${alt ? ` · mejor ${WELL_NAMES[alt.wellId]}` : ''}`, 3500);
    addLog(
      s,
      'COMUNIDAD',
      `Salida bloqueada: el centro marca ${WELL_NAMES[target]} como no apto para recoger agua${alt ? `; sugerencia ${WELL_NAMES[alt.wellId]}` : '; no hay alternativa habilitada'}`,
      target,
    );
    return;
  }
  dispatchCollect(s, p, target, 'Destino elegido por el operador');
}

function dispatchCollect(s: SimulationState, p: Person, wellId: WellId, reason: string): void {
  p.intent = 'COLLECT';
  p.target = wellId;
  p.routeChoice = reason;
  p.carryingWater = false;
  walkTo(p, routeToWell(p.pos, wellId));
  addLog(s, 'COMUNIDAD', `${p.name} sale hacia ${WELL_NAMES[wellId]} · ${reason}`, wellId);
}

export function startRound(s: SimulationState): void {
  const p = s.people.find((x) => x.role === 'WORKER')!;
  p.intent = 'ROUND';
  p.round = [...WELL_IDS];
  p.target = p.round[0];
  walkTo(p, routeToWell(p.pos, p.target));
  addLog(s, 'COMUNIDAD', `Visita semanal: ${p.name} recorre los 3 pozos para verificar`);
}

/** Demo guiada: la guardiana camina a un pozo y se queda ahí (no toma la muestra sola). */
export function sendVisit(s: SimulationState, wellId: WellId): void {
  const p = s.people.find((x) => x.role === 'WORKER')!;
  p.intent = 'VISIT';
  p.round = [wellId];
  p.target = wellId;
  p.bubble = undefined;
  walkTo(p, routeToWell(p.pos, wellId));
  addLog(s, 'COMUNIDAD', `${p.name} va al ${WELL_NAMES[wellId]} para revisarlo`, wellId);
}

/** Demo guiada: el reporte de la guardiana (confirmado desde el teléfono) entra a la red simulada. */
export function guardianReport(s: SimulationState, wellId: WellId): void {
  const p = s.people.find((x) => x.role === 'WORKER')!;
  inspect(s, p, wellId);
  say(s, p, 'Reportado ✓ · aviso enviado', 4000);
}

export function personSay(s: SimulationState, personId: string, text: string, ms: number): void {
  say(s, person(s, personId), text, ms);
}

export function sendRepair(s: SimulationState, wellId: WellId): void {
  const p = s.people.find((x) => x.role === 'WORKER')!;
  p.intent = 'REPAIR';
  p.round = [wellId];
  p.target = wellId;
  walkTo(p, routeToWell(p.pos, wellId));
  addLog(s, 'MANTENIMIENTO', `${p.name} va a reparar la válvula de ${WELL_NAMES[wellId]}`, wellId);
}

/** Botón de la caja comunitaria en el pozo. */
export const REASON_LABEL: Record<ReportReason, string> = {
  NONE: '—',
  CONTAMINATION: 'agua con olor/color extraño',
  NO_WATER: 'no sale agua',
  VALVE: 'válvula/manivela rota',
  OTHER: 'problema en el pozo',
};

export function communityReport(s: SimulationState, wellId: WellId, kind: 'GOOD' | 'BAD', by: string, reason: ReportReason = 'OTHER'): void {
  const w = s.wells[wellId];
  if (!w.powered) {
    addLog(s, 'COMUNIDAD', `${by} presionó ${kind === 'BAD' ? 'MAL' : 'BIEN'} pero la caja del ${w.name} está sin energía`, wellId);
    return;
  }
  w.communityReports.push({ kind, at: s.clockMs, by, reason: kind === 'BAD' ? reason : undefined });
  if (kind === 'GOOD') {
    addLog(s, 'COMUNIDAD', `${by} presionó BIEN en ${w.name}: se guarda como evidencia, no cambia el color`, wellId);
    syncWell(s, wellId, 'GOOD_REPORTED', 'VILLAGER', 'Reporte BIEN (evidencia comunitaria)', true);
    return;
  }
  const already = w.factors.reportedAnomaly === 'SUSPECTED';
  w.factors.reportedAnomaly = 'SUSPECTED';
  w.factors.reportReason = reason;
  w.factors.anomalyChangedAt = s.clockMs;
  addLog(
    s,
    'COMUNIDAD',
    `${by} presionó MAL en ${w.name} (${REASON_LABEL[reason]})${already ? ' · ya estaba reportado' : ''} → el pozo queda DESHABILITADO hasta que la guardiana lo revise`,
    wellId,
  );
  syncWell(s, wellId, 'ANOMALY_REPORTED', 'VILLAGER', `Reporte comunitario: ${REASON_LABEL[reason]}`, true);
}

// ---------------------------------------------------------------- llegada a destinos

/** Falla física que una persona puede ver en el sitio y que el dispositivo aún no informa. */
function visibleFault(s: SimulationState, wellId: WellId): ReportReason {
  const w = s.wells[wellId];
  const local = deriveLocal(s, wellId).primary;
  if (w.hiddenContamination && local !== 'CONTAMINATED') return 'CONTAMINATION';
  if (w.physicalValveBroken && local !== 'VALVE_DAMAGE') return 'VALVE';
  if (w.physicalDry && local !== 'NO_WATER') return 'NO_WATER';
  return 'NONE';
}

const DISCOVERY: Record<ReportReason, string> = {
  NONE: '',
  CONTAMINATION: 'Olor y color extraños… no la bebo',
  NO_WATER: 'El cubo sale vacío: no hay agua',
  VALVE: 'La manivela está rota: no puedo sacar agua',
  OTHER: 'Algo anda mal aquí',
};

function arriveCollect(s: SimulationState, p: Person, wellId: WellId): void {
  const w = s.wells[wellId];
  const local = deriveLocal(s, wellId);
  const fault = visibleFault(s, wellId);
  if (fault !== 'NONE') {
    if (w.factors.reportedAnomaly === 'SUSPECTED') {
      say(s, p, 'Ya está reportado: busco otro pozo');
      reroute(s, p, wellId);
      return;
    }
    p.activity = 'OBSERVING';
    p.pendingReport = fault;
    p.activityUntil = s.clockMs + DEMO_CONFIG.observeMs;
    say(s, p, DISCOVERY[fault], DEMO_CONFIG.observeMs + 400);
    addLog(s, 'COMUNIDAD', `${p.name} llega a ${w.name} y falla: ${REASON_LABEL[fault]}`, wellId);
    return;
  }
  if (!w.powered) {
    say(s, p, 'Indicador apagado: no asumo que sea segura');
    addLog(s, 'COMUNIDAD', `${p.name} encuentra el indicador del ${w.name} apagado; no recoge agua`, wellId);
    reroute(s, p, wellId);
    return;
  }
  if (local.primary === 'ENABLED') {
    p.activity = 'COLLECTING';
    p.activityUntil = s.clockMs + DEMO_CONFIG.collectMs;
    say(s, p, 'Recogiendo agua…', DEMO_CONFIG.collectMs);
    return;
  }
  say(s, p, STATE_SEEN[local.primary]);
  addLog(s, 'COMUNIDAD', `${p.name} llega a ${w.name}: ${STATE_SEEN[local.primary]}`, wellId);
  reroute(s, p, wellId);
}

function reroute(s: SimulationState, p: Person, bad?: WellId): void {
  if (bad && !p.avoid.includes(bad)) p.avoid.push(bad);
  const choice = chooseWell(s, p.pos, p.avoid);
  if (!choice) {
    say(s, p, 'Sin alternativa habilitada', 3500);
    addLog(s, 'COMUNIDAD', `${p.name}: sin alternativa habilitada; vuelve al pueblo a esperar`);
    goHome(p, true);
    return;
  }
  p.activity = 'REROUTING';
  p.activityUntil = s.clockMs + DEMO_CONFIG.rerouteMs;
  p.target = choice.wellId;
  p.routeChoice = choice.reason;
  addLog(s, 'COMUNIDAD', `${p.name} se redirige a ${WELL_NAMES[choice.wellId]} · ${choice.reason}`, choice.wellId);
}

function inspect(s: SimulationState, p: Person, wellId: WellId): void {
  const w = s.wells[wellId];
  const now = s.clockMs;
  const bleOk = canSend(s, 'phone', wellId);
  // Ruta B: copiar por BLE lo que el pozo no pudo enviar por radio.
  if (bleOk) {
    const pending = pendingFor(s, wellId).map((d) => d.eventId);
    const fresh = pending.filter((id) => !s.phone.carried.includes(id));
    if (fresh.length) {
      s.phone.carried.push(...fresh);
      addLog(s, 'RED', `${p.name} copió por BLE ${fresh.length} evento(s) pendiente(s) del ${w.name} para llevarlos al centro`, wellId);
    }
  }
  const positive = w.hiddenContamination;
  const ops = w.physicalDry || w.physicalValveBroken || w.factors.valveCondition === 'DAMAGED' || w.factors.waterVolumePct < DEMO_CONFIG.dryVolumeThresholdPct;
  const ev = createPhoneEvent(
    s,
    wellId,
    positive ? 'WATER_TEST_CONFIRMED_POSITIVE' : 'WATER_TEST_VALID_NEGATIVE',
    {
      waterTest: positive ? 'CONFIRMED_POSITIVE' : 'VALID_NEGATIVE',
      testTakenAt: now,
      testValidUntil: now + DEMO_CONFIG.testValidityDays * DEMO_CONFIG.dayMs,
      testVerifiedBy: 'Trabajadora comunitaria (simulado)',
      reportedAnomaly: 'NONE',
      reportReason: 'NONE',
      anomalyChangedAt: now,
      ...(ops
        ? {
            waterVolumePct: w.physicalDry ? 5 : Math.max(w.factors.waterVolumePct, DEMO_CONFIG.lowReserveThresholdPct + 10),
            valveCondition: w.physicalValveBroken ? ('DAMAGED' as const) : ('OK' as const),
            opsChangedAt: now,
          }
        : {}),
    },
    positive
      ? 'Prueba simulada POSITIVA: contaminación confirmada'
      : w.physicalDry
        ? 'Inspección: pozo seco (prueba negativa)'
        : w.physicalValveBroken
          ? 'Inspección: válvula rota (prueba negativa)'
          : 'Prueba simulada negativa: pozo apto',
  );
  say(s, p, positive ? 'Contaminado ✕ · aviso al pueblo' : w.physicalDry ? 'Pozo seco ✕' : w.physicalValveBroken ? 'Válvula rota ✕' : 'Agua apta ✓', 3000);
  if (w.factors.valveCondition === 'DAMAGED') {
    addLog(s, 'MANTENIMIENTO', `${p.name} constata válvula dañada en ${w.name}: requiere reparación`, wellId);
  }
  if (bleOk) {
    enqueue(s, ev.eventId, 'phone', wellId, 'BLE');
    if (!s.connectivity.lora[wellId]) s.phone.carried.push(ev.eventId);
  } else {
    s.phone.pendingBle[wellId] = ev.eventId;
    s.phone.carried.push(ev.eventId);
    addLog(s, 'RED', `BLE no disponible: el resultado queda en el teléfono (no actualiza aún el ${w.name})`, wellId);
  }
}

function repair(s: SimulationState, p: Person, wellId: WellId): void {
  const w = s.wells[wellId];
  w.physicalValveBroken = false;
  w.factors.valveCondition = 'OK';
  w.factors.opsChangedAt = s.clockMs;
  say(s, p, 'Válvula reparada ✓', 2500);
  addLog(s, 'MANTENIMIENTO', `MAINTENANCE_COMPLETED: ${p.name} reparó la válvula del ${w.name}`, wellId);
  syncWell(s, wellId, 'MAINTENANCE_COMPLETED', 'FIELD_WORKER', 'Reparación de válvula completada', true, p.name);
}

function workerNext(p: Person): void {
  p.round = p.round.slice(1);
  if (p.intent === 'ROUND' && p.round.length) {
    p.target = p.round[0];
    walkTo(p, routeToWell(p.pos, p.target));
    return;
  }
  p.intent = 'HOME';
  p.target = undefined;
  p.syncPending = true;
  walkTo(p, routeToPlaza(p.pos), 'RETURNING');
}

function syncPhone(s: SimulationState, p: Person): void {
  const ids = [...new Set(s.phone.carried)];
  if (!ids.length) {
    addLog(s, 'RED', `${p.name} pasa por el centro: nada pendiente que sincronizar`);
    return;
  }
  if (!s.connectivity.gatewayPowered) {
    addLog(s, 'RED', `${p.name} no puede sincronizar: gateway apagado; conserva ${ids.length} evento(s)`);
    return;
  }
  addLog(s, 'RED', `${p.name} sincroniza su teléfono con el centro: ${ids.length} evento(s) portados (ruta B)`);
  for (const id of ids) enqueue(s, id, 'phone', 'gateway', 'CARRIED');
  s.phone.carried = [];
}

// ---------------------------------------------------------------- avance por tick

function finishActivity(s: SimulationState, p: Person): void {
  switch (p.activity) {
    case 'OBSERVING':
      p.activity = 'REPORTING';
      p.activityUntil = s.clockMs + DEMO_CONFIG.reportMs;
      say(s, p, 'Presiono MAL en la caja', DEMO_CONFIG.reportMs + 400);
      if (p.target) communityReport(s, p.target, 'BAD', p.name, p.pendingReport ?? 'OTHER');
      p.pendingReport = undefined;
      return;
    case 'REPORTING':
      reroute(s, p, p.target);
      return;
    case 'COLLECTING': {
      const w = p.target ? s.wells[p.target] : null;
      if (w) {
        const pct = (DEMO_CONFIG.collectLiters / DEMO_CONFIG.demoCapacityLiters) * 100;
        w.factors.waterVolumePct = Math.max(0, w.factors.waterVolumePct - pct);
        w.factors.opsChangedAt = s.clockMs;
        addLog(s, 'AGUA', `${p.name} recogió ${DEMO_CONFIG.collectLiters} L simbólicos en ${w.name}`, w.id);
        syncWell(s, w.id, 'LOW_VOLUME_READING', 'SENSOR', 'Lectura de nivel tras recolección');
      }
      p.carryingWater = true;
      goHome(p, false);
      return;
    }
    case 'REROUTING':
      if (p.target) walkTo(p, routeToWell(p.pos, p.target));
      else goHome(p, true);
      return;
    case 'INSPECTING':
      if (p.target) inspect(s, p, p.target);
      workerNext(p);
      return;
    case 'REPAIRING':
      if (p.target) repair(s, p, p.target);
      workerNext(p);
      return;
    case 'SYNCING':
      walkTo(p, [p.home], 'RETURNING');
      return;
    default:
      p.activity = 'IDLE';
  }
}

function arrive(s: SimulationState, p: Person): void {
  if (p.intent === 'COLLECT' && p.target) {
    arriveCollect(s, p, p.target);
    return;
  }
  if (p.intent === 'VISIT' && p.target) {
    p.activity = 'INSPECTING';
    p.activityUntil = 0;
    say(s, p, 'Revisando el pozo…', 2500);
    return;
  }
  if ((p.intent === 'INSPECT' || p.intent === 'ROUND') && p.target) {
    p.activity = 'INSPECTING';
    p.activityUntil = s.clockMs + DEMO_CONFIG.inspectMs;
    say(s, p, 'Tomando muestra…', DEMO_CONFIG.inspectMs);
    return;
  }
  if (p.intent === 'REPAIR' && p.target) {
    p.activity = 'REPAIRING';
    p.activityUntil = s.clockMs + DEMO_CONFIG.repairMs;
    say(s, p, 'Reparando…', DEMO_CONFIG.repairMs);
    return;
  }
  // Llegó a la plaza o a casa.
  if (p.syncPending && sceneDistance(p.pos, PLAZA) < 1) {
    p.syncPending = false;
    p.activity = 'SYNCING';
    p.activityUntil = s.clockMs + DEMO_CONFIG.syncMs;
    say(s, p, 'Sincronizando teléfono…', DEMO_CONFIG.syncMs);
    syncPhone(s, p);
    return;
  }
  if (p.activityUntil === -1) {
    startWaiting(s, p);
    say(s, p, 'Esperando una fuente habilitada', 3000);
    return;
  }
  p.activity = 'IDLE';
  if (p.carryingWater) say(s, p, '¡Agua para la casa!', 2000);
}

export function tickPeople(s: SimulationState, dtMs: number): void {
  for (const p of s.people) {
    if (p.bubble && s.clockMs >= p.bubbleUntil) p.bubble = undefined;
    if (p.activity === 'IDLE' && p.carryingWater && !p.bubble) p.carryingWater = false;

    // Esperando: si aparece una fuente conocida, sale de nuevo.
    if (p.role === 'VILLAGER' && p.activity === 'WAITING') {
      if (p.waitSig === centerSig(s)) continue;
      p.waitSig = centerSig(s);
      const choice = chooseWell(s, p.pos, []);
      if (choice && s.connectivity.gatewayPowered) {
        p.avoid = [];
        dispatchCollect(s, p, choice.wellId, 'El semáforo vuelve a mostrar una fuente habilitada');
      }
      continue;
    }

    // Mientras camina hacia un pozo: si el centro informa que dejó de ser apto, reconsidera.
    if (p.role === 'VILLAGER' && p.activity === 'WALKING' && p.intent === 'COLLECT' && p.target && !knownEligible(s, p.target)) {
      say(s, p, 'La señal cambió: busco otro pozo');
      addLog(s, 'COMUNIDAD', `${p.name} se detiene: el centro ya no muestra ${WELL_NAMES[p.target]} como apto`, p.target);
      p.path = [];
      reroute(s, p, p.target);
      continue;
    }

    if (p.path.length) {
      let budget = (DEMO_CONFIG.walkSpeed * dtMs) / 1000;
      while (budget > 0 && p.path.length) {
        const next = p.path[0];
        const d = sceneDistance(p.pos, next);
        if (Math.abs(next.x - p.pos.x) > 0.2) p.facing = next.x >= p.pos.x ? 1 : -1;
        if (d <= budget) {
          p.pos = { ...next };
          p.path.shift();
          budget -= d;
        } else {
          const r = budget / d;
          p.pos = { x: p.pos.x + (next.x - p.pos.x) * r, y: p.pos.y + (next.y - p.pos.y) * r };
          budget = 0;
        }
      }
      if (!p.path.length) arrive(s, p);
      continue;
    }

    if (p.activityUntil > 0 && s.clockMs >= p.activityUntil) {
      p.activityUntil = 0;
      finishActivity(s, p);
    }
  }
}

export function isMoving(p: Person): boolean {
  return p.path.length > 0;
}

/** Próximo instante en que una persona cambia de actividad (para "Paso a paso"). */
export function nextPeopleWake(s: SimulationState): number {
  let next = Infinity;
  for (const p of s.people) {
    if (p.path.length) {
      const remaining = pathLength([p.pos, ...p.path]);
      next = Math.min(next, s.clockMs + Math.ceil((remaining / DEMO_CONFIG.walkSpeed) * 1000));
    } else if (p.activityUntil > 0) {
      next = Math.min(next, p.activityUntil);
    }
  }
  return next;
}

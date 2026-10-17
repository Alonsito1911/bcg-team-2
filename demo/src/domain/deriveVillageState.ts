import { DEMO_CONFIG } from './config';
import { WELL_IDS, type Knowledge, type WellId } from './types';

export type VillageSignal = 'GREEN' | 'YELLOW' | 'RED' | 'NO_INFO';

export interface VillageView {
  signal: VillageSignal;
  message: string;
  usable: WellId[];
  stale: WellId[];
  lastReceivedAt: number;
}

export function isFresh(k: Knowledge, now: number): boolean {
  const heard = Math.max(k.lastHeardAt, k.lastWitnessAt);
  return heard >= 0 && now - heard <= DEMO_CONFIG.demoFreshnessWarningSeconds * 1000;
}

/**
 * Agregación del semáforo central (doc 01 §3). Usa SOLO lo que el centro recibió.
 * No representa que toda el agua del pueblo tenga la misma calidad.
 */
export function deriveVillageState(
  center: Record<WellId, Knowledge>,
  now: number,
  gatewayPowered: boolean,
): VillageView {
  const lastReceivedAt = Math.max(...WELL_IDS.map((id) => center[id].receivedAt));
  if (!gatewayPowered) {
    return {
      signal: 'NO_INFO',
      message: 'Sin información · no asumir seguridad',
      usable: [],
      stale: [...WELL_IDS],
      lastReceivedAt,
    };
  }
  const stale = WELL_IDS.filter((id) => !isFresh(center[id], now));
  const usable = WELL_IDS.filter((id) => center[id].status === 'ENABLED');

  if (stale.length === WELL_IDS.length) {
    return { signal: 'NO_INFO', message: 'Datos desactualizados · no asumir seguridad', usable, stale, lastReceivedAt };
  }
  if (usable.length === 0) {
    return { signal: 'RED', message: 'Sin punto habilitado conocido', usable, stale, lastReceivedAt };
  }
  const allGood =
    usable.length === WELL_IDS.length && stale.length === 0 && WELL_IDS.every((id) => !center[id].lowReserve);
  if (allGood) {
    return { signal: 'GREEN', message: `${usable.length} puntos disponibles`, usable, stale, lastReceivedAt };
  }
  return { signal: 'YELLOW', message: 'Precaución: revisa qué pozo usar', usable, stale, lastReceivedAt };
}

import { DEMO_CONFIG } from './config';
import type { WellFactors, WellState } from './types';

export interface DeriveContext {
  now: number;
  /** Inicio de la ventana de lluvia activa, o null si no hay ventana activa. */
  rainActiveSince: number | null;
  /** El dispositivo no tiene energía: no puede demostrar nada. */
  unpowered?: boolean;
}

export interface DerivedWell {
  primary: WellState;
  /** Problemas adicionales que no deben ocultarse (p. ej. válvula bajo contaminación). */
  secondary: WellState[];
  lowReserve: boolean;
  reasons: string[];
  testExpired: boolean;
  rainBlocked: boolean;
}

export function isTestExpired(f: WellFactors, now: number): boolean {
  return f.waterTest === 'EXPIRED' || (f.waterTest === 'VALID_NEGATIVE' && now > f.testValidUntil);
}

/**
 * Fuente de verdad del estado de un pozo (doc 01 §2.4), con la regla extra de la
 * ventana de lluvia: una verificación tomada ANTES de la lluvia no sirve durante la ventana.
 */
export function deriveWellState(f: WellFactors, ctx: DeriveContext): DerivedWell {
  const problems: WellState[] = [];
  const reasons: string[] = [];
  const testExpired = isTestExpired(f, ctx.now);
  const rainBlocked =
    ctx.rainActiveSince !== null && f.waterTest === 'VALID_NEGATIVE' && f.testTakenAt <= ctx.rainActiveSince;

  if (f.waterTest === 'CONFIRMED_POSITIVE') {
    problems.push('CONTAMINATED');
    reasons.push('Prueba positiva (resultado simulado)');
  }
  if (f.valveCondition === 'DAMAGED') {
    problems.push('VALVE_DAMAGE');
    reasons.push('Válvula/bomba dañada: no se puede extraer agua');
  }
  if (f.waterVolumePct < DEMO_CONFIG.dryVolumeThresholdPct) {
    problems.push('NO_WATER');
    reasons.push(`Volumen ${Math.round(f.waterVolumePct)} % bajo el mínimo operativo`);
  }

  let unknown = false;
  if (f.reportedAnomaly === 'SUSPECTED') {
    unknown = true;
    reasons.push('Sospecha reportada por la comunidad, pendiente de verificación');
  }
  if (f.waterTest !== 'VALID_NEGATIVE' && f.waterTest !== 'CONFIRMED_POSITIVE') {
    unknown = true;
    reasons.push('Sin verificación sanitaria vigente');
  } else if (testExpired) {
    unknown = true;
    reasons.push('Verificación vencida');
  }
  if (rainBlocked) {
    unknown = true;
    reasons.push('Ventana de lluvia: la verificación es anterior a la lluvia');
  }
  if (ctx.unpowered) {
    unknown = true;
    reasons.push('Dispositivo sin energía: no puede demostrar su estado');
  }

  const primary: WellState = problems[0] ?? (unknown ? 'UNKNOWN' : 'ENABLED');
  const secondary = problems.slice(1);
  if (problems.length > 0 && unknown && !secondary.includes('UNKNOWN')) secondary.push('UNKNOWN');

  const lowReserve =
    f.waterVolumePct >= DEMO_CONFIG.dryVolumeThresholdPct && f.waterVolumePct < DEMO_CONFIG.lowReserveThresholdPct;
  if (primary === 'ENABLED') reasons.push('Volumen suficiente, válvula operativa y verificación vigente');

  return { primary, secondary, lowReserve, reasons, testExpired, rainBlocked };
}

export function rainActiveSince(rainStartedAt: number | null, now: number): number | null {
  if (rainStartedAt === null) return null;
  const end = rainStartedAt + DEMO_CONFIG.rainWindowDays * DEMO_CONFIG.dayMs;
  return now < end ? rainStartedAt : null;
}

export function isUsable(state: WellState): boolean {
  return state === 'ENABLED';
}

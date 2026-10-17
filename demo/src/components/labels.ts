import type { VillageSignal } from '../domain/deriveVillageState';
import type { LogFamily, WellFactors, WellState } from '../domain/types';

export const STATE_UI: Record<WellState, { label: string; icon: string; cls: string; hint: string }> = {
  ENABLED: { label: 'Habilitado', icon: '✔', cls: 'ok', hint: 'Volumen suficiente, válvula operativa y verificación vigente' },
  NO_WATER: { label: 'Sin agua', icon: '◌', cls: 'warn', hint: 'Volumen bajo el mínimo operativo' },
  CONTAMINATED: { label: 'Contaminado', icon: '⛔', cls: 'bad', hint: 'Prueba positiva (resultado simulado)' },
  VALVE_DAMAGE: { label: 'Válvula dañada', icon: '🔧', cls: 'warn', hint: 'Hay agua pero no se puede extraer' },
  UNKNOWN: { label: 'Sin verificar', icon: '?', cls: 'unk', hint: 'No asumir potable · pendiente de verificación' },
};

export const SIGNAL_UI: Record<VillageSignal, { label: string; cls: string; lamp: 'red' | 'amber' | 'green' | null }> = {
  GREEN: { label: 'Todos disponibles', cls: 'ok', lamp: 'green' },
  YELLOW: { label: 'Precaución', cls: 'warn', lamp: 'amber' },
  RED: { label: 'Sin fuentes habilitadas conocidas', cls: 'bad', lamp: 'red' },
  NO_INFO: { label: 'Sin información', cls: 'unk', lamp: null },
};

export const FAMILY_UI: Record<LogFamily, { icon: string; label: string }> = {
  AGUA: { icon: '💧', label: 'Agua' },
  COMUNIDAD: { icon: '👥', label: 'Comunidad' },
  RED: { icon: '📡', label: 'Red' },
  MANTENIMIENTO: { icon: '🔧', label: 'Mantenimiento' },
  OPERADOR: { icon: '🎛', label: 'Operador' },
};

export const QUICK_STATES = [
  { preset: 'ENABLED', label: 'Funciona bien', icon: '✔', cls: 'ok' },
  { preset: 'CONTAMINATED', label: 'Contaminación', icon: '☣', cls: 'bad' },
  { preset: 'NO_WATER', label: 'Sin agua', icon: '◌', cls: 'warn' },
  { preset: 'VALVE_DAMAGE', label: 'Válvula dañada', icon: '🔧', cls: 'warn' },
] as const;

export function spriteForState(state: WellState): string {
  switch (state) {
    case 'NO_WATER':
      return 'well-no-water';
    case 'CONTAMINATED':
      return 'well-contaminated';
    case 'VALVE_DAMAGE':
      return 'well-valve-damage';
    default:
      return 'well-enabled';
  }
}

const REASON_SHORT: Record<string, string> = {
  CONTAMINATION: 'contaminación',
  NO_WATER: 'sin agua',
  VALVE: 'válvula rota',
  OTHER: 'problema',
};

/** Etiqueta para un estado + factores conocidos: distingue "reportado por la comunidad" de "sin verificar". */
export function describeStatus(status: WellState, factors?: WellFactors | null): { label: string; icon: string; cls: string; detail: string } {
  if (status === 'UNKNOWN' && factors?.reportedAnomaly === 'SUSPECTED') {
    const r = REASON_SHORT[factors.reportReason] ?? 'problema';
    return { label: `Reportado: ${r}`, icon: '⚠', cls: 'bad', detail: `La comunidad reportó ${r}; deshabilitado hasta que la guardiana lo revise` };
  }
  if (status === 'CONTAMINATED') return { ...STATE_UI.CONTAMINATED, detail: 'Contaminación confirmada por la guardiana (prueba simulada)' };
  const ui = STATE_UI[status];
  return { label: ui.label, icon: ui.icon, cls: ui.cls, detail: ui.hint };
}

export const WELL_LETTER: Record<string, string> = { 'well-1': 'A', 'well-2': 'B', 'well-3': 'C' };

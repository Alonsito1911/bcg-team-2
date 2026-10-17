// Prototipo de la etapa 3 del brief (anticipación): modelo de riesgo de contaminación
// SIMULADO y explicable para los pozos del pueblo de la demo. Los datos reales de la región
// (prioridad, lluvia, LoRa, E. coli) vienen del repo bcg-team-2 (ver kiryandongo.ts).
import { WELL_IDS, type Knowledge, type WellId, type WellState } from './types';

export interface RegionWell {
  id: string;
  name: string;
  village: string;
  type: 'Pozo abierto' | 'Bomba manual';
  livestockDistanceM: number;
  latrineDistanceM: number;
  incidents12m: number;
  daysSinceVerification: number;
  status: WellState;
  live?: WellId;
}

export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  const ma = a.slice(0, n).reduce((x, y) => x + y, 0) / n;
  const mb = b.slice(0, n).reduce((x, y) => x + y, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/** Coeficientes del modelo logístico simulado (log-odds). Explicables para la ONG. */
export const RISK_MODEL = {
  intercept: -3.1,
  features: [
    { key: 'rain15', label: 'Lluvia en los últimos 15 días (por 10 mm)', coef: 0.55 },
    { key: 'livestock', label: 'Ganado a menos de 50 m', coef: 1.1 },
    { key: 'latrine', label: 'Letrina a menos de 30 m', coef: 0.9 },
    { key: 'open', label: 'Pozo abierto (sin tapa ni bomba)', coef: 0.8 },
    { key: 'history', label: 'Incidentes en 12 meses (por incidente)', coef: 0.35 },
    { key: 'staleness', label: 'Días sin verificación (por semana)', coef: 0.18 },
  ],
} as const;

export interface RiskRow {
  well: RegionWell;
  risk: number;
  level: 'Bajo' | 'Medio' | 'Alto';
  drivers: string[];
  actions: string[];
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export function riskFor(well: RegionWell, rain15Mm: number): RiskRow {
  const x: Record<string, number> = {
    rain15: rain15Mm / 10,
    livestock: well.livestockDistanceM < 50 ? 1 : 0,
    latrine: well.latrineDistanceM < 30 ? 1 : 0,
    open: well.type === 'Pozo abierto' ? 1 : 0,
    history: well.incidents12m,
    staleness: well.daysSinceVerification / 7,
  };
  const contributions = RISK_MODEL.features.map((f) => ({ label: f.label, value: f.coef * x[f.key] }));
  const risk = well.status === 'CONTAMINATED' ? 0.99 : sigmoid(RISK_MODEL.intercept + contributions.reduce((a, c) => a + c.value, 0));
  const level = risk >= 0.6 ? 'Alto' : risk >= 0.3 ? 'Medio' : 'Bajo';
  const drivers = contributions
    .filter((c) => c.value > 0.3)
    .sort((a, b) => b.value - a.value)
    .slice(0, 2)
    .map((c) => c.label.replace(/ \(.*\)$/, ''));
  const actions: string[] = [];
  if (well.status === 'CONTAMINATED') actions.push('Mantener cerrado · cloración de choque y re-prueba');
  else if (level === 'Alto') actions.push('Visita de guardiana en < 48 h', 'Cloración preventiva');
  else if (level === 'Medio') actions.push('Adelantar la visita semanal');
  else actions.push('Rutina semanal');
  if (x.livestock && level !== 'Bajo') actions.push('Cercar y alejar el ganado');
  if (x.open && level !== 'Bajo') actions.push('Tapa / bomba manual');
  if (x.staleness >= 2) actions.push('Verificación vencida');
  return { well, risk, level, drivers, actions };
}

const VILLAGE_WELLS: Record<WellId, Omit<RegionWell, 'status' | 'live'>> = {
  'well-1': { id: 'well-1', name: 'Pozo A', village: 'Pueblo piloto', type: 'Bomba manual', livestockDistanceM: 140, latrineDistanceM: 70, incidents12m: 0, daysSinceVerification: 3 },
  'well-2': { id: 'well-2', name: 'Pozo B', village: 'Pueblo piloto', type: 'Pozo abierto', livestockDistanceM: 30, latrineDistanceM: 55, incidents12m: 2, daysSinceVerification: 8 },
  'well-3': { id: 'well-3', name: 'Pozo C', village: 'Pueblo piloto', type: 'Pozo abierto', livestockDistanceM: 60, latrineDistanceM: 22, incidents12m: 1, daysSinceVerification: 8 },
};

/** Pozos A/B/C según lo que la ONG SABE (nube), con atributos simulados para el modelo de riesgo. */
export function villageWells(cloud: Record<WellId, Knowledge>): RegionWell[] {
  return WELL_IDS.map((id) => ({ ...VILLAGE_WELLS[id], status: cloud[id].status, live: id }));
}

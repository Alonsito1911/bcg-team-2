// Datos REALES del equipo bcg-team-2 (Kiryandongo, Uganda), exportados por
// scripts/export_bcg_team2.py. Aquí solo se tipan y se proyectan; la lógica del
// modelo de prioridad y del escenario LoRa vive en el repo del equipo.
import raw from '../data/kiryandongo.json';

export type Nivel = 'Crítico' | 'Alto' | 'Revisar' | 'Bien';

export interface Bomba {
  ranking: number;
  lat: number;
  lon: number;
  nivel: Nivel;
  motivo: string;
  afectadas: number;
  servidas: number;
  presion: number;
  subcondado: string;
  puntaje: number;
  factorSeco: number;
  fecha: string;
}

export interface CeldaLluvia {
  lat: number;
  lon: number;
  mensual: number[];
  anual: Record<string, number>;
  seca: number;
  factor: number;
}

export interface Sitio {
  lat: number;
  lon: number;
  tipo?: string;
  criticas?: number;
  personas?: number;
}

type Raw = {
  fuente: string;
  umbrales: Record<string, number | number[]>;
  niveles: Record<Nivel, { bombas: number; personas: number }>;
  bombas: [number, number, number, Nivel, string, number, number, number, string, number, number, string][];
  lluvia: CeldaLluvia[];
  lora: { torres: Sitio[]; nuevos: Sitio[]; resumen: { radio_km: number; bombas_cubiertas: number; criticas_total: number; criticas_con_torres: number; criticas_con_todo: number } };
  limite: [number, number][][];
  asentamiento: [number, number][][];
  ecoli_mes: { mes: number; positivas: number; muestras: number }[];
  ecoli_estado: Record<string, { positivas: number; muestras: number }>;
};

const data = raw as unknown as Raw;

export const FUENTE = data.fuente;
export const UMBRALES = data.umbrales;
export const NIVELES = data.niveles;
export const LORA = data.lora;
export const LLUVIA = data.lluvia;
export const LIMITE = data.limite;
export const ASENTAMIENTO = data.asentamiento;
export const ECOLI_MES = data.ecoli_mes;
export const ECOLI_ESTADO = data.ecoli_estado;

export const BOMBAS: Bomba[] = data.bombas.map(([ranking, lat, lon, nivel, motivo, afectadas, servidas, presion, subcondado, puntaje, factorSeco, fecha]) => ({
  ranking,
  lat,
  lon,
  nivel,
  motivo,
  afectadas,
  servidas,
  presion,
  subcondado,
  puntaje,
  factorSeco,
  fecha,
}));

/** Acción recomendada por nivel (tabla del brief del proyecto, §5.3). */
export const ACCION: Record<Nivel, string> = {
  Crítico: 'Reparar ya',
  Alto: 'Reparar / ampliar',
  Revisar: 'Verificar en terreno',
  Bien: 'Monitoreo normal',
};

/** Ubicación ilustrativa del pueblo de la demo (simulado) junto a Bweyale. */
export const PUEBLO_DEMO = { lat: 1.94, lon: 32.11, nombre: 'Pueblo piloto (simulado)' };

// ---------------------------------------------------------------- proyección lat/lon → SVG

const allPts = LIMITE.flat();
const LON_MIN = Math.min(...allPts.map((p) => p[0]));
const LON_MAX = Math.max(...allPts.map((p) => p[0]));
const LAT_MIN = Math.min(...allPts.map((p) => p[1]));
const LAT_MAX = Math.max(...allPts.map((p) => p[1]));
const KX = Math.cos((((LAT_MIN + LAT_MAX) / 2) * Math.PI) / 180);

export const MAP_W = 100;
export const MAP_H = Math.round(((LAT_MAX - LAT_MIN) / ((LON_MAX - LON_MIN) * KX)) * 100 * 10) / 10;
const PAD = 3;

export function project(lat: number, lon: number): { x: number; y: number } {
  return {
    x: PAD + ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * (MAP_W - 2 * PAD),
    y: PAD + ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * (MAP_H - 2 * PAD),
  };
}

/** Radio en unidades del mapa para `km` kilómetros. */
export function kmToMap(km: number): number {
  const degLon = km / (111.32 * KX);
  return (degLon / (LON_MAX - LON_MIN)) * (MAP_W - 2 * PAD);
}

export function ringPath(rings: [number, number][][]): string {
  return rings
    .map((r) =>
      r
        .map(([lon, lat], i) => {
          const p = project(lat, lon);
          return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
        })
        .join(' ') + ' Z',
    )
    .join(' ');
}

/** Interpolación por vecino ponderado de la lluvia de un mes (o anual) en un punto del mapa. */
export function lluviaEn(x: number, y: number, mes: number | 'anual' | 'seca'): number {
  let num = 0;
  let den = 0;
  for (const c of LLUVIA) {
    const p = project(c.lat, c.lon);
    const d2 = (p.x - x) ** 2 + (p.y - y) ** 2 + 0.5;
    const v = mes === 'anual' ? c.mensual.reduce((a, b) => a + b, 0) : mes === 'seca' ? c.seca : c.mensual[mes - 1];
    const w = 1 / d2 ** 2;
    num += v * w;
    den += w;
  }
  return num / den;
}

/** Lluvia anual promedio del distrito por año (2015–2024). */
export function lluviaAnualDistrito(): { anio: string; mm: number }[] {
  const anios = Object.keys(LLUVIA[0].anual).sort();
  return anios.map((a) => ({ anio: a, mm: Math.round(LLUVIA.reduce((s, c) => s + (c.anual[a] ?? 0), 0) / LLUVIA.length) }));
}

/** Climatología mensual del distrito (promedio de celdas). */
export function lluviaMensualDistrito(): number[] {
  return Array.from({ length: 12 }, (_, m) => Math.round((LLUVIA.reduce((s, c) => s + c.mensual[m], 0) / LLUVIA.length) * 10) / 10);
}

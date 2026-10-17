import type { SimulationState } from './types';

const KEY = 'waterlight-demo-v2';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function serialize(s: SimulationState): string {
  return JSON.stringify(s);
}

export function deserialize(raw: string): SimulationState | null {
  try {
    const parsed = JSON.parse(raw) as SimulationState;
    if (parsed?.version !== 1 || !parsed.wells || !parsed.center || !parsed.phase) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(s: SimulationState, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(KEY, serialize(s));
  } catch {
    // Almacenamiento lleno o bloqueado: la demo sigue funcionando en memoria.
  }
}

/** Recupera la sesión guardada (pausada) para que el operador decida cuándo continuar. */
export function loadState(storage: StorageLike | null = defaultStorage()): SimulationState | null {
  const raw = storage?.getItem(KEY);
  if (!raw) return null;
  const s = deserialize(raw);
  if (!s) return null;
  return { ...s, paused: true, restoredFromStorage: true };
}

export function clearState(storage: StorageLike | null = defaultStorage()): void {
  storage?.removeItem(KEY);
}

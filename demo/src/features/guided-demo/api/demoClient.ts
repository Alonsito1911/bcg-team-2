// Cliente HTTP + SSE de la demo guiada. La comunicación teléfono ↔ servidor ↔ notebook es REAL;
// lo que se simula es la radio LoRa / torre / ONG que se dibuja en pantalla.
import type {
  CreateSessionResponse,
  DemoCommandRequest,
  DemoCommandResponse,
  DemoCommandType,
  DemoError,
  DemoEventRecord,
  DemoSnapshot,
} from '../demoMachine';

export interface DemoSessionState {
  snapshot: DemoSnapshot;
  events: DemoEventRecord[];
}

export type DemoConnectionStatus = 'connecting' | 'live' | 'polling' | 'offline';

/** Error de red (fetch lanzó): el servidor NO confirmó nada. */
export class DemoNetworkError extends Error {
  constructor(message = 'Sin conexión con el servidor de la demo') {
    super(message);
    this.name = 'DemoNetworkError';
  }
}

/** Respuesta HTTP no exitosa en endpoints de lectura / creación. */
export class DemoHttpError extends Error {
  readonly status: number;
  readonly code: DemoError | undefined;
  constructor(status: number, code?: DemoError) {
    super(`Error HTTP ${status}${code ? ` (${code})` : ''}`);
    this.name = 'DemoHttpError';
    this.status = status;
    this.code = code;
  }
}

const BASE = '/api/demo/sessions';
const MAX_NETWORK_RETRIES = 3;
const RETRY_BASE_MS = 200;
const POLL_MS = 1000;
const MAX_BACKOFF_MS = 15000;

const enc = encodeURIComponent;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** UUID del comando (crypto.randomUUID con respaldo si el contexto no es seguro). */
export function newCommandId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `cmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function statusToError(status: number): DemoError {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
    case 403:
      return 'UNAUTHORIZED';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'INVALID_TRANSITION';
    case 429:
      return 'RATE_LIMITED';
    default:
      return 'BAD_REQUEST';
  }
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function isSnapshot(v: unknown): v is DemoSnapshot {
  return !!v && typeof v === 'object' && typeof (v as DemoSnapshot).revision === 'number' && typeof (v as DemoSnapshot).epoch === 'number';
}

function toSessionState(body: unknown): DemoSessionState | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { snapshot?: unknown; events?: unknown };
  if (!isSnapshot(b.snapshot)) return null;
  return { snapshot: b.snapshot, events: Array.isArray(b.events) ? (b.events as DemoEventRecord[]) : [] };
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    throw new DemoNetworkError(err instanceof Error ? err.message : undefined);
  }
}

function postJson(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

/**
 * ¿Se acepta `next` sobre el último snapshot visto?
 * - Epoch mayor (tras un RESET) → siempre se acepta.
 * - Epoch menor → se ignora.
 * - Mismo epoch → se acepta si la revisión no retrocede (igual se acepta: p. ej. heartbeat actualiza controllerSeenAt).
 */
export function shouldAccept(prev: DemoSnapshot | null | undefined, next: DemoSnapshot | null | undefined): boolean {
  if (!next) return false;
  if (!prev) return true;
  if (next.epoch !== prev.epoch) return next.epoch > prev.epoch;
  return next.revision >= prev.revision;
}

export async function createSession(): Promise<CreateSessionResponse> {
  const res = await request(BASE, postJson({}));
  const body = await readJson(res);
  if (!res.ok) throw new DemoHttpError(res.status, (body as { error?: DemoError } | null)?.error ?? statusToError(res.status));
  return body as CreateSessionResponse;
}

export async function getSession(room: string): Promise<DemoSessionState> {
  const res = await request(`${BASE}/${enc(room)}`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  const body = await readJson(res);
  const state = res.ok ? toSessionState(body) : null;
  if (!state) throw new DemoHttpError(res.status, (body as { error?: DemoError } | null)?.error ?? statusToError(res.status));
  return state;
}

/**
 * Envía un comando. Nunca lanza por status HTTP: 409/422/401/404/429 vuelven como `{ok:false, error, snapshot}`.
 * Solo reintenta ante error de red (hasta 3 reintentos) con el MISMO commandId (idempotente en el servidor).
 * Si la red sigue caída tras los reintentos, lanza `DemoNetworkError` (nunca se finge una confirmación).
 */
export async function sendCommand(
  room: string,
  type: DemoCommandType,
  expectedRevision: number,
  token: string,
  commandId: string = newCommandId(),
): Promise<DemoCommandResponse> {
  const payload: DemoCommandRequest = { commandId, type, expectedRevision, token };
  const url = `${BASE}/${enc(room)}/commands`;
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= MAX_NETWORK_RETRIES; attempt++) {
    if (attempt > 0) await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
    let res: Response;
    try {
      res = await fetch(url, postJson(payload));
    } catch (err) {
      lastError = err;
      continue;
    }
    const body = (await readJson(res)) as Partial<DemoCommandResponse> | null;
    const snapshot = body && isSnapshot(body.snapshot) ? body.snapshot : null;
    if (res.ok) {
      return {
        ok: body?.ok ?? true,
        snapshot,
        ...(body?.error ? { error: body.error } : {}),
        ...(body?.duplicate ? { duplicate: true } : {}),
      };
    }
    return { ok: false, snapshot, error: body?.error ?? statusToError(res.status) };
  }
  throw new DemoNetworkError(lastError instanceof Error ? lastError.message : undefined);
}

export async function heartbeat(room: string, token: string): Promise<DemoSnapshot | null> {
  const res = await request(`${BASE}/${enc(room)}/heartbeat`, postJson({ token }));
  const body = (await readJson(res)) as { snapshot?: unknown } | null;
  if (!res.ok) throw new DemoHttpError(res.status, (body as { error?: DemoError } | null)?.error ?? statusToError(res.status));
  return body && isSnapshot(body.snapshot) ? body.snapshot : null;
}

/**
 * Suscripción en vivo: SSE (`event: snapshot`) con respaldo de polling cada 1 s mientras el stream está caído.
 * Reintenta el SSE con backoff exponencial y al reconectar hace un refetch. Devuelve la función de cancelación.
 */
export function subscribe(
  room: string,
  onUpdate: (state: DemoSessionState) => void,
  onStatus: (status: DemoConnectionStatus) => void,
  onError?: (err: Error) => void,
): () => void {
  let closed = false;
  let last: DemoSnapshot | null = null;
  let es: EventSource | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let live = false;
  let status: DemoConnectionStatus | null = null;

  const setStatus = (s: DemoConnectionStatus) => {
    if (closed || s === status) return;
    status = s;
    onStatus(s);
  };

  const deliver = (state: DemoSessionState | null) => {
    if (closed || !state) return;
    if (!shouldAccept(last, state.snapshot)) return;
    last = state.snapshot;
    onUpdate(state);
  };

  const refetch = async (fromPolling: boolean) => {
    try {
      const state = await getSession(room);
      deliver(state);
      if (fromPolling && !live) setStatus('polling');
    } catch (err) {
      if (!live) setStatus('offline');
      if (err instanceof Error) onError?.(err);
    }
  };

  const startPolling = () => {
    if (pollTimer || closed) return;
    pollTimer = setInterval(() => void refetch(true), POLL_MS);
  };

  const stopPolling = () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  };

  const connect = () => {
    if (closed) return;
    if (typeof EventSource === 'undefined') {
      startPolling();
      void refetch(true);
      return;
    }
    const isReconnect = attempt > 0;
    es = new EventSource(`${BASE}/${enc(room)}/stream`);
    es.addEventListener('snapshot', (ev) => {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse((ev as MessageEvent<string>).data);
      } catch {
        return;
      }
      live = true;
      attempt = 0;
      stopPolling();
      setStatus('live');
      deliver(toSessionState(parsed));
    });
    es.onopen = () => {
      if (isReconnect) void refetch(false);
    };
    es.onerror = () => {
      if (closed) return;
      es?.close();
      es = null;
      live = false;
      setStatus(last ? 'polling' : 'connecting');
      startPolling();
      void refetch(true);
      const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
      attempt++;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, delay);
    };
  };

  setStatus('connecting');
  void refetch(false);
  connect();

  return () => {
    closed = true;
    stopPolling();
    if (reconnectTimer) clearTimeout(reconnectTimer);
    es?.close();
    es = null;
  };
}

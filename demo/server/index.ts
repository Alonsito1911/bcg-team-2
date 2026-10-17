// Backend real de la demo guiada: API JSON + SSE + estáticos de dist/.
// Ejecutar: node --experimental-strip-types --no-warnings server/index.ts
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DemoStore, isCommandType } from './store.ts';

const DEMO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT ?? 8787);
const DB_PATH = resolve(DEMO_ROOT, process.env.DEMO_DB ?? 'server/data/demo.db');
const DIST_DIR = resolve(DEMO_ROOT, 'dist');
const RATE_LIMIT = Number(process.env.DEMO_RATE_LIMIT ?? 20);
const RATE_WINDOW_MS = 10_000;
const PING_MS = 15_000;
const MAX_BODY = 16 * 1024;

const store = new DemoStore(DB_PATH);

// ---- Suscriptores SSE por sala ----
const subscribers = new Map<string, Set<ServerResponse>>();

function ssePayload(room: string): string | null {
  const state = store.getPublicState(room);
  return state ? `event: snapshot\ndata: ${JSON.stringify(state)}\n\n` : null;
}

function notify(room: string): void {
  const subs = subscribers.get(room);
  if (!subs || subs.size === 0) return;
  const payload = ssePayload(room);
  if (!payload) return;
  for (const res of subs) res.write(payload);
}

// ---- Rate limit (ventana deslizante en memoria, por sala) ----
const rateLog = new Map<string, number[]>();
function rateLimited(room: string): boolean {
  const now = Date.now();
  const recent = (rateLog.get(room) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    rateLog.set(room, recent);
    return true;
  }
  recent.push(now);
  rateLog.set(room, recent);
  return false;
}

// ---- Utilidades HTTP ----
function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}

class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, 'BAD_REQUEST');
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    /* cae al error de abajo */
  }
  throw new HttpError(400, 'BAD_REQUEST');
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

function serveStatic(req: IncomingMessage, res: ServerResponse, pathname: string): void {
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  const indexFile = join(DIST_DIR, 'index.html');
  if (!existsSync(indexFile)) return sendJson(res, 404, { error: 'NOT_FOUND', hint: 'Ejecuta npm run build para generar dist/' });
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return sendJson(res, 400, { error: 'BAD_REQUEST' });
  }
  let file = normalize(join(DIST_DIR, decoded));
  if (file !== DIST_DIR && !file.startsWith(DIST_DIR + sep)) return sendJson(res, 404, { error: 'NOT_FOUND' });
  if (!existsSync(file) || !statSync(file).isFile()) file = indexFile; // fallback SPA
  const body = readFileSync(file);
  const isHtml = file.endsWith('.html');
  res.writeHead(200, {
    'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': isHtml ? 'no-cache' : file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}

function openStream(req: IncomingMessage, res: ServerResponse, room: string): void {
  const payload = ssePayload(room);
  if (!payload) return sendJson(res, 404, { error: 'NOT_FOUND' });
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 2000\n\n');
  res.write(payload);
  let subs = subscribers.get(room);
  if (!subs) subscribers.set(room, (subs = new Set()));
  subs.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), PING_MS);
  const cleanup = (): void => {
    clearInterval(ping);
    const set = subscribers.get(room);
    if (set) {
      set.delete(res);
      if (set.size === 0) subscribers.delete(room);
    }
  };
  req.on('close', cleanup);
  res.on('close', cleanup);
}

async function handleCommand(req: IncomingMessage, res: ServerResponse, room: string): Promise<void> {
  const body = await readJson(req).catch((e: unknown) => {
    if (e instanceof HttpError) return null;
    throw e;
  });
  if (!store.getSnapshot(room)) return sendJson(res, 404, { ok: false, error: 'NOT_FOUND', snapshot: null });
  const auth = store.checkToken(room, body?.token);
  if (auth === 'UNAUTHORIZED') return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED', snapshot: null });
  const commandId = body?.commandId;
  const type = body?.type;
  if (!body || typeof commandId !== 'string' || commandId.length === 0 || commandId.length > 200 || !isCommandType(type)) {
    return sendJson(res, 400, { ok: false, error: 'BAD_REQUEST', snapshot: null });
  }
  // Reintento idempotente: no consume cupo de rate limit.
  const prior = store.findCommand(room, commandId);
  if (prior && prior !== 'OTHER_ROOM') return sendJson(res, 200, { ...prior, duplicate: true });
  if (rateLimited(room)) {
    return sendJson(res, 429, { ok: false, error: 'RATE_LIMITED', snapshot: store.getSnapshot(room) });
  }
  const result = store.applyCommand(room, commandId, type, body.expectedRevision);
  sendJson(res, result.status, result.body);
  if (result.changed) notify(room);
}

async function handleHeartbeat(req: IncomingMessage, res: ServerResponse, room: string): Promise<void> {
  const body = await readJson(req).catch(() => null);
  const auth = store.checkToken(room, body?.token);
  if (auth === 'NOT_FOUND') return sendJson(res, 404, { error: 'NOT_FOUND' });
  if (auth === 'UNAUTHORIZED') return sendJson(res, 401, { error: 'UNAUTHORIZED' });
  const snapshot = store.heartbeat(room);
  sendJson(res, 200, { snapshot });
  notify(room);
}

const ROOM_RE = /^\/api\/demo\/sessions\/([A-Za-z0-9-]{1,32})(\/(commands|heartbeat|stream))?\/?$/;

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;
  const method = req.method ?? 'GET';

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      Allow: 'GET, POST, OPTIONS',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return void res.end();
  }

  if (path !== '/api' && !path.startsWith('/api/')) return serveStatic(req, res, path);

  if (path === '/api/health') return sendJson(res, 200, { ok: true });

  if (path === '/api/demo/sessions' || path === '/api/demo/sessions/') {
    if (method !== 'POST') return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    return sendJson(res, 201, store.createSession());
  }

  const m = ROOM_RE.exec(path);
  if (m) {
    const room = m[1].toUpperCase();
    const action = m[3];
    if (!action) {
      if (method !== 'GET') return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
      const state = store.getPublicState(room);
      return state ? sendJson(res, 200, state) : sendJson(res, 404, { error: 'NOT_FOUND' });
    }
    if (action === 'stream') {
      if (method !== 'GET') return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
      return openStream(req, res, room);
    }
    if (method !== 'POST') return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    if (action === 'commands') return handleCommand(req, res, room);
    return handleHeartbeat(req, res, room);
  }

  return sendJson(res, 404, { error: 'NOT_FOUND' });
}

const server = createServer((req, res) => {
  handle(req, res).catch((err: unknown) => {
    console.error('[demo-server] error', err);
    if (!res.headersSent) sendJson(res, 500, { error: 'INTERNAL' });
    else res.end();
  });
});

const purgeTimer = setInterval(() => store.purgeExpired(), 10 * 60 * 1000);
purgeTimer.unref();
store.purgeExpired();

server.listen(PORT, () => {
  console.log(`[demo-server] http://localhost:${PORT}  db=${DB_PATH}  dist=${existsSync(DIST_DIR) ? DIST_DIR : '(sin build)'}`);
});

function shutdown(): void {
  for (const subs of subscribers.values()) for (const res of subs) res.end();
  server.close(() => {
    store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 1000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

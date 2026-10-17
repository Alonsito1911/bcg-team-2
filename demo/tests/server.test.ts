// Tests de integración del backend real (server/index.ts) como proceso hijo.
/// <reference types="node" />
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  REPORT_STEP,
  type CreateSessionResponse,
  type DemoCommandResponse,
  type DemoCommandType,
  type DemoEventRecord,
  type DemoSnapshot,
} from '../src/features/guided-demo/demoMachine';

const DEMO_DIR = resolve(__dirname, '..');
const tmp = mkdtempSync(join(tmpdir(), 'wl-demo-server-'));
const DB = join(tmp, 'demo.db');
let port = 0;
let child: ChildProcess | null = null;
const base = (): string => `http://127.0.0.1:${port}`;

function freePort(): Promise<number> {
  return new Promise((ok, fail) => {
    const s = createServer();
    s.unref();
    s.on('error', fail);
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address();
      const p = typeof addr === 'object' && addr ? addr.port : 0;
      s.close(() => ok(p));
    });
  });
}

async function startServer(): Promise<void> {
  child = spawn(process.execPath, ['--experimental-strip-types', '--no-warnings', 'server/index.ts'], {
    cwd: DEMO_DIR,
    env: { ...process.env, PORT: String(port), DEMO_DB: DB },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr?.on('data', (d: Buffer) => (stderr += d.toString()));
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${base()}/api/health`);
      if (r.ok) return;
    } catch {
      /* aún no escucha */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`El servidor no arrancó: ${stderr}`);
}

async function stopServer(): Promise<void> {
  const c = child;
  child = null;
  if (!c || c.exitCode !== null) return;
  await new Promise<void>((ok) => {
    c.once('exit', () => ok());
    c.kill('SIGTERM');
    setTimeout(() => c.kill('SIGKILL'), 3000).unref();
  });
}

async function createSession(): Promise<CreateSessionResponse> {
  const r = await fetch(`${base()}/api/demo/sessions`, { method: 'POST' });
  expect(r.status).toBe(201);
  return (await r.json()) as CreateSessionResponse;
}

async function getState(room: string): Promise<{ status: number; body: { snapshot: DemoSnapshot; events: DemoEventRecord[] } }> {
  const r = await fetch(`${base()}/api/demo/sessions/${room}`);
  return { status: r.status, body: await r.json() };
}

async function command(
  s: CreateSessionResponse,
  type: DemoCommandType,
  expectedRevision: number,
  opts: { commandId?: string; token?: string } = {},
): Promise<{ status: number; body: DemoCommandResponse }> {
  const r = await fetch(`${base()}/api/demo/sessions/${s.room}/commands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commandId: opts.commandId ?? randomUUID(), type, expectedRevision, token: opts.token ?? s.controllerToken }),
  });
  return { status: r.status, body: (await r.json()) as DemoCommandResponse };
}

/** Avanza con NEXT hasta REPORT_STEP; devuelve el último snapshot. */
async function advanceToReport(s: CreateSessionResponse): Promise<DemoSnapshot> {
  let snap = s.snapshot;
  while (snap.step < REPORT_STEP) {
    const r = await command(s, 'NEXT', snap.revision);
    expect(r.status).toBe(200);
    snap = r.body.snapshot!;
  }
  return snap;
}

beforeAll(async () => {
  port = await freePort();
  await startServer();
}, 20_000);

afterAll(async () => {
  await stopServer();
  rmSync(tmp, { recursive: true, force: true });
});

describe('backend de la demo guiada', () => {
  it('health y creación de sesión', async () => {
    const s = await createSession();
    expect(s.room).toMatch(/^WL-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
    expect(Buffer.from(s.controllerToken, 'base64url')).toHaveLength(24);
    expect(s.snapshot).toMatchObject({ room: s.room, epoch: 1, step: 0, revision: 0, reported: false });
    const g = await getState(s.room);
    expect(g.status).toBe(200);
    expect(g.body.events).toEqual([]);
    expect(JSON.stringify(g.body)).not.toContain(s.controllerToken);
    expect((await getState('WL-ZZZZ')).status).toBe(404);
  });

  it('avanza hasta el reporte, exige el reporte y crea exactamente 1 evento idempotente', async () => {
    const s = await createSession();
    let snap = await advanceToReport(s);
    expect(snap.step).toBe(REPORT_STEP);

    const blocked = await command(s, 'NEXT', snap.revision);
    expect(blocked.status).toBe(422);
    expect(blocked.body).toMatchObject({ ok: false, error: 'INVALID_TRANSITION' });
    expect(blocked.body.snapshot?.step).toBe(REPORT_STEP);

    const commandId = randomUUID();
    const rep = await command(s, 'REPORT_CONTAMINATION', snap.revision, { commandId });
    expect(rep.status).toBe(200);
    expect(rep.body.ok).toBe(true);
    snap = rep.body.snapshot!;
    expect(snap).toMatchObject({ reported: true, step: REPORT_STEP + 1 });
    let g = await getState(s.room);
    expect(g.body.events).toHaveLength(1);
    expect(g.body.events[0]).toMatchObject({ id: snap.reportEventId, type: 'CONTAMINATION_REPORT_ACCEPTED', wellId: 'well-2', epoch: 1 });

    // Avanza para cambiar la revisión; el reintento debe seguir siendo idempotente.
    const nx = await command(s, 'NEXT', snap.revision);
    expect(nx.status).toBe(200);
    const retry = await command(s, 'REPORT_CONTAMINATION', 0, { commandId });
    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({ ok: true, duplicate: true });
    expect(retry.body.snapshot).toEqual(snap);
    g = await getState(s.room);
    expect(g.body.events).toHaveLength(1);
  });

  it('dos REPORT concurrentes: solo uno gana y hay 1 evento', async () => {
    const s = await createSession();
    const snap = await advanceToReport(s);
    const [a, b] = await Promise.all([
      command(s, 'REPORT_CONTAMINATION', snap.revision),
      command(s, 'REPORT_CONTAMINATION', snap.revision),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses[0]).toBe(200);
    expect([409, 422]).toContain(statuses[1]);
    expect([a.body.ok, b.body.ok].filter(Boolean)).toHaveLength(1);
    expect((await getState(s.room)).body.events).toHaveLength(1);
  });

  it('token inválido → 401, revisión vieja → 409 con snapshot actual, body inválido → 400', async () => {
    const s = await createSession();
    const bad = await command(s, 'NEXT', 0, { token: 'x'.repeat(32) });
    expect(bad.status).toBe(401);
    expect(bad.body.error).toBe('UNAUTHORIZED');

    const ok = await command(s, 'NEXT', 0);
    expect(ok.status).toBe(200);
    const stale = await command(s, 'NEXT', 0);
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ ok: false, error: 'CONFLICT' });
    expect(stale.body.snapshot).toEqual(ok.body.snapshot);

    const r = await fetch(`${base()}/api/demo/sessions/${s.room}/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: s.controllerToken, expectedRevision: 1 }),
    });
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ error: 'BAD_REQUEST' });
  });

  it('PREV tras el reporte conserva el evento; RESET sube epoch y vacía eventos', async () => {
    const s = await createSession();
    let snap = await advanceToReport(s);
    snap = (await command(s, 'REPORT_CONTAMINATION', snap.revision)).body.snapshot!;
    const prev = await command(s, 'PREV', snap.revision);
    expect(prev.status).toBe(200);
    snap = prev.body.snapshot!;
    expect(snap.step).toBe(REPORT_STEP);
    expect(snap.reported).toBe(true);
    expect((await getState(s.room)).body.events).toHaveLength(1);

    const reset = await command(s, 'RESET', snap.revision);
    expect(reset.status).toBe(200);
    expect(reset.body.snapshot).toMatchObject({ epoch: 2, step: 0, reported: false, reportEventId: null });
    const g = await getState(s.room);
    expect(g.body.snapshot.epoch).toBe(2);
    expect(g.body.events).toEqual([]);
  });

  it('heartbeat actualiza controllerSeenAt sin subir revision', async () => {
    const s = await createSession();
    const bad = await fetch(`${base()}/api/demo/sessions/${s.room}/heartbeat`, {
      method: 'POST',
      body: JSON.stringify({ token: 'nope' }),
    });
    expect(bad.status).toBe(401);
    const r = await fetch(`${base()}/api/demo/sessions/${s.room}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: s.controllerToken }),
    });
    expect(r.status).toBe(200);
    const { snapshot } = (await r.json()) as { snapshot: DemoSnapshot };
    expect(snapshot.controllerSeenAt).not.toBeNull();
    expect(snapshot.revision).toBe(0);
  });

  it('SSE envía snapshot inicial y otro tras un comando', async () => {
    const s = await createSession();
    const ctrl = new AbortController();
    const res = await fetch(`${base()}/api/demo/sessions/${s.room}/stream`, { signal: ctrl.signal });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    const nextSnapshot = async (): Promise<{ snapshot: DemoSnapshot; events: DemoEventRecord[] }> => {
      for (;;) {
        const sep = buf.indexOf('\n\n');
        if (sep >= 0) {
          const block = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          const lines = block.split('\n');
          if (lines.includes('event: snapshot')) {
            const data = lines.filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join('\n');
            expect(data).not.toContain(s.controllerToken);
            return JSON.parse(data);
          }
          continue;
        }
        const { value, done } = await reader.read();
        if (done) throw new Error('stream cerrado');
        buf += decoder.decode(value, { stream: true });
      }
    };
    const first = await nextSnapshot();
    expect(first.snapshot.revision).toBe(0);
    expect(first.events).toEqual([]);
    await command(s, 'NEXT', 0);
    const second = await nextSnapshot();
    expect(second.snapshot).toMatchObject({ revision: 1, step: 1 });
    ctrl.abort();
    await reader.cancel().catch(() => undefined);
  });

  it('rate limit: más de 20 comandos en 10 s → 429', async () => {
    const s = await createSession();
    const statuses: number[] = [];
    for (let i = 0; i < 22; i++) statuses.push((await command(s, 'RESET', 999)).status);
    expect(statuses.slice(0, 20).every((st) => st === 409)).toBe(true);
    expect(statuses[20]).toBe(429);
  });

  it('reiniciar el proceso conserva sesión, snapshot, eventos e idempotencia', async () => {
    const s = await createSession();
    let snap = await advanceToReport(s);
    const commandId = randomUUID();
    snap = (await command(s, 'REPORT_CONTAMINATION', snap.revision, { commandId })).body.snapshot!;

    await stopServer();
    await startServer();

    const g = await getState(s.room);
    expect(g.status).toBe(200);
    expect(g.body.snapshot).toEqual(snap);
    expect(g.body.events).toHaveLength(1);
    const retry = await command(s, 'REPORT_CONTAMINATION', snap.revision, { commandId });
    expect(retry.body).toMatchObject({ ok: true, duplicate: true });
    const next = await command(s, 'NEXT', snap.revision);
    expect(next.status).toBe(200);
  }, 20_000);
});

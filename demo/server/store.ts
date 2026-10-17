// Persistencia SQLite (node:sqlite) de la demo guiada.
// Todas las escrituras de comandos ocurren en UNA transacción BEGIN IMMEDIATE.
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  applyDemoCommand,
  initialSnapshot,
  type CreateSessionResponse,
  type DemoCommandResponse,
  type DemoCommandType,
  type DemoEventRecord,
  type DemoSnapshot,
} from '../src/features/guided-demo/demoMachine.ts';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const COMMAND_TYPES: readonly DemoCommandType[] = ['NEXT', 'PREV', 'REPORT_CONTAMINATION', 'RESET'];

export interface CommandResult {
  status: number;
  body: DemoCommandResponse | { error: string };
  /** true si el snapshot cambió y hay que notificar a los suscriptores. */
  changed: boolean;
}

interface SessionRow {
  room: string;
  snapshot: string;
  controller_token: string;
  expires_at: string;
}

export function isCommandType(v: unknown): v is DemoCommandType {
  return typeof v === 'string' && (COMMAND_TYPES as readonly string[]).includes(v);
}

function tokenMatches(expected: string, given: unknown): boolean {
  if (typeof given !== 'string') return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(given, 'utf8');
  if (a.length !== b.length) {
    // Comparación de longitud constante igualmente, para no filtrar timing obvio.
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

export class DemoStore {
  db: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS sessions (
        room TEXT PRIMARY KEY,
        snapshot TEXT NOT NULL,
        controller_token TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS commands (
        command_id TEXT PRIMARY KEY,
        room TEXT NOT NULL,
        response TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        room TEXT NOT NULL,
        epoch INTEGER NOT NULL,
        record TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS events_room_epoch ON events(room, epoch);
      CREATE INDEX IF NOT EXISTS commands_room ON commands(room);
    `);
  }

  close(): void {
    this.db.close();
  }

  private getRow(room: string): SessionRow | null {
    const row = this.db
      .prepare('SELECT room, snapshot, controller_token, expires_at FROM sessions WHERE room = ?')
      .get(room) as SessionRow | undefined;
    if (!row) return null;
    if (Date.parse(row.expires_at) <= Date.now()) return null;
    return row;
  }

  createSession(): CreateSessionResponse {
    const now = new Date();
    const nowIso = now.toISOString();
    const expires = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
    const insert = this.db.prepare(
      'INSERT INTO sessions (room, snapshot, controller_token, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
    );
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = '';
      for (let i = 0; i < 4; i++) code += ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)];
      const room = `WL-${code}`;
      const existing = this.db.prepare('SELECT expires_at FROM sessions WHERE room = ?').get(room) as
        | { expires_at: string }
        | undefined;
      if (existing) {
        if (Date.parse(existing.expires_at) > Date.now()) continue;
        this.deleteRoom(room); // sala vencida: se recicla el código
      }
      const controllerToken = randomBytes(24).toString('base64url');
      const snapshot = initialSnapshot(room, nowIso);
      insert.run(room, JSON.stringify(snapshot), controllerToken, nowIso, expires);
      return { room, controllerToken, snapshot };
    }
    throw new Error('No se pudo generar un código de sala único');
  }

  private deleteRoom(room: string): void {
    this.db.prepare('DELETE FROM sessions WHERE room = ?').run(room);
    this.db.prepare('DELETE FROM commands WHERE room = ?').run(room);
    this.db.prepare('DELETE FROM events WHERE room = ?').run(room);
  }

  purgeExpired(): void {
    const nowIso = new Date().toISOString();
    const rows = this.db.prepare('SELECT room FROM sessions WHERE expires_at <= ?').all(nowIso) as { room: string }[];
    for (const r of rows) this.deleteRoom(r.room);
  }

  getSnapshot(room: string): DemoSnapshot | null {
    const row = this.getRow(room);
    return row ? (JSON.parse(row.snapshot) as DemoSnapshot) : null;
  }

  getEvents(room: string, epoch: number): DemoEventRecord[] {
    const rows = this.db
      .prepare('SELECT record FROM events WHERE room = ? AND epoch = ? ORDER BY created_at, rowid')
      .all(room, epoch) as { record: string }[];
    return rows.map((r) => JSON.parse(r.record) as DemoEventRecord);
  }

  /** Vista pública (sin token): snapshot + eventos del epoch actual. */
  getPublicState(room: string): { snapshot: DemoSnapshot; events: DemoEventRecord[] } | null {
    const snapshot = this.getSnapshot(room);
    if (!snapshot) return null;
    return { snapshot, events: this.getEvents(room, snapshot.epoch) };
  }

  /** Sala actualizada más recientemente (la vista inicial de la app muestra su estado). */
  latestRoom(): string | null {
    const rows = this.db.prepare('SELECT room, snapshot FROM sessions').all() as { room: string; snapshot: string }[];
    let best: { room: string; at: string } | null = null;
    for (const r of rows) {
      const at = (JSON.parse(r.snapshot) as DemoSnapshot).updatedAt;
      if (!best || at > best.at) best = { room: r.room, at };
    }
    return best?.room ?? null;
  }

  checkToken(room: string, token: unknown): 'NOT_FOUND' | 'UNAUTHORIZED' | 'OK' {
    const row = this.getRow(room);
    if (!row) return 'NOT_FOUND';
    return tokenMatches(row.controller_token, token) ? 'OK' : 'UNAUTHORIZED';
  }

  heartbeat(room: string): DemoSnapshot | null {
    const row = this.getRow(room);
    if (!row) return null;
    const snapshot = { ...(JSON.parse(row.snapshot) as DemoSnapshot), controllerSeenAt: new Date().toISOString() };
    this.db.prepare('UPDATE sessions SET snapshot = ? WHERE room = ?').run(JSON.stringify(snapshot), room);
    return snapshot;
  }

  /** Respuesta guardada de un commandId; 'OTHER_ROOM' si ese id ya se usó en otra sala. */
  findCommand(room: string, commandId: string): DemoCommandResponse | 'OTHER_ROOM' | null {
    const row = this.db.prepare('SELECT room, response FROM commands WHERE command_id = ?').get(commandId) as
      | { room: string; response: string }
      | undefined;
    if (!row) return null;
    if (row.room !== room) return 'OTHER_ROOM';
    return JSON.parse(row.response) as DemoCommandResponse;
  }

  /**
   * Aplica un comando ya autenticado y validado en forma. Lectura del snapshot,
   * chequeo de idempotencia/revisión y escritura ocurren dentro de BEGIN IMMEDIATE.
   */
  applyCommand(room: string, commandId: string, type: DemoCommandType, expectedRevision: unknown): CommandResult {
    const db = this.db;
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.getRow(room);
      if (!row) {
        db.exec('ROLLBACK');
        return { status: 404, body: { error: 'NOT_FOUND' }, changed: false };
      }
      const prior = this.findCommand(room, commandId);
      if (prior === 'OTHER_ROOM') {
        db.exec('ROLLBACK');
        return { status: 400, body: { ok: false, error: 'BAD_REQUEST', snapshot: null }, changed: false };
      }
      if (prior) {
        db.exec('ROLLBACK');
        return { status: 200, body: { ...prior, duplicate: true }, changed: false };
      }
      const current = JSON.parse(row.snapshot) as DemoSnapshot;
      if (expectedRevision !== current.revision) {
        db.exec('ROLLBACK');
        return { status: 409, body: { ok: false, error: 'CONFLICT', snapshot: current }, changed: false };
      }
      const now = new Date().toISOString();
      const result = applyDemoCommand(current, type, now, randomUUID());
      if (!result) {
        db.exec('ROLLBACK');
        return { status: 422, body: { ok: false, error: 'INVALID_TRANSITION', snapshot: current }, changed: false };
      }
      const response: DemoCommandResponse = { ok: true, snapshot: result.snapshot };
      db.prepare('UPDATE sessions SET snapshot = ? WHERE room = ?').run(JSON.stringify(result.snapshot), room);
      db.prepare('INSERT INTO commands (command_id, room, response, created_at) VALUES (?, ?, ?, ?)').run(
        commandId,
        room,
        JSON.stringify(response),
        now,
      );
      if (result.event) {
        db.prepare('INSERT INTO events (id, room, epoch, record, created_at) VALUES (?, ?, ?, ?, ?)').run(
          result.event.id,
          room,
          result.event.epoch,
          JSON.stringify(result.event),
          now,
        );
      }
      db.exec('COMMIT');
      return { status: 200, body: response, changed: true };
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        /* ya no había transacción abierta */
      }
      throw err;
    }
  }
}

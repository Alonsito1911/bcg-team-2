import { afterEach, describe, expect, it, vi } from 'vitest';
import { DemoNetworkError, sendCommand, shouldAccept } from '../src/features/guided-demo/api/demoClient';
import { initialSnapshot, type DemoSnapshot } from '../src/features/guided-demo/demoMachine';

const snap = (over: Partial<DemoSnapshot> = {}): DemoSnapshot => ({ ...initialSnapshot('ABCD', '2026-01-01T00:00:00.000Z'), ...over });

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('shouldAccept', () => {
  it('acepta el primer snapshot', () => {
    expect(shouldAccept(null, snap())).toBe(true);
  });
  it('rechaza next nulo', () => {
    expect(shouldAccept(snap(), null)).toBe(false);
  });
  it('mismo epoch: acepta revisión mayor o igual, ignora menor', () => {
    expect(shouldAccept(snap({ revision: 3 }), snap({ revision: 4 }))).toBe(true);
    expect(shouldAccept(snap({ revision: 3 }), snap({ revision: 3 }))).toBe(true);
    expect(shouldAccept(snap({ revision: 3 }), snap({ revision: 2 }))).toBe(false);
  });
  it('epoch mayor se acepta aunque la revisión sea menor; epoch menor se ignora', () => {
    expect(shouldAccept(snap({ epoch: 1, revision: 9 }), snap({ epoch: 2, revision: 0 }))).toBe(true);
    expect(shouldAccept(snap({ epoch: 2, revision: 0 }), snap({ epoch: 1, revision: 9 }))).toBe(false);
  });
});

describe('sendCommand', () => {
  it('reintenta ante error de red reutilizando el mismo commandId', async () => {
    vi.useFakeTimers();
    const bodies: Array<{ commandId: string }> = [];
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      if (bodies.length < 3) throw new TypeError('Failed to fetch');
      return jsonResponse(200, { ok: true, snapshot: snap({ step: 1, revision: 1 }) });
    });
    vi.stubGlobal('fetch', fetchMock);
    const p = sendCommand('ABCD', 'NEXT', 0, 'tok');
    await vi.runAllTimersAsync();
    const res = await p;
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(new Set(bodies.map((b) => b.commandId)).size).toBe(1);
    expect(bodies[0]).toMatchObject({ type: 'NEXT', expectedRevision: 0, token: 'tok' });
    expect(res.ok).toBe(true);
    expect(res.snapshot?.step).toBe(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/demo/sessions/ABCD/commands');
  });

  it('usa el commandId recibido y lanza DemoNetworkError si la red sigue caída', async () => {
    vi.useFakeTimers();
    const ids: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        ids.push(JSON.parse(String(init?.body)).commandId);
        throw new TypeError('Failed to fetch');
      }),
    );
    const p = sendCommand('ABCD', 'REPORT_CONTAMINATION', 3, 'tok', 'fixed-id');
    const assertion = expect(p).rejects.toBeInstanceOf(DemoNetworkError);
    await vi.runAllTimersAsync();
    await assertion;
    expect(ids).toEqual(['fixed-id', 'fixed-id', 'fixed-id', 'fixed-id']);
  });

  it('409 devuelve ok:false con el snapshot actual sin reintentar ni lanzar', async () => {
    const current = snap({ step: 2, revision: 5 });
    const fetchMock = vi.fn(async () => jsonResponse(409, { ok: false, error: 'CONFLICT', snapshot: current }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await sendCommand('ABCD', 'NEXT', 4, 'tok');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ ok: false, error: 'CONFLICT', snapshot: current });
  });

  it('422 sin cuerpo JSON se mapea a INVALID_TRANSITION', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 422 })));
    const res = await sendCommand('ABCD', 'NEXT', 0, 'tok');
    expect(res).toEqual({ ok: false, error: 'INVALID_TRANSITION', snapshot: null });
  });

  it('200 duplicate se marca como duplicado y ok', async () => {
    const s = snap({ step: 4, revision: 4, reported: true });
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, { ok: true, duplicate: true, snapshot: s })));
    const res = await sendCommand('ABCD', 'REPORT_CONTAMINATION', 3, 'tok', 'same-id');
    expect(res).toEqual({ ok: true, duplicate: true, snapshot: s });
  });
});

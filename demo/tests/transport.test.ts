import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/domain/engine';
import { deserialize, loadState, saveState, serialize } from '../src/domain/persistence';
import { deriveLocal } from '../src/domain/state';
import { diagnoseLink, pendingFor } from '../src/domain/transport';
import { act, fresh, logText, run, runUntil } from './helpers';

const isolateWell2 = [
  { type: 'SET_LINK', target: { kind: 'lora', wellId: 'well-2' }, on: false },
  { type: 'SET_LINK', target: { kind: 'mesh', a: 'well-1', b: 'well-2' }, on: false },
  { type: 'SET_LINK', target: { kind: 'mesh', a: 'well-2', b: 'well-3' }, on: false },
] as const;

describe('store-and-forward', () => {
  it('8. sin LoRa: el centro no cambia, el evento queda en cola y el pozo muestra su estado local', () => {
    let s = act(fresh(), ...isolateWell2, { type: 'QUICK_PRESET', wellId: 'well-2', preset: 'CONFIRMED_POSITIVE' });
    s = run(s, 8000);
    expect(deriveLocal(s, 'well-2').primary).toBe('CONTAMINATED');
    expect(s.center['well-2'].status).toBe('ENABLED');
    expect(pendingFor(s, 'well-2').length).toBe(1);
    expect(s.deliveries.some((d) => d.from === 'well-2' && d.status === 'SENDING')).toBe(false);

    s = act(s, { type: 'SET_LINK', target: { kind: 'lora', wellId: 'well-2' }, on: true });
    s = runUntil(s, (x) => x.center['well-2'].status === 'CONTAMINATED');
    s = runUntil(s, (x) => x.deliveries.some((d) => d.from === 'well-2' && d.status === 'ACKED'));
    expect(pendingFor(s, 'well-2').length).toBe(0);
  });

  it('sin LoRa durante 25 s el centro marca el dato como desactualizado', () => {
    let s = act(fresh(), ...isolateWell2);
    s = run(s, 32000);
    expect(s.clockMs - s.center['well-2'].lastHeardAt).toBeGreaterThan(25000);
    expect(diagnoseLink(s, 'well-2').tone).toBe('bad');
  });

  it('9. sin internet el centro sí actualiza por LoRa; la nube espera y luego sincroniza', () => {
    let s = act(fresh(), { type: 'SET_LINK', target: { kind: 'cloud' }, on: false }, { type: 'QUICK_PRESET', wellId: 'well-3', preset: 'VALVE_DAMAGE' });
    s = runUntil(s, (x) => x.center['well-3'].status === 'VALVE_DAMAGE');
    s = run(s, 5000);
    expect(s.cloud['well-3'].status).toBe('ENABLED');
    s = act(s, { type: 'SET_LINK', target: { kind: 'cloud' }, on: true });
    s = runUntil(s, (x) => x.cloud['well-3'].status === 'VALVE_DAMAGE');
  });

  it('10. paquete perdido: el primer intento cae, el reintento llega con ACK y el evento no desaparece', () => {
    let s = act(fresh(), { type: 'DROP_NEXT', wellId: 'well-1' }, { type: 'QUICK_PRESET', wellId: 'well-1', preset: 'NO_WATER' });
    const eventId = Object.keys(s.events).at(-1)!;
    s = runUntil(s, (x) => x.deliveries.some((d) => d.eventId === eventId && d.to === 'gateway' && d.status === 'ACKED'));
    const d = s.deliveries.find((x) => x.eventId === eventId && x.to === 'gateway')!;
    expect(d.attempt).toBe(2);
    expect(logText(s)).toMatch(/Paquete perdido/);
    expect(s.center['well-1'].status).toBe('NO_WATER');
  });

  it('11. ACK perdido → reintento duplicado; el centro aplica una sola vez', () => {
    let s = act(fresh(), { type: 'DROP_NEXT_ACK', wellId: 'well-1' }, { type: 'NOTIFY_STATE', wellId: 'well-1' });
    const eventId = Object.keys(s.events).at(-1)!;
    s = runUntil(s, (x) => x.deliveries.some((d) => d.eventId === eventId && d.to === 'gateway' && d.status === 'ACKED'));
    expect(s.seen.gateway.filter((id) => id === eventId)).toHaveLength(1);
    expect(logText(s)).toMatch(/duplicado reconocido/);
  });

  it('12. evento antiguo que llega tarde no revierte el estado más nuevo', () => {
    let s = act(fresh(), { type: 'INJECT_OUT_OF_ORDER', wellId: 'well-2' });
    s = run(s, 8000);
    expect(logText(s)).toMatch(/IGNORED_STALE_EVENT/);
    expect(s.center['well-2'].status).toBe('ENABLED');
  });

  it('pérdida aleatoria es reproducible con la misma seed', () => {
    const scenario = (seed: number) => {
      let s = act(fresh(seed), { type: 'SET_LOSS', pct: 50 });
      for (let i = 0; i < 4; i++) s = act(s, { type: 'NOTIFY_STATE', wellId: 'well-1' });
      return run(s, 20000).log.map((l) => l.text);
    };
    expect(scenario(7)).toEqual(scenario(7));
  });
});

describe('testigo / relevo entre pozos', () => {
  it('pozo sin enlace directo: el vecino escucha y retransmite; el centro lo sabe vivo', () => {
    let s = act(
      fresh(),
      { type: 'SET_LINK', target: { kind: 'lora', wellId: 'well-1' }, on: false },
      { type: 'SET_LINK', target: { kind: 'mesh', a: 'well-1', b: 'well-2' }, on: false },
      { type: 'QUICK_PRESET', wellId: 'well-1', preset: 'NO_WATER' },
    );
    s = runUntil(s, (x) => x.center['well-1'].status === 'NO_WATER');
    expect(s.center['well-1'].via).toBe('LORA_RELAY');
    expect(s.wells['well-3'].witnessStore.length).toBe(1);
    s = run(s, 14000);
    expect(diagnoseLink(s, 'well-1').tone).toBe('warn');
  });

  it('la trabajadora porta los eventos pendientes al centro (ruta B)', () => {
    let s = act(fresh(), ...isolateWell2, { type: 'QUICK_PRESET', wellId: 'well-2', preset: 'VALVE_DAMAGE' });
    s = act(s, { type: 'SEND_PERSON', personId: 'worker', target: 'well-2' });
    s = runUntil(s, (x) => x.center['well-2'].status === 'VALVE_DAMAGE', 90000);
    expect(logText(s)).toMatch(/portado por trabajadora/);
  });
});

describe('reloj, pausa y persistencia', () => {
  it('15. en pausa no avanzan reloj, personas ni paquetes', () => {
    let s = act(fresh(), { type: 'SEND_PERSON', personId: 'amina', target: 'AUTO' }, { type: 'NOTIFY_STATE', wellId: 'well-1' });
    s = run(s, 300);
    const paused = act(s, { type: 'SET_PAUSED', paused: true });
    const after = run(paused, 5000);
    expect(after.clockMs).toBe(paused.clockMs);
    expect(after.people).toEqual(paused.people);
    expect(after.deliveries).toEqual(paused.deliveries);
  });

  it('16. paso a paso avanza solo hasta la siguiente acción programada', () => {
    let s = act(fresh(), { type: 'NOTIFY_STATE', wellId: 'well-1' });
    s = applyAction(s, { type: 'STEP' });
    expect(s.paused).toBe(true);
    expect(s.clockMs).toBeLessThan(1000);
    expect(s.deliveries.some((d) => d.status === 'SENDING')).toBe(true);
  });

  it('14. persistencia: el estado y el outbox se recuperan tras recargar', () => {
    let s = act(fresh(), ...isolateWell2, { type: 'QUICK_PRESET', wellId: 'well-2', preset: 'CONFIRMED_POSITIVE' });
    s = run(s, 2000);
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    saveState(s, storage);
    const restored = loadState(storage)!;
    expect(restored.paused).toBe(true);
    expect(pendingFor(restored, 'well-2').length).toBe(1);
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it('18. reset restaura todo sin pulsos fantasma', () => {
    let s = act(fresh(), { type: 'NOTIFY_STATE', wellId: 'well-1' }, { type: 'SEND_PERSON', personId: 'amina', target: 'AUTO' });
    s = run(s, 500);
    s = act(s, { type: 'RESET' });
    expect(s.deliveries).toHaveLength(0);
    expect(s.fx).toHaveLength(0);
    expect(s.clockMs).toBe(0);
    expect(s.people.every((p) => p.path.length === 0)).toBe(true);
  });
});

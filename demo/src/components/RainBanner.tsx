import { DEMO_CONFIG } from '../domain/config';
import { rainActiveSince } from '../domain/deriveWellState';
import type { SimulationState } from '../domain/types';

export function RainBanner({ state }: { state: SimulationState }) {
  const since = rainActiveSince(state.rain.startedAt, state.clockMs);
  if (since === null) return null;
  const day = Math.min(DEMO_CONFIG.rainWindowDays, Math.floor((state.clockMs - since) / DEMO_CONFIG.dayMs) + 1);
  return (
    <div className="rain-banner" role="status">
      <span aria-hidden="true">🌧</span>
      <b>
        Ventana de lluvia · día {day} de {DEMO_CONFIG.rainWindowDays}
      </b>
      <small>No asumir potable: las verificaciones previas no sirven hasta re-verificar</small>
    </div>
  );
}

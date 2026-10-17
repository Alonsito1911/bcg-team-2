import { WELL_POS } from '../domain/geometry';
import { deriveLocal } from '../domain/state';
import { diagnoseLink, pendingFor } from '../domain/transport';
import type { SimulationState, WellId } from '../domain/types';
import { Sprite } from '../assets/Sprite';
import { describeStatus, spriteForState } from './labels';

interface Props {
  state: SimulationState;
  wellId: WellId;
  selected: boolean;
  onSelect: (id: WellId) => void;
}

/** La ilustración muestra la VERDAD física; el badge y el LED muestran lo que sabe el dispositivo. */
function physicalSprite(state: SimulationState, wellId: WellId): string {
  const w = state.wells[wellId];
  const local = deriveLocal(state, wellId).primary;
  if (w.hiddenContamination || local === 'CONTAMINATED') return 'well-contaminated';
  if (w.physicalValveBroken || local === 'VALVE_DAMAGE') return 'well-valve-damage';
  if (w.physicalDry || local === 'NO_WATER') return 'well-no-water';
  return spriteForState(local);
}

export function WellSprite({ state, wellId, selected, onSelect }: Props) {
  const well = state.wells[wellId];
  const local = deriveLocal(state, wellId);
  const ui = describeStatus(local.primary, well.factors);
  const pos = WELL_POS[wellId];
  const pending = pendingFor(state, wellId).length;
  const diag = diagnoseLink(state, wellId);
  const center = state.center[wellId];
  const diverges = center.status !== local.primary;
  const linkText = !well.powered ? 'Sin energía' : diag.tone === 'ok' ? 'Enlace activo' : diag.tone === 'warn' ? 'Vía relevo' : 'Sin enlace';
  const linkCls = !well.powered ? 'bad' : diag.tone === 'ok' ? 'ok' : diag.tone === 'warn' ? 'warn' : 'bad';
  const led = !well.powered ? 'off' : local.primary === 'ENABLED' ? 'green' : 'red';
  const silentFault = (well.hiddenContamination || well.physicalDry || well.physicalValveBroken) && local.primary === 'ENABLED';

  return (
    <button
      type="button"
      className={`well ${selected ? 'selected' : ''} ${local.primary.toLowerCase()}`}
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
      onClick={() => onSelect(wellId)}
      aria-label={`${well.name}: ${ui.label}. Abrir detalle`}
      aria-pressed={selected}
    >
      <span className="well-name">{well.name}</span>
      <span className={`badge ${ui.cls}`}>
        <span aria-hidden="true">{ui.icon}</span> {ui.label}
      </span>
      <span className="well-stage">
        <Sprite name={physicalSprite(state, wellId)} alt={`Ilustración de ${well.name}`} className={`well-art ${well.powered ? '' : 'unpowered'}`} />
        <span className="device" title="Caja del pozo: nodo LoRa + botones BIEN/MAL">
          <Sprite name="device-box" alt="" className="device-art" />
          <span className={`device-led ${led}`} aria-hidden="true" />
        </span>
        {silentFault && <span className="silent-fault" title="Falla física que nadie ha reportado todavía">?</span>}
      </span>
      <span className="well-meta">
        <span className={`chip ${linkCls}`}>{linkText}</span>
        {pending > 0 && <span className="chip gray">✉ {pending} en cola</span>}
        {local.lowReserve && local.primary === 'ENABLED' && <span className="chip warn">Reserva baja</span>}
        {diverges && <span className="chip gray">Pueblo: {describeStatus(center.status, center.factors).label}</span>}
      </span>
    </button>
  );
}

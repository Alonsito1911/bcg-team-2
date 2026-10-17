import { HUTS, TREES } from '../domain/geometry';
import { WELL_IDS, type SimulationState, type WellId } from '../domain/types';
import { Landscape, Sprite } from '../assets/Sprite';
import { rasterFor } from '../assets/manifest';
import { RainBanner } from './RainBanner';
import { SignalLayer } from './SignalLayer';
import { VillageTrafficLight } from './VillageTrafficLight';
import { VillagerSprite } from './VillagerSprite';
import { WellSprite } from './WellSprite';

interface Props {
  state: SimulationState;
  selected: WellId | null;
  onSelect: (id: WellId) => void;
  showArchitecture: boolean;
  /** En la presentación la ONG se muestra en el mapa de la región: no dibujar la "nube" del pueblo. */
  hideCloud?: boolean;
}

/** Capas según doc 02 §4.2: terreno → decoración → chozas/pozos → personas → semáforo → etiquetas → señales. */
export function VillageScene({ state, selected, onSelect, showArchitecture, hideCloud }: Props) {
  return (
    <div className="scene" role="group" aria-label="Pueblo con tres pozos y un semáforo central">
      <Landscape />
      {!rasterFor('landscape') && TREES.map((t, i) => (
        <Sprite key={i} name="acacia" alt="" className="deco tree" style={{ left: `${t.x}%`, top: `${t.y}%`, width: `${13 * t.scale}%`, transform: `translate(-50%,-100%) scaleX(${t.flip ? -1 : 1})` }} />
      ))}
      {!rasterFor('landscape') && HUTS.map((h, i) => (
        <Sprite key={i} name={`hut-${h.variant}`} alt="" className="deco hut" style={{ left: `${h.x}%`, top: `${h.y}%`, width: `${15 * h.scale}%` }} />
      ))}
      {WELL_IDS.map((id) => (
        <WellSprite key={id} state={state} wellId={id} selected={selected === id} onSelect={onSelect} />
      ))}
      {state.people.map((p) => (
        <VillagerSprite key={p.id} person={p} paused={state.paused} />
      ))}
      <VillageTrafficLight state={state} />
      <SignalLayer state={state} showArchitecture={showArchitecture} hideCloud={hideCloud} />
      <RainBanner state={state} />
    </div>
  );
}

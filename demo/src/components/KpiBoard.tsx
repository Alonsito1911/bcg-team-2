import { BOMBAS, LORA, NIVELES } from '../domain/kiryandongo';
import { WELL_IDS, type SimulationState, type WellState } from '../domain/types';

// KPIs sobre el mapa de la región: a la izquierda los datos REALES del distrito (WPDx 2022),
// bajo el pueblo el estado EN VIVO del pueblo piloto (simulado). Coordenadas en % del mundo.
const fmt = (n: number) => Math.round(n).toLocaleString('es');
const ROTAS = BOMBAS.filter((b) => b.motivo.startsWith('rota')).length;
const PROBLEMA: Partial<Record<WellState, string>> = {
  CONTAMINATED: 'contaminado',
  NO_WATER: 'sin agua',
  VALVE_DAMAGE: 'válvula dañada',
};

export function KpiBoard({ state }: { state: SimulationState }) {
  const habilitados = WELL_IDS.filter((id) => state.center[id].status === 'ENABLED').length;
  const bloqueados = WELL_IDS.filter((id) => PROBLEMA[state.center[id].status]);
  const ongAlertas = WELL_IDS.filter((id) => PROBLEMA[state.cloud[id].status]).length;
  const reportes = Object.keys(state.events).length;

  return (
    <>
      <div className="kpi-board region" style={{ left: '2.5%', top: '31%', width: '24%' }}>
        <div className="kpi-title">Kiryandongo · datos reales</div>
        <div className="kpi-grid">
          <div className="kpi crit">
            <b>{NIVELES['Crítico'].bombas}</b>
            <span>bombas críticas de {fmt(BOMBAS.length)}</span>
          </div>
          <div className="kpi">
            <b>{fmt(NIVELES['Crítico'].personas)}</b>
            <span>personas afectadas</span>
          </div>
          <div className="kpi">
            <b>{ROTAS}</b>
            <span>bombas rotas ({Math.round((ROTAS / BOMBAS.length) * 100)}%)</span>
          </div>
          <div className="kpi">
            <b>
              {LORA.resumen.criticas_con_todo}/{LORA.resumen.criticas_total}
            </b>
            <span>críticas con cobertura LoRa</span>
          </div>
        </div>
        <small>Censo WPDx feb. 2022 · modelo de prioridad del equipo</small>
      </div>

      <div className="kpi-board village" style={{ left: '31%', top: '70%', width: '38%' }}>
        <div className="kpi-title">Pueblo piloto · en vivo (simulado)</div>
        <div className="kpi-row">
          <div className={`kpi ${habilitados < WELL_IDS.length ? 'warn' : 'ok'}`}>
            <b>
              {habilitados}/{WELL_IDS.length}
            </b>
            <span>pozos habilitados</span>
          </div>
          <div className={`kpi ${bloqueados.length ? 'crit' : ''}`}>
            <b>{bloqueados.length}</b>
            <span>
              {bloqueados.length
                ? bloqueados.map((id) => `${state.wells[id].name} ${PROBLEMA[state.center[id].status]}`).join(' · ')
                : 'pozos bloqueados'}
            </span>
          </div>
          <div className="kpi">
            <b>{reportes}</b>
            <span>eventos registrados</span>
          </div>
          <div className={`kpi ${ongAlertas ? 'crit' : ''}`}>
            <b>{ongAlertas ? 'Sí' : 'No'}</b>
            <span>{ongAlertas ? `ONG alertada (${ongAlertas})` : 'alertas en la ONG'}</span>
          </div>
        </div>
      </div>
    </>
  );
}

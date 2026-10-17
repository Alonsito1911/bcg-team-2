import { useMemo, useState, type ReactNode } from 'react';
import { riskFor, RISK_MODEL, villageWells, type RegionWell } from '../domain/analytics';
import { contourSegments } from '../domain/contours';
import { DISCLAIMER } from '../domain/config';
import { isFresh } from '../domain/deriveVillageState';
import { rainActiveSince } from '../domain/deriveWellState';
import {
  ACCION,
  ASENTAMIENTO,
  BOMBAS,
  ECOLI_ESTADO,
  ECOLI_MES,
  FUENTE,
  kmToMap,
  LIMITE,
  LLUVIA,
  lluviaAnualDistrito,
  lluviaEn,
  lluviaMensualDistrito,
  LORA,
  MAP_H,
  MAP_W,
  NIVELES,
  project,
  PUEBLO_DEMO,
  ringPath,
  UMBRALES,
  type Bomba,
  type Nivel,
} from '../domain/kiryandongo';
import { demoDay, formatClock } from '../domain/state';
import { WELL_IDS, type SimulationState, type WellState } from '../domain/types';
import type { UiAction } from '../store';
import { describeStatus } from './labels';

// Colores de estado (reservados: siempre con ícono + texto) · paleta de la guía de visualización.
const NIVEL_UI: Record<Nivel, { color: string; icon: string; shape: Shape }> = {
  Crítico: { color: '#d03b3b', icon: '▲', shape: 'triangle' },
  Alto: { color: '#ec835a', icon: '■', shape: 'square' },
  Revisar: { color: '#fab219', icon: '◆', shape: 'diamond' },
  Bien: { color: '#0ca30c', icon: '●', shape: 'circle' },
};
const WELL_UI: Record<WellState, { label: string; color: string; shape: Shape }> = {
  ENABLED: { label: 'Operativo', color: '#0ca30c', shape: 'circle' },
  UNKNOWN: { label: 'Reportado / sin verificar', color: '#fab219', shape: 'diamond' },
  NO_WATER: { label: 'Sin agua', color: '#ec835a', shape: 'square' },
  VALVE_DAMAGE: { label: 'Válvula dañada', color: '#ec835a', shape: 'square' },
  CONTAMINATED: { label: 'Contaminado', color: '#d03b3b', shape: 'triangle' },
};
const SERIES_1 = '#2a78d6';
const SERIES_2 = '#eb6834';
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const NIVELES_ORDEN: Nivel[] = ['Crítico', 'Alto', 'Revisar', 'Bien'];
const fmt = (n: number) => n.toLocaleString('es');

type Shape = 'circle' | 'diamond' | 'square' | 'triangle';

interface Tip {
  x: number;
  y: number;
  lines: { value: string; label: string; color?: string }[];
}

function Tooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div className="viz-tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
      {tip.lines.map((l, i) => (
        <div key={i} className="viz-tip-row">
          {l.color && <span className="viz-key" style={{ background: l.color }} />}
          <strong>{l.value}</strong>
          <span>{l.label}</span>
        </div>
      ))}
    </div>
  );
}

function Card({ title, sub, children, actions, className }: { title: string; sub?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`viz-card ${className ?? ''}`}>
      <header>
        <div>
          <h3>{title}</h3>
          {sub && <p>{sub}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

function Marker({ shape, color, size = 1 }: { shape: Shape; color: string; size?: number }) {
  const s = size;
  const ring = { stroke: '#fcfcfb', strokeWidth: s * 0.28 };
  if (shape === 'diamond') return <path d={`M0 ${-s} L${s} 0 L0 ${s} L${-s} 0 Z`} fill={color} {...ring} />;
  if (shape === 'square') return <rect x={-s * 0.8} y={-s * 0.8} width={s * 1.6} height={s * 1.6} rx={s * 0.2} fill={color} {...ring} />;
  if (shape === 'triangle') return <path d={`M0 ${-s * 1.1} L${s} ${s * 0.8} L${-s} ${s * 0.8} Z`} fill={color} {...ring} />;
  return <circle r={s * 0.85} fill={color} {...ring} />;
}

function KeyShape({ shape, color }: { shape: Shape; color: string }) {
  return (
    <svg width="14" height="14" viewBox="-1.4 -1.4 2.8 2.8" aria-hidden="true">
      <Marker shape={shape} color={color} size={1.1} />
    </svg>
  );
}

// ---------------------------------------------------------------- mapa de Kiryandongo

function KiryandongoMap({ bombas, showRain, showLora, state }: { bombas: Bomba[]; showRain: boolean; showLora: boolean; state: SimulationState }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const isohyets = useMemo(() => {
    const secas = LLUVIA.map((c) => c.seca);
    const lo = Math.ceil(Math.min(...secas) / 10) * 10;
    const hi = Math.floor(Math.max(...secas) / 10) * 10;
    const levels: number[] = [];
    for (let v = lo; v <= hi; v += 10) levels.push(v);
    return levels.map((lv) => ({ lv, segs: contourSegments((x, y) => lluviaEn(x, y, 'seca'), lv, MAP_W, MAP_H, 1.5) }));
  }, []);
  const demo = project(PUEBLO_DEMO.lat, PUEBLO_DEMO.lon);
  const show = (e: React.PointerEvent, lines: Tip['lines']) => {
    const r = (e.currentTarget as SVGGraphicsElement).ownerSVGElement!.getBoundingClientRect();
    setTip({ x: e.clientX - r.left + 14, y: e.clientY - r.top + 14, lines });
  };

  return (
    <div className="topo-wrap" onPointerLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="topo" role="img" aria-label="Mapa del distrito de Kiryandongo con las bombas por nivel de prioridad">
        <rect width={MAP_W} height={MAP_H} fill="#f6f3ea" />
        <path d={ringPath(LIMITE)} fill="#fcfcfb" stroke="#898781" strokeWidth=".35" />
        {showRain &&
          isohyets.map(({ lv, segs }) => (
            <g key={lv} stroke="#86b6ef" strokeWidth={lv % 20 === 0 ? 0.32 : 0.18}>
              {segs.map((s, i) => (
                <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
              ))}
              {lv % 20 === 0 && segs[Math.floor(segs.length / 2)] && (
                <text x={segs[Math.floor(segs.length / 2)].x1} y={segs[Math.floor(segs.length / 2)].y1} className="topo-label iso">
                  {lv} mm
                </text>
              )}
            </g>
          ))}
        <path d={ringPath(ASENTAMIENTO)} fill="#e3e4e6" fillOpacity=".55" stroke="#52514e" strokeWidth=".3" strokeDasharray="1 .7" />
        {showLora &&
          [...LORA.torres.map((t) => ({ ...t, nuevo: false })), ...LORA.nuevos.map((t) => ({ ...t, nuevo: true }))].map((t, i) => {
            const p = project(t.lat, t.lon);
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={kmToMap(LORA.resumen.radio_km)} fill={SERIES_1} fillOpacity=".05" stroke={SERIES_1} strokeWidth=".25" strokeDasharray={t.nuevo ? '1 .8' : undefined} />
                <g
                  transform={`translate(${p.x} ${p.y})`}
                  className="topo-well"
                  onPointerMove={(e) =>
                    show(e, [
                      { value: t.nuevo ? 'Gateway LoRa nuevo (propuesto)' : 'Torre existente (OSM)', label: '' },
                      t.nuevo ? { value: `${t.criticas} críticas`, label: `${fmt(t.personas ?? 0)} personas afectadas cubiertas` } : { value: `${LORA.resumen.radio_km} km`, label: 'radio supuesto' },
                    ])
                  }
                >
                  <circle r="2.6" fill="transparent" />
                  <path d="M0 -1.6 L1.1 1.1 L-1.1 1.1 Z" fill={t.nuevo ? '#fcfcfb' : SERIES_1} stroke={SERIES_1} strokeWidth=".3" />
                </g>
              </g>
            );
          })}
        {bombas.map((b) => {
          const p = project(b.lat, b.lon);
          const ui = NIVEL_UI[b.nivel];
          const big = b.nivel === 'Crítico';
          return (
            <g
              key={b.ranking}
              transform={`translate(${p.x} ${p.y})`}
              className="topo-well"
              onPointerMove={(e) =>
                show(e, [
                  { value: `#${b.ranking} · ${ui.icon} ${b.nivel}`, label: b.subcondado, color: ui.color },
                  { value: fmt(b.afectadas), label: 'personas afectadas' },
                  { value: b.motivo, label: `dato ${b.fecha}` },
                ])
              }
            >
              <circle r="1.6" fill="transparent" />
              <Marker shape={ui.shape} color={ui.color} size={big ? 0.95 : 0.62} />
            </g>
          );
        })}
        <g transform={`translate(${demo.x} ${demo.y})`} className="topo-well" onPointerMove={(e) => show(e, [{ value: PUEBLO_DEMO.nombre, label: 'pozos A, B y C de la simulación' }, ...WELL_IDS.map((id) => ({ value: state.wells[id].name, label: describeStatus(state.cloud[id].status, state.cloud[id].factors).label, color: WELL_UI[state.cloud[id].status].color }))])}>
          <circle r="3" fill="#fcfcfb" stroke="#0b0b0b" strokeWidth=".35" />
          {WELL_IDS.map((id, i) => (
            <g key={id} transform={`translate(${(i - 1) * 1.6} 0)`}>
              <Marker shape={WELL_UI[state.cloud[id].status].shape} color={WELL_UI[state.cloud[id].status].color} size={0.6} />
            </g>
          ))}
          <text y="-3.8" textAnchor="middle" className="topo-label strong">
            Pueblo piloto (simulado)
          </text>
        </g>
      </svg>
      <Tooltip tip={tip} />
      <ul className="legend">
        {NIVELES_ORDEN.map((n) => (
          <li key={n}>
            <KeyShape shape={NIVEL_UI[n].shape} color={NIVEL_UI[n].color} /> {n}
          </li>
        ))}
        {showRain && (
          <li>
            <span className="viz-key" style={{ background: '#86b6ef' }} /> isoyetas: lluvia dic–feb (mm)
          </li>
        )}
        {showLora && (
          <li>
            <span className="viz-key" style={{ background: SERIES_1 }} /> cobertura LoRa {LORA.resumen.radio_km} km (punteado = propuesto)
          </li>
        )}
        <li>
          <span className="viz-key" style={{ background: '#52514e' }} /> asentamiento de refugiados
        </li>
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- barras simples (un solo eje)

function Bars({ values, labels, color, unit, title, note, dimIf, tipFor }: { values: number[]; labels: string[]; color: string; unit: string; title: string; note?: ReactNode; dimIf?: (i: number) => boolean; tipFor: (i: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 320;
  const H = 130;
  const L = 30;
  const B = 18;
  const T = 12;
  const max = Math.max(...values) || 1;
  const step = max > 200 ? 500 : max > 100 ? 50 : max > 20 ? 20 : 10;
  const nice = Math.ceil(max / step) * step;
  const iw = (W - L - 6) / values.length;
  const y = (v: number) => T + (H - T - B) * (1 - v / nice);
  return (
    <figure className="mini-chart">
      <figcaption>
        <span className="viz-key bar" style={{ background: color }} /> {title}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} onPointerLeave={() => setHover(null)}>
        {[0, nice / 2, nice].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - 4} y1={y(v)} y2={y(v)} stroke={v === 0 ? '#c3c2b7' : '#e1e0d9'} />
            <text x={L - 4} y={y(v) + 3} textAnchor="end" className="axis">
              {fmt(Math.round(v))}
            </text>
          </g>
        ))}
        <text x={L} y={T - 3} className="axis">
          {unit}
        </text>
        {values.map((v, i) => {
          const h = Math.max(0, y(0) - y(v));
          const r = Math.min(3, h, iw / 2 - 1);
          const x0 = L + i * iw + 1;
          const x1 = L + (i + 1) * iw - 1;
          return (
            <g key={i}>
              {h > 0 && (
                <path
                  d={`M${x0} ${y(0)} V${y(v) + r} Q${x0} ${y(v)} ${x0 + r} ${y(v)} H${x1 - r} Q${x1} ${y(v)} ${x1} ${y(v) + r} V${y(0)} Z`}
                  fill={color}
                  opacity={(dimIf?.(i) ? 0.35 : 1) * (hover === null || hover === i ? 1 : 0.55)}
                />
              )}
              <rect x={L + i * iw} y={T} width={iw} height={H - T} fill="transparent" onPointerMove={() => setHover(i)} />
              {(values.length <= 12 || i % 2 === 0) && (
                <text x={L + (i + 0.5) * iw} y={H - 5} textAnchor="middle" className="axis">
                  {labels[i]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="hover-readout" aria-live="polite">
        {hover !== null ? tipFor(hover) : note}
      </div>
    </figure>
  );
}

function RainQuality() {
  const [table, setTable] = useState(false);
  const mensual = lluviaMensualDistrito();
  const anual = lluviaAnualDistrito();
  const pct = ECOLI_MES.map((m) => (m.muestras ? Math.round((m.positivas / m.muestras) * 100) : 0));
  const funciona = ECOLI_ESTADO['funciona'];
  const pctFunciona = funciona ? Math.round((funciona.positivas / funciona.muestras) * 100) : 0;
  const secos = (UMBRALES.meses_secos as number[]) ?? [12, 1, 2];
  const media = Math.round(anual.reduce((a, b) => a + b.mm, 0) / anual.length);
  const secosAnios = anual.filter((a) => a.mm < media * 0.9).map((a) => a.anio);
  return (
    <Card
      title="Lluvia y calidad del agua"
      sub={
        <>
          Lluvia real (ERA5, Kiryandongo, 2015–2024) y E. coli real (WPDx Uganda, 1.506 muestras). Cada medida en su propio gráfico: sin doble eje.
        </>
      }
      actions={
        <button type="button" className="ghost" onClick={() => setTable((t) => !t)}>
          {table ? 'Ver gráficos' : 'Ver tabla'}
        </button>
      }
    >
      <div className="stat-row">
        <div className="stat alert">
          <span className="stat-v">{pctFunciona}%</span>
          <span className="stat-l">de las bombas que FUNCIONAN tenía coliformes fecales ({fmt(funciona?.positivas ?? 0)} de {fmt(funciona?.muestras ?? 0)}): funcionar no es ser segura → por eso existe la guardiana</span>
        </div>
        <div className="stat">
          <span className="stat-v">{secos.map((m) => MESES[m - 1]).join('–')}</span>
          <span className="stat-l">estación seca: las zonas que menos llueven pesan hasta +{Math.round(Number(UMBRALES.peso_seco) * 100)}% en la prioridad</span>
        </div>
        <div className="stat">
          <span className="stat-v">{secosAnios.join(', ') || '—'}</span>
          <span className="stat-l">años bajo el 90% de la lluvia media ({fmt(media)} mm/año)</span>
        </div>
      </div>
      {table ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mes</th>
                <th>Lluvia media (mm)</th>
                <th>Muestras E. coli</th>
                <th>% con coliformes</th>
              </tr>
            </thead>
            <tbody>
              {MESES.map((m, i) => (
                <tr key={m}>
                  <td>{m}</td>
                  <td>{mensual[i]}</td>
                  <td>{ECOLI_MES[i].muestras}</td>
                  <td>{pct[i]}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mini-grid">
          <Bars
            values={mensual}
            labels={MESES.map((m) => m[0])}
            color={SERIES_1}
            unit="mm/mes"
            title="Lluvia media mensual"
            dimIf={(i) => secos.includes(i + 1)}
            note="Barras tenues = meses secos (dic–feb)"
            tipFor={(i) => `${MESES[i]}: ${mensual[i]} mm de lluvia media`}
          />
          <Bars
            values={pct}
            labels={MESES.map((m) => m[0])}
            color={SERIES_2}
            unit="% positivas"
            title="Muestras con coliformes fecales, por mes del reporte"
            dimIf={(i) => ECOLI_MES[i].muestras < 50}
            note="Tenue = menos de 50 muestras (poco confiable)"
            tipFor={(i) => `${MESES[i]}: ${pct[i]}% positivas (${ECOLI_MES[i].positivas} de ${ECOLI_MES[i].muestras})`}
          />
          <Bars values={anual.map((a) => a.mm)} labels={anual.map((a) => `'${a.anio.slice(2)}`)} color={SERIES_1} unit="mm/año" title="Lluvia anual del distrito" note="2021–2022 fueron años secos (el censo es de feb 2022)" tipFor={(i) => `${anual[i].anio}: ${fmt(anual[i].mm)} mm`} />
        </div>
      )}
      <p className="fine">
        Lectura honesta: las muestras de E. coli vienen de campañas de distinto tamaño y lugar (583 en febrero, 6 en enero), así que el patrón mensual es descriptivo, no causal. La regla de la ventana de 15 días tras la lluvia es una hipótesis que se valida con las pruebas de las guardianas y los sensores de la fase Estrella.
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------- prioridad (modelo del equipo)

function PriorityTable({ bombas }: { bombas: Bomba[] }) {
  const [n, setN] = useState(15);
  const rows = bombas.slice(0, n);
  return (
    <Card
      title="Qué bomba reparar primero"
      sub={`Modelo de prioridad v1 de bcg-team-2 (reglas transparentes): crítica si está rota con ≥ ${UMBRALES.rota_critica_personas} usuarios o sobreusada al ≥ ${Math.round(Number(UMBRALES.presion_critica) * 100)}%. Puntaje = personas afectadas × factor de estación seca.`}
    >
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Subcondado</th>
              <th>Nivel</th>
              <th>Motivo</th>
              <th>Personas afectadas</th>
              <th>Puntaje</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.ranking}>
                <td>{b.ranking}</td>
                <td>{b.subcondado}</td>
                <td>
                  <span className="lvl">
                    <KeyShape shape={NIVEL_UI[b.nivel].shape} color={NIVEL_UI[b.nivel].color} /> {b.nivel}
                  </span>
                </td>
                <td>{b.motivo}</td>
                <td>{fmt(b.afectadas)}</td>
                <td>{fmt(b.puntaje)}</td>
                <td>{ACCION[b.nivel]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {bombas.length > n && (
        <button type="button" className="ghost" onClick={() => setN((x) => x + 25)}>
          Ver 25 más ({fmt(bombas.length - n)} restantes)
        </button>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- modelo de riesgo (A/B/C, simulado)

const LEVEL: Record<string, { color: string; icon: string }> = {
  Alto: { color: '#d03b3b', icon: '▲' },
  Medio: { color: '#fab219', icon: '◆' },
  Bajo: { color: '#0ca30c', icon: '●' },
};

function Predictive({ wells, defaultRain }: { wells: RegionWell[]; defaultRain: number }) {
  const [rain, setRain] = useState(defaultRain);
  const rows = wells.map((w) => riskFor(w, rain)).sort((a, b) => b.risk - a.risk);
  const maxCoef = Math.max(...RISK_MODEL.features.map((f) => f.coef));
  return (
    <Card title="Anticipación: riesgo de contaminación en el pueblo piloto" sub="Prototipo de la etapa 3 del brief. Coeficientes SIMULADOS; se entrena con las pruebas verificadas por guardianas y los 1.506 resultados de E. coli de WPDx.">
      <label className="viz-slider">
        <span>
          Lluvia acumulada en los últimos 15 días: <strong>{rain} mm</strong>
        </span>
        <input type="range" min={0} max={120} step={5} value={rain} onChange={(e) => setRain(Number(e.target.value))} />
      </label>
      <div className="predict-grid">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pozo</th>
                <th>Riesgo</th>
                <th>Por qué</th>
                <th>Medida sugerida</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.well.id}>
                  <td>
                    <b>{r.well.name}</b>
                    <small>{r.well.type}</small>
                  </td>
                  <td>
                    <span className="risk-bar">
                      <span style={{ width: `${Math.round(r.risk * 100)}%`, background: LEVEL[r.level].color }} />
                    </span>
                    <span className="risk-val">
                      {Math.round(r.risk * 100)}% · {LEVEL[r.level].icon} {r.level}
                    </span>
                  </td>
                  <td>{r.drivers.join(', ') || '—'}</td>
                  <td>{r.actions.join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <p className="kicker">Qué pesa en el modelo (log-odds por unidad)</p>
          <svg viewBox="0 0 300 150" className="coef" role="img" aria-label="Peso de cada variable del modelo">
            {RISK_MODEL.features.map((f, i) => {
              const w = (f.coef / maxCoef) * 150;
              return (
                <g key={f.key} transform={`translate(0 ${i * 24 + 4})`}>
                  <text x="0" y="9" className="axis-strong">
                    {f.label}
                  </text>
                  <rect x="0" y="12" width={w} height="7" rx="2" fill={SERIES_1} />
                  <text x={w + 4} y="19" className="axis">
                    +{f.coef}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- flujo de datos y features

const FEATURES: { name: string; phase: 'MVP' | 'Estrella'; detail: string }[] = [
  { name: 'Caja comunitaria BIEN / MAL', phase: 'MVP', detail: 'Cualquier persona reporta una falla sin teléfono ni alfabetización; el pozo queda deshabilitado en el semáforo.' },
  { name: 'Semáforo del pueblo A/B/C', phase: 'MVP', detail: 'Una franja por pozo con dos luces: verde (disponible) / roja (no usar). Sin energía = apagado.' },
  { name: 'Radio LoRa pozo → pueblo', phase: 'MVP', detail: 'Paquetes pequeños sin internet; cola persistente, reintentos y ACK.' },
  { name: 'Guardiana externa + app offline', phase: 'MVP', detail: 'Verifica con prueba, confirma o descarta, repara y lleva los datos por BLE (ruta B).' },
  { name: 'Retiro manual de datos', phase: 'MVP', detail: 'La guardiana descarga el centro del pueblo en cada visita y lo entrega a la ONG.' },
  { name: 'Priorización de 847 bombas (bcg-team-2)', phase: 'MVP', detail: 'Ranking por personas afectadas × factor de estación seca: dónde reparar primero.' },
  { name: 'Sensores de nivel y de bomba', phase: 'Estrella', detail: 'Sin agua y válvula dañada se informan solos: de ~30 días a ~3 días para detectar una falla (brief §1).' },
  { name: 'Red LoRaWAN con torres + 3 gateways', phase: 'Estrella', detail: `Escenario de bcg-team-2: ${LORA.resumen.criticas_con_todo} de ${LORA.resumen.criticas_total} bombas críticas cubiertas (radio supuesto ${LORA.resumen.radio_km} km).` },
  { name: 'Réplica entre pozos (testigo)', phase: 'Estrella', detail: 'Un pozo vecino escucha y retransmite si se corta un enlace; el centro deduplica.' },
  { name: 'Pluviómetro y ventana de 15 días', phase: 'Estrella', detail: 'La lluvia abre una ventana de riesgo y sube la prioridad de visitas.' },
  { name: 'Modelo de falla y de E. coli', phase: 'Estrella', detail: 'Próximo paso de bcg-team-2: probabilidad de falla y de contaminación por bomba.' },
  { name: 'Recomendador de presupuesto', phase: 'Estrella', detail: 'Reparaciones + sensores vs. red LoRaWAN, en personas atendidas por dólar.' },
];

function DataFlow({ state }: { state: SimulationState }) {
  const star = state.phase === 'STAR';
  const steps = [
    { t: 'Pozo + caja', d: 'botón BIEN/MAL · LED' },
    { t: 'Semáforo del pueblo', d: 'gateway LoRa · cola local' },
    star ? { t: 'Antena + torre', d: 'LoRaWAN en tiempo real' } : { t: 'Retiro manual', d: 'guardiana · cada visita' },
    { t: 'Servidor ONG', d: 'broker MQTT · base de datos' },
    { t: 'Este dashboard', d: 'prioridad · lluvia · riesgo' },
  ];
  return (
    <Card title="Cómo llegan los datos a la ONG" sub={star ? 'Fase Estrella: antena y torres, tiempo real.' : 'Fase MVP: sin antena; la información llega con la guardiana.'}>
      <ol className="flow">
        {steps.map((s, i) => (
          <li key={s.t} className={i === 2 ? (star ? 'live' : 'manual') : ''}>
            <b>{s.t}</b>
            <small>{s.d}</small>
          </li>
        ))}
      </ol>
      <div className="table-scroll">
        <table className="data-table features">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Fase</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((f) => (
              <tr key={f.name} className={f.phase === 'Estrella' && !star ? 'dim' : ''}>
                <td>
                  <b>{f.name}</b>
                </td>
                <td>
                  <span className={`phase-chip ${f.phase === 'MVP' ? 'mvp' : 'star'}`}>{f.phase === 'MVP' ? 'MVP' : '★ Estrella'}</span>
                </td>
                <td>{f.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- dashboard

export interface OngFocusAlert {
  eventId: string | null;
  reportedAt: string | null;
}

function AlertBanner({ alert, receivedAt }: { alert: OngFocusAlert; receivedAt: number }) {
  const hora = alert.reportedAt ? new Date(alert.reportedAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
  return (
    <section className="ong-alert" role="alert">
      <div className="ong-alert-head">
        <span className="ong-alert-dot" aria-hidden="true" />
        <div>
          <h3>Alerta recibida · Pozo B contaminado</h3>
          <p>
            Pueblo piloto (Kiryandongo, ubicación ilustrativa) · fuente: prueba de campo <b>simulada</b> validada por la guardiana · recibida en la
            simulación a las {formatClock(Math.max(0, receivedAt))}
          </p>
        </div>
      </div>
      <div className="ong-alert-grid">
        <div>
          <span className="k">Evento real guardado en el servidor</span>
          <b>{alert.eventId ? `#${alert.eventId.slice(0, 8)}` : 'modo ensayo (sin servidor)'}</b>
          <small>reportado desde el teléfono a las {hora}</small>
        </div>
        <div>
          <span className="k">Pozos disponibles en el pueblo</span>
          <b>2 de 3</b>
          <small>A y C habilitados · B bloqueado</small>
        </div>
        <div className="actions">
          <span className="k">Acciones sugeridas (las decide una persona)</span>
          <ol>
            <li>Confirmar que el Pozo B quedó bloqueado y avisar al comité de agua</li>
            <li>Verificar disponibilidad en los Pozos A y C</li>
            <li>Cloración de choque y nueva prueba en el Pozo B</li>
            <li>Revisar pozos cercanos de alto riesgo en el mapa</li>
          </ol>
        </div>
      </div>
    </section>
  );
}

export function OngDashboard({
  state,
  dispatch,
  onBack,
  focusAlert,
  presentation,
}: {
  state: SimulationState;
  dispatch: (a: UiAction) => void;
  onBack: () => void;
  focusAlert?: OngFocusAlert;
  presentation?: boolean;
}) {
  const [niveles, setNiveles] = useState<Nivel[]>(['Crítico', 'Alto', 'Revisar', 'Bien']);
  const [sub, setSub] = useState('Todos');
  const [showRain, setShowRain] = useState(true);
  const [showLora, setShowLora] = useState(state.phase === 'STAR');
  const subcondados = useMemo(() => ['Todos', ...Array.from(new Set(BOMBAS.map((b) => b.subcondado))).sort()], []);
  const bombas = BOMBAS.filter((b) => niveles.includes(b.nivel) && (sub === 'Todos' || b.subcondado === sub));
  const rainNow = rainActiveSince(state.rain.startedAt, state.clockMs) !== null && !!state.rain.cloudKnows;
  const star = state.phase === 'STAR';
  const live = star && state.connectivity.cloud && state.connectivity.gatewayPowered;
  const fresh = WELL_IDS.every((id) => isFresh(state.cloud[id], state.clockMs));
  const cloudEvents = state.seen.cloud.map((id) => state.events[id]).filter(Boolean).slice(-6).reverse();
  const operativosPiloto = WELL_IDS.filter((id) => state.cloud[id].status === 'ENABLED').length;
  const toggleNivel = (n: Nivel) => setNiveles((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]));

  return (
    <div className="ong">
      <header className="ong-head">
        <button type="button" className="ghost" onClick={onBack}>
          {presentation ? '◂ Volver a la escena' : '◂ Volver al mapa'}
        </button>
        <div>
          <h2>Centro regional ONG · Kiryandongo (Uganda)</h2>
          <p>
            <span className={`phase-chip ${star ? 'star' : 'mvp'}`}>{star ? '★ Fase Estrella' : 'Fase MVP'}</span>{' '}
            {live
              ? fresh
                ? 'Pueblo piloto en tiempo real por antena'
                : 'Antena activa · algunos datos del pueblo piloto están desactualizados'
              : state.lastManualExtractAt !== null
                ? `Pueblo piloto al último retiro manual (${formatClock(state.lastManualExtractAt)}, día ${demoDay(state.lastManualExtractAt)})`
                : 'Aún no hay retiro manual: la ONG no ve los eventos del pueblo piloto'}
          </p>
        </div>
        {!live && !presentation && (
          <button type="button" className="primary" onClick={() => dispatch({ type: 'MANUAL_EXTRACT' })}>
            💾 Simular retiro manual
          </button>
        )}
        <span className="disclaimer">⚠ Pueblo piloto y modelo de riesgo: {DISCLAIMER.toLowerCase()}</span>
      </header>

      {focusAlert && <AlertBanner alert={focusAlert} receivedAt={state.cloud['well-2'].receivedAt} />}

      <div className="stat-row big">
        <div className="stat">
          <span className="stat-v">{NIVELES['Crítico'].bombas}</span>
          <span className="stat-l">bombas críticas · {fmt(NIVELES['Crítico'].personas)} personas afectadas</span>
        </div>
        <div className="stat">
          <span className="stat-v">{NIVELES['Alto'].bombas}</span>
          <span className="stat-l">bombas en nivel alto · {fmt(NIVELES['Alto'].personas)} personas afectadas</span>
        </div>
        <div className="stat">
          <span className="stat-v">
            {LORA.resumen.criticas_con_todo}/{LORA.resumen.criticas_total}
          </span>
          <span className="stat-l">críticas cubiertas con {LORA.torres.length} sitios existentes + {LORA.nuevos.length} gateways LoRa nuevos</span>
        </div>
        <div className="stat">
          <span className="stat-v">{operativosPiloto}/3</span>
          <span className="stat-l">pozos operativos en el pueblo piloto (según la ONG)</span>
        </div>
      </div>

      <div className="filter-row" role="group" aria-label="Filtros">
        {NIVELES_ORDEN.map((n) => (
          <label key={n} className={`chip-toggle ${niveles.includes(n) ? 'on' : ''}`}>
            <input type="checkbox" checked={niveles.includes(n)} onChange={() => toggleNivel(n)} />
            <KeyShape shape={NIVEL_UI[n].shape} color={NIVEL_UI[n].color} /> {n} ({NIVELES[n].bombas})
          </label>
        ))}
        <label className="select">
          Subcondado
          <select value={sub} onChange={(e) => setSub(e.target.value)}>
            {subcondados.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className={`chip-toggle ${showRain ? 'on' : ''}`}>
          <input type="checkbox" checked={showRain} onChange={(e) => setShowRain(e.target.checked)} /> Isoyetas
        </label>
        <label className={`chip-toggle ${showLora ? 'on' : ''}`}>
          <input type="checkbox" checked={showLora} onChange={(e) => setShowLora(e.target.checked)} /> Red LoRa
        </label>
        <span className="muted">{fmt(bombas.length)} bombas visibles</span>
      </div>

      <div className="ong-grid">
        <Card title="Mapa de bombas de Kiryandongo" sub="Cada bomba con su nivel del modelo del equipo. Las líneas son isoyetas reales (lluvia dic–feb). Pasa el cursor por un punto.">
          <KiryandongoMap bombas={bombas} showRain={showRain} showLora={showLora} state={state} />
        </Card>
        <Card title="Pueblo piloto · pozos A, B y C" sub="Último estado recibido por la ONG (no la verdad del terreno).">
          <ul className="village-list">
            {WELL_IDS.map((id) => {
              const k = state.cloud[id];
              const d = describeStatus(k.status, k.factors);
              const ui = WELL_UI[k.status];
              return (
                <li key={id}>
                  <KeyShape shape={ui.shape} color={ui.color} />
                  <b>{state.wells[id].name}</b>
                  <span>{d.label}</span>
                  <small>{k.receivedAt >= 0 ? `recibido ${formatClock(k.receivedAt)}` : '—'}</small>
                </li>
              );
            })}
          </ul>
          <h4 className="sub-h">Últimos eventos recibidos</h4>
          <ol className="event-list">
            {cloudEvents.length === 0 && <li className="muted">Ninguno todavía{star ? '' : ' · haz un retiro manual'}</li>}
            {cloudEvents.map((e) => (
              <li key={e.eventId}>
                <time>{formatClock(e.occurredAt)}</time> {state.wells[e.wellId].name}: {e.reason}
              </li>
            ))}
          </ol>
          <p className="fine">Fuente de los datos regionales: {FUENTE}. Foto de 2022 (censo de The Water Trust).</p>
        </Card>
      </div>

      <PriorityTable bombas={bombas} />
      <RainQuality />
      <Predictive wells={villageWells(state.cloud)} defaultRain={rainNow ? 60 : 10} />
      <DataFlow state={state} />
    </div>
  );
}

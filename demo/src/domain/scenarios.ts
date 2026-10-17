// Catálogo de escenarios de la demo (doc 01 §9) + extras del equipo. Cada uno parte de
// RESET con seed fija y avanza con "Siguiente paso de la historia".
import { applyAction, type Action } from './engine';
import type { Phase, SimulationState } from './types';

export interface ScenarioStep {
  label: string;
  narration: string;
  actions: Action[];
}

export interface Scenario {
  id: string;
  code: string;
  title: string;
  summary: string;
  demonstrates: string;
  seed: number;
  /** Fase con la que arranca el escenario. */
  phase: Phase;
  setup: Action[];
  steps: ScenarioStep[];
  featured?: boolean;
}

const lora = (wellId: 'well-1' | 'well-2' | 'well-3', on: boolean): Action => ({ type: 'SET_LINK', target: { kind: 'lora', wellId }, on });
const mesh = (a: 'well-1' | 'well-2' | 'well-3', b: 'well-1' | 'well-2' | 'well-3', on: boolean): Action => ({
  type: 'SET_LINK',
  target: { kind: 'mesh', a, b },
  on,
});

export const SCENARIOS: Scenario[] = [
  {
    id: 'mvp',
    code: '★',
    title: 'Historia MVP: falla, reporte y guardiana',
    summary: 'Una persona va al pozo y falla; reporta con la caja; la señal llega al pueblo y esa franja se pone roja. Una guardiana externa confirma y descubre otra contaminación.',
    demonstrates: 'El flujo humano completo del MVP en ~3 minutos',
    seed: 21,
    phase: 'MVP',
    featured: true,
    setup: [],
    steps: [
      {
        label: 'Todo funciona',
        narration: 'Las tres franjas del semáforo están en verde (círculo izquierdo). Amina va al pozo habilitado más cercano y recoge agua.',
        actions: [{ type: 'SEND_PERSON', personId: 'amina', target: 'AUTO' }],
      },
      {
        label: 'El Pozo B falla sin que nadie lo sepa',
        narration: 'El Pozo B se contamina. En el MVP no hay sensor: el semáforo sigue en verde porque nadie lo ha visto todavía.',
        actions: [{ type: 'QUICK_PRESET', wellId: 'well-2', preset: 'CONTAMINATED' }],
      },
      {
        label: 'Lokol va, falla y reporta',
        narration: 'Lokol llega al Pozo B, nota olor y color extraños, NO bebe y presiona MAL en la caja. La señal viaja por LoRa al pueblo: la franja B pasa a rojo (círculo derecho).',
        actions: [{ type: 'SEND_PERSON', personId: 'lokol', target: 'well-2' }],
      },
      {
        label: 'Nadie más va al Pozo B',
        narration: 'Akai mira el semáforo y va a un pozo con franja verde. Si el operador intenta mandar a Amina al Pozo B, la salida se bloquea.',
        actions: [
          { type: 'SEND_PERSON', personId: 'akai', target: 'AUTO' },
          { type: 'SEND_PERSON', personId: 'amina', target: 'well-2' },
        ],
      },
      {
        label: 'La guardiana externa confirma',
        narration: 'Nasimiyu, guardiana de la ONG (no es del pueblo), llega, toma la muestra y confirma la contaminación. Su alerta queda registrada y firmada.',
        actions: [{ type: 'SEND_PERSON', personId: 'worker', target: 'well-2' }],
      },
      {
        label: 'Revisión de rutina: otra contaminación',
        narration: 'En su ronda revisa el Pozo C, que nadie había reportado, y descubre que también está contaminado. Envía la alerta: la franja C pasa a rojo y la gente deja de ir.',
        actions: [
          { type: 'QUICK_PRESET', wellId: 'well-3', preset: 'CONTAMINATED' },
          { type: 'SEND_PERSON', personId: 'worker', target: 'well-3' },
        ],
      },
      {
        label: 'Las personas usan solo el Pozo A',
        narration: 'Con B y C en rojo, todos van al Pozo A, la única franja verde.',
        actions: [
          { type: 'SEND_PERSON', personId: 'lokol', target: 'AUTO' },
          { type: 'SEND_PERSON', personId: 'akai', target: 'AUTO' },
        ],
      },
      {
        label: 'Retiro manual hacia la ONG',
        narration: 'En el MVP el pueblo no tiene antena hacia la ONG: la guardiana descarga el centro del pueblo y lleva los datos. Aleja el mapa y abre la ONG para ver el dashboard.',
        actions: [{ type: 'MANUAL_EXTRACT' }],
      },
    ],
  },
  {
    id: 'star',
    code: '★★',
    title: 'Historia Fase Estrella: sensores, antena y réplica',
    summary: 'Los sensores informan solos, la antena lleva todo a la ONG en tiempo real y un pozo vecino replica los mensajes cuando se corta un enlace.',
    demonstrates: 'Las características estrella sobre el mismo flujo',
    seed: 22,
    phase: 'STAR',
    featured: true,
    setup: [],
    steps: [
      {
        label: 'El sensor detecta la falta de agua',
        narration: 'El Pozo A se seca: el sensor de nivel lo informa solo, sin esperar a que alguien vaya. La franja A pasa a rojo y la ONG lo ve al instante por la antena.',
        actions: [{ type: 'QUICK_PRESET', wellId: 'well-1', preset: 'NO_WATER' }],
      },
      {
        label: 'Se corta la radio del Pozo C',
        narration: 'Un animal derriba la antena del Pozo C y se le daña la válvula. Sin vecinos al alcance, el evento queda EN COLA: el pueblo no se entera por magia.',
        actions: [
          { type: 'SET_LINK', target: { kind: 'lora', wellId: 'well-3' }, on: false },
          { type: 'SET_LINK', target: { kind: 'mesh', a: 'well-1', b: 'well-3' }, on: false },
          { type: 'SET_LINK', target: { kind: 'mesh', a: 'well-2', b: 'well-3' }, on: false },
          { type: 'QUICK_PRESET', wellId: 'well-3', preset: 'VALVE_DAMAGE' },
        ],
      },
      {
        label: 'Réplica: el Pozo B retransmite',
        narration: 'El Pozo B vuelve a escuchar al C, guarda una copia y la retransmite. Llega vía relevo con ACK, como una réplica estilo Kafka.',
        actions: [{ type: 'SET_LINK', target: { kind: 'mesh', a: 'well-2', b: 'well-3' }, on: true }],
      },
      {
        label: 'Lluvia: ventana de riesgo',
        narration: 'Llueve: durante 15 días las verificaciones previas no sirven. El modelo predictivo de la ONG sube el riesgo y prioriza visitas.',
        actions: [{ type: 'RAIN_START' }],
      },
      {
        label: 'Ronda preventiva de la guardiana',
        narration: 'La guardiana re-verifica los pozos y repara la válvula del C; los pozos aptos vuelven a verde.',
        actions: [{ type: 'WORKER_ROUND' }, { type: 'RESTORE_NETWORK' }],
      },
    ],
  },
  {
    id: 's0',
    code: 'S0',
    title: 'Todo funciona',
    summary: 'Pozos habilitados, enlaces activos. Una persona va al más cercano, recoge agua y vuelve.',
    demonstrates: 'Estado de referencia, ruta y semáforo estable',
    seed: 1,
    phase: 'STAR',
    setup: [],
    steps: [{ label: 'Ir por agua', narration: 'Amina elige el pozo habilitado más cercano según el semáforo.', actions: [{ type: 'SEND_PERSON', personId: 'amina', target: 'AUTO' }] }],
  },
  {
    id: 's1',
    code: 'S1',
    title: 'Detección comunitaria y confirmación',
    summary: 'Una persona nota algo raro, reporta (sospecha) y la trabajadora confirma con prueba simulada.',
    demonstrates: 'Sospecha ≠ confirmación; intervención humana; redirección',
    seed: 2,
    phase: 'STAR',
    setup: [{ type: 'QUICK_PRESET', wellId: 'well-2', preset: 'HIDDEN_CONTAMINATION' }],
    steps: [
      { label: 'Va al Pozo B', narration: 'Amina sale hacia el Pozo B, que el centro conoce como habilitado.', actions: [{ type: 'SEND_PERSON', personId: 'amina', target: 'well-2' }] },
      { label: 'Verificación', narration: 'La trabajadora toma la muestra: resultado positivo simulado → rojo.', actions: [{ type: 'SEND_PERSON', personId: 'worker', target: 'well-2' }] },
      { label: 'Otra persona', narration: 'Lokol ya no es enviado al Pozo B.', actions: [{ type: 'SEND_PERSON', personId: 'lokol', target: 'AUTO' }] },
    ],
  },
  {
    id: 's2',
    code: 'S2',
    title: 'Contaminación + corte de LoRa',
    summary: 'El pozo rojo no puede avisar: el evento queda en cola hasta que vuelve el enlace o la trabajadora lo porta.',
    demonstrates: 'Store-and-forward, sin teletransporte de información',
    seed: 3,
    phase: 'STAR',
    setup: [lora('well-2', false), mesh('well-1', 'well-2', false), mesh('well-2', 'well-3', false)],
    steps: [
      { label: 'Contaminado sin radio', narration: 'Pozo B rojo local; el evento queda QUEUED. El centro conserva la última versión y la marca como antigua.', actions: [{ type: 'QUICK_PRESET', wellId: 'well-2', preset: 'CONFIRMED_POSITIVE' }] },
      { label: 'Ruta B: la trabajadora porta el dato', narration: 'La trabajadora copia el evento por BLE y lo entrega en el centro.', actions: [{ type: 'SEND_PERSON', personId: 'worker', target: 'well-2' }] },
      { label: 'Vuelve LoRa', narration: 'Al reconectar, la cola se drena; el centro reconoce duplicados.', actions: [lora('well-2', true)] },
    ],
  },
  {
    id: 's3',
    code: 'S3',
    title: 'Sin internet, con red local',
    summary: 'El centro recibe por LoRa y cambia; la nube queda «no sincronizada» hasta que vuelve internet.',
    demonstrates: 'Offline-first real: radio local ≠ internet',
    seed: 4,
    phase: 'STAR',
    setup: [{ type: 'SET_LINK', target: { kind: 'cloud' }, on: false }],
    steps: [
      { label: 'Válvula dañada en Pozo C', narration: 'El centro pasa a amarillo; la nube conserva la versión vieja.', actions: [{ type: 'QUICK_PRESET', wellId: 'well-3', preset: 'VALVE_DAMAGE' }] },
      { label: 'Vuelve internet', narration: 'Se sincronizan los eventos sin reprocesar duplicados.', actions: [{ type: 'SET_LINK', target: { kind: 'cloud' }, on: true }] },
    ],
  },
  {
    id: 's4',
    code: 'S4',
    title: 'Sin agua y redirección',
    summary: 'El Pozo A baja de 70 % a 10 % mientras alguien va hacia él.',
    demonstrates: 'No disponible ≠ contaminado',
    seed: 5,
    phase: 'STAR',
    setup: [{ type: 'EDIT_FACTORS', wellId: 'well-1', edit: { waterVolumePct: 70 } }],
    steps: [
      { label: 'Va al Pozo A', narration: 'Amina camina al Pozo A.', actions: [{ type: 'SEND_PERSON', personId: 'amina', target: 'well-1' }] },
      { label: 'Nivel cae a 10 %', narration: 'El sensor de nivel detecta el pozo seco; Amina se detiene y elige otro.', actions: [{ type: 'EDIT_FACTORS', wellId: 'well-1', edit: { waterVolumePct: 10 } }] },
    ],
  },
  {
    id: 's5',
    code: 'S5',
    title: 'Válvula dañada y reparación',
    summary: 'Hay agua y prueba vigente, pero no se puede extraer. La trabajadora repara.',
    demonstrates: 'Agua presente ≠ pozo utilizable',
    seed: 6,
    phase: 'STAR',
    setup: [],
    steps: [
      { label: 'Se daña la válvula', narration: 'Pozo C pasa a «Daño de válvula».', actions: [{ type: 'QUICK_PRESET', wellId: 'well-3', preset: 'VALVE_DAMAGE' }] },
      { label: 'Reparación', narration: 'MAINTENANCE_COMPLETED: vuelve a habilitado solo porque la prueba sigue vigente.', actions: [{ type: 'WORKER_REPAIR', wellId: 'well-3' }] },
    ],
  },
  {
    id: 's6',
    code: 'S6',
    title: 'Pérdida de paquete, reintento y ACK',
    summary: 'El primer intento se pierde; el reintento llega. Luego un ACK perdido provoca un duplicado que se descarta.',
    demonstrates: 'Transporte tolerante a pérdidas',
    seed: 7,
    phase: 'STAR',
    setup: [],
    steps: [
      { label: 'Paquete perdido', narration: 'La alerta del Pozo B cae en el primer intento y se reintenta con backoff.', actions: [{ type: 'DROP_NEXT', wellId: 'well-2' }, { type: 'QUICK_PRESET', wellId: 'well-2', preset: 'CONFIRMED_POSITIVE' }] },
      { label: 'ACK perdido', narration: 'El centro recibe, pero su ACK se pierde: el pozo reenvía y el centro deduplica.', actions: [{ type: 'DROP_NEXT_ACK', wellId: 'well-1' }, { type: 'QUICK_PRESET', wellId: 'well-1', preset: 'VALVE_DAMAGE' }] },
    ],
  },
  {
    id: 's7',
    code: 'S7',
    title: 'Orden invertido',
    summary: 'seq N+1 llega antes que seq N; el centro no retrocede a un estado viejo.',
    demonstrates: 'Orden, idempotencia y seguridad',
    seed: 8,
    phase: 'STAR',
    setup: [],
    steps: [{ label: 'Inyectar', narration: 'Se registra IGNORED_STALE_EVENT y se conserva el estado más nuevo.', actions: [{ type: 'INJECT_OUT_OF_ORDER', wellId: 'well-2' }] }],
  },
  {
    id: 's8',
    code: 'S8',
    title: 'Verificación vencida / falla eléctrica',
    summary: 'La prueba del Pozo A vence → sin verificar. Luego se agota la batería.',
    demonstrates: 'Fail-safe y honestidad del estado',
    seed: 9,
    phase: 'STAR',
    setup: [{ type: 'EDIT_FACTORS', wellId: 'well-1', edit: { waterTest: 'VALID_NEGATIVE', validityDays: 3 } }],
    steps: [
      { label: 'Esperar vencimiento', narration: 'Tras 3 días simulados (~12 s) el Pozo A pasa a «Sin verificar».', actions: [] },
      { label: 'Batería agotada', narration: 'El indicador se apaga: placa pasiva «sin información», nunca verde.', actions: [{ type: 'SET_LINK', target: { kind: 'wellPower', wellId: 'well-1' }, on: false }] },
      { label: 'Vuelve la energía', narration: 'Restaura registros, pero no marca verde sin una verificación vigente.', actions: [{ type: 'SET_LINK', target: { kind: 'wellPower', wellId: 'well-1' }, on: true }] },
    ],
  },
  {
    id: 's9',
    code: 'S9',
    title: 'Todos los pozos indisponibles',
    summary: 'Sin agua, contaminado y válvula dañada a la vez: centro rojo y nadie sale.',
    demonstrates: 'Agregación y límites honestos',
    seed: 10,
    phase: 'STAR',
    setup: [],
    steps: [
      {
        label: 'Tres fallas',
        narration: 'Al recibirse los tres eventos el centro pasa a rojo.',
        actions: [
          { type: 'QUICK_PRESET', wellId: 'well-1', preset: 'NO_WATER' },
          { type: 'QUICK_PRESET', wellId: 'well-2', preset: 'CONFIRMED_POSITIVE' },
          { type: 'QUICK_PRESET', wellId: 'well-3', preset: 'VALVE_DAMAGE' },
        ],
      },
      { label: 'Intentar salir', narration: 'Nadie es enviado a un pozo «menos malo»: esperan y piden asistencia.', actions: [{ type: 'SEND_PERSON', personId: 'amina', target: 'AUTO' }, { type: 'SEND_PERSON', personId: 'lokol', target: 'AUTO' }] },
    ],
  },
  {
    id: 's10',
    code: 'S10',
    title: 'Lluvia: ventana crítica de 15 días',
    summary: 'Tras la lluvia las verificaciones previas no sirven: todo «sin verificar» hasta que la trabajadora re-verifica.',
    demonstrates: 'Regla estacional del equipo (arrastre de heces)',
    seed: 12,
    phase: 'STAR',
    setup: [],
    steps: [
      { label: 'Llueve', narration: 'El pluviómetro abre la ventana de 15 días: los pozos pasan a «Sin verificar».', actions: [{ type: 'RAIN_START' }] },
      { label: 'Re-verificación', narration: 'La trabajadora recorre los tres pozos; cada prueba negativa posterior a la lluvia rehabilita.', actions: [{ type: 'WORKER_ROUND' }] },
      { label: 'Gente vuelve a salir', narration: 'Con pozos verificados, el semáforo vuelve a guiar.', actions: [{ type: 'SEND_PERSON', personId: 'amina', target: 'AUTO' }] },
    ],
  },
  {
    id: 's11',
    code: 'S11',
    title: 'Visita semanal de la trabajadora',
    summary: 'Recorre los pozos, descubre una contaminación que nadie reportó y porta datos de un pozo sin radio.',
    demonstrates: 'Verificación periódica + humano como portador (ruta B)',
    seed: 13,
    phase: 'STAR',
    setup: [
      { type: 'QUICK_PRESET', wellId: 'well-3', preset: 'HIDDEN_CONTAMINATION' },
      lora('well-1', false),
      mesh('well-1', 'well-2', false),
      mesh('well-1', 'well-3', false),
    ],
    steps: [
      { label: 'Falla sin radio', narration: 'El Pozo A se queda sin agua pero no puede avisar: queda en cola.', actions: [{ type: 'QUICK_PRESET', wellId: 'well-1', preset: 'NO_WATER' }] },
      { label: 'Visita semanal', narration: 'La trabajadora verifica los tres pozos, copia la cola del Pozo A por BLE y sincroniza en el centro.', actions: [{ type: 'WORKER_ROUND' }] },
    ],
  },
  {
    id: 's12',
    code: 'S12',
    title: 'Testigo / relevo entre pozos',
    summary: 'El Pozo A pierde su enlace directo; el Pozo C lo escucha y retransmite. El centro sabe que sigue vivo.',
    demonstrates: 'Replicación estilo Kafka adaptada a radio',
    seed: 14,
    phase: 'STAR',
    setup: [lora('well-1', false), mesh('well-1', 'well-2', false)],
    steps: [
      { label: 'Falla en Pozo A', narration: 'El evento sale hacia el centro, no llega directo, pero el Pozo C lo escucha y lo retransmite.', actions: [{ type: 'QUICK_PRESET', wellId: 'well-1', preset: 'NO_WATER' }] },
      { label: 'Sin testigo', narration: 'Ahora tampoco hay vecino: el centro marca «sin señal» y sugiere enviar a la trabajadora.', actions: [mesh('well-1', 'well-3', false)] },
      { label: 'Restablecer', narration: 'Vuelve el enlace directo.', actions: [lora('well-1', true), mesh('well-1', 'well-3', true)] },
    ],
  },
  {
    id: 's13',
    code: 'S13',
    title: 'Caja comunitaria BIEN / MAL',
    summary: 'BIEN se guarda como evidencia y no habilita; MAL crea sospecha; solo la verificación devuelve el verde.',
    demonstrates: 'Asimetría de la verificación',
    seed: 15,
    phase: 'STAR',
    setup: [],
    steps: [
      { label: 'MAL', narration: 'Alguien presiona MAL en el Pozo B → sospecha (amarillo).', actions: [{ type: 'COMMUNITY_REPORT', wellId: 'well-2', kind: 'BAD' }] },
      { label: 'BIEN ×2', narration: 'Dos personas presionan BIEN: no cambia el color.', actions: [{ type: 'COMMUNITY_REPORT', wellId: 'well-2', kind: 'GOOD' }, { type: 'COMMUNITY_REPORT', wellId: 'well-2', kind: 'GOOD' }] },
      { label: 'Verificación', narration: 'La prueba negativa de la trabajadora devuelve el verde.', actions: [{ type: 'SEND_PERSON', personId: 'worker', target: 'well-2' }] },
    ],
  },
];

export function findScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((x) => x.id === id);
}

export function loadScenario(id: string): SimulationState {
  const sc = findScenario(id);
  if (!sc) throw new Error(`escenario desconocido ${id}`);
  let s = applyAction({} as SimulationState, { type: 'RESET', seed: sc.seed, phase: sc.phase });
  for (const a of sc.setup) s = applyAction(s, a);
  s = applyAction(s, { type: 'SET_SCENARIO', scenario: { id, stepIndex: 0 } });
  return s;
}

export function runNextStep(s: SimulationState): SimulationState {
  if (!s.scenario) return s;
  const sc = findScenario(s.scenario.id);
  const step = sc?.steps[s.scenario.stepIndex];
  if (!sc || !step) return s;
  let out = s;
  for (const a of step.actions) out = applyAction(out, a);
  return applyAction(out, { type: 'SET_SCENARIO', scenario: { id: sc.id, stepIndex: s.scenario.stepIndex + 1 } });
}

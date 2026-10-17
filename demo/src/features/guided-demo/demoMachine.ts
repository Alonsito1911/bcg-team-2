// Contrato compartido de la DEMO GUIADA (teléfono ↔ backend ↔ notebook).
// Archivo PURO y sin imports: lo usan el servidor (demo/server), el control del
// teléfono y la pantalla de presentación. La sincronización real teléfono↔notebook
// pasa por el backend; la propagación LoRa/MQTT/ONG que se ve en pantalla es SIMULADA.

export interface DemoStep {
  id: string;
  title: string;
  narration: string;
  /** Etiqueta del botón central del teléfono en este paso (null = solo flechas). */
  phoneAction: string | null;
}

export const DEMO_STEPS: readonly DemoStep[] = [
  {
    id: 'village',
    title: 'Tres pozos, una comunidad',
    narration: 'Los tres pozos funcionan y el semáforo del pueblo está en verde.',
    phoneAction: 'Iniciar recorrido',
  },
  {
    id: 'walk',
    title: 'La guardiana va al Pozo B',
    narration: 'Nasimiyu, guardiana de la ONG (no es del pueblo), camina al Pozo B para su revisión.',
    phoneAction: null,
  },
  {
    id: 'test',
    title: 'Prueba en el Pozo B',
    narration: 'Toma una muestra: la prueba microbiológica SIMULADA da positivo para E. coli. El pueblo aún no lo sabe.',
    phoneAction: null,
  },
  {
    id: 'report',
    title: 'Reportar desde el teléfono',
    narration: 'Esperando que la guardiana confirme el reporte desde su teléfono…',
    phoneAction: 'Reportar contaminación',
  },
  {
    id: 'village-alert',
    title: 'La alerta llega al pueblo',
    narration: 'La señal viaja por radio (simulada) al semáforo: la franja B pasa a rojo y nadie va a ese pozo.',
    phoneAction: null,
  },
  {
    id: 'ngo-alert',
    title: 'La alerta llega a la ONG',
    narration: 'Desde el centro del pueblo la alerta viaja por la torre (simulada) hasta la ONG regional.',
    phoneAction: null,
  },
  {
    id: 'ngo-dashboard',
    title: 'La ONG actúa',
    narration: 'El dashboard de la ONG muestra la alerta del Pozo B, el pueblo afectado y las acciones sugeridas.',
    phoneAction: 'Reiniciar demo',
  },
] as const;

export const LAST_STEP = DEMO_STEPS.length - 1;
/** Único paso donde el botón físico del teléfono es obligatorio para avanzar. */
export const REPORT_STEP = DEMO_STEPS.findIndex((s) => s.id === 'report');

export interface DemoSnapshot {
  room: string;
  epoch: number;
  step: number;
  revision: number;
  reported: boolean;
  reportEventId: string | null;
  reportedAt: string | null;
  controllerSeenAt: string | null;
  updatedAt: string;
}

export type DemoCommandType = 'NEXT' | 'PREV' | 'REPORT_CONTAMINATION' | 'RESET';

export interface DemoCommandRequest {
  commandId: string;
  type: DemoCommandType;
  expectedRevision: number;
  token: string;
}

export type DemoError = 'CONFLICT' | 'INVALID_TRANSITION' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'BAD_REQUEST' | 'RATE_LIMITED';

export interface DemoCommandResponse {
  ok: boolean;
  snapshot: DemoSnapshot | null;
  error?: DemoError;
  /** El mismo commandId ya se había aplicado (reintento idempotente). */
  duplicate?: boolean;
}

export interface CreateSessionResponse {
  room: string;
  controllerToken: string;
  snapshot: DemoSnapshot;
}

export interface DemoEventRecord {
  id: string;
  room: string;
  epoch: number;
  type: 'CONTAMINATION_REPORT_ACCEPTED';
  wellId: 'well-2';
  source: 'FIELD_WORKER_SIMULATED';
  createdAt: string;
}

export function initialSnapshot(room: string, now: string): DemoSnapshot {
  return { room, epoch: 1, step: 0, revision: 0, reported: false, reportEventId: null, reportedAt: null, controllerSeenAt: null, updatedAt: now };
}

/** ¿Se puede aplicar este comando sobre este estado? (lo usan servidor y botones del teléfono) */
export function canApply(s: DemoSnapshot, type: DemoCommandType): boolean {
  switch (type) {
    case 'NEXT':
      return s.step < LAST_STEP && !(s.step === REPORT_STEP && !s.reported);
    case 'PREV':
      return s.step > 0;
    case 'REPORT_CONTAMINATION':
      return s.step === REPORT_STEP && !s.reported;
    case 'RESET':
      return true;
  }
}

/**
 * Transición pura. `newEventId` solo se usa si el comando crea el evento de reporte.
 * Devuelve el nuevo snapshot y el evento creado (si corresponde), o null si es ilegal.
 */
export function applyDemoCommand(
  s: DemoSnapshot,
  type: DemoCommandType,
  now: string,
  newEventId: string,
): { snapshot: DemoSnapshot; event: DemoEventRecord | null } | null {
  if (!canApply(s, type)) return null;
  const base = { ...s, revision: s.revision + 1, updatedAt: now };
  switch (type) {
    case 'NEXT':
      return { snapshot: { ...base, step: s.step + 1 }, event: null };
    case 'PREV':
      // Volver atrás NO borra un reporte ya persistido (replay visual).
      return { snapshot: { ...base, step: s.step - 1 }, event: null };
    case 'REPORT_CONTAMINATION': {
      const event: DemoEventRecord = {
        id: newEventId,
        room: s.room,
        epoch: s.epoch,
        type: 'CONTAMINATION_REPORT_ACCEPTED',
        wellId: 'well-2',
        source: 'FIELD_WORKER_SIMULATED',
        createdAt: now,
      };
      return { snapshot: { ...base, step: s.step + 1, reported: true, reportEventId: newEventId, reportedAt: now }, event };
    }
    case 'RESET':
      return {
        snapshot: { ...base, epoch: s.epoch + 1, step: 0, reported: false, reportEventId: null, reportedAt: null },
        event: null,
      };
  }
}

/**
 * Bomba real del dataset del equipo (WPDx, Kiryandongo) que representa al Pozo B del
 * pueblo piloto en el dashboard de la ONG. La alerta sobre ella es SIMULADA.
 */
export const PILOT_PUMP = { wpdxId: '6GHJW47Q+VXW', codigo: 'KIR-0005', lugar: 'Bweyale' } as const;

/** La ONG "conoce" la alerta solo cuando la historia llegó a ese punto (y vuelve a normal al retroceder o reiniciar). */
export function ongKnowsAlert(s: DemoSnapshot | null): boolean {
  const ongStep = DEMO_STEPS.findIndex((x) => x.id === 'ngo-alert');
  return !!s && s.reported && s.step >= ongStep;
}

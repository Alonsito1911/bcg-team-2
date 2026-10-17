// Dashboard de la ONG del equipo (src/mapa_prioridad.py → output/prioridad_kiryandongo.html),
// servido SIN modificar. Ese HTML consulta `estado.json` cada 3 s (en Azure lo escribe la
// Function); aquí lo generamos desde la sesión de la demo con el MISMO formato que
// src/iot/reglas.py, para que el dashboard se actualice solo en ambos sentidos.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ongKnowsAlert, PILOT_PUMP, type DemoSnapshot } from '../src/features/guided-demo/demoMachine.ts';

export function ongHtmlPath(demoRoot: string): string {
  return resolve(demoRoot, '..', 'output', 'prioridad_kiryandongo.html');
}

export function readOngHtml(demoRoot: string): string | null {
  const p = ongHtmlPath(demoRoot);
  return existsSync(p) ? readFileSync(p, 'utf-8') : null;
}

/** estado.json con la forma de reglas.nuevo_estado()/procesar(). */
export function buildEstado(snapshot: DemoSnapshot | null): Record<string, unknown> {
  const alert = ongKnowsAlert(snapshot);
  const ts = (snapshot?.reportedAt ?? snapshot?.updatedAt ?? new Date().toISOString()).slice(0, 19);
  const bomba = {
    codigo: PILOT_PUMP.codigo,
    // Siempre se incluye la bomba: así, al reiniciar, el dashboard vuelve a pintarla normal.
    estado: alert ? 'riesgo_contaminacion' : 'normal',
    dia: ts.slice(0, 10),
    litros_dia: 3800,
    horas_sin_uso: 0,
    turbidez: alert ? 6.2 : 0.8,
    bateria: 0.82,
    ultimo: ts,
  };
  const alertas = alert
    ? [
        {
          ts,
          pozo_id: PILOT_PUMP.wpdxId,
          codigo: PILOT_PUMP.codigo,
          tipo: 'riesgo_contaminacion',
          anterior: 'normal',
          sms: true,
          mensaje:
            'Pozo B del pueblo piloto (demo): contaminación confirmada por la guardiana con prueba SIMULADA de E. coli. ' +
            'Pozo bloqueado en el semáforo; avisar al comité de agua, clorar y volver a probar.',
        },
      ]
    : [];
  return {
    bombas: { [PILOT_PUMP.wpdxId]: bomba },
    alertas,
    actualizado: ts,
    eventos: snapshot ? snapshot.revision : 0,
    demo: { room: snapshot?.room ?? null, simulado: true },
  };
}

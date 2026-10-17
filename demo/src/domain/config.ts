// Constantes de DEMO. No son recomendaciones de salud, hidráulica ni valores oficiales (doc 01 §2.3).

export const DEMO_CONFIG = {
  dryVolumeThresholdPct: 15, // por debajo = NO_WATER
  lowReserveThresholdPct: 35, // 15–34 % = ENABLED + reserva baja
  minCollectibleVolumePct: 15,
  demoLoRaLatencyMs: 900, // SOLO visualización
  demoBleLatencyMs: 350,
  demoGatewayToCloudLatencyMs: 700,
  demoCarriedLatencyMs: 600,
  retryDelaysMs: [1500, 3000, 6000, 10000],
  demoFreshnessWarningSeconds: 25, // SOLO para acelerar pruebas de UI
  heartbeatEveryMs: 5000,

  /** Reloj comprimido: 1 día simulado = 4 s de demo a 1x. */
  dayMs: 4000,
  /** Ventana crítica tras la lluvia (pedido del equipo). */
  rainWindowDays: 15,
  /** Vigencia por defecto de una verificación (configurable por pozo). */
  testValidityDays: 90,

  /** Recolección simbólica. */
  collectLiters: 20,
  demoCapacityLiters: 1000,

  walkSpeed: 9, // unidades de escena por segundo (escena 160×90)
  collectMs: 2200,
  observeMs: 1600,
  reportMs: 1200,
  inspectMs: 2600,
  repairMs: 3000,
  rerouteMs: 900,
  syncMs: 1200,

  maxLog: 250,
} as const;

export type DemoConfig = typeof DEMO_CONFIG;

export const DISCLAIMER = 'Datos simulados — no usar para evaluar agua real';

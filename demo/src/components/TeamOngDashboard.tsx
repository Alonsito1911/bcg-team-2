import { useEffect, useState, type ReactNode } from 'react';

/**
 * Dashboard de análisis de la ONG hecho por el equipo (src/mapa_prioridad.py), servido sin
 * cambios por demo/server en /ong/<sala>/. Ese HTML consulta estado.json cada 3 s, así que
 * refleja la demo en vivo (alerta del Pozo B y vuelta a normal) sin recargar.
 * Si no hay servidor (p. ej. el HTML suelto de dist-single), se usa `fallback`.
 */
export function TeamOngDashboard({ room, onBack, backLabel, banner, fallback }: { room: string; onBack: () => void; backLabel: string; banner?: ReactNode; fallback: ReactNode }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/ong/${room}/estado.json`, { cache: 'no-store' })
      .then((r) => !cancelled && setAvailable(r.ok && (r.headers.get('content-type') ?? '').includes('json')))
      .catch(() => !cancelled && setAvailable(false));
    return () => {
      cancelled = true;
    };
  }, [room]);

  if (available === false) return <>{fallback}</>;
  return (
    <div className="team-ong">
      <header className="team-ong-bar">
        <button type="button" onClick={onBack}>
          {backLabel}
        </button>
        <b>Centro regional ONG · análisis de prioridad de bombas (Kiryandongo)</b>
        <span className="team-ong-live">● en vivo · se actualiza cada 3 s</span>
      </header>
      {banner}
      {available && <iframe className="team-ong-frame" src={`/ong/${room}/`} title="Dashboard de la ONG" />}
    </div>
  );
}

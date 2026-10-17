import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import './remote.css';
import type { DemoSnapshot } from './demoMachine';
import type { DemoConnectionStatus } from './api/demoClient';

export interface PairingPanelProps {
  room: string;
  controllerToken: string | null;
  snapshot: DemoSnapshot | null;
  status: DemoConnectionStatus;
}

const PHONE_FRESH_MS = 25_000;

function controlUrl(room: string, token: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?demo=${encodeURIComponent(room)}&role=controller&k=${encodeURIComponent(token)}`;
}

const STATUS_TEXT: Record<DemoConnectionStatus, string> = {
  connecting: 'Conectando con el servidor…',
  live: 'Servidor en vivo',
  polling: 'Reconectando (consultando cada 1 s)…',
  offline: 'Sin conexión con el servidor',
};

export function PairingPanel({ room, controllerToken, snapshot, status }: PairingPanelProps) {
  const url = controllerToken ? controlUrl(room, controllerToken) : null;
  const [qr, setQr] = useState<{ url: string; data: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 1, width: 280, errorCorrectionLevel: 'M', color: { dark: '#3A2C26', light: '#FFF9ED' } })
      .then((data) => {
        if (!cancelled) setQr({ url, data });
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const seenAt = snapshot?.controllerSeenAt ? Date.parse(snapshot.controllerSeenAt) : NaN;
  const phoneConnected = Number.isFinite(seenAt) && Math.max(now, Date.now()) - seenAt < PHONE_FRESH_MS;
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (collapsed) {
    return (
      <button type="button" className="gd-pairing-chip" onClick={() => setCollapsed(false)} aria-label="Mostrar el QR para emparejar el teléfono">
        <span className={`gd-pairing-chip__dot${phoneConnected ? ' ok' : ''}`} aria-hidden="true" />
        📱 Sala {room} · {phoneConnected ? 'teléfono conectado' : 'mostrar QR'} ▸
      </button>
    );
  }

  return (
    <section className="gd-pairing gd-pairing--compact" aria-label="Emparejar teléfono de control" data-url={url ?? undefined}>
      <button type="button" className="gd-pairing__min" onClick={() => setCollapsed(true)} aria-label="Minimizar">
        –
      </button>
      {url && (
        <div className="gd-pairing__qr">
          {qr && qr.url === url ? (
            <img src={qr.data} width={132} height={132} alt={`Código QR para controlar la sala ${room} desde el teléfono`} />
          ) : (
            <div className="gd-pairing__qr-placeholder">Generando QR…</div>
          )}
        </div>
      )}
      <div className="gd-pairing__info">
        <span className="gd-pairing__label">Controlar desde el teléfono</span>
        <span className="gd-pairing__room">{room}</span>
        <p className={`gd-pairing__phone${phoneConnected ? ' gd-pairing__phone--ok' : ''}`} role="status" aria-live="polite">
          {phoneConnected ? 'Teléfono conectado ✓' : 'Esperando al teléfono…'}
        </p>
        {url && (
          <button type="button" className="gd-pairing__copy" onClick={() => void copy()}>
            {copied ? 'Enlace copiado ✓' : 'Copiar enlace'}
          </button>
        )}
        <small className={`gd-pairing__server gd-pairing__server--${status}`}>{STATUS_TEXT[status]}</small>
        {url && <small className="gd-pairing__note">Solo para el teléfono del presentador: incluye la clave de control.</small>}
        {isLocal && <small className="gd-pairing__warn">En localhost el teléfono no llega: usa la URL pública (túnel).</small>}
      </div>
    </section>
  );
}

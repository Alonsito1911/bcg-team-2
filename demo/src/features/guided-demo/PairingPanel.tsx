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
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: 'M', color: { dark: '#3A2C26', light: '#FFF9ED' } })
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

  return (
    <section className="gd-pairing" aria-label="Emparejar teléfono de control">
      <div className="gd-pairing__head">
        <span className="gd-pairing__label">Sala</span>
        <span className="gd-pairing__room">{room}</span>
      </div>

      {url && (
        <>
          <div className="gd-pairing__qr">
            {qr && qr.url === url ? (
              <img src={qr.data} width={240} height={240} alt={`Código QR para controlar la sala ${room} desde el teléfono`} />
            ) : (
              <div className="gd-pairing__qr-placeholder">Generando QR…</div>
            )}
          </div>
          <div className="gd-pairing__link">
            <input type="text" readOnly value={url} aria-label="Enlace de control" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" onClick={() => void copy()}>
              {copied ? 'Copiado ✓' : 'Copiar'}
            </button>
          </div>
          <p className="gd-pairing__note">Escanéalo solo desde el teléfono del presentador (incluye la clave de control).</p>
        </>
      )}

      <p className={`gd-pairing__phone${phoneConnected ? ' gd-pairing__phone--ok' : ''}`} role="status" aria-live="polite">
        {phoneConnected ? 'Teléfono conectado ✓' : 'Esperando al teléfono…'}
      </p>
      <p className={`gd-pairing__server gd-pairing__server--${status}`}>{STATUS_TEXT[status]}</p>

      {isLocal && (
        <p className="gd-pairing__warn">Para usar el teléfono abre la app desde la URL pública (túnel HTTPS).</p>
      )}
    </section>
  );
}

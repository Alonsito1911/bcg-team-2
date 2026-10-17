# Backend de la demo guiada (teléfono ↔ notebook)

Servidor Node sin dependencias (node:http + node:sqlite). Persiste sesiones, comandos
(idempotencia) y eventos en SQLite y empuja cambios a la pantalla por Server-Sent Events.
También sirve `dist/` en el mismo origen, así una sola URL entrega app + API.

## Correr

```bash
cd demo
npm run demo:serve        # build + servidor en http://localhost:8787
# o, si dist/ ya está generado:
npm run server
```

Variables: `PORT` (default 8787), `DEMO_DB` (default `server/data/demo.db`, relativo a `demo/`),
`DEMO_RATE_LIMIT` (default 20 comandos / 10 s por sala). Requiere Node ≥ 22.16.

Desarrollo con Vite: `npm run server` en una terminal y `npm run dev` en otra
(Vite hace proxy de `/api` a `localhost:8787`).

## API

- `POST /api/demo/sessions` → 201 `{ room, controllerToken, snapshot }` (expira en 12 h)
- `GET /api/demo/sessions/:room` → `{ snapshot, events }` (eventos del epoch actual)
- `POST /api/demo/sessions/:room/commands` `{ commandId, type, expectedRevision, token }`
  → 200 / 400 / 401 / 404 / 409 / 422 / 429
- `POST /api/demo/sessions/:room/heartbeat` `{ token }` → `{ snapshot }`
- `GET /api/demo/sessions/:room/stream` → SSE (`event: snapshot`, `: ping` cada 15 s)
- `GET /api/health` → `{ ok: true }`

## Publicarlo con HTTPS (túnel gratuito de Cloudflare)

El teléfono necesita HTTPS público. Sin cuenta:

```bash
mkdir -p ~/.local/bin
curl -L -o ~/.local/bin/cloudflared \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x ~/.local/bin/cloudflared

npm run demo:serve                                  # terminal 1
~/.local/bin/cloudflared tunnel --url http://localhost:8787   # terminal 2
```

`cloudflared` imprime una URL `https://<algo>.trycloudflare.com`: ábrela en el notebook y
escanea el QR con el teléfono. La URL cambia en cada ejecución del túnel.

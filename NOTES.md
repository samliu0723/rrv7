## Project Notes — RRV7 RS485 Controller

**Start Command**
- Run on Pi: `PORT=3000 RS485_PORTS=/dev/rs485-1,/dev/rs485-2 RS485_DEFAULT_BAUD=9600 npm start`
- Visit UI: `http://raspberrypi5.local:3000`

**Deploy From Mac → Pi**
- Rsync upload (recommended): `rsync -avz --delete --exclude .git --exclude node_modules --exclude build . admin@raspberrypi5.local:~/rrv7`
- On Pi: `cd ~/rrv7 && npm ci && npm run build`
- Start: `PORT=3000 RS485_PORTS=/dev/rs485-1,/dev/rs485-2 RS485_DEFAULT_BAUD=9600 npm start`

**Environment Variables**
- `RS485_PORTS`: Comma‑separated device paths (default `/dev/rs485-1,/dev/rs485-2`).
- `RS485_DEFAULT_BAUD`: Default baud (e.g., `9600`).
- `SSE_HEARTBEAT_MS`: Keepalive interval for SSE (default `15000`).

**API (Postman)**
- Base URL: `http://raspberrypi5.local:3000`
- List ports: `GET /api/ports`
- Open port: `POST /api/ports/:id/open` body `{ "baudRate": 9600 }`
- Write text: `POST /api/ports/:id/write` body `{ "text": "HELLO\r\n" }`
- Write hex: `POST /api/ports/:id/write` body `{ "hex": "48 45 4c 4c 4f 0d 0a" }`
- Close port: `POST /api/ports/:id/close`
- Stream (SSE): `GET /api/ports/:id/stream` (use browser or `curl -N`)

**SSE Testing Tips**
- The stream shows `event: status` once and `: ping` heartbeats until data arrives.
- Data lines emit on newline: ensure writes end with `\r\n` or `\n`.
- Open the stream first, then write to the same port to see events.

**RS485 Loopback Test (single adapter)**
- Wiring: Connect `rs485-1` A↔`rs485-2` A, B↔B. Ensure termination (120 Ω across A/B on one end; many adapters have a DIP/switch).
- Steps:
  1) Open both ports at the same baud (e.g., 9600).
  2) Start SSE on `rs485-2`: `http://raspberrypi5.local:3000/api/ports/rs485-2/stream`.
  3) Send text from `rs485-1` via Postman: `{ "text": "TEST\r\n" }`.
  4) Expect `event: data` lines in the stream with `TEST`.
- If no data: verify A/B aren’t swapped, enable termination, and confirm newline.

**Udev Symlinks (done)**
- Stable paths: `/dev/rs485-1 → ttyACM1` (USB interface 02), `/dev/rs485-2 → ttyACM2` (USB interface 04)
- Rules file on Pi: `/etc/udev/rules.d/99-rs485.rules`

**Optional: systemd Service (sketch)**
- `/etc/systemd/system/rrv7.service`:
  - `[Unit] Description=RRV7 RS485 Controller` and `After=network.target`
  - `[Service] User=admin` and `WorkingDirectory=/home/admin/rrv7`
  - `Environment=NODE_ENV=production`
  - `Environment=PORT=3000`
  - `Environment=RS485_PORTS=/dev/rs485-1,/dev/rs485-2`
  - `Environment=RS485_DEFAULT_BAUD=9600`
  - `ExecStart=/usr/bin/env bash -lc 'npm start --silent'`
  - `Restart=on-failure`
  - `[Install] WantedBy=multi-user.target`
- Enable: `sudo systemctl daemon-reload && sudo systemctl enable --now rrv7 && systemctl status rrv7`

**Recommended Dev Workflow (fast refresh)**
- Edit on the Pi via VS Code Remote-SSH (best):
  - Install VS Code “Remote - SSH” extension.
  - Add host: `Host rpi5` / `HostName raspberrypi5.local` / `User admin` in `~/.ssh/config`.
  - Connect to `rpi5`, open folder `/home/admin/rrv7`.
  - Run: `npm run dev` (dev server binds to LAN, port 5173).
  - Browse: `http://raspberrypi5.local:5173` (HMR + server reload).
- Or, start dev on Pi from Mac: `./scripts/dev-pi.sh` (with `TUNNEL=1` to forward to `http://localhost:5173`).
- If you prefer syncing from Mac: `./scripts/deploy-pi.sh` for one-off; consider `fswatch` or a git workflow for continuous sync.

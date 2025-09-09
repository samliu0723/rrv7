# TODO — Raspberry Pi RS485 Controller (React Router v7)

Project to control two RS485 ports on a Raspberry Pi 5 over the local network. Hardware: MCUzone PCIe→USB serial converter exposing two CDC-ACM devices (`/dev/ttyACM1`, `/dev/ttyACM2`). UI built with React Router v7; backend service handles serial I/O.

## Goals

- [ ] Control two RS485 ports from any device on same Wi‑Fi.
- [ ] Stable device naming, reliable open/close, and safe send/receive.
- [ ] Real‑time logs/stream of serial data to the UI.
- [ ] Mobile‑friendly UI with minimal latency and clear feedback.

## Hardware & OS Prep

- [✓] Confirm devices present: `ls -l /dev/ttyACM*` on the Pi.
- [✓] Add user to `dialout` (or appropriate) group for serial access.
- [✓] Install Node.js (LTS) on Raspberry Pi 5 (arm64).
- [✓] Enable mDNS (Avahi) so the UI is reachable at `http://raspberrypi.local`.

## Stable Serial Port Naming

- [✓] Create `udev` rules to assign persistent symlinks (e.g., `/dev/rs485-1`, `/dev/rs485-2`) based on VID/PID/serial. (Verified: `/dev/rs485-1 -> ttyACM1`, `/dev/rs485-2 -> ttyACM2`)
- [ ] Document how to discover attributes: `udevadm info --attribute-walk -n /dev/ttyACM1`.
- [✓] Update backend config to use the stable names instead of `ttyACM{N}` (`RS485_PORTS` defaults to `/dev/rs485-1,/dev/rs485-2`).

## Backend (RRv7 Framework)

- [✓] Use `serialport` package in server‑only modules (`app/server/serial.ts`).
- [✓] Implement RRv7 route loaders/actions for: list ports, open/close, write.
- [✓] Streaming: Server‑Sent Events route (`/api/ports/:id/stream`) for live serial data.
- [ ] Add optional endpoints: flush, drain, set baud at runtime.
- [ ] Add `app/server/serial.ts` manager: single‑writer, multi‑reader; guard concurrent opens.
- [ ] RS485 specifics: verify half‑duplex direction (RTS) handling if required by adapter.
- [ ] Timeouts/retry: safe reopen on disconnect; backoff on failures.
- [ ] Input validation: whitelist baud/parity/data bits; size caps; rate limiting.
- [ ] Logging: per‑port ring buffer; optional file logs with rotation.
- [ ] Config: env vars for default baud, allowed ports, SSE heartbeat interval.

## Frontend (RRv7) UI

- [ ] Routes: Home, Ports list, Port detail (console), Settings.
- [ ] Port list: show `/dev/rs485-1`, `/dev/rs485-2`, status, open/close.
- [ ] Port console: live log view, send line/hex, quick presets, clear, download log.
- [ ] Settings: baud/parity/data bits/stop bits; save per‑port preferences (localStorage).
- [ ] Connection status indicators and error toasts.
- [ ] Mobile‑first design; responsive console with sticky input; accessible controls.

## Networking & Access

- [ ] Bind backend to LAN interface; configure port (e.g., `:8080`).
- [ ] Serve the SPA and backend under same origin or configure CORS.
- [ ] Optional: reverse proxy via `nginx` for TLS and `/api` proxying.
- [ ] Optional: mDNS service type for discovery; show connect hint in UI.

## Security & Safety

- [ ] Local network only by default; warn about exposure if WAN‑reachable.
- [ ] Simple auth (shared token) optional; store server‑side, not in client code.
- [ ] Command limits: max write length, throttle rapid sends, newline normalization.
- [ ] Safe defaults: ports closed on server start; auto‑close idle sessions.

## Observability

- [ ] Health endpoint (`/healthz`) with serial status snapshot.
- [ ] Metrics counters (opens, write bytes, errors); simple JSON or Prometheus.
- [ ] Debug mode toggle for verbose serial logs.

## Packaging & Startup

- [ ] `systemd` service to start backend on boot (user or system service).
- [ ] Environment file for config (`/etc/default/rrv7-serial` or `.env`).
- [ ] Build step for frontend; static assets served by backend or separate.
- [ ] Optional: Dockerfile for ARM64; compose file for easy deploy.

## Testing & Validation

- [ ] Loopback test plan (short A/B as applicable or fixture).
- [ ] Simulated device input for UI/WS without hardware (mock mode).
- [ ] Latency test: measure end‑to‑end from send to receive.
- [ ] Error injection: unplug device, permission denied, write overflow.

## Documentation

- [ ] Quick start: install, configure, run on Pi; first connection from phone.
- [ ] API reference (REST + SSE event schema).
- [ ] Troubleshooting: permissions, udev, `dmesg`, logs location.
- [ ] Network setup notes (mDNS, static IP option).

## Nice‑to‑Haves

- [ ] Per‑port command presets and history with search.
- [ ] Hex/ASCII view toggle; CR/LF controls.
- [ ] Export/import settings and logs.
- [ ] Multi‑client coordination (who controls write lock).

## Open Questions

- [ ] Exact RS485 transceiver behavior with this MCUzone adapter (RTS/half‑duplex?).
- [ ] Required baud rates and framing (e.g., 9600 8N1?) per device.
- [ ] Do we need TLS/auth for your environment?
- [ ] Are stable symlinks required or is `ttyACM{N}` stable enough in practice?

## Acceptance Criteria (MVP)

- [ ] From a phone on the same Wi‑Fi, open the app, see two ports, open one.
- [ ] Send a command and see the response within 200 ms on the console.
- [ ] Close/reopen without orphaned handles; errors reported clearly.

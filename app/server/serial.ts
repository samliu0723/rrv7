import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { ReadableStream as WebReadableStream } from "node:stream/web";
import { portConsole, type PortLogEntry } from "./port-console";

// Lazy import to ensure server-only usage and avoid bundling in client
let SerialPortMod: typeof import("serialport") | undefined;
let ParserMod: typeof import("@serialport/parser-readline") | undefined;

async function loadSerialModules() {
  if (!SerialPortMod) {
    SerialPortMod = await import("serialport");
  }
  if (!ParserMod) {
    ParserMod = await import("@serialport/parser-readline");
  }
}

export type PortId = string; // e.g., "rs485-1"

export interface PortConfig {
  baudRate: number;
  dataBits?: 5 | 6 | 7 | 8;
  stopBits?: 1 | 2;
  parity?: "none" | "even" | "odd" | "mark" | "space";
}

interface ManagedPort {
  id: PortId;
  path: string;
  open: boolean;
  port?: import("serialport").SerialPort;
  parser?: import("stream").Transform;
  emitter: EventEmitter; // emits: data, open, close, error
}

function parseConfiguredPorts(): { id: PortId; path: string }[] {
  const envPorts = process.env.RS485_PORTS || "/dev/rs485-1,/dev/rs485-2";
  const ids = envPorts
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.map((path) => {
    const id = path.split("/").pop() || path; // rs485-1
    return { id, path };
  });
}

class SerialManager {
  private ports = new Map<PortId, ManagedPort>();
  private ready = false;

  constructor() {
    for (const { id, path } of parseConfiguredPorts()) {
      this.ports.set(id, {
        id,
        path,
        open: false,
        emitter: new EventEmitter(),
      });
    }
  }

  list() {
    const arr = Array.from(this.ports.values()).map((p) => ({
      id: p.id,
      path: p.path,
      open: p.open,
    }));
    return arr;
  }

  get(id: PortId) {
    const p = this.ports.get(id);
    if (!p) throw new Error(`Unknown port id: ${id}`);
    return p;
  }

  async open(id: PortId, cfg?: Partial<PortConfig>) {
    await loadSerialModules();
    const { SerialPort } = SerialPortMod!;
    const p = this.get(id);
    if (p.open && p.port) return; // already open
    if (!existsSync(p.path)) throw new Error(`Device not found: ${p.path}`);
    const baudRate = Number(
      cfg?.baudRate ?? process.env.RS485_DEFAULT_BAUD ?? 9600
    );

    const port = new SerialPort({
      path: p.path,
      baudRate,
      dataBits: (cfg?.dataBits as any) ?? 8,
      stopBits: (cfg?.stopBits as any) ?? 1,
      parity: (cfg?.parity as any) ?? "none",
      autoOpen: true,
    });

    p.port = port;
    p.open = true;

    const { ReadlineParser } = ParserMod!;
    const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));
    p.parser = parser;

    port.on("open", () => p.emitter.emit("open"));
    port.on("close", () => {
      p.open = false;
      p.emitter.emit("close");
    });
    port.on("error", (err) => p.emitter.emit("error", String(err)));
    parser.on("data", (line: string) => p.emitter.emit("data", line as string));
  }

  async close(id: PortId) {
    const p = this.get(id);
    if (p.port && p.open) {
      await new Promise<void>((resolve) => p.port!.close(() => resolve()));
    }
    p.open = false;
    p.port = undefined;
    p.parser?.removeAllListeners();
    p.parser = undefined;
  }

  async write(id: PortId, data: string | Uint8Array) {
    const p = this.get(id);
    if (!p.open || !p.port) throw new Error(`Port not open: ${id}`);
    const buf =
      typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
    await new Promise<void>((resolve, reject) => {
      p.port!.write(buf, (err) => (err ? reject(err) : resolve()));
    });
    await new Promise<void>((resolve, reject) => {
      p.port!.drain((err) => (err ? reject(err) : resolve()));
    });
  }

  async setBaud(id: PortId, baudRate: number) {
    const p = this.get(id);
    if (!p.open || !p.port) throw new Error(`Port not open: ${id}`);
    await new Promise<void>((resolve, reject) => {
      // SerialPort.update is supported by bindings that allow runtime change
      (p.port as any).update({ baudRate }, (err: any) =>
        err ? reject(err) : resolve()
      );
    });
    p.emitter.emit("baud", { baudRate });
  }

  // Subscribe to data/events; returns unsubscribe
  on(
    id: PortId,
    event: "data" | "open" | "close" | "error" | "baud",
    cb: (payload: any) => void
  ) {
    const p = this.get(id);
    p.emitter.on(event, cb);
    return () => p.emitter.off(event, cb);
  }
}

export const serialManager = new SerialManager();

export function sseStreamForPort(id: PortId) {
  const heartbeatMs = Number(process.env.SSE_HEARTBEAT_MS ?? 15000);
  const encoder = new TextEncoder();
  let stop: (() => void) | null = null;

  const stream = new WebReadableStream<Uint8Array>({
    start(controller) {
      function send(evt: string, data: any) {
        const payload = typeof data === "string" ? data : JSON.stringify(data);
        const msg = `event: ${evt}\ndata: ${payload}\n\n`;
        controller.enqueue(encoder.encode(msg));
      }
      const unsubData = serialManager.on(id, "data", (line) =>
        send("data", line)
      );
      const unsubOpen = serialManager.on(id, "open", () => send("open", {}));
      const unsubClose = serialManager.on(id, "close", () => send("close", {}));
      const unsubErr = serialManager.on(id, "error", (e) =>
        send("error", String(e))
      );
      const unsubBaud = serialManager.on(id, "baud", (b) =>
        send("baud", b)
      );

      const shouldSendConsole = (entry: PortLogEntry) =>
        !entry.portId || entry.portId === id;
      portConsole.getLogs(id).forEach((entry) => {
        if (shouldSendConsole(entry)) {
          send("console-log", entry);
        }
      });
      const unsubConsole = portConsole.onLog((entry) => {
        if (shouldSendConsole(entry)) {
          send("console-log", entry);
        }
      });

      const iv = setInterval(
        () => controller.enqueue(encoder.encode(`: ping\n\n`)),
        heartbeatMs
      );
      stop = () => {
        unsubData();
        unsubOpen();
        unsubClose();
        unsubErr();
        unsubBaud();
        unsubConsole();
        clearInterval(iv);
        controller.close();
      };
      // initial
      send("status", { list: serialManager.list() });
    },
    cancel() {
      if (stop) stop();
    },
  });

  return stream;
}

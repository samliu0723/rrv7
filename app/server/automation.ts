import { EventEmitter } from "node:events";
import { ReadableStream } from "node:stream/web";
import { setTimeout as sleepTimeout } from "node:timers/promises";
import vm from "node:vm";

import type { PortId } from "./serial";
import { serialManager } from "./serial";

type AutomationLogType =
  | "info"
  | "receive"
  | "send"
  | "console"
  | "error"
  | "alert";

export type AutomationLogEntry = {
  ts: number;
  type: AutomationLogType;
  message: string;
  color?: string;
};

export interface AutomationState {
  script: string;
  enabled: boolean;
  portId: PortId | null;
  lastError: string | null;
  logs: AutomationLogEntry[];
}

const MAX_LOG_ENTRIES = 200;
const SCRIPT_TIMEOUT_MS = 1000;

function blockSleep(ms: number) {
  const clamped = Math.max(0, Math.floor(ms));
  const sab = new SharedArrayBuffer(4);
  const arr = new Int32Array(sab);
  Atomics.wait(arr, 0, 0, clamped);
}

class AutomationManager {
  private scriptSource = "";
  private compiled: vm.Script | null = null;
  private enabled = false;
  private targetPort: PortId | null = null;
  private unsub: (() => void) | null = null;
  private emitter = new EventEmitter();
  private logs: AutomationLogEntry[] = [];
  private lastError: string | null = null;

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  private pushLogEntry(
    type: AutomationLogType,
    message: string,
    color?: string
  ) {
    this.pushLog({
      ts: Date.now(),
      type,
      message,
      color,
    });
  }

  receiveWrite(message: string, color?: string) {
    this.pushLogEntry("receive", message, color);
  }

  receiveWriteLine(message: string, color?: string) {
    const normalized = message.endsWith("\n") ? message : `${message}\n`;
    this.receiveWrite(normalized, color);
  }

  receiveClear() {
    this.pushLogEntry("receive", "[clear]");
  }

  receiveClearLast() {
    this.pushLogEntry("receive", "[clear-last]");
  }

  getState(): AutomationState {
    return {
      script: this.scriptSource,
      enabled: this.enabled,
      portId: this.targetPort,
      lastError: this.lastError,
      logs: [...this.logs],
    };
  }

  setScript(source: string) {
    this.scriptSource = source;
    this.compile();
    this.emitState();
  }

  async enable(portId: PortId) {
    if (!this.compiled) {
      this.compile();
    }
    await serialManager.open(portId).catch(() => {});
    this.targetPort = portId;
    this.enabled = true;
    this.lastError = null;
    this.subscribe(portId);
    this.pushLogEntry("info", `Automation enabled on ${portId}`);
    this.emitState();
  }

  disable() {
    this.enabled = false;
    this.unsubscribe();
    this.pushLogEntry("info", "Automation disabled");
    this.emitState();
  }

  onLog(cb: (entry: AutomationLogEntry) => void) {
    this.emitter.on("log", cb);
    return () => this.emitter.off("log", cb);
  }

  onState(cb: (state: AutomationState) => void) {
    this.emitter.on("state", cb);
    return () => this.emitter.off("state", cb);
  }

  private compile() {
    try {
      const wrapped = `(async () => {\n${this.scriptSource}\n})()`;
      this.compiled = new vm.Script(wrapped, {
        filename: "automation-script.mjs",
      });
      this.lastError = null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.lastError = message;
      this.compiled = null;
      this.pushLogEntry("error", `Compile error: ${message}`);
    }
  }

  private subscribe(portId: PortId) {
    this.unsubscribe();
    this.unsub = serialManager.on(portId, "data", (line: string) => {
      void this.run(line);
    });
  }

  private unsubscribe() {
    if (this.unsub) {
      this.unsub();
      this.unsub = null;
    }
  }

  private pushLog(entry: AutomationLogEntry) {
    this.logs = [...this.logs.slice(-(MAX_LOG_ENTRIES - 1)), entry];
    this.emitter.emit("log", entry);
  }

  private emitState() {
    this.emitter.emit("state", this.getState());
  }

  private async run(raw: string) {
    if (!this.enabled || !this.targetPort || !this.compiled) return;
    const portId = this.targetPort;
    const dataString = raw;
    const dataBytes = Buffer.from(dataString, "utf8");

    const log = (
      type: AutomationLogType,
      message: string,
      color?: string
    ) => this.pushLogEntry(type, message, color);

    const receive = {
      isFrameStart: false,
      isHexDisplay: false,
      isSaveToFile: false,
      isPauseReceivingDisplay: false,
      isAutoBreakFrame: false,
      currentRowIsEmpty: false,
      get: () => dataString,
      getString: () => dataString,
      getBytes: () => new Uint8Array(dataBytes),
      write: (msg: string, color?: string) => this.receiveWrite(msg, color),
      writeLine: (msg: string, color?: string) =>
        this.receiveWriteLine(msg, color),
      clear: () => this.receiveClear(),
      clearLastReceived: () => this.receiveClearLast(),
    };

    const send = {
      isSendFile: false,
      isHexSend: false,
      isTimingSend: false,
      isDisplaySendString: true,
      get: () => "",
      getString: () => "",
      getBytes: () => new Uint8Array(),
      write: async (value: string, isHexStr?: boolean) => {
        if (!value) return;
        if (isHexStr) {
          const clean = value.replace(/[^0-9a-fA-F]/g, "");
          if (!clean) return;
          const buf = Buffer.from(clean, "hex");
          await serialManager.write(portId, buf);
          log("send", `HEX ${clean.toUpperCase()}`);
        } else {
          await serialManager.write(portId, value);
          log("send", value);
        }
      },
      writeBytes: async (arr: unknown) => {
        const buf = this.normalizeBytes(arr);
        if (!buf) return;
        await serialManager.write(portId, buf);
        log("send", `BYTES ${buf.toString("hex")}`);
      },
      writeToReceive: (value: string, color?: string) =>
        receive.write(value, color),
    };

    const util = {
      isNull: (obj: unknown) => obj === null,
      isUndefined: (obj: unknown) => typeof obj === "undefined",
      isNullOrUndefined: (obj: unknown) => obj == null,
      timeToString: () =>
        new Date().toLocaleTimeString([], {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) +
        `.${new Date().getMilliseconds().toString().padStart(3, "0")}`,
      hexStringToBytes: (value: string) => {
        const clean = (value || "").replace(/[^0-9a-fA-F]/g, "");
        const size = Math.floor(clean.length / 2);
        const out = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
          const hex = clean.slice(i * 2, i * 2 + 2);
          out[i] = Number.parseInt(hex || "00", 16);
        }
        return out;
      },
      bytesToHexString: (value: ArrayLike<number>, uppercase = false) => {
        const bytes = Uint8Array.from(value as ArrayLike<number>);
        return Array.from(bytes)
          .map((b) =>
            uppercase
              ? b.toString(16).padStart(2, "0").toUpperCase()
              : b.toString(16).padStart(2, "0")
          )
          .join(" ");
      },
      bytesToInteger: (
        buf: ArrayLike<number>,
        index: number,
        len: number,
        bigEndian = true
      ) => {
        const bytes = Uint8Array.from(buf as ArrayLike<number>);
        if (index < 0 || len <= 0 || index + len > bytes.length) return 0;
        let result = 0;
        for (let i = 0; i < len; i++) {
          const offset = bigEndian ? index + i : index + (len - 1 - i);
          result = (result << 8) | bytes[offset];
        }
        return result >>> 0;
      },
      bytesTofloat: (
        buf: ArrayLike<number>,
        index: number,
        bigEndian = true
      ) => {
        const bytes = Uint8Array.from(buf as ArrayLike<number>).slice(
          index,
          index + 4
        );
        if (bytes.length < 4) return 0;
        if (!bigEndian) bytes.reverse();
        const view = new DataView(new ArrayBuffer(4));
        bytes.forEach((b, i) => view.setUint8(i, b));
        return view.getFloat32(0);
      },
      types: {
        isBoolean: (obj: unknown): obj is boolean => typeof obj === "boolean",
        isNumber: (obj: unknown): obj is number => typeof obj === "number",
        isString: (obj: unknown): obj is string => typeof obj === "string",
        isFunction: (obj: unknown): obj is Function => typeof obj === "function",
        isInt8Array: (obj: unknown): obj is Int8Array => obj instanceof Int8Array,
        isUint8Array: (obj: unknown): obj is Uint8Array => obj instanceof Uint8Array,
        isInt16Array: (obj: unknown): obj is Int16Array => obj instanceof Int16Array,
        isUint16Array: (obj: unknown): obj is Uint16Array => obj instanceof Uint16Array,
      },
    };

    const consoleBridge = {
      log: (...args: unknown[]) => log("console", args.map(String).join(" ")),
      dir: (...args: unknown[]) => log("console", args.map(String).join(" ")),
      error: (...args: unknown[]) =>
        log("error", args.map(String).join(" "), "red"),
      warn: (...args: unknown[]) =>
        log("console", args.map(String).join(" "), "darkgreen"),
      write: (...args: unknown[]) => log("console", args.map(String).join(" ")),
      time: (label = "timer") => this.timerStart(label),
      timeEnd: (label = "timer") => this.timerEnd(label, log),
    };

    const alertFn = (title: string, message?: string) =>
      log("alert", message ? `${title}: ${message}` : title, "orange");

    const delay = (ms: number) => sleepTimeout(Math.max(0, ms));

    const context = vm.createContext({
      receive,
      send,
      util,
      console: consoleBridge,
      alert: alertFn,
      delay,
      sleep: blockSleep,
      Buffer,
      Uint8Array,
      Array,
      Date,
      Math,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
    });

    try {
      const result = this.compiled.runInContext(context, {
        timeout: SCRIPT_TIMEOUT_MS,
      });
      if (result && typeof result.then === "function") {
        await Promise.race([
          result,
          sleepTimeout(SCRIPT_TIMEOUT_MS).then(() =>
            Promise.reject(new Error("Script timeout"))
          ),
        ]);
      }
      this.lastError = null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.lastError = message;
      log("error", message, "red");
      this.emitState();
    }
  }

  private normalizeBytes(value: unknown): Buffer | null {
    if (!value) return null;
    if (value instanceof Uint8Array) {
      return Buffer.from(value);
    }
    if (Array.isArray(value)) {
      return Buffer.from(value.map((v) => Number(v) & 0xff));
    }
    return null;
  }

  private timerStart(label: string) {
    this.timerMap.set(label, Date.now());
  }

  private timerEnd(
    label: string,
    log: (type: AutomationLogType, message: string) => void
  ) {
    const start = this.timerMap.get(label);
    if (typeof start === "number") {
      const delta = Date.now() - start;
      log("console", `${label}: ${delta}ms`);
      this.timerMap.delete(label);
    }
  }

  private timerMap = new Map<string, number>();
}

export const automationManager = new AutomationManager();

export function automationSseStream() {
  const heartbeatMs = Number(process.env.SSE_HEARTBEAT_MS ?? 15000);
  const encoder = new TextEncoder();
  let stop: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start: (controller) => {
      const sendEvent = (event: string, data: unknown) => {
        const payload =
          typeof data === "string" ? data : JSON.stringify(data ?? {});
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${payload}\n\n`)
        );
      };

      automationManager.getState().logs.forEach((entry) =>
        sendEvent("log", entry)
      );
      sendEvent("state", automationManager.getState());

      const unsubLog = automationManager.onLog((entry) =>
        sendEvent("log", entry)
      );
      const unsubState = automationManager.onState((state) =>
        sendEvent("state", {
          script: state.script,
          enabled: state.enabled,
          portId: state.portId,
          lastError: state.lastError,
        })
      );

      const interval = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, heartbeatMs);

      stop = () => {
        unsubLog();
        unsubState();
        clearInterval(interval);
        controller.close();
      };
    },
    cancel: () => {
      if (stop) stop();
    },
  });

  return stream;
}

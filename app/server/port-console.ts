import { EventEmitter } from "node:events";

import type { PortId } from "./serial";

export type PortLogType =
  | "info"
  | "receive"
  | "send"
  | "console"
  | "error"
  | "alert";

export interface PortLogEntry {
  ts: number;
  type: PortLogType;
  message: string;
  color?: string;
  portId: PortId | null;
}

const MAX_LOG_ENTRIES = 200;

class PortConsole {
  private emitter = new EventEmitter();
  private logs: PortLogEntry[] = [];

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  getLogs(filterPort?: PortId | null) {
    if (!filterPort) {
      return [...this.logs];
    }
    return this.logs.filter((entry) => !entry.portId || entry.portId === filterPort);
  }

  onLog(cb: (entry: PortLogEntry) => void) {
    this.emitter.on("log", cb);
    return () => this.emitter.off("log", cb);
  }

  log(
    type: PortLogType,
    message: string,
    options?: { portId?: PortId | null; color?: string; timestamp?: number }
  ) {
    const normalized: PortLogEntry = {
      ts: options?.timestamp ?? Date.now(),
      type,
      message,
      color: options?.color,
      portId: options?.portId ?? null,
    };
    this.logs = [
      ...this.logs.slice(-(MAX_LOG_ENTRIES - 1)),
      normalized,
    ];
    this.emitter.emit("log", normalized);
    return normalized;
  }

  receiveWrite(portId: PortId | null, message: string, color?: string) {
    return this.log("receive", message, { portId, color });
  }

  receiveWriteLine(portId: PortId | null, message: string, color?: string) {
    const normalized = message.endsWith("\n") ? message : `${message}\n`;
    return this.receiveWrite(portId, normalized, color);
  }

  receiveClear(portId: PortId | null) {
    return this.log("receive", "[clear]", { portId });
  }

  receiveClearLast(portId: PortId | null) {
    return this.log("receive", "[clear-last]", { portId });
  }
}

export const portConsole = new PortConsole();

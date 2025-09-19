import type { PortId } from "./serial";
import { serialManager } from "./serial";
import { portConsole } from "./port-console";

export class PortService {
  async sendText(id: PortId, text: string) {
    await serialManager.write(id, text);
    portConsole.log("send", text, { portId: id });
  }

  async sendHex(id: PortId, hex: string) {
    const clean = (hex || "").replace(/[^0-9a-fA-F]/g, "");
    if (!clean) {
      throw new Error("Missing hex payload");
    }
    const buf = Buffer.from(clean, "hex");
    await serialManager.write(id, buf);
    portConsole.log("send", `HEX ${clean.toUpperCase()}`, { portId: id });
  }

  async sendBytes(id: PortId, data: ArrayLike<number> | Buffer | Uint8Array) {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(Array.from(data));
    await serialManager.write(id, buf);
    portConsole.log("send", `BYTES ${buf.toString("hex")}`, { portId: id });
  }

  receiveWrite(id: PortId | null, message: string, color?: string) {
    portConsole.receiveWrite(id, message, color);
  }

  receiveWriteLine(id: PortId | null, message: string, color?: string) {
    portConsole.receiveWriteLine(id, message, color);
  }

  receiveClear(id: PortId | null) {
    portConsole.receiveClear(id);
  }

  receiveClearLast(id: PortId | null) {
    portConsole.receiveClearLast(id);
  }
}

export const portService = new PortService();

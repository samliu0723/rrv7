import type { Route } from "./+types/ports.$id";
import React from "react";
import { Link, useParams } from "react-router";

export async function loader({ params }: Route.LoaderArgs) {
  const id = params.id;
  if (!id) throw new Response("Missing id", { status: 400 });
  return Response.json({ id });
}

type LogItem = { ts: number; type: string; text: string };

export default function PortConsole() {
  const { id } = useParams();
  const commonBauds = [
    1200,
    2400,
    4800,
    9600,
    19200,
    38400,
    57600,
    115200,
    230400,
  ];
  const [baud, setBaud] = React.useState<string>("9600");
  const [appendCrlf, setAppendCrlf] = React.useState<boolean>(true);
  const [text, setText] = React.useState<string>("");
  const [hex, setHex] = React.useState<string>("");
  const [appendHexCrlf, setAppendHexCrlf] = React.useState<boolean>(true);
  const [open, setOpen] = React.useState<boolean>(false);
  const [log, setLog] = React.useState<LogItem[]>([]);
  const [showTx, setShowTx] = React.useState<boolean>(true);
  const [rxFormat, setRxFormat] = React.useState<"text" | "hex">("text");

  React.useEffect(() => {
    if (!id) return;
    const es = new EventSource(`/api/ports/${id}/stream`);
    function push(type: string, text: string) {
      setLog((prev) => [...prev.slice(-999), { ts: Date.now(), type, text }]);
    }
    es.addEventListener("status", (e: MessageEvent) => {
      push("status", e.data);
    });
    es.addEventListener("data", (e: MessageEvent) => {
      push("data", e.data);
    });
    es.addEventListener("open", () => {
      setOpen(true);
      push("event", "[open]");
    });
    es.addEventListener("close", () => {
      setOpen(false);
      push("event", "[close]");
    });
    es.addEventListener("error", (e: MessageEvent) => {
      push("error", String(e.data || "error"));
    });
    es.addEventListener("baud", (e: MessageEvent) => {
      try {
        const j = JSON.parse(e.data);
        if (j && j.baudRate) {
          setBaud(String(j.baudRate));
          push("event", `[baud ${j.baudRate}]`);
        }
      } catch {}
    });
    es.onopen = () => push("event", "[connected]");
    es.onerror = () => push("event", "[disconnected]");
    return () => es.close();
  }, [id]);

  async function doOpen() {
    if (!id) return;
    await fetch(`/api/ports/${id}/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baudRate: Number(baud) || 9600 }),
    });
  }

  async function doClose() {
    if (!id) return;
    await fetch(`/api/ports/${id}/close`, { method: "POST" });
  }

  async function applyBaud() {
    if (!id) return;
    await fetch(`/api/ports/${id}/baud`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baudRate: Number(baud) || 9600 }),
    });
  }

  async function sendText() {
    if (!id || !text) return;
    const payload = appendCrlf ? text + "\r\n" : text;
    await fetch(`/api/ports/${id}/write`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: payload }),
    });
    if (showTx) {
      setLog((prev) => [
        ...prev.slice(-999),
        { ts: Date.now(), type: "tx", text: `(text) ${payload}` },
      ]);
    }
    setText("");
  }

  async function sendHex() {
    if (!id || !hex) return;
    // Normalize hex and optionally append CRLF (0D0A)
    const cleaned = hex.replace(/[^0-9a-fA-F]/g, "");
    if (cleaned.length % 2 !== 0) {
      // simple validation: require even number of hex digits
      alert("Invalid hex: odd number of digits");
      return;
    }
    let toSend = cleaned;
    if (appendHexCrlf) {
      const up = cleaned.toUpperCase();
      const endsWithLF = up.endsWith("0A");
      const endsWithCRLF = up.endsWith("0D0A");
      if (!endsWithLF && !endsWithCRLF) {
        toSend = cleaned + "0D0A";
      }
    }
    await fetch(`/api/ports/${id}/write`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hex: toSend }),
    });
    if (showTx) {
      setLog((prev) => [
        ...prev.slice(-999),
        { ts: Date.now(), type: "tx", text: `(hex) ${toSend}` },
      ]);
    }
    setHex("");
  }

  return (
    <main className="p-4 container mx-auto space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between md:justify-start gap-3">
          <Link className="text-blue-600 hover:underline" to="/ports">
            ← All Ports
          </Link>
          <h1 className="text-2xl font-semibold">Port: {id}</h1>
          <Link
            className="text-sm text-blue-600 hover:underline"
            to={`/ports/${id}/automation`}
          >
            Automation
          </Link>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              open ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
            }`}
          >
            {open ? "OPEN" : "CLOSED"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            value={baud}
            onChange={(e) => setBaud(e.target.value)}
            className="w-28 px-2 py-1 rounded border border-gray-300"
          >
            {commonBauds.map((b) => (
              <option key={b} value={String(b)}>
                {b}
              </option>
            ))}
          </select>
          <button
            onClick={doOpen}
            className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
          >
            Open
          </button>
          <button
            onClick={doClose}
            className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
          >
            Close
          </button>
          <button
            onClick={applyBaud}
            className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
          >
            Apply
          </button>
          <select
            value={rxFormat}
            onChange={(e) => setRxFormat(e.target.value as any)}
            className="w-32 px-2 py-1 rounded border border-gray-300"
          >
            <option value="text">RX: Text</option>
            <option value="hex">RX: Hex</option>
          </select>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border min-h-[300px] p-2 bg-black text-green-300">
          <pre className="whitespace-pre-wrap text-sm leading-5">
            {log.map((l, i) => {
              const text =
                l.type === "data" && rxFormat === "hex"
                  ? Array.from(new TextEncoder().encode(l.text))
                      .map((b) => b.toString(16).padStart(2, "0"))
                      .join(" ")
                  : l.text;
              return (
                <div key={i}>
                  {new Date(l.ts).toLocaleTimeString()} [{l.type}] {text}
                </div>
              );
            })}
          </pre>
        </div>

        <div className="rounded-2xl border p-3 space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Send Text</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-24 px-2 py-1.5 rounded border border-gray-300"
              placeholder="Type text to send"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="text-sm inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={appendCrlf}
                    onChange={(e) => setAppendCrlf(e.target.checked)}
                  />
                  Append CRLF
                </label>
                <label className="text-sm inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showTx}
                    onChange={(e) => setShowTx(e.target.checked)}
                  />
                  Show TX
                </label>
              </div>
              <button
                onClick={sendText}
                className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Send
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Send Hex</label>
            <input
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              className="w-full px-2 py-1.5 rounded border border-gray-300"
              placeholder="e.g. 48 45 4C 4C 4F 0D 0A"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="text-sm inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={appendHexCrlf}
                    onChange={(e) => setAppendHexCrlf(e.target.checked)}
                  />
                  Append CRLF (0D 0A)
                </label>
                <label className="text-sm inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showTx}
                    onChange={(e) => setShowTx(e.target.checked)}
                  />
                  Show TX
                </label>
              </div>
              <button
                onClick={sendHex}
                className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
              >
                Send Hex
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

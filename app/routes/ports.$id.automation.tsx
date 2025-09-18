import type { Route } from "./+types/ports.$id.automation";
import React from "react";
import { Link, useLoaderData, useNavigate } from "react-router";

import type { AutomationLogEntry } from "../server/automation";

const SAMPLE_SCRIPT = `/**
 * Automatic reply example
 */
const commands = [
  ["cmd1", "answer 1"],
  ["cmd2", "answer 2"],
  ["cmd3", "answer 3"],
];

(function main() {
  const incoming = receive.get().trim();
  receive.writeLine(util.timeToString());
  receive.writeLine('receive -> ' + incoming, 'green');

  const match = commands.find(([cmd]) => cmd === incoming);
  if (!match) {
    receive.writeLine('Unknown command', 'firebrick');
    return;
  }

  const [, reply] = match;
  receive.writeLine('answer  -> ' + reply, 'peru');
  sleep(10);
  send.write(reply + "\\r\\n");
})();`;

type LoaderData = {
  port: { id: string; path: string; open: boolean };
  ports: Array<{ id: string; path: string; open: boolean }>;
  state: {
    script: string;
    enabled: boolean;
    portId: string | null;
    lastError: string | null;
    logs: AutomationLogEntry[];
  };
};

export async function loader({ params }: Route.LoaderArgs) {
  const id = params.id;
  if (!id) throw new Response("Missing id", { status: 400 });

  const { serialManager } = await import("../server/serial");
  const ports = serialManager.list();
  const port = ports.find((p) => p.id === id);
  if (!port) throw new Response("Port not found", { status: 404 });

  const { automationManager } = await import("../server/automation");
  const state = automationManager.getState();
  return Response.json({ port, ports, state } satisfies LoaderData);
}

export default function PortAutomationAssistant() {
  const data = useLoaderData() as LoaderData;
  const { port } = data;
  const navigate = useNavigate();

  const [script, setScript] = React.useState<string>(data.state.script);
  const [globalEnabled, setGlobalEnabled] = React.useState<boolean>(
    data.state.enabled
  );
  const [activePortId, setActivePortId] = React.useState<string | null>(
    data.state.portId
  );
  const [lastError, setLastError] = React.useState<string | null>(
    data.state.lastError
  );
  const [logs, setLogs] = React.useState<AutomationLogEntry[]>(
    data.state.logs || []
  );
  const [receiveMessage, setReceiveMessage] = React.useState<string>("");
  const [receiveColor, setReceiveColor] = React.useState<string>("");
  const [receiveBusy, setReceiveBusy] = React.useState<boolean>(false);
  const [receiveError, setReceiveError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const enabledHere = globalEnabled && activePortId === port.id;

  React.useEffect(() => {
    const es = new EventSource(
      `/api/ports/${encodeURIComponent(port.id)}/automation/stream`
    );
    es.addEventListener("log", (evt) => {
      try {
        const entry = JSON.parse(evt.data);
        setLogs((prev) => {
          const last = prev[prev.length - 1];
          if (
            last &&
            last.ts === entry.ts &&
            last.type === entry.type &&
            last.message === entry.message
          ) {
            return prev;
          }
          return [...prev.slice(-199), entry];
        });
      } catch {}
    });
    es.addEventListener("state", (evt) => {
      try {
        const state = JSON.parse(evt.data);
        if (typeof state.enabled === "boolean") {
          setGlobalEnabled(state.enabled);
        }
        if (Object.prototype.hasOwnProperty.call(state, "portId")) {
          setActivePortId(state.portId ?? null);
        }
        setLastError(state.lastError ?? null);
        if (typeof state.script === "string") {
          setScript((current) =>
            current === state.script ? current : state.script
          );
        }
      } catch {}
    });
    es.onerror = () => {
      setLastError((err) => err ?? "Automation stream disconnected");
    };
    return () => es.close();
  }, [port.id]);

  async function saveScript() {
    setActionError(null);
    try {
      const res = await fetch(
        `/api/ports/${encodeURIComponent(port.id)}/automation/script`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script }),
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to save script");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }

  async function enableAutomation() {
    setActionError(null);
    try {
      const res = await fetch(
        `/api/ports/${encodeURIComponent(port.id)}/automation/enable`,
        {
          method: "POST",
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to enable automation");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }

  async function disableAutomation() {
    setActionError(null);
    try {
      const res = await fetch(
        `/api/ports/${encodeURIComponent(port.id)}/automation/disable`,
        {
          method: "POST",
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to disable automation");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }

  function loadSample() {
    setScript(SAMPLE_SCRIPT);
  }

  function clearLogs() {
    setLogs([]);
  }

  async function sendReceive(kind: "write" | "writeLine") {
    if (!receiveMessage.trim()) return;
    if (!enabledHere) {
      setReceiveError("Automation is not active on this port");
      return;
    }
    setReceiveBusy(true);
    setReceiveError(null);
    try {
      const base = `/api/ports/${encodeURIComponent(port.id)}/automation/receive`;
      const endpoint = `${base}/${kind === "writeLine" ? "write-line" : "write"}`;
      const trimmedColor = receiveColor.trim();
      const payload: { message: string; color?: string } = {
        message: receiveMessage,
      };
      if (trimmedColor) payload.color = trimmedColor;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to ${kind}`);
      }
      setReceiveMessage("");
    } catch (err) {
      setReceiveError(err instanceof Error ? err.message : String(err));
    } finally {
      setReceiveBusy(false);
    }
  }

  async function invokeReceive(command: "clear" | "clear-last") {
    if (!enabledHere) {
      setReceiveError("Automation is not active on this port");
      return;
    }
    setReceiveBusy(true);
    setReceiveError(null);
    try {
      const base = `/api/ports/${encodeURIComponent(port.id)}/automation/receive`;
      const endpoint = `${base}/${command === "clear" ? "clear" : "clear-last"}`;
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to ${command}`);
      }
    } catch (err) {
      setReceiveError(err instanceof Error ? err.message : String(err));
    } finally {
      setReceiveBusy(false);
    }
  }

  return (
    <main className="p-4 container mx-auto space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Link className="text-blue-600 hover:underline" to={`/ports/${port.id}`}>
              ← Port Console
            </Link>
            <h1 className="text-2xl font-semibold">Automation: {port.id}</h1>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                enabledHere
                  ? "bg-green-100 text-green-700"
                  : globalEnabled
                  ? "bg-amber-100 text-amber-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {enabledHere
                ? "ENABLED"
                : globalEnabled && activePortId
                ? `ON ${activePortId}`
                : "DISABLED"}
            </span>
          </div>
          {globalEnabled && activePortId && activePortId !== port.id && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Automation is currently active on port {activePortId}. Disable it there before enabling {port.id}.
            </p>
          )}
          {actionError && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {actionError}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            value={port.id}
            onChange={(e) => navigate(`/ports/${encodeURIComponent(e.target.value)}/automation`)}
            className="px-2 py-1 rounded border border-gray-300"
          >
            {data.ports.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id}
              </option>
            ))}
          </select>
          <button
            onClick={enableAutomation}
            disabled={enabledHere}
            className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Enable
          </button>
          <button
            onClick={disableAutomation}
            disabled={!enabledHere}
            className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Disable
          </button>
          <button
            onClick={saveScript}
            className="px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Save Script
          </button>
        </div>
      </header>

      {lastError && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {lastError}
        </div>
      )}

      <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-medium">Receive Console</h2>
          {receiveError && (
            <span className="text-xs text-red-600">{receiveError}</span>
          )}
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <input
            value={receiveMessage}
            onChange={(e) => setReceiveMessage(e.target.value)}
            placeholder="Message"
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={receiveColor}
            onChange={(e) => setReceiveColor(e.target.value)}
            placeholder="Color (optional)"
            className="rounded border border-gray-300 px-3 py-2 text-sm md:w-48"
          />
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <button
            onClick={() => sendReceive("write")}
            disabled={receiveBusy || !receiveMessage.trim() || !enabledHere}
            className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Write
          </button>
          <button
            onClick={() => sendReceive("writeLine")}
            disabled={receiveBusy || !receiveMessage.trim() || !enabledHere}
            className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Write Line
          </button>
          <button
            onClick={() => invokeReceive("clear")}
            disabled={receiveBusy || !enabledHere}
            className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Clear
          </button>
          <button
            onClick={() => invokeReceive("clear-last")}
            disabled={receiveBusy || !enabledHere}
            className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Clear Last
          </button>
        </div>
        <p className="text-xs text-gray-500">
          These APIs mirror the Serial Debug Assistant helpers so other tools can call them directly.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Script</h2>
            <div className="flex gap-2">
              <button
                onClick={loadSample}
                className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 text-sm"
              >
                Load Sample
              </button>
              <button
                onClick={clearLogs}
                className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 text-sm"
              >
                Clear Logs
              </button>
            </div>
          </div>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            className="w-full min-h-[320px] rounded border border-gray-300 px-3 py-2 font-mono text-sm"
          />
        </div>

        <div className="rounded-2xl border p-3 bg-black text-green-300 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>Automation Log</span>
            <span className="text-gray-400">Live</span>
          </div>
          <div className="h-[420px] overflow-y-auto rounded bg-black/40 p-3">
            <pre className="whitespace-pre-wrap text-xs leading-5">
              {logs.map((entry, idx) => (
                <div key={idx} style={{ color: entry.color || undefined }}>
                  {new Date(entry.ts).toLocaleTimeString()} [{entry.type}] {entry.message}
                </div>
              ))}
            </pre>
          </div>
          <p className="text-xs text-gray-400">
            Scripts run on the server. Use receive/send helpers to react to serial traffic.
          </p>
        </div>
      </section>
    </main>
  );
}

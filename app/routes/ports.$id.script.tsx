import type { Route } from "./+types/ports.$id.script";
import React from "react";
import { Link, useLoaderData, useParams } from "react-router";

import type { AutomationLogEntry, AutomationState } from "../server/automation";

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
  state: AutomationState;
};

export async function loader({ params }: Route.LoaderArgs) {
  const id = params.id;
  if (!id) {
    throw new Response("Missing id", { status: 400 });
  }
  const { automationManager } = await import("../server/automation");
  const { serialManager } = await import("../server/serial");
  const ports = serialManager.list();
  const port = ports.find((p) => p.id === id);
  if (!port) {
    throw new Response("Unknown port", { status: 404 });
  }
  const state = automationManager.getState();
  return Response.json({ port, ports, state } satisfies LoaderData);
}

export default function PortAutomationScript() {
  const data = useLoaderData() as LoaderData;
  const params = useParams();
  const portId = params.id ?? data.port.id;
  const encodedPortId = React.useMemo(() => encodeURIComponent(portId), [portId]);

  const isRelevantLog = React.useCallback(
    (entry: AutomationLogEntry) => !entry?.portId || entry.portId === portId,
    [portId]
  );

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
  const [logs, setLogs] = React.useState<AutomationLogEntry[]>(() =>
    (data.state.logs || []).filter(isRelevantLog)
  );
  const [receiveMessage, setReceiveMessage] = React.useState<string>("");
  const [receiveColor, setReceiveColor] = React.useState<string>("");
  const [receiveBusy, setReceiveBusy] = React.useState<boolean>(false);
  const [receiveError, setReceiveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLogs((prev) => prev.filter(isRelevantLog));
  }, [isRelevantLog]);

  React.useEffect(() => {
    const es = new EventSource(`/api/ports/${encodedPortId}/automation/stream`);
    es.addEventListener("log", (evt) => {
      try {
        const entry = JSON.parse(evt.data) as AutomationLogEntry;
        if (!isRelevantLog(entry)) return;
        setLogs((prev) => {
          const last = prev[prev.length - 1];
          if (
            last &&
            last.ts === entry.ts &&
            last.type === entry.type &&
            last.message === entry.message &&
            last.color === entry.color
          ) {
            return prev;
          }
          return [...prev.slice(-199), entry];
        });
      } catch {
        // ignore malformed events
      }
    });
    es.addEventListener("state", (evt) => {
      try {
        const state = JSON.parse(evt.data) as Partial<AutomationState>;
        if (typeof state.enabled === "boolean") {
          setGlobalEnabled(state.enabled);
        }
        if (Object.prototype.hasOwnProperty.call(state, "portId")) {
          setActivePortId((state.portId as string | null) ?? null);
        }
        setLastError(state.lastError ?? null);
        const nextScript = state.script;
        if (typeof nextScript === "string") {
          setScript((current) => (current === nextScript ? current : nextScript));
        }
      } catch {
        // ignore malformed state updates
      }
    });
    es.onerror = () => {
      setLastError((err) => err ?? "Automation stream disconnected");
    };
    return () => es.close();
  }, [encodedPortId, isRelevantLog]);

  async function saveScript() {
    try {
      setLastError(null);
      const res = await fetch(`/api/ports/${encodedPortId}/script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to save script");
      }
    } catch (err) {
      setLastError(err instanceof Error ? err.message : String(err));
    }
  }

  async function enableAutomation() {
    try {
      setLastError(null);
      const res = await fetch(`/api/ports/${encodedPortId}/automation/enable`, {
        method: "POST",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to enable automation");
      }
    } catch (err) {
      setLastError(err instanceof Error ? err.message : String(err));
    }
  }

  async function disableAutomation() {
    try {
      setLastError(null);
      const res = await fetch(`/api/ports/${encodedPortId}/automation/disable`, {
        method: "POST",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to disable automation");
      }
    } catch (err) {
      setLastError(err instanceof Error ? err.message : String(err));
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
    setReceiveBusy(true);
    setReceiveError(null);
    try {
      const base = `/api/ports/${encodedPortId}/receive`;
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
    setReceiveBusy(true);
    setReceiveError(null);
    try {
      const base = `/api/ports/${encodedPortId}/receive`;
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

  const enabledHere = globalEnabled && activePortId === portId;
  const otherPorts = data.ports.filter((p) => p.id !== portId);

  return (
    <main className="p-4 container mx-auto space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Link className="text-blue-600 hover:underline" to="/ports">
            ← Ports
          </Link>
          <h1 className="text-2xl font-semibold">Automation · {portId}</h1>
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
              ? `ACTIVE: ${activePortId}`
              : "DISABLED"}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              data.port.open
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {data.port.open ? "PORT OPEN" : "PORT CLOSED"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            onClick={enableAutomation}
            disabled={enabledHere}
            className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Enable
          </button>
          <button
            onClick={disableAutomation}
            disabled={!globalEnabled}
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

      {globalEnabled && activePortId && activePortId !== portId && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
          Automation is currently active on {activePortId}. Enabling here will move it.
        </div>
      )}

      {lastError && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {lastError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
        <span>Device path: {data.port.path}</span>
        {otherPorts.length > 0 && (
          <>
            <span>Other scripts:</span>
            {otherPorts.map((p) => (
              <Link
                key={p.id}
                className="rounded border border-gray-200 px-2 py-0.5 hover:bg-gray-50"
                to={`/ports/${encodeURIComponent(p.id)}/script`}
              >
                {p.id}
              </Link>
            ))}
          </>
        )}
      </div>

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
            disabled={receiveBusy || !receiveMessage.trim()}
            className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Write
          </button>
          <button
            onClick={() => sendReceive("writeLine")}
            disabled={receiveBusy || !receiveMessage.trim()}
            className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Write Line
          </button>
          <button
            onClick={() => invokeReceive("clear")}
            disabled={receiveBusy}
            className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Clear
          </button>
          <button
            onClick={() => invokeReceive("clear-last")}
            disabled={receiveBusy}
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

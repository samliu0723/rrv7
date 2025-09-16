import type { Route } from "./+types/automation";
import React from "react";
import { Link, useLoaderData } from "react-router";

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
  const incoming = receive.get();
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
  state: {
    script: string;
    enabled: boolean;
    portId: string | null;
    lastError: string | null;
    logs: AutomationLogEntry[];
  };
  ports: Array<{ id: string; path: string; open: boolean }>;
};

export async function loader({}: Route.LoaderArgs) {
  const { automationManager } = await import("../server/automation");
  const { serialManager } = await import("../server/serial");
  const state = automationManager.getState();
  const ports = serialManager.list();
  return Response.json({ state, ports } satisfies LoaderData);
}

export default function AutomationAssistant() {
  const data = useLoaderData() as LoaderData;
  const [script, setScript] = React.useState<string>(data.state.script);
  const [selectedPort, setSelectedPort] = React.useState<string>(
    data.state.portId || (data.ports[0]?.id ?? "")
  );
  const [enabled, setEnabled] = React.useState<boolean>(data.state.enabled);
  const [lastError, setLastError] = React.useState<string | null>(
    data.state.lastError
  );
  const [logs, setLogs] = React.useState<AutomationLogEntry[]>(
    data.state.logs || []
  );

  React.useEffect(() => {
    const es = new EventSource("/api/automation/stream");
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
          setEnabled(state.enabled);
        }
        if (Object.prototype.hasOwnProperty.call(state, "portId")) {
          setSelectedPort((current) => state.portId ?? current);
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
  }, []);

  async function saveScript() {
    await fetch("/api/automation/script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script }),
    });
  }

  async function enableAutomation() {
    if (!selectedPort) return;
    await fetch("/api/automation/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portId: selectedPort }),
    });
  }

  async function disableAutomation() {
    await fetch("/api/automation/disable", { method: "POST" });
  }

  function loadSample() {
    setScript(SAMPLE_SCRIPT);
  }

  function clearLogs() {
    setLogs([]);
  }

  return (
    <main className="p-4 container mx-auto space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Link className="text-blue-600 hover:underline" to="/ports">
            ← Ports
          </Link>
          <h1 className="text-2xl font-semibold">Automation Assistant</h1>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
            }`}
          >
            {enabled ? "ENABLED" : "DISABLED"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            value={selectedPort}
            onChange={(e) => setSelectedPort(e.target.value)}
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
            className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
          >
            Enable
          </button>
          <button
            onClick={disableAutomation}
            className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
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

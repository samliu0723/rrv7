import type { Route } from "./+types/ports";
import React from "react";
import { Link, useLoaderData } from "react-router";

export async function loader() {
  // Dynamically import server-only module to avoid bundling in client
  const { serialManager } = await import("../server/serial");
  const ports = serialManager.list();
  return Response.json({ ports });
}

export default function Ports() {
  const initial = useLoaderData() as any;
  const [ports, setPorts] = React.useState<Array<{ id: string; path: string; open: boolean }>>(
    (initial?.ports as any) || []
  );

  function refresh() {
    fetch("/api/ports")
      .then((r) => r.json())
      .then((j) => setPorts(j.ports || []))
      .catch(() => {});
  }

  async function open(id: string) {
    await fetch(`/api/ports/${id}/open`, { method: "POST" });
    refresh();
  }

  async function close(id: string) {
    await fetch(`/api/ports/${id}/close`, { method: "POST" });
    refresh();
  }

  return (
    <main className="p-4 container mx-auto space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">RS485 Ports</h1>
        <button
          className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 text-sm"
          onClick={refresh}
        >
          Refresh
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {ports.map((p) => (
          <div key={p.id} className="rounded-2xl border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-lg">{p.id}</div>
                <div className="text-sm text-gray-500">{p.path}</div>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  p.open ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                }`}
              >
                {p.open ? "OPEN" : "CLOSED"}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to={`/ports/${p.id}`}
                className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Open Console
              </Link>
              <Link
                to={`/ports/${p.id}/automation`}
                className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
              >
                Automation
              </Link>
              {p.open ? (
                <button
                  onClick={() => close(p.id)}
                  className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
                >
                  Close
                </button>
              ) : (
                <button
                  onClick={() => open(p.id)}
                  className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
                >
                  Open
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

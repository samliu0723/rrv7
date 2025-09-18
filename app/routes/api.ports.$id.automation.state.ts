import { automationManager } from "../server/automation";
import { serialManager } from "../server/serial";

export async function loader({ params }: { params: { id?: string } }) {
  const portId = params.id;
  if (!portId) {
    return new Response("Missing id", { status: 400 });
  }

  const ports = serialManager.list();
  const port = ports.find((p) => p.id === portId);
  if (!port) {
    return new Response("Unknown port", { status: 404 });
  }

  const state = automationManager.getState();
  return Response.json({ state, port, ports });
}

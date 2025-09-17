import { automationManager } from "../server/automation";

export function action({ params }: { params: { id?: string } }) {
  const id = params.id;
  if (!id) return new Response("Missing id", { status: 400 });
  const state = automationManager.getState();
  if (!state.enabled) {
    return new Response("Automation is disabled", { status: 409 });
  }
  if (state.portId !== id) {
    const message = state.portId
      ? `Automation is active on ${state.portId}, not ${id}`
      : "Automation is not enabled on this port";
    return new Response(message, { status: 409 });
  }
  automationManager.receiveClearLast();
  return Response.json({ ok: true, id });
}

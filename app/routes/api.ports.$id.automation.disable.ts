import { automationManager } from "../server/automation";

export async function action({ params }: { params: { id?: string } }) {
  const portId = params.id;
  if (!portId) {
    return new Response("Missing id", { status: 400 });
  }

  const state = automationManager.getState();
  if (state.enabled && state.portId && state.portId !== portId) {
    return new Response(`Automation is active on ${state.portId}`, {
      status: 409,
    });
  }

  automationManager.disable();
  return Response.json({ ok: true, portId });
}

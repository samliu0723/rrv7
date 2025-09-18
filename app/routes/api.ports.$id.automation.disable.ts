import { automationManager } from "../server/automation";

export async function action({ params }: { params: { id?: string } }) {
  const id = params.id;
  if (!id) return new Response("Missing id", { status: 400 });

  const state = automationManager.getState();
  if (!state.enabled) {
    return Response.json({ ok: true, disabled: true });
  }
  if (state.portId && state.portId !== id) {
    return new Response(`Automation is active on ${state.portId}`, {
      status: 409,
    });
  }

  automationManager.disable();
  return Response.json({ ok: true, portId: id });
}

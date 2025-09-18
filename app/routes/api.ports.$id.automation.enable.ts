import { automationManager } from "../server/automation";

export async function action({ params }: { params: { id?: string } }) {
  const id = params.id;
  if (!id) return new Response("Missing id", { status: 400 });

  const state = automationManager.getState();
  if (state.enabled && state.portId && state.portId !== id) {
    return new Response(`Automation already enabled on ${state.portId}`, {
      status: 409,
    });
  }

  try {
    await automationManager.enable(id);
    return Response.json({ ok: true, portId: id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(message, { status: 500 });
  }
}

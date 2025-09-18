import { automationManager } from "../server/automation";

export async function action({ params }: { params: { id?: string } }) {
  const portId = params.id;
  if (!portId) {
    return new Response("Missing id", { status: 400 });
  }

  try {
    await automationManager.enable(portId);
    return Response.json({ ok: true, portId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

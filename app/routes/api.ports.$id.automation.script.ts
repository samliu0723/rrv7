import { automationManager } from "../server/automation";

export async function action({
  params,
  request,
}: {
  params: { id?: string };
  request: Request;
}) {
  const id = params.id;
  if (!id) return new Response("Missing id", { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return new Response("Invalid payload", { status: 400 });
  }

  const script = (body as { script?: unknown }).script;
  if (typeof script !== "string") {
    return new Response("Missing script", { status: 400 });
  }

  automationManager.setScript(script);
  const state = automationManager.getState();
  return Response.json({
    ok: true,
    portId: state.portId,
    enabled: state.enabled,
    targetMatches: state.portId === id,
  });
}

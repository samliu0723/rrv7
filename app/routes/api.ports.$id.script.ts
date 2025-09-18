import { automationManager } from "../server/automation";

export async function action({
  params,
  request,
}: {
  params: { id?: string };
  request: Request;
}) {
  const portId = params.id;
  if (!portId) {
    return new Response("Missing id", { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const script =
    payload && typeof (payload as any).script === "string"
      ? (payload as any).script
      : "";
  automationManager.setScript(script);
  return Response.json({ ok: true, portId });
}

import { automationManager } from "../server/automation";

export async function action({ request }: { request: Request }) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const portId = body?.portId;
  if (typeof portId !== "string" || !portId) {
    return new Response("Missing portId", { status: 400 });
  }
  try {
    await automationManager.enable(portId);
    return Response.json({ ok: true, portId });
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

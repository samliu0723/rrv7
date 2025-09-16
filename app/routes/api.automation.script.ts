import { automationManager } from "../server/automation";

export async function action({ request }: { request: Request }) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const script = typeof body?.script === "string" ? body.script : "";
  automationManager.setScript(script);
  return Response.json({ ok: true });
}

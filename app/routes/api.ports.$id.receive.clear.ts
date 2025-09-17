import { automationManager } from "../server/automation";

export function action({ params }: { params: { id?: string } }) {
  const id = params.id;
  if (!id) return new Response("Missing id", { status: 400 });
  automationManager.receiveClear();
  return Response.json({ ok: true, id });
}

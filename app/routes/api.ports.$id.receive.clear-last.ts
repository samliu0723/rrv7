import { automationManager } from "../server/automation";

export function action({ params }: { params: { id?: string } }) {
  const id = params.id;
  if (!id) return new Response("Missing id", { status: 400 });
  automationManager.receiveClearLast();
  return Response.json({ ok: true, id });
}

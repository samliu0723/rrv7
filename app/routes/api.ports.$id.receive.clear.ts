import { ensureAutomationActiveForPort } from "../server/automation";
import { portService } from "../server/port-service";

export function action({ params }: { params: { id?: string } }) {
  const id = params.id;
  if (!id) return new Response("Missing id", { status: 400 });
  const guard = ensureAutomationActiveForPort(id);
  if (!guard.ok) {
    return new Response(guard.reason, { status: 409 });
  }
  portService.receiveClear(id);
  return Response.json({ ok: true, id });
}

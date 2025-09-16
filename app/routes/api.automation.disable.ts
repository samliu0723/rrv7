import { automationManager } from "../server/automation";

export async function action() {
  automationManager.disable();
  return Response.json({ ok: true });
}

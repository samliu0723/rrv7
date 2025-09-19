import { ensureAutomationActiveForPort } from "../server/automation";
import { portService } from "../server/port-service";

export async function action({
  params,
  request,
}: {
  params: { id?: string };
  request: Request;
}) {
  const id = params.id;
  if (!id) return new Response("Missing id", { status: 400 });

  const guard = ensureAutomationActiveForPort(id);
  if (!guard.ok) {
    return new Response(guard.reason, { status: 409 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!payload || typeof payload !== "object") {
    return new Response("Invalid payload", { status: 400 });
  }

  const { message, color } = payload as {
    message?: unknown;
    color?: unknown;
  };
  if (typeof message !== "string") {
    return new Response("Missing 'message'", { status: 400 });
  }

  const colorValue = typeof color === "string" ? color : undefined;
  portService.receiveWrite(id, message, colorValue);
  return Response.json({ ok: true, id });
}

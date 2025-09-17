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
  automationManager.receiveWriteLine(message, colorValue);
  return Response.json({ ok: true, id });
}

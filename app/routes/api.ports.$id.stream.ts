import { sseStreamForPort, serialManager } from "../server/serial";

export async function loader({ params }: { params: { id?: string } }) {
  const id = params.id;
  if (!id) return new Response("Missing id", { status: 400 });
  // Ensure open (no-op if already open). If not desired, remove this line and require explicit open.
  try {
    await serialManager.open(id);
  } catch (e) {
    // ignore open errors for stream; still return SSE for status/errors
  }
  const stream = sseStreamForPort(id);
  return new Response(stream as any, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

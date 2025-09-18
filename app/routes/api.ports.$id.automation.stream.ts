import { automationSseStream } from "../server/automation";
import { serialManager } from "../server/serial";

export async function loader({ params }: { params: { id?: string } }) {
  const portId = params.id;
  if (!portId) {
    return new Response("Missing id", { status: 400 });
  }

  const exists = serialManager.list().some((port) => port.id === portId);
  if (!exists) {
    return new Response("Unknown port", { status: 404 });
  }

  const stream = automationSseStream(portId);
  return new Response(stream as any, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

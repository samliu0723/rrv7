import { automationSseStream } from "../server/automation";

export async function loader({ params }: { params: { id?: string } }) {
  const id = params.id;
  if (!id) throw new Response("Missing id", { status: 400 });

  const { serialManager } = await import("../server/serial");
  const exists = serialManager.list().some((p) => p.id === id);
  if (!exists) throw new Response("Port not found", { status: 404 });

  const stream = automationSseStream();
  return new Response(stream as any, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

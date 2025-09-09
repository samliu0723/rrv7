import { serialManager } from "../server/serial";

export async function action({ params, request }: { params: { id?: string }; request: Request }) {
  const id = params.id;
  if (!id) return new Response("Missing id", { status: 400 });
  let body: any = {};
  try {
    body = await request.json();
  } catch {}
  const baudRate = Number(body?.baudRate ?? process.env.RS485_DEFAULT_BAUD ?? 9600);
  try {
    await serialManager.open(id, { baudRate });
    return Response.json({ ok: true, id, baudRate });
  } catch (e: any) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

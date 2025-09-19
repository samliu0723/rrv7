import { portService } from "../server/port-service";

export async function action({ params, request }: { params: { id?: string }; request: Request }) {
  const id = params.id;
  if (!id) return new Response("Missing id", { status: 400 });
  let body: any = {};
  try {
    body = await request.json();
  } catch {}
  const text: string | undefined = body?.text;
  const hex: string | undefined = body?.hex;
  try {
    if (typeof text === "string") {
      await portService.sendText(id, text);
    } else if (typeof hex === "string") {
      await portService.sendHex(id, hex);
    } else {
      return new Response("Missing 'text' or 'hex'", { status: 400 });
    }
    return Response.json({ ok: true, id });
  } catch (e: any) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

import { serialManager } from "../server/serial";

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
      await serialManager.write(id, text);
    } else if (typeof hex === "string") {
      const clean = hex.replace(/[^0-9a-fA-F]/g, "");
      const buf = Buffer.from(clean, "hex");
      await serialManager.write(id, buf);
    } else {
      return new Response("Missing 'text' or 'hex'", { status: 400 });
    }
    return Response.json({ ok: true, id });
  } catch (e: any) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

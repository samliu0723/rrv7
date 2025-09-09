import { serialManager } from "../server/serial";

export async function action({ params }: { params: { id?: string } }) {
  const id = params.id;
  if (!id) return new Response("Missing id", { status: 400 });
  try {
    await serialManager.close(id);
    return Response.json({ ok: true, id });
  } catch (e: any) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

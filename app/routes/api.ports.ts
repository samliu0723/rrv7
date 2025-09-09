import { serialManager } from "../server/serial";

export async function loader() {
  const list = serialManager.list();
  return Response.json({ ports: list });
}


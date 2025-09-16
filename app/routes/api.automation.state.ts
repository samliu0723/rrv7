import { automationManager } from "../server/automation";
import { serialManager } from "../server/serial";

export async function loader() {
  const state = automationManager.getState();
  const ports = serialManager.list();
  return Response.json({ ...state, ports });
}

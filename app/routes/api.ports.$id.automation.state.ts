export async function loader({ params }: { params: { id?: string } }) {
  const id = params.id;
  if (!id) throw new Response("Missing id", { status: 400 });

  const [{ automationManager }, { serialManager }] = await Promise.all([
    import("../server/automation"),
    import("../server/serial"),
  ]);

  const ports = serialManager.list();
  const port = ports.find((p) => p.id === id);
  if (!port) throw new Response("Port not found", { status: 404 });

  const state = automationManager.getState();
  return Response.json({
    port,
    state,
    activeOnRequestedPort: state.portId === id,
  });
}

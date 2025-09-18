import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("ports", "routes/ports.tsx"),
  route("ports/:id", "routes/ports.$id.tsx"),
  route("ports/:id/script", "routes/ports.$id.script.tsx"),
  route("api/ports", "routes/api.ports.ts"),
  route("api/ports/:id/open", "routes/api.ports.$id.open.ts"),
  route("api/ports/:id/close", "routes/api.ports.$id.close.ts"),
  route("api/ports/:id/write", "routes/api.ports.$id.write.ts"),
  route("api/ports/:id/baud", "routes/api.ports.$id.baud.ts"),
  route("api/ports/:id/stream", "routes/api.ports.$id.stream.ts"),
  route("api/ports/:id/receive/write", "routes/api.ports.$id.receive.write.ts"),
  route(
    "api/ports/:id/receive/write-line",
    "routes/api.ports.$id.receive.write-line.ts"
  ),
  route("api/ports/:id/receive/clear", "routes/api.ports.$id.receive.clear.ts"),
  route(
    "api/ports/:id/receive/clear-last",
    "routes/api.ports.$id.receive.clear-last.ts"
  ),
  route(
    "api/ports/:id/automation/state",
    "routes/api.ports.$id.automation.state.ts"
  ),
  route(
    "api/ports/:id/automation/enable",
    "routes/api.ports.$id.automation.enable.ts"
  ),
  route(
    "api/ports/:id/automation/disable",
    "routes/api.ports.$id.automation.disable.ts"
  ),
  route(
    "api/ports/:id/automation/stream",
    "routes/api.ports.$id.automation.stream.ts"
  ),
  route("api/ports/:id/script", "routes/api.ports.$id.script.ts"),
] satisfies RouteConfig;

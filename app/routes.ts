import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("ports", "routes/ports.tsx"),
  route("ports/:id", "routes/ports.$id.tsx"),
  route("automation", "routes/automation.tsx"),
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
  route("api/automation/state", "routes/api.automation.state.ts"),
  route("api/automation/script", "routes/api.automation.script.ts"),
  route("api/automation/enable", "routes/api.automation.enable.ts"),
  route("api/automation/disable", "routes/api.automation.disable.ts"),
  route("api/automation/stream", "routes/api.automation.stream.ts"),
] satisfies RouteConfig;

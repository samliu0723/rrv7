import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("ports", "routes/ports.tsx"),
  route("ports/:id", "routes/ports.$id.tsx"),
  route("api/ports", "routes/api.ports.ts"),
  route("api/ports/:id/open", "routes/api.ports.$id.open.ts"),
  route("api/ports/:id/close", "routes/api.ports.$id.close.ts"),
  route("api/ports/:id/write", "routes/api.ports.$id.write.ts"),
  route("api/ports/:id/baud", "routes/api.ports.$id.baud.ts"),
  route("api/ports/:id/stream", "routes/api.ports.$id.stream.ts"),
] satisfies RouteConfig;

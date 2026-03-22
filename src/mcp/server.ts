import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ManagedRuntime } from "effect";
import type { NatsError } from "../domain/errors.ts";
import type { NatsClient } from "../domain/NatsClient.ts";
import { registerCoreTools } from "./tools/core.ts";
import { registerKvTools } from "./tools/kv.ts";
import { registerServerTools } from "./tools/server.ts";
import { registerStreamTools } from "./tools/streams.ts";

export const createMcpServer = (
  runtime: ManagedRuntime.ManagedRuntime<NatsClient, NatsError>,
): McpServer => {
  const server = new McpServer({
    name: "nats-mcp-server",
    version: "1.0.0",
  });

  registerCoreTools(server, runtime);
  registerStreamTools(server, runtime);
  registerKvTools(server, runtime);
  registerServerTools(server, runtime);

  return server;
};

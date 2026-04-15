import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ManagedRuntime } from "effect";
import { Effect } from "effect";
import type { NatsError } from "../../domain/errors.ts";
import { NatsClient } from "../../domain/NatsClient.ts";
import { formatSuccess, runTool } from "../utils.ts";

export const registerServerTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<NatsClient, NatsError>,
) => {
  server.tool(
    "server_info",
    "Get information about the connected NATS server. Returns ServerInfo { serverId, version, host, port, maxPayload }.",
    {},
    {
      title: "NATS Server Info",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async () =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* NatsClient;
          return yield* client.serverInfo();
        }),
        formatSuccess,
      ),
  );
};

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ManagedRuntime } from "effect";
import { Effect } from "effect";
import { z } from "zod";
import type { NatsError } from "../../domain/errors.ts";
import { NatsClient } from "../../domain/NatsClient.ts";
import { formatSuccess, runTool } from "../utils.ts";

export const registerCoreTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<NatsClient, NatsError>,
) => {
  server.tool(
    "publish",
    "Publish a message to a NATS subject. Returns void on success.",
    {
      subject: z.string().describe("The NATS subject to publish to"),
      payload: z.string().describe("The message payload as a string"),
    },
    {
      title: "Publish NATS Message",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ subject, payload }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* NatsClient;
          yield* client.publish(subject, payload);
        }),
        () => formatSuccess({ ok: true }),
      ),
  );

  server.tool(
    "request",
    "Send a request to a NATS subject and await a reply. Returns NatsMessage { subject, payload }.",
    {
      subject: z.string().describe("The NATS subject to send the request to"),
      payload: z.string().describe("The request payload as a string"),
      timeoutMs: z.number().optional().describe("Timeout in milliseconds (default: 5000)"),
    },
    {
      title: "NATS Request/Reply",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ subject, payload, timeoutMs }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* NatsClient;
          return yield* client.request(subject, payload, timeoutMs);
        }),
        formatSuccess,
      ),
  );
};

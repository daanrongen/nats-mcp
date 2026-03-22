import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ManagedRuntime } from "effect";
import { Effect } from "effect";
import { z } from "zod";
import { NatsClient } from "../../domain/NatsClient.ts";
import type { NatsError } from "../../domain/errors.ts";
import { formatError, formatSuccess } from "../utils.ts";

export const registerCoreTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<NatsClient, NatsError>,
) => {
  server.tool(
    "nats_publish",
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
    async ({ subject, payload }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* NatsClient;
          yield* client.publish(subject, payload);
        }),
      );
      if (result._tag === "Failure") {
        return formatError(result.cause);
      }
      return formatSuccess({ ok: true });
    },
  );

  server.tool(
    "nats_request",
    "Send a request to a NATS subject and await a reply. Returns NatsMessage { subject, payload }.",
    {
      subject: z.string().describe("The NATS subject to send the request to"),
      payload: z.string().describe("The request payload as a string"),
      timeoutMs: z
        .number()
        .optional()
        .describe("Timeout in milliseconds (default: 5000)"),
    },
    {
      title: "NATS Request/Reply",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ subject, payload, timeoutMs }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* NatsClient;
          return yield* client.request(subject, payload, timeoutMs);
        }),
      );
      if (result._tag === "Failure") {
        return formatError(result.cause);
      }
      return formatSuccess(result.value);
    },
  );
};

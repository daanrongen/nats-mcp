import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ManagedRuntime } from "effect";
import { Effect } from "effect";
import { z } from "zod";
import { NatsClient } from "../../domain/NatsClient.ts";
import type { NatsError } from "../../domain/errors.ts";
import { StreamConfig } from "../../domain/models.ts";
import { formatError, formatSuccess } from "../utils.ts";

export const registerStreamTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<NatsClient, NatsError>,
) => {
  server.tool(
    "nats_stream_list",
    "List all JetStream streams. Returns StreamInfo[] { name, subjects, numMessages, numBytes }.",
    {},
    {
      title: "List JetStream Streams",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async () => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* NatsClient;
          return yield* client.streamList();
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "nats_stream_info",
    "Get info about a specific JetStream stream. Returns StreamInfo { name, subjects, numMessages, numBytes }.",
    {
      name: z.string().describe("Stream name"),
    },
    {
      title: "Get Stream Info",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ name }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* NatsClient;
          return yield* client.streamInfo(name);
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "nats_stream_create",
    "Create a new JetStream stream. Returns StreamInfo { name, subjects, numMessages, numBytes }.",
    {
      name: z.string().describe("Stream name"),
      subjects: z.array(z.string()).describe("Subjects to bind to the stream"),
      maxMessages: z
        .number()
        .optional()
        .describe("Maximum number of messages to retain"),
      maxBytes: z.number().optional().describe("Maximum bytes to retain"),
      maxAge: z
        .number()
        .optional()
        .describe("Maximum age of messages in nanoseconds"),
    },
    {
      title: "Create JetStream Stream",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ name, subjects, maxMessages, maxBytes, maxAge }) => {
      const config = new StreamConfig({
        name,
        subjects,
        ...(maxMessages !== undefined && { maxMessages }),
        ...(maxBytes !== undefined && { maxBytes }),
        ...(maxAge !== undefined && { maxAge }),
      });
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* NatsClient;
          return yield* client.streamCreate(config);
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "nats_stream_delete",
    "Delete a JetStream stream and all its messages. Returns { ok: true } on success.",
    {
      name: z.string().describe("Stream name to delete"),
    },
    {
      title: "Delete JetStream Stream",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ name }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* NatsClient;
          yield* client.streamDelete(name);
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess({ ok: true });
    },
  );

  server.tool(
    "nats_stream_publish",
    "Publish a message to a JetStream stream. Returns PublishAck { stream, seq, duplicate }.",
    {
      subject: z.string().describe("Subject to publish to"),
      payload: z.string().describe("Message payload"),
    },
    {
      title: "Publish to JetStream",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ subject, payload }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* NatsClient;
          return yield* client.streamPublish(subject, payload);
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "nats_stream_fetch",
    "Fetch messages from a JetStream consumer. Returns NatsMessage[] { subject, payload }.",
    {
      stream: z.string().describe("Stream name"),
      consumer: z.string().describe("Consumer name"),
      count: z
        .number()
        .int()
        .positive()
        .describe("Number of messages to fetch"),
    },
    {
      title: "Fetch from JetStream Consumer",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ stream, consumer, count }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* NatsClient;
          return yield* client.streamFetch(stream, consumer, count);
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "nats_stream_consumer_create",
    "Create a durable consumer on a JetStream stream. Returns ConsumerInfo { name, streamName, numPending, numAckPending }.",
    {
      stream: z.string().describe("Stream name"),
      name: z.string().describe("Consumer name"),
      filterSubject: z.string().optional().describe("Optional subject filter"),
      deliverPolicy: z
        .string()
        .optional()
        .describe("Delivery policy (e.g. 'all', 'last', 'new')"),
      ackPolicy: z
        .string()
        .optional()
        .describe("Acknowledgment policy (e.g. 'explicit', 'none')"),
    },
    {
      title: "Create JetStream Consumer",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ stream, name, filterSubject, deliverPolicy, ackPolicy }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* NatsClient;
          return yield* client.streamConsumerCreate(stream, {
            name,
            ...(filterSubject !== undefined && { filterSubject }),
            ...(deliverPolicy !== undefined && { deliverPolicy }),
            ...(ackPolicy !== undefined && { ackPolicy }),
          } as import("../../domain/models.ts").ConsumerConfig);
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );
};

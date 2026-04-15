import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ManagedRuntime } from "effect";
import { Effect } from "effect";
import { z } from "zod";
import type { NatsError } from "../../domain/errors.ts";
import { ConsumerConfig, StreamConfig } from "../../domain/models.ts";
import { NatsClient } from "../../domain/NatsClient.ts";
import { formatSuccess, runTool } from "../utils.ts";

export const registerStreamTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<NatsClient, NatsError>,
) => {
  server.tool(
    "stream_list",
    "List all JetStream streams. Returns StreamInfo[] { name, subjects, numMessages, numBytes }.",
    {},
    {
      title: "List JetStream Streams",
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
          return yield* client.streamList();
        }),
        formatSuccess,
      ),
  );

  server.tool(
    "stream_info",
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
    async ({ name }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* NatsClient;
          return yield* client.streamInfo(name);
        }),
        formatSuccess,
      ),
  );

  server.tool(
    "stream_create",
    "Create a new JetStream stream. Returns StreamInfo { name, subjects, numMessages, numBytes }.",
    {
      name: z.string().describe("Stream name"),
      subjects: z.array(z.string()).describe("Subjects to bind to the stream"),
      maxMessages: z.number().optional().describe("Maximum number of messages to retain"),
      maxBytes: z.number().optional().describe("Maximum bytes to retain"),
      maxAge: z.number().optional().describe("Maximum age of messages in nanoseconds"),
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
      return runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* NatsClient;
          return yield* client.streamCreate(config);
        }),
        formatSuccess,
      );
    },
  );

  server.tool(
    "stream_delete",
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
    async ({ name }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* NatsClient;
          yield* client.streamDelete(name);
        }),
        () => formatSuccess({ ok: true }),
      ),
  );

  server.tool(
    "stream_publish",
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
    async ({ subject, payload }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* NatsClient;
          return yield* client.streamPublish(subject, payload);
        }),
        formatSuccess,
      ),
  );

  server.tool(
    "stream_fetch",
    "Fetch messages from a JetStream consumer. Returns NatsMessage[] { subject, payload }.",
    {
      stream: z.string().describe("Stream name"),
      consumer: z.string().describe("Consumer name"),
      count: z.number().int().positive().describe("Number of messages to fetch"),
    },
    {
      title: "Fetch from JetStream Consumer",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ stream, consumer, count }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* NatsClient;
          return yield* client.streamFetch(stream, consumer, count);
        }),
        formatSuccess,
      ),
  );

  server.tool(
    "stream_consumer_create",
    "Create a durable consumer on a JetStream stream. Returns ConsumerInfo { name, streamName, numPending, numAckPending }.",
    {
      stream: z.string().describe("Stream name"),
      name: z.string().describe("Consumer name"),
      filterSubject: z.string().optional().describe("Optional subject filter"),
      deliverPolicy: z.string().optional().describe("Delivery policy (e.g. 'all', 'last', 'new')"),
      ackPolicy: z.string().optional().describe("Acknowledgment policy (e.g. 'explicit', 'none')"),
    },
    {
      title: "Create JetStream Consumer",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ stream, name, filterSubject, deliverPolicy, ackPolicy }) => {
      const config = new ConsumerConfig({
        name,
        ...(filterSubject !== undefined && { filterSubject }),
        ...(deliverPolicy !== undefined && { deliverPolicy }),
        ...(ackPolicy !== undefined && { ackPolicy }),
      });
      return runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* NatsClient;
          return yield* client.streamConsumerCreate(stream, config);
        }),
        formatSuccess,
      );
    },
  );
};

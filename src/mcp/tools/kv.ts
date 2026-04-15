import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ManagedRuntime } from "effect";
import { Effect } from "effect";
import { z } from "zod";
import type { NatsError } from "../../domain/errors.ts";
import { NatsClient } from "../../domain/NatsClient.ts";
import { formatSuccess, runTool } from "../utils.ts";

export const registerKvTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<NatsClient, NatsError>,
) => {
  server.tool(
    "kv_create_bucket",
    "Create a KV bucket in NATS JetStream. Returns { ok: true } on success.",
    {
      bucket: z.string().describe("Bucket name"),
    },
    {
      title: "Create KV Bucket",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ bucket }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* NatsClient;
          yield* client.kvCreateBucket(bucket);
        }),
        () => formatSuccess({ ok: true }),
      ),
  );

  server.tool(
    "kv_list_buckets",
    "List all KV buckets. Returns string[] of bucket names.",
    {},
    {
      title: "List KV Buckets",
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
          return yield* client.kvListBuckets();
        }),
        formatSuccess,
      ),
  );

  server.tool(
    "kv_get",
    "Get a value from a KV bucket by key. Returns the value string.",
    {
      bucket: z.string().describe("Bucket name"),
      key: z.string().describe("Key to retrieve"),
    },
    {
      title: "KV Get",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ bucket, key }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* NatsClient;
          return yield* client.kvGet(bucket, key);
        }),
        (value) => formatSuccess({ value }),
      ),
  );

  server.tool(
    "kv_put",
    "Put a value into a KV bucket. Returns { ok: true } on success.",
    {
      bucket: z.string().describe("Bucket name"),
      key: z.string().describe("Key"),
      value: z.string().describe("Value to store"),
    },
    {
      title: "KV Put",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ bucket, key, value }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* NatsClient;
          yield* client.kvPut(bucket, key, value);
        }),
        () => formatSuccess({ ok: true }),
      ),
  );

  server.tool(
    "kv_delete",
    "Delete a key from a KV bucket. Returns { ok: true } on success.",
    {
      bucket: z.string().describe("Bucket name"),
      key: z.string().describe("Key to delete"),
    },
    {
      title: "KV Delete",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ bucket, key }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* NatsClient;
          yield* client.kvDelete(bucket, key);
        }),
        () => formatSuccess({ ok: true }),
      ),
  );

  server.tool(
    "kv_list_keys",
    "List all keys in a KV bucket. Returns string[] of keys.",
    {
      bucket: z.string().describe("Bucket name"),
    },
    {
      title: "KV List Keys",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ bucket }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* NatsClient;
          return yield* client.kvListKeys(bucket);
        }),
        formatSuccess,
      ),
  );

  server.tool(
    "kv_history",
    "Get the revision history for a key in a KV bucket. Returns KvEntry[] { bucket, key, value, revision, operation }.",
    {
      bucket: z.string().describe("Bucket name"),
      key: z.string().describe("Key to get history for"),
    },
    {
      title: "KV History",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ bucket, key }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* NatsClient;
          return yield* client.kvHistory(bucket, key);
        }),
        formatSuccess,
      ),
  );
};

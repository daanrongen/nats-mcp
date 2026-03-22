import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { KvNotFoundError } from "../../src/domain/errors.ts";
import { NatsClient } from "../../src/domain/NatsClient.ts";
import { NatsClientTest } from "../../src/infra/NatsClientTest.ts";

describe("kv", () => {
  it("creates a bucket and lists it", async () => {
    const buckets = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* NatsClient;
        yield* client.kvCreateBucket("my-bucket");
        return yield* client.kvListBuckets();
      }).pipe(Effect.provide(NatsClientTest)),
    );
    expect(buckets).toContain("my-bucket");
  });

  it("put and get a value", async () => {
    const value = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* NatsClient;
        yield* client.kvCreateBucket("config");
        yield* client.kvPut("config", "theme", "dark");
        return yield* client.kvGet("config", "theme");
      }).pipe(Effect.provide(NatsClientTest)),
    );
    expect(value).toBe("dark");
  });

  it("lists keys after multiple puts", async () => {
    const keys = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* NatsClient;
        yield* client.kvCreateBucket("settings");
        yield* client.kvPut("settings", "lang", "en");
        yield* client.kvPut("settings", "tz", "UTC");
        yield* client.kvPut("settings", "theme", "light");
        return yield* client.kvListKeys("settings");
      }).pipe(Effect.provide(NatsClientTest)),
    );
    expect(keys).toContain("lang");
    expect(keys).toContain("tz");
    expect(keys).toContain("theme");
  });

  it("delete removes a key", async () => {
    const keys = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* NatsClient;
        yield* client.kvCreateBucket("store");
        yield* client.kvPut("store", "a", "1");
        yield* client.kvPut("store", "b", "2");
        yield* client.kvDelete("store", "a");
        return yield* client.kvListKeys("store");
      }).pipe(Effect.provide(NatsClientTest)),
    );
    expect(keys).not.toContain("a");
    expect(keys).toContain("b");
  });

  it("get on missing key returns KvNotFoundError", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* NatsClient;
        yield* client.kvCreateBucket("empty");
        return yield* Effect.either(client.kvGet("empty", "missing-key"));
      }).pipe(Effect.provide(NatsClientTest)),
    );
    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(result.left).toBeInstanceOf(KvNotFoundError);
      const err = result.left as KvNotFoundError;
      expect(err.bucket).toBe("empty");
      expect(err.key).toBe("missing-key");
    }
  });

  it("get on missing bucket returns NatsError", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* NatsClient;
        return yield* Effect.either(client.kvGet("nonexistent-bucket", "key"));
      }).pipe(Effect.provide(NatsClientTest)),
    );
    expect(result._tag).toBe("Left");
  });

  it("kvHistory tracks revisions", async () => {
    const history = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* NatsClient;
        yield* client.kvCreateBucket("tracked");
        yield* client.kvPut("tracked", "counter", "1");
        yield* client.kvPut("tracked", "counter", "2");
        yield* client.kvPut("tracked", "counter", "3");
        return yield* client.kvHistory("tracked", "counter");
      }).pipe(Effect.provide(NatsClientTest)),
    );
    expect(history).toHaveLength(3);
    expect(history[0]?.value).toBe("1");
    expect(history[1]?.value).toBe("2");
    expect(history[2]?.value).toBe("3");
    expect(history[0]?.operation).toBe("PUT");
  });

  it("create bucket is idempotent", async () => {
    const buckets = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* NatsClient;
        yield* client.kvCreateBucket("idempotent");
        yield* client.kvCreateBucket("idempotent");
        return yield* client.kvListBuckets();
      }).pipe(Effect.provide(NatsClientTest)),
    );
    const count = buckets.filter((b) => b === "idempotent").length;
    expect(count).toBe(1);
  });
});

import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { NatsClient } from "../../src/domain/NatsClient.ts";
import { NatsClientTest } from "../../src/infra/NatsClientTest.ts";

describe("core", () => {
  it("publish completes without error", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* NatsClient;
        return yield* client.publish("test.subject", "hello");
      }).pipe(Effect.provide(NatsClientTest)),
    );
    expect(result).toBeUndefined();
  });

  it("request returns a NatsMessage with the given subject", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* NatsClient;
        return yield* client.request("test.subject", "ping");
      }).pipe(Effect.provide(NatsClientTest)),
    );
    expect(result.subject).toBe("test.subject");
    expect(result.payload).toBe("ping");
  });

  it("publish multiple subjects without error", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* NatsClient;
        yield* client.publish("a.b", "msg1");
        yield* client.publish("a.c", "msg2");
        yield* client.publish("a.d", "msg3");
      }).pipe(Effect.provide(NatsClientTest)),
    );
    expect(result).toBeUndefined();
  });

  it("request echoes payload by default", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* NatsClient;
        return yield* client.request("echo.test", "hello world", 1000);
      }).pipe(Effect.provide(NatsClientTest)),
    );
    expect(result.payload).toBe("hello world");
  });
});

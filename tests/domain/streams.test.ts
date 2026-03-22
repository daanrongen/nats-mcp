import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { NatsClient } from "../../src/domain/NatsClient.ts";
import { StreamConfig } from "../../src/domain/models.ts";
import { NatsClientTest } from "../../src/infra/NatsClientTest.ts";

describe("streams", () => {
  it("creates a stream and retrieves it via streamInfo", async () => {
    const info = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* NatsClient;
        const config = new StreamConfig({
          name: "ORDERS",
          subjects: ["orders.>"],
        });
        return yield* client.streamCreate(config);
      }).pipe(Effect.provide(NatsClientTest)),
    );
    expect(info.name).toBe("ORDERS");
    expect(info.subjects).toContain("orders.>");
    expect(info.numMessages).toBe(0);
  });

  it("lists created streams", async () => {
    const streams = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* NatsClient;
        yield* client.streamCreate(
          new StreamConfig({ name: "S1", subjects: ["s1.>"] }),
        );
        yield* client.streamCreate(
          new StreamConfig({ name: "S2", subjects: ["s2.>"] }),
        );
        return yield* client.streamList();
      }).pipe(Effect.provide(NatsClientTest)),
    );
    const names = streams.map((s) => s.name);
    expect(names).toContain("S1");
    expect(names).toContain("S2");
  });

  it("publishes to a stream and fetches messages", async () => {
    const messages = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* NatsClient;
        yield* client.streamCreate(
          new StreamConfig({ name: "EVENTS", subjects: ["events.>"] }),
        );
        yield* client.streamConsumerCreate("EVENTS", {
          name: "my-consumer",
        } as import("../../src/domain/models.ts").ConsumerConfig);
        yield* client.streamPublish("events.created", "event-1");
        yield* client.streamPublish("events.updated", "event-2");
        return yield* client.streamFetch("EVENTS", "my-consumer", 10);
      }).pipe(Effect.provide(NatsClientTest)),
    );
    expect(messages).toHaveLength(2);
    expect(messages[0]?.payload).toBe("event-1");
    expect(messages[1]?.payload).toBe("event-2");
  });

  it("deletes a stream", async () => {
    const streams = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* NatsClient;
        yield* client.streamCreate(
          new StreamConfig({ name: "TEMP", subjects: ["temp.>"] }),
        );
        yield* client.streamDelete("TEMP");
        return yield* client.streamList();
      }).pipe(Effect.provide(NatsClientTest)),
    );
    expect(streams.map((s) => s.name)).not.toContain("TEMP");
  });

  it("creates a consumer and returns ConsumerInfo", async () => {
    const info = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* NatsClient;
        yield* client.streamCreate(
          new StreamConfig({ name: "WORK", subjects: ["work.>"] }),
        );
        return yield* client.streamConsumerCreate("WORK", {
          name: "worker-1",
          filterSubject: "work.tasks",
        } as import("../../src/domain/models.ts").ConsumerConfig);
      }).pipe(Effect.provide(NatsClientTest)),
    );
    expect(info.name).toBe("worker-1");
    expect(info.streamName).toBe("WORK");
  });

  it("streamPublish fails when no stream matches", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* NatsClient;
        return yield* Effect.either(
          client.streamPublish("unmatched.subject", "data"),
        );
      }).pipe(Effect.provide(NatsClientTest)),
    );
    expect(result._tag).toBe("Left");
  });
});

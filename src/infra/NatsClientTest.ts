import { Effect, Layer, Ref } from "effect";
import { NatsClient } from "../domain/NatsClient.ts";
import { KvNotFoundError, NatsError } from "../domain/errors.ts";
import {
  ConsumerInfo,
  KvEntry,
  NatsMessage,
  PublishAck,
  ServerInfo,
  StreamInfo,
} from "../domain/models.ts";

type KvStore = Map<string, { value: string; revision: number }>;
type KvHistory = Map<string, KvEntry[]>;

export const NatsClientTest = Layer.effect(
  NatsClient,
  Effect.gen(function* () {
    // Streams
    const streamsRef = yield* Ref.make<Map<string, StreamInfo>>(new Map());
    const streamMessagesRef = yield* Ref.make<Map<string, NatsMessage[]>>(
      new Map(),
    );
    const consumersRef = yield* Ref.make<Map<string, ConsumerInfo>>(new Map());

    // KV
    const kvBucketsRef = yield* Ref.make<Map<string, KvStore>>(new Map());
    const kvHistoriesRef = yield* Ref.make<Map<string, KvHistory>>(new Map());

    const requireBucket = (bucket: string) =>
      Effect.gen(function* () {
        const buckets = yield* Ref.get(kvBucketsRef);
        const store = buckets.get(bucket);
        if (!store) {
          return yield* Effect.fail(
            new NatsError({ message: `Bucket ${bucket} not found` }),
          );
        }
        return store;
      });

    return NatsClient.of({
      publish: (subject, payload) =>
        Effect.sync(() => {
          void subject;
          void payload;
        }),

      request: (subject, payload, _timeoutMs) =>
        Effect.succeed(new NatsMessage({ subject, payload })),

      streamList: () =>
        Ref.get(streamsRef).pipe(Effect.map((m) => [...m.values()])),

      streamInfo: (name) =>
        Effect.gen(function* () {
          const m = yield* Ref.get(streamsRef);
          const info = m.get(name);
          if (!info) {
            return yield* Effect.fail(
              new NatsError({ message: `Stream ${name} not found` }),
            );
          }
          return info;
        }),

      streamCreate: (config) =>
        Effect.gen(function* () {
          const info = new StreamInfo({
            name: config.name,
            subjects: [...config.subjects],
            numMessages: 0,
            numBytes: 0,
          });
          yield* Ref.update(streamsRef, (m) =>
            new Map(m).set(config.name, info),
          );
          yield* Ref.update(streamMessagesRef, (m) =>
            new Map(m).set(config.name, []),
          );
          return info;
        }),

      streamDelete: (name) =>
        Effect.gen(function* () {
          yield* Ref.update(streamsRef, (m) => {
            const next = new Map(m);
            next.delete(name);
            return next;
          });
          yield* Ref.update(streamMessagesRef, (m) => {
            const next = new Map(m);
            next.delete(name);
            return next;
          });
        }),

      streamPublish: (subject, payload) =>
        Effect.gen(function* () {
          const m = yield* Ref.get(streamsRef);
          let targetStream: string | undefined;
          for (const [name, info] of m) {
            const subjects = [...info.subjects];
            if (
              subjects.some(
                (s) => s === subject || s.endsWith(">") || s.includes("*"),
              )
            ) {
              targetStream = name;
              break;
            }
          }
          if (!targetStream) {
            return yield* Effect.fail(
              new NatsError({
                message: `No stream found for subject ${subject}`,
              }),
            );
          }
          const msg = new NatsMessage({ subject, payload });
          const streamName = targetStream;
          yield* Ref.update(streamMessagesRef, (msgs) => {
            const next = new Map(msgs);
            const existing = next.get(streamName) ?? [];
            next.set(streamName, [...existing, msg]);
            return next;
          });
          const msgsMap = yield* Ref.get(streamMessagesRef);
          const seq = (msgsMap.get(streamName) ?? []).length;
          return new PublishAck({ stream: streamName, seq, duplicate: false });
        }),

      streamFetch: (stream, _consumer, count) =>
        Effect.gen(function* () {
          const msgsMap = yield* Ref.get(streamMessagesRef);
          const all = msgsMap.get(stream) ?? [];
          return all.slice(0, count);
        }),

      streamConsumerCreate: (stream, config) =>
        Effect.gen(function* () {
          const info = new ConsumerInfo({
            name: config.name,
            streamName: stream,
            numPending: 0,
            numAckPending: 0,
          });
          const key = `${stream}:${config.name}`;
          yield* Ref.update(consumersRef, (m) => new Map(m).set(key, info));
          return info;
        }),

      kvCreateBucket: (bucket) =>
        Effect.gen(function* () {
          yield* Ref.update(kvBucketsRef, (m) => {
            if (m.has(bucket)) return m;
            return new Map(m).set(bucket, new Map());
          });
          yield* Ref.update(kvHistoriesRef, (m) => {
            if (m.has(bucket)) return m;
            return new Map(m).set(bucket, new Map());
          });
        }),

      kvListBuckets: () =>
        Ref.get(kvBucketsRef).pipe(Effect.map((m) => [...m.keys()])),

      kvGet: (bucket, key) =>
        Effect.gen(function* () {
          const store = yield* requireBucket(bucket);
          const entry = store.get(key);
          if (!entry) {
            return yield* Effect.fail(new KvNotFoundError({ bucket, key }));
          }
          return entry.value;
        }),

      kvPut: (bucket, key, value) =>
        Effect.gen(function* () {
          yield* requireBucket(bucket);
          yield* Ref.update(kvBucketsRef, (buckets) => {
            const next = new Map(buckets);
            const existing = next.get(bucket);
            const store = new Map(
              existing ??
                new Map<string, { value: string; revision: number }>(),
            );
            const prev = store.get(key);
            const revision = (prev?.revision ?? 0) + 1;
            store.set(key, { value, revision });
            next.set(bucket, store);
            return next;
          });
          const buckets = yield* Ref.get(kvBucketsRef);
          const revision = buckets.get(bucket)?.get(key)?.revision ?? 1;
          yield* Ref.update(kvHistoriesRef, (histories) => {
            const next = new Map(histories);
            const history = new Map(
              next.get(bucket) ?? new Map<string, KvEntry[]>(),
            );
            const existing = history.get(key) ?? [];
            history.set(key, [
              ...existing,
              new KvEntry({ bucket, key, value, revision, operation: "PUT" }),
            ]);
            next.set(bucket, history);
            return next;
          });
        }),

      kvDelete: (bucket, key) =>
        Effect.gen(function* () {
          yield* requireBucket(bucket);
          yield* Ref.update(kvBucketsRef, (buckets) => {
            const next = new Map(buckets);
            const existing = next.get(bucket);
            const store = new Map(
              existing ??
                new Map<string, { value: string; revision: number }>(),
            );
            store.delete(key);
            next.set(bucket, store);
            return next;
          });
        }),

      kvListKeys: (bucket) =>
        Effect.gen(function* () {
          const store = yield* requireBucket(bucket);
          return [...store.keys()];
        }),

      kvHistory: (bucket, key) =>
        Effect.gen(function* () {
          const histories = yield* Ref.get(kvHistoriesRef);
          const bucketHistory = histories.get(bucket);
          if (!bucketHistory) {
            return yield* Effect.fail(
              new NatsError({ message: `Bucket ${bucket} not found` }),
            );
          }
          return bucketHistory.get(key) ?? [];
        }),

      serverInfo: () =>
        Effect.succeed(
          new ServerInfo({
            serverId: "test-server-id",
            version: "2.10.0",
            host: "localhost",
            port: 4222,
            maxPayload: 1048576,
          }),
        ),
    });
  }),
);

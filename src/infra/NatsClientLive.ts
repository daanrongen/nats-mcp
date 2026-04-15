import { Effect, Layer } from "effect";
import {
  AckPolicy,
  connect,
  DeliverPolicy,
  type JetStreamClient,
  type KV,
  type NatsConnection,
  type ConsumerConfig as NatsConsumerConfig,
  type StreamConfig as NatsStreamConfig,
  ReplayPolicy,
  StringCodec,
} from "nats";
import { NatsConfig } from "../config.ts";
import { KvNotFoundError, NatsError } from "../domain/errors.ts";
import {
  ConsumerInfo,
  KvEntry,
  NatsMessage,
  PublishAck,
  ServerInfo,
  StreamInfo,
} from "../domain/models.ts";
import { NatsClient } from "../domain/NatsClient.ts";

const sc = StringCodec();

const wrapNats = <A>(label: string, fn: () => Promise<A>): Effect.Effect<A, NatsError> =>
  Effect.tryPromise({
    try: fn,
    catch: (e) => new NatsError({ message: `${label} failed`, cause: e }),
  });

const getKv = (js: JetStreamClient, bucket: string): Effect.Effect<KV, NatsError> =>
  wrapNats(`kvGet bucket=${bucket}`, () => js.views.kv(bucket));

export const NatsClientLive = Layer.scoped(
  NatsClient,
  Effect.gen(function* () {
    const url = yield* Effect.orDie(NatsConfig);

    const conn: NatsConnection = yield* Effect.acquireRelease(
      wrapNats("connect", () => connect({ servers: url })),
      (c) => Effect.promise(() => c.drain()),
    );

    const js = conn.jetstream();

    return {
      publish: (subject, payload) =>
        wrapNats(`publish subject=${subject}`, async () => {
          conn.publish(subject, sc.encode(payload));
        }),

      request: (subject, payload, timeoutMs = 5000) =>
        wrapNats(`request subject=${subject}`, async () => {
          const msg = await conn.request(subject, sc.encode(payload), {
            timeout: timeoutMs,
          });
          return new NatsMessage({
            subject: msg.subject,
            payload: sc.decode(msg.data),
          });
        }),

      streamList: () =>
        wrapNats("streamList", async () => {
          const jsm = await conn.jetstreamManager();
          const streams: StreamInfo[] = [];
          const lister = jsm.streams.list();
          for await (const s of lister) {
            streams.push(
              new StreamInfo({
                name: s.config.name,
                subjects: s.config.subjects ?? [],
                numMessages: s.state.messages,
                numBytes: s.state.bytes,
              }),
            );
          }
          return streams;
        }),

      streamInfo: (name) =>
        wrapNats(`streamInfo name=${name}`, async () => {
          const jsm = await conn.jetstreamManager();
          const s = await jsm.streams.info(name);
          return new StreamInfo({
            name: s.config.name,
            subjects: s.config.subjects ?? [],
            numMessages: s.state.messages,
            numBytes: s.state.bytes,
          });
        }),

      streamCreate: (config) =>
        wrapNats(`streamCreate name=${config.name}`, async () => {
          const jsm = await conn.jetstreamManager();
          const streamCfg: Partial<NatsStreamConfig> = {
            name: config.name,
            subjects: [...config.subjects],
          };
          if (config.maxMessages !== undefined) {
            streamCfg.max_msgs = config.maxMessages;
          }
          if (config.maxBytes !== undefined) {
            streamCfg.max_bytes = config.maxBytes;
          }
          if (config.maxAge !== undefined) {
            streamCfg.max_age = config.maxAge;
          }
          const s = await jsm.streams.add(streamCfg);
          return new StreamInfo({
            name: s.config.name,
            subjects: s.config.subjects ?? [],
            numMessages: s.state.messages,
            numBytes: s.state.bytes,
          });
        }),

      streamDelete: (name) =>
        wrapNats(`streamDelete name=${name}`, async () => {
          const jsm = await conn.jetstreamManager();
          await jsm.streams.delete(name);
        }),

      streamPublish: (subject, payload) =>
        wrapNats(`streamPublish subject=${subject}`, async () => {
          const ack = await js.publish(subject, sc.encode(payload));
          return new PublishAck({
            stream: ack.stream,
            seq: ack.seq,
            duplicate: ack.duplicate,
          });
        }),

      streamFetch: (stream, consumer, count) =>
        wrapNats(`streamFetch stream=${stream} consumer=${consumer}`, async () => {
          const c = await js.consumers.get(stream, consumer);
          const msgs: NatsMessage[] = [];
          const iter = await c.fetch({ max_messages: count });
          for await (const msg of iter) {
            msgs.push(
              new NatsMessage({
                subject: msg.subject,
                payload: sc.decode(msg.data),
              }),
            );
            msg.ack();
          }
          return msgs;
        }),

      streamConsumerCreate: (stream, config) =>
        wrapNats(`streamConsumerCreate stream=${stream} name=${config.name}`, async () => {
          const jsm = await conn.jetstreamManager();

          const ackPolicyMap: Record<string, AckPolicy> = {
            none: AckPolicy.None,
            all: AckPolicy.All,
            explicit: AckPolicy.Explicit,
          };
          const deliverPolicyMap: Record<string, DeliverPolicy> = {
            all: DeliverPolicy.All,
            last: DeliverPolicy.Last,
            new: DeliverPolicy.New,
            by_start_sequence: DeliverPolicy.StartSequence,
            by_start_time: DeliverPolicy.StartTime,
            last_per_subject: DeliverPolicy.LastPerSubject,
          };

          const consumerCfg: NatsConsumerConfig = {
            name: config.name,
            durable_name: config.name,
            ack_policy:
              config.ackPolicy !== undefined
                ? (ackPolicyMap[config.ackPolicy] ?? AckPolicy.Explicit)
                : AckPolicy.Explicit,
            deliver_policy:
              config.deliverPolicy !== undefined
                ? (deliverPolicyMap[config.deliverPolicy] ?? DeliverPolicy.All)
                : DeliverPolicy.All,
            replay_policy: ReplayPolicy.Instant,
          };
          if (config.filterSubject !== undefined) {
            consumerCfg.filter_subject = config.filterSubject;
          }
          const info = await jsm.consumers.add(stream, consumerCfg);
          return new ConsumerInfo({
            name: info.name,
            streamName: info.stream_name,
            numPending: info.num_pending,
            numAckPending: info.num_ack_pending,
          });
        }),

      kvCreateBucket: (bucket) =>
        wrapNats(`kvCreateBucket bucket=${bucket}`, async () => {
          await js.views.kv(bucket, { history: 64 });
        }),

      kvListBuckets: () =>
        wrapNats("kvListBuckets", async () => {
          const jsm = await conn.jetstreamManager();
          const buckets: string[] = [];
          const lister = jsm.streams.list();
          for await (const s of lister) {
            const name = s.config.name;
            if (name.startsWith("KV_")) {
              buckets.push(name.slice(3));
            }
          }
          return buckets;
        }),

      kvGet: (bucket, key) =>
        Effect.gen(function* () {
          const kv = yield* getKv(js, bucket);
          const entry = yield* wrapNats(`kvGet bucket=${bucket} key=${key}`, () => kv.get(key));
          if (entry === null) {
            return yield* Effect.fail(new KvNotFoundError({ bucket, key }));
          }
          return sc.decode(entry.value);
        }),

      kvPut: (bucket, key, value) =>
        Effect.gen(function* () {
          const kv = yield* getKv(js, bucket);
          yield* wrapNats(`kvPut bucket=${bucket} key=${key}`, () => kv.put(key, sc.encode(value)));
        }),

      kvDelete: (bucket, key) =>
        Effect.gen(function* () {
          const kv = yield* getKv(js, bucket);
          yield* wrapNats(`kvDelete bucket=${bucket} key=${key}`, () => kv.delete(key));
        }),

      kvListKeys: (bucket) =>
        Effect.gen(function* () {
          const kv = yield* getKv(js, bucket);
          return yield* wrapNats(`kvListKeys bucket=${bucket}`, async () => {
            const keys: string[] = [];
            const watcher = await kv.keys();
            for await (const k of watcher) {
              keys.push(k);
            }
            return keys;
          });
        }),

      kvHistory: (bucket, key) =>
        Effect.gen(function* () {
          const kv = yield* getKv(js, bucket);
          return yield* wrapNats(`kvHistory bucket=${bucket} key=${key}`, async () => {
            const history: KvEntry[] = [];
            const iter = await kv.history({ key });
            for await (const entry of iter) {
              history.push(
                new KvEntry({
                  bucket,
                  key: entry.key,
                  value: sc.decode(entry.value),
                  revision: entry.revision,
                  operation: entry.operation,
                }),
              );
            }
            return history;
          });
        }),

      serverInfo: () =>
        wrapNats("serverInfo", async () => {
          const info = conn.info;
          if (!info) {
            throw new NatsError({ message: "No server info available" });
          }
          return new ServerInfo({
            serverId: info.server_id,
            version: info.version,
            host: info.host,
            port: info.port,
            maxPayload: info.max_payload,
          });
        }),
    };
  }),
);

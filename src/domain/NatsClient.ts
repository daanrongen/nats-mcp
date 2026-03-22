import { Context, type Effect } from "effect";
import type { KvNotFoundError, NatsError } from "./errors.ts";
import type {
  ConsumerConfig,
  ConsumerInfo,
  KvEntry,
  NatsMessage,
  PublishAck,
  ServerInfo,
  StreamConfig,
  StreamInfo,
} from "./models.ts";

export interface NatsClientService {
  // Core
  readonly publish: (
    subject: string,
    payload: string,
  ) => Effect.Effect<void, NatsError>;
  readonly request: (
    subject: string,
    payload: string,
    timeoutMs?: number,
  ) => Effect.Effect<NatsMessage, NatsError>;

  // JetStream Streams
  readonly streamList: () => Effect.Effect<StreamInfo[], NatsError>;
  readonly streamInfo: (name: string) => Effect.Effect<StreamInfo, NatsError>;
  readonly streamCreate: (
    config: StreamConfig,
  ) => Effect.Effect<StreamInfo, NatsError>;
  readonly streamDelete: (name: string) => Effect.Effect<void, NatsError>;
  readonly streamPublish: (
    subject: string,
    payload: string,
  ) => Effect.Effect<PublishAck, NatsError>;
  readonly streamFetch: (
    stream: string,
    consumer: string,
    count: number,
  ) => Effect.Effect<NatsMessage[], NatsError>;
  readonly streamConsumerCreate: (
    stream: string,
    config: ConsumerConfig,
  ) => Effect.Effect<ConsumerInfo, NatsError>;

  // KV Store
  readonly kvCreateBucket: (bucket: string) => Effect.Effect<void, NatsError>;
  readonly kvListBuckets: () => Effect.Effect<string[], NatsError>;
  readonly kvGet: (
    bucket: string,
    key: string,
  ) => Effect.Effect<string, NatsError | KvNotFoundError>;
  readonly kvPut: (
    bucket: string,
    key: string,
    value: string,
  ) => Effect.Effect<void, NatsError>;
  readonly kvDelete: (
    bucket: string,
    key: string,
  ) => Effect.Effect<void, NatsError>;
  readonly kvListKeys: (bucket: string) => Effect.Effect<string[], NatsError>;
  readonly kvHistory: (
    bucket: string,
    key: string,
  ) => Effect.Effect<KvEntry[], NatsError>;

  // Server
  readonly serverInfo: () => Effect.Effect<ServerInfo, NatsError>;
}

export class NatsClient extends Context.Tag("NatsClient")<
  NatsClient,
  NatsClientService
>() {}

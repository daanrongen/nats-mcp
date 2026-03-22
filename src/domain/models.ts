import { Schema } from "effect";

export class NatsMessage extends Schema.Class<NatsMessage>("NatsMessage")({
  subject: Schema.String,
  payload: Schema.String,
  headers: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String }),
  ),
}) {}

export class StreamConfig extends Schema.Class<StreamConfig>("StreamConfig")({
  name: Schema.String,
  subjects: Schema.Array(Schema.String),
  maxMessages: Schema.optional(Schema.Number),
  maxBytes: Schema.optional(Schema.Number),
  maxAge: Schema.optional(Schema.Number),
}) {}

export class StreamInfo extends Schema.Class<StreamInfo>("StreamInfo")({
  name: Schema.String,
  subjects: Schema.Array(Schema.String),
  numMessages: Schema.Number,
  numBytes: Schema.Number,
}) {}

export class PublishAck extends Schema.Class<PublishAck>("PublishAck")({
  stream: Schema.String,
  seq: Schema.Number,
  duplicate: Schema.Boolean,
}) {}

export class ConsumerConfig extends Schema.Class<ConsumerConfig>(
  "ConsumerConfig",
)({
  name: Schema.String,
  filterSubject: Schema.optional(Schema.String),
  deliverPolicy: Schema.optional(Schema.String),
  ackPolicy: Schema.optional(Schema.String),
}) {}

export class ConsumerInfo extends Schema.Class<ConsumerInfo>("ConsumerInfo")({
  name: Schema.String,
  streamName: Schema.String,
  numPending: Schema.Number,
  numAckPending: Schema.Number,
}) {}

export class KvEntry extends Schema.Class<KvEntry>("KvEntry")({
  bucket: Schema.String,
  key: Schema.String,
  value: Schema.String,
  revision: Schema.Number,
  operation: Schema.String,
}) {}

export class ServerInfo extends Schema.Class<ServerInfo>("ServerInfo")({
  serverId: Schema.String,
  version: Schema.String,
  host: Schema.String,
  port: Schema.Number,
  maxPayload: Schema.Number,
}) {}

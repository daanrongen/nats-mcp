import { Data } from "effect";

export class NatsError extends Data.TaggedError("NatsError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class KvNotFoundError extends Data.TaggedError("KvNotFoundError")<{
  readonly bucket: string;
  readonly key: string;
}> {}

export class StreamNotFoundError extends Data.TaggedError("StreamNotFoundError")<{
  readonly name: string;
}> {}

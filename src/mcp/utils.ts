import type { Cause, Effect, ManagedRuntime } from "effect";
import { Cause as CauseModule } from "effect";
import type { NatsError } from "../domain/errors.ts";
import type { NatsClient } from "../domain/NatsClient.ts";

export const formatSuccess = (data: unknown) => ({
  content: [
    {
      type: "text" as const,
      text: JSON.stringify(data, null, 2),
    },
  ],
});

export const formatError = (cause: Cause.Cause<unknown>) => ({
  content: [
    {
      type: "text" as const,
      text: `Error: ${CauseModule.pretty(cause)}`,
    },
  ],
  isError: true as const,
});

export const runTool = async <A, E>(
  runtime: ManagedRuntime.ManagedRuntime<NatsClient, NatsError>,
  effect: Effect.Effect<A, E, NatsClient>,
  toContent: (value: A) => ReturnType<typeof formatSuccess>,
) => {
  const result = await runtime.runPromiseExit(effect);
  if (result._tag === "Failure") return formatError(result.cause);
  return toContent(result.value);
};

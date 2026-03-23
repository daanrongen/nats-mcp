# nats-mcp

MCP server for [NATS](https://nats.io/) — publish messages, request-reply, manage JetStream streams, use the KV store, and inspect server diagnostics over stdio.

## Installation

```bash
npx -y @daanrongen/nats-mcp
```

## Tools (17 total)

| Domain      | Tools                                                                                                                   | Coverage                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Core**    | `publish`, `request`                                                                                                    | Publish messages, request-reply pattern         |
| **Streams** | `stream_list`, `stream_info`, `stream_create`, `stream_delete`, `stream_publish`, `stream_fetch`, `stream_consumer_create` | JetStream stream lifecycle and message delivery |
| **KV**      | `kv_create_bucket`, `kv_list_buckets`, `kv_get`, `kv_put`, `kv_delete`, `kv_list_keys`, `kv_history`                  | Key-value store with history                    |
| **Server**  | `server_info`                                                                                                           | NATS server diagnostics                         |

## Setup

### Environment variables

| Variable   | Required | Description                              |
| ---------- | -------- | ---------------------------------------- |
| `NATS_URL` | Yes      | NATS server URL (e.g. `nats://localhost:4222`) |

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "nats": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@daanrongen/nats-mcp"],
      "env": {
        "NATS_URL": "nats://localhost:4222"
      }
    }
  }
}
```

Or via the CLI:

```bash
claude mcp add nats -e NATS_URL=nats://localhost:4222 -- npx -y @daanrongen/nats-mcp
```

## Development

```bash
bun install
bun run dev        # run with --watch
bun test           # run test suite
bun run build      # bundle to dist/main.js
bun run inspect    # open MCP Inspector in browser
```

## Inspecting locally

`bun run inspect` launches the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) against the local build:

```bash
bun run build && bun run inspect
```

This opens the Inspector UI in your browser where you can call any tool interactively and inspect request/response shapes.

## Architecture

```
src/
├── config.ts              # Effect Config — NATS_URL
├── main.ts                # Entry point — ManagedRuntime + StdioServerTransport
├── domain/
│   ├── NatsClient.ts      # Context.Tag service interface
│   ├── errors.ts          # NatsError, KvNotFoundError, StreamNotFoundError
│   └── models.ts          # Schema.Class models (NatsMessage, StreamInfo, KvEntry, …)
├── infra/
│   ├── NatsClientLive.ts  # Layer.scoped — connects via nats.js, drains on shutdown
│   └── NatsClientTest.ts  # In-memory Ref-based test adapter
└── mcp/
    ├── server.ts          # McpServer wired to ManagedRuntime
    ├── utils.ts           # formatSuccess, formatError
    └── tools/             # core.ts, streams.ts, kv.ts, server.ts
```

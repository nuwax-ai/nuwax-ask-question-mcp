# Nuwax Ask Question MCP

MCP server for Nuwax/NuwaClaw ask/question interactions.

The ask/question path is intentionally separate from ACP permission approval:

- The agent calls an MCP tool: `nuwax_ask_user` or `nuwaclaw_ask_user`.
- The MCP tool input carries `rawInput.schemaVersion = "nuwaclaw.mcp_ask.v1"` and `rawInput.ui.version = "nuwaclaw.interaction.v1"`.
- ACP clients surface the normal `tool_call` and `tool_call_update` progress events.
- Web/Mobile responds to the backend, and the backend calls this MCP sidecar's `POST /respond`.
- The MCP tool returns the final tool result to the agent.

## Install

```bash
npm install
npm run build
```

## Run

```bash
NUWAX_ASK_MCP_PORT=63334 \
NUWAX_ASK_MCP_SECRET=change-me \
npm start
```

MCP stdio runs on stdin/stdout. The local response sidecar listens on:

```text
POST http://127.0.0.1:63334/respond
```

If `NUWAX_ASK_MCP_SECRET` is set, callers must send:

```text
X-Nuwax-Internal-Secret: <secret>
```

## MCP Tool Input

```json
{
  "toolName": "nuwax_ask_user",
  "schemaVersion": "nuwaclaw.mcp_ask.v1",
  "requestId": "ask_123",
  "revision": 1,
  "sessionId": "session_123",
  "title": "Choose an option",
  "description": "The agent needs your decision before continuing.",
  "ui": {
    "version": "nuwaclaw.interaction.v1",
    "presentation": "inline",
    "title": "Choose an option",
    "schema": {
      "type": "object",
      "properties": {
        "choice": {
          "type": "string",
          "enum": ["a", "b"]
        }
      },
      "required": ["choice"]
    },
    "submitLabel": "Submit",
    "cancelLabel": "Cancel"
  },
  "timeoutMs": 1800000
}
```

## Response Callback

```http
POST /respond
Content-Type: application/json
X-Nuwax-Internal-Secret: change-me
```

Submit:

```json
{
  "interventionId": "ask_123",
  "toolCallId": "tool_call_123",
  "revision": 1,
  "source": "mcp_ask",
  "protocol": "mcp",
  "action": "submit",
  "formData": {
    "choice": "a"
  },
  "answeredBy": {
    "kind": "web",
    "userId": "u_123"
  },
  "answeredAt": 1760000000000
}
```

Cancel:

```json
{
  "interventionId": "ask_123",
  "revision": 1,
  "source": "mcp_ask",
  "protocol": "mcp",
  "action": "cancel"
}
```

## Tool Result

```json
{
  "status": "answered",
  "formData": {
    "choice": "a"
  },
  "answeredBy": {
    "kind": "web",
    "userId": "u_123"
  },
  "answeredAt": 1760000000000
}
```

Terminal statuses:

- `answered`
- `cancelled`
- `skipped`
- `expired`

# Nuwax Ask Question MCP

MCP server for Nuwax/NuwaClaw ask/question interactions.

The ask/question path is intentionally separate from ACP permission approval:

- The agent calls the MCP tool `nuwax_ask_question` (Codex: `mcp__ask_question__nuwax_ask_question`). Legacy: `nuwaclaw_ask_user`.
- The MCP tool input carries `rawInput.schemaVersion = "nuwaclaw.mcp_ask.v1"` and `rawInput.ui.version = "nuwaclaw.interaction.v1"`.
- ACP clients surface the normal `tool_call` and `tool_call_update` progress events.
- The MCP tool returns immediately and tells the agent to stop the current turn.
- Web/Mobile submits the completed form as a normal chat message, which starts the next agent turn.

ACP permission approval uses a different transport contract and should not be routed
through this MCP stdio tool:

- NuwaClaw/RCoder emits `messageType = "acpRequestPermission"` with `subType = "request_permission"`.
- The event data carries `request_permission_request` and optional `save_rule`.
- Web/Mobile approval responses go to `POST /api/computer/notify-resolved` as `permission_resolve_request`.
- `nuwax_ask_question` is the primary tool; Codex exposes it as `mcp__ask_question__nuwax_ask_question` when the MCP server key is `ask-question`.
- `nuwaclaw_ask_user` remains as a legacy compatibility entry with the same response contract.

## Install

```bash
npm install
npm run build
```

## Run

```bash
npm start
```

MCP stdio runs on stdin/stdout. No HTTP service, response sidecar, or MCP-side pending store is required.

## MCP Tool Input

```json
{
  "toolName": "nuwax_ask_question",
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

## Tool Result

```json
{
  "status": "pending",
  "requestId": "ask_123",
  "revision": 1,
  "message": "The question has been presented to the user. Stop this turn now. When the user submits the form, their answer will arrive as a new user message."
}
```

`status = "pending"` is only the tool-result signal shown to the agent; this package does not keep a pending request or wait for a callback.

The form answer is not returned through MCP. It is formatted by the client and sent as the next user chat message.

The client should format that chat message with user-facing labels instead of raw JSON, for example:

```text
我已填写「请选择继续方式」，表单内容如下：

选项：先跑测试
补充说明：先跑关键链路
```

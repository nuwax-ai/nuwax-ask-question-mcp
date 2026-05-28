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

- NuwaClaw/RCoder emits `message_type = "acpRequestPermission"` with `sub_type = "request_permission"`.
- The event data carries `request_permission_request` and optional `save_rule`.
- Web/Mobile approval responses go to Backend `POST /api/agent-interventions/{interventionId}/respond` as `permission_resolve_request`; Backend forwards the body to NuwaClaw `/computer/notify-resolved`.
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

## File Upload Widget

Clients may render a file upload widget when a schema property uses:

- `"format": "data-url"` — JSON Schema standard for file references
- `"ui:widget": "file"` in `uiSchema` — explicit widget hint

Supported `ui:options`:
- `accept` (string): MIME type filter, e.g. `"image/*"`, `"application/pdf"`
- `multiple` (boolean): Allow multiple file selection
- `maxFileSize` (number): Max file size in bytes

The client uploads files to the platform file service and includes the resulting
URLs in the resume message. Example schema property:

```json
{
  "screenshot": {
    "type": "string",
    "format": "data-url",
    "title": "截图"
  }
}
```

With uiSchema hint:
```json
{
  "screenshot": { "ui:widget": "file", "ui:options": { "accept": "image/*" } }
}
```

## Client Resume Message Format

The client should format that chat message with user-facing labels instead of raw JSON. This keeps the answer readable for both the user and the next agent turn.

Recommended format:

```text
我已填写「{title}」，表单内容如下：

{field label}：{display value}
{field label}：{display value}
```

Formatting rules:

- `{title}` uses the MCP input `title`, falling back to `ui.title`.
- Field labels use JSON Schema `properties[field].title`; if absent, use the field key.
- Enum values should be displayed with `uiSchema[field]["ui:options"].enumNames` when provided.
- Array values should be joined with `、`.
- Boolean values should be rendered as `是` / `否`.
- Empty values should be rendered as `未填写`.
- Unknown form fields should still be included as readable `key：value` lines.
- File upload values (format: data-url) should display file names, e.g. `截图：screenshot.png`
- Multiple files should be joined with `、`, e.g. `附件：report.pdf、data.csv`
- Do not wrap the answer in a JSON code block and do not send raw JSON unless the user explicitly typed JSON.

Example:

```text
我已填写「请选择继续方式」，表单内容如下：

选项：先跑测试
补充说明：先跑关键链路
检查项：代码检查、单元测试
```

Cancel, skip, and timeout should also be normal chat messages:

```text
我取消了「请选择继续方式」。
我跳过了「请选择继续方式」。
「请选择继续方式」已超时，没有收到表单答案。
```

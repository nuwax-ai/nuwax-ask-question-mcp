# Nuwax Ask Question MCP

English | **[中文](README.md)**

[![npm version](https://img.shields.io/npm/v/nuwax-ask-question-mcp.svg)](https://www.npmjs.com/package/nuwax-ask-question-mcp)
[![CI](https://github.com/nuwax-ai/nuwax-ask-question-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/nuwax-ai/nuwax-ask-question-mcp/actions/workflows/ci.yml)

An MCP server for interactive agent-to-user question cards in Nuwax conversations.

## How It Works

```
┌─────────┐  calls nuwax_ask_question  ┌──────────────────┐
│  Agent  │ ─────────────────────────▶ │ MCP Server (this) │
└─────────┘                             └──────────────────┘
     │                                          │
     │  returns status: "pending", Agent stops  │
     ◀──────────────────────────────────────────┘
     │
     │  Client renders form, user fills & submits
     │
     ▼
┌──────────────────────────────────────────────────┐
│  User answer sent as next chat message, starting  │
│  the next agent turn                              │
└──────────────────────────────────────────────────┘
```

**Core flow:**

1. Agent calls MCP tool `nuwax_ask_question`
2. Tool returns `status: "pending"` immediately; Agent stops the current turn
3. Client (Web/Mobile) renders an interactive form based on the UI Schema
4. User submits the form; the answer arrives as a regular chat message to start the next agent turn

> **Note:** This tool handles question/answer interactions only. ACP permission approval uses a separate transport contract (`acpRequestPermission`) and is not routed through this MCP tool.

## Install

```bash
npm install nuwax-ask-question-mcp
```

Or use directly without installing:

```bash
npx nuwax-ask-question-mcp
```

## Run

```bash
npm start
```

The server communicates via MCP over stdin/stdout. No HTTP service, response sidecar, or pending store is required.

## MCP Client Configuration

Add to your MCP client config (e.g. Claude Desktop, Cursor, Codex):

```json
{
  "mcpServers": {
    "ask-question": {
      "command": "npx",
      "args": ["-y", "nuwax-ask-question-mcp"]
    }
  }
}
```

> In Codex, when the MCP server key is `ask-question`, the displayed name usually includes the server key prefix, for example `mcp__ask_question__nuwax_ask_question`. The actual MCP tool name is only `nuwax_ask_question`.

## Available Tools

| Tool | Description |
|---|---|
| `nuwax_ask_question` | Primary tool for interactive questions |

## Tool Input

```json
{
  "schemaVersion": "nuwax.mcp_ask.v1",
  "requestId": "ask_123",
  "revision": 1,
  "sessionId": "session_123",
  "title": "Choose an option",
  "description": "The agent needs your decision before continuing.",
  "ui": {
    "version": "nuwax.interaction.v1",
    "presentation": "inline",
    "title": "Choose an option",
    "schema": {
      "type": "object",
      "properties": {
        "choice": {
          "type": "string",
          "title": "Option",
          "enum": ["a", "b"],
          "enumNames": ["Option A", "Option B"]
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

### Field Reference

| Field | Type | Required | Description |
|---|---|---|---|
| `schemaVersion` | string | ✅ | Must be `"nuwax.mcp_ask.v1"` |
| `requestId` | string | ✅ | Unique request identifier |
| `revision` | number | ✅ | Positive integer, version number |
| `sessionId` | string | ✅ | Session ID |
| `title` | string | ✅ | Question title |
| `description` | string | | Question description |
| `ui` | object | ✅ | UI rendering definition (see below) |
| `business` | object | | Business extension data |
| `timeoutMs` | number | | Timeout in milliseconds |
| `priority` | `"normal" \| "high"` | | Priority level |

### UI Schema Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | string | ✅ | Must be `"nuwax.interaction.v1"` |
| `presentation` | string | ✅ | Display mode: `modal` / `inline` / `wizard` / `table` |
| `title` | string | ✅ | Form title |
| `description` | string | | Form description |
| `schema` | object | ✅ | JSON Schema defining form fields |
| `uiSchema` | object | | UI enhancement config (widget types, options, etc.) |
| `table` | object | | Table display configuration |
| `initialValue` | object | | Initial form values |
| `steps` | array | | Wizard steps (for wizard mode) |
| `submitLabel` | string | | Submit button label |
| `cancelLabel` | string | | Cancel button label |
| `fallback` | object | | Fallback: `text` + optional `webUrl` / `mobileUrl` |

## Tool Result

```json
{
  "status": "pending",
  "requestId": "ask_123",
  "revision": 1,
  "message": "The question has been presented to the user. Stop this turn now. When the user submits the form, their answer will arrive as a new user message."
}
```

- `status: "pending"` signals the agent that the question has been presented
- This package does not maintain a pending request queue or wait for callbacks
- The user's form answer is formatted by the client and sent as the next chat message

## Widget Extensions

### File Upload Widget

Clients render a file upload widget when a schema property uses:

```json
{
  "screenshot": {
    "type": "string",
    "format": "data-url",
    "title": "Screenshot"
  }
}
```

Specify the widget type and options via `uiSchema`:

```json
{
  "screenshot": {
    "ui:widget": "file",
    "ui:options": {
      "accept": "image/*",
      "multiple": false,
      "maxFileSize": 10485760
    }
  }
}
```

`ui:options` supported:

| Option | Type | Description |
|---|---|---|
| `accept` | string | MIME type filter, e.g. `"image/*"`, `"application/pdf"` |
| `multiple` | boolean | Allow multiple file selection |
| `maxFileSize` | number | Max file size in bytes |

### List Widget (Single Select)

Suitable for longer option lists, renders as a vertical radio-style list:

```json
{
  "framework": {
    "type": "string",
    "title": "Framework",
    "enum": ["react", "vue", "angular", "svelte", "solid"],
    "enumNames": ["React", "Vue", "Angular", "Svelte", "SolidJS"]
  }
}
```

Specify the list widget via `uiSchema`:

```json
{
  "framework": { "ui:widget": "list" }
}
```

## Client Resume Message Format

Clients should format form answers as readable chat messages (not raw JSON). Recommended format:

```text
我已填写「{title}」，表单内容如下：

{field label}：{display value}
{field label}：{display value}
```

Formatting rules:

- `{title}` uses the MCP input `title`, falling back to `ui.title`
- Field labels use `properties[field].title` from JSON Schema; fall back to the field key
- Enum values use display names from `uiSchema[field]["ui:options"].enumNames` when provided
- Array values are joined with `、`
- Boolean values render as `是` / `否`
- Empty values render as `未填写`
- File upload values display file names; multiple files joined with `、`
- Do not wrap the answer in a JSON code block

Example:

```text
我已填写「请选择继续方式」，表单内容如下：

选项：先跑测试
补充说明：先跑关键链路
检查项：代码检查、单元测试
```

Cancel, skip, and timeout are also sent as chat messages:

```text
我取消了「请选择继续方式」。
我跳过了「请选择继续方式」。
「请选择继续方式」已超时，没有收到表单答案。
```

## Development

```bash
npm install          # Install dependencies
npm run build        # Build
npm run typecheck    # Type check
npm test             # Run tests
npm run dev          # Run in dev mode
```

## Release

Publish to npm automatically via Git tags:

```bash
git tag v1.x.x
git push origin v1.x.x
```

## License

[MIT](LICENSE)

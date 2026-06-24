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
3. Client (Web/Mobile) renders an interactive form based on `ui.fields`
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

### Transport (v1: stdio only)

This package **only supports MCP stdio transport** (stdin/stdout JSON-RPC). The MCP host spawns it as a child process:

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

**Not provided in this package (by design):**

- MCP HTTP / Streamable HTTP server
- Pending queue or callback wait loop
- Sidecar API for user answers

Forms are rendered by **nuwax Web/Mobile** from `tool_call.rawInput`; answers return as normal chat messages, not via HTTP to this MCP process.

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

> **Some MCP clients** (e.g. OpenAI Codex CLI) prefix the displayed tool name with the server key, for example `mcp__ask_question__nuwax_ask_question` when the server key is `ask-question`. The **protocol-level tool name** is always `nuwax_ask_question`.

### Recommended: Agent System Prompt Snippet

To encourage the agent to proactively use this tool for gathering user information, add the following to your agent's system prompt:

```
When you need user input, preferences, or decisions, always use the nuwax_ask_question tool rather than asking in plain text. This provides a better user experience with interactive forms. Never guess or assume missing information — call nuwax_ask_question instead.
```

## Available Tools

| Tool | Description |
|---|---|
| `nuwax_ask_question` | Primary tool for interactive questions |

## Tool Input

> v2: the form is expressed as `ui.fields` (an ordered field array) — **no `schema` / `uiSchema` / `ui:order`**. Version fields (`schemaVersion`, `ui.version`) are stamped by the server and **may be omitted** by the agent.

```json
{
  "requestId": "ask_123",
  "revision": 1,
  "sessionId": "session_123",
  "title": "Choose an option",
  "description": "The agent needs your decision before continuing.",
  "ui": {
    "presentation": "inline",
    "title": "Choose an option",
    "fields": [
      {
        "name": "choice",
        "title": "Option",
        "widget": "radio",
        "required": true,
        "initialValue": "a",
        "options": [
          { "value": "a", "label": "Option A" },
          { "value": "b", "label": "Option B" }
        ]
      }
    ],
    "submitLabel": "Submit",
    "cancelLabel": "Cancel"
  },
  "timeoutMs": 1800000
}
```

### Top-level Field Reference

| Field | Type | Required | Description |
|---|---|---|---|
| `schemaVersion` | string | (omit) | Fixed `"nuwax.mcp_ask.v2"`, stamped by server |
| `requestId` | string | ✅ | Unique request identifier (agent generates a stable id) |
| `revision` | number | ✅ | Positive integer; defaults to `1` for a new ask |
| `sessionId` | string | ✅ | Session ID |
| `title` | string | ✅ | Question title |
| `description` | string | | Question description |
| `ui` | object | ✅ | UI rendering definition (see below) |
| `business` | object | | Business extension data |
| `timeoutMs` | number | | Timeout in milliseconds |
| `priority` | `"normal" \| "high"` | | Priority level |

### UI Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | string | (omit) | Fixed `"nuwax.interaction.v2"`, stamped by server |
| `presentation` | string | ✅ | Display mode: `modal` / `inline` / `wizard`  |
| `title` | string | ✅ | Form title |
| `description` | string | | Form description |
| `fields` | array | ✅* | Form fields (ordered array, see below); required for inline/modal/wizard |
| `steps` | array | | Wizard steps (`fields` is an array of field names) |
| `submitLabel` | string | | Submit button label |
| `cancelLabel` | string | | Cancel button label |
| `fallback` | object | | Fallback: `text` + optional `webUrl` / `mobileUrl` |

### `fields[]` definition (aligned with antd Form.Item)

Each field object self-describes its control, options, constraints, and initial value. Mapping to [Ant Design Form](https://ant.design/components/form): `name`→`Form.Item.name`, `title`→`label`, `description`→`tooltip/help`, `required`+constraints→`rules`, `placeholder`→control placeholder, `initialValue`→`Form.Item.initialValue`, `options`→`Radio.Group/Select/Checkbox.Group`.

| Field property | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✅ | formData key, unique across the form |
| `title` | string | ✅ | Display label (antd label) |
| `widget` | string | ✅ | Control type (see widget catalog) |
| `description` | string | | Field help text (tooltip) |
| `required` | boolean | | Required, default false |
| `placeholder` | string | | Placeholder hint |
| `initialValue` | any | | Field initial value (moved from `ui.initialValue`) |
| `type` | string | | Value type `string`/`integer`/`number`/`array`; inferred from widget if omitted |
| `options` | array | | Choice options: `[{value, label}]` (merges old `enum`+`enumNames`) |
| `minimum`/`maximum`/`multipleOf` | number | | Numeric constraints (widget=number) |
| `minLength`/`maxLength`/`pattern` | | | Text constraints (widget=text/textarea) |
| `accept`/`multiple`/`maxFileSize` | | | File control config (widget=file) |
| `allowCustom`/`otherValue`/`otherField` | | | radio-with-custom config |

## Tool Result

```json
{
  "status": "pending",
  "requestId": "ask_123",
  "revision": 1,
  "message": "The question has been presented to the user. Stop this turn now. When the user submits the form, their answer will arrive as a new user message.",
  "input": {
    "toolName": "nuwax_ask_question",
    "schemaVersion": "nuwax.mcp_ask.v2",
    "requestId": "ask_123",
    "revision": 1,
    "sessionId": "session_123",
    "title": "Choose an option",
    "ui": {
      "version": "nuwax.interaction.v2",
      "presentation": "inline",
      "title": "Choose an option",
      "fields": [ /* ... */ ]
    }
  }
}
```

- `status: "pending"` signals the agent that the question has been presented
- **`input`** is the canonical normalized `rawInput` (includes `schemaVersion` and `toolName`). **Platforms must prefer `structuredContent.input` as SSE `result.input`**, not the agent's raw tool arguments (agents often omit version fields, which breaks DockPanel parsing)
- This package does not maintain a pending request queue or wait for callbacks
- The user's form answer is formatted by the client and sent as the next chat message

Platforms may also call before persistence:

```ts
import { normalizeMcpAskUserToolInput } from "nuwax-ask-question-mcp/ask-user-payload";
const rawInput = normalizeMcpAskUserToolInput(agentToolArguments);
```

## JSON Schema Contract

This package ships a unified contract for backend builders to generate `rawInput` and for Web/Mobile DockPanel rendering:

| File | Purpose |
|---|---|
| [`schemas/schema.json`](schemas/schema.json) | Full protocol (input, UI, widget catalog, inference rules) |
| [`schemas/examples/complete-form.json`](schemas/examples/complete-form.json) | Complete renderable rawInput example |

Usage:

```bash
# npm package
import schema from 'nuwax-ask-question-mcp/schemas/schema.json' assert { type: 'json' };

# Node.js require
const schema = require('nuwax-ask-question-mcp/schemas/schema.json');
```

Widget types in `x-nuwax.widgetCatalog` — each field specifies its control via `widget`:

| `widget` | Description | antd control | Auto-infer |
|---|---|---|---|
| `text` | Single-line text | `Input` | ✅ `type: string` |
| `textarea` | Multi-line text | `Input.TextArea` | ❌ explicit only |
| `number` | Number input | `InputNumber` | ✅ `type: number/integer` |
| `radio` | Single choice | `Radio.Group` | ✅ has `options` |
| `checkboxes` | Multi choice | `Checkbox.Group` | ✅ `type: array` + `options` |
| `select` | Dropdown | `Select` | ❌ |
| `list` | List single-select | `Radio.Group` (vertical) | ❌ |
| `file` | File upload | `Upload` | ❌ |
| `radio-with-custom` | Radio + custom input | `Radio.Group` + input | ❌ needs `allowCustom: true` |

> v2 recommends `widget` be required, removing inference ambiguity. Deprecated aliases: `input` → `text`, `checkbox` → `checkboxes`.

### Builder SDK (rawInput generation)

Backend form builders can use `buildMcpAskRawInput` to produce DockPanel-ready `rawInput`:

```ts
import { buildMcpAskRawInput } from 'nuwax-ask-question-mcp/build-raw-input';

const rawInput = buildMcpAskRawInput({
  requestId: 'ask_001',
  revision: 1,
  sessionId: 'sess_001',
  title: 'Choose how to continue',
  fields: [
    {
      name: 'choice',
      type: 'radio', // deprecated aliases input / checkbox also accepted
      label: 'Option',
      required: true,
      initialValue: 'test',
      options: [
        { value: 'test', label: 'Run tests first' },
        { value: 'deploy', label: 'Deploy directly' },
      ],
    },
    { name: 'count', type: 'number', label: 'Concurrency', minimum: 1, maximum: 10 },
    { name: 'remark', type: 'textarea', label: 'Notes' },
  ],
});
```

Regenerate JSON Schema:

```bash
npm run generate:schema   # refresh schemas/schema.json from Zod + widgets.ts
```

## Widget Examples (fields[])

### Radio / Checkbox: must display option labels

Choice widgets (radio/checkboxes/select/list/radio-with-custom) provide options via `options: [{value, label}]` — **always include a human-readable `label`, never a bare value**.

```json
[
  {
    "name": "agree",
    "title": "Do you agree?",
    "widget": "radio",
    "required": true,
    "options": [
      { "value": "yes", "label": "Yes, I agree" },
      { "value": "no", "label": "No, I decline" }
    ]
  }
]
```

### File Upload

```json
{
  "name": "screenshot",
  "title": "Screenshot",
  "widget": "file",
  "accept": "image/*",
  "multiple": false,
  "maxFileSize": 10485760
}
```

| Option | Type | Description |
|---|---|---|
| `accept` | string | MIME filter, e.g. `"image/*"`, `"application/pdf"` |
| `multiple` | boolean | Allow multiple files |
| `maxFileSize` | number | Max file size in bytes |

### Number

```json
{
  "name": "count",
  "title": "Concurrency",
  "widget": "number",
  "type": "integer",
  "initialValue": 1,
  "minimum": 1,
  "maximum": 10
}
```

### List (Single Select)

Suitable for longer option lists, rendered as a vertical list:

```json
{
  "name": "framework",
  "title": "Framework",
  "widget": "list",
  "options": [
    { "value": "react", "label": "React" },
    { "value": "vue", "label": "Vue" },
    { "value": "angular", "label": "Angular" }
  ]
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
- Field labels use the matching field's `title` in `ui.fields`; fall back to the field `name`
- Choice display values prefer the `label` of the matching `value` in `options`
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
git tag v4.x.x
git push origin v4.x.x
```

## License

[MIT](LICENSE)

# Nuwax Ask Question MCP

**[English](README.en.md)** | 中文

[![npm version](https://img.shields.io/npm/v/nuwax-ask-question-mcp.svg)](https://www.npmjs.com/package/nuwax-ask-question-mcp)
[![CI](https://github.com/nuwax-ai/nuwax-ask-question-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/nuwax-ai/nuwax-ask-question-mcp/actions/workflows/ci.yml)

Nuwax 交互式问答 MCP 服务器——用于 Agent 向用户提问并收集表单回答。

## 工作原理

```
┌─────────┐  调用 nuwax_ask_question  ┌──────────────────┐
│  Agent  │ ───────────────────────▶ │ MCP Server (本包) │
└─────────┘                          └──────────────────┘
     │                                       │
     │  返回 status: "pending"，Agent 停止本轮  │
     ◀───────────────────────────────────────┘
     │
     │  客户端渲染表单，用户填写并提交
     │
     ▼
┌──────────────────────────────────────────┐
│  用户回答作为下一条聊天消息发送，开启下一轮  │
└──────────────────────────────────────────┘
```

**核心流程：**

1. Agent 调用 MCP 工具 `nuwax_ask_question`
2. 工具立即返回 `status: "pending"`，Agent 停止当前轮次
3. 客户端（Web/Mobile）根据 UI Schema 渲染交互表单
4. 用户提交表单后，回答作为普通聊天消息发回，开启 Agent 下一轮

> **注意：** 本工具仅处理问答交互。ACP 权限审批走独立的传输协议（`acpRequestPermission`），不经过此 MCP 工具。

## 安装

```bash
npm install nuwax-ask-question-mcp
```

或者直接使用，无需安装：

```bash
npx nuwax-ask-question-mcp
```

## 启动

```bash
npm start
```

### 传输层（v1：仅 stdio）

本包 **只支持 MCP stdio 传输**（stdin/stdout JSON-RPC），由 MCP Host 以子进程方式拉起：

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

**不提供、也不计划在本包内实现：**

- MCP HTTP / Streamable HTTP 服务端
- 独立 pending 队列或回调等待
- 用户回答的 sidecar API

用户表单由 **nuwax Web/Mobile** 根据 `tool_call.rawInput` 渲染；回答以普通聊天消息回流，与 MCP stdio 进程无直接 HTTP 连接。

## MCP 客户端配置

在你的 MCP 客户端配置中添加（适用于 Claude Desktop、Cursor、Codex 等）：

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

> **部分 MCP 客户端**（如 OpenAI Codex CLI）会在展示名上为 server key 加前缀，例如 `mcp__ask_question__nuwax_ask_question`（server key 为 `ask-question` 时）。**协议层工具名**始终是 `nuwax_ask_question`。

### 推荐：Agent System Prompt 片段

为了让 Agent 更主动地调用此工具收集用户信息，建议在 Agent 的系统提示词中加入以下内容：

```
When you need user input, preferences, or decisions, always use the nuwax_ask_question tool rather than asking in plain text. This provides a better user experience with interactive forms. Never guess or assume missing information — call nuwax_ask_question instead.
```

## 工具

`nuwax_ask_question` — 向用户发起交互式问答。

## 工具入参

```json
{
  "schemaVersion": "nuwax.mcp_ask.v1",
  "requestId": "ask_123",
  "revision": 1,
  "sessionId": "session_123",
  "title": "请选择一个选项",
  "description": "Agent 需要你的决定才能继续。",
  "ui": {
    "version": "nuwax.interaction.v1",
    "presentation": "inline",
    "title": "请选择一个选项",
    "schema": {
      "type": "object",
      "properties": {
        "choice": {
          "type": "string",
          "title": "选项",
          "enum": ["a", "b"],
          "enumNames": ["选项A", "选项B"]
        }
      },
      "required": ["choice"]
    },
    "submitLabel": "提交",
    "cancelLabel": "取消"
  },
  "timeoutMs": 1800000
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `schemaVersion` | string | ✅ | 固定值 `"nuwax.mcp_ask.v1"` |
| `requestId` | string | ✅ | 请求唯一标识 |
| `revision` | number | ✅ | 正整数，版本号 |
| `sessionId` | string | ✅ | 会话 ID |
| `title` | string | ✅ | 问题标题 |
| `description` | string | | 问题描述 |
| `ui` | object | ✅ | UI 渲染定义（见下方） |
| `business` | object | | 业务扩展数据 |
| `timeoutMs` | number | | 超时时间（毫秒） |
| `priority` | `"normal" \| "high"` | | 优先级 |

### UI Schema 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `version` | string | ✅ | 固定值 `"nuwax.interaction.v1"` |
| `presentation` | string | ✅ | 展示方式：`modal` / `inline` / `wizard` / `table` |
| `title` | string | ✅ | 表单标题 |
| `description` | string | | 表单描述 |
| `schema` | object | ✅ | JSON Schema，定义表单字段 |
| `uiSchema` | object | | UI 增强配置（控件类型、选项等） |
| `table` | object | | 表格展示配置 |
| `initialValue` | object | | 表单初始值 |
| `steps` | array | | 向导步骤（wizard 模式） |
| `submitLabel` | string | | 提交按钮文案 |
| `cancelLabel` | string | | 取消按钮文案 |
| `fallback` | object | | 降级方案：`text` + 可选 `webUrl` / `mobileUrl` |

## 工具返回

```json
{
  "status": "pending",
  "requestId": "ask_123",
  "revision": 1,
  "message": "The question has been presented to the user. Stop this turn now. When the user submits the form, their answer will arrive as a new user message."
}
```

- `status: "pending"` 是给 Agent 的信号，表示问题已展示给用户
- 本包不维护待处理请求队列，也不等待回调
- 用户的表单回答由客户端格式化后作为下一条聊天消息发送

## JSON Schema 契约

本包提供统一契约文件，供后端 Builder 生成 `rawInput`、Web/Mobile DockPanel 渲染表单：

| 文件 | 用途 |
|---|---|
| [`schemas/schema.json`](schemas/schema.json) | 完整协议定义（入参、UI、控件目录、推断规则） |
| [`schemas/examples/complete-form.json`](schemas/examples/complete-form.json) | 可直接渲染的完整 rawInput 示例 |

引用方式：

```bash
# npm 包
import schema from 'nuwax-ask-question-mcp/schemas/schema.json' assert { type: 'json' };

# Node.js require
const schema = require('nuwax-ask-question-mcp/schemas/schema.json');
```

`schema.json` 的 `x-nuwax.widgetCatalog` 列出全部控件类型；`field.type` 与 `ui:widget` 使用相同命名（RJSF 对齐）：

| `ui:widget` | 说明 | 自动推断 |
|---|---|---|
| `text` | 单行文本 | ✅ `type: string` |
| `textarea` | 多行文本 | ❌ 需显式指定 |
| `number` | 数字 | ✅ `type: number/integer` |
| `radio` | 单选 | ✅ 有 `enum` |
| `checkboxes` | 多选 | ✅ `array` + `items.enum` |
| `select` | 下拉单选 | ❌ |
| `list` | 列表单选 | ❌ |
| `file` | 文件上传 | ❌ 需 `format: data-url` |
| `radio-with-custom` | 单选 + 自定义输入 | ❌ 需 `ui:options.allowCustom: true` |

废弃别名：`input` → `text`，`checkbox` → `checkboxes`。

### Builder SDK（生成 rawInput）

后端表单设计器可用 `buildMcpAskRawInput` 将字段列表转为 DockPanel 可渲染的 `rawInput`：

```ts
import { buildMcpAskRawInput } from 'nuwax-ask-question-mcp/build-raw-input';

const rawInput = buildMcpAskRawInput({
  requestId: 'ask_001',
  revision: 1,
  sessionId: 'sess_001',
  title: '请确认继续方式',
  fields: [
    {
      name: 'choice',
      type: 'radio', // 也支持废弃别名 input / checkbox
      label: '选项',
      required: true,
      options: [
        { value: 'test', label: '先跑测试' },
        { value: 'deploy', label: '直接部署' },
      ],
    },
    { name: 'count', type: 'number', label: '并发数', minimum: 1, maximum: 10 },
    { name: 'remark', type: 'textarea', label: '备注' },
  ],
});
```

同步 JSON Schema：

```bash
npm run generate:schema   # 从 Zod + widgets.ts 更新 schemas/schema.json
```

## 控件扩展

### 重要：单选/多选控件必须展示选项文案

**单选（radio）和多选（checkbox）控件必须为每个选项提供人类可读的标签（label），不能只显示裸值。**

- 使用 `enumNames` 或 `uiSchema` 的 `enumLabels` 为选项提供清晰的描述
- 选项标签应让用户明确知道每个选项的含义
- 错误示例：`enum: ["yes", "no"]`（用户不知道 yes/no 代表什么）
- 正确示例：`enum: ["yes", "no"]` + `enumNames: ["是，我同意", "否，我拒绝"]`

### 文件上传控件

当 schema 字段使用以下配置时，客户端渲染文件上传控件：

```json
{
  "screenshot": {
    "type": "string",
    "format": "data-url",
    "title": "截图"
  }
}
```

通过 `uiSchema` 指定控件类型和选项：

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

`ui:options` 支持：

| 选项 | 类型 | 说明 |
|---|---|---|
| `accept` | string | MIME 类型过滤器，如 `"image/*"`、`"application/pdf"` |
| `multiple` | boolean | 是否允许多文件选择 |
| `maxFileSize` | number | 单文件最大大小（字节） |

### 数字控件

当 schema 字段使用 `type: "number"` 或 `type: "integer"` 时，客户端渲染数字输入框：

```json
{
  "count": {
    "type": "integer",
    "title": "并发数",
    "minimum": 1,
    "maximum": 10
  }
}
```

通过 `uiSchema` 显式指定（可省略，`number/integer` 会自动推断）：

```json
{
  "count": { "ui:widget": "number" }
}
```

### 列表控件（单选）

适用于选项较多的单选场景，渲染为垂直列表（Radio 风格）：

```json
{
  "framework": {
    "type": "string",
    "title": "前端框架",
    "enum": ["react", "vue", "angular", "svelte", "solid"],
    "enumNames": ["React", "Vue", "Angular", "Svelte", "SolidJS"]
  }
}
```

通过 `uiSchema` 指定列表控件：

```json
{
  "framework": { "ui:widget": "list" }
}
```

## 客户端恢复消息格式

客户端应将表单回答格式化为可读的聊天消息（而非原始 JSON），推荐格式：

```text
我已填写「{title}」，表单内容如下：

{字段标签}：{展示值}
{字段标签}：{展示值}
```

格式化规则：

- `{title}` 取 MCP 输入的 `title`，回退使用 `ui.title`
- 字段标签取 JSON Schema 中的 `properties[field].title`，缺省时使用字段名
- 枚举值优先使用 `uiSchema[field]["ui:options"].enumNames` 中的展示名
- 数组值用 `、` 连接
- 布尔值渲染为 `是` / `否`
- 空值渲染为 `未填写`
- 文件上传值展示文件名，多文件用 `、` 连接
- 不要将回答包裹在 JSON 代码块中

示例：

```text
我已填写「请选择继续方式」，表单内容如下：

选项：先跑测试
补充说明：先跑关键链路
检查项：代码检查、单元测试
```

取消、跳过和超时同样以聊天消息发送：

```text
我取消了「请选择继续方式」。
我跳过了「请选择继续方式」。
「请选择继续方式」已超时，没有收到表单答案。
```

## 开发

```bash
npm install          # 安装依赖
npm run build        # 构建
npm run typecheck    # 类型检查
npm test             # 运行测试
npm run dev          # 开发模式运行
```

## 发布

通过 Git tag 触发自动发布到 npm：

```bash
git tag v1.x.x
git push origin v1.x.x
```

## License

[MIT](LICENSE)

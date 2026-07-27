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
3. 客户端（Web/Mobile）根据 `ui.fields` 渲染交互表单
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
When execution is blocked because you need user input, preferences, or decisions, use nuwax_ask_question rather than guessing or asking in plain text.
```

## 工具

`nuwax_ask_question` — 向用户发起交互式问答。

## 工具入参

> v2：表单以 `ui.fields`（有序字段数组）表达，**无需 `schema` / `uiSchema` / `ui:order`**。版本字段（`schemaVersion`、`ui.version`）由服务端自动盖戳，**Agent 可省略**。

```json
{
  "requestId": "ask_123",
  "revision": 1,
  "sessionId": "session_123",
  "title": "请选择一个选项",
  "description": "Agent 需要你的决定才能继续。",
  "ui": {
    "presentation": "inline",
    "title": "请选择一个选项",
    "fields": [
      {
        "name": "choice",
        "title": "选项",
        "widget": "radio",
        "required": true,
        "initialValue": "a",
        "options": [
          { "value": "a", "label": "选项A" },
          { "value": "b", "label": "选项B" }
        ]
      }
    ],
    "submitLabel": "提交",
    "cancelLabel": "取消"
  },
  "timeoutMs": 1800000
}
```

### 顶层字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `schemaVersion` | string | （省略） | 固定 `"nuwax.mcp_ask.v2"`，服务端自动盖戳，Agent 无需输出 |
| `requestId` | string | ✅ | 请求唯一标识（Agent 生成稳定 id） |
| `revision` | number | ✅ | 正整数版本号；新提问省略时默认 `1` |
| `sessionId` | string | ✅ | 会话 ID |
| `title` | string | ✅ | 问题标题 |
| `description` | string | | 问题描述 |
| `ui` | object | ✅ | UI 渲染定义（见下方） |
| `business` | object | | 业务扩展数据 |
| `timeoutMs` | number | | 超时时间（毫秒） |
| `priority` | `"normal" \| "high"` | | 优先级 |

### UI 字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `version` | string | （省略） | 固定 `"nuwax.interaction.v2"`，服务端自动盖戳 |
| `presentation` | string | ✅ | 展示方式：`modal` / `inline` / `wizard` |
| `title` | string | ✅ | 表单标题 |
| `description` | string | | 表单描述 |
| `fields` | array | ✅* | 表单字段（有序数组，见下方）；inline/modal/wizard 必填 |
| `steps` | array | | 向导步骤（wizard 模式，`fields` 为字段 name 数组） |
| `submitLabel` | string | | 提交按钮文案 |
| `cancelLabel` | string | | 取消按钮文案 |
| `fallback` | object | | 降级方案：`text` + 可选 `webUrl` / `mobileUrl` |

### `fields[]` 字段定义（对齐 antd Form.Item）

每个字段对象自描述控件、选项、约束、初始值。字段与 [Ant Design Form](https://ant.design/components/form) 的映射：`name`→`Form.Item.name`、`title`→`label`、`description`→`tooltip/help`、`required`+约束→`rules`、`placeholder`→控件 placeholder、`initialValue`→`Form.Item.initialValue`、`options`→`Radio.Group/Select/Checkbox.Group`。

| 字段属性 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | ✅ | formData 的 key，全表单唯一 |
| `title` | string | ✅ | 展示标签（antd label） |
| `widget` | string | ✅ | 控件类型（见控件目录） |
| `description` | string | | 字段帮助文案（tooltip） |
| `required` | boolean | | 是否必填，默认 false |
| `placeholder` | string | | 占位提示 |
| `initialValue` | any | | 字段初始值（旧 `ui.initialValue[name]` 下沉到字段） |
| `type` | string | | 值类型 `string`/`integer`/`number`/`array`，缺省按 widget 推断 |
| `options` | array | | 选择类控件选项：`[{value, label}]`（合并旧 `enum`+`enumNames`） |
| `minimum`/`maximum`/`multipleOf` | number | | 数值约束（widget=number） |
| `minLength`/`maxLength`/`pattern` | | | 文本约束（widget=text/textarea） |
| `accept`/`multiple`/`maxFileSize` | | | 文件控件配置（widget=file） |
| `allowCustom`/`otherValue`/`otherField` | | | radio-with-custom 配置 |

## 工具返回

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
    "title": "请选择一个选项",
    "ui": {
      "version": "nuwax.interaction.v2",
      "presentation": "inline",
      "title": "请选择一个选项",
      "fields": [ /* ... */ ]
    }
  }
}
```

- `status: "pending"` 是给 Agent 的信号，表示问题已展示给用户
- **`input`** 是经 MCP Server 规范化后的完整 `rawInput`（含 `schemaVersion` / `toolName` / `ui.version`）。**平台透传 SSE 时必须优先使用 `structuredContent.input` 作为 `result.input`**，不要直接落库 agent 原始 tool 参数（agent 常漏写 version 字段，会导致 DockPanel 不渲染）
- 本包不维护待处理请求队列，也不等待回调
- 用户的表单回答由客户端格式化后作为下一条聊天消息发送

平台侧也可在持久化前调用：

```ts
import { normalizeMcpAskUserToolInput } from "nuwax-ask-question-mcp/ask-user-payload";
const rawInput = normalizeMcpAskUserToolInput(agentToolArguments);
```

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

`schema.json` 的 `x-nuwax.widgetCatalog` 列出全部控件类型；每个字段通过 `widget` 指定控件：

| `widget` | 说明 | antd 控件 | 自动推断 |
|---|---|---|---|
| `text` | 单行文本 | `Input` | ✅ `type: string` |
| `textarea` | 多行文本 | `Input.TextArea` | ❌ 需显式指定 |
| `number` | 数字 | `InputNumber` | ✅ `type: number/integer` |
| `radio` | 单选 | `Radio.Group` | ✅ 有 `options` |
| `checkboxes` | 多选 | `Checkbox.Group` | ✅ `type: array` + `options` |
| `select` | 下拉单选 | `Select` | ❌ |
| `list` | 列表单选 | `Radio.Group`（竖排） | ❌ |
| `file` | 文件上传 | `Upload` | ❌ |
| `radio-with-custom` | 单选 + 自定义输入 | `Radio.Group` + 输入框 | ❌ 需 `allowCustom: true` |

> v2 推荐 `widget` 必填，消除推断歧义。废弃别名：`input` → `text`，`checkbox` → `checkboxes`。

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
      initialValue: 'test',
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

## 控件示例（fields[]）

### 单选 / 多选：必须展示选项文案

选择类控件（radio/checkboxes/select/list/radio-with-custom）通过 `options: [{value, label}]` 提供选项，**必须给 `label`（人类可读），不要给裸 value**。

```json
[
  {
    "name": "agree",
    "title": "是否同意",
    "widget": "radio",
    "required": true,
    "options": [
      { "value": "yes", "label": "是，我同意" },
      { "value": "no", "label": "否，我拒绝" }
    ]
  }
]
```

### 文件上传

```json
{
  "name": "screenshot",
  "title": "截图",
  "widget": "file",
  "accept": "image/*",
  "multiple": false,
  "maxFileSize": 10485760
}
```

| 选项 | 类型 | 说明 |
|---|---|---|
| `accept` | string | MIME 过滤器，如 `"image/*"`、`"application/pdf"` |
| `multiple` | boolean | 是否允许多文件 |
| `maxFileSize` | number | 单文件最大字节 |

### 数字

```json
{
  "name": "count",
  "title": "并发数",
  "widget": "number",
  "type": "integer",
  "initialValue": 1,
  "minimum": 1,
  "maximum": 10
}
```

### 列表单选

适用于选项较多的单选，渲染为竖排列表：

```json
{
  "name": "framework",
  "title": "前端框架",
  "widget": "list",
  "options": [
    { "value": "react", "label": "React" },
    { "value": "vue", "label": "Vue" },
    { "value": "angular", "label": "Angular" }
  ]
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
- 字段标签取 `ui.fields` 中对应字段的 `title`，缺省时使用字段 `name`
- 选择类展示值优先使用 `options` 中匹配 `value` 的 `label`
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
git tag v4.x.x
git push origin v4.x.x
```

## License

[MIT](LICENSE)

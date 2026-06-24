/**
 * Agent 可见的表单渲染指南（单一真相源）。
 *
 * 大型模型通过 MCP 学习「如何配置支持的表单格式」时，应读到一致内容：
 * - Server instructions（何时调用 + 如何配 ui.schema / ui.uiSchema）
 * - Tool description（速查 + 示例索引）
 * - inputSchema（$defs 结构 + examples + x-nuwax 机器可读目录）
 * - Resource nuwax://docs/form-rendering-guide（完整 JSON 指南）
 *
 * 控件命名与示例均来自 widgets.ts，与 DockPanel 渲染契约对齐。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ASK_SCHEMA_VERSION,
  ASK_STATUS_PENDING,
  INTERACTION_UI_SCHEMA_VERSION,
  MCP_ASK_TOOL_NAME,
} from "./types.js";
import {
  MCP_ASK_WIDGET_TYPES,
  WIDGET_CATALOG,
  WIDGET_INFERENCE_RULES,
  type WidgetCatalogEntry,
} from "./widgets.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * complete-form.json 缺失/损坏时的兜底多字段示例。
 * 该文件在 import 期被读取(ASK_TOOL_DESCRIPTION / inputSchema 构建链),
 * 不兜底则打包疏漏会从「文档退化」升级为「服务无法启动」。
 */
const COMPLETE_FORM_EXAMPLE_FALLBACK: Record<string, unknown> = {
  requestId: "ask_demo_001",
  revision: 1,
  sessionId: "session_demo",
  title: "请确认继续方式",
  ui: {
    presentation: "inline",
    title: "请确认继续方式",
    schema: {
      type: "object",
      required: ["choice", "remark"],
      properties: {
        choice: {
          type: "string",
          title: "继续方式",
          enum: ["test", "deploy"],
          enumNames: ["先跑测试", "直接部署"],
        },
        remark: { type: "string", title: "补充说明" },
      },
    },
    uiSchema: {
      choice: { "ui:widget": "radio" },
      remark: { "ui:widget": "textarea" },
    },
  },
};

/** 读取 complete-form.json(去掉 toolName);缺失时回退到内置兜底,避免 import 期抛错。 */
function loadCompleteFormExample(): Record<string, unknown> {
  try {
    const completePath = join(packageRoot, "schemas/examples/complete-form.json");
    const raw = JSON.parse(readFileSync(completePath, "utf8")) as Record<
      string,
      unknown
    >;
    const { toolName: _toolName, ...rest } = raw;
    return rest;
  } catch {
    return COMPLETE_FORM_EXAMPLE_FALLBACK;
  }
}

/** presentation 各模式说明 */
export const PRESENTATION_MODES = [
  {
    value: "inline",
    description: "内嵌在对话流中（默认推荐）",
  },
  {
    value: "modal",
    description: "模态弹层，适合强确认或短表单",
  },
  {
    value: "wizard",
    description: "分步向导；需 ui.steps 指定每步 fields",
  },
  {
    value: "table",
    description: "表格编辑；需 ui.table 配置",
  },
] as const;

/** Agent 配置表单的两层结构说明 */
export const FORM_RENDERING_LAYERS = {
  "ui.schema":
    "标准 JSON Schema object：定义字段 type/title/enum/enumNames/required 等。DockPanel 据此渲染控件。",
  "ui.uiSchema":
    "RJSF 风格：按字段名覆盖 ui:widget 与 ui:options。未写 ui:widget 时按推断规则从 schema 自动选择控件。",
} as const;

/** 从 WIDGET_CATALOG 生成单行速查（description / schema description 用） */
export function buildWidgetQuickReference(): string {
  return WIDGET_CATALOG.map((entry) => formatWidgetLine(entry)).join("\n");
}

function formatWidgetLine(entry: WidgetCatalogEntry): string {
  const infer = entry.autoInfer ? "auto-infer" : "set ui:widget";
  const ui =
    Object.keys(entry.uiSchema).length > 0
      ? ` uiSchema=${JSON.stringify(entry.uiSchema)}`
      : "";
  return `- ${entry.type} (${entry.label}): schema=${JSON.stringify(entry.jsonSchema)}; ${infer}${ui}`;
}

/** 推断规则文本 */
export function buildInferenceRulesText(): string {
  return WIDGET_INFERENCE_RULES.map((r) => `  ${r.when} → ${r.widget}`).join(
    "\n",
  );
}

/** 表单渲染核心规则（instructions / description 共用） */
export function buildFormRenderingRules(): string[] {
  return [
    "Form rendering format (nuwax.interaction.v1):",
    "1. Put field definitions in ui.schema (JSON Schema object with type, properties, required).",
    "2. Optionally set ui.uiSchema per field: { \"fieldName\": { \"ui:widget\": \"<widget>\", \"ui:options\": {...} } }.",
    `3. Supported ui:widget values: ${MCP_ASK_WIDGET_TYPES.join(", ")}.`,
    "4. Choices MUST use enum + enumNames (same length, human-readable labels). Never show bare enum values.",
    "5. checkboxes: type=array, items.enum in schema; enumNames often in ui.uiSchema[field].ui:options.",
    "6. file: type=string, format=data-url, ui:widget=file; ui:options.accept for MIME filter.",
    "7. textarea/select/list/file/radio-with-custom: set ui:widget explicitly (not auto-inferred).",
    "8. schemaVersion and ui.version may be omitted — server fills defaults on call.",
  ];
}

/**
 * 最小单选示例（examples[0]）。
 * 刻意手写「agree/decline」这一有语义的最小场景,而非复用 WIDGET_CATALOG 的通用 a/b——
 * 它是"给 agent 看的第一个范例",可读性优先。契约漂移由 mcpToolInputJsonSchema 的 ajv 回归测试兜底。
 */
const MINIMAL_RADIO_EXAMPLE: Record<string, unknown> = {
  requestId: "ask_1",
  revision: 1,
  sessionId: "sess_1",
  title: "Choose",
  ui: {
    presentation: "inline",
    title: "Pick one",
    schema: {
      type: "object",
      properties: {
        choice: {
          type: "string",
          title: "Your choice",
          enum: ["agree", "decline"],
          enumNames: ["Yes, I agree", "No, I decline"],
        },
      },
      required: ["choice"],
    },
    uiSchema: {
      choice: { "ui:widget": "radio" },
    },
  },
};

/**
 * Agent 工具入参示例（不含 toolName）。
 * 含：最小单选 + 多控件完整示例（源自 schemas/examples/complete-form.json）+ 全控件目录。
 */
export function buildMcpToolInputExamples(): Record<string, unknown>[] {
  const minimalRadio = MINIMAL_RADIO_EXAMPLE;

  const completeForm = loadCompleteFormExample();

  const perWidget = {
    requestId: "ask_widgets",
    revision: 1,
    sessionId: "sess_widgets",
    title: "Widget catalog demo",
    ui: {
      presentation: "inline",
      title: "One field per supported widget",
      schema: {
        type: "object",
        properties: Object.fromEntries(
          WIDGET_CATALOG.map((w) => [w.type, { ...w.jsonSchema, title: w.label }]),
        ),
      },
      uiSchema: Object.fromEntries(
        WIDGET_CATALOG.filter((w) => Object.keys(w.uiSchema).length > 0).map(
          (w) => [w.type, w.uiSchema],
        ),
      ),
    },
  };

  return [minimalRadio, completeForm, perWidget];
}

/**
 * 完整 JSON 指南文档（MCP Resource + x-nuwax 引用）。
 */
export function buildAgentFormRenderingGuideDocument(): Record<string, unknown> {
  return {
    protocolVersion: ASK_SCHEMA_VERSION,
    interactionVersion: INTERACTION_UI_SCHEMA_VERSION,
    toolName: MCP_ASK_TOOL_NAME,
    overview:
      "Configure interactive forms via ui.schema (JSON Schema fields) and ui.uiSchema (RJSF widget overrides). Clients render DockPanel from this payload.",
    layers: FORM_RENDERING_LAYERS,
    presentationModes: PRESENTATION_MODES,
    supportedWidgets: [...MCP_ASK_WIDGET_TYPES],
    widgetCatalog: WIDGET_CATALOG.map((w) => ({
      type: w.type,
      label: w.label,
      jsonSchema: w.jsonSchema,
      uiSchema: w.uiSchema,
      autoInfer: w.autoInfer,
      clientSupport: w.clientSupport,
    })),
    inferenceRules: WIDGET_INFERENCE_RULES.map((r) => ({ ...r })),
    rules: buildFormRenderingRules(),
    examples: buildMcpToolInputExamples(),
  };
}

/** MCP Server instructions：何时调用 + 如何配置表单 */
export function buildMcpServerInstructions(): string {
  return [
    `You have access to ${MCP_ASK_TOOL_NAME} — present an interactive form and pause until the user responds.`,
    "",
    "When to call (prefer over plain-text questions or guessing):",
    "- Missing info, preferences, confirmations, or structured data",
    "- Multiple valid approaches — let the user choose",
    "- Before irreversible or ambiguous work",
    "",
    "After calling: STOP generating. User answer arrives as the next chat message.",
    "",
    ...buildFormRenderingRules(),
    "",
    "Widget inference (when ui:widget omitted):",
    buildInferenceRulesText(),
    "",
    "Widget quick reference:",
    buildWidgetQuickReference(),
    "",
    "See tool inputSchema examples and resource nuwax://docs/form-rendering-guide for full details.",
  ].join("\n");
}

/** MCP Tool description：用途 + 渲染格式速查 */
export function buildAskToolDescription(): string {
  const examples = buildMcpToolInputExamples();
  return [
    `Present an interactive form and wait for the user. Use ${MCP_ASK_TOOL_NAME} for input, choices, confirmations, or structured data.`,
    "",
    "ALWAYS use this tool instead of guessing or asking in plain text.",
    "DO NOT ask for secrets (passwords, API keys, tokens).",
    "",
    `Returns status "${ASK_STATUS_PENDING}" immediately; answer arrives as the next user message.`,
    "",
    `Rendering: ${INTERACTION_UI_SCHEMA_VERSION} — ui.schema (JSON Schema fields) + ui.uiSchema (ui:widget / ui:options).`,
    `Supported widgets: ${MCP_ASK_WIDGET_TYPES.join(", ")}.`,
    "Choices: enum + enumNames (equal length). checkboxes: array + items.enum.",
    "",
    "Presentation: inline (default) | modal | wizard (+ ui.steps) | table (+ ui.table).",
    "",
    "Minimal example:",
    JSON.stringify(examples[0]),
    "",
    "Multi-field example: see inputSchema.examples[1] or resource nuwax://docs/form-rendering-guide.",
  ].join("\n");
}

/** inputSchema 根 description（结构说明 + 速查） */
export function buildMcpToolInputSchemaDescription(): string {
  return [
    `${MCP_ASK_TOOL_NAME} tool input (no toolName). Rendering contract: ${INTERACTION_UI_SCHEMA_VERSION}.`,
    "",
    "Configure forms with two layers:",
    `- ui.schema: ${FORM_RENDERING_LAYERS["ui.schema"]}`,
    `- ui.uiSchema: ${FORM_RENDERING_LAYERS["ui.uiSchema"]}`,
    "",
    "Presentation modes:",
    ...PRESENTATION_MODES.map((m) => `  ${m.value}: ${m.description}`),
    "",
    "Widget inference:",
    buildInferenceRulesText(),
    "",
    "Widget catalog:",
    buildWidgetQuickReference(),
  ].join("\n");
}

/** MCP Resource URI */
export const FORM_RENDERING_GUIDE_URI =
  "nuwax://docs/form-rendering-guide" as const;

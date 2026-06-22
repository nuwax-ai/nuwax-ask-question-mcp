import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  InteractionUiSchema,
  McpAskUserToolInputSchema,
  ASK_SCHEMA_VERSION,
  INTERACTION_UI_SCHEMA_VERSION,
  MCP_ASK_TOOL_NAME,
  ASK_STATUS_PENDING,
  MCP_SERVER_TRANSPORT,
} from "../src/types.js";
import {
  DEPRECATED_BUILDER_ALIASES,
  MCP_ASK_WIDGET_TYPES,
  WIDGET_CATALOG,
  WIDGET_INFERENCE_RULES,
} from "../src/widgets.js";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = join(rootDir, "schemas/schema.json");

const existing = JSON.parse(readFileSync(schemaPath, "utf8")) as {
  $defs: Record<string, unknown>;
  "x-nuwax": Record<string, unknown>;
};

const askToolInputWithoutToolName = McpAskUserToolInputSchema.omit({ toolName: true });
const zodNuwaxInput = zodToJsonSchema(askToolInputWithoutToolName, {
  name: "NuwaxAskQuestionInput",
  $refStrategy: "none",
}).definitions?.NuwaxAskQuestionInput;

const zodInteractionUi = zodToJsonSchema(InteractionUiSchema, {
  name: "InteractionUi",
  $refStrategy: "none",
}).definitions?.InteractionUi;

if (!zodNuwaxInput || !zodInteractionUi) {
  throw new Error("Failed to generate Zod JSON Schema fragments");
}

existing.$defs.WidgetType = {
  type: "string",
  enum: [...MCP_ASK_WIDGET_TYPES],
  description:
    "字段控件类型（ui:widget）。与 RJSF 通行命名对齐；Builder 层 field.type 应使用相同值",
};

existing.$defs.WidgetCatalog = {
  ...(existing.$defs.WidgetCatalog as object),
  default: WIDGET_CATALOG,
};

existing.$defs.DeprecatedBuilderAliases = {
  type: "object",
  description: "已废弃的 Builder 别名，生成 rawInput 时必须映射",
  additionalProperties: false,
  properties: Object.fromEntries(
    Object.entries(DEPRECATED_BUILDER_ALIASES).map(([alias, target]) => [
      alias,
      { const: target },
    ]),
  ),
};

existing.$defs.WidgetInferenceRules = {
  type: "array",
  description: "未写 ui:widget 时 nuwax parseMcpAskSchema 推断规则",
  readOnly: true,
  default: WIDGET_INFERENCE_RULES.map((rule) => ({
    when: rule.when,
    widget: rule.widget,
  })),
};

existing.$defs.NuwaxAskQuestionInput = {
  ...(zodNuwaxInput as object),
  title: "MCP Tool Input",
  description: "nuwax_ask_question 工具入参（不含 toolName）",
};

existing.$defs.InteractionUi = {
  ...(zodInteractionUi as object),
  description: "交互 UI 定义；DockPanel / McpAskQuestionCard 直接消费",
};

existing["x-nuwax"] = {
  ...(existing["x-nuwax"] as object),
  protocolVersion: "1.0.0",
  constants: {
    schemaVersion: ASK_SCHEMA_VERSION,
    uiVersion: INTERACTION_UI_SCHEMA_VERSION,
    toolName: MCP_ASK_TOOL_NAME,
    pendingStatus: ASK_STATUS_PENDING,
    transport: MCP_SERVER_TRANSPORT,
  },
  transport: MCP_SERVER_TRANSPORT,
  transportNote:
    "MCP Host 以子进程 stdio 拉起本包；用户表单由 nuwax Web/Mobile 渲染，不经本进程 HTTP",
  primaryEntry: "McpAskUserToolInput",
  completeFormExample: "schemas/examples/complete-form.json",
  widgetTypes: [...MCP_ASK_WIDGET_TYPES],
};

writeFileSync(schemaPath, `${JSON.stringify(existing, null, 2)}\n`, "utf8");
console.log(`Updated ${schemaPath}`);

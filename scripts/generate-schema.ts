/**
 * 从 src/types.ts（+ widgets.ts）派生 schemas/schema.json 的「自动区」。
 *
 * schema.json = 手写区（顶层 meta、oneOf、响应/枚举等 $defs）+ 自动区（本脚本覆写）。
 * 自动区：NuwaxAskQuestionInput / InteractionUi（Zod 派生，字段模型内联、无 $ref，自解释）、
 *         WidgetType / DeprecatedBuilderAliases / WidgetInferenceRules、x-nuwax 元数据。
 * 手写区勿在此编辑；改 types.ts / widgets.ts 后跑 `npm run generate:schema`。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  ASK_SCHEMA_VERSION,
  ASK_STATUS_PENDING,
  INTERACTION_UI_SCHEMA_VERSION,
  InteractionUiSchema,
  MCP_ASK_TOOL_NAME,
  MCP_SERVER_TRANSPORT,
  McpAskUserToolInputSchema,
} from "../src/types.js";
import { DEPRECATED_BUILDER_ALIASES, MCP_ASK_WIDGET_TYPES } from "../src/widgets.js";

const schemaPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "schemas/schema.json",
);

type Def = Record<string, unknown>;

/** Zod schema → 内联 JSON Schema 片段（无 $ref，自包含）；失败即报错。 */
function zodDef(schema: ZodTypeAny, name: string): Def {
  const def = zodToJsonSchema(schema, { name, $refStrategy: "none" }).definitions?.[name];
  if (!def) throw new Error(`Failed to generate Zod JSON Schema fragment: ${name}`);
  return def as Def;
}

/** wizard steps[].fields → $ref ui.fields（$refStrategy: "none" 会内联，需后处理） */
function patchWizardStepFieldRefs(uiDef: Def, fieldsRef: string): void {
  const steps = (uiDef.properties as Def | undefined)?.steps as Def | undefined;
  const stepProps = (steps?.items as Def | undefined)?.properties as Def | undefined;
  if (stepProps?.fields && typeof stepProps.fields === "object") {
    stepProps.fields = {
      $ref: fieldsRef,
      description: "本步展示的字段 name 数组，引用 ui.fields 中字段的 name",
    };
  }
}

const doc = JSON.parse(readFileSync(schemaPath, "utf8")) as {
  $defs: Record<string, Def>;
  "x-nuwax": Def;
};

// 1) 从 types.ts 派生核心结构（字段模型内联，无 $ref，打开即见全部字段与描述）
doc.$defs.NuwaxAskQuestionInput = {
  ...zodDef(McpAskUserToolInputSchema.omit({ toolName: true }), "NuwaxAskQuestionInput"),
  title: "MCP Tool Input",
  description: "nuwax_ask_question 工具入参（不含 toolName）",
};
doc.$defs.InteractionUi = {
  ...zodDef(InteractionUiSchema, "InteractionUi"),
  description: "交互 UI 定义；DockPanel / McpAskQuestionCard 直接消费",
};
patchWizardStepFieldRefs(
  doc.$defs.InteractionUi,
  "#/$defs/InteractionUi/properties/fields",
);
patchWizardStepFieldRefs(
  (doc.$defs.NuwaxAskQuestionInput.properties as Def).ui as Def,
  "#/$defs/NuwaxAskQuestionInput/properties/ui/properties/fields",
);
// Presentation 枚举的真相源是 types.ts InteractionUi.presentation；该手写 $def 已无人引用且易漂移
// （曾残留已废弃的 "table"），删除以保持单一真相源。
delete doc.$defs.Presentation;
// AskSchemaVersion 同理：真相源是 types.ts ASK_SCHEMA_VERSION（已生成进 NuwaxAskQuestionInput）。
delete doc.$defs.AskSchemaVersion;
// 字段模型已内联进 NuwaxAskQuestionInput/InteractionUi，移除历史遗留的独立 $defs
delete doc.$defs.FormField;
delete doc.$defs.FieldOption;

// 2) 控件相关：widget 名单、废弃别名、推断规则结构（仅格式，实例见 widgets.ts）
doc.$defs.WidgetType = {
  type: "string",
  enum: [...MCP_ASK_WIDGET_TYPES],
  description:
    "字段控件类型（widget）。v2 起作为字段必填属性；Builder 层 field.type 应使用相同值",
};
doc.$defs.DeprecatedBuilderAliases = {
  type: "object",
  description: "已废弃的 Builder 别名，生成 rawInput 时必须映射",
  additionalProperties: false,
  properties: Object.fromEntries(
    Object.entries(DEPRECATED_BUILDER_ALIASES).map(([alias, target]) => [alias, { const: target }]),
  ),
};
doc.$defs.WidgetInferenceRules = {
  type: "array",
  description: "v2 推荐 widget 必填；省略时按下列规则推断控件（格式定义，具体规则见 widgets.ts）",
  items: {
    type: "object",
    properties: { when: { type: "string" }, widget: { $ref: "#/$defs/WidgetType" } },
    required: ["when", "widget"],
    additionalProperties: false,
  },
};

// 3) 协议元数据
doc["x-nuwax"] = {
  ...doc["x-nuwax"],
  protocolVersion: "2.0.0",
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

writeFileSync(schemaPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
console.log(`Updated ${schemaPath}`);

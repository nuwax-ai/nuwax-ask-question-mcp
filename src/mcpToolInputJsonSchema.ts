/**
 * MCP tools/list 专用富 JSON Schema（给 LLM 看）。
 *
 * 单一真相源：widgets.ts + types.ts（不读取 schemas/schema.json）。
 * 结构复用通过 `definitions` + `$ref` 表达，比全 inline 更小；Host 需能解析文档内引用。
 *
 * tools/call 仍用 askUserPayloadShape（宽松 Zod）；本文件仅用于 tools/list 展示。
 */
import {
  buildAgentFormRenderingGuideDocument,
  buildMcpToolInputExamples,
  buildMcpToolInputSchemaDescription,
  FORM_RENDERING_GUIDE_URI,
  PRESENTATION_MODES,
} from "./agentFormGuide.js";
import {
  ASK_SCHEMA_VERSION,
  INTERACTION_UI_SCHEMA_VERSION,
} from "./types.js";
import { MCP_ASK_WIDGET_TYPES } from "./widgets.js";

/** 文档内 $ref 前缀（draft-07 用 definitions 作为同文档引用容器） */
const DEF = "#/definitions";

/**
 * 可复用 JSON Schema 片段，由根 schema 与 `$ref` 引用。
 * 命名与协议契约（FormObjectSchema / FormFieldProperty 等）对齐。
 */
export const MCP_TOOL_INPUT_SCHEMA_DEFS: Record<string, unknown> = {
  JsonSchemaPropertyBase: {
    type: "object",
    description: "字段 JSON Schema 公共属性",
    properties: {
      title: {
        type: "string",
        description: "字段标签；resume 消息与 DockPanel 展示优先使用",
      },
      description: { type: "string" },
      default: { description: "默认值" },
    },
    additionalProperties: true,
  },

  TextFieldProperty: {
    allOf: [
      { $ref: `${DEF}/JsonSchemaPropertyBase` },
      {
        type: "object",
        required: ["type"],
        properties: {
          type: { const: "string" },
          minLength: { type: "integer", minimum: 0 },
          maxLength: { type: "integer", minimum: 0 },
          pattern: { type: "string" },
        },
        not: { required: ["enum"] },
      },
    ],
    description: "widget=text。单行文本；可省略 ui:widget，默认推断为 text",
  },

  TextareaFieldProperty: {
    allOf: [
      { $ref: `${DEF}/JsonSchemaPropertyBase` },
      {
        type: "object",
        required: ["type"],
        properties: {
          type: { const: "string" },
          minLength: { type: "integer", minimum: 0 },
          maxLength: { type: "integer", minimum: 0 },
        },
        not: { required: ["enum"] },
      },
    ],
    description: "widget=textarea。需 ui:widget=textarea",
  },

  NumberFieldProperty: {
    allOf: [
      { $ref: `${DEF}/JsonSchemaPropertyBase` },
      {
        type: "object",
        required: ["type"],
        properties: {
          type: { type: "string", enum: ["number", "integer"] },
          minimum: { type: "number" },
          maximum: { type: "number" },
          exclusiveMinimum: { type: "number" },
          exclusiveMaximum: { type: "number" },
          multipleOf: { type: "number" },
        },
      },
    ],
    description:
      "widget=number。需 ui:widget=number；type=number/integer 时可自动推断",
  },

  EnumFieldProperty: {
    allOf: [
      { $ref: `${DEF}/JsonSchemaPropertyBase` },
      {
        type: "object",
        required: ["type", "enum", "enumNames"],
        properties: {
          type: { const: "string" },
          enum: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
          },
          enumNames: {
            type: "array",
            items: { type: "string" },
            description: "与 enum 等长；单选/多选必须提供人类可读标签",
          },
        },
      },
    ],
    description:
      "widget=radio|select|list|radio-with-custom 的基础 schema。有 enum 时默认推断为 radio",
  },

  CheckboxesFieldProperty: {
    allOf: [
      { $ref: `${DEF}/JsonSchemaPropertyBase` },
      {
        type: "object",
        required: ["type", "items"],
        properties: {
          type: { const: "array" },
          items: {
            type: "object",
            required: ["type", "enum"],
            properties: {
              type: { const: "string" },
              enum: {
                type: "array",
                items: { type: "string" },
                minItems: 1,
              },
            },
            additionalProperties: true,
          },
          minItems: { type: "integer", minimum: 0 },
          maxItems: { type: "integer", minimum: 0 },
          uniqueItems: { type: "boolean" },
        },
      },
    ],
    description:
      "widget=checkboxes。多选；可省略 ui:widget，有 items.enum 时自动推断",
  },

  FileFieldProperty: {
    allOf: [
      { $ref: `${DEF}/JsonSchemaPropertyBase` },
      {
        type: "object",
        required: ["type", "format"],
        properties: {
          type: { const: "string" },
          format: { const: "data-url" },
        },
      },
    ],
    description: "widget=file。需 ui:widget=file",
  },

  FormFieldProperty: {
    // anyOf（非 oneOf）：text/textarea/file 等分支结构上可重叠（同为 type=string），
    // oneOf 会因「命中多个」把合法字段判为非法。anyOf 容忍重叠,仍能表达「属于其一」。
    anyOf: [
      { $ref: `${DEF}/TextFieldProperty` },
      { $ref: `${DEF}/TextareaFieldProperty` },
      { $ref: `${DEF}/NumberFieldProperty` },
      { $ref: `${DEF}/EnumFieldProperty` },
      { $ref: `${DEF}/CheckboxesFieldProperty` },
      { $ref: `${DEF}/FileFieldProperty` },
    ],
    description: "表单单个字段的 JSON Schema property",
  },

  FormObjectSchema: {
    type: "object",
    description: "ui.schema 根：标准 JSON Schema object",
    required: ["type", "properties"],
    properties: {
      type: { const: "object" },
      title: { type: "string" },
      description: { type: "string" },
      properties: {
        type: "object",
        minProperties: 1,
        additionalProperties: { $ref: `${DEF}/FormFieldProperty` },
        description: "字段名 → 字段 JSON Schema",
      },
      required: {
        type: "array",
        items: { type: "string" },
        description: "必填字段名列表",
      },
    },
    additionalProperties: true,
  },

  WidgetType: {
    type: "string",
    enum: [...MCP_ASK_WIDGET_TYPES],
    description:
      "字段控件类型（ui:widget）。与 RJSF 通行命名对齐；未写时按 WIDGET_INFERENCE_RULES 推断",
  },

  FieldUiOptions: {
    type: "object",
    description: "uiSchema 字段级或根级 ui:options",
    properties: {
      enumNames: {
        type: "array",
        items: { type: "string" },
        description:
          "选项展示文案，与 enum 一一对应；checkboxes 的 resume 优先读取",
      },
      placeholder: { type: "string" },
      allowSkip: {
        type: "boolean",
        description: "根级 ui:options：是否显示跳过按钮",
      },
      skipLabel: { type: "string" },
      allowCustom: {
        type: "boolean",
        description: "radio-with-custom：是否允许自定义选项",
      },
      otherValue: {
        type: "string",
        description: "radio-with-custom：自定义选项的值，默认 __custom__",
      },
      otherField: {
        type: "string",
        description: "radio-with-custom：自定义输入框字段名",
      },
      accept: {
        type: "string",
        description: "file：MIME 过滤器，如 image/*",
      },
      multiple: {
        type: "boolean",
        description: "file：是否允许多文件",
      },
      maxFileSize: {
        type: "integer",
        exclusiveMinimum: 0,
        description: "file：单文件最大字节数",
      },
    },
    additionalProperties: true,
  },

  FieldUiSchemaEntry: {
    type: "object",
    description: "单个字段的 uiSchema 配置",
    properties: {
      "ui:widget": { $ref: `${DEF}/WidgetType` },
      "ui:options": { $ref: `${DEF}/FieldUiOptions` },
      "ui:order": {
        type: "array",
        items: { type: "string" },
        description: "字段显示顺序（根级 ui:order）",
      },
    },
    additionalProperties: true,
  },

  UiSchema: {
    type: "object",
    description:
      "RJSF 风格 UI Schema，key 为字段名或 ui:options/ui:order 等根级键",
    additionalProperties: {
      // anyOf:FieldUiSchemaEntry 与 FieldUiOptions 均为开放对象(additionalProperties:true)，
      // 任意对象都会同时命中两者,oneOf 必失败;anyOf 容忍重叠。
      anyOf: [
        { $ref: `${DEF}/FieldUiSchemaEntry` },
        { type: "array", items: { type: "string" } },
        { $ref: `${DEF}/FieldUiOptions` },
      ],
    },
  },

  WizardStep: {
    type: "object",
    additionalProperties: false,
    required: ["id", "title", "fields"],
    properties: {
      id: { type: "string", minLength: 1 },
      title: { type: "string", minLength: 1 },
      description: { type: "string" },
      fields: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        description: "本步骤包含的 ui.schema.properties 字段名",
      },
    },
  },

  Fallback: {
    type: "object",
    additionalProperties: false,
    required: ["text"],
    description: "客户端无法渲染表单时的降级文案/链接",
    properties: {
      text: { type: "string" },
      webUrl: { type: "string", format: "uri" },
      mobileUrl: { type: "string", format: "uri" },
    },
  },
};

/** presentation 枚举的 description（含各模式说明） */
function buildPresentationDescription(): string {
  return PRESENTATION_MODES.map((m) => `${m.value}=${m.description}`).join(
    "; ",
  );
}

/**
 * 构建 nuwax_ask_question 的富 inputSchema（`definitions` + `$ref` + examples + x-nuwax）。
 */
export function buildMcpToolInputJsonSchema(): Record<string, unknown> {
  const renderingGuide = buildAgentFormRenderingGuideDocument();
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    additionalProperties: false,
    required: ["requestId", "revision", "sessionId", "title", "ui"],
    properties: {
      schemaVersion: {
        type: "string",
        const: ASK_SCHEMA_VERSION,
        default: ASK_SCHEMA_VERSION,
        description: "MCP Ask 契约版本；可省略，默认自动补齐",
      },
      requestId: {
        type: "string",
        minLength: 1,
        description: "本次问答唯一 ID，用于关联用户回复",
      },
      revision: {
        type: "integer",
        exclusiveMinimum: 0,
        description: "修订号，同 requestId 下递增",
      },
      sessionId: {
        type: "string",
        minLength: 1,
        description: "会话 ID",
      },
      title: {
        type: "string",
        minLength: 1,
        description: "卡片标题（顶层）",
      },
      description: {
        type: "string",
        description: "卡片说明（顶层，可选）",
      },
      ui: {
        type: "object",
        additionalProperties: true,
        required: ["presentation", "title", "schema"],
        description:
          "交互 UI 定义。字段数据在 schema（JSON Schema），控件样式在 uiSchema（ui:widget）。DockPanel 直接消费。",
        properties: {
          version: {
            type: "string",
            const: INTERACTION_UI_SCHEMA_VERSION,
            default: INTERACTION_UI_SCHEMA_VERSION,
            description: "交互 UI 契约版本；可省略，默认自动补齐",
          },
          presentation: {
            type: "string",
            enum: ["modal", "inline", "wizard", "table"],
            description: `展示方式：${buildPresentationDescription()}`,
          },
          title: {
            type: "string",
            minLength: 1,
            description: "表单标题",
          },
          description: { type: "string" },
          schema: { $ref: `${DEF}/FormObjectSchema` },
          uiSchema: { $ref: `${DEF}/UiSchema` },
          table: {
            type: "object",
            additionalProperties: true,
            description: "presentation=table 时的表格配置",
          },
          initialValue: {
            type: "object",
            additionalProperties: true,
            description: "表单初始值，key 为字段名",
          },
          steps: {
            type: "array",
            description: "presentation=wizard 时的步骤定义",
            items: { $ref: `${DEF}/WizardStep` },
          },
          submitLabel: { type: "string" },
          cancelLabel: { type: "string" },
          fallback: { $ref: `${DEF}/Fallback` },
        },
      },
      business: {
        type: "object",
        additionalProperties: true,
        description: "业务透传字段，不影响 UI 渲染",
      },
      timeoutMs: {
        type: "integer",
        exclusiveMinimum: 0,
        description: "超时毫秒数",
      },
      priority: {
        type: "string",
        enum: ["normal", "high"],
      },
    },
    description: buildMcpToolInputSchemaDescription(),
    // 最小单选 + 多字段完整示例；全控件目录见 x-nuwax.formRenderingGuideUri
    examples: buildMcpToolInputExamples().slice(0, 2),
    "x-nuwax": {
      formRenderingGuideUri: FORM_RENDERING_GUIDE_URI,
      interactionVersion: renderingGuide.interactionVersion,
      supportedWidgets: renderingGuide.supportedWidgets,
      presentationModes: renderingGuide.presentationModes,
    },
    definitions: MCP_TOOL_INPUT_SCHEMA_DEFS,
  };
}

/**
 * 解析文档内 `$ref`（仅支持 `#/definitions/Name`），供测试与 Host 侧 dereference 参考。
 */
export function resolveMcpToolInputSchemaRef(
  schema: Record<string, unknown>,
  ref: string,
): Record<string, unknown> {
  const prefix = "#/definitions/";
  if (!ref.startsWith(prefix)) {
    throw new Error(`Unsupported ref: ${ref}`);
  }
  const name = ref.slice(prefix.length);
  const defs = schema.definitions as
    | Record<string, Record<string, unknown>>
    | undefined;
  const target = defs?.[name];
  if (!target) {
    throw new Error(`Missing $defs entry: ${name}`);
  }
  return target;
}

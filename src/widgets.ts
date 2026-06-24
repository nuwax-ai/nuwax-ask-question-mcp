/**
 * MCP Ask 控件白名单与 Builder 目录。
 * 三端 widget 命名与 schemas/schema.json 的单一 TS 真相源。
 * 注意：本文件不得 import types.ts（types.ts 反向依赖本文件的 MCP_ASK_WIDGET_TYPES）。
 */

/** v1 控件类型 */
export const MCP_ASK_WIDGET_TYPES = [
  "text",
  "textarea",
  "number",
  "radio",
  "checkboxes",
  "select",
  "list",
  "file",
  "radio-with-custom",
] as const;

export type McpAskWidgetType = (typeof MCP_ASK_WIDGET_TYPES)[number];

/** Builder 废弃别名 → 标准 widget 名 */
export const DEPRECATED_BUILDER_ALIASES = {
  input: "text",
  checkbox: "checkboxes",
} as const satisfies Record<string, McpAskWidgetType>;

export type DeprecatedBuilderFieldType = keyof typeof DEPRECATED_BUILDER_ALIASES;

/**
 * v2 字段模板（控件目录用）：示意形态，widget 必填，其余为可选示例键。
 * v2 起 JSON Schema property 与 uiSchema 条目合并为单一字段对象。
 */
export interface WidgetFieldTemplate {
  widget: McpAskWidgetType;
  [key: string]: unknown;
}

/** v2 省略 widget 时的推断规则（文档用途；v2 推荐 widget 必填） */
export const WIDGET_INFERENCE_RULES = [
  { when: "options 存在（选择类）", widget: "radio" },
  { when: "type=number 或 type=integer", widget: "number" },
  { when: "type=array", widget: "checkboxes" },
  { when: "type=string 或其他", widget: "text" },
] as const;

export interface WidgetCatalogEntry {
  type: McpAskWidgetType;
  label: string;
  /** v2 字段模板示例（控件/选项/约束合并） */
  field: WidgetFieldTemplate;
  autoInfer: boolean;
  clientSupport: "supported" | "planned";
}

/** Builder 控件目录：entry.type 与 field.widget 同名 */
export const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  {
    type: "text",
    label: "单行文本",
    field: { widget: "text", title: "字段名" },
    autoInfer: true,
    clientSupport: "supported",
  },
  {
    type: "textarea",
    label: "多行文本",
    field: { widget: "textarea", title: "备注" },
    autoInfer: false,
    clientSupport: "supported",
  },
  {
    type: "number",
    label: "数字",
    field: { widget: "number", type: "integer", title: "数量", minimum: 0 },
    autoInfer: true,
    clientSupport: "supported",
  },
  {
    type: "radio",
    label: "单选",
    field: {
      widget: "radio",
      title: "选项",
      options: [
        { value: "a", label: "选项A" },
        { value: "b", label: "选项B" },
      ],
    },
    autoInfer: true,
    clientSupport: "supported",
  },
  {
    type: "checkboxes",
    label: "多选",
    field: {
      widget: "checkboxes",
      type: "array",
      title: "检查项",
      options: [
        { value: "lint", label: "代码检查" },
        { value: "test", label: "单元测试" },
      ],
    },
    autoInfer: true,
    clientSupport: "supported",
  },
  {
    type: "select",
    label: "下拉单选",
    field: {
      widget: "select",
      title: "选项",
      options: [
        { value: "a", label: "选项A" },
        { value: "b", label: "选项B" },
      ],
    },
    autoInfer: false,
    clientSupport: "supported",
  },
  {
    type: "list",
    label: "列表单选",
    field: {
      widget: "list",
      title: "框架",
      options: [
        { value: "react", label: "React" },
        { value: "vue", label: "Vue" },
      ],
    },
    autoInfer: false,
    clientSupport: "supported",
  },
  {
    type: "file",
    label: "文件上传",
    field: { widget: "file", title: "截图", accept: "image/*", multiple: false },
    autoInfer: false,
    clientSupport: "supported",
  },
  {
    type: "radio-with-custom",
    label: "单选+自定义",
    field: {
      widget: "radio-with-custom",
      title: "方式",
      allowCustom: true,
      options: [
        { value: "deploy", label: "部署" },
        { value: "test", label: "测试" },
      ],
    },
    autoInfer: false,
    clientSupport: "supported",
  },
];

/**
 * 将 Builder 层 field.type 规范化为标准 widget 名。
 */
export function normalizeBuilderFieldType(type: string): McpAskWidgetType {
  const alias = DEPRECATED_BUILDER_ALIASES[type as DeprecatedBuilderFieldType];
  if (alias) {
    return alias;
  }
  if ((MCP_ASK_WIDGET_TYPES as readonly string[]).includes(type)) {
    return type as McpAskWidgetType;
  }
  throw new Error(
    `Unsupported builder field type "${type}". Use one of: ${MCP_ASK_WIDGET_TYPES.join(", ")}`,
  );
}

/**
 * 从 JSON Schema property 中提取主类型（忽略 null 联合成员）。
 * 仍供外部（Mobile）解析器在兼容旧 object 形态时使用。
 *
 * @example
 * getJsonSchemaPrimaryType({ type: "string" })                // "string"
 * getJsonSchemaPrimaryType({ type: ["integer", "null"] })     // "integer"
 * getJsonSchemaPrimaryType({ type: ["null", "number"] })      // "number"
 * getJsonSchemaPrimaryType({})                                 // "string"
 */
export function getJsonSchemaPrimaryType(
  prop: { type?: string | string[] },
): string {
  if (Array.isArray(prop.type)) {
    return prop.type.find((t) => t !== "null") || "string";
  }
  return prop.type || "string";
}

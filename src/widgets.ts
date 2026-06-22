/**
 * MCP Ask 控件白名单与 Builder 目录。
 * 三端 widget 命名与 schemas/schema.json 的单一 TS 真相源。
 */

/** 与 RJSF ui:widget 对齐的 v1 控件类型 */
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

/** 未写 ui:widget 时客户端推断规则（文档用途） */
export const WIDGET_INFERENCE_RULES = [
  { when: "items.enum 存在且 type=array", widget: "checkboxes" },
  { when: "enum 存在", widget: "radio" },
  { when: "type=number 或 type=integer", widget: "number" },
  { when: "type=string 且无 enum", widget: "text" },
  { when: "其他", widget: "text" },
] as const;

export interface WidgetCatalogEntry {
  type: McpAskWidgetType;
  label: string;
  jsonSchema: Record<string, unknown>;
  uiSchema: Record<string, unknown>;
  autoInfer: boolean;
  clientSupport: "supported" | "planned";
}

/** Builder 控件目录：field.type 与 ui:widget 同名 */
export const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  {
    type: "text",
    label: "单行文本",
    jsonSchema: { type: "string", title: "字段名" },
    uiSchema: {},
    autoInfer: true,
    clientSupport: "supported",
  },
  {
    type: "textarea",
    label: "多行文本",
    jsonSchema: { type: "string", title: "备注" },
    uiSchema: { "ui:widget": "textarea" },
    autoInfer: false,
    clientSupport: "supported",
  },
  {
    type: "number",
    label: "数字",
    jsonSchema: { type: "integer", title: "数量", minimum: 0 },
    uiSchema: { "ui:widget": "number" },
    autoInfer: true,
    clientSupport: "supported",
  },
  {
    type: "radio",
    label: "单选",
    jsonSchema: {
      type: "string",
      title: "选项",
      enum: ["a", "b"],
      enumNames: ["选项A", "选项B"],
    },
    uiSchema: { "ui:widget": "radio" },
    autoInfer: true,
    clientSupport: "supported",
  },
  {
    type: "checkboxes",
    label: "多选",
    jsonSchema: {
      type: "array",
      title: "检查项",
      items: { type: "string", enum: ["lint", "test"] },
      uniqueItems: true,
    },
    uiSchema: {
      "ui:widget": "checkboxes",
      "ui:options": { enumNames: ["代码检查", "单元测试"] },
    },
    autoInfer: true,
    clientSupport: "supported",
  },
  {
    type: "select",
    label: "下拉单选",
    jsonSchema: {
      type: "string",
      title: "选项",
      enum: ["a", "b"],
      enumNames: ["选项A", "选项B"],
    },
    uiSchema: { "ui:widget": "select" },
    autoInfer: false,
    clientSupport: "supported",
  },
  {
    type: "list",
    label: "列表单选",
    jsonSchema: {
      type: "string",
      title: "框架",
      enum: ["react", "vue"],
      enumNames: ["React", "Vue"],
    },
    uiSchema: { "ui:widget": "list" },
    autoInfer: false,
    clientSupport: "supported",
  },
  {
    type: "file",
    label: "文件上传",
    jsonSchema: {
      type: "string",
      format: "data-url",
      title: "截图",
    },
    uiSchema: {
      "ui:widget": "file",
      "ui:options": { accept: "image/*", multiple: false },
    },
    autoInfer: false,
    clientSupport: "supported",
  },
  {
    type: "radio-with-custom",
    label: "单选+自定义",
    jsonSchema: {
      type: "string",
      title: "方式",
      enum: ["deploy", "test"],
      enumNames: ["部署", "测试"],
    },
    uiSchema: {
      "ui:widget": "radio-with-custom",
      "ui:options": { allowCustom: true },
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

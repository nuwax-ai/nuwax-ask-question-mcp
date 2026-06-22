import {
  ASK_SCHEMA_VERSION,
  INTERACTION_UI_SCHEMA_VERSION,
  MCP_ASK_TOOL_NAME,
} from "./types.js";
import {
  normalizeBuilderFieldType,
  type DeprecatedBuilderFieldType,
  type McpAskWidgetType,
} from "./widgets.js";

/** Builder 选项定义 */
export interface BuilderFieldOption {
  value: string;
  label: string;
}

/** 文件控件附加配置 */
export interface BuilderFileOptions {
  accept?: string;
  multiple?: boolean;
  maxFileSize?: number;
}

/** Builder 表单字段定义 */
export interface BuilderFormField {
  name: string;
  type: McpAskWidgetType | DeprecatedBuilderFieldType;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: BuilderFieldOption[];
  minimum?: number;
  maximum?: number;
  file?: BuilderFileOptions;
}

/** buildMcpAskRawInput 入参 */
export interface BuildMcpAskRawInputOptions {
  requestId: string;
  revision: number;
  sessionId: string;
  title: string;
  description?: string;
  presentation?: "modal" | "inline" | "wizard" | "table";
  fields: BuilderFormField[];
  submitLabel?: string;
  cancelLabel?: string;
  timeoutMs?: number;
  priority?: "normal" | "high";
  business?: Record<string, unknown>;
}

type JsonSchemaProperty = Record<string, unknown>;
type UiSchemaEntry = Record<string, unknown>;

/**
 * 将单个 Builder 字段转为 JSON Schema property + uiSchema 条目。
 */
export function buildFieldSchemaParts(field: BuilderFormField): {
  property: JsonSchemaProperty;
  uiSchema: UiSchemaEntry;
} {
  const widget = normalizeBuilderFieldType(field.type);
  const property: JsonSchemaProperty = { title: field.label };
  const uiSchema: UiSchemaEntry = {};

  if (field.placeholder) {
    uiSchema["ui:options"] = { placeholder: field.placeholder };
  }

  switch (widget) {
    case "text":
      property.type = "string";
      break;

    case "textarea":
      property.type = "string";
      uiSchema["ui:widget"] = "textarea";
      break;

    case "number": {
      const hasIntegerBounds =
        (field.minimum === undefined || Number.isInteger(field.minimum)) &&
        (field.maximum === undefined || Number.isInteger(field.maximum));
      property.type = hasIntegerBounds ? "integer" : "number";
      if (field.minimum !== undefined) property.minimum = field.minimum;
      if (field.maximum !== undefined) property.maximum = field.maximum;
      uiSchema["ui:widget"] = "number";
      break;
    }

    case "radio":
    case "select":
    case "list":
    case "radio-with-custom": {
      if (!field.options?.length) {
        throw new Error(`Field "${field.name}" (${widget}) requires options`);
      }
      property.type = "string";
      property.enum = field.options.map((o) => o.value);
      property.enumNames = field.options.map((o) => o.label);
      uiSchema["ui:widget"] = widget;
      if (widget === "radio-with-custom") {
        uiSchema["ui:options"] = {
          ...(uiSchema["ui:options"] as object),
          allowCustom: true,
        };
      }
      break;
    }

    case "checkboxes": {
      if (!field.options?.length) {
        throw new Error(`Field "${field.name}" (checkboxes) requires options`);
      }
      property.type = "array";
      property.uniqueItems = true;
      property.items = {
        type: "string",
        enum: field.options.map((o) => o.value),
      };
      uiSchema["ui:widget"] = "checkboxes";
      uiSchema["ui:options"] = {
        ...(uiSchema["ui:options"] as object),
        enumNames: field.options.map((o) => o.label),
      };
      break;
    }

    case "file":
      property.type = "string";
      property.format = "data-url";
      uiSchema["ui:widget"] = "file";
      if (field.file) {
        uiSchema["ui:options"] = {
          ...(uiSchema["ui:options"] as object),
          ...field.file,
        };
      }
      break;

    default: {
      const exhaustive: never = widget;
      throw new Error(`Unhandled widget: ${exhaustive}`);
    }
  }

  return { property, uiSchema };
}

/**
 * 从 Builder 字段列表生成 ACP rawInput（McpAskUserToolInput）。
 */
export function buildMcpAskRawInput(
  options: BuildMcpAskRawInputOptions,
): Record<string, unknown> {
  const properties: Record<string, JsonSchemaProperty> = {};
  const uiSchema: Record<string, UiSchemaEntry> = {};
  const required: string[] = [];

  for (const field of options.fields) {
    const { property, uiSchema: fieldUi } = buildFieldSchemaParts(field);
    properties[field.name] = property;
    if (Object.keys(fieldUi).length > 0) {
      uiSchema[field.name] = fieldUi;
    }
    if (field.required) {
      required.push(field.name);
    }
  }

  return {
    toolName: MCP_ASK_TOOL_NAME,
    schemaVersion: ASK_SCHEMA_VERSION,
    requestId: options.requestId,
    revision: options.revision,
    sessionId: options.sessionId,
    title: options.title,
    ...(options.description ? { description: options.description } : {}),
    ui: {
      version: INTERACTION_UI_SCHEMA_VERSION,
      presentation: options.presentation ?? "inline",
      title: options.title,
      schema: {
        type: "object",
        properties,
        ...(required.length ? { required } : {}),
      },
      ...(Object.keys(uiSchema).length ? { uiSchema } : {}),
      ...(options.submitLabel ? { submitLabel: options.submitLabel } : {}),
      ...(options.cancelLabel ? { cancelLabel: options.cancelLabel } : {}),
    },
    ...(options.business ? { business: options.business } : {}),
    ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
    ...(options.priority ? { priority: options.priority } : {}),
  };
}

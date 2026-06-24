import {
  ASK_SCHEMA_VERSION,
  INTERACTION_UI_SCHEMA_VERSION,
  MCP_ASK_TOOL_NAME,
  type FormField,
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
  initialValue?: unknown;
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
  presentation?: "modal" | "inline" | "wizard";
  fields: BuilderFormField[];
  submitLabel?: string;
  cancelLabel?: string;
  timeoutMs?: number;
  priority?: "normal" | "high";
  business?: Record<string, unknown>;
}

/**
 * 将单个 Builder 字段转为 v2 字段对象（控件/选项/约束/必填合并进同一对象）。
 * v2 起不再拆分 JSON Schema property + uiSchema 条目。
 */
export function buildFormField(field: BuilderFormField): FormField {
  const widget = normalizeBuilderFieldType(field.type);
  const formField: FormField = {
    name: field.name,
    title: field.label,
    widget,
  };

  if (field.required) {
    formField.required = true;
  }
  if (field.placeholder) {
    formField.placeholder = field.placeholder;
  }
  if (field.initialValue !== undefined) {
    formField.initialValue = field.initialValue;
  }
  if (field.options?.length) {
    formField.options = field.options.map((o) => ({ value: o.value, label: o.label }));
  }

  switch (widget) {
    case "text":
    case "textarea":
      // string 类型由 widget 推断，无需显式 type
      break;

    case "number": {
      const hasIntegerBounds =
        (field.minimum === undefined || Number.isInteger(field.minimum)) &&
        (field.maximum === undefined || Number.isInteger(field.maximum));
      formField.type = hasIntegerBounds ? "integer" : "number";
      if (field.minimum !== undefined) formField.minimum = field.minimum;
      if (field.maximum !== undefined) formField.maximum = field.maximum;
      break;
    }

    case "radio":
    case "select":
    case "list":
    case "radio-with-custom": {
      if (!field.options?.length) {
        throw new Error(`Field "${field.name}" (${widget}) requires options`);
      }
      if (widget === "radio-with-custom") {
        formField.allowCustom = true;
      }
      break;
    }

    case "checkboxes": {
      if (!field.options?.length) {
        throw new Error(`Field "${field.name}" (checkboxes) requires options`);
      }
      formField.type = "array";
      break;
    }

    case "file": {
      if (field.file) {
        if (field.file.accept !== undefined) formField.accept = field.file.accept;
        if (field.file.multiple !== undefined) formField.multiple = field.file.multiple;
        if (field.file.maxFileSize !== undefined) {
          formField.maxFileSize = field.file.maxFileSize;
        }
      }
      break;
    }

    default: {
      const exhaustive: never = widget;
      throw new Error(`Unhandled widget: ${exhaustive}`);
    }
  }

  return formField;
}

/**
 * 从 Builder 字段列表生成 ACP rawInput（McpAskUserToolInput）。
 * v2：表单以 ui.fields（有序数组）表达。
 */
export function buildMcpAskRawInput(
  options: BuildMcpAskRawInputOptions,
): Record<string, unknown> {
  const fields = options.fields.map(buildFormField);

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
      fields,
      ...(options.submitLabel ? { submitLabel: options.submitLabel } : {}),
      ...(options.cancelLabel ? { cancelLabel: options.cancelLabel } : {}),
    },
    ...(options.business ? { business: options.business } : {}),
    ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
    ...(options.priority ? { priority: options.priority } : {}),
  };
}

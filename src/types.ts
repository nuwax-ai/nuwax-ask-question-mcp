import { z } from "zod";
import { MCP_ASK_WIDGET_TYPES } from "./widgets.js";

export const ASK_SCHEMA_VERSION = "nuwax.mcp_ask.v2";

/**
 * v2：表单定义从「object + uiSchema」改为「有序字段数组 fields[]」。
 * 数组顺序即显示顺序（无 ui:order），控件/选项/约束合并进单字段对象（无 uiSchema）。
 */
export const INTERACTION_UI_SCHEMA_VERSION = "nuwax.interaction.v2";

/** MCP 主工具名，与 ACP ToolCall.rawInput.toolName 一致。 */
export const MCP_ASK_TOOL_NAME = "nuwax_ask_question" as const;

/**
 * v1 唯一支持的 MCP 传输层。
 * 本包不启动 HTTP/SSE sidecar，也不维护 pending 队列；由 MCP Host 经 stdio 拉起进程。
 */
export const MCP_SERVER_TRANSPORT = "stdio" as const;

/**
 * 工具立即返回的状态值。
 * 工具不维护回调队列；该状态由 MCP Server 直接返回，agent 据此停止当前轮次。
 */
export const ASK_STATUS_PENDING = "pending" as const;

/**
 * 选择类控件的选项。合并旧 JSON Schema 的 enum + enumNames 为单一数组，
 * value 与 label 一一对应；value 进 formData，label 是展示文案。
 *
 * 注：所有字段都用 .describe()，确保 schemas/schema.json（由本文件派生）带描述 + $ref。
 */
export const FormFieldOptionSchema = z
  .object({
    value: z.string().min(1).describe("选项值，进入 formData"),
    label: z.string().min(1).describe("选项展示文案（人类可读）"),
  })
  .strict();

/**
 * 字段名：formData 的 key（全表单内唯一）。
 * 仅用于 FormField.name；wizard steps[].fields 另用内联 z.string().min(1)，
 * 避免 zod-to-json-schema 把 steps 项 $ref 到 ui.fields[].name（对 LLM 不直观）。
 */
export const FieldNameSchema = z
  .string()
  .min(1)
  .describe("字段名（formData 的 key，全表单内唯一；wizard steps.fields 引用此 name）");

/**
 * 单个表单字段（v2 核心结构）。
 * 合并了旧 schema.properties[name]（type/约束/enum/enumNames/title/...）与
 * 旧 uiSchema[name]（控件/选项配置）——一个对象自描述字段的全部信息。
 * widget 必填，消除「省略时推断控件」的歧义。对齐 antd Form.Item。
 */
export const FormFieldSchema = z
  .object({
    name: FieldNameSchema,
    title: z.string().min(1).describe("展示标签（antd Form.Item label）"),
    widget: z
      .enum(MCP_ASK_WIDGET_TYPES)
      .describe("控件类型"),
    description: z.string().optional().describe("字段帮助文案（tooltip/help）"),
    required: z.boolean().optional().describe("是否必填，默认 false"),
    placeholder: z.string().optional().describe("占位提示"),
    initialValue: z
      .unknown()
      .optional()
      .describe("字段初始值（旧 ui.initialValue[name] 下沉到字段）"),
    type: z
      .enum(["string", "integer", "number", "array"])
      .optional()
      .describe("值类型，缺省按 widget 推断：number→number/integer、checkboxes→array、其余→string"),
    minimum: z.number().optional().describe("最小值（widget=number）"),
    maximum: z.number().optional().describe("最大值（widget=number）"),
    exclusiveMinimum: z.number().optional().describe("严格大于（widget=number）"),
    exclusiveMaximum: z.number().optional().describe("严格小于（widget=number）"),
    multipleOf: z.number().optional().describe("倍数约束（widget=number）"),
    minLength: z.number().int().min(0).optional().describe("最小长度（widget=text/textarea）"),
    maxLength: z.number().int().min(0).optional().describe("最大长度（widget=text/textarea）"),
    pattern: z.string().optional().describe("正则约束（widget=text）"),
    options: z
      .array(FormFieldOptionSchema)
      .min(1)
      .optional()
      .describe("选择类控件（radio/select/list/checkboxes/radio-with-custom）的选项数组 [{value,label}]"),
    accept: z.string().optional().describe("MIME 过滤器，如 image/*（widget=file）"),
    multiple: z.boolean().optional().describe("是否允许多文件（widget=file）"),
    maxFileSize: z.number().int().positive().optional().describe("单文件最大字节数（widget=file）"),
    allowCustom: z
      .boolean()
      .optional()
      .describe("是否允许自定义选项（widget=radio-with-custom）"),
    otherValue: z
      .string()
      .optional()
      .describe("自定义选项的值，默认 __custom__（widget=radio-with-custom）"),
    otherField: z
      .string()
      .optional()
      .describe("自定义输入框字段名，默认 {name}Custom（widget=radio-with-custom）"),
  })
  .strict();

/**
 * 交互 UI 定义（v2）。表单以有序 fields[] 表达；数组顺序即渲染顺序。
 * 不再存在 schema/uiSchema/ui:order。inline/modal/wizard 必填 fields。
 */
export const InteractionUiSchema = z
  .object({
    version: z
      .literal(INTERACTION_UI_SCHEMA_VERSION)
      .describe(`UI 契约版本（${INTERACTION_UI_SCHEMA_VERSION}）`),
    presentation: z
      .enum(["modal", "inline", "wizard"])
      .describe("展示方式：inline（行内，最常用）/ modal（弹窗）/ wizard（分步）"),
    title: z.string().min(1).describe("卡片内表单标题"),
    description: z.string().optional().describe("卡片内表单说明"),
    fields: z
      .array(FormFieldSchema)
      .optional()
      .describe("表单字段（有序数组）；数组顺序即展示顺序。inline/modal/wizard 必填"),
    steps: z
      .array(
        z
          .object({
            id: z.string().min(1).describe("步骤唯一标识"),
            title: z.string().min(1).describe("步骤标题"),
            description: z.string().optional().describe("步骤说明"),
            fields: z
              .array(
                z
                  .string()
                  .min(1)
                  .describe("引用 ui.fields 中某字段的 name"),
              )
              .min(1)
              .describe("本步展示的字段 name 数组，引用 ui.fields 中字段的 name"),
          })
          .describe("wizard 的单个步骤"),
      )
      .optional()
      .describe("wizard 分步配置；仅 presentation=wizard 时使用"),
    submitLabel: z.string().optional().describe("提交按钮文案"),
    cancelLabel: z.string().optional().describe("取消按钮文案"),
    fallback: z
      .object({
        text: z.string().describe("降级文案"),
        webUrl: z.string().url().optional().describe("Web 降级链接"),
        mobileUrl: z.string().url().optional().describe("Mobile 降级链接"),
      })
      .optional()
      .describe("客户端无法渲染卡片时的降级方案"),
  })
  .passthrough();

export const McpAskUserToolInputSchema = z
  .object({
    toolName: z.literal(MCP_ASK_TOOL_NAME).describe("MCP 工具名，与 ACP tool_call.rawInput.toolName 一致"),
    schemaVersion: z.literal(ASK_SCHEMA_VERSION).describe(`MCP 契约版本（${ASK_SCHEMA_VERSION}）`),
    requestId: z.string().min(1).describe("请求唯一标识；用户响应中原样回传，用于关联问答"),
    revision: z.number().int().positive().describe("提问修订号，从 1 开始；后续修订递增"),
    sessionId: z.string().min(1).describe("会话 ID"),
    title: z.string().min(1).describe("本次提问标题，显示在卡片顶部"),
    description: z.string().optional().describe("本次提问补充说明"),
    ui: InteractionUiSchema.describe("交互 UI 定义（表单字段 + 展示/降级配置）"),
    business: z.record(z.unknown()).optional().describe("业务透传数据，原样存入 rawInput，不影响渲染"),
    timeoutMs: z.number().int().positive().optional().describe("超时毫秒数；超时后动作记为 timeout"),
    priority: z.enum(["normal", "high"]).optional().describe("优先级：normal（默认）/ high（高优先级，可能强提醒）"),
  })
  .strict();

export type FormFieldOption = z.infer<typeof FormFieldOptionSchema>;
export type FormField = z.infer<typeof FormFieldSchema>;
export type InteractionUiSchema = z.infer<typeof InteractionUiSchema>;
export type McpAskUserToolInput = z.infer<typeof McpAskUserToolInputSchema>;

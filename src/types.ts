import { z } from "zod";

export const ASK_SCHEMA_VERSION = "nuwax.mcp_ask.v1";
export const INTERACTION_UI_SCHEMA_VERSION = "nuwax.interaction.v1";

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

export const InteractionUiSchema = z
  .object({
    version: z.literal(INTERACTION_UI_SCHEMA_VERSION),
    presentation: z.enum(["modal", "inline", "wizard", "table"]),
    title: z.string().min(1),
    description: z.string().optional(),
    schema: z.record(z.unknown()),
    uiSchema: z.record(z.unknown()).optional(),
    table: z.record(z.unknown()).optional(),
    initialValue: z.record(z.unknown()).optional(),
    steps: z
      .array(
        z.object({
          id: z.string().min(1),
          title: z.string().min(1),
          description: z.string().optional(),
          fields: z.array(z.string()),
        }),
      )
      .optional(),
    submitLabel: z.string().optional(),
    cancelLabel: z.string().optional(),
    fallback: z
      .object({
        text: z.string(),
        webUrl: z.string().url().optional(),
        mobileUrl: z.string().url().optional(),
      })
      .optional(),
  })
  .passthrough();

export const McpAskUserToolInputSchema = z
  .object({
    toolName: z.literal(MCP_ASK_TOOL_NAME),
    schemaVersion: z.literal(ASK_SCHEMA_VERSION),
    requestId: z.string().min(1),
    revision: z.number().int().positive(),
    sessionId: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    ui: InteractionUiSchema,
    business: z.record(z.unknown()).optional(),
    timeoutMs: z.number().int().positive().optional(),
    priority: z.enum(["normal", "high"]).optional(),
  })
  .strict();

export type InteractionUiSchema = z.infer<typeof InteractionUiSchema>;
export type McpAskUserToolInput = z.infer<typeof McpAskUserToolInputSchema>;

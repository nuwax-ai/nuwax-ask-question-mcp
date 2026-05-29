import { z } from "zod";

export const ASK_SCHEMA_VERSION = "nuwaclaw.mcp_ask.v1";
export const INTERACTION_UI_SCHEMA_VERSION = "nuwaclaw.interaction.v1";

/** Forward-compatible aliases accepted during the Nuwax/NuwaClaw naming transition. */
export const ASK_SCHEMA_VERSION_ALIASES = ["nuwax.mcp_ask.v1"] as const;
export const INTERACTION_UI_SCHEMA_VERSION_ALIASES = [
  "nuwax.interaction.v1",
] as const;

export const ACCEPTED_ASK_SCHEMA_VERSIONS = [
  ASK_SCHEMA_VERSION,
  ...ASK_SCHEMA_VERSION_ALIASES,
] as const;
export const ACCEPTED_INTERACTION_UI_SCHEMA_VERSIONS = [
  INTERACTION_UI_SCHEMA_VERSION,
  ...INTERACTION_UI_SCHEMA_VERSION_ALIASES,
] as const;

/** MCP 主工具名，与 ACP ToolCall.rawInput.toolName 一致。 */
export const MCP_ASK_TOOL_NAME = "nuwax_ask_question" as const;

/** 历史 rawInput.toolName，解析时仍接受以便旧客户端过渡。 */
export const LEGACY_MCP_ASK_TOOL_NAMES = [
  "nuwax_ask_user",
  "nuwaclaw_ask_user",
] as const;

export const InteractionUiSchema = z
  .object({
    version: z.enum(ACCEPTED_INTERACTION_UI_SCHEMA_VERSIONS),
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
    toolName: z.enum([MCP_ASK_TOOL_NAME, ...LEGACY_MCP_ASK_TOOL_NAMES]),
    schemaVersion: z.enum(ACCEPTED_ASK_SCHEMA_VERSIONS),
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

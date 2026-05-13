import { z } from "zod";

export const ASK_SCHEMA_VERSION = "nuwaclaw.mcp_ask.v1";
export const INTERACTION_UI_SCHEMA_VERSION = "nuwaclaw.interaction.v1";

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
    toolName: z.enum(["nuwaclaw_ask_user", "nuwax_ask_user"]),
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

export const McpAskUserToolResultSchema = z
  .object({
    status: z.enum(["answered", "cancelled", "skipped", "expired"]),
    formData: z.record(z.unknown()).optional(),
    answeredBy: z
      .object({
        kind: z.enum(["web", "mobile"]),
        userId: z.string().optional(),
        clientId: z.string().optional(),
      })
      .optional(),
    answeredAt: z.number().int().optional(),
  })
  .strict();

export const McpAskRespondRequestSchema = z
  .object({
    interventionId: z.string().min(1),
    toolCallId: z.string().min(1).optional(),
    revision: z.number().int().positive(),
    source: z.literal("mcp_ask"),
    protocol: z.literal("mcp"),
    action: z.enum(["submit", "cancel", "skip", "timeout"]),
    formData: z.record(z.unknown()).optional(),
    answeredBy: z
      .object({
        kind: z.enum(["web", "mobile"]),
        userId: z.string().optional(),
        clientId: z.string().optional(),
      })
      .optional(),
    answeredAt: z.number().int().optional(),
  })
  .strict();

export type InteractionUiSchema = z.infer<typeof InteractionUiSchema>;
export type McpAskUserToolInput = z.infer<typeof McpAskUserToolInputSchema>;
export type McpAskUserToolResult = z.infer<typeof McpAskUserToolResultSchema>;
export type McpAskRespondRequest = z.infer<typeof McpAskRespondRequestSchema>;

export type PendingStatus =
  | "pending"
  | "answered"
  | "cancelled"
  | "skipped"
  | "expired";

export interface PendingMcpAsk {
  interventionId: string;
  toolCallId?: string;
  revision: number;
  sessionId: string;
  ui: InteractionUiSchema;
  status: PendingStatus;
  result?: McpAskUserToolResult;
  resolve: (result: McpAskUserToolResult) => void;
  timer?: NodeJS.Timeout;
  createdAt: number;
}

export type RespondHostStatus =
  | "resolved"
  | "already_resolved"
  | "superseded"
  | "gone";

export interface RespondResult {
  ok: boolean;
  hostStatus?: RespondHostStatus;
  result?: McpAskUserToolResult;
  error?: {
    code:
      | "bad_request"
      | "unauthorized"
      | "not_found"
      | "revision_mismatch"
      | "already_resolved_conflict"
      | "internal_error";
    message: string;
  };
}

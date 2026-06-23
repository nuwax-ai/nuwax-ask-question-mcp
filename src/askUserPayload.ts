import { z } from "zod";
import {
  ASK_SCHEMA_VERSION,
  INTERACTION_UI_SCHEMA_VERSION,
  MCP_ASK_TOOL_NAME,
  McpAskUserToolInputSchema,
  type McpAskUserToolInput,
} from "./types.js";

/**
 * ask 工具业务入参（不含 toolName）。
 * MCP 注册名为 nuwax_ask_question；写入 ACP rawInput 时固定 toolName。
 *
 * 版本字段（schemaVersion / ui.version）对 agent 不友好：要求 LLM 逐字复现
 * "nuwax.mcp_ask.v1" / "nuwax.interaction.v1" 这类魔法字符串，agent 常漏写或写错，
 * 导致 z.literal 直接报 invalid_literal、整次调用失败。
 * 这里给两个字段加 .default()：缺失时由 SDK 按协议常量补齐（safeParse 会应用默认值），
 * 仍保留 literal 校验拒绝错误值。不要改回严格必填——会让 agent 无法正常调用。
 * 仅放宽面向 agent 的这一层；types.ts 的 McpAskUserToolInputSchema 与 schemas/schema.json
 * 仍保持严格，后端/DockPanel 经 normalizeMcpAskUserToolInput / buildRawInput 盖戳 version，契约不变。
 */
export const askUserPayloadShape = {
  schemaVersion: z.literal(ASK_SCHEMA_VERSION).default(ASK_SCHEMA_VERSION),
  requestId: z.string().min(1),
  revision: z.number().int().positive(),
  sessionId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  ui: z
    .object({
      version: z.literal(INTERACTION_UI_SCHEMA_VERSION).default(
        INTERACTION_UI_SCHEMA_VERSION,
      ),
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
    .passthrough(),
  business: z.record(z.unknown()).optional(),
  timeoutMs: z.number().int().positive().optional(),
  priority: z.enum(["normal", "high"]).optional(),
};

const agentPayloadSchema = z.object(askUserPayloadShape);

/**
 * 将 agent 可能漏写 version 字段的入参规范化为 DockPanel 可消费的 McpAskUserToolInput。
 * 平台在透传 SSE `result.input` 前应调用此函数，避免前端 parseMcpAskToolInput 因缺 schemaVersion 失败。
 */
export function normalizeMcpAskUserToolInput(raw: unknown): McpAskUserToolInput {
  const parsed = agentPayloadSchema.parse(raw);
  return McpAskUserToolInputSchema.parse({
    ...parsed,
    toolName: MCP_ASK_TOOL_NAME,
  });
}

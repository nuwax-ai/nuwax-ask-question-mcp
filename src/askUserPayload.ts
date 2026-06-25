import { z } from "zod";
import {
  ASK_SCHEMA_VERSION,
  INTERACTION_UI_SCHEMA_VERSION,
  MCP_ASK_TOOL_NAME,
  McpAskUserToolInputSchema,
  InteractionUiSchemaBase,
  refineWizardStepFieldRefs,
  type McpAskUserToolInput,
} from "./types.js";

/**
 * ask 工具业务入参（不含 toolName）——面向 agent 的友好层。
 *
 * 【单一真相源，避免与 types.ts 重复】这里不再重声明字段结构与描述，而是直接【复用】
 * types.ts 的 McpAskUserToolInputSchema / InteractionUiSchema（结构与 .describe() 全部来自那里），
 * 仅对 version 字段叠加 .default() + 「请勿输出」标注：
 *
 * - version 字段（schemaVersion / ui.version）要求 LLM 逐字复现魔法字符串，agent 常漏写或写错，
 *   导致 z.literal 报 invalid_literal、整次调用失败。给它们 .default()：缺失时由 SDK 按协议
 *   常量补齐（safeParse 会应用默认值），仍保留 literal 校验拒绝错误值。revision 默认 1。
 *
 * 仅放宽面向 agent 的这一层；types.ts 的 McpAskUserToolInputSchema 与 schemas/schema.json 保持严格，
 * 后端/DockPanel 经 normalizeMcpAskUserToolInput / buildRawInput 盖戳 version，契约不变。
 */

/** agent-facing ui：复用 InteractionUiSchemaBase 结构与描述，仅 version 加 default + 「请勿输出」 */
const agentInteractionUiSchema = InteractionUiSchemaBase.extend({
  version: z
    .literal(INTERACTION_UI_SCHEMA_VERSION)
    .default(INTERACTION_UI_SCHEMA_VERSION)
    .describe(
      `【请勿输出本字段】UI 契约版本，由服务端自动盖戳为 ${INTERACTION_UI_SCHEMA_VERSION}。省略即可。`,
    ),
})
  .passthrough()
  .superRefine(refineWizardStepFieldRefs);

/**
 * agent-facing 入参：复用 McpAskUserToolInputSchema 结构与描述（去 toolName），仅 version 字段加 default。
 * 注意：不要在此加顶层 .passthrough()——askUserPayloadShape 取的是 .shape（字段 Record），
 * SDK 与 normalize 都会以 z.object(shape) 重新编译为 strip 模式，passthrough 无法传递，属死代码。
 */
const agentInputSchema = McpAskUserToolInputSchema.omit({ toolName: true }).extend({
  schemaVersion: z
    .literal(ASK_SCHEMA_VERSION)
    .default(ASK_SCHEMA_VERSION)
    .describe(
      `【请勿输出本字段】MCP 契约版本，由服务端自动盖戳为 ${ASK_SCHEMA_VERSION}。省略即可。`,
    ),
  revision: z
    .number()
    .int()
    .positive()
    .default(1)
    .describe("提问修订号，从 1 开始；后续修订递增。新提问省略即可（默认 1）。"),
  ui: agentInteractionUiSchema,
});

/** 注册工具用的 raw shape（MCP SDK 以 z.object(shape) 编译为 inputSchema） */
export const askUserPayloadShape = agentInputSchema.shape;

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

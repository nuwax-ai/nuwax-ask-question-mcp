#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createRequire } from "node:module";
import {
  ACCEPTED_ASK_SCHEMA_VERSIONS,
  ACCEPTED_INTERACTION_UI_SCHEMA_VERSIONS,
  ASK_SCHEMA_VERSION,
  INTERACTION_UI_SCHEMA_VERSION,
  MCP_ASK_TOOL_NAME,
  McpAskUserToolInputSchema,
  type McpAskUserToolInput,
} from "./types.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

/**
 * ask 工具业务入参（不含 toolName）。
 * MCP 注册名为 nuwax_ask_question；写入 ACP rawInput 时固定 toolName。
 */
const askUserPayloadShape = {
  schemaVersion: z.enum(ACCEPTED_ASK_SCHEMA_VERSIONS).describe(
    `Canonical value is ${ASK_SCHEMA_VERSION}; aliases are accepted for migration.`,
  ),
  requestId: z.string().min(1),
  revision: z.number().int().positive(),
  sessionId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  ui: z
    .object({
      version: z.enum(ACCEPTED_INTERACTION_UI_SCHEMA_VERSIONS).describe(
        `Canonical value is ${INTERACTION_UI_SCHEMA_VERSION}; aliases are accepted for migration.`,
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

const server = new McpServer(
  {
    name: "nuwax-ask-question-mcp",
    version,
  },
  {
    instructions:
      "Use nuwax_ask_question when you need the human user to answer an interactive question. The UI schema is carried in the tool input so ACP clients can render it from tool_call rawInput.",
  },
);

export async function handleAsk(input: McpAskUserToolInput): Promise<CallToolResult> {
  const parsed = McpAskUserToolInputSchema.parse(input);
  const result = {
    status: "pending" as const,
    requestId: parsed.requestId,
    revision: parsed.revision,
    message:
      "The question has been presented to the user. Stop this turn now. When the user submits the form, their answer will arrive as a new user message.",
  };
  return {
    content: [
      {
        type: "text",
        text: result.message,
      },
    ],
    structuredContent: result,
  };
}

server.registerTool(
  MCP_ASK_TOOL_NAME,
  {
    title: "Ask Nuwax User (Question)",
    description:
      "Ask the user an interactive question. Provide a nuwaclaw.interaction.v1 UI schema in ui. Codex exposes this as mcp__ask_question__nuwax_ask_question when the MCP server key is ask-question.",
    inputSchema: askUserPayloadShape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async (input): Promise<CallToolResult> =>
    handleAsk({
      ...input,
      toolName: MCP_ASK_TOOL_NAME,
    } as McpAskUserToolInput),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

process.on("SIGINT", () => {
  process.exit(130);
});

process.on("SIGTERM", () => {
  process.exit(143);
});

main().catch((error) => {
  console.error("Fatal error in nuwax-ask-question-mcp:", error);
  process.exit(1);
});

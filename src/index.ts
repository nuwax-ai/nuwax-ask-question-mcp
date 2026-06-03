#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createRequire } from "node:module";
import {
  ASK_SCHEMA_VERSION,
  ASK_STATUS_PENDING,
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
  schemaVersion: z.literal(ASK_SCHEMA_VERSION),
  requestId: z.string().min(1),
  revision: z.number().int().positive(),
  sessionId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  ui: z
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
    instructions: [
      `You have access to ${MCP_ASK_TOOL_NAME} — a tool that presents an interactive form to the user and pauses until they respond.`,
      "",
      "Guidelines:",
      "- When you are missing required information to complete a task, call this tool instead of making assumptions.",
      "- When a task involves a choice the user should make (e.g. which option, what style, which approach), call this tool with the options.",
      "- After calling this tool, STOP generating. The user's response will arrive as a new message in the next turn.",
      "- Design the form schema to be clear and concise. Use enum for choices, use title for field labels.",
      "- Never invent user preferences — always ask when uncertain.",
      "",
      "This tool is your primary way to interact with the user for information gathering. Prefer it over guessing.",
    ].join("\n"),
  },
);

export async function handleAsk(input: McpAskUserToolInput): Promise<CallToolResult> {
  const parsed = McpAskUserToolInputSchema.parse(input);
  const result = {
    status: ASK_STATUS_PENDING,
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

/**
 * MCP 工具描述。模板化后跟随 constants 漂移，避免与 types.ts 中
 * MCP_ASK_TOOL_NAME / INTERACTION_UI_SCHEMA_VERSION / ASK_STATUS_PENDING 失同步。
 */
export const ASK_TOOL_DESCRIPTION = [
  `Present an interactive form card to the user and wait for their response. Use ${MCP_ASK_TOOL_NAME} whenever:`,
  "",
  "1. You need non-sensitive information from the user to continue (missing parameters, preferences, requirements).",
  "2. The task has multiple valid approaches and you want the user to pick one.",
  "3. You need the user to confirm, approve, or make a decision before proceeding.",
  "4. You want to collect structured data (names, selections, file uploads, etc.).",
  "5. You are unsure about the user's intent and need clarification.",
  "",
  "DO NOT guess or assume missing information — call this tool instead.",
  "DO NOT ask for secrets such as passwords, API keys, or private tokens through this tool.",
  "",
  `Provide a ${INTERACTION_UI_SCHEMA_VERSION} UI schema in the ui field. Returns status "${ASK_STATUS_PENDING}" immediately; the user's answer arrives as a subsequent chat message.`,
  "",
  `Minimal example: {"schemaVersion":"${ASK_SCHEMA_VERSION}","requestId":"ask_1","revision":1,"sessionId":"sess_1","title":"Choose","ui":{"version":"${INTERACTION_UI_SCHEMA_VERSION}","presentation":"inline","title":"Pick one","schema":{"type":"object","properties":{"choice":{"type":"string","enum":["a","b"]}},"required":["choice"]}}}`,
].join("\n");

server.registerTool(
  MCP_ASK_TOOL_NAME,
  {
    title: "Ask User a Question",
    description: ASK_TOOL_DESCRIPTION,
    inputSchema: askUserPayloadShape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
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

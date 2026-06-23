#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from "node:module";
import {
  askUserPayloadShape,
  normalizeMcpAskUserToolInput,
} from "./askUserPayload.js";
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

export { askUserPayloadShape, normalizeMcpAskUserToolInput } from "./askUserPayload.js";

const server = new McpServer(
  {
    name: "nuwax-ask-question-mcp",
    version,
  },
  {
    instructions: [
      `You have access to ${MCP_ASK_TOOL_NAME} — a tool that presents an interactive form to the user and pauses until they respond.`,
      "",
      "When to call (ALWAYS prefer this over guessing or asking in plain text):",
      "- Missing required information: parameters, preferences, requirements, configuration, settings",
      "- Task has multiple valid approaches, options, or paths and user should choose",
      "- User needs to confirm, approve, verify, validate, or make a decision",
      "- Collecting structured data: names, emails, addresses, selections, files, uploads",
      "- Uncertain about user intent, unclear requirements, need clarification",
      "- Before starting work that could go in different directions",
      "- When user says 'ask me', 'let me choose', 'I want to pick', 'give me options'",
      "- When default values or assumptions could be wrong",
      "",
      "After calling: STOP generating. The user's response will arrive as a new message in the next turn.",
      "",
      "Schema design rules:",
      "- Use clear, concise field titles that explain what's being asked",
      "- For choices: use enum + enumNames (or uiSchema enumLabels) to provide human-readable labels",
      "- NEVER show bare enum values without descriptions (e.g., use 'Yes, I agree' not just 'yes')",
      "- Mark required fields explicitly in the schema",
      "",
      "This is your primary way to interact with the user for information gathering. Prefer it over guessing.",
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
    /** 完整规范化 rawInput；平台应优先用此字段驱动 DockPanel，而非 agent 原始 tool 参数 */
    input: parsed,
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
  `Present an interactive form card to the user and wait for their response. Use ${MCP_ASK_TOOL_NAME} when you need user input, preferences, decisions, choices, confirmations, or structured data.`,
  "",
  "ALWAYS use this tool instead of guessing, assuming, or asking in plain text.",
  "DO NOT ask for secrets (passwords, API keys, tokens).",
  "",
  `Provide a ${INTERACTION_UI_SCHEMA_VERSION} UI schema in the ui field. Returns status "${ASK_STATUS_PENDING}" immediately; the user's answer arrives as a subsequent chat message.`,
  "",
  "Schema rules: Use enum + enumNames for choices. NEVER show bare values without labels.",
  "",
  `Example: {"schemaVersion":"${ASK_SCHEMA_VERSION}","requestId":"ask_1","revision":1,"sessionId":"sess_1","title":"Choose","ui":{"version":"${INTERACTION_UI_SCHEMA_VERSION}","presentation":"inline","title":"Pick one","schema":{"type":"object","properties":{"choice":{"type":"string","enum":["agree","decline"],"enumNames":["Yes, I agree","No, I decline"]}},"required":["choice"]}}}`,
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
  async (rawInput): Promise<CallToolResult> =>
    handleAsk(normalizeMcpAskUserToolInput(rawInput)),
);

async function main() {
  // v1 仅支持 stdio：由 Cursor / Claude Desktop / nuwaclaw 等 Host 以子进程方式拉起
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

#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from "node:module";
import {
  buildAgentFormRenderingGuideDocument,
  buildAskToolDescription,
  buildMcpServerInstructions,
  FORM_RENDERING_GUIDE_URI,
} from "./agentFormGuide.js";
import {
  askUserPayloadShape,
  normalizeMcpAskUserToolInput,
} from "./askUserPayload.js";
import { buildMcpToolInputJsonSchema } from "./mcpToolInputJsonSchema.js";
import { attachRichToolListInputSchema } from "./patchToolListInputSchema.js";
import {
  ASK_STATUS_PENDING,
  MCP_ASK_TOOL_NAME,
  McpAskUserToolInputSchema,
  type McpAskUserToolInput,
} from "./types.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

export {
  buildAgentFormRenderingGuideDocument,
  buildAskToolDescription,
  buildMcpServerInstructions,
  FORM_RENDERING_GUIDE_URI,
} from "./agentFormGuide.js";
export { askUserPayloadShape, normalizeMcpAskUserToolInput } from "./askUserPayload.js";
export {
  buildMcpToolInputJsonSchema,
  MCP_TOOL_INPUT_SCHEMA_DEFS,
  resolveMcpToolInputSchemaRef,
} from "./mcpToolInputJsonSchema.js";
export { attachRichToolListInputSchema } from "./patchToolListInputSchema.js";

const server = new McpServer(
  {
    name: "nuwax-ask-question-mcp",
    version,
  },
  {
    instructions: buildMcpServerInstructions(),
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

/** MCP 工具描述（与 widgets.ts 控件目录同步，供 Agent 学习表单渲染格式） */
export const ASK_TOOL_DESCRIPTION = buildAskToolDescription();

server.registerResource(
  "form-rendering-guide",
  FORM_RENDERING_GUIDE_URI,
  {
    title: "Nuwax Form Rendering Guide",
    description:
      "Supported form widgets, ui.schema / ui.uiSchema format, inference rules, and copy-paste examples for nuwax_ask_question.",
    mimeType: "application/json",
  },
  async () => ({
    contents: [
      {
        uri: FORM_RENDERING_GUIDE_URI,
        mimeType: "application/json",
        text: JSON.stringify(buildAgentFormRenderingGuideDocument(), null, 2),
      },
    ],
  }),
);

server.registerTool(
  MCP_ASK_TOOL_NAME,
  {
    title: "Ask User a Question",
    description: ASK_TOOL_DESCRIPTION,
    // call 校验：宽松 Zod + version default（agent 友好）
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

// list 展示：富 JSON Schema（结构 + examples + x-nuwax 控件目录）
attachRichToolListInputSchema(server, {
  [MCP_ASK_TOOL_NAME]: buildMcpToolInputJsonSchema(),
});

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

#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { startHttpServer } from "./httpServer.js";
import { PendingAskStore } from "./pendingStore.js";
import {
  ASK_SCHEMA_VERSION,
  INTERACTION_UI_SCHEMA_VERSION,
  McpAskUserToolInputSchema,
  type McpAskUserToolInput,
} from "./types.js";

const DEFAULT_PORT = 63334;

const rawInputShape = {
  toolName: z.enum(["nuwaclaw_ask_user", "nuwax_ask_user"]),
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

const store = new PendingAskStore();
const server = new McpServer(
  {
    name: "nuwax-ask-question-mcp",
    version: "0.1.0",
  },
  {
    instructions:
      "Use nuwax_ask_user when you need the human user to answer an interactive question. The UI schema is carried in the tool input so ACP clients can render it from tool_call rawInput.",
  },
);

async function handleAsk(input: McpAskUserToolInput): Promise<CallToolResult> {
  const parsed = McpAskUserToolInputSchema.parse(input);
  const result = await store.waitForAnswer(parsed);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result),
      },
    ],
    structuredContent: result,
  };
}

server.registerTool(
  "nuwax_ask_user",
  {
    title: "Ask Nuwax User",
    description:
      "Ask the user an interactive question. The caller must provide a nuwaclaw.interaction.v1 UI schema in rawInput.ui.",
    inputSchema: rawInputShape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async (input): Promise<CallToolResult> =>
    handleAsk({
      ...input,
      toolName: "nuwax_ask_user",
    } as McpAskUserToolInput),
);

server.registerTool(
  "nuwaclaw_ask_user",
  {
    title: "Ask Nuwaclaw User",
    description:
      "Compatibility alias for nuwax_ask_user. Use the same input and response contract.",
    inputSchema: rawInputShape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async (input): Promise<CallToolResult> =>
    handleAsk({
      ...input,
      toolName: "nuwaclaw_ask_user",
    } as McpAskUserToolInput),
);

async function main() {
  const port = Number(process.env.NUWAX_ASK_MCP_PORT ?? DEFAULT_PORT);
  const secret = process.env.NUWAX_ASK_MCP_SECRET;
  await startHttpServer({ store, port, secret });
  console.error(
    `nuwax-ask-question-mcp respond server listening on http://127.0.0.1:${port}`,
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

process.on("SIGINT", () => {
  store.cancelAll();
  process.exit(130);
});

process.on("SIGTERM", () => {
  store.cancelAll();
  process.exit(143);
});

main().catch((error) => {
  console.error("Fatal error in nuwax-ask-question-mcp:", error);
  process.exit(1);
});

#!/usr/bin/env npx tsx
/**
 * 本地验收：模拟 MCP Client，检查 Agent 可见面是否满足「表单渲染格式可学习」要求。
 *
 * 用法：npm run inspect:agent-surfaces
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  buildAskToolDescription,
  buildMcpServerInstructions,
  FORM_RENDERING_GUIDE_URI,
} from "../src/agentFormGuide.js";
import { askUserPayloadShape, normalizeMcpAskUserToolInput } from "../src/askUserPayload.js";
import { buildMcpToolInputJsonSchema } from "../src/mcpToolInputJsonSchema.js";
import { attachRichToolListInputSchema } from "../src/patchToolListInputSchema.js";
import {
  ASK_STATUS_PENDING,
  MCP_ASK_TOOL_NAME,
  McpAskUserToolInputSchema,
} from "../src/types.js";
import { MCP_ASK_WIDGET_TYPES } from "../src/widgets.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outDir = join(scriptDir, "../.inspect-output");

type Check = { id: string; ok: boolean; detail: string };

function check(id: string, ok: boolean, detail: string): Check {
  return { id, ok, detail };
}

async function createTestServer(): Promise<McpServer> {
  const server = new McpServer(
    { name: "nuwax-ask-question-mcp", version: "inspect" },
    { instructions: buildMcpServerInstructions() },
  );

  const { buildAgentFormRenderingGuideDocument } = await import(
    "../src/agentFormGuide.js"
  );

  server.registerResource(
    "form-rendering-guide",
    FORM_RENDERING_GUIDE_URI,
    {
      title: "Nuwax Form Rendering Guide",
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
      description: buildAskToolDescription(),
      inputSchema: askUserPayloadShape,
    },
    async (raw) => {
      const parsed = McpAskUserToolInputSchema.parse(
        normalizeMcpAskUserToolInput(raw),
      );
      return {
        content: [
          {
            type: "text" as const,
            text: "Question presented. Stop this turn.",
          },
        ],
        structuredContent: {
          status: ASK_STATUS_PENDING,
          requestId: parsed.requestId,
          revision: parsed.revision,
        },
      };
    },
  );

  attachRichToolListInputSchema(server, {
    [MCP_ASK_TOOL_NAME]: buildMcpToolInputJsonSchema(),
  });

  return server;
}

async function main() {
  const server = await createTestServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "inspect-client", version: "1" });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const checks: Check[] = [];
  const { tools } = await client.listTools();
  const askTool = tools.find((t) => t.name === MCP_ASK_TOOL_NAME);
  const listSchema = askTool?.inputSchema as Record<string, unknown> | undefined;
  const zodListSchema = zodToJsonSchema(z.object(askUserPayloadShape), {
    $refStrategy: "none",
  });

  // --- list vs call 双轨 ---
  checks.push(
    check(
      "list-has-tool",
      !!askTool,
      askTool ? `found ${MCP_ASK_TOOL_NAME}` : "tool missing",
    ),
  );

  const listJson = JSON.stringify(listSchema ?? {});
  const zodJson = JSON.stringify(zodListSchema);
  checks.push(
    check(
      "list-richer-than-zod",
      listJson.length > zodJson.length * 1.5,
      `list=${listJson.length}B vs zod-only=${zodJson.length}B`,
    ),
  );

  const defs = (listSchema?.$defs ?? listSchema?.definitions) as
    | Record<string, unknown>
    | undefined;
  checks.push(
    check(
      "list-has-defs",
      !!defs && Object.keys(defs).length >= 10,
      `defs keys: ${defs ? Object.keys(defs).length : 0} (${listSchema?.$defs ? "$defs" : "definitions"})`,
    ),
  );

  const schemaRef = JSON.stringify(
    (listSchema?.properties as { ui?: { properties?: { schema?: unknown } } })?.ui
      ?.properties?.schema ?? {},
  );
  checks.push(
    check(
      "list-ui-schema-is-ref",
      schemaRef.includes("$ref") &&
        (schemaRef.includes("FormObjectSchema") || schemaRef.includes("FormObject")),
      `ui.schema = ${schemaRef}`,
    ),
  );

  checks.push(
    check(
      "list-has-examples",
      Array.isArray(listSchema?.examples) && (listSchema!.examples as unknown[]).length >= 2,
      `examples count: ${Array.isArray(listSchema?.examples) ? (listSchema!.examples as unknown[]).length : 0}`,
    ),
  );

  const xNuwax = listSchema?.["x-nuwax"] as Record<string, unknown> | undefined;
  checks.push(
    check(
      "list-has-x-nuwax-guide-uri",
      xNuwax?.formRenderingGuideUri === FORM_RENDERING_GUIDE_URI,
      String(xNuwax?.formRenderingGuideUri ?? "missing"),
    ),
  );

  checks.push(
    check(
      "list-widgets-match-catalog",
      JSON.stringify(xNuwax?.supportedWidgets) === JSON.stringify([...MCP_ASK_WIDGET_TYPES]),
      `widgets: ${(xNuwax?.supportedWidgets as string[] | undefined)?.join(", ") ?? "none"}`,
    ),
  );

  // --- description & instructions ---
  const desc = askTool?.description ?? "";
  checks.push(
    check("desc-ui-schema", desc.includes("ui.schema"), "description mentions ui.schema"),
  );
  checks.push(
    check("desc-enumNames", desc.includes("enumNames"), "description mentions enumNames"),
  );

  const instructions = client.getInstructions() ?? "";
  checks.push(
    check(
      "instructions-widgets",
      MCP_ASK_WIDGET_TYPES.every((w) => instructions.includes(w)),
      `instructions length=${instructions.length}`,
    ),
  );

  // --- resource ---
  const { resources } = await client.listResources();
  checks.push(
    check(
      "resource-listed",
      resources.some((r) => r.uri === FORM_RENDERING_GUIDE_URI),
      resources.map((r) => r.uri).join(", ") || "none",
    ),
  );

  const resource = await client.readResource({ uri: FORM_RENDERING_GUIDE_URI });
  const guideText = resource.contents[0]?.text ?? "";
  const guide = JSON.parse(guideText) as Record<string, unknown>;
  checks.push(
    check(
      "resource-widget-catalog",
      Array.isArray(guide.widgetCatalog) &&
        (guide.widgetCatalog as unknown[]).length === MCP_ASK_WIDGET_TYPES.length,
      `widgetCatalog: ${(guide.widgetCatalog as unknown[] | undefined)?.length ?? 0}`,
    ),
  );
  checks.push(
    check(
      "resource-examples",
      Array.isArray(guide.examples) && (guide.examples as unknown[]).length >= 3,
      `examples: ${(guide.examples as unknown[] | undefined)?.length ?? 0}`,
    ),
  );

  // --- call 宽松校验 ---
  const callResult = await client.callTool({
    name: MCP_ASK_TOOL_NAME,
    arguments: {
      requestId: "inspect_1",
      revision: 1,
      sessionId: "sess_inspect",
      title: "Test",
      ui: {
        presentation: "inline",
        title: "Pick",
        schema: {
          type: "object",
          properties: {
            choice: {
              type: "string",
              enum: ["a", "b"],
              enumNames: ["A", "B"],
            },
          },
          required: ["choice"],
        },
      },
    },
  });
  checks.push(
    check(
      "call-without-version",
      callResult.isError !== true,
      callResult.isError ? JSON.stringify(callResult.content) : "ok",
    ),
  );

  const sc = (callResult as { structuredContent?: { status?: string } }).structuredContent;
  checks.push(
    check(
      "call-returns-pending",
      sc?.status === ASK_STATUS_PENDING,
      `status=${sc?.status ?? "missing"}`,
    ),
  );

  await client.close();
  await server.close();

  // --- 输出报告 ---
  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.filter((c) => !c.ok);

  console.log("\n=== Agent Surfaces 验收报告 ===\n");
  for (const c of checks) {
    console.log(`${c.ok ? "✅" : "❌"} [${c.id}] ${c.detail}`);
  }
  console.log(`\n合计: ${passed}/${checks.length} 通过\n`);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "list-inputSchema.json"), JSON.stringify(listSchema, null, 2));
  writeFileSync(join(outDir, "tool-description.txt"), desc);
  writeFileSync(join(outDir, "server-instructions.txt"), instructions);
  writeFileSync(join(outDir, "form-rendering-guide.json"), guideText);
  writeFileSync(
    join(outDir, "report.json"),
    JSON.stringify({ passed, total: checks.length, checks, failed }, null, 2),
  );

  console.log(`产物已写入: ${outDir}/`);
  console.log("  - list-inputSchema.json   (tools/list 给模型看的 schema)");
  console.log("  - tool-description.txt");
  console.log("  - server-instructions.txt");
  console.log("  - form-rendering-guide.json");
  console.log("  - report.json\n");

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

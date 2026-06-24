/**
 * 将富 JSON Schema 注入 MCP tools/list，与 tools/call 的 Zod 校验分离。
 *
 * @modelcontextprotocol/sdk 的 registerTool 对 list/call 共用 inputSchema；
 * 本模块在 registerTool 之后、connect 之前替换 ListTools handler，
 * 使指定工具在 list 时返回程序化构建的富 schema，call 仍走宽松 Zod。
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { normalizeObjectSchema } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { toJsonSchemaCompat } from "@modelcontextprotocol/sdk/server/zod-json-schema-compat.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const EMPTY_OBJECT_JSON_SCHEMA = { type: "object" as const };

/** McpServer 未公开的内部工具注册表结构（仅用于 list 映射） */
type RegisteredTool = {
  title?: string;
  description?: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  annotations?: unknown;
  execution?: unknown;
  _meta?: Record<string, unknown>;
  enabled: boolean;
};

function getRegisteredTools(
  mcpServer: McpServer,
): Record<string, RegisteredTool> {
  const tools = (
    mcpServer as unknown as {
      _registeredTools?: Record<string, RegisteredTool>;
    }
  )._registeredTools;
  // 显式护栏:我们依赖 SDK 内部字段 _registeredTools。若某次 SDK 升级改了内部结构,
  // 这里大声失败(而非静默广播空/错 schema),提示去核对 @modelcontextprotocol/sdk 版本。
  if (!tools || typeof tools !== "object") {
    throw new Error(
      "attachRichToolListInputSchema: 无法访问 McpServer._registeredTools（@modelcontextprotocol/sdk 内部结构可能已变更，请核对其版本）。",
    );
  }
  return tools;
}

function zodInputSchemaToJson(tool: RegisteredTool): Record<string, unknown> {
  const obj = normalizeObjectSchema(tool.inputSchema as Parameters<
    typeof normalizeObjectSchema
  >[0]);
  if (!obj) {
    return EMPTY_OBJECT_JSON_SCHEMA;
  }
  return toJsonSchemaCompat(obj, {
    strictUnions: true,
    pipeStrategy: "input",
  }) as Record<string, unknown>;
}

/**
 * 为指定工具注入 tools/list 专用 inputSchema。
 *
 * @param mcpServer registerTool 完成后的 McpServer 实例
 * @param overrides 工具名 → 富 JSON Schema（仅影响 list，不影响 call 校验）
 */
export function attachRichToolListInputSchema(
  mcpServer: McpServer,
  overrides: Readonly<Record<string, Record<string, unknown>>>,
): void {
  const registeredTools = getRegisteredTools(mcpServer);

  // override 必须指向已注册的工具,否则是调用顺序写错(应先 registerTool 再 attach)。
  for (const name of Object.keys(overrides)) {
    if (!registeredTools[name]) {
      throw new Error(
        `attachRichToolListInputSchema: override 指向未注册的工具 "${name}"，请先调用 registerTool。`,
      );
    }
  }

  mcpServer.server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: Object.entries(registeredTools)
      .filter(([, tool]) => tool.enabled)
      .map(([name, tool]) => {
        const richListSchema = overrides[name];
        const toolDefinition: Record<string, unknown> = {
          name,
          title: tool.title,
          description: tool.description,
          inputSchema: richListSchema ?? zodInputSchemaToJson(tool),
          annotations: tool.annotations,
          execution: tool.execution,
          _meta: tool._meta,
        };

        if (tool.outputSchema) {
          const outputObj = normalizeObjectSchema(
            tool.outputSchema as Parameters<typeof normalizeObjectSchema>[0],
          );
          if (outputObj) {
            toolDefinition.outputSchema = toJsonSchemaCompat(outputObj, {
              strictUnions: true,
              pipeStrategy: "output",
            });
          }
        }

        return toolDefinition;
      }),
  }));
}

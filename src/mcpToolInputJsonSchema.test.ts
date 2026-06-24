import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import Ajv from "ajv";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { askUserPayloadShape } from "./askUserPayload.js";
import { buildMcpToolInputExamples } from "./agentFormGuide.js";
import {
  buildMcpToolInputJsonSchema,
  MCP_TOOL_INPUT_SCHEMA_DEFS,
  resolveMcpToolInputSchemaRef,
} from "./mcpToolInputJsonSchema.js";
import { attachRichToolListInputSchema } from "./patchToolListInputSchema.js";
import {
  ASK_SCHEMA_VERSION,
  INTERACTION_UI_SCHEMA_VERSION,
  MCP_ASK_TOOL_NAME,
} from "./types.js";
import { MCP_ASK_WIDGET_TYPES } from "./widgets.js";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

/** 经 $ref 取 ui.schema → FormObjectSchema → properties.additionalProperties */
function getFormFieldProperty(schema: Record<string, unknown>) {
  const ui = schema.properties as Record<string, unknown>;
  const uiObj = ui.ui as Record<string, unknown>;
  const uiProps = uiObj.properties as Record<string, unknown>;
  const formSchemaRef = uiProps.schema as { $ref: string };
  expect(formSchemaRef.$ref).toBe("#/definitions/FormObjectSchema");

  const formSchema = resolveMcpToolInputSchemaRef(schema, formSchemaRef.$ref);
  const formProps = formSchema.properties as Record<string, unknown>;
  return formProps.properties as Record<string, unknown>;
}

describe("buildMcpToolInputJsonSchema", () => {
  const schema = buildMcpToolInputJsonSchema();

  it("使用 definitions + $ref，并附带 examples 与 x-nuwax 指引", () => {
    expect(schema.definitions).toBe(MCP_TOOL_INPUT_SCHEMA_DEFS);
    const bytes = JSON.stringify(schema).length;
    expect(bytes).toBeGreaterThan(4000);
    expect(Array.isArray(schema.examples)).toBe(true);
    expect((schema.examples as unknown[]).length).toBe(2);
  });

  it("顶层 required 与 agent 友好 default 对齐 askUserPayloadShape", () => {
    expect(schema.required).toEqual([
      "requestId",
      "revision",
      "sessionId",
      "title",
      "ui",
    ]);
    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.schemaVersion.const).toBe(ASK_SCHEMA_VERSION);
    expect(props.schemaVersion.default).toBe(ASK_SCHEMA_VERSION);

    const uiVersion = (props.ui.properties as Record<string, unknown>).version as
      | Record<string, unknown>
      | undefined;
    expect(uiVersion?.const).toBe(INTERACTION_UI_SCHEMA_VERSION);
    expect(uiVersion?.default).toBe(INTERACTION_UI_SCHEMA_VERSION);
  });

  it("ui.schema 引用 FormObjectSchema，字段为 FormFieldProperty anyOf", () => {
    const fieldProps = getFormFieldProperty(schema);
    const additional = fieldProps.additionalProperties as { $ref: string };
    expect(additional.$ref).toBe("#/definitions/FormFieldProperty");

    const formField = resolveMcpToolInputSchemaRef(schema, additional.$ref);
    const anyOf = formField.anyOf as { $ref: string }[];
    expect(anyOf).toHaveLength(6);
  });

  it("ui.uiSchema 引用 UiSchema，含 WidgetType 枚举", () => {
    const ui = schema.properties as Record<string, unknown>;
    const uiObj = ui.ui as Record<string, unknown>;
    const uiProps = uiObj.properties as Record<string, unknown>;
    const uiSchemaRef = uiProps.uiSchema as { $ref: string };
    expect(uiSchemaRef.$ref).toBe("#/definitions/UiSchema");

    const uiSchema = resolveMcpToolInputSchemaRef(schema, uiSchemaRef.$ref);
    const additional = uiSchema.additionalProperties as Record<string, unknown>;
    const anyOf = additional.anyOf as { $ref: string }[];
    const fieldEntryRef = anyOf.find(
      (e) => e.$ref === "#/definitions/FieldUiSchemaEntry",
    );
    expect(fieldEntryRef).toBeDefined();

    const fieldEntry = resolveMcpToolInputSchemaRef(
      schema,
      fieldEntryRef!.$ref,
    );
    const widgetRef = (fieldEntry.properties as Record<string, unknown>)[
      "ui:widget"
    ] as { $ref: string };
    const widgetType = resolveMcpToolInputSchemaRef(schema, widgetRef.$ref);
    expect(widgetType.enum).toEqual([...MCP_ASK_WIDGET_TYPES]);
  });

  it("EnumFieldProperty 含 enumNames 说明", () => {
    const enumField = MCP_TOOL_INPUT_SCHEMA_DEFS.EnumFieldProperty as Record<
      string,
      unknown
    >;
    expect(JSON.stringify(enumField)).toContain("enumNames");
  });

  it("根 description 含推断规则、控件目录与 examples", () => {
    expect(schema.description).toContain("ui.schema");
    expect(schema.description).toContain("ui.uiSchema");
    expect(schema.description).toContain("checkboxes");
    for (const widget of MCP_ASK_WIDGET_TYPES) {
      expect(schema.description).toContain(widget);
    }
    expect(Array.isArray(schema.examples)).toBe(true);
    expect((schema.examples as unknown[]).length).toBeGreaterThanOrEqual(2);
    const xNuwax = schema["x-nuwax"] as Record<string, unknown>;
    expect(xNuwax.formRenderingGuideUri).toBeDefined();
    expect(xNuwax.supportedWidgets).toEqual([...MCP_ASK_WIDGET_TYPES]);
  });

  it("complete-form.json（去掉 toolName）仍能被宽松 Zod 解析", () => {
    const example = JSON.parse(
      readFileSync(
        join(rootDir, "schemas/examples/complete-form.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    delete example.toolName;

    const agentSchema = z.object(askUserPayloadShape);
    const result = agentSchema.safeParse(example);
    expect(result.success).toBe(true);
  });

  it("生成的 schema 能校验通过自带的全部 examples（防止 oneOf/anyOf 回归）", () => {
    const ajv = new Ajv({ strict: false, logger: false });
    const validate = ajv.compile(buildMcpToolInputJsonSchema());
    for (const example of buildMcpToolInputExamples()) {
      const ok = validate(example);
      expect(
        ok,
        `example 未通过 inputSchema 校验: ${JSON.stringify(validate.errors)}`,
      ).toBe(true);
    }
  });
});

describe("attachRichToolListInputSchema", () => {
  it("tools/list 返回富 inputSchema，tools/call 仍走宽松 Zod", async () => {
    const richSchema = {
      type: "object",
      properties: { richMarker: { const: true } },
    };

    const mcpServer = new McpServer({ name: "test", version: "0.0.0" });
    mcpServer.registerTool(
      MCP_ASK_TOOL_NAME,
      {
        inputSchema: askUserPayloadShape,
      },
      async () => ({ content: [{ type: "text", text: "ok" }] }),
    );
    attachRichToolListInputSchema(mcpServer, {
      [MCP_ASK_TOOL_NAME]: richSchema,
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "0.0.0" });
    await mcpServer.connect(serverTransport);
    await client.connect(clientTransport);

    const { tools } = await client.listTools();
    const askTool = tools.find((t) => t.name === MCP_ASK_TOOL_NAME);
    expect(askTool?.inputSchema).toEqual(richSchema);

    const result = await client.callTool({
      name: MCP_ASK_TOOL_NAME,
      arguments: {
        requestId: "r1",
        revision: 1,
        sessionId: "s1",
        title: "T",
        ui: {
          presentation: "inline",
          title: "Q",
          schema: { type: "object", properties: {} },
        },
      },
    });
    expect(result.isError).not.toBe(true);

    await client.close();
    await mcpServer.close();
  });

  it("override 指向未注册工具时大声失败（护栏）", () => {
    const mcpServer = new McpServer({ name: "test", version: "0.0.0" });
    mcpServer.registerTool(
      MCP_ASK_TOOL_NAME,
      { inputSchema: askUserPayloadShape },
      async () => ({ content: [{ type: "text", text: "ok" }] }),
    );
    expect(() =>
      attachRichToolListInputSchema(mcpServer, {
        not_a_real_tool: { type: "object" },
      }),
    ).toThrow(/未注册的工具/);
  });
});

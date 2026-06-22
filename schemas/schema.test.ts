import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ASK_SCHEMA_VERSION,
  INTERACTION_UI_SCHEMA_VERSION,
  MCP_ASK_TOOL_NAME,
  McpAskUserToolInputSchema,
  MCP_SERVER_TRANSPORT,
} from "../src/types.js";
import { MCP_ASK_WIDGET_TYPES, WIDGET_CATALOG } from "../src/widgets.js";

const schemasDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(schemasDir, "schema.json");
const examplePath = join(schemasDir, "examples/complete-form.json");

const schemaDoc = JSON.parse(readFileSync(schemaPath, "utf8")) as {
  $defs: Record<string, unknown>;
  "x-nuwax": {
    constants: {
      schemaVersion: string;
      uiVersion: string;
      toolName: string;
    };
    primaryEntry: string;
    completeFormExample: string;
  };
};

const completeFormExample = JSON.parse(readFileSync(examplePath, "utf8"));

describe("schemas/schema.json", () => {
  it("解析为合法 JSON 文档", () => {
    expect(schemaDoc.$schema).toBe("http://json-schema.org/draft-07/schema#");
    expect(schemaDoc.$defs).toBeDefined();
  });

  it("x-nuwax 常量与 src/types.ts 一致", () => {
    expect(schemaDoc["x-nuwax"].constants.schemaVersion).toBe(ASK_SCHEMA_VERSION);
    expect(schemaDoc["x-nuwax"].constants.uiVersion).toBe(
      INTERACTION_UI_SCHEMA_VERSION,
    );
    expect(schemaDoc["x-nuwax"].constants.toolName).toBe(MCP_ASK_TOOL_NAME);
    expect(schemaDoc["x-nuwax"].constants.transport).toBe(MCP_SERVER_TRANSPORT);
    expect(schemaDoc["x-nuwax"].transport).toBe("stdio");
    expect(schemaDoc["x-nuwax"].primaryEntry).toBe("McpAskUserToolInput");
    expect(schemaDoc["x-nuwax"].completeFormExample).toBe(
      "schemas/examples/complete-form.json",
    );
  });

  it("WidgetType 包含 v1 全部控件命名", () => {
    const widgetType = schemaDoc.$defs.WidgetType as { enum: string[] };
    expect(widgetType.enum).toEqual([...MCP_ASK_WIDGET_TYPES]);
  });

  it("WidgetCatalog 与 src/widgets.ts 一致", () => {
    const catalog = schemaDoc.$defs.WidgetCatalog as {
      default: typeof WIDGET_CATALOG;
    };
    expect(catalog.default).toEqual(WIDGET_CATALOG);
  });

  it("textarea 不可自动推断 widget", () => {
    const catalog = schemaDoc.$defs.WidgetCatalog as {
      default: Array<{ type: string; autoInfer: boolean }>;
    };
    const textarea = catalog.default.find((item) => item.type === "textarea");
    expect(textarea?.autoInfer).toBe(false);
  });

  it("废弃别名映射 input→text、checkbox→checkboxes", () => {
    const aliases = schemaDoc.$defs.DeprecatedBuilderAliases as {
      properties: Record<string, { const: string }>;
    };
    expect(aliases.properties.input.const).toBe("text");
    expect(aliases.properties.checkbox.const).toBe("checkboxes");
  });
});

describe("schemas/examples/complete-form.json", () => {
  it("可通过 Zod 运行时校验", () => {
    const result = McpAskUserToolInputSchema.safeParse(completeFormExample);
    expect(result.success).toBe(true);
  });

  it("包含 number 字段示例", () => {
    expect(completeFormExample.ui.uiSchema.count).toEqual({
      "ui:widget": "number",
    });
    expect(completeFormExample.ui.schema.properties.count.type).toBe("integer");
  });
});

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
import { MCP_ASK_WIDGET_TYPES } from "../src/widgets.js";

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

  it("WidgetCatalog 仅含结构定义（无实例 default），items 引用 WidgetCatalogEntry", () => {
    const catalog = schemaDoc.$defs.WidgetCatalog as {
      type: string;
      items: { $ref: string };
      default?: unknown;
    };
    expect(catalog.type).toBe("array");
    expect(catalog.items).toEqual({ $ref: "#/$defs/WidgetCatalogEntry" });
    expect(catalog.default).toBeUndefined();
  });

  it("字段模型内联自包含（无 $ref）：NuwaxAskQuestionInput.ui.fields.items 含 widget 枚举与 options", () => {
    const nuwaxInput = schemaDoc.$defs.NuwaxAskQuestionInput as {
      properties: {
        ui: {
          properties: {
            fields: {
              items: {
                required: string[];
                properties: {
                  widget: { enum: string[] };
                  options: { items: { properties: { value: unknown } } };
                };
              };
            };
          };
        };
      };
    };
    const fieldItem = nuwaxInput.properties.ui.properties.fields.items;
    expect(fieldItem.required).toEqual(["name", "title", "widget"]);
    expect(fieldItem.properties.widget.enum).toEqual([...MCP_ASK_WIDGET_TYPES]);
    expect(fieldItem.properties.options.items.properties.value).toBeDefined();
    // 字段模型内联，无 $ref
    expect(JSON.stringify(fieldItem)).not.toContain('"$ref"');
    expect(schemaDoc.$defs.FormField).toBeUndefined();
    expect(schemaDoc.$defs.FieldOption).toBeUndefined();
  });

  it("废弃别名映射 input→text、checkbox→checkboxes", () => {
    const aliases = schemaDoc.$defs.DeprecatedBuilderAliases as {
      properties: Record<string, { const: string }>;
    };
    expect(aliases.properties.input.const).toBe("text");
    expect(aliases.properties.checkbox.const).toBe("checkboxes");
  });

  it("schema.json 聚焦格式定义：无顶层 examples、无 CompleteFormExampleRef", () => {
    expect(schemaDoc.examples).toBeUndefined();
    expect(schemaDoc.$defs.CompleteFormExampleRef).toBeUndefined();
  });
});

describe("schemas/examples/complete-form.json", () => {
  it("可通过 Zod 运行时校验", () => {
    const result = McpAskUserToolInputSchema.safeParse(completeFormExample);
    expect(result.success).toBe(true);
  });

  it("使用 v2 字段数组 fields[]", () => {
    expect(completeFormExample.ui).not.toHaveProperty("schema");
    expect(completeFormExample.ui).not.toHaveProperty("uiSchema");
    expect(Array.isArray(completeFormExample.ui.fields)).toBe(true);
  });

  it("包含 number 字段示例", () => {
    const count = completeFormExample.ui.fields.find(
      (f: { name: string }) => f.name === "count",
    );
    expect(count.widget).toBe("number");
    expect(count.type).toBe("integer");
  });
});

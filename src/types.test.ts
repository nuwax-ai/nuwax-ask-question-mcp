import { describe, expect, it } from "vitest";
import {
  McpAskUserToolInputSchema,
  InteractionUiSchema,
  MCP_ASK_TOOL_NAME,
  LEGACY_MCP_ASK_TOOL_NAMES,
  ASK_SCHEMA_VERSION,
  INTERACTION_UI_SCHEMA_VERSION,
} from "./types.js";

/** 构造合法输入的工厂函数 */
function validInput(overrides = {}) {
  return {
    toolName: "nuwax_ask_question",
    schemaVersion: "nuwaclaw.mcp_ask.v1",
    requestId: "req-001",
    revision: 1,
    sessionId: "sess-001",
    title: "Test Question",
    ui: {
      version: "nuwaclaw.interaction.v1",
      presentation: "inline" as const,
      title: "Question Title",
      schema: { type: "object", properties: {} },
    },
    ...overrides,
  };
}

/** 构造合法 UI 的工厂函数 */
function validUi(overrides = {}) {
  return {
    version: "nuwaclaw.interaction.v1" as const,
    presentation: "inline" as const,
    title: "Question Title",
    schema: { type: "object", properties: {} },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// McpAskUserToolInputSchema
// ---------------------------------------------------------------------------
describe("McpAskUserToolInputSchema", () => {
  it("接受完整合法输入", () => {
    const result = McpAskUserToolInputSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  it("接受 3 种 toolName", () => {
    const names = [MCP_ASK_TOOL_NAME, ...LEGACY_MCP_ASK_TOOL_NAMES];
    for (const toolName of names) {
      const result = McpAskUserToolInputSchema.safeParse(validInput({ toolName }));
      expect(result.success).toBe(true);
    }
  });

  it("拒绝缺少必填字段", () => {
    const requiredFields = [
      "toolName",
      "schemaVersion",
      "requestId",
      "revision",
      "sessionId",
      "title",
    ];
    for (const field of requiredFields) {
      const input = validInput();
      delete (input as any)[field];
      const result = McpAskUserToolInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    }
  });

  it("拒绝缺少 ui 字段", () => {
    const input = validInput();
    delete (input as any).ui;
    const result = McpAskUserToolInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("拒绝无效 schemaVersion", () => {
    const result = McpAskUserToolInputSchema.safeParse(
      validInput({ schemaVersion: "wrong.version" }),
    );
    expect(result.success).toBe(false);
  });

  it("拒绝 revision=0", () => {
    const result = McpAskUserToolInputSchema.safeParse(validInput({ revision: 0 }));
    expect(result.success).toBe(false);
  });

  it("拒绝负数 revision", () => {
    const result = McpAskUserToolInputSchema.safeParse(validInput({ revision: -1 }));
    expect(result.success).toBe(false);
  });

  it("拒绝空 requestId", () => {
    const result = McpAskUserToolInputSchema.safeParse(validInput({ requestId: "" }));
    expect(result.success).toBe(false);
  });

  it("拒绝额外字段 (strict)", () => {
    const result = McpAskUserToolInputSchema.safeParse(
      validInput({ extraField: "not allowed" }),
    );
    expect(result.success).toBe(false);
  });

  it("接受所有可选字段", () => {
    const result = McpAskUserToolInputSchema.safeParse(
      validInput({
        description: "A description",
        business: { key: "value" },
        timeoutMs: 30000,
        priority: "high",
      }),
    );
    expect(result.success).toBe(true);
  });

  it("拒绝无效 toolName", () => {
    const result = McpAskUserToolInputSchema.safeParse(
      validInput({ toolName: "invalid_tool" }),
    );
    expect(result.success).toBe(false);
  });

  it("拒绝空 title", () => {
    const result = McpAskUserToolInputSchema.safeParse(validInput({ title: "" }));
    expect(result.success).toBe(false);
  });

  it("拒绝 revision 为小数", () => {
    const result = McpAskUserToolInputSchema.safeParse(validInput({ revision: 1.5 }));
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// InteractionUiSchema
// ---------------------------------------------------------------------------
describe("InteractionUiSchema", () => {
  it("接受 4 种 presentation", () => {
    const presentations = ["modal", "inline", "wizard", "table"] as const;
    for (const presentation of presentations) {
      const result = InteractionUiSchema.safeParse(validUi({ presentation }));
      expect(result.success).toBe(true);
    }
  });

  it("允许额外字段 (passthrough)", () => {
    const result = InteractionUiSchema.safeParse(
      validUi({ customField: "allowed" }),
    );
    expect(result.success).toBe(true);
  });

  it("接受 steps 数组", () => {
    const result = InteractionUiSchema.safeParse(
      validUi({
        steps: [
          { id: "step1", title: "Step 1", fields: ["field1"] },
          { id: "step2", title: "Step 2", description: "Desc", fields: ["field2", "field3"] },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("拒绝 steps 中缺少必填字段", () => {
    const result = InteractionUiSchema.safeParse(
      validUi({
        steps: [{ id: "step1" }],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("拒绝 steps 中空 id", () => {
    const result = InteractionUiSchema.safeParse(
      validUi({
        steps: [{ id: "", title: "Step", fields: [] }],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("接受 fallback 可选字段", () => {
    const result = InteractionUiSchema.safeParse(
      validUi({
        fallback: {
          text: "Please use the web interface",
          webUrl: "https://example.com/form",
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  it("接受 fallback 带 mobileUrl", () => {
    const result = InteractionUiSchema.safeParse(
      validUi({
        fallback: {
          text: "Please use the mobile app",
          mobileUrl: "nuwax://ask/form/123",
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  it("拒绝 fallback 中无效 URL", () => {
    const result = InteractionUiSchema.safeParse(
      validUi({
        fallback: {
          text: "Fallback",
          webUrl: "not-a-url",
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("接受所有可选字段", () => {
    const result = InteractionUiSchema.safeParse(
      validUi({
        description: "UI description",
        uiSchema: { "ui:order": ["a", "b"] },
        table: { columns: [] },
        initialValue: { name: "default" },
        submitLabel: "Submit",
        cancelLabel: "Cancel",
      }),
    );
    expect(result.success).toBe(true);
  });

  it("拒绝无效 presentation", () => {
    const result = InteractionUiSchema.safeParse(
      validUi({ presentation: "dropdown" }),
    );
    expect(result.success).toBe(false);
  });

  it("拒绝空 title", () => {
    const result = InteractionUiSchema.safeParse(validUi({ title: "" }));
    expect(result.success).toBe(false);
  });

  it("接受包含文件上传 widget 的 schema", () => {
    const result = InteractionUiSchema.safeParse(
      validUi({
        schema: {
          type: "object",
          properties: {
            screenshot: {
              type: "string",
              format: "data-url",
              title: "截图",
            },
            documents: {
              type: "array",
              title: "相关文件",
              items: { type: "string", format: "data-url" },
            },
          },
        },
        uiSchema: {
          screenshot: { "ui:widget": "file", "ui:options": { accept: "image/*" } },
          documents: { "ui:widget": "file", "ui:options": { multiple: true } },
        },
      }),
    );
    expect(result.success).toBe(true);
  });
});

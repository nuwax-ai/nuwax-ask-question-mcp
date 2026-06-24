import { describe, expect, it } from "vitest";
import {
  McpAskUserToolInputSchema,
  InteractionUiSchema,
  MCP_ASK_TOOL_NAME,
  ASK_SCHEMA_VERSION,
  INTERACTION_UI_SCHEMA_VERSION,
} from "./types.js";

/** 构造合法输入的工厂函数（v2：表单用 fields[]，最小 ui 无需 fields） */
function validInput(overrides = {}) {
  return {
    toolName: MCP_ASK_TOOL_NAME,
    schemaVersion: ASK_SCHEMA_VERSION,
    requestId: "req-001",
    revision: 1,
    sessionId: "sess-001",
    title: "Test Question",
    ui: {
      version: INTERACTION_UI_SCHEMA_VERSION,
      presentation: "inline" as const,
      title: "Question Title",
    },
    ...overrides,
  };
}

/** 构造合法 UI 的工厂函数 */
function validUi(overrides = {}) {
  return {
    version: INTERACTION_UI_SCHEMA_VERSION as const,
    presentation: "inline" as const,
    title: "Question Title",
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

  it("仅接受主工具名", () => {
    const result = McpAskUserToolInputSchema.safeParse(
      validInput({ toolName: MCP_ASK_TOOL_NAME }),
    );
    expect(result.success).toBe(true);
  });

  it("仅接受最新 schemaVersion", () => {
    const result = McpAskUserToolInputSchema.safeParse(
      validInput({ schemaVersion: ASK_SCHEMA_VERSION }),
    );
    expect(result.success).toBe(true);
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
    for (const toolName of [
      "invalid_tool",
      "nuwax_ask_user",
      "nuwaclaw_ask_user",
    ]) {
      const result = McpAskUserToolInputSchema.safeParse(
        validInput({ toolName }),
      );
      expect(result.success).toBe(false);
    }
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
  it("接受 3 种 presentation", () => {
    const presentations = ["modal", "inline", "wizard"] as const;
    for (const presentation of presentations) {
      const result = InteractionUiSchema.safeParse(validUi({ presentation }));
      expect(result.success).toBe(true);
    }
  });

  it("仅接受最新 ui.version (v2)", () => {
    const result = InteractionUiSchema.safeParse(
      validUi({ version: INTERACTION_UI_SCHEMA_VERSION }),
    );
    expect(result.success).toBe(true);
  });

  it("拒绝旧 v1 ui.version", () => {
    const result = InteractionUiSchema.safeParse(
      validUi({ version: "nuwax.interaction.v1" }),
    );
    expect(result.success).toBe(false);
  });

  it("拒绝旧 nuwaclaw ui.version", () => {
    const result = InteractionUiSchema.safeParse(
      validUi({ version: "nuwaclaw.interaction.v1" }),
    );
    expect(result.success).toBe(false);
  });

  it("允许额外字段 (passthrough)", () => {
    const result = InteractionUiSchema.safeParse(
      validUi({ customField: "allowed" }),
    );
    expect(result.success).toBe(true);
  });

  it("接受 fields 字段数组", () => {
    const result = InteractionUiSchema.safeParse(
      validUi({
        fields: [
          { name: "choice", title: "选项", widget: "radio", required: true, options: [
            { value: "a", label: "A" },
            { value: "b", label: "B" },
          ] },
          { name: "remark", title: "备注", widget: "textarea" },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("拒绝 fields 中缺少必填 name/title/widget", () => {
    const result = InteractionUiSchema.safeParse(
      validUi({ fields: [{ name: "a", title: "A" }] }),
    );
    expect(result.success).toBe(false);
  });

  it("拒绝 fields 中无效 widget", () => {
    const result = InteractionUiSchema.safeParse(
      validUi({ fields: [{ name: "a", title: "A", widget: "dropdown" }] }),
    );
    expect(result.success).toBe(false);
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
        fields: [{ name: "a", title: "A", widget: "text", initialValue: "default" }],
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

  it("接受包含文件上传 widget 的 fields", () => {
    const result = InteractionUiSchema.safeParse(
      validUi({
        fields: [
          { name: "screenshot", title: "截图", widget: "file", accept: "image/*" },
          { name: "documents", title: "相关文件", widget: "file", multiple: true },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("接受包含单选列表 widget 的 fields", () => {
    const result = InteractionUiSchema.safeParse(
      validUi({
        fields: [
          { name: "framework", title: "前端框架", widget: "list", options: [
            { value: "react", label: "React" },
            { value: "vue", label: "Vue" },
            { value: "angular", label: "Angular" },
            { value: "svelte", label: "Svelte" },
          ] },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });
});

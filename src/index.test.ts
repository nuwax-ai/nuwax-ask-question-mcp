import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  askUserPayloadShape,
  normalizeMcpAskUserToolInput,
} from "./askUserPayload.js";
import { ASK_TOOL_DESCRIPTION, ASK_TOOL_EXAMPLE_PAYLOAD, handleAsk } from "./index.js";
import {
  ASK_SCHEMA_VERSION,
  ASK_STATUS_PENDING,
  INTERACTION_UI_SCHEMA_VERSION,
  MCP_ASK_TOOL_NAME,
} from "./types.js";

/** 构造合法输入的工厂函数（v2：表单用 fields[]，最小 ui 无需 fields） */
function validInput(overrides = {}) {
  return {
    toolName: MCP_ASK_TOOL_NAME as string,
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

describe("handleAsk", () => {
  it("合法输入返回 status pending + requestId + revision + message", async () => {
    const input = validInput({ requestId: "req-123", revision: 3 });
    const result = await handleAsk(input as any);

    expect(result.structuredContent).toBeDefined();
    const sc = result.structuredContent as any;
    expect(sc.status).toBe(ASK_STATUS_PENDING);
    expect(sc.requestId).toBe("req-123");
    expect(sc.revision).toBe(3);
    expect(typeof sc.message).toBe("string");
    expect(sc.message.length).toBeGreaterThan(0);
  });

  it("structuredContent 包含规范化 input（DockPanel 契约）", async () => {
    const input = validInput();
    const result = await handleAsk(input as any);
    const sc = result.structuredContent as any;

    expect(sc).toHaveProperty("status");
    expect(sc).toHaveProperty("requestId");
    expect(sc).toHaveProperty("revision");
    expect(sc).toHaveProperty("message");
    expect(sc).toHaveProperty("input");
    expect(sc.input.schemaVersion).toBe(ASK_SCHEMA_VERSION);
    expect(sc.input.toolName).toBe(MCP_ASK_TOOL_NAME);
    expect(sc.input.ui.version).toBe(INTERACTION_UI_SCHEMA_VERSION);
    expect(Object.keys(sc)).toHaveLength(5);
  });

  it("content[0].text 包含固定提示文本", async () => {
    const input = validInput();
    const result = await handleAsk(input as any);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("presented to the user");
    expect(result.content[0].text).toContain("Stop this turn now");
  });

  it("content[0].text 与 structuredContent.message 一致", async () => {
    const input = validInput();
    const result = await handleAsk(input as any);

    expect(result.content[0].text).toBe(
      (result.structuredContent as any).message,
    );
  });

  it("缺少必填字段时抛出 ZodError", async () => {
    const input = validInput();
    delete (input as any).requestId;

    await expect(handleAsk(input as any)).rejects.toThrow();
  });

  it("缺少 ui 时抛出 ZodError", async () => {
    const input = validInput();
    delete (input as any).ui;

    await expect(handleAsk(input as any)).rejects.toThrow();
  });

  it("无效 schemaVersion 时抛出 ZodError", async () => {
    const input = validInput({ schemaVersion: "wrong" });

    await expect(handleAsk(input as any)).rejects.toThrow();
  });

  it("toolName 为 MCP_ASK_TOOL_NAME 时正常工作", async () => {
    const input = validInput({ toolName: MCP_ASK_TOOL_NAME });
    const result = await handleAsk(input as any);

    expect(result.structuredContent).toBeDefined();
    const sc = result.structuredContent as any;
    expect(sc.status).toBe(ASK_STATUS_PENDING);
    expect(sc.requestId).toBe("req-001");
  });

  it("拒绝旧 nuwaclaw 命名空间版本", async () => {
    const input = validInput({
      schemaVersion: "nuwaclaw.mcp_ask.v1",
      ui: {
        version: "nuwaclaw.interaction.v1",
        presentation: "inline" as const,
        title: "Question Title",
      },
    });

    await expect(handleAsk(input as any)).rejects.toThrow();
  });
});

describe("normalizeMcpAskUserToolInput", () => {
  it("agent 漏写 schemaVersion 时补齐完整 rawInput", () => {
    const normalized = normalizeMcpAskUserToolInput({
      requestId: "weather-plan-confirm",
      revision: 1,
      sessionId: "weather-dev",
      title: "确认实现方案",
      ui: {
        presentation: "modal",
        title: "确认实现方案",
        fields: [
          { name: "data_source", title: "数据源", widget: "select", options: [
            { value: "851", label: "851" },
            { value: "72", label: "72" },
          ] },
        ],
      },
    });

    expect(normalized.schemaVersion).toBe(ASK_SCHEMA_VERSION);
    expect(normalized.toolName).toBe(MCP_ASK_TOOL_NAME);
    expect(normalized.requestId).toBe("weather-plan-confirm");
    expect(normalized.ui.version).toBe(INTERACTION_UI_SCHEMA_VERSION);
  });

  it("agent 漏写 ui.version 时补齐", () => {
    const normalized = normalizeMcpAskUserToolInput({
      schemaVersion: ASK_SCHEMA_VERSION,
      requestId: "ask-1",
      revision: 1,
      sessionId: "sess-1",
      title: "Choose",
      ui: {
        presentation: "inline",
        title: "Pick one",
      },
    });

    expect(normalized.ui.version).toBe(INTERACTION_UI_SCHEMA_VERSION);
  });
});

describe("ASK_TOOL_DESCRIPTION", () => {
  it("包含当前 MCP 工具名（防止与 MCP_ASK_TOOL_NAME 失同步）", () => {
    expect(ASK_TOOL_DESCRIPTION).toContain(MCP_ASK_TOOL_NAME);
  });

  it("示例携带当前 UI schema 版本（防止与 INTERACTION_UI_SCHEMA_VERSION 失同步）", () => {
    expect(ASK_TOOL_DESCRIPTION).toContain(INTERACTION_UI_SCHEMA_VERSION);
  });

  it("描述中带引号的 status 值与 ASK_STATUS_PENDING 一致（防失同步）", () => {
    expect(ASK_TOOL_DESCRIPTION).toContain(`status "${ASK_STATUS_PENDING}"`);
  });

  it("包含触发场景关键短语，确保 Agent 能识别何时调用", () => {
    expect(ASK_TOOL_DESCRIPTION).toContain("ALWAYS use this tool");
    expect(ASK_TOOL_DESCRIPTION).toContain("guessing");
    expect(ASK_TOOL_DESCRIPTION).toContain("user input");
  });

  it("包含完整 JSON 示例，帮助 Agent 构造参数", () => {
    expect(ASK_TOOL_DESCRIPTION).toContain(ASK_SCHEMA_VERSION);
    expect(ASK_TOOL_DESCRIPTION).toContain('"requestId"');
    expect(ASK_TOOL_DESCRIPTION).toContain('"sessionId"');
    expect(ASK_TOOL_DESCRIPTION).toContain(
      `Example: ${JSON.stringify(ASK_TOOL_EXAMPLE_PAYLOAD)}`,
    );
  });

  it("示例为简短的 fields[]（含 radio + textarea）", () => {
    expect(ASK_TOOL_DESCRIPTION).toContain('"widget":"radio"');
    expect(ASK_TOOL_DESCRIPTION).toContain('"widget":"textarea"');
  });

  it("示例不再包含 uiSchema / ui:order（v2 已合并/移除）", () => {
    expect(ASK_TOOL_DESCRIPTION).not.toContain('"ui:order"');
    expect(ASK_TOOL_DESCRIPTION).not.toContain('"ui:widget"');
    expect(ASK_TOOL_DESCRIPTION).not.toContain('"uiSchema"');
  });

  it("示例包含关键 v2 字段片段", () => {
    expect(ASK_TOOL_DESCRIPTION).toContain('"options"');
    expect(ASK_TOOL_DESCRIPTION).toContain('"submitLabel"');
    expect(ASK_TOOL_DESCRIPTION).toContain('"initialValue"');
  });

  it("示例可通过 normalizeMcpAskUserToolInput 严格校验", () => {
    const normalized = normalizeMcpAskUserToolInput(ASK_TOOL_EXAMPLE_PAYLOAD);
    expect(normalized.toolName).toBe(MCP_ASK_TOOL_NAME);
    expect(normalized.schemaVersion).toBe(ASK_SCHEMA_VERSION);
    expect(normalized.ui.version).toBe(INTERACTION_UI_SCHEMA_VERSION);
  });

  it("包含 schema 设计规则（options + 禁止裸值）", () => {
    expect(ASK_TOOL_DESCRIPTION).toContain("options");
    expect(ASK_TOOL_DESCRIPTION).toContain("NEVER show bare values");
  });
});

describe("askUserPayloadShape — agent 友好的版本默认值", () => {
  // 复刻 SDK 对 raw shape 的处理：objectFromShape(shape) === z.object(shape)
  const schema = z.object(askUserPayloadShape);

  /** 构造 agent 实际可能发出的入参（故意不带任何 version 字段） */
  function agentInput(overrides: Record<string, unknown> = {}) {
    return {
      schemaVersion: ASK_SCHEMA_VERSION,
      requestId: "req-001",
      revision: 1,
      sessionId: "sess-001",
      title: "Test Question",
      ui: {
        presentation: "inline" as const,
        title: "Question Title",
      },
      ...overrides,
    };
  }

  it("agent 漏写 ui.version 时自动补默认值（核心回归）", () => {
    const result = schema.safeParse(agentInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as any).ui.version).toBe(INTERACTION_UI_SCHEMA_VERSION);
    }
  });

  it("agent 漏写顶层 schemaVersion 时自动补默认值", () => {
    const input = agentInput();
    delete (input as Record<string, unknown>).schemaVersion;
    const result = schema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as any).schemaVersion).toBe(ASK_SCHEMA_VERSION);
    }
  });

  it("默认值不削弱 literal 校验：写错 ui.version 仍被拒绝", () => {
    const result = schema.safeParse(
      agentInput({
        ui: {
          version: "nuwax.interaction.v1",
          presentation: "inline" as const,
          title: "Question Title",
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("默认值不削弱 literal 校验：写错 schemaVersion 仍被拒绝", () => {
    const result = schema.safeParse(agentInput({ schemaVersion: "wrong" }));
    expect(result.success).toBe(false);
  });

  it("补齐后的入参能通过 handleAsk 的严格校验（端到端）", async () => {
    const parsed = schema.safeParse(agentInput());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const result = await handleAsk({
      ...(parsed.data as any),
      toolName: MCP_ASK_TOOL_NAME,
    });
    const sc = result.structuredContent as any;
    expect(sc.status).toBe(ASK_STATUS_PENDING);
    expect(sc.requestId).toBe("req-001");
    expect(sc.input.schemaVersion).toBe(ASK_SCHEMA_VERSION);
  });
});

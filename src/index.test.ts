import { describe, expect, it } from "vitest";
import { handleAsk } from "./index.js";
import {
  ASK_SCHEMA_VERSION,
  ASK_SCHEMA_VERSION_ALIASES,
  INTERACTION_UI_SCHEMA_VERSION,
  INTERACTION_UI_SCHEMA_VERSION_ALIASES,
  MCP_ASK_TOOL_NAME,
} from "./types.js";

/** 构造合法输入的工厂函数 */
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
      schema: { type: "object", properties: {} },
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
    expect(sc.status).toBe("pending");
    expect(sc.requestId).toBe("req-123");
    expect(sc.revision).toBe(3);
    expect(typeof sc.message).toBe("string");
    expect(sc.message.length).toBeGreaterThan(0);
  });

  it("structuredContent 包含正确字段", async () => {
    const input = validInput();
    const result = await handleAsk(input as any);
    const sc = result.structuredContent as any;

    expect(sc).toHaveProperty("status");
    expect(sc).toHaveProperty("requestId");
    expect(sc).toHaveProperty("revision");
    expect(sc).toHaveProperty("message");
    expect(Object.keys(sc)).toHaveLength(4);
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
    expect(sc.status).toBe("pending");
    expect(sc.requestId).toBe("req-001");
  });

  it("兼容 nuwax 命名空间迁移别名", async () => {
    const input = validInput({
      schemaVersion: ASK_SCHEMA_VERSION_ALIASES[0],
      ui: {
        version: INTERACTION_UI_SCHEMA_VERSION_ALIASES[0],
        presentation: "inline" as const,
        title: "Question Title",
        schema: { type: "object", properties: {} },
      },
    });
    const result = await handleAsk(input as any);

    expect((result.structuredContent as any).status).toBe("pending");
  });
});

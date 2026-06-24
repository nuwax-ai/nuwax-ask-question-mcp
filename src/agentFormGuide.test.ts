import { describe, expect, it } from "vitest";
import {
  buildAgentFormRenderingGuideDocument,
  buildAskToolDescription,
  buildFormRenderingRules,
  buildMcpServerInstructions,
  buildMcpToolInputExamples,
  FORM_RENDERING_GUIDE_URI,
} from "./agentFormGuide.js";
import {
  ASK_SCHEMA_VERSION,
  INTERACTION_UI_SCHEMA_VERSION,
  MCP_ASK_TOOL_NAME,
} from "./types.js";
import { MCP_ASK_WIDGET_TYPES, WIDGET_CATALOG } from "./widgets.js";

describe("agentFormGuide", () => {
  it("指南文档含全部支持控件与示例", () => {
    const doc = buildAgentFormRenderingGuideDocument();
    expect(doc.protocolVersion).toBe(ASK_SCHEMA_VERSION);
    expect(doc.interactionVersion).toBe(INTERACTION_UI_SCHEMA_VERSION);
    expect(doc.supportedWidgets).toEqual([...MCP_ASK_WIDGET_TYPES]);
    expect(doc.widgetCatalog).toHaveLength(WIDGET_CATALOG.length);
    expect(doc.examples).toHaveLength(3);
  });

  it("示例不含 toolName，且含 enumNames", () => {
    for (const example of buildMcpToolInputExamples()) {
      expect(example).not.toHaveProperty("toolName");
    }
    const minimal = buildMcpToolInputExamples()[0] as {
      ui: { schema: { properties: { choice: { enumNames: string[] } } } };
    };
    expect(minimal.ui.schema.properties.choice.enumNames).toHaveLength(2);
  });

  it("instructions 与 description 含双层渲染说明与控件名", () => {
    const instructions = buildMcpServerInstructions();
    const description = buildAskToolDescription();
    for (const text of [instructions, description]) {
      expect(text).toContain("ui.schema");
      expect(text).toContain("ui.uiSchema");
      expect(text).toContain("enumNames");
      for (const widget of MCP_ASK_WIDGET_TYPES) {
        expect(text).toContain(widget);
      }
    }
    expect(instructions).toContain(MCP_ASK_TOOL_NAME);
    expect(description).toContain(FORM_RENDERING_GUIDE_URI);
  });

  it("渲染规则覆盖推断与显式 widget", () => {
    const rules = buildFormRenderingRules().join("\n");
    expect(rules).toContain("checkboxes");
    expect(rules).toContain("format=data-url");
    expect(rules).toContain("ui:widget");
  });
});

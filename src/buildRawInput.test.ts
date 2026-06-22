import { describe, expect, it } from "vitest";
import { buildMcpAskRawInput, buildFieldSchemaParts } from "./buildRawInput.js";
import { McpAskUserToolInputSchema } from "./types.js";

describe("buildFieldSchemaParts", () => {
  it("maps deprecated input alias to text", () => {
    const { property, uiSchema } = buildFieldSchemaParts({
      name: "name",
      type: "input",
      label: "姓名",
    });
    expect(property).toEqual({ title: "姓名", type: "string" });
    expect(uiSchema).toEqual({});
  });

  it("maps deprecated checkbox alias to checkboxes", () => {
    const { property, uiSchema } = buildFieldSchemaParts({
      name: "tags",
      type: "checkbox",
      label: "标签",
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
    });
    expect(property.type).toBe("array");
    expect(uiSchema["ui:widget"]).toBe("checkboxes");
  });

  it("builds number field with bounds", () => {
    const { property, uiSchema } = buildFieldSchemaParts({
      name: "count",
      type: "number",
      label: "数量",
      minimum: 1,
      maximum: 10,
    });
    expect(property).toMatchObject({
      type: "integer",
      minimum: 1,
      maximum: 10,
    });
    expect(uiSchema).toEqual({ "ui:widget": "number" });
  });
});

describe("buildMcpAskRawInput", () => {
  it("produces valid McpAskUserToolInput", () => {
    const rawInput = buildMcpAskRawInput({
      requestId: "ask_1",
      revision: 1,
      sessionId: "sess_1",
      title: "请确认",
      fields: [
        { name: "choice", type: "radio", label: "选项", required: true, options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ]},
        { name: "remark", type: "textarea", label: "备注" },
        { name: "count", type: "number", label: "数量", minimum: 0 },
      ],
      submitLabel: "提交",
    });

    const parsed = McpAskUserToolInputSchema.safeParse(rawInput);
    expect(parsed.success).toBe(true);
    expect(rawInput.ui).toMatchObject({
      schema: {
        required: ["choice"],
        properties: {
          choice: { enum: ["a", "b"], enumNames: ["A", "B"] },
          count: { type: "integer", minimum: 0 },
        },
      },
      uiSchema: {
        choice: { "ui:widget": "radio" },
        remark: { "ui:widget": "textarea" },
        count: { "ui:widget": "number" },
      },
    });
  });
});

import { describe, expect, it } from "vitest";
import { buildMcpAskRawInput, buildFormField } from "./buildRawInput.js";
import { McpAskUserToolInputSchema } from "./types.js";

describe("buildFormField", () => {
  it("maps deprecated input alias to text widget", () => {
    const field = buildFormField({
      name: "name",
      type: "input",
      label: "姓名",
    });
    expect(field).toEqual({ name: "name", title: "姓名", widget: "text" });
  });

  it("maps deprecated checkbox alias to checkboxes widget", () => {
    const field = buildFormField({
      name: "tags",
      type: "checkbox",
      label: "标签",
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
    });
    expect(field.widget).toBe("checkboxes");
    expect(field.type).toBe("array");
    expect(field.options).toEqual([
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ]);
  });

  it("builds number field with bounds", () => {
    const field = buildFormField({
      name: "count",
      type: "number",
      label: "数量",
      minimum: 1,
      maximum: 10,
    });
    expect(field).toMatchObject({
      widget: "number",
      type: "integer",
      minimum: 1,
      maximum: 10,
    });
  });

  it("builds radio field with options", () => {
    const field = buildFormField({
      name: "choice",
      type: "radio",
      label: "选项",
      required: true,
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
    });
    expect(field).toMatchObject({
      widget: "radio",
      required: true,
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
    });
  });

  it("builds file field with accept/multiple", () => {
    const field = buildFormField({
      name: "screenshot",
      type: "file",
      label: "截图",
      file: { accept: "image/*", multiple: false, maxFileSize: 1024 },
    });
    expect(field).toMatchObject({
      widget: "file",
      accept: "image/*",
      multiple: false,
      maxFileSize: 1024,
    });
  });
});

describe("buildMcpAskRawInput", () => {
  it("produces valid McpAskUserToolInput with fields[]", () => {
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

    const fields = rawInput.ui.fields as Array<Record<string, unknown>>;
    const choice = fields.find((f) => f.name === "choice");
    const count = fields.find((f) => f.name === "count");
    expect(choice).toMatchObject({
      widget: "radio",
      required: true,
      options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
    });
    expect(count).toMatchObject({ widget: "number", type: "integer", minimum: 0 });
    // v2：不再生成 schema/uiSchema
    expect(rawInput.ui).not.toHaveProperty("schema");
    expect(rawInput.ui).not.toHaveProperty("uiSchema");
  });
});

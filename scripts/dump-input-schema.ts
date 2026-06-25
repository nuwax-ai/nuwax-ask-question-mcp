/**
 * 导出 agent 可见的工具 inputSchema —— 即 src/index.ts 中
 *   server.registerTool(MCP_ASK_TOOL_NAME, { inputSchema: askUserPayloadShape, ... })
 * 这一行对应的 JSON Schema，写入 schemas/input-schema.json，便于查看 LLM 实际收到的字段结构。
 *
 * 转换方式与 MCP SDK 一致：z.object(shape) → zod-to-json-schema（内联、无 $ref）。
 *
 * 用法：npm run dump:input-schema
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { askUserPayloadShape } from "../src/askUserPayload.js";

const outPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "schemas/input-schema.json",
);

// 复刻 SDK 对 raw shape 的处理：objectFromShape(shape) === z.object(shape)，再转 JSON Schema。
// 与 SDK 一致使用默认 $refStrategy——共享的 Zod 实例（如 FieldNameSchema）会以 $ref 复用。
const inputSchema = zodToJsonSchema(z.object(askUserPayloadShape)) as Record<string, unknown>;

/** wizard steps[].fields → $ref ui.properties.fields */
function patchWizardStepFieldRefs(schema: Record<string, unknown>): void {
  const ui = (schema.properties as Record<string, unknown> | undefined)?.ui as
    | Record<string, unknown>
    | undefined;
  const stepProps = (
    (ui?.properties as Record<string, unknown> | undefined)?.steps as
      | Record<string, unknown>
      | undefined
  )?.items as Record<string, unknown> | undefined;
  const props = stepProps?.properties as Record<string, unknown> | undefined;
  if (props?.fields) {
    props.fields = {
      $ref: "#/properties/ui/properties/fields",
      description: "本步展示的字段 name 数组，引用 ui.fields 中字段的 name",
    };
  }
}

patchWizardStepFieldRefs(inputSchema);

writeFileSync(outPath, `${JSON.stringify(inputSchema, null, 2)}\n`, "utf8");

const schema = inputSchema as {
  required?: string[];
  properties?: Record<string, unknown>;
};
console.log(`Wrote agent inputSchema → ${outPath}`);
console.log(`top-level required: ${JSON.stringify(schema.required)}`);
console.log(
  `ui.fields typed?: ${
    !!(
      schema.properties?.ui as { properties?: { fields?: { type?: string } } }
    )?.properties?.fields?.type
  }`,
);

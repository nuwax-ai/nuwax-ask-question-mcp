/**
 * 跨仓库 widget 白名单校验：
 * schemas/schema.json ↔ nuwax Web ↔ nuwax-mobile
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mcpDir = path.resolve(scriptDir, "..");
const nuwaxDir = process.env.NUWAX_WEB_DIR || path.resolve(mcpDir, "../nuwax");
const mobileDir = process.env.NUWAX_MOBILE_DIR || path.resolve(mcpDir, "../nuwax-mobile");

if (!fs.existsSync(nuwaxDir) || !fs.existsSync(mobileDir)) {
  console.log(
    `Skip widget contract verification: sibling repos not found.\n  nuwax (web): ${nuwaxDir}\n  nuwax-mobile: ${mobileDir}\n  Set NUWAX_WEB_DIR / NUWAX_MOBILE_DIR env vars if repos are in non-default locations.`,
  );
  process.exit(0);
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sorted(values) {
  return [...values].sort();
}

function setsEqual(a, b) {
  const left = sorted(a);
  const right = sorted(b);
  return (
    left.length === right.length && left.every((value, index) => value === right[index])
  );
}

/** 从 export const MCP_ASK_WIDGET_TYPES = [...] 提取 widget 名 */
function extractWidgetConst(source, constName) {
  const match = source.match(
    new RegExp(`export const ${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`),
  );
  assert(match, `Could not find export const ${constName}`);

  const widgets = [...match[1].matchAll(/"([^"]+)"|'([^']+)'/g)].map(
    ([, doubleQuoted, singleQuoted]) => doubleQuoted ?? singleQuoted,
  );
  assert(widgets.length > 0, `${constName} is empty`);
  return widgets;
}

const mcpWidgets = read(path.join(mcpDir, "src/widgets.ts"));
const mcpWidgetTypes = extractWidgetConst(mcpWidgets, "MCP_ASK_WIDGET_TYPES");

const schemaDoc = JSON.parse(read(path.join(mcpDir, "schemas/schema.json")));
const schemaWidgets = schemaDoc.$defs.WidgetType.enum;

assert(
  setsEqual(schemaWidgets, mcpWidgetTypes),
  `src/widgets.ts drift from schema.json: schema=${sorted(schemaWidgets).join(",")} mcp=${sorted(mcpWidgetTypes).join(",")}`,
);

const webTypes = read(
  path.join(
    nuwaxDir,
    "src/components/business-component/AgentIntervention/types/mcpAskIntervention.ts",
  ),
);
const webWidgets = extractWidgetConst(webTypes, "MCP_ASK_WIDGET_TYPES");

const mobileTypes = read(path.join(mobileDir, "types/intervention.uts"));
const mobileWidgets = extractWidgetConst(mobileTypes, "MCP_ASK_WIDGET_TYPES");

assert(
  setsEqual(schemaWidgets, webWidgets),
  `Web MCP_ASK_WIDGET_TYPES drift from schema.json: schema=${sorted(schemaWidgets).join(",")} web=${sorted(webWidgets).join(",")}`,
);
assert(
  setsEqual(schemaWidgets, mobileWidgets),
  `Mobile MCP_ASK_WIDGET_TYPES drift from schema.json: schema=${sorted(schemaWidgets).join(",")} mobile=${sorted(mobileWidgets).join(",")}`,
);

const webParser = read(
  path.join(
    nuwaxDir,
    "src/components/business-component/AgentIntervention/utils/parseMcpAskSchema.ts",
  ),
);
const mobileParser = read(path.join(mobileDir, "utils/mcpAskSchema.uts"));

assert(
  webParser.includes("MCP_ASK_WIDGET_TYPES"),
  "Web parseMcpAskSchema must use MCP_ASK_WIDGET_TYPES",
);
assert(
  mobileParser.includes("MCP_ASK_WIDGET_TYPES"),
  "Mobile mcpAskSchema must use MCP_ASK_WIDGET_TYPES",
);
assert(
  mobileParser.includes("getJsonSchemaPrimaryType"),
  "Mobile mcpAskSchema must export getJsonSchemaPrimaryType",
);

console.log("Widget contract verification passed.");
console.log(`Widgets (${schemaWidgets.length}): ${sorted(schemaWidgets).join(", ")}`);

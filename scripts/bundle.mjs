// 将 MCP server CLI 打包为自包含的 dist/index.js（内联 @modelcontextprotocol/sdk + zod）。
// node: 内建自动外置；其余 npm 依赖打包进单文件，运行时无需解析 node_modules。
// 库子路径导出（askUserPayload/buildRawInput/widgets + .d.ts）仍由 tsc 产出，供平台侧 import。
import { build } from "esbuild";
import { chmod } from "node:fs/promises";

const outfile = "dist/index.js";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile,
  // 不加 banner shebang：src/index.ts 首行的 shebang 会被 esbuild 原样保留到产物第 1 行，
  // 再用 banner 会产生第 2 行重复 shebang，导致 `node dist/index.js`（ESM）语法错误。
  packages: "bundle", // 内联 npm 依赖（SDK / zod）
  legalComments: "none",
  sourcemap: true, // 产物自带 sourcemap，覆盖 tsc 残留的 index.js.map
  logLevel: "info",
});

await chmod(outfile, 0o755); // bin 直接执行需要可执行位
console.log(`✓ bundled ${outfile} (self-contained CLI)`);

#!/usr/bin/env node
/**
 * 手动触发 npmmirror 同步 npmjs 上的包版本。
 *
 * 使用场景：发布到 registry.npmjs.org 后，国内用户通过 npmmirror 安装可能尚未同步，
 * 运行本脚本可主动触发镜像站拉取最新版本。
 *
 * API 说明（Legacy API，与 cnpm sync 行为一致）：
 *   1. PUT  https://registry-direct.npmmirror.com/{包名}/sync?sync_upstream=true
 *      → 返回 { ok, logId }
 *   2. GET  https://registry-direct.npmmirror.com/{包名}/sync/log/{logId}
 *      → 返回 { ok, syncDone, log, logUrl }，syncDone === true 表示同步完成
 *
 * 注意：必须使用 registry-direct.npmmirror.com（直连源站），
 *       使用 registry.npmmirror.com 可能无法正确创建同步任务。
 *
 * 用法：
 *   npm run sync:npmmirror
 *   node scripts/sync-npmmirror.mjs --name nuwax-ask-question-mcp --version 3.1.0
 *   node scripts/sync-npmmirror.mjs --no-verify
 *   node scripts/sync-npmmirror.mjs --timeout 600000
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** npmmirror 直连源站，用于创建/查询同步任务 */
const NPPMIRROR_DIRECT = "https://registry-direct.npmmirror.com";

/** npmmirror 公开 registry，用于同步完成后校验版本是否可用 */
const NPPMIRROR_REGISTRY = "https://registry.npmmirror.com";

/** 轮询间隔（毫秒） */
const POLL_INTERVAL_MS = 2_000;

/** 默认轮询超时（5 分钟） */
const DEFAULT_TIMEOUT_MS = 300_000;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

/**
 * 解析命令行参数。
 * @returns {{ name?: string, version?: string, verify: boolean, timeoutMs: number }}
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    name: undefined,
    version: undefined,
    verify: true,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--name":
        result.name = args[++i];
        break;
      case "--version":
        result.version = args[++i];
        break;
      case "--no-verify":
        result.verify = false;
        break;
      case "--timeout":
        result.timeoutMs = Number(args[++i]);
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`未知参数: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  if (Number.isNaN(result.timeoutMs) || result.timeoutMs <= 0) {
    console.error("错误: --timeout 必须是正整数（毫秒）");
    process.exit(1);
  }

  return result;
}

/** 打印帮助信息 */
function printHelp() {
  console.log(`
用法: node scripts/sync-npmmirror.mjs [选项]

选项:
  --name <pkg>       包名（默认读取 package.json）
  --version <ver>    要校验的版本（默认读取 package.json）
  --no-verify        同步完成后跳过版本校验
  --timeout <ms>     轮询超时，默认 ${DEFAULT_TIMEOUT_MS}ms
  -h, --help         显示帮助
`);
}

/**
 * 读取项目根目录 package.json。
 * @returns {{ name: string, version: string }}
 */
function readPackageJson() {
  const pkgPath = join(ROOT_DIR, "package.json");
  const raw = readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(raw);

  if (!pkg.name || !pkg.version) {
    throw new Error("package.json 缺少 name 或 version 字段");
  }

  return { name: pkg.name, version: pkg.version };
}

/**
 * 将包名编码为 URL 路径段。
 * scoped 包如 @scope/name 需编码为 @scope%2Fname。
 * @param {string} name
 */
function encodePackageName(name) {
  return encodeURIComponent(name);
}

/**
 * 触发 npmmirror 同步任务。
 * @param {string} packageName
 * @returns {Promise<string>} logId
 */
async function triggerSync(packageName) {
  const encoded = encodePackageName(packageName);
  const url = `${NPPMIRROR_DIRECT}/${encoded}/sync?sync_upstream=true`;

  const res = await fetch(url, { method: "PUT" });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`触发同步失败 (${res.status}): ${body}`);
  }

  const data = await res.json();

  if (!data.ok || !data.logId) {
    throw new Error(`触发同步返回异常: ${JSON.stringify(data)}`);
  }

  return data.logId;
}

/**
 * 查询同步任务状态。
 * @param {string} packageName
 * @param {string} logId
 * @returns {Promise<{ syncDone: boolean, log?: string, logUrl?: string }>}
 */
async function getSyncStatus(packageName, logId) {
  const encoded = encodePackageName(packageName);
  const url = `${NPPMIRROR_DIRECT}/${encoded}/sync/log/${logId}`;

  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`查询同步状态失败 (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * 轮询等待同步完成。
 * @param {string} packageName
 * @param {string} logId
 * @param {number} timeoutMs
 */
async function waitForSync(packageName, logId, timeoutMs) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const status = await getSyncStatus(packageName, logId);

    if (status.syncDone) {
      return status;
    }

    process.stdout.write(".");
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`同步超时（${timeoutMs}ms），请稍后手动查看: https://npmmirror.com/sync/${packageName}`);
}

/**
 * 校验指定版本是否已在 npmmirror 上可用。
 * @param {string} packageName
 * @param {string} version
 */
async function verifyVersion(packageName, version) {
  const encoded = encodePackageName(packageName);
  const url = `${NPPMIRROR_REGISTRY}/${encoded}/${version}`;

  const res = await fetch(url);

  if (res.status === 404) {
    throw new Error(
      `镜像上尚未找到 ${packageName}@${version}，可能同步延迟，请稍后重试或访问 https://npmmirror.com/package/${packageName}`,
    );
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`版本校验请求失败 (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.version ?? version;
}

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 格式化耗时 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

async function main() {
  const cli = parseArgs();
  const pkg = readPackageJson();

  const packageName = cli.name ?? pkg.name;
  const targetVersion = cli.version ?? pkg.version;

  console.log(`📦 包名: ${packageName}`);
  console.log(`📌 目标版本: ${targetVersion}`);
  console.log("🚀 触发 npmmirror 同步...");

  const syncStart = Date.now();
  const logId = await triggerSync(packageName);

  console.log(`   logId: ${logId}`);
  console.log(`   日志: https://npmmirror.com/sync/${packageName}`);
  process.stdout.write("⏳ 等待同步完成");

  const status = await waitForSync(packageName, logId, cli.timeoutMs);

  const elapsed = Date.now() - syncStart;
  console.log(`\n✅ 同步完成 (${formatDuration(elapsed)})`);

  // 同步日志末尾通常包含错误信息，失败时便于排查
  if (status.log) {
    const tail = status.log.trim().split("\n").slice(-3).join("\n");
    if (tail) {
      console.log("📋 同步日志（末尾）:");
      console.log(tail);
    }
  }

  if (!cli.verify) {
    console.log("⏭️  已跳过版本校验 (--no-verify)");
    return;
  }

  console.log("🔍 校验镜像版本...");
  const verified = await verifyVersion(packageName, targetVersion);
  console.log(`✅ npmmirror 已存在 ${packageName}@${verified}`);
  console.log(`   查看: https://npmmirror.com/package/${packageName}`);
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});

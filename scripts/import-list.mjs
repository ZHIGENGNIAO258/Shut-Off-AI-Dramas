/**
 * 把面板「导出名单」得到的 JSON 合并进仓库共享名单。
 *
 * 用法：node scripts/import-list.mjs <导出的 JSON 路径>
 *
 * 处理规则：
 * - 用 core.parseList 做完整校验（format/version/mid/name/confidence/evidence/samples）；
 * - 按面板同一套中文排序（zh-Hans-CN，数字感知）写出，保证 diff 稳定；
 * - updatedAt 沿用导出文件里的时间，缺省时用当前时间；
 * - 只写 list/ai-slop.json，不改动其它文件。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const core = require("../src/core.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "list", "ai-slop.json");
const source = process.argv[2];

if (!source) {
  console.error("用法: node scripts/import-list.mjs <导出的 JSON 路径>");
  process.exit(1);
}

const sourcePath = path.resolve(source);
if (!fs.existsSync(sourcePath)) {
  console.error(`找不到文件: ${sourcePath}`);
  process.exit(1);
}

const raw = fs.readFileSync(sourcePath, "utf8");
const parsed = core.parseList(raw);
if (!parsed.ok) {
  console.error(`名单校验失败: ${parsed.error}`);
  process.exit(1);
}

const data = JSON.parse(raw);
if (Array.isArray(data.entries) && data.entries.length !== parsed.entries.length) {
  console.error("名单存在重复 mid，请先在面板里去重");
  process.exit(1);
}

const byName = (a, b) =>
  a.name.localeCompare(b.name, "zh-Hans-CN", { numeric: true, sensitivity: "base" }) || a.mid - b.mid;
const entries = parsed.entries.slice().sort(byName);

const before = fs.existsSync(target) ? core.parseList(fs.readFileSync(target, "utf8")) : { ok: true, entries: [] };
const beforeMids = new Set(before.ok ? before.entries.map((entry) => entry.mid) : []);
const afterMids = new Set(entries.map((entry) => entry.mid));
const added = entries.filter((entry) => !beforeMids.has(entry.mid)).length;
const removed = before.ok ? before.entries.filter((entry) => !afterMids.has(entry.mid)).length : 0;
const confirmed = entries.filter((entry) => entry.confidence === "confirmed").length;

const output = {
  format: core.FORMAT,
  version: core.LIST_VERSION,
  updatedAt: typeof data.updatedAt === "string" && data.updatedAt ? data.updatedAt : new Date().toISOString(),
  entries: entries
};

fs.writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`);

console.log(`已写入 ${path.relative(root, target)}`);
console.log(`共 ${entries.length} 个账号（人工确认 ${confirmed}，自动识别 ${entries.length - confirmed}）`);
console.log(`相比原文件：新增 ${added}，移除 ${removed}`);
if (removed > 0) {
  console.log("注意：仓库里被移除的条目不会从已同步用户的本地名单中删除（同步只增不删）。");
}

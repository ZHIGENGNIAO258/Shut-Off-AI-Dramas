import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const core = require("../src/core.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "list/ai-slop.json");
const raw = fs.readFileSync(file, "utf8");

let data;
try {
  data = JSON.parse(raw);
} catch (error) {
  console.error(`名单 JSON 解析失败: ${error.message}`);
  process.exit(1);
}

const parsed = core.parseList(data);
if (!parsed.ok) {
  console.error(`名单校验失败: ${parsed.error}`);
  process.exit(1);
}

if (Array.isArray(data.entries) && data.entries.length !== parsed.entries.length) {
  console.error("名单存在重复 mid，请先去重");
  process.exit(1);
}

const confirmed = parsed.entries.filter((entry) => entry.confidence === "confirmed").length;
console.log(
  `名单校验通过: ${parsed.entries.length} 个账号（人工确认 ${confirmed}，自动识别 ${parsed.entries.length - confirmed}）`
);

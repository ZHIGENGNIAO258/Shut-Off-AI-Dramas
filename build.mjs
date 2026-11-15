import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const FILES = [
  "src/core.js",
  "src/surfaces.js",
  "src/api.js",
  "src/relation.js",
  "src/store.js",
  "src/dom.js",
  "src/ui.js",
  "src/main.js"
];

const header = `// ==UserScript==
// @name         B 站 AI 漫剧屏蔽器
// @namespace    https://github.com/ZHIGENGNIAO258/Shut-Off-AI-Dramas
// @version      ${pkg.version}
// @description  按账号名单与规则隐藏 B 站首页 / 搜索 / 动画分区里的 AI 漫剧卡片，名单可导出分享
// @author       ZHIGENGNIAO258
// @license      MIT
// @homepageURL  https://github.com/ZHIGENGNIAO258/Shut-Off-AI-Dramas
// @supportURL   https://github.com/ZHIGENGNIAO258/Shut-Off-AI-Dramas/issues
// @updateURL    https://raw.githubusercontent.com/ZHIGENGNIAO258/Shut-Off-AI-Dramas/main/dist/shut-off-ai-dramas.user.js
// @downloadURL  https://raw.githubusercontent.com/ZHIGENGNIAO258/Shut-Off-AI-Dramas/main/dist/shut-off-ai-dramas.user.js
// @match        https://www.bilibili.com/*
// @match        https://search.bilibili.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at       document-idle
// @noframes
// ==/UserScript==
`;

const css = fs.readFileSync(path.join(root, "src/panel.css"), "utf8");
const parts = FILES.map((file) => {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) throw new Error(`缺少文件: ${file}`);
  return `/* ---- ${file} ---- */\n${fs.readFileSync(full, "utf8").trim()}\n`;
});

const body = `(function () {
  "use strict";
  globalThis.AIS_VERSION = ${JSON.stringify(pkg.version)};
  globalThis.AIS_CSS = ${JSON.stringify(css)};
${parts.join("\n")}
})();
`;

const outDir = path.join(root, "dist");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "shut-off-ai-dramas.user.js");
fs.writeFileSync(outFile, `${header}${body}`, "utf8");
console.log(`built ${path.relative(root, outFile)} v${pkg.version} (${Buffer.byteLength(header + body)} bytes)`);

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builtFile = path.join(root, "dist", "shut-off-ai-dramas.user.js");
if (!fs.existsSync(builtFile)) {
  console.error("dist 不存在，先运行 node build.mjs");
  process.exit(1);
}

function card(mid, name, title, bvid) {
  return `<div class="feed-card"><div class="bili-video-card">
    <a href="//www.bilibili.com/video/${bvid}" class="cover" title="${title}"><h3 class="bili-video-card__info--tit" title="${title}">${title}</h3></a>
    <div class="meta">
      <a class="bili-video-card__info--owner" href="//space.bilibili.com/${mid}"><span class="bili-video-card__info--author">${name}</span></a>
    </div>
  </div></div>`;
}

const cards = [
  card(100, "熊猫小圣AIGC", "《潮尸》第一集", "BV16LxM6sEdo"),
  card(200, "手动号", "普通视频", "BV1aa"),
  card(300, "某频道", "AI短剧《穿越》第1集", "BV1bb"),
  card(400, "普通UP", "周末去看海 vlog", "BV1cc"),
  card(500, "普通UP二", "周末去看海 第1集", "BV1dd"),
  card(600, "完全无关", "随便看看", "BV1ee")
];

const demoHtml = `<!doctype html><html><head><meta charset="utf-8"><title>B 站 AI 漫剧屏蔽器 · 预览</title>
<style>
  body { margin: 0; padding: 24px 32px 80px; background: #f6f7f8; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #18191c; }
  h1 { font-size: 18px; margin: 0 0 18px; }
  .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; max-width: 1100px; }
  .bili-video-card { background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,.06); }
  .bili-video-card .cover { display: block; height: 120px; padding: 14px; box-sizing: border-box; background: linear-gradient(135deg, #dfe3ea, #b9c0ca); color: #444; text-decoration: none; }
  .bili-video-card__info--tit { margin: 0; font-size: 13px; line-height: 1.5; }
  .bili-video-card .meta { padding: 8px 12px 12px; }
  .bili-video-card__info--owner { color: #61666d; text-decoration: none; font-size: 12px; }
</style></head><body>
  <h1>B 站 AI 漫剧屏蔽器 · 界面预览（模拟卡片）</h1>
  <div class="grid">${cards.join("\n")}</div>
</body></html>`;

const seed = {
  schema: 1,
  settings: { autoHideHigh: true, mediumBadge: true, showPlaceholder: false, enrich: false, remoteList: false, listUrl: "" },
  accounts: {
    200: {
      name: "手动号",
      status: "hidden",
      confidence: "manual",
      reasons: ["手动标记"],
      samples: [],
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      source: "local",
      hits: 1
    }
  },
  whitelist: {},
  tombstones: {},
  cache: { sign: {}, tags: {} },
  meta: { listVersion: "", lastSync: 0 }
};

const dom = new JSDOM(demoHtml, {
  url: "https://www.bilibili.com/",
  runScripts: "dangerously",
  pretendToBeVisual: true,
  beforeParse(window) {
    window.GM_getValue = (key, fallback) =>
      key === "ais:data" ? JSON.parse(JSON.stringify(seed)) : fallback;
    window.GM_setValue = () => {};
    window.GM_registerMenuCommand = () => {};
  }
});

dom.window.eval(fs.readFileSync(builtFile, "utf8"));
await new Promise((resolve) => setTimeout(resolve, 120));
dom.window.document.getElementById("ais-fab").click();
await new Promise((resolve) => setTimeout(resolve, 30));

// AIS_DEMO_TAB=settings 可让预览停在设置页（截图用）
const demoTab = process.env.AIS_DEMO_TAB;
if (demoTab) {
  const target = [...dom.window.document.querySelectorAll(".ais-tab")].find((btn) => btn.dataset.tab === demoTab);
  if (target) target.click();
  await new Promise((resolve) => setTimeout(resolve, 30));
}

const outDir = path.join(root, "docs");
fs.mkdirSync(outDir, { recursive: true });
const outFile = process.env.AIS_DEMO_OUT ? path.resolve(process.env.AIS_DEMO_OUT) : path.join(outDir, "demo.html");
fs.writeFileSync(outFile, dom.serialize(), "utf8");
dom.window.close();
console.log(`wrote ${path.relative(root, outFile)}`);

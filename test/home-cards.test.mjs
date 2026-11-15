import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builtFile = path.join(root, "dist", "shut-off-ai-dramas.user.js");

// 首页真实结构：首屏 .feed-card > .bili-feed-card > .bili-video-card，
// Vue 水合/滚动追加的卡片没有 .feed-card 包裹，骨架则是 .bili-video-card 直接当网格单元。
function body({ mid, name, title }) {
  return `
    <div class="bili-video-card is-rcmd">
      <a href="//www.bilibili.com/video/BV${mid}x" title="${title}">
        <div class="bili-video-card__info--tit">${title}</div>
      </a>
      <div class="bili-video-card__info--bottom">
        <a class="bili-video-card__info--owner" href="//space.bilibili.com/${mid}">
          <span class="bili-video-card__info--author">${name}</span>
        </a>
      </div>
    </div>`;
}

function ssrCard(info) {
  return `<div class="feed-card"><div class="bili-feed-card">${body(info)}</div></div>`;
}

function looseCard(info) {
  return `<div class="bili-feed-card">${body(info)}</div>`;
}

const html = `<!doctype html><html><head></head><body>
  <div class="feed2"><div class="container is-version8">
    <div class="recommended-swipe"><div class="recommended-swipe-shim">
      ${body({ mid: 509, name: "轮播号", title: "轮播内容" })}
    </div></div>
    ${ssrCard({ mid: 501, name: "首屏屏蔽号", title: "AI短剧 第一集" })}
    ${looseCard({ mid: 502, name: "滚动屏蔽号", title: "AI漫剧 第二集" })}
    ${looseCard({ mid: 503, name: "普通UP", title: "普通视频" })}
    <div class="bili-video-card"><div class="bili-video-card__skeleton"></div></div>
  </div></div>
</body></html>`;

const hidden = (mid, name) => ({
  name,
  status: "hidden",
  confidence: "manual",
  reasons: ["手动标记"],
  samples: [],
  firstSeen: 1,
  lastSeen: 1,
  source: "local",
  hits: 1
});

const seed = {
  schema: 1,
  settings: { autoHideHigh: true, mediumBadge: true, showPlaceholder: false, enrich: false, remoteList: false, listUrl: "" },
  accounts: {
    501: hidden(501, "首屏屏蔽号"),
    502: hidden(502, "滚动屏蔽号"),
    504: hidden(504, "新追加号")
  },
  whitelist: {},
  tombstones: {},
  cache: { sign: {}, tags: {} },
  meta: {}
};

async function boot(t) {
  if (!fs.existsSync(builtFile)) {
    t.skip("dist 不存在，先运行 node build.mjs");
    return null;
  }
  const code = fs.readFileSync(builtFile, "utf8");
  const dom = new JSDOM(html, {
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
  t.after(() => {
    try {
      dom.window.close();
    } catch (error) {
      /* ignore */
    }
  });
  dom.window.eval(code);
  await new Promise((resolve) => setTimeout(resolve, 150));
  return { dom, doc: dom.window.document };
}

test("首页：首屏 feed-card 与滚动追加的 bili-feed-card 都能隐藏", async (t) => {
  const ctx = await boot(t);
  if (!ctx) return;
  const { doc } = ctx;

  const ssr = doc.querySelector(".feed-card");
  assert.equal(ssr.classList.contains("ais-hidden"), true, "首屏 .feed-card 应隐藏");

  const loose = [...doc.querySelectorAll(".bili-feed-card")].filter((el) => !el.closest(".feed-card"));
  const blockedLoose = loose.find((el) => el.querySelector('a[href*="502"]'));
  const normalLoose = loose.find((el) => el.querySelector('a[href*="503"]'));
  assert.ok(blockedLoose && normalLoose, "应能取到两种无包裹卡片");
  assert.equal(blockedLoose.classList.contains("ais-hidden"), true, "滚动追加的 .bili-feed-card 应隐藏");
  assert.equal(normalLoose.classList.contains("ais-hidden"), false, "普通账号不应隐藏");

  const carousel = doc.querySelector(".recommended-swipe .bili-video-card");
  assert.equal(carousel.classList.contains("ais-hidden"), false, "轮播区卡片不应被隐藏");
  assert.equal(doc.querySelectorAll(".ais-hidden").length, 2, "只应隐藏两张命中卡片");
});

test("首页：滚动后新插入的 bili-feed-card 会被观察器处理", async (t) => {
  const ctx = await boot(t);
  if (!ctx) return;
  const { dom, doc } = ctx;

  const container = doc.querySelector(".container.is-version8");
  const extra = doc.createElement("div");
  extra.className = "bili-feed-card";
  extra.innerHTML = body({ mid: 504, name: "新追加号", title: "AI漫剧 第三集" });
  container.appendChild(extra);

  await new Promise((resolve) => setTimeout(resolve, 180));
  assert.equal(extra.classList.contains("ais-hidden"), true, "动态插入的卡片应被隐藏");
});

test("首页：无包裹卡片也能悬停出现屏蔽按钮并生效", async (t) => {
  const ctx = await boot(t);
  if (!ctx) return;
  const { dom, doc } = ctx;

  const loose = [...doc.querySelectorAll(".bili-feed-card")].find((el) => el.querySelector('a[href*="503"]'));
  const title = loose.querySelector(".bili-video-card__info--tit");
  title.dispatchEvent(new dom.window.MouseEvent("mouseover", { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 40));

  const hover = doc.getElementById("ais-hover");
  assert.equal(hover.hidden, false, "悬停应出现工具条");
  assert.ok(hover.textContent.includes("屏蔽"), "工具条包含屏蔽");

  hover.querySelector(".ais-btn").click();
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(loose.classList.contains("ais-hidden"), true, "点击后应隐藏 .bili-feed-card 单元");
});

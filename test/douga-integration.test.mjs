import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builtFile = path.join(root, "dist", "shut-off-ai-dramas.user.js");

const seed = {
  schema: 1,
  settings: { autoHideHigh: true, mediumBadge: true, showPlaceholder: false, enrich: false, remoteList: false, genreMode: true, listUrl: "" },
  accounts: {},
  whitelist: {},
  tombstones: {},
  cache: { sign: {}, tags: {} },
  meta: {}
};

test("动画分区：悬停按钮能出现并屏蔽 feed-card 包装的卡片", async (t) => {
  if (!fs.existsSync(builtFile)) {
    t.skip("dist 不存在，先运行 node build.mjs");
    return;
  }
  const code = fs.readFileSync(builtFile, "utf8");
  const html = `<!doctype html><html><head></head><body>
    <div class="feed-cards">
      <div class="feed-card">
        <div class="bili-video-card">
          <a href="https://www.bilibili.com/video/BV1L7eY6zEMA">
            <div class="bili-video-card__title" title="普通视频 第1集">普通视频 第1集</div>
          </a>
          <a class="bili-video-card__author" href="https://space.bilibili.com/123456">
            <span>普通UP · 10-24</span>
          </a>
        </div>
      </div>
    </div>
  </body></html>`;

  const dom = new JSDOM(html, {
    url: "https://www.bilibili.com/c/douga/",
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
  await new Promise((resolve) => setTimeout(resolve, 120));

  const doc = dom.window.document;
  const feedCard = doc.querySelector(".feed-card");
  const title = doc.querySelector(".bili-video-card__title");
  const hover = doc.getElementById("ais-hover");

  title.dispatchEvent(new dom.window.MouseEvent("mouseover", { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(hover.hidden, false, "悬停应出现工具条");
  assert.ok(hover.textContent.includes("屏蔽"), "工具条只有屏蔽按钮");

  hover.querySelector(".ais-btn").click();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(feedCard.classList.contains("ais-hidden"), true, "点击屏蔽应隐藏 feed-card");
});

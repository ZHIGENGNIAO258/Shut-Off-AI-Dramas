import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builtFile = path.join(root, "dist", "shut-off-ai-dramas.user.js");

function card({ mid, name, title }) {
  return `
    <div class="feed-card">
      <div class="bili-video-card">
        <a href="//www.bilibili.com/video/BV1xx${mid}" title="${title}">
          <h3 class="bili-video-card__info--tit" title="${title}">${title}</h3>
        </a>
        <div class="bili-video-card__info--bottom">
          <a class="bili-video-card__info--owner" href="//space.bilibili.com/${mid}">
            <span class="bili-video-card__info--author">${name}</span>
          </a>
        </div>
      </div>
    </div>`;
}

const html = `<!doctype html><html><head></head><body>
  <div class="feed2"><div class="container">
    ${card({ mid: 100, name: "熊猫小圣AIGC", title: "《潮尸》第一集" })}
    ${card({ mid: 200, name: "手动号", title: "普通视频" })}
    ${card({ mid: 300, name: "普通 UP", title: "普通视频 第1集" })}
  </div></div>
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
      firstSeen: 1,
      lastSeen: 1,
      source: "local",
      hits: 1
    }
  },
  whitelist: {},
  tombstones: {},
  cache: { sign: {}, tags: {} },
  meta: { listVersion: "", lastSync: 0 }
};

test("构建产物能在主页跑通：规则隐藏、名单隐藏、标记模式", async (t) => {
  if (!fs.existsSync(builtFile)) {
    t.skip("dist 不存在，先运行 node build.mjs");
    return;
  }
  const code = fs.readFileSync(builtFile, "utf8");
  const saved = [];

  const dom = new JSDOM(html, {
    url: "https://www.bilibili.com/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.GM_getValue = (key, fallback) =>
        key === "ais:data" ? JSON.parse(JSON.stringify(seed)) : fallback;
      window.GM_setValue = (key, value) => {
        saved.push({ key, value });
      };
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
  const cards = doc.querySelectorAll(".feed-card");
  assert.equal(cards.length, 3);
  assert.equal(cards[0].classList.contains("ais-hidden"), true, "AIGC 昵称应自动隐藏");
  assert.equal(cards[1].classList.contains("ais-hidden"), true, "名单账号应隐藏");
  assert.equal(cards[2].classList.contains("ais-hidden"), false, "普通视频不应隐藏");

  assert.ok(doc.getElementById("ais-fab"), "悬浮球应注入");
  assert.equal(doc.querySelector("#ais-fab .ais-fab-count").textContent, "2");

  const last = saved[saved.length - 1];
  assert.ok(last && last.value.accounts[100], "自动命中应写入待确认账号");
  assert.equal(last.value.accounts[100].status, "pending");
  assert.equal(last.value.accounts[100].samples.join("|"), "《潮尸》第一集", "应记录视频标题作为样本");

  doc.getElementById("ais-fab").click();
  assert.equal(doc.getElementById("ais-panel").hidden, false, "点击悬浮球应打开面板");

  doc.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "m", bubbles: true }));
  assert.equal(doc.body.classList.contains("ais-marking"), true, "M 键应进入标记模式");

  const target = cards[2].querySelector(".bili-video-card__info--owner");
  target.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
  assert.equal(cards[2].classList.contains("ais-hidden"), true, "标记模式下点击卡片应隐藏该 UP");

  dom.window.close();
});

test("设置面板点击有效：开关能保存，页面新增卡片不会重渲染面板", async (t) => {
  if (!fs.existsSync(builtFile)) {
    t.skip("dist 不存在，先运行 node build.mjs");
    return;
  }
  const code = fs.readFileSync(builtFile, "utf8");
  const saved = [];

  const dom = new JSDOM(html, {
    url: "https://www.bilibili.com/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.GM_getValue = (key, fallback) =>
        key === "ais:data" ? JSON.parse(JSON.stringify(seed)) : fallback;
      window.GM_setValue = (key, value) => saved.push({ key, value });
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
  doc.getElementById("ais-fab").click();
  const tabs = doc.querySelectorAll(".ais-tab");
  tabs[3].click();

  const panelBody = doc.querySelector(".ais-panel-body");
  assert.ok(panelBody.querySelector(".ais-check"), "设置页应渲染开关");
  const firstNode = panelBody.firstElementChild;

  const container = doc.querySelector(".container");
  const extra = doc.createElement("div");
  extra.className = "feed-card";
  extra.innerHTML = card({ mid: 999, name: "普通UP", title: "普通视频" }).trim();
  container.appendChild(extra);
  await new Promise((resolve) => setTimeout(resolve, 120));

  assert.equal(panelBody.firstElementChild, firstNode, "页面变动不应重渲染面板");

  const checkbox = panelBody.querySelector(".ais-check input");
  checkbox.click();
  await new Promise((resolve) => setTimeout(resolve, 30));

  const last = saved[saved.length - 1];
  assert.ok(last, "点击开关应写入存储");
  assert.equal(last.value.settings.autoHideHigh, false);
});

test("search page integration", async (t) => {
  if (!fs.existsSync(builtFile)) {
    t.skip("dist 不存在，先运行 node build.mjs");
    return;
  }
  const code = fs.readFileSync(builtFile, "utf8");
  const searchHtml = `<!doctype html><html><head></head><body>
    <div class="video-list row">
      <div class="col_3">${card({ mid: 400, name: "某频道", title: "AI短剧《穿越》第1集" })}</div>
      <div class="col_3">${card({ mid: 401, name: "普通频道", title: "普通视频" })}</div>
    </div>
  </body></html>`;

  const dom = new JSDOM(searchHtml, {
    url: "https://search.bilibili.com/all?keyword=%E6%BC%AB%E5%89%A7",
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

  const cards = dom.window.document.querySelectorAll(".col_3");
  assert.equal(cards[0].classList.contains("ais-hidden"), true);
  assert.equal(cards[1].classList.contains("ais-hidden"), false);

  dom.window.close();
});



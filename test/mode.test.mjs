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
    ${card({ mid: 200, name: "名单里的号", title: "普通视频 第1集" })}
    ${card({ mid: 300, name: "普通 UP", title: "普通视频" })}
  </div></div>
</body></html>`;

function seed(mode, accounts) {
  return {
    schema: 1,
    settings: {
      mode,
      autoHideHigh: true,
      mediumBadge: true,
      showPlaceholder: false,
      enrich: false,
      remoteList: false,
      listUrl: ""
    },
    accounts: accounts || {},
    whitelist: {},
    tombstones: {},
    cache: { sign: {}, tags: {} },
    meta: {}
  };
}

async function boot(t, data) {
  if (!fs.existsSync(builtFile)) {
    t.skip("dist 不存在，先运行 node build.mjs");
    return null;
  }
  const code = fs.readFileSync(builtFile, "utf8");
  const saved = [];
  const dom = new JSDOM(html, {
    url: "https://www.bilibili.com/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.GM_getValue = (key, fallback) =>
        key === "ais:data" ? JSON.parse(JSON.stringify(data)) : fallback;
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
  await new Promise((resolve) => setTimeout(resolve, 150));
  return { dom, doc: dom.window.document, saved };
}

const listed = {
  200: {
    name: "名单里的号",
    status: "hidden",
    confidence: "manual",
    reasons: ["手动标记"],
    samples: [],
    firstSeen: 1,
    lastSeen: 1,
    source: "local",
    hits: 1
  }
};

test("仅名单模式：规则命中的卡片不再隐藏，也不产生待确认账号", async (t) => {
  const ctx = await boot(t, seed("list", listed));
  if (!ctx) return;
  const { doc, saved } = ctx;

  const cards = doc.querySelectorAll(".feed-card");
  assert.equal(cards[0].classList.contains("ais-hidden"), false, "规则命中的卡片在仅名单模式下不应隐藏");
  assert.equal(cards[1].classList.contains("ais-hidden"), true, "名单里的账号照常隐藏");
  assert.equal(cards[2].classList.contains("ais-hidden"), false, "普通卡片不隐藏");

  const wrotePending = saved.some((item) => item.value && item.value.accounts && item.value.accounts[100]);
  assert.equal(wrotePending, false, "仅名单模式不应写入自动命中的待确认账号");
  assert.equal(doc.querySelector("#ais-fab .ais-fab-count").textContent, "1");
});

test("按规则自动识别模式：规则命中照样隐藏并进入待确认", async (t) => {
  const ctx = await boot(t, seed("rules", listed));
  if (!ctx) return;
  const { doc, saved } = ctx;

  const cards = doc.querySelectorAll(".feed-card");
  assert.equal(cards[0].classList.contains("ais-hidden"), true);
  assert.equal(cards[1].classList.contains("ais-hidden"), true);
  const pending = saved.filter((item) => item.value && item.value.accounts && item.value.accounts[100]);
  assert.ok(pending.length > 0, "应写入待确认账号");
  assert.equal(pending[pending.length - 1].value.accounts[100].status, "pending");
});

test("设置页把屏蔽方式放在最上面，可一键切换且规则开关随之禁用", async (t) => {
  const ctx = await boot(t, seed("rules", listed));
  if (!ctx) return;
  const { doc, saved } = ctx;

  doc.getElementById("ais-fab").click();
  const tabs = doc.querySelectorAll(".ais-tab");
  tabs[3].click();

  const body = doc.querySelector(".ais-panel-body");
  const first = body.firstElementChild;
  assert.ok(first.classList.contains("ais-mode"), "屏蔽方式应是设置页第一块内容");

  const options = body.querySelectorAll(".ais-mode-option");
  assert.equal(options.length, 2);
  assert.equal(options[0].dataset.mode, "rules");
  assert.equal(options[1].dataset.mode, "list");
  assert.equal(body.querySelector(".ais-mode-active").dataset.mode, "rules", "默认选中按规则自动识别");

  const checks = body.querySelectorAll(".ais-check input");
  assert.ok(checks.length >= 5);
  assert.equal([...checks].every((input) => !input.disabled), true, "规则模式下开关可点");

  options[1].click();
  await new Promise((resolve) => setTimeout(resolve, 60));

  const last = saved[saved.length - 1];
  assert.equal(last.value.settings.mode, "list", "切换后应保存 mode=list");
  assert.equal(doc.querySelector(".ais-mode-active").dataset.mode, "list", "选中态应切到仅名单");
  const checksAfter = doc.querySelectorAll(".ais-check input");
  assert.equal([...checksAfter].every((input) => input.disabled), true, "仅名单模式下规则开关禁用");
  assert.equal(doc.querySelectorAll(".feed-card")[0].classList.contains("ais-hidden"), false, "切换后规则命中的卡片恢复显示");
  assert.equal(doc.querySelectorAll(".feed-card")[1].classList.contains("ais-hidden"), true, "名单里的账号仍隐藏");

  tabs[0].click();
  assert.ok(doc.querySelector(".ais-mode-tag").textContent.includes("仅名单"), "本页状态应标注当前模式");
  assert.ok(doc.querySelector(".ais-panel-foot").textContent.includes("仅名单"), "页脚也应提示仅名单模式");
});

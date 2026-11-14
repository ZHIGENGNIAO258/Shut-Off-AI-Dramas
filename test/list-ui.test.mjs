import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builtFile = path.join(root, "dist", "shut-off-ai-dramas.user.js");

function account(name, status, extra) {
  return {
    name,
    status,
    confidence: status === "hidden" ? "manual" : "auto",
    reasons: status === "hidden" ? ["手动标记"] : ["标题含 AI 标识"],
    samples: extra && extra.samples ? extra.samples : [],
    firstSeen: 1,
    lastSeen: (extra && extra.lastSeen) || 1,
    source: "local",
    hits: 1
  };
}

function makeSeed() {
  const accounts = {};
  for (let i = 1; i <= 35; i += 1) {
    const mid = 1000 + i;
    accounts[mid] = account("测试号 " + String(i).padStart(2, "0"), "hidden", { lastSeen: 1000 - i });
  }
  accounts[5000] = account("熊猫小圣AIGC", "pending", {
    samples: ["《潮尸》第一集：开局就领盒饭", "《潮尸》第二集"]
  });
  accounts[5001] = account("旧版本命中的号", "pending", { samples: [] });
  return {
    schema: 1,
    settings: {
      autoHideHigh: true,
      mediumBadge: true,
      showPlaceholder: false,
      enrich: false,
      remoteList: false,
      genreMode: true,
      listUrl: ""
    },
    accounts,
    whitelist: {},
    tombstones: {},
    cache: { sign: {}, tags: {} },
    meta: { listVersion: "", lastSync: 0 }
  };
}

async function boot(seed) {
  const code = fs.readFileSync(builtFile, "utf8");
  const saved = [];
  const dom = new JSDOM("<!doctype html><html><head></head><body><div class='feed2'></div></body></html>", {
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
  dom.window.eval(code);
  await new Promise((resolve) => setTimeout(resolve, 120));
  const doc = dom.window.document;
  doc.getElementById("ais-fab").click();
  return { dom, doc, saved };
}

function openTab(doc, name) {
  doc.querySelector('.ais-tab[data-tab="' + name + '"]').click();
}

function titles(doc) {
  return [...doc.querySelectorAll(".ais-list-rows .ais-row-title")].map((el) => el.textContent);
}

test("名单页：按名称排序 + 搜索 + 分页", async (t) => {
  if (!fs.existsSync(builtFile)) {
    t.skip("dist 不存在，先运行 node build.mjs");
    return;
  }
  const { dom, doc } = await boot(makeSeed());
  t.after(() => {
    try {
      dom.window.close();
    } catch (error) {
      /* ignore */
    }
  });

  openTab(doc, "list");
  const rows = titles(doc);
  assert.equal(rows.length, 30, "第一页 30 条");
  assert.equal(rows[0], "测试号 01", "应按名称排序，而不是按最近命中");
  assert.equal(doc.querySelector(".ais-pager-info").textContent.includes("/ 2"), true, "35 条应分 2 页");

  // 翻页
  doc.querySelectorAll(".ais-pager .ais-btn")[1].click();
  assert.equal(doc.querySelector(".ais-pager-info").textContent.includes("2 / 2"), true);
  assert.equal(titles(doc).length, 5, "第二页 5 条");

  // 搜索昵称
  const search = doc.querySelector(".ais-list-tools input");
  search.value = "测试号 3";
  search.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  const filtered = titles(doc);
  assert.deepEqual(filtered, ["测试号 30", "测试号 31", "测试号 32", "测试号 33", "测试号 34", "测试号 35"]);
  assert.equal(doc.querySelector(".ais-pager-info").textContent.includes("共 6 个"), true);

  // 搜索 mid
  search.value = "1005";
  search.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  assert.deepEqual(titles(doc), ["测试号 05"]);
});

test("名单页：手动添加 mid / 空间链接", async (t) => {
  if (!fs.existsSync(builtFile)) {
    t.skip("dist 不存在，先运行 node build.mjs");
    return;
  }
  const { dom, doc, saved } = await boot(makeSeed());
  t.after(() => {
    try {
      dom.window.close();
    } catch (error) {
      /* ignore */
    }
  });

  openTab(doc, "list");
  const inputs = doc.querySelectorAll(".ais-add-row input");
  assert.equal(inputs.length, 2);
  inputs[0].value = "https://space.bilibili.com/98765";
  inputs[1].value = "手动加的号";
  doc.querySelector(".ais-add-row .ais-btn-primary").click();
  await new Promise((resolve) => setTimeout(resolve, 30));

  const last = saved[saved.length - 1];
  assert.ok(last, "应写入存储");
  assert.equal(last.value.accounts[98765].status, "hidden");
  assert.equal(last.value.accounts[98765].name, "手动加的号");
  assert.equal(last.value.accounts[98765].confidence, "manual");

  const search = doc.querySelector(".ais-list-tools input");
  search.value = "手动加的号";
  search.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  assert.deepEqual(titles(doc), ["手动加的号"]);

  // 重复 mid 应提示且不新增（面板重渲染后要重新取输入框）
  const again = doc.querySelectorAll(".ais-add-row input");
  again[0].value = "98765";
  again[1].value = "";
  doc.querySelector(".ais-add-row .ais-btn-primary").click();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(doc.querySelector(".ais-toast").textContent.includes("已在名单"), true);
});

test("待确认页：显示 mid 和视频标题", async (t) => {
  if (!fs.existsSync(builtFile)) {
    t.skip("dist 不存在，先运行 node build.mjs");
    return;
  }
  const { dom, doc } = await boot(makeSeed());
  t.after(() => {
    try {
      dom.window.close();
    } catch (error) {
      /* ignore */
    }
  });

  openTab(doc, "pending");
  const sub = doc.querySelector(".ais-row-sub").textContent;
  assert.equal(sub.includes("mid 5000"), true, "应显示作者 mid");
  const samples = [...doc.querySelectorAll(".ais-row-samples .ais-sample")].map((el) => el.textContent);
  assert.equal(samples.length, 2, "最多显示两条视频标题");
  assert.equal(samples[0].includes("潮尸"), true, "应显示视频标题");
  assert.equal(
    doc.querySelector(".ais-sample-empty").textContent.includes("暂无标题样本"),
    true,
    "没有样本的旧账号要给出占位提示"
  );
  assert.match(doc.querySelector(".ais-panel-foot").textContent, /v\d+\.\d+\.\d+/, "页脚应显示版本号");
});

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

async function boot(seed, options) {
  const code = fs.readFileSync(builtFile, "utf8");
  const saved = [];
  const opts = options || {};
  const dom = new JSDOM("<!doctype html><html><head></head><body><div class='feed2'></div></body></html>", {
    url: "https://www.bilibili.com/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.GM_getValue = (key, fallback) =>
        key === "ais:data" ? JSON.parse(JSON.stringify(seed)) : fallback;
      window.GM_setValue = (key, value) => saved.push({ key, value });
      window.GM_registerMenuCommand = () => {};
      window.fetch = () =>
        Promise.resolve({
          text: () => Promise.resolve(opts.fetchBody || '{"code":0}')
        });
    }
  });
  dom.window.document.cookie = "bili_jct=test-token";
  dom.window.document.cookie = "DedeUserID=1";
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

function rowByTitle(doc, name) {
  return [...doc.querySelectorAll(".ais-list-rows .ais-row")].find(
    (row) => row.querySelector(".ais-row-title").textContent === name
  );
}

test("名单页：显示拉黑字段，支持单个拉黑与批量入口", async (t) => {
  if (!fs.existsSync(builtFile)) {
    t.skip("dist 不存在，先运行 node build.mjs");
    return;
  }
  const seed = makeSeed();
  seed.accounts[1001].blocked = true;
  seed.accounts[1001].blockedAt = 123;
  const { dom, doc, saved } = await boot(seed);
  t.after(() => {
    try {
      dom.window.close();
    } catch (error) {
      /* ignore */
    }
  });

  openTab(doc, "list");
  assert.equal(rowByTitle(doc, "测试号 01").querySelector(".ais-row-sub").textContent.includes("已拉黑"), true);
  assert.equal(rowByTitle(doc, "测试号 02").querySelector(".ais-row-sub").textContent.includes("未拉黑"), true);

  rowByTitle(doc, "测试号 02").querySelector(".ais-btn-danger").click();
  await new Promise((resolve) => setTimeout(resolve, 80));

  const last = saved[saved.length - 1];
  assert.equal(last.value.accounts[1002].blocked, true, "拉黑成功后写入本地");
  assert.equal(rowByTitle(doc, "测试号 02").querySelector(".ais-row-sub").textContent.includes("已拉黑"), true);
  assert.equal(saved[saved.length - 1].value.accounts[1002].blocked, true);

  const batchButton = [...doc.querySelectorAll(".ais-batch-row .ais-btn")][0];
  assert.match(batchButton.textContent, /批量拉黑未拉黑账号（33）/);
  batchButton.click();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(doc.querySelector(".ais-modal").hidden, false);
  assert.match(doc.querySelector(".ais-modal-body").textContent, /将拉黑 33 个未拉黑账号/);

  const cancel = [...doc.querySelectorAll(".ais-modal-foot .ais-btn")].find((btn) => btn.textContent === "取消");
  cancel.click();
});


test("批量拉黑：运行中弹窗不会被误关，停止后才关闭", async (t) => {
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
  const tick = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  openTab(doc, "list");
  doc.querySelector(".ais-batch-row .ais-btn").click();
  await tick(30);
  const start = [...doc.querySelectorAll(".ais-modal-foot .ais-btn")].find((btn) => btn.textContent === "开始拉黑");
  assert.ok(start, "应有开始拉黑按钮");
  start.click();
  await tick(150);

  const modal = doc.querySelector(".ais-modal");
  assert.equal(modal.hidden, false);
  assert.equal(doc.querySelector(".ais-modal-head .ais-icon-btn").style.display, "none", "运行中隐藏关闭按钮");

  // 点击遮罩不应关闭
  modal.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  assert.equal(modal.hidden, false, "点遮罩不能关闭");
  // Esc 不应关闭
  doc.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(modal.hidden, false, "Esc 不能关闭");

  // 运行中再次点批量拉黑不会新开进程
  doc.querySelector(".ais-batch-row .ais-btn").click();
  await tick(20);
  assert.equal(doc.querySelector(".ais-toast").textContent.includes("已有批量拉黑任务"), true);

  const stop = [...doc.querySelectorAll(".ais-modal-foot .ais-btn")].find((btn) => btn.textContent === "停止拉黑");
  assert.ok(stop, "应有停止按钮");
  stop.click();
  assert.equal(stop.disabled, true, "停止按钮点击后禁用");
  await tick(2300);
  assert.equal(modal.hidden, true, "停止后弹窗关闭");
});

import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("../src/core.js");
const storeApi = require("../src/store.js");

function makeStore() {
  const memory = new Map();
  return storeApi.createStore({
    key: "ais:test",
    getValue: (key, fallback) => (memory.has(key) ? memory.get(key) : fallback),
    setValue: (key, value) => {
      memory.set(key, value);
    }
  });
}

test("自动命中两次后账号转为隐藏", () => {
  const store = makeStore();
  const first = store.noteAutoHit(100, { name: "AIGC 频道", reasons: ["昵称含 AI 标识"], sample: "第1集" });
  assert.equal(first.status, "pending");
  assert.equal(first.hits, 1);

  const second = store.noteAutoHit(100, { name: "AIGC 频道", reasons: ["标题含 AI 标识"], sample: "第2集" });
  assert.equal(second.status, "hidden");
  assert.equal(second.hits, 2);
  assert.ok(store.getAccount(100));
});

test("自动命中超过 30 天后重新计数", () => {
  const store = makeStore();
  store.noteAutoHit(900, { name: "某号" });
  store.getAccount(900).firstSeen = Date.now() - 31 * 24 * 60 * 60 * 1000;
  const second = store.noteAutoHit(900, { name: "某号" });
  assert.equal(second.hits, 1);
  assert.equal(second.status, "pending");
});

test("手动标记可撤销", () => {
  const store = makeStore();
  const previous = store.upsertManual(200, { name: "某短剧号", reason: "手动标记", sample: "第1集" });
  assert.equal(previous, null);
  assert.equal(store.getAccount(200).confidence, "manual");

  store.restoreAccount(200, previous);
  assert.equal(store.getAccount(200), null);
});

test("误伤会加入白名单与墓碑", () => {
  const store = makeStore();
  store.upsertManual(300, { name: "误伤号" });
  store.dismissAccount(300);
  assert.equal(store.getAccount(300), null);
  assert.equal(store.isWhitelisted(300), true);
  assert.ok(store.data.tombstones[300] > 0);
});

test("确认待定账号后进入名单", () => {
  const store = makeStore();
  store.noteAutoHit(400, { name: "某号", reasons: ["标签:AI影视片场"] });
  assert.equal(store.confirmAccount(400), true);
  assert.equal(store.getAccount(400).status, "hidden");
  assert.equal(store.getAccount(400).confidence, "confirmed");
});

test("导入名单时跳过墓碑与重复 mid", () => {
  const store = makeStore();
  store.upsertManual(500, { name: "已有号" });
  const entries = [
    { mid: 500, name: "已有号", confidence: "confirmed", evidence: [], samples: [] },
    { mid: 501, name: "新号", confidence: "confirmed", evidence: ["标签:AI"], samples: [] }
  ];
  const added = store.applyImport(entries, false);
  assert.equal(added, 1);
  assert.ok(store.getAccount(501));
});

test("导入预览区分人工与自动条目", () => {
  const store = makeStore();
  const preview = store.previewImport({
    format: "bili-ai-slop",
    version: 1,
    entries: [
      { mid: 1, name: "a", confidence: "confirmed" },
      { mid: 2, name: "b", confidence: "auto" }
    ]
  });
  assert.equal(preview.ok, true);
  assert.equal(preview.total, 2);
  assert.equal(preview.confirmed, 1);
  assert.equal(preview.auto, 1);
});

test("导出只包含已隐藏账号", () => {
  const store = makeStore();
  store.upsertManual(600, { name: "手动号" });
  store.noteAutoHit(601, { name: "待定号", reasons: ["昵称含 AI 标识"] });
  const list = store.exportList({ includeAuto: true });
  assert.deepEqual(
    list.entries.map((entry) => entry.mid),
    [600]
  );
});

test("设置只接受已知键与正确类型", () => {
  const store = makeStore();
  assert.equal(store.setSetting("autoHideHigh", false), true);
  assert.equal(store.settings().autoHideHigh, false);
  assert.equal(store.setSetting("nope", true), false);
  assert.equal(store.setSetting("listUrl", 123), false);
});

test("缓存读写带过期判断", () => {
  const store = makeStore();
  store.data.cache.sign[700] = { text: "AI 创作者", ts: Date.now() };
  store.data.cache.tags["BV1xx"] = { list: ["AI影视片场"], ts: Date.now() };
  assert.equal(store.getSignCache(700), "AI 创作者");
  assert.deepEqual(store.getTagsCache("BV1xx"), ["AI影视片场"]);

  store.data.cache.sign[701] = { text: "旧", ts: Date.now() - 8 * 24 * 60 * 60 * 1000 };
  assert.equal(store.getSignCache(701), null);
});

test("标签缓存可持久化", () => {
  const memory = new Map();
  const options = {
    key: "ais:cache",
    getValue: (key, fallback) => (memory.has(key) ? memory.get(key) : fallback),
    setValue: (key, value) => memory.set(key, value)
  };
  const first = storeApi.createStore(options);
  first.data.cache.tags["BV1a"] = { list: ["AI影视片场"], ts: Date.now() };
  first.save();

  const second = storeApi.createStore(options);
  assert.deepEqual(second.getTagsCache("BV1a"), ["AI影视片场"]);
});

test("数据可持久化到同一个存储", () => {
  const memory = new Map();
  const options = {
    key: "ais:persist",
    getValue: (key, fallback) => (memory.has(key) ? memory.get(key) : fallback),
    setValue: (key, value) => memory.set(key, value)
  };
  const first = storeApi.createStore(options);
  first.upsertManual(800, { name: "持久号" });

  const second = storeApi.createStore(options);
  assert.ok(second.getAccount(800));
  assert.equal(second.getAccount(800).name, "持久号");
});

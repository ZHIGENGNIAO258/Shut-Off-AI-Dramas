import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const core = require("../src/core.js");

test("昵称含 AIGC 直接判高置信", () => {
  const result = core.scoreCard({ name: "熊猫小圣AIGC", title: "《潮尸》第一集" });
  assert.equal(result.confidence, "high");
  assert.ok(result.score >= 4);
});

test("标题明确写 AI 短剧 + 连载判高置信", () => {
  const result = core.scoreCard({ name: "某动画频道", title: "【一口气看完】AI短剧《穿越》第1集" });
  assert.equal(result.confidence, "high");
  assert.equal(result.vetoed, false);
});

test("教程类被硬否决", () => {
  const result = core.scoreCard({ name: "AI 工具人", title: "AI漫剧制作教程：从零开始" });
  assert.equal(result.vetoed, true);
  assert.equal(result.confidence, "none");
  assert.equal(result.score, 0);
});

test("连续剧集标题只到中置信，不自动隐藏", () => {
  const result = core.scoreCard({ name: "某频道", title: "狼皇归来 再起风云 第5集" });
  assert.equal(result.confidence, "medium");
  assert.equal(result.score, 3);
});

test("动漫类账号名 + 剧集推到高置信", () => {
  const result = core.scoreCard({ name: "太白雪动漫", title: "《天师》第1-4季" });
  assert.equal(result.confidence, "high");
});

test("解析/指南等词不再无条件否决", () => {
  const result = core.scoreCard({ name: "某频道", title: "【1-4季】末世选择从解析神明开始成神" });
  assert.equal(result.vetoed, false);
});

test("AI 技术解析类教程仍被否决", () => {
  const result = core.scoreCard({ name: "某频道", title: "AI视频技术解析：从零开始" });
  assert.equal(result.vetoed, true);
});

test("标签 AI影视片场 + 体裁判高置信", () => {
  const result = core.scoreCard({ name: "某频道", title: "《诡域镇神》第2集", tags: ["AI影视片场"] });
  assert.equal(result.confidence, "high");
  assert.ok(result.reasons.some((reason) => reason.includes("标签")));
});

test("UP 简介自报 AI + 体裁判高置信", () => {
  const result = core.scoreCard({
    name: "某频道",
    title: "《大周仙吏》第1集",
    sign: "一名热爱钻研的AI创作者"
  });
  assert.equal(result.confidence, "high");
});

test("软负向：AI 标题 + 影视解说被降级", () => {
  const result = core.scoreCard({ name: "某频道", title: "AI短剧 第1集 影视解说" });
  assert.equal(result.confidence, "medium");
  assert.equal(result.score, 3);
});

test("同 UP 密度会推到高置信", () => {
  const result = core.scoreCard({ name: "某频道", title: "漫剧 第1集", density: 3 });
  assert.equal(result.score, 4);
  assert.equal(result.confidence, "high");
});

test("关闭漫剧赛道模式后只剩 AI 信号", () => {
  const result = core.scoreCard({ name: "某剧场", title: "真彩票 第2集", genreMode: false });
  assert.equal(result.score, 1);
  assert.equal(result.confidence, "none");
});

test("漫剧搜索页上下文会把剧场号推到高置信", () => {
  const result = core.scoreCard({
    name: "九州剧场",
    title: "《天价账单，全班买单》完整版",
    context: "漫剧"
  });
  assert.equal(result.confidence, "high");
});

test("官方番剧账号不被误伤", () => {
  const result = core.scoreCard({ name: "哔哩哔哩番剧", title: "《凡人修仙传》第120集" });
  assert.equal(result.confidence, "none");
  assert.equal(result.score, 0);
});

test("账号名含「漫馆」按赛道账号处理", () => {
  const result = core.scoreCard({ name: "某某漫馆", title: "《天价账单》完整版" });
  assert.equal(result.confidence, "high");
  assert.ok(result.reasons.some((reason) => reason.includes("剧场/短剧/漫剧")));
});

test("解说/剪辑类账号被负向压回", () => {
  const result = core.scoreCard({ name: "某剧场", title: "第1集 解说" });
  assert.ok(result.score < 4);
  assert.equal(result.confidence, "medium");
});

test("parseList 接受合法名单", () => {
  const parsed = core.parseList({
    format: "bili-ai-slop",
    version: 1,
    entries: [
      {
        mid: 354399065,
        name: "熊猫小圣AIGC",
        confidence: "confirmed",
        evidence: ["昵称含 AIGC"],
        samples: ["《潮尸》第一集"],
        addedAt: "2026-11-14"
      }
    ]
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.entries.length, 1);
});

test("parseList 拒绝非法 mid / confidence / 版本", () => {
  const base = { format: "bili-ai-slop", version: 1, entries: [] };
  assert.equal(core.parseList({ ...base, entries: [{ mid: "abc", name: "x", confidence: "confirmed" }] }).ok, false);
  assert.equal(core.parseList({ ...base, entries: [{ mid: 1, name: "x", confidence: "maybe" }] }).ok, false);
  assert.equal(core.parseList({ ...base, version: 2 }).ok, false);
  assert.equal(core.parseList({ format: "other", version: 1, entries: [] }).ok, false);
});

test("parseList 拒绝超长证据与重复条目", () => {
  const entry = {
    mid: 1,
    name: "x",
    confidence: "confirmed",
    evidence: ["a", "b", "c", "d", "e", "f"]
  };
  assert.equal(core.parseList({ format: "bili-ai-slop", version: 1, entries: [entry] }).ok, false);

  const parsed = core.parseList({
    format: "bili-ai-slop",
    version: 1,
    entries: [
      { mid: 1, name: "a", confidence: "confirmed" },
      { mid: 1, name: "b", confidence: "confirmed" }
    ]
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.entries.length, 1);
});

test("buildList 默认不导出自动识别条目", () => {
  const accounts = {
    1: { name: "手动号", status: "hidden", confidence: "manual", reasons: ["手动标记"], firstSeen: 0 },
    2: { name: "自动号", status: "hidden", confidence: "auto", reasons: ["昵称含 AI 标识"], firstSeen: 0 },
    3: { name: "待定号", status: "pending", confidence: "auto", reasons: [] }
  };
  const list = core.buildList(accounts);
  assert.equal(list.format, "bili-ai-slop");
  assert.deepEqual(
    list.entries.map((entry) => entry.mid),
    [1]
  );
  const withAuto = core.buildList(accounts, { includeAuto: true });
  assert.deepEqual(
    withAuto.entries.map((entry) => entry.mid),
    [1, 2]
  );
});

test("mergeAccounts 跳过已存在、墓碑与自动条目", () => {
  const entry = { mid: 10, name: "x", confidence: "confirmed", evidence: [], samples: [] };
  assert.equal(core.mergeAccounts({}, [entry], {}).added.length, 1);
  assert.equal(core.mergeAccounts({ 10: { status: "hidden" } }, [entry], {}).added.length, 0);
  assert.equal(
    core.mergeAccounts({}, [entry], { tombstones: { 10: 1000 }, now: 1000 + core.TOMBSTONE_TTL - 1 }).added.length,
    0
  );
  assert.equal(
    core.mergeAccounts({}, [entry], { tombstones: { 10: 1000 }, now: 1000 + core.TOMBSTONE_TTL + 1 }).added.length,
    1
  );
  assert.equal(core.mergeAccounts({}, [{ ...entry, confidence: "auto" }], {}).added.length, 0);
});

test("normalizeData 丢弃脏数据并生成默认设置", () => {
  const data = core.normalizeData({
    settings: { autoHideHigh: false, bogus: true, listUrl: 123 },
    accounts: {
      123: { status: "hidden", confidence: "auto", name: "ok" },
      bad: { status: "hidden" },
      "-1": { status: "hidden" }
    },
    whitelist: { 9: 5 },
    tombstones: { 8: Date.now() }
  });
  assert.equal(data.settings.autoHideHigh, false);
  assert.equal(data.settings.mediumBadge, true);
  assert.equal(data.settings.listUrl, "");
  assert.ok(data.accounts[123]);
  assert.equal(data.accounts.bad, undefined);
  assert.equal(data.accounts[-1], undefined);
  assert.equal(data.whitelist[9], 5);
  assert.ok(data.tombstones[8]);
});

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

test("普通单集不再白送 3 分：第5集只算弱连载", () => {
  const result = core.scoreCard({ name: "某频道", title: "狼皇归来 再起风云 第5集" });
  assert.equal(result.score, 1);
  assert.equal(result.confidence, "none");
  assert.ok(result.reasons.includes("标题含集数/合集"));
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

test("泛 AI 内容没有漫剧/短剧特征时只到中置信", () => {
  const result = core.scoreCard({
    name: "AI全民制作人",
    title: "我用 AI 做了个动画短片，全流程展示",
    tags: ["AI"]
  });
  assert.ok(result.score >= 4, "分数仍然很高");
  assert.equal(result.confidence, "medium", "缺少体裁特征时不能自动隐藏");
  assert.equal(result.capped, true);
  assert.ok(result.reasons.some((reason) => reason.includes("缺少漫剧/短剧特征")));
});

test("AI 剧集类（剧集/上集）仍然判高置信", () => {
  const result = core.scoreCard({ name: "咩咩是个迷", title: "AI剧集《出马仙镇东北》上集【AI全民制作人】" });
  assert.equal(result.confidence, "high");
  assert.equal(result.capped, false);
});

test("AI 标题 + 普通单集仍不足以自动隐藏（AI 活动/短片系列）", () => {
  const result = core.scoreCard({ name: "AI全民制作人", title: "我用 AI 做的动画 第1集" });
  assert.ok(result.score >= 4);
  assert.equal(result.confidence, "medium");
  assert.equal(result.capped, true);
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
  assert.equal(result.score, 0);
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
  assert.equal(result.confidence, "none");
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

test("mergeAccounts 把待确认的自动账号转正，但不覆盖本地人工记录", () => {
  const entry = { mid: 20, name: "x", confidence: "confirmed", evidence: ["标签:AI"], samples: ["样本标题"] };
  const pending = { 20: { name: "x", status: "pending", confidence: "auto", reasons: [], samples: [] } };
  const merged = core.mergeAccounts(pending, [entry], {});
  assert.equal(merged.added.length, 0);
  assert.deepEqual(merged.upgraded, [20]);
  assert.equal(merged.accounts[20].status, "hidden");
  assert.equal(merged.accounts[20].confidence, "confirmed");
  assert.deepEqual(merged.accounts[20].reasons, ["标签:AI"]);
  assert.deepEqual(merged.accounts[20].samples, ["样本标题"]);

  const manual = { 21: { name: "y", status: "hidden", confidence: "manual", reasons: ["手动标记"], samples: [] } };
  const untouched = core.mergeAccounts(manual, [{ ...entry, mid: 21 }], {});
  assert.equal(untouched.upgraded.length, 0);
  assert.deepEqual(untouched.accounts[21].reasons, ["手动标记"]);
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
  assert.equal(data.settings.listUrl, core.DEFAULT_LIST_URL);
  assert.ok(data.accounts[123]);
  assert.equal(data.accounts.bad, undefined);
  assert.equal(data.accounts[-1], undefined);
  assert.equal(data.whitelist[9], 5);
  assert.ok(data.tombstones[8]);
});

test("cleanName 去掉各种相对时间后缀并用于存储与名单解析", () => {
  assert.equal(core.cleanName("小强凌凌柒 · 22小时前"), "小强凌凌柒");
  assert.equal(core.cleanName("紙松烤肉王 · 昨天"), "紙松烤肉王");
  assert.equal(core.cleanName("某UP · 3分钟前"), "某UP");
  assert.equal(core.cleanName("某UP · 2025-11-14"), "某UP");
  assert.equal(core.cleanName("某UP · 11-14"), "某UP");
  assert.equal(core.cleanName("普通名字"), "普通名字");

  const account = core.normalizeAccount({ name: "金屿动漫 · 10小时前", status: "hidden" });
  assert.equal(account.name, "金屿动漫");
  const parsed = core.parseList({
    format: "bili-ai-slop",
    version: 1,
    entries: [{ mid: 1, name: "阿洛漫剧 · 23小时前", confidence: "confirmed" }]
  });
  assert.equal(parsed.entries[0].name, "阿洛漫剧");
});

test("报告里的误判账号不会被自动隐藏", () => {
  const falsePositives = [
    ["崩坏星穹铁道", "「乐子神智取米哈游」第二话 | 面试"],
    ["高司令-速凌电竞", "【速凌宇宙】第二十七集：决战前夕！零号大坝有点太热闹了..."],
    ["夏日幻听MCE", "【2027年4月/芳文社】摇曳露营 第四季 正式PV【MCE汉化组】"],
    ["月影同学呀", "韩立才是关键棋子！紫灵找韩立为了什么？【凡人修仙传】199集杂谈解析"],
    ["帝都狗小黑", "【废渊战鬼】第174话：路德大战布恩杜斯！竟然召唤出斑兽？！"],
    ["不会就问TALK", "付鹏：AI让效率翻十倍，为什么AI漫剧开始亏钱了？"],
    ["阿D逼逼叨", 'AI漫剧是2026年最大的"普通人陷阱"'],
    ["赛博小doro", "从夯到拉锐评男生最喜欢的ai漫剧！"],
    ["魔法少女春春酱 · 6小时前", "提欧奥特曼 第18集"],
    ["WALNUT-核桃 · 8小时前", "【核桃汇总】令和假面骑士 主骑 冬季剧场版形态 变身必杀 把玩合集"]
  ];
  for (const [name, title] of falsePositives) {
    const result = core.scoreCard({ name, title, density: 2 });
    assert.notEqual(result.confidence, "high", name + " 不应被判高置信：" + result.reasons.join("|"));
  }
});

test("报告保留的真漫剧账号仍然判高置信", () => {
  const positives = [
    ["OK新番漫剧", "【第1-6季】人人看不起的摸鱼住院医，随手救回绝症患者"],
    ["太白雪动漫", "【第1-4季】劳资变成女人之后，站着都能抢朋友的活儿！"],
    ["亿点点漫剧馆", "我昨天就已经辞职了，公司产线停了跟我有什么关系？"],
    ["咩咩是个迷", "AI剧集《出马仙镇东北》上集【AI全民制作人】"],
    ["xthdrv55179", "【1+5季】房术大全 一口气追完大结局，高清无雾，未删减原版"]
  ];
  for (const [name, title] of positives) {
    assert.equal(core.scoreCard({ name, title, context: "漫剧" }).confidence, "high", name + " 应判高置信");
  }
});

test("拉黑字段会被归一化保留，旧数据默认未拉黑", () => {
  const blocked = core.normalizeAccount({ status: "hidden", blocked: true, blockedAt: 12345 });
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.blockedAt, 12345);
  const legacy = core.normalizeAccount({ status: "hidden" });
  assert.equal(legacy.blocked, false);
  assert.equal(legacy.blockedAt, 0);
  const remote = core.mergeAccounts({}, [{ mid: 11, name: "x", confidence: "confirmed", evidence: [], samples: [] }], {});
  assert.equal(remote.accounts[11].blocked, false);
});

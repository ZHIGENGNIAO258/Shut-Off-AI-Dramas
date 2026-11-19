import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const core = require("../src/core.js");
const storeApi = require("../src/store.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const listFile = path.join(root, "list", "ai-slop.json");

function makeStore(seed) {
  const mem = new Map();
  if (seed) mem.set("ais:data", JSON.stringify(seed));
  return storeApi.createStore({
    getValue: (key) => mem.get(key),
    setValue: (key, value) => mem.set(key, value)
  });
}

test("仓库订阅名单：全部为人工确认，默认地址指向仓库", () => {
  const raw = JSON.parse(fs.readFileSync(listFile, "utf8"));
  const parsed = core.parseList(fs.readFileSync(listFile, "utf8"));
  assert.equal(parsed.ok, true, parsed.error);
  assert.equal(parsed.entries.length, raw.entries.length, "不能有重复或非法条目");
  assert.ok(parsed.entries.length >= 500, "共享名单应保持一定规模");
  assert.equal(
    parsed.entries.filter((entry) => entry.confidence === "confirmed").length,
    parsed.entries.length,
    "共享名单只收人工确认条目"
  );
  assert.equal(
    core.DEFAULTS.listUrl,
    "https://raw.githubusercontent.com/ZHIGENGNIAO258/Shut-Off-AI-Dramas/main/list/ai-slop.json"
  );
});

test("同步远程名单：只新增/转正，不删除本地账号、不改设置、不影响本地规则", () => {
  const raw = JSON.parse(fs.readFileSync(listFile, "utf8"));
  const parsed = core.parseList(fs.readFileSync(listFile, "utf8"));
  const total = parsed.entries.length;
  const target = parsed.entries[0];
  const pendingMid = parsed.entries[1].mid;

  const store = makeStore({
    schema: 1,
    settings: { autoHideHigh: true, genreMode: true, enrich: false, listUrl: "" },
    accounts: {
      [target.mid]: {
        name: "本地同名号",
        status: "hidden",
        confidence: "manual",
        reasons: ["手动标记"],
        samples: [],
        firstSeen: 1,
        lastSeen: 1,
        source: "local",
        hits: 1
      },
      [pendingMid]: {
        name: "待确认号",
        status: "pending",
        confidence: "auto",
        reasons: ["标题含 AI 标识"],
        samples: ["某视频 第1集"],
        firstSeen: 1,
        lastSeen: 1,
        source: "local",
        hits: 1
      },
      42: { name: "本地独有号", status: "hidden", confidence: "manual", reasons: ["手动标记"], samples: [], firstSeen: 1, lastSeen: 1, source: "local", hits: 1 }
    }
  });

  const before = store.settings().listUrl;
  const result = store.applyRemote(parsed.entries, false);

  assert.equal(result.added, total - 2, "除本地已有的 2 条外，其余条目应新增");
  assert.equal(result.upgraded, 1, "本地待确认的同 mid 应转正");
  assert.equal(store.getAccount(42).name, "本地独有号", "本地账号不能被删除");
  assert.equal(store.getAccount(target.mid).confidence, "manual", "本地人工记录不能被覆盖");
  assert.deepEqual(store.getAccount(target.mid).reasons, ["手动标记"]);
  assert.equal(store.getAccount(pendingMid).status, "hidden");
  assert.equal(store.getAccount(pendingMid).confidence, "confirmed");
  assert.equal(store.settings().listUrl, before, "同步不改订阅地址");
  assert.equal(store.settings().genreMode, true, "同步不关闭本地漫剧规则");
  assert.equal(store.data.meta.lastSyncCount, total);

  // 本地规则仍是纯函数，同步后照样生效
  const verdict = core.scoreCard({ name: "熊猫小圣AIGC", title: "《潮尸》第一集" });
  assert.equal(verdict.confidence, "high");
});


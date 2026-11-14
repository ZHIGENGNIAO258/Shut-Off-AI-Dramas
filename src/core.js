/* B 站 AI 漫剧屏蔽器 · 规则、名单校验与合并（纯函数，可单测） */
(function (root, factory) {
  var api = factory();
  if (typeof window === "undefined" && typeof module === "object" && module.exports) module.exports = api;
  root.AIS_CORE = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var SCHEMA = 1;
  var FORMAT = "bili-ai-slop";
  var LIST_VERSION = 1;
  var MAX_ENTRIES = 10000;
  var TOMBSTONE_TTL = 30 * 24 * 60 * 60 * 1000;
  var DAY = 24 * 60 * 60 * 1000;
  var DEFAULT_LIST_URL = "https://raw.githubusercontent.com/ZHIGENGNIAO258/Shut-Off-AI-Dramas/main/list/ai-slop.json";

  var DEFAULTS = {
    autoHideHigh: true,
    mediumBadge: true,
    showPlaceholder: false,
    enrich: true,
    remoteList: true,
    genreMode: true,
    listUrl: DEFAULT_LIST_URL
  };

  var RE = {
    name: /AIGC|AI\s*[\u4e00-\u9fa5]{0,4}?(?:漫剧|短剧|动漫|动画|剧场|影视|片场|创作|工作室)|人工智能/i,
    title: /AIGC|AI\s*[\u4e00-\u9fa5]{0,4}?(?:漫剧|短剧|生成|制作|绘制|动画|影视|原创|改编|视频)|人工智能\s*(?:生成|创作|制作)|生成式/i,
    sign: /AIGC|AI\s*[\u4e00-\u9fa5]{0,4}?(?:创作|动画|漫剧|短剧|视频|影视|生成|制作)|人工智能|生成式/i,
    tag: /^(?:AIGC|AI|人工智能|生成式|B站AI影视片场)$|AI\s*(?:动画|漫剧|短剧|视频|影视|作品|生成|片场)/i,
    genre: /漫剧|短剧|剧场|合集|一口气看完|第\s*[0-9０-９一二三四五六七八九十百]+\s*[集话]/,
    nameGenre: /剧场|短剧|漫剧|漫馆|制片厂|追漫|影业|好剧|番剧局|小剧场|漫剪|漫动画/,
    nameWeak: /动漫|漫画|说漫|看剧|看漫|推剧|放映厅|听书|漫社|漫城|漫听|漫梗|国漫/,
    serial:
      /(?:第\s*)?[\d一二三四五六七八九十百]+\s*(?:[-–—~～+＋至]\s*[\d一二三四五六七八九十百]+\s*)?[季集话]|EP\s*\d+|完整版|全集|荃集|成片|合集|大合集|大结局|一口气(?:看完|畅享|爽看|追完)|已完结|完结|超前(?:试看|点映)|独家限免|抢先(?:看|版)?|未删减|无删减|超清|勉费|免废/,
    tagGenre: /漫剧|短剧|动态漫|仿真人|AI真人|AI原创|AIGC|沙雕漫|2D漫|爆款短剧|热门漫剧|一口气看完漫剧|短剧推荐|短剧上新|AI动画|AI视频/i,
    signGenre: /漫剧|短剧|剧场|漫馆|每日更新|追更|充电|官方账号/,
    trope: /重生|穿越|逆袭|总裁|弃子|修仙|系统|师尊|复仇|千金|退婚|契约|闪婚|王妃|赘婿|战神|神医|龙王|真假千金|虐渣|团宠|爽文|男频|女频|首富|下山|反派|女主|男主|病娇|觉醒|异能|末世|末日|穿书|马甲|豪门|夫人|小姐|王爷|皇帝|太子|神豪|废土|丧尸|求生|绑定/,
    official: /^(哔哩哔哩|腾讯视频|腾讯动漫|爱奇艺|爱奇艺动漫|优酷|优酷动漫|芒果TV|芒果动漫|快看漫画|央视|新华社|人民日报|CCTV)/,
    vetoStrong:
      /教程|教学|测评|评测|入门到|从零|实战|工具|软件|插件|脚本|编程|代码|部署|接口|API|工作流|ComfyUI|Stable\s*Diffusion|SDXL|Midjourney|可灵|即梦|海螺|Runway|Sora|Pika|豆包|通义|文心|混元|大模型|AI\s*绘画|AI\s*配音|开源|论文/i,
    vetoTech: /解析|原理|技术|模型|指南|微调|LoRA/,
    aiContext: /AIGC|AI|人工智能|生成式|生成/i,
    negative: /影视解说|解说|影评|拉片|盘点|混剪|reaction|直播回放|复盘|速讲|讲解|剪辑/i
  };

  function text(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function asInt(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? Math.floor(n) : fallback;
  }

  /* ---------- 规则评分 ---------- */

  /**
   * @param {{name?:string,title?:string,sign?:string,tags?:string[],density?:number,context?:string,genreMode?:boolean}} input
   * @returns {{score:number,confidence:"high"|"medium"|"none",vetoed:boolean,reasons:string[]}}
   */
  function scoreCard(input) {
    var name = text(input && input.name);
    var title = text(input && input.title);
    var sign = text(input && input.sign);
    var tags = Array.isArray(input && input.tags) ? input.tags : [];
    var density = asInt(input && input.density, 0);
    var context = text(input && input.context);
    var genreMode = !(input && input.genreMode === false);
    var reasons = [];

    if (RE.official.test(name)) {
      return { score: 0, confidence: "none", vetoed: false, reasons: ["官方账号白名单"] };
    }

    var aiContext = RE.aiContext.test(title + " " + name);
    var vetoHit =
      (title.match(RE.vetoStrong) || [])[0] ||
      (name.match(RE.vetoStrong) || [])[0] ||
      (aiContext &&
        ((title.match(RE.vetoTech) || [])[0] || (name.match(RE.vetoTech) || [])[0]));
    if (vetoHit) {
      return { score: 0, confidence: "none", vetoed: true, reasons: ["否决:" + vetoHit] };
    }

    var tagHit = tags.map(text).filter(Boolean).find(function (tag) {
      return RE.tag.test(tag);
    });
    var tagGenre = tagHit
      ? ""
      : tags.map(text).filter(Boolean).find(function (tag) {
          return RE.tagGenre.test(tag);
        });
    var nameGenre = RE.nameGenre.test(name);
    var nameWeak = !nameGenre && RE.nameWeak.test(name);
    var serial = RE.serial.test(title);
    var trope = RE.trope.test(title);
    var longTitle = title.replace(/\s+/g, "").length >= 24;
    var signGenre = !!sign && !RE.sign.test(sign) && RE.signGenre.test(sign);
    var genreSignal = nameGenre || nameWeak || serial || !!tagGenre || trope;
    var recap = RE.negative.test(title) || (!!sign && RE.negative.test(sign));

    var score = 0;
    if (RE.name.test(name)) {
      score += 4;
      reasons.push("昵称含 AI 标识");
    }
    if (RE.title.test(title)) {
      score += 4;
      reasons.push("标题含 AI 标识");
    }
    if (sign && RE.sign.test(sign)) {
      score += 3;
      reasons.push("简介含 AI 标识");
    }
    if (tagHit) {
      score += 3;
      reasons.push("标签:" + tagHit);
    }
    if (RE.genre.test(title)) {
      score += 1;
      reasons.push("体裁为漫剧/短剧");
    }

    if (genreMode) {
      if (nameGenre) {
        score += 3;
        reasons.push("账号名为剧场/短剧/漫剧类");
      }
      if (nameWeak) {
        score += 2;
        reasons.push("账号名为动漫/说漫类");
      }
      if (serial) {
        score += 2;
        reasons.push("标题为连载/全集模板");
      }
      if (tagGenre) {
        score += 3;
        reasons.push("标签:" + tagGenre);
      }
      if (trope) {
        score += 1;
        reasons.push("标题含短剧题材");
      }
      if (longTitle && (nameGenre || nameWeak || serial || trope)) {
        score += 1;
        reasons.push("长剧情标题");
      }
      if (signGenre) {
        score += 1;
        reasons.push("简介为漫剧/短剧账号");
      }
      if (context && /漫剧|短剧/i.test(context) && genreSignal) {
        score += nameGenre ? 2 : 1;
        reasons.push("漫剧搜索页上下文");
      }
    }

    if (recap) {
      score -= 4;
      reasons.push("负向:解说/剪辑");
    }
    if (density >= 2) {
      score += 1;
      reasons.push("同 UP 本页出现 " + density + " 次");
    }

    var confidence = score >= 4 ? "high" : score >= 2 ? "medium" : "none";
    return { score: score, confidence: confidence, vetoed: false, reasons: reasons };
  }

  /* ---------- 设置与数据归一化 ---------- */

  function emptyData() {
    return {
      schema: SCHEMA,
      settings: normalizeSettings(null),
      accounts: {},
      whitelist: {},
      tombstones: {},
      cache: { sign: {}, tags: {} },
      meta: { listVersion: "", lastSync: 0, lastSyncCount: 0, defaultListApplied: false }
    };
  }

  function normalizeSettings(input) {
    var out = {};
    Object.keys(DEFAULTS).forEach(function (key) {
      var def = DEFAULTS[key];
      var value = input && typeof input === "object" ? input[key] : undefined;
      if (typeof value === typeof def && (typeof def !== "string" || value.length <= 500)) {
        out[key] = value;
      } else {
        out[key] = def;
      }
    });
    return out;
  }

  function normalizeAccount(raw) {
    if (!raw || typeof raw !== "object") return null;
    var status = raw.status === "hidden" ? "hidden" : "pending";
    var confidence =
      raw.confidence === "manual" || raw.confidence === "confirmed"
        ? raw.confidence
        : raw.confidence === "high"
        ? "high"
        : "auto";
    var reasons = Array.isArray(raw.reasons)
      ? raw.reasons.filter(function (item) {
          return typeof item === "string" && item.length <= 160;
        }).slice(0, 5)
      : [];
    var samples = Array.isArray(raw.samples)
      ? raw.samples.filter(function (item) {
          return typeof item === "string" && item.length <= 160;
        }).slice(0, 5)
      : [];
    return {
      name: typeof raw.name === "string" ? raw.name.slice(0, 60) : "",
      status: status,
      confidence: confidence,
      reasons: reasons,
      samples: samples,
      firstSeen: asInt(raw.firstSeen, 0),
      lastSeen: asInt(raw.lastSeen, 0),
      source: raw.source === "remote" ? "remote" : "local",
      hits: Math.max(1, asInt(raw.hits, 1))
    };
  }

  function normalizeAccounts(raw) {
    var out = {};
    if (!raw || typeof raw !== "object") return out;
    Object.keys(raw).forEach(function (key) {
      var mid = Number(key);
      if (!Number.isSafeInteger(mid) || mid <= 0) return;
      if (Object.keys(out).length >= 20000) return;
      var account = normalizeAccount(raw[key]);
      if (account) out[mid] = account;
    });
    return out;
  }

  function normalizeTimestampMap(raw) {
    var out = {};
    if (!raw || typeof raw !== "object") return out;
    Object.keys(raw).forEach(function (key) {
      var mid = Number(key);
      if (!Number.isSafeInteger(mid) || mid <= 0) return;
      var ts = asInt(raw[key], 0);
      if (ts > 0) out[mid] = ts;
    });
    return out;
  }

  function normalizeCache(raw) {
    var out = { sign: {}, tags: {} };
    if (!raw || typeof raw !== "object") return out;

    var signSource = raw.sign;
    if (signSource && typeof signSource === "object") {
      var signCount = 0;
      Object.keys(signSource).forEach(function (key) {
        if (signCount >= 5000) return;
        var item = signSource[key];
        if (!item || typeof item.text !== "string") return;
        var textValue = item.text.slice(0, 200);
        if (!textValue) return;
        out.sign[key] = { text: textValue, ts: asInt(item.ts, 0) };
        signCount += 1;
      });
    }

    var tagSource = raw.tags;
    if (tagSource && typeof tagSource === "object") {
      var tagCount = 0;
      Object.keys(tagSource).forEach(function (key) {
        if (tagCount >= 5000) return;
        var item = tagSource[key];
        if (!item || !Array.isArray(item.list)) return;
        var list = item.list
          .filter(function (tag) {
            return typeof tag === "string" && tag.length > 0 && tag.length <= 80;
          })
          .slice(0, 30);
        if (!list.length) return;
        out.tags[key] = { list: list, ts: asInt(item.ts, 0) };
        tagCount += 1;
      });
    }
    return out;
  }

  function normalizeData(raw) {
    var data = raw && typeof raw === "object" ? raw : {};
    var tombstones = normalizeTimestampMap(data.tombstones);
    var now = Date.now();
    Object.keys(tombstones).forEach(function (key) {
      if (now - tombstones[key] > TOMBSTONE_TTL) delete tombstones[key];
    });
    return {
      schema: SCHEMA,
      settings: normalizeSettings(data.settings),
      accounts: normalizeAccounts(data.accounts),
      whitelist: normalizeTimestampMap(data.whitelist),
      tombstones: tombstones,
      cache: normalizeCache(data.cache),
      meta: {
        listVersion: data.meta && typeof data.meta.listVersion === "string" ? data.meta.listVersion.slice(0, 80) : "",
        lastSync: asInt(data.meta && data.meta.lastSync, 0),
        lastSyncCount: asInt(data.meta && data.meta.lastSyncCount, 0),
        defaultListApplied: !!(data.meta && data.meta.defaultListApplied)
      }
    };
  }

  /* ---------- 共享名单 ---------- */

  function fail(message) {
    return { ok: false, entries: [], error: message };
  }

  function parseList(raw) {
    var data = raw;
    if (typeof raw === "string") {
      try {
        data = JSON.parse(raw);
      } catch (error) {
        return fail("JSON 解析失败");
      }
    }
    if (!data || typeof data !== "object") return fail("顶层必须是对象");
    if (data.format !== FORMAT) return fail("format 不匹配，应为 " + FORMAT);
    if (data.version !== LIST_VERSION) return fail("version 不匹配，应为 " + LIST_VERSION);
    if (!Array.isArray(data.entries)) return fail("entries 必须是数组");
    if (data.entries.length > MAX_ENTRIES) return fail("条目超过上限 " + MAX_ENTRIES);

    var seen = {};
    var entries = [];
    for (var i = 0; i < data.entries.length; i += 1) {
      var item = data.entries[i];
      var where = "第 " + (i + 1) + " 条";
      if (!item || typeof item !== "object") return fail(where + "不是对象");
      if (!Number.isSafeInteger(item.mid) || item.mid <= 0) return fail(where + " mid 非法");
      if (seen[item.mid]) continue;
      if (typeof item.name !== "string" || item.name.length > 60) return fail(where + " name 非法");
      var confidence = item.confidence === "confirmed" ? "confirmed" : item.confidence === "auto" ? "auto" : null;
      if (!confidence) return fail(where + " confidence 非法");
      var evidence = Array.isArray(item.evidence) ? item.evidence : [];
      var samples = Array.isArray(item.samples) ? item.samples : [];
      var badEvidence = evidence.some(function (value) {
        return typeof value !== "string" || value.length > 160;
      });
      var badSamples = samples.some(function (value) {
        return typeof value !== "string" || value.length > 160;
      });
      if (evidence.length > 5 || badEvidence) return fail(where + " evidence 非法");
      if (samples.length > 5 || badSamples) return fail(where + " samples 非法");
      seen[item.mid] = true;
      entries.push({
        mid: item.mid,
        name: item.name,
        confidence: confidence,
        evidence: evidence.slice(0, 5),
        samples: samples.slice(0, 5),
        addedAt: typeof item.addedAt === "string" ? item.addedAt.slice(0, 40) : ""
      });
    }
    return { ok: true, entries: entries, error: "" };
  }

  function buildList(accounts, options) {
    var includeAuto = !!(options && options.includeAuto);
    var entries = [];
    Object.keys(accounts || {}).forEach(function (key) {
      var account = accounts[key];
      if (!account || account.status !== "hidden") return;
      if (!includeAuto && account.confidence === "auto") return;
      entries.push({
        mid: Number(key),
        name: account.name || "",
        confidence: account.confidence === "auto" ? "auto" : "confirmed",
        evidence: (account.reasons || []).slice(0, 5),
        samples: (account.samples || []).slice(0, 5),
        addedAt: account.firstSeen ? new Date(account.firstSeen).toISOString().slice(0, 10) : ""
      });
    });
    return { format: FORMAT, version: LIST_VERSION, updatedAt: new Date().toISOString(), entries: entries };
  }

  function mergeAccounts(local, remoteEntries, options) {
    var tombstones = (options && options.tombstones) || {};
    var now = (options && options.now) || Date.now();
    var includeAuto = !!(options && options.includeAuto);
    var result = {};
    Object.keys(local || {}).forEach(function (key) {
      result[key] = local[key];
    });
    var added = [];
    var upgraded = [];

    function mergeList(current, extra, limit) {
      var out = Array.isArray(current) ? current.slice() : [];
      (extra || []).forEach(function (item) {
        if (typeof item !== "string" || !item) return;
        if (out.indexOf(item) === -1 && out.length < limit) out.push(item.slice(0, 160));
      });
      return out;
    }

    (remoteEntries || []).forEach(function (entry) {
      if (!includeAuto && entry.confidence !== "confirmed") return;
      var tombstone = tombstones[entry.mid];
      if (tombstone && now - tombstone < TOMBSTONE_TTL) return;
      var existing = result[entry.mid];
      if (existing) {
        // 本地已有：只在「自动识别/待确认」时升级为隐藏，绝不覆盖人工记录或删除本地条目
        if (entry.confidence === "confirmed" && existing.confidence === "auto" && existing.status !== "hidden") {
          existing.status = "hidden";
          existing.confidence = "confirmed";
          existing.reasons = mergeList(existing.reasons, entry.evidence, 5);
          existing.samples = mergeList(existing.samples, entry.samples, 5);
          existing.lastSeen = now;
          upgraded.push(entry.mid);
        }
        return;
      }
      result[entry.mid] = {
        name: entry.name,
        status: "hidden",
        confidence: entry.confidence === "auto" ? "auto" : "confirmed",
        reasons: (entry.evidence || []).slice(0, 5),
        samples: (entry.samples || []).slice(0, 5),
        firstSeen: now,
        lastSeen: now,
        source: "remote",
        hits: 1
      };
      added.push(entry.mid);
    });
    return { accounts: result, added: added, upgraded: upgraded };
  }

  function shouldHideAccount(account) {
    return !!account && account.status === "hidden";
  }

  return {
    SCHEMA: SCHEMA,
    FORMAT: FORMAT,
    LIST_VERSION: LIST_VERSION,
    MAX_ENTRIES: MAX_ENTRIES,
    TOMBSTONE_TTL: TOMBSTONE_TTL,
    DAY: DAY,
    DEFAULTS: DEFAULTS,
    DEFAULT_LIST_URL: DEFAULT_LIST_URL,
    RE: RE,
    scoreCard: scoreCard,
    emptyData: emptyData,
    normalizeSettings: normalizeSettings,
    normalizeData: normalizeData,
    normalizeAccount: normalizeAccount,
    parseList: parseList,
    buildList: buildList,
    mergeAccounts: mergeAccounts,
    shouldHideAccount: shouldHideAccount,
    text: text
  };
});

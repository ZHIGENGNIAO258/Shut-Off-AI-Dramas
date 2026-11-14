// ==UserScript==
// @name         B 站 AI 漫剧屏蔽器
// @namespace    https://github.com/ZHIGENGNIAO258/Shut-Off-AI-Dramas
// @version      0.4.1
// @description  按账号名单与规则隐藏 B 站首页 / 搜索 / 动画分区里的 AI 漫剧卡片，名单可导出分享
// @author       ZHIGENGNIAO258
// @license      MIT
// @homepageURL  https://github.com/ZHIGENGNIAO258/Shut-Off-AI-Dramas
// @supportURL   https://github.com/ZHIGENGNIAO258/Shut-Off-AI-Dramas/issues
// @updateURL    https://raw.githubusercontent.com/ZHIGENGNIAO258/Shut-Off-AI-Dramas/main/dist/shut-off-ai-dramas.user.js
// @downloadURL  https://raw.githubusercontent.com/ZHIGENGNIAO258/Shut-Off-AI-Dramas/main/dist/shut-off-ai-dramas.user.js
// @match        https://www.bilibili.com/*
// @match        https://search.bilibili.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at       document-idle
// @noframes
// ==/UserScript==
(function () {
  "use strict";
  globalThis.AIS_CSS = "/* B 站 AI 漫剧屏蔽器 · 界面样式（全部限定在 ais- 前缀内） */\n\n.ais-hidden {\n  display: none !important;\n}\n\n.ais-placeholder {\n  position: relative;\n  display: flex !important;\n  align-items: center;\n  justify-content: center;\n  min-height: 90px;\n  border: 1px dashed #fb7299;\n  border-radius: 8px;\n  background: #fff5f8;\n}\n\n.ais-placeholder > * {\n  display: none !important;\n}\n\n.ais-placeholder::before {\n  content: \"已屏蔽 · AI 漫剧\";\n  color: #fb7299;\n  font-size: 13px;\n}\n\n.ais-suspect {\n  position: relative;\n  outline: 2px dashed #fb7299;\n  outline-offset: -2px;\n}\n\n.ais-suspect::after {\n  content: \"?\";\n  position: absolute;\n  top: 6px;\n  right: 6px;\n  z-index: 20;\n  width: 18px;\n  height: 18px;\n  line-height: 18px;\n  text-align: center;\n  border-radius: 50%;\n  background: #fb7299;\n  color: #fff;\n  font-size: 12px;\n  font-weight: 700;\n  pointer-events: none;\n}\n\n.ais-marking .feed-card:hover,\n.ais-marking .video-list > div:hover {\n  outline: 2px solid #00aeec;\n  cursor: crosshair;\n}\n\n.ais-flash {\n  animation: ais-flash 0.9s ease;\n}\n\n@keyframes ais-flash {\n  0% {\n    box-shadow: 0 0 0 0 rgba(0, 174, 236, 0.8);\n  }\n  100% {\n    box-shadow: 0 0 0 12px rgba(0, 174, 236, 0);\n  }\n}\n\n/* 悬浮球 */\n.ais-fab {\n  position: fixed;\n  right: 20px;\n  bottom: 20px;\n  z-index: 2147483000;\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  padding: 8px 12px;\n  border: 0;\n  border-radius: 999px;\n  background: #fb7299;\n  color: #fff;\n  font: 600 13px/1.2 system-ui, -apple-system, \"Segoe UI\", sans-serif;\n  box-shadow: 0 6px 20px rgba(251, 114, 153, 0.4);\n  cursor: pointer;\n}\n\n.ais-fab:hover {\n  filter: brightness(1.05);\n}\n\n.ais-fab-hot {\n  background: #d94f7a;\n}\n\n.ais-fab-dot {\n  display: inline-block;\n  padding: 1px 4px;\n  border-radius: 4px;\n  background: rgba(255, 255, 255, 0.22);\n  font-size: 11px;\n}\n\n.ais-fab-count {\n  min-width: 16px;\n  text-align: center;\n}\n\n/* 面板 */\n.ais-panel {\n  position: fixed;\n  right: 20px;\n  bottom: 72px;\n  z-index: 2147483000;\n  display: flex;\n  flex-direction: column;\n  width: 380px;\n  max-width: calc(100vw - 32px);\n  max-height: min(72vh, 640px);\n  border-radius: 14px;\n  background: #fff;\n  color: #18191c;\n  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.22);\n  font: 13px/1.5 system-ui, -apple-system, \"Segoe UI\", sans-serif;\n  overflow: hidden;\n}\n\n.ais-panel[hidden],\n.ais-hover[hidden],\n.ais-modal[hidden],\n.ais-toast[hidden] {\n  display: none !important;\n}\n\n.ais-panel-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 12px 14px;\n  border-bottom: 1px solid #f1f2f3;\n}\n\n.ais-icon-btn {\n  border: 0;\n  background: transparent;\n  color: #9499a0;\n  font-size: 18px;\n  line-height: 1;\n  cursor: pointer;\n}\n\n.ais-tabs {\n  display: flex;\n  gap: 4px;\n  padding: 8px 10px;\n  border-bottom: 1px solid #f1f2f3;\n  background: #fafafa;\n}\n\n.ais-tab {\n  flex: 1;\n  padding: 6px 0;\n  border: 0;\n  border-radius: 8px;\n  background: transparent;\n  color: #61666d;\n  font: inherit;\n  cursor: pointer;\n}\n\n.ais-tab-active {\n  background: #fb7299;\n  color: #fff;\n}\n\n.ais-panel-body {\n  flex: 1;\n  padding: 12px 14px;\n  overflow: auto;\n}\n\n.ais-panel-foot {\n  padding: 8px 14px;\n  border-top: 1px solid #f1f2f3;\n  color: #9499a0;\n  font-size: 11px;\n}\n\n.ais-summary {\n  margin-bottom: 10px;\n  color: #61666d;\n}\n\n.ais-summary-num {\n  color: #fb7299;\n  font-size: 22px;\n  font-weight: 700;\n}\n\n.ais-empty {\n  margin: 12px 0;\n  color: #9499a0;\n  font-size: 12px;\n  line-height: 1.7;\n}\n\n.ais-row {\n  display: flex;\n  align-items: flex-start;\n  justify-content: space-between;\n  gap: 10px;\n  padding: 9px 0;\n  border-bottom: 1px solid #f4f5f6;\n}\n\n.ais-row-main {\n  min-width: 0;\n}\n\n.ais-row-title {\n  overflow: hidden;\n  color: #18191c;\n  font-weight: 600;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ais-row-sub {\n  margin-top: 2px;\n  color: #9499a0;\n  font-size: 11px;\n  word-break: break-all;\n}\n\n.ais-row-side {\n  display: flex;\n  flex: 0 0 auto;\n  gap: 6px;\n}\n\n.ais-btn {\n  padding: 5px 9px;\n  border: 1px solid #e3e5e7;\n  border-radius: 7px;\n  background: #fff;\n  color: #18191c;\n  font: inherit;\n  cursor: pointer;\n  white-space: nowrap;\n}\n\n.ais-btn:hover {\n  border-color: #fb7299;\n  color: #fb7299;\n}\n\n.ais-btn-primary {\n  border-color: #fb7299;\n  background: #fb7299;\n  color: #fff;\n}\n\n.ais-btn-primary:hover {\n  background: #e45f86;\n  color: #fff;\n}\n\n.ais-btn-wide {\n  width: 100%;\n  margin-bottom: 8px;\n}\n\n.ais-toolbar {\n  display: flex;\n  gap: 8px;\n  margin-bottom: 8px;\n}\n\n.ais-sync {\n  display: flex;\n  gap: 8px;\n  margin-bottom: 10px;\n}\n\n.ais-input {\n  flex: 1;\n  min-width: 0;\n  padding: 6px 8px;\n  border: 1px solid #e3e5e7;\n  border-radius: 7px;\n  font: inherit;\n}\n\n.ais-check {\n  display: flex;\n  align-items: flex-start;\n  gap: 8px;\n  padding: 8px 0;\n  border-bottom: 1px solid #f4f5f6;\n}\n\n.ais-check input {\n  margin-top: 3px;\n}\n\n.ais-check-note {\n  display: block;\n  color: #9499a0;\n  font-size: 11px;\n}\n\n/* 悬停工具条 */\n.ais-hover {\n  position: fixed;\n  z-index: 2147483001;\n  display: flex;\n  gap: 6px;\n  padding: 6px;\n  border-radius: 10px;\n  background: #18191c;\n  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);\n}\n\n.ais-hover .ais-btn {\n  border-color: transparent;\n  background: #2b2d31;\n  color: #fff;\n  font-size: 12px;\n}\n\n.ais-hover .ais-btn:hover {\n  background: #fb7299;\n}\n\n.ais-hover .ais-btn-primary {\n  background: #fb7299;\n}\n\n/* 模态框 */\n.ais-modal {\n  position: fixed;\n  inset: 0;\n  z-index: 2147483002;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: rgba(0, 0, 0, 0.45);\n}\n\n.ais-modal-card {\n  width: 440px;\n  max-width: calc(100vw - 32px);\n  max-height: 80vh;\n  display: flex;\n  flex-direction: column;\n  border-radius: 14px;\n  background: #fff;\n  color: #18191c;\n  font: 13px/1.6 system-ui, -apple-system, \"Segoe UI\", sans-serif;\n  overflow: hidden;\n}\n\n.ais-modal-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 12px 16px;\n  border-bottom: 1px solid #f1f2f3;\n}\n\n.ais-modal-body {\n  flex: 1;\n  padding: 14px 16px;\n  overflow: auto;\n}\n\n.ais-modal-foot {\n  display: flex;\n  justify-content: flex-end;\n  gap: 8px;\n  padding: 12px 16px;\n  border-top: 1px solid #f1f2f3;\n}\n\n.ais-depth-line {\n  margin-bottom: 6px;\n  word-break: break-all;\n}\n\n/* Toast */\n.ais-toast {\n  position: fixed;\n  left: 50%;\n  bottom: 28px;\n  z-index: 2147483003;\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  padding: 9px 14px;\n  border-radius: 999px;\n  background: #18191c;\n  color: #fff;\n  font: 12px/1.4 system-ui, -apple-system, \"Segoe UI\", sans-serif;\n  transform: translateX(-50%);\n  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);\n}\n\n.ais-toast-btn {\n  border: 0;\n  background: transparent;\n  color: #fb7299;\n  font: inherit;\n  font-weight: 600;\n  cursor: pointer;\n}\n";
/* ---- src/core.js ---- */
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

  var DEFAULTS = {
    autoHideHigh: true,
    mediumBadge: true,
    showPlaceholder: false,
    enrich: true,
    remoteList: true,
    genreMode: true,
    listUrl: ""
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
      meta: { listVersion: "", lastSync: 0 }
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
        lastSync: asInt(data.meta && data.meta.lastSync, 0)
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
    (remoteEntries || []).forEach(function (entry) {
      if (!includeAuto && entry.confidence !== "confirmed") return;
      if (result[entry.mid]) return;
      var tombstone = tombstones[entry.mid];
      if (tombstone && now - tombstone < TOMBSTONE_TTL) return;
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
    return { accounts: result, added: added };
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

/* ---- src/surfaces.js ---- */
/* B 站 AI 漫剧屏蔽器 · 页面适配（主页 / 搜索页） */
(function (root, factory) {
  var api = factory(root.AIS_CORE);
  if (typeof window === "undefined" && typeof module === "object" && module.exports) module.exports = api;
  root.AIS_SURFACES = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (core) {
  "use strict";

  function elementText(el) {
    return el && typeof el.textContent === "string" ? el.textContent.trim() : "";
  }

  function attr(el, name) {
    return el && typeof el.getAttribute === "function" ? el.getAttribute(name) || "" : "";
  }

  function cleanName(value) {
    return value.replace(/\s*·\s*\d{1,2}-\d{1,2}\s*$/, "").trim();
  }

  function readCard(wrapper) {
    if (!wrapper || typeof wrapper.querySelector !== "function") return null;
    var card = wrapper.querySelector(".bili-video-card") || wrapper.querySelector(".video-card");
    if (!card) {
      var hasClass =
        wrapper.classList &&
        (wrapper.classList.contains("bili-video-card") || wrapper.classList.contains("video-card"));
      if (hasClass) card = wrapper;
    }
    if (!card) return null;

    var owner = card.querySelector('a[href*="space.bilibili.com/"]');
    if (!owner) return null;
    var match = attr(owner, "href").match(/space\.bilibili\.com\/(\d+)/);
    if (!match) return null;
    var mid = parseInt(match[1], 10);
    if (!Number.isSafeInteger(mid) || mid <= 0) return null;

    var nameEl =
      card.querySelector(".bili-video-card__info--author") ||
      card.querySelector(".bili-video-card__author") ||
      card.querySelector('[class*="__author"]');
    var name = cleanName(elementText(nameEl));
    if (!name) name = cleanName(elementText(owner.querySelector("span")));

    var titleEl =
      card.querySelector(".bili-video-card__info--tit") ||
      card.querySelector(".bili-video-card__title") ||
      card.querySelector('[class*="__tit"]');
    var videoLink = card.querySelector('a[href*="/video/BV"]');
    var bvidMatch = attr(videoLink, "href").match(/BV[0-9A-Za-z]+/);
    var title = elementText(titleEl) || attr(videoLink, "title") || attr(titleEl, "title");

    return {
      mid: mid,
      name: name,
      title: title,
      bvid: bvidMatch ? bvidMatch[0] : "",
      wrapper: wrapper,
      card: card
    };
  }

  var HOME = {
    id: "home",
    label: "主页推荐",
    match: function (location) {
      return (
        location &&
        location.hostname === "www.bilibili.com" &&
        (location.pathname === "/" || location.pathname === "/index.html")
      );
    },
    cardSelector: ".feed-card",
    getCards: function (root) {
      return Array.prototype.slice.call(root.querySelectorAll(this.cardSelector));
    },
    wrapperOf: function (target) {
      return target && typeof target.closest === "function" ? target.closest(this.cardSelector) : null;
    },
    read: readCard
  };

  var DOUGA = {
    id: "douga",
    label: "动画分区",
    match: function (location) {
      return location && location.hostname === "www.bilibili.com" && /^\/c\/douga\/?$/.test(location.pathname);
    },
    cardSelector: ".bili-video-card, .video-card",
    getCards: function (root) {
      return Array.prototype.slice.call(root.querySelectorAll(this.cardSelector)).filter(function (el) {
        // 真正的轮播slide 只取当前帧，隐藏会打乱翻页，跳过
        return !el.closest(".vui_carousel__slide");
      });
    },
    wrapperOf: function (target) {
      if (!target || typeof target.closest !== "function") return null;
      var card = target.closest(".bili-video-card, .video-card");
      if (!card) return null;
      return card.closest(".feed-card") || card;
    },
    ignored: function (element) {
      return !!(element && element.closest && element.closest(".vui_carousel__slide"));
    },
    read: readCard
  };

  var SEARCH = {
    id: "search",
    label: "搜索结果",
    match: function (location) {
      return location && location.hostname === "search.bilibili.com";
    },
    cardSelector: ".video-list > div",
    getCards: function (root) {
      return Array.prototype.slice.call(root.querySelectorAll(this.cardSelector)).filter(function (el) {
        return !!el.querySelector(".bili-video-card");
      });
    },
    wrapperOf: function (target) {
      if (!target || typeof target.closest !== "function") return null;
      var wrapper = target.closest(this.cardSelector);
      if (wrapper && wrapper.querySelector(".bili-video-card")) return wrapper;
      return null;
    },
    read: readCard
  };

  var SURFACES = [HOME, DOUGA, SEARCH];

  function pick(location) {
    for (var i = 0; i < SURFACES.length; i += 1) {
      if (SURFACES[i].match(location)) return SURFACES[i];
    }
    return null;
  }

  return {
    SURFACES: SURFACES,
    pick: pick,
    readCard: readCard
  };
});

/* ---- src/api.js ---- */
/* B 站 AI 漫剧屏蔽器 · 只读增强接口（UP 简介 / 视频标签）
 * 仅使用公开 GET：credentials: "omit"，不携带 Cookie，不调用任何写接口。
 */
(function (root, factory) {
  var api = factory();
  if (typeof window === "undefined" && typeof module === "object" && module.exports) module.exports = api;
  root.AIS_API = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var SIGN_TTL = 7 * 24 * 60 * 60 * 1000;
  var TAG_TTL = 24 * 60 * 60 * 1000;

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function createEnricher(options) {
    var opts = options || {};
    var fetchImpl =
      opts.fetchImpl || (typeof fetch === "function" ? fetch.bind(globalThis) : null);
    var delayMs = opts.delayMs || 2500;
    var maxPerSession = opts.maxPerSession || 20;
    var cache = opts.cache || { sign: {}, tags: {} };
    var onUpdate = typeof opts.onUpdate === "function" ? opts.onUpdate : function () {};

    var queue = Promise.resolve();
    var lastAt = 0;
    var used = 0;
    var failures = 0;
    var cooldownUntil = 0;

    function cooling() {
      return Date.now() < cooldownUntil;
    }

    function canUse() {
      return !!fetchImpl && used < maxPerSession && !cooling();
    }

    async function getJson(url) {
      var controller = new AbortController();
      var timer = setTimeout(function () {
        controller.abort();
      }, 8000);
      try {
        var response = await fetchImpl(url, {
          method: "GET",
          credentials: "omit",
          signal: controller.signal,
          headers: { accept: "application/json" }
        });
        if (!response.ok) throw new Error("HTTP " + response.status);
        var json = await response.json();
        if (!json || json.code !== 0) throw new Error("code " + (json && json.code));
        return json.data;
      } finally {
        clearTimeout(timer);
      }
    }

    function schedule(task) {
      var run = queue.then(async function () {
        if (used >= maxPerSession) throw new Error("session limit");
        if (cooling()) throw new Error("cooldown");
        var wait = lastAt + delayMs - Date.now();
        if (wait > 0) await sleep(wait);
        lastAt = Date.now();
        used += 1;
        try {
          var result = await task();
          failures = 0;
          return result;
        } catch (error) {
          failures += 1;
          if (failures >= 3) cooldownUntil = Date.now() + 10 * 60 * 1000;
          throw error;
        }
      });
      queue = run.catch(function () {});
      return run;
    }

    async function getProfile(mid) {
      var cached = cache.sign[mid];
      if (cached && cached.text && Date.now() - cached.ts < SIGN_TTL) {
        return { sign: cached.text, name: "", fans: 0, cached: true };
      }
      if (!canUse() || !Number.isSafeInteger(mid) || mid <= 0) return null;
      try {
        var data = await schedule(function () {
          return getJson("https://api.bilibili.com/x/web-interface/card?mid=" + mid);
        });
        var card = data && data.card;
        if (!card) return null;
        var sign = typeof card.sign === "string" ? card.sign.slice(0, 200) : "";
        cache.sign[mid] = { text: sign, ts: Date.now() };
        onUpdate(mid);
        return { sign: sign, name: card.name || "", fans: Number(card.fans) || 0, cached: false };
      } catch (error) {
        return null;
      }
    }

    async function getTags(bvid) {
      if (!bvid) return null;
      var cached = cache.tags[bvid];
      if (cached && Array.isArray(cached.list) && Date.now() - cached.ts < TAG_TTL) {
        return cached.list.slice();
      }
      if (!canUse()) return null;
      try {
        var data = await schedule(function () {
          return getJson(
            "https://api.bilibili.com/x/web-interface/view/detail/tag?bvid=" + encodeURIComponent(bvid)
          );
        });
        var list = Array.isArray(data)
          ? data
              .map(function (item) {
                return item && typeof item.tag_name === "string" ? item.tag_name : "";
              })
              .filter(Boolean)
          : [];
        cache.tags[bvid] = { list: list.slice(0, 30), ts: Date.now() };
        return list;
      } catch (error) {
        return null;
      }
    }

    return {
      getProfile: getProfile,
      getTags: getTags,
      canUse: canUse,
      stats: function () {
        return { used: used, max: maxPerSession, cooling: cooling() };
      }
    };
  }

  return { createEnricher: createEnricher };
});

/* ---- src/store.js ---- */
/* B 站 AI 漫剧屏蔽器 · 本地存储与名单操作 */
(function (root, factory) {
  var core = root.AIS_CORE || (typeof require === "function" ? require("./core.js") : null);
  var api = factory(core);
  if (typeof window === "undefined" && typeof module === "object" && module.exports) module.exports = api;
  root.AIS_STORE = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (core) {
  "use strict";

  var KEY = "ais:data";

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function createStore(options) {
    var opts = options || {};
    var key = opts.key || KEY;
    var getValue = opts.getValue;
    var setValue = opts.setValue;
    var data = core.normalizeData(safeParse(getValue(key)));

    function safeParse(raw) {
      if (raw == null) return null;
      if (typeof raw === "object") return raw;
      try {
        return JSON.parse(raw);
      } catch (error) {
        return null;
      }
    }

    function save() {
      try {
        setValue(key, data);
        return true;
      } catch (error) {
        return false;
      }
    }

    function now() {
      return Date.now();
    }

    function reload() {
      data = core.normalizeData(safeParse(getValue(key)));
      return data;
    }

    function settings() {
      return data.settings;
    }

    function setSetting(name, value) {
      if (!Object.prototype.hasOwnProperty.call(core.DEFAULTS, name)) return false;
      var def = core.DEFAULTS[name];
      if (typeof value !== typeof def) return false;
      if (typeof def === "string" && value.length > 500) return false;
      data.settings[name] = value;
      save();
      return true;
    }

    function getAccount(mid) {
      return data.accounts[mid] || null;
    }

    function mergeReasons(target, extra) {
      (extra || []).forEach(function (reason) {
        if (typeof reason === "string" && reason && target.indexOf(reason) === -1 && target.length < 5) {
          target.push(reason.slice(0, 160));
        }
      });
    }

    function noteAutoHit(mid, info) {
      if (!Number.isSafeInteger(mid) || mid <= 0) return null;
      var ts = now();
      var account = data.accounts[mid];
      if (!account) {
        account = {
          name: info.name || "",
          status: "pending",
          confidence: "auto",
          reasons: [],
          samples: [],
          firstSeen: ts,
          lastSeen: ts,
          source: "local",
          hits: 1
        };
        mergeReasons(account.reasons, info.reasons);
        if (info.sample) account.samples.push(String(info.sample).slice(0, 160));
        data.accounts[mid] = account;
        save();
        return account;
      }
      if (account.confidence === "auto") {
        if (ts - account.firstSeen > 30 * 24 * 60 * 60 * 1000) {
          account.hits = 1;
          account.firstSeen = ts;
        } else {
          account.hits += 1;
        }
        account.lastSeen = ts;
        if (info.name) account.name = info.name;
        mergeReasons(account.reasons, info.reasons);
        if (info.sample && account.samples.length < 3 && account.samples.indexOf(info.sample) === -1) {
          account.samples.push(String(info.sample).slice(0, 160));
        }
        if (account.status === "pending" && account.hits >= 2) {
          account.status = "hidden";
        }
        save();
      }
      return account;
    }

    function upsertManual(mid, info) {
      var previous = data.accounts[mid] ? clone(data.accounts[mid]) : null;
      var ts = now();
      var account = data.accounts[mid] || {
        name: "",
        status: "hidden",
        confidence: "manual",
        reasons: [],
        samples: [],
        firstSeen: ts,
        lastSeen: ts,
        source: "local",
        hits: 1
      };
      account.status = "hidden";
      account.confidence = "manual";
      account.lastSeen = ts;
      if (info.name) account.name = info.name;
      if (info.reason) mergeReasons(account.reasons, [info.reason]);
      if (info.sample && account.samples.length < 5 && account.samples.indexOf(info.sample) === -1) {
        account.samples.push(String(info.sample).slice(0, 160));
      }
      data.accounts[mid] = account;
      save();
      return previous;
    }

    function confirmAccount(mid) {
      var account = data.accounts[mid];
      if (!account) return false;
      account.status = "hidden";
      if (account.confidence === "auto" || account.confidence === "high") {
        account.confidence = "confirmed";
      }
      account.lastSeen = now();
      save();
      return true;
    }

    function removeAccount(mid) {
      if (!data.accounts[mid]) return false;
      delete data.accounts[mid];
      save();
      return true;
    }

    function dismissAccount(mid) {
      var ts = now();
      delete data.accounts[mid];
      data.whitelist[mid] = ts;
      data.tombstones[mid] = ts;
      save();
    }

    function restoreAccount(mid, snapshot) {
      if (snapshot) {
        data.accounts[mid] = snapshot;
      } else {
        delete data.accounts[mid];
      }
      save();
    }

    function isWhitelisted(mid) {
      return !!data.whitelist[mid];
    }

    function whitelist(mid) {
      data.whitelist[mid] = now();
      save();
    }

    function unwhitelist(mid) {
      delete data.whitelist[mid];
      save();
    }

    function getSignCache(mid) {
      var item = data.cache.sign[mid];
      if (!item || !item.text) return null;
      if (now() - item.ts > 7 * 24 * 60 * 60 * 1000) return null;
      return item.text;
    }

    function getTagsCache(bvid) {
      var item = bvid ? data.cache.tags[bvid] : null;
      if (!item || !Array.isArray(item.list)) return null;
      if (now() - item.ts > 24 * 60 * 60 * 1000) return null;
      return item.list.slice();
    }

    function exportList(options) {
      return core.buildList(data.accounts, options || {});
    }

    function previewImport(text) {
      var parsed = core.parseList(text);
      if (!parsed.ok) return parsed;
      var confirmed = parsed.entries.filter(function (entry) {
        return entry.confidence === "confirmed";
      }).length;
      return {
        ok: true,
        entries: parsed.entries,
        total: parsed.entries.length,
        confirmed: confirmed,
        auto: parsed.entries.length - confirmed,
        error: ""
      };
    }

    function applyImport(entries, includeAuto) {
      var merged = core.mergeAccounts(data.accounts, entries, {
        includeAuto: !!includeAuto,
        tombstones: data.tombstones
      });
      data.accounts = merged.accounts;
      save();
      return merged.added.length;
    }

    function applyRemote(entries, includeAuto) {
      var added = applyImport(entries, includeAuto);
      data.meta.lastSync = now();
      save();
      return added;
    }

    function counts() {
      var accounts = Object.keys(data.accounts);
      var hidden = 0;
      var pending = 0;
      accounts.forEach(function (key) {
        var account = data.accounts[key];
        if (account.status === "hidden") hidden += 1;
        if (account.status === "pending") pending += 1;
      });
      return { total: accounts.length, hidden: hidden, pending: pending };
    }

    return {
      get data() {
        return data;
      },
      KEY: key,
      reload: reload,
      save: save,
      settings: settings,
      setSetting: setSetting,
      getAccount: getAccount,
      noteAutoHit: noteAutoHit,
      upsertManual: upsertManual,
      confirmAccount: confirmAccount,
      removeAccount: removeAccount,
      dismissAccount: dismissAccount,
      restoreAccount: restoreAccount,
      isWhitelisted: isWhitelisted,
      whitelist: whitelist,
      unwhitelist: unwhitelist,
      getSignCache: getSignCache,
      getTagsCache: getTagsCache,
      exportList: exportList,
      previewImport: previewImport,
      applyImport: applyImport,
      applyRemote: applyRemote,
      counts: counts
    };
  }

  return { createStore: createStore, KEY: KEY };
});

/* ---- src/dom.js ---- */
/* B 站 AI 漫剧屏蔽器 · DOM 隐藏与标记 */
(function (root, factory) {
  var api = factory();
  if (typeof window === "undefined" && typeof module === "object" && module.exports) module.exports = api;
  root.AIS_DOM = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var HIDDEN = "ais-hidden";
  var PLACEHOLDER = "ais-placeholder";
  var SUSPECT = "ais-suspect";
  var MARKING = "ais-marking";
  var FLASH = "ais-flash";

  function createDom(options) {
    var opts = options || {};
    var doc = opts.doc;
    var css = opts.css || "";
    var styleInjected = false;

    function ensureStyle() {
      if (!css || styleInjected) return;
      styleInjected = true;
      if (typeof GM_addStyle === "function") {
        try {
          GM_addStyle(css);
          return;
        } catch (error) {
          /* 退回 style 标签 */
        }
      }
      if (!doc || !doc.createElement) return;
      if (doc.getElementById("ais-style")) return;
      var style = doc.createElement("style");
      style.id = "ais-style";
      style.textContent = css;
      (doc.head || doc.documentElement).appendChild(style);
    }

    ensureStyle();

    function hide(wrapper, usePlaceholder) {
      if (!wrapper || !wrapper.classList) return;
      wrapper.classList.remove(SUSPECT);
      if (usePlaceholder) {
        wrapper.classList.add(PLACEHOLDER);
        wrapper.classList.remove(HIDDEN);
      } else {
        wrapper.classList.add(HIDDEN);
        wrapper.classList.remove(PLACEHOLDER);
      }
      wrapper.setAttribute("data-ais", "hidden");
    }

    function show(wrapper) {
      if (!wrapper || !wrapper.classList) return;
      wrapper.classList.remove(HIDDEN, PLACEHOLDER, SUSPECT, FLASH);
      wrapper.removeAttribute("data-ais");
    }

    function isHidden(wrapper) {
      return !!wrapper && !!wrapper.classList && (wrapper.classList.contains(HIDDEN) || wrapper.classList.contains(PLACEHOLDER));
    }

    function suspect(wrapper) {
      if (!wrapper || !wrapper.classList || isHidden(wrapper)) return;
      wrapper.classList.add(SUSPECT);
    }

    function clearSuspect(wrapper) {
      if (wrapper && wrapper.classList) wrapper.classList.remove(SUSPECT);
    }

    function flash(wrapper) {
      if (!wrapper || !wrapper.classList) return;
      wrapper.classList.add(FLASH);
      setTimeout(function () {
        wrapper.classList.remove(FLASH);
      }, 900);
    }

    function setMarkMode(on) {
      if (!doc || !doc.body) return;
      doc.body.classList.toggle(MARKING, !!on);
    }

    function isMarkMode() {
      return !!(doc && doc.body && doc.body.classList.contains(MARKING));
    }

    return {
      hide: hide,
      show: show,
      isHidden: isHidden,
      suspect: suspect,
      clearSuspect: clearSuspect,
      flash: flash,
      setMarkMode: setMarkMode,
      isMarkMode: isMarkMode
    };
  }

  return { createDom: createDom };
});

/* ---- src/ui.js ---- */
/* B 站 AI 漫剧屏蔽器 · 面板与交互 */
(function (root, factory) {
  var api = factory();
  if (typeof window === "undefined" && typeof module === "object" && module.exports) module.exports = api;
  root.AIS_UI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function createUI(options) {
    var doc = options.doc;
    var store = options.store;
    var dom = options.dom;
    var getState = options.getState;
    var actions = options.actions;

    var tab = "page";
    var markMode = false;
    var toastTimer = null;
    var hoverTimer = null;
    var currentRecord = null;

    function make(tag, className, text) {
      var el = doc.createElement(tag);
      if (className) el.className = className;
      if (text != null) el.textContent = String(text);
      return el;
    }

    function button(label, className, onClick) {
      var el = make("button", "ais-btn " + (className || ""), label);
      el.type = "button";
      el.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      });
      return el;
    }

    function clear(node) {
      while (node.firstChild) node.removeChild(node.firstChild);
    }

    /* ---------- 悬浮球 ---------- */

    var fab = make("button", "ais-fab");
    fab.id = "ais-fab";
    fab.type = "button";
    fab.title = "AI 漫剧屏蔽器";
    var fabCount = make("span", "ais-fab-count", "0");
    fab.appendChild(make("span", "ais-fab-dot", "AI"));
    fab.appendChild(fabCount);
    fab.addEventListener("click", function (event) {
      event.stopPropagation();
      togglePanel();
    });

    /* ---------- 面板 ---------- */

    var panel = make("section", "ais-panel");
    panel.id = "ais-panel";
    panel.hidden = true;

    var panelHead = make("div", "ais-panel-head");
    var panelTitle = make("strong", "", "AI 漫剧屏蔽器");
    var panelClose = button("×", "ais-icon-btn", function () {
      panel.hidden = true;
    });
    panelHead.appendChild(panelTitle);
    panelHead.appendChild(panelClose);

    var tabsBar = make("div", "ais-tabs");
    var tabDefs = [
      ["page", "本页"],
      ["pending", "待确认"],
      ["list", "名单"],
      ["settings", "设置"]
    ];
    var tabButtons = {};
    tabDefs.forEach(function (def) {
      var btn = button(def[1], "ais-tab", function () {
        tab = def[0];
        render();
      });
      btn.dataset.tab = def[0];
      tabButtons[def[0]] = btn;
      tabsBar.appendChild(btn);
    });

    var panelBody = make("div", "ais-panel-body");
    var panelFoot = make("div", "ais-panel-foot", "本地屏蔽，不修改账号 · 名单以 mid 为主键");
    panel.appendChild(panelHead);
    panel.appendChild(tabsBar);
    panel.appendChild(panelBody);
    panel.appendChild(panelFoot);

    /* ---------- 悬停工具条 ---------- */

    var hover = make("div", "ais-hover");
    hover.id = "ais-hover";
    hover.hidden = true;
    var hoverMark = button("屏蔽", "ais-btn-primary", function () {
      if (!currentRecord) return;
      actions.mark(currentRecord.mid, "manual");
      hover.hidden = true;
      toast("已屏蔽 " + (currentRecord.name || currentRecord.mid), function () {
        actions.undoMark();
      });
    });
    hover.appendChild(hoverMark);

    /* ---------- 模态框 ---------- */

    var modal = make("div", "ais-modal");
    modal.id = "ais-modal";
    modal.hidden = true;
    var modalCard = make("div", "ais-modal-card");
    var modalHead = make("div", "ais-modal-head");
    var modalTitle = make("strong", "", "");
    var modalClose = button("×", "ais-icon-btn", function () {
      closeModal();
    });
    modalHead.appendChild(modalTitle);
    modalHead.appendChild(modalClose);
    var modalBody = make("div", "ais-modal-body");
    var modalFoot = make("div", "ais-modal-foot");
    modalCard.appendChild(modalHead);
    modalCard.appendChild(modalBody);
    modalCard.appendChild(modalFoot);
    modal.appendChild(modalCard);
    modal.addEventListener("click", function (event) {
      if (event.target === modal) closeModal();
    });

    /* ---------- Toast ---------- */

    var toastEl = make("div", "ais-toast");
    toastEl.id = "ais-toast";
    toastEl.hidden = true;
    var toastText = make("span", "", "");
    var toastAction = button("撤销", "ais-toast-btn", function () {});
    toastEl.appendChild(toastText);
    toastEl.appendChild(toastAction);

    doc.body.appendChild(fab);
    doc.body.appendChild(panel);
    doc.body.appendChild(hover);
    doc.body.appendChild(modal);
    doc.body.appendChild(toastEl);

    /* ---------- 通用 ---------- */

    function openModal(title, content, buttons) {
      modalTitle.textContent = title;
      clear(modalBody);
      modalBody.appendChild(content);
      clear(modalFoot);
      (buttons || []).forEach(function (item) {
        modalFoot.appendChild(button(item.label, item.primary ? "ais-btn-primary" : "", item.onClick));
      });
      modal.hidden = false;
    }

    function closeModal() {
      modal.hidden = true;
      clear(modalBody);
      clear(modalFoot);
    }

    function toast(message, undo) {
      clearTimeout(toastTimer);
      toastText.textContent = message;
      toastAction.style.display = undo ? "" : "none";
      toastAction.onclick = function () {
        toastEl.hidden = true;
        if (undo) undo();
      };
      toastEl.hidden = false;
      toastTimer = setTimeout(function () {
        toastEl.hidden = true;
      }, 5000);
    }

    function togglePanel() {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) render();
    }

    function accountName(account, mid) {
      return account && account.name ? account.name : "mid " + mid;
    }

    function row(title, subtitle, buttons) {
      var wrap = make("div", "ais-row");
      var main = make("div", "ais-row-main");
      main.appendChild(make("div", "ais-row-title", title));
      if (subtitle) main.appendChild(make("div", "ais-row-sub", subtitle));
      wrap.appendChild(main);
      if (buttons && buttons.length) {
        var side = make("div", "ais-row-side");
        buttons.forEach(function (btn) {
          side.appendChild(btn);
        });
        wrap.appendChild(side);
      }
      return wrap;
    }

    function emptyHint(text) {
      return make("p", "ais-empty", text);
    }

    /* ---------- 各 tab ---------- */

    function renderPage() {
      var state = getState();
      var hidden = [];
      state.records.forEach(function (record) {
        if (dom.isHidden(record.wrapper)) hidden.push(record);
      });
      hidden.sort(function (a, b) {
        return (b.at || 0) - (a.at || 0);
      });

      var head = make("div", "ais-summary");
      head.appendChild(make("span", "ais-summary-num", String(hidden.length)));
      head.appendChild(make("span", "", " 条已隐藏 / 本页共 " + state.records.size + " 条视频"));
      panelBody.appendChild(head);

      if (state.surface.id === "search" && state.records.size > 0) {
        panelBody.appendChild(
          button("把本页所有 UP 加入名单（" + state.records.size + "）", "ais-btn-wide", function () {
            var total = state.records.size;
            openModal(
              "批量标记",
              make(
                "p",
                "",
                "将把本页 " + total + " 个 UP 全部加入名单。之后在主页和搜索页都不再显示他们的视频；单个账号可在「名单」里移除。"
              ),
              [
                {
                  label: "应用",
                  primary: true,
                  onClick: function () {
                    var count = actions.markPage();
                    closeModal();
                    toast("已加入 " + count + " 个账号");
                  }
                },
                { label: "取消", onClick: closeModal }
              ]
            );
          })
        );
      }

      if (hidden.length === 0) {
        panelBody.appendChild(emptyHint("本页暂时没有命中。滚动加载新内容后会自动继续判断。"));
        return;
      }
      panelBody.appendChild(
        button("恢复本页全部（加入白名单）", "ais-btn-wide", function () {
          hidden.forEach(function (record) {
            actions.restore(record.mid);
          });
          toast("已恢复本页 " + hidden.length + " 条");
        })
      );

      hidden.slice(0, 40).forEach(function (record) {
        var subtitle = (record.reasons && record.reasons.length ? record.reasons.join(" · ") : "名单命中") + " · mid " + record.mid;
        panelBody.appendChild(
          row(record.title || "（无标题）", subtitle, [
            button("恢复", "", function () {
              actions.restore(record.mid);
              toast("已恢复并加入白名单");
            })
          ])
        );
      });
    }

    function renderPending() {
      var accounts = store.data.accounts;
      var keys = Object.keys(accounts);
      var pending = keys.filter(function (mid) {
        var account = accounts[mid];
        return account.status === "pending" || account.confidence === "auto";
      });
      if (pending.length === 0) {
        panelBody.appendChild(emptyHint("没有待确认的账号。规则自动命中的账号会先出现在这里。"));
        return;
      }
      panelBody.appendChild(
        button("全部确认（加入名单）", "ais-btn-wide ais-btn-primary", function () {
          actions.confirmMany(pending.map(Number));
          toast("已确认 " + pending.length + " 个账号");
        })
      );
      pending.forEach(function (mid) {
        var account = accounts[mid];
        var subtitle = (account.reasons || []).join(" · ") + " · 命中 " + account.hits + " 次";
        panelBody.appendChild(
          row(accountName(account, mid), subtitle, [
            button("确认", "ais-btn-primary", function () {
              actions.confirm(Number(mid));
              toast("已确认");
            }),
            button("误伤", "", function () {
              actions.dismiss(Number(mid));
              toast("已恢复并加入白名单");
            })
          ])
        );
      });
    }

    function renderList() {
      var counts = store.counts();
      var summary = make("div", "ais-summary");
      summary.appendChild(make("span", "ais-summary-num", String(counts.hidden)));
      summary.appendChild(make("span", "", " 个账号在名单中"));
      panelBody.appendChild(summary);

      var toolbar = make("div", "ais-toolbar");
      toolbar.appendChild(
        button("导出名单", "ais-btn-primary", function () {
          var data = actions.exportList();
          var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
          var url = URL.createObjectURL(blob);
          var link = doc.createElement("a");
          link.href = url;
          link.download = "bili-ai-slop-list.json";
          doc.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(function () {
            URL.revokeObjectURL(url);
          }, 1000);
          toast("已导出 " + data.entries.length + " 个账号");
        })
      );
      toolbar.appendChild(button("导入名单", "", chooseImportFile));
      panelBody.appendChild(toolbar);

      var syncRow = make("div", "ais-sync");
      var urlInput = doc.createElement("input");
      urlInput.type = "url";
      urlInput.className = "ais-input";
      urlInput.placeholder = "订阅地址（可选，raw.githubusercontent.com / jsDelivr）";
      urlInput.value = store.settings().listUrl || "";
      urlInput.addEventListener("change", function () {
        actions.saveSetting("listUrl", urlInput.value.trim());
      });
      syncRow.appendChild(urlInput);
      syncRow.appendChild(
        button("同步", "", function () {
          actions.syncRemote().then(function (result) {
            if (result && result.ok) {
              toast("同步完成，新增 " + result.added + " 个账号");
            } else {
              toast("同步失败：" + ((result && result.error) || "未知错误"));
            }
          });
        })
      );
      panelBody.appendChild(syncRow);

      var keys = Object.keys(store.data.accounts)
        .filter(function (mid) {
          return store.data.accounts[mid].status === "hidden";
        })
        .map(Number)
        .sort(function (a, b) {
          return (store.data.accounts[b].lastSeen || 0) - (store.data.accounts[a].lastSeen || 0);
        });
      if (keys.length === 0) {
        panelBody.appendChild(emptyHint("名单还是空的。在卡片上点「屏蔽这个 UP」即可加入。"));
        return;
      }
      keys.slice(0, 100).forEach(function (mid) {
        var account = store.data.accounts[mid];
        if (!account) return;
        var label = account.confidence === "auto" ? "自动" : account.source === "remote" ? "订阅" : "手动";
        panelBody.appendChild(
          row(accountName(account, mid), label + " · mid " + mid, [
            button("移除", "", function () {
              actions.dismiss(mid);
              toast("已移除并加入白名单");
            })
          ])
        );
      });
    }

    function renderSettings() {
      var settings = store.settings();
      var defs = [
        ["autoHideHigh", "自动隐藏高置信结果", "昵称/标题/简介/标签明确写了 AI 的账号"],
        ["genreMode", "识别漫剧/短剧生产号", "剧场/短剧/漫剧类账号 + 连载模板；会包含非 AI 动态漫"],
        ["mediumBadge", "可疑卡片打角标", "只提示，不隐藏"],
        ["showPlaceholder", "隐藏后保留占位条", "默认直接收起，避免首页留白"],
        ["enrich", "低频读取 UP 简介/标签", "只读公开接口，用于识别简介/标签里自报 AI 的账号"],
        ["remoteList", "启用远程名单", "只隐藏；远程条目默认只信任人工确认的"]
      ];
      defs.forEach(function (def) {
        var label = make("label", "ais-check");
        var input = doc.createElement("input");
        input.type = "checkbox";
        input.checked = !!settings[def[0]];
        input.addEventListener("change", function () {
          actions.saveSetting(def[0], input.checked);
        });
        label.appendChild(input);
        var textWrap = make("span", "", def[1]);
        textWrap.appendChild(make("small", "ais-check-note", def[2]));
        label.appendChild(textWrap);
        panelBody.appendChild(label);
      });
      panelBody.appendChild(
        button("恢复全部（清空白名单）", "", function () {
          var whitelist = store.data.whitelist;
          Object.keys(whitelist).forEach(function (mid) {
            actions.unwhitelist(Number(mid));
          });
          toast("已清空白名单");
        })
      );
    }

    function render() {
      clear(panelBody);
      Object.keys(tabButtons).forEach(function (key) {
        tabButtons[key].classList.toggle("ais-tab-active", key === tab);
      });
      if (tab === "page") renderPage();
      else if (tab === "pending") renderPending();
      else if (tab === "list") renderList();
      else renderSettings();
      var counts = store.counts();
      panelFoot.textContent = "名单 " + counts.hidden + " · 待确认 " + counts.pending + " · 本地屏蔽，不修改账号";
    }

    function refresh(forceRender) {
      var state = getState();
      fabCount.textContent = String(state.hiddenCount);
      fab.classList.toggle("ais-fab-hot", state.hiddenCount > 0);
      if (forceRender && !panel.hidden) render();
    }

    /* ---------- 导入 ---------- */

    function chooseImportFile() {
      var input = doc.createElement("input");
      input.type = "file";
      input.accept = "application/json,.json";
      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          handleImportText(String(reader.result || ""));
        };
        reader.readAsText(file);
      });
      input.click();
    }

    function handleImportText(text) {
      var preview = actions.previewImport(text);
      if (!preview.ok) {
        toast("导入失败：" + preview.error);
        return;
      }
      var box = make("div", "");
      box.appendChild(make("p", "", "共 " + preview.total + " 个账号：人工确认 " + preview.confirmed + " 个，自动识别 " + preview.auto + " 个。"));
      var label = make("label", "ais-check");
      var checkbox = doc.createElement("input");
      checkbox.type = "checkbox";
      label.appendChild(checkbox);
      label.appendChild(make("span", "", "同时导入自动识别的条目"));
      box.appendChild(label);
      openModal("导入名单", box, [
        {
          label: "应用",
          primary: true,
          onClick: function () {
            var added = actions.applyImport(preview.entries, checkbox.checked);
            closeModal();
            toast("已导入 " + added + " 个账号");
            refresh();
          }
        },
        { label: "取消", onClick: closeModal }
      ]);
    }

    /* ---------- 标记模式 ---------- */

    function setMarkMode(next) {
      markMode = !!next;
      actions.setMarkMode(markMode);
      fab.textContent = "";
      fab.appendChild(make("span", "ais-fab-dot", markMode ? "标" : "AI"));
      fab.appendChild(fabCount);
      toast(markMode ? "标记模式：点击卡片即屏蔽该 UP，按 Esc 退出" : "已退出标记模式");
    }

    /* ---------- 事件 ---------- */

    doc.addEventListener(
      "mouseover",
      function (event) {
        var target = event.target;
        if (!target || !target.closest) return;
        if (target.closest("#ais-panel, #ais-fab, #ais-hover, #ais-modal, #ais-toast")) return;
        var state = getState();
        var wrapper = state.surface.wrapperOf(target);
        if (!wrapper) {
          hover.hidden = true;
          return;
        }
        var record = state.records.get(wrapper);
        if (!record) {
          hover.hidden = true;
          return;
        }
        currentRecord = record;
        clearTimeout(hoverTimer);
        var rect = wrapper.getBoundingClientRect();
        hover.style.top = Math.max(8, rect.top + 6) + "px";
        hover.style.left = Math.max(8, rect.left + 6) + "px";
        hover.hidden = false;
      },
      true
    );

    doc.addEventListener(
      "mouseout",
      function (event) {
        if (!currentRecord) return;
        var related = event.relatedTarget;
        if (related && related.closest && related.closest("#ais-hover")) return;
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(function () {
          hover.hidden = true;
        }, 160);
      },
      true
    );

    doc.addEventListener("keydown", function (event) {
      var tagName = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : "";
      if (tagName === "input" || tagName === "textarea" || tagName === "select") return;
      if (event.key === "Escape") {
        if (!modal.hidden) closeModal();
        else if (markMode) setMarkMode(false);
        else if (!panel.hidden) panel.hidden = true;
        return;
      }
      if (event.key === "m" || event.key === "M") {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        event.preventDefault();
        setMarkMode(!markMode);
      }
    });

    return {
      refresh: refresh,
      toast: toast,
      setMarkMode: setMarkMode,
      isMarkMode: function () {
        return markMode;
      },
      toggle: togglePanel
    };
  }

  return { createUI: createUI };
});

/* ---- src/main.js ---- */
/* B 站 AI 漫剧屏蔽器 · 启动、扫描与状态编排 */
(function () {
  "use strict";

  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.top !== window.self) return;

  var core = globalThis.AIS_CORE;
  var surfaces = globalThis.AIS_SURFACES;
  var storeApi = globalThis.AIS_STORE;
  var domApi = globalThis.AIS_DOM;
  var apiApi = globalThis.AIS_API;
  var uiApi = globalThis.AIS_UI;
  if (!core || !surfaces || !storeApi || !domApi || !apiApi || !uiApi) return;

  var surface = surfaces.pick(window.location);
  if (!surface) return;

  function gmGet(key, fallback) {
    try {
      return typeof GM_getValue === "function" ? GM_getValue(key, fallback) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function gmSet(key, value) {
    try {
      if (typeof GM_setValue === "function") GM_setValue(key, value);
    } catch (error) {
      /* 存储写失败时静默，页面功能不受影响 */
    }
  }

  var store = storeApi.createStore({ getValue: gmGet, setValue: gmSet });
  var dom = domApi.createDom({ doc: document, css: globalThis.AIS_CSS || "" });
  var enricher = apiApi.createEnricher({
    cache: store.data.cache,
    onUpdate: function (mid) {
      store.save();
      applyMid(mid);
      if (ui) ui.refresh();
    }
  });

  var records = new Map();
  var byMid = new Map();
  var midCounts = new Map();
  var enriching = new Set();
  var lastMark = null;
  var observer = null;
  var rafId = 0;
  var scanTimer = 0;
  var lastHref = window.location.href;
  var routeContext = getSearchContext();
  var ui = null;

  function getSearchContext() {
    try {
      if (surface.id !== "search") return "";
      return new URLSearchParams(window.location.search).get("keyword") || "";
    } catch (error) {
      return "";
    }
  }

  function countHidden() {
    var count = 0;
    records.forEach(function (record) {
      if (dom.isHidden(record.wrapper)) count += 1;
    });
    return count;
  }

  function getState() {
    return { records: records, surface: surface, hiddenCount: countHidden() };
  }

  function firstRecordOf(mid) {
    var set = byMid.get(mid);
    if (!set || !set.size) return null;
    var iterator = set.values().next();
    return iterator.done ? null : records.get(iterator.value) || null;
  }

  function applyMid(mid) {
    var set = byMid.get(mid);
    if (!set) return;
    Array.from(set).forEach(function (wrapper) {
      var record = records.get(wrapper);
      if (record) evaluate(record, false);
    });
  }

  function applyAll() {
    records.forEach(function (record) {
      evaluate(record, false);
    });
  }

  function scheduleEnrich(record) {
    var mid = record.mid;
    if (!store.settings().enrich || enriching.has(mid) || record.enrichTried) return;
    var density = midCounts.get(mid) || 1;
    var candidate = density >= 2 || core.RE.genre.test(record.title || "");
    if (!candidate) return;
    record.enrichTried = true;
    enriching.add(mid);
    enricher
      .getProfile(mid)
      .then(function (profile) {
        enriching.delete(mid);
        if (profile && profile.sign) evaluate(record, false);
        if (ui) ui.refresh();
      })
      .catch(function () {
        enriching.delete(mid);
      });
  }

  function scheduleTagEnrich(record) {
    if (!record.bvid || record.tagsTried || !store.settings().enrich) return;
    if (store.getTagsCache(record.bvid) || !enricher.canUse()) return;
    record.tagsTried = true;
    enricher
      .getTags(record.bvid)
      .then(function (tags) {
        if (tags && tags.length) {
          store.save();
          evaluate(record, false);
          if (ui) ui.refresh();
        }
      })
      .catch(function () {
        /* 忽略 */
      });
  }

  function evaluate(record, allowEnrich) {
    var mid = record.mid;
    var settings = store.settings();

    if (store.isWhitelisted(mid)) {
      dom.show(record.wrapper);
      return;
    }

    var account = store.getAccount(mid);
    if (account && core.shouldHideAccount(account)) {
      dom.hide(record.wrapper, settings.showPlaceholder);
      return;
    }

    var sign = store.getSignCache(mid) || "";
    var tags = store.getTagsCache(record.bvid) || [];
    var result = core.scoreCard({
      name: record.name,
      title: record.title,
      sign: sign,
      tags: tags,
      density: midCounts.get(mid) || 1,
      context: routeContext,
      genreMode: settings.genreMode
    });
    record.score = result;
    record.reasons = result.reasons;

    if (result.confidence === "high" && settings.autoHideHigh) {
      dom.hide(record.wrapper, settings.showPlaceholder);
      if (!record.noted) {
        record.noted = true;
        var auto = store.noteAutoHit(mid, {
          name: record.name,
          reasons: result.reasons,
          sample: record.title
        });
        if (auto && auto.status === "hidden") applyMid(mid);
        if (ui) ui.refresh();
      }
      return;
    }

    if (result.confidence === "medium" && settings.mediumBadge) {
      dom.suspect(record.wrapper);
    } else if (result.confidence === "high") {
      dom.suspect(record.wrapper);
    } else {
      dom.show(record.wrapper);
    }

    if (allowEnrich && !sign && result.confidence !== "high") {
      scheduleEnrich(record);
    }
    if (allowEnrich && result.confidence === "medium") {
      scheduleTagEnrich(record);
    }
  }

  function processCard(candidate) {
    if (!candidate) return;
    var wrapper = (surface.wrapperOf && surface.wrapperOf(candidate)) || candidate;
    if (!wrapper || records.has(wrapper)) return;
    if (surface.ignored && surface.ignored(wrapper)) return;
    var record = surface.read(wrapper);
    if (!record) return;
    record.at = Date.now();
    record.noted = false;
    record.score = null;
    record.tagsTried = false;
    records.set(wrapper, record);

    var set = byMid.get(record.mid);
    if (!set) {
      set = new Set();
      byMid.set(record.mid, set);
    }
    set.add(wrapper);
    midCounts.set(record.mid, (midCounts.get(record.mid) || 0) + 1);

    evaluate(record, true);
    if (midCounts.get(record.mid) === 2) applyMid(record.mid);
  }

  function scanNode(node) {
    if (!node || node.nodeType !== 1) return;
    var selector = surface.cardSelector;
    if (node.matches && node.matches(selector)) processCard(node);
    if (node.querySelectorAll) {
      var found = node.querySelectorAll(selector);
      for (var i = 0; i < found.length; i += 1) processCard(found[i]);
    }
    if (node.closest) {
      var wrapper = node.closest(selector);
      if (wrapper) processCard(wrapper);
    }
  }

  function flushNodes() {
    rafId = 0;
    prune();
    if (ui) ui.refresh();
  }

  function queueNode(node) {
    scanNode(node);
    if (!rafId) rafId = requestAnimationFrame(flushNodes);
  }

  function prune() {
    records.forEach(function (record, wrapper) {
      if (wrapper.isConnected) return;
      records.delete(wrapper);
      var set = byMid.get(record.mid);
      if (set) {
        set.delete(wrapper);
        if (!set.size) byMid.delete(record.mid);
      }
      var left = (midCounts.get(record.mid) || 1) - 1;
      if (left <= 0) midCounts.delete(record.mid);
      else midCounts.set(record.mid, left);
    });
  }

  function scanAll() {
    prune();
    surface.getCards(document).forEach(processCard);
    if (ui) ui.refresh();
  }

  function resetForRoute() {
    records.forEach(function (record) {
      dom.show(record.wrapper);
    });
    records.clear();
    byMid.clear();
    midCounts.clear();
    enriching.clear();
    lastMark = null;
    routeContext = getSearchContext();
    clearTimeout(scanTimer);
    scanTimer = setTimeout(function () {
      scanAll();
      if (ui) ui.refresh(true);
    }, 350);
  }

  function checkRoute() {
    if (window.location.href === lastHref) return;
    lastHref = window.location.href;
    resetForRoute();
  }

  function markPage() {
    var mids = new Set();
    records.forEach(function (record) {
      mids.add(record.mid);
    });
    mids.forEach(function (mid) {
      var record = firstRecordOf(mid);
      if (!record) return;
      store.upsertManual(mid, {
        name: record.name,
        reason: "搜索页批量标记",
        sample: record.title
      });
    });
    applyAll();
    if (ui) ui.refresh(true);
    return mids.size;
  }

  function mark(mid, mode) {
    var record = firstRecordOf(mid);
    if (!record) return;
    var previous = store.upsertManual(mid, {
      name: record.name,
      reason: mode === "manual" ? "手动标记" : "AI 漫剧",
      sample: record.title
    });
    lastMark = { mid: mid, previous: previous };
    applyMid(mid);
    if (ui) ui.refresh(true);
  }

  function undoMark() {
    if (!lastMark) return;
    store.restoreAccount(lastMark.mid, lastMark.previous);
    applyMid(lastMark.mid);
    lastMark = null;
    if (ui) ui.refresh(true);
  }

  function restore(mid) {
    store.dismissAccount(mid);
    applyMid(mid);
    if (ui) ui.refresh(true);
  }

  function confirmAccount(mid) {
    store.confirmAccount(mid);
    applyMid(mid);
    if (ui) ui.refresh(true);
  }

  function confirmMany(mids) {
    (mids || []).forEach(function (mid) {
      store.confirmAccount(mid);
    });
    applyAll();
    if (ui) ui.refresh(true);
  }

  function dismissAccount(mid) {
    store.dismissAccount(mid);
    applyMid(mid);
    if (ui) ui.refresh(true);
  }

  function saveSetting(name, value) {
    if (!store.setSetting(name, value)) return;
    if (name === "autoHideHigh" || name === "mediumBadge" || name === "showPlaceholder" || name === "genreMode") {
      applyAll();
    }
    if (ui) ui.refresh();
  }

  function exportList() {
    return store.exportList({ includeAuto: false });
  }

  function previewImport(text) {
    return store.previewImport(text);
  }

  function applyImport(entries, includeAuto) {
    var added = store.applyImport(entries, includeAuto);
    applyAll();
    if (ui) ui.refresh(true);
    return added;
  }

  function syncRemote() {
    var url = (store.settings().listUrl || "").trim();
    if (!url) return Promise.resolve({ ok: false, error: "请先填写订阅地址" });
    if (!/^https:\/\//i.test(url)) return Promise.resolve({ ok: false, error: "订阅地址必须是 https" });
    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, 8000);
    return fetch(url, { credentials: "omit", signal: controller.signal, cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.text();
      })
      .then(function (text) {
        var parsed = core.parseList(text);
        if (!parsed.ok) return { ok: false, error: parsed.error };
        var added = store.applyRemote(parsed.entries, false);
        applyAll();
        if (ui) ui.refresh(true);
        return { ok: true, added: added };
      })
      .catch(function (error) {
        return { ok: false, error: error && error.message ? error.message : "网络错误" };
      })
      .finally(function () {
        clearTimeout(timer);
      });
  }

  var actions = {
    mark: mark,
    markPage: markPage,
    undoMark: undoMark,
    restore: restore,
    confirm: confirmAccount,
    confirmMany: confirmMany,
    dismiss: dismissAccount,
    unwhitelist: function (mid) {
      store.unwhitelist(mid);
      applyMid(mid);
      if (ui) ui.refresh(true);
    },
    saveSetting: saveSetting,
    setMarkMode: function (on) {
      dom.setMarkMode(on);
    },
    exportList: exportList,
    previewImport: previewImport,
    applyImport: applyImport,
    syncRemote: syncRemote
  };

  ui = uiApi.createUI({
    doc: document,
    store: store,
    dom: dom,
    getState: getState,
    actions: actions
  });

  document.addEventListener(
    "click",
    function (event) {
      if (!dom.isMarkMode()) return;
      var target = event.target;
      if (!target || !target.closest) return;
      if (target.closest("#ais-panel, #ais-fab, #ais-hover, #ais-modal, #ais-toast")) return;
      var wrapper = surface.wrapperOf(target);
      if (!wrapper) return;
      var record = records.get(wrapper);
      if (!record) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      mark(record.mid, "manual");
      if (ui) ui.toast("已屏蔽 " + (record.name || record.mid) + "，按 Esc 退出标记模式", undoMark);
    },
    true
  );

  function startObserver() {
    observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j += 1) {
          if (added[j] && added[j].nodeType === 1) queueNode(added[j]);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  ["pushState", "replaceState"].forEach(function (name) {
    var original = history[name];
    if (typeof original !== "function") return;
    history[name] = function () {
      var result = original.apply(this, arguments);
      setTimeout(checkRoute, 0);
      return result;
    };
  });
  window.addEventListener("popstate", checkRoute);

  if (typeof GM_registerMenuCommand === "function") {
    GM_registerMenuCommand("打开 AI 漫剧屏蔽器面板", function () {
      if (ui) ui.toggle();
    });
    GM_registerMenuCommand("切换标记模式（快捷键 M）", function () {
      if (ui) ui.setMarkMode(!ui.isMarkMode());
    });
  }

  scanAll();
  startObserver();
  setInterval(function () {
    prune();
    checkRoute();
  }, 10000);

  function maybeSyncRemote() {
    var settings = store.settings();
    if (!settings.remoteList || !settings.listUrl) return;
    if (Date.now() - (store.data.meta.lastSync || 0) < 24 * 60 * 60 * 1000) return;
    syncRemote();
  }

  setTimeout(maybeSyncRemote, 1500);
})();

})();

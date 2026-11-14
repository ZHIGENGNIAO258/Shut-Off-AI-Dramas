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
    if (!record.title) {
      var reread = surface.read(record.wrapper);
      if (reread && reread.title) record.title = reread.title;
    }
    // 旧版本创建的账号可能没有样本标题：碰到卡片就补一条
    if (account && (!Array.isArray(account.samples) || account.samples.length === 0) && record.title) {
      store.addSample(mid, record.title);
    }
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

  function addManual(mid, name) {
    if (!Number.isSafeInteger(mid) || mid <= 0) return { ok: false, error: "mid 不合法" };
    if (store.getAccount(mid)) return { ok: false, error: "该账号已在名单或待确认中" };
    store.unwhitelist(mid);
    store.upsertManual(mid, { name: name || "", reason: "手动添加" });
    applyMid(mid);
    if (ui) ui.refresh(true);
    return { ok: true };
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
        var merged = store.applyRemote(parsed.entries, false);
        applyAll();
        if (ui) ui.refresh(true);
        return { ok: true, added: merged.added, upgraded: merged.upgraded, total: parsed.entries.length };
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
    addManual: addManual,
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

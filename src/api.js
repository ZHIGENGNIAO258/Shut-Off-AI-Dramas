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

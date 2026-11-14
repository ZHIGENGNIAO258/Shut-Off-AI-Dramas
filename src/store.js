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
    applyDefaultListUrl();

    // 老版本把 listUrl 存成空串：只在第一次升级时填默认仓库地址，
    // 之后用户手动清空就保持清空，不再反复写回。
    function applyDefaultListUrl() {
      if (!data.meta) data.meta = { listVersion: "", lastSync: 0 };
      if (data.meta.defaultListApplied) return;
      if (!data.settings.listUrl && core.DEFAULT_LIST_URL) {
        data.settings.listUrl = core.DEFAULT_LIST_URL;
      }
      data.meta.defaultListApplied = true;
      save();
    }

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
      var merged = core.mergeAccounts(data.accounts, entries, {
        includeAuto: !!includeAuto,
        tombstones: data.tombstones
      });
      data.accounts = merged.accounts;
      data.meta.lastSync = now();
      data.meta.lastSyncCount = (entries || []).length;
      save();
      return { added: merged.added.length, upgraded: (merged.upgraded || []).length };
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

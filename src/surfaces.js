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
        // 顶部 head-cards 是轮播，跳过以免破坏轮播布局
        return !el.closest(".head-cards");
      });
    },
    wrapperOf: function (target) {
      if (!target || typeof target.closest !== "function") return null;
      var card = target.closest(".bili-video-card, .video-card");
      if (!card) return null;
      return card.closest(".feed-card") || card;
    },
    ignored: function (element) {
      return !!(element && element.closest && element.closest(".head-cards"));
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

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
    if (core && typeof core.cleanName === "function") return core.cleanName(value);
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

  // 首页有两种卡片：
  //   服务端渲染的首屏：.feed-card > .bili-feed-card > .bili-video-card
  //   Vue 水合/滚动追加：      .bili-feed-card > .bili-video-card（没有 .feed-card 包裹）
  //   骨架占位：                .bili-video-card 直接作为网格单元
  // 隐藏单元要落在网格单元上：优先 .feed-card，其次 .bili-feed-card，最后卡片自身。
  var HOME_SELECTOR = ".feed-card, .bili-feed-card, .bili-video-card";

  function homeWrapperOf(target) {
    if (!target || typeof target.closest !== "function") return null;
    var cell = target.closest(".feed-card, .bili-feed-card, .bili-video-card");
    if (!cell) return null;
    return cell.closest(".feed-card") || cell.closest(".bili-feed-card") || cell;
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
    cardSelector: HOME_SELECTOR,
    getCards: function (root) {
      return Array.prototype.slice.call(root.querySelectorAll(this.cardSelector));
    },
    wrapperOf: function (target) {
      return homeWrapperOf(target);
    },
    // 轮播/骨架区只用作占位，隐藏会打乱布局
    ignored: function (element) {
      return !!(element && element.closest && element.closest(".recommended-swipe"));
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

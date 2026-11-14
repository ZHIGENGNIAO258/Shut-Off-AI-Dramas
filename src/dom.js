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

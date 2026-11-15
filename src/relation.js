/* B 站 AI 漫剧屏蔽器 · 关系操作（拉黑 / 取消拉黑）
 * 写操作，只在用户点击时触发；不自动执行。 */
(function (root, factory) {
  var api = factory();
  if (typeof window === "undefined" && typeof module === "object" && module.exports) module.exports = api;
  root.AIS_RELATION = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var ENDPOINT = "https://api.bilibili.com/x/relation/modify";
  var BLOCK_ACT = 5;
  var UNBLOCK_ACT = 6;

  function readCookie(name) {
    if (typeof document === "undefined" || !document.cookie) return "";
    var match = document.cookie.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : "";
  }

  function csrfToken() {
    return readCookie("bili_jct");
  }

  function status() {
    return {
      loggedIn: !!readCookie("DedeUserID"),
      csrf: !!csrfToken()
    };
  }

  function describe(code, message) {
    if (code === -101) return "账号未登录，请先登录 B 站";
    if (code === -111) return "CSRF 校验失败，刷新页面后重试";
    if (code === -352) return "触发 B 站风控，请稍后再试";
    if (code === -400) return "请求参数错误";
    if (code === -404) return "用户不存在";
    if (code === 22003) return "目标用户不存在或已注销";
    return message || "B 站返回错误码 " + code;
  }

  function modify(mid, act) {
    var target = Number(mid);
    if (!Number.isSafeInteger(target) || target <= 0) {
      return Promise.resolve({ ok: false, error: "mid 不合法" });
    }
    var token = csrfToken();
    if (!token) {
      return Promise.resolve({ ok: false, error: "未登录或缺少 CSRF（bili_jct），请先登录 B 站并刷新" });
    }
    if (act === BLOCK_ACT && readCookie("DedeUserID") === String(target)) {
      return Promise.resolve({ ok: false, error: "不能拉黑自己" });
    }
    var body = "fid=" + encodeURIComponent(target) + "&act=" + act + "&re_src=11&csrf=" + encodeURIComponent(token);
    return fetch(ENDPOINT, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body
    })
      .then(function (response) {
        return response.text();
      })
      .then(function (text) {
        var data = null;
        try {
          data = JSON.parse(text);
        } catch (error) {
          return { ok: false, error: "B 站返回了非 JSON 响应" };
        }
        if (data && data.code === 0) return { ok: true, code: 0, error: "" };
        var code = data && typeof data.code === "number" ? data.code : -1;
        return { ok: false, code: code, error: describe(code, data && data.message) };
      })
      .catch(function (error) {
        return {
          ok: false,
          error: "网络错误：" + ((error && error.message) || "请求失败") + "（可在 www.bilibili.com 页面重试）"
        };
      });
  }

  function block(mid) {
    return modify(mid, BLOCK_ACT);
  }

  function unblock(mid) {
    return modify(mid, UNBLOCK_ACT);
  }

  return {
    BLOCK_ACT: BLOCK_ACT,
    UNBLOCK_ACT: UNBLOCK_ACT,
    status: status,
    csrfToken: csrfToken,
    block: block,
    unblock: unblock
  };
});

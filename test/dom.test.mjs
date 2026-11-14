import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url);
const surfaces = require("../src/surfaces.js");
const domApi = require("../src/dom.js");

function cardHtml({ mid = "354399065", name = "熊猫小圣AIGC", title = "《潮尸》第一集", bvid = "BV16LxM6sEdo" } = {}) {
  return `
    <div class="feed-card">
      <div class="bili-video-card">
        <a href="//www.bilibili.com/video/${bvid}" title="${title}">
          <h3 class="bili-video-card__info--tit" title="${title}">${title}</h3>
        </a>
        <div class="bili-video-card__info--bottom">
          <a class="bili-video-card__info--owner" href="//space.bilibili.com/${mid}">
            <svg class="bili-video-card__info--author-ico"></svg>
            <span class="bili-video-card__info--author">${name}</span>
          </a>
        </div>
      </div>
    </div>`;
}

function page(body, url) {
  return new JSDOM(`<!doctype html><html><head></head><body>${body}</body></html>`, { url });
}

test("主页适配：读取 mid、昵称、标题、BV 号", () => {
  const dom = page(`<div class="feed2"><div class="container">${cardHtml()}<div class="feed-card"><div class="ad">广告</div></div></div></div>`, "https://www.bilibili.com/");
  const surface = surfaces.pick(dom.window.location);
  assert.equal(surface.id, "home");

  const cards = surface.getCards(dom.window.document);
  assert.equal(cards.length, 2);

  const record = surface.read(cards[0]);
  assert.equal(record.mid, 354399065);
  assert.equal(record.name, "熊猫小圣AIGC");
  assert.equal(record.title, "《潮尸》第一集");
  assert.equal(record.bvid, "BV16LxM6sEdo");

  assert.equal(surface.read(cards[1]), null);
});

test("搜索页适配：只取带视频卡片的列", () => {
  const dom = page(
    `<div class="video-list row">
      <div class="col_3">${cardHtml({ mid: "123", name: "六翼动漫", title: "狼皇归来 第5集" })}</div>
      <div class="col_3"><div class="ad">推广</div></div>
    </div>`,
    "https://search.bilibili.com/all?keyword=%E6%BC%AB%E5%89%A7"
  );
  const surface = surfaces.pick(dom.window.location);
  assert.equal(surface.id, "search");

  const cards = surface.getCards(dom.window.document);
  assert.equal(cards.length, 1);
  const record = surface.read(cards[0]);
  assert.equal(record.mid, 123);
  assert.equal(record.name, "六翼动漫");
});

test("隐藏、恢复与占位条", () => {
  const dom = page(`<div class="feed2">${cardHtml()}</div>`, "https://www.bilibili.com/");
  const doc = dom.window.document;
  const wrapper = doc.querySelector(".feed-card");
  const hider = domApi.createDom({ doc, css: ".ais-hidden{display:none}" });

  hider.hide(wrapper);
  assert.equal(wrapper.classList.contains("ais-hidden"), true);
  assert.equal(hider.isHidden(wrapper), true);

  hider.show(wrapper);
  assert.equal(wrapper.classList.contains("ais-hidden"), false);
  assert.equal(hider.isHidden(wrapper), false);

  hider.hide(wrapper, true);
  assert.equal(wrapper.classList.contains("ais-placeholder"), true);
  assert.equal(hider.isHidden(wrapper), true);

  hider.show(wrapper);
  assert.equal(hider.isHidden(wrapper), false);
});

test("可疑角标与标记模式", () => {
  const dom = page(`<div class="feed2">${cardHtml()}</div>`, "https://www.bilibili.com/");
  const doc = dom.window.document;
  const wrapper = doc.querySelector(".feed-card");
  const hider = domApi.createDom({ doc, css: "" });

  hider.suspect(wrapper);
  assert.equal(wrapper.classList.contains("ais-suspect"), true);
  hider.clearSuspect(wrapper);
  assert.equal(wrapper.classList.contains("ais-suspect"), false);

  hider.setMarkMode(true);
  assert.equal(doc.body.classList.contains("ais-marking"), true);
  hider.setMarkMode(false);
  assert.equal(doc.body.classList.contains("ais-marking"), false);
});

test("非目标页面不匹配任何适配器", () => {
  assert.equal(surfaces.pick(new URL("https://www.bilibili.com/video/BV1xx")), null);
  assert.equal(surfaces.pick(new URL("https://space.bilibili.com/1")), null);
});

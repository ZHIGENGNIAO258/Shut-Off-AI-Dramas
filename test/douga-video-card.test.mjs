import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url);
const surfaces = require("../src/surfaces.js");

function page(body, url) {
  return new JSDOM(`<!doctype html><html><head></head><body>${body}</body></html>`, { url });
}

test("动画分区：兼容只有 video-card 类的卡片", () => {
  const dom = page(
    `<div class="feed-cards">
      <div class="feed-card">
        <div class="video-card">
          <a href="https://www.bilibili.com/video/BV1aa">
            <div class="video-card__title">某AI漫剧 第1集</div>
          </a>
          <a class="video-card__author" href="https://space.bilibili.com/123"><span>测试漫馆 · 10-24</span></a>
        </div>
      </div>
    </div>`,
    "https://www.bilibili.com/c/douga/"
  );
  const surface = surfaces.pick(dom.window.location);
  const cards = surface.getCards(dom.window.document);
  assert.equal(cards.length, 1);
  const record = surface.read(cards[0]);
  assert.equal(record.mid, 123);
  assert.equal(record.name, "测试漫馆");
  assert.equal(record.title, "某AI漫剧 第1集");
  assert.equal(surface.wrapperOf(cards[0].querySelector(".video-card__title")).className, "feed-card");
});

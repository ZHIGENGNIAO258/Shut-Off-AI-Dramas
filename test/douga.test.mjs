import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url);
const surfaces = require("../src/surfaces.js");

function page(body, url) {
  return new JSDOM(`<!doctype html><html><head></head><body>${body}</body></html>`, { url });
}

test("动画分区（/c/douga/）适配：识别标题、UP 名并去掉日期后缀", () => {
  const dom = page(
    `<div class="channel-page__body">
      <div class="bili-video-card">
        <div class="bili-video-card__wrap">
          <a href="https://www.bilibili.com/video/BV1L7eY6zEMA">
            <div class="bili-video-card__title" title="东堂葵的日常">东堂葵的日常</div>
          </a>
          <div class="bili-video-card__subtitle">
            <a class="bili-video-card__author" href="https://space.bilibili.com/387245471?spm_id_from=333">
              <div class="bili-video-card__text"><span></span></div>
              <div class="bili-video-card__text"><span>测试UP · 10-24</span></div>
            </a>
          </div>
        </div>
      </div>
    </div>`,
    "https://www.bilibili.com/c/douga/"
  );
  const surface = surfaces.pick(dom.window.location);
  assert.equal(surface.id, "douga");

  const cards = surface.getCards(dom.window.document);
  assert.equal(cards.length, 1);
  const record = surface.read(cards[0]);
  assert.equal(record.mid, 387245471);
  assert.equal(record.name, "测试UP");
  assert.equal(record.title, "东堂葵的日常");
  assert.equal(record.bvid, "BV1L7eY6zEMA");
  assert.equal(surface.wrapperOf(cards[0].querySelector(".bili-video-card__title")), cards[0]);
});

test("动画分区顶部 head-cards 轮播不处理", () => {  const dom = page(
    `<div class="head-cards">
      <div class="feed-card head-card">
        <div class="bili-video-card">
          <a href="https://www.bilibili.com/video/BV1aa"><div class="bili-video-card__title">轮播</div></a>
          <a class="bili-video-card__author" href="https://space.bilibili.com/1"><span>轮播UP · 10-01</span></a>
        </div>
      </div>
    </div>`,
    "https://www.bilibili.com/c/douga/"
  );
  const surface = surfaces.pick(dom.window.location);
  assert.equal(surface.getCards(dom.window.document).length, 0);
});

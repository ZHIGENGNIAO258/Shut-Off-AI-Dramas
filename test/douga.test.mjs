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

test("动画分区前三行（head-cards 网格）照样处理，只跳过真正的轮播 slide", () => {
  const card = (bvid, mid, title) =>
    `<div class="feed-card head-card">
      <div class="bili-video-card video-card">
        <div class="bili-video-card__wrap">
          <a href="https://www.bilibili.com/video/${bvid}"><div class="bili-video-card__title" title="${title}">${title}</div></a>
          <a class="bili-video-card__author" href="https://space.bilibili.com/${mid}"><span>测试UP · 10-01</span></a>
        </div>
      </div>
    </div>`;

  const dom = page(
    `<div class="head-cards">
      <div class="banner-carousel channel-carousel">
        <div class="vui_carousel__slides">
          <div class="vui_carousel__slide">
            <div class="bili-video-card"><a href="https://www.bilibili.com/video/BVcar"><div class="bili-video-card__title">轮播图</div></a></div>
          </div>
        </div>
      </div>
      ${card("BV1aa", 11, "第一行卡片")}
      ${card("BV1bb", 12, "第二行卡片")}
      ${card("BV1cc", 13, "第三行卡片")}
    </div>
    <div class="feed-cards">${card("BV1dd", 14, "第四行卡片")}</div>`,
    "https://www.bilibili.com/c/douga/"
  );
  const surface = surfaces.pick(dom.window.location);
  const cards = surface.getCards(dom.window.document);
  assert.equal(cards.length, 4, "头部 3 张 + 网格 1 张，轮播 slide 内的卡片跳过");

  const headCard = cards[0].closest(".feed-card");
  assert.ok(headCard.classList.contains("head-card"));
  assert.equal(surface.wrapperOf(cards[0].querySelector(".bili-video-card__title")), headCard);
  const record = surface.read(headCard);
  assert.equal(record.mid, 11);
  assert.equal(record.title, "第一行卡片");
});

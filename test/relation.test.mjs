import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url);
const relation = require("../src/relation.js");

async function withEnv(cookie, respond, fn) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://www.bilibili.com/" });
  if (cookie) cookie.split(";").forEach((pair) => { dom.window.document.cookie = pair.trim(); });
  const prevDocument = globalThis.document;
  const prevFetch = globalThis.fetch;
  const calls = [];
  globalThis.document = dom.window.document;
  globalThis.fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve({ text: () => Promise.resolve(respond(options)) });
  };
  try {
    return await fn(calls);
  } finally {
    globalThis.document = prevDocument;
    globalThis.fetch = prevFetch;
    dom.window.close();
  }
}

test("未登录时直接报错，不发请求", async () => {
  await withEnv("", () => '{"code":0}', async (calls) => {
    assert.equal(relation.status().loggedIn, false);
    const result = await relation.block(123);
    assert.equal(result.ok, false);
    assert.match(result.error, /未登录|CSRF/);
    assert.equal(calls.length, 0);
  });
});

test("拉黑：带上 fid/act/csrf 并携带登录态", async () => {
  await withEnv("bili_jct=token123; DedeUserID=1", () => '{"code":0}', async (calls) => {
    assert.equal(relation.status().loggedIn, true);
    const result = await relation.block(98765);
    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    const { url, options } = calls[0];
    assert.equal(url, "https://api.bilibili.com/x/relation/modify");
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "include");
    assert.match(options.body, /fid=98765/);
    assert.match(options.body, /act=5/);
    assert.match(options.body, /csrf=token123/);
  });
});

test("取消拉黑使用 act=6", async () => {
  await withEnv("bili_jct=token123; DedeUserID=1", () => '{"code":0}', async (calls) => {
    const result = await relation.unblock(98765);
    assert.equal(result.ok, true);
    assert.match(calls[0].options.body, /act=6/);
  });
});

test("风控与 CSRF 错误会翻译成中文提示", async () => {
  await withEnv("bili_jct=token123; DedeUserID=1", () => '{"code":-352,"message":"blocked"}', async () => {
    const result = await relation.block(123);
    assert.equal(result.ok, false);
    assert.equal(result.code, -352);
    assert.match(result.error, /风控/);
  });
  await withEnv("bili_jct=token123; DedeUserID=1", () => '{"code":-111,"message":"csrf"}', async () => {
    const result = await relation.block(123);
    assert.equal(result.ok, false);
    assert.match(result.error, /CSRF/);
  });
});

test("不能拉黑自己", async () => {
  await withEnv("bili_jct=token123; DedeUserID=42", () => '{"code":0}', async (calls) => {
    const result = await relation.block(42);
    assert.equal(result.ok, false);
    assert.match(result.error, /自己/);
    assert.equal(calls.length, 0);
  });
});


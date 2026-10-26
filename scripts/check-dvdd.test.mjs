import assert from "node:assert/strict";
import { test } from "node:test";
import { checkDvdd } from "./check-dvdd.mjs";

function form(fields) {
  return new Response(`<form>${fields.map((name) => `<input name="${name}">`).join("")}</form>`);
}

test("checks only anonymous GET forms and the non-billable OTP function", async () => {
  const calls = [];
  const report = await checkDvdd(async (input, options) => {
    const url = new URL(input);
    calls.push(url);
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "manual");
    assert.equal(options.cache, "no-store");
    assert.equal(options.body, undefined);
    assert.equal(new Headers(options.headers).has("cookie"), false);
    assert.equal(new Headers(options.headers).has("authorization"), false);
    if (url.pathname === "/login.php") return form(["emailAddress", "pass", "sessionKey"]);
    if (url.pathname === "/register.php") return form(["name", "emailAddress", "phone", "pass", "repass", "register"]);
    assert.equal(url.origin, "https://api.dvdd-api.workers.dev");
    assert.equal(url.searchParams.get("func"), "getOtp");
    assert.equal(url.searchParams.get("apiKey"), "otpflash-network-check-invalid");
    return Response.json({ success: 0, message: "Thông tin tài khoản không đúng" });
  });
  assert.equal(report.ok, true);
  assert.equal(calls.length, 3);
  assert.deepEqual(report.results.map((result) => result.code), [
    "FORM_AVAILABLE", "FORM_AVAILABLE", "API_REACHABLE_INVALID_TEST_KEY",
  ]);
});

test("Cloudflare rejection and a HTTP 200 challenge cannot pass as a usable form", async () => {
  const report = await checkDvdd(async (input) => {
    const url = new URL(input);
    if (url.pathname === "/login.php") return new Response("private-response-body", { status: 403 });
    if (url.pathname === "/register.php") return new Response("<html>Just a moment...</html>");
    return Response.json({ success: false });
  });
  assert.equal(report.ok, false);
  assert.deepEqual(report.results.map((result) => result.code), [
    "ACCESS_DENIED", "FORM_UNAVAILABLE", "API_REACHABLE_INVALID_TEST_KEY",
  ]);
  assert.doesNotMatch(JSON.stringify(report), /private-response-body|Just a moment/);
});

test("network errors do not retry or disclose exception details", async () => {
  let calls = 0;
  const report = await checkDvdd(async () => {
    calls++;
    throw new Error("private-exception-details");
  });
  assert.equal(report.ok, false);
  assert.equal(calls, 3);
  assert.ok(report.results.every((result) => result.code === "CHECK_FAILED"));
  assert.doesNotMatch(JSON.stringify(report), /private-exception-details/);
});

test("oversized and non-JSON API responses fail without retaining their bodies", async () => {
  const report = await checkDvdd(async (input) => {
    if (new URL(input).pathname === "/register.php") {
      return new Response("private-body", { headers: { "content-length": "2000001" } });
    }
    if (new URL(input).pathname === "/login.php") return new Response("x".repeat(2_000_001));
    return new Response("private-api-body");
  });
  assert.equal(report.ok, false);
  assert.deepEqual(report.results.map((result) => result.code), [
    "CHECK_FAILED", "CHECK_FAILED", "UNEXPECTED_API_RESPONSE",
  ]);
  assert.doesNotMatch(JSON.stringify(report), /private-body|private-api-body/);
});

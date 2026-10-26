import { expect, test, type BrowserContext } from "@playwright/test";
import { NextRequest, NextResponse } from "next/server";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  decodeAccountSession,
  persistAccountSession,
} from "../src/lib/server/account-session";
import {
  ACCOUNT_COOKIE,
  CREDENTIAL_COOKIE,
  decryptToken,
} from "../src/lib/server/credentials";

const connection = { configured: true, source: "session", accountId: "fixture-account" };
const snapshot = {
  profile: { name: "Người Dùng Thử", email: "fixture@example.test", phone: "0912345678", balance: 98765 },
  orders: [], transactions: [], transactionPage: 1, transactionPages: 1,
  phonePages: 1, warnings: [], updatedAt: new Date().toISOString(),
};

test("restoring a session never shows the login form during loading or a temporary DVDD error", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let phase: "loading" | "ready" | "unavailable" = "loading";
  let loginPosts = 0;
  await page.route("**/api/connection", (route) => route.fulfill({ json: connection }));
  await page.route("**/api/account", (route) => {
    if (route.request().method() === "POST") loginPosts++;
    return route.abort();
  });
  await page.route("**/api/account?*", async (route) => {
    if (phase === "loading") await pending;
    if (phase === "unavailable")
      return route.fulfill({ status: 502, json: { success: false, message: "DVDD tạm thời không phản hồi." } });
    return route.fulfill({ json: { success: true, connected: true, data: snapshot } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Tài khoản DVDD", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Đang khôi phục phiên đăng nhập" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đăng nhập & kết nối", exact: true })).toHaveCount(0);
  phase = "ready";
  release();
  await expect(page.locator(".account-profile .dvdd-balance strong")).toHaveText("98.765đ");

  phase = "unavailable";
  await page.reload();
  await page.getByRole("button", { name: "Tài khoản DVDD", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Chưa khôi phục được tài khoản" })).toBeVisible();
  await expect(page.locator(".account-session-state").getByRole("alert")).toContainText("DVDD tạm thời không phản hồi");
  await expect(page.getByRole("button", { name: "Đăng nhập & kết nối", exact: true })).toHaveCount(0);
  phase = "ready";
  await page.getByRole("button", { name: "Thử khôi phục lại" }).click();
  await expect(page.locator(".account-profile .dvdd-balance strong")).toHaveText("98.765đ");
  expect(loginPosts).toBe(0);
});

test("a failed connection check can be retried without losing an existing account session", async ({ page }) => {
  let configured = false;
  let accountReads = 0;
  await page.route("**/api/connection", (route) => configured
    ? route.fulfill({ json: connection })
    : route.fulfill({ status: 503, json: { success: false, code: "SESSION_CONFIGURATION_REQUIRED" } }));
  await page.route("**/api/account?*", (route) => {
    accountReads++;
    return route.fulfill({ json: { success: true, connected: true, data: snapshot } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Tài khoản DVDD", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Chưa khôi phục được tài khoản" })).toBeVisible();
  expect(accountReads).toBe(0);
  configured = true;
  await page.getByRole("button", { name: "Thử khôi phục lại" }).click();
  await expect(page.locator(".account-profile .dvdd-balance strong")).toHaveText("98.765đ");
});

test("saved account and token cookies restore after closing and restarting the browser", async ({ playwright }) => {
  const directory = await mkdtemp(join(tmpdir(), "dvdd-browser-session-test-"));
  const response = persistAccountSession(
    NextResponse.json({ success: true }),
    new NextRequest("http://localhost:3000/api/account"),
    { PHPSESSID: "fixture-php-session" },
    "fixture-token",
  );
  let active: BrowserContext | undefined;
  let loginPosts = 0;
  async function openBrowser() {
    const context = await playwright.chromium.launchPersistentContext(directory, {
      headless: true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
    });
    await context.route("**/api/**", (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const cookies = Object.fromEntries((request.headers().cookie || "").split(/;\s*/).filter(Boolean).map((pair) => {
        const index = pair.indexOf("=");
        return [pair.slice(0, index), pair.slice(index + 1)];
      }));
      const token = cookies[CREDENTIAL_COOKIE] ? decryptToken(cookies[CREDENTIAL_COOKIE]) : null;
      if (url.pathname === "/api/connection")
        return route.fulfill({ json: token === "fixture-token" ? connection : { configured: false, source: null, accountId: null } });
      if (url.pathname === "/api/account" && request.method() === "GET") {
        const session = decodeAccountSession(cookies[ACCOUNT_COOKIE] || "", token);
        return route.fulfill({ json: { success: true, connected: Boolean(session), ...(session ? { data: snapshot } : {}) } });
      }
      if (request.method() === "POST") loginPosts++;
      return route.abort();
    });
    return context;
  }
  try {
    for (let launch = 0; launch < 2; launch++) {
      active = await openBrowser();
      if (!launch)
        await active.addCookies(response.cookies.getAll().map((cookie) => ({
          name: cookie.name, value: cookie.value, domain: "localhost", path: "/api",
          expires: Math.floor(new Date(cookie.expires!).getTime() / 1000),
          httpOnly: cookie.httpOnly, secure: cookie.secure, sameSite: "Strict" as const,
        })));
      const page = await active.newPage();
      await page.goto("http://localhost:3000/");
      await page.getByRole("button", { name: "Tài khoản DVDD", exact: true }).click();
      await expect(page.locator(".account-profile .dvdd-balance strong")).toHaveText("98.765đ");
      expect((await active.cookies()).filter((cookie) => [ACCOUNT_COOKIE, CREDENTIAL_COOKIE].includes(cookie.name))).toHaveLength(2);
      expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toMatch(/fixture-token|fixture-php-session/);
      await active.close();
      active = undefined;
    }
    expect(loginPosts).toBe(0);
  } finally {
    await active?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

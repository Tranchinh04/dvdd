import { expect, test } from "@playwright/test";
import type { DvddAccount } from "../src/lib/types";

test("DVDD login shows the remote balance/history, handles stale data, isolates demo and logs out", async ({
  page,
}) => {
  const connection = {
    configured: true,
    source: "session",
    accountId: "fixture-account",
  };
  let loggedIn = false;
  let failRefresh = false;
  let logins = 0;
  const snapshot: DvddAccount = {
    profile: {
      name: "Người Dùng Thử",
      email: "fixture@example.test",
      phone: "0912345678",
      balance: 98765,
    },
    orders: [
      {
        orderCode: "REMOTE_EXISTING_ORDER",
        service: "Thuê số VNMB",
        status: "Đã xong",
        phone: "912345678",
        result: "642918",
        time: "14-10 · Lấy: 11:57 · Nhận OTP: 11:59",
        fee: "5.500đ",
        feeAmount: 5500,
      },
    ],
    transactions: [
      {
        code: "TX_PAGE_1",
        amount: "5.500",
        balanceAfter: "98.765",
        description: "Thuê số",
        orderCode: "REMOTE_EXISTING_ORDER",
        time: "2026-10-14 11:57:55",
      },
    ],
    transactionPage: 1,
    transactionPages: 7,
    warnings: [],
    updatedAt: new Date().toISOString(),
  };
  await page.route("**/api/phone", (route) => route.abort());
  await page.route("**/api/history?*", (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({
      json: {
        success: true,
        data: {
          kind: url.searchParams.get("kind"),
          page: Number(url.searchParams.get("page")),
          pages: 7,
          rows: [],
        },
      },
    });
  });
  await page.route("**/api/connection", (route) =>
    route.fulfill({
      json: loggedIn
        ? connection
        : { configured: false, source: null, accountId: null },
    }),
  );
  await page.route("**/api/account?*", async (route) => {
    if (failRefresh)
      return route.fulfill({
        status: 502,
        json: { success: false, message: "DVDD tạm thời không phản hồi." },
      });
    const number = Number(
      new URL(route.request().url()).searchParams.get("page"),
    );
    return route.fulfill({
      json: {
        success: true,
        connected: loggedIn,
        ...(loggedIn
          ? {
              data: {
                ...snapshot,
                transactionPage: number,
                transactions: [
                  { ...snapshot.transactions![0], code: `TX_PAGE_${number}` },
                ],
              },
            }
          : {}),
      },
    });
  });
  await page.route("**/api/account", async (route) => {
    if (route.request().method() === "POST") {
      expect(route.request().postDataJSON()).toEqual({
        email: "fixture@example.test",
        password: "fixture-password",
      });
      loggedIn = true;
      logins++;
      return route.fulfill({
        json: { success: true, connected: true, data: snapshot, connection },
      });
    }
    if (route.request().method() === "DELETE") loggedIn = false;
    return route.fulfill({ json: { success: true, connected: loggedIn } });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Tài khoản DVDD", exact: true })
    .click();
  await page
    .getByLabel("Email DVDD", { exact: false })
    .fill("fixture@example.test");
  await page
    .getByLabel("Mật khẩu DVDD", { exact: false })
    .first()
    .fill("fixture-password");
  await page
    .getByRole("button", { name: "Đăng nhập & kết nối", exact: true })
    .click();
  await expect(
    page.locator(".account-profile .dvdd-balance strong"),
  ).toHaveText("98.765đ");
  await expect(page.locator(".remote-order")).toContainText(
    "REMOTE_EXISTING_ORDER",
  );
  await expect(page.locator(".remote-otp")).toContainText("642918");
  await expect(page.locator(".remote-scope")).toContainText(
    "không phải tổng đơn trọn đời",
  );
  expect(logins).toBe(1);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "fixture-password",
  );
  await page.getByRole("tab", { name: "Giao dịch tài khoản" }).click();
  await page.getByRole("button", { name: "Sau", exact: true }).click();
  await expect(page.locator(".remote-pagination")).toContainText("Trang 2 / 7");
  await expect(page.locator(".remote-table")).toContainText("TX_PAGE_2");
  await page.getByRole("tab", { name: "Lịch sử thuê số" }).click();
  await page.getByRole("searchbox").fill("NO_MATCH");
  await expect(page.locator(".remote-empty")).toContainText(
    "Không có đơn phù hợp",
  );
  await page.getByRole("searchbox").fill("");
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: "test-results/account-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".sidebar")).not.toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator(".remote-otp")).toBeVisible();
  await page.screenshot({
    path: "test-results/account-mobile.png",
    fullPage: true,
    animations: "disabled",
  });

  failRefresh = true;
  await page
    .getByRole("button", { name: "Làm mới tài khoản", exact: true })
    .click();
  await expect(page.locator(".account-profile .account-message")).toContainText(
    "DVDD tạm thời không phản hồi",
  );
  await expect(
    page.locator(".account-profile .dvdd-balance strong"),
  ).toHaveText("98.765đ");
  failRefresh = false;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .getByRole("button", { name: "Mua số điện thoại", exact: true })
    .click();
  await page.getByRole("button", { name: "Xem bản demo", exact: true }).click();
  await expect(
    page.getByText("fixture@example.test", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".account-strip")).toHaveCount(0);
  await page
    .locator(".demo-banner")
    .getByRole("button", { name: "Thoát dùng thử" })
    .click();
  await page
    .getByRole("button", { name: "Tài khoản DVDD", exact: true })
    .click();
  await expect(page.locator(".account-profile")).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Tài khoản DVDD", exact: true })
    .click();
  await expect(
    page.locator(".account-profile .dvdd-balance strong"),
  ).toHaveText("98.765đ");
  await page
    .getByRole("button", { name: "Đăng xuất DVDD", exact: true })
    .click();
  await expect(page.getByLabel("Email DVDD", { exact: false })).toBeVisible();
  await expect(page.locator(".account-profile")).toHaveCount(0);
  await expect(page.locator(".topbar .connection-pill")).toContainText(
    "Chưa kết nối API",
  );
});

test("account routes reject invalid input, cross-origin login and invalid encrypted sessions before contacting DVDD", async ({
  request,
  context,
}) => {
  const crossOrigin = await request.post("/api/account", {
    headers: { Origin: "https://untrusted.test" },
    data: { email: "fixture@example.test", password: "unused" },
  });
  expect(crossOrigin.status()).toBe(403);
  const invalid = await request.post("/api/account", {
    headers: { Origin: "http://localhost:3000" },
    data: { email: "not-an-email", password: "unused" },
  });
  expect(invalid.status()).toBe(400);
  await context.addCookies([
    {
      name: "dvdd_account_session",
      value: "tampered-session",
      domain: "localhost",
      path: "/api",
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  const expired = await context.request.get(
    "http://localhost:3000/api/account",
  );
  expect(expired.status()).toBe(401);
  expect(await expired.json()).toMatchObject({
    code: "ACCOUNT_SESSION_EXPIRED",
  });
  expect(
    (await context.cookies()).some((c) => c.name === "dvdd_account_session"),
  ).toBe(false);
  expect(
    (await request.get("/api/history?kind=transactions&page=1001")).status(),
  ).toBe(400);
  expect((await request.get("/api/history?kind=unknown&page=1")).status()).toBe(
    400,
  );
  const noHistorySession = await request.get(
    "/api/history?kind=transactions&page=1",
  );
  expect(noHistorySession.status()).toBe(401);
  expect(noHistorySession.headers()["cache-control"]).toBe("no-store, private");
});

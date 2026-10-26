import { expect, test, type Page } from "@playwright/test";
import type { DvddAccount, DvddPhoneOrder, DvddTransaction } from "../src/lib/types";

async function supplier(page: Page) {
  const state = {
    phase: 0,
    accountReads: 0,
    historyReads: 0,
    available: true,
    signedIn: true,
    hold: null as Promise<void> | null,
  };
  const connection = { configured: true, source: "session", accountId: "fixture-account" };
  const phone = (): DvddPhoneOrder => ({
    orderCode: `REMOTE_ORDER_${state.phase}`,
    phone: "912345678", service: "Thuê số", status: "Đã xong", result: "642918",
    time: "26-10 · Lấy: 10:00", fee: "4.500đ", feeAmount: 4500,
  });
  const transaction = (page: number): DvddTransaction => ({
    code: `TX_${page}_${state.phase}`,
    amount: "4.500", balanceAfter: "9.000",
    description: `Trừ ví đơn hàng ${page === 1 ? phone().orderCode : `ARCHIVE_ORDER_${state.phase}`} phí thuê số`,
    orderCode: page === 1 ? phone().orderCode : `ARCHIVE_ORDER_${state.phase}`,
    time: `2026-10-${page === 1 ? "26" : "25"} 10:00:00`,
  });
  await page.route("**/api/phone", route => route.abort());
  await page.route("**/api/otp", route => route.abort());
  await page.route("**/api/connection", route => route.fulfill({ json: state.signedIn
    ? connection : { configured: false, source: null, accountId: null } }));
  await page.route("**/api/account?*", async route => {
    state.accountReads++;
    if (state.hold) await state.hold;
    if (!state.available)
      return route.fulfill({ status: 502, json: { success: false, message: "DVDD tạm thời không phản hồi." } });
    if (!state.signedIn)
      return route.fulfill({ json: { success: true, connected: false } });
    const data: DvddAccount = {
      profile: { name: "Người Dùng Thử", email: "fixture@example.test", phone: "0912345678", balance: 1000 + state.phase * 2000 },
      orders: [phone()], transactions: [transaction(1)], phonePages: 1,
      transactionPage: 1, transactionPages: 2, warnings: [], updatedAt: new Date().toISOString(),
    };
    return route.fulfill({ json: { success: true, connected: true, data } });
  });
  await page.route("**/api/history?*", route => {
    state.historyReads++;
    const url = new URL(route.request().url());
    const kind = url.searchParams.get("kind");
    const number = Number(url.searchParams.get("page"));
    return route.fulfill({ json: { success: true, data: {
      kind, page: number, pages: kind === "phones" ? 1 : 2,
      rows: kind === "phones" ? [phone()] : [transaction(number)],
    } } });
  });
  return state;
}

test("navigation and returning to the browser tab refresh balance and all history pages without reloading", async ({ page }) => {
  const state = await supplier(page);
  let documentLoads = 0;
  page.on("domcontentloaded", () => documentLoads++);
  await page.goto("/");
  await expect(page.locator(".account-strip .dvdd-balance strong")).toHaveText("1.000đ");
  await expect(page.getByRole("button", { name: "ARCHIVE_ORDER_0", exact: true })).toBeVisible();

  state.phase = 1;
  await page.getByRole("button", { name: "Lịch sử đơn hàng", exact: true }).click();
  await expect(page.getByText("Số dư: 3.000đ", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "ARCHIVE_ORDER_1", exact: true })).toBeVisible();
  await expect(page.getByText("ARCHIVE_ORDER_0", { exact: true })).toHaveCount(0);

  const reads = state.accountReads;
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
  });
  await page.waitForTimeout(150);
  expect(state.accountReads).toBe(reads);
  state.phase = 2;
  let release!: () => void;
  state.hold = new Promise<void>(resolve => { release = resolve; });
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
  });
  await expect.poll(() => state.accountReads).toBe(reads + 1);
  await expect(page.getByRole("button", { name: "ARCHIVE_ORDER_1", exact: true })).toBeVisible();
  release();
  state.hold = null;
  await expect(page.getByText("Số dư: 5.000đ", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "ARCHIVE_ORDER_2", exact: true })).toBeVisible();
  expect(state.accountReads).toBe(reads + 1);
  expect(documentLoads).toBe(1);
});

test("regaining connectivity retries failed account restoration automatically", async ({ page }) => {
  const state = await supplier(page);
  state.available = false;
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Chưa khôi phục được tài khoản" })).toBeVisible();
  state.available = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator(".account-strip .dvdd-balance strong")).toHaveText("1.000đ");
  await expect(page.getByRole("button", { name: "ARCHIVE_ORDER_0", exact: true })).toBeVisible();
});

test("returning to a tab picks up logout in another tab and demo never refreshes live data", async ({ page }) => {
  const state = await supplier(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "ARCHIVE_ORDER_0", exact: true })).toBeVisible();
  state.signedIn = false;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".account-strip .dvdd-balance")).toHaveCount(0);
  await expect(page.getByText("ARCHIVE_ORDER_0", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Tài khoản DVDD", exact: true }).click();
  await expect(page.getByRole("button", { name: "Đăng nhập & kết nối", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mua số điện thoại", exact: true }).click();
  await page.getByRole("button", { name: "Xem bản demo" }).click();
  const reads = state.accountReads;
  const historyReads = state.historyReads;
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
  });
  await page.waitForTimeout(150);
  expect(state.accountReads).toBe(reads);
  expect(state.historyReads).toBe(historyReads);
});

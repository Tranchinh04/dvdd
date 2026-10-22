import { expect, test, type Page } from "@playwright/test";
import type { DvddAccount } from "../src/lib/types";

const activeCode = "FIXTURE_WAITING_REMOTE";
const active = {
  orderCode: activeCode,
  phone: "993550373",
  service: "Thuê số -",
  status: "Đang đặt",
  result: "",
  time: "22-10 · Lấy: 15:56",
  fee: "4.500đ",
  feeAmount: 4500,
};
function snapshot(includeActive = true): DvddAccount {
  return {
    profile: {
      name: "Người Dùng Thử",
      email: "fixture@example.test",
      phone: "0912345678",
      balance: 10500,
    },
    orders: [
      ...(includeActive ? [active] : []),
      {
        ...active,
        orderCode: "FINISHED",
        phone: "912345678",
        status: "Đã xong",
        result: "123456",
      },
      {
        ...active,
        orderCode: "EXPIRED",
        phone: "923456789",
        status: "Đặt lỗi/Hết hạn",
        fee: "0đ",
        feeAmount: 0,
      },
      {
        ...active,
        orderCode: "UNKNOWN",
        phone: "934567890",
        status: "Chưa xác định",
      },
    ],
    transactions: [],
    transactionPage: 1,
    transactionPages: 1,
    phonePages: 1,
    warnings: [],
    updatedAt: new Date().toISOString(),
  };
}

async function prepare(
  page: Page,
  account: () => DvddAccount = () => snapshot(),
  autoPoll = true,
) {
  await page.clock.install({ time: new Date("2026-10-22T09:00:00.000Z") });
  await page.clock.pauseAt(new Date("2026-10-22T09:00:01.000Z"));
  await page.addInitScript(
    (autoPoll) =>
      localStorage.setItem(
        "dvdd.preferences.v1",
        JSON.stringify({ autoPoll, pollSeconds: 5 }),
      ),
    autoPoll,
  );
  await page.route("**/api/connection", (route) =>
    route.fulfill({
      json: {
        configured: true,
        source: "session",
        accountId: "monitoring-fixture",
      },
    }),
  );
  await page.route("**/api/account?*", (route) =>
    route.fulfill({
      json: { success: true, connected: true, data: account() },
    }),
  );
  await page.route("**/api/history?*", (route) => {
    const url = new URL(route.request().url());
    const kind = url.searchParams.get("kind");
    return route.fulfill({
      json: {
        success: true,
        data: {
          kind,
          page: 1,
          pages: 1,
          rows: kind === "phones" ? account().orders : [],
        },
      },
    });
  });
  await page.route("**/api/phone", () => {
    throw new Error("Monitoring must not buy a phone number");
  });
}

async function refreshAccount(page: Page) {
  await page
    .getByRole("button", { name: "Tài khoản DVDD", exact: true })
    .click();
  const response = page.waitForResponse(
    (response) =>
      response.url().includes("/api/account?") && response.status() === 200,
  );
  await page
    .getByRole("button", { name: "Làm mới tài khoản", exact: true })
    .click();
  await response;
  await page
    .getByRole("button", { name: "Mua số điện thoại", exact: true })
    .click();
}

test("remote placing orders share the waiting filter/count and receive OTP automatically once", async ({
  page,
}) => {
  await prepare(page);
  let calls = 0;
  await page.route("**/api/otp", (route) => {
    expect(route.request().postDataJSON()).toEqual({ orderCode: activeCode });
    calls++;
    return route.fulfill({
      json: { success: true, otp: calls === 1 ? "" : "654321" },
    });
  });
  await page.goto("/");
  await expect(page.locator(".pending-orders-indicator")).toHaveText(
    "1 đang chờ OTP",
  );
  await expect(page.locator("tbody .status-badge.waiting")).toHaveText(
    "Đang chờ OTP",
  );
  await expect(page.locator("tbody")).not.toContainText("Đang đặt");
  await expect(page.locator(".nav-count")).toHaveText("1");
  await page.locator(".pending-orders-indicator").click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText(activeCode);
  await page
    .locator(".orders-panel")
    .screenshot({
      path: "test-results/pending-orders-desktop.png",
      animations: "disabled",
    });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator(".pending-orders-indicator")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .locator(".orders-panel")
    .screenshot({
      path: "test-results/pending-orders-mobile.png",
      animations: "disabled",
    });
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.clock.fastForward(1000);
  await expect.poll(() => calls).toBe(1);
  await expect(
    page.getByRole("button", {
      name: `Kiểm tra OTP đơn ${activeCode}`,
      exact: true,
    }),
  ).toBeEnabled();
  await page.clock.fastForward(4000);
  expect(calls).toBe(1);
  await page.clock.fastForward(1000);
  await expect(page.locator(".toast")).toContainText(
    "Đã nhận OTP cho số 993550373",
  );
  await expect(page.locator(".pending-orders-indicator")).toHaveCount(0);
  await expect(page.locator(".nav-count")).toHaveCount(0);
  await page.getByRole("button", { name: "Tất cả", exact: true }).click();
  await expect(page.locator("tbody")).toContainText("654321");
  await page.clock.fastForward(5000);
  await refreshAccount(page);
  await expect(page.locator("tbody")).toContainText("654321");
  await expect(page.locator(".toast")).toHaveCount(0);
  await page.clock.fastForward(30_000);
  expect(calls).toBe(2);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    activeCode,
  );
});

test("remote monitoring respects pause, manual refresh, error backoff and expiration", async ({
  page,
}) => {
  await prepare(page);
  let calls = 0;
  await page.route("**/api/otp", (route) => {
    expect(route.request().postDataJSON()).toEqual({ orderCode: activeCode });
    calls++;
    return route.fulfill({
      status: calls === 1 ? 502 : 410,
      json: {
        success: false,
        code: calls === 1 ? "NETWORK_ERROR" : "ORDER_EXPIRED",
        message:
          calls === 1 ? "DVDD tạm thời không phản hồi" : "Đơn đã hết hạn",
      },
    });
  });
  await page.goto("/");
  await expect(page.locator(".pending-orders-indicator")).toBeVisible();
  await page.getByRole("button", { name: "Tạm dừng", exact: true }).click();
  await page.clock.fastForward(20_000);
  expect(calls).toBe(0);
  await page
    .getByRole("button", {
      name: `Kiểm tra OTP đơn ${activeCode}`,
      exact: true,
    })
    .click();
  await expect(page.locator(".row-error")).toContainText(
    "DVDD tạm thời không phản hồi",
  );
  await page.getByRole("button", { name: "Bật tự động", exact: true }).click();
  await page.clock.fastForward(29_000);
  expect(calls).toBe(1);
  await page.clock.fastForward(1000);
  await expect(page.locator(".pending-orders-indicator")).toHaveCount(0);
  await expect(page.locator(".toast")).toContainText(
    `Đơn ${activeCode} đã hết hạn`,
  );
  await page.clock.fastForward(60_000);
  expect(calls).toBe(2);
});

test("only newly discovered waiting orders raise a new-order notification", async ({
  page,
}) => {
  let active = false;
  await prepare(page, () => snapshot(active), false);
  await page.route("**/api/otp", () => {
    throw new Error("Automatic OTP checks are paused");
  });
  await page.goto("/");
  await expect(page.locator(".orders-panel .count-badge")).toHaveText("3");
  await expect(page.locator(".toast")).toHaveCount(0);
  active = true;
  await refreshAccount(page);
  await expect(page.locator(".toast")).toContainText(
    `Có đơn thuê số mới ${activeCode}`,
  );
  await expect(page.locator(".pending-orders-indicator")).toHaveText(
    "1 đang chờ OTP",
  );
  await page.clock.fastForward(5000);
  await refreshAccount(page);
  await expect(page.locator(".toast")).toHaveCount(0);
});

test("a late OTP response cannot populate the demo or another account scope", async ({
  page,
}) => {
  await prepare(page, () => snapshot(), false);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false;
  await page.route("**/api/otp", async (route) => {
    started = true;
    await gate;
    await route.fulfill({ json: { success: true, otp: "654321" } });
  });
  await page.goto("/");
  await page
    .getByRole("button", {
      name: `Kiểm tra OTP đơn ${activeCode}`,
      exact: true,
    })
    .click();
  await expect.poll(() => started).toBe(true);
  await page.getByRole("button", { name: "Xem bản demo", exact: true }).click();
  release();
  await expect(page.locator(".orders-panel .count-badge")).toHaveText("6");
  await expect(page.locator("tbody")).not.toContainText(activeCode);
  await expect(page.locator("tbody")).not.toContainText("654321");
  await page
    .getByRole("button", { name: "Thoát dùng thử", exact: false })
    .click();
  await expect(page.locator(".pending-orders-indicator")).toHaveText(
    "1 đang chờ OTP",
  );
  await expect(page.locator("tbody")).not.toContainText("654321");
});

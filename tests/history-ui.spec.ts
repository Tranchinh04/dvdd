import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { DvddAccount, DvddTransaction } from "../src/lib/types";

const connection = {
  configured: true,
  source: "session",
  accountId: "history-fixture",
};
const charge = (
  code: string,
  order: string,
  time: string,
  vnmb = false,
): DvddTransaction => ({
  code,
  amount: vnmb ? "5.500" : "4.500",
  balanceAfter: "10.500",
  description: `Trừ ví đơn hàng ${order} phí thuê số${vnmb ? " VNMB" : ""}`,
  orderCode: "",
  time,
});
const firstPage = [
  charge("TX_CURRENT", "RENT_CURRENT", "2026-10-14 11:57:55", true),
  {
    ...charge("TX_REFUND", "OLD_REFUND", "2026-03-12 12:15:00"),
    description: "Hoàn ví không nhận được OTP OLD_REFUND",
  },
];
const secondPage = [
  charge("TX_OLD", "OLD_YEAR", "2025-12-31 23:59:59"),
  charge("TX_REFUNDED_CHARGE", "OLD_REFUND", "2026-03-12 12:00:00"),
  {
    ...charge("TOPUP", "NOT_A_RENTAL", "2026-03-12 09:00:00"),
    description: "Nạp tiền",
    amount: "100.000",
  },
];
const account: DvddAccount = {
  profile: {
    name: "Người Dùng Thử",
    email: "fixture@example.test",
    phone: "0912345678",
    balance: 10500,
  },
  orders: [
    {
      orderCode: "RENT_CURRENT",
      phone: "912345678",
      service: "Thuê số -",
      status: "Đã xong",
      result: "642918",
      time: "14-10 · Lấy: 11:57",
      fee: "5.500đ",
      feeAmount: 5500,
    },
    {
      orderCode: "UNDATED",
      phone: "934567890",
      service: "Thuê số -",
      status: "Khác",
      result: "",
      time: "30-12 · Lấy: 12:00",
      fee: "Chưa rõ",
      feeAmount: null,
    },
  ],
  transactions: firstPage,
  transactionPage: 1,
  transactionPages: 2,
  phonePages: 1,
  warnings: [],
  updatedAt: "2026-10-21T06:00:00.000Z",
};

test("history and analytics restore all advertised provider pages without local orders, deduplicate, retain stale data and reload", async ({
  page,
}) => {
  let failSecond = false;
  let expireSession = false;
  let financialCalls = 0;
  const requested: string[] = [];
  await page.clock.setFixedTime(new Date("2026-10-21T06:00:00.000Z"));
  await page.route("**/api/connection", (route) =>
    route.fulfill({ json: connection }),
  );
  await page.route("**/api/account?*", (route) =>
    route.fulfill({ json: { success: true, connected: true, data: account } }),
  );
  await page.route("**/api/history?*", (route) => {
    if (expireSession)
      return route.fulfill({
        status: 401,
        json: {
          success: false,
          code: "ACCOUNT_SESSION_EXPIRED",
          message: "Phiên đã hết hạn",
        },
      });
    const url = new URL(route.request().url());
    const kind = url.searchParams.get("kind");
    const number = Number(url.searchParams.get("page"));
    requested.push(`${kind}:${number}`);
    if (kind === "transactions" && number === 2 && failSecond)
      return route.fulfill({
        status: 502,
        json: { success: false, message: "DVDD tạm thời không phản hồi." },
      });
    return route.fulfill({
      json: {
        success: true,
        data: {
          kind,
          page: number,
          pages: kind === "phones" ? 1 : 2,
          rows:
            kind === "phones"
              ? account.orders
              : number === 1
                ? firstPage
                : secondPage,
        },
      },
    });
  });
  await page.route(/\/api\/(phone|otp)(\?|$)/, (route) => {
    financialCalls++;
    return route.abort();
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Lịch sử đơn hàng", exact: true })
    .click();
  await expect(page.locator(".history-source")).toContainText(
    "Đã đồng bộ 3 trang",
  );
  await expect(page.locator(".orders-panel .count-badge")).toHaveText("4");
  await expect(page.locator("tbody")).toContainText("OLD_YEAR");
  await expect(page.locator("tbody")).toContainText("31/12/2025");
  await expect(
    page.locator(".stat-card").first().locator("strong").first(),
  ).toHaveText("04");
  await expect(page.locator(".stat-card").last()).toContainText("10.000đ");
  // Navigation now revalidates the seed pages as well as older history.
  expect(requested).toContain("transactions:2");
  expect(requested.every(path => ["phones:1", "transactions:1", "transactions:2"].includes(path))).toBe(true);

  await page.getByRole("button", { name: "Hết hạn", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("OLD_REFUND");
  await expect(page.locator("tbody")).toContainText("0đ");
  await page.getByRole("button", { name: "Tất cả", exact: true }).click();
  await page
    .getByRole("button", { name: "Chi tiết đơn OLD_YEAR", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "khôi phục từ giao dịch thuê số",
  );
  await expect(page.getByRole("dialog")).toContainText("Chưa rõ trạng thái");
  await expect(page.getByRole("dialog")).toContainText("31/12/2025");
  await page.getByRole("button", { name: "Đóng hộp thoại" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất CSV", exact: true }).click();
  const file = await (await download).path();
  const csv = await readFile(file!, "utf8");
  expect(csv.match(/RENT_CURRENT/g)).toHaveLength(1);
  expect(csv).toContain("2025-12-31T16:59:59.000Z");

  await page.evaluate(() => {
    document.activeElement instanceof HTMLElement &&
      document.activeElement.blur();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.screenshot({
    path: "test-results/history-synced-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Thống kê sử dụng", exact: true })
    .click();
  await expect(page.getByLabel("Khoảng thời gian thống kê")).toHaveValue("all");
  await expect(page.locator(".chart")).toHaveAccessibleName(
    "Biểu đồ hoạt động: 3 đơn có thời gian xác định",
  );
  await expect(page.locator(".rate-ring strong")).toHaveText("50%");
  await expect(page.locator(".rate-breakdown")).toContainText(
    "Chưa rõ kết quả",
  );
  await expect(page.locator(".chart-caption")).toContainText(
    "1 đơn chưa rõ ngày",
  );
  await page.getByLabel("Khoảng thời gian thống kê").selectOption("7");
  await expect(
    page.locator(".stat-card").first().locator("strong").first(),
  ).toHaveText("00");
  await page.getByLabel("Khoảng thời gian thống kê").selectOption("all");
  await page.evaluate(() => {
    document.activeElement instanceof HTMLElement &&
      document.activeElement.blur();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.screenshot({
    path: "test-results/analytics-synced-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    document.activeElement instanceof HTMLElement &&
      document.activeElement.blur();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.screenshot({
    path: "test-results/analytics-synced-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.reload();
  await page
    .getByRole("button", { name: "Lịch sử đơn hàng", exact: true })
    .click();
  await expect(page.locator(".history-source")).toContainText(
    "Đã đồng bộ 3 trang",
  );
  await expect(page.locator(".orders-panel .count-badge")).toHaveText("4");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "OLD_YEAR",
  );
  // A duplicate tracked order must resolve from the provider and stop polling.
  await page.evaluate(() =>
    localStorage.setItem(
      "dvdd.orders.live.v1.history-fixture",
      JSON.stringify([
        {
          id: "local-id",
          orderCode: "RENT_CURRENT",
          service: "vnmb",
          phone: "912345678",
          fee: "5500đ",
          feeAmount: 5500,
          status: "waiting",
          otp: "",
          createdAt: "2026-10-14T04:57:55.000Z",
        },
      ]),
    ),
  );
  await page.reload();
  await page.getByRole("button", { name: /^Lịch sử đơn hàng/ }).click();
  await expect(page.locator(".history-source")).toContainText(
    "Đã đồng bộ 3 trang",
  );
  await expect(page.locator(".orders-panel .count-badge")).toHaveText("4");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("dvdd.orders.live.v1.history-fixture")!,
          )[0].status,
      ),
    )
    .toBe("received");
  failSecond = true;
  await page.getByRole("button", { name: "Đồng bộ lại", exact: true }).click();
  await expect(page.locator(".history-sync-error")).toContainText(
    "DVDD tạm thời không phản hồi",
  );
  await expect(page.locator("tbody")).toContainText("OLD_YEAR");
  await expect(page.locator(".orders-panel .count-badge")).toHaveText("4");
  failSecond = false;
  await page.getByRole("button", { name: "Đồng bộ lại", exact: true }).click();
  await expect(page.locator(".history-sync-error")).toHaveCount(0);
  await expect(page.locator(".history-source")).toContainText(
    "Đã đồng bộ 3 trang",
  );
  expireSession = true;
  await page.getByRole("button", { name: "Đồng bộ lại", exact: true }).click();
  await expect(page.locator(".history-source")).toContainText(
    "Phiên đăng nhập DVDD đã hết hạn",
  );
  await expect(page.locator(".orders-panel .count-badge")).toHaveText("1");
  await expect(page.locator("tbody")).not.toContainText("OLD_YEAR");
  expect(financialCalls).toBe(0);
});

test("late history requests cannot expose real account data after switching to demo", async ({
  page,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/connection", (route) =>
    route.fulfill({ json: connection }),
  );
  await page.route("**/api/account?*", (route) =>
    route.fulfill({ json: { success: true, connected: true, data: account } }),
  );
  await page.route("**/api/phone", (route) => route.abort());
  await page.route("**/api/otp", (route) => route.abort());
  await page.route("**/api/history?*", async (route) => {
    await gate;
    try {
      await route.fulfill({
        json: {
          success: true,
          data: { kind: "transactions", page: 2, pages: 2, rows: secondPage },
        },
      });
    } catch {
      /* Expected when the account-scoped request was aborted. */
    }
  });
  await page.goto("/");
  await expect(page.locator(".account-strip")).toContainText("10.500đ");
  await page.getByRole("button", { name: "Xem bản demo", exact: true }).click();
  release();
  await page.getByRole("button", { name: /^Lịch sử đơn hàng/ }).click();
  await expect(page.locator(".history-source")).toContainText(
    "Dữ liệu dùng thử",
  );
  await expect(page.locator(".orders-panel .count-badge")).toHaveText("6");
  await expect(page.locator("tbody")).not.toContainText("OLD_YEAR");
  await expect(page.locator("tbody")).not.toContainText("RENT_CURRENT");
});

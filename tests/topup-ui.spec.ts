import { expect, test, type Page } from "@playwright/test";
import type { DvddAccount } from "../src/lib/types";
import { topupDetails } from "../src/lib/server/topup";
import { topupHtml } from "./fixtures/topup";

async function prepare(page: Page, connected = true) {
  await page.clock.install({ time: new Date("2026-10-26T02:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-26T02:00:01Z"));
  const state = {
    connected,
    expired: false,
    fail: false,
    failQr: false,
    reads: 0,
    topups: 0,
    paid: 0,
    balance: 10500,
    accountId: "topup-fixture",
  };
  const details = await topupDetails(topupHtml());
  const snapshot = (): DvddAccount => ({
    profile: {
      name: "Người Dùng Thử",
      email: "fixture@example.test",
      phone: "0912345678",
      balance: state.balance,
    },
    orders: [],
    transactions: [
      {
        code: "TX_TEST",
        amount: "20.000",
        balanceAfter: String(state.balance),
        description: "Giao dịch kiểm thử từ DVDD",
        orderCode: "",
        time: "2026-10-26 09:00:00",
      },
    ],
    transactionPage: 1,
    transactionPages: 1,
    phonePages: 1,
    warnings: [],
    updatedAt: new Date().toISOString(),
  });
  await page.route("**/api/connection", (route) =>
    route.fulfill({
      json: {
        configured: state.connected,
        source: state.connected ? "session" : null,
        accountId: state.connected ? state.accountId : null,
      },
    }),
  );
  await page.route("**/api/phone", (route) => {
    state.paid++;
    return route.abort();
  });
  await page.route("**/api/otp", (route) => route.abort());
  await page.route("**/api/history?*", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          kind: new URL(route.request().url()).searchParams.get("kind"),
          page: 1,
          pages: 1,
          rows: [],
        },
      },
    }),
  );
  await page.route("**/api/account{,?*}", (route) => {
    state.reads++;
    if (route.request().method() === "DELETE") state.connected = false;
    if (state.expired)
      return route.fulfill({
        status: 401,
        json: {
          success: false,
          code: "ACCOUNT_SESSION_EXPIRED",
          message: "Phiên đăng nhập đã hết hạn.",
        },
      });
    if (state.fail)
      return route.fulfill({
        status: 502,
        json: { success: false, message: "Không kết nối được DVDD." },
      });
    return route.fulfill({
      json: {
        success: true,
        connected: state.connected,
        ...(state.connected ? { data: snapshot() } : {}),
      },
    });
  });
  await page.route("**/api/topup", (route) => {
    state.topups++;
    return state.failQr
      ? route.fulfill({
          status: 502,
          json: {
            success: false,
            code: "TOPUP_DETAILS_INVALID",
            message: "Chưa xác minh được thông tin nạp tiền.",
          },
        })
      : route.fulfill({
          json: { success: true, accountId: state.accountId, data: details },
        });
  });
  await page.goto("/");
  if (connected)
    await expect(page.locator(".account-strip")).toContainText(
      "fixture@example.test",
    );
  await page
    .getByRole("button", { name: "Nạp tiền", exact: true })
    .first()
    .click();
  return state;
}

test("funding displays account-specific QR, copies exact reference, downloads PNG and reads real balance without claiming payment success", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const state = await prepare(page);
  await expect(page.locator(".topup-bank-fields")).toContainText(
    "012345678901",
  );
  await expect(page.locator(".topup-reference")).toContainText("NAPFIXTURE01");
  await expect(page.locator(".topup-bank-fields")).toContainText("20.000đ");
  const image = page.getByRole("img", { name: /QR nạp tiền/ });
  await expect(image).toBeVisible();
  await page
    .getByRole("button", {
      name: "Sao chép nội dung chuyển khoản",
      exact: true,
    })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "NAPFIXTURE01",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Tải mã QR" }).click();
  expect((await download).suggestedFilename()).toBe("dvdd-qr-nap-tien.png");
  state.balance = 30500;
  await page
    .getByRole("button", { name: "Tôi đã chuyển · Kiểm tra số dư" })
    .click();
  await expect(page.locator(".topup-wallet-info")).toContainText("30.500đ");
  await expect(page.locator(".topup-check-note")).toContainText(
    "không xác nhận giao dịch đã thành công",
  );
  const reads = state.reads;
  await page.clock.runFor(31000);
  await expect.poll(() => state.reads).toBeGreaterThan(reads);
  state.fail = true;
  await page
    .getByRole("button", { name: "Tôi đã chuyển · Kiểm tra số dư" })
    .click();
  await expect(page.locator(".topup-page").getByRole("alert")).toContainText(
    "Không kết nối được DVDD",
  );
  await expect(page.locator(".topup-wallet-info")).toContainText("30.500đ");
  state.fail = false;
  await page
    .getByRole("button", { name: "Tôi đã chuyển · Kiểm tra số dư" })
    .click();
  await expect(page.locator(".topup-page .account-message")).toHaveCount(0);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    await page.clock.runFor(500);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo({ top: 0, behavior: "instant" });
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(image).toBeVisible();
    if (width !== 320)
      await page.screenshot({
        path: `test-results/topup-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
  }
  expect(state.paid).toBe(0);
});

test("QR revalidation hides stale instructions on failure; expired accounts lose funding details", async ({
  page,
}) => {
  const state = await prepare(page);
  await expect(page.locator(".topup-qr-frame img")).toBeVisible();
  state.failQr = true;
  await page.clock.runFor(331000);
  await expect(page.locator(".topup-page").getByRole("alert")).toContainText(
    "Chưa xác minh",
  );
  await expect(page.locator(".topup-qr-frame img")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Tôi đã chuyển · Kiểm tra số dư" }),
  ).toBeDisabled();
  state.failQr = false;
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.locator(".topup-qr-frame img")).toBeVisible();
  state.expired = true;
  await page
    .getByRole("button", { name: "Tôi đã chuyển · Kiểm tra số dư" })
    .click();
  await expect(page.locator(".topup-gate")).toContainText(
    "Đăng nhập để nạp tiền",
  );
  await expect(page.locator(".topup-reference")).toHaveCount(0);
});

test("signed-out and demo visitors never request or show real payment instructions", async ({
  page,
}) => {
  const state = await prepare(page, false);
  await expect(page.locator(".topup-gate")).toContainText(
    "Đăng nhập để nạp tiền",
  );
  expect(state.topups).toBe(0);
  await page
    .getByRole("button", { name: "Mua số điện thoại", exact: true })
    .click();
  await page.getByRole("button", { name: "Xem bản demo", exact: true }).click();
  await page
    .getByRole("button", { name: "Nạp tiền", exact: true })
    .first()
    .click();
  await expect(page.locator(".topup-gate")).toContainText(
    "Nạp tiền dành cho tài khoản thật",
  );
  await expect(page.locator(".topup-qr-frame img")).toHaveCount(0);
  expect(state.topups).toBe(0);
});

test("a mismatched account response cannot expose another user's payment reference", async ({
  page,
}) => {
  await prepare(page);
  await expect(page.locator(".topup-reference")).toContainText("NAPFIXTURE01");
  const data = await topupDetails(topupHtml());
  await page.route("**/api/topup", (route) =>
    route.fulfill({
      json: {
        success: true,
        accountId: "different-account",
        data: { ...data, reference: "PRIVATE_OTHER_ACCOUNT" },
      },
    }),
  );
  await page
    .getByRole("button", { name: "Tải lại thông tin nạp tiền" })
    .click();
  await expect(page.locator(".topup-page").getByRole("alert")).toContainText(
    "Tài khoản đã thay đổi",
  );
  await expect(page.locator(".topup-qr-frame img")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("PRIVATE_OTHER_ACCOUNT");
});

test("a late funding response cannot repopulate details after logout", async ({
  page,
}) => {
  await prepare(page);
  await expect(page.locator(".topup-qr-frame img")).toBeVisible();
  let requested = false;
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const data = await topupDetails(topupHtml());
  await page.route("**/api/topup", async (route) => {
    requested = true;
    await wait;
    await route
      .fulfill({ json: { success: true, accountId: "topup-fixture", data } })
      .catch(() => {});
  });
  await page
    .getByRole("button", { name: "Tải lại thông tin nạp tiền" })
    .click();
  await expect.poll(() => requested).toBe(true);
  await page
    .getByRole("button", { name: "Tài khoản DVDD", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Đăng xuất DVDD", exact: true })
    .click();
  await expect(page.getByLabel("Email DVDD", { exact: false })).toBeVisible();
  release();
  await page
    .getByRole("button", { name: "Nạp tiền", exact: true })
    .first()
    .click();
  await expect(page.locator(".topup-gate")).toBeVisible();
  await expect(page.locator(".topup-reference")).toHaveCount(0);
});

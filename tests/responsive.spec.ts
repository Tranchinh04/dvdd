import { expect, test, type Page } from "@playwright/test";
import type { DvddAccount } from "../src/lib/types";
import { topupDetails } from "../src/lib/server/topup";
import { topupHtml } from "./fixtures/topup";

const account: DvddAccount = {
  profile: {
    name: "Nguyễn Trần Hoàng Minh Anh",
    email: "nguyen.tran.hoang.minh.anh@example.test",
    phone: "0912345678",
    balance: 1234567890,
  },
  orders: [
    "Đã xong",
    "Đang đặt",
    "Đặt lỗi/Hết hạn",
    "Chưa rõ trạng thái từ nhà cung cấp",
  ].map((status, i) => ({
    orderCode: `RTRESPONSIVE12345678901234567890${i}`,
    service: i % 2 ? "Thuê số VNMB" : "Thuê số thường",
    status,
    phone: "912345678",
    result: i === 0 ? "123456" : "",
    time: "2026-10-26 09:30:00",
    fee: "5.500đ",
    feeAmount: 5500,
  })),
  transactions: [
    {
      code: "TRANSACTION_RESPONSIVE_1234567890",
      amount: "20.000",
      balanceAfter: "1.234.567.890",
      description:
        "Thông tin giao dịch được giữ đầy đủ để đối chiếu khoản nạp và hoạt động của tài khoản DVDD.",
      orderCode: "RTRESPONSIVE123456789012345678900",
      time: "2026-10-26 09:30:00",
    },
  ],
  transactionPage: 1,
  transactionPages: 1,
  phonePages: 1,
  warnings: [],
  updatedAt: "2026-10-26T02:30:00Z",
};

async function prepare(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const data = await topupDetails(topupHtml());
  await page.route("**/api/connection", (r) =>
    r.fulfill({
      json: {
        configured: true,
        source: "session",
        accountId: "responsive-fixture",
      },
    }),
  );
  await page.route("**/api/account{,?*}", (r) =>
    r.fulfill({ json: { success: true, connected: true, data: account } }),
  );
  await page.route("**/api/history?*", (r) =>
    r.fulfill({
      json: {
        success: true,
        data: {
          kind: new URL(r.request().url()).searchParams.get("kind"),
          rows: [],
          page: 1,
          pages: 1,
        },
      },
    }),
  );
  await page.route("**/api/topup", (r) =>
    r.fulfill({
      json: { success: true, accountId: "responsive-fixture", data },
    }),
  );
  await page.route("**/api/phone", (r) => r.abort());
  await page.route("**/api/otp", (r) =>
    r.fulfill({ json: { success: true, otp: "" } }),
  );
  await page.goto("/");
  await expect(page.locator(".account-strip")).toContainText(
    account.profile.email,
  );
}

async function navigate(page: Page, name: string) {
  if ((page.viewportSize()?.width || 0) <= 900)
    await page.getByRole("button", { name: "Mở menu điều hướng" }).click();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .click();
  await page.locator("#main-content h1").waitFor();
  if ((page.viewportSize()?.width || 0) <= 900)
    await expect(page.locator(".sidebar")).not.toBeInViewport();
  const dismiss = page.getByRole("button", { name: "Đóng thông báo" });
  if (await dismiss.isVisible()) await dismiss.click();
}

async function layoutIssues(page: Page, selector = "#main-content") {
  return page.locator(selector).evaluate((root) => {
    const issues: string[] = [];
    const width = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > width + 1)
      issues.push(
        `document ${document.documentElement.scrollWidth} > ${width}`,
      );
    const nodes = root.querySelectorAll<HTMLElement>(
      ".button, .text-button, .filter-tabs > button, .panel-heading, .phone-number, .order-code, .status-badge, .stat-card, .account-strip, .account-profile-fields dd, .topup-copy-value, .setting-row, .service-tag, .service-price, .remote-order-code, .dvdd-status, .detail-info dd, .detail-otp, .help-modal-art",
    );
    for (const el of nodes) {
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height || el.closest("[inert]")) continue;
      const label = `${el.tagName}.${el.className.toString().split(" ").join(".")} ${el.textContent?.trim().slice(0, 45)}`;
      let scrolls = false;
      for (
        let parent = el.parentElement;
        parent && parent !== root;
        parent = parent.parentElement
      ) {
        const style = getComputedStyle(parent);
        if (
          ["auto", "scroll"].includes(style.overflowX) &&
          parent.scrollWidth > parent.clientWidth + 1
        ) {
          scrolls = true;
          break;
        }
        if (["hidden", "clip"].includes(style.overflowX)) {
          const clip = parent.getBoundingClientRect();
          if (box.left < clip.left - 2 || box.right > clip.right + 2)
            issues.push(`clipped by .${parent.className}: ${label}`);
        }
      }
      if (!scrolls && (box.left < -1 || box.right > width + 1))
        issues.push(`outside viewport: ${label}`);
      if (
        el.matches(
          ".button, .text-button, .filter-tabs > button, .order-code",
        ) &&
        el.scrollWidth > el.clientWidth + 2
      )
        issues.push(
          `label overflows ${el.scrollWidth}/${el.clientWidth}: ${label}`,
        );
    }
    return [...new Set(issues)].slice(0, 15);
  });
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
  { width: 900, height: 600 },
  { width: 901, height: 900 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
]) {
  test(`all workspace screens preserve content and controls at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await prepare(page);
    const failures: Record<string, string[]> = {};
    for (const name of [
      "Mua số điện thoại",
      "Lịch sử đơn hàng",
      "Thống kê sử dụng",
      "Tài khoản DVDD",
      "Nạp tiền",
      "Cấu hình API",
    ]) {
      await navigate(page, name);
      if (name === "Nạp tiền")
        await expect(page.locator(".topup-reference")).toBeVisible();
      if (name === "Tài khoản DVDD")
        await expect(page.locator(".account-profile")).toBeVisible();
      const issues = await layoutIssues(page);
      if (issues.length) failures[name] = issues;
      if (name === "Tài khoản DVDD") {
        await page.getByRole("tab", { name: "Giao dịch tài khoản" }).click();
        const transactionIssues = await layoutIssues(page);
        if (transactionIssues.length)
          failures["Giao dịch tài khoản"] = transactionIssues;
        const cell = page.locator(".remote-table tbody tr").first();
        await expect(cell).toContainText(account.transactions![0].description);
        if (viewport.width <= 1100)
          expect(
            await cell.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
          ).toBe(true);
      }
      if (viewport.width === 390 || viewport.width === 1024) {
        await page.evaluate(() => {
          if (document.activeElement instanceof HTMLElement)
            document.activeElement.blur();
          window.scrollTo({ top: 0, behavior: "instant" });
        });
        await page.screenshot({
          path: `test-results/responsive-${viewport.width}-${name.replaceAll(" ", "-")}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
    }
    expect(failures).toEqual({});
  });
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 844, height: 390 },
]) {
  test(`dialogs and mobile menu stay usable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await prepare(page);
    await page.getByRole("button", { name: "Mở menu điều hướng" }).click();
    await expect(
      page.getByRole("button", { name: "Đóng menu", exact: true }),
    ).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe(
      "hidden",
    );
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Mở menu điều hướng" }),
    ).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
      "hidden",
    );
    await page
      .getByRole("button", { name: "Mua số ngay", exact: true })
      .click();
    const modal = page.locator("dialog.modal");
    await expect(modal).toBeVisible();
    expect(await layoutIssues(page, "dialog.modal")).toEqual([]);
    await modal
      .getByRole("button", { name: "Xác nhận mua số" })
      .scrollIntoViewIfNeeded();
    await expect(
      modal.getByRole("button", { name: "Xác nhận mua số" }),
    ).toBeInViewport();
    await page.getByRole("button", { name: "Đóng hộp thoại" }).click();
    await navigate(page, "Lịch sử đơn hàng");
    await page
      .getByRole("button", {
        name: `Chi tiết đơn ${account.orders![0].orderCode}`,
        exact: true,
      })
      .last()
      .click();
    await expect(modal).toBeVisible();
    expect(await layoutIssues(page, "dialog.modal")).toEqual([]);
    await expect(modal).toContainText(account.orders![0].orderCode);
    await page.getByRole("button", { name: "Đóng hộp thoại" }).click();
    await page
      .getByRole("button", { name: "Thêm mã đơn", exact: true })
      .click();
    expect(await layoutIssues(page, "dialog.modal")).toEqual([]);
    await page.getByRole("button", { name: "Đóng hộp thoại" }).click();
    await page.getByRole("button", { name: "Mở menu điều hướng" }).click();
    await page
      .locator(".sidebar")
      .getByRole("button", { name: /Hướng dẫn sử dụng/ })
      .click();
    await expect(modal).toBeVisible();
    await expect(page.locator(".sidebar")).not.toBeInViewport();
    expect(await layoutIssues(page, "dialog.modal")).toEqual([]);
    await modal
      .locator(".modal-actions .button")
      .last()
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "Đóng hộp thoại" }),
    ).toBeInViewport();
    await page.getByRole("button", { name: "Đóng hộp thoại" }).click();
  });
}

test("touch navigation and signed-out forms reflow on a phone and after rotation", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await prepare(page);
    await page
      .locator(".account-strip-actions")
      .getByRole("button", { name: "Nạp tiền", exact: true })
      .tap();
    await expect(page.locator(".topup-reference")).toBeVisible();
    expect(await layoutIssues(page)).toEqual([]);
    await page.setViewportSize({ width: 800, height: 360 });
    await page.getByRole("button", { name: "Mở menu điều hướng" }).tap();
    await expect(
      page.getByRole("button", { name: "Đóng menu", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Đóng menu", exact: true }).tap();
    await page.setViewportSize({ width: 320, height: 568 });
    await page.route("**/api/account{,?*}", (r) =>
      r.fulfill({ json: { success: true, connected: false } }),
    );
    await page.route("**/api/connection", (r) =>
      r.fulfill({ json: { configured: false, source: null, accountId: null } }),
    );
    await page.reload();
    await navigate(page, "Tài khoản DVDD");
    await expect(page.getByLabel("Email DVDD", { exact: false })).toBeVisible();
    await page
      .getByLabel("Email DVDD", { exact: false })
      .fill("user@example.test");
    await page
      .getByLabel("Mật khẩu DVDD", { exact: false })
      .first()
      .fill("fixture-only-password");
    expect(await layoutIssues(page)).toEqual([]);
    await page
      .getByRole("button", { name: "Đăng nhập & kết nối", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "Đăng nhập & kết nối", exact: true }),
    ).toBeInViewport();
  } finally {
    await context.close();
  }
});

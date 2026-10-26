import { expect, test, type Page } from "@playwright/test";
import type { DvddAccount } from "../src/lib/types";

const email = "new-user@example.test";
const password = "fixture-password-123";
const connection = {
  configured: true,
  source: "session",
  accountId: "registered-fixture",
};
const profile: DvddAccount = {
  profile: { name: "Người Dùng Thử", email, phone: "0912345678", balance: 0 },
  orders: [],
  transactions: [],
  transactionPage: 1,
  transactionPages: 1,
  phonePages: 1,
  warnings: [],
  updatedAt: "2026-10-26T04:00:00Z",
};

async function prepare(page: Page) {
  const state = {
    connected: false,
    requests: 0,
    error: "",
    missingToken: false,
    unverified: false,
  };
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/phone", (route) => route.abort());
  await page.route("**/api/otp", (route) => route.abort());
  await page.route("**/api/connection", (route) =>
    route.fulfill({
      json: state.connected
        ? connection
        : { configured: false, source: null, accountId: null },
    }),
  );
  await page.route("**/api/account{,?*}", (route) =>
    route.fulfill({
      json: {
        success: true,
        connected: state.connected,
        ...(state.connected ? { data: profile } : {}),
      },
    }),
  );
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
  await page.route("**/api/register", async (route) => {
    state.requests++;
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({
      name: "Người Dùng Thử",
      email,
      phone: "0912345678",
      password,
      confirmPassword: password,
    });
    if (state.error === "network") return route.abort();
    if (state.error === "bad-json")
      return route.fulfill({ contentType: "application/json", body: "null" });
    if (state.error)
      return route.fulfill({
        status: 409,
        json: {
          success: false,
          code: state.error,
          message:
            "Email này đã được đăng ký tại DVDD. Hãy chuyển sang đăng nhập.",
        },
      });
    if (!state.missingToken && !state.unverified) state.connected = true;
    return route.fulfill({
      status: 201,
      json: {
        success: true,
        verified: !state.unverified,
        connected: !state.missingToken,
        requiresToken: state.missingToken,
        message: state.missingToken
          ? "Tài khoản DVDD đã được xác minh. Bạn cần tạo API token lần đầu."
          : "Tài khoản DVDD đã được xác minh và kết nối.",
        connection: state.missingToken
          ? { configured: false, source: null, accountId: null }
          : connection,
        ...(!state.missingToken ? { data: profile } : {}),
      },
    });
  });
  await page.goto("/");
  if ((page.viewportSize()?.width || 0) <= 900)
    await page.getByRole("button", { name: "Mở menu điều hướng" }).click();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Tài khoản DVDD", exact: true })
    .click();
  await page.getByRole("tab", { name: "Đăng ký", exact: true }).click();
  return state;
}

async function fill(page: Page) {
  await page.getByLabel("Họ và tên", { exact: false }).fill("Người Dùng Thử");
  await page.getByLabel("Email DVDD", { exact: false }).fill(email);
  await page
    .getByLabel("Số điện thoại", { exact: false })
    .fill("+84 912 345 678");
  await page
    .getByLabel("Mật khẩu DVDD", { exact: false })
    .first()
    .fill(password);
  await page.getByLabel("Nhập lại mật khẩu", { exact: false }).fill(password);
}

test("registration connects the verified account with zero balance, blocks repeated clicks and does not persist passwords", async ({
  page,
}) => {
  const state = await prepare(page);
  await fill(page);
  await page
    .getByRole("button", { name: "Đăng ký & kết nối", exact: true })
    .dblclick();
  await expect(page.locator(".account-profile")).toContainText(email);
  await expect(
    page.locator(".account-profile .dvdd-balance strong"),
  ).toHaveText("0đ");
  expect(state.requests).toBe(1);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    password,
  );
  await expect(
    page
      .locator(".account-profile")
      .getByRole("button", { name: "Nạp tiền", exact: true }),
  ).toBeEnabled();
});

test("mismatched passwords never reach the server", async ({ page }) => {
  const state = await prepare(page);
  await fill(page);
  await page
    .getByLabel("Nhập lại mật khẩu", { exact: false })
    .fill("different-password");
  await page
    .getByRole("button", { name: "Đăng ký & kết nối", exact: true })
    .click();
  await expect(page.locator(".account-login").getByRole("alert")).toContainText(
    "chưa khớp",
  );
  await expect(
    page.getByLabel("Nhập lại mật khẩu", { exact: false }),
  ).toBeFocused();
  expect(state.requests).toBe(0);
});

for (const failure of ["REGISTRATION_EMAIL_EXISTS", "network", "bad-json"]) {
  test(`registration ${failure} keeps the email and offers login without a second signup`, async ({
    page,
  }) => {
    const state = await prepare(page);
    state.error = failure;
    await fill(page);
    await page
      .getByRole("button", { name: "Đăng ký & kết nối", exact: true })
      .click();
    await expect(
      page.locator(".account-login").getByRole("alert"),
    ).toBeVisible();
    await expect(
      page.getByLabel("Mật khẩu DVDD", { exact: false }).first(),
    ).toHaveValue("");
    await expect(
      page.getByLabel("Nhập lại mật khẩu", { exact: false }),
    ).toHaveValue("");
    await page
      .getByRole("button", { name: "Thử đăng nhập với email này", exact: true })
      .click();
    await expect(
      page.getByRole("tab", { name: "Đăng nhập", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("Email DVDD", { exact: false })).toHaveValue(
      email,
    );
    expect(state.requests).toBe(1);
  });
}

test("verified accounts without a token receive setup instructions instead of a false connection", async ({
  page,
}) => {
  const state = await prepare(page);
  state.missingToken = true;
  await fill(page);
  await page
    .getByRole("button", { name: "Đăng ký & kết nối", exact: true })
    .click();
  await expect(page.locator(".registration-complete")).toContainText(
    "Tài khoản đã được xác minh",
  );
  await expect(page.locator(".registration-complete")).toContainText(
    "API token lần đầu",
  );
  await expect(
    page.getByRole("link", { name: "Mở mục API DVDD" }),
  ).toHaveAttribute("href", "https://dvdd.casa/dashboard?page=api");
  await expect(page.locator(".connection-pill").first()).toContainText(
    "Chưa kết nối API",
  );
  await page
    .getByRole("button", { name: "Đăng nhập để kết nối", exact: true })
    .click();
  await expect(page.getByLabel("Email DVDD", { exact: false })).toHaveValue(
    email,
  );
});

test("a nominal success without identity verification cannot connect the account", async ({
  page,
}) => {
  const state = await prepare(page);
  state.unverified = true;
  await fill(page);
  await page
    .getByRole("button", { name: "Đăng ký & kết nối", exact: true })
    .click();
  await expect(page.locator(".account-login").getByRole("alert")).toContainText(
    "Chưa xác định",
  );
  await expect(page.locator(".account-profile")).toHaveCount(0);
});

test("registration form and every field remain visible at phone, tablet and desktop sizes", async ({
  page,
}) => {
  await prepare(page);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByLabel("Họ và tên", { exact: false })).toBeVisible();
    await expect(
      page.getByLabel("Nhập lại mật khẩu", { exact: false }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator(".registration-fields")
        .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    ).toBe(true);
    if (width === 390 || width === 1440) {
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
        window.scrollTo({ top: 0, behavior: "instant" });
      });
      await page.screenshot({
        path: `test-results/registration-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  }
});

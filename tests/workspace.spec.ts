import { expect, test } from "@playwright/test";

test("empty workspace, navigation, responsive layout and demo purchase", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let externalCalls = 0;
  await page.route("https://api.dvdd-api.workers.dev/**", (route) => {
    externalCalls++;
    return route.abort();
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Mua số điện thoại" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Đăng nhập để mua số" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "Đơn hàng đầu tiên đang chờ bạn" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/workspace-desktop.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "Xem bản demo" }).click();
  await expect(page.getByText("Bạn đang ở chế độ dùng thử.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mua số ngay", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: /Số Vietnamobile Số chuyên biệt/ })
    .click();
  await page.getByRole("button", { name: "Mua số ngay", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Tạo đơn miễn phí" }).click();
  await expect(
    page.getByRole("heading", { name: "Chi tiết đơn hàng" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("Vietnamobile", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Đóng hộp thoại" }).click();
  await page.getByRole("button", { name: "Xem tất cả" }).click();
  await expect(
    page.getByRole("heading", { name: "Lịch sử đơn hàng" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Tìm số điện thoại hoặc mã đơn" })
    .fill("DEMO102401");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Xóa tìm kiếm" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất CSV", exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(
    /^dvdd-orders-.*\.csv$/,
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Đơn hàng đầu tiên đang chờ bạn" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Xem bản demo" }).click();
  await expect(page.locator(".orders-panel .count-badge")).toContainText("7");
  await page.screenshot({
    path: "test-results/workspace-demo.png",
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Mở menu điều hướng" }),
  ).toBeVisible();
  await expect(page.locator(".sidebar")).not.toBeInViewport();
  await expect(page.locator(".mobile-order-list")).toBeVisible();
  await expect(
    page.locator(".mobile-order-list").getByText("628491", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/workspace-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Mở menu điều hướng" }).click();
  await page.getByRole("button", { name: "Thống kê sử dụng" }).click();
  await expect(
    page.getByRole("heading", { name: "Thống kê sử dụng" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(externalCalls).toBe(0);
  expect(errors).toEqual([]);
});

test("token is encrypted and HttpOnly; real UI buys once and resolves OTP through proxy", async ({
  page,
  context,
}) => {
  const key = "test-only-token-not-a-real-credential";
  let phoneCalls = 0;
  let otpCalls = 0;
  await page.goto("/");
  await page.getByRole("button", { name: "Cấu hình API", exact: true }).click();
  await page.getByLabel("API token", { exact: false }).first().fill(key);
  await page.getByRole("button", { name: "Lưu kết nối" }).click();
  await expect(page.locator(".token-status")).toContainText("Đã lưu token");
  const cookies = await context.cookies();
  const credential = cookies.find(
    (cookie) => cookie.name === "dvdd_connection",
  );
  expect(credential?.httpOnly).toBe(true);
  expect(credential?.sameSite).toBe("Strict");
  expect(credential?.value).not.toContain(key);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    key,
  );
  const connection = await page.request.get("/api/connection");
  expect(await connection.text()).not.toContain(key);

  await page.route("**/api/phone", async (route) => {
    phoneCalls++;
    expect(route.request().postDataJSON()).toMatchObject({ service: "vnmb" });
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({
      json: {
        success: true,
        data: { phone: "923456789", orderCode: "TEST_REAL_UI_01" },
        fee: "2000đ",
      },
    });
  });
  await page.route("**/api/otp", async (route) => {
    otpCalls++;
    expect(route.request().postDataJSON()).toEqual({
      orderCode: "TEST_REAL_UI_01",
    });
    await route.fulfill({ json: { success: true, otp: "918273" } });
  });
  await page
    .getByRole("button", { name: "Mua số điện thoại", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Số Vietnamobile Số chuyên biệt/ })
    .click();
  await page.getByRole("button", { name: "Mua số ngay", exact: true }).click();
  await page
    .getByRole("button", { name: "Xác nhận mua số", exact: true })
    .dblclick();
  await expect(
    page.getByRole("heading", { name: "Chi tiết đơn hàng" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("0923 456 789"),
  ).toBeVisible();
  await expect(page.getByRole("dialog").getByText("2000đ")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("918273", { exact: true }),
  ).toBeVisible();
  expect(phoneCalls).toBe(1);
  expect(otpCalls).toBeGreaterThan(0);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .getByRole("button", { name: "Sao chép mã OTP", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("918273");
  await page.getByRole("button", { name: "Đóng hộp thoại" }).click();
  await page.getByRole("button", { name: "Cấu hình API", exact: true }).click();
  await page.getByRole("button", { name: "Xóa token đã lưu" }).click();
  await expect(page.locator(".topbar .connection-pill")).toContainText(
    "Chưa kết nối API",
  );
  await page
    .getByRole("button", { name: "Mua số điện thoại", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Đơn hàng đầu tiên đang chờ bạn" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cấu hình API", exact: true }).click();
  await page.getByLabel("API token", { exact: false }).first().fill(key);
  await page.getByRole("button", { name: "Lưu kết nối" }).click();
  await expect(page.locator(".token-status")).toContainText("Đã lưu token");
  await page
    .getByRole("button", { name: "Lịch sử đơn hàng", exact: true })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("TEST_REAL_UI_01");
});

test("server validates inputs and blocks cross-origin purchases without calling DVDD", async ({
  request,
}) => {
  const headers = { Origin: "http://localhost:3000" };
  // Fail before sending a valid purchase if an existing server has a real key.
  const configured = await request.get("/api/connection");
  expect((await configured.json()).configured).toBe(false);
  const missingKey = await request.post("/api/phone", {
    headers,
    data: { service: "standard" },
  });
  expect(missingKey.status()).toBe(401);
  const unknownService = await request.post("/api/phone", {
    headers,
    data: { service: "other" },
  });
  expect(unknownService.status()).toBe(400);
  const crossOrigin = await request.post("/api/phone", {
    headers: { Origin: "https://untrusted.example" },
    data: { service: "standard" },
  });
  expect(crossOrigin.status()).toBe(403);
  const invalidOrder = await request.post("/api/otp", {
    headers,
    data: { orderCode: "../invalid" },
  });
  expect(invalidOrder.status()).toBe(400);
  const invalidToken = await request.post("/api/connection", {
    headers,
    data: { apiKey: "invalid token" },
  });
  expect(invalidToken.status()).toBe(400);
});

test("purchase failures remain visible and expired OTP ends polling", async ({
  page,
}) => {
  await page.goto("/");
  await page.request.post("/api/connection", {
    headers: { Origin: "http://localhost:3000" },
    data: { apiKey: "test-failure-token" },
  });
  await page.reload();
  let purchases = 0;
  await page.route("**/api/phone", async (route) => {
    purchases++;
    await route.fulfill({
      status: 422,
      json: {
        success: false,
        message: "Số dư không đủ",
        code: "PROVIDER_ERROR",
      },
    });
  });
  await page.getByRole("button", { name: "Mua số ngay", exact: true }).click();
  await page
    .getByRole("button", { name: "Xác nhận mua số", exact: true })
    .click();
  await expect(page.locator(".checkout-panel .inline-error")).toContainText(
    "Số dư không đủ",
  );
  expect(purchases).toBe(1);

  await page.route("**/api/otp", (route) =>
    route.fulfill({
      status: 410,
      json: {
        success: false,
        code: "ORDER_EXPIRED",
        message: "Đơn đã hết hạn",
      },
    }),
  );
  await page
    .getByRole("button", { name: "Lịch sử đơn hàng", exact: true })
    .click();
  await page.getByRole("button", { name: "Thêm mã đơn" }).click();
  await page
    .getByLabel("Mã đơn hàng", { exact: false })
    .fill("TEST_EXPIRED_01");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Thêm mã đơn" })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Đã hết hạn", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Kiểm tra OTP ngay" }),
  ).toHaveCount(0);
});

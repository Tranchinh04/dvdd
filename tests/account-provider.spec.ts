import { expect, test } from "@playwright/test";
import {
  loginAccount,
  parsePhoneHistory,
  parseProfile,
  parseTransactions,
  readAccount,
  readHistoryPage,
} from "../src/lib/server/account-provider";
import {
  createAccountSession,
  decodeAccountSession,
  encodeAccountSession,
} from "../src/lib/server/account-session";

const profile = `<a href="dashboard?page=transactions-add">Nạp tiền</a><a href="dashboard?page=transactions-add">98.765đ</a><input name="firstName" value="Người Dùng Thử"><input name="emailAddress" value="fixture@example.test"><input name="mobileNumber" value="0912345678">`;
const phoneHeaders = [
  "Mã đơn",
  "Dịch vụ",
  "Trạng thái",
  "Số điện thoại",
  "Kết quả",
  "Nhắc lại",
  "Thời gian",
  "Phí",
];
const transactionHeaders = [
  "Mã giao dịch",
  "Số tiền (đ)",
  "Số dư cuối (đ)",
  "Mô tả",
  "Mã đơn hàng",
  "Thời gian",
];
function table(headers: string[], body: string) {
  return `<table><thead><tr>${headers.map((label) => `<th>${label}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;
}
const orders =
  table(
    phoneHeaders,
    `<tr><td>FIXTURE_ORDER</td><td>Thuê số - VNMB</td><td>Đã xong</td><td>912345678<i></i></td><td><span>642918</span><br><button>Tải Audio</button><audio src="/never-fetch"></audio></td><td><button>Lấy link</button></td><td>14-10<br>Lấy: 11:57<br>Nhận OTP: 11:59</td><td>5.500đ</td></tr>`,
  ) +
  `<h3>Đơn thuê số gần đây</h3><table><tbody><tr><td>PUBLIC_OTHER_USER</td><td>999999999</td></tr></tbody></table>`;
const transactions =
  table(
    transactionHeaders,
    `<tr><td>TX_FIXTURE</td><td>5.500</td><td>98.765</td><td>Thuê số</td><td>FIXTURE_ORDER</td><td>2026-10-14 11:57:55</td></tr>`,
  ) +
  `<ul class="pagination"><li><a href="dashboard?page=transactions&paging=7">Cuối cùng</a></li><li><a href="https://outside.test/dashboard?page=transactions&paging=999">Outside</a></li></ul>`;
const originalFetch = globalThis.fetch;
test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("account parsers read supplier balance and only the owner's table, preserving unknown amounts", () => {
  expect(parseProfile(profile)).toMatchObject({
    email: "fixture@example.test",
    balance: 98765,
  });
  expect(parseProfile(profile.replace("98.765đ", "0đ")).balance).toBe(0);
  expect(
    parseProfile(profile.replace("98.765đ", "Không rõ")).balance,
  ).toBeNull();
  const parsed = parsePhoneHistory(orders);
  expect(parsed).toHaveLength(1);
  expect(parsed[0]).toMatchObject({
    orderCode: "FIXTURE_ORDER",
    result: "642918",
    feeAmount: 5500,
    time: "14-10 · Lấy: 11:57 · Nhận OTP: 11:59",
  });
  expect(JSON.stringify(parsed)).not.toContain("PUBLIC_OTHER_USER");
  expect(JSON.stringify(parsed)).not.toContain("Tải Audio");
  expect(
    parsePhoneHistory(orders.replace("5.500đ", "Chưa có phí"))[0].feeAmount,
  ).toBeNull();
  expect(
    parsePhoneHistory(
      table(phoneHeaders, '<tr><td colspan="8">Chưa có dữ liệu</td></tr>'),
    ),
  ).toEqual([]);
  expect(() => parsePhoneHistory("<h3>Changed markup</h3>")).toThrow(
    "Cấu trúc trang",
  );
  expect(() =>
    parseProfile("<script>window.location.replace('/login.php')</script>"),
  ).toThrow("hết hạn");
});

test("transactions preserve unsigned provider amounts and paginate only the supplier history", () => {
  expect(parseTransactions(transactions)).toEqual({
    pages: 7,
    rows: [
      {
        code: "TX_FIXTURE",
        amount: "5.500",
        balanceAfter: "98.765",
        description: "Thuê số",
        orderCode: "FIXTURE_ORDER",
        time: "2026-10-14 11:57:55",
      },
    ],
  });
});

test("login forwards the password once, rotates the cookie and imports the existing token without billable calls", async () => {
  const calls: { path: string; method: string }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    expect(url.origin).toBe("https://dvdd.casa");
    expect(init?.redirect).toBe("manual");
    expect(init?.cache).toBe("no-store");
    calls.push({ path: url.pathname, method: init?.method || "GET" });
    if (url.pathname === "/login.php" && init?.method === "GET")
      return new Response(
        '<input name="sessionKey" value="fixture-csrf"><input name="emailAddress"><input name="pass" type="password"><input type="checkbox" name="remember">',
        { headers: { "Set-Cookie": "PHPSESSID=before-login; Path=/" } },
      );
    if (url.pathname === "/login.php" && init?.method === "POST") {
      const body = new URLSearchParams(String(init.body));
      expect(body.get("emailAddress")).toBe("fixture@example.test");
      expect(body.get("pass")).toBe(" fixture-password ");
      expect(body.get("sessionKey")).toBe("fixture-csrf");
      expect(body.get("remember")).toBe("on");
      expect(body.has("login")).toBe(true);
      expect(new Headers(init.headers).get("cookie")).toBe(
        "PHPSESSID=before-login",
      );
      return new Response(null, {
        status: 302,
        headers: {
          Location: "https://untrusted.test/never-follow",
          "Set-Cookie": "PHPSESSID=after-login; Path=/",
        },
      });
    }
    expect(new Headers(init?.headers).get("cookie")).toBe(
      "PHPSESSID=after-login",
    );
    if (url.searchParams.get("page") === "admin-profile-form")
      return new Response(profile);
    if (url.searchParams.get("page") === "api")
      return new Response(
        '<input name="token" id="token" value="fixture-api-token">',
      );
    if (url.searchParams.get("page") === "order-phone")
      return new Response(orders);
    if (url.searchParams.get("page") === "transactions")
      return new Response(transactions);
    throw new Error("Unapproved supplier action");
  };
  const result = await loginAccount(
    "fixture@example.test",
    " fixture-password ",
  );
  expect(result.apiKey).toBe("fixture-api-token");
  expect(result.jar).toEqual({ PHPSESSID: "after-login" });
  expect(result.data.profile.balance).toBe(98765);
  expect(JSON.stringify(result)).not.toContain("fixture-password");
  expect(calls.filter((call) => call.method === "POST")).toEqual([
    { path: "/login.php", method: "POST" },
  ]);
  expect(
    calls.every((call) => ["/login.php", "/dashboard"].includes(call.path)),
  ).toBe(true);
});

test("failed login never reads other pages or returns the upstream body", async () => {
  let profileCalls = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/login.php")
      return new Response(
        init?.method === "GET"
          ? '<input name="emailAddress"><input name="pass">'
          : "fixture-password must not escape",
      );
    profileCalls++;
    return new Response('<input name="emailAddress" value="">');
  };
  await expect(
    loginAccount("fixture@example.test", "fixture-password"),
  ).rejects.toMatchObject({ status: 401, code: "ACCOUNT_LOGIN_FAILED" });
  expect(profileCalls).toBe(1);
});

test("supplier HTTP failures identify the failing operation without leaking credentials or retrying login", async () => {
  const originalWarn = console.warn;
  const diagnostics: unknown[][] = [];
  console.warn = (...args) => diagnostics.push(args);
  try {
    for (const [status, code] of [
      [403, "ACCOUNT_ACCESS_DENIED"],
      [429, "ACCOUNT_RATE_LIMITED"],
      [503, "ACCOUNT_UNAVAILABLE"],
    ] as const) {
      const calls: string[] = [];
      globalThis.fetch = async (_input, init) => {
        calls.push(init?.method || "GET");
        return init?.method === "GET"
          ? new Response('<input name="emailAddress"><input name="pass">')
          : new Response("private-upstream-body fixture-password", { status });
      };
      let failure: unknown;
      try {
        await loginAccount("fixture@example.test", "fixture-password");
      } catch (error) {
        failure = error;
      }
      expect(failure).toMatchObject({ code });
      expect((failure as Error).message).toContain(`HTTP ${status}`);
      if (status !== 429)
        expect((failure as Error).message).toContain("login-submit");
      expect((failure as Error).message).not.toContain("fixture-password");
      expect(calls).toEqual(["GET", "POST"]);
    }
    expect(diagnostics).toEqual(
      [403, 429, 503].map((status) => [
        "[DVDD account] Upstream request failed",
        { operation: "login-submit", status },
      ]),
    );
    expect(JSON.stringify(diagnostics)).not.toMatch(
      /fixture-password|fixture@example|private-upstream-body/,
    );
  } finally {
    console.warn = originalWarn;
  }
});

test("missing API token requires setup rather than silently creating or replacing a token", async () => {
  const paths: string[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    paths.push(url.pathname);
    if (url.pathname === "/login.php")
      return new Response('<input name="emailAddress"><input name="pass">');
    return new Response(
      url.searchParams.get("page") === "admin-profile-form"
        ? profile
        : '<input name="token" id="token" value="">',
    );
  };
  await expect(
    loginAccount("fixture@example.test", "fixture-password"),
  ).rejects.toMatchObject({ code: "ACCOUNT_TOKEN_MISSING" });
  expect(
    paths.every((path) => ["/login.php", "/dashboard"].includes(path)),
  ).toBe(true);
});

test("partial history failures retain the account balance and report unavailable sections", async () => {
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.searchParams.get("page") === "admin-profile-form")
      return new Response(profile);
    if (url.searchParams.get("page") === "transactions")
      return new Response(transactions);
    return new Response("Unavailable", { status: 502 });
  };
  const result = await readAccount({ PHPSESSID: "fixture-session" }, 2);
  expect(result.profile.balance).toBe(98765);
  expect(result.orders).toBeNull();
  expect(result.transactions).toHaveLength(1);
  expect(result.transactionPage).toBe(2);
  expect(result.warnings).toHaveLength(1);
  globalThis.fetch = async () =>
    new Response('<input name="emailAddress" value="">');
  await expect(
    readAccount({ PHPSESSID: "fixture-session" }),
  ).rejects.toMatchObject({ code: "ACCOUNT_SESSION_EXPIRED" });
});

test("supplier sessions are encrypted, expire and cannot cross API-token accounts", () => {
  const session = createAccountSession(
    { PHPSESSID: "fixture-session" },
    "fixture-key",
  );
  const encrypted = encodeAccountSession(session);
  expect(encrypted).not.toContain("fixture-session");
  expect(encrypted).not.toContain("fixture-key");
  expect(decodeAccountSession(encrypted, "fixture-key")).toEqual(session);
  expect(decodeAccountSession(encrypted, "another-account-key")).toBeNull();
  expect(decodeAccountSession(encrypted, null)).toBeNull();
  expect(
    decodeAccountSession(encrypted.slice(0, -8) + "tampered", "fixture-key"),
  ).toBeNull();
  expect(
    decodeAccountSession(
      encodeAccountSession({ ...session, expiresAt: Date.now() - 1 }),
      "fixture-key",
    ),
  ).toBeNull();
});

test("history pagination uses fixed read-only supplier routes and preserves the advertised page count", async () => {
  const paths: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    expect(url.origin).toBe("https://dvdd.casa");
    expect(init?.method).toBe("GET");
    expect(init?.redirect).toBe("manual");
    expect(new Headers(init?.headers).get("cookie")).toBe(
      "PHPSESSID=fixture-session",
    );
    paths.push(url.pathname + url.search);
    return new Response(
      url.searchParams.get("page") === "transactions" ? transactions : orders,
    );
  };
  const jar = { PHPSESSID: "fixture-session" };
  expect(await readHistoryPage(jar, "transactions", 7)).toMatchObject({
    kind: "transactions",
    page: 7,
    pages: 7,
    rows: [{ code: "TX_FIXTURE" }],
  });
  expect(await readHistoryPage(jar, "phones", 1)).toMatchObject({
    kind: "phones",
    page: 1,
    pages: 1,
    rows: [{ orderCode: "FIXTURE_ORDER" }],
  });
  await expect(
    readHistoryPage(jar, "transactions", 1001),
  ).rejects.toMatchObject({ status: 400 });
  expect(paths).toEqual([
    "/dashboard?page=transactions&paging=7",
    "/dashboard?page=order-phone&paging=1",
  ]);
});

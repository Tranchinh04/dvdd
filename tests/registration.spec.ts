import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import {
  registerAccount,
  registrationForm,
} from "../src/lib/server/account-provider";
import { validateRegistration } from "../src/lib/registration";
import { POST } from "../src/app/api/register/route";
import {
  ACCOUNT_COOKIE,
  CREDENTIAL_COOKIE,
  decryptToken,
} from "../src/lib/server/credentials";
import {
  ACCOUNT_SESSION_SECONDS,
  decodeAccountSession,
} from "../src/lib/server/account-session";

const input = {
  name: "Người Dùng Thử",
  email: "new-user@example.test",
  phone: "0912345678",
  password: "fixture-password-123",
  confirmPassword: "fixture-password-123",
};
const form =
  '<form id="registerForm" method="post"><input type="hidden" name="register" value="1"><input type="hidden" name="initData" value=""><input name="name"><input name="emailAddress"><input name="phone"><input name="pass"><input name="repass"></form>';
const profile = `<input name="emailAddress" value="${input.email}"><input name="firstName" value="${input.name}"><input name="mobileNumber" value="${input.phone}"><a href="dashboard?page=transactions-add">0đ</a>`;
const table = (headers: string[]) =>
  `<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody></tbody></table>`;
const originalFetch = globalThis.fetch;
test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mock(
  options: {
    registrationHtml?: string;
    failPost?: boolean;
    failedLogin?: boolean;
    missingToken?: boolean;
    formHtml?: string;
  } = {},
) {
  const calls: { path: string; method: string }[] = [];
  globalThis.fetch = async (target, init) => {
    const url = new URL(String(target));
    expect(url.origin).toBe("https://dvdd.casa");
    expect(init?.redirect).toBe("manual");
    expect(init?.cache).toBe("no-store");
    const method = init?.method || "GET";
    calls.push({ path: url.pathname + url.search, method });
    if (url.pathname === "/register.php") {
      if (method === "GET")
        return new Response(options.formHtml ?? form, {
          headers: { "set-cookie": "PHPSESSID=registration-session; Path=/" },
        });
      const body = new URLSearchParams(String(init?.body));
      expect(Object.fromEntries(body)).toEqual({
        register: "1",
        initData: "",
        name: input.name,
        emailAddress: input.email,
        phone: input.phone,
        pass: input.password,
        repass: input.confirmPassword,
      });
      expect(new Headers(init?.headers).get("referer")).toBe(
        "https://dvdd.casa/register.php",
      );
      expect(new Headers(init?.headers).get("cookie")).toBe(
        "PHPSESSID=registration-session",
      );
      if (options.failPost)
        throw new Error("private request details must not escape");
      return new Response(
        options.registrationHtml ??
          '<div class="alert alert-success" role="alert">Đăng ký thành công</div>',
      );
    }
    if (url.pathname === "/login.php") {
      if (method === "GET")
        return new Response(
          '<input name="emailAddress"><input name="pass"><input name="sessionKey" value="fixture-key"><input type="checkbox" name="remember">',
          { headers: { "set-cookie": "PHPSESSID=login-session; Path=/" } },
        );
      expect(new URLSearchParams(String(init?.body)).get("emailAddress")).toBe(
        input.email,
      );
      return new Response(null, {
        status: 302,
        headers: {
          location: "/dashboard",
          "set-cookie": "PHPSESSID=verified-session; Path=/",
        },
      });
    }
    expect(method).toBe("GET");
    expect(new Headers(init?.headers).get("cookie")).toBe(
      "PHPSESSID=verified-session",
    );
    if (url.searchParams.get("page") === "admin-profile-form")
      return new Response(
        options.failedLogin ? '<input name="emailAddress" value="">' : profile,
      );
    if (url.searchParams.get("page") === "api")
      return new Response(
        `<input name="token" id="token" value="${options.missingToken ? "" : "fixture-existing-api-token"}">`,
      );
    if (url.searchParams.get("page") === "order-phone")
      return new Response(
        table([
          "Mã đơn",
          "Dịch vụ",
          "Trạng thái",
          "Số điện thoại",
          "Kết quả",
          "Nhắc lại",
          "Thời gian",
          "Phí",
        ]),
      );
    if (url.searchParams.get("page") === "transactions")
      return new Response(
        table([
          "Mã giao dịch",
          "Số tiền (đ)",
          "Số dư cuối (đ)",
          "Mô tả",
          "Mã đơn hàng",
          "Thời gian",
        ]),
      );
    throw new Error("Unapproved supplier operation");
  };
  return calls;
}

test("registration validates names, email, Vietnamese phone normalization and matching passwords", () => {
  expect(
    validateRegistration({ ...input, phone: "+84 912 345 678" }).data?.phone,
  ).toBe(input.phone);
  expect(
    validateRegistration({ ...input, name: "  Nguyễn   Văn An  " }).data?.name,
  ).toBe("Nguyễn Văn An");
  for (const [key, value] of [
    ["name", ""],
    ["email", "invalid"],
    ["phone", "123"],
    ["password", "short"],
    ["confirmPassword", "different"],
  ] as const)
    expect(validateRegistration({ ...input, [key]: value }).field).toBe(key);
  const spaces = {
    ...input,
    password: " password with spaces ",
    confirmPassword: " password with spaces ",
  };
  expect(validateRegistration(spaces).data?.password).toBe(spaces.password);
});

test("registration submits once, authenticates the same identity, reads existing API token and never buys or rotates a token", async () => {
  const calls = mock();
  const result = await registerAccount({ ...input });
  expect(result).toMatchObject({ connected: true, requiresToken: false });
  expect(calls.filter((c) => c.method === "POST")).toEqual([
    { path: "/register.php", method: "POST" },
    { path: "/login.php", method: "POST" },
  ]);
  expect(JSON.stringify(result)).not.toContain(input.password);
});

test("explicit duplicate email/phone or validation errors are redacted and never followed by automatic login", async () => {
  for (const [html, code] of [
    [
      '<div class="alert-danger">Email đã tồn tại private password</div>',
      "REGISTRATION_EMAIL_EXISTS",
    ],
    [
      '<div class="alert-danger">Số điện thoại đã được sử dụng</div>',
      "REGISTRATION_PHONE_EXISTS",
    ],
    [
      '<div role="alert">private provider error and secret</div>',
      "REGISTRATION_REJECTED",
    ],
  ]) {
    const calls = mock({ registrationHtml: html });
    let failure: unknown;
    try {
      await registerAccount({ ...input });
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({ code });
    expect((failure as Error).message).not.toMatch(/private|password|secret/);
    expect(calls).toHaveLength(2);
  }
});

test("lost registration responses and unverified accounts stay unknown without retry or false success", async () => {
  for (const options of [{ failPost: true }, { failedLogin: true }]) {
    const calls = mock(options);
    await expect(registerAccount({ ...input })).rejects.toMatchObject({
      code: "REGISTRATION_OUTCOME_UNKNOWN",
    });
    expect(
      calls.filter((c) => c.path === "/register.php" && c.method === "POST"),
    ).toHaveLength(1);
  }
});

test("missing token is a verified setup state and does not silently create or rotate a token", async () => {
  const calls = mock({ missingToken: true });
  const result = await registerAccount({ ...input });
  expect(result).toMatchObject({ connected: false, requiresToken: true });
  expect(result).not.toHaveProperty("apiKey");
  expect(calls.filter((c) => c.method === "POST")).toHaveLength(2);
});

test("changed signup forms, foreign targets and challenges fail before submitting personal information", () => {
  for (const html of [
    form.replace('method="post"', 'method="get"'),
    form.replace(
      'method="post"',
      'method="post" action="https://evil.test/register.php"',
    ),
    form.replace('name="phone"', 'name="unknownPhone"'),
    form.replace('name="register" value="1"', 'name="register" value="2"'),
    form.replace(
      "</form>",
      '<input type="hidden" name="unknownCsrf" value="private"></form>',
    ),
  ])
    expect(() => registrationForm(html)).toThrow("Cấu trúc trang");
  expect(() =>
    registrationForm(form + '<div class="cf-turnstile"></div>'),
  ).toThrow("xác minh thêm");
});

function request(body: unknown, origin = "https://workspace.example.test") {
  return new NextRequest("https://workspace.example.test/api/register", {
    method: "POST",
    headers: {
      host: "workspace.example.test",
      origin,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

test("registration route sets only encrypted account cookies after verification and never returns credentials", async () => {
  mock();
  const response = await POST(request(input));
  expect(response.status).toBe(201);
  const body = await response.text();
  expect(body).not.toMatch(
    /fixture-existing-api-token|verified-session|fixture-password/,
  );
  expect(JSON.parse(body)).toMatchObject({
    verified: true,
    connected: true,
    data: { profile: { email: input.email } },
  });
  const apiKey = decryptToken(response.cookies.get(CREDENTIAL_COOKIE)!.value);
  expect(apiKey).toBe("fixture-existing-api-token");
  expect(
    decodeAccountSession(response.cookies.get(ACCOUNT_COOKIE)!.value, apiKey)
      ?.cookies.PHPSESSID,
  ).toBe("verified-session");
  expect(response.cookies.get(ACCOUNT_COOKIE)).toMatchObject({
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/api",
    maxAge: ACCOUNT_SESSION_SECONDS,
  });
  expect(response.cookies.get(CREDENTIAL_COOKIE)?.maxAge).toBe(ACCOUNT_SESSION_SECONDS);
  expect(response.headers.get("cache-control")).toContain("no-store");
});

test("registration route rejects cross-origin and invalid input before contacting DVDD, and clears old cookies for incomplete setup", async () => {
  const calls = mock();
  expect((await POST(request(input, "https://evil.test"))).status).toBe(403);
  expect(
    (await POST(request({ ...input, confirmPassword: "bad" }))).status,
  ).toBe(400);
  expect(calls).toHaveLength(0);
  mock({ missingToken: true });
  const response = await POST(request(input));
  expect(await response.json()).toMatchObject({
    verified: true,
    connected: false,
    requiresToken: true,
    connection: { configured: false },
  });
  expect(response.cookies.get(ACCOUNT_COOKIE)?.maxAge).toBe(0);
  expect(response.cookies.get(CREDENTIAL_COOKIE)?.maxAge).toBe(0);
});

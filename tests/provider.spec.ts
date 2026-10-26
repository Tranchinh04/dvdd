import { expect, test } from "@playwright/test";
import { callProvider } from "../src/lib/server/provider";

const originalFetch = globalThis.fetch;
test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("provider sends the documented GET function and order code exactly once", async () => {
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push(url.searchParams.get("func")!);
    expect(url.origin).toBe("https://api.dvdd-api.workers.dev");
    expect(url.searchParams.get("apiKey")).toBe("test-key");
    expect(init?.method).toBe("GET");
    expect(init?.cache).toBe("no-store");
    if (url.searchParams.get("func") === "getOtp") {
      expect(url.searchParams.get("orderCode")).toBe("RTFG21711264013");
      return Response.json({ success: true, otp: "123456" });
    }
    return Response.json({
      success: true,
      data: { phone: "333564847", orderCode: "RTFG21711264013" },
      fee: "3000đ",
    });
  };
  await expect(
    callProvider("test-key", "getPhoneNumber"),
  ).resolves.toMatchObject({ fee: "3000đ" });
  await callProvider("test-key", "getPhoneNumberVNMB");
  await expect(
    callProvider("test-key", "getOtp", "RTFG21711264013"),
  ).resolves.toMatchObject({ otp: "123456" });
  expect(calls).toEqual(["getPhoneNumber", "getPhoneNumberVNMB", "getOtp"]);
});

test("provider distinguishes pending OTP, expiration and account errors", async () => {
  globalThis.fetch = async () => Response.json({ success: true, otp: "" });
  await expect(
    callProvider("test-key", "getOtp", "TEST01"),
  ).resolves.toMatchObject({ otp: "" });
  globalThis.fetch = async () =>
    Response.json({ success: false, message: "Đơn hàng hết hạn" });
  await expect(
    callProvider("test-key", "getOtp", "TEST01"),
  ).rejects.toMatchObject({ status: 410, code: "ORDER_EXPIRED" });
  globalThis.fetch = async () =>
    Response.json({
      success: false,
      message: "Thông tin tài khoản không đúng test-key",
    });
  await expect(
    callProvider("test-key", "getPhoneNumber"),
  ).rejects.toMatchObject({
    status: 422,
    message: "Thông tin tài khoản không đúng [đã ẩn]",
  });
});

test("ambiguous purchase failures never retry or disclose the token", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error("Request failed https://example.test?apiKey=secret-key");
  };
  try {
    await callProvider("secret-key", "getPhoneNumber");
  } catch (error) {
    expect((error as Error).message).toContain("tránh trừ phí hai lần");
    expect((error as Error).message).not.toContain("secret-key");
  }
  expect(calls).toBe(1);
  globalThis.fetch = async () =>
    new Response("<html>bad gateway</html>", { status: 502 });
  await expect(
    callProvider("secret-key", "getPhoneNumber"),
  ).rejects.toMatchObject({ status: 502, code: "INVALID_RESPONSE" });
});

test("non-JSON HTTP 403 reports provider access denial without retrying or leaking the token", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("<html>secret-key private upstream details</html>", { status: 403 });
  };
  await expect(callProvider("secret-key", "getOtp", "TEST01")).rejects.toMatchObject({
    status: 502, code: "PROVIDER_ACCESS_DENIED",
  });
  try { await callProvider("secret-key", "getPhoneNumber"); }
  catch (error) { expect((error as Error).message).not.toMatch(/secret-key|private upstream/); }
  expect(calls).toBe(2);
});

test("the worker's numeric zero is an error and numeric one cannot confirm a billable purchase", async () => {
  globalThis.fetch = async () => Response.json({ success: 0, logout: true, message: "Thông tin tài khoản không đúng secret-key" });
  await expect(callProvider("secret-key", "getOtp", "TEST01")).rejects.toMatchObject({
    status: 422, code: "PROVIDER_ERROR", message: "Thông tin tài khoản không đúng [đã ẩn]",
  });
  globalThis.fetch = async () => Response.json({ success: 1, data: { phone: "912345678" } });
  await expect(callProvider("secret-key", "getPhoneNumber")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
});

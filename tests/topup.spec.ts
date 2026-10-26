import { expect, test } from "@playwright/test";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { parseTopup, topupDetails } from "../src/lib/server/topup";
import { readTopup } from "../src/lib/server/account-provider";
import { topupHtml, topupPayload } from "./fixtures/topup";

test("supplier funding details match the CRC-validated account, bank, payee and reference in the QR", async () => {
  const data = parseTopup(topupHtml());
  expect(data).toMatchObject({
    accountName: "NGUOI NHAN THU",
    accountNumber: "012345678901",
    reference: "NAPFIXTURE01",
    minimumAmount: 20000,
    qrPayload: topupPayload,
  });
  expect(parseTopup(topupHtml().replace("20K", "20.000đ")).minimumAmount).toBe(
    20000,
  );
  const rendered = await topupDetails(topupHtml());
  const png = PNG.sync.read(
    Buffer.from(rendered.qrDataUrl.split(",")[1], "base64"),
  );
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  expect(decoded?.data).toBe(topupPayload);
  expect(rendered).not.toHaveProperty("qrPayload");
});

test("ambiguous, altered, incomplete or mismatched funding data fails closed", () => {
  const valid = topupHtml();
  const invalid = [
    valid.replace("- 012345678901 -", "- 999999999999 -"),
    valid.replace("CK: NAPFIXTURE01", "CK: OTHER_ACCOUNT"),
    valid.replace("TK Ngân hàng: NGUOI NHAN THU", "TK Ngân hàng: OTHER PAYEE"),
    valid.replace("MB Bank", "Another Bank"),
    valid.replace("quickchart.io/", "quickchart.io.evil.test/"),
    valid.replace("https://quickchart", "http://quickchart"),
    valid.replace("currentPhoto", "unverified-qr"),
    valid + "<h5>Nội dung CK: AMBIGUOUS</h5>",
    valid.replace("20K", "không rõ"),
    valid.replace("3-5 phút", "không rõ"),
    topupHtml(topupPayload.slice(0, -1) + "0"),
    topupHtml(topupPayload + "extra"),
    topupHtml("https://evil.test/payment"),
  ];
  for (const html of invalid)
    expect(() => parseTopup(html)).toThrow("Chưa xác minh");
  expect(() =>
    parseTopup('<input name="emailAddress"><input name="pass">'),
  ).toThrow("hết hạn");
});

test("funding connector only reads the authenticated fixed funding page and renders QR locally", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input, options) => {
    calls.push(String(input));
    expect(String(input)).toBe(
      "https://dvdd.casa/dashboard?page=transactions-add",
    );
    expect(options?.method).toBe("GET");
    expect(options?.redirect).toBe("manual");
    expect(options?.cache).toBe("no-store");
    expect(new Headers(options?.headers).get("cookie")).toBe(
      "PHPSESSID=fixture-session",
    );
    return new Response(topupHtml());
  };
  try {
    const data = await readTopup({ PHPSESSID: "fixture-session" });
    expect(data.reference).toBe("NAPFIXTURE01");
    expect(calls).toHaveLength(1);
    expect(data.qrDataUrl).toMatch(/^data:image\/png;base64,/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("funding route requires a web session even when an API token is configured", async ({
  request,
}) => {
  const noSession = await request.get("/api/topup");
  expect(noSession.status()).toBe(401);
  expect(await noSession.json()).toMatchObject({
    code: "ACCOUNT_SESSION_EXPIRED",
  });
  const connection = await request.post("/api/connection", {
    headers: { Origin: "http://localhost:3000" },
    data: { apiKey: "fixture-topup-token" },
  });
  expect(connection.status()).toBe(200);
  const tokenOnly = await request.get("/api/topup");
  expect(tokenOnly.status()).toBe(401);
  expect(tokenOnly.headers()["cache-control"]).toContain("no-store");
  expect(await tokenOnly.text()).not.toMatch(
    /qrDataUrl|accountNumber|fixture-topup-token/,
  );
  const post = await request.post("/api/topup", { data: {} });
  expect(post.status()).toBe(405);
});

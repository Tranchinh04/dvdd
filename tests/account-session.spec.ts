import { expect, test } from "@playwright/test";
import { NextRequest, NextResponse } from "next/server";
import { spawnSync } from "node:child_process";
import {
  ACCOUNT_SESSION_SECONDS,
  createAccountSession,
  decodeAccountSession,
  encodeAccountSession,
  persistAccountSession,
} from "../src/lib/server/account-session";
import {
  ACCOUNT_COOKIE,
  CREDENTIAL_COOKIE,
  decryptToken,
} from "../src/lib/server/credentials";
import { POST as login } from "../src/app/api/account/route";
import { POST as register } from "../src/app/api/register/route";

test("verified account cookies persist for 30 days and renew the token together with the PHP session", () => {
  const before = Date.now();
  const legacy = createAccountSession({ PHPSESSID: "fixture-php-session" }, "fixture-token");
  legacy.expiresAt = before + 60_000;
  const decoded = decodeAccountSession(encodeAccountSession(legacy), "fixture-token");
  expect(decoded).not.toBeNull();
  const response = persistAccountSession(
    NextResponse.json({ success: true }),
    new NextRequest("https://workspace.example.test/api/account"),
    decoded!.cookies,
    "fixture-token",
  );
  expect(ACCOUNT_SESSION_SECONDS).toBe(30 * 86400);
  for (const name of [ACCOUNT_COOKIE, CREDENTIAL_COOKIE]) {
    const cookie = response.cookies.get(name)!;
    expect(cookie).toMatchObject({
      httpOnly: true, secure: true, sameSite: "strict", path: "/api",
      maxAge: 30 * 86400,
    });
    expect(new Date(cookie.expires!).getTime()).toBeGreaterThanOrEqual(before + 30 * 86400_000);
    expect(cookie.value).not.toContain("fixture-");
  }
  const apiKey = decryptToken(response.cookies.get(CREDENTIAL_COOKIE)!.value);
  const renewed = decodeAccountSession(response.cookies.get(ACCOUNT_COOKIE)!.value, apiKey);
  expect(renewed?.expiresAt).toBeGreaterThanOrEqual(before + 30 * 86400_000);
  expect(renewed?.cookies.PHPSESSID).toBe("fixture-php-session");
  expect(decodeAccountSession(response.cookies.get(ACCOUNT_COOKIE)!.value, "another-token")).toBeNull();
  legacy.expiresAt = before - 1;
  expect(decodeAccountSession(encodeAccountSession(legacy), "fixture-token")).toBeNull();
});

// Separate Node processes reproduce cold starts without sharing globalThis.
const worker = `
  const fs = require('node:fs');
  const ts = require('typescript');
  require.extensions['.ts'] = (mod, filename) => {
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText, filename);
  };
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const credentials = require(process.cwd() + '/src/lib/server/credentials.ts');
  try {
    const value = input.action === 'encrypt'
      ? credentials.encryptToken('fixture-token')
      : credentials.decryptToken(input.encrypted);
    process.stdout.write(JSON.stringify({ value }));
  } catch (error) {
    process.stdout.write(JSON.stringify({ code: error.code, status: error.status }));
  }
`;
function freshServer(input: object, secret?: string) {
  const env = { ...process.env, NODE_ENV: "production" as const, SESSION_SECRET: secret || "" };
  const result = spawnSync(process.execPath, ["-e", worker], {
    input: JSON.stringify(input), encoding: "utf8", env, timeout: 10_000,
  });
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout);
}

test("a stable secret restores cookies across server restarts and configuration errors cannot masquerade as logout", () => {
  const encrypted = freshServer({ action: "encrypt" }, "fixture-stable-server-secret").value;
  expect(freshServer({ action: "decrypt", encrypted }, "fixture-stable-server-secret")).toEqual({ value: "fixture-token" });
  expect(freshServer({ action: "decrypt", encrypted }, "different-server-secret")).toEqual({ value: null });
  for (const action of ["encrypt", "decrypt"])
    expect(freshServer({ action, encrypted })).toEqual({ code: "SESSION_CONFIGURATION_REQUIRED", status: 503 });
});

test("missing production configuration blocks login and registration before contacting the supplier", async () => {
  const previousMode = process.env.NODE_ENV;
  const previousSecret = process.env.SESSION_SECRET;
  const originalFetch = globalThis.fetch;
  let supplierCalls = 0;
  Object.assign(process.env, { NODE_ENV: "production", SESSION_SECRET: "" });
  globalThis.fetch = async () => { supplierCalls++; throw new Error("Supplier must not be called"); };
  try {
    for (const handler of [login, register]) {
      const request = new NextRequest("https://workspace.example.test/api/account", {
        method: "POST",
        headers: { origin: "https://workspace.example.test", host: "workspace.example.test", "content-type": "application/json" },
        body: JSON.stringify({ email: "fixture@example.test", password: "fixture-password" }),
      });
      const response = await handler(request);
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ code: "SESSION_CONFIGURATION_REQUIRED" });
      expect(response.cookies.getAll()).toHaveLength(0);
    }
    expect(supplierCalls).toBe(0);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousMode === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Object.assign(process.env, { NODE_ENV: previousMode });
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
  }
});

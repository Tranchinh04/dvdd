import type { NextRequest, NextResponse } from "next/server";
import {
  ACCOUNT_COOKIE,
  CREDENTIAL_COOKIE,
  decryptToken,
  encryptToken,
  tokenFingerprint,
} from "./credentials";
import type { SupplierCookies } from "./account-provider";

// The supplier login currently issues a 30-day PHP session cookie.
export const ACCOUNT_SESSION_SECONDS = 60 * 60 * 24 * 30;

export function accountCookieOptions(
  request: NextRequest,
  maxAge = ACCOUNT_SESSION_SECONDS,
) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    path: "/api",
    maxAge,
    expires: new Date(maxAge > 0 ? Date.now() + maxAge * 1000 : 0),
    secure:
      request.nextUrl.protocol === "https:" ||
      request.headers.get("x-forwarded-proto") === "https",
  };
}

// Call only after the supplier has authenticated the user or accepted a read.
// Refresh both cookies together so the token cannot expire before the session.
export function persistAccountSession(
  response: NextResponse,
  request: NextRequest,
  cookies: SupplierCookies,
  apiKey: string,
) {
  const options = accountCookieOptions(request);
  response.cookies.set(CREDENTIAL_COOKIE, encryptToken(apiKey), options);
  response.cookies.set(
    ACCOUNT_COOKIE,
    encodeAccountSession(createAccountSession(cookies, apiKey)),
    options,
  );
  return response;
}

export type AccountSession = {
  purpose: "dvdd-account-v1";
  cookies: SupplierCookies;
  tokenHash: string;
  expiresAt: number;
};

export function createAccountSession(
  cookies: SupplierCookies,
  apiKey: string,
): AccountSession {
  return {
    purpose: "dvdd-account-v1",
    cookies,
    tokenHash: tokenFingerprint(apiKey),
    expiresAt: Date.now() + ACCOUNT_SESSION_SECONDS * 1000,
  };
}

export function encodeAccountSession(session: AccountSession) {
  return encryptToken(JSON.stringify(session));
}

export function decodeAccountSession(
  encrypted: string,
  apiKey: string | null,
): AccountSession | null {
  if (!apiKey) return null;
  try {
    const plaintext = decryptToken(encrypted);
    if (!plaintext) return null;
    const session: AccountSession = JSON.parse(plaintext);
    if (
      session.purpose !== "dvdd-account-v1" ||
      session.tokenHash !== tokenFingerprint(apiKey) ||
      !Number.isFinite(session.expiresAt) ||
      session.expiresAt <= Date.now() ||
      !session.cookies ||
      !/^[A-Za-z0-9,-]{1,256}$/.test(session.cookies.PHPSESSID || "")
    )
      return null;
    return session;
  } catch {
    return null;
  }
}

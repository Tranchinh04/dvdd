import { decryptToken, encryptToken, tokenFingerprint } from "./credentials";
import type { SupplierCookies } from "./account-provider";

export const ACCOUNT_SESSION_SECONDS = 60 * 60 * 24;

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

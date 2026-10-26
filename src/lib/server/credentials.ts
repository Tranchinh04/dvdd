import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { cookies } from "next/headers";
import type { Connection } from "@/lib/types";
import { ApiError } from "./http";

export const CREDENTIAL_COOKIE = "dvdd_connection";
export const ACCOUNT_COOKIE = "dvdd_account_session";

const shared = globalThis as typeof globalThis & { dvddSessionSecret?: string };
shared.dvddSessionSecret ??= randomBytes(32).toString("hex");

export function assertSessionConfiguration() {
  if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET?.trim())
    throw new ApiError(
      "Máy chủ chưa cấu hình SESSION_SECRET cố định. Hãy thiết lập biến này cho môi trường chạy ứng dụng rồi triển khai lại.",
      503,
      "SESSION_CONFIGURATION_REQUIRED",
    );
}

function secret() {
  assertSessionConfiguration();
  return createHash("sha256")
    .update(process.env.SESSION_SECRET || shared.dvddSessionSecret!)
    .digest();
}

export function encryptToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret(), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}

export function decryptToken(value: string): string | null {
  // A missing deployment key is a configuration error, not an expired login.
  const key = secret();
  try {
    const data = Buffer.from(value, "base64url");
    if (data.length < 29) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      data.subarray(0, 12),
    );
    decipher.setAuthTag(data.subarray(12, 28));
    return Buffer.concat([
      decipher.update(data.subarray(28)),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export function tokenFingerprint(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function describeConnection(
  token: string | null,
  source: Connection["source"],
): Connection {
  return {
    configured: Boolean(token),
    source,
    accountId: token
      ? createHash("sha256")
          .update("dvdd-order-storage-v1:")
          .update(token)
          .digest("hex")
          .slice(0, 24)
      : null,
  };
}

export async function getCredentials() {
  assertSessionConfiguration();
  const store = await cookies();
  const encrypted = store.get(CREDENTIAL_COOKIE)?.value;
  const sessionToken = encrypted ? decryptToken(encrypted) : null;
  const token = sessionToken || process.env.DVDD_API_KEY?.trim() || null;
  const connection = describeConnection(
    token,
    sessionToken ? "session" : token ? "environment" : null,
  );
  return { token, connection };
}

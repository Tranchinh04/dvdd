import { NextRequest, NextResponse } from "next/server";
import {
  ACCOUNT_COOKIE,
  CREDENTIAL_COOKIE,
  describeConnection,
  encryptToken,
  getCredentials,
} from "@/lib/server/credentials";
import { loginAccount, readAccount } from "@/lib/server/account-provider";
import {
  ACCOUNT_SESSION_SECONDS,
  createAccountSession,
  decodeAccountSession,
  encodeAccountSession,
} from "@/lib/server/account-session";
import {
  ApiError,
  assertSameOrigin,
  errorResponse,
  json,
  readBody,
} from "@/lib/server/http";

export const runtime = "nodejs";

function cookieOptions(request: NextRequest, maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    path: "/api",
    maxAge,
    secure:
      request.nextUrl.protocol === "https:" ||
      request.headers.get("x-forwarded-proto") === "https",
  };
}

function clearAccountCookie(response: NextResponse, request: NextRequest) {
  response.cookies.set(ACCOUNT_COOKIE, "", cookieOptions(request, 0));
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const encrypted = request.cookies.get(ACCOUNT_COOKIE)?.value;
    if (!encrypted) return json({ success: true, connected: false });
    const { token } = await getCredentials();
    const session = decodeAccountSession(encrypted, token);
    if (!session)
      throw new ApiError(
        "Phiên đăng nhập DVDD đã hết hạn hoặc API token đã đổi. Vui lòng đăng nhập lại.",
        401,
        "ACCOUNT_SESSION_EXPIRED",
      );
    const page = Number(request.nextUrl.searchParams.get("page") || "1");
    if (!Number.isInteger(page) || page < 1 || page > 1000)
      throw new ApiError("Trang giao dịch không hợp lệ.");
    const data = await readAccount(session.cookies, page);
    const response = json({ success: true, connected: true, data });
    response.cookies.set(
      ACCOUNT_COOKIE,
      encodeAccountSession(session),
      cookieOptions(
        request,
        Math.max(1, Math.floor((session.expiresAt - Date.now()) / 1000)),
      ),
    );
    return response;
  } catch (error) {
    const response = errorResponse(error);
    return error instanceof ApiError && error.code === "ACCOUNT_SESSION_EXPIRED"
      ? clearAccountCookie(response, request)
      : response;
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const { email, password } = await readBody(request);
    if (
      typeof email !== "string" ||
      email.trim().length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== "string" ||
      password.length < 1 ||
      password.length > 512
    )
      throw new ApiError("Vui lòng nhập email và mật khẩu DVDD hợp lệ.");
    // Password is only forwarded for this login; neither cookie contains it.
    const { jar, apiKey, data } = await loginAccount(email.trim(), password);
    const response = json({
      success: true,
      connected: true,
      data,
      connection: describeConnection(apiKey, "session"),
    });
    response.cookies.set(
      CREDENTIAL_COOKIE,
      encryptToken(apiKey),
      cookieOptions(request, 60 * 60 * 24 * 30),
    );
    response.cookies.set(
      ACCOUNT_COOKIE,
      encodeAccountSession(createAccountSession(jar, apiKey)),
      cookieOptions(request, ACCOUNT_SESSION_SECONDS),
    );
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const response = clearAccountCookie(json({ success: true }), request);
    response.cookies.set(CREDENTIAL_COOKIE, "", cookieOptions(request, 0));
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  ACCOUNT_COOKIE,
  CREDENTIAL_COOKIE,
  assertSessionConfiguration,
  describeConnection,
  getCredentials,
} from "@/lib/server/credentials";
import { loginAccount, readAccount } from "@/lib/server/account-provider";
import {
  accountCookieOptions,
  decodeAccountSession,
  persistAccountSession,
} from "@/lib/server/account-session";
import {
  ApiError,
  assertSameOrigin,
  errorResponse,
  json,
  readBody,
} from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;

function clearAccountCookie(response: NextResponse, request: NextRequest) {
  response.cookies.set(ACCOUNT_COOKIE, "", accountCookieOptions(request, 0));
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
    return persistAccountSession(response, request, session.cookies, token!);
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
    assertSessionConfiguration();
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
    return persistAccountSession(response, request, jar, apiKey);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const response = clearAccountCookie(json({ success: true }), request);
    response.cookies.set(CREDENTIAL_COOKIE, "", accountCookieOptions(request, 0));
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

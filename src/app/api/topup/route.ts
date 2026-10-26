import { NextRequest } from "next/server";
import { ACCOUNT_COOKIE, getCredentials } from "@/lib/server/credentials";
import {
  decodeAccountSession,
  encodeAccountSession,
} from "@/lib/server/account-session";
import { readTopup } from "@/lib/server/account-provider";
import { ApiError, errorResponse, json } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const options = {
    httpOnly: true,
    sameSite: "strict" as const,
    path: "/api",
    secure:
      request.nextUrl.protocol === "https:" ||
      request.headers.get("x-forwarded-proto") === "https",
  };
  try {
    const { token, connection } = await getCredentials();
    const session = decodeAccountSession(
      request.cookies.get(ACCOUNT_COOKIE)?.value || "",
      token,
    );
    if (!session)
      throw new ApiError(
        "Vui lòng đăng nhập tài khoản DVDD để lấy thông tin nạp tiền.",
        401,
        "ACCOUNT_SESSION_EXPIRED",
      );
    const data = await readTopup(session.cookies);
    const response = json({
      success: true,
      accountId: connection.accountId,
      data,
    });
    response.cookies.set(ACCOUNT_COOKIE, encodeAccountSession(session), {
      ...options,
      maxAge: Math.max(1, Math.floor((session.expiresAt - Date.now()) / 1000)),
    });
    return response;
  } catch (error) {
    const response = errorResponse(error);
    if (error instanceof ApiError && error.code === "ACCOUNT_SESSION_EXPIRED")
      response.cookies.set(ACCOUNT_COOKIE, "", { ...options, maxAge: 0 });
    return response;
  }
}

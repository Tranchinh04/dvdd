import { NextRequest } from "next/server";
import { ACCOUNT_COOKIE, getCredentials } from "@/lib/server/credentials";
import {
  decodeAccountSession,
  accountCookieOptions,
  persistAccountSession,
} from "@/lib/server/account-session";
import { readTopup } from "@/lib/server/account-provider";
import { ApiError, errorResponse, json } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const options = accountCookieOptions(request, 0);
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
    return persistAccountSession(response, request, session.cookies, token!);
  } catch (error) {
    const response = errorResponse(error);
    if (error instanceof ApiError && error.code === "ACCOUNT_SESSION_EXPIRED")
      response.cookies.set(ACCOUNT_COOKIE, "", { ...options, maxAge: 0 });
    return response;
  }
}

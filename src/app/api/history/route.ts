import { NextRequest } from "next/server";
import { ACCOUNT_COOKIE, getCredentials } from "@/lib/server/credentials";
import {
  decodeAccountSession,
  accountCookieOptions,
  persistAccountSession,
} from "@/lib/server/account-session";
import { readHistoryPage } from "@/lib/server/account-provider";
import { ApiError, errorResponse, json } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const options = accountCookieOptions(request, 0);
  try {
    const kind = request.nextUrl.searchParams.get("kind");
    const page = Number(request.nextUrl.searchParams.get("page") || "1");
    if (
      (kind !== "phones" && kind !== "transactions") ||
      !Number.isInteger(page) ||
      page < 1 ||
      page > 1000
    )
      throw new ApiError("Trang lịch sử không hợp lệ.");
    const { token } = await getCredentials();
    const session = decodeAccountSession(
      request.cookies.get(ACCOUNT_COOKIE)?.value || "",
      token,
    );
    if (!session)
      throw new ApiError(
        "Vui lòng đăng nhập DVDD để tải lịch sử tài khoản.",
        401,
        "ACCOUNT_SESSION_EXPIRED",
      );
    const data = await readHistoryPage(session.cookies, kind, page);
    const response = json({ success: true, data });
    return persistAccountSession(response, request, session.cookies, token!);
  } catch (error) {
    const response = errorResponse(error);
    if (error instanceof ApiError && error.code === "ACCOUNT_SESSION_EXPIRED")
      response.cookies.set(ACCOUNT_COOKIE, "", { ...options, maxAge: 0 });
    return response;
  }
}

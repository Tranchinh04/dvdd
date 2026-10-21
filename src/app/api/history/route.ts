import { NextRequest } from "next/server";
import { ACCOUNT_COOKIE, getCredentials } from "@/lib/server/credentials";
import {
  decodeAccountSession,
  encodeAccountSession,
} from "@/lib/server/account-session";
import { readHistoryPage } from "@/lib/server/account-provider";
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

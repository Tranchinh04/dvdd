import { NextRequest } from "next/server";
import {
  CREDENTIAL_COOKIE,
  ACCOUNT_COOKIE,
  encryptToken,
  getCredentials,
} from "@/lib/server/credentials";
import {
  ApiError,
  assertSameOrigin,
  errorResponse,
  json,
  readBody,
} from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    return json((await getCredentials()).connection);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const { apiKey } = await readBody(request);
    if (
      typeof apiKey !== "string" ||
      !apiKey.trim() ||
      apiKey.trim().length > 512 ||
      /\s/.test(apiKey.trim())
    ) {
      throw new ApiError(
        "Vui lòng nhập API token hợp lệ, không chứa khoảng trắng (tối đa 512 ký tự).",
      );
    }
    const response = json({ success: true });
    response.cookies.set(ACCOUNT_COOKIE, "", {
      httpOnly: true,
      sameSite: "strict",
      path: "/api",
      maxAge: 0,
    });
    response.cookies.set(CREDENTIAL_COOKIE, encryptToken(apiKey.trim()), {
      httpOnly: true,
      secure:
        request.nextUrl.protocol === "https:" ||
        request.headers.get("x-forwarded-proto") === "https",
      sameSite: "strict",
      path: "/api",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const response = json({ success: true });
    response.cookies.set(ACCOUNT_COOKIE, "", {
      httpOnly: true,
      sameSite: "strict",
      path: "/api",
      maxAge: 0,
    });
    response.cookies.set(CREDENTIAL_COOKIE, "", {
      httpOnly: true,
      path: "/api",
      maxAge: 0,
      sameSite: "strict",
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

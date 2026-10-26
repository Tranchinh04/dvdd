import { NextRequest } from "next/server";
import { registerAccount } from "@/lib/server/account-provider";
import { validateRegistration } from "@/lib/registration";
import {
  ACCOUNT_COOKIE,
  CREDENTIAL_COOKIE,
  assertSessionConfiguration,
  describeConnection,
} from "@/lib/server/credentials";
import {
  accountCookieOptions,
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

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    assertSessionConfiguration();
    const parsed = validateRegistration(await readBody(request));
    if (!parsed.data)
      throw new ApiError(parsed.error, 400, "REGISTRATION_INVALID_INPUT");
    const result = await registerAccount(parsed.data);
    const options = accountCookieOptions(request, 0);
    if (result.connected) {
      const response = json(
        {
          success: true,
          verified: true,
          connected: true,
          requiresToken: false,
          message: result.message,
          connection: describeConnection(result.apiKey, "session"),
          data: result.data,
        },
        201,
      );
      return persistAccountSession(response, request, result.jar, result.apiKey);
    }
    const response = json(
      {
        success: true,
        verified: true,
        connected: false,
        requiresToken: result.requiresToken,
        message: result.message,
        connection: describeConnection(null, null),
      },
      201,
    );
    response.cookies.set(CREDENTIAL_COOKIE, "", { ...options, maxAge: 0 });
    response.cookies.set(ACCOUNT_COOKIE, "", { ...options, maxAge: 0 });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

import { NextRequest } from "next/server";
import { getCredentials } from "@/lib/server/credentials";
import {
  ApiError,
  assertSameOrigin,
  errorResponse,
  json,
  readBody,
} from "@/lib/server/http";
import { callProvider } from "@/lib/server/provider";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const { orderCode } = await readBody(request);
    if (
      typeof orderCode !== "string" ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(orderCode)
    )
      throw new ApiError("Mã đơn hàng không hợp lệ.");
    const { token } = await getCredentials();
    if (!token)
      throw new ApiError(
        "Hãy cấu hình API token để kiểm tra OTP.",
        401,
        "NOT_CONFIGURED",
      );
    const result = await callProvider(token, "getOtp", orderCode);
    if (
      typeof result.otp !== "string" ||
      (result.otp !== "" && !/^\d{4,10}$/.test(result.otp))
    ) {
      throw new ApiError(
        "DVDD trả về OTP không hợp lệ.",
        502,
        "INVALID_RESPONSE",
      );
    }
    return json({ success: true, otp: result.otp });
  } catch (error) {
    return errorResponse(error);
  }
}

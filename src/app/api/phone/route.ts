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
import { SERVICES } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const { service } = await readBody(request);
    if (service !== "standard" && service !== "vnmb")
      throw new ApiError("Dịch vụ không hợp lệ.");
    const { token } = await getCredentials();
    if (!token)
      throw new ApiError(
        "Hãy cấu hình API token trước khi mua số.",
        401,
        "NOT_CONFIGURED",
      );
    const result = await callProvider(token, SERVICES[service].function);
    const data = result.data as Record<string, unknown> | undefined;
    if (
      !data ||
      typeof data.phone !== "string" ||
      !/^\+?\d{9,15}$/.test(data.phone) ||
      typeof data.orderCode !== "string" ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(data.orderCode)
    ) {
      throw new ApiError(
        "DVDD chưa trả đủ thông tin đơn. Hãy kiểm tra tài khoản DVDD trước khi mua lại.",
        502,
        "INVALID_RESPONSE",
      );
    }
    return json({
      success: true,
      data: { phone: data.phone, orderCode: data.orderCode },
      fee: typeof result.fee === "string" ? result.fee : null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

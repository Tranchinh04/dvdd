import { ApiError } from "./http";

const ENDPOINT = "https://api.dvdd-api.workers.dev";

function invalidResponse(status: number, func: string, message: string) {
  // Never log the URL, key, cookies or upstream body.
  console.warn("[DVDD API] Invalid upstream response", { func, status });
  return new ApiError(
    status === 403
      ? "DVDD từ chối truy cập API từ máy chủ ứng dụng (HTTP 403). Cần liên hệ DVDD để kiểm tra quyền truy cập máy chủ."
      : `${message} (HTTP ${status})`,
    502,
    status === 403 ? "PROVIDER_ACCESS_DENIED" : "INVALID_RESPONSE",
  );
}

export async function callProvider(
  token: string,
  func: string,
  orderCode?: string,
): Promise<Record<string, unknown>> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("apiKey", token);
  url.searchParams.set("func", func);
  if (orderCode) url.searchParams.set("orderCode", orderCode);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new ApiError(
      func === "getOtp"
        ? "Không thể kết nối DVDD. Bạn có thể kiểm tra OTP lại sau."
        : "Chưa xác định được kết quả mua số. Hãy kiểm tra đơn trên DVDD trước khi mua lại để tránh trừ phí hai lần.",
      504,
      "UPSTREAM_UNAVAILABLE",
    );
  }

  let result: Record<string, unknown>;
  try {
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      throw new Error();
    result = payload as Record<string, unknown>;
  } catch {
    throw invalidResponse(
      response.status,
      func,
      "DVDD trả về dữ liệu không hợp lệ. Hãy kiểm tra tài khoản DVDD trước khi thử mua lại.",
    );
  }
  // The documented errors use false; the live worker also returns numeric 0
  // for invalid credentials. Only the explicit boolean true confirms success.
  if (result.success === false || result.success === 0) {
    let message =
      typeof result.message === "string"
        ? result.message.slice(0, 500)
        : "DVDD không thể xử lý yêu cầu.";
    message = message.replaceAll(token, "[đã ẩn]");
    const expired = /hết hạn|het han|expired/i.test(message);
    throw new ApiError(
      message,
      expired ? 410 : 422,
      expired ? "ORDER_EXPIRED" : "PROVIDER_ERROR",
    );
  }
  if (!response.ok || result.success !== true) {
    throw invalidResponse(
      response.status,
      func,
      "DVDD chưa xác nhận yêu cầu thành công. Hãy kiểm tra tài khoản trước khi thử lại.",
    );
  }
  return result;
}

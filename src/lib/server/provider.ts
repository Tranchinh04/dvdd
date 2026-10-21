import { ApiError } from "./http";

const ENDPOINT = "https://api.dvdd-api.workers.dev";

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
    throw new ApiError(
      "DVDD trả về dữ liệu không hợp lệ. Hãy kiểm tra tài khoản DVDD trước khi thử mua lại.",
      502,
      "INVALID_RESPONSE",
    );
  }
  if (result.success === false) {
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
    throw new ApiError(
      "DVDD chưa xác nhận yêu cầu thành công. Hãy kiểm tra tài khoản trước khi thử lại.",
      502,
      "INVALID_RESPONSE",
    );
  }
  return result;
}

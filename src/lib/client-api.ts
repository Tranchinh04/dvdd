export class ClientError extends Error {
  constructor(
    message: string,
    public code = "REQUEST_FAILED",
  ) {
    super(message);
  }
}

export async function postApi<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(
        ["/api/account", "/api/register"].includes(path) ? 60_000 : 25_000,
      ),
    });
  } catch {
    throw new ClientError(
      path === "/api/register"
        ? "Chưa xác định được kết quả đăng ký. Hãy thử đăng nhập bằng email vừa nhập trước khi đăng ký lại."
        : path === "/api/phone"
          ? "Chưa xác định được kết quả mua số. Hãy kiểm tra tài khoản DVDD trước khi mua lại để tránh trừ phí hai lần."
          : "Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.",
      path === "/api/register"
        ? "REGISTRATION_OUTCOME_UNKNOWN"
        : "NETWORK_ERROR",
    );
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new ClientError(
      path === "/api/register"
        ? "Chưa xác định được kết quả đăng ký. Hãy thử đăng nhập trước khi đăng ký lại."
        : "Không đọc được phản hồi. Hãy kiểm tra tài khoản DVDD trước khi thực hiện lại.",
      path === "/api/register"
        ? "REGISTRATION_OUTCOME_UNKNOWN"
        : "REQUEST_FAILED",
    );
  }
  if (
    path === "/api/register" &&
    (!result || typeof result !== "object" || Array.isArray(result))
  )
    throw new ClientError(
      "Chưa xác định được kết quả đăng ký. Hãy thử đăng nhập trước khi đăng ký lại.",
      "REGISTRATION_OUTCOME_UNKNOWN",
    );
  if (!response.ok || result.success === false)
    throw new ClientError(
      result.message || "Không thể thực hiện yêu cầu.",
      result.code,
    );
  return result as T;
}

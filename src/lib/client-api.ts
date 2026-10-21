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
      signal: AbortSignal.timeout(path === "/api/account" ? 60_000 : 25_000),
    });
  } catch {
    throw new ClientError(
      path === "/api/phone"
        ? "Chưa xác định được kết quả mua số. Hãy kiểm tra tài khoản DVDD trước khi mua lại để tránh trừ phí hai lần."
        : "Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.",
      "NETWORK_ERROR",
    );
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new ClientError(
      "Không đọc được phản hồi. Hãy kiểm tra tài khoản DVDD trước khi thực hiện lại.",
    );
  }
  if (!response.ok || result.success === false)
    throw new ClientError(
      result.message || "Không thể thực hiện yêu cầu.",
      result.code,
    );
  return result as T;
}

import { NextRequest, NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "REQUEST_FAILED",
  ) {
    super(message);
  }
}

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  let validOrigin = false;
  try {
    const url = new URL(origin || "");
    // Next's internal URL may use the listening address (0.0.0.0).
    // Host is the browser-visible authority; browsers cannot override this header.
    validOrigin =
      ["http:", "https:"].includes(url.protocol) &&
      url.host === request.headers.get("host");
  } catch {
    /* Reject malformed or absent origins. */
  }
  if (!validOrigin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ApiError(
      "Yêu cầu không hợp lệ. Hãy thao tác từ giao diện ứng dụng.",
      403,
      "FORBIDDEN",
    );
  }
}

export async function readBody(
  request: NextRequest,
): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new ApiError("Nội dung yêu cầu phải là JSON.", 415);
  }
  const raw = await request.text();
  if (raw.length > 4096) throw new ApiError("Nội dung yêu cầu quá dài.", 413);
  try {
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new ApiError("Dữ liệu gửi lên không hợp lệ.");
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError)
    return json(
      { success: false, message: error.message, code: error.code },
      error.status,
    );
  return json(
    {
      success: false,
      message: "Không thể xử lý yêu cầu. Vui lòng thử lại sau.",
      code: "INTERNAL_ERROR",
    },
    500,
  );
}

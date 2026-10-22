import { load, type CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import type {
  DvddAccount,
  DvddPhoneOrder,
  DvddProfile,
  DvddTransaction,
  HistoryPage,
} from "../types";
import { parseFee } from "../types";
import { ApiError } from "./http";

// This connector reads the authenticated supplier website. It does not call
// undocumented worker functions or execute the website's scripts/forms.
const ORIGIN = "https://dvdd.casa";
const MAX_DOCUMENT_BYTES = 2_000_000;
const AGENT = "DVDD-Workspace/1.0";
export type SupplierCookies = Record<string, string>;

function text($: CheerioAPI, node: AnyNode | undefined) {
  if (!node) return "";
  const copy = $(node).clone();
  copy.find("script,style,button,audio,form").remove();
  copy.find("br").replaceWith(" · ");
  return copy
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:·\s*)+|(?:\s*·)+$/g, "")
    .trim()
    .slice(0, 1000);
}

function sessionExpired(): never {
  throw new ApiError(
    "Phiên đăng nhập DVDD đã hết hạn. Vui lòng đăng nhập lại.",
    401,
    "ACCOUNT_SESSION_EXPIRED",
  );
}

function layoutChanged(section: string): never {
  throw new ApiError(
    `Chưa đọc được ${section} từ DVDD. Cấu trúc trang của nhà cung cấp có thể đã thay đổi.`,
    502,
    "ACCOUNT_LAYOUT_CHANGED",
  );
}

function updateCookies(jar: SupplierCookies, headers: Headers) {
  for (const header of headers.getSetCookie()) {
    const [pair, ...attributes] = header.split(";");
    const index = pair.indexOf("=");
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    // Only the session cookie observed on the supplier login is needed.
    if (name !== "PHPSESSID" || !/^[A-Za-z0-9,-]{1,256}$/.test(value)) continue;
    if (attributes.some((a) => /^\s*max-age=0\s*$/i.test(a))) delete jar[name];
    else jar[name] = value;
  }
}

async function document(
  path: string,
  jar: SupplierCookies,
  body?: URLSearchParams,
) {
  // Fixed operation names are safe to log; never log the request body, cookies
  // or supplier response, which can contain credentials and account data.
  const operation =
    path === "/login.php"
      ? body
        ? "login-submit"
        : "login-form"
      : new URL(path, ORIGIN).searchParams.get("page") || "account";
  let response: Response;
  try {
    response = await fetch(ORIGIN + path, {
      method: body ? "POST" : "GET",
      headers: {
        Accept: "text/html",
        "User-Agent": AGENT,
        ...(jar.PHPSESSID ? { Cookie: `PHPSESSID=${jar.PHPSESSID}` } : {}),
        ...(body
          ? {
              "Content-Type": "application/x-www-form-urlencoded",
              Origin: ORIGIN,
              Referer: ORIGIN + "/login.php",
            }
          : {}),
      },
      body: body?.toString(),
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ApiError(
      "Không kết nối được trang tài khoản DVDD. Vui lòng thử lại.",
      502,
      "ACCOUNT_NETWORK_ERROR",
    );
  }
  updateCookies(jar, response.headers);
  // Never follow an upstream redirect with session cookies.
  if (response.status >= 300 && response.status < 400) {
    if (body) return "";
    sessionExpired();
  }
  if (!response.ok) {
    console.warn("[DVDD account] Upstream request failed", {
      operation,
      status: response.status,
    });
    if (response.status === 403)
      throw new ApiError(
        `DVDD từ chối kết nối từ máy chủ ứng dụng (HTTP 403, ${operation}). Cần kiểm tra quyền truy cập máy chủ với DVDD.`,
        502,
        "ACCOUNT_ACCESS_DENIED",
      );
    if (response.status === 429)
      throw new ApiError(
        "DVDD đang giới hạn số lần truy cập (HTTP 429). Vui lòng chờ rồi thử lại.",
        503,
        "ACCOUNT_RATE_LIMITED",
      );
    throw new ApiError(
      `Trang tài khoản DVDD tạm thời không khả dụng (HTTP ${response.status}, ${operation}).`,
      502,
      "ACCOUNT_UNAVAILABLE",
    );
  }
  if (Number(response.headers.get("content-length")) > MAX_DOCUMENT_BYTES)
    layoutChanged("trang tài khoản");
  const reader = response.body?.getReader();
  if (!reader) layoutChanged("trang tài khoản");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_DOCUMENT_BYTES) {
        await reader.cancel();
        layoutChanged("trang tài khoản");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "Chưa tải xong dữ liệu tài khoản DVDD. Vui lòng thử lại.",
      502,
      "ACCOUNT_NETWORK_ERROR",
    );
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function parseProfile(html: string): DvddProfile {
  const $ = load(html);
  const value = (name: string) =>
    String($(`input[name="${name}"]`).first().val() || "").trim();
  const email = value("emailAddress");
  if (!email) sessionExpired();
  const balanceText = $("a[href]")
    .toArray()
    .filter((node) => {
      try {
        const url = new URL($(node).attr("href")!, ORIGIN + "/dashboard");
        return (
          url.origin === ORIGIN &&
          url.searchParams.get("page") === "transactions-add"
        );
      } catch {
        return false;
      }
    })
    .map((node) => text($, node))
    .find((value) => /^[\d.,\s]+[đ₫]$/.test(value));
  return {
    name: value("firstName"),
    email,
    phone: value("mobileNumber"),
    balance: balanceText ? parseFee(balanceText) : null,
  };
}

function tableWithHeaders($: CheerioAPI, expected: string[]) {
  return $("table")
    .toArray()
    .find((table) => {
      const headers = $(table)
        .find("thead th")
        .toArray()
        .map((node) => text($, node));
      return (
        expected.length === headers.length &&
        expected.every((label, i) => label === headers[i])
      );
    });
}

export function parsePhoneHistory(html: string): DvddPhoneOrder[] {
  const $ = load(html);
  const table = tableWithHeaders($, [
    "Mã đơn",
    "Dịch vụ",
    "Trạng thái",
    "Số điện thoại",
    "Kết quả",
    "Nhắc lại",
    "Thời gian",
    "Phí",
  ]);
  if (!table) layoutChanged("lịch sử thuê số");
  return $(table)
    .find("tbody > tr")
    .toArray()
    .flatMap((row) => {
      const cells = $(row).children("td").toArray();
      if (cells.length !== 8) return [];
      const values = cells.map((cell) => text($, cell));
      if (!values[0]) return [];
      return [
        {
          orderCode: values[0],
          service: values[1],
          status: values[2],
          phone: values[3],
          result: values[4],
          time: values[6],
          fee: values[7],
          feeAmount: parseFee(values[7]),
        },
      ];
    });
}

export function parseTransactions(html: string) {
  const $ = load(html);
  const table = tableWithHeaders($, [
    "Mã giao dịch",
    "Số tiền (đ)",
    "Số dư cuối (đ)",
    "Mô tả",
    "Mã đơn hàng",
    "Thời gian",
  ]);
  if (!table) layoutChanged("lịch sử giao dịch");
  const rows: DvddTransaction[] = $(table)
    .find("tbody > tr")
    .toArray()
    .flatMap((row) => {
      const cells = $(row).children("td").toArray();
      if (cells.length !== 6) return [];
      const values = cells.map((cell) => text($, cell));
      return [
        {
          code: values[0],
          amount: values[1],
          balanceAfter: values[2],
          description: values[3],
          orderCode: values[4],
          time: values[5],
        },
      ];
    });
  return { rows, pages: historyPages(html, "transactions") };
}

export function historyPages(
  html: string,
  section: "transactions" | "order-phone",
) {
  const $ = load(html);
  const pages = $(".pagination a[href]")
    .toArray()
    .map((node) => {
      try {
        const url = new URL($(node).attr("href")!, ORIGIN + "/dashboard");
        if (url.origin !== ORIGIN || url.searchParams.get("page") !== section)
          return 1;
        const page = Number(url.searchParams.get("paging"));
        return Number.isInteger(page) && page >= 1 && page <= 1000 ? page : 1;
      } catch {
        return 1;
      }
    });
  return Math.max(1, ...pages);
}

export async function readHistoryPage(
  jar: SupplierCookies,
  kind: HistoryPage["kind"],
  page: number,
): Promise<HistoryPage> {
  if (!Number.isInteger(page) || page < 1 || page > 1000)
    throw new ApiError("Trang lịch sử không hợp lệ.");
  if (kind === "transactions") {
    const data = parseTransactions(
      await document(`/dashboard?page=transactions&paging=${page}`, jar),
    );
    return { kind, page, ...data };
  }
  if (kind !== "phones") throw new ApiError("Loại lịch sử không hợp lệ.");
  const html = await document(
    `/dashboard?page=order-phone&paging=${page}`,
    jar,
  );
  return {
    kind,
    page,
    rows: parsePhoneHistory(html),
    pages: historyPages(html, "order-phone"),
  };
}

export async function readAccount(
  jar: SupplierCookies,
  page = 1,
): Promise<DvddAccount> {
  const [profileResult, ordersResult, transactionsResult] =
    await Promise.allSettled([
      document("/dashboard?page=admin-profile-form", jar).then(parseProfile),
      document("/dashboard?page=order-phone", jar).then((html) => ({
        rows: parsePhoneHistory(html),
        pages: historyPages(html, "order-phone"),
      })),
      document(`/dashboard?page=transactions&paging=${page}`, jar).then(
        parseTransactions,
      ),
    ]);
  if (profileResult.status === "rejected") throw profileResult.reason;
  const warnings: string[] = [];
  if (profileResult.value.balance === null)
    warnings.push(
      "DVDD chưa trả được số dư. Không thể xác định số dư hiện tại.",
    );
  if (ordersResult.status === "rejected")
    warnings.push("Chưa đọc được lịch sử thuê số từ DVDD. Hãy thử làm mới.");
  if (transactionsResult.status === "rejected")
    warnings.push("Chưa đọc được lịch sử giao dịch từ DVDD. Hãy thử làm mới.");
  return {
    profile: profileResult.value,
    orders:
      ordersResult.status === "fulfilled" ? ordersResult.value.rows : null,
    phonePages:
      ordersResult.status === "fulfilled" ? ordersResult.value.pages : 1,
    transactions:
      transactionsResult.status === "fulfilled"
        ? transactionsResult.value.rows
        : null,
    transactionPage: page,
    transactionPages:
      transactionsResult.status === "fulfilled"
        ? Math.max(page, transactionsResult.value.pages)
        : page,
    warnings,
    updatedAt: new Date().toISOString(),
  };
}

export async function loginAccount(email: string, password: string) {
  const jar: SupplierCookies = {};
  const loginHtml = await document("/login.php", jar);
  const $ = load(loginHtml);
  if (
    !$('input[name="emailAddress"]').length ||
    !$('input[name="pass"]').length
  )
    layoutChanged("biểu mẫu đăng nhập");
  const body = new URLSearchParams({
    sessionKey: String($('input[name="sessionKey"]').first().val() || ""),
    redirect: "",
    initData: "",
    emailAddress: email,
    pass: password,
    login: "",
  });
  await document("/login.php", jar, body);
  let profile: DvddProfile;
  try {
    profile = parseProfile(
      await document("/dashboard?page=admin-profile-form", jar),
    );
  } catch (error) {
    if (error instanceof ApiError && error.code === "ACCOUNT_SESSION_EXPIRED")
      throw new ApiError(
        "Đăng nhập DVDD chưa thành công. Kiểm tra email và mật khẩu của tài khoản DVDD.",
        401,
        "ACCOUNT_LOGIN_FAILED",
      );
    throw error;
  }
  if (profile.email.toLowerCase() !== email.toLowerCase())
    throw new ApiError(
      "Tài khoản DVDD trả về không khớp email đăng nhập.",
      502,
      "ACCOUNT_IDENTITY_MISMATCH",
    );
  const apiHtml = await document("/dashboard?page=api", jar);
  const apiKey = String(
    load(apiHtml)('input[name="token"]#token').val() || "",
  ).trim();
  if (!apiKey || apiKey.length > 512 || /\s/.test(apiKey))
    throw new ApiError(
      "Tài khoản chưa có API token. Vào mục API trong DVDD, tạo token rồi đăng nhập lại tại đây.",
      422,
      "ACCOUNT_TOKEN_MISSING",
    );
  const data = await readAccount(jar);
  return { jar, apiKey, data };
}

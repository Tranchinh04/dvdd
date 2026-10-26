import { load } from "cheerio";
import QRCode from "qrcode";
import type { DvddTopup } from "../types";
import { ApiError } from "./http";

function invalid(): never {
  throw new ApiError(
    "Chưa xác minh được thông tin nạp tiền và QR từ DVDD. Vui lòng tải lại; chưa chuyển khoản theo thông tin cũ.",
    502,
    "TOPUP_DETAILS_INVALID",
  );
}

// The supplier's observed VietQR is ASCII EMV TLV. Reject ambiguous lengths,
// duplicate fields and unexpected formats instead of repairing payment data.
function fields(value: string) {
  const result = new Map<string, string>();
  for (let i = 0; i < value.length; ) {
    const tag = value.slice(i, i + 2);
    const lengthText = value.slice(i + 2, i + 4);
    const length = Number(lengthText);
    if (
      !/^\d{2}$/.test(tag) ||
      !/^\d{2}$/.test(lengthText) ||
      length < 1 ||
      i + 4 + length > value.length ||
      result.has(tag)
    )
      invalid();
    result.set(tag, value.slice(i + 4, i + 4 + length));
    i += 4 + length;
  }
  return result;
}

function crc16(value: string) {
  let crc = 0xffff;
  for (const byte of Buffer.from(value, "ascii")) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function parseTopup(html: string) {
  const $ = load(html);
  if ($('input[name="emailAddress"], input[name="pass"]').length)
    throw new ApiError(
      "Phiên đăng nhập DVDD đã hết hạn. Vui lòng đăng nhập lại để nạp tiền.",
      401,
      "ACCOUNT_SESSION_EXPIRED",
    );
  const headings = $("h1,h2,h3,h4,h5,h6")
    .toArray()
    .map((node) => {
      const copy = $(node).clone();
      copy.find("button,script,style").remove();
      return copy.text().replace(/\s+/g, " ").trim();
    });
  const banks = headings.filter((line) => /^TK Ngân hàng\s*:/i.test(line));
  const references = headings.filter((line) => /^Nội dung CK\s*:/i.test(line));
  if (banks.length !== 1 || references.length !== 1) invalid();
  const bank = banks[0].match(
    /^TK Ngân hàng\s*:\s*(.+?)\s*-\s*(\d+)\s*-\s*(.+)$/i,
  );
  const reference = references[0].replace(/^Nội dung CK\s*:\s*/i, "").trim();
  if (!bank || !/^[A-Za-z0-9 ]{1,99}$/.test(reference)) invalid();
  const [, accountName, accountNumber, bankName] = bank;
  if (!/\bMB\s*Bank\b/i.test(bankName) || !/^\d{6,25}$/.test(accountNumber))
    invalid();
  const body = $("body").clone();
  body.find("script,style,nav,aside,header").remove();
  const noticeText = body.text().replace(/\s+/g, " ");
  const minimum = noticeText.match(
    /nạp tối thiểu\s+([\d.,]+)\s*(K|đ|₫|VND)(?=\s|[-–]|$)/i,
  );
  const delay = noticeText.match(
    /Nạp tiền có thể vào ngay hoặc chậm\s+\d+\s*[-–]\s*\d+\s*phút/i,
  );
  if (!minimum || !delay) invalid();
  const thousands = /^K$/i.test(minimum[2]);
  if (
    !(
      thousands ? /^\d+(?:[.,]\d{1,3})?$/ : /^(?:\d+|\d{1,3}(?:[.,]\d{3})+)$/
    ).test(minimum[1])
  )
    invalid();
  const minimumAmount = thousands
    ? Number(minimum[1].replace(",", ".")) * 1000
    : Number(minimum[1].replace(/[.,]/g, ""));
  if (!Number.isSafeInteger(minimumAmount) || minimumAmount <= 0) invalid();
  if ($("img#currentPhoto").length !== 1) invalid();
  let source: URL;
  try {
    source = new URL($("img#currentPhoto").attr("src") || "");
  } catch {
    invalid();
  }
  if (
    source.origin !== "https://quickchart.io" ||
    source.pathname !== "/qr" ||
    source.username ||
    source.password ||
    source.searchParams.getAll("text").length !== 1
  )
    invalid();
  const qrPayload = source.searchParams.get("text") || "";
  if (
    !/^[\x20-\x7e]{50,1024}$/.test(qrPayload) ||
    !/6304[A-F0-9]{4}$/.test(qrPayload)
  )
    invalid();
  if (crc16(qrPayload.slice(0, -4)) !== qrPayload.slice(-4)) invalid();
  const qr = fields(qrPayload);
  const merchant = fields(qr.get("38") || "");
  const beneficiary = fields(merchant.get("01") || "");
  const additional = fields(qr.get("62") || "");
  if (
    qr.get("00") !== "01" ||
    !["11", "12"].includes(qr.get("01") || "") ||
    qr.get("53") !== "704" ||
    qr.get("58") !== "VN" ||
    qr.has("54") ||
    qr.get("59") !== accountName ||
    merchant.get("00") !== "A000000727" ||
    merchant.get("02") !== "QRIBFTTA" ||
    beneficiary.get("00") !== "970422" ||
    beneficiary.get("01") !== accountNumber ||
    additional.get("08") !== reference
  )
    invalid();
  return {
    bankName,
    accountName,
    accountNumber,
    reference,
    minimumAmount,
    processingNotice: delay[0],
    qrPayload,
  };
}

export async function topupDetails(html: string): Promise<DvddTopup> {
  const { qrPayload, ...data } = parseTopup(html);
  // Render the exact verified supplier payload locally. No requests to a QR
  // image service and no edits to its beneficiary, reference or amount.
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: "M",
    width: 360,
    margin: 4,
  });
  return { ...data, qrDataUrl, updatedAt: new Date().toISOString() };
}

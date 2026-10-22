import {
  type DvddPhoneOrder,
  type DvddTransaction,
  type HistoryOrder,
  type HistoryStatus,
  type Order,
  type OrderCheck,
  type ServiceId,
  SERVICES,
  money,
  parseFee,
} from "./types";

// Supplier timestamps use Vietnam time. A day/month without a year is
// deliberately left unknown until a matching dated ledger entry is found.
export function supplierDate(value: string): string | null {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/,
  );
  if (!match) return null;
  const [, y, m, d, h, min, sec] = match;
  const local = `${y}-${m}-${d}T${h}:${min}:${sec}`;
  const date = new Date(local + "+07:00");
  if (!Number.isFinite(+date)) return null;
  // Date.parse normalizes impossible days, so also verify the components.
  if (new Date(+date + 7 * 3600_000).toISOString().slice(0, 19) !== local)
    return null;
  return date.toISOString();
}

export function rentalCharge(transaction: DvddTransaction) {
  const match = transaction.description.match(
    /^Trừ ví đơn hàng\s+([A-Za-z0-9_-]{1,100})\s+phí thuê số(?:\s+(VNMB))?\s*$/i,
  );
  if (!match) return null;
  // Do not turn top-ups, account purchases, OTP lookups or other debits into rentals.
  if (transaction.orderCode && transaction.orderCode !== match[1]) return null;
  return {
    orderCode: match[1],
    service: (match[2] ? "vnmb" : "standard") as ServiceId,
    amount: parseFee(transaction.amount),
  };
}

function remoteStatus(order: DvddPhoneOrder): HistoryStatus {
  if (
    /^\d{4,8}$/.test(order.result) ||
    /đã xong|hoàn thành|đã nhận otp/i.test(order.status)
  )
    return "received";
  if (/hết hạn|đặt lỗi|thất bại|đã hủy/i.test(order.status)) return "expired";
  if (/đang chờ|chờ otp|đang xử lý|^\s*đang\s+đặt\s*$/i.test(order.status))
    return "waiting";
  return "unknown";
}

export function mergeHistory(
  local: Order[],
  phones: DvddPhoneOrder[],
  transactions: DvddTransaction[],
  checks: Readonly<Record<string, OrderCheck>> = {},
): HistoryOrder[] {
  const rows = new Map<string, HistoryOrder>();
  for (const order of local) {
    rows.set(order.orderCode, {
      ...order,
      createdAt: order.imported ? null : order.createdAt,
      serviceLabel: SERVICES[order.service].shortName,
      timeLabel: order.imported ? "Chưa rõ thời điểm mua" : "",
      fromProvider: false,
      trackingOrder: order,
    });
  }
  const dates = new Map<string, string>();
  const refunds = new Map<string, number | null>();
  const seenTransactions = new Set<string>();
  for (const tx of transactions) {
    if (tx.code && seenTransactions.has(tx.code)) continue;
    if (tx.code) seenTransactions.add(tx.code);
    const match = tx.description.match(
      /^Hoàn ví không nhận được OTP\s+([A-Za-z0-9_-]{1,100})\s*$/i,
    );
    const amount = parseFee(tx.amount);
    if (match) {
      const previous = refunds.get(match[1]);
      refunds.set(
        match[1],
        amount === null || previous === null ? null : (previous || 0) + amount,
      );
    }
  }
  // A rental has one charge. Deduplicate repeated pages/transactions by order code;
  // the earliest dated charge identifies the purchase time, not a later refund.
  const charges = transactions
    .flatMap((tx) => {
      const charge = rentalCharge(tx);
      return charge ? [{ tx, charge, date: supplierDate(tx.time) }] : [];
    })
    .sort((a, b) => (a.date || "z").localeCompare(b.date || "z"));
  for (const { tx, charge, date } of charges) {
    if (date && !dates.has(charge.orderCode)) dates.set(charge.orderCode, date);
    const existing = rows.get(charge.orderCode);
    if (existing?.fromProvider) continue;
    const refund = refunds.has(charge.orderCode)
      ? refunds.get(charge.orderCode)!
      : 0;
    const net =
      charge.amount !== null && refund !== null && charge.amount >= refund
        ? charge.amount - refund
        : null;
    rows.set(charge.orderCode, {
      id: existing?.id || `dvdd-${charge.orderCode}`,
      orderCode: charge.orderCode,
      phone: existing?.phone || "",
      service: charge.service,
      serviceLabel: SERVICES[charge.service].shortName,
      fee: net === null ? "Chưa rõ phí" : money(net),
      feeAmount: net,
      createdAt: date || existing?.createdAt || null,
      timeLabel: tx.time,
      status: refunds.has(charge.orderCode)
        ? "expired"
        : existing?.status || "unknown",
      otp: existing?.otp || "",
      fromProvider: true,
      ledgerOnly: true,
      trackingOrder: existing?.trackingOrder,
      lastCheckedAt: existing?.lastCheckedAt,
      lastError: existing?.lastError,
    });
  }
  // Some supplier versions populate the dedicated order-code column.
  for (const tx of transactions) {
    const date = supplierDate(tx.time);
    if (tx.orderCode && date && !dates.has(tx.orderCode))
      dates.set(tx.orderCode, date);
  }
  for (const order of phones) {
    const existing = rows.get(order.orderCode);
    const service = /vnmb|vietnamobile/i.test(order.service)
      ? "vnmb"
      : existing?.service || null;
    const status = remoteStatus(order);
    // Confirmed OTPs/refunds may precede the supplier phone-page refresh.
    const resolvedStatus =
      (status === "waiting" || status === "unknown") &&
      existing &&
      (existing.status === "received" || existing.status === "expired")
        ? existing.status
        : status === "unknown" && existing?.trackingOrder?.status === "waiting"
          ? "waiting"
          : status;
    rows.set(order.orderCode, {
      id: existing?.id || `dvdd-${order.orderCode}`,
      orderCode: order.orderCode,
      phone: order.phone || existing?.phone || "",
      service,
      serviceLabel: service
        ? SERVICES[service].shortName
        : order.service.replace(/\s*-\s*$/, "") || "Thuê số DVDD",
      fee:
        order.feeAmount === null && existing?.feeAmount != null
          ? existing.fee
          : order.fee || "Chưa rõ phí",
      feeAmount: order.feeAmount ?? existing?.feeAmount ?? null,
      createdAt:
        dates.get(order.orderCode) ||
        supplierDate(order.time) ||
        existing?.createdAt ||
        null,
      timeLabel: order.time,
      status: resolvedStatus,
      statusLabel:
        resolvedStatus === "unknown"
          ? order.status || "Chưa rõ trạng thái"
          : undefined,
      otp: /^\d{4,8}$/.test(order.result)
        ? order.result
        : resolvedStatus !== "expired"
          ? existing?.otp || ""
          : "",
      fromProvider: true,
      trackingOrder: existing?.trackingOrder,
      lastCheckedAt: existing?.lastCheckedAt,
      lastError: existing?.lastError,
    });
  }
  return [...rows.values()]
    .map((row) => {
      const check = checks[row.orderCode];
      if (!row.fromProvider || !check) return row;
      const status = check.otp
        ? "received"
        : row.status === "received" || row.status === "expired"
          ? row.status
          : check.status;
      return {
        ...row,
        status,
        otp: check.otp || row.otp,
        statusLabel: undefined,
        lastCheckedAt: check.lastCheckedAt,
        lastError: status === "waiting" ? check.lastError : undefined,
      };
    })
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export type HistoryPeriod = "all" | "7" | "30";
const DAY = 86400_000;
const VIETNAM = 7 * 3600_000;
const today = (now: number) =>
  Math.floor((now + VIETNAM) / DAY) * DAY - VIETNAM;

export function historyInPeriod(
  orders: HistoryOrder[],
  period: HistoryPeriod,
  now = Date.now(),
) {
  if (period === "all") return orders;
  const from = today(now) - (Number(period) - 1) * DAY;
  return orders.filter(
    (order) =>
      order.createdAt !== null &&
      Date.parse(order.createdAt) >= from &&
      Date.parse(order.createdAt) < today(now) + DAY,
  );
}

export function historyBuckets(
  orders: HistoryOrder[],
  period: HistoryPeriod,
  now = Date.now(),
) {
  const dated = orders.filter((order) => order.createdAt !== null);
  const end = today(now) + DAY;
  const first = dated.reduce(
    (min, order) => Math.min(min, Date.parse(order.createdAt!)),
    today(now) - 6 * DAY,
  );
  const start = period === "all" ? today(first) : end - Number(period) * DAY;
  const days = Math.ceil((end - start) / DAY);
  const monthly = days > 56;
  const firstDate = new Date(start + VIETNAM);
  const endDate = new Date(end - 1 + VIETNAM);
  const months =
    (endDate.getUTCFullYear() - firstDate.getUTCFullYear()) * 12 +
    endDate.getUTCMonth() -
    firstDate.getUTCMonth() +
    1;
  const stride = Math.ceil((monthly ? months : days) / 7);
  const count = Math.ceil((monthly ? months : days) / stride);
  return Array.from({ length: count }, (_, index) => {
    const from = monthly
      ? Date.UTC(
          firstDate.getUTCFullYear(),
          firstDate.getUTCMonth() + index * stride,
          1,
        ) - VIETNAM
      : start + index * stride * DAY;
    const to = monthly
      ? Date.UTC(
          firstDate.getUTCFullYear(),
          firstDate.getUTCMonth() + (index + 1) * stride,
          1,
        ) - VIETNAM
      : Math.min(end, from + stride * DAY);
    const items = dated.filter(
      (order) =>
        Date.parse(order.createdAt!) >= from &&
        Date.parse(order.createdAt!) < to,
    );
    return {
      from,
      to,
      label: monthly
        ? `${String(new Date(from + VIETNAM).getUTCMonth() + 1).padStart(2, "0")}/${String(new Date(from + VIETNAM).getUTCFullYear()).slice(-2)}`
        : new Date(from).toLocaleDateString("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
            day: "2-digit",
            month: "2-digit",
          }),
      count: items.length,
      received: items.filter((order) => order.status === "received").length,
    };
  });
}

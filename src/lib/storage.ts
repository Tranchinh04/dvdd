import type { HistoryOrder, Order } from "./types";

export function readOrders(raw: string | null): Order[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed))
    throw new Error("Dữ liệu đơn hàng phải là một danh sách.");
  return parsed.filter((item): item is Order =>
    Boolean(
      item &&
      typeof item === "object" &&
      typeof item.id === "string" &&
      typeof item.phone === "string" &&
      typeof item.orderCode === "string" &&
      /^[a-zA-Z0-9_-]{1,100}$/.test(item.orderCode) &&
      (item.service === "standard" || item.service === "vnmb") &&
      ["waiting", "received", "expired"].includes(item.status) &&
      typeof item.otp === "string" &&
      typeof item.fee === "string" &&
      (item.feeAmount === null ||
        (typeof item.feeAmount === "number" &&
          Number.isFinite(item.feeAmount))) &&
      typeof item.createdAt === "string" &&
      Number.isFinite(Date.parse(item.createdAt)),
    ),
  );
}

export function demoOrders(): Order[] {
  const now = Date.now();
  const rows: {
    phone: string;
    service: "standard" | "vnmb";
    status: Order["status"];
    otp: string;
    ago: number;
  }[] = [
    {
      phone: "0901234567",
      service: "standard",
      status: "waiting",
      otp: "",
      ago: 0,
    },
    {
      phone: "0923456789",
      service: "vnmb",
      status: "received",
      otp: "628491",
      ago: 12 * 60_000,
    },
    {
      phone: "0934567890",
      service: "standard",
      status: "received",
      otp: "317820",
      ago: 36 * 60_000,
    },
    {
      phone: "0928765432",
      service: "vnmb",
      status: "expired",
      otp: "",
      ago: 2 * 3600_000,
    },
    {
      phone: "0976543210",
      service: "standard",
      status: "received",
      otp: "459102",
      ago: 24 * 3600_000,
    },
    {
      phone: "0927654321",
      service: "vnmb",
      status: "received",
      otp: "183607",
      ago: 2 * 24 * 3600_000,
    },
  ];
  return rows.map((row, index) => ({
    ...row,
    id: `demo-${index}`,
    orderCode: `DEMO${String(102400 + index)}`,
    createdAt: new Date(now - row.ago).toISOString(),
    fee: row.service === "standard" ? "4500đ" : "5500đ",
    feeAmount: row.service === "standard" ? 4500 : 5500,
  }));
}

export function exportOrders(orders: (Order | HistoryOrder)[]) {
  const escape = (value: unknown) => {
    let text = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const headers = [
    "Số điện thoại",
    "Mã đơn",
    "Dịch vụ",
    "Phí",
    "Trạng thái",
    "OTP",
    "Thời gian",
  ];
  const rows = orders.map((o) => [
    o.phone,
    o.orderCode,
    "serviceLabel" in o
      ? o.serviceLabel
      : o.service === "vnmb"
        ? "Vietnamobile"
        : "Số thường",
    o.fee,
    o.status === "received"
      ? "Đã nhận OTP"
      : o.status === "expired"
        ? "Hết hạn"
        : o.status === "waiting"
          ? "Đang chờ"
          : "Chưa rõ trạng thái",
    o.otp,
    o.createdAt || ("timeLabel" in o ? o.timeLabel : ""),
  ]);
  const blob = new Blob(
    [
      "\ufeff" +
        [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `dvdd-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

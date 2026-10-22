export type ServiceId = "standard" | "vnmb";
export type OrderStatus = "waiting" | "received" | "expired";

export type Order = {
  id: string;
  phone: string;
  orderCode: string;
  service: ServiceId;
  fee: string;
  feeAmount: number | null;
  createdAt: string;
  status: OrderStatus;
  otp: string;
  lastCheckedAt?: string;
  lastError?: string;
  imported?: boolean;
};

export type Connection = {
  configured: boolean;
  source: "session" | "environment" | null;
  accountId: string | null;
};

export type Preferences = { autoPoll: boolean; pollSeconds: number };

export type DvddProfile = {
  name: string;
  email: string;
  phone: string;
  balance: number | null;
};

export type DvddPhoneOrder = {
  orderCode: string;
  service: string;
  status: string;
  phone: string;
  result: string;
  time: string;
  fee: string;
  feeAmount: number | null;
};

export type DvddTransaction = {
  code: string;
  amount: string;
  balanceAfter: string;
  description: string;
  orderCode: string;
  time: string;
};

export type DvddAccount = {
  profile: DvddProfile;
  orders: DvddPhoneOrder[] | null;
  transactions: DvddTransaction[] | null;
  transactionPage: number;
  transactionPages: number;
  phonePages?: number;
  updatedAt: string;
  warnings: string[];
};

export type HistoryStatus = OrderStatus | "unknown";

export type OrderCheck = {
  status: OrderStatus;
  otp: string;
  lastCheckedAt: string;
  lastError?: string;
};

export type HistoryOrder = Omit<Order, "service" | "status" | "createdAt"> & {
  service: ServiceId | null;
  serviceLabel: string;
  status: HistoryStatus;
  statusLabel?: string;
  createdAt: string | null;
  timeLabel: string;
  fromProvider: boolean;
  ledgerOnly?: boolean;
  trackingOrder?: Order;
};

export type HistoryPage =
  | { kind: "phones"; page: number; pages: number; rows: DvddPhoneOrder[] }
  | {
      kind: "transactions";
      page: number;
      pages: number;
      rows: DvddTransaction[];
    };

export type AccountResponse = {
  success: true;
  connected: boolean;
  data?: DvddAccount;
  connection?: Connection;
};

export const DVDD_BOT_URL = "https://t.me/dvddBot";
export const DVDD_WEB_URL = "https://dvdd.casa";

export const SERVICES = {
  standard: {
    id: "standard",
    name: "Số điện thoại thường",
    shortName: "Số thường",
    description: "Lựa chọn đơn giản, tối ưu chi phí.",
    price: 4500,
    function: "getPhoneNumber",
  },
  vnmb: {
    id: "vnmb",
    name: "Số Vietnamobile",
    shortName: "Vietnamobile",
    description: "Số chuyên biệt từ nhà mạng VNMB.",
    price: 5500,
    function: "getPhoneNumberVNMB",
  },
} as const;

export function money(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + "đ";
}

export function parseFee(fee: string): number | null {
  const normalized = fee.replace(/[\s.,đ₫vnd]/gi, "");
  return /^\d+$/.test(normalized) ? Number(normalized) : null;
}

export function displayPhone(phone: string) {
  const normalized = phone.startsWith("+84")
    ? "0" + phone.slice(3)
    : phone.startsWith("84") && phone.length === 11
      ? "0" + phone.slice(2)
      : phone.length === 9
        ? "0" + phone
        : phone;
  return /^0\d{9}$/.test(normalized)
    ? `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7)}`
    : normalized;
}

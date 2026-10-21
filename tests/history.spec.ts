import { expect, test } from "@playwright/test";
import {
  historyBuckets,
  historyInPeriod,
  mergeHistory,
  rentalCharge,
  supplierDate,
} from "../src/lib/history";
import type { DvddPhoneOrder, DvddTransaction, Order } from "../src/lib/types";

const phone: DvddPhoneOrder = {
  orderCode: "RENT_CURRENT",
  service: "Thuê số -",
  status: "Đã xong",
  phone: "912345678",
  result: "123456",
  time: "14-10 · Lấy: 11:57",
  fee: "5.500đ",
  feeAmount: 5500,
};
const local: Order = {
  id: "local-id",
  orderCode: phone.orderCode,
  service: "vnmb",
  phone: phone.phone,
  status: "waiting",
  otp: "",
  fee: "5500đ",
  feeAmount: 5500,
  createdAt: "2026-10-14T04:57:55.000Z",
};
function tx(
  code: string,
  description: string,
  time: string,
  amount = "4.500",
  orderCode = "",
): DvddTransaction {
  return { code, amount, balanceAfter: "10.500", description, orderCode, time };
}

test("history merges remote and local orders once, restores full purchase dates and reconstructs only identified rental charges", () => {
  const ledger = [
    tx(
      "CHARGE_CURRENT",
      "Trừ ví đơn hàng RENT_CURRENT phí thuê số VNMB",
      "2026-10-14 11:57:55",
      "5.500",
    ),
    tx(
      "CHARGE_OLD",
      "Trừ ví đơn hàng RENT_OLD phí thuê số",
      "2025-12-31 23:59:59",
    ),
    tx("TOPUP", "Nạp tiền", "2025-12-31 20:00:00", "200.000"),
    tx(
      "OTHER",
      "Trừ ví đơn hàng PURCHASE_ACCOUNT phí mua tài khoản",
      "2025-12-31 20:00:00",
    ),
  ];
  const rows = mergeHistory([local], [phone], [...ledger, ...ledger]);
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({
    id: "local-id",
    orderCode: "RENT_CURRENT",
    status: "received",
    otp: "123456",
    service: "vnmb",
    createdAt: "2026-10-14T04:57:55.000Z",
    trackingOrder: local,
    fromProvider: true,
  });
  expect(rows[1]).toMatchObject({
    orderCode: "RENT_OLD",
    status: "unknown",
    phone: "",
    otp: "",
    ledgerOnly: true,
    service: "standard",
    createdAt: "2025-12-31T16:59:59.000Z",
  });
  expect(
    rentalCharge(
      tx(
        "MISMATCH",
        "Trừ ví đơn hàng ONE phí thuê số",
        "2026-01-01 00:00:00",
        "4500",
        "OTHER",
      ),
    ),
  ).toBeNull();
});

test("history joins refund records without counting duplicate pages or inventing successful OTP outcomes", () => {
  const charge = tx(
    "CHARGE",
    "Trừ ví đơn hàng OLD_REFUND phí thuê số VNMB",
    "2025-12-31 12:00:00",
    "5.500",
  );
  const refund = tx(
    "REFUND",
    "Hoàn ví không nhận được OTP OLD_REFUND",
    "2025-12-31 12:15:00",
    "5.500",
  );
  const [row] = mergeHistory([], [], [refund, charge, refund]);
  expect(
    mergeHistory([], [], [charge, { ...refund, amount: "Chưa rõ" }])[0],
  ).toMatchObject({ status: "expired", feeAmount: null });
  expect(row).toMatchObject({
    orderCode: "OLD_REFUND",
    status: "expired",
    feeAmount: 0,
    createdAt: "2025-12-31T05:00:00.000Z",
    otp: "",
  });
  // The detailed phone table can explicitly report zero after a refund.
  expect(
    mergeHistory(
      [],
      [
        {
          ...phone,
          fee: "0đ",
          feeAmount: 0,
          status: "Đặt lỗi/Hết hạn",
          result: "",
        },
      ],
      [
        tx(
          "C",
          "Trừ ví đơn hàng RENT_CURRENT phí thuê số",
          "2026-10-14 11:57:55",
        ),
      ],
    )[0],
  ).toMatchObject({ feeAmount: 0, status: "expired" });
});

test("unknown service, status, year and fees remain unknown rather than inferred from price or the current year", () => {
  const [row] = mergeHistory(
    [],
    [
      {
        ...phone,
        status: "Khác",
        result: "Không còn kết quả",
        feeAmount: null,
      },
    ],
    [],
  );
  expect(row).toMatchObject({
    service: null,
    status: "unknown",
    createdAt: null,
    feeAmount: null,
    otp: "",
  });
  expect(row.timeLabel).toBe(phone.time);
  expect(
    mergeHistory([{ ...local, imported: true }], [], [])[0].createdAt,
  ).toBeNull();
  expect(
    mergeHistory(
      [{ ...local, status: "received", otp: "654321" }],
      [{ ...phone, result: "", status: "Khác" }],
      [],
    )[0],
  ).toMatchObject({ status: "received", otp: "654321" });
  expect(supplierDate("2026-02-30 12:00:00")).toBeNull();
  expect(supplierDate("14-10 · Lấy: 11:57")).toBeNull();
  expect(supplierDate("2024-02-29 00:00:00")).toBe("2024-02-28T17:00:00.000Z");
});

test("all-time analytics includes older years, uses dated records only in charts and bounds periods in Vietnam time", () => {
  const rows = mergeHistory(
    [],
    [phone, { ...phone, orderCode: "UNDATED" }],
    [
      tx(
        "C1",
        "Trừ ví đơn hàng RENT_CURRENT phí thuê số",
        "2026-10-14 11:57:55",
      ),
      tx("C2", "Trừ ví đơn hàng OLD_YEAR phí thuê số", "2025-12-31 23:59:59"),
      tx("C3", "Trừ ví đơn hàng BOUNDARY phí thuê số", "2026-10-15 00:00:00"),
    ],
  );
  const now = Date.parse("2026-10-21T06:00:00Z");
  expect(historyInPeriod(rows, "all", now)).toHaveLength(4);
  expect(historyInPeriod(rows, "7", now).map((row) => row.orderCode)).toEqual([
    "BOUNDARY",
  ]);
  expect(
    historyBuckets(rows, "all", now).reduce(
      (sum, bucket) => sum + bucket.count,
      0,
    ),
  ).toBe(3);
  expect(historyBuckets(rows, "all", now).length).toBeLessThanOrEqual(7);
});

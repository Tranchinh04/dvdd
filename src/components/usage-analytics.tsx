"use client";

import { ArrowRight, Download, Smartphone } from "lucide-react";
import { historyBuckets, type HistoryPeriod } from "@/lib/history";
import { exportOrders } from "@/lib/storage";
import { type HistoryOrder, money } from "@/lib/types";

export function UsageAnalytics({
  orders,
  period,
  onBuy,
}: {
  orders: HistoryOrder[];
  period: HistoryPeriod;
  onBuy: () => void;
}) {
  const buckets = historyBuckets(orders, period);
  const max = Math.max(...buckets.map((day) => day.count), 4);
  const ended = orders.filter(
    (order) => order.status === "received" || order.status === "expired",
  );
  const unknown = orders.filter((order) => order.status === "unknown").length;
  const undated = orders.filter((order) => order.createdAt === null).length;
  const received = orders.filter((order) => order.status === "received").length;
  const successRate = ended.length
    ? Math.round((received / ended.length) * 100)
    : null;
  const groups = [...new Set(orders.map((order) => order.serviceLabel))];
  return (
    <>
      <div className="analytics-layout">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Hoạt động thuê số</h2>
              <p>
                {period === "all"
                  ? "Toàn bộ lịch sử đã tải từ DVDD và trình duyệt."
                  : `Trong ${period} ngày gần nhất.`}
              </p>
            </div>
          </div>
          <div className="chart-legend">
            <span>
              <i /> Tổng số đơn
            </span>
            <span>
              <i /> Đã nhận OTP
            </span>
          </div>
          <div
            className="chart"
            role="img"
            aria-label={`Biểu đồ hoạt động: ${buckets.reduce((sum, bucket) => sum + bucket.count, 0)} đơn có thời gian xác định`}
          >
            <div className="chart-y-axis">
              {[
                max,
                Math.round(max * 0.75),
                Math.round(max * 0.5),
                Math.round(max * 0.25),
                0,
              ].map((value, i) => (
                <span key={i}>{value}</span>
              ))}
            </div>
            <div className="chart-bars">
              {buckets.map((bucket) => (
                <div className="chart-column" key={bucket.from}>
                  <div
                    className="bar-group"
                    title={`${new Date(bucket.from).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}–${new Date(bucket.to - 1).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}: ${bucket.count} đơn, ${bucket.received} OTP`}
                  >
                    <span
                      className="bar"
                      style={{
                        height: `${Math.max((bucket.count / max) * 100, 1)}%`,
                      }}
                    >
                      <i>{bucket.count}</i>
                    </span>
                    <span
                      className="bar received"
                      style={{
                        height: `${Math.max((bucket.received / max) * 100, 1)}%`,
                      }}
                    />
                  </div>
                  <span className="chart-day">{bucket.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="chart-caption">
            Theo thời điểm mua từ DVDD; đơn chỉ lưu trên máy dùng thời điểm lưu.
            {undated > 0 &&
              ` ${undated} đơn chưa rõ ngày không được đưa vào biểu đồ.`}
          </div>
        </section>
        <section className="panel rate-panel">
          <div className="panel-heading">
            <h2>Tình trạng nhận OTP</h2>
          </div>
          <div
            className="rate-ring"
            style={{
              background: `conic-gradient(var(--primary) ${(successRate || 0) * 3.6}deg, var(--border) 0deg)`,
            }}
          >
            <div>
              <strong>{successRate === null ? "—" : `${successRate}%`}</strong>
              <span>đã nhận OTP</span>
            </div>
          </div>
          <p>
            Tính trên {ended.length} đơn có kết quả xác định.
            {unknown > 0 &&
              ` ${unknown} đơn cũ chưa rõ kết quả được loại khỏi tỷ lệ.`}
          </p>
          <div className="rate-breakdown">
            <span>
              <i className="green-dot" /> Đã nhận OTP<strong>{received}</strong>
            </span>
            <span>
              <i className="amber-dot" /> Đang chờ
              <strong>
                {orders.filter((o) => o.status === "waiting").length}
              </strong>
            </span>
            <span>
              <i /> Đã hết hạn / hoàn tiền
              <strong>
                {orders.filter((o) => o.status === "expired").length}
              </strong>
            </span>
            {unknown > 0 && (
              <span>
                <i /> Chưa rõ kết quả<strong>{unknown}</strong>
              </span>
            )}
          </div>
        </section>
      </div>
      <section className="panel breakdown-panel">
        <div className="panel-heading">
          <div>
            <h2>Dịch vụ đã sử dụng</h2>
            <p>Phân bổ đơn hàng và phí sau các khoản hoàn đã ghi nhận.</p>
          </div>
          <button
            className="button secondary small"
            disabled={!orders.length}
            onClick={() => exportOrders(orders)}
          >
            <Download size={14} /> Xuất dữ liệu
          </button>
        </div>
        {groups.map((label) => {
          const items = orders.filter((order) => order.serviceLabel === label);
          const paid = items.filter((order) => order.feeAmount !== null);
          return (
            <div className="breakdown-row" key={label}>
              <span className="service-icon">
                <Smartphone size={20} />
              </span>
              <div>
                <strong>{label}</strong>
                <span>
                  {items.length} đơn hàng · {paid.length} đơn rõ phí
                </span>
              </div>
              <div className="breakdown-track">
                <span
                  style={{ width: `${(items.length / orders.length) * 100}%` }}
                />
              </div>
              <strong>
                {paid.length
                  ? money(
                      paid.reduce(
                        (sum, order) => sum + (order.feeAmount || 0),
                        0,
                      ),
                    )
                  : "Chưa rõ"}
              </strong>
            </div>
          );
        })}
        {!orders.length && (
          <div className="analytics-empty-note">
            Chưa có đơn trong khoảng thời gian này.{" "}
            <button className="text-button" onClick={onBuy}>
              Mua số ngay <ArrowRight size={14} />
            </button>
          </div>
        )}
      </section>
    </>
  );
}

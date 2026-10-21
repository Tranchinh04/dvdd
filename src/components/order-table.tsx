"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  ListFilter,
  Plus,
  RefreshCw,
  Search,
  X,
  CircleAlert,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { exportOrders } from "@/lib/storage";
import { Order, OrderStatus, SERVICES, displayPhone } from "@/lib/types";
import { CopyButton, EmptyState, StatusBadge } from "./ui";

export function OrderTable({
  orders,
  recent = false,
  checking,
  onCheck,
  onDetail,
  onAll,
  onImport,
  onBuy,
  onCopyError,
  ready = true,
}: {
  orders: Order[];
  recent?: boolean;
  checking: string[];
  onCheck: (order: Order) => void;
  onDetail: (order: Order) => void;
  onAll: () => void;
  onImport: () => void;
  onBuy: () => void;
  onCopyError: () => void;
  ready?: boolean;
}) {
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [search, setSearch] = useState("");
  const [service, setService] = useState("all");
  const [period, setPeriod] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = recent ? 4 : 8;
  const filtered = useMemo(
    () =>
      orders.filter((order) => {
        const query = search.toLowerCase().replace(/\s/g, "");
        return (
          (filter === "all" || order.status === filter) &&
          (service === "all" || order.service === service) &&
          (period === "all" ||
            Date.parse(order.createdAt) >=
              Date.now() - Number(period) * 86400_000) &&
          (!query ||
            `${displayPhone(order.phone)}${order.orderCode}${order.otp}`
              .toLowerCase()
              .replace(/\s/g, "")
              .includes(query))
        );
      }),
    [orders, filter, search, service, period],
  );
  useEffect(() => setPage(1), [filter, search, service, period]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const tabs: { value: typeof filter; label: string }[] = [
    { value: "all", label: "Tất cả" },
    { value: "waiting", label: "Đang chờ" },
    { value: "received", label: "Đã nhận OTP" },
    { value: "expired", label: "Hết hạn" },
  ];

  return (
    <section className="panel orders-panel">
      <div className="panel-heading">
        <div className="heading-with-count">
          <h2>{recent ? "Đơn hàng gần đây" : "Tất cả đơn hàng"}</h2>
          <span className="count-badge">{orders.length}</span>
        </div>
        {recent ? (
          <button className="text-button" onClick={onAll}>
            Xem tất cả <ChevronRight size={15} />
          </button>
        ) : (
          <div className="button-group">
            <button className="button small secondary" onClick={onImport}>
              <Plus size={14} /> Thêm mã đơn
            </button>
            <button
              className="button small secondary"
              disabled={!filtered.length}
              onClick={() => exportOrders(filtered)}
            >
              <Download size={14} /> Xuất CSV
            </button>
          </div>
        )}
      </div>
      <div className="table-toolbar">
        <div className="filter-tabs" aria-label="Lọc theo trạng thái">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              className={filter === tab.value ? "active" : ""}
              aria-pressed={filter === tab.value}
              onClick={() => setFilter(tab.value)}
            >
              {tab.label}
              {tab.value === "waiting" &&
                orders.some((o) => o.status === "waiting") && (
                  <span>
                    {orders.filter((o) => o.status === "waiting").length}
                  </span>
                )}
            </button>
          ))}
        </div>
        <div className="search-input">
          <Search size={15} />
          <input
            aria-label="Tìm số điện thoại hoặc mã đơn"
            placeholder="Tìm số điện thoại, mã đơn..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="icon-button"
              aria-label="Xóa tìm kiếm"
              onClick={() => setSearch("")}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>
      {!recent && (
        <div className="extended-filters">
          <span>
            <ListFilter size={14} /> Bộ lọc
          </span>
          <select
            aria-label="Lọc nhà mạng"
            value={service}
            onChange={(e) => setService(e.target.value)}
          >
            <option value="all">Tất cả nhà mạng</option>
            <option value="standard">Số thường</option>
            <option value="vnmb">Vietnamobile</option>
          </select>
          <select
            aria-label="Lọc thời gian"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="all">Mọi thời gian</option>
            <option value="1">24 giờ qua</option>
            <option value="7">7 ngày qua</option>
            <option value="30">30 ngày qua</option>
          </select>
          <span className="filter-result">{filtered.length} kết quả</span>
        </div>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>SỐ ĐIỆN THOẠI</th>
              <th>DỊCH VỤ</th>
              <th>TRẠNG THÁI</th>
              <th>MÃ OTP</th>
              <th>CHI PHÍ</th>
              <th>THỜI GIAN</th>
              <th>
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((order) => (
              <tr key={order.id}>
                <td>
                  <div className="phone-cell">
                    <span className={`mini-sim ${order.service}`}>
                      {order.service === "vnmb" ? "V" : "S"}
                    </span>
                    <div>
                      <div className="phone-number">
                        {order.phone ? displayPhone(order.phone) : "Chưa có số"}
                        {order.phone && (
                          <CopyButton
                            value={displayPhone(order.phone).replaceAll(
                              " ",
                              "",
                            )}
                            label={`Sao chép số ${displayPhone(order.phone)}`}
                            onError={onCopyError}
                          />
                        )}
                      </div>
                      <button
                        className="order-code"
                        onClick={() => onDetail(order)}
                        title="Xem chi tiết đơn"
                      >
                        {order.orderCode}
                      </button>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="service-name">
                    {SERVICES[order.service].shortName}
                  </span>
                  <span className="cell-subtext">Shopee</span>
                </td>
                <td>
                  <StatusBadge status={order.status} />
                  {order.lastError && order.status === "waiting" && (
                    <span className="row-error" title={order.lastError}>
                      <CircleAlert size={10} /> {order.lastError}
                    </span>
                  )}
                </td>
                <td>
                  {order.otp ? (
                    <span className="otp-value">
                      {order.otp}
                      <CopyButton
                        value={order.otp}
                        label={`Sao chép OTP ${order.otp}`}
                        onError={onCopyError}
                      />
                    </span>
                  ) : order.status === "waiting" ? (
                    <span className="waiting-dots" aria-label="Đang chờ mã OTP">
                      ••• •••
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <span
                    className={`fee-value ${order.feeAmount === null ? "muted" : ""}`}
                  >
                    {order.feeAmount === null ? "Chưa rõ" : order.fee}
                  </span>
                </td>
                <td>
                  <time dateTime={order.createdAt} className="table-time">
                    {new Date(order.createdAt).toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                  <span className="cell-subtext">
                    {new Date(order.createdAt).toLocaleDateString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </span>
                </td>
                <td>
                  {order.status === "waiting" ? (
                    <button
                      className="icon-button table-action"
                      aria-label={`Kiểm tra OTP đơn ${order.orderCode}`}
                      title="Kiểm tra OTP ngay"
                      disabled={checking.includes(order.orderCode)}
                      onClick={() => onCheck(order)}
                    >
                      <RefreshCw
                        size={16}
                        className={
                          checking.includes(order.orderCode) ? "spin" : ""
                        }
                      />
                    </button>
                  ) : (
                    <button
                      className="icon-button table-action"
                      aria-label={`Chi tiết đơn ${order.orderCode}`}
                      title="Chi tiết đơn hàng"
                      onClick={() => onDetail(order)}
                    >
                      <Eye size={17} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-order-list">
        {visible.map((order) => (
          <article
            className="mobile-order-card"
            key={order.id}
            aria-label={`Đơn ${order.orderCode}`}
          >
            <div className="mobile-order-heading">
              <div className="phone-cell">
                <span className={`mini-sim ${order.service}`}>
                  {order.service === "vnmb" ? "V" : "S"}
                </span>
                <div>
                  <div className="phone-number">
                    {order.phone ? displayPhone(order.phone) : "Chưa có số"}
                    {order.phone && (
                      <CopyButton
                        value={displayPhone(order.phone).replaceAll(" ", "")}
                        label={`Sao chép số ${displayPhone(order.phone)}`}
                        onError={onCopyError}
                      />
                    )}
                  </div>
                  <button
                    className="order-code"
                    onClick={() => onDetail(order)}
                  >
                    {order.orderCode}
                  </button>
                </div>
              </div>
              <button
                className="icon-button"
                aria-label={`Chi tiết đơn ${order.orderCode}`}
                onClick={() => onDetail(order)}
              >
                <Eye size={17} />
              </button>
            </div>
            <div className="mobile-order-meta">
              <span>{SERVICES[order.service].shortName} · Shopee</span>
              <span>
                {order.feeAmount === null ? "Chưa có phí" : order.fee}
              </span>
            </div>
            <div className="mobile-order-result">
              <StatusBadge status={order.status} />
              {order.otp ? (
                <span className="otp-value">
                  {order.otp}
                  <CopyButton
                    value={order.otp}
                    label={`Sao chép OTP ${order.otp}`}
                    onError={onCopyError}
                  />
                </span>
              ) : order.status === "waiting" ? (
                <button
                  className="text-button"
                  disabled={checking.includes(order.orderCode)}
                  onClick={() => onCheck(order)}
                >
                  <RefreshCw
                    size={12}
                    className={checking.includes(order.orderCode) ? "spin" : ""}
                  />
                  Kiểm tra OTP
                </button>
              ) : null}
            </div>
            {order.lastError && order.status === "waiting" && (
              <p className="mobile-order-error">{order.lastError}</p>
            )}
          </article>
        ))}
      </div>
      {!visible.length && (
        <EmptyState
          title={
            !ready
              ? "Đang tải lịch sử..."
              : orders.length
                ? "Không tìm thấy đơn hàng"
                : "Đơn hàng đầu tiên đang chờ bạn"
          }
          description={
            orders.length
              ? "Thử tìm theo số điện thoại, mã đơn hoặc thay đổi bộ lọc."
              : "Chọn một dịch vụ ở trên. Số điện thoại và mã OTP sẽ xuất hiện tại đây."
          }
          action={
            ready && !orders.length ? (
              <button className="button secondary small" onClick={onBuy}>
                <Plus size={14} /> Mua số đầu tiên
              </button>
            ) : undefined
          }
        />
      )}
      <div className="table-footer">
        <span>
          {filtered.length
            ? `Hiển thị ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filtered.length)} trên ${filtered.length} đơn hàng`
            : "Chưa có đơn hàng để hiển thị"}
        </span>
        {recent ? (
          <span className="local-data-note">
            <span className="status-dot" /> Lưu trên trình duyệt của bạn
          </span>
        ) : (
          <div className="pagination">
            <button
              className="icon-button"
              aria-label="Trang trước"
              disabled={safePage === 1}
              onClick={() => setPage(safePage - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              {safePage} / {pages}
            </span>
            <button
              className="icon-button"
              aria-label="Trang sau"
              disabled={safePage === pages}
              onClick={() => setPage(safePage + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

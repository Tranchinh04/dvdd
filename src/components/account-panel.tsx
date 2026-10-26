"use client";

import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LogIn,
  LogOut,
  RefreshCw,
  UserRound,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import type { useWorkspace } from "@/hooks/use-workspace";
import { displayPhone, money } from "@/lib/types";
import { CopyButton } from "./ui";
import { AccountAuth } from "./account-auth";
import { AccountSessionState } from "./account-session-state";

type Workspace = ReturnType<typeof useWorkspace>;

function Balance({ workspace }: { workspace: Workspace }) {
  const account = workspace.account;
  return (
    <div className="dvdd-balance">
      <span>
        <Wallet size={15} /> Số dư DVDD
      </span>
      <strong>
        {account?.profile.balance == null
          ? "Chưa có dữ liệu"
          : money(account.profile.balance)}
      </strong>
      {account && (
        <small>
          Cập nhật{" "}
          {new Date(account.updatedAt).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </small>
      )}
    </div>
  );
}

function RefreshButton({ workspace }: { workspace: Workspace }) {
  return (
    <button
      className="button secondary small"
      aria-label={
        workspace.accountLoading
          ? "Đang cập nhật tài khoản"
          : "Làm mới tài khoản"
      }
      disabled={workspace.accountLoading || workspace.accountBusy}
      onClick={() => void workspace.refreshAccount()}
    >
      <RefreshCw size={14} className={workspace.accountLoading ? "spin" : ""} />
      <span className="desktop-button-label">
        {workspace.accountLoading ? "Đang cập nhật..." : "Làm mới tài khoản"}
      </span>
      <span className="mobile-button-label">
        {workspace.accountLoading ? "Đang tải..." : "Làm mới"}
      </span>
    </button>
  );
}

export function AccountStrip({
  workspace,
  onOpen,
  onTopup,
}: {
  workspace: Workspace;
  onOpen: () => void;
  onTopup: () => void;
}) {
  const { account, accountError, accountLoading } = workspace;
  if (workspace.demo) return null;
  if (workspace.accountRestoring)
    return <AccountSessionState workspace={workspace} />;
  return (
    <section
      className={`panel account-strip ${account ? "signed-in" : ""}`}
      aria-label="Tổng quan tài khoản DVDD"
    >
      <div className="account-strip-main">
        <span className="account-strip-icon">
          {account ? <UserRound size={22} /> : <LogIn size={22} />}
        </span>
        <div>
          <strong>
            {account
              ? account.profile.name || "Tài khoản DVDD"
              : "Kết nối tài khoản của bạn"}
          </strong>
          <p>
            {account
              ? account.profile.email
              : "Đăng nhập hoặc tạo tài khoản DVDD để mua số và quản lý lịch sử."}
          </p>
        </div>
      </div>
      {account && <Balance workspace={workspace} />}
      <div className="account-strip-actions">
        {account && (
          <button className="button primary small" onClick={onTopup}>
            <Wallet size={14} /> Nạp tiền
          </button>
        )}
        {account && <RefreshButton workspace={workspace} />}
        <button
          className={`button small ${account ? "ghost" : "primary"}`}
          aria-label={
            account ? "Xem tài khoản DVDD" : "Đăng nhập hoặc đăng ký DVDD"
          }
          disabled={workspace.accountBusy}
          onClick={onOpen}
        >
          <span className={account ? "desktop-button-label" : undefined}>
            {account
              ? "Xem tài khoản"
              : accountLoading
                ? "Đang tải tài khoản..."
                : "Đăng nhập / Đăng ký"}
          </span>
          {account && <span className="mobile-button-label">Chi tiết</span>}
          <ArrowRight size={14} />
        </button>
      </div>
      {accountError && (
        <p className="account-message" role="alert">
          <CircleAlert size={15} /> {accountError}
        </p>
      )}
    </section>
  );
}

export function AccountPanel({
  workspace,
  onTopup,
}: {
  workspace: Workspace;
  onTopup: () => void;
}) {
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [tab, setTab] = useState<"orders" | "transactions">("orders");
  const [query, setQuery] = useState("");
  const { account, accountBusy, accountLoading, buying } = workspace;
  const match = (values: string[]) =>
    values
      .join(" ")
      .toLocaleLowerCase("vi")
      .includes(query.trim().toLocaleLowerCase("vi"));
  if (workspace.accountRestoring)
    return <AccountSessionState workspace={workspace} />;
  if (!account) return <AccountAuth workspace={workspace} />;

  const orders = account.orders?.filter((row) =>
    match([row.orderCode, row.phone, row.result, row.service, row.status]),
  );
  const transactions = account.transactions?.filter((row) =>
    match([row.code, row.orderCode, row.description, row.time]),
  );
  return (
    <div className="account-sections">
      <section className="panel account-profile">
        <div className="panel-heading">
          <div className="settings-title">
            <span className="settings-icon">
              <UserRound size={21} />
            </span>
            <div>
              <h2>{account.profile.name || "Tài khoản DVDD"}</h2>
            </div>
          </div>
          <span className="connection-pill configured">
            <span className="status-dot" /> Đã đăng nhập
          </span>
        </div>
        <div className="account-profile-body">
          <Balance workspace={workspace} />
          <dl className="account-profile-fields">
            <div>
              <dt>Email</dt>
              <dd>{account.profile.email}</dd>
            </div>
            <div>
              <dt>Số điện thoại</dt>
              <dd>
                {account.profile.phone
                  ? displayPhone(account.profile.phone)
                  : "DVDD chưa cung cấp"}
              </dd>
            </div>
            <div>
              <dt>Đơn thuê số DVDD trả về</dt>
              <dd>
                {account.orders === null
                  ? "Chưa tải được"
                  : `${account.orders.length} đơn`}
              </dd>
            </div>
          </dl>
        </div>
        {workspace.accountError && (
          <p className="account-message" role="alert">
            <CircleAlert size={15} />
            {workspace.accountError} Dữ liệu đang hiển thị là lần cập nhật gần
            nhất.
          </p>
        )}
        {account.warnings.map((warning) => (
          <p key={warning} className="account-message" role="status">
            <CircleAlert size={15} />
            {warning}
          </p>
        ))}
        {error && (
          <p className="account-message" role="alert">
            {error}
          </p>
        )}
        <div className="account-profile-actions">
          <RefreshButton workspace={workspace} />
          <button className="button primary small" onClick={onTopup}>
            <Wallet size={14} />
            Nạp tiền
          </button>
          <button
            className="button ghost small"
            disabled={buying || leaving || accountBusy}
            onClick={async () => {
              setLeaving(true);
              setError("");
              try {
                await workspace.logout();
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Chưa đăng xuất được.",
                );
              } finally {
                setLeaving(false);
              }
            }}
          >
            <LogOut size={14} />
            {leaving ? "Đang đăng xuất..." : "Đăng xuất DVDD"}
          </button>
        </div>
      </section>

      <section className="panel remote-history">
        <div className="panel-heading">
          <div>
            <h2>Lịch sử từ tài khoản DVDD</h2>
            <p>
              Dữ liệu đọc trực tiếp từ nhà cung cấp, gồm cả đơn mua ngoài ứng
              dụng này.
            </p>
          </div>
        </div>
        <div className="remote-toolbar">
          <div
            className="remote-tabs"
            role="tablist"
            aria-label="Loại lịch sử DVDD"
          >
            <button
              role="tab"
              aria-selected={tab === "orders"}
              onClick={() => {
                setTab("orders");
                setQuery("");
              }}
            >
              Lịch sử thuê số
            </button>
            <button
              role="tab"
              aria-selected={tab === "transactions"}
              onClick={() => {
                setTab("transactions");
                setQuery("");
              }}
            >
              Giao dịch tài khoản
            </button>
          </div>
          <input
            className="remote-search"
            type="search"
            aria-label="Tìm trong lịch sử DVDD đang hiển thị"
            placeholder={
              tab === "orders"
                ? "Tìm số, mã đơn, OTP..."
                : "Tìm trong trang giao dịch..."
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {tab === "orders" ? (
          <>
            {orders &&
              (orders.length ? (
                <div className="remote-order-list">
                  <div className="remote-order-list-head" aria-hidden="true">
                    <span>Số điện thoại</span>
                    <span>Mã đơn</span>
                    <span>OTP</span>
                    <span>Trạng thái</span>
                    <span>Thời gian</span>
                    <span>Phí</span>
                  </div>
                  {orders.map((row, index) => (
                    <article
                      className="remote-order"
                      key={`${row.orderCode}-${index}`}
                    >
                      <div className="remote-phone">
                        <strong>{displayPhone(row.phone)}</strong>
                        <span>{row.service}</span>
                      </div>
                      <span className="remote-order-code">
                        {row.orderCode}
                        <CopyButton
                          value={row.orderCode}
                          label="Sao chép mã đơn DVDD"
                        />
                      </span>
                      <span className="remote-otp">
                        <span className="mobile-otp-label">OTP</span>
                        <strong>{row.result || "—"}</strong>
                        {row.result && (
                          <CopyButton
                            value={row.result}
                            label="Sao chép OTP từ DVDD"
                          />
                        )}
                      </span>
                      <span
                        className={`dvdd-status ${/đã xong/i.test(row.status) ? "complete" : ""}`}
                      >
                        {row.status}
                      </span>
                      <p className="remote-time">
                        {row.time || "DVDD chưa cung cấp thời gian"}
                      </p>
                      <b className="remote-fee">{row.fee || "Chưa có phí"}</b>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="remote-empty">
                  {query
                    ? "Không có đơn phù hợp với tìm kiếm."
                    : "DVDD chưa trả đơn thuê số nào cho tài khoản này."}
                </p>
              ))}
            <p className="remote-scope">
              {account.orders === null
                ? "Chưa tải được lịch sử thuê số. Hãy làm mới tài khoản."
                : `DVDD hiện trả ${account.orders.length} đơn thuê số. Số đơn có thể được giới hạn bởi nhà cung cấp, không phải tổng đơn trọn đời.`}
            </p>
          </>
        ) : (
          <>
            <p className="remote-scope">
              Số tiền, mô tả và số dư cuối được giữ theo dữ liệu DVDD. Tìm kiếm
              áp dụng cho trang đang xem.
            </p>
            {transactions === null || transactions === undefined ? (
              <p className="remote-empty">
                Chưa tải được giao dịch. Hãy làm mới tài khoản.
              </p>
            ) : transactions.length ? (
              <div className="remote-table-wrap">
                <table className="remote-table">
                  <thead>
                    <tr>
                      <th>Giao dịch / Thời gian</th>
                      <th>Số tiền (đ)</th>
                      <th>Số dư cuối (đ)</th>
                      <th>Mô tả / Mã đơn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((row, index) => (
                      <tr key={`${row.code}-${index}`}>
                        <td data-label="Giao dịch / Thời gian">
                          <strong>{row.code}</strong>
                          <small>{row.time}</small>
                        </td>
                        <td data-label="Số tiền (đ)">{row.amount}</td>
                        <td data-label="Số dư cuối (đ)">{row.balanceAfter}</td>
                        <td data-label="Mô tả / Mã đơn">
                          {row.description}
                          <small>{row.orderCode}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="remote-empty">
                {query
                  ? "Không có giao dịch phù hợp trên trang này."
                  : "Chưa có giao dịch trên trang này."}
              </p>
            )}
            <div className="remote-pagination">
              <span>
                Trang {account.transactionPage} / {account.transactionPages}
              </span>
              <div>
                <button
                  className="button secondary small"
                  disabled={accountLoading || account.transactionPage <= 1}
                  onClick={() =>
                    void workspace.refreshAccount(account.transactionPage - 1)
                  }
                >
                  <ChevronLeft size={14} />
                  Trước
                </button>
                <button
                  className="button secondary small"
                  disabled={
                    accountLoading ||
                    account.transactionPage >= account.transactionPages
                  }
                  onClick={() =>
                    void workspace.refreshAccount(account.transactionPage + 1)
                  }
                >
                  Sau
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

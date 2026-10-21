"use client";

import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Eye,
  EyeOff,
  LoaderCircle,
  LogIn,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import type { useWorkspace } from "@/hooks/use-workspace";
import { DVDD_WEB_URL, displayPhone, money } from "@/lib/types";
import { CopyButton } from "./ui";

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
      disabled={workspace.accountLoading || workspace.accountBusy}
      onClick={() => void workspace.refreshAccount()}
    >
      <RefreshCw size={14} className={workspace.accountLoading ? "spin" : ""} />
      {workspace.accountLoading ? "Đang cập nhật..." : "Làm mới tài khoản"}
    </button>
  );
}

export function AccountStrip({
  workspace,
  onOpen,
}: {
  workspace: Workspace;
  onOpen: () => void;
}) {
  const { account, accountError, accountLoading } = workspace;
  if (workspace.demo) return null;
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
              : "Đăng nhập để quản lý tài khoản DVDD"}
          </strong>
          <p>
            {account
              ? account.profile.email
              : "Xem số dư thật, lịch sử thuê số và giao dịch ngay tại đây."}
          </p>
        </div>
      </div>
      {account && <Balance workspace={workspace} />}
      <div className="account-strip-actions">
        {account && <RefreshButton workspace={workspace} />}
        <button
          className={`button small ${account ? "ghost" : "primary"}`}
          disabled={workspace.accountBusy}
          onClick={onOpen}
        >
          {account
            ? "Xem tài khoản"
            : accountLoading
              ? "Đang tải tài khoản..."
              : "Đăng nhập DVDD"}{" "}
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

export function AccountPanel({ workspace }: { workspace: Workspace }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
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
  if (!account)
    return (
      <section className="panel account-login">
        <div className="panel-heading">
          <div className="settings-title">
            <span className="settings-icon">
              <UserRound size={21} />
            </span>
            <div>
              <h2>Đăng nhập tài khoản DVDD</h2>
              <p>Dùng tài khoản bạn đã đăng ký trong mini app @dvddBot.</p>
            </div>
          </div>
        </div>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            try {
              await workspace.login(email, password);
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Chưa đăng nhập được DVDD.",
              );
            } finally {
              setPassword("");
            }
          }}
        >
          <div className="account-login-intro">
            <ShieldCheck size={18} />
            <p>
              Đăng nhập một lần để tự kết nối API, xem số dư và đọc lịch sử từ
              DVDD. Mật khẩu chỉ dùng để đăng nhập, không được lưu lại.
            </p>
          </div>
          {workspace.accountError && (
            <p className="inline-error" role="alert">
              <CircleAlert size={15} />
              {workspace.accountError}
            </p>
          )}
          <div className="account-fields">
            <div>
              <label className="field-label" htmlFor="dvdd-email">
                Email DVDD <span>*</span>
              </label>
              <div className="token-input">
                <Mail size={17} />
                <input
                  id="dvdd-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email đăng nhập DVDD"
                  maxLength={254}
                  required
                  disabled={accountBusy}
                />
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="dvdd-password">
                Mật khẩu DVDD <span>*</span>
              </label>
              <div className="token-input">
                <ShieldCheck size={17} />
                <input
                  id="dvdd-password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mật khẩu tài khoản DVDD"
                  maxLength={512}
                  required
                  disabled={accountBusy}
                />
                <button
                  className="icon-button"
                  type="button"
                  aria-label={
                    visible ? "Ẩn mật khẩu DVDD" : "Hiện mật khẩu DVDD"
                  }
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
          </div>
          {error && (
            <p className="inline-error" role="alert">
              <CircleAlert size={15} />
              {error}
            </p>
          )}
          <div className="settings-form-actions">
            <button
              className="button primary"
              type="submit"
              disabled={accountBusy || buying || !email.trim() || !password}
            >
              {accountBusy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <LogIn size={16} />
              )}
              {accountBusy
                ? "Đang đăng nhập & đồng bộ..."
                : "Đăng nhập & kết nối"}
            </button>
            <a
              href={`${DVDD_WEB_URL}/register.php`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-button"
            >
              Đăng ký tài khoản tại DVDD <ExternalLink size={13} />
            </a>
          </div>
          <p className="field-hint">
            Sử dụng số dư trong tài khoản DVDD của bạn. Đăng nhập không mua số
            và không trừ tiền. Nếu chỉ có API token, bạn vẫn có thể kết nối tại
            Cấu hình API để mua số và lấy OTP.
          </p>
        </form>
      </section>
    );

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
              <p>Đã đăng nhập và kết nối API của tài khoản này.</p>
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
          <a
            href={`${DVDD_WEB_URL}/dashboard?page=transactions-add`}
            target="_blank"
            rel="noopener noreferrer"
            className="button secondary small"
          >
            <Wallet size={14} />
            Nạp tiền tại DVDD
            <ExternalLink size={12} />
          </a>
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
            <p className="remote-scope">
              {account.orders === null
                ? "Chưa tải được lịch sử thuê số. Hãy làm mới tài khoản."
                : `DVDD hiện trả ${account.orders.length} đơn thuê số. Số đơn này có thể bị giới hạn bởi nhà cung cấp, không phải tổng đơn trọn đời.`}
            </p>
            {orders &&
              (orders.length ? (
                <div className="remote-order-list">
                  {orders.map((row, index) => (
                    <article
                      className="remote-order"
                      key={`${row.orderCode}-${index}`}
                    >
                      <div className="remote-order-top">
                        <strong>{displayPhone(row.phone)}</strong>
                        <span
                          className={`dvdd-status ${/đã xong/i.test(row.status) ? "complete" : ""}`}
                        >
                          {row.status}
                        </span>
                        <b>{row.fee || "Chưa có phí"}</b>
                      </div>
                      <div className="remote-order-data">
                        <span>{row.service}</span>
                        <span className="remote-order-code">
                          {row.orderCode}
                          <CopyButton
                            value={row.orderCode}
                            label="Sao chép mã đơn DVDD"
                          />
                        </span>
                        <span className="remote-otp">
                          OTP: <strong>{row.result || "Chưa có"}</strong>
                          {row.result && (
                            <CopyButton
                              value={row.result}
                              label="Sao chép OTP từ DVDD"
                            />
                          )}
                        </span>
                      </div>
                      <p className="remote-time">
                        {row.time || "DVDD chưa cung cấp thời gian"}
                      </p>
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
                        <td>
                          <strong>{row.code}</strong>
                          <small>{row.time}</small>
                        </td>
                        <td>{row.amount}</td>
                        <td>{row.balanceAfter}</td>
                        <td>
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

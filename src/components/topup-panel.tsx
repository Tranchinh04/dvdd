"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  CircleAlert,
  Clock3,
  Download,
  LoaderCircle,
  LogIn,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import type { useWorkspace } from "@/hooks/use-workspace";
import type { DvddTopup } from "@/lib/types";
import { money } from "@/lib/types";
import { CopyButton } from "./ui";

type Workspace = ReturnType<typeof useWorkspace>;
type Props = { workspace: Workspace; onAccount: () => void };

export function TopupPanel({ workspace, onAccount }: Props) {
  if (workspace.demo || !workspace.account)
    return (
      <section className="panel topup-gate">
        <span className="topup-symbol">
          <Wallet size={27} />
        </span>
        <h2>
          {workspace.demo
            ? "Nạp tiền dành cho tài khoản thật"
            : "Đăng nhập để nạp tiền"}
        </h2>
        <p>
          {workspace.demo
            ? "Chế độ dùng thử không hiển thị thông tin chuyển khoản."
            : "Đăng nhập tài khoản DVDD để lấy QR và nội dung chuyển khoản dành cho bạn. Kết nối chỉ bằng API token chưa đủ cho bước này."}
        </p>
        <button className="button primary" onClick={onAccount}>
          <LogIn size={16} /> Đăng nhập DVDD <ArrowRight size={15} />
        </button>
      </section>
    );
  return (
    <ConnectedTopup
      key={`${workspace.connection.accountId}:${workspace.account.profile.email}`}
      workspace={workspace}
      onAccount={onAccount}
    />
  );
}

function ConnectedTopup({ workspace, onAccount }: Props) {
  const [details, setDetails] = useState<DvddTopup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [visible, setVisible] = useState(true);
  const current = useRef(workspace);
  current.current = workspace;
  const accountId = workspace.connection.accountId;

  useEffect(() => {
    let stopped = false;
    let requesting = false;
    let validUntil = 0;
    let controller: AbortController | undefined;
    async function load() {
      if (stopped || requesting) return;
      requesting = true;
      validUntil = 0;
      setDetails(null);
      setLoading(true);
      setError("");
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 25_000);
      try {
        const response = await fetch("/api/topup", {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json();
        if (stopped) return;
        if (!response.ok || !result.success) {
          if (result.code === "ACCOUNT_SESSION_EXPIRED")
            current.current.expireAccount();
          throw new Error(
            result.message || "Chưa tải được thông tin nạp tiền.",
          );
        }
        if (result.accountId !== accountId)
          throw new Error(
            "Tài khoản đã thay đổi. Vui lòng tải lại trang để lấy đúng thông tin nạp tiền.",
          );
        validUntil = Date.now() + 5 * 60_000;
        setDetails(result.data);
        if (!current.current.accountLoading)
          void current.current.refreshAccount(1);
      } catch (err) {
        if (!stopped)
          setError(
            err instanceof Error && err.name !== "AbortError"
              ? err.message
              : "Chưa kết nối được DVDD. Hãy tải lại thông tin nạp tiền.",
          );
      } finally {
        clearTimeout(timeout);
        requesting = false;
        if (!stopped) setLoading(false);
      }
    }
    function tick() {
      const active = document.visibilityState === "visible";
      setVisible(active);
      if (!active || stopped) return;
      if (validUntil && Date.now() >= validUntil) void load();
      const state = current.current;
      if (!state.accountLoading && !state.accountError)
        void state.refreshAccount(1);
    }
    void load();
    const timer = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      stopped = true;
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [accountId, revision]);

  const account = workspace.account!;
  const copyError = () =>
    workspace.notify(
      "Chưa sao chép được. Bạn có thể chọn và sao chép trực tiếp nội dung.",
      "error",
    );
  const refreshDetails = () => {
    setDetails(null);
    setRevision((value) => value + 1);
  };
  return (
    <div className="topup-page">
      <section className="panel topup-summary" aria-label="Ví DVDD của bạn">
        <div className="topup-wallet-icon">
          <Wallet size={23} />
        </div>
        <div className="topup-wallet-info">
          <span>Số dư DVDD hiện tại</span>
          <strong>
            {account.profile.balance === null
              ? "Chưa có dữ liệu"
              : money(account.profile.balance)}
          </strong>
          <small>{account.profile.email}</small>
        </div>
        <div className="topup-sync">
          <span className="status-dot" />
          {!visible
            ? "Tạm dừng khi ẩn tab"
            : workspace.accountError
              ? "Chưa cập nhật được số dư"
              : "Tự cập nhật mỗi 30 giây"}
          <small>
            Cập nhật {new Date(account.updatedAt).toLocaleTimeString("vi-VN")}
          </small>
        </div>
      </section>
      {workspace.accountError && (
        <p className="account-message" role="alert">
          <CircleAlert size={16} />
          {workspace.accountError} Số dư đang hiển thị là lần cập nhật gần nhất.
        </p>
      )}
      <div className="topup-layout">
        <section
          className="panel topup-transfer"
          aria-label="Thông tin chuyển khoản"
        >
          <div className="panel-heading">
            <div>
              <h2>Chuyển khoản ngân hàng</h2>
              <p>Nạp vào số dư tài khoản DVDD của bạn.</p>
            </div>
            <span className="soft-label">
              <ShieldCheck size={13} /> Từ DVDD
            </span>
          </div>
          {loading ? (
            <div className="topup-loading" role="status">
              <LoaderCircle className="spin" size={26} />
              <strong>Đang lấy QR từ DVDD...</strong>
              <p>Đang đối chiếu thông tin chuyển khoản.</p>
            </div>
          ) : error || !details ? (
            <div className="topup-loading" role="alert">
              <CircleAlert size={27} />
              <strong>Chưa có thông tin nạp hợp lệ</strong>
              <p>{error}</p>
              <button className="button secondary" onClick={refreshDetails}>
                <RefreshCw size={15} /> Thử lại
              </button>
            </div>
          ) : (
            <>
              <div className="topup-payment-body">
                <div className="topup-qr-column">
                  <div className="topup-qr-caption">
                    <QrCode size={17} /> Quét mã để chuyển khoản
                  </div>
                  <div className="topup-qr-frame">
                    <img
                      src={details.qrDataUrl}
                      width={260}
                      height={260}
                      alt="QR nạp tiền DVDD có sẵn tài khoản nhận và nội dung chuyển khoản"
                    />
                  </div>
                  <a
                    className="button secondary small"
                    href={details.qrDataUrl}
                    download="dvdd-qr-nap-tien.png"
                  >
                    <Download size={14} /> Tải mã QR
                  </a>
                  <small>Nhập số tiền trong ứng dụng ngân hàng.</small>
                </div>
                <div className="topup-bank-column">
                  <div className="topup-bank-brand">
                    <span>
                      <Building2 size={22} />
                    </span>
                    <div>
                      <strong>MB Bank</strong>
                      <small>{details.bankName}</small>
                    </div>
                  </div>
                  <dl className="topup-bank-fields">
                    <div>
                      <dt>Chủ tài khoản</dt>
                      <dd>{details.accountName}</dd>
                    </div>
                    <div>
                      <dt>Số tài khoản</dt>
                      <dd className="topup-copy-value">
                        <strong>{details.accountNumber}</strong>
                        <CopyButton
                          value={details.accountNumber}
                          label="Sao chép số tài khoản ngân hàng"
                          onError={copyError}
                        />
                      </dd>
                    </div>
                    <div className="topup-reference">
                      <dt>Nội dung chuyển khoản</dt>
                      <dd className="topup-copy-value">
                        <strong>{details.reference}</strong>
                        <CopyButton
                          value={details.reference}
                          label="Sao chép nội dung chuyển khoản"
                          onError={copyError}
                        />
                      </dd>
                      <small>
                        Giữ nguyên nội dung để DVDD cộng đúng tài khoản.
                      </small>
                    </div>
                    <div>
                      <dt>Số tiền tối thiểu</dt>
                      <dd>{money(details.minimumAmount)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              <div className="topup-provider-note">
                <Clock3 size={16} />
                <span>
                  {details.processingNotice}.
                  <small>
                    Thông tin lấy lúc{" "}
                    {new Date(details.updatedAt).toLocaleTimeString("vi-VN")};
                    tự tải lại QR sau mỗi 5 phút khi trang đang mở.
                  </small>
                </span>
                <button
                  className="text-button"
                  onClick={refreshDetails}
                  aria-label="Tải lại thông tin nạp tiền"
                >
                  <RefreshCw size={14} /> Tải lại
                </button>
              </div>
            </>
          )}
        </section>
        <aside className="panel topup-guide">
          <h2>Nạp tiền trong 3 bước</h2>
          <ol>
            <li>
              <span>1</span>
              <div>
                <strong>Mở ứng dụng ngân hàng</strong>
                <p>Quét mã QR hoặc tải ảnh để chọn từ thư viện.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Kiểm tra và chuyển khoản</strong>
                <p>
                  {details
                    ? `Nhập từ ${money(details.minimumAmount)}, đối chiếu người nhận và giữ nguyên nội dung chuyển khoản.`
                    : "Đợi thông tin nạp tiền tải xong trước khi chuyển khoản."}
                </p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Chờ DVDD cập nhật số dư</strong>
                <p>
                  Số dư và giao dịch sẽ được làm mới tại đây. Chỉ chuyển tiền
                  một lần cho mỗi lần nạp.
                </p>
              </div>
            </li>
          </ol>
          <button
            className="button primary"
            disabled={
              workspace.accountLoading || workspace.accountBusy || !details
            }
            onClick={() => void workspace.refreshAccount(1)}
          >
            <RefreshCw
              size={15}
              className={workspace.accountLoading ? "spin" : ""}
            />
            {workspace.accountLoading
              ? "Đang kiểm tra..."
              : "Tôi đã chuyển · Kiểm tra số dư"}
          </button>
          <p className="topup-check-note">
            Nút kiểm tra chỉ cập nhật dữ liệu từ DVDD; không xác nhận giao dịch
            đã thành công.
          </p>
        </aside>
      </div>
      <section className="panel topup-ledger">
        <div className="panel-heading">
          <div>
            <h2>Giao dịch tài khoản gần đây</h2>
            <p>Đối chiếu khoản nạp trong giao dịch DVDD sau khi chuyển tiền.</p>
          </div>
          <button className="text-button" onClick={onAccount}>
            Xem tài khoản <ArrowRight size={14} />
          </button>
        </div>
        {account.transactions === null ? (
          <p className="topup-ledger-empty">
            Chưa đọc được giao dịch từ DVDD. Hãy kiểm tra lại số dư sau.
          </p>
        ) : account.transactionPage !== 1 ? (
          <p className="topup-ledger-empty">
            Đang tải trang giao dịch gần nhất...
          </p>
        ) : !account.transactions.length ? (
          <p className="topup-ledger-empty">
            DVDD chưa có giao dịch để hiển thị.
          </p>
        ) : (
          <div className="topup-ledger-scroll">
            <table>
              <thead>
                <tr>
                  <th>Mô tả từ DVDD</th>
                  <th>Số tiền (đ)</th>
                  <th>Số dư sau (đ)</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {account.transactions.slice(0, 5).map((tx, index) => (
                  <tr key={`${tx.code}-${index}`}>
                    <td data-label="Mô tả từ DVDD">
                      {tx.description}
                      <small>{tx.code}</small>
                    </td>
                    <td data-label="Số tiền (đ)">{tx.amount}</td>
                    <td data-label="Số dư sau (đ)">{tx.balanceAfter}</td>
                    <td data-label="Thời gian">{tx.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

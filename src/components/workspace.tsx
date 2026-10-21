"use client";

import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BellRing,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Clock3,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Signal,
  Smartphone,
  Sparkles,
  Trash2,
  Unplug,
  UserRound,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { exportOrders } from "@/lib/storage";
import {
  DVDD_BOT_URL,
  Order,
  ServiceId,
  SERVICES,
  displayPhone,
  money,
} from "@/lib/types";
import { CopyButton, LogoMark, Modal, PhoneArtwork, StatusBadge } from "./ui";
import { OrderTable } from "./order-table";
import { AccountPanel, AccountStrip } from "./account-panel";

type View = "buy" | "history" | "analytics" | "settings" | "account";
type Dialog = "purchase" | "detail" | "help" | "import" | "clear" | null;
type WorkspaceState = ReturnType<typeof useWorkspace>;

const NAV_ITEMS = [
  { id: "buy", label: "Mua số điện thoại", icon: Smartphone },
  { id: "history", label: "Lịch sử đơn hàng", icon: History },
  { id: "analytics", label: "Thống kê sử dụng", icon: BarChart3 },
  { id: "account", label: "Tài khoản DVDD", icon: UserRound },
  { id: "settings", label: "Cấu hình API", icon: Settings2 },
] as const;

export function Workspace() {
  const workspace = useWorkspace();
  const [view, setView] = useState<View>("buy");
  const [service, setService] = useState<ServiceId>("standard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileMode, setMobileMode] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [detailId, setDetailId] = useState("");
  const mainRef = useRef<HTMLElement>(null);
  const { connection, demo, orders, notify, buying, checking, preferences } =
    workspace;
  const selected = SERVICES[service];
  const accountName = workspace.account?.profile.name || "Tài khoản cá nhân";
  const initials =
    workspace.account?.profile.name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .filter((_, i, parts) => i === 0 || i === parts.length - 1)
      .join("")
      .toUpperCase() || "CN";
  const detail = orders.find((order) => order.id === detailId);
  const pending = orders.filter((order) => order.status === "waiting").length;
  const navigate = (next: View) => {
    setView(next);
    setMobileOpen(false);
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const copyError = () =>
    notify(
      "Chưa sao chép được. Bạn có thể chọn và sao chép trực tiếp nội dung.",
      "error",
    );
  const showDetail = (order: Order) => {
    setDetailId(order.id);
    setDialog("detail");
  };
  const buy = () => {
    if (!demo && !connection.configured) {
      navigate("settings");
      return;
    }
    setDialog("purchase");
  };

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const update = () => setMobileMode(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [mobileOpen]);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Đến nội dung chính
      </a>
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Đóng menu"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${mobileOpen ? "open" : ""}`}
        aria-label="Điều hướng chính"
        inert={mobileMode && !mobileOpen}
      >
        <button
          className="brand"
          onClick={() => navigate("buy")}
          aria-label="DVDD — Trang mua số"
        >
          <LogoMark />
          <span>
            dvdd<span className="brand-dot">.</span>
            <small>WORKSPACE</small>
          </span>
        </button>
        <div className="workspace-switcher">
          <span className="workspace-avatar">P</span>
          <span>
            Không gian cá nhân<small>Quản lý số & OTP</small>
          </span>
          <LockKeyhole size={13} />
        </div>
        <div className="nav-label">KHÔNG GIAN LÀM VIỆC</div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? "active" : ""}`}
              aria-current={view === item.id ? "page" : undefined}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={19} strokeWidth={1.7} />
              <span>{item.label}</span>
              {item.id === "history" && pending > 0 && (
                <span className="nav-count">{pending}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <span className="help-spark">
              <Sparkles size={19} />
            </span>
            <h3>Một chút hướng dẫn?</h3>
            <p>Chỉ vài bước để có số điện thoại và nhận mã OTP.</p>
            <button onClick={() => setDialog("help")}>
              Khám phá cách sử dụng <ArrowUpRight size={14} />
            </button>
            <span className="help-decoration" />
          </div>
          <button
            className="nav-item help-nav"
            onClick={() => setDialog("help")}
          >
            <CircleHelp size={19} strokeWidth={1.7} /> Hướng dẫn sử dụng{" "}
            <ArrowUpRight size={14} />
          </button>
          <div className="sidebar-account">
            <span className="account-avatar">
              {initials}
              <span />
            </span>
            <div>
              {accountName}
              <small>
                {demo
                  ? "Chế độ dùng thử"
                  : workspace.account?.profile.balance != null
                    ? `Số dư: ${money(workspace.account.profile.balance)}`
                    : "Chưa đăng nhập DVDD"}
              </small>
            </div>
            <button
              className="icon-button"
              aria-label="Mở cấu hình tài khoản"
              onClick={() => navigate("account")}
            >
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Mở menu điều hướng"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-home">
              <Layers3 size={16} /> Workspace
            </span>
            <ChevronRight size={13} />
            <span>{NAV_ITEMS.find((item) => item.id === view)?.label}</span>
          </div>
          <div className="topbar-actions">
            <span
              className={`connection-pill ${demo ? "demo" : connection.configured ? "configured" : ""}`}
            >
              <span className="status-dot" />
              {demo
                ? "Đang dùng thử"
                : connection.configured
                  ? "Đã cấu hình API"
                  : "Chưa kết nối API"}
            </span>
            <span className="topbar-separator" />
            <button
              className="icon-button"
              aria-label="Mở hướng dẫn"
              onClick={() => setDialog("help")}
            >
              <CircleHelp size={19} />
            </button>
            <button
              className="avatar-button"
              aria-label="Mở cấu hình cá nhân"
              onClick={() => navigate("account")}
            >
              {initials}
            </button>
          </div>
        </header>

        <main className="content" id="main-content" ref={mainRef}>
          {demo && (
            <div className="demo-banner">
              <span>
                <Sparkles size={16} />
                <strong>Bạn đang ở chế độ dùng thử.</strong>
                <span>Dữ liệu minh họa, không phát sinh chi phí.</span>
              </span>
              <button disabled={buying} onClick={workspace.toggleDemo}>
                Thoát dùng thử <ArrowRight size={14} />
              </button>
            </div>
          )}
          {workspace.connectionError && (
            <div className="error-banner">
              <CircleAlert size={16} />
              {workspace.connectionError}
            </div>
          )}

          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span />{" "}
                {view === "settings"
                  ? "THIẾT LẬP KHÔNG GIAN"
                  : "KHÔNG GIAN CỦA BẠN"}
              </div>
              <h1>
                {view === "buy"
                  ? "Mua số điện thoại"
                  : view === "history"
                    ? "Lịch sử đơn hàng"
                    : view === "analytics"
                      ? "Thống kê sử dụng"
                      : view === "account"
                        ? "Tài khoản DVDD"
                        : "Cấu hình API"}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {view === "buy"
                  ? "Một nơi để mua số, nhận OTP và quản lý mọi đơn hàng."
                  : view === "history"
                    ? "Mọi số điện thoại và mã OTP, gọn gàng trong một nơi."
                    : view === "analytics"
                      ? "Nhìn lại hoạt động và chi phí từ lịch sử của bạn."
                      : view === "account"
                        ? "Số dư, thông tin cá nhân và lịch sử từ DVDD."
                        : "Kết nối DVDD và thiết lập cách bạn muốn làm việc."}
              </p>
            </div>
            {view === "buy" ? (
              <div className="page-heading-actions">
                <button
                  className="button secondary demo-button"
                  disabled={buying}
                  onClick={workspace.toggleDemo}
                >
                  <Play size={13} fill="currentColor" />
                  {demo ? "Thoát dùng thử" : "Xem bản demo"}
                </button>
              </div>
            ) : view === "history" ? (
              <button
                className="button primary"
                onClick={() => navigate("buy")}
              >
                <Plus size={16} /> Mua số mới
              </button>
            ) : (
              <span className="date-chip">
                <CalendarDays size={15} />
                {new Date().toLocaleDateString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </span>
            )}
          </div>

          {view !== "settings" && view !== "account" && (
            <>
              <AccountStrip
                workspace={workspace}
                onOpen={() => navigate("account")}
              />
              <Stats orders={orders} />
            </>
          )}

          {view === "account" && <AccountPanel workspace={workspace} />}

          {view === "buy" && (
            <>
              {!demo &&
                !connection.configured &&
                workspace.connectionLoaded && (
                  <div className="connect-banner">
                    <div className="connect-icon">
                      <KeyRound size={19} />
                    </div>
                    <div>
                      <strong>Bắt đầu bằng cách kết nối tài khoản DVDD</strong>
                      <p>
                        Thêm API token của bạn để mua số và nhận OTP ngay tại
                        đây.
                      </p>
                    </div>
                    <button
                      className="button small"
                      onClick={() => navigate("settings")}
                    >
                      Kết nối API <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              <div className="purchase-layout">
                <section className="panel service-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Chọn dịch vụ của bạn</h2>
                      <p>Số điện thoại mới, sẵn sàng nhận OTP Shopee.</p>
                    </div>
                    <span className="soft-label">
                      <Signal size={12} /> Việt Nam
                    </span>
                  </div>
                  <div className="service-cards">
                    {(Object.keys(SERVICES) as ServiceId[]).map((id) => (
                      <button
                        key={id}
                        className={`service-card ${id} ${service === id ? "selected" : ""}`}
                        aria-pressed={service === id}
                        onClick={() => setService(id)}
                      >
                        <div className="service-card-top">
                          <span className={`service-icon ${id}`}>
                            {id === "standard" ? (
                              <Smartphone size={25} strokeWidth={1.6} />
                            ) : (
                              <span className="vnmb-mark">
                                v<span>m</span>
                              </span>
                            )}
                          </span>
                          <span
                            className={`radio-indicator ${service === id ? "checked" : ""}`}
                          >
                            {service === id && (
                              <Check size={11} strokeWidth={3} />
                            )}
                          </span>
                        </div>
                        <span className="service-title">
                          {SERVICES[id].name}
                        </span>
                        <span className="service-description">
                          {SERVICES[id].description}
                        </span>
                        <span className="service-price">
                          {new Intl.NumberFormat("vi-VN").format(
                            SERVICES[id].price,
                          )}
                          <small>đ</small>
                          <span>/ số điện thoại</span>
                        </span>
                        <span className="service-divider" />
                        <span className="service-feature">
                          <CircleCheck size={14} /> Chưa đăng ký Shopee
                        </span>
                        <span className="service-feature">
                          <CircleCheck size={14} /> Nhận mã OTP trực tiếp
                        </span>
                        <span className={`service-tag ${id}`}>
                          {id === "standard" ? (
                            <Zap size={11} fill="currentColor" />
                          ) : (
                            <Signal size={11} />
                          )}
                          {id === "standard"
                            ? "Tiết kiệm chi phí"
                            : "Nhà mạng Vietnamobile"}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="service-footnote">
                    <ShieldCheck size={15} />
                    <span>
                      Giá tham khảo. Phí thực tế được cập nhật theo kết quả trả
                      về từ DVDD.
                    </span>
                  </div>
                </section>
                <aside className="panel checkout-panel">
                  <div className="checkout-heading">
                    <span className="checkout-icon">
                      <ShoppingBag size={18} />
                    </span>
                    <h2>Đơn hàng của bạn</h2>
                  </div>
                  <div className="checkout-service">
                    <span className={`mini-sim ${service}`}>
                      {service === "vnmb" ? "V" : "S"}
                    </span>
                    <div>
                      <strong>{selected.shortName}</strong>
                      <span>Shopee · Việt Nam</span>
                    </div>
                    <span className="quantity-tag">× 1</span>
                  </div>
                  <dl className="checkout-details">
                    <div>
                      <dt>Đơn giá tham khảo</dt>
                      <dd>{money(selected.price)}</dd>
                    </div>
                    <div>
                      <dt>Số lượng</dt>
                      <dd>1 số điện thoại</dd>
                    </div>
                  </dl>
                  <div className="checkout-total">
                    <span>Tổng dự kiến</span>
                    <strong>{money(selected.price)}</strong>
                  </div>
                  <button
                    className="button primary buy-button"
                    disabled={buying || !workspace.ready}
                    onClick={buy}
                  >
                    {buying ? (
                      <LoaderCircle size={18} className="spin" />
                    ) : !demo && !connection.configured ? (
                      <KeyRound size={17} />
                    ) : (
                      <Plus size={18} />
                    )}
                    {!demo && !connection.configured
                      ? "Kết nối để mua số"
                      : "Mua số ngay"}
                    {!buying && (demo || connection.configured) && (
                      <ArrowRight size={17} />
                    )}
                  </button>
                  <p className="checkout-note">
                    <LockKeyhole size={12} />
                    {demo
                      ? "Đơn thử nghiệm · Không trừ phí"
                      : "Thanh toán từ số dư tài khoản DVDD"}
                  </p>
                  {workspace.purchaseError && (
                    <p className="inline-error" role="alert">
                      <CircleAlert size={15} />
                      {workspace.purchaseError}
                    </p>
                  )}
                  <div className="checkout-tip">
                    <span>
                      <MessageSquareText size={17} />
                    </span>
                    <p>
                      Sau khi mua, OTP sẽ được cập nhật tại{" "}
                      <button onClick={() => navigate("history")}>
                        lịch sử đơn hàng
                      </button>
                      .
                    </p>
                  </div>
                </aside>
              </div>
              <div className="how-it-works">
                <span className="how-label">
                  <Sparkles size={15} /> Đơn giản trong 3 bước
                </span>
                {[
                  {
                    title: "Chọn & mua số",
                    description: "Chọn dịch vụ phù hợp",
                  },
                  {
                    title: "Sử dụng số điện thoại",
                    description: "Yêu cầu gửi mã xác minh",
                  },
                  { title: "Nhận mã OTP", description: "Sao chép và hoàn tất" },
                ].map((step, index) => (
                  <div className="how-step" key={step.title}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{step.title}</strong>
                      <small>{step.description}</small>
                    </div>
                    {index < 2 && <ChevronRight size={14} />}
                  </div>
                ))}
              </div>
              <OrderTable
                orders={orders}
                recent
                checking={checking}
                onCheck={(order) => void workspace.checkOtp(order, true)}
                onDetail={showDetail}
                onAll={() => navigate("history")}
                onImport={() => setDialog("import")}
                onBuy={() => {
                  document
                    .querySelector(".service-panel")
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                onCopyError={copyError}
                ready={workspace.ready}
              />
              <div className="polling-footer">
                <span>
                  <span
                    className={`status-dot ${preferences.autoPoll ? "green" : ""}`}
                  />
                  {preferences.autoPoll
                    ? `Tự động kiểm tra OTP mỗi ${preferences.pollSeconds} giây khi tab đang mở`
                    : "Đang tạm dừng kiểm tra OTP tự động"}
                </span>
                <button
                  onClick={() =>
                    workspace.savePreferences({
                      ...preferences,
                      autoPoll: !preferences.autoPoll,
                    })
                  }
                >
                  {preferences.autoPoll ? "Tạm dừng" : "Bật tự động"}
                </button>
              </div>
            </>
          )}

          {view === "history" && (
            <>
              <div className="history-info">
                <span>
                  <Radio size={16} />
                  {preferences.autoPoll
                    ? `Tự động kiểm tra mỗi ${preferences.pollSeconds} giây`
                    : "Đang tạm dừng kiểm tra tự động"}
                  <span className="muted">·</span>
                  {pending} đơn đang chờ
                </span>
                <button
                  className="text-button"
                  onClick={() => {
                    const waiting = orders.filter(
                      (order) => order.status === "waiting",
                    );
                    if (!demo && !connection.configured) {
                      navigate("settings");
                      return;
                    }
                    for (const order of waiting.slice(0, 10))
                      void workspace.checkOtp(order, true);
                  }}
                  disabled={!pending || checking.length > 0}
                >
                  <RefreshCw
                    size={14}
                    className={checking.length ? "spin" : ""}
                  />{" "}
                  Kiểm tra ngay
                </button>
              </div>
              <OrderTable
                orders={orders}
                checking={checking}
                onCheck={(order) => {
                  if (!demo && !connection.configured) navigate("settings");
                  else void workspace.checkOtp(order, true);
                }}
                onDetail={showDetail}
                onAll={() => navigate("history")}
                onImport={() => setDialog("import")}
                onBuy={() => navigate("buy")}
                onCopyError={copyError}
                ready={workspace.ready}
              />
              <div className="history-footnote">
                <ShieldCheck size={15} />
                <p>
                  Lịch sử được lưu trên trình duyệt, riêng cho từng API token.
                  Xuất CSV để giữ bản sao trước khi xóa dữ liệu trình duyệt.
                </p>
              </div>
            </>
          )}

          {view === "analytics" && (
            <Analytics orders={orders} onBuy={() => navigate("buy")} />
          )}
          {view === "settings" && (
            <Settings
              workspace={workspace}
              onClear={() => setDialog("clear")}
              onHelp={() => setDialog("help")}
              onAccount={() => navigate("account")}
            />
          )}

          <footer className="app-footer">
            <span>
              © {new Date().getFullYear()} DVDD Workspace
              <span className="footer-dot">·</span>Không gian nhỏ, mọi thứ gọn
              gàng.
            </span>
            <button onClick={() => setDialog("help")}>
              Hướng dẫn & thông tin <ArrowUpRight size={12} />
            </button>
          </footer>
        </main>
      </div>

      {workspace.notice && (
        <div
          className={`toast ${workspace.notice.type}`}
          role={workspace.notice.type === "error" ? "alert" : "status"}
        >
          {workspace.notice.type === "error" ? (
            <CircleAlert size={18} />
          ) : workspace.notice.type === "info" ? (
            <CircleHelp size={18} />
          ) : (
            <CircleCheck size={18} />
          )}
          <span>{workspace.notice.message}</span>
          <button
            className="icon-button"
            aria-label="Đóng thông báo"
            onClick={() => workspace.setNotice(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {dialog === "purchase" && (
        <Modal
          title={demo ? "Tạo đơn dùng thử" : "Xác nhận mua số"}
          description={
            demo
              ? "Trải nghiệm luồng mua số và nhận OTP, hoàn toàn miễn phí."
              : "Một số điện thoại mới sẽ được thuê từ tài khoản DVDD của bạn."
          }
          onClose={() => setDialog(null)}
          dismissible={!buying}
        >
          <div className="purchase-confirm">
            <div className={`service-icon ${service}`}>
              <Smartphone size={25} />
            </div>
            <div>
              <strong>{selected.name}</strong>
              <span>1 số điện thoại · Shopee · Việt Nam</span>
            </div>
          </div>
          <div className="confirm-price">
            <span>Chi phí tham khảo</span>
            <strong>{money(selected.price)}</strong>
          </div>
          <p className="modal-note">
            {demo
              ? "Đây là dữ liệu minh họa. Không gọi API mua số và không trừ tiền."
              : "Phí thực tế do DVDD quyết định và sẽ được trừ từ số dư tài khoản khi mua thành công. Không thể hủy đơn qua API này."}
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={buying}
              onClick={() => setDialog(null)}
            >
              Quay lại
            </button>
            <button
              className="button primary"
              disabled={buying}
              onClick={async () => {
                const order = await workspace.buy(service);
                if (order) showDetail(order);
                else setDialog(null);
              }}
            >
              {buying ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <ShoppingBag size={16} />
              )}
              {buying
                ? "Đang lấy số..."
                : demo
                  ? "Tạo đơn miễn phí"
                  : "Xác nhận mua số"}
            </button>
          </div>
        </Modal>
      )}

      {dialog === "detail" && detail && (
        <Modal
          title="Chi tiết đơn hàng"
          description={detail.orderCode}
          onClose={() => setDialog(null)}
        >
          <div className="detail-top">
            <StatusBadge status={detail.status} />
            <span className="soft-label">
              {SERVICES[detail.service].shortName}
            </span>
          </div>
          <div className="detail-phone">
            <span>SỐ ĐIỆN THOẠI</span>
            <strong>
              {detail.phone ? displayPhone(detail.phone) : "Chưa có số"}
              {detail.phone && (
                <CopyButton
                  value={displayPhone(detail.phone).replaceAll(" ", "")}
                  label="Sao chép số điện thoại"
                  onError={copyError}
                />
              )}
            </strong>
          </div>
          <div className={`detail-otp ${detail.otp ? "received" : ""}`}>
            <span>MÃ XÁC MINH OTP</span>
            {detail.otp ? (
              <strong>
                {detail.otp}
                <CopyButton
                  value={detail.otp}
                  label="Sao chép mã OTP"
                  onError={copyError}
                />
              </strong>
            ) : (
              <>
                <div className="otp-boxes">
                  {Array.from({ length: 6 }, (_, index) => (
                    <span key={index}>–</span>
                  ))}
                </div>
                <p>
                  {detail.status === "expired"
                    ? "Đơn đã hết hạn theo phản hồi từ DVDD."
                    : "Sử dụng số điện thoại để yêu cầu gửi mã xác minh."}
                </p>
              </>
            )}
          </div>
          {detail.lastError && detail.status === "waiting" && (
            <p className="inline-error">
              <CircleAlert size={15} />
              {detail.lastError}
            </p>
          )}
          <dl className="detail-info">
            <div>
              <dt>Mã đơn hàng</dt>
              <dd>
                {detail.orderCode}
                <CopyButton
                  value={detail.orderCode}
                  label="Sao chép mã đơn hàng"
                  onError={copyError}
                />
              </dd>
            </div>
            <div>
              <dt>Phí từ DVDD</dt>
              <dd>{detail.fee}</dd>
            </div>
            <div>
              <dt>Thời điểm lưu đơn</dt>
              <dd>{new Date(detail.createdAt).toLocaleString("vi-VN")}</dd>
            </div>
            {detail.lastCheckedAt && (
              <div>
                <dt>Kiểm tra gần nhất</dt>
                <dd>
                  {new Date(detail.lastCheckedAt).toLocaleTimeString("vi-VN")}
                </dd>
              </div>
            )}
          </dl>
          {detail.status === "waiting" && (
            <button
              className="button primary full-width"
              disabled={checking.includes(detail.orderCode)}
              onClick={() => {
                if (!demo && !connection.configured) {
                  setDialog(null);
                  navigate("settings");
                } else void workspace.checkOtp(detail, true);
              }}
            >
              <RefreshCw
                size={16}
                className={checking.includes(detail.orderCode) ? "spin" : ""}
              />
              {checking.includes(detail.orderCode)
                ? "Đang kiểm tra..."
                : "Kiểm tra OTP ngay"}
            </button>
          )}
          {detail.status === "waiting" && (
            <p className="centered-note">
              {preferences.autoPoll
                ? `Tự động cập nhật mỗi ${preferences.pollSeconds} giây khi mở tab.`
                : "Tự động cập nhật đang tạm dừng."}
            </p>
          )}
        </Modal>
      )}

      {dialog === "help" && (
        <Modal
          title="Chào bạn, cùng bắt đầu nhé!"
          description="Mua số và nhận OTP trong một vài bước đơn giản."
          onClose={() => setDialog(null)}
          wide
        >
          <div className="help-modal-art">
            <PhoneArtwork />
            <div>
              <span className="soft-label purple">
                <Sparkles size={12} /> Dành cho không gian của bạn
              </span>
              <h3>
                Từ số điện thoại
                <br />
                đến mã xác minh.
              </h3>
              <p>Gọn gàng, trực quan và luôn trong tầm tay.</p>
            </div>
          </div>
          <div className="help-steps">
            {[
              {
                title: "Mở dvddBot và đăng nhập DVDD",
                text: "Mở @dvddBot trên Telegram và vào mini app. Chọn Đăng nhập hoặc Đăng ký tài khoản DVDD; form đăng ký gồm họ tên, email, số điện thoại, mật khẩu và nhập lại mật khẩu.",
              },
              {
                title: "Lấy token ở mục API",
                text: "Trong menu DVDD, chọn API → Thông tin kết nối API. Tại ô Api token, bấm Sao chép. Nếu chưa có mã, dùng Tạo mới rồi sao chép mã được cấp. Dán mã vào Cấu hình API trên web này và bấm Lưu kết nối.",
              },
              {
                title: "Chọn và mua số điện thoại",
                text: "Chọn số thường hoặc Vietnamobile, xem giá tham khảo rồi xác nhận mua. Phí thực tế được lấy từ phản hồi DVDD.",
              },
              {
                title: "Sử dụng số và nhận OTP",
                text: "Dùng số để yêu cầu mã xác minh Shopee. Giữ tab này mở để nhận OTP tự động, hoặc bấm kiểm tra thủ công.",
              },
            ].map((step, index) => (
              <div key={step.title}>
                <span>{index + 1}</span>
                <div>
                  <h4>{step.title}</h4>
                  <p>{step.text}</p>
                </div>
              </div>
            ))}
          </div>
          <a
            className="button secondary telegram-help-link"
            href={DVDD_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={15} /> Mở dvddBot trên Telegram
          </a>
          <div className="info-box">
            <BookOpen size={17} />
            <p>
              API DVDD chưa cung cấp số dư, danh sách đơn hay chức năng hủy/hoàn
              tiền. Lịch sử được lưu trên trình duyệt này; bạn có thể xuất CSV
              hoặc thêm lại đơn bằng mã đơn hàng. Trạng thái hết hạn chỉ cập
              nhật khi DVDD xác nhận.
            </p>
          </div>
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={buying}
              onClick={() => {
                workspace.toggleDemo();
                setDialog(null);
              }}
            >
              Trải nghiệm bản demo
            </button>
            <button
              className="button primary"
              onClick={() => {
                setDialog(null);
                navigate("settings");
              }}
            >
              Đến cấu hình API <ArrowRight size={15} />
            </button>
          </div>
        </Modal>
      )}

      {dialog === "import" && (
        <ImportOrder
          onClose={() => setDialog(null)}
          onSubmit={(code, phone, selectedService) => {
            const order = workspace.addOrder(code, phone, selectedService);
            showDetail(order);
          }}
        />
      )}
      {dialog === "clear" && (
        <Modal
          title="Xóa lịch sử đã kết thúc?"
          description="Các đơn đang chờ OTP sẽ được giữ lại."
          onClose={() => setDialog(null)}
        >
          <p className="modal-note">
            Bạn sẽ xóa{" "}
            {orders.filter((order) => order.status !== "waiting").length} đơn đã
            nhận OTP hoặc đã hết hạn trong{" "}
            {demo ? "dữ liệu dùng thử" : "lịch sử trên trình duyệt này"}. Hãy
            xuất CSV trước nếu bạn muốn giữ bản sao. Thao tác không hủy đơn hay
            hoàn tiền từ DVDD.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setDialog(null)}
            >
              Giữ lại
            </button>
            <button
              className="button danger"
              onClick={() => {
                workspace.clearHistory();
                setDialog(null);
                notify("Đã xóa lịch sử các đơn đã kết thúc.");
              }}
            >
              <Trash2 size={15} /> Xóa lịch sử
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Stats({ orders }: { orders: Order[] }) {
  const waiting = orders.filter((order) => order.status === "waiting").length;
  const received = orders.filter((order) => order.status === "received").length;
  const knownFees = orders.filter((order) => order.feeAmount !== null);
  const spend = knownFees.reduce(
    (sum, order) => sum + (order.feeAmount || 0),
    0,
  );
  const stats = [
    {
      label: "Đơn trên trình duyệt",
      value: String(orders.length).padStart(2, "0"),
      icon: Smartphone,
      className: "purple",
      note: "Đã lưu trên trình duyệt này",
      noteIcon: Layers3,
    },
    {
      label: "Đang chờ OTP",
      value: String(waiting).padStart(2, "0"),
      icon: Clock3,
      className: "amber",
      note: waiting ? "Đang theo dõi mã xác minh" : "Chưa có đơn đang chờ",
      noteIcon: Radio,
    },
    {
      label: "Đã nhận OTP",
      value: String(received).padStart(2, "0"),
      icon: MessageSquareText,
      className: "green",
      note: "Sẵn sàng để sử dụng",
      noteIcon: CheckCheck,
    },
    {
      label: "Chi phí đơn đã lưu",
      value: money(spend),
      icon: Wallet,
      className: "blue",
      note:
        orders.length > knownFees.length
          ? `${knownFees.length}/${orders.length} đơn có dữ liệu phí`
          : "Phí các đơn trên trình duyệt này",
      noteIcon: CreditCard,
    },
  ];
  return (
    <div className="stats-grid">
      {stats.map((stat) => (
        <div className="stat-card" key={stat.label}>
          <div className="stat-top">
            <span>{stat.label}</span>
            <span className={`stat-icon ${stat.className}`}>
              <stat.icon size={17} strokeWidth={1.7} />
            </span>
          </div>
          <strong className={stat.className === "amber" ? "amber-number" : ""}>
            {stat.value}
          </strong>
          <div className="stat-note">
            <stat.noteIcon size={12} />
            <span>{stat.note}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Analytics({ orders, onBuy }: { orders: Order[]; onBuy: () => void }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 6 + index);
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const inDay = orders.filter(
      (order) =>
        Date.parse(order.createdAt) >= +date &&
        Date.parse(order.createdAt) < +next,
    );
    return {
      date,
      count: inDay.length,
      received: inDay.filter((order) => order.status === "received").length,
    };
  });
  const max = Math.max(...days.map((day) => day.count), 4);
  const ended = orders.filter((order) => order.status !== "waiting");
  const successRate = ended.length
    ? Math.round(
        (orders.filter((order) => order.status === "received").length /
          ended.length) *
          100,
      )
    : null;
  return (
    <>
      <div className="analytics-layout">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Hoạt động trong tuần</h2>
              <p>Số đơn được lưu trong 7 ngày gần nhất.</p>
            </div>
            <span className="soft-label">
              <CalendarDays size={13} /> 7 ngày qua
            </span>
          </div>
          <div className="chart-legend">
            <span>
              <i /> Tổng số đơn
            </span>
            <span>
              <i /> Đã nhận OTP
            </span>
          </div>
          <div className="chart">
            <div className="chart-y-axis">
              {[
                max,
                Math.round(max * 0.75),
                Math.round(max * 0.5),
                Math.round(max * 0.25),
                0,
              ].map((value, index) => (
                <span key={index}>{value}</span>
              ))}
            </div>
            <div className="chart-bars">
              {days.map((day, index) => (
                <div className="chart-column" key={index}>
                  <div
                    className="bar-group"
                    title={`${day.date.toLocaleDateString("vi-VN")}: ${day.count} đơn, ${day.received} OTP`}
                  >
                    <span
                      className="bar"
                      style={{
                        height: `${Math.max((day.count / max) * 100, 1)}%`,
                      }}
                    >
                      <i>{day.count}</i>
                    </span>
                    <span
                      className="bar received"
                      style={{
                        height: `${Math.max((day.received / max) * 100, 1)}%`,
                      }}
                    />
                  </div>
                  <span className="chart-day">
                    {index === 6
                      ? "Hôm nay"
                      : day.date.toLocaleDateString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="chart-caption">
            Dựa trên thời điểm lưu đơn tại trình duyệt này.
          </div>
        </section>
        <section className="panel rate-panel">
          <div className="panel-heading">
            <h2>Tình trạng nhận OTP</h2>
          </div>
          <div
            className="rate-ring"
            style={{
              background: `conic-gradient(var(--primary) ${(successRate || 0) * 3.6}deg, #efedf6 0deg)`,
            }}
          >
            <div>
              <strong>{successRate === null ? "—" : `${successRate}%`}</strong>
              <span>đã nhận OTP</span>
            </div>
          </div>
          <p>Tính trên {ended.length} đơn đã nhận OTP hoặc hết hạn.</p>
          <div className="rate-breakdown">
            <span>
              <i className="green-dot" /> Đã nhận OTP
              <strong>
                {orders.filter((o) => o.status === "received").length}
              </strong>
            </span>
            <span>
              <i className="amber-dot" /> Đang chờ
              <strong>
                {orders.filter((o) => o.status === "waiting").length}
              </strong>
            </span>
            <span>
              <i /> Đã hết hạn
              <strong>
                {orders.filter((o) => o.status === "expired").length}
              </strong>
            </span>
          </div>
        </section>
      </div>
      <section className="panel breakdown-panel">
        <div className="panel-heading">
          <div>
            <h2>Dịch vụ đã sử dụng</h2>
            <p>Phân bổ đơn hàng và chi phí theo từng dịch vụ.</p>
          </div>
          <button
            className="button secondary small"
            disabled={!orders.length}
            onClick={() => exportOrders(orders)}
          >
            <Download size={14} /> Xuất dữ liệu
          </button>
        </div>
        {(Object.keys(SERVICES) as ServiceId[]).map((id) => {
          const serviceOrders = orders.filter((o) => o.service === id);
          const paid = serviceOrders.filter((o) => o.feeAmount !== null);
          return (
            <div className="breakdown-row" key={id}>
              <span className={`service-icon ${id}`}>
                <Smartphone size={20} />
              </span>
              <div>
                <strong>{SERVICES[id].name}</strong>
                <span>
                  {serviceOrders.length} đơn hàng · {paid.length} đơn có phí
                </span>
              </div>
              <div className="breakdown-track">
                <span
                  style={{
                    width: `${orders.length ? (serviceOrders.length / orders.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <strong>
                {paid.length
                  ? money(paid.reduce((sum, o) => sum + (o.feeAmount || 0), 0))
                  : serviceOrders.length
                    ? "Chưa rõ"
                    : "0đ"}
              </strong>
            </div>
          );
        })}
        {!orders.length && (
          <div className="analytics-empty-note">
            Một vài con số ý nghĩa bắt đầu từ đơn hàng đầu tiên.{" "}
            <button className="text-button" onClick={onBuy}>
              Mua số ngay <ArrowRight size={14} />
            </button>
          </div>
        )}
      </section>
    </>
  );
}

function Settings({
  workspace,
  onClear,
  onHelp,
  onAccount,
}: {
  workspace: WorkspaceState;
  onClear: () => void;
  onHelp: () => void;
  onAccount: () => void;
}) {
  const [token, setToken] = useState("");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState("");
  const { connection, preferences, orders, demo, notify } = workspace;
  return (
    <div className="settings-layout">
      <div className="settings-sections">
        <section className="panel account-settings-link">
          <div className="settings-title">
            <span className="settings-icon">
              <UserRound size={20} />
            </span>
            <div>
              <h2>
                {workspace.account
                  ? "Đã đăng nhập tài khoản DVDD"
                  : "Kết nối đầy đủ bằng đăng nhập DVDD"}
              </h2>
              <p>
                Đăng nhập để tự lấy API token, hiển thị số dư và lịch sử tài
                khoản.
              </p>
            </div>
          </div>
          <button className="button primary small" onClick={onAccount}>
            {workspace.account ? "Quản lý tài khoản" : "Đăng nhập DVDD"}
            <ArrowRight size={14} />
          </button>
        </section>
        <section className="panel settings-panel">
          <div className="panel-heading">
            <div className="settings-title">
              <span className="settings-icon">
                <KeyRound size={20} />
              </span>
              <div>
                <h2>Kết nối bằng API token</h2>
                <p>Dùng token để mua số và lấy OTP khi không đăng nhập DVDD.</p>
              </div>
            </div>
            <span
              className={`connection-pill ${connection.configured ? "configured" : ""}`}
            >
              <span className="status-dot" />
              {connection.configured ? "Đã cấu hình" : "Chưa cấu hình"}
            </span>
          </div>
          <div className="token-onboarding">
            <div className="token-onboarding-heading">
              <span className="soft-label purple">
                <Sparkles size={12} /> LẦN ĐẦU SỬ DỤNG
              </span>
              <a
                href={DVDD_BOT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-button"
              >
                Mở dvddBot <ExternalLink size={13} />
              </a>
            </div>
            <ol>
              <li>
                Mở mini app trong <strong>@dvddBot</strong>, chọn{" "}
                <strong>Đăng nhập</strong> hoặc <strong>Đăng ký</strong> tài
                khoản DVDD.
              </li>
              <li>
                Vào <strong>API → Thông tin kết nối API</strong>. Tại ô{" "}
                <strong>Api token</strong>, bấm <strong>Sao chép</strong>. Nếu ô
                chưa có mã, dùng <strong>Tạo mới</strong> trước.
              </li>
              <li>
                Dán token vào ô bên dưới và bấm <strong>Lưu kết nối</strong>.
              </li>
            </ol>
            <p>
              Trước khi mua số, nạp số dư trong DVDD tại{" "}
              <strong>Tài chính → Nạp tiền</strong>.
            </p>
          </div>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              setError("");
              try {
                await workspace.saveToken(token);
                setToken("");
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Không thể lưu token.",
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            <label className="field-label" htmlFor="api-token">
              API token <span>*</span>
            </label>
            <div className="token-input">
              <KeyRound size={17} />
              <input
                id="api-token"
                name="api-token"
                autoComplete="off"
                spellCheck={false}
                type={visible ? "text" : "password"}
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder={
                  connection.configured
                    ? "••••••••••••••••  ·  Nhập token để thay đổi"
                    : "Nhập API token từ tài khoản DVDD"
                }
                maxLength={512}
                required
              />
              <button
                type="button"
                className="icon-button"
                aria-label={visible ? "Ẩn API token" : "Hiện API token"}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <p className="field-hint">
              Token được lưu bảo mật. Việc lưu cấu hình không mua số và không
              trừ tiền. API token riêng lẻ chưa cung cấp số dư và lịch sử tài
              khoản trong tài liệu DVDD hiện có.
            </p>
            {connection.configured && (
              <div className="token-status">
                <ShieldCheck size={16} />
                <span>
                  {connection.source === "environment"
                    ? "Đang sử dụng token cấu hình trên máy chủ."
                    : "Đã lưu token cho trình duyệt này."}{" "}
                  Tài khoản sẽ được DVDD xác thực khi sử dụng dịch vụ.
                </span>
              </div>
            )}
            {error && (
              <p className="inline-error" role="alert">
                <CircleAlert size={15} />
                {error}
              </p>
            )}
            <div className="settings-form-actions">
              <button
                className="button primary"
                disabled={
                  saving ||
                  !token.trim() ||
                  workspace.buying ||
                  workspace.accountBusy
                }
                type="submit"
              >
                {saving ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Check size={16} />
                )}
                {saving ? "Đang lưu..." : "Lưu kết nối"}
              </button>
              {connection.source === "session" && (
                <button
                  className="button ghost"
                  type="button"
                  disabled={disconnecting || workspace.buying}
                  onClick={async () => {
                    setDisconnecting(true);
                    try {
                      await workspace.disconnect();
                    } catch (err) {
                      notify(
                        err instanceof Error
                          ? err.message
                          : "Không thể xóa token.",
                        "error",
                      );
                    } finally {
                      setDisconnecting(false);
                    }
                  }}
                >
                  <Unplug size={15} />
                  {disconnecting ? "Đang xóa..." : "Xóa token đã lưu"}
                </button>
              )}
            </div>
          </form>
        </section>
        <section className="panel settings-panel">
          <div className="panel-heading">
            <div className="settings-title">
              <span className="settings-icon">
                <BellRing size={20} />
              </span>
              <div>
                <h2>Theo dõi OTP</h2>
                <p>Để mã xác minh tự tìm đến bạn.</p>
              </div>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>Tự động kiểm tra OTP</strong>
              <p>Cập nhật mã cho các đơn đang chờ khi tab đang mở.</p>
            </div>
            <button
              role="switch"
              aria-checked={preferences.autoPoll}
              aria-label="Tự động kiểm tra OTP"
              className={`toggle ${preferences.autoPoll ? "on" : ""}`}
              onClick={() =>
                workspace.savePreferences({
                  ...preferences,
                  autoPoll: !preferences.autoPoll,
                })
              }
            >
              <span />
            </button>
          </div>
          <div className="setting-row">
            <div>
              <strong>Chu kỳ kiểm tra</strong>
              <p>Tự dừng kiểm tra khi đã nhận OTP hoặc đơn hết hạn.</p>
            </div>
            <select
              className="setting-select"
              aria-label="Chu kỳ kiểm tra OTP"
              value={preferences.pollSeconds}
              onChange={(event) =>
                workspace.savePreferences({
                  ...preferences,
                  pollSeconds: Number(event.target.value),
                })
              }
            >
              {[5, 10, 15, 30].map((value) => (
                <option value={value} key={value}>
                  {value} giây
                </option>
              ))}
            </select>
          </div>
        </section>
        <section className="panel settings-panel">
          <div className="panel-heading">
            <div className="settings-title">
              <span className="settings-icon">
                <Play size={19} />
              </span>
              <div>
                <h2>Trải nghiệm trước khi kết nối</h2>
                <p>Thử mọi thao tác mà không cần API token.</p>
              </div>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>Chế độ dùng thử</strong>
              <p>Dữ liệu minh họa được lưu riêng, không phát sinh phí.</p>
            </div>
            <button
              className={`button small ${demo ? "primary" : "secondary"}`}
              disabled={workspace.buying}
              onClick={workspace.toggleDemo}
            >
              {demo ? "Thoát dùng thử" : "Mở bản demo"}
              <ArrowRight size={14} />
            </button>
          </div>
        </section>
        <section className="panel settings-panel">
          <div className="panel-heading">
            <div className="settings-title">
              <span className="settings-icon">
                <History size={20} />
              </span>
              <div>
                <h2>Dữ liệu & lịch sử</h2>
                <p>
                  {demo
                    ? "Dữ liệu demo trên trình duyệt này."
                    : "Lịch sử của API token hiện tại trên trình duyệt này."}
                </p>
              </div>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>Xuất lịch sử đơn hàng</strong>
              <p>Tải về số điện thoại, mã đơn, OTP và phí dạng CSV.</p>
            </div>
            <button
              className="button secondary small"
              disabled={!orders.length}
              onClick={() => exportOrders(orders)}
            >
              <ArrowDownToLine size={14} /> Xuất CSV
            </button>
          </div>
          <div className="setting-row">
            <div>
              <strong>Xóa các đơn đã kết thúc</strong>
              <p>Giữ lại toàn bộ đơn đang chờ mã OTP.</p>
            </div>
            <button
              className="button small danger-outline"
              disabled={!orders.some((order) => order.status !== "waiting")}
              onClick={onClear}
            >
              <Trash2 size={14} /> Xóa lịch sử
            </button>
          </div>
        </section>
      </div>
      <aside className="settings-aside">
        <div className="panel getting-started">
          <PhoneArtwork />
          <span className="eyebrow">KẾT NỐI TRONG MỘT PHÚT</span>
          <h3>
            Sẵn sàng cho
            <br />
            số điện thoại đầu tiên?
          </h3>
          <p>Token nằm trong mục API của mini app dvddBot trên Telegram.</p>
          <div className="aside-steps">
            <span>
              <i>1</i> Mở dvddBot & đăng nhập DVDD
            </span>
            <span>
              <i>2</i> API → Api token → Sao chép
            </span>
            <span>
              <i>3</i> Dán token & lưu kết nối
            </span>
          </div>
          <a
            className="button primary full-width telegram-launch"
            href={DVDD_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Mở dvddBot trên Telegram <ExternalLink size={14} />
          </a>
          <button className="button secondary full-width" onClick={onHelp}>
            Xem hướng dẫn <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="privacy-note">
          <ShieldCheck size={20} />
          <div>
            <strong>Không gian riêng của bạn</strong>
            <p>
              Token được bảo vệ trên máy chủ. Lịch sử và OTP chỉ lưu trên trình
              duyệt bạn đang sử dụng.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ImportOrder({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (code: string, phone: string, service: ServiceId) => void;
}) {
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [service, setService] = useState<ServiceId>("standard");
  const [error, setError] = useState("");
  return (
    <Modal
      title="Thêm đơn để theo dõi"
      description="Đã có mã đơn DVDD? Thêm vào đây để kiểm tra OTP."
      onClose={onClose}
    >
      <form
        className="import-form"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            onSubmit(code.trim(), phone.trim().replaceAll(" ", ""), service);
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Không thể thêm đơn.",
            );
          }
        }}
      >
        <label className="field-label" htmlFor="import-code">
          Mã đơn hàng <span>*</span>
        </label>
        <input
          className="text-input"
          id="import-code"
          placeholder="VD: RTFG21711264013"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          pattern="[a-zA-Z0-9_\-]{1,100}"
          maxLength={100}
          required
        />
        <label className="field-label" htmlFor="import-phone">
          Số điện thoại <span className="optional">(không bắt buộc)</span>
        </label>
        <input
          className="text-input"
          id="import-phone"
          placeholder="VD: 0333564847"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          pattern="\+?[0-9 ]{9,18}"
        />
        <label className="field-label" htmlFor="import-service">
          Dịch vụ
        </label>
        <select
          className="text-input"
          id="import-service"
          value={service}
          onChange={(event) => setService(event.target.value as ServiceId)}
        >
          <option value="standard">Số điện thoại thường</option>
          <option value="vnmb">Vietnamobile</option>
        </select>
        <p className="field-hint">
          API không trả lại phí và thời gian mua gốc. Đơn sẽ dùng thời điểm bạn
          thêm vào lịch sử.
        </p>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Quay lại
          </button>
          <button className="button primary" type="submit">
            <Plus size={15} /> Thêm mã đơn
          </button>
        </div>
      </form>
    </Modal>
  );
}

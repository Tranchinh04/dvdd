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
  ChevronDown,
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
import { Fragment, useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { exportOrders } from "@/lib/storage";
import { historyInPeriod, type HistoryPeriod } from "@/lib/history";
import {
  DVDD_BOT_URL,
  HistoryOrder,
  ServiceId,
  SERVICES,
  displayPhone,
  money,
} from "@/lib/types";
import { CopyButton, LogoMark, Modal, PhoneArtwork, StatusBadge } from "./ui";
import { OrderTable } from "./order-table";
import { AccountPanel, AccountStrip } from "./account-panel";
import { UsageAnalytics } from "./usage-analytics";
import { TopupPanel } from "./topup-panel";

type View = "buy" | "history" | "analytics" | "settings" | "account" | "topup";
type Dialog = "purchase" | "detail" | "help" | "import" | "clear" | null;
type WorkspaceState = ReturnType<typeof useWorkspace>;

const NAV_ITEMS = [
  { id: "buy", label: "Mua số điện thoại", icon: Smartphone },
  { id: "history", label: "Lịch sử đơn hàng", icon: History },
  { id: "analytics", label: "Thống kê sử dụng", icon: BarChart3 },
  { id: "account", label: "Tài khoản DVDD", icon: UserRound },
  { id: "topup", label: "Nạp tiền", icon: Wallet },
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
  const [analyticsPeriod, setAnalyticsPeriod] = useState<HistoryPeriod>("all");
  const mainRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { connection, demo, orders, notify, buying, checking, preferences } =
    workspace;
  const selected = SERVICES[service];
  const historyOrders = workspace.history.records;
  const analyticsOrders = historyInPeriod(historyOrders, analyticsPeriod);
  const accountName = workspace.account?.profile.name || "Tài khoản cá nhân";
  const initials =
    workspace.account?.profile.name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .filter((_, i, parts) => i === 0 || i === parts.length - 1)
      .join("")
      .toUpperCase() || "CN";
  const detail = historyOrders.find((order) => order.id === detailId);
  const pending = historyOrders.filter(
    (order) => order.status === "waiting",
  ).length;
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
  const showDetail = (order: { id: string }) => {
    setDetailId(order.id);
    setDialog("detail");
  };
  const buy = () => {
    if (!demo && !connection.configured) {
      navigate("account");
      return;
    }
    setDialog("purchase");
  };
  const checkHistoryOrder = (order: HistoryOrder) => {
    if (!demo && !connection.configured) navigate("settings");
    else void workspace.checkOtp(order.trackingOrder || order, true);
  };

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const update = () => {
      setMobileMode(media.matches);
      if (!media.matches) setMobileOpen(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!mobileOpen || !mobileMode) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebarRef.current
      ?.querySelector<HTMLButtonElement>(".sidebar-close")
      ?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
      }
      if (event.key === "Tab") {
        const controls = Array.from(
          sidebarRef.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled), a[href]",
          ) || [],
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", close);
      menuButtonRef.current?.focus({ preventScroll: true });
    };
  }, [mobileOpen, mobileMode]);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Đến nội dung chính
      </a>
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Đóng menu điều hướng"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        id="workspace-navigation"
        className={`sidebar ${mobileOpen ? "open" : ""}`}
        aria-label="Điều hướng chính"
        role={mobileMode && mobileOpen ? "dialog" : undefined}
        aria-modal={mobileMode && mobileOpen ? true : undefined}
        inert={mobileMode && !mobileOpen}
      >
        <div className="sidebar-heading">
          <button
            className="brand"
            onClick={() => navigate("buy")}
            aria-label="DVDD — Trang mua số"
          >
            <LogoMark />
            <span>
              dvdd<span className="brand-dot">.</span>
              <small>SỐ ĐIỆN THOẠI & OTP</small>
            </span>
          </button>
          <button
            className="icon-button sidebar-close"
            aria-label="Đóng menu"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="nav-label">DỊCH VỤ</div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <Fragment key={item.id}>
              {item.id === "account" && (
                <div className="nav-label account-nav-label">TÀI KHOẢN</div>
              )}
              <button
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
            </Fragment>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="nav-item help-nav"
            onClick={() => {
              setMobileOpen(false);
              setDialog("help");
            }}
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

      <div className="workspace-main" inert={mobileMode && mobileOpen}>
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              ref={menuButtonRef}
              className="icon-button mobile-menu"
              aria-label="Mở menu điều hướng"
              aria-expanded={mobileOpen}
              aria-controls="workspace-navigation"
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
              <h1>
                {view === "buy"
                  ? "Mua số điện thoại"
                  : view === "history"
                    ? "Lịch sử đơn hàng"
                    : view === "analytics"
                      ? "Thống kê sử dụng"
                      : view === "topup"
                        ? "Nạp tiền"
                        : view === "account"
                          ? "Tài khoản DVDD"
                          : "Cấu hình API"}
              </h1>
              <p>
                {view === "buy"
                  ? "Một nơi để mua số, nhận OTP và quản lý mọi đơn hàng."
                  : view === "history"
                    ? "Mọi số điện thoại và mã OTP, gọn gàng trong một nơi."
                    : view === "analytics"
                      ? "Nhìn lại hoạt động và chi phí từ lịch sử của bạn."
                      : view === "topup"
                        ? "Quét QR, chuyển khoản và theo dõi số dư ngay tại đây."
                        : view === "account"
                          ? "Số dư, thông tin cá nhân và lịch sử từ DVDD."
                          : "Kết nối DVDD và thiết lập cách bạn muốn làm việc."}
              </p>
            </div>
            {view === "buy" && !demo ? (
              <div className="page-heading-actions">
                <button
                  className="button secondary demo-button"
                  disabled={buying}
                  onClick={workspace.toggleDemo}
                >
                  <Play size={13} fill="currentColor" />
                  Xem bản demo
                </button>
              </div>
            ) : view === "history" ? (
              <button
                className="button primary"
                onClick={() => navigate("buy")}
              >
                <Plus size={16} /> Mua số mới
              </button>
            ) : view !== "buy" ? (
              <span className="date-chip">
                <CalendarDays size={15} />
                {new Date().toLocaleDateString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </span>
            ) : null}
          </div>

          {view === "buy" && (
            <AccountStrip
              workspace={workspace}
              onOpen={() => navigate("account")}
              onTopup={() => navigate("topup")}
            />
          )}

          {(view === "history" || view === "analytics") && (
            <>
              <div className="history-source-toolbar">
                <HistorySource
                  workspace={workspace}
                  onAccount={() => navigate("account")}
                />
                {view === "analytics" && (
                  <select
                    aria-label="Khoảng thời gian thống kê"
                    value={analyticsPeriod}
                    onChange={(event) =>
                      setAnalyticsPeriod(event.target.value as HistoryPeriod)
                    }
                  >
                    <option value="all">Toàn bộ thời gian</option>
                    <option value="7">7 ngày qua</option>
                    <option value="30">30 ngày qua</option>
                  </select>
                )}
              </div>
              <Stats
                orders={view === "analytics" ? analyticsOrders : historyOrders}
                provider={Boolean(workspace.account)}
              />
            </>
          )}

          {view === "account" && (
            <AccountPanel
              workspace={workspace}
              onTopup={() => navigate("topup")}
            />
          )}
          {view === "topup" && (
            <TopupPanel
              workspace={workspace}
              onAccount={() => navigate("account")}
            />
          )}

          {view === "buy" && (
            <>
              <div className="purchase-layout">
                <section className="panel service-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Chọn loại số điện thoại</h2>
                      <p>Thuê số mới để nhận mã OTP Shopee.</p>
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
                        <span className={`service-tag ${id}`}>
                          {id === "standard" ? (
                            <Zap size={11} fill="currentColor" />
                          ) : (
                            <Signal size={11} />
                          )}
                          {id === "standard"
                            ? "Lựa chọn phổ biến"
                            : "Nhà mạng VNMB"}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="service-footnote">
                    <CircleCheck size={15} />
                    <span>
                      Số chưa đăng ký Shopee. Phí thực tế do DVDD trả về khi mua
                      thành công.
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
                      ? "Đăng nhập để mua số"
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
                </aside>
              </div>
              <OrderTable
                orders={historyOrders}
                recent
                checking={checking}
                onCheck={checkHistoryOrder}
                onDetail={showDetail}
                onAll={() => navigate("history")}
                onImport={() => setDialog("import")}
                onBuy={() => {
                  document
                    .querySelector(".service-panel")
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                onCopyError={copyError}
                ready={
                  workspace.ready &&
                  !workspace.accountLoading &&
                  (!workspace.history.loading || historyOrders.length > 0)
                }
              />
              <div className="polling-footer">
                <span>
                  <span
                    className={`status-dot ${preferences.autoPoll ? "green" : ""}`}
                  />
                  {preferences.autoPoll
                    ? `Tự động kiểm tra OTP mỗi ${preferences.pollSeconds} giây khi tab đang mở · ${pending} đơn đang chờ`
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
                  {pending} đơn đang chờ OTP
                </span>
                <button
                  className="text-button"
                  onClick={() => {
                    if (!demo && !connection.configured) {
                      navigate("settings");
                      return;
                    }
                    for (const order of workspace.waitingOrders.slice(0, 10))
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
                orders={historyOrders}
                checking={checking}
                onCheck={checkHistoryOrder}
                onDetail={showDetail}
                onAll={() => navigate("history")}
                onImport={() => setDialog("import")}
                onBuy={() => navigate("buy")}
                onCopyError={copyError}
                ready={
                  workspace.ready &&
                  !workspace.accountLoading &&
                  (!workspace.history.loading || historyOrders.length > 0)
                }
              />
              <div className="history-footnote">
                <ShieldCheck size={15} />
                <p>
                  {workspace.account
                    ? `Gộp đơn thuê số và giao dịch DVDD theo mã đơn. ${historyOrders.filter((order) => order.ledgerOnly).length} đơn cũ chỉ còn giao dịch, có thể thiếu số điện thoại hoặc OTP. Chỉ bao gồm lịch sử DVDD còn cung cấp.`
                    : "Đơn trên máy được lưu riêng theo API token. Đăng nhập DVDD để tải thêm lịch sử tài khoản; xuất CSV để giữ bản sao."}
                </p>
              </div>
            </>
          )}

          {view === "analytics" && (
            <UsageAnalytics
              orders={analyticsOrders}
              period={analyticsPeriod}
              onBuy={() => navigate("buy")}
            />
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
              <span className="footer-dot">·</span>Quản lý số điện thoại & OTP
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
            <StatusBadge status={detail.status} label={detail.statusLabel} />
            <span className="soft-label">{detail.serviceLabel}</span>
          </div>
          <div className="detail-phone">
            <span>SỐ ĐIỆN THOẠI</span>
            <strong>
              {detail.phone
                ? displayPhone(detail.phone)
                : "Không còn dữ liệu số"}
              {detail.phone && (
                <CopyButton
                  value={displayPhone(detail.phone).replaceAll(" ", "")}
                  label="Sao chép số điện thoại"
                  onError={copyError}
                />
              )}
            </strong>
          </div>
          {detail.ledgerOnly && (
            <p className="modal-note">
              Đơn này được khôi phục từ giao dịch thuê số. DVDD không còn trả
              chi tiết số điện thoại và OTP của đơn; trạng thái chỉ xác định khi
              còn kết quả hoặc giao dịch hoàn tiền.
            </p>
          )}
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
                    : detail.status === "waiting"
                      ? "Sử dụng số điện thoại để yêu cầu gửi mã xác minh."
                      : "DVDD không còn cung cấp mã OTP của đơn này."}
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
              <dt>
                {detail.fromProvider
                  ? "Thời điểm mua tại DVDD"
                  : "Thời điểm lưu đơn"}
              </dt>
              <dd>
                {detail.createdAt
                  ? new Date(detail.createdAt).toLocaleString("vi-VN", {
                      timeZone: "Asia/Ho_Chi_Minh",
                    })
                  : `${detail.timeLabel || "Chưa rõ"} (DVDD chưa cung cấp năm)`}
              </dd>
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
                } else checkHistoryOrder(detail);
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
              Đăng nhập tại mục Tài khoản DVDD để xem số dư và lịch sử từ nhà
              cung cấp. Đơn theo dõi trên trình duyệt này có thể xuất CSV hoặc
              thêm lại bằng mã đơn.
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

function HistorySource({
  workspace,
  onAccount,
}: {
  workspace: WorkspaceState;
  onAccount: () => void;
}) {
  const { account, accountLoading, accountError, demo, history } = workspace;
  if (demo)
    return (
      <div className="history-source">
        <span className="status-dot green" /> Dữ liệu dùng thử
      </div>
    );
  if (!account)
    return (
      <div className="history-source">
        {accountLoading ? (
          <>
            <LoaderCircle size={14} className="spin" /> Đang tải tài khoản DVDD…
          </>
        ) : (
          <>
            <Layers3 size={15} />
            <span>{accountError || "Đang hiển thị đơn lưu trên máy."}</span>
            <button className="text-button" onClick={onAccount}>
              Đăng nhập để tải lịch sử DVDD <ArrowRight size={13} />
            </button>
          </>
        )}
      </div>
    );
  return (
    <div className="history-source-block">
      <div className="history-source" aria-live="polite">
        {history.loading ? (
          <LoaderCircle size={14} className="spin" />
        ) : (
          <span className="status-dot green" />
        )}
        <span>
          {history.loading
            ? `Đang đồng bộ DVDD · ${history.loaded}/${history.total} trang`
            : history.error
              ? "Lịch sử DVDD chưa đồng bộ đủ"
              : `Lịch sử DVDD · Đã đồng bộ ${history.loaded} trang`}
        </span>
        <button
          className="text-button"
          disabled={history.loading || accountLoading}
          onClick={() => void history.refresh()}
        >
          <RefreshCw size={13} /> Đồng bộ lại
        </button>
      </div>
      {(history.error || accountError) && (
        <p className="history-sync-error" role="alert">
          {history.error || accountError} Dữ liệu đã tải vẫn được giữ; các số
          tổng có thể chưa đầy đủ.
        </p>
      )}
    </div>
  );
}

function Stats({
  orders,
  provider,
}: {
  orders: HistoryOrder[];
  provider: boolean;
}) {
  const waiting = orders.filter((order) => order.status === "waiting").length;
  const received = orders.filter((order) => order.status === "received").length;
  const knownFees = orders.filter((order) => order.feeAmount !== null);
  const spend = knownFees.reduce(
    (sum, order) => sum + (order.feeAmount || 0),
    0,
  );
  const stats = [
    {
      label: "Tổng đơn đã tải",
      value: String(orders.length).padStart(2, "0"),
      icon: Smartphone,
      className: "purple",
      note: provider
        ? "Từ lịch sử DVDD và đơn trên máy"
        : "Đã lưu trên trình duyệt này",
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
      label: "Phí thuê ghi nhận",
      value: orders.length && !knownFees.length ? "—" : money(spend),
      icon: Wallet,
      className: "blue",
      note:
        orders.length > knownFees.length
          ? `${knownFees.length}/${orders.length} đơn có dữ liệu phí`
          : provider
            ? "Đã trừ các khoản hoàn ghi nhận"
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
          <details className="token-onboarding">
            <summary>
              Lấy API token ở đâu? <ChevronDown size={15} />
            </summary>
            <div className="token-onboarding-heading">
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
          </details>
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
              Token dùng để mua số và lấy OTP. Đăng nhập DVDD để xem thêm số dư
              và lịch sử tài khoản.
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
          <span className="settings-icon">
            <CircleHelp size={21} />
          </span>
          <h3>Bạn cần hỗ trợ?</h3>
          <p>
            Lấy token, đăng ký và nạp tiền trong mini app của @dvddBot trên
            Telegram.
          </p>
          <a
            className="button secondary full-width telegram-launch"
            href={DVDD_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Mở dvddBot <ExternalLink size={14} />
          </a>
          <button className="text-button" onClick={onHelp}>
            Xem hướng dẫn <ArrowUpRight size={14} />
          </button>
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

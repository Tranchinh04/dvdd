"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClientError, postApi } from "@/lib/client-api";
import { demoOrders, readOrders } from "@/lib/storage";
import { useHistory } from "./use-history";
import {
  Connection,
  AccountResponse,
  DvddAccount,
  HistoryOrder,
  Order,
  Preferences,
  ServiceId,
  SERVICES,
  parseFee,
} from "@/lib/types";

export type Notice = {
  id: number;
  message: string;
  type: "success" | "error" | "info";
};
const EMPTY_CONNECTION: Connection = {
  configured: false,
  source: null,
  accountId: null,
};

export function useWorkspace() {
  const [connection, setConnection] = useState<Connection>(EMPTY_CONNECTION);
  const [connectionLoaded, setConnectionLoaded] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [accountData, setAccountData] = useState<DvddAccount | null>(null);
  const [accountScope, setAccountScope] = useState("");
  const [accountError, setAccountError] = useState("");
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const accountRequest = useRef(0);
  const accountPage = useRef(1);
  const accountController = useRef<AbortController | null>(null);
  const [demo, setDemo] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [storageReady, setStorageReady] = useState("");
  const [preferences, setPreferences] = useState<Preferences>({
    autoPoll: true,
    pollSeconds: 5,
  });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [buying, setBuying] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");
  const [checking, setChecking] = useState<string[]>([]);
  const busyBuying = useRef(false);
  const inFlight = useRef(new Set<string>());
  const observedOrders = useRef({
    scope: "",
    statuses: new Map<string, HistoryOrder["status"]>(),
  });
  const waitingOrdersRef = useRef<HistoryOrder[]>([]);
  const scopeRef = useRef("");
  const key = demo
    ? "dvdd.orders.demo.v1"
    : `dvdd.orders.live.v1.${connection.accountId || "unconfigured"}`;
  scopeRef.current = key;
  const notify = useCallback(
    (message: string, type: Notice["type"] = "success") => {
      setNotice({ id: Date.now(), message, type });
    },
    [],
  );

  const refreshConnection = useCallback(async () => {
    try {
      const response = await fetch("/api/connection", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data: Connection = await response.json();
      setConnection(data);
      setConnectionError("");
      return data;
    } catch {
      setConnectionError("Chưa tải được cấu hình kết nối. Hãy tải lại trang.");
      return null;
    } finally {
      setConnectionLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refreshConnection();
  }, [refreshConnection]);

  const refreshAccount = useCallback(async (page = accountPage.current) => {
    const scope = scopeRef.current;
    if (scope === "dvdd.orders.demo.v1") return;
    const requestId = ++accountRequest.current;
    accountController.current?.abort();
    const controller = new AbortController();
    accountController.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30_000);
    setAccountLoading(true);
    try {
      const response = await fetch(`/api/account?page=${page}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const result = await response.json();
      if (scope !== scopeRef.current || requestId !== accountRequest.current)
        return;
      if (!response.ok || result.success === false) {
        if (result.code === "ACCOUNT_SESSION_EXPIRED") setAccountData(null);
        throw new Error(result.message || "Không tải được tài khoản DVDD.");
      }
      const data = result as AccountResponse;
      setAccountData(data.connected && data.data ? data.data : null);
      setAccountScope(scope);
      setAccountError("");
      accountPage.current = data.data?.transactionPage || 1;
    } catch (error) {
      if (scope !== scopeRef.current || requestId !== accountRequest.current)
        return;
      setAccountError(
        error instanceof Error && error.name !== "AbortError"
          ? error.message
          : "Chưa tải được tài khoản DVDD. Hãy thử làm mới.",
      );
    } finally {
      clearTimeout(timeout);
      if (scope === scopeRef.current && requestId === accountRequest.current)
        setAccountLoading(false);
    }
  }, []);

  useEffect(() => {
    accountPage.current = 1;
    setAccountError("");
    if (connectionLoaded && !demo) void refreshAccount(1);
    return () => {
      accountRequest.current++;
      accountController.current?.abort();
    };
  }, [connectionLoaded, key, demo, refreshAccount]);

  const expireAccount = useCallback(() => {
    accountRequest.current++;
    accountController.current?.abort();
    setAccountData(null);
    setAccountScope("");
    setAccountLoading(false);
    setAccountError(
      "Phiên đăng nhập DVDD đã hết hạn. Đăng nhập lại để tải lịch sử.",
    );
  }, []);
  const account = !demo && accountScope === key ? accountData : null;
  const history = useHistory(
    account,
    key,
    storageReady === key ? orders : [],
    expireAccount,
  );
  const waitingOrders = history.records.filter(
    (order) => order.status === "waiting",
  );
  waitingOrdersRef.current = waitingOrders;
  const recordProviderCheck = history.recordCheck;

  useEffect(() => {
    if (storageReady !== key) return;
    const previous =
      observedOrders.current.scope === key
        ? observedOrders.current.statuses
        : null;
    observedOrders.current = {
      scope: key,
      statuses: new Map(
        history.records.map((order) => [order.orderCode, order.status]),
      ),
    };
    if (!previous) return;
    const received = history.records.filter(
      (order) =>
        previous.get(order.orderCode) === "waiting" &&
        order.status === "received",
    );
    const expired = history.records.filter(
      (order) =>
        previous.get(order.orderCode) === "waiting" &&
        order.status === "expired",
    );
    const added = history.records.filter(
      (order) =>
        (!previous.has(order.orderCode) ||
          previous.get(order.orderCode) === "unknown") &&
        order.status === "waiting" &&
        !order.trackingOrder,
    );
    const messages: string[] = [];
    if (received.length)
      messages.push(
        received.length === 1
          ? `Đã nhận OTP cho số ${received[0].phone || received[0].orderCode}.`
          : `Đã nhận OTP cho ${received.length} đơn hàng.`,
      );
    if (expired.length)
      messages.push(
        expired.length === 1
          ? `Đơn ${expired[0].orderCode} đã hết hạn.`
          : `${expired.length} đơn hàng đã hết hạn.`,
      );
    if (added.length)
      messages.push(
        added.length === 1
          ? `Có đơn thuê số mới ${added[0].orderCode}, đang chờ OTP.`
          : `Có ${added.length} đơn thuê số mới đang chờ OTP.`,
      );
    if (messages.length)
      notify(messages.join(" "), received.length ? "success" : "info");
  }, [history.records, key, storageReady, notify]);

  useEffect(() => {
    if (!account || storageReady !== key) return;
    const resolved = new Map(
      history.records
        .filter(
          (order) =>
            order.fromProvider &&
            (order.status === "received" || order.status === "expired"),
        )
        .map((order) => [order.orderCode, order]),
    );
    setOrders((previous) => {
      let changed = false;
      const next = previous.map((order) => {
        const remote = resolved.get(order.orderCode);
        if (!remote || order.status !== "waiting") return order;
        changed = true;
        return {
          ...order,
          status: remote.status as "received" | "expired",
          otp: remote.otp || order.otp,
          lastError: undefined,
        };
      });
      return changed ? next : previous;
    });
  }, [account, history.records, storageReady, key]);

  useEffect(() => {
    if (!account || demo) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refreshAccount();
    }, 60_000);
    return () => clearInterval(timer);
  }, [Boolean(account), demo, refreshAccount]);

  async function login(email: string, password: string) {
    if (busyBuying.current || accountBusy) return;
    setAccountBusy(true);
    accountController.current?.abort();
    accountRequest.current++;
    try {
      const result = await postApi<AccountResponse>("/api/account", {
        email,
        password,
      });
      if (!result.connection || !result.data)
        throw new Error("DVDD chưa trả đủ thông tin tài khoản.");
      setConnection(result.connection);
      setAccountData(result.data);
      setAccountScope(`dvdd.orders.live.v1.${result.connection.accountId}`);
      setAccountError("");
      setDemo(false);
      notify("Đã đăng nhập DVDD, kết nối API và tải dữ liệu tài khoản.");
    } finally {
      setAccountBusy(false);
      setAccountLoading(false);
    }
  }

  async function logout() {
    const response = await fetch("/api/account", { method: "DELETE" });
    if (!response.ok) throw new Error("Chưa đăng xuất được. Vui lòng thử lại.");
    accountRequest.current++;
    accountController.current?.abort();
    setAccountData(null);
    setAccountScope("");
    setAccountError("");
    setAccountLoading(false);
    await refreshConnection();
    notify("Đã đăng xuất phiên DVDD trên trình duyệt này.");
  }

  useEffect(() => {
    if (!connectionLoaded) return;
    try {
      const raw = localStorage.getItem(key);
      setOrders(raw ? readOrders(raw) : demo ? demoOrders() : []);
    } catch {
      setOrders([]);
      notify(
        "Không đọc được lịch sử trên trình duyệt này. Bạn có thể thêm lại đơn bằng mã đơn hàng.",
        "error",
      );
    }
    setStorageReady(key);
  }, [connectionLoaded, key, demo, notify]);

  useEffect(() => {
    if (storageReady !== key) return;
    try {
      localStorage.setItem(key, JSON.stringify(orders));
    } catch {
      notify(
        "Trình duyệt chưa lưu được lịch sử. Hãy xuất CSV để giữ thông tin đơn.",
        "error",
      );
    }
  }, [orders, key, storageReady, notify]);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== key) return;
      try {
        setOrders(readOrders(event.newValue));
      } catch {
        /* Keep the last valid local state. */
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key]);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("dvdd.preferences.v1") || "null",
      );
      if (
        saved &&
        typeof saved.autoPoll === "boolean" &&
        [5, 10, 15, 30].includes(saved.pollSeconds)
      )
        setPreferences(saved);
    } catch {
      /* Defaults remain usable. */
    }
  }, []);

  const savePreferences = (next: Preferences) => {
    setPreferences(next);
    try {
      localStorage.setItem("dvdd.preferences.v1", JSON.stringify(next));
    } catch {
      notify(
        "Đã áp dụng cài đặt cho phiên này; trình duyệt không cho phép lưu lâu dài.",
        "info",
      );
    }
  };

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(
      () => setNotice(null),
      notice.type === "error" ? 8500 : 4000,
    );
    return () => clearTimeout(timer);
  }, [notice]);

  const checkOtp = useCallback(
    async (order: Order | HistoryOrder, manual = false) => {
      if (
        order.status !== "waiting" ||
        inFlight.current.has(order.orderCode) ||
        (!demo && !connection.configured)
      )
        return;
      const scope = scopeRef.current;
      inFlight.current.add(order.orderCode);
      setChecking((previous) => [...previous, order.orderCode]);
      try {
        const result = demo
          ? await new Promise<{ otp: string }>((resolve) =>
              setTimeout(
                () =>
                  resolve({
                    otp:
                      Date.now() - Date.parse(order.createdAt || "1970-01-01") >
                      15_000
                        ? "582491"
                        : "",
                  }),
                500,
              ),
            )
          : await postApi<{ success: true; otp: string }>("/api/otp", {
              orderCode: order.orderCode,
            });
        if (scope !== scopeRef.current) return;
        const update = {
          otp: result.otp,
          status: result.otp ? ("received" as const) : ("waiting" as const),
          lastCheckedAt: new Date().toISOString(),
          lastError: undefined,
        };
        recordProviderCheck(scope, order.orderCode, update);
        setOrders((previous) =>
          previous.map((item) =>
            item.orderCode === order.orderCode && item.status === "waiting"
              ? {
                  ...item,
                  ...update,
                }
              : item,
          ),
        );
        if (!result.otp && manual)
          notify(
            "Chưa có OTP. Hệ thống sẽ tiếp tục theo dõi khi bật tự động.",
            "info",
          );
      } catch (error) {
        if (scope !== scopeRef.current) return;
        const message =
          error instanceof Error ? error.message : "Không kiểm tra được OTP.";
        const expired =
          error instanceof ClientError && error.code === "ORDER_EXPIRED";
        const lastCheckedAt = new Date().toISOString();
        recordProviderCheck(scope, order.orderCode, {
          status: expired ? "expired" : "waiting",
          otp: "",
          lastError: message,
          lastCheckedAt,
        });
        setOrders((previous) =>
          previous.map((item) =>
            item.orderCode === order.orderCode && item.status === "waiting"
              ? {
                  ...item,
                  status: expired ? "expired" : item.status,
                  lastError: message,
                  lastCheckedAt,
                }
              : item,
          ),
        );
        if (manual && !expired) notify(message, "error");
      } finally {
        inFlight.current.delete(order.orderCode);
        setChecking((previous) =>
          previous.filter((code) => code !== order.orderCode),
        );
      }
    },
    [demo, connection.configured, notify, recordProviderCheck],
  );

  useEffect(() => {
    if (
      !preferences.autoPoll ||
      (!demo && !connection.configured) ||
      storageReady !== key
    )
      return;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const due = waitingOrdersRef.current
        .filter(
          (order) =>
            order.status === "waiting" &&
            !inFlight.current.has(order.orderCode) &&
            Date.now() - Date.parse(order.lastCheckedAt || "1970-01-01") >=
              (order.lastError
                ? Math.max(30, preferences.pollSeconds)
                : preferences.pollSeconds) *
                1000,
        )
        .sort(
          (a, b) =>
            Date.parse(a.lastCheckedAt || "1970-01-01") -
            Date.parse(b.lastCheckedAt || "1970-01-01"),
        );
      for (const order of due.slice(0, 3)) void checkOtp(order);
    }, 1000);
    return () => clearInterval(timer);
  }, [preferences, demo, connection.configured, checkOtp, storageReady, key]);

  async function buy(service: ServiceId) {
    if (busyBuying.current || storageReady !== key) return null;
    const scope = scopeRef.current;
    busyBuying.current = true;
    setBuying(true);
    setPurchaseError("");
    try {
      const result = demo
        ? await new Promise<{
            data: { phone: string; orderCode: string };
            fee: string;
          }>((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: {
                    phone: `09${String(Math.floor(Math.random() * 100_000_000)).padStart(8, "0")}`,
                    orderCode: `DEMO${Date.now()}`,
                  },
                  fee: `${SERVICES[service].price}đ`,
                }),
              800,
            ),
          )
        : await postApi<{
            success: true;
            data: { phone: string; orderCode: string };
            fee: string | null;
          }>("/api/phone", { service });
      const order: Order = {
        id: crypto.randomUUID(),
        ...result.data,
        service,
        fee: result.fee || "Chưa có dữ liệu",
        feeAmount: result.fee ? parseFee(result.fee) : null,
        status: "waiting",
        otp: "",
        createdAt: new Date().toISOString(),
      };
      if (scope !== scopeRef.current) {
        // A completed billable request must still be retained if the user changes view or mode.
        const previous = readOrders(localStorage.getItem(scope));
        localStorage.setItem(scope, JSON.stringify([order, ...previous]));
        notify(
          "Đã mua số. Đơn được lưu trong lịch sử của tài khoản đã thực hiện yêu cầu.",
        );
        return null;
      }
      setOrders((previous) =>
        previous.some((item) => item.orderCode === order.orderCode)
          ? previous
          : [order, ...previous],
      );
      notify(
        demo
          ? "Đã tạo đơn dùng thử. Không phát sinh chi phí."
          : "Mua số thành công. Đang chờ OTP.",
      );
      if (!demo && account) void refreshAccount();
      return order;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Không thể mua số. Vui lòng thử lại.";
      setPurchaseError(message);
      notify(message, "error");
      return null;
    } finally {
      busyBuying.current = false;
      setBuying(false);
    }
  }

  async function saveToken(apiKey: string) {
    await postApi("/api/connection", { apiKey });
    accountRequest.current++;
    accountController.current?.abort();
    setAccountData(null);
    setAccountScope("");
    setAccountError("");
    setAccountLoading(false);
    await refreshConnection();
    setDemo(false);
    notify(
      "Đã lưu API token. DVDD sẽ xác thực tài khoản khi bạn sử dụng dịch vụ.",
    );
  }

  async function disconnect() {
    const response = await fetch("/api/connection", { method: "DELETE" });
    if (!response.ok)
      throw new Error("Không thể xóa cấu hình. Vui lòng thử lại.");
    accountRequest.current++;
    accountController.current?.abort();
    setAccountData(null);
    setAccountScope("");
    setAccountError("");
    setAccountLoading(false);
    const next = await refreshConnection();
    notify(
      next?.configured
        ? "Đã xóa token của phiên. Ứng dụng đang sử dụng token từ máy chủ."
        : "Đã xóa token của phiên này.",
    );
  }

  function toggleDemo() {
    if (buying || accountBusy) return;
    setDemo((value) => !value);
    setPurchaseError("");
    notify(
      demo
        ? "Đã chuyển sang dữ liệu thật."
        : "Đang dùng dữ liệu minh họa. Mọi thao tác đều miễn phí.",
      "info",
    );
  }

  function addOrder(orderCode: string, phone: string, service: ServiceId) {
    if (orders.some((order) => order.orderCode === orderCode))
      throw new Error("Mã đơn này đã có trong lịch sử.");
    const order: Order = {
      id: crypto.randomUUID(),
      orderCode,
      phone,
      service,
      fee: "Chưa có dữ liệu",
      feeAmount: null,
      createdAt: new Date().toISOString(),
      status: "waiting",
      otp: "",
      imported: true,
    };
    setOrders((previous) => [order, ...previous]);
    notify(
      "Đã thêm đơn để theo dõi. Phí và thời điểm mua gốc không được API cung cấp.",
      "info",
    );
    return order;
  }

  return {
    connection,
    connectionLoaded,
    connectionError,
    account,
    accountError: demo ? "" : accountError,
    accountLoading,
    accountBusy,
    refreshAccount,
    expireAccount,
    login,
    logout,
    demo,
    orders,
    waitingOrders,
    history,
    preferences,
    notice,
    setNotice,
    buying,
    purchaseError,
    checking,
    notify,
    buy,
    checkOtp,
    saveToken,
    disconnect,
    toggleDemo,
    savePreferences,
    addOrder,
    clearHistory: () =>
      setOrders((previous) =>
        previous.filter((order) => order.status === "waiting"),
      ),
    ready: connectionLoaded && storageReady === key,
  };
}

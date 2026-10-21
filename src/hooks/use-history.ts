"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mergeHistory } from "@/lib/history";
import type { DvddAccount, HistoryPage, Order } from "@/lib/types";

type CachedPage = { data: HistoryPage; at: number };
type Snapshot = {
  scope: string;
  pages: Record<string, CachedPage>;
  loading: boolean;
  loaded: number;
  total: number;
  error: string;
  syncedAt: string | null;
};
const empty: Snapshot = {
  scope: "",
  pages: {},
  loading: false,
  loaded: 0,
  total: 0,
  error: "",
  syncedAt: null,
};
const pageKey = (kind: HistoryPage["kind"], page: number) => `${kind}:${page}`;

function seed(pages: Snapshot["pages"], account: DvddAccount) {
  const result = { ...pages };
  const at = Date.parse(account.updatedAt) || 0;
  const add = (data: HistoryPage) => {
    const key = pageKey(data.kind, data.page);
    if (!result[key] || result[key].at < at) result[key] = { data, at };
  };
  if (account.orders !== null)
    add({
      kind: "phones",
      page: 1,
      pages: account.phonePages || 1,
      rows: account.orders,
    });
  if (account.transactions !== null)
    add({
      kind: "transactions",
      page: account.transactionPage,
      pages: account.transactionPages,
      rows: account.transactions,
    });
  return result;
}

export function useHistory(
  account: DvddAccount | null,
  scope: string,
  local: Order[],
  onSessionExpired: () => void,
) {
  const [snapshot, setSnapshot] = useState<Snapshot>(empty);
  const cache = useRef(empty);
  const controller = useRef<AbortController | null>(null);
  const request = useRef(0);
  const current = useRef({ account, scope, onSessionExpired });
  current.current = { account, scope, onSessionExpired };
  const activeScope = account ? scope : "";

  const sync = useCallback(async (force = true) => {
    const { account, scope } = current.current;
    if (!account) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const id = ++request.current;
    const valid = () =>
      !abort.signal.aborted &&
      request.current === id &&
      current.current.scope === scope &&
      Boolean(current.current.account);
    const previous =
      cache.current.scope === scope ? cache.current : { ...empty, scope };
    let pages = seed(previous.pages, account);
    const fresh: Snapshot["pages"] = {};
    const jobs: { kind: HistoryPage["kind"]; page: number }[] = [];
    const queued = new Set<string>();
    let loaded = 0;
    const errors: string[] = [];
    let sessionLost = false;
    const enqueue = (kind: HistoryPage["kind"], count: number) => {
      for (let page = 1; page <= Math.min(1000, count); page++) {
        const key = pageKey(kind, page);
        if (!queued.has(key)) {
          queued.add(key);
          jobs.push({ kind, page });
        }
      }
    };
    enqueue("phones", account.phonePages || 1);
    enqueue("transactions", account.transactionPages);
    const publish = (loading: boolean) => {
      if (!valid()) return;
      const next: Snapshot = {
        scope,
        pages,
        loading,
        loaded,
        total: queued.size,
        error: errors.length
          ? `${errors[0]}${errors.length > 1 ? ` (${errors.length} trang chưa tải được)` : ""}`
          : "",
        syncedAt:
          !loading && !errors.length
            ? new Date().toISOString()
            : previous.syncedAt,
      };
      cache.current = next;
      setSnapshot(next);
    };
    publish(true);
    // Only two read-only supplier requests at a time. Page one supplies the
    // pagination boundary; newly advertised pages are appended to the queue.
    while (jobs.length && valid() && !sessionLost) {
      const batch = jobs.splice(0, 2);
      await Promise.all(
        batch.map(async ({ kind, page }) => {
          const key = pageKey(kind, page);
          try {
            let cached = pages[key];
            const isSeed =
              kind === "phones"
                ? page === 1 && account.orders !== null
                : page === account.transactionPage &&
                  account.transactions !== null;
            if (force || !isSeed || !cached) {
              const response = await fetch(
                `/api/history?kind=${kind}&page=${page}`,
                {
                  cache: "no-store",
                  signal: AbortSignal.any([
                    abort.signal,
                    AbortSignal.timeout(25_000),
                  ]),
                },
              );
              const result = await response.json();
              if (!valid()) return;
              if (!response.ok || result.success === false) {
                if (result.code === "ACCOUNT_SESSION_EXPIRED") {
                  sessionLost = true;
                  current.current.onSessionExpired();
                  throw new Error(
                    "Phiên DVDD đã hết hạn. Đăng nhập lại để tiếp tục đồng bộ.",
                  );
                }
                throw new Error(
                  result.message || "Chưa tải được lịch sử DVDD.",
                );
              }
              const data = result.data as HistoryPage;
              if (
                data.kind !== kind ||
                data.page !== page ||
                !Array.isArray(data.rows) ||
                !Number.isInteger(data.pages) ||
                data.pages < page ||
                data.pages > 1000
              )
                throw new Error("DVDD trả về trang lịch sử không hợp lệ.");
              cached = { data, at: Date.now() };
            }
            if (!valid()) return;
            fresh[key] = cached;
            pages = { ...pages, [key]: cached };
            enqueue(kind, cached.data.pages);
            loaded++;
          } catch (error) {
            if (!valid()) return;
            errors.push(
              `${kind === "phones" ? "Thuê số" : "Giao dịch"}, trang ${page}: ${error instanceof Error && error.name !== "TimeoutError" ? error.message : "Kết nối quá hạn. Hãy thử đồng bộ lại."}`,
            );
          }
        }),
      );
      publish(true);
    }
    if (!errors.length) pages = fresh;
    publish(false);
  }, []);

  useEffect(() => {
    if (activeScope) void sync(false);
    else {
      cache.current = empty;
      setSnapshot(empty);
    }
    return () => {
      request.current++;
      controller.current?.abort();
    };
  }, [activeScope, sync]);

  const pages = useMemo(
    () =>
      account
        ? seed(snapshot.scope === scope ? snapshot.pages : {}, account)
        : {},
    [account, scope, snapshot.pages, snapshot.scope],
  );
  const records = useMemo(() => {
    const all = Object.values(pages).map((page) => page.data);
    const phones = all.flatMap((page) =>
      page.kind === "phones" ? page.rows : [],
    );
    const transactions = all.flatMap((page) =>
      page.kind === "transactions" ? page.rows : [],
    );
    return mergeHistory(local, phones, transactions);
  }, [local, pages]);
  return {
    records,
    loading: Boolean(account) && (snapshot.scope !== scope || snapshot.loading),
    loaded: snapshot.scope === scope ? snapshot.loaded : 0,
    total: snapshot.scope === scope ? snapshot.total : 0,
    error: snapshot.scope === scope ? snapshot.error : "",
    syncedAt: snapshot.scope === scope ? snapshot.syncedAt : null,
    refresh: sync,
  };
}

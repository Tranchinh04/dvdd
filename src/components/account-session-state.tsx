"use client";

import { CircleAlert, LoaderCircle, RefreshCw } from "lucide-react";
import type { useWorkspace } from "@/hooks/use-workspace";

export function AccountSessionState({
  workspace,
}: {
  workspace: ReturnType<typeof useWorkspace>;
}) {
  const error = workspace.accountError || workspace.connectionError;
  const loading = workspace.accountLoading || !workspace.connectionLoaded;
  return (
    <section
      className="panel account-session-state"
      aria-label="Khôi phục phiên đăng nhập"
      aria-busy={loading}
    >
      <span className="settings-icon">
        {error && !loading ? (
          <CircleAlert size={22} />
        ) : (
          <LoaderCircle size={22} className="spin" />
        )}
      </span>
      <div>
        <h2>
          {error && !loading
            ? "Chưa khôi phục được tài khoản"
            : "Đang khôi phục phiên đăng nhập"}
        </h2>
        {error && !loading ? (
          <p role="alert">{error}</p>
        ) : (
          <p role="status">Đang kiểm tra phiên đã lưu và tải dữ liệu DVDD.</p>
        )}
      </div>
      {error && !loading && (
        <button
          className="button secondary small"
          onClick={() => {
            if (workspace.connectionError) void workspace.refreshConnection();
            else void workspace.refreshAccount();
          }}
        >
          <RefreshCw size={15} /> Thử khôi phục lại
        </button>
      )}
    </section>
  );
}

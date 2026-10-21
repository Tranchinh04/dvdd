"use client";

import { Check, CheckCheck, Copy, Hourglass, Inbox, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { HistoryStatus } from "@/lib/types";

export function LogoMark({ small = false }: { small?: boolean }) {
  return (
    <span className={`logo-mark ${small ? "small" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 36 36" fill="none">
        <path
          d="M11 8v15a6.5 6.5 0 0 0 13 0V14M11 17h13"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <circle cx="26" cy="8.5" r="2.5" fill="currentColor" opacity=".6" />
      </svg>
    </span>
  );
}

export function CopyButton({
  value,
  label = "Sao chép",
  onError,
}: {
  value: string;
  label?: string;
  onError?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timeout);
  }, [copied]);
  return (
    <button
      className={`icon-button copy-button ${copied ? "copied" : ""}`}
      aria-label={copied ? "Đã sao chép" : label}
      title={copied ? "Đã sao chép" : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          onError?.();
        }
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

export function StatusBadge({
  status,
  label,
}: {
  status: HistoryStatus;
  label?: string;
}) {
  return (
    <span className={`status-badge ${status}`}>
      {status === "waiting" ? (
        <Hourglass size={11} />
      ) : status === "received" ? (
        <CheckCheck size={12} />
      ) : (
        <span className="status-dot" />
      )}
      {label ||
        (status === "waiting"
          ? "Đang chờ OTP"
          : status === "received"
            ? "Đã nhận OTP"
            : status === "expired"
              ? "Đã hết hạn"
              : "Chưa rõ trạng thái")}
    </span>
  );
}

export function Modal({
  title,
  description,
  children,
  onClose,
  dismissible = true,
  wide = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  dismissible?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && dismissible) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Đóng hộp thoại"
            disabled={!dismissible}
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Inbox size={25} strokeWidth={1.5} />
        <span />
        <span />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function PhoneArtwork() {
  return (
    <svg
      className="phone-artwork"
      viewBox="0 0 180 180"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="92" cy="90" r="70" fill="#edf6ef" />
      <circle cx="92" cy="90" r="53" stroke="#d2e5d5" strokeDasharray="3 6" />
      <g transform="rotate(10 89 90)">
        <rect x="61" y="35" width="61" height="114" rx="13" fill="#a6c6af" />
        <rect
          x="57"
          y="32"
          width="61"
          height="114"
          rx="13"
          fill="white"
          stroke="#79a98b"
          strokeWidth="2"
        />
        <path
          d="M77 33h22v5a4 4 0 0 1-4 4H81a4 4 0 0 1-4-4v-5Z"
          fill="#79a98b"
        />
        <rect x="66" y="54" width="43" height="59" rx="6" fill="#f4f9f3" />
        <rect x="77" y="65" width="22" height="22" rx="7" fill="#ddeee0" />
        <path
          d="m81 76 5 5 9-10"
          stroke="#287c56"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="72" y="96" width="31" height="3" rx="1.5" fill="#bdd9c4" />
        <rect x="79" y="102" width="17" height="3" rx="1.5" fill="#deebdf" />
        <path
          d="M82 135h12"
          stroke="#c6dacb"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
      <rect
        x="20"
        y="87"
        width="70"
        height="35"
        rx="9"
        fill="white"
        stroke="#dfebdf"
      />
      <circle cx="34" cy="104" r="7" fill="#e8f5ef" />
      <path
        d="m31 104 2 2 4-4"
        stroke="#4a9b7c"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {[47, 54, 61, 68, 75].map((x) => (
        <circle key={x} cx={x} cy="104" r="2" fill="#749e7c" />
      ))}
      <path
        d="M139 46v10m-5-5h10"
        stroke="#a3c6ac"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="32" cy="61" r="3" fill="#c2dbc6" />
      <circle cx="140" cy="129" r="4" fill="#a7c6ad" />
    </svg>
  );
}

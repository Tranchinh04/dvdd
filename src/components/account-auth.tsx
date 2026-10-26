"use client";

import { useId, useRef, useState } from "react";
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LogIn,
  Mail,
  Phone,
  ShieldCheck,
  UserPlus,
  UserRound,
} from "lucide-react";
import type { useWorkspace } from "@/hooks/use-workspace";
import { ClientError } from "@/lib/client-api";
import { validateRegistration } from "@/lib/registration";
import {
  DVDD_WEB_URL,
  type RegistrationInput,
  type RegistrationResponse,
} from "@/lib/types";

type Props = { workspace: ReturnType<typeof useWorkspace> };

export function AccountAuth({ workspace }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fields, setFields] = useState<RegistrationInput>({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [completed, setCompleted] = useState<RegistrationResponse | null>(null);
  const submitting = useRef(false);
  const id = useId();
  const registration = mode === "register";
  const busy = workspace.accountBusy || workspace.buying;
  function switchMode(next: typeof mode) {
    if (busy || submitting.current) return;
    setMode(next);
    setError("");
    setErrorCode("");
    setCompleted(null);
    setVisible(false);
    setFields((old) => ({ ...old, password: "", confirmPassword: "" }));
  }
  function field(
    name: keyof RegistrationInput,
    label: string,
    options: {
      type?: string;
      autoComplete?: string;
      placeholder?: string;
      maxLength?: number;
    } = {},
  ) {
    const password = name === "password" || name === "confirmPassword";
    const Icon =
      name === "name"
        ? UserRound
        : name === "email"
          ? Mail
          : name === "phone"
            ? Phone
            : KeyRound;
    return (
      <div className={`auth-field auth-field-${name}`}>
        <label className="field-label" htmlFor={`${id}-${name}`}>
          {label} <span>*</span>
        </label>
        <div className="token-input">
          <Icon size={17} />
          <input
            id={`${id}-${name}`}
            name={name}
            type={
              password
                ? visible
                  ? "text"
                  : "password"
                : options.type || "text"
            }
            autoComplete={options.autoComplete}
            placeholder={options.placeholder}
            value={fields[name]}
            maxLength={
              options.maxLength || (password ? (registration ? 128 : 512) : 100)
            }
            disabled={busy}
            required
            spellCheck={name === "name" ? undefined : false}
            onChange={(event) =>
              setFields((old) => ({ ...old, [name]: event.target.value }))
            }
          />
          {password && (
            <button
              type="button"
              className="icon-button"
              disabled={busy}
              aria-label={`${visible ? "Ẩn" : "Hiện"} ${name === "confirmPassword" ? "mật khẩu nhập lại" : "mật khẩu DVDD"}`}
              onClick={() => setVisible((old) => !old)}
            >
              {visible ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          )}
        </div>
        {registration && name === "password" && (
          <p className="auth-field-hint">Từ 8 đến 128 ký tự.</p>
        )}
      </div>
    );
  }
  return (
    <section
      className={`panel account-login ${registration ? "account-registration" : ""}`}
    >
      <div className="panel-heading">
        <div className="settings-title">
          <span className="settings-icon">
            {registration ? <UserPlus size={21} /> : <UserRound size={21} />}
          </span>
          <div>
            <h2>
              {registration ? "Tạo tài khoản DVDD" : "Đăng nhập tài khoản DVDD"}
            </h2>
            <p>
              {registration
                ? "Tạo tài khoản để nạp tiền, mua số và quản lý OTP tại đây."
                : "Dùng tài khoản bạn đã đăng ký trong mini app @dvddBot."}
            </p>
          </div>
        </div>
      </div>
      <div
        className="auth-tabs"
        role="tablist"
        aria-label="Truy cập tài khoản DVDD"
      >
        <button
          type="button"
          role="tab"
          id={`${id}-login-tab`}
          aria-selected={!registration}
          aria-controls={`${id}-panel`}
          disabled={busy}
          onClick={() => switchMode("login")}
        >
          Đăng nhập
        </button>
        <button
          type="button"
          role="tab"
          id={`${id}-register-tab`}
          aria-selected={registration}
          aria-controls={`${id}-panel`}
          disabled={busy}
          onClick={() => switchMode("register")}
        >
          Đăng ký
        </button>
      </div>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${mode}-tab`}
      >
        {completed ? (
          <div className="registration-complete" role="status">
            <span className="registration-complete-icon">
              <CircleCheck size={27} />
            </span>
            <h3>Tài khoản đã được xác minh</h3>
            <p className="registration-email">{fields.email}</p>
            <p>{completed.message}</p>
            {completed.requiresToken && (
              <ol>
                <li>Mở DVDD và đăng nhập bằng tài khoản vừa tạo.</li>
                <li>
                  Vào <strong>API</strong>, chọn <strong>Tạo mới</strong> nếu ô
                  token đang trống.
                </li>
                <li>
                  Quay lại đây và đăng nhập để kết nối số dư, lịch sử và nạp
                  tiền.
                </li>
              </ol>
            )}
            <div className="registration-next-actions">
              {completed.requiresToken && (
                <a
                  className="button secondary"
                  href={`${DVDD_WEB_URL}/dashboard?page=api`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <KeyRound size={15} /> Mở mục API DVDD{" "}
                  <ExternalLink size={13} />
                </a>
              )}
              <button
                className="button primary"
                type="button"
                onClick={() => switchMode("login")}
              >
                Đăng nhập để kết nối <ArrowRight size={15} />
              </button>
            </div>
          </div>
        ) : (
          <form
            noValidate={registration}
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy || submitting.current) return;
              setError("");
              setErrorCode("");
              if (registration) {
                const parsed = validateRegistration(fields);
                if (!parsed.data) {
                  setError(parsed.error);
                  document.getElementById(`${id}-${parsed.field}`)?.focus();
                  return;
                }
              }
              submitting.current = true;
              try {
                if (registration) {
                  const result = await workspace.register(fields);
                  if (!result.connected) setCompleted(result);
                } else await workspace.login(fields.email, fields.password);
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : registration
                      ? "Chưa đăng ký được DVDD."
                      : "Chưa đăng nhập được DVDD.",
                );
                setErrorCode(
                  err instanceof ClientError ? err.code : "REQUEST_FAILED",
                );
              } finally {
                submitting.current = false;
                setFields((old) => ({
                  ...old,
                  password: "",
                  confirmPassword: "",
                }));
                setVisible(false);
              }
            }}
          >
            <div className="account-login-intro">
              <ShieldCheck size={18} />
              <p>
                {registration
                  ? "Thông tin được gửi tới DVDD để tạo tài khoản. Mật khẩu chỉ dùng trong lần đăng ký và xác minh đăng nhập, không được lưu lại."
                  : "Ghi nhớ đăng nhập tối đa 30 ngày trên trình duyệt này. Mật khẩu chỉ dùng để đăng nhập DVDD, không được lưu lại."}
              </p>
            </div>
            {!registration && workspace.accountError && (
              <p className="inline-error" role="alert">
                <CircleAlert size={15} />
                {workspace.accountError}
              </p>
            )}
            <div
              className={`account-fields ${registration ? "registration-fields" : ""}`}
            >
              {registration &&
                field("name", "Họ và tên", {
                  autoComplete: "name",
                  placeholder: "Nguyễn Văn An",
                })}
              {field("email", "Email DVDD", {
                type: "email",
                autoComplete: registration ? "email" : "username",
                placeholder: "Email của bạn",
                maxLength: 254,
              })}
              {registration &&
                field("phone", "Số điện thoại", {
                  type: "tel",
                  autoComplete: "tel",
                  placeholder: "0912345678 hoặc +84...",
                  maxLength: 32,
                })}
              {field("password", "Mật khẩu DVDD", {
                autoComplete: registration
                  ? "new-password"
                  : "current-password",
                placeholder: registration
                  ? "Tạo mật khẩu ít nhất 8 ký tự"
                  : "Mật khẩu tài khoản DVDD",
              })}
              {registration &&
                field("confirmPassword", "Nhập lại mật khẩu", {
                  autoComplete: "new-password",
                  placeholder: "Nhập lại mật khẩu vừa tạo",
                })}
            </div>
            {error && (
              <div className="auth-error">
                <p className="inline-error" role="alert">
                  <CircleAlert size={15} />
                  {error}
                </p>
                {registration &&
                  [
                    "REGISTRATION_OUTCOME_UNKNOWN",
                    "REGISTRATION_EMAIL_EXISTS",
                  ].includes(errorCode) && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => switchMode("login")}
                    >
                      Thử đăng nhập với email này <ArrowRight size={14} />
                    </button>
                  )}
              </div>
            )}
            <div className="settings-form-actions">
              <button
                className="button primary"
                type="submit"
                disabled={
                  busy ||
                  (!registration && (!fields.email.trim() || !fields.password))
                }
              >
                {workspace.accountBusy ? (
                  <LoaderCircle size={16} className="spin" />
                ) : registration ? (
                  <UserPlus size={16} />
                ) : (
                  <LogIn size={16} />
                )}
                {workspace.accountBusy
                  ? registration
                    ? "Đang đăng ký & xác minh..."
                    : "Đang đăng nhập & đồng bộ..."
                  : registration
                    ? "Đăng ký & kết nối"
                    : "Đăng nhập & kết nối"}
              </button>
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => switchMode(registration ? "login" : "register")}
              >
                {registration
                  ? "Đã có tài khoản? Đăng nhập"
                  : "Chưa có tài khoản? Đăng ký ngay"}
              </button>
            </div>
            <p className="field-hint">
              {registration ? (
                <>
                  Nếu DVDD yêu cầu xác minh bổ sung, bạn có thể{" "}
                  <a
                    href={`${DVDD_WEB_URL}/register.php`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    đăng ký tại DVDD <ExternalLink size={12} />
                  </a>{" "}
                  rồi quay lại kết nối.
                </>
              ) : (
                "Đăng nhập không phát sinh phí. Nếu chỉ có API token, bạn có thể sử dụng mục Cấu hình API."
              )}
            </p>
          </form>
        )}
      </div>
    </section>
  );
}

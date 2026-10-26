import type { RegistrationInput } from "./types";

export function validateRegistration(
  body: Record<string, unknown>,
):
  | { data: RegistrationInput; error?: never; field?: never }
  | { error: string; field: keyof RegistrationInput; data?: never } {
  const name =
    typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";
  let phone = rawPhone.replace(/[\s().-]/g, "");
  if (phone.startsWith("+84")) phone = "0" + phone.slice(3);
  else if (phone.startsWith("84") && phone.length === 11)
    phone = "0" + phone.slice(2);
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword =
    typeof body.confirmPassword === "string" ? body.confirmPassword : "";
  if (!name || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name))
    return { error: "Vui lòng nhập họ tên từ 1 đến 100 ký tự.", field: "name" };
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Vui lòng nhập địa chỉ email hợp lệ.", field: "email" };
  if (rawPhone.length > 32 || !/^0\d{9}$/.test(phone))
    return {
      error: "Vui lòng nhập số điện thoại Việt Nam hợp lệ, ví dụ 0912345678.",
      field: "phone",
    };
  if (
    password.length < 8 ||
    password.length > 128 ||
    !password.trim() ||
    /[\u0000-\u001f\u007f]/.test(password)
  )
    return { error: "Mật khẩu cần từ 8 đến 128 ký tự.", field: "password" };
  if (confirmPassword !== password)
    return { error: "Mật khẩu nhập lại chưa khớp.", field: "confirmPassword" };
  return { data: { name, email, phone, password, confirmPassword } };
}

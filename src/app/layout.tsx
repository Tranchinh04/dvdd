import type { Metadata } from "next";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "./globals.css";
import "@/styles/dashboard.css";
import "@/styles/account.css";
import "@/styles/topup.css";
import "@/styles/responsive.css";
import "@/styles/auth.css";

export const metadata: Metadata = {
  title: "OtpFlash — Mua số & nhận OTP",
  applicationName: "OtpFlash",
  description:
    "OtpFlash giúp thuê số điện thoại, nhận mã OTP và quản lý tài khoản DVDD trong một giao diện gọn gàng.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}

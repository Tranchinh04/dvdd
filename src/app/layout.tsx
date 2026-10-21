import type { Metadata } from "next";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "./globals.css";
import "@/styles/dashboard.css";
import "@/styles/account.css";

export const metadata: Metadata = {
  title: "DVDD Workspace — Mua số & nhận OTP",
  description:
    "Không gian làm việc gọn gàng để thuê số điện thoại, quản lý đơn hàng và nhận mã OTP từ DVDD.",
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

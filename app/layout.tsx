import type { Metadata } from "next";
import { Suspense } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import Providers from "@/components/providers";
import "./globals.css";
import "./dashboard.css";
import "./assessment-table.css";
import "./refined.css";
import "./grading.css";

export const metadata: Metadata = {
  title: "Mầm Xanh · Khoa Tin học và Ngoại ngữ",
  description:
    "Dashboard Khoa Tin học và Ngoại ngữ, Phân hiệu 1 Trường Thiếu sinh quân miền Trung: quản lý lớp, học sinh, giảng dạy và báo cáo giải trình.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi">
      <body>
        <Suspense
          fallback={<div className="app-loading">Đang mở Mầm Xanh…</div>}
        >
          <AntdRegistry>
            <Providers>{children}</Providers>
          </AntdRegistry>
        </Suspense>
      </body>
    </html>
  );
}

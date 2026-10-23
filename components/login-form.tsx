"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { Alert, Button, Form, Input } from "antd";
import { LockOutlined, LoginOutlined, UserOutlined } from "@ant-design/icons";
import { ACCOUNT_EMAIL_PATTERN } from "@/lib/account-identity";
export default function LoginForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function login(values: { username: string; password: string }) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError((e as Error).message || "Chưa kết nối được máy chủ.");
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-intro">
        <div className="login-brand">
          <Image
            src="/school-logo.png"
            alt="Logo Phân hiệu 1 Trường Thiếu sinh quân miền Trung"
            width={72}
            height={72}
            priority
          />
          <span>
            MẦM XANH<small>PHÂN HIỆU 1 · TSQ MIỀN TRUNG</small>
          </span>
        </div>
        <div>
          <span className="login-eyebrow">KHOA TIN HỌC VÀ NGOẠI NGỮ</span>
          <h1>
            Quản lý học sinh
            <br />
            Khoa Tin học và Ngoại ngữ
          </h1>
          <p>
            Quản lý học sinh, theo dõi học lực và phát triển năng khiếu trong
            một không gian chung.
          </p>
        </div>
        <span className="login-motto">
          Rèn đức luyện tài · Vững bước tương lai
        </span>
      </section>
      <section className="login-form-panel">
        <div className="login-form-inner">
          <span className="eyebrow">KHÔNG GIAN GIÁO VIÊN</span>
          <h2>Đăng nhập hệ thống</h2>
          <p>Sử dụng tài khoản email @ph1.tsqmt.edu.vn được khoa cấp.</p>
          {error && <Alert type="error" showIcon title={error} />}
          <Form layout="vertical" onFinish={login} autoComplete="on">
            <Form.Item
              name="username"
              label="Tài khoản"
              rules={[
                { required: true, message: "Nhập email tài khoản của bạn." },
                {
                  pattern: ACCOUNT_EMAIL_PATTERN,
                  message: "Tài khoản phải có đuôi @ph1.tsqmt.edu.vn.",
                },
              ]}
            >
              <Input
                prefix={<UserOutlined aria-hidden />}
                autoComplete="username"
                placeholder="ten@ph1.tsqmt.edu.vn"
                type="email"
                maxLength={100}
                size="large"
              />
            </Form.Item>
            <Form.Item
              name="password"
              label="Mật khẩu"
              rules={[{ required: true, message: "Nhập mật khẩu." }]}
            >
              <Input.Password
                prefix={<LockOutlined aria-hidden />}
                autoComplete="current-password"
                placeholder="Mật khẩu"
                maxLength={200}
                size="large"
              />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={busy}
              icon={<LoginOutlined aria-hidden />}
              size="large"
              block
            >
              Đăng nhập
            </Button>
          </Form>
          <small>Phân hiệu 1 Trường Thiếu sinh quân miền Trung</small>
        </div>
      </section>
    </main>
  );
}

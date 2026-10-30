import { Suspense } from "react";
import LoginForm from "@/components/login-form";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connection } from "next/server";
export default function LoginPage() {
  return (
    <Suspense
      fallback={<div className="app-loading">Đang mở trang đăng nhập…</div>}
    >
      <LoginContent />
    </Suspense>
  );
}
async function LoginContent() {
  await connection();
  if (await currentUser()) redirect("/");
  return <LoginForm />;
}

import { Suspense } from "react";
import StudentWorkspace from "@/components/student-workspace";
import { AuthProvider } from "@/components/auth-context";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export default function Home() {
  return (
    <Suspense
      fallback={<div className="app-loading">Đang mở hệ thống quản lý…</div>}
    >
      <AuthenticatedWorkspace />
    </Suspense>
  );
}
async function AuthenticatedWorkspace() {
  await connection();
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <AuthProvider user={user}>
      <StudentWorkspace />
    </AuthProvider>
  );
}

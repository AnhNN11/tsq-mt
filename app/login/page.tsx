import LoginForm from "@/components/login-form";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connection } from "next/server";
export default async function LoginPage() {
  await connection();
  if (await currentUser()) redirect("/");
  return <LoginForm />;
}

import LoginForm from "@/components/login-form";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  return <LoginForm />;
}

import "server-only";
import { createClient } from "@/utils/supabase/server";
import type { AppUser } from "./access";
import { ACCOUNT_EMAIL_PATTERN } from "./account-identity";

export async function currentUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: profile } = await supabase
    .from("school_accounts")
    .select("username,name,role,subjects,active")
    .eq("id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (!profile) return null;
  return {
    username: profile.username,
    name: profile.name,
    role: profile.role,
    subjects: profile.subjects,
  };
}
export async function authenticate(username: string, password: string) {
  if (!ACCOUNT_EMAIL_PATTERN.test(username))
    return { error: "Nhập tài khoản dạng ten@ph1.tsqmt.edu.vn.", status: 401 };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: username.trim().toLowerCase(),
    password,
  });
  if (error)
    return {
      error:
        error.status === 429
          ? "Đăng nhập nhiều lần. Vui lòng thử lại sau ít phút."
          : "Tên đăng nhập hoặc mật khẩu không đúng.",
      status: error.status === 429 ? 429 : 401,
    };
  const user = await currentUser();
  if (!user) {
    await supabase.auth.signOut();
    return {
      error: "Tài khoản chưa được cấp quyền sử dụng phần mềm.",
      status: 403,
    };
  }
  return { user, status: 200 };
}
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    new URL(request.url).host;
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  if (!origin) return true;
  try {
    return (
      new URL(origin).host === host &&
      ["http:", "https:"].includes(new URL(origin).protocol)
    );
  } catch {
    return false;
  }
}

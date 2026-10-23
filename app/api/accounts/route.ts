import { currentUser, sameOrigin } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { validateAccount } from "@/lib/account-validation";
import { accountEmail } from "@/lib/account-identity";
export async function GET() {
  const user = await currentUser();
  if (user?.role !== "admin")
    return Response.json(
      { error: "Chỉ admin có quyền xem tài khoản." },
      { status: user ? 403 : 401 },
    );
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("school_accounts")
    .select("username,email,name,role,subjects,active,created_at,updated_at")
    .order("name");
  if (error)
    return Response.json(
      { error: "Chưa tải được danh sách tài khoản." },
      { status: 500 },
    );
  return Response.json(
    { users: data },
    { headers: { "Cache-Control": "no-store" } },
  );
}
async function mutate(request: Request, method: "POST" | "PATCH" | "DELETE") {
  const user = await currentUser();
  if (user?.role !== "admin")
    return Response.json(
      { error: "Chỉ admin có quyền quản lý tài khoản." },
      { status: user ? 403 : 401 },
    );
  if (!sameOrigin(request))
    return Response.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  try {
    const text = await request.text();
    if (text.length > 5000)
      return Response.json(
        { error: "Thông tin tài khoản quá dài." },
        { status: 400 },
      );
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return Response.json(
        { error: "Thông tin tài khoản không hợp lệ." },
        { status: 400 },
      );
    }
    let values;
    try {
      values =
        method === "DELETE"
          ? validateAccount(
              {
                ...body,
                name: "Tạm",
                role: "teacher",
                subjects: ["Tin học"],
                active: false,
              },
              false,
            )
          : validateAccount(body, method === "POST");
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 400 });
    }
    if (
      values.username === user.username &&
      (method === "DELETE" || !values.active || values.role !== "admin")
    )
      return Response.json(
        {
          error:
            "Bạn không thể tự khóa hoặc hạ quyền tài khoản admin đang sử dụng.",
        },
        { status: 400 },
      );
    const client = createAdminClient();
    const existing = await client
      .from("school_accounts")
      .select("id,username")
      .eq("username", values.username)
      .maybeSingle();
    if (existing.error) throw new Error("Chưa đọc được danh sách tài khoản.");
    if (method === "POST") {
      if (existing.data)
        return Response.json(
          { error: "Tên tài khoản đã tồn tại." },
          { status: 409 },
        );
      const result = await client.auth.admin.createUser({
        email: accountEmail(values.username),
        password: values.password,
        email_confirm: true,
        app_metadata: { school: "mam-xanh" },
      });
      if (result.error || !result.data.user)
        return Response.json(
          {
            error:
              "Không tạo được tài khoản Auth. Kiểm tra tên đăng nhập đã tồn tại và yêu cầu mật khẩu.",
          },
          { status: 400 },
        );
      const { password: omitted, ...profile } = values;
      void omitted;
      const saved = await client
        .from("school_accounts")
        .insert({ id: result.data.user.id, ...profile });
      if (saved.error) {
        await client.auth.admin.deleteUser(result.data.user.id);
        throw new Error("Chưa lưu được hồ sơ tài khoản. Vui lòng thử lại.");
      }
    } else {
      if (!existing.data)
        return Response.json(
          { error: "Không tìm thấy tài khoản." },
          { status: 404 },
        );
      const updated = await client
        .from("school_accounts")
        .update(
          method === "DELETE"
            ? { active: false }
            : {
                name: values.name,
                role: values.role,
                subjects: values.subjects,
                active: values.active,
              },
        )
        .eq("id", existing.data.id);
      if (updated.error) throw new Error("Chưa cập nhật được tài khoản.");
    }
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return Response.json(
      { error: (e as Error).message || "Chưa quản lý được tài khoản." },
      { status: 503 },
    );
  }
}
export const POST = (request: Request) => mutate(request, "POST");
export const PATCH = (request: Request) => mutate(request, "PATCH");
export const DELETE = (request: Request) => mutate(request, "DELETE");

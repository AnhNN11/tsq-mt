import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { parseWorkspace } from "../lib/model";
loadEnvConfig(process.cwd());
async function provision() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Cần cấu hình SUPABASE_SECRET_KEY riêng tư trên máy chủ.");
  const users = JSON.parse(process.env.APP_USERS_JSON || "[]");
  if (!users.length) throw new Error("Chưa cấu hình APP_USERS_JSON.");
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const existing = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (existing.error) throw new Error(existing.error.message);
  for (const account of users) {
    const email = `${account.username}@mamxanh.school`;
    let user = existing.data.users.find((u) => u.email === email);
    if (!user) {
      const created = await admin.auth.admin.createUser({
        email,
        password: account.password,
        email_confirm: true,
        app_metadata: { school: "mam-xanh" },
      });
      if (created.error)
        throw new Error(
          `Không tạo được ${account.username}: ${created.error.message}`,
        );
      user = created.data.user;
    }
    // Reruns preserve existing passwords. Reset them explicitly through Supabase if needed.
    const { error } = await admin
      .from("school_profiles")
      .upsert({
        id: user.id,
        username: account.username,
        name: account.name,
        role: account.role,
        subjects: account.subjects,
        active: true,
      });
    if (error) throw new Error(error.message);
    console.log(`Đã cấp tài khoản ${account.username} (${account.role}).`);
  }
  const account = users.find((u: { role: string }) => u.role === "admin");
  const authenticated = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const signed = await authenticated.auth.signInWithPassword({
    email: `${account.username}@mamxanh.school`,
    password: account.password,
  });
  if (signed.error) throw new Error(signed.error.message);
  const state = await authenticated.rpc("school_read_workspace");
  if (state.error) throw new Error(state.error.message);
  if (state.data.data.students.length === 0 && state.data.revision === 0) {
    const seed = parseWorkspace(
      JSON.parse(
        await readFile(
          process.env.APP_SEED_PATH || "data/initial-workspace.json",
          "utf8",
        ),
      ),
    );
    if (!seed) throw new Error("File dữ liệu khởi tạo không hợp lệ.");
    const result = await authenticated.rpc("school_save_workspace", {
      p_data: seed,
      p_revision: 0,
    });
    if (result.error) throw new Error(result.error.message);
    console.log(
      `Đã nhập ${seed.students.length} học sinh và ${seed.pendingStudents.length} hồ sơ chờ vào Supabase.`,
    );
  } else console.log("Supabase đã có dữ liệu; giữ nguyên dữ liệu hiện có.");
  await authenticated.auth.signOut();
}
provision().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

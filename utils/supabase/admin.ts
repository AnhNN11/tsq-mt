import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";
export function createAdminClient() {
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new Error(
      "Cần cấu hình SUPABASE_SECRET_KEY trên máy chủ để quản lý tài khoản.",
    );
  return createClient(supabaseConfig().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

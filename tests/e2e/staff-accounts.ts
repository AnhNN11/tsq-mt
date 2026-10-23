import { createClient } from "@supabase/supabase-js";
export type StaffAccount = {
  username: string;
  email: string;
  password: string;
  role: string;
  subjects: string[];
};
export async function loadStaffAccounts(): Promise<StaffAccount[]> {
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const password = process.env.E2E_ACCOUNT_PASSWORD;
  if (!key || !password)
    throw new Error("E2E cần server key và E2E_ACCOUNT_PASSWORD riêng tư.");
  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await service
    .from("school_accounts")
    .select("username,email,role,subjects")
    .eq("active", true);
  if (error) throw new Error(error.message);
  return data.map((account) => ({ ...account, password }));
}

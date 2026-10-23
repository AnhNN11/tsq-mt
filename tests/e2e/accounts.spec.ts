import { test, expect, type APIRequestContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { accountEmail } from "../../lib/account-identity";
import { loadStaffAccounts, type StaffAccount } from "./staff-accounts";
let admin: StaffAccount;
let teacher: StaffAccount;
test.beforeAll(async () => {
  const accounts = await loadStaffAccounts();
  admin = accounts.find((u) => u.role === "admin")!;
  teacher = accounts.find((u) => u.role === "teacher")!;
});
const username = "e2e.account.temporary";
const password = `TestOnly!26-${crypto.randomUUID()}`;
async function login(
  request: APIRequestContext,
  account: { username: string; password: string } = admin,
) {
  return request.post("/api/auth/login", {
    data: {
      username: accountEmail(account.username),
      password: account.password,
    },
  });
}
test.afterAll(async () => {
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return;
  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
  });
  const { data } = await service
    .from("school_accounts")
    .select("id,name")
    .eq("username", username)
    .maybeSingle();
  if (data?.name === "Giáo viên kiểm thử tạm")
    expect((await service.auth.admin.deleteUser(data.id)).error).toBeNull();
});
test("admin account CRUD validates input, changes live roles, disables and reactivates logins", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const input = {
    username,
    password,
    name: "Giáo viên kiểm thử tạm",
    role: "admin",
    subjects: ["Tin học"],
    active: true,
  };
  expect((await request.post("/api/accounts", { data: input })).status()).toBe(
    401,
  );
  await login(request, teacher);
  expect((await request.post("/api/accounts", { data: input })).status()).toBe(
    403,
  );
  await login(request);
  expect(
    (
      await request.post("/api/accounts", {
        data: { ...input, password: "weak" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.patch("/api/accounts", {
        data: { ...input, username: admin.username, role: "teacher" },
      })
    ).status(),
  ).toBe(400);
  await login(page.request);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Quản trị hệ thống", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await page
    .getByLabel("Họ và tên giáo viên", { exact: true })
    .fill(input.name);
  await page
    .getByLabel("Tên tài khoản", { exact: true })
    .fill(accountEmail(username));
  await page.getByLabel("Mật khẩu ban đầu", { exact: true }).fill(password);
  await page
    .getByRole("combobox", { name: "Vai trò tài khoản", exact: true })
    .click();
  await page
    .locator(".ant-select-dropdown:visible .ant-select-item-option")
    .filter({ hasText: "Quản trị viên (admin)" })
    .click();
  await page
    .getByRole("button", { name: "Lưu tài khoản", exact: true })
    .click();
  await expect(page.getByText("Đã lưu tài khoản.")).toBeVisible();
  expect((await request.post("/api/accounts", { data: input })).status()).toBe(
    409,
  );
  expect((await login(request, { username, password })).status()).toBe(200);
  expect((await request.get("/api/accounts")).status()).toBe(200);
  await page
    .getByRole("button", { name: `Sửa tài khoản ${username}`, exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Vai trò tài khoản", exact: true })
    .click();
  await page
    .locator(".ant-select-dropdown:visible .ant-select-item-option")
    .filter({ hasText: "Giáo viên" })
    .click();
  await page
    .getByRole("button", { name: "Lưu tài khoản", exact: true })
    .click();
  await expect(page.getByText("Đã lưu tài khoản.").last()).toBeVisible();
  expect((await request.get("/api/accounts")).status()).toBe(403);
  await page
    .getByRole("button", {
      name: `Ngừng sử dụng tài khoản ${username}`,
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Ngừng sử dụng", exact: true })
    .click();
  await expect(page.getByText("Đã ngừng sử dụng tài khoản.")).toBeVisible();
  expect((await request.get("/api/workspace")).status()).toBe(401);
  expect((await login(request, { username, password })).status()).toBe(403);
  await page
    .getByRole("button", { name: `Sửa tài khoản ${username}`, exact: true })
    .click();
  await page.getByRole("switch").check();
  await page
    .getByRole("button", { name: "Lưu tài khoản", exact: true })
    .click();
  await expect(page.getByText("Đã lưu tài khoản.").last()).toBeVisible();
  expect((await login(request, { username, password })).status()).toBe(200);
  expect((await request.get("/api/accounts")).status()).toBe(403);
});

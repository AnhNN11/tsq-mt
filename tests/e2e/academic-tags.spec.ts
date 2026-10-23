import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { readSheet } from "read-excel-file/node";
import { newStudent } from "../../lib/model";
import { accountEmail } from "../../lib/account-identity";
import { loadStaffAccounts, type StaffAccount } from "./staff-accounts";
let admin: StaffAccount;
let teacher: StaffAccount;
const classId = "ACADEMIC-E2E-CLASS";
const pupilId = "ACADEMIC-E2E-PUPIL";
const tagName = "Kiểm thử tiến bộ học lực";
async function login(request: APIRequestContext, account: StaffAccount) {
  expect(
    (
      await request.post("/api/auth/login", {
        data: {
          username: accountEmail(account.username),
          password: account.password,
        },
      })
    ).status(),
  ).toBe(200);
}
async function state(request: APIRequestContext) {
  const response = await request.get("/api/workspace");
  expect(response.status()).toBe(200);
  return response.json();
}
async function choose(page: Page, label: string, name: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page
    .locator(".ant-select-dropdown:visible .ant-select-item-option")
    .filter({ hasText: name })
    .last()
    .click();
}
test.beforeAll(async () => {
  const accounts = await loadStaffAccounts();
  admin = accounts.find((a) => a.role === "admin")!;
  teacher = accounts.find((a) => a.username === "nhatanh.nguyen")!;
});
test.afterAll(async ({ request }) => {
  await login(request, admin);
  let s = await state(request);
  if (s.data.students.some((p: { id: string }) => p.id === pupilId)) {
    expect(
      (
        await request.put("/api/workspace", {
          data: {
            revision: s.revision,
            data: {
              ...s.data,
              students: s.data.students.filter(
                (p: { id: string }) => p.id !== pupilId,
              ),
              classes: s.data.classes.filter(
                (c: { id: string }) => c.id !== classId,
              ),
            },
          },
        })
      ).status(),
    ).toBe(200);
    s = await state(request);
  }
  if (
    s.data.academicTags.some((t: { name: string }) =>
      t.name.startsWith(tagName),
    )
  ) {
    expect(
      (
        await request.put("/api/workspace", {
          data: {
            revision: s.revision,
            data: {
              ...s.data,
              academicTags: s.data.academicTags.filter(
                (t: { name: string }) => !t.name.startsWith(tagName),
              ),
            },
          },
        })
      ).status(),
    ).toBe(200);
  }
});
test("custom academic badges support CRUD, permissions, filtering and Excel without losing source codes", async ({
  page,
  request,
}) => {
  await login(request, admin);
  const start = await state(request);
  const pupil = {
    ...newStudent(),
    id: pupilId,
    name: "Học sinh kiểm thử học lực",
    className: "8/97",
    priorEducation: "HTSX\nTốt",
  };
  expect(
    (
      await request.put("/api/workspace", {
        data: {
          revision: start.revision,
          data: {
            ...start.data,
            classes: [
              ...start.data.classes,
              { id: classId, name: "8/97", track: "Kiểm thử", note: "" },
            ],
            students: [...start.data.students, pupil],
          },
        },
      })
    ).status(),
  ).toBe(200);
  await login(page.request, teacher);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Quản lý học lực", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Tìm đánh giá học sinh" })
    .fill(pupil.name);
  const row = page.getByRole("row").filter({ hasText: pupil.name });
  await expect(row).toContainText("Hoàn thành xuất sắc");
  await page.getByRole("button", { name: "Thẻ học lực", exact: true }).click();
  await page
    .getByRole("button", { name: "Tạo thẻ học lực", exact: true })
    .click();
  await page.getByLabel("Tên thẻ học lực", { exact: true }).fill(tagName);
  await page
    .getByRole("button", { name: "Lưu thẻ học lực", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("row").filter({ hasText: tagName }),
  ).toBeVisible();
  await page
    .locator(".ant-modal-footer")
    .getByRole("button", { name: "Đóng", exact: true })
    .click();
  await choose(page, `Học lực hiện tại ${pupil.name}`, tagName);
  await expect(page.locator(".ant-message")).toContainText("Đã lưu đánh giá");
  await choose(page, "Lọc thẻ học lực", tagName);
  await expect(row).toBeVisible();
  let saved = await state(page.request);
  const tag = saved.data.academicTags.find(
    (t: { name: string }) => t.name === tagName,
  );
  expect(
    saved.data.students.find((p: { id: string }) => p.id === pupilId)
      .assessments["Tin học"].after,
  ).toBe(tag.id);
  expect(
    saved.data.students.find((p: { id: string }) => p.id === pupilId)
      .priorEducation,
  ).toBe(pupil.priorEducation);
  // Teachers cannot rename another owner's/default tag, including through a crafted request.
  const forbidden = structuredClone(saved.data);
  forbidden.academicTags[0].name = "Sửa trái quyền";
  expect(
    (
      await page.request.put("/api/workspace", {
        data: { data: forbidden, revision: saved.revision },
      })
    ).status(),
  ).toBe(403);
  await page.getByRole("button", { name: "Thẻ học lực", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: `Xóa thẻ học lực ${tagName}`,
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: `Sửa thẻ học lực ${tagName}`, exact: true })
    .click();
  await page
    .getByLabel("Tên thẻ học lực", { exact: true })
    .fill(`${tagName} mới`);
  await page
    .getByRole("button", { name: "Lưu thẻ học lực", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(`${tagName} mới`);
  await page
    .locator(".ant-modal-footer")
    .getByRole("button", { name: "Đóng", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("button", { name: "Quản lý học lực", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Tìm đánh giá học sinh" })
    .fill(pupil.name);
  await expect(row).toContainText(`${tagName} mới`);
  const download = page.waitForEvent("download");
  await page
    .locator(".evaluation-table-panel")
    .getByRole("button", { name: "Xuất Excel", exact: true })
    .click();
  const path = await (await download).path();
  const rows = await readSheet(path!, "Học sinh");
  expect(rows.flat()).toContain(`${tagName} mới`);
  expect(rows.flat()).toContain("Hoàn thành xuất sắc");
  await page
    .getByRole("button", { name: `Xóa đánh giá ${pupil.name}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Xóa đánh giá", exact: true }).click();
  await expect(page.locator(".ant-message")).toContainText("Đã xóa đánh giá");
  await page.getByRole("button", { name: "Thẻ học lực", exact: true }).click();
  await page
    .getByRole("button", {
      name: `Xóa thẻ học lực ${tagName} mới`,
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Xóa thẻ", exact: true }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("row")
      .filter({ hasText: `${tagName} mới` }),
  ).toHaveCount(0);
  saved = await state(page.request);
  expect(
    saved.data.academicTags.some((t: { id: string }) => t.id === tag.id),
  ).toBe(false);
});

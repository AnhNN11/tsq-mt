import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import readExcel from "read-excel-file/node";
import JSZip from "jszip";
import { newStudent } from "../../lib/model";

type Account = {
  username: string;
  password: string;
  role: string;
  subjects: string[];
};
const users: Account[] = JSON.parse(process.env.APP_USERS_JSON || "[]");
const admin = users.find((u) => u.role === "admin")!;
const teacher = users.find((u) => u.username === "nhatanh.nguyen")!;
const manager = users.find((u) => u.role === "manager")!;
async function login(request: APIRequestContext, account = admin) {
  const response = await request.post("/api/auth/login", {
    data: { username: account.username, password: account.password },
  });
  expect(response.status()).toBe(200);
}
async function state(request: APIRequestContext) {
  const response = await request.get("/api/workspace");
  expect(response.status()).toBe(200);
  return response.json();
}
async function choose(page: Page, label: string, text: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  if (label.startsWith("Thẻ năng khiếu "))
    await page.getByRole("combobox", { name: label, exact: true }).fill(text);
  await page
    .locator(".ant-select-dropdown:visible .ant-select-item-option")
    .filter({ hasText: text })
    .last()
    .click();
}
const scratchName = "9/99";
const scratchId = "E2E-SCRATCH-CLASS";
const pupilId = "E2E-SCRATCH-PUPIL";
test.describe.configure({ mode: "serial" });
test.afterAll(async ({ request }) => {
  await login(request);
  const s = await state(request);
  if (
    s.data.classes.some((c: { id: string }) => c.id === scratchId) ||
    s.data.talentTags.some((t: { name: string }) => t.name.startsWith("E2E "))
  ) {
    const data = {
      ...s.data,
      classes: s.data.classes.filter((c: { id: string }) => c.id !== scratchId),
      students: s.data.students.filter(
        (p: { id: string; className: string }) =>
          p.id !== pupilId && ![scratchName, "9/98"].includes(p.className),
      ),
      talentTags: s.data.talentTags.filter(
        (t: { name: string }) => !t.name.startsWith("E2E "),
      ),
      lessons: s.data.lessons.filter(
        (l: { className: string }) =>
          ![scratchName, "9/98"].includes(l.className),
      ),
    };
    expect(
      (
        await request.put("/api/workspace", {
          data: { data, revision: s.revision },
        })
      ).status(),
    ).toBe(200);
  }
  await request.post("/api/auth/logout");
});
test("anonymous access is blocked and login uses an HttpOnly Supabase session", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/workspace")).status()).toBe(401);
  expect((await request.get("/api/accounts")).status()).toBe(401);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Tài khoản", { exact: true }).fill(admin.username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator(".ant-alert")).toContainText("không đúng");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(admin.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Tổng quan." })).toBeVisible();
  await expect(page.locator(".page-heading p")).toContainText("160 hồ sơ");
  const cookies = await page.context().cookies();
  expect(
    cookies
      .filter((c) => c.name.includes("auth-token"))
      .every((c) => c.httpOnly),
  ).toBe(true);
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/workspace")).status()).toBe(401);
});
test("Supabase has the full roster and ten assigned staff accounts", async ({
  request,
}) => {
  await login(request);
  const { data } = await state(request);
  expect(data.students).toHaveLength(160);
  expect(data.pendingStudents).toHaveLength(5);
  expect(
    data.students.filter((s: { gender: string }) => s.gender === "Nam"),
  ).toHaveLength(113);
  expect(
    data.students.filter((s: { gender: string }) => s.gender === "Nữ"),
  ).toHaveLength(43);
  expect(
    data.students.filter((s: { gender: string }) => !s.gender),
  ).toHaveLength(4);
  for (const c of ["6/1", "6/2", "10/1", "10/2"])
    expect(
      data.students.filter((s: { className: string }) => s.className === c),
    ).toHaveLength(40);
  const list = await (await request.get("/api/accounts")).json();
  expect(list.users).toHaveLength(10);
  expect(
    list.users.filter(
      (u: Account) => u.role === "teacher" && u.subjects.includes("Tin học"),
    ),
  ).toHaveLength(3);
  expect(
    list.users.filter(
      (u: Account) => u.role === "teacher" && u.subjects.includes("Tiếng Anh"),
    ),
  ).toHaveLength(5);
  expect(JSON.stringify(list)).not.toContain("password");
});
test("admin CRUD and revision conflict keep shared Supabase data consistent", async ({
  request,
}) => {
  await login(request);
  const s = await state(request);
  const data = {
    ...s.data,
    classes: [
      ...s.data.classes,
      { id: scratchId, name: scratchName, track: "Kiểm thử tạm", note: "" },
    ],
    students: [
      ...s.data.students,
      {
        ...newStudent(),
        id: pupilId,
        name: "Học sinh kiểm thử tạm",
        className: scratchName,
      },
    ],
  };
  const first = await request.put("/api/workspace", {
    data: { data, revision: s.revision },
  });
  expect(first.status()).toBe(200);
  expect(
    (
      await request.put("/api/workspace", {
        data: { data, revision: s.revision },
      })
    ).status(),
  ).toBe(409);
  expect(
    (await state(request)).data.students.find(
      (p: { id: string }) => p.id === pupilId,
    ).name,
  ).toBe("Học sinh kiểm thử tạm");
});
test("teacher permissions are enforced by both API and Supabase RPC", async ({
  request,
}) => {
  await login(request, teacher);
  const s = await state(request);
  const denied = structuredClone(s.data);
  denied.students.find((p: { id: string }) => p.id === pupilId).assessments[
    "Tiếng Anh"
  ] = { before: "Đạt", after: "Khá", interaction: "Chủ động", note: "" };
  expect(
    (
      await request.put("/api/workspace", {
        data: { data: denied, revision: s.revision },
      })
    ).status(),
  ).toBe(403);
  expect((await request.get("/api/accounts")).status()).toBe(403);
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  expect(
    (
      await client.auth.signInWithPassword({
        email: `${teacher.username}@mamxanh.school`,
        password: teacher.password,
      })
    ).error,
  ).toBeNull();
  const bypass = await client.rpc("school_save_workspace", {
    p_data: denied,
    p_revision: s.revision,
  });
  expect(bypass.error?.code).toBe("42501");
  const altered = structuredClone(s.data);
  altered.students.find((p: { id: string }) => p.id === pupilId).name =
    "Tên không được phép sửa";
  expect(
    (
      await client.rpc("school_save_workspace", {
        p_data: altered,
        p_revision: s.revision,
      })
    ).error?.code,
  ).toBe("42501");
  await client.auth.signOut();
});
test("inline academic and talent CRUD persist across accounts", async ({
  page,
  request,
}) => {
  await login(page.request, teacher);
  await page.goto("/");
  await choose(page, "Lớp học", `Lớp ${scratchName}`);
  await page
    .getByRole("button", { name: "Quản lý học lực", exact: true })
    .click();
  await choose(page, "Học lực hiện tại Học sinh kiểm thử tạm", "Khá");
  await expect(
    page.getByText("Đã lưu đánh giá Học sinh kiểm thử tạm."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Quản lý năng khiếu", exact: true })
    .click();
  await page.getByRole("button", { name: "Quản lý thẻ", exact: true }).click();
  await page
    .getByRole("button", { name: "Tạo thẻ năng khiếu", exact: true })
    .click();
  await page.getByLabel("Tên thẻ", { exact: true }).fill("E2E Lập trình robot");
  await page.getByRole("button", { name: "Lưu thẻ", exact: true }).click();
  await expect(page.getByText("Đã lưu thẻ năng khiếu.")).toBeVisible();
  await page
    .getByRole("button", { name: "Sửa thẻ E2E Lập trình robot", exact: true })
    .click();
  await page.getByLabel("Tên thẻ", { exact: true }).fill("E2E Robot");
  await page.getByRole("button", { name: "Lưu thẻ", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sửa thẻ E2E Robot", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Đóng danh mục", exact: true })
    .click();
  await choose(page, "Thẻ năng khiếu Học sinh kiểm thử tạm", "E2E Robot");
  await expect(
    page.getByText("Đã cập nhật thẻ cho Học sinh kiểm thử tạm."),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page
    .getByRole("button", {
      name: "Thêm năng khiếu Học sinh kiểm thử tạm",
      exact: true,
    })
    .click();
  await choose(page, "Lĩnh vực năng khiếu", "Tin học");
  await choose(page, "Mức độ năng khiếu", "Có tiềm năng");
  await page
    .getByLabel("Biểu hiện và nhận xét")
    .fill("Thực hành tốt trong bài kiểm thử.");
  await page.getByLabel("Hướng bồi dưỡng").fill("Bồi dưỡng kỹ năng lập trình.");
  await page
    .getByRole("button", { name: "Lưu đánh giá năng khiếu", exact: true })
    .click();
  await expect(page.getByText("Đã lưu đánh giá năng khiếu.")).toBeVisible();
  await login(request, manager);
  const s = await state(request);
  const pupil = s.data.students.find((p: { id: string }) => p.id === pupilId);
  expect(pupil.assessments["Tin học"].after).toBe("Khá");
  expect(pupil.talents[0].teacherId).toBe(teacher.username);
  const tag = s.data.talentTags.find(
    (t: { name: string }) => t.name === "E2E Robot",
  );
  expect(tag.createdBy).toBe(teacher.username);
  expect(pupil.talentTagIds).toContain(tag.id);
  pupil.assessments["Tiếng Anh"] = {
    before: "Đạt",
    after: "Tốt",
    interaction: "Có tham gia",
    note: "Đánh giá kiểm thử",
  };
  expect(
    (
      await request.put("/api/workspace", {
        data: { data: s.data, revision: s.revision },
      })
    ).status(),
  ).toBe(200);
  await page
    .getByRole("button", { name: "Làm mới dữ liệu", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Xóa năng khiếu Học sinh kiểm thử tạm",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Xóa", exact: true }).click();
  await expect(page.getByText("Đã xóa đánh giá năng khiếu.")).toBeVisible();
  await page.getByRole("button", { name: "Quản lý thẻ", exact: true }).click();
  await page
    .getByRole("button", { name: "Xóa thẻ E2E Robot", exact: true })
    .click();
  await page.getByRole("button", { name: "Xóa thẻ", exact: true }).click();
  await expect(page.getByText("Đã xóa thẻ năng khiếu.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sửa thẻ E2E Robot", exact: true }),
  ).toHaveCount(0);
});
test("Word and Excel reports contain charts and respect class/ethnicity filters", async ({
  page,
}) => {
  await login(page.request);
  await page.goto("/");
  await choose(page, "Lớp học", "Lớp 10/1");
  await choose(page, "Lọc dân tộc", "Kinh (7)");
  await page.getByRole("button", { name: "Báo cáo", exact: true }).click();
  await expect(page.locator(".report-title")).toContainText("Dân tộc Kinh");
  await expect(
    page.locator(".report-charts .recharts-wrapper > svg.recharts-surface"),
  ).toHaveCount(2);
  const pendingExcel = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất Excel", exact: true }).click();
  const excel = await pendingExcel;
  const excelPath = test.info().outputPath("bao-cao.xlsx");
  await excel.saveAs(excelPath);
  const sheets = await readExcel(excelPath);
  expect(sheets.map((s) => s.sheet)).toEqual([
    "Tổng quan",
    "Học sinh",
    "Năng khiếu",
    "Giảng dạy",
    "Trích ngang",
  ]);
  expect(sheets[1].data).toHaveLength(8);
  expect(
    sheets[1].data
      .slice(1)
      .every((row) => row[2] === "10/1" && row[5] === "Kinh"),
  ).toBe(true);
  const excelZip = await JSZip.loadAsync(
    await import("node:fs/promises").then((fs) => fs.readFile(excelPath)),
  );
  const ExcelJS = (await import("exceljs")).default;
  const exportedBook = new ExcelJS.Workbook();
  await exportedBook.xlsx.readFile(excelPath);
  exportedBook.eachSheet((sheet) =>
    sheet.eachRow((row) =>
      row.eachCell((cell) => {
        if (cell.value !== null) {
          expect(cell.font.name).toBe("Times New Roman");
          expect(cell.font.size).toBeGreaterThanOrEqual(14);
        }
      }),
    ),
  );
  expect(
    Object.keys(excelZip.files).filter((name) =>
      /^xl\/media\/.*png$/.test(name),
    ),
  ).toHaveLength(2);
  const pendingWord = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất Word", exact: true }).click();
  const word = await pendingWord;
  const wordPath = test.info().outputPath("bao-cao.docx");
  await word.saveAs(wordPath);
  const fs = await import("node:fs/promises");
  await fs.mkdir("data/qa", { recursive: true });
  await fs.copyFile(wordPath, "data/qa/bao-cao.docx");
  await fs.copyFile(excelPath, "data/qa/bao-cao.xlsx");
  const zip = await JSZip.loadAsync(
    await import("node:fs/promises").then((fs) => fs.readFile(wordPath)),
  );
  const xml = await zip.file("word/document.xml")!.async("string");
  const footerXml = await zip.file("word/footer1.xml")!.async("string");
  for (const part of [xml, footerXml]) {
    expect(part).toContain("Times New Roman");
    expect(part).not.toContain('w:ascii="Arial"');
    for (const size of part.matchAll(/<w:sz w:val="(\d+)"/g))
      expect(Number(size[1])).toBeGreaterThanOrEqual(28);
  }
  expect(xml).toContain("Báo cáo quản lý học sinh");
  expect(xml).toContain("Dân tộc Kinh");
  expect(xml).toContain("Người lập");
  expect(
    Object.keys(zip.files).some((name) => /^word\/media\/.*png$/.test(name)),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("bao-cao-preview.png"),
    fullPage: true,
    caret: "initial",
  });
});
test("mobile layout has no overflow and teacher sees only assigned subject", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page.request, teacher);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Mở menu", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mở menu", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Hệ thống", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Lớp & học sinh", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Thêm học sinh", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("combobox", { name: "Môn học", exact: true }).click();
  await expect(
    page.locator(".ant-select-dropdown:visible .ant-select-item-option"),
  ).toHaveCount(1);
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("class, pupil and lesson editors validate and persist full CRUD", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await login(page.request);
  await page.goto("/");
  await choose(page, "Lớp học", `Lớp ${scratchName}`);
  await page.getByRole("button", { name: "Giảng dạy", exact: true }).click();
  await page
    .getByRole("button", { name: "Ghi nhận tiết dạy", exact: true })
    .click();
  await page.getByRole("button", { name: "Lưu tiết dạy", exact: true }).click();
  await expect(page.getByText("Vui lòng nhập tên bài học.")).toBeVisible();
  await page.getByLabel("Tên bài học", { exact: true }).fill("E2E Bài thử");
  await page
    .getByRole("spinbutton", { name: "Số tiết", exact: true })
    .fill("2");
  await page.getByRole("button", { name: "Lưu tiết dạy", exact: true }).click();
  await expect(
    page.getByText("Đã lưu tiết dạy và cập nhật số liệu báo cáo."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sửa bài E2E Bài thử", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "Số tiết", exact: true })
    .fill("3");
  await page.getByRole("button", { name: "Lưu tiết dạy", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sửa bài E2E Bài thử", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Lớp & học sinh", exact: true })
    .click();
  await page
    .getByRole("button", { name: `Sửa lớp ${scratchName}`, exact: true })
    .click();
  await page.getByLabel("Tên lớp", { exact: true }).fill("9/98");
  await page.getByRole("button", { name: "Lưu lớp học", exact: true }).click();
  await expect(page.getByText("Đã cập nhật lớp 9/98.")).toBeVisible();
  let data = (await state(page.request)).data;
  expect(
    data.students.find((s: { id: string }) => s.id === pupilId).className,
  ).toBe("9/98");
  expect(
    data.lessons.find((l: { title: string }) => l.title === "E2E Bài thử")
      .periods,
  ).toBe(3);
  expect(
    data.lessons.find((l: { title: string }) => l.title === "E2E Bài thử")
      .className,
  ).toBe("9/98");
  await choose(page, "Lớp học", "Lớp 9/98");
  await page.getByRole("button", { name: "Mở lớp 9/98", exact: true }).click();
  await page
    .getByRole("button", { name: "Sửa Học sinh kiểm thử tạm", exact: true })
    .click();
  await page.getByLabel("Ngày sinh", { exact: true }).fill("31/02/2012");
  await page.getByRole("button", { name: "Lưu hồ sơ", exact: true }).click();
  await expect(
    page.getByText("Nhập ngày có thật theo dd/mm/yyyy, không ở tương lai."),
  ).toBeVisible();
  await page.getByLabel("Ngày sinh", { exact: true }).fill("12/10/2012");
  await choose(page, "Giới tính học sinh", "Nữ");
  await page.getByRole("button", { name: "Lưu hồ sơ", exact: true }).click();
  await expect(
    page.getByText("Đã lưu hồ sơ Học sinh kiểm thử tạm."),
  ).toBeVisible();
  data = (await state(page.request)).data;
  expect(
    data.students.find((s: { id: string }) => s.id === pupilId).gender,
  ).toBe("Nữ");
  await choose(page, "Lọc giới tính", "Nữ (1)");
  await expect(page.locator(".scope-caption")).toContainText("1 học sinh");
  await page
    .getByRole("button", { name: "Thêm học sinh", exact: true })
    .click();
  await page
    .getByLabel("Họ và tên", { exact: true })
    .fill("Học sinh mới kiểm thử");
  await page.getByRole("button", { name: "Lưu hồ sơ", exact: true }).click();
  await expect(page.getByText("Đã thêm học sinh mới.")).toBeVisible();
  await choose(page, "Lọc giới tính", "Tất cả giới tính");
  await page
    .getByRole("button", { name: "Xóa Học sinh mới kiểm thử", exact: true })
    .click();
  await page.getByRole("button", { name: "Xóa học sinh", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Xóa Học sinh mới kiểm thử",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Giảng dạy", exact: true }).click();
  await page
    .getByRole("button", { name: "Xóa bài E2E Bài thử", exact: true })
    .click();
  await page.getByRole("button", { name: "Xóa", exact: true }).click();
  await expect(page.getByText("Đã xóa lượt dạy.")).toBeVisible();
  await page
    .getByRole("button", { name: "Lớp & học sinh", exact: true })
    .click();
  await page.getByRole("tab", { name: /Lớp học/ }).click();
  await page.getByRole("button", { name: "Xóa lớp 9/98", exact: true }).click();
  await page
    .getByRole("button", { name: "Xóa lớp và dữ liệu", exact: true })
    .click();
  await expect(
    page.getByText("Đã xóa lớp 9/98 và dữ liệu liên quan."),
  ).toBeVisible();
  data = (await state(page.request)).data;
  expect(data.students).toHaveLength(160);
  expect(data.classes).toHaveLength(4);
});

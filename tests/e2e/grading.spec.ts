import {
  test,
  expect,
  type APIRequestContext,
  type Page,
  type APIResponse,
} from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { readSheet } from "read-excel-file/node";
import { newStudent } from "../../lib/model";
import { sheetSvg } from "../../lib/sheet-template";
import { loadStaffAccounts, type StaffAccount } from "./staff-accounts";
let admin: StaffAccount, teacher: StaffAccount, other: StaffAccount;
let examId = "",
  scanId = "",
  capturedSession = "",
  captureUrl = "";
const classId = "GRADING-E2E-CLASS",
  pupilId = "GRADING-E2E-PUPIL",
  className = "9/96",
  title = "Kiểm tra chụp bài giả lập";
const pupilName = "Học sinh kiểm thử chấm phiếu";
const answers = {
  multipleChoice: ["A", "B", "C"],
  trueFalse: [["Đ", "S", "Đ", "S"]],
  shortAnswer: ["-1,5"],
};
const db = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
async function okay(response: Pick<APIResponse, "status" | "text" | "json">) {
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}
async function login(request: APIRequestContext, account: StaffAccount) {
  await okay(
    await request.post("/api/auth/login", {
      data: { username: account.email, password: account.password },
    }),
  );
}
async function workspace(request: APIRequestContext) {
  return okay(await request.get("/api/workspace"));
}
async function choose(page: Page, label: string, name: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page
    .locator(".ant-select-dropdown:visible .ant-select-item-option")
    .filter({ hasText: name })
    .last()
    .click();
}
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  const staff = await loadStaffAccounts();
  admin = staff.find((u) => u.role === "admin")!;
  teacher = staff.find((u) => u.username === "nhatanh.nguyen")!;
  other = staff.find(
    (u) => u.role === "teacher" && !u.subjects.includes("Tin học"),
  )!;
});
test.afterAll(async ({ request }) => {
  const service = db();
  if (!examId) {
    const orphan = await service
      .from("school_exams")
      .select("id")
      .eq("class_id", classId)
      .eq("title", title)
      .maybeSingle();
    expect(orphan.error).toBeNull();
    examId = orphan.data?.id ?? "";
  }
  if (examId) {
    const pictures = await service
      .from("school_paper_scans")
      .select("image_path")
      .eq("exam_id", examId);
    const paths =
      pictures.data?.flatMap((p) => (p.image_path ? [p.image_path] : [])) ?? [];
    if (paths.length)
      expect(
        (await service.storage.from("school-paper-scans").remove(paths)).error,
      ).toBeNull();
    for (const table of [
      "school_grade_history",
      "school_grades",
      "school_paper_scans",
      "school_capture_sessions",
      "school_exam_candidates",
    ])
      expect(
        (await service.from(table).delete().eq("exam_id", examId)).error,
      ).toBeNull();
    expect(
      (await service.from("school_exams").delete().eq("id", examId)).error,
    ).toBeNull();
  }
  await login(request, admin);
  const current = await workspace(request);
  if (current.data.classes.some((c: { id: string }) => c.id === classId))
    await okay(
      await request.put("/api/workspace", {
        data: {
          revision: current.revision,
          data: {
            ...current.data,
            classes: current.data.classes.filter(
              (c: { id: string }) => c.id !== classId,
            ),
            students: current.data.students.filter(
              (s: { id: string }) => s.id !== pupilId,
            ),
          },
        },
      }),
    );
});

test("teacher configures all three sections, phone capture stays private, and explicit review publishes the grade", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(240_000);
  await login(request, admin);
  const initial = await workspace(request);
  await okay(
    await request.put("/api/workspace", {
      data: {
        revision: initial.revision,
        data: {
          ...initial.data,
          classes: [
            ...initial.data.classes,
            { id: classId, name: className, track: "Kiểm thử", note: "" },
          ],
          students: [
            ...initial.data.students,
            {
              ...newStudent(),
              id: pupilId,
              name: pupilName,
              className,
              gender: "Nam",
              birthDate: "12/10/2012",
              ethnicity: "Kinh",
              priorEducation: "Tốt",
            },
          ],
        },
      },
    }),
  );
  await login(page.request, teacher);
  await page.goto("/");
  await choose(page, "Lớp học", `Lớp ${className}`);
  await page.getByRole("button", { name: "Quản lý điểm", exact: true }).click();
  await page
    .getByRole("button", { name: "Tạo bài kiểm tra", exact: true })
    .click();
  await page.getByLabel("Tên bài kiểm tra", { exact: true }).fill(title);
  await page
    .getByRole("tab", { name: "Đáp án và thang điểm", exact: true })
    .click();
  for (const [label, value] of [
    ["Số câu chọn đáp án", "3"],
    ["Điểm mỗi câu chọn đáp án", "1"],
    ["Số câu đúng sai", "1"],
    ["Điểm khi đúng 1 ý", "0.5"],
    ["Điểm khi đúng 2 ý", "1"],
    ["Điểm khi đúng 3 ý", "2"],
    ["Điểm khi đúng 4 ý", "4"],
    ["Số câu trả lời ngắn", "1"],
    ["Điểm mỗi câu trả lời ngắn", "3"],
  ])
    await page
      .getByRole("spinbutton", { name: label, exact: true })
      .fill(value);
  await page
    .getByRole("button", { name: "Dán nhanh đáp án", exact: true })
    .click();
  const paste = page.getByRole("dialog", {
    name: "Dán đáp án cho mã đề đang chọn",
    exact: true,
  });
  await paste.locator("textarea").nth(0).fill("A B C");
  await paste.locator("textarea").nth(1).fill("Đ S Đ S");
  await paste.locator("textarea").nth(2).fill("-1,5");
  await paste.getByRole("button", { name: "Điền đáp án", exact: true }).click();
  const created = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/grading/exams") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Lưu bài kiểm tra", exact: true })
    .click();
  const createResponse = await created;
  expect(createResponse.status(), await createResponse.text()).toBe(200);
  examId = (await createResponse.json()).exam.id;
  await page.getByRole("button", { name: "Bài làm", exact: true }).click();
  const sessionResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/exams/${examId}/sessions`) &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Nhận bài bằng mã QR", exact: true })
    .click();
  const session = await (await sessionResponse).json();
  captureUrl = session.url;
  capturedSession = session.id;
  await expect(page.locator(".ant-qrcode canvas")).toBeVisible();
  const token = new URL(captureUrl).hash.slice(1);
  const mobile = await browser.newContext({
    baseURL: "http://127.0.0.1:3000",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const phone = await mobile.newPage();
  expect(
    (
      await mobile.request.get(`/api/capture/${capturedSession}`, {
        headers: { authorization: `Bearer ${"a".repeat(43)}` },
      })
    ).status(),
  ).toBe(410);
  const publicMetadata = await okay(
    await mobile.request.get(`/api/capture/${capturedSession}`, {
      headers: { authorization: `Bearer ${token}` },
    }),
  );
  expect(Object.keys(publicMetadata).sort()).toEqual(
    ["expiresAt", "remaining", "schoolYear", "semester", "title"].sort(),
  );
  await phone.goto(captureUrl);
  await expect(
    phone.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(phone.getByText(pupilName, { exact: true })).toHaveCount(0);
  await expect(
    phone.getByLabel("Chụp ảnh bài làm", { exact: true }),
  ).toHaveAttribute("capture", "environment");
  const image = await sharp(
    Buffer.from(
      sheetSvg({
        answers,
        candidateNumber: "00000001",
        variant: "0001",
        title,
      }),
    ),
  )
    .png()
    .toBuffer();
  await phone.getByLabel("Chọn ảnh bài làm", { exact: true }).setInputFiles({
    name: "paper-test.png",
    mimeType: "image/png",
    buffer: image,
  });
  const uploaded = phone.waitForResponse(
    (r) =>
      r.url().includes(`/api/capture/${capturedSession}`) &&
      r.request().method() === "POST",
  );
  await phone
    .getByRole("button", { name: "Gửi ảnh bài làm", exact: true })
    .click();
  const uploadResponse = await uploaded;
  expect(uploadResponse.status(), await uploadResponse.text()).toBe(200);
  scanId = (await uploadResponse.json()).id;
  await expect(phone.getByText("Đã gửi 1 ảnh trong lần mở này")).toBeVisible();
  await phone
    .getByLabel("Chọn ảnh bài làm", { exact: true })
    .setInputFiles({
      name: "same-paper.png",
      mimeType: "image/png",
      buffer: image,
    });
  const duplicated = phone.waitForResponse(
    (r) =>
      r.url().includes(`/api/capture/${capturedSession}`) &&
      r.request().method() === "POST",
  );
  await phone
    .getByRole("button", { name: "Gửi ảnh bài làm", exact: true })
    .click();
  const duplicateBody = await okay(await duplicated);
  expect(duplicateBody.duplicate).toBe(true);
  expect(duplicateBody.id).toBe(scanId);
  const second = await mobile.request.get(`/api/grading/exams/${examId}`);
  expect(second.status()).toBe(401);
  expect(
    (await mobile.request.get(`/api/grading/scans/${scanId}/image`)).status(),
  ).toBe(401);
  let detail = await okay(
    await page.request.get(`/api/grading/exams/${examId}`),
  );
  expect(detail.grades).toHaveLength(0);
  expect(detail.scans[0].status).toBe("uploaded");
  const preview = await page.request.get(`/api/grading/scans/${scanId}/image`);
  expect(preview.status()).toBe(200);
  expect(preview.headers()["content-type"]).toContain("image/jpeg");
  const anonymousStorage = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
  expect(
    (
      await anonymousStorage.storage
        .from("school-paper-scans")
        .download(detail.scans[0].image_path)
    ).error,
  ).not.toBeNull();
  const closed = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/grading/sessions/${capturedSession}`) &&
      r.request().method() === "DELETE",
  );
  await page
    .getByRole("button", { name: "Đóng phiên nhận bài", exact: true })
    .click();
  await okay(await closed);
  expect(
    (
      await mobile.request.get(`/api/capture/${capturedSession}`, {
        headers: { authorization: `Bearer ${token}` },
      })
    ).status(),
  ).toBe(410);
  await mobile.close();
  await page
    .getByRole("button", { name: "Làm mới", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Xử lý ảnh chờ", exact: true })
    .click();
  await expect(
    page.getByText("Chờ giáo viên duyệt", { exact: true }),
  ).toBeVisible();
  detail = await okay(await page.request.get(`/api/grading/exams/${examId}`));
  expect(detail.grades).toHaveLength(0);
  expect(detail.scans[0].result.answers).toEqual(answers);
  const early = await page.request.post(
    `/api/grading/scans/${scanId}/approve`,
    {
      data: {
        version: detail.scans[0].version,
        examVersion: detail.exam.version,
        studentId: pupilId,
        variant: "0001",
        answers,
      },
    },
  );
  expect(early.status()).toBe(400);
  await page
    .getByRole("button", { name: `Kiểm tra bài ${scanId}`, exact: true })
    .click();
  const review = page.getByRole("dialog", {
    name: `Kiểm tra bài chụp · ${title}`,
    exact: true,
  });
  await expect(review.locator(".scan-score-preview")).toContainText("10 / 10");
  await expect(
    review.getByRole("button", { name: "Duyệt và ghi điểm", exact: true }),
  ).toBeDisabled();
  await review.getByRole("checkbox").check();
  await review
    .getByRole("button", { name: "Duyệt và ghi điểm", exact: true })
    .click();
  await expect(page.getByText("Đã duyệt", { exact: true })).toBeVisible();
  detail = await okay(await page.request.get(`/api/grading/exams/${examId}`));
  expect(detail.grades).toHaveLength(1);
  expect(detail.grades[0].score).toBe(10);
  expect(detail.scans[0].approval.studentId).toBe(pupilId);
  expect(detail.scans[0].approval.variant).toBe("0001");
  await login(request, admin);
  const state = await workspace(request);
  state.data.students.find((s: { id: string }) => s.id === pupilId).family =
    "Đã cập nhật hồ sơ sau khi chấm";
  await okay(
    await request.put("/api/workspace", {
      data: { data: state.data, revision: state.revision },
    }),
  );
  expect(
    (await okay(await page.request.get(`/api/grading/exams/${examId}`)))
      .grades[0].score,
  ).toBe(10);
});

test("grade permissions, history, stale revisions, export and expired-image cleanup preserve approved marks", async ({
  page,
  request,
}) => {
  test.setTimeout(150_000);
  await login(page.request, teacher);
  await login(request, other);
  expect((await request.get(`/api/grading/exams/${examId}`)).status()).toBe(
    403,
  );
  expect(
    (
      await request.get(
        "/api/grading?year=2026-2027&semester=1&subject=Tin%20h%E1%BB%8Dc",
      )
    ).status(),
  ).toBe(403);
  const direct = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
  const auth = await direct.auth.signInWithPassword({
    email: other.email,
    password: other.password,
  });
  expect(auth.error).toBeNull();
  expect(
    (await direct.from("school_exams").select("id").eq("id", examId)).data,
  ).toEqual([]);
  expect(
    (
      await direct.rpc("school_save_grade", {
        p_actor: teacher.username,
        p_exam: examId,
        p_student: pupilId,
        p_grade: { score: 10, max_score: 10 },
        p_version: 0,
      })
    ).error,
  ).not.toBeNull();
  let detail = await okay(
    await page.request.get(`/api/grading/exams/${examId}`),
  );
  let grade = detail.grades[0];
  expect(
    (
      await page.request.post("/api/grading/grades", {
        data: {
          examId,
          studentId: pupilId,
          score: 11,
          note: "",
          version: grade.version,
        },
      })
    ).status(),
  ).toBe(400);
  await okay(
    await page.request.post("/api/grading/grades", {
      data: {
        examId,
        studentId: pupilId,
        score: 6.5,
        note: "Giáo viên đã đối chiếu bài",
        version: grade.version,
      },
    }),
  );
  expect(
    (
      await page.request.post("/api/grading/grades", {
        data: {
          examId,
          studentId: pupilId,
          score: 9,
          note: "Yêu cầu cũ",
          version: grade.version,
        },
      })
    ).status(),
  ).toBe(409);
  detail = await okay(await page.request.get(`/api/grading/exams/${examId}`));
  grade = detail.grades[0];
  expect(grade.score).toBe(6.5);
  expect(detail.history.length).toBeGreaterThanOrEqual(2);
  expect(detail.scans[0].approval.score).toBe(10);
  const changed = {
    ...detail.exam,
    scoring: { ...detail.exam.scoring, multipleChoicePoints: 2 },
  };
  expect(
    (
      await page.request.put(`/api/grading/exams/${examId}`, { data: changed })
    ).status(),
  ).toBe(400);
  await page.goto("/");
  await choose(page, "Lớp học", `Lớp ${className}`);
  await page.getByRole("button", { name: "Quản lý điểm", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: `Điểm ${pupilName} bài ${title}`,
      exact: true,
    }),
  ).toContainText("6.5");
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Xuất bảng điểm", exact: true })
    .click();
  const path = await (await downloading).path();
  expect((await readSheet(path!, "Bảng điểm học kỳ")).flat()).toContain(6.5);
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path!);
  workbook.eachSheet((s) =>
    s.eachRow((r) =>
      r.eachCell((c) => {
        expect(c.font.name).toBe("Times New Roman");
        expect(c.font.size).toBeGreaterThanOrEqual(14);
      }),
    ),
  );
  await okay(
    await page.request.patch(`/api/grading/exams/${examId}`, {
      data: { archived: true, version: detail.exam.version },
    }),
  );
  await page.getByRole("button", { name: "Làm mới", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: `Điểm ${pupilName} bài ${title}`,
      exact: true,
    }),
  ).toContainText("6.5");
  expect(
    (
      await page.request.get(
        `/grading/exams/${examId}/sheets?student=all&variant=0001`,
      )
    ).status(),
  ).toBe(200);
  await db()
    .from("school_paper_scans")
    .update({ image_expires_at: "2020-01-01T00:00:00Z" })
    .eq("id", scanId);
  expect((await okay(await request.post("/api/grading/cleanup"))).removed).toBe(
    0,
  );
  expect(
    (await okay(await page.request.post("/api/grading/cleanup"))).removed,
  ).toBeGreaterThanOrEqual(1);
  detail = await okay(await page.request.get(`/api/grading/exams/${examId}`));
  expect(detail.scans[0].image_path).toBeNull();
  expect(detail.grades[0].score).toBe(6.5);
  expect(detail.history.length).toBeGreaterThanOrEqual(2);
  await okay(
    await page.request.delete(`/api/grading/grades/${grade.id}`, {
      data: { version: grade.version },
    }),
  );
  detail = await okay(await page.request.get(`/api/grading/exams/${examId}`));
  expect(detail.grades).toHaveLength(0);
  expect(detail.history[0].action).toBe("deleted");
});

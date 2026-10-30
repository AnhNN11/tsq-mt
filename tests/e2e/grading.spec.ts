import {
  test,
  expect,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { newStudent } from "../../lib/model";
import type { Grade } from "../../lib/grading-model";
import { sheetSvg } from "../../lib/sheet-template";
import { loadStaffAccounts, type StaffAccount } from "./staff-accounts";
import type { CaptureInfo } from "../../components/paper-capture";
let admin: StaffAccount,
  teacher: StaffAccount,
  other: StaffAccount,
  examId = "",
  sessionId = "",
  token = "";
const cls = "DIRECT-E2E-CLASS",
  className = "9/96",
  pupil1 = "DIRECT-E2E-PUPIL-1",
  pupil2 = "DIRECT-E2E-PUPIL-2",
  title = "DIRECT-E2E-Bài thi tự đặt tên",
  templateId = "30000000-0000-4000-8000-000000000001";
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
async function okay(r: Pick<APIResponse, "status" | "text" | "json">) {
  expect(r.status(), await r.text()).toBe(200);
  return r.json();
}
async function login(request: APIRequestContext, account: StaffAccount) {
  await okay(
    await request.post("/api/auth/login", {
      data: { username: account.email, password: account.password },
    }),
  );
}
async function state(r: APIRequestContext) {
  return okay(await r.get("/api/workspace"));
}
async function navigate(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Chấm thi", exact: true }).click();
  await page
    .getByRole("button", { name: `Chọn lớp ${className}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Tin học", exact: true }).click();
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
  admin = staff.find((a) => a.role === "admin")!;
  teacher = staff.find((a) => a.username === "nhatanh.nguyen")!;
  other = staff.find(
    (a) => a.role === "teacher" && !a.subjects.includes("Tin học"),
  )!;
});
test.afterAll(async ({ request }) => {
  const service = db(),
    exams = await service.from("school_exams").select("id").eq("class_id", cls);
  expect(exams.error).toBeNull();
  for (const e of exams.data ?? []) {
    for (const table of [
      "school_capture_receipts",
      "school_grade_history",
      "school_grades",
      "school_paper_scans",
      "school_capture_sessions",
      "school_exam_candidates",
    ]) {
      expect(
        (await service.from(table).delete().eq("exam_id", e.id)).error,
      ).toBeNull();
    }
    expect(
      (await service.from("school_exams").delete().eq("id", e.id)).error,
    ).toBeNull();
  }
  expect(
    (
      await service
        .from("school_paper_templates")
        .delete()
        .like("name", "DIRECT-E2E-%")
    ).error,
  ).toBeNull();
  await login(request, admin);
  const current = await state(request);
  if (current.data.classes.some((c: { id: string }) => c.id === cls))
    await okay(
      await request.put("/api/workspace", {
        data: {
          revision: current.revision,
          data: {
            ...current.data,
            classes: current.data.classes.filter(
              (c: { id: string }) => c.id !== cls,
            ),
            students: current.data.students.filter(
              (s: { id: string }) => ![pupil1, pupil2].includes(s.id),
            ),
          },
        },
      }),
    );
});
test("class, subject and custom exam connect a phone; each capture automatically saves once without persisting any photo", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(200_000);
  await login(request, admin);
  const initial = await state(request);
  await okay(
    await request.put("/api/workspace", {
      data: {
        revision: initial.revision,
        data: {
          ...initial.data,
          classes: [
            ...initial.data.classes,
            { id: cls, name: className, track: "Kiểm thử", note: "" },
          ],
          students: [
            ...initial.data.students,
            ...[pupil1, pupil2].map((id, i) => ({
              ...newStudent(),
              id,
              name: `Học sinh giả lập ${i + 1}`,
              className,
              gender: "Nam",
              birthDate: "12/10/2012",
              ethnicity: "Kinh",
              priorEducation: "Tốt",
            })),
          ],
        },
      },
    }),
  );
  await login(page.request, teacher);
  await navigate(page);
  await expect(page.getByRole("combobox", { name: /Học kỳ/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Tạo bài thi", exact: true }).click();
  await page.getByLabel("Tên bài kiểm tra", { exact: true }).fill(title);
  await choose(page, "Mẫu phiếu ô tô", "Phiếu chung ba phần");
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
  examId = (await okay(await created)).exam.id;
  await page.getByRole("button", { name: title, exact: true }).click();
  const connected = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/exams/${examId}/sessions`) &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Kết nối điện thoại bằng QR", exact: true })
    .click();
  const session = await okay(await connected);
  sessionId = session.id;
  token = new URL(session.url).hash.slice(1);
  await expect(page.locator(".ant-qrcode canvas")).toBeVisible();
  const mobile = await browser.newContext({
    baseURL: "http://127.0.0.1:3000",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const phone = await mobile.newPage();
  expect(
    (
      await mobile.request.get(`/api/capture/${sessionId}`, {
        headers: { authorization: `Bearer ${"a".repeat(43)}` },
      })
    ).status(),
  ).toBe(410);
  expect(
    (await mobile.request.get(`/api/grading/exams/${examId}`)).status(),
  ).toBe(401);
  const metadata: CaptureInfo = await okay(
    await mobile.request.get(`/api/capture/${sessionId}`, {
      headers: { authorization: `Bearer ${token}` },
    }),
  );
  expect(metadata.variants).toEqual(["0001"]);
  expect(JSON.stringify(metadata)).not.toContain('"answer_keys"');
  expect(metadata.candidates).toHaveLength(2);
  phone.on("pageerror", (e) => {
    throw e;
  });
  await phone.goto(session.url);
  await expect(
    phone.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(
    phone.getByRole("combobox", { name: "Học sinh đang chụp", exact: true }),
  ).toBeVisible();
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
  const scored = phone.waitForResponse(
    (r) =>
      r.url().includes(`/api/capture/${sessionId}`) &&
      r.request().method() === "POST",
    { timeout: 25000 },
  );
  await phone.getByLabel("Chọn ảnh bài làm", { exact: true }).setInputFiles({
    name: "fake-paper.png",
    mimeType: "image/png",
    buffer: image,
  });
  const result = await okay(await scored);
  expect(result.score).toBe(10);
  await expect(phone.locator(".capture-result")).toContainText(
    "Học sinh giả lập 1: 10 / 10",
  );
  await expect(phone.getByTestId("capture-current-student")).toContainText(
    "Học sinh giả lập 2",
  );
  const secondImage = await sharp(
    Buffer.from(
      sheetSvg({
        answers,
        candidateNumber: "00000002",
        variant: "0001",
        title,
      }),
    ),
  )
    .png()
    .toBuffer();
  const metadataNow: CaptureInfo = await okay(
    await mobile.request.get(`/api/capture/${sessionId}`, {
      headers: { authorization: `Bearer ${token}` },
    }),
  );
  const payload = {
    image: { name: "second.png", mimeType: "image/png", buffer: secondImage },
    studentId: pupil2,
    variant: "0001",
    requestId: randomUUID(),
    examVersion: String(metadataNow.examVersion),
  };
  await okay(
    await mobile.request.post(`/api/capture/${sessionId}`, {
      headers: { authorization: `Bearer ${token}` },
      multipart: payload,
    }),
  );
  const repeated = await okay(
    await mobile.request.post(`/api/capture/${sessionId}`, {
      headers: { authorization: `Bearer ${token}` },
      multipart: payload,
    }),
  );
  expect(repeated.duplicate).toBe(true);
  let detail = await okay(
    await page.request.get(`/api/grading/exams/${examId}`),
  );
  expect(detail.grades).toHaveLength(2);
  expect(detail.scans).toHaveLength(0);
  expect(detail.grades.find((g: Grade) => g.student_id === pupil1).source).toBe(
    "scan",
  );
  expect(
    detail.grades.find((g: Grade) => g.student_id === pupil1).scan_id,
  ).toBeNull();
  expect(detail.exam.template_id).toBe(templateId);
  expect(
    (await db().storage.from("school-paper-scans").list("", { limit: 1000 }))
      .data,
  ).toHaveLength(0);
  expect(
    (
      await mobile.request.post(`/api/capture/${sessionId}`, {
        headers: { authorization: `Bearer ${token}` },
        multipart: {
          ...payload,
          image: { name: "wrong.png", mimeType: "image/png", buffer: image },
          requestId: randomUUID(),
        },
      })
    ).status(),
  ).toBe(422);
  const blank = await sharp(
    Buffer.from(sheetSvg({ variant: "0001", candidateNumber: "00000002" })),
  )
    .png()
    .toBuffer();
  expect(
    (
      await mobile.request.post(`/api/capture/${sessionId}`, {
        headers: { authorization: `Bearer ${token}` },
        multipart: {
          image: { name: "blank.png", mimeType: "image/png", buffer: blank },
          studentId: pupil2,
          variant: "0001",
          requestId: randomUUID(),
          examVersion: String(detail.exam.version),
        },
      })
    ).status(),
  ).toBe(422);
  detail = await okay(await page.request.get(`/api/grading/exams/${examId}`));
  expect(detail.grades).toHaveLength(2);
  expect(detail.history).toHaveLength(2);
  await page
    .getByRole("button", { name: "Ẩn mã, tiếp tục chấm", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", {
      name: "Quét một lần để chấm cả lớp",
      exact: true,
    }),
  ).not.toBeVisible();
  await expect(page.locator(".direct-score").first()).toContainText("10 / 10");
  const closed = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/grading/sessions/${sessionId}`) &&
      r.request().method() === "DELETE",
  );
  await page
    .getByRole("button", { name: "Đóng kết nối điện thoại", exact: true })
    .click();
  await okay(await closed);
  expect(
    (
      await mobile.request.get(`/api/capture/${sessionId}`, {
        headers: { authorization: `Bearer ${token}` },
      })
    ).status(),
  ).toBe(410);
  await mobile.close();
});
test("templates have CRUD and subject permissions; frozen exam layouts, grade history, exports and revision guards preserve results", async ({
  page,
  request,
}) => {
  test.setTimeout(160_000);
  await login(page.request, teacher);
  await login(request, other);
  expect((await request.get(`/api/grading/exams/${examId}`)).status()).toBe(
    403,
  );
  expect(
    (
      await request.get("/api/grading/templates?subject=Tin%20h%E1%BB%8Dc")
    ).status(),
  ).toBe(403);
  let detail = await okay(
    await page.request.get(`/api/grading/exams/${examId}`),
  );
  const original = JSON.stringify(detail.exam.paper_template);
  const created = await okay(
    await page.request.post("/api/grading/templates", {
      data: {
        name: "DIRECT-E2E-Mẫu riêng",
        subject: "Tin học",
        groups: detail.exam.paper_template,
      },
    }),
  );
  const t = created.template;
  const draft = await okay(
    await page.request.post("/api/grading/exams", {
      data: {
        ...detail.exam,
        title: "DIRECT-E2E-Bài thi giữ mẫu riêng",
        template_id: t.id,
        template_version: t.version,
      },
    }),
  );

  expect(
    (
      await request.post("/api/grading/templates", {
        data: {
          id: t.id,
          version: t.version,
          name: "DIRECT-E2E-Không được sửa",
          subject: "Tiếng Anh",
          groups: t.groups,
        },
      })
    ).status(),
  ).toBe(403);
  const updated = await okay(
    await page.request.post("/api/grading/templates", {
      data: {
        ...t,
        name: "DIRECT-E2E-Mẫu đã sửa",
        groups: t.groups.map(
          (g: { points: { x: number; y: number }[] }, i: number) =>
            i === 0
              ? {
                  ...g,
                  points: g.points.map((p) => ({ ...p, x: p.x + 0.001 })),
                }
              : g,
        ),
      },
    }),
  );
  expect(
    (
      await page.request.post("/api/grading/templates", {
        data: { ...t, name: "DIRECT-E2E-Yêu cầu cũ" },
      })
    ).status(),
  ).toBe(409);
  await okay(
    await page.request.delete("/api/grading/templates", {
      data: { id: t.id, version: updated.template.version },
    }),
  );
  expect(
    (await okay(await page.request.get(`/api/grading/exams/${examId}`))).exam
      .paper_template,
  ).toEqual(JSON.parse(original));
  expect(
    (await okay(await page.request.get(`/api/grading/exams/${draft.exam.id}`)))
      .exam.paper_template,
  ).toEqual(JSON.parse(original));
  const direct = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
  await direct.auth.signInWithPassword({
    email: other.email,
    password: other.password,
  });
  expect(
    (await direct.from("school_exams").select("id").eq("id", examId)).data,
  ).toEqual([]);
  expect(
    (await direct.from("school_capture_receipts").select("*")).error,
  ).not.toBeNull();
  expect(
    (
      await direct.rpc("school_capture_grade", {
        p_session: sessionId,
        p_hash: "a".repeat(64),
        p_request: randomUUID(),
        p_image_hash: "b".repeat(64),
        p_student: pupil1,
        p_exam_version: 1,
        p_grade: { score: 10, max_score: 10, variant: "0001" },
      })
    ).error,
  ).not.toBeNull();
  let grade = detail.grades.find((g: Grade) => g.student_id === pupil1);
  expect(
    (
      await page.request.post("/api/grading/grades", {
        data: {
          examId,
          studentId: pupil1,
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
        studentId: pupil1,
        score: 6.5,
        note: "Đã đối chiếu bài giấy",
        version: grade.version,
      },
    }),
  );
  expect(
    (
      await page.request.post("/api/grading/grades", {
        data: {
          examId,
          studentId: pupil1,
          score: 9,
          note: "Yêu cầu cũ",
          version: grade.version,
        },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await page.request.delete(`/api/grading/exams/${examId}`, {
        data: { version: detail.exam.version },
      })
    ).status(),
  ).toBe(400);
  await login(request, admin);
  const current = await state(request);
  current.data.students.find((s: { id: string }) => s.id === pupil1).family =
    "Đã cập nhật sau khi chấm";
  await okay(
    await request.put("/api/workspace", {
      data: { data: current.data, revision: current.revision },
    }),
  );
  detail = await okay(await page.request.get(`/api/grading/exams/${examId}`));
  expect(detail.grades.find((g: Grade) => g.student_id === pupil1).score).toBe(
    6.5,
  );
  expect(detail.history.length).toBeGreaterThanOrEqual(2);
  expect(
    (
      await page.request.put(`/api/grading/exams/${examId}`, {
        data: {
          ...detail.exam,
          scoring: { ...detail.exam.scoring, multipleChoicePoints: 2 },
        },
      })
    ).status(),
  ).toBe(400);
  await navigate(page);
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Xuất bảng điểm", exact: true })
    .click();
  const path = await (await downloading).path(),
    ExcelJS = (await import("exceljs")).default,
    book = new ExcelJS.Workbook();
  await book.xlsx.readFile(path!);
  let found = false;
  book.eachSheet((s) =>
    s.eachRow((r) =>
      r.eachCell((c) => {
        expect(c.font.name).toBe("Times New Roman");
        expect(c.font.size).toBeGreaterThanOrEqual(14);
        if (c.value === 6.5) found = true;
      }),
    ),
  );
  expect(found).toBe(true);
  expect(JSON.stringify(book.getWorksheet(1)?.getRow(3).values)).not.toContain(
    "Học kỳ",
  );
  await okay(
    await page.request.patch(`/api/grading/exams/${examId}`, {
      data: { archived: true, version: detail.exam.version },
    }),
  );
  expect(
    (
      await okay(await page.request.get(`/api/grading/exams/${examId}`))
    ).grades.find((g: Grade) => g.student_id === pupil1).score,
  ).toBe(6.5);
  expect(
    (await page.request.post(`/api/grading/exams/${examId}/sessions`)).status(),
  ).toBe(400);
  const printed = await page.request.get(
    `/grading/exams/${examId}/sheets?student=all&variant=0001`,
  );
  expect(printed.status()).toBe(200);
  expect(await printed.text()).toContain("Phiếu trả lời");
  detail = await okay(await page.request.get(`/api/grading/exams/${examId}`));
  await okay(
    await page.request.patch(`/api/grading/exams/${examId}`, {
      data: { archived: false, version: detail.exam.version },
    }),
  );
  grade = detail.grades.find((g: Grade) => g.student_id === pupil1);
  await okay(
    await page.request.delete(`/api/grading/grades/${grade.id}`, {
      data: { version: grade.version },
    }),
  );
  detail = await okay(await page.request.get(`/api/grading/exams/${examId}`));
  expect(
    detail.grades.find((g: Grade) => g.student_id === pupil1),
  ).toBeUndefined();
  expect(detail.grades).toHaveLength(1);
  expect(detail.history[0].action).toBe("deleted");
  // Empty exam deletion is a real CRUD path; existing marked exams stay protected.
  const empty = await okay(
    await page.request.post("/api/grading/exams", {
      data: {
        ...detail.exam,
        title: "DIRECT-E2E-Bài thi được xóa",
        template_version: 1,
      },
    }),
  );
  await okay(
    await page.request.delete(`/api/grading/exams/${empty.exam.id}`, {
      data: { version: empty.exam.version },
    }),
  );
  expect(
    (await page.request.get(`/api/grading/exams/${empty.exam.id}`)).status(),
  ).toBe(404);
});

test("teacher creates, views, renames and removes a subject template through the table interface", async ({
  page,
}) => {
  test.setTimeout(100_000);
  await login(page.request, teacher);
  await navigate(page);
  await page
    .getByRole("button", { name: "Mẫu phiếu ô tô", exact: true })
    .click();
  const catalog = page.getByRole("dialog", {
    name: "Mẫu phiếu ô tô · Tin học",
    exact: true,
  });
  const base = catalog
    .getByRole("row")
    .filter({ hasText: "Phiếu chung ba phần" });
  await expect(
    base.getByRole("button", { name: "Sửa", exact: true }),
  ).toBeDisabled();
  await base.getByRole("button", { name: "Tạo từ mẫu", exact: true }).click();
  let editor = page.getByRole("dialog", {
    name: "Tạo mẫu phiếu mới",
    exact: true,
  });
  await editor
    .getByRole("textbox", { name: "Tên mẫu phiếu", exact: true })
    .fill("DIRECT-E2E-Mẫu giao diện");
  await expect(editor.locator("svg ellipse")).toHaveCount(602);
  await editor
    .getByRole("button", { name: "Lưu mẫu phiếu", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  let row = catalog
    .getByRole("row")
    .filter({ hasText: "DIRECT-E2E-Mẫu giao diện" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Sửa", exact: true }).click();
  editor = page.getByRole("dialog", { name: "Sửa mẫu phiếu", exact: true });
  await editor
    .getByRole("textbox", { name: "Tên mẫu phiếu", exact: true })
    .fill("DIRECT-E2E-Mẫu giao diện đã sửa");
  await editor
    .getByRole("button", { name: "Lưu mẫu phiếu", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  row = catalog
    .getByRole("row")
    .filter({ hasText: "DIRECT-E2E-Mẫu giao diện đã sửa" });
  await row.getByRole("button", { name: "Xem mẫu", exact: true }).click();
  const preview = page.getByRole("dialog", {
    name: "Xem bố cục mẫu phiếu",
    exact: true,
  });
  await expect(preview.locator("svg ellipse")).toHaveCount(602);
  await preview
    .getByRole("button", { name: "Đóng", exact: true })
    .last()
    .click();
  await expect(preview).not.toBeVisible();
  await row.getByRole("button", { name: "Xóa", exact: true }).click();
  await page.getByRole("button", { name: "Xóa mẫu", exact: true }).click();
  await expect(
    catalog
      .getByRole("row")
      .filter({ hasText: "DIRECT-E2E-Mẫu giao diện đã sửa" }),
  ).toHaveCount(0);
});

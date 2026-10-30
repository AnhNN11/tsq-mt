import { createHash } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  gradingRoute,
  captureSession,
  databaseError,
  GradingError,
  uuid,
} from "@/lib/grading-server";
import { recognizePaper } from "@/lib/omr";
import {
  automaticPaperProblem,
  checkedLayout,
  COMMON_LAYOUT,
  layoutCovers,
} from "@/lib/paper-template-model";
import { scoreAnswers } from "@/lib/grading-model";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, ctx: Context) {
  return gradingRoute(async () => {
    const { id } = await ctx.params;
    const { session, exam } = await captureSession(id, request),
      db = createAdminClient();
    const results = await Promise.all([
      db
        .from("school_exam_candidates")
        .select("student_id,student_name,candidate_number")
        .eq("exam_id", exam.id)
        .order("candidate_number"),
      db
        .from("school_grades")
        .select("student_id,score,max_score,version")
        .eq("exam_id", exam.id)
        .is("deleted_at", null),
    ]);
    results.forEach((r) => databaseError(r.error));
    return {
      title: exam.title,
      className: exam.class_name,
      subject: exam.subject,
      templateName: exam.template_name || "Mẫu phiếu đã cung cấp",
      expiresAt: session.expires_at,
      remaining: session.max_uploads - session.upload_count,
      examVersion: exam.version,
      variants: exam.answer_keys.map((k) => k.code),
      candidates: results[0].data,
      grades: results[1].data,
    };
  });
}
export async function POST(request: Request, ctx: Context) {
  return gradingRoute(async () => {
    const { id } = await ctx.params;
    const { hash, session, exam } = await captureSession(id, request);
    if (Number(request.headers.get("content-length")) > 4 * 1024 * 1024)
      throw new GradingError("Ảnh phải nhỏ hơn 3,5 MB.", 413);
    let body: FormData;
    try {
      body = await request.formData();
    } catch {
      throw new GradingError(
        "Dữ liệu ảnh gửi lên chưa hợp lệ. Chọn lại ảnh và thử lại.",
      );
    }
    const file = body.get("image"),
      student = body.get("studentId"),
      variant = body.get("variant"),
      requestId = body.get("requestId"),
      version = Number(body.get("examVersion"));
    if (
      typeof student !== "string" ||
      !student ||
      student.length > 150 ||
      typeof variant !== "string" ||
      typeof requestId !== "string" ||
      !uuid(requestId) ||
      !Number.isSafeInteger(version)
    )
      throw new GradingError("Chọn học sinh, mã đề và tải lại phiên chấm.");
    if (version !== exam.version)
      throw new GradingError(
        "Bài thi vừa được sửa. Làm mới rồi chụp lại.",
        409,
      );
    const key = exam.answer_keys.find((k) => k.code === variant);
    if (!key) throw new GradingError("Mã đề chưa có đáp án.");
    const candidate = await createAdminClient()
      .from("school_exam_candidates")
      .select("candidate_number")
      .eq("exam_id", exam.id)
      .eq("student_id", student)
      .maybeSingle();
    databaseError(candidate.error);
    if (!candidate.data)
      throw new GradingError("Học sinh không thuộc bài thi này.");
    if (
      !(file instanceof File) ||
      file.size < 100 ||
      file.size > 3.5 * 1024 * 1024
    )
      throw new GradingError("Chọn ảnh JPEG/PNG/WebP dưới 3,5 MB.", 413);
    // The photo lives only in request memory. Never write it to disk, Storage or a database.
    let image: Buffer;
    try {
      const input = Buffer.from(await file.arrayBuffer()),
        meta = await sharp(input, { limitInputPixels: 24_000_000 }).metadata();
      if (
        !["jpeg", "png", "webp"].includes(meta.format ?? "") ||
        (meta.pages ?? 1) > 1
      )
        throw new Error();
      const output = await sharp(input, {
        limitInputPixels: 24_000_000,
        failOn: "error",
      })
        .autoOrient()
        .resize({
          width: 2200,
          height: 2200,
          fit: "inside",
          withoutEnlargement: true,
        })
        .flatten({ background: "white" })
        .jpeg({ quality: 90 })
        .toBuffer({ resolveWithObject: true });
      if (output.info.width < 600 || output.info.height < 600)
        throw new Error();
      image = output.data;
    } catch {
      throw new GradingError(
        "Ảnh không đọc được hoặc quá nhỏ. Chụp rõ toàn bộ phiếu và bốn dấu vuông góc.",
        415,
      );
    }
    let result;
    try {
      const groups = checkedLayout(exam.paper_template ?? COMMON_LAYOUT);
      layoutCovers(groups, exam.scoring);
      result = await recognizePaper(image, exam.scoring, undefined, groups);
    } catch (e) {
      throw new GradingError((e as Error).message, 422);
    }
    const problem = automaticPaperProblem(result, exam.scoring);
    if (problem) throw new GradingError(problem, 422);
    if (
      result.candidateNumber &&
      result.candidateNumber !== candidate.data.candidate_number
    )
      throw new GradingError(
        "Số báo danh trên phiếu khác học sinh đang chọn. Chọn đúng học sinh trước khi chấm.",
        422,
      );
    if (result.variant && result.variant !== variant)
      throw new GradingError(
        "Mã đề trên phiếu khác mã đề đang chọn. Chọn lại mã đề trước khi chấm.",
        422,
      );
    const scored = scoreAnswers(exam.scoring, key.answers, result.answers);
    const saved = await createAdminClient().rpc("school_capture_grade", {
      p_session: id,
      p_hash: hash,
      p_request: requestId,
      p_image_hash: createHash("sha256").update(image).digest("hex"),
      p_student: student,
      p_exam_version: exam.version,
      p_grade: { score: scored.score, max_score: scored.maxScore, variant },
    });
    databaseError(saved.error);
    const grade = saved.data.grade;
    return {
      duplicate: saved.data.duplicate,
      studentId: grade.student_id,
      studentName: grade.student_name,
      score: grade.score,
      maxScore: grade.max_score,
      version: grade.version,
      remaining:
        session.max_uploads -
        session.upload_count -
        (saved.data.duplicate ? 0 : 1),
      message: saved.data.duplicate
        ? "Bài này đã được chấm và lưu trước đó."
        : "Đã chấm và lưu điểm. Ảnh không được lưu lại.",
    };
  });
}

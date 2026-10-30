import { createAdminClient } from "@/utils/supabase/admin";
import {
  gradeUser,
  gradingRoute,
  gradeScan,
  gradingBody,
  databaseError,
  GradingError,
} from "@/lib/grading-server";
import { checkedAnswers, scoreAnswers } from "@/lib/grading-model";
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return gradingRoute(async () => {
    const user = await gradeUser(request);
    const { id } = await ctx.params;
    const { scan, exam } = await gradeScan(id, user, true);
    const body = await gradingBody(request);
    if (!scan.image_path)
      throw new GradingError(
        "Ảnh tạm đã được dọn. Nhập điểm trực tiếp từ bài giấy nếu giáo viên còn giữ bài.",
      );
    if (
      scan.status !== "review" ||
      !Number.isSafeInteger(body.version) ||
      !Number.isSafeInteger(body.examVersion) ||
      typeof body.studentId !== "string"
    )
      throw new GradingError("Chọn học sinh và bài đang chờ duyệt.");
    if (body.acknowledged !== true)
      throw new GradingError(
        "Giáo viên cần xác nhận đã đối chiếu ảnh, học sinh và đáp án trước khi ghi điểm.",
      );
    const key = exam.answer_keys.find((k) => k.code === body.variant);
    if (!key)
      throw new GradingError(
        "Mã đề chưa có đáp án. Chọn đúng mã đề trước khi duyệt.",
      );
    let answers, score;
    try {
      answers = checkedAnswers(body.answers, exam.scoring);
      score = scoreAnswers(exam.scoring, key.answers, answers);
    } catch (e) {
      throw new GradingError((e as Error).message);
    }
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note.length > 2000)
      throw new GradingError("Ghi chú tối đa 2.000 ký tự.");
    const { data, error } = await createAdminClient().rpc("school_save_grade", {
      p_actor: user.username,
      p_exam: exam.id,
      p_student: body.studentId,
      p_grade: {
        score: score.score,
        max_score: score.maxScore,
        variant: key.code,
        answers,
        note,
      },
      p_version: Number.isSafeInteger(body.replaceVersion)
        ? body.replaceVersion
        : 0,
      p_scan: id,
      p_scan_version: body.version,
      p_exam_version: body.examVersion,
    });
    databaseError(error);
    return { grade: data };
  });
}

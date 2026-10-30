import { createAdminClient } from "@/utils/supabase/admin";
import {
  gradeUser,
  gradingRoute,
  gradeExam,
  gradingBody,
  databaseError,
  GradingError,
} from "@/lib/grading-server";
import { roundScore, maxExamScore } from "@/lib/grading-model";
export async function POST(request: Request) {
  return gradingRoute(async () => {
    const user = await gradeUser(request);
    const body = await gradingBody(request);
    const exam = await gradeExam(body.examId, user, true);
    const max = roundScore(maxExamScore(exam.scoring));
    if (
      typeof body.score !== "number" ||
      !Number.isFinite(body.score) ||
      body.score < 0 ||
      body.score > max ||
      typeof body.studentId !== "string" ||
      !Number.isSafeInteger(body.version) ||
      typeof body.note !== "string" ||
      body.note.trim().length > 2000
    )
      throw new GradingError(
        `Điểm phải từ 0 đến ${max}; ghi chú tối đa 2.000 ký tự.`,
      );
    const { data, error } = await createAdminClient().rpc("school_save_grade", {
      p_actor: user.username,
      p_exam: exam.id,
      p_student: body.studentId,
      p_grade: {
        score: roundScore(body.score),
        max_score: max,
        note: body.note.trim(),
      },
      p_version: body.version,
    });
    databaseError(error);
    return { grade: data };
  });
}

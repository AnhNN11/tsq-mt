import { createAdminClient } from "@/utils/supabase/admin";
import {
  gradeUser,
  gradingRoute,
  gradeExam,
  gradingBody,
  databaseError,
  GradingError,
} from "@/lib/grading-server";
import { readWorkspace } from "@/lib/server-workspace";
import type { ExamCandidate } from "@/lib/grading-model";
export async function PUT(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return gradingRoute(async () => {
    const user = await gradeUser(request);
    const { id } = await ctx.params;
    const exam = await gradeExam(id, user, true);
    const body = await gradingBody(request);
    if (
      !Array.isArray(body.candidates) ||
      body.candidates.length > 1000 ||
      !Number.isSafeInteger(body.version)
    )
      throw new GradingError("Danh sách dự thi chưa hợp lệ.");
    const { data } = await readWorkspace();
    const cls = data.classes.find((c) => c.id === exam.class_id);
    if (!cls) throw new GradingError("Lớp học đã ngừng sử dụng.");
    const previous = await createAdminClient()
      .from("school_exam_candidates")
      .select("*")
      .eq("exam_id", id);
    databaseError(previous.error);
    const candidates = body.candidates.map((c: ExamCandidate) => {
      if (!c || typeof c.student_id !== "string")
        throw new GradingError("Học sinh dự thi chưa hợp lệ.");
      const pupil = data.students.find(
        (s) => s.id === c.student_id && s.className === cls.name,
      );
      const historic = previous.data?.find(
        (p) =>
          p.student_id === c.student_id &&
          p.candidate_number === c.candidate_number,
      );
      if (
        (!pupil && !historic) ||
        typeof c.candidate_number !== "string" ||
        !/^\d{8}$/.test(c.candidate_number)
      )
        throw new GradingError(
          "Mỗi học sinh phải thuộc đúng lớp và có số báo danh gồm 8 chữ số.",
        );
      return {
        student_id: pupil?.id ?? historic!.student_id,
        student_name: pupil?.name ?? historic!.student_name,
        candidate_number: c.candidate_number,
      };
    });
    if (
      new Set(candidates.map((c: ExamCandidate) => c.student_id)).size !==
        candidates.length ||
      new Set(candidates.map((c: ExamCandidate) => c.candidate_number)).size !==
        candidates.length
    )
      throw new GradingError("Không để trùng học sinh hoặc số báo danh.");
    const result = await createAdminClient().rpc(
      "school_save_exam_candidates",
      {
        p_actor: user.username,
        p_exam: id,
        p_version: body.version,
        p_roster: candidates,
      },
    );
    databaseError(result.error);
    return { ok: true };
  });
}

import { createAdminClient } from "@/utils/supabase/admin";
import {
  gradeUser,
  gradingRoute,
  gradeExam,
  gradingBody,
  databaseError,
  GradingError,
} from "@/lib/grading-server";
import { checkedExam } from "@/lib/grading-model";
import { readWorkspace } from "@/lib/server-workspace";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, ctx: Context) {
  return gradingRoute(async () => {
    const user = await gradeUser();
    const { id } = await ctx.params;
    const exam = await gradeExam(id, user);
    const db = createAdminClient();
    const results = await Promise.all([
      db
        .from("school_exam_candidates")
        .select("*")
        .eq("exam_id", id)
        .order("candidate_number"),
      db
        .from("school_paper_scans")
        .select("*")
        .eq("exam_id", id)
        .order("created_at", { ascending: false })
        .limit(200),
      db
        .from("school_grades")
        .select("*")
        .eq("exam_id", id)
        .is("deleted_at", null),
      db
        .from("school_grade_history")
        .select("id,actor,action,previous_value,next_value,created_at")
        .eq("exam_id", id)
        .order("id", { ascending: false })
        .limit(100),
    ]);
    results.forEach((r) => databaseError(r.error));
    return {
      exam,
      candidates: results[0].data ?? [],
      scans: results[1].data ?? [],
      grades: results[2].data ?? [],
      history: results[3].data ?? [],
    };
  });
}
export async function PUT(request: Request, ctx: Context) {
  return gradingRoute(async () => {
    const user = await gradeUser(request);
    const { id } = await ctx.params;
    const old = await gradeExam(id, user, true);
    const body = await gradingBody(request);
    let exam;
    try {
      exam = checkedExam(body);
    } catch (e) {
      throw new GradingError((e as Error).message);
    }
    if (exam.class_id !== old.class_id || exam.subject !== old.subject)
      throw new GradingError(
        "Lớp và môn được giữ nguyên theo danh sách dự thi. Tạo bài kiểm tra mới nếu cần đổi lớp hoặc môn.",
      );
    const { data } = await readWorkspace();
    const cls = data.classes.find((c) => c.id === exam.class_id);
    if (!cls) throw new GradingError("Lớp học không còn trong hệ thống.");
    const { data: saved, error } = await createAdminClient().rpc(
      "school_save_exam",
      {
        p_actor: user.username,
        p_exam: { ...exam, id: old.id, class_name: cls.name },
        p_version: body.version,
        p_roster: [],
      },
    );
    databaseError(error);
    return { exam: saved };
  });
}
export async function PATCH(request: Request, ctx: Context) {
  return gradingRoute(async () => {
    const user = await gradeUser(request);
    const { id } = await ctx.params;
    await gradeExam(id, user);
    const body = await gradingBody(request);
    if (
      typeof body.archived !== "boolean" ||
      !Number.isSafeInteger(body.version)
    )
      throw new GradingError("Thông tin lưu trữ chưa hợp lệ.");
    const db = createAdminClient();
    const { data, error } = await db
      .from("school_exams")
      .update({
        archived: body.archived,
        version: body.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("version", body.version)
      .select("id")
      .maybeSingle();
    databaseError(error);
    if (!data)
      throw new GradingError(
        "Bài kiểm tra vừa thay đổi. Tải lại danh sách.",
        409,
      );
    if (body.archived) {
      const closed = await db
        .from("school_capture_sessions")
        .update({ active: false })
        .eq("exam_id", id);
      databaseError(closed.error);
    }
    return { ok: true };
  });
}

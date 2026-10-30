import { createAdminClient } from "@/utils/supabase/admin";
import {
  gradeUser,
  gradingRoute,
  gradeExam,
  gradingBody,
  databaseError,
  GradingError,
  uuid,
} from "@/lib/grading-server";
export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return gradingRoute(async () => {
    const user = await gradeUser(request);
    const { id } = await ctx.params;
    const body = await gradingBody(request);
    if (!uuid(id) || !Number.isSafeInteger(body.version))
      throw new GradingError("Thông tin điểm chưa hợp lệ.");
    const db = createAdminClient();
    const record = await db
      .from("school_grades")
      .select("exam_id")
      .eq("id", id)
      .maybeSingle();
    databaseError(record.error);
    if (!record.data) throw new GradingError("Không tìm thấy điểm.", 404);
    await gradeExam(record.data.exam_id, user);
    const result = await db.rpc("school_delete_grade", {
      p_actor: user.username,
      p_id: id,
      p_version: body.version,
    });
    databaseError(result.error);
    return { ok: true };
  });
}

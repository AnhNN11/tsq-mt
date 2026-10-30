import { createAdminClient } from "@/utils/supabase/admin";
import {
  gradeUser,
  gradingRoute,
  gradeExam,
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
    if (!uuid(id)) throw new GradingError("Không tìm thấy phiên chụp.", 404);
    const db = createAdminClient();
    const { data, error } = await db
      .from("school_capture_sessions")
      .select("exam_id")
      .eq("id", id)
      .maybeSingle();
    databaseError(error);
    if (!data) throw new GradingError("Không tìm thấy phiên chụp.", 404);
    await gradeExam(data.exam_id, user);
    const result = await db
      .from("school_capture_sessions")
      .update({ active: false })
      .eq("id", id);
    databaseError(result.error);
    return { ok: true };
  });
}

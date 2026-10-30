import { createAdminClient } from "@/utils/supabase/admin";
import {
  gradeUser,
  gradingRoute,
  gradeScan,
  gradingBody,
  databaseError,
  GradingError,
} from "@/lib/grading-server";
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return gradingRoute(async () => {
    const user = await gradeUser(request);
    const { id } = await ctx.params;
    const { scan } = await gradeScan(id, user);
    const body = await gradingBody(request);
    if (
      !["uploaded", "review", "failed"].includes(scan.status) ||
      body.status !== "rejected" ||
      body.version !== scan.version
    )
      throw new GradingError(
        "Bài đã thay đổi hoặc đã duyệt; không thể loại ảnh.",
        409,
      );
    const { data, error } = await createAdminClient()
      .from("school_paper_scans")
      .update({
        status: "rejected",
        reviewed_by: user.username,
        version: scan.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("version", scan.version)
      .select("id")
      .maybeSingle();
    databaseError(error);
    if (!data)
      throw new GradingError("Bài vừa thay đổi. Tải lại danh sách.", 409);
    return { ok: true };
  });
}

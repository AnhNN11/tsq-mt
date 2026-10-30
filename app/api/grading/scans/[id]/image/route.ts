import { createAdminClient } from "@/utils/supabase/admin";
import {
  gradeUser,
  gradingRoute,
  gradeScan,
  PAPER_BUCKET,
  GradingError,
} from "@/lib/grading-server";
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return gradingRoute(async () => {
    const user = await gradeUser();
    const { id } = await ctx.params;
    const { scan } = await gradeScan(id, user);
    if (!scan.image_path)
      throw new GradingError("Ảnh tạm đã hết thời gian lưu và được dọn.", 410);
    const { data, error } = await createAdminClient()
      .storage.from(PAPER_BUCKET)
      .createSignedUrl(scan.image_path, 300);
    if (error || !data) throw new GradingError("Chưa mở được ảnh tạm.", 503);
    return Response.redirect(data.signedUrl, 307);
  });
}

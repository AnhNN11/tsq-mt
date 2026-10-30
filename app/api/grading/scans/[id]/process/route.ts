import { createAdminClient } from "@/utils/supabase/admin";
import {
  gradeUser,
  gradingRoute,
  gradeScan,
  gradingBody,
  databaseError,
  GradingError,
  PAPER_BUCKET,
} from "@/lib/grading-server";
import { recognizePaper, validCorners } from "@/lib/omr";
import { emptyAnswers } from "@/lib/grading-model";
export const maxDuration = 60;
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return gradingRoute(async () => {
    const user = await gradeUser(request);
    const { id } = await ctx.params;
    const { scan, exam } = await gradeScan(id, user, true);
    const body = await gradingBody(request);
    if (
      !Number.isSafeInteger(body.version) ||
      (body.corners !== undefined && !validCorners(body.corners))
    )
      throw new GradingError("Thông tin căn chỉnh ảnh chưa hợp lệ.");
    const db = createAdminClient();
    const claimed = await db.rpc("school_claim_paper", {
      p_actor: user.username,
      p_scan: id,
      p_version: body.version,
    });
    databaseError(claimed.error);
    let result = null,
      errorText = "";
    try {
      if (body.manual === true)
        result = {
          answers: emptyAnswers(exam.scoring),
          candidateNumber: "",
          variant: "",
          warnings: [
            "Đáp án được giáo viên nhập thủ công từ ảnh; cần đối chiếu đầy đủ trước khi duyệt.",
          ],
          confidence: 0,
          corners: [],
          width: scan.image_width,
          height: scan.image_height,
          marks: [],
        };
      else {
        const image = await db.storage
          .from(PAPER_BUCKET)
          .download(scan.image_path!);
        if (image.error || !image.data)
          throw new Error("Chưa tải được ảnh tạm. Thử lại hoặc chụp lại bài.");
        result = await recognizePaper(
          Buffer.from(await image.data.arrayBuffer()),
          exam.scoring,
          body.corners,
        );
      }
      if (
        result.variant &&
        !exam.answer_keys.some((k) => k.code === result!.variant)
      )
        result.warnings.unshift(
          "Mã đề đọc được chưa có đáp án trong bài kiểm tra. Chọn lại mã đề hoặc bổ sung đáp án.",
        );
    } catch (e) {
      errorText = (e as Error).message;
    }
    const saved = await db.rpc("school_finish_paper", {
      p_actor: user.username,
      p_scan: id,
      p_version: claimed.data.version,
      p_exam_version: exam.version,
      p_result: result,
      p_error: errorText,
    });
    if (["40001", "PT409"].includes(saved.error?.code ?? ""))
      await db
        .from("school_paper_scans")
        .update({
          status: "failed",
          error_text: "Đáp án vừa thay đổi. Hãy nhận dạng lại bài.",
          version: claimed.data.version + 1,
        })
        .eq("id", id)
        .eq("version", claimed.data.version)
        .eq("status", "processing");
    databaseError(saved.error);
    return { scan: saved.data };
  });
}

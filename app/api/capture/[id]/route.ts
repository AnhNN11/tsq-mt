import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  gradingRoute,
  captureSession,
  PAPER_BUCKET,
  databaseError,
  GradingError,
} from "@/lib/grading-server";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, ctx: Context) {
  return gradingRoute(async () => {
    const { id } = await ctx.params;
    const { session, exam } = await captureSession(id, request);
    return {
      title: exam.title,
      schoolYear: exam.school_year,
      semester: exam.semester,
      expiresAt: session.expires_at,
      remaining: session.max_uploads - session.upload_count,
    };
  });
}
export async function POST(request: Request, ctx: Context) {
  return gradingRoute(async () => {
    const { id } = await ctx.params;
    const { hash, session } = await captureSession(id, request);
    if (session.upload_count >= session.max_uploads)
      throw new GradingError("Phiên đã đủ số ảnh. Giáo viên cần mở phiên mới.");
    if (Number(request.headers.get("content-length")) > 4 * 1024 * 1024)
      throw new GradingError(
        "Ảnh quá lớn. Chụp lại hoặc chọn ảnh dưới 3,5 MB.",
        413,
      );
    const body = await request.formData();
    const file = body.get("image");
    if (
      !(file instanceof File) ||
      file.size < 100 ||
      file.size > 3.5 * 1024 * 1024
    )
      throw new GradingError(
        "Chọn một ảnh JPEG, PNG hoặc WebP dưới 3,5 MB.",
        413,
      );
    const input = Buffer.from(await file.arrayBuffer());
    let image: Buffer, info: { width: number; height: number };
    try {
      const meta = await sharp(input, {
        limitInputPixels: 24_000_000,
        failOn: "error",
      }).metadata();
      if (
        !["jpeg", "png", "webp"].includes(meta.format ?? "") ||
        (meta.pages ?? 1) > 1
      )
        throw new Error("format");
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
      image = output.data;
      info = output.info;
      if (info.width < 600 || info.height < 600) throw new Error("resolution");
    } catch {
      throw new GradingError(
        "Ảnh không đọc được hoặc quá nhỏ. Dùng JPEG/PNG/WebP, chụp rõ toàn bộ phiếu và bốn ô vuông góc.",
        415,
      );
    }
    const db = createAdminClient();
    const scanId = randomUUID();
    const imageHash = createHash("sha256").update(image).digest("hex");
    const reserved = await db.rpc("school_reserve_paper", {
      p_session: id,
      p_token_hash: hash,
      p_scan: scanId,
      p_hash: imageHash,
      p_width: info.width,
      p_height: info.height,
    });
    databaseError(reserved.error);
    const paper = reserved.data;
    if (paper.id !== scanId)
      return {
        id: paper.id,
        duplicate: true,
        message: "Ảnh này đã được nhận trước đó; không tạo bài trùng.",
      };
    const uploaded = await db.storage
      .from(PAPER_BUCKET)
      .upload(paper.image_path, image, {
        contentType: "image/jpeg",
        upsert: false,
      });
    if (uploaded.error) {
      await db
        .from("school_paper_scans")
        .delete()
        .eq("id", scanId)
        .eq("status", "uploaded");
      throw new GradingError(
        "Chưa lưu được ảnh. Giữ ảnh trên điện thoại và gửi lại.",
        503,
      );
    }
    return {
      id: scanId,
      message:
        "Đã lưu ảnh tạm. Giáo viên sẽ nhận dạng và duyệt trước khi ghi điểm.",
    };
  });
}

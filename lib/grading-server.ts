import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { currentUser, sameOrigin } from "./auth";
import { canAssess, type AppUser } from "./access";
import { createAdminClient } from "@/utils/supabase/admin";
import type { Exam, PaperScan } from "./grading-model";

export const PAPER_BUCKET = "school-paper-scans";
export class GradingError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function databaseError(
  error: { code?: string; message: string } | null,
) {
  if (!error) return;
  if (["42P01", "PGRST202", "PGRST205"].includes(error.code ?? ""))
    throw new GradingError(
      "Chưa khởi tạo chức năng bảng điểm trên Supabase. Cần áp dụng migration quản lý điểm.",
      503,
    );
  if (error.code === "42501")
    throw new GradingError(
      "Bạn không có quyền thực hiện thao tác hoặc phiên chụp đã hết hạn.",
      403,
    );
  if (["40001", "PT409"].includes(error.code ?? ""))
    throw new GradingError(
      "Dữ liệu hoặc đáp án vừa thay đổi, hoặc học sinh đã có điểm. Tải lại và kiểm tra trước khi lưu.",
      409,
    );
  if (error.code === "PT410") throw new GradingError(error.message, 410);
  if (error.code === "23505")
    throw new GradingError(
      "Số báo danh, bài chụp hoặc điểm đã tồn tại. Vui lòng tải lại.",
      409,
    );
  if (error.code === "22023" && /[à-ỹ]/i.test(error.message))
    throw new GradingError(error.message);
  throw new GradingError(
    "Chưa lưu được dữ liệu bảng điểm. Vui lòng thử lại.",
    500,
  );
}
export async function gradingRoute(action: () => Promise<Response | unknown>) {
  try {
    const result = await action();
    // Redirect responses have immutable headers; copy before adding privacy headers.
    const response =
      result instanceof Response
        ? new Response(result.body, {
            status: result.status,
            statusText: result.statusText,
            headers: result.headers,
          })
        : Response.json(result);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof GradingError
            ? e.message
            : "Chưa xử lý được yêu cầu bảng điểm. Vui lòng thử lại.",
      },
      {
        status: e instanceof GradingError ? e.status : 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
export async function gradeUser(request?: Request): Promise<AppUser> {
  const user = await currentUser();
  if (!user) throw new GradingError("Phiên đăng nhập đã hết hạn.", 401);
  if (request && !sameOrigin(request))
    throw new GradingError("Yêu cầu không hợp lệ.", 403);
  return user;
}
export const uuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
export async function gradeExam(
  id: string,
  user: AppUser,
  active = false,
): Promise<Exam> {
  if (!uuid(id)) throw new GradingError("Mã bài kiểm tra không hợp lệ.", 404);
  const { data, error } = await createAdminClient()
    .from("school_exams")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  databaseError(error);
  if (!data || data.deleted_at)
    throw new GradingError("Không tìm thấy bài kiểm tra.", 404);
  if (!canAssess(user, data.subject))
    throw new GradingError("Bạn không được phân công môn học này.", 403);
  if (active && data.archived)
    throw new GradingError(
      "Bài kiểm tra đã được lưu trữ. Mở lại trước khi cập nhật.",
    );
  return data;
}
export async function gradeScan(id: string, user: AppUser, active = false) {
  if (!uuid(id)) throw new GradingError("Mã bài chụp không hợp lệ.", 404);
  const { data, error } = await createAdminClient()
    .from("school_paper_scans")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  databaseError(error);
  if (!data) throw new GradingError("Không tìm thấy bài chụp.", 404);
  const exam = await gradeExam(data.exam_id, user, active);
  return { scan: data as PaperScan, exam };
}
export async function gradingBody(request: Request) {
  if (Number(request.headers.get("content-length")) > 1_000_000)
    throw new GradingError("Dữ liệu quá lớn.", 413);
  const text = await request.text();
  if (text.length > 1_000_000) throw new GradingError("Dữ liệu quá lớn.", 413);
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value;
  } catch {
    throw new GradingError("Dữ liệu gửi lên chưa hợp lệ.");
  }
}
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function captureSession(id: string, request: Request) {
  const raw =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!uuid(id) || !/^[A-Za-z0-9_-]{43}$/.test(raw))
    throw new GradingError(
      "Mã nhận bài không hợp lệ. Quét lại mã QR còn hiệu lực.",
      401,
    );
  const { data, error } = await createAdminClient()
    .from("school_capture_sessions")
    .select(
      "id,exam_id,active,expires_at,upload_count,max_uploads,token_hash,created_by",
    )
    .eq("id", id)
    .maybeSingle();
  databaseError(error);
  if (
    !data ||
    !timingSafeEqual(
      Buffer.from(tokenHash(raw)),
      Buffer.from(data.token_hash),
    ) ||
    !data.active ||
    Date.parse(data.expires_at) <= Date.now()
  )
    throw new GradingError(
      "Phiên nhận bài đã hết hạn hoặc đã đóng. Quét mã QR mới từ giáo viên.",
      410,
    );
  const { data: exam, error: examError } = await createAdminClient()
    .from("school_exams")
    .select("*")
    .eq("id", data.exam_id)
    .maybeSingle();
  databaseError(examError);
  if (!exam || exam.archived || exam.deleted_at)
    throw new GradingError("Bài kiểm tra đã đóng.", 410);
  const actor = await createAdminClient().rpc("school_grade_actor", {
    p_actor: data.created_by,
    p_subject: exam.subject,
  });
  databaseError(actor.error);
  if (!actor.data)
    throw new GradingError(
      "Giáo viên đã hết quyền chấm môn này. Quét mã mới từ giáo viên phụ trách.",
      410,
    );
  return { session: data, exam: exam as Exam, hash: tokenHash(raw) };
}
export async function cleanupPaperImages(user?: AppUser) {
  const db = createAdminClient();
  let query = db
    .from("school_paper_scans")
    .select("id,image_path,exam_id,school_exams!inner(subject)")
    .not("image_path", "is", null)
    .lt("image_expires_at", new Date().toISOString())
    .limit(100);
  if (user?.role === "teacher") {
    query = query.in("school_exams.subject", user.subjects);
  }
  const { data, error } = await query;
  databaseError(error);
  if (!data?.length) return 0;
  const removed = await db.storage
    .from(PAPER_BUCKET)
    .remove(data.map((s) => s.image_path!));
  if (removed.error)
    throw new GradingError(
      "Chưa dọn được ảnh hết hạn. Dữ liệu điểm vẫn được giữ.",
      503,
    );
  const changed = await db
    .from("school_paper_scans")
    .update({ image_path: null, image_purged_at: new Date().toISOString() })
    .in(
      "id",
      data.map((s) => s.id),
    );
  databaseError(changed.error);
  return data.length;
}

import { createAdminClient } from "@/utils/supabase/admin";
import { canAssess } from "@/lib/access";
import {
  gradeUser,
  gradingRoute,
  gradingBody,
  databaseError,
  GradingError,
  uuid,
} from "@/lib/grading-server";
import { checkedLayout } from "@/lib/paper-template-model";
export async function GET(request: Request) {
  return gradingRoute(async () => {
    const user = await gradeUser();
    const subject = new URL(request.url).searchParams.get("subject") ?? "";
    if (!["Tin học", "Tiếng Anh"].includes(subject))
      throw new GradingError("Chọn môn Tin học hoặc Tiếng Anh.");
    if (!canAssess(user, subject))
      throw new GradingError("Bạn chưa được phân công môn này.", 403);
    const result = await createAdminClient()
      .from("school_paper_templates")
      .select("*")
      .is("deleted_at", null)
      .or(`subject.is.null,subject.eq.${subject}`)
      .order("name");
    databaseError(result.error);
    return { templates: result.data };
  });
}
export async function POST(request: Request) {
  return gradingRoute(async () => {
    const user = await gradeUser(request),
      body = await gradingBody(request);
    const subject = body.subject === null ? null : body.subject;
    if (
      subject === null
        ? user.role === "teacher"
        : !["Tin học", "Tiếng Anh"].includes(subject) ||
          !canAssess(user, subject)
    )
      throw new GradingError("Bạn không có quyền cấu hình mẫu môn này.", 403);
    if (
      typeof body.name !== "string" ||
      body.name.trim().length < 2 ||
      body.name.trim().length > 120 ||
      /[\u0000-\u001f]/.test(body.name)
    )
      throw new GradingError("Tên mẫu từ 2 đến 120 ký tự.");
    let groups;
    try {
      groups = checkedLayout(body.groups);
    } catch (e) {
      throw new GradingError((e as Error).message);
    }
    const db = createAdminClient();
    const values = {
      name: body.name.trim(),
      subject,
      groups,
      updated_at: new Date().toISOString(),
    };
    if (!body.id) {
      const r = await db
        .from("school_paper_templates")
        .insert({ ...values, created_by: user.username })
        .select("*")
        .single();
      databaseError(r.error);
      return { template: r.data };
    }
    if (!uuid(body.id) || !Number.isSafeInteger(body.version))
      throw new GradingError("Phiên bản mẫu chưa hợp lệ.");
    const old = await db
      .from("school_paper_templates")
      .select("subject")
      .eq("id", body.id)
      .is("deleted_at", null)
      .single();
    databaseError(old.error);
    if (
      !old.data ||
      (old.data.subject === null
        ? user.role === "teacher"
        : !canAssess(user, old.data.subject))
    )
      throw new GradingError("Bạn không có quyền sửa mẫu này.", 403);
    const r = await db
      .from("school_paper_templates")
      .update({ ...values, version: body.version + 1 })
      .eq("id", body.id)
      .eq("version", body.version)
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();
    databaseError(r.error);
    if (!r.data)
      throw new GradingError("Mẫu vừa được sửa. Tải lại trước khi lưu.", 409);
    return { template: r.data };
  });
}
export async function DELETE(request: Request) {
  return gradingRoute(async () => {
    const user = await gradeUser(request),
      body = await gradingBody(request);
    if (!uuid(body.id) || !Number.isSafeInteger(body.version))
      throw new GradingError("Mẫu chưa hợp lệ.");
    const db = createAdminClient(),
      old = await db
        .from("school_paper_templates")
        .select("subject")
        .eq("id", body.id)
        .single();
    databaseError(old.error);
    if (
      !old.data ||
      (old.data.subject === null
        ? user.role === "teacher"
        : !canAssess(user, old.data.subject))
    )
      throw new GradingError("Bạn không có quyền xóa mẫu này.", 403);
    const r = await db
      .from("school_paper_templates")
      .update({
        deleted_at: new Date().toISOString(),
        version: body.version + 1,
      })
      .eq("id", body.id)
      .eq("version", body.version)
      .select("id")
      .maybeSingle();
    databaseError(r.error);
    if (!r.data)
      throw new GradingError("Mẫu vừa thay đổi. Tải lại danh sách.", 409);
    return { ok: true };
  });
}

import "server-only";
import { createAdminClient } from "@/utils/supabase/admin";
import { GradingError, databaseError, uuid } from "./grading-server";
import { checkedLayout, layoutCovers } from "./paper-template-model";
import type { Exam, ExamScoring } from "./grading-model";
export async function examTemplate(
  id: unknown,
  version: unknown,
  subject: string,
  scoring: ExamScoring,
  old?: Exam,
) {
  // Reuse the frozen layout when editing an existing exam; later catalog edits never alter scores.
  if (old?.template_id && id === old.template_id) {
    try {
      layoutCovers(checkedLayout(old.paper_template), scoring);
    } catch (e) {
      throw new GradingError((e as Error).message);
    }
    return {
      template_id: old.template_id,
      template_name: old.template_name,
      paper_template: old.paper_template,
    };
  }
  if (typeof id !== "string" || !uuid(id) || !Number.isSafeInteger(version))
    throw new GradingError(
      "Chọn mẫu phiếu và tải lại cấu hình mẫu trước khi lưu.",
    );
  const r = await createAdminClient()
    .from("school_paper_templates")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  databaseError(r.error);
  if (!r.data || (r.data.subject !== null && r.data.subject !== subject))
    throw new GradingError("Mẫu phiếu không thuộc môn đang chọn.");
  if (r.data.version !== version)
    throw new GradingError(
      "Mẫu phiếu vừa thay đổi. Tải lại danh sách mẫu.",
      409,
    );
  try {
    const groups = checkedLayout(r.data.groups);
    layoutCovers(groups, scoring);
    return {
      template_id: r.data.id,
      template_name: r.data.name,
      paper_template: groups,
    };
  } catch (e) {
    throw new GradingError((e as Error).message);
  }
}

import { createAdminClient } from "@/utils/supabase/admin";
import {
  gradingRoute,
  gradeUser,
  GradingError,
  databaseError,
} from "@/lib/grading-server";
import { validSchoolYear } from "@/lib/model";
import { canonicalSchoolYear } from "@/lib/grading-model";
import { canAssess } from "@/lib/access";
export async function GET(request: Request) {
  return gradingRoute(async () => {
    const user = await gradeUser();
    const params = new URL(request.url).searchParams;
    const subject = params.get("subject") ?? "";
    const year = params.get("year") ?? "";
    const semester = Number(params.get("semester"));
    if (!canAssess(user, subject))
      throw new GradingError("Bạn không được phân công môn học này.", 403);
    if (
      !validSchoolYear(year) ||
      (params.has("semester") && ![1, 2].includes(semester))
    )
      throw new GradingError("Chọn năm học và học kỳ hợp lệ.");
    const db = createAdminClient();
    let q = db
      .from("school_exams")
      .select(
        "id,school_year,semester,class_id,class_name,subject,title,kind,weight,exam_date,scoring,answer_keys,template_id,template_name,version,archived,created_by,created_at,updated_at,school_grades(count)",
      )
      .eq("school_year", canonicalSchoolYear(year))
      .is("deleted_at", null)
      .eq("subject", subject)
      .order("created_at", { ascending: false })
      .limit(201);
    if (params.has("semester")) q = q.eq("semester", semester);
    if (params.get("class_id")) q = q.eq("class_id", params.get("class_id"));
    const { data: exams, error } = await q;
    databaseError(error);
    if ((exams?.length ?? 0) > 200)
      throw new GradingError(
        "Có quá nhiều bài kiểm tra. Chọn một lớp để thu hẹp danh sách.",
      );
    const grades = [];
    const ids = (exams ?? []).map((e) => e.id);
    for (let chunk = 0; chunk < ids.length; chunk += 50) {
      for (let offset = 0; ; offset += 1000) {
        const { data, error: ge } = await db
          .from("school_grades")
          .select("*")
          .in("exam_id", ids.slice(chunk, chunk + 50))
          .is("deleted_at", null)
          .order("id")
          .range(offset, offset + 999);
        databaseError(ge);
        grades.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
    }
    return {
      exams: (exams ?? []).map((e) => ({
        ...e,
        has_history: (e.school_grades?.[0]?.count ?? 0) > 0,
      })),
      grades,
    };
  });
}

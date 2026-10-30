import { examTemplate } from "@/lib/exam-template-server";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  gradeUser,
  gradingRoute,
  gradingBody,
  databaseError,
  GradingError,
} from "@/lib/grading-server";
import { checkedExam } from "@/lib/grading-model";
import { readWorkspace } from "@/lib/server-workspace";
import { canAssess } from "@/lib/access";
export async function POST(request: Request) {
  return gradingRoute(async () => {
    const user = await gradeUser(request);
    const body = await gradingBody(request);
    let exam;
    try {
      exam = checkedExam({
        ...body,
        semester: body.semester ?? 1,
        kind: "regular",
      });
    } catch (e) {
      throw e instanceof GradingError
        ? e
        : new GradingError((e as Error).message);
    }
    if (!canAssess(user, exam.subject))
      throw new GradingError("Bạn không được phân công môn học này.", 403);
    const { data } = await readWorkspace();
    const cls = data.classes.find((c) => c.id === exam.class_id);
    if (!cls || !data.settings.subjects.includes(exam.subject))
      throw new GradingError("Lớp hoặc môn học không còn trong hệ thống.");
    const template = await examTemplate(
      body.template_id,
      body.template_version,
      exam.subject,
      exam.scoring,
    );
    const students = data.students.filter((s) => s.className === cls.name);
    const { data: saved, error } = await createAdminClient().rpc(
      "school_save_exam",
      {
        p_actor: user.username,
        p_exam: {
          ...exam,
          ...template,
          id: randomUUID(),
          class_name: cls.name,
        },
        p_version: 0,
        p_roster: students.map((s, i) => ({
          student_id: s.id,
          student_name: s.name,
          candidate_number: String(i + 1).padStart(8, "0"),
        })),
      },
    );
    databaseError(error);
    return { exam: saved };
  });
}

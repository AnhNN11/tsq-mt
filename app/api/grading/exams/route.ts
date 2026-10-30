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
    let exam;
    try {
      exam = checkedExam(await gradingBody(request));
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
    const students = data.students.filter((s) => s.className === cls.name);
    const { data: saved, error } = await createAdminClient().rpc(
      "school_save_exam",
      {
        p_actor: user.username,
        p_exam: { ...exam, id: randomUUID(), class_name: cls.name },
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

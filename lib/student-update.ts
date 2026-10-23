import type { Student } from "./model";
export function applyStudentEdit(
  current: Student,
  submitted: Student,
  subject: string,
  manage: boolean,
): Student {
  return {
    ...(manage ? submitted : current),
    talents: current.talents,
    talentTagIds: current.talentTagIds,
    assessments: {
      ...current.assessments,
      [subject]: submitted.assessments[subject],
    },
  };
}

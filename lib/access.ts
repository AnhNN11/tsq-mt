import { STUDENT_FIELDS, type Workspace } from "./model";

export type Role = "admin" | "manager" | "teacher";
export type AppUser = {
  username: string;
  name: string;
  role: Role;
  subjects: string[];
};
export const roleLabel = (role: Role) =>
  ({ admin: "Quản trị viên", manager: "Phó khoa", teacher: "Giáo viên" })[role];
export const canManage = (user: AppUser) =>
  user.role === "admin" || user.role === "manager";
export const canAssess = (user: AppUser, subject: string) =>
  user.role !== "teacher" || user.subjects.includes(subject);
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export function assertCanUpdate(
  user: AppUser,
  current: Workspace,
  next: Workspace,
) {
  const denied = () => {
    throw new Error("Bạn không có quyền thay đổi dữ liệu này.");
  };
  if (user.role === "admin") return;
  if (!same(current.settings, next.settings)) denied();
  if (user.role === "manager") return;
  for (const [previousTags, nextTags] of [
    [current.talentTags, next.talentTags],
    [current.academicTags, next.academicTags],
  ] as const) {
    for (const tag of previousTags) {
      const nextTag = nextTags.find((t) => t.id === tag.id);
      if (tag.createdBy !== user.username && !same(tag, nextTag)) denied();
      if (nextTag && nextTag.createdBy !== tag.createdBy) denied();
    }
    for (const tag of nextTags) {
      if (
        !previousTags.some((t) => t.id === tag.id) &&
        tag.createdBy !== user.username
      )
        denied();
    }
  }
  if (
    !same(current.classes, next.classes) ||
    !same(current.pendingStudents, next.pendingStudents) ||
    current.students.length !== next.students.length
  )
    denied();
  for (const student of next.students) {
    const before = current.students.find((s) => s.id === student.id);
    if (!before || STUDENT_FIELDS.some((key) => before[key] !== student[key]))
      denied();
    for (const subject of new Set([
      ...Object.keys(before!.assessments),
      ...Object.keys(student.assessments),
    ])) {
      if (
        !canAssess(user, subject) &&
        !same(before!.assessments[subject], student.assessments[subject])
      )
        denied();
    }
    const previous = before!.talents ?? [];
    const talents = student.talents ?? [];
    for (const record of previous)
      if (
        record.teacherId !== user.username &&
        !same(
          record,
          talents.find((t) => t.id === record.id),
        )
      )
        denied();
    for (const record of talents) {
      const old = previous.find((t) => t.id === record.id);
      if ((!old || !same(old, record)) && record.teacherId !== user.username)
        denied();
    }
  }
  for (const lesson of current.lessons) {
    if (
      !canAssess(user, lesson.subject) &&
      !same(
        lesson,
        next.lessons.find((l) => l.id === lesson.id),
      )
    )
      denied();
  }
  for (const lesson of next.lessons) {
    if (
      !same(
        lesson,
        current.lessons.find((l) => l.id === lesson.id),
      ) &&
      !canAssess(user, lesson.subject)
    )
      denied();
  }
}

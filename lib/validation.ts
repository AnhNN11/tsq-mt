import { genderOf, studentKey, type Workspace } from "./model";
export function validBirthDate(value: string) {
  if (!value.trim()) return true;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!m) return false;
  const [day, month, year] = m.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    year >= 1900 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getTime() <= Date.now()
  );
}
export function assertValidChanges(current: Workspace, next: Workspace) {
  const names = new Set<string>();
  for (const student of next.students) {
    const old = current.students.find((s) => s.id === student.id);
    if (
      student.name.trim().length < 2 ||
      student.name.length > 150 ||
      /[\u0000-\u001f]/.test(student.name)
    )
      throw new Error("Họ tên học sinh phải từ 2 đến 150 ký tự.");
    const key = studentKey(student);
    if (names.has(key))
      throw new Error(
        `Có học sinh trùng họ tên trong lớp ${student.className}.`,
      );
    names.add(key);
    if (
      (!old || old.birthDate !== student.birthDate) &&
      !validBirthDate(student.birthDate)
    )
      throw new Error(
        "Ngày sinh phải là ngày có thật theo dạng dd/mm/yyyy, từ năm 1900 đến hiện tại.",
      );
    if (
      (!old || old.gender !== student.gender) &&
      student.gender &&
      genderOf(student) === "Chưa cập nhật"
    )
      throw new Error("Giới tính phải là Nam, Nữ hoặc Khác.");
  }
}

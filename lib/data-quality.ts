import { genderOf, sourceEntryLevel, type Student } from "./model";
import { validBirthDate } from "./validation";

export function studentDataIssues(student: Student) {
  const issues: string[] = [];
  if (!student.gender || genderOf(student) === "Chưa cập nhật")
    issues.push("Chưa có giới tính được xác nhận");
  if (!student.birthDate.trim()) issues.push("Chưa có ngày sinh");
  else if (!validBirthDate(student.birthDate))
    issues.push("Ngày sinh không hợp lệ, cần đối chiếu tài liệu gốc");
  if (!student.ethnicity.trim()) issues.push("Chưa có thông tin dân tộc");
  const level = sourceEntryLevel(student);
  if (!level) issues.push("Chưa có kết quả học tập đầu vào");
  else if (/^SX$/i.test(level))
    issues.push("Kết quả học tập đầu vào chưa xác minh");
  if (/trùng.*tên|cần đối chiếu|chưa có hồ sơ chi tiết/i.test(student.notes))
    issues.push(student.notes);
  return issues;
}

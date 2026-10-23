import { SUBJECTS } from "./model";
import type { Role } from "./access";
import { accountUsername } from "./account-identity";
export type AccountInput = {
  username: string;
  name: string;
  role: Role;
  subjects: string[];
  active: boolean;
  password?: string;
};
export function validateAccount(value: unknown, create: boolean): AccountInput {
  if (!value || typeof value !== "object")
    throw new Error("Thông tin tài khoản không hợp lệ.");
  const v = value as Record<string, unknown>;
  const username = accountUsername(
    typeof v.username === "string" ? v.username : "",
  );
  const name =
    typeof v.name === "string" ? v.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2 || name.length > 150 || /[\u0000-\u001f]/.test(name))
    throw new Error("Họ tên phải từ 2 đến 150 ký tự.");
  if (!["admin", "manager", "teacher"].includes(v.role as string))
    throw new Error("Vai trò không hợp lệ.");
  if (typeof v.active !== "boolean")
    throw new Error("Trạng thái tài khoản không hợp lệ.");
  const subjects = v.role === "teacher" ? v.subjects : SUBJECTS;
  if (
    !Array.isArray(subjects) ||
    !subjects.every((s) => typeof s === "string" && SUBJECTS.includes(s)) ||
    new Set(subjects).size !== subjects.length
  )
    throw new Error("Môn học được giao không hợp lệ.");
  if (v.role === "teacher" && !subjects.length)
    throw new Error("Chọn ít nhất một môn cho giáo viên.");
  if (
    create &&
    (typeof v.password !== "string" ||
      v.password.length < 8 ||
      v.password.length > 128 ||
      !/[A-Za-z]/.test(v.password) ||
      !/\d/.test(v.password))
  )
    throw new Error("Mật khẩu cần 8–128 ký tự, gồm chữ và số.");
  return {
    username,
    name,
    role: v.role as Role,
    subjects,
    active: v.active,
    ...(create ? { password: v.password as string } : {}),
  };
}

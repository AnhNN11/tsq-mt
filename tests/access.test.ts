import assert from "node:assert/strict";
import { test } from "node:test";
import { assertCanUpdate, type AppUser } from "../lib/access";
import { INITIAL_DATA } from "./fixtures/workspace";
const teacher: AppUser = {
  username: "teacher.a",
  name: "Giáo viên A",
  role: "teacher",
  subjects: ["Tin học"],
};
const original = () => structuredClone(INITIAL_DATA);
test("teachers assign shared tags and maintain only their own catalog entries", () => {
  const current = original();
  const next = original();
  next.students[0].talentTagIds = [current.talentTags[0].id];
  next.talentTags.push({
    id: "own-tag",
    name: "Cờ vua",
    category: "Thể thao",
    color: "#315b35",
    createdBy: teacher.username,
  });
  assert.doesNotThrow(() => assertCanUpdate(teacher, current, next));
  next.talentTags[0].name = "Thay đổi thẻ dùng chung";
  assert.throws(() => assertCanUpdate(teacher, current, next));
});
test("teachers may assess their subject, but cannot alter profiles, settings or other subjects", () => {
  const current = original();
  const next = original();
  next.students[0].assessments["Tin học"] = {
    before: "HT",
    after: "Khá",
    interaction: "Chủ động",
    note: "Tiến bộ",
  };
  assert.doesNotThrow(() => assertCanUpdate(teacher, current, next));
  next.students[0].assessments["Tiếng Anh"] =
    next.students[0].assessments["Tin học"];
  assert.throws(() => assertCanUpdate(teacher, current, next));
  const profile = original();
  profile.students[0].name = "Đổi tên";
  assert.throws(() => assertCanUpdate(teacher, current, profile));
  const settings = original();
  settings.settings.schoolYear = "2027 - 2028";
  assert.throws(() => assertCanUpdate(teacher, current, settings));
});
test("talent evaluations belong to their teacher; manager may manage both subjects and profiles", () => {
  const current = original();
  current.students[0].talents = [
    {
      id: "talent",
      category: "Thể thao",
      level: "Có tiềm năng",
      note: "Ghi nhận",
      plan: "",
      teacherId: "teacher.b",
      teacherName: "Giáo viên B",
      updatedAt: "2026-10-23T00:00:00.000Z",
    },
  ];
  const next = structuredClone(current);
  next.students[0].talents![0].note = "Thay đổi";
  assert.throws(() => assertCanUpdate(teacher, current, next));
  assert.doesNotThrow(() =>
    assertCanUpdate({ ...teacher, role: "manager" }, current, next),
  );
  next.settings.schoolYear = "2027 - 2028";
  assert.throws(() =>
    assertCanUpdate({ ...teacher, role: "manager" }, current, next),
  );
  assert.doesNotThrow(() =>
    assertCanUpdate({ ...teacher, role: "admin" }, current, next),
  );
});

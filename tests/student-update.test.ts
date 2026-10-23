import { test } from "node:test";
import assert from "node:assert/strict";
import { newStudent, EMPTY_ASSESSMENT } from "../lib/model";
import { applyStudentEdit } from "../lib/student-update";
test("saving an older profile form preserves newly assigned talents and other subjects", () => {
  const old = {
    ...newStudent(),
    name: "Học sinh kiểm thử",
    assessments: { "Tin học": { ...EMPTY_ASSESSMENT, after: "Khá" } },
  };
  const current = {
    ...old,
    name: "Tên đã được quản lý sửa",
    talentTagIds: ["new-tag"],
    assessments: {
      ...old.assessments,
      "Tiếng Anh": { ...EMPTY_ASSESSMENT, after: "Tốt" },
    },
  };
  const teacherResult = applyStudentEdit(current, old, "Tin học", false);
  assert.equal(teacherResult.name, current.name);
  assert.deepEqual(teacherResult.talentTagIds, ["new-tag"]);
  assert.equal(teacherResult.assessments["Tiếng Anh"].after, "Tốt");
  const adminResult = applyStudentEdit(
    current,
    { ...old, name: "Tên được cập nhật" },
    "Tin học",
    true,
  );
  assert.equal(adminResult.name, "Tên được cập nhật");
  assert.deepEqual(adminResult.talentTagIds, ["new-tag"]);
  assert.equal(adminResult.assessments["Tiếng Anh"].after, "Tốt");
});

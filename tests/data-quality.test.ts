import assert from "node:assert/strict";
import { test } from "node:test";
import { studentDataIssues } from "../lib/data-quality";
import { newStudent } from "../lib/model";
test("data review identifies missing intake fields, invalid dates and unresolved source codes without changing them", () => {
  const student = {
    ...newStudent(),
    name: "Học sinh kiểm thử",
    gender: "Nữ",
    birthDate: "31/02/2012",
    ethnicity: "Kinh",
    priorEducation: "SX\nTốt",
  };
  assert.equal(studentDataIssues(student).length, 2);
  assert.equal(student.priorEducation, "SX\nTốt");
  assert.equal(studentDataIssues(newStudent()).length, 4);
  assert.deepEqual(
    studentDataIssues({
      ...student,
      birthDate: "01/02/2012",
      priorEducation: "HTSX\nTốt",
    }),
    [],
  );
});

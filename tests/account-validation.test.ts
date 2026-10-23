import assert from "node:assert/strict";
import { test } from "node:test";
import { validateAccount } from "../lib/account-validation";
import {
  accountEmail,
  accountUsername,
  ACCOUNT_EMAIL_PATTERN,
} from "../lib/account-identity";
import { assertValidChanges, validBirthDate } from "../lib/validation";
import {
  genderOf,
  genderSummary,
  validLessonDate,
  validSchoolYear,
  validClassName,
} from "../lib/model";
import { INITIAL_DATA } from "./fixtures/workspace";
const account = {
  username: "teacher.test",
  name: "Giáo viên kiểm thử",
  role: "teacher",
  subjects: ["Tin học"],
  active: true,
  password: "TestOnly_2026!",
};
test("school email identities keep stable account IDs and accept eight-character passwords", () => {
  assert.equal(accountEmail("Teacher.Test"), "teacher.test@ph1.tsqmt.edu.vn");
  assert.equal(
    accountUsername(" Teacher.Test@ph1.tsqmt.edu.vn "),
    "teacher.test",
  );
  assert.equal(
    ACCOUNT_EMAIL_PATTERN.test("teacher.test@ph1.tsqmt.edu.vn"),
    true,
  );
  assert.equal(ACCOUNT_EMAIL_PATTERN.test("teacher.test"), false);
  assert.throws(() => accountUsername("teacher.test@example.com"));
  const value = validateAccount(
    {
      ...account,
      username: accountEmail(account.username),
      password: "Test26!a",
    },
    true,
  );
  assert.equal(value.username, account.username);
  assert.equal(value.password?.length, 8);
  assert.throws(() =>
    validateAccount({ ...account, password: "Test26!" }, true),
  );
});
test("accounts reject invalid usernames, weak passwords, missing subjects and unknown roles", () => {
  assert.equal(validateAccount(account, true).username, account.username);
  for (const update of [
    { username: "tên có dấu" },
    { password: "short" },
    { password: "abcdefghijkl" },
    { subjects: [] },
    { subjects: ["Môn lạ"] },
    { role: "owner" },
    { active: "true" },
    { name: " " },
  ])
    assert.throws(() => validateAccount({ ...account, ...update }, true));
  assert.deepEqual(
    validateAccount({ ...account, role: "admin" }, true).subjects,
    ["Tin học", "Tiếng Anh"],
  );
  assert.deepEqual(
    validateAccount({ ...account, role: "admin", subjects: undefined }, true)
      .subjects,
    ["Tin học", "Tiếng Anh"],
  );
  assert.equal(validateAccount(account, false).password, undefined);
});
test("gender classification preserves unknowns and totals; dates and school configuration are strict", () => {
  assert.equal(genderOf({ gender: " nữ " }), "Nữ");
  assert.equal(genderOf({ gender: "" }), "Chưa cập nhật");
  const students = INITIAL_DATA.students
    .slice(0, 4)
    .map((s, i) => ({ ...s, gender: ["Nam", "Nữ", "Khác", ""][i] }));
  assert.deepEqual(
    genderSummary(students).map((g) => g.count),
    [1, 1, 1, 1],
  );
  assert.equal(validBirthDate("29/02/2012"), true);
  assert.equal(validBirthDate("31/02/2012"), false);
  assert.equal(validBirthDate("01/01/2099"), false);
  assert.equal(validLessonDate("2026-02-31"), false);
  assert.equal(validSchoolYear("2026 - 2028"), false);
  assert.equal(validClassName("0/0"), false);
});
test("profile changes validate new dates and gender, preserve source anomalies and reject duplicate names within a class", () => {
  const original = structuredClone(INITIAL_DATA);
  original.students[0].birthDate = "Cần đối chiếu nguồn";
  assert.doesNotThrow(() =>
    assertValidChanges(original, structuredClone(original)),
  );
  const next = structuredClone(original);
  next.students[0].birthDate = "31/02/2012";
  assert.throws(() => assertValidChanges(original, next));
  next.students[0].birthDate = "12/10/2012";
  next.students[0].gender = "abc";
  assert.throws(() => assertValidChanges(original, next));
  next.students[0].gender = "Nam";
  next.students[1].name = next.students[0].name;
  assert.throws(() => assertValidChanges(original, next));
});

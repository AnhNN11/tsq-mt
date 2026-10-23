import assert from "node:assert/strict";
import { test } from "node:test";
import {
  academicLabel,
  academicOptions,
  academicSummary,
  academicTagUsage,
  DEFAULT_ACADEMIC_TAGS,
  validAcademicTags,
} from "../lib/academic-tags";
import { assertCanUpdate, type AppUser } from "../lib/access";
import { parseWorkspace, validateWorkspace, reportRows } from "../lib/model";
import { assertValidChanges } from "../lib/validation";
import { INITIAL_DATA } from "./fixtures/workspace";
import { reportSummary } from "../lib/report-data";
const teacher: AppUser = {
  username: "teacher.a",
  name: "Giáo viên",
  role: "teacher",
  subjects: ["Tin học"],
};
const custom = {
  id: "custom-progress",
  name: "Tiến bộ rõ rệt",
  stage: "both" as const,
  color: "#315b35",
  createdBy: teacher.username,
};
test("academic options use full labels, collapse known aliases and keep unresolved source values", () => {
  assert.equal(academicLabel("HT"), "Hoàn thành");
  assert.equal(academicLabel("HTT"), "Hoàn thành tốt");
  assert.equal(academicLabel("HTSX"), "Hoàn thành xuất sắc");
  assert.equal(academicLabel("SX"), "Chưa xác minh kết quả");
  const options = academicOptions(DEFAULT_ACADEMIC_TAGS, "before", "HTSX");
  assert.equal(options.length, 7);
  assert.equal(options.filter((o) => o.value === "XS").length, 1);
  assert.equal(academicOptions(DEFAULT_ACADEMIC_TAGS, "after").length, 4);
  assert.equal(academicLabel("TB khá"), "Trung bình khá");
  const data = structuredClone(INITIAL_DATA);
  data.students[0].priorEducation = "Tốt";
  assert.equal(academicTagUsage(data, data.academicTags.find((t) => t.id === "Tốt")!), 1);
  assert.equal(
    academicOptions(DEFAULT_ACADEMIC_TAGS, "before", "SX").at(-1)?.value,
    "SX",
  );
});
test("catalogs validate names, colors, stages and stable IDs; legacy backups gain defaults", () => {
  const { academicTags: _old, ...legacy } = INITIAL_DATA;
  assert.equal(_old.length, 7);
  assert.deepEqual(parseWorkspace(legacy)?.academicTags, DEFAULT_ACADEMIC_TAGS);
  assert.equal(validAcademicTags([...DEFAULT_ACADEMIC_TAGS, custom]), true);
  for (const patch of [
    { name: " " },
    { name: "Tốt" },
    { name: "HT" },
    { stage: "invalid" },
    { color: "red" },
    { id: "HTSX" },
  ])
    assert.equal(
      validAcademicTags([...DEFAULT_ACADEMIC_TAGS, { ...custom, ...patch }]),
      false,
    );
});
test("custom academic ratings survive rename, appear in statistics and exports, reject unknown ratings", () => {
  const data = structuredClone(INITIAL_DATA);
  data.academicTags.push(custom);
  data.students[0].assessments["Tin học"] = {
    before: "HTSX",
    after: custom.id,
    interaction: "",
    note: "",
  };
  assert.equal(validateWorkspace(data), true);
  assert.equal(academicTagUsage(data, custom), 1);
  const renamed = { ...custom, name: "Tiến bộ vượt bậc" };
  data.academicTags[data.academicTags.length - 1] = renamed;
  assert.equal(academicLabel(custom.id, data.academicTags), renamed.name);
  const summary = reportSummary({ ...data, subject: "Tin học" });
  assert.equal(summary.levels.find((g) => g.name === renamed.name)?.count, 1);
  assert.equal(
    summary.levels.reduce((n, g) => n + g.count, 0),
    160,
  );
  assert.equal(
    academicSummary(data.students, "Tin học", data.academicTags).find(
      (g) => g.name === renamed.name,
    )?.count,
    1,
  );
  assert.equal(
    reportRows(data.students, "Tin học", data.academicTags)[1][17],
    renamed.name,
  );
  data.students[0].assessments["Tin học"].after = "unknown";
  assert.equal(validateWorkspace(data), false);
});
test("teachers manage their own academic tags; deletion cannot erase ratings or original source labels", () => {
  const current = structuredClone(INITIAL_DATA);
  const next = structuredClone(current);
  next.academicTags.push(custom);
  assert.doesNotThrow(() => assertCanUpdate(teacher, current, next));
  next.academicTags[0].name = "Sửa thẻ chung";
  assert.throws(() => assertCanUpdate(teacher, current, next));
  const removed = structuredClone(current);
  removed.academicTags = removed.academicTags.filter((t) => t.id !== "HT");
  assert.throws(
    () => assertValidChanges(current, removed),
    /đang được sử dụng/,
  );
  const own = structuredClone(current);
  own.academicTags.push(custom);
  own.students[0].assessments["Tin học"] = {
    before: "HT",
    after: custom.id,
    interaction: "",
    note: "",
  };
  const missing = structuredClone(own);
  missing.academicTags.pop();
  assert.throws(() => assertValidChanges(own, missing), /đang được sử dụng/);
});

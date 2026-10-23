import { INITIAL_DATA } from "./fixtures/workspace";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assessmentOf,
  csvContent,
  ethnicityOf,
  ethnicitySummary,
  isComplete,
  lessonStats,
  newStudent,
  parseWorkspace,
  studentKey,
  sourceEntryLevel,
  validateWorkspace,
} from "../lib/model";
import {
  mergeStudents,
  parseCsv,
  previewImport,
  rowsToStudents,
} from "../lib/import-students";
test("tag assignments reject unknown IDs and duplicates; legacy backup gains a catalog", () => {
  const data = structuredClone(INITIAL_DATA);
  data.students[0].talentTagIds = [data.talentTags[0].id];
  assert.equal(validateWorkspace(data), true);
  data.students[0].talentTagIds = ["unknown"];
  assert.equal(validateWorkspace(data), false);
  data.students[0].talentTagIds = [
    data.talentTags[0].id,
    data.talentTags[0].id,
  ];
  assert.equal(validateWorkspace(data), false);
  const { talentTags: omitted, ...legacy } = INITIAL_DATA;
  assert.equal(parseWorkspace(legacy)?.talentTags.length, omitted.length);
});

test("authoritative roster: 40 pupils in each class; five older profiles retained; ambiguous matching names kept separate", () => {
  assert.equal(INITIAL_DATA.students.length, 160);
  for (const c of INITIAL_DATA.classes)
    assert.equal(
      INITIAL_DATA.students.filter((s) => s.className === c.name).length,
      40,
    );
  assert.equal(INITIAL_DATA.pendingStudents.length, 5);
  assert.equal(
    INITIAL_DATA.students.filter((s) => s.name === "Trùng tên cần kiểm tra")
      .length,
    2,
  );
  assert.ok(INITIAL_DATA.pendingStudents.some((s) => s.name === "Hồ sơ chờ 1"));
  assert.equal(
    INITIAL_DATA.students.filter((s) => sourceEntryLevel(s)).length,
    156,
  );
  assert.ok(validateWorkspace(INITIAL_DATA));
});

test("CSV preserves quoted multiline cells, escaped quotes and Vietnamese", () => {
  assert.deepEqual(
    parseCsv(
      '\uFEFFHọ và tên;Lớp;Ghi chú\r\n"Đinh An";10/1;"Dòng 1\nNói ""chào"""',
    ),
    [
      ["Họ và tên", "Lớp", "Ghi chú"],
      ["Đinh An", "10/1", 'Dòng 1\nNói "chào"'],
    ],
  );
  assert.throws(() => parseCsv('name,note\nA,"Unclosed'), /chưa đóng/);
});

test("import tracks class headings and skips table headers and signatures", () => {
  const rows = [
    ["STT", "Họ tên", "Lớp", "Hoàn cảnh gia đình"],
    ["1", "Đinh An", "10.1", "Khó khăn"],
    ["LỚP 10.2 (30)", ""],
    ["2", "Đinh Bình", "", ""],
    ["ĐẠI ĐỘI TRƯỞNG", "Nguyễn Cán Bộ", "", ""],
  ];
  const result = rowsToStudents(rows, "10/1", "test.docx");
  assert.equal(result.length, 2);
  assert.equal(result[0].className, "10/1");
  assert.equal(result[1].className, "10/2");
});

test("C2 only enriches uniquely matching existing pupils; no staff, IDs or ambiguous names", () => {
  const existing = [{ ...newStudent(), name: "Học sinh trùng tên giả lập" }];
  const rows = [
    ["TT", "Họ và tên", "CB CV", "Đảng Đoàn"],
    ["1", "Cán bộ", "", ""],
    [
      "TT",
      "Họ và tên",
      "Số CCCD",
      "Đoàn, đội",
      "HT\nRL",
      "DT\nTG",
      "Quê quán\nTrú quán",
      "Thông tin, gia đình",
    ],
    [
      "1",
      "Tên nguồn chưa khớp\n14/02/2011",
      "PRIVATE-ID",
      "",
      "Khá\nTốt",
      "Kinh",
      "Gia Lai",
      "Cha: A\nGia đình có 2 con",
    ],
    [
      "2",
      "Học sinh trùng tên giả lập\n01/02/2011",
      "PRIVATE-ID",
      "",
      "Khá\nTốt",
      "Kinh",
      "Gia Lai",
      "Cha: B\nGia đình có 3 con\nSở thích: Vẽ",
    ],
  ];
  const result = rowsToStudents(rows, "10/1", "c2.docx", existing);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, "Học sinh trùng tên giả lập");
  assert.equal(result[0].family, "Gia đình có 3 con");
  assert.equal(result[0].parents, "Cha: B");
  assert.equal(result[0].strengths, "Sở thích: Vẽ");
  assert.ok(!JSON.stringify(result).includes("PRIVATE-ID"));
});

test("merging ignores duplicates, preserves assessment and existing values, permits explicit overwrite", () => {
  const student = {
    ...newStudent(),
    name: "Học sinh trùng tên giả lập",
    family: "Ghi nhận hiện tại",
    assessments: {
      Toán: {
        before: "Đạt",
        after: "Khá",
        interaction: "Chủ động",
        note: "Tiến bộ",
      },
    },
  };
  const incoming = [
    {
      name: "Họcsinhtrùngtêngiảlập",
      className: "10.1",
      family: "Từ file",
      address: "Gia Lai",
      source: "a.docx",
    },
    {
      name: "Học sinh trùng tên giả lập",
      className: "10/1",
      family: "Bản trùng",
    },
  ];
  const preview = previewImport(incoming, [student]);
  assert.deepEqual(
    preview.map((r) => r.status),
    ["invalid", "update"],
  ); // invalid raw class is rejected until normalized by parser
  const normalized = incoming.map((s) => ({ ...s, className: "10/1" }));
  assert.deepEqual(
    previewImport(normalized, [student]).map((r) => r.status),
    ["update", "duplicate"],
  );
  const merged = mergeStudents([student], normalized, false);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].family, "Ghi nhận hiện tại");
  assert.equal(merged[0].address, "Gia Lai");
  assert.equal(merged[0].name, student.name);
  assert.deepEqual(merged[0].assessments, student.assessments);
  assert.equal(mergeStudents([student], normalized, true)[0].family, "Từ file");
  assert.notEqual(
    studentKey({ name: "Đinh An", className: "10/1" }),
    studentKey({ name: "Đinh Ân", className: "10/1" }),
  );
});

test("lesson totals count repeated bài once and periods from all sessions", () => {
  const lesson = {
    id: "1",
    title: "Bài 1. Mệnh đề",
    subject: "Toán",
    className: "10/1",
    date: "2026-10-23",
    periods: 2,
    note: "",
  };
  assert.deepEqual(
    lessonStats([
      lesson,
      { ...lesson, id: "2", periods: 1 },
      { ...lesson, id: "3", title: "Bài 2. Tập hợp" },
    ]),
    { periods: 5, topics: 2 },
  );
});

test("subject assessments stay independent while source KQGD supplies baseline", () => {
  const s = {
    ...INITIAL_DATA.students[0],
    family: "Có thông tin",
    personality: "Hòa đồng",
    assessments: {
      Toán: { before: "Đạt", after: "Khá", interaction: "Chủ động", note: "" },
    },
  };
  assert.ok(isComplete(s, "Toán"));
  assert.ok(!isComplete(s, "Tiếng Anh"));
  assert.equal(assessmentOf(s, "Tiếng Anh").before, sourceEntryLevel(s));
  assert.equal(assessmentOf(s, "Tiếng Anh").after, "");
  assert.equal(assessmentOf(s, "Toán").before, "Đạt");
  assert.equal(sourceEntryLevel({ priorEducation: "HTTốt" }), "HT");
  assert.equal(sourceEntryLevel({ priorEducation: "HTT\nTốt" }), "HTT");
  assert.equal(sourceEntryLevel({ priorEducation: "SX\nTốt" }), "SX");
});

test("backups reject malformed records and duplicate IDs; legacy backups gain class records", () => {
  assert.ok(
    !validateWorkspace({ ...INITIAL_DATA, students: [{ name: "Only name" }] }),
  );
  assert.ok(
    !validateWorkspace({
      ...INITIAL_DATA,
      students: [INITIAL_DATA.students[0], INITIAL_DATA.students[0]],
    }),
  );
  assert.ok(!validateWorkspace({ ...INITIAL_DATA, classes: [] }));
  const migrated = parseWorkspace({
    version: 1,
    students: INITIAL_DATA.students,
    lessons: [],
  });
  assert.equal(migrated?.classes.length, 4);
});

test("CSV export defuses spreadsheet formula injection", () => {
  const csv = csvContent([
    ["=1+1", " +SUM(A1)", "@formula", "Bình thường", 'A "B"'],
  ]);
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"\' +SUM(A1)"'));
  assert.ok(csv.includes('"\'@formula"'));
  assert.ok(csv.includes('"A ""B"""'));
});

test("source migration adds confirmed rosters once, preserves edits, and does not re-add later deletions", () => {
  const original = INITIAL_DATA.students.find((s) => s.id === "HS001")!;
  const edited = {
    ...original,
    name: "Tên Đã Chỉnh",
    family: "Thông tin giáo viên đã cập nhật",
    assessments: {
      Toán: {
        before: "Đạt",
        after: "Khá",
        interaction: "Chủ động",
        note: "Giữ nguyên",
      },
    },
  };
  const migrated = parseWorkspace(
    {
      version: 1,
      classes: INITIAL_DATA.classes,
      students: [edited],
      lessons: [],
    },
    true,
    INITIAL_DATA,
  )!;
  assert.ok(migrated);
  assert.equal(migrated.students.length, 160);
  assert.equal(
    migrated.students.find((s) => s.id === "HS001")?.family,
    edited.family,
  );
  assert.ok(migrated.settings.subjects.includes("Toán"));
  const afterDelete = {
    ...migrated,
    students: migrated.students.filter((s) => s.id !== "HS001"),
  };
  assert.equal(
    parseWorkspace(afterDelete, true, INITIAL_DATA)?.students.length,
    159,
  );
});

test("ethnicity groups equivalent spelling and preserves original religion text", () => {
  assert.equal(ethnicityOf({ ethnicity: "Gia-rai\nKhông" }), "Gia Rai");
  assert.equal(ethnicityOf({ ethnicity: "Jrai\nKhông" }), "Gia Rai");
  assert.equal(ethnicityOf({ ethnicity: "Chăm\nBà Ni" }), "Chăm");
  const groups = ethnicitySummary(INITIAL_DATA.students);
  assert.equal(
    groups.reduce((n, g) => n + g.count, 0),
    160,
  );
  for (const c of INITIAL_DATA.classes)
    assert.equal(
      groups.reduce((n, g) => n + (g.classes[c.name] ?? 0), 0),
      40,
    );
  assert.equal(groups.find((g) => g.ethnicity === "Chưa cập nhật")?.count, 4);
});

test("new source migration moves removed profiles to pending and preserves manual pupils and teacher feedback", () => {
  const pending = INITIAL_DATA.pendingStudents[0];
  const old = {
    ...pending,
    className: "10/1",
    personality: "Giáo viên đã ghi nhận",
  };
  const manual = { ...newStudent(), name: "Hồ sơ nhập tay" };
  const migrated = parseWorkspace(
    {
      ...INITIAL_DATA,
      sourceVersion: 1,
      students: [old, manual],
      pendingStudents: [],
    },
    true,
    INITIAL_DATA,
  )!;
  assert.ok(migrated);
  assert.equal(migrated.students.length, 161);
  assert.equal(migrated.pendingStudents.length, 5);
  assert.equal(
    migrated.pendingStudents.find((s) => s.id === old.id)?.personality,
    old.personality,
  );
  assert.ok(!migrated.students.some((s) => s.id === old.id));
  assert.ok(migrated.students.some((s) => s.id === manual.id));
});

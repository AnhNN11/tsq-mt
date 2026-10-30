import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_SCORING,
  checkedAnswers,
  checkedExam,
  checkedScoring,
  emptyAnswers,
  numericAnswer,
  scoreAnswers,
  semesterAverage,
  type Exam,
  type Grade,
} from "../lib/grading-model";
const key = {
  multipleChoice: Array.from({ length: 40 }, (_, i) => "ABCD"[i % 4]),
  trueFalse: Array.from({ length: 8 }, () => ["Đ", "S", "Đ", "S"]),
  shortAnswer: ["-1,5", "0,25", "12", "0", "3,14", "-2"],
};
test("all three parts use the configured answer key, numeric equivalence and true/false scoring mode", () => {
  assert.equal(scoreAnswers(DEFAULT_SCORING, key, key).score, 10);
  assert.equal(scoreAnswers(DEFAULT_SCORING, key, emptyAnswers()).score, 0);
  const partial = structuredClone(key);
  partial.multipleChoice[0] = "B";
  partial.trueFalse[0][0] = "S";
  partial.shortAnswer[0] = "-1.50";
  const scored = scoreAnswers(DEFAULT_SCORING, key, partial);
  assert.equal(scored.parts.multipleChoice[0], 0);
  assert.equal(scored.parts.trueFalse[0], 0.25);
  assert.equal(scored.parts.shortAnswer[0], DEFAULT_SCORING.shortAnswerPoints);
  const perStatement = scoreAnswers(
    { ...DEFAULT_SCORING, trueFalseMode: "statement" },
    key,
    partial,
  );
  assert.equal(perStatement.parts.trueFalse[0], 0.375);
  assert.equal(numericAnswer("1,25"), 1.25);
  assert.equal(numericAnswer("1,2,3"), null);
  assert.equal(numericAnswer("1e2"), null);
  const tolerance = { ...DEFAULT_SCORING, numericTolerance: 0.01 };
  partial.shortAnswer[0] = "-1,495";
  assert.equal(
    scoreAnswers(tolerance, key, partial).parts.shortAnswer[0],
    tolerance.shortAnswerPoints,
  );
});
test("exam setup rejects incomplete keys, invalid dimensions, negative weights, duplicate variants and malformed numbers", () => {
  const exam = {
    school_year: "2026-2027",
    semester: 1,
    class_id: "class-test",
    subject: "Tin học",
    title: "Kiểm tra giả lập",
    kind: "regular",
    weight: 1,
    exam_date: "2026-10-30",
    scoring: DEFAULT_SCORING,
    answer_keys: [{ code: "0001", answers: key }],
  };
  assert.equal(checkedExam(exam).school_year, "2026 – 2027");
  for (const patch of [
    { semester: 3 },
    { weight: -1 },
    { exam_date: "2026-02-30" },
    { title: " " },
    { answer_keys: [{ code: "001", answers: key }] },
    { answer_keys: [null] },
    {
      answer_keys: [
        { code: "0001", answers: key },
        { code: "0001", answers: key },
      ],
    },
  ])
    assert.throws(() => checkedExam({ ...exam, ...patch }));
  assert.throws(() => checkedAnswers(emptyAnswers(), DEFAULT_SCORING, true));
  assert.throws(() =>
    checkedScoring({ ...DEFAULT_SCORING, multipleChoiceCount: 41 }),
  );
  assert.throws(() =>
    checkedScoring({
      ...DEFAULT_SCORING,
      trueFalseScale: [0, 0.3, 0.1, 0.5, 1],
    }),
  );
  assert.throws(() =>
    checkedScoring({ ...DEFAULT_SCORING, numericTolerance: Number.NaN }),
  );
});
test("semester totals normalize to ten, preserve archived marked exams and never treat absent grades as zero", () => {
  const exams = [
    { id: "first", weight: 1, archived: false },
    { id: "second", weight: 2, archived: false },
    { id: "third", weight: 3, archived: true },
  ] as Exam[];
  const grades = [
    {
      exam_id: "first",
      student_id: "s",
      score: 4,
      max_score: 5,
      deleted_at: null,
    },
    {
      exam_id: "third",
      student_id: "s",
      score: 9,
      max_score: 10,
      deleted_at: null,
    },
  ] as Grade[];
  assert.deepEqual(semesterAverage(exams, grades, "s"), {
    average: 8.75,
    count: 2,
    total: 3,
  });
  assert.equal(semesterAverage(exams, grades, "ungraded").average, null);
  grades[1].deleted_at = "2026-10-30";
  assert.deepEqual(semesterAverage(exams, grades, "s"), {
    average: 8,
    count: 1,
    total: 2,
  });
});

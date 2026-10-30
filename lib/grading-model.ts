import { validSchoolYear, validLessonDate } from "./model";

export const EXAM_KINDS = {
  regular: "Đánh giá thường xuyên",
  midterm: "Giữa học kỳ",
  final: "Cuối học kỳ",
};
export const SCAN_STATUSES = {
  uploaded: "Chờ xử lý",
  processing: "Đang nhận dạng",
  review: "Chờ giáo viên duyệt",
  approved: "Đã duyệt",
  failed: "Cần xử lý lại",
  rejected: "Đã loại",
};
export type AnswerSet = {
  multipleChoice: string[];
  trueFalse: string[][];
  shortAnswer: string[];
};
export type ExamScoring = {
  multipleChoiceCount: number;
  multipleChoicePoints: number;
  trueFalseCount: number;
  trueFalseMode: "statement" | "question";
  trueFalsePoints: number;
  trueFalseScale: number[];
  shortAnswerCount: number;
  shortAnswerPoints: number;
  numericTolerance: number;
};
export type AnswerKey = { code: string; answers: AnswerSet };
export type Exam = {
  id: string;
  template_id?: string | null;
  template_name?: string;
  paper_template?: import("./omr-reference").BubbleGroup[] | null;
  deleted_at?: string | null;
  school_year: string;
  semester: 1 | 2;
  class_id: string;
  class_name: string;
  subject: string;
  title: string;
  kind: keyof typeof EXAM_KINDS;
  weight: number;
  exam_date: string;
  scoring: ExamScoring;
  answer_keys: AnswerKey[];
  version: number;
  archived: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};
export type ExamCandidate = {
  exam_id: string;
  student_id: string;
  student_name: string;
  candidate_number: string;
};
export type Grade = {
  id: string;
  exam_id: string;
  student_id: string;
  student_name: string;
  candidate_number: string;
  score: number;
  max_score: number;
  note: string;
  source: "manual" | "scan";
  scan_id: string | null;
  variant: string;
  answers: AnswerSet | null;
  reviewed_by: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
};
export type Point = { x: number; y: number };
export type Recognition = {
  answers: AnswerSet;
  candidateNumber: string;
  variant: string;
  warnings: string[];
  confidence: number;
  corners: Point[];
  width: number;
  height: number;
  marks: { key: string; values: number[]; uncertain: boolean }[];
};
export type PaperScan = {
  id: string;
  exam_id: string;
  session_id: string | null;
  status: keyof typeof SCAN_STATUSES;
  image_path: string | null;
  image_width: number;
  image_height: number;
  image_url?: string;
  image_expires_at: string;
  image_purged_at: string | null;
  result: Recognition | null;
  answers: AnswerSet | null;
  error_text: string;
  version: number;
  recognized_exam_version: number | null;
  created_at: string;
  reviewed_by: string | null;
  approved_at: string | null;
  approval?: {
    studentId: string;
    studentName: string;
    variant: string;
    score: number;
    maxScore: number;
    note: string;
  } | null;
};
export const DEFAULT_SCORING: ExamScoring = {
  multipleChoiceCount: 40,
  multipleChoicePoints: 0.1,
  trueFalseCount: 8,
  trueFalseMode: "question",
  trueFalsePoints: 0.125,
  trueFalseScale: [0, 0.05, 0.15, 0.25, 0.5],
  shortAnswerCount: 6,
  shortAnswerPoints: 1 / 3,
  numericTolerance: 0,
};
export function emptyAnswers(
  scoring: ExamScoring = DEFAULT_SCORING,
): AnswerSet {
  return {
    multipleChoice: Array(scoring.multipleChoiceCount).fill(""),
    trueFalse: Array.from({ length: scoring.trueFalseCount }, () =>
      Array(4).fill(""),
    ),
    shortAnswer: Array(scoring.shortAnswerCount).fill(""),
  };
}
export function maxExamScore(s: ExamScoring) {
  return (
    s.multipleChoiceCount * s.multipleChoicePoints +
    s.trueFalseCount *
      (s.trueFalseMode === "statement"
        ? s.trueFalsePoints * 4
        : s.trueFalseScale[4]) +
    s.shortAnswerCount * s.shortAnswerPoints
  );
}
export function numericAnswer(value: string): number | null {
  const text = value
    .trim()
    .replace(",", ".")
    .replace(/\u2212/g, "-");
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text) || text.length > 30) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}
export function checkedAnswers(
  value: unknown,
  scoring: ExamScoring,
  requireComplete = false,
): AnswerSet {
  if (!value || typeof value !== "object")
    throw new Error("Đáp án chưa đúng định dạng.");
  const a = value as AnswerSet;
  if (
    !Array.isArray(a.multipleChoice) ||
    a.multipleChoice.length !== scoring.multipleChoiceCount ||
    !Array.isArray(a.trueFalse) ||
    a.trueFalse.length !== scoring.trueFalseCount ||
    !Array.isArray(a.shortAnswer) ||
    a.shortAnswer.length !== scoring.shortAnswerCount
  )
    throw new Error("Số câu trả lời phải khớp cấu hình bài kiểm tra.");
  if (
    !a.multipleChoice.every(
      (v) => typeof v === "string" && /^[ABCD]?$/.test(v),
    ) ||
    !a.trueFalse.every(
      (row) =>
        Array.isArray(row) &&
        row.length === 4 &&
        row.every((v) => typeof v === "string" && /^(Đ|S)?$/.test(v)),
    ) ||
    !a.shortAnswer.every(
      (v) =>
        typeof v === "string" &&
        v.length <= 30 &&
        (v === "" || numericAnswer(v) !== null),
    )
  )
    throw new Error(
      "Đáp án chọn A–D; đúng/sai chọn Đúng hoặc Sai; trả lời ngắn nhập số hợp lệ.",
    );
  if (
    requireComplete &&
    [...a.multipleChoice, ...a.trueFalse.flat(), ...a.shortAnswer].some(
      (v) => !v.trim(),
    )
  )
    throw new Error("Vui lòng điền đủ đáp án của mã đề.");
  return {
    multipleChoice: [...a.multipleChoice],
    trueFalse: a.trueFalse.map((r) => [...r]),
    shortAnswer: a.shortAnswer.map((v) => v.trim()),
  };
}
export function checkedScoring(value: unknown): ExamScoring {
  if (!value || typeof value !== "object") throw new Error("Thiếu thang điểm.");
  const s = value as ExamScoring;
  for (const [key, max] of [
    ["multipleChoiceCount", 40],
    ["trueFalseCount", 8],
    ["shortAnswerCount", 6],
  ] as const)
    if (!Number.isInteger(s[key]) || s[key] < 0 || s[key] > max)
      throw new Error(
        "Mẫu phiếu hỗ trợ tối đa 40 câu chọn đáp án, 8 câu đúng/sai và 6 câu trả lời ngắn.",
      );
  if (
    !["statement", "question"].includes(s.trueFalseMode) ||
    !Array.isArray(s.trueFalseScale) ||
    s.trueFalseScale.length !== 5 ||
    ![
      s.multipleChoicePoints,
      s.trueFalsePoints,
      s.shortAnswerPoints,
      s.numericTolerance,
      ...s.trueFalseScale,
    ].every(
      (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100,
    ) ||
    s.trueFalseScale[0] !== 0 ||
    s.trueFalseScale.some((v, i) => i > 0 && v < s.trueFalseScale[i - 1])
  )
    throw new Error(
      "Thang điểm phải là số không âm; điểm đúng/sai tăng dần theo số ý đúng và bắt đầu từ 0.",
    );
  if (maxExamScore(s) < 0.01 || maxExamScore(s) > 100)
    throw new Error("Tổng điểm bài kiểm tra phải lớn hơn 0 và không quá 100.");
  return { ...s, trueFalseScale: [...s.trueFalseScale] };
}
export function scoreAnswers(
  scoring: ExamScoring,
  key: AnswerSet,
  answers: AnswerSet,
) {
  checkedScoring(scoring);
  checkedAnswers(key, scoring, true);
  checkedAnswers(answers, scoring);
  const multipleChoice = key.multipleChoice.map((v, i) =>
    answers.multipleChoice[i] === v ? scoring.multipleChoicePoints : 0,
  );
  const trueFalse = key.trueFalse.map((row, i) => {
    const matches = row.filter((v, j) => answers.trueFalse[i][j] === v).length;
    return scoring.trueFalseMode === "statement"
      ? matches * scoring.trueFalsePoints
      : scoring.trueFalseScale[matches];
  });
  const shortAnswer = key.shortAnswer.map((v, i) => {
    const actual = numericAnswer(answers.shortAnswer[i]);
    return actual !== null &&
      Math.abs(numericAnswer(v)! - actual) <=
        scoring.numericTolerance + Number.EPSILON * 32
      ? scoring.shortAnswerPoints
      : 0;
  });
  return {
    score: roundScore(
      [...multipleChoice, ...trueFalse, ...shortAnswer].reduce(
        (a, b) => a + b,
        0,
      ),
    ),
    maxScore: roundScore(maxExamScore(scoring)),
    parts: { multipleChoice, trueFalse, shortAnswer },
  };
}
export const roundScore = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;
export function semesterAverage(
  exams: Exam[],
  grades: Grade[],
  studentId: string,
) {
  const active = exams.filter(
    (e) =>
      !e.archived || grades.some((g) => g.exam_id === e.id && !g.deleted_at),
  );
  const recorded = active.flatMap((exam) => {
    const grade = grades.find(
      (g) =>
        !g.deleted_at && g.exam_id === exam.id && g.student_id === studentId,
    );
    return grade ? [{ grade, exam }] : [];
  });
  const weight = recorded.reduce((n, { exam }) => n + exam.weight, 0);
  return {
    count: recorded.length,
    total: active.length,
    average: weight
      ? roundScore(
          recorded.reduce(
            (n, { exam, grade }) =>
              n + (grade.score / grade.max_score) * 10 * exam.weight,
            0,
          ) / weight,
        )
      : null,
  };
}
export const canonicalSchoolYear = (value: string) =>
  `${value.slice(0, 4)} – ${value.slice(-4)}`;
export function checkedExam(
  value: unknown,
): Pick<
  Exam,
  | "school_year"
  | "semester"
  | "class_id"
  | "subject"
  | "title"
  | "kind"
  | "weight"
  | "exam_date"
  | "scoring"
  | "answer_keys"
> {
  if (!value || typeof value !== "object")
    throw new Error("Thông tin bài kiểm tra chưa hợp lệ.");
  const e = value as Exam;
  if (
    typeof e.school_year !== "string" ||
    !validSchoolYear(e.school_year) ||
    ![1, 2].includes(e.semester) ||
    typeof e.class_id !== "string" ||
    !e.class_id ||
    e.class_id.length > 150 ||
    typeof e.subject !== "string" ||
    !e.subject.trim() ||
    e.subject.length > 80 ||
    typeof e.title !== "string" ||
    e.title.trim().length < 2 ||
    e.title.trim().length > 120 ||
    /[\u0000-\u001f]/.test(e.title) ||
    !Object.hasOwn(EXAM_KINDS, e.kind) ||
    !Number.isFinite(e.weight) ||
    e.weight <= 0 ||
    e.weight > 10 ||
    typeof e.exam_date !== "string" ||
    !validLessonDate(e.exam_date)
  )
    throw new Error(
      "Kiểm tra năm học, học kỳ, lớp, tên bài, ngày kiểm tra và trọng số.",
    );
  const scoring = checkedScoring(e.scoring);
  if (
    !Array.isArray(e.answer_keys) ||
    !e.answer_keys.length ||
    e.answer_keys.length > 30 ||
    !e.answer_keys.every(
      (k) => k && typeof k.code === "string" && /^\d{4}$/.test(k.code),
    ) ||
    new Set(e.answer_keys.map((k) => k.code)).size !== e.answer_keys.length
  )
    throw new Error(
      "Mỗi mã đề gồm 4 chữ số, không trùng nhau; tối đa 30 mã đề.",
    );
  return {
    school_year: canonicalSchoolYear(e.school_year),
    semester: e.semester,
    class_id: e.class_id,
    subject: e.subject.trim(),
    title: e.title.trim(),
    kind: e.kind,
    weight: e.weight,
    exam_date: e.exam_date,
    scoring,
    answer_keys: e.answer_keys.map((k) => {
      const answers = checkedAnswers(k.answers, scoring, true);
      if (answers.shortAnswer.some((v) => v.length > 4))
        throw new Error(
          "Đáp án trả lời ngắn của mẫu phiếu phải vừa bốn ô, gồm cả dấu âm và dấu phẩy.",
        );
      return { code: k.code, answers };
    }),
  };
}

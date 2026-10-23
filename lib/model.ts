import {
  DEFAULT_ACADEMIC_TAGS,
  validAcademicTags,
  academicOptions,
  academicLabel,
  sourceAcademicLevel,
  type AcademicTag,
} from "./academic-tags";
export const SUBJECTS = ["Tin học", "Tiếng Anh"];
export const LEVELS = ["Tốt", "Khá", "Đạt", "Cần hỗ trợ"];
export const INTERACTIONS = [
  "Chủ động",
  "Có tham gia",
  "Ít tương tác",
  "Chưa tham gia",
];

export type Assessment = {
  before: string;
  after: string;
  interaction: string;
  note: string;
};
export const TALENT_CATEGORIES = [
  "Tin học",
  "Ngoại ngữ",
  "Văn nghệ",
  "Thể thao",
  "Mỹ thuật",
  "Khác",
];
export const TALENT_LEVELS = [
  "Cần quan sát thêm",
  "Có tiềm năng",
  "Đang bồi dưỡng",
  "Nổi trội",
];
export type TalentTag = {
  id: string;
  name: string;
  category: string;
  color: string;
  createdBy: string;
};
export const DEFAULT_TALENT_TAGS: TalentTag[] = [
  ["lap-trinh", "Lập trình", "Tin học", "#315b35"],
  ["tin-hoc-van-phong", "Tin học văn phòng", "Tin học", "#4d7c57"],
  ["tieng-anh", "Giao tiếp tiếng Anh", "Ngoại ngữ", "#2563a6"],
  ["hat", "Hát", "Văn nghệ", "#b64646"],
  ["mua", "Múa", "Văn nghệ", "#9b4a86"],
  ["bong-da", "Bóng đá", "Thể thao", "#ad7427"],
  ["bong-chuyen", "Bóng chuyền", "Thể thao", "#8a652c"],
  ["ve", "Vẽ", "Mỹ thuật", "#6d58a0"],
].map(([id, name, category, color]) => ({
  id,
  name,
  category,
  color,
  createdBy: "system",
}));
export function talentTagNames(student: Student, tags: TalentTag[] = []) {
  return tags
    .filter((t) => student.talentTagIds?.includes(t.id))
    .map((t) => t.name)
    .join(", ");
}
export type TalentAssessment = {
  id: string;
  category: string;
  level: string;
  note: string;
  plan: string;
  teacherId: string;
  teacherName: string;
  updatedAt: string;
};
export type Student = {
  id: string;
  name: string;
  className: string;
  room: string;
  block: string;
  gender: string;
  birthDate: string;
  ethnicity: string;
  address: string;
  parents: string;
  family: string;
  priorEducation: string;
  strengths: string;
  personality: string;
  notes: string;
  source: string;
  assessments: Record<string, Assessment>;
  talents?: TalentAssessment[];
  talentTagIds?: string[];
};
export type Lesson = {
  id: string;
  title: string;
  subject: string;
  className: string;
  date: string;
  periods: number;
  note: string;
};
export type SchoolClass = {
  id: string;
  name: string;
  track: string;
  note: string;
};
export type PendingStudent = Student & { grade: "6" | "10" };
export type SystemSettings = {
  schoolYear: string;
  teacherName: string;
  subjects: string[];
};
export const DEFAULT_SETTINGS: SystemSettings = {
  schoolYear: "2026 – 2027",
  teacherName: "Giáo viên",
  subjects: SUBJECTS,
};
export type Workspace = {
  version: 1;
  sourceVersion: 2;
  settings: SystemSettings;
  classes: SchoolClass[];
  students: Student[];
  pendingStudents: PendingStudent[];
  lessons: Lesson[];
  talentTags: TalentTag[];
  academicTags: AcademicTag[];
};
export const EMPTY_ASSESSMENT: Assessment = {
  before: "",
  after: "",
  interaction: "",
  note: "",
};
export const EMPTY_WORKSPACE: Workspace = {
  version: 1,
  sourceVersion: 2,
  settings: DEFAULT_SETTINGS,
  classes: [],
  students: [],
  pendingStudents: [],
  lessons: [],
  talentTags: [],
  academicTags: [],
};
export const STUDENT_FIELDS = [
  "id",
  "name",
  "className",
  "room",
  "block",
  "gender",
  "birthDate",
  "ethnicity",
  "address",
  "parents",
  "family",
  "priorEducation",
  "strengths",
  "personality",
  "notes",
  "source",
] as const;

export function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}
export const GENDERS = ["Nam", "Nữ", "Khác", "Chưa cập nhật"];
export function genderOf(student: Pick<Student, "gender">) {
  const value = normalize(student.gender);
  return value === "nam"
    ? "Nam"
    : value === "nu"
      ? "Nữ"
      : value === "khac"
        ? "Khác"
        : "Chưa cập nhật";
}
export function genderSummary(students: Student[]) {
  return GENDERS.map((name) => ({
    name,
    count: students.filter((s) => genderOf(s) === name).length,
  }));
}
export function validSchoolYear(value: string) {
  const years = value.match(/^(\d{4})\s*[–-]\s*(\d{4})$/);
  return Boolean(
    years &&
    Number(years[1]) >= 1900 &&
    Number(years[2]) === Number(years[1]) + 1,
  );
}
export function validClassName(value: string) {
  const parts = value.match(/^(\d{1,2})\/(\d{1,2})$/);
  return Boolean(
    parts &&
    Number(parts[1]) >= 1 &&
    Number(parts[1]) <= 12 &&
    Number(parts[2]) >= 1,
  );
}
export function validLessonDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value &&
    Number(value.slice(0, 4)) >= 1900
  );
}
export function normalizeClass(value: string) {
  return value
    .trim()
    .replace(/^(lớp|lop)\s*/i, "")
    .replace(/(\d+)[./](\d+)/, "$1/$2");
}
export function studentKey(student: Pick<Student, "name" | "className">) {
  // Keep Vietnamese accents: removing them can merge two different students.
  return `${normalizeClass(student.className)}:${student.name.normalize("NFC").toLocaleLowerCase("vi").replace(/\s+/g, "")}`;
}
export function newStudent(): Student {
  return {
    id: crypto.randomUUID(),
    name: "",
    className: "10/1",
    room: "",
    block: "",
    gender: "",
    birthDate: "",
    ethnicity: "",
    address: "",
    parents: "",
    family: "",
    priorEducation: "",
    strengths: "",
    personality: "",
    notes: "",
    source: "Nhập thủ công",
    assessments: {},
  };
}
export function assessmentOf(student: Student, subject: string) {
  const current = Object.hasOwn(student.assessments, subject)
    ? student.assessments[subject]
    : EMPTY_ASSESSMENT;
  return { ...current, before: current.before || sourceEntryLevel(student) };
}
export function sourceEntryLevel(student: Pick<Student, "priorEducation">) {
  return sourceAcademicLevel(student.priorEducation);
}
export function entryLevelOptions(student?: Student) {
  return academicOptions(
    DEFAULT_ACADEMIC_TAGS,
    "before",
    student ? sourceEntryLevel(student) : "",
  );
}
export function ethnicityOf(student: Pick<Student, "ethnicity">) {
  const raw = student.ethnicity
    .split(/[\r\n/]/)[0]
    .replace(/\s+Không$/i, "")
    .trim();
  if (!raw) return "Chưa cập nhật";
  const key = normalize(raw).replace(/[^a-z]/g, "");
  const aliases: Record<string, string> = {
    kinh: "Kinh",
    giarai: "Gia Rai",
    jrai: "Gia Rai",
    jairai: "Gia Rai",
    bana: "Ba Na",
    bahnar: "Ba Na",
    ede: "Ê Đê",
    xodang: "Xơ Đăng",
    hre: "Hrê",
    raglai: "Ra Glai",
    mnong: "M’nông",
    cotu: "Cơ Tu",
    gietrieng: "Gié Triêng",
    cadong: "Ca Dong",
    nung: "Nùng",
    tay: "Tày",
    thai: "Thái",
    tho: "Thổ",
    sandiu: "Sán Dìu",
    cham: "Chăm",
    chamhroi: "Chăm H’roi",
    chu: "Chứt",
    chut: "Chứt",
    mong: "Mông",
    dao: "Dao",
    kor: "Kor",
    co: "Co",
  };
  return Object.hasOwn(aliases, key) ? aliases[key] : raw;
}
export function ethnicitySummary(students: Student[]) {
  const groups = new Map<
    string,
    { ethnicity: string; count: number; classes: Record<string, number> }
  >();
  for (const student of students) {
    const ethnicity = ethnicityOf(student);
    const group = groups.get(ethnicity) ?? { ethnicity, count: 0, classes: {} };
    group.count++;
    group.classes[student.className] =
      (group.classes[student.className] ?? 0) + 1;
    groups.set(ethnicity, group);
  }
  return [...groups.values()].sort(
    (a, b) => b.count - a.count || a.ethnicity.localeCompare(b.ethnicity, "vi"),
  );
}
export function isComplete(student: Student, subject: string) {
  const a = assessmentOf(student, subject);
  return Boolean(
    student.family.trim() &&
    student.personality.trim() &&
    a.before &&
    a.after &&
    a.interaction,
  );
}
export function needsSupport(student: Student, subject: string) {
  return assessmentOf(student, subject).after === "Cần hỗ trợ";
}
export function lessonStats(lessons: Lesson[]) {
  // Repeated sessions of the same bài add periods without adding another bài.
  return {
    periods: lessons.reduce((sum, lesson) => sum + lesson.periods, 0),
    topics: new Set(
      lessons.map((l) => `${l.className}:${l.subject}:${normalize(l.title)}`),
    ).size,
  };
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function ensureClasses(data: Workspace): Workspace {
  const classes = [...(data.classes ?? [])];
  for (const entry of [...data.students, ...data.lessons]) {
    if (!classes.some((c) => c.name === entry.className))
      classes.push({
        id: `class-${entry.className}`,
        name: entry.className,
        track: "",
        note: "",
      });
  }
  return { ...data, classes, settings: data.settings ?? DEFAULT_SETTINGS };
}
export function parseWorkspace(
  value: unknown,
  updateSource = false,
  sourceData?: Workspace,
): Workspace | null {
  if (!record(value)) return null;
  const oldSubjects = [
    ...(Array.isArray(value.students)
      ? value.students.flatMap((s) =>
          record(s) && record(s.assessments) ? Object.keys(s.assessments) : [],
        )
      : []),
    ...(Array.isArray(value.lessons)
      ? value.lessons.flatMap((l) =>
          record(l) && typeof l.subject === "string" ? [l.subject] : [],
        )
      : []),
  ];
  const configured = {
    ...value,
    settings: value.settings ?? {
      ...DEFAULT_SETTINGS,
      subjects: Array.from(
        new Set([...DEFAULT_SETTINGS.subjects, ...oldSubjects]),
      ),
    },
  };
  let migrated: unknown =
    !value.classes &&
    Array.isArray(value.students) &&
    Array.isArray(value.lessons) &&
    value.students.every((s) => record(s) && typeof s.className === "string") &&
    value.lessons.every((l) => record(l) && typeof l.className === "string")
      ? ensureClasses(configured as Workspace)
      : configured;
  if (record(migrated) && !migrated.settings)
    migrated = { ...migrated, settings: DEFAULT_SETTINGS };
  if (record(migrated)) {
    if (
      migrated.sourceVersion !== undefined &&
      migrated.sourceVersion !== 1 &&
      migrated.sourceVersion !== 2
    )
      return null;
    migrated = {
      pendingStudents: [],
      talentTags: DEFAULT_TALENT_TAGS,
      academicTags: DEFAULT_ACADEMIC_TAGS,
      ...migrated,
      sourceVersion: 2,
    };
  }
  if (!validateWorkspace(migrated)) return null;
  // One-time source import requested by the user; later deletions remain deleted.
  if (updateSource && sourceData && value.sourceVersion !== 2) {
    const originals = [...migrated.students, ...migrated.pendingStudents];
    const sourceIds = new Set(
      [...sourceData.students, ...sourceData.pendingStudents].map((s) => s.id),
    );
    const used = new Set<string>();
    const combineNotes = (a: string, b: string) =>
      a === b ? a : [a, b].filter(Boolean).join("\n");
    const students: Student[] = sourceData.students.map((source) => {
      const existing =
        originals.find((s) => s.id === source.id) ??
        originals.find(
          (s) => !used.has(s.id) && studentKey(s) === studentKey(source),
        );
      if (!existing) return source;
      used.add(existing.id);
      const result: Student = {
        ...existing,
        id: existing.id,
        name: source.name,
        className: source.className,
        assessments: existing.assessments,
      };
      for (const key of STUDENT_FIELDS)
        if (!result[key]) result[key] = source[key];
      result.room = source.room || result.room;
      result.block = source.block || result.block;
      result.notes = combineNotes(existing.notes, source.notes);
      result.source = source.source.includes(existing.source)
        ? source.source
        : combineNotes(existing.source, source.source);
      return result;
    });
    for (const extra of migrated.students)
      if (!sourceIds.has(extra.id) && !used.has(extra.id)) students.push(extra);
    const pendingStudents: PendingStudent[] = sourceData.pendingStudents.map(
      (source) => {
        const existing = originals.find((s) => s.id === source.id);
        return existing
          ? {
              ...source,
              ...existing,
              className: "",
              grade: source.grade,
              notes: combineNotes(existing.notes, source.notes),
            }
          : source;
      },
    );
    for (const extra of migrated.pendingStudents)
      if (!sourceIds.has(extra.id) && !used.has(extra.id))
        pendingStudents.push(extra);
    const classes = sourceData.classes.map((source) => {
      const existing = migrated.classes.find(
        (c) => c.id === source.id || c.name === source.name,
      );
      return existing ? { ...source, ...existing, name: source.name } : source;
    });
    for (const extra of migrated.classes)
      if (!classes.some((c) => c.id === extra.id || c.name === extra.name))
        classes.push(extra);
    const updated = ensureClasses({
      ...migrated,
      students,
      pendingStudents,
      classes,
    });
    return validateWorkspace(updated) ? updated : null;
  }
  return migrated;
}
export function validateWorkspace(value: unknown): value is Workspace {
  if (
    !record(value) ||
    value.version !== 1 ||
    value.sourceVersion !== 2 ||
    !Array.isArray(value.classes) ||
    !Array.isArray(value.students) ||
    !Array.isArray(value.pendingStudents) ||
    !Array.isArray(value.lessons) ||
    !Array.isArray(value.talentTags) ||
    !validAcademicTags(value.academicTags) ||
    value.students.length > 10000 ||
    value.pendingStudents.length > 10000 ||
    value.lessons.length > 50000
  )
    return false;
  const tags = value.talentTags;
  const academicTags = value.academicTags;
  if (
    tags.length > 200 ||
    !tags.every(
      (t) =>
        record(t) &&
        ["id", "name", "category", "color", "createdBy"].every(
          (k) => typeof t[k] === "string" && t[k].length <= 150,
        ) &&
        t.id &&
        typeof t.name === "string" &&
        t.name.trim() === t.name &&
        t.name.length > 0 &&
        t.name.length <= 60 &&
        TALENT_CATEGORIES.includes(t.category as string) &&
        /^#[0-9a-f]{6}$/i.test(t.color as string) &&
        t.createdBy,
    ) ||
    new Set(tags.map((t) => t.id)).size !== tags.length ||
    new Set(tags.map((t) => normalize(t.name))).size !== tags.length
  )
    return false;
  const tagIds = new Set(tags.map((t) => t.id));
  const settings = value.settings;
  if (
    !record(settings) ||
    typeof settings.schoolYear !== "string" ||
    !validSchoolYear(settings.schoolYear) ||
    typeof settings.teacherName !== "string" ||
    !settings.teacherName.trim() ||
    settings.teacherName.length > 150 ||
    !Array.isArray(settings.subjects) ||
    settings.subjects.length < 1 ||
    settings.subjects.length > 100 ||
    !settings.subjects.every(
      (s) =>
        typeof s === "string" &&
        s.trim() === s &&
        s.length > 0 &&
        s.length <= 80 &&
        !["__proto__", "constructor", "prototype"].includes(s),
    ) ||
    new Set(settings.subjects.map((s) => normalize(s))).size !==
      settings.subjects.length
  )
    return false;
  const subjects = settings.subjects;
  if (
    !value.classes.every(
      (c) =>
        record(c) &&
        ["id", "name", "track", "note"].every(
          (k) => typeof c[k] === "string" && c[k].length <= 20000,
        ) &&
        c.id &&
        validClassName(c.name as string),
    ) ||
    new Set(value.classes.map((c) => c.id)).size !== value.classes.length ||
    new Set(value.classes.map((c) => c.name)).size !== value.classes.length
  )
    return false;
  const classNames = new Set(value.classes.map((c) => c.name));
  const validStudent = (s: unknown, pending = false) =>
    record(s) &&
    STUDENT_FIELDS.every(
      (k) => typeof s[k] === "string" && s[k].length <= 20000,
    ) &&
    s.id &&
    typeof s.name === "string" &&
    s.name.trim() &&
    typeof s.className === "string" &&
    (pending
      ? s.className === "" && ["6", "10"].includes(s.grade as string)
      : validClassName(s.className)) &&
    (s.talentTagIds === undefined ||
      (Array.isArray(s.talentTagIds) &&
        s.talentTagIds.length <= 30 &&
        new Set(s.talentTagIds).size === s.talentTagIds.length &&
        s.talentTagIds.every(
          (id) => typeof id === "string" && tagIds.has(id),
        ))) &&
    (s.talents === undefined ||
      (Array.isArray(s.talents) &&
        s.talents.length <= 100 &&
        new Set(s.talents.map((t) => (record(t) ? t.id : null))).size ===
          s.talents.length &&
        s.talents.every(
          (t) =>
            record(t) &&
            [
              "id",
              "category",
              "level",
              "note",
              "plan",
              "teacherId",
              "teacherName",
              "updatedAt",
            ].every((k) => typeof t[k] === "string" && t[k].length <= 10000) &&
            t.id &&
            TALENT_CATEGORIES.includes(t.category as string) &&
            TALENT_LEVELS.includes(t.level as string) &&
            Boolean(t.teacherId) &&
            /^\d{4}-\d{2}-\d{2}T/.test(t.updatedAt as string) &&
            Number.isFinite(Date.parse(t.updatedAt as string)),
        ))) &&
    record(s.assessments) &&
    Object.entries(s.assessments).every(
      ([subject, a]) =>
        subjects.includes(subject) &&
        record(a) &&
        ["before", "after", "interaction", "note"].every(
          (k) => typeof a[k] === "string" && a[k].length <= 20000,
        ) &&
        (a.before as string).length <= 120 &&
        (!a.after ||
          LEVELS.includes(a.after as string) ||
          academicTags.some((t) => t.id === a.after && t.stage !== "before")) &&
        (!a.interaction || INTERACTIONS.includes(a.interaction as string)),
    );
  const studentsValid = value.students.every((s) => validStudent(s));
  if (
    !value.pendingStudents.every((s) => validStudent(s, true)) ||
    new Set([...value.students, ...value.pendingStudents].map((s) => s.id))
      .size !==
      value.students.length + value.pendingStudents.length
  )
    return false;
  const lessonsValid = value.lessons.every(
    (l) =>
      record(l) &&
      ["id", "title", "subject", "className", "date", "note"].every(
        (k) => typeof l[k] === "string" && l[k].length <= 20000,
      ) &&
      Boolean(l.id && (l.title as string).trim() && l.className) &&
      (l.title as string).length <= 300 &&
      subjects.includes(l.subject as string) &&
      validLessonDate(l.date as string) &&
      Number.isInteger(l.periods) &&
      (l.periods as number) > 0 &&
      (l.periods as number) <= 20,
  );
  return (
    studentsValid &&
    lessonsValid &&
    new Set(value.students.map((s) => s.id)).size === value.students.length &&
    new Set(value.lessons.map((l) => l.id)).size === value.lessons.length &&
    value.students.every((s) => classNames.has(s.className)) &&
    value.lessons.every((l) => classNames.has(l.className))
  );
}

export function csvContent(rows: unknown[][]) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            let text = String(value ?? "");
            if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
            return `"${text.replace(/"/g, '""')}"`;
          })
          .join(","),
      )
      .join("\r\n")
  );
}

export function reportRows(
  students: Student[],
  subject: string,
  academicTags = DEFAULT_ACADEMIC_TAGS,
) {
  return [
    [
      "Mã học sinh",
      "Họ và tên",
      "Lớp",
      "Phòng",
      "Dãy",
      "Giới tính",
      "Ngày sinh",
      "Dân tộc / tôn giáo",
      "Dân tộc (thống kê)",
      "Nơi ở",
      "Phụ huynh / liên hệ",
      "Hoàn cảnh gia đình",
      "Kết quả giáo dục / phẩm chất (nguồn)",
      "Sở trường / sức khỏe (nguồn)",
      "Tính cách",
      "Môn học",
      "Trình độ đầu vào",
      "Sau khi học tại trường",
      "Tương tác",
      "Nhận xét môn học",
      "Ghi chú",
      "Nguồn",
    ],
    ...students.map((s) => {
      const a = assessmentOf(s, subject);
      return [
        s.id,
        s.name,
        s.className,
        s.room,
        s.block,
        s.gender,
        s.birthDate,
        s.ethnicity,
        ethnicityOf(s),
        s.address,
        s.parents,
        s.family,
        s.priorEducation,
        s.strengths,
        s.personality,
        subject,
        academicLabel(a.before, academicTags),
        academicLabel(a.after, academicTags),
        a.interaction,
        a.note,
        s.notes,
        s.source,
      ];
    }),
  ];
}

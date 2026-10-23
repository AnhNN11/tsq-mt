import type { Student, Workspace } from "./model";

export type AcademicTag = {
  id: string;
  name: string;
  color: string;
  stage: "before" | "after" | "both";
  createdBy: string;
};
export const ACADEMIC_STAGES = {
  before: "Đầu vào",
  after: "Hiện tại",
  both: "Cả hai",
};
export const DEFAULT_ACADEMIC_TAGS: AcademicTag[] = [
  {
    id: "XS",
    name: "Hoàn thành xuất sắc",
    color: "#97671d",
    stage: "before",
    createdBy: "system",
  },
  {
    id: "HTT",
    name: "Hoàn thành tốt",
    color: "#315b35",
    stage: "before",
    createdBy: "system",
  },
  {
    id: "HT",
    name: "Hoàn thành",
    color: "#265c9a",
    stage: "before",
    createdBy: "system",
  },
  ...["Tốt", "Khá", "Đạt", "Cần hỗ trợ"].map((name, i) => ({
    id: name,
    name,
    color: ["#315b35", "#265c9a", "#637067", "#ad343b"][i],
    stage: "both" as const,
    createdBy: "system",
  })),
];
export const academicKey = (value: string) =>
  value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
export function academicValue(value: string) {
  return /^(HTSX|XS)$/i.test(value.trim()) ? "XS" : value.trim();
}
export function academicTag(value: string, tags = DEFAULT_ACADEMIC_TAGS) {
  const key = academicKey(academicValue(value));
  const legacyNames: Record<string, string> = {
    G: "Giỏi",
    TB: "Trung bình",
    "TB khá": "Trung bình khá",
  };
  const legacy = legacyNames[value.trim()];
  return tags.find(
    (t) =>
      academicKey(t.id) === key ||
      academicKey(t.name) === key ||
      (legacy && academicKey(t.name) === academicKey(legacy)),
  );
}
export function academicLabel(value: string, tags = DEFAULT_ACADEMIC_TAGS) {
  return (
    academicTag(value, tags)?.name ||
    (
      {
        HT: "Hoàn thành",
        HTT: "Hoàn thành tốt",
        XS: "Hoàn thành xuất sắc",
        G: "Giỏi",
        TB: "Trung bình",
        "TB khá": "Trung bình khá",
        SX: "Chưa xác minh kết quả",
      } as Record<string, string>
    )[academicValue(value)] ||
    value
  );
}
export function academicOptions(
  tags: AcademicTag[],
  stage: "before" | "after",
  value = "",
) {
  const options = tags
    .filter((t) => t.stage === stage || t.stage === "both")
    .map((t) => ({ value: t.id, label: t.name, color: t.color }));
  const selected = academicTag(value, tags);
  const current = selected?.id ?? academicValue(value);
  if (current && !options.some((o) => o.value === current))
    options.push({
      value: current,
      label: academicLabel(value, tags),
      color: selected?.color ?? "#97671d",
    });
  return options;
}
export function validAcademicTags(value: unknown): value is AcademicTag[] {
  if (!Array.isArray(value) || value.length > 100) return false;
  const valid = value.every(
    (t) =>
      t &&
      typeof t === "object" &&
      ["id", "name", "color", "stage", "createdBy"].every(
        (k) => typeof t[k] === "string",
      ) &&
      t.id.trim() === t.id &&
      t.id.length > 0 &&
      t.id.length <= 120 &&
      !/[\u0000-\u001f]/.test(t.id) &&
      t.name.trim() === t.name &&
      t.name.length > 0 &&
      t.name.length <= 60 &&
      !/[\u0000-\u001f]/.test(t.name) &&
      /^#[0-9a-f]{6}$/i.test(t.color) &&
      Object.hasOwn(ACADEMIC_STAGES, t.stage) &&
      t.createdBy.length > 0 &&
      t.createdBy.length <= 150,
  );
  if (!valid) return false;
  // A label cannot shadow another tag's stable identifier.
  const ids = new Set(value.map((t) => academicKey(academicValue(t.id))));
  const names = new Set(value.map((t) => academicKey(t.name)));
  return (
    ids.size === value.length &&
    names.size === value.length &&
    value.every(
      (t) =>
        !value.some(
          (other) =>
            other.id !== t.id && academicKey(other.id) === academicKey(t.name),
        ),
    )
  );
}
export function academicTagUsage(data: Workspace, tag: AcademicTag) {
  return [...data.students, ...data.pendingStudents].filter((s) => {
    const values = [
      sourceAcademicLevel(s.priorEducation),
      ...Object.values(s.assessments).flatMap((a) => [a.before, a.after]),
    ];
    return values.some((v) => academicTag(v, data.academicTags)?.id === tag.id);
  }).length;
}
export function sourceAcademicLevel(priorEducation: string) {
  const first = priorEducation.split(/\r?\n/)[0].trim();
  const separated = first.match(
    /^(HTSX|HTT|HT|XS|SX|G|Khá|TB|Đạt|Giỏi|Tốt)\s*Tốt$/i,
  );
  return (separated?.[1] ?? first).slice(0, 120);
}
export function academicSummary(
  students: Student[],
  subject: string,
  tags = DEFAULT_ACADEMIC_TAGS,
) {
  const groups = new Map(
    tags
      .filter((t) => t.stage !== "before")
      .map((t) => [t.id, { name: t.name, count: 0 }]),
  );
  for (const s of students) {
    const value = s.assessments[subject]?.after || "";
    const key = academicTag(value, tags)?.id ?? (value || "__unassessed");
    const group = groups.get(key) ?? {
      name: value ? academicLabel(value, tags) : "Chưa đánh giá",
      count: 0,
    };
    group.count++;
    groups.set(key, group);
  }
  if (!groups.has("__unassessed"))
    groups.set("__unassessed", { name: "Chưa đánh giá", count: 0 });
  return [...groups.values()];
}

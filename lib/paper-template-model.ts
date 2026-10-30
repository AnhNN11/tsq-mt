import common from "./omr-layout.json";
import type { BubbleGroup } from "./omr-reference";
import type { ExamScoring, Point, Recognition } from "./grading-model";
import {
  homography,
  project,
  UNIT_CORNERS,
  convexHull,
  polygonArea,
} from "./omr-geometry";
export const COMMON_LAYOUT = common as BubbleGroup[];
export type PaperTemplate = {
  id: string;
  name: string;
  subject: string | null;
  groups: BubbleGroup[];
  version: number;
  deleted_at: string | null;
};
export function checkedLayout(value: unknown): BubbleGroup[] {
  if (!Array.isArray(value) || !value.length || value.length > 200)
    throw new Error("Mẫu phải có từ 1 đến 200 dòng ô tô.");
  const keys = new Set<string>();
  return value.map((g) => {
    if (
      !g ||
      typeof g.key !== "string" ||
      !/^(multipleChoice:(?:[0-9]|[12][0-9]|3[0-9])|trueFalse:[0-7]:[0-3]|shortAnswer:[0-5]:[0-3]|candidate:[0-7]|variant:[0-3])$/.test(
        g.key,
      ) ||
      keys.has(g.key)
    )
      throw new Error("Vị trí câu hỏi bị trùng hoặc chưa hợp lệ.");
    keys.add(g.key);
    const part = g.key.split(":")[0];
    const expected =
      part === "multipleChoice"
        ? ["A", "B", "C", "D"]
        : part === "trueFalse"
          ? ["Đ", "S"]
          : null;
    if (
      !Array.isArray(g.labels) ||
      !Array.isArray(g.points) ||
      g.points.length !== g.labels.length ||
      g.points.length < 2 ||
      g.points.length > 12 ||
      new Set(g.labels).size !== g.labels.length ||
      !g.labels.every(
        (v: unknown) =>
          typeof v === "string" &&
          (part === "shortAnswer"
            ? /^[0-9,-]$/.test(v)
            : part === "candidate" || part === "variant"
              ? /^\d$/.test(v)
              : true),
      ) ||
      (expected && JSON.stringify(expected) !== JSON.stringify(g.labels)) ||
      (!expected && [..."0123456789"].some((d) => !g.labels.includes(d)))
    )
      throw new Error(
        "Nhãn ô tô phải đúng thứ tự đáp án, không trùng và khớp vị trí.",
      );
    if (
      !g.points.every(
        (p: Point) =>
          p &&
          Number.isFinite(p.x) &&
          Number.isFinite(p.y) &&
          p.x >= 0 &&
          p.x <= 1 &&
          p.y >= 0 &&
          p.y <= 1,
      ) ||
      ![g.rx, g.ry].every(
        (v) =>
          typeof v === "number" &&
          Number.isFinite(v) &&
          v >= 0.001 &&
          v <= 0.035,
      )
    )
      throw new Error(
        "Các ô tô phải nằm trong vùng bốn dấu định vị, bán kính từ 0,1% đến 3,5%.",
      );
    return {
      key: g.key,
      labels: [...g.labels],
      points: g.points.map((p: Point) => ({ x: p.x, y: p.y })),
      rx: g.rx,
      ry: g.ry,
    };
  });
}
export function layoutCovers(groups: BubbleGroup[], scoring: ExamScoring) {
  const keys = new Set(groups.map((g) => g.key));
  const required = [
    ...Array.from(
      { length: scoring.multipleChoiceCount },
      (_, i) => `multipleChoice:${i}`,
    ),
    ...Array.from({ length: scoring.trueFalseCount }, (_, i) =>
      Array.from({ length: 4 }, (_, j) => `trueFalse:${i}:${j}`),
    ).flat(),
    ...Array.from({ length: scoring.shortAnswerCount }, (_, i) =>
      Array.from({ length: 4 }, (_, j) => `shortAnswer:${i}:${j}`),
    ).flat(),
  ];
  if (!required.every((k) => keys.has(k)))
    throw new Error(
      "Mẫu phiếu không đủ ô cho số câu đang chấm. Chọn mẫu khác hoặc chỉnh số câu.",
    );
}
export function gridBlock(
  part: "multipleChoice" | "trueFalse" | "shortAnswer",
  start: number,
  count: number,
  corners: Point[],
  rx: number,
  ry: number,
): BubbleGroup[] {
  if (
    corners.length !== 4 ||
    convexHull(corners).length !== 4 ||
    polygonArea(corners) < 0.00001 ||
    Math.abs(polygonArea(convexHull(corners)) - polygonArea(corners)) > 0.000001
  )
    throw new Error(
      "Chọn bốn góc vùng ô tô theo thứ tự trên trái, trên phải, dưới phải, dưới trái.",
    );
  if (
    !Number.isInteger(start) ||
    start < 1 ||
    !Number.isInteger(count) ||
    count < 1 ||
    start + count - 1 >
      (part === "multipleChoice" ? 40 : part === "trueFalse" ? 8 : 6) ||
    (part === "shortAnswer" && count !== 1)
  )
    throw new Error("Kiểm tra số câu bắt đầu và số câu trong vùng.");
  const h = homography(UNIT_CORNERS, corners),
    result: BubbleGroup[] = [];
  if (part === "shortAnswer") {
    const labels = ["-", ",", ..."0123456789"];
    for (let c = 0; c < 4; c++)
      result.push({
        key: `shortAnswer:${start - 1}:${c}`,
        labels,
        points: labels.map((_, r) => project(h, { x: c / 3, y: r / 11 })),
        rx,
        ry,
      });
  } else {
    const rows = part === "trueFalse" ? count * 4 : count;
    for (let r = 0; r < rows; r++) {
      const labels =
        part === "multipleChoice" ? ["A", "B", "C", "D"] : ["Đ", "S"];
      result.push({
        key:
          part === "multipleChoice"
            ? `multipleChoice:${start - 1 + r}`
            : `trueFalse:${start - 1 + Math.floor(r / 4)}:${r % 4}`,
        labels,
        points: labels.map((_, c) =>
          project(h, {
            x: c / (labels.length - 1),
            y: rows === 1 ? 0.5 : r / (rows - 1),
          }),
        ),
        rx,
        ry,
      });
    }
  }
  return checkedLayout(result);
}
export function activeMark(key: string, s: ExamScoring) {
  const [part, i] = key.split(":");
  return (
    Number(i) <
    (part === "multipleChoice"
      ? s.multipleChoiceCount
      : part === "trueFalse"
        ? s.trueFalseCount
        : part === "shortAnswer"
          ? s.shortAnswerCount
          : 0)
  );
}
export function automaticPaperProblem(
  result: Recognition,
  scoring: ExamScoring,
): string | null {
  const marks = result.marks.filter((m) => activeMark(m.key, scoring));
  if (marks.some((m) => m.uncertain))
    return "Có ô tô mờ hoặc tô nhiều đáp án. Tẩy/sửa bài rồi chụp lại; chưa lưu điểm.";
  if (!marks.some((m) => Math.max(...m.values) >= 0.32))
    return "Chưa thấy câu trả lời được tô rõ. Kiểm tra mẫu phiếu hoặc chụp lại; chưa lưu điểm.";
  for (let i = 0; i < scoring.shortAnswerCount; i++)
    if (
      !result.answers.shortAnswer[i] &&
      marks.some(
        (m) =>
          m.key.startsWith(`shortAnswer:${i}:`) &&
          Math.max(...m.values) >= 0.32,
      )
    )
      return `Câu trả lời ngắn ${i + 1} chưa đọc được thành số. Chụp lại hoặc kiểm tra dấu âm/dấu phẩy; chưa lưu điểm.`;
  return null;
}

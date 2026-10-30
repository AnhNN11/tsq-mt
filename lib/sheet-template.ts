import layout from "./omr-layout.json";
import type { BubbleGroup } from "./omr-reference";
import type { AnswerSet } from "./grading-model";
const defaultGroups = layout as BubbleGroup[];
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function sheetSvg({
  title = "Phiếu trả lời trắc nghiệm",
  subject = "",
  studentName = "",
  candidateNumber = "",
  variant = "",
  answers,
  groups = defaultGroups,
}: {
  title?: string;
  subject?: string;
  studentName?: string;
  candidateNumber?: string;
  variant?: string;
  answers?: AnswerSet;
  groups?: BubbleGroup[];
} = {}) {
  const x = (n: number) => 60 + n * 900,
    y = (n: number) => 60 + n * 1300;
  const text = (
    px: number,
    py: number,
    value: string,
    size = 16,
    anchor = "start",
  ) =>
    `<text x="${px}" y="${py}" font-size="${size}" text-anchor="${anchor}">${escape(value)}</text>`;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1020" height="1450" viewBox="0 0 1020 1450"><rect width="1020" height="1450" fill="white"/><g fill="black" font-family="Times New Roman,serif">`;
  for (const [px, py] of [
    [60, 60],
    [960, 60],
    [960, 1360],
    [60, 1360],
  ])
    svg += `<rect x="${px - 12}" y="${py - 12}" width="24" height="24"/>`;
  svg += text(430, 67, "PHIẾU TRẢ LỜI TRẮC NGHIỆM", 24, "middle");
  svg += text(100, 125, `Bài kiểm tra: ${title.slice(0, 65)}`, 17);
  svg += text(
    100,
    160,
    `Môn: ${subject}     Ngày: ...... / ...... / ..........`,
    17,
  );
  svg += text(
    100,
    230,
    `Họ và tên: ${studentName || "..................................................................."}`,
    17,
  );
  svg += text(
    100,
    275,
    "Lớp: ................       Phòng thi: ................",
    17,
  );
  svg += text(
    100,
    320,
    "Chữ ký học sinh: ................................................",
    17,
  );
  svg += text(100, 365, "Tô kín một ô mỗi dòng; không dùng bút đỏ.", 16);
  svg += text(
    100,
    395,
    "Giữ sạch, không gấp hoặc che bốn dấu vuông ở góc.",
    16,
  );
  const candidate = groups.find((g) => g.key === "candidate:0")!,
    variantGroup = groups.find((g) => g.key === "variant:0")!;
  if (candidate)
    svg += text(
      x(candidate.points[0].x),
      y(candidate.points[0].y) - 35,
      "Số báo danh",
      17,
    );
  if (variantGroup)
    svg += text(
      x(variantGroup.points[0].x) - 5,
      y(variantGroup.points[0].y) - 35,
      "Mã đề",
      17,
    );
  for (const group of groups) {
    const [part, a, b] = group.key.split(":"),
      i = Number(a),
      j = Number(b);
    let selected = "";
    if (part === "candidate") selected = candidateNumber[i] ?? "";
    if (part === "variant") selected = variant[i] ?? "";
    if (part === "multipleChoice") selected = answers?.multipleChoice[i] ?? "";
    if (part === "trueFalse") selected = answers?.trueFalse[i]?.[j] ?? "";
    if (part === "shortAnswer")
      selected = answers?.shortAnswer[i]?.replace(".", ",")[j] ?? "";
    group.points.forEach((p, k) => {
      svg += `<ellipse cx="${x(p.x).toFixed(3)}" cy="${y(p.y).toFixed(3)}" rx="${(group.rx * 900).toFixed(3)}" ry="${(group.ry * 1300).toFixed(3)}" fill="${group.labels[k] === selected ? "black" : "white"}" stroke="black" stroke-width="1.2"/>`;
    });
    if ((part === "candidate" || part === "variant") && i === 0)
      group.points.forEach((p, k) => {
        svg += text(x(p.x) - 18, y(p.y) + 5, group.labels[k], 14, "end");
      });
    if (part === "multipleChoice") {
      const p = group.points[0];
      svg += text(x(p.x) - 18, y(p.y) + 5, String(i + 1), 14, "end");
      if (i % 10 === 0) {
        group.points.forEach((v, k) => {
          svg += text(x(v.x), y(v.y) - 19, group.labels[k], 14, "middle");
        });
        if (i === 0) svg += text(95, y(p.y) - 44, "PHẦN MỘT · CHỌN ĐÁP ÁN", 18);
      }
    }
    if (part === "trueFalse") {
      const p = group.points[0];
      svg += text(x(p.x) - 12, y(p.y) + 4, "abcd"[j], 13, "end");
      if (j === 0) {
        svg += text(
          (x(group.points[0].x) + x(group.points[1].x)) / 2,
          y(p.y) - 35,
          `Câu ${i + 1}`,
          14,
          "middle",
        );
        svg +=
          text(x(p.x), y(p.y) - 16, "Đúng", 12, "middle") +
          text(x(group.points[1].x), y(p.y) - 16, "Sai", 12, "middle");
        if (i === 0)
          svg += text(95, y(p.y) - 65, "PHẦN HAI · ĐÚNG HOẶC SAI", 18);
      }
    }
    if (part === "shortAnswer" && j === 0) {
      const p = group.points[0];
      svg += text(x(p.x), y(p.y) - 29, `Câu ${i + 1}`, 15);
      group.points.forEach((v, k) => {
        svg += text(x(v.x) - 12, y(v.y) + 5, group.labels[k], 13, "end");
      });
      if (i === 0) svg += text(95, y(p.y) - 65, "PHẦN BA · TRẢ LỜI NGẮN", 18);
    }
    if (part === "shortAnswer" && (j === 1 || j === 2)) {
      const p = group.points[0];
      svg += text(x(p.x), y(p.y) - 12, ",", 14, "middle");
    }
  }
  svg += text(
    510,
    1405,
    [
      ["multipleChoice", "câu chọn đáp án"],
      ["trueFalse", "câu đúng/sai"],
      ["shortAnswer", "câu trả lời ngắn"],
    ]
      .map(([part, label]) => {
        const count = new Set(
          groups
            .filter((g) => g.key.startsWith(`${part}:`))
            .map((g) => g.key.split(":")[1]),
        ).size;
        return count ? `${count} ${label}` : "";
      })
      .filter(Boolean)
      .join(" · "),
    14,
    "middle",
  );
  return svg + "</g></svg>";
}

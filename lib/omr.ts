import sharp from "sharp";
import layout from "./omr-layout.json";
import {
  homography,
  project,
  UNIT_CORNERS,
  convexHull,
  polygonArea,
  orderedCorners,
} from "./omr-geometry";
import {
  emptyAnswers,
  numericAnswer,
  type ExamScoring,
  type Point,
  type Recognition,
} from "./grading-model";
import type { BubbleGroup } from "./omr-reference";

export const SHEET_LAYOUT = layout as BubbleGroup[];
type GrayImage = { data: Uint8Array; width: number; height: number };
function pixel(image: GrayImage, p: Point) {
  const x = Math.round(p.x),
    y = Math.round(p.y);
  return x < 0 || y < 0 || x >= image.width || y >= image.height
    ? 255
    : image.data[y * image.width + x];
}
function bubble(
  image: GrayImage,
  h: number[],
  point: Point,
  rx: number,
  ry: number,
  refine = true,
) {
  let best = { fill: 0, ring: 0, fitness: -1 };
  const offsets = refine ? [-0.3, 0, 0.3] : [0];
  for (const dx of offsets)
    for (const dy of offsets) {
      const p = { x: point.x + dx * rx, y: point.y + dy * ry };
      const at = (x: number, y: number) =>
        pixel(image, project(h, { x: p.x + x * rx, y: p.y + y * ry }));
      const surrounding = Array.from({ length: 16 }, (_, i) =>
        at(
          Math.cos((i * Math.PI) / 8) * 1.6,
          Math.sin((i * Math.PI) / 8) * 1.6,
        ),
      ).sort((a, b) => a - b);
      const paper = surrounding[12];
      let ring = 0,
        core = 0,
        count = 0;
      for (let i = 0; i < 24; i++)
        ring += at(Math.cos((i * Math.PI) / 12), Math.sin((i * Math.PI) / 12));
      for (let x = -2; x <= 2; x++)
        for (let y = -2; y <= 2; y++)
          if (x * x + y * y <= 5) {
            core += at(x * 0.22, y * 0.22);
            count++;
          }
      const fill = Math.max(
        0,
        Math.min(1, (paper - core / count) / Math.max(paper, 1)),
      );
      const outline = Math.max(0, (paper - ring / 24) / Math.max(paper, 1));
      const fitness = outline + fill * 0.08;
      if (fitness > best.fitness) best = { fill, ring: outline, fitness };
    }
  return best;
}
export function chooseMark(values: number[]) {
  const sorted = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value);
  if (!sorted.length || sorted[0].value < 0.17)
    return { index: -1, uncertain: false, blank: true };
  const uncertain =
    sorted[0].value < 0.32 ||
    (sorted[1]?.value ?? 0) >= 0.32 ||
    sorted[0].value - (sorted[1]?.value ?? 0) < 0.13;
  return { index: uncertain ? -1 : sorted[0].index, uncertain, blank: false };
}
function markerCenters(image: GrayImage) {
  const { width, height, data } = image;
  const integral = new Uint32Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += data[y * width + x];
      integral[(y + 1) * (width + 1) + x + 1] =
        integral[y * (width + 1) + x + 1] + row;
    }
  }
  const mask = new Uint8Array(width * height),
    radius = 26;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius),
        x1 = Math.min(width, x + radius + 1),
        y0 = Math.max(0, y - radius),
        y1 = Math.min(height, y + radius + 1);
      const sum =
        integral[y1 * (width + 1) + x1] -
        integral[y0 * (width + 1) + x1] -
        integral[y1 * (width + 1) + x0] +
        integral[y0 * (width + 1) + x0];
      if (
        data[y * width + x] < Math.min(150, sum / ((x1 - x0) * (y1 - y0)) - 35)
      )
        mask[y * width + x] = 1;
    }
  const stack = new Int32Array(width * height),
    components: { x: number; y: number; area: number }[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    let pending = 1,
      area = 0,
      sx = 0,
      sy = 0,
      minX = width,
      maxX = 0,
      minY = height,
      maxY = 0;
    stack[0] = i;
    mask[i] = 0;
    while (pending) {
      const current = stack[--pending],
        x = current % width,
        y = Math.floor(current / width);
      area++;
      sx += x;
      sy += y;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (const n of [
        x > 0 ? current - 1 : -1,
        x < width - 1 ? current + 1 : -1,
        y > 0 ? current - width : -1,
        y < height - 1 ? current + width : -1,
      ])
        if (n >= 0 && mask[n]) {
          mask[n] = 0;
          stack[pending++] = n;
        }
    }
    const w = maxX - minX + 1,
      h = maxY - minY + 1;
    if (
      area >= width * height * 0.00009 &&
      area <= width * height * 0.004 &&
      w / h > 0.65 &&
      w / h < 1.5 &&
      area / (w * h) > 0.66
    )
      components.push({ x: sx / area, y: sy / area, area });
  }
  components.sort((a, b) => b.area - a.area);
  const largest = components[0]?.area ?? 0;
  return components
    .filter((c) => c.area >= largest * 0.32)
    .slice(0, 30)
    .map(({ x, y }) => ({ x, y }));
}
function alignmentQuality(image: GrayImage, corners: Point[]) {
  try {
    const h = homography(UNIT_CORNERS, corners);
    const samples = SHEET_LAYOUT.filter((_, i) => i % 2 === 0).map((g) =>
      bubble(image, h, g.points[0], g.rx, g.ry, false),
    );
    return samples.filter((s) => s.ring > 0.18).length / samples.length;
  } catch {
    return 0;
  }
}
function detectCorners(image: GrayImage) {
  const centers = markerCenters(image),
    hull = convexHull(centers);
  if (hull.length < 4)
    throw new Error(
      "Không tìm đủ bốn dấu vuông ngoài cùng. Chụp lại toàn bộ phiếu, đủ sáng và không che góc; hoặc căn chỉnh bốn góc trên ảnh.",
    );
  const candidates: { points: Point[]; area: number }[] = [];
  for (let a = 0; a < hull.length - 3; a++)
    for (let b = a + 1; b < hull.length - 2; b++)
      for (let c = b + 1; c < hull.length - 1; c++)
        for (let d = c + 1; d < hull.length; d++) {
          const points = orderedCorners([hull[a], hull[b], hull[c], hull[d]]),
            area = polygonArea(points);
          if (area > image.width * image.height * 0.16)
            candidates.push({ points, area });
        }
  candidates.sort((a, b) => b.area - a.area);
  let best = { quality: 0, corners: [] as Point[] };
  for (const { points } of candidates.slice(0, 12))
    for (let rotation = 0; rotation < 4; rotation++) {
      const corners = [...points.slice(rotation), ...points.slice(0, rotation)];
      const quality = alignmentQuality(image, corners);
      if (quality > best.quality) best = { quality, corners };
    }
  if (best.quality < 0.48)
    throw new Error(
      "Không khớp mẫu phiếu 40 câu chọn đáp án, 8 câu đúng/sai, 6 câu trả lời ngắn. Căn chỉnh lại dấu góc hoặc chụp rõ hơn.",
    );
  return best.corners;
}
export function validCorners(value: unknown): value is Point[] {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every(
      (p) =>
        p &&
        typeof p.x === "number" &&
        typeof p.y === "number" &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        p.x >= 0 &&
        p.x <= 1 &&
        p.y >= 0 &&
        p.y <= 1,
    ) &&
    polygonArea(value) > 0.1 &&
    convexHull(value).length === 4 &&
    Math.abs(polygonArea(convexHull(value)) - polygonArea(value)) < 0.000001
  );
}
export async function recognizePaper(
  input: Buffer,
  scoring: ExamScoring,
  manualCorners?: Point[],
): Promise<Recognition> {
  const raw = await sharp(input, { limitInputPixels: 24_000_000 })
    .autoOrient()
    .resize({
      width: 1800,
      height: 1800,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "white" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const image = {
    data: raw.data,
    width: raw.info.width,
    height: raw.info.height,
  };
  const corners = manualCorners
    ? manualCorners.map((p) => ({
        x: p.x * image.width,
        y: p.y * image.height,
      }))
    : detectCorners(image);
  if (
    manualCorners &&
    (!validCorners(manualCorners) || alignmentQuality(image, corners) < 0.35)
  )
    throw new Error(
      "Bốn góc chưa khớp phiếu. Chọn tâm bốn dấu vuông ngoài cùng theo thứ tự trên trái, trên phải, dưới phải, dưới trái của phiếu.",
    );
  const h = homography(UNIT_CORNERS, corners),
    answers = emptyAnswers(scoring),
    warnings: string[] = [];
  const marks: Recognition["marks"] = [],
    read = new Map<
      string,
      { value: string; uncertain: boolean; blank: boolean }
    >();
  let confidence = 0,
    filled = 0;
  for (const group of SHEET_LAYOUT) {
    const values = group.points.map((p) =>
      Number(bubble(image, h, p, group.rx, group.ry).fill.toFixed(3)),
    );
    const chosen = chooseMark(values);
    if (chosen.index >= 0) {
      confidence += values[chosen.index];
      filled++;
    }
    read.set(group.key, {
      value: chosen.index >= 0 ? group.labels[chosen.index] : "",
      uncertain: chosen.uncertain,
      blank: chosen.blank,
    });
    marks.push({ key: group.key, values, uncertain: chosen.uncertain });
  }
  answers.multipleChoice = answers.multipleChoice.map((_, i) => {
    const selected = read.get(`multipleChoice:${i}`)!;
    if (!selected.value)
      warnings.push(
        `Phần chọn đáp án, câu ${i + 1}: ${selected.uncertain ? "tô mờ hoặc nhiều ô" : "chưa thấy ô được tô"}.`,
      );
    return selected.value;
  });
  answers.trueFalse = answers.trueFalse.map((row, i) =>
    row.map((_, j) => {
      const selected = read.get(`trueFalse:${i}:${j}`)!;
      if (!selected.value)
        warnings.push(
          `Phần đúng/sai, câu ${i + 1}, ý ${"abcd"[j]}: ${selected.uncertain ? "tô mờ hoặc nhiều ô" : "chưa thấy ô được tô"}.`,
        );
      return selected.value;
    }),
  );
  answers.shortAnswer = answers.shortAnswer.map((_, i) => {
    const cells = Array.from({ length: 4 }, (_, col) =>
      read.get(`shortAnswer:${i}:${col}`)!,
    );
    const value = cells
      .map((c) => c.value || " ")
      .join("")
      .trim();
    const invalid =
      cells.some((c) => c.uncertain) ||
      !value ||
      value.includes(" ") ||
      numericAnswer(value) === null;
    if (invalid)
      warnings.push(
        `Phần trả lời ngắn, câu ${i + 1}: cần kiểm tra ô tô, dấu âm hoặc dấu phẩy.`,
      );
    return invalid ? "" : value;
  });
  const code = (prefix: string, length: number) => {
    const cells = Array.from({ length }, (_, i) => read.get(`${prefix}:${i}`)!);
    return cells.every((c) => c.value)
      ? cells.map((c) => c.value).join("")
      : "";
  };
  const candidateNumber = code("candidate", 8),
    variant = code("variant", 4);
  if (!candidateNumber)
    warnings.unshift("Chưa đọc rõ số báo danh. Giáo viên cần chọn học sinh.");
  if (!variant)
    warnings.unshift("Chưa đọc rõ mã đề. Giáo viên cần chọn mã đề.");
  if (!filled)
    warnings.unshift(
      "Chưa thấy ô trả lời được tô rõ. Kiểm tra ảnh và phiếu trước khi ghi điểm.",
    );
  return {
    answers,
    candidateNumber,
    variant,
    warnings,
    confidence: filled ? Number((confidence / filled).toFixed(3)) : 0,
    corners: corners.map((p) => ({
      x: p.x / image.width,
      y: p.y / image.height,
    })),
    width: image.width,
    height: image.height,
    marks,
  };
}

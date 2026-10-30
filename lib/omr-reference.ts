// Physical locations of the blank 40 / 8 / 6 template, before perspective calibration.
import type { Point } from "./grading-model";
export type BubbleGroup = {
  key: string;
  labels: string[];
  points: Point[];
  rx: number;
  ry: number;
};
export const REFERENCE_CORNERS: Point[] = [
  { x: 118, y: 76 },
  { x: 918, y: 91 },
  { x: 974, y: 1300 },
  { x: 90, y: 1338 },
];
export function referenceGroups(): BubbleGroup[] {
  const groups: BubbleGroup[] = [];
  const add = (key: string, labels: string[], points: Point[]) =>
    groups.push({ key, labels, points, rx: 6.4, ry: 6.4 });
  for (let block = 0; block < 4; block++)
    for (let row = 0; row < 10; row++) {
      const firstX = [186, 384, 579, 772][block],
        firstY = [519, 518, 516, 516][block];
      const lastX = [183, 384, 582, 776][block],
        lastY = [700, 697, 694, 693][block];
      add(
        `multipleChoice:${block * 10 + row}`,
        ["A", "B", "C", "D"],
        Array.from({ length: 4 }, (_, c) => ({
          x:
            firstX +
            ((lastX - firstX) * row) / 9 +
            c * [40, 39, 38.2, 37.8][block],
          y: firstY + ((lastY - firstY) * row) / 9 - c * 0.3,
        })),
      );
    }
  const tf = [
    [180, 222, 812, 875],
    [262, 304, 811, 874],
    [385, 425, 809, 871],
    [466, 506, 808, 869],
    [585, 624, 805, 866],
    [665, 704, 804, 865],
    [781, 820, 800, 860],
    [861, 901, 799, 859],
  ];
  tf.forEach(([x0, x1, y0, y1], q) => {
    for (let row = 0; row < 4; row++)
      add(
        `trueFalse:${q}:${row}`,
        ["Đ", "S"],
        [
          { x: x0, y: y0 + ((y1 - y0) * row) / 3 },
          { x: x1, y: y0 + ((y1 - y0) * row) / 3 - 0.5 },
        ],
      );
  });
  const numeric = [
    [169, 1047, 28.7, 23, -1],
    [303, 1043, 28.5, 22.7, 1],
    [435, 1037, 27.5, 22.7, 3],
    [565, 1031, 28.5, 22.7, 5],
    [695, 1028, 27.3, 22.4, 7],
    [818, 1025, 27.5, 22.3, 8],
  ];
  numeric.forEach(([x, y, dx, dy, tilt], q) => {
    for (let col = 0; col < 4; col++) {
      const labels = Array.from({ length: 10 }, (_, n) => String(n));
      const points = labels.map((_, n) => ({
        x: x + dx * col + (tilt * n) / 9,
        y: y + dy * n - 0.7 * col,
      }));
      if (col === 0) {
        labels.unshift("-");
        points.unshift({ x, y: y - 46 });
      }
      if (col === 1 || col === 2) {
        labels.unshift(",");
        points.unshift({ x: x + dx * col, y: y - 23 - 0.7 * col });
      }
      add(`shortAnswer:${q}:${col}`, labels, points);
    }
  });
  for (let col = 0; col < 8; col++)
    add(
      `candidate:${col}`,
      Array.from({ length: 10 }, (_, n) => String(n)),
      Array.from({ length: 10 }, (_, n) => ({
        x: 686 + 17.6 * col + n * 0.65,
        y: 171 + 24.6 * n - 0.12 * col,
      })),
    );
  for (let col = 0; col < 4; col++)
    add(
      `variant:${col}`,
      Array.from({ length: 10 }, (_, n) => String(n)),
      Array.from({ length: 10 }, (_, n) => ({
        x: 850 + 17.2 * col + n * 0.8,
        y: 172 + 24.4 * n - 0.1 * col,
      })),
    );
  return groups;
}

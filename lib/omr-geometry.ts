import type { Point } from "./grading-model";
export const UNIT_CORNERS: Point[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];
export function homography(from: Point[], to: Point[]): number[] {
  if (from.length !== 4 || to.length !== 4)
    throw new Error("Cần bốn góc căn chỉnh.");
  const matrix: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i],
      { x: u, y: v } = to[i];
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let pivot = c;
    for (let r = c + 1; r < 8; r++)
      if (Math.abs(matrix[r][c]) > Math.abs(matrix[pivot][c])) pivot = r;
    if (Math.abs(matrix[pivot][c]) < 1e-10)
      throw new Error("Bốn góc không tạo thành mặt phẳng hợp lệ.");
    [matrix[c], matrix[pivot]] = [matrix[pivot], matrix[c]];
    const scale = matrix[c][c];
    for (let j = c; j < 9; j++) matrix[c][j] /= scale;
    for (let r = 0; r < 8; r++)
      if (r !== c) {
        const f = matrix[r][c];
        for (let j = c; j < 9; j++) matrix[r][j] -= f * matrix[c][j];
      }
  }
  return [...matrix.map((r) => r[8]), 1];
}
export function project(h: number[], p: Point): Point {
  const z = h[6] * p.x + h[7] * p.y + h[8];
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / z,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / z,
  };
}
export function polygonArea(points: Point[]) {
  return (
    Math.abs(
      points.reduce((n, p, i) => {
        const q = points[(i + 1) % points.length];
        return n + p.x * q.y - q.x * p.y;
      }, 0),
    ) / 2
  );
}
export function orderedCorners(points: Point[]) {
  const center = {
    x: points.reduce((n, p) => n + p.x, 0) / points.length,
    y: points.reduce((n, p) => n + p.y, 0) / points.length,
  };
  const ordered = [...points].sort(
    (a, b) =>
      Math.atan2(a.y - center.y, a.x - center.x) -
      Math.atan2(b.y - center.y, b.x - center.x),
  );
  const first = ordered.reduce(
    (best, p, i) => (p.x + p.y < ordered[best].x + ordered[best].y ? i : best),
    0,
  );
  return [...ordered.slice(first), ...ordered.slice(0, first)];
}
export function convexHull(points: Point[]) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [],
    upper: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, p) <= 0)
      lower.pop();
    lower.push(p);
  }
  for (const p of sorted.reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, p) <= 0)
      upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

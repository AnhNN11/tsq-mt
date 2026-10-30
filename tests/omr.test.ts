import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { chooseMark, recognizePaper, validCorners } from "../lib/omr";
import { sheetSvg } from "../lib/sheet-template";
import { DEFAULT_SCORING } from "../lib/grading-model";
import { homography, project, UNIT_CORNERS } from "../lib/omr-geometry";
const answers = {
  multipleChoice: Array.from({ length: 40 }, (_, i) => "ABCD"[i % 4]),
  trueFalse: Array.from({ length: 8 }, () => ["Đ", "S", "Đ", "S"]),
  shortAnswer: ["-1,5", "0,25", "12", "0", "3,14", "-2"],
};
test("perspective mapping is reversible and ambiguous/double marks are never guessed", () => {
  const target = [
    { x: 30, y: 10 },
    { x: 900, y: 80 },
    { x: 850, y: 1400 },
    { x: 80, y: 1350 },
  ];
  const h = homography(UNIT_CORNERS, target),
    inverse = homography(target, UNIT_CORNERS);
  const back = project(inverse, project(h, { x: 0.4, y: 0.7 }));
  assert.ok(Math.abs(back.x - 0.4) < 1e-8);
  assert.ok(Math.abs(back.y - 0.7) < 1e-8);
  assert.equal(chooseMark([0.8, 0.7, 0, 0]).uncertain, true);
  assert.equal(chooseMark([0.2, 0.1, 0, 0]).index, -1);
  assert.equal(chooseMark([0, 0.7, 0, 0]).index, 1);
  assert.equal(chooseMark([0, 0, 0, 0]).blank, true);
  assert.equal(
    validCorners([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ]),
    false,
  );
  assert.equal(
    validCorners([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ]),
    true,
  );
});
test("a printed blank sheet keeps every answer, candidate and variant blank", async () => {
  const image = await sharp(Buffer.from(sheetSvg())).png().toBuffer();
  const result = await recognizePaper(image, DEFAULT_SCORING);
  assert.deepEqual(result.answers.multipleChoice, Array(40).fill(""));
  assert.equal(result.candidateNumber, "");
  assert.equal(result.variant, "");
  assert.equal(result.confidence, 0);
});
test("all three answer sections and the eight/four digit identifiers survive all camera orientations", async () => {
  const svg = Buffer.from(
    sheetSvg({ answers, candidateNumber: "00000012", variant: "0034" }),
  );
  for (const rotation of [0, 90, 180, 270]) {
    const image = await sharp(svg)
      .rotate(rotation)
      .jpeg({ quality: 85 })
      .toBuffer();
    const result = await recognizePaper(image, DEFAULT_SCORING);
    assert.deepEqual(result.answers, answers, `rotation ${rotation}`);
    assert.equal(result.candidateNumber, "00000012");
    assert.equal(result.variant, "0034");
  }
});
test("alignment handles a skewed printed template and rejects unrelated images", async () => {
  const svg = sheetSvg({
    answers,
    candidateNumber: "00000012",
    variant: "0034",
  }).replace(
    '<g fill="black"',
    '<g transform="matrix(0.9 0.04 -0.03 0.9 70 20)" fill="black"',
  );
  const result = await recognizePaper(
    await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer(),
    DEFAULT_SCORING,
  );
  assert.deepEqual(result.answers, answers);
  assert.equal(result.candidateNumber, "00000012");
  await assert.rejects(
    () =>
      recognizePaper(
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1400"><rect width="1000" height="1400" fill="white"/></svg>',
        ),
        DEFAULT_SCORING,
      ),
    /dấu vuông|mẫu phiếu/,
  );
});

import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  checkedLayout,
  layoutCovers,
  gridBlock,
  COMMON_LAYOUT,
  automaticPaperProblem,
} from "../lib/paper-template-model";
import {
  DEFAULT_SCORING,
  scoreAnswers,
  type Recognition,
} from "../lib/grading-model";
import { sheetSvg } from "../lib/sheet-template";
import { recognizePaper } from "../lib/omr";
test("template calibration validates bounds, unique keys, labels and required question coverage", () => {
  assert.equal(checkedLayout(COMMON_LAYOUT).length, 108);
  layoutCovers(COMMON_LAYOUT, DEFAULT_SCORING);
  for (const invalid of [
    null,
    [],
    [null],
    [{ ...COMMON_LAYOUT[0], points: [{ x: 2, y: 0.5 }] }],
    [COMMON_LAYOUT[0], COMMON_LAYOUT[0]],
    [{ ...COMMON_LAYOUT[0], labels: ["D", "A", "B", "C"] }],
  ])
    assert.throws(() => checkedLayout(invalid));
  assert.throws(() =>
    layoutCovers(
      COMMON_LAYOUT.filter((g) => g.key !== "trueFalse:0:0"),
      DEFAULT_SCORING,
    ),
  );
  const block = gridBlock(
    "trueFalse",
    2,
    2,
    [
      { x: 0.1, y: 0.2 },
      { x: 0.3, y: 0.2 },
      { x: 0.3, y: 0.6 },
      { x: 0.1, y: 0.6 },
    ],
    0.006,
    0.004,
  );
  assert.equal(block.length, 8);
  assert.equal(block[0].key, "trueFalse:1:0");
  assert.equal(block[7].key, "trueFalse:2:3");
  assert.throws(() =>
    gridBlock(
      "multipleChoice",
      39,
      3,
      [
        { x: 0.1, y: 0.1 },
        { x: 0.8, y: 0.1 },
        { x: 0.8, y: 0.9 },
        { x: 0.1, y: 0.9 },
      ],
      0.01,
      0.01,
    ),
  );
});
test("a different 40-question layout is read using its own coordinates, including all four camera orientations", async () => {
  const groups = [0, 1].flatMap((column) =>
    gridBlock(
      "multipleChoice",
      column * 20 + 1,
      20,
      [
        { x: 0.1 + column * 0.48, y: 0.28 },
        { x: 0.325 + column * 0.48, y: 0.28 },
        { x: 0.325 + column * 0.48, y: 0.907 },
        { x: 0.1 + column * 0.48, y: 0.907 },
      ],
      0.008,
      0.0055,
    ),
  );
  const scoring = {
      ...DEFAULT_SCORING,
      trueFalseCount: 0,
      shortAnswerCount: 0,
      multipleChoicePoints: 0.25,
    },
    answers = {
      multipleChoice: Array.from({ length: 40 }, (_, i) => "ABCD"[i % 4]),
      trueFalse: [],
      shortAnswer: [],
    };
  layoutCovers(groups, scoring);
  const image = await sharp(Buffer.from(sheetSvg({ groups, answers })))
    .png()
    .toBuffer();
  for (const angle of [0, 90, 180, 270]) {
    const rotated = await sharp(image).rotate(angle).png().toBuffer(),
      result = await recognizePaper(rotated, scoring, undefined, groups);
    assert.deepEqual(result.answers, answers);
    assert.equal(automaticPaperProblem(result, scoring), null);
    assert.equal(scoreAnswers(scoring, answers, result.answers).score, 10);
  }
});
test("automatic grading rejects uncertain or entirely blank answers while allowing a clear zero score", () => {
  const result: Recognition = {
    candidateNumber: "",
    variant: "",
    warnings: [],
    confidence: 1,
    corners: [],
    width: 1000,
    height: 1000,
    answers: { multipleChoice: ["B"], trueFalse: [], shortAnswer: [] },
    marks: [
      { key: "multipleChoice:0", values: [0, 0.8, 0, 0], uncertain: false },
    ],
  };
  const scoring = {
    ...DEFAULT_SCORING,
    multipleChoiceCount: 1,
    trueFalseCount: 0,
    shortAnswerCount: 0,
  };
  assert.equal(automaticPaperProblem(result, scoring), null);
  assert.equal(
    scoreAnswers(
      scoring,
      { multipleChoice: ["A"], trueFalse: [], shortAnswer: [] },
      result.answers,
    ).score,
    0,
  );
  assert.match(
    automaticPaperProblem(
      { ...result, marks: [{ ...result.marks[0], uncertain: true }] },
      scoring,
    )!,
    /tô mờ/,
  );
  assert.match(
    automaticPaperProblem(
      { ...result, marks: [{ ...result.marks[0], values: [0, 0, 0, 0] }] },
      scoring,
    )!,
    /Chưa thấy/,
  );
});

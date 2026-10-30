"use client";
import { Input, Select, Table, Tabs } from "antd";
import type { AnswerSet, ExamScoring } from "@/lib/grading-model";
export default function AnswerEditor({
  answers,
  scoring,
  onChange,
  disabled = false,
  id = "answers",
}: {
  answers: AnswerSet;
  scoring: ExamScoring;
  onChange: (answers: AnswerSet) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <Tabs
      size="small"
      items={[
        {
          key: "multiple",
          label: `Chọn đáp án (${scoring.multipleChoiceCount})`,
          children: (
            <Table
              size="small"
              rowKey="index"
              pagination={false}
              scroll={{ y: 330 }}
              dataSource={answers.multipleChoice.map((value, index) => ({
                value,
                index,
              }))}
              columns={[
                { title: "Câu", width: 75, render: (_, r) => r.index + 1 },
                {
                  title: "Đáp án",
                  render: (_, r) => (
                    <Select
                      aria-label={`${id} chọn đáp án câu ${r.index + 1}`}
                      value={r.value || undefined}
                      allowClear
                      disabled={disabled}
                      placeholder="Chưa trả lời"
                      style={{ minWidth: 150 }}
                      options={["A", "B", "C", "D"].map((v) => ({
                        value: v,
                        label: v,
                      }))}
                      onChange={(v) =>
                        onChange({
                          ...answers,
                          multipleChoice: answers.multipleChoice.map(
                            (old, i) => (i === r.index ? (v ?? "") : old),
                          ),
                        })
                      }
                    />
                  ),
                },
              ]}
            />
          ),
        },
        {
          key: "trueFalse",
          label: `Đúng hoặc sai (${scoring.trueFalseCount})`,
          children: (
            <Table
              size="small"
              rowKey="index"
              pagination={false}
              scroll={{ x: 590, y: 330 }}
              dataSource={answers.trueFalse.map((value, index) => ({
                value,
                index,
              }))}
              columns={[
                { title: "Câu", width: 65, render: (_, r) => r.index + 1 },
                ...["a", "b", "c", "d"].map((label, j) => ({
                  title: `Ý ${label}`,
                  render: (
                    _: unknown,
                    r: { value: string[]; index: number },
                  ) => (
                    <Select
                      aria-label={`${id} đúng sai câu ${r.index + 1} ý ${label}`}
                      value={r.value[j] || undefined}
                      disabled={disabled}
                      allowClear
                      placeholder="Chưa chọn"
                      style={{ width: 125 }}
                      options={[
                        { value: "Đ", label: "Đúng" },
                        { value: "S", label: "Sai" },
                      ]}
                      onChange={(v) =>
                        onChange({
                          ...answers,
                          trueFalse: answers.trueFalse.map((row, i) =>
                            i === r.index
                              ? row.map((old, col) =>
                                  col === j ? (v ?? "") : old,
                                )
                              : row,
                          ),
                        })
                      }
                    />
                  ),
                })),
              ]}
            />
          ),
        },
        {
          key: "short",
          label: `Trả lời ngắn (${scoring.shortAnswerCount})`,
          children: (
            <Table
              size="small"
              rowKey="index"
              pagination={false}
              dataSource={answers.shortAnswer.map((value, index) => ({
                value,
                index,
              }))}
              columns={[
                { title: "Câu", width: 75, render: (_, r) => r.index + 1 },
                {
                  title: "Giá trị trả lời",
                  render: (_, r) => (
                    <Input
                      aria-label={`${id} trả lời ngắn câu ${r.index + 1}`}
                      disabled={disabled}
                      value={r.value}
                      placeholder="Ví dụ: -1,5 hoặc 0,25"
                      maxLength={30}
                      onChange={(e) =>
                        onChange({
                          ...answers,
                          shortAnswer: answers.shortAnswer.map((old, i) =>
                            i === r.index ? e.target.value : old,
                          ),
                        })
                      }
                    />
                  ),
                },
              ]}
            />
          ),
        },
      ]}
    />
  );
}

"use client";
import { useState } from "react";
import {
  Alert,
  App,
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Tabs,
} from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import {
  DEFAULT_SCORING,
  EXAM_KINDS,
  checkedExam,
  emptyAnswers,
  maxExamScore,
  roundScore,
  type AnswerKey,
  type Exam,
  type ExamScoring,
} from "@/lib/grading-model";
import type { SchoolClass } from "@/lib/model";
import { gradingFetch } from "@/lib/grading-client";
import AnswerEditor from "./answer-editor";
import { today } from "./lesson-editor";

export default function ExamEditor({
  exam,
  classes,
  subject,
  year,
  semester,
  classId,
  locked,
  onClose,
  onSaved,
}: {
  exam?: Exam;
  classes: SchoolClass[];
  subject: string;
  year: string;
  semester: number;
  classId?: string;
  locked: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm();
  const { message, modal } = App.useApp();
  const [scoring, setScoring] = useState<ExamScoring>(
    exam?.scoring ?? { ...DEFAULT_SCORING },
  );
  const [keys, setKeys] = useState<AnswerKey[]>(
    exam?.answer_keys ?? [{ code: "0001", answers: emptyAnswers() }],
  );
  const [active, setActive] = useState("0"),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const [paste, setPaste] = useState(false);
  const [pasteForm] = Form.useForm();
  function changeScoring(patch: Partial<ExamScoring>) {
    const next = { ...scoring, ...patch };
    setScoring(next);
    setDirty(true);
    setKeys((all) =>
      all.map((key) => {
        const blank = emptyAnswers(next);
        return {
          ...key,
          answers: {
            multipleChoice: blank.multipleChoice.map(
              (_, i) => key.answers.multipleChoice[i] ?? "",
            ),
            trueFalse: blank.trueFalse.map(
              (_, i) => key.answers.trueFalse[i] ?? ["", "", "", ""],
            ),
            shortAnswer: blank.shortAnswer.map(
              (_, i) => key.answers.shortAnswer[i] ?? "",
            ),
          },
        };
      }),
    );
  }
  function close() {
    if (dirty || form.isFieldsTouched())
      modal.confirm({
        title: "Đóng bài kiểm tra chưa lưu?",
        content: "Các đáp án và thang điểm vừa nhập sẽ không được lưu.",
        okText: "Đóng",
        cancelText: "Tiếp tục nhập",
        onOk: onClose,
      });
    else onClose();
  }
  async function save(values: object) {
    setBusy(true);
    try {
      const data = checkedExam({ ...values, scoring, answer_keys: keys });
      await gradingFetch(
        exam ? `/api/grading/exams/${exam.id}` : "/api/grading/exams",
        exam ? "PUT" : "POST",
        { ...data, version: exam?.version ?? 0 },
      );
      message.success("Đã lưu bài kiểm tra và đáp án.");
      onSaved();
      onClose();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function pasteAnswers(values: {
    multiple: string;
    truth: string;
    short: string;
  }) {
    const multipleChoice = (values.multiple ?? "")
      .toUpperCase()
      .split(/[\s;,]+/)
      .filter(Boolean);
    const trueFalse = (values.truth ?? "")
      .trim()
      .split(/\n/)
      .filter(Boolean)
      .map((line) =>
        line
          .toUpperCase()
          .replace(/ĐÚNG/g, "Đ")
          .replace(/SAI/g, "S")
          .split(/[\s;,]+/)
          .filter(Boolean)
          .map((s) => (s === "D" ? "Đ" : s)),
      );
    const shortAnswer = (values.short ?? "")
      .split(/[\n;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const key = {
      ...keys[Number(active)],
      answers: { multipleChoice, trueFalse, shortAnswer },
    };
    try {
      checkedExam({
        ...form.getFieldsValue(true),
        scoring,
        answer_keys: [key],
      });
    } catch (e) {
      message.error((e as Error).message);
      return;
    }
    setKeys((all) => all.map((k, i) => (i === Number(active) ? key : k)));
    setDirty(true);
    setPaste(false);
    message.success("Đã điền đáp án. Kiểm tra lại trước khi lưu.");
  }
  return (
    <Modal
      open
      title={exam ? "Chỉnh sửa bài kiểm tra" : "Tạo bài kiểm tra"}
      width={1080}
      style={{ top: 24 }}
      onCancel={close}
      footer={
        <Space>
          <Button onClick={close}>Hủy</Button>
          <Button type="primary" loading={busy} onClick={() => form.submit()}>
            Lưu bài kiểm tra
          </Button>
        </Space>
      }
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={
          exam ?? {
            title: "",
            school_year: year,
            semester,
            class_id: classId ?? classes[0]?.id,
            subject,
            kind: "regular",
            weight: 1,
            exam_date: today(),
          }
        }
        onFinish={save}
      >
        <Tabs
          items={[
            {
              key: "details",
              label: "Thông tin bài kiểm tra",
              forceRender: true,
              children: (
                <>
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="title"
                        label="Tên bài kiểm tra"
                        rules={[
                          {
                            required: true,
                            whitespace: true,
                            min: 2,
                            max: 120,
                          },
                        ]}
                      >
                        <Input maxLength={120} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="class_id"
                        label="Lớp dự thi"
                        extra={
                          exam
                            ? "Lớp được giữ nguyên theo danh sách dự thi đã tạo."
                            : undefined
                        }
                        rules={[{ required: true }]}
                      >
                        <Select
                          disabled={Boolean(exam) || locked}
                          options={classes.map((c) => ({
                            value: c.id,
                            label: `Lớp ${c.name}`,
                          }))}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col xs={12} md={6}>
                      <Form.Item
                        name="school_year"
                        label="Năm học"
                        rules={[{ required: true }]}
                      >
                        <Input disabled={locked} maxLength={20} />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={6}>
                      <Form.Item
                        name="semester"
                        label="Học kỳ"
                        rules={[{ required: true }]}
                      >
                        <Select
                          disabled={locked}
                          options={[
                            { value: 1, label: "Học kỳ một" },
                            { value: 2, label: "Học kỳ hai" },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="subject"
                        label="Môn học"
                        rules={[{ required: true }]}
                      >
                        <Input disabled />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col xs={24} md={10}>
                      <Form.Item
                        name="kind"
                        label="Loại điểm"
                        rules={[{ required: true }]}
                      >
                        <Select
                          options={Object.entries(EXAM_KINDS).map(
                            ([value, label]) => ({ value, label }),
                          )}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={6}>
                      <Form.Item
                        name="weight"
                        label="Trọng số tổng hợp"
                        rules={[{ required: true }]}
                      >
                        <InputNumber
                          min={0.01}
                          max={10}
                          style={{ width: "100%" }}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={8}>
                      <Form.Item
                        name="exam_date"
                        label="Ngày kiểm tra"
                        rules={[{ required: true }]}
                      >
                        <Input type="date" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Alert
                    type="info"
                    showIcon
                    title="Điểm tổng hợp quy về thang 10 và dùng trọng số bạn cấu hình. Điểm chưa nhập được để trống, không tự tính thành 0."
                  />
                </>
              ),
            },
            {
              key: "scoring",
              label: "Đáp án và thang điểm",
              forceRender: true,
              children: (
                <>
                  {locked && (
                    <Alert
                      type="warning"
                      showIcon
                      title="Đã có lịch sử điểm: đáp án, thang điểm, lớp và học kỳ được khóa. Tạo bài kiểm tra mới nếu cần thay đổi."
                    />
                  )}
                  <div className="exam-scoring-grid">
                    <section>
                      <h3>Phần chọn đáp án</h3>
                      <label>
                        Số câu
                        <InputNumber
                          aria-label="Số câu chọn đáp án"
                          min={0}
                          max={40}
                          disabled={locked}
                          value={scoring.multipleChoiceCount}
                          onChange={(v) =>
                            changeScoring({ multipleChoiceCount: v ?? 0 })
                          }
                        />
                      </label>
                      <label>
                        Điểm mỗi câu
                        <InputNumber
                          aria-label="Điểm mỗi câu chọn đáp án"
                          min={0}
                          max={100}
                          disabled={locked}
                          value={scoring.multipleChoicePoints}
                          onChange={(v) =>
                            changeScoring({ multipleChoicePoints: v ?? 0 })
                          }
                        />
                      </label>
                    </section>
                    <section>
                      <h3>Phần đúng hoặc sai</h3>
                      <label>
                        Số câu
                        <InputNumber
                          aria-label="Số câu đúng sai"
                          min={0}
                          max={8}
                          disabled={locked}
                          value={scoring.trueFalseCount}
                          onChange={(v) =>
                            changeScoring({ trueFalseCount: v ?? 0 })
                          }
                        />
                      </label>
                      <Select
                        aria-label="Cách tính điểm đúng sai"
                        disabled={locked}
                        value={scoring.trueFalseMode}
                        options={[
                          {
                            value: "question",
                            label: "Theo số ý đúng trong câu",
                          },
                          { value: "statement", label: "Theo từng ý đúng" },
                        ]}
                        onChange={(v) => changeScoring({ trueFalseMode: v })}
                      />
                      {scoring.trueFalseMode === "statement" ? (
                        <label>
                          Điểm mỗi ý
                          <InputNumber
                            min={0}
                            max={100}
                            disabled={locked}
                            value={scoring.trueFalsePoints}
                            onChange={(v) =>
                              changeScoring({ trueFalsePoints: v ?? 0 })
                            }
                          />
                        </label>
                      ) : (
                        <div className="tf-scale">
                          {[1, 2, 3, 4].map((n) => (
                            <label key={n}>
                              Đúng {n} ý
                              <InputNumber
                                aria-label={`Điểm khi đúng ${n} ý`}
                                min={0}
                                max={100}
                                disabled={locked}
                                value={scoring.trueFalseScale[n]}
                                onChange={(v) =>
                                  changeScoring({
                                    trueFalseScale: scoring.trueFalseScale.map(
                                      (old, i) => (i === n ? (v ?? 0) : old),
                                    ),
                                  })
                                }
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </section>
                    <section>
                      <h3>Phần trả lời ngắn</h3>
                      <label>
                        Số câu
                        <InputNumber
                          aria-label="Số câu trả lời ngắn"
                          min={0}
                          max={6}
                          disabled={locked}
                          value={scoring.shortAnswerCount}
                          onChange={(v) =>
                            changeScoring({ shortAnswerCount: v ?? 0 })
                          }
                        />
                      </label>
                      <label>
                        Điểm mỗi câu
                        <InputNumber
                          aria-label="Điểm mỗi câu trả lời ngắn"
                          formatter={(value, info) =>
                            info.userTyping
                              ? info.input
                              : String(Number(Number(value ?? 0).toFixed(6)))
                          }
                          min={0}
                          max={100}
                          disabled={locked}
                          value={scoring.shortAnswerPoints}
                          onChange={(v) =>
                            changeScoring({ shortAnswerPoints: v ?? 0 })
                          }
                        />
                      </label>
                      <label>
                        Sai số chấp nhận
                        <InputNumber
                          min={0}
                          max={100}
                          disabled={locked}
                          value={scoring.numericTolerance}
                          onChange={(v) =>
                            changeScoring({ numericTolerance: v ?? 0 })
                          }
                        />
                      </label>
                    </section>
                  </div>
                  <p>
                    <strong>
                      Tổng điểm tối đa: {roundScore(maxExamScore(scoring))}
                    </strong>{" "}
                    · Mẫu phiếu tối đa 40 câu chọn đáp án, 8 câu đúng/sai (mỗi
                    câu 4 ý), 6 câu trả lời ngắn.
                  </p>
                  <Tabs
                    activeKey={active}
                    onChange={setActive}
                    tabBarExtraContent={
                      !locked && (
                        <Button
                          size="small"
                          icon={<PlusOutlined aria-hidden />}
                          disabled={keys.length >= 30}
                          onClick={() => {
                            setKeys([
                              ...keys,
                              {
                                code: String(keys.length + 1).padStart(4, "0"),
                                answers: emptyAnswers(scoring),
                              },
                            ]);
                            setActive(String(keys.length));
                            setDirty(true);
                          }}
                        >
                          Thêm mã đề
                        </Button>
                      )
                    }
                    items={keys.map((key, i) => ({
                      key: String(i),
                      label: `Mã đề ${key.code || "chưa nhập"}`,
                      children: (
                        <>
                          <Space wrap style={{ marginBottom: 12 }}>
                            <span>Mã đề gồm 4 chữ số</span>
                            <Input
                              aria-label={`Mã đề thứ ${i + 1}`}
                              style={{ width: 100 }}
                              maxLength={4}
                              disabled={locked}
                              value={key.code}
                              onChange={(e) => {
                                setKeys(
                                  keys.map((k, j) =>
                                    j === i
                                      ? { ...k, code: e.target.value }
                                      : k,
                                  ),
                                );
                                setDirty(true);
                              }}
                            />
                            <Button
                              disabled={locked}
                              onClick={() => {
                                pasteForm.resetFields();
                                setPaste(true);
                              }}
                            >
                              Dán nhanh đáp án
                            </Button>
                            <Button
                              danger
                              disabled={locked || keys.length === 1}
                              icon={<DeleteOutlined aria-hidden />}
                              onClick={() => {
                                setKeys(keys.filter((_, j) => j !== i));
                                setActive("0");
                                setDirty(true);
                              }}
                            >
                              Xóa mã đề
                            </Button>
                          </Space>
                          <AnswerEditor
                            id={`Đáp án mã đề ${key.code}`}
                            answers={key.answers}
                            scoring={scoring}
                            disabled={locked}
                            onChange={(answers) => {
                              setKeys(
                                keys.map((k, j) =>
                                  j === i ? { ...k, answers } : k,
                                ),
                              );
                              setDirty(true);
                            }}
                          />
                        </>
                      ),
                    }))}
                  />
                </>
              ),
            },
          ]}
        />
      </Form>
      <Modal
        open={paste}
        title="Dán đáp án cho mã đề đang chọn"
        onCancel={() => setPaste(false)}
        onOk={() => pasteForm.submit()}
        okText="Điền đáp án"
        cancelText="Hủy"
      >
        <Form form={pasteForm} layout="vertical" onFinish={pasteAnswers}>
          <Form.Item
            name="multiple"
            label={`${scoring.multipleChoiceCount} đáp án chọn A–D, cách nhau bằng dấu cách`}
          >
            <Input.TextArea rows={3} placeholder="A B C D A B…" />
          </Form.Item>
          <Form.Item
            name="truth"
            label={`${scoring.trueFalseCount} câu đúng/sai; mỗi dòng bốn ý`}
          >
            <Input.TextArea rows={4} placeholder={"Đ S Đ S\nS Đ Đ S"} />
          </Form.Item>
          <Form.Item
            name="short"
            label={`${scoring.shortAnswerCount} trả lời ngắn; mỗi dòng một số`}
          >
            <Input.TextArea rows={4} placeholder={"1,5\n-2\n0,25"} />
          </Form.Item>
        </Form>
      </Modal>
    </Modal>
  );
}

"use client";
import { useState } from "react";
import {
  Alert,
  App,
  Button,
  Checkbox,
  Collapse,
  Input,
  Modal,
  Select,
  Space,
} from "antd";
import { AimOutlined, CheckOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  emptyAnswers,
  scoreAnswers,
  type AnswerSet,
  type Exam,
  type ExamCandidate,
  type Grade,
  type PaperScan,
  type Point,
} from "@/lib/grading-model";
import { gradingFetch } from "@/lib/grading-client";
import AnswerEditor from "./answer-editor";
export default function ScanReview({
  exam,
  scan,
  candidates,
  grades,
  onClose,
  onSaved,
}: {
  exam: Exam;
  scan: PaperScan;
  candidates: ExamCandidate[];
  grades: Grade[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { message, modal } = App.useApp();
  const initial = scan.result;
  const [answers, setAnswers] = useState<AnswerSet>(
    scan.answers ?? initial?.answers ?? emptyAnswers(exam.scoring),
  );
  const [student, setStudent] = useState(
    scan.approval?.studentId ??
      candidates.find((c) => c.candidate_number === initial?.candidateNumber)
        ?.student_id ??
      "",
  );
  const [variant, setVariant] = useState(
    scan.approval?.variant ??
      (exam.answer_keys.some((k) => k.code === initial?.variant)
        ? initial!.variant
        : ""),
  );
  const [acknowledged, setAcknowledged] = useState(false),
    [note, setNote] = useState(scan.approval?.note ?? ""),
    [busy, setBusy] = useState(false),
    [align, setAlign] = useState(false),
    [corners, setCorners] = useState<Point[]>([]),
    [dirty, setDirty] = useState(false);
  const readOnly =
    scan.status === "approved" || scan.status === "rejected" || exam.archived;
  const stale =
    scan.recognized_exam_version !== null &&
    scan.recognized_exam_version !== exam.version;
  const key = exam.answer_keys.find((k) => k.code === variant);
  let result: ReturnType<typeof scoreAnswers> | null = null;
  try {
    if (key) result = scoreAnswers(exam.scoring, key.answers, answers);
  } catch {
    /* Show incomplete numeric edits until corrected. */
  }
  const warnings = initial?.warnings ?? [];
  function close() {
    if (dirty)
      modal.confirm({
        title: "Đóng bài đang kiểm tra?",
        content: "Các đáp án vừa sửa chưa được ghi vào bảng điểm.",
        okText: "Đóng",
        cancelText: "Tiếp tục kiểm tra",
        onOk: onClose,
      });
    else onClose();
  }
  async function process(manual = false) {
    setBusy(true);
    try {
      await gradingFetch(`/api/grading/scans/${scan.id}/process`, "POST", {
        version: scan.version,
        ...(corners.length === 4 && !manual ? { corners } : {}),
        manual,
      });
      message.success(
        manual ? "Đã mở phần nhập đáp án từ ảnh." : "Đã xử lý lại ảnh.",
      );
      onSaved();
      onClose();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function approve(replaceVersion = 0) {
    setBusy(true);
    try {
      await gradingFetch(`/api/grading/scans/${scan.id}/approve`, "POST", {
        version: scan.version,
        examVersion: exam.version,
        studentId: student,
        variant,
        answers,
        note,
        acknowledged,
        replaceVersion,
      });
      message.success("Đã duyệt và ghi điểm vào bảng điểm học kỳ.");
      onSaved();
      onClose();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function submit() {
    if (!student || !result || !variant) {
      message.warning(
        "Chọn học sinh, mã đề và kiểm tra câu trả lời trước khi duyệt.",
      );
      return;
    }
    if (warnings.length && !acknowledged) {
      message.warning("Xác nhận đã đối chiếu các ô cảnh báo với ảnh.");
      return;
    }
    const old = grades.find(
      (g) => g.student_id === student && g.exam_id === exam.id && !g.deleted_at,
    );
    if (old)
      modal.confirm({
        title: "Thay thế điểm đã có?",
        content: `Học sinh đã có ${old.score}/${old.max_score} điểm. Điểm cũ được giữ trong lịch sử.`,
        okText: "Thay thế bằng điểm vừa duyệt",
        cancelText: "Kiểm tra lại",
        onOk: () => approve(old.version),
      });
    else void approve();
  }
  return (
    <Modal
      open
      width={1280}
      style={{ top: 20 }}
      title={`Kiểm tra bài chụp · ${exam.title}`}
      onCancel={close}
      footer={null}
      destroyOnHidden
    >
      <div className="scan-review-grid">
        <section className="scan-image-section">
          <Space wrap style={{ marginBottom: 12 }}>
            <Button
              disabled={readOnly || !scan.image_path || busy}
              icon={<AimOutlined aria-hidden />}
              onClick={() => {
                setAlign(!align);
                setCorners([]);
              }}
            >
              Căn chỉnh bốn góc
            </Button>
            <Button
              disabled={
                readOnly ||
                !scan.image_path ||
                busy ||
                (align && corners.length !== 4)
              }
              loading={busy}
              icon={<ReloadOutlined aria-hidden />}
              onClick={() => void process()}
            >
              Nhận dạng lại
            </Button>
          </Space>
          {align && (
            <Alert
              type="info"
              showIcon
              title={`Chọn tâm bốn dấu vuông ngoài cùng theo thứ tự của phiếu: trên trái → trên phải → dưới phải → dưới trái (${corners.length}/4).`}
              action={<Button onClick={() => setCorners([])}>Chọn lại</Button>}
            />
          )}
          {scan.image_path ? (
            <div
              className={`scan-image ${align ? "is-aligning" : ""}`}
              onClick={(event) => {
                if (!align || corners.length >= 4) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                setCorners([
                  ...corners,
                  {
                    x: (event.clientX - bounds.left) / bounds.width,
                    y: (event.clientY - bounds.top) / bounds.height,
                  },
                ]);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/grading/scans/${scan.id}/image?v=${scan.version}`}
                alt="Ảnh gốc bài làm để đối chiếu đáp án"
              />
              {corners.map((p, i) => (
                <span
                  key={i}
                  className="scan-corner"
                  style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                >
                  {i + 1}
                </span>
              ))}
            </div>
          ) : (
            <Alert
              type="info"
              title="Ảnh tạm đã được dọn. Điểm đã duyệt và lịch sử vẫn được giữ."
            />
          )}
          <p className="muted">
            Ảnh gốc dùng để đối chiếu. Căn chỉnh lại sẽ thay phần nhận dạng hiện
            tại; các sửa đổi chưa duyệt sẽ không được giữ.
          </p>
        </section>
        <section className="scan-answer-section">
          {scan.error_text && (
            <Alert type="error" showIcon title={scan.error_text} />
          )}
          {stale && (
            <Alert
              type="warning"
              showIcon
              title="Đáp án hoặc thông tin bài kiểm tra đã thay đổi. Nhận dạng lại trước khi duyệt."
            />
          )}
          {warnings.length > 0 && (
            <Collapse
              items={[
                {
                  key: "warnings",
                  label: `${warnings.length} điểm cần đối chiếu với ảnh`,
                  children: (
                    <ul className="scan-warnings">
                      {warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  ),
                },
              ]}
            />
          )}
          <label className="grading-field">
            Học sinh theo số báo danh
            <Select
              aria-label="Học sinh bài chụp"
              showSearch
              optionFilterProp="label"
              placeholder="Chọn học sinh"
              disabled={readOnly}
              value={student || undefined}
              options={candidates.map((c) => ({
                value: c.student_id,
                label: `${c.candidate_number} · ${c.student_name}`,
              }))}
              onChange={(v) => {
                setStudent(v);
                setAcknowledged(false);
                setDirty(true);
              }}
            />
          </label>
          {initial?.candidateNumber && (
            <p className="muted">
              Số báo danh đọc được: {initial.candidateNumber}
              {!candidates.some(
                (c) => c.candidate_number === initial.candidateNumber,
              ) && " · chưa có trong danh sách dự thi"}
            </p>
          )}
          <label className="grading-field">
            Mã đề
            <Select
              aria-label="Mã đề bài chụp"
              placeholder="Chọn mã đề"
              disabled={readOnly}
              value={variant || undefined}
              options={exam.answer_keys.map((k) => ({
                value: k.code,
                label: `Mã đề ${k.code}`,
              }))}
              onChange={(v) => {
                setVariant(v);
                setAcknowledged(false);
                setDirty(true);
              }}
            />
          </label>
          <AnswerEditor
            id="Bài làm"
            answers={answers}
            scoring={exam.scoring}
            disabled={readOnly || scan.status !== "review"}
            onChange={(a) => {
              setAnswers(a);
              setAcknowledged(false);
              setDirty(true);
            }}
          />
          {scan.status === "failed" && !readOnly && (
            <Button onClick={() => void process(true)} loading={busy}>
              Nhập đáp án thủ công từ ảnh
            </Button>
          )}
          <div className="scan-score-preview">
            <span>Điểm tính theo đáp án đã chọn</span>
            <strong>
              {result
                ? `${result.score} / ${result.maxScore}`
                : "Chưa đủ thông tin"}
            </strong>
          </div>
          <Input.TextArea
            aria-label="Ghi chú duyệt bài"
            rows={2}
            maxLength={2000}
            placeholder="Ghi chú đối chiếu hoặc chỉnh sửa đáp án…"
            value={note}
            disabled={readOnly}
            onChange={(e) => {
              setNote(e.target.value);
              setDirty(true);
            }}
          />
          {!readOnly && (
            <>
              <Checkbox
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                style={{ margin: "16px 0" }}
              >
                Tôi đã đối chiếu ảnh, học sinh, mã đề và các ô cảnh báo.
              </Checkbox>
              <Button
                block
                type="primary"
                size="large"
                icon={<CheckOutlined aria-hidden />}
                loading={busy}
                disabled={
                  scan.status !== "review" ||
                  !scan.image_path ||
                  stale ||
                  !student ||
                  !result ||
                  !acknowledged
                }
                onClick={submit}
              >
                Duyệt và ghi điểm
              </Button>
            </>
          )}
          {readOnly && (
            <Alert
              type="info"
              showIcon
              title={
                scan.status === "approved"
                  ? "Bài đã được giáo viên duyệt. Các thay đổi điểm sau đó được quản lý trong bảng điểm và lịch sử."
                  : "Ảnh đã được loại khỏi danh sách chấm."
              }
            />
          )}
        </section>
      </div>
    </Modal>
  );
}

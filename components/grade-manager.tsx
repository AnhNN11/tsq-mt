"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
} from "antd";
import {
  CameraOutlined,
  DeleteOutlined,
  EditOutlined,
  FileExcelOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  canonicalSchoolYear,
  EXAM_KINDS,
  maxExamScore,
  roundScore,
  semesterAverage,
  type Exam,
  type Grade,
} from "@/lib/grading-model";
import type { Student, Workspace } from "@/lib/model";
import { gradingFetch } from "@/lib/grading-client";
import ExamEditor from "./exam-editor";
import ExamDetail from "./exam-detail";
import { exportGradebook } from "@/lib/grade-export";
type ExamWithHistory = Exam & { has_history?: boolean };
export default function GradeManager({
  data,
  students,
  subject,
  className,
}: {
  data: Workspace;
  students: Student[];
  subject: string;
  className: string;
}) {
  const { message } = App.useApp();
  const [year, setYear] = useState(
      canonicalSchoolYear(data.settings.schoolYear),
    ),
    [semester, setSemester] = useState(1),
    [tab, setTab] = useState("book"),
    [query, setQuery] = useState("");
  const [exams, setExams] = useState<ExamWithHistory[]>([]),
    [grades, setGrades] = useState<Grade[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [editing, setEditing] = useState<ExamWithHistory | "new" | null>(null),
    [detailId, setDetailId] = useState("");
  const [manual, setManual] = useState<{
      student: Student;
      exam: Exam;
      grade?: Grade;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [manualForm] = Form.useForm();
  const [archived, setArchived] = useState(false),
    [exportBusy, setExportBusy] = useState(false);
  const generation = useRef(0);
  const classId = data.classes.find((c) => c.name === className)?.id;
  const [loadedScope, setLoadedScope] = useState("");
  const scope = new URLSearchParams({
    year,
    semester: String(semester),
    subject,
    ...(classId ? { class_id: classId } : {}),
  }).toString();
  const isLoading = loading || loadedScope !== scope;
  const refresh = useCallback(
    (signal?: AbortSignal) => {
      const version = ++generation.current;
      return gradingFetch<{ exams: ExamWithHistory[]; grades: Grade[] }>(
        `/api/grading?${scope}`,
      )
        .then((result) => {
          if (signal?.aborted || version !== generation.current) return;
          setExams(result.exams);
          setGrades(result.grades);
          setError("");
        })
        .catch((e) => {
          if (signal?.aborted || version !== generation.current) return;
          setExams([]);
          setGrades([]);
          setError((e as Error).message);
        })
        .finally(() => {
          if (!signal?.aborted && version === generation.current) {
            setLoading(false);
            setLoadedScope(scope);
          }
        });
    },
    [scope, setLoadedScope],
  );
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);
  const active = exams.filter((e) => !e.archived),
    bookExams = exams.filter(
      (e) => !e.archived || grades.some((g) => g.exam_id === e.id),
    ),
    displayed = exams.filter((e) => e.archived === archived);
  const rows = students.filter((s) =>
    `${s.name} ${s.id}`
      .toLocaleLowerCase("vi")
      .includes(query.toLocaleLowerCase("vi")),
  );
  function openManual(student: Student, exam: Exam) {
    const grade = grades.find(
      (g) => g.exam_id === exam.id && g.student_id === student.id,
    );
    setManual({ student, exam, grade });
    manualForm.resetFields();
    manualForm.setFieldsValue({ score: grade?.score, note: grade?.note ?? "" });
  }
  async function saveManual(values: { score: number; note: string }) {
    if (!manual) return;
    setBusy(true);
    try {
      await gradingFetch("/api/grading/grades", "POST", {
        ...values,
        note: values.note ?? "",
        examId: manual.exam.id,
        studentId: manual.student.id,
        version: manual.grade?.version ?? 0,
      });
      setManual(null);
      await refresh();
      message.success("Đã lưu điểm và lịch sử cập nhật.");
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const firstYear = Number(data.settings.schoolYear.slice(0, 4));
  return (
    <section className="list-panel grade-manager">
      <div className="panel-heading">
        <div>
          <h2>Bảng điểm học kỳ · Môn {subject}</h2>
          <p>
            Chấm ảnh theo đáp án từng mã đề; giáo viên duyệt trước khi ghi điểm.
          </p>
        </div>
        <Space wrap>
          <Button
            icon={<ReloadOutlined aria-hidden />}
            onClick={() => void refresh()}
          >
            Làm mới
          </Button>
          <Button
            icon={<FileExcelOutlined aria-hidden />}
            loading={exportBusy}
            disabled={isLoading || Boolean(error)}
            onClick={async () => {
              setExportBusy(true);
              try {
                await exportGradebook({
                  exams,
                  grades,
                  students: rows,
                  classes: data.classes,
                  subject,
                  year,
                  semester,
                });
                message.success("Đã xuất bảng điểm Excel.");
              } catch {
                message.error("Chưa xuất được bảng điểm.");
              } finally {
                setExportBusy(false);
              }
            }}
          >
            Xuất bảng điểm
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined aria-hidden />}
            disabled={!data.classes.length}
            onClick={() => setEditing("new")}
          >
            Tạo bài kiểm tra
          </Button>
        </Space>
      </div>
      <div className="table-toolbar">
        <Select
          aria-label="Năm học bảng điểm"
          value={year}
          onChange={setYear}
          options={Array.from({ length: 8 }, (_, i) => {
            const start = firstYear - 5 + i;
            const value = `${start} – ${start + 1}`;
            return { value, label: `Năm học ${value}` };
          })}
          style={{ minWidth: 230 }}
        />
        <Select
          aria-label="Học kỳ bảng điểm"
          value={semester}
          onChange={setSemester}
          options={[
            { value: 1, label: "Học kỳ một" },
            { value: 2, label: "Học kỳ hai" },
          ]}
          style={{ minWidth: 170 }}
        />
        <Input
          aria-label="Tìm học sinh trong bảng điểm"
          placeholder="Tìm tên hoặc mã học sinh…"
          allowClear
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: 300 }}
        />
      </div>
      {error && (
        <Alert
          type="error"
          showIcon
          title={error}
          action={<Button onClick={() => void refresh()}>Thử lại</Button>}
        />
      )}
      <Tabs
        className="grade-tabs"
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: "book",
            label: `Bảng điểm (${rows.length} học sinh)`,
            children: (
              <>
                <Table<Student>
                  rowKey="id"
                  loading={isLoading}
                  dataSource={rows}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showTotal: (total) => `${total} học sinh`,
                  }}
                  scroll={{ x: Math.max(850, 380 + bookExams.length * 130) }}
                  columns={[
                    {
                      title: "HỌC SINH",
                      fixed: "left",
                      width: 220,
                      render: (_, s) => (
                        <span>
                          <strong>{s.name}</strong>
                          <small className="table-subline">
                            Lớp {s.className}
                          </small>
                        </span>
                      ),
                    },
                    ...bookExams.map((exam) => ({
                      title: (
                        <Tooltip
                          title={`${EXAM_KINDS[exam.kind]} · Lớp ${exam.class_name} · Trọng số ${exam.weight}`}
                        >
                          <span>
                            {exam.title}
                            <small className="column-subtitle">
                              {EXAM_KINDS[exam.kind]} · Trọng số {exam.weight}
                            </small>
                          </span>
                        </Tooltip>
                      ),
                      key: exam.id,
                      width: 150,
                      render: (_: unknown, student: Student) => {
                        if (
                          data.classes.find((c) => c.name === student.className)
                            ?.id !== exam.class_id
                        )
                          return <span className="muted">—</span>;
                        const grade = grades.find(
                          (g) =>
                            g.student_id === student.id &&
                            g.exam_id === exam.id,
                        );
                        return (
                          <Button
                            type="text"
                            className="grade-score-cell"
                            disabled={exam.archived}
                            aria-label={`Điểm ${student.name} bài ${exam.title}`}
                            onClick={() => openManual(student, exam)}
                          >
                            {grade ? (
                              <>
                                <strong>{grade.score}</strong>
                                <small>/{grade.max_score}</small>
                              </>
                            ) : (
                              <span className="unfilled">Nhập điểm</span>
                            )}
                          </Button>
                        );
                      },
                    })),
                    {
                      title: "TỔNG HỢP / 10",
                      fixed: "right",
                      width: 145,
                      render: (_, s) => {
                        const cls = data.classes.find(
                          (c) => c.name === s.className,
                        );
                        const summary = semesterAverage(
                          bookExams.filter((e) => e.class_id === cls?.id),
                          grades,
                          s.id,
                        );
                        return (
                          <span>
                            <strong>{summary.average ?? "—"}</strong>
                            <small className="table-subline">
                              {summary.count}/{summary.total} bài đã có điểm
                            </small>
                          </span>
                        );
                      },
                    },
                  ]}
                />
                <p className="section-description">
                  Điểm tổng hợp = trung bình các điểm đã có, quy về thang 10 và
                  nhân trọng số. Bài chưa có điểm được để trống. Chọn lớp ở
                  thanh trên để bảng gọn hơn.
                </p>
              </>
            ),
          },
          {
            key: "exams",
            label: `Bài kiểm tra (${active.length})`,
            children: (
              <>
                <div className="table-toolbar">
                  <Select
                    aria-label="Trạng thái bài kiểm tra"
                    value={archived ? "archived" : "active"}
                    options={[
                      { value: "active", label: "Đang sử dụng" },
                      { value: "archived", label: "Đã lưu trữ" },
                    ]}
                    onChange={(v) => setArchived(v === "archived")}
                  />
                  <Button
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const result = await gradingFetch<{ removed: number }>(
                          "/api/grading/cleanup",
                          "POST",
                        );
                        message.success(
                          `Đã dọn ${result.removed} ảnh hết hạn; điểm đã duyệt được giữ.`,
                        );
                      } catch (e) {
                        message.error((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                    loading={busy}
                  >
                    Dọn ảnh tạm hết hạn
                  </Button>
                </div>
                <Table<ExamWithHistory>
                  rowKey="id"
                  loading={isLoading}
                  dataSource={displayed}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 1000 }}
                  columns={[
                    {
                      title: "BÀI KIỂM TRA",
                      dataIndex: "title",
                      render: (value, e) => (
                        <Button type="link" onClick={() => setDetailId(e.id)}>
                          {value}
                        </Button>
                      ),
                    },
                    {
                      title: "LỚP",
                      render: (_, e) =>
                        data.classes.find((c) => c.id === e.class_id)?.name ??
                        e.class_name,
                    },
                    {
                      title: "LOẠI ĐIỂM",
                      render: (_, e) => EXAM_KINDS[e.kind],
                    },
                    { title: "NGÀY", dataIndex: "exam_date" },
                    {
                      title: "MÃ ĐỀ",
                      render: (_, e) =>
                        e.answer_keys.map((k) => (
                          <Tag key={k.code}>{k.code}</Tag>
                        )),
                    },
                    {
                      title: "ĐÃ CÓ ĐIỂM",
                      render: (_, e) =>
                        `${grades.filter((g) => g.exam_id === e.id).length} học sinh`,
                    },
                    {
                      title: "THAO TÁC",
                      fixed: "right",
                      width: 240,
                      render: (_, e) => (
                        <Space size={0}>
                          <Button
                            icon={<CameraOutlined aria-hidden />}
                            size="small"
                            onClick={() => setDetailId(e.id)}
                          >
                            Bài làm
                          </Button>
                          {!e.archived && (
                            <Button
                              type="text"
                              aria-label={`Sửa bài kiểm tra ${e.title}`}
                              icon={<EditOutlined aria-hidden />}
                              onClick={() => setEditing(e)}
                            />
                          )}
                          <Popconfirm
                            title={
                              e.archived
                                ? "Mở lại bài kiểm tra?"
                                : "Lưu trữ bài kiểm tra?"
                            }
                            description="Điểm và lịch sử vẫn được giữ. Phiên nhận ảnh đang mở sẽ đóng khi lưu trữ."
                            okText={e.archived ? "Mở lại" : "Lưu trữ"}
                            cancelText="Hủy"
                            onConfirm={async () => {
                              try {
                                await gradingFetch(
                                  `/api/grading/exams/${e.id}`,
                                  "PATCH",
                                  { archived: !e.archived, version: e.version },
                                );
                                await refresh();
                                message.success(
                                  e.archived
                                    ? "Đã mở lại bài kiểm tra."
                                    : "Đã lưu trữ bài kiểm tra.",
                                );
                              } catch (error) {
                                message.error((error as Error).message);
                              }
                            }}
                          >
                            <Button type="text" danger={!e.archived}>
                              {e.archived ? "Mở lại" : "Lưu trữ"}
                            </Button>
                          </Popconfirm>
                        </Space>
                      ),
                    },
                  ]}
                />
              </>
            ),
          },
        ]}
      />
      {editing && (
        <ExamEditor
          key={editing === "new" ? "new" : `${editing.id}-${editing.version}`}
          exam={editing === "new" ? undefined : editing}
          classes={data.classes}
          subject={subject}
          year={year}
          semester={semester}
          classId={classId}
          locked={
            editing !== "new" &&
            (Boolean(editing.has_history) ||
              grades.some((g) => g.exam_id === editing.id))
          }
          onClose={() => setEditing(null)}
          onSaved={() => {
            void refresh();
            setTab("exams");
          }}
        />
      )}
      {detailId && (
        <ExamDetail
          examId={detailId}
          students={data.students}
          classes={data.classes}
          onClose={() => setDetailId("")}
          onChanged={() => void refresh()}
        />
      )}
      <Modal
        open={Boolean(manual)}
        title={
          manual
            ? `Điểm ${manual.student.name} · ${manual.exam.title}`
            : "Nhập điểm"
        }
        onCancel={() => setManual(null)}
        onOk={() => manualForm.submit()}
        okText="Lưu điểm"
        cancelText="Hủy"
        confirmLoading={busy}
        destroyOnHidden
      >
        {manual && (
          <>
            <p>
              Điểm tối đa: {roundScore(maxExamScore(manual.exam.scoring))}. Chỉ
              nhập khi giáo viên đã kiểm tra bài.
            </p>
            <Form form={manualForm} layout="vertical" onFinish={saveManual}>
              <Form.Item
                name="score"
                label="Điểm bài kiểm tra"
                rules={[
                  { required: true, message: "Nhập điểm từ bài đã kiểm tra." },
                ]}
              >
                <InputNumber
                  aria-label="Điểm bài kiểm tra"
                  min={0}
                  max={roundScore(maxExamScore(manual.exam.scoring))}
                  precision={2}
                  style={{ width: "100%" }}
                />
              </Form.Item>
              <Form.Item name="note" label="Ghi chú cập nhật điểm">
                <Input.TextArea rows={3} maxLength={2000} />
              </Form.Item>
            </Form>
            {manual.grade && (
              <Popconfirm
                title="Xóa điểm bài này?"
                description="Điểm được bỏ khỏi tổng hợp; giá trị cũ vẫn có trong lịch sử."
                okText="Xóa điểm"
                cancelText="Hủy"
                onConfirm={async () => {
                  try {
                    await gradingFetch(
                      `/api/grading/grades/${manual.grade!.id}`,
                      "DELETE",
                      { version: manual.grade!.version },
                    );
                    setManual(null);
                    await refresh();
                    message.success("Đã xóa điểm khỏi bảng tổng hợp.");
                  } catch (e) {
                    message.error((e as Error).message);
                  }
                }}
              >
                <Button danger icon={<DeleteOutlined aria-hidden />}>
                  Xóa điểm
                </Button>
              </Popconfirm>
            )}
          </>
        )}
      </Modal>
    </section>
  );
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  App,
  Breadcrumb,
  Button,
  Empty,
  Popconfirm,
  Select,
  Space,
  Steps,
  Table,
  Tag,
} from "antd";
import {
  ArrowLeftOutlined,
  CameraOutlined,
  EditOutlined,
  FileExcelOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useUser } from "./auth-context";
import { canAssess } from "@/lib/access";
import type { Student, Workspace } from "@/lib/model";
import {
  canonicalSchoolYear,
  maxExamScore,
  roundScore,
  type Exam,
  type Grade,
} from "@/lib/grading-model";
import type { PaperTemplate } from "@/lib/paper-template-model";
import { gradingFetch } from "@/lib/grading-client";
import { exportGradebook } from "@/lib/grade-export";
import ExamEditor from "./exam-editor";
import DirectExamDetail from "./direct-exam-detail";
import TemplateManager from "./paper-template-manager";
type ManagedExam = Exam & { has_history?: boolean };
export default function GradeManager({
  data,
}: {
  data: Workspace;
  students: Student[];
  subject: string;
  className: string;
}) {
  const user = useUser(),
    { message } = App.useApp();
  const [classId, setClassId] = useState(""),
    [subject, setSubject] = useState(""),
    [exams, setExams] = useState<ManagedExam[]>([]),
    [grades, setGrades] = useState<Grade[]>([]),
    [templates, setTemplates] = useState<PaperTemplate[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [archived, setArchived] = useState(false),
    [editing, setEditing] = useState<ManagedExam | "new" | null>(null),
    [detail, setDetail] = useState(""),
    [showTemplates, setShowTemplates] = useState(false),
    [exporting, setExporting] = useState(false);
  const generation = useRef(0),
    year = canonicalSchoolYear(data.settings.schoolYear),
    cls = data.classes.find((c) => c.id === classId);
  const refresh = useCallback(() => {
    if (!classId || !subject) return Promise.resolve();
    const version = ++generation.current;
    return Promise.all([
      gradingFetch<{ exams: ManagedExam[]; grades: Grade[] }>(
        `/api/grading?${new URLSearchParams({ year, subject, class_id: classId })}`,
      ),
      gradingFetch<{ templates: PaperTemplate[] }>(
        `/api/grading/templates?subject=${encodeURIComponent(subject)}`,
      ),
    ])
      .then(([r, t]) => {
        if (version !== generation.current) return;
        setExams(r.exams);
        setGrades(r.grades);
        setTemplates(t.templates);
        setError("");
      })
      .catch((e) => {
        if (version === generation.current) {
          setExams([]);
          setGrades([]);
          setTemplates([]);
          setError((e as Error).message);
        }
      })
      .finally(() => {
        if (version === generation.current) setLoading(false);
      });
  }, [classId, subject, year]);
  useEffect(() => {
    void refresh();
    const counter = generation;
    return () => {
      counter.current++;
    };
  }, [refresh]);
  function chooseClass(id: string) {
    setClassId(id);
    setSubject("");
    setExams([]);
    setGrades([]);
    setError("");
  }
  function chooseSubject(value: string) {
    setExams([]);
    setGrades([]);
    setTemplates([]);
    setSubject(value);
    setLoading(true);
    setError("");
  }
  const pupils = data.students.filter((s) => s.className === cls?.name),
    shown = exams.filter((e) => e.archived === archived);
  return (
    <section className="list-panel direct-exams">
      <Steps
        size="small"
        current={!cls ? 0 : !subject ? 1 : 2}
        items={[
          { title: "Chọn lớp" },
          { title: "Chọn môn" },
          { title: "Bài thi và chấm điểm" },
        ]}
        style={{ marginBottom: 24 }}
      />
      {!cls ? (
        <>
          <h2>Chọn lớp để chấm thi</h2>
          <Table
            rowKey="id"
            size="middle"
            pagination={false}
            dataSource={data.classes}
            columns={[
              {
                title: "Lớp",
                dataIndex: "name",
                render: (name) => <strong>Lớp {name}</strong>,
              },
              {
                title: "Sĩ số",
                render: (_, c) =>
                  `${data.students.filter((s) => s.className === c.name).length} học sinh`,
              },
              {
                title: "Thao tác",
                render: (_, c) => (
                  <Button
                    type="primary"
                    aria-label={`Chọn lớp ${c.name}`}
                    onClick={() => chooseClass(c.id)}
                  >
                    Chọn lớp
                  </Button>
                ),
              },
            ]}
          />
        </>
      ) : (
        <>
          <Breadcrumb
            items={[
              {
                title: (
                  <Button
                    type="link"
                    icon={<ArrowLeftOutlined aria-hidden />}
                    onClick={() => chooseClass("")}
                  >
                    Các lớp
                  </Button>
                ),
              },
              { title: `Lớp ${cls.name}` },
              ...(subject ? [{ title: subject }] : []),
            ]}
          />
          <div className="exam-subjects">
            <h2>Chọn môn của lớp {cls.name}</h2>
            <Space wrap>
              {["Tin học", "Tiếng Anh"]
                .filter((s) => canAssess(user, s))
                .map((s) => (
                  <Button
                    key={s}
                    size="large"
                    type={subject === s ? "primary" : "default"}
                    onClick={() => chooseSubject(s)}
                  >
                    {s}
                  </Button>
                ))}
            </Space>
          </div>
          {subject && (
            <>
              <div className="table-toolbar">
                <div>
                  <h2>Bài thi môn {subject}</h2>
                  <p className="muted">
                    Tạo tên bài thi, chọn mẫu phiếu, nhập đáp án và kết nối điện
                    thoại để chấm từng em.
                  </p>
                </div>
                <Space wrap>
                  <Button
                    icon={<ReloadOutlined aria-hidden />}
                    loading={loading}
                    onClick={() => {
                      setLoading(true);
                      void refresh();
                    }}
                  >
                    Làm mới
                  </Button>
                  <Button onClick={() => setShowTemplates(true)}>
                    Mẫu phiếu ô tô
                  </Button>
                  <Button
                    icon={<FileExcelOutlined aria-hidden />}
                    loading={exporting}
                    disabled={!exams.length}
                    onClick={async () => {
                      setExporting(true);
                      try {
                        await exportGradebook({
                          exams,
                          grades,
                          students: pupils,
                          classes: data.classes,
                          year,
                          subject,
                        });
                        message.success("Đã xuất bảng điểm Excel.");
                      } catch {
                        message.error("Chưa xuất được bảng điểm.");
                      } finally {
                        setExporting(false);
                      }
                    }}
                  >
                    Xuất bảng điểm
                  </Button>
                  <Button
                    type="primary"
                    icon={<PlusOutlined aria-hidden />}
                    disabled={loading || !templates.length}
                    onClick={() => setEditing("new")}
                  >
                    Tạo bài thi
                  </Button>
                </Space>
              </div>
              {error && <Alert type="error" showIcon title={error} />}
              <Select
                aria-label="Trạng thái bài thi"
                value={archived ? "archived" : "active"}
                options={[
                  { value: "active", label: "Đang sử dụng" },
                  { value: "archived", label: "Đã lưu trữ" },
                ]}
                onChange={(v) => setArchived(v === "archived")}
                style={{ minWidth: 180, margin: "0 0 16px" }}
              />
              <Table<ManagedExam>
                rowKey="id"
                size="small"
                loading={loading}
                dataSource={shown}
                pagination={{ pageSize: 10 }}
                scroll={{ x: 950 }}
                locale={{
                  emptyText: (
                    <Empty description="Chưa có bài thi. Tạo bài thi theo tên và đáp án của giáo viên." />
                  ),
                }}
                columns={[
                  {
                    title: "Bài thi",
                    dataIndex: "title",
                    render: (v, e) => (
                      <Button type="link" onClick={() => setDetail(e.id)}>
                        {v}
                      </Button>
                    ),
                  },
                  { title: "Ngày thi", dataIndex: "exam_date", width: 120 },
                  {
                    title: "Mẫu phiếu",
                    render: (_, e) => e.template_name || "Mẫu đã cung cấp",
                    width: 250,
                  },
                  {
                    title: "Tiến độ",
                    render: (_, e) => (
                      <Tag color="green">
                        {grades.filter((g) => g.exam_id === e.id).length}/
                        {pupils.length} học sinh
                      </Tag>
                    ),
                    width: 145,
                  },
                  {
                    title: "Điểm tối đa",
                    render: (_, e) => roundScore(maxExamScore(e.scoring)),
                    width: 100,
                  },
                  {
                    title: "Thao tác",
                    width: 290,
                    render: (_, e) => (
                      <Space wrap>
                        <Button
                          icon={<CameraOutlined aria-hidden />}
                          size="small"
                          type="primary"
                          onClick={() => setDetail(e.id)}
                        >
                          {e.archived ? "Xem điểm" : "Chấm thi"}
                        </Button>
                        <Button
                          aria-label={`Sửa bài thi ${e.title}`}
                          icon={<EditOutlined aria-hidden />}
                          size="small"
                          disabled={e.archived}
                          onClick={() => setEditing(e)}
                        >
                          Sửa
                        </Button>
                        <Popconfirm
                          title={
                            e.archived
                              ? "Mở lại bài thi?"
                              : "Lưu trữ bài thi và đóng kết nối điện thoại?"
                          }
                          okText="Đồng ý"
                          cancelText="Hủy"
                          onConfirm={async () => {
                            try {
                              await gradingFetch(
                                `/api/grading/exams/${e.id}`,
                                "PATCH",
                                { archived: !e.archived, version: e.version },
                              );
                              await refresh();
                              message.success("Đã cập nhật bài thi.");
                            } catch (err) {
                              message.error((err as Error).message);
                            }
                          }}
                        >
                          <Button size="small">
                            {e.archived ? "Mở lại" : "Lưu trữ"}
                          </Button>
                        </Popconfirm>
                        <Popconfirm
                          title="Xóa bài thi chưa có lịch sử điểm?"
                          description="Bài thi đã có điểm cần dùng lưu trữ để bảo toàn kết quả."
                          okText="Xóa bài thi"
                          cancelText="Hủy"
                          onConfirm={async () => {
                            try {
                              await gradingFetch(
                                `/api/grading/exams/${e.id}`,
                                "DELETE",
                                { version: e.version },
                              );
                              await refresh();
                              message.success("Đã xóa bài thi khỏi danh sách.");
                            } catch (err) {
                              message.error((err as Error).message);
                            }
                          }}
                        >
                          <Button danger size="small" disabled={e.has_history}>
                            Xóa
                          </Button>
                        </Popconfirm>
                      </Space>
                    ),
                  },
                ]}
              />
            </>
          )}
        </>
      )}
      {editing && cls && (
        <ExamEditor
          exam={editing === "new" ? undefined : editing}
          classes={[cls]}
          classId={cls.id}
          subject={subject}
          year={year}
          semester={1}
          locked={editing !== "new" && Boolean(editing.has_history)}
          templates={templates}
          onClose={() => setEditing(null)}
          onSaved={() => void refresh()}
        />
      )}{" "}
      {detail && (
        <DirectExamDetail
          examId={detail}
          students={data.students}
          classes={data.classes}
          onClose={() => setDetail("")}
          onChanged={() => void refresh()}
        />
      )}{" "}
      {showTemplates && (
        <TemplateManager
          subject={subject}
          templates={templates}
          onClose={() => setShowTemplates(false)}
          onChanged={() => void refresh()}
        />
      )}
    </section>
  );
}

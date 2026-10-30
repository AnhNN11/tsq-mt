"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  App,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  QRCode,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
} from "antd";
import {
  CameraOutlined,
  CopyOutlined,
  PrinterOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { gradingFetch } from "@/lib/grading-client";
import {
  maxExamScore,
  roundScore,
  type Exam,
  type ExamCandidate,
  type Grade,
} from "@/lib/grading-model";
import type { SchoolClass, Student } from "@/lib/model";
type Detail = {
  exam: Exam;
  candidates: ExamCandidate[];
  grades: Grade[];
  history: {
    id: number;
    actor: string;
    action: string;
    previous_value: Grade | null;
    next_value: Grade | null;
    created_at: string;
  }[];
};
type Link = { id: string; url: string; expiresAt: string; maxUploads: number };
export default function DirectExamDetail({
  examId,
  students,
  classes,
  onClose,
  onChanged,
}: {
  examId: string;
  students: Student[];
  classes: SchoolClass[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { message } = App.useApp(),
    [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [link, setLink] = useState<Link | null>(null),
    [showQr, setShowQr] = useState(false),
    [variant, setVariant] = useState(""),
    [manual, setManual] = useState<ExamCandidate | null>(null),
    [form] = Form.useForm(),
    [roster, setRoster] = useState<ExamCandidate[] | null>(null);
  const lock = useRef(false),
    rosterVersion = useRef(0);
  const refresh = useCallback(() => {
    if (lock.current) return Promise.resolve();
    lock.current = true;
    return gradingFetch<Detail>(`/api/grading/exams/${examId}`)
      .then((data) => {
        setDetail(data);
        setError("");
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => {
        lock.current = false;
      });
  }, [examId]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 4000);
    return () => clearInterval(timer);
  }, [refresh]);
  async function createSession() {
    setBusy(true);
    try {
      const value = await gradingFetch<Link>(
        `/api/grading/exams/${examId}/sessions`,
        "POST",
      );
      setLink(value);
      setShowQr(true);
      message.success(
        "Đã mở kết nối điện thoại. Điểm sẽ tự cập nhật trong bảng.",
      );
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function closeSession() {
    if (!link) return;
    setBusy(true);
    try {
      await gradingFetch(`/api/grading/sessions/${link.id}`, "DELETE");
      setLink(null);
      setShowQr(false);
      message.success("Đã đóng kết nối điện thoại.");
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function close() {
    if (link) {
      try {
        await gradingFetch(`/api/grading/sessions/${link.id}`, "DELETE");
      } catch (e) {
        message.error((e as Error).message);
        return;
      }
    }
    onChanged();
    onClose();
  }
  async function save(values: { score: number; note?: string }) {
    if (!manual || !detail) return;
    setBusy(true);
    const old = detail.grades.find((g) => g.student_id === manual.student_id);
    try {
      await gradingFetch("/api/grading/grades", "POST", {
        examId,
        studentId: manual.student_id,
        score: values.score,
        note: values.note ?? "",
        version: old?.version ?? 0,
      });
      setManual(null);
      await refresh();
      onChanged();
      message.success("Đã lưu điểm và lịch sử cập nhật.");
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const exam = detail?.exam,
    code = exam?.answer_keys.some((k) => k.code === variant)
      ? variant
      : exam?.answer_keys[0]?.code;
  return (
    <Drawer
      open
      size="large"
      title={
        exam
          ? `${exam.title} · Lớp ${exam.class_name} · ${exam.subject}`
          : "Đang mở bài thi…"
      }
      onClose={() => void close()}
      extra={
        <Button
          icon={<ReloadOutlined aria-hidden />}
          onClick={() => void refresh()}
        >
          Làm mới điểm
        </Button>
      }
    >
      {error && <Alert type="error" showIcon title={error} />}{" "}
      {exam && detail && (
        <>
          <p>
            {exam.template_name || "Mẫu phiếu đã cung cấp"} · Ngày{" "}
            {exam.exam_date} · Tối đa {roundScore(maxExamScore(exam.scoring))}{" "}
            điểm
          </p>
          <Space wrap style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              icon={<CameraOutlined aria-hidden />}
              disabled={exam.archived}
              loading={busy}
              onClick={() => (link ? setShowQr(true) : void createSession())}
            >
              {link ? "Hiện mã QR kết nối" : "Kết nối điện thoại bằng QR"}
            </Button>
            {link && (
              <Button danger loading={busy} onClick={() => void closeSession()}>
                Đóng kết nối điện thoại
              </Button>
            )}
            <Tag color={exam.archived ? "default" : "green"}>
              {exam.archived ? "Đã lưu trữ" : "Đang chấm thi"}
            </Tag>
          </Space>
          <Alert
            type="info"
            showIcon
            title="Điện thoại chụp từng em → chấm → tự lưu điểm. Máy tính cập nhật mỗi 4 giây."
            description="Ảnh chỉ dùng trong lúc xử lý, không lưu lại bài thi. Ô không đọc rõ sẽ yêu cầu chụp lại; điểm đã có được bảo vệ khỏi ghi đè."
          />
          <Progress
            percent={
              detail.candidates.length
                ? Math.round(
                    (detail.grades.length / detail.candidates.length) * 100,
                  )
                : 0
            }
            format={() =>
              `${detail.grades.length}/${detail.candidates.length} học sinh`
            }
            style={{ margin: "16px 0" }}
          />
          <Tabs
            items={[
              {
                key: "results",
                label: "Danh sách và điểm",
                children: (
                  <>
                    <Space wrap style={{ marginBottom: 12 }}>
                      <Select
                        aria-label="Mã đề in phiếu"
                        value={code}
                        onChange={setVariant}
                        options={exam.answer_keys.map((k) => ({
                          value: k.code,
                          label: `Mã đề ${k.code}`,
                        }))}
                      />
                      <Button
                        icon={<PrinterOutlined aria-hidden />}
                        href={`/grading/exams/${examId}/sheets?student=all&variant=${code}`}
                        target="_blank"
                      >
                        In phiếu theo danh sách
                      </Button>
                      <Button
                        href={`/grading/exams/${examId}/sheets?student=blank&variant=${code}`}
                        target="_blank"
                      >
                        In phiếu trống
                      </Button>
                      <Button
                        disabled={exam.archived}
                        onClick={() => {
                          setRoster(structuredClone(detail.candidates));
                          rosterVersion.current = exam.version;
                        }}
                      >
                        Cập nhật danh sách dự thi
                      </Button>
                    </Space>
                    <Table<ExamCandidate>
                      rowKey="student_id"
                      size="small"
                      dataSource={detail.candidates}
                      pagination={{ pageSize: 20 }}
                      scroll={{ x: 600 }}
                      columns={[
                        {
                          title: "Số báo danh",
                          dataIndex: "candidate_number",
                          width: 110,
                        },
                        { title: "Học sinh", dataIndex: "student_name" },
                        {
                          title: "Điểm",
                          render: (_, c) => {
                            const g = detail.grades.find(
                              (g) => g.student_id === c.student_id,
                            );
                            return g ? (
                              <strong className="direct-score">
                                {g.score} / {g.max_score}
                              </strong>
                            ) : (
                              <Tag>Chưa chấm</Tag>
                            );
                          },
                        },
                        {
                          title: "Thao tác",
                          render: (_, c) => {
                            const g = detail.grades.find(
                              (g) => g.student_id === c.student_id,
                            );
                            return (
                              <Space>
                                <Button
                                  size="small"
                                  disabled={exam.archived}
                                  aria-label={`Sửa điểm ${c.student_name}`}
                                  onClick={() => {
                                    setManual(c);
                                    form.resetFields();
                                    form.setFieldsValue({
                                      score: g?.score,
                                      note: g?.note ?? "",
                                    });
                                  }}
                                >
                                  {g ? "Sửa điểm" : "Nhập điểm"}
                                </Button>
                                {g && (
                                  <Popconfirm
                                    title="Xóa điểm này?"
                                    description="Lịch sử được giữ; học sinh có thể được chụp lại."
                                    okText="Xóa điểm"
                                    cancelText="Hủy"
                                    onConfirm={async () => {
                                      try {
                                        await gradingFetch(
                                          `/api/grading/grades/${g.id}`,
                                          "DELETE",
                                          { version: g.version },
                                        );
                                        await refresh();
                                        onChanged();
                                        message.success(
                                          "Đã xóa điểm, giữ lịch sử.",
                                        );
                                      } catch (e) {
                                        message.error((e as Error).message);
                                      }
                                    }}
                                  >
                                    <Button
                                      danger
                                      size="small"
                                      disabled={exam.archived}
                                    >
                                      Xóa điểm
                                    </Button>
                                  </Popconfirm>
                                )}
                              </Space>
                            );
                          },
                        },
                      ]}
                    />
                  </>
                ),
              },
              {
                key: "history",
                label: "Lịch sử điểm",
                children: (
                  <Table
                    rowKey="id"
                    size="small"
                    dataSource={detail.history}
                    scroll={{ x: 560 }}
                    pagination={{ pageSize: 10 }}
                    columns={[
                      {
                        title: "Học sinh",
                        render: (_, h) =>
                          h.next_value?.student_name ??
                          h.previous_value?.student_name,
                      },
                      {
                        title: "Thay đổi",
                        render: (_, h) =>
                          h.action === "deleted"
                            ? "Đã xóa điểm"
                            : `${h.previous_value?.score ?? "Chưa có"} → ${h.next_value?.score ?? "—"}`,
                      },
                      { title: "Giáo viên", dataIndex: "actor" },
                      {
                        title: "Thời gian",
                        render: (_, h) =>
                          new Date(h.created_at).toLocaleString("vi-VN", {
                            timeZone: "Asia/Ho_Chi_Minh",
                          }),
                      },
                    ]}
                  />
                ),
              },
            ]}
          />
        </>
      )}
      <Modal
        open={showQr && Boolean(link)}
        title="Quét một lần để chấm cả lớp"
        destroyOnHidden
        onCancel={() => setShowQr(false)}
        footer={
          <Space>
            <Button onClick={() => setShowQr(false)}>
              Ẩn mã, tiếp tục chấm
            </Button>
            <Button danger loading={busy} onClick={() => void closeSession()}>
              Đóng kết nối điện thoại
            </Button>
          </Space>
        }
        width={520}
      >
        {link && (
          <div className="capture-qr">
            <QRCode value={link.url} size={240} />
            <p>
              Hiệu lực đến{" "}
              {new Date(link.expiresAt).toLocaleTimeString("vi-VN", {
                timeZone: "Asia/Ho_Chi_Minh",
              })}
              . Chỉ chia sẻ với giáo viên đang chấm.
            </p>
            {/localhost|127\.0\.0\.1|\[::1\]/.test(
              new URL(link.url).hostname,
            ) && (
              <Alert
                type="warning"
                showIcon
                title="Dùng địa chỉ mạng nội bộ cùng Wi-Fi hoặc tên miền triển khai để điện thoại kết nối."
              />
            )}
            <Space wrap>
              <Button
                icon={<CopyOutlined aria-hidden />}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link.url);
                    message.success("Đã sao chép liên kết chấm thi.");
                  } catch {
                    message.info("Mở trang chấm để sao chép địa chỉ.");
                  }
                }}
              >
                Sao chép liên kết
              </Button>
              <Button href={link.url} target="_blank" rel="noreferrer">
                Mở trang chấm điện thoại
              </Button>
            </Space>
          </div>
        )}
      </Modal>
      <Modal
        open={Boolean(manual)}
        title={manual ? `Điểm của ${manual.student_name}` : "Nhập điểm"}
        onCancel={() => setManual(null)}
        onOk={() => form.submit()}
        confirmLoading={busy}
        okText="Lưu điểm"
        cancelText="Hủy"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item
            name="score"
            label="Điểm"
            rules={[{ required: true, message: "Nhập điểm hợp lệ." }]}
          >
            <InputNumber
              min={0}
              max={exam ? roundScore(maxExamScore(exam.scoring)) : 100}
              precision={2}
            />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea maxLength={2000} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        open={Boolean(roster)}
        title="Danh sách dự thi"
        width={760}
        onCancel={() => setRoster(null)}
        okText="Lưu danh sách"
        cancelText="Hủy"
        confirmLoading={busy}
        onOk={async () => {
          setBusy(true);
          try {
            await gradingFetch(
              `/api/grading/exams/${examId}/candidates`,
              "PUT",
              { version: rosterVersion.current, candidates: roster },
            );
            setRoster(null);
            await refresh();
            onChanged();
            message.success("Đã cập nhật danh sách dự thi.");
          } catch (e) {
            message.error((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>Giữ nguyên số báo danh của học sinh đã có lịch sử điểm.</p>
        <Button
          onClick={() => {
            if (!roster || !exam) return;
            const known = new Set(roster.map((c) => c.student_id)),
              numbers = new Set(roster.map((c) => c.candidate_number));
            let next = 1;
            const extra = students
              .filter(
                (s) =>
                  s.className ===
                    (classes.find((c) => c.id === exam.class_id)?.name ??
                      exam.class_name) && !known.has(s.id),
              )
              .map((s) => {
                while (numbers.has(String(next).padStart(8, "0"))) next++;
                const number = String(next++).padStart(8, "0");
                numbers.add(number);
                return {
                  exam_id: exam.id,
                  student_id: s.id,
                  student_name: s.name,
                  candidate_number: number,
                };
              });
            setRoster([...roster, ...extra]);
          }}
        >
          Bổ sung học sinh mới của lớp
        </Button>
        <Table<ExamCandidate>
          rowKey="student_id"
          dataSource={roster ?? []}
          pagination={{ pageSize: 10 }}
          size="small"
          columns={[
            { title: "Học sinh", dataIndex: "student_name" },
            {
              title: "Số báo danh",
              render: (_, c) => (
                <Input
                  aria-label={`Số báo danh ${c.student_name}`}
                  maxLength={8}
                  value={c.candidate_number}
                  onChange={(e) =>
                    setRoster((old) =>
                      old!.map((p) =>
                        p.student_id === c.student_id
                          ? { ...p, candidate_number: e.target.value }
                          : p,
                      ),
                    )
                  }
                />
              ),
            },
            {
              title: "Thao tác",
              render: (_, c) => (
                <Button
                  danger
                  disabled={detail?.grades.some(
                    (g) => g.student_id === c.student_id,
                  )}
                  onClick={() =>
                    setRoster((old) =>
                      old!.filter((p) => p.student_id !== c.student_id),
                    )
                  }
                >
                  Gỡ
                </Button>
              ),
            },
          ]}
        />
      </Modal>
    </Drawer>
  );
}

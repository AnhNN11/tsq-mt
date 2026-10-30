"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  App,
  Button,
  Drawer,
  Input,
  Modal,
  Popconfirm,
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
  DeleteOutlined,
  PrinterOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { gradingFetch } from "@/lib/grading-client";
import {
  SCAN_STATUSES,
  type Exam,
  type ExamCandidate,
  type Grade,
  type PaperScan,
} from "@/lib/grading-model";
import type { Student, SchoolClass } from "@/lib/model";
import ScanReview from "./scan-review";
type Detail = {
  exam: Exam;
  candidates: ExamCandidate[];
  scans: PaperScan[];
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
type CaptureLink = {
  id: string;
  url: string;
  expiresAt: string;
  maxUploads: number;
};
export default function ExamDetail({
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
  const { message } = App.useApp();
  const [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState("");
  const [link, setLink] = useState<CaptureLink | null>(null),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState("");
  const [reviewId, setReviewId] = useState(""),
    [roster, setRoster] = useState<ExamCandidate[] | null>(null),
    [printVariant, setPrintVariant] = useState("");
  const loading = useRef(false),
    cancelled = useRef(false),
    previousCount = useRef<number | null>(null),
    rosterVersion = useRef(0);
  const refresh = useCallback(
    (quiet = false) => {
      if (loading.current) return Promise.resolve();
      loading.current = true;
      return gradingFetch<Detail>(`/api/grading/exams/${examId}`)
        .then((data) => {
          if (
            previousCount.current !== null &&
            data.scans.length > previousCount.current &&
            quiet
          )
            message.info(
              `Đã nhận thêm ${data.scans.length - previousCount.current} ảnh bài làm.`,
            );
          previousCount.current = data.scans.length;
          setDetail(data);
          setError("");
        })
        .catch((e) => {
          if (!quiet) setError((e as Error).message);
        })
        .finally(() => {
          loading.current = false;
        });
    },
    [examId, message],
  );
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh(true);
    }, 5000);
    return () => {
      clearInterval(timer);
      cancelled.current = true;
    };
  }, [refresh]);
  async function createSession() {
    setBusy(true);
    try {
      setLink(
        await gradingFetch<CaptureLink>(
          `/api/grading/exams/${examId}/sessions`,
          "POST",
        ),
      );
      message.success("Đã mở phiên nhận ảnh trong 30 phút.");
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
      message.success("Đã đóng phiên nhận ảnh.");
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function processPending() {
    if (!detail) return;
    setBusy(true);
    cancelled.current = false;
    const queue = detail.scans.filter((s) => s.status === "uploaded");
    let completed = 0;
    try {
      for (const scan of queue) {
        if (cancelled.current) break;
        setProgress(`Đang xử lý ${completed + 1}/${queue.length}`);
        await gradingFetch(`/api/grading/scans/${scan.id}/process`, "POST", {
          version: scan.version,
        });
        completed++;
        await refresh(true);
      }
      message.success(
        `Đã xử lý ${completed} ảnh. Kiểm tra kết quả trước khi duyệt.`,
      );
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setProgress("");
      setBusy(false);
      await refresh();
    }
  }
  async function saveRoster() {
    if (!roster) return;
    setBusy(true);
    try {
      await gradingFetch(`/api/grading/exams/${examId}/candidates`, "PUT", {
        version: rosterVersion.current,
        candidates: roster,
      });
      setRoster(null);
      await refresh();
      onChanged();
      message.success("Đã lưu danh sách dự thi.");
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const exam = detail?.exam,
    reviewing = detail?.scans.find((s) => s.id === reviewId);
  const activeVariant = exam?.answer_keys.some((k) => k.code === printVariant)
    ? printVariant
    : (exam?.answer_keys[0]?.code ?? "");
  return (
    <Drawer
      open
      size="large"
      title={
        exam
          ? `${exam.title} · Lớp ${exam.class_name}`
          : "Chi tiết bài kiểm tra"
      }
      onClose={() => {
        cancelled.current = true;
        onClose();
      }}
      extra={
        <Button
          icon={<ReloadOutlined aria-hidden />}
          onClick={() => void refresh()}
        >
          Làm mới
        </Button>
      }
    >
      {error && <Alert type="error" showIcon title={error} />}
      {exam && detail && (
        <>
          <p>
            {exam.school_year} · Học kỳ {exam.semester === 1 ? "một" : "hai"} ·
            Môn {exam.subject}
          </p>
          <Space wrap style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              icon={<CameraOutlined aria-hidden />}
              disabled={exam.archived || busy}
              loading={busy && !progress}
              onClick={() => void createSession()}
            >
              Nhận bài bằng mã QR
            </Button>
            <Button
              disabled={
                exam.archived ||
                busy ||
                !detail.scans.some((s) => s.status === "uploaded")
              }
              loading={Boolean(progress)}
              onClick={() => void processPending()}
            >
              {progress || "Xử lý ảnh chờ"}
            </Button>
            {progress && (
              <Button
                onClick={() => {
                  cancelled.current = true;
                }}
              >
                Dừng sau ảnh này
              </Button>
            )}
          </Space>
          <Tabs
            items={[
              {
                key: "scans",
                label: `Ảnh bài làm (${detail.scans.length})`,
                children: (
                  <>
                    <Alert
                      type="info"
                      showIcon
                      title="Ảnh mới được lưu tạm. Bấm xử lý, kiểm tra học sinh và đáp án rồi duyệt để ghi điểm."
                    />
                    <Table<PaperScan>
                      rowKey="id"
                      size="small"
                      dataSource={detail.scans}
                      pagination={{ pageSize: 10 }}
                      scroll={{ x: 650 }}
                      style={{ marginTop: 14 }}
                      columns={[
                        {
                          title: "Ảnh",
                          render: (_, s) =>
                            s.image_path ? (
                              <a
                                href={`/api/grading/scans/${s.id}/image`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Xem ảnh bài làm
                              </a>
                            ) : (
                              <span className="muted">Ảnh đã được dọn</span>
                            ),
                        },
                        {
                          title: "Số báo danh",
                          render: (_, s) =>
                            s.result?.candidateNumber || "Chưa xác định",
                        },
                        {
                          title: "Trạng thái",
                          render: (_, s) => (
                            <Tag
                              color={
                                s.status === "approved"
                                  ? "green"
                                  : s.status === "failed"
                                    ? "red"
                                    : s.status === "review"
                                      ? "gold"
                                      : "default"
                              }
                            >
                              {SCAN_STATUSES[s.status]}
                            </Tag>
                          ),
                        },
                        {
                          title: "Cần đối chiếu",
                          render: (_, s) =>
                            s.result
                              ? `${s.result.warnings.length} cảnh báo`
                              : s.error_text
                                ? "Cần chụp/căn chỉnh lại"
                                : "—",
                        },
                        {
                          title: "",
                          fixed: "right",
                          width: 145,
                          render: (_, s) => (
                            <Space size={0}>
                              <Button
                                size="small"
                                type="link"
                                aria-label={`Kiểm tra bài ${s.id}`}
                                onClick={() => setReviewId(s.id)}
                              >
                                Kiểm tra bài
                              </Button>
                              {!["approved", "rejected", "processing"].includes(
                                s.status,
                              ) &&
                                !exam.archived && (
                                  <Popconfirm
                                    title="Loại ảnh này khỏi danh sách chấm?"
                                    description="Ảnh vẫn được giữ tạm; không ghi điểm từ ảnh đã loại."
                                    okText="Loại ảnh"
                                    cancelText="Hủy"
                                    onConfirm={async () => {
                                      try {
                                        await gradingFetch(
                                          `/api/grading/scans/${s.id}`,
                                          "PATCH",
                                          {
                                            status: "rejected",
                                            version: s.version,
                                          },
                                        );
                                        await refresh();
                                      } catch (e) {
                                        message.error((e as Error).message);
                                      }
                                    }}
                                  >
                                    <Button
                                      type="text"
                                      danger
                                      size="small"
                                      aria-label={`Loại ảnh ${s.id}`}
                                      icon={<DeleteOutlined aria-hidden />}
                                    />
                                  </Popconfirm>
                                )}
                            </Space>
                          ),
                        },
                      ]}
                    />
                    <p className="muted">
                      Hiện tối đa 200 ảnh mới nhất. Ảnh tạm được đánh dấu hết
                      hạn sau 7 ngày; khi dọn ảnh, điểm và lịch sử đã duyệt vẫn
                      được giữ.
                    </p>
                  </>
                ),
              },
              {
                key: "candidates",
                label: `Danh sách dự thi (${detail.candidates.length})`,
                children: (
                  <>
                    <Space wrap style={{ marginBottom: 12 }}>
                      <Button
                        disabled={exam.archived}
                        onClick={() => {
                          setRoster(structuredClone(detail.candidates));
                          rosterVersion.current = exam.version;
                        }}
                      >
                        Sửa số báo danh
                      </Button>
                      <Select
                        aria-label="Mã đề in phiếu"
                        value={activeVariant}
                        options={exam.answer_keys.map((k) => ({
                          value: k.code,
                          label: `Mã đề ${k.code}`,
                        }))}
                        onChange={setPrintVariant}
                      />
                      <Button
                        icon={<PrinterOutlined aria-hidden />}
                        href={`/grading/exams/${exam.id}/sheets?student=all&variant=${activeVariant}`}
                        target="_blank"
                      >
                        In phiếu theo danh sách
                      </Button>
                      <Button
                        href={`/grading/exams/${exam.id}/sheets?student=blank&variant=${activeVariant}`}
                        target="_blank"
                      >
                        In phiếu trống
                      </Button>
                    </Space>
                    <Table<ExamCandidate>
                      rowKey="student_id"
                      size="small"
                      dataSource={detail.candidates}
                      pagination={{ pageSize: 20 }}
                      columns={[
                        { title: "Số báo danh", dataIndex: "candidate_number" },
                        { title: "Học sinh", dataIndex: "student_name" },
                        {
                          title: "Điểm đã duyệt",
                          render: (_, c) => {
                            const grade = detail.grades.find(
                              (g) => g.student_id === c.student_id,
                            );
                            return grade
                              ? `${grade.score}/${grade.max_score}`
                              : "Chưa có điểm";
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
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 590 }}
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
                            ? "Xóa điểm (giữ lịch sử)"
                            : `${h.previous_value?.score ?? "Chưa có"} → ${h.next_value?.score ?? "—"}`,
                      },
                      { title: "Người cập nhật", dataIndex: "actor" },
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
        open={Boolean(link)}
        title="Điện thoại quét mã để chụp bài"
        onCancel={() => setLink(null)}
        footer={
          <Space>
            <Button onClick={() => setLink(null)}>Ẩn mã, giữ phiên mở</Button>
            <Button danger loading={busy} onClick={() => void closeSession()}>
              Đóng phiên nhận bài
            </Button>
          </Space>
        }
        width={520}
        destroyOnHidden
      >
        {link && (
          <div className="capture-qr">
            <QRCode value={link.url} size={240} errorLevel="M" />
            <p>
              Hiệu lực đến{" "}
              {new Date(link.expiresAt).toLocaleTimeString("vi-VN", {
                timeZone: "Asia/Ho_Chi_Minh",
              })}{" "}
              · Tối đa {link.maxUploads} ảnh
            </p>
            {/localhost|127\.0\.0\.1|\[::1\]/.test(
              new URL(link.url).hostname,
            ) && (
              <Alert
                type="warning"
                showIcon
                title="Địa chỉ máy cục bộ không mở được từ điện thoại. Dùng địa chỉ Vercel hoặc cấu hình APP_PUBLIC_URL bằng địa chỉ mạng nội bộ của máy đang chạy web."
              />
            )}
            <Space wrap>
              <Button
                icon={<CopyOutlined aria-hidden />}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link.url);
                    message.success("Đã sao chép liên kết nhận bài.");
                  } catch {
                    message.info("Mở liên kết trên trình duyệt để sao chép.");
                  }
                }}
              >
                Sao chép liên kết
              </Button>
              <Button href={link.url} target="_blank" rel="noreferrer">
                Mở trang chụp bài
              </Button>
            </Space>
            <p className="muted">
              Chỉ chia sẻ mã cho người đang chụp bài. Liên kết chỉ cho gửi ảnh,
              không xem danh sách học sinh, đáp án hoặc điểm.
            </p>
          </div>
        )}
      </Modal>
      <Modal
        open={Boolean(roster)}
        title="Số báo danh dự thi"
        width={720}
        onCancel={() => setRoster(null)}
        confirmLoading={busy}
        onOk={() => void saveRoster()}
        okText="Lưu danh sách dự thi"
        cancelText="Hủy"
        destroyOnHidden
      >
        <p>
          Số báo danh gồm 8 chữ số, không trùng nhau trong bài kiểm tra. Giữ
          nguyên số báo danh đã có lịch sử điểm.
        </p>
        <Button
          onClick={() => {
            if (!roster || !exam) return;
            const existing = new Set(roster.map((c) => c.student_id)),
              numbers = new Set(roster.map((c) => c.candidate_number));
            let next = 1;
            const extra = students
              .filter(
                (s) =>
                  s.className ===
                    (classes.find((c) => c.id === exam.class_id)?.name ??
                      exam.class_name) && !existing.has(s.id),
              )
              .map((s) => {
                while (numbers.has(String(next).padStart(8, "0"))) next++;
                const candidate_number = String(next++).padStart(8, "0");
                numbers.add(candidate_number);
                return {
                  exam_id: exam.id,
                  student_id: s.id,
                  student_name: s.name,
                  candidate_number,
                };
              });
            setRoster([...roster, ...extra]);
          }}
        >
          Bổ sung học sinh mới của lớp
        </Button>
        <Table<ExamCandidate>
          size="small"
          rowKey="student_id"
          style={{ marginTop: 12 }}
          dataSource={roster ?? []}
          pagination={{ pageSize: 10 }}
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
                      old!.map((r) =>
                        r.student_id === c.student_id
                          ? { ...r, candidate_number: e.target.value }
                          : r,
                      ),
                    )
                  }
                />
              ),
            },
            {
              title: "",
              render: (_, c) => (
                <Button
                  type="text"
                  danger
                  disabled={detail?.grades.some(
                    (g) => g.student_id === c.student_id,
                  )}
                  onClick={() =>
                    setRoster((old) =>
                      old!.filter((r) => r.student_id !== c.student_id),
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
      {exam && reviewing && (
        <ScanReview
          key={`${reviewing.id}-${reviewing.version}`}
          exam={exam}
          scan={reviewing}
          candidates={detail!.candidates}
          grades={detail!.grades}
          onClose={() => setReviewId("")}
          onSaved={() => {
            void refresh();
            onChanged();
          }}
        />
      )}
    </Drawer>
  );
}

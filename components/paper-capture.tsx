"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Alert, App, Button, Select, Space, Spin, Tag } from "antd";
import {
  CameraOutlined,
  UploadOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { compressPaper, captureRequestId } from "@/lib/grading-client";
export type CaptureInfo = {
  title: string;
  className: string;
  subject: string;
  templateName: string;
  expiresAt: string;
  remaining: number;
  examVersion: number;
  variants: string[];
  candidates: {
    student_id: string;
    student_name: string;
    candidate_number: string;
  }[];
  grades: {
    student_id: string;
    score: number;
    max_score: number;
    version: number;
  }[];
};
const subscribeHash = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};
export default function PaperCapture({ sessionId }: { sessionId: string }) {
  const token = useSyncExternalStore(
      subscribeHash,
      () => window.location.hash.slice(1),
      () => "",
    ),
    { message } = App.useApp();
  const [info, setInfo] = useState<CaptureInfo | null>(null),
    [student, setStudent] = useState(""),
    [variant, setVariant] = useState(""),
    [error, setError] = useState(""),
    [refreshing, setRefreshing] = useState(false);
  const [photo, setPhoto] = useState<{
      image: Blob;
      url: string;
      requestId: string;
      studentId: string;
      studentName: string;
      variant: string;
      examVersion: number;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [preparing, setPreparing] = useState(false),
    [last, setLast] = useState<{
      name: string;
      score: number;
      max: number;
    } | null>(null);
  const camera = useRef<HTMLInputElement>(null),
    gallery = useRef<HTMLInputElement>(null),
    locked = useRef(false),
    generation = useRef(0);
  const refresh = useCallback(() => {
    if (!token) return Promise.resolve();
    const epoch = ++generation.current;
    setRefreshing(true);
    return fetch(`/api/capture/${sessionId}`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "omit",
      cache: "no-store",
    })
      .then(async (r) => {
        const body = await r.json();
        if (epoch !== generation.current || locked.current) return;
        if (!r.ok) throw new Error(body.error);
        setInfo(body);
        setError("");
      })
      .catch((e) => {
        if (epoch === generation.current && !locked.current)
          setError((e as Error).message);
      })
      .finally(() => setRefreshing(false));
  }, [sessionId, token]);
  useEffect(() => {
    if (!token) return;
    void Promise.resolve().then(refresh);
    const timer = setInterval(() => {
      if (!document.hidden && !locked.current) void refresh();
    }, 12000);
    return () => clearInterval(timer);
  }, [token, refresh]);
  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo.url);
    },
    [photo],
  );
  const available =
    info?.candidates.filter(
      (c) => !info.grades.some((g) => g.student_id === c.student_id),
    ) ?? [];
  const selected =
    info?.candidates.find((c) => c.student_id === student) ?? available[0];
  const code = info?.variants.includes(variant)
    ? variant
    : info?.variants.length === 1
      ? info.variants[0]
      : "";
  async function choose(file?: File) {
    if (!file || !info || !selected || !code || locked.current) return;
    generation.current++;
    setPreparing(true);
    const chosen = {
      studentId: selected.student_id,
      studentName: selected.student_name,
      variant: code,
      examVersion: info.examVersion,
    };
    try {
      const image = await compressPaper(file);
      const prepared = {
        ...chosen,
        image,
        url: URL.createObjectURL(image),
        requestId: captureRequestId(),
      };
      setPhoto(prepared);
      setError("");
      await send(prepared);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setPreparing(false);
    }
  }
  async function send(target = photo) {
    if (!target || !info || locked.current) return;
    const photo = target;
    generation.current++;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("image", photo.image, "paper.jpg");
      body.set("studentId", photo.studentId);
      body.set("variant", photo.variant);
      body.set("requestId", photo.requestId);
      body.set("examVersion", String(photo.examVersion));
      const r = await fetch(`/api/capture/${sessionId}`, {
        method: "POST",
        credentials: "omit",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setLast({
        name: result.studentName,
        score: result.score,
        max: result.maxScore,
      });
      setInfo((old) =>
        old
          ? {
              ...old,
              remaining: result.remaining,
              grades: [
                ...old.grades.filter((g) => g.student_id !== result.studentId),
                {
                  student_id: result.studentId,
                  score: result.score,
                  max_score: result.maxScore,
                  version: result.version,
                },
              ],
            }
          : old,
      );
      setPhoto(null);
      setStudent("");
      message.success(result.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const graded =
      selected &&
      info?.grades.some((g) => g.student_id === selected.student_id),
    enabled = Boolean(
      info &&
      selected &&
      code &&
      !graded &&
      info.remaining > 0 &&
      Date.parse(info.expiresAt) > Date.now(),
    );
  return (
    <main className="paper-capture">
      <div className="capture-brand">
        PHÂN HIỆU 1 · KHOA TIN HỌC VÀ NGOẠI NGỮ
      </div>
      <h1>Chấm thi bằng điện thoại</h1>
      <p>
        Chọn đúng học sinh và mã đề rồi chụp bài. Ảnh được chấm tự động, điểm
        lưu ngay; ảnh không được giữ lại.
      </p>
      {!token && (
        <Alert
          type="warning"
          showIcon
          title="Quét mã QR từ máy tính để kết nối bài thi."
        />
      )}
      {error && (
        <Alert
          type="error"
          showIcon
          title={error}
          style={{ marginBottom: 16 }}
        />
      )}
      {!info && refreshing && <Spin description="Đang kết nối bài thi…" />}
      {info && (
        <>
          <section className="capture-session">
            <Tag color="green">
              Lớp {info.className} · {info.subject}
            </Tag>
            <h2>{info.title}</h2>
            <p>{info.templateName}</p>
            <p>
              Đã có điểm {info.grades.length}/{info.candidates.length} học sinh
              · Phiên còn {info.remaining} lượt chấm.
            </p>
            <Button
              icon={<ReloadOutlined aria-hidden />}
              disabled={busy || preparing}
              loading={refreshing}
              onClick={() => void refresh()}
            >
              Làm mới danh sách
            </Button>
          </section>
          {last && (
            <Alert
              className="capture-result"
              type="success"
              showIcon
              icon={<CheckCircleOutlined />}
              title={`${last.name}: ${last.score} / ${last.max} điểm`}
              description="Đã lưu vào bảng điểm trên máy tính."
            />
          )}
          {available.length === 0 && !photo ? (
            <Alert
              type="success"
              showIcon
              title="Lớp đã có đủ điểm cho bài thi này."
            />
          ) : (
            <>
              <label
                className="grading-field"
                data-testid="capture-current-student"
              >
                Học sinh đang chụp
                <Select
                  aria-label="Học sinh đang chụp"
                  showSearch
                  optionFilterProp="label"
                  value={photo?.studentId ?? selected?.student_id}
                  disabled={busy || preparing || Boolean(photo)}
                  options={info.candidates.map((c) => ({
                    value: c.student_id,
                    label: `${c.candidate_number} · ${c.student_name}${info.grades.some((g) => g.student_id === c.student_id) ? " · Đã có điểm" : ""}`,
                    disabled: info.grades.some(
                      (g) => g.student_id === c.student_id,
                    ),
                  }))}
                  onChange={setStudent}
                />
              </label>
              <label className="grading-field">
                Mã đề
                <Select
                  aria-label="Mã đề đang chụp"
                  placeholder="Chọn mã đề"
                  value={photo?.variant ?? (code || undefined)}
                  disabled={busy || preparing || Boolean(photo)}
                  options={info.variants.map((v) => ({
                    value: v,
                    label: `Mã đề ${v}`,
                  }))}
                  onChange={setVariant}
                />
              </label>
              <ol className="capture-tips">
                <li>Kiểm tra đúng tên học sinh và mã đề trước khi chụp.</li>
                <li>Giữ phiếu phẳng, đủ sáng, thấy đủ bốn dấu vuông góc.</li>
                <li>
                  Chấm xong sẽ chuyển sang học sinh tiếp theo chưa có điểm.
                </li>
              </ol>
              <input
                hidden
                ref={camera}
                type="file"
                accept="image/*"
                capture="environment"
                aria-label="Chụp ảnh bài làm"
                onChange={(e) => {
                  void choose(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <input
                hidden
                ref={gallery}
                type="file"
                accept="image/*"
                aria-label="Chọn ảnh bài làm"
                onChange={(e) => {
                  void choose(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {preparing && <Spin description="Đang chuẩn bị ảnh…" />}
              {photo && (
                <div className="capture-preview">
                  <strong>
                    Bài của {photo.studentName} · Mã đề {photo.variant}
                  </strong>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="Ảnh bài làm chuẩn bị chấm" />
                </div>
              )}
              <Space orientation="vertical" style={{ width: "100%" }}>
                <Button
                  block
                  size="large"
                  type="primary"
                  icon={<CameraOutlined aria-hidden />}
                  disabled={!enabled || busy || preparing}
                  onClick={() => camera.current?.click()}
                >
                  {photo ? "Chụp lại ảnh" : "Chụp bài làm"}
                </Button>
                <Button
                  block
                  size="large"
                  icon={<UploadOutlined aria-hidden />}
                  disabled={!enabled || busy || preparing}
                  onClick={() => gallery.current?.click()}
                >
                  Chọn ảnh có sẵn
                </Button>
                {photo && (
                  <>
                    <Button
                      block
                      size="large"
                      type="primary"
                      loading={busy}
                      disabled={preparing}
                      onClick={() => void send()}
                    >
                      Thử chấm lại
                    </Button>
                    <Button
                      block
                      disabled={busy}
                      onClick={() => {
                        setPhoto(null);
                        setError("");
                      }}
                    >
                      Bỏ ảnh, chọn học sinh khác
                    </Button>
                  </>
                )}
              </Space>
            </>
          )}
        </>
      )}
    </main>
  );
}

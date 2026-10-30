"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Alert, App, Button, Space, Spin } from "antd";
import {
  CameraOutlined,
  CheckCircleOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { compressPaper } from "@/lib/grading-client";
type SessionInfo = {
  title: string;
  schoolYear: string;
  semester: number;
  expiresAt: string;
  remaining: number;
};
const subscribeHash = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};
const captureToken = () => window.location.hash.slice(1);
export default function PaperCapture({ sessionId }: { sessionId: string }) {
  const camera = useRef<HTMLInputElement>(null),
    gallery = useRef<HTMLInputElement>(null),
    lock = useRef(false);
  const token = useSyncExternalStore(subscribeHash, captureToken, () => "");
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [error, setError] = useState("");
  const [image, setImage] = useState<Blob | null>(null),
    [preview, setPreview] = useState(""),
    [busy, setBusy] = useState(false),
    [preparing, setPreparing] = useState(false),
    [count, setCount] = useState(0);
  const { message } = App.useApp();
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    fetch(`/api/capture/${sessionId}`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        setInfo(body);
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [token, sessionId]);
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);
  async function choose(file?: File) {
    if (!file || busy) return;
    setPreparing(true);
    try {
      const compressed = await compressPaper(file);
      setImage(compressed);
      setPreview(URL.createObjectURL(compressed));
      setError("");
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setPreparing(false);
    }
  }
  async function send() {
    if (!image || lock.current || !token) return;
    lock.current = true;
    setBusy(true);
    try {
      const data = new FormData();
      data.set("image", image, "paper.jpg");
      const response = await fetch(`/api/capture/${sessionId}`, {
        method: "POST",
        credentials: "omit",
        headers: { Authorization: `Bearer ${token}` },
        body: data,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Chưa gửi được ảnh.");
      message.success(result.message);
      if (!result.duplicate) {
        setCount((n) => n + 1);
        setInfo((old) =>
          old ? { ...old, remaining: old.remaining - 1 } : old,
        );
      }
      setImage(null);
      setPreview("");
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="paper-capture">
      <header>
        <span className="capture-brand">PHÂN HIỆU 1 · MẦM XANH</span>
        <h1>Chụp bài kiểm tra</h1>
        <p>Ảnh được lưu tạm. Giáo viên duyệt trước khi ghi vào bảng điểm.</p>
      </header>
      {error && (
        <Alert
          type="error"
          showIcon
          title={error}
          style={{ marginBottom: 16 }}
        />
      )}
      {!token && (
        <Alert
          type="warning"
          showIcon
          title="Quét mã QR từ máy tính của giáo viên để mở phiên nhận bài."
        />
      )}
      {token && !info && !error && (
        <Spin description="Đang kiểm tra phiên nhận bài…" />
      )}
      {info && (
        <>
          <section className="capture-session">
            <h2>{info.title}</h2>
            <p>
              {info.schoolYear} · Học kỳ {info.semester === 1 ? "một" : "hai"}
            </p>
            <p>
              Hết hạn lúc{" "}
              {new Date(info.expiresAt).toLocaleTimeString("vi-VN", {
                timeZone: "Asia/Ho_Chi_Minh",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · Còn {Math.max(0, info.remaining)} ảnh
            </p>
          </section>
          <ol className="capture-tips">
            <li>
              Đặt phiếu phẳng, đủ sáng và chụp thấy cả bốn dấu vuông ở góc.
            </li>
            <li>Kiểm tra ảnh rõ, không lóa và không bị che đáp án.</li>
            <li>Bấm gửi ảnh, rồi chụp bài tiếp theo.</li>
          </ol>
          <input
            ref={camera}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            aria-label="Chụp ảnh bài làm"
            onChange={(e) => {
              void choose(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            ref={gallery}
            type="file"
            accept="image/*"
            hidden
            aria-label="Chọn ảnh bài làm"
            onChange={(e) => {
              void choose(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {preparing && <Spin description="Đang chuẩn bị ảnh…" />}
          {preview && (
            <div className="capture-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Ảnh bài làm chuẩn bị gửi" />
            </div>
          )}
          <Space orientation="vertical" style={{ width: "100%" }}>
            <Button
              block
              size="large"
              type="primary"
              icon={<CameraOutlined aria-hidden />}
              disabled={busy || preparing || info.remaining <= 0}
              onClick={() => camera.current?.click()}
            >
              {image ? "Chụp lại ảnh" : "Chụp bài làm"}
            </Button>
            <Button
              block
              size="large"
              icon={<UploadOutlined aria-hidden />}
              disabled={busy || preparing || info.remaining <= 0}
              onClick={() => gallery.current?.click()}
            >
              Chọn ảnh có sẵn
            </Button>
            {image && (
              <Button
                block
                size="large"
                type="primary"
                loading={busy}
                onClick={() => void send()}
              >
                Gửi ảnh bài làm
              </Button>
            )}
          </Space>
          <p className="capture-sent">
            <CheckCircleOutlined aria-hidden /> Đã gửi {count} ảnh trong lần mở
            này
          </p>
        </>
      )}
    </main>
  );
}

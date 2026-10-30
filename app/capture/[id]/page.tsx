import { Suspense } from "react";
import PaperCapture from "@/components/paper-capture";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Chụp bài kiểm tra · Mầm Xanh",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function Capture(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={<div className="app-loading">Đang mở phiên chụp bài…</div>}
    >
      <CaptureContent {...props} />
    </Suspense>
  );
}
async function CaptureContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PaperCapture sessionId={id} />;
}

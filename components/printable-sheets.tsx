"use client";
import { Button } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { sheetSvg } from "@/lib/sheet-template";
export default function PrintableSheets({
  title,
  subject,
  variant,
  candidates,
  groups,
}: {
  title: string;
  subject: string;
  variant: string;
  groups?: import("@/lib/omr-reference").BubbleGroup[];
  candidates: { student_name: string; candidate_number: string }[];
}) {
  return (
    <div className="printable-sheets">
      <div className="sheet-print-toolbar no-print">
        <h1>Phiếu trả lời · {title}</h1>
        <p>
          In khổ A4 dọc, không cắt mất bốn dấu vuông. Kiểm tra số báo danh và mã
          đề trước khi phát phiếu.
        </p>
        <Button
          type="primary"
          icon={<PrinterOutlined aria-hidden />}
          onClick={() => window.print()}
        >
          In phiếu trả lời
        </Button>
      </div>
      {(candidates.length
        ? candidates
        : [{ student_name: "", candidate_number: "" }]
      ).map((candidate, i) => (
        <article
          className="answer-sheet"
          key={i}
          dangerouslySetInnerHTML={{
            __html: sheetSvg({
              title,
              groups,
              subject,
              studentName: candidate.student_name,
              candidateNumber: candidate.candidate_number,
              variant,
            }),
          }}
        />
      ))}
    </div>
  );
}

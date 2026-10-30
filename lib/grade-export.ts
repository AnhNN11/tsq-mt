import type { Exam, Grade } from "./grading-model";
import { semesterAverage, maxExamScore, roundScore } from "./grading-model";
import type { Student, SchoolClass } from "./model";
import { downloadBlob } from "./report-data";
export async function exportGradebook({
  exams,
  grades,
  students,
  classes,
  year,
  semester,
  subject,
}: {
  exams: Exam[];
  grades: Grade[];
  students: Student[];
  classes: SchoolClass[];
  year: string;
  semester?: number;
  subject: string;
}) {
  const ExcelJS = (await import("exceljs")).default;
  const book = new ExcelJS.Workbook();
  book.creator = "Phân hiệu 1 · Khoa Tin học và Ngoại ngữ";
  const active = exams.filter(
    (e) =>
      !e.archived || grades.some((g) => g.exam_id === e.id && !g.deleted_at),
  );
  const sheet = book.addWorksheet("Bảng điểm");
  sheet.addRow(["PHÂN HIỆU 1 · TRƯỜNG THIẾU SINH QUÂN MIỀN TRUNG"]);
  sheet.addRow(["KHOA TIN HỌC VÀ NGOẠI NGỮ"]);
  sheet.addRow([
    `BẢNG ĐIỂM · ${subject}${semester ? ` · Học kỳ ${semester === 1 ? "một" : "hai"}` : ""} · ${year}`,
  ]);
  sheet.addRow([
    "Gồm điểm đã lưu; tổng hợp quy về thang 10 theo trọng số cấu hình. Ô trống chưa được tính thành điểm 0.",
  ]);
  for (let row = 1; row <= 4; row++)
    sheet.mergeCells(row, 1, row, active.length + 5);
  sheet.addRow([
    "Số thứ tự",
    "Họ và tên",
    "Lớp",
    ...active.map(
      (e) =>
        `${e.title} (tối đa ${roundScore(maxExamScore(e.scoring))} điểm; trọng số ${e.weight})`,
    ),
    "Điểm tổng hợp / 10",
    "Số bài đã có điểm",
  ]);
  students.forEach((student, i) => {
    const cls = classes.find((c) => c.name === student.className);
    const summary = semesterAverage(
      active.filter((e) => e.class_id === cls?.id),
      grades,
      student.id,
    );
    sheet.addRow([
      i + 1,
      student.name,
      student.className,
      ...active.map((e) =>
        e.class_id === cls?.id
          ? (grades.find(
              (g) =>
                g.student_id === student.id &&
                g.exam_id === e.id &&
                !g.deleted_at,
            )?.score ?? "")
          : "",
      ),
      summary.average ?? "",
      `${summary.count}/${summary.total}`,
    ]);
  });
  sheet.views = [{ state: "frozen", xSplit: 3, ySplit: 5 }];
  sheet.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: 5, column: active.length + 5 },
  };
  sheet.columns.forEach((c, i) => {
    c.width =
      i === 1 ? 32 : i === 2 ? 12 : i > 2 && i < active.length + 3 ? 24 : 20;
  });
  const details = book.addWorksheet("Chi tiết điểm đã lưu");
  details.addRow([
    "Học sinh",
    "Lớp",
    "Bài kiểm tra",
    "Tên bài thi",
    "Điểm",
    "Điểm tối đa",
    "Trọng số",
    "Nguồn nhập",
    "Giáo viên cập nhật",
    "Cập nhật",
    "Ghi chú",
  ]);
  const pupilIds = new Set(students.map((s) => s.id));
  for (const grade of grades.filter(
    (g) => !g.deleted_at && pupilIds.has(g.student_id),
  )) {
    const exam = exams.find((e) => e.id === grade.exam_id);
    if (!exam) continue;
    details.addRow([
      grade.student_name,
      exam.class_name,
      exam.title,
      exam.title,
      grade.score,
      grade.max_score,
      exam.weight,
      grade.source === "scan" ? "Chấm từ điện thoại" : "Nhập trực tiếp",
      grade.reviewed_by,
      new Date(grade.updated_at).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
      }),
      grade.note,
    ]);
  }
  details.columns.forEach((c, i) => {
    c.width = [0, 2, 10].includes(i) ? 32 : 20;
  });
  details.views = [{ state: "frozen", ySplit: 1 }];
  const config = book.addWorksheet("Bài thi và thang điểm");
  config.addRow([
    "Bài kiểm tra",
    "Lớp",
    "Ngày",
    "Tên bài thi",
    "Trọng số",
    "Trạng thái",
    "Số câu chọn đáp án",
    "Điểm mỗi câu chọn đáp án",
    "Số câu đúng hoặc sai",
    "Cách tính đúng hoặc sai",
    "Thang điểm đúng hoặc sai",
    "Số câu trả lời ngắn",
    "Điểm mỗi câu trả lời ngắn",
    "Mã đề",
  ]);
  exams.forEach((e) =>
    config.addRow([
      e.title,
      e.class_name,
      e.exam_date,
      e.title,
      e.weight,
      e.archived ? "Đã lưu trữ" : "Đang sử dụng",
      e.scoring.multipleChoiceCount,
      e.scoring.multipleChoicePoints,
      e.scoring.trueFalseCount,
      e.scoring.trueFalseMode === "question"
        ? "Theo số ý đúng trong câu"
        : "Theo từng ý đúng",
      e.scoring.trueFalseMode === "question"
        ? e.scoring.trueFalseScale.join(" / ")
        : e.scoring.trueFalsePoints,
      e.scoring.shortAnswerCount,
      e.scoring.shortAnswerPoints,
      e.answer_keys.map((k) => k.code).join(", "),
    ]),
  );
  config.columns.forEach((c) => {
    c.width = 24;
  });
  for (const page of book.worksheets) {
    page.pageSetup = {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: false,
      scale: 100,
      printTitlesRow: page === sheet ? "5:5" : "1:1",
    };
    page.eachRow((row, number) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = {
          name: "Times New Roman",
          size: 14,
          color: { argb: "FF28392A" },
        };
        cell.alignment = { vertical: "middle", wrapText: true };
        if (number === (page === sheet ? 5 : 1)) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF315B35" },
          };
          cell.font = {
            name: "Times New Roman",
            size: 14,
            bold: true,
            color: { argb: "FFFFFFFF" },
          };
        } else if (page === sheet && number < 4)
          cell.font = {
            name: "Times New Roman",
            size: 16,
            bold: true,
            color: { argb: "FF315B35" },
          };
      });
      row.height =
        number === (page === sheet ? 5 : 1) ? 100 : number <= 5 ? 44 : 44;
    });
  }
  const buffer = await book.xlsx.writeBuffer();
  downloadBlob(
    new Blob([new Uint8Array(buffer)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `bang-diem-${subject}-${year.replace(/\s/g, "")}.xlsx`,
  );
}

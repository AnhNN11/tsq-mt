import { assessmentOf, reportRows, talentTagNames, genderOf } from "./model";
import { academicLabel } from "./academic-tags";
import { downloadBlob, reportSummary, type ReportData } from "./report-data";

export async function exportExcel(
  data: ReportData,
  filename = "mam-xanh-bao-cao.xlsx",
) {
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  book.creator = data.teacherName || "Khoa Tin học và Ngoại ngữ";
  book.created = new Date();
  const green = "315B35",
    pale = "F1F5EB",
    border = "DFE6D8";
  function table(
    name: string,
    headers: string[],
    rows: (string | number)[][],
    widths: number[],
  ) {
    const ws = book.addWorksheet(name, {
      views: [{ state: "frozen", ySplit: 1 }],
      pageSetup: {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });
    ws.columns = widths.map((width) => ({ width }));
    ws.addRow(headers);
    ws.getRow(1).height = 44;
    ws.getRow(1).eachCell((cell) => {
      cell.font = {
        name: "Times New Roman",
        size: 14,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: green },
      };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
    for (const [index, values] of rows.entries()) {
      const row = ws.addRow(
        values.map((value) => (value === "" ? null : value)),
      );
      row.height = Math.min(
        180,
        Math.max(
          32,
          ...values
            .map(
              (v, i) =>
                Math.ceil(String(v).length / (widths[i] || 20)) +
                String(v).split("\n").length -
                1,
            )
            .map((lines) => lines * 19 + 14),
        ),
      );
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = {
          name: "Times New Roman",
          size: 14,
          color: { argb: "FF2C392A" },
        };
        cell.alignment = { vertical: "top", wrapText: true };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: index % 2 ? "FFFFFF" : pale },
        };
        cell.border = { bottom: { style: "hair", color: { argb: border } } };
        if (typeof cell.value === "number") cell.numFmt = "#,##0";
      });
    }
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };
    ws.pageSetup.printTitlesRow = "1:1";
    ws.headerFooter.oddFooter =
      '&L&"Times New Roman,Regular"&14Mầm Xanh · Khoa Tin học và Ngoại ngữ&R&"Times New Roman,Regular"&14Trang &P / &N';
    return ws;
  }
  const sum = reportSummary(data);
  const overview = book.addWorksheet("Tổng quan", {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  overview.columns = [8, 25, 20, 20, 20, 20, 14, 12].map((width) => ({
    width,
  }));
  function merged(
    range: string,
    text: string,
    size = 11,
    bg = "FFFFFF",
    color = "253D29",
    bold = false,
  ) {
    overview.mergeCells(range);
    const c = overview.getCell(range.split(":")[0]);
    c.value = text;
    c.font = {
      name: "Times New Roman",
      size: Math.max(14, size),
      color: { argb: color },
      bold,
    };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    c.alignment = { vertical: "middle", wrapText: true };
  }
  merged("A1:H2", "BÁO CÁO QUẢN LÝ HỌC SINH", 20, green, "FFFFFF", true);
  overview.getRow(1).height = 26;
  overview.getRow(2).height = 20;
  merged(
    "A3:H3",
    "PHÂN HIỆU 1 TRƯỜNG THIẾU SINH QUÂN MIỀN TRUNG · KHOA TIN HỌC VÀ NGOẠI NGỮ",
    10,
    pale,
  );
  overview.getRow(3).height = 42;
  merged(
    "A5:H5",
    `Môn ${data.subject} · ${data.studentScope || "Tất cả dân tộc"} · ${data.period || "Toàn bộ thời gian"}`,
    12,
  );
  overview.getRow(5).height = 40;
  merged(
    "A6:H6",
    `Năm học ${data.schoolYear || "2026 – 2027"} · Người lập: ${data.teacherName || "Giáo viên"}`,
    10,
  );
  overview.getRow(6).height = 30;
  for (const [range, label, value] of [
    ["A:B", "HỌC SINH", sum.students],
    ["C:D", "TỔNG SỐ TIẾT", sum.periods],
    ["E:F", "ĐÃ ĐÁNH GIÁ", sum.assessed],
    ["G:H", "CÓ NĂNG KHIẾU", sum.talents],
  ] as const) {
    const [a, b] = range.split(":");
    merged(`${a}8:${b}8`, label, 10, pale, "5F7453", true);
    merged(`${a}9:${b}10`, String(value), 25, pale, green, true);
  }
  overview.getRow(8).height = 32;
  overview.getRow(9).height = 25;
  overview.getRow(10).height = 17;
  if (data.chartImages?.length) {
    merged("A12:D12", "PHÂN BỐ HỌC LỰC", 14, pale, green, true);
    merged("E12:H12", "NHÓM NĂNG KHIẾU", 14, pale, green, true);
    overview.getRow(12).height = 30;
    for (const [i, image] of data.chartImages.slice(0, 2).entries()) {
      const id = book.addImage({ base64: image, extension: "png" });
      overview.addImage(id, {
        tl: { col: i * 4, row: 12 },
        ext: { width: 460, height: 230 },
      });
    }
    for (let row = 13; row <= 25; row++) overview.getRow(row).height = 15;
  } else {
    merged("A13:D13", "HỌC LỰC HIỆN TẠI", 11, pale, green, true);
    sum.levels.forEach((level, i) => {
      overview.getCell(`B${i + 14}`).value = level.name;
      overview.getCell(`D${i + 14}`).value = level.count;
    });
  }
  let row = 29;
  merged(`A${row}:H${row}`, "TỔNG HỢP THEO LỚP", 12, pale, green, true);
  overview.getRow(row++).height = 27;
  overview.getRow(row++).values = [
    null,
    "Lớp",
    "Số học sinh",
    "Đã đánh giá",
    "Có năng khiếu",
    "Số tiết",
    "Số bài",
  ];
  for (const c of data.classes) {
    const pupils = data.students.filter((s) => s.className === c.name);
    const teaching = reportSummary({
      ...data,
      students: pupils,
      lessons: data.lessons.filter((l) => l.className === c.name),
    });
    overview.getRow(row++).values = [
      null,
      c.name,
      pupils.length,
      teaching.assessed,
      teaching.talents,
      teaching.periods,
      teaching.topics,
    ];
  }
  row += 2;
  overview.getRow(row++).values = [null, "Giới tính", "Số học sinh", "Tỷ lệ"];
  for (const g of sum.genders) {
    const r = overview.getRow(row++);
    r.values = [
      null,
      g.name,
      g.count,
      sum.students ? g.count / sum.students : 0,
    ];
    r.getCell(4).numFmt = "0.0%";
  }
  row += 2;
  merged(
    `A${row}:H${row}`,
    "THỐNG KÊ DÂN TỘC TRONG DANH SÁCH XUẤT",
    12,
    pale,
    green,
    true,
  );
  overview.getRow(row++).height = 27;
  overview.getRow(row++).values = [null, "Dân tộc", "Số học sinh", "Tỷ lệ"];
  for (const group of sum.ethnicities) {
    const r = overview.getRow(row++);
    r.values = [
      null,
      group.ethnicity,
      group.count,
      sum.students ? group.count / sum.students : 0,
    ];
    r.getCell(4).numFmt = "0.0%";
  }
  row += 2;
  merged(
    `A${row}:H${row}`,
    "Đầu vào lấy từ kết quả giáo dục nguồn hoặc giáo viên điều chỉnh. Chưa đánh giá được giữ riêng. Bộ lọc dân tộc giới hạn học sinh; tiết và bài theo lớp, môn và kỳ giảng dạy.",
    10,
  );
  overview.getRow(row).height = 60;
  overview.eachRow((r) => {
    if (r.hasValues) r.height = Math.max(r.height ?? 0, 30);
    r.eachCell((c) => {
      c.font = {
        ...c.font,
        name: "Times New Roman",
        size: Math.max(14, c.font?.size ?? 14),
      };
      c.alignment = { ...c.alignment, vertical: "middle" };
    });
  });
  overview.headerFooter.oddFooter =
    '&L&"Times New Roman,Regular"&14Mầm Xanh · Báo cáo tổng hợp&R&"Times New Roman,Regular"&14Trang &P / &N';
  table(
    "Học sinh",
    [
      "Số thứ tự",
      "Họ và tên",
      "Lớp",
      "Ngày sinh",
      "Giới tính",
      "Dân tộc",
      "Đầu vào",
      "Hiện tại",
      "Tương tác",
      "Nhận xét",
    ],
    data.students.map((s, i) => {
      const a = assessmentOf(s, data.subject);
      return [
        i + 1,
        s.name,
        s.className,
        s.birthDate,
        genderOf(s),
        s.ethnicity.split("\n")[0],
        academicLabel(a.before, data.academicTags),
        academicLabel(a.after, data.academicTags) || "Chưa đánh giá",
        a.interaction,
        a.note,
      ];
    }),
    [7, 29, 10, 15, 18, 18, 12, 18, 20, 55],
  );
  table(
    "Năng khiếu",
    [
      "Học sinh",
      "Lớp",
      "Thẻ năng khiếu",
      "Lĩnh vực",
      "Mức độ",
      "Nhận xét",
      "Hướng bồi dưỡng",
      "Giáo viên",
      "Cập nhật",
    ],
    data.students.flatMap((s) =>
      (s.talents?.length
        ? s.talents
        : s.talentTagIds?.length
          ? [undefined]
          : []
      ).map((t) => [
        s.name,
        s.className,
        talentTagNames(s, data.talentTags),
        t?.category ?? "",
        t?.level ?? "Chưa đánh giá",
        t?.note ?? "",
        t?.plan ?? "",
        t?.teacherName ?? "",
        t
          ? new Date(t.updatedAt).toLocaleDateString("vi-VN", {
              timeZone: "Asia/Ho_Chi_Minh",
            })
          : "",
      ]),
    ),
    [29, 10, 35, 18, 24, 48, 48, 27, 16],
  );
  table(
    "Giảng dạy",
    ["Ngày dạy", "Lớp", "Môn học", "Tên bài", "Số tiết", "Ghi chú"],
    data.lessons.map((l) => [
      l.date,
      l.className,
      l.subject,
      l.title,
      l.periods,
      l.note,
    ]),
    [17, 10, 20, 50, 12, 60],
  );
  const raw = reportRows(data.students, data.subject, data.academicTags);
  table(
    "Trích ngang",
    raw[0],
    raw.slice(1),
    [
      16, 30, 10, 10, 10, 12, 15, 22, 20, 38, 48, 42, 26, 32, 30, 16, 22, 24,
      22, 48, 32, 50,
    ],
  );
  const buffer = await book.xlsx.writeBuffer();
  downloadBlob(
    new Blob([new Uint8Array(buffer)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename,
  );
}

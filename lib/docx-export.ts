import { assessmentOf, talentTagNames } from "./model";
import { downloadBlob, reportSummary, type ReportData } from "./report-data";

export async function exportDocx(
  data: ReportData & { includeDetails?: boolean },
  filename = "mam-xanh-bao-cao.docx",
) {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    Footer,
    HeadingLevel,
    ImageRun,
    PageNumber,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    WidthType,
  } = await import("docx");
  const sum = reportSummary(data);
  const text = (value: unknown, bold = false, size = 28) =>
    new TextRun({
      text: String(value ?? ""),
      bold,
      size: Math.max(28, size),
      font: "Times New Roman",
      color: "000000",
    });
  const p = (
    value: string,
    heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel],
  ) =>
    new Paragraph({
      heading,
      children: [
        text(value, Boolean(heading), heading === HeadingLevel.TITLE ? 34 : 22),
      ],
      spacing: { after: heading ? 160 : 100, before: heading ? 180 : 0 },
      keepNext: Boolean(heading),
    });
  function table(
    headers: string[],
    rows: (string | number)[][],
    widths: number[],
  ) {
    const border = { style: BorderStyle.SINGLE, size: 4, color: "DDE4D7" };
    return new Table({
      width: { size: 10080, type: WidthType.DXA },
      columnWidths: widths,
      layout: TableLayoutType.FIXED,
      rows: [headers, ...rows].map(
        (row, index) =>
          new TableRow({
            tableHeader: index === 0,
            cantSplit: true,
            children: row.map(
              (value, column) =>
                new TableCell({
                  width: { size: widths[column], type: WidthType.DXA },
                  margins: { top: 110, bottom: 110, left: 130, right: 130 },
                  shading: {
                    fill:
                      index === 0 ? "E8EFDF" : index % 2 ? "FFFFFF" : "F8FAF5",
                  },
                  borders: {
                    top: border,
                    bottom: border,
                    left: border,
                    right: border,
                  },
                  children: String(value ?? "")
                    .split("\n")
                    .map(
                      (line) =>
                        new Paragraph({
                          children: [text(line || " ", index === 0, 20)],
                          spacing: { after: 30 },
                        }),
                    ),
                }),
            ),
          }),
      ),
    });
  }
  const children: (
    InstanceType<typeof Paragraph> | InstanceType<typeof Table>
  )[] = [
    new Paragraph({
      children: [
        text("PHÂN HIỆU 1 TRƯỜNG THIẾU SINH QUÂN MIỀN TRUNG", true, 18),
      ],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [text("KHOA TIN HỌC VÀ NGOẠI NGỮ", true, 18)],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
    p("Báo cáo quản lý học sinh", HeadingLevel.TITLE),
    p(`Năm học ${data.schoolYear || "2026 – 2027"} · Môn ${data.subject}`),
    p(
      `${data.classes.length === 1 ? `Lớp ${data.classes[0].name}` : "Tất cả lớp trong phạm vi chọn"} · ${data.studentScope || "Tất cả dân tộc"}`,
    ),
    p(
      `Kỳ giảng dạy: ${data.period || "Toàn bộ thời gian"} · Người lập: ${data.teacherName || "Giáo viên"}`,
    ),
    p("Tổng quan", HeadingLevel.HEADING_1),
    p(sum.genders.map((g) => `${g.name}: ${g.count}`).join(" · ")),
    table(
      ["Học sinh", "Tiết đã dạy", "Bài đã dạy", "Đã đánh giá", "Có năng khiếu"],
      [[sum.students, sum.periods, sum.topics, sum.assessed, sum.talents]],
      [2016, 2016, 2016, 2016, 2016],
    ),
    p(
      `Đã đánh giá học lực ${sum.assessed}/${sum.students} học sinh môn ${data.subject}; ${sum.students - sum.assessed} em chưa có đánh giá hiện tại. Có ${sum.talents} học sinh được ghi nhận năng khiếu. Không tự quy đổi các mã KQGD nguồn thành học lực hiện tại.`,
    ),
  ];
  if (data.chartImages?.[0]) {
    const bytes = Uint8Array.from(
      atob(data.chartImages[0].split(",")[1]),
      (char) => char.charCodeAt(0),
    );
    const view = new DataView(bytes.buffer);
    const width = 530;
    const height = Math.round(
      (width * view.getUint32(20)) / view.getUint32(16),
    );
    children.push(
      p(`Phân bố học lực môn ${data.subject}`, HeadingLevel.HEADING_2),
      new Paragraph({
        children: [
          new ImageRun({
            type: "png",
            data: bytes,
            transformation: { width, height },
            altText: {
              title: "Biểu đồ học lực",
              description:
                "Số học sinh theo mức học lực hiện tại và nhóm chưa đánh giá",
              name: "Bieu do hoc luc",
            },
          }),
        ],
        spacing: { after: 100 },
      }),
    );
  }
  children.push(
    p("Tình hình theo lớp", HeadingLevel.HEADING_1),
    table(
      ["Lớp", "Học sinh", "Đã đánh giá", "Năng khiếu", "Số tiết", "Số bài"],
      data.classes.map((c) => {
        const report = reportSummary({
          ...data,
          students: data.students.filter((s) => s.className === c.name),
          lessons: data.lessons.filter((l) => l.className === c.name),
        });
        return [
          c.name,
          report.students,
          report.assessed,
          report.talents,
          report.periods,
          report.topics,
        ];
      }),
      [1680, 1680, 1680, 1680, 1680, 1680],
    ),
  );
  children.push(
    p("Thành phần dân tộc", HeadingLevel.HEADING_1),
    table(
      ["Dân tộc", "Học sinh", "Tỷ lệ"],
      sum.ethnicities.map((g) => [
        g.ethnicity,
        g.count,
        `${sum.students ? ((g.count / sum.students) * 100).toFixed(1) : 0}%`,
      ]),
      [5000, 2540, 2540],
    ),
  );
  const talents = data.students.flatMap((s) =>
    (s.talents ?? []).map((t) => [
      s.name + "\nLớp " + s.className,
      t.category + "\n" + t.level,
      t.note + (t.plan ? "\nBồi dưỡng: " + t.plan : ""),
      t.teacherName,
    ]),
  );
  children.push(p("Năng khiếu và hướng bồi dưỡng", HeadingLevel.HEADING_1));
  const tagged = data.students.filter((s) => s.talentTagIds?.length);
  if (tagged.length)
    children.push(
      table(
        ["Học sinh", "Lớp", "Thẻ năng khiếu"],
        tagged.map((s) => [
          s.name,
          s.className,
          talentTagNames(s, data.talentTags),
        ]),
        [3000, 1500, 5580],
      ),
    );
  if (talents.length)
    children.push(
      table(
        [
          "Học sinh",
          "Lĩnh vực và mức độ",
          "Nhận xét và bồi dưỡng",
          "Giáo viên",
        ],
        talents,
        [2300, 2100, 3480, 2200],
      ),
    );
  else children.push(p("Chưa có đánh giá năng khiếu trong phạm vi báo cáo."));
  if (data.lessons.length)
    children.push(
      p("Nhật ký giảng dạy", HeadingLevel.HEADING_1),
      table(
        ["Ngày", "Lớp", "Bài học", "Tiết", "Ghi chú"],
        data.lessons.map((l) => [
          l.date.split("-").reverse().join("/"),
          l.className,
          l.title,
          l.periods,
          l.note,
        ]),
        [1400, 800, 3000, 700, 4180],
      ),
    );
  if (data.includeDetails) {
    children.push(
      new Paragraph({
        pageBreakBefore: true,
        heading: HeadingLevel.HEADING_1,
        children: [text("Chi tiết học sinh", true, 26)],
      }),
      table(
        [
          "Học sinh",
          "Gia đình và tính cách",
          "Học lực và tương tác",
          "Nhận xét và hỗ trợ",
        ],
        data.students.map((s) => {
          const a = assessmentOf(s, data.subject);
          return [
            s.name + "\nLớp " + s.className,
            `Gia đình: ${s.family || "Chưa cập nhật"}\nTính cách: ${s.personality || "Chưa cập nhật"}`,
            `Đầu vào: ${a.before || "Chưa có"}\nHiện tại: ${a.after || "Chưa đánh giá"}\nTương tác: ${a.interaction || "Chưa cập nhật"}`,
            a.note || "Chưa có nhận xét",
          ];
        }),
        [2000, 3100, 2300, 2680],
      ),
    );
  }
  children.push(
    p("Ghi chú", HeadingLevel.HEADING_2),
    p(
      "Đánh giá phản ánh hiện trạng tại thời điểm xuất. Khoảng ngày chỉ áp dụng cho tiết và bài giảng dạy. Một học sinh có thể có nhiều năng khiếu. Các mã đầu vào được giữ theo tài liệu nguồn hoặc điều chỉnh của giáo viên.",
    ),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [text("Người lập báo cáo", true)],
      spacing: { before: 240, after: 520 },
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [text(data.teacherName || "Giáo viên", true)],
    }),
  );
  const document = new Document({
    creator: data.teacherName || "Khoa Tin học và Ngoại ngữ",
    title: "Báo cáo quản lý học sinh",
    styles: {
      default: {
        document: {
          run: { font: "Times New Roman", size: 28, color: "000000" },
          paragraph: { spacing: { after: 100, line: 336 } },
        },
      },
      paragraphStyles: [
        {
          id: "Title",
          name: "Title",
          basedOn: "Normal",
          run: { color: "000000", size: 34, bold: true },
        },
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          run: { color: "000000", size: 30, bold: true },
          paragraph: { keepNext: true },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          run: { color: "000000", size: 28, bold: true },
          paragraph: { keepNext: true },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  text("Mầm Xanh · Trang ", false, 18),
                  new TextRun({
                    children: [
                      PageNumber.CURRENT,
                      " / ",
                      PageNumber.TOTAL_PAGES,
                    ],
                    size: 28,
                    font: "Times New Roman",
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  downloadBlob(await Packer.toBlob(document), filename);
}

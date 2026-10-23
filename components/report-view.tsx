"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import {
  App,
  Button,
  Checkbox,
  Collapse,
  Input,
  Select,
  Space,
  Table,
} from "antd";
import {
  FileExcelOutlined,
  FileWordOutlined,
  PrinterOutlined,
} from "@ant-design/icons";
import {
  assessmentOf,
  ethnicityOf,
  talentTagNames,
  type Lesson,
  type SchoolClass,
  type Student,
  type TalentTag,
} from "@/lib/model";
import { chartImages, reportSummary } from "@/lib/report-data";
import { exportExcel } from "@/lib/excel-export";
import { exportDocx } from "@/lib/docx-export";
import DashboardCharts from "./dashboard-charts";
import { academicLabel, type AcademicTag } from "@/lib/academic-tags";

type Props = {
  students: Student[];
  lessons: Lesson[];
  classes: SchoolClass[];
  subject: string;
  className: string;
  studentScope?: string;
  teacherName?: string;
  schoolYear?: string;
  talentTags: TalentTag[];
  academicTags: AcademicTag[];
};
export default function ReportView({
  students,
  lessons,
  classes,
  subject,
  className,
  studentScope = "Tất cả dân tộc",
  teacherName = "Giáo viên",
  schoolYear = "2026 – 2027",
  talentTags,
  academicTags,
}: Props) {
  const { message } = App.useApp();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState("all");
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const exportLock = useRef(false);
  const invalid = Boolean(from && to && from > to);
  const displayed = students.filter(
    (s) => selected === "all" || s.id === selected,
  );
  const filteredLessons = lessons.filter(
    (l) => (!from || l.date >= from) && (!to || l.date <= to),
  );
  const report = {
    students: displayed,
    classes,
    lessons: filteredLessons,
    subject,
    studentScope,
    teacherName,
    schoolYear,
    talentTags,
    academicTags,
    period:
      from || to
        ? `${from || "Từ đầu"} → ${to || "Hiện tại"}`
        : "Toàn bộ thời gian",
  };
  const sum = reportSummary(report);
  async function save(format: string) {
    if (exportLock.current || invalid) return;
    exportLock.current = true;
    setBusy(format);
    try {
      const images = await chartImages();
      if (format === "word")
        await exportDocx({
          ...report,
          chartImages: images,
          includeDetails: details,
        });
      else await exportExcel({ ...report, chartImages: images });
      message.success(
        `Đã xuất báo cáo ${format === "word" ? "Word" : "Excel"}.`,
      );
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Chưa xuất được báo cáo.");
    } finally {
      setBusy(null);
      exportLock.current = false;
    }
  }
  const talents = displayed.flatMap((s) =>
    (s.talents || []).map((t) => ({
      ...t,
      studentName: s.name,
      className: s.className,
    })),
  );
  return (
    <>
      <div className="report-toolbar no-print">
        <Space wrap>
          <Input
            aria-label="Từ ngày"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span className="muted">đến</span>
          <Input
            aria-label="Đến ngày"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <Select
            aria-label="Học sinh trong báo cáo"
            value={selected}
            onChange={setSelected}
            showSearch
            optionFilterProp="label"
            style={{ width: 220 }}
            options={[
              { value: "all", label: "Tất cả học sinh" },
              ...students.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </Space>
        <Space wrap>
          <Button
            icon={<PrinterOutlined aria-hidden />}
            disabled={invalid}
            onClick={() => window.print()}
          >
            In
          </Button>
          <Button
            icon={<FileExcelOutlined aria-hidden />}
            loading={busy === "excel"}
            disabled={invalid || Boolean(busy)}
            onClick={() => void save("excel")}
          >
            Xuất Excel
          </Button>
          <Button
            type="primary"
            icon={<FileWordOutlined aria-hidden />}
            loading={busy === "word"}
            disabled={invalid || Boolean(busy)}
            onClick={() => void save("word")}
          >
            Xuất Word
          </Button>
        </Space>
        <Checkbox
          checked={details}
          onChange={(e) => setDetails(e.target.checked)}
        >
          Kèm hồ sơ chi tiết trong Word
        </Checkbox>
      </div>
      {invalid && (
        <p role="alert" className="error-text">
          Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.
        </p>
      )}
      <article className="report-paper">
        <div className="report-title">
          <div className="report-school">
            <Image
              src="/school-logo.png"
              alt="Logo trường"
              width={54}
              height={54}
            />
            <span>
              PHÂN HIỆU 1<br />
              <strong>TRƯỜNG THIẾU SINH QUÂN MIỀN TRUNG</strong>
              <small>KHOA TIN HỌC VÀ NGOẠI NGỮ</small>
            </span>
          </div>
          <h2>Báo cáo quản lý học sinh</h2>
          <p>
            Môn {subject} ·{" "}
            {className === "all" ? "Tất cả lớp" : `Lớp ${className}`} ·{" "}
            {studentScope}
          </p>
          <p>
            Năm học {schoolYear} · {report.period} · Người lập: {teacherName}
          </p>
        </div>
        <div className="report-numbers">
          {[
            [sum.students, "Học sinh"],
            [sum.periods, "Tiết đã dạy"],
            [sum.topics, "Bài đã dạy"],
            [`${sum.assessed}/${sum.students}`, "Đã đánh giá học lực"],
          ].map(([value, label]) => (
            <div key={label}>
              <b>{value}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="report-charts">
          <DashboardCharts
            academicTags={academicTags}
            talentTags={talentTags}
            students={displayed}
            subject={subject}
            compact
          />
        </div>
        <h3>Phân loại giới tính</h3>
        <div className="report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                {sum.genders.map((g) => (
                  <th key={g.name}>{g.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {sum.genders.map((g) => (
                  <td key={g.name}>{g.count}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <h3>Tình hình theo lớp</h3>
        <div className="report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                {[
                  "Lớp",
                  "Học sinh",
                  "Đã đánh giá",
                  "Có năng khiếu",
                  "Số tiết",
                  "Số bài",
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => {
                const s = reportSummary({
                  ...report,
                  students: displayed.filter((p) => p.className === c.name),
                  lessons: filteredLessons.filter(
                    (l) => l.className === c.name,
                  ),
                });
                return (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{s.students}</td>
                    <td>{s.assessed}</td>
                    <td>{s.talents}</td>
                    <td>{s.periods}</td>
                    <td>{s.topics}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <h3>Thành phần dân tộc</h3>
        <div className="report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>Dân tộc</th>
                <th>Học sinh</th>
                <th>Tỷ lệ</th>
              </tr>
            </thead>
            <tbody>
              {sum.ethnicities.map((g) => (
                <tr key={g.ethnicity}>
                  <td>{g.ethnicity}</td>
                  <td>{g.count}</td>
                  <td>
                    {sum.students
                      ? ((g.count / sum.students) * 100).toFixed(1)
                      : 0}
                    %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>Năng khiếu và bồi dưỡng</h3>
        {displayed.some((s) => s.talentTagIds?.length) && (
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Học sinh</th>
                  <th>Lớp</th>
                  <th>Thẻ năng khiếu đã gắn</th>
                </tr>
              </thead>
              <tbody>
                {displayed
                  .filter((s) => s.talentTagIds?.length)
                  .map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.className}</td>
                      <td>{talentTagNames(s, talentTags)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        {talents.length ? (
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Học sinh / lớp</th>
                  <th>Lĩnh vực</th>
                  <th>Mức độ</th>
                  <th>Nhận xét / bồi dưỡng</th>
                  <th>Giáo viên</th>
                </tr>
              </thead>
              <tbody>
                {talents.map((t) => (
                  <tr key={t.id}>
                    <td>
                      {t.studentName} · {t.className}
                    </td>
                    <td>{t.category}</td>
                    <td>{t.level}</td>
                    <td>
                      {t.note}
                      <br />
                      {t.plan}
                    </td>
                    <td>{t.teacherName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">
            Chưa có đánh giá năng khiếu trong phạm vi chọn.
          </p>
        )}
        <p className="muted small report-note">
          Đầu vào giữ mã kết quả giáo dục nguồn hoặc điều chỉnh của giáo viên.
          Chưa đánh giá được giữ riêng. Khoảng ngày chỉ giới hạn bài và tiết
          dạy; đánh giá phản ánh hiện trạng khi xuất báo cáo. Một học sinh có
          thể có nhiều năng khiếu.
        </p>
      </article>
      <Collapse
        className="report-preview-details no-print"
        items={[
          {
            key: "students",
            label: `Xem danh sách chi tiết (${displayed.length} học sinh)`,
            children: (
              <Table<Student>
                rowKey="id"
                dataSource={displayed}
                size="small"
                pagination={{ pageSize: 10 }}
                scroll={{ x: 850 }}
                columns={[
                  { title: "HỌC SINH", dataIndex: "name" },
                  { title: "LỚP", dataIndex: "className" },
                  { title: "DÂN TỘC", render: (_, s) => ethnicityOf(s) },
                  {
                    title: "ĐẦU VÀO",
                    render: (_, s) =>
                      academicLabel(
                        assessmentOf(s, subject).before,
                        academicTags,
                      ) || "—",
                  },
                  {
                    title: "HIỆN TẠI",
                    render: (_, s) =>
                      academicLabel(
                        assessmentOf(s, subject).after,
                        academicTags,
                      ) || "Chưa đánh giá",
                  },
                  {
                    title: "NHẬN XÉT",
                    render: (_, s) => assessmentOf(s, subject).note || "—",
                  },
                ]}
              />
            ),
          },
        ]}
      />
    </>
  );
}

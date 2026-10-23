"use client";

import { useState } from "react";
import {
  App,
  Avatar,
  Button,
  Empty,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  FileExcelOutlined,
  SearchOutlined,
  TagsOutlined,
} from "@ant-design/icons";
import {
  assessmentOf,
  INTERACTIONS,
  normalize,
  type Assessment,
  type Student,
} from "@/lib/model";
import { saveWorkspace } from "@/lib/store";
import { useWorkspace } from "@/lib/store";
import { academicOptions, academicTag } from "@/lib/academic-tags";
import AcademicLevelSelect from "./academic-level-select";
import AcademicTagManager from "./academic-tag-manager";

type Props = {
  students: Student[];
  subject: string;
  onOpenStudent: (student: Student) => void;
  onExport: (students: Student[]) => void;
  exportBusy: boolean;
};

export default function EvaluationTable({
  students,
  subject,
  onOpenStudent,
  onExport,
  exportBusy,
}: Props) {
  const { message } = App.useApp();
  const { data } = useWorkspace();
  const [tagManager, setTagManager] = useState(false);
  const [level, setLevel] = useState("all");
  const filterLevel = data.academicTags.some((t) => t.id === level)
    ? level
    : "all";
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const assessed = students.filter(
    (s) => assessmentOf(s, subject).after,
  ).length;
  const filtered = students.filter((s) => {
    const a = assessmentOf(s, subject);
    return (
      normalize(`${s.name} ${s.id}`).includes(normalize(query)) &&
      (filterLevel === "all" ||
        (academicTag(a.after, data.academicTags)?.id ?? a.after) ===
          filterLevel) &&
      (status === "all" ||
        (status === "unassessed" && !a.after) ||
        (status === "assessed" && Boolean(a.after)) ||
        (status === "support" && a.after === "Cần hỗ trợ"))
    );
  });
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / pageSize)),
  );
  async function save(student: Student, patch: Partial<Assessment> | null) {
    try {
      await saveWorkspace((current) => {
        if (!current.students.some((s) => s.id === student.id))
          throw new Error("Học sinh đã bị xóa. Vui lòng tải lại danh sách.");
        if (!current.settings.subjects.includes(subject))
          throw new Error("Môn học đã thay đổi. Vui lòng chọn lại môn.");
        return {
          ...current,
          students: current.students.map((s) => {
            if (s.id !== student.id) return s;
            const assessments = { ...s.assessments };
            if (patch === null) delete assessments[subject];
            else
              assessments[subject] = { ...assessmentOf(s, subject), ...patch };
            return { ...s, assessments };
          }),
        };
      });
      message.open({
        key: `assessment-${student.id}`,
        type: "success",
        content:
          patch === null
            ? `Đã xóa đánh giá môn ${subject} của ${student.name}.`
            : `Đã lưu đánh giá ${student.name}.`,
        duration: 2,
      });
    } catch (e) {
      message.error((e as Error).message);
    }
  }
  const columns: ColumnsType<Student> = [
    {
      title: "HỌC SINH",
      key: "name",
      width: 240,
      render: (_, s) => (
        <button className="student-cell" onClick={() => onOpenStudent(s)}>
          <Avatar
            shape="square"
            size={34}
            style={{ background: "#eaf0e1", color: "#6d8457", fontSize: 11 }}
          >
            {s.name
              .split(/\s+/)
              .slice(-2)
              .map((n) => n[0])
              .join("")}
          </Avatar>
          <span>
            <strong>{s.name}</strong>
            <small>
              Lớp {s.className} ·{" "}
              {s.id.startsWith("HS") ? s.id : s.id.slice(0, 8)}
            </small>
          </span>
        </button>
      ),
    },
    {
      title: (
        <>
          ĐẦU VÀO<span className="column-subtitle">Trước khi vào trường</span>
        </>
      ),
      key: "before",
      width: 185,
      render: (_, s) => (
        <AcademicLevelSelect
          stage="before"
          aria-label={`Đầu vào ${s.name}`}
          placeholder="Chưa đánh giá"
          value={assessmentOf(s, subject).before || undefined}
          onChange={(value) => save(s, { before: value ?? "" })}
        />
      ),
    },
    {
      title: (
        <>
          HỌC LỰC HIỆN TẠI
          <span className="column-subtitle">Sau khi học tại trường</span>
        </>
      ),
      key: "after",
      width: 185,
      render: (_, s) => (
        <AcademicLevelSelect
          stage="after"
          aria-label={`Học lực hiện tại ${s.name}`}
          placeholder="Chưa đánh giá"
          value={assessmentOf(s, subject).after || undefined}
          allowClear
          status={
            assessmentOf(s, subject).after === "Cần hỗ trợ"
              ? "warning"
              : undefined
          }
          onChange={(value) => save(s, { after: value ?? "" })}
        />
      ),
    },
    {
      title: "TƯƠNG TÁC TRONG LỚP",
      key: "interaction",
      width: 165,
      render: (_, s) => (
        <Select
          aria-label={`Tương tác ${s.name}`}
          placeholder="Chưa cập nhật"
          value={assessmentOf(s, subject).interaction || undefined}
          allowClear
          options={INTERACTIONS.map((value) => ({ value, label: value }))}
          onChange={(value) => save(s, { interaction: value ?? "" })}
        />
      ),
    },
    {
      title: "NHẬN XÉT / HƯỚNG HỖ TRỢ",
      key: "note",
      width: 230,
      ellipsis: true,
      render: (_, s) =>
        assessmentOf(s, subject).note ? (
          <Tooltip title={assessmentOf(s, subject).note}>
            <span>{assessmentOf(s, subject).note}</span>
          </Tooltip>
        ) : (
          <span className="unfilled">Chưa có nhận xét</span>
        ),
    },
    {
      title: "",
      key: "actions",
      width: 85,
      fixed: "right",
      render: (_, s) => (
        <Space size={2}>
          <Tooltip title="Nhận xét và hồ sơ">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined aria-hidden />}
              aria-label={`Nhận xét ${s.name}`}
              onClick={() => onOpenStudent(s)}
            />
          </Tooltip>
          <Popconfirm
            title={`Xóa đánh giá môn ${subject}?`}
            description={`Chỉ xóa đánh giá môn này của ${s.name}; hồ sơ học sinh vẫn được giữ.`}
            okText="Xóa đánh giá"
            cancelText="Hủy"
            onConfirm={() => save(s, null)}
          >
            <Button
              type="text"
              size="small"
              disabled={!Object.hasOwn(s.assessments, subject)}
              aria-label={`Xóa đánh giá ${s.name}`}
              icon={<DeleteOutlined aria-hidden />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];
  return (
    <section className="list-panel evaluation-table-panel">
      <div className="panel-heading">
        <div>
          <h2>
            Bảng đánh giá môn {subject}{" "}
            <span className="count-pill">
              {assessed}/{students.length} đã đánh giá
            </span>
          </h2>
          <p>
            <CheckOutlined aria-hidden /> Lựa chọn được lưu ngay. Mỗi học sinh
            một dòng. Đầu vào lấy từ kết quả giáo dục nguồn và có thể điều chỉnh
            theo môn.
          </p>
        </div>
        <Space wrap>
          <Button
            icon={<TagsOutlined aria-hidden />}
            onClick={() => setTagManager(true)}
          >
            Thẻ học lực
          </Button>
          <Button
            icon={<FileExcelOutlined aria-hidden />}
            loading={exportBusy}
            onClick={() => onExport(filtered)}
          >
            Xuất Excel
          </Button>
        </Space>
      </div>
      <div className="table-toolbar">
        <Select
          aria-label="Lọc thẻ học lực"
          value={filterLevel}
          style={{ minWidth: 170 }}
          options={[
            { value: "all", label: "Tất cả học lực" },
            ...academicOptions(data.academicTags, "after"),
          ]}
          onChange={(v) => {
            setLevel(v);
            setPage(1);
          }}
        />
        <Input
          aria-label="Tìm đánh giá học sinh"
          className="student-search"
          prefix={<SearchOutlined aria-hidden />}
          placeholder="Tìm tên hoặc mã học sinh…"
          value={query}
          allowClear
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
        <Select
          aria-label="Lọc trạng thái đánh giá"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          style={{ minWidth: 170 }}
          options={[
            { value: "all", label: "Tất cả học sinh" },
            { value: "unassessed", label: "Chưa đánh giá" },
            { value: "assessed", label: "Đã đánh giá" },
            { value: "support", label: "Cần hỗ trợ" },
          ]}
        />
      </div>
      <Table<Student>
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        rowClassName={(s) =>
          assessmentOf(s, subject).after === "Cần hỗ trợ"
            ? "assessment-needs-support"
            : ""
        }
        scroll={{ x: 1090 }}
        pagination={{
          current: currentPage,
          pageSize,
          total: filtered.length,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 40],
          showTotal: (total, range) =>
            `${range[0]}–${range[1]} / ${total} học sinh`,
          onChange: (p, size) => {
            setPage(p);
            setPageSize(size);
          },
        }}
        locale={{
          emptyText: (
            <Empty
              description="Không có học sinh phù hợp với bộ lọc"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
      />
      <div className="class-table-footer">
        Đánh giá được lưu riêng theo môn học. Chọn môn và lớp ở thanh trên để
        quản lý từng nhóm học sinh.
      </div>
      <AcademicTagManager
        open={tagManager}
        onClose={() => setTagManager(false)}
      />
    </section>
  );
}

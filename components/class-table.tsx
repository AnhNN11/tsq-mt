"use client";

import { useState } from "react";
import {
  App,
  Button,
  Empty,
  Input,
  Popconfirm,
  Progress,
  Space,
  Table,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ArrowRightOutlined,
  DeleteOutlined,
  EditOutlined,
  SearchOutlined,
  TeamOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import {
  isComplete,
  ethnicityOf,
  genderOf,
  lessonStats,
  normalize,
  type SchoolClass,
  type Student,
  type Workspace,
} from "@/lib/model";
import { saveWorkspace } from "@/lib/store";

type Props = {
  data: Workspace;
  subject: string;
  className: string;
  ethnicity?: string;
  gender?: string;
  canEdit?: boolean;
  onEditClass: (c: SchoolClass) => void;
  onAddStudent: (className: string) => void;
  onOpenClass: (name: string) => void;
  onClassDeleted: (name: string) => void;
  onPendingEnrollment: () => void;
};

export default function ClassTable({
  data,
  subject,
  className,
  ethnicity = "all",
  gender = "all",
  canEdit = true,
  onEditClass,
  onAddStudent,
  onOpenClass,
  onClassDeleted,
  onPendingEnrollment,
}: Props) {
  const { message } = App.useApp();
  const [query, setQuery] = useState("");
  const rows = data.classes
    .filter(
      (c) =>
        (className === "all" || c.name === className) &&
        normalize(`${c.name} ${c.track} ${c.note}`).includes(normalize(query)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "vi", { numeric: true }));
  const pupils = (c: SchoolClass): Student[] =>
    data.students.filter(
      (s) =>
        s.className === c.name &&
        (ethnicity === "all" || ethnicityOf(s) === ethnicity) &&
        (gender === "all" || genderOf(s) === gender),
    );
  async function removeClass(c: SchoolClass) {
    try {
      await saveWorkspace((current) => ({
        ...current,
        classes: current.classes.filter((item) => item.id !== c.id),
        students: current.students.filter((s) => s.className !== c.name),
        lessons: current.lessons.filter((l) => l.className !== c.name),
      }));
      message.success(`Đã xóa lớp ${c.name} và dữ liệu liên quan.`);
      onClassDeleted(c.name);
    } catch (e) {
      message.error((e as Error).message);
    }
  }
  const columns: ColumnsType<SchoolClass> = [
    {
      title: "LỚP HỌC",
      key: "name",
      width: 235,
      render: (_, c) => (
        <button
          className="class-name-button"
          onClick={() => onOpenClass(c.name)}
        >
          <span className="class-table-icon">
            <TeamOutlined aria-hidden />
          </span>
          <span>
            <strong>Lớp {c.name}</strong>
            <small>{c.track || "Chưa phân khối"}</small>
          </span>
        </button>
      ),
    },
    {
      title: ethnicity === "all" ? "SĨ SỐ" : "HỌC SINH ĐÃ LỌC",
      key: "size",
      width: 110,
      render: (_, c) => (
        <span className="class-count">
          {pupils(c).length}
          <small> học sinh</small>
        </span>
      ),
    },
    {
      title: (
        <>
          GIẢNG DẠY<span className="column-subtitle">Môn {subject}</span>
        </>
      ),
      key: "lessons",
      width: 150,
      render: (_, c) => {
        const stats = lessonStats(
          data.lessons.filter(
            (l) => l.className === c.name && l.subject === subject,
          ),
        );
        return (
          <span className="class-metric">
            {stats.periods} tiết <span className="muted">/</span> {stats.topics}{" "}
            bài
          </span>
        );
      },
    },
    {
      title: "HOÀN THIỆN HỒ SƠ",
      key: "progress",
      width: 180,
      responsive: ["lg"],
      render: (_, c) => {
        const students = pupils(c);
        const count = students.filter((s) => isComplete(s, subject)).length;
        return students.length ? (
          <div className="class-progress">
            <span>
              {count}/{students.length} đủ thông tin
            </span>
            <Progress
              size="small"
              percent={Math.round((count / students.length) * 100)}
              showInfo={false}
            />
          </div>
        ) : (
          <span className="unfilled">Chưa có học sinh</span>
        );
      },
    },
    {
      title: "GHI CHÚ",
      dataIndex: "note",
      key: "note",
      width: 200,
      responsive: ["xl"],
      ellipsis: true,
      render: (note) => <span className="muted">{note || "—"}</span>,
    },
    {
      title: "THAO TÁC",
      key: "actions",
      width: 220,
      fixed: "right",
      render: (_, c) => (
        <Space size={3}>
          <Button
            size="small"
            className="open-class-button"
            icon={<ArrowRightOutlined aria-hidden />}
            aria-label={`Mở lớp ${c.name}`}
            onClick={() => onOpenClass(c.name)}
          >
            Mở lớp
          </Button>
          {canEdit && (
            <>
              <Tooltip title="Thêm học sinh">
                <Button
                  type="text"
                  size="small"
                  aria-label={`Thêm học sinh lớp ${c.name}`}
                  icon={<UserAddOutlined aria-hidden />}
                  onClick={() => onAddStudent(c.name)}
                />
              </Tooltip>
              <Tooltip title="Chỉnh sửa lớp">
                <Button
                  type="text"
                  size="small"
                  aria-label={`Sửa lớp ${c.name}`}
                  icon={<EditOutlined aria-hidden />}
                  onClick={() => onEditClass(c)}
                />
              </Tooltip>
              <Popconfirm
                title={`Xóa lớp ${c.name}?`}
                description={`Sẽ xóa ${data.students.filter((s) => s.className === c.name).length} học sinh, các đánh giá môn học và ${data.lessons.filter((l) => l.className === c.name).length} lượt dạy của lớp.`}
                okText="Xóa lớp và dữ liệu"
                cancelText="Hủy"
                onConfirm={() => removeClass(c)}
              >
                <Button
                  type="text"
                  size="small"
                  danger
                  aria-label={`Xóa lớp ${c.name}`}
                  icon={<DeleteOutlined aria-hidden />}
                />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];
  columns.splice(
    2,
    0,
    ...["Nam", "Nữ", "Chưa cập nhật"].map((name) => ({
      title: name.toLocaleUpperCase("vi"),
      width: name === "Chưa cập nhật" ? 130 : 75,
      render: (_: unknown, c: SchoolClass) =>
        pupils(c).filter((s) => genderOf(s) === name).length,
    })),
  );
  return (
    <section className="list-panel class-table-panel">
      <div className="panel-heading">
        <div>
          <h2>
            Danh sách lớp học{" "}
            <span className="count-pill">{rows.length} lớp</span>
          </h2>
          <p>
            Khoa Tin học và Ngoại ngữ · Mở từng lớp để quản lý hồ sơ học sinh.
          </p>
        </div>
        {canEdit && data.pendingStudents.length > 0 && (
          <Button
            className="pending-enrollment-button"
            onClick={onPendingEnrollment}
          >
            Chờ xếp lớp{" "}
            <span className="pending-count">{data.pendingStudents.length}</span>
          </Button>
        )}
      </div>
      <div className="table-toolbar">
        <Input
          aria-label="Tìm lớp học"
          className="student-search"
          prefix={<SearchOutlined aria-hidden />}
          placeholder="Tìm lớp, khối hoặc ghi chú…"
          value={query}
          allowClear
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="class-table-caption">
          {rows.length} lớp · {rows.reduce((n, c) => n + pupils(c).length, 0)}{" "}
          học sinh đã nhập
        </span>
      </div>
      <Table<SchoolClass>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        scroll={{ x: "max-content" }}
        pagination={false}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Chưa có lớp phù hợp"
            />
          ),
        }}
      />
      <div className="class-table-footer">
        Chọn “Mở lớp” để xem danh sách, thêm học sinh và cập nhật đánh giá theo
        môn.
      </div>
    </section>
  );
}

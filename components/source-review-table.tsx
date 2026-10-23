"use client";

import { Button, Table, Tag } from "antd";
import type { Student } from "@/lib/model";
import { studentDataIssues } from "@/lib/data-quality";

export default function SourceReviewTable({
  students,
  onOpen,
}: {
  students: Student[];
  onOpen: (student: Student) => void;
}) {
  const rows = students.filter((s) => studentDataIssues(s).length);
  if (!rows.length) return null;
  return (
    <section className="list-panel review-panel">
      <div className="panel-heading">
        <div>
          <h2>
            Cần đối chiếu dữ liệu{" "}
            <span className="count-pill">{rows.length} hồ sơ</span>
          </h2>
          <p>
            Thông tin còn thiếu hoặc chưa xác minh; giữ dữ liệu gốc để đối
            chiếu.
          </p>
        </div>
        <Tag color="orange">Chờ xác nhận</Tag>
      </div>
      <Table<Student>
        size="small"
        rowKey="id"
        dataSource={rows}
        pagination={{ pageSize: 8, showSizeChanger: false }}
        scroll={{ x: 650 }}
        columns={[
          { title: "HỌC SINH", dataIndex: "name", width: 220 },
          { title: "LỚP", dataIndex: "className", width: 80 },
          {
            title: "NỘI DUNG CẦN KIỂM TRA",
            render: (_, s) => studentDataIssues(s).join("\n"),
          },
          {
            title: "",
            key: "action",
            width: 100,
            render: (_, s) => (
              <Button size="small" type="link" onClick={() => onOpen(s)}>
                Mở hồ sơ
              </Button>
            ),
          },
        ]}
      />
    </section>
  );
}

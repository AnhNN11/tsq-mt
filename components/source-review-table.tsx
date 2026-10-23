"use client";

import { Button, Table, Tag } from "antd";
import type { Student } from "@/lib/model";

export default function SourceReviewTable({
  students,
  onOpen,
}: {
  students: Student[];
  onOpen: (student: Student) => void;
}) {
  const rows = students.filter((s) =>
    /trùng tên|cần đối chiếu|chưa có hồ sơ chi tiết/i.test(s.notes),
  );
  if (!rows.length) return null;
  return (
    <section className="list-panel review-panel">
      <div className="panel-heading">
        <div>
          <h2>
            Cần đối chiếu dữ liệu{" "}
            <span className="count-pill">{rows.length} hồ sơ</span>
          </h2>
          <p>Các điểm được đánh dấu trong danh sách nguồn mới nhất.</p>
        </div>
        <Tag color="orange">Chờ xác nhận</Tag>
      </div>
      <Table<Student>
        size="small"
        rowKey="id"
        dataSource={rows}
        pagination={false}
        scroll={{ x: 650 }}
        columns={[
          { title: "HỌC SINH", dataIndex: "name", width: 220 },
          { title: "LỚP", dataIndex: "className", width: 80 },
          { title: "NỘI DUNG CẦN KIỂM TRA", dataIndex: "notes" },
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

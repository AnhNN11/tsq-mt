"use client";

import { Button, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ArrowRightOutlined } from "@ant-design/icons";
import { ethnicitySummary, type SchoolClass, type Student } from "@/lib/model";

type Group = ReturnType<typeof ethnicitySummary>[number];
export default function EthnicityTable({
  students,
  classes,
  selected,
  onSelect,
}: {
  students: Student[];
  classes: SchoolClass[];
  selected: string;
  onSelect: (ethnicity: string) => void;
}) {
  const groups = ethnicitySummary(students);
  const unknown =
    groups.find((g) => g.ethnicity === "Chưa cập nhật")?.count ?? 0;
  const columns: ColumnsType<Group> = [
    {
      title: "DÂN TỘC",
      dataIndex: "ethnicity",
      width: 170,
      render: (value) => <strong>{value}</strong>,
    },
    {
      title: "SỐ HỌC SINH",
      dataIndex: "count",
      width: 110,
      sorter: (a, b) => a.count - b.count,
      render: (value) => (
        <Tag variant="filled" color="green">
          {value} học sinh
        </Tag>
      ),
    },
    {
      title: "TỶ LỆ",
      key: "ratio",
      width: 90,
      render: (_, row) =>
        `${students.length ? ((row.count / students.length) * 100).toFixed(1) : "0"}%`,
    },
    ...classes.map((c) => ({
      title: `LỚP ${c.name}`,
      key: c.id,
      width: 95,
      render: (_: unknown, row: Group) => (
        <span
          className={row.classes[c.name] ? "ethnicity-class-count" : "unfilled"}
        >
          {row.classes[c.name] ?? 0}
        </span>
      ),
    })),
    {
      title: "",
      key: "actions",
      width: 140,
      fixed: "right",
      render: (_, row) => (
        <Button
          size="small"
          type="text"
          icon={<ArrowRightOutlined aria-hidden />}
          aria-label={`Xem học sinh dân tộc ${row.ethnicity}`}
          onClick={() => onSelect(row.ethnicity)}
        >
          Xem học sinh
        </Button>
      ),
    },
  ];
  return (
    <section className="list-panel ethnicity-panel">
      <div className="panel-heading">
        <div>
          <h2>
            Thống kê dân tộc{" "}
            <span className="count-pill">
              {groups.filter((g) => g.ethnicity !== "Chưa cập nhật").length} dân
              tộc
            </span>
          </h2>
          <p>
            {students.length} học sinh trong phạm vi lớp ·{" "}
            {students.length - unknown} đã có thông tin · {unknown} chưa cập
            nhật.
          </p>
        </div>
        <Tag>
          {classes.length === 1 ? `Lớp ${classes[0].name}` : "Tất cả lớp"}
        </Tag>
      </div>
      <Table<Group>
        rowKey="ethnicity"
        columns={columns}
        dataSource={groups}
        rowClassName={(row) =>
          row.ethnicity === selected ? "ethnicity-selected-row" : ""
        }
        pagination={{
          pageSize: 8,
          showSizeChanger: false,
          showTotal: (total) => `${total} nhóm dân tộc`,
        }}
        scroll={{ x: "max-content" }}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0}>
              <strong>Tổng cộng</strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={1}>
              <strong>{students.length}</strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={2}>
              {students.length ? "100%" : "0%"}
            </Table.Summary.Cell>
            {classes.map((c, i) => (
              <Table.Summary.Cell index={i + 3} key={c.id}>
                {students.filter((s) => s.className === c.name).length}
              </Table.Summary.Cell>
            ))}
            <Table.Summary.Cell index={classes.length + 3} />
          </Table.Summary.Row>
        )}
      />
      <div className="class-table-footer">
        Gộp các cách viết tương đương để thống kê; thông tin dân tộc và tôn giáo
        gốc được giữ trong hồ sơ học sinh.
      </div>
    </section>
  );
}

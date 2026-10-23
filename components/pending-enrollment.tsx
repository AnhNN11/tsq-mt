"use client";

import { useState } from "react";
import {
  Alert,
  App,
  Button,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from "antd";
import { SearchOutlined, UserAddOutlined } from "@ant-design/icons";
import {
  normalize,
  studentKey,
  type PendingStudent,
  type Student,
  type Workspace,
} from "@/lib/model";
import { saveWorkspace } from "@/lib/store";

export default function PendingEnrollment({
  data,
  onClose,
}: {
  data: Workspace;
  onClose: () => void;
}) {
  const { message, modal } = App.useApp();
  const [grade, setGrade] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<React.Key[]>([]);
  const [targetClass, setTargetClass] = useState<string>();
  const rows = data.pendingStudents.filter(
    (s) =>
      (grade === "all" || s.grade === grade) &&
      normalize(s.name).includes(normalize(query)),
  );
  const selectedRows = data.pendingStudents.filter((s) =>
    selected.includes(s.id),
  );
  const grades = new Set(selectedRows.map((s) => s.grade));
  const options = data.classes
    .filter(
      (c) =>
        grades.size === 1 && grades.has(c.name.split("/")[0] as "6" | "10"),
    )
    .map((c) => ({ value: c.name, label: `Lớp ${c.name}` }));
  async function assign() {
    if (!targetClass || !selected.length) return;
    try {
      await saveWorkspace((current) => {
        const pending = current.pendingStudents.filter((s) =>
          selected.includes(s.id),
        );
        if (
          pending.length !== selected.length ||
          !current.classes.some((c) => c.name === targetClass)
        )
          throw new Error(
            "Dữ liệu đã thay đổi, vui lòng chọn lại hồ sơ và lớp.",
          );
        const added: Student[] = pending.map((s) => {
          const next = { ...s, className: targetClass };
          delete (next as Partial<PendingStudent>).grade;
          return next;
        });
        if (pending.some((s) => !targetClass.startsWith(`${s.grade}/`)))
          throw new Error(
            "Lớp được chọn không phù hợp với khối trong tài liệu.",
          );
        if (
          added.some((s) =>
            current.students.some(
              (existing) => studentKey(existing) === studentKey(s),
            ),
          )
        )
          throw new Error(
            "Có hồ sơ trùng họ tên trong lớp. Hãy kiểm tra trước khi xếp lớp.",
          );
        return {
          ...current,
          students: [...current.students, ...added],
          pendingStudents: current.pendingStudents.filter(
            (s) => !selected.includes(s.id),
          ),
        };
      });
      message.success(
        `Đã thêm ${selected.length} học sinh vào lớp ${targetClass}.`,
      );
      setSelected([]);
      setTargetClass(undefined);
    } catch (e) {
      message.error((e as Error).message);
    }
  }
  return (
    <Modal
      open
      title={`Hồ sơ chờ xếp lớp (${data.pendingStudents.length})`}
      width={1000}
      onCancel={onClose}
      footer={
        <Space wrap>
          <span className="muted small">Đã chọn {selected.length} hồ sơ</span>
          <Select
            aria-label="Lớp nhận học sinh"
            placeholder={
              grades.size > 1 ? "Chọn học sinh cùng khối" : "Chọn lớp nhận"
            }
            value={targetClass}
            onChange={setTargetClass}
            disabled={grades.size !== 1}
            options={options}
            style={{ width: 190 }}
          />
          <Button
            type="primary"
            icon={<UserAddOutlined aria-hidden />}
            disabled={!selected.length || !targetClass}
            onClick={assign}
          >
            Thêm vào lớp
          </Button>
          <Button onClick={onClose}>Đóng</Button>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        title="Hồ sơ cũ chưa khớp danh sách 4 lớp mới nhất"
        description={`Giữ lại ${data.pendingStudents.length} hồ sơ để đối chiếu, chưa cộng vào sĩ số. Chỉ xếp lớp sau khi xác nhận học sinh còn thuộc phạm vi quản lý; chọn các em cùng khối rồi chọn lớp nhận.`}
      />
      <div className="table-toolbar">
        <Input
          aria-label="Tìm học sinh chờ xếp lớp"
          prefix={<SearchOutlined aria-hidden />}
          placeholder="Tìm họ tên…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected([]);
            setTargetClass(undefined);
          }}
          style={{ maxWidth: 300 }}
        />
        <Select
          aria-label="Lọc khối chờ xếp lớp"
          value={grade}
          onChange={(value) => {
            setGrade(value);
            setSelected([]);
            setTargetClass(undefined);
          }}
          options={[
            { value: "all", label: "Tất cả khối" },
            { value: "6", label: "Khối 6" },
            { value: "10", label: "Khối 10" },
          ]}
        />
      </div>
      <Table<PendingStudent>
        size="small"
        rowKey="id"
        dataSource={rows}
        rowSelection={{
          selectedRowKeys: selected,
          onChange: (keys) => {
            setSelected(keys);
            setTargetClass(undefined);
          },
          preserveSelectedRowKeys: true,
        }}
        pagination={{ pageSize: 8, showTotal: (total) => `${total} hồ sơ` }}
        scroll={{ x: 650 }}
        columns={[
          {
            title: "HỌ VÀ TÊN",
            dataIndex: "name",
            render: (name, s) => (
              <Button
                type="link"
                size="small"
                onClick={() =>
                  modal.info({
                    title: name,
                    width: 600,
                    content: (
                      <div className="pending-detail">
                        <p>
                          <strong>Ngày sinh:</strong> {s.birthDate}
                        </p>
                        <p>
                          <strong>Địa chỉ:</strong> {s.address}
                        </p>
                        <p>
                          <strong>Phụ huynh:</strong>
                          <br />
                          {s.parents}
                        </p>
                        <p>
                          <strong>Gia đình:</strong>
                          <br />
                          {s.family || "Chưa cập nhật"}
                        </p>
                        <p>
                          <strong>Sở trường / sức khỏe:</strong>
                          <br />
                          {s.strengths || "Chưa cập nhật"}
                        </p>
                        <p>
                          <strong>kết quả giáo dục nguồn:</strong>
                          <br />
                          {s.priorEducation || "Chưa cập nhật"}
                        </p>
                        <p>
                          <strong>Ghi chú đối chiếu:</strong>
                          <br />
                          {s.notes || "Chưa cập nhật"}
                        </p>
                      </div>
                    ),
                    okText: "Đóng",
                  })
                }
              >
                {name}
              </Button>
            ),
          },
          {
            title: "KHỐI",
            dataIndex: "grade",
            width: 80,
            render: (value) => <Tag>Khối {value}</Tag>,
          },
          { title: "NGÀY SINH", dataIndex: "birthDate", width: 115 },
          { title: "GIA ĐÌNH", dataIndex: "family", ellipsis: true },
          {
            title: "GHI CHÚ ĐỐI CHIẾU",
            dataIndex: "notes",
            ellipsis: true,
            width: 250,
          },
        ]}
      />
    </Modal>
  );
}

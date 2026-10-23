"use client";
import { useState } from "react";
import {
  App,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  TALENT_CATEGORIES,
  TALENT_LEVELS,
  normalize,
  type Student,
  type TalentAssessment,
  type TalentTag,
} from "@/lib/model";
import { saveWorkspace } from "@/lib/store";
import { canManage } from "@/lib/access";
import { useUser } from "./auth-context";
import TalentTagManager from "./talent-tag-manager";

type Row = { student: Student; talent?: TalentAssessment; key: string };
export default function TalentTable({
  students,
  tags,
}: {
  students: Student[];
  tags: TalentTag[];
}) {
  const user = useUser();
  const manage = canManage(user);
  const { message } = App.useApp();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [tagId, setTagId] = useState("all");
  const [tagManager, setTagManager] = useState(false);
  const [savingTags, setSavingTags] = useState<string[]>([]);
  const [editing, setEditing] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm<TalentAssessment>();
  const rows: Row[] = students
    .flatMap<Row>((student) =>
      student.talents?.length
        ? student.talents.map((talent) => ({
            student,
            talent,
            key: `${student.id}-${talent.id}`,
          }))
        : [{ student, key: student.id }],
    )
    .filter(
      (row) =>
        normalize(row.student.name).includes(normalize(query)) &&
        (tagId === "all" ||
          (tagId === "none"
            ? !row.student.talentTagIds?.length
            : row.student.talentTagIds?.includes(tagId))) &&
        (category === "all" ||
          (category === "none" && !row.talent) ||
          row.talent?.category === category),
    );
  function open(row: Row, fresh = false) {
    setEditing({ ...row, talent: fresh ? undefined : row.talent });
    form.resetFields();
    form.setFieldsValue(fresh ? {} : (row.talent ?? {}));
  }
  async function assignTags(student: Student, ids: string[]) {
    setSavingTags((previous) => [...previous, student.id]);
    try {
      await saveWorkspace((current) => ({
        ...current,
        students: current.students.map((s) =>
          s.id === student.id ? { ...s, talentTagIds: ids } : s,
        ),
      }));
      message.success(`Đã cập nhật thẻ cho ${student.name}.`);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSavingTags((previous) => previous.filter((id) => id !== student.id));
    }
  }
  async function save(values: TalentAssessment) {
    if (!editing) return;
    setBusy(true);
    try {
      const talent: TalentAssessment = {
        id: editing.talent?.id ?? crypto.randomUUID(),
        category: values.category,
        level: values.level,
        note: values.note.trim(),
        plan: values.plan?.trim() || "",
        teacherId: editing.talent?.teacherId ?? user.username,
        teacherName: editing.talent?.teacherName ?? user.name,
        updatedAt: new Date().toISOString(),
      };
      await saveWorkspace((current) => ({
        ...current,
        students: current.students.map((s) =>
          s.id !== editing.student.id
            ? s
            : {
                ...s,
                talents: [
                  ...(s.talents ?? []).filter((t) => t.id !== talent.id),
                  talent,
                ],
              },
        ),
      }));
      message.success("Đã lưu đánh giá năng khiếu.");
      setEditing(null);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(row: Row) {
    try {
      await saveWorkspace((current) => ({
        ...current,
        students: current.students.map((s) =>
          s.id === row.student.id
            ? {
                ...s,
                talents: (s.talents ?? []).filter(
                  (t) => t.id !== row.talent?.id,
                ),
              }
            : s,
        ),
      }));
      message.success("Đã xóa đánh giá năng khiếu.");
    } catch (e) {
      message.error((e as Error).message);
    }
  }
  return (
    <section className="list-panel">
      <div className="panel-heading">
        <div>
          <h2>
            Năng khiếu & bồi dưỡng{" "}
            <span className="count-pill">
              {students.filter((s) => s.talents?.length).length}/
              {students.length} học sinh
            </span>
          </h2>
          <p>
            Gắn thẻ trực tiếp trong bảng, sau đó ghi nhận mức độ và hướng bồi
            dưỡng.
          </p>
        </div>
        <Button onClick={() => setTagManager(true)}>Quản lý thẻ</Button>
      </div>
      <div className="table-toolbar">
        <Input
          prefix={<SearchOutlined aria-hidden />}
          aria-label="Tìm đánh giá năng khiếu"
          placeholder="Tìm học sinh…"
          value={query}
          allowClear
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: 300 }}
        />
        <Select
          aria-label="Lọc thẻ năng khiếu"
          value={tagId}
          onChange={setTagId}
          style={{ minWidth: 210 }}
          showSearch
          optionFilterProp="label"
          options={[
            { value: "all", label: "Tất cả thẻ năng khiếu" },
            { value: "none", label: "Chưa gắn thẻ" },
            ...tags.map((t) => ({
              value: t.id,
              label: `${t.name} (${students.filter((s) => s.talentTagIds?.includes(t.id)).length})`,
            })),
          ]}
        />
        <Select
          aria-label="Lọc năng khiếu"
          value={category}
          onChange={setCategory}
          style={{ minWidth: 180 }}
          options={[
            { value: "all", label: "Tất cả lĩnh vực" },
            { value: "none", label: "Chưa đánh giá" },
            ...TALENT_CATEGORIES.map((value) => ({ value, label: value })),
          ]}
        />
      </div>
      <Table<Row>
        rowKey="key"
        size="small"
        dataSource={rows}
        pagination={{
          pageSize: 10,
          showTotal: (total) => `${total} dòng đánh giá`,
        }}
        scroll={{ x: 1400 }}
        columns={[
          {
            title: "HỌC SINH",
            width: 220,
            render: (_, r) => (
              <div>
                <strong>{r.student.name}</strong>
                <small className="table-subline">
                  Lớp {r.student.className}
                </small>
              </div>
            ),
          },
          {
            title: "THẺ NĂNG KHIẾU",
            width: 245,
            render: (_, r) => (
              <Select
                mode="multiple"
                aria-label={`Thẻ năng khiếu ${r.student.name}`}
                value={r.student.talentTagIds ?? []}
                placeholder="Gắn thẻ…"
                style={{ width: "100%" }}
                disabled={savingTags.includes(r.student.id)}
                loading={savingTags.includes(r.student.id)}
                showSearch
                optionFilterProp="label"
                maxTagCount="responsive"
                options={tags.map((t) => ({ value: t.id, label: t.name }))}
                onChange={(ids) => void assignTags(r.student, ids)}
                tagRender={({ value, label, closable, onClose }) => (
                  <Tag
                    color={tags.find((t) => t.id === value)?.color}
                    closable={closable}
                    onClose={onClose}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    style={{ margin: 2 }}
                  >
                    {label}
                  </Tag>
                )}
              />
            ),
          },
          {
            title: "SỞ TRƯỜNG NGUỒN",
            width: 190,
            render: (_, r) => (
              <span className="muted">{r.student.strengths || "Chưa có"}</span>
            ),
            ellipsis: true,
          },
          {
            title: "LĨNH VỰC",
            width: 130,
            render: (_, r) => r.talent?.category ?? "Chưa đánh giá",
          },
          {
            title: "MỨC ĐỘ",
            width: 150,
            render: (_, r) =>
              r.talent ? (
                <Tag color={r.talent.level === "Nổi trội" ? "green" : "gold"}>
                  {r.talent.level}
                </Tag>
              ) : (
                "—"
              ),
          },
          {
            title: "NHẬN XÉT / BỒI DƯỠNG",
            width: 230,
            render: (_, r) => (
              <div>
                {r.talent?.note || "—"}
                <small className="table-subline">{r.talent?.plan}</small>
              </div>
            ),
          },
          {
            title: "GIÁO VIÊN",
            width: 170,
            render: (_, r) => (
              <div>
                {r.talent?.teacherName || "—"}
                <small className="table-subline">
                  {r.talent &&
                    new Date(r.talent.updatedAt).toLocaleDateString("vi-VN", {
                      timeZone: "Asia/Ho_Chi_Minh",
                    })}
                </small>
              </div>
            ),
          },
          {
            title: "",
            width: 120,
            fixed: "right",
            render: (_, r) => (
              <Space size={0}>
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined aria-hidden />}
                  aria-label={`Thêm năng khiếu ${r.student.name}`}
                  onClick={() => open(r, true)}
                />
                {r.talent &&
                  (manage || r.talent.teacherId === user.username) && (
                    <>
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined aria-hidden />}
                        aria-label={`Sửa năng khiếu ${r.student.name}`}
                        onClick={() => open(r)}
                      />
                      <Popconfirm
                        title="Xóa đánh giá năng khiếu này?"
                        okText="Xóa"
                        cancelText="Hủy"
                        onConfirm={() => remove(r)}
                      >
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined aria-hidden />}
                          aria-label={`Xóa năng khiếu ${r.student.name}`}
                        />
                      </Popconfirm>
                    </>
                  )}
              </Space>
            ),
          },
        ]}
      />
      <TalentTagManager
        open={tagManager}
        onClose={() => setTagManager(false)}
      />
      <Modal
        open={Boolean(editing)}
        title={`${editing?.talent ? "Sửa" : "Thêm"} đánh giá năng khiếu · ${editing?.student.name ?? ""}`}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        okText="Lưu đánh giá năng khiếu"
        cancelText="Hủy"
        confirmLoading={busy}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item
            name="category"
            label="Lĩnh vực năng khiếu"
            rules={[{ required: true }]}
          >
            <Select
              aria-label="Lĩnh vực năng khiếu"
              options={TALENT_CATEGORIES.map((value) => ({
                value,
                label: value,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="level"
            label="Mức độ năng khiếu"
            rules={[{ required: true }]}
          >
            <Select
              aria-label="Mức độ năng khiếu"
              options={TALENT_LEVELS.map((value) => ({ value, label: value }))}
            />
          </Form.Item>
          <Form.Item
            name="note"
            label="Biểu hiện và nhận xét"
            rules={[{ required: true, whitespace: true }]}
          >
            <Input.TextArea rows={3} maxLength={5000} />
          </Form.Item>
          <Form.Item name="plan" label="Hướng bồi dưỡng">
            <Input.TextArea rows={3} maxLength={5000} />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}

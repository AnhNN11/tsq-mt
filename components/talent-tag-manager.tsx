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
import { EditOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { TALENT_CATEGORIES, normalize, type TalentTag } from "@/lib/model";
import { saveWorkspace, useWorkspace } from "@/lib/store";
import { canManage } from "@/lib/access";
import { useUser } from "./auth-context";

export default function TalentTagManager({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data } = useWorkspace();
  const user = useUser();
  const { message } = App.useApp();
  const [editing, setEditing] = useState<Partial<TalentTag> | null>(null);
  const [busy, setBusy] = useState(false);
  const canEdit = (tag: TalentTag) =>
    canManage(user) || tag.createdBy === user.username;
  function edit(tag: Partial<TalentTag>) {
    setEditing(tag);
  }
  async function save(values: TalentTag) {
    setBusy(true);
    try {
      await saveWorkspace((current) => {
        const name = values.name.trim();
        if (
          current.talentTags.some(
            (t) =>
              t.id !== editing?.id && normalize(t.name) === normalize(name),
          )
        )
          throw new Error("Tên thẻ đã tồn tại.");
        const tag: TalentTag = {
          ...values,
          name,
          id: editing?.id ?? crypto.randomUUID(),
          createdBy: editing?.createdBy ?? user.username,
        };
        return {
          ...current,
          talentTags: editing?.id
            ? current.talentTags.map((t) => (t.id === tag.id ? tag : t))
            : [...current.talentTags, tag],
        };
      });
      setEditing(null);
      message.success("Đã lưu thẻ năng khiếu.");
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    try {
      await saveWorkspace((current) => ({
        ...current,
        talentTags: current.talentTags.filter((t) => t.id !== id),
        students: current.students.map((s) => ({
          ...s,
          talentTagIds: (s.talentTagIds ?? []).filter((tagId) => tagId !== id),
        })),
        pendingStudents: current.pendingStudents,
      }));
      message.success("Đã xóa thẻ năng khiếu.");
    } catch (e) {
      message.error((e as Error).message);
    }
  }
  return (
    <Modal
      open={open}
      title={
        editing
          ? editing.id
            ? "Sửa thẻ năng khiếu"
            : "Tạo thẻ năng khiếu"
          : "Danh mục thẻ năng khiếu"
      }
      onCancel={() => (editing ? setEditing(null) : onClose())}
      footer={editing ? null : <Button onClick={onClose}>Đóng danh mục</Button>}
      width={editing ? 520 : 780}
      destroyOnHidden
    >
      {editing ? (
        <TagForm
          key={editing.id ?? "new"}
          tag={editing}
          busy={busy}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <>
          <p className="muted">
            Tạo thẻ dùng chung và gắn nhiều thẻ cho học sinh. Giáo viên chỉnh
            sửa thẻ do mình tạo; quản trị và phó khoa quản lý toàn bộ.
          </p>
          <Button
            type="primary"
            icon={<PlusOutlined aria-hidden />}
            onClick={() => edit({})}
          >
            Tạo thẻ năng khiếu
          </Button>
          <Table<TalentTag>
            rowKey="id"
            size="small"
            dataSource={data.talentTags}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 590 }}
            style={{ marginTop: 16 }}
            columns={[
              {
                title: "Thẻ",
                dataIndex: "name",
                render: (_, t) => <Tag color={t.color}>{t.name}</Tag>,
              },
              { title: "Lĩnh vực", dataIndex: "category" },
              {
                title: "Học sinh",
                render: (_, t) =>
                  data.students.filter((s) => s.talentTagIds?.includes(t.id))
                    .length,
              },
              {
                title: "",
                width: 92,
                render: (_, t) =>
                  canEdit(t) && (
                    <Space size={0}>
                      <Button
                        type="text"
                        icon={<EditOutlined aria-hidden />}
                        aria-label={`Sửa thẻ ${t.name}`}
                        onClick={() => edit(t)}
                      />
                      <Popconfirm
                        title={`Xóa thẻ ${t.name}?`}
                        description="Thẻ sẽ được gỡ khỏi học sinh. Các nhận xét đánh giá vẫn được giữ lại."
                        okText="Xóa thẻ"
                        cancelText="Hủy"
                        onConfirm={() => remove(t.id)}
                      >
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined aria-hidden />}
                          aria-label={`Xóa thẻ ${t.name}`}
                        />
                      </Popconfirm>
                    </Space>
                  ),
              },
            ]}
          />
        </>
      )}
    </Modal>
  );
}
function TagForm({
  tag,
  busy,
  onSave,
  onCancel,
}: {
  tag: Partial<TalentTag>;
  busy: boolean;
  onSave: (values: TalentTag) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <Form
      layout="vertical"
      initialValues={{ color: "#315b35", category: "Tin học", ...tag }}
      onFinish={onSave}
    >
      <Form.Item
        name="name"
        label="Tên thẻ"
        rules={[{ required: true, whitespace: true }]}
      >
        <Input maxLength={60} />
      </Form.Item>
      <Form.Item
        name="category"
        label="Nhóm năng khiếu"
        rules={[{ required: true }]}
      >
        <Select
          aria-label="Nhóm năng khiếu"
          options={TALENT_CATEGORIES.map((value) => ({
            value,
            label: value,
          }))}
        />
      </Form.Item>
      <Form.Item name="color" label="Màu thẻ" rules={[{ required: true }]}>
        <Input type="color" style={{ width: 90 }} />
      </Form.Item>
      <Space>
        <Button onClick={onCancel}>Hủy</Button>
        <Button type="primary" htmlType="submit" loading={busy}>
          Lưu thẻ
        </Button>
      </Space>
    </Form>
  );
}

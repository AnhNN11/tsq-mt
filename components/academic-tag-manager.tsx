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
  Tooltip,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import {
  ACADEMIC_STAGES,
  academicKey,
  academicTagUsage,
  validAcademicTags,
  type AcademicTag,
} from "@/lib/academic-tags";
import { saveWorkspace, useWorkspace } from "@/lib/store";
import { canManage } from "@/lib/access";
import { useUser } from "./auth-context";
import StatusBadge from "./status-badge";

export default function AcademicTagManager({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data } = useWorkspace();
  const user = useUser();
  const { message } = App.useApp();
  const [editing, setEditing] = useState<Partial<AcademicTag> | null>(null);
  const [busy, setBusy] = useState(false);
  const canEdit = (t: AcademicTag) =>
    canManage(user) || t.createdBy === user.username;
  async function save(values: AcademicTag) {
    setBusy(true);
    try {
      await saveWorkspace((current) => {
        const tag = {
          ...values,
          name: values.name.trim().replace(/\s+/g, " "),
          id: editing?.id ?? crypto.randomUUID(),
          createdBy: editing?.createdBy ?? user.username,
        };
        if (
          current.academicTags.some(
            (t) =>
              t.id !== tag.id && academicKey(t.name) === academicKey(tag.name),
          )
        )
          throw new Error("Tên thẻ học lực đã tồn tại.");
        if (
          editing?.id &&
          !current.academicTags.some((t) => t.id === editing.id)
        )
          throw new Error("Thẻ đã bị xóa. Vui lòng tải lại danh mục.");
        const academicTags = editing?.id
          ? current.academicTags.map((t) => (t.id === tag.id ? tag : t))
          : [...current.academicTags, tag];
        if (!validAcademicTags(academicTags))
          throw new Error("Tên thẻ không hợp lệ hoặc trùng mã của thẻ khác.");
        return { ...current, academicTags };
      });
      setEditing(null);
      message.success("Đã lưu thẻ học lực.");
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    setBusy(true);
    try {
      await saveWorkspace((current) => {
        const tag = current.academicTags.find((t) => t.id === id);
        if (tag && academicTagUsage(current, tag))
          throw new Error(
            "Thẻ đang được sử dụng. Hãy đổi thẻ cho học sinh trước khi xóa.",
          );
        return {
          ...current,
          academicTags: current.academicTags.filter((t) => t.id !== id),
        };
      });
      message.success("Đã xóa thẻ học lực.");
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      title={
        editing
          ? editing.id
            ? "Sửa thẻ học lực"
            : "Tạo thẻ học lực"
          : "Thẻ học lực"
      }
      onCancel={() => (editing ? setEditing(null) : onClose())}
      footer={editing ? null : <Button onClick={onClose}>Đóng</Button>}
      width={editing ? 480 : 760}
      destroyOnHidden
    >
      {editing ? (
        <Form
          key={editing.id ?? "new"}
          layout="vertical"
          initialValues={{ stage: "both", color: "#315b35", ...editing }}
          onFinish={save}
        >
          <Form.Item
            name="name"
            label="Tên thẻ học lực"
            rules={[
              { required: true, whitespace: true, message: "Nhập tên thẻ." },
              { max: 60 },
            ]}
          >
            <Input maxLength={60} placeholder="Ví dụ: Tiến bộ rõ rệt" />
          </Form.Item>
          <Form.Item
            name="stage"
            label="Áp dụng cho"
            rules={[{ required: true }]}
          >
            <Select
              aria-label="Phạm vi thẻ học lực"
              options={Object.entries(ACADEMIC_STAGES).map(
                ([value, label]) => ({ value, label }),
              )}
            />
          </Form.Item>
          <Form.Item name="color" label="Màu thẻ" rules={[{ required: true }]}>
            <Input type="color" style={{ width: 90 }} />
          </Form.Item>
          <Space>
            <Button onClick={() => setEditing(null)}>Hủy</Button>
            <Button htmlType="submit" type="primary" loading={busy}>
              Lưu thẻ học lực
            </Button>
          </Space>
        </Form>
      ) : (
        <>
          <p className="muted">
            Tự đặt tên và màu thẻ. Sửa tên vẫn giữ các đánh giá đã gắn. Giáo
            viên quản lý thẻ mình tạo. Số hồ sơ sử dụng bao gồm cả hồ sơ chờ xếp
            lớp.
          </p>
          <Button
            type="primary"
            icon={<PlusOutlined aria-hidden />}
            onClick={() => setEditing({})}
          >
            Tạo thẻ học lực
          </Button>
          <Table<AcademicTag>
            rowKey="id"
            size="small"
            style={{ marginTop: 16 }}
            dataSource={data.academicTags}
            pagination={false}
            scroll={{ x: 530 }}
            columns={[
              {
                title: "Thẻ học lực",
                render: (_, t) => (
                  <StatusBadge color={t.color}>{t.name}</StatusBadge>
                ),
              },
              { title: "Áp dụng", render: (_, t) => ACADEMIC_STAGES[t.stage] },
              {
                title: "Hồ sơ sử dụng",
                render: (_, t) => academicTagUsage(data, t),
              },
              {
                title: "",
                width: 90,
                render: (_, t) =>
                  canEdit(t) && (
                    <Space size={0}>
                      <Button
                        type="text"
                        icon={<EditOutlined aria-hidden />}
                        aria-label={`Sửa thẻ học lực ${t.name}`}
                        onClick={() => setEditing(t)}
                      />
                      <Tooltip
                        title={
                          academicTagUsage(data, t)
                            ? "Thẻ đang gắn với học sinh"
                            : undefined
                        }
                      >
                        <span>
                          <Popconfirm
                            title={`Xóa thẻ ${t.name}?`}
                            okText="Xóa thẻ"
                            cancelText="Hủy"
                            onConfirm={() => remove(t.id)}
                          >
                            <Button
                              type="text"
                              danger
                              loading={busy}
                              disabled={academicTagUsage(data, t) > 0}
                              icon={<DeleteOutlined aria-hidden />}
                              aria-label={`Xóa thẻ học lực ${t.name}`}
                            />
                          </Popconfirm>
                        </span>
                      </Tooltip>
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
